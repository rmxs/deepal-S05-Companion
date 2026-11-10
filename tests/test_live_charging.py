"""Live charging delivery, restart persistence and real-source timing contracts."""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("live_charging_test", Path(__file__).resolve().parents[1] / "custom_components/deepal_companion/live_charging.py")
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)


class LiveCharging(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = 100000
        self.calls, self.history, self.store, self.states = [], [], {}, {}
        self.fail = False
        async def db(method, vehicle, key, value=None):
            if method == "get":
                return deepcopy(self.store.get(key, value))
            self.store[key] = deepcopy(value)
        async def send(device, payload):
            if self.fail:
                raise ValueError("Phone unavailable")
            self.assertLessEqual(len(payload["data"]["tag"].encode()), 64)
            self.calls.append((device, payload))
            return device
        async def record(rule, status, **details):
            self.history.append((rule, status, details))
        async def persist():
            self.store['saved_activity'] = deepcopy(self.history)
        config = {"enabled": True, "rules": [], "live_charging": {**live.DEFAULT, "min_interval": 120, "enabled": True, "devices": ["notify.current_phone"]}}
        self.owner = SimpleNamespace(config=config, lock=asyncio.Lock(), db=db, send_to_recipient=send, record=record, persist=persist,
                                     runtime=SimpleNamespace(vehicle="a" * 80, entities={"batt": "battery", "ac": "ac", "dc": "dc", "charging": "charging", "plug": "plug"}, config={"prefix": "s05", "name": "My car", "lvl_green": "#11aa22"}), hass=SimpleNamespace(states=self.states))
        self.activity = live.LiveCharging(self.owner)
        self.support = patch.object(live, "supported", return_value=True)
        self.supported = self.support.start()
        self.clock = patch.object(live.time, "time", side_effect=lambda: self.now)
        self.clock.start()
        self.addCleanup(self.support.stop)
        self.addCleanup(self.clock.stop)
        self.readings()

    def state(self, name, value, age=0, **attributes):
        self.states[name] = SimpleNamespace(state=str(value), last_reported=datetime.fromtimestamp(self.now-age, timezone.utc), attributes=attributes)

    def readings(self, battery=60, charging=True):
        self.state("battery", battery)
        self.state("ac", 16 if charging else 0)
        self.state("dc", 0)
        self.state("charging", "on" if charging else "off")
        self.state("plug", "on")

    async def test_start_real_payload_and_no_unchanged_tick_pushes(self):
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1)
        data = self.calls[0][1]["data"]
        self.assertTrue(data["live_update"])
        self.assertEqual(data["progress"], 60)
        self.assertEqual(data["color"], "#11aa22")
        self.assertIn("16 A", self.calls[0][1]["message"])
        self.assertIn("Reported", self.calls[0][1]["message"])
        self.assertFalse(data["chronometer"])
        self.assertEqual(data["notification_icon"], "mdi:ev-station")
        self.assertEqual(live.validate_live({"icon": "mdi:flash"})["icon"], "mdi:flash")
        self.assertEqual(self.activity.payload(self.activity.snapshot(self.now, self.activity.options()), {**self.activity.options(), "icon": "mdi:flash"}, "t")["data"]["notification_icon"], "mdi:flash")
        self.now += 600
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1, "No push when sensor readings have not been reported again")

    async def test_throttle_and_battery_step_updates_reuse_tag(self):
        await self.activity.tick()
        tag = self.calls[0][1]["data"]["tag"]
        self.now += 30
        self.readings(65)
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1)
        self.now += 90
        await self.activity.tick()
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[-1][1]["data"]["tag"], tag)
        self.now += 120
        self.readings(66)
        await self.activity.tick()
        self.assertEqual(len(self.calls), 2)
        self.now += 180
        self.readings(66)
        await self.activity.tick()
        self.assertEqual(len(self.calls), 3, "Fresh readings refresh the reported time at most every five minutes")

    async def test_timer_uses_sensor_timestamp_not_test_send_time(self):
        self.state("sensor.s05_remaining_charge_time_h_mm", "01:20", age=300)
        await self.activity.tick()
        data = self.calls[0][1]["data"]
        self.assertEqual(data["when"], self.now - 300 + 4800)
        self.assertFalse(data["when_relative"])
        self.assertTrue(data["chronometer"])
        self.now += 120
        self.readings(65)
        await self.activity.tick()
        self.assertEqual(self.calls[-1][1]["data"]["when"], data["when"])

    async def test_no_invented_timer_for_expired_or_invalid_duration(self):
        for value in ("00:01", "invalid", "00:99"):
            self.state("sensor.s05_remaining_charge_time_h_mm", value, age=300)
            snap = self.activity.snapshot(self.now, self.activity.options())
            self.assertIsNone(snap["end"])

    async def test_explicit_stop_clears_after_grace_and_new_session_has_new_tag(self):
        await self.activity.tick()
        old_tag = self.calls[0][1]["data"]["tag"]
        self.now += 300
        self.readings(charging=False)
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1)
        self.now += 30
        await self.activity.tick()
        self.assertEqual(self.calls[-1][1], {"message": "clear_notification", "data": {"tag": old_tag}})
        self.assertEqual([(row[0]["id"], row[1]) for row in self.history], [("live_charging", "live_started"), ("live_charging", "live_ended")])
        self.now += 300
        self.readings()
        await self.activity.tick()
        self.assertNotEqual(self.calls[-1][1]["data"]["tag"], old_tag)

    async def test_unknown_or_stale_readings_end_activity_only_after_the_age_limit(self):
        await self.activity.tick()
        self.state("battery", "unavailable")
        self.now += 300
        await self.activity.tick()
        self.now += 1700
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.activity.state["active"], "a short outage does not end it")
        self.now += 200
        await self.activity.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification", "a car that stays unreachable does not leave it on the phone")
        self.assertEqual(self.history[-1][1], "live_ended")

    async def test_global_disable_clears_and_keeps_test_targets(self):
        await self.activity.test(self.activity.options())
        await self.activity.tick()
        self.owner.config["enabled"] = False
        self.now += 120
        await self.activity.tick()
        self.assertEqual(self.calls[-1][1]["message"], "clear_notification")
        self.assertEqual(self.activity.state["test_devices"], ["notify.current_phone"])

    async def test_removed_recipient_is_cleared(self):
        await self.activity.tick()
        self.owner.config["live_charging"]["devices"] = ["notify.replacement"]
        self.now += 120
        await self.activity.tick()
        self.assertEqual(self.calls[-2][0], "notify.current_phone")
        self.assertEqual(self.calls[-2][1]["message"], "clear_notification")
        self.assertEqual(self.calls[-1][0], "notify.replacement")

    async def test_restart_does_not_restart_same_activity(self):
        await self.activity.tick()
        restored = live.LiveCharging(self.owner)
        await restored.start()
        await restored.tick()
        self.assertEqual(len(self.calls), 1)

    async def test_tests_are_isolated_stable_and_end_all_previous_test_devices(self):
        await self.activity.tick()
        real_tag = self.calls[-1][1]["data"]["tag"]
        await self.activity.test(self.activity.options())
        test_tag = self.calls[-1][1]["data"]["tag"]
        self.assertNotEqual(real_tag, test_tag)
        await self.activity.test(self.activity.options())
        self.assertEqual(self.calls[-1][1]["data"]["tag"], test_tag)
        options = {**self.activity.options(), "devices": ["notify.new_phone"]}
        await self.activity.test(options)
        ended = await self.activity.test(options, stop=True)
        self.assertEqual(len(ended["deliveries"]), 2)
        self.assertTrue(self.activity.state["active"], "Ending a test must not end the real charging activity")
        self.assertNotIn("test_devices", self.activity.state)

    async def test_parked_test_reports_real_status_and_no_fake_countdown(self):
        self.readings(charging=False)
        await self.activity.test(self.activity.options())
        self.assertIn("Not charging", self.calls[-1][1]["title"])
        self.assertFalse(self.calls[-1][1]["data"]["chronometer"])

    async def test_delivery_failure_retries_throttled_and_is_not_accepted(self):
        self.fail = True
        await self.activity.tick()
        self.assertEqual(len(self.store['saved_activity']), 1, 'Live delivery failures must survive a restart even without a regular alert firing')
        self.assertFalse(self.activity.state["active"])
        self.assertEqual(len(self.history), 1)
        self.now += 15
        self.fail = False
        await self.activity.tick()
        self.assertFalse(self.calls)
        self.now += 105
        await self.activity.tick()
        self.assertEqual(len(self.calls), 1)

    async def test_unsupported_core_never_sends_and_test_explains_requirement(self):
        self.supported.return_value = False
        await self.activity.tick()
        self.assertFalse(self.calls)
        with self.assertRaisesRegex(ValueError, "2026.7"):
            await self.activity.test(self.activity.options())

    def test_default_interval_is_five_minutes(self):
        self.assertEqual(live.validate_live({})["min_interval"], 300)

    def test_settings_validation(self):
        for change in ({"min_interval": 0}, {"min_interval": True}, {"battery_step": 50}, {"enabled": "yes"}, {"devices": ["notify.bad-name"]}, {"extra": 1}, {"devices": []}, {"icon": "hass:flash"}, {"icon": 5}):
            with self.assertRaises(ValueError):
                live.validate_live({**self.activity.options(), **change})

    async def test_restored_battery_is_not_fresh_evidence(self):
        self.state("battery", 70, restored=True)
        await self.activity.tick()
        self.assertFalse(self.calls)
