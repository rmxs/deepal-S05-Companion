"""Charger limit: stop charging at the charging target by switching the owner's own charger.

The owner picks the charger device once. Companion finds the lock or switch that stops it, works out which way it
stops, and finds the charger's power sensor if there is one. When the car is plugged in and charging and the battery
reaches the charging target of the card (kept for a short time and reported recently), Companion switches that
control. Nothing about any charger brand is built in: only the owner's own entities are used.

Rules that keep it safe:
- Modes: off, dry run (decides and tells, never touches the charger), live.
- One stop per plug-in. When the charger is unplugged everything starts over.
- If the owner restarts the charger by hand after the stop (the control goes back to "charging allowed" without
  Companion doing it), the limit is paused until the next plug-in. It never fights the owner.
- If the owner raises the target above the battery level, turns the target off, switches the mode away from live or
  unplugs the car, the control Companion engaged is released, so the next charge is never blocked by an old stop.
- A stop is confirmed (the control reads "stopped" and the charger power, when known, drops). If it is not,
  Companion retries a few times, then releases the control, reports the error and waits (Health shows it).
- A stop is saved before the command is sent, so a restart in between still leaves a stop to release. If a release
  fails (the charger offline, for example), the control stays marked "release pending": Companion keeps trying on
  every check, through unplug and replug, until the control reads "charging allowed". A manual restart is never
  answered with a release.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
import logging
import re
import time

from .notifications import apply_silent
from .const import vehicle_entity
from .phone_text import tr

_LOGGER = logging.getLogger(__name__)

MODES = ("off", "dry", "live")
DEFAULT = {"mode": "off", "device_id": None, "control": None, "on_stops": True, "power": None, "energy": None,
           "profile": "auto", "stop_option": None, "start_option": None, "start_button": None, "status": None}
ENTITY = re.compile(r"[a-z0-9_]+\.[a-z0-9_]+")
CONTROL_DOMAINS = ("lock", "switch", "input_boolean")
COMMAND_DOMAINS = ("select", "button")   # a charger that takes commands (Tuya Local 'Toggle charging'): no state to read back
PROFILES = ("auto", "feyree")
# the words of a stop and a start command in the languages Home Assistant is used in (an option or button name; wait/idle words are never a command)
STOP_OPT = re.compile(r"\b(?:stop|close|pause|halt|abort|cancel|disable|parar|detener|apag|arr[eê]t|stopp|beend|pausier|ferma|interromp|spegn|διακοπ|σταμάτ|τερματ|κλείσ)|\b(?:end|off)\b")
START_OPT = re.compile(r"\b(?:start|open|resume|enable|begin|inicia|arranc|reanud|enciend|d[eé]marr|d[eé]but|starte|beginn|fortsetz|avvia|inizia|riprend|accend|έναρξ|ξεκιν|άνοιγ|συνέχ|ενεργοπ)|\b(?:on|go)\b")
IDLE_OPT = re.compile(r"wait|idle|standby|espera|warte|attesa|αναμον|αδρανε")
CHARGING_VALUES = {"charging", "charger_charging", "charge"}  # a status value that means the car is taking power
HOLD = 45               # seconds the target must stay reached before Companion acts: one wrong reading cannot stop a charge
FRESH = 1800            # the battery report must be this recent (seconds)
VERIFY = 90             # seconds to wait for the charger to confirm a stop
POLL = 5
RETRY_DELAY = 30
MAX_ATTEMPTS = 3
POWER_IDLE_W = 50       # below this the charger counts as not charging
POWER_UNITS = {"kw": 1000.0, "mw": 0.001, "MW": 1000000.0, "w": 1.0}   # the power sensor unit -> watts (no unit counts as W; "MW" is megawatt, "mW" milliwatt)
ENERGY_UNITS = {"wh": 0.001, "kwh": 1.0, "MWh": 1000.0}  # the energy sensor unit -> kWh (no unit counts as kWh)
SESSION = re.compile(r"once|session|this charge|charge energy|per charge|sesi[oó]n|sitzung")  # an energy sensor whose name says it counts this charge
TOTAL = re.compile(r"total|forward|lifetime|import|accumulated|sum")  # a lifetime counter, never 'kWh this charge'
EXPECT = 90             # seconds after our own release in which a "charging allowed" reading is not a manual restart
PLUG_UNKNOWN = 600      # seconds the plug sensor may be unknown while a stop is held before the limit reports it
INTERVAL = 15
UNKNOWN_STATES = {"unknown", "unavailable", "none", ""}
STOP_WORDS = re.compile(r"lock|block|bloque|disabl|paus|stop|inhibit|sperr|blocc|bloquear")
ALLOW_WORDS = re.compile(r"charg(?:e|ing)|enabl|allow|start|carga|cargar|laden|ricarica|power|activ")
ACTIVITY = {
    "stopped": ("Charging reached target · {0}%", "info", "mdi:battery-charging-high"),
    "would_stop": ("Dry run: would stop charging at {0}%", "info", "mdi:battery-charging-high"),
    "released": ("Charger released", "info", "mdi:power-plug"),
    "paused": ("Charging limit paused", "info", "mdi:pause-circle-outline"),
    "failed": ("The charger could not be stopped", "critical", "mdi:alert-circle-outline"),
    "release_pending": ("The charger could not be released", "critical", "mdi:alert-circle-outline"),
}
PHONE = {
    "stopped": "The charger was switched off at the charging target.",
    "would_stop": "Nothing was changed on the charger.",
    "released": "{0}",
    "paused": "You restarted the charger, so the limit waits until the next plug-in.",
    "failed": "{0}",
    "release_pending": "The charger could not be put back to charging. Companion will keep trying.",
}


# -- phone recipients (pure) -------------------------------------------------------------------------------------------
MAX_RECIPIENTS = 20


def recipients(config):
    """Phones for a charger message: the devices of every enabled alert rule, then Live climate, de-duplicated in order.
    The caller checks the master switch."""
    found = []
    for rule in (config.get("rules") or []):
        if isinstance(rule, dict) and rule.get("enabled") is True and isinstance(rule.get("devices"), list):
            found.extend(rule["devices"])
    live = config.get("live_climate") or {}
    if isinstance(live, dict) and isinstance(live.get("devices"), list):
        found.extend(live["devices"])
    out = []
    for device in found:
        if isinstance(device, str) and device.strip() and device not in out:
            out.append(device)
            if len(out) == MAX_RECIPIENTS:
                break
    return out


# -- discovery (pure: easy to test without Home Assistant) -------------------------------------------------------------
def classify(entries):
    """entries: [{"entity_id", "name", "device_class"}] of one charger device -> the best stop control, its direction,
    the power sensor and the energy sensor. 'on_stops' is True when turning the control on (or locking it) stops the
    charging; 'sure' says whether that came from the entity type or its name (False means the owner should check).
    The power sensor: a name with 'power' and 'total' wins, else the first power sensor.
    The energy sensor: a session-like name first, else the first energy sensor that is not a lifetime total, else none
    (a total counter would show a wrong 'kWh this charge')."""
    best = None
    power_found = []
    energy_found = []
    for entry in entries:
        entity_id = str(entry.get("entity_id") or "")
        domain = entity_id.split(".")[0]
        text = (entity_id + " " + str(entry.get("name") or "")).lower()
        device_class = str(entry.get("device_class") or "")
        if domain == "sensor" and device_class == "power":
            power_found.append((entity_id, text))
        if domain == "sensor" and device_class == "energy":
            energy_found.append((entity_id, text))
        if domain not in CONTROL_DOMAINS:
            continue
        found_stop, found_allow = STOP_WORDS.search(text), ALLOW_WORDS.search(text)
        stop, allow = bool(found_stop), bool(found_allow)
        if domain == "lock":
            score, on_stops, sure = 40, True, True
        elif stop and not allow:
            score, on_stops, sure = 30, True, True
        elif allow and not stop:
            score, on_stops, sure = 20, False, True
        elif stop and allow:
            score, on_stops, sure = 15, found_stop.start() < found_allow.start(), False
        else:
            score, on_stops, sure = 10, True, False
        if best is None or score > best[0]:
            best = (score, entity_id, on_stops, sure)
    power = _pick_power(power_found)
    energy = _pick_energy(energy_found)
    if best is None:
        return {"control": None, "on_stops": True, "sure": False, "power": power, "energy": energy}
    return {"control": best[1], "on_stops": best[2], "sure": best[3], "power": power, "energy": energy}


def option_role(text):
    """'stop' or 'start' for an option or button name that says so, None for an idle/wait word or an unclear one."""
    low = re.sub(r"[_\-.]+", " ", str(text or "").lower())
    if not low.strip() or IDLE_OPT.search(low):
        return None
    stop, start = STOP_OPT.search(low), START_OPT.search(low)
    return "stop" if stop and not start else ("start" if start and not stop else None)


def command_options(options):
    """(stop option, start option) of a select's option list, each None when not identified."""
    stop = start = None
    for option in options if isinstance(options, (list, tuple)) else []:
        role = option_role(option)
        if role == "stop" and stop is None:
            stop = str(option)
        elif role == "start" and start is None:
            start = str(option)
    return stop, start


