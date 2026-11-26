"""API contract tests with explicit lightweight HA interface doubles."""
import copy
import asyncio
from datetime import datetime, timezone
import importlib
from pathlib import Path
import sys
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
pkg = types.ModuleType("companion_api_test")
pkg.__path__ = [str(ROOT / "custom_components" / "deepal_companion")]
sys.modules[pkg.__name__] = pkg


def module(name, **values):
    obj = types.ModuleType(name)
    obj.__dict__.update(values)
    obj.__path__ = []
    sys.modules[name] = obj
    return obj


identity = lambda fn: fn
module("homeassistant")
module("homeassistant.auth")
module("homeassistant.auth.permissions")
module("homeassistant.auth.permissions.const", POLICY_READ="read", POLICY_CONTROL="control")
module("homeassistant.components")
module("homeassistant.components.websocket_api", websocket_command=lambda schema: identity, async_response=identity)
module("homeassistant.core", callback=identity)
module("homeassistant.helpers")
module("homeassistant.helpers.dispatcher", async_dispatcher_connect=lambda *args: lambda: None)
module("homeassistant.util")
dt = module("homeassistant.util.dt", parse_datetime=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")))
sys.modules["homeassistant.util"].dt = dt
api = importlib.import_module("companion_api_test.api")
Database = importlib.import_module("companion_api_test.database").Database
DEFAULT_PROFILES = importlib.import_module("companion_api_test.const").DEFAULT_PROFILES


class Connection:
    def __init__(self, admin=True, allowed=True):
        self.results, self.errors = [], []
        self.user = types.SimpleNamespace(id="user", is_admin=admin, permissions=types.SimpleNamespace(check_entity=lambda entity, rule: allowed and entity != "sensor.secret"))
    def send_result(self, ident, result=None):
        self.results.append(result)
    def send_error(self, ident, code, message):
        self.errors.append((code, message))


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_deleting_all_profiles_keeps_receipt_snapshot(self):
        import copy
        settings=self.db.get('car','costs')
        receipt={'profile':copy.deepcopy(settings['profiles'][0]),'total':7.25,'capacity':18.4}
        settings['sessions']={'1700000000':receipt}
        self.db.put('car','costs',settings)
        result=await self.request('costs_set',{'changes':{'profiles':[]},'expected_changes':{'profiles':settings['profiles']}})
        self.assertFalse(result.errors)
        saved=self.db.get('car','costs')
        self.assertEqual(saved['profiles'],[])
        self.assertEqual(saved['sessions']['1700000000'],receipt)

    async def test_preconditioning_commands_need_control_permission(self):
        started = []
        async def request_start(temperature, duration, source=None):
            started.append(source); return {"ok": True}
        async def request_stop(source=None):
            started.append("stop"); return {"ok": True}
        self.hub.vehicles["car"].preconditioning = types.SimpleNamespace(entity=lambda logical: "climate.s05_cabin_climate", request_start=request_start, request_stop=request_stop, snapshot=lambda: {})
        def user(control):
            connection = Connection()
            connection.user.permissions.check_entity = lambda entity, rule: rule == "read" or (control and entity == "climate.s05_cabin_climate")
            return connection
        for op in ("precondition_start", "precondition_stop"):
            refused = await self.request(op, {"temperature": 21, "duration": 10}, user(False))
            self.assertTrue(refused.errors and not refused.results, op + " must be refused without control permission")
            allowed = await self.request(op, {"temperature": 21, "duration": 10}, user(True))
            self.assertTrue(allowed.results and not allowed.errors, allowed.errors)
        self.assertEqual(started, ["manual", "stop"])
        async def refresh_now():
            return {"fresh": True}
        self.hub.vehicles["car"].preconditioning.refresh_now = refresh_now
        refused = await self.request("precondition_refresh", {}, user(False))
        self.assertTrue(refused.errors and not refused.results, "refreshing the car data needs control permission")
        allowed = await self.request("precondition_refresh", {}, user(True))
        self.assertTrue(allowed.results and not allowed.errors, allowed.errors)
        reading = await self.request("precondition_get", {}, user(False))
        self.assertTrue(reading.results and not reading.errors, "reading the state needs only read access")

    async def test_history_requests_have_a_bounded_time_window(self):
        result = await self.request('history', {'entity_ids': ['sensor.batt'], 'start_time': 0, 'end_time': 4*365*86400})
        self.assertTrue(result.errors)
        self.assertIn('366 days', result.errors[0][1])
        recent = await self.request('history', {'entity_ids': ['sensor.batt']})
        self.assertFalse(recent.errors)

    async def test_receipt_delta_stays_small_for_a_multi_year_archive(self):
        import copy
        import json
        settings = self.db.get('car', 'costs')
        record = {'profile': copy.deepcopy(DEFAULT_PROFILES[0]), 'capacity': 18.4, 'energy': 12, 'total': 4.2}
        settings['sessions'] = {str(1700000000+i*3600): copy.deepcopy(record) for i in range(10000)}
        self.db.put('car', 'costs', settings)
        ident = '1700000000'
        changed = {**record, 'total': 5.4}
        data = {'changes': {'sessions': {ident: changed}}, 'expected_changes': {'sessions': {ident: record}}}
        self.assertLess(len(json.dumps(data)), 2000)
        self.assertGreater(len(json.dumps({'value': settings, 'expected': settings})), 2_000_000)
        result = await self.request('costs_set', data)
        self.assertFalse(result.errors)
        saved = self.db.get('car', 'costs')
        self.assertEqual(len(saved['sessions']), 10000)
        self.assertEqual(saved['sessions'][ident]['total'], 5.4)
        self.assertEqual(saved['sessions']['1700003600']['total'], 4.2)

    async def test_receipt_deltas_reject_conflicts_but_allow_independent_edits(self):
        import copy
        record = {'profile': copy.deepcopy(DEFAULT_PROFILES[0]), 'total': 4.2}
        settings = self.db.get('car', 'costs')
        settings['sessions'] = {'1700000000': copy.deepcopy(record), '1700003600': copy.deepcopy(record)}
        self.db.put('car', 'costs', settings)
        for ident in settings['sessions']:
            result = await self.request('costs_set', {'changes': {'sessions': {ident: {**record, 'total': 5.4}}},
                                                    'expected_changes': {'sessions': {ident: record}}})
            self.assertFalse(result.errors)
        stale = await self.request('costs_set', {'changes': {'sessions': {'1700000000': record}},
                                               'expected_changes': {'sessions': {'1700000000': record}}})
        self.assertTrue(stale.errors)
        self.assertEqual(self.db.get('car', 'costs')['sessions']['1700000000']['total'], 5.4)

    async def test_cost_deltas_require_admin_valid_fields_and_expected_values(self):
        data = {'changes': {'profiles': DEFAULT_PROFILES}, 'expected_changes': {'profiles': DEFAULT_PROFILES}}
        self.assertEqual((await self.request('costs_set', data, Connection(admin=False))).errors[0][0], 'unauthorized')
        for invalid in ({'changes': {}}, {'changes': {'unknown': 1}}, {'changes': {'profiles': None}},
                        {'changes': {'profiles': DEFAULT_PROFILES}}, {'changes': {'sessions': None}}):
            self.assertTrue((await self.request('costs_set', invalid)).errors)

    async def asyncSetUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(str(Path(self.tmp.name) / "test.sqlite"))
        self.db.initialize()
        self.db.ensure_vehicle("car", "Car", {"prefix": "s05", "battery_entity": "sensor.batt", "entities": {}})
        self.view = self.db.list_vehicles()[0]["views"][0]["id"]
        async def db(method, *args):
            return getattr(self.db, method)(*args)
        async def read_db(load):
            return load(self.db)
        async def refresh():
            pass
        async def sessions(start, end):
            return self.db.sessions("car", start, end)
        runtime = types.SimpleNamespace(entry=types.SimpleNamespace(data={"battery_entity": "sensor.batt"}, options={}), refresh=refresh, priced_sessions=sessions)
        self.hub = types.SimpleNamespace(db=db, read_db=read_db, vehicles={"car": runtime}, setting_keys={"car_color", "battery_kwh", "charge_target", "entities", "prefix", "companion_design", "companion_width", "charge_prompt_min_gain", "charge_prompt_recent", "charge_spike_jump"}, changed=lambda vehicle: None)
        self.hass = types.SimpleNamespace(data={"deepal_companion": self.hub},
                                          async_add_executor_job=lambda fn, *args: asyncio.get_running_loop().run_in_executor(None, fn, *args))

    async def asyncTearDown(self):
        self.tmp.cleanup()

    async def request(self, op, data=None, connection=None, **extra):
        connection = connection or Connection()
        if op == "config_patch" and "expected_revision" not in (data or {}):  # the card always sends the revision it edited
            data = {**(data or {}), "expected_revision": self.db.config("car", self.view)["revision"]}
        await api.request(self.hass, connection, {"id": 1, "type": "deepal_companion/request", "op": op, "vehicle_id": "car", "view_id": self.view, "data": data or {}, **extra})
        return connection

    async def test_settings_get_reads_profile_vehicle_and_integration_in_one_call(self):
        self.hub.update_rate = 300
        self.hub.card_panel_in_sidebar = False
        self.hub.card_panel_pin = {"vehicle_id": "", "view_id": "", "design": ""}
        admin = await self.request("settings_get")
        result = admin.results[0]
        self.assertFalse(admin.errors)
        self.assertEqual(result["profile"]["view_id"], self.view)
        self.assertNotIn("_settings_schema", result["profile"]["config"])
        self.assertNotIn("battery_entity", result["vehicle"]["config"])
        self.assertEqual(result["integration"]["update_rate"], 300)
        self.assertIn("language", result["integration"])
        self.assertTrue(result["integration"]["can_edit"])
        self.assertTrue(result["integration"]["card_panel"]["can_edit"])
        # Without a vehicle the integration part still loads; a non-admin sees the same reads but cannot edit.
        plain = await self.request("settings_get", connection=Connection(admin=False), vehicle_id=None)
        self.assertFalse(plain.errors)
        self.assertIsNone(plain.results[0]["profile"])
        self.assertFalse(plain.results[0]["integration"]["can_edit"])

    async def test_charge_target_accepts_goals_and_rejects_out_of_range(self):
        accepted = await self.request('config_patch', {'patch': {'charge_target': 80}})
        self.assertTrue(accepted.results, accepted.errors)
        self.assertTrue(accepted.results and not accepted.errors)
        for bad in (101, -1, True):
            rejected = await self.request('config_patch', {'patch': {'charge_target': bad}})
            self.assertTrue(rejected.errors, 'charge_target %r must be refused' % (bad,))

    async def test_charge_target_save_reaches_the_runtime_and_the_charger_limit(self):
        runtime = self.hub.vehicles["car"]
        runtime.config, runtime._summary_revision, evaluated = {"charge_target": 0}, 0, []
        runtime.hub, runtime.vehicle = self.hub, "car"
        async def evaluate():
            evaluated.append(runtime.config["charge_target"])
        runtime.charger_limit = types.SimpleNamespace(evaluate=evaluate, _spawn=lambda coro: asyncio.ensure_future(coro))
        done = await self.request('config_patch', {'patch': {'charge_target': 75}})
        self.assertTrue(done.results, done.errors)
        await asyncio.sleep(0)
        self.assertEqual(runtime.config["charge_target"], 75)
        self.assertEqual(evaluated, [75])

    async def test_start_hint_dismissal_is_saved_per_user(self):
        def as_user(ident, admin=True):
            c = Connection(admin=admin); c.user.id = ident; return c
        self.assertFalse((await self.request("user_hint_get", {}, as_user("a"))).results[0]["dismissed"])
        self.assertTrue((await self.request("user_hint_dismiss", {}, as_user("a"))).results[0]["dismissed"])
        self.assertTrue((await self.request("user_hint_get", {}, as_user("a"))).results[0]["dismissed"], "stays dismissed")
        self.assertFalse((await self.request("user_hint_get", {}, as_user("b", admin=False))).results[0]["dismissed"], "other users still see it")
        self.assertTrue((await self.request("user_hint_dismiss", {"hint": "other"}, as_user("b"))).errors, "only the known hint can be saved")

    async def test_all_views_are_listed(self):
        c = await self.request("list")
        self.assertEqual(len(c.results[0][0]["views"]), 3)

    async def test_page_api_validates_limit_and_cursor(self):
        for data in ({"limit": 1000}, {"limit": True}, {"before": -1}, {"before": "bad"}, {"sort":"bad"}, {"sort":"highest","before":5}, {"sort":"lowest","before":{"start":1,"cost":-1}}):
            self.assertTrue((await self.request("sessions_page", data)).errors)
        async def page(before, limit, location="", sort="newest"):
            return self.db.session_page("car", before, limit)
        self.hub.vehicles["car"].session_page = page
        result = await self.request("sessions_page", {"limit": 5})
        self.assertEqual(result.results[0]["rows"], [])
        self.assertFalse(result.results[0]["has_more"])

    async def test_recorder_recovery_checkpoint_only_written_on_completed_import(self):
        self.hub.vehicles["car"]._summary_revision=0
        await self.request("sessions_import", {"rows": []})
        self.assertIsNone(self.db.get("car", "recorder_sessions_synced"))
        c=await self.request("sessions_import", {"rows": [], "sync_complete": True})
        self.assertFalse(c.errors)
        self.assertGreater(self.db.get("car", "recorder_sessions_synced"),0)

    async def test_new_notification_operations_require_admin(self):
        for op in ("notifications_get", "notifications_set", "notifications_preview", "notifications_test", "notifications_live_test", "notifications_live_stop_test", "notifications_history", "notifications_history_delete", "sessions_import"):
            c = await self.request(op, {}, Connection(admin=False))
            self.assertEqual(c.errors[0][0], "unauthorized")

    async def test_notification_card_request_during_startup_gets_a_plain_message(self):
        # The card can ask for notifications before the vehicle has finished starting: answer in plain words, do not fail.
        runtime = self.hub.vehicles["car"]
        had = hasattr(runtime, "notifications")
        saved = getattr(runtime, "notifications", None)
        if had:
            del runtime.notifications
        try:
            c = await self.request("notifications_unread", {})
            self.assertEqual(c.errors[0][0], "invalid_format")
            self.assertIn("still starting", c.errors[0][1])
        finally:
            if saved is not None:
                runtime.notifications = saved

    async def test_non_admin_export_excludes_notification_templates_and_messages(self):
        self.db.put("car", "local_notification_history", [{"message": "Private notification"}])
        c = await self.request("export", connection=Connection(admin=False))
        self.assertNotIn("notification_history", c.results[0])
        self.assertNotIn("notifications", c.results[0])
        admin = await self.request("export")
        self.assertEqual(admin.results[0]["notification_history"][0]["message"], "Private notification")

    async def test_notification_save_and_preview_api(self):
        module = importlib.import_module("companion_api_test.notifications")
        runtime = self.hub.vehicles["car"]
        runtime.hass, runtime.hub, runtime.vehicle = self.hass, self.hub, "car"
        engine = runtime.notifications = module.NotificationEngine(runtime)
        async def render(text, variables):
            return text
        engine.render = render
        rule = {"id": "test", "name": "Test", "enabled": False, "condition": "true", "title": "Vehicle", "message": "Check your vehicle", "devices": []}
        result = await self.request("notifications_set", {"value": {"enabled": False, "rules": [rule]}, "expected": {"enabled": False, "rules": []}})
        self.assertFalse(result.errors)
        stored = self.db.get("car", "local_notifications")
        self.assertEqual(stored["rules"][0]["message"], "Check your vehicle")
        preview = await self.request("notifications_preview", {"rule": stored["rules"][0]})
        self.assertTrue(preview.results[0]["active"])
        conflict = await self.request("notifications_set", {"value": {"enabled": False, "rules": []}, "expected": {"enabled": False, "rules": []}})
        # A stale save is three-way merged: the stored rule was added elsewhere, and this save did not touch it.
        self.assertFalse(conflict.errors)
        self.assertEqual(len(self.db.get("car", "local_notifications")["rules"]), 1)
        await engine.record(stored["rules"][0], "test", title="Test", message="Phone alert")
        activity = await self.request("notifications_history", {"limit": 5})
        self.assertEqual(len(activity.results[0]["rows"]), 1)
        ident = activity.results[0]["rows"][0]["id"]
        invalid = await self.request("notifications_history_delete", {"id": None})
        self.assertTrue(invalid.errors)
        self.assertEqual(len(engine.history), 1)
        deleted = await self.request("notifications_history_delete", {"id": ident})
        self.assertFalse(deleted.errors)
        self.assertEqual(deleted.results[0]["total"], 0)
        self.assertEqual(len(engine.config["rules"]), 1)

    async def test_session_import_validates_before_writing(self):
        row = {"s": 1000000, "e": 2000000, "from": 20, "to": 80, "kwh": 11, "capacity": 18.4}
        for bad in ({**row, "live": True}, {**row, "kwh": float("inf")}, {**row, "to": 10}):
            c = await self.request("sessions_import", {"rows": [bad]})
            self.assertTrue(c.errors)
        self.assertFalse(self.db.sessions("car"))
        self.hub.vehicles["car"]._summary_revision = 0
        c = await self.request("sessions_import", {"rows": [row]})
        self.assertFalse(c.errors)
        self.assertEqual(c.results[0]["imported"], 1)
        self.assertEqual((await self.request("sessions_import", {"rows": [row]})).results[0]["imported"], 0)

    async def test_curve_api_retains_imported_readings_and_rejects_invalid_points(self):
        self.hub.vehicles['car']._summary_revision=0
        self.hub.vehicles['car'].entities={}
        row={'s':1000000,'e':2000000,'from':20,'to':80,'kwh':11,'capacity':18.4,'curve':{'ac':[[1000000,8],[1500000,16]]}}
        rejected=await self.request('sessions_import',{'rows':[{**row,'curve':{'ac':[[1000000,'bad']]}}]})
        self.assertTrue(rejected.errors)
        saved=await self.request('sessions_import',{'rows':[row],'sync_complete':True,'curve_version':1})
        self.assertFalse(saved.errors)
        self.assertEqual(self.db.get('car','recorder_curves_synced'),1)
        ident=self.db.sessions('car')[0]['id']
        result=await self.request('session_curve',{'session_id':ident})
        self.assertEqual(result.results[0]['series']['ac'][1]['s'],16)
        self.assertTrue((await self.request('session_curve',{'session_id':'missing'})).errors)

    async def test_config_patch_persists(self):
        c = await self.request("config_patch", {"patch": {"car_color": "blue"}})
        self.assertFalse(c.errors)
        self.assertEqual(c.results[0]["config"]["car_color"], "blue")

    async def test_config_patch_reloads_only_what_the_patch_touches(self):
        runtime = self.hub.vehicles["car"]
        calls = []
        async def counted_refresh():
            calls.append("refresh")
        runtime.refresh = counted_refresh
        runtime.hub, runtime.vehicle = self.hub, "car"
        # 1. The entity mapping changed: the full refresh runs once.
        runtime._summary_revision = 0
        result = await self.request("config_patch", {"patch": {"entities": {"batt": "sensor.battery_level"}}})
        self.assertFalse(result.errors)
        self.assertEqual(calls, ["refresh"])
        # 2. A shared setting changed: no full refresh, the vehicle settings are read again and the summary revision moves.
        calls.clear()
        runtime._summary_revision = 0
        runtime.config = "stale"
        result = await self.request("config_patch", {"patch": {"battery_kwh": 60}})
        self.assertFalse(result.errors)
        self.assertEqual(calls, [])
        self.assertEqual(runtime._summary_revision, 1)
        self.assertEqual(runtime.config["battery_kwh"], 60)
        # 3. A profile-only setting changed: nothing is reloaded.
        calls.clear()
        runtime._summary_revision = 0
        runtime.config = "stale"
        result = await self.request("config_patch", {"patch": {"companion_design": "tablet"}})
        self.assertFalse(result.errors)
        self.assertEqual(calls, [])
        self.assertEqual(runtime._summary_revision, 0)
        self.assertEqual(runtime.config, "stale")

    async def test_session_import_row_errors_are_unchanged_through_the_op(self):
        row = {"s": 1000000, "e": 2000000, "from": 20, "to": 80, "kwh": 11, "capacity": 18.4}
        c = await self.request("sessions_import", {"rows": [{**row, "kwh": 501}]})
        self.assertEqual(c.errors, [("invalid_format", "Invalid recovered session kwh")])
        self.assertFalse(self.db.sessions("car"))
        self.assertIsNone(api.validate_import_rows([row]))
        with self.assertRaisesRegex(ValueError, "^Only completed, continuous sessions can be archived$"):
            api.validate_import_rows([row, {**row, "live": True}])

    async def test_stale_cost_editor_cannot_overwrite_another_saved_receipt(self):
        from copy import deepcopy
        original = self.db.get("car", "costs", {})
        updated = deepcopy(original)
        updated["profiles"][0]["name"] = "Updated at home"
        first = await self.request("costs_set", {"value": updated, "expected": original})
        self.assertFalse(first.errors)
        stale = await self.request("costs_set", {"value": original, "expected": original})
        self.assertTrue(stale.errors)
        self.assertIn("changed elsewhere", stale.errors[0][1])
        self.assertEqual(self.db.get("car", "costs"), updated)

    async def test_design_and_width_validation(self):
        for patch in ({"companion_design": "unknown"}, {"companion_width": 100}, {"companion_width": 2000}, {"companion_width": True}):
            c = await self.request("config_patch", {"patch": patch})
            self.assertEqual(c.errors[0][0], "invalid_format")
        c = await self.request("config_patch", {"patch": {"companion_design": "tablet", "companion_width": 1000}})
        self.assertFalse(c.errors)
        self.assertEqual(c.results[0]["config"]["companion_width"], 1000)

    async def test_subscription_event_carries_the_revision_cards_use_to_skip_fetches(self):
        import companion_api_test.api as module_api
        callbacks = []
        original = module_api.async_dispatcher_connect
        module_api.async_dispatcher_connect = lambda hass, signal, fn: (callbacks.append(fn), lambda: None)[1]
        events = []
        class Connection2(Connection):
            subscriptions = {}
            def send_event(self, ident, payload):
                events.append(payload)
        try:
            module_api.subscribe(self.hass, Connection2(), {"id": 7})
        finally:
            module_api.async_dispatcher_connect = original
        runtime = self.hub.vehicles["car"]
        runtime.signal_revision = 4
        callbacks[0]("car")
        runtime.signal_revision = 5
        callbacks[0]("car")
        self.assertEqual([e["revision"] for e in events], [4, 5])
        self.assertTrue(all(e["vehicle_id"] == "car" for e in events))

    async def test_only_one_profile_can_be_suggested_for_new_charges(self):
        current = self.db.get('car', 'costs')['profiles']
        def attempt(flags):
            profiles = copy.deepcopy(current)
            for index, flag in flags.items():
                profiles[index]['default'] = flag
            return self.request('costs_set', {'changes': {'profiles': profiles}, 'expected_changes': {'profiles': current}})
        self.assertTrue((await attempt({0: True, 1: True})).errors)
        self.assertTrue((await attempt({0: 'yes'})).errors)
        self.assertEqual([p.get('default') for p in self.db.get('car', 'costs')['profiles']], [None] * len(current))
        self.assertFalse((await attempt({1: True})).errors)
        self.assertEqual([p['id'] for p in self.db.get('car', 'costs')['profiles'] if p.get('default')], [current[1]['id']])

    async def test_missing_field_is_named_in_plain_words(self):
        import companion_api_test.api as module_api
        original = module_api.validate_costs
        def broken(value):
            raise KeyError("profile")
        module_api.validate_costs = broken
        try:
            c = await self.request("costs_set", {"value": {"profiles": [], "sessions": {}}})
        finally:
            module_api.validate_costs = original
        self.assertEqual(c.errors[0], ("invalid_format", "Missing value: profile"))

    async def test_unknown_settings_rejected(self):
        c = await self.request("config_patch", {"patch": {"execute_python": "bad"}})
        self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_admin_required_for_shared_changes(self):
        c = await self.request("config_patch", {"patch": {"car_color": "blue"}}, Connection(admin=False))
        self.assertEqual(c.errors[0][0], "unauthorized")

    async def test_vehicle_permission_required(self):
        c = await self.request("config_get", connection=Connection(allowed=False))
        self.assertEqual(c.errors[0][0], "unauthorized")
        c = await self.request("list", connection=Connection(allowed=False))
        self.assertEqual(c.results[0], [])

    async def test_history_filters_other_entity_permissions(self):
        self.db.sample("car", "sensor.batt", 100, "80")
        self.db.sample("car", "sensor.secret", 100, "123")
        c = await self.request("history", {"entity_ids": ["sensor.batt", "sensor.secret"], "start_time": 0, "end_time": 200})
        self.assertIn("sensor.batt", c.results[0])
        self.assertNotIn("sensor.secret", c.results[0])

    async def test_cost_settings_shared_by_vehicle(self):
        value = {"profiles": DEFAULT_PROFILES, "sessions": {}}
        c = await self.request("costs_set", {"value": value})
        self.assertFalse(c.errors)
        c = await self.request("costs_get")
        self.assertEqual(c.results[0]["value"]["profiles"][1]["id"], "work")

    async def test_invalid_cost_source_rejected(self):
        import copy
        value = {"profiles": copy.deepcopy(DEFAULT_PROFILES), "sessions": {}}
        value["profiles"][0]["source"] = "execute"
        c = await self.request("costs_set", {"value": value})
        self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_extreme_receipts_and_efficiency_rejected(self):
        import copy
        for field, number in (("energy", 1e300), ("total", 1e300), ("capacity", 501)):
            value = {"profiles": copy.deepcopy(DEFAULT_PROFILES), "sessions": {
                "100": {"profile": copy.deepcopy(DEFAULT_PROFILES[0]), field: number}}}
            c = await self.request("costs_set", {"value": value})
            self.assertEqual(c.errors[0][0], "invalid_format")
        value = {"profiles": copy.deepcopy(DEFAULT_PROFILES), "sessions": {}}
        value["profiles"][0]["efficiency"] = .00001
        c = await self.request("costs_set", {"value": value})
        self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_conflicting_free_and_receipt_rejected(self):
        value = {"profiles": DEFAULT_PROFILES, "sessions": {"100": {"profile": DEFAULT_PROFILES[1], "total": 5}}}
        c = await self.request("costs_set", {"value": value})
        self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_capacities_and_entity_mappings_validated(self):
        for patch in ({"battery_kwh": -10}, {"fuel_tank_liters": True}, {"entities": {"sensor.batt": "not an entity"}}, {"prefix": "Invalid prefix"}):
            c = await self.request("config_patch", {"patch": patch})
            self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_cross_vehicle_view_is_rejected(self):
        c = await self.request("config_get", view_id="another-view")
        self.assertEqual(c.errors[0][0], "invalid_format")

    async def test_export_contains_full_archive(self):
        c = await self.request("export")
        self.assertEqual(c.results[0]["format"], "deepal_companion")
        self.assertEqual(len(c.results[0]["views"]), 3)

    async def test_charge_prompt_is_returned_and_user_can_dismiss_it(self):
        self.db.save_session('car', {'id':'charge', 's':1700000000000, 'e':1700003600000,
                                    'from':30, 'to':40, 'kwh':1.84, 'capacity':18.4, 'live':False, 'gap':False})
        result = await self.request('config_get', connection=Connection(admin=False))
        self.assertEqual(result.results[0]['charge_prompt']['id'], 'charge')
        result = await self.request('charge_prompt_dismiss', {'session_id':'charge'}, connection=Connection(admin=False))
        self.assertFalse(result.errors)
        self.assertIsNone(self.db.charge_prompt('car', 'user'))

    async def test_vehicle_access_needs_read_to_every_sensor_used(self):
        runtime = self.hub.vehicles["car"]
        runtime.hass = types.SimpleNamespace(states={"sensor.batt": 1, "sensor.secret": 1})
        runtime.entities = {"batt": "sensor.batt", "odo": "sensor.secret"}
        # Battery readable, but an existing odometer sensor is not: the whole vehicle is refused.
        result = await self.request("summary", connection=Connection(admin=False))
        self.assertEqual(result.errors[0][0], "unauthorized")
        listed = await self.request("list", connection=Connection(admin=False))
        self.assertEqual(listed.results[0], [])

    async def test_missing_optional_sensor_does_not_block_vehicle_access(self):
        runtime = self.hub.vehicles["car"]
        runtime.hass = types.SimpleNamespace(states={"sensor.batt": 1})
        runtime.entities = {"batt": "sensor.batt", "fuel": "sensor.s05_fuel_level"}  # fuel sensor does not exist
        runtime.live_entities = {"remaining": None}
        only_battery = lambda entity, rule: entity == "sensor.batt"
        connection = Connection(admin=False)
        connection.user.permissions = types.SimpleNamespace(check_entity=only_battery)
        result = await self.request("summary", connection=connection)
        self.assertFalse(connection.errors)

    async def test_costs_patch_checks_the_final_merged_state_before_saving(self):
        before = self.db.get('car', 'costs')
        def reject(value):
            raise ValueError('merged state rejected')
        with self.assertRaises(ValueError):
            self.db.patch_costs('car', {'profiles': before['profiles'][:1]}, {'profiles': before['profiles']}, reject)
        self.assertEqual(self.db.get('car', 'costs'), before)  # nothing was written
        self.db.patch_costs('car', {'profiles': before['profiles'][:1]}, {'profiles': before['profiles']}, lambda value: value)
        self.assertEqual(len(self.db.get('car', 'costs')['profiles']), 1)

    async def test_settings_save_with_an_old_revision_is_refused(self):
        revision = self.db.config('car', self.view)['revision']
        first = await self.request('config_patch', {'patch': {'car_color': 'white'}, 'expected_revision': revision})
        self.assertFalse(first.errors)
        stale = await self.request('config_patch', {'patch': {'car_color': 'black'}, 'expected_revision': revision})
        self.assertIn('changed elsewhere', stale.errors[0][1])
        self.assertEqual(self.db.config('car', self.view)['config']['car_color'], 'white')
        unchecked = await self.request('config_patch', {'patch': {'car_color': 'red'}, 'expected_revision': None})  # a save without a revision is refused
        self.assertIn('revision missing', unchecked.errors[0][1])
        self.assertEqual(self.db.config('car', self.view)['config']['car_color'], 'white')
        malformed = await self.request('config_patch', {'patch': {'car_color': 'red'}, 'expected_revision': 'x'})
        self.assertEqual(malformed.errors[0][0], 'invalid_format')

    async def test_view_only_settings_do_not_invalidate_shared_config(self):
        before = self.db.config('car', self.view)['revision']
        result = await self.request('config_patch', {'patch': {'companion_design': 'tablet'}})  # a display setting of this profile only
        self.assertFalse(result.errors, result.errors)
        after = self.db.config('car', self.view)['revision']
        self.assertEqual((after[0], after[1]), (before[0], before[1] + 1))
        await self.request('config_patch', {'patch': {'battery_kwh': 20}})
        self.assertEqual(self.db.config('car', self.view)['revision'][0], before[0] + 1)

    async def test_car_look_is_shared_between_display_profiles(self):
        before = self.db.config('car', self.view)['revision']
        await self.request('config_patch', {'patch': {'car_color': 'blue'}})  # the car's colour is the same in every profile
        self.assertEqual(self.db.config('car', self.view)['revision'][0], before[0] + 1)

    async def test_minimum_charge_gain_setting_is_validated(self):
        for bad in (101, -1, True, 'ten'):
            result = await self.request('config_patch', {'patch': {'charge_prompt_min_gain': bad}})
            self.assertEqual(result.errors[0][0], 'invalid_format')
        good = await self.request('config_patch', {'patch': {'charge_prompt_min_gain': 5}})
        self.assertFalse(good.errors)
        self.assertEqual(self.db.config('car', self.view)['config']['charge_prompt_min_gain'], 5)

    async def test_charge_reminder_and_spike_settings_are_validated(self):
        for key, bad in (('charge_prompt_recent', 0), ('charge_prompt_recent', 21), ('charge_spike_jump', 4),
                         ('charge_spike_jump', 51), ('charge_spike_jump', True), ('charge_prompt_min_gain', 'x')):
            result = await self.request('config_patch', {'patch': {key: bad}})
            self.assertEqual(result.errors[0][0], 'invalid_format', key)
        good = await self.request('config_patch', {'patch': {'charge_prompt_recent': 5, 'charge_spike_jump': 30}})
        self.assertFalse(good.errors)
        config = self.db.config('car', self.view)['config']
        self.assertEqual((config['charge_prompt_recent'], config['charge_spike_jump']), (5, 30))

    async def test_unexpected_failure_gets_a_fixed_message_without_details(self):
        async def failing(method, *args):
            raise RuntimeError('database path /config/.storage secret detail')
        async def failing_read(load):
            raise RuntimeError('database path /config/.storage secret detail')
        self.hub.db = failing
        self.hub.read_db = failing_read
        with self.assertLogs(api._LOGGER, level='ERROR'):
            result = await self.request('summary')
        self.assertEqual(result.errors[0][0], 'unknown_error')
        self.assertNotIn('secret', result.errors[0][1])

    async def test_charge_assignment_requires_admin_and_vehicle_read_permission(self):
        for connection in (Connection(admin=False), Connection(allowed=False)):
            result = await self.request('charge_profile_assign', {'session_id':'charge','profile_id':'home'}, connection=connection)
            self.assertEqual(result.errors[0][0], 'unauthorized')

    async def test_charge_assignment_snapshots_existing_profile(self):
        self.db.save_session('car', {'id':'charge', 's':1700000000000, 'e':1700003600000,
                                    'from':30, 'to':40, 'kwh':1.84, 'capacity':18.4, 'live':False, 'gap':False})
        result = await self.request('charge_profile_assign', {'session_id':'charge','profile_id':DEFAULT_PROFILES[1]['id']})
        self.assertFalse(result.errors)
        self.assertIsNone(self.db.charge_prompt('car', 'user'))

    async def test_timezone_and_history_range(self):
        c = await self.request("history", {"entity_ids": [], "start_time": "2026-11-05T12:00:00", "end_time": "2026-11-05T13:00:00Z"})
        self.assertTrue(c.errors)

    async def test_boolean_history_timestamp_is_rejected(self):
        c = await self.request("history", {"entity_ids": [], "start_time": True, "end_time": 100})
        self.assertTrue(c.errors)
        c = await self.request("history", {"entity_ids": [], "start_time": 200, "end_time": 100})
        self.assertTrue(c.errors)


if __name__ == "__main__":
    unittest.main(verbosity=2)
