"""Constants for Deepal Companion."""
DOMAIN = "deepal_companion"
VERSION = "0.1.3"
SIGNAL = f"{DOMAIN}_updated"
FRONTEND_URL = f"/{DOMAIN}/frontend"
PANEL_URL = "deepal-companion"
SHARED_KEYS = frozenset({
    "prefix", "entities", "powertrain", "battery_kwh", "fuel_max",
    "fuel_tank_liters",
})
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
