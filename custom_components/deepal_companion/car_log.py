"""Car logs: a readable history of what happened to the car.

Built here, from the Home Assistant entities of the vehicle's Deepal Alternative device; nothing is recorded inside
Deepal Alternative. Rows are grouped in three categories: security, charging and others. A row is written only for a real
change: the first reading after a start is a baseline, unavailable or unknown never counts as a change, and a warning or a
lost connection must last a short while before it is logged. "Left unlocked" is derived (it is not reported by the car) and
is marked that way. Preconditioning rows are read from the preconditioning history at view time, so nothing is stored twice.
"""
from __future__ import annotations

import logging
import time
import uuid
from collections import deque
from datetime import timedelta
from functools import partial

from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store

from .const import CAR_LOG_SIGNAL

_LOGGER = logging.getLogger(__name__)

RETENTION = 30 * 86400   # the log keeps thirty days, like the preconditioning history
MAX_ROWS = 3000          # safety cap far above a month of normal use
VIEW_LIMIT = 500         # newest rows sent to the page
SAVE_DELAY = 30          # seconds to wait before writing, so a burst is saved once
CONFIRM = 60             # seconds a warning or a lost connection must last before it is logged
DATA_CONFIRM = 120       # seconds the battery reading must stay unavailable before "data unavailable" is logged
MIN_SESSION = 120        # a charge shorter than this that gained nothing is the charger doubting, not a charge
PAGE = 100              # rows per page sent to the page; a reload may ask for more, never above VIEW_LIMIT
HISTORY_DAYS = 10        # how far back the first start reads the recorder (its default keep time)
HISTORY_CAP = 600        # most rows the one-time history read may add
GROUP_GAP = 120         # seconds between two door, window or lock rows that still belong to one parking or opening
DEFAULT_WAIT = 30        # minutes; the same default the "Unlocked" alert uses
BAD = {"unavailable", "unknown", "", None}
DOMAIN_DEEPAL = "deepal"
POLLED_STATES = {"conflict", "error", "failed", "stopped", "disconnected"}

# role -> (domain, unique id suffix) of an entity created by Deepal Alternative; found through the device registry,
# so a renamed entity or another prefix keeps working.
DOORS = {"door_fl": "Front left door", "door_fr": "Front right door", "door_rl": "Rear left door", "door_rr": "Rear right door"}
WINDOWS = {"win_fl": "Front left window", "win_fr": "Front right window", "win_rl": "Rear left window", "win_rr": "Rear right window"}
TYRES = {"tire_fl": "Front left tyre pressure alarm", "tire_fr": "Front right tyre pressure alarm",
         "tire_rl": "Rear left tyre pressure alarm", "tire_rr": "Rear right tyre pressure alarm"}
SOURCES = {"lock": ("binary_sensor", "_doors_locked"), "trunk": ("binary_sensor", "_trunk"), "hood": ("binary_sensor", "_hood"),
           "key_battery": ("binary_sensor", "_key_battery_low"), "range": ("sensor", "_remaining_range"),
           "w_12v": ("binary_sensor", "_warning_12v_battery"), "w_tpms": ("binary_sensor", "_warning_tpms"),
           "w_abs": ("binary_sensor", "_warning_abs"), "w_airbag": ("binary_sensor", "_warning_airbag"),
           "w_brake_fluid": ("binary_sensor", "_warning_brake_fluid"), "w_brake": ("binary_sensor", "_warning_brake"),
           "w_eps": ("binary_sensor", "_warning_eps"), "w_power_limit": ("binary_sensor", "_warning_power_limit"),
           "w_power_system": ("binary_sensor", "_warning_power_system"),
           "w_traction": ("binary_sensor", "_warning_traction_battery_low")}
for _role, _key in (("door_fl", "front_left"), ("door_fr", "front_right"), ("door_rl", "rear_left"), ("door_rr", "rear_right")):
    SOURCES[_role] = ("binary_sensor", "_door_" + _key)
for _role, _key in (("win_fl", "front_left"), ("win_fr", "front_right"), ("win_rl", "rear_left"), ("win_rr", "rear_right")):
    SOURCES[_role] = ("binary_sensor", "_window_" + _key + "_open")
for _role, _key in (("tire_fl", "front_left"), ("tire_fr", "front_right"), ("tire_rl", "rear_left"), ("tire_rr", "rear_right")):
    SOURCES[_role] = ("binary_sensor", "_tire_" + _key + "_alarm")
# roles that follow the user's entity mapping of the Companion itself
MAPPED = {"plug": "plug", "charging": "charging", "batt": "batt", "pow": "pow", "odo": "odo", "cloud": "cloud"}

