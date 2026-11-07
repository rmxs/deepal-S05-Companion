"""Archive summary entities, backed by Companion's database."""
from __future__ import annotations

import asyncio

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN, SIGNAL


async def async_setup_entry(hass, entry, async_add_entities):
    runtime = entry.runtime_data
    async_add_entities([CompanionSensor(runtime, key) for key in ("sessions", "battery_kwh", "cost", "unpriced")], True)


class CompanionSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, runtime, key):
        self.runtime, self.key = runtime, key
        self._attr_unique_id = runtime.vehicle + "_" + key
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, runtime.vehicle)},
            name=runtime.entry.title,
            manufacturer="Deepal Companion",
            model="Vehicle companion",
            configuration_url="homeassistant://deepal-companion",
        )
        self._attr_native_unit_of_measurement = {"battery_kwh": "kWh", "cost": "EUR"}.get(key)
        if key == "battery_kwh":
            self._attr_device_class = SensorDeviceClass.ENERGY
            self._attr_state_class = SensorStateClass.TOTAL
        elif key == "cost":
            self._attr_device_class = SensorDeviceClass.MONETARY
            self._attr_state_class = SensorStateClass.TOTAL
        self._refreshing = False
        self._queued = False
        self._update_task = None
        self._removed = False

    async def async_added_to_hass(self):
        self._removed = False
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL, self._changed))
        await self.async_update()

    async def async_will_remove_from_hass(self):
        self._removed = True
        self._queued = False
        if self._update_task:
            self._update_task.cancel()
            try:
                await self._update_task
            except asyncio.CancelledError:
                pass
            self._update_task = None

    @callback
    def _changed(self, vehicle):
        if vehicle == self.runtime.vehicle and not self._removed:
            if self._update_task and not self._update_task.done():
                self._queued = True
                return
            self._update_task = self.hass.async_create_task(self._update())

    async def _update(self):
        self._refreshing = True
        try:
            while not self._removed:
                self._queued = False
                await self.async_update()
                if not self._removed:
                    self.async_write_ha_state()
                if not self._queued:
                    break
        finally:
            self._refreshing = False

    async def async_update(self):
        values = await self.runtime.summary_values()
        unpriced = values["unpriced"]
        self._attr_native_value = values[self.key]
        self._attr_extra_state_attributes = {
            "archive": "Companion SQLite", "unpriced_sessions": unpriced,
            "cost_is_partial": bool(unpriced),
            "energy_basis": "Estimated energy added to the battery",
        }
