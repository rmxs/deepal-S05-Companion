"""Real SQLite behaviour for the archive, on a temporary database that is removed after each test.

The archive runs in WAL mode (database.py sets journal_mode=WAL). In WAL a writer's lock does not block readers, and a
blocked writer waits only for the busy timeout. So blocking is simulated on the write path with an external lock, and a
slow read is simulated with a real long-running SQLite query.
"""
import asyncio
import contextlib
import importlib
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
VEHICLE = "car"
LONG_QUERY = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c WHERE x < 9000000) SELECT count(*) FROM c"  # ~2 s


class ArchiveTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.dir = tempfile.mkdtemp(prefix="companion-sqlite-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.path = os.path.join(self.dir, "archive.sqlite")
        self.archive = Database(self.path)
        self.archive.initialize()
        self.archive.ensure_vehicle(VEHICLE, "Car", {"prefix": "s05", "battery_entity": "sensor.battery"})
        loop = asyncio.get_running_loop()
        self.hub = Hub.__new__(Hub)  # the production hub.db wrapper: lock plus executor
        self.hub.lock = asyncio.Lock()
        self.hub.archive = self.archive
        self.hub.vehicles = {}
        self.hub.hass = types.SimpleNamespace(async_add_executor_job=lambda fn, *a: loop.run_in_executor(None, fn, *a))
        self.hold = None
        self.addCleanup(self.release_external)

    def lock_archive(self):
        """Hold a write lock from a separate connection, as a stuck writer would."""
        self.hold = sqlite3.connect(self.path, timeout=1, isolation_level=None, check_same_thread=False)
        self.hold.execute("BEGIN IMMEDIATE")

    def release_external(self):
        if self.hold is not None:
            with contextlib.suppress(sqlite3.Error):
                self.hold.execute("COMMIT")
            self.hold.close()
            self.hold = None

    def test_concurrent_writers_and_readers_on_separate_connections(self):
        errors = []
        def writer(w):
            try:
                for i in range(40):
                    self.archive.put(VEHICLE, f"w{w}-{i}", {"n": i})
            except Exception as error:
                errors.append(error)
        def reader():
            try:
                for _ in range(40):
                    self.archive.sessions(VEHICLE)
            except Exception as error:
                errors.append(error)
        threads = [threading.Thread(target=writer, args=(w,)) for w in range(4)]
        threads += [threading.Thread(target=reader) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(30)
        self.assertFalse(any(thread.is_alive() for thread in threads), "a thread did not finish")
        self.assertEqual(errors, [])
        self.assertTrue(all(self.archive.get(VEHICLE, f"w{w}-{i}") == {"n": i} for w in range(4) for i in range(40)))

    def test_blocked_writer_waits_for_the_busy_database_then_commits(self):
        self.lock_archive()
        releaser = threading.Timer(1.0, self.release_external)
        releaser.start()
        start = time.monotonic()
        self.archive.put(VEHICLE, "busy", "yes")
        elapsed = time.monotonic() - start
        releaser.join(5)
        self.assertGreaterEqual(elapsed, 0.8, "the write waited for the lock instead of failing at once")
        self.assertEqual(self.archive.get(VEHICLE, "busy"), "yes")

    def test_archive_connections_use_a_thirty_second_busy_timeout(self):
        real_connect, seen = sqlite3.connect, []
        def spy(*args, **kwargs):
            seen.append(kwargs.get("timeout"))
            return real_connect(*args, **kwargs)
        with patch.object(database.sqlite3, "connect", side_effect=spy):
            self.archive.get(VEHICLE, "x")
        self.assertEqual(seen, [30])

    def test_characterisation_reads_are_not_blocked_by_a_writer_lock_in_wal_mode(self):
        self.lock_archive()
        start = time.monotonic()
        value = self.archive.get(VEHICLE, "missing", "default")
        elapsed = time.monotonic() - start
        self.assertEqual(value, "default")
        self.assertLess(elapsed, 0.5, "in WAL mode a read is not stalled by an external write lock")

    async def test_cancelled_blocked_write_releases_hub_lock_and_recovers_after_release(self):
        self.lock_archive()
        waiter = asyncio.ensure_future(self.hub.db("put", VEHICLE, "x", "value"))
        await asyncio.sleep(0.3)
        self.assertTrue(self.hub.lock.locked())
        waiter.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await waiter
        self.assertFalse(self.hub.lock.locked(), "cancelling the caller releases hub.lock")
        self.release_external()
        await asyncio.wait_for(self.hub.db("put", VEHICLE, "y", "after"), 10)
        self.assertEqual(self.archive.get(VEHICLE, "y"), "after")

    async def test_archive_write_completes_while_a_summary_snapshot_is_still_reading(self):  # replaces the old blocking assertion
        real_sessions = self.archive.sessions
        def slow_sessions(vehicle, start=None, end=None, include_curve=False, db=None):
            db.execute(LONG_QUERY).fetchone()  # real SQLite work inside the snapshot, about two seconds
            return real_sessions(vehicle, start, end, include_curve, db=db)
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        with patch.object(self.archive, "sessions", slow_sessions):
            waiter = asyncio.ensure_future(runtime.summary_values())
            await asyncio.sleep(0.3)  # the snapshot is now inside the slow query
            began = time.monotonic()
            await asyncio.wait_for(self.hub.db("put", VEHICLE, "engine", {"s": 1}), 5)
            write_seconds = time.monotonic() - began
            self.assertFalse(waiter.done(), "the summary read is still running when the write has committed")
            self.assertLess(write_seconds, 1.0, "the archive write does not wait for the summary snapshot")
            result = await asyncio.wait_for(waiter, 15)
        self.assertEqual(self.archive.get(VEHICLE, "engine"), {"s": 1})
        self.assertEqual(result["sessions"], 0)
        for _ in range(100):  # the shared calculation finishes on its own and clears its flight
            if runtime._summary_flight is None:
                break
            await asyncio.sleep(0.05)
        self.assertIsNone(runtime._summary_flight)

    async def test_single_flight_runs_one_real_sessions_query_for_concurrent_callers(self):
        runtime, _ = make_runtime(db=self.hub.db, read_db=self.hub.read_db)
        runtime.entry.title = "Car"
        with patch.object(self.archive, "sessions", wraps=self.archive.sessions) as spy:
            results = await asyncio.gather(*(runtime.summary_values() for _ in range(6)))
        self.assertEqual(spy.call_count, 1)
        self.assertTrue(all(result == results[0] for result in results))


if __name__ == "__main__":
    unittest.main()