# problems: key -> (title while it lasts, title when it clears, severity, icon)
PROBLEMS = {
    "w_12v": ("12 V battery warning", "important", "mdi:car-battery"),
    "w_tpms": ("Tyre pressure warning", "important", "mdi:car-tire-alert"),
    "w_abs": ("ABS warning", "critical", "mdi:car-brake-abs"),
    "w_airbag": ("Airbag warning", "critical", "mdi:airbag"),
    "w_brake_fluid": ("Brake fluid warning", "critical", "mdi:car-brake-fluid-level"),
    "w_brake": ("Brake warning", "critical", "mdi:car-brake-alert"),
    "w_eps": ("Power steering warning", "critical", "mdi:steering"),
    "w_power_limit": ("Power limit warning", "important", "mdi:speedometer-slow"),
    "w_power_system": ("Power system warning", "critical", "mdi:flash-alert"),
    "w_traction": ("Traction battery low warning", "important", "mdi:battery-alert"),
    "key_battery": ("Key fob battery low", "important", "mdi:key-alert"),
}
for _role, _title in TYRES.items():
    PROBLEMS[_role] = (_title, "important", "mdi:car-tire-alert")
CONNECTION = {"cloud": ("Vehicle connection lost", "Vehicle connection restored", "important", "mdi:cloud-off-outline"),
              "data": ("Vehicle data unavailable", "Vehicle data restored", "important", "mdi:database-alert-outline")}

PRECOND = {
    "start_confirmed": ("Preconditioning on", "info", "mdi:fan"),
    "stop_confirmed": ("Preconditioning stopped", "info", "mdi:fan-off"),
    "auto_shutdown": ("Preconditioning ended by the car", "info", "mdi:timer-off-outline"),
    "battery_stop": ("Battery protection stopped the climate", "important", "mdi:battery-alert"),
    "handed_over": ("Preconditioning handed over to the driver", "info", "mdi:steering"),
    "session_abandoned": ("Preconditioning state unknown", "important", "mdi:help-circle-outline"),
    "start_blocked": ("Preconditioning blocked", "important", "mdi:battery-alert"),
    "start_failed": ("Preconditioning start failed", "critical", "mdi:alert-circle-outline"),
    "start_unknown": ("Preconditioning start not confirmed", "important", "mdi:help-circle-outline"),
    "stop_failed": ("Preconditioning stop failed", "critical", "mdi:alert-circle-outline"),
    "stop_unknown": ("Preconditioning stop not confirmed", "important", "mdi:help-circle-outline"),
    "schedule_missed": ("Scheduled preconditioning missed", "important", "mdi:calendar-remove"),
}
PRECOND_STARTS = {"start_requested", "start_confirmed"}
PRECOND_ENDS = {"stop_confirmed", "auto_shutdown", "battery_stop", "handed_over", "session_abandoned"}
PRECOND_ATTEMPT_ENDS = {"start_failed", "start_blocked"}


def describe(role, on):
    """(category, kind, title, icon) of a door, window, trunk, hood or cable change; None for other roles."""
    if role in DOORS or role in WINDOWS:
        what = "door" if role in DOORS else "window"
        return ("security", what + ("_open" if on else "_closed"), (DOORS.get(role) or WINDOWS.get(role)) + (" opened" if on else " closed"),
                "mdi:car-door" if what == "door" else "mdi:car-windshield-outline")
    if role in ("trunk", "hood"):
        return ("security", role + ("_open" if on else "_closed"), role.capitalize() + (" opened" if on else " closed"),
                "mdi:car-back" if role == "trunk" else "mdi:car-lifted-pickup")
    if role == "plug":
        return ("charging", "cable_connected" if on else "cable_disconnected",
                "Charging cable connected" if on else "Charging cable disconnected", "mdi:ev-plug-type2")
    return None


STATUS_ROLES = {"lock", "trunk", "hood", *DOORS, *WINDOWS}
GROUPED_KINDS = {"unlocked", "locked", "door_open", "door_closed", "window_open", "window_closed", "trunk_open", "trunk_closed", "hood_open", "hood_closed"}
HISTORY_ROLES = ["lock", "trunk", "hood", "plug", *DOORS, *WINDOWS]


