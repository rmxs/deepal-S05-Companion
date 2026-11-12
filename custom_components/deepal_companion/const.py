"""Constants for Deepal Companion."""
DOMAIN = "deepal_companion"
VERSION = "0.1.6"
SIGNAL = f"{DOMAIN}_updated"
FRONTEND_URL = f"/{DOMAIN}/frontend"
PANEL_URL = "deepal-companion"
CARD_PANEL_URL = "deepal-companion-card"  # page that shows only the card
SHARED_KEYS = frozenset({
    "prefix", "entities", "powertrain", "battery_kwh", "fuel_max",
    "fuel_tank_liters", "charge_prompt_min_gain", "charge_prompt_recent", "charge_spike_jump",
    "car_color", "iso_wheels",  # what the car physically looks like: the same in every display profile
})
# User settings (card Settings): defaults and allowed ranges, shared by the API and the backend.
DEFAULT_PROMPT_MIN_GAIN = 3  # battery percentage points a charge must add before it asks for a profile
DEFAULT_PROMPT_RECENT = 10  # latest charges the profile reminder looks at
DEFAULT_SPIKE_JUMP = 20  # one reading this far above the charge so far waits for confirmation
RANGES = {"charge_prompt_min_gain": (0, 100), "charge_prompt_recent": (1, 20), "charge_spike_jump": (5, 50)}
ENERGY_KEYS = {
    "batt": "sensor.battery_level", "ac": "sensor.ac_charge_current",
    "dc": "sensor.dc_charge_current", "odo": "sensor.total_odometer",
    "pow": "sensor.power_status", "fuel": "sensor.fuel_level",
    "charging": "binary_sensor.charging", "plug": "binary_sensor.charger_plugged",
    "tank": "sensor.fuel_tank_capacity",
    "cloud": "binary_sensor.cloud_connection",
}
DEFAULT_PROFILES = [
    {"id": "home", "name": "Home", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "work", "name": "Work", "price": None, "free": True, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "free", "name": "Free", "price": None, "free": True, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "ionity", "name": "Ionity", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
    {"id": "public", "name": "Public", "price": None, "free": False, "source": "battery", "entity": "", "efficiency": 90},
]
