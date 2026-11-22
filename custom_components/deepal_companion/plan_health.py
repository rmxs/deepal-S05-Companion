"""Charge plan health and diagnostics for one vehicle.

Read-only: nothing here sends a command to the car. The plan list comes from the
Deepal Alternative coordinator (the same data its entities use). The log is built
here, with nothing recorded inside Deepal Alternative: it follows the service calls, the plan
entities and the car's plan list, so a switch that disagrees with the car can be traced.
"""
from __future__ import annotations

import logging
import re
import time
from collections import deque
from datetime import timedelta

from homeassistant.const import EVENT_CALL_SERVICE
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store

from .const import PLAN_SIGNAL
from .health import Msg, item

PLACEHOLDER_ID = "1"   # the id of every plan saved in the Deepal app or on the car (not unique: a new save adds another)
RETENTION = 7 * 86400  # the plan log keeps seven days
MAX_ROWS = 2000        # safety cap on memory, far above a week of normal use
VIEW_LIMIT = 500       # newest entries sent to the page
SAVE_DELAY = 30        # seconds to wait before writing the log, so a burst is saved once
_LOGGER = logging.getLogger(__name__)
SUFFIXES = {"switch": "_charge_schedule", "enabled": "_charge_schedule_enabled",
            "start": "_charge_schedule_start", "end": "_charge_schedule_end"}
WATCHED_SERVICES = {("deepal", "set_charge_schedule"), ("switch", "turn_on"), ("switch", "turn_off"),
                    ("switch", "toggle"), ("time", "set_value")}


def hhmm(value):
    text = str(value or "").strip()
    if text.isdigit() and len(text) == 3:
        text = text.zfill(4)
    return text[:2] + ":" + text[2:4] if len(text) == 4 and text.isdigit() else text


def entity_time(state):
    """HH:MM from a Home Assistant time state such as 01:00:00, or None when it has no usable value."""
    text = getattr(state, "state", None)
    return text[:5] if isinstance(text, str) and len(text) >= 5 and text[2] == ":" else None


def plan_entities(hass, device_id):
    """Map the plan entities of this vehicle's Deepal Alternative device."""
    found = {}
    if not device_id:
        return found
    for entry in er.async_get(hass).entities.values():
        if entry.device_id != device_id or entry.platform != "deepal" or not entry.unique_id:
            continue
        for key, suffix in SUFFIXES.items():
            if entry.unique_id.endswith(suffix) and key not in found:
                found[key] = entry.entity_id
    return found


def find_source(hass, entities):
    """Return (coordinator, car_id) of the Deepal Alternative vehicle behind these entities."""
    switch = entities.get("switch")
    entry = er.async_get(hass).async_get(switch) if switch else None
    unique = getattr(entry, "unique_id", "") or ""
    car_id = unique[len("deepal_"):-len(SUFFIXES["switch"])] if unique.startswith("deepal_") else None
    if not car_id:
        return None, None
    for config in hass.config_entries.async_entries("deepal"):
        coordinator = getattr(getattr(config, "runtime_data", None), "coordinator", None)
        if coordinator is not None and any(v.car_id == car_id for v in getattr(coordinator, "vehicles", [])):
            return coordinator, car_id
    return None, None


def read_plans(coordinator, car_id):
    """Plans the car reports, in the car's own order, or None when the list is not available."""
    condition = (getattr(coordinator, "data", None) or {}).get(car_id)
    raw = (((getattr(condition, "raw_data", None) or {}).get("charge")) or {}).get("chargePlanList")
    if not isinstance(raw, list):
        # A vehicle that reports over MQTT keeps no raw app data; the app's plan list is copied into the battery
        # section instead. The car always lists its default plan, so an empty list means "not loaded yet".
        raw = getattr(getattr(condition, "battery", None), "charge_plans", None)
        if not isinstance(raw, list) or not raw:
            return None
    plans = []
    for plan in raw:
        if not isinstance(plan, dict) or plan.get("planId") is None:
            continue
        plan_id = str(plan["planId"])
        plans.append({"id": plan_id, "active": str(plan.get("isValid")).lower() in ("1", "true"),
                      "start": hhmm(plan.get("startTime")), "end": hhmm(plan.get("endTime")),
                      # Kept for older pages: id 1 is the app/car plan, not a placeholder.
                      "placeholder": plan_id == PLACEHOLDER_ID,
                      "source": "app_or_car" if plan_id == PLACEHOLDER_ID else "home_assistant",
                      "index": len(plans), "followed": not plans})
    return plans