def history_rows(role, entity, states, before):
    """Rows for the changes in one entity's recorded states (oldest first), only for times earlier than `before`.
    Unavailable and unknown readings are skipped and never count as a change."""
    rows, previous, unlocked = [], None, None
    for moment, value in states:
        if value in BAD:
            continue
        if previous is not None and value != previous and moment < before:
            on = value == "on"
            base = {"id": "h-%s-%d" % (role, int(moment * 1000)), "time": moment, "origin": "direct", "src": entity, "sev": "info"}
            if role == "lock":   # this sensor is "on" when the doors are UNLOCKED
                if on:
                    unlocked = moment
                    rows.append(dict(base, cat="security", kind="unlocked", title="Doors unlocked", icon="mdi:lock-open-variant-outline"))
                else:
                    row = dict(base, cat="security", kind="locked", title="Doors locked", icon="mdi:lock-outline")
                    if unlocked:
                        row["detail"] = {"minutes": max(1, round((moment - unlocked) / 60))}
                    unlocked = None
                    rows.append(row)
            else:
                found = describe(role, on)
                if found:
                    rows.append(dict(base, cat=found[0], kind=found[1], title=found[2], icon=found[3]))
        previous = value
    return rows


def number(state):
    """A reading as a float, or None when it is not a usable number."""
    try:
        value = float(getattr(state, "state", state))
    except (TypeError, ValueError):
        return None
    return value if value == value and abs(value) != float("inf") else None


def valid(state):
    return state is not None and state.state not in BAD


def precondition_rows(history, since):
    """Plain-language preconditioning rows from the controller's history: when it started and when and why it ended."""
    rows, session, started, params = [], None, None, {}
    entries = [h for h in history or [] if isinstance(h, dict) and isinstance(h.get("time"), (int, float)) and h.get("kind")]
    for entry in sorted(entries, key=lambda h: h["time"]):
        kind = entry["kind"]
        if kind in PRECOND_STARTS:
            if session is None:
                session, started, params = "pc-" + str(entry.get("id", entry["time"])), None, {}
            for key in ("temperature", "duration", "source"):
                if entry.get(key) not in (None, ""):
                    params[key] = entry[key]
            if kind == "start_confirmed":
                started = entry["time"]
        spec = PRECOND.get(kind)
        if spec and entry["time"] >= since:
            detail = dict(params) if session else {}
            for key in ("reason", "error"):
                if entry.get(key) not in (None, ""):
                    detail[key] = entry[key]
            if kind in PRECOND_ENDS and started:
                detail["minutes"] = max(0, round((entry["time"] - started) / 60))
            row = {"id": "pc-" + str(entry.get("id", entry["time"])) + "-" + kind, "time": entry["time"], "cat": "others",
                   "kind": "precondition", "title": spec[0], "sev": spec[1], "icon": spec[2], "origin": "direct"}
            if detail:
                row["detail"] = detail
            if session and (kind in PRECOND_STARTS or kind in PRECOND_ENDS):
                row["session"] = session
            rows.append(row)
        if kind in PRECOND_ENDS or kind in PRECOND_ATTEMPT_ENDS:
            session, started, params = None, None, {}
    return rows


