"""Deleting, restoring and correcting charging sessions, and hiding curve readings."""
import json
from pathlib import Path
import tempfile
import unittest

from test_archive import Database


def session(start, dc=False, live=False):
    return {"id": "s%d" % start, "s": start * 1000, "e": (start + 3600) * 1000, "from": 40, "to": 80,
            "kwh": 10, "capacity": 25, "live": live, "dc": dc, "gap": False}


class SessionEditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "archive.sqlite"))
        self.db.initialize()
        self.db.ensure_vehicle("car", "Car", {"prefix": "s05", "battery_entity": "sensor.battery"})
        self.t = 1700000000
        self.db.save_session("car", session(self.t))
        self.db.save_session("car", session(self.t + 86400, dc=True))

    def tearDown(self):
        self.tmp.cleanup()

    def test_delete_hides_restore_returns_and_purge_removes(self):
        ident = "s%d" % self.t
        self.db.delete_session("car", ident, now=self.t + 2 * 86400)
        self.assertEqual([s["id"] for s in self.db.sessions("car")], ["s%d" % (self.t + 86400)])
        self.assertEqual(self.db.session_page("car")["total"], 1)
        self.assertEqual(self.db.summary("car")["sessions"], 1)
        self.assertEqual([s["id"] for s in self.db.export("car")["sessions"]], ["s%d" % (self.t + 86400)])
        deleted = self.db.deleted_sessions("car")
        self.assertEqual([s["id"] for s in deleted], [ident])
        self.assertEqual(deleted[0]["deleted"], (self.t + 2 * 86400) * 1000)
        self.assertEqual(self.db.purge_deleted("car", now=self.t + 10 * 86400), 0, "Kept during the undo period")
        self.db.restore_session("car", ident)
        self.assertEqual(len(self.db.sessions("car")), 2)
        self.db.delete_session("car", ident, now=self.t + 2 * 86400)
        self.assertEqual(self.db.purge_deleted("car", now=self.t + 40 * 86400), 1)
        self.assertEqual(self.db.deleted_sessions("car"), [])
        with self.assertRaises(ValueError):
            self.db.restore_session("car", ident)

    def test_running_charge_and_unknown_id_are_refused(self):
        self.db.save_session("car", session(self.t + 2 * 86400, live=True))
        with self.assertRaises(ValueError):
            self.db.delete_session("car", "s%d" % (self.t + 2 * 86400))
        with self.assertRaises(ValueError):
            self.db.delete_session("car", "missing")

    def test_recorder_import_does_not_bring_a_deleted_charge_back(self):
        self.db.delete_session("car", "s%d" % self.t)
        row = {"s": self.t * 1000, "e": (self.t + 3600) * 1000, "from": 40, "to": 80, "kwh": 10, "capacity": 25}
        self.assertEqual(self.db.import_sessions("car", [row]), 0)
        self.assertEqual(len(self.db.sessions("car")), 1)

    def test_change_type_and_purge_drops_receipt(self):
        changed = self.db.set_session_mode("car", "s%d" % (self.t + 86400), False)
        self.assertFalse(changed["dc"])
        self.assertFalse(self.db.session_curve("car", "s%d" % (self.t + 86400), {})["mode"] == "DC")
        self.db.save_costs("car", {"profiles": [], "sessions": {str(self.t): {"profile": {"id": "manual"}}}})
        self.db.delete_session("car", "s%d" % self.t, now=self.t)
        self.db.purge_deleted("car", now=self.t + 40 * 86400)
        costs = self.db.get("car", "costs", {})
        self.assertNotIn(str(self.t), costs.get("sessions", {}))

    def test_excluded_current_readings_leave_the_curve(self):
        with self.db.connect() as db:
            db.executemany("INSERT INTO readings VALUES(?,?,?,?,?)",
                           [("car", "sensor.dc", self.t + i * 60, "400" if 10 <= i < 15 else "0", "A") for i in range(30)]
                           + [("car", "sensor.battery", self.t + i * 60, "50", "%") for i in range(30)])
        self.db.exclude_readings("car", ["sensor.dc", None], self.t + 600, self.t + 900)
        rows = self.db.history("car", ["sensor.dc", "sensor.battery"], self.t, self.t + 1800)
        self.assertFalse(any(r["s"] == "400" for r in rows["sensor.dc"]), "Removed readings are hidden")
        self.assertEqual(len(rows["sensor.battery"]), 30, "Battery readings are untouched")
        with self.assertRaises(ValueError):
            self.db.exclude_readings("car", [None], self.t, self.t + 1)


if __name__ == "__main__":
    unittest.main()
