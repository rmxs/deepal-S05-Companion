"""Charger limit: stop the owner's charger at the charging target. The car and the charger are simulated: no test
touches a real charger, vehicle or phone."""
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
from unittest import mock
import unittest

package = ModuleType("dcpkg")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
sys.modules.setdefault("dcpkg", package)
cl = importlib.import_module("dcpkg.charger_limit")

T0 = datetime(2026, 11, 25, 12, 0, tzinfo=timezone.utc).timestamp()
CONTROL = "lock.garage_charger_lock"


def st(value, attrs=None):
    return SimpleNamespace(state=value, attributes=attrs or {}, last_reported=None, last_updated=None)


class World:
    """One car, one charger. A lock or switch command changes the charger state and its power."""

    def __init__(self, test, domain="lock", on_stops=True):
        self.test, self.domain, self.on_stops = test, domain, on_stops
        self.control = "unlocked" if domain == "lock" else ("off" if on_stops else "on")
        self.soc, self.plugged, self.car_charging, self.report = 70.0, True, True, T0
        self.calls, self.fail, self.stuck = [], 0, False
        self.entity = CONTROL if domain == "lock" else "switch.garage_charger_lock"

    def stopped(self):
        on = self.control in ("on", "locked")
        return on == self.on_stops

    def power(self):
        return 0 if self.stopped() or not self.car_charging else 7200

    def get(self, entity):
        t = self.test
        if entity == self.entity:
            return st(self.control)
        return {
            "sensor.s05_battery_level": SimpleNamespace(state=str(self.soc), attributes={}, last_updated=None,
                                                         last_reported=datetime.fromtimestamp(self.report, timezone.utc)),
            "binary_sensor.s05_charging": st("on" if self.car_charging and not self.stopped() else "off"),
            "binary_sensor.s05_charger_plugged": st("unavailable" if self.plugged is None else ("on" if self.plugged else "off")),
            "sensor.charger_power": st(str(self.power())),
        }.get(entity)

    async def call(self, domain, service, data):
        self.calls.append((domain, service, data["entity_id"]))
        if self.fail:
            self.fail -= 1
            raise RuntimeError("charger offline")
        if self.stuck:
            return  # the command is accepted but nothing changes
        if domain == "lock":
            self.control = "locked" if service == "lock" else "unlocked"
        else:
            self.control = "on" if service == "turn_on" else "off"


class Engine:
    def __init__(self):
        self.config = {"enabled": True, "live_climate": {"devices": ["notify.mobile_app_phone"]}}
        self.records, self.sent = [], []
        self.quiet = False

    def limit_quiet(self):
        return self.quiet

    async def record(self, rule, status, **details):
        self.records.append((rule["id"], status, details))

    async def persist(self):
        pass

    async def send_to_recipient(self, device, payload):
        self.sent.append((device, payload))


class Base(unittest.IsolatedAsyncioTestCase):
    domain, on_stops = "lock", True

    def setUp(self):
        self.now = T0
        self.world = World(self, self.domain, self.on_stops)
        self.engine = Engine()
        store = {}

        hub = SimpleNamespace(db=self._db(store))
        runtime = SimpleNamespace(
            hass=SimpleNamespace(states=self.world, config=SimpleNamespace(language="en", time_zone="UTC"),
                                 services=None, async_create_task=lambda c: asyncio.ensure_future(c)),
            config={"prefix": "s05", "charge_target": 80, "entities": {}}, hub=hub, vehicle="car", notifications=self.engine,
            preconditioning=None)
        self.runtime, self.store = runtime, store

        async def sleep(seconds):
            self.now += seconds
            self.world.report = self.now
        self.cl = cl.ChargerLimit(runtime, clock=lambda: self.now, sleep=sleep, call=self.world.call)
        self.cl._listen = lambda: None
        self.cl.config = cl.validate({"mode": "live", "control": self.world.entity, "on_stops": self.on_stops, "power": "sensor.charger_power"})

    @staticmethod
    def _db(store):
        async def db(op, vehicle, key, default=None):
            if op == "put":
                store[key] = deepcopy(default)  # what is saved is a copy, as in the real database
                return None
            return store.get(key, default)
        return db

    async def tick(self, seconds=0):
        self.now += seconds
        self.world.report = self.now
        await self.cl.evaluate()

    async def reach(self):
        """Battery at the target while charging, held longer than the hold time."""
        self.world.soc = 80.0
        await self.tick(0)
        await self.tick(cl.HOLD + 1)


class DiscoveryTests(unittest.TestCase):
    def test_lock_wins_and_polarity_is_known(self):
        found = cl.classify([
            {"entity_id": "switch.v2c_charge", "name": "Charge", "device_class": ""},
            {"entity_id": "lock.v2c_lock", "name": "Charger lock", "device_class": ""},
            {"entity_id": "sensor.v2c_power", "name": "Charge power", "device_class": "power"},
            {"entity_id": "sensor.v2c_energy", "name": "Energy", "device_class": "energy"}])
        self.assertEqual(found, {"control": "lock.v2c_lock", "on_stops": True, "sure": True, "power": "sensor.v2c_power", "energy": "sensor.v2c_energy"})

    def test_switch_names_decide_the_direction(self):
        stop = cl.classify([{"entity_id": "switch.wallbox_bloqueo_del_cargador", "name": "Bloqueo del cargador", "device_class": ""}])
        self.assertEqual((stop["control"], stop["on_stops"], stop["sure"]), ("switch.wallbox_bloqueo_del_cargador", True, True))
        allow = cl.classify([{"entity_id": "switch.wallbox_charge_enabled", "name": "Charging enabled", "device_class": ""}])
        self.assertEqual((allow["on_stops"], allow["sure"]), (False, True))
        unsure = cl.classify([{"entity_id": "switch.wallbox_relay", "name": "Relay", "device_class": ""}])
        self.assertEqual((unsure["on_stops"], unsure["sure"]), (True, False))

    def test_a_stop_switch_beats_an_unrelated_one_and_no_control_is_none(self):
        found = cl.classify([{"entity_id": "switch.wallbox_led", "name": "LED", "device_class": ""},
                             {"entity_id": "switch.wallbox_pause", "name": "Pause charging", "device_class": ""}])
        self.assertEqual(found["control"], "switch.wallbox_pause")
        self.assertIsNone(cl.classify([{"entity_id": "sensor.x", "name": "x", "device_class": ""}])["control"])


class ValidateTests(unittest.TestCase):
    def test_a_mode_needs_a_control_and_entities_are_checked(self):
        self.assertEqual(cl.validate({"mode": "live"})["mode"], "off")
        self.assertEqual(cl.validate({"mode": "dry", "control": "lock.a"})["mode"], "dry")
        with self.assertRaises(ValueError):
            cl.validate({"mode": "live", "control": "sensor.a"})
        with self.assertRaises(ValueError):
            cl.validate({"control": "not an entity"})
        self.assertEqual(cl.validate("garbage"), cl.DEFAULT)


class DryRunTests(Base):
    async def test_dry_run_decides_but_never_touches_the_charger(self):
        self.cl.config["mode"] = "dry"
        await self.reach()
        self.assertEqual(self.cl.phase(), "would_stop")
        self.assertEqual(self.world.calls, [])
        self.assertFalse(self.cl.state["engaged"])
        self.assertEqual(self.engine.records[-1][0], "charger_limit")
        self.assertIn("Dry run", self.engine.records[-1][2]["title"])
        await self.tick(300)
        self.assertEqual(len([r for r in self.engine.records if "Dry run" in r[2]["title"]]), 1, "told once per plug-in")


class LiveTests(Base):
    async def test_stops_once_at_the_target_and_tells_the_phone(self):
        await self.reach()
        self.assertEqual(self.world.calls, [("lock", "lock", CONTROL)])
        self.assertEqual(self.cl.phase(), "stopped")
        self.assertTrue(self.cl.state["engaged"])
        await self.tick(600)
        self.assertEqual(len(self.world.calls), 1, "one stop per plug-in")
        self.assertEqual(self.engine.sent[0][0], "notify.mobile_app_phone")
        self.assertIn("80%", self.engine.sent[0][1]["title"])

    async def test_a_switch_that_stops_when_off_is_turned_off(self):
        self.world = World(self, "switch", on_stops=False)
        self.cl.config = cl.validate({"mode": "live", "control": self.world.entity, "on_stops": False})
        self.runtime.hass.states = self.world
        self.cl.call = self.world.call
        await self.reach()
        self.assertEqual(self.world.calls, [("switch", "turn_off", "switch.garage_charger_lock")])

    async def test_one_wrong_or_short_reading_does_not_stop_the_charge(self):
        self.world.soc = 80.0
        await self.tick(0)
        self.world.soc = 71.0
        await self.tick(20)
        self.world.soc = 80.0
        await self.tick(10)
        await self.tick(cl.HOLD - 5)
        self.assertEqual(self.world.calls, [])

    async def test_nothing_happens_when_unplugged_not_charging_stale_or_without_target(self):
        for setup in (lambda w: setattr(w, "plugged", False), lambda w: setattr(w, "car_charging", False)):
            self.setUp()
            setup(self.world)
            await self.reach()
            self.assertEqual(self.world.calls, [])
        self.setUp()
        self.world.soc = 80.0
        await self.tick(0)
        self.world.report = self.now - cl.FRESH - 10
        self.now += cl.HOLD + 1
        await self.cl.evaluate()
        self.assertEqual(self.world.calls, [], "an old battery reading never stops a charge")
        self.setUp()
        self.runtime.config["charge_target"] = 0
        await self.reach()
        self.assertEqual((self.world.calls, self.cl.phase()), ([], "no_target"))

    async def test_below_the_target_it_just_waits(self):
        self.world.soc = 79.0
        await self.tick(0)
        await self.tick(300)
        self.assertEqual((self.world.calls, self.cl.phase()), ([], "waiting"))


