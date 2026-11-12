"""Database, restart and pricing checks runnable without a Home Assistant installation."""
import copy
from contextlib import closing
import importlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
package = types.ModuleType("companion_test")
package.__path__ = [str(ROOT / "custom_components" / "deepal_companion")]
sys.modules["companion_test"] = package
Database = importlib.import_module("companion_test.database").Database
ChargingEngine = importlib.import_module("companion_test.charging").ChargingEngine
calculate = importlib.import_module("companion_test.pricing").calculate


class ArchiveTests(unittest.TestCase):
    def test_database_sorts_all_records_before_selecting_a_page(self):
        rows=[]
        for index, cost in enumerate([5, 0, None, 5, 30, 1, None, 8, 2, 30, 3, 4]):
            row={"id": str(index), "s": 1000000+index*100000, "e": 1050000+index*100000, "live": False, "pricing": {"cost": cost}}
            self.db.save_session("one", row)
            rows.append(row)
        self.db.index_session_costs("one", rows)
        for order in ("newest", "oldest", "highest", "lowest"):
            found, cursor=[],None
            while True:
                page=self.db.session_page("one", cursor, limit=5, sort=order)
                found.extend(row["id"] for row in page["rows"])
                if not page["has_more"]:
                    break
                cursor=page["next_before"]
            if order in {"newest", "oldest"}:
                expected=sorted(rows,key=lambda row:row["s"],reverse=order=="newest")
            else:
                expected=sorted(rows,key=lambda row:(row["pricing"]["cost"] is None, (-(row["pricing"]["cost"] or 0) if order=="highest" else row["pricing"]["cost"] or 0),-row["s"]))
            self.assertEqual(found,[row["id"] for row in expected],order)
            self.assertEqual(len(set(found)),12)

    def test_location_filter_applies_before_pagination_and_keeps_unassigned_separate(self):
        costs = self.db.get("one", "costs")
        for index in range(12):
            start = 1000000+index*100000
            self.db.save_session("one", {"id": str(index), "s": start, "e": start+50000, "live": False})
            if index < 10:
                costs["sessions"][str(start//1000)] = {"profile": {"id": "work" if index < 6 else "old_location", "name": "Work" if index < 6 else "Old location"}}
        self.db.put("one", "costs", costs)
        first = self.db.session_page("one", location="work")
        second = self.db.session_page("one", first["next_before"], location="work")
        self.assertEqual(first["total"], 6)
        self.assertEqual(len(first["rows"]), 5)
        self.assertEqual(len(second["rows"]), 1)
        self.assertEqual(self.db.session_page("one", location="__unset__")["total"], 2)
        self.assertEqual(self.db.session_page("one", location="old_location")["total"], 4)
        self.assertIn("old_location", [item["id"] for item in first["locations"]])
        self.assertEqual(self.db.session_page("one", location="missing")["rows"], [])

    def test_session_pages_use_stable_cursors_and_do_not_repeat_rows(self):
        for index in range(12):
            self.db.save_session("one", {"id": str(index), "s": 1000000+index*100000, "e": 1050000+index*100000, "live": False})
        first = self.db.session_page("one")
        self.assertEqual(len(first["rows"]), 5)
        self.assertEqual(first["total"], 12)
        self.assertTrue(first["has_more"])
        second = self.db.session_page("one", first["next_before"])
        third = self.db.session_page("one", second["next_before"])
        self.assertEqual(len(third["rows"]), 2)
        self.assertFalse(third["has_more"])
        self.assertEqual(len({row["id"] for page in (first,second,third) for row in page["rows"]}), 12)

    def test_recovered_sessions_survive_recorder_loss_without_duplicates(self):
        row = {"s": 1000000, "e": 2000000, "from": 20, "to": 80, "kwh": 11.04, "capacity": 18.4,
               "pricing": {"energy": 12.2, "cost": 3.66, "estimated": False}, "assignment": None}
        self.assertEqual(self.db.import_sessions("one", [row]), 1)
        self.assertEqual(self.db.import_sessions("one", [row]), 0)
        self.assertEqual(self.db.import_sessions("one", [{**row, "s": 1100000}]), 0)
        with self.db.connect() as db:
            db.execute("DELETE FROM readings")
        reopened = Database(self.path)
        rows = reopened.sessions("one")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["recovered_pricing"]["cost"], 3.66)
        self.assertEqual(rows[0]["origin"], "recorder")

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / "archive.sqlite")
        self.db = Database(self.path)
        self.db.initialize()
        self.source = {"prefix": "s05", "battery_entity": "sensor.s05_battery_level",
                       "entities": {"sensor.battery_level": "sensor.s05_battery_level"}}
        self.db.ensure_vehicle("one", "Το αυτοκίνητό μου", self.source)
        self.views = self.db.list_vehicles()[0]["views"]

    def tearDown(self):
        self.tmp.cleanup()

    def test_three_independent_views(self):
        ids = [v["id"] for v in self.views]
        for view, space in zip(ids, ("compact", "standard", "airy")):
            self.db.patch_config("one", view, {"hero_space": space})
        self.assertEqual([self.db.config("one", v)["config"]["hero_space"] for v in ids], ["compact", "standard", "airy"])
        self.db.patch_config("one", ids[0], {"car_color": "black"})
        self.assertEqual([self.db.config("one", v)["config"]["car_color"] for v in ids], ["black"] * len(ids), "car colour is the same in every profile")

    def test_common_capacities_and_independent_layout(self):
        self.db.patch_config("one", self.views[0]["id"], {"battery_kwh": 22, "fuel_tank_liters": 51,
                                                         "buttons_hidden": ["honk"], "lvl_green": "#123abc"})
        other = self.db.config("one", self.views[1]["id"])["config"]
        self.assertEqual(other["battery_kwh"], 22)
        self.assertNotIn("buttons_hidden", other)
        self.assertNotIn("lvl_green", other)

    def test_configuration_survives_restart(self):
        view = self.views[0]["id"]
        self.db.patch_config("one", view, {"prefix": "custom", "entities": {"sensor.battery_level": "sensor.custom_batt"},
                                          "images": {"parked": "/local/mycar.webp"}, "car_color": "blue"})
        self.db.ensure_vehicle("one", "Car", self.source)
        result = Database(self.path).config("one", view)["config"]
        self.assertEqual(result["prefix"], "custom")
        self.assertEqual(result["entities"]["sensor.battery_level"], "sensor.custom_batt")
        self.assertEqual(result["car_color"], "blue")
        self.assertNotIn("_configured_prefix", result)

    def test_update_initialize_preserves_all_saved_settings(self):
        for i, view in enumerate(self.views):
            self.db.patch_config("one", view["id"], {"car_color": "white", "hidden": [],
                "lvl_green": "#123abc", "charge_curve": False, "battery_kwh": 22,
                "custom_future_setting": {"enabled": False, "value": 0}, "name": "Custom " + str(i)})
        costs = {"profiles": [], "sessions": {"1700000000": {"profile": {"id": "deleted", "name": "Old Home"}, "total": 0}}}
        notifications = {"enabled": True, "devices": ["notify.my_phone"], "rules": [{"id": "custom", "enabled": False, "title": "My alert"}]}
        notifications["live_charging"] = {"enabled": True, "devices": ["notify.my_phone"], "min_interval": 300, "battery_step": 5, "show_timer": False, "max_age": 1800}
        self.db.put("one", "costs", costs)
        self.db.put("one", "local_notifications", notifications)
        before = [self.db.config("one", v["id"]) for v in self.views]
        with self.db.connect() as connection:
            connection.execute("PRAGMA user_version=1")
        updated = Database(self.path)
        updated.initialize()
        updated.ensure_vehicle("one", "Car", {**self.source, "car_color": "black", "powertrain": "ev"})
        # A vehicle saved before powertrain was stored takes the setup choice; everything else is untouched.
        self.assertEqual([updated.config("one", v["id"]) for v in self.views],
                         [{**b, "config": {**b["config"], "powertrain": "ev"}} for b in before])
        self.assertEqual(updated.get("one", "costs"), costs)
        self.assertEqual(updated.get("one", "local_notifications"), notifications)
        self.assertEqual([v["id"] for v in updated.list_vehicles()[0]["views"]], [v["id"] for v in self.views])

    def test_setup_powertrain_keeps_only_explicit_settings_choice(self):
        # A default "auto" from an older save is not a user choice: the setup type wins.
        self.db.ensure_vehicle("two", "Second", {**self.source, "powertrain": "auto"})
        view = self.db.list_vehicles()[1]["views"][0]["id"]
        self.db.ensure_vehicle("two", "Second", {**self.source, "powertrain": "phev"})
        self.assertEqual(self.db.config("two", view)["config"]["powertrain"], "phev")
        # An explicit Settings choice, including Automatic, survives later setup values.
        self.db.patch_config("two", view, {"powertrain": "auto"})
        self.db.ensure_vehicle("two", "Second", {**self.source, "powertrain": "ev"})
        self.assertEqual(self.db.config("two", view)["config"]["powertrain"], "auto")

    def test_schema_version_is_read_from_the_database(self):
        self.assertEqual(self.db.schema_version(), 2)

    def test_clone_rename_and_delete(self):
        view = self.views[0]["id"]
        self.db.patch_config("one", view, {"car_color": "silver", "hero_style": "carview"})
        clone = self.db.view("one", "create", name="Δεύτερη κάρτα", source=view)["view_id"]
        self.assertEqual(self.db.config("one", clone)["config"]["car_color"], "silver")
        self.db.view("one", "rename", clone, "Renamed")
        self.assertEqual(self.db.config("one", clone)["view_name"], "Renamed")
        self.db.view("one", "delete", clone)
        with self.assertRaises(ValueError):
            self.db.config("one", clone)

    def test_cross_vehicle_view_is_rejected(self):
        self.db.ensure_vehicle("two", "Other", self.source)
        with self.assertRaises(ValueError):
            self.db.patch_config("two", self.views[0]["id"], {"car_color": "red"})

    def test_profile_reset_keeps_other_views(self):
        self.db.patch_config("one", self.views[0]["id"], {"hero_space": "airy"})
        self.db.patch_config("one", self.views[1]["id"], {"hero_space": "compact"})
        self.db.patch_config("one", self.views[0]["id"], {}, True)
        self.assertNotIn("hero_space", self.db.config("one", self.views[0]["id"])["config"])
        self.assertEqual(self.db.config("one", self.views[1]["id"])["config"]["hero_space"], "compact")

    def test_persistent_readings_and_boundary(self):
        for stamp, state in ((100, 80), (200, 79), (300, 78)):
            self.db.sample("one", "sensor.batt", stamp, state, "%")
        rows = self.db.history("one", ["sensor.batt"], 150, 250)["sensor.batt"]
        self.assertEqual([r["s"] for r in rows], ["80", "79"])
        self.assertEqual(self.db.reading_unit("one", "sensor.batt"), "%")

    def test_archive_and_pricing_not_tied_to_recorder(self):
        session = {"id": "charge", "s": 100000, "e": 4000000, "live": False, "from": 20, "to": 80, "kwh": 11.04}
        self.db.save_session("one", session)
        self.db.put("one", "costs", {"profiles": [], "sessions": {"100": {"profile": {"price": .2}}}})
        reopened = Database(self.path)
        self.assertEqual(reopened.summary("one")["sessions"], 1)
        self.assertEqual(reopened.export("one")["sessions"][0]["kwh"], 11.04)
        self.assertEqual(reopened.get("one", "costs")["sessions"]["100"]["profile"]["price"], .2)

    def test_sqlite_backup_is_complete(self):
        self.db.put("one", "example", {"unicode": "Δοκιμή", "color": "#22cc99"})
        target = str(Path(self.tmp.name) / "copy.sqlite")
        self.db.backup(target)
        self.assertEqual(Database(target).get("one", "example")["unicode"], "Δοκιμή")

    def test_unknown_future_schema_rejected(self):
        with closing(sqlite3.connect(self.path)) as sql:
            sql.execute("PRAGMA user_version=999")
            sql.commit()
        with self.assertRaises(RuntimeError):
            self.db.initialize()

    def test_record_update_is_atomic_on_session_failure(self):
        with self.assertRaises(KeyError):
            self.db.record_update("one", [("sensor.ac", 100, "8", "A")], [{}], {"new": "checkpoint"})
        self.assertEqual(self.db.history("one", ["sensor.ac"], 0, 200)["sensor.ac"], [])
        self.assertIsNone(self.db.get("one", "engine"))

    def test_record_update_commits_session_and_engine_together(self):
        session = {"id": "atomic", "s": 100000, "e": 200000, "live": True, "kwh": 2}
        engine = {"session": session, "last": 200}
        self.db.record_update("one", [("sensor.ac", 100, "8", "A")], [session], engine)
        self.assertEqual(self.db.sessions("one")[0]["id"], "atomic")
        self.assertEqual(self.db.get("one", "engine"), engine)
        values = self.db.pricing_inputs("one", [("atomic", "sensor.ac", 90, 200)])
        self.assertEqual(values["atomic"], {"readings": [[100000, "8"]], "unit": "A"})


