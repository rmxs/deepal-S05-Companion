"""UI-only setup. Source entities stay owned by the user's vehicle integration."""
from __future__ import annotations

from collections import Counter

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.selector import SelectSelector, SelectSelectorConfig

from .const import DOMAIN


def detect_powertrain(hass, battery):
    """Use fuel entities belonging to this vehicle, including an empty tank.

    Registry metadata remains useful while the vehicle is sleeping. Do not use
    unrelated cars' states or infer electric-only from missing device ownership.
    """
    device_id = getattr(battery, "device_id", None)
    if not device_id:
        return "auto"
    for entity in er.async_get(hass).entities.values():
        if getattr(entity, "device_id", None) != device_id:
            continue
        if not entity.entity_id.startswith("sensor."):
            continue
        key = getattr(entity, "translation_key", None)
        stem = entity.entity_id.split(".", 1)[1]
        unique = str(getattr(entity, "unique_id", ""))
        if key in {"fuel_level", "fuel_range"} or any(
            stem.endswith("_" + role) or unique.endswith("_" + role)
            for role in ("fuel_level", "fuel_range")
        ):
            return "phev"
    return "ev"


def setup_select(options, translation_key):
    return SelectSelector(SelectSelectorConfig(
        options=options, translation_key=translation_key, mode="dropdown"))


def discover_batteries(hass, exclude_configured=False):
    """Use integration ownership and stable translation keys, never all %-sensors."""
    registry = er.async_get(hass)
    entry_lookup = getattr(hass.config_entries, "async_get_entry", lambda _: None)
    entries = getattr(hass.config_entries, "async_entries", lambda _: [])(DOMAIN)
    configured = {entry.unique_id for entry in entries} if exclude_configured else set()
    configured_devices = {entity.device_id for entity in registry.entities.values()
                          if entity.id in configured and getattr(entity, "device_id", None)}
    result = []
    for entity in registry.entities.values():
        entity_id = entity.entity_id
        if not entity_id.startswith("sensor.") or getattr(entity, "disabled_by", None):
            continue
        source = entry_lookup(getattr(entity, "config_entry_id", None))
        if getattr(entity, "platform", None) != "deepal" and getattr(source, "domain", None) != "deepal":
            continue
        suffix = entity_id.split(".", 1)[1]
        key = getattr(entity, "translation_key", None)
        unique = str(getattr(entity, "unique_id", ""))
        if key != "battery_level" and not suffix.endswith("_battery_level") and not unique.endswith("_battery_level"):
            continue
        if entity.id in configured or entity_id in configured or getattr(entity, "device_id", None) in configured_devices:
            continue
        state = hass.states.get(entity_id)
        if state and state.attributes.get("unit_of_measurement") not in (None, "%"):
            continue
        result.append(entity)
    return sorted(result, key=lambda entity: entity.entity_id)


def detected_defaults(hass, entity):
    suffix = entity.entity_id.split(".", 1)[1]
    prefix = suffix[:-len("_battery_level")] if suffix.endswith("_battery_level") else "s05"
    if not suffix.endswith("_battery_level") and getattr(entity, "device_id", None):
        prefixes = []
        for sibling in er.async_get(hass).entities.values():
            if sibling.device_id != entity.device_id:
                continue
            stem = sibling.entity_id.split(".", 1)[1]
            for key in ("remaining_range", "fuel_range", "total_odometer", "ac_charge_current", "dc_charge_current"):
                if stem.endswith("_" + key):
                    prefixes.append(stem[:-len(key)-1])
        if prefixes:
            prefix = Counter(prefixes).most_common(1)[0][0]
    device = dr.async_get(hass).async_get(entity.device_id) if getattr(entity, "device_id", None) else None
    name = (device.name_by_user or device.name) if device else None
    return {"battery_entity": entity.entity_id, "prefix": prefix,
            "name": name or "Deepal S05", "powertrain": detect_powertrain(hass, entity)}