def is_charging_value(value):
    """True for a status value that means charging (not 'not_charging', 'charged' or 'waiting_for_authorization')."""
    low = str(value or "").strip().lower().replace(" ", "_")
    return low in CHARGING_VALUES or (low.endswith("_charging") and not low.startswith("not"))


def find_command(entries, state_of):
    """The command control of one device (entries as device_entries gives them, state_of(entity) -> state or None), found by
    entity domain, options, unit and device class first (names can be translated): {control, stop_option, start_option,
    start_button, power, status, energy}, or None when the device has no select or button. A select whose options say both
    stop and start wins, then one that says one of them, then a lone select, then a stop button (with its start button)."""
    selects, stops, starts, power_found, energy_found, status = [], [], [], [], [], None
    for entry in entries:
        entity_id = str(entry.get("entity_id") or "")
        domain, _, tail = entity_id.partition(".")
        state = state_of(entity_id)
        attrs = getattr(state, "attributes", None) or {}
        text = tail + " " + str(entry.get("name") or "") + " " + str(attrs.get("friendly_name") or "")
        device_class = str(entry.get("device_class") or attrs.get("device_class") or "")
        if domain == "select":
            selects.append((entity_id, command_options(attrs.get("options"))))
        elif domain == "button":
            role = option_role(text)
            if role == "stop":
                stops.append(entity_id)
            elif role == "start":
                starts.append(entity_id)
        elif domain == "sensor" and device_class == "power":
            power_found.append((entity_id, text.lower()))
        elif domain == "sensor" and device_class == "energy":
            energy_found.append((entity_id, text.lower(), attrs.get("state_class")))
        elif domain == "sensor" and any(is_charging_value(o) for o in (attrs.get("options") or []) if isinstance(o, str)):
            if status is None or "status" in text.lower() or "state" in text.lower():
                status = entity_id
    pick = next((c for c in selects if all(c[1])), None) or next((c for c in selects if any(c[1])), None) or (selects[0] if len(selects) == 1 else None)
    found = {"control": None, "stop_option": None, "start_option": None, "start_button": None}
    if pick is not None:
        found.update(control=pick[0], stop_option=pick[1][0], start_option=pick[1][1])
    elif stops:
        found.update(control=stops[0], start_button=starts[0] if starts else None)
    else:
        return None
    # the energy of this charge: a measurement or a session name, never the lifetime-style total_increasing counter
    energy = (next((e for e, text, cls in energy_found if cls != "total_increasing" and not TOTAL.search(text)), None)
              or _pick_energy([(e, t) for e, t, cls in energy_found if cls != "total_increasing"]))
    found.update(power=_pick_power(power_found), status=status, energy=energy)
    return found


def _pick_power(found):
    """found: [(entity_id, lower-case text)]. A 'power' + 'total' name first, else the first one."""
    for entity_id, text in found:
        if "power" in text and "total" in text:
            return entity_id
    return found[0][0] if found else None


