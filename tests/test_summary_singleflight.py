"""Summary calculation is single-flight per runtime: shared work, bounded threads, failures not cached (T-10 to T-15)."""
import asyncio
import contextlib
import gc
import threading
import unittest

from test_lifecycle import integration  # noqa: F401  installs the Home Assistant doubles and companion_lifecycle package
from test_recorder_resilience import make_runtime


class SummarySingleFlightTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.release = threading.Event()
        self.calls = 0
        self.fail_next = False
        self.blocking = False

    def tearDown(self):
        self.release.set()  # guaranteed cleanup: no executor thread stays parked after a test

    def parked(self):
        self.release.wait(5)  # bounded so a failing test cannot hang
        return []

    def make(self, blocking=False):
        async def db(method, *args):
            if method == "sessions":
                self.calls += 1
                if self.fail_next:
                    self.fail_next = False
                    raise RuntimeError("database locked")
                if blocking:
                    return await asyncio.get_running_loop().run_in_executor(None, self.parked)
                return []
            if method == "get":
                return {}
            return None
        runtime, _ = make_runtime(db=db)
        return runtime

    async def test_concurrent_callers_share_one_calculation(self):  # T-10
        runtime = self.make()
        results = await asyncio.gather(*(runtime.summary_values() for _ in range(5)))
        self.assertEqual(self.calls, 1)
        self.assertTrue(all(result == results[0] for result in results))

    async def test_cancelled_caller_does_not_cancel_shared_work_and_locks_are_released(self):  # T-12
        runtime = self.make(blocking=True)
        first = asyncio.ensure_future(runtime.summary_values())
        second = asyncio.ensure_future(runtime.summary_values())
        await asyncio.sleep(0.02)
        first.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await first
        self.assertFalse(second.done(), "the shared calculation must still be running")
        self.assertFalse(runtime._pricing_lock.locked(), "the running calculation holds no pricing lock, so other reads are not held up")
        self.release.set()
        result = await asyncio.wait_for(second, 2)
        self.assertEqual(result["sessions"], 0)
        self.assertEqual(self.calls, 1)
        self.assertFalse(runtime._pricing_lock.locked())

    async def test_timed_out_callers_do_not_start_more_calculations(self):  # T-11
        runtime = self.make(blocking=True)
        for _ in range(10):
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(runtime.summary_values(), 0.01)
        self.assertEqual(self.calls, 1)

    async def test_stalled_calculation_recovers_and_pending_revision_change_is_processed(self):  # T-13
        runtime = self.make(blocking=True)
        pending = asyncio.ensure_future(runtime.summary_values())
        await asyncio.sleep(0.02)
        runtime._summary_revision += 1  # data changed while the first calculation is stalled
        self.release.set()
        result = await asyncio.wait_for(pending, 2)
        self.assertEqual(result["sessions"], 0)
        self.assertEqual(self.calls, 2)  # the stale calculation is discarded and a fresh one runs
        self.assertIsNotNone(runtime._summary_cache)
        self.assertEqual(runtime._summary_cache[0], runtime._summary_revision)

    async def test_failed_calculation_propagates_is_not_cached_and_recovers(self):  # T-15
        runtime = self.make()
        unhandled = []
        asyncio.get_running_loop().set_exception_handler(lambda loop, context: unhandled.append(context))
        self.fail_next = True
        with self.assertRaises(RuntimeError):
            await runtime.summary_values()
        self.assertIsNone(runtime._summary_cache)
        self.assertIsNone(runtime._summary_flight)
        result = await runtime.summary_values()
        self.assertEqual(result["sessions"], 0)
        self.assertEqual(self.calls, 2)
        gc.collect()
        await asyncio.sleep(0)
        self.assertEqual(unhandled, [], "a failed calculation must not produce an unobserved-exception report")

    async def test_unload_while_calculation_runs_keeps_shared_work_safe(self):  # T-14
        runtime = self.make(blocking=True)
        runtime.stop_timeout = 1
        runtime.engine = None  # no engine checkpoint: the shutdown path under test is the summary calculation
        errors = []
        asyncio.get_running_loop().set_exception_handler(lambda loop, context: errors.append(context))
        waiter = asyncio.ensure_future(runtime.summary_values())
        await asyncio.sleep(0.02)
        flight = runtime._summary_flight
        self.assertIsNotNone(flight)
        waiter.cancel()  # the sensor is removed while it waits
        with contextlib.suppress(asyncio.CancelledError):
            await waiter
        await asyncio.wait_for(runtime.stop(), 3)  # unload returns without waiting for the database
        self.assertFalse(flight.done(), "the stopped runtime does not cancel the database calculation")
        self.release.set()
        await asyncio.wait({flight}, timeout=2)
        self.assertTrue(flight.done())
        self.assertIsNone(runtime._summary_flight)  # the done-callback cleared it
        # Finding: stop() clears _summary_cache, but a calculation that finishes afterwards sets it again.
        # Nothing reads a stopped runtime's cache and the calculation writes no Home Assistant state, so this is harmless.
        self.assertIsNotNone(runtime._summary_cache)
        gc.collect()
        await asyncio.sleep(0)
        self.assertEqual(errors, [], "no unhandled background exception after unload")


if __name__ == "__main__":
    unittest.main()
