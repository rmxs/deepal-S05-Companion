"""Diagnostics exclude vehicle configuration and receipt details."""
from .const import DOMAIN, VERSION


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
    }
