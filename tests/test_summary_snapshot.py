"""Option A regression tests: summary, dashboard and page reads run on one SQLite read snapshot each, without hub.lock
or _pricing_lock held during SQLite reads. Real SQLite on a temporary database, removed after each test."""
import asyncio
import contextlib
import importlib
import json
import os
import shutil
import sqlite3
import tempfile
import threading
import time
import types
import unittest
from unittest.mock import patch

from test_lifecycle import integration  # noqa: F401  installs the Home Assistant doubles and companion_lifecycle package
from test_recorder_resilience import make_runtime

database = importlib.import_module("companion_lifecycle.database")
Database = database.Database
Hub = importlib.import_module("companion_lifecycle").Hub
calculate = importlib.import_module("companion_lifecycle.pricing").calculate
VEHICLE = "car"
BASE = 1_700_000_000
HOUR = 3600
LONG_QUERY = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x < 9000000) SELECT count(*) FROM c"  # ~2 s


def session_data(n):
    start = BASE + n * HOUR
    return {"id": f"s{n}", "s": start * 1000, "e": (start + 1800) * 1000, "live": False,
            "kwh": 9.2, "capacity": 18.4, "from": 20, "to": 70}


class SnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.dir = tempfile.mkdtemp(prefix="companion-snapshot-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.archive = Database(os.path.join(self.dir, "archive.sqlite"))
        self.archive.initialize()
        self.archive.ensure_vehicle(VEHICLE, "Car", {"prefix": "s05", "battery_entity": "sensor.battery"})
        loop = asyncio.get_running_loop()
        self.hub = Hub.__new__(Hub)  # the production read_db and db paths
        self.hub.lock = asyncio.Lock()
        self.hub.archive = self.archive
        self.hub.vehicles = {}
        self.hub.hass = types.SimpleNamespace(async_add_executor_job=lambda fn, *a: loop.run_in_executor(None, fn, *a))
        self.hold = None
        self.addCleanup(self.release_external)

    def release_external(self):
        if self.hold is not None:
            with contextlib.suppress(sqlite3.Error):
                self.hold.execute("COMMIT")
            self.hold.close()
            self.hold = None

    def commit_generation(self, n):
        """One transaction: session n and the cost settings that record how many sessions there are."""
        data = session_data(n)
        with self.archive.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("INSERT INTO sessions(id,vehicle,start,end,active,data) VALUES(?,?,?,?,?,?)",
                       (data["id"], VEHICLE, data["s"] / 1000, data["e"] / 1000, 0, json.dumps(data)))
            db.execute("INSERT INTO kv VALUES(?,?,?) ON CONFLICT(vehicle,key) DO UPDATE SET value=excluded.value",
                       (VEHICLE, "costs", json.dumps({"profiles": [], "sessions": {}, "gen": n})))

    def slow_first_sessions(self, delay_for_calls=1):
        """Patches archive.sessions so its first call(s) run a real ~2 s query on the snapshot connection."""
        real_sessions, calls = self.archive.sessions, []
        def sessions(vehicle, start=None, end=None, include_curve=False, db=None):
            calls.append(1)
            if len(calls) <= delay_for_calls:
                db.execute(LONG_QUERY).fetchone()
            return real_sessions(vehicle, start, end, include_curve, db=db)
        return patch.object(self.archive, "sessions", sessions)

    async def wait_for_flight_to_clear(self, runtime):
        for _ in range(100):
            if runtime._summary_flight is None:
                return
            await asyncio.sleep(0.05)

    # 2. Consistent multi-query snapshot
    def test_sessions_and_costs_come_from_one_moment(self):
        self.commit_generation(1)
        def load(store):
            rows = store.sessions(VEHICLE)
            self.commit_generation(2)  # a writer commits between the two reads
            return len(rows), store.get(VEHICLE, "costs", {})["gen"]
        self.assertEqual(self.archive.read_snapshot(load), (1, 1))
        self.assertEqual(self.archive.get(VEHICLE, "costs")["gen"], 2, "the writer did commit")
        # Control: the same two reads on separate connections can see a mixed state, which is why the snapshot exists.
        rows = self.archive.sessions(VEHICLE)
        self.commit_generation(3)
        self.assertNotEqual(len(rows), self.archive.get(VEHICLE, "costs")["gen"])

    # 3. Revision changes during a read
    async def test_revision_change_during_a_read_is_not_cached_as_current(self):
        self.commit_generation(1)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        real_sessions, done = self.archive.sessions, []
        def sessions(vehicle, start=None, end=None, include_curve=False, db=None):
            rows = real_sessions(vehicle, start, end, include_curve, db=db)  # this calculation sees one session
            if not done:
                done.append(True)
                self.commit_generation(2)  # a write and its revision bump land while the calculation runs
                runtime._summary_revision += 1
            return rows
        with patch.object(self.archive, "sessions", sessions):
            result = await asyncio.wait_for(runtime.summary_values(), 10)
        self.assertEqual(result["sessions"], 2, "the caller receives the state that follows the write")
        self.assertEqual(runtime._summary_cache[0], runtime._summary_revision, "only the current revision is cached")
        self.assertEqual(runtime._summary_cache[1]["sessions"], 2)

    # 4. Multiple concurrent readers and a writer
    async def test_many_snapshot_readers_and_a_writer_stay_consistent(self):
        self.commit_generation(1)
        failures, errors, finished, stop = [], [], [], threading.Event()
        def writer():
            try:
                n = 2
                while not stop.is_set() and n < 60:
                    self.commit_generation(n)
                    n += 1
            except Exception as error:  # reported by the test, not swallowed
                errors.append(error)
        def load(store):
            return len(store.sessions(VEHICLE)), store.get(VEHICLE, "costs", {})["gen"]
        async def reader():
            for _ in range(20):
                count, gen = await self.hub.read_db(load)
                if count != gen:
                    failures.append((count, gen))
            finished.append(True)
        writing = asyncio.get_running_loop().run_in_executor(None, writer)
        await asyncio.wait_for(asyncio.gather(*(reader() for _ in range(8))), 60)
        stop.set()
        await writing
        self.assertEqual(errors, [])
        self.assertEqual(failures, [])
        self.assertEqual(len(finished), 8)

    # 5. Database timeout behaviour
    async def test_snapshot_reads_proceed_while_a_writer_holds_the_database_lock(self):
        self.commit_generation(1)
        self.hold = sqlite3.connect(self.archive.path, timeout=1, isolation_level=None, check_same_thread=False)
        self.hold.execute("BEGIN IMMEDIATE")  # a stuck writer holds the write lock
        began = time.monotonic()
        result = await asyncio.wait_for(self.hub.read_db(lambda store: len(store.sessions(VEHICLE))), 5)
        self.assertEqual(result, 1)
        self.assertLess(time.monotonic() - began, 1.0, "in WAL mode a snapshot read never waits for the write lock")

    # 6. Cancellation and executor cleanup
    async def test_cancelled_summary_caller_leaves_no_open_snapshot_connection(self):
        self.commit_generation(1)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        opened, real_connect = [], sqlite3.connect
        def spy(*args, **kwargs):
            connection = real_connect(*args, **kwargs)
            opened.append(connection)
            return connection
        with patch.object(database.sqlite3, "connect", side_effect=spy), self.slow_first_sessions():
            caller = asyncio.ensure_future(runtime.summary_values())
            await asyncio.sleep(0.3)
            caller.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await caller
            await self.wait_for_flight_to_clear(runtime)
        self.assertIsNone(runtime._summary_flight, "the shared calculation finished on its own")
        self.assertTrue(opened, "a snapshot connection was used")
        for connection in opened:  # a closed connection refuses every statement, so no transaction can stay open on it
            with self.assertRaises(sqlite3.ProgrammingError):
                connection.execute("SELECT 1")

    # 7. Integration unload: covered by test_summary_singleflight.test_unload_while_calculation_runs_keeps_shared_work_safe.

    # 8. No duplicate or lost charging records
    async def test_concurrent_archive_writes_and_summaries_lose_and_duplicate_nothing(self):
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        async def write_all():
            for n in range(1, 41):
                data = session_data(n)
                await self.hub.db("record_update", VEHICLE, [], [data], {})
        async def summarise():
            for _ in range(20):
                await runtime.summary_values()
                await asyncio.sleep(0)
        await asyncio.wait_for(asyncio.gather(write_all(), summarise()), 60)
        rows = await self.hub.read_db(lambda store: store.sessions(VEHICLE))
        self.assertEqual(sorted(row["id"] for row in rows), sorted(f"s{n}" for n in range(1, 41)))

    # 9. Pricing output equivalence
    async def test_snapshot_pricing_matches_direct_calculation(self):
        profile = {"id": "home", "name": "Home", "source": "battery", "free": False, "efficiency": 90, "price": 0.25}
        for n in range(1, 5):
            self.commit_generation(n)
        settings = {"profiles": [profile],
                    "sessions": {str(BASE + n * HOUR): {"profile": profile, "capacity": 18.4} for n in (1, 2, 3)}}
        self.archive.put(VEHICLE, "costs", settings)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        rows = await runtime.priced_sessions()
        self.assertEqual(sorted(row["id"] for row in rows), ["s1", "s2", "s3", "s4"])
        for row in rows:
            n = int(row["id"][1:])
            record = settings["sessions"].get(str(BASE + n * HOUR))
            expected = calculate(session_data(n), record, [], "")
            self.assertEqual(row["pricing"], expected, row["id"])
        self.assertIsNotNone(next(row for row in rows if row["id"] == "s1")["pricing"]["cost"])

    # 10. Dashboard responsiveness during a slow read
    async def test_dashboard_returns_while_a_summary_snapshot_is_stalled(self):
        for n in range(1, 4):
            self.commit_generation(n)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        with self.slow_first_sessions(delay_for_calls=1):
            waiter = asyncio.ensure_future(runtime.summary_values())
            await asyncio.sleep(0.3)  # the summary snapshot is inside the slow query
            began = time.monotonic()
            dashboard = await asyncio.wait_for(runtime.charging_dashboard(), 5)
            took = time.monotonic() - began
            self.assertFalse(waiter.done(), "the summary is still stalled")
            self.assertLess(took, 1.0, "the dashboard does not wait for the summary snapshot")
            self.assertIn("total", dashboard)
            await asyncio.wait_for(waiter, 15)

    # 11. Revision bump ordering: a bump before its commit would cache old data under the new revision. Every bump in
    # the code follows its commit; this test fixes the sequence that would be wrong.
    async def test_stale_read_under_a_new_revision_is_not_served_after_the_commit(self):
        self.commit_generation(1)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        first = await runtime.summary_values()
        self.assertEqual(first["sessions"], 1)
        self.commit_generation(2)
        runtime._summary_revision += 1  # bump after the commit, as runtime.py does
        second = await runtime.summary_values()
        self.assertEqual(second["sessions"], 2)


if __name__ == "__main__":
    unittest.main()
