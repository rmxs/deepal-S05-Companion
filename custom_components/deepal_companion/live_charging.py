"""Persistent charging Live Activities (iOS) and Live Updates (Android)."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import math
import re
import time
import uuid

DEFAULT = {"enabled": False, "devices": [], "min_interval": 300,
           "battery_step": 5, "show_timer": True, "max_age": 1800, "icon": "", "url": ""}


def validate_live(value):
    if not isinstance(value, dict):
        raise ValueError("Invalid live charging settings")
    result = {**DEFAULT, **value}
    if set(result) - set(DEFAULT):
        raise ValueError("Unknown live charging setting")
    for key in ("enabled", "show_timer"):
        if type(result[key]) is not bool:
            raise ValueError("Invalid live charging " + key)
    for key, low, high in (("min_interval", 60, 3600), ("battery_step", 1, 20), ("max_age", 300, 86400)):
        if type(result[key]) is not int or not low <= result[key] <= high:
            raise ValueError("Invalid live charging " + key)
    if not isinstance(result["icon"], str) or (result["icon"] and (len(result["icon"]) > 84 or not re.fullmatch(r"mdi:[a-z0-9-]+", result["icon"]))):
        raise ValueError("Invalid icon")
    if not isinstance(result["url"], str) or (result["url"] and not re.fullmatch(r"/[\w\-./%]{0,160}", result["url"])):
        raise ValueError("Invalid page to open when tapped")
    devices = result["devices"]
    if not isinstance(devices, list) or len(devices) > 20 or any(
        not isinstance(device, str) or not re.fullmatch(r"(?:notify\.[a-z0-9_]+|mobile_app_[a-z0-9_]+)", device) for device in devices
    ):
        raise ValueError("Choose Mobile App devices for live charging")
    result["devices"] = list(dict.fromkeys(devices))
    if result["enabled"] and not devices:
        raise ValueError("Choose a device for live charging")
    return result


def supported():
    from homeassistant.const import __version__
    match = re.match(r"(\d+)\.(\d+)", __version__)
    return bool(match and tuple(map(int, match.groups())) >= (2026, 7))


def stamp(state):
    value = getattr(state, "last_reported", None) or getattr(state, "last_updated", None)
    return value.timestamp() if isinstance(value, datetime) else 0


def number(state):
    try:
        value = float(state.state)
        return value if math.isfinite(value) else None
    except (AttributeError, TypeError, ValueError):
        return None


class LiveCharging:
    def __init__(self, owner):
        self.owner, self.runtime, self.hass = owner, owner.runtime, owner.hass
        self.state = {}
        self.last_attempt = {}
        self.last_errors = {}

    async def start(self):
        self.state = await self.owner.db("get", self.runtime.vehicle, "live_charging_state", {})

    async def persist(self):
        await self.owner.db("put", self.runtime.vehicle, "live_charging_state", self.state)

    def options(self):
        return validate_live(self.owner.config.get("live_charging", DEFAULT))

    def get(self, role, logical=None):
        entity = getattr(self.runtime, "entities", {}).get(role) or getattr(self.runtime, "live_entities", {}).get(role)
        if logical:
            entity = self.runtime.config.get("entities", {}).get(logical) or entity
            entity = entity or logical.replace(".", "." + self.runtime.config.get("prefix", "s05") + "_", 1)
        return self.hass.states.get(entity) if entity else None

    def snapshot(self, now, options):
        def fresh(state):
            return state is not None and not getattr(state, "attributes", {}).get("restored") and \
                str(state.state).lower() not in {"unknown", "unavailable", "none", ""} and \
                0 <= now - stamp(state) <= options["max_age"]
        cloud = self.get("cloud")
        if cloud is not None and (not fresh(cloud) or cloud.state == "off"):
            return None
        batt = self.get("batt")
        level = number(batt)
        if not fresh(batt) or level is None or not 0 <= level <= 100:
            return None
        currents = [(mode, self.get(role)) for role, mode in (("ac", "AC"), ("dc", "DC"))]
        currents = [(mode, state) for mode, state in currents if fresh(state) and number(state) is not None and number(state) >= 0]
        binary, plug = self.get("charging"), self.get("plug")
        evidence = [(stamp(state), number(state) > .5) for _, state in currents]
        if fresh(binary) and binary.state in {"on", "off"}:
            evidence.append((stamp(binary), binary.state == "on"))
        if fresh(plug) and plug.state == "off":
            evidence.append((stamp(plug), False))
        if not evidence:
            return None
        latest = max(ts for ts, _ in evidence)
        charging = any(active for ts, active in evidence if ts == latest)
        active = [(mode, state) for mode, state in currents if number(state) > .5]
        mode, current = max(active, key=lambda pair: number(pair[1]), default=("", None))
        result = {"charging": charging, "battery": round(level), "mode": mode,
                  "current": round(number(current), 1) if current else None,
                  "updated": min(stamp(batt), latest), "evidence": latest, "end": None}
        # Optional mapped sensor, then the same formatted sensor aliases as the card.
        remaining = self.get("remaining", "sensor.remaining_charge_time_h_mm")
        if remaining is None:
            remaining = self.get("remaining", "sensor.remaining_charge_time_hhmm")
        if fresh(remaining):
            text = str(remaining.state)
            match = re.fullmatch(r"(\d{1,3}):(\d{2})(?::(\d{2}))?", text)
            seconds = None
            if match and int(match[2]) < 60 and int(match[3] or 0) < 60:
                seconds = int(match[1]) * 3600 + int(match[2]) * 60 + int(match[3] or 0)
            else:
                duration = number(remaining)
                unit = remaining.attributes.get("unit_of_measurement", "")
                if duration is not None and unit in {"min", "h", "s"}:
                    seconds = duration * {"min": 60, "h": 3600, "s": 1}[unit]
            if seconds is not None and 0 < seconds <= 86400:
                end = stamp(remaining) + seconds
                if end > now:
                    result["end"] = round(end)
        return result

    def tag(self, test=False):
        key = hashlib.sha256(self.runtime.vehicle.encode()).hexdigest()[:20]
        return "dc_test_" + key if test else "dc_charge_" + key + "_" + uuid.uuid4().hex[:16]

    def payload(self, snapshot, options, tag, test=False):
        updated = datetime.fromtimestamp(snapshot["updated"], timezone.utc).strftime("%d %b %H:%M UTC")
        status = "Charging" if snapshot["charging"] else "Not charging"
        parts = [("Test · " if test else "") + status, str(snapshot["battery"]) + "%"]
        if snapshot["charging"] and snapshot["current"] is not None:
            parts.append(f'{snapshot["mode"]} · {snapshot["current"]:g} A')
        parts.append("Reported " + updated)
        color = self.runtime.config.get("lvl_green", "#63cba3")
        if not isinstance(color, str) or not re.fullmatch(r"#[a-fA-F0-9]{6}", color):
            color = "#63cba3"
        data = {"tag": tag, "live_update": True, "progress": snapshot["battery"], "progress_max": 100,
                "critical_text": str(snapshot["battery"]) + "%", "notification_icon": options.get("icon") or "mdi:ev-station",
                "color": color, "notification_icon_color": color, "progress_bar_color": color,
                "silent": True, "alert_once": True, "chronometer": False}
        if options.get("url"):
            data.update(url=options["url"], clickAction=options["url"])
        if options["show_timer"] and snapshot["charging"] and snapshot["end"]:
            data.update(chronometer=True, when=snapshot["end"], when_relative=False, text_color=color)
        # The title is the information itself; the message carries the details.
        return {"title": " · ".join(parts[:2]), "message": " · ".join(parts[2:]), "data": data}

    async def send(self, device, payload):
        try:
            async with asyncio.timeout(10):
                resolved = await self.owner.send_to_recipient(device, deepcopy(payload))
            return {"device": resolved, "status": "accepted"}
        except Exception as error:
            return {"device": device, "status": "error", "error": str(error)[:300]}

    async def tick(self, now=None):
        now = time.time() if now is None else now
        options = self.options()
        enabled = self.owner.config["enabled"] and options["enabled"] and supported()
        before = deepcopy(self.state)
        active = self.state.setdefault("active", {})
        snap = self.snapshot(now, options) if enabled else None
        # A fresh stop must be observed twice; mixed sensor updates do not end an activity.
        stopped = False
        if snap and not snap["charging"]:
            self.state.setdefault("stop_since", now)
            stopped = now - self.state["stop_since"] >= 30
        else:
            self.state.pop("stop_since", None)
        for device in list(active):
            if not enabled or device not in options["devices"] or stopped:
                if now - self.last_attempt.get(device, 0) < options["min_interval"]:
                    continue
                result = await self.send(device, {"message": "clear_notification", "data": {"tag": self.state["tag"]}})
                self.last_attempt[device] = now
                if result["status"] == "accepted":
                    del active[device]
        if not active and (not enabled or stopped):
            self.state = {"test_devices": self.state["test_devices"]} if self.state.get("test_devices") else {}
        elif enabled and snap and snap["charging"]:
            if not self.state.get("tag"):
                self.state.update(tag=self.tag())
            for device in options["devices"]:
                previous = active.get(device, {})
                if now - self.last_attempt.get(device, previous.get("sent", 0)) < options["min_interval"]:
                    continue
                end = snap["end"] if options["show_timer"] else None
                signature = [snap["battery"] // options["battery_step"], snap["mode"], end is not None]
                changed = signature != previous.get("signature") or abs((end or 0) - (previous.get("end") or 0)) >= 300
                # At most one refresh per five minutes when readings are newly reported.
                refreshed = now - previous.get("sent", 0) >= 300 and snap["updated"] > previous.get("updated", 0)
                if previous and not changed and not refreshed:
                    continue
                result = await self.send(device, self.payload(snap, options, self.state["tag"]))
                self.last_attempt[device] = now
                if result["status"] == "accepted":
                    active[device] = {"sent": now, "signature": signature, "end": end, "updated": snap["updated"]}
                    self.last_errors.pop(device, None)
                elif self.last_errors.get(device) != result["error"]:
                    self.last_errors[device] = result["error"]
                    await self.owner.record({"id": "live_charging", "name": "Live charging"}, "error", error=result["error"])
                    await self.owner.persist()
        if before != self.state:
            await self.persist()

    async def test(self, value, stop=False):
        options = validate_live(value)
        if not supported():
            raise ValueError("Live charging needs Home Assistant Core 2026.7 or later")
        async with self.owner.lock:
            if stop:
                targets = self.state.get("test_devices", [])
                if not targets:
                    return {"deliveries": [], "ended": True}
                payload = {"message": "clear_notification", "data": {"tag": self.tag(test=True)}}
            else:
                snap = self.snapshot(time.time(), options)
                if snap is None:
                    raise ValueError("Fresh battery and charging readings are needed for a live test")
                targets = options["devices"]
                if not targets:
                    raise ValueError("Choose a Mobile App phone first")
                payload = self.payload(snap, options, self.tag(test=True), test=True)
            results = [await self.send(device, payload) for device in targets]
            tracked = set(self.state.get("test_devices", []))
            for result in results:
                if result["status"] == "accepted":
                    (tracked.discard if stop else tracked.add)(result["device"])
            if tracked:
                self.state["test_devices"] = sorted(tracked)
            else:
                self.state.pop("test_devices", None)
            await self.persist()
            await self.owner.record({"id": "live_charging", "name": "Live charging test"}, "test_ended" if stop else "test", deliveries=results)
            await self.owner.persist()
            return {"deliveries": results, "ended": stop}
