"""Visibility lives in `hidden` only; the car's look is shared by every display profile."""
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
# Load the database module as a bare package so the test does not need Home Assistant installed.
import importlib  # noqa: E402
import types  # noqa: E402
pkg = types.ModuleType("companion_scope_test")
pkg.__path__ = [str(ROOT / "custom_components" / "deepal_companion")]
sys.modules[pkg.__name__] = pkg
database = importlib.import_module("companion_scope_test.database")
Database, normalise_view, VIEW_SCHEMA = database.Database, database.normalise_view, database.VIEW_SCHEMA


class VisibilityNormalisation(unittest.TestCase):
    def test_old_flags_fold_into_hidden_without_losing_anything(self):
        old = {"charge_curve": False, "charging_reminder": True, "charging_cost": False, "hidden": ["charge"], "hero_style": "photo"}
        new = normalise_view(old)
        self.assertEqual(new["hidden"], ["charge", "curve", "costs"])
        for flag in ("charge_curve", "charging_reminder", "charging_cost"):
            self.assertNotIn(flag, new)
        self.assertEqual(new["hero_style"], "photo")
        self.assertEqual(new["_settings_schema"], VIEW_SCHEMA)

    def test_missing_hidden_is_not_materialised_when_no_flag_hides_anything(self):
        new = normalise_view({"charge_curve": True})
        self.assertNotIn("hidden", new)

    def test_missing_hidden_starts_from_the_card_default_when_a_flag_hides(self):
        self.assertEqual(normalise_view({"charging_reminder": False})["hidden"], ["charge", "costs", "reminder"])

    def test_normalisation_is_idempotent(self):
        once = normalise_view({"charge_curve": False, "hidden": ["x"]})
        self.assertEqual(normalise_view(once), once)


class LookIsVehicleScoped(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "scope.sqlite"))
        self.db.initialize()
        self.db.ensure_vehicle("car", "Car", {"prefix": "s05", "battery_entity": "sensor.batt", "entities": {}})
        self.first, self.second = [v["id"] for v in self.db.list_vehicles()[0]["views"]][:2]

    def tearDown(self):
        self.tmp.cleanup()

    def test_profile_copy_is_used_until_a_vehicle_value_is_saved(self):
        self.db.patch_config("car", self.first, {"hero_style": "photo"})
        self.assertEqual(self.db.config("car", self.second)["config"]["hero_style"], "photo")
        self.db.patch_config("car", self.second, {"hero_style": "render"})
        for view in (self.first, self.second):
            self.assertEqual(self.db.config("car", view)["config"]["hero_style"], "render")

    def test_settings_marker_never_reaches_the_renderer(self):
        self.assertNotIn("_settings_schema", self.db.config("car", self.first)["config"])


class ChargeTargetIsVehicleScoped(unittest.TestCase):
    """The charger limit reads the vehicle's settings (the oldest profile); the card saves from the selected profile."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "target.sqlite"))
        self.db.initialize()
        self.db.ensure_vehicle("car", "Car", {"prefix": "s05", "battery_entity": "sensor.batt", "entities": {}})
        self.first, self.second = [v["id"] for v in self.db.list_vehicles()[0]["views"]][:2]

    def tearDown(self):
        self.tmp.cleanup()

    def test_target_saved_in_another_profile_reaches_the_limiter(self):
        self.db.patch_config("car", self.second, {"charge_target": 80})
        self.assertEqual(self.db.config("car")["config"].get("charge_target"), 80)  # what the limiter reads (no profile given)
        self.assertEqual(self.db.config("car", self.first)["config"].get("charge_target"), 80)
        self.db.patch_config("car", self.first, {"charge_target": 70})
        for view in (self.first, self.second, None):
            self.assertEqual(self.db.config("car", view)["config"]["charge_target"], 70)

    def test_a_target_saved_per_profile_before_is_kept_until_a_vehicle_value_is_saved(self):
        # older versions saved the target inside the profile; the limiter and every card use the first one found
        with self.db.connect() as db:
            from json import dumps
            row = db.execute("SELECT config FROM views WHERE id=?", (self.second,)).fetchone()
            import json
            cfg = json.loads(row["config"]); cfg["charge_target"] = 90
            db.execute("UPDATE views SET config=? WHERE id=?", (dumps(cfg), self.second))
        self.assertEqual(self.db.config("car")["config"]["charge_target"], 90)
        self.assertEqual(self.db.config("car", self.first)["config"]["charge_target"], 90)


if __name__ == "__main__":
    unittest.main()
