"""Live climate and live left-open/unlocked notifications: payloads, timing, buttons, cleanup. Everything is mocked."""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

import sys
import types
for _name in ("homeassistant", "homeassistant.util"):
    sys.modules.setdefault(_name, types.ModuleType(_name))
_dt = sys.modules.setdefault("homeassistant.util.dt", types.ModuleType("homeassistant.util.dt"))
_dt.as_local = getattr(_dt, "as_local", lambda value: value)
sys.modules["homeassistant.util"].dt = _dt

package = ModuleType("dcpkg")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
sys.modules["dcpkg"] = package
status = importlib.import_module("dcpkg.live_status")


def ensure_local_time():
    """Another test module may have replaced the Home Assistant time stub; keep as_local available."""
    util = sys.modules.setdefault("homeassistant.util", types.ModuleType("homeassistant.util"))
    stub = getattr(util, "dt", None) or sys.modules.setdefault("homeassistant.util.dt", types.ModuleType("homeassistant.util.dt"))
    if not hasattr(stub, "as_local"):
        stub.as_local = lambda value: value
    util.dt = sys.modules["homeassistant.util.dt"] = stub


class Base(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        ensure_local_time()
        self.now = 100000
        self.calls, self.history, self.store, self.states, self.services = [], [], {}, {}, []
        async def db(method, vehicle, key, value=None):
            if method == "get":
                return deepcopy(self.store.get(key, value))
            self.store[key] = deepcopy(value)
        async def send(device, payload):
            self.assertLessEqual(len(payload["data"].get("tag", "").encode()), 64)
            self.calls.append((device, payload))
            return device
        async def record(rule, state, **details):
            self.history.append((rule["id"], state, details))
        async def persist():
            pass
        async def call(domain, service, data, blocking=False):
            self.services.append((domain, service, data["entity_id"]))
        hass = SimpleNamespace(states=SimpleNamespace(get=lambda entity: self.states.get(entity)),
                               config=SimpleNamespace(units=SimpleNamespace(temperature_unit="°C")),
                               services=SimpleNamespace(async_call=call))
        self.config = {"enabled": True, "rules": [],
                       "live_climate": {**status.KINDS["climate"]["default"], "enabled": True, "devices": ["notify.phone"]},
                       "live_open": {**status.KINDS["open"]["default"], "enabled": True, "devices": ["notify.phone"], "start_delay": 60, "only_parked": False}}
        self.owner = SimpleNamespace(config=self.config, lock=asyncio.Lock(), db=db, send_to_recipient=send, record=record, persist=persist, hass=hass,
                                     runtime=SimpleNamespace(vehicle="vin", config={"prefix": "s05", "name": "Car", "entities": {}}))
        self.live = status.LiveStatus(self.owner)
        for patcher in (patch.object(status, "supported", return_value=True), patch.object(status.time, "time", side_effect=lambda: self.now)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def state(self, entity, value, age=0, **attributes):
        self.states[entity] = SimpleNamespace(state=str(value), last_reported=datetime.fromtimestamp(self.now - age, timezone.utc), attributes=attributes)

    def climate(self, on=True, current=18.5, target=22):
        self.state("climate.s05_cabin_climate", "auto" if on else "off", current_temperature=current, temperature=target)
        self.state("sensor.s05_inside_temperature", current)
        self.state("binary_sensor.s05_climate_on", "on" if on else "off")

    def doors(self, items=(), unlocked=False):
        for key, (entity, _) in status.OPEN_ITEMS.items():
            self.state(entity.replace(".", ".s05_", 1), "on" if key in items else "off")
        self.state("lock.s05_doors", "unlocked" if unlocked else "locked")


class Validation(unittest.TestCase):
    def test_defaults_and_limits(self):
        for kind, spec in status.KINDS.items():
            self.assertEqual(status.validate_status(kind, spec["default"]), spec["default"])
            with self.assertRaises(ValueError):
                status.validate_status(kind, {**spec["default"], "enabled": True})
            with self.assertRaises(ValueError):
                status.validate_status(kind, {**spec["default"], "unknown": 1})
            with self.assertRaises(ValueError):
                status.validate_status(kind, {**spec["default"], "color": "red"})
            with self.assertRaises(ValueError):
                status.validate_status(kind, {**spec["default"], "icon": "not an icon"})
            with self.assertRaises(ValueError):
                status.validate_status(kind, {**spec["default"], "icon": "hass:flash"})
            self.assertEqual(status.validate_status(kind, {**spec["default"], "icon": "mdi:flash"})["icon"], "mdi:flash")
        with self.assertRaises(ValueError):
            status.validate_status("open", {**status.KINDS["open"]["default"], "items": ["sunroof"]})
        with self.assertRaises(ValueError):
            status.validate_status("climate", {**status.KINDS["climate"]["default"], "min_interval": 5})
        with self.assertRaises(ValueError):
            status.validate_status("open", {**status.KINDS["open"]["default"], "enabled": True, "devices": ["notify.a"], "items": [], "include_unlocked": False})

    def test_explicit_false_zero_and_empty_survive(self):
        value = status.validate_status("climate", {**status.KINDS["climate"]["default"], "show_target": False, "max_run": 0, "title": ""})
        self.assertIs(value["show_target"], False)
        self.assertEqual(value["max_run"], 0)
        self.assertEqual(status.validate_all({}), {})


class Climate(Base):
    async def test_starts_updates_and_clears(self):
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)
        payload = self.calls[0][1]
        self.assertEqual(payload["title"], "Inside 18.5° → 22°")
        self.assertEqual(payload["message"], "Climate")
        self.assertTrue(payload["data"]["live_update"])
        self.assertEqual(payload["data"]["actions"][0]["title"], "Turn off")
        self.assertTrue(payload["data"]["chronometer"])
        self.assertEqual(payload["data"]["text_color"], payload["data"]["color"])
        tag = payload["data"]["tag"]
        self.now += 15
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "unchanged readings do not push")
        self.now += 130
        self.climate(current=21.5)
        await self.live.tick()
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[1][1]["data"]["tag"], tag)
        self.assertIn("Ready", self.calls[1][1]["message"])
        self.assertEqual(self.calls[1][1]["data"]["progress"], 100)
        self.now += 10
        self.climate(on=False)
        await self.live.tick()
        self.assertEqual(len(self.calls), 2, "grace period before removing")
        self.now += 40
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")
        self.assertEqual(self.calls[-1][1]["data"]["tag"], tag)
        self.assertNotIn("climate", self.live.state)

    async def test_tap_destination_is_sent_and_validated(self):
        self.config["live_climate"].update(url="/lovelace/car", start_delay=0)
        self.climate()
        await self.live.tick()
        data = self.calls[0][1]["data"]
        self.assertEqual((data["url"], data["clickAction"]), ("/lovelace/car", "/lovelace/car"))
        for bad in ("http://evil.example", "lovelace", "/a b"):
            with self.assertRaises(ValueError):
                status.validate_status("climate", {**status.KINDS["climate"]["default"], "url": bad})

    async def test_options_change_content(self):
        self.config["live_climate"].update(show_target=False, show_outside=True, show_timer=False, turn_off_button=False, show_progress=False, title="Cabin", start_delay=0, show_updated=True)
        self.climate()
        self.state("sensor.s05_outside_temperature", 9)
        await self.live.tick()
        payload = self.calls[0][1]
        self.assertEqual(payload["title"], "Inside 18.5°")
        self.assertEqual(payload["message"], "Outside 9° · Reported 03:46")
        self.assertNotIn("actions", payload["data"])
        self.assertNotIn("progress", payload["data"])
        self.assertFalse(payload["data"]["chronometer"])

    async def test_start_delay_and_max_run(self):
        self.config["live_climate"].update(start_delay=60, max_run=1)
        self.climate()
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.now += 61
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)
        self.now += 60
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification", "removed after the maximum run time")
        self.now += 15
        await self.live.tick()
        self.assertEqual(len(self.calls), 2, "does not restart while the climate stays on")

    async def test_disabled_offline_and_stale_send_nothing(self):
        self.config["live_climate"]["enabled"] = False
        self.climate()
        await self.live.tick()
        self.config["live_climate"]["enabled"] = True
        self.state("binary_sensor.s05_cloud_connection", "off")
        await self.live.tick()
        self.assertEqual(self.calls, [])

    async def test_turn_off_button_only_while_active(self):
        self.climate()
        await self.live.action("DEEPAL_COMPANION_LIVE_CLIMATE_OFF")
        self.assertEqual(self.services, [])
        await self.live.tick()
        await self.live.action("DEEPAL_COMPANION_LIVE_CLIMATE_OFF")
        self.assertEqual(self.services, [("climate", "set_hvac_mode", "climate.s05_cabin_climate")])
        self.assertEqual(self.history[-1][1], "turned_off")
        await self.live.action("DEEPAL_COMPANION_LIVE_OTHER")
        self.assertEqual(len(self.services), 1)

    async def test_lost_connection_clears_after_max_age(self):
        self.climate()
        await self.live.tick()
        self.states.pop("climate.s05_cabin_climate")
        self.states.pop("binary_sensor.s05_climate_on")
        self.now += 100
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)
        self.now += 1800
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")

    async def test_reading_that_stopped_updating_ends_the_notification(self):
        self.climate()
        await self.live.tick()
        self.now += 2000
        await self.live.tick()
        self.now += 31
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")

    def odometer_changed(self, changed_ago, reported_ago=10):
        self.state("sensor.s05_total_odometer", 1000, age=reported_ago)
        self.states["sensor.s05_total_odometer"].last_changed = datetime.fromtimestamp(self.now - changed_ago, timezone.utc)

    async def test_driving_blocks_the_start(self):
        self.config["live_climate"].update(start_delay=0)
        self.odometer_changed(changed_ago=60)  # the odometer changed a minute ago: driving
        self.climate()
        await self.live.tick()
        self.assertEqual(self.calls, [], "climate on while driving does not start the notification")

    async def test_moving_after_start_ends_it_the_normal_way(self):
        self.config["live_climate"].update(start_delay=0, end_delay=30)
        self.odometer_changed(changed_ago=5000)
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "parked with the climate on: shown")
        tag = self.calls[0][1]["data"]["tag"]
        self.now += 60
        self.odometer_changed(changed_ago=60)
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "moving: the grace period of the normal end runs first")
        self.now += 31
        self.climate()
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")
        self.assertEqual(self.calls[-1][1]["data"]["tag"], tag)
        self.assertEqual(self.history[-1][:2], ("live_climate", "live_ended"))
        self.assertEqual(self.history[-1][2]["trigger"]["reason"], "Vehicle moving")
        self.assertNotIn("climate", self.live.state)

    async def test_parked_with_the_climate_on_shows_even_without_fresh_odometer(self):
        self.config["live_climate"].update(start_delay=0)
        self.odometer_changed(changed_ago=5000, reported_ago=3600)  # a parked car reports its odometer rarely
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "remote preconditioning with the car parked still shows")

    async def test_explicit_off_still_shows_while_driving(self):
        self.config["live_climate"].update(start_delay=0, only_parked=False)
        self.odometer_changed(changed_ago=60)
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "a saved OFF keeps the old behaviour")

    async def test_saved_settings_without_the_key_default_to_parked_only(self):
        saved = {key: value for key, value in status.KINDS["climate"]["default"].items() if key not in ("only_parked", "parked_after")}
        self.config["live_climate"] = {**saved, "enabled": True, "devices": ["notify.phone"], "start_delay": 0}
        self.odometer_changed(changed_ago=60)
        self.climate()
        await self.live.tick()
        self.assertEqual(self.calls, [], "missing key: parked-only")
        self.assertIs(status.validate_status("climate", saved)["only_parked"], True)
        self.assertEqual(status.validate_status("climate", saved)["parked_after"], 360)
        self.assertIs(status.validate_status("climate", {**saved, "only_parked": False})["only_parked"], False)
        for bad in (59, 3601, True, "360"):
            with self.assertRaises(ValueError, msg=repr(bad)):
                status.validate_status("climate", {**saved, "parked_after": bad})

    async def test_parked_again_restarts_the_wait_before_showing(self):
        self.config["live_climate"].update(start_delay=60, end_delay=30)
        self.odometer_changed(changed_ago=5000)
        self.climate()
        await self.live.tick()  # parked and on: the 60 s wait starts
        self.now += 30
        self.odometer_changed(changed_ago=30)
        self.climate()
        await self.live.tick()  # driving: the pending wait restarts
        self.now += 10
        self.odometer_changed(changed_ago=5000)
        self.climate()
        await self.live.tick()  # parked again while the climate is still on: a full wait
        self.assertEqual(self.calls, [], "not shown at once from the old wait")
        self.now += 59
        self.climate()
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.now += 2
        self.climate()
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "shown after the normal delay")


