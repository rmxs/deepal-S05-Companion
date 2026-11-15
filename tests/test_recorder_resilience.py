"""Bounded archive queue, retried writes and last-good sensor values, using explicit HA doubles."""
import asyncio
import importlib
import sqlite3
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

from test_lifecycle import integration

module = importlib.import_module("companion_lifecycle.runtime")
Runtime = module.VehicleRuntime


def snapshot_from_db(db):
    """Test adapter: a read snapshot backed by an async db fake. Each load runs on an executor thread and every store call
    is forwarded to the fake with the same method names the archive uses, so call sequences stay comparable."""
    async def read_db(load):
        loop = asyncio.get_running_loop()
        def call(method, *args):
            return asyncio.run_coroutine_threadsafe(db(method, *args), loop).result()
        class Store:
            def sessions(self, vehicle, start=None, end=None):
                return call("sessions", vehicle, start, end)
            def get(self, vehicle, key, default=None):
                return call("get", vehicle, key, default)
            def pricing_inputs(self, vehicle, requests):
                return call("pricing_inputs", vehicle, requests)
            def session_page(self, vehicle, before=None, limit=5, location="", sort="newest"):
                return call("session_page", vehicle, before, limit, location, sort)
        return await loop.run_in_executor(None, load, Store())
    return read_db


def make_runtime(states=None, db=None, read_db=None):
    states = states if states is not None else {}
    def get(entity):
        value = states.get(entity)
        return None if value is None else types.SimpleNamespace(state=value, attributes={})
    async def default_db(method, *args):
        return None
    hass = types.SimpleNamespace(states=types.SimpleNamespace(get=get), async_create_task=lambda coro: asyncio.ensure_future(coro))
    fake_db = db or default_db
    hub = types.SimpleNamespace(hass=hass, db=fake_db, read_db=read_db or snapshot_from_db(fake_db))
    runtime = Runtime(hub, types.SimpleNamespace(unique_id="car"))
    runtime.entities = {"batt": "sensor.battery", "charging": "sensor.charging", "odometer": "sensor.odo"}
    runtime.engine = types.SimpleNamespace(state={})
    return runtime, states


class BoundedQueueTests(unittest.TestCase):
    def test_redundant_readings_are_dropped_before_charging_ones(self):
        queue = module.BoundedQueue(3, 6, lambda: {"sensor.battery"})
        queue.put_nowait((1, "sensor.battery", "50", "%", {}))
        queue.put_nowait((2, "sensor.odo", "10", "km", {}))
        queue.put_nowait((3, None, None, "", {}))
        queue.put_nowait((4, "sensor.battery", "51", "%", {}))
        items = [queue.get_nowait() for _ in range(queue.qsize())]
        self.assertEqual(sum(1 for item in items if item[1] == "sensor.battery"), 2, "Charging readings are kept")
        self.assertEqual(queue.dropped, 1)
        self.assertEqual(len(items), 3)

    def test_hard_limit_drops_oldest_even_when_every_reading_matters(self):
        queue = module.BoundedQueue(2, 4, lambda: {"sensor.battery"})
        for i in range(10):
            queue.put_nowait((i, "sensor.battery", str(i), "%", {}))
        self.assertEqual(queue.qsize(), 4)
        self.assertEqual([queue.get_nowait()[0] for _ in range(4)], [6, 7, 8, 9])

    def test_queue_accounting_stays_consistent(self):
        async def run():
            queue = module.BoundedQueue(1, 2, lambda: set())
            for i in range(5):
                queue.put_nowait((i, "sensor.odo", str(i), "", {}))
            while queue.qsize():
                queue.get_nowait()
                queue.task_done()
            await asyncio.wait_for(queue.join(), 1)
        asyncio.run(run())

    def test_stop_marker_is_never_dropped(self):
        queue = module.BoundedQueue(1, 2, lambda: set())
        queue.put_nowait(None)
        queue.put_nowait((1, "sensor.odo", "1", "", {}))
        queue.put_nowait((2, "sensor.odo", "2", "", {}))
        self.assertIsNone(queue.get_nowait())


