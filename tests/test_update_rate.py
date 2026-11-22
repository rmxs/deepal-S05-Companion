"""Data update rate (live / 5 min / 10 min): spacing of saved readings and the notification lower limit."""
import importlib
import types
import unittest

from test_lifecycle import integration  # noqa: F401  (registers the stubbed package)

Runtime = importlib.import_module("companion_lifecycle.runtime").VehicleRuntime
const = importlib.import_module("companion_lifecycle.const")


def car(rate):
    return types.SimpleNamespace(last_states={}, charger_entities={"sensor.charger"}, hub=types.SimpleNamespace(update_rate=rate))


def feed(runtime, entity, now, state):
    """One reading, the way the worker does it: what is queued for saving becomes the last saved state."""
    samples, pending = [], {}
    Runtime._sample(runtime, entity, now, state, "", samples, pending)
    runtime.last_states.update(pending)
    return bool(samples)


class UpdateRate(unittest.TestCase):
    def test_floor_accepts_only_the_three_choices(self):
        for rate, expected in ((0, 0), (300, 300), (600, 600), (123, 0), ("300", 0), (True, 0), (None, 0)):
            self.assertEqual(const.update_floor(types.SimpleNamespace(hub=types.SimpleNamespace(update_rate=rate))), expected)
        self.assertEqual(const.update_floor(types.SimpleNamespace()), 0)

    def test_live_saves_every_change_and_keeps_the_five_minute_charger_heartbeat(self):
        runtime = car(0)
        self.assertTrue(feed(runtime, "sensor.battery", 1000, "50"))
        self.assertTrue(feed(runtime, "sensor.battery", 1005, "51"))
        self.assertFalse(feed(runtime, "sensor.battery", 1010, "51"))
        self.assertTrue(feed(runtime, "sensor.charger", 1000, "7"))
        self.assertFalse(feed(runtime, "sensor.charger", 1100, "7"))
        self.assertTrue(feed(runtime, "sensor.charger", 1300, "7"))

    def test_ten_minutes_saves_a_change_only_after_the_time_and_does_not_lose_it(self):
        runtime = car(600)
        self.assertTrue(feed(runtime, "sensor.battery", 1000, "50"))
        self.assertFalse(feed(runtime, "sensor.battery", 1005, "51"))   # too soon: waits
        self.assertFalse(feed(runtime, "sensor.battery", 1300, "51"))
        self.assertTrue(feed(runtime, "sensor.battery", 1600, "51"))    # the next pass after the time saves the waiting value
        self.assertEqual(runtime.last_states["sensor.battery"][0], "51")

    def test_slower_rates_stretch_the_charger_heartbeat(self):
        runtime = car(600)
        self.assertTrue(feed(runtime, "sensor.charger", 1000, "7"))
        self.assertFalse(feed(runtime, "sensor.charger", 1300, "7"))
        self.assertTrue(feed(runtime, "sensor.charger", 1600, "7"))
        five = car(300)
        self.assertTrue(feed(five, "sensor.charger", 1000, "7"))
        self.assertTrue(feed(five, "sensor.charger", 1300, "7"))


if __name__ == "__main__":
    unittest.main()
