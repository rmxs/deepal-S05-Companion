"""Authenticated Companion websocket API."""
from __future__ import annotations

from datetime import datetime
import json
import logging
import math
import re
import time

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from .const import DEFAULT_PROFILES, DOMAIN, RANGES, SIGNAL

_LOGGER = logging.getLogger(__name__)
ENTITY = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
SOURCES = {"battery", "total", "session", "power"}


def timestamp(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, bool):
        raise ValueError("Expected a timestamp, not a boolean")
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    parsed = dt_util.parse_datetime(value) if isinstance(value, str) else None
    if parsed is None or parsed.tzinfo is None:
        raise ValueError("Expected an ISO timestamp including timezone")
    return parsed.timestamp()


def check_json(value, max_bytes=2_000_000):
    if len(json.dumps(value, allow_nan=False).encode()) > max_bytes:
        raise ValueError("Payload is too large")


def validate_costs(data):
    if not isinstance(data, dict) or not isinstance(data.get("profiles"), list) or not isinstance(data.get("sessions"), dict):
        raise ValueError("Expected profiles and session assignments")
    if not 0 <= len(data["profiles"]) <= 12:
        raise ValueError("Use at most 12 charging profiles")
    ids = set()
    def profile(p):
        if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not 1 <= len(p["id"]) <= 100:
            raise ValueError("Invalid profile identity")
        if not isinstance(p.get("name", ""), str) or len(p.get("name", "")) > 100:
            raise ValueError("Profile name is too long")
        if p.get("source") not in SOURCES:
            raise ValueError("Unknown charger energy source")
        if p.get("source") != "battery" and not ENTITY.fullmatch(p.get("entity", "")):
            raise ValueError("Choose an energy or power sensor")
        if not isinstance(p.get("free"), bool):
            raise ValueError("Free must be true or false")
        n = p.get("efficiency")
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not 1 <= n <= 100:
            raise ValueError("Efficiency must be between 1 and 100")
        for key in ("price",):
            value = p.get(key)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 10000):
                raise ValueError("Invalid tariff")
    for p in data["profiles"]:
        profile(p)
        if p["id"] in ids:
            raise ValueError("Duplicate location identity")
        ids.add(p["id"])
    for key, record in data["sessions"].items():
        if not key.isdigit() or not 0 <= int(key) <= time.time() + 86400:
            raise ValueError("Invalid charging session timestamp")
        if not isinstance(record, dict):
            raise ValueError("Invalid session assignment")
        profile(record.get("profile"))
        for field in ("energy", "total", "capacity"):
            value = record.get(field)
            maximum = {"energy": 1000000, "total": 1000000000, "capacity": 500}[field]
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= maximum):
                raise ValueError("Invalid receipt value")
        if record["profile"].get("free") and (record.get("total") or 0) > 0:
            raise ValueError("A free charge cannot have a nonzero total paid")
    check_json(data)
    return data


def authorize(connection, runtime):
    # Every sensor the vehicle's data is built from must be readable, not only the battery sensor.
    anchor = getattr(runtime, "entities", {}).get("batt") or runtime.entry.options.get("battery_entity", runtime.entry.data["battery_entity"])
    states = getattr(getattr(runtime, "hass", None), "states", None)
    # Optional sensors that do not exist in Home Assistant are skipped, so they cannot lock a user out of the vehicle.
    optional = {*getattr(runtime, "entities", {}).values(), *getattr(runtime, "live_entities", {}).values(),
                *getattr(runtime, "charger_entities", set())}
    optional = {e for e in optional if e and e != anchor and (states is None or states.get(e) is not None)}
    if not all(connection.user.permissions.check_entity(entity, POLICY_READ) for entity in {anchor, *optional}):
        raise PermissionError("You do not have access to this vehicle")


