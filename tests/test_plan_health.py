"""Charge plan health: plan list parsing, health rows, the plan log and the debug view. Everything is mocked."""
import asyncio
import importlib
import time
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

STUBS = {name: ModuleType(name) for name in (
    "homeassistant", "homeassistant.const", "homeassistant.core", "homeassistant.helpers",
    "homeassistant.helpers.entity_registry", "homeassistant.helpers.event", "homeassistant.helpers.storage",
    "homeassistant.helpers.dispatcher")}
STUBS["homeassistant.const"].EVENT_CALL_SERVICE = "call_service"
STUBS["homeassistant.core"].callback = lambda func: func
STUBS["homeassistant.helpers"].entity_registry = STUBS["homeassistant.helpers.entity_registry"]
STUBS["homeassistant.helpers.event"].async_track_state_change_event = lambda hass, ids, cb: (lambda: None)
SENT = []
STUBS["homeassistant.helpers.dispatcher"].async_dispatcher_send = lambda hass, signal, *args: SENT.append((signal, args))
STUBS["homeassistant.helpers.event"].async_track_time_interval = lambda hass, cb, interval: (lambda: None)


class FakeStore:
    """Stands in for the Home Assistant storage helper: keeps what was saved in memory."""
    saved = {}

    def __init__(self, hass, version, key):
        self.key = key

    async def async_load(self):
        return FakeStore.saved.get(self.key)

    async def async_save(self, data):
        FakeStore.saved[self.key] = data

    def async_delay_save(self, producer, delay):
        FakeStore.saved[self.key] = producer()
        FakeStore.delayed = delay


STUBS["homeassistant.helpers.storage"].Store = FakeStore
package = ModuleType("dcplan")
package.__path__ = [str(Path(__file__).resolve().parents[1] / "custom_components/deepal_companion")]
with patch.dict(sys.modules, {**STUBS, "dcplan": package}):
    plan_health = importlib.import_module("dcplan.plan_health")

PLACEHOLDER = {"planId": 1, "isValid": 0, "startTime": "0100", "endTime": "2300"}


def coordinator(plans, log=None):
    condition = SimpleNamespace(raw_data={"charge": {"chargePlanList": plans}} if plans is not None else {})
    return SimpleNamespace(data={"car": condition}, vehicles=[SimpleNamespace(car_id="car")], async_add_listener=lambda cb: (lambda: None))


def info_for(plans, switch="on"):
    parsed = plan_health.read_plans(coordinator(plans), "car")
    return {"plans": parsed, "switch": switch, "facts": plan_health.analyse(parsed, switch) if parsed is not None else None}


class Parsing(unittest.TestCase):
    def test_plans_keep_order_and_flag_the_default_plan(self):
        plans = plan_health.read_plans(coordinator([
            {"planId": 2123, "isValid": 1, "startTime": "0000", "endTime": "0800"}, PLACEHOLDER]), "car")
        self.assertEqual([p["id"] for p in plans], ["2123", "1"])
        self.assertEqual((plans[0]["start"], plans[0]["end"], plans[0]["active"]), ("00:00", "08:00", True))
        self.assertTrue(plans[1]["placeholder"])
        self.assertFalse(plans[1]["active"])

    def test_missing_list_is_none_not_empty(self):
        self.assertIsNone(plan_health.read_plans(coordinator(None), "car"))
        self.assertEqual(plan_health.read_plans(coordinator([]), "car"), [])

    def test_mqtt_vehicle_reads_the_plan_list_copied_into_the_battery(self):
        condition = SimpleNamespace(raw_data={}, battery=SimpleNamespace(charge_plans=[
            {"planId": 7, "isValid": 1, "startTime": "2300", "endTime": "0700"}, PLACEHOLDER]))
        coord = SimpleNamespace(data={"car": condition})
        plans = plan_health.read_plans(coord, "car")
        self.assertEqual([(p["id"], p["active"], p["start"], p["end"]) for p in plans], [("7", True, "23:00", "07:00"), ("1", False, "01:00", "23:00")])

    def test_empty_battery_list_means_not_loaded_yet(self):
        condition = SimpleNamespace(raw_data={}, battery=SimpleNamespace(charge_plans=[]))
        self.assertIsNone(plan_health.read_plans(SimpleNamespace(data={"car": condition}), "car"))

    def test_raw_list_wins_over_the_battery_copy(self):
        condition = SimpleNamespace(raw_data={"charge": {"chargePlanList": [PLACEHOLDER]}}, battery=SimpleNamespace(charge_plans=[{"planId": 7, "isValid": 1}]))
        self.assertEqual([p["id"] for p in plan_health.read_plans(SimpleNamespace(data={"car": condition}), "car")], ["1"])

    def test_bad_entries_are_skipped(self):
        plans = plan_health.read_plans(coordinator(["x", {"isValid": 1}, PLACEHOLDER]), "car")
        self.assertEqual([p["id"] for p in plans], ["1"])


