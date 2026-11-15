"""Task ownership regression tests; HA interfaces are explicit doubles."""
import asyncio
import contextlib
import importlib
import threading
import types
import unittest

from test_lifecycle import module


class Entity:
    def __init__(self):
        self.writes = 0

    def async_write_ha_state(self):
        self.writes = getattr(self, "writes", 0) + 1


module("homeassistant.components.sensor", SensorEntity=Entity,
       SensorDeviceClass=types.SimpleNamespace(ENERGY="energy", MONETARY="monetary", ENUM="enum"),
       SensorStateClass=types.SimpleNamespace(TOTAL="total"))
import sys
sys.modules["homeassistant.helpers.device_registry"].DeviceInfo = lambda **kwargs: kwargs
Sensor = importlib.import_module("companion_lifecycle.sensor").CompanionSensor


async def wait_until(predicate, timeout):
    """Bounded poll: raises asyncio.TimeoutError instead of waiting forever."""
    async def poll():
        while not predicate():
            await asyncio.sleep(0.01)
    await asyncio.wait_for(poll(), timeout)


class SensorLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def sensor(self, fetch):
        async def summary():
            await fetch()
            return {"sessions": 0, "battery_kwh": 0, "cost": 0, "unpriced": 0}
        return self.sensor_with(summary)

    def sensor_with(self, summary):
        runtime = types.SimpleNamespace(vehicle="car", entry=types.SimpleNamespace(title="Car"), summary_values=summary)
        entity = Sensor(runtime, "sessions")
        entity.hass = types.SimpleNamespace(async_create_task=asyncio.create_task)
        return entity

    async def test_device_link_opens_companion_panel(self):
        async def fetch():
            return []
        self.assertEqual(self.sensor(fetch)._attr_device_info["configuration_url"], "homeassistant://deepal-companion")

    async def test_burst_notifications_share_one_task(self):
        count = 0
        async def fetch():
            nonlocal count
            count += 1
            await asyncio.sleep(0)
            return []
        entity = self.sensor(fetch)
        for _ in range(30):
            entity._changed("car")
        task = entity._update_task
        await task
        self.assertEqual(count, 1)
        self.assertEqual(entity.writes, 1)

    async def test_unload_cancels_pending_update_and_prevents_writes(self):
        entered = asyncio.Event()
        async def fetch():
            entered.set()
            await asyncio.Event().wait()
        entity = self.sensor(fetch)
        entity._changed("car")
        await entered.wait()
        await entity.async_will_remove_from_hass()
        entity._changed("car")
        self.assertIsNone(entity._update_task)
        self.assertEqual(getattr(entity, "writes", 0), 0)

    async def test_change_during_update_is_coalesced(self):
        entered, release = asyncio.Event(), asyncio.Event()
        count = 0
        async def fetch():
            nonlocal count
            count += 1
            if count == 1:
                entered.set()
                await release.wait()
            return []
        entity = self.sensor(fetch)
        entity._changed("car")
        await entered.wait()
        for _ in range(30):
            entity._changed("car")
        release.set()
        await entity._update_task
        self.assertEqual(count, 2)

    async def test_unchanged_summary_is_written_on_every_signal(self):
        # Freshness baseline: an identical summary still produces a state write on each signal.
        async def fetch():
            return []
        entity = self.sensor(fetch)
        for expected in (1, 2, 3):
            entity._changed("car")
            await entity._update_task
            self.assertEqual(entity.writes, expected)

    async def test_blocked_summary_read_does_not_stop_later_refreshes(self):
        # T-01: one summary read that never returns must not freeze the sensor for good.
        # The blocked task is cancelled and awaited in finally, so nothing leaks into other tests.
        calls = 0
        async def fetch():
            nonlocal calls
            calls += 1
            if calls == 1:
                await asyncio.Event().wait()  # intentionally never returns
            return []
        entity = self.sensor(fetch)
        entity.SUMMARY_TIMEOUT = 0.05
        blocked = None
        try:
            entity._changed("car")
            await asyncio.sleep(0)  # the first read is now blocked
            blocked = entity._update_task
            entity._changed("car")  # a later change arrives while the first read is still blocked
            try:
                await wait_until(lambda: getattr(entity, "writes", 0) >= 1, timeout=1)
            except asyncio.TimeoutError:
                self.fail("A later change was not written while an earlier summary read was blocked")
        finally:
            if blocked is not None:
                blocked.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await blocked

    async def test_blocked_read_times_out_and_later_change_writes_latest_value(self):  # T-01
        calls = 0
        async def summary():
            nonlocal calls
            calls += 1
            if calls == 1:
                await asyncio.Event().wait()  # blocked until the timeout cancels it
            return {"sessions": 7, "battery_kwh": 0, "cost": 0, "unpriced": 0}
        entity = self.sensor_with(summary)
        entity.SUMMARY_TIMEOUT = 0.05
        entity._changed("car")
        await wait_until(lambda: entity._update_task.done(), timeout=1)
        self.assertEqual(getattr(entity, "writes", 0), 0)
        entity._changed("car")
        await wait_until(lambda: getattr(entity, "writes", 0) >= 1, timeout=1)
        self.assertEqual(entity._attr_native_value, 7)
        self.assertEqual(calls, 2)

    async def test_change_arriving_during_a_blocked_read_is_retried_without_another_signal(self):
        calls = 0
        async def summary():
            nonlocal calls
            calls += 1
            if calls == 1:
                await asyncio.Event().wait()
            return {"sessions": 3, "battery_kwh": 0, "cost": 0, "unpriced": 0}
        entity = self.sensor_with(summary)
        entity.SUMMARY_TIMEOUT = 0.2
        entity._changed("car")
        await asyncio.sleep(0)  # first read is blocked
        entity._changed("car")  # pending change
        await wait_until(lambda: getattr(entity, "writes", 0) >= 1, timeout=2)
        self.assertEqual(calls, 2)
        self.assertEqual(entity._attr_native_value, 3)

    async def test_repeated_timeouts_log_one_warning_and_success_resets_it(self):
        blocking = True
        async def summary():
            if blocking:
                await asyncio.Event().wait()
            return {"sessions": 1, "battery_kwh": 0, "cost": 0, "unpriced": 0}
        entity = self.sensor_with(summary)
        entity.SUMMARY_TIMEOUT = 0.02
        with self.assertLogs(level="WARNING") as logs:
            for _ in range(3):
                entity._changed("car")
                await wait_until(lambda: entity._update_task.done(), timeout=1)
            blocking = False
            entity._changed("car")
            await wait_until(lambda: getattr(entity, "writes", 0) >= 1, timeout=1)
            blocking = True
            entity._changed("car")
            await wait_until(lambda: entity._update_task.done(), timeout=1)
        self.assertEqual(len([line for line in logs.output if "stalled" in line]), 2)

    async def test_blocked_read_never_runs_two_refresh_tasks_or_overlapping_reads(self):
        active = max_active = calls = 0
        async def summary():
            nonlocal active, max_active, calls
            calls += 1
            active += 1
            max_active = max(max_active, active)
            try:
                await asyncio.Event().wait()
            finally:
                active -= 1
        entity = self.sensor_with(summary)
        entity.SUMMARY_TIMEOUT = 0.05
        for _ in range(20):
            entity._changed("car")
            await asyncio.sleep(0)
        await wait_until(lambda: entity._update_task.done(), timeout=2)
        self.assertEqual(max_active, 1)
        self.assertEqual(calls, 2)  # the first read, plus exactly one retry for the pending change

    async def test_unload_during_a_blocked_read_prevents_late_writes(self):
        async def summary():
            await asyncio.Event().wait()
        entity = self.sensor_with(summary)
        entity.SUMMARY_TIMEOUT = 10
        entity._changed("car")
        await asyncio.sleep(0.01)
        await entity.async_will_remove_from_hass()
        self.assertIsNone(entity._update_task)
        entity._changed("car")
        self.assertIsNone(entity._update_task)
        self.assertEqual(getattr(entity, "writes", 0), 0)

    async def test_stalled_database_job_yields_one_read_and_one_thread_then_recovers(self):  # T-11, real runtime
        from test_recorder_resilience import make_runtime
        release = threading.Event()
        sessions_calls = 0
        threads_now = threads_max = 0
        gate = threading.Lock()
        def parked():
            nonlocal threads_now, threads_max
            with gate:
                threads_now += 1
                threads_max = max(threads_max, threads_now)
            try:
                release.wait(5)  # bounded so a failing test cannot hang
            finally:
                with gate:
                    threads_now -= 1
            return []
        async def db(method, *args):
            nonlocal sessions_calls
            if method == "sessions":
                sessions_calls += 1
                return await asyncio.get_running_loop().run_in_executor(None, parked)
            if method == "get":
                return {}
            if method == "maintain_storage":
                return {"more": False}
            return None
        runtime, _ = make_runtime(db=db)
        runtime.entry.title = "Car"
        entity = Sensor(runtime, "sessions")
        entity.hass = types.SimpleNamespace(async_create_task=asyncio.create_task)
        entity.SUMMARY_TIMEOUT = 0.05
        try:
            with self.assertLogs(level="WARNING") as logs:
                for _ in range(10):
                    entity._changed("car")
                    await wait_until(lambda: entity._update_task.done(), timeout=2)
            self.assertEqual(sessions_calls, 1)
            self.assertEqual(threads_max, 1)
            self.assertEqual(len([line for line in logs.output if "stalled" in line]), 1)
        finally:
            release.set()
        await wait_until(lambda: runtime._summary_flight is None, timeout=5)
        entity._changed("car")
        await wait_until(lambda: getattr(entity, "writes", 0) >= 1, timeout=2)
        self.assertEqual(sessions_calls, 1)  # the recovered calculation is cached and reused
        self.assertEqual(entity._attr_native_value, 0)