class ManualRestartTests(Base):
    async def test_a_manual_restart_pauses_the_limit_until_the_next_plug_in(self):
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped")
        await self.tick(cl.EXPECT + 10)
        self.world.control = "unlocked"  # the owner restarts the charger
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "paused")
        self.assertEqual(len(self.world.calls), 1, "Companion does not fight the owner")
        await self.tick(900)
        self.assertEqual(len(self.world.calls), 1)
        self.assertIn("Charging limit paused", [r[2]["title"] for r in self.engine.records])
        self.world.plugged = False
        await self.tick(5)
        self.world.plugged = True
        self.world.soc = 80.0
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "waiting", "unplugging re-arms the limit")
        await self.tick(cl.HOLD + 1)
        self.assertEqual(len(self.world.calls), 2, "the next plug-in is limited again")

    async def test_charge_anyway_releases_and_pauses(self):
        await self.reach()
        await self.cl.resume()
        self.assertEqual(self.world.control, "unlocked")
        self.assertEqual(self.cl.phase(), "paused")
        await self.tick(900)
        self.assertEqual(len(self.world.calls), 2, "lock then unlock, nothing more")


class ReleaseTests(Base):
    async def test_a_higher_target_lets_charging_continue(self):
        await self.reach()
        self.runtime.config["charge_target"] = 90
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")
        self.assertEqual((self.cl.phase(), self.cl.state["manual"]), ("waiting", False), "released by Companion is not a manual restart")
        await self.tick(900)
        self.assertEqual(len(self.world.calls), 2)

    async def test_turning_the_target_off_releases(self):
        await self.reach()
        self.runtime.config["charge_target"] = 0
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")

    async def test_unplugging_releases_so_the_next_charge_is_not_blocked(self):
        await self.reach()
        self.world.plugged = False
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")
        self.assertFalse(self.cl.state["engaged"])
        self.assertEqual(self.cl.phase(), "waiting")

    async def test_leaving_live_mode_releases(self):
        await self.reach()
        await self.cl.save({"mode": "dry"})
        self.assertEqual(self.world.control, "unlocked")

    async def test_a_restart_with_an_old_stop_releases_when_unplugged(self):
        await self.reach()
        self.cl.state = {**self.cl.state}
        self.world.plugged = False
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")

    async def test_off_mode_never_touches_the_charger(self):
        self.cl.config["mode"] = "off"
        await self.reach()
        self.assertEqual((self.world.calls, self.cl.phase()), ([], "off"))


class FailureTests(Base):
    async def test_a_command_that_keeps_failing_is_reported_once_and_not_repeated(self):
        self.world.fail = 99
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        self.assertEqual(len(self.world.calls), cl.MAX_ATTEMPTS)
        self.assertEqual(self.engine.records[-1][2]["title"], "The charger could not be stopped")
        await self.tick(900)
        self.assertEqual(len(self.world.calls), cl.MAX_ATTEMPTS, "no endless retry")
        health = importlib.import_module("dcpkg.health")
        checks = health.charger_limit_checks(self.cl)
        self.assertEqual(checks[0]["status"], "error")

    async def test_a_stop_that_changes_nothing_is_released_and_reported(self):
        self.world.stuck = True
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        self.assertFalse(self.cl.state["engaged"])

    async def test_a_wrong_direction_is_caught_by_the_power_reading(self):
        self.cl.config["on_stops"] = False  # the lock really stops when locked, but the setting says unlocked stops
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed", "the charger power never dropped")

    async def test_changing_the_settings_clears_a_failure(self):
        self.world.fail = 99
        await self.reach()
        self.world.fail = 0
        await self.cl.save({"mode": "dry"})
        self.assertIsNone(self.cl.state["failed"])


class SlowStopTests(Base):
    """A slow charger or power sensor: the stop is watched longer before it counts as failed, and clears itself later."""

    def slow_power(self, delay):
        """The power sensor keeps reading 7200 W for `delay` seconds after the charger was stopped."""
        since = {"t": None}

        def get(entity):
            if entity == "sensor.charger_power":
                if not self.world.stopped():
                    since["t"] = None
                    return st("7200", {"unit_of_measurement": "W"})
                since["t"] = self.now if since["t"] is None else since["t"]
                return st("7200" if self.now - since["t"] < delay else "0", {"unit_of_measurement": "W"})
            return World.get(self.world, entity)
        self.world.get = get

    async def test_a_slow_power_drop_inside_the_extra_watch_is_a_stop_without_a_new_command(self):
        self.slow_power(cl.MAX_ATTEMPTS * (cl.VERIFY + cl.RETRY_DELAY) + 120)
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped")
        self.assertIsNone(self.cl.state["failed"])
        self.assertEqual(self.world.control, "locked")
        self.assertEqual([c[1] for c in self.world.calls], ["lock"] * cl.MAX_ATTEMPTS, "no command is sent while watching")
        self.assertEqual(self.engine.records[-1][2]["title"], "Charging reached target · 80%")
        self.assertEqual(self.cl.state["last_attempt"]["result"], "stopped_after_wait")

    async def test_a_power_drop_after_the_extra_watch_fails_with_the_power_reason(self):
        self.slow_power(10 ** 6)
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        reason = "The charger could not be stopped: power still 7200 W from sensor.charger_power"
        self.assertEqual(self.cl.state["failed"], reason)
        self.assertEqual(self.engine.records[-1][2]["message"], reason)
        health = importlib.import_module("dcpkg.health")
        check = health.charger_limit_checks(self.cl)[0]
        self.assertEqual((check["status"], check["detail"]), ("error", reason))
        self.assertEqual((check["detail_key"], check["args"]), (cl.REASONS["power"], ["7200", "sensor.charger_power"]))

    async def test_a_control_that_does_not_change_names_the_control_and_its_state(self):
        self.world.stuck = True
        await self.reach()
        self.assertEqual(self.cl.state["failed"], "The charger could not be stopped: lock.garage_charger_lock did not change (reads unlocked)")
        self.assertEqual(self.cl.state["last_attempt"]["check"], "control lock.garage_charger_lock did not change (reads unlocked, expected locked)")

    async def test_a_service_error_and_an_unavailable_control_are_named(self):
        self.world.fail = 99
        await self.reach()
        self.assertEqual(self.cl.state["failed"], "The charger could not be stopped: charger offline")
        self.cl.state.update(failed=None, failed_reason=None)

        async def gone(domain, service, data):
            self.world.calls.append((domain, service, data["entity_id"]))
            self.world.control = "unavailable"
        self.cl.call = gone
        self.world.control = "unlocked"
        await self.cl.stop_charging(80)
        self.assertEqual(self.cl.state["failed"], "The charger could not be stopped: lock.garage_charger_lock is unavailable")

    async def test_a_charger_that_reads_stopped_later_clears_the_failure_and_holds_the_stop(self):
        self.world.stuck = True
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        self.world.stuck = False
        self.world.control = "locked"  # the charger applied the stop at last
        with self.assertLogs("dcpkg.charger_limit", "WARNING") as logs:
            await self.tick(5)
        self.assertIn("reads stopped now", "\n".join(logs.output))
        self.assertIsNone(self.cl.state["failed"])
        self.assertIsNone(self.cl.state["failed_reason"])
        self.assertEqual(self.cl.phase(), "stopped")
        self.assertTrue(self.cl.state["engaged"])
        self.assertEqual(self.engine.records[-1][2]["title"], "The charger stopped later")
        self.assertEqual(self.cl.state["last_attempt"]["result"], "stopped_later")
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok")
        self.world.plugged = False  # held as ours: unplugging releases it
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")

    async def test_a_failure_is_logged_with_the_record_and_kept_for_diagnostics(self):
        self.slow_power(10 ** 6)
        with self.assertLogs("dcpkg.charger_limit", "WARNING") as logs:
            await self.reach()
        self.assertIn("power still 7200 W from sensor.charger_power", "\n".join(logs.output))
        record = self.store["charger_limit_state"]["last_attempt"]  # saved with the state
        self.assertEqual((record["result"], record["control"], record["expected_stop"], record["power_entity"]),
                         ("failed", CONTROL, "locked", "sensor.charger_power"))
        self.assertEqual(len(record["tries"]), cl.MAX_ATTEMPTS)
        first = record["tries"][0]
        self.assertEqual((first["before"]["control"], first["after"]["control"]), ("unlocked", "locked"))
        self.assertLessEqual(len(first["samples"]), cl.KEEP_SAMPLES)
        self.assertEqual((first["samples"][-1]["power"], first["samples"][-1]["unit"], first["samples"][-1]["power_w"]), ("7200", "W", 7200.0))
        self.assertGreaterEqual(record["watch"]["until"] - record["watch"]["from"], cl.WATCH_MORE)
        diagnostics = importlib.import_module("dcpkg.diagnostics")

        async def db(op, *args):
            return {"sessions": 0, "active": None} if op == "summary" else None
        hass = SimpleNamespace(data={diagnostics.DOMAIN: SimpleNamespace(db=db, vehicles={"car": SimpleNamespace(charger_limit=self.cl)})})
        out = await diagnostics.async_get_config_entry_diagnostics(hass, SimpleNamespace(unique_id="car"))
        self.assertEqual(out["charger_limit"]["config"]["control"], CONTROL)
        self.assertEqual(out["charger_limit"]["last_attempt"]["reason"]["key"], cl.REASONS["power"])
        self.assertEqual(out["charger_limit"]["state"]["failed"], self.cl.state["failed"])
        out = await diagnostics.async_get_config_entry_diagnostics(hass, SimpleNamespace(unique_id="other"))
        self.assertIsNone(out["charger_limit"])


