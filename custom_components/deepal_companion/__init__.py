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
from .const import CARD_PANEL_URL, DOMAIN, FRONTEND_URL, PANEL_URL, SIGNAL, VERSION, FRONTEND_VERSION
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
        self.card_panel_in_sidebar = False  # default off; an admin can turn it on in Card Settings > Advanced
        self._card_panel_registered = False
        self._settings_store = None  # one Home Assistant Store for page, language and update rate
        self.language = "auto"
        self.update_rate = 0  # seconds; 0 = live. Spacing of saved readings and live notification refreshes, for every vehicle
        self.card_panel_pin = {"vehicle_id": "", "view_id": "", "design": ""}  # profile and design fixed for the card page

    def settings_snapshot(self):
        """Everything kept in the single settings store."""
        return {"sidebar": self.card_panel_in_sidebar, **self.card_panel_pin,
                "language": self.language, "update_rate": self.update_rate}

    async def _save_settings(self, **changes):
        snapshot = {**self.settings_snapshot(), **changes}
        if self._settings_store is not None:
            await self._settings_store.async_save(snapshot)

    async def set_card_panel_pin(self, pin):
        self.card_panel_pin = {**self.card_panel_pin, **pin}
        await self._save_settings()

    async def set_language(self, choice):
        """The one notification language for everything Companion writes into phone notifications."""
        from .phone_text import MESSAGE_LANGUAGES, language_choice, set_language
        if choice not in MESSAGE_LANGUAGES:
            raise ValueError("Unknown notification language")
        set_language(self.hass, choice)
        self.language = choice
        await self._save_settings()
        return language_choice(self.hass)

    async def set_update_rate(self, seconds):
        """How often Companion saves readings and refreshes live notifications: live (0), 5 minutes or 10 minutes."""
        from .const import UPDATE_RATES
        if type(seconds) is not int or seconds not in UPDATE_RATES:
            raise ValueError("Unknown update rate")
        self.update_rate = seconds
        await self._save_settings()
        return seconds

    async def set_card_panel(self, visible):
        """Show or hide the card-only page in the sidebar. The page itself stays reachable by its address."""
        visible = bool(visible)
        self.card_panel_in_sidebar = visible
        await self._save_settings()
        await _register_card_panel(self.hass, self)

    async def db(self, method, *args):
        async with self.lock:
            return await self.hass.async_add_executor_job(getattr(self.archive, method), *args)

    async def read_db(self, load):
        """Read-only queries in one SQLite snapshot. hub.lock is not taken, so archive writes proceed while this runs."""
        return await self.hass.async_add_executor_job(self.archive.read_snapshot, load)

    def changed(self, vehicle):
        runtime = self.vehicles.get(vehicle)
        if runtime is not None:
            runtime.signal_revision += 1
        async_dispatcher_send(self.hass, SIGNAL, vehicle)


async def _register_card_panel(hass, hub):
    if hub._card_panel_registered:
        from homeassistant.components.frontend import async_remove_panel
        async_remove_panel(hass, CARD_PANEL_URL, warn_if_unknown=False)
    await async_register_panel(
        hass, frontend_url_path=CARD_PANEL_URL, webcomponent_name="deepal-companion-card-panel",
        sidebar_title="Deepal Card" if hub.card_panel_in_sidebar else None,
        sidebar_icon="mdi:car-electric-outline" if hub.card_panel_in_sidebar else None,
        module_url=FRONTEND_URL + "/companion-card-panel.js?v=" + FRONTEND_VERSION,
        require_admin=False,
    )
    hub._card_panel_registered = True


async def _import_old_settings(hass):
    """Read the three older stores once. They are left on disk and never written again."""
    from homeassistant.helpers.storage import Store
    out = {"sidebar": False, "vehicle_id": "", "view_id": "", "design": "", "language": "auto", "update_rate": 0}
    complete = True
    for name, read in (
        ("card_panel", lambda d: {"sidebar": d.get("sidebar") is True,
                                  **{k: d[k] for k in ("vehicle_id", "view_id", "design") if isinstance(d.get(k), str)}}),
        ("language", lambda d: {"language": d["language"]} if isinstance(d.get("language"), str) else {}),
        ("update_rate", lambda d: {"update_rate": d["seconds"]} if type(d.get("seconds")) is int and d["seconds"] in (0, 300, 600) else {}),
    ):
        try:
            data = await Store(hass, 1, DOMAIN + "." + name).async_load()
            if isinstance(data, dict):
                out.update(read(data))
        except Exception:
            complete = False  # a store that could not be read must not be replaced by defaults for good
            _LOGGER.exception("Could not import the older %s setting", name)
    return out, complete


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
    add_extra_js_url(hass, FRONTEND_URL + "/loader.js?v=" + FRONTEND_VERSION)
    await async_register_panel(
        hass, frontend_url_path=PANEL_URL, webcomponent_name="deepal-companion-panel",
        sidebar_title="Deepal Companion", sidebar_icon="mdi:car-electric",
        module_url=FRONTEND_URL + "/companion-panel.js?v=" + FRONTEND_VERSION,
        require_admin=False,
    )
    try:
        from homeassistant.helpers.storage import Store
        from .phone_text import set_language
        hub._settings_store = Store(hass, 1, DOMAIN + ".settings")
        saved = await hub._settings_store.async_load()
        if not isinstance(saved, dict):  # first start after the upgrade: import the three older stores once
            saved, complete = await _import_old_settings(hass)
            if complete:  # otherwise the import runs again on the next start; the defaults only apply until then
                await hub._settings_store.async_save(saved)
        hub.card_panel_in_sidebar = saved.get("sidebar") is True
        hub.card_panel_pin = {k: saved[k] if isinstance(saved.get(k), str) else "" for k in ("vehicle_id", "view_id", "design")}
        hub.language = saved["language"] if isinstance(saved.get("language"), str) else "auto"
        set_language(hass, hub.language)
        if type(saved.get("update_rate")) is int and saved["update_rate"] in (0, 300, 600):
            hub.update_rate = saved["update_rate"]
    except Exception:
        _LOGGER.exception("Could not read the saved Companion settings; using the defaults")
    await _register_card_panel(hass, hub)
    # Register the bundled card in Lovelace's resource collection when using storage mode.
    from homeassistant.components.lovelace.const import LOVELACE_DATA
    lovelace = hass.data.get(LOVELACE_DATA)
    resources = getattr(lovelace, "resources", None)
    if resources is not None and hasattr(resources, "async_create_item"):
        await resources.async_get_info()
        url = FRONTEND_URL + "/loader.js?v=" + FRONTEND_VERSION
        existing = next((r for r in resources.async_items() if r.get("url", "").split("?")[0] == url.split("?")[0]), None)
        if existing is None:
            await resources.async_create_item({"res_type": "module", "url": url})
        elif existing["url"] != url:
            await resources.async_update_item(existing["id"], {"url": url})
    return True


async def async_setup_entry(hass, entry):
    from .phone_text import async_preload
    from .live_charging import async_preload as preload_live_defaults
    await async_preload(hass)
    await preload_live_defaults(hass)
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
        try:
            await runtime.stop()
        except Exception:
            _LOGGER.exception("Runtime cleanup failed during setup")
        finally:
            hub.vehicles.pop(entry.unique_id, None)
            entry.runtime_data = None
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
