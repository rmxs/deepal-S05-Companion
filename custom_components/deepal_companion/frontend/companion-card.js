/*!
 * deepal-companion-card
 * Copyright (c) 2026 L.K. — GPL-3.0-only
 * Custom Lovelace card for Deepal S05 (and PHEV): hero with layers, control buttons,
 * Car View with tyres, interior (heating/ventilation), diagnostics, its own settings UI.
 *
 * No dependencies and no CDN. The icons are its own (embedded).
 * The layer images (Car View/interior) come from the dec_deepal project
 * (MIT) — see THIRD_PARTY_NOTICES.md in the card folder.
 */
(() => {
const CARD_VERSION = "2.0.1-b1"; // the build overwrites this with the package version
const CARD_CREDIT = "Made with ♥ in Greece · L.K.";
const TAG = "deepal-companion-card";
const SETTINGS_TAG = "deepal-companion-settings";
const EDITOR_TAG = "deepal-companion-card-editor";
if (customElements.get(TAG)) return;

const NUM_RANGE = { charge_prompt_min_gain: [0, 100], charge_prompt_recent: [1, 20], charge_spike_jump: [5, 50], charge_curve_refresh: [1, 60], charge_curve_gap: [1, 120], charge_target: [0, 100], bat_t1: [0, 100], bat_t2: [0, 100], bat_t3: [0, 100], fuel_t1: [0, 100], fuel_t2: [0, 100], fuel_t3: [0, 100], image_scale: [0.5, 3] };
const BAD = ["unknown", "unavailable", "none", "None", "null", ""];
const TRANSITIONAL = ["locking", "unlocking", "opening", "closing"];
const CLIMATE_TURN_OFF = 128; // ClimateEntityFeature.TURN_OFF
const CLIMATE_TURN_ON = 256; // ClimateEntityFeature.TURN_ON

/* The card folder (where this .js lives) — the images load from there. */
const SCRIPT_BASE = "/deepal_companion/frontend/";

/* ───────────────────────── Defaults ───────────────────────── */
/* sections the Minimal / Cockpit designs do not draw: shown greyed out in the Sections list, saved order and visibility stay untouched */
const DESIGN_UNUSED = { minimal: ["hero", "actions", "status", "stats", "costs"], ultra: ["hero", "actions", "status", "stats", "costs"], cockpit: ["stats"] };
const SECTIONS = ["hero", "actions", "status", "charge", "curve", "stats", "info", "costs", "reminder"]; /* diagnostics is no longer a section: warnings live on the top Diagnostics button */
/* Status is drawn on the vehicle image. In the Sections list it is its own tile, always directly after the Vehicle image tile: it is never dragged alone and moves with the image. */
const keepStatus = (list) => { const rest = list.filter((x) => x !== "status"), h = rest.indexOf("hero"); rest.splice(h < 0 ? rest.length : h + 1, 0, "status"); return rest; };
const SECTION_LABELS = {
  hero: "Vehicle image",
  actions: "Control buttons",
  status: "Status (on the image)",
  stats: "Temperature & battery",
  info: "Info",
  charge: "Charging (when plugged in)",
  costs: "Charging costs",
  reminder: "Charging reminder",
  curve: "Charging curve (while charging)",
};
const HERO_SHOW_OPTS = [["name", "Name"], ["plate", "Plate"], ["range", "Total range"], ["cloud", "Cloud connection"], ["updated", "Last update"]];
const HERO_SPACE = { compact: [0, 0], standard: [8, 2.5], airy: [16, 5] }; // [top, bottom] as % of the card width
const TOP_BTN_IDS = ["bell", "view", "diag", "refresh"]; // the small buttons at the top right of the hero (left to right)
const TOP_BTN_LABELS = { diag: "Diagnostics", bell: "Notifications (bell)", view: "View switch (Car View)", refresh: "Refresh" };
const BUTTON_IDS = ["lock", "windows", "trunk", "climate", "precondition", "tires", "cabin", "flash", "honk", "find"];
const BUTTON_LABELS = {
  lock: "Lock",
  windows: "Windows",
  trunk: "Trunk",
  climate: "Climate",
  precondition: "Preconditioning",
  tires: "Tyres",
  cabin: "Interior",
  flash: "Lights",
  honk: "Horn",
  find: "Lights + horn",
  refresh: "Refresh",
};

const AUTO_FUEL_RANGE = 940;
const DEFAULTS = { companion_design: "", companion_width: 0,
  prefix: "s05",
  name: "", // empty → device name from the integration (otherwise "Deepal S05")
  image_path: null, // folder with the hero photos (null = automatic)
  image_scale: 1.2,
  hero_space: "standard", // space around the car in the hero: compact (as before, 0 / 0) | standard (8 / 2.5) | airy (16 / 5)
  image_aspect: null,
  powertrain: "auto", // auto (from the fuel sensors) | phev | ev (electric only)
  fuel_max: 0, // 0 = automatic hybrid full-tank range (940 km)
  confirm: ["unlock", "trunk", "windows", "lock", "climate"],
  confirm_temp: true, // asks before changing the temperature while the climate is off (the change turns it on)
  order: SECTIONS.slice(),
  hidden: ["charge", "costs"],
  buttons: BUTTON_IDS.slice(),
  buttons_hidden: [],
  top_buttons: ["bell", "view", "diag", "refresh"], // order of the small buttons at the top right
  top_buttons_hidden: [],
  button_layout: "split", // split (main buttons + "More") | image (main buttons, "More" on the image) | imageall (all buttons in "More" on the image) | swipe (pages with dots) | grid (rows)
  climate_ui: "circle", // climate tile: steps (target with − / + and a small power button) | circle (classic: one big on/off circle)
  energy_ui: "ring", // Energy tile: ring (classic: two arcs in the corner) | gauge (half gauge)
  button_primary: 5, // split: how many buttons (from the start of the list) go in the main row
  buttons_more: "collapse", // split: collapse (hidden behind "More") | show
  button_labels: "status", // none | status | title | both
  button_size: "m", // s | m | l
  diag: null, // null = all
  diag_ignore: [], // sensors found by "Discovery" that the user dismissed
  hero_show: ["name", "plate", "range", "cloud", "updated"], // what shows on the image: name, plate, range, cloud, updated
  info: ["odometer", "humidity", "charger_limit"],
  charge_cost_selector: true, // charging with the curve hidden: show the cost location selector until a location is saved
  info_order: ["odometer","outside_temp","inside_temp","humidity","fuel_level","fuel_volume","power_status","charge_status","charge_plan","charger_limit"],
  info_custom: [], // [{entity, label, icon, unit, tap_action}]; long press always opens more-info
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
  hero_sky: "off", // Car View background: off (plain black) · auto (sun/moon/clouds by time of day; sun.sun if present) · neon (automatic Neon city photo) · neon-day · neon-afternoon · neon-night · morning · afternoon · evening · night
  car_side: "auto", // Car View 3/4 side: auto (shows the passenger side while only passenger-side doors/windows are open) | driver | passenger
  iso_wheels: "cover", // wheels in Car View: cover (20" with caps) · open (20" without caps) · pro (18")
  charge_style: "beside", // line · text · big · beside
  charge_target: 0, // charging goal in percent: 0 = off, 50–100 in 5 % steps. Advisory only: the card shows the goal, an estimated time and a notice; it cannot stop charging
  charge_curve_gap: 15, // minutes: in the live curve a stop longer than this starts a new charge
  charge_curve_refresh: 5, // minutes: while charging, the end of the charging curve moves to now at least this often when the car reports nothing new
  charge_curve_missing: true, // Highlight Missing Data: lighter line and a tooltip across gaps between readings; false keeps one plain line
  plan_button: true, // clock button on the Energy tile that opens the charge plan window (shown only when the car has the schedule entities)
  energy_sheet: true, // tapping the Energy/Battery tile opens the history sheet (false = opens the sensor)
  charge_prompt_min_gain: 3, // battery percent a finished charge must add before it asks for a charging profile
  charge_prompt_recent: 10, // how many of the latest charges the profile reminder checks
  charge_spike_jump: 20, // a single battery reading this many percent above the charge so far must be confirmed by the next one
  battery_kwh: 0, // battery capacity in kWh; 0 = automatic by vehicle type (PHEV 18.4 / electric 68.8); used for the kWh estimate of charges in the Energy sheet
  status_sub: "roll", // message under "Locked/Unlocked": off · roll (rolling) · ticker (rolling with dots)
  chg_roll: true, // in the Energy tile while charging: alternates "Charging now" ↔ time remaining (scrolls upward)
  air_t1: 22, air_t2: 24, // climate: up to t1 cool air, up to t2 mild, above that warm
  air_c1: "#8ec5ff", air_c2: "#ffcc3d", air_c3: "#ff7a2e", // air colours: cool · mild · warm
  show_customize: true,
  pending_fx: "arc", // effect on a control button while it waits for the car: arc | pulse | neon
  charge_fx: "flow_port", // charging effect on the car: flow_port | flow | port | sweep | none
  toasts: true, // messages on the screen
  card_padding: "half", // normal | half | none (edge-to-edge image)
  popup_padding: "half", // normal | half | none
  target_style: "wheel", // temperature selector in Climate: wheel | bar
  accent_color: "green", // green | blue | violet | amber | rose | cyan | lime | coral | orange: theme colour of the whole card
  toast_position: "bottom", // on the image: bottom | top (capsule)
  toast_duration: 5, // seconds
  lvl_red: "#f87171", lvl_orange: "#fb923c", lvl_yellow: "#facc15", lvl_green: "#34d399", // battery/fuel level colours
  notify_alert_level: "red", notify_ok_level: "green", notify_climate_level: "green", notify_charge_level: "green", // live notifications: which level colour (red | orange | yellow | green) each state uses
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
  : !!hass?.states && ["fuel_range", "fuel_level", "fuel_volume"].some((k) => hass.states[resolveId(hass, c, `sensor.${k}`)]);
/* HA server time zone everywhere; user profile still supplies language, date order and 12/24-hour formatting. */
function mountChartZoom(host,bounds,onRange,options={}) {
  let range=options.initial||null,seed=null,pinching=false;
  const pointers=new Map(),bar=document.createElement('div'),style=document.createElement('style');
  style.textContent='.dc-chart-zoom{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:4px 0;color:var(--ds-muted,var(--secondary-text-color));font:inherit}.dc-chart-zoom span{font-size:11px;line-height:1.4}.dc-chart-zoom button{display:grid;place-items:center;flex:0 0 32px;width:32px;height:32px;padding:6px;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer}.dc-chart-zoom button:hover:not(:disabled){background:var(--ds-soft,var(--secondary-background-color))}.dc-chart-zoom button:disabled{opacity:.3;cursor:default}.dc-chart-zoom button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}.dc-chart-zoom svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}';
  bar.className='dc-chart-zoom';bar.setAttribute('role','group');bar.setAttribute('aria-label',T('Chart zoom'));
  bar.innerHTML='<span>'+esc(T('Pinch or Ctrl/⌘ + scroll to zoom'))+'</span><button type="button" data-chart-zoom="reset" aria-label="'+esc(T('Reset zoom'))+'" title="'+esc(T('Reset zoom'))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg></button>';
  host.before(style);if(options.controlsHost){options.controlsHost.append(bar);bar.style.cssText='margin:0 0 0 auto;min-width:0';}else host.before(bar);host.style.touchAction='none';
  const domain=()=>range||bounds();
  const paint=()=>{const view=domain();host.dataset.zoomStart=String(view.start);host.dataset.zoomEnd=String(view.end);bar.querySelector('[data-chart-zoom=reset]').disabled=!range;};
  const apply=(start,span)=>{const full=bounds(),total=full.end-full.start;span=Math.min(total,Math.max(Math.min(total,options.minSpan||60000),span));start=Math.max(full.start,Math.min(full.end-span,start));range=span>=total*.999999?null:{start,end:start+span};paint();onRange(range);};
  const zoom=(factor,fraction=.5)=>{const view=domain(),span=(view.end-view.start)*factor;apply(view.start+(view.end-view.start)*fraction-span*fraction,span);};
  bar.addEventListener('click',event=>{if(!event.target.closest('[data-chart-zoom=reset]'))return;event.preventDefault();event.stopPropagation();range=null;paint();onRange(null);});
  const geometry=()=>{const [a,b]=[...pointers.values()];return {distance:Math.max(10,Math.hypot(a.x-b.x,a.y-b.y)),middle:(a.x+b.x)/2};};
  const fraction=middle=>{const rect=host.getBoundingClientRect();return Math.max(0,Math.min(1,(middle-rect.left)/Math.max(1,rect.width)));};
  host.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size!==2)return;pinching=true;seed={...geometry(),view:{...domain()}};event.preventDefault();event.stopPropagation();for(const id of pointers.keys())try{host.setPointerCapture(id);}catch(_){};},true);
  host.addEventListener('pointermove',event=>{if(pointers.has(event.pointerId))pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(!pinching)return;event.preventDefault();event.stopPropagation();if(pointers.size!==2||!seed)return;const current=geometry(),span=(seed.view.end-seed.view.start)*seed.distance/current.distance,anchor=seed.view.start+fraction(seed.middle)*(seed.view.end-seed.view.start);apply(anchor-fraction(current.middle)*span,span);},true);
  const end=event=>{pointers.delete(event.pointerId);if(pinching){event.stopPropagation();if(!pointers.size){seed=null;pinching=false;}}};host.addEventListener('pointerup',end,true);host.addEventListener('pointercancel',end,true);
  host.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();zoom(event.deltaY>0?1.25:.8,fraction(event.clientX));},{passive:false});
  paint();return {reset(){range=null;paint();onRange(null);},destroy(){bar.remove();style.remove();}};
}

function startGridReorder(e,g,row,list,onDrop,onEnd) {
      /* two-column lists: the row follows the pointer in both directions and the others slide into the neighbouring cell */
      e.preventDefault();
      const rows = [...list.children], from = rows.indexOf(row), rc = rows.map((r) => r.getBoundingClientRect()), x0 = e.clientX, y0 = e.clientY;
      const L = Math.min(...rc.map((r) => r.left)), T = Math.min(...rc.map((r) => r.top)), R = Math.max(...rc.map((r) => r.right)), B = Math.max(...rc.map((r) => r.bottom));
      const mx = rc[from].left + rc[from].width / 2, my = rc[from].top + rc[from].height / 2;
      let to = from;
      try { g.setPointerCapture(e.pointerId); } catch (_) {}
      row.classList.add("drag"); list.classList.add("dragging");
      const move = (ev) => {
        const cx = Math.min(R, Math.max(L, mx + ev.clientX - x0)), cy = Math.min(B, Math.max(T, my + ev.clientY - y0));
        row.style.transform = `translate(${cx - mx}px,${cy - my}px)`;
        let best = from, bd = Infinity;
        rc.forEach((r, i) => { const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); if (d < bd - 0.5) { bd = d; best = i; } });
        to = best;
        rows.forEach((r, i) => { if (i === from) return; const j = to < from && i >= to && i < from ? i + 1 : to > from && i > from && i <= to ? i - 1 : i; r.style.transform = j === i ? "" : `translate(${rc[j].left - rc[i].left}px,${rc[j].top - rc[i].top}px)`; });
      };
      const end = (ev) => {
        g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", end); g.removeEventListener("pointercancel", end);
        try { g.releasePointerCapture(e.pointerId); } catch (_) {}
        rows.forEach((r) => { r.style.transform = ""; }); row.classList.remove("drag"); list.classList.remove("dragging");
        if (ev.type === "pointerup" && to !== from) onDrop(from, to);
        onEnd();
      };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
}
function startReorder(e,g,row,list,onDrop,onEnd=()=>{}) {
      e.preventDefault();
      if (list.classList.contains("cols")) return startGridReorder(e,g,row,list,onDrop,onEnd);
      const rows = [...list.children], from = rows.indexOf(row), rc = rows.map((r) => r.getBoundingClientRect()), y0 = e.clientY;
      const gap = rows.length > 1 ? Math.max(0, rc[1].top - rc[0].bottom) : 0, step = rc[from].height + gap, lo = rc[0].top - rc[from].top, hi = rc[rows.length - 1].top - rc[from].top;
      let to = from;
      try { g.setPointerCapture(e.pointerId); } catch (_) {}
      row.classList.add("drag"); list.classList.add("dragging");
      const move = (ev) => {
        const dy = Math.min(hi, Math.max(lo, ev.clientY - y0)); row.style.transform = `translateY(${dy}px)`;
        const mid = rc[from].top + rc[from].height / 2 + dy; to = from;
        rc.forEach((r, i) => { const mc = r.top + r.height / 2; /* the drag is clamped so the row's middle can at best reach the first/last row's middle: that must count (otherwise the first and last positions are unreachable) */ if (i < from && mid < mc + 1) to = Math.min(to, i); if (i > from && mid > mc - 1) to = Math.max(to, i); });
        rows.forEach((r, i) => { if (i === from) return; r.style.transform = to < from && i >= to && i < from ? `translateY(${step}px)` : to > from && i > from && i <= to ? `translateY(${-step}px)` : ""; });
      };
      const end = (ev) => {
        g.removeEventListener("pointermove", move); g.removeEventListener("pointerup", end); g.removeEventListener("pointercancel", end);
        try { g.releasePointerCapture(e.pointerId); } catch (_) {}
        rows.forEach((r) => { r.style.transform = ""; }); row.classList.remove("drag"); list.classList.remove("dragging");
        if (ev.type === "pointerup" && to !== from)onDrop(from,to);
        onEnd();
      };
      g.addEventListener("pointermove", move); g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
}

function haCalendarDay(now, timezone, offset=0) {
  if(!timezone)return NaN;
  const fields=(stamp,withTime=false)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,...(withTime?{hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}:{}),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(stamp)).map(part=>[part.type,part.value]));
  const today=fields(now),date=new Date(Date.UTC(+today.year,+today.month-1,+today.day+offset)),target=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
  let guess=target;for(let i=0;i<3;i++){const local=fields(guess,true);guess+=target-Date.UTC(+local.year,+local.month-1,+local.day,+local.hour,+local.minute,+local.second);}
  return guess;
}

function haFmt(hass) {
  const l = (hass && hass.locale) || {}, lang = l.language || (hass && hass.language) || "en", tf = l.time_format || "language", df = l.date_format || "language";
  const tz = hass?.config?.time_zone, tl = tf === "system" ? undefined : lang, dl = df === "system" ? undefined : lang;
  if(!tz)return {hm:()=>"—",dm:()=>"—",wdm:()=>"—",wdh:()=>"—",date:()=>"—",timeZone:undefined,dayStart:()=>NaN,hour:()=>NaN};
  const hm = (t, seconds=false) => { const o = { hour: tf === "12" ? "numeric" : "2-digit", minute: "2-digit" }; if(seconds===true)o.second="2-digit"; if (tz) o.timeZone = tz; if (tf === "12") o.hour12 = true; else if (tf === "24") { o.hourCycle = "h23"; } try { return new Date(t).toLocaleTimeString(tl, o); } catch (_) { return ""; } };
  const dm = (t, long) => { const o = { day: "numeric", month: long ? "long" : "short" }; if (tz) o.timeZone = tz;
    try { const p = new Intl.DateTimeFormat(dl, o).formatToParts(new Date(t)), d = (p.find((x) => x.type === "day") || {}).value, m = (p.find((x) => x.type === "month") || {}).value;
      if (d && m && (df === "MDY" || df === "YMD")) return `${m} ${d}`; if (d && m && df === "DMY") return `${d} ${m}`; return new Intl.DateTimeFormat(dl, o).format(new Date(t)); } catch (_) { return ""; } };
  const wdm = (t) => { try { return `${new Intl.DateTimeFormat(dl, tz ? { weekday: "long", timeZone: tz } : { weekday: "long" }).format(new Date(t))}, ${dm(t, true)}`; } catch (_) { return dm(t, true); } };
  const wdh = (t) => { try { return `${new Intl.DateTimeFormat(dl, tz ? { weekday: "short", day: "numeric", timeZone: tz } : { weekday: "short", day: "numeric" }).format(new Date(t))} ${hm(t)}`; } catch (_) { return hm(t); } };
  const date=(t)=>{const options={day:'2-digit',month:'2-digit',year:'numeric',...(tz?{timeZone:tz}:{})};try{const formatter=new Intl.DateTimeFormat(dl,options),parts=formatter.formatToParts(new Date(t)),get=type=>parts.find(part=>part.type===type)?.value||'';return df==='DMY'?`${get('day')}/${get('month')}/${get('year')}`:df==='MDY'?`${get('month')}/${get('day')}/${get('year')}`:df==='YMD'?`${get('year')}/${get('month')}/${get('day')}`:formatter.format(new Date(t));}catch(_){return '';}};
  return { hm, dm, wdm, wdh, date, timeZone:tz, dayStart:(t,offset=0)=>haCalendarDay(t,tz,offset), hour:t=>Number(new Intl.DateTimeFormat("en",{hour:"numeric",hourCycle:"h23",...(tz?{timeZone:tz}:{})}).format(new Date(t))) };
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
  dash_off: "Dashboard (drawn airflow)",
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
  plan: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
  poweron: "<path d=\"M12 3v9M7 5.5a8 8 0 1 0 10 0\"/><circle class=\"k\" cx=\"19\" cy=\"19\" r=\"3\"/>",
  poweroff: "<path d=\"M12 3v9M7 5.5a8 8 0 1 0 10 0M3 3l18 18\"/>",
  wallbox: "<rect x=\"5\" y=\"3\" width=\"12\" height=\"18\" rx=\"2\"/><path d=\"M17 8h2l2 2v7a2 2 0 0 1-4 0M8 18h6\"/><path class=\"a\" d=\"M12 6 8 12h3l-1 4 5-7h-3z\"/>",
  solar: "<path d=\"M5 13h14l2 8H3zM9 13l-1 8M15 13l1 8M4 17h16M12 2v2M4 5l2 2M20 5l-2 2\"/><path class=\"a\" d=\"M8 10a4 4 0 0 1 8 0z\"/>",
  garage: "<path d=\"m2 10 10-7 10 7M4 9v12h16V9M7 21V11h10v10M7 14h10M7 17h10\"/>",
  trip: "<circle cx=\"6\" cy=\"5\" r=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\"/><path d=\"M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8\"/>",
  pin: "<path d=\"M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z\"/><circle class=\"a\" cx=\"12\" cy=\"10\" r=\"2.5\"/>",
  timer: "<circle cx=\"12\" cy=\"14\" r=\"8\"/><path d=\"M9 2h6M12 2v4M18 5l2 2M12 9v5l3 2\"/>",
  precond: '<path style="fill:currentColor;stroke:none" transform="translate(1 3.273) scale(0.03051)" fill-rule="evenodd" d="M46 548 L46 557 L48 562 L51 566 L61 571 L618 571 L627 567 L631 562 L633 557 L633 548 L630 542 L625 537 L617 534 L292 534 L291 535 L280 535 L279 534 L62 534 L54 537 L48 543 Z M506 0 L498 4 L492 12 L491 17 L491 65 L490 66 L470 55 L453 43 L442 39 L430 42 L425 47 L422 54 L423 65 L429 73 L478 104 L483 106 L491 112 L491 140 L492 141 L492 151 L491 152 L491 214 L489 215 L479 210 L474 206 L457 197 L389 156 L380 155 L371 159 L365 167 L364 177 L366 183 L372 190 L402 207 L410 213 L419 217 L447 235 L469 247 L470 249 L373 303 L367 309 L365 313 L364 323 L366 329 L373 336 L377 338 L388 338 L413 325 L452 302 L478 289 L489 282 L491 283 L491 366 L485 371 L470 379 L428 405 L424 410 L422 416 L422 424 L425 431 L429 435 L435 438 L446 438 L457 432 L465 426 L489 413 L490 414 L490 469 L491 473 L497 481 L503 484 L511 485 L520 481 L524 477 L527 471 L527 457 L528 456 L527 453 L527 434 L528 433 L528 415 L529 414 L544 422 L567 438 L574 441 L583 441 L589 438 L594 433 L597 423 L596 416 L594 412 L589 407 L540 376 L528 367 L528 283 L529 282 L538 286 L548 293 L559 298 L612 329 L616 383 L620 392 L623 395 L632 399 L641 398 L646 395 L652 387 L653 384 L652 362 L651 361 L651 351 L652 350 L697 375 L709 374 L713 372 L718 366 L720 362 L720 351 L718 347 L709 339 L686 327 L670 317 L672 315 L706 299 L711 294 L714 287 L714 280 L712 274 L708 269 L700 265 L691 265 L656 282 L654 282 L632 294 L628 294 L612 284 L601 279 L594 274 L566 259 L559 254 L552 251 L550 248 L629 205 L688 237 L699 238 L705 236 L709 233 L714 224 L714 216 L712 210 L705 203 L672 186 L670 183 L711 161 L716 156 L718 152 L719 142 L717 137 L712 131 L704 128 L698 128 L680 136 L655 150 L654 149 L654 143 L655 142 L658 117 L659 116 L658 105 L656 101 L649 95 L641 93 L635 94 L627 99 L622 109 L622 115 L620 122 L620 128 L619 129 L619 135 L618 136 L618 142 L617 143 L613 171 L610 174 L529 217 L528 216 L528 113 L538 105 L543 103 L592 72 L597 64 L598 55 L595 47 L590 42 L586 40 L578 39 L567 43 L529 67 L528 66 L528 14 L527 11 L520 3 L513 0 Z M243 0 L236 2 L228 10 L208 47 L199 61 L194 72 L181 93 L177 101 L176 111 L179 118 L183 122 L189 125 L222 125 L224 127 L225 146 L230 168 L236 183 L258 224 L264 241 L266 251 L266 265 L262 284 L254 301 L230 337 L218 359 L213 371 L208 394 L208 421 L212 440 L218 456 L229 476 L238 487 L247 491 L256 491 L265 487 L271 480 L273 475 L273 463 L271 458 L262 445 L254 426 L252 417 L253 395 L256 384 L263 368 L289 327 L299 307 L306 287 L307 277 L308 276 L308 268 L309 267 L308 242 L303 220 L297 205 L288 187 L283 180 L273 159 L268 144 L267 127 L269 125 L302 125 L305 124 L313 117 L315 111 L315 104 L310 93 L294 67 L290 58 L285 51 L262 9 L256 3 L252 1 Z M67 0 L56 5 L51 12 L46 23 L42 28 L20 69 L7 90 L1 102 L1 107 L0 108 L2 116 L10 124 L13 125 L46 125 L49 127 L50 144 L55 165 L64 186 L84 221 L90 237 L92 247 L92 266 L87 285 L74 309 L57 332 L47 348 L39 364 L32 391 L32 417 L33 418 L34 428 L37 439 L47 461 L56 475 L65 486 L75 491 L85 491 L93 487 L98 482 L101 475 L101 462 L98 456 L84 437 L78 423 L76 415 L76 393 L80 381 L88 365 L113 329 L126 305 L134 280 L135 264 L136 263 L135 241 L130 219 L114 185 L99 159 L93 141 L92 127 L96 125 L127 125 L131 123 L138 115 L139 103 L86 8 L81 3 L77 1 Z"/>',
  wifi: "<path d=\"M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0\"/><circle class=\"k\" cx=\"12\" cy=\"20\" r=\"1\"/>",
  shield: "<path d=\"m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z\"/><path class=\"a\" d=\"m8 12 3 3 5-6\"/>",
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
const CUSTOM_TAPS=[['more-info','More info'],['toggle','Toggle'],['turn_on','Turn on'],['turn_off','Turn off'],['press','Press'],['navigate','Navigate'],['url','Open URL'],['none','None']];
const customTapCode=cfg=>cfg?.action==='perform-action'?String(cfg.perform_action||cfg.service||'').split('.').at(-1):cfg?.action||'more-info';
function buildCustomTapConfig(code,entity,target='',path=''){
  target=target.trim();path=path.trim();if(target&&!/^[a-z_]+\.[\w]+$/.test(target))throw Error(T('Enter a valid entity_id'));
  const id=target||entity;
  if(['turn_on','turn_off','press'].includes(code))return {action:'perform-action',perform_action:(code==='press'?id.split('.')[0]:'homeassistant')+'.'+code,target:{entity_id:id}};
  if(code==='toggle')return {action:'toggle',entity:id};
  if(code==='navigate'){if(!/^\/(?!\/)/.test(path))throw Error(T('Enter a navigation path starting with /.'));return {action:code,navigation_path:path};}
  if(code==='url'){if(!/^(https?:\/\/|\/(?!\/))/i.test(path))throw Error(T('Enter an http(s) URL or a local path.'));return {action:code,url_path:path};}
  return {action:code==='none'?'none':'more-info'};
}

function customTapConfig(code,entity,target='',path='',confirmation=false){const cfg=buildCustomTapConfig(code,entity,target,path);if(confirmation&&['toggle','turn_on','turn_off','press'].includes(code))cfg.confirmation=true;return cfg;}
const PICKABLE_ICONS = [
  "poweron", "poweroff", "wallbox", "solar", "garage", "trip", "pin", "timer", "wifi", "shield",
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
  /* Local clock time HH:MM. */
  clock(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); },
  /* Charging target (advisory). Returns the goal, whether it is already reached and, while charging, an estimated time to reach it. The estimate assumes the car's remaining time runs to 100 % at a steady rate; charging slows near the top, so it is never a promise. Null when no goal is set. */
  chargeTarget(battery, charging, remaining, target, now = Date.now()) {
    const goal = Number(target), pct = Number(battery), m = /^(\d+):(\d{1,2})/.exec(String(remaining || ""));
    if (!Number.isFinite(goal) || goal < 50 || goal > 100 || battery === null || battery === undefined || !Number.isFinite(pct)) return null;
    const level = Math.min(100, Math.max(0, pct)), reached = level >= goal;
    let eta = null;
    if (charging && !reached && level < 100 && m) {
      const minutes = (Number(m[1]) * 60 + Number(m[2])) * (goal - level) / (100 - level);
      if (minutes > 0) eta = new Date(now + minutes * 60000);
    }
    return { goal, reached, eta };
  },
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
  /* a spring set by damping ratio (z) and response time in seconds (r): it always continues from the current
     position and speed, so an animation can be interrupted or taken over by a finger at any moment */
  spring(paint, alive) {
    const s = { x: 0, v: 0, to: 0, z: 1, r: 0.35, run: false, t: 0, done: null };
    const tick = (t) => {
      if (!s.run) return;
      if (alive && !alive()) { s.run = false; const d = s.done; s.done = null; if (d) d(); return; } /* removed from the page: stop and let go */
      const dt = Math.min(0.05, (t - s.t) / 1000); s.t = t;
      const w = (2 * Math.PI) / Math.max(0.05, s.r), k = w * w, c = 2 * s.z * w, n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) { const a = -k * (s.x - s.to) - c * s.v; s.v += a * h; s.x += s.v * h; }
      paint(s.x);
      if (Math.abs(s.x - s.to) < 0.5 && Math.abs(s.v) < 20) { s.x = s.to; s.v = 0; s.run = false; paint(s.x); const d = s.done; s.done = null; if (d) d(); return; }
      requestAnimationFrame(tick);
    };
    s.set = (x) => { s.run = false; s.x = x; s.v = 0; paint(x); };
    s.stop = () => { s.run = false; };
    s.go = (to, o = {}) => { s.to = to; s.z = o.z ?? 1; s.r = o.r ?? 0.35; if (o.v !== undefined) s.v = o.v; s.done = o.done || null; if (!s.run) { s.run = true; s.t = performance.now(); requestAnimationFrame(tick); } };
    return s;
  },
  /* resistance past an edge: the further you pull, the less it follows */
  band(d, dim) { return (1 - 1 / ((d * 0.55) / dim + 1)) * dim; },
  /* where a flick would come to rest (pixels), from its speed in px/s */
  project(v, rate = 0.99) { return ((v / 1000) * rate) / (1 - rate); },
  /* toggles across a rebuild: a picked tile or switch that changed is drawn in its old state first, so its
     tick and knob animate to the new state on the new element instead of appearing at once */
  flipKey(n) { return [...n.attributes].filter((x) => x.name.startsWith("data-")).map((x) => x.name + "=" + x.value).join("&"); },
  flipSnap(root) { const m = new Map(); root.querySelectorAll("button[aria-pressed]").forEach((n) => { const k = UI.flipKey(n); if (k) m.set(k, n.getAttribute("aria-pressed")); }); return m; },
  /* call flipPrime right after the rebuild, before anything measures the layout, and flipRun at the end */
  flipPrime(root, snap) {
    if (!snap || !snap.size) return null;
    const changed = [];
    root.querySelectorAll("button[aria-pressed]").forEach((n) => { const k = UI.flipKey(n), was = snap.get(k), now = n.getAttribute("aria-pressed"); if (k && was !== undefined && was !== now) changed.push([n, was, now]); });
    changed.forEach(([n, was]) => UI.flipPaint(n, was));
    return changed.length ? changed : null;
  },
  flipRun(changed) {
    if (!changed) return;
    changed.forEach(([n]) => [n, ...n.querySelectorAll("*")].forEach((e) => { void getComputedStyle(e).transform; void getComputedStyle(e, "::after").transform; }));
    changed.forEach(([n, , now]) => UI.flipPaint(n, now));
  },
  flipPaint(n, v) { const on = v === "true"; n.setAttribute("aria-pressed", v); n.classList.toggle("on", on); n.querySelector(":scope > .sw")?.classList.toggle("on", on); },


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

/* One shared loading animation: a spinning ring with the screen's icon in the middle. The icon styling is part of the loader, so it also draws where the card's own stylesheet is not loaded (Settings). */
const LOADER_CSS = `.ldr.dc-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px 20px;color:var(--ds-fg2,var(--secondary-text-color));font-size:13.5px}.dc-loader .dc-loader-ring{position:relative;display:grid;place-items:center;flex:none;width:95.2px;height:95.2px}.dc-loader .dc-loader-ring::before{content:none}.dc-loader .i{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.dc-loader .i .a{fill:currentColor;fill-opacity:.2}.dc-loader .dc-loader-ring .dc-loader-arc{position:absolute;inset:0;width:100%;height:100%;animation:ds-spin 1.1s linear infinite}.dc-loader .dc-loader-ring .i{--is:40.8px;width:40.8px;height:40.8px;position:relative;color:rgb(var(--ds-ac,var(--ds-ok,52,211,153)));animation:dc-pulse 1.4s ease-in-out infinite}.dc-loader-initials{position:relative;font-family:"Segoe Script","Brush Script MT","Apple Chancery",cursive;font-size:34px;font-weight:600;font-style:italic;letter-spacing:-5px;padding-right:5px;line-height:1;transform:rotate(-9deg);color:rgb(var(--ds-ac))}@keyframes ds-spin{to{transform:rotate(360deg)}}@keyframes dc-pulse{0%,100%{transform:scale(.88);opacity:.7}50%{transform:scale(1.12);opacity:1}}@media(prefers-reduced-motion:reduce){.dc-loader .dc-loader-ring .dc-loader-arc,.dc-loader .dc-loader-ring .i{animation:none}}`;
const loaderHtml = (icon, initials=false) => `<div class="ldr dc-loader" role="status"><span class="ring dc-loader-ring"><svg class="arc dc-loader-arc" viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="27" fill="none" stroke="var(--ds-line,var(--divider-color))" stroke-width="3"/><circle cx="31" cy="31" r="27" fill="none" stroke="rgb(var(--ds-ac,var(--ds-ok,52,211,153)))" style="stroke:rgb(var(--ds-ac,var(--ds-ok,52,211,153)))" stroke-width="3" stroke-linecap="round" stroke-dasharray="46 124"/></svg>${initials?'<span class="dc-loader-initials" aria-hidden="true">LK</span>':ico(icon)}</span><span>${esc(T("Loading…"))}</span></div>`;
/* Neon city: the car is lit and grounded by the scene. Built from the car's own base image, so the effects follow its real outline:
   below the car: a cast shadow squashed onto the ground, contact shadows under the tyres, a faint reflection on the wet road and neon streaks;
   the car itself is left untouched. Shown only while the background is a Neon city. */
const NFX = {
  iso: { w: 750, h: 500, o: [372, 384], k: -0.25, ao: [[372, 384, 84, 13], [618, 322, 68, 11]], band: [495, 353, 165, 14], streak: [[110, 150], [655, 105]] },
  carga: { w: 750, h: 500, o: [190, 348], k: 0, ao: [[190, 348, 78, 12], [547, 348, 78, 12]], band: [368, 348, 205, 11], streak: [[80, 110], [655, 110]] },
  top: { w: 750, h: 750 }
};
const nfxGround = (kind, href) => {
  const g = NFX[kind], p = "nf-" + kind, u = esc(href), W = g.w, H = g.h;
  const sh = `<filter id="${p}-sh" x="-15%" y="-25%" width="130%" height="170%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.7 0"/><feGaussianBlur stdDeviation="${kind === "top" ? 9 : 4.5}"/></filter>`;
  if (kind === "top") return `<svg class="nfx nfx-g nfx-top" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>${sh}<filter id="${p}-sh2" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 0"/><feGaussianBlur stdDeviation="3"/></filter></defs><image class="nf-sh" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none" filter="url(#${p}-sh)"/><image class="nf-sh2" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none" filter="url(#${p}-sh2)"/></svg>`;
  const [ox, oy] = g.o, k = g.k, D = 70, ang = Math.round(Math.atan(k) * 1800 / Math.PI) / 10;
  const rg = `<linearGradient id="${p}-rg" gradientUnits="userSpaceOnUse" x1="${ox}" y1="${oy}" x2="${ox - k * D}" y2="${oy + D}"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#7a7a7a"/><stop offset="1" stop-color="#000"/></linearGradient><mask id="${p}-rm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${p}-rg)"/></mask>`;
  const rf = `<filter id="${p}-rf" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".55"/><feGaussianBlur stdDeviation="1.5"/></filter>`;
  const ao = `<filter id="${p}-ao" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>`;
  const tint = "0 0 0 0 .05 0 0 0 0 .01 0 0 0 0 .14 0 0 0 1 0", fu = `filterUnits="userSpaceOnUse" x="-250" y="-250" width="${W + 500}" height="${H + 500}"`;
  const sf = `<filter id="${p}-ss" ${fu} color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${tint}"/><feGaussianBlur stdDeviation="11"/></filter><filter id="${p}-sc" ${fu} color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${tint}"/><feGaussianBlur stdDeviation="3.5"/></filter>`
    + [["hf", "#737373"], ["hn", "#000"]].map(([n, c]) => `<linearGradient id="${p}-${n}g" gradientUnits="userSpaceOnUse" x1="0" y1="${oy}" x2="0" y2="30"><stop offset="0" stop-color="#fff"/><stop offset="${n === "hn" ? .5 : 1}" stop-color="${c}"/></linearGradient><mask id="${p}-${n}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#${p}-${n}g)"/></mask>`).join("");
  const st = `<filter id="${p}-st" x="-200%" y="-30%" width="500%" height="160%"><feGaussianBlur stdDeviation="7 2"/></filter>`;
  const ell = g.ao.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join("") + `<ellipse cx="${g.band[0]}" cy="${g.band[1]}" rx="${g.band[2]}" ry="${g.band[3]}" transform="rotate(${ang} ${g.band[0]} ${g.band[1]})"/>`;
  const streaks = g.streak.map(([x, len], i) => `<rect class="nf-st nf-st${i + 1}" x="${x}" y="${Math.round(oy + k * (x - ox)) + 6}" width="22" height="${len}" rx="11"/>`).join("");
  return `<svg class="nfx nfx-g" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" style="--ox:${ox}px;--oy:${oy}px;--k:${k}"><defs>${rf}${ao}${st}${rg}${sf}</defs>`
    + `<g filter="url(#${p}-st)">${streaks}</g>`
    + `<g mask="url(#${p}-rm)"><image class="nf-rf" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none" filter="url(#${p}-rf)" transform="translate(${ox} ${oy}) matrix(1 ${2 * k} 0 -1 0 0) translate(${-ox} ${-oy})"/></g>`
    + `<g filter="url(#${p}-ss)"><image class="nf-sh" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none" mask="url(#${p}-hf)"/></g>`
    + `<g filter="url(#${p}-sc)"><image class="nf-sh nf-shn" href="${u}" width="${W}" height="${H}" preserveAspectRatio="none" mask="url(#${p}-hn)"/></g>`
    + `<g class="nf-ao" filter="url(#${p}-ao)">${ell}</g></svg>`;
};
const nfxLight = (kind, href) => {
  const g = NFX[kind]; if (!g || kind === "top") return "";
  const p = "nl-" + kind, u = esc(href);
  return `<svg class="nfx nfx-l" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="${p}-rim" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="erode" radius="3" result="in"/><feComposite in="SourceAlpha" in2="in" operator="out" result="edge"/><feGaussianBlur in="edge" stdDeviation="1.6" result="e"/><feFlood class="nl-c1" result="c1"/><feComposite in="c1" in2="e" operator="in"/></filter><linearGradient id="${p}-gd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="nl-s1"/><stop offset=".45" stop-opacity="0" class="nl-s1"/><stop offset=".6" stop-opacity="0" class="nl-s2"/><stop offset="1" class="nl-s2"/></linearGradient><mask id="${p}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="${g.w}" height="${g.h}"><image href="${u}" width="${g.w}" height="${g.h}" preserveAspectRatio="none" filter="url(#${p}-wh)"/></mask><filter id="${p}-wh" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs><rect class="nl-wash" width="${g.w}" height="${g.h}" fill="url(#${p}-gd)" mask="url(#${p}-m)"/></svg>`;
};
/* English source keys; secondary translations load from lang/<code>.js. */
const LANGS = (window.__DEEPAL_COMPANION_LANGS = window.__DEEPAL_COMPANION_LANGS || {});
const GL = "A-Za-z\u00C0-\u024F\u0370-\u03FF\u1F00-\u1FFF";
const I18N = {
  lang: "en", wanted: null, ready: true, dict: null, re: null, subs: new Set(), roots: new Map(), extras: {},
  rec: new WeakMap(), arec: new WeakMap(), memo: new Map(), attrs: ["title", "aria-label", "placeholder", "alt"],
  norm(c) { return String(c || "en").toLowerCase().replace("_", "-"); },
  numLocale() { return this.lang === "el" ? "el-GR" : this.lang; },
  _load(code) {
    return new Promise((res) => {
      if (LANGS[code]) return res(true);
      const s = document.createElement("script");
      s.src = `${SCRIPT_BASE}lang/${code}.js?v=${CARD_VERSION}&rev=20261126-01`; s.async = true;
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
    // "_" joins the parts of an identifier (hero_off.jpg, sensor.s05_trunk): never translate inside one.
    this.re = keys.length ? new RegExp(`(?<![${GL}_])(?:${keys.join("|")})(?![${GL}_])`, "g") : null;
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
    // A file name, folder, entity or icon id shown as a hint is not text: leave it as it is.
    if (this.dict[s] === undefined && /^[\w.\/:-]+$/.test(s) && /[\/_:]|\.\w/.test(s)) return s;
    let o = this.memo.get(s);
    if (o === undefined) { o = s.replace(this.re, (m) => this.dict[m]); if (this.memo.size > 3000) this.memo.clear(); this.memo.set(s, o); }
    return o;
  },
  t(s, a) { let o = (this.tdict && this.tdict[s]) ?? s; return a && a.length ? o.replace(/\{(\d+)\}/g, (m, i) => (a[i] ?? "")) : o; },
  text(n) {
    if(n.parentElement?.closest("[data-ha-name]"))return;
    if (!this.re && !this.rec.has(n)) return;
    const cur = n.nodeValue, r = this.rec.get(n), src = r && r.out === cur ? r.src : cur;
    if (!r && !LETTER.test(cur)) return;
    const out = this.tr(src); this.rec.set(n, { src, out }); if (out !== cur) n.nodeValue = out;
  },
  attr(el, name) {
    if (!this.re && !this.arec.has(el)) return;
    const cur = el.getAttribute(name); if (cur == null) return;
    const m = this.arec.get(el) || {}, r = m[name], src = r && r.out === cur ? r.src : cur;
    if (!r && !LETTER.test(cur)) return;
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
const LETTER = new RegExp(`[${GL}]`);
const T = (s, ...a) => I18N.t(s, a);
/* Error text from Home Assistant or the backend is English. It is shown translated when the exact text is a dictionary key,
   or "Name: value" with a known "Name: {0}" key; otherwise the text is returned unchanged (English). */
const tError = (message) => {
  const text = typeof message === "string" ? message : String(message ?? "");
  if (!text || !I18N.tdict) return text;
  if (I18N.tdict[text] !== undefined) return I18N.t(text, []);
  const at = text.indexOf(": ");
  if (at > 0 && I18N.tdict[text.slice(0, at) + ": {0}"] !== undefined) return I18N.t(text.slice(0, at) + ": {0}", [text.slice(at + 2)]);
  return text;
};

/* English source language metadata. {0}, {1} are values the card inserts. */
(window.__DEEPAL_COMPANION_LANGS = window.__DEEPAL_COMPANION_LANGS || {}).en = {name:"English",dict:{}};
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
const WIN_SPEED = 100 / 1600; // how fast the drawn window glass moves: the real windows travel fully in about 1.5 s (measured from the opening sensor history)
const WIN_REAR_TRAVEL = 0.64; // the rear glass does not go all the way down: at 100% about 64% of it is gone
const FAR_ALERT = 0.55; // opacity of the red on the windows of the far side
/* Window openings in the 3/4 view: per window and door state (c = door closed, o = door open), 21 columns of [x, top y, bottom y] of the glass in layer coordinates (750×500). A window that is open by a share is cut along these: the lowered glass stays in the lower part, the opening at the top is red. */
const WIN_ISO = {"front_left":{"c":[[433,180,189],[437,175,201],[441,169,200],[445,163,199],[449,158,198],[453,154,198],[457,150,197],[461,146,196],[465,144,195],[469,142,195],[472,140,194],[476,139,194],[480,138,193],[484,137,192],[488,136,191],[492,136,191],[496,135,190],[500,135,189],[504,137,188],[508,157,188],[512,186,187]],"o":[[460,181,182],[467,177,183],[474,172,197],[481,167,197],[489,162,197],[496,158,197],[503,154,196],[510,151,196],[517,147,195],[524,145,195],[532,142,194],[539,140,194],[546,138,193],[553,137,193],[560,136,192],[567,134,191],[574,134,191],[582,132,190],[589,132,178],[596,131,154],[603,130,132]]},"front_right":{"c":[[267,178,178],[272,169,187],[277,165,186],[282,161,185],[287,158,184],[292,154,183],[297,151,183],[302,148,182],[307,145,181],[312,142,180],[317,140,180],[322,138,179],[327,136,178],[332,134,177],[337,133,177],[342,132,176],[347,131,167],[352,130,156],[357,129,147],[362,129,138],[367,128,130]],"o":[[204,162,166],[206,153,167],[208,145,167],[210,138,167],[212,132,167],[214,126,167],[216,121,166],[218,117,166],[220,119,166],[222,120,166],[224,121,166],[225,122,167],[227,123,168],[229,125,170],[231,127,173],[233,129,182],[235,132,183],[237,138,185],[239,145,181],[241,156,170],[243,166,168]]},"rear_left":{"c":[[510,134,135],[514,134,146],[517,133,155],[521,133,173],[524,133,185],[528,133,184],[532,133,184],[535,133,183],[539,133,182],[542,133,182],[546,133,181],[550,133,180],[553,133,180],[557,134,179],[560,134,178],[564,135,177],[568,141,176],[571,147,175],[575,155,174],[578,162,172],[582,170,170]],"o":[[539,185,185],[545,146,184],[550,133,183],[556,132,183],[562,132,183],[568,132,182],[574,131,182],[579,131,181],[585,130,180],[591,131,180],[596,130,179],[602,130,178],[608,130,178],[614,130,177],[620,130,176],[625,130,175],[631,130,174],[637,131,173],[642,131,172],[648,148,171],[654,169,170]]},"rear_right":{"c":[[357,173,175],[361,162,174],[364,154,174],[368,144,173],[372,136,173],[376,129,172],[380,128,172],[383,127,171],[387,127,171],[391,127,170],[394,127,169],[398,127,169],[402,127,168],[406,127,167],[410,127,166],[413,127,165],[417,127,164],[421,128,164],[424,128,163],[428,129,156],[432,129,135]],"o":[[315,152,154],[317,148,156],[320,142,158],[322,138,160],[325,132,162],[327,129,163],[330,124,165],[332,121,166],[335,121,168],[337,121,169],[340,122,170],[342,122,171],[344,122,172],[347,123,174],[349,123,168],[352,124,158],[354,124,152],[357,125,144],[359,126,139],[362,126,132],[364,127,128]]}};
const CARGA_PTS = [[705, 370], [677, 365], [640, 359], [613, 353], [597, 347], [588, 338], [583, 325], [580, 310], [578, 295], [576, 278], [574, 262], [572, 248], [570, 238]];
const CARGA_PORT = [566, 236];
/* Door handles that light up amber when the vehicle is unlocked: [door, x, y, angle] in layer coordinates (3/4: 750×500, visible side only; top view: 750×750, all 4 doors) */
const HDL_ISO = [["front_left", 505, 207, -12], ["rear_left", 577, 191.5, -12]];
const HDL_TOP = [["front_left", 266, 395], ["rear_left", 266, 515], ["front_right", 484, 395], ["rear_right", 484, 515]];
/* Turn signals (3/4 view, layer coordinates 750×500): the far-side corner lamp (a small line with a little haze), the left mirror (moves when the front left door is open) and the far-side mirror (only visible when the front right door is open). The white daylight line (position lamp) flashes through the .amb mask layer, the rear lamp glow is drawn behind the car. d = path, dOpen = path with the door open, door = sensor that moves the strip, show = sensor that must be on for the strip to be visible, haze = soft glow around the strip */
const TURN_ISO = [
  { k: "right", d: "M129 224.8 L125.9 236.3", w: 1.8, haze: '<ellipse cx="127.4" cy="230.5" rx="5.5" ry="10" fill="rgb(255,160,40)" fill-opacity=".38" transform="rotate(15 127.4 230.5)" style="filter:blur(2.6px)"/>' },
  { k: "left", d: "M455 196 L483 193.5", dOpen: "M448 199.6 L464 198.2", door: "binary_sensor.front_left_door", w: 2 },
  { k: "right", d: "M202.5 180.8 L214 182.8", show: "binary_sensor.front_right_door", w: 2 },
];
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
  charge_plan: ["switch.charge_schedule", "Charge plan", "plan", null], /* tap opens the charge plan window */
  charger_limit: ["sensor.charger_limit", "Charger limit", "bolt", null], /* not an entity: a tile built by _clTile, drawn only while the charger limit is on */
};
const INFO_IDS = Object.keys(INFO_ITEMS);

const OTHER_KEYS = [
  "lock.doors", "sensor.battery_level", "sensor.remaining_range", "sensor.fuel_range", "sensor.inside_temperature",
  "sensor.last_updated", "sensor.remaining_charge_time_h_mm", "sensor.ac_charge_current", "sensor.charge_current",
  "sensor.dc_charge_current", "sensor.charging_type", "sensor.license_plate", "binary_sensor.charging",
  "binary_sensor.charger_plugged", "binary_sensor.cloud_connection", "binary_sensor.position_lamp",
  "binary_sensor.low_beam", "binary_sensor.high_beam", "sensor.front_left_window_opening", "sensor.front_right_window_opening", "sensor.rear_left_window_opening", "sensor.rear_right_window_opening", "binary_sensor.left_turn_signal", "binary_sensor.right_turn_signal", "binary_sensor.climate_on", "cover.windows", "cover.trunk",
  "climate.cabin_climate", "button.honk_horn", "button.flash_lights", "button.flash_lights_and_honk",
  "button.refresh_vehicle_data", "switch.steering_wheel_heating",
  "binary_sensor.steering_wheel_heater",
  ...["front_left", "front_right", "rear_left", "rear_right"].flatMap((p) => [`sensor.${p}_tire_pressure`]),
  ...["front_left", "front_right"].flatMap((p) => [`number.${p}_seat_heating_level`, `number.${p}_seat_ventilation_level`]),
];
const TIRES = [ // bx/by: value box centre on the top-view image (%); tx/ty: wheel position on it (%)
  { id: "front_left", bx: 17, by: 26, tx: 34.5, ty: 26, name: "Front left" },
  { id: "front_right", bx: 83, by: 26, tx: 65.5, ty: 26, name: "Front right" },
  { id: "rear_left", bx: 17, by: 73, tx: 34.5, ty: 73, name: "Rear left" },
  { id: "rear_right", bx: 83, by: 73, tx: 65.5, ty: 73, name: "Rear right" },
];
/* Car View: layers 750×500 (source: github.com/manuelem1984/dec_deepal, MIT) */
/* Theme colour options: [id, label, dark rgb, light rgb, text on accent (dark), text on accent (light), hue shift in degrees and saturation for the pre-rendered green charging images].
   Generated from source/colour-tokens.json by scripts/build-tokens.cjs; do not edit here. */
/*accents:begin*/const ACCENTS = [
  ["green", "Green", "52,211,153", "52,211,153", "11,21,16", "11,21,16",0],
  ["blue", "Ocean blue", "0,145,255", "0,92,190", "6,26,40", "255,255,255",48],
  ["violet", "Violet", "160,105,255", "105,35,210", "26,14,52", "255,255,255",104],
  ["amber", "Amber", "255,191,0", "200,120,0", "38,24,4", "38,24,4",-113],
  ["rose", "Rose", "255,50,125", "205,15,95", "46,10,28", "255,255,255",180],
  ["cyan", "Cyan", "0,200,235", "0,115,140", "4,30,36", "255,255,255",31],
  ["lime", "Lime", "130,225,0", "95,155,0", "20,32,4", "20,32,4",-73],
  ["coral", "Coral", "255,99,71", "200,55,20", "46,16,8", "255,255,255",-149],
  ["orange", "Orange", "255,140,0", "190,84,0", "40,18,0", "255,255,255",-125],
];/*accents:end*/
const CAR_COLORS = [["black", "Black", "#1b1c22"], ["blue", "Blue", "#4a86b8"], ["grey", "Grey", "#6b6d72"], ["silver", "Silver", "#b9bcc0"], ["white", "White", "#f1f2f4"]];
const VIEW_ICON = { iso: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAAA5CAYAAADut6/vAAAWJUlEQVR42t1cW49k11X+zq2qq/o2fZvOONMzHs+M7ZgZ2/EFAnaAQBBCKCKREjkPETwgRMQD8AjvSPAXeCAREhI3cVF4gIDkcHFsB5PY8XVsPLbn2tPtnp6u7rqfOmfzMN+Svlk5VT34Mh6npFKdqjpnn7332mutb31r7ROFEPAxfEX8HNf5BEADwBSAOj9rAJp8pwBW5PyY/9cBTLP9lJ8F332+e+6+V/i9x3cfwMB9L29iPO9JENHHTIB+oBmARQpjAcAhCmNaBJKIIBK+tb2Sbzsn8Djn9yl+RlwUDbZb5/2tHwnPgxP6AECHx9sAWgA2AVzl8fr7EWL0MdTAeQDHANzNyZznZK5yEpdkUmedcGziiwlaHfFtGrTHibZFkQMYUTAFgKEsgoFYhpjtxLJoMraR8JwA4AKAfwRw9sdRA3VVHgHwGZrAGif0AX6W/Bw5rYJ8xjyORUiJ/BeLhhYUVAmgy/cOhdl3bU+J1jWlz6Ucm0bab12OoUZTDQD/AeDJHxcBquA+CeAxAMs8PkKT2QAww/P6nJQBj0eiGUEmMcjEByfgksIbsu1pmrpttplRWCboOoBd+f0ygJdE8AmAgzKmBQB3sd0uz2tTiOZzXwXwdxzHTZnU21GA1vEpCu4kgKMATtNMTgmgsPeQQivkU32ZCix2phJybp+CWQBwht9rvMYWBcTc3c/JPgDgDQB/OmFcGYCvATglvrVH/wgR4iUAf8/Fs68Q09tQcAHAfTSXd3CS7qJ5atPpjygY07IRPwundeB/2v7AaV6g0HIKao6akHN+utJGTTT/G/Sxa2zjMH/vyf118nMAf8PFOMv+LLC9bf4Pjvm3APw1gDf3E2J6mwmvAeALNJP3AriHoKQDYMMBBzOZQRBmEKEECSkgQrMxD0TzDGUeovAGFNa7AD7B31PR2iPUuh/QKgSi4QcBPCXjmQXwK7zfNv3o21yUKQU+xeM6gC2a5TqA3wDwTwD+e5IQbycTeoJadxLAw5ykiAiwI+axxwlWDcwEpJgAhy5s8MjTBJjw+DiAc5zklDB/kRo2dItjisK5QFN3mItvCOB5AN9kn/6AfrsQ8PIukXOT98xoqiP60LZDrf8J4NsOiN0WGqir6ue4Kk/xc54D2RP/1hdzNnKoTgVUillNKgSn18RcHMcpiBavucq5OSKARBFlUzRol8fzvP4rAJ4DcI3ttuVaIxOCjOEQx7lNzeu6Rfd5LpC/Yl9vEOJHpYE2oHkAv8y47nH6h8ABdUTLuhJ/jSpAiRdUyfMzAS2eDSmozas85y2206E2rVLLcmk74v3X+P0Vau9BCnvIdp7n8edF+BGFeZnvB/jbBsdX531jMeulWAkQob74UZtQE95dAB6h2XyU5qrHQZrA+sJmBBmU0mipfC8FuFjMl7rzS0GnTfqy/+Xk7fG8o7I4ImctSpnsK9S6ZQCfEqEOhZ2JRGu6wsrMEjC1qcU1njNkn6fp/xe50Bep8d8C8Ef0l7fEhMYSXBu4+En6uc9y4CkH0REf1+NgCnkHWQQF265agUH4zbICFZqwFwn/53nvESctE4DTEX+qFNsCTVuLbU7znEX6uSkZfxCgMsX77LKtFQpxyHvfxwUxz3MD/29RW+8B8HUAfwyguBUCVNM1DeBX2cnHifD67FxXtK3vKKpQIYRaRfuKPNMKbTXtG3DyLwk9ZkKa46QbG1N3REBGrc157gr/qxEAXeXkj+T+Gm8m4lfr1KqhkAGr/O0ytWyL/lRdh1GI2+mHbCZTApNV3vAAUeYxCtMC2a6EBUPnd4KLEYMzl6FiscQVPjGI8JbkvjOiRQYycglNYonbYmnbLMAd9HnfIRBaoWCGEzIlwWVAzE/XATwL4LsUqC3ETBaSmvH3bUKjitUPiYF+l7HRJQAXSUAf5mp6mqZizlFfxkjEMlA1oeU+Wu6Ddzjh2USs09x1hYg+JCa/Lu2EihgzFiFsCLgoOa6kol/BWYYhF08uYz7gGCOlAiPx7c33IkCfhwsVxMA0Y7pHqHUbNAEJ/YZ1aIW+Ypf/5U5rCg5ulu0ai19z5HBRMeBSEGMpYQg4udvsm3GcK6TO5oTmsuuCaJ8BmiEFnNJsngTwOZ67LWxM7KyCmmL7zMcslHhCHtHynTclwKhCYBEFdYgmZJWDX2bDEf1bKcegPU/EFxzgZHgtm5Pjtqz2mJM7JSu5xjZ6skILCmaO97lImB/LfUf8bohyke12hXWpAkdBzKfFqnOchyF/g8RsHtDNcx4svVUTAeqcxyLEUKEs+2pg5C6cA3AnKa41xj5TYv4i+pOa+DFlFHQVq8Y2K4hlvSeECTEabSDnJZy8nrRZpyYMZYKXZeI0JbTHSV/mWGr8X4Pp2PlW8419CQ8u85yeVABEFZggkUViiDtz404rCPREtLi0vOckAQZO7iOE+qsS9PYEeNQ4QaloQE1uVLr4zS+SyGlYKoK2/jXG9NUC9pyTZiZ3j4BixO8LnOBc+pXw/1c4rqMCGAoKNXfJV6PomgJ+GjSjFkJsuURu6QRvlGAmxETi8og1jsFMfklXsyf5z8OTBFgD8EUAP8POmnnapT9rSGBpPqFD07QkqyY48BHcJJZyzsjFeFFFljwWZJY6liUXKqwk0rW2d+W+IwE6GVNW65JpyDjeRPoRS0ah4KIYUMh1nr/BOTGe1ZdYQLQulsXQE223BHGbVuVOnmvnrZM8qNMKnqgSYB3AH5KTNP7R6kI6vNCg9o44+pgCLTiAaTEZcQWroZnqkcRdI5fTi10GYSScaE3iqXkGuRaabImJi12JQylCSYiOh5Il33VxaCwodkFivoFoUp/X9SWI9+NNJIk7EDOcOis0IjAKjCuN2Vlje+eoLA+lFT7v6wAeEidrGe+cK6Jg51WrDIi8K7B8RirDzDRloj2pxDpRhcMPnJCL9GfGkqwSkCgKHQghbH5FsxSZy0JAyi+2+P8xOW/otE9jzkXJhhQureXrXSx9pcjSBLwrY9Cxm8/eBvAOudWCAjvG8V+z5HPqhPcEgJ8Sp9yRGxrbnrKxxKGkoVBNuWhT14UBKsjMrT4baJ8rr0eh/SIXjxfwM8Il9sVfZk6LSzGfA+ePd6XOJpJzPAmQc1E26V97Yp1MCJf52zzvnUo4YvFiT0IQCCdbyP0DU0uvSwVCi9f+BFH9WROgCeEupvwvCkxtyCq3c3N2ZCSoM5UioQUXUFv7vQoGpRAnbmV6M5yE07QEtTF++in6BGUxzC/1BZVGLk4sKwL+kot1WjSqyjpl/L/nip5soRr4aQgREKQPlzg/fZ7Tk8WruMESyb/GfrSYPLaKhCPKxERS39EWnxPGsC3HaYtrbDQWBj1ysLcmLMMnedNldnxBqssasmhe40ScnoCQX2S5wZxo+jXhVIMLAyLJ4cHlDWNe9y7/bzsyQOPgoRDPljmYk4VdMjY+Isg0Y9stKd9oSzjRkP6YdThBHzjF3+Y4T/9O7V/m974OaEWC37ozPZBONqnGL0idZeTAigcMS5yc56jpq6KRVyiAlCaoJdVms8LgG4J7hsJbllivJb53TkoVIgEYG0JBeX+7Q184wwkbONSbiL9LpX6llLFbhuF+9v0HTJOtMUR51REZhYQ/ufjNNYZtGRfqOhfzEjM4TwqDNLR84AyAv+UqjmjDZ6SyORaT0+AkXRATi4ogXZFXIkBHkVsQ81rI6la/1pXYKxa6rpBrNYTRmDESLQgU/Cb7XzqfZwst4vkLUhpvuck5MXHL9NMHufCm+X6Q5+1wDo2Ifo7CmOV4+pI8LkUbH6MyvUBrN88SjQNE2f/DdhcAnLWBPsG442Wx1dO88SwvmJGbWZwSyaRGY0r1Sol1LLdmHOiO+JSBo5FSMX0zTrtVeH1O4pLUt2zyXqUQDSs0SxYXTol5XOA5s+zDlKDSnH3cpAA2RAixYIRYiOm6IOwmBX1ZMvyJaJEu+MMcyw7787P87xiAX2DW4w4A5/nbUkpz9jmaMi1y3eHxZce+1wVFpQJiUhfrQQSxy0H0XZ1mIhM2VQEsYmfuSod6+4T1izzepGVo4UfL8VeJZI8wiZsL8uwSNMxTs+w3vWeD508JOFMesymEQuIW/DtCgA8FpTfENSUUoH0/RyR6EMBvsr1rfFt13vdTOt2j1CpFjaWr61c0OXBospxAx9UcKErke6gog0+c3ykr6DPjM+e5Ulu0Gjs8booA6vx8g7/dy4l6Q/xRKkI4L9bArMOOgIwhNTaRoqhMiq96kpBusb1X6ftt8V4T7TPgZ/nSAX3lJvu4QuGBbR2kK2gBeDEV8jYXAY4q0hmx0wyf3hj3KioY+cLRY5BVblu1RjTjHvqXEkvNcQLP8vzDdPQ2wXucvHNS6tCk+ZmRyusdttdnWyeEE+2KhdmTqrSB+K6m9PmioNlztGCn2ae3pBJbsw25pM0SmnqL+4ye+1cK9iD7dhbA+VQooi2ZIDUNWYUmFC7EKPepIA7OHOrWrJEQ5wk7nUlqp+faMghvKaErvO4EBbMsZq5GxPw035afXOD1F0Qwm5zIg0IKlPxvnlpjucgG3YJmVUYSImwI8HqA436DwgsSOmiOsMHx3kNz/giA7/OeLQB/SZ8Y8bcnIT6skBWlXGEm3F1aUQVWODTn61JKl0U2FmdWgt9MAIXZd+NaO2INVIC2Wjd4zn2E37P0tbvURsvJ/Tzbe47C2KVPrAvdZW0O2MYSr5kWdFyjNrUllLBYdigm1sxqyT62hNpruKz8yHG9ljr7LkOmh7mgfp/XnsH16u7XAKSpxGItZ84SYUE2pOQP9JtBUNaMbA6pCaUWOVBi4GjXxWO5dNw2fZTuWkW2M1LlbHFlyrjwUQrvAs1ngwN+lCbNkrC2w6kteyYMda5zPpSRsaRth/+nkj1IxTRa4K4l/zXnZvpCKSYSLoGRwJtEnZ/mb6vsb0TN+7bNXSpxUF9MnZrJL9MsbUgtyfck4F8nZ3e3E1Th4kJjLrY5oHtd0K2L52lOSN1VduWSAN4UdGmT+WnLk3ERfAPAV3F9v8W/cTX/syun0ErtpmzkLB3CHvGebVnYmfhSzao33PdYFrvVg9YotC1ZwG2JJcG5CkJsxLheat9RJqYnnGRNmHaDwS8RfptJvF86cJTn/rmYFM//eSCU0TwNpMC1LqY8ZiXby66yK4j/sPrR45I8/gT9TMxQwQpi1yiABzj4g3Lvhmj9HaJtpWTDu8KaJJJaawiL05PxWqVZU441BKlJzrEj1/YE4VtI9R0Av47rhcfneN9L0oda6qD8Q1RRKxXPyND41/1cAW9xolIJbPOKcozIlSdc5CI4QHNmaScDMq8Lh6oZCvOj1yTw7tMvBQB/BuB3aG56XGAPCTkxz7G9VaExOzIxWsibCdleVuyxSISGbDj2KpJMRltcUU8YpkxCiT0pbQT7aYviFYKvdwRkjlJxuqv0FRfpV2x1fpU3bMkKebsiWP6UgABUhB9a12FU1lWaEI03U0ms5g75NgTaL/I6o/Zep29+m/+1pQRkR5iQWddm5HbJ+nJ85UNrzndlsgE0EX/e5f07kpLrypw1RDtT0XD1hbsMJy7TLazQdVl6rwMgMibGkN7r1Iq+ZBhK4QZnZD+6BaxLghZTTt6ey7RDAuOaZOu1biR1nyPnF4OsvIJtGA12HsAPORbbLPIagF/i9c+wnxazZRWZ9tgRCankFjPRNr9lbShPougKYh3J//aalTCoL1xpLCmtJq5vBF2jAF/lwuzTpCpJgZQnNamaVlmcVGyM1PrIkcRGtrVKsxdNlwEfyAaNC2LHlQzvCzioAkCQgqpMAu87ZQxmKWxf+1GmYJ4isntCNLsUINJ0VdKJy7BEbkfTUB540HW5PIgm5m5XcN1ZqC367kyy8THnRxHsXxB57olZjkwDnyTKPM4g8hyRpVVAzYhvMu1oVWzvyp251CdBmAM3cDFNQQ4kHaVVbbnb+xBcyFETcvwkf39Q/MabLMq6AuBfcH0TzW/TZD8r7UDGWHNZleDosa7bfBPER4/E1w0msFKDiu+btCJ1SRSUlIGh2aeYhYjdhp8y5YC/CeD3GHs8zIs6FNSWsPsmrG2p7yhc1jxyeweGUhbXlQzDIba/J9kGBRCly4bHMuiG4zBNcOu4viX5MxKz/Ykrn8hl+9o27zkvfVVzuMvvLS7ATLRtgA/m1RO2qSaLvi4EwLPCu+ZioYoohOD3c88wRrPHeRwQzdvme4uNbcskJq7WJRZfYxp6kp08x84ZfN6WgDh1mleIdjcl8XqQfTPq6wsyKf9F07rmJusyrj9J4rwgx1hqSq0wypdYBgeobsXrBVcgrcKzODukYk/36Dyn6PAfk8YWpRp7jsd1KegZSIJS9/a1hVds01SsiakaSQzWkadPlI4QyNwDdZTKy4REsNdnGfMtCiFuPkfRs6HE3QkTObwFwnrF7YMsXFycyyK6YctdWvFoqJy+41tc8YskUTeJ9OAEuywJ0YaUTxxwrM5Iyv+m5V5W1DQtfOzIcbO6w7WQc3KpGbHXPwD4EoCfJuxe4XXHGGKY/9qQxXWrXi+5IrG+pLR8Wq3tNvGULl96gwCjCtrHzN4mgcDj9FvzuLEaeo+xY7eiw7YAEqklGYq5LMY8DgvuoXGFmOnIPZus4yrh3qSmLUslWUazuk4Tmb3XpwPe5OtlZ+r8M2xKQbheq0oZe5AdVlV7R4LfhRNJphnuEYzP87d1CmaKvxs1NiuV0JGAkqvirJsCJrq6y2afVyZhjT7LzPYQ9IRi2+WC+xpNqdFd5/hWuu/DEFYhIKwUjrl0Seykomg4uKcmBinTD449CnC1LLrvwIhXrTo75QLyboXDx5g98rozNRIS2NfR5BWCg3uYnOcq92gO7yQX2pCA33J9LxDAvIPJzxm9WWEVzrylLiUXXNmIj2lHTmC+4mDg5iwf1++0YndQ5EolCnxwe+R7GL+VrepdSIpnwTEoIxnY93juGVqFDqH348xcXyJQKD8AYZUuPPICS51giopCr2TMvn//MId8nw21iEIIidsuXFZQSTWZvNP4aF51olUNtqfkwQQW8hgbc4DnnyWtdmaf9l8cI7BijKASt38fbouY3xBbVgiiqlLdb1XHmN9uEGDVPr3YmdPUxXl3fwRCrLm0TySx3AJ98YwAsA1q35kxGpa7PXpqBv0TMhKXZdFKAz/B5RgBhArrtq+QJpn9KIQQj9mHF1f4xYYE20r8nrrFglyS0CGRjEAqACyn8DYdjNeNN5GU6E0yhfqwhdhp081oS3DEBCZcv6/QvAD9RkovyLorMUwkgFd2PnbCxy0QbOIebJ5J7s2C8x/KA3tGUvqhWpY6wh77aMV+k10lsPesZTcjwHHPjdZ3zQXWiQg4cUW9UUXZYOz2yceyJe3Uh0BBxZI98CAkcZNV7PMk/EnVdqjwY/tp5vsS2rhnpUUVqLBKmJmL9aKKBxh4wWPM+XnFNVX98QPO8KMP/SmcVpWOBcpxYykfxjz9YdL3cp8J/0DM4vt5ZvY4bawSJMZ8n3T9pGuim5wIn4XwcDyqeDhOqHhcR5igNf+fyY5d5qT8sIWmr/8DDYJ7JnmJ1awAAAAASUVORK5CYII=", top: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAABgCAYAAABrAOBRAAAPFUlEQVR42rVbS69kVRX+zqte99WPS3fTL6BVwChETIAw0AiRgQkGjQOdOiCOCHHqjPgPGBl/gInGqUFjNIKaGIFAVJTGbuwGmu6+3X25t25V3ao6j+3gfqv9erlP3YuJlVSq6tTZe6+99np863GSEEKCO18J3wCQAsgBlPxdA+gDOARgBcASgE+78XcBCBw7BTB0//8DwC6v7/CenGMKABWAhvcGvpEIoYkjtAAw57XDAGYAvib3nOQC4GdO4sYAnuLnm9xYw/dUPq9z7CUA73D8tqxdCqHBCPVcTHjjaQDPAfgMudAA+AuA+zhZxvsBYABgBKAD4Ay5f5MLdQFMOD7wvxLA+wCe4eeAG/sxgBsAemTUbUJTRyQ44TcAfJe/DwG4B8BvuOt7yIFCxvRIOOToISIzl7krEnoZwP0AHgHwOumYA/gRgJdFJJokhJA5IgcAngfwEDnyRcri21zwPgCbXKwjx7pErqckoABwinMaR3MSMwKwDGANwFsA7iaxb/HEHgLwRwAvcc3bxNnnMoAXycE3AHyJRPwewHEA6yRwlztvZHwj4pCJWKTkXircrSjDtpkA4Lfk7mMAfkJx+yHvuS2PBSd4hlo7AfBtcvQigCdIXMkj7pLztuicIjHk5zqAVbk25Pgp713iadgGOwDOAfgDmfQC5fU0FbNKQgiFmKEfALgG4Fvc8TaP5D3eY5v4SORuzg00vHbbpAghKTmck6gumXMXPz/mtaMAXqMy9qlYpwG8lIsiLXPBhyhDHwH4KuWtT7u5QbMyFi224yw4V2pyJf/VvD/hJjKezITEHgWwxXmfAPBzHv0jtLtLuQxe5oQdAFcBPEzbaZO+T8LO83gKOb5KbCpMroSjjWhwzd9DAFfIhDkJnnKuxwC8SludekJTEhY46SoHrgF4lxPWQmQhhOXumCFmKqa0hYhDwWO/Tu2fkcPnyOU1ACtqQ3MAJ7jYcV7PqVCFcGQgRLW9Sr7VPeuYRkwhxDoMhZYVAEf4GXJHaJe7WuYRVJTXwsncfq/MEdT2Up/epWVY4+/j/H8LwCAV323a+5SAkJ0Fi6T7/JdGiErFJMJ5sYzXzb2u0cbuAOjroIzyZ0dckvgYQbOIZpcLuFa735Xcn7iN2P8TAA/wMyj6+TzZDd5oxjyVnecU+i7fJhZBNpA5eSwjfr9HN7xNmNjIHDXnmHG9ZQBN7nY/cFpcOxOT0ffP5HoSMfJBOFUL5/Seo1yv4+4pyYRK7HuauwkSMR8JCQvu2FZoutIDKEm6QIYrQ0YOvTXuFHoQI1075VGDXbsFG5HpqShITMPrFvO0xLGx6KKhSCzJeoPccXIkslgL6u5FCKkiJuggXFaG1G7cXAjMBamleWRxQ/u3SGCPxHZF223iici1usdURKpxHNNwxx/5gMduHvFDU2hP6ES018DwGv3wnBOU4gw6vFaLEiSColIBKplggtQRX4jDKemhThGkzADkudvllJ6gIicNgs2cjNnC9rvDjQyF85UD10EsS0cgX+5MYpfXd8TDpbkDCibIJY1/Tbh3WAjoyMIJOT6jNTCg3NCsGDIy7gfqwYxrzASnplzDftvp5WrwVX5ucYIRj/6o2LUPOOEhUbgjJCjhdwPhmbjmCccvCdieCaED3ntVsOuacDjJnSlJ6TH+zqjw+5zEzMnD5Fyf3Bk7I59KPN7h4gNuzP7fkdPIqNVbPLVAUfsVw6KMazdqniY8/jGDrCcBXKCs9snZnri7hIbfa3ZvH7DSE3keksBDFJsR532eoNoih6lydC4eI5OIc02yHd4dVgeEc97gdwAc4+lMyNUlguU5N5OIM5krR8cCRAYEzIc4SH13EC4Gp1jBuVw47+ORUpfz11y/QyZtiV5UAGamEIncmEt2JBFfnAg4gcOTTct/cDAycSeiGGNFnIZGphmAYSru6iJl8jCAf1L7i4jXCYIZa8GWtYiDvhu5Xro5GpePstO8TrMIAH8G8JEi/IrplHUe+wZ3U8uEtXghMzFziZFm8p9et99+Y7r5IDjjApVrxoxNpegpoWzscrKpuMPUcbF2XAnuHYufEhelmqIU7v+KJqwU55B6g2+eZY1H3wjKrxxXmwgyDw7fKtDJZNOKc+fiIEAGZTR9N6g7iSd0ygnuY8KhFIDrRUDtZyXX4CwEJPTO3CmlgnkzcdNTKvOOmUCPnixN/Tka3JlkiIMQXDslCy24tHGWIRcLkjlOW87ArM9xfi+V0ET8cg/AWUmNdym7auAVDPtQpYnUAmLgWVOTuQCQEU3VMWKLOsZRtWMFFesYvUfXaWYjMhYDyT7GDw4o1yICQZDZWNZv/BEFR+xcwuGeFAmaCOfg5LeJ3FuLaaqcTDcCZPokNEgeDDGOQpIPGi/BabturokkGTwii9UIvDL1yNFNMYe3lTFfEIhlNFFd7nQmopE4QhE5GbWNetxJJM1TEZ0ZqloVawOvTF5OQY7OaVcvi9yUEfSkhj+JyGjmjH8uijSRbPaOYVC4vGbSAjIMo26T0KvEAbUjSBNfyYKQuXYiogWKDc59JeJYWmUUUhOqCRCOSxkmJqP7xfTqSvOIVTBjf01Oae45ihbbaKHDNQD3imGuDgiUFyUgUidyy1Smay7F00poInJjE96U7MX/SqQn1CcpOpx704nUwhRM4aLJW+IE2gjwaD8ckPBaQu0OMyPGsGURlyihyzQPc4lnlilDCo69EW8k4dAckFhI9mRCx7LL62c1UIzJqBXCblELV3n8cFll9dONy/LlzknE0uWNVGKO01bfkJTSRLGF5+gK7eWLAmqvEnJZzR6u/N3IBoqIO04cyI5hgQmBj6bef0ampT5TohMXhFxWa5o5E4NIlq52spy461kkA22ndFjmM1PYF8OfpBF5yVhmtHaKKSPCsKB0EyInpNFB3uJiU66z7kxVw/Liqo1LIxpvfSBniPRt8AkJE2r39r595gx24jaq8X2f+rAt2ejDFLmP7SRiyrREw1sCeFzi7awlZg8LxCJ3vr3tNCyF+TQLcm9yTL9NmVIxCVskeoe71Xxl5kKJTIx0Is0wiHkZt14pR18SqF8WWpo2Qi3uPsebrvB3x93XkaRr5oBJ0hKKFIKaEldCn7AvIKN8FpLFjhr8WiZ7lwWrAXe668xTGnF3yQLu+cAuSHWl5loXBbTPFxn8LhVpROR0CcCzksxKJYxWBapbkg5oCV+CW3/OvpJzFIVMYWgMlHQkLb5EozuUpoPmABXmg1ag1SRN+X1V/kvalClxAV9P4v3/16uWbLNmr1Vc7uBoiARfBY/C0pClyNhBORcLmX0DVyUnCMGkaZuMFhG224B1ySPlgswhcK1NoRKXMm8keMuoD7UUcFO3VvC2rucAxy6xae3saIgAYG8N4JJnIVIgDqI0BZmxK+DGGmz+q1GlF0H3A6kPZQ4xVc5dxoK7ID1SU9cnZaeyTKIOCdQL9Ipd9fUmP7YjKzUOXeq6zX3uJ69BwIna38ZtvicF3RGvrSqhtuhZAgHL9o4FGB85gPKEfcIVTf341GRwBQbLVJ+MVe7OMsbewF6rWS1ZvVJ2X3rz4ZQkBjrQ0gyjRQwVmxHnOqkc1crHDn1uRfSyJbLYFqDVkkWuIxysXeHBe0JD+TfFGq0r5z1HbvD3p6zVjERPnDy1GW4f8ClebSIhSSW2c8wodJU0nGGG5g6DHyRvvuxkZ4NH33elbx/klftkSJJ9ItMp1zolIbsVjTPvLlNpGrRjeYo7X14Q21cH8PttgV0tx/2k2NSeMlEJtczyRCb6srROLCIkVrLxnbn+0xN/k/89TVM4oL6sATicS6R4gsRWAB6Vev1YkL4/bkVS2T4ZmKSl2fCYeMEt7LUr96S9+CyAI7nT4HWy3rIkS7KzVDDpfka+biEscQWxRpSpFivzAem4mwqeaYPWSUlU/Y2DvyIeaokT7Ua6bj8JkipcFW8iymQZvQsk9DxpezAX+dpl2Po9Dn4BwBckJ2SgZXSAXOgneQVRSIuR3gbwU27+OQAdv2BHUjtjErgpoKR0sQ9aKiEx99k4VG8mbSBpnM3IHGNzodqlM3E3bXLiXfr/TGxpcBGoVvYyV/mAq2LPZbNHpDpYCnq6I+2Tu6RuE2nYyjn4VdrSZQp8LnkqfWqmiaD3xvVBm7U4x+u/k7Tl2zHrkIsSmIzGTMhI+u8v04Pd7/rvDW0NXBVvyGtdyW2Bc11giHyYp3ekLdz2MdOtiMeZM8N2npx9gKWWXExWQVfnyzigiYH0jYw49iQ38QqxxXGG58UiQkOLjGoBbAV7TfyHuMDEOmgE8ScuN4+WCojFR/fydIbcAKSXSl9Dz9Gj7oZtB8VO87i2SHgWiTKbBeandnjzFPYeOXpdfPuIjgcCLceqlRXdlb3uEXwIylHF3a+4Zv9CArHCtWF0XACXSZvbUB5O0A3a43GXsfeUQ5M6eRrQM4DKsok7+59n0lWeuLppFiknphF84HtKZgIt4bLOF3jKS1pIvUGtuygcVbDRky6c0vXMzyNPLaQubKkd10qJZFfJeSP4BJlxhetc0+zFhzyaS7x2yvnwnmSjZxFgXEeIbFxSQ7k5JiHjiGdcw386LxvrezJCb1KTNyV0hnQrWlgxjJQLswN0jscCQesZ6UsPoK15md8/BjBKXY5ygzdvCPyaSpWidh3lOj5zx1ov6CZPJQ1fSa8o6K1S7HWz9Qj5qtSVvs+Tk6+Ru48Ti54gV/VJhsY9eLWoYlK7DopKXO2IHDzD+89wzYsUhXcMlGiDwJsAvom9nqfz3KmZDnsudCIgpiOJrMSZoCDKp1xupJe6FqA+I4e7XN/We886yYKYmL8C+JOUVKy/sy8FstPc8a1IJ2PK+3qyubkL/gxd3cX7jtHNlkzFr5Lod6kPHwDIkhBCx+HLdabCu4wKNwH8AsDXadPGkWdEGuHOv4SwPo+yivQ52XgziS8D+A4JfpXr/lKfvgkutt8gYU8C+DWAB3n9Gm3rrgut80iX7o54s2PuQYQKd7YtrZN7j5J7l7jxV6wvzx4JziNJW8uiPUiU8wCAz0qaZYk7n0gdaiaVuK746l3O2xWZX6NY7Uon+RvYe+T4OvbaQ8cSWwV9JDhWH7Jaep9E3k0OrdGLrEtTQB55lklDDssPbJMYC4ev8X1FTGHm20b+DfwyEZ8c5EzjAAAAAElFTkSuQmCC" };
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
const CONF_ICO = { unlock: "unlock", lock: "lock", trunk: "trunkopen", windows: "windowopen", climate: "snow", climate_temp: "snow", flash: "headlight", honk: "horn", find: "find", refresh: "refresh", limit_resume: "bolt" };
const CONF_HEAD = { unlock: "Doors", lock: "Doors", trunk: "Trunk", windows: "Windows", climate: "Climate", climate_temp: "Climate", flash: "Lights", honk: "Horn", find: "Locate", refresh: "Refresh" };
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
  limit_resume: ["Charge anyway?", "The charger will start now. The limit stays off until you plug in again."],
};
const onlySettings = (o) => { const r = {}; if (o && typeof o === "object" && !Array.isArray(o)) for (const k of SETTING_KEYS) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }; // safety: only known keys pass from stored data
const hexc = (h, d) => (/^#[0-9a-f]{6}$/i.test(String(h || "").trim()) ? String(h).trim() : d); // only #rrggbb: colour values end up in a style attribute
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
const hash32 = (str) => { let h = 2166136261; const t = String(str); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const lsRead = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return null; } };
const lsWrite = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
/* Where each settings section lives. `merge`: sections of one tab that share the same `to` title are joined into one section (at the position of the first). `adv`: the section moves to the Advanced tab under that category. Titles are the English headings (also matched when translated). */
const SEC_MAP = {
  "Theme colour": { merge: "Style" }, "Tiles": { merge: "Style" },
  "Car image (hero)": { merge: "Car image and Car View" }, "Car View": { merge: "Car image and Car View" },
  "Waiting effect": { merge: "Button behaviour" }, "Ask for confirmation": { merge: "Button behaviour" },
  "Charging details": { merge: "Charging on the card" }, "Charging effect": { merge: "Charging on the card" },
  "Card": { adv: "App", merge: "App settings" }, "Card page": { adv: "App", merge: "App settings" }, "Sidebar": { adv: "App", merge: "App settings" }, "Data update rate": { adv: "App", merge: "App settings" },
  "Tank": { adv: "Vehicle and sensors", merge: "Vehicle data" }, "Photos (hero & dashboard)": { adv: "Vehicle and sensors", merge: "Vehicle data" }, "Climate on-mode": { adv: "Vehicle and sensors", merge: "Vehicle data" },
  "New sensors": { adv: "Vehicle and sensors", merge: "Sensors" }, "Entity mapping": { adv: "Vehicle and sensors", merge: "Sensors" },
  "Image size and space": { adv: "Look", merge: "Size and margins" }, "Margins": { adv: "Look", merge: "Size and margins" }, "Airflow colours": { adv: "Look" }, "Level colours": { adv: "Look" }, "Notification colours": { adv: "Look" },
  "Charging reminder": { adv: "Charging records", merge: "Charging records" }, "Charge detection": { adv: "Charging records", merge: "Charging records" }, "Charging curve": { adv: "Charging records", merge: "Charging records" },
};
const ADV_CATS = ["App", "Vehicle and sensors", "Look", "Charging records"];
const SEC_KEY = "deepal-companion-settings-sections"; /* which settings sections are open (this browser only) */

/* ───────────────────────── Styles ───────────────────────── */
const BASE_CSS = `
@media(pointer:coarse){:host{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}input,textarea,[contenteditable=true],ha-selector,ha-textfield,ha-textarea{user-select:text!important;-webkit-user-select:text!important;-webkit-touch-callout:default}}
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
.vtop { display:flex; align-items:center; gap:8px; } .vtop .seg { flex:1; min-width:0; }
.vstack { display:grid; } .vgrp { grid-area:1 / 1; display:flex; flex-direction:column; justify-content:center; gap:10px; min-width:0; } .vgrp.off { visibility:hidden; pointer-events:none; }
.vtop { flex:none; margin-bottom:10px; }
.vgrp.slide { animation: ds-vfade .2s ease-out; } @keyframes ds-vfade { from { opacity:0; } to { opacity:1; } }
@media (prefers-reduced-motion: reduce) { #vtabs .vpill { transition:none; } .veh .slide { animation:none; } }
.btn { padding:10px 12px; min-height:var(--cp-ctl-h); border-radius:var(--cp-ctl-r); border:1px solid var(--cp-off-line); background: var(--cp-off-bg); cursor:pointer; font-size:13px; font-weight:600; }
.btn.go { background: rgb(var(--ds-ac)); border-color: transparent; color: rgb(var(--ds-ac-ink)); }
.btn.stop { background: rgba(var(--ds-bad), .14); border-color: rgba(var(--ds-bad), .35); color: rgb(var(--ds-bad)); }
.btn.sm { padding:8px 12px; font-size:13px; min-height:var(--cp-ctl-h); border-radius:var(--cp-ctl-r); }
.btnrow { display:flex; gap:8px; } .btnrow > * { flex:1; }
.mv { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--ds-line);
  background:transparent; cursor:pointer; color: var(--ds-fg2); flex:none; padding:0; }
/* drag handle: 2×3 dots */
.grip { flex:none; width:16px; height:24px; margin-right:2px; cursor:grab; touch-action:none; opacity:.55; -webkit-tap-highlight-color:transparent; background: radial-gradient(circle, var(--ds-fg2) 1.5px, transparent 1.9px) 0 0 / 8px 8px; } .grip:hover { opacity:.9; }
.list .row { transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s; } .list .row.drag { transition:none; z-index:5; position:relative; cursor:grabbing; box-shadow: 0 10px 26px rgba(0,0,0,.45); background: linear-gradient(var(--ds-soft), var(--ds-soft)), var(--card-background-color, #1c1c1c); } .list.dragging .grip { cursor:grabbing; } .list.dragging { user-select:none; -webkit-user-select:none; }
.mv .i { --is: 16px; } .mv[disabled] { opacity:.25; cursor:default; }
/* switches, segments, tabs and press feedback: source/companion-shared.css */
`;
/* Shared interface rules from source/companion-shared.css (written by scripts/build-tokens.cjs). */
const SHARED_CSS = /*ui:begin*/":where(button,[role=button],summary,label.ptile,.cp-press,[data-ent],.t2[data-open],.spot){-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:scale .32s var(--cp-spring),background-color .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease,opacity .18s ease,transform .2s ease,filter .18s ease}\n:where(summary,.cp-row){--cp-press:.985}\n:where(button,[role=button],summary,label.ptile,.cp-press,[data-ent],.t2[data-open],.spot):not(:disabled,[aria-disabled=true]):active{scale:var(--cp-press);transition:scale 70ms ease-out,background-color .18s ease,border-color .18s ease,color .18s ease}\n.sw,.pcsw>i,.preview-click-toggle input,.design-root label>input.peer+div{--k:var(--cp-sw-k);position:relative!important;display:block!important;box-sizing:border-box!important;flex:none!important;width:var(--cp-sw-w)!important;min-width:var(--cp-sw-w)!important;height:var(--cp-sw-h)!important;min-height:var(--cp-sw-h)!important;margin:0!important;padding:0!important;border:0!important;border-radius:999px!important;background:var(--cp-track)!important;box-shadow:inset 0 0 0 1px var(--cp-off-line)!important;transition:background-color .22s ease,box-shadow .22s ease!important}\n.pcsw{position:relative;display:block;flex:none;width:var(--cp-sw-w);height:var(--cp-sw-h);cursor:pointer}\n.pcsw>i{position:absolute!important;inset:0!important;pointer-events:none}\n.pcsw input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;z-index:1}\n.preview-click-toggle input{-webkit-appearance:none;appearance:none;cursor:pointer}\n.sw::after,.pcsw>i::after,.preview-click-toggle input::after,.design-root label>input.peer+div::after{content:\"\"!important;display:block!important;position:absolute!important;top:calc((var(--cp-sw-h) - var(--cp-sw-k)) / 2)!important;left:calc((var(--cp-sw-h) - var(--cp-sw-k)) / 2)!important;right:auto!important;width:var(--k)!important;height:var(--cp-sw-k)!important;margin:0!important;border:0!important;border-radius:999px!important;background:#fff!important;box-shadow:0 1px 3px rgba(0,0,0,.35)!important;transform:translateX(0)!important;transition:transform .38s cubic-bezier(.3,1.3,.5,1),width .16s ease!important}\n.on>.sw,.sw.on,.pcsw input:checked+i,.preview-click-toggle input:checked,.design-root label>input.peer:checked+div{background:var(--cp-accent)!important;box-shadow:none!important}\n:is(.on>.sw,.sw.on,.pcsw input:checked+i,.preview-click-toggle input:checked,.design-root label>input.peer:checked+div)::after{transform:translateX(calc(var(--cp-sw-w) - var(--k) - var(--cp-sw-h) + var(--cp-sw-k)))!important}\n:is(button,label):active>.sw,:is(button,label):active .sw,.pcsw:active>i,.preview-click-toggle:active input,.design-root label:active>input.peer+div{--k:calc(var(--cp-sw-k) + 5px)}\n.pcsw input:disabled+i,.preview-click-toggle input:disabled,.design-root label>input.peer:disabled+div,[disabled]>.sw{opacity:.45}\n.pcsw input:focus-visible+i,.preview-click-toggle input:focus-visible,.design-root label>input.peer:focus-visible+div,:focus-visible>.sw{outline:2px solid var(--cp-accent)!important;outline-offset:2px}\n.seg{display:flex;padding:3px;gap:3px;border-radius:14px;background:var(--ds-soft);border:1px solid var(--ds-line)}\n.seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 6px;border-radius:11px;border:0;background:transparent;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ds-fg2);white-space:nowrap}\n.seg button .i{--is:16px}\n.seg.wide{width:100%;box-sizing:border-box}.seg.wide button{flex:1}\n.seg:not(.hp)>button.on,.seg.hp>.vpill,.pc .pill[aria-pressed=true],.design-root button.live-chip[aria-pressed=true]{background:var(--cp-accent)!important;border-color:transparent!important;color:var(--cp-ink)!important}\n.seg.hp>button.on,.seg.hp>button.on .i{color:var(--cp-ink)}\n.hp{position:relative}.hp>button{position:relative;z-index:1}.seg.hp>button.on,.tabs.hp>button.on{background:none}.seg.hp>button.bg-emerald-400{background:transparent!important}\n.hp>.vpill{position:absolute;left:0;top:3px;bottom:3px;border-radius:11px;pointer-events:none;transition:transform .32s cubic-bezier(.3,.8,.3,1),width .32s cubic-bezier(.3,.8,.3,1)}\n.tabs.hp>.vpill{top:0;bottom:0;border-radius:999px;border:1px solid transparent;box-sizing:border-box}\n.tabs.hp>button.on{border-color:transparent}\n@media (prefers-reduced-motion:reduce){.hp>.vpill{transition:none}}\n.design-root button.bg-emerald-400,.supplied-costs button.bg-emerald-400{background-color:var(--cp-accent)!important;border-color:transparent!important;color:var(--cp-ink)!important}\n.design-root #master-power-icon.bg-emerald-400{background-color:var(--cp-accent)!important;color:var(--cp-ink)!important}\n.design-root button.bg-emerald-400 :is(span,i,svg,ha-icon),.supplied-costs button.bg-emerald-400 :is(span,i,svg,ha-icon){color:inherit!important}\n.tabs:not(.hp)>button.on,.tabs.hp>.vpill,.icons button.on,.tile.on{background:var(--cp-on-bg)!important;border-color:var(--cp-on-line)!important;color:var(--cp-accent)}\n.tile .tk,.pc .ptk{flex:none;position:relative;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--cp-off-line);box-sizing:border-box;transition:background-color .2s ease,border-color .2s ease,transform .38s cubic-bezier(.2,.9,.3,1.5)}\n.tile .tk::after,.pc .ptk::after{content:\"\";position:absolute;left:5.5px;top:2.5px;width:4px;height:8px;border:solid var(--cp-ink);border-width:0 2px 2px 0;transform:rotate(45deg);clip-path:inset(0 100% 100% 0);transition:clip-path .28s ease-out}\n.tile.on .tk,.pc .ptile:has(input:checked) .ptk{background:var(--cp-accent);border-color:transparent;transform:scale(1.08)}\n.tile.on .tk::after,.pc .ptile:has(input:checked) .ptk::after{clip-path:inset(0);transition-delay:.06s}\n.tile:active .tk,.pc .ptile:active .ptk{transform:scale(.88)}\n.cp-block{box-sizing:border-box;border:1px solid var(--cp-off-line);border-radius:var(--cp-block-r);padding:var(--cp-block-p);background:var(--cp-block-bg)}\n.cp-item{box-sizing:border-box;border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);padding:var(--cp-item-p);background:var(--cp-off-bg)}\n@media (prefers-reduced-motion:reduce){.tile .tk,.pc .ptk,.tile .tk::after,.pc .ptk::after{transition:none}:where(button,[role=button],summary,label.ptile,.cp-press,[data-ent],.t2[data-open],.spot):active{scale:none}.sw::after,.pcsw>i::after,.preview-click-toggle input::after,.design-root label>input.peer+div::after{transition:none!important}}\n.page-head{display:flex;align-items:center;gap:12px;min-width:0;margin:0 0 12px;padding:0 2px}\n.ph-icon{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:50%;background:var(--cp-accent);color:var(--cp-ink);box-shadow:0 0 10px rgba(var(--ds-ac,var(--ds-ok,52,211,153)),.15)}\n.ph-icon ha-icon{--mdc-icon-size:20px;color:inherit}\n.ph-text{min-width:0}\n.ph-title{margin:0;font-size:16px;font-weight:700;line-height:1.25;letter-spacing:-.01em;color:var(--ds-fg,var(--primary-text-color,inherit));overflow-wrap:anywhere}\n.ph-sub{margin:2px 0 0;font-size:11px;line-height:1.4;color:var(--ds-fg2,var(--secondary-text-color,inherit));overflow-wrap:anywhere}\n.cp-empty{box-sizing:border-box;grid-column:1/-1;margin:0;padding:24px 16px;border:1px dashed var(--cp-off-line);border-radius:var(--cp-item-r);text-align:center;color:var(--ds-fg2,var(--secondary-text-color,inherit));font-size:13px;line-height:1.6}"/*ui:end*/;
const VARS = `
  --ds-r: 16px; --ds-tr: 16px; --ctl-r: var(--cp-ctl-r); --ctl-pill: 999px; --ctl-cta: 16px; /*tokens:begin*/--ds-ok: 52,211,153; --ds-warn: 250,204,21; --ds-bad: 248,113,113; --ds-info: 121,173,255; --ds-ok-sp: 52 211 153; --ds-warn-sp: 250 204 21; --ds-bad-sp: 248 113 113; --ds-info-sp: 121 173 255; --ds-ac: 52,211,153; --ds-ac-sp: 52 211 153; --ds-ac-ink: 11,21,16; --ds-ac-rot: 0deg; --ds-ac-sat: 1;/*tokens:end*/ --ds-ev: 52,211,153; --ds-fu: 52,211,153;
  /*cp:begin*/--cp-accent:rgb(var(--ds-ac,var(--ds-ok,52,211,153)));--cp-on-bg:rgba(var(--ds-ac,var(--ds-ok,52,211,153)),.12);--cp-on-line:rgba(var(--ds-ac,var(--ds-ok,52,211,153)),.45);--cp-off-bg:rgba(var(--rgb-primary-text-color,255,255,255),.04);--cp-off-line:var(--divider-color,rgba(127,127,127,.25));--cp-track:color-mix(in srgb,var(--primary-text-color,#fff) 22%,transparent);--cp-figure:var(--primary-text-color);--cp-ink:rgb(var(--ds-ac-ink,16,21,18));--cp-press:.965;--cp-spring:cubic-bezier(.2,.9,.3,1.25);--cp-sw-w:44px;--cp-sw-h:24px;--cp-sw-k:20px;--cp-block-r:20px;--cp-block-p:16px;--cp-block-bg:var(--ha-card-background,var(--card-background-color,#1c1c1e));--cp-item-r:14px;--cp-item-p:12px;--cp-ctl-h:40px;--cp-ctl-r:12px;--cp-x:32px;--cp-sheet-r:26px;--cp-sheet-p:16px;/*cp:end*/
  --ds-fg: var(--primary-text-color, #fff); --ds-fg2: rgba(255,255,255,.72); --ds-fg2: color-mix(in srgb, var(--primary-text-color, #fff) 72%, transparent);
  --ds-line: rgba(var(--rgb-primary-text-color, 255,255,255), .12); --ds-soft: rgba(var(--rgb-primary-text-color, 255,255,255), .06);
  --ds-card: var(--ha-card-background, var(--card-background-color, #202226));
`;

const CSS = `
:host { display:block; }
ha-card { ${VARS}
  position: relative; overflow: hidden; padding: 14px; border-radius: 20px; display: flex; flex-direction: column; gap: 16px;
  font-variant-numeric: tabular-nums;
  background: radial-gradient(90% 60% at 0% 0%, rgba(var(--ds-ev), .10), transparent 60%),
    radial-gradient(90% 60% at 100% 0%, rgba(var(--ds-fu), .08), transparent 60%),
    var(--ha-card-background, var(--card-background-color, #1c1c1c)); }
ha-card[data-pad="half"] { padding:7px; gap:12px; }
ha-card[data-pad="none"] { padding:0 0 3px; gap:8px; --ds-tr: 17px; } /* tiles sit 3px from every edge; 17px keeps their corners concentric with the 20px card */
ha-card[data-pad="none"] > :not(.hero):not(.sheet) { margin-inline:3px; }
ha-card[data-pad="none"] .stats { gap:8px; }
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
/* The sky is tied to the car's base box (.hbox): its size follows the card width only, so the scene looks the same at every hero height. The extra air above/below is filled by a soft continuation. */
.sky { position:absolute; inset:0; z-index:0; pointer-events:none; display:none; overflow:hidden; } .hero[data-style="carview"] .sky { display:block; }
.sky > svg, .sky > img.mn { position:absolute; left:0; right:0; bottom: calc(100cqw * var(--ds-fx, 0)); width:100%; height: calc(100% - 100cqw * (var(--ds-hx, 0) + var(--ds-fx, 0))); animation: ds-skyin .8s ease; }
.sky > svg { overflow:visible; }
.sky > img.mn { object-fit:cover; object-position:60% 100%; transform:scale(1.2); transform-origin:60% 100%; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 calc(min(1, var(--ds-hx, 0) * 1000) * 20%), #000 calc(100% - min(1, var(--ds-fx, 0) * 1000) * 12%), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 calc(min(1, var(--ds-hx, 0) * 1000) * 20%), #000 calc(100% - min(1, var(--ds-fx, 0) * 1000) * 12%), transparent 100%); }
.sky > img.bg { position:absolute; inset:-6%; width:112%; height:112%; object-fit:cover; object-position:60% 100%; filter: blur(26px) brightness(.85) saturate(1.1); display: var(--ds-bgd, none); }
.sky[data-p="morning"] { --sk: 120,170,230; } .sky[data-p="afternoon"] { --sk: 90,150,220; } .sky[data-p="evening"] { --sk: 150,90,130; } .sky[data-p="night"] { --sk: 24,34,78; }
.sky[data-p]:not([data-p^="neon"])::before { content:""; position:absolute; left:0; right:0; top:0; height: calc(100cqw * var(--ds-hx, 0) + 10%); background: linear-gradient(to bottom, rgba(var(--sk, 0,0,0), .38), transparent); opacity: calc(min(1, var(--ds-hx, 0) * 1000)); }
@keyframes ds-skyin { from { opacity:0 } }
.hero[data-style="carview"] .shade-left { width:46%; background: linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,.28) 60%, transparent); }
.hero[data-style="carview"] { background: radial-gradient(ellipse 72% calc(.6 * 100cqw / var(--ds-ar0, 1.4)) at 56% calc(100% - .24 * 100cqw / var(--ds-ar0, 1.4)), #3b4654 0%, #1a1e25 58%, #0e0f13 100%); }
.cva::before, .cvb::before { content:""; position:absolute; pointer-events:none; background: radial-gradient(ellipse at center, rgba(0,0,0,.72), rgba(0,0,0,.3) 45%, transparent 72%); filter: blur(6px); }
.cva::before { left:12%; right:8%; top:68%; height:14%; }
.cvb::before { left:11%; right:20%; top:64%; height:12%; }
.cvi { position:absolute; left:50%; top:50%; width:100%; aspect-ratio: 750 / 500; transform-origin: 50.93% 50.3%; transform: translate(-50.93%, -50.3%) scale(var(--ds-cvs, 1.08)); } /* the visible centre of the car (382,251.5 in 750×500) goes exactly to the centre of the hero and the zoom happens around it */
/* Neon city: no effect on the car itself; the ground under it glows in the colours of the scene */
.hero[data-sky^="neon"] .cva::before, .hero[data-sky^="neon"] .cvb::before { filter: blur(11px); mix-blend-mode: screen; opacity:.3; background: radial-gradient(ellipse at center, var(--ds-glow1, rgba(0,220,255,.7)) 0%, var(--ds-glow2, rgba(255,40,185,.5)) 48%, transparent 74%); }
.hero[data-sky^="neon"] .cvt::before { filter: blur(14px); mix-blend-mode: screen; opacity:.7; background: radial-gradient(ellipse at center, var(--ds-glow1, rgba(0,220,255,.7)) 0%, var(--ds-glow2, rgba(255,40,185,.5)) 50%, transparent 76%); }
/* Neon city: the car sits in the scene (cast shadow; the scene light comes from the left, so shadows fall to the right and slightly toward the viewer, like the palm shadows on the road, wet-road reflection, scene light on the body); everything is drawn from the car's own outline */
.nfx { display:none; position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }
.hero[data-sky^="neon"] .nfx { display:block; }
.hero[data-sky^="neon"] { --nf-so:.72; --nf-m:.28; --nf-sx:-.7; --nf-ao:1; --nf-co:.95; --nf-rfo:.22; --nf-sto:.5; }
.hero[data-sky="neon-afternoon"] { --nf-so:.7; --nf-m:.36; --nf-sx:-1; --nf-ao:.95; --nf-co:.9; --nf-rfo:.2; --nf-sto:.35; }
.hero[data-sky="neon-day"] { --nf-so:.62; --nf-m:.32; --nf-sx:-.8; --nf-ao:.9; --nf-co:.85; --nf-rfo:.1; --nf-sto:.15; }
.nf-sh { opacity:calc(var(--nf-so) * .9); transform: translate(var(--ox,0px), var(--oy,0px)) matrix(calc(1 - var(--nf-sx) * var(--k, 0)), calc((1 + var(--nf-m)) * var(--k, 0)), var(--nf-sx), calc(-1 * var(--nf-m)), 0, 0) translate(calc(-1 * var(--ox,0px)), calc(-1 * var(--oy,0px))); }
.nfx-top .nf-sh { transform: translate(16px, 14px) scale(1.01); opacity:calc(var(--nf-so) * 1.3); } .nfx-top .nf-sh2 { transform: translate(5px, 4px); opacity:var(--nf-ao); }
.nf-ao { opacity:var(--nf-ao); } .nf-ao ellipse { fill:#080016; }
.nf-shn { opacity:calc(var(--nf-so) * .8); }
.nfx-l { z-index:3; mix-blend-mode:screen; } .nl-wash { opacity:var(--nl-wo, .22); } .nl-rim { opacity:var(--nl-ro, .75); } .nl-s1 { stop-color: var(--ds-glow1, #00dcff); } .nl-s2 { stop-color: var(--ds-glow2, #ff28b9); } .nl-c1 { flood-color: var(--ds-glow2, #ff28b9); }
.hero[data-sky="neon-day"] { --nl-wo:.12; --nl-ro:.35; } .hero[data-sky="neon-afternoon"] { --nl-wo:.22; --nl-ro:.6; }
.nf-rf { opacity:var(--nf-rfo); }
.nf-st { opacity:var(--nf-sto); } .nf-st1 { fill:var(--ds-glow1); } .nf-st2 { fill:var(--ds-glow2); }

.hero[data-sky="neon-night"] { --ds-glow1: rgba(0,220,255,.75); --ds-glow2: rgba(255,40,185,.55); }
.hero[data-sky="neon-afternoon"] { --ds-glow1: rgba(255,150,70,.6); --ds-glow2: rgba(255,60,170,.45); }
.hero[data-sky="neon-day"] { --ds-glow1: rgba(120,220,255,.35); --ds-glow2: rgba(255,120,190,.28); }
.cvi[hidden], .cvt[hidden] { display:none; }
.cvi:not([hidden]), .cvt:not([hidden]) { animation: ds-fade .4s ease-out; }
/* Top view: the car (layers 750×750, centre 359.5,385.5) is rotated 90° so it faces left like the 3/4 view and fills the wide hero */
.cvt { position:absolute; left:50%; top:50%; width: calc(100% * var(--ds-tvs, .96)); aspect-ratio:1; transform-origin: 49.93% 51.2%; transform: translate(-49.93%, -51.2%) rotate(-90deg); } /* visible centre of the car (374.5,384 in 750×750) at the centre of the hero */
.cvt::before { content:""; position:absolute; inset:5% 24% 3%; pointer-events:none; background: radial-gradient(ellipse at center, rgba(0,0,0,.6), rgba(0,0,0,.28) 48%, transparent 72%); filter: blur(10px); }
.cvt img { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition: opacity .3s ease; }
.cvt img.on { opacity:1; }
.cva, .cvb { position:absolute; inset:0; transition: opacity .6s ease; }
.cvt { transition: opacity .6s ease; }
.cva.cv-loading, .cvt.cv-loading { opacity: 0; }
.cvb { opacity:0; transform: translate(2%, 3.5%); } /* the translucent view has a different frame: shifted so the car stays at the same centre */ .hcv.chg .cva { opacity:0; } .hcv.chg .cvb { opacity:1; }
.cva img, .cvb > img:not(.sweep) { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition: opacity .35s ease; }
.cva img.on, .cvb > img.on:not(.sweep) { opacity:1; }
/* Unlocked: the door handles light up (amber, with a soft pulsing glow) */
.hdl { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; opacity:0; transition: opacity .4s ease; filter: drop-shadow(0 0 2px rgba(var(--ds-warn), .95)) drop-shadow(0 0 7px rgba(var(--ds-warn), .6)); }
.hero.unlocked .hdl { opacity:1; }
.hdl rect { fill: rgb(var(--ds-warn)); animation: ds-hdl 2.4s ease-in-out infinite; } .hdl rect.off { display:none; }
@keyframes ds-hdl { 0%, 100% { opacity:.72; } 50% { opacity:1; } }
/* Turn signals: the lamp strips blink like the car's LEDs (soft glow, tapered ends, semi-transparent), only while the sensor is on */
.trn { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }
.trn g { fill:none; stroke-linecap:round; opacity:0; }
.trn g.on { animation: ds-trn .7s linear infinite; }
.trn .gl { stroke-width:7; stroke-opacity:.5; filter: blur(2.6px); }
.trn .cr { stroke-opacity:.9; filter: drop-shadow(0 0 1.2px rgba(var(--ds-warn), .8)); }
@keyframes ds-trn { 0%, 46% { opacity:1; } 52%, 96% { opacity:.03; } 100% { opacity:1; } }
@media (prefers-reduced-motion: reduce) { .trn g.on { animation:none; opacity:.9; } .amb.on { animation:none; opacity:.9; } }
/* Position lamp (DRL): the daylight line and the triangle are tinted (dim = off, bright = on); on top the turn signal flashes amber on the line only. High beam = the low beam layer twice as strong. */
.tnt, .amb { position:absolute; left:31.333%; top:43%; width:14.667%; height:9%; pointer-events:none; -webkit-mask-size:100% 100%; mask-size:100% 100%; }
.tnt { background: rgb(28,32,40); opacity:.6; transition: opacity .25s; }
.tnt.lit { background: linear-gradient(rgb(255,255,255), rgb(238,240,242)); opacity:.85; filter: drop-shadow(0 0 3px rgba(255,255,255,.85)); }
.amb { background: linear-gradient(rgb(255,176,40), rgb(255,128,0)); opacity:0; filter: drop-shadow(0 0 2px rgba(255,150,20,.9)) drop-shadow(0 0 6px rgba(255,120,0,.55)); }
.amb.on { animation: ds-trn .7s linear infinite; }
.trn g.drlc { opacity:0; transition: opacity .25s; }
.trn g.drlc.lit { opacity:1; }
.trn .dgw { stroke:rgb(255,255,255); stroke-width:5; stroke-opacity:.5; filter: blur(2.2px); }
.trn .dcw { stroke:#fff; stroke-width:1.8; filter: drop-shadow(0 0 1.5px rgba(255,255,255,.9)); }
.cva img.hb { mix-blend-mode: screen; filter: brightness(1.5); }
.cva.flip { transform: scaleX(-1); }
.cva .pl { position:absolute; display:none; pointer-events:none; background-repeat:no-repeat; transform: scaleX(-1) rotate(-14deg); -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent), linear-gradient(0deg, transparent, #000 22%, #000 78%, transparent); -webkit-mask-composite: source-in; mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent), linear-gradient(0deg, transparent, #000 22%, #000 78%, transparent); mask-composite: intersect; }
.cva.flip .pl { display:block; }
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
.total .w { border-left: 3px solid rgb(var(--ds-ac)); padding-left: 10px; }
.total .big { font-size: 44px; font-weight: 700; letter-spacing: -.03em; line-height: .95; text-shadow: 0 2px 14px rgba(0,0,0,.5); }
.total .big small { font-size: 17px; font-weight: 300; margin-left:4px; opacity:.8; letter-spacing:0; }
.total .cap { margin-top: 5px; font-size: 12px; font-style: italic; font-weight: 300; letter-spacing: .02em; opacity:.8; }
.total .split { margin-top: 6px; display:flex; gap:10px; font-size: 12px; color: rgba(255,255,255,.85); }
.total .split span { display:inline-flex; align-items:center; gap:4px; } .total .split .i { --is: 14px; }
.total .split .e .i { color: rgb(var(--ds-ev)); } .total .split .f .i { color: rgb(var(--ds-fu)); }
.rfs { position:relative; flex:none; width:30px; height:30px; padding:0; border-radius:50%; display:grid; place-items:center; cursor:pointer; color: rgba(255,255,255,.8);
  background: rgba(10,11,15,.45); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border:1px solid rgba(255,255,255,.16); -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring); }
.rfs[hidden] { display:none; } .rfs .i { --is:20px; } .rfs { --cp-press:.9; } .rfs.ok { color: rgb(var(--ds-ok)); border-color: rgba(var(--ds-ok), .55); } .rfs.bad { color: rgb(var(--ds-bad)); border-color: rgba(var(--ds-bad), .55); } .rfs.success { color: rgb(var(--ds-ok)); } .rfs.error { color: rgb(var(--ds-bad)); }
.rfs .bdg { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px; padding:0 4px; box-sizing:border-box; border-radius:8px; background: rgb(var(--ds-bad)); color:#fff; font-size:10px; font-weight:800; font-style:normal; line-height:16px; text-align:center; pointer-events:none; box-shadow:0 0 0 1.5px rgba(10,11,15,.85); }
.rfs .age { position:absolute; top:-8px; right:-10px; z-index:2; min-width:18px; height:16px; padding:0 5px; box-sizing:border-box; border-radius:8px; font-size:10px; font-weight:800; font-style:normal; line-height:16px; text-align:center; font-variant-numeric:tabular-nums; pointer-events:none; --c: var(--ds-ok); color: rgb(var(--c)); background: linear-gradient(rgba(var(--c), .26), rgba(var(--c), .26)), rgba(10,11,15,.86); box-shadow: 0 0 0 1px rgba(var(--c), .5); } .rfs .age.warn { --c: var(--ds-warn); } .rfs .age.bad { --c: var(--ds-bad); }
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
.meta .rfs.ok { background: rgba(var(--ds-ok), .16) !important; } .meta .rfs.bad { background: rgba(var(--ds-bad), .16) !important; }
/* Car View: the car (e.g. white or silver, from above, large or in a low hero) can pass behind the buttons at the top right; so they have a darker, blurred background and are visible over any colour */
.hero[data-style="carview"] .rfs { background: rgba(10,11,15,.7); border:1px solid rgba(255,255,255,.26); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 1px 7px rgba(0,0,0,.5); }
.hero[data-style="carview"] .rfs:not(.ok):not(.bad):not(.success):not(.error) { color:#fff; }
.hero[data-style="carview"] .rfs.ok { border-color: rgba(var(--ds-ok), .6); } .hero[data-style="carview"] .rfs.bad { border-color: rgba(var(--ds-bad), .6); }
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
.cb { stroke: rgb(var(--ds-ac)); stroke-width:3.4; opacity:.22; filter: blur(1.6px); }
.cf { stroke: color-mix(in srgb, rgb(var(--ds-ac)), #fff 42%); stroke-width:2.2; stroke-linecap:round; stroke-dasharray: 5 20; filter: drop-shadow(0 0 2px rgb(var(--ds-ac))); animation: ds-cab 1.2s linear infinite; }
@keyframes ds-cab { to { stroke-dashoffset: -25; } }
.pr { stroke: color-mix(in srgb, rgb(var(--ds-ac)), #fff 42%); stroke-width:1.4; transform-box: fill-box; transform-origin:center; opacity:0; animation: ds-ring 2.2s ease-out infinite; } .pr.r2 { animation-delay:1.1s; }
@keyframes ds-ring { 0% { transform: scale(.5); opacity:.95; } 100% { transform: scale(3); opacity:0; } }
.pg { fill: rgb(var(--ds-ac)) !important; filter: blur(3px); animation: ds-pg 2.2s ease-in-out infinite; }
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
.actions { --bs: 52px; container-type: inline-size; padding: 2px 0; margin-block: -2px; } /* the padding only keeps the button glow unclipped; the negative margin keeps the space to the next block equal to the card gap */
.actions.sz-s { --bs: 42px; } .actions.sz-l { --bs: 62px; }
.actions.grid { display:flex; flex-wrap:wrap; justify-content:center; gap: 18px 4px; } .actions.grid .cell { flex: 0 0 calc((100% - 16px) / 5); min-width:0; } /* five per row; a shorter last row is centred */
.actions.scroll { display:flex; gap: 12px; overflow-x:auto; scrollbar-width:none; padding: 2px 2px 4px; margin-block: -2px -4px; scroll-snap-type:x proximity; }
.actions.scroll::-webkit-scrollbar { display:none; }
.actions.scroll[data-r] { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); }
.actions.scroll[data-l] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px); mask-image: linear-gradient(90deg, transparent, #000 34px); }
.actions.scroll[data-l][data-r] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); }
.actions.scroll .cell { flex:none; width: var(--cw, calc(var(--bs) + 22px)); scroll-snap-align:start; }
.actions.fit { display:flex; gap:4px; justify-content:space-between; }
.actions.fit .cell { flex:1 1 0; } .actions.fit .act { --bs: clamp(32px, 11cqw, 52px); }
.cell { --c: var(--ds-info); display:flex; flex-direction:column; align-items:center; gap:6px; min-width:0; }
.cell.warn { --c: var(--ds-warn); } .cell.bad { --c: var(--ds-bad); }
.cell .cap { max-width:100%; font-size:12px; line-height:1.15; text-align:center; color: var(--ds-fg2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cell .cap.t { color: var(--ds-fg); font-weight:600; font-size:12.5px; }
.cell .cap.s.wait { white-space:normal; overflow:visible; text-overflow:clip; overflow-wrap:anywhere; text-wrap:balance; } /* the waiting text (Car waking up · 12s) wraps instead of being cut with … */
.cell.warn .cap.s, .cell.bad .cap.s { color: rgb(var(--c)); }
.act { --c: var(--ds-info); position:relative; flex:none; display:grid; place-items:center; width: var(--bs); height: var(--bs); padding:0; cursor:pointer; border-radius:50%;
  border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg);
  -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring), background .25s ease, border-color .25s ease, box-shadow .25s ease; }
.act .i { width: 46%; height: 46%; color: var(--ds-fg); transition: color .25s ease; } .act .i.w { width: 72%; height: auto; }
.act.ok { --c: var(--ds-ac); } .cell.ok { --c: var(--ds-ac); }
.act.warn { --c: var(--ds-warn); } .act.bad { --c: var(--ds-bad); }
.act.warn:not(.on), .act.bad:not(.on) { border-color: rgba(var(--c), .55); } .act.warn:not(.on) .i, .act.bad:not(.on) .i { color: rgb(var(--c)); }
.act.on { background: rgb(var(--c)); border-color: transparent; box-shadow: 0 6px 18px rgba(var(--c), .35); }
.act.on .i { color:#fff; } .act.on.warn .i { color:#1d1400; }
.act { --cp-press:.92; } .act:focus-visible { outline: 2px solid rgb(var(--c)); outline-offset: 2px; }
.act[disabled] { opacity:.4; cursor:not-allowed; }
.act .dot { position:absolute; top:5px; right:5px; width:7px; height:7px; border-radius:50%; background: rgb(var(--c)); }
.act.on .dot { background:#fff; }
.act .dot.pulse { background: rgb(var(--ds-ac, 52,211,153)); animation: dcPcPulse 1.8s ease-out infinite; }
@keyframes dcPcPulse { 0% { box-shadow: 0 0 0 0 rgba(var(--ds-ac, 52,211,153), .75); } 70% { box-shadow: 0 0 0 7px rgba(var(--ds-ac, 52,211,153), 0); } 100% { box-shadow: 0 0 0 0 rgba(var(--ds-ac, 52,211,153), 0); } }
@media (prefers-reduced-motion: reduce) { .act .dot.pulse { animation: none; } }
.act .ring { position:absolute; inset:-3px; width: calc(100% + 6px); height: calc(100% + 6px); pointer-events:none; overflow:visible; }
.act .ring rect { fill:none; stroke: rgb(var(--ds-ac, var(--c))); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
/* waiting effect, chosen in Card Settings → Controls: arc (default) · pulse · neon */
ha-card[data-pfx="pulse"] .act .ring { display:none; } ha-card[data-pfx="pulse"] .act.pending { animation: pfx-pulse 1.6s ease-in-out infinite; } @keyframes pfx-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--ds-ac),.55); } 50% { box-shadow: 0 0 0 10px rgba(var(--ds-ac),0); } }
ha-card[data-pfx="neon"] .act .ring { display:none; } ha-card[data-pfx="neon"] .act.pending::before { content:""; position:absolute; inset:-4px; border-radius:50%; background: conic-gradient(from 0deg, var(--ds-glow1, #00dcff), var(--ds-glow2, #ff28b9), rgb(var(--ds-ac)), var(--ds-glow1, #00dcff)); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px)); mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px)); animation: pfx-spin 2s linear infinite; pointer-events:none; } ha-card[data-pfx="neon"] .act.pending { box-shadow: 0 0 16px rgba(var(--ds-ac),.4); } @keyframes pfx-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { ha-card[data-pfx] .act.pending, ha-card[data-pfx] .act.pending::before { animation:none !important; } }
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
@keyframes ds-d2 { 0%,48% { background:rgb(var(--ds-ac)); } 50%,100% { background:rgba(255,255,255,.28); } }
@keyframes ds-d3 { 0%,31% { background:rgb(var(--ds-ac)); } 33.3%,100% { background:rgba(255,255,255,.28); } }
@media (prefers-reduced-motion: reduce) { .status .rf { animation:none; } .status .rf:not(:first-child), .status .rd { display:none; } }

/* Temperature / battery tiles */
.stats { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.t2 { position:relative; overflow:hidden; min-height:118px; padding: 10px 14px 12px; border-radius: var(--ds-tr); background: var(--ds-soft); border:1px solid var(--ds-line); text-align:left; color: var(--ds-fg); }
.t2[data-open] { cursor:pointer; -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring); } .t2[data-open] { --cp-press:.985; }
.t2 .tt { position:relative; z-index:1; font-size: 14.5px; font-weight: 600; letter-spacing:-.01em; }
.t2 .ts { margin-top: 2px; font-size: 12.5px; color: var(--ds-fg2); line-height:1.35; }
.t2 .ts b { font-weight:600; color: var(--ds-fg); font-size: 13px; }
.cmf { --hc:251,146,60; position:relative; z-index:2; display:flex; flex-wrap:wrap; gap:4px; width:max-content; max-width:calc(100% - 79px); min-width:20px; margin:8px 0 0; padding:0; border:0; background:none; font:inherit; color:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; } .cmf::before { content:""; position:absolute; inset:-8px; }
.cmf .it { position:relative; width:20px; height:20px; border-radius:50%; display:grid; place-items:center; box-sizing:border-box; --c:var(--hc); color:rgb(var(--c)); --w:currentColor; background:rgba(var(--c), .14); border:1px solid rgba(var(--c), .5); } .cmf .it.v { --c:var(--ds-info); } .cmf .it .i { --is:13px; } .cmf .it.m .i { transform:scaleX(-1); }
.cmf .dt { position:absolute; top:-1px; right:-1px; width:6px; height:6px; border-radius:50%; background:rgb(var(--c)); box-shadow:0 0 0 1.5px var(--ds-soft); } .cmf .dt::after { content:""; position:absolute; inset:0; border-radius:50%; background:rgb(var(--c)); animation:dcCmf 1.8s ease-out infinite; }
@keyframes dcCmf { 0% { transform:scale(1); opacity:.65; } 100% { transform:scale(3); opacity:0; } } @media (prefers-reduced-motion: reduce) { .cmf .dt::after { animation:none; } }
.t2.tempc .ts b { font-size: 24px; line-height: 1.05; } /* inside temperature value only */
/* The title is a .tt, the same class as the 30 px icons, which gave the title a 30 px box: 14 px of empty space under the word. The title now sizes to its text, and the first line sits 6 px below it. */
.t2.tempc .tt, .t2.batt .tt { width:auto; height:auto; } .t2.tempc .ts, .t2.batt .ts { margin-top: 6px; }
.t2w:has(> .cpb) > .t2.batt .tt, .t2w:has(> .cpb) > .t2.batt .lg { margin-right:28px; } /* the plan button sits in the top-right corner: keep the title and range rows out of its column */
.t2.batt .lg { gap:0; } .t2.batt .lg span { line-height:1; } /* the three Energy lines were 18 px apart: the 2 px gap and the line box of 16 px are now 14.5 px */
.t2 .ts.chg, .t2 .ts.chg b { color: rgb(var(--ds-ac)); } .t2.batt .ts { max-width: 58%; } .t2 .ts .sub { font-size: 12px; color: var(--ds-fg2); }
/* "Charging now" ↔ time remaining: fast upward scroll with blur (6 s cycle, ~2.5 s rest). --d keeps the phase the same when the tile is rebuilt. */
.t2 .ts.chg .cw { display:grid; overflow:hidden; white-space:nowrap; line-height:1.5; }
.t2 .ts.chg .cf { grid-area:1/1; animation-duration:6s; animation-timing-function:cubic-bezier(.5,0,.1,1); animation-iteration-count:infinite; animation-fill-mode:both; animation-delay:var(--d,0s); }
.t2 .ts.chg .cf1 { animation-name:ds-chgo; } .t2 .ts.chg .cf2 { animation-name:ds-chgi; }
@keyframes ds-chgo { 0%,40% { transform:translateY(0); opacity:1; filter:blur(0); } 44% { filter:blur(3px); } 48% { transform:translateY(-120%); opacity:0; filter:blur(5px); } 48.1%,90% { transform:translateY(120%); opacity:0; filter:blur(5px); } 96% { filter:blur(3px); } 100% { transform:translateY(0); opacity:1; filter:blur(0); } }
@keyframes ds-chgi { 0%,40% { transform:translateY(120%); opacity:0; filter:blur(5px); } 44% { filter:blur(3px); } 48%,90% { transform:translateY(0); opacity:1; filter:blur(0); } 94% { filter:blur(3px); } 98%,100% { transform:translateY(-120%); opacity:0; filter:blur(5px); } }
@media (prefers-reduced-motion: reduce) { .t2 .ts.chg .cf { animation:none; } .t2 .ts.chg .cf2 { display:none; } }
.row.tgnum { display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:default; }
.row.tgnum > span { min-width:0; }
.row.tgnum input { width:88px; flex:none; text-align:right; }
.ts.chg .cw3 { display:block; overflow:hidden; height:1.5em; line-height:1.5; }
.ts.chg .rl3 { display:flex; flex-direction:column; animation: ds-roll4 12s cubic-bezier(.5,0,.1,1) infinite; }
.ts.chg .rl3 > b { display:block; flex:none; height:1.5em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@keyframes ds-roll4 { 0%,22% { transform:translateY(0); } 25%,47% { transform:translateY(-25%); } 50%,72% { transform:translateY(-50%); } 75%,100% { transform:translateY(-75%); } }
@media (prefers-reduced-motion: reduce) { .ts.chg .rl3 { animation:none; } }
.gauge .fg { stroke: rgb(var(--ds-ev)); opacity:.28; }
.gauge .fp { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 3px rgba(var(--ds-ev), .9)); animation: ds-chgflow 2.4s cubic-bezier(.45,.05,.55,.95) infinite, ds-chgfade 2.4s linear infinite; }
@keyframes ds-chgflow { from { stroke-dashoffset: var(--fs); } to { stroke-dashoffset: var(--fe); } }
@keyframes ds-chgfade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
.t2 .lg { margin-top: 6px; display:flex; flex-direction:column; gap:2px; font-size:12.5px; }
.t2 .lg span { display:flex; align-items:center; gap:4px; } .t2 .lg .i { --is: 14px; } .t2 .lg b { color: var(--ds-fg); font-weight:600; font-size:14.5px; }
.t2 .lg small { color: var(--ds-fg2); font-size: 12.5px; }
/* Climate tile: temperature inside, target with ± and an on/off button */
.t2.temp { display:grid; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr auto; align-items:start; min-height:132px; }
.t2.temp .tt { grid-column:1; grid-row:1; align-self:start; } /* same title height as the Energy tile (it used to sit 2px lower because of the button) */
.tpw { --kc: var(--ds-info); grid-column:2; grid-row:1; position:relative; width:40px; height:40px; margin:-6px -8px 0 0; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); display:grid; place-items:center; padding:0; cursor:pointer; color: var(--ds-fg2); -webkit-tap-highlight-color: transparent; transition: background .25s ease, color .25s ease, scale .32s var(--cp-spring), box-shadow .25s ease; }
.tpw .i { --is:18px; } .tpw { --cp-press:.92; } .tpw[disabled] { opacity:.4; cursor:not-allowed; }
.tpw.on { background: rgb(var(--kc)); border-color: transparent; color:#fff; box-shadow: 0 4px 14px rgba(var(--kc), .4); }
.tpw:focus-visible, .cs:focus-visible { outline: 2px solid rgb(var(--ds-info)); outline-offset: 2px; }
.tpw .ring { position:absolute; inset:-3px; width: calc(100% + 6px); height: calc(100% + 6px); pointer-events:none; overflow:visible; }
.tpw .ring rect { fill:none; stroke: rgb(var(--kc)); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
.t2.temp .ct { grid-column:1 / -1; grid-row:2; align-self:center; display:flex; align-items:baseline; gap:8px; padding-top:2px; }
.t2.temp .cur { font-size:38px; font-weight:300; letter-spacing:-.03em; line-height:1; color: var(--ds-fg); }
.t2.temp .lbl { font-size:12px; color: var(--ds-fg2); }
.cstep { grid-column:1 / -1; grid-row:3; display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:6px; padding:3px; border-radius:999px; background: rgba(0,0,0,.22); border:1px solid var(--ds-line); }
.cstep.idle .cv b { color: var(--ds-fg2); }
.cs { width:34px; height:34px; flex:none; border-radius:50%; border:0; display:grid; place-items:center; padding:0; cursor:pointer; background: var(--ds-soft); color: var(--ds-fg); -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring), background .2s ease; }
.cs .i { --is:16px; } .cs { --cp-press:.9; } .cs:active { background: rgba(var(--ds-info), .25); } .cs[disabled] { opacity:.4; }
.cv { display:flex; flex-direction:column; align-items:center; line-height:1.1; min-width:0; } .cv small { font-size:11px; color: var(--ds-fg2); } .cv b { font-size:15px; font-weight:600; color: rgb(var(--ds-info)); }
.gauge { position:absolute; right:-35px; bottom:-35px; width: 150px; height: 150px; pointer-events:none; }
.gauge svg { width:100%; height:100%; overflow:visible; }
.gauge circle { fill:none; stroke-linecap:round; } .gauge .tr { stroke: var(--ds-line); } .gauge line.tg { stroke: rgb(var(--ds-ev)); stroke-width: 2.4; stroke-linecap: round; filter: drop-shadow(0 0 3px rgba(var(--ds-ev), .8)); }
.gauge .ev { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 4px rgba(var(--ds-ev), .5)); transition: stroke-dasharray .8s ease; }
.gauge .fu { stroke: rgb(var(--ds-fu)); transition: stroke-dasharray .8s ease; }
.gauge .c { position:absolute; inset:0; display:grid; place-items:center; font-size:29px; font-weight:700; letter-spacing:-.03em; color: var(--ds-fg); }
.gauge .c { display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1.05; }
.gauge .c .gf { display:inline-flex; align-items:center; gap:2px; font-size:15px; font-weight:700; letter-spacing:-.02em; margin-top:2px; } .gauge .c .gf svg.i { width:14px; height:14px; transform:none; overflow:visible; }
.gauge .c small { font-size:12px; font-weight:500; color: var(--ds-fg2); }
.t2.batt[data-eui=gauge] { container-type:inline-size; } .t2.batt[data-eui=gauge] > .lg:not(.hv) { display:none; }
.hg { position:relative; width:100%; margin-top:6px; pointer-events:none; }
.t2 .lg.hv { flex-direction:row; justify-content:space-between; gap:6px; margin-top:6px; }
@container (min-width: 250px) { .t2.batt[data-eui=gauge] > .lg:not(.hv) { display:flex; } .t2 .lg.hv { display:none; } .hg { position:absolute; right:-4px; bottom:6px; width:68%; margin:0; } }
.hg svg { display:block; width:100%; overflow:visible; }
.hg > svg path { fill:none; stroke-width:12; stroke-linecap:round; } .hg .tr { stroke: var(--ds-line); } .hg .ev { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 4px rgba(var(--ds-ev), .5)); transition: stroke-dasharray .8s ease; } .hg .fu { stroke: rgb(var(--ds-fu)); transition: stroke-dasharray .8s ease; }
.hg .fg { stroke: rgb(var(--ds-ev)); opacity:.28; } .hg .fp { stroke: rgb(var(--ds-ev)); filter: drop-shadow(0 0 3px rgba(var(--ds-ev), .9)); animation: ds-chgflow 2.4s cubic-bezier(.45,.05,.55,.95) infinite, ds-chgfade 2.4s linear infinite; }
.hg .c { position:absolute; left:0; right:0; bottom:0; display:flex; flex-direction:column; align-items:center; line-height:1.05; font-size:clamp(19px, 12.5cqw, 28px); font-weight:700; letter-spacing:-.03em; color: var(--ds-fg); }
.hg .c small { font-size:12px; font-weight:500; color: var(--ds-fg2); }
.hg .c .gf { display:inline-flex; align-items:center; gap:2px; font-size:clamp(12px, 7cqw, 15px); font-weight:700; letter-spacing:-.02em; margin-top:2px; } .hg .c .gf svg.i { width:14px; height:14px; transform:none; overflow:visible; }
@media (prefers-reduced-motion: reduce) { .hg .fp { animation:none; opacity:0; } }
.cap-h { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.t2 .ts.chg.cap-b { margin:0; max-width:none; padding:2px 10px; border-radius:999px; background: rgba(var(--ds-ac), .15); border:1px solid rgba(var(--ds-ac), .22); font-size:11px; } .t2 .ts.chg.cap-b b { font-size:11px; }
.cap-g { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; } .cap-g.one { grid-template-columns:minmax(0,1fr); }
.cap-c { background: rgba(0,0,0,.22); border:1px solid var(--ds-line); border-radius:16px; padding:9px 10px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.cap-r { display:flex; justify-content:space-between; align-items:center; gap:4px; font-size:11.5px; } .cap-l { display:flex; align-items:center; gap:4px; color: var(--ds-fg2); font-weight:500; min-width:0; } .cap-l .i { --is:13px; color: rgb(var(--cc)); }
.cap-p { color: rgb(var(--cc)); font-size:13px; font-weight:700; }
.cap-v { display:flex; align-items:baseline; gap:4px; } .cap-v b { font-size:clamp(17px, 7cqw, 22px); font-weight:700; color: var(--ds-fg); letter-spacing:-.02em; line-height:1; } .cap-v small { font-size:11px; color: var(--ds-fg2); }
.cap-t { position:relative; height:6px; border-radius:3px; background: var(--ds-line); overflow:hidden; }
.cap-t i { position:absolute; left:0; top:0; bottom:0; border-radius:3px; background: rgb(var(--cc)); transition: width .8s ease; }
.cap-t .fg { right:0; opacity:.28; } .cap-t .fp { width:16%; left:var(--fs); box-shadow:0 0 6px rgba(var(--cc), .9); transition:none; animation: ds-capflow 2.4s cubic-bezier(.45,.05,.55,.95) infinite, ds-chgfade 2.4s linear infinite; }
@keyframes ds-capflow { from { left:var(--fs); } to { left:var(--fe); } }
.cap-f { display:flex; justify-content:space-between; font-size:11.5px; color: var(--ds-fg2); padding:0 2px; } .cap-f b { color: var(--ds-fg); font-weight:600; }
@container (max-width: 249px) { .cap-w { display:none; } }
@media (prefers-reduced-motion: reduce) { .cap-t .fp { animation:none; opacity:0; } }
.knob { --kc: var(--ds-info); position:absolute; right:-18px; bottom:-16px; width: 112px; height: 112px; border-radius:50%; border:0; cursor:pointer; padding:0;
  display:grid; place-items:center; box-sizing:border-box;
  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.16), rgba(255,255,255,.05) 70%); box-shadow: inset 0 0 0 1px var(--ds-line), 0 10px 24px rgba(0,0,0,.25);
  -webkit-tap-highlight-color: transparent; transition: background .3s ease, scale .32s var(--cp-spring), box-shadow .3s ease; }
.knob .i { --is: 32px; color: var(--ds-fg2); transition: color .3s ease; }
.knob.on { background: radial-gradient(circle at 35% 30%, rgba(var(--kc), .95), rgba(var(--kc), .7)); box-shadow: 0 10px 28px rgba(var(--kc), .4); } .knob.on .i { color:#fff; }
.knob { --cp-press:.94; } .knob[disabled] { opacity:.4; }
.knob .ring { position:absolute; inset:-2px; width: calc(100% + 4px); height: calc(100% + 4px); pointer-events:none; overflow:visible; }
.knob .ring rect { fill:none; stroke: rgb(var(--kc)); stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 20 80; animation: ds-dash 1.2s linear infinite; }
.t2.batt { container-type: inline-size; }
@container (max-width: 175px) { .gauge { width:116px; height:116px; right:-28px; bottom:-28px; } .gauge .c { font-size:22px; } .gauge .c .gf { font-size:12px; } .gauge .c small { font-size:10px; } .t2.batt .ts { max-width: 100%; } .t2.batt .lg { margin-top:6px; } }

/* Vehicle */
.veh { display:flex; flex-direction:column; gap:10px; flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; } .veh::-webkit-scrollbar { display:none; }
.box.wide { padding-bottom:14px; }
.dash { position:relative; width:100%; aspect-ratio: 510 / 285; background:#000; border-radius: var(--ds-r); overflow:hidden; color:#fff; --ds-fg:#fff; --ds-fg2:rgba(255,255,255,.72); --ds-line:rgba(255,255,255,.12); --ds-soft:rgba(255,255,255,.06); } /* always on a dark photo: white text on light themes too */
.dash img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition: opacity .5s ease; }
#vclim .dash { container-type:inline-size; }
.dash::after { content:""; position:absolute; inset:0; pointer-events:none; background: linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0) 35%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6)); }
.dov { position:absolute; inset:0; z-index:3; pointer-events:none; }
/* the temperature on the car's screen (same position as the screen in the photo) */
.dscr { position:absolute; left:39.2%; top:24.5%; width:23%; height:27%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:2.2cqw; background: rgba(2,4,8,.82); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), 0 0 3cqw rgba(56,189,248,.12); }
.dbig { font-size: clamp(18px, 6.6cqw, 44px); font-weight:300; letter-spacing:-.03em; line-height:1; } .dbig small { font-size:.42em; font-weight:400; margin-left:1px; letter-spacing:0; opacity:.85; }
.dst { display:inline-flex; align-items:center; gap:.9cqw; margin-top:.8cqw; font-size: clamp(9px, 2.4cqw, 14px); font-weight:600; letter-spacing:.06em; text-transform:uppercase; opacity:.85; }
.dst i { width: clamp(5px, 1.2cqw, 7px); height: clamp(5px, 1.2cqw, 7px); border-radius:50%; background: rgb(var(--ds-bad)); box-shadow:0 0 6px rgb(var(--ds-bad)); } .dst.on i { background: rgb(var(--ds-ok)); box-shadow:0 0 6px rgb(var(--ds-ok)); }
.dov .dpc { position:absolute; left:10px; bottom:10px; pointer-events:auto; display:inline-flex; align-items:center; gap:6px; width:auto; height:32px; min-height:32px; padding:0 12px 0 10px; border-radius:999px; border:1px solid rgba(255,255,255,.14); font-size:12px; font-weight:600; letter-spacing:.01em; line-height:1; color:#fff; background: rgba(10,11,15,.62); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); --is:15px; --bs:32px; }
.dov .dpc svg { width:15px !important; height:15px !important; flex:none; }
.dov .dpc span { white-space:nowrap; }
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
 .ipane .sbtn .nm { display:none; } .ipane .sbtn .i { --is:28px; }
.sbtn { --c: var(--ds-info); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px 2px 9px; min-width:0; border-radius:20px; cursor:pointer; color: var(--ds-fg2);
  border:1px solid var(--ds-line); background: var(--ds-soft); -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring), background .2s ease, border-color .2s ease; }
.sbtn.hot { --c: 251,113,60; } .sbtn.cool { --c: 56,189,248; } .sbtn { --cp-press:.94; }
.sbtn .i { --is: 30px; } .sbtn .nm { font-size:10.5px; line-height:1.15; text-align:center; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sbtn.lv { border-color: rgba(var(--c), .7); background: rgba(var(--c), .16); color: var(--ds-fg); } .ipane .sbtn.lv { background: rgba(14,15,20,.74); } .sbtn.lv .i { color: rgb(var(--c)); --w: currentColor; }
.sbtn .lvl { display:flex; gap:3px; height:4px; } .sbtn .lvl i { width:10px; height:4px; border-radius:2px; background: var(--ds-line); } .sbtn .lvl i.f { background: rgb(var(--c)); }
.sbtn .lvl[hidden] { display:flex !important; visibility:hidden; }
.isop { container-type: inline-size; border-radius: var(--ds-r); overflow:hidden; position:relative; width:100%; flex:1 1 auto; display:flex; align-items:center; background: radial-gradient(ellipse 70% 55% at 50% 72%, #3b4654 0%, #181b21 62%, #0e0f13 100%); }
.isop.noimg { display:none; }
.isoi { position:relative; width:100%; aspect-ratio: 750 / 500; flex:none; } .isoi.sq { aspect-ratio: 1 / 1; max-height:62vh; margin:0 auto; }
.vgrp > .vcol { flex:1 1 auto; }
.isop svg.tl { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1; } .isop svg.tl line { stroke-width:1.4; stroke-linecap:round; opacity:.7; } .isop svg.tl line.hid { stroke-dasharray: 5 5; opacity:.45; } .isop svg.tl .halo { opacity:.25; } .isop svg.tl circle.hid { fill:none; stroke-width:1.4; stroke-dasharray: 3 3; opacity:.7; }
.isop .tp { position:absolute; z-index:2; transform: translate(-50%,-50%); padding:8px 12px; border-radius:14px; border:1px solid; background: rgba(14,15,20,.72); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); text-align:center; line-height:1.15; font-weight:700; white-space:nowrap; }
.isop .tp .n { font-size:clamp(12px,1.8cqw,14px); font-weight:600; color:var(--ds-fg2); margin-bottom:3px; } .isop .tp .v { font-size:clamp(20px,3cqw,24px); display:flex; align-items:baseline; justify-content:center; gap:4px; } .isop .tp .u { font-size:clamp(11px,1.6cqw,13px); font-weight:500; } .isop .tp .check { font-size:14px; margin-left:2px; } .isop .tp .s { font-size:clamp(11px,1.6cqw,12px); font-weight:600; margin-top:3px; white-space:normal; max-width:140px; } .isop .tp .s:empty { display:none; }
.isop .tp.ok { border-color: rgba(var(--ds-ok), .4); color: rgb(var(--ds-ok)); background: rgba(14,24,22,.78); } .isop .tp.bad { border-color: rgb(var(--ds-bad)); color: rgb(var(--ds-bad)); background: rgba(var(--ds-bad), .18); animation: ds-pill 1.8s ease-in-out infinite; } .isop .tp.na { border-color: rgba(148,163,184,.7); color: rgb(148,163,184); }
@container (max-width:360px) { .isop .tp { padding:6px 8px; border-radius:12px; } .isop .tp .n { font-size:11px; } .isop .tp .v { font-size:19px; } .isop .tp .s { max-width:96px; } }
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
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); -webkit-tap-highlight-color: transparent; transition: scale .32s var(--cp-spring), border-color .2s ease; }
.spot.lv { border-color: rgba(var(--c), .65); } .spot.hot { --c: 251,113,60; } .spot.cool { --c: 56,189,248; }
.spot .i { --is: 20px; } .spot.lv .i { color: rgb(var(--c)); } .spot { --cp-press:.93; }
.spot .lvl { display:flex; gap:2px; } .spot .lvl i { width:7px; height:3px; border-radius:2px; background: rgba(255,255,255,.25); } .spot .lvl i.f { background: rgb(var(--c)); }
.spot .nm { font-size:9.5px; opacity:.75; white-space:nowrap; }
.vcol { display:flex; flex-direction:column; gap:10px; }
/* Number picker (adapted from deepal-number-picker) */
.pk { position:relative; padding: 12px 0 10px; border-radius:18px; background: var(--ds-soft); border:1px solid var(--ds-line); user-select:none; -webkit-user-select:none; --pkbg: var(--ha-card-background, var(--card-background-color, #1c1c1c)); }
.pqx { display:flex; align-items:center; gap:10px; margin-top:10px; padding:8px 10px; min-height:56px; border:1px solid var(--ds-line); border-radius:var(--ctl-cta, 16px); background:var(--ds-soft); } .pqx[hidden] { display:none; }
.pqi { flex:none; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background:rgba(var(--ds-ac),.18); color:rgb(var(--ds-ac)); } .pqi .i { --is:20px; }
.pqs { flex:1; min-width:0; display:flex; align-items:center; gap:6px; } .pqs > * { min-width:0; }
.pqs button { flex:1 1 0; min-height:40px; padding:0 6px; border:1px solid var(--ds-line); border-radius:var(--ctl-pill, 999px); background:transparent; color:var(--ds-fg); font:inherit; font-size:13px; white-space:nowrap; cursor:pointer; }
.pqs .pqc { flex:2 1 0; display:flex; align-items:center; justify-content:center; gap:6px; background:var(--ds-soft); color:var(--ds-fg); } .pqs .pqc i { font-style:normal; color:var(--ds-fg2); }
.pqs .pqg { flex:1.3 1 0; border:0; background:rgb(var(--ds-ac)); color:rgb(var(--ds-ac-ink)); font-weight:700; } .pqs .pqg.stop { background:rgba(var(--ds-bad),.18); color:rgb(var(--ds-bad)); } .pqs .pqg:disabled { opacity:.55; cursor:default; }
.pqs .pqm { flex:1 1 auto; text-align:left; font-size:13px; color:var(--ds-fg2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .pqs .pqm b { color:var(--ds-fg); font-variant-numeric:tabular-nums; }
.pqs .sp { display:inline-block; width:12px; height:12px; margin-right:6px; vertical-align:-1px; border-radius:50%; border:2px solid currentColor; border-top-color:transparent; animation: ds-cpsp .8s linear infinite; } @keyframes ds-cpsp { to { transform:rotate(360deg); } }
.cseats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding-top:2px; }
.cseats .sbtn { background:none; border:0; padding:0; gap:5px; min-width:0; }
.cseats .sbtn .cc { width:54px; height:54px; border-radius:50%; display:grid; place-items:center; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg2); transition: background .2s, border-color .2s, color .2s; }
.cseats .sbtn .cc .i { --is:24px; }
.cseats .sbtn.lv .cc { border-color: rgba(var(--c), .75); background: rgba(var(--c), .18); color: rgb(var(--c)); box-shadow: 0 0 14px rgba(var(--c), .25); }

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
.tile[data-ent], .t2[data-ent], .total[data-ent] { --cp-press:.97; }
.status[data-ent], .total[data-ent] { cursor:pointer; }

/* Information */
.info { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; } .info::-webkit-scrollbar { display:none; }
.info[data-r] { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 34px), transparent); }
.info[data-l] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px); mask-image: linear-gradient(90deg, transparent, #000 34px); }
.info[data-l][data-r] { -webkit-mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); mask-image: linear-gradient(90deg, transparent, #000 34px, #000 calc(100% - 34px), transparent); }
.tile:focus-visible, .total:focus-visible { outline: 2px solid rgb(var(--ds-info)); outline-offset: 2px; }
.tile { flex:1 0 auto; min-width: 88px; display:flex; align-items:center; gap:11px; padding:12px 15px; border-radius: min(var(--ds-tr), 16px); background: var(--ds-soft); border:1px solid var(--ds-line); }
.tile .i { --is: 24px; color: rgb(var(--ds-ac, var(--ds-ok, 52,211,153))); }
.tile .v { font-size:16px; font-weight:600; color: var(--ds-fg); white-space:nowrap; } .tile .v small { display:block; font-size:12px; font-weight:500; color: var(--ds-fg2); } .tile .l { font-size:13px; color: var(--ds-fg2); white-space:nowrap; }
.tells { position:absolute; right:14px; bottom:14px; z-index:8; display:flex; align-items:center; gap:4px; } .tells[hidden] { display:none; }
.tell { --c: var(--ds-bad); position:relative; width:36px; height:36px; padding:0; border:0; background:none; display:grid; place-items:center; cursor:pointer;
  color: rgb(var(--c)); filter: drop-shadow(0 0 8px rgba(var(--c), .5)) drop-shadow(0 1px 4px rgba(0,0,0,.75)); -webkit-tap-highlight-color: transparent; }
.tell .i, .tell .tt { --is: 32px; } .tell.ok { --c: var(--ds-ok); } .tell.warn { --c: var(--ds-warn); } .tell.bad { --c: var(--ds-bad); } .tell.na { --c: 148,163,184; } .tell { --cp-press:.92; }
.tell .n { position:absolute; right:-1px; top:-1px; min-width:16px; height:16px; padding:0 4px; box-sizing:border-box; border-radius:8px; display:grid; place-items:center; font-size:10px; font-weight:700; line-height:1; color:#111; background: rgb(var(--c)); filter:none; }
.tell.more { width:auto; min-width:34px; height:28px; padding:0 9px; border-radius:14px; font-size:13px; font-weight:700; color:#fff; filter:none; background: rgba(15,18,24,.62); border:1px solid rgba(255,255,255,.28); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
/* diagnostics popup */
.box.dg { min-height:0; max-height:86%; } .box.dg .hd { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dgcard { --c: var(--ds-ok); display:flex; align-items:center; gap:14px; margin:2px 0 12px; padding:14px 16px; border-radius:18px; border:1px solid rgba(var(--c), .35); background: rgba(var(--c), .12); }
.dgcard.warn { --c: var(--ds-warn); } .dgcard.bad { --c: var(--ds-bad); } .dgcard.na { --c: 148,163,184; }
.dgbig { flex:none; width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background: rgba(var(--c), .2); color: rgb(var(--c)); } .dgbig .i { --is:24px; }
.dgcard b { display:block; font-size:17px; font-weight:700; line-height:1.2; } .dgcard small { display:block; margin-top:2px; font-size:12.5px; color: var(--ds-fg2); }
.dgtog { width:100%; display:flex; align-items:center; gap:8px; margin:12px 0 6px; padding:10px 12px; min-height:44px; border-radius:14px; border:1px solid var(--ds-line); background: var(--ds-soft); color: rgb(var(--ds-ok)); font:inherit; font-size:13px; font-weight:600; cursor:pointer; text-align:left; -webkit-tap-highlight-color: transparent; }
.dgtog .i { --is:20px; flex:none; } .dgtog span { flex:1; } .dgtog em { font-style:normal; font-weight:600; padding:1px 8px; border-radius:9px; background: rgba(var(--ds-ok), .16); } .dgtog { --cp-press:.985; }
.dgsum { margin:4px 2px 10px; font-size:13px; font-weight:600; color: var(--ds-fg2); } .dgsum.ok { color: rgb(var(--ds-ok)); } .dgsum.bad { color: rgb(var(--ds-bad)); }
.dgbody { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding-right:2px; }
.dgh { display:flex; align-items:center; gap:7px; margin:12px 2px 6px; font-size:11.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: var(--ds-fg2); } .dgh em { font-style:normal; font-weight:600; padding:1px 7px; border-radius:9px; background: var(--ds-soft); letter-spacing:0; }
.dgh.bad { color: rgb(var(--ds-bad)); } .dgh.ok { color: rgb(var(--ds-ok)); }
.dglist { display:grid; grid-template-columns: 1fr; gap:6px; } .dglist.ok, .dglist.na { grid-template-columns: 1fr 1fr; }
.dgrow { --c: var(--ds-ok); display:flex; align-items:center; gap:10px; padding:8px 10px; min-height:52px; border-radius:14px; border:1px solid rgba(var(--c), .3); background: rgba(var(--c), .09); color: var(--ds-fg); text-align:left; cursor:pointer; font:inherit; -webkit-tap-highlight-color: transparent; }
.dgrow .tt, .dgrow .i { --is: 34px; color: rgb(var(--c)); } .dgrow > span { min-width:0; display:flex; flex-direction:column; gap:1px; } .dgrow b { font-size:13px; font-weight:600; line-height:1.2; overflow-wrap:anywhere; }
.dgrow small { font-size:11.5px; color: rgb(var(--c)); } .dgrow.warn { --c: var(--ds-warn); } .dgrow.bad { --c: var(--ds-bad); } .dgrow.na { --c: 148,163,184; }
.dgrow.bad, .dgrow.warn { background: rgba(var(--c), .14); border-color: rgba(var(--c), .55); } .dgrow.ok .tt, .dgrow.ok .i { --is: 28px; } .dgrow { --cp-press:.985; }
.dgnew { display:flex; flex-direction:column; gap:8px; margin:0 0 6px; padding:10px 12px; border-radius:14px; border:1px dashed rgba(var(--ds-info), .6); background: rgba(var(--ds-info), .1); } .dgnew b { display:block; font-size:13px; } .dgnew small { display:block; margin-top:2px; font-size:11.5px; color: var(--ds-fg2); }
.dgnew .btnrow { margin:0; justify-content:flex-end; } .dgfoot { margin-top:10px; justify-content:center; }
.tile.bad .i { color: rgb(var(--ds-bad)); }

/* Diagnostics */
.diag { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:10px; border:1px solid var(--ds-line); border-radius:16px; background:var(--ds-soft); } .diag[data-empty-diag] { display:none; }
.diag-item{display:grid;place-items:center;width:40px;min-height:40px;padding:6px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--ds-fg2);cursor:pointer}.diag-item .i{--is:26px}.diag-item.bad{color:rgb(var(--ds-bad));background:rgba(var(--ds-bad),.1)}.diag-item.warn{color:rgb(var(--ds-warn));background:rgba(var(--ds-warn),.1)}.diag-item.ok{color:rgb(var(--ds-ok))}.diag-item.na{opacity:.5}
.chgbox { position:absolute; z-index:8; top:50px; left: min(calc(50% + 29.8% * var(--ds-scale, 1.2) + 1px), calc(100% - 20px)); transform: translateX(-100%); display:flex; flex-direction:column; align-items:flex-end; gap:1px; white-space:nowrap; text-align:right; font-variant-numeric: tabular-nums; color: rgb(var(--ds-ac)); text-shadow: 0 1px 7px rgba(0,0,0,.9), 0 0 14px rgba(var(--ds-ac), .4); }
.chgbox .a { font-size:21px; font-weight:800; line-height:1.05; letter-spacing:-.01em; }
.chgbox .b { font-size:12.5px; font-weight:600; } .chgbox .b em { font-style:normal; font-weight:500; opacity:.8; text-transform:lowercase; }
.chgbox .c { font-size:11px; font-weight:700; letter-spacing:.08em; margin-right:-.08em; text-transform:uppercase; opacity:.9; } /* the negative margin cancels the gap letter-spacing leaves after the last letter: the right edge lines up with the other rows */
.chgbox.line { flex-direction:row; align-items:center; gap:6px; font-size:13.5px; font-weight:700; } .chgbox .i { --is:15px; } .chgbox i { font-style:normal; opacity:.5; }
.chgbox.text, .chgbox.big { top:46px; left: min(calc(50% + 29.8% * var(--ds-scale, 1.2) - 16px), calc(100% - 20px)); }
.chgbox.big .a { font-size:34px; font-weight:800; line-height:1; } .chgbox.big .a small { font-size:16px; font-weight:700; margin-left:2px; }
.chgbox.beside { top: calc(50% - 7.9% * var(--ds-scale, 1.2) - 10px); transform: translate(-100%, -50%); left: calc(50% + 29.8% * var(--ds-scale, 1.2) - 24px); }
/* the text guide is not dashed: so it does not look like the dashed flow on the cable */
.chgbox.beside::after { content:""; position:absolute; right:-24px; top:50%; width:20px; height:2px; margin-top:-1px; border-radius:2px; background: linear-gradient(90deg, rgba(var(--ds-ac), .9), rgba(var(--ds-ac), .15)); }
.chgbox.beside::before { content:""; position:absolute; right:-28px; top:50%; width:6px; height:6px; margin-top:-3px; border-radius:50%; background: rgba(var(--ds-ac), .35); border:1.5px solid rgb(var(--ds-ac)); box-sizing:border-box; }
.chgline { position:absolute; z-index:8; left: calc(50% + 29.8% * var(--ds-scale, 1.2)); top:74px; width:2px; margin-left:-1px; border-radius:2px; height: max(0px, calc(50% - 7.9% * var(--ds-scale, 1.2) - 84px)); background: linear-gradient(180deg, rgba(var(--ds-ac), .85), rgba(var(--ds-ac), .15)); filter: drop-shadow(0 0 3px rgba(var(--ds-ac), .6)); }
.chgline.s-text, .chgline.s-big, .chgline.s-beside { display:none; }
.chgbox[hidden], .chgline[hidden] { display:none; }
/* Car View: the socket is in a different place than in the photos and moves with the width and zoom; the charging text is tied to it (cqw = 1% of the hero width) */
/* Car View background by time of day: dark-theme friendly skies (deep blue by day, dusk in the evening); the soft ground shadow under the car stays */
.hero[data-style="carview"][data-sky="morning"] { background: radial-gradient(ellipse 60% calc(.5 * 100cqw / var(--ds-ar0, 1.4)) at 56% calc(100% - .2 * 100cqw / var(--ds-ar0, 1.4)), rgba(20,30,45,.38) 0%, rgba(20,30,45,0) 70%), linear-gradient(180deg, #1f3a5a 0%, #3e6388 52%, #86806f 100%); }
.hero[data-style="carview"][data-sky="afternoon"] { background: radial-gradient(ellipse 60% calc(.5 * 100cqw / var(--ds-ar0, 1.4)) at 56% calc(100% - .2 * 100cqw / var(--ds-ar0, 1.4)), rgba(15,30,50,.40) 0%, rgba(15,30,50,0) 70%), linear-gradient(180deg, #17365a 0%, #2c5b8e 52%, #5683b0 100%); }
.hero[data-style="carview"][data-sky="evening"] { background: radial-gradient(ellipse 60% calc(.5 * 100cqw / var(--ds-ar0, 1.4)) at 56% calc(100% - .2 * 100cqw / var(--ds-ar0, 1.4)), rgba(20,10,30,.45) 0%, rgba(20,10,30,0) 70%), linear-gradient(180deg, #1c1d4a 0%, #54386a 50%, #a8654f 100%); }
.hero[data-style="carview"][data-sky^="neon"] .shade-top { opacity:.55; } .hero[data-style="carview"][data-sky^="neon"] .shade-left { opacity:.6; } .hero[data-style="carview"][data-sky^="neon"] .hero-top { text-shadow: 0 1px 6px rgba(0,0,0,.6); }
.hero[data-style="carview"][data-sky="morning"] .shade-top, .hero[data-style="carview"][data-sky="afternoon"] .shade-top, .hero[data-style="carview"][data-sky="evening"] .shade-top { opacity:.6; }
.hero[data-style="carview"][data-sky="morning"] .shade-left, .hero[data-style="carview"][data-sky="afternoon"] .shade-left, .hero[data-style="carview"][data-sky="evening"] .shade-left { opacity:.7; }
.hero[data-style="carview"][data-sky="morning"] .hero-top, .hero[data-style="carview"][data-sky="afternoon"] .hero-top, .hero[data-style="carview"][data-sky="evening"] .hero-top { text-shadow: 0 1px 6px rgba(0,0,0,.45); }
.hero[data-style="carview"] { --ds-px: calc(50% + var(--ds-cvs, 1.08) * 26.47cqw); --ds-py: calc(50% + var(--ds-cvs, 1.08) * .27cqw); }
.hero[data-style="carview"] .chgbox { top: calc(var(--ds-py) - 55px); left: min(calc(var(--ds-px) + 1px), calc(100% - 20px)); }
.hero[data-style="carview"] .chgbox.text, .hero[data-style="carview"] .chgbox.big { top: calc(var(--ds-py) - 58px); left: min(calc(var(--ds-px) - 16px), calc(100% - 20px)); }
.hero[data-style="carview"] .chgbox.beside { top: var(--ds-py); left: calc(var(--ds-px) - 24px); } /* the guide dot sits on the centre of the port pulse */
.hero[data-style="carview"] .chgline { left: var(--ds-px); top: calc(var(--ds-py) - 37px); height: 27px; }
.hero { container-type: inline-size; }
/* "Card only" page: on a phone the card is at least as tall as the screen, like an app (computers keep the normal card). The hero takes the height the other blocks leave and the photo keeps its ratio at the bottom of it. If the blocks are taller than the screen, the card grows and the page scrolls normally – the card never scrolls inside itself. */
@media (max-width:699px) {
  :host([data-app]) { height:auto; }
  :host([data-app]) ha-card { height:auto; min-height: calc(var(--card-page-h, 100dvh) - var(--card-pad, 0px)); box-sizing:border-box; }
  :host([data-app]) ha-card > .hero { flex:1 1 0; aspect-ratio:auto; min-height:max(230px, 32dvh); }
  :host([data-app]) .hbox { top:auto; height: calc(100cqw / var(--ds-ar0, 1.7778)); -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16%); mask-image: linear-gradient(to bottom, transparent 0, #000 16%); }
  :host([data-app]) ha-card > :not(.hero):not(.sheet) { flex:none; }
}
@container (max-width: 370px) { .chgbox.line { font-size:12.5px; } .chgbox .a { font-size:18px; } .chgbox.big .a { font-size:28px; } }
.charge { display:flex; flex-direction:column; gap:10px; padding:10px 14px 14px; border-radius:18px; border:1px solid rgba(var(--ds-ac), .28); background: linear-gradient(145deg, rgba(var(--ds-ac), .10), var(--ds-soft)); }
.cg-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px 10px; min-height:44px; } .cg-state { display:flex; align-items:center; gap:8px; min-width:0; font-size:13px; } .cg-state .i { --is:18px; color: rgb(var(--ds-ac)); } .cg-state b { font-weight:600; white-space:nowrap; } .cg-state i { font-style:normal; font-size:11px; font-weight:700; letter-spacing:.06em; padding:2px 8px; border-radius:999px; background: rgba(var(--ds-ac), .16); color: rgb(var(--ds-ac)); }
.cg-lim { display:flex; align-items:center; gap:8px; min-height:36px; padding:4px 4px 0; font-size:12.5px; border-top:1px solid var(--ds-line); color: var(--ds-fg2); } .cg-lim .i { --is:16px; color: rgb(var(--c, var(--ds-ac))); } .cg-lim span { flex:1; min-width:0; } .cg-lim.ok { --c: var(--ds-ac); } .cg-lim.warn { --c: var(--ds-warn); } .cg-lim.bad { --c: var(--ds-bad); } .cg-lim.info { --c: var(--ds-info); } .cg-lim.bad span { color: rgb(var(--ds-bad)); } .cg-lbtn { min-height:36px; padding:0 12px; border-radius:12px; border:1px solid rgba(var(--ds-ac), .45); background:transparent; color: rgb(var(--ds-ac)); font:inherit; font-weight:600; cursor:pointer; }
.cg-stats { display:grid; grid-auto-flow:column; grid-auto-columns:max-content; justify-content:space-evenly; } .cg-stat { padding:0 clamp(8px,3vw,18px); text-align:center; border-left:1px solid var(--ds-line); } .cg-stat:first-child { border-left:0; } .cg-stat b { display:block; font-size:17px; font-weight:700; color: var(--ds-fg); white-space:nowrap; font-variant-numeric:tabular-nums; } .cg-stat span { display:block; margin-top:2px; font-size:11.5px; color: var(--ds-fg2); }
.upd { align-self:stretch; margin:6px 14px 0; display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid rgba(var(--ds-warn),.5); border-radius:12px; background:rgba(var(--ds-warn),.12); color:var(--ds-fg); font-size:12px; text-align:left; cursor:pointer; } .upd[hidden] { display:none; } .upd .i { --is:16px; flex:none; color:rgb(var(--ds-warn)); }
.foot[hidden] { display:none; } .foot { position:relative; }
/* Settings gear: a small round glass button on the image, bottom right, opposite the lock status */
.foot { position:absolute; right:12px; bottom:12px; z-index:3; width:26px; height:26px; padding:0; justify-content:center; border-radius:50%; background: rgba(10,11,15,.55); border:1px solid rgba(255,255,255,.16); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: rgba(255,255,255,.8); opacity:1; }
.foot .sets { gap:0; } .foot .i { --is:15px !important; }
.foot { display:inline-flex; align-items:center; cursor:pointer; }
.foot::before { content:""; position:absolute; inset:-9px; } /* 44px touch area around the 26px button */
.companion-credit{font-size:10px;line-height:1.5;color:var(--ds-fg2);opacity:.7;text-align:center;margin:0 12px 10px;pointer-events:none}.foot:hover, .foot:focus-visible { opacity:1; } .foot .i { --is: 14px; } .foot .sets { display:inline-flex; align-items:center; gap:6px; } .foot.nosets { cursor:default; pointer-events:none; } .foot.nosets .sets { display:none; }

/* Sheet */
.sheet { overscroll-behavior: contain; position:fixed; inset:0; z-index:100000; display:none; align-items:flex-end; justify-content:center; padding:10px; background: rgba(0,0,0,calc(.62 * var(--scrim, 1))); backdrop-filter: blur(calc(var(--scrim, 1) * 12px)); -webkit-backdrop-filter: blur(calc(var(--scrim, 1) * 12px)); } /* the blur follows the drawer: it grows while it opens, shrinks as it is dragged down or closed */
/* fluid performance: while a window is open or the card is off screen, the effects behind freeze */
ha-card:has(.sheet.show) *:not(.sheet):not(.sheet *), ha-card.off *, ha-card.off *::before, ha-card.off *::after { animation-play-state: paused !important; }
.sheet.show, .sheet.closing { display:flex; } .sheet.closing { pointer-events:none; } /* the drawer spring sets --dy and --scrim */
@media (min-width:640px) { .sheet { align-items:center; } .box { opacity: var(--scrim, 1); } }
.box { overscroll-behavior: contain; width:100%; max-width:560px; max-height:70%; min-height:min(300px, 100%); box-sizing:border-box; display:flex; flex-direction:column; padding:var(--cp-sheet-p) var(--cp-sheet-p) 12px; border-radius:var(--cp-sheet-r); background: linear-gradient(var(--ha-card-background, var(--card-background-color, #222)), var(--ha-card-background, var(--card-background-color, #222))), var(--primary-background-color, #1c1c1c); /* opaque even when the theme card colour is translucent: the hero never shows through */ border:1px solid var(--ds-line); transform: translate3d(0, var(--dy, 0px), 0); will-change: transform; overflow:hidden; }
.box.wide { overflow:hidden; max-height:94%; } .box.confirm { min-height:0; }
.stpanel { display:flex; flex-direction:column; gap:12px; overflow-y:auto; overscroll-behavior:contain; padding:2px 2px 4px; min-height:0; }
.sth { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; } .sth b { font-size:34px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; } .sth span { margin-left:4px; font-size:15px; font-weight:600; color: var(--ds-fg2); } .sth small { font-size:11.5px; color: var(--ds-fg2); text-align:right; }
.sttabs { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; padding:4px; border-radius:12px; background: rgba(var(--rgb-primary-text-color,255,255,255),.05); border:1px solid var(--ds-line); } .sttabs button { height:36px; border:0; border-radius:9px; background:transparent; color: var(--ds-fg2); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; } .sttabs button.on { background: rgba(var(--ds-ac, var(--ds-ok)), .16); color: rgb(var(--ds-ac, var(--ds-ok))); }
.stc { padding:10px 8px 4px; border-radius:16px; background: rgba(var(--rgb-primary-text-color,255,255,255),.035); border:1px solid var(--ds-line); } .stsvg { display:block; width:100%; height:auto; touch-action:pan-y; cursor:crosshair; }
.stsvg .gl { stroke: var(--ds-line); stroke-dasharray:3 4; } .stsvg .ax { fill: var(--ds-fg2); font-size:9px; } .stsvg .bar { fill: rgb(var(--ds-ac, var(--ds-ok))); opacity:.85; } .stsvg .bar.z { opacity:.25; } .stsvg .bar.sel { opacity:1; stroke: var(--ds-fg); stroke-width:1.2; }
.stsvg .ln { fill:none; stroke: rgb(var(--ds-ac, var(--ds-ok))); stroke-width:2; stroke-linejoin:round; stroke-linecap:round; } .stsvg .area { fill: rgba(var(--ds-ac, var(--ds-ok)), .12); } .stsvg .band { fill: rgba(var(--ds-info), .14); } .stsvg .cur { stroke: var(--ds-fg2); stroke-dasharray:3 3; } .stsvg .dot { fill: rgb(var(--ds-ac, var(--ds-ok))); stroke: var(--ds-fg); stroke-width:1.5; }
.stread { margin:-4px 0 0; font-size:12px; color: var(--ds-fg2); text-align:center; min-height:16px; }
.stg { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-auto-rows:1fr; gap:6px; } .stk { display:flex; flex-direction:column; justify-content:center; gap:2px; padding:7px 10px; border-radius:14px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color,255,255,255),.04); min-width:0; min-height:48px; } .stk .sv { display:flex; align-items:baseline; justify-content:space-between; gap:6px; min-width:0; } .stk b { flex:0 0 auto; font-size:14px; line-height:1.2; font-weight:800; font-variant-numeric:tabular-nums; white-space:nowrap; } .stk i { flex:0 1 auto; min-width:0; font-style:normal; font-size:9.5px; line-height:1.2; opacity:.75; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .stk small { font-size:10.5px; line-height:1.2; color: var(--ds-fg2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rgt { display:grid; gap:9px; margin:4px 0 0; } .rgt h4 { margin:8px 0 0; font-size:12.5px; font-weight:600; color:var(--ds-fg2); letter-spacing:.02em; } .rgt .r { display:grid; grid-template-columns:70px minmax(0,1fr) 58px; align-items:center; gap:10px; font-size:12.5px; color:var(--ds-fg2); } .rgt .r .b { height:10px; border-radius:5px; background:var(--ds-soft); overflow:hidden; } .rgt .r .b i { display:block; height:100%; border-radius:5px; background:rgb(var(--ds-ac)); opacity:.5; } .rgt .r.now .b i { opacity:1; } .rgt .r.now > span { color:var(--ds-fg); } .rgt .r b { color:var(--ds-fg); text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
.rgtog { width:100%; display:flex; align-items:center; gap:8px; min-height:44px; padding:10px 12px; border-radius:14px; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); font:inherit; font-size:13px; font-weight:600; cursor:pointer; } .rgtog span { flex:1; text-align:left; } .rgtog .i { --is:20px; flex:none; }
.rginfo { display:grid; gap:6px; margin:0; padding:12px; border-radius:14px; border:1px solid var(--ds-line); background: var(--ds-soft); font-size:12px; color: var(--ds-fg2); } .rginfo b { color: var(--ds-fg); } .rginfo[hidden], .rgtemp[hidden] { display:none; }
.stnote { margin:0; font-size:11px; } .stsvg .ln2 { fill:none; stroke: var(--ds-fg2); stroke-width:2; stroke-dasharray:5 4; stroke-linecap:round; stroke-linejoin:round; pointer-events:none; } .rgl { display:flex; gap:14px; flex-wrap:wrap; padding:0 6px 4px; font-size:11px; color: var(--ds-fg2); } .rgl span { display:inline-flex; align-items:center; gap:6px; } .rgl i { width:16px; height:0; border-top:3px solid rgb(var(--ds-ac, var(--ds-ok))); border-radius:2px; } .rgl i.p { border-top:2px dashed var(--ds-fg2); } .stg.rg2, .stg.rg3, .stg.rg4 { grid-template-columns:repeat(var(--n),minmax(0,1fr)); } .stg.rg2 { --n:2; } .stg.rg3 { --n:3; } .stg.rg4 { --n:4; } .stg.rg2 .stk, .stg.rg3 .stk, .stg.rg4 .stk { align-items:center; text-align:center; padding:8px 4px; } .stg.rg2 .stk small, .stg.rg3 .stk i, .stg.rg4 .stk i { flex:none; font-size:10.5px; opacity:.85; } .stg.rg3 .stk small, .stg.rg4 .stk small { max-width:100%; font-size:10px; } @media (max-width:340px) { .stg:not(.rg2):not(.rg3):not(.rg4) { grid-template-columns:repeat(2,minmax(0,1fr)); } }
/* mobile: the confirmation window does not stick to the bottom edge (bottom bar/gestures) – it moves up and the buttons grow */
@media (max-width:639px) {
  /* mobile: the window is a "bottom sheet" stuck to the bottom edge, edge to edge, with only the top corners rounded; the background reaches the bottom and the content sits above the phone's rounded corners/gesture bar */
  .sheet { padding:0; } ha-card[data-ppad] .sheet { padding:0; }
  .box, ha-card[data-ppad] .box { max-width:none; border-radius:var(--cp-sheet-r) var(--cp-sheet-r) 0 0; border-inline:0; border-bottom:0; max-height:92%; padding-bottom: calc(max(12px, env(safe-area-inset-bottom, 0px)) + 26px); box-shadow: 0 -10px 40px rgba(0,0,0,.45); }
  .box.wide { max-height:92%; }
  .box.confirm h3 { font-size:18px; } .box.confirm p.c { font-size:14px; margin:8px 0 16px; }
  .box.confirm .btnrow { gap:10px; } .box.confirm .btn { min-height:54px; font-size:16px; border-radius:var(--ctl-cta); }
}
.box h3 { margin:0; font-size:16px; font-weight:600; color: var(--ds-fg); } .box p.c { margin:6px 0 12px; font-size:13px; color: var(--ds-fg2); text-align:center; }
.confirm { text-align:center; } .confirm .hd { text-align:left; }
.lkb { --st: var(--ds-ac); text-align:center; margin:14px 0 4px; } .lkb.w { --st: var(--ds-warn); } .lkb.b { --st: var(--ds-bad); } .lkt { font-size:26px; font-weight:600; color: rgb(var(--st)); } .lks { margin-top:3px; font-size:13px; color: var(--ds-fg2); }
.lksw { display:flex; gap:4px; padding:4px; margin-top:14px; border-radius:calc(var(--cp-item-r) + 4px); background: var(--cp-off-bg); border:1px solid var(--cp-off-line); }
.lksw button { flex:1; min-height:64px; border:0; border-radius:var(--cp-item-r); background:transparent; color: var(--ds-fg2); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font:inherit; font-size:14px; cursor:pointer; } .lksw button .i { --is:24px; }
.lksw button.on { color: rgb(var(--ds-ac)); background: rgba(var(--ds-ac), .16); box-shadow: inset 0 0 0 2px rgb(var(--ds-ac)); } .lksw button.on.w { color: rgb(var(--ds-warn)); background: rgba(var(--ds-warn), .16); box-shadow: inset 0 0 0 2px rgb(var(--ds-warn)); }
.lksw button:disabled { opacity:.6; cursor:default; } .lksw button.go { color: var(--cp-accent); background: var(--cp-on-bg); box-shadow: inset 0 0 0 1px var(--cp-on-line); } .lkh.q { color: var(--ds-fg); font-weight:600; font-size:14px; }
.btn.ic { display:flex; align-items:center; justify-content:center; gap:8px; } .btn.ic .i { --is:20px; }
.t2.batt { position:relative; } .t2w { position:relative; display:flex; min-width:0; } .t2w > .t2 { flex:1; min-width:0; } @container (min-width:176px) { .t2w:has(> .cpb) .gauge { right:-38px; bottom:-46px; } } /* on a wide tile the ring would touch the clock button, so it sits a little lower */ /* the plan button sits beside the tile, not inside it, so the two controls never nest */
.cpb { position:absolute; top:8px; right:8px; z-index:3; width:28px; height:28px; padding:0; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg2); display:flex; align-items:center; justify-content:center; cursor:pointer; } .cpb .i { --is:17px; } .cpb.on { color: rgb(var(--ds-ac)); border-color: rgba(var(--ds-ac), .5); }
.tile[data-plan] { position:relative; cursor:pointer; } .tile[data-plan] .cpd { top:10px; right:12px; }
.tile[data-cl-tile] { cursor:default; } .tile[data-cl-tile="stopped"] { cursor:pointer; } .tile[data-cl-tile="paused"] .i, .tile[data-cl-tile="unavailable"] .i, .tile[data-cl-tile="no_target"] .i { color: rgb(var(--ds-warn)); } .tile[data-cl-tile="failed"] .i { color: rgb(var(--ds-bad)); }
.cpd { position:absolute; top:-2px; right:-2px; width:9px; height:9px; border-radius:50%; background: rgb(var(--ds-ac)); } .cpd::after { content:""; position:absolute; inset:0; border-radius:50%; background: rgb(var(--ds-ac)); animation: cppulse 1.8s ease-out infinite; }
@keyframes cppulse { 0% { transform:scale(1); opacity:.7; } 100% { transform:scale(3); opacity:0; } } @media (prefers-reduced-motion: reduce) { .cpd::after { animation:none; } }
.cpp { padding: 4px 2px 2px; min-width:0; } .cpr { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; box-sizing:border-box; margin:6px 0 14px; padding:10px 12px; border:1px solid var(--ds-line); border-radius: var(--ctl-r); background: var(--ds-soft); color: var(--ds-fg); font:inherit; text-align:left; cursor:pointer; } .cpr > span { flex:1; min-width:0; font-size:15px; } .cpr small { display:block; margin-top:2px; font-size:12px; color: var(--ds-fg2); }
.cpc { box-sizing:border-box; display:grid; align-content:start; gap:8px; min-width:0; padding:12px; border:1px solid var(--ds-line); border-radius: var(--ctl-r); background: var(--ds-soft); }
.pc.cpq .cpc > .lab { min-height:26px; } .pc.cpq .cpc input[type=time] { width:100%; box-sizing:border-box; }
.pc .cpfp { position:relative; flex:none; min-height:0; margin:0; padding:3px 10px; border:1px solid var(--ds-line); border-radius:9px; background:transparent; color:var(--ds-fg2); font:inherit; font-size:12px; font-weight:600; line-height:1.3; cursor:pointer; } .cpfp::after { content:""; position:absolute; inset:-9px -6px; }
.pc .cpfp.on { border-color: color-mix(in srgb, rgb(var(--ds-ac)) 45%, transparent); background: color-mix(in srgb, rgb(var(--ds-ac)) 14%, transparent); color: color-mix(in srgb, rgb(var(--ds-ac)) 70%, var(--ds-fg)); } .pc .cpfp:focus-visible { outline:2px solid rgb(var(--ds-ac)); outline-offset:2px; } .pc .cpfp:disabled { opacity:.6; cursor:default; }
.cpfb { box-sizing:border-box; min-height:46px; padding:6px 12px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:2px 10px; border:1px solid var(--ds-line); border-radius: var(--ctl-r); background: var(--ds-card, transparent); } .cpfb b { min-width:0; font-size:14px; font-weight:600; color:var(--ds-fg); } .cpfb span { font-size:12px; color:var(--ds-fg2); }
.pc.cpq .two { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap:10px; align-items:stretch; } @media (max-width:300px) { .pc.cpq .two { grid-template-columns: minmax(0, 1fr) !important; } }
.pc.cpq .cpc, .cpr { padding:10px; border-radius: var(--ctl-r); } .cpr { margin:6px 0 10px; } .pc.cpq { margin:0; }
.pc.cpq .cpc { grid-template-rows:auto 1fr; } .pc.cpq .cpc > .lab { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:32px; min-width:0; }
.pc.cpq .cpc input[type=time], .pc.cpq .cpfb { height:52px; min-height:52px; box-sizing:border-box; margin:0; width:100%; min-width:0; }
.pc.cpq .cpfb { flex-wrap:nowrap; flex-direction:row; align-items:center; justify-content:space-between; gap:5px; padding:0 8px; overflow:hidden; } .pc.cpq .cpfb b { flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:5px; margin:0; text-align:left; font-size:12px; line-height:1.2; white-space:nowrap; } .pc.cpq .cpfb em { font-style:normal; min-width:0; overflow:hidden; text-overflow:ellipsis; } .pc.cpq .cpfb b em { flex:0 1 auto; } .pc.cpq .cpfb .i { flex:none; width:16px; height:16px; --mdc-icon-size:16px; color: rgb(var(--ds-ac)); } .pc.cpq .cpfb span { flex:none; font-size:10px; line-height:1.2; white-space:nowrap; }
.cpsave { width:100%; margin-top:14px; min-height:48px; border:0; border-radius: var(--ctl-cta); background: rgb(var(--ds-ac)); color:rgb(var(--ds-ac-ink)); font:inherit; font-size:15px; font-weight:600; cursor:pointer; } .cpsave:disabled { background: var(--ds-soft); color: var(--ds-fg2); box-shadow: inset 0 0 0 1px var(--ds-line); cursor:default; } .cptz { margin:8px 0 0; text-align:center; font-size:11px; line-height:1.3; color: var(--ds-fg2); opacity:.8; }
.lkask { margin-top:14px; padding:14px; border-radius:var(--cp-item-r); border:1px solid var(--cp-off-line); background: var(--cp-off-bg); animation: lkask .22s ease-out; } .lkask.w { border-color: rgba(var(--ds-warn), .45); background: rgba(var(--ds-warn), .08); } .lkask b { display:block; font-size:15px; color: var(--ds-fg); } .lkask p { margin:4px 0 12px; font-size:13px; color: var(--ds-fg2); }
.lkbtn { display:flex; gap:10px; } .lkbtn button { flex:1; min-height:48px; border-radius:var(--cp-item-r); border:1px solid var(--cp-off-line); background:transparent; color: var(--ds-fg); font:inherit; font-size:15px; font-weight:600; cursor:pointer; } .lkbtn button.go { color: var(--cp-accent); background: var(--cp-on-bg); border-color: var(--cp-on-line); } .lkask.w .lkbtn button.go { color: rgb(var(--ds-warn)); background: rgba(var(--ds-warn), .16); border-color: rgba(var(--ds-warn), .5); }
@keyframes lkask { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } } @media (prefers-reduced-motion:reduce) { .lkask { animation:none; } }
.lkh { margin:10px 0 0; text-align:center; font-size:12px; color: var(--ds-fg2); }
.hd .ttl { min-width:0; } .hd .ver { display:block; margin-top:2px; font-size:11px; font-weight:500; letter-spacing:.02em; color: var(--ds-fg2); opacity:.75; }
.hd, .vtop { -webkit-user-select:none; user-select:none; } .vtop { touch-action:pan-x; }
.hd { touch-action:none; flex:none; display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.box.nfl { min-height:0; } .nfpanel { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:4px 2px 2px; --design-ok: var(--ds-ac-sp); --design-pass: var(--ds-ok-sp); --design-inner: var(--ds-soft); --design-line: var(--ds-line); --design-fg: var(--ds-fg); --design-muted: var(--ds-fg2); --design-bad: var(--ds-bad-sp); --design-warn: var(--ds-warn-sp); --design-info: var(--ds-info-sp); --design-accent-fg: #fff; }
.nfpanel .activity-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin:0 0 10px; } .nfpanel .activity-heading h3 { display:none; } .nfpanel .activity-heading { justify-content:flex-end; } .nfpanel .activity-count { font-size:12px; color:var(--ds-fg2); } .nfpanel .activity-alert { border-radius:16px; } .nfpanel .activity-title { font-weight:600; } .nfpanel .activity-heading>div { display:flex; align-items:center; gap:10px; } .nfpanel .activity-list { display:grid; grid-template-columns:minmax(0,1fr); gap:10px; }
.nfpanel button { font:inherit; cursor:pointer; color:var(--ds-fg); border-radius:12px; border:1px solid var(--ds-line); background:var(--ds-soft); padding:8px 12px; min-height:36px; } .nfpanel .activity-delete-all, .nfpanel .activity-confirm-delete { color:rgb(var(--ds-bad)); border-color:rgba(var(--ds-bad),.3); background:rgba(var(--ds-bad),.08); } .nfpanel .activity-confirm-delete { color:#fff; background:rgb(var(--ds-bad)); } .nfpanel .activity-delete { width:40px; min-width:40px; height:40px; padding:0; background:none; border:0; color:var(--ds-fg2); } .nfpanel .activity-footer { display:flex; justify-content:center; padding:12px 0 0; } .nfpanel .activity-footer:empty { display:none; } .nfpanel .activity-footer>div { min-height:40px; } .nfpanel [hidden] { display:none !important; } .nfpanel .hint, .nfpanel .notification-info { font-size:12px; color:var(--ds-fg2); text-align:center; margin:8px 0; }
.hd.sh { gap:12px; padding:2px 4px 0; margin-bottom:6px; } .hd.sh .ttl { flex:1; } .hd.sh h3 { margin:0; font-size:18px; font-weight:600; letter-spacing:.01em; } .hd .eic { flex:none; width:36px; height:36px; border-radius:50%; display:grid; place-items:center; background: rgba(var(--ds-ac), .16); color: rgb(var(--ds-ac)); } .hd .eic .i { --is:19px; }
${LOADER_CSS}
@media (prefers-reduced-motion: reduce) { .ldr .ring::before, .ldr .ring .arc { animation:none !important; } }
.x { flex:none; width:var(--cp-x); height:var(--cp-x); display:grid; place-items:center; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); cursor:pointer; padding:0; } .x .i { --is: 16px; }
@keyframes ds-fade { from { opacity:0 } to { opacity:1 } }
@media (prefers-reduced-motion: reduce) { .fx *, .act, .act .ring rect, .gauge .fp, .fxs *, .stage img, .bar b, .box, .l, .hdl rect { animation: none !important; transition: none !important; } }
/* fixed-width numbers */
.total .big, .gauge .c, .t2 .lg b, .t2 .ts b, .tile .v, .cur, .cv b, .tp .v, .picker, .pk * { font-variant-numeric: tabular-nums; }

/* buttons: main row + "More" */
.actions.split { --bs: 60px; display:block; padding:2px 0 4px; margin-block: -2px -4px; }
.actions.split.sz-s { --bs: 50px; } .actions.split.sz-l { --bs: 68px; }
.actions.split .act, .actions.swipe .act { width: min(var(--bs), calc((100cqw - (var(--np, 4) - 1) * 10px) / var(--np, 4))); height: auto; aspect-ratio: 1; } /* keeps at least 10px between buttons on narrow cards */
.actions.swipe { --bs: 60px; padding: 2px 0 0; margin-block: -2px 0; } .actions.swipe.sz-s { --bs: 50px; } .actions.swipe.sz-l { --bs: 68px; }
.actions.swipe .pages { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; overscroll-behavior-x:contain; padding: 14px 0 14px; margin-block: -12px -10px; }
.actions.swipe .pages::-webkit-scrollbar { display:none; }
.actions.swipe .page { flex: 0 0 100%; display:flex; justify-content:center; gap: 4px; scroll-snap-align:start; scroll-snap-stop:always; }
.actions.swipe .page .cell { flex: 0 0 calc((100% - (var(--np, 4) - 1) * 4px) / var(--np, 4)); } /* a shorter last page is centred */
.actions.swipe .pdots { display:flex; justify-content:center; gap:2px; height:10px; margin-top:2px; }
.actions.swipe .pdots button { position:relative; width:14px; height:10px; padding:0; border:0; background:none; cursor:pointer; }
.actions.swipe .pdots button::before { content:""; position:absolute; left:4px; top:2px; width:6px; height:6px; border-radius:3px; background: var(--ds-line); transition: width .2s ease, left .2s ease, background .2s ease; }
.actions.swipe .pdots button.on { width:22px; } .actions.swipe .pdots button.on::before { left:3px; width:16px; background: rgb(var(--ds-ac)); }
.actions.swipe .pdots button::after { content:""; position:absolute; inset:-12px -2px; } /* bigger touch area */
.himore { position:absolute; right:48px; bottom:12px; z-index:3; display:inline-flex; align-items:center; gap:4px; height:26px; padding:0 9px; border-radius:13px; background: rgba(10,11,15,.55); border:1px solid rgba(255,255,255,.16); color:#fff; font: inherit; font-size:12px; font-weight:600; cursor:pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); -webkit-tap-highlight-color:transparent; }
.himore.solo { right:12px; } .himore.on { background: rgba(var(--ds-ac), .9); border-color: transparent; }
.himore .i { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:1.8; }
.himore::before { content:""; position:absolute; inset:-9px -4px; } /* 44px touch area */
.himore .mdot { position:absolute; top:-3px; right:-3px; width:8px; height:8px; border-radius:50%; background: rgb(var(--ds-warn)); }
.hpanel { position:relative; display:none; padding:10px 8px 12px; border-radius: var(--ds-tr, 20px); background: var(--ds-soft); border:1px solid var(--ds-line); color: var(--ds-fg); }
.hpanel.show { display:block; animation: ds-hpin .2s ease; }
@keyframes ds-hpin { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform:none; } }
.hpanel .hph { display:flex; align-items:center; justify-content:space-between; padding: 0 6px 8px; font-size:13px; }
.hpanel .hph button { display:grid; place-items:center; width:28px; height:28px; padding:0; border:0; border-radius:50%; background: var(--ds-soft); color: inherit; cursor:pointer; } .hpanel .hph .i { --is:14px; }
.hpanel .hprow { display:flex; flex-wrap:wrap; justify-content:center; gap:14px 4px; container-type: inline-size; }
.hpanel .hprow .cell { flex: 0 0 calc((100% - (var(--np, 5) - 1) * 4px) / var(--np, 5)); } /* same columns as the main row; shorter rows are centred */
.hpanel { --bs: 60px; } .hpanel.sz-s { --bs: 50px; } .hpanel.sz-l { --bs: 64px; }
.hpanel .act { width: min(var(--bs), calc((100cqw - (var(--np, 4) - 1) * 10px) / var(--np, 4))); height:auto; aspect-ratio:1; }
ha-card .actions.noacts { display:none; }
.act.hmorebtn .i { width:40%; height:40%; fill:none; stroke: var(--ds-fg); stroke-width:1.8; }
.act.hmorebtn.on { background: rgba(var(--ds-ac), .18); border-color: rgba(var(--ds-ac), .5); } .act.hmorebtn.on .i { stroke: rgb(var(--ds-ac)); }
.act.hmorebtn .hcnt { position:absolute; top:-2px; right:-2px; min-width:18px; height:18px; padding:0 5px; box-sizing:border-box; border-radius:9px; background: var(--ds-card); border:1px solid var(--ds-line); color: var(--ds-fg); font-size:10px; font-weight:700; line-height:16px; text-align:center; }
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
.actions.split .morebtn { margin-top:6px; margin-bottom:0; } .actions.split .morebtn:hover { color: var(--ds-fg); }
.morebtn .i { --is:16px; transition: transform .25s ease; } .actions.moreopen .morebtn .i { transform: rotate(180deg); }
.morebtn:focus-visible { outline: 2px solid rgb(var(--ds-info)); outline-offset: 2px; }
.morebtn .mdot { position:absolute; top:3px; right:9px; width:7px; height:7px; border-radius:50%; background: rgb(var(--ds-warn)); }
.actions.offline .cell { opacity:.42; filter: grayscale(1); } .actions.offline .act { cursor:default; }

@media (max-width:639px) { .box::before { content:""; flex:none; display:block; width:38px; height:4px; margin:-8px auto 10px; border-radius:3px; background: var(--ds-line); } .box.confirm::before { margin-bottom:6px; } }
.box:focus { outline:none; }
/* Car View: soft floor shadow and the "all good" message */
.isoi::before { content:""; position:absolute; left:20%; right:14%; bottom:19%; height:9%; background: radial-gradient(ellipse at center, rgba(0,0,0,.6), transparent 70%); filter: blur(5px); pointer-events:none; }
${SHARED_CSS}
`;

const SETTINGS_CSS = `
.hero img[data-n="charging"], .hero img[data-n="charging_unlocked"], .hero img[data-n="complete"], .cvb img[data-n^="cable"] { filter: hue-rotate(var(--ds-ac-rot, 0deg)) saturate(var(--ds-ac-sat, 1)); }
.asw { display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:10px; padding:6px 2px 10px; } .asw button { display:flex; flex-direction:column; align-items:stretch; gap:7px; min-height:44px; padding:7px; border-radius:14px; border:1px solid var(--ds-line); background:var(--ds-soft); color:var(--ds-fg2); font:inherit; font-size:12px; cursor:pointer; transition: scale .32s var(--cp-spring), border-color .15s ease, box-shadow .15s ease; } .asw button .blk { display:grid; place-items:center; height:34px; border-radius:9px; background:rgb(var(--sw)); color:rgb(var(--swi)); } .asw button .blk svg { opacity:0; transition: opacity .15s ease; } .asw button.on { border-color:rgb(var(--sw)); box-shadow:0 0 0 1px rgb(var(--sw)); color:var(--ds-fg); } .asw button.on .blk svg { opacity:1; } .asw button { --cp-press:.96; } .asw button:focus-visible { outline:2px solid rgb(var(--sw)); outline-offset:2px; } .asw button span { text-align:center; line-height:1.2; }
.csw { display:flex; gap:14px; flex-wrap:wrap; padding:6px 2px 10px; } .csw button { flex:none; width:46px; height:36px; min-width:46px; border-radius:8px; padding:0; border:2px solid var(--ds-line); cursor:pointer; box-shadow: inset 0 0 0 2px rgba(0,0,0,.28); transition: scale .32s var(--cp-spring); } .csw button { --cp-press:.92; } .csw button.on { border-color: rgb(var(--ds-info)); box-shadow: 0 0 0 3px rgba(var(--ds-info), .4), inset 0 0 0 2px rgba(0,0,0,.28); }
:host { display:block; ${VARS} color: var(--ds-fg); }
${BASE_CSS}
.wrap { display:flex; flex-direction:column; gap:10px; }
.settings-loading{min-height:210px;padding:14px;border:1px solid var(--ds-line);border-radius:18px}.settings-loading .ldr{padding:18px;gap:10px}.settings-loading>i{display:block;height:10px;margin:12px 0;border-radius:6px;background:var(--ds-soft);animation:none}.settings-loading>i:nth-last-child(2){width:75%}.settings-loading>i:last-child{width:50%}@keyframes settings-pulse{from{opacity:.35}to{opacity:1}}@media(prefers-reduced-motion:reduce){.settings-loading>i{animation:none}}
.tabbar { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:6px; padding:2px 0 8px; background: var(--ha-card-background, var(--card-background-color, #222)); }
.tabs { position:relative; flex:1; min-width:0; display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch; cursor:grab; } .tabs::-webkit-scrollbar { display:none; }
.tn { flex:none; width:32px; height:32px; display:grid; place-items:center; padding:0; border-radius:50%; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); cursor:pointer; } .tn[hidden] { display:none; } .tn .i { --is:16px; } .tn.l .i { transform: scaleX(-1); }
.tabs button { flex:none; user-select:none; display:inline-flex; align-items:center; gap:6px; padding:8px 13px 8px 10px; border-radius:999px; border:1px solid var(--ds-line); background:transparent; cursor:pointer; font-size:12.5px; font-weight:600; color: var(--ds-fg2); transition: background .2s, color .2s, border-color .2s, scale .32s var(--cp-spring); }
.tabs button .i { --is:16px; }
.tabs button.on span { color: var(--ds-fg); }
.hint { margin:0; font-size:12px; color: var(--ds-fg2); line-height:1.4; }
h4 { margin:0 0 2px; font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color: var(--ds-fg2); }
.grp { display:flex; flex-direction:column; gap:10px; box-sizing:border-box; border:1px solid var(--cp-off-line); border-radius:var(--cp-block-r); padding:var(--cp-block-p); background:var(--cp-block-bg); }
.grp > .gh { display:flex; align-items:center; gap:8px; width:100%; padding:2px 0; margin:0; border:0; background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; } .gh h4 { flex:1; margin:0; } .gn { flex:none; font-size:11px; font-weight:700; padding:1px 7px; border-radius:999px; color:var(--ds-fg2); background:var(--ds-soft); font-variant-numeric:tabular-nums; } .gv { flex:none; width:7px; height:7px; margin:0 4px 3px 2px; border-right:2px solid var(--ds-fg2); border-bottom:2px solid var(--ds-fg2); transform:rotate(45deg); transition:transform .15s; } .grp.cl .gv { transform:rotate(-45deg); margin-bottom:0; } .grp > .gb { display:flex; flex-direction:column; gap:10px; min-width:0; } .grp.cl > .gb { display:none; } .gh:focus-visible { outline:2px solid rgb(var(--ds-ac, var(--ds-ok))); outline-offset:3px; border-radius:6px; }
.adv-cat { margin:10px 4px 0; font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color: rgb(var(--ds-ac, var(--ds-ok))); } .adv-cat:first-child { margin-top:0; } .grp .row, .grp .chk { background: rgba(var(--rgb-primary-text-color, 255,255,255), .05); }
.grp input[type=text], .grp input[type=number], .grp select, .grp textarea { background: rgba(var(--rgb-primary-text-color, 255,255,255), .06); }
.orow { display:grid; grid-template-columns:1fr 96px; gap:4px 12px; align-items:start; } .orow input { width:100%; box-sizing:border-box; } .oi summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:13.5px; min-height:36px; } .oi summary::-webkit-details-marker { display:none; } .oi .qm { flex:none; width:18px; height:18px; border-radius:50%; border:1px solid var(--ds-fg2); color:var(--ds-fg2); font:600 11px/16px sans-serif; text-align:center; font-style:normal; } .oi[open] .qm { background:var(--ds-fg2); color:#1c1c1c; } .oi p { margin:0 0 6px; font-size:11.5px; line-height:1.4; color:var(--ds-fg2); }
.opt { display:flex; flex-direction:column; gap:7px; } .opt .ol { font-size:13.5px; } .opt .ol small { display:block; margin-top:2px; font-size:11.5px; color: var(--ds-fg2); line-height:1.35; }
.seg.nlv button { gap:6px; min-width:0; padding:7px 4px; } .ndot { display:inline-block; width:10px; height:10px; border-radius:50%; flex:0 0 auto; box-shadow:0 0 0 1px rgba(255,255,255,.4); }
.sw-c { display:flex; align-items:center; gap:10px; font-size:13.5px; color: var(--ds-fg); } .sw-c span { flex:1; }
.sw-c input[type=color] { -webkit-appearance:none; appearance:none; width:30px; height:30px; padding:0; border:2px solid var(--ds-line); border-radius:6px; background:none; cursor:pointer; flex:0 0 40px; order:-1; min-height:30px; max-height:30px; width:40px; height:30px; }
.sw-c input[type=color]::-webkit-color-swatch-wrapper { padding:0; } .sw-c input[type=color]::-webkit-color-swatch { border:0; border-radius:3px; } .sw-c input[type=color]::-moz-color-swatch { border:0; border-radius:3px; }
.lvhead, .lvrow { display:grid; grid-template-columns: 1fr 86px 86px; gap:8px; align-items:center; } .lvhead.nofuel, .lvrow.nofuel { grid-template-columns: 1fr 86px; } .grow { min-width:0; flex:1; } .lvhead { font-size:11px; color: var(--ds-fg2); text-align:center; }
.lvrow input[type=number] { width:100%; text-align:center; } .lvrow .dash { text-align:center; color: var(--ds-fg2); font-style:normal; }
.lvbar { height:10px; border-radius:999px; box-shadow: inset 0 0 0 1px var(--ds-line); }

.list { display:flex; flex-direction:column; gap:4px; }
.tgrid { display:grid; grid-template-columns:repeat(var(--c,2), minmax(0,1fr)); gap:8px; }
.cvrow { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
.mrow { display:flex; flex-wrap:wrap; align-items:flex-end; gap:10px; } .mrow > .opt { flex:1 1 200px; min-width:0; } .mrow > .opt:nth-child(2) { flex:2 1 260px; } .mrow > .mtile { flex:0 1 190px; min-width:150px; } .mtile .tgrid { grid-template-columns:minmax(0,1fr); } .cvrow > .opt { justify-content:space-between; }
.cvbox { display:flex; flex-direction:column; gap:8px; min-width:0; padding:12px; border-radius:16px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); font-size:12.5px; color: var(--ds-fg2); }
.swd { display:flex; align-items:center; flex-wrap:wrap; gap:12px; min-height:44px; padding:0 4px; }
.swd button { flex:none; width:34px; height:34px; padding:0; border-radius:50%; border:0; cursor:pointer; box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); transition: scale .32s var(--cp-spring); } .swd button { --cp-press:.92; }
.swd button.on { outline:2px solid var(--ds-fg); outline-offset:3px; }
@media (max-width:420px) { .cvrow { grid-template-columns:minmax(0,1fr); } }
.tile { display:flex; align-items:center; gap:8px; min-width:0; height:44px; box-sizing:border-box; padding:0 10px; border-radius:13px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); color: var(--ds-fg2); font-size:12.5px; font-weight:600; line-height:1.2; text-align:left; cursor:pointer; }
.tile > span { flex:1; min-width:0; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; word-break:break-word; }
.tile > .tt, .tile > .i { --is:20px; flex:none; }
.tile.wide { width:100%; height:auto; min-height:52px; padding:8px 10px; margin-top:8px; } .tile.wide > span { display:flex; flex-direction:column; gap:1px; overflow:visible; -webkit-line-clamp:unset; } .tile.wide b { font-size:12.5px; font-weight:600; } .tile.wide small { font-size:11.5px; font-weight:400; line-height:1.3; color: var(--ds-fg2); }
.fxg { display:grid; grid-template-columns:var(--fxc, repeat(auto-fit, minmax(96px, 1fr))); gap:8px; } .fxg.one .fx { flex-direction:row; justify-content:flex-start; min-height:60px; padding:8px 14px; gap:14px; text-align:left; } .fx { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-width:0; min-height:96px; box-sizing:border-box; padding:10px 6px; border-radius:14px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); color: var(--ds-fg2); font-size:12.5px; font-weight:600; text-align:center; line-height:1.2; cursor:pointer; } .fx.on { background: rgba(var(--ds-ac, var(--ds-ok)), .14); border-color: rgba(var(--ds-ac, var(--ds-ok)), .55); color: var(--ds-fg); } .fx:focus-visible, .pre:focus-visible { outline:2px solid rgb(var(--ds-info)); outline-offset:2px; }
.fxp { width:46px; height:46px; border-radius:50%; display:grid; place-items:center; color: var(--ds-fg2); background: rgba(var(--rgb-primary-text-color, 255,255,255), .06); } .fx.on .fxp { color: rgb(var(--ds-ac, var(--ds-ok))); background: rgba(var(--ds-ac, var(--ds-ok)), .16); } .fxp svg { width:44px; height:44px; overflow:hidden; border-radius:50%; }
.fxp .fl { fill:none; stroke:currentColor; stroke-width:2.5; stroke-linecap:round; stroke-dasharray:2 6; animation:fxf 1s linear infinite; } .fxp .pd { fill:currentColor; } .fxp .ha { fill:currentColor; opacity:.35; transform-box:fill-box; transform-origin:center; animation:fxp 1.6s ease-out infinite; } .fxp .cr { fill:none; stroke:currentColor; stroke-width:1.6; opacity:.6; } .fxp .bd { fill:currentColor; opacity:.6; animation:fxs 2s ease-in-out infinite; } .fxp .no { fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; }
@keyframes fxf { to { stroke-dashoffset:-16; } } @keyframes fxp { 0% { transform:scale(.5); opacity:.6; } 100% { transform:scale(1.8); opacity:0; } } @keyframes fxs { 0% { transform:translateX(-4px) skewX(-18deg); } 100% { transform:translateX(40px) skewX(-18deg); } } @media (prefers-reduced-motion: reduce) { .fxp * { animation:none !important; } }
.wtiles { display:flex; flex-direction:column; gap:8px; } .wtiles .tile.wide { margin-top:0; }
.orow:has(.stp) { grid-template-columns:minmax(0,1fr) auto; align-items:center; padding:6px 8px 6px 12px; border-radius:13px; background: var(--ds-soft); } .stp { display:flex; align-items:center; gap:2px; padding:3px; border-radius:12px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .05); } .stp .mv { width:34px; height:34px; } .stp input { width:44px !important; height:34px; padding:0; border:0 !important; border-radius:9px; box-shadow:none !important; background:transparent !important; text-align:center; font-weight:700; color: var(--ds-fg); -moz-appearance:textfield; } .stp input::-webkit-outer-spin-button, .stp input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; } .stp b { min-width:22px; margin-left:-4px; font-size:12px; font-weight:600; color: var(--ds-fg2); }
.tgt { display:flex; flex-direction:column; gap:10px; padding:12px; border-radius:16px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); } .tgh { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; } .tgt-t { display:flex; flex-direction:column; align-items:flex-start; gap:3px; min-width:0; font-size:13.5px; } .tgt-t small { font-size:12px; color: var(--ds-fg2); } .adv { font-style:normal; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; color:#e8b64a; background:rgba(232,182,74,.14); border:1px solid rgba(232,182,74,.4); } .tv { flex:none; padding:6px 12px; border-radius:12px; font-size:14px; font-weight:700; color: rgb(var(--ds-ac, var(--ds-ok))); background: rgba(var(--ds-ac, var(--ds-ok)), .14); border:1px solid rgba(var(--ds-ac, var(--ds-ok)), .4); } .rng { width:100%; margin:2px 0; accent-color: rgb(var(--ds-ac, var(--ds-ok))); } .rng.dim { opacity:.45; } .pres { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; } .pre { height:44px; border-radius:13px; border:1px solid var(--ds-line); background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); color: var(--ds-fg2); font-size:13px; font-weight:600; cursor:pointer; } .pre.on { color: rgb(var(--ds-ac, var(--ds-ok))); background: rgba(var(--ds-ac, var(--ds-ok)), .14); border-color: rgba(var(--ds-ac, var(--ds-ok)), .5); }
.pos { flex:none; display:grid; place-items:center; min-width:22px; height:22px; padding:0 4px; box-sizing:border-box; border-radius:7px; font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums; color: rgb(var(--ds-ac, var(--ds-ok))); background: rgba(var(--ds-ac, var(--ds-ok)), .14); } .row.off .pos { color: var(--ds-fg2); background: rgba(var(--rgb-primary-text-color, 255,255,255), .06); }
.pvg { grid-template-columns:var(--fxc, repeat(auto-fit, minmax(130px, 1fr))); } .fx.pv { min-height:0; padding:8px 8px 10px; gap:8px; } .pvp { position:relative; display:block; width:100%; height:74px; border-radius:10px; overflow:hidden; background: linear-gradient(180deg, rgba(var(--rgb-primary-text-color,255,255,255),.07), rgba(var(--rgb-primary-text-color,255,255,255),.02)); color: rgb(var(--ds-ac, var(--ds-ok))); font-style:normal; }
.pcar { position:absolute; left:-6%; bottom:-6px; width:84%; height:auto; object-fit:contain; filter: drop-shadow(0 4px 4px rgba(0,0,0,.45)); pointer-events:none; }
.pl { z-index:1; text-shadow:0 1px 3px rgba(0,0,0,.85); position:absolute; right:7px; top:7px; display:flex; flex-direction:column; align-items:flex-end; line-height:1.1; font-weight:700; white-space:nowrap; text-align:right; } .pl em { font-style:normal; font-size:13px; font-weight:800; } .pl small { font-size:8.5px; font-weight:600; opacity:.85; } .pl small.u { letter-spacing:.08em; } .pl.line { top:8px; font-size:9px; } .pl.big em { font-size:20px; } .pl.big em small { font-size:9px; margin-left:1px; } .pl.port { top:22px; right:30px; } .pdot { position:absolute; right:12px; top:31px; width:16px; height:2px; background: linear-gradient(90deg, rgb(var(--ds-ac, var(--ds-ok))), rgba(var(--ds-ac, var(--ds-ok)),.2)); } .pdot::after { content:""; position:absolute; right:-6px; top:-3px; width:6px; height:6px; border-radius:50%; border:1.5px solid rgb(var(--ds-ac, var(--ds-ok))); background: rgba(var(--ds-ac, var(--ds-ok)),.3); }
.pt { position:absolute; inset:8px 10px; display:flex; flex-direction:column; justify-content:center; color: var(--ds-fg); } .pt small { font-size:9px; color: var(--ds-fg2); font-weight:600; } .pt b { font-size:16px; font-weight:800; } .pring { position:absolute; right:0; top:50%; width:46px; height:46px; transform:translateY(-50%) rotate(-90deg); } .pring circle, .pgauge path { fill:none; stroke: rgba(var(--rgb-primary-text-color,255,255,255),.12); stroke-width:4; stroke-linecap:round; } .pring .v, .pgauge .v { stroke: rgb(var(--ds-ac, var(--ds-ok))); } .pring .f { stroke: var(--energy-fuel, #ffcb66); } .pt.g { align-items:center; text-align:center; } .pgauge { width:66px; height:36px; margin-bottom:-14px; } .pt.g b { font-size:14px; } .pvp:has(.pt.en) { height:104px; } .pt.en { inset:0; display:block; text-align:left; } .pt.en .et { position:absolute; left:11px; top:9px; font-style:normal; font-size:11px; font-weight:700; color: var(--ds-fg); } .pt.en .ei { display:flex; align-items:center; gap:3px; font-size:9.5px; color: rgb(var(--ds-ac, var(--ds-ok))); } .pt.en .ei .i, .pt.en .pf .i { --is: 11px; } .pt.en .ei b { font-size:12px; font-weight:700; color: var(--ds-fg); } .pt.en .ei small { font-size:9px; } .pt.en .el { position:absolute; left:11px; top:34px; display:flex; flex-direction:column; gap:6px; } .pt.en .pr { position:absolute; right:-14px; bottom:-22px; width:clamp(78px, 58%, 112px); aspect-ratio:1; } .pt.en .pr svg { position:absolute; inset:0; width:100%; height:100%; } .pt.en .pr path { fill:none; stroke: rgba(var(--rgb-primary-text-color,255,255,255),.1); stroke-width:8; stroke-linecap:round; } .pt.en .pr path.v { stroke: rgb(var(--ds-ac, var(--ds-ok))); } .pt.en .pr path.v.f { stroke: rgba(var(--ds-ac, var(--ds-ok)),.6); } .pt.en .pc { position:absolute; display:flex; flex-direction:column; align-items:center; gap:1px; line-height:1; } .pt.en .pr .pc { inset:0; justify-content:center; } .pt.en .pc b { font-size:19px; font-weight:800; color: var(--ds-fg); } .pt.en .pc b small { font-size:10px; color: var(--ds-fg2); } .pt.en .pf { display:flex; align-items:center; gap:2px; font-size:10px; font-weight:700; color: rgb(var(--ds-ac, var(--ds-ok))); } .pt.en .pf small { font-size:8px; } .pt.en .phg { position:absolute; left:50%; top:22px; width:112px; height:auto; transform:translateX(-50%); } .pt.en .phg path { fill:none; stroke: rgba(var(--rgb-primary-text-color,255,255,255),.1); stroke-width:14; stroke-linecap:round; } .pt.en .phg path.v { stroke: rgb(var(--ds-ac, var(--ds-ok))); } .pt.en .phg .in path.v { stroke: rgba(var(--ds-ac, var(--ds-ok)),.6); } .pt.en.g .pc { left:50%; top:46px; transform:translateX(-50%); } .pt.en .pbo { position:absolute; left:10px; right:10px; bottom:6px; display:flex; justify-content:space-between; }
.pfxd { position:absolute; left:50%; top:50%; width:38px; height:38px; margin:-19px 0 0 -19px; border-radius:50%; background: rgba(var(--rgb-primary-text-color,255,255,255),.08); border:1px solid var(--ds-line); box-sizing:border-box; }
.pfxd.arc::before { content:""; position:absolute; inset:-4px; border-radius:50%; background: conic-gradient(rgb(var(--ds-ac, var(--ds-ok))) 0 28%, transparent 28%); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); animation: pfx-spin 1.1s linear infinite; }
.pfxd.pulse { animation: pfx-pulse 1.6s ease-in-out infinite; border-color: rgba(var(--ds-ac, var(--ds-ok)),.6); }
.pfxd.neon::before { content:""; position:absolute; inset:-4px; border-radius:50%; background: conic-gradient(#00dcff, #ff28b9, rgb(var(--ds-ac, var(--ds-ok))), #00dcff); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px)); animation: pfx-spin 2s linear infinite; } .pfxd.neon { box-shadow: 0 0 14px rgba(var(--ds-ac, var(--ds-ok)),.4); }
@keyframes pfx-spin { to { transform: rotate(360deg); } } @keyframes pfx-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--ds-ac, var(--ds-ok)),.55); } 50% { box-shadow: 0 0 0 9px rgba(var(--ds-ac, var(--ds-ok)),0); } }
.list.cols { display:grid; grid-template-columns:repeat(var(--lc,2), minmax(0,1fr)); gap:8px; } .list.cols .row { position:relative; box-sizing:border-box; min-width:0; height:44px; padding:0 4px 0 8px; gap:8px; } .list.cols .row > span { flex:1; min-width:0; overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; word-break:break-word; font-size:12.5px; line-height:1.2; } .list.cols .row .mv { position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0; overflow:hidden; clip:rect(0 0 0 0); } .list.cols .row .mv:focus-visible { position:static; width:28px; height:28px; margin:0; overflow:visible; clip:auto; border:1px solid var(--ds-line); border-radius:8px; } /* the arrows stay for the keyboard: hidden until focused */ .list.cols { align-items:start; } .list.cols .row.pin-parent { height:auto; padding:0 4px 4px 8px; } .list.cols .row.pin-parent > .grip, .list.cols .row.pin-parent > span, .list.cols .row.pin-parent > .swb { align-self:center; } .list.cols .row.pin-parent > span, .list.cols .row.pin-parent > .swb { min-height:44px; display:flex; align-items:center; } .list.cols .pin-sub { padding-left:26px; }
.list .row.status-tile { box-shadow: inset 3px 0 0 var(--ds-ok, #2e9e5b); } .status-tile .lk { flex:none; width:16px; text-align:center; font-size:15px; line-height:1; color:var(--ds-fg2); } .status-tile > span { flex:1; min-width:0; } .status-tile.off > span { opacity:.45; } .status-tile.dep { opacity:.5; } .status-tile.dep .swb { pointer-events:none; } .row { display:flex; align-items:center; gap:8px; padding:7px 8px 7px 11px; border-radius:13px; background: var(--ds-soft); min-height:44px; }
.row > span { flex:1; min-width:0; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; } .row > span small { display:block; font-size:11px; color: var(--ds-fg2); }
.row.off > span { opacity:.45; } .row.unused { opacity:.4; pointer-events:none; } .row > .i { color: var(--ds-fg2); }
.row.tg { cursor:pointer; text-align:left; border:0; width:100%; } .row.tg.on > .i { color: rgb(var(--ds-info)); }
.swb { border:0; background:transparent; padding:6px 2px 6px 6px; cursor:pointer; display:grid; place-items:center; }
.field { display:flex; flex-direction:column; gap:4px; font-size:12px; color: var(--ds-fg2); }
.field.inline { flex-direction:row; align-items:center; justify-content:space-between; gap:10px; }
input[type=text], input[type=number], select { width:100%; box-sizing:border-box; padding:9px 11px; border-radius:var(--cp-ctl-r); border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); font-size:13.5px; min-width:0; }
input[type=number] { width:90px; }
input[type=color] { padding:0; }
select option { color:#000; }
.grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
.custom-action-details{margin-top:8px;border:1px solid var(--ds-line);border-radius:12px;padding:10px 12px;background:var(--ds-soft)}.custom-action-details>summary{cursor:pointer;list-style:none;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}.custom-action-details>summary::-webkit-details-marker{display:none}.custom-action-details>summary:after{content:"+";font-size:20px;color:rgb(var(--ds-info))}.custom-action-details[open]>summary:after{content:"−"}.custom-action-fields [hidden]{display:none!important}.custom-action-fields input:not([type=checkbox]),.custom-action-fields select{border:1px solid var(--ds-line);border-radius:var(--cp-ctl-r);background:var(--ds-card,var(--card-background-color));color:var(--ds-fg);font:inherit;padding:10px 12px;min-height:44px}.custom-confirm{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;min-height:36px}.custom-confirm input[type=checkbox]{width:18px!important;height:18px;min-height:18px;accent-color:rgb(var(--ds-ac))}.custom-action-fields{display:grid;gap:8px;margin-top:8px;min-width:0}.custom-action-fields .field{font-size:11px}.custom-action-fields input,.custom-action-fields select{width:100%;box-sizing:border-box;min-width:0}.row:has(.custom-action-details[open]){align-items:flex-start}.row>.grip{flex:none}.list .row.custom-entity{display:block;padding:12px;border-radius:14px}.custom-entity-header{display:grid;grid-template-columns:18px 24px minmax(0,1fr) repeat(3,30px);gap:8px;align-items:center;min-height:44px}.custom-entity-header>.i{color:var(--ds-fg2);width:24px;height:24px}.custom-entity-header .grip{margin:0;justify-self:center}.custom-entity-title{min-width:0}.custom-entity-title strong{display:block;font-size:13px;font-weight:500;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.custom-entity-title small{display:block;font-size:11px;color:var(--ds-fg2);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.custom-entity-header .mv{width:30px;height:30px;padding:0;min-width:0}.custom-entity>.custom-action-details{margin:2px 0 0 50px}.custom-action-details{border:0;background:none;padding:0}.custom-action-details>summary{min-height:28px;font-size:11px;font-weight:400;color:var(--ds-fg2);justify-content:flex-start;gap:8px;width:fit-content;max-width:100%;border-radius:6px;outline-offset:3px}.custom-action-details>summary:after{content:'›';font-size:19px;color:var(--ds-fg2);transform:rotate(90deg);line-height:1}.custom-action-details[open]>summary:after{content:'›';transform:rotate(-90deg)}.custom-action-details[open]>.custom-action-fields{border-top:1px solid var(--ds-line);padding-top:12px;margin-top:8px}.custom-action-fields>.field{margin:0}.custom-action-fields>small{grid-column:1/-1;font-size:11px;line-height:1.5;color:var(--ds-fg2)}@container(min-width:560px){.custom-action-fields{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}}@container(max-width:359px){.custom-entity-header{grid-template-columns:14px 22px minmax(0,1fr) repeat(3,28px);gap:4px}.custom-entity-header .mv{width:28px;height:28px}.custom-entity>.custom-action-details{margin-left:44px}}
.add { padding:10px; border-radius:14px; border:1px dashed var(--ds-line); display:flex; flex-direction:column; gap:8px; }
.icons { display:flex; flex-wrap:wrap; gap:4px; } .icons button { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--ds-line); background:transparent; cursor:pointer; color: var(--ds-fg2); padding:0; }
 .icons .i { --is: 18px; }
.chk { display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:11px; background: var(--ds-soft); font-size:12.5px; }
.chk .th { width:54px; height:34px; border-radius:8px; background:#000 center/cover no-repeat; flex:none; border:1px solid var(--ds-line); }
.chk code { font-size:11px; color: var(--ds-fg2); } .chk .st { margin-left:auto; font-weight:600; } .chk .st.ok { color: rgb(var(--ds-ok)); } .chk .st.no { color: rgb(var(--ds-bad)); }
.chk input { flex:1; min-width:0; padding:6px 8px; font-size:12px; }
textarea { width:100%; box-sizing:border-box; min-height:150px; padding:10px; border-radius:12px; border:1px solid var(--ds-line); background: var(--ds-soft); color: var(--ds-fg); font:12px/1.45 ui-monospace, Menlo, monospace; }
.note { font-size:12px; color: rgb(var(--ds-ac)); min-height:16px; }
${SHARED_CSS}
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
    ...(c.info_custom || []).map((x) => x.entity), ...(c.diag_ignore || [])]);
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
/* The ring is drawn again whenever the card renders. A negative delay tied to the clock keeps every new ring at the phase the previous one had, so the circle flows instead of restarting. */
const ringHtml = () => `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><rect x="2.5" y="2.5" width="95" height="95" rx="47.5" pathLength="100" style="animation-delay:-${((performance.now() / 1000) % 1.2).toFixed(3)}s"/></svg>`;
const REBUILD_KEYS = ["image_path", "images", "name", "prefix", "entities"];
const normPath = (p) => (p ? (p.endsWith("/") ? p : p + "/") : p);

/* Merge: defaults < card YAML < local device settings */
function mergeConfig(yaml, local) {
  const y = { ...(yaml || {}) };
  // compatibility with old versions (v0.1–0.3)
  if (y.diagnostics !== undefined && y.diag === undefined) y.diag = y.diagnostics;
  if (y.button_labels === true) y.button_labels = "status";
  if (y.button_labels === false) y.button_labels = "none";
  if (y.button_layout === "scroll" || y.button_layout === "fit") y.button_layout = "split"; /* these layouts were removed */
  const c = { ...clone(DEFAULTS), ...y, ...(local || {}) };
  /* "capsule" was offered in Card Settings but never implemented: fall back to the classic ring */
  if (c.energy_ui !== "gauge") c.energy_ui = "ring";
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
  for (const k of ["image_path"]) if (c[k] !== null && typeof c[k] !== "string") c[k] = null;
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
  morning:   { sun: [30, 24, "#ffe9bf"], r: 3.2, glow: .27, cl: "#f4f8ff", ca: .35, line: "#ffffff", la: .57, hill: "#9fb3c8", ha: .44, stars: 0, moon: 0 },
  afternoon: { sun: [66, 10, "#ffffff"], r: 3.6, glow: .30, cl: "#ffffff", ca: .50, line: "#ffffff", la: .75, hill: "#8fb0d2", ha: .52, stars: 0, moon: 0 },
  evening:   { sun: [68, 24, "#ffb871"], r: 3.8, glow: .33, cl: "#ffb98a", ca: .46, line: "#ffcfa8", la: .63, hill: "#8a5f86", ha: .60, stars: .25, moon: 0 },
  night:     { sun: [66, 11, "#eaf0ff"], r: 2.6, glow: .18, cl: "#7f9ad8", ca: .18, line: "#8fb0ff", la: .42, hill: "#35508f", ha: .44, stars: 1, moon: 1 },
};
const skySvg = (ph) => {
  const T = SKY_PH[ph], [sx, sy, sc] = T.sun;
  const st = T.stars ? Array.from({ length: 46 }, (_, i) => `<circle cx="${i * 37 % 100}" cy="${i * 53 % 30}" r="${i % 3 ? .16 : .28}" fill="#fff" opacity="${(T.stars * (.35 + (i % 4) * .15)).toFixed(2)}"/>`).join("") : "";
  return `<svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
<radialGradient id="skg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${sc}" stop-opacity="${T.glow}"/><stop offset="1" stop-color="${sc}" stop-opacity="0"/></radialGradient>
<filter id="skb"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="sks"><feGaussianBlur stdDeviation=".5"/></filter>
<mask id="skm"><rect width="100" height="72" fill="#fff"/><circle cx="${sx + 1.4}" cy="${sy - 1}" r="2.5" fill="#000"/></mask>
<linearGradient id="skhx" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="40" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="skhy" gradientUnits="userSpaceOnUse" x1="0" y1="32" x2="0" y2="41"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="skhm1" maskUnits="userSpaceOnUse" x="-10" y="0" width="120" height="72"><rect x="-10" width="120" height="72" fill="url(#skhx)"/></mask>
<mask id="skhm2" maskUnits="userSpaceOnUse" x="-10" y="0" width="120" height="72"><rect x="-10" width="120" height="72" fill="url(#skhy)"/></mask>
<linearGradient id="skl" gradientUnits="userSpaceOnUse" x1="34" y1="0" x2="100" y2="0"><stop offset="0" stop-color="${T.line}" stop-opacity="0"/><stop offset=".4" stop-color="${T.line}"/><stop offset="1" stop-color="${T.line}"/></linearGradient></defs>${st}
<circle cx="${sx}" cy="${sy}" r="20" fill="url(#skg)"/>
${T.moon ? `<circle cx="${sx}" cy="${sy}" r="${T.r}" fill="${sc}" mask="url(#skm)" opacity=".95"/>` : `<circle cx="${sx}" cy="${sy}" r="${T.r}" fill="${sc}" opacity=".9" filter="url(#sks)"/>`}
<g filter="url(#skb)" fill="${T.cl}" opacity="${T.ca}"><ellipse cx="62" cy="6" rx="15" ry="3"/><ellipse cx="76" cy="9.5" rx="12" ry="2.8"/><ellipse cx="90" cy="4.5" rx="10" ry="2.4"/><ellipse cx="52" cy="11" rx="8" ry="1.9"/><ellipse cx="30" cy="18" rx="9" ry="1.6" opacity=".6"/></g>
<g mask="url(#skhm1)"><g mask="url(#skhm2)"><g filter="url(#sks)" fill="${T.hill}"><path d="M0 36Q9 31.5 19 33.4T38 34.6V40H0Z" opacity="${T.ha}"/><path d="M0 38Q12 35 24 36.8T38 37.6V42H0Z" opacity="${(T.ha * .8).toFixed(2)}"/></g></g></g>
<path d="M100 8C86 17 62 24 34 28" fill="none" stroke="url(#skl)" stroke-opacity="${T.la}" stroke-width=".35" filter="url(#sks)"/></svg>`;
};

class DeepalS05Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); I18N.watch(this.shadowRoot);
    /* touch (bound once, the shadowRoot outlives _build): the click that follows pointerup "lands" on the just-opened window and closed it immediately; we swallow it */
    this.shadowRoot.addEventListener("click", (e) => { if (Date.now() < (this._noClickUntil || 0)) { e.stopPropagation(); e.preventDefault(); } }, true);
    this._pending = {}; this._flashes = {}; this._opt = {}; this._last = {};
    this._toastState = null; this._confirm = null; this._diagSheet = false; this._lockSheet = false; this._lockAsk = null; this._enSheet = false; this._enEl = null; this._nfSheet = false; this._nfEl = null; this._nfAct = null; this._pcSheet = false; this._pcEl = null; this._pcAct = null; this._planSheet = false; this._planEl = null; this._planDraft = null; this._planBusy = false; this._pcStyle = undefined; this._stSheet = null; this._stEl = null;
    this._sig = null; this._built = false;
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
    if (this._hass) this._render();
  }
  _devName() {
    const c = this._c, h = this._hass; if (!c || !h || c.name || !h.entities || !h.devices) return null;
    for (const k of ["lock.doors", "sensor.battery_level", "sensor.remaining_range"]) { const e = h.entities[this._id(k)], d = e && e.device_id && h.devices[e.device_id]; const n = d && (d.name_by_user || d.name); if (n) return String(n); }
    return null;
  }
  set hass(hass) {
    this.style.colorScheme=hass?.themes?.darkMode===false?"light":"dark";
    this._hass = hass;
    this._applyAccent(this._c);
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
    if (!this._skyTick) this._skyTick = setInterval(() => { this._tickAge(); if (this._el && this._c && ["auto", "neon"].includes(this._c.hero_sky)) this._skySet(this._el.hero.dataset.style === "carview"); }, 30000); /* the day phase changes even without another update */
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
    el.style.setProperty("--ds-bgd", hx + fx ? "block" : "none"); el.style.setProperty("--ds-ar0", String(+r.toFixed(5))); el.style.setProperty("--ds-hx", String(hx)); el.style.setProperty("--ds-fx", String(fx));
    el.style.setProperty("--ds-aspect", hx + fx ? String(+(1 / (1 / r + hx + fx)).toFixed(5)) : (q.length > 1 && q[0] > 0 && q[1] > 0 ? base : String(r)));
  }

  disconnectedCallback() {
    clearTimeout(this._pendTick); cancelAnimationFrame(this._scRaf); this._scRaf = 0; cancelAnimationFrame(this._winRaf); this._winRaf = 0;
    for (const a of [this._el && this._el.actions, this._el && this._el.info]) if (a && a._scRO) { a._scRO.disconnect(); a._scRO = null; }
    for (const image of this.shadowRoot.querySelectorAll("img")) { clearTimeout(image._retryTimer); image._retryTimer = null; }
    clearInterval(this._skyTick); this._skyTick = 0; clearInterval(this._nfTimer); this._nfTimer = 0;
    for (const p of Object.values(this._pending || {})) clearTimeout(p.timer); this._pending = {}; for (const f of Object.values(this._flashes || {})) clearTimeout(f.timer); this._flashes = {}; clearInterval(this._pqTk); this._pqTk = null; clearTimeout(this._pqPoll); for (const e of Object.values(this._sigHold || {})) clearTimeout(e.timer); this._sigHold = {};
    /* timers that concern only the screen (not the saving ones) */
    for (const t of ["_toastTimer", "_confirmTimer", "_pkT", "_pkUT", "_pkPT", "_tTimer", "_tTimer2", "_optTimer"]) clearTimeout(this[t]);
    this._toastState = null; if (this._confirm) { this._confirm = null; this._tpend = undefined; }
    if (this._pkRaf) { cancelAnimationFrame(this._pkRaf); this._pkRaf = 0; }
    I18N.subs.delete(this); if (this._onKey) document.removeEventListener("keydown", this._onKey, true); if (this._io) { this._io.disconnect(); this._io = null; } }
  getCardSize() { return 9; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  /* ───── settings (saved on the device) ───── */
  _lsKey() { return `deepal-companion-card:${(this._yaml && this._yaml.prefix) || DEFAULTS.prefix}`; }
  _patch(p) {
    if ("hero_view" in p) { this._hview = null; lsWrite(`deepal-companion-view-choice:${this._companion.view_id}`, null); } /* the choice in the settings applies again over the device's button */
    this._local = { ...(this._local || {}), ...p }; this._lrev = (this._lrev || 0) + 1; /* a local change: an older answer from the server must not overwrite it */
    lsWrite(this._lsKey(), this._local); this._saveYaml();
    const rebuild = Object.keys(p).some((k) => REBUILD_KEYS.includes(k));
    if (["hero_style", "car_color", "iso_wheels"].some((k) => k in p)) this._cvReset();
    this._c = mergeConfig(this._yaml, this._local);
    if (rebuild) this._built = false;
    this._force();
  }

  /* ───── saving to the dashboard YAML (shared settings everywhere) ───── */
  _saveYaml(reset) {
    clearTimeout(this._yT);
    if (reset) this._yReset = true;
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
      await hass.callWS({ type: "lovelace/config/save", url_path: urlPath, config: cfg });
      this._yaml = { ...target };
      for (const k of Object.keys(snap)) if (JSON.stringify((this._local || {})[k]) === JSON.stringify(snap[k])) delete this._local[k];
      lsWrite(this._lsKey(), Object.keys(this._local || {}).length ? this._local : null);
      this._c = mergeConfig(this._yaml, this._local);
      this._yamlErr = false;
      this._saveRemote();
    } catch (err) {
      this._saveRemote();
      if (!this._yamlErr) { this._yamlErr = true; this._toast("Couldn’t save to the dashboard (needs an admin and a UI-editable dashboard). Saved to your account instead.", "error"); }
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
    const cu = [...(this._c.info_custom || [])].map((x) => this._eobj(x.entity)?.state ?? "∅").join("|");
    return [st, cu, Math.floor(Date.now() / 60000), Object.keys(this._pending).join(","),
      Object.entries(this._flashes).map(([k, v]) => k + v.type).join(","), this._confirm ? this._confirm.id : "", String(this._diagSheet), String(this._lockSheet), String(this._lockAsk), String(this._enSheet), String(this._nfSheet), String(this._pcSheet), String(this._planSheet), String(this._stSheet), (this._obj("switch.charge_schedule") || {}).state, (this._obj("time.charge_schedule_start") || {}).state, (this._obj("time.charge_schedule_end") || {}).state,
      JSON.stringify(this._c), JSON.stringify(this._opt), String(this._tpend), String(this._moreOpen), String(this._imgOpen), String((this._tgt() || {}).state), String(this._view), JSON.stringify((this._hass && this._hass.locale) || null), String((this._obj("lock.doors") || {}).last_changed), this._toastState ? this._toastState.msg : ""].join("#");
  }
  _force() { this._sig = null; if (this._hass && this._c) this._render(); }
  _diagAvail() { return DIAG.filter((d) => this._obj(d[0])); }
  _diagItems() {
    const c = this._c, avail = this._diagAvail(), selIds = Array.isArray(c.diag) ? c.diag : DIAG.map((d) => d[0]);
    const mk = (label, icon, ent, on, na, sev) => ({ label, icon, ent, on, na, st: on ? sev : na ? "na" : "ok" });
    const items = avail.filter((d) => selIds.includes(d[0])).map((d) => mk(d[1], d[2], this._id(d[0]), this._is(d[0], "on"), this._s(d[0]) === null, d[3] === "r" ? "bad" : "warn"));
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
    const head = bad.length ? T(bad.length === 1 ? "{0} problem" : "{0} problems", bad.length) : na.length ? T("{0} unavailable", na.length) : T("All OK");
    const sub = [T("{0} sensors", it.length), bad.length && na.length ? T("{0} unavailable", na.length) : ""].filter(Boolean).join(" · ");
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
  _scSoon() { /* the render writes the DOM twice; measuring in between would force a layout each time, so measure once, next frame */
    if (this._scRaf) return; this._scRaf = requestAnimationFrame(() => { this._scRaf = 0; if (this._el && this.isConnected) this._scUpd(); });
  }
  _scUpd() {
    /* edge fades for the two scrolling rows (action buttons, info tiles) */
    for (const a of [this._el && this._el.actions, this._el && this._el.info]) {
      if (!a) continue;
      if (!a._scBound) { a._scBound = true; a.addEventListener("scroll", () => this._scUpd(), { passive: true }); }
      if (!a._scRO && typeof ResizeObserver === "function") { a._scRO = new ResizeObserver(() => this._scUpd()); a._scRO.observe(a); }
      if (a === this._el.actions) {
        /* scrolling buttons: size the cells so the next button always shows half, instead of a blank edge */
        if (a.classList.contains("scroll") && a.clientWidth) {
          const bs = parseFloat(getComputedStyle(a).getPropertyValue("--bs")) || 52, base = bs + 22, av = a.clientWidth - 4;
          const n = Math.max(1, Math.round((av - base / 2) / (base + 12)));
          const cw = (a.childElementCount > n ? Math.max(bs + 6, (av - n * 12) / (n + .5)) : base).toFixed(1) + "px";
          if (a.style.getPropertyValue("--cw") !== cw) a.style.setProperty("--cw", cw);
        } else if (a.style.getPropertyValue("--cw")) a.style.removeProperty("--cw");
      }
      const r = a.scrollWidth - a.clientWidth - a.scrollLeft > 6, l = a.scrollLeft > 6;
      a.toggleAttribute("data-r", r); a.toggleAttribute("data-l", l);
    }
  }
  _ageMin() { const t = new Date(this._s("sensor.last_updated") || "").getTime(); return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : 0; }
  /* Data age as a short tint badge on the refresh button: 1m, 3m, 1h ... yellow after 2 h, red after 4 h */
  _ageBadge(show) {
    const raw = this._s("sensor.last_updated"), t = new Date(raw || "").getTime();
    if (!show || !raw || !Number.isFinite(t)) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    const txt = m < 1 ? T("now") : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
    return `<i class="age ${m > 240 ? "bad" : m > 120 ? "warn" : ""}">${esc(txt)}</i>`;
  }
  _tickAge() {
    const a = this._el && this._el.rfs && this._el.rfs.querySelector(".age");
    if (!a) return;
    const t = document.createElement("template"); t.innerHTML = this._ageBadge(true);
    const n = t.content.firstChild;
    if (n && (n.className !== a.className || n.textContent !== a.textContent)) { a.className = n.className; a.textContent = n.textContent; }
  }
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
  /* Home Assistant resets "last changed" whenever the integration reloads, so the real lock and engine times come from the recorded history: the start of the current run of the same state, ignoring unavailable/unknown gaps. Loaded only when one of them changes. */
  _runStart(rows) {
    const t = (r) => (typeof (r.lu ?? r.lc) === "number" ? (r.lu ?? r.lc) * 1000 : Date.parse(r.last_updated || r.last_changed));
    let cur = null, since = NaN;
    for (const r of rows || []) { const st = r.s ?? r.state; if (st === undefined || st === "unavailable" || st === "unknown") continue; if (st !== cur) { cur = st; since = t(r); } }
    return { state: cur, since };
  }
  _lockKick() {
    const lk = this._obj("lock.doors"), en = this._obj("binary_sensor.engine"), od = this._obj("sensor.total_odometer");
    if (!lk || !this._hass) return;
    const key = [lk.state, lk.last_changed, en && en.state, en && en.last_changed, od && od.state].join("|");
    if (key === this._lhKey) return;
    this._lhKey = key;
    const ids = [this._id("lock.doors"), en && this._id("binary_sensor.engine"), od && this._id("sensor.total_odometer")].filter(Boolean), tok = (this._lhTok = (this._lhTok || 0) + 1);
    Promise.resolve(this._hass.callWS({ type: "history/history_during_period", start_time: new Date(Date.now() - 14 * 864e5).toISOString(), end_time: new Date().toISOString(), entity_ids: ids, include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true }))
      .then((res) => { if (tok !== this._lhTok || !this.isConnected) return; const lh = {}; for (const id of ids) lh[id] = this._runStart(res && res[id]); this._lh = lh; this._force(); })
      .catch(() => { this._lhKey = ""; });
  }
  _inUse() { return this._is("binary_sensor.engine", "on") || this._is("sensor.power_status", "on"); }
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
    if (this._s("binary_sensor.cloud_connection") === null && this._s("lock.doors") === null) return { icon: "alert", text: "Vehicle not found", sub: "Check the prefix in Card Settings → Vehicle → Vehicle setup", rgb: "var(--ds-warn)" };
    if (!cloudOk) return { icon: "cloudoff", text: "Offline", sub: T("Last update {0}", this._age()), rgb: "var(--ds-bad)" };
    if (v.charging) return { icon: "bolt", text: "Charging", sub: "", rgb: "var(--ds-ac)" };
    const alerts = this._diagItems().filter((d) => d.on).length, warn = alerts ? T(alerts === 1 ? "{0} warning" : "{0} warnings", alerts) : "";
    if (v.plugged) return { icon: "plug", text: "Charger connected", sub: warn, rgb: "var(--ds-warn)" };
    if (this._inUse()) return { icon: "engine", text: "In use", sub: warn, rgb: "var(--ds-ac)", plain: true, warn, inUse: true }; /* the lock is polled every few minutes and the car may lock itself while driving, so no lock claim while the engine runs */
    if (this._s("lock.doors") === "unlocking") return { icon: "unlock", text: "Unlocking…", sub: warn, rgb: "var(--ds-warn)" };
    if (v.unlocked) return { icon: "unlock", text: "Unlocked", sub: warn, rgb: "var(--ds-warn)", plain: true, warn, locked: false };
    const ls = this._s("lock.doors"); /* "locked" must be known before the car is shown as locked */
    if (ls === "locking") return { icon: "lock", text: "Locking…", sub: warn, rgb: "var(--ds-warn)" };
    if (ls !== "locked") return { icon: "alert", text: "Unknown state", sub: "The lock is not reporting its state", rgb: "var(--ds-warn)" };
    return { icon: "lock", text: "Locked", sub: warn, rgb: alerts ? "var(--ds-warn)" : "var(--ds-ac)", plain: true, warn, locked: true };
  }

  /* Rolling messages under "Locked / Unlocked" (status_sub setting). Returns [{t, w}] — w: warning */
  _since(ms) { const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24); return d >= 1 ? T("{0} d", d) : h >= 1 ? T("{0} h {1} min", h, m % 60) : T("{0} min", m); }
  _statusMsgs(st, mode) {
    const out = [], lk = this._obj("lock.doors"), lh = this._lh && this._lh[this._id("lock.doors")];
    const lt = lh && lk && lh.state === lk.state && Number.isFinite(lh.since) ? lh.since : lk && Date.parse(lk.last_changed);
    if (st.warn) out.push({ t: st.warn, w: true });
    const F = haFmt(this._hass), stamp = (ms) => (F.dayStart(Date.now()) === F.dayStart(ms) ? F.hm(ms) : F.dm(ms) + " " + F.hm(ms));
    const en = this._obj("binary_sensor.engine"), eh = en && this._lh && this._lh[this._id("binary_sensor.engine")], eT = en && (eh && eh.state === en.state && Number.isFinite(eh.since) ? eh.since : Date.parse(en.last_changed));
    const oh = this._lh && this._lh[this._id("sensor.total_odometer")], od = oh && Number.isFinite(oh.since) ? oh.since : NaN; /* the odometer proves a drive even when the engine sensor missed it */
    const et = en && en.state === "off" ? (Number.isFinite(od) ? Math.max(eT, od) : eT) : Number.isFinite(od) && !en ? od : NaN;
    if (st.inUse) { const on = en && en.state === "on" ? eT : NaN; if (Number.isFinite(on)) out.push({ t: T("Engine on since {0}", stamp(on)) }); }
    else if (st.locked && Number.isFinite(et) && !(et <= lt)) out.push({ t: T("Locked after {0}", stamp(et)) }); /* the lock cannot be caught between two polls, so a car that was driven since the last lock change was locked after the engine stopped */
    else if (Number.isFinite(lt)) out.push({ t: T(st.locked ? "Locked at {0}" : "Unlocked at {0}", stamp(lt)) });
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
      precondition: (() => { this._pcFetch(); const p = this._pcInfo || {}, ok = !!(this._hass && this._hass.companionRequest);
        return { on: !!p.active, icon: "precond", tone: p.active ? "ok" : "", pcsheet: true, pulse: !!p.scheduled && !p.active, disabled: !ok,
          sub: !ok ? "unavailable" : p.active ? (p.remaining ? `on · ${Math.ceil(p.remaining / 60)} min` : "on") : p.scheduled ? "scheduled" : "off" }; })(),
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
    return { on: act.length > 0, sub: act.length ? act.join(" · ") : "interior", tone: "" };
  }
  /* Which seat and wheel comforts are working right now: one small chip per running function, nothing when all are off (the tile stays as it is). */
  _seatInd() {
    const L = (k) => this._level(k), pick = (h, v) => (L(h) > 0 ? "h" : L(v) > 0 ? "v" : "");
    const dr = pick("number.front_left_seat_heating_level", "number.front_left_seat_ventilation_level"), pa = pick("number.front_right_seat_heating_level", "number.front_right_seat_ventilation_level");
    const items = [];
    if (L("switch.steering_wheel_heating") > 0) items.push(["h", "steering", ""]);
    if (dr) items.push([dr, dr === "h" ? "seatheat" : "seatvent", ""]);
    if (pa) items.push([pa, pa === "h" ? "seatheat" : "seatvent", " m"]);
    if (!items.length) return "";
    const label = esc(T("Seats & steering wheel"));
    return `<button class="cmf" data-seats style="--hc:${UI.hex2rgb(this._c.lvl_orange, "251,146,60")}" aria-label="${label}" title="${label}">${items.map(([k, i, m]) => `<span class="it ${k}${m}">${ico(i)}<span class="dt"></span></span>`).join("")}</button>`;
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
    if (a.pcsheet) { this._pcSheet = true; return this._force(); }
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
    const me = this._pending[a.id] = { before, watch: a.watch, want: this._want(a, before), t: Date.now(), sent: false }; /* this invocation: a late answer of an older one must not touch the UI */
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
    me.sent = true;
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
  /* One notice when the battery reaches the goal while charging. Only after this session saw the battery below the goal, so a reload does not repeat it. */
  _toast(msg, type) {
    clearTimeout(this._toastTimer);
    const ms = ((Number(this._c.toast_duration) > 0 ? Number(this._c.toast_duration) : 5) + (type === "error" ? 3 : 0)) * 1000;
    this._toastState = { msg, type, ms };
    this._toastTimer = setTimeout(() => { this._toastState = null; this._force(); }, ms);
    this._force();
  }
  _diagAct(d) {
    if (d.dgOk !== undefined) { this._dgOk = !this._dgOk; return this._force(); }
    if (d.dgSet !== undefined) { this._diagSheet = false; this._openDashboard(); return this._force(); }
    const found = discoverDiag(this._hass, this._c);
    if (d.dgIgnore !== undefined) { this._patch({ diag_ignore: [...new Set([...(this._c.diag_ignore || []), ...found.map((f) => f.entity)])] }); }
    this._force();
  }
  /* Lock popup: Lock / Unlock switch with the current state highlighted */
  _lockHtml() {
    const s = this._s("lock.doors"), p = this._pending.lock, locked = s === "locked", unl = s === "unlocked", st = this._status(this._vehicle());
    const text = p ? st.text : locked ? T("Locked") : unl ? T("Unlocked") : s ? s : T("Unavailable");
    const rgb = p || unl ? "var(--ds-warn)" : locked ? "var(--ds-ac)" : "var(--ds-bad)";
    const sub = p ? T("Waiting for confirmation from the vehicle") : this._statusMsgs(st, "roll").map((m) => m.t).join(" · ");
    const off = !!p || !(locked || unl);
    const ask = this._lockAsk && !p ? this._lockAsk : null; /* the question opens below the switch inside this window: no second popup */
    const seg = (k, ic, lb, on) => `<button data-lk="${k}" class="${on ? "on" : ""} ${k === "unlock" ? "w" : ""}"${off || ask ? " disabled" : ""}>${ico(ic)}<span>${esc(lb)}</span></button>`;
    const cf = ask ? CONFIRM_TEXT[ask] : null;
    const askBox = cf ? `<div class="lkask ${ask === "unlock" ? "w" : ""}" role="group" aria-label="${esc(T(cf[0]))}"><b>${esc(T(cf[0]))}</b><p>${esc(T(cf[1]))}</p><div class="lkbtn"><button data-lk="no">${esc(T("Cancel"))}</button><button data-lk="yes" class="go">${esc(T(ask === "unlock" ? "Unlock" : "Lock"))}</button></div></div>` : `<p class="lkh">${esc(T("Tap the other side to change"))}</p>`;
    return `${sheetHd(unl ? "unlock" : "lock", T("Doors"))}<div class="lkb ${String(rgb).includes("warn") ? "w" : String(rgb).includes("bad") ? "b" : ""}"><div class="lkt">${esc(text)}</div><div class="lks">${esc(sub)}</div></div>
      <div class="lksw">${seg("lock", "lock", T("Lock"), ask ? ask === "lock" : locked)}${seg("unlock", "unlock", T("Unlock"), ask ? ask === "unlock" : unl)}</div>
      ${askBox}`;
  }
  /* Confirmation window: the same layout as the Doors window (header, current state, Cancel / Confirm, question) for every command that asks first */
  _askHtml(key, o = {}) {
    const q = (CONFIRM_TEXT[key] || ["Continue?", ""])[0];
    let icon = o.icon, text = o.text, sub = o.sub, rgb = o.rgb;
    if (text === undefined) {
      const open = (e) => { const v = this._s(e); return v === "open" || v === "opening"; };
      const st = this._status(this._vehicle());
      if (key === "windows") { const v = this._s("cover.windows"); text = v ? stateText(v) : T("Unavailable"); rgb = open("cover.windows") ? "var(--ds-warn)" : "var(--ds-ac)"; }
      else if (key === "trunk") { const v = this._s("cover.trunk"); text = v ? stateText(v) : T("Unavailable"); rgb = open("cover.trunk") ? "var(--ds-warn)" : "var(--ds-ac)"; }
      else if (key === "climate" || key === "climate_temp") { text = this._climateIsOn() ? T("On") : T("Off"); rgb = "var(--ds-ac)"; }
      else { text = st.text; rgb = "var(--ds-ac)"; }
      sub = this._statusMsgs(st, "roll").map((m) => m.t).join(" · ");
    }
    icon = icon || CONF_ICO[key] || "check";
    const no = o.no || "data-close", yes = o.yes || 'data-sheet="yes"';
    return `${sheetHd(icon, T(CONF_HEAD[key] || "Confirm"))}<div class="lkb ${String(rgb).includes("warn") ? "w" : String(rgb).includes("bad") ? "b" : ""}"><div class="lkt">${esc(text)}</div><div class="lks">${esc(sub || "")}</div></div>
      <p class="lkh q">${esc(T(q))}</p>
      <div class="lksw"><button ${no}>${ico("close")}<span>${esc(T("Cancel"))}</span></button><button ${yes} class="go">${ico(CONF_ICO[key] || "check")}<span>${esc(T("Confirm"))}</span></button></div>`;
  }
  /* Charge plan: the Deepal Alternative schedule entities (switch + start/end time) */
  _planHas() { return !!this._obj("switch.charge_schedule") && !!this._obj("time.charge_schedule_start") && !!this._obj("time.charge_schedule_end"); }
  _planOn() { return this._s("switch.charge_schedule") === "on"; }
  _planFullHas() { return !!this._obj("switch.charge_schedule_to_full"); }
  _planFull() { return this._planFullHas() && this._s("switch.charge_schedule_to_full") === "on"; }
  /* Deepal Alternative marks a plan saved in the Deepal app or on the car (S05 PHEV) as not controllable: the car rejects changing it from Home Assistant. A missing attribute (BEV, older versions) means controllable. */
  _planLocked() { return (this._obj("switch.charge_schedule") || {}).attributes?.controllable === false; }
  _planVal(on, a, b, full) { return on && a && (full || b) ? (full ? T("From {0}", a) : `${a}–${b}`) : T("Off"); }
  _planTime(k) { const v = this._s("time." + k); return v ? String(v).slice(0, 5) : ""; }
  _planBtn() {
    if (!this._planHas() || this._c.plan_button === false) return "";
    const on = this._planOn();
    return `<button class="cpb${on ? " on" : ""}" data-plan aria-label="${esc(T("Charge plan"))}" title="${esc(T("Charge plan"))}">${ico("plan")}${on ? '<i class="cpd"></i>' : ""}</button>`;
  }
  _planSub(q) { return q.on ? (q.full ? T("Charging from {0} until full", q.start || "--:--") : T("Charging {0}–{1}", q.start || "--:--", q.end || "--:--")) : T("Off"); }
  /* The Deepal app refuses a plan whose end is less than 30 minutes after its start (across midnight too). */
  _planGap(a, b) { const m = (t) => { const [h, n] = String(t).split(":").map(Number); return h * 60 + n; }; return ((m(b) - m(a)) % 1440 + 1440) % 1440; }
  /* Save stays off until something differs from what the car has now (switch, start, end or Until full). */
  _planChanged(q) { const full = this._planFull(); return q.on !== this._planOn() || q.start !== this._planTime("charge_schedule_start") || !!q.full !== full || (!q.full && q.end !== this._planTime("charge_schedule_end")); }
  _planSyncSave() { const sv = this._planEl?.querySelector("[data-plan-save]"); if (sv) sv.disabled = !!this._planBusy || this._planLocked() || !this._planOk(this._planDraft) || !this._planChanged(this._planDraft); }
  _planOk(q) { return !!q.start && (!!q.full || (!!q.end && this._planGap(q.start, q.end) >= 30)); }
  async _planPaint() {
    const d = this._planEl; if (!d) return;
    if (this._pcStyle === undefined) { /* the time fields and labels are the preconditioning panel's own, so its stylesheet is reused */
      d.innerHTML = loaderHtml("plan");
      try { this._pcStyle = (await import(`${SCRIPT_BASE}companion-precondition.js?v=${CARD_VERSION}&rev=20261126-01`)).PC_STYLE || ""; } catch (_) { this._pcStyle = ""; }
      if (this._planEl !== d) return;
    }
    const q = this._planDraft || (this._planDraft = { on: this._planOn(), start: this._planTime("charge_schedule_start"), end: this._planTime("charge_schedule_end"), full: this._planFull() });
    const hasFull = this._planFullHas();
    const lk = this._planLocked(), dis = lk ? " disabled" : "", ptz = (this._obj("time.charge_schedule_start") || {}).attributes?.time_zone;
    const fld = (label, k) => `<div class="f cpc"><div class="lab"><span>${esc(T(label))}</span></div><input type="time" data-plan-t="${k}" aria-label="${esc(T(label))}" value="${esc(q[k])}"${dis}></div>`;
    /* End: a small "Until full" pill sits on the End card; when on, the time field becomes "Until full / No cutoff" */
    const pill = hasFull ? `<button type="button" class="cpfp${q.full ? " on" : ""}" data-plan-full aria-pressed="${q.full ? "true" : "false"}" aria-label="${esc(T("Charge until full"))}" title="${esc(T("No end time: the car charges until the battery is full."))}"${dis}>${esc(T("Until full"))}</button>` : "";
    const endCard = `<div class="f cpc"><div class="lab"><span>${esc(T("End"))}</span>${pill}</div>${q.full ? `<div class="cpfb"><b>${ico("battery")}<em>${esc(T("Until full"))}</em></b><span>${esc(T("No cutoff"))}</span></div>` : `<input type="time" data-plan-t="end" aria-label="${esc(T("End"))}" value="${esc(q.end)}"${dis}>`}</div>`;
    d.innerHTML = `<style>${this._pcStyle}</style>${lk ? `<p class="lkh" data-plan-locked>${esc(T("This plan was set in the Deepal app or in the car. Turn it off there first, then set it here."))}</p>` : ""}<button class="cpr${q.on ? " on" : ""}" data-plan-sw role="switch" aria-checked="${q.on}"${dis}><span>${esc(T("Scheduled charging"))}<small data-plan-sub>${esc(this._planSub(q))}</small></span><i class="sw ${q.on ? "on" : ""}"></i></button>
      <div class="pc cpq"><div class="two">${fld("Start", "start")}${endCard}</div></div>
      <button class="cpsave" data-plan-save${lk || this._planBusy || !this._planOk(q) || !this._planChanged(q) ? " disabled" : ""}>${esc(T("Save plan"))}</button>${ptz ? `<p class="cptz">${esc(T("Car time zone"))} ${esc(ptz)}</p>` : ""}`;
    const fb = d.querySelector("[data-plan-full]");
    if (fb) fb.addEventListener("click", () => { this._planDraft.full = !this._planDraft.full; this._planPaint(); d.querySelector("[data-plan-full]")?.focus({ preventScroll: true }); });
    d.querySelectorAll("[data-plan-t]").forEach((i) => i.addEventListener("input", () => { this._planDraft[i.dataset.planT] = i.value; this._planSyncSave(); const sub = d.querySelector("[data-plan-sub]"); if (sub) sub.textContent = this._planSub(this._planDraft); }));
  }
  async _planAct(b) {
    const q = this._planDraft; if (!q || this._planBusy || this._planLocked()) return;
    if (b.hasAttribute("data-plan-sw")) { /* update the nodes in place so the scroll position and a focused time field survive */
      q.on = !q.on; b.classList.toggle("on", q.on); b.setAttribute("aria-checked", String(q.on));
      const sw = b.querySelector(".sw"); if (sw) sw.classList.toggle("on", q.on);
      const sub = b.querySelector("[data-plan-sub]"); if (sub) sub.textContent = this._planSub(q);
      this._planSyncSave();
      return;
    }
    const full = !!q.full && this._planFullHas(), tm = /^\d\d:\d\d$/;
    if (!tm.test(q.start) || (!full && !tm.test(q.end))) return this._toast(T(full ? "Choose a start time." : "Choose a start and end time."), "error");
    if (!full && this._planGap(q.start, q.end) < 30) return this._toast(T("The end time must be at least 30 minutes after the start time."), "error");
    /* The car service always needs an end time; with "until full" the switch replaces it, so use one the app would accept. */
    const old = this._planTime("charge_schedule_end"), m = (t) => { const [h, n] = t.split(":").map(Number); return h * 60 + n; };
    const plus8 = (() => { const v = (m(q.start) + 480) % 1440; return String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0"); })();
    const end = tm.test(q.end) && this._planGap(q.start, q.end) >= 30 ? q.end : (tm.test(old) && this._planGap(q.start, old) >= 30 ? old : plus8);
    this._closeSheet(); /* the window closes at once; a failure shows as a toast */
    try {
      await this._hass.callService("deepal", "set_charge_schedule", { start_time: q.start, end_time: end, enabled: !!q.on });
      if (this._planFullHas() && full !== this._planFull()) await this._hass.callService("switch", full ? "turn_on" : "turn_off", { entity_id: this._id("switch.charge_schedule_to_full") });
    } catch (err) { this._failToast(err); }
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
  _closeSheet() { clearTimeout(this._confirmTimer); if (this._confirm && this._confirm.temp !== undefined) this._tpend = undefined; this._confirm = null; this._diagSheet = false; this._lockSheet = false; this._lockAsk = null; this._enSheet = false; this._enEl = null; this._nfSheet = false; this._nfEl = null; if (this._nfAct) { this._nfAct.destroy(); this._nfAct = null; } this._pcSheet = false; this._pcEl = null; if (this._pcAct) { this._pcAct.destroy(); this._pcAct = null; this._pcFetch(true); } this._planSheet = false; this._planEl = null; this._planDraft = null; this._stSheet = null; this._stEl = null; this._force(); }
  _popupBox() { if (!this._el) return null; if (this._confirm || this._diagSheet || this._lockSheet || this._enSheet || this._nfSheet || this._pcSheet || this._planSheet || this._stSheet) return this._el.box; return this._view ? this._el.vbox : null; }
  _closeTop() { if (this._confirm || this._diagSheet || this._lockSheet || this._enSheet || this._nfSheet || this._pcSheet || this._planSheet || this._stSheet) return this._closeSheet(); if (this._view) { this._view = null; this._force(); } }
  _key(e) {
    /* inside the card's shadow root e.target is retargeted to this element, so read the real node from the path;
       getRootNode() keeps a document-level listener from acting on another card's tiles */
    const hit = e.composedPath?.()[0] || e.target;
    if ((e.key === "Enter" || e.key === " ") && hit instanceof Element && hit.getRootNode() === this.shadowRoot
        && !hit.closest("button,a,input,select,textarea,[role=switch]")) {
      const t = hit.closest("[data-ent],[data-open],[data-plan],[data-cl-tile]");
      if (t) {
        e.preventDefault();
        if ((t.hasAttribute("data-plan") || t.hasAttribute("data-cl-tile")) && !t.hasAttribute("data-ent")) t.click(); /* the plan and charger-limit tiles have their own click handlers */
        else this._tap(t);                                                        /* energy / view / info tiles open in _tap */
        return;
      }
    }
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
      this._retSel = a ? (a.dataset.id ? `[data-id="${a.dataset.id}"]` : a.dataset.more !== undefined ? "[data-more]" : a.id ? `#${a.id}` : a.getAttribute("class") ? `.${(c => typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(c) : c)(a.getAttribute("class").split(" ")[0])}` : null) : null;
      requestAnimationFrame(() => { const b = this._popupBox(); const t = b && (b.querySelector(".go") || b.querySelector(".x") || b.querySelector("button")); if (t) t.focus({ preventScroll: true }); });
    } else if (!open && this._wasOpen && this._retSel) {
      const sel = this._retSel; this._retSel = null;
      requestAnimationFrame(() => { let t = null; try { t = this.shadowRoot.querySelector(sel); } catch (_) {} if (t && !t.disabled) t.focus({ preventScroll: true }); });
    }
    this._wasOpen = open;
  }
  _paintNotificationLink() {
    const button=this._el?.nfbell;if(!button)return;
    button.hidden=(this._c.top_buttons_hidden||[]).includes('bell');
    const n=button.hidden||this._isCompanionPreview?0:this._nfUnread||0,key=String(n);
    if(button._drawn!==key){button._drawn=key;button.innerHTML=ico('chat')+(n?`<i class="bdg">${n>9?'9+':n}</i>`:'');button.title=T('Notifications')+(n?` · ${n}`:'');button.setAttribute('aria-label',button.title);}
    if(!button.hidden&&!this._nfTimer){this._nfCheck();this._nfTimer=setInterval(()=>this._nfCheck(),60000);}
  }
  /* Unread alerts for this Home Assistant user, kept by the backend (so it follows the user across devices). One small request a minute while the page is visible. */
  async _nfCheck(mark) {
    if (this._isCompanionPreview) return; /* the settings preview has no unread alerts and never calls the backend */
    const h = this._hass; if ((!mark && (document.hidden || this._nfSheet)) || !h || !h.companionRequest || (h.user && h.user.is_admin === false) || this._nfBusy) return;
    this._nfBusy = true;
    try {
      const r = await h.companionRequest("notifications_unread", mark ? { mark: true } : {}), n = Number(r && r.unread) || 0;
      if (n !== this._nfUnread) { this._nfUnread = n; this._paintNotificationLink(); }
    } catch (e) { /* the badge is optional */ } finally { this._nfBusy = false; }
  }
  _nfMarkSeen() {
    if (this._isCompanionPreview) return;
    if (this._nfUnread) { this._nfUnread = 0; this._paintNotificationLink(); }
    this._nfBusy = false; this._nfCheck(true);
  }
  /* Settings live in the Companion dashboard (admins only); the card just links there. */
  /* The preconditioning sheet links to Companion dashboard → Preconditioning (admins only); a section name scrolls to it, e.g. "notifications". */
  _openPreconditionSettings(section) {
    this._closeSheet();
    history.pushState(null, "", "/deepal-companion#preconditioning" + (section ? "/" + section : ""));
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }
  _openDashboard() {
    history.pushState(null, "", "/deepal-companion");
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }
  async _loadNotifications(d) {
    const gone = () => this._nfEl !== d, h = this._hass;
    const fail = (m) => { if (!gone()) d.innerHTML = `<p class="hint">${esc(T(m))}</p>`; };
    if (h && h.user && h.user.is_admin === false) return fail("Notifications are only available to administrators.");
    try {
      const request = (op, data) => h.companionRequest(op, data);
      const [mod, page] = await Promise.all([import(`${SCRIPT_BASE}notification-activity.js?v=${CARD_VERSION}&rev=20261126-01`), request("notifications_history", { limit: 5 })]);
      if (gone()) return;
      d.innerHTML = ""; const host = document.createElement("div"); d.appendChild(host);
      this._nfAct = mod.mountActivity(host, request, { loaderHtml, loaderCss:LOADER_CSS, format:haFmt, t: T, compact: true, unread: this._nfOpenUnread || 0 }, (m, err) => this._toast(m, err ? "error" : undefined),()=>this._hass);
      this._nfAct.set(page);
    } catch (e) { fail(/Unknown.*operation/i.test((e && e.message) || "") ? "Restart Home Assistant to load notifications, then try again." : "Could not load notifications."); }
  }
  /* Preconditioning state for the card button: colour while a Companion session runs, pulsing dot while a schedule is set.
     Light polling (every 60 s, 15 s while active); never runs in previews. */
  _pcFetch(force) {
    const h = this._hass;
    if (!h || !h.companionRequest || this._isCompanionPreview || this._pcBusy || document.hidden) return;
    const every = this._pcInfo && (this._pcInfo.running || this._pcInfo.starting) ? 5000 : this._pcInfo && this._pcInfo.active ? 15000 : 60000;
    if (!force && Date.now() - (this._pcAt || 0) < every) return;
    this._pcBusy = true; this._pcAt = Date.now();
    h.companionRequest("precondition_get").then((r) => {
      const st = r.state || {}, cfg = r.config || {};
      const info = { active: st.owner === "companion" && !!st.session_start && !!(r.climate && r.climate.on), scheduled: !!cfg.scheduling_enabled && (cfg.schedules || []).some((x) => x.enabled), running: st.status === "ACTIVE" || !!(r.climate && r.climate.on), starting: ["START_REQUESTED", "STARTING", "VERIFYING_START", "RETRYING_START"].includes(st.status), stopping: !!st.status && st.status !== "IDLE" && st.status !== "ACTIVE" && /STOP/.test(st.status), hasEnd: st.owner === "companion" && !!st.session_start && r.estimated_remaining != null };
      this._pcRem = { rem: r.estimated_remaining, at: Date.now() };
      const changed = JSON.stringify(info) !== JSON.stringify(this._pcInfo || {}); if (!changed && this._el && this._el.vclim) this._pqSync(this._el.vclim);
      this._pcInfo = info; if (changed) this._force();
    }).catch(() => {}).finally(() => { this._pcBusy = false; });
  }
  /* Charger limit status for the charging block: asked now and then while the car is plugged in (the limit itself runs in the backend). */
  _clFetch(force) {
    const h = this._hass;
    if (!h || !h.companionRequest || this._isCompanionPreview || this._clBusy || document.hidden) return;
    if (!force && Date.now() - (this._clAt || 0) < (this._clInfo && this._clInfo.mode === "off" ? 300000 : 15000)) return; /* a limit that is off is only looked at again every 5 minutes (a reopened card asks at once) */
    this._clBusy = true; this._clAt = Date.now();
    h.companionRequest("charger_limit_get").then((r) => {
      const info = { phase: r.phase || "off", target: Number(r.target) || 0, target_full: !!r.target_full, mode: (r.config || {}).mode || "off", power_w: typeof r.power_w === "number" ? r.power_w : null, energy_kwh: typeof r.energy_kwh === "number" ? r.energy_kwh : null };
      const changed = JSON.stringify(info) !== JSON.stringify(this._clInfo || {}); this._clInfo = info; if (changed) this._force();
    }).catch(() => {}).finally(() => { this._clBusy = false; });
  }
  /* The limit row: what it is doing, the time the target is reached (the same estimate as the Target figure) and, while it holds the charger stopped, a Charge anyway button. */
  _clDemo() { return this._isCompanionPreview && /^limit-/.test(this._previewMode || "") ? this._previewMode : ""; } /* the settings preview can show the limit without a charger */
  /* The limit as the card shows it: live data from the backend, or the settings demo values (limit-wait: 7.2 kW, limit-stop: 12.4 kWh). */
  _clCurrent() { const demo = this._clDemo(); this._clFetch(); return demo ? { phase: demo === "limit-stop" ? "stopped" : "waiting", target: 80, mode: "live", power_w: 7200, energy_kwh: 12.4 } : this._clInfo; }
  /* The reading that goes after the status: the power while it waits (3.2 kW, 850 W), the energy once it has stopped (12.4 kWh). Empty when there is none. */
  _clNum(i) {
    if (i.phase === "waiting" && typeof i.power_w === "number") return i.power_w >= 1000 ? `${this._fmtNum(i.power_w / 1000, 1)} kW` : `${this._fmtNum(i.power_w)} W`;
    if (i.phase === "stopped" && typeof i.energy_kwh === "number") return `${this._fmtNum(i.energy_kwh, 1)} kWh`;
    return "";
  }
  _clRow(tg) {
    const i = this._clCurrent(); if (!i || i.mode === "off" || i.phase === "off") return "";
    const admin = !(this._hass && this._hass.user && this._hass.user.is_admin === false), g = i.target, num = this._clNum(i), tail = num ? ` · ${num}` : "";
    const eta = tg && tg.eta && !tg.reached ? ` · ≈${UI.clock(tg.eta)}` : "";
    const rows = { waiting: [T("Limit {0}%", g) + eta + tail, "ok"], stopped: [T("Stopped at {0}%", g) + tail, "ok"], paused: [T("Limit paused until you plug in again"), "warn"], would_stop: [T("Dry run: would have stopped at {0}%", g), "info"], failed: [T("Could not stop the charger"), "bad"], unavailable: [T("Charger not available"), "warn"], no_target: [T(i.target_full || g >= 100 ? "Target is 100%, nothing to stop" : "No charging target set"), "warn"] };
    const r = rows[i.phase]; if (!r) return "";
    const btn = admin && i.phase === "stopped" ? `<button class="cg-lbtn" data-cl-resume>${esc(T("Charge anyway"))}</button>` : "";
    return `<div class="cg-lim ${r[1]}">${ico("bolt")}<span>${esc(r[0])}</span>${btn}</div>`;
  }
  /* The charger limit as one info tile (same tile as Odometer / Charge plan). Only while the limit is on; the value is the state, the target time is appended while it waits. Same data as the row above: the settings demo uses the limit-wait and limit-stop preview states. */
  _clTile(v) {
    const i = this._clCurrent();
    if (!i || i.mode === "off" || i.phase === "off") return "";
    const g = i.target, tg = UI.chargeTarget(v.battery, v.charging, this._s("sensor.remaining_charge_time_h_mm"), g), num = this._clNum(i);
    const eta = tg && tg.eta && !tg.reached ? ` · ≈${UI.clock(tg.eta)}` : "";
    const vals = { waiting: `${g}%${eta}`, stopped: T("Stopped"), paused: T("Paused"), would_stop: T("Dry run"), failed: T("Failed"), unavailable: T("Unavailable"), no_target: T(i.target_full || g >= 100 ? "Target 100%" : "No target") };
    const val = vals[i.phase]; if (val === undefined) return "";
    return `<div class="tile" data-cl-tile="${esc(i.phase)}" role="button" tabindex="0" title="${esc(T("Charger limit"))}">${ico("bolt")}<div><div class="v">${esc(val)}${num ? `<small>${esc(num)}</small>` : ""}</div><div class="l">${esc(T("Charger limit"))}</div></div></div>`;
  }
  /* Tapping the tile while the charger is held stopped asks first; the answer calls charger_limit_resume (see the confirm sheet). In the settings demo nothing is sent. */
  _clAsk() {
    this._confirm = { id: "charger_limit", key: "limit_resume", limit: true };
    clearTimeout(this._confirmTimer);
    this._confirmTimer = setTimeout(() => { this._confirm = null; this._force(); }, 8000);
    this._force();
  }
  _clResume() {
    const h = this._hass;
    if (this._isCompanionPreview || !h || !h.companionRequest) return;
    Promise.resolve(h.companionRequest("charger_limit_resume")).catch(() => {}).finally(() => { this._clAt = 0; this._clFetch(true); });
  }
  async _loadPrecondition(d) {
    const gone = () => this._pcEl !== d, h = this._hass;
    if (!h || !h.companionRequest) { d.innerHTML = `<p class="hint">${esc(T("Preconditioning needs the Deepal Companion integration."))}</p>`; return; }
    try {
      const mod = await import(`${SCRIPT_BASE}companion-precondition.js?v=${CARD_VERSION}&rev=20261126-01`);
      if (gone()) return;
      d.innerHTML = ""; const host = document.createElement("div"); d.appendChild(host);
      this._pcAct = mod.mountPrecondition(host, { request: (op, data) => h.companionRequest(op, data), t: T, loaderHtml, loaderCss: LOADER_CSS, mode: "quick", admin: !!(this._rawHass || this._hass)?.user?.is_admin, onMore: (section) => this._openPreconditionSettings(section),
        admin: !(h.user && h.user.is_admin === false), notify: (m, err) => this._toast(m, err ? "error" : undefined), getHass: () => this._hass });
    } catch (e) { if (!gone()) d.innerHTML = `<p class="hint">${esc(T("Could not load preconditioning."))}</p>`; }
  }
  _vsheetOpen() { return !!this._view && !this._diagSheet && !this._lockSheet && !this._enSheet && !this._nfSheet && !this._pcSheet && !this._planSheet && !this._stSheet; }

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
  _failToast(err) { return this._toast(err?.message ? T("Failed: {0}", tError(err.message)) : T("The command failed"), "error"); }
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
  _layerBase() { return `${SCRIPT_BASE}images/`; }

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
      <div class="pqx" id="pqx" hidden><span class="pqi" aria-hidden="true">${ico("precond")}</span><div class="pqs" data-pq-body></div></div>`;
  }
  _seatsHtml() {
    const B = `${this._layerBase()}interior/`;
    const btns = INT_SPOTS.map(([id, , icon, name, x, y]) => `<button class="sbtn ${icon === "seatvent" ? "cool" : "hot"}" data-spot="${id}" style="left:${x}%;top:${y}%" aria-label="${esc(I18N.t(name, []))}" title="${esc(name)}">${ico(icon)}<span class="lvl"><i></i><i></i><i></i></span></button>`).join("");
    return `<div class="ipane"><div class="ipi"><img data-l="base" src="${esc(B)}base.webp?r=2" alt="">${INT_LAYERS.map((n) => `<img class="l" data-l="${n}" src="${esc(B + n)}.webp?r=2" alt="">`).join("")}${btns}</div></div>`;
  }

  /* Layers are not all loaded together: the src is set only when a layer is needed for the first time (e.g. "open door"). DOM writes happen only if something changed. */
  _lazyOn(im, on) {
    this._watchLayerImage(im);
    if (im._on === on) return;
    im._on = on; im.classList.toggle("on", on);
    if (on && !im.getAttribute("src") && im.dataset.src) im.setAttribute("src", im.dataset.src);
  }
  _layerOn(im, [, , fn, op, clip]) {
    const on = !!fn(), o = on && op != null ? String(op) : "", cp = !clip ? "" : on ? clip() : (im._cp || ""); /* a clipped layer keeps its last clip while it fades out: without it the whole red window shows for a moment */
    this._lazyOn(im, on);
    if (im._op !== o) { im._op = o; im.style.opacity = o; }
    if (im._cp !== cp) { im._cp = cp; im.style.clipPath = cp; }
  }
  /* How far a window is open, 0–100, as the sensors say. The opening sensor is used when the vehicle reports it; otherwise the open/closed sensor counts as fully open. */
  _winRaw(p, sd) {
    const id = `sensor.${p}_${sd}_window_opening`, n = this._n(id), bin = this._is(`binary_sensor.${p}_${sd}_window_open`, "on"), last = this._winGood || (this._winGood = {});
    if (n !== null && Number.isFinite(n)) return (last[p + "_" + sd] = Math.max(0, Math.min(100, n)));
    /* The sensor sometimes reports "unknown" for a moment between two readings: keep the last reading while the open/closed sensor still agrees with it */
    const kept = last[p + "_" + sd];
    if (this._obj(id) && kept != null && bin === (kept > 0)) return kept;
    return bin ? 100 : 0;
  }
  /* How far the drawn glass is open. The sensor only reports now and then, so the glass glides to each new value at a steady speed instead of jumping.
     A new value in the direction it is already going just moves the goal further. A value the other way waits until the move in progress is finished, then starts. */
  _winPct(p, sd) {
    const raw = this._winRaw(p, sd), key = p + "_" + sd, ws = this._winS || (this._winS = {});
    if (this._isCompanionPreview && this._previewMode && this._previewMode !== "live") { delete ws[key]; return raw; } /* a preview demo already moves the windows itself */
    let w = ws[key];
    if (!w) { ws[key] = { cur: raw, raw, q: [] }; return raw; } /* the first value is shown as it is */
    if (w.raw !== raw) { w.raw = raw; this._winPush(w, raw); }
    return w.cur;
  }
  _winPush(w, raw) {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { w.cur = raw; w.q = []; return; }
    if (!w.q.length) { if (w.cur !== raw) w.q.push(raw); }
    else {
      const last = w.q[w.q.length - 1], prev = w.q.length > 1 ? w.q[w.q.length - 2] : w.cur, dir = Math.sign(last - prev);
      if (dir !== 0 && Math.sign(raw - last) === dir) w.q[w.q.length - 1] = raw; else w.q.push(raw);
      if (w.q.length > 6) w.q.splice(1, w.q.length - 6);
    }
    this._winKick();
  }
  _winKick() {
    if (this._winRaf) return;
    let last = performance.now();
    const step = (t) => {
      this._winRaf = 0;
      if (!this.isConnected || !this._el) return;
      const dt = Math.max(0, t - last); last = t;
      let moving = false;
      for (const w of Object.values(this._winS || {})) {
        let room = dt * WIN_SPEED;
        while (w.q.length && room > 0) {
          const goal = w.q[0], far = goal - w.cur;
          if (Math.abs(far) <= room) { w.cur = goal; room -= Math.abs(far); w.q.shift(); } else { w.cur += Math.sign(far) * room; room = 0; }
        }
        if (w.q.length) moving = true;
      }
      for (const [imgs, lay] of [[this._cvtImgs, this._cvtL], [this._cvImgs, this._cvL], [this._isoImgs, this._isoL]]) if (imgs && lay) imgs.forEach((im, i) => { if (lay[i] && /^window_/.test(lay[i][0])) this._layerOn(im, lay[i]); });
      if (moving) this._winRaf = requestAnimationFrame(step);
    };
    this._winRaf = requestAnimationFrame(step);
  }
  /* Share of the glass that is gone (0–1): the rear windows stop at WIN_REAR_TRAVEL */
  _winFrac(p, sd) { return this._winPct(p, sd) / 100 * (p === "rear" ? WIN_REAR_TRAVEL : 1); }
  /* Clip of a window layer at a given opening: "open" keeps the band that is open (top), "glass" keeps the glass that is left (bottom).
     The glass keeps its exact shape and slides straight down: the dark glass is the window shape moved down by the same distance everywhere, so below the moved top edge the glass is as it was. What the glass leaves free (also along the pillars) is the red opening. */
  _winClip(p, sd, door, part, st) {
    const pts = (WIN_ISO[`${p}_${sd}`] || {})[door ? "o" : "c"];
    if (!pts) return "";
    const f = this._winFrac(p, st || sd), hm = Math.max(...pts.map((q) => q[2] - q[1])), d = f * hm;
    /* Far rear window: the glass slides down along its front edge, so the opening appears at the back and not as a sliver at the front */
    let s = 0;
    if (p === "rear" && sd === "right") { const mn = Math.min(...pts.map((q) => q[1])), j = pts.findIndex((q) => q[1] <= mn + 2); if (j > 0 && pts[0][1] > pts[j][1]) s = (pts[j][0] - pts[0][0]) / (pts[0][1] - pts[j][1]) * d; }
    const pc = (x, y) => `${(x / 7.5).toFixed(2)}% ${(y / 5).toFixed(2)}%`, n = pts.length;
    const cut = pts.map(([x, t]) => pc(x - s, Math.min(500, t + d))), top = pts.map(([x]) => pc(x, 0));
    return part === "open" ? `polygon(${[...top, pc(pts[n - 1][0], 500), pc(pts[n - 1][0] - s, 500), ...cut.slice().reverse()].join(",")})` : `polygon(${[...cut, pc(pts[n - 1][0] - s, 500), pc(pts[0][0] - s, 500)].join(",")})`;
  }





  /* Car View layer list [name, folder, condition] in the order of the dec_deepal repo (behind the car → car → in front) */
  /* Car side of the 3/4 view: "driver" shows the car as rendered, "passenger" mirrors it (the passenger doors, windows and signals are then drawn on the near side). "auto" mirrors only while something is open on the passenger side and nothing on the driver side. */
  _mirrorNow() {
    const s = this._c.car_side;
    if (s === "driver") return false;
    if (s === "passenger") return true;
    const o = (sd) => ["front", "rear"].some((p) => this._is(`binary_sensor.${p}_${sd}_door`, "on") || this._winRaw(p, sd) > 0);
    return o("right") && !o("left");
  }
  _ms(sd) { return this._mir ? (sd === "left" ? "right" : "left") : sd; } /* the side whose sensors are drawn on side sd */
  _msId(id) { return this._mir ? id.replace(/([._])(left|right)_/, (m, c, s) => c + (s === "left" ? "right" : "left") + "_") : id; }
  _isoLayers(color, wheels, hero) {
    const out = [];
    const L = (dir, name, fn, op, clip, cls) => { out.push([name, dir, fn, op, clip, cls]); };
    const M = (sd) => hero ? this._ms(sd) : sd; /* only the hero can be mirrored */
    const dk = (p, sd) => `binary_sensor.${p}_${sd}_door`;
    const door = (p, sd) => { const d = () => this._is(dk(p, M(sd)), "on"), pc = () => this._winPct(p, M(sd));
      /* Glass in the lower part, red in the opening at the top; the share comes from the window opening sensor */
      for (const [o, suf] of [[false, ""], [true, "_door_open"]]) { L("common", `window_${p}_${sd}_closed${suf}`, () => this._winFrac(p, M(sd)) < 1 && d() === o, null, () => this._winClip(p, sd, o, "glass", M(sd))); L("common", `window_${p}_${sd}_alert${suf}`, () => pc() > 0 && d() === o, null, () => this._winClip(p, sd, o, "open", M(sd))); } L(color, `door_${p}_${sd}_open`, d); L(color, `door_${p}_${sd}_closed`, () => !d()); };
    const trunk = () => this._is("binary_sensor.trunk", "on"), hood = () => this._is("binary_sensor.hood", "on");
    door("rear", "right"); door("front", "right"); L(color, "trunk_closed", () => !trunk());
    L(color, "base", () => true); if (wheels) L("common", "wheels_" + wheels, () => true);
    L(color, "trunk_open", trunk); L(color, "hood_open", hood); L(color, "hood_closed", () => !hood());
    door("rear", "left"); door("front", "left");
    /* The windows of the far side are hidden behind the car; when open they are drawn red ON TOP of the car, semi-transparent, as if seen through the glass */
    for (const p of ["front", "rear"]) { const d = () => this._is(dk(p, M("right")), "on"), pc = () => this._winPct(p, M("right")); for (const [o, suf] of [[false, ""], [true, "_door_open"]]) L("common", `window_${p}_right_alert${suf}`, () => pc() > 0 && d() === o, FAR_ALERT, () => this._winClip(p, "right", o, "open", M("right"))); }
    const hb = () => this._is("binary_sensor.high_beam", "on"), drl = () => this._is("binary_sensor.position_lamp", "on");
    L("common", "low_beam_on", () => this._is("binary_sensor.low_beam", "on") || hb());
    L("common", "low_beam_on", hb, null, null, "hb"); /* high beam: the same beam, twice as strong */
    /* White position lamp: the triangle always stays on; the white line is off while the turn signal (or hazard) of this side is on, so only the amber flashes on it */
    const sigL = () => this._sigOn(hero && this._mir ? "binary_sensor.right_turn_signal" : "binary_sensor.left_turn_signal");
    L("common", "drl_on_t", drl); L("common", "drl_on_l", () => drl() && !sigL());
    return out;
  }

  /* The door handles of the unlocked car (SVG over the layers); hidden while their door is open */
  /* Mirrored view: only the writing on the number plate is flipped back so it reads correctly (a cut of the base image over the mirrored plate) */
  _plateFix(base) {
    const P = { l: .188, t: .575, w: .0693, h: .036 };
    return `<div class="pl" aria-hidden="true" style="left:${P.l * 100}%;top:${P.t * 100}%;width:${P.w * 100}%;height:${P.h * 100}%;background-image:url(${esc(base)});background-size:${100 / P.w}% ${100 / P.h}%;background-position:${P.l / (1 - P.w) * 100}% ${P.t / (1 - P.h) * 100}%"></div>`;
  }
  _hdlSvg(top) {
    const r = top ? HDL_TOP.map(([k, x, y]) => `<rect data-d="${k}" x="${x - 2}" y="${y - 12}" width="4" height="24" rx="2"/>`) : HDL_ISO.map(([k, x, y, a]) => `<rect data-d="${k}" x="${x - 11}" y="${y - 2}" width="22" height="4" rx="2" transform="rotate(${a} ${x} ${y})"/>`);
    return `<svg class="hdl" viewBox="0 0 750 ${top ? 750 : 500}" aria-hidden="true">${r.join("")}</svg>`;
  }
  _turnSvg(base) {
    const st = (o, a) => `<stop offset="${o}" style="stop-color:rgb(var(--ds-warn));stop-opacity:${a}"/>`;
    const gr = TURN_ISO.map((t, i) => { const [x1, y1, x2, y2] = t.d.match(/-?[\d.]+/g); return `<linearGradient id="ds-tg${i}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${st(0, .5)}${st(.2, 1)}${st(.8, 1)}${st(1, .5)}</linearGradient>`; }).join("");
    const el = TURN_ISO.map((t, i) => `<g data-t="${t.k}" data-i="${i}"${t.show ? ' style="display:none"' : ""}>${t.haze || ""}<path class="gl" d="${t.d}" stroke="url(#ds-tg${i})"${t.haze ? ' style="stroke-width:4.2"' : ""}/><path class="cr" d="${t.d}" stroke-width="${t.w}" stroke="url(#ds-tg${i})"/></g>`).join("");
    const mk = (f) => { const u = esc(`${base}${f}.webp`); return `-webkit-mask-image:url(${u});mask-image:url(${u})`; };
    const dc = `<g class="drlc"><path class="dgw" d="M129 224.8 L125.9 236.3"/><path class="dcw" d="M129 224.8 L125.9 236.3"/></g>`; /* white corner lamp of the far side while the position lamp is on */
    return `<div class="tnt" data-mn="${esc(`${base}drl_mask.webp`)}" data-mt="${esc(`${base}drl_mask_tri.webp`)}" style="${mk("drl_mask")}"></div><div class="amb" style="${mk("drl_mask_line")}"></div><svg class="trn" viewBox="0 0 750 500" aria-hidden="true"><defs>${gr}</defs>${dc}${el}</svg>`;
  }
  /* Soft amber haze in the air behind the rear left corner (behind the car, not on the bodywork) while the left turn signal / hazard is on */
  _turnBack() {
    return `<svg class="trn" viewBox="0 0 750 500" aria-hidden="true"><defs><radialGradient id="ds-trg"><stop offset="0" stop-color="rgb(255,170,80)" stop-opacity=".42"/><stop offset=".5" stop-color="rgb(255,150,50)" stop-opacity=".16"/><stop offset="1" stop-color="rgb(255,120,0)" stop-opacity="0"/></radialGradient></defs><g data-t="left"><ellipse cx="655" cy="178" rx="40" ry="24" fill="url(#ds-trg)" transform="rotate(-10 655 178)" style="filter:blur(7px)"/><ellipse cx="653" cy="177.5" rx="18" ry="11" fill="url(#ds-trg)" opacity=".6" style="filter:blur(6px)"/></g></svg>`;
  }
  /* Turn signal state with a minimum show: every change to "on" gives 4 full blinks, even when the sensor goes off again sooner (the sensor updates slower than the lamp blinks) */
  _sigOn(id) {
    const raw = this._is(id, "on"), h = this._sigHold || (this._sigHold = {}), e = h[id] || (h[id] = { prev: false, until: 0, timer: null }), now = Date.now();
    if (raw && !e.prev) e.until = now + 4 * 700;
    /* the other side is on while this one is off: drop this side's hold at once (both on = hazards keep both) */
    const L = this._msId("binary_sensor.left_turn_signal"), R = this._msId("binary_sensor.right_turn_signal"), oid = id === L ? R : id === R ? L : null;
    if (!raw && oid && this._is(oid, "on")) e.until = 0;
    e.prev = raw;
    if (raw) return true;
    if (now < e.until) { if (!e.timer) e.timer = setTimeout(() => { e.timer = null; this._force(); }, e.until - now + 30); return true; }
    return false;
  }
  _turnSync(box) {
    const L = this._sigOn(this._msId("binary_sensor.left_turn_signal")), R = this._sigOn(this._msId("binary_sensor.right_turn_signal")), D = this._is("binary_sensor.position_lamp", "on");
    for (const g of box.querySelectorAll(".trn g[data-t]")) {
      const t = g.dataset.i != null ? TURN_ISO[+g.dataset.i] : null;
      g.classList.toggle("on", g.dataset.t === "left" ? L : R);
      if (t && t.show) { const sh = this._is(this._msId(t.show), "on") ? "" : "none"; if (g.style.display !== sh) g.style.display = sh; }
      if (t && t.dOpen) { const d = this._is(this._msId(t.door), "on") ? t.dOpen : t.d; if (g.dataset.d !== d) { g.dataset.d = d; for (const p of g.querySelectorAll("path")) p.setAttribute("d", d); } }
    }
    const a = box.querySelector(".amb"), tn = box.querySelector(".tnt"), dc = box.querySelector(".drlc");
    if (a) a.classList.toggle("on", L);
    if (tn) { tn.classList.toggle("lit", D); const m = L ? tn.dataset.mt : tn.dataset.mn; if (tn._m !== m) { tn._m = m; tn.style.setProperty("-webkit-mask-image", `url(${m})`); tn.style.setProperty("mask-image", `url(${m})`); } } /* while this side signals, the tint keeps to the triangle */
    if (dc) dc.classList.toggle("lit", D);
  }
  _hdlSync(box) {
    for (const r of box.querySelectorAll(".hdl rect")) { const [p, sd] = r.dataset.d.split("_"); r.classList.toggle("off", this._is(`binary_sensor.${p}_${this._ms(sd)}_door`, "on")); }
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
      const d = () => this._is(`binary_sensor.${p}_${sd}_door`, "on"), w = () => this._winPct(p, sd) > 0;
      L(color, `window_${p}_${sd}_open`, () => w() && !d()); /* with the red of the open window and the door frame in the car's colour */
    }
    L("common", "low_beam_on", () => this._is("binary_sensor.low_beam", "on"));
    return out;
  }
  /* Which view the hero shows: the device's choice (button) or the default from the settings */
  _heroView() {
    if (this._hview === undefined) this._hview = lsRead(`deepal-companion-view-choice:${this._companion.view_id}`) || null;
    return !this._topFail && (this._hview || this._c.hero_view) === "top" ? "top" : "iso";
  }
  _toggleView() {
    this._hview = this._heroView() === "top" ? "iso" : "top";
    lsWrite(`deepal-companion-view-choice:${this._companion.view_id}`, this._hview);
    this._force();
  }

  /* Day phase for the background: sun.sun (sun elevation) if present, otherwise the clock */
  _skyPhase() {
    const m = this._c.hero_sky;
    if (m === "neon") return this._neonPhase();
    if (m === "neon-day" || m === "neon-afternoon" || m === "neon-night") return m;
    if (SKY_PH[m]) return m;
    if (m !== "auto") return "";
    const a = this._hass?.states?.["sun.sun"]?.attributes, e = a && a.elevation != null ? Number(a.elevation) : NaN;
    if (!isNaN(e)) return e < -6 ? "night" : e < 8 ? (a.rising ? "morning" : "evening") : a.rising && e < 30 ? "morning" : "afternoon";
    const h = haFmt(this._hass).hour(Date.now());
    return h >= 6 && h < 11 ? "morning" : h >= 11 && h < 17 ? "afternoon" : h >= 17 && h < 20 ? "evening" : "night";
  }
  /* Neon city background: three photos (day, afternoon sunset, night) chosen automatically from the sun, or the clock */
  _neonPhase() {
    const a = this._hass?.states?.["sun.sun"]?.attributes, e = a && a.elevation != null ? Number(a.elevation) : NaN;
    if (!isNaN(e)) return e < -4 ? "neon-night" : !a.rising && e < 20 ? "neon-afternoon" : "neon-day";
    const h = haFmt(this._hass).hour(Date.now());
    return h >= 6 && h < 16 ? "neon-day" : h >= 16 && h < 20 ? "neon-afternoon" : "neon-night";
  }
  _neonImg(ph) { const u = `${this._layerBase()}neon/neon_${ph.slice(5)}.webp`; return `<img class="bg" src="${u}" alt="" draggable="false" decoding="async" onerror="this.remove()"><img class="mn" src="${u}" alt="" draggable="false" decoding="async" onerror="this.remove()">`; }
  _skySet(on) {
    const el = this._el.sky; if (!el) return;
    const ph = on ? this._skyPhase() : "";
    if (this._skyP === ph) return;
    this._skyP = ph; el.dataset.p = ph; el.innerHTML = !ph ? "" : ph.startsWith("neon-") ? this._neonImg(ph) : skySvg(ph); this._el.hero.dataset.sky = ph;
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
      this._mir = false;
      const key = color + "|" + root;
      if (this._cvtKey !== key || !el.cvt.firstChild) {
        this._cvtKey = key; this._cvtL = this._topLayers(color);
        const nb = root + "top/" + color + "/base.webp";
        el.cvt.innerHTML = nfxGround("top", nb) + this._cvtL.map(([n, d]) => `<img data-n="${n}" data-src="${esc(root + "top/" + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("") + this._hdlSvg(true);
        this._cvtImgs = [...el.cvt.querySelectorAll("img")];
        this._cvBaseGuard(el.cvt, true);
        this._cvtFresh = true;
      }
      this._cvtImgs.forEach((im, i) => this._layerOn(im, this._cvtL[i]));
      if (this._cvtFresh) { this._cvtFresh = false; this._cvGate(el.cvt, this._cvtImgs); }
      if (v.unlocked) this._hdlSync(el.cvt);
    } else {
      const key = color + "|" + wheels + "|" + root;
      this._mir = this._mirrorNow(); el.cva.classList.toggle("flip", this._mir);
      if (this._cvKey !== key || !this._cvImgs || !el.cva.firstChild) {
        this._cvKey = key; this._cvL = this._isoLayers(color, wheels, true);
        const nb = root + "iso/" + color + "/base.webp";
        el.cva.innerHTML = nfxGround("iso", nb) + this._turnBack() + this._cvL.map(([n, d, , , , k]) => `<img data-n="${n}"${k ? ` class="${k}"` : ""} data-src="${esc(root + "iso/" + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("") + this._plateFix(nb) + nfxLight("iso", nb) + this._hdlSvg(false) + this._turnSvg(root + "iso/common/");
        this._cvImgs = [...el.cva.querySelectorAll("img")];
        this._cvBaseGuard(el.cva);
        this._cvFresh = true;
      }
      this._cvImgs.forEach((im, i) => this._layerOn(im, this._cvL[i]));
      if (this._cvFresh) { this._cvFresh = false; this._cvGate(el.cva, this._cvImgs); }
      if (v.unlocked) this._hdlSync(el.cva);
      this._turnSync(el.cva);
    }
  }
  /* If the layers are missing (e.g. the images folder was not copied) the hero falls back to the photos. Before deciding for good it retries briefly
     (a temporary network error must not close Car View). If only the top-view image is missing, Car View stays in 3/4 and only the button is hidden. */
  _cvBaseGuard(box, top) {
    const base = box.querySelector('img[data-n="base"]');
    if (!base) return;
    this._watchLayerImage(base, () => {
      try { console.warn(`deepal-companion-card: image could not be loaded ${base.dataset.src}`); } catch (_) {}
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
  /* The car is stacked from many layers. After a (re)build it stays hidden until every layer needed right now has arrived, then fades in once,
     so it never shows half painted (a dark ghost). After 6 s it appears anyway, so a slow or failed layer can never hide it for good. */
  _cvGate(box, imgs) {
    const need = imgs.filter((im) => im._on);
    const done = () => need.every((im) => im.complete && im.naturalWidth > 0);
    if (done()) { box.classList.remove("cv-loading"); return; }
    box.classList.add("cv-loading");
    let timer = null;
    const reveal = () => { clearTimeout(timer); box.classList.remove("cv-loading"); need.forEach((im) => im.removeEventListener("load", check)); };
    const check = () => { if (done()) reveal(); };
    need.forEach((im) => im.addEventListener("load", check));
    timer = setTimeout(reveal, 6000);
  }
  /* New image/colour/folder: we retry from the start */
  _cvReset() { this._cvFail = false; this._topFail = false; this._cvKey = this._cvtKey = null; }
  /* The translucent charging view is built only the first time the charger connects */
  _cvbEnsure(root) {
    if (this._cvbRoot === root && this._el.cvb.firstChild) return;
    this._cvbRoot = root;
    const ci = (n) => `<img data-n="${n}" data-src="${esc(root + "carga/" + n + ".webp")}" alt="" decoding="async">`;
    const nb = root + "carga/base.webp";
    this._el.cvb.innerHTML = `${nfxGround("carga", nb)}${ci("base")}${ci("cable_connected")}${ci("cable_charging")}<svg viewBox="0 0 750 500" preserveAspectRatio="none" aria-hidden="true"><path class="cb" d="${CARGA_D}"/><path class="cf" d="${CARGA_D}"/>
        <g class="pt" transform="translate(${CARGA_PORT[0]} ${CARGA_PORT[1]})"><circle class="pg" r="9"/><circle class="pr" r="6"/><circle class="pr r2" r="6"/></g></svg><img class="sweep" alt="" data-src="${esc(root + "carga/base.webp")}">`;
  }
  /* The hero photos load only when needed (not in Car View) */
  _loadPhotos() {
    for (const im of this._el.imgs) if (!im.getAttribute("src")) im.setAttribute("src", im.dataset.src);
  }

  /* 3/4 view: layers in the order of the dec_deepal repo (behind the car → car → in front) */
  _isoRender(v) {
    /* Tyres page: the top-view car (the same images as the hero's top view) with one value box beside each wheel */
    const el = this._el, c = this._c, color = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black";
    const key = "top|" + color, root = this._layerBase();
    if (this._isoKey !== key) {
      this._isoKey = key;
      this._isoL = this._topLayers(color);
      const lines = TIRES.map((t) => `<line data-pin="${t.id}" x1="${t.bx * 7.5}" y1="${t.by * 7.5}" x2="${t.tx * 7.5}" y2="${t.ty * 7.5}"/><circle data-pin="${t.id}" class="halo" cx="${t.tx * 7.5}" cy="${t.ty * 7.5}" r="13"/><circle data-pin="${t.id}" cx="${t.tx * 7.5}" cy="${t.ty * 7.5}" r="6"/>`).join("");
      const pills = TIRES.map((t) => `<div class="tp na" data-t="${t.id}" style="left:${t.bx}%;top:${t.by}%"><div class="n">${esc(T(t.name))}</div><div class="v">--</div><div class="s"></div></div>`).join("");
      el.viso.innerHTML = `<div class="isop"><div class="isoi sq">${this._isoL.map(([n, d]) => `<img data-n="${n}" data-src="${esc(root + "top/" + d + "/" + n + ".webp")}" alt="" decoding="async">`).join("")}<svg class="tl" viewBox="0 0 750 750" aria-hidden="true">${lines}</svg>${pills}</div></div>`;
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
    this._pkKey = null; this._pkIdx = -1; this._isoKey = null; this._cvKey = null; this._cvImgs = null; this._cvtKey = null; this._cvtImgs = null; this._cvbRoot = null; // the hero DOM is rebuilt: the Car View layers must be loaded again
    const lazyPhotos = c.hero_style === "carview"; /* in Car View the hero photos are not loaded */
    const imgs = Object.keys(HERO_FILES).map((k) => `<img data-k="${k}" data-i="0" data-src="${esc(this._heroSrc(k, 0))}"${lazyPhotos ? "" : ` src="${esc(this._heroSrc(k, 0))}"`} alt="" decoding="async">`).join("");
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <ha-card data-pad="${esc(c.card_padding || "normal")}" data-ppad="${esc(c.popup_padding || "normal")}">
        <div class="hero" id="hero">
          <div class="shade-left"></div><div class="shade-top"></div><div class="shade-bot"></div>
          <div class="hero-top"><div><div class="title" id="ttl"><span id="nm">${esc(c.name || "Deepal S05")}</span><span class="plate" id="plate"></span></div><div class="total" id="total" role="button" tabindex="0"></div></div>
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
        <button class="foot" id="foot" aria-label="Open Companion settings"><span class="sets">${ico("sliders")}</span></button>
        <div class="sheet" id="vsheet"><div class="box wide" id="vbox" role="dialog" aria-modal="true" aria-labelledby="vtitle">
          <h3 id="vtitle" class="sr">Vehicle</h3>
          <div class="vtop"><div class="seg" id="vtabs"><button data-vv="iso">${ico("carside")}<span class="tx">Car View</span></button><button data-vv="climate">${ico("fan")}<span class="tx">Climate</span></button><button data-vv="seats">${ico("seat")}<span class="tx">Seats</span></button></div><button class="x" data-vclose aria-label="Close">${ico("close")}</button></div>
          <div class="veh" id="veh"><div class="vstack">
            <div class="vgrp" id="vgi"><div class="vcol" id="viso"></div>
            <div class="vmiss" id="vmiss" hidden>${T("Vehicle images not found. Copy the {0} folder next to the card file (Settings → Images).", "<b>images</b>")}</div>
            <div id="vextra"></div></div>
            <div class="vgrp" id="vgc"><div class="vcol" id="vclim">${this._climHtml()}</div></div>
            <div class="vgrp" id="vgs"><div class="vcol" id="vseats">${this._seatsHtml()}</div></div>
          </div></div>
        </div></div>
        <div class="sheet" id="sheet"><div class="box" id="box" role="dialog" aria-modal="true"></div></div>
      </ha-card>`;
    const sr = this.shadowRoot, g = (i) => sr.getElementById(i);
    this._dashKeys = {};
    sr.getElementById("toast").addEventListener("click", () => { clearTimeout(this._toastTimer); this._toastState = null; this._force(); });
    this._skyP = undefined;
    this._el = { card: sr.querySelector("ha-card"), hero: g("hero"), sky: g("sky"), cv: g("cv"), cvi: g("cvi"), cvt: g("cvt"), vtg: g("vtg"), cva: g("cva"), cvb: g("cvb"), sweep: sr.querySelector(".sweep"), imgs: [...sr.querySelectorAll(".stage img")], plate: g("plate"),
      toast: g("toast"), nm: g("nm"), status: g("status"), tells: g("tells"), rfs: g("rfs"), nfbell: g("nfbell"), dgb: g("dgb"), total: g("total"), stats: g("stats"), veh: g("veh"), vtabs: g("vtabs"), vgi: g("vgi"), vgc: g("vgc"), vgs: g("vgs"), viso: g("viso"), vclim: g("vclim"), dov: g("dov"), vseats: g("vseats"), pk: g("pk"), pkp: g("pkp"), pkv: g("pkv"), pkr: g("pkr"), pktk: g("pktk"), vmiss: g("vmiss"), vextra: g("vextra"),
      vsheet: g("vsheet"), vtctl: g("vtctl"), dash: g("dash"), info: g("info"), diag: g("diag"), charge: g("charge"), chgbox: g("chgbox"), chgline: g("chgline"), actions: g("actions"), foot: g("foot"), sheet: g("sheet"), box: g("box") };
    /* These parts are redrawn on every render. Writing the same markup again only restarts animations and forces layout, so an identical write is skipped. */
    { const d = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
      for (const n of [this._el.actions, this._el.info, this._el.status, this._el.total, this._el.vtg]) if (n) Object.defineProperty(n, "innerHTML", { configurable: true, get() { return d.get.call(this); }, set(v) { if (this._h === v) return; this._h = v; d.set.call(this, v); } }); }
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
    this._el.vbox.addEventListener("click", (e) => { if (e.target.closest("[data-vclose]")) { this._view = null; this._force(); } else if (e.target.closest("[data-precondition]")) { e.stopPropagation(); this._pcSheet = true; this._force(); } else { const q = e.target.closest("[data-pq-t],[data-pq-d],[data-pq-go],[data-pq-back]"); if (q) { if (q.dataset.pqT) this._pqT = Number(q.dataset.pqT); else if (q.dataset.pqD) this._pqD = Number(q.dataset.pqD); else if (q.hasAttribute("data-pq-back")) { if (this._pqD) this._pqD = null; else this._pqT = null; } else return this._pqGo(); this._pqSync(this._el.vclim); } } });
    this._swipe(this._el.vbox, this._el.vsheet); this._swipe(this._el.box, this._el.sheet);
    this._noChain(this._el.vsheet); this._noChain(this._el.sheet);
    this._pkInit(); this._bindPress();
    this._el.rfs.addEventListener("click", () => this._onAction("refresh"));
    this._el.vtg.addEventListener("click", (e) => { e.stopPropagation(); this._toggleView(); });
    this._el.stats.addEventListener("click", (e) => {
      const tp = e.target.closest("[data-tp]"); if (tp) { if (!tp.disabled) this._tempStep(Number(tp.dataset.tp)); return; }
      const b = e.target.closest("[data-id]"); if (b) return this._onAction(b.dataset.id);
    });
    this._el.actions.addEventListener("scroll", (e) => { /* swipe layout: follow the visible page */
      const p = e.target.closest?.("[data-pages]"); if (!p || !p.clientWidth) return;
      const i = Math.round(p.scrollLeft / p.clientWidth); this._swipePage = i;
      this._el.actions.querySelectorAll("[data-page]").forEach((d) => d.classList.toggle("on", Number(d.dataset.page) === i));
    }, true);
    this._el.actions.addEventListener("click", (e) => {
      if (e.target.closest("[data-himore]")) { this._imgOpen = !this._imgOpen; return this._force(); }
      const dot = e.target.closest("[data-page]");
      if (dot) { const p = this._el.actions.querySelector("[data-pages]"); p?.scrollTo({ left: Number(dot.dataset.page) * p.clientWidth, behavior: "smooth" }); return; }
      if (e.target.closest("[data-more]")) { this._moreOpen = !this._moreOpen; lsWrite(`deepal-companion-more:${this._companion.view_id}`, this._moreOpen ? 1 : null); return this._force(); }
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
    this._el.nfbell.addEventListener("click", () => { this._nfOpenUnread = this._nfUnread || 0; this._nfMarkSeen(); this._nfSheet = true; this._force(); });
    this._el.dgb.addEventListener("click", () => { this._diagSheet = true; this._force(); });
    this._el.tells.addEventListener("click", (e) => { if (e.target.closest("[data-diag-open]")) { this._diagSheet = true; this._force(); } });
    this._el.foot.addEventListener("click", () => { if (this._c.show_customize === false) return; this._openDashboard(); });
    this._el.sheet.addEventListener("click", (e) => {
      if (e.target === this._el.sheet) return this._closeSheet();
      const pl = e.target.closest("[data-plan-sw],[data-plan-save]"); if (pl) return this._planAct(pl);
      const lk = e.target.closest("[data-lk]");
      if (lk) return this._lockPick(lk.dataset.lk);
      const dg = e.target.closest("[data-dg-set],[data-dg-add],[data-dg-ignore],[data-dg-ok]");
      if (dg) return this._diagAct(dg.dataset);
      if (e.target.closest("[data-pcmore]")) return this._openPreconditionSettings();
      { const gi = e.target.closest("[data-rginfo]"), gt = e.target.closest("[data-rgtemp]"), sp = this._stEl;
        if (gi && sp) { this._rgInfo = !this._rgInfo; gi.setAttribute("aria-pressed", String(this._rgInfo)); const b = sp.querySelector(".rginfo"); if (b) b.hidden = !this._rgInfo && !b.dataset.keep; return; }
        if (gt && sp) { this._rgTemp = !this._rgTemp; gt.setAttribute("aria-expanded", String(this._rgTemp)); const b = sp.querySelector(".rgtemp"); if (b) b.hidden = !this._rgTemp; gt.querySelector(".i")?.replaceWith(Object.assign(document.createElement("span"), { innerHTML: ico(this._rgTemp ? "chevu" : "chevd") }).firstElementChild); return; } }
      if (e.target.closest("[data-stmore]")) { const id = this._stSheet; this._closeSheet(); return this._act({ action: "more-info" }, id); }
      { const rb = e.target.closest("[data-strange]"); if (rb && this._stEl) { this._stRange = rb.dataset.strange; this._stEl.innerHTML = loaderHtml("gauge"); return this._statLoad(this._stEl, this._stSheet); } }
      if (e.target.closest?.(".stsvg")) return this._statPick(e);
      const t = e.target.closest("[data-sheet],[data-close]");
      if (!t) return;
      if (t.dataset.sheet === "yes") {
        const cf = this._confirm, a = this._actions().find((x) => x.id === cf?.id);
        this._closeSheet(); if (cf && cf.limit) return this._clResume(); if (cf && cf.temp !== undefined) return this._applyTemp(cf.temp);
        if(cf?.customAction)return this._act(cf.customAction,cf.entity);
        if (a) this._run(a); return;
      }
      this._closeSheet();
    });
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

  /* Theme colour: sets the accent token on the card. Status colours (OK, warning, error), battery levels and the info-tile icons are separate tokens and never follow it. */
  _applyAccent(c) {
    const id = c ? c.accent_color : lsRead("dc_accent"), ac = ACCENTS.find((a) => a[0] === id) || ACCENTS[0];
    const dark = this._hass?.themes?.darkMode !== false, card = this._el && this._el.card, key = ac[0] + (dark ? "d" : "l");
    if (this._acKey === key && this._acCard === card) return;
    this._acKey = key; this._acCard = card;
    for (const n of [this, card]) if (n) { n.style.setProperty("--ds-ac", dark ? ac[2] : ac[3]); n.style.setProperty("--ds-ac-sp", (dark ? ac[2] : ac[3]).replaceAll(",", " ")); n.style.setProperty("--cost-ac", (dark ? ac[2] : ac[3]).replaceAll(",", " ")); n.style.setProperty("--ds-ac-ink", dark ? ac[4] : ac[5]); n.style.setProperty("--ds-ac-rot", ac[6] + "deg"); n.style.setProperty("--ds-ac-sat", String(ac[7] ?? 1)); }
    if (c) lsWrite("dc_accent", ac[0]);
  }
  _render() {
    if (!this._hass || !this._c) return;
    this._syncLang();
    if (!I18N.ready) return;
    if (!this._built) this._build();
    this._applyAccent(this._c);
    this._resolvePending();
    const sig = this._signature();
    if (sig === this._sig) return;
    this._sig = sig;
    const el = this._el, c = this._c, v = this._vehicle();

    const secs = { hero: el.hero, actions: el.actions, status: el.status, stats: el.stats, info: el.info, diagnostics: el.diag, charge: el.charge, costs: el.costs };
    const hid = new Set(c.hidden);
    c.order.forEach((id, i) => { const s = secs[id]; if (!s) return; s.style.order = i; s.toggleAttribute("data-off", hid.has(id)); });
    el.foot.style.order = 99; this._lockKick();
    el.foot.classList.toggle("nosets", c.show_customize === false);
    { if (el.foot.parentNode !== el.hero) el.hero.appendChild(el.foot);
      el.foot.hidden = c.show_customize === false || !!(this._hass && this._hass.user && this._hass.user.is_admin === false); /* settings need administrator rights */ }

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
    el.total.hidden = !hs.has("range");
    this._scSoon();
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
      const rIcon = f && !pend ? (f.type === "success" ? "check" : "alert") : "refresh", rSig = rIcon + (pend ? "+ring" : ""), badge = this._ageBadge(hs.has("updated"));
      if (el.rfs._sig !== rSig) { el.rfs.innerHTML = ico(rIcon) + (pend ? ringHtml() : "") + badge; el.rfs._sig = rSig; }
      else { /* keep the running ring; only the age badge may change */
        const old = el.rfs.querySelector(".age"), t = document.createElement("template"); t.innerHTML = badge; const n = t.content.firstChild;
        if (!n) old?.remove(); else if (!old) el.rfs.append(n); else if (n.className !== old.className || n.textContent !== old.textContent) { old.className = n.className; old.textContent = n.textContent; }
      }
    }
    this._paintNotificationLink();
    /* buttons */
    const off = this._offline();
    const layPick = ["split", "image", "imageall", "swipe", "grid"].includes(c.button_layout) ? c.button_layout : "split";
    const lay = (layPick === "image" || layPick === "imageall") && c.hidden.includes("hero") ? "split" : layPick; /* the "More" button needs the image */
    const lab = c.button_labels, showT = lab === "title" || lab === "both", showS = lab === "status" || lab === "both";
    const acts = this._actions();
    const cellOf = (id) => {
      const a = acts.find((x) => x.id === id);
      const f = this._flashes[a.id], pend = !!this._pending[a.id], state = pend ? "pending" : f ? f.type : "";
      const icon = f && !pend ? (f.type === "success" ? "check" : "alert") : a.icon;
      const tone = off ? "" : a.tone || "";
      const dot = !state && (tone === "warn" || tone === "bad") ? '<span class="dot"></span>' : !state && a.pulse && !off ? '<span class="dot pulse" aria-hidden="true"></span>' : "";
      const ring = pend ? '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><rect x="2.5" y="2.5" width="95" height="95" rx="47.5" pathLength="100"/></svg>' : "";
      const label = `${a.label}: ${off ? "" : a.sub || ""}`;
      const pp = this._pending[a.id], age = pp ? Math.round((Date.now() - pp.t) / 1000) : 0;
      const sub = off ? "" : pend ? (pp.sent ? T("Confirming…") : age < 3 ? T("Sending…") : T("Car waking up") + " · " + age + "s") : f ? (f.type === "success" ? "Done" : "Failed") : cap(a.sub || "");
      return `<div class="cell ${tone}"><button class="act ${tone} ${a.on && !off ? "on" : ""} ${state}" data-id="${a.id}" ${a.disabled || off ? "disabled" : ""} title="${esc(label)}" aria-label="${esc(label)}">${ico(icon)}${dot}${ring}</button>${showT ? `<span class="cap t">${esc(a.label)}</span>` : ""}${showS && sub ? `<span class="cap s${pend ? " wait" : ""}">${esc(sub)}</span>` : ""}</div>`;
    };
    clearTimeout(this._pendTick); if (Object.keys(this._pending).length) this._pendTick = setTimeout(() => { if (this.isConnected) this._force(); }, 1000); /* the waiting text counts the seconds */
    const vis = c.buttons.filter((id) => !c.buttons_hidden.includes(id));
    let imgMore = [], imgInRow = false;
    if (this._moreOpen === undefined) this._moreOpen = !!lsRead(`deepal-companion-more:${this._companion.view_id}`);
    if (lay === "split") {
      const np = Math.max(1, Math.min(5, Math.round(Number(c.button_primary)) || 4)), prim = vis.slice(0, np), more = vis.slice(np);
      const keep = c.buttons_more === "show", open = keep || this._moreOpen;
      const alert = !off && more.some((id) => { const t = (acts.find((x) => x.id === id) || {}).tone; return t === "warn" || t === "bad"; });
      el.actions.className = `actions split sz-${c.button_size} ${open ? "moreopen" : ""} ${off ? "offline" : ""}`;
      el.actions.style.setProperty("--np", String(prim.length));
      el.actions.innerHTML = `<div class="prow">${prim.map(cellOf).join("")}</div>` +
        (more.length ? `<div class="mwrap"><div class="mrow" id="mrow" ${open ? "" : "inert"}>${more.map(cellOf).join("")}</div></div>` +
          (keep ? "" : `<button class="morebtn" data-more aria-expanded="${open}" aria-controls="mrow" title="${esc(T("More"))}" aria-label="${esc(T("More"))}"><span>More</span>${ico("chevd")}${alert ? '<span class="mdot"></span>' : ""}</button>`) : "");
    } else if (lay === "swipe") {
      const np = Math.max(1, Math.min(5, Math.round(Number(c.button_primary)) || 4)), pages = [];
      for (let i = 0; i < vis.length; i += np) pages.push(vis.slice(i, i + np));
      const pg = Math.min(this._swipePage || 0, Math.max(0, pages.length - 1));
      el.actions.className = `actions swipe sz-${c.button_size} ${off ? "offline" : ""}`;
      el.actions.style.setProperty("--np", String(np));
      el.actions.innerHTML = `<div class="pages" data-pages>${pages.map((p) => `<div class="page">${p.map(cellOf).join("")}</div>`).join("")}</div>` +
        (pages.length > 1 ? `<div class="pdots">${pages.map((_, i) => `<button data-page="${i}" class="${i === pg ? "on" : ""}" aria-label="${i + 1}/${pages.length}"></button>`).join("")}</div>` : "");
      const pw = el.actions.querySelector("[data-pages]"); if (pw && pg) pw.scrollLeft = pg * pw.clientWidth; /* keep the page the user swiped to when the card refreshes */
    } else if (lay === "image") {
      const np = Math.max(1, Math.min(5, Math.round(Number(c.button_primary)) || 4));
      imgMore = vis.slice(np); const prim = vis.slice(0, np);
      imgInRow = imgMore.length > 0 && prim.length < 5; /* a free slot in the row: "More" goes there instead of on the image */
      const moreCell = imgInRow ? `<div class="cell"><button class="act hmorebtn ${this._imgOpen ? "on" : ""}" data-himore aria-expanded="${!!this._imgOpen}" title="${esc(T("More"))}" aria-label="${esc(T("More"))}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg><span class="hcnt">${imgMore.length}</span></button>${showT || showS ? `<span class="cap s">${esc(T("More"))}</span>` : ""}</div>` : "";
      el.actions.className = `actions split sz-${c.button_size} ${off ? "offline" : ""}`;
      el.actions.style.setProperty("--np", String(prim.length + (imgInRow ? 1 : 0)));
      el.actions.innerHTML = `<div class="prow">${prim.map(cellOf).join("")}${moreCell}</div>`;
    } else if (lay === "imageall") { /* no button row: every button lives in the panel */
      imgMore = vis.slice();
      el.actions.className = `actions noacts sz-${c.button_size}`;
      el.actions.style.removeProperty("--np");
      el.actions.innerHTML = "";
    } else {
      el.actions.className = `actions ${lay} sz-${c.button_size} ${off ? "offline" : ""}`;
      el.actions.style.removeProperty("--np");
      el.actions.innerHTML = vis.map(cellOf).join("");
    }
    { /* "More" on the image: a small button next to the Settings gear opens a panel just under the image */
      let hm = el.hero.querySelector(":scope>.himore"), hp = el.card.querySelector(":scope>.hpanel");
      if (imgInRow) { hm?.remove(); hm = null; }
      if (imgMore.length) {
        if (!hm && !imgInRow) {
          hm = document.createElement("button"); hm.className = "himore"; hm.dataset.himore = "";
          hm.addEventListener("click", (e) => { e.stopPropagation(); this._imgOpen = !this._imgOpen; this._force(); });
          el.hero.append(hm);
        }
        if (!hp) {
          hp = document.createElement("div"); hp.className = "hpanel"; hp.setAttribute("role", "group");
          hp.addEventListener("click", (e) => {
            e.stopPropagation();
            if (e.target.closest("[data-hpclose]")) { this._imgOpen = false; return this._force(); }
            const b = e.target.closest("[data-id]"); if (!b) return;
            this._onAction(b.dataset.id);
            if (this._popupBox()) { this._imgOpen = false; this._force(); } /* the button opened a popup: close the panel behind it */
          });
          el.hero.after(hp);
        }
        if (!el.card._hpOutside) { /* a tap outside the open panel only closes it, so it never presses something underneath */
          el.card._hpOutside = true;
          el.card.addEventListener("pointerdown", (e) => {
            if (!this._imgOpen || this._popupBox()) return; /* taps inside an open popup are never swallowed */ const path = e.composedPath(), p = el.card.querySelector(":scope>.hpanel"), m = el.hero.querySelector(":scope>.himore");
            if ((p && path.includes(p)) || (m && path.includes(m)) || path.some((n) => n.dataset && n.dataset.himore !== undefined)) return;
            this._imgSwallow = true; clearTimeout(this._imgSwallowT); this._imgSwallowT = setTimeout(() => { this._imgSwallow = false; }, 700); this._imgOpen = false; this._force();
          }, true);
          el.card.addEventListener("click", (e) => { if (!this._imgSwallow) return; this._imgSwallow = false; e.stopPropagation(); e.preventDefault(); }, true);
        }
        const open = !!this._imgOpen, alert = !off && imgMore.some((id) => { const t = (acts.find((x) => x.id === id) || {}).tone; return t === "warn" || t === "bad"; });
        if (hm) { hm.classList.toggle("solo", !!el.foot.hidden); hm.classList.toggle("on", open);
        hm.setAttribute("aria-expanded", String(open)); hm.setAttribute("aria-label", T("More")); hm.title = T("More");
        hm.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg><b>${imgMore.length}</b>${alert ? '<span class="mdot"></span>' : ""}`; }
        hp.classList.toggle("show", open); hp.toggleAttribute("inert", !open);
        hp.className = `hpanel sz-${c.button_size}${open ? " show" : ""}${off ? " offline" : ""}`;
        hp.innerHTML = `<div class="hph"><b>${esc(T("More"))}</b><button data-hpclose aria-label="${esc(T("Close"))}">${ico("close")}</button></div><div class="hprow" style="--np:${Math.min(5, Math.max(imgMore.length, Number(el.actions.style.getPropertyValue("--np")) || 5))}">${imgMore.map(cellOf).join("")}</div>`;
        if (hp.previousElementSibling !== el.hero) el.hero.after(hp);
        hp.style.order = getComputedStyle(el.hero).order; /* stays right under the image in every design */
      } else { hm?.remove(); hp?.remove(); this._imgOpen = false; }
    }

    /* status (over the image) */
    const st = this._status(v);
    let connectionBanner=el.hero.querySelector('.connection-banner');
    const missingVehicle=this._s('binary_sensor.cloud_connection')===null&&this._s('lock.doors')===null;
    if(this._offline()||missingVehicle){
      if(!connectionBanner){connectionBanner=document.createElement('div');connectionBanner.className='connection-banner';connectionBanner.setAttribute('role','status');connectionBanner.style.cssText='position:absolute;left:12px;right:12px;top:72px;z-index:12;padding:10px 12px;border:1px solid #ef7777;border-radius:10px;background:rgba(112,20,26,.95);color:#fff;font-size:12px;line-height:1.5;pointer-events:none';el.hero.append(connectionBanner);}
      connectionBanner.textContent=T('Check the Deepal Alternative API connection and the entity prefix in Card Settings → Vehicle → Vehicle setup.');
    }else connectionBanner?.remove();

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
    el.card.dataset.pad = c.card_padding || "normal"; el.card.dataset.pfx = ["arc", "pulse", "neon"].includes(c.pending_fx) ? c.pending_fx : "arc"; el.card.dataset.ppad = c.popup_padding || "normal";
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
    { const t = new Date(this._s("sensor.last_updated")).getTime(); /* one shared set of values for the Minimal / Cockpit layouts (companion-design.js) */
      this._dv = { bat, range, fuel, fu, total, evRgb, fuRgb, fuelPct: fuelPct === null ? null : cl(fuelPct), charging: !!v.charging, left: leftTxt, st, off: this._offline(), cloudOn: this._is("binary_sensor.cloud_connection", "on"), age: this._age(), ageMin: Number.isFinite(t) ? Math.round((Date.now() - t) / 60000) : null }; }
    const chgSub = "";
    /* Circle: the percentage corresponds to the VISIBLE arc (from the bottom edge of the tile to the right edge), not the whole circle */
    const GD = 40, GS = 1.5, arc = (r) => { const rp = r * GS, a = (x) => (x * 180) / Math.PI; return [180 - a(Math.asin(Math.min(1, GD / rp))) - 4, 360 - a(Math.acos(Math.min(1, GD / rp))) + 4]; };
    const [o0, o1] = arc(44), [i0, i1] = arc(33), at = (a0, a1, p) => a0 + ((a1 - a0) * cl(p)) / 100, f1 = (x) => x.toFixed(1);
    const oEnd = at(o0, o1, bat);
    const tgState = UI.chargeTarget(bat, v.charging, this._s("sensor.remaining_charge_time_h_mm"), c.charge_target), tgMark = tgState ? (() => { const a = at(o0, o1, tgState.goal) * Math.PI / 180; return `<line class="tg" x1="${f1(50 + 48.5 * Math.cos(a))}" y1="${f1(50 + 48.5 * Math.sin(a))}" x2="${f1(50 + 53 * Math.cos(a))}" y2="${f1(50 + 53 * Math.sin(a))}"/>`; })() : "";
    const flow = v.charging && bat !== null && bat < 99.5 ? `<circle class="fg" cx="50" cy="50" r="44" stroke-width="8.5" pathLength="360" stroke-dasharray="${f1(o1 - oEnd)} 360" stroke-dashoffset="-${f1(oEnd)}"/><circle class="fp" cx="50" cy="50" r="44" stroke-width="8.5" pathLength="360" stroke-dasharray="25 360" style="--fs:-${f1(oEnd)};--fe:-${f1(Math.max(oEnd, o1 - 25))}"/>` : "";
    const hgR = fu ? 88 : 82, hgD = (r) => `M${100 - r} 100A${r} ${r} 0 0 1 ${100 + r} 100`, hgEnd = cl(bat) * 3.6;
    const hgArc = (r, p, cls) => `<path class="tr" d="${hgD(r)}" pathLength="360"/><path class="${cls}" d="${hgD(r)}" pathLength="360" stroke-dasharray="${f1(cl(p) * 3.6)} 360"/>`;
    const hgFlow = v.charging && bat !== null && bat < 99.5 ? `<path class="fg" d="${hgD(hgR)}" pathLength="360" stroke-dasharray="${f1(360 - hgEnd)} 360" stroke-dashoffset="-${f1(hgEnd)}"/><path class="fp" d="${hgD(hgR)}" pathLength="360" stroke-dasharray="25 360" style="--fs:-${f1(hgEnd)};--fe:-${f1(Math.max(hgEnd, 335))}"/>` : "";
    const halfGauge = c.energy_ui === "gauge" ? `<div class="lg"><span style="color:rgb(${evRgb})">${ico("bolt")}<b>${num(range)}</b><small>km</small></span>${fu ? `<span style="color:rgb(${fuRgb})">${ico("fuel")}<b>${num(fuel)}</b><small>km</small></span>` : ""}</div><div class="hg"><svg viewBox="0 0 200 106" aria-hidden="true">${hgArc(hgR, bat === null ? 0 : bat, "ev")}${hgFlow}${fu ? hgArc(66, fuelPct === null ? 0 : fuelPct, "fu") : ""}</svg><div class="c"><span>${bat === null ? "--" : Math.round(bat)}<small>%</small></span>${fu ? `<span class="gf" style="color:rgb(${fuRgb})">${ico("fuel")}${fuelPct === null ? "--" : Math.round(cl(fuelPct))}<small>%</small></span>` : ""}</div></div><div class="lg hv"><span style="color:rgb(${evRgb})">${ico("bolt")}<b>${num(range)}</b><small>km</small></span>${fu ? `<span style="color:rgb(${fuRgb})">${ico("fuel")}<b>${num(fuel)}</b><small>km</small></span>` : ""}</div>` : "";
    /* the Energy tile rolls through its lines while charging: Charging now · time left · charging target (when set) */
    const rollTarget = tgState ? (tgState.reached ? T("Target reached") : tgState.goal >= 100 ? (tgState.eta ? T("Full at {0}", UI.clock(tgState.eta)) : T("Target") + " 100%") : (tgState.eta ? T("{0}% at ~{1}", tgState.goal, UI.clock(tgState.eta)) : T("Target") + " " + tgState.goal + "%")) : null;
    const rollLines = [T("Charging now")].concat(c.chg_roll !== false && leftTxt ? [T("{0} left", leftTxt)] : [], c.chg_roll !== false && rollTarget ? [rollTarget] : []);
    const rollMarkup = (lines) => lines.length < 2 ? `<b>${esc(lines[0])}</b>` : lines.length === 2 ? `<span class="cw" style="--d:0s"><b class="cf cf1">${esc(lines[0])}</b><b class="cf cf2">${esc(lines[1])}</b></span>` : `<span class="cw3"><span class="rl3">${[...lines, lines[0]].map((x) => `<b>${esc(x)}</b>`).join("")}</span></span>`;
    const chgRoll = v.charging ? rollMarkup(rollLines) : "";
    const statsMarkup = `
      ${c.climate_ui === "circle" ? `<div class="t2 tempc" data-open="climate" data-ent="${esc(this._id("climate.cabin_climate"))}" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.inside_temperature") }))}" role="button" tabindex="0" aria-label="Climate">
        <div class="tt">Temperature</div>
        <div class="ts">Inside<br><b>${temp === null ? "--" : this._fmtNum(temp, 0) + "°C"}</b>${tgt === null || !climOn ? "" : `<br><span class="sub">target ${this._fmtNum(tgt, 1)}°</span>`}</div>
        ${this._seatInd()}
        <button class="knob ${climOn ? "on" : ""} ${pendC ? "pending" : ""}" data-id="climate" ${climOk && !off ? "" : "disabled"} aria-label="Climate on/off">${ico("power")}${pendC ? ringHtml() : ""}</button></div>` : `<div class="t2 temp ${climOn ? "on" : ""}" data-open="climate" data-ent="${esc(this._id("climate.cabin_climate"))}" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.inside_temperature") }))}" role="button" tabindex="0" aria-label="Climate">
        <div class="tt">Climate</div>
        <button class="tpw ${climOn ? "on" : ""} ${pendC ? "pending" : ""}" data-id="climate" ${climOk && !off ? "" : "disabled"} aria-label="Climate on/off">${ico("power")}${pendC ? ringHtml() : ""}</button>
        <div class="ct"><span class="cur">${temp === null ? "--" : this._fmtNum(temp, 0) + "°"}</span><span class="lbl">Inside</span></div>
        ${tgt === null ? "" : `<div class="cstep ${climOn ? "" : "idle"}"><button class="cs" data-tp="-1" ${off ? "disabled" : ""} aria-label="Lower temperature">${ico("minus")}</button><div class="cv"><small>target</small><b>${this._fmtNum(tgtShown, 1)}°</b></div><button class="cs" data-tp="1" ${off ? "disabled" : ""} aria-label="Raise temperature">${ico("plus")}</button></div>`}
      </div>`}
      <div class="t2w"><div class="t2 batt"${c.energy_ui === "gauge" ? " data-eui=\"gauge\"" : ""} data-ent="${esc(this._id("sensor.battery_level"))}"${c.energy_sheet !== false ? ` data-energy="1" data-hold="${esc(JSON.stringify({ action: "more-info", entity: this._id("sensor.battery_level") }))}"` : ""} role="button" tabindex="0">
        <div class="tt">${fu ? "Energy" : "Battery"}</div>
        ${v.charging ? `<div class="ts chg">${chgRoll}${chgSub ? `<br><span class="sub">${chgSub}</span>` : ""}</div>` : ""}
        ${c.energy_ui === "gauge" ? halfGauge : `<div class="lg"><span style="color:rgb(${evRgb})">${ico("bolt")}<b>${num(range)}</b><small>km</small></span>${fu ? `<span style="color:rgb(${fuRgb})">${ico("fuel")}<b>${num(fuel)}</b><small>km</small></span>` : ""}</div>
        <div class="gauge"><svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="tr" cx="50" cy="50" r="44" stroke-width="8.5" pathLength="360" stroke-dasharray="${f1(o1 - o0)} 360" stroke-dashoffset="-${f1(o0)}"/><circle class="ev" cx="50" cy="50" r="44" stroke-width="8.5" pathLength="360" stroke-dasharray="${f1(oEnd - o0)} 360" stroke-dashoffset="-${f1(o0)}"/>${flow}${tgMark}
          ${fu ? `<circle class="tr" cx="50" cy="50" r="33" stroke-width="8.5" pathLength="360" stroke-dasharray="${f1(i1 - i0)} 360" stroke-dashoffset="-${f1(i0)}"/><circle class="fu" cx="50" cy="50" r="33" stroke-width="8.5" pathLength="360" stroke-dasharray="${f1(at(i0, i1, fuelPct) - i0)} 360" stroke-dashoffset="-${f1(i0)}"/>` : ""}</svg>
          <div class="c"><span>${bat === null ? "--" : Math.round(bat)}<small>%</small></span>${fu ? `<span class="gf" style="color:rgb(${fuRgb})">${ico("fuel")}${fuelPct === null ? "--" : Math.round(cl(fuelPct))}<small>%</small></span>` : ""}</div></div>`}</div>${this._planBtn()}</div>`;

    if(el.stats._markup !== statsMarkup){
      // Keep a running charging effect when text or percentages change.
      /* Reading animations makes the browser recalculate every style, so it only happens while an effect is running (charging). */
      const phases=new Map(),running=v.charging||el.stats._fx;
      if(running)for(const animation of el.stats.getAnimations({subtree:true})){
        if(animation.animationName){const times=phases.get(animation.animationName)||[];times.push(animation.currentTime);phases.set(animation.animationName,times);}
      }
      el.stats.innerHTML=statsMarkup;el.stats._markup=statsMarkup;el.stats._fx=!!v.charging;
      if(running)for(const animation of el.stats.getAnimations({subtree:true})){
        const times=phases.get(animation.animationName);if(times?.length){const time=times.shift();if(time!==null)animation.currentTime=time;}
      }
    }
    this._renderVehicle(v);
    this._watchChanges(v);

    /* information */
    const tiles = [];
    for (const id of c.info_order.filter(id=>(c.info||[]).includes(id))) {
      const it = INFO_ITEMS[id]; if (!it) continue;
      if (id === "charger_limit") { const ct = this._clTile(v); if (ct) tiles.push(ct); continue; }
      if ((id === "fuel_level" || id === "fuel_volume") && !hasFuel(this._hass, c)) continue;
      if (id === "charge_plan") {
        if (!this._planHas()) continue;
        const on = this._planOn(), a = this._planTime("charge_schedule_start"), b = this._planTime("charge_schedule_end");
        tiles.push(`<div class="tile" data-plan role="button" tabindex="0">${ico("plan")}<div><div class="v">${esc(this._planVal(on, a, b, this._planFull()))}</div><div class="l">${esc(T("Charge plan"))}</div></div>${on ? '<i class="cpd"></i>' : ""}</div>`);
        continue;
      }
      const { v: n, stale } = it[3] === null ? { v: null } : this._nl(it[0]);
      const s = this._s(it[0]);
      if (s === null && n === null) continue;
      const val = it[3] === null ? (s === null ? "--" : stateText(s)) : n === null ? "--" : `${this._fmtNum(n, it[3])} ${this._unit(it[0])}`.trim();
      tiles.push(`<div class="tile" data-ent="${esc(this._id(it[0]))}" role="button" tabindex="0">${ico(it[2])}<div><div class="v">${esc(val)}</div><div class="l">${esc(T(it[1]))}</div></div></div>`);
    }
    for (const x of c.info_custom || []) {
      const o = this._eobj(x.entity), n = o ? parseFloat(o.state) : NaN;
      const val = !o || BAD.includes(o.state) ? "--" : Number.isFinite(n) ? `${this._fmtNum(n, 1)} ${o.attributes?.unit_of_measurement || x.unit || ""}`.trim() : stateText(o.state);
      tiles.push(`<div class="tile" data-ent="${esc(x.entity)}" role="button" tabindex="0"${x.tap_action ? ` data-tap="${esc(JSON.stringify(x.tap_action))}"` : ""}${x.hold_action ? ` data-hold="${esc(JSON.stringify(x.hold_action))}"` : ""}>${ico(x.icon || "info")}<div><div class="v">${esc(val)}</div><div class="l">${esc(x.label || o?.attributes?.friendly_name || x.entity)}</div></div></div>`);
    }
    /* diagnostics: indicator icons over the image, only when there is something to see */
    const hidSec = new Set(c.hidden), items = this._diagItems(), all = false; /* only warnings are drawn; the full list is in the Diagnostics sheet (top button) */
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
    this._scSoon();
    /* the block of indicators at the bottom of the card is gone: warnings show as a number on the Diagnostics button and the full list opens from it */
    el.diag.innerHTML = ""; el.diag.toggleAttribute("data-empty-diag", true);

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
      const tgChg = UI.chargeTarget(v.battery, v.charging, left, this._clDemo() && !Number(c.charge_target) ? 80 : c.charge_target);
      const stat = (value, label) => `<div class="cg-stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
      const tgText = tgChg ? (tgChg.reached ? T("Reached") : `${tgChg.goal}%` + (tgChg.eta ? ` · ≈${UI.clock(tgChg.eta)}` : "")) : "";
      /* header: what the car is doing and the cost of this charge (filled by the live cost module); below: the figures */
      el.charge.innerHTML = `<div class="cg-head"><span class="cg-state">${ico("bolt")}<b>${esc(T(v.charging?"Charging now":"Charger connected"))}</b>${typ ? `<i>${esc(typ)}</i>` : ""}</span><span class="cg-cost" data-cg-cost></span></div><div class="cg-stats">${stat(cur||"—", T("Current"))}${stat(rem||"—", T("Remaining"))}${tgChg ? stat(tgText, T("Target")) : ""}</div>${this._clRow(tgChg)}`;
      el.chgbox.hidden = el.chgline.hidden = !known.length; /* if there is no item we show nothing (not "--") */
      if (cst === "line") el.chgbox.innerHTML = ico("bolt") + known.map((x) => `<span>${esc(x)}</span>`).join("<i>·</i>");
      else if (cst === "big") { const m = cur && /^(.*?)\s*([A-Za-z]+)$/.exec(cur); el.chgbox.innerHTML = (cur ? `<span class="a">${esc(m ? m[1] : cur)}${m ? `<small>${esc(m[2])}</small>` : ""}</span>` : "") + `<span class="b">${esc([typ, rem].filter(Boolean).join(" · "))}${rem ? ` <em>Remaining</em>` : ""}</span>`; }
      else el.chgbox.innerHTML = (cur ? `<span class="a">${esc(cur)}</span>` : "") + (rem ? `<span class="b">${esc(rem)} <em>Remaining</em></span>` : "") + (typ ? `<span class="c">${esc(typ)}</span>` : "");
    }

    /* sheets */
    if (this._confirm) {
      el.box.className = "box confirm lk";
      const custom=this._confirm.customAction,target=custom?.entity||custom?.target?.entity_id||this._confirm.entity,entity=target&&this._eobj(target);
      el.box.innerHTML = this._askHtml(this._confirm.key,custom?{text:entity?.attributes?.friendly_name||target,sub:T(CUSTOM_TAPS.find(([code])=>code===customTapCode(custom))?.[1]||"Confirm")+" · "+(entity?stateText(entity.state):T("Unavailable")),rgb:"var(--ds-warn)"}:this._confirm.limit?{text:T("Stopped at {0}%",(this._clInfo&&this._clInfo.target)||80),sub:T("The limit is holding the charger."),rgb:"var(--ds-warn)"}:{});
      el.sheet.classList.add("show");
    } else if (this._diagSheet) {
      el.box.className = "box wide dg";
      el.box.innerHTML = this._diagHtml();
      el.sheet.classList.add("show");
    } else if (this._lockSheet) {
      el.box.className = "box confirm lk";
      el.box.innerHTML = this._lockHtml();
      el.sheet.classList.add("show");
    } else if (this._planSheet) {
      el.box.className = "box confirm lk";
      if (!this._planEl || !el.box.contains(this._planEl)) {
        el.box.innerHTML = sheetHd("plan", T("Charge plan"), "");
        const d = document.createElement("div"); d.className = "cpp"; el.box.appendChild(d); this._planEl = d; this._planPaint();
      }
      el.sheet.classList.add("show");
    } else if (this._enSheet) {
      /* Energy sheet: the code is in energy/energy.js and loads only when it opens */
      if (!this._enEl || !el.box.contains(this._enEl)) {
        el.box.className = "box wide nfp";
        el.box.innerHTML = sheetHd("bolt", "Energy");
        const d = document.createElement("div"); d.className = "enpanel"; d.innerHTML = loaderHtml("bolt");
        el.box.appendChild(d); this._enEl = d;
        loadEnergy().then((ok) => { if (this._enEl !== d) return; if (ok && window.__DEEPAL_COMPANION_ENERGY.panel) window.__DEEPAL_COMPANION_ENERGY.panel(d, this); else d.innerHTML = `<p class="hint">${esc(T("The energy file didn’t load. Check that the energy folder is next to the card file."))}</p>`; });
      }
      el.sheet.classList.add("show");
    } else if (this._nfSheet) {
      /* Notifications popup: the same activity list as the Companion dashboard, loaded only when it opens */
      if (!this._nfEl || !el.box.contains(this._nfEl)) {
        el.box.className = "box wide nfp nfl";
        el.box.innerHTML = sheetHd("chat", "Notifications");
        const d = document.createElement("div"); d.className = "nfpanel"; d.innerHTML = loaderHtml("sliders");
        el.box.appendChild(d); this._nfEl = d; this._loadNotifications(d);
      }
      el.sheet.classList.add("show");
    } else if (this._pcSheet) {
      /* Preconditioning: the same module as Companion dashboard → Preconditioning, loaded only when it opens */
      if (!this._pcEl || !el.box.contains(this._pcEl)) {
        el.box.className = "box wide nfp nfl";
        el.box.innerHTML = sheetHd("precond", "Preconditioning");
        if ((this._rawHass || this._hass)?.user?.is_admin) el.box.querySelector(".hd [data-close]")?.insertAdjacentHTML("beforebegin", `<button class="x" data-pcmore aria-label="${esc(T("Open preconditioning settings"))}" title="${esc(T("Open preconditioning settings"))}">${ico("sliders")}</button>`);
        const d = document.createElement("div"); d.className = "nfpanel"; d.innerHTML = loaderHtml("snow");
        el.box.appendChild(d); this._pcEl = d; this._loadPrecondition(d);
      }
      el.sheet.classList.add("show");
    } else if (this._stSheet) {
      /* sensor statistics: same popup style as the other sheets; data from the Home Assistant long-term statistics */
      if (!this._stEl || !el.box.contains(this._stEl) || this._stEl.dataset.id !== this._stSheet) {
        const id = this._stSheet, o = this._eobj(id), info = Object.values(INFO_ITEMS).find((x) => this._id(x[0]) === id), rg = id === "__range";
        el.box.className = "box wide nfp stp-sheet";
        el.box.innerHTML = sheetHd(rg ? "gauge" : info ? info[2] : "info", rg ? T("Range") : info ? T(info[1]) : (o?.attributes?.friendly_name || id));
        if (!rg) el.box.querySelector(".hd [data-close]")?.insertAdjacentHTML("beforebegin", `<button class="x" data-stmore aria-label="${esc(T("More details"))}" title="${esc(T("More details"))}">${ico("info")}</button>`);
        else { this._rgInfo = false; this._rgTemp = false; el.box.querySelector(".hd [data-close]")?.insertAdjacentHTML("beforebegin", `<button class="x" data-rginfo aria-pressed="false" aria-label="${esc(T("How it is calculated"))}" title="${esc(T("How it is calculated"))}">${ico("info")}</button>`); }
        const d = document.createElement("div"); d.className = "stpanel"; d.dataset.id = id; d.innerHTML = loaderHtml(info ? info[2] : "gauge");
        el.box.appendChild(d); this._stEl = d; this._stRange = this._stRange || "7"; this._statLoad(d, id);
      } else if (this._stSeen !== this._eobj(this._stSheet)?.state) {
        this._stSeen = this._eobj(this._stSheet)?.state; this._statLoad(this._stEl, this._stSheet); /* a new reading while the window is open: refresh in place, without the loader */
      }
      el.sheet.classList.add("show");
    } else {
      el.sheet.classList.remove("show");
    }
    el.box.setAttribute("aria-label", this._stSheet ? T("Statistics") : this._confirm ? (CONFIRM_TEXT[this._confirm.key] || ["Confirm"])[0] : this._diagSheet ? "Diagnostics" : this._lockSheet ? "Doors" : this._enSheet ? "Energy" : this._nfSheet ? "Notifications" : this._planSheet ? "Charge plan" : "Deepal Companion");
    this._focusSync();
  }

  /* ───── tap / long press on sensors ───── */
  _bindPress() {
    const root = this._el.card; let st = null;
    root.addEventListener("click", (e) => { const b = e.target.closest("[data-cl-resume]"); if (!b) return; e.stopPropagation(); this._noClickUntil = Date.now() + 500; b.disabled = true; Promise.resolve(this._hass.companionRequest("charger_limit_resume")).catch(() => {}).finally(() => { this._clAt = 0; this._clFetch(true); }); });
    root.addEventListener("click", (e) => { if (!e.target.closest("[data-seats]")) return; e.stopPropagation(); this._noClickUntil = Date.now() + 500; this._view = "seats"; this._force(); });
    root.addEventListener("click", (e) => { if (!e.target.closest("[data-plan]")) return; e.stopPropagation(); this._planSheet = true; this._planDraft = null; this._force(); });
    root.addEventListener("click", (e) => { const t = e.target.closest("[data-cl-tile]"); if (!t || t.dataset.clTile !== "stopped") return; e.stopPropagation(); this._clAsk(); });
    root.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest("[data-id],[data-tp],[data-more],[data-himore],.hpanel,[data-page],[data-plan],[data-seats],[data-cl-resume]")) return;
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
      if (e.composedPath().some((n) => n instanceof Element && n.matches("input[type=range]"))) return; /* dragging a slider must reach the slider */
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
  /* every popup is a drawer (apple-design): it springs open, follows the finger 1:1 when dragged by its top, resists
     past the top, and on release projects the flick: it either springs back or closes carrying the finger's speed.
     Any close (×, background, Esc, swipe) runs the same spring, and the drawer can be grabbed again mid-animation. */
  _swipe(box, sheet) {
    const mm = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
    const mobile = () => mm("(max-width: 639px)"), still = () => mm("(prefers-reduced-motion: reduce)");
    const travel = () => (mobile() ? box.getBoundingClientRect().height || 1 : 40); /* desktop: a short rise with a fade */
    const paint = (y) => { const t = travel(); sheet.style.setProperty("--dy", `${y}px`); sheet.style.setProperty("--scrim", String(Math.max(0, Math.min(1, 1 - y / t)))); };
    const sp = UI.spring(paint, () => sheet.isConnected);
    let open = false, closeTimer = 0, st = null, dragged = false;
    const finish = () => { clearTimeout(closeTimer); sheet.classList.remove("closing"); sp.set(0); };
    new MutationObserver(() => {
      const show = sheet.classList.contains("show");
      if (show && !open) {
        open = true; clearTimeout(closeTimer); sheet.classList.remove("closing");
        if (still()) return sp.set(0);
        if (!sp.run) sp.set(travel()); /* from below the screen, or from wherever a closing drawer is right now */
        sp.go(0, { z: 1, r: 0.38 });
      } else if (!show && open) {
        open = false; st = null;
        if (still()) return finish();
        sheet.classList.add("closing"); /* stays drawn while it slides away */
        sp.go(travel(), { z: 1, r: 0.3, done: finish });
        closeTimer = setTimeout(finish, 900); /* a hidden tab pauses animation frames */
      }
    }).observe(sheet, { attributes: true, attributeFilter: ["class"] });
    box.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || !mobile() || !open || e.target.closest("input,select,textarea,a,[role=slider]")) return;
      const r = box.getBoundingClientRect(); if (e.clientY - r.top > 84 && !e.target.closest(".hd,.vtop")) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId, from: sp.x, lock: false, s: [[e.clientY, performance.now()]] };
    });
    box.addEventListener("pointermove", (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.lock) { /* a horizontal drag (tab bar) stays with the content */
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (Math.hypot(dx, dy) < 8) return;
        if (Math.abs(dy) <= Math.abs(dx)) { st = null; return; }
        st.lock = true; dragged = true; sp.stop(); st.from = sp.x; st.y = e.clientY; try { box.setPointerCapture(e.pointerId); } catch (_) {}
      }
      const now = performance.now(); st.s.push([e.clientY, now]); while (st.s.length > 5 || (st.s.length > 1 && now - st.s[0][1] > 100)) st.s.shift();
      const y = st.from + e.clientY - st.y;
      sp.x = y < 0 ? -UI.band(-y, 80) : y; sp.v = 0; paint(sp.x);
    });
    const end = (cancel) => {
      if (!st) return; const s = st; st = null; if (!s.lock) return;
      setTimeout(() => { dragged = false; }, 0); /* only the click that ends this drag is swallowed */
      const a = s.s[0], b = s.s[s.s.length - 1], v = b && a && b[1] > a[1] ? ((b[0] - a[0]) / (b[1] - a[1])) * 1000 : 0;
      if (!cancel && (sp.x + UI.project(v) > travel() * 0.5 || v > 900)) { sp.v = v; return this._closeTop(); } /* the close spring takes over the speed */
      sp.go(0, { z: v > 300 || sp.x < 0 ? 0.8 : 1, r: 0.3, v }); /* a little bounce only after a flick */
    };
    box.addEventListener("pointerup", () => end(false)); box.addEventListener("pointercancel", () => end(true));
    box.addEventListener("click", (e) => { if (dragged) { dragged = false; e.stopPropagation(); e.preventDefault(); } }, true); /* a drag that began on × does not also press it */
    box.addEventListener("pointerdown", () => { dragged = false; }, true);
    box.addEventListener("dragstart", (e) => { if (e.target.closest?.(".hd,.vtop")) e.preventDefault(); }); /* a native text drag would cancel the gesture */
  }
  _statable(id) { const o = id && this._eobj(id); return !!o && /^sensor\./.test(id) && o.state !== "" && Number.isFinite(Number(o.state)) && !!o.attributes?.unit_of_measurement; }
  async _statFetch(id, period, start) {
    const key = id + "|" + period + "|" + Math.floor(start / 3600000), now = Date.now();
    this._stCache ||= new Map();
    const hit = this._stCache.get(key); if (hit && now - hit.t < 300000) return hit.v;
    const h = this._rawHass || this._hass;
    const r = await h.callWS({ type: "recorder/statistics_during_period", start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(), statistic_ids: [id], period, types: ["mean", "min", "max", "state", "change"] });
    let v = (r && r[id]) || [];
    if (!v.length) v = await this._statHist(h, id, period, start, now); /* sensor without a state class: no long-term statistics */
    this._stCache.set(key, { t: now, v }); if (this._stCache.size > 24) this._stCache.delete(this._stCache.keys().next().value); /* bounded */
    return v;
  }
  /* Recent history for sensors that have no long-term statistics: the same rows as the statistics (start, mean, min, max, h:1), at most 30 days and only what the recorder still keeps. */
  async _statHist(h, id, period, start, now) {
    const from = Math.max(start, now - 30 * 864e5), hourly = period === "hour";
    const r = await h.callWS({ type: "history/history_during_period", start_time: new Date(from).toISOString(), end_time: new Date(now).toISOString(), entity_ids: [id], include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true });
    const b = new Map();
    for (const x of (r && r[id]) || []) {
      const t = x && (typeof (x.lu ?? x.lc) === "number" ? (x.lu ?? x.lc) * 1000 : Date.parse(x.last_updated ?? x.last_changed)), n = x && (x.s !== undefined ? x.s : x.state);
      if (!Number.isFinite(t) || n === "" || n === null || n === "unknown" || n === "unavailable" || !Number.isFinite(Number(n))) continue;
      const k = hourly ? Math.floor(t / 36e5) * 36e5 : new Date(t).setHours(0, 0, 0, 0), e = b.get(k) || { start: k, sum: 0, n: 0, min: Infinity, max: -Infinity, h: 1 };
      e.sum += Number(n); e.n++; e.min = Math.min(e.min, Number(n)); e.max = Math.max(e.max, Number(n)); b.set(k, e);
    }
    return [...b.values()].sort((x, y) => x.start - y.start).map((e) => ({ start: e.start, mean: e.sum / e.n, min: e.min, max: e.max, h: 1 }));
  }
  async _statLoad(d, id) {
    if (id === "__range") return this._rangeLoad(d);
    const o = this._eobj(id), a = o?.attributes || {}, unit = a.unit_of_measurement || "", kind = a.device_class === "distance" || (a.state_class === "total_increasing" && /km|mi/.test(unit)) ? "dist" : /fuel/.test(id) ? "fuel" : "gen";
    const range = this._stRange, f = haFmt(this._rawHass || this._hass), day = 86400000, now = Date.now();
    const dec = Number.isInteger(Number(o?.state)) ? 0 : 1, nf = (n, x = dec) => n == null || !Number.isFinite(n) ? "—" : this._fmtNum(n, x);
    const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
    try {
      const period = range === "365" ? "month" : range === "7" && kind !== "dist" ? "hour" : "day";
      const start = range === "365" ? now - 365 * day : Math.min(now - Number(range) * day, kind !== "gen" ? ms.getTime() : Infinity);
      /* Home Assistant adds the current hour to its statistics only after it ends, so for a distance the km since the last statistics row are added from the live odometer. */
      const cur = Number(o?.state), t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const live = (list, from) => {
        const L = list[list.length - 1];
        if (kind !== "dist" || !L || L.state == null || !Number.isFinite(cur) || !(cur > L.state)) return list;
        const extra = cur - L.state, prev = list[list.length - 2];
        if (L.start < from) return [...list, { start: from, change: extra, state: cur }];
        const base = L.change != null ? Math.max(0, L.change) : prev && prev.state != null ? Math.max(0, L.state - prev.state) : 0;
        return [...list.slice(0, -1), { ...L, change: base + extra, state: cur }];
      };
      this._stSeen = o?.state;
      const rows = live(await this._statFetch(id, period, start), period === "month" ? ms.getTime() : t0.getTime());
      if (this._stEl !== d) return;
      const daily = kind === "dist" ? (period === "day" && start <= now - 30 * day ? rows : live(await this._statFetch(id, "day", Math.min(now - 30 * day, ms.getTime())), t0.getTime())) : rows; /* the "30 days" figures always use 30 days of data, whichever tab is open */
      if (this._stEl !== d) return;
      const val = (r) => r.mean ?? r.state ?? null;
      const chg = (list) => list.map((r, i) => r.change != null ? Math.max(0, r.change) : (i && r.state != null && list[i - 1].state != null ? Math.max(0, r.state - list[i - 1].state) : null));
      const inRange = rows.filter((r) => r.start >= now - Number(range === "365" ? 365 : range) * day - day);
      let pts = [], bars = null, kv = [];
      const kvb = (l, v, sub = "") => `<div class="stk" title="${esc(T(l))}"><div class="sv"><b>${v}</b>${sub ? `<i>${esc(sub)}</i>` : ""}</div><small>${esc(T(l))}</small></div>`;
      if (kind === "dist") {
        const c = chg(inRange); bars = inRange.map((r, i) => [r.start, c[i] || 0]);
        const dc = chg(daily), dd = daily.map((r, i) => [r.start, dc[i] || 0]);
        const sumSince = (t) => dd.filter(([s]) => s >= t).reduce((x, [, v]) => x + v, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0); const wk = new Date(today); wk.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const month = dd.filter(([s]) => s >= ms.getTime()), best = month.reduce((b, x) => x[1] > b[1] ? x : b, [0, 0]);
        const last30 = dd.filter(([s]) => s >= now - 30 * day), tot30 = last30.reduce((x, [, v]) => x + v, 0), driven = last30.filter(([, v]) => v > 0).length;
        kv = [kvb("Today", nf(sumSince(today.getTime()), 1) + " " + unit), kvb("This week", nf(sumSince(wk.getTime()), 0) + " " + unit), kvb("This month", nf(sumSince(ms.getTime()), 0) + " " + unit),
          kvb("Average per day", nf(tot30 / 30, 1) + " " + unit, T("30 days")), kvb("Average per week", nf(tot30 / 30 * 7, 0) + " " + unit, T("30 days")),
          kvb("Most this month", best[1] > 0 ? nf(best[1], 0) + " " + unit : "—", best[1] > 0 ? f.dm(best[0]) : ""), kvb("Days driven", String(driven), T("30 days"))];
      } else {
        pts = inRange.map((r) => [r.start, val(r), r.min, r.max]).filter((p) => p[1] != null);
        const vs = pts.map((p) => p[1]);
        if (kind === "fuel") {
          /* Hourly rows, not daily means: a refuel is a step between two steady readings; the gauge overshoots and glitches (0/100) while filling, so only steady hours (min and max within 2) count. */
          const hr = await this._statFetch(id, "hour", now - 365 * day);
          if (this._stEl !== d) return;
          const stb = hr.filter((r) => { const m = val(r); return m != null && (r.max ?? m) - (r.min ?? m) <= 2; });
          const fills = [], drops = [];
          for (let i = 1; i < stb.length; i++) {
            const dl = val(stb[i]) - val(stb[i - 1]);
            if (dl > 3) fills.push({ t: (hr.find((r) => r.start > stb[i - 1].start) || stb[i]).start, up: dl });
            else if (dl < 0) drops.push([stb[i].start, -dl]);
          }
          const used = (t) => drops.filter(([s]) => s >= t).reduce((x, [, v]) => x + v, 0), lastFill = fills[fills.length - 1];
          kv = [kvb("Used, last 7 days", nf(used(now - 7 * day), 1) + " " + unit), kvb("Used, last 30 days", nf(used(now - 30 * day), 1) + " " + unit), kvb("Used this month", nf(used(ms.getTime()), 1) + " " + unit),
            kvb("Average per day", nf(used(now - 30 * day) / 30, 2) + " " + unit, T("30 days")), kvb("Last refuel", lastFill ? f.dm(lastFill.t) : "—", lastFill ? "+" + nf(lastFill.up, 0) + " " + unit : "")];
        } else if (vs.length) {
          const mins = pts.map((p) => p[2] ?? p[1]), maxs = pts.map((p) => p[3] ?? p[1]), lo = Math.min(...mins), hi = Math.max(...maxs);
          const at = (arr, v) => pts[arr.indexOf(v)]?.[0];
          kv = [kvb("Average", nf(vs.reduce((x, y) => x + y, 0) / vs.length, 1) + " " + unit), kvb("Lowest", nf(lo, 1) + " " + unit, at(mins, lo) ? f.dm(at(mins, lo)) : ""), kvb("Highest", nf(hi, 1) + " " + unit, at(maxs, hi) ? f.dm(at(maxs, hi)) : "")];
        }
      }
      const empty = kind === "dist" ? !bars.length : !pts.length;
      const tabs = [["7", "7 days"], ["30", "30 days"], ["365", "12 months"]].map(([k, l]) => `<button class="${range === k ? "on" : ""}" data-strange="${k}" aria-pressed="${range === k}">${esc(T(l))}</button>`).join("");
      const upd = o?.last_changed ? f.wdh(new Date(o.last_changed).getTime()) : "";
      d.innerHTML = `<div class="sth"><div><b>${esc(nf(Number(o?.state)))}</b><span>${esc(unit)}</span></div><small>${esc(T("Updated"))} ${esc(upd)}</small></div>
        <div class="seg sttabs">${tabs}</div>
        <div class="stc">${empty ? `<p class="hint">${esc(T("No statistics yet. Home Assistant keeps them only for sensors with a state class."))}</p>` : this._statSvg(kind, bars, pts, range, unit, f)}</div>
        <p class="stread" aria-live="polite">${esc(T("Tap the chart to see the values at that moment."))}</p>
        <div class="stg">${kv.join("")}</div>
        <p class="hint stnote">${esc(rows.length && rows[0].h ? T("No long-term statistics for this sensor. Showing the last {0} days of history.", Math.max(1, Math.round((now - rows[0].start) / day))) : T("Home Assistant keeps statistics on your own server, so they last over time."))}</p>`;
    } catch (e) {
      if (this._stEl === d) d.innerHTML = `<p class="hint">${esc(T("Could not load the statistics."))} ${esc(tError(e?.message || ""))}</p>`;
    }
  }
  /* Range window: only what the card does not already show. The car's own range figure is a fixed factor of the battery level, so the real range is worked out from the kilometres driven and the battery used (Home Assistant statistics). */
  async _rangeLoad(d) {
    const day = 86400000, H = 3600000, now = Date.now(), f = haFmt(this._rawHass || this._hass), nf = (n, x = 0) => n == null || !Number.isFinite(n) ? "—" : this._fmtNum(n, x);
    const range = ["30","365"].includes(this._stRange) ? this._stRange : "7", span = range === "365" ? 365 : 30, fuel = hasFuel(this._hass, this._c);
    this._stSeen = this._eobj("__range")?.state; /* the range window has no sensor of its own: keep the render check from reloading it again */
    const ids = ["sensor.remaining_range", "sensor.battery_level", "sensor.fuel_level", "sensor.outside_temperature", "sensor.total_odometer"].map((k) => this._id(k));
    try {
      const rows = await Promise.all(ids.map((id, i) => i === 2 && !fuel ? [] : this._statFetch(id, "hour", now - span * day).catch(() => [])));
      if (this._stEl !== d) return;
      const val = (r) => r.mean ?? r.state ?? null, M = rows.slice(0, 4).map((l) => new Map(l.map((r) => [r.start, val(r)]).filter((x) => x[1] != null)));
      const [ev, soc, fv, tp] = M, odo = rows[4], socR = new Map(rows[1].map((r) => [r.start, r]));
      const chg = new Map(); odo.forEach((r, i) => { const c = r.change != null ? r.change : (i && r.state != null && odo[i - 1].state != null ? r.state - odo[i - 1].state : null); if (c != null && c >= 0 && c < 400) chg.set(r.start, c); });
      const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
      /* electric range over time (the petrol range is not mixed in) */
      const tot = [...ev.keys()].sort((a, b) => a - b).filter((h) => ev.get(h) > 0).map((h) => [h, ev.get(h)]);
      /* per day: km driven and battery used (sum of the hourly drops, charging ignored) */
      const days = new Map(), hs = [...soc.keys()].sort((a, b) => a - b);
      for (let i = 1; i < hs.length; i++) {
        if (hs[i] - hs[i - 1] !== H) continue;
        const dd = new Date(hs[i]).setHours(0, 0, 0, 0), e = days.get(dd) || { km: 0, used: 0, t: [], fuel: 0 }, ds = soc.get(hs[i]) - soc.get(hs[i - 1]);
        if (ds < 0 && ds > -60) e.used -= ds;
        if (fuel && fv.get(hs[i]) > 0 && fv.get(hs[i - 1]) > 0) { const dv = fv.get(hs[i]) - fv.get(hs[i - 1]); if (dv < -0.5 && dv > -30) e.fuel -= dv; } /* fuel level drops in %; a refuel is a rise and a 0 reading is a glitch */
        e.km += chg.get(hs[i]) || 0; if (tp.has(hs[i])) e.t.push(tp.get(hs[i])); days.set(dd, e);
      }
      const drv = [...days.entries()].filter(([, e]) => e.km >= 5).map(([t, e]) => ({ t, km: e.km, fuel: e.fuel, used: e.used })).filter((x) => x.t >= now - Number(range) * day - day), kmF = drv.reduce((x, y) => x + y.km, 0), fSum = drv.reduce((x, y) => x + y.fuel, 0), tankL = (() => { const v = Number(this._eobj(this._id("sensor.fuel_volume"))?.state), l = Number(this._eobj(ids[2])?.state); return v > 0 && l >= 10 ? v / l * 100 : null; })(), lPer100 = fuel && tankL && kmF >= 20 ? fSum / 100 * tankL / kmF * 100 : null;
      /* hybrids: a day with petrol used is left out, the engine drove part of those km and the battery did not */ /* trips = runs of consecutive hours with distance. Battery used = highest level in the first hour minus lowest level in the last hour (exact, unlike the difference of hourly means); charging inside a run, or a run that used petrol, is flagged */
      const petrolAt = (h) => fuel && fv.get(h) > 0 && fv.get(h - H) > 0 && fv.get(h) - fv.get(h - H) < -0.5 && fv.get(h) - fv.get(h - H) > -30, hrs = [...chg.keys()].filter((h) => chg.get(h) >= 0.2).sort((a, b) => a - b), trips = [];
      for (let i = 0; i < hrs.length;) {
        let j = i; while (j + 1 < hrs.length && hrs[j + 1] - hrs[j] === H) j++;
        const a = hrs[i], z = hrs[j]; let km = 0, rise = false, pet = petrolAt(z + H); const tt = [];
        for (let h = a; h <= z; h += H) { km += chg.get(h) || 0; if (tp.has(h)) tt.push(tp.get(h)); if (petrolAt(h)) pet = true; if (h > a && soc.has(h) && soc.has(h - H) && soc.get(h) - soc.get(h - H) > 1) rise = true; }
        /* known limit: a rise is only looked for after the first hour of a run, so a car that drove and then charged inside its first hour counts the charge as battery used (rare; checking the first hour would also drop every morning trip that follows an overnight charge) */ /* the highest / lowest level of an hour; the odd 0 reading the car sends (a glitch) is replaced by the hourly mean */
        const hiL = (r) => !r ? null : (r.max != null && (r.mean == null || r.max <= r.mean + 40) ? r.max : r.mean), loL = (r) => !r ? 1e9 : (r.min != null && r.min > 0 && (r.mean == null || r.min >= r.mean - 40) ? r.min : (r.mean ?? 1e9));
        const s0 = hiL(socR.get(a)), s1 = Math.min(loL(socR.get(z)), chg.get(z + H) >= 0.2 ? 1e9 : loL(socR.get(z + H))); /* the battery level often arrives later than the odometer: the quiet hour after the trip is included */
        /* a trip starting at 99 % or more is left out: after a charge the car shows 100 % and falls to about 95 % within the hour, which is not driving */ if (!rise && s0 != null && s0 < 99 && s1 < 1e9 && s0 >= s1 && km >= 1) trips.push({ t: new Date(a).setHours(0, 0, 0, 0), km, used: s0 - s1, end: s1, pet, temp: mean(tt) });
        i = j + 1;
      }
      /* real range: battery-only trips (short ones too, they add up), not at a low level (the engine helps there); the totals must be large enough that the 1 % steps of the battery level do not matter */
      const ok = trips.filter((x) => x.end >= 15 && !x.pet).map((x) => ({ t: x.t, per: x.km / x.used, temp: x.temp, km: x.km, used: x.used }));
      const allT = trips.filter((x) => x.t >= now - Number(range) * day - day), kmA = allT.reduce((x, y) => x + y.km, 0), bPer100 = kmA >= 20 ? allT.reduce((x, y) => x + y.used, 0) / kmA * 100 : null;
      const from = now - Number(range) * day, sel = ok.filter((x) => x.t >= from - day);
      const sum = (a, k) => a.reduce((x, y) => x + y[k], 0), per = sum(sel, "used") >= 5 && sum(sel, "km") >= 8 ? sum(sel, "km") / sum(sel, "used") : null;
      const lastEv = ev.get(hs[hs.length - 1]), lastSoc = soc.get(hs[hs.length - 1]), carPer = lastEv > 0 && lastSoc >= 20 ? lastEv / lastSoc : null;
      const kvb = (l, v, sub = "") => `<div class="stk" title="${esc(T(l))}"><div class="sv"><b>${v}</b>${sub ? `<i>${esc(sub)}</i>` : ""}</div><small>${esc(T(l))}</small></div>`;
      const tips = [], kvr = (l, v, tip, sub = "") => (tips.push([l, tip]), `<div class="stk" title="${esc(T(tip))}"><b>${v}</b>${sub ? `<i>${esc(sub)}</i>` : ""}<small>${esc(T(l))}</small></div>`), share = per != null && carPer ? per / carPer * 100 : null;
      const kv = [kvr("Efficiency", share == null ? "—" : nf(share, 0) + "%", "Your real range compared with what the car shows: 100% means you get exactly what the dashboard promises"), kvr("Per 1% battery", per == null ? "—" : nf(per, 2) + " km", "Kilometres you really drive per 1% of battery")];
      if (bPer100 != null) { const kw = this._battKwh(); kv.push(kvr("Per 100 km", kw > 0 ? nf(bPer100 / 100 * kw, 1) + " kWh" : nf(bPer100, 0) + "%", fuel ? "Battery and petrol used per 100 km of all your driving" : "Battery used per 100 km of all your driving", fuel && lPer100 != null ? "+ " + nf(lPer100, 1) + " L" : "")); }
      let pts = tot.filter((p) => p[0] >= from).map((p) => [p[0], p[1]]), fpts = fuel ? [...fv.keys()].sort((a, b) => a - b).filter((h) => h >= from && fv.get(h) > 0).map((h) => [h, fv.get(h)]) : [];
      if (range === "365") { const dn = (a) => { const g = new Map(); a.forEach(([t, v]) => { const k = new Date(t).setHours(0, 0, 0, 0), e = g.get(k) || [0, 0]; e[0] += v; e[1]++; g.set(k, e); }); return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([t, e]) => [t, e[0] / e[1]]); }; pts = dn(pts); fpts = dn(fpts); } /* a year: one point per day */
      const bands = [["< 5°", -99, 5], ["5–12°", 5, 12], ["12–20°", 12, 20], ["20–28°", 20, 28], ["> 28°", 28, 99]], curT = Number(this._eobj(ids[3])?.state);
      const bv = bands.map(([l, a, b]) => { const g = sel.filter((x) => x.temp != null && x.temp >= a && x.temp < b); return { l, v: g.length && sum(g, "used") >= 5 && sum(g, "km") >= 8 ? sum(g, "km") / sum(g, "used") * 100 : null, now: Number.isFinite(curT) && curT >= a && curT < b }; });
      const mx = Math.max(1, ...bv.map((b) => b.v || 0));
      const bars = bv.filter((b) => b.v != null).length > 1 ? `<button class="rgtog" data-rgtemp aria-expanded="${!!this._rgTemp}"><span>${esc(T("Real range by outside temperature"))}</span>${ico(this._rgTemp ? "chevu" : "chevd")}</button><div class="rgtemp"${this._rgTemp ? "" : " hidden"}><div class="rgt">${bv.map((b) => `<div class="r${b.now ? " now" : ""}"><span>${esc(b.l)}</span><div class="b"><i style="width:${b.v == null ? 0 : Math.round(b.v / mx * 100)}%"></i></div><b>${b.v == null ? "—" : nf(b.v, 0)}</b></div>`).join("")}</div></div>` : "";
      const tabs = [["7", "7 days"], ["30", "30 days"], ["365", "12 months"]].map(([k, l]) => `<button class="${range === k ? "on" : ""}" data-strange="${k}" aria-pressed="${range === k}">${esc(T(l))}</button>`).join("");
      const note = per == null ? T("Not enough driving yet. The real range appears after a few trips that use at least 5% of the battery.") : T("Based on {0} battery-only trips ({1} km). Trips with the engine running and trips at a low battery level are left out. The car's own figure is simply the battery level times a fixed factor.", String(sel.length), nf(sel.reduce((x, y) => x + y.km, 0), 0));
      d.innerHTML = `<div class="sth"><div><b>${esc(nf(per == null ? null : per * 100, 0))}</b><span>km</span></div><small>${esc(T("Real range on a full battery (est.)"))}</small></div>
        <div class="seg sttabs">${tabs}</div>
        <div class="stc">${pts.length ? (fpts.length > 1 ? `<div class="rgl"><span><i></i>${esc(T("Electric range"))}</span><span><i class="p"></i>${esc(T("Petrol tank"))} %</span></div>` : "") + this._statSvg("gen", [], pts, range, "km", f, fpts) : `<p class="hint">${esc(T("No statistics yet. Home Assistant keeps them only for sensors with a state class."))}</p>`}</div>
        <p class="stread" aria-live="polite">${esc(T("Tap the chart to see the values at that moment."))}</p>
        <div class="stg rg${kv.length}">${kv.join("")}</div>${bars}
        <div class="rginfo"${per == null ? ' data-keep="1"' : this._rgInfo ? "" : " hidden"}><span>${esc(note)}</span>${tips.map(([l, tp]) => `<span><b>${esc(T(l))}</b> · ${esc(T(tp))}</span>`).join("")}</div>`;
        d.closest?.(".box")?.querySelector("[data-rginfo]")?.setAttribute("aria-pressed", String(!!this._rgInfo));
    } catch (e) {
      if (this._stEl === d) d.innerHTML = `<p class="hint">${esc(T("Could not load the statistics."))} ${esc(tError(e?.message || ""))}</p>`;
    }
  }
  _statSvg(kind, bars, pts, range, unit, f, extra) {
    const W = 340, H = 150, L = 34, R = 6, T0 = 10, B = 22, pw = W - L - R, ph = H - T0 - B;
    const longSpan = kind === "dist" || (pts.length > 1 && pts[pts.length - 1][0] - pts[0][0] > 200 * 864e5), lab = (t) => range === "365" && longSpan ? new Intl.DateTimeFormat(I18N.numLocale(), { month: "short" }).format(new Date(t)) : range === "7" && kind !== "dist" ? new Intl.DateTimeFormat(I18N.numLocale(), { weekday: "short", ...(f.timeZone ? { timeZone: f.timeZone } : {}) }).format(new Date(t)) : f.dm(t);
    let svg = "", data = [];
    if (kind === "dist") {
      const mx = Math.max(1, ...bars.map((b) => b[1])), bw = pw / Math.max(bars.length, 1);
      const top = Math.ceil(mx / 10) * 10 || 10;
      [0, .5, 1].forEach((g) => { const y = T0 + ph - g * ph; svg += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 4}" y="${y + 3}" text-anchor="end">${Math.round(top * g)}</text>`; });
      bars.forEach(([t, v], i) => { const h = v / top * ph, x = L + i * bw + bw * .15; svg += `<rect class="bar${v > 0 ? "" : " z"}" x="${x.toFixed(1)}" y="${(T0 + ph - Math.max(h, 1.5)).toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="${Math.min(3, bw * .3).toFixed(1)}" data-i="${i}"/>`; data.push([t, v]); });
      const step = Math.max(1, Math.ceil(bars.length / 6));
      bars.forEach(([t], i) => { if (i % step === 0) svg += `<text class="ax" x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(lab(t))}</text>`; });
    } else {
      const band = kind !== "fuel", lo = Math.min(...pts.map((p) => band ? p[2] ?? p[1] : p[1])), hi = Math.max(...pts.map((p) => band ? p[3] ?? p[1] : p[1])), /* fuel: the hourly mean only, so a one-off 0 reading does not stretch the scale */ pad = (hi - lo) * .1 || 1, y0 = lo - pad, y1 = hi + pad;
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1, X = (t) => L + (t1 === t0 ? pw / 2 : (t - t0) / (t1 - t0) * pw), Y = (v) => T0 + ph - (v - y0) / (y1 - y0) * ph;
      [0, .5, 1].forEach((g) => { const v = y0 + (y1 - y0) * g, y = Y(v); svg += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 4}" y="${y + 3}" text-anchor="end">${this._fmtNum(v, Math.abs(y1 - y0) < 10 ? 1 : 0)}</text>`; });
      if (kind !== "fuel" && pts.some((p) => p[2] != null)) svg += `<path class="band" d="M${pts.map((p) => X(p[0]).toFixed(1) + " " + Y(p[3] ?? p[1]).toFixed(1)).join("L")}L${pts.slice().reverse().map((p) => X(p[0]).toFixed(1) + " " + Y(p[2] ?? p[1]).toFixed(1)).join("L")}Z"/>`;
      const line = pts.map((p) => X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("L");
      svg += `<path class="area" d="M${line}L${X(t1).toFixed(1)} ${T0 + ph}L${X(t0).toFixed(1)} ${T0 + ph}Z"/><path class="ln" d="M${line}"/>`;
      if (extra && extra.length > 1) svg += `<path class="ln2" d="M${extra.map((p) => X(Math.min(t1, Math.max(t0, p[0]))).toFixed(1) + " " + (T0 + ph - Math.min(100, Math.max(0, p[1])) / 100 * ph).toFixed(1)).join("L")}"/>`; /* petrol tank level, 0-100 % over the chart height */
      data = pts.map((p) => [p[0], p[1], X(p[0])]);
      const n = 5; for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * i / (n - 1); svg += `<text class="ax" x="${X(t).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(lab(t))}</text>`; }
      svg += `<line class="cur" y1="${T0}" y2="${T0 + ph}" visibility="hidden"/><circle class="dot" r="4" visibility="hidden"/>`;
      this._stY = Y;
    }
    this._stData = { kind, data, L, pw, W, unit, lab: (t) => kind === "dist" || range !== "7" ? f.dm(t, true) : f.wdh(t) };
    return `<svg class="stsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T("Chart"))}">${svg}</svg>`;
  }
  _statPick(e) {
    const svg = e.target.closest?.(".stsvg"), sd = this._stData; if (!svg || !sd || !sd.data.length) return;
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * sd.W; let i;
    if (sd.kind === "dist") { i = Math.min(sd.data.length - 1, Math.max(0, Math.floor((x - sd.L) / (sd.pw / sd.data.length)))); svg.querySelectorAll(".bar").forEach((b) => b.classList.toggle("sel", Number(b.dataset.i) === i)); }
    else { i = sd.data.reduce((b, p, k) => Math.abs(p[2] - x) < Math.abs(sd.data[b][2] - x) ? k : b, 0); const p = sd.data[i], cur = svg.querySelector(".cur"), dot = svg.querySelector(".dot"); cur.setAttribute("x1", p[2]); cur.setAttribute("x2", p[2]); cur.setAttribute("visibility", "visible"); dot.setAttribute("cx", p[2]); dot.setAttribute("cy", this._stY(p[1])); dot.setAttribute("visibility", "visible"); }
    const p = sd.data[i], rd = this._stEl?.querySelector(".stread"); if (rd) rd.textContent = `${sd.lab(p[0])} · ${this._fmtNum(p[1], 1)} ${sd.unit}`;
  }
  _cfgOf(t, k) { try { return t.dataset[k] ? JSON.parse(t.dataset[k]) : null; } catch (_) { return null; } }
  _battKwh() { const o = Number(this._c.battery_kwh); return o > 0 ? o : autoKwh(this._hass, this._c); }
  _hasFuel() { return hasFuel(this._hass, this._c); }
  _tap(t) {
    if (t.id === "status" && !t.dataset.tap && this._s("lock.doors") !== null) { this._noClickUntil = Date.now() + 500; this._lockSheet = true; return this._force(); }
    if (t.dataset.energy && !t.dataset.tap) { this._noClickUntil = Date.now() + 500; this._enSheet = true; return this._force(); }
    if (t.dataset.open && !t.dataset.tap) { this._noClickUntil = Date.now() + 500; this._view = t.dataset.open; return this._force(); }
    const custom=(this._c.info_custom||[]).find(x=>x.entity===t.dataset.ent);
    if (t.classList.contains("total") && !t.dataset.tap && !this._cfgOf(t, "tap")) { this._noClickUntil = Date.now() + 500; this._stSheet = "__range"; return this._force(); } /* the big range number opens its own window */
    if (!t.dataset.tap && !custom?.tap_action && t.classList.contains("tile") && this._statable(t.dataset.ent)) { this._noClickUntil = Date.now() + 500; this._stSheet = t.dataset.ent; return this._force(); }
    this._act(this._cfgOf(t, "tap") || custom?.tap_action || { action: "more-info" }, t.dataset.ent);
  }
  _hold(t) {
    if((this._c.info_custom||[]).some(x=>x.entity===t.dataset.ent))return this._act({action:"more-info"},t.dataset.ent);
    const a = this._cfgOf(t, "hold");
    if (a) return this._act(a, t.dataset.ent);
    if (t.classList.contains("tile") && this._statable(t.dataset.ent)) return this._act({ action: "more-info" }, t.dataset.ent); /* long press keeps the Home Assistant details window */
    this._tap(t);
  }
  _act(cfg, ent) {
    const id = cfg.entity || ent, readOnly = /^(sensor|binary_sensor|weather|sun|zone|person|device_tracker|event|image|camera|calendar)\./.test(id || "");
    const a = cfg.action === "toggle" && readOnly ? "more-info" : cfg.action || "more-info"; /* these domains cannot be toggled */
    if(cfg.confirmation&&(a==="toggle"||(["perform-action","call-service"].includes(a)&&/\.(turn_on|turn_off|press)$/.test(cfg.perform_action||cfg.service||"")))){this._confirm={id:"custom",key:"custom",customAction:{...cfg,confirmation:false},entity:ent};clearTimeout(this._confirmTimer);this._confirmTimer=setTimeout(()=>{this._confirm=null;this._force();},8000);return this._force();}
    if (a === "more-info") { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } })); return; }
    if (a === "toggle") return this._hass.callService("homeassistant", "toggle", { entity_id: id }).catch((err) => this._failToast(err));
    if (a === "call-service" || a === "perform-action") {
      const [dom, svc] = String(cfg.service || cfg.perform_action || "").split(".");
      if (!dom || !svc) return this._toast("Invalid service in action", "error");
      return this._hass.callService(dom, svc, { ...(cfg.data || cfg.service_data || {}), ...(cfg.target || {}) })
        .then(() => this._toast("Action sent", "ok")).catch((err) => this._toast(tError(err?.message) || T("The action failed"), "error"));
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

  /* One-line quick preconditioning in the climate view: temperature (Cool / Comfort / Hot), duration, Start (Stop while a Companion session runs) */
  _pqSync(root) {
    const q = root.querySelector("#pqx"); if (!q) return;
    const ok = !!(this._hass && this._hass.companionRequest); q.hidden = !ok; if (!ok) return;
    const t = this._pqT, d = this._pqD, info = this._pcInfo || {}, busy = !!this._pqBusy || !!info.starting, run = !!info.running && !busy;
    const left = run && info.hasEnd && this._pcRem && this._pcRem.rem != null ? Math.max(0, this._pcRem.rem - (Date.now() - this._pcRem.at) / 1000) : null;
    const mmss = left == null ? "" : String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(Math.floor(left % 60)).padStart(2, "0");
    const nm = { 18: "Cool", 21: "Comfort", 24: "Hot" }, name = t ? T(nm[t] || "") + " " + t + "°" : "";
    let html;
    if (busy) html = `<span class="pqm"><span class="sp"></span>${esc(T("Starting"))}…</span>`;
    else if (info.stopping) html = `<span class="pqm"><span class="sp"></span>${esc(T("Stopping"))}…</span>`;
    else if (!run && this._climateIsOn()) html = `<span class="pqm">${esc(T("Running"))}</span>`; /* climate is on but not started by Companion: nothing to stop here */
    else if (run) html = `<span class="pqm">${esc(T("Running"))}${mmss ? " · <b>" + mmss + "</b>" : ""}</span><button type="button" class="pqg stop" data-pq-go aria-label="${esc(T("Stop preconditioning"))}">${esc(T("Stop"))}</button>`;
    else if (!t) html = [18, 21, 24].map((v) => `<button type="button" data-pq-t="${v}" aria-label="${esc(T("Preconditioning"))}: ${esc(T(nm[v]))} ${v}°">${esc(T(nm[v]))} ${v}°</button>`).join("");
    else if (!d) html = `<button type="button" class="pqc" data-pq-back aria-label="${esc(T("Change"))}">${esc(name)} <i>✕</i></button>` + [5, 10, 15].map((v) => `<button type="button" data-pq-d="${v}">${v} ${esc(T("min"))}</button>`).join("");
    else html = `<button type="button" class="pqc" data-pq-back aria-label="${esc(T("Change"))}">${esc(name)} · ${d} ${esc(T("min"))} <i>✕</i></button><button type="button" class="pqg" data-pq-go aria-label="${esc(T("Start preconditioning"))}">${esc(T("Start"))}</button>`;
    const body = q.querySelector("[data-pq-body]");
    if (body && body.dataset.h !== html) { body.dataset.h = html; body.innerHTML = html; }
    if ((run && left != null) || busy) { if (!this._pqTk) this._pqTk = setInterval(() => { if (!this._el || !this._el.vclim || !this.isConnected) { clearInterval(this._pqTk); this._pqTk = null; return; } this._pqSync(this._el.vclim); }, 1000); }
    else if (this._pqTk) { clearInterval(this._pqTk); this._pqTk = null; }
  }
  async _pqGo() {
    const h = this._hass; if (this._pqBusy || !h || !h.companionRequest) return;
    const stop = !!(this._pcInfo && this._pcInfo.running);
    if (this._isCompanionPreview && this._previewMode !== "live") return; /* previews never send commands */
    this._pqBusy = true; this._pqSync(this._el.vclim);
    try {
      await h.companionRequest(stop ? "precondition_stop" : "precondition_start", stop ? {} : { temperature: this._pqT ?? 21, duration: this._pqD ?? 10 }); if (!stop) { this._pqT = null; this._pqD = null; }
      this._toast(T(stop ? "Stop preconditioning" : "Start preconditioning"), "ok");
    } catch (e) { this._toast(tError(e && e.message) || T("Not confirmed by the vehicle"), "error"); }
    this._pqBusy = false; this._pqPollN = 0;
    const poll = () => { this._pqPoll = null; if (!this.isConnected || this._pqPollN++ > 12) return; this._pcAt = 0; this._pcFetch(true); if (this._el && this._el.vclim) this._pqSync(this._el.vclim); this._pqPoll = setTimeout(poll, 2500); };
    clearTimeout(this._pqPoll); poll();
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
      this._pcFetch(true); this._pqSync(el.vclim);
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
        <button class="act dpw ${on ? "on" : ""} ${pend ? "pending" : ""}" data-id="climate" aria-label="Climate on/off">${ico("power")}${pend ? ringHtml() : ""}</button>${this._hass && this._hass.companionRequest ? `<button class="act dpc" data-precondition aria-label="${esc(T("Preconditioning"))}">${ico("precond")}<span>${esc(T("Preconditioning"))}</span></button>` : ""}`;
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
  const Eg = () => window.__DEEPAL_COMPANION_ENERGY;
  return (_enP = new Promise((res) => {
    const ok = () => { const E = Eg(); if (E && E.init) { E.init({ T, tError, ico, esc, haFmt, loaderHtml, resolveId, I18N }); I18N.addExtra(E.lang); res(true); } else bad(); };
    const bad = () => { _enP = null; res(false); };
    if (Eg() && Eg().init) return ok();
    const sc = document.createElement("script");
    sc.src = `${SCRIPT_BASE}energy/energy.js?v=${CARD_VERSION}&rev=20261126-01`; sc.async = true; sc.onload = ok; sc.onerror = bad;
    document.head.appendChild(sc);
  }));
}

class DeepalS05Settings extends HTMLElement {
  connectedCallback() { I18N.watch(this.shadowRoot); }
  disconnectedCallback() { this._tro?.disconnect(); this._tro = null; }
  constructor() {
    super();
    this.attachShadow({ mode: "open" }); I18N.watch(this.shadowRoot);
    this.mode = "card"; this.tab = "layout"; this._form = { entity: "", label: "", icon: "info", mkey: "", ment: "", mdi: "", tap: "more-info", target: "", path: "", confirm:false }; this._disc = null;
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
  /* The page keeps its scroll position when the settings are redrawn (tab change, changed setting, loading placeholder). */
  _scrollers() {
    const out = [];
    let n = this;
    while (n) {
      if (n instanceof Element && n.scrollHeight > n.clientHeight) out.push(n);
      n = n.assignedSlot || n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
    }
    if (document.scrollingElement && !out.includes(document.scrollingElement)) out.push(document.scrollingElement);
    return out;
  }
  _keepScroll(draw, loading) {
    const saved = this._savedTops && this._savedTops.length ? this._savedTops : this._scrollers().map((el) => [el, el.scrollTop]);
    this._savedTops = loading ? saved : null;
    draw();
    const put = () => saved.forEach(([el, top]) => { if (top && el.scrollTop !== top) el.scrollTop = top; });
    put(); requestAnimationFrame(put); setTimeout(put, 120);
  }
  _renderTabLoading(){
    this._keepScroll(() => {
      this.shadowRoot.innerHTML='<style>'+SETTINGS_CSS+LOADER_CSS+'</style><div class="wrap">'+this._tabs()+'<div class="settings-loading" role="status" aria-live="polite">'+loaderHtml('sliders')+'</div></div>';
      this._bind();this._wireTabs();
    }, true);
  }

  _tabs() {
    const T = [["layout", "Layout", "eye"], ["look", "Appearance", "sliders"], ["controls", "Controls", "power"], ["charge", "Charging", "bolt"], ["vehicle", "Vehicle", "carside"], ["advanced", "Advanced", "gear"]];
    return `<div class="tabbar"><button class="tn l" data-tn="-1" aria-label="Previous tabs" hidden>${ico("chevr")}</button><div class="tabs">${T.map(([k, l, i]) => `<button data-tab="${k}" class="${this.tab === k ? "on" : ""}">${ico(i)}<span>${l}</span></button>`).join("")}</div><button class="tn r" data-tn="1" aria-label="Next tabs" hidden>${ico("chevr")}</button></div>`;
  }
  _sortKey(kind) { return {sec:'order',top:'top_buttons',info:'info_order',info_custom:'info_custom'}[kind]||'buttons'; }
  _orderList(all, order, hidden, labelOf, kind, unused = []) {
    let pos = 0;
    /* Sections: Status is its own tile right after the Vehicle image tile (no number, no handle, no arrows). It follows the image and is greyed out, with its switch disabled, while the image is off; its saved value is kept. */
    const sec = kind === "sec", items = sec ? order.filter((x) => x !== "status") : order;
    const heroOff = hidden.includes("hero"), statusOff = hidden.includes("status"), statusUn = unused.includes("status");
    const statusTile = () => `<div class="row status-tile ${statusOff ? "off" : ""} ${heroOff ? "dep" : ""} ${statusUn ? "unused" : ""}" data-id="status"${statusUn ? ` title="${esc(T("Not used by this card design"))}"` : ""}><b class="lk" aria-hidden="true">↳</b><span>${esc(labelOf("status"))}</span><button class="swb" data-vis="sec|status" ${heroOff ? "disabled" : ""} aria-label="${T("Show")} ${esc(labelOf("status"))}" aria-pressed="${!statusOff}"><i class="sw ${statusOff ? "" : "on"}"></i></button></div>`;
    return `<div class="list cols">${items.map((id, i) => {
      const off = hidden.includes(id), un = unused.includes(id);
      pos++;
      return `<div class="row ${off ? "off" : ""} ${un ? "unused" : ""}" data-dk="${kind}" data-id="${esc(id)}"${un ? ` title="${esc(T("Not used by this card design"))}"` : ""}><i class="grip" aria-hidden="true" title="${T("Drag to reorder")}"></i><b class="pos" aria-hidden="true">${pos}</b><span>${esc(labelOf(id))}</span>
        <button class="mv" data-mv="${kind}|${id}|-1" ${i === 0 ? "disabled" : ""} aria-label="Up">${ico("up")}</button>
        <button class="mv" data-mv="${kind}|${id}|1" ${i === items.length - 1 ? "disabled" : ""} aria-label="Down">${ico("down")}</button>
        <button class="swb" data-vis="${kind}|${id}" aria-label="${T("Show")} ${esc(labelOf(id))}" aria-pressed="${!off}"><i class="sw ${off ? "" : "on"}"></i></button></div>${sec && id === "hero" ? statusTile() : ""}`;
    }).join("")}${sec && !items.includes("hero") ? statusTile() : ""}</div>`;
  }
  _sel(name, val, opts) { return `<select data-set="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`; }
  _num(name, val, step = "0.1") { const fallback=DEFAULTS[name],hint=name==='fuel_max'?940:fallback??0;return `<input type="number" step="${step}" data-set="${name}" data-num data-default="${esc(fallback??0)}" placeholder="${esc(hint)}" value="${val===fallback?"":esc(val)}">`; }
  _datalist() {
    const ids = Object.keys(this._hass?.states || {}).sort();
    return `<datalist id="ents">${ids.map((i) => `<option value="${esc(i)}" label="${esc(this._hass?.states?.[i]?.attributes?.friendly_name||i)}"></option>`).join("")}</datalist>`;
  }
  _iconPick() {
    return `<div class="icons">${PICKABLE_ICONS.map((n) => `<button data-icon="${n}" class="${this._form.icon === n ? "on" : ""}" aria-label="${n}">${ico(n)}</button>`).join("")}</div>`;
  }
  _syncTapFields(group,code){
    group.querySelector('[data-control-options]').hidden=!['toggle','turn_on','turn_off','press'].includes(code);group.querySelector('[data-path-options]').hidden=!['navigate','url'].includes(code);
  }
  _tapFields(kind='',index='',item=null){
    this._customActionsOpen ||= new Set();const key=item?kind+'|'+item.entity:'new';
    const code=item?customTapCode(item.tap_action):this._form.tap||'more-info',target=item?(item.tap_action?.entity||item.tap_action?.target?.entity_id||''):this._form.target||'',path=item?(item.tap_action?.navigation_path||item.tap_action?.url_path||''):this._form.path||'',confirmation=item?!!item.tap_action?.confirmation:!!this._form.confirm;
    const custom=item&&!CUSTOM_TAPS.some(([value])=>value===code),control=['toggle','turn_on','turn_off','press'].includes(code),linked=['navigate','url'].includes(code);
    const attrs=field=>item?'data-custom-action="'+kind+'|'+index+'" data-action-field="'+field+'"':'data-f="'+field+'"';
    const summary=CUSTOM_TAPS.find(([value])=>value===code)?.[1]||'Custom action';
    return '<details class="custom-action-details" data-action-editor="'+esc(key)+'"'+(this._customActionsOpen.has(key)?' open':'')+'><summary>'+esc(T('Tap action'))+' · '+esc(T(summary))+'</summary><div class="custom-action-fields"><label class="field">'+esc(T('Tap action'))+'<select '+attrs('tap')+'>'+(custom?'<option value="'+esc(code)+'" selected>'+esc(T('Custom action'))+'</option>':'')+CUSTOM_TAPS.map(([value,label])=>'<option value="'+value+'"'+(value===code?' selected':'')+'>'+esc(T(label))+'</option>').join('')+'</select></label><div data-control-options'+(control?'':' hidden')+'><label class="field">'+esc(T('Action target (optional)'))+'<input list="ents" '+attrs('target')+' value="'+esc(target)+'" placeholder="switch.my_switch"></label><label class="custom-confirm"><input type="checkbox" '+attrs('confirm')+(confirmation?' checked':'')+'>'+esc(T('Ask for confirmation'))+'</label></div><label class="field" data-path-options'+(linked?'':' hidden')+'>'+esc(T('Navigation path or URL'))+'<input '+attrs('path')+' value="'+esc(path)+'" placeholder="/deepal-companion-card"></label><small>'+esc(T('Long press always opens entity info. Read-only sensors need an action target to control.'))+'</small></div></details>';
  }
  _addForm(kind) {
    return `<div class="add"><label class="field">Entity<input type="text" list="ents" data-f="entity" placeholder="e.g. sensor.my_value" value="${esc(this._form.entity)}"></label>
      <label class="field">Label (optional)<input type="text" data-f="label" value="${esc(this._form.label)}"></label>
      <div class="field">Icon${this._iconPick()}</div>
      <label class="field">Or a Home Assistant icon (optional)<input type="text" data-f="mdi" placeholder="e.g. mdi:car-brake-abs" value="${esc(this._form.mdi)}"></label>
      ${this._tapFields()}
      <button class="btn sm" data-add="${kind}">${ico("plus")} Add</button></div>`;
  }
  _discHtml(c) {
    const ign = (c.diag_ignore || []).length, list = this._disc;
    const rows = list ? (list.length ? `<div class="list">${list.map((f) => `<div class="row">${icoBadge(f.icon)}<span>${esc(f.label)}<small>${esc(f.entity)}</small></span></div>`).join("")}</div>
` : `<p class="hint">✓ ${esc(T("No new sensors found."))}</p>`) : "";
    return `<div id="sensors-disc"><div class="btnrow"><button class="btn sm" data-discover>${ico("refresh")} ${esc(T("Search for new sensors"))}</button>${ign ? `<button class="btn sm" data-dreset>${esc(T("Show the ones I ignored again"))} (${ign})</button>` : ""}</div>${rows}</div>`;
  }
  _customRows(arr, kind) {
    return arr.length?'<div class="list">'+arr.map((x,i)=>`<div class="row custom-entity" data-dk="${kind}"><div class="custom-entity-header"><i class="grip" aria-hidden="true" title="${T('Drag to reorder')}"></i>${ico(x.icon||'info')}<div class="custom-entity-title"><strong>${esc(x.label||x.entity)}</strong><small>${esc(x.entity)}</small></div><button class="mv" data-mv="${kind}|${i}|-1" ${i===0?'disabled':''} aria-label="Up">${ico('up')}</button><button class="mv" data-mv="${kind}|${i}|1" ${i===arr.length-1?'disabled':''} aria-label="Down">${ico('down')}</button><button class="mv" data-del="${kind}|${i}" aria-label="Delete">${ico('trash')}</button></div>${this._tapFields(kind,i,x)}</div>`).join('')+'</div>':'';
  }

  _infoHtml(c) {
    const has = (k) => this._hass?.states?.[resolveId(this._hass, c, k)];
    const nod = (k) => { const st = has(k)?.state; return st === "unknown" || st === "unavailable" ? ` <small class="nod">No data</small>` : ""; };
    const order=c.info_order.filter(i=>(i==="charger_limit"||has(INFO_ITEMS[i][0]))&&((i!=="fuel_level"&&i!=="fuel_volume")||hasFuel(this._hass,c)));
    const iRows=order.map((id,i)=>`<div class="row" data-dk="info"><i class="grip" aria-hidden="true" title="${T('Drag to reorder')}"></i><b class="pos" aria-hidden="true">${i+1}</b>${ico(INFO_ITEMS[id][2])}<span>${esc(INFO_ITEMS[id][1])}${nod(INFO_ITEMS[id][0])}</span>
      <button class="mv" data-mv="info|${id}|-1" ${i===0?'disabled':''} aria-label="Up">${ico('up')}</button><button class="mv" data-mv="info|${id}|1" ${i===order.length-1?'disabled':''} aria-label="Down">${ico('down')}</button>
      <button class="swb" data-info="${id}" aria-label="Show ${esc(INFO_ITEMS[id][1])}" aria-pressed="${c.info.includes(id)}"><i class="sw ${c.info.includes(id)?'on':''}"></i></button></div>`).join('');
    return `<h4>Info</h4>
      <div class="list cols">${iRows}</div>
      ${this._customRows(c.info_custom, "info_custom")}${this._addForm("info_custom")}`;
  }
  _tabLayout(c) {
        return `${this._datalist()}
      <h4>Sections</h4>
      <p class="hint">${T("Drag the sections into the order you want and hide the ones you don’t need.")}</p>
      ${(DESIGN_UNUSED[c.companion_design] || []).length ? `<p class="hint">${T("Greyed-out sections aren’t used by this design. Your choices are kept.")}</p>` : ""}
      ${this._orderList(SECTIONS, c.order, [...c.hidden], (i) => SECTION_LABELS[i], "sec", DESIGN_UNUSED[c.companion_design] || [])}
      <h4>On the image</h4>
      ${this._tiles([...HERO_SHOW_OPTS.map(([k, l]) => ["data-hs", k, esc(I18N.t(l, [])), (c.hero_show || []).includes(k)]), ["data-tgl", "show_customize", "Settings button", c.show_customize !== false]])}
      <h4>Top-right buttons</h4>
      <p class="hint">${T("Order (left to right) and visibility of the small buttons in the image corner.")}</p>
      ${this._orderList(TOP_BTN_IDS, c.top_buttons, c.top_buttons_hidden, (i) => TOP_BTN_LABELS[i], "top")}
      <h4>Control buttons</h4>
      <p class="hint">Order and visibility of the control buttons.</p>
      ${this._orderList(BUTTON_IDS, c.buttons, c.buttons_hidden, (i) => BUTTON_LABELS[i], "btn")}
      <h4>Button style</h4>
      <label class="field inline">Layout ${this._sel("button_layout", c.button_layout, [["split", "Main buttons + “More”"], ["image", "Main buttons + “More” on the image"], ["imageall", "All buttons in “More” on the image"], ["swipe", "Swipe pages"], ["grid", "Rows (5 per row)"]])}</label>
      <label class="field inline">Labels ${this._sel("button_labels", c.button_labels, [["none", "No labels"], ["status", "Status only"], ["title", "Title only"], ["both", "Title + status (2 lines)"]])}</label>
      ${c.button_layout === "image" || c.button_layout === "swipe" ? this._opt(c.button_layout === "swipe" ? "Buttons per page" : "Main buttons", this._seg("button_primary", String(c.button_primary || 4), [["3", "3"], ["4", "4"], ["5", "5"]]), c.button_layout === "swipe" ? "Swipe left for the next buttons." : "The first buttons in the list go in the main row, the rest under “More”.") : ""}${c.button_layout === "split" || !c.button_layout ? `${this._opt("Main buttons", this._seg("button_primary", String(c.button_primary || 4), [["3", "3"], ["4", "4"], ["5", "5"]]), "The first buttons in the list go in the main row, the rest under “More”.")}${this._opt("The rest", this._seg("buttons_more", c.buttons_more || "collapse", [["collapse", "Hidden"], ["show", "Always visible"]]))}` : ""}
      ${this._opt("Size", this._seg("button_size", c.button_size, [["s", "Small"], ["m", "Medium"], ["l", "Large"]]))}
      ${this._infoHtml(c)}`;
  }
  _tiles(items) { return `<div class="tgrid">${items.map(([attr, k, l, on, ic]) => `<button class="tile ${on ? "on" : ""}" ${attr}="${esc(k)}" aria-pressed="${!!on}">${ic || ""}<span>${l}</span><i class="tk"></i></button>`).join("")}</div>`; }
  _tileWide(attr, k, l, sub, on, ic) { return `<button class="tile wide ${on ? "on" : ""}" ${attr}="${esc(k)}" aria-pressed="${!!on}">${ic || ""}<span><b>${l}</b><small>${sub}</small></span><i class="tk"></i></button>`; }
  _fxCards(cur) {
    const dot = (x, y, r) => `<circle class="ha" cx="${x}" cy="${y}" r="${r + 3}"/><circle class="pd" cx="${x}" cy="${y}" r="${r}"/>`;
    const art = {
      none: `<circle class="no" cx="22" cy="22" r="10"/><path class="no" d="M15 29 29 15"/>`,
      port: dot(22, 22, 5),
      flow: `<path class="fl" d="M6 34Q16 14 38 12"/>`,
      flow_port: `<path class="fl" d="M5 35Q12 22 27 17"/>${dot(32, 15, 4)}`,
      sweep: `<clipPath id="fxc"><rect x="8" y="14" width="28" height="16" rx="6"/></clipPath><rect class="cr" x="8" y="14" width="28" height="16" rx="6"/><g clip-path="url(#fxc)"><rect class="bd" x="0" y="10" width="9" height="24"/></g>`
    };
    const items = [["none", "None", "None"], ["port", "Port pulse", "Pulse at the charge port"], ["flow", "Cable flow", "Energy flow along the cable"], ["flow_port", "Flow + pulse", "Cable flow + port pulse"], ["sweep", "Light sweep", "Light sweep across the car"]];
    return `<div class="fxg">${items.map(([k, l, long]) => `<button class="fx ${cur === k ? "on" : ""}" data-sset="charge_fx|${k}" aria-pressed="${cur === k}" title="${esc(T(long))}"><i class="fxp"><svg viewBox="0 0 44 44" aria-hidden="true">${art[k]}</svg></i><span>${l}</span></button>`).join("")}</div>`;
  }
  _pick(key, cur, items) { return `<div class="fxg pvg">${items.map(([v, l, art]) => `<button class="fx pv ${cur === v ? "on" : ""}" data-sset="${key}|${v}" aria-pressed="${cur === v}"><i class="pvp" aria-hidden="true">${art}</i><span>${esc(T(l))}</span></button>`).join("")}</div>`; }
  _chgPreviews(c) {
    /* the card's own car photo (same colour as the card), small, so the preview shows the real result */
    const color = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black", src = `${SCRIPT_BASE}images/` + "iso/" + color + "/base.webp";
    const car = `<img class="pcar" src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
    return [
      ["line", "Line", `${car}<b class="pl line">⚡ 7.2 kW · 1h 20m · AC</b>`],
      ["text", "Text", `${car}<b class="pl txt"><em>7.2 kW</em><small>1h 20m remaining</small><small class="u">AC</small></b>`],
      ["big", "Large", `${car}<b class="pl big"><em>7.2<small>kW</small></em><small>AC · 1h 20m</small></b>`],
      ["beside", "At the port", `${car}<b class="pl port"><em>7.2 kW</em><small>1h 20m</small></b><i class="pdot"></i>`]
    ];
  }
  _tilePreviews() { /* mini copies of the real Energy tile (title, range lines, ring or half gauge), so the choice looks like the result */
    const lines = (cls) => `<span class="el"><span class="ei">${ico("bolt")}<b>101</b><small>km</small></span><span class="ei">${ico("fuel")}<b>495</b><small>km</small></span></span>`;
    const hg = (r, p) => { const d = `M${100 - r} 100A${r} ${r} 0 0 1 ${100 + r} 100`; return `<path d="${d}" pathLength="100"/><path class="v" d="${d}" pathLength="100" stroke-dasharray="${p} 100"/>`; };
    const ring = (r, p, cls) => { const k = (r * Math.SQRT1_2).toFixed(1), d = `M${(50 - k).toFixed(1)} ${(50 + +k).toFixed(1)}A${r} ${r} 0 1 1 ${(50 + +k).toFixed(1)} ${(50 + +k).toFixed(1)}`; return `<path d="${d}" pathLength="100"/><path class="v ${cls}" d="${d}" pathLength="100" stroke-dasharray="${(p * 1).toFixed(1)} 100"/>`; };
    return [
      ["ring", "Ring", `<span class="pt en"><em class="et">Energy</em>${lines()}<span class="pr"><svg viewBox="0 0 100 100" aria-hidden="true">${ring(44, 84, "")}${ring(31, 53, "f")}</svg><span class="pc"><b>84<small>%</small></b><span class="pf">${ico("fuel")}53<small>%</small></span></span></span></span>`],
      ["gauge", "Half gauge", `<span class="pt en g"><em class="et">Energy</em><svg class="phg" viewBox="0 0 200 106" aria-hidden="true">${hg(88, 84)}<g class="in">${hg(66, 53)}</g></svg><span class="pc"><b>84<small>%</small></b><span class="pf">${ico("fuel")}53<small>%</small></span></span><span class="pbo"><span class="ei">${ico("bolt")}<b>101</b><small>km</small></span><span class="ei">${ico("fuel")}<b>495</b><small>km</small></span></span></span>`]
    ];
  }
  _stp(name, val, step, unit) { const fb = DEFAULTS[name], cur = val == null ? fb : val; return `<div class="stp"><button class="mv" data-stp="${name}|-${step}" aria-label="−">${ico("minus")}</button><input type="number" step="${step}" data-set="${name}" data-num data-default="${esc(fb ?? 0)}" value="${esc(cur)}" aria-label="${esc(name)}"><b>${unit}</b><button class="mv" data-stp="${name}|${step}" aria-label="+">${ico("plus")}</button></div>`; }
  _fitTiles() { /* phones (narrow settings): everything in one column. Wider: as many tiles as fit (max 5), never leaving a single tile alone on the last row; lists use two columns */
    const NARROW = 480, sr = this.shadowRoot;
    sr.querySelectorAll(".tgrid").forEach((g) => { const n = g.children.length, w = g.clientWidth; if (!w) return; if (w < NARROW) { g.style.setProperty("--c", 1); return; } const cmax = Math.max(2, Math.min(5, Math.floor((w + 8) / 108))); let c = cmax; for (let k = cmax; k >= 2; k--) if (n % k !== 1) { c = k; break; } g.style.setProperty("--c", Math.min(c, n)); });
    sr.querySelectorAll(".list.cols").forEach((g) => { if (g.clientWidth) g.style.setProperty("--lc", g.clientWidth < NARROW ? 1 : 2); });
    sr.querySelectorAll(".pvg").forEach((g) => { const w = g.clientWidth, n = g.children.length; if (w) g.style.setProperty("--fxc", `repeat(${w >= n * 128 ? n : 2}, minmax(0,1fr))`); });
    sr.querySelectorAll(".fxg:not(.pvg)").forEach((g) => { if (g.clientWidth) { const one = g.clientWidth < NARROW; g.classList.toggle("one", one); g.style.setProperty("--fxc", one ? "minmax(0,1fr)" : "repeat(auto-fit, minmax(96px, 1fr))"); } });
  }
  _tabControls(c) {
    const conf = [["lock", "Lock"], ["unlock", "Unlock"], ["windows", "Open windows"], ["trunk", "Open trunk"], ["climate", "Climate"], ["flash", "Lights"], ["honk", "Horn"], ["find", "Locate"], ["refresh", "Refresh data"]];
    return `<h4>Climate</h4>
      ${this._opt("Climate tile", this._seg("climate_ui", c.climate_ui === "circle" ? "circle" : "steps", [["steps", "Target with − / +"], ["circle", "Large circle"]]), "Target with − / +: shows and adjusts the target temperature. Large circle: the classic tile with a big on/off button.")}
      ${this._opt("Temperature selector", this._seg("target_style", c.target_style === "bar" ? "bar" : "wheel", [["wheel", "Wheel"], ["bar", "Bar"]]), "How to set the temperature on the Climate page: a wheel or a slider.")}
      <h4>Climate on-mode</h4>
      <label class="field">Climate on-mode<input type="text" data-set="climate_on_mode" data-text value="${esc(c.climate_on_mode || "")}" placeholder="auto"></label>
      <h4>Waiting effect</h4>
      ${this._opt("While a button waits for the car", this._pick("pending_fx", ["arc", "pulse", "neon"].includes(c.pending_fx) ? c.pending_fx : "arc", [["arc", "Spinning arc", '<span class="pfxd arc"></span>'], ["pulse", "Soft pulse", '<span class="pfxd pulse"></span>'], ["neon", "Neon ring", '<span class="pfxd neon"></span>']]), "Shown around a control button until the car confirms, with Sending…, Car waking up or Confirming… below.")}
      <h4>Ask for confirmation</h4>
      ${this._tiles(conf.map(([k, l]) => ["data-conf", k, l, c.confirm.includes(k), ico("shield")]))}
      ${this._tileWide("data-tgl", "confirm_temp", "Confirm temperature change while the climate is off", "Changing the temperature turns the climate on; this prevents doing it by accident.", c.confirm_temp !== false, ico("thermo"))}
`;
  }
  _tabDiag(c) {
    const selIds = Array.isArray(c.diag) ? c.diag : DIAG.map((d) => d[0]);
    const has = (k) => this._hass?.states?.[resolveId(this._hass, c, k)];
    const dRows = this._tiles(DIAG.filter((d) => has(d[0])).map((d) => ["data-diag", d[0], esc(d[1]), selIds.includes(d[0]), icoBadge(d[2])]));
    return `<h4>Diagnostics</h4>
      ${dRows}
      <div class="btnrow"><button class="btn sm" data-dall="0">None</button><button class="btn sm" data-dall="1">All</button></div>`;
  }
  _cardPageSection() {
    const on = this._cardPageSidebar === true, admin = !!this._hass?.user?.is_admin;
    const pin = this._cardPagePin || {}, rows = this._cardPageViews || [], dsg = pin.design || "";
    const opts = [["", T("Automatic (last profile used in this browser)")], ...rows.map((r) => [r.vehicle_id + "|" + r.view_id, r.label])];
    const cur = pin.view_id ? pin.vehicle_id + "|" + pin.view_id : "";
    const mk = (attr, val, list) => `<select ${attr}${admin ? "" : " disabled"}>${list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const designs = [["", T("Card profile default")], ["mobile", T("Mobile")], ["tablet", T("Tablet")], ["energy", T("Energy")], ["minimal", T("Minimal")], ["cockpit", T("Modern Cockpit")], ["ultra", T("Ultra minimal")]];
    return `<h4>${T("Card page")}</h4><p class="hint">${T("This page always uses the profile and design chosen here, whatever is chosen elsewhere.")}</p>
      <label class="field inline">${T("Card profile")} ${mk("data-card-page-view", cur, opts)}</label>
      <label class="field inline">${T("Design")} ${mk("data-card-page-design", dsg, designs)}</label>
      <h4>${T("Sidebar")}</h4><p class="hint">${T("Shows only the card, without Companion controls. Reload the page after changing this.")}</p><div class="list"><button class="row tg${on ? " on" : ""}" data-card-page-sidebar aria-pressed="${on}"${admin ? "" : " disabled"}><span>${T("Show “Deepal Card” in the sidebar")}</span><i class="sw${on ? " on" : ""}"></i></button></div>`;
  }
  /* Data update rate: one backend setting for the whole integration (saved readings and live notification refreshes). */
  _updateRateSection() {
    const admin = !!this._hass?.user?.is_admin, cur = this._updateRate ?? 0;
    return `<h4>${T("Data update rate")}</h4><p class="hint">${T("How often Companion saves readings and updates live notifications. Live follows every change; 5 or 10 minutes saves data. The car’s own update rate is set in Deepal Alternative.")}</p>
      <div class="seg wide">${[[0, T("Live")], [300, T("5 min")], [600, T("10 min")]].map(([v, l]) => `<button data-update-rate="${v}" class="${v === cur ? "on" : ""}" aria-pressed="${v === cur}"${admin ? "" : " disabled"}>${esc(l)}</button>`).join("")}</div>`;
  }
  async _loadUpdateRate() {
    if (this._updateRate !== undefined || typeof this._hass?.callWS !== "function") return;
    try { this._updateRate = (await this._hass.callWS({ type: "deepal_companion/request", op: "update_rate_get" })).seconds || 0; } catch (_) { this._updateRate = 0; }
    this._render?.();
  }
  _paintUpdateRate() {
    this.shadowRoot?.querySelectorAll("[data-update-rate]").forEach((b) => { const on = Number(b.dataset.updateRate) === this._updateRate; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.disabled = !this._hass?.user?.is_admin; });
  }
  async _setUpdateRate(seconds) {
    const before = this._updateRate ?? 0; if (seconds === before) return;
    this._updateRate = seconds; this._paintUpdateRate();
    this.shadowRoot?.querySelectorAll("[data-update-rate]").forEach((b) => { b.disabled = true; });
    try { this._updateRate = (await this._hass.callWS({ type: "deepal_companion/request", op: "update_rate_set", data: { seconds } })).seconds; }
    catch (_) { this._updateRate = before; }
    this._paintUpdateRate();
  }
  async _loadCardPageSwitch() {
    if (this._cardPageSidebar !== undefined || typeof this._hass?.callWS !== "function") return;
    try {
      const info = await this._hass.callWS({ type: "deepal_companion/card_panel" });
      this._cardPageSidebar = !!info.sidebar; this._cardPagePin = { vehicle_id: info.vehicle_id || "", view_id: info.view_id || "", design: info.design || "" };
    } catch (_) { this._cardPageSidebar = false; }
    try {
      const cars = await this._hass.callWS({ type: "deepal_companion/request", op: "list" });
      this._cardPageViews = cars.flatMap((car) => car.views.map((v) => ({ vehicle_id: car.id, view_id: v.id, label: cars.length > 1 ? car.name + " · " + v.name : v.name })));
    } catch (_) { this._cardPageViews = []; }
    this._render?.();
  }
  async _setCardPagePin(patch) {
    const before = this._cardPagePin;
    this._cardPagePin = { ...before, ...patch };
    try { this._cardPagePin = { ...this._cardPagePin, ...(await this._hass.callWS({ type: "deepal_companion/card_panel", ...patch })) }; delete this._cardPagePin.sidebar; delete this._cardPagePin.url; }
    catch (_) { this._cardPagePin = before; }
    this._render?.();
  }
  _paintCardPage() {
    const b = this.shadowRoot?.querySelector("[data-card-page-sidebar]"); if (!b) return;
    const on = this._cardPageSidebar === true;
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.querySelector(".sw")?.classList.toggle("on", on);
    b.disabled = !this._hass?.user?.is_admin;
  }
  async _setCardPageSidebar() {
    const wanted = this._cardPageSidebar !== true, b = this.shadowRoot?.querySelector("[data-card-page-sidebar]");
    if (b) b.disabled = true;
    try { this._cardPageSidebar = !!(await this._hass.callWS({ type: "deepal_companion/card_panel", sidebar: wanted })).sidebar; }
    catch (_) { this._cardPageSidebar = !wanted; }
    this._paintCardPage();
  }
  _tabVehicle(c) {
    const ents = Object.entries(c.entities), cc = CAR_COLORS.some((x) => x[0] === c.car_color) ? c.car_color : "black";
    /* Keys still needing a mapping: not mapped by the user, and no usable automatic entity (same resolution the card uses). */
    const offered = uniq(OTHER_KEYS).filter((k) => {
      if (c.entities?.[k]) return false;
      const s = this._hass?.states?.[resolveId(this._hass, c, k)];
      return !(s && s.state !== "unavailable" && s.state !== "unknown");
    });
    if (!offered.includes(this._form.mkey)) this._form.mkey = "";
    return `${this._datalist()}${this._tabGeneral(c)}${this.mode === "app" ? this._cardPageSection() + this._updateRateSection() : ""}<h4>Vehicle setup</h4>
      <label class="field">Entity prefix (e.g. s05)<input type="text" data-set="prefix" data-text value="${esc(c.prefix)}" list="dl-pfx"></label>
      <datalist id="dl-pfx">${pfxCandidates(this._hass).map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>
      ${(() => { const e = effPrefix(this._hass, c); return e !== c.prefix ? `<p class="hint">${T("Prefix {0} not found; using {1} automatically. Edit the field to save it.", `<code>${esc(c.prefix)}</code>`, `<code>${esc(e)}</code>`)}</p>` : ""; })()}
      ${this._opt("Vehicle type", this._seg("powertrain", c.powertrain || "auto", [["auto", "Automatic"], ["phev", "Plug-in hybrid"], ["ev", "Electric"]]), "“Automatic” detects the type from the fuel sensors.")}
      ${this._orow("Battery capacity (kWh)", `<input type="number" step="0.1" data-set="battery_kwh" data-num value="${Number(c.battery_kwh) > 0 ? esc(c.battery_kwh) : ""}" placeholder="${autoKwh(this._hass, c)}">`, T("Automatic: 18.4 kWh (plug-in hybrid) or 68.8 kWh (electric). Enter a value only to change it."))}
      <div class="cvrow"><div class="cvbox"><span>Car colour</span><div class="swd" role="radiogroup" title="${esc(T("Used by the Car View image (vehicle popup and, if you choose it, the hero)."))}">${CAR_COLORS.map(([k, n, hex]) => `<button data-sset="car_color|${k}" class="${k === cc ? "on" : ""}" style="background:${hex}" title="${esc(T(n))}" aria-label="${esc(T(n))}"></button>`).join("")}</div></div>
        <label class="cvbox"><span>Wheels (Car View)</span>${this._sel("iso_wheels", ["cover", "open", "pro"].includes(c.iso_wheels) ? c.iso_wheels : "cover", [["cover", "20″ with covers"], ["open", "20″ without covers"], ["pro", "18″ Pro"]])}</label></div>
      ${this._tabTank(c)}
      <h4>Photos (hero & dashboard)</h4>
      <p class="hint">${T("Photos load from the {0} folder next to the card. Set another folder or file per photo and check that it exists.", "<code>images/car/</code>")}</p>
      <label class="field">Hero photos folder (empty = automatic)<input type="text" data-set="image_path" data-text value="${esc(c.image_path || "")}" placeholder="${esc(SCRIPT_BASE)}images/car/"></label>
      <div class="list">${Object.keys(ALL_FILES).map((k) => `<div class="chk"><span class="th" data-probe-hero="${k}"></span><div class="grow"><div>${esc(HERO_LABELS[k])}</div><input type="text" data-img="${k}" value="${esc(c.images[k] || "")}" placeholder="${esc(ALL_FILES[k])}"></div><span class="st" data-st-hero="${k}">…</span></div>`).join("")}</div>
      ${this._tabDiag(c)}
      ${this._tabTires(c)}
      <h4>New sensors</h4>
      <p class="hint">${T("When the integration adds new warnings, the card can find them and add them to diagnostics.")}</p>
      ${this._discHtml(c)}
      <h4>${esc(I18N.t("Entity mapping", []))}</h4>
      <p class="hint">${T("If an entity is not named {0}, pick the one to use here.", `<code>${esc(c.prefix)}_…</code>`)}</p>
      ${ents.length ? `<div class="list">${ents.map(([k, v]) => `<div class="row"><span data-ha-name>${esc(this._entityRoleName(k,c))}<small>${esc(v)}</small></span><button class="mv" data-delent="${esc(k)}" aria-label="${esc(I18N.t("Remove {0} override", [this._entityRoleName(k,c)]))}">${ico("trash")}</button></div>`).join("")}</div>` : ""}
      ${offered.length ? `<div class="add"><label class="field">${esc(I18N.t("Key", []))}${this._sel("_mkey", this._form.mkey, [["", I18N.t("— choose —", [])], ...offered.map((k) => [k, this._entityRoleName(k,c)])])}</label>
        <label class="field">${esc(I18N.t("Entity", []))}<ha-selector data-entity-mapping></ha-selector><small data-mapping-id>${esc(this._form.ment)}</small></label>
        <button class="btn sm" data-addent>${ico("plus")} ${esc(I18N.t("Map", []))}</button></div>` : `<p class="hint">${T("All entities were found.")}</p>`}
      <div class="note" id="note">${esc(this._note)}</div>`;
  }
  _tabTank(c) {
    return hasFuel(this._hass, c) ? `<h4>Tank</h4>
      ${this._orow("Full-tank fuel range (km)", this._num("fuel_max", c.fuel_max, "1"), "0 = automatic (940 km for the hybrid). Enter a positive value to override.")}
` : "";
  }
  _accentBlocks(c) {
    const cur = (ACCENTS.find((a) => a[0] === c.accent_color) || ACCENTS[0])[0], dark = this._hass?.themes?.darkMode !== false;
    return `<div class="swd" role="radiogroup" aria-label="${esc(T("Theme colour"))}">${ACCENTS.map(([k, n, d, l]) => `<button type="button" role="radio" aria-checked="${k === cur}" data-sset="accent_color|${k}" class="${k === cur ? "on" : ""}" style="background:rgb(${dark ? d : l})" title="${esc(T(n))}" aria-label="${esc(T(n))}"></button>`).join("")}</div>`;
  }
  _tabLook(c) {
    return `<h4>Theme colour</h4>
      <p class="hint">The main colour for icons, bars, buttons and charging effects. Status colours stay the same.</p>
      ${this._accentBlocks(c)}
      <h4>Car image (hero)</h4>

      ${this._opt("Style", this._seg("hero_style", c.hero_style === "carview" ? "carview" : "photo", [["photo", "Photos (black)"], ["carview", "Car View (colours)"]]), "Photos: dark photos with charging effects. Car View: a 3/4 render in your colour with live doors and a see-through charging view.")}
      <h4>Image size and space</h4>
      <div class="grid2"><label class="field">Image zoom${this._num("image_scale", c.image_scale, "0.05")}</label>
        <label class="field">Aspect ratio (e.g. 16 / 9)<input type="text" data-set="image_aspect" data-text value="${esc(c.image_aspect || "")}" placeholder="auto"></label></div>
      ${this._opt("Space around the car", this._sel("hero_space", HERO_SPACE[c.hero_space] ? c.hero_space : "standard", [["compact", "Compact (classic)"], ["standard", "Standard"], ["airy", "Roomy"]]), "Extra space above and below the car for the info and status. Applies to photos and Car View.")}
      <h4>Car View</h4>
      ${this._opt("View (Car View)", this._seg("hero_view", c.hero_view === "top" ? "top" : "iso", [["iso", "3/4"], ["top", "Top"]]), "The view the card opens with. The top-right button switches it on that device only. While charging, the 3/4 view shows the cable.")}
      ${this._opt("Background (Car View)", this._sel("hero_sky", ["auto", "neon", "neon-day", "neon-afternoon", "neon-night", "morning", "afternoon", "evening", "night"].includes(c.hero_sky) ? c.hero_sky : "off", [["off", "Black"], ["auto", "Automatic (time of day)"], ["neon", "Neon city (automatic)"], ["neon-day", "Neon city · Day"], ["neon-afternoon", "Neon city · Afternoon"], ["neon-night", "Neon city · Night"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["night", "Night"]]), "Black: plain dark background. Automatic: sun and hills by day, moon and stars by night (from sun.sun or the device clock). Neon city: a coastal city photo with a neon glow under the car; automatic follows the sun, or pin Day, Afternoon or Night.")}
      ${this._opt("Car side (3/4 view)", this._seg("car_side", ["driver", "passenger"].includes(c.car_side) ? c.car_side : "auto", [["auto", "Auto"], ["driver", "Driver"], ["passenger", "Passenger"]]), "Which side of the car the 3/4 view shows. Auto: the passenger side while only passenger-side doors or windows are open. Driver / Passenger: always that side; the doors, windows and signals follow it.")}
      <h4>Margins</h4>
      <div class="cvrow">
      ${this._opt("Card margins", this._seg("card_padding", c.card_padding || "normal", [["normal", "Normal"], ["half", "Half"], ["none", "None"]]), "“None”: the image goes edge to edge.")}
      ${this._opt("Popup margins", this._seg("popup_padding", c.popup_padding || "normal", [["normal", "Normal"], ["half", "Half"], ["none", "None"]]))}
      </div>
      <h4>Messages</h4>
      <div class="mrow">
      ${this._opt("Message under the status", this._seg("status_sub", c.status_sub === "off" || c.status_sub === "ticker" ? c.status_sub : "roll", [["off", "None"], ["roll", "Rolling"], ["ticker", "With dots"]]), "Under “Locked / Unlocked”: a rolling line or 3 facts (time, parked, range) with dots.")}
      ${this._opt("Message position (capsule over the image)", this._seg("toast_position", c.toast_position || "bottom", [["bottom", "Down"], ["top", "Up"]]))}
      ${this._opt("Message duration", this._seg("toast_duration", String(c.toast_duration || 5), [["3", "3 s"], ["5", "5 s"], ["8", "8 s"], ["12", "12 s"]]))}
      <div class="mtile">${this._tiles([["data-tgl", "toasts", "On-screen messages", c.toasts !== false]])}</div></div>${this._tabColours(c)}`;
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
  _orow(label, ctrl, sub) { return `<div class="orow"><details class="oi"><summary><span>${label}</span>${sub ? `<i class="qm" aria-label="More information">?</i>` : ""}</summary>${sub ? `<p>${sub}</p>` : ""}</details>${ctrl}</div>`; }
  _opt(label, ctrl, sub) { return `<div class="opt"><div class="ol">${label}${sub ? `<small>${sub}</small>` : ""}</div>${ctrl}</div>`; }
  _tg(key, on, label, sub) { return `<button class="row tg ${on ? "on" : ""}" data-tgl="${key}"><span>${label}${sub ? `<small>${sub}</small>` : ""}</span><i class="sw ${on ? "on" : ""}"></i></button>`; }
  _tabGeneral(c) {
    return `<h4>Card</h4>
      <label class="field">Card name<input type="text" data-set="name" data-text placeholder="Deepal S05" value="${esc(c.name)}"></label>
`;
  }
  _tabCharge(c) {
    const fu = hasFuel(this._hass, c);
    return `<h4>Charging details</h4>
      ${this._opt("Style", this._pick("charge_style", ["line", "text", "big", "beside"].includes(c.charge_style) ? c.charge_style : "line", this._chgPreviews(c)), "Current, time remaining and charging type as text on the image.")}
      <h4>Charging effect</h4>
      <div class="field">Charging effect on the car${this._fxCards(c.charge_fx || "flow_port")}</div>
      <h4>Energy tile</h4>
      ${this._opt("Energy tile", this._pick("energy_ui", c.energy_ui === "gauge" ? "gauge" : "ring", this._tilePreviews()), "Ring: the classic rings in the tile corner. Half gauge: battery percentage with both ranges.")}
      <div class="wtiles">
        ${this._tileWide("data-tgl", "plan_button", "Charge plan button on the Energy tile", "A clock button that opens the charge plan. The dot pulses while a plan is on. Shown only if the car has charge schedule entities.", c.plan_button !== false, ico("plan"))}
        ${this._tileWide("data-tgl", "energy_sheet", "“Energy” sheet on the tile", "Tap the Energy tile for battery, charging and driving history; long press opens the sensor. Off: a tap always opens the sensor.", c.energy_sheet !== false, ico("battery"))}
        ${this._tileWide("data-tgl", "chg_roll", "Switch between “Charging now” and time left", "While charging, the Energy tile rolls up to show the time left every few seconds.", c.chg_roll !== false, ico("refresh"))}
        ${this._tileWide("data-tgl", "charge_cost_selector", "Cost selector while charging (curve off)", "When the curve is hidden, a small location picker appears while charging. Tap the cost in the charging block to change it later.", c.charge_cost_selector !== false, ico("pin"))}
      </div>
      <h4>Charging reminder</h4>
      ${this._orow("Ask for a profile after charging at least (%)", this._stp("charge_prompt_min_gain", c.charge_prompt_min_gain, 1, "%"), "After a charge of at least this many percent, you are asked which charging profile to use. Default 3; 0 = every charge.")}
      ${this._orow("Recent charges checked for the reminder", this._stp("charge_prompt_recent", c.charge_prompt_recent, 1, ""), "How many recent charges the reminder checks, so missed ones are still offered. 1–20, default 10.")}
      <h4>Charge detection</h4>
      ${this._orow("Ignore one-off battery jumps above (%)", this._stp("charge_spike_jump", c.charge_spike_jump, 1, "%"), "A single reading this many percent above the rest is ignored until the next one confirms it. 5–50, default 20.")}
      <h4>Charging curve</h4>
      ${this._orow("A pause longer than this starts a new charge (min)", this._stp("charge_curve_gap", c.charge_curve_gap, 1, "min"), "In the live curve, a pause shorter than this keeps one charge; a longer pause starts a new one. 1–120, default 15.")}
      ${this._orow("Refresh the charging curve every (min)", this._stp("charge_curve_refresh", c.charge_curve_refresh, 1, "min"), "While charging, the curve moves to the current time this often, even without new car data. 1–60, default 5.")}
      <div class="wtiles">${this._tileWide("data-tgl", "charge_curve_missing", "Highlight missing data", "Shows gaps between readings as a lighter line with a tooltip. Off: one plain line.", c.charge_curve_missing !== false, ico("pulse"))}</div>`;
  }
  _tabColours(c) {

    const hc = (k) => hexc(c[k], DEFAULTS[k]);
    const LV = ["red", "orange", "yellow", "green"], nl = (k, l) => this._opt(l, `<div class="seg wide nlv">${LV.map((v) => `<button data-sset="${k}|${v}" class="${(LV.includes(c[k]) ? c[k] : DEFAULTS[k]) === v ? "on" : ""}"><i class="ndot" style="background:${esc(hc("lvl_" + v))}"></i>${esc(v[0].toUpperCase() + v.slice(1))}</button>`).join("")}</div>`);
    const sw = (k, l) => `<label class="sw-c"><input type="color" data-set="${k}" data-text value="${esc(hc(k))}"><span>${l}</span></label>`;
    const a = Number(c.air_t1) || 22, b = Number(c.air_t2) || 24, lo = 16, hi = 30, pc = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
    const lv = (t1, t2, t3, top = "lvl_green") => { const a = Number(t1) || 0, b = Number(t2) || 0, d = Number(t3) || 0; return `background:linear-gradient(90deg, ${hc("lvl_red")} 0 ${a}%, ${hc("lvl_orange")} ${a}% ${b}%, ${hc("lvl_yellow")} ${b}% ${d}%, ${hc(top)} ${d}% 100%)`; };
    const rowL = (k, l, bk, fk) => `<div class="lvrow${fu ? "" : " nofuel"}">${sw(k, l)}${bk ? this._num(bk, c[bk], "1") : `<i class="dash">—</i>`}${fu ? (fk ? this._num(fk, c[fk], "1") : `<i class="dash">—</i>`) : ""}</div>`;
    const fu = hasFuel(this._hass,c);
    return `<h4>Airflow colours</h4>
      <p class="hint">The airflow on the Climate tab is coloured by the target temperature. Set the limits and colours.</p>
      <div class="lvhead"><span></span><span>Up to (°C)</span><span></span></div>
      <div class="lvrow">${sw("air_c1", "Cool")}${this._num("air_t1", c.air_t1, "0.5")}<i class="dash"></i></div>
      <div class="lvrow">${sw("air_c2", "Mild")}${this._num("air_t2", c.air_t2, "0.5")}<i class="dash"></i></div>
      <div class="lvrow">${sw("air_c3", "Warm")}<i class="dash">—</i><i class="dash"></i></div>
      <div class="lvbar" style="background:linear-gradient(90deg, ${hc("air_c1")} 0 ${pc(a)}%, ${hc("air_c2")} ${pc(a)}% ${pc(b)}%, ${hc("air_c3")} ${pc(b)}% 100%)"></div>
      <h4>Level colours</h4>
      <p class="hint">${fu ? "The battery and fuel bars change colour with the level. Set the thresholds and colours." : "The battery bar changes colour with the level. Set the thresholds and colours."}</p>
      <div class="lvhead${fu ? "" : " nofuel"}"><span></span><span>Battery (%)</span>${fu ? "<span>Fuel (%)</span>" : ""}</div>
      ${rowL("lvl_red", "Red", "bat_t1", "fuel_t1")}${rowL("lvl_orange", "Orange", "bat_t2", "fuel_t2")}${rowL("lvl_yellow", "Yellow", "bat_t3", "fuel_t3")}${rowL("lvl_green", "Green", null, null)}
      <div class="lvbar" style="${lv(c.bat_t1, c.bat_t2, c.bat_t3)}"></div>
      ${fu ? `<div class="lvbar" style="${lv(c.fuel_t1, c.fuel_t2, c.fuel_t3)}"></div>` : ""}
      <h4>Notification colours</h4>
      <p class="hint">Choose which of the colours above each live notification on your phone uses.</p>
      ${nl("notify_alert_level", "Left open or unlocked")}${nl("notify_ok_level", "Closed and locked")}${nl("notify_climate_level", "Climate")}${nl("notify_charge_level", "Charging")}`;
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

  _secSplit(html) { /* a tab's markup as {head, secs:[{plain, title, html}]}, one entry per <h4> section */
    const parts = html.split("<h4>"), norm = new Map(Object.keys(SEC_MAP).flatMap((k) => [[k, k], [T(k), k]]));
    return { head: parts[0], secs: parts.slice(1).map((x) => { const cut = x.indexOf("</h4>"), title = x.slice(0, cut), plain = title.replace(/<[^>]*>/g, "").trim(); return { title, key: norm.get(plain) || plain, html: x.slice(cut + 5) }; }) };
  }
  _arrange(tab, html) { /* one tab: sections that belong to Advanced are removed, sections with the same `merge` title are joined */
    const { head, secs } = this._secSplit(html), out = [], at = new Map();
    for (const x of secs) {
      const m = SEC_MAP[x.key] || {};
      if (m.adv) continue;
      if (m.merge) { if (at.has(m.merge)) { at.get(m.merge).html += x.html; continue; } const e = { title: T(m.merge), html: x.html }; at.set(m.merge, e); out.push(e); continue; }
      out.push(x);
    }
    return head + out.map((x) => `<h4>${x.title}</h4>${x.html}`).join("");
  }
  _tabAdvanced(c) { /* the technical sections of every tab, grouped by category */
    const fns = [this._tabLayout, this._tabLook, this._tabControls, this._tabCharge, this._tabVehicle], all = [];
    for (const f of fns) all.push(...this._secSplit(f.call(this, c)).secs.filter((x) => SEC_MAP[x.key]?.adv));
    const order = Object.keys(SEC_MAP);
    all.sort((a, b) => ADV_CATS.indexOf(SEC_MAP[a.key].adv) - ADV_CATS.indexOf(SEC_MAP[b.key].adv) || order.indexOf(a.key) - order.indexOf(b.key));
    const out = [], at = new Map();
    for (const x of all) {
      const m = SEC_MAP[x.key];
      if (m.merge) { if (at.has(m.merge)) { at.get(m.merge).html += x.html; continue; } const e = { cat: m.adv, title: T(m.merge), html: x.html }; at.set(m.merge, e); out.push(e); continue; }
      out.push({ cat: m.adv, title: x.title, html: x.html });
    }
    return this._datalist() + out.map((x) => `<h4 data-cat="${esc(x.cat)}">${x.title}</h4>${x.html}`).join("");
  }

  _render() {
    const c = this._cfg;
    if (!c) return;
    if(this._tabLoading){this._renderTabLoading();return;}
    this.tab = { general: "vehicle", sections: "layout", buttons: "layout", images: "look", tires: "vehicle", sensors: "vehicle", colours: "look" }[this.tab] || this.tab; /* old tab names */
    if (!["vehicle", "layout", "look", "controls", "charge", "general", "advanced"].includes(this.tab)) this.tab = "layout";
    const body = this.tab === "advanced" ? this._tabAdvanced(c) : this._arrange(this.tab, { vehicle: () => this._tabVehicle(c), layout: () => this._tabLayout(c), look: () => this._tabLook(c), controls: () => this._tabControls(c), charge: () => this._tabCharge(c), general: () => this._tabGeneral(c) }[this.tab]());
    /* Each section is a collapsible card: a header with the title, a count of its controls and a chevron. Every section starts closed; the choice is kept in this browser only (never in the card settings). "all" expands everything. */
    const secStore = lsRead(SEC_KEY) || {}, allOpen = secStore === "all" || secStore.all === true, parts = body.split(/<h4(?: data-cat="[^"]*")?>/), cats = [...body.matchAll(/<h4(?: data-cat="([^"]*)")?>/g)].map((m) => m[1] || "");
    let lastCat = "";
    const grouped = parts[0] + parts.slice(1).map((x, i) => {
      const cut = x.indexOf("</h4>"), title = x.slice(0, cut), rest = x.slice(cut + 5), id = `${this.tab}:${title.replace(/<[^>]*>/g, "").trim()}`;
      const n = (rest.match(/\sdata-(?:set|tgl|conf|vis|hs|info|dall|update-rate|addent|discover|card-page-sidebar|card-page-view|card-page-design)(?:="|\s|>)/g) || []).length + new Set((rest.match(/\sdata-sset="[^"|]+/g) || [])).size;
      const open = allOpen || (id in secStore ? secStore[id] === true : false);
      const catHead = cats[i] && cats[i] !== lastCat ? (lastCat = cats[i], T(cats[i]) === title.replace(/<[^>]*>/g, "").trim() ? "" : `<div class="adv-cat">${esc(T(cats[i]))}</div>`) : "";
      return `${catHead}<section class="grp${open ? "" : " cl"}" data-sec="${esc(id)}"><button type="button" class="gh" aria-expanded="${open}"><h4>${title}</h4>${n > 1 ? `<span class="gn">${n}</span>` : ""}<i class="gv" aria-hidden="true"></i></button><div class="gb">${rest}</div></section>`;
    }).join("");
    const snap = UI.pillSnap(this.shadowRoot), flips = UI.flipSnap(this.shadowRoot);
    this._keepScroll(() => {
      this.shadowRoot.innerHTML = `<style>${SETTINGS_CSS}</style><div class="wrap">${this._tabs()}${grouped}</div>`;
      const flip = UI.flipPrime(this.shadowRoot, flips);
      this._bind(); this._wireTabs(); UI.pillApply(this.shadowRoot, snap);
      this.shadowRoot.querySelectorAll(".grp > .gh").forEach((h) => h.addEventListener("click", () => { const g = h.parentElement, open = g.classList.toggle("cl") === false, st = lsRead(SEC_KEY), m = st && typeof st === "object" ? { ...st } : {}; delete m.all; this.shadowRoot.querySelectorAll(".grp[data-sec]").forEach((x) => { m[x.dataset.sec] = !x.classList.contains("cl"); }); h.setAttribute("aria-expanded", String(open)); lsWrite(SEC_KEY, m); this._fitTiles?.(); }));
      this._tro?.disconnect(); const wr = this.shadowRoot.querySelector(".wrap"); this._fitTiles();
      if (wr && typeof ResizeObserver === "function") { let lw = wr.clientWidth; this._tro = new ResizeObserver(() => { if (wr.clientWidth !== lw) { lw = wr.clientWidth; this._fitTiles(); } }); this._tro.observe(wr); }
      UI.flipRun(flip);
    });
    if (this.tab === "advanced") {
      this._probe();
      if (this.mode === "app") {
        this.shadowRoot.querySelector("[data-card-page-sidebar]")?.addEventListener("click", () => this._setCardPageSidebar()); this._loadCardPageSwitch();
        this.shadowRoot.querySelectorAll("[data-update-rate]").forEach((b) => b.addEventListener("click", () => this._setUpdateRate(Number(b.dataset.updateRate)))); this._loadUpdateRate();
        this.shadowRoot.querySelector("[data-card-page-view]")?.addEventListener("change", (e) => { const [vehicle_id = "", view_id = ""] = e.target.value.split("|"); this._setCardPagePin({ vehicle_id, view_id }); });
        this.shadowRoot.querySelector("[data-card-page-design]")?.addEventListener("change", (e) => this._setCardPagePin({ design: e.target.value }));
      }
    }
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
      const g=e.target.closest?.('.grip');if(!g||(e.pointerType==='mouse'&&e.button!==0))return;
      const row=g.closest('.row'),list=row?.parentElement;if(!list)return;
      startReorder(e,g,row,list,(from,to)=>{
        const rows=[...list.children],kind=row.dataset.dk,key=this._sortKey(kind),arr=[...c[key]];
        if(kind==="sec"){const ids=rows.map(r=>r.dataset.id),[moved]=ids.splice(from,1);ids.splice(to,0,moved);return this._emit({order:keepStatus(ids)});}
        const indices=kind==='info'?rows.map(r=>arr.indexOf(r.querySelector('[data-mv]').dataset.mv.split('|')[1])):rows.map((_,i)=>i);
        const values=indices.map(i=>arr[i]),[m]=values.splice(from,1);values.splice(to,0,m);indices.forEach((index,i)=>arr[index]=values[i]);this._emit({[key]:arr});
      });
    });
    sr.addEventListener("click", (e) => {
      const t = e.target.closest("button,[data-tab]");
      if (!t) return;
      if (t.dataset.tn) { const tb = sr.querySelector(".tabs"); return tb && tb.scrollBy({ left: Number(t.dataset.tn) * Math.max(120, tb.clientWidth * 0.7), behavior: "smooth" }); }
      const d = t.dataset;
      if (d.tab) return this._navigateTab(d.tab);
      if (d.mv) {
        const [kind, id, dir] = d.mv.split("|");
        const key=this._sortKey(kind),arr=[...c[key]],custom=kind==='info_custom';
        if(kind==='sec'){const movable=arr.filter(x=>x!=='status'),a=movable.indexOf(id),b=a+Number(dir);if(a<0||b<0||b>=movable.length)return;[movable[a],movable[b]]=[movable[b],movable[a]];return this._emit({order:keepStatus(movable)});}
        const visible=kind==='info'?[...t.closest('.list').querySelectorAll('.row')].map(row=>row.querySelector('[data-mv]').dataset.mv.split('|')[1]):null;
        const i=custom?Number(id):arr.indexOf(id),j=visible?arr.indexOf(visible[visible.indexOf(id)+Number(dir)]):i+Number(dir);
        if (i < 0 || j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return this._emit({ [key]: arr });
      }
      if (d.vis) {
        const [kind, id] = d.vis.split("|"), key = kind === "sec" ? "hidden" : kind === "top" ? "top_buttons_hidden" : "buttons_hidden", s = new Set(c[key]);
        if(kind==='sec'&&id==='curve')return this._emit({hidden:c.hidden.includes('curve')?c.hidden.filter(id=>id!=='curve'):[...c.hidden,'curve']});
        if(kind==='sec'&&id==='costs')return this._emit({hidden:c.hidden.includes('costs')?c.hidden.filter(id=>id!=='costs'):[...c.hidden,'costs']});
        if(kind==='sec'&&id==='reminder')return this._emit({hidden:c.hidden.includes('reminder')?c.hidden.filter(id=>id!=='reminder'):[...c.hidden,'reminder']});
        s.has(id) ? s.delete(id) : s.add(id);
        return this._emit({ [key]: [...s] });
      }
      if (d.stp) { const [key, dl] = d.stp.split("|"), r = NUM_RANGE[key] || [0, 1e9], cur = Number(c[key] ?? DEFAULTS[key]) || 0, dir = Number(dl); let v = Math.round((cur + dir) * 100) / 100; if (key === "charge_target") v = cur === 0 && dir > 0 ? 50 : dir < 0 && cur <= 50 ? 0 : v; return this._emit({ [key]: Math.min(r[1], Math.max(r[0], v)) }); }
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
      if (d.dreset !== undefined) { this._disc = null; return this._emit({ diag_ignore: [] }); }
      if (d.dall !== undefined) return this._emit({ diag: d.dall === "1" ? DIAG.map((x) => x[0]) : [] });
      if (d.icon) { this._form.icon = d.icon; return this._render(); }
      if (d.add !== undefined) {
        const f = this._form, ent = f.entity.trim();
        if (!/^[a-z_]+\.[\w]+$/.test(ent)) { this._note = T("Enter a valid entity_id"); return this._render(); }
        let tap;try{tap=customTapConfig(f.tap||'more-info',ent,f.target||'',f.path||'',!!f.confirm);}catch(error){this._note=tError(error.message);return this._render();}
        const item = { entity: ent, label: f.label.trim(), icon: MDI_RE.test(f.mdi.trim()) ? f.mdi.trim() : f.icon, tap_action:tap };
        this._form = { ...this._form, entity: "", label: "", mdi: "",target:"",path:"",tap:"more-info",confirm:false };
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
    });
    sr.addEventListener("toggle",e=>{const d=e.target;if(d.matches?.('.custom-action-details')&&d.isConnected){this._customActionsOpen ||= new Set();d.open?this._customActionsOpen.add(d.dataset.actionEditor):this._customActionsOpen.delete(d.dataset.actionEditor);}},true);
    sr.addEventListener("change", (e) => {
      const t = e.target, d = t.dataset;
      if(d.f){this._form[d.f]=t.type==='checkbox'?t.checked:t.value;if(d.f==='tap')this._syncTapFields(t.closest('.custom-action-fields'),t.value);return;}
      if(d.customAction){const [kind,index]=d.customAction.split('|'),items=[...c[kind]],item=items[Number(index)],group=t.closest('.custom-action-fields'),value=key=>{const input=group.querySelector('[data-action-field="'+key+'"]');return input.type==='checkbox'?input.checked:input.value;};this._syncTapFields(group,value('tap'));if(['navigate','url'].includes(value('tap'))&&!value('path').trim())return;try{if(!CUSTOM_TAPS.some(([code])=>code===value('tap')))return;items[Number(index)]={...item,tap_action:customTapConfig(value('tap'),item.entity,value('target'),value('path'),value('confirm'))};return this._emit({[kind]:items});}catch(error){this._note=tError(error.message);return this._render();}}
      if (d.set === "_mkey") return;
      if (d.set) {
        let v = t.value;
        if (d.num !== undefined) { v = parseFloat(v); if (!Number.isFinite(v)) { v = Number(t.dataset.default??DEFAULTS[d.set]??0); } } if (d.set === "battery_kwh" && !(v >= 0 && v <= 500)) return; if (NUM_RANGE[d.set]) v = Math.min(NUM_RANGE[d.set][1], Math.max(NUM_RANGE[d.set][0], v));
        if (d.conv !== undefined) { const u = c.tire_unit; v = Number((u === "kPa" ? v / 100 : u === "psi" ? v / 14.5038 : v).toFixed(3)); }
        if (d.text !== undefined) { v = v.trim(); if (["image_path", "climate_on_mode", "image_aspect"].includes(d.set) && !v) v = null; if (d.set === "prefix" && !v) return; }
        return this._emit({ [d.set]: v });
      }
      if (d.img) { const m = { ...c.images }; t.value.trim() ? (m[d.img] = t.value.trim()) : delete m[d.img]; return this._emit({ images: m }); }
    });
    sr.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.f) this._form[t.dataset.f] = t.type==='checkbox'?t.checked:t.value;
      if (t.classList?.contains("rng")) { const tv = t.closest(".tgt")?.querySelector(".tv"); if (tv) tv.textContent = t.value + "%"; t.classList.remove("dim"); }
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
      this.shadowRoot.innerHTML = "";
      this.shadowRoot.appendChild(this._s);
    }
    this._s.tab = this._tab;
    this._s.hass = this._hass;
    this._s.yamlBase = this._config;
    this._s.cfg = mergeConfig(this._config, null);
  }
}


/* New persistence boundary: profiles live in Companion SQLite; dashboard YAML is identifiers only. */
/* Home Assistant can reject a request with a plain object or a code instead of an Error, for example when the
   connection drops while the app is in the background. Callers always get an Error with readable text. */
const readableError = error => {
  if (error instanceof Error && typeof error.message === "string" && error.message) return error;
  const source = error && typeof error === "object" ? error : {};
  const inner = [source.error, source.body].find(value => value && typeof value === "object") || {};
  const code = typeof error === "number" ? error : source.code ?? inner.code;
  const text = [source.message, inner.message, source.error, error].find(value => typeof value === "string" && value.trim());
  const lost = code === 3 || /connection.?lost/i.test(String(code));
  const result = new Error(text || (lost ? "Connection to Home Assistant was lost. Try again." : "Home Assistant did not answer. Try again."));
  if (code !== undefined) result.code = code;
  return result;
};
const companionRequest = (hass, owner, op, data = {}) => hass.callWS({
  type: "deepal_companion/request", op,
  vehicle_id: owner.vehicle_id, view_id: owner.view_id, data
}).catch(error => { throw readableError(error); });
function companionFacade(hass, card) {
  return new Proxy(hass, {
    get(target, key) {
      if (key === "companionRequest") return (op, data) => companionRequest(target, card._companion, op, data);
      if (key === "companionRecorderHistory") return message => target.callWS(message);
      if (key === "callWS") return async (message) => {
        const owner = card._companion;
        if (message.key?.startsWith("deepal_charge_costs_")) {
          const key=JSON.stringify(owner),bases=card._compCostsBases??=new Map();
          const remember=value=>{bases.delete(key);bases.set(key,structuredClone(value));while(bases.size>4)bases.delete(bases.keys().next().value);};
          if(message.type === "frontend/get_user_data"){
            const response=await companionRequest(target, owner, "costs_get");
            remember(response.value);return response;
          }
          if(message.type === "frontend/set_user_data"){
            const previous=bases.get(key);
            if(!previous)throw Error('Reload charging settings before saving.');
            const changes={},expected={};
            if(JSON.stringify(previous.profiles)!==JSON.stringify(message.value.profiles)){
              changes.profiles=message.value.profiles;expected.profiles=previous.profiles;
            }
            const receipts=Object.entries(message.value.sessions||{}).filter(([id,value])=>JSON.stringify(value)!==JSON.stringify(previous.sessions?.[id]));
            if(receipts.length){changes.sessions=Object.fromEntries(receipts);expected.sessions=Object.fromEntries(receipts.map(([id])=>[id,previous.sessions?.[id]??null]));}
            if(!Object.keys(changes).length)return {};
            const response=await companionRequest(target,owner,"costs_set",{changes,expected_changes:expected});
            remember(message.value);return response;
          }
        }
        if (message.type === "history/history_during_period") {
          const [native, archive] = await Promise.allSettled([
            target.callWS(message),
            companionRequest(target, owner, "history", { entity_ids: message.entity_ids, start_time: message.start_time, end_time: message.end_time })
          ]);
          if (native.status === "rejected" && archive.status === "rejected") throw archive.reason;
          const combined = {};
          const stamp = r => typeof (r.lu ?? r.lc) === "number" ? (r.lu ?? r.lc) : Date.parse(r.last_updated || r.last_changed) / 1000;
          for (const id of message.entity_ids || []) {
            const rows = [
              ...(native.status === "fulfilled" ? native.value?.[id] || [] : []),
              ...(archive.status === "fulfilled" ? archive.value?.[id] || [] : [])
            ];
            const unique = new Map(rows.map(r => [stamp(r), r]));
            combined[id] = [...unique.values()].filter(r => Number.isFinite(stamp(r))).sort((a,b)=>stamp(a)-stamp(b));
          }
          return combined;
        }
        return target.callWS(message);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
const companionOriginalHass = Object.getOwnPropertyDescriptor(DeepalS05Card.prototype, "hass").set;
const companionOriginalConnected = DeepalS05Card.prototype.connectedCallback;
const companionOriginalDisconnected = DeepalS05Card.prototype.disconnectedCallback;
function companionQueueWrite(card,hass,owner,data){
  const queues=card._compWriteQueues||(card._compWriteQueues=new Map()),key=JSON.stringify(owner);
  const revisions=card._compRevisions||(card._compRevisions=new Map());
  // The revision is read when the write runs, so queued saves chain on the previous save's result.
  const request=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
    const response=await companionRequest(hass,owner,"config_patch",{...data,expected_revision:revisions.get(key)});
    revisions.set(key,response.revision);return response;
  });
  queues.set(key,request);
  const clear=()=>{if(queues.get(key)===request)queues.delete(key);};request.then(clear,clear);
  return request;
}
DeepalS05Card.getStubConfig = () => ({ type: "custom:deepal-companion-card" });
DeepalS05Card.prototype.setConfig = function(config) {
  const previous=this._companion;
  if(previous&&previous.vehicle_id===config.vehicle_id&&previous.view_id===config.view_id){this._compInput=config;return;}
  if(previous?.vehicle_id&&this._compDirty&&this._rawHass){
    companionQueueWrite(this,this._rawHass,{...previous},{patch:{...this._local},reset:!!this._compReset})
      .catch(error=>{this._compPreviousSaveError=tError(error.message||String(error));if(this._c)this._toast(this._compPreviousSaveError,"error");});
  }
  clearTimeout(this._compTimer);
  this._compUnsubscribe?.();this._compUnsubscribe=null;
  this._compGeneration=(this._compGeneration||0)+1;
  this._compChargePrompt=null;this.shadowRoot.querySelector('.charge-assignment-prompt')?.remove();
  this._compFetching=false;this._compAgain=false;this._compSaving=false;this._compDirty=false;this._compReset=false;
  this._local={};this._remoteErr=false;this._compLastLoaded=false;this._hview=null;
  this._companion = { vehicle_id: config.vehicle_id, view_id: config.view_id };
  this._compInput = config;
  this._compConfigSignature = null;
  this._remoteLoaded = false;
  this._c = null;
  if (this._rawHass) this._loadRemote();
};
Object.defineProperty(DeepalS05Card.prototype, "hass", {
  set(hass) {
    this._rawHass = hass;
    companionOriginalHass.call(this, companionFacade(hass, this));
    if (this._companion && !this._compConfigSignature) this._loadRemote();
  }
});
DeepalS05Card.prototype._loadRemote = async function() {
  if (!this._rawHass || this._compFetching) { this._compAgain = true; return; }
  this._compFetching = true;
  const generation=this._compGeneration,owner={...this._companion};
  try {
    if (!owner.vehicle_id) {
      const list = await this._rawHass.callWS({type:"deepal_companion/request",op:"list"});
      if (!list.length) throw new Error(T("Add a vehicle in Deepal Companion first."));
      if(generation!==this._compGeneration)return;
      owner.vehicle_id = list[0].id;
    }
    const response = await companionRequest(this._rawHass, owner, "config_get");
    if(generation!==this._compGeneration)return;
    this._companion={vehicle_id:owner.vehicle_id,view_id:response.view_id};
    this._compViewName=response.view_name;
    this._compChargePrompt=response.charge_prompt||null;this._renderChargePrompt?.();
    const signature = JSON.stringify({...response,charge_prompt:undefined});
    // Local unsaved edits are never replaced by a subscription response.
    if (!this._compSaving && !this._compDirty && signature !== this._compConfigSignature) {
      this._compConfigSignature = signature;
      (this._compRevisions||(this._compRevisions=new Map())).set(JSON.stringify(this._companion),response.revision);
      this._yaml = { ...response.config, type:"custom:deepal-companion-card", ...this._companion };
      this._local = {};
      this._c = mergeConfig(this._yaml, {});
      if(!this._compLastLoaded){this._compLastLoaded=true;this._last=lsRead("deepal-s05-last:"+this._c.prefix)||this._last||{};}
      this._built = false; this._sig = null; this._remoteLoaded = true;
      this._cvReset(); this._force();
      if(this._compPreviousSaveError){this._toast(this._compPreviousSaveError,"error");this._compPreviousSaveError=null;}
    }
    if (!this._compUnsubscribe && this.isConnected) {
      const unsubscribe = await this._rawHass.connection.subscribeMessage(
        message => {
          if (message.vehicle_id !== this._companion.vehicle_id) return;
          /* A recording signal that changes nothing a card shows carries the same revision: skip the request (settings, costs and finished charges raise it). */
          if (message.revision !== undefined && message.revision === this._compSeenRevision) return;
          this._compSeenRevision = message.revision; this._loadRemote();
        },
        {type:"deepal_companion/subscribe"}
      );
      if(this.isConnected&&generation===this._compGeneration)this._compUnsubscribe=unsubscribe;else unsubscribe();
    }
  } catch (error) {
    if(generation!==this._compGeneration)return;
    this._compSeenRevision = undefined; /* a failed load must not hide the next signal */
    if (!this._c) {
      console.error("Deepal Companion could not load", error);
      const tr = (key) => window.__DEEPAL_COMPANION_UI?.t?.(key) ?? key, esc = (text) => String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      this.shadowRoot.innerHTML = '<ha-card style="padding:18px"><p style="margin:0 0 12px">' + esc(tr("Deepal Companion couldn’t load. Check that Home Assistant is reachable and try again.")) + '</p><button class="companion-retry" style="padding:8px 14px;cursor:pointer">' + esc(tr("Try again")) + '</button></ha-card>';
      this.shadowRoot.querySelector(".companion-retry")?.addEventListener("click", () => this._loadRemote());
    }
    else this._toast(tError(readableError(error).message), "error");
  } finally {
    if(generation===this._compGeneration){this._compFetching = false;
    if (this._compAgain) { this._compAgain = false; queueMicrotask(()=>this._loadRemote()); }}
  }
};
DeepalS05Card.prototype._lsKey = function() { return "deepal-companion-view:" + this._companion?.view_id; };
DeepalS05Card.prototype._saveYaml = function(reset) {
  this._compDirty = true;
  if (reset) this._compReset = true;
  clearTimeout(this._compTimer);
  this._compTimer = setTimeout(()=>this._doSaveYaml(), 300);
};
DeepalS05Card.prototype._doSaveYaml = async function() {
  if (this._compSaving || !this._rawHass || !this._compDirty) return;
  const patch = { ...this._local }, reset = !!this._compReset;
  const generation=this._compGeneration,owner={...this._companion};
  this._compReset = false; this._compSaving = true;
  try {
    const response = await companionQueueWrite(this,this._rawHass,owner,{patch,reset});
    if(generation!==this._compGeneration)return;
    // Remove only settings that still equal the saved snapshot.
    for (const key of Object.keys(patch)) if (JSON.stringify(this._local[key]) === JSON.stringify(patch[key])) delete this._local[key];
    this._compDirty = Object.keys(this._local).length > 0 || this._compReset;
    this._yaml = {...response.config,type:"custom:deepal-companion-card",...this._companion};
    this._c = mergeConfig(this._yaml, this._local);
    this._compConfigSignature = JSON.stringify({...response,charge_prompt:undefined});
    this._remoteErr = false;
    if(reset){this._built=false;this._force();}
  } catch (error) {
    if(generation!==this._compGeneration)return;
    if(/changed elsewhere/i.test(error.message||"")){
      // Another editor saved first: drop this stale copy and show what is stored now.
      this._local={};this._compDirty=false;this._compReset=false;this._remoteErr=false;this._compConfigSignature=null;
      this._toast(T("Settings changed elsewhere and were reloaded. Please repeat your change."), "error");
      queueMicrotask(()=>this._loadRemote());
    } else {
    this._remoteErr = true; this._compDirty = true;
    this._toast(T("Settings could not be saved") + ": " + tError(error.message || String(error)), "error");
    }
  } finally {
    if(generation===this._compGeneration){this._compSaving = false;
    if (this._compDirty && !this._remoteErr) this._saveYaml();}
  }
};
DeepalS05Card.prototype._saveRemote = function() { this._saveYaml(); };
DeepalS05Card.prototype.connectedCallback = function() {
  companionOriginalConnected.call(this);
  if (this._rawHass) this._loadRemote();
  this._compUnwatch?.(); this._compUnwatch = window.__DEEPAL_COMPANION_UI.watchConnection(() => this._rawHass, () => { this._force?.(); if (!this._compDirty && !this._compSaving) this._loadRemote(); }, () => {
    if (this._compDirty || this._compSaving) return; /* never drop unsaved changes */
    try { const k = "deepal_companion_reload_at", last = Number(sessionStorage.getItem(k)) || 0; if (Date.now() - last < 60000) return; sessionStorage.setItem(k, String(Date.now())); } catch (_) { return; } /* at most once a minute, shared by every card */
    location.reload();
  });
};
DeepalS05Card.prototype.disconnectedCallback = function() {
  this._compEnergyHost?.energyCleanup?.();this._compEnergyHost=null;
  clearTimeout(this._compTimer);
  this._compUnwatch?.(); this._compUnwatch = null;
  if (this._compUnsubscribe) { this._compUnsubscribe(); this._compUnsubscribe = null; }
  if (this._compDirty) this._doSaveYaml();
  companionOriginalDisconnected.call(this);
  I18N.prune();
};
const companionOriginalForce = DeepalS05Card.prototype._force;
DeepalS05Card.prototype._force = function(...args) {
  const result=companionOriginalForce.apply(this,args);
  if(this._compEnergyHost&&!this._compEnergyHost.isConnected){this._compEnergyHost.energyCleanup?.();this._compEnergyHost=null;}
  return result;
};


/* Preserve the original complete HA editor; change only its persistence boundary. */
DeepalS05Settings.prototype.disconnectedCallback = function() { I18N.prune(); };
DeepalS05CardEditor.prototype.disconnectedCallback = function() {
  this._editorGeneration=(this._editorGeneration||0)+1;
  I18N.prune();
};
const originalSettingsExport = DeepalS05Settings.prototype._exportObj;
DeepalS05Settings.prototype._exportObj = function() {
  const config=originalSettingsExport.call(this);
  if(this.yamlBase?.vehicle_id)config.vehicle_id=this.yamlBase.vehicle_id;
  if(this.yamlBase?.view_id)config.view_id=this.yamlBase.view_id;
  return config;
};
const originalEditorDraw = DeepalS05CardEditor.prototype._draw;
DeepalS05CardEditor.prototype.setConfig = function(config) {
  if(this._editorLoaded&&config.vehicle_id===this._editorOwner?.vehicle_id&&config.view_id===this._editorOwner?.view_id){this._draw();return;}
  this._editorOwner = {vehicle_id:config.vehicle_id,view_id:config.view_id};
  this._editorGeneration=(this._editorGeneration||0)+1;
  this._config = {...config};
  this._editorLoaded = false;
  this._draw();
  if(this._hass)this._editorLoad();
};
Object.defineProperty(DeepalS05CardEditor.prototype,"hass",{
  set(hass){this._hass=hass;if(this._s)this._s.hass=hass;if(!this._editorLoaded)this._editorLoad();}
});
DeepalS05CardEditor.prototype._editorLoad = async function() {
  if(!this._hass||!this._editorOwner)return;
  if(this._editorLoading){this._editorReload=true;return;}
  this._editorLoading=true;
  const generation=this._editorGeneration;
  try{
    const list=await this._hass.callWS({type:"deepal_companion/request",op:"list"});
    if(generation!==this._editorGeneration)return;
    this._editorVehicles=list;
    if(!this._editorOwner.vehicle_id){
      if(!list.length){this._editorError=T("Add your vehicle in Deepal Companion first.");this._draw();return;}
      this._editorOwner.vehicle_id=list[0].id;
    }
    const owner={...this._editorOwner};
    const response=await companionRequest(this._hass,owner,"config_get");
    if(generation!==this._editorGeneration)return;
    this._editorOwner.view_id=response.view_id;this._editorViewName=response.view_name;this._editorRevision=response.revision;
    this._config={...response.config,type:"custom:deepal-companion-card",...this._editorOwner};
    this._editorLoaded=true;this._editorError="";this._draw();
    this._editorEmit();
  }catch(error){this._editorError=tError(error.message||String(error));this._draw();console.error("Deepal Companion editor",error);}
  finally{this._editorLoading=false;if(this._editorReload){this._editorReload=false;queueMicrotask(()=>this._editorLoad());}}
};
DeepalS05CardEditor.prototype._editorEmit = function() {
  this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:{type:"custom:deepal-companion-card",...this._editorOwner}},bubbles:true,composed:true}));
};
DeepalS05CardEditor.prototype._editorSelect = function(vehicle,view) {
  this._editorOwner={vehicle_id:vehicle,view_id:view};
  this._editorGeneration=(this._editorGeneration||0)+1;
  this._editorLoaded=false;
  this._editorEmit();this._draw();this._editorLoad();
};
DeepalS05CardEditor.prototype._commit = function() {
  const snapshot=onlySettings(this._config);
  const owner={...this._editorOwner};
  this._editorSave=(this._editorSave||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!owner.vehicle_id)throw Error(T("Choose a vehicle in Deepal Companion first."));
    const response=await companionRequest(this._hass,owner,"config_patch",{patch:snapshot,expected_revision:this._editorRevision});
    this._editorRevision=response.revision;
    if(this._editorOwner.vehicle_id===owner.vehicle_id&&this._editorOwner.view_id===owner.view_id){
      this._editorOwner.view_id=response.view_id;this._editorEmit();
    }
  }).catch(error=>{console.error("Deepal Companion editor save",error);if(/changed elsewhere/i.test(error.message||""))this._editorLoad();if(this._s){this._s._note=tError(error.message||String(error));this._s._render();}});
  this._draw();
};
DeepalS05CardEditor.prototype._draw = function() {
  originalEditorDraw.call(this);
  if(!this._editorPicker){
    this._editorPicker=document.createElement("div");
    this._editorPicker.className="companion-card-picker";
    this.shadowRoot.prepend(this._editorPicker);
    this._editorPicker.addEventListener("change",event=>{
      if(event.target.name==="companion_design"){this._config={...this._config,companion_design:event.target.value,companion_width:0};this._commit();return;}
      if(event.target.name==="companion_width"){if(event.target.checkValidity()){this._config={...this._config,companion_width:Number(event.target.value)||0};this._commit();}return;}
      if(event.target.name==="companion_vehicle"){
        const car=(this._editorVehicles||[]).find(v=>v.id===event.target.value);
        if(car)this._editorSelect(car.id,car.views[0]?.id);
      }
    });
    this._editorPicker.addEventListener("click",event=>{
      const button=event.target.closest("[data-companion-view]");
      if(button)this._editorSelect(this._editorOwner.vehicle_id,button.dataset.companionView);
    });
  }
  const lang=this._hass?.locale?.language||this._hass?.language||"en";
  
  const cars=this._editorVehicles||[],car=cars.find(v=>v.id===this._editorOwner?.vehicle_id)||cars[0];
  this._editorPicker.innerHTML='<style>.companion-card-picker{margin-bottom:18px;padding:14px;border:1px solid var(--divider-color);border-radius:14px}.companion-card-picker label{display:block;font-size:12px;color:var(--secondary-text-color)}.companion-card-picker select{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:10px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}.companion-card-picker .profiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px}.companion-card-picker button{cursor:pointer;padding:12px 8px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:11px;font:inherit;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px}.companion-card-picker button[aria-pressed=true]{border-color:var(--primary-color);background:rgba(var(--ds-ok,52,211,153),.10)}.companion-card-picker p{font-size:12px;line-height:1.5;color:var(--secondary-text-color);margin:10px 0 0}.companion-card-picker .error{color:var(--error-color)}.companion-design-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.companion-design-fields input{width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}.companion-card-picker button small{font-size:10px;color:var(--secondary-text-color)}</style><label>'+esc(T("Vehicle"))+'<select name="companion_vehicle" aria-label="'+esc(T("Vehicle"))+'">'+cars.map(v=>'<option value="'+esc(v.id)+'"'+(v.id===car?.id?' selected':'')+'>'+esc(v.name)+'</option>').join("")+'</select></label><label>'+esc(T("Choose a card profile"))+'</label><div class="profiles">'+(car?.views||[]).map((v,i)=>'<button type="button" data-companion-view="'+esc(v.id)+'" aria-pressed="'+String(v.id===this._editorOwner?.view_id)+'"><ha-icon icon="'+(["mdi:cellphone","mdi:tablet-dashboard","mdi:chart-line"][i]||"mdi:card-outline")+'"></ha-icon><span>'+esc(v.name)+'</span><small>'+esc(T(/tablet/i.test(v.name)?'Wide · 960 px':/energy/i.test(v.name)?'Energy first · 720 px':'Compact · 480 px'))+'</small></button>').join("")+'</div><p>'+esc(T("The preview updates as you pick a profile. All settings stay available below."))+'</p>'+(this._editorError?'<p class="error">'+esc(this._editorError)+'</p>':'');
  if(this._editorLoaded){const design=companionDesign(this._config,this._editorViewName);this._editorPicker.insertAdjacentHTML("beforeend",'<div class="companion-design-fields"><label>'+esc(T("Design"))+'<select name="companion_design">'+["mobile","tablet","energy","minimal","cockpit","ultra"].map(kind=>'<option value="'+kind+'"'+(design.kind===kind?' selected':'')+'>'+T({mobile:"Mobile · compact · 480 px",tablet:"Tablet · landscape · 960 px",energy:"Energy · energy first · 720 px",minimal:"Minimal · compact status · 720 px",cockpit:"Modern Cockpit · image and gauges · 760 px",ultra:"Ultra minimal · one-line strip · 560 px"}[kind])+'</option>').join("")+'</select></label><label>'+esc(T("Maximum width (px)"))+'<input name="companion_width" type="number" min="280" max="1600" placeholder="'+design.width+'" value="'+(this._config.companion_width||"")+'"></label></div>');}
  if(this._s)this._s.style.pointerEvents=this._editorLoaded?"":"none";
};

const companionSettingsAppCss=':host{container-type:inline-size}.tabbar{position:static}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible;cursor:default;gap:6px}@container(max-width:639px){.tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}@container(max-width:499px){.tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:299px){.tabs{grid-template-columns:1fr}}.tabs .vpill,.tn{display:none!important}.tabs button{min-width:0;white-space:normal;min-height:46px;justify-content:flex-start;border-radius:10px;padding:9px 10px;text-align:left;font-size:12px}.tabs button .i{flex:none}.tabs.hp>button.on{background:var(--cp-on-bg);border-color:var(--cp-on-line);color:var(--cp-accent)}input:not([type=checkbox]):not([type=color]),select{height:44px;min-height:44px;max-height:44px;box-sizing:border-box}input:not([type=checkbox]):not([type=color]),select{font-size:14px}.opt{flex-wrap:wrap;gap:10px}.opt .ol{min-width:0}.seg{flex-wrap:wrap}.sw-c{min-height:44px}.sw-c input[type=color]{min-height:30px;max-height:30px;width:40px;height:30px;border-radius:6px}.lvhead,.lvrow{grid-template-columns:minmax(0,1fr) 90px 90px;gap:8px}.row{box-sizing:border-box}.row:has(>span>small){padding-top:4px;padding-bottom:4px}.swb{padding-top:0;padding-bottom:0}.row.tgnum{padding-top:0;padding-bottom:0}.seg{min-height:44px;box-sizing:border-box}.btn.sm{min-height:var(--cp-ctl-h)}.field.inline{flex-direction:column;align-items:stretch;gap:4px}@media(max-width:420px){.tabs{grid-template-columns:minmax(0,1fr)}.lvhead,.lvrow{grid-template-columns:minmax(0,1fr) 62px 62px}.lvrow input[type=number]{padding:8px 4px}.sw-c{gap:8px;font-size:12px}.sw-c input[type=color]{flex-basis:34px;width:34px}}';
/* Use HA names/selectors while keeping the stable mapping keys in storage. */
const settingsConnected=DeepalS05Settings.prototype.connectedCallback;
const settingsDisconnected=DeepalS05Settings.prototype.disconnectedCallback;
DeepalS05Settings.prototype.connectedCallback=function(){settingsConnected.call(this);I18N.subs.add(this);};
DeepalS05Settings.prototype.disconnectedCallback=function(){I18N.subs.delete(this);settingsDisconnected.call(this);};
DeepalS05Settings.prototype._force=function(){if(this.isConnected&&this._cfg)this._render();};
Object.defineProperty(DeepalS05Settings.prototype,"hass",{set(hass){this._hass=hass;if(!hass)return;I18N.request(hass.locale?.language||hass.language||"en");const picker=this.shadowRoot.querySelector("ha-selector[data-entity-mapping]");if(picker)picker.hass=hass;}});
DeepalS05Settings.prototype._entityRoleName=function(key,config){
  const id=resolveId(this._hass,config,key);
  const name=this._hass?.states?.[id]?.attributes?.friendly_name||this._hass?.entities?.[id]?.name;
  if(name)return name;
  const label=(key.split(".")[1]||key).replaceAll("_"," ");return T(label.charAt(0).toUpperCase()+label.slice(1));
};
const settingsBind=DeepalS05Settings.prototype._bind;
const settingsLayout=DeepalS05Settings.prototype._tabLayout;
DeepalS05Settings.prototype._tabLayout=function(config){
  if(this.mode==="app")return settingsLayout.call(this,config);
  const lang=this._hass?.locale?.language||"en";
  return '<h4>'+ico('sliders')+esc(T("Card design"))+'</h4>'+this._opt(T("Design"),this._sel("companion_design",config.companion_design||"",[["",T("Card profile default")],["mobile",T("Mobile")],["tablet",T("Tablet")],["energy",T("Energy")],["minimal",T("Minimal")],["cockpit",T("Modern Cockpit")],["ultra",T("Ultra minimal")]]))+this._opt(T("Maximum width (px)"),this._num("companion_width",config.companion_width||0,"1"),T("0 = automatic; otherwise 280–1600 px."))+settingsLayout.call(this,config);
};
DeepalS05Settings.prototype._bind=function(){
  settingsBind.call(this);
  window.__DEEPAL_COMPANION_UI?.enhanceChoices(this.shadowRoot,this._hass);
  {
    const style=document.createElement('style');
    style.textContent=companionSettingsAppCss+(this.mode==='app'?':host{overflow:visible;max-height:none}.hd,.tabbar{touch-action:pan-y}.settings{overflow:visible;max-height:none}':'');
    this.shadowRoot.append(style);
  }
  const picker=this.shadowRoot.querySelector("ha-selector[data-entity-mapping]");if(!picker)return;
  const setup=()=>{picker.hass=this._hass;picker.selector={entity:this._form.mkey?{domain:this._form.mkey.split(".")[0]}:{}};picker.value=this._form.ment||undefined;};
  setup();this.shadowRoot.querySelector('[data-set="_mkey"]')?.setAttribute("data-ha-name","");
  picker.addEventListener("value-changed",event=>{event.stopPropagation();this._form.ment=typeof event.detail?.value==="string"?event.detail.value:"";const note=this.shadowRoot.querySelector("[data-mapping-id]");if(note)note.textContent=this._form.ment;});
  this.shadowRoot.querySelector('[data-set="_mkey"]')?.addEventListener("change",setup);
  if(!customElements.get("ha-selector")){
    picker.hidden=true;
    const fallback=document.createElement("input");fallback.type="text";fallback.setAttribute("list","ents");fallback.value=this._form.ment;
    fallback.addEventListener("input",()=>{this._form.ment=fallback.value;});picker.after(fallback);
  }
};

/* Standard choices use the same field surface as text inputs; entity pickers stay native HA. */
class CompanionChoice extends HTMLElement {
  static live=new Set();
  static resizeStyles(){for(const picker of CompanionChoice.live)picker.syncAppearance?.();}
  constructor(){
    super();this.attachShadow({mode:'open'});I18N.watch(this.shadowRoot);this.options=[];this._value='';this._disabled=false;
    this.shadowRoot.innerHTML='<style>:host{display:block;min-width:0;width:100%}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}.field{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:var(--choice-padding,10px 12px);border:var(--choice-border,1px solid var(--ds-line,rgba(127,127,127,.35)));border-radius:var(--choice-radius,var(--cp-ctl-r,12px));background:var(--choice-background,var(--ds-soft,var(--secondary-background-color,#262626)));color:var(--choice-color,var(--ds-fg,var(--primary-text-color,#eee)));font:var(--choice-font,inherit);text-align:start}.field:focus-visible{outline:2px solid var(--primary-color,#63cba3);outline-offset:2px}.field:disabled{opacity:.5;cursor:default}.field span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chevron{flex:none;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:0 4px 4px 0;opacity:.65}.menu{position:fixed;inset:auto;margin:0;padding:5px;border:1px solid var(--divider-color,#454545);border-radius:12px;background:var(--card-background-color,#252525);color:var(--primary-text-color,#eee);box-shadow:0 12px 32px #0005;overflow:auto;overscroll-behavior:contain;z-index:10000}.menu:not(:popover-open){display:none}.option{display:block;width:100%;min-height:42px;border:0;border-radius:8px;padding:10px 12px;background:none;color:inherit;font:inherit;text-align:start;white-space:normal;overflow-wrap:anywhere}.option[aria-selected=true]{background:color-mix(in srgb,var(--primary-color,#63cba3) 18%,transparent);color:var(--primary-color,#63cba3)}.option:hover,.option:focus{outline:0;background:color-mix(in srgb,var(--primary-color,#63cba3) 12%,transparent)}</style><button class="field" type="button" aria-haspopup="listbox" aria-expanded="false"><span></span><i class="chevron" aria-hidden="true"></i></button><div class="menu" role="listbox" popover="auto"></div>';
    this.button=this.shadowRoot.querySelector('.field');this.menu=this.shadowRoot.querySelector('.menu');
    this.button.addEventListener('click',()=>this.open());
    this.button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();this.open(event.key);}});
    this.menu.addEventListener('keydown',event=>{const items=[...this.menu.querySelectorAll('button')],index=items.indexOf(this.shadowRoot.activeElement);let next;
      if(event.key==='ArrowDown')next=(index+1)%items.length;if(event.key==='ArrowUp')next=(index-1+items.length)%items.length;if(event.key==='Home')next=0;if(event.key==='End')next=items.length-1;
      if(next!==undefined){event.preventDefault();items[next]?.focus();}if(event.key==='Escape'){event.preventDefault();this.close(true);}if(event.key==='Tab')this.close(false);
    });
    this.menu.addEventListener('toggle',()=>{const open=this.menu.matches(':popover-open');this.button.setAttribute('aria-expanded',String(open));if(!open)this.close(false);});
    this.reposition=()=>{if(this.menu.matches(':popover-open'))this.position();};
    this.onPageScroll=event=>{if(!(event.composedPath?.()||[]).includes(this.menu))this.close(false);};
  }
  connectedCallback(){if(!CompanionChoice.live.size)window.addEventListener('resize',CompanionChoice.resizeStyles);CompanionChoice.live.add(this);}
  disconnectedCallback(){CompanionChoice.live.delete(this);if(!CompanionChoice.live.size)window.removeEventListener('resize',CompanionChoice.resizeStyles);this.close(false);window.removeEventListener('resize',this.reposition);this.unwatchScroll();}
  set hass(value){} set required(value){}
  set selector(value){this.options=value.select.options;this.draw();}
  set disabled(value){this._disabled=!!value;this.button.disabled=this._disabled;if(value)this.close(false);}get disabled(){return this._disabled;}
  set value(value){this._value=value;this.draw();}get value(){return this._value;}
  draw(){const selected=this.options.find(option=>option.value===this._value);this.button.querySelector('span').textContent=selected?.label||'Choose';}
  position(){const r=this.button.getBoundingClientRect(),v=window.visualViewport,height=v?.height||innerHeight,top=v?.offsetTop||0,space=height-(r.bottom-top)-10,above=r.top-top-10;
    const down=space>=Math.min(260,above),max=Math.max(80,Math.min(320,down?space:above));
    Object.assign(this.menu.style,{left:Math.max(8,Math.min(r.left,innerWidth-Math.min(r.width,innerWidth-16)-8))+'px',width:Math.min(r.width,innerWidth-16)+'px',maxHeight:max+'px',top:(down?r.bottom+5:Math.max(top+8,r.top-Math.min(this.menu.scrollHeight,max)-5))+'px'});
  }
  open(key){if(this.disabled)return;if(this.menu.matches(':popover-open'))return this.close(true);this.menu.replaceChildren();
    this.options.forEach(option=>{const button=document.createElement('button');button.type='button';button.className='option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===this.value));button.textContent=option.label;button.addEventListener('click',()=>{this._value=option.value;this.draw();this.close(true);this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:option.value},bubbles:true,composed:true}));});this.menu.append(button);});
    this.menu.showPopover();window.addEventListener('resize',this.reposition);this.watchScroll();this.position();this.button.setAttribute('aria-expanded','true');const items=[...this.menu.children];(key==='Home'?items[0]:key==='End'?items.at(-1):items.find(item=>item.getAttribute('aria-selected')==='true')||items[0])?.focus();
  }
  watchScroll(){
    this.unwatchScroll();this.scrollRoots=new Set([window]);
    for(let node=this;node;){const root=node.getRootNode();this.scrollRoots.add(root);node=root.host||null;}
    for(const root of this.scrollRoots)root.addEventListener('scroll',this.onPageScroll,true);
  }
  unwatchScroll(){for(const root of this.scrollRoots||[])root.removeEventListener('scroll',this.onPageScroll,true);this.scrollRoots=null;}
  close(focus){if(this.menu.matches(':popover-open'))this.menu.hidePopover();window.removeEventListener('resize',this.reposition);this.unwatchScroll();this.button.setAttribute('aria-expanded','false');if(focus&&this.isConnected)this.button.focus();}
}
if(!customElements.get('deepal-companion-choice'))customElements.define('deepal-companion-choice',CompanionChoice);
/* Phone back from the background: checks the Home Assistant connection, reconnects when it is dead and then lets the page reload its data. Returns a function that removes every listener. */
function watchConnection(getHass, onResume, onDead) {
  let hiddenAt = document.hidden ? Date.now() : 0, timer = null, busy = false, conn = null;
  const settle = async (force) => {
    if (busy || document.hidden) return; busy = true;
    try {
      const c = getHass()?.connection; if (!c) return;
      let alive = true;
      try { await Promise.race([c.ping(), new Promise((_, no) => setTimeout(() => no(new Error("ping")), 5000))]); } catch (_) { alive = false; }
      const wasDead = !alive;
      if (!alive) {
        try { c.reconnect(true); } catch (_) {}
        /* Some phones never bring the socket back after the app slept. Give it ~10 s, then let the owner reload the page (what a manual refresh does). */
        if (onDead) {
          for (let i = 0; i < 5 && !alive && !document.hidden; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            try { await Promise.race([c.ping(), new Promise((_, no) => setTimeout(() => no(new Error("ping")), 3000))]); alive = true; } catch (_) {}
          }
          if (!alive && !document.hidden) { onDead(); return; }
        }
      }
      if (wasDead || force) onResume();
    } finally { busy = false; }
  };
  const later = (force) => { clearTimeout(timer); timer = setTimeout(() => settle(force), 400); };
  const onVisible = () => { if (document.hidden) { hiddenAt = Date.now(); return; } const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0; later(away > 20000); };
  const onReady = () => { if (!document.hidden) onResume(); };
  const onOnline = () => later(true), onShow = (e) => { if (e.persisted) later(true); };
  document.addEventListener("visibilitychange", onVisible); window.addEventListener("online", onOnline); window.addEventListener("pageshow", onShow);
  const attach = () => { const c = getHass()?.connection; if (c && c !== conn) { conn?.removeEventListener?.("ready", onReady); conn = c; conn.addEventListener?.("ready", onReady); } };
  attach(); const poll = setInterval(attach, 30000);
  return () => { clearTimeout(timer); clearInterval(poll); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onOnline); window.removeEventListener("pageshow", onShow); conn?.removeEventListener?.("ready", onReady); conn = null; };
}
/* The application mounts the complete existing settings UI directly, without a card/modal. */
/* SETTINGS-APPLY CONTRACT (one model for every surface; it changes only WHEN something is stored, never WHAT).
 *  1. Preferences and switches (card toggles, Settings, Preconditioning, Notifications) apply immediately: the change shows
 *     at once and is saved quietly (debounced), with "Saved" feedback. There is no Save button for them. Where a surface
 *     can offer it, a mistaken change is reversible with Undo (the notification board does today).
 *  2. Records that are created or edited as a whole (charging profiles, tariffs, receipts, schedules) keep an explicit
 *     Save / Cancel, because a half-typed price or time must never be stored or recalculate costs. Leaving such a form
 *     with unsaved changes asks first ("Save or cancel your changes first.").
 *  3. Commands that act on the car are never applied by a settings change; they run from their own button and honour
 *     config.confirm.
 * A new setting follows rule 1 unless it edits a record (rule 2). */
window.__DEEPAL_COMPANION_UI = {
  readableError,
  watchConnection,
  /* the sliding pill of a .seg group (the same code as the card's Car view choices) */
  pill: (box, prev, now) => UI.pill(box, prev, now),
  /* snapshot before a group is redrawn, apply after: the same pair the card's Settings use (keyed by the first button's data-sset or data-k) */
  pillSnap: (root) => UI.pillSnap(root),
  pillApply: (root, snap) => UI.pillApply(root, snap),
  pillKey: (box) => UI.pillKey(box),
  /* Pages outside the card (dashboard, notifications) use the same translation dictionary as the card. */
  watchLanguage(root) { I18N.watch(root); },
  t: (s, ...a) => I18N.t(s, a),
  tError,
  settingsTag: SETTINGS_TAG,
  version: CARD_VERSION,
  credit: CARD_CREDIT,
  normalize: config => mergeConfig(config, {}),
  resolveId,
  format: hass => haFmt(hass),
  loadEnergy,
  notificationContext: {T, resolveId, TIRES, DIAG, OPEN_ITEMS},
  settingsCss: SETTINGS_CSS,
  settingsAppCss: companionSettingsAppCss,
  loaderCss: LOADER_CSS,
  loaderHtml,
  startReorder, mountChartZoom,
  applyPalette(element,config={}){
    const colors={ok:UI.hex2rgb(config.lvl_green||DEFAULTS.lvl_green,'52,211,153'),warn:UI.hex2rgb(config.lvl_yellow||DEFAULTS.lvl_yellow,'250,204,21'),bad:UI.hex2rgb(config.lvl_red||DEFAULTS.lvl_red,'248,113,113'),info:'121,173,255'};
    for(const [key,value]of Object.entries(colors)){element.style.setProperty('--companion-'+key,value);element.style.setProperty('--ds-'+key,value);}
  },
  design: (config,name) => companionDesign(config,name),
  enhanceChoices(root,hass){
    if(!root)return;
    for(const select of root.querySelectorAll('select')){
      if(!select._compPicker&&!customElements.get('deepal-companion-choice'))continue;/* keep the native select usable until the custom picker exists */
      select.style.colorScheme=hass?.themes?.darkMode===false?'light':'dark';
      let picker=select._compPicker;
      if(!picker){
        picker=document.createElement('deepal-companion-choice');picker.dataset.companionChoice='';select._compPicker=picker;
        picker.style.cssText='display:block;min-width:0;width:100%;';select.after(picker);select.hidden=true;
        picker.syncAppearance=()=>{if(!select.isConnected)return;const appearance=getComputedStyle(select);for(const [key,value]of Object.entries({'padding':appearance.padding,'border':appearance.border,'radius':appearance.borderRadius,'background':appearance.backgroundColor,'color':appearance.color,'font':appearance.font}))picker.style.setProperty('--choice-'+key,value);picker.style.marginTop=appearance.marginTop;};
        requestAnimationFrame(()=>picker.syncAppearance());
        const label=select.closest('label')?.childNodes[0]?.textContent?.trim()||select.getAttribute('aria-label')||select.name||'Choose';picker.button.setAttribute('aria-label',label);
        select.style.setProperty('display','none','important');
        select.addEventListener('change',()=>{picker.value=select.value;});
        picker.addEventListener('value-changed',event=>{event.stopPropagation();const value=event.detail?.value;if(typeof value==='string'&&[...select.options].some(option=>option.value===value)&&value!==select.value){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
      }
      picker.syncAppearance();
      picker.hass=hass;picker.required=true;picker.disabled=select.disabled;
      picker.selector={select:{options:[...select.options].map(option=>({value:option.value,label:T(option.textContent)})),mode:'dropdown'}};
      picker.value=select.value;
      const expected=select.value;
      Promise.resolve(picker.updateComplete).then(()=>{if(select.isConnected&&select.value===expected)picker.value=expected;});
    }
  },
  /* Lamp demos (preview only, simulated sensors): each step lasts a few seconds. l = left signal, r = right signal, p = position lamp (DRL), b = low beam, h = high beam */
  LAMP_DEMOS:{
    signals:[{l:1},{},{r:1},{},{l:1,r:1},{}],
    lights:[{p:1},{p:1,b:1},{p:1,b:1,h:1},{p:1,b:1,l:1},{p:1,b:1,r:1},{p:1,b:1,h:1,l:1,r:1},{p:1,b:1,l:1,r:1},{}]
  },
  /* Demo timeline: the Light show first opens all windows (3 s), plays the lamp steps, then closes the windows at a normal pace (6 s) and starts again. t = ms since the demo began */
  DEMO_STEP_MS:2600,DEMO_OPEN_MS:3000,DEMO_CLOSE_MS:6000,
  demoAt(mode,t=0){
    const steps=this.LAMP_DEMOS[mode]||[{}],n=steps.length,ms=this.DEMO_STEP_MS;
    if(mode!=='lights'){const i=Math.floor(t/ms)%n;return {lamp:steps[i]||{},w:0,i};}
    const op=this.DEMO_OPEN_MS,cl=this.DEMO_CLOSE_MS,show=n*ms,u=t%(op+show+cl),ease=x=>x*x*(3-2*x);
    if(u<op)return {lamp:{},w:Math.round(100*ease(u/op)),i:-1};
    if(u<op+show){const i=Math.floor((u-op)/ms);return {lamp:steps[i]||{},w:100,i};}
    return {lamp:{},w:Math.round(100*ease(1-(u-op-show)/cl)),i:-2};
  },
  previewHass(hass,config,mode,interactive=false,card=null){
    const scenario=JSON.stringify([mode,config.prefix,config.entities]);
    if(card&&card._previewScenario!==scenario){card._previewScenario=scenario;card._previewScenarioTime=new Date().toISOString();}
    const states=mode==='live'?hass.states:{...hass.states},now=card?._previewScenarioTime||new Date().toISOString();
    const put=(key,value,attributes={})=>{const id=resolveId(hass,config,key);states[id]={...(states[id]||{}),entity_id:id,state:String(value),attributes:{...(states[id]?.attributes||{}),...attributes},last_changed:now,last_updated:now};};
    if(mode!=='live'){
      OPEN_ITEMS.forEach(([key])=>put(key,'off'));DIAG.forEach(([key])=>put(key,'off'));
      put('lock.doors','locked');put('binary_sensor.cloud_connection','on');
      const sim=mode==='limit-wait'?'ac':mode==='limit-stop'?'plugged':mode,charging=sim==='ac'||sim==='dc',plugged=charging||sim==='plugged'||sim==='complete';
      put('binary_sensor.charging',charging?'on':'off');put('binary_sensor.charger_plugged',plugged?'on':'off');
      put('sensor.battery_level',mode==='complete'?100:mode==='limit-stop'?80:68,{unit_of_measurement:'%'});
      put('sensor.ac_charge_current',sim==='ac'?16:0,{unit_of_measurement:'A'});put('sensor.dc_charge_current',sim==='dc'?120:0,{unit_of_measurement:'A'});put('sensor.charge_current',sim==='ac'?16:0,{unit_of_measurement:'A'});
      put('sensor.charging_type',sim==='dc'?'DC':plugged?'AC':'');put('sensor.remaining_charge_time_h_mm',charging?(sim==='dc'?'00:25':'01:20'):'00:00');
      put('sensor.last_updated',now);put('binary_sensor.climate_on',mode==='climate'?'on':'off');put('climate.cabin_climate',mode==='climate'?'cool':'off',{temperature:22,current_temperature:28,hvac_action:mode==='climate'?'cooling':'off',hvac_modes:['off','auto','cool','heat'],min_temp:16,max_temp:30});
      if(mode==='alerts'){put('binary_sensor.tire_pressure_warning','on');put('binary_sensor.12_v_battery_warning','on');}
      const demo=this.demoAt(mode,card?._demoT||0),lamp=demo.lamp;
      if(mode==='lights'&&(lamp.l||lamp.r))for(const sd of ['left','right'])put(`binary_sensor.front_${sd}_door`,'on'); /* the front doors open while the signals flash, so both mirrors show theirs */
      if(this.LAMP_DEMOS[mode]&&mode==='lights')for(const p of ['front','rear'])for(const sd of ['left','right'])put(`sensor.${p}_${sd}_window_opening`,demo.w,{unit_of_measurement:'%'});
      for(const [key,flag] of [['position_lamp','p'],['low_beam','b'],['high_beam','h'],['left_turn_signal','l'],['right_turn_signal','r']])put('binary_sensor.'+key,lamp[flag]?'on':'off');
      put('cover.trunk',mode==='doors'?'open':'closed',{current_position:mode==='doors'?100:0});
      if(mode==='doors')OPEN_ITEMS.filter(([key])=>/_door$/.test(key)||/\.(hood|trunk)$/.test(key)).forEach(([key])=>put(key,'on'));
    }
    return new Proxy(hass,{get(target,key){
      if(key==='states')return states;
      if(key==='callService')return async(domain,service,data={},targetData={})=>{
        if(!interactive)throw new Error(I18N.t('Enable preview clicks first.',[]));
        if(mode==='live')return target.callService(domain,service,data,targetData);
        const ids=targetData.entity_id||data.entity_id||[],list=Array.isArray(ids)?ids:[ids];
        for(const id of list){
          const old=states[id]||{entity_id:id,state:'off',attributes:{}};let value=old.state,attributes={...old.attributes};
          if(domain==='lock')value=service==='unlock'?'unlocked':'locked';
          if(domain==='climate'){if(service==='turn_off')value='off';else if(service==='set_hvac_mode')value=data.hvac_mode;else if(service==='turn_on')value='cool';if(data.temperature!==undefined)attributes.temperature=data.temperature;put('binary_sensor.climate_on',value==='off'?'off':'on');}
          if(domain==='cover')value=service.includes('open')?'open':service.includes('close')?'closed':value;
          if(domain==='switch')value=service==='turn_off'?'off':'on';
          states[id]={...old,state:value,attributes,last_changed:new Date().toISOString(),last_updated:new Date().toISOString()};
        }
        card?._force();
      };
      if(key==='callWS')return message=>{
        if(!interactive&&!message.type?.startsWith('history/')&&message.type!=='recorder/statistics_during_period'&&!(mode==='live'&&message.type==='deepal_companion/request'&&['sessions_page','costs_get'].includes(message.op)))return Promise.reject(new Error(I18N.t('The preview is read-only.',[]))); /* reading the recorded history is allowed: the card uses it for the real lock and engine times */
        if(mode==='live')return target.callWS(message);
        const read=message.type?.startsWith('history/')||message.type?.endsWith('/list')||message.type==='frontend/get_user_data'||(message.type==='deepal_companion/request'&&['list','config_get','costs_get','history','sessions','summary','charge_prompt','session_curve'].includes(message.op));
        return read?target.callWS(message):Promise.reject(new Error(I18N.t('Demo mode does not save vehicle or charging data.',[])));
      };
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});
  },
  applyPreview(card,hass,mode='live',interactive=card?._previewCanClick||false){
    if(!card||!hass)return;
    if(card._previewMode!==mode)card._previewChargePromptDone=false;
    if(mode==='charge-detected'&&!card._previewChargePromptDone){if(!card._compChargePrompt)card._compChargePrompt={id:'preview-charge',s:Date.now()-3600000,e:Date.now(),from:58,to:68,gain:10,kwh:1.84,live:false,profiles:[{id:'home',name:'Home',price:.25,free:false},{id:'work',name:'Work',price:0,free:true},{id:'ionity',name:'IONITY',price:.5,free:false}]};}
    else card._compChargePrompt=null;
    card._previewSourceHass=hass;card._previewMode=mode;
    card._last={...(mode==='live'?card._previewInitialLast:{})};card._previewCanClick=interactive;card._isCompanionPreview=true;
    card.inert=!interactive;card.toggleAttribute('aria-hidden',!interactive);card.style.pointerEvents=interactive?'auto':'none';
    if(this.LAMP_DEMOS[mode]){
      if(card._demoMode!==mode){clearInterval(card._demoTimer);card._demoMode=mode;card._demoT=0;card._demoSig='';
        card._demoTimer=setInterval(()=>{if(!card.isConnected||card._previewMode!==mode||!card._previewSourceHass){clearInterval(card._demoTimer);card._demoTimer=null;card._demoMode=null;return;}card._demoT=(card._demoT||0)+150;const d=this.demoAt(mode,card._demoT),sig=d.i+':'+d.w;if(sig===card._demoSig)return;card._demoSig=sig;card.hass=this.previewHass(card._previewSourceHass,card._c,mode,card._previewCanClick,card);},150);}
    }else if(card._demoTimer){clearInterval(card._demoTimer);card._demoTimer=null;card._demoMode=null;card._demoT=0;}
    card.hass=this.previewHass(hass,card._c,mode,interactive,card);
  },
  preview(hass,owner,config) {
    const card=document.createElement(TAG);
    card.setConfig({type:"custom:"+TAG,...owner});
    card._loadRemote=async()=>{};
    card._saveYaml=card._doSaveYaml=card._saveRemote=()=>{};
    card._watchChanges=()=>{};
    card._previewInitialLast={...card._last};
    card._n=function(key){const raw=this._s(key),value=raw===null?null:parseFloat(raw);return Number.isFinite(value)?value:null;};
    card._nl=function(key){return {v:this._n(key),stale:false};};
    card._compConfigSignature="read-only-preview";card._remoteLoaded=true;
    card._compViewName=config.companion_design||"mobile";
    card._yaml={...config,type:"custom:"+TAG,...owner};card._local={};
    card._c=mergeConfig(card._yaml,{});card._built=false;card._sig=null;
    card.inert=true;card.setAttribute("aria-hidden","true");
    card.style.width="960px";card.style.pointerEvents="none";
    this.applyPreview(card,hass,'live');
    return card;
  },
  updatePreview(card,config) {
    if(!card)return;
    if(card._c?.hero_view!==config.hero_view)card._hview=null;
    card._yaml={...config,type:"custom:"+TAG,...card._companion};card._local={};
    card._c=mergeConfig(card._yaml,{});card._built=false;card._sig=null;
    if(card._previewSourceHass)this.applyPreview(card,card._previewSourceHass,card._previewMode);else card._force();
  },
  context(hass, owner, config, existing=null) {
    I18N.request(hass.locale?.language || hass.language || "en");
    const context = existing || {_companion:{...owner},_c:mergeConfig(config,{})};
    context._hass = companionFacade(hass, context);
    context._battKwh = () => Number(context._c.battery_kwh)>0 ? Number(context._c.battery_kwh) : autoKwh(hass,context._c);
    return context;
  }
};

/* User preferences have direct menus; only technical configuration is Advanced. */
window.__DEEPAL_COMPANION_UI.mountAppSettings=(panel,stage,widget)=>{
  stage.innerHTML='<section class="app-settings-editor"></section>';
  widget.mode='app';
  widget._render();
  stage.querySelector('.app-settings-editor').append(widget);
};
window.__DEEPAL_COMPANION_UI.updateAppSettings=panel=>panel.updatePreviewNote?.();

/* Companion-only layouts; the retained card controls and settings remain intact. */
const companionBellBuild=DeepalS05Card.prototype._build;
DeepalS05Card.prototype._build=function(...args){this._dgDrawn=null;return companionBellBuild.apply(this,args);};
const companionDesign = (config={},name="") => {
  const kind=["mobile","tablet","energy","minimal","cockpit","ultra"].includes(config.companion_design)?config.companion_design:/tablet/i.test(name)?"tablet":/energy/i.test(name)?"energy":"mobile";
  return {kind,width:Number(config.companion_width)>0?Math.min(1600,Math.max(280,Number(config.companion_width))):{mobile:480,tablet:960,energy:720,minimal:720,cockpit:760,ultra:560}[kind]};
};
const companionDesignCss = `
:host{width:100%;margin-inline:auto;container-type:inline-size}
ha-card[data-companion-design]{position:relative}
.sheet{pointer-events:none;background:transparent;overscroll-behavior:auto}
.sheet>.box{pointer-events:none;box-shadow:0 14px 60px #0009}.sheet.show>.box{pointer-events:auto}
ha-card[data-companion-design=energy]{display:flex;flex-direction:column}
ha-card[data-companion-design=energy]>.hero{order:1!important}
ha-card[data-companion-design=energy]>.stats{order:0!important}
ha-card[data-companion-design=energy]>.actions{order:2!important}
ha-card[data-companion-design=energy]>.info{order:3!important}
ha-card[data-companion-design=energy]>.diag{order:4!important}
ha-card[data-companion-design=energy]>.charge{order:5!important}
ha-card[data-companion-design=energy]>.foot{order:7!important}
.companion-cost-launch{display:flex;align-items:center;gap:12px;align-self:stretch;min-width:0;margin:0;padding:14px;border:1px solid var(--ds-line);border-radius:var(--ds-tr,22px);background:var(--ds-soft);color:var(--ds-fg);font:inherit;text-align:left;cursor:pointer}
.companion-cost-launch .cost-icon{display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:11px;background:rgba(var(--ds-ac),.12);color:rgb(var(--ds-ac));font-size:23px;font-weight:600}.companion-cost-launch .cost-label{min-width:0;flex:1}.companion-cost-launch b{display:block;font-size:14px;font-weight:600}.companion-cost-launch small{display:block;margin-top:3px;color:var(--ds-fg2);font-size:11px}.companion-cost-launch>.i{--is:18px;color:var(--ds-fg2)}
.charge-assignment-prompt{padding:14px;border:1px solid rgba(var(--ds-ac),.3);border-radius:var(--ds-tr,22px);background:rgba(var(--ds-ac),.06)}.charge-prompt-title{display:flex;align-items:center;gap:8px;font-size:13px}.charge-prompt-title .i{--is:20px;color:rgb(var(--ds-ac))}.charge-prompt-title>span{margin-left:auto;color:rgb(var(--ds-ac));font-weight:600}.charge-assignment-prompt p{font-size:12px;color:var(--ds-fg2);margin:8px 0 12px;line-height:1.5}.charge-prompt-profile{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.charge-prompt-profile select{min-width:0;width:100%;padding:10px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg)}.charge-assignment-prompt button{min-height:38px;padding:8px 10px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;font-size:12px;cursor:pointer}.charge-assignment-prompt button:disabled{opacity:.4}.charge-prompt-actions{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.charge-prompt-actions button{background:transparent;color:var(--ds-fg2)}.charge-prompt-profile>button{color:rgb(var(--ds-ac));border-color:rgba(var(--ds-ac),.3)}.charge-cost-live{box-sizing:border-box;min-width:0;display:flex;align-items:center;gap:10px;padding:6px 10px;border:1px solid rgba(var(--ds-ac),.3);border-radius:14px;background:rgba(var(--ds-ac),.06);grid-column:1/-1}.charging-curve-block .charge-cost-live{margin-top:8px;padding:8px 0 0;border:0;border-top:1px solid var(--ds-line);border-radius:0;background:none}.charge-cost-live>.i{--is:20px;flex:none;color:rgb(var(--ds-ac))}.cc-main{display:flex;align-items:baseline;gap:8px;min-width:0;flex:1 1 auto}.cc-amount{font-size:16px;font-weight:700;color:var(--ds-fg);white-space:nowrap}.cc-sub{font-size:12px;color:var(--ds-fg2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.charge-cost-live.pick .cc-main{flex:none}.charge-cost-live.pick .cc-sub{display:none}.charge-cost-live select{box-sizing:border-box;min-width:0;min-height:44px;padding:12px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;font-size:14px}.charge-cost-live deepal-companion-choice{flex:1 1 140px;min-width:0}.charge-cost-live button{box-sizing:border-box;min-height:44px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;cursor:pointer}.charge-cost-live .cc-icon{flex:none;width:44px;min-width:44px;padding:0;display:grid;place-items:center}.charge-cost-live .cc-icon .i{--is:20px}.charge-cost-live button:disabled{opacity:.4;cursor:default}.charge-cost-live [data-cc=save]{color:rgb(var(--ds-ac));border-color:rgba(var(--ds-ac),.3)}ha-card[data-companion-design=energy]>.charge-cost-live{order:6!important}.cg-cost{display:flex;min-width:0}.cg-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;min-height:44px;max-width:100%;padding:0 12px;border:1px solid rgba(var(--ds-ac),.3);border-radius:12px;background:rgba(var(--ds-ac),.08);color:var(--ds-fg);font:inherit;font-size:14px}button.cg-chip{cursor:pointer}.cg-chip .i{--is:18px;color:rgb(var(--ds-ac));flex:none}.cg-chip b{font-weight:700;white-space:nowrap}.cg-chip small{font-size:12px;color:var(--ds-fg2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@keyframes cc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes cc-out{from{opacity:1;max-height:90px;transform:none}to{opacity:0;max-height:0;padding-top:0;padding-bottom:0;margin-top:0;border-width:0;transform:translateY(-6px)}}.charge-cost-live{animation:cc-in .24s ease-out}.charge-cost-live.leaving{overflow:hidden;pointer-events:none;animation:cc-out .3s ease-in forwards}@media (prefers-reduced-motion:reduce){.charge-cost-live,.charge-cost-live.leaving{animation-duration:.01s}}
ha-card[data-companion-design=ultra]>.hero,ha-card[data-companion-design=ultra]>.actions,ha-card[data-companion-design=ultra]>.stats,ha-card[data-companion-design=ultra]>.info,ha-card[data-companion-design=ultra]>.diag,ha-card[data-companion-design=ultra]>.companion-cost-launch,ha-card[data-companion-design=minimal]>.hero,ha-card[data-companion-design=minimal]>.actions,ha-card[data-companion-design=minimal]>.stats,ha-card[data-companion-design=minimal]>.info,ha-card[data-companion-design=minimal]>.diag,ha-card[data-companion-design=minimal]>.companion-cost-launch{display:none!important}
ha-card[data-companion-design=cockpit]{display:flex;flex-direction:column}
ha-card[data-companion-design=cockpit]>.stats{display:none!important}
ha-card[data-companion-design=cockpit] .hero .total{display:none}
ha-card[data-companion-design=cockpit]>.hero{order:0!important}
ha-card[data-companion-design=cockpit]>.dz{order:1}
ha-card[data-companion-design=cockpit]>.actions{order:2!important}
ha-card[data-companion-design=cockpit]>.info{order:3!important}
ha-card[data-companion-design=cockpit]>.diag{order:4!important}
ha-card[data-companion-design=cockpit]>.charge{order:5!important}
ha-card[data-companion-design=cockpit]>.companion-cost-launch{order:6!important}
ha-card[data-companion-design=energy]>.hero,ha-card[data-companion-design=cockpit]>.hero{width:100%;aspect-ratio:3/2!important;max-height:340px}
ha-card[data-companion-design=energy] .hbox,ha-card[data-companion-design=cockpit] .hbox{top:0;bottom:0}
ha-card[data-companion-design=energy] .stage img,ha-card[data-companion-design=cockpit] .stage img{object-fit:contain;object-position:50% 50%}
ha-card[data-companion-design=energy] .cvi,ha-card[data-companion-design=cockpit] .cvi{width:100%;height:auto;--ds-cvs:1}
ha-card[data-companion-design=cockpit]>.info{display:flex!important;flex-wrap:wrap;gap:8px;overflow:visible!important}
ha-card[data-companion-design=cockpit]>.info .tile{min-width:0;width:auto;flex:1 1 140px}


.dz{position:relative;min-width:0;color:var(--ds-fg)}
.dz .i{--is:16px;width:var(--is);height:var(--is);display:inline-flex;flex:none;color:inherit}
.dz .big{font-size:48px;font-weight:700;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.dz .big small{font-size:16px;font-weight:500;margin-left:5px;color:var(--ds-fg2);letter-spacing:0}
.dz .cap{font-size:12px;color:var(--ds-fg2);margin-top:4px}
.dz-rings{display:flex;gap:14px;align-items:flex-start;cursor:pointer;border-radius:16px;outline-offset:3px;flex:none}
.dz-rings:focus-visible,.dz-gw:focus-visible{outline:2px solid rgb(var(--ds-ac))}
.dz-ring{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:68px}
.dz-ring .rw{position:relative;width:68px;height:68px;flex:none}
.dz-ring svg{display:block;width:100%;height:100%}
.dz-ring circle{fill:none;stroke-width:6}
.dz-ring .rt{stroke:var(--ds-line)}
.dz-ring .rv{stroke:rgb(var(--rg));stroke-linecap:round;transition:stroke-dasharray .6s ease}
.dz-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
.dz-ring b small{font-size:10px;font-weight:500;margin-left:1px;color:var(--ds-fg2);align-self:center;margin-top:2px}
.dz-ring .rl{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--ds-fg2);white-space:nowrap}
.dz-ring .rl .i{--is:13px;color:rgb(var(--rg))}
.dz-ring.chg .rv,.dz-ga.chg{animation:dzpulse 2.4s ease-in-out infinite}
@keyframes dzpulse{50%{opacity:.55}}
@media(prefers-reduced-motion:reduce){.dz-ring.chg .rv,.dz-ga.chg{animation:none}.dz-ring .rv,.dz-ga{transition:none!important}}
.dz-lock{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:99px;font-size:13px;font-weight:500;color:rgb(var(--st-c,var(--ds-ac)));background:rgba(var(--st-c,var(--ds-ac)),.14);flex:none;white-space:nowrap}
.dz-chip[data-ent],[data-dz-lock]{cursor:pointer}.dz-chip[data-ent]:hover{background:var(--ds-line)}.dz-chip:focus-visible,[data-dz-lock]:focus-visible{outline:2px solid rgb(var(--ds-ac));outline-offset:2px}
.dz-chip{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 12px;border-radius:12px;background:var(--ds-soft);border:1px solid var(--ds-line);font-size:13px}
.dz-chip .i{color:var(--ds-fg2)}.dz-chip .k{color:var(--ds-fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dz-chip b{margin-left:auto;font-weight:600;white-space:nowrap}
.dz-min{display:flex;flex-direction:column;gap:16px;padding:20px 24px 14px}
.dz-min .mh{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
.dz-min .n{font-size:17px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dz-min .mb{display:flex;align-items:center;gap:24px}
.dz-min .dz-range{flex:1;min-width:0}
.dz-min .dz-rings{gap:18px}
.dz-min .dz-ring{min-width:104px}.dz-min .dz-ring .rw{width:104px;height:104px}.dz-min .dz-ring b{font-size:26px}.dz-min .dz-ring b small{font-size:13px}.dz-min .dz-ring .rl{font-size:13px}.dz-min .dz-ring circle{stroke-width:5.5}
.dz-rb{margin-top:12px;max-width:190px;display:flex;flex-direction:column;gap:6px}
.dz-rb .bar{display:flex;gap:3px;height:8px}
.dz-rb .bar i{display:block;height:100%;border-radius:99px;background:rgb(var(--rg));min-width:6px}
.dz-rb .bar i+i{opacity:.55}
.dz-rb .lg{display:flex;gap:12px;font-size:12px;color:var(--ds-fg2);white-space:nowrap}
.dz-rb .lg span{display:inline-flex;align-items:center;gap:5px}
.dz-rb .lg span:before{content:"";width:7px;height:7px;border-radius:50%;background:rgb(var(--rg))}
.dz-rb .lg b{color:var(--ds-fg);font-weight:600}
.dz-min .ms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dz-min .mf{display:flex;align-items:center;gap:14px;border-top:1px solid var(--ds-line);padding-top:12px;font-size:12px;color:var(--ds-fg2);min-height:28px}
.dz-min .mf .i{--is:14px}
.dz-min .mf span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dz-min .mf .sp{margin-left:auto}
.dz-age.stale{color:rgb(var(--ds-warn))}
.dz-gear{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--ds-fg2);opacity:.6;cursor:pointer;padding:0;flex:none}
.dz-gear:hover,.dz-gear:focus-visible{opacity:1;background:var(--ds-soft)}
.dz-cp{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:center;align-content:space-between;gap:10px 14px;padding:14px 16px 4px}
.dz-gw{position:relative;width:100%;max-width:280px;justify-self:center;aspect-ratio:260/150;cursor:pointer;border-radius:16px;outline-offset:3px}
.dz-gw svg{display:block;width:100%;height:100%;overflow:visible}
.dz-gw path{fill:none;stroke-linecap:round}
.dz-gw .gt{stroke:var(--ds-line)}
.dz-gw .gv{stroke:rgb(var(--rg));transition:stroke-dasharray .6s ease}
.dz-gc{position:absolute;left:0;right:0;bottom:0;text-align:center}
.dz-gc .big{font-size:clamp(26px,8.5cqw,38px)}
.dz-gc .cap{margin-top:2px}
.dz-leg{display:flex;flex-direction:column;gap:10px;min-width:0}
.dz-leg span{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;color:var(--ds-fg2);font-size:12px}
.dz-leg i{grid-row:1/3;width:4px;height:34px;border-radius:3px;background:rgb(var(--rg))}
.dz-leg b{color:var(--ds-fg);font-weight:700;font-size:22px;line-height:1.05;font-variant-numeric:tabular-nums}
.dz-leg em{font-style:normal;white-space:nowrap}
.dz-cp .gs{grid-column:1/-1;display:flex;gap:8px}
.dz-cp .gs .dz-chip{flex:1 1 0;justify-content:center;gap:6px;padding:9px 6px;font-size:13.5px;font-variant-numeric:tabular-nums}
.dz-cp .gs .dz-chip b{margin-left:0;overflow:hidden;text-overflow:ellipsis}.dz-cp .gs .dz-chip .i{flex:none;--is:16px}
.dz-cp .gs .dz-chip.chg .i{animation:dz-bolt 1.8s ease-in-out infinite}@keyframes dz-bolt{50%{opacity:.5}}@media(prefers-reduced-motion:reduce){.dz-cp .gs .dz-chip.chg .i{animation:none}}
.dz-chip.chg{background:rgba(var(--ds-ac),.14);border-color:rgba(var(--ds-ac),.4);color:rgb(var(--ds-ac))}
.dz-chip.chg .i,.dz-chip.chg .k{color:inherit}
.dz-ul{display:flex;align-items:center;gap:12px;padding:0 18px;min-height:60px;overflow:hidden}
.dz-ul .u-dot{width:8px;height:8px;border-radius:50%;background:rgb(var(--st-c,var(--ds-ok)));flex:none}
.dz-ul .n{font-size:16px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dz-ul .u-lock{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;color:rgb(var(--st-c,var(--ds-ac)));background:rgba(var(--st-c,var(--ds-ac)),.14);flex:none}
.dz-ul .u-lock .i{--is:17px}
.dz-ul .sep{width:1px;height:24px;background:var(--ds-line);flex:none}
.dz-ul .big{font-size:24px;white-space:nowrap}.dz-ul .big small{font-size:13px;margin-left:3px;color:rgb(var(--ds-ac))}
.dz-ul .u-m{display:inline-flex;align-items:center;gap:4px;font-size:15px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
.dz-ul .u-m .i{--is:17px;color:rgb(var(--rg))}
.dz-ul .u-m.chg .i{animation:dzpulse 2.4s ease-in-out infinite}
.dz-ul .u-i{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--ds-fg2);white-space:nowrap;cursor:pointer}
.dz-ul .u-i .i{--is:14px}
.dz-ul .u-i:focus-visible,.dz-ul .u-lock:focus-visible{outline:2px solid rgb(var(--ds-ac));outline-offset:2px}
.dz-ul .u-x{margin-left:auto;display:flex;align-items:center;gap:12px;min-width:0}
.dz-ul .u-chg{color:rgb(var(--ds-ac));font-weight:600;font-size:13px;display:inline-flex;gap:4px;align-items:center;white-space:nowrap}
@container(max-width:559px){
.dz-ul{gap:9px;padding:0 12px;min-height:56px}.dz.dz-ul .big{font-size:23px}.dz-ul .u-x .u-i:nth-child(n+2){display:none}.dz-ul .u-x{margin-left:0}
}
@container(max-width:419px){
.dz-ul .u-x{display:none}.dz-ul .u-dot{display:none}.dz-ul{gap:8px}.dz-ul .s1{display:none}.dz.dz-ul .big{font-size:21px}.dz-ul .big small{margin-left:2px;font-size:12px}.dz-ul .n{font-size:15px;flex:0 1 auto}.dz-ul .u-m{font-size:14px}.dz-ul .u-m .i{--is:15px}
}
@container(max-width:559px){
.dz-min{padding:14px 16px 10px;gap:10px}
.dz-min .mb{display:flex;justify-content:space-between;gap:12px}
.dz-min .ms{display:flex;gap:6px}
.dz-min .dz-chip{flex:1 1 0;justify-content:center;padding:7px 8px;gap:6px;font-size:13px}
.dz-min .dz-chip:nth-child(n+4){display:none}
.dz-min .dz-chip .k{display:none}.dz-min .dz-chip b{margin-left:0}
.dz-min .mf{padding-top:8px;min-height:24px}
.dz-min .dz-ring{min-width:86px}.dz-min .dz-ring .rw{width:86px;height:86px}.dz-min .dz-ring b{font-size:21px}.dz-min .dz-ring b small{font-size:11px}.dz-min .dz-ring .rl{font-size:12px}.dz-min .dz-rings{gap:10px}.dz-min .dz-rb{margin-top:9px}.dz-min .dz-rb .lg{gap:8px;font-size:11px}
.dz .big{font-size:40px}
}
@container(min-width:520px){
ha-card[data-companion-design=energy]>.hero{aspect-ratio:auto!important;height:280px}
ha-card[data-companion-design=energy] .stage img{object-fit:contain}
ha-card[data-companion-design=energy] .cvi{width:auto;height:100%}
}
@container(min-width:620px){
ha-card[data-companion-design=cockpit]{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}
ha-card[data-companion-design=cockpit]>.hero{grid-column:1/-1;grid-row:1;aspect-ratio:auto!important;max-height:none;height:300px;min-width:0}
ha-card[data-companion-design=cockpit] .cvi{width:auto;height:100%}
ha-card[data-companion-design=cockpit]>.dz{grid-column:1;grid-row:2;align-self:stretch}
ha-card[data-companion-design=cockpit]>.actions{grid-column:2;grid-row:2;align-self:start}
ha-card[data-companion-design=cockpit]>.info{grid-column:1/-1;grid-row:3}
ha-card[data-companion-design=cockpit]>.diag,ha-card[data-companion-design=cockpit]>.foot,ha-card[data-companion-design=cockpit]>.charge,ha-card[data-companion-design=cockpit]>.companion-cost-launch,ha-card[data-companion-design=cockpit]>.charging-curve-block{grid-column:1/-1}
}
@container(min-width:620px){
ha-card[data-companion-design=tablet]{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,1fr);gap:10px;align-items:start}
ha-card[data-companion-design=tablet]>.hero{grid-column:1;grid-row:1/4;align-self:stretch;min-height:320px}
ha-card[data-companion-design=tablet]>.stats{grid-column:2;grid-row:1}
ha-card[data-companion-design=tablet]>.actions{grid-column:2;grid-row:2}
ha-card[data-companion-design=tablet]>.info{grid-column:2;grid-row:3}
ha-card[data-companion-design=tablet]>.diag,ha-card[data-companion-design=tablet]>.foot,ha-card[data-companion-design=tablet]>.charge,ha-card[data-companion-design=tablet]>.companion-cost-launch{grid-column:1/-1}
}
`;
/* Minimal and Cockpit: a small value layer painted from the card's own values (this._dv), so numbers, colours and states are the same as in every other layout. */
const dzRing=(pct,rgb,icon,label,kind)=>{const p=pct===null||pct===undefined?null:Math.max(0,Math.min(100,pct)),C=163.36;
  return '<div class="dz-ring '+kind+'" role="img" style="--rg:'+rgb+'" aria-label="'+esc(label+": "+(p===null?T("unavailable"):Math.round(p)+"%"))+'"><span class="rw"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="rt" cx="32" cy="32" r="26"/><circle class="rv" cx="32" cy="32" r="26" stroke-dasharray="'+((p||0)*C/100).toFixed(1)+' '+C+'" transform="rotate(-90 32 32)"/></svg><b>'+(p===null?"--":Math.round(p)+"<small>%</small>")+'</b></span><span class="rl">'+ico(icon)+esc(label)+'</span></div>';};
const dzChip=(icon,label,value)=>'<div class="dz-chip">'+ico(icon)+'<span class="k">'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
const dzInfo=card=>{const c=card._c,out=[];if(c.hidden.includes("info"))return out;
  for(const id of (c.info_order||[]).filter(id=>(c.info||[]).includes(id))){const it=INFO_ITEMS[id];if(!it)continue;if((id==="fuel_level"||id==="fuel_volume")&&!hasFuel(card._hass,c))continue;
    if(id==="charge_plan"){if(!card._planHas())continue;const on=card._planOn(),t0=card._planTime("charge_schedule_start"),t1=card._planTime("charge_schedule_end");out.push({plan:true,on,icon:"plan",label:T("Charge plan"),val:card._planVal(on,t0,t1,card._planFull())});continue;}
    const n=it[3]===null?null:card._nl(it[0]).v,raw=card._s(it[0]);if(raw===null&&n===null)continue;
    out.push({ent:card._id(it[0]),icon:it[2],label:T(it[1]),val:it[3]===null?(raw===null?"--":stateText(raw)):n===null?"--":(card._fmtNum(n,it[3])+" "+card._unit(it[0])).trim()});}
  for(const x of c.info_custom||[]){const o=card._eobj(x.entity),n=o?parseFloat(o.state):NaN;
    out.push({ent:x.entity,icon:x.icon||"info",label:x.label||o?.attributes?.friendly_name||x.entity,tap:x.tap_action,hold:x.hold_action,val:!o||BAD.includes(o.state)?"--":Number.isFinite(n)?(card._fmtNum(n,1)+" "+(o.attributes?.unit_of_measurement||x.unit||"")).trim():stateText(o.state)});}
  return out;};
const dzClock='<svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const dzMarkup=(card,kind,d)=>{
  const c=card._c,num=n=>n===null||n===undefined?"--":String(Math.round(n)),st=d.st,stale=d.off||(d.ageMin!==null&&d.ageMin>180&&!d.cloudOn);
  const tap=c.energy_sheet!==false?' data-ent="'+esc(card._id("sensor.battery_level"))+'" data-energy="1" role="button" tabindex="0" aria-label="'+esc(T("Energy"))+'"':"";
  const tempOf=id=>{const n=card._n(id);return n===null?null:card._fmtNum(n,id==="sensor.cabin_humidity"?0:1)+(id==="sensor.cabin_humidity"?" %":"°C");};
  const inside=tempOf("sensor.inside_temperature"),outside=tempOf("sensor.outside_temperature"),humid=tempOf("sensor.cabin_humidity"),hasClim=card._s("climate.cabin_climate")!==null,clim=card._climateIsOn();
  const climChip=hasClim?dzChip(clim?"fan":"snowoff",T("Climate"),T(clim?"On":"Off")):"";
  const lockPill='<span class="dz-lock" style="--st-c:'+st.rgb+'">'+ico(st.icon)+'<span>'+esc(T(st.text))+'</span></span>';
  if(kind==="minimal"){
    /* a small range bar under the kilometres: electric share and fuel share of the total range, sized by distance (battery fill alone for an electric-only car) */
    const rbar=d.fu&&d.range>0&&d.fuel>0?'<div class="dz-rb"><div class="bar"><i style="--rg:'+d.evRgb+';flex:'+d.range+'"></i><i style="--rg:'+d.fuRgb+';flex:'+d.fuel+'"></i></div><div class="lg"><span style="--rg:'+d.evRgb+'"><b>'+num(d.range)+'</b> km</span><span style="--rg:'+d.fuRgb+'"><b>'+num(d.fuel)+'</b> km</span></div></div>':'<div class="dz-rb"><div class="bar"><i style="--rg:'+d.evRgb+';flex:'+Math.max(d.bat||0,2)+'"></i><i style="--rg:var(--ds-line);background:var(--ds-line);flex:'+(100-Math.max(d.bat||0,2))+'"></i></div><div class="lg"><span style="--rg:'+d.evRgb+'"><b>'+num(d.range)+'</b> km '+esc(T("Battery"))+'</span></div></div>';
    const rings=dzRing(d.bat,d.evRgb,"bolt",T("Battery"),d.charging?"chg":"")+(d.fu?dzRing(d.fuelPct,d.fuRgb,"fuel",T("Fuel"),""):"");
    /* the chips are the Info section's tiles: the ones chosen in Settings → Layout → Info, in that order, with the same tap and hold actions */
    const chips=dzInfo(card).slice(0,4).map(x=>x.plan?'<div class="dz-chip" data-plan role="button" tabindex="0" style="position:relative" title="'+esc(x.label)+'" aria-label="'+esc(x.label+": "+x.val)+'">'+ico(x.icon)+'<span class="k">'+esc(x.label)+'</span><b>'+esc(x.val)+'</b>'+(x.on?'<i class="cpd" style="top:8px;right:10px"></i>':"")+'</div>':'<div class="dz-chip" data-ent="'+esc(x.ent)+'"'+(x.tap?' data-tap="'+esc(JSON.stringify(x.tap))+'"':"")+(x.hold?' data-hold="'+esc(JSON.stringify(x.hold))+'"':"")+' role="button" tabindex="0" title="'+esc(x.label)+'" aria-label="'+esc(x.label+": "+x.val)+'">'+ico(x.icon)+'<span class="k">'+esc(x.label)+'</span><b>'+esc(x.val)+'</b></div>').join("");
    const gear=c.show_customize===false||card._hass?.user?.is_admin===false?"":'<button class="dz-gear" data-dz-gear aria-label="'+esc(T("Open Companion settings"))+'">'+ico("sliders")+'</button>';
    const right=d.charging&&d.left?'<span class="sp" style="color:rgb(var(--ds-ac))">'+ico("bolt")+esc(T("{0} left",d.left))+'</span>':'<span class="sp"></span>';
    const lockTap=card._s("lock.doors")!==null?' data-dz-lock role="button" tabindex="0"':"";
    return '<div class="mh"><span class="n">'+esc(card._el.nm?.textContent||c.name||"Deepal S05")+'</span><span class="dz-lock" style="--st-c:'+st.rgb+'"'+lockTap+'>'+ico(st.icon)+'<span>'+esc(T(st.text))+'</span></span></div>'
      +'<div class="mb"><div class="dz-range"><div class="big">'+num(d.total)+'<small>km</small></div><div class="cap">'+esc(T(d.fu?"total range":"range"))+'</div>'+rbar+'</div><div class="dz-rings"'+tap+'>'+rings+'</div></div>'
      +(chips?'<div class="ms">'+chips+'</div>':"")
      +'<div class="mf"><span class="dz-age'+(stale?" stale":"")+'">'+dzClock+esc(T("Last update {0}",d.age))+'</span>'+right+gear+'</div>';
  }
  if(kind==="ultra"){
    const lockTap=card._s("lock.doors")!==null?' data-dz-lock role="button" tabindex="0" aria-label="'+esc(T(st.text))+'"':' aria-label="'+esc(T(st.text))+'"';
    const m=(pct,rgb,icon,label,cls)=>'<span class="u-m '+cls+'" style="--rg:'+rgb+'"'+tap+' title="'+esc(label)+'">'+ico(icon)+(pct===null||pct===undefined?"--":Math.round(pct)+"%")+'</span>';
    const items=(d.charging?[]:dzInfo(card).slice(0,2)).map(x=>'<span class="u-i" data-ent="'+esc(x.ent)+'"'+(x.tap?' data-tap="'+esc(JSON.stringify(x.tap))+'"':"")+(x.hold?' data-hold="'+esc(JSON.stringify(x.hold))+'"':"")+' role="button" tabindex="0" title="'+esc(x.label)+'" aria-label="'+esc(x.label+": "+x.val)+'">'+esc(x.val)+'</span>').join("");
    const chg=d.charging?'<span class="u-chg">'+ico("bolt")+(d.left?esc(T("{0} left",d.left)):esc(T("Charging now")))+'</span>':"";
    return '<span class="u-dot" style="--st-c:'+st.rgb+(stale?";opacity:.45":"")+'"></span><span class="n">'+esc(card._el.nm?.textContent||c.name||"Deepal S05")+'</span><span class="u-lock" style="--st-c:'+st.rgb+'"'+lockTap+'>'+ico(st.icon)+'</span><span class="sep s1"></span>'
      +'<span class="big">'+num(d.total)+'<small>km</small></span><span class="sep"></span>'
      +m(d.bat,d.evRgb,"bolt",T("Battery"),d.charging?"chg":"")+(d.fu?m(d.fuelPct,d.fuRgb,"fuel",T("Fuel"),""):"")
      +(items||chg?'<span class="u-x">'+chg+items+'</span>':"");
  }
  /* cockpit: semicircular gauge, battery on the outer arc and fuel (when the car has a tank) on the inner arc */
  const arc=(r,x0,pct,rgb,w,cls)=>{const len=Math.PI*r,p=pct===null||pct===undefined?0:Math.max(0,Math.min(100,pct));return '<path class="gt" d="M'+x0+' 130 A'+r+' '+r+' 0 0 1 '+(260-x0)+' 130" stroke-width="'+w+'"/><path class="gv '+cls+'" style="--rg:'+rgb+'" d="M'+x0+' 130 A'+r+' '+r+' 0 0 1 '+(260-x0)+' 130" stroke-width="'+w+'" stroke-dasharray="'+(p*len/100).toFixed(1)+' '+len.toFixed(1)+'"/>';};
  const gauge='<svg viewBox="0 0 260 150" aria-hidden="true">'+arc(110,20,d.bat,d.evRgb,10,d.charging?"dz-ga chg":"dz-ga")+(d.fu?arc(88,42,d.fuelPct,d.fuRgb,8,"dz-ga"):"")+'</svg>';
  const leg=(rgb,pct,label,km)=>'<span style="--rg:'+rgb+'"><i></i><b>'+(pct===null||pct===undefined?"--":Math.round(pct)+"%")+'</b><em>'+esc(label)+' · '+num(km)+' km</em></span>';
  const dzTile=(icon,value,label,cls)=>'<div class="dz-chip'+(cls?' '+cls:'')+'" role="group" title="'+esc(label)+'" aria-label="'+esc(label+": "+value)+'">'+ico(icon)+'<b>'+esc(value)+'</b></div>';
  const chgChip=d.charging?dzTile("bolt",d.left||T("Charging now"),T("Charging now")+(d.left?" · "+T("{0} left",d.left):""),"chg"):"";
  const climTile=hasClim?dzTile(clim?"fan":"snowoff",T(clim?"On":"Off"),T("Climate")):"";
  const out=tempOf("sensor.outside_temperature");
  return '<div class="dz-gw"'+tap+'>'+gauge+'<div class="dz-gc"><div class="big">'+num(d.total)+'<small>km</small></div><div class="cap">'+esc(T(d.fu?"total range":"range"))+'</div></div></div>'
    +'<div class="dz-leg">'+leg(d.evRgb,d.bat,T("Battery"),d.range)+(d.fu?leg(d.fuRgb,d.fuelPct,T("Fuel"),d.fuel):"")+'</div>'
    +'<div class="gs">'+chgChip+(inside!==null?dzTile("seat",inside,T("Inside")):"")+climTile+(out!==null?dzTile("thermo",out,T("Outside")):"")+'</div>';
};
const dzPaint=(card,kind)=>{
  const host=card._el.card;let dz=host.querySelector(":scope>.dz");
  if(kind!=="minimal"&&kind!=="cockpit"&&kind!=="ultra"){dz?.remove();return;}
  const d=card._dv;if(!d)return;
  if(!dz){
    dz=document.createElement("div");dz.className="dz";
    dz.addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;const t=event.target.closest("[data-ent],[data-dz-lock]");if(!t)return;event.preventDefault();if(t.hasAttribute("data-dz-lock")){card._lockSheet=true;card._force();}else card._tap(t);});
    dz.addEventListener("click",event=>{if(event.target.closest("[data-dz-gear]"))card._openDashboard();else if(event.target.closest("[data-dz-lock]")){card._lockSheet=true;card._force();}});
    host.append(dz);
  }
  dz.className="dz "+(kind==="minimal"?"dz-min":kind==="ultra"?"dz-ul":"dz-cp");
  const html=dzMarkup(card,kind,d);if(dz._html!==html){dz.innerHTML=html;dz._html=html;}
};
const designRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=designRender.apply(this,args);if(!this._c||!this._el?.card)return result;
  const design=companionDesign(this._pageDesign?{...this._c,companion_design:this._pageDesign}:this._c,this._compViewName);
  this.style.maxWidth=design.width+"px";this._el.card.dataset.companionDesign=design.kind;
  if(!this.shadowRoot.querySelector("style[data-companion-design]")){
    const style=document.createElement("style");style.dataset.companionDesign="";style.textContent=companionDesignCss;this.shadowRoot.append(style);
  }
  this.shadowRoot.querySelectorAll('[role=dialog]').forEach(node=>node.setAttribute("aria-modal","false"));
  if(!this._el.card.querySelector(".companion-cost-launch")){
    const button=document.createElement("button");button.className="companion-cost-launch";
    const lang=this._hass?.locale?.language||"en";
    button.innerHTML='<span class="cost-icon" aria-hidden="true">€</span><span class="cost-label"><b>'+esc(T("Charging costs"))+'</b><small>'+esc(T("Sessions & prices"))+'</small></span>'+ico("chevr");
    button.addEventListener("click",()=>{const tab=this._enEl?.querySelector('[data-en-mode="costs"]');if(tab){tab.click();return;}this._compOpenCosts=true;this._enSheet=true;this._force();});
    const foot=this._el.card.querySelector(":scope>.foot");if(foot)foot.before(button);else this._el.card.append(button); /* the Settings gear sits inside the image now, so it is not a direct child of the card */
  }
  const costs=this._el.card.querySelector('.companion-cost-launch');this._el.costs=costs;
  costs.style.order=String(this._c.order.indexOf('costs'));costs.toggleAttribute('data-off',this._c.hidden.includes('costs'));
  dzPaint(this,design.kind);
  return result;
};
const designConnected=DeepalS05Card.prototype.connectedCallback,designDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.connectedCallback=function(){
  designConnected.call(this);
  if(this._c&&this._el)this._paintNotificationLink();
  this._compOutside=event=>{if(this._popupBox()&&!event.composedPath().includes(this))this._closeTop();};
  document.addEventListener("pointerdown",this._compOutside,true);
};
DeepalS05Card.prototype.disconnectedCallback=function(){
  document.removeEventListener("pointerdown",this._compOutside,true);this._compOutside=null;
  designDisconnected.call(this);
};
const designKey=DeepalS05Card.prototype._key;
DeepalS05Card.prototype._key=function(event){return designKey.call(this,event);};/* Tab must reach the card's focus trap too */

/* The archive, rather than a raw battery jump, owns charging assignment prompts. */
const chargePromptRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){const result=chargePromptRender.apply(this,args);this._renderChargePrompt();return result;};
DeepalS05Card.prototype._renderChargePrompt=function(){
  if(!this._el?.card)return;
  let node=this._el.card.querySelector('.charge-assignment-prompt');
  const prompt=this._compChargePrompt;
  const demo=this._isCompanionPreview&&this._previewMode==='charge-detected';
  if((this._isCompanionPreview&&!demo)||!prompt||this._c.hidden.includes('reminder')){node?.remove();return;}
  if(!node){
    node=document.createElement('section');node.className='charge-assignment-prompt';
    node.addEventListener('change',()=>{const button=node.querySelector('[data-charge-prompt=assign]');if(button)button.disabled=!node.querySelector('select').value;});
    node.addEventListener('click',async event=>{
      const button=event.target.closest('[data-charge-prompt]');if(!button)return;
      const action=button.dataset.chargePrompt,record=this._compChargePrompt,generation=this._compGeneration;if(!record)return;
      if(this._isCompanionPreview){
        if(this._previewMode!=='charge-detected')return;
        if(action==='costs'){this._toast('Demo: open Sessions to enter a charging cost. No data was changed.','ok');return;}
        if(action==='assign'&&!node.querySelector('select').value)return;
        this._previewChargePromptDone=true;this._compChargePrompt=null;this._renderChargePrompt();
        this._toast(action==='assign'?'Demo: profile assigned. No costs were saved.':'Demo: reminder dismissed. Change the preview state to test again.','ok');return;
      }
      if(action==='costs'){this._compOpenCosts=true;this._enSheet=true;this._force();return;}
      node.querySelectorAll('button').forEach(item=>item.disabled=true);
      try{
        if(action==='assign'){
          const profile=node.querySelector('select').value;if(!profile)throw Error(T('Choose a charging profile.'));
          await companionRequest(this._rawHass,this._companion,'charge_profile_assign',{session_id:record.id,profile_id:profile});
        }else if(action==='dismiss')await companionRequest(this._rawHass,this._companion,'charge_prompt_dismiss',{session_id:record.id});
        if(generation!==this._compGeneration)return;this._compChargePrompt=null;this._renderChargePrompt();await this._loadRemote();
      }catch(error){if(generation!==this._compGeneration)return;node.querySelectorAll('button').forEach(item=>item.disabled=false);this._toast(tError(error.message||String(error)),'error');await this._loadRemote();}
    });
    if(this._el.costs)this._el.costs.before(node);else this._el.hero.parentNode.append(node); /* the Settings gear lives inside the image, so it is no longer a place to insert next to */
  }
  node.style.order=String(this._c.order.indexOf('reminder'));
  const signature=JSON.stringify(prompt);if(node.dataset.signature===signature)return;node.dataset.signature=signature;
  const admin=this._rawHass?.user?.is_admin,selected=node.querySelector('select')?.value||(admin?prompt.profiles.find(profile=>profile.default)?.id:'')||'';
  node.innerHTML='<div class="charge-prompt-title">'+ico('plug')+'<b>'+esc(T('Charging detected'))+'</b><span>+'+esc(new Intl.NumberFormat(this._hass?.locale?.language||'en',{maximumFractionDigits:0}).format(prompt.gain))+'%</span></div><p>'+esc(T('Assign a charging profile or enter the cost.'))+'</p>'+(admin?'<div class="charge-prompt-profile"><select aria-label="'+esc(T('Charging profile'))+'"><option value="">'+esc(T('Choose a charging profile'))+'</option>'+prompt.profiles.map(profile=>'<option value="'+esc(profile.id)+'">'+esc(profile.name||profile.id)+(profile.free?' · '+esc(T('Free')):profile.price!=null?' · '+esc(String(profile.price))+' €/kWh':'')+'</option>').join('')+'</select><button data-charge-prompt="assign" disabled>'+esc(T('Assign'))+'</button></div>':'')+'<div class="charge-prompt-actions"><button data-charge-prompt="costs">'+esc(T('Charging costs'))+' ›</button><button data-charge-prompt="dismiss">'+esc(T('Dismiss until next charge'))+'</button></div>';
  if(admin){const select=node.querySelector('select');select.value=selected;node.querySelector('[data-charge-prompt=assign]').disabled=!select.value;window.__DEEPAL_COMPANION_UI.enhanceChoices(node,this._hass);}
};

/* Optional, lazy charging-current chart. Never sends vehicle commands. */
const curveRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=curveRender.apply(this,args);
  if(!this._c||!this._el?.card)return result;
  const enabled=!this._c.hidden.includes('curve');
  const flowing=this._n('sensor.ac_charge_current')>.5||this._n('sensor.dc_charge_current')>.5||this._n('sensor.charge_current')>.5;
  // One zero reading in the middle of a charge must not remove and reload the curve: keep it for a minute after the last current.
  // The simulated preview follows its switch at once.
  if(flowing)this._curveSeen=Date.now();
  const charging=flowing||(!!this._curveSeen&&(!this._previewSourceHass||this._previewMode==='live')&&(this._s('binary_sensor.charging')==='on'||Date.now()-this._curveSeen<60000));
  if(!enabled||!charging){this._chargingCurve?.destroy();this._chargingCurve=null;this._curveLoad=null;this._el.card.querySelector(':scope > .charging-curve-block')?.remove();return result;}
  if(this._chargingCurve){this._chargingCurve.update();return result;}
  if(!this._curveLoad){
    const token={};this._curveLoad=token;
    import('/deepal_companion/frontend/charging-curve.js?v=2.0.1-b1&rev=20261126-01').then(module=>{
      if(this._curveLoad!==token||!this.isConnected)return;
      this._curveLoad=null;this._chargingCurve=module.mountCurve(this);this._chargingCurve.update();
    }).catch(()=>{if(this._curveLoad===token){this._curveLoad=null;this._toast('Charging curve could not be loaded.','error');}});
  }
  return result;
};
const curveDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.disconnectedCallback=function(){this._curveLoad=null;this._chargingCurve?.destroy();this._chargingCurve=null;curveDisconnected.call(this);};

/* Live cost of the running charge. Frontend only: reads sessions_page and costs_get, and the only write is the Companion charging settings.
   The block appears with the charging curve (or in the charge area) while charging, and never together with the end-of-charge prompt. */
const CC_CURRENT_SENSORS=['sensor.ac_charge_current','sensor.dc_charge_current','sensor.charge_current'];
const CC_DEMO_PROFILES=[{id:'home',name:'Home',price:.25,free:false,efficiency:90},{id:'free',name:'Free',price:null,free:true,efficiency:90}];
const ccRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=ccRender.apply(this,args);
  try{this._renderChargeCost();}catch(error){console.error('Deepal Companion charge cost',error);}
  return result;
};
const ccDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.disconnectedCallback=function(){this._ccDestroy();ccDisconnected.call(this);};
DeepalS05Card.prototype._ccDestroy=function(){
  const state=this._cc;if(state){state.dead=true;clearTimeout(state.timer);clearTimeout(state.leaveTimer);}
  const chip=this._el?.charge?.querySelector('[data-cg-cost]');if(chip)chip.innerHTML='';
  this._cc=null;this._ccSeen=0;
  this._el?.card?.querySelector('.charge-cost-live')?.remove();
};
/* The preview simulates a charge and a pair of locations; it never calls the backend. */
function ccDemoRow(profile){
  const energy=(68-52)*18.4/100/.9,price=profile?.price,cost=profile?profile.free?0:price!=null?price*energy:null:null;
  return {id:'demo',s:Date.now()-36e5,e:Date.now(),from:52,to:68,kwh:2.94,capacity:18.4,live:true,dc:false,
    assignment:profile?{profile,energy:null,total:null}:null,pricing:{energy:profile?energy:null,cost,source:'battery',estimated:true,cost_estimated:!!(profile&&!profile.free&&cost!==null)}};
}
/* The settings preview shows the real charge cost while it shows live data; only the simulated modes use the demo. */
DeepalS05Card.prototype._ccDemo=function(){return !!this._isCompanionPreview&&this._previewMode!=='live';};
DeepalS05Card.prototype._renderChargeCost=function(){
  const card=this._el?.card;if(!this._c||!card)return;
  const demo=this._ccDemo();
  let state=this._cc;
  if(state&&state.generation!==this._compGeneration){this._ccDestroy();state=null;}
  const flowing=CC_CURRENT_SENSORS.some(id=>this._n(id)>.5);
  if(flowing)this._ccSeen=Date.now();
  const charging=flowing||(!!this._ccSeen&&(!this._previewSourceHass||this._previewMode==='live')&&(this._s('binary_sensor.charging')==='on'||Date.now()-this._ccSeen<60000));
  /* the end-of-charge prompt and this block are never visible together */
  if(!charging||card.querySelector(':scope > .charge-assignment-prompt')){if(state&&!charging)this._ccDestroy();else card.querySelector('.charge-cost-live')?.remove();return;}
  if(!state){state=this._cc={generation:this._compGeneration,row:null,profiles:null,locations:[],fetching:false,fetched:0,pct:null,editing:false,busy:false,choice:'',timer:0,dead:false,demoProfile:null};}
  if(demo)state.row=ccDemoRow(state.demoProfile);
  else this._ccSchedule(state);
  this._ccPaint(state,demo);
};
DeepalS05Card.prototype._ccSchedule=function(state){
  if(state.fetching||state.dead)return;
  const pct=Math.round(this._n('sensor.battery_level'));
  const due=!state.fetched||Date.now()-state.fetched>=60000||(Number.isFinite(pct)&&pct!==state.pct);
  if(due)this._ccFetch(state,pct);
};
DeepalS05Card.prototype._ccFetch=async function(state,pct=Math.round(this._n('sensor.battery_level'))){
  if(state.fetching||state.dead||!this._rawHass||!this._companion)return;
  state.fetching=true;state.pct=Number.isFinite(pct)?pct:null;
  const generation=this._compGeneration,admin=!!this._rawHass.user?.is_admin;
  try{
    const page=await companionRequest(this._rawHass,this._companion,'sessions_page',{sort:'newest',limit:1});
    if(state.dead||generation!==this._compGeneration)return;
    const row=page?.rows?.[0];state.row=row&&row.live?row:null;state.locations=page?.locations||[];
    if(admin&&(!state.profiles||state.reloadProfiles)){
      const costs=await companionRequest(this._rawHass,this._companion,'costs_get');
      if(state.dead||generation!==this._compGeneration)return;
      state.profiles=costs?.value?.profiles||[];state.reloadProfiles=false;
    }
  }catch(error){/* keep the last values; the next attempt is a minute away or follows a battery change */}
  finally{
    state.fetching=false;state.fetched=Date.now();clearTimeout(state.timer);
    if(!state.dead)state.timer=setTimeout(()=>{if(!state.dead&&this._cc===state)this._renderChargeCost();},60000);
  }
  if(!state.dead&&generation===this._compGeneration)this._ccPaint(state,false);
};
/* The cost chip in the charging block: the amount at a glance; for an admin it opens the location selector. */
DeepalS05Card.prototype._ccChip=function(info){
  const charge=this._el?.charge,slot=charge?.querySelector('[data-cg-cost]');if(!slot)return;
  if(!charge._ccBound){
    charge._ccBound=true;
    charge.addEventListener('click',event=>{
      const chip=event.target.closest('[data-cc-chip]'),state=this._cc;if(!chip||!state?.row||state.busy)return;
      state.editing=!state.editing;state.choice='';this._ccPaint(state,this._ccDemo());
    });
  }
  if(!info){slot.innerHTML='';return;}
  const tag=info.admin?'button':'span',attrs=info.admin?' type="button" data-cc-chip aria-label="'+esc(T('Change'))+'" title="'+esc(T('Change'))+'"':'';
  slot.setAttribute('aria-live','polite');
  slot.innerHTML='<'+tag+' class="cg-chip"'+attrs+'>'+ico('plug')+'<b data-cc-chip-amount>'+esc(info.amount)+'</b>'+(info.name?'<small>'+esc(info.name)+'</small>':'')+(info.admin?ico('mdi:pencil-outline'):'')+'</'+tag+'>';
};
DeepalS05Card.prototype._ccPaint=function(state,demo){
  const card=this._el?.card;if(!card||state.dead)return;
  let node=card.querySelector('.charge-cost-live');
  const row=state.row;
  if(!row){node?.remove();this._ccChip(null);return;}
  const admin=!!this._rawHass?.user?.is_admin;
  const lang=this._hass?.locale?.language||'en',currency=this._hass?.config?.currency||'EUR';
  const money=value=>{try{return new Intl.NumberFormat(lang,{style:'currency',currency}).format(value);}catch(error){return new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(value);}};
  const number=new Intl.NumberFormat(lang,{maximumFractionDigits:1});
  const record=row.assignment,profile=record?.profile,pricing=row.pricing||{},assigned=!!profile?.id;
  const estimated=typeof pricing.cost_estimated==='boolean'?pricing.cost_estimated:pricing.estimated===true;
  let amount;
  if(pricing.cost==null)amount=T('Not priced');
  else if(pricing.cost===0&&profile?.free)amount=T('Free');
  else amount=(estimated?'≈ ':'')+money(pricing.cost);
  const parts=[];
  if(assigned){
    parts.push(profile.name||state.locations.find(item=>item.id===profile.id)?.name||profile.id);
    if(!profile.free&&profile.price!=null)parts.push(String(profile.price)+' €/kWh');
    if(pricing.energy!=null)parts.push((pricing.estimated===true?'≈ ':'')+number.format(pricing.energy)+' kWh');
  }
  const sub=assigned?parts.join(' · '):'';
  this._ccChip({amount,name:assigned?parts[0]:'',admin});
  const slot=card.querySelector(':scope > .charging-curve-block [data-curve-cost]');
  /* with the curve: always a slim bar at its foot. Without it: a selector strip that shows while a location is being chosen and fades away once it is saved */
  const showStrip=!!slot||(admin&&(state.editing||(!assigned&&this._c.charge_cost_selector!==false)));
  const showPicker=admin&&(!slot||!assigned||state.editing);
  if(!showStrip){
    if(node&&!node.classList.contains('leaving')){
      node.classList.add('leaving');clearTimeout(state.leaveTimer);
      state.leaveTimer=setTimeout(()=>{if(node.classList.contains('leaving'))node.remove();},320);
    }
    return;
  }
  if(node?.classList.contains('leaving')){node.classList.remove('leaving');clearTimeout(state.leaveTimer);}
  const profiles=demo?CC_DEMO_PROFILES:(state.profiles||state.locations);
  const options=profiles.map(item=>({id:item.id,label:(item.name||item.id)+(item.free?' · '+T('Free'):item.price!=null?' · '+String(item.price)+' €/kWh':'')}));
  const currentId=assigned&&profile.id!=='manual'?profile.id:'';
  const structure=JSON.stringify([admin,assigned,showPicker,state.busy,options,currentId]);
  if(!node){
    node=document.createElement('section');node.className='charge-cost-live';node.setAttribute('aria-label',T('This charge'));
    node.addEventListener('change',event=>{if(event.target.matches('select')){state.choice=event.target.value;this._ccSyncSave(node);}});
    node.addEventListener('click',event=>{
      const button=event.target.closest('[data-cc]');if(!button||button.disabled)return;
      const action=button.dataset.cc;
      if(action==='change'){state.editing=true;state.choice='';this._ccPaint(state,this._ccDemo());}
      else if(action==='cancel'){state.editing=false;state.choice='';this._ccPaint(state,this._ccDemo());}
      else if(action==='save')this._ccSave(state,node);
    });
  }
  if(slot){if(node.parentNode!==slot)slot.append(node);node.style.order='';}
  else{
    let anchor=this._el.charge;while(anchor&&anchor.parentNode!==card)anchor=anchor.parentNode;
    if(anchor){if(node.parentNode!==card||node.previousElementSibling!==anchor)anchor.after(node);}
    else if(node.parentNode!==card)(card.querySelector(':scope > .foot'))?card.querySelector(':scope > .foot').before(node):card.append(node);
    node.style.order=String(Math.max(0,this._c.order.indexOf('charge')));
  }
  if(node.dataset.structure!==structure){
    node.dataset.structure=structure;
    const keep=state.choice||'';
    node.classList.toggle('pick',showPicker);
    node.innerHTML=ico('plug')+'<div class="cc-main"><b class="cc-amount" data-cc-amount aria-live="polite" aria-atomic="true"></b><span class="cc-sub" data-cc-sub></span></div>'
      +(showPicker?'<select aria-label="'+esc(T('Charging location'))+'"'+(state.busy?' disabled':'')+'><option value="">'+esc(T('Choose a location'))+'</option>'+options.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.label)+'</option>').join('')+'</select><button type="button" class="cc-icon" data-cc="save" aria-label="'+esc(T('Save'))+'" title="'+esc(T('Save'))+'" disabled>'+ico('check')+'</button>'+((assigned||state.editing)?'<button type="button" class="cc-icon" data-cc="cancel" aria-label="'+esc(T('Cancel'))+'" title="'+esc(T('Cancel'))+'">'+ico('close')+'</button>':'')
        :(admin&&assigned?'<button type="button" class="cc-icon" data-cc="change" aria-label="'+esc(T('Change'))+'" title="'+esc(T('Change'))+'">'+ico('mdi:pencil-outline')+'</button>':''));
    if(showPicker){
      const select=node.querySelector('select');select.value=keep&&[...select.options].some(item=>item.value===keep)?keep:currentId;state.choice=select.value;
      this._ccSyncSave(node);window.__DEEPAL_COMPANION_UI?.enhanceChoices(node,this._hass);
    }
  }
  /* text-only updates keep focus and avoid redrawing the block */
  const amountNode=node.querySelector('[data-cc-amount]'),subNode=node.querySelector('[data-cc-sub]');
  if(amountNode.textContent!==amount)amountNode.textContent=amount;
  if(subNode.textContent!==sub)subNode.textContent=sub;
};
DeepalS05Card.prototype._ccSyncSave=function(node){
  const select=node.querySelector('select'),save=node.querySelector('[data-cc=save]');if(!select||!save)return;
  const current=node.dataset.structure?JSON.parse(node.dataset.structure)[5]:'';
  save.disabled=!select.value||select.value===current||select.disabled;
};
DeepalS05Card.prototype._ccSave=async function(state,node){
  const select=node.querySelector('select'),profileId=select?.value;
  if(!profileId||state.busy)return;
  if(this._ccDemo()){
    state.demoProfile=CC_DEMO_PROFILES.find(item=>item.id===profileId)||null;state.editing=false;state.choice='';
    this._renderChargeCost();this._toast(T('Demo: location chosen. No costs were saved.'),'ok');return;
  }
  const row=state.row,generation=this._compGeneration;if(!row)return;
  state.busy=true;this._ccPaint(state,false);
  try{
    const record=row.assignment;
    if(!record){
      await companionRequest(this._rawHass,this._companion,'charge_profile_assign',{session_id:row.id,profile_id:profileId});
    }else{
      /* a location correction replaces only the profile: a typed receipt (energy, total) is kept exactly as it is */
      const source=(state.profiles||[]).find(item=>item.id===profileId);
      if(!source)throw Error(T('Choose a charging profile.'));
      const key=String(Math.round(row.s/1000));
      await companionRequest(this._rawHass,this._companion,'costs_set',{changes:{sessions:{[key]:{...record,profile:structuredClone(source)}}},expected_changes:{sessions:{[key]:record}}});
    }
    if(state.dead||generation!==this._compGeneration)return;
    state.editing=false;state.choice='';
  }catch(error){
    if(state.dead||generation!==this._compGeneration)return;
    state.busy=false;
    if(/changed elsewhere/i.test(error.message||''))this._toast(T('Settings changed elsewhere and were reloaded. Please repeat your change.'),'error');
    else this._toast(tError(error.message||String(error)),'error');
    state.reloadProfiles=true;state.editing=false;state.choice='';
  }
  if(state.dead||generation!==this._compGeneration)return;
  state.busy=false;state.fetched=0;state.fetching=false;
  await this._ccFetch(state);
};

customElements.define(SETTINGS_TAG, DeepalS05Settings);
customElements.define(EDITOR_TAG, DeepalS05CardEditor);
customElements.define(TAG, DeepalS05Card);

window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === TAG)) {
  window.customCards.push({ type: TAG, name: "Deepal Companion", description: "Control panel for the Deepal S05 (EV/PHEV): lock and climate controls, charging, tyres, doors and windows, interior, trip and fuel data, and a diagnostics page. Works with the Deepal Alternative integration.", preview: true, documentationURL: "https://github.com/rmxs/deepal-companion-card" });
}
console.info(`%c DEEPAL-S05-CARD %c v${CARD_VERSION} `, "background:#E20074;color:#fff;border-radius:4px 0 0 4px;padding:2px 4px", "background:#222;color:#fff;border-radius:0 4px 4px 0;padding:2px 4px");
})();