class AlertFlagTests(Base):
    """What the alerts read from the limit: stopped on purpose, about to stop, and whether it will tell the phones itself."""

    def test_the_title_reads_as_the_reached_target_message(self):
        self.assertEqual(cl.ACTIVITY["stopped"][0], "Charging reached target · {0}%")

    async def test_nothing_is_held_before_the_target(self):
        await self.tick(0)
        self.assertEqual((self.cl.holds(), self.cl.stopping(), self.cl.delivers()), (False, False, True))

    async def test_about_to_stop_and_then_stopped(self):
        self.world.soc = 80.0
        await self.tick(0)
        self.assertFalse(self.cl.holds())
        self.assertTrue(self.cl.stopping(), "the hold time is running: the limit will send its own message")
        await self.tick(cl.HOLD + 1)
        self.assertTrue(self.cl.holds())
        self.assertTrue(self.cl.stopping())

    async def test_a_pending_release_still_counts_as_stopped(self):
        await self.reach()
        self.cl.state.update(engaged=False, release_pending=True)
        self.assertTrue(self.cl.holds())

    async def test_dry_run_paused_and_off_never_hold_the_alerts(self):
        self.cl.config["mode"] = "dry"
        self.world.soc = 80.0
        await self.tick(0)
        await self.tick(cl.HOLD + 1)
        self.assertEqual((self.cl.holds(), self.cl.stopping()), (False, False))
        self.cl.config["mode"] = "live"
        self.cl.state.update(dry_done=False, manual=True)
        self.assertFalse(self.cl.stopping(), "the owner restarted the charger: the limit stands back")

    async def test_no_phone_means_the_limit_cannot_deliver(self):
        self.engine.config = {"enabled": True, "rules": [{"enabled": True, "devices": []}]}
        self.assertFalse(self.cl.delivers())
        self.engine.config = {"enabled": False, "rules": [{"enabled": True, "devices": ["notify.mobile_app_phone"]}]}
        self.assertFalse(self.cl.delivers())
        self.engine.config = {"enabled": True, "rules": [{"enabled": True, "devices": ["notify.mobile_app_phone"]}]}
        self.assertTrue(self.cl.delivers())


class QuietHoursTests(Base):
    async def test_the_stop_message_is_passive_and_silent_inside_quiet_hours(self):
        self.engine.quiet = True
        await self.reach()
        self.assertEqual(len(self.engine.sent), 1, "still sent: the stop already happened")
        data = self.engine.sent[0][1]["data"]
        self.assertEqual(data["push"], {"interruption-level": "passive", "sound": "none"})
        self.assertEqual(data["channel"], "Deepal Companion Silent")
        self.assertEqual(data["group"], "deepal_companion_charger")

    async def test_the_stop_message_is_normal_outside_quiet_hours(self):
        await self.reach()
        self.assertNotIn("push", self.engine.sent[0][1]["data"])

    async def test_a_failure_stays_loud_inside_quiet_hours(self):
        self.engine.quiet = True
        self.world.fail = 99
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        self.assertNotIn("push", self.engine.sent[-1][1]["data"])

    async def test_other_calm_messages_are_silent_too(self):
        self.engine.quiet = True
        await self.reach()
        await self.tick(cl.EXPECT + 10)
        self.world.control = "unlocked"
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "paused")
        self.assertEqual(self.engine.sent[-1][1]["data"]["push"]["interruption-level"], "passive")


class HealthTests(Base):
    def test_off_is_not_listed(self):
        self.cl.config["mode"] = "off"
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl), [])

    def test_ready_and_unavailable(self):
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok")
        self.world.control = "unavailable"
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "warning")


def fake_hass(*entries):
    """Home Assistant states for the lists: each entry is (entity_id, friendly name or None, device_class or None)."""
    states = [SimpleNamespace(entity_id=e, state="off", attributes={k: v for k, v in (("friendly_name", n), ("device_class", d)) if v})
              for e, n, d in entries]
    return SimpleNamespace(states=SimpleNamespace(async_all=lambda: states))


def energy(entity_id, name):
    return {"entity_id": entity_id, "name": name, "device_class": "energy"}


def power(entity_id, name):
    return {"entity_id": entity_id, "name": name, "device_class": "power"}


class UnitTests(unittest.TestCase):
    def test_units_are_converted_and_an_unknown_one_is_not_guessed(self):
        def at(value, unit):
            return cl.scaled(st(value, {"unit_of_measurement": unit} if unit is not None else {}), cl.POWER_UNITS)
        self.assertEqual(at("7.2", "kW"), 7200.0)
        self.assertEqual(at("7200", "W"), 7200.0)
        self.assertEqual(at("7200", None), 7200.0, "no unit counts as W")
        self.assertEqual(at("0.0072", "MW"), 7200.0, "MW is megawatt")
        self.assertEqual(at("7200000", "mW"), 7200.0, "mW is milliwatt")
        self.assertIsNone(at("7.2", "BTU/h"), "an unknown unit is unreadable, not watts")
        self.assertEqual(cl.scaled(st("1.5", {"unit_of_measurement": "MWh"}), cl.ENERGY_UNITS), 1500.0)
        self.assertEqual(cl.scaled(st("1500", {"unit_of_measurement": "Wh"}), cl.ENERGY_UNITS), 1.5)
        self.assertIsNone(cl.scaled(st("12", {"unit_of_measurement": "%"}), cl.ENERGY_UNITS))


class StaleReportHealthTests(Base):
    async def test_a_charging_car_with_an_old_report_is_explained_in_health(self):
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok")
        self.world.soc = 80.0
        await self.tick(0)
        self.world.report = self.now - cl.FRESH - 600  # the car's own report is old while the battery value is still there
        check = health.charger_limit_checks(self.cl)[0]
        self.assertEqual(check["status"], "warning")
        self.assertIn("last report is 40 minutes old", str(check))
        self.assertIn("sensor.last_updated", check["fix"])


class EnergyTotalHealthTests(Base):
    def put(self, entity, **attrs):
        original = self.world.get
        self.world.get = lambda e: st("15342.7", {"unit_of_measurement": "kWh", **attrs}) if e == entity else original(e)

    def test_a_hand_picked_lifetime_total_is_a_health_warning(self):
        health = importlib.import_module("dcpkg.health")
        self.cl.config["energy"] = "sensor.wallbox_energy"
        self.put("sensor.wallbox_energy", state_class="total_increasing")
        check = health.charger_limit_checks(self.cl)[0]
        self.assertEqual(check["status"], "warning")
        self.assertIn("lifetime total", str(check))

    def test_a_total_by_name_warns_and_a_session_sensor_does_not(self):
        health = importlib.import_module("dcpkg.health")
        self.cl.config["energy"] = "sensor.wallbox_forward_energy_total"
        self.put("sensor.wallbox_forward_energy_total")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "warning")
        self.cl.config["energy"] = "sensor.wallbox_charge_energy_once"
        self.put("sensor.wallbox_charge_energy_once", friendly_name="Charge Energy Once")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok")


class SessionEnergyTests(unittest.TestCase):
    def test_a_session_name_wins_over_totals(self):
        found = cl.classify([energy("sensor.v2c_forward_energy_total", "Forward Energy Total"),
                             energy("sensor.v2c_charge_energy_once", "Charge Energy Once")])
        self.assertEqual(found["energy"], "sensor.v2c_charge_energy_once")

    def test_a_single_energy_sensor_is_used_unless_it_is_a_total(self):
        self.assertEqual(cl.classify([energy("sensor.wb_energy", "Energy")])["energy"], "sensor.wb_energy")
        self.assertIsNone(cl.classify([energy("sensor.v2c_forward_energy_total", "Forward Energy Total")])["energy"],
                          "one total only: a total would show a wrong 'kWh this charge'")

    def test_several_sensors_prefer_one_that_is_not_a_total(self):
        found = cl.classify([energy("sensor.wb_energy_total", "Energy Total"),
                             energy("sensor.wb_energy_daily", "Energy Daily"),
                             energy("sensor.wb_energy_lifetime", "Lifetime")])
        self.assertEqual(found["energy"], "sensor.wb_energy_daily")

    def test_only_totals_leave_the_energy_sensor_empty(self):
        found = cl.classify([energy("sensor.a_energy_total", "Energy Total"),
                             energy("sensor.b_energy_import", "Grid import")])
        self.assertIsNone(found["energy"])

    def test_no_energy_sensor_is_none(self):
        self.assertIsNone(cl.classify([])["energy"])


class PowerSensorChoiceTests(unittest.TestCase):
    def test_a_total_power_sensor_is_preferred_over_the_phases(self):
        found = cl.classify([power("sensor.wb_power_l1", "Power L1"), power("sensor.wb_power_total", "Total power"),
                             power("sensor.wb_power_l2", "Power L2")])
        self.assertEqual(found["power"], "sensor.wb_power_total")

    def test_without_a_total_the_first_power_sensor_is_kept(self):
        found = cl.classify([power("sensor.wb_power_l1", "Power L1"), power("sensor.wb_power_l2", "Power L2")])
        self.assertEqual(found["power"], "sensor.wb_power_l1")


