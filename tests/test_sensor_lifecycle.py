"""Task ownership regression tests; HA interfaces are explicit doubles."""
import asyncio
import importlib
import types
import unittest

from test_lifecycle import module


class Entity:
    def __init__(self):
        self.writes = 0

    def async_write_ha_state(self):
        self.writes = getattr(self, "writes", 0) + 1


module("homeassistant.components.sensor", SensorEntity=Entity,
       SensorDeviceClass=types.SimpleNamespace(ENERGY="energy", MONETARY="monetary", ENUM="enum"),
       SensorStateClass=types.SimpleNamespace(TOTAL="total"))
import sys
sys.modules["homeassistant.helpers.device_registry"].DeviceInfo = lambda **kwargs: kwargs
Sensor = importlib.import_module("companion_lifecycle.sensor").CompanionSensor


class SensorLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def sensor(self, fetch):
        async def summary():
            await fetch()
            return {"sessions": 0, "battery_kwh": 0, "cost": 0, "unpriced": 0}
        runtime = types.SimpleNamespace(vehicle="car", entry=types.SimpleNamespace(title="Car"), summary_values=summary)
        entity = Sensor(runtime, "sessions")
        entity.hass = types.SimpleNamespace(async_create_task=asyncio.create_task)
        return entity

    async def test_device_link_opens_companion_panel(self):
        async def fetch():
            return []
        self.assertEqual(self.sensor(fetch)._attr_device_info["configuration_url"], "homeassistant://deepal-companion")

    async def test_burst_notifications_share_one_task(self):
        count = 0
        async def fetch():
            nonlocal count
            count += 1
            await asyncio.sleep(0)
            return []
        entity = self.sensor(fetch)
        for _ in range(30):
            entity._changed("car")
        task = entity._update_task
        await task
        self.assertEqual(count, 1)
        self.assertEqual(entity.writes, 1)

    async def test_unload_cancels_pending_update_and_prevents_writes(self):
        entered = asyncio.Event()
        async def fetch():
            entered.set()
            await asyncio.Event().wait()
        entity = self.sensor(fetch)
        entity._changed("car")
        await entered.wait()
        await entity.async_will_remove_from_hass()
        entity._changed("car")
        self.assertIsNone(entity._update_task)
        self.assertEqual(getattr(entity, "writes", 0), 0)

    async def test_change_during_update_is_coalesced(self):
        entered, release = asyncio.Event(), asyncio.Event()
        count = 0
        async def fetch():
            nonlocal count
            count += 1
            if count == 1:
                entered.set()
                await release.wait()
            return []
        entity = self.sensor(fetch)
        entity._changed("car")
        await entered.wait()
        for _ in range(30):
            entity._changed("car")
        release.set()
        await entity._update_task
        self.assertEqual(count, 2)
