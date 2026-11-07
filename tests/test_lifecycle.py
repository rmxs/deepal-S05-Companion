"""Integration lifecycle/flow tests against explicit HA API doubles, not a live HA core."""
import asyncio
from datetime import datetime, timedelta, timezone
import importlib
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

from test_api import module, identity, ROOT

clock = [datetime.now(timezone.utc)]
listeners = []
module("homeassistant.const", Platform=types.SimpleNamespace(SENSOR="sensor"), EVENT_HOMEASSISTANT_STOP="stop")
module("homeassistant.components.frontend", add_extra_js_url=lambda hass, url: hass.urls.append(url))
module("homeassistant.components.http", StaticPathConfig=lambda *args: args)
async def register_panel(hass, **kwargs):
    hass.panels.append(kwargs)
module("homeassistant.components.panel_custom", async_register_panel=register_panel)
module("homeassistant.components.lovelace")
module("homeassistant.components.lovelace.const", LOVELACE_DATA="lovelace")
module("homeassistant.helpers.entity_registry", async_get=lambda hass: hass.registry)
module("homeassistant.helpers.config_validation", config_entry_only_config_schema=lambda domain: {"config_entry_only": domain})
module("homeassistant.helpers.device_registry", async_get=lambda hass: getattr(
    hass, "device_registry", types.SimpleNamespace(async_get=lambda ident: None)))
module("homeassistant.helpers.event", async_track_state_change_event=lambda *args: lambda: None,
       async_track_time_interval=lambda *args: lambda: None)
