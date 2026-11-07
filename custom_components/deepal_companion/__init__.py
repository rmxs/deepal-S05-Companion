"""Deepal Companion: one package containing backend, archive, panel and card."""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.const import Platform
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .api import register
from .const import DOMAIN, FRONTEND_URL, PANEL_URL, SIGNAL, VERSION
from .database import Database
from .runtime import VehicleRuntime

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PLATFORMS = [Platform.SENSOR]
_LOGGER = logging.getLogger(__name__)


class Hub:
    def __init__(self, hass):
        self.hass = hass
        self.archive = Database(hass.config.path(".storage", "deepal_companion.sqlite"))
        self.lock = asyncio.Lock()
        self.vehicles = {}
        self.setting_keys = set()

    async def db(self, method, *args):
        async with self.lock:
            return await self.hass.async_add_executor_job(getattr(self.archive, method), *args)

    def changed(self, vehicle):
        async_dispatcher_send(self.hass, SIGNAL, vehicle)


async def async_setup(hass, config):
    hub = Hub(hass)
    await hub.db("initialize")
    keys = await hass.async_add_executor_job(
        lambda: json.loads((Path(__file__).parent / "setting_keys.json").read_text(encoding="utf-8")))
    hub.setting_keys = set(keys)
    hass.data[DOMAIN] = hub
    register(hass)
    await hass.http.async_register_static_paths([
        StaticPathConfig(FRONTEND_URL, str(Path(__file__).parent / "frontend"), False),
    ])
    add_extra_js_url(hass, FRONTEND_URL + "/loader.js?v=" + VERSION)
    await async_register_panel(
        hass, frontend_url_path=PANEL_URL, webcomponent_name="deepal-companion-panel",
        sidebar_title="Deepal Companion", sidebar_icon="mdi:car-electric",
        module_url=FRONTEND_URL + "/companion-panel.js?v=" + VERSION,
        require_admin=False,
    )
    # Register the bundled card in Lovelace's resource collection when using storage mode.
    from homeassistant.components.lovelace.const import LOVELACE_DATA
    lovelace = hass.data.get(LOVELACE_DATA)
    resources = getattr(lovelace, "resources", None)
    if resources is not None and hasattr(resources, "async_create_item"):
        await resources.async_get_info()
        url = FRONTEND_URL + "/loader.js?v=" + VERSION
        existing = next((r for r in resources.async_items() if r.get("url", "").split("?")[0] == url.split("?")[0]), None)
        if existing is None:
            await resources.async_create_item({"res_type": "module", "url": url})
        elif existing["url"] != url:
            await resources.async_update_item(existing["id"], {"url": url})
    return True


async def async_setup_entry(hass, entry):
    hub = hass.data[DOMAIN]
    # A reload does not rerun async_setup. Recheck the idempotent schema here
    # in case the archive file was removed/replaced while HA was running.
    await hub.db("initialize")
    runtime = VehicleRuntime(hub, entry)
    hub.vehicles[entry.unique_id] = runtime
    try:
        await runtime.start()
        entry.runtime_data = runtime
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    except Exception:
        await runtime.stop()
        hub.vehicles.pop(entry.unique_id, None)
        raise
    entry.async_on_unload(entry.add_update_listener(_options_updated))
    hub.changed(entry.unique_id)
    return True


async def _options_updated(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    hub = hass.data[DOMAIN]
    runtime = hub.vehicles.pop(entry.unique_id, None)
    if runtime:
        await runtime.stop()
    entry.runtime_data = None
    return True