class CarLog:
    def __init__(self, runtime):
        self.runtime = runtime
        self.rows = deque(maxlen=MAX_ROWS)
        self.entities = {}      # role -> entity id
        self.roles = {}         # entity id -> role
        self.baseline = {}      # role -> last valid state
        self.gap = set()        # roles that were unavailable since their last valid state
        self.pending = {}       # key -> cancel function of a waiting confirmation
        self.logged = set()     # problems already written, so "cleared" is only written for them
        self.session = None     # the charge in progress
        self.left = None        # "left unlocked" in progress
        self.unsubs = []
        self._track = None
        self._store = None
        self._seq = 0
        self.car_id = None
        self.since = time.time()   # when this log first started recording; kept across restarts
        self.backfilled = False    # the one-time read of the recorder's past has been done
        self._backfill_task = None

    # ---- life cycle
    async def start(self):
        hass = self.runtime.hass
        name = "".join(c if c.isalnum() else "_" for c in str(getattr(self.runtime, "vehicle", "")).lower())
        self._store = Store(hass, 1, "deepal_companion_car_log_" + name)
        try:
            saved = await self._store.async_load()
        except Exception:  # noqa: BLE001 - a damaged log file must not stop the vehicle
            _LOGGER.warning("The saved car log could not be read; starting a new one", exc_info=True)
            saved = None
        saved = saved if isinstance(saved, dict) else {}
        cutoff = time.time() - RETENTION
        for row in saved.get("rows", []):
            if isinstance(row, dict) and isinstance(row.get("time"), (int, float)) and row["time"] >= cutoff and row.get("kind") and row.get("title"):
                self.rows.append(row)
        if isinstance(saved.get("since"), (int, float)):
            self.since = saved["since"]
        self.backfilled = saved.get("backfilled") is True
        session, left = saved.get("session"), saved.get("left")
        self.session = session if isinstance(session, dict) and isinstance(session.get("id"), str) else None
        self.left = left if isinstance(left, dict) and isinstance(left.get("since"), (int, float)) else None
        self.refresh(first=True)
        self.unsubs.append(async_track_time_interval(hass, self._tick, timedelta(minutes=1)))
        if not self.backfilled and hasattr(hass, "async_create_task"):
            self._backfill_task = hass.async_create_task(self.backfill())

    async def stop(self):
        for unsubscribe in self.unsubs:
            unsubscribe()
        self.unsubs.clear()
        if self._track is not None:
            self._track()
            self._track = None
        for cancel in self.pending.values():
            cancel()
        self.pending.clear()
        if self._backfill_task is not None and not self._backfill_task.done():
            self._backfill_task.cancel()
        if self._store is not None:
            try:
                await self._store.async_save(self._data())
            except Exception:  # noqa: BLE001
                _LOGGER.warning("The car log could not be saved", exc_info=True)

    def _data(self):
        return {"rows": list(self.rows), "session": self.session, "left": self.left, "since": self.since, "backfilled": self.backfilled}

    def _save_soon(self):
        if self._store is not None:
            self._store.async_delay_save(self._data, SAVE_DELAY)

    def refresh(self, first=False):
        """Follow the vehicle's entities again; called whenever the entity mapping is rebuilt."""
        hass, runtime = self.runtime.hass, self.runtime
        found = {}
        device = getattr(runtime, "_device_id", None)
        if device:
            for entry in er.async_get(hass).entities.values():
                if entry.device_id != device or entry.platform != DOMAIN_DEEPAL or not entry.unique_id:
                    continue
                for role, (domain, suffix) in SOURCES.items():
                    if entry.domain == domain and entry.unique_id.endswith(suffix) and role not in found:
                        found[role] = entry.entity_id
        for role, key in MAPPED.items():
            if runtime.entities.get(key):
                found[role] = runtime.entities[key]
        lock = found.get("lock") and er.async_get(hass).async_get(found["lock"])
        unique = getattr(lock, "unique_id", "") or ""
        self.car_id = unique[len("deepal_"):-len("_doors_locked")] if unique.startswith("deepal_") and unique.endswith("_doors_locked") else self.car_id
        if found == self.entities and not first:
            return
        self.entities = found
        self.roles = {entity: role for role, entity in found.items()}
        if self._track is not None:
            self._track()
        self._track = async_track_state_change_event(hass, list(self.roles), self._event) if self.roles else None
        for role, entity in found.items():
            state = hass.states.get(entity)
            if valid(state) and role not in self.baseline:
                self.baseline[role] = state.state   # the reading at start is a baseline, never an event
        if first:
            self._resume(hass)

    def _resume(self, hass):
        """Reconcile a charge that was running when Home Assistant stopped."""
        state = hass.states.get(self.entities.get("charging", ""))
        if not valid(state):
            return
        if self.session and state.state == "off":
            self._end_charge(time.time(), late=True)
        elif state.state == "on" and not self.session:
            self.session = {"id": uuid.uuid4().hex, "start": None, "level": None}   # started before the log could see it
            self._save_soon()

    async def _read_history(self, entity_ids, start, end):
        """Recorded states per entity as (time, value) lists, oldest first. Read-only, one query."""
        from homeassistant.components.recorder import get_instance, history
        hass = self.runtime.hass

        def read():
            return history.get_significant_states(hass, start, end, entity_ids, include_start_time_state=True,
                                                  significant_changes_only=False, no_attributes=True)
        found = await get_instance(hass).async_add_executor_job(read)
        result = {}
        for entity, items in (found or {}).items():
            result[entity] = [(item.last_changed.timestamp(), item.state) for item in items if getattr(item, "last_changed", None)]
        return result

    async def backfill(self):
        """Once, add what the recorder remembers about doors, locks and the cable from before this log started."""
        if self.backfilled:
            return
        ids = {role: self.entities[role] for role in HISTORY_ROLES if self.entities.get(role)}
        if not ids:
            return
        try:
            found = await self._read_history(list(ids.values()), time.time() - HISTORY_DAYS * 86400, time.time())
        except ImportError:
            found = {}   # no recorder: nothing to read, and nothing to retry
        except Exception:  # noqa: BLE001 - try again at the next start
            _LOGGER.debug("The recorder history could not be read for the car log", exc_info=True)
            return
        added = []
        for role, entity in ids.items():
            added += history_rows(role, entity, found.get(entity, []), self.since)
        added.sort(key=lambda row: row["time"], reverse=True)
        added = added[:HISTORY_CAP]
        if added:
            merged = sorted([*self.rows, *added], key=lambda row: row["time"])
            self.rows = deque(merged[-MAX_ROWS:], maxlen=MAX_ROWS)
        self.backfilled = True
        self._save_soon()
        self._notify()

    # ---- helpers
    def level(self):
        return number(self.runtime.hass.states.get(self.entities.get("batt", "")))

    def mode(self):
        """Return the update interval in seconds when the car is only polled, or None for live or unknown.

        Reads the Deepal Alternative entry's own state and fails soft: an unknown shape means "no marker"."""
        try:
            for config in self.runtime.hass.config_entries.async_entries(DOMAIN_DEEPAL):
                coordinator = getattr(getattr(config, "runtime_data", None), "coordinator", None)
                if coordinator is None or not any(v.car_id == self.car_id for v in getattr(coordinator, "vehicles", [])):
                    continue
                interval = getattr(getattr(coordinator, "update_interval", None), "total_seconds", lambda: None)()
                stats = getattr(coordinator, "mqtt_session_stats", None)
                stats = stats() if callable(stats) else None
                details = (stats or {}).get("details") if isinstance(stats, dict) else None
                state = str(details.get("state")) if isinstance(details, dict) and details.get("state") is not None else ""
                if config.options.get("mqtt_live_session", True) is False or (isinstance(stats, dict) and stats.get("enabled") is False) or state in POLLED_STATES:
                    return int(interval) if interval else 300
                return None
        except Exception:  # noqa: BLE001 - the mode is a hint; the log never depends on it
            _LOGGER.debug("Could not read the telemetry mode", exc_info=True)
        return None

    def add(self, cat, kind, title, sev="info", icon="", *, src="", origin="direct", session=None, detail=None, late=False, now=None):
        now = time.time() if now is None else now
        self._seq += 1
        row = {"id": "%d-%d" % (int(now * 1000), self._seq), "time": now, "cat": cat, "kind": kind, "title": title,
               "sev": sev, "icon": icon, "origin": origin}
        for key, value in (("src", src), ("session", session), ("detail", detail)):
            if value:
                row[key] = value
        if late:
            row["late"] = True
        poll = None if origin == "derived" else self.mode()
        if poll:
            row["poll"] = poll
        self.rows.append(row)
        self._save_soon()
        self._notify()
        return row

    def _notify(self):
        async_dispatcher_send(self.runtime.hass, CAR_LOG_SIGNAL, getattr(self.runtime, "vehicle", None))

    # ---- detection
    @callback
    def _event(self, event):
        self.handle(event.data.get("entity_id"), event.data.get("new_state"))

    def handle(self, entity_id, new_state, now=None):
        role = self.roles.get(entity_id)
        if role is None:
            return
        now = time.time() if now is None else now
        if not valid(new_state):
            self.gap.add(role)
            if role == "batt":
                self._wait("data", DATA_CONFIRM)
            return
        value = new_state.state
        previous = self.baseline.get(role)
        self.baseline[role] = value
        late = role in self.gap
        self.gap.discard(role)
        if role == "batt":
            self._recovered("data", now)
            if previous != value:
                self._notify()   # the status card shows the level
            return
        if previous is None or previous == value:
            return
        if role in STATUS_ROLES:
            self._notify()   # the status card follows the live state, not only the logged rows
        self._changed(role, value, now, late)

    def _changed(self, role, value, now, late):
        on = value == "on"
        if role == "charging":
            self._start_charge(now, late) if on else self._end_charge(now, late)
        elif role == "lock":   # this sensor is "on" when the doors are UNLOCKED
            self._lock(on, now, late)
        elif describe(role, on):
            cat, kind, title, icon = describe(role, on)
            self.add(cat, kind, title, "info", icon, src=self.entities.get(role, ""), late=late, now=now)
        elif role in PROBLEMS:
            self._wait(role, CONFIRM) if on else self._recovered(role, now)
        elif role == "cloud":
            self._wait("cloud", CONFIRM) if not on else self._recovered("cloud", now)

    def _lock(self, unlocked, now, late):
        src = self.entities.get("lock", "")
        if unlocked:
            self.add("security", "unlocked", "Doors unlocked", "info", "mdi:lock-open-variant-outline", src=src, late=late, now=now)
            return
        detail = None
        if self.left:
            detail = {"minutes": max(1, round((now - self.left["since"]) / 60))}
            self.left = None
        self.add("security", "locked", "Doors locked", "info", "mdi:lock-outline", src=src, detail=detail, late=late, now=now)

    def _wait(self, key, seconds):
        """Log a problem only when it lasts; a blip while the car wakes up is not a problem."""
        if key in self.pending or key in self.logged:
            return
        self.pending[key] = async_call_later(self.runtime.hass, seconds, partial(self._confirmed, key))

    @callback
    def _confirmed(self, key, _now=None):
        self.pending.pop(key, None)
        if not self.is_problem(key):
            return
        if key in CONNECTION:
            title, _, sev, icon = CONNECTION[key]
        else:
            title, sev, icon = PROBLEMS[key]
        self.logged.add(key)
        self.add("others", "problem", title, sev, icon, src=self.entities.get("batt" if key == "data" else key, ""))

    def _recovered(self, key, now):
        cancel = self.pending.pop(key, None)
        if cancel:
            cancel()
        if key not in self.logged:
            return
        self.logged.discard(key)
        if key in CONNECTION:
            title, icon = CONNECTION[key][1], "mdi:cloud-check-outline" if key == "cloud" else "mdi:database-check-outline"
        else:
            title, icon = PROBLEMS[key][0] + " cleared", "mdi:check-circle-outline"
        self.add("others", "cleared", title, "info", icon, src=self.entities.get("batt" if key == "data" else key, ""), now=now)

    def is_problem(self, key):
        """Whether a problem holds right now, read from the live state."""
        hass = self.runtime.hass
        if key == "data":
            return not valid(hass.states.get(self.entities.get("batt", ""))) and "batt" in self.entities
        state = hass.states.get(self.entities.get(key, ""))
        if not valid(state):
            return False
        return state.state == ("off" if key == "cloud" else "on")

    # ---- charging
    def _start_charge(self, now, late):
        if self.session and self.session.get("start") is not None:
            return
        level = self.level()
        session = {"id": uuid.uuid4().hex, "start": now, "level": level}
        self.session = session
        self.add("charging", "charging_start", "Charging started", "info", "mdi:ev-station", src=self.entities.get("charging", ""),
                 session=session["id"], detail={"level": level} if level is not None else None, late=late, now=now)

    def _end_charge(self, now, late=False):
        session, self.session = self.session, None
        self._save_soon()
        if not session:
            return
        level, start = self.level(), session.get("start")
        gained = level is not None and session.get("level") is not None and level > session["level"]
        if start is not None and now - start < MIN_SESSION and not gained:
            self.rows = deque((r for r in self.rows if r.get("session") != session["id"]), maxlen=MAX_ROWS)   # charger flapping
            self._notify()
            return
        detail = {key: value for key, value in (("start_level", session.get("level")), ("level", level),
                                                 ("minutes", max(1, round((now - start) / 60)) if start is not None else None)) if value is not None}
        self.add("charging", "charging_end", "Charging ended", "info", "mdi:ev-station", src=self.entities.get("charging", ""),
                 session=session["id"], detail=detail or None, late=late, now=now)

    # ---- derived: left unlocked
    def wait_seconds(self):
        """The wait of the user's "Unlocked" alert, or the default of that alert."""
        engine = getattr(self.runtime, "notifications", None)
        rules = [r for r in getattr(engine, "config", {}).get("rules", []) if isinstance(r, dict) and r.get("preset") == "unlocked"]
        rules.sort(key=lambda r: not r.get("enabled", True))
        options = rules[0].get("preset_options") if rules and isinstance(rules[0].get("preset_options"), dict) else {}
        wait = options.get("wait") if type(options.get("wait")) is int else DEFAULT_WAIT
        return max(wait, 10) * 60

    def parked(self, wait, now):
        """The car is off, or it is on but neither its power status nor its odometer changed for the whole wait."""
        hass = self.runtime.hass
        power = hass.states.get(self.entities.get("pow", ""))
        if not valid(power):
            return False
        if power.state == "off":
            return True
        odo = hass.states.get(self.entities.get("odo", ""))
        return power.state == "on" and valid(odo) and now - power.last_changed.timestamp() >= wait and now - odo.last_changed.timestamp() >= wait

    @callback
    def _tick(self, _now=None):
        self.check_left()
        cutoff = time.time() - RETENTION
        while self.rows and self.rows[0].get("time", cutoff) < cutoff:
            self.rows.popleft()

    def check_left(self, now=None):
        now = time.time() if now is None else now
        state = self.runtime.hass.states.get(self.entities.get("lock", ""))
        if not valid(state):
            return
        if state.state != "on":
            self.left = None if self.left and state.state == "off" else self.left
            return
        if self.left:
            return
        since, wait = state.last_changed.timestamp(), self.wait_seconds()
        if now - since >= wait and self.parked(wait, now):
            self.left = {"since": since}
            self.add("security", "left_unlocked", "Left unlocked", "important", "mdi:lock-alert-outline", src=self.entities.get("lock", ""),
                     origin="derived", detail={"since": since}, now=now)

    # ---- view
    def active(self, now=None):
        """What is wrong right now, read from the live states, so a warning stays visible whatever the filter or date."""
        now, hass, items = time.time() if now is None else now, self.runtime.hass, []
        if self.left:
            items.append({"key": "left_unlocked", "title": "Left unlocked", "sev": "important", "since": self.left["since"], "origin": "derived"})
        for key in list(PROBLEMS) + list(CONNECTION):
            if not self.is_problem(key):
                continue
            state = hass.states.get(self.entities.get("batt" if key == "data" else key, ""))
            since = state.last_changed.timestamp() if state is not None else now
            if now - since < (DATA_CONFIRM if key == "data" else CONFIRM):
                continue
            title, sev = (CONNECTION[key][0], CONNECTION[key][2]) if key in CONNECTION else (PROBLEMS[key][0], PROBLEMS[key][1])
            items.append({"key": key, "title": title, "sev": sev, "since": since, "origin": "direct"})
        return items


