"""Integration-owned vehicle alerts, delivery and bounded notification activity."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import hashlib
import json
import math
import re
import time
import uuid

SERVICE = re.compile(r"^mobile_app_[a-z0-9_]+$")
ENTITY = re.compile(r"^notify\.[a-z0-9_]+$")
IDENTITY = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")
DEFAULT = {"enabled": False, "rules": []}


def notification_tag(vehicle, rule_id, *, test=False):
    """HA maps tag to APNs collapse ID, which is limited to 64 UTF-8 bytes."""
    if test:
        return "deepal_companion_test_" + uuid.uuid4().hex
    tag = f"deepal_companion_{vehicle}_{rule_id}"
    if len(tag.encode("utf-8")) <= 64:
        return tag
    identity = json.dumps([vehicle, rule_id], ensure_ascii=True).encode("utf-8")
    return "deepal_companion_" + hashlib.sha256(identity).hexdigest()[:40]


def validate(value):
    """Validate even disabled rules, so enabling cannot reveal malformed options."""
    if not isinstance(value, dict) or type(value.get("enabled")) is not bool:
        raise ValueError("Expected notification settings")
    rules = value.get("rules")
    if not isinstance(rules, list) or len(rules) > 32:
        raise ValueError("Use up to 32 notification rules")
    result = {"enabled": value["enabled"], "rules": []}
    if "live_charging" in value:
        from .live_charging import validate_live
        result["live_charging"] = validate_live(value["live_charging"])
    if "ui" in value:
        if not isinstance(value["ui"], dict) or len(json.dumps(value["ui"], allow_nan=False)) > 100000:
            raise ValueError("Invalid notification preferences")
        result["ui"] = deepcopy(value["ui"])
    ids = set()
    for source in rules:
        if not isinstance(source, dict):
            raise ValueError("Invalid notification rule")
        rule = deepcopy(source)
        ident = rule.get("id", "")
        if not isinstance(ident, str) or not IDENTITY.fullmatch(ident) or ident in ids:
            raise ValueError("Rule IDs must be unique")
        ids.add(ident)
        for key, limit in {"name": 120, "title": 500, "message": 4000, "condition": 8000, "url": 300}.items():
            text = rule.get(key, "")
            if not isinstance(text, str) or len(text) > limit:
                raise ValueError("Invalid " + key)
            rule[key] = text
        if not rule["name"].strip() or not rule["condition"].strip() or not rule["message"].strip():
            raise ValueError("A name, condition and message are required")
        if type(rule.get("enabled")) is not bool:
            raise ValueError("Rule enabled must be true or false")
        for key, maximum, default in (("delay", 86400, 0), ("repeat", 86400, 0), ("max_sends", 20, 1), ("cooldown", 604800, 1800)):
            number = rule.get(key, default)
            if type(number) not in (int, float) or not math.isfinite(number) or not 0 <= number <= maximum or (key == "max_sends" and (number < 1 or int(number) != number)):
                raise ValueError("Invalid " + key)
            rule[key] = number
        devices = rule.get("devices", [])
        if not isinstance(devices, list) or len(devices) > 20 or any(not isinstance(s, str) or not (SERVICE.fullmatch(s) or ENTITY.fullmatch(s)) for s in devices):
            raise ValueError("Choose mobile app notification devices")
        rule["devices"] = list(dict.fromkeys(devices))
        conditions = rule.get("recipient_conditions", {})
        if not isinstance(conditions, dict) or any(key not in devices or not isinstance(template, str) or len(template)>2000 for key,template in conditions.items()):
            raise ValueError("Invalid recipient conditions")
        rule["recipient_conditions"] = conditions
        if rule["enabled"] and not devices:
            raise ValueError("Choose a device for each enabled rule")
        variables = rule.get("variables", {})
        if not isinstance(variables, dict) or len(variables) > 30 or any(not re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_]{0,49}", k) or k in {"states", "state_attr", "is_state", "now", "repeat"} or not isinstance(v, str) or len(v) > 8000 for k, v in variables.items()):
            raise ValueError("Invalid message variables")
        rule["variables"] = variables
        if rule.get("severity", "info") not in {"info", "important", "critical"}:
            raise ValueError("Unknown notification priority")
        rule["severity"] = rule.get("severity", "info")
        quiet = rule.get("quiet", {"enabled": False, "from": "22:00", "to": "07:00", "mode": "silent"})
        if not isinstance(quiet, dict) or type(quiet.get("enabled")) is not bool or quiet.get("mode") not in {"silent", "skip"} or any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", str(quiet.get(k, ""))) for k in ("from", "to")):
            raise ValueError("Invalid quiet hours")
        rule["quiet"] = quiet
        extra = rule.get("data", {})
        if not isinstance(extra, dict) or len(json.dumps(extra, allow_nan=False)) > 12000:
            raise ValueError("Invalid extra notification data")
        if "actions" in extra or "tag" in extra:
            raise ValueError("Use the action buttons and tag controls")
        if "push" in extra and not isinstance(extra["push"], dict):
            raise ValueError("Push options must be an object")
        rule["data"] = extra
        buttons = rule.get("buttons", ["dismiss"])
        if not isinstance(buttons, list) or any(b not in {"dismiss", "open", "lock"} for b in buttons):
            raise ValueError("Unknown notification button")
        rule["buttons"] = list(dict.fromkeys(buttons))
        rule["clear_on_resolve"] = rule.get("clear_on_resolve", True)
        if type(rule["clear_on_resolve"]) is not bool:
            raise ValueError("Clear on resolve must be true or false")
        if rule["enabled"] and rule.get("builder") and not re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", str(rule["builder"].get("entity", ""))):
            raise ValueError("Choose an entity for your custom alert")
        result["rules"].append(rule)
    return result


def quiet_now(quiet, minute):
    if not quiet["enabled"] or quiet["from"] == quiet["to"]:
        return False
    start, end = quiet["from"], quiet["to"]
    return start <= minute < end if start < end else minute >= start or minute < end


class NotificationEngine:
    def __init__(self, runtime):
        self.runtime, self.hass = runtime, runtime.hass
        self.config = deepcopy(DEFAULT)
        self.state, self.history = {}, []
        self.lock = asyncio.Lock()
        self.stopped = False
        self.unsub = None
        self.event_unsub = None

    async def start(self):
        from homeassistant.helpers.event import async_track_time_interval
        from datetime import timedelta
        self.config = validate(await self.db("get", self.runtime.vehicle, "local_notifications", DEFAULT))
        self.state = await self.db("get", self.runtime.vehicle, "local_notification_state", {})
        self.history = await self.db("get", self.runtime.vehicle, "local_notification_history", [])
        if any("id" not in item for item in self.history):
            for item in self.history:
                item.setdefault("id", uuid.uuid4().hex)
            await self.db("put", self.runtime.vehicle, "local_notification_history", self.history)
        from .live_charging import LiveCharging
        self.live = LiveCharging(self)
        await self.live.start()
        # A pending duration must be observed again after restart. Sent/dismissed latches survive.
        for state in self.state.values():
            state["since"] = None
        self.unsub = async_track_time_interval(self.hass, self.tick, timedelta(seconds=15))
        self.event_unsub = self.hass.bus.async_listen("mobile_app_notification_action", self.action)

    async def db(self, *args):
        return await self.runtime.hub.db(*args)

    def recipients(self):
        """Discover enabled Mobile App notify entities without exposing push credentials."""
        from homeassistant.helpers import entity_registry as er, device_registry as dr
        from homeassistant.util import slugify
        registry, devices = er.async_get(self.hass), dr.async_get(self.hass)
        trackers = {e.device_id: e.entity_id for e in registry.entities.values() if e.domain == "device_tracker" and e.platform == "mobile_app" and e.device_id and not e.disabled_by}
        rows = []
        for entity in registry.entities.values():
            if entity.domain != "notify" or entity.platform != "mobile_app" or entity.disabled_by:
                continue
            entry = self.hass.config_entries.async_get_entry(entity.config_entry_id)
            if entry is None or entry.domain != "mobile_app":
                continue
            device = devices.async_get(entity.device_id) if entity.device_id else None
            tracker = trackers.get(entity.device_id, "")
            rows.append({"svc": entity.entity_id, "name": entity.name or (device.name_by_user or device.name if device else None) or entry.title,
                         "tracker": tracker, "legacy_service": "mobile_app_" + slugify(entry.data.get("device_name", entry.title))})
        return sorted(rows, key=lambda row: (row["name"].casefold(), row["svc"]))

    async def send_to_recipient(self, recipient, payload):
        """Use the entity's current registration for rich Mobile App notifications."""
        if not ENTITY.fullmatch(recipient):
            # Preserve saved legacy rules, but resolve an unambiguous enabled entity.
            matches = [row for row in self.recipients() if row["legacy_service"] == recipient]
            if len(matches) > 1:
                raise ValueError("Multiple Mobile App registrations match. Select the current phone in Notifications.")
            if not matches:
                await self.hass.services.async_call("notify", recipient, payload, blocking=True)
                return recipient
            recipient = matches[0]["svc"]
        from homeassistant.helpers import entity_registry as er
        from homeassistant.components.mobile_app.const import DOMAIN, DATA_NOTIFY
        entity = er.async_get(self.hass).async_get(recipient)
        if entity is None or entity.platform != "mobile_app" or entity.disabled_by:
            raise ValueError("Selected Mobile App notification entity is unavailable. Select your phone again.")
        entry = self.hass.config_entries.async_get_entry(entity.config_entry_id)
        if entry is None or entry.domain != DOMAIN:
            raise ValueError("Selected phone registration is unavailable")
        notifier = self.hass.data.get(DOMAIN, {}).get(DATA_NOTIFY)
        webhook = entry.data.get("webhook_id")
        if notifier is None or not webhook:
            raise ValueError("Mobile App notifications are not ready. Reload the Mobile App integration.")
        # HA's rich notification transport accepts exact registration targets. The
        # entity send_message action currently supports only title and message.
        await notifier.async_send_message(**payload, target=[webhook])
        return recipient

    async def save(self, value, expected=None):
        config = validate(value)
        async with self.lock:
            if expected is not None and expected != self.config:
                raise ValueError("Notification settings changed elsewhere. Reload before saving.")
            for rule in config["rules"]:
                await self.preview(rule)
            await self.db("put", self.runtime.vehicle, "local_notifications", config)
            previous = {r["id"]: r for r in self.config["rules"]}
            # Editing never rearms an already-sent issue. Restart only its pending duration.
            self.state = {r["id"]: self.state.get(r["id"], {}) for r in config["rules"]}
            for rule in config["rules"]:
                if rule != previous.get(rule["id"]):
                    self.state[rule["id"]]["since"] = None
            self.config = config
            if hasattr(self, "live"):
                await self.live.tick()
            await self.persist()

    async def render(self, text, variables):
        from homeassistant.helpers.template import Template
        try:
            return Template(text, self.hass).async_render(variables, parse_result=False)
        except Exception as error:
            raise ValueError("Notification template: " + str(error)[:300]) from error

    async def preview(self, rule, index=1):
        context = {"repeat": {"index": index}}
        for key, template in rule["variables"].items():
            context[key] = await self.render(template, context)
        active = str(await self.render(rule["condition"], context)).strip().lower() == "true"
        # Simple {name} placeholders coexist with advanced HA {{ templates }}.
        def simple(text):
            return re.sub(r"(?<!\{)\{([a-zA-Z_]\w*)\}(?!\})", lambda m: str(context.get(m[1], m[0])), text)
        return {"active": active, "title": str(await self.render(simple(rule["title"]), context)),
                "message": str(await self.render(simple(rule["message"]), context))}

    async def record(self, rule, status, **details):
        self.history.insert(0, {"id": uuid.uuid4().hex, "time": time.time(), "rule_id": rule["id"], "name": rule["name"], "status": status,
                                "icon": rule.get("data", {}).get("notification_icon", "mdi:bell-outline"),
                                "severity": rule.get("severity", "info"), **details})
        del self.history[200:]

    def history_page(self, limit=5, before=None):
        """Bounded responses; the dashboard requests subsequent pages explicitly."""
        if type(limit) is not int or not 1 <= limit <= 20:
            raise ValueError("Choose between 1 and 20 activity entries")
        start = 0
        if before is not None:
            if not isinstance(before, str) or not re.fullmatch(r"[a-f0-9]{32}", before):
                raise ValueError("Invalid activity cursor")
            index = next((i for i, item in enumerate(self.history) if item.get("id") == before), None)
            if index is None:
                raise ValueError("Activity changed. Refresh the activity list.")
            start = index + 1
        rows = self.history[start:start + limit]
        more = start + len(rows) < len(self.history)
        return {"rows": deepcopy(rows), "total": len(self.history), "has_more": more,
                "next_before": rows[-1]["id"] if more and rows else None}

    async def delete_history(self, ident=None):
        if ident is not None and (not isinstance(ident, str) or not re.fullmatch(r"[a-f0-9]{32}", ident)):
            raise ValueError("Invalid activity entry")
        async with self.lock:
            remaining = [item for item in self.history if item.get("id") != ident] if ident else []
            await self.db("put", self.runtime.vehicle, "local_notification_history", remaining)
            self.history = remaining

    async def persist(self):
        await self.db("put", self.runtime.vehicle, "local_notification_state", self.state)
        await self.db("put", self.runtime.vehicle, "local_notification_history", self.history)

    async def deliver(self, rule, preview, token, test=False, silent=False):
        severity = rule["severity"]
        soft = silent or severity == "info"
        data = deepcopy(rule["data"])
        data.update({"tag": notification_tag(self.runtime.vehicle, rule["id"], test=test),
                     "group": "deepal_companion_" + self.runtime.vehicle})
        data.setdefault("push", {"interruption-level": "passive" if soft else "critical" if severity == "critical" else "time-sensitive"})
        if not soft:
            data["push"].setdefault("sound", "default")
        if severity == "critical" and not silent:
            if data["push"].get("sound") == "default":
                data["push"]["sound"] = {"name": "default", "critical": 1, "volume": 1.0}
        if silent:
            data["push"] = {"interruption-level": "passive", "sound": "none"}
            data.update(importance="low", priority="normal", channel="Deepal Companion Silent")
        data.setdefault("importance", "low" if soft else "max" if severity == "critical" else "high")
        if not soft:
            data.setdefault("priority", "high")
        if rule["url"]:
            data.update(url=rule["url"], clickAction=rule["url"])
        actions = []
        if "dismiss" in rule["buttons"] and not test:
            actions.append({"action": token, "title": "Dismiss"})
        if "lock" in rule["buttons"] and not test:
            actions.append({"action": token.replace("_DISMISS_", "_LOCK_"), "title": "Lock vehicle"})
        if "open" in rule["buttons"] and rule["url"]:
            actions.append({"action": "URI", "title": "Open dashboard", "uri": rule["url"]})
        if actions:
            data["actions"] = actions
        async def send(service):
            try:
                if not test and service in rule.get("recipient_conditions", {}):
                    allowed = str(await self.render(rule["recipient_conditions"][service], {})).strip().lower() == "true"
                    if not allowed:
                        return {"device": service, "status": "skipped"}
                async with asyncio.timeout(15):
                    resolved = await self.send_to_recipient(service, {"title": ("[Test] " if test else "") + preview["title"], "message": preview["message"], "data": deepcopy(data)})
                return {"device": resolved, "status": "accepted"}
            except Exception as error:
                return {"device": service, "status": "error", "error": str(error)[:300] or type(error).__name__}
        outcomes = await asyncio.gather(*(send(service) for service in rule["devices"]))
        status = "skipped" if outcomes and all(d["status"] == "skipped" for d in outcomes) else "error" if outcomes and all(d["status"] == "error" for d in outcomes) else "partial" if any(d["status"] == "error" for d in outcomes) else "sent"
        await self.record(rule, "test" if test else status, title=preview["title"], message=preview["message"], deliveries=outcomes)
        return outcomes

    async def test(self, rule):
        async with self.lock:
            preview = await self.preview(rule)
            test_rule = deepcopy(rule)
            lifted = test_rule["severity"] == "info"
            if lifted:
                test_rule["severity"] = "important"
            result = await self.deliver(test_rule, preview, "", test=True)
            await self.persist()
            return {**preview, "deliveries": result, "priority_lifted": lifted}

    async def action(self, event):
        token = event.data.get("action")
        if not isinstance(token, str) or not token.startswith(("DEEPAL_COMPANION_DISMISS_", "DEEPAL_COMPANION_LOCK_")) or not self.config["enabled"] or self.stopped:
            return
        lock_action = token.startswith("DEEPAL_COMPANION_LOCK_")
        match_token = token.replace("_LOCK_", "_DISMISS_") if lock_action else token
        async with self.lock:
            for ident, state in self.state.items():
                if state.get("token") == match_token and not state.get("dismissed"):
                    rule = next((r for r in self.config["rules"] if r["id"] == ident), None)
                    if not rule or not rule["enabled"]:
                        return
                    if lock_action:
                        if "lock" not in rule["buttons"]:
                            return
                        cfg = self.runtime.config
                        entity = cfg.get("entities", {}).get("lock.doors", "lock." + cfg["prefix"] + "_doors")
                        try:
                            async with asyncio.timeout(15):
                                await self.hass.services.async_call("lock", "lock", {"entity_id": entity}, blocking=True)
                        except Exception as error:
                            await self.record(rule, "error", error=str(error)[:300])
                            await self.persist()
                            return
                    state["dismissed"] = True
                    await self.record(rule, "locked" if lock_action else "dismissed")
                    await self.persist()
                    return

    async def tick(self, _now=None):
        if self.stopped or self.lock.locked():
            return
        async with self.lock:
            now = time.time()
            if hasattr(self, "live"):
                try:
                    await self.live.tick(now)
                except Exception as error:
                    message = str(error)[:300]
                    if getattr(self, "live_error", None) != message:
                        await self.record({"id": "live_charging", "name": "Live charging"}, "error", error=message)
                        self.live_error = message
                        await self.persist()
            if not self.config["enabled"]:
                return
            before = json.dumps([self.state, self.history], sort_keys=True)
            for rule in self.config["rules"]:
                if not rule["enabled"]:
                    continue
                state = self.state.setdefault(rule["id"], {})
                try:
                    preview = await self.preview(rule, state.get("count", 0) + 1)
                    state.pop("error", None)
                    if not preview["active"]:
                        if state.get("count") and rule.get("clear_on_resolve", True):
                            for service in rule["devices"]:
                                try:
                                    async with asyncio.timeout(2):
                                        await self.send_to_recipient(service, {"message": "clear_notification", "data": {"tag": notification_tag(self.runtime.vehicle, rule["id"])}})
                                except Exception as error:
                                    await self.record(rule, "error", error="Could not clear notification: " + str(error)[:200])
                        self.state[rule["id"]] = {"last": state.get("last", 0)}
                        continue
                    if state.get("since") is None:
                        state["since"] = now
                    if state.get("dismissed") or now - state["since"] < rule["delay"]:
                        continue
                    count = state.get("count", 0)
                    if count >= rule["max_sends"] or (count and (not rule["repeat"] or now - state.get("last", 0) < rule["repeat"])):
                        continue
                    if not count and now - state.get("last", 0) < rule["cooldown"]:
                        continue
                    from homeassistant.util import dt as dt_util
                    quiet = quiet_now(rule["quiet"], dt_util.now().strftime("%H:%M")) and rule["severity"] != "critical"
                    if quiet and rule["quiet"]["mode"] == "skip":
                        state.update(count=count + 1, last=now)
                        await self.record(rule, "quiet_hours", message="Notification suppressed during quiet hours")
                        continue
                    state["token"] = "DEEPAL_COMPANION_DISMISS_" + uuid.uuid4().hex
                    state.update(count=count + 1, last=now)
                    # Persist the attempt before sending: a restart must not duplicate it.
                    await self.persist()
                    await self.deliver(rule, preview, state["token"], silent=quiet)
                except Exception as error:
                    message = str(error)[:300]
                    if state.get("error") != message:
                        await self.record(rule, "error", error=message)
                        state["error"] = message
            if before != json.dumps([self.state, self.history], sort_keys=True):
                await self.persist()

    async def stop(self):
        self.stopped = True
        if self.unsub:
            self.unsub()
        if self.event_unsub:
            self.event_unsub()
        async with self.lock:
            await self.persist()