@websocket_api.websocket_command({
    vol.Required("type"): DOMAIN + "/request",
    vol.Required("op"): str,
    vol.Optional("vehicle_id"): str,
    vol.Optional("view_id"): str,
    vol.Optional("data", default={}): dict,
})
@websocket_api.async_response
async def request(hass, connection, msg):
    hub = hass.data[DOMAIN]
    op, vehicle, data = msg["op"], msg.get("vehicle_id"), msg.get("data", {})
    try:
        check_json(data)
        if op == "list":
            result = []
            for item in await hub.db("list_vehicles"):
                runtime = hub.vehicles.get(item["id"])
                if runtime:
                    try:
                        authorize(connection, runtime)
                        result.append(item)
                    except PermissionError:
                        pass
            connection.send_result(msg["id"], result)
            return
        runtime = hub.vehicles.get(vehicle)
        if runtime is None:
            raise ValueError("Vehicle is not loaded")
        authorize(connection, runtime)
        if op in {"config_patch", "view", "costs_set", "backup", "charge_profile_assign", "sessions_import"} and not connection.user.is_admin:
            raise PermissionError("Administrator access is required to change shared Companion data")
        if op.startswith("notifications_"):
            if not connection.user.is_admin:
                raise PermissionError("Administrator access is required for notification templates and devices")
            from .notifications import validate
            engine = runtime.notifications
            if op == "notifications_get":
                from .live_charging import supported
                activity = engine.history_page()
                result = {"value": engine.config, "history": activity["rows"], "activity": activity, "state": engine.state, "recipients": engine.recipients(),
                          "live_supported": supported(), "live_test_active": bool(engine.live.state.get("test_devices")),
                          "live_status_test_active": {kind: bool(engine.live_status.state.get(kind, {}).get("test_devices")) for kind in ("climate", "open")}}
            elif op == "notifications_history":
                result = engine.history_page(data.get("limit", 5), data.get("before"))
            elif op == "notifications_history_delete":
                if data.get("all") is True and "id" not in data:
                    await engine.delete_history()
                elif set(data) == {"id"} and isinstance(data["id"], str):
                    await engine.delete_history(data["id"])
                else:
                    raise ValueError("Choose an activity entry or delete all")
                result = engine.history_page()
            elif op == "notifications_set":
                merged = await engine.save(data.get("value"), data.get("expected"))
                result = {"value": engine.config, "merged": merged}
            elif op in {"notifications_live_test", "notifications_live_stop_test"}:
                result = await engine.live.test(data.get("value", {}), stop=op == "notifications_live_stop_test")
            elif op in {"notifications_live_status_test", "notifications_live_status_stop_test"}:
                if not isinstance(data.get("kind"), str):
                    raise ValueError("Choose a live notification")
                result = await engine.live_status.test(data["kind"], data.get("value", {}), stop=op == "notifications_live_status_stop_test")
            elif op == "notifications_explain":
                if set(data) != {"rule_id"} or not isinstance(data["rule_id"], str):
                    raise ValueError("Choose an alert")
                result = await engine.explain(data["rule_id"])
            elif op in {"notifications_preview", "notifications_test"}:
                rule = validate({"enabled": False, "rules": [data.get("rule")]})["rules"][0]
                if op == "notifications_test" and not rule["devices"]:
                    raise ValueError("Choose a test device")
                result = await (engine.test(rule) if op == "notifications_test" else engine.preview(rule))
            else:
                raise ValueError("Unknown notification operation")
        elif op == "health_get":
            from .health import build_health
            result = await build_health(runtime)
        elif op == "config_get":
            result = await hub.db("config", vehicle, msg.get("view_id"))
            result["charge_prompt"] = await hub.db("charge_prompt", vehicle, str(connection.user.id))
        elif op == "charge_prompt_dismiss":
            session = data.get("session_id")
            if not isinstance(session, str):
                raise ValueError("Expected a charging session ID")
            await hub.db("dismiss_charge_prompt", vehicle, str(connection.user.id), session)
            result = {}
        elif op == "charge_profile_assign":
            session, profile = data.get("session_id"), data.get("profile_id")
            if not isinstance(session, str) or not isinstance(profile, str):
                raise ValueError("Expected charging session and profile IDs")
            await hub.db("assign_charge_profile", vehicle, session, profile)
            await runtime.refresh()
            result = {}
        elif op == "config_patch":
            patch = data.get("patch", {})
            if not isinstance(patch, dict) or set(patch) - hub.setting_keys:
                raise ValueError("Unknown card setting")
            for k in ("battery_kwh", "fuel_tank_liters"):
                if k in patch and (isinstance(patch[k], bool) or not isinstance(patch[k], (int, float)) or not 0 <= patch[k] <= 500):
                    raise ValueError("Invalid capacity")
            for key, (low, high) in RANGES.items():
                if key in patch and (isinstance(patch[key], bool) or not isinstance(patch[key], (int, float)) or not low <= patch[key] <= high):
                    raise ValueError("%s must be between %s and %s" % (key.replace("_", " "), low, high))
            expected_revision = data.get("expected_revision")
            if not isinstance(expected_revision, list) or len(expected_revision) != 2 or any(isinstance(n, bool) or not isinstance(n, int) for n in expected_revision):
                raise ValueError("Settings revision missing. Reload before saving.")
            if "companion_design" in patch and patch["companion_design"] not in ("", "mobile", "tablet", "energy"):
                raise ValueError("Invalid card design")
            if "companion_width" in patch:
                width = patch["companion_width"]
                if isinstance(width, bool) or not isinstance(width, (int, float)) or not (width == 0 or 280 <= width <= 1600):
                    raise ValueError("Card width must be 0 (automatic) or 280–1600 pixels")
            if "prefix" in patch and not re.fullmatch("[a-z0-9_]+", patch["prefix"]):
                raise ValueError("Invalid entity prefix")
            if "entities" in patch and (not isinstance(patch["entities"], dict) or any(not ENTITY.fullmatch(v) for v in patch["entities"].values())):
                raise ValueError("Invalid entity mapping")
            result = await hub.db("patch_config", vehicle, msg.get("view_id"), patch, bool(data.get("reset")), expected_revision)
            await runtime.refresh()
        elif op == "view":
            name = str(data.get("name", ""))[:100].strip()
            result = await hub.db("view", vehicle, data.get("action"), msg.get("view_id"), name, data.get("source"))
        elif op == "costs_get":
            result = {"value": await hub.db("get", vehicle, "costs", {})}
        elif op == "costs_set":
            if "changes" in data:
                changes = data["changes"]
                if not isinstance(changes, dict) or not changes or set(changes)-{"profiles", "sessions"}:
                    raise ValueError("Expected changed charging profiles or receipts")
                validate_costs({"profiles": changes.get("profiles", DEFAULT_PROFILES),
                                "sessions": changes.get("sessions", {})})
                await hub.db("patch_costs", vehicle, changes, data.get("expected_changes"), validate_costs)
            else:
                value = validate_costs(data.get("value"))
                await hub.db("save_costs", vehicle, value, data.get("expected"))
            await runtime.refresh()
            result = {}
        elif op == "history":
            ids = data.get("entity_ids", [])
            if not isinstance(ids, list) or len(ids) > 100 or any(not isinstance(e, str) or not ENTITY.fullmatch(e) for e in ids):
                raise ValueError("Invalid history entity list")
            ids = [e for e in ids if connection.user.permissions.check_entity(e, POLICY_READ)]
            end = timestamp(data.get("end_time"), time.time())
            start = timestamp(data.get("start_time"), end - 31*86400)
            if end < start:
                raise ValueError("Invalid history period")
            if end - start > 366*86400:
                raise ValueError("Request at most 366 days of readings per query")
            result = await hub.db("history", vehicle, ids, start, end)
        elif op == "sessions_import":
            rows = data.get("rows")
            if not isinstance(rows, list) or len(rows) > 500:
                raise ValueError("Import up to 500 completed sessions at a time")
            for row in rows:
                if not isinstance(row, dict) or row.get("live") or row.get("gap"):
                    raise ValueError("Only completed, continuous sessions can be archived")
                for key, maximum in (("s", (time.time()+60)*1000), ("e", (time.time()+60)*1000), ("from", 100), ("to", 100), ("kwh", 500), ("capacity", 500)):
                    n = row.get(key)
                    if type(n) not in (int, float) or not math.isfinite(n) or not 0 <= n <= maximum:
                        raise ValueError("Invalid recovered session " + key)
                if row["e"] <= row["s"] or row["to"] <= row["from"]:
                    raise ValueError("Invalid charging interval")
                curve = row.get("curve", {})
                if not isinstance(curve, dict) or set(curve) - {"ac", "dc", "battery"}:
                    raise ValueError("Invalid charging curve")
                for samples in curve.values():
                    if not isinstance(samples, list) or len(samples) > 10000:
                        raise ValueError("Charging curve is too large")
                    for point in samples:
                        if not isinstance(point, list) or len(point) != 2 or type(point[0]) not in (int,float) or not math.isfinite(point[0]) or not row["s"]-86400000 <= point[0] <= row["e"]:
                            raise ValueError("Invalid charging curve timestamp")
                        if point[1] is not None and (type(point[1]) not in (int,float) or not math.isfinite(point[1]) or not 0 <= point[1] <= 100000):
                            raise ValueError("Invalid charging curve reading")
                pricing = row.get("pricing", {})
                if not isinstance(pricing, dict):
                    raise ValueError("Invalid recovered pricing")
                for key in ("energy", "cost"):
                    n = pricing.get(key)
                    if n is not None and (type(n) not in (int,float) or not math.isfinite(n) or not 0 <= n <= 1000000000):
                        raise ValueError("Invalid recovered " + key)
            mapping = getattr(runtime, "entities", {})
            result = {"imported": await hub.db("import_sessions", vehicle, rows,
                                               {key: mapping.get(role) for key, role in (("ac","ac"),("dc","dc"),("battery","batt"))})}
            if data.get("sync_complete") is True:
                await hub.db("put", vehicle, "recorder_sessions_synced", time.time())
                if data.get("curve_version") == 1:
                    await hub.db("put", vehicle, "recorder_curves_synced", 1)
            runtime._summary_revision += 1
        elif op == "session_curve":
            if not isinstance(data.get("session_id"), str):
                raise ValueError("Choose a charging session")
            result = await hub.db("session_curve", vehicle, data["session_id"],
                                  {key: runtime.entities.get(role) for key, role in (("ac","ac"),("dc","dc"),("battery","batt"))})
        elif op == "sessions_page":
            before, limit = data.get("before"), data.get("limit", 5)
            sort = data.get("sort", "newest")
            if sort not in {"newest", "oldest", "highest", "lowest"}:
                raise ValueError("Invalid session sort order")
            location = data.get("location", "")
            if not isinstance(location, str) or len(location) > 100:
                raise ValueError("Invalid location filter")
            if before is not None:
                def valid_number(value):
                    return type(value) in (int,float) and math.isfinite(value) and value >= 0
                if sort in {"highest", "lowest"}:
                    if not isinstance(before, dict) or set(before) != {"start", "cost"} or not valid_number(before["start"]) or (before["cost"] is not None and not valid_number(before["cost"])):
                        raise ValueError("Invalid cost cursor")
                elif not valid_number(before):
                    raise ValueError("Invalid session cursor")
            if type(limit) is not int or not 1 <= limit <= 25:
                raise ValueError("Request 1–25 sessions per page")
            result = await runtime.session_page(before, limit, location, sort)
            result["sort"] = sort
            result["recorder_synced"] = await hub.db("get", vehicle, "recorder_sessions_synced", 0)
            result["curves_synced"] = await hub.db("get", vehicle, "recorder_curves_synced", 0)
        elif op == "charging_dashboard":
            if "start_time" in data or "end_time" in data:
                start, end = timestamp(data.get("start_time"), 0), timestamp(data.get("end_time"), time.time())
                if end < start or end-start > 32*86400:
                    raise ValueError("Choose a chart period of up to 32 days")
                result = await runtime.charging_dashboard(start, end)
            else:
                result = await runtime.charging_dashboard()
        elif op == "sessions":
            start, end = timestamp(data.get("start_time"), 0), timestamp(data.get("end_time"), time.time())
            result = await runtime.priced_sessions(start, end)
        elif op == "export":
            result = await hub.db("export", vehicle)
            if not connection.user.is_admin:
                result.pop("notifications", None)
                result.pop("notification_history", None)
        elif op == "summary":
            result = await hub.db("summary", vehicle)
        elif op == "backup":
            target = hass.config.path(".storage", "deepal_companion.backup.sqlite")
            await hub.db("backup", target)
            result = {"file": ".storage/deepal_companion.backup.sqlite"}
        else:
            raise ValueError("Unknown Companion operation")
        connection.send_result(msg["id"], result)
        if op in {"config_patch", "view", "costs_set", "charge_prompt_dismiss", "charge_profile_assign"}:
            hub.changed(vehicle)
    except PermissionError as err:
        connection.send_error(msg["id"], "unauthorized", str(err))
    except (ValueError, TypeError, KeyError) as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
    except Exception:  # storage or other unexpected failure: log it, answer with a fixed message that carries no data
        _LOGGER.exception("Companion request %s failed", op)
        connection.send_error(msg["id"], "unknown_error", "The request could not be completed")


@websocket_api.websocket_command({vol.Required("type"): DOMAIN + "/subscribe"})
@callback
def subscribe(hass, connection, msg):
    @callback
    def changed(vehicle):
        runtime = hass.data[DOMAIN].vehicles.get(vehicle)
        if runtime:
            try:
                authorize(connection, runtime)
                connection.send_event(msg["id"], {"vehicle_id": vehicle})
            except PermissionError:
                pass
    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL, changed)
    connection.send_result(msg["id"])


def register(hass):
    websocket_api.async_register_command(hass, request)
    websocket_api.async_register_command(hass, subscribe)
