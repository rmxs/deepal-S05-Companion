"""Remote climate preconditioning controller, schedules and battery protection. Vehicle and phones are mocked:
no test sends a real command or notification."""
import asyncio
from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from zoneinfo import ZoneInfo

package = ModuleType("dcpkg")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
sys.modules.setdefault("dcpkg", package)
pc = importlib.import_module("dcpkg.preconditioning")
phone_text = importlib.import_module("dcpkg.phone_text")

T0 = datetime(2026, 11, 16, 7, 0, tzinfo=timezone.utc).timestamp()


def st(value, attrs=None):
    return SimpleNamespace(state=value, attributes=attrs or {}, last_reported=None, last_updated=None)


class FakeCar:
    """Simulated vehicle: commands change the reported state after `delay` seconds with a fresh report time."""

    def __init__(self, test):
        self.t, self.on, self.report, self.soc, self.charging = test, False, T0 - 60, 60.0, False
        self.fail, self.ignore, self.delay, self.calls, self.blind = [], 0, 10, [], False

    async def call(self, domain, service, data):
        if domain == "button":  # "Refresh vehicle data": a new report arrives
            self.refreshes = getattr(self, "refreshes", 0) + 1
            self.report = self.t.now
            return
        self.calls.append((service, data))
        if self.fail:
            error = self.fail.pop(0)
            if error:
                raise error
        if self.ignore:
            self.ignore -= 1
            return
        self.pending = (self.t.now + self.delay, not (service == "set_hvac_mode" or data.get("hvac_mode") == "off"))

    def advance(self):
        pending = getattr(self, "pending", None)
        if pending and self.t.now >= pending[0]:
            self.on, self.report, self.pending = pending[1], self.t.now, None


class States:
    def __init__(self, car):
        self.car = car

    def get(self, entity):
        c = self.car
        c.advance()
        if c.blind and entity in ("binary_sensor.s05_climate_on", "climate.s05_cabin_climate"):
            return st("unknown") if entity.startswith("binary") else st("unavailable")
        return {
            "binary_sensor.s05_climate_on": st("on" if c.on else "off"),
            "climate.s05_cabin_climate": st("heat_cool" if c.on else "off", {"temperature": 22}),
            "sensor.s05_last_updated": st(datetime.fromtimestamp(c.report, timezone.utc).isoformat()),
            "sensor.s05_battery_level": st("unavailable" if c.soc is None else str(c.soc)),
            "binary_sensor.s05_charging": st("on" if c.charging else "off"),
            "button.s05_refresh_vehicle_data": st("unknown"),
        }.get(entity)