def plan_key(plan):
    """Identity of a plan in the log: id plus times (no end = until full). The state is not part of it.

    The id alone is not unique (every app or car save uses id 1), so the times tell the records apart.
    The cloud only accepts the id in delete and on/off commands, so this key is for display, never a command target.
    """
    return (plan["id"], plan["start"], plan["end"] or "full")


def analyse(plans, switch_state):
    """Facts about the plan list: the plan the car and the app follow, how many are active, and whether HA agrees.

    The car and the app follow only the first entry. Later entries are older records the cloud kept; one that is
    still active is reported, because nothing can switch it off from Home Assistant.
    """
    shown = plans[0] if plans else None
    active = [p for p in plans if p["active"]]
    older_active = [p for p in plans[1:] if p["active"]]
    ha_on = switch_state == "on"
    return {"shown": shown, "active": active, "older_active": older_active, "real": len(plans),
            "mismatch": bool(shown) and switch_state in ("on", "off") and ha_on != bool(shown["active"])}



def plan_checks(info):
    """Health rows for the plan. No row when the vehicle has no charge plan entities."""
    if info is None:
        return []
    if info["plans"] is None:
        # Right after a restart the car's plan list arrives with the first vehicle update. That is not a problem:
        # show what the Home Assistant entities say meanwhile.
        times, switch = info.get("times") or {}, info["switch"]
        if switch in ("on", "off") and times.get("start") and times.get("end"):
            return [item("plan", "ok", "Charge plan", Msg("Plan " + switch + ", {0} to {1}.", times["start"], times["end"]))]
        return [item("plan", "ok", "Charge plan", "The plan list from the car is not available yet.")]
    facts = info["facts"]
    shown = facts["shown"]
    fix = "Open this row to see the plans the car reports and the recent plan commands."
    if facts["older_active"]:
        return [item("plan", "warning", "Charge plan", Msg("{0} older plan record(s) are still active. The car follows only the first plan.", len(facts["older_active"])), fix)]
    if facts["mismatch"]:
        return [item("plan", "warning", "Charge plan", "The switch in Home Assistant and the car's newest plan disagree.", fix)]
    if shown and shown["active"]:
        if not shown["end"]:
            return [item("plan", "ok", "Charge plan", Msg("Plan on, from {0} until full.", shown["start"]))]
        return [item("plan", "ok", "Charge plan", Msg("Plan on, {0} to {1}.", shown["start"], shown["end"]))]
    if shown:
        if not shown["end"]:
            return [item("plan", "ok", "Charge plan", Msg("Plan off, from {0} until full.", shown["start"]))]
        return [item("plan", "ok", "Charge plan", Msg("Plan off, {0} to {1}.", shown["start"], shown["end"]))]
    return [item("plan", "ok", "Charge plan", "No charge plan is set.")]


def plan_info(runtime):
    """Current plan facts, or None when this vehicle has no Deepal Alternative charge plan."""
    hass = runtime.hass
    entities = plan_entities(hass, getattr(runtime, "_device_id", None))
    if "switch" not in entities:
        return None
    coordinator, car_id = find_source(hass, entities)
    plans = read_plans(coordinator, car_id) if coordinator else None
    state = hass.states.get(entities["switch"])
    times = {key: entity_time(hass.states.get(entities[key])) if key in entities else None for key in ("start", "end")}
    info = {"entities": entities, "coordinator": coordinator, "plans": plans, "times": times,
            "switch": state.state if state else None}
    info["facts"] = analyse(plans, info["switch"]) if plans is not None else None
    return info