module("homeassistant.util.dt", utcnow=lambda: clock[0], parse_datetime=lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")))
sys.modules["homeassistant.util"].dt = sys.modules["homeassistant.util.dt"]
def connect(hass, signal, fn):
    listeners.append(fn)
    return lambda: listeners.remove(fn) if fn in listeners else None
def send(hass, signal, vehicle):
    for listener in listeners[:]:
        listener(vehicle)
sys.modules["homeassistant.helpers.dispatcher"].async_dispatcher_connect = connect
sys.modules["homeassistant.helpers.dispatcher"].async_dispatcher_send = send
sys.modules["homeassistant.components.websocket_api"].async_register_command = lambda hass, fn: hass.commands.append(fn)


class Flow:
    def __init_subclass__(cls, **kwargs):
        pass
    async def async_set_unique_id(self, ident):
        self.unique_id = ident
    def _abort_if_unique_id_configured(self):
        pass
    def async_show_form(self, **kwargs):
        return {"type": "form", **kwargs}
    def async_create_entry(self, **kwargs):
        return {"type": "create_entry", **kwargs}
    def async_abort(self, **kwargs):
        return {"type": "abort", **kwargs}
module("homeassistant.config_entries", ConfigFlow=Flow, OptionsFlow=Flow)
module("homeassistant.helpers.selector", EntitySelectorConfig=lambda **kwargs: kwargs,
       EntitySelector=lambda cfg: str, SelectSelectorConfig=lambda **kwargs: kwargs,
       SelectSelector=lambda cfg: __import__("voluptuous").In(cfg["options"]))

spec = importlib.util.spec_from_file_location("companion_lifecycle",
    ROOT / "custom_components" / "deepal_companion" / "__init__.py",
    submodule_search_locations=[str(ROOT / "custom_components" / "deepal_companion")])
integration = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = integration
spec.loader.exec_module(integration)
flow_module = importlib.import_module("companion_lifecycle.config_flow")


class Resources:
    def __init__(self):
        self.items = []
    async def async_get_info(self):
        return {}
    def async_items(self):
        return self.items
    async def async_create_item(self, item):
        self.items.append({"id": str(len(self.items)), **item})
    async def async_update_item(self, ident, value):
        next(r for r in self.items if r["id"] == ident).update(value)


class Hass:
    def __init__(self, directory):
        self.config = types.SimpleNamespace(path=lambda *parts: str(Path(directory).joinpath(*parts)))
        self.data = {"lovelace": types.SimpleNamespace(resources=Resources())}
        self.commands, self.urls, self.panels = [], [], []
        self.values = {
            "sensor.s05_battery_level": self.state("sensor.s05_battery_level", "20", "%"),
            "sensor.s05_ac_charge_current": self.state("sensor.s05_ac_charge_current", "8", "A"),
            "sensor.s05_dc_charge_current": self.state("sensor.s05_dc_charge_current", "0", "A"),
            "sensor.s05_fuel_level": self.state("sensor.s05_fuel_level", "53", "%"),
        }
        self.states = types.SimpleNamespace(get=lambda entity: self.values.get(entity))
        self.registry = types.SimpleNamespace(async_get=lambda entity: None, entities={})
        async def register(paths):
            self.static_paths = paths
        self.http = types.SimpleNamespace(async_register_static_paths=register)
        self.bus = types.SimpleNamespace(async_listen_once=lambda *args: lambda: None, async_listen=lambda *args: lambda: None)
        async def forward(entry, platforms):
            self.platforms = platforms
        async def unload(entry, platforms):
            return True
        self.config_entries = types.SimpleNamespace(async_forward_entry_setups=forward,
                                                    async_unload_platforms=unload)
    @staticmethod
    def state(entity, value, unit):
        return types.SimpleNamespace(entity_id=entity, state=value, attributes={"unit_of_measurement": unit})
    async def async_add_executor_job(self, fn, *args):
        return await asyncio.to_thread(fn, *args)
    def async_create_task(self, task, name=None):
        return asyncio.create_task(task, name=name)
    def async_create_background_task(self, task, name=None):
        return asyncio.create_task(task, name=name)


class LifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        listeners.clear()
        self.tmp = tempfile.TemporaryDirectory()
        self.hass = Hass(self.tmp.name)
        self.entry = types.SimpleNamespace(
            unique_id="vehicle", title="Car", data={"name": "Car", "prefix": "s05", "battery_entity": "sensor.s05_battery_level"},
            options={}, async_on_unload=lambda fn: None, add_update_listener=lambda fn: lambda: None)
        self.runtime = None
    async def asyncTearDown(self):
        if self.runtime:
            await self.runtime.stop()
        self.tmp.cleanup()
    async def test_setup_resources_and_backend_start_stop(self):
        self.assertTrue(await integration.async_setup(self.hass, {}))
        self.assertEqual(len(self.hass.commands), 2)
        self.assertEqual(len(self.hass.panels), 1)
        self.assertEqual(len(self.hass.data["lovelace"].resources.items), 1)
        self.assertTrue(await integration.async_setup_entry(self.hass, self.entry))
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        summary = await self.hass.data["deepal_companion"].db("summary", "vehicle")
        self.assertIsNotNone(summary["active"])
        active = summary["active"]
        self.hass.values["sensor.s05_battery_level"].state = "70"
        self.runtime._tick(clock[0])
        await self.runtime.queue.join()
        updated = (await self.hass.data["deepal_companion"].db("summary", "vehicle"))["active"]
        self.assertEqual(updated["id"], active["id"])
        self.assertAlmostEqual(updated["kwh"], 9.2)
        await self.runtime.stop()
        self.runtime = None
        # A new runtime recovers the same in-progress session from SQLite.
        self.assertTrue(await integration.async_setup_entry(self.hass, self.entry))
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        recovered = (await self.hass.data["deepal_companion"].db("summary", "vehicle"))["active"]
        self.assertEqual(recovered["id"], active["id"])
        self.assertEqual(recovered["from"], 20)

    async def test_entry_setup_recreates_empty_archive_after_global_setup(self):
        await integration.async_setup(self.hass, {})
        hub = self.hass.data["deepal_companion"]
        # Simulate the reported zero-byte replacement after the global schema
        # initialization, before the config-entry setup/reload.
        Path(hub.archive.path).write_bytes(b"")
        self.assertTrue(await integration.async_setup_entry(self.hass, self.entry))
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        cars = await hub.db("list_vehicles")
        self.assertEqual(len(cars), 1)
        self.assertEqual(len(cars[0]["views"]), 3)

    async def test_entry_schema_recheck_preserves_existing_settings_and_ids(self):
        await integration.async_setup(self.hass, {})
        await integration.async_setup_entry(self.hass, self.entry)
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        hub = self.hass.data["deepal_companion"]
        original = (await hub.db("list_vehicles"))[0]["views"]
        view = original[0]["id"]
        await hub.db("patch_config", "vehicle", view, {"car_color": "white"})
        original = (await hub.db("list_vehicles"))[0]["views"]
        await integration.async_unload_entry(self.hass, self.entry)
        self.runtime = None
        await integration.async_setup_entry(self.hass, self.entry)
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        self.assertEqual((await hub.db("list_vehicles"))[0]["views"], original)
        self.assertEqual((await hub.db("config", "vehicle", view))["config"]["car_color"], "white")

    async def test_setup_confirms_vehicle_and_name(self):
        self.add_battery("sensor.s05_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user()
        self.assertEqual(result["type"], "form")
        self.assertEqual(result["step_id"], "confirm")
        self.assertEqual([key.schema for key in result["data_schema"].schema],
                         ["name", "powertrain", "car_color", "iso_wheels"])
        result = await flow.async_step_confirm({"name": " "})
        self.assertEqual(result["errors"]["name"], "name_required")
        result = await flow.async_step_confirm({"name": "My car"})
        self.assertEqual(result["type"], "create_entry")
        self.assertEqual(result["data"]["battery_entity"], "sensor.s05_battery_level")
        self.assertEqual(result["data"]["prefix"], "s05")
        self.assertEqual(result["data"]["name"], "My car")

    async def test_options_form_keeps_complete_app_link(self):
        flow = flow_module.CompanionOptionsFlow()
        flow.hass, flow.config_entry = self.hass, self.entry
        result = await flow.async_step_init()
        self.assertEqual(result["description_placeholders"]["panel_url"], "/deepal-companion")

    def fuel_entity(self, battery, ident="sensor.renamed_petrol", key="fuel_range"):
        fuel = self.add_battery(ident, key=key)
        fuel.device_id = battery.device_id
        return fuel

    async def test_hybrid_detected_from_renamed_owned_sensor_requires_confirmation(self):
        battery = self.add_battery("sensor.s05_battery_level")
        fuel = self.fuel_entity(battery)
        self.hass.values[fuel.entity_id].state = "unavailable"
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user()
        self.assertEqual(result["type"], "form")
        defaults = {key.schema: key.default() for key in result["data_schema"].schema}
        self.assertEqual(defaults["powertrain"], "phev")
        self.assertNotIn("fuel_max", defaults)
        self.assertNotIn("fuel_tank_liters", defaults)
        result = await flow.async_step_confirm({"name": "Car", "powertrain": "ev",
                                               "car_color": "white", "iso_wheels": "pro"})
        self.assertEqual(result["data"]["powertrain"], "ev")
        self.assertEqual(result["data"]["car_color"], "white")
        self.assertEqual(result["data"]["iso_wheels"], "pro")

    def test_type_detection_ignores_other_cars_and_handles_empty_tank(self):
        battery = self.add_battery("sensor.first_battery_level")
        other = self.add_battery("sensor.second_battery_level")
        self.fuel_entity(other)
        self.assertEqual(flow_module.detect_powertrain(self.hass, battery), "ev")
        fuel = self.fuel_entity(battery, "sensor.first_fuel_level", key=None)
        self.hass.values[fuel.entity_id].state = "0"
        self.assertEqual(flow_module.detect_powertrain(self.hass, battery), "phev")
        battery.device_id = None
        self.assertEqual(flow_module.detect_powertrain(self.hass, battery), "auto")

    async def test_invalid_setup_selection_keeps_form_values(self):
        self.add_battery("sensor.s05_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        await flow.async_step_user()
        result = await flow.async_step_confirm({"name": "My car", "powertrain": "diesel"})
        self.assertEqual(result["errors"]["powertrain"], "invalid_selection")
        defaults = {key.schema: key.default() for key in result["data_schema"].schema}
        self.assertEqual(defaults["name"], "My car")

    async def test_setup_choices_seed_views_and_survive_reload_without_overwrite(self):
        self.entry.data.update(powertrain="phev", car_color="white", iso_wheels="pro")
        await integration.async_setup(self.hass, {})
        await integration.async_setup_entry(self.hass, self.entry)
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        hub = self.hass.data["deepal_companion"]
        views = (await hub.db("list_vehicles"))[0]["views"]
        for view in views:
            config = (await hub.db("config", "vehicle", view["id"]))["config"]
            self.assertEqual(config["powertrain"], "phev")
            self.assertEqual(config["car_color"], "white")
            self.assertEqual(config["iso_wheels"], "pro")
        first, second = views[0]["id"], views[1]["id"]
        await hub.db("patch_config", "vehicle", first, {"car_color": "blue", "powertrain": "ev"})
        await self.runtime.stop()
        await integration.async_setup_entry(self.hass, self.entry)
        self.runtime = self.entry.runtime_data
        await self.runtime.queue.join()
        self.assertEqual((await hub.db("config", "vehicle", first))["config"]["car_color"], "blue")
        self.assertEqual((await hub.db("config", "vehicle", second))["config"]["car_color"], "white")
        self.assertEqual((await hub.db("config", "vehicle", first))["config"]["powertrain"], "ev")

    def add_battery(self, ident, platform="deepal", key="battery_level", disabled=None):
        entry = types.SimpleNamespace(id=ident+"_registry", entity_id=ident, platform=platform,
            translation_key=key, unique_id="vehicle_"+str(key), config_entry_id="source",
            device_id=ident+"_device", disabled_by=disabled)
        self.hass.registry.entities[ident] = entry
        self.hass.registry.async_get = lambda ident: self.hass.registry.entities.get(ident)
        self.hass.values[ident] = self.hass.state(ident, "79", "%")
        return entry

    async def test_single_vehicle_hides_technical_fields(self):
        self.add_battery("sensor.mycar_battery_level")
        self.hass.device_registry = types.SimpleNamespace(async_get=lambda ident: types.SimpleNamespace(
            name_by_user="My S05", name="Deepal"))
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user()
        defaults = {key.schema: key.default() for key in result["data_schema"].schema}
        self.assertEqual(result["step_id"], "confirm")
        self.assertNotIn("battery_entity", defaults)
        self.assertNotIn("prefix", defaults)
        self.assertEqual(defaults["name"], "My S05")
        result = await flow.async_step_confirm({"name": "My S05"})
        self.assertEqual(result["data"]["battery_entity"], "sensor.mycar_battery_level")
        self.assertEqual(result["data"]["prefix"], "mycar")

    async def test_multiple_vehicles_are_not_silently_chosen(self):
        self.add_battery("sensor.first_battery_level")
        self.add_battery("sensor.second_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user()
        self.assertEqual(result["step_id"], "user")
        marker = next(k for k in result["data_schema"].schema if k.schema == "vehicle")
        import voluptuous as vol
        self.assertIs(marker.default, vol.UNDEFINED)
        self.assertEqual(len(flow_module.discover_batteries(self.hass)), 2)

    async def test_multiple_vehicle_selection_resolves_correct_battery(self):
        first = self.add_battery("sensor.first_battery_level")
        second = self.add_battery("sensor.second_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user({"vehicle": second.device_id})
        self.assertEqual(result["step_id"], "confirm")
        result = await flow.async_step_confirm({"name": "Second car"})
        self.assertEqual(result["data"]["battery_entity"], second.entity_id)
        self.assertEqual(result["data"]["prefix"], "second")
        self.assertEqual(flow.unique_id, second.id)

    async def test_no_deepal_vehicle_is_explained(self):
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user()
        self.assertEqual(result["reason"], "no_deepal_vehicle")

    async def test_invalid_vehicle_choice_does_not_expose_sensors(self):
        self.add_battery("sensor.first_battery_level")
        self.add_battery("sensor.second_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        result = await flow.async_step_user({"vehicle": "unknown-device"})
        self.assertEqual(result["errors"]["vehicle"], "vehicle_missing")
        self.assertEqual([key.schema for key in result["data_schema"].schema], ["vehicle"])

    async def test_vehicle_removed_before_confirmation(self):
        self.add_battery("sensor.s05_battery_level")
        flow = flow_module.CompanionConfigFlow()
        flow.hass = self.hass
        await flow.async_step_user()
        self.hass.registry.entities.clear()
        result = await flow.async_step_confirm({"name": "Car"})
        self.assertEqual(result["reason"], "vehicle_unavailable")

    async def test_options_only_show_vehicle_name(self):
        flow = flow_module.CompanionOptionsFlow()
        flow.hass, flow.config_entry = self.hass, self.entry
        result = await flow.async_step_init()
        self.assertEqual([key.schema for key in result["data_schema"].schema], ["name"])
        result = await flow.async_step_init({"name": "Renamed car"})
        self.assertEqual(result["data"]["battery_entity"], "sensor.s05_battery_level")
        self.assertEqual(result["data"]["prefix"], "s05")

    async def test_other_integrations_and_fuel_percent_are_not_candidates(self):
        self.add_battery("sensor.s05_battery_level")
        self.add_battery("sensor.solar_battery_level", platform="solar")
        self.add_battery("sensor.s05_fuel_level", key="fuel_level")
        self.assertEqual([e.entity_id for e in flow_module.discover_batteries(self.hass)],
                         ["sensor.s05_battery_level"])

    async def test_renamed_sensor_uses_stable_translation_key(self):
        self.add_battery("sensor.car_energy_percent")
        self.assertEqual(flow_module.discover_batteries(self.hass)[0].entity_id,
                         "sensor.car_energy_percent")

    async def test_disabled_and_configured_vehicles_are_excluded(self):
        registered = self.add_battery("sensor.s05_battery_level")
        self.add_battery("sensor.disabled_battery_level", disabled="user")
        self.hass.config_entries.async_entries = lambda domain: [types.SimpleNamespace(unique_id=registered.id)]
        self.assertEqual(flow_module.discover_batteries(self.hass, exclude_configured=True), [])
        self.assertEqual(len(flow_module.discover_batteries(self.hass)), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