class Base(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = T0
        self.car = FakeCar(self)
        self.store, self.sent, self.tasks = {}, [], []

        async def db(method, vehicle, key, value=None):
            if method == "put":
                self.store[key] = value
            return self.store.get(key, value)

        async def sleep(seconds):
            self.now += seconds
            await asyncio.sleep(0)

        async def notifier(device, payload):
            self.sent.append(payload)

        def create_task(coro):
            task = asyncio.ensure_future(coro)
            self.tasks.append(task)
            return task

        self.hass = SimpleNamespace(states=States(self.car), config=SimpleNamespace(time_zone="Europe/Athens"), async_create_task=create_task)
        runtime = SimpleNamespace(hass=self.hass, vehicle="v1", config={"prefix": "s05"}, hub=SimpleNamespace(db=db))
        self.ctl = pc.Preconditioning(runtime, clock=lambda: self.now, sleep=sleep, call=self.car.call, notifier=notifier)
        self.ctl.config = pc.validate({"verify_timeout": 60, "retry_delay": 20, "scheduling_enabled": True,
                                       "notify": {"enabled": True, "devices": ["notify.mobile_app_phone"]}})

    async def settle(self):
        while self.tasks:
            await self.tasks.pop(0)

    async def run_to(self, ts, step=15):
        while self.now < ts:
            self.now += step
            await self.ctl.tick()
            await self.settle()

    def kinds(self):
        return [h["kind"] for h in self.ctl.history]


class CommandTests(Base):
    async def test_start_success_needs_fresh_vehicle_report(self):
        result = await self.ctl.request_start(22, 15)
        self.assertTrue(result["accepted"])
        await self.settle()
        s = self.ctl.state
        self.assertEqual(s["status"], "ACTIVE")
        self.assertEqual(self.car.calls, [("set_temperature", {"entity_id": "climate.s05_cabin_climate", "temperature": 22.0})])
        self.assertEqual(s["deadline"] - s["session_start"], 900)
        self.assertGreater(self.ctl.state["last_report"], s["last_command"] - 1)

    async def test_http_success_alone_is_not_confirmation(self):
        self.car.ignore = 3  # gateway accepts, vehicle never reports ON
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "UNKNOWN")
        self.assertEqual(len(self.car.calls), 3)  # bounded: max 3 attempts

    async def test_retry_then_success(self):
        self.car.fail = [RuntimeError("timeout talking to gateway")]
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")
        self.assertEqual(self.ctl.state["last_retries"], 1)

    async def test_retry_exhaustion_fails(self):
        self.car.fail = [RuntimeError("x"), RuntimeError("x"), RuntimeError("x")]
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "FAILED")
        self.assertEqual(len(self.car.calls), 3)
        self.assertTrue(any(p["title"].endswith("failed") for p in self.sent))

    async def test_auth_failure_is_not_retried(self):
        self.car.fail = [RuntimeError("Authentication failed: token expired")]
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "FAILED")
        self.assertEqual(len(self.car.calls), 1)

    async def test_rejected_authorization_is_not_reported_as_expired_sign_in(self):
        for text in ("Authentication failed: token expired", "Invalid credentials", "401 Unauthorized"):
            message, retry, in_use = pc.explain(text)
            self.assertIn("sign-in has expired", message, text)
            self.assertEqual((retry, in_use), (False, False), text)  # signing in again is the only fix
        for text in ("403 Forbidden: not authorized to control this vehicle", "Permission denied for this account"):
            message, retry, in_use = pc.explain(text)
            self.assertNotIn("expired", message.lower(), text)
            self.assertIn("not allowed for this account", message, text)
            self.assertEqual((retry, in_use), (True, False), text)  # the normal attempt limit still applies

    async def test_rate_limit_respects_delay_and_limit(self):
        self.car.fail = [RuntimeError("rate limited"), RuntimeError("rate limited"), RuntimeError("rate limited")]
        start = self.now
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(len(self.car.calls), 3)
        self.assertGreaterEqual(self.now - start, 2 * 20)  # retry delay between every attempt

    async def test_retry_rechecks_state_and_does_not_resend(self):
        self.car.delay = 70  # confirmation arrives after the verification window
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")
        self.assertEqual(len(self.car.calls), 1)  # second attempt saw it ON and sent nothing

    async def test_unreadable_state_blocks_retry(self):
        self.car.ignore = 1
        self.car.blind = True
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertIn(self.ctl.state["status"], ("FAILED", "UNKNOWN"))
        self.assertLessEqual(len(self.car.calls), 1)

    async def test_duplicate_start_is_ignored(self):
        await self.ctl.request_start(22, 15)
        second = await self.ctl.request_start(22, 15)
        self.assertFalse(second["accepted"])
        await self.settle()
        self.assertEqual(len(self.car.calls), 1)

    async def test_stop_success(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        await self.ctl.request_stop()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")

    async def test_stop_failure(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.car.fail = [RuntimeError("x")] * 3
        await self.ctl.request_stop()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "FAILED")

    async def test_stop_supersedes_start_and_delayed_start_cannot_overwrite(self):
        self.car.delay = 30
        await self.ctl.request_start(22, 15)
        await asyncio.sleep(0)
        await self.ctl.request_stop()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertIn("superseded", self.kinds())
        self.assertFalse(self.car.on)

    async def test_invalid_temperature_and_duration(self):
        with self.assertRaises(ValueError):
            await self.ctl.request_start(40, 10)
        with self.assertRaises(ValueError):
            await self.ctl.request_start(22, 20)

    async def test_external_climate_not_owned_or_stopped(self):
        self.car.on, self.car.report = True, self.now
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.car.calls, [])
        await self.run_to(self.now + 1800)
        self.assertEqual(self.car.calls, [])  # never stopped automatically