class ChargingTests(unittest.TestCase):
    def test_single_high_reading_is_not_believed_until_it_repeats(self):
        engine = ChargingEngine()
        engine.feed(1000, 41, True, 18.4)
        engine.feed(1060, 97, True, 18.4)
        self.assertEqual(engine.feed(1120, 41, True, 18.4)[0]["to"], 41)
        engine.feed(1180, 70, True, 18.4)
        self.assertEqual(engine.feed(1240, 70, True, 18.4)[0]["to"], 70)

    def test_spike_tolerance_is_adjustable(self):
        engine = ChargingEngine()
        engine.feed(1000, 41, True, 18.4, jump=60)
        self.assertEqual(engine.feed(1060, 97, True, 18.4, jump=60)[0]["to"], 97)  # 56 points is within the allowed jump

    def test_data_older_than_the_gap_limit_closes_the_session_as_a_gap(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]
        closed = engine.feed(1000 + 15 * 60 + 30, 25, True, 18.4)[0]
        self.assertTrue(closed["gap"])
        self.assertEqual(closed["id"], first["id"])

    def test_complete_session_and_capacity_snapshot(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]
        engine.feed(1600, 50, True, 22)
        engine.feed(1700, 50, False, 22)
        ended = engine.feed(2600, 50, False, 22)[0]
        self.assertFalse(ended["live"])
        self.assertEqual(ended["id"], first["id"])
        self.assertAlmostEqual(ended["kwh"], 5.52)

    def test_pause_and_resume_same_identity(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]
        engine.feed(1300, 30, False, 18.4)
        resumed = engine.feed(1500, 40, True, 18.4)[0]
        self.assertEqual(resumed["id"], first["id"])

    def test_restart_recovers_active_session(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]
        restarted = ChargingEngine(json.loads(json.dumps(engine.state)))
        current = restarted.feed(1100, 30, True, 18.4)[0]
        self.assertEqual(current["id"], first["id"])
        self.assertEqual(current["from"], 20)

    def test_long_outage_is_not_counted_as_observed_charge(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]
        rows = engine.feed(10000, 80, True, 18.4)
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["gap"])
        self.assertFalse(rows[0]["live"])
        self.assertNotEqual(rows[1]["id"], first["id"])

    def test_invalid_and_zero_spikes(self):
        engine = ChargingEngine()
        engine.feed(1000, 50, True, 18.4)
        row = engine.feed(1100, 0, True, 18.4)[0]
        self.assertEqual(row["to"], 50)
        row = engine.feed(1200, "unavailable", True, 18.4)[0]
        self.assertEqual(row["to"], 50)

    def test_dc_is_remembered(self):
        engine = ChargingEngine()
        engine.feed(1000, 20, True, 18.4, True)
        self.assertTrue(engine.feed(1100, 30, True, 18.4, False)[0]["dc"])

    def test_unknown_charging_state_is_marked_as_gap(self):
        engine = ChargingEngine()
        engine.feed(1000, 20, True, 18.4)
        self.assertTrue(engine.feed(1100, 20, None, 18.4)[0]["gap"])

    def test_offline_car_does_not_split_one_charge(self):
        engine = ChargingEngine()
        first = engine.feed(1000, 20, True, 18.4)[0]["id"]
        now = 1000
        for _ in range(40):  # 40 minutes without a connection, with the one-minute heartbeat
            now += 60
            row = engine.feed(now, 20, None, 18.4)[0]
        self.assertTrue(row["live"])
        row = engine.feed(now + 60, 35, True, 18.4)[0]
        self.assertEqual((row["id"], row["from"], row["to"], row["live"]), (first, 20, 35, True))

    def test_charge_closes_when_the_car_never_comes_back(self):
        engine = ChargingEngine()
        engine.feed(1000, 20, True, 18.4)
        now, row = 1000, None
        while now < 1000 + 6 * 3600 + 120:
            now += 600
            row = engine.feed(now, None, None, 18.4)[0]
        self.assertFalse(row["live"])
        self.assertEqual(row["e"], 1000 * 1000, "it ends at the last known charging reading")
        self.assertIsNone(engine.state["session"])