class ParkedAfter(Base):
    def odometer(self, reported_ago, changed_ago):
        self.state("sensor.s05_total_odometer", 1000, age=reported_ago)
        self.states["sensor.s05_total_odometer"].last_changed = datetime.fromtimestamp(self.now - changed_ago, timezone.utc)

    async def test_same_value_reported_again_is_not_movement(self):
        # The car reports every 5 minutes. A report that repeats the same odometer value must not look like driving.
        self.odometer(reported_ago=10, changed_ago=1500)
        self.assertFalse(self.live.running({"parked_after": 360}))
        self.odometer(reported_ago=10, changed_ago=200)
        self.assertTrue(self.live.running({"parked_after": 360}))

    async def test_the_window_is_the_users_setting(self):
        self.odometer(reported_ago=10, changed_ago=400)
        self.assertFalse(self.live.running({"parked_after": 360}))
        self.assertTrue(self.live.running({"parked_after": 600}))

    async def test_setting_is_validated_and_defaults_for_saved_notifications(self):
        saved = {key: value for key, value in status.KINDS["open"]["default"].items() if key != "parked_after"}
        self.assertEqual(status.validate_status("open", saved)["parked_after"], 360)
        for bad in (59, 3601, True, "360", 360.5):
            with self.assertRaises(ValueError, msg=repr(bad)):
                status.validate_status("open", {**saved, "parked_after": bad})

    async def test_the_end_reason_names_what_really_happened(self):
        open_options = {**status.KINDS["open"]["default"], "only_parked": True}
        self.assertEqual(self.live.end_reason("climate", status.KINDS["climate"]["default"]), "Climate turned off")
        self.odometer(reported_ago=10, changed_ago=60)
        self.assertEqual(self.live.end_reason("open", open_options), "Vehicle moving")
        self.odometer(reported_ago=10, changed_ago=1500)
        self.assertEqual(self.live.end_reason("open", open_options), "Everything closed and locked")

    async def test_parked_after_covers_the_five_minute_report_interval(self):
        self.config["live_open"].update(start_delay=0, end_delay=0, include_unlocked=False, only_parked=True)
        self.doors(("trunk",))
        self.odometer(reported_ago=10, changed_ago=700)
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "Parked for a long time: the alert shows although the odometer was just reported")


