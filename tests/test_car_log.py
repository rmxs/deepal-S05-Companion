"""Car logs: change detection, restore guard, confirmation delays, charge sessions, left unlocked and preconditioning rows. Everything is mocked."""
import asyncio
import importlib
import sys
import time
from pathlib import Path
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

STUBS = {name: ModuleType(name) for name in (
    "homeassistant", "homeassistant.core", "homeassistant.helpers", "homeassistant.helpers.entity_registry",
    "homeassistant.helpers.event", "homeassistant.helpers.storage", "homeassistant.helpers.dispatcher")}
STUBS["homeassistant.core"].callback = lambda func: func
STUBS["homeassistant.helpers"].entity_registry = STUBS["homeassistant.helpers.entity_registry"]
SENT, LATER = [], []
STUBS["homeassistant.helpers.dispatcher"].async_dispatcher_send = lambda hass, signal, *args: SENT.append((signal, args))
STUBS["homeassistant.helpers.event"].async_track_state_change_event = lambda hass, ids, cb: (lambda: None)
STUBS["homeassistant.helpers.event"].async_track_time_interval = lambda hass, cb, interval: (lambda: None)


def fake_later(hass, delay, action):
    item = {"delay": delay, "action": action, "cancelled": False}
    LATER.append(item)
    return lambda: item.update(cancelled=True)


STUBS["homeassistant.helpers.event"].async_call_later = fake_later


class FakeStore:
    saved = {}

    def __init__(self, hass, version, key):
        self.key = key

    async def async_load(self):
        return FakeStore.saved.get(self.key)

    async def async_save(self, data):
        FakeStore.saved[self.key] = data

    def async_delay_save(self, producer, delay):
        FakeStore.saved[self.key] = producer()


class FakeRegistry:
    def __init__(self, entries):
        self.entities = {e.entity_id: e for e in entries}

    def async_get(self, entity_id):
        return self.entities.get(entity_id)


REGISTRY = FakeRegistry([])
STUBS["homeassistant.helpers.entity_registry"].async_get = lambda hass: REGISTRY
STUBS["homeassistant.helpers.storage"].Store = FakeStore
package = ModuleType("dccarlog")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
with patch.dict(sys.modules, {**STUBS, "dccarlog": package}):
    car_log = importlib.import_module("dccarlog.car_log")


def state(value, changed=None):
    return SimpleNamespace(state=value, last_changed=SimpleNamespace(timestamp=lambda: changed if changed is not None else time.time()))


class FakeHass:
    def __init__(self):
        self.states = SimpleNamespace(get=lambda entity: self.data.get(entity))
        self.data = {}
        self.config_entries = SimpleNamespace(async_entries=lambda domain: self.configs)
        self.configs = []


def entry(entity_id, unique_id, domain="binary_sensor"):
    return SimpleNamespace(entity_id=entity_id, unique_id=unique_id, domain=domain, platform="deepal", device_id="dev")


def build(**extra):
    hass = FakeHass()
    entries = [entry("binary_sensor.s05_doors_lock_state", "deepal_car1_doors_locked"),
               entry("binary_sensor.s05_front_left_door", "deepal_car1_door_front_left"),
               entry("binary_sensor.s05_trunk", "deepal_car1_trunk"),
               entry("binary_sensor.s05_warning_tpms", "deepal_car1_warning_tpms"),
               entry("binary_sensor.s05_warning_airbag", "deepal_car1_warning_airbag")]
    global REGISTRY
    REGISTRY = FakeRegistry(entries)
    hass.data = {"binary_sensor.s05_doors_lock_state": state("off"), "binary_sensor.s05_front_left_door": state("off"),
                 "binary_sensor.s05_trunk": state("off"), "binary_sensor.s05_warning_tpms": state("off"),
                 "binary_sensor.s05_warning_airbag": state("on"), "binary_sensor.s05_charging": state("off"),
                 "binary_sensor.s05_charger_plugged": state("off"), "sensor.s05_battery_level": state("70"),
                 "sensor.s05_power_status": state("off"), "sensor.s05_total_odometer": state("1000"),
                 "binary_sensor.s05_cloud_connection": state("on")}
    runtime = SimpleNamespace(hass=hass, vehicle="s05", _device_id="dev", notifications=None, preconditioning=None,
                              entities={"batt": "sensor.s05_battery_level", "pow": "sensor.s05_power_status", "odo": "sensor.s05_total_odometer",
                                        "charging": "binary_sensor.s05_charging", "plug": "binary_sensor.s05_charger_plugged",
                                        "cloud": "binary_sensor.s05_cloud_connection"}, **extra)
    log = car_log.CarLog(runtime)
    FakeStore.saved = {}
    with patch.dict(sys.modules, {**STUBS}):
        asyncio.run(log.start())
    return hass, runtime, log