class DeviceAutoMapTests(Base):
    async def test_picking_a_charger_maps_its_power_and_energy_sensors(self):
        entries = [{"entity_id": "switch.wb_pause", "name": "Pause", "device_class": ""},
                   power("sensor.wb_power_total", "Total power"), energy("sensor.wb_energy_total", "Energy total"),
                   energy("sensor.wb_energy_once", "Charge energy once")]
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: entries):
            await self.cl.save({"device_id": "dev-new"})
        self.assertEqual(self.cl.config["power"], "sensor.wb_power_total")
        self.assertEqual(self.cl.config["energy"], "sensor.wb_energy_once")
        self.assertEqual(self.cl.config["control"], "switch.wb_pause")


class ChoiceListTests(unittest.TestCase):
    def setUp(self):
        self.hass = fake_hass(("switch.garage_pump", "Pump", None), ("lock.door", None, None),
                              ("input_boolean.charge_stop", "Stop charging", None), ("light.lamp", "Lamp", None),
                              ("sensor.forward_energy_total", "Forward energy", "energy"), ("sensor.power_total", "Power Total", "power"),
                              ("sensor.temperature", "Temp", "temperature"))
        runtime = SimpleNamespace(hass=self.hass, config={"prefix": "s05", "entities": {}}, hub=None, vehicle="car", notifications=None, preconditioning=None)
        self.ctl = cl.ChargerLimit(runtime)

    def test_every_lock_switch_and_input_boolean_is_listed_sorted_by_name(self):
        self.assertEqual(cl.controls(self.hass), [{"entity": "lock.door", "name": "lock.door", "fit": False},
                                                  {"entity": "switch.garage_pump", "name": "Pump", "fit": False},
                                                  {"entity": "input_boolean.charge_stop", "name": "Stop charging", "fit": True}])

    def test_the_power_and_energy_lists_hold_only_their_device_class(self):
        choices = self.ctl.choices()
        self.assertEqual(choices["power_sensors"], [{"entity": "sensor.power_total", "name": "Power Total", "fit": True}])
        self.assertEqual(choices["energy_sensors"], [{"entity": "sensor.forward_energy_total", "name": "Forward energy"}])
        self.assertEqual(len(choices["all_controls"]), 3)


class EnergyValidateTests(unittest.TestCase):
    def test_energy_is_optional_and_must_be_a_sensor(self):
        self.assertIsNone(cl.validate({"mode": "off"})["energy"], "a saved config without the key keeps working")
        self.assertEqual(cl.validate({"energy": "sensor.v2c_once"})["energy"], "sensor.v2c_once")
        self.assertIsNone(cl.validate({"energy": ""})["energy"])
        with self.assertRaises(ValueError):
            cl.validate({"energy": "switch.not_energy"})

    def test_an_input_boolean_can_be_the_stop_control_and_other_domains_cannot(self):
        self.assertEqual(cl.validate({"mode": "live", "control": "input_boolean.charge_stop"})["control"], "input_boolean.charge_stop")
        with self.assertRaises(ValueError):
            cl.validate({"control": "light.lamp"})


class UnitBase(Base):
    def reading(self, value, unit=None, entity="sensor.charger_power"):
        attrs = {"unit_of_measurement": unit} if unit else {}
        self.world.get = lambda e: st(value, attrs) if e == entity else World.get(self.world, e)


class PowerUnitTests(UnitBase):
    async def test_kw_and_mw_are_converted_to_watts_and_no_unit_counts_as_watts(self):
        for value, unit, watts in (("7.2", "kW", 7200.0), ("7200000", "mW", 7200.0), ("7200", "W", 7200.0), ("7200", None, 7200.0)):
            self.reading(value, unit)
            self.assertAlmostEqual(self.cl.power(), watts, msg="%s %s" % (value, unit))
        self.reading("unavailable", "kW")
        self.assertIsNone(self.cl.power())

    async def test_a_kw_reading_below_the_idle_level_confirms_the_stop(self):
        self.reading("0.03", "kW")
        self.world.get = self._after_stop("0.03", "kW")
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped", "30 W is below the 50 W idle level")

    async def test_a_kw_reading_above_the_idle_level_does_not_confirm_the_stop(self):
        self.world.get = self._after_stop("0.06", "kW")
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed", "60 W still charges, so the stop is not confirmed")

    def _after_stop(self, value, unit):
        def get(entity):
            if entity != "sensor.charger_power":
                return World.get(self.world, entity)
            return st(value if self.world.stopped() else "7.2", {"unit_of_measurement": unit})
        return get


class EnergyReadingTests(UnitBase):
    def test_wh_and_kwh_are_read_as_kwh(self):
        self.cl.config["energy"] = "sensor.charge_energy_once"
        for value, unit, kwh in (("12400", "Wh", 12.4), ("12.4", "kWh", 12.4), ("12.4", None, 12.4)):
            self.reading(value, unit, entity="sensor.charge_energy_once")
            self.assertAlmostEqual(self.cl.energy_kwh(), kwh, msg="%s %s" % (value, unit))

    def test_no_energy_sensor_means_no_reading(self):
        self.assertIsNone(self.cl.snapshot()["energy_kwh"])

    async def test_the_energy_stays_on_the_card_after_the_limit_stops_the_charger(self):
        self.cl.config["energy"] = "sensor.charge_energy_once"
        energy = {"value": "12.4", "unit": "kWh"}

        def get(entity):
            if entity == "sensor.charge_energy_once":
                return st(energy["value"], {"unit_of_measurement": energy["unit"]}) if energy["value"] else None
            return World.get(self.world, entity)
        self.world.get = get
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped")
        energy["value"] = None  # the sensor goes unavailable while the charger is held
        self.assertAlmostEqual(self.cl.snapshot()["energy_kwh"], 12.4)
        self.world.plugged = False
        await self.tick(0)
        self.assertIsNone(self.cl.snapshot()["energy_kwh"], "the next plug-in starts a new reading")


class DeviceChoiceTests(Base):
    async def test_choosing_the_device_fills_power_and_energy_and_both_can_be_cleared(self):
        found = {"control": CONTROL, "on_stops": True, "sure": True, "power": "sensor.charger_power", "energy": "sensor.charge_energy_once"}
        with mock.patch.object(cl, "discover", lambda hass, device_id, exclude_entities=(): {**found, "device_id": device_id}):
            await self.cl.save({"device_id": "dev-a"})
        self.assertEqual(self.cl.config["energy"], "sensor.charge_energy_once")
        self.assertEqual(self.cl.config["power"], "sensor.charger_power")
        await self.cl.save({"energy": None})
        self.assertIsNone(self.cl.config["energy"])
        self.assertEqual(self.cl.config["power"], "sensor.charger_power", "clearing one does not touch the other")
        with self.assertRaises(ValueError):
            await self.cl.save({"energy": "switch.not_energy"})