async def read_sessions(runtime):
    """Charging archive rows of the last retention period; empty when the archive cannot be read."""
    try:
        return list(await runtime.hub.db("sessions", runtime.vehicle, time.time() - RETENTION, time.time() + 86400) or [])
    except Exception:  # noqa: BLE001 - the archive is optional here; the log still works without it
        _LOGGER.debug("Charging archive not readable for the car log", exc_info=True)
        return []


def usable(item):
    """(start, end, from, to) of a finished charge that counts, or None for a live, broken or flapping one."""
    try:
        start, end = float(item["s"]) / 1000, float(item["e"]) / 1000
    except (KeyError, TypeError, ValueError):
        return None
    low, high = number(item.get("from")), number(item.get("to"))
    if item.get("live") or end < start or ((end - start) < MIN_SESSION and not (low is not None and high is not None and high > low)):
        return None
    return start, end, low, high


def archived_charges(sessions, since, logged):
    """Charges from before the log existed, as the same two rows a live charge writes. A charge the log already
    wrote itself is skipped, so nothing shows twice."""
    rows = []
    marks = [r["time"] for r in logged if r.get("cat") == "charging"]
    for item in sessions:
        found = usable(item)
        if not found or found[0] >= since or any(found[0] - 300 <= m <= found[1] + 300 for m in marks):
            continue
        start, end, low, high = found
        ident = "arc-" + str(item.get("id", int(start)))
        base = {"cat": "charging", "sev": "info", "icon": "mdi:ev-station", "origin": "direct", "session": ident}
        rows.append(dict(base, id=ident + "-s", time=start, kind="charging_start", title="Charging started",
                         detail={"level": low} if low is not None else {}))
        rows.append(dict(base, id=ident + "-e", time=end, kind="charging_end", title="Charging ended",
                         detail={k: v for k, v in (("start_level", low), ("level", high), ("minutes", max(1, round((end - start) / 60))), ("kwh", round(number(item.get("kwh")), 1) if number(item.get("kwh")) else None)) if v is not None}))
    return rows


