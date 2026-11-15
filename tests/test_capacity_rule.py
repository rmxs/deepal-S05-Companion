"""Battery capacity rule: an explicit battery size wins, otherwise PHEV is 18.4 kWh and EV is 68.8 kWh.
Vehicle type is an explicit setting (phev or ev), or in automatic mode it is detected from the fuel sensors."""
import importlib
import types
import unittest
from unittest.mock import patch

from test_lifecycle import integration  # noqa: F401  installs the Home Assistant doubles and companion_lifecycle package
from test_recorder_resilience import make_runtime

module = importlib.import_module("companion_lifecycle.runtime")
PHEV_KWH, EV_KWH = 18.4, 68.8


def capacity_and_type(config, states=None, registry_entries=None):
    runtime, _ = make_runtime(states or {})
    runtime.config = {"prefix": "s05", **config}
    runtime.entities = {"fuel": "sensor.fuel_level", "batt": "sensor.battery"}
    entries = registry_entries or {}
    registry = types.SimpleNamespace(async_get=lambda entity: entries.get(entity))
    with patch.object(module, "er", types.SimpleNamespace(async_get=lambda hass: registry), create=True):
        return runtime.capacity(), runtime.has_fuel()


class CapacityRuleTests(unittest.TestCase):
    def test_explicit_phev_uses_the_plug_in_capacity(self):
        self.assertEqual(capacity_and_type({"powertrain": "phev"}), (PHEV_KWH, True))

    def test_explicit_ev_uses_the_electric_capacity(self):
        self.assertEqual(capacity_and_type({"powertrain": "ev"}), (EV_KWH, False))

    def test_explicit_ev_wins_over_fuel_sensors(self):
        self.assertEqual(capacity_and_type({"powertrain": "ev"}, states={"sensor.fuel_level": "55"}), (EV_KWH, False))

    def test_explicit_battery_size_overrides_either_branch(self):
        self.assertEqual(capacity_and_type({"powertrain": "phev", "battery_kwh": 22}), (22, True))
        self.assertEqual(capacity_and_type({"powertrain": "ev", "battery_kwh": 60}), (60, False))

    def test_non_positive_battery_size_falls_back_to_the_branch(self):
        self.assertEqual(capacity_and_type({"powertrain": "ev", "battery_kwh": 0}), (EV_KWH, False))
        self.assertEqual(capacity_and_type({"powertrain": "phev", "battery_kwh": -5}), (PHEV_KWH, True))

    def test_automatic_with_fuel_level_state_is_a_plug_in_hybrid(self):
        self.assertEqual(capacity_and_type({"powertrain": "auto"}, states={"sensor.fuel_level": "55"}), (PHEV_KWH, True))

    def test_automatic_with_fuel_range_state_is_a_plug_in_hybrid(self):
        self.assertEqual(capacity_and_type({"powertrain": "auto"}, states={"sensor.s05_fuel_range": "420"}), (PHEV_KWH, True))

    def test_automatic_at_startup_with_a_registered_but_unloaded_fuel_sensor_is_a_plug_in_hybrid(self):
        entries = {"sensor.fuel_level": object()}
        self.assertEqual(capacity_and_type({"powertrain": "auto"}, registry_entries=entries), (PHEV_KWH, True))

    def test_automatic_without_any_fuel_sensor_is_electric(self):
        self.assertEqual(capacity_and_type({"powertrain": "auto"}), (EV_KWH, False))

    def test_missing_powertrain_setting_defaults_to_automatic(self):
        self.assertEqual(capacity_and_type({}), (EV_KWH, False))
        self.assertEqual(capacity_and_type({}, states={"sensor.fuel_level": "55"}), (PHEV_KWH, True))


if __name__ == "__main__":
    unittest.main()
