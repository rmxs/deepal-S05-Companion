"""Remote cabin climate preconditioning: one controller for manual, scheduled and notification START/STOP.

Verified behaviour of the Deepal Alternative climate entity (custom_components/deepal/climate.py):
- explicit commands, not a toggle: climate.turn_off sends OFF; climate.set_temperature sends ON with the target;
- a blocking service call returns after the gateway reports the command result and raises on failure;
- the coordinator keeps an optimistic value for about 120 s, so Home Assistant state right after a command is
  not proof. A START/STOP is confirmed only when the call succeeded AND a vehicle report newer than the command
  shows the wanted state; a later re-check after the optimistic window catches early vehicle-side shutdown.
The original Deepal app states the A/C turns off automatically "within 15 mins" after remote activation, so a
session never runs longer than 15 minutes here, is never extended, and the end time is always an estimate.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import date, datetime, time as dtime, timedelta
import logging
import re
import time
import uuid

from .phone_text import tr

_LOGGER = logging.getLogger(__name__)

MAX_SESSION_MIN = 15
HOLD_SECONDS = 130          # optimistic hold in the coordinator (120 s) plus margin
START_GRACE = 300           # a scheduled START older than this is marked missed, never run late
POLL = 5
VERIFY_POKE_FIRST = 8      # seconds after a command before asking the vehicle for a fresh report
VERIFY_POKE_EVERY = 25    # then again at this interval while the answer is still missing
REPORT_TOLERANCE = 2      # vehicle report times are whole seconds: a report in the same second as the command counts
MANUAL_REFRESH_GAP = 15   # seconds between two refreshes asked for with the card's button
REFRESH_WAIT = 45         # seconds to wait for a fresh vehicle report after "Refresh vehicle data"
HISTORY_LIMIT = 500
HISTORY_DAYS = 30  # session history rotation
UNKNOWN_STATES = {"unknown", "unavailable", "none", ""}
STATES = ("IDLE", "START_REQUESTED", "STARTING", "VERIFYING_START", "RETRYING_START", "ACTIVE", "STOP_REQUESTED",
          "STOPPING", "VERIFYING_STOP", "RETRYING_STOP", "INACTIVE", "FAILED", "UNKNOWN", "SUPERSEDED")
START_PHASES = {"START_REQUESTED", "STARTING", "VERIFYING_START", "RETRYING_START"}
STOP_PHASES = {"STOP_REQUESTED", "STOPPING", "VERIFYING_STOP", "RETRYING_STOP"}
EVENTS = {  # notification event -> default (quiet by default: results and problems only)
    "start_requested": False, "start_confirmed": True, "stop_requested": False, "stop_confirmed": True,
    "retry": False, "failure": True, "unknown": True, "schedule_result": True, "session_ended": True,
    "battery": True,
}
DEFAULT = {
    "scheduling_enabled": False, "default_temperature": 22.0, "default_duration": MAX_SESSION_MIN,
    "max_attempts": 3, "retry_delay": 30, "verify_timeout": 90,
    "battery": {"enabled": False, "min_soc": 20, "block_start": True, "auto_stop": True, "while_charging": True, "max_age": 1800},
    "notify": {"enabled": False, "devices": [], "live": True, "events": dict(EVENTS)},
    "schedules": [],
}
RANGES = {"default_duration": (1, MAX_SESSION_MIN), "max_attempts": (1, 3), "retry_delay": (10, 120), "verify_timeout": (30, 180)}
HHMM = re.compile(r"([01]\d|2[0-3]):[0-5]\d")
DEVICE = re.compile(r"(?:notify\.[a-z0-9_]+|mobile_app_[a-z0-9_]+)")
ACTION_STOP = "DEEPAL_COMPANION_PRECONDITION_STOP"
# Events that also appear in Notifications → Recent activity: (title, severity, icon)
ACTIVITY = {
    "start_requested": ("Preconditioning start requested", "info", "mdi:fan-clock"),
    "start_confirmed": ("Preconditioning on", "info", "mdi:fan"),
    "already_on": ("Climate already on, nothing changed", "info", "mdi:fan"),
    "start_blocked": ("Preconditioning blocked", "important", "mdi:battery-alert"),
    "start_failed": ("Preconditioning start failed", "critical", "mdi:alert-circle-outline"),
    "start_unknown": ("Preconditioning start not confirmed", "important", "mdi:help-circle-outline"),
    "stop_requested": ("Preconditioning stop requested", "info", "mdi:fan-off"),
    "stop_confirmed": ("Preconditioning stopped", "info", "mdi:fan-off"),
    "stop_failed": ("Preconditioning stop failed", "critical", "mdi:alert-circle-outline"),
    "stop_unknown": ("Preconditioning stop not confirmed", "important", "mdi:help-circle-outline"),
    "auto_shutdown": ("Preconditioning ended by the car", "info", "mdi:timer-off-outline"),
    "battery_stop": ("Battery protection stopped the climate", "important", "mdi:battery-alert"),
    "schedule_missed": ("Scheduled preconditioning missed", "important", "mdi:calendar-remove"),
    "schedule_skipped": ("Scheduled preconditioning skipped", "info", "mdi:calendar-blank"),
    "recovered": ("Preconditioning resumed after restart", "info", "mdi:restart"),
    "session_abandoned": ("Preconditioning state unknown", "important", "mdi:help-circle-outline"),
    "handed_over": ("Preconditioning handed over to the driver", "info", "mdi:steering"),
}


class CommandError(Exception):
    def __init__(self, message, retry=True, in_use=False):
        super().__init__(message)
        self.retry = retry
        self.in_use = in_use


def explain(text):
    """Turn a Deepal / Home Assistant error into a plain reason. Returns (message, retry, car_in_use)."""
    low = text.lower()
    if "1036" in low or "engine status" in low:
        return ("The car is switched on or being driven, so Deepal does not allow remote climate. "
                "It works only when the car is parked and switched off.", False, True)
    if "auth" in low or "credential" in low or "token" in low or "forbidden" in low or "permission" in low or "401" in low or "403" in low:
        # Two different problems. A sign-in that is no longer valid (expired session, bad credentials, failed
        # authentication) is fixed only by signing in again, so retrying cannot help. A request the account is not
        # allowed to make says nothing about the sign-in: report what was returned and keep the normal retry limit.
        if any(word in low for word in ("expire", "401", "unauthorized", "unauthorised", "authentication", "credential",
                                         "invalid token", "token invalid", "re-auth", "reauth", "not logged in", "login")):
            return ("The Deepal sign-in has expired. Open Deepal Alternative in Home Assistant and sign in again.", False, False)
        return ("Deepal rejected the request as not allowed for this account. Your sign-in itself looks fine: "
                "check that the account may control this car and that the car is still linked to it.", True, False)
    if "rate" in low or "too many" in low or "frequent" in low:
        return ("Deepal refused because too many commands were sent in a short time. Companion waits before trying again.", True, False)
    if "timed out" in low or "timeout" in low:
        return ("The car did not answer in time (weak mobile signal or the car is in deep sleep).", True, False)
    if "unavailable" in low or "not ready" in low:
        return ("The car is offline right now, so the command could not be delivered.", True, False)
    return (text, True, False)


def _temp(value, field="temperature"):
    if type(value) not in (int, float) or not 18 <= value <= 32 or round(value * 2) != value * 2:
        raise ValueError(f"Invalid {field}: use 18–32 °C in 0.5 steps")
    return float(value)


def validate_schedule(item):
    if not isinstance(item, dict):
        raise ValueError("Invalid schedule")
    allowed = {"id", "name", "enabled", "repeat", "date", "days", "time", "mode", "duration", "temperature", "created", "updated"}
    if set(item) - allowed:
        raise ValueError("Unknown schedule field")
    out = {"id": item.get("id") or uuid.uuid4().hex[:12], "name": str(item.get("name", ""))[:60],
           "enabled": item.get("enabled", True), "repeat": item.get("repeat", "once"), "date": item.get("date", ""),
           "days": item.get("days", []), "time": item.get("time", ""), "mode": item.get("mode", "start"),
           "duration": item.get("duration", MAX_SESSION_MIN), "temperature": _temp(item.get("temperature", 22.0)),
           "created": item.get("created") or time.time(), "updated": item.get("updated") or time.time()}
    if not isinstance(out["id"], str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", out["id"]):
        raise ValueError("Invalid schedule id")
    if type(out["enabled"]) is not bool:
        raise ValueError("Invalid schedule enabled")
    if out["repeat"] not in ("once", "daily", "weekdays", "custom"):
        raise ValueError("Invalid schedule repeat")
    if out["mode"] not in ("start", "ready_by"):
        raise ValueError("Invalid schedule mode")
    if not isinstance(out["time"], str) or not HHMM.fullmatch(out["time"]):
        raise ValueError("Invalid schedule time")
    if type(out["duration"]) is not int or not 1 <= out["duration"] <= MAX_SESSION_MIN:
        raise ValueError("Duration must be 1–15 minutes")
    if out["repeat"] == "once":
        try:
            date.fromisoformat(out["date"])
        except (TypeError, ValueError):
            raise ValueError("Choose a date for a one-time schedule") from None
        out["days"] = []
    else:
        out["date"] = ""
        if out["repeat"] == "daily":
            out["days"] = list(range(7))
        elif out["repeat"] == "weekdays":
            out["days"] = [0, 1, 2, 3, 4]
        elif not isinstance(out["days"], list) or not out["days"] or any(type(d) is not int or not 0 <= d <= 6 for d in out["days"]):
            raise ValueError("Choose at least one weekday")
        out["days"] = sorted(set(out["days"]))
    return out


def validate(value):
    if not isinstance(value, dict):
        raise ValueError("Invalid preconditioning settings")
    if set(value) - set(DEFAULT):
        raise ValueError("Unknown preconditioning setting")
    result = {**deepcopy(DEFAULT), **deepcopy(value)}
    if type(result["scheduling_enabled"]) is not bool:
        raise ValueError("Invalid scheduling switch")
    result["default_temperature"] = _temp(result["default_temperature"], "default temperature")
    for key, (low, high) in RANGES.items():
        if type(result[key]) is not int or not low <= result[key] <= high:
            raise ValueError(f"Invalid {key.replace('_', ' ')}")
    battery = {**DEFAULT["battery"], **(result["battery"] if isinstance(result["battery"], dict) else {})}
    if set(battery) - set(DEFAULT["battery"]):
        raise ValueError("Unknown battery protection setting")
    for key in ("enabled", "block_start", "auto_stop", "while_charging"):
        if type(battery[key]) is not bool:
            raise ValueError("Invalid battery protection " + key)
    if type(battery["min_soc"]) is not int or battery["min_soc"] not in range(10, 51, 5):
        raise ValueError("Minimum battery must be 10–50 % in 5 % steps")
    if type(battery["max_age"]) is not int or not 300 <= battery["max_age"] <= 7200:
        raise ValueError("Invalid battery reading age")
    result["battery"] = battery
    notify = {**DEFAULT["notify"], **(result["notify"] if isinstance(result["notify"], dict) else {})}
    if set(notify) - set(DEFAULT["notify"]):
        raise ValueError("Unknown notification setting")
    if type(notify["enabled"]) is not bool or type(notify["live"]) is not bool:
        raise ValueError("Invalid notification switch")
    events = {**EVENTS, **(notify["events"] if isinstance(notify["events"], dict) else {})}
    if set(events) - set(EVENTS) or any(type(v) is not bool for v in events.values()):
        raise ValueError("Invalid notification events")
    devices = notify["devices"]
    if not isinstance(devices, list) or len(devices) > 20 or any(not isinstance(d, str) or not DEVICE.fullmatch(d) for d in devices):
        raise ValueError("Choose Mobile App devices")
    notify.update(events=events, devices=list(dict.fromkeys(devices)))
    result["notify"] = notify
    if not isinstance(result["schedules"], list) or len(result["schedules"]) > 20:
        raise ValueError("Up to 20 schedules")
    result["schedules"] = [validate_schedule(item) for item in result["schedules"]]
    if len({s["id"] for s in result["schedules"]}) != len(result["schedules"]):
        raise ValueError("Duplicate schedule id")
    return result


# ---- schedule time maths ---------------------------------------------------------------------------------------
def localize(naive, tz):
    """Local wall time -> aware datetime. A time skipped by a DST jump moves forward by the gap; an ambiguous
    time uses its first occurrence. Never raises."""
    aware = naive.replace(tzinfo=tz, fold=0)
    back = aware.astimezone(tz).replace(tzinfo=None)
    if back != naive:  # nonexistent (spring forward): Python returns the pre-gap offset; normalise to real time
        aware = aware.astimezone(tz)
    return aware


def occurrences(schedule, tz, start, end):
    """(start_ts, stop_ts, key) for runs whose START falls in [start, end). Ready By moves START earlier by the
    preparation time, possibly into the previous day (overnight)."""
    first = datetime.fromtimestamp(start, tz).date() - timedelta(days=1)
    last = datetime.fromtimestamp(end, tz).date() + timedelta(days=1)
    hh, mm = map(int, schedule["time"].split(":"))
    day, out = first, []
    while day <= last:
        if (schedule["repeat"] == "once" and day.isoformat() == schedule["date"]) or (schedule["repeat"] != "once" and day.weekday() in schedule["days"]):
            anchor = localize(datetime.combine(day, dtime(hh, mm)), tz).timestamp()
            begin = anchor - schedule["duration"] * 60 if schedule["mode"] == "ready_by" else anchor
            if start <= begin < end:
                out.append((begin, begin + schedule["duration"] * 60, f"{schedule['id']}@{day.isoformat()}"))
        day += timedelta(days=1)
    return sorted(out)


def next_run(schedule, tz, now):
    if not schedule["enabled"]:
        return None
    runs = occurrences(schedule, tz, now, now + 8 * 86400)
    return runs[0] if runs else None


# ---- controller ------------------------------------------------------------------------------------------------
class Preconditioning:
    def __init__(self, runtime, *, clock=time.time, sleep=asyncio.sleep, call=None, notifier=None):
        self.runtime, self.hass = runtime, runtime.hass
        self.clock, self.sleep = clock, sleep
        self.call = call or (lambda d, s, data: self.hass.services.async_call(d, s, data, blocking=True))
        self.notifier = notifier
        self.config = deepcopy(DEFAULT)
        self.state = self.blank_state()
        self.history = []
        self.lock = asyncio.Lock()       # serialises every command
        self.gen = 0                     # bumped by every new operation; stale workers stop applying results
        self.task = None
        self.unsubs = []
        self.stopped = False
        self._activity = []  # waiting to be written to Recent activity at the next persist
        self._last_logged = None  # the activity entry the next notify() belongs to
        self._manual_refresh_at = -1e9
        self._background = set()  # recover and refresh tasks, cancelled by stop()

    @staticmethod
    def blank_state():
        return {"status": "IDLE", "requested": None, "confirmed": None, "op_id": None, "op_kind": None, "session_id": None,
                "attempts": 0, "last_command": None, "last_verify": None, "session_start": None, "deadline": None,
                "stop_at": None, "schedule_id": None, "run_key": None, "owner": None, "temperature": None, "last_error": None,
                "recheck_at": None, "fired": {}, "missed_stop": False, "battery_block": None,
                "last_start_ok": None, "last_stop_ok": None, "last_failure": None, "last_report": None, "last_retries": 0}

    # -- persistence
    async def db(self, *args):
        return await self.runtime.hub.db(*args)

    async def start(self):
        from homeassistant.helpers.event import async_track_time_interval
        self.config = validate(await self.db("get", self.runtime.vehicle, "precondition_config", DEFAULT))
        self.state = {**self.blank_state(), **await self.db("get", self.runtime.vehicle, "precondition_state", {})}
        self.history = await self.db("get", self.runtime.vehicle, "precondition_history", [])
        self.prune_history()
        self.unsubs.append(async_track_time_interval(self.hass, self._tick_cb, timedelta(seconds=15)))
        self.unsubs.append(self.hass.bus.async_listen("mobile_app_notification_action", self._action_event))
        self._spawn(self.recover())

    def _spawn(self, coro):
        """Run a background coroutine that stop() can cancel, so nothing outlives an unload."""
        task = self.hass.async_create_task(coro)
        if task is not None and hasattr(task, "add_done_callback"):
            self._background.add(task)
            task.add_done_callback(self._background.discard)
        return task

    async def stop(self):
        self.stopped = True
        for task in list(self._background):
            task.cancel()
        self._background.clear()
        for unsub in self.unsubs:
            unsub()
        self.unsubs.clear()
        if self.task and not self.task.done():
            self.task.cancel()
        await self.persist()

    async def persist(self):
        await self.flush_activity()
        await self.db("put", self.runtime.vehicle, "precondition_state", self.state)
        self.prune_history()
        await self.db("put", self.runtime.vehicle, "precondition_history", self.history[:HISTORY_LIMIT])
        # No general "vehicle changed" broadcast here: it made open dashboards and cards reload (and jump to the top).
        # The preconditioning views poll their own state.

    async def save(self, value):
        if isinstance(value, dict) and isinstance(value.get("notify"), dict) and "devices" in value["notify"]:
            value = {**value, "notify": {k: v for k, v in value["notify"].items() if k != "devices"}}
        if isinstance(value, dict) and "notify_devices" in value:
            await self.set_devices(value["notify_devices"])
            value = {k: v for k, v in value.items() if k != "notify_devices"}
        old = {s["id"]: s for s in self.config["schedules"]}
        for item in value.get("schedules", []) if isinstance(value, dict) else []:
            if isinstance(item, dict) and item.get("id") in old:
                item.setdefault("created", old[item["id"]]["created"])
                if {k: v for k, v in item.items() if k != "updated"} != {k: v for k, v in old[item["id"]].items() if k != "updated"}:
                    item["updated"] = self.clock()  # edited: runs before this moment are never reported missed
        merged = validate({**self.config, **value})
        await self.db("put", self.runtime.vehicle, "precondition_config", merged)
        self.config = merged
        await self.persist()
        return self.snapshot()

    def prune_history(self):
        """Rotation: entries older than HISTORY_DAYS are removed, and the list is capped."""
        cutoff = self.clock() - HISTORY_DAYS * 86400
        self.history = [h for h in self.history if isinstance(h, dict) and isinstance(h.get("time"), (int, float)) and h["time"] >= cutoff][:HISTORY_LIMIT]

    async def clear_history(self):
        self.history = []
        await self.persist()
        return self.snapshot()

    def log(self, kind, **details):
        entry = {"id": uuid.uuid4().hex, "time": self.clock(), "kind": kind, **details}
        self.history.insert(0, entry)
        del self.history[HISTORY_LIMIT:]
        _LOGGER.info("Preconditioning %s: %s", kind, {k: v for k, v in details.items() if k in ("source", "reason", "error", "attempts", "schedule_id", "temperature", "duration", "soc")})
        if kind in ACTIVITY:
            title, severity, icon = ACTIVITY[kind]
            title = self.tx(title)
            message = details.get("error") or (self.reason_text(details["reason"]) if details.get("reason") else "")
            if kind == "start_requested":
                message = f"{details.get('temperature', '')} °C · {details.get('duration', '')} min · {details.get('source', '')}"
            entry = {"kind": kind, "title": title, "severity": severity, "icon": icon, "message": message, "deliveries": []}
            self._activity.append(entry)
            self._last_logged = entry

    async def flush_activity(self):
        """Write queued events to the shared notification activity list (bell and Notifications page)."""
        engine = getattr(self.runtime, "notifications", None)
        if not self._activity or engine is None or not hasattr(engine, "record"):
            self._activity.clear()
            return
        queued, self._activity = self._activity, []
        for item in queued:
            rule = {"id": "preconditioning", "name": "Preconditioning", "severity": item["severity"], "data": {"notification_icon": item["icon"]}}
            status = "error" if item["severity"] == "critical" else ("sent" if any(d.get("status") == "accepted" for d in item["deliveries"]) else "preconditioning")
            details = {"title": item["title"], "message": item["message"]}
            if item["deliveries"]:
                details["deliveries"] = item["deliveries"]
            try:
                await engine.record(rule, status, **details)
            except Exception:  # noqa: BLE001 - activity is informative only
                _LOGGER.exception("Preconditioning activity could not be recorded")
        try:
            await engine.persist()
        except Exception:  # noqa: BLE001
            _LOGGER.exception("Notification activity could not be saved")

    # -- phones: shared with the Live climate notification, so both places always use the same phones
    def devices(self):
        engine = getattr(self.runtime, "notifications", None)
        if engine is None:
            return list(self.config["notify"].get("devices", []))
        return list(engine.config.get("live_climate", {}).get("devices", []))

    async def set_devices(self, devices):
        engine = getattr(self.runtime, "notifications", None)
        if not isinstance(devices, list) or any(not isinstance(d, str) or not DEVICE.fullmatch(d) for d in devices):
            raise ValueError("Choose Mobile App devices")
        if engine is None:
            raise ValueError(self.tx("Notifications are still starting. Try again in a moment."))
        live = {**engine.config.get("live_climate", {}), "devices": list(dict.fromkeys(devices))}
        if live.get("enabled") and not live["devices"]:
            live["enabled"] = False  # Live climate cannot run without a phone
        await engine.save({**engine.config, "live_climate": live}, engine.config)

    # -- vehicle readings
    def entity(self, logical):
        mapped = self.runtime.config.get("entities", {}).get(logical)
        return mapped or logical.replace(".", "." + self.runtime.config.get("prefix", "s05") + "_", 1)

    def get(self, logical):
        return self.hass.states.get(self.entity(logical))

    def report_time(self):
        """Time of the latest vehicle report (sensor.last_updated), not when HA last wrote an entity."""
        state = self.get("sensor.last_updated")
        if state is not None and str(state.state).lower() not in UNKNOWN_STATES:
            try:
                return datetime.fromisoformat(str(state.state)).timestamp()
            except ValueError:
                pass
        flag = self.get("binary_sensor.climate_on") or self.get("climate.cabin_climate")
        value = getattr(flag, "last_reported", None) or getattr(flag, "last_updated", None)
        return value.timestamp() if isinstance(value, datetime) else None

    def climate(self):
        """{'on': True/False/None, 'report': ts, 'current', 'target', 'available'}"""
        flag, main = self.get("binary_sensor.climate_on"), self.get("climate.cabin_climate")
        on = None
        if flag is not None and str(flag.state).lower() in ("on", "off"):
            on = flag.state == "on"
        elif main is not None and str(main.state).lower() not in UNKNOWN_STATES:
            on = main.state != "off"
        cloud = self.get("binary_sensor.cloud_connection")
        available = main is not None and str(main.state).lower() != "unavailable" and not (cloud is not None and cloud.state == "off")

        def num(state):
            try:
                return float(state.state)
            except (AttributeError, TypeError, ValueError):
                return None
        current = num(self.get("sensor.inside_temperature"))
        target = (main.attributes or {}).get("temperature") if main is not None else None
        return {"on": on, "report": self.report_time(), "current": current, "target": target, "available": available}

    def battery(self):
        """Traction battery SOC (sensor.battery_level; not fuel, not 12 V). Fresh only if the vehicle reported
        recently: the SOC entity is not rewritten when its value is unchanged, so the report time is used."""
        opts = self.config["battery"]
        soc_state, report = self.get("sensor.battery_level"), self.report_time()
        try:
            soc = float(soc_state.state)
        except (AttributeError, TypeError, ValueError):
            soc = None
        charging = self.get("binary_sensor.charging")
        is_charging = charging is not None and charging.state == "on"
        fresh = soc is not None and report is not None and 0 <= self.clock() - report <= opts["max_age"]
        return {"soc": soc, "report": report, "fresh": fresh, "charging": is_charging, "threshold": opts["min_soc"]}

    def battery_blocks(self, reading=None):
        """None if START may proceed, else a reason. Unknown or stale SOC blocks (conservative)."""
        opts = self.config["battery"]
        if not opts["enabled"] or not opts["block_start"]:
            return None
        b = reading or self.battery()
        if b["charging"] and not opts["while_charging"] and b["fresh"]:
            return None
        if b["soc"] is None:
            return "battery_unavailable"
        if not b["fresh"]:
            return "battery_stale"
        if b["soc"] <= opts["min_soc"]:
            return "battery_low"
        return None

    # -- public commands (UI, schedules, notification actions all land here)
    async def request_start(self, temperature=None, duration=None, *, source="manual", schedule_id=None, run_key=None):
        temperature = _temp(self.config["default_temperature"] if temperature is None else temperature)
        duration = self.config["default_duration"] if duration is None else duration
        if type(duration) is not int or not 1 <= duration <= MAX_SESSION_MIN:
            raise ValueError("Duration must be 1–15 minutes")
        if self.state["status"] in START_PHASES:
            return {"accepted": False, "reason": "start_in_progress", **self.snapshot()}  # duplicate request
        if self.state["status"] in STOP_PHASES:
            return {"accepted": False, "reason": "stop_in_progress", **self.snapshot()}
        if self.state["status"] == "ACTIVE" and self.state.get("owner") == "companion":
            # Our own session is running: a second start never reaches the car, whatever the car reports right now
            # (an unreadable state must not look like "off"). The session, deadline and status stay as they are.
            return {"accepted": False, "reason": "already_active", **self.snapshot()}
        now_reading = self.climate()
        if now_reading["on"] is True:  # already on (Deepal app, in the car, or earlier): nothing is changed
            self.log("already_on", source=source, owner=self.state.get("owner") or "external")
            await self.persist()
            return {"accepted": False, "reason": "already_on", **self.snapshot()}
        blocked = self.battery_blocks()
        if blocked in ("battery_stale", "battery_unavailable"):
            blocked = None  # an old reading is not a verdict: the refresh before START gets a new one, then the full check runs
        if blocked:
            self.state["battery_block"] = {"reason": blocked, "time": self.clock(), "source": source}
            self.log("start_blocked", reason=blocked, source=source, schedule_id=schedule_id, battery=self.battery())
            await self.notify("battery", "Preconditioning not started", self.reason_text(blocked), key="battery_block")
            await self.persist()
            return {"accepted": False, "reason": blocked, **self.snapshot()}
        self.gen += 1
        op = uuid.uuid4().hex[:12]
        self.state.update(status="START_REQUESTED", requested="on", op_id=op, op_kind="start", attempts=0, last_error=None,
                          schedule_id=schedule_id, run_key=run_key, temperature=temperature, battery_block=None,
                          pending_duration=duration, source=source)
        self.log("start_requested", op_id=op, source=source, temperature=temperature, duration=duration, schedule_id=schedule_id)
        await self.notify("start_requested", "Starting preconditioning", "Target {0} °C", f"{temperature:g}", ongoing=True)
        await self.persist()
        self.task = self.hass.async_create_task(self._run_start(self.gen, op, temperature, duration))
        return {"accepted": True, **self.snapshot()}

    async def request_stop(self, *, source="manual", reason=None):
        """STOP always wins: it supersedes a pending START and cancels its retries."""
        if self.state["status"] in STOP_PHASES:
            return {"accepted": False, "reason": "stop_in_progress", **self.snapshot()}
        superseded = self.state["status"] in START_PHASES
        self.gen += 1
        op = uuid.uuid4().hex[:12]
        if superseded:
            self.log("superseded", op_id=self.state["op_id"])
        self.state.update(status="STOP_REQUESTED", requested="off", op_id=op, op_kind="stop", attempts=0, last_error=None,
                          stop_reason=reason or source)
        self.log("stop_requested", op_id=op, source=source, reason=reason)
        await self.notify("stop_requested", "Stopping preconditioning", "", ongoing=True)
        await self.persist()
        self.task = self.hass.async_create_task(self._run_stop(self.gen, op))
        return {"accepted": True, "superseded_start": superseded, **self.snapshot()}

    # -- workers
    def current(self, gen):
        return gen == self.gen and not self.stopped

    async def _send(self, service, data):
        try:
            await asyncio.wait_for(self.call("climate", service, {"entity_id": self.entity("climate.cabin_climate"), **data}), 75)
        except asyncio.TimeoutError:
            raise CommandError("Command timed out") from None
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - HomeAssistantError and friends
            text = str(error)[:300] or type(error).__name__
            message, retry, in_use = explain(text)
            if message != text:
                message = f"{self.tx(message)} (Deepal: {text[:160]})"
            raise CommandError(message, retry=retry, in_use=in_use) from error

    async def _refresh(self, gen):
        """Press "Refresh vehicle data" and wait briefly for a newer report, so START decisions use fresh data.
        A refresh that fails or times out never blocks the START: the usual checks still run on what is known."""
        button = self.entity("button.refresh_vehicle_data")
        if self.hass.states.get(button) is None:
            return False
        before = self.report_time() or 0
        try:
            await asyncio.wait_for(self.call("button", "press", {"entity_id": button}), 30)
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001
            self.log("refresh_error", error=str(error)[:200])
            return False
        deadline = self.clock() + REFRESH_WAIT
        while self.current(gen) and self.clock() < deadline:
            if (self.report_time() or 0) > before:
                return True
            await self.sleep(POLL)
        return False

    async def refresh_now(self):
        """The card's refresh button: ask the car for fresh data and wait for the new report. Never changes the climate."""
        fresh, throttled = False, False
        if self.stopped or self.state.get("status") in (*START_PHASES, *STOP_PHASES):
            throttled = True
        elif self.clock() - self._manual_refresh_at < MANUAL_REFRESH_GAP:
            throttled = True
        else:
            self._manual_refresh_at = self.clock()
            fresh = await self._refresh(self.gen)
        return {**self.snapshot(), "fresh": fresh, "throttled": throttled}

    def _refresh_later(self):
        """After an action: ask for one more refresh so every screen shows the result. Does not wait."""
        button = self.entity("button.refresh_vehicle_data")
        if self.stopped or self.hass.states.get(button) is None:
            return
        async def run():
            try:
                await asyncio.wait_for(self.call("button", "press", {"entity_id": button}), 30)
            except Exception:  # noqa: BLE001
                pass
        try:
            self._spawn(run())
        except Exception:  # noqa: BLE001
            pass

    async def _poke_refresh(self):
        """Ask the vehicle for a new report without waiting for it (the verify loop picks it up)."""
        button = self.entity("button.refresh_vehicle_data")
        if self.hass.states.get(button) is None:
            return
        try:
            await asyncio.wait_for(self.call("button", "press", {"entity_id": button}), 30)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - verification continues on the normal vehicle updates
            pass

    async def _verify(self, gen, want_on, since):
        """Wait for a vehicle report newer than the command that shows the wanted state.
        The vehicle is asked for a fresh report shortly after the command and again while waiting, because
        the normal update interval can be longer than the verification time."""
        start = self.clock()
        deadline = start + self.config["verify_timeout"]
        next_poke = start + VERIFY_POKE_FIRST
        while self.current(gen):
            reading = self.climate()
            self.state["last_verify"] = self.clock()
            self.state["last_report"] = reading["report"]
            if reading["report"] is not None and reading["report"] >= since - REPORT_TOLERANCE and reading["on"] is want_on:
                return True
            if self.clock() >= deadline:
                return None if reading["on"] is None or reading["report"] is None or reading["report"] < since - REPORT_TOLERANCE else False
            if self.clock() >= next_poke:
                next_poke = self.clock() + VERIFY_POKE_EVERY
                await self._poke_refresh()
            await self.sleep(POLL)
        return None

    async def _run_start(self, gen, op, temperature, duration):
        async with self.lock:
            if not self.current(gen):
                return
            self.state["status"] = "STARTING"
            await self.persist()
            fresh = await self._refresh(gen)
            self.log("refreshed" if fresh else "refresh_no_new_report", op_id=op)
            if not self.current(gen):
                return
            blocked = self.battery_blocks()
            if blocked:  # the refreshed reading passes the same battery gate
                self.state["battery_block"] = {"reason": blocked, "time": self.clock(), "source": "refresh"}
                self.log("start_blocked", reason=blocked, source="refresh", op_id=op)
                await self.notify("battery", "Preconditioning not started", self.reason_text(blocked), key="battery_block")
                return await self._fail(gen, self.reason_text(blocked), "start")
            reading = self.climate()
            if not reading["available"]:
                return await self._fail(gen, "Vehicle unavailable", "start")
            if reading["on"] is True and reading["report"] is not None and self.clock() - reading["report"] < 600:
                # Already on (Deepal app, in the car, or an earlier command): do not send, do not claim ownership.
                self.state.update(status="ACTIVE" if self.state.get("owner") == "companion" else "INACTIVE", confirmed="on")
                self.log("already_on", op_id=op, owner=self.state.get("owner") or "external")
                if self.state.get("owner") != "companion":
                    self.state.update(requested=None, op_kind=None)
                await self.persist()
                return
            max_attempts = self.config["max_attempts"]
            for attempt in range(1, max_attempts + 1):
                if not self.current(gen):
                    return
                if attempt > 1:
                    blocked = self.battery_blocks()
                    if blocked:  # retries pass the same battery gate as the first attempt
                        self.state["battery_block"] = {"reason": blocked, "time": self.clock(), "source": "retry"}
                        self.log("start_blocked", reason=blocked, source="retry", op_id=op)
                        await self.notify("battery", "Preconditioning retry stopped", self.reason_text(blocked), key="battery_block")
                        return await self._fail(gen, self.reason_text(blocked), "start")
                    await self._refresh(gen)
                    if not self.current(gen):
                        return
                    fresh = self.climate()  # fresh state before every retry: never send a second ON blindly
                    if fresh["on"] is True and fresh["report"] and fresh["report"] >= self.state["last_command"] - REPORT_TOLERANCE:
                        return await self._confirmed_start(gen, op, temperature, duration, attempt)
                    if fresh["on"] is None:
                        return await self._unknown(gen, "Climate state cannot be read; not retrying", "start")
                    self.state.update(status="RETRYING_START")
                    await self.notify("retry", "Retrying preconditioning", "Attempt {0} of {1}", attempt, max_attempts, ongoing=True)
                    await self.persist()
                self.state.update(status="STARTING", attempts=attempt, last_command=self.clock())
                await self.persist()
                sent = self.state["last_command"]
                try:
                    await self._send("set_temperature", {"temperature": temperature})  # Deepal: sets target AND turns on
                except CommandError as error:
                    if not self.current(gen):
                        return
                    self.state["last_error"] = str(error)
                    self.log("start_error", op_id=op, attempt=attempt, error=str(error))
                    if not error.retry:
                        return await self._fail(gen, str(error), "start")
                    if attempt < max_attempts:
                        await self.sleep(self.config["retry_delay"])
                        continue
                    return await self._fail(gen, str(error), "start")
                if not self.current(gen):
                    return
                self.state["status"] = "VERIFYING_START"
                await self.persist()
                result = await self._verify(gen, True, sent)
                if not self.current(gen):
                    return
                if result:
                    return await self._confirmed_start(gen, op, temperature, duration, attempt)
                if attempt < max_attempts:
                    await self.sleep(self.config["retry_delay"])
            if self.current(gen):
                await self._unknown(gen, "Climate ON could not be confirmed by the vehicle", "start")

    async def _confirmed_start(self, gen, op, temperature, duration, attempt):
        now = self.clock()
        # The real activation moment is between the command and this report; the command time is the safe
        # (earliest) estimate, so the 15-minute window is never estimated longer than the vehicle's.
        begin = self.state.get("last_command") or now
        deadline = begin + MAX_SESSION_MIN * 60
        stop_at = begin + duration * 60 if duration < MAX_SESSION_MIN else None
        self.state.update(status="ACTIVE", confirmed="on", session_id=uuid.uuid4().hex[:12], session_start=begin, deadline=deadline,
                          stop_at=stop_at, owner="companion", last_start_ok=now, last_retries=attempt - 1, recheck_at=now + HOLD_SECONDS,
                          duration=duration)
        self.log("start_confirmed", op_id=op, session_id=self.state["session_id"], attempts=attempt, deadline=deadline, stop_at=stop_at,
                 schedule_id=self.state.get("schedule_id"))
        self._refresh_later()
        await self.notify("start_confirmed", "Preconditioning on", "Target {0} °C · auto-off by about {1} (estimated)", f"{temperature:g}", self.hm(min(x for x in (deadline, stop_at) if x)), ongoing=True)
        if self.state.get("schedule_id"):
            await self.notify("schedule_result", "Scheduled preconditioning started", "", key="schedule")
        await self.persist()

    async def _run_stop(self, gen, op):
        async with self.lock:
            if not self.current(gen):
                return
            self.state["status"] = "STOPPING"
            await self.persist()
            await self._refresh(gen)  # fresh data before deciding whether a STOP is needed at all
            if not self.current(gen):
                return
            max_attempts = self.config["max_attempts"]
            for attempt in range(1, max_attempts + 1):
                if not self.current(gen):
                    return
                reading = self.climate()  # recheck before each attempt; no STOP if the car is already off
                if reading["on"] is False and reading["report"] and reading["report"] >= (self.state.get("last_command") or 0):
                    return await self._confirmed_stop(gen, op, attempt, sent=False)
                if attempt > 1:
                    await self._refresh(gen)  # fresh data first: the car may already be off
                    if not self.current(gen):
                        return
                    reading = self.climate()
                    if reading["on"] is False and reading["report"] and reading["report"] >= (self.state.get("last_command") or 0) - REPORT_TOLERANCE:
                        return await self._confirmed_stop(gen, op, attempt, sent=True)
                    self.state["status"] = "RETRYING_STOP"
                    await self.notify("retry", "Retrying stop", "Attempt {0} of {1}", attempt, max_attempts, ongoing=True)
                self.state.update(status="STOPPING", attempts=attempt, last_command=self.clock())
                await self.persist()
                sent = self.state["last_command"]
                try:
                    # Deepal Alternative does not advertise TURN_OFF (supported_features=1), so HA rejects climate.turn_off.
                    await self._send("set_hvac_mode", {"hvac_mode": "off"})
                except CommandError as error:
                    if not self.current(gen):
                        return
                    self.state["last_error"] = str(error)
                    self.log("stop_error", op_id=op, attempt=attempt, error=str(error))
                    if error.in_use:  # someone is driving: the climate now belongs to the driver
                        return await self._handed_over(gen, op)
                    if not error.retry or attempt == max_attempts:
                        return await self._fail(gen, str(error), "stop")
                    await self.sleep(self.config["retry_delay"])
                    continue
                self.state["status"] = "VERIFYING_STOP"
                await self.persist()
                result = await self._verify(gen, False, sent)
                if not self.current(gen):
                    return
                if result:
                    return await self._confirmed_stop(gen, op, attempt, sent=True)
                if attempt < max_attempts:
                    await self.sleep(self.config["retry_delay"])
            if self.current(gen):
                await self._unknown(gen, "Climate OFF could not be confirmed by the vehicle", "stop")

    async def _confirmed_stop(self, gen, op, attempt, sent):
        now = self.clock()
        reason = self.state.get("stop_reason")
        self.log("stop_confirmed", op_id=op, session_id=self.state.get("session_id"), attempts=attempt, command_sent=sent, reason=reason)
        self.end_session("INACTIVE", now)
        self.state.update(last_stop_ok=now, last_retries=attempt - 1)
        self._refresh_later()
        title = "Climate stopped by battery protection" if reason == "battery" else "Preconditioning stopped"
        await self.notify("battery" if reason == "battery" else "stop_confirmed", title, "", end=True)
        await self.persist()

    async def _handed_over(self, gen, op, reason="The car is being driven"):
        if not self.current(gen):
            return
        self.log("handed_over", op_id=op, reason=reason, session_id=self.state.get("session_id"))
        await self.notify("session_ended", "Preconditioning handed over to the driver",
                          "{0}, so Companion stopped managing the climate and sent no further commands.", self.tx(reason), end=True)
        self.end_session("INACTIVE", self.clock())
        await self.persist()

    def end_session(self, status, now):
        self.state.pop("session_odometer", None)
        self.state.update(status=status, confirmed="off", requested=None, op_kind=None, session_start=None, deadline=None, stop_at=None,
                          owner=None, recheck_at=None, session_id=None, schedule_id=None, missed_stop=False, stop_reason=None)

    async def _fail(self, gen, error, kind):
        if not self.current(gen):
            return
        error = self.tx(error)
        self.state.update(status="FAILED", last_error=error, last_failure={"time": self.clock(), "kind": kind, "error": error})
        self.log(kind + "_failed", op_id=self.state["op_id"], error=error)
        await self.notify("failure", "Preconditioning start failed" if kind == "start" else "Preconditioning stop failed", error, end=True)
        if self.state.get("schedule_id"):
            await self.notify("schedule_result", "Scheduled preconditioning failed", error, key="schedule")
        if kind == "start" and self.state.get("owner") != "companion":
            self.state.update(requested=None, op_kind=None)
        await self.persist()

    async def _unknown(self, gen, error, kind):
        if not self.current(gen):
            return
        error = self.tx(error)
        self.state.update(status="UNKNOWN", last_error=error, last_failure={"time": self.clock(), "kind": kind, "error": error})
        if kind == "start":
            # A START that may have worked owns a provisional session so its STOP obligation is still kept.
            begin = self.state.get("last_command") or self.clock()
            dur = self.state.get("pending_duration") or MAX_SESSION_MIN
            self.state.update(owner="companion", session_start=begin, deadline=begin + MAX_SESSION_MIN * 60,
                              stop_at=begin + dur * 60 if dur < MAX_SESSION_MIN else None, duration=dur)
        self.log(kind + "_unknown", op_id=self.state["op_id"], error=error)
        await self.notify("unknown", "Climate state unknown", error, end=True)
        await self.persist()

    # -- monitoring and schedules (every 15 s)
    async def _tick_cb(self, _now=None):
        if not self.stopped:
            try:
                await self.tick()
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Preconditioning tick failed")

    async def tick(self):
        if self.lock.locked() or self.state["status"] in START_PHASES | STOP_PHASES:
            return
        now, changed = self.clock(), False
        reading = self.climate()
        owned = self.state.get("owner") == "companion" and self.state.get("session_start")
        if owned:
            fresh_off = reading["on"] is False and reading["report"] and reading["report"] > (self.state.get("last_command") or 0) and \
                (not self.state.get("recheck_at") or now >= self.state["recheck_at"])
            if fresh_off:  # vehicle switched off on its own (15-minute limit or earlier)
                self.log("auto_shutdown", session_id=self.state.get("session_id"), observed=reading["report"], before_deadline=reading["report"] < self.state["deadline"])
                await self.notify("session_ended", "Preconditioning ended", "The vehicle turned the climate off.", end=True)
                self.end_session("INACTIVE", now)
                await self.persist()
                return
            if self.state["status"] == "UNKNOWN" and reading["on"] is True and reading["report"] and reading["report"] > (self.state.get("last_command") or 0):
                self.state.update(status="ACTIVE", confirmed="on")
                changed = True
            odo = self.get("sensor.total_odometer")
            try:
                odo_value = float(odo.state)
            except (AttributeError, TypeError, ValueError):
                odo_value = None
            if odo_value is not None:
                start_odo = self.state.setdefault("session_odometer", odo_value)
                if odo_value - start_odo >= 0.5:  # the car moved during the session: the driver is in charge now
                    self.state.pop("session_odometer", None)
                    return await self._handed_over(self.gen, self.state.get("op_id"), "The car started moving")
            if self.config["battery"]["enabled"] and self.config["battery"]["auto_stop"] and reading["on"] is not False:
                b = self.battery()
                skip = b["charging"] and not self.config["battery"]["while_charging"]
                if b["fresh"] and b["soc"] <= b["threshold"] and not skip:
                    self.log("battery_stop", soc=b["soc"], threshold=b["threshold"], session_id=self.state.get("session_id"))
                    await self.notify("battery", "Battery protection", "Battery at {0} % — stopping climate", f"{b['soc']:g}", key="battery_stop")
                    await self.request_stop(source="battery", reason="battery")
                    return
            due = self.state.get("stop_at") and now >= self.state["stop_at"]
            limit = now >= self.state["deadline"]
            failed_at = (self.state.get("last_failure") or {}).get("time", 0) if self.state["status"] == "FAILED" else 0
            if (due or limit) and now - failed_at < 300:
                pass  # an automatic stop just failed: wait 5 minutes before asking again (no retry storm)
            elif due or limit:
                if reading["on"] is True or (reading["on"] is not False and due):
                    await self.request_stop(source="duration" if due else "limit", reason="duration" if due else "limit")
                    return
                if reading["on"] is None and limit and self.state["status"] != "UNKNOWN":
                    self.state.update(status="UNKNOWN", last_error=self.tx("Climate state cannot be confirmed after the 15-minute limit"))
                    await self.notify("unknown", "Climate state unknown", self.state["last_error"], end=True)
                    changed = True
                if limit and now - self.state["deadline"] > 3600:  # give up holding a session nobody can verify
                    self.log("session_abandoned", session_id=self.state.get("session_id"))
                    self.end_session("UNKNOWN", now)
                    changed = True
        else:
            if reading["on"] is not None and self.state.get("confirmed") != ("on" if reading["on"] else "off"):
                if reading["on"] and self.state.get("confirmed") is not None:
                    self.log("external_on")  # Deepal app or in-car: never stopped automatically here
                self.state["confirmed"] = "on" if reading["on"] else "off"
                changed = True
        changed = await self.run_schedules(now) or changed
        if changed:
            await self.persist()

    async def run_schedules(self, now):
        if not self.config["scheduling_enabled"]:
            return False
        tz = self.tz()
        changed = False
        fired = self.state.setdefault("fired", {})
        for schedule in self.config["schedules"]:
            if not schedule["enabled"]:
                continue
            for begin, _end, key in occurrences(schedule, tz, now - 2 * 86400, now + 1):
                if key in fired or begin < schedule["updated"]:
                    continue
                fired[key] = now  # recorded before acting: a restart can never run it twice
                changed = True
                if now - begin > START_GRACE:
                    self.log("schedule_missed", schedule_id=schedule["id"], run_key=key, due=begin)
                    await self.notify("schedule_result", "Scheduled preconditioning missed", "Home Assistant was not running at the start time.", key="schedule")
                    continue
                busy = self.state["status"] in START_PHASES | STOP_PHASES or (self.state.get("owner") and self.state.get("session_start"))
                if busy:
                    self.log("schedule_skipped", schedule_id=schedule["id"], run_key=key, reason="busy")
                    continue
                if self.climate()["on"] is True:
                    self.log("schedule_skipped", schedule_id=schedule["id"], run_key=key, reason="already_on")
                    continue
                blocked = self.battery_blocks()
                if blocked in ("battery_stale", "battery_unavailable"):
                    blocked = None  # decided after the refresh that runs before every START
                if blocked:
                    self.log("schedule_skipped", schedule_id=schedule["id"], run_key=key, reason=blocked)
                    await self.notify("battery", "Scheduled preconditioning skipped", self.reason_text(blocked), key="battery_block")
                    continue
                remaining = max(1, min(schedule["duration"], int((begin + schedule["duration"] * 60 - now) // 60) or 1))
                await self.request_start(schedule["temperature"], remaining, source="schedule", schedule_id=schedule["id"], run_key=key)
            if schedule["repeat"] == "once" and any(k.startswith(schedule["id"] + "@") for k in fired):
                schedule["enabled"] = False
                await self.db("put", self.runtime.vehicle, "precondition_config", self.config)
                changed = True
        cutoff = now - 3 * 86400
        for key in [k for k, v in fired.items() if v < cutoff]:
            del fired[key]
        return changed

    async def recover(self):
        """After a restart: never replay START; keep STOP obligations; resolve unfinished operations."""
        async with self.lock:
            status = self.state["status"]
            if status in START_PHASES:
                self.log("recovered", previous=status, action="start not replayed")
                begin = self.state.get("last_command")
                if begin:
                    dur = self.state.get("pending_duration") or MAX_SESSION_MIN
                    self.state.update(owner="companion", session_start=begin, deadline=begin + MAX_SESSION_MIN * 60,
                                      stop_at=begin + dur * 60 if dur < MAX_SESSION_MIN else None)
                self.state.update(status="UNKNOWN", last_error=self.tx("Interrupted by a restart; checking the vehicle"))
            elif status in STOP_PHASES:
                self.log("recovered", previous=status, action="stop resumed")
                self.state["status"] = "UNKNOWN"
                self.state["missed_stop"] = True
            await self.persist()
        if self.state.get("missed_stop") and self.climate()["on"] is not False:
            await self.request_stop(source="recovery", reason=self.state.get("stop_reason") or "recovery")
        await self.tick()

    # -- notifications (existing Companion notification engine and its Mobile App transport)
    async def notify(self, event, title, message, *args, ongoing=False, end=False, key="status"):
        entry, self._last_logged = self._last_logged, None  # the activity entry written for this very event
        title, message = self.tx(title, *args), self.tx(message, *args)
        opts = self.config["notify"]
        engine = getattr(self.runtime, "notifications", None)
        devices = self.devices()
        if not opts["enabled"] or not devices or not opts["events"].get(event):
            return
        if engine is not None and not engine.config.get("enabled", True):
            return  # global notification switch off
        send = self.notifier or (engine.send_to_recipient if engine else None)
        if send is None:
            return
        # stable (updates replace, no duplicates) and within the 64-byte APNs collapse-id limit: a longer tag is rejected by Apple
        from .notifications import notification_tag
        tag = notification_tag(self.runtime.vehicle, "precondition_" + key)
        data = {"tag": tag, "group": "deepal_companion_precondition", "notification_icon": "mdi:fan"}
        if ongoing and key == "status" and self.state.get("owner") == "companion":
            data["actions"] = [{"action": ACTION_STOP, "title": self.tx("Stop")}]  # the ongoing view itself is Live climate
        payload = {"title": title, "message": message or title, "data": data}
        deliveries = []
        for device in devices:
            try:
                await send(device, payload)
                deliveries.append({"device": device, "status": "accepted"})
            except Exception as error:  # noqa: BLE001 - delivery failure never affects the command
                deliveries.append({"device": device, "status": "error", "error": str(error)[:200]})
                self.log("notify_error", device=device, error=str(error)[:200])
        # the entry of this very event: same kind first, otherwise the entry logged just before this message
        target = next((item for item in reversed(self._activity) if item["kind"] == event and not item["deliveries"]), None)
        if target is None and entry is not None and not entry["deliveries"] and any(item is entry for item in self._activity):
            target = entry
        if target is None:  # a message without a matching event (for example a retry warning)
            target = {"kind": event, "title": title, "severity": "info", "icon": "mdi:fan-clock", "message": message, "deliveries": []}
            self._activity.append(target)
        target["deliveries"] = deliveries

    async def test_notification(self):
        """Send one example message to the chosen phones, like the other Companion notification tests."""
        from .notifications import notification_tag
        devices = self.devices()
        if not devices:
            raise ValueError(self.tx("Choose a phone first"))
        engine = getattr(self.runtime, "notifications", None)
        send = self.notifier or (engine.send_to_recipient if engine else None)
        if send is None:
            raise ValueError(self.tx("Notifications are still starting. Try again in a moment."))
        payload = {"title": self.tx("Preconditioning on"), "message": self.tx("Test · target {0} °C · auto-off within 15 min", f"{self.config['default_temperature']:g}"),
                   "data": {"tag": notification_tag(self.runtime.vehicle, "precondition_test", test=True), "group": "deepal_companion_precondition",
                            "notification_icon": "mdi:fan"}}
        deliveries = []
        for device in devices:
            try:
                await send(device, payload)
                deliveries.append({"device": device, "status": "accepted"})
            except Exception as error:  # noqa: BLE001
                deliveries.append({"device": device, "status": "error", "error": str(error)[:200]})
        self._activity.append({"kind": "test", "title": self.tx("Preconditioning test notification"), "severity": "info", "icon": "mdi:fan",
                               "message": payload["message"], "deliveries": deliveries})
        await self.persist()
        return {"deliveries": deliveries}

    async def _action_event(self, event):
        if event.data.get("action") == ACTION_STOP and self.state.get("owner") == "companion":
            await self.request_stop(source="notification")

    # -- helpers
    def tz(self):
        from zoneinfo import ZoneInfo
        try:
            return ZoneInfo(self.hass.config.time_zone)
        except Exception:  # noqa: BLE001
            return ZoneInfo("UTC")

    def hm(self, ts):
        return datetime.fromtimestamp(ts, self.tz()).strftime("%H:%M")

    def tx(self, text, *args):
        """A fixed text in the Home Assistant language (phone_text/<lang>.json); {0}, {1}… are filled from args."""
        out = tr(self.hass, text) if isinstance(text, str) else text
        for index, value in enumerate(args):
            out = str(out).replace("{%d}" % index, str(value))
        return out

    def reason_text(self, reason):
        return self.tx({"battery_low": "Battery is at or below the protection level.",
                        "battery_stale": "Battery level is not current, so protection blocked it.",
                        "battery_unavailable": "Battery level is unavailable, so protection blocked it.",
                        "already_on": "Climate is already on, so nothing was changed.",
                        "already_active": "A preconditioning session is already running.",
                        "duration": "Planned duration reached.", "battery": "Stopped by battery protection.", "manual": "Stopped by you.",
                        "schedule": "Stopped by the schedule.", "recovery": "Recovered after a Home Assistant restart.",
                        "busy": "Another session was running."}.get(reason, reason))

    def snapshot(self):
        now, tz = self.clock(), self.tz()
        upcoming = []
        for schedule in self.config["schedules"]:
            nxt = next_run(schedule, tz, now) if self.config["scheduling_enabled"] else None
            last = next((h for h in self.history if h.get("schedule_id") == schedule["id"] and h["kind"] in
                         ("start_confirmed", "start_failed", "start_unknown", "schedule_missed", "schedule_skipped", "start_blocked")), None)
            upcoming.append({"id": schedule["id"], "next_start": nxt and nxt[0], "next_stop": nxt and nxt[1], "last": last})
        reading = self.climate()
        state = {k: v for k, v in self.state.items() if k != "fired"}
        remaining = None
        if state.get("session_start") and state.get("owner"):
            ends = [x for x in (state.get("deadline"), state.get("stop_at")) if x]
            remaining = max(0, min(ends) - now) if ends else None  # stored state without an end time must not break the status call
        config = deepcopy(self.config)
        config["notify"]["devices"] = self.devices()
        live = getattr(getattr(self.runtime, "notifications", None), "config", {}).get("live_climate", {})
        return {"config": config, "live_climate": bool(live.get("enabled")), "global_notifications": bool(getattr(getattr(self.runtime, "notifications", None), "config", {}).get("enabled", True)), "state": state, "climate": reading, "battery": {**self.battery(), "blocked": self.battery_blocks()},
                "upcoming": upcoming, "history": self.history[:HISTORY_LIMIT], "estimated_remaining": remaining, "max_minutes": MAX_SESSION_MIN, "now": now}
