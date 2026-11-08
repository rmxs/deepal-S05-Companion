/* Alert presets and conditions for the integrated Home Assistant notification engine. */
export function createNotificationRules(K) {
const NF={};
const T=(text,...args)=>K.T(text,...args);
const obj=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
const SEV=[['info','Information'],['important','Important'],['critical','Critical']];
const EV = {
  charge_done: {
    g: "charge", icon: "mdi:battery-check-outline", label: "Charging complete", sub: "When charging stops and the battery has reached the limit.",
    d: { on: true, delay: 2, repeat: 0, max: 1, sev: "info", thr: 80, away: false, parked: false, actions: [] }, ctl: ["delay", "sev", "thr"], acts: ["dismiss"],
    thr: { label: "Counts as complete from", unit: "%", min: 50, max: 100, step: 1, sub: "When charging stops and the battery is at least this high, a notification is sent. If it stops earlier, see “Plugged in, but not charging”." },
    delayHelp: "Minutes charging must have stopped before you are notified.",
    vars: ["name", "battery", "range"], title: "{name} · Charging complete", text: "Battery {battery}%, range {range} km.",
  },
  plugged_idle: {
    g: "charge", icon: "mdi:power-plug-off-outline", label: "Plugged in, but not charging", sub: "The plug is in the port and nothing is charging. Leave it off if you charge on a schedule.",
    d: { on: false, delay: 30, repeat: 60, max: 2, sev: "important", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the plug must stay connected without charging.",
    vars: ["name", "battery", "range", "minutes"], title: "{name} · Plugged in but not charging", text: "The plug has been in the port for {minutes} minutes, but it is not charging. Battery {battery}%.",
  },
  charge_interrupted: {
    g: "charge", icon: "mdi:battery-charging-wireless-outline", label: "Charging interrupted", sub: "Charging stopped before reaching the limit while the cable stays connected.",
    d: { on: false, delay: 5, repeat: 0, max: 1, sev: "important", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes charging must stay stopped (cable connected) before you are notified.",
    vars: ["name", "battery", "range", "minutes"], title: "{name} · Charging interrupted", text: "Charging stopped at {battery}%, before reaching the limit, and the cable is still connected.",
  },
  charge_started: {
    g: "charge", icon: "mdi:battery-charging-high", label: "Charging started", sub: "Charging has just started, for example a scheduled charge. If it never starts, use “Plugged in, but not charging”.",
    d: { on: false, delay: 0, repeat: 0, max: 1, sev: "info", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes charging must keep running before you are notified.",
    vars: ["name", "battery", "range"], title: "{name} · Charging started", text: "Charging has started. Battery {battery}%.",
  },
  charge_eta: {
    g: "charge", icon: "mdi:timer-sand", label: "Charging almost finished", sub: "The estimated time left to finish charging is at or below your limit.", needsLeft: true,
    d: { on: false, delay: 0, repeat: 0, max: 1, sev: "info", away: false, parked: false, actions: ["dismiss"], thr: 15 }, ctl: ["delay", "sev", "thr", "actions"], acts: ["dismiss"],
    thr: { label: "Time left at or below", unit: "min", min: 5, max: 120, step: 5, sub: "A notification is sent while charging when the estimated time left is this many minutes or less." },
    delayHelp: "Minutes the condition must last before you are notified.",
    vars: ["name", "battery", "range", "left"], title: "{name} · Charging almost finished", text: "About {left} minutes left. Battery {battery}%.",
  },
  charge_target: {
    g: "charge", icon: "mdi:battery-charging-80", label: "Charging reached target", sub: "The battery reached your target percentage while still charging.",
    d: { on: false, delay: 0, repeat: 0, max: 1, sev: "info", away: false, parked: false, actions: ["dismiss"], thr: 80 }, ctl: ["delay", "sev", "thr", "actions"], acts: ["dismiss"],
    thr: { label: "Target", unit: "%", min: 50, max: 100, step: 1, sub: "A notification is sent while charging when the battery reaches this percentage." },
    delayHelp: "Minutes the battery must stay at the target before you are notified.",
    vars: ["name", "battery", "range"], title: "{name} · Target reached", text: "Battery {battery}% (range {range} km). Target reached.",
  },
  unlocked: {
    g: "security", icon: "mdi:lock-open-variant-outline", label: "Unlocked vehicle", sub: "The vehicle stays unlocked.",
    d: { on: true, delay: 15, repeat: 15, max: 3, sev: "important", away: false, parked: true, actions: ["lock", "dismiss"] }, ctl: ["delay", "repeat", "sev", "away", "parked", "actions"], acts: ["lock", "dismiss"],
    delayHelp: "Minutes the vehicle must stay unlocked before the first notification is sent.",
    vars: ["name", "battery", "range", "minutes"], title: "{name} · Unlocked", text: "The vehicle has been unlocked for {minutes} minutes. Battery {battery}%.",
  },
  open: {
    g: "security", icon: "mdi:car-door", label: "Open window, door or trunk", sub: "Something is left open while the car is parked.",
    d: { on: true, delay: 10, repeat: 15, max: 3, sev: "important", away: false, parked: true, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "away", "parked", "actions"], acts: ["lock", "dismiss"],
    delayHelp: "Minutes something must stay open before the first notification is sent.",
    vars: ["name", "battery", "minutes", "items"], title: "{name} · Open openings", text: "Open for {minutes} minutes: {items}.",
  },
  lights: {
    g: "security", icon: "mdi:car-light-high", label: "Lights on", sub: "The lights stay on while the car is parked.",
    d: { on: false, delay: 5, repeat: 0, max: 1, sev: "info", away: false, parked: true, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "away", "parked", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the lights must stay on before the notification is sent.",
    vars: ["name", "battery", "minutes"], title: "{name} · Lights on", text: "The lights have been on for {minutes} minutes.",
  },
  tires: {
    g: "tires", icon: "mdi:car-tire-alert", label: "Tyre pressure", sub: "Pressure out of range or a tyre alarm. Follows the limits in Settings → Tyres.",
    d: { on: true, delay: 5, repeat: 60, max: 3, sev: "important", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the problem must last before the first notification is sent (avoids false alarms).",
    vars: ["name", "items"], title: "{name} · Tyre pressure", text: "Check the pressure: {items}.",
  },
  warn_crit: {
    g: "vehicle", icon: "mdi:alert-octagon-outline", label: "Critical warning", sub: "Airbag, brakes, brake fluid, power system.",
    diag: true,
    d: { on: true, delay: 1, repeat: 30, max: 3, sev: "critical", away: false, parked: false, actions: ["dismiss"], items: null }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the warning light must stay on before you are notified.",
    vars: ["name", "battery", "items"], title: "{name} · Critical warning", text: "The vehicle reported: {items}. Check it before you drive.",
  },
  warn: {
    g: "vehicle", icon: "mdi:alert-outline", label: "Vehicle warning", sub: "ABS, 12V battery, power steering, power limit and your own indicators. Choose below which ones trigger a notification.",
    diag: true,
    d: { on: true, delay: 5, repeat: 120, max: 2, sev: "important", away: false, parked: false, actions: ["dismiss"], items: null }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the warning light must stay on before you are notified.",
    vars: ["name", "battery", "items"], title: "{name} · Vehicle warning", text: "Active: {items}.",
  },
  key_battery: {
    g: "vehicle", icon: "mdi:key-wireless", label: "Key battery", sub: "The remote key reports a low battery.", needsKey: true,
    d: { on: true, delay: 2, repeat: 720, max: 6, sev: "important", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the warning light must stay on before you are notified.",
    vars: ["name"], title: "{name} · Key battery", text: "The remote key reports a low battery. Replace it soon to avoid access or start problems.",
  },
  battery_low: {
    g: "energy", icon: "mdi:battery-alert-variant-outline", label: "Low battery", sub: "The battery drops below the limit and the vehicle is not charging.",
    d: { on: true, delay: 1, repeat: 120, max: 2, sev: "important", away: false, parked: false, actions: ["dismiss"], thr: 20 }, ctl: ["delay", "repeat", "sev", "thr", "actions"], acts: ["dismiss"],
    thr: { label: "Below", unit: "%", min: 5, max: 60, step: 1, sub: "When the battery falls below this percentage." },
    delayHelp: "Minutes the battery must stay below the limit before you are notified.",
    vars: ["name", "battery", "range"], title: "{name} · Low battery", text: "Battery {battery}% (range {range} km).",
  },
  fuel_low: {
    g: "energy", icon: "mdi:gas-station-outline", label: "Low fuel", sub: "The fuel range drops below the limit (plug-in hybrid).", needsFuel: true,
    d: { on: true, delay: 1, repeat: 180, max: 2, sev: "important", away: false, parked: false, actions: ["dismiss"], thr: 50 }, ctl: ["delay", "repeat", "sev", "thr", "actions"], acts: ["dismiss"],
    thr: { label: "Below", unit: "km", min: 10, max: 400, step: 5, sub: "When the fuel range falls below this many kilometers." },
    delayHelp: "Minutes the range must stay below the limit before you are notified.",
    vars: ["name", "fuel_range", "battery"], title: "{name} · Low fuel", text: "Fuel range {fuel_range} km.",
  },
  climate: {
    g: "other", icon: "mdi:fan", label: "Climate left on", sub: "The climate control stays on for a long time.",
    d: { on: false, delay: 30, repeat: 0, max: 1, sev: "info", away: false, parked: true, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "away", "parked", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the climate control must stay on before the notification is sent.",
    vars: ["name", "battery", "minutes"], title: "{name} · Climate is running", text: "The climate control has been on for {minutes} minutes.",
  },
  comfort: {
    g: "other", icon: "mdi:car-seat-heater", label: "Comfort functions left on", sub: "Seat heating or ventilation or steering-wheel heating is on while the vehicle is locked and parked.", needsComfort: true,
    d: { on: true, delay: 10, repeat: 0, max: 1, sev: "info", away: false, parked: true, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "away", "parked", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the functions must stay on before the notification is sent.",
    vars: ["name", "battery", "minutes", "items"], title: "{name} · Comfort functions left on", text: "On for {minutes} minutes: {items}.",
  },
  offline: {
    g: "other", icon: "mdi:cloud-off-outline", label: "Lost connection to the vehicle", sub: "Deepal Cloud is not responding.",
    d: { on: false, delay: 60, repeat: 0, max: 1, sev: "info", away: false, parked: false, actions: ["dismiss"] }, ctl: ["delay", "repeat", "sev", "actions"], acts: ["dismiss"],
    delayHelp: "Minutes the connection must be missing before the notification is sent.",
    vars: ["name", "minutes"], title: "{name} · Connection lost", text: "Deepal Cloud has not responded for {minutes} minutes. The readings may be out of date.",
  },
};
const EV_IDS = Object.keys(EV);
const PRESETS = {
  basic: ["charge_done", "unlocked", "warn_crit", "tires", "key_battery"],
  recommended: EV_IDS.filter((k) => EV[k].d.on),
  all: EV_IDS.slice(),
};
const int = (v, d, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== "" && v !== null && typeof v !== "boolean" ? Math.min(hi, Math.max(lo, n)) : d; };
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const hhmm = (v, d) => { const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(v || "").trim()); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : d; };
const SVC_RE = /^mobile_app_[a-z0-9_]{1,80}$/;
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "s05";

/* Normalize the notification board preferences. */
function norm(raw) {
  const r = obj(raw), q = obj(r.quiet), ev = obj(r.events);
  const out = {
    on: r.on === true,
    local: r.local === true,
    devices: (Array.isArray(r.devices) ? r.devices : []).filter((x, i, a) => typeof x === "string" && (SVC_RE.test(x) || (r.local === true && /^notify\.[a-z0-9_]+$/.test(x))) && a.indexOf(x) === i),
    quiet: { on: bool(q.on, true), from: hhmm(q.from, "22:00"), to: hhmm(q.to, "07:00"), mode: q.mode === "skip" ? "skip" : "silent" },
    fresh: int(r.fresh, 0, 0, 1440),
    url: typeof r.url === "string" && /^\/[\w\-./%]{0,160}$/.test(r.url) ? r.url : "",
    events: {},
  };
  for (const id of EV_IDS) {
    const s = EV[id], d = s.d, e = obj(ev[id]);
    const x = {
      on: bool(e.on, d.on), delay: int(e.delay, d.delay, 0, 720), repeat: int(e.repeat, d.repeat, 0, 1440), max: int(e.max, d.max, 1, 20),
      sev: SEV.some((p) => p[0] === e.sev) ? e.sev : d.sev, away: bool(e.away, d.away), parked: bool(e.parked, d.parked), park: int(e.park, 5, 0, 120),
      actions: Array.isArray(e.actions) ? s.acts.filter((a) => e.actions.includes(a)) : d.actions.slice(), /* always in the order of s.acts */
      title: typeof e.title === "string" ? e.title.slice(0, 80) : "", text: typeof e.text === "string" ? e.text.slice(0, 300) : "",
      icon: typeof e.icon === "string" && /^mdi:[a-z0-9-]{1,80}$/.test(e.icon) ? e.icon : s.icon,
    };
    if (s.thr) x.thr = int(e.thr, d.thr, s.thr.min, s.thr.max);
    if (s.diag) x.items = Array.isArray(e.items) ? e.items.filter((k, i, a) => typeof k === "string" && /^binary_sensor\.[a-z0-9_]{1,80}$/.test(k) && a.indexOf(k) === i) : null; /* which indicators trigger a notification; null = all */
    if (!s.ctl.includes("repeat")) { x.repeat = d.repeat; x.max = d.max; }
    out.events[id] = x;
  }
  return out;
}
/* Store only preferences that differ from the defaults. */
function compact(n) {
  const base = norm({}), out = {};
  if (n.on) out.on = true;
  if (n.local) out.local = true;
  if (n.devices.length) out.devices = n.devices.slice();
  const q = {}; for (const k of Object.keys(base.quiet)) if (n.quiet[k] !== base.quiet[k]) q[k] = n.quiet[k];
  if (Object.keys(q).length) out.quiet = q;
  if (n.fresh) out.fresh = n.fresh;
  if (n.url) out.url = n.url;
  const ev = {};
  for (const id of EV_IDS) {
    const b = base.events[id], c = n.events[id], x = {};
    for (const k of Object.keys(b)) if (JSON.stringify(b[k]) !== JSON.stringify(c[k])) x[k] = c[k];
    if (Object.keys(x).length) ev[id] = x;
  }
  if (Object.keys(ev).length) out.events = ev;
  return out;
}
/* Summary of times: "after 15′, 30′, 45′" and the total span */
const cnt = (e) => (e.repeat > 0 ? e.max : 1); /* how many notifications are actually sent (without repeat: one) */
function schedule(e) {
  const times = []; for (let i = 0; i < cnt(e); i++) times.push(e.delay + i * e.repeat);
  return { times, total: times[times.length - 1] };
}
const EID_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const eid = (s) => (EID_RE.test(String(s)) ? String(s) : "sensor.invalid"); /* entity_ids go into templates: only valid ones */
const plain = (s) => String(s).replace(/[{}]/g, "").trim() || "Deepal S05"; /* name in alias: without Jinja brackets */
const jq = (s) => JSON.stringify(String(s)); /* text as a literal Jinja/YAML */
const tags = (...l) => l.map((t) => `{%- ${t} -%}`).join("\n"); /* Jinja commands without whitespace in the output */
/* Comfort functions: [key, name, is active if...] — numeric levels count when > 0 */
const COMFORT = [
  ["number.front_left_seat_heating_level", "Driver seat heating", "num"], ["number.front_right_seat_heating_level", "Passenger seat heating", "num"],
  ["number.front_left_seat_ventilation_level", "Driver seat ventilation", "num"], ["number.front_right_seat_ventilation_level", "Passenger seat ventilation", "num"],
  ["binary_sensor.steering_wheel_heater", "Steering wheel heating", "bin"],
];
function context(hass, cfg) {
  const n = norm(cfg.notify), id = (k) => eid(K.resolveId(hass, cfg, k)), st = (hass && hass.states) || {};
  const E = {
    batt: id("sensor.battery_level"), range: id("sensor.remaining_range"), fuelr: id("sensor.fuel_range"), lock: id("lock.doors"),
    chg: id("binary_sensor.charging"), plug: id("binary_sensor.charger_plugged"), status: id("sensor.charge_status"), cloud: id("binary_sensor.cloud_connection"),
    low: id("binary_sensor.low_beam"), high: id("binary_sensor.high_beam"), clim: id("climate.cabin_climate"), climon: id("binary_sensor.climate_on"), odo: id("sensor.total_odometer"),
    tpw: id("binary_sensor.tire_pressure_warning"), power: id("sensor.power_status"), lockbin: id("binary_sensor.doors_lock_state"), upd: id("sensor.last_updated"), key: id("binary_sensor.key_fob_battery_low"),
    left: id("sensor.remaining_charge_time_h_mm"), ac: id("sensor.ac_charge_current"), dc: id("sensor.dc_charge_current"),
  };
  const devs = devices(hass), tracker = (svc) => { const d = devs.find((v) => v.svc === svc); return d && d.tracker ? eid(d.tracker) : ""; };
  return { hass, cfg, n, id, E, has: (e) => !!st[e], tracker, px: slug(cfg.prefix), name: String(cfg.name || "Deepal S05") };
}
/* Does this update make sense for this vehicle? (e.g. fuel only on a plug-in hybrid) */
function available(hass, cfg, evId) {
  const sp = EV[evId];
  if (!sp.needsFuel && !sp.needsKey && !sp.needsComfort && !sp.needsLeft) return true;
  const x = context(hass, cfg);
  if (sp.needsComfort) return COMFORT.some(([k]) => x.has(eid(x.id(k))));
  if (sp.needsLeft) return x.has(x.E.left);
  if (sp.needsKey) return x.has(x.E.key); /* it makes no sense without the key sensor */
  return cfg.powertrain !== "ev" && x.has(x.E.fuelr);
}

const K_X = (hass, cfg) => context(hass, cfg); /* context for use by the UI */
/* Indicators the "critical warning" / "vehicle warning" notification can include: [key, name] */
function diagOpts(x, evId) {
  const crit = evId === "warn_crit", keyOwn = x.n.events.key_battery.on && x.has(x.E.key); /* the key has its own update: so it does not arrive twice */
  return K.DIAG.filter(([k, , , sv]) => !/tire/.test(k) && !(keyOwn && k === "binary_sensor.key_fob_battery_low") && (crit ? sv === "r" : sv !== "r")).map(([k, nm]) => [k, nm]);
}
/* The logic of each update: pre = Jinja commands that compute something, expr = "applies now" expression */
function logic(x, evId, e) {
  const { E, cfg, n } = x, c = cfg;
  /* Charging: we combine several signals so a false notification is not sent. charge_status is not reliable (it becomes unknown/unavailable when it ends),
     so "charging ended" comes from the AC/DC currents (unavailable does NOT count as 0), and "full" from 100% or the limit + cable still connected */
  const bat = `states('${E.batt}') | float(0)`;
  const curs = [E.ac, E.dc].filter((v) => x.has(v));
  const ended = curs.length ? curs.map((v) => `states('${v}') | float(99) < 0.5`).join(" and ") : `is_state('${E.chg}', 'off')`;
  const charging = `(is_state('${E.chg}', 'on')${curs.map((v) => ` or states('${v}') | float(0) >= 0.5`).join("")})`; /* charging now: sensor or current */
  const plugged = `is_state('${E.plug}', 'on') and not ${charging}`;
  const ref = curs.length ? curs[0] : E.chg;
  switch (evId) {
    case "charge_done": return { expr: `(${ended}) and (${bat} >= 100 or (${bat} >= ${e.thr} and not is_state('${E.plug}', 'off'))) and (now() - states.${ref}.last_changed).total_seconds() < 1800` };
    case "plugged_idle": return { expr: `${plugged} and ${bat} < ${n.events.charge_done.thr}` };
    case "charge_interrupted": {
      /* connected, not charging, below the limit AND charging stopped recently (otherwise it is just "connected but not charging") */
      return { expr: `${plugged} and ${bat} < ${n.events.charge_done.thr} and ${bat} > 0 and (now() - states.${ref}.last_changed).total_seconds() < 7200` };
    }
    case "charge_started": return { expr: `${charging} and (now() - states.${x.has(E.chg) ? E.chg : ref}.last_changed).total_seconds() < 900` };
    case "charge_target": return { expr: `${charging} and ${bat} >= ${e.thr}` };
    case "charge_eta": return { pre: tags("set p = states('" + E.left + "').split(':')", "set mins = ((p[0] | int(0)) * 60 + (p[1] | int(0))) if p | count == 2 else 0"),
      expr: `${charging} and mins > 0 and mins <= ${e.thr}`, left: "{{ mins }}" };
    case "comfort": {
      const list = COMFORT.filter(([k]) => x.has(eid(x.id(k)))).map(([k, nm, t]) => `[${jq(eid(x.id(k)))}, ${jq(T(nm))}, ${jq(t)}]`).join(", ");
      return { pre: tags("set ns = namespace(l=[])", `for e, nm, t in [${list}]`, "if (t == 'bin' and is_state(e, 'on')) or (t == 'num' and states(e) | float(0) > 0)", "set ns.l = ns.l + [nm]", "endif", "endfor"),
        expr: `ns.l | count > 0 and is_state('${E.lock}', 'locked')`, items: "{{ ns.l | join(', ') }}" };
    }
    case "unlocked": return { expr: `is_state('${E.lock}', 'unlocked')${x.has(E.lockbin) ? ` and is_state('${E.lockbin}', 'on')` : ""}` }; /* if present, it is also confirmed by the lock sensor (on = unlocked) */
    case "key_battery": return { expr: `is_state('${E.key}', 'on')` };
    case "lights": return { expr: `is_state('${E.low}', 'on') or is_state('${E.high}', 'on')` };
    case "battery_low": return { expr: `states('${E.batt}') | float(100) > 0 and states('${E.batt}') | float(100) < ${e.thr} and not ${charging}` };
    case "fuel_low": return { expr: `states('${E.fuelr}') | float(100000) > 0 and states('${E.fuelr}') | float(100000) < ${e.thr}` };
    case "climate": return { expr: x.has(E.climon) ? `is_state('${E.climon}', 'on')` : `states('${E.clim}') not in ['off', 'unavailable', 'unknown']` };
    case "offline": return { expr: `states('${E.cloud}') in ['off', 'unavailable']` };
    case "open": {
      /* window: when an opening-percentage sensor also exists, it must show > 0 — otherwise the binary sensor gives a false "open" */
      const op = (k) => { const m = /^binary_sensor\.(.+)_window_open$/.exec(k); const o = m ? eid(x.id(`sensor.${m[1]}_window_opening`)) : ""; return o && x.has(o) ? o : ""; };
      const list = K.OPEN_ITEMS.map(([k, nm]) => `[${jq(eid(x.id(k)))}, ${jq(T(nm))}, ${jq(op(k))}]`).join(", ");
      return { pre: tags("set ns = namespace(l=[])", `for e, nm, op in [${list}]`, "if is_state(e, 'on') and (op == '' or not is_number(states(op)) or states(op) | float(0) > 0)", "set ns.l = ns.l + [nm]", "endif", "endfor"), expr: "ns.l | count > 0", items: "{{ ns.l | join(', ') }}" };
    }
    case "tires": {
      const chk = c.tire_check || "vehicle", own = chk === "limits" || chk === "both", veh = chk === "vehicle" || chk === "both";
      const unit = c.tire_unit === "kPa" || c.tire_unit === "psi" ? c.tire_unit : "bar";
      const conv = unit === "kPa" ? "(b * 100) | round(0) | int" : unit === "psi" ? "(b / 0.0689476) | round(1)" : "b | round(2)";
      const list = K.TIRES.map((t) => `[${jq(eid(x.id(`sensor.${t.id}_tire_pressure`)))}, ${jq(eid(x.id(`binary_sensor.${t.id}_tire_alarm`)))}, ${jq(T(t.name))}]`).join(", ");
      const lo = Number(c.tire_min), hi = Number(c.tire_max);
      const rows = ["set ns = namespace(l=[])", `for s, a, nm in [${list}]`, "set v = states(s) | float(none)", "set u = (state_attr(s, 'unit_of_measurement') or '') | lower",
        "set b = none if v is none else (v / 100 if u == 'kpa' else (v * 0.0689476 if u == 'psi' else (v if u == 'bar' else (v / 100 if v > 50 else v))))"];
      const fmt = (w) => `set ns.l = ns.l + [nm ~ ' ' ~ (${conv}) ~ ' ${unit} (' ~ ${jq(T(w))} ~ ')']`;
      let first = true;
      const br = (cond, body) => { rows.push(`${first ? "if" : "elif"} ${cond}`, body); first = false; };
      if (own && Number.isFinite(lo)) br(`b is not none and b < ${lo}`, fmt("low"));
      if (own && Number.isFinite(hi)) br(`b is not none and b > ${hi}`, fmt("high"));
      if (veh) br("is_state(a, 'on')", `set ns.l = ns.l + [nm ~ ' (' ~ ${jq(T("alarm"))} ~ ')']`);
      if (!first) rows.push("endif");
      rows.push("endfor");
      if (veh) rows.push(`if is_state('${E.tpw}', 'on') and ns.l | count == 0`, `set ns.l = [${jq(T("check pressure"))}]`, "endif");
      return { pre: tags(...rows), expr: "ns.l | count > 0", items: "{{ ns.l | join(', ') }}" };
    }
    case "warn_crit": case "warn": {
      const crit = evId === "warn_crit";
      const base = diagOpts(x, evId).filter(([k]) => !e.items || e.items.includes(k)).map(([k, nm]) => [eid(x.id(k)), T(nm)]);
      const custom = crit ? [] : (Array.isArray(c.diag_custom) ? c.diag_custom : []).filter((d) => d && typeof d.entity === "string" && EID_RE.test(d.entity)).map((d) => [d.entity, T(String(d.label || d.entity).slice(0, 60))]);
      const list = [...base, ...custom].map(([en, nm]) => `[${jq(en)}, ${jq(nm)}]`).join(", ");
      return { pre: tags("set ns = namespace(l=[])", `for e, nm in [${list}]`, "if states(e) in ['on', 'problem', 'alarm']", "set ns.l = ns.l + [nm]", "endif", "endfor"), expr: "ns.l | count > 0", items: "{{ ns.l | join(', ') }}", empty: !base.length && !custom.length };
    }
  }
  return { expr: "false" };
}


function devices(hass){return Array.isArray(hass?.__companionNotifyDevices)?hass.__companionNotifyDevices:[];}
function ruleCondition(x, evId) {
  const { E, n, px } = x, e = n.events[evId], s = EV[evId], q = n.quiet;
  const lg = logic(x, evId, e);
  /* "parked": the vehicle is off (sensor.power_status = off) for e.park minutes (0 = as soon as it turns off); without that sensor, the odometer has not changed for that long */
  const parts = [`(${lg.expr})`];
  if (e.parked && s.ctl.includes("parked")) {
    const sec = e.park * 60;
    if (x.has(E.power)) parts.push(`(is_state('${E.power}', 'off')${sec ? ` and (now() - states.${E.power}.last_changed).total_seconds() >= ${sec}` : ""})`);
    else if (x.has(E.odo) && sec) parts.push(`((now() - states.${E.odo}.last_changed).total_seconds() >= ${sec})`);
  }
  /* "away from home": sent only to the phones that are not at home (each phone's location); phones with no known location are always notified */
  const awayOn = e.away && s.ctl.includes("away") ? n.devices.map((svc) => [svc, x.tracker(svc)]) : [];
  const trk = new Map(awayOn.filter(([, t]) => t));
  if (awayOn.length && trk.size === awayOn.length) parts.push(`not (${[...trk.values()].map((t) => `is_state('${t}', 'home')`).join(" and ")})`);
  /* old data: if the vehicle has not updated for that long, we do not know whether it still applies */
  if (n.fresh && evId !== "offline" && x.has(E.upd)) parts.push(`(as_timestamp(states('${E.upd}'), 0) > 0 and as_timestamp(now()) - as_timestamp(states('${E.upd}'), 0) <= ${n.fresh * 60})`);
  const full = parts.join(" and ");
  const active = `${lg.pre ? lg.pre + "\n" : ""}{{ ${full} }}`;
  return active;
}
NF.localRules = (hass, cfg) => {
  const x=context(hass,cfg);
  return EV_IDS.filter(id=>available(hass,cfg,id)).map(id=>{
    const spec=EV[id],event=x.n.events[id],lg=logic(x,id,event);
    const variables={};
    const number=en=>`{{ states('${en}') | float(none) }}`;
    Object.assign(variables,{name:x.name,battery:number(x.E.batt),range:number(x.E.range),fuel_range:number(x.E.fuelr),minutes:`{{ ${event.delay} + (repeat.index - 1) * ${event.repeat} }}`,items:lg.items?`${lg.pre}\n${lg.items}`:'',left:lg.left?`${lg.pre}\n${lg.left}`:''});
    return {id,name:spec.label,enabled:false,preset:id,preset_options:{...event},threshold:spec.thr||null,controls:spec.ctl,fresh:x.n.fresh,devices:[...x.n.devices],condition:ruleCondition(x,id),
      title:event.title||spec.title,message:event.text||spec.text,variables,
      delay:event.delay*60,repeat:event.repeat*60,max_sends:cnt(event),cooldown:id==='charge_done'||id==='charge_started'?1800:0,
      severity:event.sev,quiet:{enabled:x.n.quiet.on,from:x.n.quiet.from,to:x.n.quiet.to,mode:x.n.quiet.mode==='skip'?'skip':'silent'},
      url:x.n.url||'/deepal-companion',buttons:[...event.actions],data:{notification_icon:event.icon||spec.icon},
      recipient_conditions:event.away?Object.fromEntries(x.n.devices.map(service=>[service,x.tracker(service)?`{{ not is_state('${x.tracker(service)}', 'home') }}`:'true'])):{}};
  });
};
NF.localCondition = (hass,cfg,rule) => {
  const notify=norm(cfg.notify);notify.on=true;notify.devices=rule.devices;notify.fresh=rule.fresh;
  notify.events[rule.preset]={...notify.events[rule.preset],...rule.preset_options,on:true};
  return ruleCondition(context(hass,{...cfg,notify}),rule.preset);
};

Object.assign(NF,{EV,EV_IDS,norm,compact,presets:PRESETS,diagnosticChoices:(hass,cfg,id)=>diagOpts(context(hass,cfg),id).filter(([key])=>hass?.states?.[K.resolveId(hass,cfg,key)])});
return NF;
}