def discover_vehicles(hass, exclude_configured=True):
    """One friendly vehicle choice per physical device; sensor IDs stay internal."""
    grouped = {}
    candidates = discover_batteries(hass, exclude_configured)
    for entity in sorted(candidates, key=lambda e: getattr(e, "translation_key", None) != "battery_level"):
        key = getattr(entity, "device_id", None) or entity.id
        grouped.setdefault(key, entity)
    result = {}
    names = Counter()
    for key, entity in grouped.items():
        defaults = detected_defaults(hass, entity)
        name = defaults["name"]
        plate = None
        for sibling in er.async_get(hass).entities.values():
            if not entity.device_id or sibling.device_id != entity.device_id:
                continue
            if getattr(sibling, "translation_key", None) == "license_plate" or sibling.entity_id.endswith("_license_plate"):
                state = hass.states.get(sibling.entity_id)
                if state and state.state not in ("unknown", "unavailable", "", "None"):
                    plate = state.state
                    break
        label = name + (" · " + plate if plate else "")
        names[label] += 1
        result[key] = {"entity": entity, "defaults": defaults,
                       "label": label + (" (" + str(names[label]) + ")" if names[label] > 1 else "")}
    return result


class CompanionConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        vehicles = discover_vehicles(self.hass)
        if not vehicles:
            return self.async_abort(reason="already_configured" if discover_batteries(self.hass) else "no_deepal_vehicle")
        if len(vehicles) == 1 and user_input is None:
            self._selected_vehicle = next(iter(vehicles.values()))
            return await self.async_step_confirm()
        if user_input is not None:
            selected = vehicles.get(user_input.get("vehicle"))
            if selected:
                self._selected_vehicle = selected
                return await self.async_step_confirm()
            errors["vehicle"] = "vehicle_missing"
        return self.async_show_form(step_id="user", data_schema=vol.Schema({
            vol.Required("vehicle"): vol.In({key: item["label"] for key, item in vehicles.items()})
        }), errors=errors)

    async def async_step_confirm(self, user_input=None):
        selected = getattr(self, "_selected_vehicle", None)
        if selected is None:
            return await self.async_step_user()
        entity = selected["entity"]
        if not any(candidate.id == entity.id for candidate in discover_batteries(self.hass)):
            return self.async_abort(reason="vehicle_unavailable")
        errors = {}
        defaults = selected["defaults"]
        if user_input is not None:
            name = str(user_input.get("name", "")).strip()
            choices = {
                "powertrain": ("auto", "phev", "ev"),
                "car_color": ("black", "blue", "grey", "silver", "white"),
                "iso_wheels": ("cover", "open", "pro"),
            }
            approved = {key: user_input.get(key, defaults.get(key, values[0]))
                        for key, values in choices.items()}
            for key, values in choices.items():
                if approved[key] not in values:
                    errors[key] = "invalid_selection"
            if not name:
                errors["name"] = "name_required"
            if not errors:
                # Keep the existing registry-based identity for entries already created.
                await self.async_set_unique_id(entity.id)
                self._abort_if_unique_id_configured()
                data = {**detected_defaults(self.hass, entity), **approved, "name": name}
                return self.async_create_entry(title=name, data=data)
        return self.async_show_form(step_id="confirm", data_schema=vol.Schema({
            vol.Required("name", default=(user_input or {}).get("name", defaults["name"])): str,
            vol.Required("powertrain", default=(user_input or {}).get("powertrain", defaults["powertrain"])):
                setup_select(["auto", "phev", "ev"], "powertrain"),
            vol.Required("car_color", default=(user_input or {}).get("car_color", "black")):
                setup_select(["black", "blue", "grey", "silver", "white"], "car_color"),
            vol.Required("iso_wheels", default=(user_input or {}).get("iso_wheels", "cover")):
                setup_select(["cover", "open", "pro"], "iso_wheels"),
        }), errors=errors, description_placeholders={"vehicle": selected["label"]})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return CompanionOptionsFlow()


class CompanionOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        errors = {}
        current = {**self.config_entry.data, **self.config_entry.options}
        if user_input is not None:
            name = str(user_input.get("name", "")).strip()
            if not name:
                errors["name"] = "name_required"
            else:
                entity = next((e for e in discover_batteries(self.hass)
                               if e.id == self.config_entry.unique_id or e.entity_id == current["battery_entity"]), None)
                if entity:
                    detected = detected_defaults(self.hass, entity)
                    # Explicit prefix customization remains managed by the complete card settings.
                    current["battery_entity"] = detected["battery_entity"]
                return self.async_create_entry(title="", data={**current, "name": name})
        return self.async_show_form(step_id="init", data_schema=vol.Schema({
            vol.Required("name", default=current["name"]): str
        }), errors=errors,
            description_placeholders={"panel_url": "/deepal-companion"})