class Checks(unittest.TestCase):
    def row(self, plans, switch="on"):
        rows = plan_health.plan_checks(info_for(plans, switch))
        self.assertEqual(len(rows), 1)
        return rows[0]

    def test_no_row_without_plan_entities(self):
        self.assertEqual(plan_health.plan_checks(None), [])

    def test_active_plan_is_ok_and_shows_times(self):
        row = self.row([{"planId": 22, "isValid": 1, "startTime": "0000", "endTime": "1500"}, PLACEHOLDER])
        self.assertEqual((row["id"], row["status"]), ("plan", "ok"))
        self.assertIn("00:00 to 15:00", row["detail"])

    def test_off_plan_is_ok(self):
        row = self.row([{"planId": 22, "isValid": 0, "startTime": "0000", "endTime": "1500"}, PLACEHOLDER], switch="off")
        self.assertEqual(row["status"], "ok")
        self.assertIn("Plan off", row["detail"])

    def test_an_off_app_plan_with_the_switch_on_is_a_disagreement(self):
        # Live S05 PHEV: plan 1 is the plan saved in the app or on the car, not a placeholder.
        row = self.row([PLACEHOLDER], switch="on")
        self.assertEqual(row["status"], "warning")

    def test_the_first_plan_is_the_one_followed_and_short_times_are_padded(self):
        # The car and the app follow only the first entry, even when an older one is active.
        first = {"planId": 6, "isValid": 1, "startTime": "930", "endTime": "1700"}
        older = {"planId": 1, "isValid": 1, "startTime": "0300", "endTime": "0900"}
        facts = plan_health.analyse(plan_health.read_plans(coordinator([first, older]), "car"), "on")
        self.assertEqual((facts["shown"]["id"], facts["shown"]["start"], facts["mismatch"]), ("6", "09:30", False))
        self.assertEqual([p["id"] for p in facts["older_active"]], ["1"])
        plans = plan_health.read_plans(coordinator([first, older]), "car")
        self.assertEqual([(p["followed"], p["source"]) for p in plans], [(True, "home_assistant"), (False, "app_or_car")])

    def test_an_off_app_plan_shows_its_times(self):
        row = self.row([PLACEHOLDER], switch="off")
        self.assertEqual((row["status"], row["detail"]), ("ok", "Plan off, 01:00 to 23:00."))

    def test_a_plan_without_an_end_charges_until_full(self):
        full = {"planId": 1, "isValid": 1, "startTime": "1402"}
        row = self.row([full], switch="on")
        self.assertEqual((row["status"], row["detail"]), ("ok", "Plan on, from 14:02 until full."))
        row = self.row([{**full, "isValid": 0}], switch="off")
        self.assertEqual(row["detail"], "Plan off, from 14:02 until full.")

    def test_an_older_active_record_warns(self):
        row = self.row([{"planId": 3, "isValid": 1, "startTime": "0000", "endTime": "0800"},
                        {"planId": 1, "isValid": 1, "startTime": "0300", "endTime": "0900"}, PLACEHOLDER])
        self.assertEqual(row["status"], "warning")
        self.assertEqual(row["args"], ["1"])

    def test_plan_changes_tell_records_with_the_same_id_apart(self):
        def parse(raw):
            return plan_health.read_plans(coordinator(raw), "car")
        a = {"planId": 1, "isValid": 1, "startTime": "1402"}
        b = {"planId": 1, "isValid": 0, "startTime": "0300", "endTime": "0900"}
        # A new save adds a record with the same id on top: only that one is "added".
        events = plan_health.plan_changes(parse([b]), parse([a, b]))
        self.assertEqual([(e, p["start"]) for e, p in events], [("plan_added", "14:02")])
        # A time edit of the followed plan is a change, not removed + added.
        events = plan_health.plan_changes(parse([a, b]), parse([{**a, "startTime": "1400"}, b]))
        self.assertEqual([(e, p["start"]) for e, p in events], [("plan_changed", "14:00")])
        # Only the state changed: one change, matched by id and times.
        events = plan_health.plan_changes(parse([a, b]), parse([{**a, "isValid": 0}, b]))
        self.assertEqual([(e, p["active"]) for e, p in events], [("plan_changed", False)])
        # Identical records are matched in order; removing one is one "removed".
        events = plan_health.plan_changes(parse([b, b]), parse([b]))
        self.assertEqual([e for e, _ in events], ["plan_removed"])

    def test_switch_and_car_disagreeing_warns(self):
        row = self.row([{"planId": 3, "isValid": 0, "startTime": "0000", "endTime": "0800"}, PLACEHOLDER], switch="on")
        self.assertEqual(row["status"], "warning")

    def test_unavailable_switch_does_not_warn(self):
        row = self.row([{"planId": 3, "isValid": 1, "startTime": "0000", "endTime": "0800"}], switch="unavailable")
        self.assertEqual(row["status"], "ok")

    def test_missing_list_is_not_a_problem_and_falls_back_to_the_entities(self):
        row = plan_health.plan_checks({"plans": None, "switch": "on", "facts": None, "times": {"start": "01:00", "end": "08:00"}})[0]
        self.assertEqual((row["status"], row["detail"]), ("ok", "Plan on, 01:00 to 08:00."))
        row = plan_health.plan_checks({"plans": None, "switch": "off", "facts": None, "times": {"start": "01:00", "end": "08:00"}})[0]
        self.assertEqual((row["status"], row["detail"]), ("ok", "Plan off, 01:00 to 08:00."))

    def test_missing_list_without_entity_values_is_still_ok(self):
        row = plan_health.plan_checks({"plans": None, "switch": "unavailable", "facts": None, "times": {"start": None, "end": None}})[0]
        self.assertEqual((row["status"], row["detail"], row["fix"]), ("ok", "The plan list from the car is not available yet.", ""))

    def test_entity_time_trims_seconds_and_ignores_bad_states(self):
        self.assertEqual(plan_health.entity_time(SimpleNamespace(state="01:00:00")), "01:00")
        self.assertIsNone(plan_health.entity_time(SimpleNamespace(state="unavailable")))
        self.assertIsNone(plan_health.entity_time(None))