def day_start(now):
    """Local midnight in the Home Assistant time zone."""
    try:
        from homeassistant.util import dt as dt_util
        return dt_util.start_of_local_day().timestamp()
    except Exception:  # noqa: BLE001
        return now - (now % 86400)


def page_of(rows, limit, before=None):
    """One page of rows (newest first). A page never splits rows that share a time or a charge/preconditioning session,
    so a group is always whole and the next page can continue from the oldest time shown."""
    if before is not None:
        rows = [r for r in rows if r["time"] < before]
    n = min(limit, len(rows))
    while 0 < n < len(rows) and rows[n]["time"] == rows[n - 1]["time"]:
        n += 1
    page, rest = rows[:n], rows[n:]
    sessions = {r["session"] for r in page if r.get("session")}
    if sessions:
        extra = [r for r in rest if r.get("session") in sessions]
        page = sorted(page + extra, key=lambda r: r["time"], reverse=True)
        rest = [r for r in rest if r.get("session") not in sessions]
    return page, bool(rest)


def group_security(rows):
    """Rows from one parking or opening (doors, windows, trunk, hood, lock) that happen within GROUP_GAP seconds of each
    other share a session id, so the page shows one summary event that opens into its steps. Nothing is stored; the
    rows of the log itself are never changed."""
    result = list(rows)
    index = sorted((i for i, r in enumerate(result) if r.get("cat") == "security" and r.get("kind") in GROUPED_KINDS and not r.get("session")),
                   key=lambda i: result[i]["time"])
    chain = []
    for i in index + [None]:
        if chain and (i is None or result[i]["time"] - result[chain[-1]]["time"] > GROUP_GAP):
            if len(chain) > 1:
                name = "sg-" + str(result[chain[0]]["id"])
                for j in chain:
                    result[j] = dict(result[j], session=name)
            chain = []
        if i is not None:
            chain.append(i)
    return result


