"""HA state subscriptions, entity resolution and serialized archive writes."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import json
import logging
import re
import time

from homeassistant.core import callback
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.util import dt as dt_util

from .charging import ChargingEngine, number
from .const import DEFAULT_PROFILES, DOMAIN, ENERGY_KEYS, SIGNAL
from .pricing import calculate

_LOGGER = logging.getLogger(__name__)


class VehicleRuntime:
    def __init__(self, hub, entry):
        self.hub, self.hass, self.entry = hub, hub.hass, entry
        self.vehicle = entry.unique_id
        self.unsubs = []
        self.queue = asyncio.Queue()
        self.worker = None
        self.engine = None
        self.entities = {}
        self.last_states = {}
        self.charger_entities = set()
        self.price_cache = {}
        self._pricing_lock = asyncio.Lock()
        self._summary_lock = asyncio.Lock()
        self._summary_revision = 0
        self._summary_cache = None
        self._last_signal = 0
        self._next_maintenance = 0
        self._stopped = False

    async def start(self):
        opts = {**self.entry.data, **self.entry.options}
        registry = er.async_get(self.hass)
        anchor = registry.async_get(opts["battery_entity"]) or next(
            (e for e in registry.entities.values() if e.id == self.entry.unique_id), None)
        battery = anchor.entity_id if anchor else opts["battery_entity"]
        config = {"prefix": opts["prefix"], "battery_entity": battery,
                  "entities": {"sensor.battery_level": battery}}
        for key in ("powertrain", "car_color", "iso_wheels"):
            if key in opts:
                config[key] = opts[key]
        await self.hub.db("ensure_vehicle", self.vehicle, opts["name"], config)
        self.engine = ChargingEngine(await self.hub.db("get", self.vehicle, "engine"))
        await self.refresh()
        self.worker = self.hass.async_create_background_task(self._work(), "Deepal Companion archive " + self.vehicle)
        self.unsubs.append(async_track_time_interval(self.hass, self._tick, timedelta(minutes=1)))
        self.unsubs.append(self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._shutdown))
        self._tick(dt_util.utcnow())
        from .notifications import NotificationEngine
        self.notifications = NotificationEngine(self)
        await self.notifications.start()

    async def _shutdown(self, _event):
        await self.stop()

    async def refresh(self):
        self._summary_revision += 1
        cfg = (await self.hub.db("config", self.vehicle))["config"]
        self.config = cfg
        registry = er.async_get(self.hass)
        anchor = registry.async_get(self.entities.get("batt", self.entry.options.get("battery_entity", self.entry.data["battery_entity"]))) or next(
            (e for e in registry.entities.values() if e.id == self.entry.unique_id), None)
        candidates = [e for e in registry.entities.values() if anchor and e.device_id == anchor.device_id and e.device_id]
        self.entities = {}
        for role, key in ENERGY_KEYS.items():
            if key in cfg.get("entities", {}):
                self.entities[role] = cfg["entities"][key]
                continue
            domain, suffix = key.split(".", 1)
            direct = domain + "." + cfg["prefix"] + "_" + suffix
            translation = "connected" if suffix == "cloud_connection" else suffix
            match = next((e.entity_id for e in candidates if e.domain == domain and e.translation_key == translation), None)
            self.entities[role] = direct if self.hass.states.get(direct) else match or direct
        # Optional live timer follows the same vehicle and user entity mappings.
        remaining_suffixes = ("remaining_charge_time_h_mm", "remaining_charge_time_hhmm", "remaining_charge_time_formatted", "remaining_charge_time")
        mapped = next((cfg.get("entities", {}).get("sensor." + suffix) for suffix in remaining_suffixes if cfg.get("entities", {}).get("sensor." + suffix)), None)
        direct = next(("sensor." + cfg["prefix"] + "_" + suffix for suffix in remaining_suffixes if self.hass.states.get("sensor." + cfg["prefix"] + "_" + suffix)), None)
        match = next((e.entity_id for e in candidates if e.domain == "sensor" and e.translation_key in remaining_suffixes), None)
        self.live_entities = {"remaining": mapped or direct or match}
        costs = await self.hub.db("get", self.vehicle, "costs", {})
        profiles = list(costs.get("profiles", [])) + [r.get("profile", {}) for r in costs.get("sessions", {}).values()]
        self.charger_entities = {p["entity"] for p in profiles if p.get("entity") and p.get("source") != "battery"}
        if hasattr(self, "state_unsub"):
            self.state_unsub()
        ids = list(set(self.entities.values()) | self.charger_entities)
        self.state_unsub = async_track_state_change_event(self.hass, ids, self._event)

    @callback
    def _event(self, event):
        if self._stopped:
            return
        state = event.data.get("new_state")
        if state:
            old = event.data.get("old_state")
            if old and old.state == state.state and old.attributes.get("unit_of_measurement", "") == state.attributes.get("unit_of_measurement", ""):
                return
            self.queue.put_nowait((dt_util.utcnow().timestamp(), state.entity_id, state.state,
                                   state.attributes.get("unit_of_measurement", ""), self.snapshot()))

    @callback
    def _tick(self, _now):
        if self._stopped:
            return
        self.queue.put_nowait((dt_util.utcnow().timestamp(), None, None, "", self.snapshot()))

    def snapshot(self):
        values = {}
        for role, entity in self.entities.items():
            state = self.hass.states.get(entity)
            values[role] = state.state if state and not state.attributes.get("restored") else None
        return values

    def capacity(self):
        explicit = number(self.config.get("battery_kwh"))
        if explicit and explicit > 0:
            return explicit
        ev = self.config.get("powertrain") == "ev"
        if self.config.get("powertrain", "auto") == "auto":
            ev = not self.hass.states.get(self.entities["fuel"]) and not self.hass.states.get(
                "sensor." + self.config["prefix"] + "_fuel_range")
        return 68.8 if ev else 18.4

    def _sample(self, entity, now, state, unit, samples, pending):
        previous = self.last_states.get(entity)
        # State changes suffice for vehicle history. Charger readings also keep a
        # five-minute heartbeat so constant power/energy can be integrated safely.
        changed = previous is None or previous[:2] != (str(state), unit)
        heartbeat = entity in self.charger_entities and (previous is None or now - previous[2] >= 300)
        if changed or heartbeat:
            samples.append((entity, now, state, unit))
            pending[entity] = (str(state), unit, now)

    async def _work(self):
        while True:
            item = await self.queue.get()
            previous_engine = deepcopy(self.engine.state)
            try:
                if item is None:
                    return
                now, entity, state, unit, values = item
                samples, pending = [], {}
                if entity:
                    self._sample(entity, now, state, unit, samples, pending)
                else:
                    # Heartbeats preserve known constant readings and prevent false history gaps.
                    for eid in set(self.entities.values()) | self.charger_entities:
                        obj = self.hass.states.get(eid)
                        if obj:
                            self._sample(eid, now, obj.state, obj.attributes.get("unit_of_measurement", ""), samples, pending)
                ac, dc = number(values.get("ac")), number(values.get("dc"))
                currents = [v for v in (ac, dc) if v is not None]
                charging = any(v > .5 for v in currents) if currents else (
                    True if values.get("charging") == "on" else False if values.get("charging") == "off" else None)
                if values.get("cloud") in {"off", "unknown", "unavailable"}:
                    charging = None
                sessions = self.engine.feed(now, values.get("batt"), charging, self.capacity(), dc is not None and dc > .5)
                curve_entities = {key: self.entities.get(role) for key, role in (("ac", "ac"), ("dc", "dc"), ("battery", "batt"))}
                for session in sessions:
                    session.setdefault("curve_entities", curve_entities)
                if self.engine.state.get("session"):
                    self.engine.state["session"].setdefault("curve_entities", curve_entities)
                await self.hub.db("record_update", self.vehicle, samples, sessions, self.engine.state)
                self.last_states.update(pending)
                closed = any(not session["live"] for session in sessions)
                if closed:
                    self._summary_revision += 1
                clock = time.monotonic()
                if closed or clock - self._last_signal >= 1:
                    self._last_signal = clock
                    async_dispatcher_send(self.hass, SIGNAL, self.vehicle)
            except asyncio.CancelledError:
                raise
            except Exception:
                self.engine.state = previous_engine
                _LOGGER.exception("Could not record Companion data for %s", self.vehicle)
            finally:
                self.queue.task_done()
            if item is not None and item[1] is None:
                await self._maintain_storage()

    async def _maintain_storage(self):
        """Keep maintenance bounded and separate from committed charging state."""
        clock = time.monotonic()
        if clock < self._next_maintenance:
            return
        self._next_maintenance = clock + 3600
        try:
            result = await self.hub.db("maintain_storage", self.vehicle)
            if result["more"]:
                self._next_maintenance = clock + 60
        except Exception:
            _LOGGER.exception("Companion storage maintenance could not complete")

    async def stop(self):
        if self._stopped:
            return
        self._stopped = True
        if hasattr(self, "notifications"):
            await self.notifications.stop()
        for unsubscribe in self.unsubs:
            unsubscribe()
        self.unsubs.clear()
        if hasattr(self, "state_unsub"):
            self.state_unsub()
            del self.state_unsub
        if self.worker:
            await self.queue.join()
            self.queue.put_nowait(None)
            await self.worker
            self.worker = None
        if self.engine:
            await self.hub.db("put", self.vehicle, "engine", self.engine.state)
        self.price_cache.clear()
        self.last_states.clear()
        self._summary_cache = self._dashboard_cache = None

    async def priced_sessions(self, start=None, end=None):
        async with self._pricing_lock:
            return await self._priced_sessions(start, end)

    async def session_page(self, before=None, limit=5, location="", sort="newest"):
        async with self._pricing_lock:
            if sort in {"highest", "lowest"}:
                key = (self._summary_revision, int(time.time() // 60))
                if getattr(self, "_cost_index_key", None) != key:
                    rows = await self._priced_sessions()
                    await self.hub.db("index_session_costs", self.vehicle, rows)
                    self._cost_index_key = key
            result = await self.hub.db("session_page", self.vehicle, before, limit, location, sort)
            result["rows"] = await self._priced_sessions(rows=result["rows"])
            return result

    async def charging_dashboard(self, start=None, end=None):
        key = (self._summary_revision, int(time.time() // 60), start, end)
        if getattr(self, "_dashboard_cache", None) and self._dashboard_cache[0] == key:
            return deepcopy(self._dashboard_cache[1])
        rows = [row for row in await self.priced_sessions() if not row["live"]]
        priced = [row for row in rows if row["pricing"].get("cost") is not None]
        from datetime import datetime, timezone
        buckets = {}
        for row in rows:
            day = dt_util.as_local(datetime.fromtimestamp(row["s"] / 1000, timezone.utc)).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
            if (start is not None and row['s'] < start*1000) or (end is not None and row['s'] > end*1000) or (start is None and time.time()*1000-day > 31*86400000):
                continue
            bucket = buckets.setdefault(day, {"s": day, "live": False, "pricing": {"energy": 0, "cost": 0}, "unpriced_count": 0})
            energy = row["pricing"].get("energy")
            bucket["pricing"]["energy"] += energy if energy is not None else row.get("kwh") or 0
            if row["pricing"].get("cost") is None:
                bucket["unpriced_count"] += 1
            else:
                bucket["pricing"]["cost"] += row["pricing"]["cost"]
        result = {"total": len(rows), "priced": len(priced), "unpriced": len(rows)-len(priced),
                  "cost": sum(row["pricing"]["cost"] for row in priced),
                  "energy": sum(row["pricing"].get("energy") if row["pricing"].get("energy") is not None else row.get("kwh") or 0 for row in rows),
                  "chart_rows": list(buckets.values())}
        self._dashboard_cache = (key, deepcopy(result))
        return result

    async def _priced_sessions(self, start=None, end=None, rows=None):
        if rows is None:
            rows = await self.hub.db("sessions", self.vehicle, start, end)
        settings = await self.hub.db("get", self.vehicle, "costs", {})
        assignments = settings.get("sessions", {})
        pending, requests = [], []
        cache_ids = {row["id"] for row in rows[-1000:]}
        for row in rows:
            record = assignments.get(str(int(row["s"] / 1000 + .5)))
            if row.get("recovered_pricing") and row.get("recovered_assignment") == record:
                row["pricing"], row["assignment"] = row["recovered_pricing"], record
                continue
            fingerprint = json.dumps([row, record], sort_keys=True)
            cached = self.price_cache.get(row["id"])
            if not row["live"] and cached and cached[0] == fingerprint:
                row["pricing"], row["assignment"] = cached[1], record
                continue
            profile = record.get("profile", {}) if record else {}
            entity = profile.get("entity") if record and profile.get("source") != "battery" and record.get("energy") is None else None
            pending.append((row, record, fingerprint, entity))
            if entity:
                requests.append((row["id"], entity, row["s"] / 1000 - 1200, row["e"] / 1000))
        inputs = await self.hub.db("pricing_inputs", self.vehicle, requests) if requests else {}
        for row, record, fingerprint, entity in pending:
            data = inputs.get(row["id"], {})
            readings, unit = data.get("readings", []), data.get("unit", "")
            if entity and not unit:
                state = self.hass.states.get(entity)
                unit = state.attributes.get("unit_of_measurement", "") if state else ""
            row["pricing"] = calculate(row, record, readings, unit)
            row["assignment"] = record
            if not row["live"] and row["id"] in cache_ids:
                self.price_cache[row["id"]] = (fingerprint, row["pricing"])
                if len(self.price_cache) > 1000:
                    del self.price_cache[next(iter(self.price_cache))]
        return rows

    async def summary_values(self):
        """The four sensors share one calculation per completed-data revision."""
        async with self._summary_lock:
            revision = self._summary_revision
            if self._summary_cache and self._summary_cache[0] == revision:
                return dict(self._summary_cache[1])
            rows = [row for row in await self.priced_sessions() if not row["live"]]
            values = {"sessions": len(rows), "battery_kwh": round(sum(row.get("kwh") or 0 for row in rows), 4),
                      "cost": round(sum(row["pricing"]["cost"] or 0 for row in rows), 4),
                      "unpriced": sum(row["pricing"]["cost"] is None for row in rows)}
            if revision == self._summary_revision:
                self._summary_cache = (revision, values)
            return dict(values)
