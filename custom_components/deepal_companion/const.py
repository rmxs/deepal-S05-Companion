"""Constants for Deepal Companion."""
DOMAIN = "deepal_companion"
VERSION = "2.0.0"
FRONTEND_REVISION = "20261122-04"
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


SHARED_KEYS = frozenset({
    "prefix", "entities", "powertrain", "battery_kwh", "fuel_max",
    "charge_prompt_min_gain", "charge_prompt_recent", "charge_spike_jump",
    "car_color", "iso_wheels",  # what the car physically looks like: the same in every display profile
})
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
