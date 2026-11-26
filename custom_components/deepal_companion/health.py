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
          "volume": "Fuel volume", "cloud": "Cloud connection"}
FUEL_ROLES = {"fuel", "volume"}
RANK = {"ok": 0, "warning": 1, "error": 2}


class Msg(str):
    """English text for API users, plus the template and values so the panel can translate it."""
    def __new__(cls, template, *args):
        obj = super().__new__(cls, template.format(*args))
        obj.key, obj.args = template, [str(a) for a in args]
        return obj


def item(ident, status, title, detail="", fix=""):
    row = {"id": ident, "status": status, "title": title, "detail": detail, "fix": fix}
    if isinstance(detail, Msg):
        row["detail_key"], row["args"] = detail.key, detail.args
    return row


def sensor_checks(runtime, now):
    rows = []
    # An electric-only car has no fuel sensors, so they are not checked or reported as missing.
    fuel = getattr(runtime, "has_fuel", lambda: True)()
    for role, entity in sorted(runtime.entities.items()):
        if role in FUEL_ROLES and not fuel:
            continue
        label = LABELS.get(role, role)
        state = runtime.hass.states.get(entity)
        if role == "volume" and state is None:
            continue
        required = role in REQUIRED_ROLES
        bad = "error" if required else "warning"
        ident = "sensor_" + role
        if state is None:
            rows.append(item(ident, bad, label, Msg("{0} was not found in Home Assistant.", entity),
                             "Choose the correct sensor in Card Settings, or check the Deepal Alternative integration."))
        elif state.state in BAD_STATES:
            rows.append(item(ident, bad, label, Msg("{0} is {1}.", entity, state.state),
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
        return [item("archive", "warning", "Charging recorder", Msg("{0} readings are waiting to be saved.", backlog),
                     "The recorder is running behind. Check disk speed and the Home Assistant log.")]
    return [item("archive", "ok", "Charging recorder", Msg("Running, {0} readings waiting.", backlog))]


def storage_checks(stats, schema):
    rows = [item("schema", "ok", "Database", Msg("Schema version {0}.", schema))]
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
        rows.append(item("recipients", "warning", "Notification devices", Msg("{0} active alert(s) have no available device.", len(missing)),
                         "Open Notifications and choose a device for each alert."))
    else:
        rows.append(item("recipients", "ok", "Notification devices", Msg("{0} device(s) available.", len(recipients))))
    last = max((h for h in engine.history if h.get("status") not in {"test", "test_ended"}), key=lambda h: h.get("time", 0), default=None)
    if last and last.get("status") == "error":
        rows.append(item("delivery", "warning", "Last notification", "The most recent alert could not be delivered.",
                         "Open Notifications, Recent activity, for the device and reason."))
    elif last:
        rows.append(item("delivery", "ok", "Last notification", Msg("Last alert status: {0}.", last.get("status"))))
    return rows


def pricing_checks(costs):
    unpriced = [p.get("name", p.get("id")) for p in costs.get("profiles", [])
                if not p.get("free") and p.get("price") is None and p.get("source") == "battery"]
    if unpriced:
        return [item("pricing", "warning", "Charging prices", Msg("No price set for: {0}.", ", ".join(sorted(map(str, unpriced))[:5])),
                     "Open Charging and enter a price per kWh.")]
    return [item("pricing", "ok", "Charging prices", "Every paid profile has a price.")]


def precondition_checks(pc):
    """Read-only view of the preconditioning state: a failed or unconfirmed start or stop is shown here, not on the page header."""
    state = getattr(pc, "state", None) or {}
    status, error = state.get("status"), str(state.get("last_error") or "")
    fix = "Open Preconditioning, Diagnostics, for the history."
    if status == "FAILED":
        return [item("preconditioning", "error", "Preconditioning", Msg("The last start or stop failed: {0}", error or "unknown reason"), fix)]
    if status == "UNKNOWN":
        return [item("preconditioning", "warning", "Preconditioning", Msg("The car did not confirm the climate state: {0}", error or "no answer"), fix)]
    return [item("preconditioning", "ok", "Preconditioning", "No failed or unconfirmed start or stop.")]


def charger_limit_checks(cl):
    """The charger limit is only listed when the owner turned it on. A failed stop or a missing charger entity is shown here."""
    cfg = getattr(cl, "config", None) or {}
    if not cfg.get("mode") or cfg.get("mode") == "off":
        return []
    fix = "Open Charging, Charger limit, and check the charger."
    phase = cl.phase()
    if phase == "failed":
        return [item("charger_limit", "error", "Charger limit", Msg("The charger could not be stopped: {0}", str(cl.state.get("failed") or "unknown reason")), fix)]
    if cl.state.get("release_pending"):
        return [item("charger_limit", "warning", "Charger limit", "The charger could not be released", fix)]
    if cl.plug_unknown_long():
        return [item("charger_limit", "warning", "Charger limit", "The car's plug sensor has not answered for a while, so the limit cannot tell when the car is plugged in.",
                     "Check that the plug sensor of the car is available in Home Assistant.")]
    if phase == "unavailable":
        return [item("charger_limit", "warning", "Charger limit", "The charger control is unavailable, so the limit cannot work.", fix)]
    if phase == "no_target":
        if cl.target() >= 100:
            return [item("charger_limit", "warning", "Charger limit", "A limit at 100% does nothing, choose a lower target.", "Set a lower charging target in Card Settings.")]
        return [item("charger_limit", "warning", "Charger limit", "No charging target is set on the card, so the limit has nothing to stop at.", "Set the charging target in Card Settings.")]
    battery = cl.battery()
    if cl.plugged() is True and cl.charging() and battery["soc"] is not None and not battery["fresh"]:
        fix = "Check that sensor.last_updated of the car is available and updates while it charges."
        if battery["age"] is None:
            return [item("charger_limit", "warning", "Charger limit", "The time of the car's last report is unknown, so the limit waits and will not stop the charge.", fix)]
        return [item("charger_limit", "warning", "Charger limit", Msg("The car's last report is {0} minutes old, so the limit waits and will not stop the charge.", max(0, int(battery["age"] // 60))), fix)]
    if cl.command(cfg):
        if not (cfg.get("stop_option") and cfg.get("start_option")) and cfg["control"].startswith("select."):
            return [item("charger_limit", "warning", "Charger limit", "The charger's stop or start option could not be identified.", fix)]
        if cfg["control"].startswith("button.") and not cfg.get("start_button"):
            return [item("charger_limit", "warning", "Charger limit", "The charger's start button could not be identified.", fix)]
        if cl.command_charging() is None:
            return [item("charger_limit", "warning", "Charger limit", "The charger has no power or status sensor, so a stop cannot be confirmed.", fix)]
        if not cfg.get("power"):
            return [item("charger_limit", "warning", "Charger limit", "The charger has no power sensor, so a stop is confirmed by its status only.", fix)]
    if cl.energy_is_total():
        return [item("charger_limit", "warning", "Charger limit", "The energy sensor looks like a lifetime total, so the kWh shown for a charge would be wrong.",
                     "Open Charging, Charger limit, and choose a sensor that counts one charge, or none.")]
    return [item("charger_limit", "ok", "Charger limit", "The charger limit is ready." if cfg["mode"] == "live" else "The charger limit is in dry run: it only tells you what it would do.")]


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

    async def plan():
        from .plan_health import plan_checks, plan_info
        return plan_checks(plan_info(runtime))

    async def preconditioning():
        pc = getattr(runtime, "preconditioning", None)
        return precondition_checks(pc) if pc is not None else []

    async def charger_limit():
        cl = getattr(runtime, "charger_limit", None)
        return charger_limit_checks(cl) if cl is not None else []

    for name, produce in (("sensors", sensors), ("recorder", backend), ("storage", storage),
                          ("notifications", notifications), ("pricing", pricing), ("plan", plan),
                          ("preconditioning", preconditioning), ("charger_limit", charger_limit)):
        await section(name, produce)
    status = max((c["status"] for c in checks), key=RANK.get, default="ok")
    return {"status": status, "version": VERSION, "checked": int(now),
            "counts": {s: sum(1 for c in checks if c["status"] == s) for s in RANK}, "checks": checks}
