"""Diagnostics exclude vehicle configuration and receipt details.

The charger limit is included: its settings (entity ids only) and the record of its last stop, so a stop that failed
can be explained. It holds no tokens or credentials."""
from .const import DOMAIN, VERSION


def charger_limit_diagnostics(runtime):
    """The charger limit part of Download diagnostics; None when the vehicle has no limit. A failure is reported, never raised."""
    cl = getattr(runtime, "charger_limit", None) if runtime is not None else None
    if cl is None:
        return None
    try:
        return cl.diagnostics()
    except Exception as exc:  # noqa: BLE001 - diagnostics must always download
        return {"error": str(exc)[:200]}


async def async_get_config_entry_diagnostics(hass, entry):
    hub = hass.data[DOMAIN]
    summary = await hub.db("summary", entry.unique_id)
    return {
        "version": VERSION,
        "archive_schema": await hub.db("schema_version"),
        "storage": await hub.db("storage_stats"),
        "completed_sessions": summary["sessions"],
        "active_session": summary["active"] is not None,
        "backend_running": entry.unique_id in hub.vehicles,
        "charger_limit": charger_limit_diagnostics(hub.vehicles.get(entry.unique_id)),
    }