def attach_energy(rows, sessions):
    """Add the energy of a charge to its end row when the archive knows it."""
    ends = [(float(item["e"]) / 1000, number(item.get("kwh"))) for item in sessions if number(item.get("kwh")) and item.get("e") is not None]
    result = []
    for row in rows:
        if row.get("kind") == "charging_end" and not (row.get("detail") or {}).get("kwh"):
            match = next((kwh for end, kwh in ends if abs(end - row["time"]) <= 900), None)
            if match:
                row = dict(row, detail=dict(row.get("detail") or {}, kwh=round(match, 1)))
        result.append(row)
    return result


def status_of(log, runtime):
    """The car right now, from the live states: lock, doors, windows, trunk, hood, battery and range."""
    get = getattr(getattr(runtime.hass, "states", None), "get", lambda _e: None)

    def reading(role):
        state = get(log.entities.get(role, ""))
        return state if valid(state) else None
    doors = [reading(r) for r in DOORS if log.entities.get(r)]
    windows = [reading(r) for r in WINDOWS if log.entities.get(r)]
    lock, trunk, hood, range_state = reading("lock"), reading("trunk"), reading("hood"), reading("range")
    return {"locked": (lock.state == "off") if lock else None,
            "doors_total": len(doors), "doors_open": sum(1 for d in doors if d and d.state == "on"),
            "windows_total": len(windows), "windows_open": sum(1 for w in windows if w and w.state == "on"),
            "trunk_open": (trunk.state == "on") if trunk else None, "hood_open": (hood.state == "on") if hood else None,
            "battery": number(log.level()) if log.level() is not None else None,
            "range": number(range_state) if range_state else None,
            "range_unit": getattr(range_state, "attributes", {}).get("unit_of_measurement", "km") if range_state else "km",
            "charging": (reading("charging").state == "on") if reading("charging") else False}


