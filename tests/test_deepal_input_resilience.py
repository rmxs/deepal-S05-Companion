"""Deepal Alternative input failures through the real archive worker, using explicit Home Assistant doubles.

T-04: unavailable inputs must not invent sessions; a charge already open keeps the last values for six hours, then closes.
T-06: malformed, negative and out-of-range battery readings must never produce impossible session values.
"""
import asyncio
import importlib
import math
import unittest

from test_lifecycle import integration  # noqa: F401  (installs the companion_lifecycle package and HA doubles)
from test_recorder_resilience import make_runtime

Charging = importlib.import_module("companion_lifecycle.charging")
T0 = 1_700_000_000
ROLES = {"batt": "sensor.battery", "charging": "sensor.charging", "ac": "sensor.ac", "cloud": "sensor.cloud"}
DEEPAL_ENTITIES = ("sensor.battery", "sensor.charging", "sensor.ac", "sensor.cloud")


async def tick(runtime, now):
    """Queue one snapshot exactly as the minute timer does, then wait until the worker has processed it."""
    runtime.queue.put_nowait((now, None, None, "", runtime.snapshot(now)))
    await runtime.queue.join()


class DeepalInputTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        async def db(method, *args):
            # Storage maintenance is outside this test; report "nothing more to do".
            return {"more": False} if method == "maintain_storage" else None
        self.runtime, self.states = make_runtime(db=db)
        self.runtime.config = {"powertrain": "ev", "prefix": "s05"}
        self.runtime.entities = dict(ROLES)
        self.runtime.engine = Charging.ChargingEngine()
        self.runtime.worker = asyncio.ensure_future(self.runtime._work())

    async def asyncTearDown(self):
        if not self.runtime.worker.done():
            self.runtime.queue.put_nowait(None)  # stop marker is never dropped
            await asyncio.wait_for(self.runtime.worker, 2)

    async def test_no_session_is_invented_while_deepal_inputs_are_unavailable(self):  # T-04a
        self.states.update({entity: "unavailable" for entity in DEEPAL_ENTITIES})
        for minute in range(30):
            await tick(self.runtime, T0 + minute * 60)
        self.assertIsNone(self.runtime.engine.state.get("session"))

    async def test_open_session_keeps_carried_values_during_a_short_outage(self):  # T-04b
        # An 'unavailable' Deepal entity is replaced by its last good value, so an open charge stays live while the
        # outage is shorter than six hours (charging.OFFLINE_LIMIT).
        self.states.update({"sensor.battery": "40", "sensor.ac": "16", "sensor.charging": "on", "sensor.cloud": "on"})
        await tick(self.runtime, T0)
        self.assertTrue(self.runtime.engine.state["session"]["live"])
        self.states.update({entity: "unavailable" for entity in DEEPAL_ENTITIES})
        for minute in range(1, 6 * 60):  # up to 5 h 59 min after the last good reading
            await tick(self.runtime, T0 + minute * 60)
        session = self.runtime.engine.state.get("session")
        self.assertIsNotNone(session, "Carried-over values keep the charge open for less than six hours")
        self.assertTrue(session["live"])

    async def test_open_session_closes_when_the_outage_reaches_six_hours(self):  # T-04b, owner decision 2026-11-15
        self.states.update({"sensor.battery": "40", "sensor.ac": "16", "sensor.charging": "on", "sensor.cloud": "on"})
        await tick(self.runtime, T0)
        self.states.update({entity: "unavailable" for entity in DEEPAL_ENTITIES})
        for minute in range(1, 6 * 60 + 2):  # through six hours of outage
            await tick(self.runtime, T0 + minute * 60)
        self.assertIsNone(self.runtime.engine.state.get("session"), "The charge is closed, not kept live indefinitely")
        # Nothing is invented afterwards, and the last known reading stays the end of the charge.
        for minute in range(6 * 60 + 2, 7 * 60):
            await tick(self.runtime, T0 + minute * 60)
        self.assertIsNone(self.runtime.engine.state.get("session"))

    async def test_expired_outage_without_an_open_charge_leaves_no_timer_behind(self):  # T-04b
        self.states.update({"sensor.battery": "40", "sensor.ac": "0", "sensor.charging": "off", "sensor.cloud": "on"})
        await tick(self.runtime, T0)
        self.assertIsNone(self.runtime.engine.state.get("session"))
        self.states.update({entity: "unavailable" for entity in DEEPAL_ENTITIES})
        for half_hour in range(1, 15):  # seven hours
            await tick(self.runtime, T0 + half_hour * 1800)
        self.assertNotIn("unknown_since", self.runtime.engine.state)

    async def test_charge_continues_when_the_car_returns_before_six_hours(self):  # T-04b
        self.states.update({"sensor.battery": "40", "sensor.ac": "16", "sensor.charging": "on", "sensor.cloud": "on"})
        await tick(self.runtime, T0)
        self.states.update({entity: "unavailable" for entity in DEEPAL_ENTITIES})
        for minute in range(1, 3 * 60):
            await tick(self.runtime, T0 + minute * 60)
        self.states.update({"sensor.battery": "55", "sensor.ac": "16", "sensor.charging": "on", "sensor.cloud": "on"})
        await tick(self.runtime, T0 + 3 * 3600)
        session = self.runtime.engine.state["session"]
        self.assertTrue(session["live"])
        self.assertEqual(session["to"], 55)

    async def test_malformed_battery_readings_never_produce_impossible_values(self):  # T-06
        self.states.update({"sensor.battery": "40", "sensor.ac": "16", "sensor.charging": "on", "sensor.cloud": "on"})
        await tick(self.runtime, T0)
        for index, value in enumerate(["abc", "-5", "150", "nan", "inf", "", "1e309"], start=1):
            self.states["sensor.battery"] = value
            await tick(self.runtime, T0 + index * 60)
        session = self.runtime.engine.state["session"]
        for key in ("from", "to", "kwh"):
            self.assertTrue(session[key] is None or (math.isfinite(session[key]) and session[key] >= 0), key)
        self.assertLessEqual(session["to"], 100)
        self.assertEqual(session["to"], 40, "Rejected readings must not move the charge level")
        self.assertEqual(session["kwh"], 0.0)
