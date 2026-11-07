/*!
 * deepal-s05-card
 * Copyright (c) 2026 L.K. — GPL-3.0-only
 * Custom Lovelace card for Deepal S05 (and PHEV): hero with layers, control buttons,
 * Car View with tyres, interior (heating/ventilation), diagnostics, its own settings UI.
 *
 * No dependencies and no CDN. The icons are its own (embedded).
 * The layer images (Car View/interior) come from the dec_deepal project
 * (MIT) — see THIRD_PARTY_NOTICES.md in the card folder.
 */
(() => {
const CARD_VERSION = "1.5.1";
const CARD_CREDIT = "Made with ♥ in Greece · L.K.";
const TAG = "deepal-s05-card";
const SETTINGS_TAG = "deepal-s05-settings";
const EDITOR_TAG = "deepal-s05-card-editor";
if (customElements.get(TAG)) return;

const NUM_RANGE = { fuel_tank_liters: [0, 200], bat_t1: [0, 100], bat_t2: [0, 100], bat_t3: [0, 100], fuel_t1: [0, 100], fuel_t2: [0, 100], fuel_t3: [0, 100], image_scale: [0.5, 3] };
const BAD = ["unknown", "unavailable", "none", "None", "null", ""];
const TRANSITIONAL = ["locking", "unlocking", "opening", "closing"];
const CLIMATE_TURN_OFF = 128; // ClimateEntityFeature.TURN_OFF
const CLIMATE_TURN_ON = 256; // ClimateEntityFeature.TURN_ON

/* The card folder (where this .js lives) — the images load from there. */
const SCRIPT_BASE = (() => {
  if (window.__DEEPAL_CARD_BASE) return window.__DEEPAL_CARD_BASE;
  try {
    const s = [...document.querySelectorAll("script[src]")].find((x) => /deepal-s05-card[^/]*\.js/.test(x.src));
    if (s) return new URL(".", s.src).href;
    const r = performance.getEntriesByType("resource").find((x) => /deepal-s05-card[^/]*\.js/.test(x.name));
    if (r) return new URL(".", r.name).href;
  } catch (_) {}
  return "/hacsfiles/deepal-s05-card/";
})();

/* ───────────────────────── Defaults ───────────────────────── */
const SECTIONS = ["hero", "actions", "status", "charge", "curve", "stats", "info", "diagnostics", "costs", "reminder"];
const SECTION_LABELS = {
  hero: "Vehicle image",
  actions: "Control buttons",
  status: "Status (on the image)",
  stats: "Temperature & battery",
  info: "Info",
  diagnostics: "Diagnostics",
  charge: "Charging (when plugged in)",
  costs: "Charging costs",
  reminder: "Charging reminder",
  curve: "Charging curve (while charging)",
};
const HERO_SHOW_OPTS = [["name", "Name"], ["plate", "Plate"], ["range", "Total range"], ["cloud", "Cloud connection"], ["updated", "Last update"]];
const HERO_SPACE = { compact: [0, 0], standard: [8, 2.5], airy: [16, 5] }; // [top, bottom] as % of the card width
const TOP_BTN_IDS = ["bell", "view", "diag", "refresh"]; // the small buttons at the top right of the hero (left to right)
const TOP_BTN_LABELS = { diag: "Diagnostics", bell: "Notifications (bell)", view: "View switch (Car View)", refresh: "Refresh" };
const BUTTON_IDS = ["lock", "windows", "trunk", "climate", "tires", "cabin", "flash", "honk", "find"];
const BUTTON_LABELS = {
  lock: "Lock",
  windows: "Windows",
  trunk: "Trunk",
  climate: "Climate",
  tires: "Tyres",
  cabin: "Interior",
  flash: "Lights",
  honk: "Horn",
  find: "Lights + horn",
  refresh: "Refresh",
};

const AUTO_FUEL_RANGE = 940;
const DEFAULTS = {
  prefix: "s05",
  name: "", // empty → device name from the integration (otherwise "Deepal S05")
  image_path: null, // folder with the hero photos (null = automatic)
  layers_path: null, // folder with the layers (null = <card folder>/images/)
  image_scale: 1.2,
  hero_space: "standard", // space around the car in the hero: compact (as before, 0 / 0) | standard (8 / 2.5) | airy (16 / 5)
  image_aspect: null,
  powertrain: "auto", // auto (from the fuel sensors) | phev | ev (electric only)
  fuel_max: 0, // 0 = automatic hybrid full-tank range (940 km)
  fuel_tank_liters: 0, // 0 = tank capacity sensor, otherwise 51 L fallback
  confirm: ["unlock", "trunk", "windows", "lock", "climate"],
  confirm_temp: true, // asks before changing the temperature while the climate is off (the change turns it on)
  order: SECTIONS.slice(),
  hidden: ["charge", "costs"],
  buttons: BUTTON_IDS.slice(),
  buttons_hidden: [],
  top_buttons: ["bell", "view", "diag", "refresh"], // order of the small buttons at the top right
  top_buttons_hidden: [],
  button_layout: "split", // split (main buttons + "More") | grid (rows) | scroll (one scrolling row) | fit (one row, everything fits)
  climate_ui: "circle", // climate tile: steps (target with − / + and a small power button) | circle (classic: one big on/off circle)
  button_primary: 5, // split: how many buttons (from the start of the list) go in the main row
  buttons_more: "collapse", // split: collapse (hidden behind "More") | show
  button_labels: "status", // none | status | title | both
  button_size: "m", // s | m | l
  diag: null, // null = all
  diag_mode: "alerts", // alerts | all
  diag_custom: [],
  diag_ignore: [], // sensors found by "Discovery" that the user dismissed
  hero_show: ["name", "plate", "range", "cloud", "updated"], // what shows on the image: name, plate, range, cloud, updated
  info: ["odometer", "humidity"],
  info_order: ["odometer","outside_temp","inside_temp","humidity","fuel_level","fuel_volume","power_status","charge_status"],
  info_custom: [], // [{entity, label, icon, unit}]
  entities: {},
  images: {},
  climate_on_mode: null,
  tire_min: 2.0, // bar — below this it is "low"
  tire_max: 3.5, // bar — above this it is "high"
  tire_unit: "bar", // bar | kPa | psi
  tire_check: "vehicle", // vehicle = only the vehicle's own warnings · limits = my own limits · both = both
  hero_style: "carview", // hero image: photo (your black photos) | carview (3/4 render in colour; translucent view with cable while charging)
  hero_view: "iso", // Car View hero view: iso (3/4) | top (from above); the button in the hero changes it per device
  car_color: "black", // car colour in the Car View images: black · blue · grey · silver · white
  hero_sky: "off", // Car View background: off (plain black) · auto (sun/moon/clouds by time of day; sun.sun if present) · morning · afternoon · evening · night
  iso_wheels: "cover", // wheels in Car View: cover (20" with caps) · open (20" without caps) · pro (18")
  charge_style: "beside", // line · text · big · beside
  charge_curve: true,
  charging_reminder: true,
  energy_sheet: true, // tapping the Energy/Battery tile opens the history sheet (false = opens the sensor)
  battery_kwh: 0, // battery capacity in kWh; 0 = automatic by vehicle type (PHEV 18.4 / electric 68.8); used for the kWh estimate of charges in the Energy sheet
  status_sub: "roll", // message under "Locked/Unlocked": off · roll (rolling) · ticker (rolling with dots)
  chg_roll: true, // in the Energy tile while charging: alternates "Charging now" ↔ time remaining (scrolls upward)
  air_t1: 22, air_t2: 24, // climate: up to t1 cool air, up to t2 mild, above that warm
  air_c1: "#8ec5ff", air_c2: "#ffcc3d", air_c3: "#ff7a2e", // air colours: cool · mild · warm
  show_customize: true,
  charge_fx: "flow_port", // charging effect on the car: flow_port | flow | port | sweep | none
  toasts: true, // messages on the screen
  card_padding: "half", // normal | half | none (edge-to-edge image)
  popup_padding: "half", // normal | half | none
  target_style: "wheel", // temperature selector in Climate: wheel | bar
  tile_icons: "accent", // accent | neutral | blue | custom
  tile_icon_color: "#63cba3",
  toast_position: "bottom", // on the image: bottom | top (capsule)
  toast_duration: 5, // seconds
  lvl_red: "#f87171", lvl_orange: "#fb923c", lvl_yellow: "#facc15", lvl_green: "#34d399", // battery/fuel level colours
  bat_t1: 30, bat_t2: 50, bat_t3: 70, // battery %: below t1 red, t2 orange, t3 yellow, otherwise green
  fuel_t1: 10, fuel_t2: 25, fuel_t3: 40, // fuel % of the tank
};
// Keys changed from the settings UI
/* Automatic prefix detection: if the configured one is not found (e.g. another device name: mycar_…), we search HA for which prefix holds the vehicle's sensors */
const PFX_SIG = [["lock", "doors"], ["sensor", "battery_level"], ["sensor", "remaining_range"], ["cover", "trunk"], ["cover", "windows"], ["climate", "cabin_climate"], ["binary_sensor", "charging"], ["sensor", "total_odometer"], ["button", "honk_horn"]];
let _pfxCache = { key: "", t: 0, val: null, list: [] };
const pfxCandidates = (hass) => {
  const st = hass?.states || {}, score = {};
  for (const id of Object.keys(st)) {
    const i = id.indexOf("."), d = id.slice(0, i), n = id.slice(i + 1);
    for (const [sd, ss] of PFX_SIG) if (d === sd && n.endsWith("_" + ss) && n.length > ss.length + 1) { const p = n.slice(0, -(ss.length + 1)); (score[p] = score[p] || new Set()).add(sd + "." + ss); }
  }
  return Object.entries(score).map(([p, s]) => [p, s.size]).filter((x) => x[1] >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((x) => x[0]);
};
const effPrefix = (hass, c) => {
  const st = hass?.states, p = c.prefix;
  if (!st || st[`sensor.${p}_battery_level`] || st[`lock.${p}_doors`] || st[`cover.${p}_windows`]) return p;
  const now = Date.now(), key = p;
  if (_pfxCache.key !== key || now - _pfxCache.t > 5000) { const l = pfxCandidates(hass); _pfxCache = { key, t: now, val: l[0] || null, list: l }; }
  return _pfxCache.val || p;
};
/* Independent of the HA language: the integration gives every entity a fixed translation_key (e.g. "remaining_range") in the registry,
   while the entity_id is derived from the translated name. If the expected entity_id is not found, we search by translation_key. */
const TK_SPECIAL = {
  "binary_sensor.cloud_connection": "connected", "binary_sensor.key_fob_battery_low": "key_battery_low",
  "sensor.remaining_charge_time_h_mm": "remaining_charge_time_formatted", "sensor.charging_type": "charge_mode",
  "button.flash_lights_and_honk": "flash_and_honk", "sensor.climate_fan_level": "fan_level",
  "binary_sensor.tire_pressure_warning": "warning_tpms", "binary_sensor.abs_warning": "warning_abs", "binary_sensor.brake_warning": "warning_brake",
  "binary_sensor.brake_fluid_warning": "warning_brake_fluid", "binary_sensor.power_steering_warning": "warning_eps", "binary_sensor.power_limit_warning": "warning_power_limit",
  "binary_sensor.power_system_warning": "warning_power_system", "binary_sensor.traction_battery_low_warning": "warning_traction_battery_low",
  "binary_sensor.12_v_battery_warning": "warning_12v_battery", "binary_sensor.airbag_warning": "warning_airbag",
};
const tkOf = (key) => {
  if (TK_SPECIAL[key]) return TK_SPECIAL[key];
  const s = key.slice(key.indexOf(".") + 1);
  let m = s.match(/^(front_left|front_right|rear_left|rear_right)_(tire_pressure|tire_alarm|window_open|window_opening|seat_heating_level|seat_ventilation_level)$/);
  if (m) return `${m[2]}_${m[1]}`;
  m = s.match(/^(front_left|front_right|rear_left|rear_right)_door$/);
  return m ? `door_${m[1]}` : s;
};
let _tkCache = { reg: null, p: null, idx: null };
const tkIndex = (hass, p) => {
  const reg = hass?.entities;
  if (!reg) return null;
  if (_tkCache.reg === reg && _tkCache.p === p) return _tkCache.idx;
  const byDev = {};
  /* integration: "deepal" or (if its name differs, e.g. a fork) whichever has ≥3 of the vehicle's known translation_keys */
  const sig = new Set(PFX_SIG.map(([d, n]) => tkOf(d + "." + n))), hit = {};
  for (const e of Object.values(reg)) if (e.translation_key && sig.has(e.translation_key)) (hit[e.platform] = hit[e.platform] || new Set()).add(e.translation_key);
  const plat = hit.deepal ? "deepal" : Object.keys(hit).sort((a, b) => hit[b].size - hit[a].size).find((k) => hit[k].size >= 3) || "deepal";
  for (const e of Object.values(reg)) {
    if (e.platform !== plat || !e.translation_key) continue;
    const eid = e.entity_id, d = e.device_id || "_";
    (byDev[d] = byDev[d] || {})[`${eid.slice(0, eid.indexOf("."))}.${e.translation_key}`] = eid;
  }
  const devs = Object.values(byDev);
  const idx = devs.find((m) => Object.values(m).some((eid) => eid.slice(eid.indexOf(".") + 1).startsWith(p + "_"))) || devs[0] || null;
  _tkCache = { reg, p, idx };
  return idx;
};
const resolveId = (hass, c, key) => {
  const ov = c.entities?.[key]; if (ov) return ov;
  const i = key.indexOf("."), p = effPrefix(hass, c), cand = `${key.slice(0, i)}.${p}_${key.slice(i + 1)}`;
  if (!hass?.states || hass.states[cand]) return cand;
  const idx = tkIndex(hass, p);
  return (idx && idx[`${key.slice(0, i)}.${tkOf(key)}`]) || cand;
};
const hasFuel = (hass, c) => c.powertrain === "ev" ? false : c.powertrain === "phev" ? true
  : !!hass?.states && ["fuel_range", "fuel_level"].some((k) => hass.states[resolveId(hass, c, `sensor.${k}`)]);
/* Time/date as the user set them in Home Assistant (profile → language & region: 12/24 h, date order, time zone) */
function haFmt(hass) {
  const l = (hass && hass.locale) || {}, lang = l.language || (hass && hass.language) || "en", tf = l.time_format || "language", df = l.date_format || "language";
  const tz = l.time_zone === "server" && hass && hass.config && hass.config.time_zone ? hass.config.time_zone : undefined, tl = tf === "system" ? undefined : lang, dl = df === "system" ? undefined : lang;
  const hm = (t, seconds=false) => { const o = { hour: tf === "12" ? "numeric" : "2-digit", minute: "2-digit" }; if(seconds===true)o.second="2-digit"; if (tz) o.timeZone = tz; if (tf === "12") o.hour12 = true; else if (tf === "24") { o.hourCycle = "h23"; } try { return new Date(t).toLocaleTimeString(tl, o); } catch (_) { return ""; } };
  const dm = (t, long) => { const o = { day: "numeric", month: long ? "long" : "short" }; if (tz) o.timeZone = tz;
    try { const p = new Intl.DateTimeFormat(dl, o).formatToParts(new Date(t)), d = (p.find((x) => x.type === "day") || {}).value, m = (p.find((x) => x.type === "month") || {}).value;
      if (d && m && (df === "MDY" || df === "YMD")) return `${m} ${d}`; if (d && m && df === "DMY") return `${d} ${m}`; return new Intl.DateTimeFormat(dl, o).format(new Date(t)); } catch (_) { return ""; } };
  const wdm = (t) => { try { return `${new Intl.DateTimeFormat(dl, tz ? { weekday: "long", timeZone: tz } : { weekday: "long" }).format(new Date(t))}, ${dm(t, true)}`; } catch (_) { return dm(t, true); } };
  const wdh = (t) => { try { return `${new Intl.DateTimeFormat(dl, tz ? { weekday: "short", day: "numeric", timeZone: tz } : { weekday: "short", day: "numeric" }).format(new Date(t))} ${hm(t)}`; } catch (_) { return hm(t); } };
  const date=(t)=>{const options={day:'2-digit',month:'2-digit',year:'numeric',...(tz?{timeZone:tz}:{})};try{const formatter=new Intl.DateTimeFormat(dl,options),parts=formatter.formatToParts(new Date(t)),get=type=>parts.find(part=>part.type===type)?.value||'';return df==='DMY'?`${get('day')}/${get('month')}/${get('year')}`:df==='MDY'?`${get('month')}/${get('day')}/${get('year')}`:df==='YMD'?`${get('year')}/${get('month')}/${get('day')}`:formatter.format(new Date(t));}catch(_){return '';}};
  return { hm, dm, wdm, wdh, date, timeZone:tz };
}
const LEVEL_KEYS = ["sensor.battery_level", "sensor.fuel_level", "sensor.remaining_range", "sensor.fuel_range"]; /* levels protected from 0/unavailable values from the API */
const BATT_KWH = { phev: 18.4, ev: 68.8 };
const autoKwh = (hass, c) => (hasFuel(hass, c) ? BATT_KWH.phev : BATT_KWH.ev);
const SETTING_KEYS = Object.keys(DEFAULTS);

const HERO_FILES = {
  off: "hero_off.jpg",
  lights: "hero_lights.jpg",
  unlocked: "hero_unlocked.jpg",
  unlocked_lights: "hero_unlocked_lights.jpg",
  charging: "hero_charging.jpg",
  charging_unlocked: "hero_charging_unlocked.jpg",
  complete: "hero_charge_complete.jpg",
};
// Dashboard images (interior): without / with steering-wheel heating. The air from the vents is an SVG animation.
const DASH_FILES = { dash_off: "dash_off.jpg", dash_off_steer: "dash_off_steer.jpg" };
const HERO_LABELS = {
  dash_off: "Dashboard (air is drawn with SVG)",
  dash_off_steer: "Dashboard · steering wheel heating",
  off: "Off · locked",
  lights: "Lights on",
  unlocked: "Unlocked",
  unlocked_lights: "Unlocked + lights",
  charging: "Charging",
  charging_unlocked: "Charging + unlocked",
  complete: "Charge complete",
};

/* ───────────────────────── Icons ─────────────────────────
 * Design language: thin 1.6 lines, round caps, 24×24 grid, with one
 * "accented" surface (class a) as in manufacturer apps. The shapes
 * take cues from the S05: sloping roof (fastback), thin light bar on the front,
 * rounded door opening. k = filled shape, a = accented surface. */
const BLADE = '<path d="M12 10.4C11.5 6.4 13.3 3.9 15.8 4.4 17.3 4.8 16.9 7.7 13.8 10.7"/>';
const FAN = `${BLADE}<g transform="rotate(120 12 12)">${BLADE}</g><g transform="rotate(240 12 12)">${BLADE}</g><circle cx="12" cy="12" r="1.4" class="k"/>`;
const SEAT = '<path class="k" fill-rule="evenodd" d="M4.6 5.2C4.1 3.3 5.2 1.7 7 1.7c1.7 0 2.8 1.3 2.5 2.9l1.7 7.1c1.2.5 2 .6 3 .6h4.4c1.6 0 2.9 1.2 2.9 2.8 0 1.4-1.1 2.5-2.5 2.5H9.7c-1.2 0-2.2-.8-2.5-1.9zM5.74 5.53L8.04 13.93C8.3 14.45 9.1 14.73 10.2 14.73L18.5 14.73L18.5 15.68L10.2 15.68C9.5 15.68 9.1 14.8 8.96 13.68L6.66 5.28Z"/><path class="k" d="M7.6 19.3h12.4a.9.9 0 0 1 0 1.8H7.6a.9.9 0 0 1 0-1.8z"/>';
const ICONS = {
  /* ── Control buttons ── */
  lock: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><rect x="12" y="22" width="24" height="18" rx="4.5"/><path d="M17 22V16a7 7 0 0 1 14 0v6"/><g opacity=".5"><path d="M24 29v5"/></g></g>',
  unlock: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><rect x="12" y="22" width="24" height="18" rx="4.5"/><path d="M17 22V15a7 7 0 0 1 14 0v2"/><g opacity=".5"><path d="M24 29v5"/></g></g>',
  windowclosed: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><path d="M10 31.5 17 16.2Q18 14 20.4 14H34.5Q38 14 38 17.5V31.5Q38 34 35.5 34H12.5Q9.4 34 10 31.5Z"/><g opacity=".5"><path d="M21 23.5l3 3M26 21l3 3"/></g></g>',
  windowopen: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><path d="M10 31.5 17 16.2Q18 14 20.4 14H34.5Q38 14 38 17.5V31.5Q38 34 35.5 34H12.5Q9.4 34 10 31.5Z"/><g opacity=".5"><path d="M26 19.5v8m-3.5-3.5 3.5 3.5 3.5-3.5"/></g></g>',
  trunk: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><path d="M8.5 14.3C16 14.3 21 14.4 26.5 16.4 31 18 36 20.5 39.6 21.9L38.6 31.5Q38.2 35.9 33.4 35.9H28.5"/><path d="M8.2 35.7H15.9"/><circle cx="22.2" cy="34.6" r="5.7"/></g>',
  trunkopen: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><path d="M8.5 14.3C13 14.3 17 14.3 21 14.9"/><path d="M24.5 15.6C28 11.5 33 8 40.2 6.6"/><path d="M40.2 6.6 40 9.5"/><path d="M39.6 21.9L38.6 31.5Q38.2 35.9 33.4 35.9H28.5"/><path d="M8.2 35.7H15.9"/><circle cx="22.2" cy="34.6" r="5.7"/></g>',
  tirealert: '<path d="M7.8 3.6c-.3 1.1-.9 1.8-1.7 2.7C4.2 8.3 3.2 10 3.2 12.2c0 2.3.7 4.2 2 5.7M16.2 3.6c.3 1.1.9 1.8 1.7 2.7 1.9 2 2.9 3.7 2.9 5.9 0 2.3-.7 4.2-2 5.7"/><path d="M6.4 17.9h11.2"/><path d="M7.2 17.9v2.3M10.1 17.9v2.3M13.9 17.9v2.3M16.8 17.9v2.3" stroke-width="1.5"/><path d="M12 6.6v5.6"/><circle class="k" cx="12" cy="14.9" r=".9"/>',
  chat: '<path class="a" d="M12 4.2c-4.6 0-8.3 2.9-8.3 6.5 0 1.9 1 3.6 2.7 4.8-.1 1.4-.8 2.7-1.8 3.7 2-.1 3.7-.8 5-1.8.8.2 1.6.3 2.4.3 4.6 0 8.3-2.9 8.3-6.5S16.6 4.2 12 4.2z"/><path d="M12 4.2c-4.6 0-8.3 2.9-8.3 6.5 0 1.9 1 3.6 2.7 4.8-.1 1.4-.8 2.7-1.8 3.7 2-.1 3.7-.8 5-1.8.8.2 1.6.3 2.4.3 4.6 0 8.3-2.9 8.3-6.5S16.6 4.2 12 4.2z"/>',
  interioron: '<rect x="2.8" y="4.4" width="18.4" height="6.4" rx="2.4"/><path class="a" d="M9.4 6h5.2v3.2H9.4z"/><circle cx="8.2" cy="16.4" r="3.6"/><circle cx="8.2" cy="16.4" r=".9"/><path d="M4.9 15.7h2.4M9.1 15.7h2.4M8.2 17.4v2.1"/><path d="M14.4 14.2c1.2-1 2.3 1 3.5 0s2.3 1 3.1 0M14.4 17c1.2-1 2.3 1 3.5 0s2.3 1 3.1 0M14.4 19.8c1.2-1 2.3 1 3.5 0s2.3 1 3.1 0" stroke-width="1.3"/>',
  snow: '<path d="M12 3.2v17.6M4.4 7.6l15.2 8.8M4.4 16.4l15.2-8.8"/><path d="M9.7 4.9 12 6.8l2.3-1.9M9.7 19.1 12 17.2l2.3 1.9M5.5 10.2l2.9-.5-.8-2.8M18.5 13.8l-2.9.5.8 2.8M5.5 13.8l2.9.5-.8 2.8M18.5 10.2l-2.9-.5.8-2.8"/>',
  snowoff: '<path d="M12 3.2v17.6M4.4 7.6l15.2 8.8M4.4 16.4l15.2-8.8"/><path d="M9.7 4.9 12 6.8l2.3-1.9M9.7 19.1 12 17.2l2.3 1.9M5.5 10.2l2.9-.5-.8-2.8M18.5 13.8l-2.9.5.8 2.8M5.5 13.8l2.9.5-.8 2.8M18.5 10.2l-2.9-.5.8-2.8"/><path d="M4 4l16 16"/>',
  fan: FAN,
  headlight: '<path class="a" d="M13.4 5.6a6.4 6.4 0 0 1 0 12.8h-1.6V5.6z"/><path d="M3.6 8.6h5.4M3.6 12h5.4M3.6 15.4h5.4"/>',
  horn: '<path class="a" d="M3.6 10.2h3.2l7.4-3.8v11.2l-7.4-3.8H3.6z"/><path d="M6.8 15.2l.9 3.4h2.2l-.9-3"/><path d="M17 9.4a3.6 3.6 0 0 1 0 5.2M19.6 7a7 7 0 0 1 0 10"/>',
  find: '<g transform="translate(12 12) scale(.66) translate(-24 -24)" stroke-width="2.7" fill="none"><path d="M15 15.8H33Q34 15.8 34.6 16.7L37.4 21.3Q38.9 23 38.9 25V36.6Q38.9 39 36.5 39H34.8Q33.7 39 33.2 38L32 35H15.4L14.2 38Q13.7 39 12.6 39H11Q8.5 39 8.5 36.6V25Q8.5 23 10 21.3L12.8 16.7Q13.4 15.8 15 15.8Z"/><path d="M7.5 21.5H10.5M37 21.5H40.3"/><path d="M17.4 28.7H30.6"/><g opacity=".5"><path d="M16.6 9.2 19 13.1M23.8 7.5V12.1M31.2 9.2 28.8 13.1"/></g></g>',
  refresh: '<path d="M19.6 12a7.6 7.6 0 1 1-2.3-5.5"/><path d="M19.7 4.4v4.3h-4.3"/>',
  /* ── General UI ── */
  check: '<path d="M5.2 12.6l4.3 4.3 9.3-9.6"/>',
  power: '<path d="M12 3.2v8.1"/><path d="M7.2 6.6a7.6 7.6 0 1 0 9.6 0"/>',
  alert: '<path d="M12 4.2 21 19.6H3z"/><path d="M12 10v4.1"/><path d="M12 16.9h.01" stroke-width="2.2"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.2"/><path d="M12 7.9h.01" stroke-width="2.2"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  up: '<path d="M6.5 14.5l5.5-5.5 5.5 5.5"/>',
  down: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  chevu: '<path d="M6.5 14.5l5.5-5.5 5.5 5.5"/>',
  chevd: '<path d="M6.5 9.5l5.5 5.5 5.5-5.5"/>',
  chevr: '<path d="M9.5 6.5l5.5 5.5-5.5 5.5"/>',
  pulse: '<path d="M3 12.5h4l2.2-5.5 3.6 11 2.4-5.5H21"/>',
  chevl: '<path d="M14.5 6.5l-5.5 5.5 5.5 5.5"/>',
  sliders: '<path d="M4 7h8.2M17 7h3M4 17h3M12.2 17H20"/><circle cx="14.6" cy="7" r="2.3"/><circle cx="9.6" cy="17" r="2.3"/>',
  eye: '<path d="M2.8 12S6 6.2 12 6.2 21.2 12 21.2 12 18 17.8 12 17.8 2.8 12 2.8 12z"/><circle class="a" cx="12" cy="12" r="2.7"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7"/><path d="M10.2 10.5v5.5M13.8 10.5v5.5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6" class="k"/><path d="M4 17l4.6-4.4 3.2 3 3-3L20 17"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5c0-1.1-.9-2-2-2h-7c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h2"/>',
  /* ── Status / connection / charging ── */
  bolt: '<path class="a" d="M13.2 3 6.4 13.4h4.9L10.6 21l7-10.6h-5z"/>',
  plug: '<path d="M9 3v4.5M15 3v4.5"/><path class="a" d="M6.2 7.5h11.6v3.3a5.8 5.8 0 0 1-11.6 0z"/><path d="M12 16.6V21"/>',
  cloudcheck: '<path d="M7.6 18.4h9.1a3.9 3.9 0 0 0 .6-7.7A5.6 5.6 0 0 0 6.4 9.3a4.6 4.6 0 0 0 1.2 9.1z"/><path d="M9.6 13.7l1.8 1.8 3.1-3.2"/>',
  cloudoff: '<path d="M7.6 18.4h9.1a3.9 3.9 0 0 0 .6-7.7A5.6 5.6 0 0 0 6.4 9.3a4.6 4.6 0 0 0 1.2 9.1z"/><path d="M4 4l16 16"/>',
  /* ── Vehicle ── */
  carside: '<path d="M3.5 15.5v-2.2c0-.7.4-1.3 1-1.6l2.6-1.1 2.1-2.6c.3-.4.8-.6 1.3-.6h4.2c.5 0 1 .2 1.3.6l2 2.6 2.1.7c.6.2 1 .8 1 1.4v2.8"/><path class="a" d="M9.4 8.5l-1.3 2.6h8.2l-1.6-2.6"/><circle cx="7.6" cy="16" r="1.9"/><circle cx="16.6" cy="16" r="1.9"/><path d="M3.5 15.5h2.2M9.5 15.5h5.2M18.5 15.5h2"/>',
  cartop: '<path d="M8.2 3.8h7.6c1.1 0 2 .9 2 2v12.4c0 1.1-.9 2-2 2H8.2c-1.1 0-2-.9-2-2V5.8c0-1.1.9-2 2-2z"/><path class="a" d="M8.4 8.4h7.2l.6 4.1H7.8z"/><path d="M8.6 17.2h6.8"/><path d="M4.6 8.4v2M19.4 8.4v2"/>',
  interior: '<rect x="2.8" y="4.4" width="18.4" height="6.4" rx="2.4"/><path class="a" d="M9.4 6h5.2v3.2H9.4z"/><circle cx="8.2" cy="16.4" r="3.6"/><circle cx="8.2" cy="16.4" r=".9"/><path d="M4.9 15.7h2.4M9.1 15.7h2.4M8.2 17.4v2.1"/><path d="M14.6 14.2h6.2M14.6 17h6.2M14.6 19.8h6.2" stroke-width="1.3"/>',
  steering: '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="1.9"/><path d="M3.9 12h6.2M13.9 12h6.2M12 14v6.2"/>',
  heatwave: '<path d="M8.5 4.5c-1.6 1.6 1.6 3.4 0 5s1.6 3.4 0 5M12.5 4.5c-1.6 1.6 1.6 3.4 0 5s1.6 3.4 0 5M16.5 4.5c-1.6 1.6 1.6 3.4 0 5s1.6 3.4 0 5"/><path d="M6 19h12"/>',
  seat: SEAT,
  seatheat: '<path class="k" fill-rule="evenodd" d="M4.6 5.2C4.1 3.3 5.2 1.7 7 1.7c1.7 0 2.8 1.3 2.5 2.9l1.7 7.1c1.2.5 2 .6 3 .6h4.4c1.6 0 2.9 1.2 2.9 2.8 0 1.4-1.1 2.5-2.5 2.5H9.7c-1.2 0-2.2-.8-2.5-1.9zM5.74 5.53L8.04 13.93C8.3 14.45 9.1 14.73 10.2 14.73L18.5 14.73L18.5 15.68L10.2 15.68C9.5 15.68 9.1 14.8 8.96 13.68L6.66 5.28Z"/><path class="k" d="M7.6 19.3h12.4a.9.9 0 0 1 0 1.8H7.6a.9.9 0 0 1 0-1.8z"/><g fill="none" style="stroke:var(--w,#ff6a4d)" stroke-width="1.5" stroke-linecap="round"><path d="M12.6 10.2c-1.3-1.3 1.3-2.5 0-3.8s1.3-2.5 0-3.8"/><path d="M15.4 10.2c-1.3-1.3 1.3-2.5 0-3.8s1.3-2.5 0-3.8"/><path d="M18.2 10.2c-1.3-1.3 1.3-2.5 0-3.8s1.3-2.5 0-3.8"/></g>',
  seatvent: '<path class="k" fill-rule="evenodd" d="M4.6 5.2C4.1 3.3 5.2 1.7 7 1.7c1.7 0 2.8 1.3 2.5 2.9l1.7 7.1c1.2.5 2 .6 3 .6h4.4c1.6 0 2.9 1.2 2.9 2.8 0 1.4-1.1 2.5-2.5 2.5H9.7c-1.2 0-2.2-.8-2.5-1.9zM5.74 5.53L8.04 13.93C8.3 14.45 9.1 14.73 10.2 14.73L18.5 14.73L18.5 15.68L10.2 15.68C9.5 15.68 9.1 14.8 8.96 13.68L6.66 5.28Z"/><path class="k" d="M7.6 19.3h12.4a.9.9 0 0 1 0 1.8H7.6a.9.9 0 0 1 0-1.8z"/><g fill="none" style="stroke:var(--w,#38bdf8)" stroke-width="1.5" stroke-linecap="round"><path d="M12.4 10.4c0-2.6 1.6-3.4 1.6-5.4"/><path d="M15.6 10.4c0-3.6 1.6-4.6 1.6-7.4"/><path d="M18.8 10.4c0-2.6 1.4-3.4 1.4-5.4"/></g>',
  door: '<path d="M8.4 4.8h7.4c1.1 0 2 .9 2 2v10.4c0 1.1-.9 2-2 2H8.4c-1.1 0-2-.9-2-2V6.8c0-1.1.9-2 2-2z"/><path class="a" d="M6.4 10.2 2.8 7.8v6.6l3.6 1.8z"/><path d="M9 9h6.2l.6 2.4H8.6z"/>',
  hood: '<path d="M3.2 17.6v-4.1l2.2-4.3h13.2l2.2 4.3v4.1z"/><path class="a" d="M7.4 9.2l.9-3.3h7.4l.9 3.3z"/><path d="M6 17.6v2M18 17.6v2"/>',
  /* ── Measurements ── */
  gauge: '<path d="M4.6 17.6a8.2 8.2 0 1 1 14.8 0"/><path class="a" d="M12 14.2l3.6-4.6 1 .8z"/><circle cx="12" cy="14.8" r="1.2" class="k"/>',
  thermo: '<path d="M10 14.2V5.9a2 2 0 1 1 4 0v8.3a3.9 3.9 0 1 1-4 0z"/><path d="M12 9.5v6.3" stroke-width="2"/>',
  drop: '<path class="a" d="M12 3.6s5.4 5.6 5.4 9.6a5.4 5.4 0 0 1-10.8 0c0-4 5.4-9.6 5.4-9.6z"/>',
  fuel: '<path d="M5 20V6.2C5 5.5 5.5 5 6.2 5h5.6c.7 0 1.2.5 1.2 1.2V20M4 20h10"/><path class="a" d="M7 7.6h4.2v3.4H7z"/><path d="M13 9.4h2.2c.8 0 1.5.7 1.5 1.5v4.7a1.5 1.5 0 0 0 3 0V8.3l-2.4-2.4"/>',
  battery: '<rect x="3" y="7.4" width="16.2" height="9.2" rx="2.4"/><path d="M21.4 10.6v2.8"/><path class="a" d="M5.6 10h5.2v4H5.6z"/>',
  battery12: '<rect x="3" y="8.2" width="18" height="11" rx="2.2"/><path d="M7 8.2V5.9h3v2.3M14 8.2V5.9h3v2.3"/><path d="M6.8 13.7h3.2M14.2 13.7h3.2M15.8 12.1v3.2"/>',
  leaf: '<path class="a" d="M5 19c0-8 4.6-13.4 14-14 .4 8.6-4.6 13.6-12.6 13.2"/><path d="M5 19c2.6-4.6 5.4-7 9-8.6"/>',
  road: '<path d="M8.4 3.6 5 20.4M15.6 3.6 19 20.4"/><path d="M12 5v2.6M12 10.7v2.6M12 16.4V19" stroke-width="1.8"/>',
  /* ── Diagnostics (telltales) ── */
  airbag: '<circle cx="12" cy="12" r="9.6" stroke-width="1.7"/><circle cx="11.2" cy="9.1" r="2.4" class="k"/><circle cx="15.6" cy="7.6" r="1.25" class="k"/><path d="M7.9 16.5l3-4" stroke-width="1.8"/><path d="M12.7 13.5l3.1-3" stroke-width="2.3"/><path d="M13.7 14.8l.2 2.2" stroke-width="1.3"/><path d="M17.7 9.2l1-.5" stroke-width="1"/>',
  abs: '<circle cx="12" cy="12" r="9.6" stroke-width="1.7"/><text x="12" y="14.4" text-anchor="middle" font-size="6.6" font-weight="700" font-family="sans-serif" fill="currentColor" stroke="none">ABS</text>',
  brake: '<circle cx="12" cy="12" r="9.6" stroke-width="1.7"/><path d="M7.3 8.6c-1.3 2-1.3 4.8 0 6.8M16.7 8.6c1.3 2 1.3 4.8 0 6.8"/><path d="M12 8.6v3.8"/><path d="M12 15.3h.01" stroke-width="2.1"/>',
  fluid: '<path class="a" d="M12 3.8s5.2 5.4 5.2 9.2a5.2 5.2 0 0 1-10.4 0c0-3.8 5.2-9.2 5.2-9.2z"/><path d="M12 11v3"/><path d="M12 16.4h.01" stroke-width="2"/>',
  engine: '<path d="M4 10v5M20 10v5M6.4 7h2.5l1.2-1.6h4.4L15.7 7h2.4c.5 0 .9.4.9.9v8.4c0 .5-.4.9-.9.9H6.4c-.5 0-.9-.4-.9-.9V7.9c0-.5.4-.9.9-.9z"/><path class="a" d="M9.2 11h5.6v3H9.2z"/>',
  tire: '<circle cx="12" cy="12" r="8.4"/><circle class="a" cx="12" cy="12" r="3.3"/><path d="M12 8.7V3.6M12 20.4v-5.1M8.7 12H3.6M20.4 12h-5.1" stroke-width="1.4"/>',
  key: '<circle cx="7.9" cy="12" r="3.5"/><path d="M11.4 12H21M17.4 12v3.2M20.1 12v2.2"/>',
  speedlimit: '<path d="M4.6 17.6a8.2 8.2 0 1 1 14.8 0"/><path d="M12 14.4l-3.6-3.2"/><path d="M5 20h14" stroke-width="1.8"/>',
};
/* Icons from HA: "mdi:car-brake-abs" etc. (Material Design Icons, Apache-2.0 — already inside HA, no download from the internet) */
const MDI_RE = /^[a-z][a-z0-9]*:[a-z0-9][a-z0-9-]*$/i;
const ICON_VB = {};
const ico = (n, cls = "") => MDI_RE.test(n || "") ? `<ha-icon class="i ${cls}" icon="${n}"></ha-icon>`
  : !ICONS[n] && TT[n] ? tt(n, cls) : `<svg width="24" height="24" class="i ${ICON_VB[n] ? "w " : ""}${cls}" viewBox="${ICON_VB[n] || "0 0 24 24"}" aria-hidden="true">${ICONS[n] || ICONS.info}</svg>`;
/* Diagnostics icons: filled dashboard pictograms (02_telltales.js). Whatever has none of its own goes in the same ring. */
const BADGE_NATIVE = new Set(["airbag", "abs"]); /* already have their own ring (as the user wanted them) */
const icoBadge = (n, cls = "") => TT[n] ? tt(n, cls) : BADGE_NATIVE.has(n) || MDI_RE.test(n || "") ? ico(n, cls)
  : `<svg width="24" height="24" class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.6" stroke-width="1.7"/><g transform="translate(12 12) scale(.58) translate(-12 -12)" stroke-width="2.7">${ICONS[n] || ICONS.info}</g></svg>`;
// Icons offered to the user for their own sensors
const PICKABLE_ICONS = [
  "info", "alert", "gauge", "thermo", "drop", "fuel", "battery", "battery12", "bolt", "plug", "leaf", "road",
  "tire", "tirealert", "brake", "fluid", "engine", "key", "airbag", "abs", "evfault", "turtle", "oil", "door", "hood", "trunk", "seat", "seatheat", "seatvent", "chat", "steering",
  "heatwave", "fan", "headlight", "lock", "cartop", "cloudcheck", "speedlimit",
];



/* ───────────────────────── Telltales ─────────────────────────
 * Filled pictograms on a 32×32 grid, designed like dashboard warning lights
 * (ISO 2575): airbag, ABS, brakes, fluids, batteries, steering, tyre, engine, etc.
 * Colour = currentColor (green / amber / red / grey depending on the state).
 * s = line, no class = filled shape. The "cut-outs" are done with a mask. */
const TT_M = (id, shapes) => `<mask id="tm-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff"/>${shapes}</mask>`;
const TT_BANG = (x, y, h = 5.2, r = 1.4) => `<path class="s" d="M${x} ${y}v${h}"/><circle cx="${x}" cy="${y + h + 3.2}" r="${r}"/>`;
const TT = {
  /* brakes: (!) inside parentheses */
  brake: `<circle class="s" cx="16" cy="16" r="7.6"/>${TT_BANG(16, 11.4, 4.6)}
    <path class="s" d="M7.2 9.4Q3 16 7.2 22.6M24.8 9.4Q29 16 24.8 22.6"/>`,
  /* brake fluid: drop with ! */
  fluid: `${TT_M("fl", '<rect x="14.8" y="12" width="2.4" height="7.2" rx="1.2" fill="#000"/><circle cx="16" cy="22.4" r="1.5" fill="#000"/>')}
    <path mask="url(#tm-fl)" d="M16 3.6c5.2 5.8 8.4 9.8 8.4 14a8.4 8.4 0 0 1-16.8 0c0-4.2 3.2-8.2 8.4-14z"/>`,
  /* 12V battery */
  battery12: `<path class="s" d="M5.2 11.6h21.6a1.6 1.6 0 0 1 1.6 1.6v11.2a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V13.2a1.6 1.6 0 0 1 1.6-1.6z"/>
    <rect x="7" y="7.6" width="5.2" height="4" rx=".9"/><rect x="19.8" y="7.6" width="5.2" height="4" rx=".9"/>
    <path class="s" d="M8 18.6h5.4M10.7 15.9v5.4M18.8 18.6h5.4"/>`,
  /* traction battery low */
  battery: `<rect class="s" x="3.4" y="9.6" width="22.6" height="12.8" rx="3"/><rect x="27.4" y="13.6" width="2.2" height="4.8" rx="1"/>
    <rect x="6.4" y="12.6" width="4.4" height="6.8" rx="1.2"/>${TT_BANG(18.6, 12.6, 3.8, 1.2)}`,
  /* power system: car with a lightning bolt */
  evfault: `${TT_M("ev", '<circle cx="8.6" cy="22.4" r="4" fill="#000"/><circle cx="23.4" cy="22.4" r="4" fill="#000"/><path d="M17.6 10.6l-4.6 6.2h3.4l-1.4 5.2 5.6-7.2h-3.6z" fill="#000"/>')}
    <path mask="url(#tm-ev)" d="M2.6 22.4v-4.6c0-1 .6-1.9 1.6-2.2l3.8-1.3 2.7-4.1c.4-.7 1.2-1.1 2-1.1h6.4c.8 0 1.5.4 2 1l3.1 4.1 2.2.7c1 .3 1.7 1.2 1.7 2.3v5.2z"/>
    <circle cx="8.6" cy="22.6" r="2.6"/><circle cx="23.4" cy="22.6" r="2.6"/>`,
  /* power limitation: tortoise */
  turtle: `${TT_M("tu", '<path d="M16.4 12.4v9.2M10.8 15.4l2.8 6.2M22 15.4l-2.8 6.2M8.6 18.6h14.8" stroke="#000" stroke-width="1.5" stroke-linecap="round" fill="none"/>')}
    <path mask="url(#tm-tu)" d="M5.8 22.4c0-6.2 4.6-10.6 10.6-10.6s10.6 4.4 10.6 10.6z"/>
    <path d="M26.4 17.4c1.3-1.8 3.7-1.9 4.5-.3.6 1.3-.1 3-1.5 3.5l-3.2 1z"/>
    <path d="M9.2 22.4v3.6h3.6v-3.6M20.4 22.4v3.6H24v-3.6"/><path class="s" stroke-width="1.8" d="M6 21.4 3 23.6"/>`,
  /* steering assist: steering wheel with ! */
  steering: `<circle class="s" cx="16" cy="15" r="11.2" stroke-width="2.6"/>
    <path class="s" stroke-width="3" d="M5.2 12.8Q16 17 26.8 12.8"/><circle cx="16" cy="15" r="2.2"/>
    <path class="s" stroke-width="2.3" d="M16 19.4v3.4"/><circle cx="16" cy="25.2" r="1.25"/>`,
  /* tyre pressure: tyre cross-section with ! */
  tirealert: `<path d="M6.67 4.07Q6.67 3.46 7.59 3.46L8.99 3.46Q9.54 3.46 9.54 4.07L9.54 6.64C9.54 9.7 4.53 11.85 4.53 16.13C4.53 20.41 6.97 23.47 9.42 25.31L22.58 25.31C25.03 23.47 27.48 20.41 27.48 16.13C27.48 11.85 22.46 9.7 22.46 6.64L22.46 4.07Q22.46 3.46 23.01 3.46L24.41 3.46Q25.33 3.46 25.33 4.07L25.33 6.64C25.33 9.09 29.0 11.85 29.0 16.13C29.0 21.33 25.76 26.23 25.76 27.57Q25.76 28.49 24.84 28.49L20.93 28.49L20.93 26.72L18.78 26.72L18.78 28.49L17.07 28.49L17.07 26.72L14.93 26.72L14.93 28.49L13.28 28.49L13.28 26.72L11.07 26.72L11.07 28.49L7.16 28.49Q6.24 28.49 6.24 27.57C6.24 26.23 3.0 21.33 3.0 16.13C3.0 11.85 6.67 9.09 6.67 6.64Z"/><path d="M14.44 7.38a1.65 1.65 0 0 1 3.3 0v9.06a1.65 1.65 0 0 1 -3.3 0z"/><circle cx="16.03" cy="21.82" r="1.65"/>`,
  /* key battery */
  key: `<rect class="s" x="4.4" y="4.8" width="14.4" height="22.4" rx="5.6"/><circle class="s" cx="11.6" cy="9.8" r="2"/>
    <circle cx="11.6" cy="15.6" r="1.6"/><circle cx="8.2" cy="19.4" r="1.5"/><circle cx="15" cy="19.4" r="1.5"/><circle cx="11.6" cy="23" r="1.5"/>
    <rect class="s" x="21.4" y="17.6" width="7.4" height="10" rx="1.6" stroke-width="1.9"/><rect x="23.4" y="15.8" width="3.4" height="2" rx=".6"/><rect x="23.2" y="23.4" width="3.8" height="2.8" rx=".5"/>`,
  /* engine (check engine) */
  engine: `<path class="s" stroke-width="2.2" d="M13 8.2h6M16 8.2v3"/>
    <path class="s" stroke-width="2.2" d="M9.8 11.4h12.4l2.2 2.6h2.4v3.2h1.9v5.6h-1.9v2.6h-4.1l-1.7 2H11.2l-2.6-2.8V11.4z"/>
    <path class="s" stroke-width="2.2" d="M9.8 15.2H5.6v7.4h3"/><path class="s" stroke-width="1.8" d="M13.6 17.4h5.2M13.6 21h5.2"/>`,
  /* tailgate open */
  trunk: `${TT_M("tk", '<path d="M12.2 5.6h7.6l1 4.2H11.2z" fill="#000"/><rect x="5.8" y="18.6" width="5.6" height="2.6" rx="1.1" fill="#000"/><rect x="20.6" y="18.6" width="5.6" height="2.6" rx="1.1" fill="#000"/><rect x="13.2" y="19" width="5.6" height="2.6" rx="1" fill="#000"/>')}
    <g mask="url(#tm-tk)"><path d="M7.4 11.8 10.2 3.8c.2-.6.7-1 1.4-1h8.8c.7 0 1.2.4 1.4 1l2.8 8z"/><rect x="3.2" y="14.4" width="25.6" height="10" rx="3.6"/></g>
    <rect x="5.6" y="24.2" width="5" height="3.6" rx="1.2"/><rect x="21.4" y="24.2" width="5" height="3.6" rx="1.2"/>`,
    /* oil pressure / level */
  oil: `<path d="M3.2 12.6l3.6 1.3v-2.4H5.2V9.7h7.8v1.8h-1.6v1.6h5.6l6.6-3 1.3 2.5-6.2 3v7.5c0 1.2-1 2.2-2.2 2.2H9c-1.2 0-2.2-1-2.2-2.2v-2.4L3.2 18.2z"/><path d="M27.6 15.6c1.4 1.8 2.2 3 2.2 4.2a2.2 2.2 0 0 1-4.4 0c0-1.2.8-2.4 2.2-4.2z"/>`,
  /* window up / down */
  window: `<path class="s" stroke-width="2.2" d="M5 27V12.6L9.4 6.2c.4-.6 1-.9 1.7-.9H25c1 0 1.8.8 1.8 1.8V27z"/>
    <path class="s" stroke-width="2" d="M5 14.4h8.2"/>
    <path d="M18.6 11.8l-3.4 4.4h6.8zM18.6 24.2l-3.4-4.4h6.8z"/>`,
};
const tt = (n, cls = "") => `<svg class="tt ${cls}" viewBox="0 0 32 32" aria-hidden="true">${TT[n]}</svg>`;
/* ───── Shared UI tools (card + settings) — whatever is used in 2+ places lives here ───── */
const UI = {
  /* "#rrggbb" → "r,g,b" (or the default d) */
  hex2rgb(h, d) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim()); return m ? [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16)).join(",") : d; },

  /* Sliding "pill" behind the active button (tabs, .seg choices). The container gets the class .hp.
     prev = {x,w} from the previous render (the settings are rebuilt entirely) → the pill starts from there and slides. */
  pill(box, prev, now) {
    /* if the container or button size changes (appearance, translation, font) we measure again without animation */
    if (!box._ro && typeof ResizeObserver === "function") box._ro = new ResizeObserver(() => { const a = box.querySelector(":scope > button.on"); if (!box._pg || !a || box._pg !== `${a.offsetLeft}/${a.offsetWidth}`) UI.pill(box, null, true); });
    if (box._ro) { box._ro.observe(box); box.querySelectorAll(":scope > button").forEach((b) => box._ro.observe(b)); }
    const ab = box.querySelector(":scope > button.on");
    if (!ab || !ab.offsetWidth) { box._pg = ""; return; }
    box.classList.add("hp");
    let p = box.querySelector(":scope > .vpill");
    const fresh = !p;
    if (fresh) { p = document.createElement("i"); p.className = "vpill"; box.appendChild(p); }
    const set = (x, w) => { p.style.width = `${w}px`; p.style.transform = `translateX(${x}px)`; };
    if (fresh || now) {
      p.style.transition = "none";
      set(fresh && prev ? prev.x : ab.offsetLeft, fresh && prev ? prev.w : ab.offsetWidth);
      void p.offsetWidth; p.style.transition = "";
    }
    set(ab.offsetLeft, ab.offsetWidth); box._pg = `${ab.offsetLeft}/${ab.offsetWidth}`;
  },
  pillKey(box) { return box.classList.contains("tabs") ? "tabs" : (d => d.sset?.split("|")[0] || d.k || "")((box.querySelector(":scope > button") || {}).dataset || {}); },
  /* before a root is rebuilt: the pills' positions; after render: pillApply */
  pillSnap(root) {
    const m = new Map();
    root.querySelectorAll(".seg.hp,.tabs.hp").forEach((b) => { const a = b.querySelector(":scope > button.on"), k = UI.pillKey(b); if (a && k) m.set(k, { x: a.offsetLeft, w: a.offsetWidth }); });
    return m;
  },
  pillApply(root, snap) { root.querySelectorAll(".seg,.tabs").forEach((b) => UI.pill(b, snap && snap.get(UI.pillKey(b)))); },

  /* dragging a horizontal list with the mouse (touch uses native scroll). h.start/h.end are called only if a real drag happened;
     the click that follows the drag is swallowed. */
  drag(el, h = {}) {
    let d = null, swallow = false;
    el.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button === 0) { d = { x: e.clientX, l: el.scrollLeft, m: false }; swallow = false; } });
    el.addEventListener("pointermove", (e) => {
      if (!d) return;
      if (!d.m && Math.abs(e.clientX - d.x) > (h.th || 5)) { d.m = true; if (h.start) h.start(e); }
      if (d.m) el.scrollLeft = d.l - (e.clientX - d.x);
    });
    const end = () => { if (!d) return; const m = d.m; d = null; if (m) { swallow = true; setTimeout(() => { swallow = false; }, 50); if (h.end) h.end(); } };
    ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"].forEach((ev) => el.addEventListener(ev, end));
    el.addEventListener("click", (e) => { if (swallow) { e.stopImmediatePropagation(); e.preventDefault(); swallow = false; } }, true);
  },

};

/* Shared header for all sheets (Settings, Notifications, Diagnostics, Energy): icon + title + close */
const sheetHd = (icon, title, sub = "") => `<div class="hd sh"><span class="eic">${ico(icon)}</span><div class="ttl"><h3>${esc(title)}</h3>${sub ? `<small class="ver">${esc(sub)}</small>` : ""}</div><button class="x" data-close aria-label="Close">${ico("close")}</button></div>`;

/* Shared "Loading…" for all sheets: the sheet's icon, a green pulse and a spinning arc */
const LOADER_CSS = `.ldr { display:flex; flex-direction:column; align-items:center; gap:14px; padding:46px 20px; color: var(--ds-fg2); font-size:13.5px; } .ldr .ring { position:relative; width:62px; height:62px; display:grid; place-items:center; } .ldr .ring::before { content:""; position:absolute; inset:7px; border-radius:50%; background: rgba(var(--ds-ok), .24); animation: ds-pulse 1.6s ease-out infinite; } .ldr .ring .arc { position:absolute; inset:0; width:100%; height:100%; animation: ds-spin 1.1s linear infinite; } .ldr .ring .i { --is:24px; position:relative; color: rgb(var(--ds-ok)); }
@keyframes ds-spin { to { transform: rotate(360deg); } } @keyframes ds-pulse { 0% { transform:scale(.7); opacity:.9; } 100% { transform:scale(1.4); opacity:0; } }
`;
const loaderHtml = (icon) => `<div class="ldr" role="status"><span class="ring" style="width:56px;height:56px"><svg class="arc" width="56" height="56" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="27" fill="none" stroke="var(--ds-line)" stroke-width="3"/><circle cx="31" cy="31" r="27" fill="none" stroke="rgb(var(--ds-ok))" stroke-width="3" stroke-linecap="round" stroke-dasharray="46 124"/></svg>${ico(icon)}</span><span>${esc(T("Loading…"))}</span></div>`;
/* English source keys; secondary translations load from lang/<code>.js. */
const LANGS = (window.__DEEPAL_S05_LANGS = window.__DEEPAL_S05_LANGS || {});
const GL = "A-Za-zÀ-ɏͰ-Ͽἀ-῿";
const I18N = {
  lang: "en", wanted: null, ready: true, dict: null, re: null, subs: new Set(), roots: new Map(), extras: {},
  rec: new WeakMap(), arec: new WeakMap(), memo: new Map(), attrs: ["title", "aria-label", "placeholder", "alt"],
  norm(c) { return String(c || "en").toLowerCase().replace("_", "-"); },
  available() { const o = { el: "Ελληνικά", en: "English", es: "Español" }; for (const [k, v] of Object.entries(LANGS)) o[k] = v.name || k; return Object.entries(o); },
  numLocale() { return this.lang === "el" ? "el-GR" : this.lang; },
  _load(code) {
    return new Promise((res) => {
      if (LANGS[code]) return res(true);
      const s = document.createElement("script");
      s.src = `${SCRIPT_BASE}lang/${code}.js?v=${CARD_VERSION}`; s.async = true;
      s.onload = () => res(!!LANGS[code]); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  },
  _set(code, table) {
    this.lang = code; this.memo.clear();
    if (!table) { this.dict = null; this.tdict = null; this.re = null; return; }
    const d = {}, cp = (s, f) => (s ? f(s[0]) + s.slice(1) : s);
    const full = { ...(table.dict || {}), ...(this.extras[code] || {}) }; /* extras: translations from lazy modules (e.g. notifications) */
    for (const [k, v] of Object.entries(full)) {
      if (/\{\d+\}/.test(k)) continue; // keys with {0} are only for T()
      d[k] = v;
      const ku = cp(k, (c) => c.toUpperCase()), kl = cp(k, (c) => c.toLowerCase());
      if (!(ku in d)) d[ku] = cp(v, (c) => c.toUpperCase());
      if (!(kl in d)) d[kl] = cp(v, (c) => c.toLowerCase());
    }
    this.dict = Object.assign(d, {}); this.tdict = full;
    const keys = Object.keys(d).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    this.re = keys.length ? new RegExp(`(?<![${GL}])(?:${keys.join("|")})(?![${GL}])`, "g") : null;
  },
  /* translations brought by a lazy module: { en: {...}, es: {...} } */
  addExtra(map) {
    for (const [code, d] of Object.entries(map || {})) this.extras[code] = { ...(this.extras[code] || {}), ...d };
    if (this.lang !== "en" && LANGS[this.lang]) this._set(this.lang, LANGS[this.lang]); /* no changed(): the module is called by the tab that opens and redraws itself; otherwise the card was rebuilt and the settings window closed/reopened */
  },
  request(want) {
    const code = this.norm(want);
    if (code === this.wanted) return;
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code)) return; // safety: the language code ends up in a file path
    this.wanted = code;
    const base = code.split("-")[0];
    if (base === "en") { this._set("en", null); this.ready = true; this.changed(); return; }
    this.ready = false;
    (async () => {
      let use = null;
      for (const c of [...new Set([code, base, "en"])]) { if (await this._load(c)) { use = c; break; } }
      if (this.wanted !== code) return;
      this._set(use || "en", use ? LANGS[use] : null); this.ready = true; this.changed();
    })();
  },
  changed() { this.prune(); this.roots.forEach((o, r) => this.node(r)); this.subs.forEach((c) => { try { c._built = false; c._sig = null; c._force && c._force(); } catch (_) {} }); },
  tr(s) {
    if (!this.re) return s;
    let o = this.memo.get(s);
    if (o === undefined) { o = s.replace(this.re, (m) => this.dict[m]); if (this.memo.size > 3000) this.memo.clear(); this.memo.set(s, o); }
    return o;
  },
  t(s, a) { let o = (this.tdict && this.tdict[s]) ?? s; return a && a.length ? o.replace(/\{(\d+)\}/g, (m, i) => (a[i] ?? "")) : o; },
  text(n) {
    if(n.parentElement?.closest("[data-ha-name]"))return;
    if (!this.re && !this.rec.has(n)) return;
    const cur = n.nodeValue, r = this.rec.get(n), src = r && r.out === cur ? r.src : cur;
    if (!r && !GREEK.test(cur)) return;
    const out = this.tr(src); this.rec.set(n, { src, out }); if (out !== cur) n.nodeValue = out;
  },
  attr(el, name) {
    if (!this.re && !this.arec.has(el)) return;
    const cur = el.getAttribute(name); if (cur == null) return;
    const m = this.arec.get(el) || {}, r = m[name], src = r && r.out === cur ? r.src : cur;
    if (!r && !GREEK.test(cur)) return;
    const out = this.tr(src); m[name] = { src, out }; this.arec.set(el, m); if (out !== cur) el.setAttribute(name, out);
  },
  node(n) {
    if (n.nodeType === 3) return this.text(n);
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    if (n.nodeType === 1) { if (/^(STYLE|SCRIPT|TEXTAREA)$/.test(n.tagName)) return; for (const a of this.attrs) if (n.hasAttribute(a)) this.attr(n, a); }
    for (let c = n.firstChild; c; c = c.nextSibling) this.node(c);
  },
  /* Cards/windows that left the page no longer keep observers and DOM in memory (connectedCallback registers them again if they return) */
  prune() { for (const [r, o] of this.roots) if (r.host && !r.host.isConnected) { o.disconnect(); this.roots.delete(r); } },
  watch(root) {
    if (this.roots.has(root)) return;
    this.prune();
    const obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "childList") m.addedNodes.forEach((n) => this.node(n));
        else if (m.type === "characterData") { if (!m.target.parentNode || m.target.parentNode.tagName !== "TEXTAREA") this.text(m.target); }
        else if (m.type === "attributes") this.attr(m.target, m.attributeName);
      }
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: this.attrs });
    this.roots.set(root, obs);
    this.node(root);
  },
};
const GREEK = new RegExp(`[${GL}]`);
const T = (s, ...a) => I18N.t(s, a);

/* English source language metadata. {0}, {1} are values the card inserts. */
(window.__DEEPAL_S05_LANGS = window.__DEEPAL_S05_LANGS || {}).en = {name:"English",dict:{}};
/* ───────────────────────── Data ───────────────────────── */
/* Charging effect: coordinates on the 500×278 photos (cable from the socket to the charge port) */
const CHG_PTS = [[500, 248], [480, 246], [440, 243], [400, 241], [376, 237], [367, 231], [370, 226], [390, 222], [430, 220], [470, 217], [486, 213], [486, 209], [470, 205], [454, 201], [442, 190], [434, 168], [430, 146], [424, 126], [417, 115]];
const CHG_PORT = [399, 117];
const smoothPath = (p) => {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
    d += `C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0]} ${c[1]}`;
  }
  return d;
};
const CHG_D = smoothPath(CHG_PTS);
/* Car View charging view (750×500, dec_deepal vista_carga): cable from the ground to the plug, and the port position */
const FAR_ALERT = 0.55; // opacity of the red on the windows of the far side
const CARGA_PTS = [[705, 370], [677, 365], [640, 359], [613, 353], [597, 347], [588, 338], [583, 325], [580, 310], [578, 295], [576, 278], [574, 262], [572, 248], [570, 238]];
const CARGA_PORT = [566, 236];
/* Door handles that light up amber when the vehicle is unlocked: [door, x, y, angle] in layer coordinates (3/4: 750×500, visible side only; top view: 750×750, all 4 doors) */
const HDL_ISO = [["front_left", 505, 207, -12], ["rear_left", 577, 191.5, -12]];
const HDL_TOP = [["front_left", 266, 395], ["rear_left", 266, 515], ["front_right", 484, 395], ["rear_right", 484, 515]];
const CARGA_D = smoothPath(CARGA_PTS);
const OPEN_ITEMS = [
  ["binary_sensor.front_left_door", "Front left door"],
  ["binary_sensor.front_right_door", "Front right door"],
  ["binary_sensor.rear_left_door", "Rear left door"],
  ["binary_sensor.rear_right_door", "Rear right door"],
  ["binary_sensor.front_left_window_open", "Front left window"],
  ["binary_sensor.front_right_window_open", "Front right window"],
  ["binary_sensor.rear_left_window_open", "Rear left window"],
  ["binary_sensor.rear_right_window_open", "Rear right window"],
  ["binary_sensor.hood", "Bonnet"],
  ["binary_sensor.trunk", "Trunk"],
];
// [key, label, icon, severity: r = red when active (critical), y = amber (warning)]
const DIAG = [
  ["binary_sensor.airbag_warning", "Airbag", "airbag", "r"],
  ["binary_sensor.abs_warning", "ABS", "abs", "y"],
  ["binary_sensor.brake_warning", "Brakes", "brake", "r"],
  ["binary_sensor.brake_fluid_warning", "Brake fluid", "fluid", "r"],
  ["binary_sensor.12_v_battery_warning", "12V battery", "battery12", "y"],
  ["binary_sensor.traction_battery_low_warning", "Low traction battery", "battery", "y"],
  ["binary_sensor.power_system_warning", "Power system", "evfault", "r"],
  ["binary_sensor.power_limit_warning", "Power limited", "turtle", "y"],
  ["binary_sensor.power_steering_warning", "Power steering", "steering", "y"],
  ["binary_sensor.tire_pressure_warning", "Tyre pressure", "tirealert", "y"],
  ["binary_sensor.front_left_tire_alarm", "Front left tyre", "tirealert", "y"],
  ["binary_sensor.front_right_tire_alarm", "Front right tyre", "tirealert", "y"],
  ["binary_sensor.rear_left_tire_alarm", "Rear left tyre", "tirealert", "y"],
  ["binary_sensor.rear_right_tire_alarm", "Rear right tyre", "tirealert", "y"],
  ["binary_sensor.key_fob_battery_low", "Key battery", "key", "y"],
];
// Ready-made "info" items: id → [key, label, icon, decimals]
const INFO_ITEMS = {
  odometer: ["sensor.total_odometer", "Odometer", "road", 0],
  outside_temp: ["sensor.outside_temperature", "Outside", "thermo", 1],
  inside_temp: ["sensor.inside_temperature", "Inside", "thermo", 1],
  humidity: ["sensor.cabin_humidity", "Humidity", "drop", 0],
  fuel_level: ["sensor.fuel_level", "Fuel", "fuel", 0],
  fuel_volume: ["sensor.fuel_volume", "Petrol", "fuel", 0],
  power_status: ["sensor.power_status", "Power", "engine", null],
  charge_status: ["sensor.charge_status", "Charging", "plug", null],
};
const INFO_IDS = Object.keys(INFO_ITEMS);

const OTHER_KEYS = [
  "lock.doors", "sensor.battery_level", "sensor.remaining_range", "sensor.fuel_range", "sensor.inside_temperature",
  "sensor.last_updated", "sensor.remaining_charge_time_h_mm", "sensor.ac_charge_current", "sensor.charge_current",
  "sensor.dc_charge_current", "sensor.charging_type", "sensor.license_plate", "binary_sensor.charging",
  "binary_sensor.charger_plugged", "binary_sensor.cloud_connection", "binary_sensor.position_lamp",
  "binary_sensor.low_beam", "binary_sensor.high_beam", "binary_sensor.climate_on", "cover.windows", "cover.trunk",
  "climate.cabin_climate", "button.honk_horn", "button.flash_lights", "button.flash_lights_and_honk",
  "button.refresh_vehicle_data", "switch.steering_wheel_heating",
  "binary_sensor.steering_wheel_heater",
  ...["front_left", "front_right", "rear_left", "rear_right"].flatMap((p) => [`sensor.${p}_tire_pressure`]),
  ...["front_left", "front_right"].flatMap((p) => [`number.${p}_seat_heating_level`, `number.${p}_seat_ventilation_level`]),
];
const TIRES = [ // px/py: label position on the Car View image (%); wx/wy: wheel position (%); hid: the wheel is not visible in the image (estimated position)
  { id: "front_left", px: 15, py: 88, wx: 49.3, wy: 65, hid: false, name: "Front left" },
  { id: "front_right", px: 15, py: 12, wx: 27, wy: 60, hid: true, name: "Front right" },
  { id: "rear_left", px: 86, py: 88, wx: 83, wy: 57, hid: false, name: "Rear left" },
  { id: "rear_right", px: 86, py: 12, wx: 60.5, wy: 52, hid: true, name: "Rear right" },
];
/* Car View: layers 750×500 (source: github.com/manuelem1984/dec_deepal, MIT) */
const CAR_COLORS = [["black", "Black", "#1b1c22"], ["blue", "Blue", "#4a86b8"], ["grey", "Grey", "#6b6d72"], ["silver", "Silver", "#b9bcc0"], ["white", "White", "#f1f2f4"]];
const VIEW_ICON = { iso: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAAA5CAYAAADut6/vAAAWJUlEQVR42t1cW49k11X+zq2qq/o2fZvOONMzHs+M7ZgZ2/EFAnaAQBBCKCKREjkPETwgRMQD8AjvSPAXeCAREhI3cVF4gIDkcHFsB5PY8XVsPLbn2tPtnp6u7rqfOmfzMN+Svlk5VT34Mh6npFKdqjpnn7332mutb31r7ROFEPAxfEX8HNf5BEADwBSAOj9rAJp8pwBW5PyY/9cBTLP9lJ8F332+e+6+V/i9x3cfwMB9L29iPO9JENHHTIB+oBmARQpjAcAhCmNaBJKIIBK+tb2Sbzsn8Djn9yl+RlwUDbZb5/2tHwnPgxP6AECHx9sAWgA2AVzl8fr7EWL0MdTAeQDHANzNyZznZK5yEpdkUmedcGziiwlaHfFtGrTHibZFkQMYUTAFgKEsgoFYhpjtxLJoMraR8JwA4AKAfwRw9sdRA3VVHgHwGZrAGif0AX6W/Bw5rYJ8xjyORUiJ/BeLhhYUVAmgy/cOhdl3bU+J1jWlz6Ucm0bab12OoUZTDQD/AeDJHxcBquA+CeAxAMs8PkKT2QAww/P6nJQBj0eiGUEmMcjEByfgksIbsu1pmrpttplRWCboOoBd+f0ygJdE8AmAgzKmBQB3sd0uz2tTiOZzXwXwdxzHTZnU21GA1vEpCu4kgKMATtNMTgmgsPeQQivkU32ZCix2phJybp+CWQBwht9rvMYWBcTc3c/JPgDgDQB/OmFcGYCvATglvrVH/wgR4iUAf8/Fs68Q09tQcAHAfTSXd3CS7qJ5atPpjygY07IRPwundeB/2v7AaV6g0HIKao6akHN+utJGTTT/G/Sxa2zjMH/vyf118nMAf8PFOMv+LLC9bf4Pjvm3APw1gDf3E2J6mwmvAeALNJP3AriHoKQDYMMBBzOZQRBmEKEECSkgQrMxD0TzDGUeovAGFNa7AD7B31PR2iPUuh/QKgSi4QcBPCXjmQXwK7zfNv3o21yUKQU+xeM6gC2a5TqA3wDwTwD+e5IQbycTeoJadxLAw5ykiAiwI+axxwlWDcwEpJgAhy5s8MjTBJjw+DiAc5zklDB/kRo2dItjisK5QFN3mItvCOB5AN9kn/6AfrsQ8PIukXOT98xoqiP60LZDrf8J4NsOiN0WGqir6ue4Kk/xc54D2RP/1hdzNnKoTgVUillNKgSn18RcHMcpiBavucq5OSKARBFlUzRol8fzvP4rAJ4DcI3ttuVaIxOCjOEQx7lNzeu6Rfd5LpC/Yl9vEOJHpYE2oHkAv8y47nH6h8ABdUTLuhJ/jSpAiRdUyfMzAS2eDSmozas85y2206E2rVLLcmk74v3X+P0Vau9BCnvIdp7n8edF+BGFeZnvB/jbBsdX531jMeulWAkQob74UZtQE95dAB6h2XyU5qrHQZrA+sJmBBmU0mipfC8FuFjMl7rzS0GnTfqy/+Xk7fG8o7I4ImctSpnsK9S6ZQCfEqEOhZ2JRGu6wsrMEjC1qcU1njNkn6fp/xe50Bep8d8C8Ef0l7fEhMYSXBu4+En6uc9y4CkH0REf1+NgCnkHWQQF265agUH4zbICFZqwFwn/53nvESctE4DTEX+qFNsCTVuLbU7znEX6uSkZfxCgMsX77LKtFQpxyHvfxwUxz3MD/29RW+8B8HUAfwyguBUCVNM1DeBX2cnHifD67FxXtK3vKKpQIYRaRfuKPNMKbTXtG3DyLwk9ZkKa46QbG1N3REBGrc157gr/qxEAXeXkj+T+Gm8m4lfr1KqhkAGr/O0ytWyL/lRdh1GI2+mHbCZTApNV3vAAUeYxCtMC2a6EBUPnd4KLEYMzl6FiscQVPjGI8JbkvjOiRQYycglNYonbYmnbLMAd9HnfIRBaoWCGEzIlwWVAzE/XATwL4LsUqC3ETBaSmvH3bUKjitUPiYF+l7HRJQAXSUAf5mp6mqZizlFfxkjEMlA1oeU+Wu6Ddzjh2USs09x1hYg+JCa/Lu2EihgzFiFsCLgoOa6kol/BWYYhF08uYz7gGCOlAiPx7c33IkCfhwsVxMA0Y7pHqHUbNAEJ/YZ1aIW+Ypf/5U5rCg5ulu0ai19z5HBRMeBSEGMpYQg4udvsm3GcK6TO5oTmsuuCaJ8BmiEFnNJsngTwOZ67LWxM7KyCmmL7zMcslHhCHtHynTclwKhCYBEFdYgmZJWDX2bDEf1bKcegPU/EFxzgZHgtm5Pjtqz2mJM7JSu5xjZ6skILCmaO97lImB/LfUf8bohyke12hXWpAkdBzKfFqnOchyF/g8RsHtDNcx4svVUTAeqcxyLEUKEs+2pg5C6cA3AnKa41xj5TYv4i+pOa+DFlFHQVq8Y2K4hlvSeECTEabSDnJZy8nrRZpyYMZYKXZeI0JbTHSV/mWGr8X4Pp2PlW8419CQ8u85yeVABEFZggkUViiDtz404rCPREtLi0vOckAQZO7iOE+qsS9PYEeNQ4QaloQE1uVLr4zS+SyGlYKoK2/jXG9NUC9pyTZiZ3j4BixO8LnOBc+pXw/1c4rqMCGAoKNXfJV6PomgJ+GjSjFkJsuURu6QRvlGAmxETi8og1jsFMfklXsyf5z8OTBFgD8EUAP8POmnnapT9rSGBpPqFD07QkqyY48BHcJJZyzsjFeFFFljwWZJY6liUXKqwk0rW2d+W+IwE6GVNW65JpyDjeRPoRS0ah4KIYUMh1nr/BOTGe1ZdYQLQulsXQE223BHGbVuVOnmvnrZM8qNMKnqgSYB3AH5KTNP7R6kI6vNCg9o44+pgCLTiAaTEZcQWroZnqkcRdI5fTi10GYSScaE3iqXkGuRaabImJi12JQylCSYiOh5Il33VxaCwodkFivoFoUp/X9SWI9+NNJIk7EDOcOis0IjAKjCuN2Vlje+eoLA+lFT7v6wAeEidrGe+cK6Jg51WrDIi8K7B8RirDzDRloj2pxDpRhcMPnJCL9GfGkqwSkCgKHQghbH5FsxSZy0JAyi+2+P8xOW/otE9jzkXJhhQureXrXSx9pcjSBLwrY9Cxm8/eBvAOudWCAjvG8V+z5HPqhPcEgJ8Sp9yRGxrbnrKxxKGkoVBNuWhT14UBKsjMrT4baJ8rr0eh/SIXjxfwM8Il9sVfZk6LSzGfA+ePd6XOJpJzPAmQc1E26V97Yp1MCJf52zzvnUo4YvFiT0IQCCdbyP0DU0uvSwVCi9f+BFH9WROgCeEupvwvCkxtyCq3c3N2ZCSoM5UioQUXUFv7vQoGpRAnbmV6M5yE07QEtTF++in6BGUxzC/1BZVGLk4sKwL+kot1WjSqyjpl/L/nip5soRr4aQgREKQPlzg/fZ7Tk8WruMESyb/GfrSYPLaKhCPKxERS39EWnxPGsC3HaYtrbDQWBj1ysLcmLMMnedNldnxBqssasmhe40ScnoCQX2S5wZxo+jXhVIMLAyLJ4cHlDWNe9y7/bzsyQOPgoRDPljmYk4VdMjY+Isg0Y9stKd9oSzjRkP6YdThBHzjF3+Y4T/9O7V/m974OaEWC37ozPZBONqnGL0idZeTAigcMS5yc56jpq6KRVyiAlCaoJdVms8LgG4J7hsJbllivJb53TkoVIgEYG0JBeX+7Q184wwkbONSbiL9LpX6llLFbhuF+9v0HTJOtMUR51REZhYQ/ufjNNYZtGRfqOhfzEjM4TwqDNLR84AyAv+UqjmjDZ6SyORaT0+AkXRATi4ogXZFXIkBHkVsQ81rI6la/1pXYKxa6rpBrNYTRmDESLQgU/Cb7XzqfZwst4vkLUhpvuck5MXHL9NMHufCm+X6Q5+1wDo2Ifo7CmOV4+pI8LkUbH6MyvUBrN88SjQNE2f/DdhcAnLWBPsG442Wx1dO88SwvmJGbWZwSyaRGY0r1Sol1LLdmHOiO+JSBo5FSMX0zTrtVeH1O4pLUt2zyXqUQDSs0SxYXTol5XOA5s+zDlKDSnH3cpAA2RAixYIRYiOm6IOwmBX1ZMvyJaJEu+MMcyw7787P87xiAX2DW4w4A5/nbUkpz9jmaMi1y3eHxZce+1wVFpQJiUhfrQQSxy0H0XZ1mIhM2VQEsYmfuSod6+4T1izzepGVo4UfL8VeJZI8wiZsL8uwSNMxTs+w3vWeD508JOFMesymEQuIW/DtCgA8FpTfENSUUoH0/RyR6EMBvsr1rfFt13vdTOt2j1CpFjaWr61c0OXBospxAx9UcKErke6gog0+c3ykr6DPjM+e5Ulu0Gjs8booA6vx8g7/dy4l6Q/xRKkI4L9bArMOOgIwhNTaRoqhMiq96kpBusb1X6ftt8V4T7TPgZ/nSAX3lJvu4QuGBbR2kK2gBeDEV8jYXAY4q0hmx0wyf3hj3KioY+cLRY5BVblu1RjTjHvqXEkvNcQLP8vzDdPQ2wXucvHNS6tCk+ZmRyusdttdnWyeEE+2KhdmTqrSB+K6m9PmioNlztGCn2ae3pBJbsw25pM0SmnqL+4ye+1cK9iD7dhbA+VQooi2ZIDUNWYUmFC7EKPepIA7OHOrWrJEQ5wk7nUlqp+faMghvKaErvO4EBbMsZq5GxPw035afXOD1F0Qwm5zIg0IKlPxvnlpjucgG3YJmVUYSImwI8HqA436DwgsSOmiOsMHx3kNz/giA7/OeLQB/SZ8Y8bcnIT6skBWlXGEm3F1aUQVWODTn61JKl0U2FmdWgt9MAIXZd+NaO2INVIC2Wjd4zn2E37P0tbvURsvJ/Tzbe47C2KVPrAvdZW0O2MYSr5kWdFyjNrUllLBYdigm1sxqyT62hNpruKz8yHG9ljr7LkOmh7mgfp/XnsH16u7XAKSpxGItZ84SYUE2pOQP9JtBUNaMbA6pCaUWOVBi4GjXxWO5dNw2fZTuWkW2M1LlbHFlyrjwUQrvAs1ngwN+lCbNkrC2w6kteyYMda5zPpSRsaRth/+nkj1IxTRa4K4l/zXnZvpCKSYSLoGRwJtEnZ/mb6vsb0TN+7bNXSpxUF9MnZrJL9MsbUgtyfck4F8nZ3e3E1Th4kJjLrY5oHtd0K2L52lOSN1VduWSAN4UdGmT+WnLk3ERfAPAV3F9v8W/cTX/syun0ErtpmzkLB3CHvGebVnYmfhSzao33PdYFrvVg9YotC1ZwG2JJcG5CkJsxLheat9RJqYnnGRNmHaDwS8RfptJvF86cJTn/rmYFM//eSCU0TwNpMC1LqY8ZiXby66yK4j/sPrR45I8/gT9TMxQwQpi1yiABzj4g3Lvhmj9HaJtpWTDu8KaJJJaawiL05PxWqVZU441BKlJzrEj1/YE4VtI9R0Av47rhcfneN9L0oda6qD8Q1RRKxXPyND41/1cAW9xolIJbPOKcozIlSdc5CI4QHNmaScDMq8Lh6oZCvOj1yTw7tMvBQB/BuB3aG56XGAPCTkxz7G9VaExOzIxWsibCdleVuyxSISGbDj2KpJMRltcUU8YpkxCiT0pbQT7aYviFYKvdwRkjlJxuqv0FRfpV2x1fpU3bMkKebsiWP6UgABUhB9a12FU1lWaEI03U0ms5g75NgTaL/I6o/Zep29+m/+1pQRkR5iQWddm5HbJ+nJ85UNrzndlsgE0EX/e5f07kpLrypw1RDtT0XD1hbsMJy7TLazQdVl6rwMgMibGkN7r1Iq+ZBhK4QZnZD+6BaxLghZTTt6ey7RDAuOaZOu1biR1nyPnF4OsvIJtGA12HsAPORbbLPIagF/i9c+wnxazZRWZ9tgRCankFjPRNr9lbShPougKYh3J//aalTCoL1xpLCmtJq5vBF2jAF/lwuzTpCpJgZQnNamaVlmcVGyM1PrIkcRGtrVKsxdNlwEfyAaNC2LHlQzvCzioAkCQgqpMAu87ZQxmKWxf+1GmYJ4isntCNLsUINJ0VdKJy7BEbkfTUB540HW5PIgm5m5XcN1ZqC367kyy8THnRxHsXxB57olZjkwDnyTKPM4g8hyRpVVAzYhvMu1oVWzvyp251CdBmAM3cDFNQQ4kHaVVbbnb+xBcyFETcvwkf39Q/MabLMq6AuBfcH0TzW/TZD8r7UDGWHNZleDosa7bfBPER4/E1w0msFKDiu+btCJ1SRSUlIGh2aeYhYjdhp8y5YC/CeD3GHs8zIs6FNSWsPsmrG2p7yhc1jxyeweGUhbXlQzDIba/J9kGBRCly4bHMuiG4zBNcOu4viX5MxKz/Ykrn8hl+9o27zkvfVVzuMvvLS7ATLRtgA/m1RO2qSaLvi4EwLPCu+ZioYoohOD3c88wRrPHeRwQzdvme4uNbcskJq7WJRZfYxp6kp08x84ZfN6WgDh1mleIdjcl8XqQfTPq6wsyKf9F07rmJusyrj9J4rwgx1hqSq0wypdYBgeobsXrBVcgrcKzODukYk/36Dyn6PAfk8YWpRp7jsd1KegZSIJS9/a1hVds01SsiakaSQzWkadPlI4QyNwDdZTKy4REsNdnGfMtCiFuPkfRs6HE3QkTObwFwnrF7YMsXFycyyK6YctdWvFoqJy+41tc8YskUTeJ9OAEuywJ0YaUTxxwrM5Iyv+m5V5W1DQtfOzIcbO6w7WQc3KpGbHXPwD4EoCfJuxe4XXHGGKY/9qQxXWrXi+5IrG+pLR8Wq3tNvGULl96gwCjCtrHzN4mgcDj9FvzuLEaeo+xY7eiw7YAEqklGYq5LMY8DgvuoXGFmOnIPZus4yrh3qSmLUslWUazuk4Tmb3XpwPe5OtlZ+r8M2xKQbheq0oZe5AdVlV7R4LfhRNJphnuEYzP87d1CmaKvxs1NiuV0JGAkqvirJsCJrq6y2afVyZhjT7LzPYQ9IRi2+WC+xpNqdFd5/hWuu/DEFYhIKwUjrl0Seykomg4uKcmBinTD449CnC1LLrvwIhXrTo75QLyboXDx5g98rozNRIS2NfR5BWCg3uYnOcq92gO7yQX2pCA33J9LxDAvIPJzxm9WWEVzrylLiUXXNmIj2lHTmC+4mDg5iwf1++0YndQ5EolCnxwe+R7GL+VrepdSIpnwTEoIxnY93juGVqFDqH348xcXyJQKD8AYZUuPPICS51giopCr2TMvn//MId8nw21iEIIidsuXFZQSTWZvNP4aF51olUNtqfkwQQW8hgbc4DnnyWtdmaf9l8cI7BijKASt38fbouY3xBbVgiiqlLdb1XHmN9uEGDVPr3YmdPUxXl3fwRCrLm0TySx3AJ98YwAsA1q35kxGpa7PXpqBv0TMhKXZdFKAz/B5RgBhArrtq+QJpn9KIQQj9mHF1f4xYYE20r8nrrFglyS0CGRjEAqACyn8DYdjNeNN5GU6E0yhfqwhdhp081oS3DEBCZcv6/QvAD9RkovyLorMUwkgFd2PnbCxy0QbOIebJ5J7s2C8x/KA3tGUvqhWpY6wh77aMV+k10lsPesZTcjwHHPjdZ3zQXWiQg4cUW9UUXZYOz2yceyJe3Uh0BBxZI98CAkcZNV7PMk/EnVdqjwY/tp5vsS2rhnpUUVqLBKmJmL9aKKBxh4wWPM+XnFNVX98QPO8KMP/SmcVpWOBcpxYykfxjz9YdL3cp8J/0DM4vt5ZvY4bawSJMZ8n3T9pGuim5wIn4XwcDyqeDhOqHhcR5igNf+fyY5d5qT8sIWmr/8DDYJ7JnmJ1awAAAAASUVORK5CYII=", top: "data:image/png;base64,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" };
const INT_SIZE = { w: 550, h: 560 };
// interior hotspots: [id, key, icon, label, x%, y%, layer]
const INT_SPOTS = [
  ["sh_l", "number.front_left_seat_heating_level", "seatheat", "Driver seat heating", 19, 29, "seat_heat_driver_on"],
  ["sv_l", "number.front_left_seat_ventilation_level", "seatvent", "Driver seat ventilation", 35, 29, "seat_vent_driver_on"],
  ["st", "switch.steering_wheel_heating", "steering", "Steering wheel heating", 26, 14, "steering_wheel_heat_on"],
  ["sh_r", "number.front_right_seat_heating_level", "seatheat", "Passenger seat heating", 65, 29, "seat_heat_passenger_on"],
  ["sv_r", "number.front_right_seat_ventilation_level", "seatvent", "Passenger seat ventilation", 81, 29, "seat_vent_passenger_on"],
];
const INT_LAYERS = ["seat_heat_driver_on", "seat_heat_passenger_on", "seat_vent_driver_on", "seat_vent_passenger_on", "steering_wheel_heat_on"];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const STATE_TX = { not_charging: "Not charging", charging: "Charging", charge_complete: "Charge complete", charged: "Charge complete", fully_charged: "Charge complete", on: "On", off: "Off", locked: "Locked", unlocked: "Unlocked", open: "Open", closed: "Closed", unknown: "Unknown", unavailable: "unavailable", parked: "Parked", driving: "Driving" };
const stateText = (s) => { const k = String(s).trim().toLowerCase().replace(/[\s-]+/g, "_"); return STATE_TX[k] || cap(String(s).replace(/_/g, " ")); };
const CONF_ICO = { unlock: "unlock", lock: "lock", trunk: "trunkopen", windows: "windowopen", climate: "snow", climate_temp: "snow" };
const CONFIRM_TEXT = {
  unlock: ["Unlock the vehicle?", "The vehicle will unlock."],
  trunk: ["Open the trunk?", "The trunk will open."],
  windows: ["Open the windows?", "All windows will open."],
  lock: ["Lock the vehicle?", "The vehicle will lock."],
  climate: ["Change climate?", "A command will be sent to the vehicle climate."],
  climate_temp: ["Turn on climate?", "Changing the temperature will turn on the car's climate."],
  flash: ["Flash the lights?", "The vehicle lights will flash."],
  honk: ["Sound the horn?", "The vehicle horn will sound."],
  find: ["Locate the vehicle?", "The lights will flash and the horn will sound."],
  refresh: ["Refresh data?", "New data will be requested from the vehicle."],
};
const onlySettings = (o) => { const r = {}; if (o && typeof o === "object" && !Array.isArray(o)) for (const k of SETTING_KEYS) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }; // safety: only known keys pass from stored data
const hexc = (h, d) => (/^#[0-9a-f]{6}$/i.test(String(h || "").trim()) ? String(h).trim() : d); // only #rrggbb: colour values end up in a style attribute
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
const hash32 = (str) => { let h = 2166136261; const t = String(str); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const lsRead = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } };
const lsWrite = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

/* Small YAML serializer for exporting settings */
const yamlScalar = (v) => (typeof v === "string" ? (/^[\w./-]+$/.test(v) && !/^(true|false|null|\d.*)$/.test(v) ? v : JSON.stringify(v)) : String(v));
function toYaml(v, ind = 0) {
  const pad = " ".repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return v.map((x) => (x && typeof x === "object" ? `${pad}-\n${toYaml(x, ind + 4).replace(/^\s+/, " ".repeat(ind + 2))}`.replace(/\n\s*$/, "") : `${pad}- ${yamlScalar(x)}`)).join("\n");
  }
  if (v && typeof v === "object") {
    const ks = Object.keys(v);
    if (!ks.length) return "{}";
    return ks
      .map((k) => {
        const x = v[k];
        if (x && typeof x === "object" && (Array.isArray(x) ? x.length : Object.keys(x).length)) return `${pad}${k}:\n${toYaml(x, ind + 2)}`;
        return `${pad}${k}: ${x && typeof x === "object" ? (Array.isArray(x) ? "[]" : "{}") : yamlScalar(x)}`;
      })
      .join("\n");
  }
  return `${pad}${yamlScalar(v)}`;
}

/* ───────────────────────── Styles ───────────────────────── */
const BASE_CSS = `
[hidden], [data-off] { display:none !important; }
button, input, select { font: inherit; color: inherit; }
.i { width: var(--is, 20px); height: var(--is, 20px); fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round; flex: none; }
.tt { width: var(--is, 30px); height: var(--is, 30px); fill: currentColor; stroke: none; flex:none; } .tt .s { fill:none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
ha-icon.i { --mdc-icon-size: var(--is, 20px); width: var(--is, 20px); height: var(--is, 20px); display:inline-flex; color: inherit; }
.btn.sm:has(.i), .btn.sm:has(.tt) { display:inline-flex; align-items:center; justify-content:center; gap:6px; } .btn.sm .i { --is:16px; }
.btn.pl { background: rgba(var(--ds-info), .18); border-color: rgba(var(--ds-info), .55); }
.row > .tt { --is:24px; color: var(--ds-fg2); } .row.tg.on > .tt { color: rgb(var(--ds-info)); }
.i.w { width: calc(var(--is, 20px) * 1.5); height: auto; overflow: visible; }
.i .a { fill: currentColor; fill-opacity: .2; }
.i .k { fill: currentColor; stroke: none; }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; margin:0; }
.vtop { display:flex; align-items:center; gap:8px; } .vtop .seg { flex:1; min-width:0; } .vtop .x { width:40px; height:40px; }
.seg { display:flex; padding:3px; gap:3px; border-radius:14px; background: var(--ds-soft); border:1px solid var(--ds-line); }
.seg button { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:7px 6px; border-radius:11px;
  border:0; background:transparent; cursor:pointer; font-size:12.5px; font-weight:600; color: var(--ds-fg2); white-space:nowrap; }
.seg button .i { --is:16px; }
.seg button.on { background: rgba(var(--ds-info), .2); color: var(--ds-fg); }
.hp { position:relative; } .hp > button { position:relative; z-index:1; } .seg.hp > button.on, .tabs.hp > button.on { background:none; }
.hp > .vpill { position:absolute; left:0; top:3px; bottom:3px; border-radius:11px; background: rgba(var(--ds-info), .2); pointer-events:none; transition: transform .32s cubic-bezier(.3,.8,.3,1), width .32s cubic-bezier(.3,.8,.3,1); }
.tabs.hp > .vpill { top:0; bottom:0; border-radius:999px; background: rgba(var(--ds-info), .18); border:1px solid rgba(var(--ds-info), .45); box-sizing:border-box; }
.tabs.hp > button.on { border-color:transparent; }
@media (prefers-reduced-motion: reduce) { .hp > .vpill { transition:none; } }
.vstack { display:grid; } .vgrp { grid-area:1 / 1; display:flex; flex-direction:column; justify-content:center; gap:10px; min-width:0; } .vgrp.off { visibility:hidden; pointer-events:none; }
.vtop { flex:none; margin-bottom:10px; }
.vgrp.slide { animation: ds-vfade .2s ease-out; } @keyframes ds-vfade { from { opacity:0; } to { opacity:1; } }
@media (prefers-reduced-motion: reduce) { #vtabs .vpill { transition:none; } .veh .slide { animation:none; } }
.btn { padding:10px 12px; border-radius:14px; border:1px solid var(--ds-line); background: var(--ds-soft); cursor:pointer; font-size:13.5px; font-weight:600; }
.btn.go { background: rgba(var(--ds-ok), .18); border-color: rgba(var(--ds-ok), .5); color: rgb(var(--ds-ok)); }
.btn.sm { padding:6px 10px; font-size:12.5px; border-radius:11px; }
.btnrow { display:flex; gap:8px; } .btnrow > * { flex:1; }
.mv { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--ds-line);
  background:transparent; cursor:pointer; color: var(--ds-fg2); flex:none; padding:0; }
/* drag handle: 2×3 dots */
.grip { flex:none; width:16px; height:24px; margin-right:2px; cursor:grab; touch-action:none; opacity:.55; -webkit-tap-highlight-color:transparent; background: radial-gradient(circle, var(--ds-fg2) 1.5px, transparent 1.9px) 0 0 / 8px 8px; } .grip:hover { opacity:.9; }
.list .row { transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s; } .list .row.drag { transition:none; z-index:5; position:relative; cursor:grabbing; box-shadow: 0 10px 26px rgba(0,0,0,.45); background: linear-gradient(var(--ds-soft), var(--ds-soft)), var(--card-background-color, #1c1c1c); } .list.dragging .grip { cursor:grabbing; } .list.dragging { user-select:none; -webkit-user-select:none; }
.mv .i { --is: 16px; } .mv[disabled] { opacity:.25; cursor:default; }
.sw { position:relative; width:34px; height:20px; border-radius:999px; background: var(--ds-line); transition: background .2s; flex:none; display:block; }
.sw::after { content:""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition: transform .2s; }
.on > .sw, .sw.on { background: rgb(var(--ds-info)); } .on > .sw::after, .sw.on::after { transform: translateX(14px); }
`;
const VARS = `
  --ds-r: 22px; --ds-ok: 52,211,153; --ds-warn: 251,191,36; --ds-bad: 248,113,113; --ds-info: 56,189,248; --ds-ev: 52,211,153; --ds-fu: 52,211,153;
  --ds-fg: var(--primary-text-color, #fff); --ds-fg2: rgba(255,255,255,.72); --ds-fg2: color-mix(in srgb, var(--primary-text-color, #fff) 72%, transparent);
  --ds-line: rgba(var(--rgb-primary-text-color, 255,255,255), .12); --ds-soft: rgba(var(--rgb-primary-text-color, 255,255,255), .06);
`;

const CSS = `
:host { display:block; }
ha-card { ${VARS}
  position: relative; overflow: hidden; padding: 14px; border-radius: 28px; display: flex; flex-direction: column; gap: 16px;
  font-variant-numeric: tabular-nums;
  background: radial-gradient(90% 60% at 0% 0%, rgba(var(--ds-ev), .10), transparent 60%),
    radial-gradient(90% 60% at 100% 0%, rgba(var(--ds-fu), .08), transparent 60%),
    var(--ha-card-background, var(--card-background-color, #1c1c1c)); }
ha-card[data-pad="half"] { padding:7px; gap:12px; }
ha-card[data-pad="none"] { padding:0 0 8px; gap:8px; }
ha-card[data-pad="none"] > :not(.hero):not(.sheet) { margin-inline:3px; }
ha-card[data-pad="none"] > .hero { border-radius:0; }
ha-card[data-ppad="half"] .sheet { padding:5px; } ha-card[data-ppad="half"] .box { padding:8px 7px 6px; }
ha-card[data-ppad="none"] .sheet { padding:0; } ha-card[data-ppad="none"] .box { padding:8px 4px 4px; border-radius:24px 24px 0 0; border-inline:0; border-bottom:0; }
${BASE_CSS}

/* Hero */
.hero { position: relative; overflow: hidden; background: #000; border-radius: var(--ds-r); aspect-ratio: var(--ds-aspect, 16 / 9); isolation: isolate; }
.hbox { position:absolute; left:0; right:0; bottom: calc(100cqw * var(--ds-fx, 0)); top: calc(100cqw * var(--ds-hx, 0)); } /* bottom box with the base ratio: image, Car View, charging effects and charging text are tied to it */
.stage { position:absolute; inset:0; }
.stage img { position:absolute; inset:0; width:100%; height:100%; object-fit: cover; opacity:0; transition: opacity .55s ease;
  transform: scale(var(--ds-scale, 1.2)); transform-origin: center center; }
.stage img.on { opacity:1; }
/* "Car View" hero: 3/4 render with layers; while charging it switches to the translucent view with the cable */
.hcv { position:absolute; inset:0; display:none; z-index:1; }
.hero[data-style="carview"] .stage, .hero[data-style="carview"] .fxs, .hero[data-style="carview"] .fx-handles { display:none !important; }
.hero[data-style="carview"] .hcv { display:block; }
.sky { position:absolute; inset:0; z-index:0; pointer-events:none; display:none; } .hero[data-style="carview"] .sky { display:block; } .sky svg { position:absolute; inset:0; width:100%; height:100%; animation: ds-skyin .8s ease; } @keyframes ds-skyin { from { opacity:0 } }
.hero[data-style="carview"] .shade-left { width:46%; background: linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,.28) 60%, transparent); }
.hero[data-style="carview"] { background: radial-gradient(ellipse 72% calc(.6 * 100cqw / var(--ds-ar0, 1.4)) at 56% calc(100% - .24 * 100cqw / var(--ds-ar0, 1.4)), #3b4654 0%, #1a1e25 58%, #0e0f13 100%); }
.cva::before, .cvb::before { content:""; position:absolute; pointer-events:none; background: radial-gradient(ellipse at center, rgba(0,0,0,.72), rgba(0,0,0,.3) 45%, transparent 72%); filter: blur(6px); }
.cva::before { left:12%; right:8%; top:68%; height:14%; }
.cvb::before { left:11%; right:20%; top:64%; height:12%; }
.cvi { position:absolute; left:50%; top:50%; width:100%; aspect-ratio: 750 / 500; transform-origin: 50.93% 50.3%; transform: translate(-50.93%, -50.3%) scale(var(--ds-cvs, 1.08)); } /* the visible centre of the car (382,251.5 in 750×500) goes exactly to the centre of the hero and the zoom happens around it */
.cvi[hidden], .cvt[hidden] { display:none; }
.cvi:not([hidden]), .cvt:not([hidden]) { animation: ds-fade .4s ease-out; }
/* Top view: the car (layers 750×750, centre 359.5,385.5) is rotated 90° so it faces left like the 3/4 view and fills the wide hero */
.cvt { position:absolute; left:50%; top:50%; width: calc(100% * var(--ds-tvs, .96)); aspect-ratio:1; transform-origin: 49.93% 51.2%; transform: translate(-49.93%, -51.2%) rotate(-90deg); } /* visible centre of the car (374.5,384 in 750×750) at the centre of the hero */
.cvt::before { content:""; position:absolute; inset:5% 24% 3%; pointer-events:none; background: radial-gradient(ellipse at center, rgba(0,0,0,.6), rgba(0,0,0,.28) 48%, transparent 72%); filter: blur(10px); }
.cvt img { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition: opacity .3s ease; }
.cvt img.on { opacity:1; }
.cva, .cvb { position:absolute; inset:0; transition: opacity .6s ease; }
.cvb { opacity:0; transform: translate(2%, 3.5%); } /* the translucent view has a different frame: shifted so the car stays at the same centre */ .hcv.chg .cva { opacity:0; } .hcv.chg .cvb { opacity:1; }
.cva img, .cvb > img:not(.sweep) { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition: opacity .35s ease; }
.cva img.on, .cvb > img.on:not(.sweep) { opacity:1; }
/* Unlocked: the door handles light up (amber, with a soft pulsing glow) */
.hdl { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; opacity:0; transition: opacity .4s ease; filter: drop-shadow(0 0 2px rgba(var(--ds-warn), .95)) drop-shadow(0 0 7px rgba(var(--ds-warn), .6)); }
.hero.unlocked .hdl { opacity:1; }
.hdl rect { fill: rgb(var(--ds-warn)); animation: ds-hdl 2.4s ease-in-out infinite; } .hdl rect.off { display:none; }
@keyframes ds-hdl { 0%, 100% { opacity:.72; } 50% { opacity:1; } }
.cvb > svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.cvb path, .cvb circle { fill:none; visibility:hidden; }
.cvb .cb { stroke-width:5.6; filter: blur(2.4px); }
.cvb .cf { stroke-width:3.4; stroke-dasharray: 7 30; animation: ds-cab2 1.2s linear infinite; }
@keyframes ds-cab2 { to { stroke-dashoffset: -37; } }
.cvb .pr { stroke-width:2; }
.cvb .sweep { object-fit: fill; }
.shade-top, .shade-bot { position:absolute; left:0; right:0; pointer-events:none; z-index:5; }
.shade-top { top:0; height:38%; background: linear-gradient(180deg, rgba(0,0,0,.72), transparent); }
.shade-left { position:absolute; left:0; top:0; bottom:0; width:62%; pointer-events:none; z-index:5; background: linear-gradient(90deg, rgba(0,0,0,.78), rgba(0,0,0,.45) 55%, transparent); }
.shade-bot { bottom:0; height:30%; background: linear-gradient(0deg, rgba(0,0,0,.55), transparent); }
.hero-top { position:absolute; top:0; left:0; right:0; z-index:8; display:flex; justify-content:space-between; align-items:flex-start; padding: 16px 18px; color:#fff; }
.title { font-size: 15px; font-weight: 600; letter-spacing: -.01em; line-height: 1.15; display:flex; align-items:baseline; gap:8px; }
.plate { font-size: 11px; font-weight:500; opacity:.6; letter-spacing:.05em; }
.total { margin-top: 8px; }
.total .w { border-left: 3px solid rgb(var(--ds-ok)); padding-left: 10px; }
.total .big { font-size: 44px; font-weight: 700; letter-spacing: -.03em; line-height: .95; text-shadow: 0 2px 14px rgba(0,0,0,.5); }
.total .big small { font-size: 17px; font-weight: 300; margin-left:4px; opacity:.8; letter-spacing:0; }
.total .cap { margin-top: 5px; font-size: 12px; font-style: italic; font-weight: 300; letter-spacing: .02em; opacity:.8; }
.total .split { margin-top: 6px; display:flex; gap:10px; font-size: 12px; color: rgba(255,255,255,.85); }
.total .split span { display:inline-flex; align-items:center; gap:4px; } .total .split .i { --is: 14px; }
.total .split .e .i { color: rgb(var(--ds-ev)); } .total .split .f .i { color: rgb(var(--ds-fu)); }
.rfs { position:relative; flex:none; width:30px; height:30px; padding:0; border-radius:50%; display:grid; place-items:center; cursor:pointer; color: rgba(255,255,255,.8);
  background: rgba(10,11,15,.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border:1px solid rgba(255,255,255,.16); -webkit-tap-highlight-color: transparent; transition: transform .14s ease; }
.rfs[hidden] { display:none; } .rfs .i { --is:20px; } .rfs:active { transform: scale(.9); } .rfs.ok { color: rgb(var(--ds-ok)); border-color: rgb(var(--ds-ok) / .55); } .rfs.bad { color: rgb(var(--ds-bad)); border-color: rgb(var(--ds-bad) / .55); } .rfs.success { color: rgb(var(--ds-ok)); } .rfs.error { color: rgb(var(--ds-bad)); }
.rfs .bdg { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px; padding:0 4px; box-sizing:border-box; border-radius:8px; background: rgb(var(--ds-bad)); color:#fff; font-size:10px; font-weight:800; font-style:normal; line-height:16px; text-align:center; pointer-events:none; box-shadow:0 0 0 1.5px rgba(10,11,15,.85); }
.rfs .ring { position:absolute; inset:-3px; width: calc(100% + 6px); height: calc(100% + 6px); pointer-events:none; overflow:visible; }
.rfs .ring rect { fill:none; stroke: rgba(255,255,255,.85); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
.meta .dgb:not(.warnb) { color: rgb(var(--ds-ok)) !important; }
.meta .dgb.warnb { color: rgb(var(--ds-warn)) !important; }
.meta [data-uh] { display:none !important; }
/* the buttons at the top right are grouped into ONE glass capsule: same height/alignment, readable over the moon, clouds or a white car */
.meta { display:flex; align-items:center; gap:2px; margin: -4px -6px 0 0; padding:3px; border-radius:999px; background: rgba(10,11,15,.08); border:1px solid rgba(255,255,255,.18); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); box-shadow: 0 2px 10px rgba(0,0,0,.35); }
.meta .rfs { width:30px; height:30px; background:transparent !important; border:0 !important; box-shadow:none !important; backdrop-filter:none; -webkit-backdrop-filter:none; }
.meta .rfs:not(:last-child)::after { content:""; position:absolute; right:-1px; top:8px; bottom:8px; width:1px; background: rgba(255,255,255,.14); }
.meta .rfs:not(:last-child)[hidden]::after { display:none; }
.meta .rfs.ok { background: rgb(var(--ds-ok) / .16) !important; } .meta .rfs.bad { background: rgb(var(--ds-bad) / .16) !important; }
/* Car View: the car (e.g. white or silver, from above, large or in a low hero) can pass behind the buttons at the top right; so they have a darker, blurred background and are visible over any colour */
.hero[data-style="carview"] .rfs { background: rgba(10,11,15,.7); border:1px solid rgba(255,255,255,.26); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 1px 7px rgba(0,0,0,.5); }
.hero[data-style="carview"] .rfs:not(.ok):not(.bad):not(.success):not(.error) { color:#fff; }
.hero[data-style="carview"] .rfs.ok { border-color: rgb(var(--ds-ok) / .6); } .hero[data-style="carview"] .rfs.bad { border-color: rgb(var(--ds-bad) / .6); }
.fx { position:absolute; inset:0; pointer-events:none; display:none; }
.hero.unlocked .fx-handles { display:block; }
.fx-handles { z-index:3; --fx:66.2%; --fy:41.2%; --rx:79.6%; --ry:38.5%; }
.fx-handles .halo, .fx-handles .core { position:absolute; inset:0; }
.fx-handles .halo { filter: blur(4px); animation: ds-glow 2.2s ease-in-out infinite;
  background: radial-gradient(ellipse 4.6% 1.8% at var(--fx) var(--fy), rgba(255,35,15,.95) 0%, rgba(255,25,10,.75) 25%, rgba(255,15,5,.38) 48%, rgba(255,0,0,.12) 70%, rgba(255,0,0,0) 100%),
    radial-gradient(ellipse 4.6% 1.8% at var(--rx) var(--ry), rgba(255,35,15,.95) 0%, rgba(255,25,10,.75) 25%, rgba(255,15,5,.38) 48%, rgba(255,0,0,.12) 70%, rgba(255,0,0,0) 100%); }
.fx-handles .core { filter: blur(1.5px); animation: ds-core 2.2s ease-in-out infinite;
  background: radial-gradient(ellipse 2.3% .7% at var(--fx) var(--fy), rgba(255,130,100,.95) 0%, rgba(255,50,25,.65) 35%, transparent 100%),
    radial-gradient(ellipse 2.3% .7% at var(--rx) var(--ry), rgba(255,130,100,.95) 0%, rgba(255,50,25,.65) 35%, transparent 100%); }
.fxs { position:absolute; inset:0; z-index:3; pointer-events:none; display:none; transform: scale(var(--ds-scale, 1.2)); transform-origin:center center; }
.hero[data-fx]:not([data-fx=""]) .fxs { display:block; }
.fxs svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; } .fxs path, .fxs circle { fill:none; visibility:hidden; }
.cb { stroke: rgb(52,211,153); stroke-width:3.4; opacity:.22; filter: blur(1.6px); }
.cf { stroke: rgb(120,245,190); stroke-width:2.2; stroke-linecap:round; stroke-dasharray: 5 20; filter: drop-shadow(0 0 2px rgb(52,211,153)); animation: ds-cab 1.2s linear infinite; }
@keyframes ds-cab { to { stroke-dashoffset: -25; } }
.pr { stroke: rgb(120,245,190); stroke-width:1.4; transform-box: fill-box; transform-origin:center; opacity:0; animation: ds-ring 2.2s ease-out infinite; } .pr.r2 { animation-delay:1.1s; }
@keyframes ds-ring { 0% { transform: scale(.5); opacity:.95; } 100% { transform: scale(3); opacity:0; } }
.pg { fill: rgb(52,211,153) !important; filter: blur(3px); animation: ds-pg 2.2s ease-in-out infinite; }
@keyframes ds-pg { 0%,100% { opacity:.25; } 50% { opacity:.8; } }
.hero[data-fx~="flow"] .cb, .hero[data-fx~="flow"] .cf, .hero[data-fx~="port"] .pr, .hero[data-fx~="port"] .pg { visibility:visible; }
.sweep { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:none; mix-blend-mode: screen; opacity:.85;
  filter: brightness(2.4) sepia(1) hue-rotate(78deg) saturate(6);
  -webkit-mask-image: linear-gradient(105deg, transparent 45%, #000 50%, transparent 55%); mask-image: linear-gradient(105deg, transparent 45%, #000 50%, transparent 55%);
  -webkit-mask-size: 300% 100%; mask-size: 300% 100%; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; animation: ds-sweep 3.4s ease-in-out infinite; }
.hero[data-fx~="sweep"] .sweep { display:block; }
@keyframes ds-sweep { from { -webkit-mask-position: 100% 0; mask-position: 100% 0; } to { -webkit-mask-position: 0% 0; mask-position: 0% 0; } }
@keyframes ds-glow { 0%,100% { opacity:.30 } 50% { opacity:1 } }
@keyframes ds-core { 0%,100% { opacity:.25 } 55% { opacity:1 } }
/* Notification: a small glass capsule in the centre (bottom or top), with an icon, a colour per type and a timeline; tap to close. It does not span the full width so it does not cover the buttons and information. */
.toast { --tc: 255,255,255; position:absolute; left:50%; right:auto; bottom:12px; top:auto; z-index:40; display:flex; align-items:center; gap:9px; width:max-content; max-width:calc(100% - 28px); box-sizing:border-box; padding:8px 15px 8px 12px; overflow:hidden; font-size:13px; font-weight:500; line-height:1.3; color:#fff;
  border-radius:999px; border:1px solid rgba(var(--tc), .6); background: linear-gradient(0deg, rgba(var(--tc), .16), rgba(var(--tc), .16)), rgba(10,11,15,.9); box-shadow: 0 6px 20px rgba(0,0,0,.5);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); opacity:0; transform: translate(-50%, 14px) scale(.96); pointer-events:none; transition: opacity .22s ease, transform .26s cubic-bezier(.2,.8,.2,1); }
.toast .i { --is:18px; flex:none; color: rgb(var(--tc)); } .toast .tm { min-width:0; overflow-wrap:anywhere; }
.toast .tp { position:absolute; left:14px; bottom:0; height:2px; width:calc(100% - 28px); background: rgb(var(--tc)); transform-origin:left; animation: ds-toast var(--td,5s) linear forwards; }
@keyframes ds-toast { to { transform: scaleX(0); } }
.toast.pos-top { top:12px; bottom:auto; transform: translate(-50%, -14px) scale(.96); }
.toast.show { opacity:1; transform: translate(-50%, 0) scale(1); pointer-events:none; }
.toast.ok { --tc: var(--ds-ok); } .toast.warn { --tc: var(--ds-warn); } .toast.error { --tc: var(--ds-bad); } .toast.info { --tc: var(--ds-info); }
@media (prefers-reduced-motion: reduce) { .toast { transition: opacity .01s; } .toast .tp { animation:none; display:none; } }

/* Buttons (round, like the app) */
.actions { --bs: 52px; container-type: inline-size; padding: 2px 0; }
.actions.sz-s { --bs: 42px; } .actions.sz-l { --bs: 62px; }
.actions.grid { display:grid; grid-template-columns: repeat(5, 1fr); gap: 18px 4px; }
.actions.scroll { display:flex; gap: 12px; overflow-x:auto; scrollbar-width:none; padding: 2px 2px 4px; scroll-snap-type:x proximity; }
.actions.scroll::-webkit-scrollbar { display:none; }
.actions.scroll[data-r] { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); }
.actions.scroll[data-l] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px); mask-image: linear-gradient(90deg, transparent, #000 34px); }
.actions.scroll[data-l][data-r] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); }
.actions.scroll .cell { flex:none; width: calc(var(--bs) + 22px); scroll-snap-align:start; }
.actions.fit { display:flex; gap:4px; justify-content:space-between; }
.actions.fit .cell { flex:1 1 0; } .actions.fit .act { --bs: clamp(32px, 11cqw, 52px); }
.cell { --c: var(--ds-info); display:flex; flex-direction:column; align-items:center; gap:6px; min-width:0; }
.cell.warn { --c: var(--ds-warn); } .cell.bad { --c: var(--ds-bad); }
.cell .cap { max-width:100%; font-size:12px; line-height:1.15; text-align:center; color: var(--ds-fg2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cell .cap.t { color: var(--ds-fg); font-weight:600; font-size:12.5px; }
.cell.warn .cap.s, .cell.bad .cap.s { color: rgb(var(--c)); }
.act { --c: var(--ds-info); position:relative; flex:none; display:grid; place-items:center; width: var(--bs); height: var(--bs); padding:0; cursor:pointer; border-radius:50%;
  border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg);
  -webkit-tap-highlight-color: transparent; transition: transform .14s ease, background .25s ease, border-color .25s ease, box-shadow .25s ease; }
.act .i { width: 46%; height: 46%; color: var(--ds-fg); transition: color .25s ease; } .act .i.w { width: 72%; height: auto; }
.act.ok { --c: var(--ds-ok); } .cell.ok { --c: var(--ds-ok); }
.act.warn { --c: var(--ds-warn); } .act.bad { --c: var(--ds-bad); }
.act.warn:not(.on), .act.bad:not(.on) { border-color: rgba(var(--c), .55); } .act.warn:not(.on) .i, .act.bad:not(.on) .i { color: rgb(var(--c)); }
.act.on { background: rgb(var(--c)); border-color: transparent; box-shadow: 0 6px 18px rgba(var(--c), .35); }
.act.on .i { color:#fff; } .act.on.warn .i { color:#1d1400; }
.act:active:not([disabled]) { transform: scale(.92); } .act:focus-visible { outline: 2px solid rgb(var(--c)); outline-offset: 2px; }
.act[disabled] { opacity:.4; cursor:not-allowed; }
.act .dot { position:absolute; top:5px; right:5px; width:7px; height:7px; border-radius:50%; background: rgb(var(--c)); }
.act.on .dot { background:#fff; }
.act .ring { position:absolute; inset:-3px; width: calc(100% + 6px); height: calc(100% + 6px); pointer-events:none; overflow:visible; }
.act .ring rect { fill:none; stroke: rgb(var(--c)); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
@keyframes ds-dash { to { stroke-dashoffset: -100; } }
.act.success { --c: var(--ds-ok); } .act.error { --c: var(--ds-bad); animation: ds-shake .35s ease; }
@keyframes ds-shake { 25% { transform: translateX(-3px) } 75% { transform: translateX(3px) } }

/* Status over the image */
.status { position:absolute; left:18px; bottom:14px; min-height:36px; z-index:8; max-width: 62%; display:flex; align-items:center; gap:10px; color:#fff; text-shadow: 0 1px 10px rgba(0,0,0,.65); }
.status .i { --is: 24px; color: rgb(var(--st)); filter: drop-shadow(0 1px 6px rgba(0,0,0,.6)); }
.status .t { font-size: 14px; font-weight: 600; line-height:1.2; } .status .s { font-size: 11.5px; opacity:.78; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.status > div { min-width:0; }
/* rolling message under the status (status_sub): same motion as "Charging now" */
.status .s.ok { color: rgb(var(--ds-ok)); opacity:1; } .status .s.w { color: rgb(var(--ds-warn)); opacity:1; } .status .rf.ok { color: rgb(var(--ds-ok)); } .status .rf.w { color: rgb(var(--ds-warn)); } .status .rl.ticker .rf.ok { color: rgba(255,255,255,.74); }
.status .rl { display:flex; align-items:center; gap:8px; } .status .rl .cw { display:grid; overflow:hidden; white-space:nowrap; line-height:1.4; }
.status .rf { grid-area:1/1; font-weight:500; animation-duration:calc(var(--n,2) * 4s); animation-iteration-count:infinite; animation-timing-function:cubic-bezier(.5,0,.1,1); animation-fill-mode:both; }
.status .rl.n2 { --n:2; } .status .rl.n3 { --n:3; } .status .rl.n2 .rf, .status .rl.n2 .rd i { animation-name:ds-r2; } .status .rl.n3 .rf, .status .rl.n3 .rd i { animation-name:ds-r3; }
.status .rd { display:inline-flex; gap:3px; flex:none; } .status .rd i { width:4px; height:4px; border-radius:50%; background:rgba(255,255,255,.28); animation-duration:calc(var(--n,2) * 4s); animation-iteration-count:infinite; animation-fill-mode:both; animation-name:ds-d2; }
.status .rl.n3 .rd i { animation-name:ds-d3; }
/* same motion as "Charging now" (scroll upward + blur), slower: 4 s per message, 0.8 s scroll; the next one enters exactly as the previous leaves (no gap) */
@keyframes ds-r2 { 0% { transform:translateY(120%); opacity:0; filter:blur(5px); } 10%,50% { transform:translateY(0); opacity:1; filter:blur(0); } 60% { transform:translateY(-120%); opacity:0; filter:blur(5px); } 60.01%,100% { transform:translateY(120%); opacity:0; filter:blur(5px); } }
@keyframes ds-r3 { 0% { transform:translateY(120%); opacity:0; filter:blur(5px); } 6.67%,33.33% { transform:translateY(0); opacity:1; filter:blur(0); } 40% { transform:translateY(-120%); opacity:0; filter:blur(5px); } 40.01%,100% { transform:translateY(120%); opacity:0; filter:blur(5px); } }
@keyframes ds-d2 { 0%,48% { background:rgb(var(--ds-ok)); } 50%,100% { background:rgba(255,255,255,.28); } }
@keyframes ds-d3 { 0%,31% { background:rgb(var(--ds-ok)); } 33.3%,100% { background:rgba(255,255,255,.28); } }
@media (prefers-reduced-motion: reduce) { .status .rf { animation:none; } .status .rf:not(:first-child), .status .rd { display:none; } }

/* Temperature / battery tiles */
.stats { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.t2 { position:relative; overflow:hidden; min-height:118px; padding: 10px 14px 12px; border-radius: 22px; background: var(--ds-soft); border:1px solid var(--ds-line); text-align:left; color: var(--ds-fg); }
.t2[data-open] { cursor:pointer; -webkit-tap-highlight-color: transparent; transition: transform .14s ease; } .t2[data-open]:active { transform: scale(.985); }
.t2 .tt { position:relative; z-index:1; font-size: 14.5px; font-weight: 600; letter-spacing:-.01em; }
.t2 .ts { margin-top: 4px; font-size: 12.5px; color: var(--ds-fg2); line-height:1.35; }
.t2 .ts b { font-weight:600; color: var(--ds-fg); font-size: 13px; }
.t2 .ts.chg, .t2 .ts.chg b { color: rgb(var(--ds-ok)); } .t2.batt .ts { max-width: 58%; } .t2 .ts .sub { font-size: 12px; color: var(--ds-fg2); }
/* "Charging now" ↔ time remaining: fast upward scroll with blur (6 s cycle, ~2.5 s rest). --d keeps the phase the same when the tile is rebuilt. */
.t2 .ts.chg .cw { display:grid; overflow:hidden; white-space:nowrap; line-height:1.5; }
.t2 .ts.chg .cf { grid-area:1/1; animation-duration:6s; animation-timing-function:cubic-bezier(.5,0,.1,1); animation-iteration-count:infinite; animation-fill-mode:both; animation-delay:var(--d,0s); }
.t2 .ts.chg .cf1 { animation-name:ds-chgo; } .t2 .ts.chg .cf2 { animation-name:ds-chgi; }
@keyframes ds-chgo { 0%,40% { transform:translateY(0); opacity:1; filter:blur(0); } 44% { filter:blur(3px); } 48% { transform:translateY(-120%); opacity:0; filter:blur(5px); } 48.1%,90% { transform:translateY(120%); opacity:0; filter:blur(5px); } 96% { filter:blur(3px); } 100% { transform:translateY(0); opacity:1; filter:blur(0); } }
@keyframes ds-chgi { 0%,40% { transform:translateY(120%); opacity:0; filter:blur(5px); } 44% { filter:blur(3px); } 48%,90% { transform:translateY(0); opacity:1; filter:blur(0); } 94% { filter:blur(3px); } 98%,100% { transform:translateY(-120%); opacity:0; filter:blur(5px); } }
@media (prefers-reduced-motion: reduce) { .t2 .ts.chg .cf { animation:none; } .t2 .ts.chg .cf2 { display:none; } }
.gauge .fg { stroke: rgb(var(--ds-ev)); opacity:.28; }
.gauge .fp { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 3px rgba(var(--ds-ev), .9)); animation: ds-chgflow 2.4s cubic-bezier(.45,.05,.55,.95) infinite, ds-chgfade 2.4s linear infinite; }
@keyframes ds-chgflow { from { stroke-dashoffset: var(--fs); } to { stroke-dashoffset: var(--fe); } }
@keyframes ds-chgfade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
.t2 .lg { margin-top: 10px; display:flex; flex-direction:column; gap:3px; font-size:12px; }
.t2 .lg span { display:flex; align-items:center; gap:4px; } .t2 .lg .i { --is: 14px; } .t2 .lg b { color: var(--ds-fg); font-weight:600; }
.t2 .lg small { color: var(--ds-fg2); font-size: 11.5px; }
/* Climate tile: temperature inside, target with ± and an on/off button */
.t2.temp { display:grid; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr auto; align-items:start; min-height:132px; }
.t2.temp .tt { grid-column:1; grid-row:1; align-self:start; } /* same title height as the Energy tile (it used to sit 2px lower because of the button) */
.tpw { --kc: var(--ds-info); grid-column:2; grid-row:1; position:relative; width:40px; height:40px; margin:-6px -8px 0 0; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); display:grid; place-items:center; padding:0; cursor:pointer; color: var(--ds-fg2); -webkit-tap-highlight-color: transparent; transition: background .25s ease, color .25s ease, transform .14s ease, box-shadow .25s ease; }
.tpw .i { --is:18px; } .tpw:active { transform: scale(.92); } .tpw[disabled] { opacity:.4; cursor:not-allowed; }
.tpw.on { background: rgb(var(--kc)); border-color: transparent; color:#fff; box-shadow: 0 4px 14px rgba(var(--kc), .4); }
.tpw:focus-visible, .cs:focus-visible { outline: 2px solid rgb(var(--ds-info)); outline-offset: 2px; }
.tpw .ring { position:absolute; inset:-3px; width: calc(100% + 6px); height: calc(100% + 6px); pointer-events:none; overflow:visible; }
.tpw .ring rect { fill:none; stroke: rgb(var(--kc)); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
.t2.temp .ct { grid-column:1 / -1; grid-row:2; align-self:center; display:flex; align-items:baseline; gap:8px; padding-top:2px; }
.t2.temp .cur { font-size:38px; font-weight:300; letter-spacing:-.03em; line-height:1; color: var(--ds-fg); }
.t2.temp .lbl { font-size:12px; color: var(--ds-fg2); }
.cstep { grid-column:1 / -1; grid-row:3; display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:6px; padding:3px; border-radius:999px; background: rgba(0,0,0,.22); border:1px solid var(--ds-line); }
.cstep.idle .cv b { color: var(--ds-fg2); }
.cs { width:34px; height:34px; flex:none; border-radius:50%; border:0; display:grid; place-items:center; padding:0; cursor:pointer; background: var(--ds-soft); color: var(--ds-fg); -webkit-tap-highlight-color: transparent; transition: transform .12s ease, background .2s ease; }
.cs .i { --is:16px; } .cs:active { transform: scale(.9); background: rgba(var(--ds-info), .25); } .cs[disabled] { opacity:.4; }
.cv { display:flex; flex-direction:column; align-items:center; line-height:1.1; min-width:0; } .cv small { font-size:11px; color: var(--ds-fg2); } .cv b { font-size:15px; font-weight:600; color: rgb(var(--ds-info)); }
.gauge { position:absolute; right:-35px; bottom:-35px; width: 150px; height: 150px; pointer-events:none; }
.gauge svg { width:100%; height:100%; overflow:visible; }
.gauge circle { fill:none; stroke-linecap:round; } .gauge .tr { stroke: var(--ds-line); }
.gauge .ev { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 4px rgba(var(--ds-ev), .5)); transition: stroke-dasharray .8s ease; }
.gauge .fu { stroke: rgb(var(--ds-fu)); transition: stroke-dasharray .8s ease; }
.gauge .c { position:absolute; inset:0; display:grid; place-items:center; font-size:29px; font-weight:700; letter-spacing:-.03em; color: var(--ds-fg); }
.gauge .c { display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1.05; }
.gauge .c .gf { display:inline-flex; align-items:center; gap:2px; font-size:15px; font-weight:700; letter-spacing:-.02em; margin-top:2px; } .gauge .c .gf svg.i { width:14px; height:14px; transform:none; overflow:visible; }
.gauge .c small { font-size:12px; font-weight:500; color: var(--ds-fg2); }
.knob { --kc: var(--ds-info); position:absolute; right:-18px; bottom:-16px; width: 112px; height: 112px; border-radius:50%; border:0; cursor:pointer; padding:0;
  display:grid; place-items:center; box-sizing:border-box;
  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.16), rgba(255,255,255,.05) 70%); box-shadow: inset 0 0 0 1px var(--ds-line), 0 10px 24px rgba(0,0,0,.25);
  -webkit-tap-highlight-color: transparent; transition: background .3s ease, transform .14s ease, box-shadow .3s ease; }
.knob .i { --is: 32px; color: var(--ds-fg2); transition: color .3s ease; }
.knob.on { background: radial-gradient(circle at 35% 30%, rgba(var(--kc), .95), rgba(var(--kc), .7)); box-shadow: 0 10px 28px rgba(var(--kc), .4); } .knob.on .i { color:#fff; }
.knob:active { transform: scale(.94); } .knob[disabled] { opacity:.4; }
.knob .ring { position:absolute; inset:-2px; width: calc(100% + 4px); height: calc(100% + 4px); pointer-events:none; overflow:visible; }
.knob .ring rect { fill:none; stroke: rgb(var(--kc)); stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
.t2.batt { container-type: inline-size; }
@container (max-width: 175px) { .gauge { width:116px; height:116px; right:-28px; bottom:-28px; } .gauge .c { font-size:22px; } .gauge .c .gf { font-size:12px; } .gauge .c small { font-size:10px; } .t2.batt .ts { max-width: 100%; } .t2.batt .lg { margin-top:6px; } }

/* Vehicle */
.veh { display:flex; flex-direction:column; gap:10px; flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; } .veh::-webkit-scrollbar { display:none; }
.box.wide { padding-bottom:14px; }
.dash { position:relative; width:100%; aspect-ratio: 510 / 285; background:#000; border-radius: var(--ds-r); overflow:hidden; }
.dash img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition: opacity .5s ease; }
#vclim .dash { container-type:inline-size; }
.dash::after { content:""; position:absolute; inset:0; pointer-events:none; background: linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0) 35%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6)); }
.dov { position:absolute; inset:0; z-index:3; pointer-events:none; }
/* the temperature on the car's screen (same position as the screen in the photo) */
.dscr { position:absolute; left:39.2%; top:24.5%; width:23%; height:27%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:2.2cqw; background: rgba(2,4,8,.82); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), 0 0 3cqw rgba(56,189,248,.12); }
.dbig { font-size: clamp(18px, 6.6cqw, 44px); font-weight:300; letter-spacing:-.03em; line-height:1; } .dbig small { font-size:.42em; font-weight:400; margin-left:1px; letter-spacing:0; opacity:.85; }
.dst { display:inline-flex; align-items:center; gap:.9cqw; margin-top:.8cqw; font-size: clamp(9px, 2.4cqw, 14px); font-weight:600; letter-spacing:.06em; text-transform:uppercase; opacity:.85; }
.dst i { width: clamp(5px, 1.2cqw, 7px); height: clamp(5px, 1.2cqw, 7px); border-radius:50%; background: rgb(var(--ds-bad)); box-shadow:0 0 6px rgb(var(--ds-bad)); } .dst.on i { background: rgb(var(--ds-ok)); box-shadow:0 0 6px rgb(var(--ds-ok)); }
.dov .dpw { position:absolute; right:10px; top:10px; --bs:42px; pointer-events:auto; background: rgba(10,11,15,.7); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.dash .air { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; opacity:0; transition: opacity .6s ease; }
.dash.air .air { opacity:1; }
.air { --sp: 1; --a0:#eaf6ff; --a1:#b9dcff; --a2:#8ec5ff; }
.air .st { fill:none; stroke-linecap:round; stroke-dasharray: 62 38; transform-box: fill-box; transform-origin: 50% 0%; animation: ds-flow calc(var(--t, 2.4s) / var(--sp)) linear infinite, ds-sway calc(var(--w, 3.6s) / var(--sp)) ease-in-out infinite; animation-delay: var(--d, 0s), var(--d, 0s); }
@keyframes ds-sway { 0%,100% { transform: translateX(-2.2px) skewX(-5deg); } 50% { transform: translateX(2.2px) skewX(5deg); } }
.air .bg { opacity:.85; animation: ds-air 3.2s ease-in-out infinite; animation-delay: var(--d, 0s); mix-blend-mode: screen; }
@keyframes ds-flow { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
@keyframes ds-air { 0%,100% { opacity:.62 } 50% { opacity:1 } }
.dash .spot { z-index:2; }
.vmiss { padding:18px 12px; text-align:center; font-size:12.5px; color: var(--ds-fg2); }
.ipane .sbtn { position:absolute; transform: translate(-50%,-50%); width:54px; padding:9px 0 7px; gap:5px; border-radius:18px; background: rgba(14,15,20,.66); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color:#fff; border-color: rgba(255,255,255,.2); }
.ipane .sbtn:active { transform: translate(-50%,-50%) scale(.94); } .ipane .sbtn .nm { display:none; } .ipane .sbtn .i { --is:28px; }
.sbtn { --c: var(--ds-info); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px 2px 9px; min-width:0; border-radius:20px; cursor:pointer; color: var(--ds-fg2);
  border:1px solid var(--ds-line); background: var(--ds-soft); -webkit-tap-highlight-color: transparent; transition: transform .12s ease, background .2s ease, border-color .2s ease; }
.sbtn.hot { --c: 251,113,60; } .sbtn.cool { --c: 56,189,248; } .sbtn:active { transform: scale(.94); }
.sbtn .i { --is: 30px; } .sbtn .nm { font-size:10.5px; line-height:1.15; text-align:center; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sbtn.lv { border-color: rgba(var(--c), .7); background: rgba(var(--c), .16); color: var(--ds-fg); } .ipane .sbtn.lv { background: rgba(14,15,20,.74); } .sbtn.lv .i { color: rgb(var(--c)); --w: currentColor; }
.sbtn .lvl { display:flex; gap:3px; height:4px; } .sbtn .lvl i { width:10px; height:4px; border-radius:2px; background: var(--ds-line); } .sbtn .lvl i.f { background: rgb(var(--c)); }
.sbtn .lvl[hidden] { display:flex !important; visibility:hidden; }
.isop { container-type: inline-size; border-radius: var(--ds-r); overflow:hidden; position:relative; width:100%; flex:1 1 auto; display:flex; align-items:center; background: radial-gradient(ellipse 70% 55% at 50% 72%, #3b4654 0%, #181b21 62%, #0e0f13 100%); }
.isop.noimg { display:none; }
.isoi { position:relative; width:100%; aspect-ratio: 750 / 500; flex:none; }
.vgrp > .vcol { flex:1 1 auto; }
.isop svg.tl { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1; } .isop svg.tl line { stroke-width:1.2; stroke-linecap:round; opacity:.6; } .isop svg.tl line.hid { stroke-dasharray: 5 5; opacity:.45; } .isop svg.tl .halo { opacity:.25; } .isop svg.tl circle.hid { fill:none; stroke-width:1.4; stroke-dasharray: 3 3; opacity:.7; }
.isop .tp { position:absolute; z-index:2; transform: translate(-50%,-50%); padding:8px 12px; border-radius:14px; border:1px solid; background: rgba(14,15,20,.72); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); text-align:center; line-height:1.15; font-weight:700; white-space:nowrap; }
.isop .tp .n { font-size:clamp(12px,1.8cqw,14px); font-weight:600; color:var(--ds-fg2); margin-bottom:3px; } .isop .tp .v { font-size:clamp(20px,3cqw,24px); display:flex; align-items:baseline; justify-content:center; gap:4px; } .isop .tp .u { font-size:clamp(11px,1.6cqw,13px); font-weight:500; } .isop .tp .check { font-size:14px; margin-left:2px; } .isop .tp .s { font-size:clamp(11px,1.6cqw,12px); font-weight:600; margin-top:3px; white-space:normal; max-width:140px; } .isop .tp .s:empty { display:none; }
.isop .tp.ok { border-color: rgba(var(--ds-ok), .4); color: rgb(var(--ds-ok)); background: rgba(14,24,22,.78); } .isop .tp.bad { border-color: rgb(var(--ds-bad)); color: rgb(var(--ds-bad)); background: rgba(var(--ds-bad), .18); animation: ds-pill 1.8s ease-in-out infinite; } .isop .tp.na { border-color: rgba(148,163,184,.7); color: rgb(148,163,184); }
.isop svg.tl .ok { stroke: rgb(var(--ds-ok)); fill: rgb(var(--ds-ok)); } .isop svg.tl .bad { stroke: rgb(var(--ds-bad)); fill: rgb(var(--ds-bad)); } .isop svg.tl .na { stroke: rgb(148,163,184); fill: rgb(148,163,184); } .isop svg.tl circle:not(.hid) { stroke:none; }
@keyframes ds-pill { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
.isop img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; opacity:0; transition: opacity .3s ease; pointer-events:none; } .isop img.on { opacity:1; }
#vtabs button .tx { white-space:nowrap; } @media (max-width:430px) { #vtabs button:not(.on) .tx { display:none; } }
.ipane { border-radius: var(--ds-r); overflow:hidden; position:relative; width:100%; flex:1 1 auto; display:flex; align-items:center; background: radial-gradient(ellipse 70% 55% at 50% 72%, #3b4654 0%, #181b21 62%, #0e0f13 100%); }
/* the photo fades very softly into the background (same as Car View), not into a black frame */
.ipi img { -webkit-mask-image: radial-gradient(ellipse 62% 60% at 50% 50%, #000 46%, rgba(0,0,0,.9) 60%, rgba(0,0,0,.6) 76%, rgba(0,0,0,.22) 90%, transparent 100%); mask-image: radial-gradient(ellipse 62% 60% at 50% 50%, #000 46%, rgba(0,0,0,.9) 60%, rgba(0,0,0,.6) 76%, rgba(0,0,0,.22) 90%, transparent 100%); }
.ipi { position:relative; width:100%; aspect-ratio: ${INT_SIZE.w} / ${INT_SIZE.h}; flex:none; }
.ipane img { position:absolute; inset:0; width:100%; height:100%; transition: opacity .35s ease; }
.ipane img.l { opacity:0; } .ipane img.l.on { opacity:1; }
.spot { --c: var(--ds-info); position:absolute; transform: translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:3px; padding:6px 8px; min-width:44px;
  border-radius:16px; cursor:pointer; border:1px solid rgba(255,255,255,.16); background: rgba(14,15,20,.62); color:#fff;
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); -webkit-tap-highlight-color: transparent; transition: transform .12s ease, border-color .2s ease; }
.spot.lv { border-color: rgba(var(--c), .65); } .spot.hot { --c: 251,113,60; } .spot.cool { --c: 56,189,248; }
.spot .i { --is: 20px; } .spot.lv .i { color: rgb(var(--c)); } .spot:active { transform: translate(-50%,-50%) scale(.93); }
.spot .lvl { display:flex; gap:2px; } .spot .lvl i { width:7px; height:3px; border-radius:2px; background: rgba(255,255,255,.25); } .spot .lvl i.f { background: rgb(var(--c)); }
.spot .nm { font-size:9.5px; opacity:.75; white-space:nowrap; }
.vcol { display:flex; flex-direction:column; gap:10px; }
/* Number picker (adapted from deepal-number-picker) */
.pk { position:relative; padding: 12px 0 10px; border-radius:18px; background: var(--ds-soft); border:1px solid var(--ds-line); user-select:none; -webkit-user-select:none; --pkbg: var(--ha-card-background, var(--card-background-color, #1c1c1c)); }
.cseats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding-top:2px; }
.cseats .sbtn { background:none; border:0; padding:0; gap:5px; min-width:0; }
.cseats .sbtn .cc { width:54px; height:54px; border-radius:50%; display:grid; place-items:center; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg2); transition: background .2s, border-color .2s, color .2s; }
.cseats .sbtn .cc .i { --is:24px; }
.cseats .sbtn.lv .cc { border-color: rgba(var(--c), .75); background: rgba(var(--c), .18); color: rgb(var(--c)); box-shadow: 0 0 14px rgba(var(--c), .25); }
.cseats .sbtn:active .cc { transform: scale(.94); }
.cseats .sbtn .nm { white-space:normal; line-height:1.15; min-height:2.3em; font-size:10.5px; color: var(--ds-fg2); display:block; text-align:center; overflow:visible; }
.cseats .sbtn.lv .nm { color: var(--ds-fg); }
.cseats .sbtn .lvl { height:3px; } .cseats .sbtn .lvl i { height:3px; width:9px; }
.pk .pbar { display:none; }
.pk.bar .pw { display:none; } .pk.bar .pbar { display:block; padding: 0 20px; }
.pbv { display:flex; justify-content:center; align-items:flex-start; height:46px; font-size:38px; font-weight:500; line-height:44px; color: var(--ds-fg); letter-spacing:-.02em; }
.pbv small { font-size:16px; margin:3px 0 0 3px; letter-spacing:0; }
.ptr { position:relative; height:30px; margin-top:4px; }
.ptr input { -webkit-appearance:none; appearance:none; position:absolute; inset:0; width:100%; height:100%; margin:0; background:transparent; cursor:pointer; touch-action:pan-y; }
.ptr::before { content:""; position:absolute; left:0; right:0; top:12px; height:6px; border-radius:6px; background: linear-gradient(90deg, #38bdf8, #5bd68a 45%, #fb923c, #ef4444); pointer-events:none; }
.ptr input::-webkit-slider-runnable-track { height:30px; background:transparent; }
.ptr input::-moz-range-track { height:30px; background:transparent; }
.ptr input::-webkit-slider-thumb { -webkit-appearance:none; width:26px; height:26px; margin-top:2px; border-radius:50%; background:#fff; border:5px solid rgb(var(--ds-info)); box-sizing:border-box; box-shadow:0 2px 10px rgba(0,0,0,.5); }
.ptr input::-moz-range-thumb { width:26px; height:26px; border-radius:50%; background:#fff; border:5px solid rgb(var(--ds-info)); box-sizing:border-box; box-shadow:0 2px 10px rgba(0,0,0,.5); }
.pk.cold .ptr input::-webkit-slider-thumb { border-color: rgb(56,189,248); } .pk.hot .ptr input::-webkit-slider-thumb { border-color: rgb(251,146,60); }
.pk.cold .ptr input::-moz-range-thumb { border-color: rgb(56,189,248); } .pk.hot .ptr input::-moz-range-thumb { border-color: rgb(251,146,60); }
.ptk { display:flex; justify-content:space-between; margin-top:2px; font-size:11px; color: var(--ds-fg2); }
.pk .pt { text-align:center; font-size:12px; color: var(--ds-fg2); }
.pk .pw { position:relative; height:60px; overflow:hidden; }
.pk .pp { --iw: 92px; display:flex; align-items:center; height:60px; overflow-x:auto; overflow-y:hidden; box-sizing:border-box; padding: 0 calc(50% - var(--iw) / 2);
  scroll-snap-type:x mandatory; scrollbar-width:none; touch-action:pan-x; -webkit-overflow-scrolling:touch; }
.pk .pp::-webkit-scrollbar { display:none; }
.pk .pn { flex:0 0 var(--iw); width:var(--iw); min-width:0; max-width:var(--iw); box-sizing:border-box; text-align:center; scroll-snap-align:center; scroll-snap-stop:always; color: rgba(var(--rgb-primary-text-color, 255,255,255), .3); font-size:21px; font-weight:500; cursor:pointer; user-select:none;
  transition: color .16s ease; }
.pk .pn span { display:inline-block; will-change:transform; }
.pk .pn.near { color: rgba(var(--rgb-primary-text-color, 255,255,255), .6); }
.pk .pn.act2 { color: var(--ds-fg); font-size:38px; font-weight:500; letter-spacing:-.02em; line-height:44px; white-space:nowrap; display:flex; justify-content:center; align-items:flex-start; overflow:visible; }
.pk .pn.act2::before, .pk .pn.act2::after { content:"°C"; font-size:16px; line-height:22px; margin-top:3px; letter-spacing:0; }
.pk .pn.act2::before { visibility:hidden; margin-right:3px; } .pk .pn.act2::after { margin-left:3px; }
.pk .pc { position:absolute; left:50%; bottom:0; width:28px; height:3px; transform:translateX(-50%); border-radius:3px; background: rgb(var(--ds-info)); pointer-events:none; }
.pk .pf { position:absolute; top:0; bottom:0; width:56px; z-index:2; pointer-events:none; }
.pk .pf.l { left:0; background: linear-gradient(to right, var(--pkbg), transparent); } .pk .pf.r { right:0; background: linear-gradient(to left, var(--pkbg), transparent); }
.pk.cold .pc { background: rgb(56,189,248); } .pk.hot .pc { background: rgb(251,146,60); }
.vti { display:block; background:currentColor; -webkit-mask:var(--m) center / contain no-repeat; mask:var(--m) center / contain no-repeat; }
.vti.iso { width:17px; height:9px; } .vti.top { width:8px; height:16px; }
#vgi { position:relative; }
#vextra { position:absolute; left:0; right:0; bottom:0; z-index:6; pointer-events:none; padding:22px 14px 11px; border-radius:0 0 var(--ds-r) var(--ds-r); background: linear-gradient(to top, rgba(10,11,14,.72), rgba(10,11,14,0)); }
#vextra[hidden] { display:none; }
.vline { display:flex; flex-wrap:wrap; gap:6px; font-size:12px; color: var(--ds-fg2); }
.vline b { color: rgb(var(--c)); font-weight:600; }

[data-ent], .t2[data-open] { cursor:pointer; -webkit-tap-highlight-color: transparent; -webkit-touch-callout:none; user-select:none; -webkit-user-select:none; }
.tile[data-ent]:active, .t2[data-ent]:active, .total[data-ent]:active { transform: scale(.97); }
.status[data-ent], .total[data-ent] { cursor:pointer; }

/* Information */
.info { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; } .info::-webkit-scrollbar { display:none; }
.tile { flex:1 0 auto; min-width: 88px; display:flex; align-items:center; gap:11px; padding:12px 15px; border-radius:18px; background: var(--ds-soft); border:1px solid var(--ds-line); }
.tile .i { --is: 24px; color: rgb(var(--ds-ok)); }
ha-card[data-ti="custom"] .tile:not(.bad) .i { color: var(--ds-tile-custom); } ha-card[data-ti="blue"] .tile:not(.bad) .i { color: rgb(var(--ds-info)); } ha-card[data-ti="neutral"] .tile:not(.bad) .i { color: var(--ds-fg2); } .tile .v { font-size:16px; font-weight:600; color: var(--ds-fg); white-space:nowrap; } .tile .l { font-size:13px; color: var(--ds-fg2); white-space:nowrap; }
.tells { position:absolute; right:14px; bottom:14px; z-index:8; display:flex; align-items:center; gap:4px; } .tells[hidden] { display:none; }
.tell { --c: var(--ds-bad); position:relative; width:36px; height:36px; padding:0; border:0; background:none; display:grid; place-items:center; cursor:pointer;
  color: rgb(var(--c)); filter: drop-shadow(0 0 8px rgba(var(--c), .5)) drop-shadow(0 1px 4px rgba(0,0,0,.75)); -webkit-tap-highlight-color: transparent; }
.tell .i, .tell .tt { --is: 32px; } .tell.ok { --c: var(--ds-ok); } .tell.warn { --c: var(--ds-warn); } .tell.bad { --c: var(--ds-bad); } .tell.na { --c: 148,163,184; } .tell:active { transform: scale(.92); }
.tell .n { position:absolute; right:-1px; top:-1px; min-width:16px; height:16px; padding:0 4px; box-sizing:border-box; border-radius:8px; display:grid; place-items:center; font-size:10px; font-weight:700; line-height:1; color:#111; background: rgb(var(--c)); filter:none; }
.tell.more { width:auto; min-width:34px; height:28px; padding:0 9px; border-radius:14px; font-size:13px; font-weight:700; color:#fff; filter:none; background: rgba(15,18,24,.62); border:1px solid rgba(255,255,255,.28); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
/* diagnostics popup */
.box.dg { min-height:0; max-height:86%; } .box.dg .hd { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dgcard { --c: var(--ds-ok); display:flex; align-items:center; gap:14px; margin:2px 0 12px; padding:14px 16px; border-radius:18px; border:1px solid rgba(var(--c), .35); background: rgba(var(--c), .12); }
.dgcard.warn { --c: var(--ds-warn); } .dgcard.bad { --c: var(--ds-bad); } .dgcard.na { --c: 148,163,184; }
.dgbig { flex:none; width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background: rgba(var(--c), .2); color: rgb(var(--c)); } .dgbig .i { --is:24px; }
.dgcard b { display:block; font-size:17px; font-weight:700; line-height:1.2; } .dgcard small { display:block; margin-top:2px; font-size:12.5px; color: var(--ds-fg2); }
.dgtog { width:100%; display:flex; align-items:center; gap:8px; margin:12px 0 6px; padding:10px 12px; min-height:44px; border-radius:14px; border:1px solid var(--ds-line); background: var(--ds-soft); color: rgb(var(--ds-ok)); font:inherit; font-size:13px; font-weight:600; cursor:pointer; text-align:left; -webkit-tap-highlight-color: transparent; }
.dgtog .i { --is:20px; flex:none; } .dgtog span { flex:1; } .dgtog em { font-style:normal; font-weight:600; padding:1px 8px; border-radius:9px; background: rgba(var(--ds-ok), .16); } .dgtog:active { transform: scale(.985); }
.dgsum { margin:4px 2px 10px; font-size:13px; font-weight:600; color: var(--ds-fg2); } .dgsum.ok { color: rgb(var(--ds-ok)); } .dgsum.bad { color: rgb(var(--ds-bad)); }
.dgbody { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding-right:2px; }
.dgh { display:flex; align-items:center; gap:7px; margin:12px 2px 6px; font-size:11.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: var(--ds-fg2); } .dgh em { font-style:normal; font-weight:600; padding:1px 7px; border-radius:9px; background: var(--ds-soft); letter-spacing:0; }
.dgh.bad { color: rgb(var(--ds-bad)); } .dgh.ok { color: rgb(var(--ds-ok)); }
.dglist { display:grid; grid-template-columns: 1fr; gap:6px; } .dglist.ok, .dglist.na { grid-template-columns: 1fr 1fr; }
.dgrow { --c: var(--ds-ok); display:flex; align-items:center; gap:10px; padding:8px 10px; min-height:52px; border-radius:14px; border:1px solid rgba(var(--c), .3); background: rgba(var(--c), .09); color: var(--ds-fg); text-align:left; cursor:pointer; font:inherit; -webkit-tap-highlight-color: transparent; }
.dgrow .tt, .dgrow .i { --is: 34px; color: rgb(var(--c)); } .dgrow > span { min-width:0; display:flex; flex-direction:column; gap:1px; } .dgrow b { font-size:13px; font-weight:600; line-height:1.2; overflow-wrap:anywhere; }
.dgrow small { font-size:11.5px; color: rgb(var(--c)); } .dgrow.warn { --c: var(--ds-warn); } .dgrow.bad { --c: var(--ds-bad); } .dgrow.na { --c: 148,163,184; }
.dgrow.bad, .dgrow.warn { background: rgba(var(--c), .14); border-color: rgba(var(--c), .55); } .dgrow.ok .tt, .dgrow.ok .i { --is: 28px; } .dgrow:active { transform: scale(.985); }
.dgnew { display:flex; flex-direction:column; gap:8px; margin:0 0 6px; padding:10px 12px; border-radius:14px; border:1px dashed rgba(var(--ds-info), .6); background: rgba(var(--ds-info), .1); } .dgnew b { display:block; font-size:13px; } .dgnew small { display:block; margin-top:2px; font-size:11.5px; color: var(--ds-fg2); }
.dgnew .btnrow { margin:0; justify-content:flex-end; } .dgfoot { margin-top:10px; justify-content:center; }
.tile.bad .i { color: rgb(var(--ds-bad)); }

/* Diagnostics */
.diag { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:10px; border:1px solid var(--ds-line); border-radius:16px; background:var(--ds-soft); } .diag[data-empty-diag] { display:none; }
.diag-item{display:grid;place-items:center;width:40px;min-height:40px;padding:6px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ds-fg2);cursor:pointer}.diag-item .i{--is:26px}.diag-item.bad{color:rgb(var(--ds-bad));background:rgba(var(--ds-bad),.1)}.diag-item.warn{color:rgb(var(--ds-warn));background:rgba(var(--ds-warn),.1)}.diag-item.ok{color:rgb(var(--ds-ok))}.diag-item.na{opacity:.5}
.chgbox { position:absolute; z-index:8; top:50px; left: min(calc(50% + 29.8% * var(--ds-scale, 1.2) + 1px), calc(100% - 20px)); transform: translateX(-100%); display:flex; flex-direction:column; align-items:flex-end; gap:1px; white-space:nowrap; text-align:right; font-variant-numeric: tabular-nums; color: rgb(var(--ds-ok)); text-shadow: 0 1px 7px rgba(0,0,0,.9), 0 0 14px rgba(var(--ds-ok), .4); }
.chgbox .a { font-size:21px; font-weight:800; line-height:1.05; letter-spacing:-.01em; }
.chgbox .b { font-size:12.5px; font-weight:600; } .chgbox .b em { font-style:normal; font-weight:500; opacity:.8; text-transform:lowercase; }
.chgbox .c { font-size:11px; font-weight:700; letter-spacing:.08em; margin-right:-.08em; text-transform:uppercase; opacity:.9; } /* the negative margin cancels the gap letter-spacing leaves after the last letter: the right edge lines up with the other rows */
.chgbox.line { flex-direction:row; align-items:center; gap:6px; font-size:13.5px; font-weight:700; } .chgbox .i { --is:15px; } .chgbox i { font-style:normal; opacity:.5; }
.chgbox.text, .chgbox.big { top:46px; left: min(calc(50% + 29.8% * var(--ds-scale, 1.2) - 16px), calc(100% - 20px)); }
.chgbox.big .a { font-size:34px; font-weight:800; line-height:1; } .chgbox.big .a small { font-size:16px; font-weight:700; margin-left:2px; }
.chgbox.beside { top: calc(50% - 7.9% * var(--ds-scale, 1.2) - 10px); transform: translate(-100%, -50%); left: calc(50% + 29.8% * var(--ds-scale, 1.2) - 24px); }
/* the text guide is not dashed: so it does not look like the dashed flow on the cable */
.chgbox.beside::after { content:""; position:absolute; right:-24px; top:50%; width:20px; height:2px; margin-top:-1px; border-radius:2px; background: linear-gradient(90deg, rgba(var(--ds-ok), .9), rgba(var(--ds-ok), .15)); }
.chgbox.beside::before { content:""; position:absolute; right:-28px; top:50%; width:6px; height:6px; margin-top:-3px; border-radius:50%; background: rgba(var(--ds-ok), .35); border:1.5px solid rgb(var(--ds-ok)); box-sizing:border-box; }
.chgline { position:absolute; z-index:8; left: calc(50% + 29.8% * var(--ds-scale, 1.2)); top:74px; width:2px; margin-left:-1px; border-radius:2px; height: max(0px, calc(50% - 7.9% * var(--ds-scale, 1.2) - 84px)); background: linear-gradient(180deg, rgba(var(--ds-ok), .85), rgba(var(--ds-ok), .15)); filter: drop-shadow(0 0 3px rgba(var(--ds-ok), .6)); }
.chgline.s-text, .chgline.s-big, .chgline.s-beside { display:none; }
.chgbox[hidden], .chgline[hidden] { display:none; }
/* Car View: the socket is in a different place than in the photos and moves with the width and zoom; the charging text is tied to it (cqw = 1% of the hero width) */
.hero[data-style="carview"] { --ds-px: calc(50% + var(--ds-cvs, 1.08) * 26.47cqw); --ds-py: calc(50% + var(--ds-cvs, 1.08) * .27cqw); }
.hero[data-style="carview"] .chgbox { top: calc(var(--ds-py) - 55px); left: min(calc(var(--ds-px) + 1px), calc(100% - 20px)); }
.hero[data-style="carview"] .chgbox.text, .hero[data-style="carview"] .chgbox.big { top: calc(var(--ds-py) - 58px); left: min(calc(var(--ds-px) - 16px), calc(100% - 20px)); }
.hero[data-style="carview"] .chgbox.beside { top: calc(var(--ds-py) - 10px); left: calc(var(--ds-px) - 24px); }
.hero[data-style="carview"] .chgline { left: var(--ds-px); top: calc(var(--ds-py) - 37px); height: 27px; }
.hero { container-type: inline-size; }
@container (max-width: 370px) { .chgbox.line { font-size:12.5px; } .chgbox .a { font-size:18px; } .chgbox.big .a { font-size:28px; } }
.charge { display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; padding: 12px; border-radius:18px; border:1px solid rgba(var(--ds-ok), .28); background: linear-gradient(145deg, rgba(var(--ds-ok), .10), var(--ds-soft)); }
.charge > div { min-width:0; } .charge .l { font-size:11.5px; color: var(--ds-fg2); }
.charge .v { margin-top:3px; font-size:15px; font-weight:600; color: var(--ds-fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.upd { align-self:stretch; margin:6px 14px 0; display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid rgba(var(--ds-warn),.5); border-radius:12px; background:rgba(var(--ds-warn),.12); color:var(--ds-fg); font-size:12px; text-align:left; cursor:pointer; } .upd[hidden] { display:none; } .upd .i { --is:16px; flex:none; color:rgb(var(--ds-warn)); }
.foot { align-self:center; display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border:0; border-radius:999px; background:transparent; cursor:pointer; color: var(--ds-fg2); font-size:11.5px; opacity:.75; }
.companion-credit{font-size:10px;line-height:1.5;color:var(--ds-fg2);opacity:.7;text-align:center;margin:0 12px 10px;pointer-events:none}.foot .age { margin-right:4px; } .foot .age.old { color: rgb(var(--ds-warn)); } .foot:not(.nosets) .age:not([hidden])::after { content:'·'; margin-left:10px; } .foot:hover, .foot:focus-visible { opacity:1; } .foot .i { --is: 14px; } .foot .sets { display:inline-flex; align-items:center; gap:6px; } .foot.nosets { cursor:default; pointer-events:none; } .foot.nosets .sets { display:none; }

/* Sheet */
.sheet { overscroll-behavior: contain; position:fixed; inset:0; z-index:100000; display:none; align-items:flex-end; justify-content:center; padding:10px; background: rgba(0,0,0,.62); }
/* fluid performance: while a window is open or the card is off screen, the effects behind freeze */
ha-card:has(.sheet.show) *:not(.sheet):not(.sheet *), ha-card.off *, ha-card.off *::before, ha-card.off *::after { animation-play-state: paused !important; }
.sheet.show { display:flex; animation: ds-fade .3s ease-out; }
@media (min-width:640px) { .sheet { align-items:center; } }
.box { overscroll-behavior: contain; width:100%; max-width:560px; max-height:70%; min-height:min(300px, 100%); box-sizing:border-box; display:flex; flex-direction:column; padding:16px 14px 12px; border-radius:24px; background: var(--ha-card-background, var(--card-background-color, #222)); border:1px solid var(--ds-line); animation: ds-up .42s cubic-bezier(.22,.8,.3,1); overflow:hidden; }
.box.wide { overflow:hidden; max-height:94%; } .box.confirm { min-height:0; }
/* mobile: the confirmation window does not stick to the bottom edge (bottom bar/gestures) – it moves up and the buttons grow */
@media (max-width:639px) {
  /* mobile: the window is a "bottom sheet" stuck to the bottom edge, edge to edge, with only the top corners rounded; the background reaches the bottom and the content sits above the phone's rounded corners/gesture bar */
  .sheet { padding:0; } ha-card[data-ppad] .sheet { padding:0; }
  .box, ha-card[data-ppad] .box { max-width:none; border-radius:26px 26px 0 0; border-inline:0; border-bottom:0; max-height:92%; padding-bottom: calc(max(12px, env(safe-area-inset-bottom, 0px)) + 26px); box-shadow: 0 -10px 40px rgba(0,0,0,.45); }
  .box.wide { max-height:92%; }
  .box.confirm h3 { font-size:18px; } .box.confirm p.c { font-size:14px; margin:8px 0 16px; }
  .box.confirm .btnrow { gap:10px; } .box.confirm .btn { min-height:54px; font-size:16px; border-radius:16px; }
}
.box h3 { margin:0; font-size:16px; font-weight:600; color: var(--ds-fg); } .box p.c { margin:6px 0 12px; font-size:13px; color: var(--ds-fg2); text-align:center; }
.confirm { text-align:center; }
.lkb { text-align:center; margin:14px 0 4px; } .lkt { font-size:26px; font-weight:600; color: rgb(var(--st)); } .lks { margin-top:3px; font-size:13px; color: var(--ds-fg2); }
.lksw { display:flex; gap:4px; padding:4px; margin-top:14px; border-radius:18px; background: var(--ds-soft); border:1px solid var(--ds-line); }
.lksw button { flex:1; min-height:64px; border:0; border-radius:14px; background:transparent; color: var(--ds-fg2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font:inherit; font-size:14px; cursor:pointer; } .lksw button .i { --is:24px; }
.lksw button.on { color: rgb(var(--ds-ok)); background: rgba(var(--ds-ok), .16); box-shadow: inset 0 0 0 2px rgb(var(--ds-ok)); } .lksw button.on.w { color: rgb(var(--ds-warn)); background: rgba(var(--ds-warn), .16); box-shadow: inset 0 0 0 2px rgb(var(--ds-warn)); }
.lksw button:disabled { opacity:.6; cursor:default; } .lksw button.go { color: rgb(var(--ds-ok)); background: rgba(var(--ds-ok), .18); box-shadow: inset 0 0 0 1px rgba(var(--ds-ok), .5); } .lkh.q { color: var(--ds-fg); font-weight:600; font-size:14px; }
.btn.ic { display:flex; align-items:center; justify-content:center; gap:8px; } .btn.ic .i { --is:20px; }
.lkh { margin:10px 0 0; text-align:center; font-size:12px; color: var(--ds-fg2); }
.hd .ttl { min-width:0; } .hd .ver { display:block; margin-top:2px; font-size:11px; font-weight:500; letter-spacing:.02em; color: var(--ds-fg2); opacity:.75; }
.hd { touch-action:none; flex:none; display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.hd.sh { gap:12px; padding:2px 4px 0; margin-bottom:6px; } .hd.sh .ttl { flex:1; } .hd.sh h3 { margin:0; font-size:18px; font-weight:600; letter-spacing:.01em; } .hd .eic { flex:none; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background: rgba(var(--ds-ok), .16); color: rgb(var(--ds-ok)); } .hd .eic .i { --is:19px; }
${LOADER_CSS}
@media (prefers-reduced-motion: reduce) { .ldr .ring::before, .ldr .ring .arc { animation:none !important; } }
.x { flex:none; width:30px; height:30px; display:grid; place-items:center; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); cursor:pointer; padding:0; } .x .i { --is: 16px; }
.box deepal-s05-settings { flex:1 1 auto; min-height:0; display:block; overflow-y:auto; overflow-x:hidden; }
@keyframes ds-up { from { transform: translateY(110%) } to { transform:none } }
@keyframes ds-fade { from { opacity:0 } to { opacity:1 } }
@media (prefers-reduced-motion: reduce) { .fx *, .act, .act .ring rect, .gauge .fp, .fxs *, .stage img, .bar b, .box, .l, .hdl rect { animation: none !important; transition: none !important; } }
/* fixed-width numbers */
.total .big, .gauge .c, .t2 .lg b, .t2 .ts b, .tile .v, .cur, .cv b, .tp .v, .picker, .pk * { font-variant-numeric: tabular-nums; }

/* buttons: main row + "More" */
.actions.split { --bs: 60px; display:block; padding:2px 0 4px; }
.actions.split.sz-s { --bs: 50px; } .actions.split.sz-l { --bs: 68px; }
.actions.split .prow { display:grid; grid-template-columns: repeat(var(--np, 4), 1fr); gap: 4px; }
.actions.split .mrow { display:flex; flex-wrap:wrap; justify-content:center; gap: 14px 4px; padding: 0; transition: padding .28s ease; }
.actions.split.moreopen .mrow { padding: 12px 0 8px; }
.actions.split .mrow .cell { flex: 0 0 calc((100% - (var(--np, 4) - 1) * 4px) / var(--np, 4)); }
.actions.split .mwrap { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .28s ease, opacity .2s ease; opacity:0; }
.actions.split.moreopen .mwrap { grid-template-rows: 1fr; opacity:1; }
.actions.split .mrow { min-height:0; overflow:hidden; }
.actions.split .mrow .cap.t { font-size:12.5px; }
.morebtn { position:relative; display:flex; align-items:center; justify-content:center; margin:0 auto; padding:0; width:52px; height:22px; min-height:0; border-radius:999px; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg2); cursor:pointer; -webkit-tap-highlight-color: transparent; }
.morebtn::before { content:""; position:absolute; inset:-12px -14px; } /* large touch area, invisible */
.morebtn > span:not(.mdot) { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.actions.split .morebtn { margin-top:6px; margin-bottom:2px; } .actions.split .morebtn:hover { color: var(--ds-fg); }
.morebtn .i { --is:16px; transition: transform .25s ease; } .actions.moreopen .morebtn .i { transform: rotate(180deg); }
.morebtn:focus-visible { outline: 2px solid rgb(var(--ds-info)); outline-offset: 2px; }
.morebtn .mdot { position:absolute; top:3px; right:9px; width:7px; height:7px; border-radius:50%; background: rgb(var(--ds-warn)); }
.actions.offline .cell { opacity:.42; filter: grayscale(1); } .actions.offline .act { cursor:default; }

@media (max-width:639px) { .box::before { content:""; flex:none; display:block; width:38px; height:4px; margin:-8px auto 10px; border-radius:3px; background: var(--ds-line); } .box.confirm::before { margin-bottom:6px; } }
.box:focus { outline:none; }
/* Car View: soft floor shadow and the "all good" message */
.isoi::before { content:""; position:absolute; left:20%; right:14%; bottom:19%; height:9%; background: radial-gradient(ellipse at center, rgba(0,0,0,.6), transparent 70%); filter: blur(5px); pointer-events:none; }
`;

const SETTINGS_CSS = `
.csw { display:flex; gap:14px; flex-wrap:wrap; padding:6px 2px 10px; } .csw button { flex:none; width:46px; height:36px; min-width:46px; border-radius:8px; padding:0; border:2px solid var(--ds-line); cursor:pointer; box-shadow: inset 0 0 0 2px rgba(0,0,0,.28); transition: transform .15s ease; } .csw button:active { transform: scale(.92); } .csw button.on { border-color: rgb(var(--ds-info)); box-shadow: 0 0 0 3px rgba(var(--ds-info), .4), inset 0 0 0 2px rgba(0,0,0,.28); }
:host { display:block; ${VARS} color: var(--ds-fg); }
${BASE_CSS}
.wrap { display:flex; flex-direction:column; gap:10px; }
.settings-loading{min-height:210px;padding:14px;border:1px solid var(--ds-line);border-radius:18px}.settings-loading .ldr{padding:18px;gap:10px}.settings-loading>i{display:block;height:10px;margin:12px 0;border-radius:6px;background:var(--ds-soft);animation:settings-pulse 1s ease-in-out infinite alternate}.settings-loading>i:nth-last-child(2){width:75%}.settings-loading>i:last-child{width:50%}@keyframes settings-pulse{from{opacity:.35}to{opacity:1}}@media(prefers-reduced-motion:reduce){.settings-loading>i{animation:none}}
.tabbar { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:6px; padding:2px 0 8px; background: var(--ha-card-background, var(--card-background-color, #222)); }
.tabs { position:relative; flex:1; min-width:0; display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; cursor:grab; } .tabs::-webkit-scrollbar { display:none; }
.tn { flex:none; width:32px; height:32px; display:grid; place-items:center; padding:0; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); cursor:pointer; } .tn[hidden] { display:none; } .tn .i { --is:16px; } .tn.l .i { transform: scaleX(-1); }
.tabs button { flex:none; user-select:none; display:inline-flex; align-items:center; gap:6px; padding:8px 13px 8px 10px; border-radius:999px; border:1px solid var(--ds-line); background:transparent; cursor:pointer; font-size:12.5px; font-weight:600; color: var(--ds-fg2); transition: background .2s, color .2s, border-color .2s; }
.tabs button .i { --is:16px; }
.tabs button.on { background: rgba(var(--ds-info), .18); color: rgb(var(--ds-info)); border-color: rgba(var(--ds-info), .45); }
.tabs button.on span { color: var(--ds-fg); }
.hint { margin:0; font-size:12px; color: var(--ds-fg2); line-height:1.4; }
h4 { margin:0 0 2px; font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color: var(--ds-fg2); }
.grp { display:flex; flex-direction:column; gap:10px; padding:13px; border-radius:20px; background: var(--ds-soft); border:1px solid var(--ds-line); }
.grp .row, .grp .chk { background: rgba(var(--rgb-primary-text-color, 255,255,255), .05); }
.grp input[type=text], .grp input[type=number], .grp select, .grp textarea { background: rgba(var(--rgb-primary-text-color, 255,255,255), .06); }
.opt { display:flex; flex-direction:column; gap:7px; } .opt .ol { font-size:13.5px; } .opt .ol small { display:block; margin-top:2px; font-size:11.5px; color: var(--ds-fg2); line-height:1.35; }
.seg.wide { width:100%; box-sizing:border-box; } .seg.wide button { flex:1; }
.sw-c { display:flex; align-items:center; gap:10px; font-size:13.5px; color: var(--ds-fg); } .sw-c span { flex:1; }
.sw-c input[type=color] { -webkit-appearance:none; appearance:none; width:30px; height:30px; padding:0; border:2px solid var(--ds-line); border-radius:6px; background:none; cursor:pointer; flex:0 0 40px; order:-1; min-height:30px; max-height:30px; width:40px; height:30px; }
.sw-c input[type=color]::-webkit-color-swatch-wrapper { padding:0; } .sw-c input[type=color]::-webkit-color-swatch { border:0; border-radius:3px; } .sw-c input[type=color]::-moz-color-swatch { border:0; border-radius:3px; }
.lvhead, .lvrow { display:grid; grid-template-columns: 1fr 86px 86px; gap:8px; align-items:center; } .lvhead { font-size:11px; color: var(--ds-fg2); text-align:center; }
.lvrow input[type=number] { width:100%; text-align:center; } .lvrow .dash { text-align:center; color: var(--ds-fg2); font-style:normal; }
.lvbar { height:10px; border-radius:999px; box-shadow: inset 0 0 0 1px var(--ds-line); }

.list { display:flex; flex-direction:column; gap:4px; }
.row { display:flex; align-items:center; gap:8px; padding:7px 8px 7px 11px; border-radius:13px; background: var(--ds-soft); min-height:44px; }
.row > span { flex:1; min-width:0; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; } .row > span small { display:block; font-size:11px; color: var(--ds-fg2); }
.row.off > span { opacity:.45; } .row > .i { color: var(--ds-fg2); }
.row.tg { cursor:pointer; text-align:left; border:0; width:100%; } .row.tg.on > .i { color: rgb(var(--ds-info)); }
.swb { border:0; background:transparent; padding:6px 2px 6px 6px; cursor:pointer; display:grid; place-items:center; }
.field { display:flex; flex-direction:column; gap:4px; font-size:12px; color: var(--ds-fg2); }
.field.inline { flex-direction:row; align-items:center; justify-content:space-between; gap:10px; }
input[type=text], input[type=number], select { width:100%; box-sizing:border-box; padding:9px 11px; border-radius:11px; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); font-size:13.5px; min-width:0; }
input[type=number] { width:90px; }
input[type=color] { padding:0; }
select option { color:#000; }
.grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
.add { padding:10px; border-radius:14px; border:1px dashed var(--ds-line); display:flex; flex-direction:column; gap:8px; }
.icons { display:flex; flex-wrap:wrap; gap:4px; } .icons button { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--ds-line); background:transparent; cursor:pointer; color: var(--ds-fg2); padding:0; }
.icons button.on { border-color: rgb(var(--ds-info)); color: rgb(var(--ds-info)); background: rgba(var(--ds-info), .12); } .icons .i { --is: 18px; }
.chk { display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:11px; background: var(--ds-soft); font-size:12.5px; }
.chk .th { width:54px; height:34px; border-radius:8px; background:#000 center/cover no-repeat; flex:none; border:1px solid var(--ds-line); }
.chk code { font-size:11px; color: var(--ds-fg2); } .chk .st { margin-left:auto; font-weight:600; } .chk .st.ok { color: rgb(var(--ds-ok)); } .chk .st.no { color: rgb(var(--ds-bad)); }
.chk input { flex:1; min-width:0; padding:6px 8px; font-size:12px; }
textarea { width:100%; box-sizing:border-box; min-height:150px; padding:10px; border-radius:12px; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); font:12px/1.45 ui-monospace, Menlo, monospace; }
.note { font-size:12px; color: rgb(var(--ds-ok)); min-height:16px; }
`;



/* ───────────────────────── Discovery of new sensors ─────────────────────────
 * If the integration adds a new warning (e.g. binary_sensor.s05_engine_warning), the card does not know it.
 * Here we search HA for binary_sensors of the same vehicle that look like a warning and are not already in the list. */
const DISC_CLASSES = new Set(["problem", "safety", "tamper", "battery", "smoke", "gas", "carbon_monoxide"]);
const DISC_SKIP = new Set(["lock", "door", "window", "plug", "light", "heat", "cold", "connectivity", "battery_charging", "power", "opening", "garage_door", "running", "moving", "presence", "occupancy", "motion", "vibration", "update"]);
const DISC_NAME = /(warning|alarm|fault|error|alert|failure|malfunction|_low)$/;
const guessDiagIcon = (s) => {
  const t = String(s).toLowerCase();
  const m = [[/airbag/, "airbag"], [/abs/, "abs"], [/fluid/, "fluid"], [/brake/, "brake"], [/tire|tyre|tpms/, "tirealert"], [/steer|eps/, "steering"], [/12_?v|aux/, "battery12"],
    [/traction|hv_|high_voltage/, "battery"], [/battery|soc/, "battery"], [/oil/, "oil"], [/engine|motor|emission/, "engine"], [/power_limit|derat|limit/, "turtle"], [/power|system|inverter|drive/, "evfault"], [/key|fob/, "key"], [/trunk|tailgate/, "trunk"]];
  for (const [re, ic] of m) if (re.test(t)) return ic;
  return "alert";
};
const discoverDiag = (hass, c) => {
  const st = hass?.states; if (!st) return [];
  const p = effPrefix(hass, c);
  const known = new Set([...DIAG.map((d) => resolveId(hass, c, d[0])), ...OPEN_ITEMS.map((o) => resolveId(hass, c, o[0])), ...OTHER_KEYS.map((k) => resolveId(hass, c, k)),
    ...(c.diag_custom || []).map((x) => x.entity), ...(c.info_custom || []).map((x) => x.entity), ...(c.diag_ignore || [])]);
  const mine = new Set(), pre = `binary_sensor.${p}_`;
  for (const id of Object.keys(st)) if (id.startsWith(pre)) mine.add(id);
  const reg = hass.entities, dev = reg && reg[resolveId(hass, c, "lock.doors")]?.device_id;
  if (reg && dev) for (const e of Object.values(reg)) if (e.device_id === dev && e.entity_id.startsWith("binary_sensor.") && !e.hidden_by && !e.disabled_by) mine.add(e.entity_id);
  const out = [];
  for (const id of mine) {
    const o = st[id]; if (!o || known.has(id)) continue;
    const dc = o.attributes?.device_class, name = id.slice(id.indexOf(".") + 1);
    if (!(DISC_CLASSES.has(dc) || (!DISC_SKIP.has(dc) && DISC_NAME.test(name)))) continue;
    const fn = String(o.attributes?.friendly_name || name), label = fn.replace(new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
    out.push({ entity: id, label: label.charAt(0).toUpperCase() + label.slice(1), icon: guessDiagIcon(name), on: String(o.state).toLowerCase() === "on" });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
};
/* ───────────────────────── Card ───────────────────────── */
const RING = '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><rect x="2.5" y="2.5" width="95" height="95" rx="47.5" pathLength="100"/></svg>';
const REBUILD_KEYS = ["image_path", "layers_path", "images", "name", "prefix", "entities"];
const normPath = (p) => (p ? (p.endsWith("/") ? p : p + "/") : p);

/* Merge: defaults < card YAML < local device settings */
function mergeConfig(yaml, local) {
  const y = { ...(yaml || {}) };
  // compatibility with old versions (v0.1–0.3)
  if (y.diagnostics !== undefined && y.diag === undefined) y.diag = y.diagnostics;
  if (y.diagnostics_mode !== undefined && y.diag_mode === undefined) y.diag_mode = y.diagnostics_mode;
  if (y.button_labels === true) y.button_labels = "status";
  if (y.button_labels === false) y.button_labels = "none";
  const c = { ...clone(DEFAULTS), ...y, ...(local || {}) };
  c.info_order = [...new Set([...(Array.isArray(c.info_order)?c.info_order:[]), ...INFO_IDS])].filter(id=>INFO_IDS.includes(id));
  /* Wrong types from the YAML (e.g. a list that became text) must not "crash" the card: whatever does not match the default's type takes the default */
  for (const [k, d] of Object.entries(DEFAULTS)) {
    const v = c[k];
    if (Array.isArray(d)) { if (!Array.isArray(v)) c[k] = clone(d); }
    else if (typeof d === "string") { if (typeof v !== "string") c[k] = d; }
    else if (typeof d === "number") { c[k] = typeof v === "boolean" || v === null || v === "" || !Number.isFinite(Number(v)) ? d : Number(v); }
    else if (d === null) { if (k === "diag" && Array.isArray(v)) c[k] = v.filter((id) => typeof id === "string"); else if (v !== null && v !== undefined && typeof v !== "string" && typeof v !== "number") c[k] = null; }
  }
  for (const [k, [lo, hi]] of Object.entries(NUM_RANGE)) c[k] = Math.min(hi, Math.max(lo, Number(c[k]))); /* out-of-range values from YAML or code */
  for (const k of ["images", "entities"]) if (c[k] && typeof c[k] !== "object") c[k] = {};
  for (const k of ["layers_path", "image_path"]) if (c[k] !== null && typeof c[k] !== "string") c[k] = null;
  const obj = (o) => (o && typeof o === "object" && !Array.isArray(o) ? o : {});
  c.images = { ...obj((yaml || {}).images), ...obj((local || {}).images) };
  c.entities = { ...obj((yaml || {}).entities), ...obj((local || {}).entities) };
  c.confirm = Array.isArray(c.confirm) ? c.confirm : DEFAULTS.confirm;
  const fix = (arr, all) => {
    const a = uniq((Array.isArray(arr) ? arr : []).filter((x) => all.includes(x)));
    return [...a, ...all.filter((x) => !a.includes(x))];
  };
  c.order = fix(c.order, SECTIONS);
  c.buttons = fix(c.buttons, BUTTON_IDS);
  c.hidden = (c.hidden || []).filter((x) => SECTIONS.includes(x));
  c.buttons_hidden = (c.buttons_hidden || []).filter((x) => BUTTON_IDS.includes(x));
  c.top_buttons = fix(c.top_buttons, TOP_BTN_IDS);
  c.top_buttons_hidden = (c.top_buttons_hidden || []).filter((x) => TOP_BTN_IDS.includes(x));
  return c;
}

/* Car View background: on top of black, sun/moon, clouds, hills and the curved wall line are added, depending on the time of day. */
const SKY_PH = {
  morning:   { sun: [16, 27, "#ffe9bf"], r: 3.2, glow: .27, cl: "#f4f8ff", ca: .35, line: "#ffffff", la: .57, hill: "#9fb3c8", ha: .44, stars: 0, moon: 0 },
  afternoon: { sun: [80, 9, "#ffffff"], r: 3.6, glow: .30, cl: "#ffffff", ca: .50, line: "#ffffff", la: .75, hill: "#8fb0d2", ha: .52, stars: 0, moon: 0 },
  evening:   { sun: [84, 26, "#ffb871"], r: 3.8, glow: .33, cl: "#ffb98a", ca: .46, line: "#ffcfa8", la: .63, hill: "#8a5f86", ha: .60, stars: .25, moon: 0 },
  night:     { sun: [82, 11, "#eaf0ff"], r: 2.6, glow: .18, cl: "#7f9ad8", ca: .18, line: "#8fb0ff", la: .42, hill: "#35508f", ha: .44, stars: 1, moon: 1 },
};
const skySvg = (ph) => {
  const T = SKY_PH[ph], [sx, sy, sc] = T.sun;
  const st = T.stars ? Array.from({ length: 46 }, (_, i) => `<circle cx="${i * 37 % 100}" cy="${i * 53 % 30}" r="${i % 3 ? .16 : .28}" fill="#fff" opacity="${(T.stars * (.35 + (i % 4) * .15)).toFixed(2)}"/>`).join("") : "";
  return `<svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
<radialGradient id="skg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${sc}" stop-opacity="${T.glow}"/><stop offset="1" stop-color="${sc}" stop-opacity="0"/></radialGradient>
<filter id="skb"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="sks"><feGaussianBlur stdDeviation=".5"/></filter>
<mask id="skm"><rect width="100" height="72" fill="#fff"/><circle cx="${sx + 1.4}" cy="${sy - 1}" r="2.5" fill="#000"/></mask></defs>${st}
<circle cx="${sx}" cy="${sy}" r="20" fill="url(#skg)"/>
${T.moon ? `<circle cx="${sx}" cy="${sy}" r="${T.r}" fill="${sc}" mask="url(#skm)" opacity=".95"/>` : `<circle cx="${sx}" cy="${sy}" r="${T.r}" fill="${sc}" opacity=".9" filter="url(#sks)"/>`}
<g filter="url(#skb)" fill="${T.cl}" opacity="${T.ca}"><ellipse cx="62" cy="6" rx="15" ry="3"/><ellipse cx="76" cy="9.5" rx="12" ry="2.8"/><ellipse cx="90" cy="4.5" rx="10" ry="2.4"/><ellipse cx="52" cy="11" rx="8" ry="1.9"/><ellipse cx="30" cy="18" rx="9" ry="1.6" opacity=".6"/></g>
<g filter="url(#sks)" fill="${T.hill}"><path d="M0 36Q9 31.5 19 33.4T38 34.6V40H0Z" opacity="${T.ha}"/><path d="M0 38Q12 35 24 36.8T38 37.6V42H0Z" opacity="${(T.ha * .8).toFixed(2)}"/></g>
<path d="M100 8C86 17 62 24 34 28" fill="none" stroke="${T.line}" stroke-opacity="${T.la}" stroke-width=".35" filter="url(#sks)"/></svg>`;
};

class DeepalS05Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); I18N.watch(this.shadowRoot);
    this._pending = {}; this._flashes = {}; this._opt = {}; this._last = {};
    this._toastState = null; this._confirm = null; this._customize = false; this._diagSheet = false; this._lockSheet = false; this._lockAsk = null; this._enSheet = false; this._enEl = null;
    this._sig = null; this._built = false; this._stab = "layout";
  }

  static getStubConfig() { return { type: `custom:${TAG}`, prefix: "s05" }; }
  static getConfigElement() { return document.createElement(EDITOR_TAG); }

  setConfig(config) {
    if (!config) throw new Error("Missing config");
    this._yaml = config;
    this._local = onlySettings(lsRead(this._lsKey()));
    this._c = mergeConfig(config, this._local);
    this._last = lsRead(`deepal-s05-last:${this._c.prefix}`) || {};
    this._built = false; this._sig = null; this._remoteLoaded = false; this._cvReset();
    if (!this._uiDone) { this._uiDone = true; this._uiRestore(); }
    if (this._hass) this._render();
  }
  _devName() {
    const c = this._c, h = this._hass; if (!c || !h || c.name || !h.entities || !h.devices) return null;
    for (const k of ["lock.doors", "sensor.battery_level", "sensor.remaining_range"]) { const e = h.entities[this._id(k)], d = e && e.device_id && h.devices[e.device_id]; const n = d && (d.name_by_user || d.name); if (n) return String(n); }
    return null;
  }
  set hass(hass) {
    this._hass = hass;
    this._syncLang();
    if (this._c && !this._remoteLoaded && hass && typeof hass.callWS === "function") { this._remoteLoaded = true; this._loadRemote(); }
    if (this._c) { this._render(); }
  }
  _syncLang() {
    const l = this._hass?.locale?.language || this._hass?.language || "en"; /* always the Home Assistant language: one language for every card */
    if (this._wantLang === l) return; /* each card asks once per change: two cards with different languages must not keep re-asking each other (that froze HA) */
    this._wantLang = l; I18N.request(l);
  }
  connectedCallback() {
    I18N.subs.add(this); I18N.watch(this.shadowRoot);
    if (!this._onKey) this._onKey = (e) => this._key(e);
    document.addEventListener("keydown", this._onKey, true);
    if (!this._skyTick) this._skyTick = setInterval(() => { if (this._el && this._c && this._c.hero_sky === "auto") this._skySet(this._el.hero.dataset.style === "carview"); }, 30000); /* the day phase changes even without another update */
    if (window.IntersectionObserver && !this._io) { this._io = new IntersectionObserver(([e]) => { if (this._el && this._el.card) this._el.card.classList.toggle("off", !e.isIntersecting); }); this._io.observe(this); }
  }
  /* Order and visibility of the small buttons at the top right (bell, view, refresh) */
  _applyTop() {
    const el = this._el, c = this._c; if (!el) return;
    const m = { diag: el.dgb, bell: el.nfbell, view: el.vtg, refresh: el.rfs };
    c.top_buttons.forEach((id, i) => { const b = m[id]; if (!b) return; b.style.order = String(i); b.toggleAttribute("data-uh", c.top_buttons_hidden.includes(id)); });
  }

  /* Hero aspect ratio: base (image / Car View / setting) + "air" above and below (hero_space), % of the width. The car and effects stay in the bottom box (.hbox) with the base ratio, so they move down without their positions breaking. */
  _applyAspect() {
    const el = this._el && this._el.hero, c = this._c; if (!el || !c) return;
    const sp = HERO_SPACE[c.hero_space] || HERO_SPACE.standard, hx = sp[0] / 100, fx = sp[1] / 100;
    const base = c.image_aspect ? String(c.image_aspect) : (el.dataset.auto || "16 / 9"); /* same hero height in Car View and in Photos */
    const q = base.split("/").map((x) => parseFloat(x)); let r = q.length > 1 ? q[0] / q[1] : q[0]; if (!(r > 0.2 && r < 8)) r = 16 / 9;
    el.style.setProperty("--ds-ar0", String(+r.toFixed(5))); el.style.setProperty("--ds-hx", String(hx)); el.style.setProperty("--ds-fx", String(fx));
    el.style.setProperty("--ds-aspect", hx + fx ? String(+(1 / (1 / r + hx + fx)).toFixed(5)) : (q.length > 1 && q[0] > 0 && q[1] > 0 ? base : String(r)));
  }

  disconnectedCallback() {
    for (const image of this.shadowRoot.querySelectorAll("img")) { clearTimeout(image._retryTimer); image._retryTimer = null; }
    clearInterval(this._skyTick); this._skyTick = 0;
    for (const p of Object.values(this._pending || {})) clearTimeout(p.timer); this._pending = {}; for (const f of Object.values(this._flashes || {})) clearTimeout(f.timer); this._flashes = {};
    /* timers that concern only the screen (not the saving ones) */
    for (const t of ["_toastTimer", "_confirmTimer", "_pkT", "_pkUT", "_pkPT", "_tTimer", "_tTimer2", "_optTimer"]) clearTimeout(this[t]);
    this._toastState = null; if (this._confirm) { this._confirm = null; this._tpend = undefined; }
    if (this._pkRaf) { cancelAnimationFrame(this._pkRaf); this._pkRaf = 0; }
    I18N.subs.delete(this); if (this._onKey) document.removeEventListener("keydown", this._onKey, true); if (this._yPend) { this._yPend = false; this._customize = false; this._doSaveYaml(); } if (this._io) { this._io.disconnect(); this._io = null; } }
  getCardSize() { return 9; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  /* ───── settings (saved on the device) ───── */
  /* After saving to the YAML, HA rebuilds the card; we keep the open settings window so it can reopen */
  _uiKey() { return `deepal-s05-ui:${(this._yaml && this._yaml.prefix) || DEFAULTS.prefix}`; }
  _uiSave() {
    try {
      if (!this._customize) { sessionStorage.removeItem(this._uiKey()); return; }
      sessionStorage.setItem(this._uiKey(), JSON.stringify({ t: Date.now(), tab: this._stab, sc: this._el && this._el.box ? this._el.box.scrollTop : 0 }));
    } catch (_) {}
  }
  _uiRestore() {
    try {
      const v = JSON.parse(sessionStorage.getItem(this._uiKey()) || "null");
      if (v && Date.now() - v.t < 30000) { this._customize = true; this._stab = v.tab || "sections"; this._restoreSc = v.sc || 0; }
      sessionStorage.removeItem(this._uiKey());
    } catch (_) {}
  }
  _lsKey() { return `deepal-s05-card:${(this._yaml && this._yaml.prefix) || DEFAULTS.prefix}`; }
  _patch(p) {
    if ("hero_view" in p) { this._hview = null; lsWrite(`deepal-s05-view:${this._c.prefix}`, null); } /* the choice in the settings applies again over the device's button */
    this._local = { ...(this._local || {}), ...p }; this._lrev = (this._lrev || 0) + 1; /* a local change: an older answer from the server must not overwrite it */
    lsWrite(this._lsKey(), this._local); this._saveYaml(); this._uiSave();
    const rebuild = Object.keys(p).some((k) => REBUILD_KEYS.includes(k));
    if (["hero_style", "car_color", "iso_wheels", "layers_path"].some((k) => k in p)) this._cvReset();
    this._c = mergeConfig(this._yaml, this._local);
    if (rebuild) this._built = false;
    this._force();
  }
  _resetLocal() { this._lrev = (this._lrev || 0) + 1; this._local = {}; lsWrite(this._lsKey(), null); this._c = mergeConfig(this._yaml, {}); this._built = false; this._saveYaml(true); this._force(); }

  /* ───── saving to the dashboard YAML (shared settings everywhere) ───── */
  _saveYaml(reset) {
    clearTimeout(this._yT);
    if (reset) this._yReset = true;
    if (this._customize) { this._yPend = true; this._saveRemote(); return; } /* while the settings are open we do not write to the YAML (it causes a dashboard reload) */
    this._yT = setTimeout(() => this._doSaveYaml(), 1200);
  }
  async _doSaveYaml() {
    if (this._ySaving) { this._yAgain = true; return; }
    const hass = this._hass; if (!hass || typeof hass.callWS !== "function" || !this._yaml) return;
    this._ySaving = true;
    const snap = this._local || {}, reset = this._yReset; this._yReset = false;
    try {
      if (hass.user && hass.user.is_admin === false) throw new Error("not admin");
      const seg = location.pathname.split("/")[1] || "lovelace", urlPath = seg === "lovelace" ? null : seg;
      const cfg = await hass.callWS({ type: "lovelace/config", url_path: urlPath, force: true });
      const found = [], visit = (o) => { if (Array.isArray(o)) o.forEach(visit); else if (o && typeof o === "object") { if (o.type === `custom:${TAG}`) found.push(o); Object.values(o).forEach(visit); } };
      visit(cfg);
      const px = this._yaml.prefix || DEFAULTS.prefix, mine = found.filter((f) => (f.prefix || DEFAULTS.prefix) === px);
      const target = mine.find((f) => JSON.stringify(f) === JSON.stringify(this._yaml)) || (mine.length === 1 ? mine[0] : null);
      if (!target) throw new Error("card not found");
      if (reset) { const keep = { type: target.type, prefix: target.prefix, name: target.name }; Object.keys(target).forEach((k) => delete target[k]); Object.assign(target, keep); }
      Object.assign(target, snap);
      this._uiSave();
      await hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config: cfg });
      this._yaml = { ...target };
      for (const k of Object.keys(snap)) if (JSON.stringify((this._local || {})[k]) === JSON.stringify(snap[k])) delete this._local[k];
      lsWrite(this._lsKey(), Object.keys(this._local || {}).length ? this._local : null);
      this._c = mergeConfig(this._yaml, this._local);
      this._yamlErr = false;
      this._saveRemote();
    } catch (err) {
      this._saveRemote();
      if (!this._yamlErr) { this._yamlErr = true; this._toast("Could not write to the dashboard YAML (needs an admin and a dashboard editable from the UI) — saved to your account instead", "error"); }
    }
    this._ySaving = false;
    if (this._yAgain) { this._yAgain = false; this._saveYaml(); }
  }

  /* ───── saving to the HA account (frontend user data) → same settings on all devices ───── */
  _rkey() { return `deepal_s05_card_${(this._yaml && this._yaml.prefix) || DEFAULTS.prefix}`; }
  async _loadRemote() {
    try {
      const rev0 = this._lrev || 0;
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: this._rkey() });
      if ((this._lrev || 0) !== rev0) return; /* the user changed a setting while loading: keep the newer local value */
      const v = r && r.value ? onlySettings(r.value) : null;
      if (v && typeof v === "object" && Object.keys(v).length) {
        if (JSON.stringify(v) !== JSON.stringify(this._local || {})) {
          this._local = v; lsWrite(this._lsKey(), v);
          this._c = mergeConfig(this._yaml, this._local); this._built = false; this._force();
        }
        this._saveYaml(); // moving old settings to the YAML
      } else if (this._local && Object.keys(this._local).length) {
        // the account/YAML is the truth: we delete old local device settings
        this._local = {}; lsWrite(this._lsKey(), null); this._c = mergeConfig(this._yaml, {}); this._built = false; this._force();
      }
    } catch (_) { this._remoteErr = true; }
  }
  _saveRemote() {
    clearTimeout(this._rT);
    this._rPending = true;
    this._rT = setTimeout(async () => {
      if (this._rSaving) return;
      this._rSaving = true;
      try {
        while (this._rPending) {
          const hass = this._hass;
          if (!hass || typeof hass.callWS !== "function") break;
          this._rPending = false;
          try {
            const value = JSON.parse(JSON.stringify(this._local || {}));
            await hass.callWS({ type: "frontend/set_user_data", key: this._rkey(), value });
            this._remoteErr = false;
          } catch (_) {
            if (!this._remoteErr) { this._remoteErr = true; this._toast("Settings could not be saved to HA — they only apply on this device", "error"); }
          }
        }
      } finally { this._rSaving = false; }
    }, 500);
  }

  /* ───── helpers ───── */
  _id(key) {
    return resolveId(this._hass, this._c, key);
  }
  _obj(key) { return this._hass?.states?.[this._id(key)]; }
  _s(key) { const o = this._obj(key); return !o || BAD.includes(o.state) ? null : o.state; }
  _is(key, v) { return this._s(key) === v; }
  /* Levels/ranges: the vehicle API sometimes sends 0 or unavailable for a moment. We do not show it; we keep the last good value until the next good sync
     (0 accepted only if the previous value was already very low) */
  _n(key) {
    const s = this._s(key), raw = s === null ? null : parseFloat(s), v = Number.isFinite(raw) ? raw : null;
    if (!LEVEL_KEYS.includes(key)) return v;
    const good = this._last[key], bad = v === null || (v === 0 && good !== undefined && good > 5);
    if (bad) return good !== undefined ? good : v;
    if (v !== null && good !== v) { this._last[key] = v; lsWrite(`deepal-s05-last:${this._c.prefix}`, this._last); }
    return v;
  }
  _unit(key) { return this._obj(key)?.attributes?.unit_of_measurement || ""; }
  _eobj(id) { return this._hass?.states?.[id]; }
  /* last known value (when the sensor becomes unavailable) */
  _nl(key) {
    const n = this._n(key);
    if (n !== null) {
      if (this._last[key] !== n) { this._last[key] = n; lsWrite(`deepal-s05-last:${this._c.prefix}`, this._last); }
      return { v: n, stale: false };
    }
    return this._last[key] !== undefined ? { v: this._last[key], stale: true } : { v: null, stale: false };
  }
  _allKeys() { return [...OTHER_KEYS, ...OPEN_ITEMS.map((x) => x[0]), ...DIAG.map((x) => x[0]), ...INFO_IDS.map((i) => INFO_ITEMS[i][0]), ...TIRES.map((t) => `binary_sensor.${t.id}_tire_alarm`)]; }
  _signature() {
    const st = this._allKeys().map((k) => this._obj(k)?.state ?? "∅").join("|");
    const cu = [...(this._c.diag_custom || []), ...(this._c.info_custom || [])].map((x) => this._eobj(x.entity)?.state ?? "∅").join("|");
    return [st, cu, Math.floor(Date.now() / 60000), Object.keys(this._pending).join(","),
      Object.entries(this._flashes).map(([k, v]) => k + v.type).join(","), this._confirm ? this._confirm.id : "", String(this._customize), String(this._diagSheet), String(this._lockSheet), String(this._lockAsk), String(this._enSheet),
      JSON.stringify(this._c), JSON.stringify(this._opt), String(this._tpend), String(this._moreOpen), String((this._tgt() || {}).state), String(this._view), JSON.stringify((this._hass && this._hass.locale) || null), String((this._obj("lock.doors") || {}).last_changed), this._toastState ? this._toastState.msg : ""].join("#");
  }
  _force() { this._sig = null; if (this._hass && this._c) this._render(); }
  _diagAvail() { return DIAG.filter((d) => this._obj(d[0])); }
  _diagItems() {
    const c = this._c, avail = this._diagAvail(), selIds = Array.isArray(c.diag) ? c.diag : DIAG.map((d) => d[0]);
    const mk = (label, icon, ent, on, na, sev) => ({ label, icon, ent, on, na, st: on ? sev : na ? "na" : "ok" });
    const items = avail.filter((d) => selIds.includes(d[0])).map((d) => mk(d[1], d[2], this._id(d[0]), this._is(d[0], "on"), this._s(d[0]) === null, d[3] === "r" ? "bad" : "warn"));
    for (const x of c.diag_custom || []) {
      const o = this._eobj(x.entity);
      items.push(mk(x.label || o?.attributes?.friendly_name || x.entity, x.icon || "alert", x.entity, !!o && ["on", "true", "problem", "alarm", "low"].includes(String(o.state).toLowerCase()), !o || BAD.includes(o.state), "bad"));
    }
    return items;
  }
  /* "Diagnostics" popup: all sensors, split into problems / unavailable / OK */
  _diagHtml() {
    const it = this._diagItems(), rank = { bad: 0, warn: 1, na: 2, ok: 3 };
    const bad = it.filter((x) => x.st === "bad" || x.st === "warn").sort((a, b) => rank[a.st] - rank[b.st]), na = it.filter((x) => x.st === "na"), ok = it.filter((x) => x.st === "ok");
    const stTxt = { bad: "Problem", warn: "Warning", na: "Unavailable", ok: "OK" };
    const row = (d) => `<button class="dgrow ${d.st}" data-ent="${esc(d.ent)}" title="${esc(d.label)}">${icoBadge(d.icon)}<span><b>${esc(d.label)}</b><small>${esc(T(stTxt[d.st]))}</small></span></button>`;
    const sec = (title, arr, cls) => arr.length ? `<h4 class="dgh ${cls}">${esc(T(title))} <em>${arr.length}</em></h4><div class="dglist ${cls}">${arr.map(row).join("")}</div>` : "";
    /* OK: we gather all the tyres into one tile; the list stays closed until the user asks for it */
    const tyres = ok.filter((x) => x.icon === "tirealert"), oth = tyres.length > 1 ? ok.filter((x) => x.icon !== "tirealert") : ok;
    const okTiles = oth.map(row).join("") + (tyres.length > 1 ? `<button class="dgrow ok" data-ent="${esc(tyres[0].ent)}">${icoBadge("tirealert")}<span><b>${esc(T("Tyres"))}</b><small>${esc(T("{0} OK", tyres.length))}</small></span></button>` : "");
    const open = !!this._dgOk, okSec = ok.length ? `<button class="dgtog ok" data-dg-ok aria-expanded="${open}">${ico(open ? "chevu" : "chevd")}<span>${esc(T("OK"))}</span><em>${ok.length}</em></button>${open ? `<div class="dglist ok">${okTiles}</div>` : ""}` : "";
    const sev = bad.some((x) => x.st === "bad") ? "bad" : bad.length ? "warn" : na.length ? "na" : "ok";
    const head = bad.length ? T(bad.length === 1 ? "{0} problem" : "{0} problems", bad.length) : T("All OK");
    const sub = [T("{0} sensors", it.length), na.length ? T("{0} unavailable", na.length) : ""].filter(Boolean).join(" · ");
    const found = discoverDiag(this._hass, this._c);
    const nw = found.length ? `<div class="dgnew"><div><b>${esc(T(found.length === 1 ? "{0} new sensor found" : "{0} new sensors found", found.length))}</b><small>${esc(found.map((f) => f.label).join(", "))}</small></div>
      <div class="btnrow"><button class="btn sm" data-dg-ignore>${esc(T("Ignore"))}</button><button class="btn sm pl" data-dg-add>${ico("plus")} ${esc(T("Add"))}</button></div></div>` : "";
    return `${sheetHd("gauge", T("Diagnostics"))}
      ${it.length ? `<div class="dgcard ${sev}"><span class="dgbig">${ico(bad.length ? "alert" : "check")}</span><div><b>${esc(head)}</b><small>${esc(sub)}</small></div></div>` : ""}
      <div class="dgbody">${nw}${it.length ? "" : `<p class="hint">${esc(T("There are no diagnostic sensors. Add them from Settings."))}</p>`}${sec("Problems", bad, "bad")}${sec("Unavailable", na, "na")}${okSec}</div>
      <div class="btnrow dgfoot"><button class="btn sm" data-dg-set>${ico("sliders")} ${esc(T("Sensor settings"))}</button></div>`;
  }

  /* ───── vehicle status ───── */
  _vehicle() {
    const unlocked = this._is("lock.doors", "unlocked") || this._is("lock.doors", "unlocking");
    const lights = ["position_lamp", "low_beam", "high_beam"].some((k) => this._is(`binary_sensor.${k}`, "on"));
    const charging = this._is("binary_sensor.charging", "on");
    const plugged = this._is("binary_sensor.charger_plugged", "on");
    const battery = this._n("sensor.battery_level");
    const open = OPEN_ITEMS.filter(([k]) => this._is(k, "on"));
    const blind = OPEN_ITEMS.some(([k]) => this._obj(k) && this._s(k) === null); /* a door/hood/trunk sensor exists but does not report */
    let img;
    if (charging) img = unlocked ? "charging_unlocked" : "charging";
    else if (unlocked) img = lights ? "unlocked_lights" : "unlocked";
    else if (lights) img = "lights";
    else if (plugged && battery !== null && battery >= 100) img = "complete";
    else img = "off";
    return { unlocked, lights, charging, plugged, battery, open, blind, img };
  }
  _scUpd() {
    const a = this._el && this._el.actions; if (!a) return;
    if (!a._scBound) { a._scBound = true; a.addEventListener("scroll", () => this._scUpd(), { passive: true }); }
    const r = a.scrollWidth - a.clientWidth - a.scrollLeft > 6, l = a.scrollLeft > 6;
    a.toggleAttribute("data-r", r); a.toggleAttribute("data-l", l);
  }
  _ageMin() { const t = new Date(this._s("sensor.last_updated") || "").getTime(); return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : 0; }
  _age() {
    const raw = this._s("sensor.last_updated");
    if (!raw) return "--";
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) return "--";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return T("just now");
    if (m < 60) return T("{0} min ago", m);
    if (m < 1440) return T("{0} h ago", Math.floor(m / 60));
    return T("{0} d ago", Math.floor(m / 1440));
  }
  _fmtLeft(raw) { const m = raw && /^(\d+):(\d{1,2})/.exec(raw); return m ? T("{0}h {1}m", +m[1], +m[2]) : raw || ""; }
  _chargeCurrent() {
    const dc = this._n("sensor.dc_charge_current");
    if (dc && dc > 0) return `DC ${Math.round(dc)} ${this._unit("sensor.dc_charge_current") || "A"}`;
    const acKey = this._n("sensor.ac_charge_current") !== null ? "sensor.ac_charge_current" : "sensor.charge_current";
    const ac = this._n(acKey);
    return ac && ac > 0 ? `AC ${Math.round(ac)} ${this._unit(acKey) || "A"}` : "";
  }
  _offline() { const o = this._obj("binary_sensor.cloud_connection"), s = o && o.state; return s === "off" || s === "unavailable"; } /* "unknown" is not offline; a missing entity is not offline */
  _status(v) {
    const cloudOk = this._is("binary_sensor.cloud_connection", "on");
    const left = this._s("sensor.remaining_charge_time_h_mm");
    if (v.open.length) {
      const names = v.open.slice(0, 2).map((x) => x[1]).join(" · ");
      return { icon: "alert", text: "Open", sub: names + (v.open.length > 2 ? ` +${v.open.length - 2}` : ""), rgb: "var(--ds-bad)" };
    }
    const pl = this._pending && this._pending.lock;
    if (pl) { const un = pl.before === "locked"; return { icon: un ? "unlock" : "lock", text: un ? "Unlocking…" : "Locking…", sub: "Waiting for confirmation from the vehicle", rgb: "var(--ds-warn)" }; }
    if (this._s("binary_sensor.cloud_connection") === null && this._s("lock.doors") === null) return { icon: "alert", text: "Vehicle not found", sub: "Check the prefix in Settings → Vehicle", rgb: "var(--ds-warn)" };
    if (!cloudOk) return { icon: "cloudoff", text: "Offline", sub: T("Last update {0}", this._age()), rgb: "var(--ds-bad)" };
    if (v.charging) return { icon: "bolt", text: "Charging", sub: "", rgb: "var(--ds-ok)" };
    const alerts = this._diagItems().filter((d) => d.on).length, warn = alerts ? T(alerts === 1 ? "{0} warning" : "{0} warnings", alerts) : "";
    if (v.plugged) return { icon: "plug", text: "Charger connected", sub: warn, rgb: "var(--ds-warn)" };
    if (this._s("lock.doors") === "unlocking") return { icon: "unlock", text: "Unlocking…", sub: warn, rgb: "var(--ds-warn)" };
    if (v.unlocked) return { icon: "unlock", text: "Unlocked", sub: warn, rgb: "var(--ds-warn)", plain: true, warn, locked: false };
    const ls = this._s("lock.doors"); /* "locked" must be known before the car is shown as locked */
    if (ls === "locking") return { icon: "lock", text: "Locking…", sub: warn, rgb: "var(--ds-warn)" };
    if (ls !== "locked") return { icon: "alert", text: "Unknown state", sub: "The lock is not reporting its state", rgb: "var(--ds-warn)" };
    return { icon: "lock", text: "Locked", sub: warn, rgb: alerts ? "var(--ds-warn)" : "var(--ds-ok)", plain: true, warn, locked: true };
  }

  /* Rolling messages under "Locked / Unlocked" (status_sub setting). Returns [{t, w}] — w: warning */
  _since(ms) { const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24); return d >= 1 ? T("{0} d", d) : h >= 1 ? T("{0} h {1} min", h, m % 60) : T("{0} min", m); }
  _statusMsgs(st, mode) {
    const out = [], lk = this._obj("lock.doors"), lt = lk && Date.parse(lk.last_changed);
    if (st.warn) out.push({ t: st.warn, w: true });
    if (Number.isFinite(lt)) { const F = haFmt(this._hass), same = new Date().toDateString() === new Date(lt).toDateString(), hm = F.hm(lt);
      out.push({ t: T(st.locked ? "Locked at {0}" : "Unlocked at {0}", same ? hm : F.dm(lt) + " " + hm) }); }
    if (mode === "roll") { if (!st.warn) out.push({ t: this._vehicle().blind ? T("Some sensors are not reporting") : T("All closed · no warnings") }); return out.slice(0, 2); }
    const pw = this._obj("sensor.power_status"), pt = pw && Date.parse(pw.last_changed);
    if (pw && pw.state !== "on" && pw.state !== "unavailable" && pw.state !== "unknown" && Number.isFinite(pt)) out.push({ t: T("Parked {0}", this._since(Date.now() - pt)) });
    const r = this._n("sensor.remaining_range"); if (r !== null) out.push({ t: T("Range {0} km", this._fmtNum(r)) });
    return out.slice(0, 3);
  }

  /* ───── climate ───── */
  _climateIsOn() {
    if (this._s("binary_sensor.climate_on") !== null) return this._is("binary_sensor.climate_on", "on");
    const s = this._s("climate.cabin_climate");
    return s !== null && s !== "off";
  }
  _climateCall(turnOn) {
    const o = this._obj("climate.cabin_climate");
    if (!o) return null;
    const feat = o.attributes?.supported_features || 0;
    const modes = o.attributes?.hvac_modes || [];
    if (turnOn) {
      if (feat & CLIMATE_TURN_ON) return ["climate", "turn_on", "climate.cabin_climate"];
      const mode = this._c.climate_on_mode || ["auto", "heat_cool", "cool", "heat", "fan_only"].find((m) => modes.includes(m)) || modes.find((m) => m !== "off");
      return mode ? ["climate", "set_hvac_mode", "climate.cabin_climate", { hvac_mode: mode }] : null;
    }
    if (feat & CLIMATE_TURN_OFF) return ["climate", "turn_off", "climate.cabin_climate"];
    return modes.includes("off") ? ["climate", "set_hvac_mode", "climate.cabin_climate", { hvac_mode: "off" }] : null;
  }

  /* ───── buttons ───── */
  _actions() {
    const lock = this._s("lock.doors"), win = this._s("cover.windows"), trunk = this._s("cover.trunk"), climate = this._s("climate.cabin_climate");
    const climateOn = this._climateIsOn();
    const cCall = climate === null ? null : this._climateCall(!climateOn);
    const tg = (() => { const t = this._tgt(); const n = t ? parseFloat(t.state) : NaN; return Number.isFinite(n) ? n : null; })();
    const openTone = (s) => (s === "closed" ? "" : s === null ? "bad" : "warn");
    const txt = (s, closed, open) => (s === "closed" ? closed : s === "open" ? open : s === null ? "unavailable" : s);
    const all = {
      lock: { on: lock === "locked", icon: lock === "locked" ? "lock" : "unlock", sub: lock === "locked" ? "locked" : lock === "unlocked" ? "unlocked" : lock || "unavailable",
        tone: lock === "locked" ? "ok" : lock === "unlocked" ? "warn" : "bad", disabled: lock === null, watch: "lock.doors", confirm: lock === "locked" ? "unlock" : "lock",
        call: ["lock", lock === "locked" ? "unlock" : "lock", "lock.doors"] },
      windows: { on: win === "open", icon: win === "closed" || win === null ? "windowclosed" : "windowopen", sub: txt(win, "closed", "open"), tone: openTone(win), disabled: win === null,
        watch: "cover.windows", confirm: win === "closed" ? "windows" : null, call: ["cover", "toggle", "cover.windows"] },
      trunk: { on: trunk === "open", icon: trunk === "open" ? "trunkopen" : "trunk", sub: txt(trunk, "closed", "open"), tone: openTone(trunk), disabled: trunk === null, watch: "cover.trunk", confirm: trunk === "closed" ? "trunk" : null,
        call: ["cover", "toggle", "cover.trunk"] },
      climate: { on: climateOn, icon: climateOn ? "snow" : "snowoff", sub: climate === null ? "unavailable" : climateOn ? (tg !== null ? `on · ${this._fmtNum(tg, 1)}°` : "on") : "off", tone: climate === null ? "bad" : "", disabled: climate === null, confirm: "climate",
        watch: this._obj("binary_sensor.climate_on") ? "binary_sensor.climate_on" : "climate.cabin_climate", timeout: 35000, call: cCall,
        unsupported: climateOn ? "This entity has no turn-off command for climate" : "This entity has no turn-on command for climate" },
      tires: (() => { const s = this._tiresSummary(); return { icon: "tirealert", ...s, open: "iso" }; })(),
      cabin: (() => { const s = this._cabinSummary(climateOn); return { icon: s.on ? "interioron" : "interior", ...s, open: "climate" }; })(),
      flash: { confirm: "flash", icon: "headlight", sub: "flash", btn: "button.flash_lights", call: ["button", "press", "button.flash_lights"] },
      honk: { confirm: "honk", icon: "horn", sub: "sound signal", btn: "button.honk_horn", call: ["button", "press", "button.honk_horn"] },
      find: { confirm: "find", icon: "find", sub: "locate", btn: "button.flash_lights_and_honk", call: ["button", "press", "button.flash_lights_and_honk"] },
      refresh: { confirm: "refresh", icon: "refresh", sub: this._age(), btn: "button.refresh_vehicle_data", watch: "sensor.last_updated", timeout: 25000, call: ["button", "press", "button.refresh_vehicle_data"] },
    };
    return [...BUTTON_IDS, "refresh"].map((id) => {
      const a = { id, label: BUTTON_LABELS[id], ...all[id] };
      if (a.btn) {
        const o = this._obj(a.btn);
        if (!o || o.state === "unavailable") { a.disabled = true; a.tone = "bad"; }
      }
      return a;
    });
  }
  _cabinSummary(climateOn) {
    const L = (k) => this._level(k), act = [];
    if (climateOn) act.push("A/C");
    if (L("number.front_left_seat_heating_level") > 0 || L("number.front_right_seat_heating_level") > 0) act.push("heat");
    if (L("number.front_left_seat_ventilation_level") > 0 || L("number.front_right_seat_ventilation_level") > 0) act.push("vent");
    if (L("switch.steering_wheel_heating") > 0) act.push("steering");
    return { on: act.length > 0, sub: act.length ? act.join(" · ") : "dashboard", tone: "" };
  }
  _tiresSummary() {
    const rs = TIRES.map((t) => this._tire(t)), vals = rs.map((r) => r.bar).filter((x) => x !== null);
    const unit = this._c.tire_unit, f = (b) => (unit === "kPa" ? Math.round(b * 100) : unit === "psi" ? (b / 0.0689476).toFixed(1) : b.toFixed(2));
    const bad = rs.some((r) => r.alarm), warn = rs.some((r) => r.note);
    return { sub: bad ? "alarm" : warn ? "check pressure" : vals.length ? `${f(Math.min(...vals))} ${unit} min` : "--", tone: bad ? "bad" : warn ? "warn" : "" };
  }
  _onAction(id) {
    const a = this._actions().find((x) => x.id === id);
    if (!a || a.disabled || this._pending[id]) return;
    if (a.open) { this._view = a.open; return this._force(); }
    if (!a.call) { this._flash(id, "error"); this._toast(a.unsupported || "The action is not supported", "error"); return; }
    if (a.confirm && this._c.confirm.includes(a.confirm)) {
      this._confirm = { id, key: a.confirm };
      clearTimeout(this._confirmTimer);
      this._confirmTimer = setTimeout(() => { this._confirm = null; this._force(); }, 8000);
      return this._force();
    }
    this._run(a);
  }
  /* the final state a command must reach (null = any change counts) */
  _want(a, before) {
    const c = a.call || [], svc = c[1];
    if (a.watch === "binary_sensor.climate_on") return svc === "turn_off" || (svc === "set_hvac_mode" && (c[3] || {}).hvac_mode === "off") ? "off" : "on";
    if (a.watch === "climate.cabin_climate") return svc === "turn_off" || (svc === "set_hvac_mode" && (c[3] || {}).hvac_mode === "off") ? "off" : "!off";
    const W = { lock: "locked", unlock: "unlocked", open_cover: "open", close_cover: "closed" };
    if (W[svc]) return W[svc];
    return svc === "toggle" && (before === "open" || before === "closed") ? (before === "open" ? "closed" : "open") : null;
  }
  async _run(a) {
    const before = a.watch ? this._s(a.watch) ?? this._obj(a.watch)?.state : null;
    const me = this._pending[a.id] = { before, watch: a.watch, want: this._want(a, before) }; /* this invocation: a late answer of an older one must not touch the UI */
    this._pending[a.id].timer = setTimeout(() => {
      if (!this._pending[a.id]) return;
      delete this._pending[a.id]; this._flash(a.id, "error"); this._toast("Not confirmed by the vehicle", "error");
    }, a.timeout || 20000);
    this._force();
    const [domain, service, entity, data] = a.call;
    try {
      await this._hass.callService(domain, service, { entity_id: this._id(entity), ...(data || {}) });
    } catch (err) {
      if (this._pending[a.id] !== me) return; /* already timed out or resolved: reported once */
      clearTimeout(me.timer); delete this._pending[a.id]; this._flash(a.id, "error");
      return this._failToast(err);
    }
    if (this._pending[a.id] !== me) return; /* timed out or already confirmed by the state: no late "sent" message */
    if (!a.watch) { clearTimeout(this._pending[a.id]?.timer); delete this._pending[a.id]; this._flash(a.id, "success"); this._actToast = Date.now(); this._toast(this._sentMsg(a, before), "ok"); }
    else { this._actToast = Date.now(); this._toast(this._sentMsg(a, before), "ok"); }
  }
  _doneMsg(id) {
    const st = (k) => this._s(k);
    switch (id) {
      case "lock": return st("lock.doors") === "locked" ? "Vehicle locked" : "Vehicle unlocked";
      case "windows": return st("cover.windows") === "open" ? "Windows opened" : "Windows closed";
      case "trunk": return st("cover.trunk") === "open" ? "Trunk opened" : "Trunk closed";
      case "climate": return this._climateIsOn() ? "Climate turned on" : "Climate turned off";
      case "refresh": return "Vehicle data refreshed";
      default: return null;
    }
  }
  _sentMsg(a, before) {
    const m = { lock: "Lock command sent", windows: "Windows command sent", trunk: "Trunk command sent", climate: "Climate command sent",
      flash: "Command sent: lights", honk: "Command sent: horn", find: "Command sent: lights + horn", refresh: "Data refresh requested" };
    if (a.id === "lock") return (before ?? this._s("lock.doors")) === "locked" ? "Unlock command sent" : "Lock command sent";
    return m[a.id] || `${a.label}: sent`;
  }
  _resolvePending() {
    for (const [id, p] of Object.entries(this._pending)) {
      if (!p.watch) continue;
      const cur = this._obj(p.watch)?.state;
      if (cur === undefined || cur === p.before || TRANSITIONAL.includes(cur) || BAD.includes(cur) || (p.want && (p.want === "!off" ? cur === "off" : cur !== p.want))) continue;
      clearTimeout(p.timer); delete this._pending[id]; this._flash(id, "success");
      const msg = this._doneMsg(id); if (msg) { this._actToast = Date.now(); this._toast(msg, "ok"); }
    }
  }
  /* state changes (e.g. from the app or automatic) → message on the screen */
  _watchChanges(v) {
    const lock = this._s("lock.doors");
    const cur = { lock, climate: this._s("climate.cabin_climate") === null ? null : this._climateIsOn(), charging: v.charging, plugged: v.plugged, open: v.open.length };
    const p = this._prevS; this._prevS = cur;
    if (!p || Date.now() - (this._actToast || 0) < 8000) return;
    let msg = null, type = "ok";
    if (p.lock && cur.lock && p.lock !== cur.lock) { if (cur.lock === "locked") msg = "Vehicle locked"; else if (cur.lock === "unlocked") { msg = "Vehicle unlocked"; type = "warn"; } }
    else if (p.climate !== null && cur.climate !== null && p.climate !== cur.climate) msg = cur.climate ? "Climate turned on" : "Climate turned off";
    else if (p.charging !== cur.charging) msg = cur.charging ? "Charging started" : "Charging stopped";
    else if (p.plugged !== cur.plugged) msg = cur.plugged ? "Charger connected" : "Charger disconnected";
    else if (cur.open > p.open) { msg = T("Something was left open: {0}", v.open.slice(0, 2).map((x) => x[1]).join(", ")); type = "error"; }
    if (msg) setTimeout(() => this._toast(msg, type), 0);
  }
  _flash(id, type) {
    clearTimeout(this._flashes[id]?.timer);
    this._flashes[id] = { type, timer: setTimeout(() => { delete this._flashes[id]; this._force(); }, type === "error" ? 1800 : 1300) };
    this._force();
  }
  _toast(msg, type) {
    clearTimeout(this._toastTimer);
    const ms = ((Number(this._c.toast_duration) > 0 ? Number(this._c.toast_duration) : 5) + (type === "error" ? 3 : 0)) * 1000;
    this._toastState = { msg, type, ms };
    this._toastTimer = setTimeout(() => { this._toastState = null; this._force(); }, ms);
    this._force();
  }
  _diagAct(d) {
    if (d.dgOk !== undefined) { this._dgOk = !this._dgOk; return this._force(); }
    if (d.dgSet !== undefined) { this._diagSheet = false; this._stab = "sensors"; this._customize = true; return this._force(); }
    const found = discoverDiag(this._hass, this._c);
    if (d.dgAdd !== undefined) { this._patch({ diag_custom: [...(this._c.diag_custom || []), ...found.map((f) => ({ entity: f.entity, label: f.label, icon: f.icon }))] }); }
    else if (d.dgIgnore !== undefined) { this._patch({ diag_ignore: [...new Set([...(this._c.diag_ignore || []), ...found.map((f) => f.entity)])] }); }
    this._force();
  }
  /* Lock popup: Lock / Unlock switch with the current state highlighted */
  _lockHtml() {
    const s = this._s("lock.doors"), p = this._pending.lock, locked = s === "locked", unl = s === "unlocked", st = this._status(this._vehicle());
    const text = p ? st.text : locked ? T("Locked") : unl ? T("Unlocked") : s ? s : T("Unavailable");
    const rgb = p || unl ? "var(--ds-warn)" : locked ? "var(--ds-ok)" : "var(--ds-bad)";
    const sub = p ? T("Waiting for confirmation from the vehicle") : this._statusMsgs(st, "roll").map((m) => m.t).join(" · ");
    const off = !!p || !(locked || unl);
    const seg = (k, ic, lb, on) => `<button data-lk="${k}" class="${on ? "on" : ""} ${k === "unlock" ? "w" : ""}"${off ? " disabled" : ""}>${ico(ic)}<span>${esc(lb)}</span></button>`;
    const ask = this._lockAsk && !p ? CONFIRM_TEXT[this._lockAsk] : null; /* confirmation inside this window, no second popup */
    if (ask) return `${sheetHd(unl ? "unlock" : "lock", T("Doors"))}<div class="lkb" style="--st:${rgb}"><div class="lkt">${esc(text)}</div><div class="lks">${esc(sub)}</div></div>
      <div class="lksw"><button data-lk="no">${ico("close")}<span>${esc(T("Cancel"))}</span></button><button data-lk="yes" class="go">${ico(CONF_ICO[this._lockAsk])}<span>${esc(T("Confirm"))}</span></button></div>
      <p class="lkh q">${esc(T(ask[0]))}</p>`;    return `${sheetHd(unl ? "unlock" : "lock", T("Doors"))}<div class="lkb" style="--st:${rgb}"><div class="lkt">${esc(text)}</div><div class="lks">${esc(sub)}</div></div>
      <div class="lksw">${seg("lock", "lock", T("Lock"), locked)}${seg("unlock", "unlock", T("Unlock"), unl)}</div>
      <p class="lkh">${esc(T("Tap the other side to change"))}</p>`;
  }
  _lockPick(want) {
    const s = this._s("lock.doors");
    if (want === "no") { clearTimeout(this._confirmTimer); this._lockAsk = null; return this._force(); }
    if (want === "yes") { const a = this._actions().find((x) => x.id === "lock"); clearTimeout(this._confirmTimer); this._lockAsk = null; if (a) this._run(a); else this._force(); return; }
    if (this._pending.lock || (want === "lock" && s === "locked") || (want === "unlock" && s === "unlocked") || (s !== "locked" && s !== "unlocked")) return;
    if (this._c.confirm.includes(want)) {
      this._lockAsk = want; clearTimeout(this._confirmTimer);
      this._confirmTimer = setTimeout(() => { this._lockAsk = null; this._force(); }, 8000);
      return this._force();
    }
    this._onAction("lock");
  }
  _closeSheet() { clearTimeout(this._confirmTimer); if (this._confirm && this._confirm.temp !== undefined) this._tpend = undefined; this._confirm = null; const wasC = this._customize; this._customize = false; this._diagSheet = false; this._lockSheet = false; this._lockAsk = null; this._enSheet = false; this._enEl = null; this._uiSave(); this._force(); if (wasC && this._yPend) { this._yPend = false; this._saveYaml(); } }
  _popupBox() { if (!this._el) return null; if (this._confirm || this._customize || this._diagSheet || this._lockSheet || this._enSheet) return this._el.box; return this._view ? this._el.vbox : null; }
  _closeTop() { if (this._confirm || this._customize || this._diagSheet || this._lockSheet || this._enSheet) return this._closeSheet(); if (this._view) { this._view = null; this._force(); } }
  _key(e) {
    const box = this._popupBox(); if (!box) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return this._closeTop(); }
    if (e.key !== "Tab") return;
    const f = [...box.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null || x.getClientRects().length);
    if (!f.length) return;
    const act = this.shadowRoot.activeElement, i = f.indexOf(act);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  }
  _focusSync() {
    const open = !!this._popupBox();
    if (open && !this._wasOpen) {
      const a = this.shadowRoot.activeElement;
      this._retSel = a ? (a.dataset.id ? `[data-id="${a.dataset.id}"]` : a.dataset.more !== undefined ? "[data-more]" : a.id ? `#${a.id}` : a.className ? `.${String(a.className).split(" ")[0]}` : null) : null;
      requestAnimationFrame(() => { const b = this._popupBox(); const t = b && (b.querySelector(".go") || b.querySelector(".x") || b.querySelector("button")); if (t) t.focus({ preventScroll: true }); });
    } else if (!open && this._wasOpen && this._retSel) {
      const sel = this._retSel; this._retSel = null;
      requestAnimationFrame(() => { const t = this.shadowRoot.querySelector(sel); if (t && !t.disabled) t.focus({ preventScroll: true }); });
    }
    this._wasOpen = open;
  }
  _paintNotificationLink() {
    const button=this._el?.nfbell;if(!button)return;
    button.hidden=(this._c.top_buttons_hidden||[]).includes('bell');
    button.innerHTML=ico('chat');button.title=T('Notifications');button.setAttribute('aria-label',button.title);
  }
  _openNotifications() {
    history.pushState(null,'','/deepal-companion#notifications');
    window.dispatchEvent(new CustomEvent('location-changed',{detail:{replace:false}}));
  }
  _vsheetOpen() { return !!this._view && !this._customize && !this._diagSheet && !this._lockSheet && !this._enSheet; }

  /* ───── interior: seat levels / steering wheel / temperature ───── */
  _level(key) {
    const o = this._opt[key], now = Date.now();
    const real = key.startsWith("switch.") ? (this._is(key, "on") || this._is("binary_sensor.steering_wheel_heater", "on") ? 1 : 0) : this._n(key) ?? 0;
    if (o && now - o.t < 15000) { if (o.v === real) delete this._opt[key]; else return o.v; }
    return real;
  }
  _setOpt(key, v) {
    this._opt[key] = { v, t: Date.now() };
    clearTimeout(this._optTimer);
    this._optTimer = setTimeout(() => this._force(), 15200);
    this._force();
  }
  async _spot(id) {
    const sp = INT_SPOTS.find((s) => s[0] === id);
    if (!sp) return;
    const key = sp[1], cur = this._level(key);
    try {
      if (key.startsWith("switch.")) {
        this._setOpt(key, cur ? 0 : 1);
        await this._hass.callService("switch", cur ? "turn_off" : "turn_on", { entity_id: this._id(key) });
      } else {
        const max = this._obj(key)?.attributes?.max ?? 3;
        const next = cur >= max ? 0 : cur + 1;
        this._setOpt(key, next);
        await this._hass.callService("number", "set_value", { entity_id: this._id(key), value: next });
      }
    } catch (err) { delete this._opt[key]; this._failToast(err); }
  }
  /* Target temperature: directly from the climate entity (no helper) */
  _tgt() {
    const co = this._obj("climate.cabin_climate"), a = co?.attributes;
    if (!a || a.temperature == null) return null;
    return { state: String(a.temperature), attributes: { min: a.min_temp, max: a.max_temp, step: a.target_temp_step } };
  }
  /* changing the target while the climate is off turns it on → asks for the same confirmation as power */
  _needTempConfirm() { return !this._climateIsOn() && (this._c.confirm_temp !== false || this._c.confirm.includes("climate")); }
  _failToast(err) { return this._toast(err?.message ? T("Failed: {0}", err.message) : T("The command failed"), "error"); }
  _askTemp(v) {
    this._confirm = { id: "climate", key: "climate_temp", temp: v };
    clearTimeout(this._confirmTimer);
    this._confirmTimer = setTimeout(() => { this._confirm = null; this._tpend = undefined; this._force(); }, 8000);
    this._force();
  }
  async _applyTemp(v) {
    this._tpend = v; clearTimeout(this._tTimer2);
    this._tTimer2 = setTimeout(() => { this._tpend = undefined; this._force(); }, 6000);
    this._force();
    try { await this._setTgt(v); }
    catch (err) { this._tpend = undefined; this._failToast(err); }
  }
  _setTgt(v) { return this._hass.callService("climate", "set_temperature", { entity_id: this._id("climate.cabin_climate"), temperature: v }); }
  _tempStep(d) {
    const o = this._tgt();
    if (!o) return;
    const a = o.attributes || {}, step = a.step || 0.5, min = a.min ?? 16, max = a.max ?? 32;
    const cur = this._tpend ?? parseFloat(o.state);
    if (!Number.isFinite(cur)) return;
    this._tpend = Math.min(max, Math.max(min, Math.round((cur + d * step) / step) * step));
    clearTimeout(this._tTimer);
    this._tTimer = setTimeout(() => {
      const v = this._tpend;
      if (this._needTempConfirm()) return this._askTemp(v);
      this._applyTemp(v);
    }, 800);
    clearTimeout(this._tTimer2);
    this._force();
  }

  /* ───── build ───── */
  _heroSrc(k, idx = 0) {
    const c = this._c, file = c.images[k] || HERO_FILES[k] || DASH_FILES[k];
    if (/^(https?:)?\/\//.test(file) || file.startsWith("/")) return idx === 0 ? file : null;
    const bases = c.image_path ? [normPath(c.image_path)] : [`${SCRIPT_BASE}images/car/`];
    return bases[idx] ? bases[idx] + file : null;
  }
  _layerBase() { return this._c.layers_path ? normPath(this._c.layers_path) : `${SCRIPT_BASE}images/`; }

  /* Air from the vents: bundles of thin curves that fan out, with fading transparency (image coordinates 510×285) */
  _airSvg() {
    // middle vents: fan; side vents (dashboard slits): thin "natural" flow lines
    const R = [
      [[244, 170, 236, 195, 190, 218, 160, 233], [236, 172, 232, 200, 222, 232, 205, 250]],
      [[270, 170, 284, 198, 320, 216, 350, 233], [262, 172, 268, 205, 285, 235, 300, 250]],
    ];
    const f = (n) => n.toFixed(1), P = (p) => `M${f(p[0])} ${f(p[1])}C${f(p[2])} ${f(p[3])} ${f(p[4])} ${f(p[5])} ${f(p[6])} ${f(p[7])}`;
    const grad = (id, x0, y0, x1, y1) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}"><stop offset="0" style="stop-color:var(--a0)" stop-opacity=".95"/><stop offset=".55" style="stop-color:var(--a1)" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--a2)" stop-opacity="0"/></linearGradient>`;
    let defs = '<filter id="airb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter><filter id="airb2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".6"/></filter><filter id="airb3" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation=".45"/></filter>', body = "";
    R.forEach(([A, B], r) => {
      const N = 9, x0 = (A[0] + B[0]) / 2, y0 = (A[1] + B[1]) / 2, x1 = (A[6] + B[6]) / 2, y1 = (A[7] + B[7]) / 2;
      defs += grad("ag" + r, x0, y0, x1, y1);
      const Br = `L${f(B[6])} ${f(B[7])}C${f(B[4])} ${f(B[5])} ${f(B[2])} ${f(B[3])} ${f(B[0])} ${f(B[1])}Z`;
      body += `<path class="bg" d="${P(A)}${Br}" fill="url(#ag${r})" filter="url(#airb)" style="--d:${(-r * 0.7).toFixed(1)}s"/>`;
      let st = "";
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1), s = A.map((v, i) => v * (1 - t) + B[i] * t);
        const edge = k === 0 || k === N - 1, w = edge ? 1 : 1.4 + ((k * 7 + r) % 3) * 0.5;
        const dl = -(((k * 0.53 + r * 0.9) % 2.4)).toFixed(2), tt = (2.0 + ((k * 5 + r * 3) % 7) * 0.22).toFixed(2);
        st += `<path class="st" d="${P(s)}" pathLength="100" stroke="url(#ag${r})" stroke-width="${w}" style="--w:${(3.4 + ((k * 3 + r) % 5) * 0.4).toFixed(2)}s;--d:${dl}s;--t:${tt}s"/>`;
      }
      body += `<g filter="url(#airb2)">${st}</g>`;
    });
    // side slits: right x 438–464 (left is a mirror), flow toward the passengers
    // right slit: soft flow toward the passengers
    const W = [[0, 78, -6, -16, -22], [4, 92, 5, -10, -26], [8, 70, -4, -18, -16], [12, 100, 6, -6, -24], [16, 84, -5, -14, -28], [20, 96, 4, -9, -20], [24, 74, -3, -17, -23], [27, 88, 5, -8, -30]];
    const wisp = (p, k, side, w, da) => `<path class="st" d="${P(p)}" pathLength="100" stroke="url(#as${side})" stroke-width="${w}" stroke-dasharray="${da}" style="--w:${(3.2 + ((k * 3 + side) % 5) * 0.45).toFixed(2)}s;--d:${-(((k * 0.61 + side * 0.9) % 2.4)).toFixed(2)}s;--t:${(2.8 + ((k * 5 + side * 3) % 7) * 0.28).toFixed(2)}s"/>`;
    defs += grad("as0", 451, 123, 430, 215) + grad("as1", 80, 122, 12, 200);
    let st = "";
    W.forEach(([dx, L, a, b, c], k) => { const x = 438 + dx; st += wisp([x, 123, x + a, 123 + L * 0.3, x + b, 123 + L * 0.65, x + c, 123 + L], k, 0, (0.7 + (k % 3) * 0.2).toFixed(2), k % 2 ? "78 22" : "64 36"); });
    body += `<path class="bg" d="M438 123C436 150 424 175 412 200L440 200C450 175 464 150 465 123Z" fill="url(#as0)" filter="url(#airb)" style="opacity:.4"/><g filter="url(#airb3)">${st}</g>`;
    // left slit: the air comes out BEHIND the steering wheel (the wheel's interior is hidden with a mask) and flows outward/downward
    defs += '<mask id="wmask" maskUnits="userSpaceOnUse" x="0" y="0" width="510" height="285"><rect width="510" height="285" fill="#fff"/><ellipse cx="115" cy="137" rx="69" ry="63" fill="#000" filter="url(#airb3)"/></mask>';
    st = "";
    for (let k = 0; k < 9; k++) {
      const sx = 70 + k * 4, ex = 6 + ((k * 7) % 5) * 7, ey = 160 + ((k * 11) % 6) * 9, ph = (k % 3) * 4;
      st += wisp([sx, 121 + (k % 2), sx - 28, 123 + ph, ex + 24, ey - 48 - ph, ex, ey], k, 1, (0.7 + (k % 3) * 0.2).toFixed(2), k % 2 ? "78 22" : "62 38");
    }
    body += `<g mask="url(#wmask)"><path class="bg" d="M72 120C40 122 20 140 4 170L4 205C30 190 44 160 82 126Z" fill="url(#as1)" filter="url(#airb)" style="opacity:.45"/><g filter="url(#airb3)">${st}</g></g>`;
    return `<svg class="air" viewBox="0 0 510 285" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${defs}</defs>${body}</svg>`;
  }
  // air colour by target temperature: < air_t1 blue, up to air_t2 yellow, above orange
  _airTone(v) {
    const svg = this._el && this._el.dash && this._el.dash.querySelector(".air"); if (!svg || !Number.isFinite(v)) return;
    const t1 = Number(this._c.air_t1) || 22, t2 = Number(this._c.air_t2) || 24;
    const hex2rgb = UI.hex2rgb;
    const base = v < t1 ? this._c.air_c1 : v <= t2 ? this._c.air_c2 : this._c.air_c3, rgb = hex2rgb(base, v < t1 ? "142,197,255" : v <= t2 ? "255,204,61" : "255,122,46").split(",").map(Number);
    const mix = (w) => `rgb(${rgb.map((x) => Math.round(x + (255 - x) * w)).join(",")})`, c = [mix(0.82), mix(0.4), mix(0)];
    c.forEach((x, i) => svg.style.setProperty("--a" + i, x));
  }
  _climHtml() {
    return `<div class="dash" id="dash"><img class="b" alt="">${this._airSvg()}<div class="dov" id="dov"></div></div>
      <div id="vtctl"></div>
      <div class="pk ${this._c.target_style === "bar" ? "bar" : ""}" id="pk"><div class="pt">Target</div>
        <div class="pbar"><div class="pbv"><span id="pkv">--</span><small>°C</small></div><div class="ptr"><input type="range" id="pkr" min="0" max="0" step="1" aria-label="Target"></div><div class="ptk" id="pktk"></div></div>
        <div class="pw"><div class="pp" id="pkp"></div><div class="pf l"></div><div class="pf r"></div><div class="pc"></div></div></div>
      <div class="cseats">${["sh_l", "sv_l", "sv_r", "sh_r"].map((id) => { const [, , icon, name] = INT_SPOTS.find((x) => x[0] === id); return `<button class="sbtn ${icon === "seatvent" ? "cool" : "hot"}" data-spot="${id}" aria-label="${esc(name)}" title="${esc(name)}"><span class="cc">${ico(icon)}</span><span class="nm">${esc(T(name))}</span><span class="lvl"><i></i><i></i><i></i></span></button>`; }).join("")}</div>`;
  }
  _seatsHtml() {
    const B = `${this._layerBase()}interior/`;
    const btns = INT_SPOTS.map(([id, , icon, name, x, y]) => `<button class="sbtn ${icon === "seatvent" ? "cool" : "hot"}" data-spot="${id}" style="left:${x}%;top:${y}%" aria-label="${esc(name)}" title="${esc(name)}">${ico(icon)}<span class="lvl"><i></i><i></i><i></i></span></button>`).join("");
    return `<div class="ipane"><div class="ipi"><img data-l="base" src="${esc(B)}base.webp?r=2" alt="">${INT_LAYERS.map((n) => `<img class="l" data-l="${n}" src="${esc(B + n)}.webp?r=2" alt="">`).join("")}${btns}</div></div>`;
  }

  /* Layers are not all loaded together: the src is set only when a layer is needed for the first time (e.g. "open door"). DOM writes happen only if something changed. */
  _lazyOn(im, on) {
    this._watchLayerImage(im);
    if (im._on === on) return;
    im._on = on; im.classList.toggle("on", on);
    if (on && !im.getAttribute("src") && im.dataset.src) im.setAttribute("src", im.dataset.src);
  }
  _layerOn(im, [, , fn, op]) {
    const on = !!fn(), o = on && op != null ? String(op) : "";
    this._lazyOn(im, on);
    if (im._op !== o) { im._op = o; im.style.opacity = o; }
  }
  /* Car View layer list [name, folder, condition] in the order of the dec_deepal repo (behind the car → car → in front) */
  _isoLayers(color, wheels) {
    const out = [];
    const L = (dir, name, fn, op) => { out.push([name, dir, fn, op]); };
    const dk = (p, sd) => `binary_sensor.${p}_${sd}_door`, wk = (p, sd) => `binary_sensor.${p}_${sd}_window_open`;
    const door = (p, sd) => { const d = () => this._is(dk(p, sd), "on"), w = () => this._is(wk(p, sd), "on"); L("common", `window_${p}_${sd}_closed`, () => !w() && !d()); L("common", `window_${p}_${sd}_closed_door_open`, () => !w() && d()); L("common", `window_${p}_${sd}_alert`, () => w() && !d()); L("common", `window_${p}_${sd}_alert_door_open`, () => w() && d()); L(color, `door_${p}_${sd}_open`, d); L(color, `door_${p}_${sd}_closed`, () => !d()); };
    const trunk = () => this._is("binary_sensor.trunk", "on"), hood = () => this._is("binary_sensor.hood", "on");
    door("rear", "right"); door("front", "right"); L(color, "trunk_closed", () => !trunk());
    L(color, "base", () => true); if (wheels) L("common", "wheels_" + wheels, () => true);
    L(color, "trunk_open", trunk); L(color, "hood_open", hood); L(color, "hood_closed", () => !hood());
    door("rear", "left"); door("front", "left");
    /* The windows of the far side are hidden behind the car; when open they are drawn red ON TOP of the car, semi-transparent, as if seen through the glass */
    for (const p of ["front", "rear"]) { const d = () => this._is(dk(p, "right"), "on"), w = () => this._is(wk(p, "right"), "on"); L("common", `window_${p}_right_alert`, () => w() && !d(), FAR_ALERT); L("common", `window_${p}_right_alert_door_open`, () => w() && d(), FAR_ALERT); }
    L("common", "low_beam_on", () => this._is("binary_sensor.low_beam", "on"));
    return out;
  }

  /* The door handles of the unlocked car (SVG over the layers); hidden while their door is open */
  _hdlSvg(top) {
    const r = top ? HDL_TOP.map(([k, x, y]) => `<rect data-d="${k}" x="${x - 2}" y="${y - 12}" width="4" height="24" rx="2"/>`) : HDL_ISO.map(([k, x, y, a]) => `<rect data-d="${k}" x="${x - 11}" y="${y - 2}" width="22" height="4" rx="2" transform="rotate(${a} ${x} ${y})"/>`);
    return `<svg class="hdl" viewBox="0 0 750 ${top ? 750 : 500}" aria-hidden="true">${r.join("")}</svg>`;
  }
  _hdlSync(box) {
    for (const r of box.querySelectorAll(".hdl rect")) { const [p, sd] = r.dataset.d.split("_"); r.classList.toggle("off", this._is(`binary_sensor.${p}_${sd}_door`, "on")); }
  }

  /* Top view (vista_planta): layers 750×750 in the order of the dec_deepal repo. All layers that are painted (and the open doors/bonnet/tailgate/windows) are in the car's colour; only the lights are shared. */
  _topLayers(color) {
    const out = [], L = (dir, name, fn) => { out.push([name, dir, fn]); };
    const hood = () => this._is("binary_sensor.hood", "on"), trunk = () => this._is("binary_sensor.trunk", "on");
    L(color, "base", () => true);
    L(color, "hood_closed", () => !hood()); L(color, "hood_open", hood);
    L(color, "trunk_closed", () => !trunk()); L(color, "trunk_open", trunk);
    for (const p of ["front", "rear"]) for (const sd of ["left", "right"]) {
      const d = () => this._is(`binary_sensor.${p}_${sd}_door`, "on");
      L(color, `door_${p}_${sd}_closed`, () => !d()); L(color, `door_${p}_${sd}_open`, d);
    }
    for (const p of ["front", "rear"]) for (const sd of ["left", "right"]) {
      const d = () => this._is(`binary_sensor.${p}_${sd}_door`, "on"), w = () => this._is(`binary_sensor.${p}_${sd}_window_open`, "on");
      L(color, `window_${p}_${sd}_open`, () => w() && !d()); /* with the red of the open window and the door frame in the car's colour */
    }
    L("common", "low_beam_on", () => this._is("binary_sensor.low_beam", "on"));
    return out;
  }
  /* Which view the hero shows: the device's choice (button) or the default from the settings */
  _heroView() {
    if (this._hview === undefined) this._hview = lsRead(`deepal-s05-view:${this._c.prefix}`) || null;
    return !this._topFail && (this._hview || this._c.hero_view) === "top" ? "top" : "iso";
  }
  _toggleView() {
    this._hview = this._heroView() === "top" ? "iso" : "top";
    lsWrite(`deepal-s05-view:${this._c.prefix}`, this._hview);
    this._force();
  }

  /* Day phase for the background: sun.sun (sun elevation) if present, otherwise the clock */
  _skyPhase() {
    const m = this._c.hero_sky;
    if (SKY_PH[m]) return m;
    if (m !== "auto") return "";
    const a = this._hass?.states?.["sun.sun"]?.attributes, e = a && a.elevation != null ? Number(a.elevation) : NaN;
    if (!isNaN(e)) return e < -6 ? "night" : e < 8 ? (a.rising ? "morning" : "evening") : a.rising && e < 30 ? "morning" : "afternoon";
    const h = new Date().getHours();
    return h >= 6 && h < 11 ? "morning" : h >= 11 && h < 17 ? "afternoon" : h >= 17 && h < 20 ? "evening" : "night";
  }
  _skySet(on) {
    const el = this._el.sky; if (!el) return;
    const ph = on ? this._skyPhase() : "";
    if (this._skyP === ph) return;
    this._skyP = ph; el.dataset.p = ph; el.innerHTML = ph ? skySvg(ph) : "";
  }
  /* "Car View" style hero: 3/4 render with live doors/bonnet/tailgate/windows/lights; when the charger is connected
     (or the car is charging) it switches to the translucent view (vista_carga) with the cable and the same charging effects as the photos. */
  _heroCv(v) {
    const el = this._el, c = this._c, on = c.hero_style === "carview" && !this._cvFail;
    el.hero.dataset.style = on ? "carview" : "photo";
    this._skySet(on);
    el.vtg.hidden = true;
    if (!on) return this._loadPhotos();
    const color = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black", wheels = ["open", "pro"].includes(c.iso_wheels) ? c.iso_wheels : "";
    const root = this._layerBase(), view = this._heroView();
    const plug = !!(v.charging || v.plugged) && view !== "top";
    const sc = (Number(c.image_scale) || 1.2) / 1.2;
    el.hero.style.setProperty("--ds-cvs", String(Math.max(0.5, Math.min(2, sc) * 1.08)));
    el.hero.style.setProperty("--ds-tvs", String(Math.max(0.5, Math.min(1.3, sc * 0.96))));
    el.cv.dataset.v = view; el.cv.classList.toggle("chg", plug);
    /* Only one set of images is visible and updated at a time: charging (translucent view) → 3/4 or top. The others stay hidden and are not touched. */
    el.cvi.hidden = !(plug || view === "iso"); el.cvt.hidden = plug || view !== "top";
    el.vtg.hidden = !!this._topFail;
    {
      const top = view === "top", tl = top ? "3/4 view" : "Top view";
      el.vtg.innerHTML = `<i class="vti ${top ? "iso" : "top"}" style="--m:url(${VIEW_ICON[top ? "iso" : "top"]})"></i>`; el.vtg.title = T(tl); el.vtg.setAttribute("aria-label", T(tl));
    }
    if (plug) {
      this._cvbEnsure(root);
      const cb = el.cvb, one = (n) => cb.querySelector(`img[data-n="${n}"]`);
      this._lazyOn(one("cable_connected"), !v.charging); this._lazyOn(one("cable_charging"), !!v.charging); this._lazyOn(one("base"), true);
      if (/sweep/.test(el.hero.dataset.fx)) { const sw = cb.querySelector(".sweep"); if (sw && !sw.getAttribute("src")) sw.setAttribute("src", sw.dataset.src); }
    } else if (view === "top") {
      const key = color + "|" + root;
      if (this._cvtKey !== key || !el.cvt.firstChild) {
        this._cvtKey = key; this._cvtL = this._topLayers(color);
        el.cvt.innerHTML = this._cvtL.map(([n, d]) => `<img data-n="${n}" data-src="${esc(root + "top/" + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("") + this._hdlSvg(true);
        this._cvtImgs = [...el.cvt.querySelectorAll("img")];
        this._cvBaseGuard(el.cvt, true);
      }
      this._cvtImgs.forEach((im, i) => this._layerOn(im, this._cvtL[i]));
      if (v.unlocked) this._hdlSync(el.cvt);
    } else {
      const key = color + "|" + wheels + "|" + root;
      if (this._cvKey !== key || !this._cvImgs || !el.cva.firstChild) {
        this._cvKey = key; this._cvL = this._isoLayers(color, wheels);
        el.cva.innerHTML = this._cvL.map(([n, d]) => `<img data-n="${n}" data-src="${esc(root + "iso/" + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("") + this._hdlSvg(false);
        this._cvImgs = [...el.cva.querySelectorAll("img")];
        this._cvBaseGuard(el.cva);
      }
      this._cvImgs.forEach((im, i) => this._layerOn(im, this._cvL[i]));
      if (v.unlocked) this._hdlSync(el.cva);
    }
  }
  /* If the layers are missing (e.g. the images folder was not copied) the hero falls back to the photos. Before deciding for good it retries briefly
     (a temporary network error must not close Car View). If only the top-view image is missing, Car View stays in 3/4 and only the button is hidden. */
  _cvBaseGuard(box, top) {
    const base = box.querySelector('img[data-n="base"]');
    if (!base) return;
    this._watchLayerImage(base, () => {
      try { console.warn(`deepal-s05-card: image could not be loaded ${base.dataset.src}`); } catch (_) {}
      if (top) this._topFail = true; else this._cvFail = true;
      this._force && this._force();
    });
  }
  _watchLayerImage(im, failed) {
    if (failed) im._layerFailed = failed;
    if (im._layerWatched) return;
    im._layerWatched = true;
    let attempts = 0;
    im.addEventListener("load", () => { attempts = 0; clearTimeout(im._retryTimer); im._retryTimer = null; });
    im.addEventListener("error", () => {
      if (im._retryTimer) return;
      const delay = [400, 1200, 3000][attempts++];
      if (delay === undefined) { if (im.isConnected) im._layerFailed?.(); return; }
      im._retryTimer = setTimeout(() => {
        im._retryTimer = null;
        if (!im.isConnected || im._on === false) return;
        const src = im.dataset.src;
        if (src) im.src = src + (src.includes("?") ? "&" : "?") + "retry=" + attempts;
      }, delay);
    });
  }
  /* New image/colour/folder: we retry from the start */
  _cvReset() { this._cvFail = false; this._topFail = false; this._cvKey = this._cvtKey = null; }
  /* The translucent charging view is built only the first time the charger connects */
  _cvbEnsure(root) {
    if (this._cvbRoot === root && this._el.cvb.firstChild) return;
    this._cvbRoot = root;
    const ci = (n) => `<img data-n="${n}" data-src="${esc(root + "carga/" + n + ".webp")}" alt="" decoding="async">`;
    this._el.cvb.innerHTML = `${ci("base")}${ci("cable_connected")}${ci("cable_charging")}<svg viewBox="0 0 750 500" preserveAspectRatio="none" aria-hidden="true"><path class="cb" d="${CARGA_D}"/><path class="cf" d="${CARGA_D}"/>
        <g class="pt" transform="translate(${CARGA_PORT[0]} ${CARGA_PORT[1]})"><circle class="pg" r="9"/><circle class="pr" r="6"/><circle class="pr r2" r="6"/></g></svg><img class="sweep" alt="" data-src="${esc(root + "carga/base.webp")}">`;
  }
  /* The hero photos load only when needed (not in Car View) */
  _loadPhotos() {
    for (const im of this._el.imgs) if (!im.getAttribute("src")) im.setAttribute("src", im.dataset.src);
  }

  /* 3/4 view: layers in the order of the dec_deepal repo (behind the car → car → in front) */
  _isoRender(v) {
    const el = this._el, c = this._c, color = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black", wheels = ["open", "pro"].includes(c.iso_wheels) ? c.iso_wheels : "";
    const key = color + "|" + wheels, root = this._layerBase() + "iso/";
    if (this._isoKey !== key) {
      this._isoKey = key;
      this._isoL = this._isoLayers(color, wheels);
      const lines = TIRES.map((t) => { const h = t.hid ? " hid" : "", x = t.wx * 7.5, y = t.wy * 5; return `<line data-pin="${t.id}" class="${h.trim()}" x1="${t.px * 7.5}" y1="${t.py * 5}" x2="${x}" y2="${y}"/>` + (t.hid ? `<circle data-pin="${t.id}" class="hid" cx="${x}" cy="${y}" r="8"/>` : `<circle data-pin="${t.id}" cx="${x}" cy="${y}" r="5"/><circle class="halo" data-pin="${t.id}" cx="${x}" cy="${y}" r="11"/>`); }).join("");
      const pills = TIRES.map((t) => `<div class="tp na" data-t="${t.id}" style="left:${t.px}%;top:${t.py}%"><div class="n">${esc(T(t.name))}</div><div class="v">--</div><div class="s"></div></div>`).join("");
      el.viso.innerHTML = `<div class="isop"><div class="isoi">${this._isoL.map(([n, d]) => `<img data-n="${n}" data-src="${esc(root + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("")}<svg class="tl" viewBox="0 0 750 500" aria-hidden="true">${lines}</svg>${pills}</div></div>`;
      this._isoImgs = [...el.viso.querySelectorAll("img")];
      const base = el.viso.querySelector('img[data-n="base"]');
      el.vmiss.hidden = true;
      if (base) base.addEventListener("error", () => { el.vmiss.hidden = false; const p = el.viso.querySelector(".isop"); if (p) p.classList.add("noimg"); }, { once: true });
    }
    this._isoImgs.forEach((im, i) => this._layerOn(im, this._isoL[i]));
    const notes = [];
    TIRES.forEach((t) => {
      const r = this._tire(t), g = el.viso.querySelector(`.tp[data-t="${t.id}"]`); if (!g) return;
      const st = r.bar === null ? "na" : r.tone === "var(--ds-ok)" ? "ok" : "bad";
      g.className = `tp ${st}`; g.style.opacity = r.stale ? ".7" : "";
      const parts = r.txt.split(" ");
      g.querySelector(".v").innerHTML = `<span>${esc(parts[0])}${r.stale ? "·" : ""}</span>${parts[1] ? `<span class="u">${esc(parts[1])}</span>` : ""}${st === "ok" ? `<span class="check" aria-label="OK">✓</span>` : ""}`;
      g.querySelector(".s").textContent = st === "ok" ? "" : st === "bad" ? `! ${T(r.note || "check pressure")}` : "";
      el.viso.querySelectorAll(`[data-pin="${t.id}"]`).forEach((n) => n.setAttribute("class", `${n.classList.contains("halo") ? "halo " : ""}${n.classList.contains("hid") ? "hid " : ""}${st}`));
      if (r.note) notes.push(`<span><b style="--c:${r.tone}">${esc(T(t.name))}</b>: ${esc(T(r.note))}</span>`);
    });
    const open = v.open.map((x) => x[1]);
    const bits = [...(open.length ? [`<span><b style="--c:var(--ds-bad)">Open:</b> ${esc(open.join(", "))}</span>`] : []), ...notes];
    const hasTy = TIRES.some((t) => this._tire(t).bar !== null);
    if (!bits.length && hasTy) bits.push(`<span><b style="--c:var(--ds-ok)">✓ ${esc(T("All good"))}</b> — ${esc(T("everything closed, pressures OK"))}</span>`);
    el.vextra.innerHTML = bits.length ? `<div class="vline">${bits.join("")}</div>` : ""; el.vextra.hidden = !bits.length;
  }

  _build() {
    const c = this._c;
    this._pkKey = null; this._pkIdx = -1; this._cvKey = null; this._cvImgs = null; this._cvtKey = null; this._cvtImgs = null; this._cvbRoot = null; // the hero DOM is rebuilt: the Car View layers must be loaded again
    const lazyPhotos = c.hero_style === "carview"; /* in Car View the hero photos are not loaded */
    const imgs = Object.keys(HERO_FILES).map((k) => `<img data-k="${k}" data-i="0" data-src="${esc(this._heroSrc(k, 0))}"${lazyPhotos ? "" : ` src="${esc(this._heroSrc(k, 0))}"`} alt="" decoding="async">`).join("");
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <ha-card data-ti="${["blue", "neutral", "custom"].includes(c.tile_icons) ? c.tile_icons : "accent"}" data-pad="${esc(c.card_padding || "normal")}" data-ppad="${esc(c.popup_padding || "normal")}">
        <div class="hero" id="hero">
          <div class="shade-left"></div><div class="shade-top"></div><div class="shade-bot"></div>
          <div class="hero-top"><div><div class="title" id="ttl"><span id="nm">${esc(c.name || "Deepal S05")}</span><span class="plate" id="plate"></span></div><div class="total" id="total"></div></div>
            <div class="meta" id="meta"><button class="rfs dgb" id="dgb" hidden></button><button class="rfs nfbell" id="nfbell" hidden></button><button class="rfs vtg" id="vtg" hidden></button><button class="rfs" id="rfs" data-id="refresh"></button></div></div>
          <div class="status" id="status"></div>
          <div class="tells" id="tells"></div>
          <div class="sky" id="sky"></div>
          <div class="hbox" id="hbox">
          <div class="stage">${imgs}</div>
          <div class="hcv" id="cv"><div class="cvi" id="cvi"><div class="cva" id="cva"></div><div class="cvb" id="cvb"></div></div><div class="cvt" id="cvt" hidden></div></div>
          <div class="fx fx-handles"><div class="halo"></div><div class="core"></div></div>
          <div class="fxs"><svg viewBox="0 0 500 278" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path class="cb" d="${CHG_D}"/><path class="cf" d="${CHG_D}"/>
            <g class="pt" transform="translate(${CHG_PORT[0]} ${CHG_PORT[1]})"><circle class="pg" r="7"/><circle class="pr" r="5"/><circle class="pr r2" r="5"/></g></svg><img class="sweep" alt="" src=""></div>
            <div class="chgbox" id="chgbox" hidden></div><i class="chgline" id="chgline" hidden></i>
          </div>
          <div class="toast" id="toast" role="status" aria-live="polite"></div>
        </div>
        <div class="actions" id="actions"></div>
        <div class="stats" id="stats"></div>
        <div class="info" id="info"></div>
        <div class="diag" id="diag"></div>
        <div class="charge" id="charge" hidden></div>
        <button class="foot" id="foot" aria-label="Card settings"><span class="age" id="age"></span><span class="sets">${ico("sliders")}Settings</span></button>
        <div class="sheet" id="vsheet"><div class="box wide" id="vbox" role="dialog" aria-modal="true" aria-labelledby="vtitle">
          <h3 id="vtitle" class="sr">Vehicle</h3>
          <div class="vtop"><div class="seg" id="vtabs"><button data-vv="iso">${ico("carside")}<span class="tx">Car View</span></button><button data-vv="climate">${ico("fan")}<span class="tx">Climate</span></button><button data-vv="seats">${ico("seat")}<span class="tx">Seats</span></button></div><button class="x" data-vclose aria-label="Close">${ico("close")}</button></div>
          <div class="veh" id="veh"><div class="vstack">
            <div class="vgrp" id="vgi"><div class="vcol" id="viso"></div>
            <div class="vmiss" id="vmiss" hidden>${T("Vehicle images not found. Copy the {0} folder next to the card file (see Settings → Images).", "<b>images</b>")}</div>
            <div id="vextra"></div></div>
            <div class="vgrp" id="vgc"><div class="vcol" id="vclim">${this._climHtml()}</div></div>
            <div class="vgrp" id="vgs"><div class="vcol" id="vseats">${this._seatsHtml()}</div></div>
          </div></div>
        </div></div>
        <div class="sheet" id="sheet"><div class="box" id="box" role="dialog" aria-modal="true"></div></div>
      </ha-card>`;
    const sr = this.shadowRoot, g = (i) => sr.getElementById(i);
    this._dashKeys = {};
    /* touch: the click that follows pointerup "lands" on the just-opened window and closed it immediately; we swallow it */
    sr.addEventListener("click", (e) => { if (Date.now() < (this._noClickUntil || 0)) { e.stopPropagation(); e.preventDefault(); } }, true);
    sr.getElementById("toast").addEventListener("click", () => { clearTimeout(this._toastTimer); this._toastState = null; this._force(); });
    this._skyP = undefined;
    this._el = { card: sr.querySelector("ha-card"), hero: g("hero"), sky: g("sky"), cv: g("cv"), cvi: g("cvi"), cvt: g("cvt"), vtg: g("vtg"), cva: g("cva"), cvb: g("cvb"), sweep: sr.querySelector(".sweep"), imgs: [...sr.querySelectorAll(".stage img")], plate: g("plate"), age: g("age"),
      toast: g("toast"), nm: g("nm"), status: g("status"), tells: g("tells"), rfs: g("rfs"), nfbell: g("nfbell"), dgb: g("dgb"), total: g("total"), stats: g("stats"), veh: g("veh"), vtabs: g("vtabs"), vgi: g("vgi"), vgc: g("vgc"), vgs: g("vgs"), viso: g("viso"), vclim: g("vclim"), dov: g("dov"), vseats: g("vseats"), pk: g("pk"), pkp: g("pkp"), pkv: g("pkv"), pkr: g("pkr"), pktk: g("pktk"), vmiss: g("vmiss"), vextra: g("vextra"),
      vsheet: g("vsheet"), vtctl: g("vtctl"), dash: g("dash"), info: g("info"), diag: g("diag"), charge: g("charge"), chgbox: g("chgbox"), chgline: g("chgline"), actions: g("actions"), foot: g("foot"), sheet: g("sheet"), box: g("box") };
    this._el.hero.style.setProperty("--ds-scale", String(c.image_scale));
    this._applyAspect();
    this._el.imgs.forEach((img) => {
      this._imgChain(img, "k");
      img.addEventListener("load", () => {
        if (img.dataset.k === "off" && img.naturalWidth) { this._el.hero.dataset.auto = `${img.naturalWidth} / ${img.naturalHeight}`; this._applyAspect(); }
      });
    });
    this._el.dash.querySelectorAll(":scope > img").forEach((img) => {
      img.dataset.i = "0";
      this._imgChain(img, "key");
    });
    this._el.vsheet.addEventListener("click", (e) => { if (e.target === this._el.vsheet) { this._view = null; this._force(); } });
    this._el.veh.addEventListener("error", (e) => { if (e.target?.dataset?.l === "base") this._el.vmiss.hidden = false; }, true);
    this._el.veh.addEventListener("load", (e) => { if (e.target?.dataset?.l === "base") this._el.vmiss.hidden = true; }, true);
    this._el.vbox = g("vbox");
    this._el.vbox.addEventListener("click", (e) => { if (e.target.closest("[data-vclose]")) { this._view = null; this._force(); } });
    this._swipe(this._el.vbox, this._el.vsheet); this._swipe(this._el.box, this._el.sheet);
    this._noChain(this._el.vsheet); this._noChain(this._el.sheet);
    this._pkInit(); this._bindPress();
    this._el.rfs.addEventListener("click", () => this._onAction("refresh"));
    this._el.vtg.addEventListener("click", (e) => { e.stopPropagation(); this._toggleView(); });
    this._el.stats.addEventListener("click", (e) => {
      const tp = e.target.closest("[data-tp]"); if (tp) { if (!tp.disabled) this._tempStep(Number(tp.dataset.tp)); return; }
      const b = e.target.closest("[data-id]"); if (b) return this._onAction(b.dataset.id);
    });
    this._el.actions.addEventListener("click", (e) => {
      if (e.target.closest("[data-more]")) { this._moreOpen = !this._moreOpen; lsWrite(`deepal-s05-more:${this._c.prefix}`, this._moreOpen ? 1 : null); return this._force(); }
      const b = e.target.closest("[data-id]"); if (b) this._onAction(b.dataset.id);
    });
    this._el.vbox.addEventListener("click", (e) => {
      const t = e.target.closest("[data-vv],[data-spot],[data-t],[data-id],[data-tp]");
      if (!t) return;
      if (t.dataset.vv) { this._view = t.dataset.vv; return this._force(); }
      if (t.dataset.spot) return this._spot(t.dataset.spot);
      if (t.dataset.id) return this._onAction(t.dataset.id);
      if (t.dataset.tp) return this._tempStep(Number(t.dataset.tp));
    });
    this._el.nfbell.addEventListener("click", () => this._openNotifications());
    this._el.dgb.addEventListener("click", () => { this._diagSheet = true; this._force(); });
    this._el.tells.addEventListener("click", (e) => { if (e.target.closest("[data-diag-open]")) { this._diagSheet = true; this._force(); } });
    this._el.foot.addEventListener("click", () => { if (this._c.show_customize === false) return; this._stab = "layout"; this._customize = true; this._force(); });
    this._el.sheet.addEventListener("click", (e) => {
      if (e.target === this._el.sheet) return this._closeSheet();
      const lk = e.target.closest("[data-lk]");
      if (lk) return this._lockPick(lk.dataset.lk);
      const dg = e.target.closest("[data-dg-set],[data-dg-add],[data-dg-ignore],[data-dg-ok]");
      if (dg) return this._diagAct(dg.dataset);
      const t = e.target.closest("[data-sheet],[data-close]");
      if (!t) return;
      if (t.dataset.sheet === "yes") {
        const cf = this._confirm, a = this._actions().find((x) => x.id === cf?.id);
        this._closeSheet(); if (cf && cf.temp !== undefined) return this._applyTemp(cf.temp);
        if (a) this._run(a); return;
      }
      this._closeSheet();
    });
    this._setEl = null;
    this._built = true;
  }

  /* ───── render ───── */
  _fmtNum(n, d = 0) { return n.toLocaleString(I18N.numLocale(), { minimumFractionDigits: 0, maximumFractionDigits: d }); }
  _tire(t) {
    const key = `sensor.${t.id}_tire_pressure`, o = this._obj(key);
    const { v, stale } = this._nl(key);
    let bar = null;
    if (v !== null) {
      const u = (o?.attributes?.unit_of_measurement || "").toLowerCase();
      bar = u === "kpa" ? v / 100 : u === "psi" ? v * 0.0689476 : u === "bar" ? v : v > 50 ? v / 100 : v;
    }
    const alarm = this._is(`binary_sensor.${t.id}_tire_alarm`, "on");
    const c = this._c;
    let tone = "148,163,184", note = "";
    const chk = c.tire_check || "vehicle", own = chk === "limits" || chk === "both", veh = chk === "vehicle" || chk === "both";
    if (bar !== null) {
      tone = "var(--ds-ok)";
      if (own) { if (bar < c.tire_min) { tone = "var(--ds-warn)"; note = "low"; } else if (bar > c.tire_max) { tone = "var(--ds-warn)"; note = "high"; } }
      if (veh && this._is("binary_sensor.tire_pressure_warning", "on") && !TIRES.some((x) => this._is(`binary_sensor.${x.id}_tire_alarm`, "on"))) { tone = "var(--ds-warn)"; note = "check pressure"; } // general vehicle notification
    }
    if (alarm && veh) { tone = "var(--ds-bad)"; note = "alarm"; }
    const unit = c.tire_unit;
    const txt = bar === null ? "--" : unit === "kPa" ? `${Math.round(bar * 100)}` : unit === "psi" ? `${(bar / 0.0689476).toFixed(1)}` : bar.toFixed(2);
    return { txt: `${txt}${bar === null ? "" : " " + unit}`, tone, note, stale, alarm: alarm && veh, name: t.name, bar };
  }

  _render() {
    if (!this._hass || !this._c) return;
    this._syncLang();
    if (!I18N.ready) return;
    if (!this._built) this._build();
    this._resolvePending();
    const sig = this._signature();
    if (sig === this._sig) return;
    this._sig = sig;
    const el = this._el, c = this._c, v = this._vehicle();

    const secs = { hero: el.hero, actions: el.actions, status: el.status, stats: el.stats, info: el.info, diagnostics: el.diag, charge: el.charge, costs: el.costs };
    const hid = new Set(c.hidden);
    c.order.forEach((id, i) => { const s = secs[id]; if (!s) return; s.style.order = i; s.toggleAttribute("data-off", hid.has(id)); });
    el.foot.style.order = 99;
    el.foot.classList.toggle("nosets", c.show_customize === false);

    /* hero */
    el.hero.classList.toggle("unlocked", v.unlocked);
    const fx = ["flow_port", "flow", "port", "sweep", "none"].includes(c.charge_fx) ? c.charge_fx : "flow_port";
    el.hero.dataset.fx = v.charging && fx !== "none" ? fx.replace("_", " ") : "";
    el.hero.style.setProperty("--ds-scale", String(c.image_scale));
    this._applyTop();
    this._applyAspect();
    el.imgs.forEach((i) => i.classList.toggle("on", i.dataset.k === v.img));
    this._heroCv(v);
    if (/sweep/.test(el.hero.dataset.fx)) { const on = el.imgs.find((i) => i.classList.contains("on")); if (on && on.src && el.sweep.getAttribute("src") !== on.src) el.sweep.src = on.src; }
    el.plate.textContent = this._s("sensor.license_plate") || "";
    const hs = new Set(c.hero_show || []), sr = this.shadowRoot;
    sr.getElementById("nm").hidden = !hs.has("name"); el.plate.hidden = !hs.has("plate"); sr.getElementById("ttl").hidden = !hs.has("name") && !hs.has("plate");
    el.total.hidden = !hs.has("range"); el.age.hidden = !hs.has("updated");
    el.age.textContent = T("Updated {0}", this._age());
    el.age.classList.toggle("old", this._ageMin() > 180);
    this._scUpd();
    const dn = this._devName(); if (dn && el.nm.textContent !== dn) el.nm.textContent = dn; /* name from the integration (device), if you have not set your own */
    const ts = this._toastState;
    if (ts && el.toast._ts !== ts) {
      el.toast._ts = ts;
      const ti = ts.type === "ok" ? "check" : ts.type === "error" || ts.type === "warn" ? "alert" : "info";
      el.toast.style.setProperty("--td", `${ts.ms / 1000}s`);
      el.toast.innerHTML = `${ico(ti)}<span class="tm">${esc(ts.msg)}</span><i class="tp"></i>`;
    }
    el.toast.className = `toast pos-${c.toast_position === "top" ? "top" : "bottom"} ${ts && c.toasts !== false ? `show ${["ok", "error", "warn"].includes(ts.type) ? ts.type : "info"}` : ""}`;

    {
      const ra = this._actions().find((x) => x.id === "refresh"), f = this._flashes.refresh, pend = !!this._pending.refresh;
      const rs = pend ? "pending" : f ? f.type : "";
      const cloudOk = this._is("binary_sensor.cloud_connection", "on"), cs = hs.has("cloud") ? (cloudOk ? "ok" : "bad") : "";
      el.rfs.className = `rfs ${cs} ${rs}`; el.rfs.disabled = !!ra.disabled; el.rfs.hidden = !!ra.disabled;
      const rl = (cs ? `${T(cloudOk ? "Connected" : "Offline")} · ` : "") + T("Refresh data · {0}", this._age()); el.rfs.title = rl; el.rfs.setAttribute("aria-label", rl);
      el.rfs.innerHTML = ico(f && !pend ? (f.type === "success" ? "check" : "alert") : "refresh") + (pend ? RING : "");
    }
    this._paintNotificationLink();
    /* buttons */
    const off = this._offline();
    const lay = ["split", "grid", "scroll", "fit"].includes(c.button_layout) ? c.button_layout : "split";
    const lab = c.button_labels, showT = lab === "title" || lab === "both", showS = lab === "status" || lab === "both";
    const acts = this._actions();
    const cellOf = (id) => {
      const a = acts.find((x) => x.id === id);
      const f = this._flashes[a.id], pend = !!this._pending[a.id], state = pend ? "pending" : f ? f.type : "";
      const icon = f && !pend ? (f.type === "success" ? "check" : "alert") : a.icon;
      const tone = off ? "" : a.tone || "";
      const dot = !state && (tone === "warn" || tone === "bad") ? '<span class="dot"></span>' : "";
      const ring = pend ? '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><rect x="2.5" y="2.5" width="95" height="95" rx="47.5" pathLength="100"/></svg>' : "";
      const label = `${a.label}: ${off ? "" : a.sub || ""}`;
      const sub = off ? "" : pend ? "Waiting…" : f ? (f.type === "success" ? "Done" : "Failed") : cap(a.sub || "");
      return `<div class="cell ${tone}"><button class="act ${tone} ${a.on && !off ? "on" : ""} ${state}" data-id="${a.id}" ${a.disabled || off ? "disabled" : ""} title="${esc(label)}" aria-label="${esc(label)}">${ico(icon)}${dot}${ring}</button>${showT ? `<span class="cap t">${esc(a.label)}</span>` : ""}${showS && sub ? `<span class="cap s">${esc(sub)}</span>` : ""}</div>`;
    };
    const vis = c.buttons.filter((id) => !c.buttons_hidden.includes(id));
    if (this._moreOpen === undefined) this._moreOpen = !!lsRead(`deepal-s05-more:${c.prefix}`);
    if (lay === "split") {
      const np = Math.max(1, Math.min(5, Math.round(Number(c.button_primary)) || 4)), prim = vis.slice(0, np), more = vis.slice(np);
      const keep = c.buttons_more === "show", open = keep || this._moreOpen;
      const alert = !off && more.some((id) => { const t = (acts.find((x) => x.id === id) || {}).tone; return t === "warn" || t === "bad"; });
      el.actions.className = `actions split sz-${c.button_size} ${open ? "moreopen" : ""} ${off ? "offline" : ""}`;
      el.actions.style.setProperty("--np", String(prim.length));
      el.actions.innerHTML = `<div class="prow">${prim.map(cellOf).join("")}</div>` +
        (more.length ? `<div class="mwrap"><div class="mrow" id="mrow" ${open ? "" : "inert"}>${more.map(cellOf).join("")}</div></div>` +
          (keep ? "" : `<button class="morebtn" data-more aria-expanded="${open}" aria-controls="mrow" title="${esc(T("More"))}" aria-label="${esc(T("More"))}"><span>More</span>${ico("chevd")}${alert ? '<span class="mdot"></span>' : ""}</button>`) : "");
    } else {
      el.actions.className = `actions ${lay} sz-${c.button_size} ${off ? "offline" : ""}`;
      el.actions.style.removeProperty("--np");
      el.actions.innerHTML = vis.map(cellOf).join("");
    }

    /* status (over the image) */
    const st = this._status(v);
    el.status.style.cssText = `--st: ${st.rgb}`; el.status.dataset.ent = this._id("lock.doors");
    const ssm = c.status_sub === "off" || c.status_sub === "ticker" ? c.status_sub : "roll", sm = st.plain && ssm !== "off" ? this._statusMsgs(st, ssm) : [];
    let subH = st.sub ? `<div class="s">${esc(st.sub)}</div>` : "";
    if (sm.length === 1) subH = `<div class="s ${sm[0].w ? "w" : "ok"}">${esc(sm[0].t)}</div>`;
    else if (sm.length > 1) {
      const n = sm.length, D = n * 4, ph = (Date.now() % (D * 1000)) / 1000, dl = (i) => `-${((((ph - i * 4) % D) + D) % D).toFixed(2)}s`; /* 4 s per message; the phase starts from the clock so it does not "restart" when the card is rebuilt */
      subH = `<div class="s rl n${n} ${ssm}"><span class="cw">${sm.map((m, i) => `<b class="rf ${m.w ? "w" : "ok"}" style="animation-delay:${dl(i)}">${esc(m.t)}</b>`).join("")}</span>${ssm === "ticker" ? `<span class="rd">${sm.map((_, i) => `<i style="animation-delay:${dl(i)}"></i>`).join("")}</span>` : ""}</div>`;
    }
    el.status.innerHTML = `${ico(st.icon)}<div><div class="t">${esc(st.text)}</div>${subH}</div>`;

    /* range / temperature */
    const bat = v.battery, range = this._n("sensor.remaining_range"), fuel = this._n("sensor.fuel_range"), temp = this._n("sensor.inside_temperature");
    const fl = this._n("sensor.fuel_level");
    const fuelPct = fl !== null && this._unit("sensor.fuel_level") === "%" ? fl : fuel !== null ? (fuel / (Number(c.fuel_max)>0?Number(c.fuel_max):AUTO_FUEL_RANGE)) * 100 : null;
    const hex2rgb = UI.hex2rgb;
    const LC = { r: hex2rgb(c.lvl_red, "248,113,113"), o: hex2rgb(c.lvl_orange, "251,146,60"), y: hex2rgb(c.lvl_yellow, "250,204,21"), g: hex2rgb(c.lvl_green, "52,211,153") };
    const lvl = (p, t1, t2, t3, top = LC.g) => (p === null ? "148,163,184" : p < t1 ? LC.r : p < t2 ? LC.o : p < t3 ? LC.y : top);
    const evRgb = lvl(bat, Number(c.bat_t1), Number(c.bat_t2), Number(c.bat_t3));
    const fuRgb = lvl(fuelPct, Number(c.fuel_t1), Number(c.fuel_t2), Number(c.fuel_t3));
    el.card.dataset.ti = ["blue", "neutral", "custom"].includes(c.tile_icons) ? c.tile_icons : "accent"; el.card.dataset.pad = c.card_padding || "normal"; el.card.dataset.ppad = c.popup_padding || "normal";
    el.card.style.setProperty("--ds-tile-custom", hexc(c.tile_icon_color, DEFAULTS.tile_icon_color));
    el.card.style.setProperty("--ds-ev", evRgb); el.card.style.setProperty("--ds-fu", fuRgb);
    const num = (n) => (n === null ? "--" : Math.round(n));
    const fu = hasFuel(this._hass, c);
    const parts = [range, fu ? fuel : null].filter((x) => x !== null), total = parts.length ? parts.reduce((s, x) => s + x, 0) : null;
    el.total.dataset.ent = this._id("sensor.remaining_range");
    el.total.innerHTML = `<div class="w"><div class="big">${num(total)}<small>km</small></div><div class="cap">${fu ? "total range" : "range"}</div></div>`;
    const cl = (x) => (x === null ? 0 : Math.min(100, Math.max(0, x)));
    const climOn = this._climateIsOn(), tgt = (() => { const t = this._tgt(); const n = t ? parseFloat(t.state) : NaN; return Number.isFinite(n) ? n : null; })(), pendC = !!this._pending.climate, climOk = this._s("climate.cabin_climate") !== null;
    const tgtShown = this._tpend ?? tgt;
    const leftTxt = this._fmtLeft(this._s("sensor.remaining_charge_time_h_mm"));
    const chgSub = "";
    /* Circle: the percentage corresponds to the VISIBLE arc (from the bottom edge of the tile to the right edge), not the whole circle */
    const GD = 40, GS = 1.5, arc = (r) => { const rp = r * GS, a = (x) => (x * 180) / Math.PI; return [180 - a(Math.asin(Math.min(1, GD / rp))) - 4, 360 - a(Math.acos(Math.min(1, GD / rp))) + 4]; };
    const [o0, o1] = arc(44), [i0, i1] = arc(33), at = (a0, a1, p) => a0 + ((a1 - a0) * cl(p)) / 100, f1 = (x) => x.toFixed(1);
    const oEnd = at(o0, o1, bat);
    const flow = v.charging && bat !== null && bat < 99.5 ? `<circle class="fg" cx="50" cy="50" r="44" stroke-width="7" pathLength="360" stroke-dasharray="${f1(o1 - oEnd)} 360" stroke-dashoffset="-${f1(oEnd)}"/><circle class="fp" cx="50" cy="50" r="44" stroke-width="7" pathLength="360" stroke-dasharray="25 360" style="--fs:-${f1(oEnd)};--fe:-${f1(Math.max(oEnd, o1 - 25))}"/>` : "";
    const statsMarkup = `
      ${c.climate_ui === "circle" ? `<div class="t2 tempc" data-open="climate" data-ent="${esc(this._id("climate.cabin_climate"))}" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.inside_temperature") }))}" role="button" tabindex="0" aria-label="Climate">
        <div class="tt">Temperature</div>
        <div class="ts">Inside<br><b>${temp === null ? "--" : this._fmtNum(temp, 0) + "°C"}</b>${tgt === null || !climOn ? "" : `<br><span class="sub">target ${this._fmtNum(tgt, 1)}°</span>`}</div>
        <button class="knob ${climOn ? "on" : ""} ${pendC ? "pending" : ""}" data-id="climate" ${climOk && !off ? "" : "disabled"} aria-label="Climate on/off">${ico("power")}${pendC ? RING : ""}</button></div>` : `<div class="t2 temp ${climOn ? "on" : ""}" data-open="climate" data-ent="${esc(this._id("climate.cabin_climate"))}" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.inside_temperature") }))}" role="button" tabindex="0" aria-label="Climate">
        <div class="tt">Climate</div>
        <button class="tpw ${climOn ? "on" : ""} ${pendC ? "pending" : ""}" data-id="climate" ${climOk && !off ? "" : "disabled"} aria-label="Climate on/off">${ico("power")}${pendC ? RING : ""}</button>
        <div class="ct"><span class="cur">${temp === null ? "--" : this._fmtNum(temp, 0) + "°"}</span><span class="lbl">Inside</span></div>
        ${tgt === null ? "" : `<div class="cstep ${climOn ? "" : "idle"}"><button class="cs" data-tp="-1" ${off ? "disabled" : ""} aria-label="Lower temperature">${ico("minus")}</button><div class="cv"><small>target</small><b>${this._fmtNum(tgtShown, 1)}°</b></div><button class="cs" data-tp="1" ${off ? "disabled" : ""} aria-label="Raise temperature">${ico("plus")}</button></div>`}
      </div>`}
      <div class="t2 batt" data-ent="${esc(this._id("sensor.battery_level"))}"${c.energy_sheet !== false ? ` data-energy="1" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.battery_level") }))}"` : ""} role="button" tabindex="0">
        <div class="tt">${fu ? "Energy" : "Battery"}</div>
        ${v.charging ? `<div class="ts chg">${c.chg_roll !== false && leftTxt ? `<span class="cw" style="--d:0s"><b class="cf cf1">${T("Charging now")}</b><b class="cf cf2">${esc(T("{0} left", leftTxt))}</b></span>` : `<b>${T("Charging now")}</b>`}${chgSub ? `<br><span class="sub">${chgSub}</span>` : ""}</div>` : ""}
        <div class="lg"><span style="color:rgb(${evRgb})">${ico("bolt")}<b>${num(range)}</b><small>km</small></span>${fu ? `<span style="color:rgb(${fuRgb})">${ico("fuel")}<b>${num(fuel)}</b><small>km</small></span>` : ""}</div>
        <div class="gauge"><svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="tr" cx="50" cy="50" r="44" stroke-width="7" pathLength="360" stroke-dasharray="${f1(o1 - o0)} 360" stroke-dashoffset="-${f1(o0)}"/><circle class="ev" cx="50" cy="50" r="44" stroke-width="7" pathLength="360" stroke-dasharray="${f1(oEnd - o0)} 360" stroke-dashoffset="-${f1(o0)}"/>${flow}
          ${fu ? `<circle class="tr" cx="50" cy="50" r="33" stroke-width="7" pathLength="360" stroke-dasharray="${f1(i1 - i0)} 360" stroke-dashoffset="-${f1(i0)}"/><circle class="fu" cx="50" cy="50" r="33" stroke-width="7" pathLength="360" stroke-dasharray="${f1(at(i0, i1, fuelPct) - i0)} 360" stroke-dashoffset="-${f1(i0)}"/>` : ""}</svg>
          <div class="c"><span>${bat === null ? "--" : Math.round(bat)}<small>%</small></span>${fu ? `<span class="gf" style="color:rgb(${fuRgb})">${ico("fuel")}${fuelPct === null ? "--" : Math.round(cl(fuelPct))}<small>%</small></span>` : ""}</div></div></div>`;

    if(el.stats._markup !== statsMarkup){
      // Keep a running charging effect when text or percentages change.
      const phases=new Map();
      for(const animation of el.stats.getAnimations({subtree:true})){
        if(animation.animationName){const times=phases.get(animation.animationName)||[];times.push(animation.currentTime);phases.set(animation.animationName,times);}
      }
      el.stats.innerHTML=statsMarkup;el.stats._markup=statsMarkup;
      for(const animation of el.stats.getAnimations({subtree:true})){
        const times=phases.get(animation.animationName);if(times?.length){const time=times.shift();if(time!==null)animation.currentTime=time;}
      }
    }
    this._renderVehicle(v);
    this._watchChanges(v);

    /* information */
    const tiles = [];
    for (const id of c.info_order.filter(id=>(c.info||[]).includes(id))) {
      const it = INFO_ITEMS[id]; if (!it) continue;
      if (id === "fuel_level" && !hasFuel(this._hass, c)) continue;
      const { v: n, stale } = it[3] === null ? { v: null } : this._nl(it[0]);
      const s = this._s(it[0]);
      if (s === null && n === null) continue;
      const val = it[3] === null ? (s === null ? "--" : stateText(s)) : n === null ? "--" : `${this._fmtNum(n, it[3])} ${this._unit(it[0])}`.trim();
      tiles.push(`<div class="tile" data-ent="${esc(this._id(it[0]))}">${ico(it[2])}<div><div class="v">${esc(val)}</div><div class="l">${esc(it[1])}</div></div></div>`);
    }
    for (const x of c.info_custom || []) {
      const o = this._eobj(x.entity), n = o ? parseFloat(o.state) : NaN;
      const val = !o || BAD.includes(o.state) ? "--" : Number.isFinite(n) ? `${this._fmtNum(n, 1)} ${o.attributes?.unit_of_measurement || x.unit || ""}`.trim() : stateText(o.state);
      tiles.push(`<div class="tile" data-ent="${esc(x.entity)}"${x.tap_action ? ` data-tap="${esc(JSON.stringify(x.tap_action))}"` : ""}${x.hold_action ? ` data-hold="${esc(JSON.stringify(x.hold_action))}"` : ""}>${ico(x.icon || "info")}<div><div class="v">${esc(val)}</div><div class="l">${esc(x.label || o?.attributes?.friendly_name || x.entity)}</div></div></div>`);
    }
    /* diagnostics: indicator icons over the image, only when there is something to see */
    const hidSec = new Set(c.hidden), items = hidSec.has("diagnostics") ? [] : this._diagItems(), all = c.diag_mode === "all";
    const rank = { bad: 0, warn: 1, na: 2, ok: 3 }, dvis = items.filter((x) => all || x.on), grp = new Map();
    for (const d of dvis) { const k = `${d.icon}|${d.st}`, g = grp.get(k); if (g) { g.n++; g.label += `, ${d.label}`; } else grp.set(k, { ...d, n: 1 }); }
    const shown = [...grp.values()].sort((a, b) => rank[a.st] - rank[b.st]), hw = el.hero ? el.hero.clientWidth : 0, MAXT = !hw ? 4 : hw < 330 ? 2 : hw < 400 ? 3 : 4, top = shown.slice(0, MAXT), rest = dvis.length - top.reduce((t, g) => t + g.n, 0);
    el.tells.innerHTML = top.map((d) => `<button class="tell ${d.st}" ${d.n > 1 ? "data-diag-open" : `data-ent="${esc(d.ent)}"`} title="${esc(d.label)}" aria-label="${esc(d.label)}">${icoBadge(d.icon)}${d.n > 1 ? `<b class="n">${d.n}</b>` : ""}</button>`).join("")
      + (rest > 0 ? `<button class="tell more" data-diag-open title="${esc(T("All indicators"))}" aria-label="${esc(T("All indicators"))}">+${rest}</button>` : "");
    /* Diagnostics button at the top right (with a warning count); when active, the indicators are not drawn again in the image corner */
    const nAl = items.filter((d) => d.on).length, dgOn = items.length > 0 && !(c.top_buttons_hidden || []).includes("diag"), dgKey = dgOn ? String(nAl) : "-";
    el.dgb.hidden = !dgOn;
    if (dgOn && this._dgDrawn !== dgKey) {
      this._dgDrawn = dgKey;
      el.dgb.innerHTML = ico("pulse") + (nAl ? `<i class="bdg">${nAl > 99 ? "99+" : nAl}</i>` : "");
      const l = T("Diagnostics") + (nAl ? ` · ${T(nAl === 1 ? "{0} warning" : "{0} warnings", nAl)}` : ""); el.dgb.title = l; el.dgb.setAttribute("aria-label", l);
      el.dgb.classList.toggle("warnb", nAl > 0);
    }
    if (dgOn) el.tells.innerHTML = "";
    el.tells.toggleAttribute("hidden", dgOn || !shown.length);
    el.info.innerHTML = tiles.join("");
    el.info.toggleAttribute("data-off", !tiles.length || hidSec.has("info"));
    el.diag.innerHTML=dvis.map(d=>{const state={ok:"OK",bad:"Warning",warn:"Warning",na:"Unavailable"}[d.st],label=T(d.label)+" · "+T(state);return `<button class="diag-item ${d.st}" data-ent="${esc(d.ent)}" title="${esc(label)}" aria-label="${esc(label)}">${icoBadge(d.icon)}</button>`;}).join("");
    el.diag.toggleAttribute("data-empty-diag", !dvis.length);

    /* charging */
    const showCharge = v.charging || v.plugged, cst = ["text", "line", "big", "beside"].includes(c.charge_style) ? c.charge_style : "line";
    el.chgbox.className = "chgbox " + cst; el.chgline.className = "chgline s-" + cst;
    el.charge.hidden = !showCharge || hidSec.has("charge");
    el.chgbox.hidden = el.chgline.hidden = !showCharge;
    if (showCharge) {
      const left = this._s("sensor.remaining_charge_time_h_mm"), type = this._s("sensor.charging_type");
      const curRaw = this._chargeCurrent(), pre = (curRaw.match(/^(AC|DC)\s/) || [])[1] || "";
      const cur = curRaw ? curRaw.replace(/^(AC|DC)\s+/, "") : "", rem = left && v.charging ? this._fmtLeft(left) : "", typ = type || pre || "";
      const known = [cur, rem, typ].filter(Boolean);
      el.charge.innerHTML = `<div><div class="l">${esc(T(v.charging?"Charging now":"Charger connected"))}</div><div class="v">${esc(typ||T("Connected"))}</div></div><div><div class="l">${esc(T("Current"))}</div><div class="v">${esc(cur||"—")}</div></div><div><div class="l">${esc(T("Remaining"))}</div><div class="v">${esc(rem||"—")}</div></div>`;
      el.chgbox.hidden = el.chgline.hidden = !known.length; /* if there is no item we show nothing (not "--") */
      if (cst === "line") el.chgbox.innerHTML = ico("bolt") + known.map((x) => `<span>${esc(x)}</span>`).join("<i>·</i>");
      else if (cst === "big") { const m = cur && /^(.*?)\s*([A-Za-z]+)$/.exec(cur); el.chgbox.innerHTML = (cur ? `<span class="a">${esc(m ? m[1] : cur)}${m ? `<small>${esc(m[2])}</small>` : ""}</span>` : "") + `<span class="b">${esc([typ, rem].filter(Boolean).join(" · "))}${rem ? ` <em>Remaining</em>` : ""}</span>`; }
      else el.chgbox.innerHTML = (cur ? `<span class="a">${esc(cur)}</span>` : "") + (rem ? `<span class="b">${esc(rem)} <em>Remaining</em></span>` : "") + (typ ? `<span class="c">${esc(typ)}</span>` : "");
    }

    /* sheets */
    if (this._confirm) {
      const [title, text] = CONFIRM_TEXT[this._confirm.key] || ["Continue?", ""];
      el.box.className = "box confirm";
      el.box.innerHTML = `<h3>${esc(title)}</h3><p class="c">${esc(text)}</p><div class="btnrow"><button class="btn ic" data-close>${ico("close")}Cancel</button><button class="btn go ic" data-sheet="yes">${ico(CONF_ICO[this._confirm.key] || "check")}Confirm</button></div>`;
      this._setEl = null;
      el.sheet.classList.add("show");
    } else if (this._diagSheet && !this._customize) {
      el.box.className = "box wide dg";
      el.box.innerHTML = this._diagHtml();
      this._setEl = null;
      el.sheet.classList.add("show");
    } else if (this._lockSheet && !this._customize) {
      el.box.className = "box confirm lk";
      el.box.innerHTML = this._lockHtml();
      this._setEl = null;
      el.sheet.classList.add("show");
    } else if (this._enSheet && !this._customize) {
      /* Energy sheet: the code is in energy/energy.js and loads only when it opens */
      this._setEl = null;
      if (!this._enEl || !el.box.contains(this._enEl)) {
        el.box.className = "box wide nfp";
        el.box.innerHTML = sheetHd("bolt", "Ενέργεια");
        const d = document.createElement("div"); d.className = "enpanel"; d.innerHTML = loaderHtml("bolt");
        el.box.appendChild(d); this._enEl = d;
        loadEnergy().then((ok) => { if (this._enEl !== d) return; if (ok && window.__DEEPAL_S05_ENERGY.panel) window.__DEEPAL_S05_ENERGY.panel(d, this); else d.innerHTML = `<p class="hint">${esc(T("The energy file didn't load. Check that the energy folder sits next to the card file."))}</p>`; });
      }
      el.sheet.classList.add("show");
    } else if (this._customize) {
      if (!this._setEl || !el.box.contains(this._setEl)) {
        el.box.className = "box";
        el.box.innerHTML = sheetHd("sliders", "Ρυθμίσεις κάρτας", CARD_CREDIT);
        const s = document.createElement(SETTINGS_TAG);
        s.mode = "card";
        s.tab = this._stab;
        s.onTab = (t) => { this._stab = t; this._uiSave(); };
        s.onPatch = (p) => this._patch(p);
        s.onReset = () => this._resetLocal();
        el.box.appendChild(s);
        this._setEl = s;
        if (this._restoreSc) { const y = this._restoreSc; this._restoreSc = 0; requestAnimationFrame(() => { el.box.scrollTop = y; }); }
      }
      this._setEl.hass = this._hass;
      this._setEl.cfg = this._c;
      this._setEl.yamlBase = this._yaml;
      el.sheet.classList.add("show");
    } else {
      this._setEl = null;
      el.sheet.classList.remove("show");
    }
    el.box.setAttribute("aria-label", this._confirm ? (CONFIRM_TEXT[this._confirm.key] || ["Confirm"])[0] : this._diagSheet && !this._customize ? "Diagnostics" : this._lockSheet && !this._customize ? "Doors" : this._enSheet && !this._customize ? "Energy" : "Card settings");
    this._focusSync();
  }

  /* ───── tap / long press on sensors ───── */
  _bindPress() {
    const root = this._el.card; let st = null;
    root.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest("[data-id],[data-tp],[data-more]")) return;
      const t = e.target.closest("[data-ent],[data-open]"); if (!t) return;
      st = { t, x: e.clientX, y: e.clientY, held: false };
      st.timer = setTimeout(() => { if (st) { st.held = true; try { navigator.vibrate && navigator.vibrate(15); } catch (_) {} this._hold(st.t); } }, 520);
    });
    root.addEventListener("pointermove", (e) => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) { clearTimeout(st.timer); st.moved = true; } });
    const end = (cancel) => { if (!st) return; clearTimeout(st.timer); const s = st; st = null; if (!cancel && !s.held && !s.moved) this._tap(s.t); };
    root.addEventListener("pointerup", () => end(false));
    root.addEventListener("pointercancel", () => end(true));
    root.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-ent]")) e.preventDefault(); });
  }
  /* mobile: the popup closes by dragging down from its top (handle) */
  /* while a window is open, dragging does not "pass through" to the HA page behind it: only what scrolls inside the window scrolls, and at its ends it does not pass further */
  _noChain(sheet) {
    let y0 = 0, x0 = 0, axis = null;
    sheet.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; axis = null; }, { passive: true });
    sheet.addEventListener("touchmove", (e) => {
      if (!e.cancelable) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      /* the direction locks once, after the first ~8px; small accidental movements at the start do not cut the horizontal drag (tab bar) */
      if (!axis) { if (Math.hypot(dx, dy) < 8) return; axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      const horiz = axis === "x";
      for (const n of e.composedPath()) {
        if (n === sheet) break;
        if (!(n instanceof Element)) continue; /* the Settings shadowRoot: we continue to the host, which is what scrolls */
        if (horiz) { const ox = getComputedStyle(n).overflowX; if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 1) return; } /* horizontal scroll (temperature selector) */
        const oy = getComputedStyle(n).overflowY;
        if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) {
          const top = n.scrollTop <= 0, bot = n.scrollTop + n.clientHeight >= n.scrollHeight - 1;
          if (!((top && dy > 0) || (bot && dy < 0))) return;
          break;
        }
      }
      e.preventDefault();
    }, { passive: false });
  }
  _swipe(box, sheet) {
    let st = null;
    const mobile = () => window.matchMedia && window.matchMedia("(max-width: 639px)").matches;
    box.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || !mobile() || e.target.closest("button,input,select,textarea,a")) return;
      const r = box.getBoundingClientRect(); if (e.clientY - r.top > 84) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, dy: 0, t: Date.now(), lock: false };
    });
    box.addEventListener("pointermove", (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.lock) { /* we lock the direction: a horizontal drag (tab bar) or upward drag does not drag the window */
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (Math.hypot(dx, dy) < 8) return;
        if (!(dy > 0 && dy > Math.abs(dx))) { st = null; return; }
        st.lock = true; st.y = e.clientY; try { box.setPointerCapture(e.pointerId); } catch (_) {} box.style.transition = "none";
      }
      st.dy = Math.max(0, e.clientY - st.y); box.style.transform = `translateY(${st.dy}px)`; sheet.style.background = `rgba(0,0,0,${Math.max(0.1, 0.62 - st.dy / 700)})`;
    });
    const end = (cancel) => {
      if (!st) return; const s = st; st = null; if (!s.lock) return;
      box.style.transition = "transform .22s ease"; sheet.style.background = "";
      const fast = s.dy / Math.max(1, Date.now() - s.t) > 0.6;
      if (!cancel && (s.dy > 90 || (fast && s.dy > 30))) { box.style.transform = "translateY(100%)"; setTimeout(() => { box.style.transition = ""; box.style.transform = ""; this._closeTop(); }, 200); }
      else { box.style.transform = ""; setTimeout(() => { box.style.transition = ""; }, 240); }
    };
    box.addEventListener("pointerup", () => end(false)); box.addEventListener("pointercancel", () => end(true));
  }
  _cfgOf(t, k) { try { return t.dataset[k] ? JSON.parse(t.dataset[k]) : null; } catch (_) { return null; } }
  _battKwh() { const o = Number(this._c.battery_kwh); return o > 0 ? o : autoKwh(this._hass, this._c); }
  _tap(t) {
    if (t.id === "status" && !t.dataset.tap && this._s("lock.doors") !== null) { this._noClickUntil = Date.now() + 500; this._lockSheet = true; return this._force(); }
    if (t.dataset.energy && !t.dataset.tap) { this._noClickUntil = Date.now() + 500; this._enSheet = true; return this._force(); }
    if (t.dataset.open && !t.dataset.tap) { this._noClickUntil = Date.now() + 500; this._view = t.dataset.open; return this._force(); }
    this._act(this._cfgOf(t, "tap") || { action: "more-info" }, t.dataset.ent);
  }
  _hold(t) {
    const a = this._cfgOf(t, "hold");
    if (a) return this._act(a, t.dataset.ent);
    this._tap(t);
  }
  _act(cfg, ent) {
    const a = cfg.action || "more-info", id = cfg.entity || ent;
    if (a === "more-info") { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } })); return; }
    if (a === "toggle") return this._hass.callService("homeassistant", "toggle", { entity_id: id }).catch((err) => this._failToast(err));
    if (a === "call-service" || a === "perform-action") {
      const [dom, svc] = String(cfg.service || cfg.perform_action || "").split(".");
      if (!dom || !svc) return this._toast("Invalid service in action", "error");
      return this._hass.callService(dom, svc, { ...(cfg.data || cfg.service_data || {}), ...(cfg.target || {}) })
        .then(() => this._toast("Action sent", "ok")).catch((err) => this._toast(err?.message || "The action failed", "error"));
    }
    if (a === "navigate" && /^\/(?!\/)/.test(String(cfg.navigation_path || ""))) { history.pushState(null, "", cfg.navigation_path); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); return; }
    if (a === "url" && /^(https?:\/\/|\/(?!\/))/i.test(String(cfg.url_path || ""))) window.open(cfg.url_path, "_blank", "noopener,noreferrer"); // safety: no javascript:/data:
  }

  /* ───── number picker (adapted from deepal-number-picker) ───── */
  /* if an image breaks, try the next source in the chain (_heroSrc), otherwise hide it */
  _imgChain(img, keyAttr) {
    img.addEventListener("error", () => {
      const n = Number(img.dataset.i) + 1, next = this._heroSrc(img.dataset[keyAttr], n);
      if (next) { img.dataset.i = String(n); img.src = next; } else img.style.visibility = "hidden";
    });
  }
  _pkInit() {
    const p = this._el.pkp, IW = 92, r = this._el.pkr;
    const user = () => { this._pkUser = true; clearTimeout(this._pkUT); this._pkUT = setTimeout(() => { this._pkUser = false; }, 2500); };
    r.addEventListener("input", () => {
      if (!this._pk) return;
      const i = Number(r.value); user(); this._pkIdx = i; this._pkPaint(i);
      clearTimeout(this._pkT); this._pkT = setTimeout(() => this._pkSettle(i), 350);
    });
    const idx = () => (this._pk ? Math.max(0, Math.min(this._pk.vals.length - 1, Math.round(p.scrollLeft / IW))) : 0);
    p.addEventListener("scroll", () => {
      if (!this._pk) return;
      this._pkWheel();
      const i = idx();
      if (i !== this._pkIdx) { this._pkIdx = i; this._pkPaint(i); }
      if (this._pkProg) return;
      clearTimeout(this._pkT);
      this._pkT = setTimeout(() => this._pkSettle(i), 220);
    }, { passive: true });
    ["pointerdown", "touchstart", "wheel"].forEach((ev) => p.addEventListener(ev, user, { passive: true }));
    p.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); p.scrollBy({ left: Math.sign(e.deltaY) * IW, behavior: "smooth" }); } }, { passive: false });
    UI.drag(p, { th: 4, start: (e) => { p.style.scrollSnapType = "none"; p.setPointerCapture(e.pointerId); }, end: () => { p.style.scrollSnapType = ""; p.scrollTo({ left: idx() * IW, behavior: "smooth" }); } });
    p.addEventListener("click", (e) => {
      const n = e.target.closest(".pn"); if (!n) return;
      user(); this._pkProg = false; p.scrollTo({ left: Number(n.dataset.i) * IW, behavior: "smooth" });
    });
  }
  _pkWheel() {
    if (this._pkRaf || !this._pkItems) return;
    this._pkRaf = requestAnimationFrame(() => {
      this._pkRaf = 0;
      const p = this._el.pkp, x = p.scrollLeft / 92;
      this._pkItems.forEach((n0, k) => {
        const n = n0.firstChild, f = k - x, a = Math.abs(f); if (a > 3.2) { n.style.transform = "none"; n.style.opacity = "0"; return; } /* the transform goes on the inner span: the snap points (.pn) stay still */
        n.style.transform = `perspective(260px) rotateY(${(-f * 36).toFixed(1)}deg) scale(${Math.max(0.62, 1 - a * 0.14).toFixed(3)})`;
        n.style.opacity = String(Math.max(0, 1 - Math.max(0, a - 1.2) * 0.5).toFixed(2));
      });
    });
  }
  _pkSetup(o) {
    const a = o.attributes || {}, min = Number(a.min ?? 16), max = Number(a.max ?? 32), step = Number(a.step || 0.5), key = `${min}|${max}|${step}`;
    if (this._pkKey === key) return;
    const dec = (String(step).split(".")[1] || "").length, vals = [];
    for (let x = min; x <= max + step / 100; x += step) vals.push(Number(x.toFixed(dec)));
    this._pk = { vals, dec }; this._pkKey = key; this._pkIdx = -1;
    this._el.pkp.innerHTML = vals.map((x, i) => `<div class="pn" data-i="${i}"><span>${x.toFixed(dec)}</span></div>`).join("");
    this._pkItems = [...this._el.pkp.children]; this._pkWheel();
    this._el.pkr.max = String(vals.length - 1);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((q) => vals[Math.round(q * (vals.length - 1))]);
    this._el.pktk.innerHTML = ticks.map((x) => `<span>${Math.round(x)}°</span>`).join("");
  }
  _pkPaint(i) {
    const { vals, dec } = this._pk;
    this._pkItems.forEach((n, k) => { n.classList.toggle("act2", k === i); n.classList.toggle("near", Math.abs(k - i) === 1); });
    this._airTone(vals[i]);
    this._el.pkv.textContent = vals[i].toFixed(dec); this._el.pkr.value = String(i);
    this._el.pkr.style.setProperty("--pf", `${(i / Math.max(1, vals.length - 1)) * 100}%`);
    this._el.pk.classList.toggle("cold", vals[i] <= 20); this._el.pk.classList.toggle("hot", vals[i] >= 26);
  }
  _pkScroll(i, smooth) {
    this._pkProg = true; this._el.pkp.scrollTo({ left: i * 92, behavior: smooth ? "smooth" : "auto" });
    clearTimeout(this._pkPT); this._pkPT = setTimeout(() => { this._pkProg = false; }, smooth ? 450 : 150);
  }
  _pkSettle(i) {
    this._pkUser = false;
    const o = this._tgt(); if (!o || !this._pk) return;
    const v = this._pk.vals[i], cur = parseFloat(o.state);
    if (Number.isFinite(cur) && Math.abs(cur - v) < 0.001) return;
    if (this._needTempConfirm()) { this._tpend = v; return this._askTemp(v); }
    return this._applyTemp(v);
  }

  /* state of the heating/ventilation buttons (and of the layers when we show the seats) */
  _seatSync(root, layers) {
    for (const [id, key, , , , , layer] of INT_SPOTS) {
      const lv = this._level(key), max = this._obj(key)?.attributes?.max ?? 3;
      if (layers) { const L = root.querySelector(`img[data-l="${layer}"]`); if (L) { L.classList.toggle("on", lv > 0); L.style.opacity = lv > 0 ? String(key.startsWith("switch.") ? 1 : 0.4 + 0.6 * (lv / max)) : ""; } }
      for (const b of root.querySelectorAll(`[data-spot="${id}"]`)) {
        b.classList.toggle("lv", lv > 0);
        const bars = b.querySelectorAll(".lvl i"); bars.forEach((i, k) => i.classList.toggle("f", k < lv));
        const lvl = b.querySelector(".lvl"); if (lvl) lvl.hidden = key.startsWith("switch.");
        b.setAttribute("aria-pressed", String(lv > 0));
      }
    }
  }
  _renderVehicle(v) {
    const el = this._el, c = this._c, view = this._view === "seats" || this._view === "climate" ? this._view : "iso";
    el.vsheet.classList.toggle("show", this._vsheetOpen());
    this.shadowRoot.getElementById("vtitle").textContent = view === "iso" ? "Car View" : view === "climate" ? "Climate" : "Seats & steering wheel";
    if (!this._vsheetOpen()) { this._pkIdx = -1; this._lastV = undefined; return; }
    el.vtabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.vv === view));
    el.vgi.classList.toggle("off", view !== "iso"); el.vgc.classList.toggle("off", view !== "climate"); el.vgs.classList.toggle("off", view !== "seats");
    /* transition effect: only the tab selection slides; the content changes plainly (soft fade) */
    {
      const pane = view === "iso" ? el.vgi : view === "climate" ? el.vgc : el.vgs;
      UI.pill(el.vtabs);
      if (this._lastV !== undefined && this._lastV !== view) {
        pane.classList.remove("slide"); void pane.offsetWidth; pane.classList.add("slide");
      }
      this._lastV = view;
    }
    if (view !== "climate") this._pkIdx = -1;
    if (view === "iso") {
      this._isoRender(v);
    } else if (view === "seats") {
      this._seatSync(el.vseats, true);
    } else {
      this._seatSync(el.vclim, false);
      const on = this._climateIsOn(), steer = this._level("switch.steering_wheel_heating") > 0;
      const im = el.dash.querySelector("img"), k = steer ? "dash_off_steer" : "dash_off";
      if (im.dataset.key !== k) { im.dataset.key = k; im.dataset.i = "0"; im.style.visibility = ""; im.src = this._heroSrc(k, 0); }
      el.dash.classList.toggle("air", on);
      const fan = parseFloat(this._s("sensor.climate_fan_level"));
      this._airTone(this._tpend ?? parseFloat((this._tgt() || {}).state));
      el.dash.querySelector(".air").style.setProperty("--sp", String(Number.isFinite(fan) ? Math.min(1.9, Math.max(0.7, 0.65 + fan * 0.16)) : 1));
      const inside = this._n("sensor.inside_temperature"), fanTxt = this._s("sensor.climate_fan_level"), pend = !!this._pending.climate;
      el.dov.innerHTML = `<div class="dscr"><div class="dbig">${inside === null ? "--" : this._fmtNum(inside, 1)}<small>°C</small></div>
        <div class="dst ${on ? "on" : ""}"><i></i>${esc(T(on ? "On" : "Off"))}</div></div>
        <button class="act dpw ${on ? "on" : ""} ${pend ? "pending" : ""}" data-id="climate" aria-label="Climate on/off">${ico("power")}${pend ? RING : ""}</button>`;
      el.vtctl.innerHTML = "";
      const no = this._tgt();
      el.pk.hidden = !no;
      if (no) {
        this._pkSetup(no);
        const val = this._tpend ?? parseFloat(no.state);
        if (Number.isFinite(val) && !this._pkUser && this._pk) {
          let best = 0, bd = Infinity; this._pk.vals.forEach((x, i) => { const d = Math.abs(x - val); if (d < bd) { bd = d; best = i; } });
          if (best !== this._pkIdx) { this._pkIdx = best; this._pkPaint(best); this._pkScroll(best, false); }
        }
      }
    }
  }
}

/* ───────────────────────── Settings (UI) ─────────────────────────
 * One shared element used both inside the card (saved on the device)
 * and in the Home Assistant editor (saved in the card YAML). */
const ALL_FILES = { ...HERO_FILES, ...DASH_FILES };
const heroBases = (c) => (c.image_path ? [normPath(c.image_path)] : [`${SCRIPT_BASE}images/car/`]);

/* "Energy" sheet: a separate file (energy/energy.js), loads only when the battery tile is tapped */
let _enP = null;
function loadEnergy() {
  if (_enP) return _enP;
  const Eg = () => window.__DEEPAL_S05_ENERGY;
  return (_enP = new Promise((res) => {
    const ok = () => { const E = Eg(); if (E && E.init) { E.init({ T, ico, esc, haFmt, loaderHtml, resolveId, I18N }); I18N.addExtra(E.lang); res(true); } else bad(); };
    const bad = () => { _enP = null; res(false); };
    if (Eg() && Eg().init) return ok();
    const sc = document.createElement("script");
    sc.src = `${SCRIPT_BASE}energy/energy.js?v=${CARD_VERSION}`; sc.async = true; sc.onload = ok; sc.onerror = bad;
    document.head.appendChild(sc);
  }));
}

class DeepalS05Settings extends HTMLElement {
  connectedCallback() { I18N.watch(this.shadowRoot); }
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); I18N.watch(this.shadowRoot);
    this.mode = "card"; this.tab = "layout"; this._form = { entity: "", label: "", icon: "info", mkey: "", ment: "", mdi: "" }; this._disc = null;
    this._sig = null; this._note = "";
  }
  set hass(h) { this._hass = h; }
  set cfg(c) {
    const s = JSON.stringify(c);
    if (s === this._sig) return;
    this._sig = s; this._cfg = c; this._render();
  }
  get cfg() { return this._cfg; }
  _emit(p) { this.onPatch && this.onPatch(p); }
  _setTab(t) { this._tabRequest=(this._tabRequest||0)+1;this._tabLoading=false;this.tab=t;this.onTab&&this.onTab(t);this._render(); }
  async _navigateTab(t){
    if(t===this.tab&&!this._tabLoading)return;
    const request=this._tabRequest=(this._tabRequest||0)+1;this._tabLoading=true;this.tab=t;this.onTab&&this.onTab(t);this._render();
    await new Promise(resolve=>setTimeout(resolve,1000));
    if(request!==this._tabRequest||!this.isConnected)return;this._tabLoading=false;this._render();
  }
  _renderTabLoading(){
    this.shadowRoot.innerHTML='<style>'+SETTINGS_CSS+LOADER_CSS+'</style><div class="wrap">'+this._tabs()+'<div class="settings-loading" role="status" aria-live="polite">'+loaderHtml('sliders')+'</div></div>';
    this._bind();this._wireTabs();
  }

  _tabs() {
    const T = [["layout", "Layout", "eye"], ["look", "Appearance", "sliders"], ["controls", "Controls", "power"], ["charge", "Charging", "bolt"], ["colours", "Colours", "sliders"], ["sensors", "Diagnostics & tyres", "gauge"], ["vehicle", "Advanced", "carside"]];
    return `<div class="tabbar"><button class="tn l" data-tn="-1" aria-label="Previous tabs" hidden>${ico("chevr")}</button><div class="tabs">${T.map(([k, l, i]) => `<button data-tab="${k}" class="${this.tab === k ? "on" : ""}">${ico(i)}<span>${l}</span></button>`).join("")}</div><button class="tn r" data-tn="1" aria-label="Next tabs" hidden>${ico("chevr")}</button></div>`;
  }
  _sortKey(kind) { return {sec:'order',top:'top_buttons',info:'info_order',info_custom:'info_custom',diag_custom:'diag_custom'}[kind]||'buttons'; }
  _orderList(all, order, hidden, labelOf, kind) {
    return `<div class="list">${order.map((id, i) => {
      const off = hidden.includes(id);
      return `<div class="row ${off ? "off" : ""}" data-dk="${kind}"><i class="grip" aria-hidden="true" title="${T("Drag to reorder")}"></i><span>${esc(labelOf(id))}</span>
        <button class="mv" data-mv="${kind}|${id}|-1" ${i === 0 ? "disabled" : ""} aria-label="Up">${ico("up")}</button>
        <button class="mv" data-mv="${kind}|${id}|1" ${i === order.length - 1 ? "disabled" : ""} aria-label="Down">${ico("down")}</button>
        <button class="swb" data-vis="${kind}|${id}" aria-label="Show"><i class="sw ${off ? "" : "on"}"></i></button></div>`;
    }).join("")}</div>`;
  }
  _sel(name, val, opts) { return `<select data-set="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`; }
  _num(name, val, step = "0.1") { const fallback=DEFAULTS[name],hint=name==='fuel_max'?940:name==='fuel_tank_liters'?51:fallback??0;return `<input type="number" step="${step}" data-set="${name}" data-num data-default="${esc(fallback??0)}" placeholder="${esc(hint)}" value="${val===fallback?"":esc(val)}">`; }
  _datalist() {
    const ids = Object.keys(this._hass?.states || {}).sort();
    return `<datalist id="ents">${ids.map((i) => `<option value="${esc(i)}" label="${esc(this._hass?.states?.[i]?.attributes?.friendly_name||i)}"></option>`).join("")}</datalist>`;
  }
  _iconPick() {
    return `<div class="icons">${PICKABLE_ICONS.map((n) => `<button data-icon="${n}" class="${this._form.icon === n ? "on" : ""}" aria-label="${n}">${ico(n)}</button>`).join("")}</div>`;
  }
  _addForm(kind) {
    return `<div class="add"><label class="field">Entity<input type="text" list="ents" data-f="entity" placeholder="e.g. sensor.my_value" value="${esc(this._form.entity)}"></label>
      <label class="field">Label (optional)<input type="text" data-f="label" value="${esc(this._form.label)}"></label>
      <div class="field">Icon${this._iconPick()}</div>
      <label class="field">Or a Home Assistant icon (optional)<input type="text" data-f="mdi" placeholder="e.g. mdi:car-brake-abs" value="${esc(this._form.mdi)}"></label>
      <button class="btn sm" data-add="${kind}">${ico("plus")} Add</button></div>`;
  }
  _discHtml(c) {
    const ign = (c.diag_ignore || []).length, list = this._disc;
    const rows = list ? (list.length ? `<div class="list">${list.map((f) => `<div class="row">${icoBadge(f.icon)}<span>${esc(f.label)}<small>${esc(f.entity)}</small></span><button class="btn sm" data-dadd="${esc(f.entity)}">${ico("plus")} ${esc(T("Add"))}</button></div>`).join("")}</div>
      ${list.length > 1 ? `<div class="btnrow"><button class="btn sm pl" data-daddall>${ico("plus")} ${esc(T("Add all"))}</button></div>` : ""}` : `<p class="hint">✓ ${esc(T("No new sensors found."))}</p>`) : "";
    return `<div id="sensors-disc"><div class="btnrow"><button class="btn sm" data-discover>${ico("refresh")} ${esc(T("Search for new sensors"))}</button>${ign ? `<button class="btn sm" data-dreset>${esc(T("Show the ones I ignored again"))} (${ign})</button>` : ""}</div>${rows}</div>`;
  }
  _customRows(arr, kind) {
    return arr.length ? `<div class="list">${arr.map((x, i) => `<div class="row" data-dk="${kind}"><i class="grip" aria-hidden="true" title="${T("Drag to reorder")}"></i>${ico(x.icon || "info")}<span>${esc(x.label || x.entity)}<small>${esc(x.entity)}</small></span>
      <button class="mv" data-mv="${kind}|${i}|-1" ${i===0?"disabled":""} aria-label="Up">${ico("up")}</button><button class="mv" data-mv="${kind}|${i}|1" ${i===arr.length-1?"disabled":""} aria-label="Down">${ico("down")}</button>
      <button class="mv" data-del="${kind}|${i}" aria-label="Delete">${ico("trash")}</button></div>`).join("")}</div>` : "";
  }

  _infoHtml(c) {
    const has = (k) => this._hass?.states?.[resolveId(this._hass, c, k)];
    const nod = (k) => { const st = has(k)?.state; return st === "unknown" || st === "unavailable" ? ` <small class="nod">No data</small>` : ""; };
    const order=c.info_order.filter(i=>has(INFO_ITEMS[i][0])&&(i!=="fuel_level"||hasFuel(this._hass,c)));
    const iRows=order.map((id,i)=>`<div class="row" data-dk="info"><i class="grip" aria-hidden="true" title="${T('Drag to reorder')}"></i>${ico(INFO_ITEMS[id][2])}<span>${esc(INFO_ITEMS[id][1])}${nod(INFO_ITEMS[id][0])}</span>
      <button class="mv" data-mv="info|${id}|-1" ${i===0?'disabled':''} aria-label="Up">${ico('up')}</button><button class="mv" data-mv="info|${id}|1" ${i===order.length-1?'disabled':''} aria-label="Down">${ico('down')}</button>
      <button class="swb" data-info="${id}" aria-label="Show ${esc(INFO_ITEMS[id][1])}" aria-pressed="${c.info.includes(id)}"><i class="sw ${c.info.includes(id)?'on':''}"></i></button></div>`).join('');
    return `<h4>Info</h4>
      <div class="list">${iRows}</div>
      ${this._customRows(c.info_custom, "info_custom")}${this._addForm("info_custom")}`;
  }
  _tabLayout(c) {
        return `${this._datalist()}
      <h4>Sections</h4>
      <p class="hint">${T("Put the sections in the order you want (e.g. buttons first, then the image, then the range) and hide the ones you don't need.")}</p>
      ${this._orderList(SECTIONS, c.order, [...c.hidden,...(c.charge_curve?[]:['curve']),...(c.charging_reminder?[]:['reminder'])], (i) => SECTION_LABELS[i], "sec")}
      <h4>On the image</h4>
      <div class="list">${HERO_SHOW_OPTS.map(([k, l]) => `<button class="row tg ${(c.hero_show || []).includes(k) ? "on" : ""}" data-hs="${k}"><span>${l}</span><i class="sw ${(c.hero_show || []).includes(k) ? "on" : ""}"></i></button>`).join("")}</div>
      ${this._opt("Message under the status", this._seg("status_sub", c.status_sub === "off" || c.status_sub === "ticker" ? c.status_sub : "roll", [["off", "None"], ["roll", "Rolling"], ["ticker", "With dots"]]), "Under “Locked / Unlocked”: a rolling line (lock time, all closed) or 3 facts (time, parked, range) with dots.")}
      <h4>Top-right buttons</h4>
      <p class="hint">${T("Order (left to right) and visibility of the small buttons in the image corner.")}</p>
      ${this._orderList(TOP_BTN_IDS, c.top_buttons, c.top_buttons_hidden, (i) => TOP_BTN_LABELS[i], "top")}
      <h4>Control buttons</h4>
      <p class="hint">Order and visibility of the control buttons.</p>
      ${this._orderList(BUTTON_IDS, c.buttons, c.buttons_hidden, (i) => BUTTON_LABELS[i], "btn")}
      <h4>Button style</h4>
      <label class="field inline">Layout ${this._sel("button_layout", c.button_layout, [["split", "Main buttons + “More”"], ["grid", "Rows (5 per row)"], ["scroll", "One row with scroll"], ["fit", "One row (everything fits)"]])}</label>
      <label class="field inline">Labels ${this._sel("button_labels", c.button_labels, [["none", "No labels"], ["status", "Status only"], ["title", "Title only"], ["both", "Title + status (2 lines)"]])}</label>
      ${c.button_layout === "split" || !c.button_layout ? `${this._opt("Main buttons", this._seg("button_primary", String(c.button_primary || 4), [["3", "3"], ["4", "4"], ["5", "5"]]), "The first buttons in the list go in the main row, the rest under “More”.")}${this._opt("The rest", this._seg("buttons_more", c.buttons_more || "collapse", [["collapse", "Hidden"], ["show", "Always visible"]]))}` : ""}
      ${this._opt("Size", this._seg("button_size", c.button_size, [["s", "Small"], ["m", "Medium"], ["l", "Large"]]))}
      ${this._infoHtml(c)}`;
  }
  _tabControls(c) {
    const conf = [["lock", "Lock"], ["unlock", "Unlock"], ["windows", "Open windows"], ["trunk", "Open trunk"], ["climate", "Climate"], ["flash", "Lights"], ["honk", "Horn"], ["find", "Locate"], ["refresh", "Refresh data"]];
    return `<h4>Climate</h4>
      ${this._opt("Climate tile", this._seg("climate_ui", c.climate_ui === "circle" ? "circle" : "steps", [["steps", "Target with − / +"], ["circle", "Large circle"]]), "Target with − / +: shows the temperature and lets you adjust the target. Large circle: the classic tile with the big on/off button.")}
      ${this._opt("Temperature selector", this._seg("target_style", c.target_style === "bar" ? "bar" : "wheel", [["wheel", "Wheel"], ["bar", "Bar"]]), "How you set the temperature on the Climate page: a scrolling wheel or a draggable bar.")}
      <label class="field">Climate on-mode<input type="text" data-set="climate_on_mode" data-text value="${esc(c.climate_on_mode || "")}" placeholder="auto"></label>
      ${this._tg("confirm_temp", c.confirm_temp !== false, "Confirm temperature change while the climate is off", "Changing the temperature turns the car's climate on; this keeps it from turning on by accident.")}
      <h4>Ask for confirmation</h4>
      <div class="list">${conf.map(([k, l]) => `<button class="row tg ${c.confirm.includes(k) ? "on" : ""}" data-conf="${k}"><span>${l}</span><i class="sw ${c.confirm.includes(k) ? "on" : ""}"></i></button>`).join("")}</div>
`;
  }
  _tabSensors(c) {
    const selIds = Array.isArray(c.diag) ? c.diag : DIAG.map((d) => d[0]);
    const has = (k) => this._hass?.states?.[resolveId(this._hass, c, k)];
    const nod = (k) => { const st = has(k)?.state; return st === "unknown" || st === "unavailable" ? ` <small class="nod">No data</small>` : ""; };
    const dRows = DIAG.filter((d) => has(d[0])).map((d) => `<button class="row tg ${selIds.includes(d[0]) ? "on" : ""}" data-diag="${d[0]}">${icoBadge(d[2])}<span>${esc(d[1])}</span><i class="sw ${selIds.includes(d[0]) ? "on" : ""}"></i></button>`).join("");
    return `${this._datalist()}
      <h4>Diagnostics</h4>
      <div class="seg"><button data-dmode="alerts" class="${c.diag_mode === "alerts" ? "on" : ""}">Alerts only</button><button data-dmode="all" class="${c.diag_mode === "all" ? "on" : ""}">Always all</button></div>
      <div class="list">${dRows}</div>
      <div class="btnrow"><button class="btn sm" data-dall="0">None</button><button class="btn sm" data-dall="1">All</button></div>
      ${this._tabTires(c)}`;
  }
  _tabVehicle(c) {
    const ents = Object.entries(c.entities), cfgOut = this._exportObj();
    const cc = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black";
    return `${this._datalist()}${this._tabGeneral(c)}<h4>Vehicle setup</h4>
      <label class="field">Entity prefix (e.g. s05)<input type="text" data-set="prefix" data-text value="${esc(c.prefix)}" list="dl-pfx"></label>
      <datalist id="dl-pfx">${pfxCandidates(this._hass).map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>
      ${(() => { const e = effPrefix(this._hass, c); return e !== c.prefix ? `<p class="hint">${T("Prefix {0} was not found; {1} is being used automatically. Edit the field to save it.", `<code>${esc(c.prefix)}</code>`, `<code>${esc(e)}</code>`)}</p>` : ""; })()}
      ${this._opt("Vehicle type", this._seg("powertrain", c.powertrain || "auto", [["auto", "Automatic"], ["phev", "Plug-in hybrid"], ["ev", "Electric"]]), "“Automatic” detects the type from the fuel sensors.")}
      <h4>Car color</h4>
      <p class="hint">Used by the Car View image (vehicle popup and, if you choose it, the hero).</p>
      <div class="csw">${CAR_COLORS.map(([k, n, hex]) => `<button data-sset="car_color|${k}" class="${k === cc ? "on" : ""}" style="background:${hex}" title="${esc(T(n))}" aria-label="${esc(T(n))}"></button>`).join("")}</div>
      ${this._opt("Wheels (Car View)", this._seg("iso_wheels", c.iso_wheels || "cover", [["cover", "20″ with covers"], ["open", "20″ without covers"], ["pro", "18″ Pro"]]))}
      ${c.energy_sheet !== false ? `<label class="field">Battery capacity (kWh)<input type="number" step="0.1" data-set="battery_kwh" data-num value="${Number(c.battery_kwh) > 0 ? esc(c.battery_kwh) : ""}" placeholder="${autoKwh(this._hass, c)}"></label><p class="hint">${T("Automatic: 18.4 kWh for plug-in hybrid, 68.8 kWh for electric. Enter a value only to override it; empty = automatic.")}</p>` : ""}
      ${this._tabTank(c)}
      <h4>Photos (hero & dashboard)</h4>
      <p class="hint">${T("Photos are loaded from the {0} folder next to the card. Here you can set another folder or another file for each photo and check that it exists.", "<code>images/car/</code>")}</p>
      <label class="field">Hero photos folder (empty = automatic)<input type="text" data-set="image_path" data-text value="${esc(c.image_path || "")}" placeholder="${esc(SCRIPT_BASE)}images/car/"></label>
      <div class="list">${Object.keys(ALL_FILES).map((k) => `<div class="chk"><span class="th" data-probe-hero="${k}"></span><div style="min-width:0;flex:1"><div>${esc(HERO_LABELS[k])}</div><input type="text" data-img="${k}" value="${esc(c.images[k] || "")}" placeholder="${esc(ALL_FILES[k])}"></div><span class="st" data-st-hero="${k}">…</span></div>`).join("")}</div>
      <h4>New sensors</h4>
      <p class="hint">${T("If the integration adds new warnings, the card can find them and add them to the diagnostics.")}</p>
      ${this._discHtml(c)}
      <h4>My diagnostics</h4>
      <p class="hint">${T("Any entity. It counts as active when it is on / problem / alarm.")}</p>
      ${this._customRows(c.diag_custom, "diag_custom")}${this._addForm("diag_custom")}
      <h4>Entity mapping</h4>
      <p class="hint">${T("If an entity has a different name than the expected {0}, choose here which one to use.", `<code>${esc(c.prefix)}_…</code>`)}</p>
      ${ents.length ? `<div class="list">${ents.map(([k, v]) => `<div class="row"><span data-ha-name>${esc(this._entityRoleName(k,c))}<small>${esc(v)}</small></span><button class="mv" data-delent="${esc(k)}">${ico("trash")}</button></div>`).join("")}</div>` : ""}
      <div class="add"><label class="field">Key${this._sel("_mkey", this._form.mkey, [["", "— choose —"], ...uniq(OTHER_KEYS).map((k) => [k, this._entityRoleName(k,c)])])}</label>
        <label class="field">Entity<ha-selector data-entity-mapping></ha-selector><small data-mapping-id>${esc(this._form.ment)}</small></label>
        <button class="btn sm" data-addent>${ico("plus")} Map</button></div>
      <h4>Export / reset</h4>
      <p class="hint">Settings are saved in Home Assistant. Copy the configuration below for a manual backup.</p>
      <textarea readonly id="yaml">${esc(toYaml(cfgOut))}</textarea>
      <div class="btnrow"><button class="btn sm" data-copy>${ico("copy")} Copy YAML</button><button class="btn sm" data-reset>${ico("refresh")} Reset</button></div>
      <div class="note" id="note">${esc(this._note)}</div>`;
  }
  _tabTank(c) {
    return hasFuel(this._hass, c) ? `<h4>Tank</h4>
      ${this._opt("Full-tank fuel range (km)", this._num("fuel_max", c.fuel_max, "1"), "0 = automatic (940 km for the hybrid). Enter a positive value to override.")}
      ${this._opt("Tank capacity (L)", this._num("fuel_tank_liters", c.fuel_tank_liters, "0.1"), "0 = automatic from the tank capacity sensor, or 51 L. Used for estimated petrol consumption.")}` : "";
  }
  _tabLook(c) {
    const cc = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black";
    return `<h4>Car image (hero)</h4>

      ${this._opt("Style", this._seg("hero_style", c.hero_style === "carview" ? "carview" : "photo", [["photo", "Photos (black)"], ["carview", "Car View (colours)"]]), "Photos: the black photos with the charging effects. Car View: a 3/4 render in the colour you choose, with live doors; while charging it switches to the translucent view with the charger.")}
      ${this._opt("View (Car View)", this._seg("hero_view", c.hero_view === "top" ? "top" : "iso", [["iso", "3/4"], ["top", "Top"]]), "The view the card opens with. The button at the top right of the hero switches the view with one tap, on the device you tapped it on; choosing here sets the default again. While charging, the 3/4 view shows the translucent car and charge cable.")}
      <div class="grid2"><label class="field">Image zoom${this._num("image_scale", c.image_scale, "0.05")}</label>
        <label class="field">Aspect ratio (e.g. 16 / 9)<input type="text" data-set="image_aspect" data-text value="${esc(c.image_aspect || "")}" placeholder="auto"></label></div>
      ${this._opt("Space around the car", this._sel("hero_space", HERO_SPACE[c.hero_space] ? c.hero_space : "standard", [["compact", "Compact (as before)"], ["standard", "Standard"], ["airy", "Roomy"]]), "Extra height above and below the car: the info on top has room and the status/notifications sit below the tyres. Applies to photos and Car View.")}
      <h4>Car View</h4>
      ${this._opt("Background (Car View)", this._sel("hero_sky", ["auto", "morning", "afternoon", "evening", "night"].includes(c.hero_sky) ? c.hero_sky : "off", [["off", "Black"], ["auto", "Automatic (time of day)"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["night", "Night"]]), "Black: plain dark background. Automatic: sun, clouds and hills by day, moon and stars at night, based on the Home Assistant sun (sun.sun) or the device clock.")}
      <h4>Margins</h4>
      ${this._opt("Card margins", this._seg("card_padding", c.card_padding || "normal", [["normal", "Normal"], ["half", "Half"], ["none", "None"]]), "“None”: the image goes edge to edge.")}
      ${this._opt("Popup margins", this._seg("popup_padding", c.popup_padding || "normal", [["normal", "Normal"], ["half", "Half"], ["none", "None"]]))}
      <h4>Messages</h4>
      ${this._tg("toasts", c.toasts !== false, "On-screen messages")}
      ${this._opt("Message position (capsule over the image)", this._seg("toast_position", c.toast_position || "bottom", [["bottom", "Down"], ["top", "Up"]]))}
      ${this._opt("Message duration", this._seg("toast_duration", String(c.toast_duration || 5), [["3", "3 s"], ["5", "5 s"], ["8", "8 s"], ["12", "12 s"]]))}`;
  }
  _probe() {
    const c = this._cfg, sr = this.shadowRoot, hb = heroBases(c);
    const test = (urls, cb) => { const im = new Image(); let i = 0; im.onload = () => cb(urls[i]); im.onerror = () => { i++; i < urls.length ? (im.src = urls[i]) : cb(null); }; im.src = urls[0]; };
    Object.keys(ALL_FILES).forEach((k) => {
      const f = c.images[k] || ALL_FILES[k];
      const urls = /^(https?:)?\/\/|^\//.test(f) ? [f] : hb.map((b) => b + f);
      test(urls, (u) => {
        const th = sr.querySelector(`[data-probe-hero="${k}"]`), st = sr.querySelector(`[data-st-hero="${k}"]`);
        if (th && u) th.style.backgroundImage = `url("${String(u).replace(/["\\\n\r()]/g, encodeURIComponent)}")`;
        if (st) { st.textContent = u ? "✓" : "✗"; st.className = `st ${u ? "ok" : "no"}`; }
      });
    });
  }
  /* drawing helpers */
  _seg(name, val, opts) { return `<div class="seg wide">${opts.map(([v, l]) => `<button data-sset="${name}|${v}" class="${String(v) === String(val) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`; }
  _opt(label, ctrl, sub) { return `<div class="opt"><div class="ol">${label}${sub ? `<small>${sub}</small>` : ""}</div>${ctrl}</div>`; }
  _tg(key, on, label, sub) { return `<button class="row tg ${on ? "on" : ""}" data-tgl="${key}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><i class="sw ${on ? "on" : ""}"></i></button>`; }
  _tabGeneral(c) {
    const cfgOut = this._exportObj();
    return `<h4>Card</h4>
      <label class="field">Card name<input type="text" data-set="name" data-text placeholder="Deepal S05" value="${esc(c.name)}"></label>
      <h4>Settings on the card</h4>
      ${this._tg("show_customize", c.show_customize !== false, "“Settings” button on the card", "If you hide it, you can still change settings in Companion or the Home Assistant card editor.")}
`;
  }
  _tabCharge(c) {
    const fu = hasFuel(this._hass, c);
    return `<h4>Charging details</h4>
      ${this._opt("Style", this._seg("charge_style", c.charge_style || "line", [["line", "Line"], ["text", "Text"], ["big", "Large"], ["beside", "At the port"]]), "Current, time remaining and charging type as text on the image.")}
      <h4>Charging effect</h4>
      <label class="field">Charging effect on the car${this._sel("charge_fx", c.charge_fx || "flow_port", [["flow_port", "Cable flow + port pulse"], ["flow", "Energy flow along the cable"], ["port", "Pulse at the charge port"], ["sweep", "Light sweep across the car"], ["none", "None"]])}</label>
      ${this._tg("energy_sheet", c.energy_sheet !== false, "“Energy” sheet on the tile", "Tapping the Energy/Battery tile opens the battery, charging and driving history. A long press opens the sensor. If you turn it off, the sensor always opens.")}
      ${this._tg("chg_roll", c.chg_roll !== false, "Alternate “Charging now” / time left", "In the Energy tile, while charging, the text rolls upward and shows the time left every few seconds.")}
`;
  }
  _tabColours(c) {

    const hc = (k) => hexc(c[k], DEFAULTS[k]);
    const sw = (k, l) => `<label class="sw-c"><input type="color" data-set="${k}" data-text value="${esc(hc(k))}"><span>${l}</span></label>`;
    const a = Number(c.air_t1) || 22, b = Number(c.air_t2) || 24, lo = 16, hi = 30, pc = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
    const lv = (t1, t2, t3, top = "lvl_green") => { const a = Number(t1) || 0, b = Number(t2) || 0, d = Number(t3) || 0; return `background:linear-gradient(90deg, ${hc("lvl_red")} 0 ${a}%, ${hc("lvl_orange")} ${a}% ${b}%, ${hc("lvl_yellow")} ${b}% ${d}%, ${hc(top)} ${d}% 100%)`; };
    const rowL = (k, l, bk, fk) => `<div class="lvrow">${sw(k, l)}${bk ? this._num(bk, c[bk], "1") : `<i class="dash">—</i>`}${fk ? this._num(fk, c[fk], "1") : `<i class="dash">—</i>`}</div>`;
    const fu = hasFuel(this._hass,c);
    return `<h4>Tiles</h4>
      ${this._opt("Icon colour of the bottom tiles", this._seg("tile_icons", ["blue", "neutral", "custom"].includes(c.tile_icons) ? c.tile_icons : "accent", [["accent", "Green"], ["neutral", "Grey"], ["blue", "Blue"], ["custom", "Custom"]]), "Odometer, fuel, charging, etc.")}
      ${c.tile_icons === "custom" ? sw("tile_icon_color", "Custom icon colour") : ""}
      <h4>Air flow colors</h4>
      <p class="hint">The airflow in the Climate tab is colored by the target temperature. Set the limits and the colors.</p>
      <div class="lvhead"><span></span><span>Up to (°C)</span><span></span></div>
      <div class="lvrow">${sw("air_c1", "Cool")}${this._num("air_t1", c.air_t1, "0.5")}<i class="dash"></i></div>
      <div class="lvrow">${sw("air_c2", "Mild")}${this._num("air_t2", c.air_t2, "0.5")}<i class="dash"></i></div>
      <div class="lvrow">${sw("air_c3", "Warm")}<i class="dash">—</i><i class="dash"></i></div>
      <div class="lvbar" style="background:linear-gradient(90deg, ${hc("air_c1")} 0 ${pc(a)}%, ${hc("air_c2")} ${pc(a)}% ${pc(b)}%, ${hc("air_c3")} ${pc(b)}% 100%)"></div>
      <h4>Level colors</h4>
      <p class="hint">The battery and fuel bars change color with the percentage. Set the thresholds (below each value) and the colors.</p>
      <div class="lvhead"><span></span><span>Battery (%)</span><span>Fuel (%)</span></div>
      ${rowL("lvl_red", "Red", "bat_t1", "fuel_t1")}${rowL("lvl_orange", "Orange", "bat_t2", "fuel_t2")}${rowL("lvl_yellow", "Yellow", "bat_t3", "fuel_t3")}${rowL("lvl_green", "Green", null, null)}
      <div class="lvbar" style="${lv(c.bat_t1, c.bat_t2, c.bat_t3)}"></div>
      ${fu ? `<div class="lvbar" style="${lv(c.fuel_t1, c.fuel_t2, c.fuel_t3)}"></div>` : ""}`;
  }
  _tabTires(c) {
    const u = c.tire_unit || "bar", k = u === "kPa" ? 100 : u === "psi" ? 14.5038 : 1, dp = u === "kPa" ? 0 : u === "psi" ? 1 : 2, shown = (b) => Number((Number(b) * k).toFixed(dp));
    const chk = c.tire_check || "vehicle";
    return `<h4>Tyres</h4>
      ${this._opt("Unit", this._seg("tire_unit", u, [["bar", "bar"], ["kPa", "kPa"], ["psi", "psi"]]))}
      ${this._opt("Pressure check", this._seg("tire_check", chk, [["vehicle", "From the vehicle"], ["limits", "My own limits"], ["both", "Both"]]), "“From the vehicle”: the status comes from the tyre alerts the car itself sends.")}
      ${chk === "vehicle" ? "" : `<div class="grid2"><label class="field">${T("Minimum")} (${u})<input type="number" step="${dp ? 1 / 10 ** dp : 1}" data-set="tire_min" data-num data-conv data-default="${shown(DEFAULTS.tire_min)}" placeholder="${shown(DEFAULTS.tire_min)}" value="${c.tire_min===DEFAULTS.tire_min?"":shown(c.tire_min)}"></label><label class="field">${T("Maximum")} (${u})<input type="number" step="${dp ? 1 / 10 ** dp : 1}" data-set="tire_max" data-num data-conv data-default="${shown(DEFAULTS.tire_max)}" placeholder="${shown(DEFAULTS.tire_max)}" value="${c.tire_max===DEFAULTS.tire_max?"":shown(c.tire_max)}"></label></div>
      <p class="hint">Outside the limits the pressure is shown as “low” or “high”.</p>`}`;
  }
  _exportObj() {
    const c = this._cfg, o = { type: this.yamlBase?.type || `custom:${TAG}` };
    for (const k of SETTING_KEYS) {
      
      if (JSON.stringify(c[k]) !== JSON.stringify(DEFAULTS[k])) o[k] = c[k];
    }
    return o;
  }

  _render() {
    const c = this._cfg;
    if (!c) return;
    if(this._tabLoading){this._renderTabLoading();return;}
    this.tab = { general: "vehicle", sections: "layout", buttons: "layout", images: "look", tires: "sensors" }[this.tab] || this.tab; /* old tab names */
    if (!["vehicle", "layout", "look", "controls", "charge", "colours", "sensors", "general"].includes(this.tab)) this.tab = "layout";
    const body = { vehicle: () => this._tabVehicle(c), layout: () => this._tabLayout(c), look: () => this._tabLook(c), controls: () => this._tabControls(c), charge: () => this._tabCharge(c), colours: () => this._tabColours(c), sensors: () => this._tabSensors(c), general: () => this._tabGeneral(c) }[this.tab]();
    const parts = body.split("<h4>"), grouped = parts[0] + parts.slice(1).map((x) => `<section class="grp"><h4>${x}</section>`).join("");
    const snap = UI.pillSnap(this.shadowRoot);
    this.shadowRoot.innerHTML = `<style>${SETTINGS_CSS}</style><div class="wrap">${this._tabs()}${grouped}</div>`;
    this._bind(); this._wireTabs(); UI.pillApply(this.shadowRoot, snap);
    if (this.tab === "vehicle") this._probe();
  }

  _navUpd() {
    const sr = this.shadowRoot, tb = sr.querySelector(".tabs"); if (!tb) return;
    const l = sr.querySelector(".tn.l"), r = sr.querySelector(".tn.r"), max = tb.scrollWidth - tb.clientWidth;
    if (l) l.hidden = tb.scrollLeft < 4; if (r) r.hidden = max <= 4 || tb.scrollLeft > max - 4;
  }
  _wireTabs() {
    const tb = this.shadowRoot.querySelector(".tabs"); if (!tb) return;
    tb.scrollLeft = this._tx || 0;
    const on = tb.querySelector(".on");
    if (on && (on.offsetLeft < tb.scrollLeft || on.offsetLeft + on.offsetWidth > tb.scrollLeft + tb.clientWidth)) tb.scrollLeft = on.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2;
    this._tx = tb.scrollLeft; this._navUpd();
    tb.addEventListener("scroll", () => { this._tx = tb.scrollLeft; this._navUpd(); }, { passive: true });
    UI.drag(tb); // dragging with the mouse (on touch, scrolling works by itself)
    requestAnimationFrame(() => this._navUpd());
  }
  _bind() {
    const sr = this.shadowRoot;
    sr.querySelectorAll('select[data-set="_mkey"]').forEach((s) => s.addEventListener("change", () => (this._form.mkey = s.value)));
    if (this._bnd) return; this._bnd = true; // listeners are added once; they always read the current setting
    const c = new Proxy({}, { get: (_, k) => (this._cfg ? this._cfg[k] : undefined) });
    /* drag-and-drop reordering (sections / buttons): you grab the handle on the left; the arrows stay as an alternative */
    sr.addEventListener("pointerdown", (e) => {
      const g = e.target.closest && e.target.closest(".grip"); if (!g || (e.pointerType === "mouse" && e.button !== 0)) return;
      const row = g.closest(".row"), list = row && row.parentElement; if (!list) return;
      e.preventDefault();
      const rows = [...list.children], from = rows.indexOf(row), rc = rows.map((r) => r.getBoundingClientRect()), y0 = e.clientY;
      const gap = rows.length > 1 ? Math.max(0, rc[1].top - rc[0].bottom) : 0, step = rc[from].height + gap, lo = rc[0].top - rc[from].top, hi = rc[rows.length - 1].top - rc[from].top;
      let to = from;
      try { g.setPointerCapture(e.pointerId); } catch (_) {}
      row.classList.add("drag"); list.classList.add("dragging");
      const move = (ev) => {
        const dy = Math.min(hi, Math.max(lo, ev.clientY - y0)); row.style.transform = `translateY(${dy}px)`;
        const mid = rc[from].top + rc[from].height / 2 + dy; to = from;
        rc.forEach((r, i) => { if (i < from && mid < r.top + r.height / 2) to = Math.min(to, i); if (i > from && mid > r.top + r.height / 2) to = Math.max(to, i); });
        rows.forEach((r, i) => { if (i === from) return; r.style.transform = to < from && i >= to && i < from ? `translateY(${step}px)` : to > from && i > from && i <= to ? `translateY(${-step}px)` : ""; });
      };
      const end = (ev) => {
        g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", end); g.removeEventListener("pointercancel", end);
        try { g.releasePointerCapture(e.pointerId); } catch (_) {}
        rows.forEach((r) => { r.style.transform = ""; }); row.classList.remove("drag"); list.classList.remove("dragging");
        if (ev.type === "pointerup" && to !== from) {
          const kind=row.dataset.dk,key=this._sortKey(kind),arr=[...c[key]];
          const indices=kind==='info'?rows.map(r=>arr.indexOf(r.querySelector('[data-mv]').dataset.mv.split('|')[1])):rows.map((_,i)=>i);
          const values=indices.map(i=>arr[i]),[m]=values.splice(from,1);values.splice(to,0,m);indices.forEach((index,i)=>arr[index]=values[i]);
          this._emit({ [key]: arr });
        }
      };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
    });
    sr.addEventListener("click", (e) => {
      const t = e.target.closest("button,[data-tab]");
      if (!t) return;
      if (t.dataset.tn) { const tb = sr.querySelector(".tabs"); return tb && tb.scrollBy({ left: Number(t.dataset.tn) * Math.max(120, tb.clientWidth * 0.7), behavior: "smooth" }); }
      const d = t.dataset;
      if (d.tab) return this._navigateTab(d.tab);
      if (d.mv) {
        const [kind, id, dir] = d.mv.split("|");
        const key=this._sortKey(kind),arr=[...c[key]],custom=kind==='info_custom'||kind==='diag_custom';
        const visible=kind==='info'?[...t.closest('.list').querySelectorAll('.row')].map(row=>row.querySelector('[data-mv]').dataset.mv.split('|')[1]):null;
        const i=custom?Number(id):arr.indexOf(id),j=visible?arr.indexOf(visible[visible.indexOf(id)+Number(dir)]):i+Number(dir);
        if (i < 0 || j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return this._emit({ [key]: arr });
      }
      if (d.vis) {
        const [kind, id] = d.vis.split("|"), key = kind === "sec" ? "hidden" : kind === "top" ? "top_buttons_hidden" : "buttons_hidden", s = new Set(c[key]);
        if(kind==='sec'&&id==='curve')return this._emit({charge_curve:!(c.charge_curve&&!c.hidden.includes('curve')),hidden:c.hidden.filter(id=>id!=='curve')});
        if(kind==='sec'&&id==='reminder')return this._emit({charging_reminder:!(c.charging_reminder&&!c.hidden.includes('reminder')),hidden:c.hidden.filter(id=>id!=='reminder')});
        s.has(id) ? s.delete(id) : s.add(id);
        return this._emit({ [key]: [...s] });
      }
      if (d.sset) { const i = d.sset.indexOf("|"), key = d.sset.slice(0, i), value = d.sset.slice(i + 1); return this._emit({ [key]: typeof DEFAULTS[key] === "number" ? Number(value) : value }); }
      if (d.tgl) return this._emit({ [d.tgl]: c[d.tgl] === false });
      if (d.hs) { const x = new Set(c.hero_show || []); x.has(d.hs) ? x.delete(d.hs) : x.add(d.hs); return this._emit({ hero_show: HERO_SHOW_OPTS.map((o) => o[0]).filter((k) => x.has(k)) }); }
      if (d.conf) { const s = new Set(c.confirm); s.has(d.conf) ? s.delete(d.conf) : s.add(d.conf); return this._emit({ confirm: [...s] }); }
      if (d.diag) {
        const cur = new Set(Array.isArray(c.diag) ? c.diag : DIAG.map((x) => x[0]));
        cur.has(d.diag) ? cur.delete(d.diag) : cur.add(d.diag);
        return this._emit({ diag: [...cur] });
      }
      if (d.info) { const s = new Set(c.info); s.has(d.info) ? s.delete(d.info) : s.add(d.info); return this._emit({ info: INFO_IDS.filter((i) => s.has(i)) }); }
      if (d.discover !== undefined) { this._disc = discoverDiag(this._hass, this._cfg); return this._render(); }
      if (d.dadd !== undefined || d.daddall !== undefined) {
        const pick = (this._disc || []).filter((f) => d.daddall !== undefined || f.entity === d.dadd);
        this._disc = (this._disc || []).filter((f) => !pick.includes(f));
        return this._emit({ diag_custom: [...c.diag_custom, ...pick.map((f) => ({ entity: f.entity, label: f.label, icon: f.icon }))] });
      }
      if (d.dreset !== undefined) { this._disc = null; return this._emit({ diag_ignore: [] }); }
      if (d.dmode) return this._emit({ diag_mode: d.dmode });
      if (d.dall !== undefined) return this._emit({ diag: d.dall === "1" ? DIAG.map((x) => x[0]) : [] });
      if (d.icon) { this._form.icon = d.icon; return this._render(); }
      if (d.add !== undefined) {
        const f = this._form, ent = f.entity.trim();
        if (!/^[a-z_]+\.[\w]+$/.test(ent)) { this._note = T("Enter a valid entity_id"); return this._render(); }
        const item = { entity: ent, label: f.label.trim(), icon: MDI_RE.test(f.mdi.trim()) ? f.mdi.trim() : f.icon };
        this._form = { ...this._form, entity: "", label: "", mdi: "" };
        return this._emit({ [d.add]: [...c[d.add], item] });
      }
      if (d.del) { const [k, i] = d.del.split("|"); const a = [...c[k]]; a.splice(Number(i), 1); return this._emit({ [k]: a }); }
      if (d.addent !== undefined) {
        const f = this._form; if (!f.mkey || !f.ment.trim()) return;
        const m = { ...c.entities, [f.mkey]: f.ment.trim() };
        this._form = { ...f, ment: "" };
        return this._emit({ entities: m });
      }
      if (d.delent) { const m = { ...c.entities }; delete m[d.delent]; return this._emit({ entities: m }); }
      if (d.copy !== undefined) {
        const txt = sr.getElementById("yaml").value;
        (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => (this._note = T("Copied ✓")), () => { sr.getElementById("yaml").select(); this._note = T("Press Ctrl/⌘+C"); }).then(() => this._render());
        return;
      }
      if (d.reset !== undefined) { this._note = ""; return this.onReset && this.onReset(); }
    });
    sr.addEventListener("change", (e) => {
      const t = e.target, d = t.dataset;
      if (d.set === "_mkey") return;
      if (d.set) {
        let v = t.value;
        if (d.num !== undefined) { v = parseFloat(v); if (!Number.isFinite(v)) { v = Number(t.dataset.default??DEFAULTS[d.set]??0); } } if (d.set === "battery_kwh" && !(v >= 0 && v <= 500)) return; if (NUM_RANGE[d.set]) v = Math.min(NUM_RANGE[d.set][1], Math.max(NUM_RANGE[d.set][0], v));
        if (d.conv !== undefined) { const u = c.tire_unit; v = Number((u === "kPa" ? v / 100 : u === "psi" ? v / 14.5038 : v).toFixed(3)); }
        if (d.text !== undefined) { v = v.trim(); if (["image_path", "layers_path", "climate_on_mode", "image_aspect"].includes(d.set) && !v) v = null; if (d.set === "prefix" && !v) return; }
        return this._emit({ [d.set]: v });
      }
      if (d.img) { const m = { ...c.images }; t.value.trim() ? (m[d.img] = t.value.trim()) : delete m[d.img]; return this._emit({ images: m }); }
    });
    sr.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.f) this._form[t.dataset.f] = t.value;
    });
  }
}

/* ───────────────────────── HA editor ───────────────────────── */
class DeepalS05CardEditor extends HTMLElement {
  connectedCallback() { I18N.watch(this.shadowRoot); }
  constructor() { super(); this.attachShadow({ mode: "open" }); I18N.watch(this.shadowRoot); this._tab = "layout"; }
  setConfig(config) { this._config = { ...config }; this._draw(); }
  set hass(h) { this._hass = h; if (this._s) this._s.hass = h; }
  _commit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
    this._draw();
  }
  _draw() {
    if (!this._s) {
      this._s = document.createElement(SETTINGS_TAG);
      this._s.mode = "editor";
      this._s.onTab = (t) => (this._tab = t);
      this._s.onPatch = (p) => {
        this._config = { ...this._config, ...p };
        this._commit();
      };
      this._s.onReset = () => {
        const { type, prefix, name } = this._config;
        this._config = { type, ...(prefix ? { prefix } : {}), ...(name ? { name } : {}) };
        this._commit();
      };
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this._s);
    }
    this._s.tab = this._tab;
    this._s.hass = this._hass;
    this._s.yamlBase = this._config;
    this._s.cfg = mergeConfig(this._config, null);
  }
}


customElements.define(SETTINGS_TAG, DeepalS05Settings);
customElements.define(EDITOR_TAG, DeepalS05CardEditor);
customElements.define(TAG, DeepalS05Card);

window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === TAG)) {
  window.customCards.push({ type: TAG, name: "Deepal S05 Control Panel", description: "Control panel for the Deepal S05 (EV/PHEV): lock and climate controls, charging, tyres, doors and windows, interior, trip and fuel data, and a diagnostics page. Works with the Deepal Alternative integration.", preview: true, documentationURL: "https://github.com/rmxs/deepal-s05-card" });
}
console.info(`%c DEEPAL-S05-CARD %c v${CARD_VERSION} `, "background:#E20074;color:#fff;border-radius:4px 0 0 4px;padding:2px 4px", "background:#222;color:#fff;border-radius:0 4px 4px 0;padding:2px 4px");
})();