class DeviceChangeTests(Base):
    """Changing the charger: only the stop control and its direction are re-found for the new device. The power and energy
    sensors are set when the new device offers one, cleared only when they belong to the old charger, else kept."""

    def setUp(self):
        super().setUp()
        self.cl.config["device_id"] = "dev-old"
        self.devices = {"sensor.hand_power": "dev-other", "sensor.hand_energy": "dev-other", "sensor.charger_power": "dev-old"}

    def found(self, **found):
        base = {"control": None, "on_stops": True, "sure": True, "power": None, "energy": None}
        base.update(found)
        return mock.patch.object(cl, "discover", lambda hass, device_id, exclude_entities=(): {**base, "device_id": device_id})

    def belongs(self):
        return mock.patch.object(cl, "entity_device", lambda hass, entity_id: self.devices.get(entity_id))

    async def test_choosing_the_car_device_is_refused_with_a_plain_message(self):
        entries = [{"entity_id": "lock.s05_doors", "name": "Doors", "device_class": ""}, {"entity_id": "sensor.s05_battery_level", "name": "Battery", "device_class": "battery"}]
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: entries):
            with self.assertRaisesRegex(ValueError, "This is the car, choose the charger."):
                cl.discover(None, "dev-car", {"lock.s05_doors"})
            self.assertEqual(cl.discover(None, "dev-car")["control"], "lock.s05_doors", "without an exclusion list nothing is refused")
            before = deepcopy(self.cl.config)
            with self.assertRaisesRegex(ValueError, "This is the car, choose the charger."):
                await self.cl.save({"device_id": "dev-car"})
        self.assertEqual(self.cl.config, before, "the saved charger is unchanged")

    async def test_a_direction_guessed_from_the_names_is_flagged_until_the_owner_chooses_it(self):
        self.assertFalse(self.cl.snapshot()["control_guess"])
        with self.found(control="switch.new_pause", on_stops=True, sure=False), self.belongs():
            snap = await self.cl.save({"device_id": "dev-new"})
        self.assertTrue(snap["control_guess"], "the guess is shown to the owner")
        self.assertTrue(self.cl.state["control_guess"])
        snap = await self.cl.save({"on_stops": False})
        self.assertFalse(snap["control_guess"], "choosing the direction ends the guess")
        with self.found(control="lock.sure_one", on_stops=True, sure=True), self.belongs():
            self.assertFalse((await self.cl.save({"device_id": "dev-other"}))["control_guess"])

    async def test_a_hand_picked_power_and_energy_from_another_device_are_kept(self):
        self.cl.config.update(power="sensor.hand_power", energy="sensor.hand_energy")
        with self.found(control="lock.new_lock"), self.belongs():
            await self.cl.save({"device_id": "dev-new"})
        self.assertEqual(self.cl.config["power"], "sensor.hand_power")
        self.assertEqual(self.cl.config["energy"], "sensor.hand_energy")
        self.assertEqual(self.cl.config["control"], "lock.new_lock")

    async def test_an_auto_mapped_sensor_of_the_old_charger_is_cleared_when_the_new_one_has_none(self):
        self.cl.config.update(power="sensor.charger_power", energy="sensor.charge_energy_once")
        self.devices["sensor.charge_energy_once"] = "dev-old"
        with self.found(control="lock.new_lock"), self.belongs():
            await self.cl.save({"device_id": "dev-new"})
        self.assertIsNone(self.cl.config["power"], "it belonged to the old charger")
        self.assertIsNone(self.cl.config["energy"], "it belonged to the old charger")

    async def test_the_new_chargers_own_sensors_replace_the_old_ones(self):
        self.cl.config.update(power="sensor.charger_power", energy="sensor.charge_energy_once")
        with self.found(control="lock.new_lock", power="sensor.new_power", energy="sensor.new_energy"), self.belongs():
            await self.cl.save({"device_id": "dev-new"})
        self.assertEqual(self.cl.config["power"], "sensor.new_power")
        self.assertEqual(self.cl.config["energy"], "sensor.new_energy")

    async def test_the_control_and_its_direction_are_reset_and_mode_stays_when_the_new_device_has_one(self):
        self.assertEqual(self.cl.config["mode"], "live")
        with self.found(control="switch.new_pause", on_stops=False), self.belongs():
            await self.cl.save({"device_id": "dev-new"})
        self.assertEqual(self.cl.config["control"], "switch.new_pause")
        self.assertFalse(self.cl.config["on_stops"])
        self.assertEqual(self.cl.config["mode"], "live")

    async def test_a_new_device_without_a_control_keeps_the_mode_off(self):
        with self.found(control=None), self.belongs():
            await self.cl.save({"device_id": "dev-new"})
        self.assertIsNone(self.cl.config["control"])
        self.assertEqual(self.cl.config["mode"], "off", "validate: a mode needs a control")


class ReleasePendingTests(Base):
    async def test_unplug_with_a_failing_release_then_replug_releases_it_and_clears_the_flag(self):
        await self.reach()
        self.world.fail = cl.MAX_ATTEMPTS  # every release attempt fails
        self.world.plugged = False
        await self.tick(5)
        self.assertTrue(self.cl.state["release_pending"])
        self.assertEqual(self.world.control, "locked", "the stop is still on")
        self.assertFalse(self.cl.state["engaged"])
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "warning")
        self.assertIn("could not be released", str(health.charger_limit_checks(self.cl)[0]))
        self.world.plugged = True
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")
        self.assertFalse(self.cl.state["release_pending"])
        self.assertIsNone(self.cl.state["release_config"])

    async def test_a_pending_release_survives_a_new_instance(self):
        await self.reach()
        self.store["charger_limit_config"] = deepcopy(self.cl.config)  # saved settings, as the real save() keeps them
        self.world.fail = cl.MAX_ATTEMPTS
        self.world.plugged = False
        await self.tick(5)
        again = cl.ChargerLimit(self.runtime, clock=lambda: self.now, sleep=self.cl.sleep, call=self.world.call)
        await again.load()
        self.assertTrue(again.state["release_pending"])
        self.assertEqual(again.state["release_config"]["control"], CONTROL)
        self.assertEqual(again.config["control"], CONTROL)

    async def test_a_state_saved_without_the_new_keys_loads_with_defaults(self):
        self.store["charger_limit_state"] = {"engaged": False, "manual": False}
        again = cl.ChargerLimit(self.runtime, clock=lambda: self.now, sleep=self.cl.sleep, call=self.world.call)
        await again.load()
        self.assertFalse(again.state["release_pending"])
        self.assertIsNone(again.state["plugged_unknown_since"])

    async def test_resume_releases_a_pending_release(self):
        await self.reach()
        self.world.fail = cl.MAX_ATTEMPTS
        await self.cl.release("unplugged")
        self.assertTrue(self.cl.state["release_pending"])
        self.assertEqual(self.world.control, "locked")
        self.world.fail = 0
        await self.cl.resume()
        self.assertEqual(self.world.control, "unlocked")
        self.assertFalse(self.cl.state["release_pending"])
        self.assertEqual(self.cl.phase(), "paused")

    async def test_charge_anyway_with_a_release_that_fails_keeps_trying_until_it_works(self):
        await self.reach()
        self.world.fail = 2 * cl.MAX_ATTEMPTS  # the release inside "Charge anyway" fails too
        await self.cl.resume()
        self.assertTrue(self.cl.state["release_pending"])
        self.assertEqual(self.world.control, "locked")
        self.world.fail = 0
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked", "retried although the owner chose Charge anyway")
        self.assertFalse(self.cl.state["release_pending"])
        self.assertEqual(self.cl.phase(), "paused", "and the limit stays out of the way for this plug-in")
        await self.tick(cl.HOLD + 60)
        self.assertEqual(self.world.control, "unlocked")

    async def test_a_manual_restart_never_triggers_a_release_send(self):
        await self.reach()
        self.cl.state.update(engaged=False, manual=True, release_pending=True,
                             release_config={"control": CONTROL, "on_stops": True})
        self.world.control = "locked"  # the owner stopped it by hand
        before = len(self.world.calls)
        await self.tick(900)
        self.assertEqual(len(self.world.calls), before, "a manual state is never answered with a release")

    async def test_a_control_that_cannot_be_read_stays_pending_without_a_send(self):
        await self.reach()
        self.world.control = "unavailable"
        self.world.plugged = False
        before = len(self.world.calls)
        await self.tick(5)
        self.assertTrue(self.cl.state["release_pending"])
        self.assertEqual(len(self.world.calls), before)


class StopSavedFirstTests(Base):
    async def test_the_stop_is_saved_before_the_command_is_sent(self):
        seen = []

        async def call(domain, service, data):
            seen.append(deepcopy(self.store["charger_limit_state"]))
            raise RuntimeError("Home Assistant stopped")
        self.cl.call = call
        await self.reach()
        self.assertEqual(len(seen), cl.MAX_ATTEMPTS)
        self.assertTrue(all(s["engaged"] for s in seen), "saved as engaged before every command")
        self.assertGreater(seen[0]["expect_until"], 0)
        self.assertEqual(self.cl.phase(), "failed")
        self.assertFalse(self.cl.state["engaged"], "confirmed not stopped, so nothing stays engaged")

    async def test_a_command_that_stopped_the_charger_before_failing_keeps_the_stop_engaged(self):
        calls = {"n": 0}
        real = self.world.call

        async def flaky(domain, service, data):
            calls["n"] += 1
            if calls["n"] == 1:
                self.world.control = "locked"  # the charger stopped, but the answer was lost
                raise RuntimeError("timeout")
            await real(domain, service, data)
        self.cl.call = flaky
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped")
        self.assertTrue(self.cl.state["engaged"])
        self.assertFalse(self.cl.state["release_pending"])


class PlugUnknownTests(Base):
    async def test_plug_unknown_for_a_long_time_while_engaged_reports_unavailable_and_does_nothing(self):
        await self.reach()
        self.world.plugged = None
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "stopped", "short unknown spells are not reported")
        await self.tick(cl.PLUG_UNKNOWN + 5)
        self.assertEqual(self.cl.phase(), "unavailable")
        self.assertEqual(self.world.control, "locked", "nothing destructive happens")
        self.assertTrue(self.cl.state["engaged"])
        health = importlib.import_module("dcpkg.health")
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "warning")
        self.world.plugged = True
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "stopped")
        self.assertIsNone(self.cl.state["plugged_unknown_since"])


    async def test_a_plug_sensor_that_never_answers_is_a_health_warning_even_when_nothing_is_engaged(self):
        health = importlib.import_module("dcpkg.health")
        self.world.plugged = None
        await self.tick(5)
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok", "a short unknown spell is not reported")
        await self.tick(cl.PLUG_UNKNOWN + 5)
        check = health.charger_limit_checks(self.cl)[0]
        self.assertEqual(check["status"], "warning")
        self.assertIn("plug sensor", str(check))
        self.world.plugged = True
        await self.tick(5)
        self.assertEqual(health.charger_limit_checks(self.cl)[0]["status"], "ok")


class OwnLockTests(Base):
    async def test_the_car_own_lock_is_not_offered_as_a_control(self):
        self.cl.hass = fake_hass(("lock.s05_doors", "Doors", None), ("lock.garage_charger_lock", "Charger", None))
        self.assertEqual([c["entity"] for c in self.cl.choices()["all_controls"]], ["lock.garage_charger_lock"])

    async def test_validate_and_save_refuse_the_car_own_lock(self):
        with self.assertRaisesRegex(ValueError, "This is the car's own lock, choose the charger."):
            cl.validate({"mode": "live", "control": "lock.s05_doors"}, {"lock.s05_doors"})
        with self.assertRaisesRegex(ValueError, "car's own lock"):
            await self.cl.save({"control": "lock.s05_doors", "mode": "live"})
        self.assertEqual(self.cl.config["control"], CONTROL, "the saved charger is unchanged")

    async def test_a_saved_car_lock_is_dropped_on_load(self):
        self.store["charger_limit_config"] = {"mode": "live", "control": "lock.s05_doors", "on_stops": True}
        again = cl.ChargerLimit(self.runtime, clock=lambda: self.now, sleep=self.cl.sleep, call=self.world.call)
        await again.load()
        self.assertEqual(again.config["mode"], "off")
        self.assertIsNone(again.config["control"])