def _plain(value):
    """Keep log data JSON safe: Home Assistant service data can hold times, dates and other objects."""
    return value if isinstance(value, (str, int, float, bool)) or value is None else str(value)


def plan_changes(before, now):
    """Events between two plan lists, matched by id and times (see plan_key), not by id alone.

    Identical records are matched in list order. A record whose state changed is "changed". A time edit of the
    plan the car follows (same id, first in both lists) is "changed" too, not "removed" plus "added".
    """
    def keyed(plans):
        seen, out = {}, []
        for plan in plans:
            key = plan_key(plan)
            seen[key] = seen.get(key, 0) + 1
            out.append((key + (seen[key],), plan))
        return out
    old, new = keyed(before), keyed(now)
    old_map, new_map = dict(old), dict(new)
    events = [("plan_changed", plan) for key, plan in new if key in old_map and old_map[key]["active"] != plan["active"]]
    gone = [plan for key, plan in old if key not in new_map]
    came = [plan for key, plan in new if key not in old_map]
    if gone and came and before and now and gone[0] is before[0] and came[0] is now[0] and before[0]["id"] == now[0]["id"]:
        events.append(("plan_changed", now[0]))
        gone, came = gone[1:], came[1:]
    events += [("plan_added", plan) for plan in came] + [("plan_removed", plan) for plan in gone]
    return events


