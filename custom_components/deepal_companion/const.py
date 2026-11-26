"""Constants for Deepal Companion."""
DOMAIN = "deepal_companion"
VERSION = "2.0.1-b1"
FRONTEND_REVISION = "20261126-01"
FRONTEND_VERSION = VERSION + "&rev=" + FRONTEND_REVISION
SIGNAL = f"{DOMAIN}_updated"
PLAN_SIGNAL = f"{DOMAIN}_plan_updated"
CAR_LOG_SIGNAL = f"{DOMAIN}_car_log_updated"
FRONTEND_URL = f"/{DOMAIN}/frontend"
PANEL_URL = "deepal-companion"
CARD_PANEL_URL = "deepal-companion-card"  # page that shows only the card
UPDATE_RATES = (0, 300, 600)  # seconds between saved readings and notification refreshes: 0 = live (every change), 5 or 10 minutes


def update_floor(runtime):
    """The data update rate chosen by the user, in seconds (0 = live). Anything unknown counts as live."""
    value = getattr(getattr(runtime, "hub", None), "update_rate", 0)
    return value if type(value) is int and value in UPDATE_RATES else 0


# Vehicle entities. The entity id follows the Home Assistant language (e.g. Spanish names), but the Deepal integration
# gives every entity a fixed translation_key. Same table as TK_SPECIAL/tkOf in source/card.js: keep both in step.
DEEPAL_PLATFORM = "deepal"
TK_SPECIAL = {
    "binary_sensor.cloud_connection": "connected", "binary_sensor.key_fob_battery_low": "key_battery_low",
    "sensor.remaining_charge_time_h_mm": "remaining_charge_time_formatted", "sensor.charging_type": "charge_mode",
    "button.flash_lights_and_honk": "flash_and_honk", "sensor.climate_fan_level": "fan_level",
    "binary_sensor.tire_pressure_warning": "warning_tpms", "binary_sensor.abs_warning": "warning_abs",
    "binary_sensor.brake_warning": "warning_brake", "binary_sensor.brake_fluid_warning": "warning_brake_fluid",
    "binary_sensor.power_steering_warning": "warning_eps", "binary_sensor.power_limit_warning": "warning_power_limit",
    "binary_sensor.power_system_warning": "warning_power_system",
    "binary_sensor.traction_battery_low_warning": "warning_traction_battery_low",
    "binary_sensor.12_v_battery_warning": "warning_12v_battery", "binary_sensor.airbag_warning": "warning_airbag",
}
_CORNERS = ("front_left", "front_right", "rear_left", "rear_right")
_CORNER_PARTS = ("tire_pressure", "tire_alarm", "window_open", "window_opening", "seat_heating_level", "seat_ventilation_level")


def translation_key_of(logical):
    """The Deepal translation_key behind a logical id such as "sensor.inside_temperature"."""
    if logical in TK_SPECIAL:
        return TK_SPECIAL[logical]
    name = logical.split(".", 1)[-1]
    for corner in _CORNERS:
        if name.startswith(corner + "_"):
            rest = name[len(corner) + 1:]
            if rest in _CORNER_PARTS:
                return rest + "_" + corner
            if rest == "door":
                return "door_" + corner
    return name


def expected_entity(config, logical):
    """The English entity id: "sensor.inside_temperature" -> "sensor.<prefix>_inside_temperature"."""
    return logical.replace(".", "." + (config or {}).get("prefix", "s05") + "_", 1)


def vehicle_entity(runtime, logical):
    """The car's entity for a logical id, through the vehicle's shared resolver (VehicleRuntime.resolve_entity).
    Without a running vehicle: the user's mapping, else the English entity id."""
    resolver = getattr(runtime, "resolve_entity", None)
    if callable(resolver):
        return resolver(logical)
    config = getattr(runtime, "config", None) or {}
    return config.get("entities", {}).get(logical) or expected_entity(config, logical)


# What the car looks like: one car, so the same in every display profile. Profiles keep a shadowed copy
# of these from before they were shared; Database.config() falls back to the oldest copy until a vehicle value is saved.
VIEW_LOOK_KEYS = ("car_color", "iso_wheels", "hero_style", "hero_sky", "car_side", "image_path", "images")
SHARED_KEYS = frozenset({
    "prefix", "entities", "powertrain", "battery_kwh", "fuel_max",
    "charge_prompt_min_gain", "charge_prompt_recent", "charge_spike_jump",
    "charge_target",  # one car, one charger limit: every profile and the limiter see the same target
    *VIEW_LOOK_KEYS,
})
# Visibility of card sections lives only in the profile's `hidden` list (the card's default is ["charge", "costs"]).
DEFAULT_HIDDEN = ("charge", "costs")
FLAG_SECTIONS = (("charge_curve", "curve"), ("charging_reminder", "reminder"), ("charging_cost", "costs"))
# User settings (card Settings): defaults and allowed ranges, shared by the API and the backend.
DEFAULT_PROMPT_MIN_GAIN = 3  # battery percentage points a charge must add before it asks for a profile
DEFAULT_PROMPT_RECENT = 10  # latest charges the profile reminder looks at
DEFAULT_SPIKE_JUMP = 20  # one reading this far above the charge so far waits for confirmation
RANGES = {"charge_prompt_min_gain": (0, 100), "charge_prompt_recent": (1, 20), "charge_spike_jump": (5, 50), "charge_target": (0, 100)}
ENERGY_KEYS = {
    "batt": "sensor.battery_level", "ac": "sensor.ac_charge_current",
    "dc": "sensor.dc_charge_current", "odo": "sensor.total_odometer",
    "pow": "sensor.power_status", "fuel": "sensor.fuel_level",
    "charging": "binary_sensor.charging", "plug": "binary_sensor.charger_plugged",
    "volume": "sensor.fuel_volume",
    "cloud": "binary_sensor.cloud_connection",
}
DEFAULT_PROFILES = [
    {"id": "home", "name": "Home", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "work", "name": "Work", "price": None, "free": True, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "free", "name": "Free", "price": None, "free": True, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "ionity", "name": "Ionity", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "public", "name": "Public", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
]