def _pick_energy(found):
    """found: [(entity_id, lower-case text)]. A session-like name first, else the first energy sensor that is not a
    lifetime total. Only totals (or nothing) leaves the energy sensor empty for the owner to choose."""
    for entity_id, text in found:
        if SESSION.search(text) and not TOTAL.search(text):
            return entity_id
    for entity_id, text in found:
        if not TOTAL.search(text):
            return entity_id
    return None


def scaled(state, factors):
    """The number of an entity converted with its unit (factors: unit -> multiplier, an exact match first, then lower case).
    No unit counts as the base unit; a unit that is not listed is not guessed: None, like an unknown reading."""
    try:
        value = float(state.state)
    except (AttributeError, TypeError, ValueError):
        return None
    unit = str((getattr(state, "attributes", None) or {}).get("unit_of_measurement") or "").strip()
    if not unit:
        return value
    factor = factors.get(unit, factors.get(unit.lower()))
    return None if factor is None else value * factor


def device_entries(hass, device_id):
    from homeassistant.helpers import entity_registry as er
    registry = er.async_get(hass)
    out = []
    for e in er.async_entries_for_device(registry, device_id):
        if e.disabled_by:
            continue
        out.append({"entity_id": e.entity_id, "name": e.name or e.original_name or "", "device_class": e.device_class or e.original_device_class or ""})
    return out


def entity_device(hass, entity_id):
    """The device an entity belongs to (entity registry), None when it has none or the registry is not there."""
    if not entity_id:
        return None
    try:
        from homeassistant.helpers import entity_registry as er
        found = er.async_get(hass).async_get(entity_id)
        return found.device_id if found is not None else None
    except Exception:  # noqa: BLE001 - without the registry no sensor is ever cleared as 'the old charger's'
        return None


def list_devices(hass, exclude_entities=()):
    """Devices that have a lock or switch (candidates for a charger), without the car's own device."""
    from homeassistant.helpers import device_registry as dr, entity_registry as er
    registry, devices = er.async_get(hass), dr.async_get(hass)
    skip = {registry.async_get(x).device_id for x in exclude_entities if x and registry.async_get(x)}
    found = {}
    for e in registry.entities.values():
        if e.device_id and not e.disabled_by and e.device_id not in skip and (e.domain in CONTROL_DOMAINS or _is_command(hass, e.entity_id, e.name or e.original_name)):
            found[e.device_id] = True
    out = []
    for device_id in found:
        device = devices.async_get(device_id)
        if device is not None:
            out.append({"id": device_id, "name": device.name_by_user or device.name or device_id})
    return sorted(out, key=lambda item: item["name"].lower())


def _named(state):
    attrs = getattr(state, "attributes", None) or {}
    return str(attrs.get("friendly_name") or state.entity_id)


def _is_command(hass, entity_id, name=None):
    """True for a select that offers a stop or start option, or a button named like one."""
    domain, _, tail = str(entity_id).partition(".")
    if domain not in COMMAND_DOMAINS:
        return False
    state = hass.states.get(entity_id)
    attrs = getattr(state, "attributes", None) or {}
    if domain == "select":
        return any(command_options(attrs.get("options")))
    return option_role(tail + " " + str(name or "") + " " + str(attrs.get("friendly_name") or "")) is not None


def controls(hass, skip=()):
    """Every lock, switch and input_boolean in Home Assistant, plus the selects and buttons that are a stop or start command, except
    the skipped ones (the car's own), for 'Choose another...'."""
    out = [{"entity": s.entity_id, "name": _named(s)} for s in hass.states.async_all()
           if s.entity_id not in skip and (s.entity_id.split(".")[0] in CONTROL_DOMAINS or _is_command(hass, s.entity_id))]
    return sorted(out, key=lambda item: item["name"].lower())


def sensors(hass, device_class):
    """Every sensor of one device class (power or energy), from any device."""
    out = [{"entity": s.entity_id, "name": _named(s)} for s in hass.states.async_all()
           if s.entity_id.split(".")[0] == "sensor" and (getattr(s, "attributes", None) or {}).get("device_class") == device_class]
    return sorted(out, key=lambda item: item["name"].lower())


def discover(hass, device_id, exclude_entities=()):
    """What the device offers. A device that holds one of the excluded entities (the car's own) is refused with a plain message."""
    entries = device_entries(hass, device_id)
    skip = {x for x in exclude_entities if x}
    if any(entry["entity_id"] in skip for entry in entries):
        raise ValueError("This is the car, choose the charger.")
    result = classify(entries)
    result["device_id"] = device_id
    return result


def is_on(state):
    """True/False for an entity that is on/off or locked/unlocked; None when unknown or unavailable."""
    value = str(getattr(state, "state", "") or "").lower()
    if value in ("on", "locked", "locking"):
        return True
    if value in ("off", "unlocked", "unlocking", "open", "opening"):
        return False
    return None


def validate(value, forbidden=()):
    """The saved settings, checked. 'forbidden' holds the entities of the Companion vehicle: never a charger control."""
    out = deepcopy(DEFAULT)
    if not isinstance(value, dict):
        return out
    if value.get("mode") in MODES:
        out["mode"] = value["mode"]
    for key in ("control", "power", "device_id", "energy", "status", "start_button"):
        item = value.get(key)
        if item in (None, ""):
            out[key] = None
        elif isinstance(item, str) and (key == "device_id" or ENTITY.fullmatch(item)) and len(item) <= 120:
            out[key] = item
        else:
            raise ValueError("Choose a valid charger entity")
    if out["control"] and out["control"].split(".")[0] not in CONTROL_DOMAINS + COMMAND_DOMAINS:
        raise ValueError("The stop control must be a lock, a switch, an input_boolean, a select or a button")
    if out["start_button"] and out["start_button"].split(".")[0] != "button":
        raise ValueError("The start command must be a button")
    if out["status"] and out["status"].split(".")[0] != "sensor":
        raise ValueError("The status sensor must be a sensor")
    if value.get("profile") in PROFILES:
        out["profile"] = value["profile"]
    for key in ("stop_option", "start_option"):
        item = value.get(key)
        if item in (None, ""):
            out[key] = None
        elif isinstance(item, str) and len(item) <= 120:
            out[key] = item
        else:
            raise ValueError("Choose a valid charger command")
    if out["control"] and out["control"] in forbidden:
        raise ValueError("This is the car's own lock, choose the charger.")
    if out["energy"] and out["energy"].split(".")[0] != "sensor":
        raise ValueError("The energy sensor must be a sensor")
    if "on_stops" in value:
        out["on_stops"] = bool(value["on_stops"])
    if out["mode"] != "off" and not out["control"]:
        out["mode"] = "off"  # nothing to switch: it cannot run
    return out