class SessionTests(Base):
    async def start(self, duration=15):
        await self.ctl.request_start(22, duration)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")

    async def test_second_start_while_active_changes_nothing_even_if_state_unreadable(self):
        await self.start()
        before = {k: self.ctl.state.get(k) for k in ("deadline", "op_id", "status", "temperature")}
        sent = len(self.car.calls)
        self.car.blind = True  # the car's state cannot be read right now
        result = await self.ctl.request_start(25, 15)
        await self.settle()
        self.assertFalse(result["accepted"], result)
        self.assertEqual(len(self.car.calls), sent, "no second climate command")
        after = {k: self.ctl.state.get(k) for k in before}
        self.assertEqual(before, after, "deadline, session and status stay as they were")
        self.assertEqual(result["reason"], "already_active")
        self.assertEqual(self.ctl.state["status"], "ACTIVE")

    async def test_early_vehicle_shutdown_reconciled_without_stop(self):
        await self.start()
        self.car.on, self.car.report = False, self.now + 400
        await self.run_to(self.now + 420)
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertIn("auto_shutdown", self.kinds())
        self.assertEqual([c[0] for c in self.car.calls], ["set_temperature"])

    async def test_still_on_at_deadline_gets_stop(self):
        await self.start()
        await self.run_to(self.ctl.state["deadline"] + 120)
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")
        self.assertEqual(self.ctl.state["status"], "INACTIVE")

    async def test_unknown_after_deadline(self):
        await self.start()
        deadline = self.ctl.state["deadline"]
        self.car.blind = True
        self.car.fail = [RuntimeError("x")] * 3
        await self.run_to(deadline + 300)
        self.assertIn(self.ctl.state["status"], ("UNKNOWN", "FAILED"))

    async def test_shorter_duration_stops_early(self):
        await self.start(5)
        start = self.ctl.state["session_start"]
        await self.run_to(start + 5 * 60 + 60)
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")
        self.assertLess(self.now, start + 900)

    async def test_no_automatic_extension(self):
        await self.start()
        await self.run_to(self.now + 3600)
        self.assertEqual([c[0] for c in self.car.calls].count("set_temperature"), 1)

    async def test_restart_during_active_session_keeps_deadline(self):
        await self.start(5)
        stored = dict(self.store)
        fresh = pc.Preconditioning(self.ctl.runtime, clock=lambda: self.now, sleep=self.ctl.sleep, call=self.car.call, notifier=self.ctl.notifier)
        fresh.config, fresh.state = self.ctl.config, {**fresh.blank_state(), **stored["precondition_state"]}
        self.ctl = fresh
        await fresh.recover()
        await self.settle()
        self.assertEqual(fresh.state["status"], "ACTIVE")
        await self.run_to(fresh.state["stop_at"] + 60)
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")
        self.assertEqual([c[0] for c in self.car.calls].count("set_temperature"), 1)

    async def test_restart_mid_start_never_replays_start(self):
        self.ctl.state.update(status="STARTING", last_command=self.now - 30, op_id="x", pending_duration=15)
        await self.ctl.recover()
        await self.settle()
        self.assertEqual(self.car.calls, [])