class SaveWaitsTests(Base):
    async def test_saving_new_settings_waits_for_a_stop_that_is_still_being_confirmed(self):
        await self.reach()
        await self.cl.lock.acquire()
        task = asyncio.ensure_future(self.cl.save({"mode": "dry"}))
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        self.assertFalse(task.done(), "save waits for the lock")
        self.assertEqual(self.world.control, "locked")
        self.cl.lock.release()
        await task
        self.assertEqual(self.world.control, "unlocked")
        self.assertEqual(self.cl.config["mode"], "dry")


class FullTargetTests(Base):
    async def test_a_target_of_100_never_calls_the_charger(self):
        self.runtime.config["charge_target"] = 100
        self.world.soc = 100.0
        await self.tick(0)
        await self.tick(cl.HOLD + 1)
        self.assertEqual(self.world.calls, [])
        self.assertEqual(self.cl.phase(), "no_target")
        self.assertEqual(self.cl.snapshot()["target"], 100, "the saved value is shown as it is")
        health = importlib.import_module("dcpkg.health")
        self.assertIn("A limit at 100% does nothing, choose a lower target.", str(health.charger_limit_checks(self.cl)[0]))

    async def test_the_snapshot_says_when_the_target_is_100_so_the_pages_can_word_it(self):
        self.assertFalse(self.cl.snapshot()["target_full"])
        self.runtime.config["charge_target"] = 100
        self.assertTrue(self.cl.snapshot()["target_full"])
        self.runtime.config["charge_target"] = 0
        self.assertFalse(self.cl.snapshot()["target_full"], "no target is not the same as 100 %")

    async def test_raising_the_target_to_100_releases_an_engaged_stop(self):
        await self.reach()
        self.assertTrue(self.cl.state["engaged"])
        self.runtime.config["charge_target"] = 100
        await self.tick(5)
        self.assertEqual(self.world.control, "unlocked")
        self.assertFalse(self.cl.state["engaged"])
        self.assertEqual(self.cl.phase(), "no_target")


def rule(enabled, *devices):
    return {"id": "r%d" % len(devices), "enabled": enabled, "devices": list(devices)}


class RecipientTests(Base):
    """Charger messages go to the phones of the enabled alert rules, plus Live climate, each phone once."""

    async def say_and_sent(self, config):
        self.engine.config = {"enabled": True, **config}
        await self.cl.say("paused")
        return [device for device, _ in self.engine.sent]

    async def test_devices_of_two_enabled_rules_and_live_climate_are_each_told_once(self):
        sent = await self.say_and_sent({
            "rules": [rule(True, "notify.mobile_app_a", "notify.mobile_app_b"), rule(True, "notify.mobile_app_c")],
            "live_climate": {"devices": ["notify.mobile_app_d"]}})
        self.assertEqual(sent, ["notify.mobile_app_a", "notify.mobile_app_b", "notify.mobile_app_c", "notify.mobile_app_d"])

    async def test_a_disabled_rule_device_is_not_told(self):
        sent = await self.say_and_sent({
            "rules": [rule(True, "notify.mobile_app_a"), rule(False, "notify.mobile_app_x")],
            "live_climate": {"devices": []}})
        self.assertEqual(sent, ["notify.mobile_app_a"])

    async def test_the_master_switch_off_sends_nothing_but_still_records_the_activity(self):
        self.engine.config = {"enabled": False, "rules": [rule(True, "notify.mobile_app_a")],
                              "live_climate": {"devices": ["notify.mobile_app_d"]}}
        await self.cl.say("paused")
        self.assertEqual(self.engine.sent, [])
        self.assertEqual(self.engine.records[-1][0], "charger_limit")
        self.assertEqual(self.engine.records[-1][1], "charger_limit")

    async def test_duplicates_across_rules_and_live_climate_collapse_in_order(self):
        sent = await self.say_and_sent({
            "rules": [rule(True, "notify.mobile_app_a", "notify.mobile_app_b"), rule(True, "notify.mobile_app_b", "notify.mobile_app_a")],
            "live_climate": {"devices": ["notify.mobile_app_a"]}})
        self.assertEqual(sent, ["notify.mobile_app_a", "notify.mobile_app_b"])

    async def test_no_enabled_rule_and_no_live_climate_sends_nothing_and_still_records(self):
        self.engine.config = {"enabled": True, "rules": [rule(False, "notify.mobile_app_a")]}
        await self.cl.say("paused")
        self.assertEqual(self.engine.sent, [])
        self.assertEqual(len(self.engine.records), 1)

    async def test_invalid_entries_are_skipped_and_the_total_is_capped_at_twenty(self):
        devices = ["notify.mobile_app_%02d" % n for n in range(25)]
        sent = await self.say_and_sent({
            "rules": [rule(True, "", "  ", None, 7, *devices)],
            "live_climate": {"devices": ["notify.mobile_app_live"]}})
        self.assertEqual(len(sent), cl.MAX_RECIPIENTS)
        self.assertEqual(sent, devices[:cl.MAX_RECIPIENTS])
        self.assertNotIn("", sent)


if __name__ == "__main__":
    unittest.main()


# -- a charger that takes commands (a Tuya Local "Toggle charging" select, or a Start and a Stop button) ------------------------------
SELECT = "select.feyree_toggle_charging"
STOP_BUTTON, START_BUTTON = "button.feyree_stop_charging", "button.feyree_start_charging"
OPTIONS = ["Start charging", "Stop charging", "Waiting for command"]


class CommandWorld(World):
    """The wallbox: its command entity never shows a stop (the select goes back to idle); only power and status do."""

    def __init__(self, test):
        super().__init__(test, "switch")
        self.running, self.sent = True, []

    def stopped(self):
        return not self.running

    def get(self, entity):
        if entity == SELECT:
            return st("Waiting for command", {"options": OPTIONS})
        if entity in (STOP_BUTTON, START_BUTTON):
            return st("unknown")
        if entity == "sensor.feyree_status":
            return st("charging" if self.running and self.car_charging else "plugged_in")
        if entity == "sensor.charger_power":
            return st(str(self.power() / 1000), {"unit_of_measurement": "kW"})
        return World.get(self, entity)

    async def call(self, domain, service, data):
        self.sent.append((domain, service, data.get("option") or data["entity_id"]))
        if self.fail:
            self.fail -= 1
            raise RuntimeError("charger offline")
        if self.stuck:
            return
        if domain == "select":
            self.running = data["option"] == "Start charging"
        elif domain == "button":
            self.running = data["entity_id"] == START_BUTTON


class CommandBase(Base):
    control = {"control": SELECT, "stop_option": "Stop charging", "start_option": "Start charging"}

    def setUp(self):
        super().setUp()
        self.world = CommandWorld(self)
        self.runtime.hass.states = self.world
        self.cl.call = self.world.call
        self.cl.config = cl.validate({"mode": "live", "profile": "feyree", "power": "sensor.charger_power", "status": "sensor.feyree_status", **self.control})


class CommandSelectTests(CommandBase):
    async def test_stop_is_the_stop_option_and_is_confirmed_by_power_and_status(self):
        await self.reach()
        self.assertEqual(self.world.sent, [("select", "select_option", "Stop charging")])
        self.assertEqual(self.cl.phase(), "stopped", "the select itself still reads idle")

    async def test_the_limit_never_presses_start_on_its_own(self):
        await self.reach()
        for _ in range(6):
            await self.tick(600)
        self.assertEqual(self.world.sent, [("select", "select_option", "Stop charging")])

    async def test_a_stop_that_changes_nothing_fails_and_is_never_taken_for_stopped(self):
        self.world.stuck = True
        await self.reach()
        self.assertEqual(self.cl.phase(), "failed")
        self.assertEqual([c[2] for c in self.world.sent], ["Stop charging"] * cl.MAX_ATTEMPTS)

    async def test_without_a_power_sensor_the_status_alone_confirms(self):
        self.cl.config["power"] = None
        await self.reach()
        self.assertEqual(self.cl.phase(), "stopped")
        health = importlib.import_module("dcpkg.health")
        self.assertIn("status only", str(health.charger_limit_checks(self.cl)[0]))

    async def test_a_higher_target_releases_with_the_start_option(self):
        await self.reach()
        self.runtime.config["charge_target"] = 95
        await self.tick(5)
        self.assertEqual(self.world.sent[-1], ("select", "select_option", "Start charging"))
        self.assertTrue(self.world.running)
        self.assertFalse(self.cl.state["engaged"])

    async def test_charge_anyway_releases_too(self):
        await self.reach()
        await self.cl.resume()
        self.assertEqual(self.world.sent[-1][2], "Start charging")
        self.assertEqual(self.cl.phase(), "paused")

    async def test_start_that_errors_on_an_unplugged_car_counts_as_released(self):
        await self.reach()
        self.world.plugged, self.world.fail = False, cl.MAX_ATTEMPTS
        await self.tick(5)
        self.assertFalse(self.cl.state["release_pending"])
        self.assertFalse(self.cl.state["engaged"])

    async def test_start_that_errors_on_a_charging_car_stays_pending(self):
        await self.reach()
        self.runtime.config["charge_target"] = 95
        self.world.fail = cl.MAX_ATTEMPTS
        await self.tick(5)
        self.assertTrue(self.cl.state["release_pending"])

    async def test_the_owner_pressing_start_pauses_the_limit(self):
        await self.reach()
        await self.tick(cl.EXPECT + 10)
        self.world.running = True
        await self.tick(5)
        self.assertEqual(self.cl.phase(), "paused")
        self.assertEqual(self.world.sent, [("select", "select_option", "Stop charging")], "no Start from the limit")

    async def test_only_an_unavailable_select_is_unavailable(self):
        self.assertEqual(self.cl.phase(), "waiting")
        self.world.get = lambda e: st("unavailable") if e == SELECT else CommandWorld.get(self.world, e)
        self.assertEqual(self.cl.phase(), "unavailable")


