"""Read-only health checks for one vehicle. Nothing here changes data or sends a notification."""
from __future__ import annotations

import time

BAD_STATES = {"unavailable", "unknown"}
REQUIRED_ROLES = {"batt"}
STALE_SECONDS = 6 * 3600   # a battery reading older than this is suspicious
BACKLOG_LIMIT = 500        # queued readings waiting for the archive worker
WAL_LIMIT = 100 * 1024 * 1024
LABELS = {"batt": "Battery level", "ac": "AC charge current", "dc": "DC charge current", "odo": "Odometer",
          "pow": "Power status", "fuel": "Fuel level", "charging": "Charging", "plug": "Charger plugged",
          "tank": "Fuel tank capacity", "cloud": "Cloud connection"}
RANK = {"ok": 0, "warning": 1, "error": 2}


def item(ident, status, title, detail="", fix=""):
    return {"id": ident, "status": status, "title": title, "detail": detail, "fix": fix}


def sensor_checks(runtime, now):
    rows = []
    for role, entity in sorted(runtime.entities.items()):
        label = LABELS.get(role, role)
        state = runtime.hass.states.get(entity)
        required = role in REQUIRED_ROLES
        bad = "error" if required else "warning"
        ident = "sensor_" + role
        if state is None:
            rows.append(item(ident, bad, label, entity + " was not found in Home Assistant.",
                             "Choose the correct sensor in Card Settings, or check the Deepal Alternative integration."))
        elif state.state in BAD_STATES:
            rows.append(item(ident, bad, label, entity + " is " + state.state + ".",
                             "Check that the vehicle is connected to Deepal Alternative."))
        elif role == "cloud" and state.state == "off":
            rows.append(item(ident, "warning", label, "The vehicle cloud connection is off, so readings may be out of date.",
                             "Wait for the car to reconnect, or check the Deepal Alternative integration."))
        elif role == "batt" and now - state.last_updated.timestamp() > STALE_SECONDS:
            rows.append(item(ident, "warning", label, "No new battery reading for over 6 hours.",
                             "This is normal when the car is parked for a long time. Otherwise check the vehicle connection."))
        else:
            rows.append(item(ident, "ok", label, entity))
    return rows


def backend_checks(runtime):
    worker = runtime.worker
    if runtime.engine is None or worker is None or worker.done():
        return [item("archive", "error", "Charging recorder", "The recorder is not running, so charging sessions are not saved.",
                     "Reload the integration or restart Home Assistant, then check the Home Assistant log.")]
    backlog = runtime.queue.qsize()
    if backlog > BACKLOG_LIMIT:
        return [item("archive", "warning", "Charging recorder", str(backlog) + " readings are waiting to be saved.",
                     "The recorder is running behind. Check disk speed and the Home Assistant log.")]
    return [item("archive", "ok", "Charging recorder", "Running, " + str(backlog) + " readings waiting.")]


def storage_checks(stats, schema):
    rows = [item("schema", "ok", "Database", "Schema version " + str(schema) + ".")]
    if stats.get("wal_bytes", 0) > WAL_LIMIT:
        rows.append(item("wal", "warning", "Database journal", "The journal file is unusually large.",
                         "Restart Home Assistant so the database can tidy itself."))
    else:
        rows.append(item("wal", "ok", "Database journal", "Normal size."))
    return rows


def notification_checks(engine, recipients):
    if engine is None:
        return []
    rules = [r for r in engine.config.get("rules", []) if r.get("enabled", True)]
    if not engine.config.get("enabled") or not rules:
        return [item("notifications", "ok", "Notifications", "No active alerts.")]
    rows = []
    reachable = {r["svc"] for r in recipients}
    missing = [r for r in rules if not r.get("devices") or not any(d in reachable for d in r["devices"])]
    if not recipients:
        rows.append(item("recipients", "warning", "Notification devices", "No Mobile App device is available to receive alerts.",
                         "Install the Home Assistant app on a phone and sign in."))
    elif missing:
        rows.append(item("recipients", "warning", "Notification devices", str(len(missing)) + " active alert(s) have no available device.",
                         "Open Notifications and choose a device for each alert."))
    else:
        rows.append(item("recipients", "ok", "Notification devices", str(len(recipients)) + " device(s) available."))
    last = max((h for h in engine.history if h.get("status") not in {"test", "test_ended"}), key=lambda h: h.get("time", 0), default=None)
    if last and last.get("status") == "error":
        rows.append(item("delivery", "warning", "Last notification", "The most recent alert could not be delivered.",
                         "Open Notifications, Recent activity, for the device and reason."))
    elif last:
        rows.append(item("delivery", "ok", "Last notification", "Last alert status: " + str(last.get("status")) + "."))
    return rows


def pricing_checks(costs):
    unpriced = [p.get("name", p.get("id")) for p in costs.get("profiles", [])
                if not p.get("free") and p.get("price") is None and p.get("source") == "battery"]
    if unpriced:
        return [item("pricing", "warning", "Charging prices", "No price set for: " + ", ".join(sorted(map(str, unpriced))[:5]) + ".",
                     "Open Charging Profiles and enter a price per kWh.")]
    return [item("pricing", "ok", "Charging prices", "Every paid profile has a price.")]


async def build_health(runtime):
    """Collect every check. A failing check is reported, never raised, so one broken part cannot hide the rest."""
    from .const import VERSION
    hub, vehicle = runtime.hub, runtime.vehicle
    now = time.time()
    checks = []

    async def section(name, produce):
        try:
            checks.extend(await produce())
        except Exception:  # noqa: BLE001 - a broken check must not break the page
            checks.append(item(name, "warning", name.capitalize(), "This check could not run.", "See the Home Assistant log."))

    async def sensors():
        return sensor_checks(runtime, now)

    async def backend():
        return backend_checks(runtime)

    async def storage():
        return storage_checks(await hub.db("storage_stats"), await hub.db("schema_version"))

    async def notifications():
        engine = getattr(runtime, "notifications", None)
        return notification_checks(engine, engine.recipients() if engine else [])

    async def pricing():
        return pricing_checks(await hub.db("get", vehicle, "costs", {}))

    for name, produce in (("sensors", sensors), ("recorder", backend), ("storage", storage),
                          ("notifications", notifications), ("pricing", pricing)):
        await section(name, produce)
    status = max((c["status"] for c in checks), key=RANK.get, default="ok")
    return {"status": status, "version": VERSION, "checked": int(now),
            "counts": {s: sum(1 for c in checks if c["status"] == s) for s in RANK}, "checks": checks}