async def view(runtime, params=None):
    """What the Car logs page needs: one page of rows newest first, tile counts, a short summary, and what is wrong now.

    params: cat (security|charging|others), range (today|7|30), before (time of the oldest row already shown), limit."""
    params = params if isinstance(params, dict) else {}
    log = getattr(runtime, "car_log", None)
    now = time.time()
    base = {"retention_days": RETENTION // 86400, "now": int(now)}
    if log is None:
        return {"ready": False, "rows": [], "active": [], "more": False, "counts": {}, "summary": {}, "status": {}, "since": int(now), **base}
    rows = list(log.rows)
    history = getattr(getattr(runtime, "preconditioning", None), "history", None)
    rows += precondition_rows(history, now - RETENTION)
    sessions = await read_sessions(runtime)
    rows += archived_charges(sessions, log.since, list(log.rows))
    rows = attach_energy(group_security(rows), sessions)
    rows.sort(key=lambda r: r["time"], reverse=True)
    midnight = day_start(now)
    counts = {cat: sum(1 for r in rows if r["cat"] == cat and r["time"] >= midnight) for cat in ("security", "charging", "others")}
    cat = params.get("cat") if params.get("cat") in counts else None
    window = {"today": midnight, "7": now - 7 * 86400}.get(str(params.get("range")), now - RETENTION)
    shown = [r for r in rows if r["time"] >= window and (cat is None or r["cat"] == cat)]
    try:
        limit = max(1, min(VIEW_LIMIT, int(params.get("limit") or PAGE)))
    except (TypeError, ValueError):
        limit = PAGE
    before = number(params.get("before")) if params.get("before") is not None else None
    page, more = page_of(shown, limit, before)
    status = status_of(log, runtime)
    last_lock = next((r for r in rows if r.get("kind") in ("locked", "unlocked")), None)
    month = [usable(item) for item in sessions]
    kwh = sum(number(item.get("kwh")) or 0 for item, ok in zip(sessions, month) if ok)
    summary = {"security": {"locked": status["locked"], "since": int(last_lock["time"]) if last_lock else None},
               "charging": {"count": sum(1 for ok in month if ok), "kwh": round(kwh, 1)}}
    return {"ready": True, "status": status, "rows": page, "more": more, "counts": counts, "summary": summary, "active": log.active(now),
            "since": int(log.since), **base}