class ScheduleTests(Base):
    @property
    def tz(self):  # built when a test runs, so a missing tzdata fails those tests only, not the whole module
        return ZoneInfo("Europe/Athens")

    def sched(self, **kw):
        base = {"repeat": "daily", "time": "09:05", "duration": 10, "temperature": 21, "created": 1, "updated": 1}
        return pc.validate_schedule({**base, **kw})

    def test_one_time_and_ready_by(self):
        s = self.sched(repeat="once", date="2026-11-16", mode="ready_by")
        runs = pc.occurrences(s, self.tz, T0 - 86400, T0 + 86400)
        self.assertEqual(len(runs), 1)
        self.assertEqual(datetime.fromtimestamp(runs[0][0], self.tz).strftime("%H:%M"), "08:55")

    def test_overnight_ready_by_starts_previous_day(self):
        s = self.sched(time="00:05", mode="ready_by", repeat="custom", days=[1])  # ready Tuesday 00:05
        start = pc.occurrences(s, self.tz, T0, T0 + 7 * 86400)[0][0]
        local = datetime.fromtimestamp(start, self.tz)
        self.assertEqual((local.weekday(), local.strftime("%H:%M")), (0, "23:55"))

    def test_weekdays_and_custom(self):
        week = pc.occurrences(self.sched(repeat="weekdays"), self.tz, T0, T0 + 7 * 86400)
        self.assertEqual(sorted({datetime.fromtimestamp(r[0], self.tz).weekday() for r in week}), [0, 1, 2, 3, 4])
        custom = pc.occurrences(self.sched(repeat="custom", days=[5, 6]), self.tz, T0, T0 + 7 * 86400)
        self.assertEqual(len(custom), 2)

    def test_dst_transitions(self):
        spring = datetime(2027, 3, 28, 0, 0, tzinfo=timezone.utc).timestamp()  # 03:00 → 04:00 local
        s = self.sched(time="03:30")
        run = pc.occurrences(s, self.tz, spring, spring + 86400)[0][0]
        self.assertEqual(datetime.fromtimestamp(run, self.tz).strftime("%H:%M"), "04:30")
        autumn = datetime(2026, 10, 25, 0, 0, tzinfo=timezone.utc).timestamp()
        runs = pc.occurrences(self.sched(time="03:30"), self.tz, autumn, autumn + 86400)
        self.assertEqual(len(runs), 1)  # ambiguous hour runs once

    def test_invalid_schedules(self):
        for bad in ({"time": "25:00"}, {"duration": 16}, {"repeat": "custom", "days": []}, {"repeat": "once", "date": ""}):
            with self.assertRaises(ValueError):
                self.sched(**bad)

    async def test_schedule_executes_once_without_ui(self):
        due = pc.occurrences(self.sched(), self.tz, T0, T0 + 86400)[0][0]
        self.ctl.config["schedules"] = [self.sched()]
        self.now = due - 30
        await self.run_to(due + 120)
        self.assertEqual([c[0] for c in self.car.calls].count("set_temperature"), 1)
        self.assertEqual(self.ctl.state["schedule_id"], self.ctl.config["schedules"][0]["id"])

    async def test_missed_start_is_not_run_late(self):
        s = self.sched()
        due = pc.occurrences(s, self.tz, T0, T0 + 86400)[0][0]
        self.ctl.config["schedules"] = [s]
        self.now = due + 1800
        await self.ctl.tick()
        await self.settle()
        self.assertEqual(self.car.calls, [])
        self.assertIn("schedule_missed", self.kinds())

    async def test_missed_stop_runs_on_recovery(self):
        self.car.on, self.car.report = True, self.now
        self.ctl.state.update(status="STOPPING", owner="companion", session_start=self.now - 600, deadline=self.now + 300,
                              last_command=self.now - 5, op_id="x")
        await self.ctl.recover()
        await self.settle()
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")
        self.assertEqual(self.ctl.state["status"], "INACTIVE")

    async def test_overlapping_schedules_start_once(self):
        a, b = self.sched(), self.sched(time="09:07")
        self.ctl.config["schedules"] = [a, b]
        due = pc.occurrences(a, self.tz, T0, T0 + 86400)[0][0]
        self.now = due - 15
        await self.run_to(due + 300)
        self.assertEqual([c[0] for c in self.car.calls].count("set_temperature"), 1)
        self.assertIn("schedule_skipped", self.kinds())

    async def test_disabled_schedule_and_manual_stop_not_restarted(self):
        s = self.sched()
        due = pc.occurrences(s, self.tz, T0, T0 + 86400)[0][0]
        self.ctl.config["schedules"] = [{**s, "enabled": False}]
        self.now = due - 15
        await self.run_to(due + 60)
        self.assertEqual(self.car.calls, [])
        self.ctl.config["schedules"] = [s]
        await self.run_to(due + 120)  # within grace: runs
        await self.ctl.request_stop()
        await self.settle()
        n = len(self.car.calls)
        await self.run_to(due + 600)
        self.assertEqual(len(self.car.calls), n)  # stale schedule cannot restart after manual STOP

    async def test_already_on_before_schedule_skips(self):
        s = self.sched()
        due = pc.occurrences(s, self.tz, T0, T0 + 86400)[0][0]
        self.ctl.config["schedules"] = [s]
        self.now = due - 15
        self.car.on, self.car.report = True, self.now
        await self.run_to(due + 30)
        self.assertEqual(self.car.calls, [])

    async def test_restart_does_not_duplicate_schedule(self):
        s = self.sched()
        due = pc.occurrences(s, self.tz, T0, T0 + 86400)[0][0]
        self.ctl.config["schedules"] = [s]
        self.now = due + 10
        await self.ctl.tick()
        await self.settle()
        fired = dict(self.ctl.state["fired"])
        self.ctl.state = {**self.ctl.blank_state(), "fired": fired}
        await self.ctl.tick()
        await self.settle()
        self.assertEqual([c[0] for c in self.car.calls].count("set_temperature"), 1)