class CommandButtonTests(CommandBase):
    control = {"control": STOP_BUTTON, "start_button": START_BUTTON}

    async def test_buttons_are_pressed_to_stop_and_to_release(self):
        await self.reach()
        self.assertEqual(self.world.sent, [("button", "press", STOP_BUTTON)])
        self.assertEqual(self.cl.phase(), "stopped", "a button reads unknown and is still available")
        await self.cl.resume()
        self.assertEqual(self.world.sent[-1], ("button", "press", START_BUTTON))


class CommandDiscoveryTests(unittest.TestCase):
    def test_option_words_in_several_languages_and_idle_words_are_ignored(self):
        self.assertEqual(cl.command_options(OPTIONS), ("Stop charging", "Start charging"))
        self.assertEqual(cl.command_options(["Διακοπή φόρτισης", "Έναρξη φόρτισης", "Αναμονή εντολής"]), ("Διακοπή φόρτισης", "Έναρξη φόρτισης"))
        self.assertEqual(cl.command_options(["Detener carga", "Iniciar carga", "Espera"]), ("Detener carga", "Iniciar carga"))
        self.assertEqual(cl.command_options(["Waiting", "Idle"]), (None, None))

    def test_the_device_is_found_by_domain_and_class_not_by_name(self):
        states = {SELECT: st("Waiting for command", {"options": OPTIONS}),
                  "sensor.feyree_status": st("charging", {"options": ["available", "plugged_in", "charging", "charged", "fault"], "device_class": "enum"}),
                  "sensor.feyree_energy": st("500", {"state_class": "total_increasing"}),
                  "sensor.feyree_session": st("2", {"state_class": "measurement"})}
        entries = [{"entity_id": SELECT, "name": "", "device_class": ""}, {"entity_id": STOP_BUTTON, "name": "Stop charging", "device_class": ""},
                   {"entity_id": "sensor.feyree_status", "name": "Status", "device_class": "enum"},
                   {"entity_id": "sensor.feyree_power", "name": "Power", "device_class": "power"},
                   {"entity_id": "sensor.feyree_energy", "name": "Energy", "device_class": "energy"},
                   {"entity_id": "sensor.feyree_session", "name": "Session energy", "device_class": "energy"}]
        found = cl.find_command(entries, states.get)
        self.assertEqual((found["control"], found["stop_option"], found["start_option"]), (SELECT, "Stop charging", "Start charging"))
        self.assertEqual((found["power"], found["status"], found["energy"]), ("sensor.feyree_power", "sensor.feyree_status", "sensor.feyree_session"))

    def test_a_button_pair_and_a_device_without_commands(self):
        entries = [{"entity_id": STOP_BUTTON, "name": "", "device_class": ""}, {"entity_id": START_BUTTON, "name": "", "device_class": ""},
                   {"entity_id": "button.feyree_clear_energy", "name": "Clear energy", "device_class": ""}]
        found = cl.find_command(entries, lambda e: None)
        self.assertEqual((found["control"], found["start_button"]), (STOP_BUTTON, START_BUTTON))
        self.assertIsNone(cl.find_command([{"entity_id": "switch.x", "name": "", "device_class": ""}], lambda e: None))

    def test_only_a_charging_status_counts_as_charging(self):
        self.assertTrue(cl.is_charging_value("charging"))
        for value in ("charged", "waiting_for_authorization", "not_charging", "plugged_in"):
            self.assertFalse(cl.is_charging_value(value), value)


class CommandValidateTests(unittest.TestCase):
    def test_old_saved_settings_load_unchanged_with_the_auto_profile(self):
        old = {"mode": "live", "device_id": "d1", "control": "lock.v2c", "on_stops": True, "power": "sensor.p", "energy": None}
        out = cl.validate(old)
        self.assertEqual({k: out[k] for k in old}, old)
        self.assertEqual((out["profile"], out["stop_option"], out["start_option"], out["start_button"], out["status"]), ("auto", None, None, None, None))

    def test_new_fields_are_checked_on_the_server(self):
        ok = cl.validate({"mode": "live", "profile": "feyree", "control": SELECT, "stop_option": "Stop charging", "start_option": "Start charging", "status": "sensor.s"})
        self.assertEqual((ok["profile"], ok["control"], ok["stop_option"]), ("feyree", SELECT, "Stop charging"))
        self.assertEqual(cl.validate({"profile": "other"})["profile"], "auto")
        for bad in ({"start_button": "switch.x"}, {"status": "button.x"}, {"stop_option": 5}, {"control": "light.lamp"}):
            with self.assertRaises(ValueError):
                cl.validate(bad)

    def test_a_car_entity_is_still_never_a_control(self):
        with self.assertRaises(ValueError):
            cl.validate({"control": SELECT}, forbidden={SELECT})


class CommandProfileSaveTests(CommandBase):
    ENTRIES = [{"entity_id": SELECT, "name": "Toggle charging", "device_class": ""}, {"entity_id": "sensor.charger_power", "name": "Power", "device_class": "power"},
               {"entity_id": "sensor.feyree_status", "name": "Status", "device_class": "enum"}]

    def setUp(self):
        super().setUp()
        self.cl.config = cl.validate({"mode": "off"})
        self.world.get = lambda e: st("charging", {"options": ["charging", "plugged_in"]}) if e == "sensor.feyree_status" else CommandWorld.get(self.world, e)

    async def test_choosing_feyree_fills_the_command_and_the_sensors(self):
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: self.ENTRIES):
            await self.cl.save({"device_id": "dev", "profile": "feyree"})
        cfg = self.cl.config
        self.assertEqual((cfg["profile"], cfg["control"], cfg["stop_option"], cfg["start_option"]), ("feyree", SELECT, "Stop charging", "Start charging"))
        self.assertEqual((cfg["power"], cfg["status"]), ("sensor.charger_power", "sensor.feyree_status"))
        self.assertEqual(self.cl.snapshot()["command"]["identified"], True)

    async def test_feyree_on_a_device_without_commands_is_refused_and_auto_goes_back(self):
        switch = {"entity_id": "switch.wb_pause", "name": "Pause", "device_class": ""}
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: [switch]):
            with self.assertRaises(ValueError):
                await self.cl.save({"device_id": "dev", "profile": "feyree"})
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: self.ENTRIES + [switch]):
            await self.cl.save({"device_id": "dev", "profile": "feyree"})
            await self.cl.save({"profile": "auto"})
        cfg = self.cl.config
        self.assertEqual((cfg["profile"], cfg["control"], cfg["stop_option"], cfg["status"]), ("auto", "switch.wb_pause", None, None))

    async def test_picking_a_select_from_choose_another_identifies_its_options(self):
        await self.cl.save({"control": SELECT})
        self.assertEqual((self.cl.config["profile"], self.cl.config["stop_option"], self.cl.config["start_option"]), ("feyree", "Stop charging", "Start charging"))
        await self.cl.save({"control": "lock.garage_charger_lock"})
        self.assertEqual((self.cl.config["profile"], self.cl.config["stop_option"]), ("auto", None))


# -- the pickers: only entities that look like a charger's, 'Show all' lists everything ------------------------------------------------
def fake_states(*entries):
    """(entity_id, friendly name, attributes) -> Home Assistant states for the pickers."""
    states = [SimpleNamespace(entity_id=e, state="off", attributes={"friendly_name": n, **(a or {})}) for e, n, a in entries]
    return SimpleNamespace(states=SimpleNamespace(async_all=lambda: states, get=lambda x: next((s for s in states if s.entity_id == x), None)))


