"""HA state subscriptions, entity resolution and serialized archive writes."""
from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
import json
import logging
import re
import sqlite3
import time

from homeassistant.core import callback
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.util import dt as dt_util

from .charging import ChargingEngine, number
from .const import DEFAULT_PROFILES, DEFAULT_SPIKE_JUMP, DOMAIN, ENERGY_KEYS, RANGES, SIGNAL
from .pricing import calculate
from .health import BACKLOG_LIMIT

_LOGGER = logging.getLogger(__name__)

QUEUE_SOFT_LIMIT = 2000   # above this, heartbeats and readings the charging engine does not use are dropped
QUEUE_HARD_LIMIT = 20000  # absolute ceiling for the archive queue
WRITE_ATTEMPTS = 4        # a failing archive write is tried this many times when the error looks temporary
WRITE_RETRY_DELAY = 0.5   # seconds before the first retry; doubles each time
NO_VALUE = {"unavailable", "unknown", "none", ""}
TRANSIENT_WRITE_ERRORS = (sqlite3.OperationalError, OSError)  # locked or busy database, disk hiccups
ENGINE_ROLES = ("batt", "ac", "dc", "charging", "cloud")  # readings the charging engine decides on


def usable(value):
    return value is not None and str(value).strip().lower() not in NO_VALUE


class BoundedQueue(asyncio.Queue):
    """Archive queue with a ceiling. When it is full, heartbeats and readings of sensors the charging engine
    does not use are dropped first; charging-relevant readings are dropped only at the hard limit."""

    def __init__(self, soft, hard, critical):
        super().__init__()
        self.soft, self.hard, self.critical, self.dropped = soft, hard, critical, 0

    def _put(self, item):
        size = len(self._queue)
        if size >= self.soft:
            critical = self.critical()
            victim = next((i for i, queued in enumerate(self._queue)
                           if queued is not None and (queued[1] is None or queued[1] not in critical)), None)
            if victim is None and size >= self.hard:
                victim = next((i for i, queued in enumerate(self._queue) if queued is not None), None)
            if victim is not None:
                del self._queue[victim]
                self._unfinished_tasks -= 1
                self.dropped += 1
        self._queue.append(item)


