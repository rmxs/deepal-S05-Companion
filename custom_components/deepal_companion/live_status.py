"""Live climate and live "left open or unlocked" notifications (iOS Live Activities, Android Live Updates)."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import hashlib
import re
import time

from .live_charging import local_time, number, stamp, supported

OPEN_ITEMS = {
    "front_left_door": ("binary_sensor.front_left_door", "Front left door"),
    "front_right_door": ("binary_sensor.front_right_door", "Front right door"),
    "rear_left_door": ("binary_sensor.rear_left_door", "Rear left door"),
    "rear_right_door": ("binary_sensor.rear_right_door", "Rear right door"),
    "front_left_window": ("binary_sensor.front_left_window_open", "Front left window"),
    "front_right_window": ("binary_sensor.front_right_window_open", "Front right window"),
    "rear_left_window": ("binary_sensor.rear_left_window_open", "Rear left window"),
    "rear_right_window": ("binary_sensor.rear_right_window_open", "Rear right window"),
    "hood": ("binary_sensor.hood", "Bonnet"),
    "trunk": ("binary_sensor.trunk", "Trunk"),
}
COLOR = re.compile(r"#[a-fA-F0-9]{6}")
ICON = re.compile(r"mdi:[a-z0-9-]+")
PAGE = re.compile(r"/[\w\-./%]{0,160}")
KINDS = {
    "climate": {
        "key": "live_climate", "name": "Live climate", "icon": "mdi:fan", "title": "Climate",
        "default": {"enabled": False, "devices": [], "min_interval": 120, "max_age": 1800, "start_delay": 0, "end_delay": 30,
                    "temp_step": 1, "ready_margin": 1, "show_target": True, "show_outside": False, "show_progress": True,
                    "show_timer": True, "show_updated": False, "turn_off_button": True, "max_run": 0, "title": "", "icon": "", "color": "", "url": ""},
        "ranges": {"min_interval": (30, 3600), "max_age": (300, 86400), "start_delay": (0, 600), "end_delay": (0, 600),
                   "temp_step": (1, 5), "ready_margin": (0, 5), "max_run": (0, 240)},
        "bools": ("enabled", "show_target", "show_outside", "show_progress", "show_timer", "show_updated", "turn_off_button"),
    },
    "open": {
        "key": "live_open", "name": "Live left open or unlocked", "icon": "mdi:car-door-lock-open", "title": "Left open",
        "default": {"enabled": False, "devices": [], "min_interval": 30, "max_age": 3600, "start_delay": 300, "end_delay": 10,
                    "items": list(OPEN_ITEMS), "include_unlocked": True, "only_parked": True, "lock_button": True, "max_shown": 4, "show_count": True,
                    "show_timer": True, "show_updated": False, "title": "", "icon": "", "color": "", "url": ""},
        "ranges": {"min_interval": (15, 3600), "max_age": (300, 86400), "start_delay": (0, 3600), "end_delay": (0, 600), "max_shown": (1, 10)},
        "bools": ("enabled", "include_unlocked", "only_parked", "lock_button", "show_count", "show_timer", "show_updated"),
    },
}
ACTIONS = {"DEEPAL_COMPANION_LIVE_CLIMATE_OFF": "climate", "DEEPAL_COMPANION_LIVE_OPEN_LOCK": "open"}


def validate_status(kind, value):
    spec = KINDS[kind]
    if not isinstance(value, dict):
        raise ValueError("Invalid " + spec["name"].lower() + " settings")
    result = {**spec["default"], **value}
    if set(result) - set(spec["default"]):
        raise ValueError("Unknown " + spec["name"].lower() + " setting")
    for key in spec["bools"]:
        if type(result[key]) is not bool:
            raise ValueError(f"Invalid {spec['name'].lower()} {key}")
    for key, (low, high) in spec["ranges"].items():
        if type(result[key]) is not int or not low <= result[key] <= high:
            raise ValueError(f"Invalid {spec['name'].lower()} {key}")
    if not isinstance(result["title"], str) or len(result["title"]) > 80:
        raise ValueError("Invalid title")
    if not isinstance(result["icon"], str) or (result["icon"] and (len(result["icon"]) > 84 or not ICON.fullmatch(result["icon"]))):
        raise ValueError("Invalid icon")
    if not isinstance(result["color"], str) or (result["color"] and not COLOR.fullmatch(result["color"])):
        raise ValueError("Invalid colour")
    if not isinstance(result["url"], str) or (result["url"] and not PAGE.fullmatch(result["url"])):
        raise ValueError("Invalid page to open when tapped")
    devices = result["devices"]
    if not isinstance(devices, list) or len(devices) > 20 or any(
        not isinstance(device, str) or not re.fullmatch(r"(?:notify\.[a-z0-9_]+|mobile_app_[a-z0-9_]+)", device) for device in devices
    ):
        raise ValueError("Choose Mobile App devices for " + spec["name"].lower())
    result["devices"] = list(dict.fromkeys(devices))
    if kind == "open":
        items = result["items"]
        if not isinstance(items, list) or any(item not in OPEN_ITEMS for item in items):
            raise ValueError("Invalid items to watch")
        result["items"] = [item for item in OPEN_ITEMS if item in items]
        if result["enabled"] and not result["items"] and not result["include_unlocked"]:
            raise ValueError("Choose at least one thing to watch")
    if result["enabled"] and not devices:
        raise ValueError("Choose a device for " + spec["name"].lower())
    return result


def validate_all(value):
    """Validate the optional live climate / live open blocks of the notification settings."""
    return {spec["key"]: validate_status(kind, value[spec["key"]]) for kind, spec in KINDS.items() if spec["key"] in value}


class LiveStatus:
    """One persistent live notification per kind. Nothing here ever sends a command except the two buttons the user taps."""

    def __init__(self, owner):
        self.owner, self.runtime, self.hass = owner, owner.runtime, owner.hass
        self.state = {}
        self.last_attempt = {}
        self.last_errors = {}

    async def start(self):
        self.state = await self.owner.db("get", self.runtime.vehicle, "live_status_state", {})

    async def persist(self):
        await self.owner.db("put", self.runtime.vehicle, "live_status_state", self.state)

    def options(self, kind):
        spec = KINDS[kind]
        return validate_status(kind, self.owner.config.get(spec["key"], spec["default"]))

    def entity(self, logical):
        mapped = self.runtime.config.get("entities", {}).get(logical)
        return mapped or logical.replace(".", "." + self.runtime.config.get("prefix", "s05") + "_", 1)

    def get(self, logical):
        return self.hass.states.get(self.entity(logical))

    @staticmethod
    def fresh(state, now, options):
        return state is not None and not getattr(state, "attributes", {}).get("restored") and \
            str(state.state).lower() not in {"unknown", "unavailable", "none", ""} and 0 <= now - stamp(state) <= options["max_age"]

    def connected(self, now, options):
        cloud = self.get("binary_sensor.cloud_connection")
        return cloud is None or (self.fresh(cloud, now, {**options, "max_age": 10 ** 9}) and cloud.state != "off")

    # ---- readings -------------------------------------------------------------------------------------------------
    def climate_snapshot(self, now, options):
        if not self.connected(now, options):
            return None
        main, flag = self.get("climate.cabin_climate"), self.get("binary_sensor.climate_on")
        if flag is not None and str(flag.state).lower() in {"on", "off"}:
            on, base = flag.state == "on", flag
        elif main is not None and str(main.state).lower() not in {"unknown", "unavailable", "none", ""}:
            on, base = main.state != "off", main
        else:
            return None
        attrs = main.attributes if main is not None else {}
        current = number(self.get("sensor.inside_temperature"))
        if current is None:
            try:
                current = float(attrs.get("current_temperature"))
            except (TypeError, ValueError):
                current = None
        try:
            target = float(attrs.get("temperature"))
        except (TypeError, ValueError):
            target = None
        outside = number(self.get("sensor.outside_temperature"))
        unit = getattr(getattr(self.hass.config, "units", None), "temperature_unit", "°C")
        on = on and 0 <= now - stamp(base) <= options["max_age"]  # a reading that stopped updating cannot keep a live notification alive
        return {"active": on, "current": current, "target": target, "outside": outside, "unit": unit if isinstance(unit, str) else "°C",
                "updated": stamp(base)}

    @staticmethod
    def wait(kind, options):
        """Seconds the alert must stay true before it shows. For "left open" while parked, the vehicle reports about every 5 minutes
        and the odometer must also be still for 2 minutes first, so a shorter wait could show it on a car that is still driving
        (it would flicker on and off). The wait is therefore at least 5 minutes, counted from the moment the car stopped."""
        if kind == "open" and options["only_parked"]:
            return max(options["start_delay"], 300) - 120
        return options["start_delay"]

    def running(self):
        """True while the car is moving. The car never switches itself off, so "on" does not mean in use: it counts as moving
        only while the odometer changed in the last 2 minutes. Without an odometer, the engine and power status decide."""
        odo = self.get("sensor.total_odometer")
        if odo is not None and str(odo.state).lower() not in {"unknown", "unavailable", "none", ""}:
            return time.time() - stamp(odo) < 120
        engine, power = self.get("binary_sensor.engine"), self.get("sensor.power_status")
        if engine is not None and str(engine.state).lower() == "on":
            return True
        return power is not None and str(power.state).lower() not in {"off", "unknown", "unavailable", "none", ""}

    def open_snapshot(self, now, options):
        if not self.connected(now, options):
            return None
        if options["only_parked"] and self.running():
            # Open windows while driving are normal: nothing to report, and a running notification ends.
            lock = self.get("lock.doors")
            return {"active": False, "items": [], "unlocked": False, "updated": stamp(lock) if lock else 0}
        items, known = [], False
        for key in options["items"]:
            logical, label = OPEN_ITEMS[key]
            state = self.get(logical)
            if state is None or str(state.state).lower() in {"unknown", "unavailable", "none", ""}:
                continue
            known = True
            if state.state != "on":
                continue
            if key.endswith("_window"):
                opening = self.get("sensor." + logical.split(".", 1)[1].removesuffix("_open") + "_opening")
                value = number(opening) if opening is not None else None
                if value is not None and value <= 0:
                    continue
            items.append(label)
        unlocked, lock = False, self.get("lock.doors")
        if options["include_unlocked"] and lock is not None and str(lock.state).lower() not in {"unknown", "unavailable", "none", ""}:
            known = True
            unlocked = lock.state == "unlocked"
            sensor = self.get("binary_sensor.doors_lock_state")
            if unlocked and sensor is not None and sensor.state in {"on", "off"}:
                unlocked = sensor.state == "on"
        if not known:
            return None
        stamps = [stamp(self.get(OPEN_ITEMS[key][0])) for key in options["items"] if self.get(OPEN_ITEMS[key][0]) is not None]
        return {"active": bool(items or unlocked), "items": items, "unlocked": unlocked, "updated": max(stamps + [stamp(lock) if lock else 0])}

    def snapshot(self, kind, now, options):
        return self.climate_snapshot(now, options) if kind == "climate" else self.open_snapshot(now, options)

    # ---- notification content -----------------------------------------------------------------------------------
    def color(self, kind, options, snap):
        if options["color"]:
            return options["color"]
        config = self.runtime.config
        name = ("lvl_green" if kind == "climate" else "lvl_red" if snap.get("unlocked") or snap.get("items") else "lvl_green")
        value = config.get(name)
        return value if isinstance(value, str) and COLOR.fullmatch(value) else "#63cba3"

    def payload(self, kind, snap, options, tag, since, test=False):
        spec = KINDS[kind]
        degree = "°" if snap.get("unit", "°C") in {"°C", "°F"} else ""
        data = {"tag": tag, "live_update": True, "notification_icon": options["icon"] or spec["icon"], "silent": True, "alert_once": True,
                "chronometer": False, "color": self.color(kind, options, snap)}
        # Every coloured part follows the one state colour from the card palette.
        data["notification_icon_color"] = data["progress_bar_color"] = data["text_color"] = data["color"]
        parts = []
        if kind == "climate":
            cur, tar = snap["current"], snap["target"]
            ready = cur is not None and tar is not None and abs(tar - cur) <= options["ready_margin"]
            if cur is not None:
                text = f"Inside {cur:.1f}{degree}"
                if options["show_target"] and tar is not None:
                    text += f" → {tar:g}{degree}"
                parts.append(text)
            else:
                parts.append("Climate on")
            if ready:
                parts.append("Ready")
            if options["show_outside"] and snap.get("outside") is not None:
                parts.append(f"Outside {snap['outside']:.0f}{degree}")
            if cur is not None:
                data["critical_text"] = f"{cur:.1f}{degree}"
            start = snap.get("start_temp")
            if options["show_progress"] and cur is not None and tar is not None and start is not None and tar != start:
                data.update(progress=round(max(0, min(1, (cur - start) / (tar - start))) * 100), progress_max=100)
            if ready and options["show_progress"]:
                data.update(progress=100, progress_max=100)
            if options["turn_off_button"] and not test:
                data["actions"] = [{"action": "DEEPAL_COMPANION_LIVE_CLIMATE_OFF", "title": "Turn off"}]
        else:
            shown = snap["items"][:options["max_shown"]]
            extra = len(snap["items"]) - len(shown)
            if shown:
                parts.append(", ".join(shown) + (f" +{extra} more" if extra > 0 else ""))
            if snap["unlocked"]:
                parts.append("Unlocked")
            count = len(snap["items"]) + (1 if snap["unlocked"] else 0)
            if options["show_count"]:
                data["critical_text"] = str(count)
            if options["lock_button"] and not test:
                data["actions"] = [{"action": "DEEPAL_COMPANION_LIVE_OPEN_LOCK", "title": "Lock vehicle"}]
        if options["url"]:
            data.update(url=options["url"], clickAction=options["url"])
        if options["show_timer"] and since:
            data.update(chronometer=True, when=round(since), when_relative=False)
        if options["show_updated"] and snap.get("updated"):
            parts.append("Reported " + local_time(snap["updated"], "%H:%M"))
        if test:
            parts.append("Test")
        # The title is the information itself; the message carries the details.
        return {"title": parts[0] if parts else spec["title"], "message": " · ".join(parts[1:]) or spec["title"], "data": data}

    @staticmethod
    def rule(kind):
        spec = KINDS[kind]
        return {"id": spec["key"], "name": spec["name"], "data": {"notification_icon": spec["icon"]}}

    def tag(self, kind, test=False):
        key = hashlib.sha256((self.runtime.vehicle + kind).encode()).hexdigest()[:20]
        return f"dc_{'test' if test else 'live'}_{kind}_{key}"

    async def send(self, device, payload):
        try:
            async with asyncio.timeout(10):
                resolved = await self.owner.send_to_recipient(device, deepcopy(payload))
            return {"device": resolved, "status": "accepted"}
        except Exception as error:
            return {"device": device, "status": "error", "error": str(error)[:300] or type(error).__name__}

    def signature(self, kind, snap, options):
        if kind == "climate":
            step = options["temp_step"]
            cur = None if snap["current"] is None else round(snap["current"] / step)
            ready = snap["current"] is not None and snap["target"] is not None and abs(snap["target"] - snap["current"]) <= options["ready_margin"]
            return [cur, snap["target"], ready, snap.get("outside") is not None and round(snap["outside"])]
        return [sorted(snap["items"]), snap["unlocked"]]

    # ---- engine -------------------------------------------------------------------------------------------------
    async def tick(self, now=None):
        now = time.time() if now is None else now
        before = deepcopy(self.state)
        for kind in KINDS:
            await self.tick_kind(kind, now)
        for kind in list(self.state):
            if not self.state[kind].get("active"):
                self.state[kind].pop("active", None)
            if not self.state[kind]:
                del self.state[kind]
        if before != self.state:
            await self.persist()

    async def tick_kind(self, kind, now):
        spec, options = KINDS[kind], self.options(kind)
        enabled = self.owner.config["enabled"] and options["enabled"] and supported()
        state = self.state.setdefault(kind, {})
        active = state.setdefault("active", {})
        snap = self.snapshot(kind, now, options) if enabled else None
        if enabled and snap is None:
            state.setdefault("unknown_since", now)
        else:
            state.pop("unknown_since", None)
        lost = enabled and snap is None and now - state.get("unknown_since", now) >= options["max_age"]
        wanted = bool(snap and snap["active"])
        if wanted:
            state.pop("stop_since", None)
            state.setdefault("since", now)
            if kind == "climate" and "start_temp" not in state and snap["current"] is not None:
                state["start_temp"] = snap["current"]
        elif snap is not None:
            state.setdefault("stop_since", now)
        ended = lost or (snap is not None and not wanted and now - state.get("stop_since", now) >= options["end_delay"])
        too_long = kind == "climate" and options["max_run"] and wanted and now - state.get("since", now) - options["start_delay"] >= options["max_run"] * 60
        if too_long:
            state["expired"] = True
        if state.get("expired") and not wanted:
            state.pop("expired", None)
        stop = ended or bool(state.get("expired"))
        for device in list(active):
            if not enabled or device not in options["devices"] or stop:
                if now - self.last_attempt.get(device, 0) < 30:
                    continue
                result = await self.send(device, {"message": "clear_notification", "data": {"tag": state["tag"]}})
                self.last_attempt[device] = now
                if result["status"] == "accepted":
                    del active[device]
        if not active and (not enabled or stop):
            kept = {key: state[key] for key in ("test_devices", "expired") if state.get(key)}
            if state.get("logged"):
                await self.owner.record(self.rule(kind), "live_ended")
                await self.owner.persist()
            self.state[kind] = kept
            return
        if not (enabled and wanted) or state.get("expired") or now - state.get("since", now) < self.wait(kind, options):
            return
        if not state.get("tag"):
            state["tag"] = self.tag(kind)
        for device in options["devices"]:
            previous = active.get(device, {})
            if now - self.last_attempt.get(device, previous.get("sent", 0)) < options["min_interval"]:
                continue
            signature = self.signature(kind, snap, options)
            refreshed = now - previous.get("sent", 0) >= 600 and snap["updated"] > previous.get("updated", 0)
            if previous and signature == previous.get("signature") and not refreshed:
                continue
            payload = self.payload(kind, {**snap, "start_temp": state.get("start_temp")}, options, state["tag"], state.get("since"))
            result = await self.send(device, payload)
            self.last_attempt[device] = now
            if result["status"] == "accepted":
                active[device] = {"sent": now, "signature": signature, "updated": snap["updated"]}
                self.last_errors.pop((kind, device), None)
                if not state.get("logged"):  # one Recent activity entry per live notification, not one per update
                    state["logged"] = True
                    await self.owner.record(self.rule(kind), "live_started", deliveries=[result])
                    await self.owner.persist()
            elif self.last_errors.get((kind, device)) != result["error"]:
                self.last_errors[(kind, device)] = result["error"]
                await self.owner.record({"id": spec["key"], "name": spec["name"]}, "error", error=result["error"])
                await self.owner.persist()

    async def action(self, token):
        """A tap on the notification's own button. Only works while that live notification is running."""
        kind = ACTIONS.get(token)
        if not kind or not self.owner.config["enabled"] or not self.options(kind)["enabled"] or not self.state.get(kind, {}).get("active"):
            return
        spec = KINDS[kind]
        async with self.owner.lock:
            service = ("climate", "turn_off", self.entity("climate.cabin_climate")) if kind == "climate" else ("lock", "lock", self.entity("lock.doors"))
            try:
                async with asyncio.timeout(15):
                    await self.hass.services.async_call(service[0], service[1], {"entity_id": service[2]}, blocking=True)
            except Exception as error:
                await self.owner.record({"id": spec["key"], "name": spec["name"]}, "error", error=str(error)[:300] or type(error).__name__)
            else:
                await self.owner.record({"id": spec["key"], "name": spec["name"]}, "turned_off" if kind == "climate" else "locked")
            await self.owner.persist()

    async def test(self, kind, value, stop=False):
        if kind not in KINDS:
            raise ValueError("Unknown live notification")
        options = validate_status(kind, value)
        spec = KINDS[kind]
        if not supported():
            raise ValueError(spec["name"] + " needs Home Assistant Core 2026.7 or later")
        async with self.owner.lock:
            state = self.state.setdefault(kind, {})
            if stop:
                targets = state.get("test_devices", [])
                if not targets:
                    return {"deliveries": [], "ended": True}
                payload = {"message": "clear_notification", "data": {"tag": self.tag(kind, test=True)}}
            else:
                targets = options["devices"]
                if not targets:
                    raise ValueError("Choose a Mobile App phone first")
                sample = ({"current": 18.5, "target": 22.0, "outside": 9.0, "unit": "°C", "start_temp": 12.0, "updated": time.time()} if kind == "climate"
                          else {"items": ["Front left door", "Trunk"], "unlocked": True, "updated": time.time()})
                payload = self.payload(kind, sample, options, self.tag(kind, test=True), time.time() - 120, test=True)
            results = [await self.send(device, payload) for device in targets]
            tracked = set(state.get("test_devices", []))
            for result in results:
                if result["status"] == "accepted":
                    (tracked.discard if stop else tracked.add)(result["device"])
            if tracked:
                state["test_devices"] = sorted(tracked)
            else:
                state.pop("test_devices", None)
            await self.persist()
            await self.owner.record({"id": spec["key"], "name": spec["name"] + " test"}, "test_ended" if stop else "test", deliveries=results)
            await self.owner.persist()
            return {"deliveries": results, "ended": stop}