class CarLogTests(unittest.TestCase):
    def setUp(self):
        LATER.clear()
        SENT.clear()

    def test_start_is_a_baseline_and_writes_nothing(self):
        hass, runtime, log = build()
        self.assertEqual(len(log.rows), 0)
        self.assertEqual(log.car_id, "car1")
        self.assertEqual(log.baseline["lock"], "off")

    def test_lock_change_is_logged_once(self):
        hass, runtime, log = build()
        log.handle("binary_sensor.s05_doors_lock_state", state("on"))
        log.handle("binary_sensor.s05_doors_lock_state", state("on"))   # same value again: nothing
        self.assertEqual([r["title"] for r in log.rows], ["Doors unlocked"])
        self.assertEqual(log.rows[0]["cat"], "security")

    def test_unavailable_is_never_a_change(self):
        hass, runtime, log = build()
        for value in ("unavailable", "unknown", "off"):
            log.handle("binary_sensor.s05_front_left_door", state(value))
        self.assertEqual(len(log.rows), 0)

    def test_change_during_a_gap_is_marked_late(self):
        hass, runtime, log = build()
        log.handle("binary_sensor.s05_front_left_door", state("unavailable"))
        log.handle("binary_sensor.s05_front_left_door", state("on"))
        self.assertTrue(log.rows[-1]["late"])
        self.assertEqual(log.rows[-1]["title"], "Front left door opened")

    def test_warning_must_last_before_it_is_logged(self):
        hass, runtime, log = build()
        hass.data["binary_sensor.s05_warning_tpms"] = state("on")
        log.handle("binary_sensor.s05_warning_tpms", state("on"))
        self.assertEqual(len(log.rows), 0)
        self.assertEqual(LATER[-1]["delay"], car_log.CONFIRM)
        log.handle("binary_sensor.s05_warning_tpms", state("off"))      # gone before the wait: nothing
        self.assertTrue(LATER[-1]["cancelled"])
        log.handle("binary_sensor.s05_warning_tpms", state("off"))
        self.assertEqual(len(log.rows), 0)

    def test_confirmed_warning_and_its_clearing(self):
        hass, runtime, log = build()
        hass.data["binary_sensor.s05_warning_tpms"] = state("on", time.time() - 120)
        log.handle("binary_sensor.s05_warning_tpms", state("on"))
        LATER[-1]["action"](None)
        self.assertEqual(log.rows[-1]["title"], "Tyre pressure warning")
        self.assertEqual(log.rows[-1]["sev"], "important")
        self.assertEqual([a["title"] for a in log.active()], ["Tyre pressure warning"])
        hass.data["binary_sensor.s05_warning_tpms"] = state("off")
        log.handle("binary_sensor.s05_warning_tpms", state("off"))
        self.assertEqual(log.rows[-1]["title"], "Tyre pressure warning cleared")
        self.assertEqual(log.active(), [])

    def test_warning_already_on_at_start_is_active_but_not_a_row(self):
        hass, runtime, log = build()
        hass.data["binary_sensor.s05_warning_airbag"] = state("on", time.time() - 600)
        self.assertEqual([a["key"] for a in log.active()], ["w_airbag"])
        self.assertEqual(len(log.rows), 0)
        log.handle("binary_sensor.s05_warning_airbag", state("off"))
        self.assertEqual(len(log.rows), 0)   # it never logged the start, so no "cleared" is invented

    def test_charge_session(self):
        hass, runtime, log = build()
        log.handle("binary_sensor.s05_charging", state("on"), now=1000.0)
        hass.data["sensor.s05_battery_level"] = state("92")
        log.handle("binary_sensor.s05_charging", state("off"), now=1000.0 + 25 * 60)
        start, end = list(log.rows)
        self.assertEqual((start["title"], start["detail"]["level"]), ("Charging started", 70.0))
        self.assertEqual(end["detail"], {"start_level": 70.0, "level": 92.0, "minutes": 25})
        self.assertEqual(start["session"], end["session"])

    def test_short_charge_without_gain_is_removed(self):
        hass, runtime, log = build()
        log.handle("binary_sensor.s05_charging", state("on"), now=1000.0)
        log.handle("binary_sensor.s05_charging", state("off"), now=1030.0)
        self.assertEqual(len(log.rows), 0)

    def test_connection_lost_needs_time(self):
        hass, runtime, log = build()
        hass.data["binary_sensor.s05_cloud_connection"] = state("off", time.time() - 300)
        log.handle("binary_sensor.s05_cloud_connection", state("off"))
        LATER[-1]["action"](None)
        self.assertEqual(log.rows[-1]["title"], "Vehicle connection lost")
        hass.data["binary_sensor.s05_cloud_connection"] = state("on")
        log.handle("binary_sensor.s05_cloud_connection", state("on"))
        self.assertEqual(log.rows[-1]["title"], "Vehicle connection restored")

    def test_left_unlocked_uses_the_alert_wait_and_the_parked_rule(self):
        engine = SimpleNamespace(config={"rules": [{"preset": "unlocked", "enabled": True, "preset_options": {"wait": 20}}]})
        hass, runtime, log = build()
        runtime.notifications = engine
        self.assertEqual(log.wait_seconds(), 20 * 60)
        now = time.time()
        hass.data["binary_sensor.s05_doors_lock_state"] = state("on", now - 15 * 60)
        log.check_left(now)
        self.assertIsNone(log.left)                              # not long enough yet
        hass.data["binary_sensor.s05_doors_lock_state"] = state("on", now - 25 * 60)
        hass.data["sensor.s05_power_status"] = state("on", now - 5 * 60)
        log.check_left(now)
        self.assertIsNone(log.left)                              # car is on and recently active: not parked
        hass.data["sensor.s05_power_status"] = state("off", now - 25 * 60)
        log.check_left(now)
        self.assertEqual(log.rows[-1]["title"], "Left unlocked")
        self.assertEqual(log.rows[-1]["origin"], "derived")
        log.check_left(now)
        self.assertEqual(len(log.rows), 1)                        # written once
        log.baseline["lock"] = "on"                               # the car had reported the unlock earlier
        log.handle("binary_sensor.s05_doors_lock_state", state("off"), now=now + 600)
        self.assertEqual(log.rows[-1]["title"], "Doors locked")
        self.assertEqual(log.rows[-1]["detail"], {"minutes": 35})
        self.assertIsNone(log.left)

    def test_left_unlocked_default_wait_and_unknown_power(self):
        hass, runtime, log = build()
        self.assertEqual(log.wait_seconds(), 30 * 60)
        now = time.time()
        hass.data["binary_sensor.s05_doors_lock_state"] = state("on", now - 3600)
        hass.data["sensor.s05_power_status"] = state("unavailable")
        log.check_left(now)
        self.assertIsNone(log.left)                              # unknown power is never taken as parked

    def test_polling_mode_marks_rows(self):
        hass, runtime, log = build()
        vehicle = SimpleNamespace(car_id="car1")
        coordinator = SimpleNamespace(vehicles=[vehicle], update_interval=SimpleNamespace(total_seconds=lambda: 300),
                                      mqtt_session_stats=lambda: {"enabled": True, "details": {"state": "conflict"}})
        hass.configs = [SimpleNamespace(options={}, runtime_data=SimpleNamespace(coordinator=coordinator))]
        log.handle("binary_sensor.s05_trunk", state("on"))
        self.assertEqual(log.rows[-1]["poll"], 300)
        coordinator.mqtt_session_stats = lambda: {"enabled": True, "details": {"state": "connected"}}
        log.handle("binary_sensor.s05_trunk", state("off"))
        self.assertNotIn("poll", log.rows[-1])
        hass.configs[0].options = {"mqtt_live_session": False}
        log.handle("binary_sensor.s05_trunk", state("on"))
        self.assertEqual(log.rows[-1]["poll"], 300)

    def test_log_survives_a_restart(self):
        hass, runtime, log = build()
        log.handle("binary_sensor.s05_trunk", state("on"))
        asyncio.run(log.stop())
        again = car_log.CarLog(runtime)
        with patch.dict(sys.modules, {**STUBS}):
            asyncio.run(again.start())
        self.assertEqual([r["title"] for r in again.rows], ["Trunk opened"])

    def test_old_rows_are_dropped_on_start(self):
        hass, runtime, log = build()
        FakeStore.saved["deepal_companion_car_log_s05"] = {"rows": [
            {"id": "1", "time": time.time() - 31 * 86400, "cat": "security", "kind": "locked", "title": "Doors locked"},
            {"id": "2", "time": time.time() - 86400, "cat": "security", "kind": "locked", "title": "Doors locked"}]}
        again = car_log.CarLog(runtime)
        with patch.dict(sys.modules, {**STUBS}):
            asyncio.run(again.start())
        self.assertEqual(len(again.rows), 1)

    def test_preconditioning_rows_are_grouped_and_readable(self):
        history = [
            {"id": "a", "time": 1000, "kind": "start_requested", "temperature": 22, "duration": 15, "source": "app"},
            {"id": "b", "time": 1010, "kind": "start_confirmed"},
            {"id": "c", "time": 1010 + 14 * 60, "kind": "auto_shutdown"},
            {"id": "d", "time": 9000, "kind": "start_failed", "error": "Offline"}]
        rows = car_log.precondition_rows(history, 0)
        self.assertEqual([r["title"] for r in rows], ["Preconditioning on", "Preconditioning ended by the car", "Preconditioning start failed"])
        self.assertEqual(rows[0]["session"], rows[1]["session"])
        self.assertEqual(rows[1]["detail"]["minutes"], 14)
        self.assertEqual(rows[1]["detail"]["temperature"], 22)
        self.assertNotIn("session", rows[2])
        self.assertEqual(rows[2]["sev"], "critical")

    def test_view_without_a_log_and_with_one(self):
        self.assertFalse(asyncio.run(car_log.view(SimpleNamespace()))["ready"])
        hass, runtime, log = build()
        runtime.car_log = log
        runtime.preconditioning = SimpleNamespace(history=[{"id": "x", "time": time.time() - 60, "kind": "start_confirmed"}])
        log.handle("binary_sensor.s05_trunk", state("on"))
        data = asyncio.run(car_log.view(runtime))
        self.assertTrue(data["ready"])
        self.assertEqual(len(data["rows"]), 2)
        self.assertGreaterEqual(data["rows"][0]["time"], data["rows"][1]["time"])
        self.assertEqual(data["retention_days"], 30)

    def test_archived_charges_fill_the_time_before_the_log(self):
        hass, runtime, log = build()
        runtime.car_log = log
        runtime.preconditioning = SimpleNamespace(history=[])
        now = time.time()
        old = {"id": "a", "s": (now - 5 * 86400) * 1000, "e": (now - 5 * 86400 + 3600) * 1000, "from": 30, "to": 70, "live": False}
        flap = {"id": "b", "s": (now - 4 * 86400) * 1000, "e": (now - 4 * 86400 + 20) * 1000, "from": 50, "to": 50, "live": False}
        after = {"id": "c", "s": (now + 100) * 1000, "e": (now + 200) * 1000, "from": 50, "to": 60, "live": False}

        async def db(op, *args):
            return [old, flap, after]
        runtime.hub = SimpleNamespace(db=db)
        runtime.vehicle = "v1"
        data = asyncio.run(car_log.view(runtime))
        charging = [r for r in data["rows"] if r["cat"] == "charging"]
        self.assertEqual([r["kind"] for r in charging], ["charging_end", "charging_start"])
        self.assertEqual(charging[0]["detail"], {"start_level": 30, "level": 70, "minutes": 60})
        self.assertEqual(charging[0]["session"], charging[1]["session"])

    def test_history_rows_skip_unavailable_and_baseline(self):
        t = 1000.0
        states = [(t, "off"), (t + 10, "unavailable"), (t + 20, "off"), (t + 30, "on"), (t + 40, "unknown"), (t + 700, "off"), (t + 5000, "on")]
        rows = car_log.history_rows("lock", "binary_sensor.x", states, before=t + 4000)
        self.assertEqual([r["kind"] for r in rows], ["unlocked", "locked"])
        self.assertEqual(rows[1]["detail"], {"minutes": 11})
        door = car_log.history_rows("door_fl", "binary_sensor.d", [(t, "off"), (t + 5, "on"), (t + 9, "off")], before=t + 100)
        self.assertEqual([r["title"] for r in door], ["Front left door opened", "Front left door closed"])
        live = car_log.describe("door_fl", True)
        self.assertEqual(door[0]["title"], live[2])

    def test_backfill_runs_once_and_keeps_order(self):
        hass, runtime, log = build()
        now = time.time()
        log.since = now
        log.add("security", "trunk_open", "Trunk opened", "info", "mdi:car-back", now=now + 5)

        async def fake(ids, start, end):
            self.assertLessEqual(end - start, car_log.HISTORY_DAYS * 86400 + 5)
            lock = log.entities["lock"]
            return {lock: [(now - 5000, "off"), (now - 4000, "on"), (now - 3000, "off")]}
        log._read_history = fake
        asyncio.run(log.backfill())
        kinds = [r["kind"] for r in log.rows]
        self.assertEqual(kinds, ["unlocked", "locked", "trunk_open"])
        self.assertTrue(log.backfilled)
        self.assertTrue(FakeStore.saved[next(iter(FakeStore.saved))]["backfilled"])
        asyncio.run(log.backfill())
        self.assertEqual(len(log.rows), 3)

    def test_backfill_failure_is_retried_and_missing_recorder_is_not(self):
        hass, runtime, log = build()

        async def broken(ids, start, end):
            raise RuntimeError("busy")
        log._read_history = broken
        asyncio.run(log.backfill())
        self.assertFalse(log.backfilled)

        async def missing(ids, start, end):
            raise ImportError("no recorder")
        log._read_history = missing
        asyncio.run(log.backfill())
        self.assertTrue(log.backfilled)

    def test_pages_never_split_groups_and_continue_by_time(self):
        rows = [{"id": str(i), "time": 1000 - i, "cat": "others"} for i in range(10)]
        rows[3]["session"] = rows[8]["session"] = "s"
        page, more = car_log.page_of(rows, 4)
        self.assertEqual([r["id"] for r in page], ["0", "1", "2", "3", "8"])
        self.assertTrue(more)
        page2, more2 = car_log.page_of(rows, 4, before=page[-1]["time"])
        self.assertEqual([r["id"] for r in page2], ["9"])
        self.assertFalse(more2)
        tied = [{"id": "a", "time": 5, "cat": "x"}, {"id": "b", "time": 5, "cat": "x"}, {"id": "c", "time": 4, "cat": "x"}]
        self.assertEqual(len(car_log.page_of(tied, 1)[0]), 2)

    def test_view_filters_pages_counts_and_summarises(self):
        hass, runtime, log = build()
        runtime.car_log = log
        runtime.preconditioning = SimpleNamespace(history=[])
        now = time.time()
        for i in range(30):
            log.add("security" if i % 2 else "others", "x", "Row %d" % i, now=now - 20 * 86400 + i)
        log.add("security", "unlocked", "Doors unlocked", now=now - 100)
        a = {"id": "a", "s": (now - 3 * 86400) * 1000, "e": (now - 3 * 86400 + 3600) * 1000, "from": 30, "to": 70, "kwh": 7.4, "live": False}
        log.since = now - 86400

        async def db(op, *args):
            return [a]
        runtime.hub = SimpleNamespace(db=db)
        data = asyncio.run(car_log.view(runtime, {"limit": 5}))
        self.assertEqual(len(data["rows"]), 5)
        self.assertTrue(data["more"])
        self.assertEqual(data["summary"]["charging"], {"count": 1, "kwh": 7.4})
        self.assertEqual(data["summary"]["security"]["since"], int(now - 100))
        nxt = asyncio.run(car_log.view(runtime, {"limit": 5, "before": data["rows"][-1]["time"]}))
        self.assertTrue(all(r["time"] < data["rows"][-1]["time"] for r in nxt["rows"]))
        week = asyncio.run(car_log.view(runtime, {"range": "7", "cat": "security", "limit": 999999}))
        self.assertEqual([r["kind"] for r in week["rows"]], ["unlocked"])
        self.assertFalse(week["more"])
        junk = asyncio.run(car_log.view(runtime, {"limit": "abc", "cat": "nope", "range": "x", "before": "soon"}))
        self.assertTrue(junk["ready"])
        self.assertLessEqual(len(junk["rows"]), car_log.VIEW_LIMIT)

    def test_security_bursts_are_grouped_without_changing_the_log(self):
        now = 10000.0
        def row(i, t, kind, cat="security"):
            return {"id": str(i), "time": t, "cat": cat, "kind": kind, "title": kind}
        rows = [row(1, now, "door_open"), row(2, now + 20, "door_closed"), row(3, now + 30, "window_closed"), row(4, now + 40, "locked"),
                row(5, now + 500, "door_open"), row(6, now + 900, "trunk_open"), row(7, now + 910, "trunk_closed"), row(8, now + 20, "problem", "others")]
        out = car_log.group_security(rows)
        self.assertEqual([r.get("session") for r in out[:4]], ["sg-1"] * 4)
        self.assertIsNone(out[4].get("session"))
        self.assertEqual({out[5].get("session"), out[6].get("session")}, {"sg-6"})
        self.assertIsNone(out[7].get("session"))
        self.assertNotIn("session", rows[0])

    def test_energy_is_attached_to_the_charge_end(self):
        end = {"id": "e", "time": 5000.0, "cat": "charging", "kind": "charging_end", "detail": {"level": 80}}
        out = car_log.attach_energy([end], [{"e": 5100 * 1000, "kwh": 18.43}])
        self.assertEqual(out[0]["detail"], {"level": 80, "kwh": 18.4})
        self.assertNotIn("kwh", end["detail"])
        self.assertNotIn("kwh", car_log.attach_energy([end], [{"e": 9000 * 1000, "kwh": 5}])[0]["detail"])

    def test_status_reads_the_live_states(self):
        hass, runtime, log = build()
        hass.data["binary_sensor.s05_front_left_door"] = state("on")
        data = asyncio.run(car_log.view(runtime)) if hasattr(runtime, "car_log") else None
        status = car_log.status_of(log, runtime)
        self.assertTrue(status["locked"] is True)
        self.assertEqual((status["doors_total"], status["doors_open"]), (1, 1))
        self.assertEqual(status["battery"], 70.0)
        self.assertEqual(status["windows_total"], 0)
        self.assertFalse(status["charging"])


if __name__ == "__main__":
    unittest.main()