class PlanLog:
    """Seven days of plan activity: service calls, plan entity changes and plans the car added, changed or removed. Saved in the Home Assistant storage folder so a restart keeps it."""

    def __init__(self, runtime):
        self.runtime = runtime
        self.rows = deque(maxlen=MAX_ROWS)
        self.unsubs = []
        self.tracked = ()
        self._plans = None      # plan list as last seen, to spot plans that appear, change or disappear
        self._watched = None    # the Deepal Alternative coordinator we listen to
        self._watch_unsub = None
        self._store = None
        self._entities = {}

    async def start(self):
        hass = self.runtime.hass
        name = re.sub(r"[^a-z0-9_]", "_", str(getattr(self.runtime, "vehicle", "")).lower())
        self._store = Store(hass, 1, "deepal_companion_plan_log_" + name)
        try:
            saved = await self._store.async_load()
        except Exception:  # noqa: BLE001 - a damaged log file must not stop the vehicle
            _LOGGER.warning("The saved charge plan log could not be read; starting a new one", exc_info=True)
            saved = None
        cutoff = time.time() - RETENTION
        for row in (saved or {}).get("rows", []):
            if isinstance(row, dict) and isinstance(row.get("time"), (int, float)) and row["time"] >= cutoff and row.get("event"):
                self.rows.append(row)
        self.unsubs.append(hass.bus.async_listen(EVENT_CALL_SERVICE, self._service))
        self.unsubs.append(async_track_time_interval(hass, self._tick, timedelta(minutes=1)))
        self.refresh()

    async def stop(self):
        for unsubscribe in self.unsubs:
            unsubscribe()
        self.unsubs.clear()
        if self._watch_unsub is not None:
            self._watch_unsub()
        self._watch_unsub = self._watched = self._plans = None
        self.tracked = ()
        self.__dict__.pop("_state_unsub", None)
        if self._store is not None:
            try:
                await self._store.async_save(self._data())
            except Exception:  # noqa: BLE001
                _LOGGER.warning("The charge plan log could not be saved", exc_info=True)
        self.rows.clear()

    def _data(self):
        return {"rows": list(self.rows)}

    def _save_soon(self):
        if self._store is not None:
            self._store.async_delay_save(self._data, SAVE_DELAY)

    def refresh(self):
        """Follow the plan entities again; called whenever the vehicle's entity mapping is rebuilt."""
        self._entities = plan_entities(self.runtime.hass, getattr(self.runtime, "_device_id", None))
        ids = tuple(sorted(set(self._entities.values())))
        if ids == self.tracked:
            return
        previous = self.__dict__.pop("_state_unsub", None)
        if previous is not None:
            previous()
            self.unsubs.remove(previous)
        self.tracked = ids
        if ids:
            self._state_unsub = async_track_state_change_event(self.runtime.hass, list(ids), self._state)
            self.unsubs.append(self._state_unsub)

    def add(self, event, **fields):
        self.rows.append({"time": time.time(), "source": "ha", "event": event, **fields})
        self._save_soon()
        self._notify()

    def _notify(self):
        """Tell open Health pages that the plan activity changed, so they update without a refresh button."""
        try:
            async_dispatcher_send(self.runtime.hass, PLAN_SIGNAL, getattr(self.runtime, "vehicle", None))
        except Exception:  # noqa: BLE001 - a missed live update must never disturb the vehicle
            _LOGGER.debug("Charge plan update signal failed", exc_info=True)

    def prune(self):
        cutoff = time.time() - RETENTION
        kept = [row for row in self.rows if row["time"] >= cutoff]
        if len(kept) != len(self.rows):
            self.rows.clear()
            self.rows.extend(kept)
            self._save_soon()

    def watch(self):
        """Record plans that appear, change or disappear in the car's plan list.

        This is how the log learns what the car did, without Deepal Alternative keeping any log of its own.
        """
        entities = self._entities
        coordinator, car_id = find_source(self.runtime.hass, entities) if "switch" in entities else (None, None)
        if coordinator is not self._watched:
            if self._watch_unsub is not None:
                self._watch_unsub()
            self._watch_unsub, self._watched, self._plans = None, coordinator, None
            if coordinator is not None:
                self._watch_unsub = coordinator.async_add_listener(self.watch)
        plans = read_plans(coordinator, car_id) if coordinator is not None else None
        if plans is None:
            return
        before, self._plans = self._plans, plans
        if before is None:  # first look is only the starting point
            return
        events = plan_changes(before, plans)
        for event, plan in events:
            self.rows.append({"time": time.time(), "source": "deepal", "event": event, "plan_id": plan["id"],
                              "start": plan["start"], "end": plan["end"], "active": plan["active"]})
        if events:
            self._save_soon()
            self._notify()

    @callback
    def _tick(self, _now):
        self.watch()
        self.prune()

    @callback
    def _state(self, event):
        new, old = event.data.get("new_state"), event.data.get("old_state")
        if new is None or (old is not None and old.state == new.state):
            return
        self.add("state", entity=new.entity_id, old=old.state if old else None, new=new.state)

    @callback
    def _service(self, event):
        data = event.data
        if (data.get("domain"), data.get("service")) not in WATCHED_SERVICES:
            return
        payload = data.get("service_data") or {}
        targets = payload.get("entity_id")
        targets = [targets] if isinstance(targets, str) else list(targets or [])
        if not set(targets) & set(self.tracked):
            # A deepal call without a target could mean any vehicle: log it only when there is just one
            vehicles = getattr(self._watched, "vehicles", None) or []
            if data.get("domain") != "deepal" or targets or len(vehicles) != 1:
                return
        keep = {k: _plain(payload[k]) for k in ("enabled", "start_time", "end_time", "value") if k in payload}
        self.add("service", service=data["domain"] + "." + data["service"], entities=[str(t) for t in targets], data=keep)


def debug_view(runtime):
    """Everything the plan box shows: plans, the plan the app shows, and the merged log (newest first)."""
    info = plan_info(runtime)
    if info is None:
        return {"available": False, "plans": [], "log": []}
    log = getattr(runtime, "plan_log", None)
    if log is not None:
        log.watch()
        log.prune()
        rows = list(log.rows)
    else:
        rows = []
    rows.sort(key=lambda r: r["time"], reverse=True)
    facts = info["facts"] or {}
    shown = facts.get("shown")
    return {"available": True, "pending": info["plans"] is None, "times": info.get("times") or {},
            "plans": info["plans"] or [], "shown": shown["id"] if shown else None,
            "active": [p["id"] for p in facts.get("active", [])], "switch": info["switch"],
            "mismatch": bool(facts.get("mismatch")), "log": rows[:VIEW_LIMIT], "retention_days": RETENTION // 86400, "now": int(time.time())}