class BatteryTests(Base):
    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.ctl.config["battery"].update(enabled=True, min_soc=20)
        self.car.report = self.now - 60

    async def test_above_threshold_starts(self):
        self.car.soc = 21
        self.assertTrue((await self.ctl.request_start(22, 15))["accepted"])

    async def test_equal_and_below_block(self):
        for soc in (20, 15):
            self.car.soc = soc
            result = await self.ctl.request_start(22, 15)
            self.assertEqual(result["reason"], "battery_low")
        self.assertEqual(self.car.calls, [])
        self.assertTrue(any(p["title"] == "Preconditioning not started" for p in self.sent))

    async def test_stale_reading_is_refreshed_before_deciding(self):
        self.car.report = self.now - 4000  # car asleep for an hour
        self.assertTrue((await self.ctl.request_start(22, 15))["accepted"])  # not blocked yet
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")  # the refresh brought a fresh 60 % reading

    async def test_still_stale_after_refresh_blocks(self):
        self.car.report = self.now - 4000
        original = self.car.call
        async def no_refresh(domain, service, data):
            if domain == "button":
                return  # the car stays asleep: no new report
            return await original(domain, service, data)
        self.ctl.call = no_refresh
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["battery_block"]["reason"], "battery_stale")
        self.assertEqual(self.car.calls, [])

    async def test_unavailable_blocks_after_refresh(self):
        self.car.soc = None
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["battery_block"]["reason"], "battery_unavailable")
        self.assertEqual(self.car.calls, [])

    async def test_test_notification(self):
        result = await self.ctl.test_notification()
        self.assertEqual(result["deliveries"][0]["status"], "accepted")
        self.assertEqual(self.sent[-1]["title"], "Preconditioning on")

    async def test_crossing_threshold_stops_and_verifies(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.car.soc = 19
        await self.run_to(self.now + 30)
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertIn("battery_stop", self.kinds())
        self.assertTrue(any(p["title"] == "Climate stopped by battery protection" for p in self.sent))

    async def test_battery_stop_failure_reported(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.car.soc, self.car.fail = 10, [RuntimeError("x")] * 3
        await self.run_to(self.now + 30)
        self.assertEqual(self.ctl.state["status"], "FAILED")

    async def test_retry_blocked_when_soc_drops_during_verification(self):
        self.car.ignore = 1
        await self.ctl.request_start(22, 15)
        self.car.soc = 18
        await self.settle()
        self.assertEqual(self.car.calls, [])  # the refreshed reading is checked before any command
        self.assertEqual(self.ctl.state["battery_block"]["source"], "refresh")

    async def test_scheduled_start_skipped_and_not_started_later(self):
        tz = ZoneInfo("Europe/Athens")
        s = pc.validate_schedule({"repeat": "daily", "time": "09:05", "duration": 10, "temperature": 21, "created": 1, "updated": 1})
        self.ctl.config["schedules"] = [s]
        due = pc.occurrences(s, tz, T0, T0 + 86400)[0][0]
        self.now, self.car.soc = due - 15, 10
        self.car.report = due - 60
        await self.run_to(due + 30)
        self.car.soc = 80
        self.car.report = self.now
        await self.run_to(due + 280)
        self.assertEqual(self.car.calls, [])
        self.assertTrue(any(h.get("reason") == "battery_low" for h in self.ctl.history))

    async def test_charging_option(self):
        self.car.soc, self.car.charging = 10, True
        self.assertEqual((await self.ctl.request_start(22, 15))["reason"], "battery_low")  # conservative default
        self.ctl.config["battery"]["while_charging"] = False
        self.assertTrue((await self.ctl.request_start(22, 15))["accepted"])

    async def test_restart_during_battery_stop(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.ctl.state.update(status="STOPPING", stop_reason="battery")
        await self.ctl.recover()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertEqual(self.car.calls[-1][0], "set_hvac_mode")


class NotificationTests(Base):
    async def test_disabled_master_sends_nothing_but_still_verifies(self):
        self.ctl.config["notify"]["enabled"] = False
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.sent, [])
        self.assertEqual(self.ctl.state["status"], "ACTIVE")

    async def test_stable_tag_and_stop_action(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        tags = {p["data"]["tag"] for p in self.sent}
        self.assertEqual(tags, {"deepal_companion_v1_precondition_status"})
        self.assertEqual(self.sent[-1]["data"]["actions"][0]["action"], pc.ACTION_STOP)
        self.assertNotIn("sticky", self.sent[-1]["data"])

    async def test_global_switch_off(self):
        self.ctl.runtime.notifications = SimpleNamespace(config={"enabled": False})
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.sent, [])

    async def test_delivery_failure_does_not_break_command(self):
        async def broken(device, payload):
            raise RuntimeError("phone gone")
        self.ctl.notifier = broken
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")
        self.assertIn("notify_error", self.kinds())

    async def test_one_preference_shared_by_all_menus(self):
        self.ctl.runtime.hub.db = self.ctl.runtime.hub.db
        await self.ctl.save({"notify": {**self.ctl.config["notify"], "enabled": False}})
        self.assertFalse(self.store["precondition_config"]["notify"]["enabled"])
        self.assertFalse(self.ctl.snapshot()["config"]["notify"]["enabled"])

    async def test_notification_action_stops(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        await self.ctl._action_event(SimpleNamespace(data={"action": pc.ACTION_STOP}))
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")


if __name__ == "__main__":
    unittest.main()


class RefreshAndSharingTests(Base):
    async def test_refresh_before_start(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.car.refreshes, 2)  # before the start and after it is confirmed
        self.assertIn("refreshed", self.kinds())
        self.assertEqual(self.ctl.state["status"], "ACTIVE")

    async def test_already_on_changes_nothing(self):
        self.car.on, self.car.report = True, self.now
        result = await self.ctl.request_start(22, 15)
        self.assertEqual(result["reason"], "already_on")
        self.assertEqual(self.car.calls, [])
        self.assertFalse(getattr(self.car, "refreshes", 0))

    def test_scheduling_off_by_default(self):
        self.assertFalse(pc.validate({})["scheduling_enabled"])

    async def test_phones_shared_with_live_climate(self):
        saved = []

        class Engine:
            config = {"enabled": True, "live_climate": {"enabled": False, "devices": ["notify.mobile_app_old"]}}

            async def save(self, value, expected=None):
                saved.append(value)
                Engine.config = value

        self.ctl.runtime.notifications = Engine()
        self.assertEqual(self.ctl.snapshot()["config"]["notify"]["devices"], ["notify.mobile_app_old"])
        await self.ctl.save({"notify_devices": ["notify.mobile_app_new"]})
        self.assertEqual(saved[-1]["live_climate"]["devices"], ["notify.mobile_app_new"])
        self.assertEqual(self.ctl.devices(), ["notify.mobile_app_new"])


class SilentVehicleTests(Base):
    """The vehicle only sends a new report when asked (the normal update interval is longer than the verify time)."""

    async def asyncSetUp(self):
        await super().asyncSetUp()
        car = self.car
        car.advance = lambda: None
        original = car.call

        async def call(domain, service, data):
            await original(domain, service, data)
            if domain == "button" and getattr(car, "pending", None):
                car.on, car.report, car.pending = car.pending[1], self.now, None
        car.call = call
        self.ctl.call = call

    async def test_start_is_confirmed_by_asking_for_a_fresh_report(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "ACTIVE")
        self.assertEqual(len(self.car.calls), 1)  # confirmed without a second command

    async def test_stop_is_confirmed_without_retry_or_second_command(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.car.calls.clear()
        await self.ctl.request_stop()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertEqual(len(self.car.calls), 1)
        self.assertEqual(self.ctl.state["last_retries"], 0)


class LanguageAndTimeTests(Base):
    async def test_message_language_setting_overrides_home_assistant_language(self):
        self.hass.config.language = "el"
        phone_text.set_language(self.hass, "auto")
        self.assertEqual(self.ctl.tx("Preconditioning test notification"), "Δοκιμαστική ειδοποίηση προκλιματισμού")
        phone_text.set_language(self.hass, "en")
        self.assertEqual(self.ctl.tx("Preconditioning test notification"), "Preconditioning test notification")
        phone_text.set_language(self.hass, "auto")

    async def test_start_notification_shows_the_chosen_duration_not_the_car_limit(self):
        sent = []
        original = self.ctl.notify

        async def spy(event, title, message, *args, **kw):
            sent.append((event, args))
            return await original(event, title, message, *args, **kw)
        self.ctl.notify = spy
        await self.ctl.request_start(22, 5)
        await self.settle()
        shown = next(a for e, a in sent if e == "start_confirmed")[1]
        begin = self.ctl.state["session_start"]
        self.assertEqual(shown, self.ctl.hm(begin + 5 * 60))


class HistoryTests(Base):
    async def test_rotation_removes_entries_older_than_30_days(self):
        self.ctl.history = [{"id": "old", "time": self.now - 31 * 86400, "kind": "start_sent"}, {"id": "new", "time": self.now - 29 * 86400, "kind": "stop_sent"}]
        await self.ctl.persist()
        self.assertEqual([h["id"] for h in self.ctl.history], ["new"])
        self.assertEqual([h["id"] for h in self.store["precondition_history"]], ["new"])

    async def test_clear_history_empties_the_list_and_storage(self):
        self.ctl.log("start_sent")
        snap = await self.ctl.clear_history()
        self.assertEqual(snap["history"], [])
        self.assertEqual(self.store["precondition_history"], [])


class ActivityTests(Base):
    async def test_actions_go_to_recent_activity_with_deliveries(self):
        rows = []

        class Engine:
            config = {"enabled": True, "live_climate": {"devices": ["notify.mobile_app_phone"]}}

            async def record(self, rule, status, **details):
                rows.append((rule["id"], status, details))

            async def persist(self):
                pass

        self.ctl.runtime.notifications = Engine()
        await self.ctl.request_start(22, 15)
        await self.settle()
        titles = [r[2]["title"] for r in rows]
        self.assertIn("Preconditioning start requested", titles)
        self.assertIn("Preconditioning on", titles)
        confirmed = next(r for r in rows if r[2]["title"] == "Preconditioning on")
        self.assertEqual(confirmed[1], "sent")
        self.assertEqual(confirmed[2]["deliveries"][0]["status"], "accepted")
        self.assertTrue(all(r[0] == "preconditioning" for r in rows))

    async def test_failure_is_an_error_entry_even_without_notifications(self):
        rows = []

        class Engine:
            config = {"enabled": True, "live_climate": {"devices": []}}

            async def record(self, rule, status, **details):
                rows.append((status, details["title"]))

            async def persist(self):
                pass

        self.ctl.runtime.notifications = Engine()
        self.car.fail = [RuntimeError("Authentication failed")]
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertIn(("error", "Preconditioning start failed"), rows)


class InUseTests(Base):
    async def test_code_1036_on_stop_hands_over_without_retry(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.car.fail = [RuntimeError("Deepal command failed with result code 1036: Operation failed. The engine status does not support remote start.")]
        await self.ctl.request_stop()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertIn("handed_over", self.kinds())
        self.assertEqual([c[0] for c in self.car.calls].count("set_hvac_mode"), 1)

    async def test_1036_on_start_explains_and_does_not_retry(self):
        self.car.fail = [RuntimeError("Deepal command failed with result code 1036: engine status")]
        await self.ctl.request_start(22, 15)
        await self.settle()
        self.assertEqual(len(self.car.calls), 1)
        self.assertIn("parked and switched off", self.ctl.state["last_error"])

    async def test_driving_ends_session_without_command(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        odo = {"v": 1000.0}
        original = self.hass.states.get
        self.hass.states.get = lambda e: st(str(odo["v"])) if e == "sensor.s05_total_odometer" else original(e)
        await self.ctl.tick()
        odo["v"] = 1002.0
        await self.ctl.tick()
        await self.settle()
        self.assertEqual(self.ctl.state["status"], "INACTIVE")
        self.assertIn("handed_over", self.kinds())
        self.assertNotIn("set_hvac_mode", [c[0] for c in self.car.calls])

    async def test_refresh_before_stop_and_after_actions(self):
        await self.ctl.request_start(22, 15)
        await self.settle()
        before = self.car.refreshes
        await self.ctl.request_stop()
        await self.settle()
        self.assertGreaterEqual(self.car.refreshes - before, 2)  # before the stop and after it


class ApnsTagTests(Base):
    async def test_tags_fit_apns_with_a_real_vehicle_id(self):
        self.ctl.runtime.vehicle = "2054180183556608003-with-a-long-entry-id-01KX17Y153WBNYX2K6PHRR9W2T"
        await self.ctl.request_start(22, 15)
        await self.settle()
        await self.ctl.test_notification()
        self.assertTrue(self.sent)
        for payload in self.sent:
            self.assertLessEqual(len(payload["data"]["tag"].encode("utf-8")), 64, payload["data"]["tag"])


class TranslationTests(Base):
    async def test_phone_messages_follow_the_home_assistant_language(self):
        self.hass.config.language = "el"
        await self.ctl.test_notification()
        self.assertEqual(self.sent[-1]["title"], "Προκλιματισμός ενεργός")
        self.assertIn("22", self.sent[-1]["message"])
        self.assertNotIn("{0}", self.sent[-1]["message"])

    async def test_every_backend_text_is_translated_in_all_languages(self):
        import ast, json, re
        from pathlib import Path
        folder = Path(pc.__file__).parent
        source = (folder / "preconditioning.py").read_text(encoding="utf-8")
        keys = set(re.findall(r'(?:notify\("[a-z_]+", |_unknown\(gen, |_fail\(gen, |self\.tx\()"([^"]+)"', source))
        keys |= {title for title, _, _ in ast.literal_eval(re.search(r"ACTIVITY = (\{.*?\n\})", source, re.S).group(1)).values()}
        for lang in ("de", "el", "es", "it"):
            texts = json.loads((folder / "phone_text" / (lang + ".json")).read_text(encoding="utf-8"))
            self.assertEqual([k for k in sorted(keys) if k not in texts], [], lang)


class RobustnessTests(Base):
    async def test_status_survives_stored_state_without_an_end_time(self):
        self.ctl.state.update(owner="companion", session_start=self.now - 60, deadline=None, stop_at=None)
        snapshot = self.ctl.snapshot()
        self.assertIsNone(snapshot["estimated_remaining"])

    async def test_stop_cancels_background_tasks(self):
        task = self.ctl._spawn(asyncio.sleep(100))
        self.tasks.clear()
        await self.ctl.stop()
        await asyncio.sleep(0)
        self.assertTrue(task.cancelled())
        self.ctl._refresh_later()
        self.assertEqual(self.tasks, [], "no refresh is started after stop")

    async def test_deliveries_belong_to_their_own_event(self):
        self.ctl.log("start_confirmed", op_id="a")
        self.ctl.log("schedule_missed", schedule_id="s1")
        await self.ctl.notify("start_confirmed", "Preconditioning on", "")
        first, second = self.ctl._activity
        self.assertEqual(first["kind"], "start_confirmed")
        self.assertEqual(first["deliveries"][0]["status"], "accepted")
        self.assertEqual(second["deliveries"], [])

    async def test_manual_refresh_asks_the_car_once_and_waits_for_the_report(self):
        before = getattr(self.car, "refreshes", 0)
        first = await self.ctl.refresh_now()
        self.assertTrue(first["fresh"] and not first["throttled"])
        self.assertEqual(self.car.refreshes, before + 1)
        again = await self.ctl.refresh_now()
        self.assertTrue(again["throttled"] and not again["fresh"])
        self.assertEqual(self.car.refreshes, before + 1, "a second press right away does not ask the car again")
        self.assertNotIn("climate", [call[0] for call in self.car.calls], "refreshing never touches the climate")
