/* Conditions built for the "parked" alerts: the defaults and the user's own advanced rows. Plain Node, no browser: node tests/test_advanced_conditions.cjs */
const assert = require("assert"), path = require("path"), {pathToFileURL} = require("url");
(async () => {
  const {createNotificationRules} = await import(pathToFileURL(path.join(__dirname, "..", "custom_components", "deepal_companion", "frontend", "notification-rules.js")).href);
  const K = {T: (t, ...a) => t.replace(/\{(\d+)\}/g, (m, i) => a[i] ?? ""), DIAG: [], OPEN_ITEMS: [["binary_sensor.front_left_door", "Front left door"]], TIRES: [], resolveId: (hass, cfg, key) => key.replace(".", ".s05_")};
  const NF = createNotificationRules(K);
  const states = {};
  for (const e of ["sensor.s05_power_status", "binary_sensor.s05_engine", "sensor.s05_total_odometer", "lock.s05_doors", "binary_sensor.s05_doors_lock_state", "binary_sensor.s05_low_beam", "binary_sensor.s05_high_beam", "binary_sensor.s05_any_door_open", "cover.s05_windows", "binary_sensor.s05_charger_plugged", "binary_sensor.s05_charging", "binary_sensor.s05_climate_on", "sensor.s05_battery_level", "binary_sensor.s05_front_left_door"]) states[e] = {state: "off"};
  const hass = {states};
  const rule = (events) => NF.localRules(hass, {prefix: "s05", notify: {events}}).find((r) => r.preset === "unlocked");

  const def = rule({});
  assert(def.condition.includes("is_state('sensor.s05_power_status', 'off') or"), "default: off, or on and not moving");
  assert(def.condition.includes("total_odometer"), "default uses the odometer");
  assert.equal(def.preset_options.adv.on, false);

  const advanced = rule({unlocked: {adv: {on: true, mode: "any", rows: [{s: "power", v: "off", t: 15}, {s: "odo", v: "still", t: 30}]}}});
  assert(advanced.condition.includes("is_state('sensor.s05_power_status', 'off') and (now() - states.sensor.s05_power_status.last_changed).total_seconds() >= 900"));
  assert(advanced.condition.includes("states.sensor.s05_total_odometer.last_changed).total_seconds() >= 1800"));
  assert(/\) or \(now\(\)/.test(advanced.condition) || advanced.condition.includes(" or "), "any = or");
  assert(!advanced.condition.includes("is_state('sensor.s05_power_status', 'on')"), "the default gate is replaced");

  const all = rule({unlocked: {adv: {on: true, mode: "all", rows: [{s: "lights", v: "on", t: 0}, {s: "odo", v: "still", t: 1}]}}});
  assert(all.condition.includes("(is_state('binary_sensor.s05_low_beam', 'on')) or (is_state('binary_sensor.s05_high_beam', 'on'))"), "lights: any of them on");
  assert(all.condition.includes(">= 120"), "a still odometer counts at least 2 minutes");
  assert(all.condition.includes(") and ("), "all = and");

  const off = rule({unlocked: {adv: {on: false, mode: "any", rows: [{s: "power", v: "on", t: 5}]}}});
  assert(off.condition.includes("total_odometer"), "advanced off: the default gate stays");
  const junk = rule({unlocked: {adv: {on: true, mode: "x", rows: [{s: "nope", v: "on", t: 1}, {s: "power", v: "bad", t: 1}, null]}}});
  assert.deepEqual(junk.preset_options.adv, {on: true, mode: "any", rows: []}, "unknown rows are dropped");
  assert(junk.condition.includes("total_odometer"), "no valid rows: the default gate stays");
  const nodoor = NF.localRules({states: {"sensor.s05_power_status": {state: "off"}, "lock.s05_doors": {state: "locked"}}}, {prefix: "s05", notify: {events: {unlocked: {adv: {on: true, mode: "any", rows: [{s: "win", v: "open", t: 0}]}}}}}).find((r) => r.preset === "unlocked");
  assert(nodoor && !nodoor.condition.includes("cover.s05_windows"), "a sensor the car does not have is ignored");
  /* "Why isn't it sending?": the same conditions, one by one */
  assert(def.checks.length >= 4 && def.checks[0].label === "Doors are unlocked", "defaults: the situation, then the parked checks");
  assert(def.checks.some((c) => c.label === "Power status is off" && c.show.includes("states('sensor.s05_power_status')")), "default: power check shows the value");
  assert(advanced.checks.some((c) => c.label.startsWith("Odometer: Not changing for at least 30 min") && c.show.includes("odometer last changed")), "advanced: one check per row");
  assert(advanced.checks.some((c) => c.label === "Any of your conditions is true"), "advanced: the combination");
  assert(def.checks.every((c) => c.label && c.test.includes("{{")), "every check is a template");
  assert(def.checks.every((c) => typeof c.help === "string" && c.help.length > 20 && c.help.length <= 1500), "default: every check has an explanation");
  assert(advanced.checks.every((c) => c.help && c.help.length <= 1500), "advanced: every check has an explanation");
  assert(def.checks.find((c) => c.label === "Power status is off").show.includes("changed"), "values say when the sensor last changed");
  const unparked = NF.localRules(hass, {prefix: "s05", notify: {events: {unlocked: {parked: false}}}}).find((r) => r.preset === "unlocked");
  assert.equal(unparked.checks.length, 1, "not parked: only the situation");
  console.log("advanced conditions: ok");
})().catch((e) => { console.error(e); process.exit(1); });