class LastGoodValueTests(unittest.TestCase):
    def test_good_value_survives_unavailable(self):
        runtime, states = make_runtime({"sensor.battery": "55"})
        self.assertEqual(runtime.snapshot()["batt"], "55")
        states["sensor.battery"] = "unavailable"
        self.assertEqual(runtime.snapshot()["batt"], "55")
        self.assertEqual(runtime.snapshot()["batt"], "55")
        states["sensor.battery"] = "56"
        self.assertEqual(runtime.snapshot()["batt"], "56")

    def test_carried_value_expires_after_six_hours(self):
        runtime, states = make_runtime({"sensor.battery": "55"})
        self.assertEqual(runtime.snapshot(1000)["batt"], "55")
        states["sensor.battery"] = "unavailable"
        self.assertEqual(runtime.snapshot(2000)["batt"], "55")
        self.assertEqual(runtime.snapshot(2000 + 6 * 3600 - 1)["batt"], "55")
        self.assertIsNone(runtime._expired_since)
        self.assertEqual(runtime.snapshot(2000 + 6 * 3600)["batt"], "unavailable")
        self.assertEqual(runtime._expired_since, 2000)
        states["sensor.battery"] = "60"
        self.assertEqual(runtime.snapshot(2000 + 7 * 3600)["batt"], "60")
        self.assertIsNone(runtime._expired_since)
        states["sensor.battery"] = "unavailable"
        self.assertEqual(runtime.snapshot(2000 + 8 * 3600)["batt"], "60", "A new outage gets its own six hours")

    def test_expired_unrelated_sensor_cannot_end_a_charge(self):
        # Only readings the charging engine decides on may seed the outage start: an odometer that stayed unavailable
        # for hours must not make a later short cloud drop close an open charge at once.
        runtime, states = make_runtime({"sensor.battery": "55", "sensor.odo": "1200"})
        runtime.snapshot(1000)
        states["sensor.odo"] = "unavailable"
        self.assertEqual(runtime.snapshot(2000)["odometer"], "1200")
        self.assertEqual(runtime.snapshot(2000 + 7 * 3600)["odometer"], "unavailable")
        self.assertIsNone(runtime._expired_since)

    def test_never_reported_stays_unavailable(self):
        runtime, _ = make_runtime({"sensor.battery": "unavailable"})
        self.assertEqual(runtime.snapshot()["batt"], "unavailable")

    def test_other_states_are_left_alone(self):
        runtime, states = make_runtime({"sensor.battery": "55"})
        runtime.snapshot()
        states["sensor.battery"] = "unknown"
        self.assertEqual(runtime.snapshot()["batt"], "unknown")
        states["sensor.battery"] = "unavailable"
        self.assertEqual(runtime.snapshot()["batt"], "unavailable", "Only OK -> unavailable keeps the old value")

    def test_missing_entity_is_none(self):
        runtime, _ = make_runtime({})
        self.assertIsNone(runtime.snapshot()["batt"])


class WriteRetryTests(unittest.IsolatedAsyncioTestCase):
    async def test_temporary_error_is_retried(self):
        calls = []
        async def db(method, *args):
            calls.append(method)
            if len(calls) < 3:
                raise sqlite3.OperationalError("database is locked")
        runtime, _ = make_runtime(db=db)
        with patch.object(module, "WRITE_RETRY_DELAY", 0):
            await runtime._write([("sensor.battery", 1, "50", "%")], [])
        self.assertEqual(calls, ["record_update"] * 3)

    async def test_gives_up_after_the_last_attempt(self):
        calls = []
        async def db(method, *args):
            calls.append(method)
            raise sqlite3.OperationalError("database is locked")
        runtime, _ = make_runtime(db=db)
        with patch.object(module, "WRITE_RETRY_DELAY", 0), self.assertRaises(sqlite3.OperationalError):
            await runtime._write([], [])
        self.assertEqual(len(calls), module.WRITE_ATTEMPTS)

    async def test_permanent_error_is_not_retried(self):
        calls = []
        async def db(method, *args):
            calls.append(method)
            raise ValueError("bad data")
        runtime, _ = make_runtime(db=db)
        with self.assertRaises(ValueError):
            await runtime._write([], [])
        self.assertEqual(len(calls), 1)


class LastGoodReadingsTests(unittest.TestCase):
    def test_skips_trailing_unavailable_and_missing_entities(self):
        from pathlib import Path
        root = Path(__file__).resolve().parents[1]
        package = types.ModuleType("companion_resilience")
        package.__path__ = [str(root / "custom_components" / "deepal_companion")]
        sys.modules["companion_resilience"] = package
        Database = importlib.import_module("companion_resilience.database").Database
        with tempfile.TemporaryDirectory() as folder:
            db = Database(str(Path(folder) / "test.sqlite"))
            db.initialize()
            db.ensure_vehicle("car", "Car", {"prefix": "s05", "battery_entity": "sensor.s05_battery_level", "entities": {}})
            db.sample("car", "sensor.battery", 1, "55", "%")
            db.sample("car", "sensor.battery", 2, "unavailable", "%")
            db.sample("car", "sensor.cloud", 3, "unknown")
            result = db.last_good_readings("car", ["sensor.battery", "sensor.cloud", "sensor.none"])
        self.assertEqual(result["sensor.battery"], "55")
        self.assertEqual(result["sensor.cloud"], "unknown", "Callers decide whether a stored state is usable")
        self.assertNotIn("sensor.none", result)


if __name__ == "__main__":
    unittest.main()