class VehicleRuntime:
    def __init__(self, hub, entry):
        self.hub, self.hass, self.entry = hub, hub.hass, entry
        self.vehicle = entry.unique_id
        self.unsubs = []
        self.queue = BoundedQueue(QUEUE_SOFT_LIMIT, QUEUE_HARD_LIMIT, self._critical_entities)
        self._reported_drops = 0
        self._seen = {}  # role -> last state a sensor reported; lets a good value survive a temporary 'unavailable'
        self.worker = None
        self.stop_timeout = 4  # seconds the archive worker gets to finish before unload cancels it
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
        self._worker_failures = 0
        self._tick_pending = False  # one heartbeat tick may wait in the queue at a time
        self._backlog_high = False
        self._refresh_task = None
        self._device_id = None
        self.refresh_delay = 2  # seconds of registry quiet time before mappings are rebuilt
        self.degraded_reason = None
        self._inflight = None  # the archive write currently running in the executor, if any
        self.incomplete_wait = 8  # extra seconds, after an incomplete drain, for that write to finish (proposed; owner to confirm)
        self.marker_timeout = 4  # seconds allowed for the interrupted-shutdown marker; it bypasses hub.db's lock on purpose

    async def start(self) -> None:
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
        marker = await self.hub.db("get", self.vehicle, "archive_incomplete_shutdown")
        if marker:
            # Kept until a reconciliation step has checked the archive; it is never cleared automatically.
            _LOGGER.warning("Companion for %s found an interrupted shutdown marker from %s; it is kept for reconciliation",
                            self.vehicle, marker.get("at"))
        await self.refresh()
        self.worker = self.hass.async_create_background_task(self._work(), "Deepal Companion archive " + self.vehicle)
        self.unsubs.append(async_track_time_interval(self.hass, self._tick, timedelta(minutes=1)))
        self.unsubs.append(self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._registry_event))
        self._stop_unsub = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, self._shutdown)
        self.unsubs.append(self._stop_unsub)
        self._tick(dt_util.utcnow())
        from .notifications import NotificationEngine
        self.notifications = NotificationEngine(self)
        await self.notifications.start()

    async def _shutdown(self, _event):
        # A fired listen_once listener is already removed by Home Assistant; unsubscribing it again logs an error.
        stop_unsub = getattr(self, "_stop_unsub", None)
        if stop_unsub in self.unsubs:
            self.unsubs.remove(stop_unsub)
        await self.stop()

    async def refresh(self) -> None:
        self._summary_revision += 1
        cfg = (await self.hub.db("config", self.vehicle))["config"]
        self.config = cfg
        registry = er.async_get(self.hass)
        anchor = registry.async_get(self.entities.get("batt", self.entry.options.get("battery_entity", self.entry.data["battery_entity"]))) or next(
            (e for e in registry.entities.values() if e.id == self.entry.unique_id), None)
        candidates = [e for e in registry.entities.values() if anchor and e.device_id == anchor.device_id and e.device_id]
        self._device_id = anchor.device_id if anchor else None
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
        try:
            good = await self.hub.db("last_good_readings", self.vehicle, [e for e in self.entities.values() if e])
            for role, entity in self.entities.items():
                if usable(good.get(entity)):
                    self._seen.setdefault(role, good[entity])
        except Exception:  # seeding is a convenience; the live readings still work without it
            _LOGGER.debug("Could not restore last good readings for %s", self.vehicle, exc_info=True)

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
        if self._stopped or self._tick_pending:
            return
        self._tick_pending = True
        self.queue.put_nowait((dt_util.utcnow().timestamp(), None, None, "", self.snapshot()))

    @callback
    def _registry_event(self, event):
        if self._stopped:
            return
        data = event.data
        known = {e for e in (*self.entities.values(), *self.charger_entities, self.config.get("battery_entity")) if e}
        touched = {e for e in (data.get("entity_id"), data.get("old_entity_id")) if e}
        if touched & known or self._same_device(data.get("entity_id")):
            self._schedule_refresh()

    def _same_device(self, entity_id):
        if not entity_id or self._device_id is None:
            return False
        entry = er.async_get(self.hass).async_get(entity_id)
        return entry is not None and entry.device_id == self._device_id

    @callback
    def _schedule_refresh(self):
        if self._refresh_task and not self._refresh_task.done():
            return  # one pending refresh covers all registry changes in the quiet period
        self._refresh_task = self.hass.async_create_task(self._refresh_later())

    async def _refresh_later(self):
        await asyncio.sleep(self.refresh_delay)
        if not self._stopped:
            await self.refresh()

    def _critical_entities(self):
        return {self.entities.get(role) for role in ENGINE_ROLES} | self.charger_entities

    def snapshot(self) -> dict:
        values = {}
        for role, entity in self.entities.items():
            state = self.hass.states.get(entity)
            raw = state.state if state and not state.attributes.get("restored") else None
            previous = self._seen.get(role)
            if raw == "unavailable" and usable(previous):
                # A sensor that was fine and became unavailable (for example after a restart, until the car wakes up)
                # keeps its last good value. Any other state, or a sensor that never had a value, is passed on as is.
                values[role] = previous
                continue
            values[role] = raw
            if raw is not None:
                self._seen[role] = raw
        return values

    def spike_jump(self):
        value = number(self.config.get("charge_spike_jump"))
        low, high = RANGES["charge_spike_jump"]
        return value if value is not None and low <= value <= high else DEFAULT_SPIKE_JUMP

    def capacity(self):
        explicit = number(self.config.get("battery_kwh"))
        if explicit and explicit > 0:
            return explicit
        ev = self.config.get("powertrain") == "ev"
        if self.config.get("powertrain", "auto") == "auto":
            # At startup a fuel sensor can be registered but not loaded yet: it still means plug-in hybrid.
            registry = er.async_get(self.hass)
            ev = not any(self.hass.states.get(entity) or registry.async_get(entity)
                         for entity in (self.entities["fuel"], "sensor." + self.config["prefix"] + "_fuel_range"))
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

    async def _write(self, samples, sessions):
        """Save one batch. A temporary database error is retried with a growing delay; the write is idempotent."""
        delay = WRITE_RETRY_DELAY
        for attempt in range(1, WRITE_ATTEMPTS + 1):
            # Run the write as its own task: cancelling the worker must not lose track of a write that is still in the executor.
            write = self.hass.async_create_task(
                self.hub.db("record_update", self.vehicle, samples, sessions, self.engine.state))
            self._inflight = write
            write.add_done_callback(self._write_finished)
            try:
                await asyncio.shield(write)
                return
            except asyncio.CancelledError:
                raise
            except TRANSIENT_WRITE_ERRORS as err:
                if attempt == WRITE_ATTEMPTS:
                    raise
                _LOGGER.warning("Companion archive write for %s failed (%s); retry %s of %s", self.vehicle, err, attempt, WRITE_ATTEMPTS - 1)
                await asyncio.sleep(delay)
                delay *= 2

    def _log_backlog(self):
        if self.queue.dropped != self._reported_drops:
            self._reported_drops = self.queue.dropped
            _LOGGER.warning("Companion for %s skipped %s redundant readings while the archive was slow", self.vehicle, self._reported_drops)
        backlog = self.queue.qsize()
        if backlog > BACKLOG_LIMIT and not self._backlog_high:
            self._backlog_high = True
            _LOGGER.warning("Companion for %s has %s readings waiting to be saved", self.vehicle, backlog)
        elif backlog <= BACKLOG_LIMIT and self._backlog_high:
            self._backlog_high = False
            _LOGGER.info("Companion for %s caught up with its backlog", self.vehicle)

    async def _work(self):
        while True:
            item = await self.queue.get()
            if item is not None and item[1] is None:
                self._tick_pending = False  # cleared when taken, so a failing tick cannot block later ticks
            self._log_backlog()
            previous_engine = None
            try:
                if item is None:
                    return
                previous_engine = deepcopy(self.engine.state)
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
                # Some cars report a false DC current (400 A) at the moment an AC charge ends. A DC reading that
                # starts within 10 minutes of AC current is ignored unless the battery then rises.
                guard, ac_flow, dc_flow = self.engine.state, ac is not None and ac > .5, dc is not None and dc > .5
                if ac_flow:
                    guard["ac_last"] = now
                if not dc_flow:
                    guard.pop("dc_false", None)
                elif not guard.get("dc_on") and not ac_flow and now - guard.get("ac_last", 0) <= 600:
                    guard["dc_false"], guard["dc_base"] = True, number(values.get("batt"))
                guard["dc_on"] = dc_flow
                if guard.get("dc_false"):
                    level, base = number(values.get("batt")), guard.get("dc_base")
                    if level is not None and base is not None and level > base:
                        guard.pop("dc_false", None)
                    else:
                        dc = 0.0
                currents = [v for v in (ac, dc) if v is not None]
                charging = any(v > .5 for v in currents) if currents else (
                    True if values.get("charging") == "on" else False if values.get("charging") == "off" else None)
                if values.get("cloud") in {"off", "unknown", "unavailable"}:
                    charging = None
                sessions = self.engine.feed(now, values.get("batt"), charging, self.capacity(), dc is not None and dc > .5, self.spike_jump())
                curve_entities = {key: self.entities.get(role) for key, role in (("ac", "ac"), ("dc", "dc"), ("battery", "batt"))}
                for session in sessions:
                    session.setdefault("curve_entities", curve_entities)
                if self.engine.state.get("session"):
                    self.engine.state["session"].setdefault("curve_entities", curve_entities)
                await self._write(samples, sessions)
                self.last_states.update(pending)
                closed = any(not session["live"] for session in sessions)
                if closed:
                    self._summary_revision += 1
                clock = time.monotonic()
                if closed or clock - self._last_signal >= 1:
                    self._last_signal = clock
                    async_dispatcher_send(self.hass, SIGNAL, self.vehicle)
                self._worker_failures = 0
                self.degraded_reason = None
            except asyncio.CancelledError:
                raise
            except Exception:
                # The failed item is not recorded; restore the engine so memory matches the last committed state.
                if previous_engine is not None:
                    self.engine.state = previous_engine
                self._worker_failures += 1
                _LOGGER.exception("Could not record Companion data for %s", self.vehicle)
                if self._worker_failures >= 3 and self.degraded_reason is None:
                    self.degraded_reason = "Repeated recording failures; the item was not saved. Check the Home Assistant log."
                    _LOGGER.error("Companion recorder for %s is degraded after %s consecutive failures", self.vehicle, self._worker_failures)
            finally:
                self.queue.task_done()
            if item is not None and item[1] is None:
                await self._maintain_storage()

    def _write_finished(self, task):
        if self._inflight is task:
            self._inflight = None
        if task.cancelled():
            return
        if task.exception() is not None and self._stopped:
            _LOGGER.error("Companion archive write for %s failed after shutdown began", self.vehicle)

    async def _record_interrupted_shutdown(self):
        """A batch may still be writing, so the engine is not saved from memory.
        The last committed checkpoint stays in place and a separate marker records the interruption."""
        pending = self._inflight
        outcome = "not running"
        if pending is not None and not pending.done():
            done, _ = await asyncio.wait({pending}, timeout=self.incomplete_wait)
            outcome = "finished" if done else "still running"
        _LOGGER.warning("Companion shutdown for %s did not drain the queue; the write was %s, engine checkpoint not updated",
                        self.vehicle, outcome)
        # Written straight to the archive executor: hub.db's lock is held by the in-flight write, so waiting for it could hang stop().
        # SQLite serialises the two writes; a marker that times out may still commit later, which the log records.
        try:
            await asyncio.wait_for(self.hass.async_add_executor_job(
                self.hub.archive.put, self.vehicle, "archive_incomplete_shutdown", {"at": time.time(), "write": outcome}),
                self.marker_timeout)
        except asyncio.TimeoutError:
            _LOGGER.error("Companion could not confirm the interrupted-shutdown marker for %s within %s s",
                          self.vehicle, self.marker_timeout)

    async def _maintain_storage(self):
        """Keep maintenance bounded and separate from committed charging state."""
        clock = time.monotonic()
        if clock < self._next_maintenance:
            return
        self._next_maintenance = clock + 3600
        try:
            await self.hub.db("purge_deleted", self.vehicle)  # charges removed more than UNDO_DAYS ago
            result = await self.hub.db("maintain_storage", self.vehicle)
            if result["more"]:
                self._next_maintenance = clock + 60
        except Exception:
            _LOGGER.exception("Companion storage maintenance could not complete")

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        if self._refresh_task and not self._refresh_task.done():
            self._refresh_task.cancel()
        self._refresh_task = None
        if hasattr(self, "notifications"):
            # The notification store takes the hub lock, which a stuck archive write may hold; bound it so shutdown cannot hang here.
            try:
                await asyncio.wait_for(self.notifications.stop(), self.stop_timeout)
            except asyncio.TimeoutError:
                _LOGGER.warning("Companion notification state for %s could not be saved within %s s", self.vehicle, self.stop_timeout)
        for unsubscribe in self.unsubs:
            unsubscribe()
        self.unsubs.clear()
        if hasattr(self, "state_unsub"):
            self.state_unsub()
            del self.state_unsub
        drained = False
        if self.worker:
            try:
                await asyncio.wait_for(self.queue.join(), self.stop_timeout)
                self.queue.put_nowait(None)
                await asyncio.wait_for(self.worker, self.stop_timeout)
                drained = True
            except Exception:  # a stuck or failed worker must not block unload or shutdown
                _LOGGER.warning("Companion archive worker for %s did not stop cleanly; cancelling it", self.vehicle, exc_info=True)
                self.worker.cancel()
                await asyncio.gather(self.worker, return_exceptions=True)
            self.worker = None
        if self.engine:
            if drained:
                await self.hub.db("put", self.vehicle, "engine", self.engine.state)
            else:
                await self._record_interrupted_shutdown()
        self.price_cache.clear()
        self.last_states.clear()
        self._summary_cache = self._dashboard_cache = None

    async def priced_sessions(self, start=None, end=None):
        async with self._pricing_lock:
            return await self._priced_sessions(start, end)

    async def session_page(self, before=None, limit=5, location="", sort="newest"):
        async with self._pricing_lock:
            if sort in {"highest", "lowest"}:
                # Every cost, setting or session change bumps the revision, so the whole archive is only re-priced
                # when something changed, or at most every 15 minutes for readings that arrive late.
                key = (self._summary_revision, int(time.time() // 900))
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
        period = {"sessions": 0, "energy": 0, "cost": 0, "unpriced": 0, "paid_sessions": 0, "paid_energy": 0, "free_sessions": 0, "free_energy": 0}
        for row in rows:
            day = dt_util.as_local(datetime.fromtimestamp(row["s"] / 1000, timezone.utc)).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
            if (start is not None and row['s'] < start*1000) or (end is not None and row['s'] > end*1000) or (start is None and time.time()*1000-day > 31*86400000):
                continue
            bucket = buckets.setdefault(day, {"s": day, "live": False, "pricing": {"energy": 0, "cost": 0}, "unpriced_count": 0, "split": {"free": 0, "paid": 0, "unpriced": 0}})
            energy = row["pricing"].get("energy")
            bucket["pricing"]["energy"] += energy if energy is not None else row.get("kwh") or 0
            split_cost = row["pricing"].get("cost")
            split_state = "unpriced" if split_cost is None else ("free" if split_cost == 0 else "paid")
            bucket["split"][split_state] += energy if energy is not None else row.get("kwh") or 0
            amount = energy if energy is not None else row.get("kwh") or 0
            cost = row["pricing"].get("cost")
            period["sessions"] += 1
            period["energy"] += amount
            if cost is None:
                period["unpriced"] += 1
            elif cost == 0:
                period["free_sessions"] += 1
                period["free_energy"] += amount
            else:
                period["paid_sessions"] += 1
                period["paid_energy"] += amount
                period["cost"] += cost
            if row["pricing"].get("cost") is None:
                bucket["unpriced_count"] += 1
            else:
                bucket["pricing"]["cost"] += row["pricing"]["cost"]
        result = {"total": len(rows), "priced": len(priced), "unpriced": len(rows)-len(priced),
                  "cost": sum(row["pricing"]["cost"] for row in priced),
                  "energy": sum(row["pricing"].get("energy") if row["pricing"].get("energy") is not None else row.get("kwh") or 0 for row in rows),
                  "period": period,
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
            profile_id = (record.get("profile") or {}).get("id") if record else None
            row["profile_removed"] = bool(profile_id and profile_id != "manual" and
                                          not any(p.get("id") == profile_id for p in settings.get("profiles", [])))
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

    async def summary_values(self) -> dict:
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