class ChargerLimit:
    def __init__(self, runtime, *, clock=time.time, sleep=asyncio.sleep, call=None, notifier=None):
        self.runtime, self.hass = runtime, runtime.hass
        self.clock, self.sleep = clock, sleep
        self.call = call or (lambda d, s, data: self.hass.services.async_call(d, s, data, blocking=True))
        self.notifier = notifier
        self.config = deepcopy(DEFAULT)
        self.state = self.blank_state()
        self.lock = asyncio.Lock()
        self.again = False
        self.unsubs = []
        self._background = set()
        self._watch = ()
        self._watch_unsub = None
        self.stopped = False
        self._guess = None

    @staticmethod
    def blank_state():
        return {"engaged": False, "engaged_target": None, "engaged_at": None, "session": None, "manual": False,
                "dry_done": False, "reached_since": None, "failed": None, "expect_until": 0, "last": None, "energy_at_stop": None,
                "release_pending": False, "release_config": None, "plugged_unknown_since": None, "release_wanted": False,
                "control_guess": False}

    # -- persistence
    async def db(self, *args):
        return await self.runtime.hub.db(*args)

    async def load(self):
        """The saved settings and state. A state saved before a key existed gets the default for it (False or None)."""
        try:
            self.config = validate(await self.db("get", self.runtime.vehicle, "charger_limit_config", DEFAULT), self.car_entities())
        except ValueError:
            self.config = deepcopy(DEFAULT)
        self.state = {**self.blank_state(), **await self.db("get", self.runtime.vehicle, "charger_limit_state", {})}

    async def start(self):
        from homeassistant.helpers.event import async_track_time_interval
        from datetime import timedelta
        await self.load()
        self.unsubs.append(async_track_time_interval(self.hass, self._tick_cb, timedelta(seconds=INTERVAL)))
        self._listen()
        self._spawn(self.evaluate())

    def _spawn(self, coro):
        task = self.hass.async_create_task(coro)
        if task is not None and hasattr(task, "add_done_callback"):
            self._background.add(task)
            task.add_done_callback(self._background.discard)
        return task

    def _listen(self):
        from homeassistant.helpers.event import async_track_state_change_event
        ids = tuple(x for x in (self.entity("sensor.battery_level"), self.entity("binary_sensor.charging"), self.entity("binary_sensor.charger_plugged"),
                                self.config["control"], self.config["power"], self.config["status"]) if x)
        if ids == self._watch:
            return
        self._watch = ids
        if self._watch_unsub is not None:
            self._watch_unsub()
        self._watch_unsub = async_track_state_change_event(self.hass, list(ids), self._changed)

    async def stop(self):
        self.stopped = True
        for task in list(self._background):
            task.cancel()
        self._background.clear()
        for unsub in self.unsubs:
            unsub()
        self.unsubs.clear()
        if self._watch_unsub is not None:
            self._watch_unsub()
            self._watch_unsub = None
        await self.persist()

    async def persist(self):
        await self.db("put", self.runtime.vehicle, "charger_limit_state", self.state)

    async def save(self, value):
        """Settings: the same call for the page and for tests. Changing the mode or the control starts clean.
        Choosing another charger (a changed device_id) re-finds the stop control and its direction for that device. The
        power and energy sensors are re-found too; when the new device has none, a sensor that belongs to the old charger
        is cleared, while a sensor the owner picked from another device is kept. Any control, direction, power or energy
        sent in the same call is then ignored: the backend owns those four on a device change."""
        value = value if isinstance(value, dict) else {}
        own = self.car_entities()
        self._guess = None
        if "device_id" in value and (value.get("device_id") or None) != self.config["device_id"]:
            value = self._device_change(value)
        elif value.get("profile") in PROFILES and value["profile"] != self.config["profile"]:
            value = self._profile_change(value)
        merged = self._command_fix(validate({**self.config, **value}, own), own)
        changed = {k for k in merged if merged[k] != self.config.get(k)}
        old = self.config
        if self.state["engaged"] and ({"control", "mode", "on_stops", "stop_option", "start_option", "start_button"} & changed) and old.get("control"):
            # let go of the old control before the new settings apply; waits for a stop that is still being confirmed
            async with self.lock:
                if self.state["engaged"]:
                    await self.release("settings", config=old)
        self.config = merged
        if changed:
            self.state.update(failed=None, dry_done=False, reached_since=None)
        if self._guess is not None:  # a new charger: say when its direction was only a guess from the names
            self.state["control_guess"] = self._guess
        elif {"control", "on_stops"} & changed:  # the owner chose it: no longer a guess
            self.state["control_guess"] = False
        await self.db("put", self.runtime.vehicle, "charger_limit_config", merged)
        self._listen()
        await self.evaluate()
        return self.snapshot()

    def _command(self, device_id):
        """The command control of a device (find_command), None when the registry or the device has none."""
        try:
            return find_command(device_entries(self.hass, device_id), self.get) if device_id else None
        except Exception:  # noqa: BLE001 - without the registry nothing is found
            return None

    def _profile_change(self, value):
        """The 'Charger type' dropdown: Feyree (Tuya Local) picks the device's command select or button pair with its power and status
        sensors; Auto goes back to the lock or switch the names point to. A device without a command is refused with a plain message."""
        device = value.get("device_id") or self.config["device_id"]
        if not device:
            raise ValueError("Choose your charger first.")
        out = dict(value)
        if value["profile"] == "feyree":
            found = self._command(device)
            if not found or not found["control"]:
                raise ValueError("No stop or start command was found on this charger.")
            out.update({k: found[k] for k in ("control", "stop_option", "start_option", "start_button", "status")}, on_stops=True)
            for key in ("power", "energy"):
                if found[key]:
                    out[key] = found[key]
            self._guess = False
        else:
            found = discover(self.hass, device, self.car_entities())
            out.update(control=found["control"], on_stops=found["on_stops"], stop_option=None, start_option=None, start_button=None, status=None)
            self._guess = bool(found["control"]) and not found.get("sure", True)
        return out

    def _command_fix(self, cfg, own=()):
        """A select or button as the stop control (picked by the profile or from 'Choose another...'): identify its stop and start
        commands (an option the owner picked that still exists is kept) and fill a missing power or status sensor from its own device.
        Any other control is the Auto profile and carries no command keys."""
        if not self.command(cfg):
            if cfg["control"]:
                cfg.update(profile="auto", stop_option=None, start_option=None, start_button=None, status=None)
            return cfg
        cfg["profile"], cfg["on_stops"] = "feyree", True
        domain = cfg["control"].split(".")[0]
        if domain == "select":
            options = [str(o) for o in (getattr(self.get(cfg["control"]), "attributes", None) or {}).get("options") or []]
            stop, start = command_options(options)
            if options:
                cfg["stop_option"] = cfg["stop_option"] if cfg["stop_option"] in options else stop
                cfg["start_option"] = cfg["start_option"] if cfg["start_option"] in options else start
            cfg["start_button"] = None
        else:
            cfg["stop_option"] = cfg["start_option"] = None
        found = self._command(entity_device(self.hass, cfg["control"]))
        if found:
            if domain == "button" and not cfg["start_button"]:
                cfg["start_button"] = found["start_button"]
            for key in ("power", "status"):
                if not cfg[key]:
                    cfg[key] = found[key]
        return cfg

    def _device_change(self, value):
        """The value with the four charger-owned keys re-found for a new device: the stop control and its direction from
        discovery (none when the device is cleared), the power and energy sensors from discovery when it offers one, else
        cleared only if they belong to the old charger, else kept (a sensor the owner picked from another device)."""
        new_device, old_device = value.get("device_id") or None, self.config["device_id"]
        if new_device:
            found = discover(self.hass, new_device, self.car_entities())
        else:
            found = {"control": None, "on_stops": True, "power": None, "energy": None}
        self._guess = bool(found["control"]) and not found.get("sure", True)
        out = {**value, "device_id": new_device, "control": found["control"], "on_stops": found["on_stops"], "profile": "auto",
               "stop_option": None, "start_option": None, "start_button": None, "status": None}
        command = self._command(new_device) if value.get("profile", self.config["profile"]) == "feyree" else None
        if value.get("profile") == "feyree" and new_device and not (command and command["control"]):
            raise ValueError("No stop or start command was found on this charger.")
        if command and command["control"]:  # the Feyree (Tuya Local) type stays on when the new charger has a command too
            found = {**found, **{k: command[k] for k in ("power", "energy")}}
            out.update({k: command[k] for k in ("control", "stop_option", "start_option", "start_button", "status")}, on_stops=True, profile="feyree")
            self._guess = False
        for key in ("power", "energy"):
            current = self.config.get(key)
            if found[key]:
                out[key] = found[key]
            elif current and old_device and entity_device(self.hass, current) == old_device:
                out[key] = None
            else:
                out[key] = current
        return out

    # -- command chargers (a select or a button pair): no state to read back, so the power and status sensors tell
    @staticmethod
    def command(cfg):
        return str(cfg.get("control") or "").split(".")[0] in COMMAND_DOMAINS

    def command_charging(self, cfg=None):
        """True when the power sensor or the status sensor says the charger is delivering, False when they say it is not,
        None when neither reads (the stop is then taken as done when the command went through)."""
        cfg = cfg or self.config
        seen = False
        power = scaled(self.get(cfg.get("power")), POWER_UNITS)
        if power is not None:
            seen = True
            if power >= POWER_IDLE_W:
                return True
        status = self.get(cfg.get("status"))
        if status is not None and str(status.state).lower() not in UNKNOWN_STATES:
            seen = True
            if is_charging_value(status.state):
                return True
        return False if seen else None

    def command_missing(self, cfg=None):
        """The command entity does not exist or is unavailable (a button or select may legitimately read 'unknown')."""
        state = self.get((cfg or self.config).get("control"))
        return state is None or str(state.state).lower() == "unavailable"

    def command_excused(self):
        """A Start that changes nothing is normal when the car is unplugged or full: nothing is left to put back."""
        battery = self.battery()
        return self.plugged() is False or (battery["soc"] is not None and battery["soc"] >= 100)

    # -- readings
    def entity(self, logical):
        return vehicle_entity(self.runtime, logical)

    def _exclude(self):
        return [self.runtime.config.get("battery_entity"), self.entity("lock.doors")]

    def car_entities(self):
        """The Companion vehicle's own entities: its door lock and every entity of the car's device. Never a charger control."""
        lock = self.entity("lock.doors")
        out = {lock}
        try:
            from homeassistant.helpers import entity_registry as er
            registry = er.async_get(self.hass)
            found = registry.async_get(lock)
            if found is not None and found.device_id:
                out |= {e.entity_id for e in er.async_entries_for_device(registry, found.device_id)}
        except Exception:  # noqa: BLE001 - without the registry the door lock alone is still excluded
            pass
        return out

    def get(self, entity):
        return self.hass.states.get(entity) if entity else None

    def target(self):
        try:
            return max(0, min(100, int(float(self.runtime.config.get("charge_target") or 0))))
        except (TypeError, ValueError):
            return 0

    def usable_target(self):
        """The target the limit acts on. 100% (or more) can never stop a charge, so it counts as no target at all."""
        target = self.target()
        return 0 if target >= 100 else target

    def battery(self):
        state = self.get(self.entity("sensor.battery_level"))
        try:
            soc = float(state.state)
        except (AttributeError, TypeError, ValueError):
            soc = None
        report = None
        pc = getattr(self.runtime, "preconditioning", None)
        if pc is not None:
            try:
                report = pc.report_time()
            except Exception:  # noqa: BLE001
                report = None
        if report is None:
            stamp = getattr(state, "last_reported", None) or getattr(state, "last_updated", None)
            report = stamp.timestamp() if stamp is not None and hasattr(stamp, "timestamp") else None
        fresh = soc is not None and report is not None and 0 <= self.clock() - report <= FRESH
        return {"soc": soc, "fresh": fresh, "age": None if report is None else self.clock() - report}

    def plugged(self):
        state = self.get(self.entity("binary_sensor.charger_plugged"))
        if state is None or str(state.state).lower() in UNKNOWN_STATES:
            return None
        return state.state == "on"

    def plug_unknown_long(self):
        """True when the plug sensor has been missing or unknown for more than PLUG_UNKNOWN seconds (Health reports it)."""
        since = self.state.get("plugged_unknown_since")
        return since is not None and self.clock() - since > PLUG_UNKNOWN

    def charging(self):
        state = self.get(self.entity("binary_sensor.charging"))
        on = state is not None and state.state == "on"
        power = self.power()
        return on or (power is not None and power >= POWER_IDLE_W)

    def power(self):
        """The charger's power in watts (kW and mW are converted, no unit counts as W), None when unknown."""
        return scaled(self.get(self.config["power"]), POWER_UNITS)

    def energy_kwh(self):
        """The energy sensor in kWh (Wh is converted, no unit counts as kWh), None when unknown."""
        return scaled(self.get(self.config["energy"]), ENERGY_UNITS)

    def energy_is_total(self):
        """True when the chosen energy sensor looks like a lifetime counter (it would show a wrong 'kWh this charge')."""
        state = self.get(self.config["energy"])
        if state is None:
            return False
        attrs = getattr(state, "attributes", None) or {}
        text = (str(self.config["energy"]) + " " + str(attrs.get("friendly_name") or "")).lower()
        session = bool(SESSION.search(text))  # a session counter (Tuya 'Session energy') may be total_increasing but resets every charge
        return (attrs.get("state_class") == "total_increasing" and not session) or bool(TOTAL.search(text) and not session)

    def energy_reading(self):
        """The energy of this charge: the live sensor, or the reading kept when the limit stopped the charger."""
        live = self.energy_kwh()
        return live if live is not None else self.state.get("energy_at_stop")

    def control_state(self):
        """True when the control is in its 'charging stopped' position, False when charging is allowed, None unknown."""
        if self.command(self.config):
            if self.command_missing():
                return None
            charging = self.command_charging()
            return bool(self.state["engaged"]) if charging is None else not charging
        on = is_on(self.get(self.config["control"]))
        return None if on is None else on == self.config["on_stops"]

    # -- the decision
    def phase(self):
        cfg, st = self.config, self.state
        if cfg["mode"] == "off":
            return "off"
        control = self.get(cfg["control"])
        if control is None or str(control.state).lower() in (("unavailable",) if self.command(cfg) else UNKNOWN_STATES):
            return "unavailable"
        if st["engaged"] and self.plug_unknown_long():
            return "unavailable"  # the plug sensor has been unknown for a long time while a stop is held
        if st["failed"]:
            return "failed"
        if st["manual"]:
            return "paused"
        if st["engaged"]:
            return "stopped"
        if st["dry_done"]:
            return "would_stop"
        if self.usable_target() <= 0:
            return "no_target"
        return "waiting"

    async def _tick_cb(self, _now=None):
        await self.evaluate()

    async def _changed(self, _event):
        if self.stopped:
            return
        self._spawn(self.evaluate())

    async def evaluate(self):
        if self.lock.locked():
            self.again = True
            return
        async with self.lock:
            try:
                await self._evaluate()
                while self.again and not self.stopped:
                    self.again = False
                    await self._evaluate()
            except Exception:  # noqa: BLE001 - the charger must never break the vehicle
                _LOGGER.exception("Charger limit for %s failed", self.runtime.vehicle)

    async def _evaluate(self):
        cfg, st, now = self.config, self.state, self.clock()
        before = dict(st)
        plugged = self.plugged()
        if st["release_pending"] and not st["engaged"] and (not st["manual"] or st.get("release_wanted")):
            await self._retry_release()
        if plugged is True and not st["session"]:
            st["session"] = now
        if plugged is None:
            if st.get("plugged_unknown_since") is None:
                st["plugged_unknown_since"] = now
        else:
            st["plugged_unknown_since"] = None
        if plugged is False:
            if st["engaged"]:
                await self.release("unplugged")
            st.update(session=None, manual=False, dry_done=False, failed=None, reached_since=None, engaged=False, energy_at_stop=None)
        elif plugged is None:
            pass
        elif cfg["mode"] != "live" and st["engaged"]:
            await self.release("mode")
        elif cfg["mode"] != "off" and self.control_state() is not None:
            await self._decide(now)
        if st != before:
            await self.persist()

    async def _decide(self, now):
        cfg, st = self.config, self.state
        target, battery = self.usable_target(), self.battery()
        soc = battery["soc"]
        control = self.control_state()
        # the owner restarted the charger by hand after our stop: never fight them
        if st["engaged"] and control is False and now > st["expect_until"]:
            st.update(engaged=False, manual=True, reached_since=None)
            await self.say("paused")
            return
        if st["engaged"]:
            if target <= 0 or (battery["fresh"] and soc is not None and soc < target and target != st["engaged_target"]):
                await self.release("target")
            return
        if st["manual"] or st["failed"] or st["dry_done"] or target <= 0:
            return
        reached = battery["fresh"] and soc is not None and soc >= target and self.charging()
        if not reached:
            st["reached_since"] = None
            return
        if st["reached_since"] is None:
            st["reached_since"] = now
        if now - st["reached_since"] < HOLD:
            return
        if cfg["mode"] == "dry":
            st["dry_done"] = True
            await self.say("would_stop", target)
            return
        await self.stop_charging(target)

    # -- what the alerts need to know (see NotificationEngine.limit_vars)
    def delivers(self):
        """True when the limit will tell the phones itself: the master switch is on and an alert (or Live climate) has a phone.
        When it cannot, the normal alerts must stay as they are."""
        engine = getattr(self.runtime, "notifications", None)
        return engine is not None and bool(engine.config.get("enabled", True)) and bool(recipients(engine.config))

    def holds(self):
        """The charger is stopped on purpose (also while putting it back is still pending)."""
        return bool(self.state["engaged"] or self.state["release_pending"] or self.phase() == "stopped")

    def stopping(self):
        """Stopped on purpose, or about to be: live, a usable target, the battery there while charging, and nothing that makes the limit stand back."""
        if self.holds():
            return True
        st = self.state
        if self.config["mode"] != "live" or st["manual"] or st["failed"] or self.usable_target() <= 0 or self.plugged() is False or self.control_state() is None:
            return False
        battery = self.battery()
        return bool(battery["fresh"] and battery["soc"] is not None and battery["soc"] >= self.usable_target() and self.charging())

    # -- the charger
    async def send(self, stop, config=None):
        cfg = config or self.config
        domain = cfg["control"].split(".")[0]
        if domain == "select":
            option = cfg.get("stop_option") if stop else cfg.get("start_option")
            if not option:
                raise ValueError("The charger's stop and start options are not set")
            await self.call("select", "select_option", {"entity_id": cfg["control"], "option": option})
            return
        if domain == "button":
            target = cfg["control"] if stop else cfg.get("start_button")
            if not target:
                raise ValueError("The charger's start button is not set")
            await self.call("button", "press", {"entity_id": target})
            return
        on = stop == cfg["on_stops"]
        if domain == "lock":
            service = "lock" if on else "unlock"
        else:
            service = "turn_on" if on else "turn_off"
        await self.call(domain, service, {"entity_id": cfg["control"]})

    async def stop_charging(self, target):
        st, error = self.state, "no answer"
        for attempt in range(1, MAX_ATTEMPTS + 1):
            # saved before the command goes out: if Home Assistant stops in between, the next start still knows to release
            st.update(engaged=True, engaged_target=target, engaged_at=self.clock(), expect_until=self.clock() + EXPECT)
            await self.persist()
            try:
                await self.send(True)
                if await self.confirmed():
                    st["reached_since"] = None
                    st["energy_at_stop"] = self.energy_kwh()
                    await self.say("stopped", target)
                    return
                error = "The charger did not stop"
            except Exception as exc:  # noqa: BLE001 - a failed service call is reported, never raised
                error = str(exc)[:200] or "The command failed"
            if self.control_state() is False:  # confirmed not stopped: nothing is engaged any more
                st["engaged"] = False
                await self.persist()
            if attempt < MAX_ATTEMPTS:
                await self.sleep(RETRY_DELAY)
        st["failed"] = error
        await self.release("failed", quiet=True)
        await self.say("failed", error)

    async def confirmed(self):
        deadline = self.clock() + VERIFY
        while True:
            if self.control_state() is True:
                power = self.power()
                if self.config["power"] is None or power is None or power < POWER_IDLE_W:
                    return True
            if self.clock() >= deadline:
                return False
            await self.sleep(POLL)

    async def release(self, reason, *, quiet=False, config=None):
        """Put the control back to 'charging allowed'. Only ever called for a stop that Companion engaged (or a pending one).
        If the control cannot be confirmed as released, it is kept as 'release pending' and tried again on every check."""
        st, cfg = self.state, config or self.config
        st["expect_until"] = self.clock() + EXPECT
        st["engaged"] = False
        st["engaged_target"] = None
        released = await self._release_control(cfg)
        was_pending = st["release_pending"]
        st["release_pending"] = not released
        st["release_config"] = None if released else {k: cfg.get(k) for k in ("control", "on_stops", "stop_option", "start_option", "start_button", "power", "status")}
        await self.persist()
        if not released and not was_pending:
            await self.say("release_pending")
        if not quiet and reason in ("target", "unplugged", "mode", "settings"):
            await self.say("released", {"target": "The charging target changed, so charging may continue.",
                                        "unplugged": "The car was unplugged.",
                                        "mode": "The charger limit is no longer live.",
                                        "settings": "The charger settings changed."}[reason])

    async def _release_control(self, cfg):
        """Send 'charging allowed' and check it. True when the control reads 'charging allowed' (or there is no control).
        A control that cannot be read is not sent to: it stays pending until it reads again."""
        if not cfg.get("control"):
            return True
        if self.command(cfg):
            return await self._release_command(cfg)
        error = "no answer"
        for attempt in range(1, MAX_ATTEMPTS + 1):
            reading = is_on(self.get(cfg["control"]))
            if reading is None:
                return False
            if reading != cfg["on_stops"]:
                return True
            try:
                await self.send(False, cfg)
                if await self._reads_allowed(cfg):
                    return True
                error = "The charger did not change"
            except Exception as exc:  # noqa: BLE001 - a failed release is kept pending, never raised
                error = str(exc)[:200] or "The command failed"
            if attempt < MAX_ATTEMPTS:
                await self.sleep(RETRY_DELAY)
        _LOGGER.warning("Charger limit could not release %s: %s", cfg["control"], error)
        return False

    async def _release_command(self, cfg):
        """Send the start command and watch the power and status sensors. Start is only ever sent here, for a stop that was engaged.
        When the car is unplugged or full a Start that changes nothing (or errors) is logged once and counts as released."""
        if self.command_missing(cfg):
            return False
        if self.command_charging(cfg) is True:
            return True
        error = "no answer"
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                await self.send(False, cfg)
                if self.command_excused() or await self._reads_allowed(cfg):
                    return True
                error = "The charger did not start"
            except Exception as exc:  # noqa: BLE001 - a failed release is kept pending, never raised
                error = str(exc)[:200] or "The command failed"
                if self.command_excused():
                    _LOGGER.info("Charger limit: Start did nothing on %s (the car is unplugged or full): %s", cfg["control"], error)
                    return True
            if attempt < MAX_ATTEMPTS:
                await self.sleep(RETRY_DELAY)
        _LOGGER.warning("Charger limit could not release %s: %s", cfg["control"], error)
        return False

    async def _reads_allowed(self, cfg):
        """True when the control reads 'charging allowed' within the verify time (a command charger: when it delivers again)."""
        deadline = self.clock() + VERIFY
        if self.command(cfg):
            while True:
                if self.command_charging(cfg) is not False:
                    return True
                if self.clock() >= deadline:
                    return False
                await self.sleep(POLL)
        while True:
            reading = is_on(self.get(cfg["control"]))
            if reading is not None and reading != cfg["on_stops"]:
                return True
            if self.clock() >= deadline:
                return False
            await self.sleep(POLL)

    async def _retry_release(self):
        """A release that failed earlier: try again. Only ever for the control that was engaged (kept with the flag)."""
        st = self.state
        cfg = st.get("release_config") or {}
        if not cfg.get("control") or await self._release_control(cfg):
            st.update(release_pending=False, release_config=None, release_wanted=False)

    async def resume(self):
        """'Charge anyway': let the charger charge now and leave the limit alone until the next plug-in."""
        async with self.lock:
            st = self.state
            if st["engaged"] or st["release_pending"]:
                await self.release("resume", quiet=True)
            # a release that failed again inside "Charge anyway" is still wanted: it keeps being retried (never for a stop the owner made)
            st.update(manual=True, failed=None, reached_since=None, release_wanted=bool(st["release_pending"]))
            await self.persist()
        return self.snapshot()

    # -- messages
    def tx(self, text, *args):
        out = tr(self.hass, text) if isinstance(text, str) else text
        for index, value in enumerate(args):
            out = str(out).replace("{%d}" % index, str(value))
        return out

    async def say(self, kind, *args):
        title, severity, icon = ACTIVITY[kind]
        title = self.tx(title, *args)
        message = self.tx(PHONE[kind], *(self.tx(a) if isinstance(a, str) else a for a in args))
        self.state["last"] = {"kind": kind, "time": self.clock(), "title": title}
        _LOGGER.info("Charger limit %s: %s", kind, title)
        engine = getattr(self.runtime, "notifications", None)
        deliveries = []
        if engine is not None and engine.config.get("enabled", True):
            send = self.notifier or engine.send_to_recipient
            devices = recipients(engine.config)
            payload = {"title": title, "message": message, "data": {"notification_icon": icon, "group": "deepal_companion_charger"}}
            # Quiet hours of the alerts: the message still goes out (the stop already happened), but passive and without sound. A failure stays loud.
            quiet = getattr(engine, "limit_quiet", None)
            if severity != "critical" and callable(quiet) and quiet():
                apply_silent(payload["data"])
            for device in devices:
                try:
                    await send(device, payload)
                    deliveries.append({"device": device, "status": "accepted"})
                except Exception as exc:  # noqa: BLE001
                    deliveries.append({"device": device, "status": "error", "error": str(exc)[:200]})
        if engine is not None and hasattr(engine, "record"):
            rule = {"id": "charger_limit", "name": "Charger limit", "severity": severity, "data": {"notification_icon": icon}}
            status = "error" if severity == "critical" else ("sent" if deliveries else "charger_limit")
            details = {"title": title, "message": message}
            if deliveries:
                details["deliveries"] = deliveries
            try:
                await engine.record(rule, status, **details)
                await engine.persist()
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Charger limit activity could not be recorded")

    # -- the page
    def snapshot(self):
        cfg, st = self.config, self.state
        control = self.get(cfg["control"])
        device = None
        try:
            from homeassistant.helpers import device_registry as dr
            found = dr.async_get(self.hass).async_get(cfg["device_id"]) if cfg["device_id"] else None
            device = (found.name_by_user or found.name) if found else None
        except Exception:  # noqa: BLE001
            device = None
        battery = self.battery()
        return {"config": deepcopy(cfg), "phase": self.phase(), "target": self.target(), "soc": battery["soc"], "plugged": self.plugged(),
                "charging": self.charging(), "control": {"entity": cfg["control"], "state": getattr(control, "state", None),
                "name": (control.attributes or {}).get("friendly_name") if control is not None else None}, "device": device,
                "failed": st["failed"], "last": st["last"], "engaged": st["engaged"], "now": self.clock(),
                "power_w": self.power(), "energy_kwh": self.energy_reading(),
                "target_full": self.target() >= 100, "control_guess": bool(st.get("control_guess")), "command": self.command_info()}

    def command_info(self):
        """What the page shows for a select or button control: the stop and start command, and whether both were identified."""
        cfg = self.config
        if not self.command(cfg):
            return None
        if cfg["control"].startswith("select."):
            options = [str(o) for o in (getattr(self.get(cfg["control"]), "attributes", None) or {}).get("options") or []]
            return {"kind": "select", "stop": cfg["stop_option"], "start": cfg["start_option"], "identified": bool(cfg["stop_option"] and cfg["start_option"]),
                    "options": options, "buttons": []}
        buttons = [e for e in self.entities_of(cfg["device_id"], "button")] if cfg["device_id"] else []
        name = lambda entity: next((b["name"] for b in buttons if b["entity"] == entity), entity)  # noqa: E731
        return {"kind": "button", "stop": name(cfg["control"]), "start": name(cfg["start_button"]) if cfg["start_button"] else None,
                "identified": bool(cfg["start_button"]), "options": [], "buttons": buttons}

    def devices(self):
        return list_devices(self.hass, self._exclude())

    def choices(self):
        """The lists the settings page offers (administrators only): every lock, switch and input_boolean, and the power and energy sensors."""
        return {"all_controls": controls(self.hass, self.car_entities()), "power_sensors": sensors(self.hass, "power"), "energy_sensors": sensors(self.hass, "energy")}

    def entities_of(self, device_id, only=None):
        """The lock, switch and command entities of a device, for the 'Stop control' list (only='button': every button, for the pickers)."""
        out = []
        for entry in device_entries(self.hass, device_id):
            domain = entry["entity_id"].split(".")[0]
            if (domain == only) if only else (domain in CONTROL_DOMAINS or _is_command(self.hass, entry["entity_id"], entry["name"])):
                state = self.get(entry["entity_id"])
                name = (state.attributes or {}).get("friendly_name") if state is not None else None
                out.append({"entity": entry["entity_id"], "name": name or entry["name"] or entry["entity_id"]})
        return out