class OpenOrUnlocked(Base):
    async def test_missing_or_stale_second_lock_sensor_does_not_hide_an_unlocked_car(self):
        options = {**status.KINDS["open"]["default"], "include_unlocked": True, "only_parked": False, "items": []}
        self.doors((), unlocked=True)
        for value, age in (("off", 99999), ("unavailable", 0), ("unknown", 0)):
            self.state("binary_sensor.s05_doors_lock_state", value, age=age)
            self.assertTrue(self.live.open_snapshot(self.now, options)["unlocked"], value)
        self.state("binary_sensor.s05_doors_lock_state", "off")  # fresh and locked: the second sensor decides
        self.assertFalse(self.live.open_snapshot(self.now, options)["unlocked"])

    async def test_stale_odometer_does_not_keep_the_alert_after_locking(self):
        # A parked car does not report its odometer: locking must still clear the notification.
        self.config["live_open"].update(start_delay=0, end_delay=10, include_unlocked=True, only_parked=True)
        def odometer(reported_ago, changed_ago):
            self.state("sensor.s05_total_odometer", 1000, age=reported_ago)
            self.states["sensor.s05_total_odometer"].last_changed = datetime.fromtimestamp(self.now - changed_ago, timezone.utc)
        odometer(10, 5000)
        self.doors((), unlocked=True)
        await self.live.tick()
        self.assertEqual(len(self.calls), 1, "unlocked and parked: the alert shows")
        self.now += 7200
        odometer(7200, 12000)  # no fresh odometer report for two hours
        self.doors((), unlocked=True)
        self.assertIsNone(self.live.open_snapshot(self.now, {**status.KINDS["open"]["default"], "only_parked": True}), "stale odometer never starts an alert")
        self.doors((), unlocked=False)
        await self.live.tick()
        self.now += 11
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")

    async def test_ios_end_is_sent_with_the_live_activity_command_and_repeated(self):
        self.live.owner.recipient_os = lambda device: "ios"
        self.config["live_open"].update(start_delay=0, end_delay=0, include_unlocked=True, only_parked=False)
        self.doors((), unlocked=True)
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)
        self.now += 31
        self.doors((), unlocked=False)
        await self.live.tick()
        messages = [call[1]["message"] for call in self.calls[1:]]
        self.assertEqual(messages, ["clear_notification", "end_live_activity"])
        end = self.calls[2][1]
        self.assertEqual(end, {"message": "end_live_activity", "data": {"tag": self.live.tag("open"), "live_activity": True}},
                         "iOS needs the live_activity flag, or the text end_live_activity shows as a visible alert")
        self.assertNotIn("title", end)
        self.now += 31
        await self.live.tick()
        self.assertEqual([call[1]["message"] for call in self.calls[3:]], ["clear_notification"], "only the silent clear is repeated after 30 s")
        self.now += 31
        await self.live.tick()
        self.assertEqual(len(self.calls), 5, "and once more after 60 s")
        self.now += 31
        await self.live.tick()
        self.assertEqual(len(self.calls), 5, "then it stops")

    async def test_a_new_notification_is_not_cleared_by_the_repeats(self):
        self.live.owner.recipient_os = lambda device: "ios"
        self.config["live_open"].update(start_delay=0, end_delay=0, include_unlocked=True, only_parked=False)
        self.doors((), unlocked=True)
        await self.live.tick()
        self.now += 31
        self.doors((), unlocked=False)
        await self.live.tick()
        sent = len(self.calls)
        self.now += 31
        self.doors((), unlocked=True)  # unlocked again before the repeat is due
        await self.live.tick()
        self.assertNotIn("clear_notification", [call[1]["message"] for call in self.calls[sent:]])

    async def test_list_updates_and_clears_when_secure(self):
        self.doors(("front_left_door", "trunk"), unlocked=True)
        await self.live.tick()
        self.assertEqual(self.calls, [], "short grace period")
        self.now += 61
        self.doors(("front_left_door", "trunk"), unlocked=True)
        await self.live.tick()
        payload = self.calls[0][1]
        self.assertEqual(payload["title"], "Front left door, Trunk")
        self.assertEqual(payload["message"], "Unlocked")
        self.assertEqual(payload["data"]["critical_text"], "3")
        self.assertEqual(payload["data"]["actions"][0]["title"], "Lock vehicle")
        self.now += 40
        self.doors(("trunk",), unlocked=True)
        await self.live.tick()
        self.assertEqual(self.calls[1][1]["title"], "Trunk")
        self.now += 40
        self.doors((), unlocked=False)
        await self.live.tick()
        self.assertEqual(len(self.calls), 2)
        self.now += 11
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")

    async def test_nothing_while_the_car_is_running(self):
        self.config["live_open"].update(start_delay=60, end_delay=0, include_unlocked=False, only_parked=True)
        self.doors(("front_left_window",))
        self.state("binary_sensor.s05_engine", "on")
        self.state("sensor.s05_power_status", "on")
        await self.live.tick()
        self.assertEqual(self.calls, [], "an open window while driving is not reported")
        self.state("binary_sensor.s05_engine", "off")
        await self.live.tick()
        self.assertEqual(self.calls, [], "power still on")
        self.state("sensor.s05_power_status", "off")
        await self.live.tick()
        self.assertEqual(self.calls, [], "parked: the full configured wait starts now")
        self.now += 60
        self.doors(("front_left_window",))
        self.state("sensor.s05_power_status", "off")
        await self.live.tick()
        self.assertEqual(self.calls[0][1]["title"], "Front left window")
        self.now += 60
        self.state("sensor.s05_power_status", "on")
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification", "driving off ends it")
        self.config["live_open"]["only_parked"] = False
        self.config["live_open"]["start_delay"] = 0
        self.now += 60
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["title"], "Front left window", "the switch restores the old behaviour")

    def test_wait_is_exact_user_delay(self):
        wait = status.LiveStatus.wait
        self.assertEqual(wait("open", {"only_parked": True, "start_delay": 60}), 60)
        self.assertEqual(wait("open", {"only_parked": True, "start_delay": 300}), 300)
        self.assertEqual(wait("open", {"only_parked": True, "start_delay": 600}), 600)
        self.assertEqual(wait("open", {"only_parked": False, "start_delay": 60}), 60)
        self.assertEqual(wait("climate", {"only_parked": True, "start_delay": 0}), 0)
        self.assertEqual(status.KINDS["open"]["default"]["start_delay"], 300)

    async def test_odometer_tells_driving_from_a_car_left_on(self):
        self.config["live_open"].update(start_delay=0, end_delay=0, include_unlocked=False, only_parked=True)
        self.doors(("trunk",))
        self.state("sensor.s05_power_status", "on")
        self.state("sensor.s05_total_odometer", 1000, age=30)
        self.assertTrue(self.live.running(), "odometer changed 30 s ago: driving")
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.state("sensor.s05_total_odometer", 1000, age=400)
        self.assertFalse(self.live.running(), "power is on but the odometer is still: parked")

    async def test_full_delay_restarts_after_brief_closed_and_stale(self):
        self.config["live_open"].update(start_delay=300, end_delay=60)
        self.doors(("trunk",))
        await self.live.tick()
        self.now += 299
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.doors(())
        await self.live.tick()
        self.now += 1
        self.doors(("trunk",))
        await self.live.tick()
        self.now += 299
        await self.live.tick()
        self.assertEqual(self.calls, [])
        for sensor in self.states.values():
            sensor.last_reported = datetime.fromtimestamp(self.now - 4000, timezone.utc)
        await self.live.tick()
        self.now += 1
        self.doors(("trunk",))
        await self.live.tick()
        self.now += 299
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.now += 1
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.history[0][2]["trigger"]["effective_wait_seconds"], 300)

    async def test_unknown_connection_restarts_pending_delay(self):
        self.config["live_open"].update(start_delay=300)
        self.doors(("trunk",))
        await self.live.tick()
        self.now += 299
        self.state("binary_sensor.s05_cloud_connection", "off")
        await self.live.tick()
        self.now += 1
        self.state("binary_sensor.s05_cloud_connection", "on")
        await self.live.tick()
        self.now += 299
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.now += 1
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)

    async def test_restart_does_not_count_downtime_as_pending_wait(self):
        self.store["live_status_state"] = {"open": {"since": self.now - 300}}
        await self.live.start()
        self.assertNotIn("since", self.live.state["open"])

    async def test_movement_restarts_full_delay(self):
        self.config["live_open"].update(start_delay=300, only_parked=True)
        self.doors(("trunk",))
        self.state("sensor.s05_total_odometer", 1000, age=400)
        await self.live.tick()
        self.now += 299
        self.state("sensor.s05_total_odometer", 1001)
        await self.live.tick()
        self.now += 360  # the odometer must stay unchanged for "Parked after" (default 6 minutes) first
        await self.live.tick()
        self.now += 299
        await self.live.tick()
        self.assertEqual(self.calls, [])
        self.now += 1
        await self.live.tick()
        self.assertEqual(len(self.calls), 1)

    async def test_recent_activity_gets_one_start_and_one_end(self):
        self.config["live_open"].update(start_delay=0, end_delay=0)
        self.doors(("trunk", "hood"))
        await self.live.tick()
        self.now += 40
        self.doors(("trunk",))
        await self.live.tick()
        self.assertEqual([(row[0], row[1]) for row in self.history], [("live_open", "live_started")], "updates add no entries")
        self.now += 40
        self.doors(())
        await self.live.tick()
        self.assertEqual([row[1] for row in self.history], ["live_started", "live_ended"])

    async def test_every_coloured_part_uses_the_state_colour(self):
        self.config["live_open"].update(start_delay=0, show_timer=False)
        self.doors(("trunk",))
        await self.live.tick()
        data = self.calls[0][1]["data"]
        self.assertEqual({data[key] for key in ("color", "notification_icon_color", "progress_bar_color", "text_color")}, {data["color"]})

    async def test_open_or_unlocked_is_red_even_without_a_saved_palette(self):
        self.config["live_open"].update(start_delay=0, show_timer=False)
        self.doors(("trunk",), unlocked=True)
        await self.live.tick()
        self.assertEqual(self.calls[0][1]["data"]["color"], "#f87171")
        self.live.runtime.config["lvl_red"] = "#ff0000"  # a saved palette colour wins
        self.assertEqual(self.live.color("open", {"color": ""}, {"unlocked": True, "items": []}), "#ff0000")
        self.assertEqual(self.live.color("open", {"color": "#112233"}, {"unlocked": True, "items": []}), "#112233", "a colour chosen for the notification wins")

    async def test_notification_colours_follow_the_chosen_card_level_colours(self):
        config, defaults = self.live.runtime.config, importlib.import_module("dcpkg.live_charging").card_defaults()
        alert = self.live.color("open", {"color": ""}, {"unlocked": True, "items": []})
        self.assertEqual(alert, defaults["lvl_red"], "nothing saved: the default alert level colour from defaults.json")
        self.assertEqual(self.live.color("open", {"color": ""}, {"unlocked": False, "items": []}), defaults["lvl_green"])
        config.update(notify_alert_level="orange", lvl_orange="#aa5500", notify_ok_level="yellow")
        self.assertEqual(self.live.color("open", {"color": ""}, {"unlocked": False, "items": ["Trunk"]}), "#aa5500", "the chosen level, in the saved palette colour")
        self.assertEqual(self.live.color("open", {"color": ""}, {"unlocked": False, "items": []}), defaults["lvl_yellow"], "chosen level, palette colour not saved: default")
        config["notify_climate_level"] = "not a level"
        self.assertEqual(self.live.color("climate", {"color": ""}, {}), defaults["lvl_green"], "an invalid choice falls back to the default choice")

    async def test_watch_list_and_limits(self):
        self.config["live_open"].update(start_delay=0, items=["trunk", "hood"], include_unlocked=False, max_shown=1, lock_button=False)
        self.doors(("trunk", "hood", "front_left_door"), unlocked=True)
        await self.live.tick()
        payload = self.calls[0][1]
        self.assertIn("+1 more", payload["title"])
        self.assertNotIn("Front left door", payload["title"])
        self.assertNotIn("Unlocked", payload["message"])
        self.assertNotIn("actions", payload["data"])

    async def test_window_with_zero_opening_is_closed(self):
        self.config["live_open"].update(start_delay=0, include_unlocked=False)
        self.doors(("front_left_window",))
        self.state("sensor.s05_front_left_window_opening", 0)
        await self.live.tick()
        self.assertEqual(self.calls, [])

    async def test_lock_button_only_while_active(self):
        self.config["live_open"]["start_delay"] = 0
        self.doors(unlocked=True)
        await self.live.action("DEEPAL_COMPANION_LIVE_OPEN_LOCK")
        self.assertEqual(self.services, [])
        await self.live.tick()
        await self.live.action("DEEPAL_COMPANION_LIVE_OPEN_LOCK")
        self.assertEqual(self.services, [("lock", "lock", "lock.s05_doors")])

    async def test_live_test_sends_sample_and_stops_without_touching_real_state(self):
        value = {**status.KINDS["open"]["default"], "devices": ["notify.phone"]}
        result = await self.live.test("open", value)
        self.assertEqual(result["deliveries"][0]["status"], "accepted")
        self.assertIn("Test", self.calls[0][1]["message"])
        self.assertNotIn("Deepal", self.calls[0][1]["title"])
        self.assertNotIn("actions", self.calls[0][1]["data"])
        self.assertEqual(self.services, [])
        tag = self.calls[0][1]["data"]["tag"]
        self.assertTrue(tag.startswith("dc_test_open_"))
        stopped = await self.live.test("open", value, stop=True)
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")
        self.assertEqual(self.calls[-1][1]["data"]["tag"], tag)
        self.assertTrue(stopped["ended"])
        with self.assertRaises(ValueError):
            await self.live.test("nope", value)


if __name__ == "__main__":
    unittest.main()