class Log(unittest.TestCase):
    def log(self, tracked=("switch.s05_charge_schedule",)):
        log = plan_health.PlanLog(SimpleNamespace(hass=None))
        log.tracked = tracked
        return log

    @staticmethod
    def service(domain, service, data):
        return SimpleNamespace(data={"domain": domain, "service": service, "service_data": data})

    def test_card_service_call_is_recorded(self):
        log = self.log()
        log._watched = SimpleNamespace(vehicles=[object()])
        log._service(self.service("deepal", "set_charge_schedule", {"start_time": "00:00", "end_time": "08:00", "enabled": True}))
        row = log.rows[0]
        self.assertEqual((row["event"], row["service"]), ("service", "deepal.set_charge_schedule"))
        self.assertEqual(row["data"], {"start_time": "00:00", "end_time": "08:00", "enabled": True})

    def test_untargeted_service_call_is_skipped_when_there_are_several_vehicles(self):
        log = self.log()
        log._watched = SimpleNamespace(vehicles=[object(), object()])
        log._service(self.service("deepal", "set_charge_schedule", {"start_time": "00:00", "end_time": "08:00", "enabled": True}))
        log._service(self.service("deepal", "set_charge_schedule", {"entity_id": "switch.s05_charge_schedule", "enabled": True}))
        self.assertEqual(len(log.rows), 1)

    def test_switch_call_only_counts_for_the_plan_entity(self):
        log = self.log()
        log._service(self.service("switch", "turn_off", {"entity_id": "switch.s05_charge_schedule"}))
        log._service(self.service("switch", "turn_off", {"entity_id": "switch.kitchen"}))
        log._service(self.service("light", "turn_on", {"entity_id": "light.x"}))
        self.assertEqual(len(log.rows), 1)

    def test_state_change_recorded_only_when_the_state_differs(self):
        log = self.log()
        state = lambda value: SimpleNamespace(state=value, entity_id="switch.s05_charge_schedule")
        log._state(SimpleNamespace(data={"old_state": state("on"), "new_state": state("on")}))
        log._state(SimpleNamespace(data={"old_state": state("on"), "new_state": state("off")}))
        log._state(SimpleNamespace(data={"old_state": state("off"), "new_state": None}))
        self.assertEqual([(r["old"], r["new"]) for r in log.rows], [("on", "off")])

    def test_log_keeps_seven_days_and_drops_older_rows(self):
        log = self.log()
        now = time.time()
        log.rows.extend([{"time": now - 8 * 86400, "source": "ha", "event": "state"},
                         {"time": now - 6.9 * 86400, "source": "ha", "event": "state"},
                         {"time": now - 60, "source": "ha", "event": "state"}])
        log.prune()
        self.assertEqual(len(log.rows), 2)
        self.assertEqual(plan_health.RETENTION, 7 * 86400)

    def test_open_health_pages_are_told_when_the_plan_activity_changes(self):
        log = plan_health.PlanLog(SimpleNamespace(hass=None, vehicle="s05"))
        SENT.clear()
        log.add("state", entity="switch.s05_charge_schedule", old="on", new="off")
        self.assertEqual(SENT, [(plan_health.PLAN_SIGNAL, ("s05",))])

    def test_a_plan_the_car_adds_or_removes_is_pushed_once_per_change(self):
        log = plan_health.PlanLog(SimpleNamespace(hass=None, vehicle="s05"))
        log._entities = {"switch": "switch.s05_charge_schedule"}
        def plan(pid, on):
            return {"id": str(pid), "active": on, "start": "01:00", "end": "08:00", "placeholder": False}
        feed = [[plan(7, True)]]
        with patch.object(plan_health, "find_source", return_value=(coordinator(None), "car")), \
             patch.object(plan_health, "read_plans", side_effect=lambda c, i: list(feed[0])):
            log.watch()          # first look is only the starting point
            SENT.clear()
            log.watch()          # nothing changed
            self.assertEqual(SENT, [])
            feed[0] = [plan(7, True), plan(8, False)]
            log.watch()
            self.assertEqual(len(SENT), 1)
            feed[0] = [plan(8, False)]
            log.watch()
            self.assertEqual(len(SENT), 2)

    def test_log_memory_is_bounded(self):
        log = self.log()
        for index in range(plan_health.MAX_ROWS + 20):
            log.add("state", entity="switch.x", old="a", new=str(index))
        self.assertEqual(len(log.rows), plan_health.MAX_ROWS)

    def test_service_data_that_is_not_json_is_made_plain(self):
        log = self.log()
        log._service(self.service("time", "set_value", {"entity_id": "switch.s05_charge_schedule", "value": SimpleNamespace()}))
        self.assertIsInstance(log.rows[0]["data"]["value"], str)

    def test_the_log_survives_a_restart_and_leaves_out_old_rows(self):
        FakeStore.saved = {}
        runtime = SimpleNamespace(hass=SimpleNamespace(bus=SimpleNamespace(async_listen=lambda *a: (lambda: None))), vehicle="Veh-1", _device_id=None)
        first = plan_health.PlanLog(runtime)
        asyncio.run(first.start())
        first.add("state", entity="switch.x", old="off", new="on")
        asyncio.run(first.stop())
        key = "deepal_companion_plan_log_veh_1"
        self.assertEqual(len(FakeStore.saved[key]["rows"]), 1)
        FakeStore.saved[key]["rows"].append({"time": time.time() - 9 * 86400, "source": "ha", "event": "state"})
        second = plan_health.PlanLog(runtime)
        asyncio.run(second.start())
        self.assertEqual([row["new"] for row in second.rows], ["on"])
        asyncio.run(second.stop())

    def test_a_damaged_saved_log_starts_a_new_one(self):
        FakeStore.saved = {"deepal_companion_plan_log_veh_2": {"rows": ["x", {"time": "bad", "event": "state"}, {"event": "state"}]}}
        runtime = SimpleNamespace(hass=SimpleNamespace(bus=SimpleNamespace(async_listen=lambda *a: (lambda: None))), vehicle="veh_2", _device_id=None)
        log = plan_health.PlanLog(runtime)
        asyncio.run(log.start())
        self.assertEqual(len(log.rows), 0)
        asyncio.run(log.stop())

    def test_plan_list_changes_are_logged_from_the_car_side(self):
        log = self.log()
        log._entities = {"switch": "switch.s05_charge_schedule"}
        log.runtime = SimpleNamespace(hass=None)
        listeners = []
        plans = [{"planId": 1, "isValid": 0, "startTime": "0100", "endTime": "2300"}]
        coord = coordinator(plans)
        coord.async_add_listener = lambda cb: listeners.append(cb) or (lambda: None)
        with patch.object(plan_health, "find_source", return_value=(coord, "car")):
            log.watch()
            self.assertEqual(len(log.rows), 0)  # the first look is only the starting point
            log.watch()
            self.assertEqual(len(listeners), 1)  # listens once
            coord.data["car"].raw_data = {"charge": {"chargePlanList": [{"planId": 9, "isValid": 1, "startTime": "0000", "endTime": "0800"}] + plans}}
            log.watch()
            coord.data["car"].raw_data = {"charge": {"chargePlanList": [{"planId": 9, "isValid": 0, "startTime": "0000", "endTime": "0800"}] + plans}}
            log.watch()
            coord.data["car"].raw_data = {"charge": {"chargePlanList": plans}}
            log.watch()
        self.assertEqual([(r["event"], r["plan_id"], r["source"]) for r in log.rows],
                         [("plan_added", "9", "deepal"), ("plan_changed", "9", "deepal"), ("plan_removed", "9", "deepal")])


