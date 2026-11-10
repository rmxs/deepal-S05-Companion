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

package = ModuleType("dcpkg")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
sys.modules["dcpkg"] = package
status = importlib.import_module("dcpkg.live_status")


class Base(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
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
                       "live_open": {**status.KINDS["open"]["default"], "enabled": True, "devices": ["notify.phone"], "start_delay": 60}}
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
        self.assertEqual(payload["message"], "Outside 9° · Reported 03:46 UTC")
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
        self.assertEqual(self.services, [("climate", "turn_off", "climate.s05_cabin_climate")])
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


class OpenOrUnlocked(Base):
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
        self.config["live_open"].update(start_delay=0, end_delay=0, include_unlocked=False)
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
        self.assertEqual(self.calls[0][1]["title"], "Front left window")
        self.now += 60
        self.state("sensor.s05_power_status", "on")
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification", "driving off ends it")
        self.config["live_open"]["only_parked"] = False
        self.now += 60
        await self.live.tick()
        self.assertEqual(self.calls[-1][1]["title"], "Front left window", "the switch restores the old behaviour")

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
