"""Engine tests with deterministic time, delivery failures and explicit HA doubles."""
import asyncio
from copy import deepcopy
from datetime import datetime
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("local_notifications_test", Path(__file__).resolve().parents[1] / "custom_components/deepal_companion/notifications.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def rule(**changes):
    return {"id": "battery", "name": "Low battery", "enabled": True, "devices": ["mobile_app_phone"], "condition": "true", "title": "Battery {battery}", "message": "Check {battery}", "variables": {"battery": "20"}, "delay": 30, "repeat": 60, "max_sends": 2, "cooldown": 1800, "severity": "info", "quiet": {"enabled": False, "from": "22:00", "to": "07:00", "mode": "silent"}, "buttons": ["dismiss", "open"], "url": "/deepal-companion", "data": {}, **changes}


def json_state(engine):
    import json
    return json.dumps([engine.state, engine.history], sort_keys=True)


class Notifications(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.store, self.calls = {}, []
        async def db(method, vehicle, key, value=None):
            if method == "get":
                return deepcopy(self.store.get(key, value))
            self.store[key] = deepcopy(value)
        async def call(domain, service, data, **kw):
            tag=data.get("data",{}).get("tag")
            if isinstance(tag,str) and len(tag.encode("utf-8"))>64:
                raise ValueError("APNs collapse ID exceeds 64 bytes")
            self.calls.append((domain, service, data))
            if service == "mobile_app_broken":
                raise RuntimeError("offline service")
        self.runtime = types.SimpleNamespace(vehicle="car", config={"prefix": "s05"}, hub=types.SimpleNamespace(db=db), hass=types.SimpleNamespace(services=types.SimpleNamespace(async_call=call)))
        self.engine = mod.NotificationEngine(self.runtime)
        # Legacy service tests run without Home Assistant's entity registry.
        self.engine.recipients = lambda: []
        async def render(text, variables):
            if text == "invalid":
                raise ValueError("Invalid template")
            return text
        self.engine.render = render
        self.clock = patch.object(mod.time, "time", return_value=10000)
        self.time = self.clock.start()
        dt = types.ModuleType("homeassistant.util.dt")
        dt.now = lambda: datetime(2026, 11, 6, 23, 0)
        util = types.ModuleType("homeassistant.util")
        util.dt = dt
        self.modules = patch.dict(sys.modules, {"homeassistant.util": util, "homeassistant.util.dt": dt})
        self.modules.start()
        self.addCleanup(self.clock.stop)
        self.addCleanup(self.modules.stop)

    async def enable(self, **changes):
        await self.engine.save({"enabled": True, "rules": [rule(**changes)]})

    async def test_disabled_default_and_preview_have_no_side_effects(self):
        await self.engine.tick()
        result = await self.engine.preview(rule())
        self.assertEqual(result["title"], "Battery 20")
        self.assertFalse(self.calls)
        self.assertFalse(self.engine.history)

    async def test_delay_repeat_limit_and_dismiss(self):
        await self.enable()
        await self.engine.tick()
        self.assertFalse(self.calls)
        self.time.return_value += 30
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        token = self.engine.state["battery"]["token"]
        await self.engine.action(types.SimpleNamespace(data={"action": token}))
        self.time.return_value += 100
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.store["local_notification_state"]["battery"]["dismissed"])

    async def test_repeat_cap(self):
        await self.enable(delay=0)
        for increment in (0, 60, 60):
            self.time.return_value += increment
            await self.engine.tick()
        self.assertEqual(len(self.calls), 2)

    async def test_resolution_and_cooldown(self):
        await self.enable(delay=0)
        await self.engine.tick()
        self.engine.config["rules"][0]["condition"] = "false"
        await self.engine.tick()
        self.engine.config["rules"][0]["condition"] = "true"
        await self.engine.tick()
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(self.calls[1][2]["message"], "clear_notification")
        self.time.return_value += 1801
        await self.engine.tick()
        self.assertEqual(len(self.calls), 3)

    async def test_quiet_skip_suppresses_attempt_and_silent_overrides_sound(self):
        q = {"enabled": True, "from": "22:00", "to": "07:00", "mode": "skip"}
        await self.enable(delay=0, quiet=q)
        await self.engine.tick()
        self.assertFalse(self.calls)
        self.engine.config["rules"][0]["quiet"]["mode"] = "silent"
        self.engine.config["rules"][0]["data"] = {"push": {"sound": "loud"}}
        self.time.return_value += 60
        await self.engine.tick()
        self.assertEqual(self.calls[0][2]["data"]["push"]["sound"], "none")

    async def test_quiet_skip_holds_alert_until_quiet_hours_end(self):
        q = {"enabled": True, "from": "22:00", "to": "07:00", "mode": "skip"}
        await self.enable(delay=0, max_sends=1, quiet=q)
        await self.engine.tick()
        self.time.return_value += 60
        await self.engine.tick()
        self.assertFalse(self.calls)
        self.assertEqual(self.engine.state["battery"].get("count", 0), 0)
        self.assertEqual([h["status"] for h in self.engine.history].count("quiet_hours"), 1)
        sys.modules["homeassistant.util.dt"].now = lambda: datetime(2026, 11, 7, 10, 0)
        self.time.return_value += 60
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        self.assertNotIn("held", self.engine.state["battery"])

    async def test_quiet_skip_does_not_hold_critical_alerts(self):
        q = {"enabled": True, "from": "22:00", "to": "07:00", "mode": "skip"}
        await self.enable(delay=0, severity="critical", quiet=q)
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)

    async def test_disabling_or_removing_alert_clears_its_notification(self):
        await self.enable(delay=0)
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        await self.engine.save({"enabled": True, "rules": [rule(delay=0, enabled=False)]})
        self.assertEqual(self.calls[-1][2]["message"], "clear_notification")
        self.assertEqual(len(self.calls), 2)
        await self.engine.tick()
        self.assertEqual(len(self.calls), 2)
        # An alert that never sent has nothing to clear.
        await self.engine.save({"enabled": True, "rules": []})
        self.assertEqual(len(self.calls), 2)

    async def test_master_switch_off_and_removal_clear_sent_notifications(self):
        await self.enable(delay=0)
        await self.engine.tick()
        await self.engine.save({"enabled": False, "rules": [rule(delay=0)]})
        self.assertEqual(self.calls[-1][2]["message"], "clear_notification")
        self.assertEqual(len(self.calls), 2)
        self.engine.state = {}
        await self.engine.save({"enabled": True, "rules": [rule(delay=0)]})
        self.time.return_value += 3600
        await self.engine.tick()
        self.assertEqual(len(self.calls), 3)
        await self.engine.save({"enabled": True, "rules": []})
        self.assertEqual(self.calls[-1][2]["message"], "clear_notification")
        self.assertEqual(len(self.calls), 4)

    async def test_clear_on_resolve_false_keeps_notification_when_disabled(self):
        await self.enable(delay=0, clear_on_resolve=False)
        await self.engine.tick()
        await self.engine.save({"enabled": True, "rules": [rule(delay=0, clear_on_resolve=False, enabled=False)]})
        self.assertEqual(len(self.calls), 1)

    async def test_failed_device_does_not_block_other_devices(self):
        await self.enable(delay=0, devices=["mobile_app_broken", "mobile_app_phone"])
        await self.engine.tick()
        deliveries = self.engine.history[0]["deliveries"]
        self.assertEqual([d["status"] for d in deliveries], ["error", "accepted"])

    async def test_away_filter_is_per_device_and_test_bypasses_it(self):
        await self.enable(delay=0, devices=["mobile_app_home", "mobile_app_away"], recipient_conditions={"mobile_app_home":"false", "mobile_app_away":"true"})
        await self.engine.tick()
        self.assertEqual([call[1] for call in self.calls], ["mobile_app_away"])
        await self.engine.test(self.engine.config["rules"][0])
        self.assertEqual(len(self.calls), 3)

    async def test_recipient_condition_receives_rule_variables_and_repeat_index(self):
        seen = []
        original = self.engine.render
        async def render(text, variables):
            if text == "RC":
                seen.append(dict(variables))
                return "true"
            return await original(text, variables)
        self.engine.render = render
        await self.enable(delay=0, devices=["mobile_app_phone"], variables={"level": "42"}, recipient_conditions={"mobile_app_phone": "RC"})
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(seen[0]["level"], "42")
        self.assertEqual(seen[0]["repeat"], {"index": 1})

    async def test_card_style_preferences_survive_save(self):
        value={"enabled":False,"rules":[],"ui":{"quiet":{"on":True},"events":{"unlocked":{"actions":["lock"],"icon":"mdi:lock"}}}}
        await self.engine.save(value)
        self.assertEqual(self.store["local_notifications"]["ui"],value["ui"])

    async def test_test_send_does_not_arm_or_change_rules(self):
        await self.engine.test(mod.validate({"enabled": False, "rules": [rule()]})["rules"][0])
        self.assertEqual(self.calls[0][2]["title"], "[Test] Battery 20")
        self.assertEqual(self.calls[0][2]["data"]["push"]["interruption-level"], "time-sensitive")
        self.assertEqual(self.calls[0][2]["data"]["push"]["sound"], "default")
        self.assertEqual(self.calls[0][2]["data"]["actions"], [{"action": "URI", "title": "Open dashboard", "uri": "/deepal-companion"}])
        self.assertFalse(self.engine.state)
        self.assertFalse(self.engine.config["enabled"])

    async def test_repeated_tests_have_unique_tags(self):
        configured=mod.validate({"enabled":False,"rules":[rule(buttons=[])]})["rules"][0]
        await self.engine.test(configured)
        await self.engine.test(configured)
        self.assertNotEqual(self.calls[0][2]["data"]["tag"],self.calls[1][2]["data"]["tag"])
        self.assertNotIn("actions",self.calls[0][2]["data"])
        self.assertEqual(configured["severity"],"info")

    async def test_real_vehicle_test_tags_fit_apns_and_remain_unique(self):
        self.runtime.vehicle="5214c85f49260c7791e8769793082660"
        configured=mod.validate({"enabled":False,"rules":[rule(id="charge_done")]})["rules"][0]
        for _ in range(2):
            result=await self.engine.test(configured)
            self.assertEqual(result["deliveries"][0]["status"],"accepted")
        tags=[call[2]["data"]["tag"] for call in self.calls]
        self.assertEqual(len(set(tags)),2)
        self.assertTrue(all(len(tag.encode("utf-8"))<=64 for tag in tags))

    async def test_long_rule_uses_same_bounded_tag_for_send_and_clear(self):
        self.runtime.vehicle="a"*32
        await self.enable(id="long_custom_alert_"+"x"*62,delay=0)
        await self.engine.tick()
        tag=self.calls[0][2]["data"]["tag"]
        self.assertLessEqual(len(tag.encode("utf-8")),64)
        self.engine.config["rules"][0]["condition"]="false"
        await self.engine.tick()
        self.assertEqual(self.calls[1][2]["message"],"clear_notification")
        self.assertEqual(self.calls[1][2]["data"]["tag"],tag)

    def test_tag_identity_is_stable_and_preserves_existing_short_tags(self):
        self.assertEqual(mod.notification_tag("car","battery"),"deepal_companion_car_battery")
        self.assertEqual(mod.notification_tag("a"*32,"x"*80),mod.notification_tag("a"*32,"x"*80))
        self.assertNotEqual(mod.notification_tag("a"*32,"x"*80),mod.notification_tag("b"*32,"x"*80))
        self.assertNotEqual(mod.notification_tag("a"*32,"x"*80),mod.notification_tag("a"*32,"y"*80))
        self.assertLessEqual(len(mod.notification_tag("α"*32,"x"*80).encode("utf-8")),64)

    def install_mobile_registry(self, old_disabled=True):
        """Two same-name registrations; no real HA transport or push credentials."""
        self.push_calls = []
        async def push(**payload):
            self.push_calls.append(payload)
        entries = {key: types.SimpleNamespace(domain="mobile_app", title="Same phone", data={"device_name":"Same phone", "webhook_id":"test_registration_"+key}) for key in ("old","current")}
        entities = {"notify.current_phone":types.SimpleNamespace(domain="notify", entity_id="notify.current_phone", platform="mobile_app", disabled_by=None, config_entry_id="current", device_id="current", name=None),
                    "notify.retired_phone":types.SimpleNamespace(domain="notify", entity_id="notify.retired_phone", platform="mobile_app", disabled_by="user" if old_disabled else None, config_entry_id="old", device_id="old", name=None),
                    "notify.non_mobile":types.SimpleNamespace(domain="notify", entity_id="notify.non_mobile", platform="other", disabled_by=None)}
        registry=types.SimpleNamespace(entities=entities, async_get=entities.get)
        helpers=types.ModuleType("homeassistant.helpers")
        helpers.entity_registry=types.SimpleNamespace(async_get=lambda hass:registry)
        helpers.device_registry=types.SimpleNamespace(async_get=lambda hass:types.SimpleNamespace(async_get=lambda key:types.SimpleNamespace(name_by_user="My "+key+" phone",name="Phone")))
        constants=types.ModuleType("homeassistant.components.mobile_app.const");constants.DOMAIN="mobile_app";constants.DATA_NOTIFY="notify"
        util=sys.modules["homeassistant.util"];util.slugify=lambda text:text.lower().replace(" ","_")
        patches=patch.dict(sys.modules,{"homeassistant.helpers":helpers,"homeassistant.components.mobile_app.const":constants});patches.start();self.addCleanup(patches.stop)
        self.runtime.hass.config_entries=types.SimpleNamespace(async_get_entry=entries.get)
        self.runtime.hass.data={"mobile_app":{"notify":types.SimpleNamespace(async_send_message=push)}}
        self.engine.recipients=lambda:mod.NotificationEngine.recipients(self.engine)
        return entities

    async def test_entity_routes_to_exact_current_registration_and_keeps_rich_data(self):
        self.install_mobile_registry(old_disabled=False)
        await self.engine.test(mod.validate({"enabled":False,"rules":[rule(devices=["notify.current_phone"])]})["rules"][0])
        self.assertFalse(self.calls)
        sent=self.push_calls[0]
        self.assertEqual(sent["target"],["test_registration_current"])
        self.assertEqual(sent["data"]["push"]["sound"],"default")
        self.assertEqual(sent["data"]["actions"][0]["action"],"URI")
        self.assertEqual(self.engine.history[0]["deliveries"][0]["device"],"notify.current_phone")

    async def test_discovery_uses_mobile_app_entities_and_skips_disabled(self):
        self.install_mobile_registry()
        rows=self.engine.recipients()
        self.assertEqual([row["svc"] for row in rows],["notify.current_phone"])
        self.assertEqual(rows[0]["name"],"My current phone")
        self.assertNotIn("webhook_id",str(rows))
        await self.engine.send_to_recipient("mobile_app_same_phone",{"message":"test"})
        self.assertEqual(self.push_calls[0]["target"],["test_registration_current"])

    async def test_ambiguous_legacy_phone_never_sends_to_arbitrary_registration(self):
        self.install_mobile_registry(old_disabled=False)
        with self.assertRaisesRegex(ValueError,"Multiple Mobile App"):
            await self.engine.send_to_recipient("mobile_app_same_phone",{"message":"test"})
        self.assertFalse(self.calls);self.assertFalse(self.push_calls)

    async def test_missing_disabled_and_non_mobile_entity_fail_closed(self):
        self.install_mobile_registry()
        for recipient in ("notify.retired_phone","notify.missing","notify.non_mobile"):
            with self.subTest(recipient=recipient),self.assertRaises(ValueError):
                await self.engine.send_to_recipient(recipient,{"message":"test"})
        self.assertFalse(self.push_calls)

    async def test_important_sound_and_critical_sound_are_explicit(self):
        for severity in ("important","critical"):
            configured=mod.validate({"enabled":False,"rules":[rule(severity=severity)]})["rules"][0]
            await self.engine.test(configured)
        self.assertEqual(self.calls[0][2]["data"]["push"]["sound"],"default")
        self.assertEqual(self.calls[1][2]["data"]["push"]["sound"]["critical"],1)

    async def test_edit_does_not_rearm_and_conflict_is_rejected(self):
        await self.enable(delay=0)
        await self.engine.tick()
        await self.engine.save({"enabled": True, "rules": [rule(delay=0, title="New")]})
        await self.engine.tick()
        self.assertEqual(len(self.calls), 1)
        # A save made from an outdated copy that changes nothing keeps the newer settings.
        stale = {"enabled": False, "rules": []}
        self.assertTrue(await self.engine.save(stale, stale))
        self.assertTrue(self.engine.config["enabled"])
        self.assertEqual(self.engine.config["rules"][0]["title"], "New")

    async def test_concurrent_saves_merge_different_changes(self):
        await self.enable(delay=0)
        opened = deepcopy(self.engine.config)
        # Another tab changes the message and adds a second alert.
        other = deepcopy(opened)
        other["rules"][0]["message"] = "Other tab"
        other["rules"].append(rule(id="second", name="Second", enabled=False, devices=[]))
        self.assertFalse(await self.engine.save(other, opened))
        # This tab, still on the old copy, changes quiet hours and the master switch.
        mine = deepcopy(opened)
        mine["rules"][0]["quiet"] = mine["rules"][0]["quiet"] | {"enabled": True, "from": "23:00"}
        mine["enabled"] = False
        self.assertTrue(await self.engine.save(mine, opened))
        merged = self.engine.config
        self.assertFalse(merged["enabled"])
        self.assertEqual([r["id"] for r in merged["rules"]], ["battery", "second"])
        self.assertEqual(merged["rules"][0]["message"], "Other tab")
        self.assertEqual(merged["rules"][0]["quiet"]["from"], "23:00")

    async def test_concurrent_saves_of_the_same_field_conflict(self):
        await self.enable(delay=0)
        opened = deepcopy(self.engine.config)
        other = deepcopy(opened)
        other["rules"][0]["title"] = "One"
        await self.engine.save(other, opened)
        mine = deepcopy(opened)
        mine["rules"][0]["title"] = "Two"
        with self.assertRaises(ValueError):
            await self.engine.save(mine, opened)
        self.assertEqual(self.engine.config["rules"][0]["title"], "One")

    async def test_concurrent_removal_and_edit_of_different_alerts(self):
        await self.engine.save({"enabled": True, "rules": [rule(delay=0), rule(id="second", name="Second", delay=0)]})
        opened = deepcopy(self.engine.config)
        other = deepcopy(opened)
        other["rules"] = [r for r in other["rules"] if r["id"] != "second"]
        await self.engine.save(other, opened)
        mine = deepcopy(opened)
        mine["rules"][0]["message"] = "Edited"
        await self.engine.save(mine, opened)
        self.assertEqual([r["id"] for r in self.engine.config["rules"]], ["battery"])
        self.assertEqual(self.engine.config["rules"][0]["message"], "Edited")

    async def test_invalid_template_does_not_replace_saved_settings(self):
        with self.assertRaises(ValueError):
            await self.enable(condition="invalid")
        self.assertFalse(self.engine.config["enabled"])

    async def test_error_is_bounded_and_deduplicated(self):
        await self.enable()
        self.engine.config["rules"][0]["condition"] = "invalid"
        for _ in range(3):
            await self.engine.tick()
        self.assertEqual(len(self.engine.history), 1)
        self.assertEqual(self.engine.history[0]["status"], "error")

    async def test_lock_button_requires_current_token_enabled_rule_and_explicit_opt_in(self):
        await self.enable(delay=0, buttons=["lock"])
        await self.engine.tick()
        token = self.engine.state["battery"]["token"].replace("_DISMISS_", "_LOCK_")
        await self.engine.action(types.SimpleNamespace(data={"action": "DEEPAL_COMPANION_LOCK_wrong"}))
        self.assertEqual(len(self.calls), 1)
        await self.engine.action(types.SimpleNamespace(data={"action": token}))
        self.assertEqual(self.calls[1][:2], ("lock", "lock"))
        await self.engine.action(types.SimpleNamespace(data={"action": token}))
        self.assertEqual(len(self.calls), 2)

    async def test_stopped_engine_sends_nothing(self):
        await self.enable(delay=0)
        await self.engine.stop()
        await self.engine.tick()
        self.assertFalse(self.calls)

    async def test_activity_pages_use_stable_cursors_and_do_not_preload_all(self):
        for i in range(13):
            await self.engine.record(rule(), "test", message=str(i))
        first = self.engine.history_page()
        self.assertEqual(len(first["rows"]), 5)
        self.assertEqual(first["total"], 13)
        await self.engine.record(rule(), "test", message="Arrived after first page")
        second = self.engine.history_page(before=first["next_before"])
        self.assertEqual(len(second["rows"]), 5)
        self.assertFalse({r["id"] for r in first["rows"]} & {r["id"] for r in second["rows"]})
        self.assertEqual(second["rows"][0]["message"], "7")

    async def test_deleting_activity_preserves_alert_latches_and_configuration(self):
        await self.enable(delay=0)
        await self.engine.tick()
        config, state = deepcopy(self.engine.config), deepcopy(self.engine.state)
        ident = self.engine.history[0]["id"]
        await self.engine.delete_history(ident)
        self.assertFalse(self.engine.history)
        self.assertEqual(self.engine.config, config)
        self.assertEqual(self.engine.state, state)
        self.assertEqual(self.store["local_notification_history"], [])
        await self.engine.record(rule(), "test")
        await self.engine.delete_history()
        self.assertEqual(self.engine.state, state)
        self.assertEqual(self.engine.config, config)

    def test_activity_paging_rejects_invalid_limits_and_cursors(self):
        for limit in (True, 0, 21, 1.5):
            with self.assertRaises(ValueError):
                self.engine.history_page(limit)
        with self.assertRaises(ValueError):
            self.engine.history_page(before="not-an-id")
        with self.assertRaisesRegex(ValueError, "Refresh"):
            self.engine.history_page(before="a" * 32)

    def test_validation_rejects_unsafe_or_unbounded_inputs(self):
        for change in ({"delay": float("nan")}, {"max_sends": 0}, {"max_sends": 1.5}, {"devices": ["persistent_notification"]}, {"buttons": ["unlock"]}, {"data": {"tag": "shared"}}, {"quiet": {"enabled": True, "from": "99:00", "to": "07:00", "mode": "skip"}}, {"variables": {"states": "bad"}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                mod.validate({"enabled": False, "rules": [rule(**change)]})

    def test_quiet_hours_cross_midnight(self):
        q = rule()["quiet"] | {"enabled": True}
        self.assertTrue(mod.quiet_now(q, "23:00"))
        self.assertTrue(mod.quiet_now(q, "06:59"))
        self.assertFalse(mod.quiet_now(q, "07:00"))

    async def test_explain_reports_each_blocker_without_changing_anything_or_sending(self):
        async def verdict(**changes):
            await self.enable(**changes)
            return await self.engine.explain("battery")
        before = None
        result = await verdict()
        self.assertEqual((result["verdict"], result["steps"][-1]["id"]), ("waiting", "delay"))   # delay 30 s, never ticked
        self.assertEqual(result["retry_in"], 30)
        await self.engine.tick()
        self.time.return_value += 31
        result = await self.engine.explain("battery")
        self.assertEqual(result["verdict"], "would_send")
        before = json_state(self.engine)
        for _ in range(3):
            await self.engine.explain("battery")
        self.assertEqual(json_state(self.engine), before)
        self.assertFalse(self.calls)
        self.assertEqual((await verdict(condition="false"))["verdict"], "inactive")
        self.engine.recipients = lambda: [{"svc": "notify.someone_else"}]
        self.assertEqual((await verdict(delay=0))["verdict"], "no_recipient")   # chosen device is not available
        self.engine.recipients = lambda: []
        self.assertEqual((await verdict(quiet={"enabled": True, "from": "22:00", "to": "07:00", "mode": "skip"}, delay=0))["steps"][-1]["id"], "quiet")
        self.assertEqual((await verdict(enabled=False))["verdict"], "blocked")
        await self.engine.save({"enabled": False, "rules": [rule()]})
        self.assertEqual((await self.engine.explain("battery"))["steps"][0]["id"], "master")
        with self.assertRaises(ValueError):
            await self.engine.explain("missing")

    async def test_explain_covers_dismiss_limit_repeat_and_cooldown(self):
        await self.enable(delay=0, repeat=0, max_sends=1, cooldown=1800)
        await self.engine.tick()                                   # sends once
        result = await self.engine.explain("battery")
        self.assertEqual(result["verdict"], "blocked")
        self.assertEqual(result["steps"][-1]["id"], "limit")
        token = self.engine.state["battery"]["token"]
        await self.engine.action(types.SimpleNamespace(data={"action": token}))
        self.assertEqual(self.engine.explain.__name__, "explain")
        self.assertEqual((await self.engine.explain("battery"))["steps"][-1]["id"], "dismissed")
        await self.enable(delay=0, repeat=600, max_sends=3, cooldown=1800)
        self.engine.state["battery"] = {"since": 1, "count": 1, "last": self.time.return_value - 10}
        result = await self.engine.explain("battery")
        self.assertEqual((result["verdict"], result["steps"][-1]["id"]), ("waiting", "repeat"))
        self.engine.state["battery"] = {"since": 1, "count": 0, "last": self.time.return_value - 10}
        self.assertEqual((await self.engine.explain("battery"))["steps"][-1]["id"], "cooldown")