class PickerFilterTests(unittest.TestCase):
    def test_a_control_fits_by_a_charger_word_in_any_language_and_never_a_child_lock(self):
        for entity, name in (("switch.wallbox_pause", "Pause"), ("lock.evse", "EVSE"), ("switch.cargador_garaje", "Cargador"),
                             ("switch.wb", "Ladegerät sperren"), ("switch.wb", "Blocco caricatore"), ("switch.wb", "Φορτιστής"),
                             ("select.tuya_ev_charger_toggle", "Toggle"), ("switch.feyree_relay", "Relay"), ("switch.smart_plug", "Plug"),
                             ("switch.garage", "Enchufe garaje"), ("button.wb_stop", "Stop charging")):
            self.assertTrue(cl.control_fits(entity, name), entity + " " + name)
        self.assertFalse(cl.control_fits("switch.wallbox_child_lock", "Child lock"))
        self.assertFalse(cl.control_fits("switch.wb", "Kindersicherung Ladegerät"))
        self.assertFalse(cl.control_fits("switch.garage_pump", "Pump"))
        self.assertFalse(cl.control_fits("light.wallbox_led", "Wallbox LED"), "only locks, switches, input_booleans, selects and buttons")
        self.assertTrue(cl.control_fits("switch.relay_1", "Relay 1 Garage V2C Trydan"), "the device name counts")

    def test_a_power_sensor_fits_unless_it_is_named_for_the_house_grid_or_solar(self):
        self.assertTrue(cl.power_fits("sensor.wallbox_power", "Power"))
        for entity, name in (("sensor.house_power", "House"), ("sensor.grid_import_power", "Grid"), ("sensor.solar_power", "Solar"),
                             ("sensor.inverter_ac_power", "Inverter")):
            self.assertFalse(cl.power_fits(entity, name), entity)
        self.assertTrue(cl.power_fits("sensor.home_wallbox_power", "Home wallbox"), "a charger word wins")

    def test_the_lists_carry_fit_and_keep_everything_for_show_all(self):
        hass = fake_states(("switch.wallbox_pause", "Wallbox pause", None), ("switch.wallbox_child_lock", "Wallbox child lock", None),
                           ("switch.garage_pump", "Pump", None), ("lock.s05_doors", "Doors", None),
                           ("sensor.wallbox_power", "Wallbox power", {"device_class": "power", "unit_of_measurement": "W"}),
                           ("sensor.grid_power", "Grid power", {"unit_of_measurement": "kW"}),
                           ("sensor.s05_power", "Car power", {"unit_of_measurement": "kW"}),
                           ("sensor.wallbox_current", "Current", {"unit_of_measurement": "A"}))
        ctl = cl.controls(hass, {"lock.s05_doors"})
        self.assertEqual({c["entity"]: c["fit"] for c in ctl}, {"switch.wallbox_pause": True, "switch.wallbox_child_lock": False, "switch.garage_pump": False},
                         "the car's own control is never listed, the others are listed with fit")
        power_list = cl.sensors(hass, "power", {"sensor.s05_power"})
        self.assertEqual({p["entity"]: p["fit"] for p in power_list}, {"sensor.wallbox_power": True, "sensor.grid_power": False, "sensor.s05_power": False},
                         "a unit alone makes a power sensor; the car's and the grid's are listed only under Show all")

    def test_a_child_lock_of_the_charger_device_is_not_fit_and_buttons_fit_by_their_command(self):
        runtime = SimpleNamespace(hass=fake_states(), config={"prefix": "s05", "entities": {}}, hub=None, vehicle="car", notifications=None, preconditioning=None)
        ctl = cl.ChargerLimit(runtime)
        entries = [{"entity_id": "lock.wb_lock", "name": "Charger lock", "device_class": ""},
                   {"entity_id": "switch.wb_child_lock", "name": "Child lock", "device_class": ""},
                   {"entity_id": "button.wb_start_charging", "name": "Start charging", "device_class": ""},
                   {"entity_id": "button.wb_restart", "name": "Reboot", "device_class": ""}]
        with mock.patch.object(cl, "device_entries", lambda hass, device_id: entries):
            self.assertEqual({e["entity"]: e["fit"] for e in ctl.entities_of("dev")}, {"lock.wb_lock": True, "switch.wb_child_lock": False, "button.wb_start_charging": True})
            self.assertEqual({e["entity"]: e["fit"] for e in ctl.entities_of("dev", "button")}, {"button.wb_start_charging": True, "button.wb_restart": False})


# -- 'Test stop': the real stop path, a report, then charging again; never a phone message, never the sticky failure ----------------------
class StopTestTests(Base):
    async def run_test(self):
        snap = self.cl.start_test()
        self.assertEqual(snap["test"]["last"]["result"], "running")
        await self.cl._test_task
        await asyncio.sleep(0)
        return self.cl.state["stop_test"]

    def assertQuiet(self):
        self.assertIsNone(self.cl.state["failed"], "a test never sets the sticky failure")
        self.assertEqual(self.engine.sent, [], "a test never sends a phone message")

    async def test_a_stop_that_works_reports_the_time_and_starts_charging_again(self):
        test = await self.run_test()
        self.assertEqual((test["result"], test["restarted"]), ("ok", True))
        self.assertEqual(test["took"], 0)
        self.assertEqual(self.world.calls, [("lock", "lock", CONTROL), ("lock", "unlock", CONTROL)])
        self.assertEqual(self.world.control, "unlocked")
        self.assertFalse(self.cl.state["release_pending"])
        self.assertFalse(self.cl.state["engaged"])
        self.assertQuiet()
        self.assertEqual(self.engine.records[-1][2]["title"], "Charger stop test: ok")
        self.assertEqual(self.engine.records[-1][2]["message"], "Stopped in 0 s. Charging restarted.")
        record = self.cl.diagnostics()["state"]["stop_test"]["record"]
        self.assertEqual((record["test"], record["result"], record["control"]), (True, "stopped", CONTROL), "the diagnostic record is kept")
        self.assertEqual(self.cl.snapshot()["test"]["last"]["result"], "ok")

    async def test_a_stop_that_changes_nothing_names_the_reason_and_does_not_send_again(self):
        self.world.stuck = True
        test = await self.run_test()
        self.assertEqual(test["result"], "failed")
        self.assertEqual(test["reason"], {"key": cl.REASONS["unchanged"], "args": [CONTROL, "unlocked"]})
        self.assertEqual(self.world.calls, [("lock", "lock", CONTROL)], "one command, then the extra watch; the control already allows charging")
        self.assertTrue(test["restarted"])
        self.assertQuiet()
        self.assertEqual(self.engine.records[-1][2]["title"], "Charger stop test: failed (The charger could not be stopped: %s did not change (reads unlocked))" % CONTROL)

    async def test_a_service_error_is_reported_without_the_long_watch(self):
        self.world.fail = 1
        start = self.now
        test = await self.run_test()
        self.assertEqual(test["reason"], {"key": cl.REASONS["error"], "args": ["charger offline"]})
        self.assertLess(self.now - start, cl.VERIFY, "no waiting after an error")
        self.assertQuiet()

    async def test_a_restart_that_fails_is_reported_and_kept_pending(self):
        real = self.world.call

        async def call(domain, service, data):
            if service == "unlock":
                self.world.calls.append((domain, service, data["entity_id"]))
                raise RuntimeError("charger offline")
            await real(domain, service, data)
        self.cl.call = call
        test = await self.run_test()
        self.assertEqual((test["result"], test["restarted"]), ("ok", False))
        self.assertTrue(self.cl.state["release_pending"], "Companion keeps trying to start the charger")
        self.assertEqual(self.engine.records[-1][2]["message"], "Stopped in 0 s. Charging could not be restarted. Companion will keep trying.")
        self.assertQuiet()
        self.cl.call = real
        await self.tick(cl.INTERVAL)
        self.assertFalse(self.cl.state["release_pending"])
        self.assertEqual(self.world.control, "unlocked")

    async def test_it_refuses_when_not_charging_busy_without_a_control_or_already_running(self):
        self.world.plugged = False
        with self.assertRaisesRegex(ValueError, "Plug in and start charging to test."):
            self.cl.start_test()
        self.world.plugged, self.world.car_charging = True, False
        with self.assertRaisesRegex(ValueError, "Plug in and start charging"):
            self.cl.start_test()
        self.assertEqual(self.cl.snapshot()["test"]["block"], "not_charging")
        self.world.car_charging = True
        self.cl._stopping = True
        with self.assertRaisesRegex(ValueError, "stopping the charger now"):
            self.cl.start_test()
        self.cl._stopping = False
        self.cl.state["engaged"] = True
        with self.assertRaisesRegex(ValueError, "stopping the charger now"):
            self.cl.start_test()
        self.cl.state["engaged"] = False
        self.assertIsNone(self.cl.test_block())
        self.cl.start_test()
        with self.assertRaisesRegex(ValueError, "already running"):
            self.cl.start_test()
        await self.cl._test_task
        self.cl.config["control"] = None
        self.assertEqual(self.cl.test_block(), "no_control")
        self.assertEqual(self.world.calls, [("lock", "lock", CONTROL), ("lock", "unlock", CONTROL)], "only the one test touched the charger")

    async def test_a_test_interrupted_by_a_restart_is_failed_and_charging_is_started_again(self):
        self.world.control = "locked"
        self.store["charger_limit_state"] = {"release_pending": True, "release_config": {"control": CONTROL, "on_stops": True},
                                             "stop_test": {"result": "running", "started": T0}}
        again = cl.ChargerLimit(self.runtime, clock=lambda: self.now, sleep=self.cl.sleep, call=self.world.call)
        again._listen = lambda: None
        await again.load()
        again.config = self.cl.config
        self.assertEqual(again.state["stop_test"]["result"], "failed")
        await again.evaluate()
        self.assertEqual(self.world.control, "unlocked")


class CommandStopTestTests(CommandBase):
    async def test_a_feyree_charger_is_stopped_and_started_with_its_options(self):
        self.cl.start_test()
        await self.cl._test_task
        self.assertEqual(self.world.sent, [("select", "select_option", "Stop charging"), ("select", "select_option", "Start charging")])
        self.assertEqual((self.cl.state["stop_test"]["result"], self.cl.state["stop_test"]["restarted"]), ("ok", True))
        self.assertEqual(self.engine.sent, [])