class DebugView(unittest.TestCase):
    def runtime(self, plans, deepal_log, own_log):
        hass = SimpleNamespace(states=SimpleNamespace(get=lambda entity: SimpleNamespace(state="on")))
        own = plan_health.PlanLog(SimpleNamespace(hass=None))
        own._entities = {"switch": "switch.s05_charge_schedule"}
        now = time.time()
        own.rows.extend({**row, "time": now - 1000 + row["time"]} for row in own_log)
        return SimpleNamespace(hass=hass, plan_log=own, _device_id="dev"), coordinator(plans, deepal_log)

    def test_view_lists_the_log_newest_first_and_names_the_shown_plan(self):
        plans = [{"planId": 9, "isValid": 1, "startTime": "0000", "endTime": "0800"}, PLACEHOLDER]
        runtime, coord = self.runtime(plans, [],
                                      [{"time": 10, "source": "ha", "event": "state", "entity": "switch.x", "old": "off", "new": "on"},
                                       {"time": 30, "source": "ha", "event": "service", "service": "deepal.set_charge_schedule", "entities": [], "data": {}}])
        with patch.object(plan_health, "plan_entities", return_value={"switch": "switch.s05_charge_schedule"}), \
                patch.object(plan_health, "find_source", return_value=(coord, "car")):
            view = plan_health.debug_view(runtime)
        self.assertTrue(view["available"])
        self.assertEqual((view["shown"], view["active"], view["switch"]), ("9", ["9"], "on"))
        self.assertEqual([r["event"] for r in view["log"]], ["service", "state"])
        self.assertEqual(view["retention_days"], 7)

    def test_view_before_the_first_vehicle_update_is_pending_and_carries_the_entity_times(self):
        runtime, coord = self.runtime(None, [], [])
        runtime.hass.states.get = lambda entity: SimpleNamespace(state={"switch.s05_charge_schedule": "on", "time.start": "01:00:00", "time.end": "08:00:00"}.get(entity))
        entities = {"switch": "switch.s05_charge_schedule", "start": "time.start", "end": "time.end"}
        with patch.object(plan_health, "plan_entities", return_value=entities), \
                patch.object(plan_health, "find_source", return_value=(coord, "car")):
            view = plan_health.debug_view(runtime)
        self.assertTrue(view["pending"])
        self.assertEqual((view["plans"], view["times"], view["switch"]), ([], {"start": "01:00", "end": "08:00"}, "on"))

    def test_vehicle_without_plan_entities_is_unavailable(self):
        runtime, _ = self.runtime([], [], [])
        with patch.object(plan_health, "plan_entities", return_value={}):
            self.assertEqual(plan_health.debug_view(runtime), {"available": False, "plans": [], "log": []})


if __name__ == "__main__":
    unittest.main()