class PricingTests(unittest.TestCase):
    def setUp(self):
        self.g = {"s": 0, "e": 3600000, "from": 0, "to": 50, "kwh": 9}
        self.profile = {"id": "home", "price": .2, "free": False, "source": "battery", "efficiency": 90}
        self.record = {"profile": self.profile}

    def test_estimated_wall_energy(self):
        value = calculate(self.g, self.record)
        self.assertEqual(value["energy"], 10)
        self.assertEqual(value["cost"], 2)
        self.assertTrue(value["cost_estimated"])

    def test_free_is_exact_zero(self):
        value = calculate(self.g, {"profile": {**self.profile, "free": True}})
        self.assertEqual(value["cost"], 0)
        self.assertFalse(value["cost_estimated"])

    def test_receipt_overrides_tariff(self):
        value = calculate(self.g, {**self.record, "energy": 12, "total": 7.5})
        self.assertEqual(value["energy"], 12)
        self.assertEqual(value["cost"], 7.5)

    def test_no_tariff_does_not_mean_free(self):
        self.assertIsNone(calculate(self.g, {"profile": {**self.profile, "price": None}})["cost"])
        self.assertIsNone(calculate(self.g)["cost"])

    def test_total_and_session_meters(self):
        rows = [[i * 600000, 100 + i] for i in range(7)]
        for kind in ("total", "session"):
            record = {"profile": {**self.profile, "source": kind}}
            value = calculate(self.g, record, rows, "kWh")
            self.assertEqual(value["energy"], 6)
            self.assertEqual(value["source"], "meter")
            self.assertFalse(value["estimated"])

    def test_power_integration(self):
        rows = [[i * 600000, 2000] for i in range(7)]
        value = calculate(self.g, {"profile": {**self.profile, "source": "power"}}, rows, "W")
        self.assertAlmostEqual(value["energy"], 2)
        self.assertAlmostEqual(value["cost"], .4)

    def test_extreme_meter_values_fall_back_to_battery(self):
        rows = [[i * 600000, i * 1e300] for i in range(7)]
        value = calculate(self.g, {"profile": {**self.profile, "source": "total"}}, rows, "kWh")
        self.assertEqual(value["source"], "fallback")
        self.assertEqual(value["energy"], 10)

    def test_reset_or_missing_meter_falls_back(self):
        for rows in ([], [[0, 100], [600000, 0], [3600000, 10]]):
            value = calculate(self.g, {"profile": {**self.profile, "source": "total"}}, rows, "kWh")
            self.assertEqual(value["source"], "fallback")
            self.assertEqual(value["energy"], 10)

    def test_snapshot_uses_saved_capacity(self):
        value = calculate(self.g, {**self.record, "capacity": 20})
        self.assertAlmostEqual(value["energy"], 10 / .9)

    def test_snapshot_is_independent_of_profile_changes(self):
        snapshot = copy.deepcopy(self.record)
        self.profile["price"] = .8
        self.assertEqual(calculate(self.g, snapshot)["cost"], 2)

    def test_free_and_paid_receipt_priority_is_explicit(self):
        # Validation rejects conflicting free+paid writes; the arithmetic preserves an explicit receipt.
        value = calculate(self.g, {"profile": {**self.profile, "free": True}, "total": 3})
        self.assertEqual(value["cost"], 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
