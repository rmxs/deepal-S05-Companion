"""Health checks: read-only, one broken check never hides the others."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest

spec = importlib.util.spec_from_file_location("health_test", Path(__file__).resolve().parents[1] / "custom_components/deepal_companion/health.py")
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)
NOW = 1_000_000.0


def state(value, age=60):
    return types.SimpleNamespace(state=value, last_updated=types.SimpleNamespace(timestamp=lambda: NOW - age))


def runtime(states, entities=None, worker_done=False, queued=0, engine=True):
    class Worker:
        def done(self):
            return worker_done
    queue = types.SimpleNamespace(qsize=lambda: queued)
    return types.SimpleNamespace(entities=entities or {"batt": "sensor.s05_battery_level", "cloud": "binary_sensor.s05_cloud"},
                                 hass=types.SimpleNamespace(states=types.SimpleNamespace(get=states.get)),
                                 worker=Worker(), queue=queue, engine=object() if engine else None)


def by_id(rows):
    return {row["id"]: row for row in rows}


class Sensors(unittest.TestCase):
    def test_healthy_sensors_are_ok(self):
        rows = by_id(health.sensor_checks(runtime({"sensor.s05_battery_level": state("80"), "binary_sensor.s05_cloud": state("on")}), NOW))
        self.assertEqual({r["status"] for r in rows.values()}, {"ok"})

    def test_missing_battery_is_an_error_but_missing_optional_is_a_warning(self):
        rows = by_id(health.sensor_checks(runtime({}), NOW))
        self.assertEqual(rows["sensor_batt"]["status"], "error")
        self.assertEqual(rows["sensor_cloud"]["status"], "warning")

    def test_unavailable_cloud_and_cloud_off_and_stale_battery(self):
        rows = by_id(health.sensor_checks(runtime({"sensor.s05_battery_level": state("80", age=7 * 3600), "binary_sensor.s05_cloud": state("off")}), NOW))
        self.assertEqual(rows["sensor_batt"]["status"], "warning")
        self.assertEqual(rows["sensor_cloud"]["status"], "warning")
        rows = by_id(health.sensor_checks(runtime({"sensor.s05_battery_level": state("unavailable"), "binary_sensor.s05_cloud": state("on")}), NOW))
        self.assertEqual(rows["sensor_batt"]["status"], "error")


class Recorder(unittest.TestCase):
    def test_states(self):
        self.assertEqual(health.backend_checks(runtime({}))[0]["status"], "ok")
        self.assertEqual(health.backend_checks(runtime({}, worker_done=True))[0]["status"], "error")
        self.assertEqual(health.backend_checks(runtime({}, engine=False))[0]["status"], "error")
        self.assertEqual(health.backend_checks(runtime({}, queued=900))[0]["status"], "warning")


class Notifications(unittest.TestCase):
    def engine(self, rules, history=(), enabled=True):
        return types.SimpleNamespace(config={"enabled": enabled, "rules": rules}, history=list(history))

    def test_no_active_alerts_is_ok(self):
        self.assertEqual(health.notification_checks(self.engine([]), [])[0]["status"], "ok")
        self.assertEqual(health.notification_checks(self.engine([{"devices": []}], enabled=False), [])[0]["status"], "ok")

    def test_alert_without_reachable_device_warns_and_failed_delivery_warns(self):
        rows = by_id(health.notification_checks(self.engine([{"devices": ["notify.gone"]}], [{"status": "error", "time": 5}]), [{"svc": "notify.phone"}]))
        self.assertEqual(rows["recipients"]["status"], "warning")
        self.assertEqual(rows["delivery"]["status"], "warning")

    def test_test_notifications_do_not_count_as_delivery_results(self):
        rows = by_id(health.notification_checks(self.engine([{"devices": ["notify.phone"]}], [{"status": "test", "time": 9}, {"status": "sent", "time": 5}]), [{"svc": "notify.phone"}]))
        self.assertEqual(rows["recipients"]["status"], "ok")
        self.assertEqual(rows["delivery"]["status"], "ok")


class Pricing(unittest.TestCase):
    def test_unpriced_paid_profile_warns_free_does_not(self):
        costs = {"profiles": [{"id": "home", "name": "Home", "price": None, "free": False, "source": "battery"},
                              {"id": "work", "name": "Work", "price": None, "free": True, "source": "battery"}]}
        row = health.pricing_checks(costs)[0]
        self.assertEqual(row["status"], "warning")
        self.assertIn("Home", row["detail"])
        self.assertNotIn("Work", row["detail"])
        self.assertEqual(health.pricing_checks({"profiles": [{"id": "h", "price": 0.2, "free": False, "source": "battery"}]})[0]["status"], "ok")


class Build(unittest.IsolatedAsyncioTestCase):
    async def test_a_failing_check_is_reported_without_hiding_the_rest_and_nothing_is_written(self):
        writes = []
        async def db(method, *args):
            if method == "storage_stats":
                raise RuntimeError("disk")
            if method == "schema_version":
                return 3
            if method == "get":
                return {"profiles": []}
            writes.append(method)
        rt = runtime({"sensor.s05_battery_level": state("80", age=0), "binary_sensor.s05_cloud": state("on")})
        rt.hub, rt.vehicle, rt.notifications = types.SimpleNamespace(db=db), "car", None
        fake_const = types.ModuleType("deepal_companion.const")
        fake_const.VERSION = "9.9.9"
        package = types.ModuleType("deepal_companion")
        package.__path__ = []
        health.__package__ = "deepal_companion"
        sys.modules.update({"deepal_companion": package, "deepal_companion.const": fake_const})
        try:
            result = await health.build_health(rt)
        finally:
            for name in ("deepal_companion", "deepal_companion.const"):
                sys.modules.pop(name, None)
        self.assertEqual(writes, [])
        self.assertEqual(result["version"], "9.9.9")
        ids = {c["id"] for c in result["checks"]}
        self.assertIn("storage", ids)                     # the broken section is reported
        self.assertIn("sensor_batt", ids)                 # the others still ran
        self.assertEqual(result["status"], "warning")
        self.assertEqual(sum(result["counts"].values()), len(result["checks"]))


if __name__ == "__main__":
    unittest.main()
