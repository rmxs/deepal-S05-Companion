/* ───────────────────────── "Energy" sheet (lazy module) ─────────────────────────
 * Loaded ONLY when the user taps the battery tile (dist/energy/energy.js); the card's main file does not contain it.
 * It reads the HA history (history/history_during_period) for battery, AC/DC charging current, odometer and power_status.
 * It writes nothing and sends no commands to the vehicle. Sources: src/energy/*.js — build: scripts/build.sh */
(function () {
"use strict";
const EN = (window.__DEEPAL_S05_ENERGY = window.__DEEPAL_S05_ENERGY || {});
let K = null; /* shared card tools: { esc, T, ico, I18N, resolveId } — given by the card in init() */
const fill = (s, a) => String(s).replace(/\{(\d+)\}/g, (m, i) => (a[i] ?? ""));
const T = (s, ...a) => (K ? K.T(s, ...a) : fill(s, a));
const ico = (n, c) => (K ? K.ico(n, c) : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* ───── Data: history → series → charges, drives, daily figures ───── */
const DAYS_BACK = 5, CHG_A = 0.5, GAP = 15 * 60e3, MIN_CHG = 8 * 60e3, DRV_GAP = 12 * 60e3, DEF_KWH = 18.4, DEF_TANK = 51;
const ts = (v) => { if (typeof v === "number") return v > 1e11 ? v : v * 1000; const n = Date.parse(v); return Number.isFinite(n) ? n : NaN; };
const num = (s) => { if (s === null || s === undefined || s === "" || s === "unknown" || s === "unavailable") return NaN; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
/* HA history (minimal_response) → [[t, state]] sorted */
function rowsOf(list) {
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r) continue;
    const t = ts(r.lu ?? r.lc ?? r.last_updated ?? r.last_changed), s = r.s !== undefined ? r.s : r.state;
    if (Number.isFinite(t)) out.push([t, s]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
const numSeries = (rows) => rows.map(([t, s]) => [t, num(s)]).filter((p) => Number.isFinite(p[1]));
/* last known value at time t (before the first reading: the first one) */
function at(ser, t) {
  if(!ser.length)return NaN;
  let lo=0,hi=ser.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(ser[mid][0]<=t)lo=mid+1;else hi=mid;}
  const value=lo?ser[lo-1][1]:NaN;
  return Number.isFinite(value)?value:ser[0][1];
}
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* Charges from the AC/DC currents. The "charging" binary_sensor is not reliable on this vehicle, while the current is.
   unavailable/unknown values do NOT count as 0: we keep the previous state up to GAP. Gaps ≤ GAP are joined. */
function chargeSegments(acRows, dcRows, now, liveOk = true) {
  const A = acRows.map(([t, s]) => [t, num(s)]), D = dcRows.map(([t, s]) => [t, num(s)]);
  const times = [...new Set([...A, ...D].map((p) => p[0]))].sort((a, b) => a - b);
  if (!times.length) return [];
  const states=new Map();let ai=0,di=0,a=NaN,d=NaN;
  for(const t of times){
    while(ai<A.length&&A[ai][0]<=t)a=A[ai++][1];
    while(di<D.length&&D[di][0]<=t)d=D[di++][1];
    const validA=Number.isFinite(a),validD=Number.isFinite(d);
    states.set(t,validA||validD?(validA&&a>CHG_A)||(validD&&d>CHG_A):null);
  }
  const state=t=>states.get(t);
  const iv = []; let prev = false;
  times.forEach((t, i) => {
    const e = i + 1 < times.length ? times[i + 1] : now, st = state(t);
    if (st === null) {
      const keep = Math.min(e - t, GAP);
      if (prev && keep > 0) iv.push([t, t + keep, true]);
      if (e - t > keep) iv.push([t + keep, e, false]);
      if (e - t > GAP) prev = false;
    } else { iv.push([t, e, st]); prev = st; }
  });
  const segs = [];
  for (const [s, e, on] of iv) {
    if (!on || e <= s) continue;
    const last = segs[segs.length - 1];
    if (last && s - last.e <= GAP) last.e = Math.max(last.e, e); else segs.push({ s, e });
  }
  /* DC only if the DC current is active for at least half of the charge; a momentary sensor spike does not make it DC */
  const prefix=[0];
  for(let i=0;i<D.length;i++)prefix.push(prefix[i]+(D[i][1]>CHG_A?Math.max(0,(i+1<D.length?D[i+1][0]:now)-D[i][0]):0));
  const dcArea=t=>{
    let lo=0,hi=D.length;while(lo<hi){const mid=(lo+hi)>>>1;if(D[mid][0]<=t)lo=mid+1;else hi=mid;}
    if(!lo)return 0;const i=lo-1;
    return prefix[i]+(D[i][1]>CHG_A?Math.max(0,Math.min(t,now)-D[i][0]):0);
  };
  const dcTime=(s,e)=>dcArea(e)-dcArea(s);
  return segs.filter((g) => g.e - g.s >= MIN_CHG).map((g) => ({ s: g.s, e: g.e, dc: dcTime(g.s, g.e) >= (g.e - g.s) / 2, live: liveOk && g.e >= now - 3 * 60e3 && state(times[times.length - 1]) !== false }));
}
/* Drives: periods when the car is on (power_status = on) and the odometer increases; without power_status: from odometer increases */
function driveSegments(powRows, odo, now) {
  const km = (s, e) => Math.max(0, at(odo, e) - at(odo, s));
  let out = [];
  if (powRows.length) {
    let st = null;
    for (let i = 0; i < powRows.length; i++) {
      const on = powRows[i][1] === "on";
      if (on && st === null) st = powRows[i][0];
      if (!on && st !== null && powRows[i][1] !== "unavailable" && powRows[i][1] !== "unknown") { out.push({ s: st, e: powRows[i][0] }); st = null; }
    }
    if (st !== null) out.push({ s: st, e: now });
  } else {
    for (let i = 1; i < odo.length; i++) if (odo[i][1] > odo[i - 1][1]) {
      const l = out[out.length - 1], s = Math.max(odo[i - 1][0], odo[i][0] - DRV_GAP);
      if (l && s - l.e <= DRV_GAP) l.e = odo[i][0]; else out.push({ s, e: odo[i][0] });
    }
  }
  return out.map((d) => ({ s: d.s, e: d.e, km: km(d.s, d.e) })).filter((d) => d.km >= 0.2 && d.km < 800);
}
/* Petrol sensor: we ignore momentary "holes" (e.g. 68 → 0 → 68 within a few minutes) that would otherwise count as huge consumption */
function despike(ser) {
  return ser.filter((p, i) => {
    const a = ser[i - 1], n = ser[i + 1]; if (!a || !n) return true;
    return !(p[1] < a[1] - 8 && n[0] - p[0] <= 15 * 60e3 && Math.abs(n[1] - a[1]) <= 2);
  });
}
/* All together for the sheet. cap = battery capacity in kWh (setting) */
function model(raw, now, cap, t0in, nDays = DAYS_BACK, liveOk = true) {
  const batt = despike(numSeries(raw.batt)), odo = numSeries(raw.odo);
  const chg = chargeSegments(raw.ac, raw.dc, now, liveOk);
  chg.forEach((g) => {
    g.from = at(batt, g.s);
    const endT = g.live ? now : Math.min(now, g.e + 10 * 60e3); g.to = at(batt, endT);
    g.kwh = cap > 0 && Number.isFinite(g.from) && Number.isFinite(g.to) && g.to > g.from ? (g.to - g.from) / 100 * cap : null;
  });
  const drv = driveSegments(raw.pow, odo, now);
  const days = [], t0 = t0in !== undefined ? t0in : dayStart(now - (DAYS_BACK - 1) * 86400000);
  for (let i = 0; i < nDays; i++) { const s = new Date(t0); s.setDate(s.getDate() + i); days.push({ t: s.getTime(), key: dayKey(s.getTime()), km: 0, kwh: 0, n: 0 }); }
  drv.forEach((d) => { const x = days.find((y) => y.key === dayKey(d.s)); if (x) x.km += d.km; });
  chg.forEach((g) => { const x = days.find((y) => y.key === dayKey(g.s)); if (x) { x.n++; if (g.kwh) x.kwh += g.kwh; } });
  // Keep a low-water baseline across drives: small rebounds must not be consumed twice.
  // Estimated battery energy discharged during drives; charging starts a new baseline.
  let batteryBase = NaN;
  for (let i = 0; i < batt.length; i++) {
    const [t, value] = batt[i];
    if (value < 0 || value > 100) continue;
    const charging = chg.some((g) => t >= g.s && t <= g.e);
    if (!Number.isFinite(batteryBase) || charging || value >= batteryBase + 2) { batteryBase = value; continue; }
    if (value >= batteryBase) continue;
    const next = batt[i + 1];
    if (batteryBase - value > 8 && (!next || next[1] > value + 2)) continue;
    const drop = batteryBase - value; batteryBase = value;
    const drive = drv.find((d, j) => t > d.s && t <= Math.min(d.e + 10 * 60e3, j + 1 < drv.length ? drv[j + 1].s : Infinity));
    if (!drive || !(cap > 0)) continue;
    const day = days.find((d) => d.key === dayKey(t));
    if (day) day.batteryUsed = (day.batteryUsed || 0) + drop * cap / 100;
  }
  const fuel = despike(numSeries(raw.fuel).filter((p) => p[1] >= 0 && p[1] <= 100));
  let fuelUsed = false, base = fuel.length ? fuel[0][1] : NaN;
  drv.forEach((d) => { d.fuel = 0; });
  for (let i = 1; i < fuel.length; i++) {
    const [t, value] = fuel[i], next = fuel[i + 1];
    // A rise of at least 5 points is a refill only when another reading supports it.
    if (value >= base + 5) {
      if (next && next[1] >= value - 2) base = value;
      continue;
    }
    if (value >= base) continue;
    // Large drops remain provisional until a second low reading confirms them.
    if (base - value > 8 && (!next || next[1] > value + 2)) continue;
    const drop = base - value; base = value;
    const d = drv.find((d, j) => t > d.s && t <= Math.min(d.e + 10 * 60e3, j + 1 < drv.length ? drv[j + 1].s : Infinity));
    if (!d) continue;
    d.fuel += drop; fuelUsed = true;
    const day = days.find((x) => x.key === dayKey(t));
    if (day) day.fuel = (day.fuel || 0) + drop;
  }
  return { batt, chg, drv, days, t0, now, nDays, fuel, fuelUsed, hasData: batt.length > 0 };
}
/* ───── The sheet: current state, 5-day battery curve, per day, list of charges ───── */
const PCSS = `
.enpanel .ldr{display:flex;align-items:center;justify-content:center;gap:12px;min-height:96px;padding:24px;font-size:12px;color:var(--ds-fg2)}.enpanel .ldr .ring{position:relative;display:grid;place-items:center;width:36px;height:36px;flex:none}.enpanel .ldr .arc{position:absolute;inset:0;width:36px;height:36px;animation:ds-spin 1.1s linear infinite}.enpanel .ldr .i{position:relative;width:18px;height:18px;color:rgb(var(--ds-ok))}@keyframes ds-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.enpanel .ldr .arc{animation:none}}
.enpanel .en-cost-tabs {display:flex;gap:8px;margin-bottom:10px}.enpanel .en-cost-tabs button {border:1px solid var(--ds-line);border-radius:10px;padding:8px 12px;background:transparent;color:var(--ds-fg);font:inherit;font-size:12px;cursor:pointer}.enpanel .en-cost-tabs button[aria-pressed=true] {background:rgba(var(--ds-ok),.14);border-color:rgba(var(--ds-ok),.4)}.enpanel .en-cost-heading h3 {font-size:16px;margin:6px 0}.enpanel .en-cost-heading small {font-size:11px;color:var(--ds-fg2)}
.enpanel .cc-summary {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--ds-line);border-radius:16px;background:rgba(121,173,255,.045)}
.enpanel .cc-summary small {display:block;color:var(--ds-fg2);font-size:11px;line-height:1.5}
.enpanel .cc-summary b {display:block;font-size:23px;font-variant-numeric:tabular-nums}
.enpanel .cc-button {border:1px solid var(--ds-line);border-radius:11px;padding:9px 12px;background:rgba(128,128,128,.07);color:var(--ds-fg);font:inherit;font-size:12px;cursor:pointer}
.enpanel .cc-button.primary {background:rgba(var(--ds-ok),.16);border-color:rgba(var(--ds-ok),.35)}
.enpanel .cc-button:disabled {opacity:.5}
.enpanel .cc-button.danger{color:rgb(var(--ds-bad));border-color:rgba(var(--ds-bad),.35);background:rgba(var(--ds-bad),.08);margin-top:10px}
.enpanel .cc-delete-confirm{border:1px solid rgba(var(--ds-bad),.35);border-radius:12px;padding:12px;margin-top:12px}.enpanel .cc-delete-confirm p{font-size:12px;line-height:1.5;margin:0 0 8px}
.enpanel .cc-name-field{position:relative}.enpanel .cc-name-options{position:absolute;top:100%;left:0;right:0;z-index:5;padding:4px;background:var(--ds-card);border:1px solid var(--ds-line);border-radius:11px;box-shadow:0 8px 24px #0004}.enpanel .cc-name-options[hidden]{display:none}.enpanel .cc-name-options button{display:block;width:100%;min-height:42px;border:0;border-radius:7px;padding:8px 10px;text-align:left;font:inherit;color:var(--ds-fg);background:transparent}.enpanel .cc-name-options button:hover,.enpanel .cc-name-options button[aria-selected=true]{background:rgba(var(--ds-info),.15)}
.enpanel .cc-editor:empty {display:none}
.enpanel .cc-editor form {padding:14px;border:1px solid var(--ds-line);border-radius:16px;background:rgba(128,128,128,.045)}
.enpanel .cc-editor-head,.enpanel .cc-actions {display:flex;align-items:center;justify-content:space-between;gap:8px}
.enpanel .cc-editor-head b {font-size:14px}
.enpanel .cc-grid {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}
.enpanel .cc-field {display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--ds-fg2);min-width:0}
.enpanel .cc-field input,.enpanel .cc-field select {box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--ds-line);border-radius:8px;background:var(--ds-card,#202226);color:var(--ds-fg);font:inherit;font-size:13px;padding:9px;outline-offset:2px}
.enpanel .cc-check {display:flex;align-items:center;gap:7px;font-size:12px}
.enpanel .cc-check input {accent-color:rgb(var(--ds-ok));width:17px;height:17px}
.enpanel .cc-profile {border:1px solid var(--ds-line);border-radius:12px;margin:12px 0;padding:8px 12px}
.enpanel .cc-profile legend {font-size:12px;color:var(--ds-fg)}
.enpanel .cc-info{padding:10px 12px;border:1px solid rgba(121,173,255,.3);border-radius:10px;background:rgba(121,173,255,.08);font-size:11px;line-height:1.5}.enpanel .cc-info[hidden]{display:none}
.enpanel .cc-hint {font-size:11px;line-height:1.5;color:var(--ds-fg2);margin:9px 0}
.enpanel .cc-session-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;margin:6px 0 18px}.enpanel .cc-session-row .cc-session{margin:0}.enpanel .cc-curve{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;color:rgb(var(--ds-ok))}.enpanel .cc-curve svg{width:18px;height:18px}@media(max-width:380px){.enpanel .cc-curve{flex-direction:column;font-size:10px}}
.enpanel .cc-session {box-sizing:border-box;width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid var(--ds-line);border-radius:12px;background:rgba(121,173,255,.035);padding:12px 14px;color:var(--ds-fg);text-align:left;font:inherit;font-size:12px;cursor:pointer;margin:6px 0 18px}
.enpanel .cc-session .cc-location-name{display:block;font-size:12px;font-weight:600;margin-bottom:4px}.enpanel .cc-session>span:first-child{min-width:0;overflow-wrap:anywhere}
.enpanel .cc-session small {display:block;font-size:10px;line-height:1.6;color:var(--ds-fg2)}
.enpanel .cc-session .cc-price-badge {flex:none;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(var(--ds-ok),.09);color:rgb(var(--ds-ok))}.enpanel .cc-session b{font-size:14px;white-space:nowrap;font-variant-numeric:tabular-nums}.enpanel .cc-session .cc-price-badge small{font-size:9px}.enpanel .cc-session .cc-price-badge i{font-style:normal;opacity:.65}
.enpanel .en-body.is-period-loading{position:relative}.en-period-loader{position:absolute;inset:0;z-index:2;display:grid;place-items:center;border-radius:12px;background:var(--ds-card,#202226);opacity:.94;min-height:120px}.en-period-loader .ds-loader{margin:0}.enpanel .is-period-loading .en-cw>svg{visibility:hidden}.enpanel .is-period-loading .en-cw{position:relative}.enpanel .en-load-error{padding:12px;color:rgb(var(--ds-warn));font-size:12px}
.cc-charts{position:relative;border:1px solid var(--ds-line,var(--divider-color));border-radius:14px;padding:12px;margin:12px 0}.cc-chart-tip{position:absolute;right:12px;top:36px;max-width:calc(100% - 24px);z-index:2;pointer-events:none;padding:7px 10px;border:1px solid var(--ds-line,var(--divider-color));border-radius:10px;background:var(--ds-card,var(--card-background-color));color:var(--ds-fg,var(--primary-text-color));font-size:11px;box-shadow:0 4px 18px #0004}.cc-chart-tip[hidden]{display:none}.cc-chart-heading{font-size:13px;font-weight:600;margin-bottom:10px}.cc-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cc-chart{min-width:0}.cc-chart b{font-size:11px}.cc-chart svg{display:block;width:100%;color:var(--ds-fg,var(--primary-text-color))}.cc-charts small{font-size:10px;line-height:1.5;color:var(--ds-fg2,var(--secondary-text-color))}@media(max-width:480px){.cc-chart-grid{grid-template-columns:1fr}}
.enpanel .cc-location {margin:12px 0} .enpanel .cc-advanced {margin:10px 0 14px} .enpanel .cc-advanced summary {font-size:11px;color:var(--ds-fg2);cursor:pointer} .enpanel .cc-day-cost {display:block;font-size:10px;line-height:1.5;color:var(--ds-fg2)}
.enpanel [data-cc-entity-field][hidden],.enpanel .cc-paid[hidden]{display:none}.enpanel .cc-profile-head{display:grid;grid-template-columns:1fr auto;align-items:end;gap:12px}.enpanel .cc-profile-head .cc-check{padding-bottom:10px}.enpanel .cc-actions{margin-top:12px}.enpanel .cc-profile{min-width:0}.enpanel .cc-profiles{min-width:0}
.enpanel .cc-location-details{border:1px solid var(--ds-line);border-radius:14px;margin:8px 0}.enpanel .cc-location-details>summary{display:flex;gap:10px;align-items:center;min-height:48px;padding:10px 12px;cursor:pointer;list-style:none}.enpanel .cc-location-details>summary>span:first-child{flex:1}.enpanel .cc-location-details>summary small{font-size:11px;color:var(--ds-fg2)}.enpanel .cc-location-details>summary::-webkit-details-marker{display:none}.enpanel .cc-location-details .cc-profile{border:0}.enpanel .cc-location-details[open]>summary{border-bottom:1px solid var(--ds-line)}
@media(max-width:420px){.enpanel .cc-grid{gap:9px}.enpanel .cc-summary{padding:10px}.enpanel .cc-editor form{padding:10px}.enpanel .cc-profile{padding:6px 8px}}

.enpanel { flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; display:flex; flex-direction:column; gap:22px; padding:8px 6px 26px; color: var(--ds-fg); }
.enpanel .en-nav [data-wk]{color:var(--ds-fg,var(--primary-text-color,#eee))}.enpanel .en-nav [data-wk] .i{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.enpanel .en-nav [data-wk] .i path{fill:none;stroke:inherit}
.enpanel .en-nav { display:flex; align-items:center; flex-wrap:wrap; gap:10px; } .enpanel .en-nav .btn { width:44px; height:40px; padding:0; display:grid; place-items:center; } .enpanel .en-nav .btn[disabled] { opacity:.35; cursor:default; pointer-events:none; } .enpanel .en-wk { flex:1; text-align:center; } .enpanel .en-wk b { display:block; font-size:14.5px; font-weight:600; } .enpanel .en-wk small { display:block; margin-top:1px; font-size:12px; color: var(--ds-fg2); } .enpanel .en-lim { flex-basis:100%; text-align:center; }
.enpanel .en-period { display:flex; gap:3px; padding:3px; border:1px solid var(--ds-line); border-radius:12px; } .enpanel .en-period button { border:0; border-radius:9px; padding:7px 12px; background:transparent; color:var(--ds-fg2); font:inherit; font-size:12px; cursor:pointer; } .enpanel .en-period button[aria-pressed="true"] { background:rgba(121,173,255,.16); color:var(--ds-fg); } .enpanel .en-dates { display:flex; align-items:center; gap:8px; margin-left:auto; } .enpanel .en-dates .en-wk { min-width:140px; } .enpanel .en-nav { justify-content:center; padding:10px; border:1px solid var(--ds-line); border-radius:14px; gap:10px; } @media(max-width:480px) { .enpanel .en-dates { margin-left:0; } }
.enpanel .en-body { display:flex; flex-direction:column; gap:20px; }
.enpanel .en-now { border-radius:18px; padding:14px 16px; background: rgba(var(--rgb-primary-text-color, 255,255,255), .045); border:1px solid var(--ds-line); }
.enpanel .en-now.chg { background: rgba(var(--ds-ok), .12); border-color: rgba(var(--ds-ok), .35); }
.enpanel .en-st { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:14.5px; font-weight:600; }
.enpanel .en-st span.s { display:flex; align-items:center; gap:8px; } .enpanel .en-st .i { --is:20px; } .enpanel .en-now.chg .en-st .i { color: rgb(var(--ds-ok)); }
.enpanel .en-st small { font-size:12px; font-weight:500; color: var(--ds-fg2); }
.enpanel .en-big { display:flex; align-items:baseline; gap:10px; margin-top:8px; flex-wrap:wrap; } .enpanel .en-big b { font-size:38px; line-height:1; font-weight:600; font-variant-numeric: tabular-nums; } .enpanel .en-big span { font-size:14px; color: var(--ds-fg2); }
.enpanel .en-sub { margin-top:4px; font-size:13px; color: var(--ds-fg2); line-height:1.45; }
.enpanel .en-leg { display:flex; flex-wrap:wrap; gap:6px 14px; margin:0 0 4px; font-size:12px; color: var(--ds-fg2); } .enpanel .en-leg i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
.enpanel .en-cw { position:relative; } .enpanel .en-tip { position:absolute; top:2px; z-index:2; pointer-events:none; padding:8px 10px; border-radius:12px; font-size:12px; line-height:1.5; background: var(--ds-card, #1b1f27); border:1px solid var(--ds-line); box-shadow:0 4px 14px rgba(0,0,0,.35); font-variant-numeric: tabular-nums; white-space:nowrap; } .enpanel .en-tip[hidden] { display:none; } .enpanel .en-tip b { display:block; font-weight:600; margin-bottom:2px; } .enpanel .en-tip i { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
.enpanel svg.en-ch { cursor:crosshair; touch-action:pan-y; user-select:none; -webkit-user-select:none;} .enpanel svg.en-ch { display:block; width:100%; height:auto; overflow:visible; } .enpanel svg text { font-size:11px; fill: var(--ds-fg2); }
.enpanel .en-tb { display:grid; grid-template-columns: 1.1fr .7fr 1fr 1fr; gap:6px; font-size:13px; padding:8px 2px; border-top:1px solid var(--ds-line); font-variant-numeric: tabular-nums; }
.enpanel .en-tb.f4 { grid-template-columns: 1fr .65fr 1fr 1fr .85fr; } .enpanel .en-tb .fu { color: #f3bd62; }
.enpanel .en-tb .bu { color:#79adff; } .enpanel .en-tb > span { min-width:0; overflow-wrap:anywhere; }
.enpanel .en-info { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1px solid var(--ds-line); border-radius:12px; background:rgba(128,128,128,.05); color:var(--ds-fg2); font-size:11px; line-height:1.45; } .enpanel .en-info p { margin:0; font:inherit; } .enpanel .en-info p + p { margin-top:3px; } .enpanel .en-info-icon { flex:none; font-size:14px; line-height:1.3; }
.enpanel .en-tb.h { border-top:0; padding:0 2px 4px; font-size:11.5px; color: var(--ds-fg2); } .enpanel .en-tb > :not(:first-child) { text-align:right; } .enpanel .en-tb .z { color: var(--ds-fg2); } .enpanel .en-tb .ok { color: rgb(var(--ds-ok)); }
.enpanel .en-li { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 2px; border-top:1px solid var(--ds-line); font-size:13.5px; }
.enpanel .en-li .a { display:flex; gap:12px; min-width:0; flex:1; align-items:center; } .enpanel .en-li .ic { flex:none; width:34px; height:34px; border-radius:50%; background: rgba(var(--ds-ok), .14); color: rgb(var(--ds-ok)); display:flex; align-items:center; justify-content:center; } .enpanel .en-li .ic .i { --is:18px; }
.enpanel .en-li .mid { flex:1; min-width:0; } .enpanel .en-li .bd { font-size:10px; font-weight:600; padding:1px 7px; border-radius:8px; margin-left:6px; background: rgba(var(--ds-ok), .14); color: rgb(var(--ds-ok)); vertical-align:1px; }
.enpanel .en-li .bar { position:relative; height:6px; border-radius:3px; background: var(--ds-line); margin:7px 0 4px; overflow:hidden; } .enpanel .en-li .bar i { position:absolute; top:0; bottom:0; border-radius:3px; background: rgb(var(--ds-ok)); }
.enpanel .en-li .b { text-align:right; font-size:16px; font-weight:600; color: rgb(var(--ds-ok)); font-variant-numeric: tabular-nums; white-space:nowrap; }
.enpanel .en-li small { display:block; color: var(--ds-fg2); font-size:12px; font-variant-numeric: tabular-nums; }
.enpanel .en-tot { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:8px; } .enpanel .en-tot div { border-radius:12px; padding:9px 12px; background: rgba(var(--rgb-primary-text-color, 255,255,255), .04); border:1px solid var(--ds-line); font-size:12px; color: var(--ds-fg2); } .enpanel .en-tot b { display:block; margin-top:2px; font-size:18px; font-weight:600; color: var(--ds-fg); font-variant-numeric: tabular-nums; } .enpanel .en-tot b.ok { color: rgb(var(--ds-ok)); }
.enpanel .en-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px 18px; text-align:center; color: var(--ds-fg2); font-size:13.5px; line-height:1.5; }
`;
const CL_OK = "rgb(var(--ds-ok))", CL_DRV = "#79adff", CL_FUEL = "#f3bd62";
const ENT = { batt: "sensor.battery_level", ac: "sensor.ac_charge_current", dc: "sensor.dc_charge_current", odo: "sensor.total_odometer", pow: "sensor.power_status", fuel: "sensor.fuel_level", range: "sensor.remaining_range", left: "sensor.remaining_charge_time_h_mm", tank: "sensor.fuel_tank_capacity" };

/* Smooth curve (monotone cubic: no overshoot) from points [x,y] with increasing x */
function mono(P) {
  const n = P.length; if (n < 2) return ""; const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = P[i + 1][0] - P[i][0]; m[i] = (P[i + 1][1] - P[i][1]) / dx[i]; }
  const t = [m[0]]; for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]); t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; } const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b; if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += ` C${(P[i][0] + h).toFixed(1)} ${(P[i][1] + t[i] * h).toFixed(1)} ${(P[i + 1][0] - h).toFixed(1)} ${(P[i + 1][1] - t[i + 1] * h).toFixed(1)} ${P[i + 1][0].toFixed(1)} ${P[i + 1][1].toFixed(1)}`; }
  return d;
}
/* Values are recorded only on changes: we hold the value and change it gradually (up to RAMP before the next change) so the curve is smooth and not stepped */
const RAMP = 60 * 60e3;
function ramped(ser, t0, now) {
  const first = at(ser, t0); if (!Number.isFinite(first)) return [];
  const out = [[t0, first]];
  for (const p of ser) { if (p[0] <= t0 || p[0] > now) continue; const l = out[out.length - 1]; if (p[0] - l[0] > RAMP) out.push([p[0] - RAMP, l[1]]); out.push([p[0], p[1]]); }
  out.push([now, out[out.length - 1][1]]); return out;
}

/* Charging costs: per-account profiles and explicit per-session attribution. */
const CT = (en, el = en, es = en) => K?.I18N?.lang === "el" ? el : K?.I18N?.lang === "es" ? es : en;
const cn = v => v === "" || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v);
const profileName = p => p.name || ({home:CT("Home","Σπίτι","Casa"),work:CT("Work","Εργασία","Trabajo"),public:CT("Public","Δημόσιος","Público"),free:CT("Free","Δωρεάν","Gratis"),ionity:"Ionity",manual:CT("Manual charge","Χειροκίνητη χρέωση","Cargo manual")}[p.id] || p.id);
const defaultProfiles = () => ["home","work","free","ionity","public"].map(id=>({id,name:"",price:null,free:id==="work"||id==="free",source:"battery",entity:"",efficiency:90}));
function chargingEnergy(g, r, series = [], unit = "") {
  if (!r) return {energy:null,source:"unassigned",estimated:true};
  if (cn(r.energy)!==null) return {energy:cn(r.energy),source:"receipt",estimated:false};
  const p=r.profile, power=p.source==="power", factor=power?(unit==="W"?.001:unit==="kW"?1:null):(unit==="Wh"?.001:unit==="kWh"?1:null);
  if (p.source!=="battery" && factor!==null && series.length) {
    const rows=series.filter(x=>Number.isFinite(x[1])&&x[1]>=0&&x[0]<=g.e), before=rows.filter(x=>x[0]<=g.s).slice(-1)[0];
    if(before && g.s-before[0]<=20*60e3) {
      let last=before, value=0, valid=true;
      for(const row of rows.filter(x=>x[0]>g.s)) {
        if(row[0]-last[0]>20*60e3) {valid=false;break;}
        if(power) value+=last[1]*(row[0]-Math.max(g.s,last[0]))/36e5;
        else if(row[1]>=last[1]) value+=row[1]-last[1];
        else {valid=false;break;}
        last=row;
      }
      if(g.e-last[0]>20*60e3)valid=false;
      if(power&&valid)value+=last[1]*(g.e-Math.max(g.s,last[0]))/36e5;
      if(valid&&Number.isFinite(value*factor)&&value*factor>0&&value*factor<=1000000)return {energy:value*factor,source:power?"power":"meter",estimated:power};
    }
  }
  const efficiency=Number(p.efficiency),stored=r.capacity>0&&Number.isFinite(g.to)&&Number.isFinite(g.from)?Math.max(0,g.to-g.from)*r.capacity/100:g.kwh;
  const energy=stored>0&&efficiency>0&&efficiency<=100?stored/(efficiency/100):null;
  return {energy,source:p.source==="battery"?"battery":"fallback",estimated:true};
}
function chargingCost(g,r,series,unit) {
  const e=chargingEnergy(g,r,series,unit);if(!r)return {...e,cost:null};
  const total=cn(r.total),price=cn(r.profile.price);
  const cost=total!==null?total:r.profile.free?0:price!==null&&e.energy!==null?price*e.energy:null;
  return {...e,costEstimated:total===null&&!r.profile.free&&e.estimated,cost:cost===null||Number.isFinite(cost)?cost:null};
}
EN.costMath={chargingEnergy,chargingCost};
class ChargingCosts {
  constructor(card,host) {
    this.card=card;this.host=host;this.data={profiles:defaultProfiles(),sessions:{}};this.queue=Promise.resolve();this.editor=null;this.message="";this.dirty=false;
    this.key="deepal_charge_costs_"+(card._c?.prefix||"s05");this.cacheKey=this.key+"_"+(card._hass?.user?.id||"local");this.ready=this.load();
    host.addEventListener("click",e=>this.click(e));
    host.addEventListener("input",e=>{if(e.target.name==="total")this.manualTotal(e.target.closest("form"));if(e.target.closest("[data-cc-form]"))this.updateDirty();});
    host.addEventListener("change",e=>{

      if(e.target.name==="total")this.manualTotal(e.target.closest("form"));
      if(e.target.matches("[data-cc-source]")){const group=e.target.closest(".cc-profile");group.querySelector("[data-cc-entity-field]").hidden=e.target.value==="battery";this.bindEntityPicker(group);}
      if(e.target.matches("[name=free]")&&e.target.closest(".cc-profile")){e.target.closest(".cc-profile").querySelector(".cc-paid").hidden=e.target.checked;}
      if(e.target.matches("[name=profile]"))this.selectLocation(e.target.closest("form"));
      const group=e.target.closest('.cc-profile'),summary=group?.parentElement.querySelector('summary');
      if(summary){group.parentElement.classList.toggle('is-free',group.querySelector('[name=free]').checked);summary.querySelector('span').textContent=group.querySelector('[name=name]').value;summary.querySelector('small').textContent=group.querySelector('[name=free]').checked?CT('Free charging','Δωρεάν φόρτιση'):group.querySelector('[name=price]').value?group.querySelector('[name=price]').value+' €/kWh':CT('Set price','Ορισμός τιμής');}
      if(e.target.closest("[data-cc-form]"))this.updateDirty();
    });
  }
  formState(){const form=this.editorNode?.querySelector("form");return form?JSON.stringify([...form.querySelectorAll("input,select,textarea")].map(n=>[n.name,n.type==="checkbox"?n.checked:n.value])):null;}
  updateDirty(){const form=this.formState();this.dirty=JSON.stringify(this.data)!==this.savedData||(form!==null&&form!==this.formBaseline);this.onDirtyChange?.(this.dirty);}
  async load() {
    try{const local=JSON.parse(localStorage.getItem(this.cacheKey)||"null");if(Array.isArray(local?.profiles)&&local.sessions)this.data=local;}catch(_){}
    try{const r=await this.card._hass.callWS({type:"frontend/get_user_data",key:this.key});if(Array.isArray(r?.value?.profiles)&&r.value.sessions)this.data=r.value;this.cloudLoaded=true;}
    catch(_){this.message=CT("Account unavailable; local copy loaded.","Μη διαθέσιμος λογαριασμός· φορτώθηκε το τοπικό αντίγραφο.");}
    this.savedData=JSON.stringify(this.data);
  }
  async save() {
    const snapshot=JSON.parse(JSON.stringify(this.data));try{localStorage.setItem(this.cacheKey,JSON.stringify(snapshot));}catch(_){}
    const send=this.queue.catch(()=>{}).then(async()=>{
      if(!this.cloudLoaded){
        const remote=await this.card._hass.callWS({type:"frontend/get_user_data",key:this.key});
        snapshot.sessions={...(remote?.value?.sessions||{}),...snapshot.sessions};this.data.sessions={...snapshot.sessions};this.cloudLoaded=true;
      }
      return this.card._hass.callWS({type:"frontend/set_user_data",key:this.key,value:snapshot});
    });this.queue=send;
    try{await send;this.savedData=JSON.stringify(snapshot);this.onSaved?.();this.message=CT("Saved to your HA account.","Αποθηκεύτηκε στον λογαριασμό HA.","Guardado en tu cuenta de HA.");return true;}
    catch(error){throw Error(CT("Saved on this device only. Account save failed.","Αποθηκεύτηκε μόνο τοπικά. Η αποθήκευση απέτυχε.")+" "+(error.message||String(error)));}
  }
  record(g){return g?this.data.sessions[String(Math.round(g.s/1000))]:undefined;}
  async history(m) {
    this.sensorHistory={};
    const entities=[...new Set([...this.data.profiles,...Object.values(this.data.sessions).map(r=>r.profile)].filter(p=>p&&p.source!=="battery"&&p.entity).map(p=>p.entity))];
    if(!entities.length)return;
    try{const raw=await this.card._hass.callWS({type:"history/history_during_period",start_time:new Date(m.t0-20*60e3).toISOString(),end_time:new Date(m.now).toISOString(),entity_ids:entities,include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true});for(const id of entities)this.sensorHistory[id]=numSeries(rowsOf(raw?.[id]));}catch(_){}
  }
  result(g){const r=this.record(g),id=r?.profile?.entity;return chargingCost(g,r,this.sensorHistory?.[id]||[],this.card._hass.states?.[id]?.attributes?.unit_of_measurement||"");}
  money(v){return new Intl.NumberFormat(this.card._hass?.locale?.language||"en",{style:"currency",currency:"EUR"}).format(v);}
  number(v){return new Intl.NumberFormat(this.card._hass?.locale?.language||"en",{maximumFractionDigits:2}).format(v);}
  label(r){return {unassigned:CT("Choose location","Διάλεξε τοποθεσία","Elige ubicación"),receipt:CT("Entered energy","Καταχωρημένη ενέργεια"),meter:CT("Measured energy","Μετρημένη ενέργεια"),power:CT("Estimated from power","Εκτίμηση από ισχύ"),battery:CT("Estimated from battery","Εκτίμηση από μπαταρία"),fallback:CT("Sensor unavailable: battery estimate","Μη διαθέσιμος αισθητήρας: εκτίμηση μπαταρίας")}[r.source];}
  decorate(m,ctx) {
    this.model=m;this.ctx=ctx;const b=this.host.querySelector(".en-body");if(!b)return;
    const graph=b.querySelector(".cc-charts");if(graph&&EN.renderChargingChart)graph.outerHTML=EN.renderChargingChart(m.chg,this.card._hass.locale?.language||"en",m.now);
    b.querySelectorAll(".cc-added").forEach(n=>n.remove());
    const completed=m.chg.filter(g=>!g.live),results=completed.map(g=>this.result(g)),known=results.filter(r=>r.cost!==null),total=known.reduce((n,r)=>n+r.cost,0);
    const top=document.createElement("div");top.className="cc-added cc-summary";
    top.innerHTML='<div><small>'+esc(CT("Charging cost","Κόστος φόρτισης","Coste de carga"))+'</small><b>'+(known.length?esc(this.money(total)):"—")+'</b><small>'+known.length+"/"+completed.length+" "+esc(CT("sessions priced","φορτίσεις με κόστος","cargas con precio"))+(known.some(r=>r.costEstimated)?" · ≈":"")+'</small></div><button class="cc-button" data-cc="profiles">'+esc(CT("Charging profiles","Προφίλ φόρτισης","Perfiles de carga"))+' ⚙</button>';
    const totals=b.querySelector(".en-tot");if(totals)totals.after(top);else b.prepend(top);
    const days=m.days.filter(d=>d.t<=m.now).slice().reverse();
    [...b.querySelectorAll(".en-tb:not(.h)")].forEach((row,i)=>{
      const day=days[i];if(!day)return;const values=m.chg.filter(g=>dayKey(g.s)===day.key).map(g=>this.result(g));if(!values.length)return;
      const priced=values.filter(r=>r.cost!==null),sum=priced.reduce((n,r)=>n+r.cost,0),note=document.createElement("small");note.className="cc-added cc-day-cost";
      note.textContent=priced.length?(priced.some(r=>r.costEstimated)?"≈ ":"")+this.money(sum)+(priced.length<values.length?" *":""):CT("Price not set","Χωρίς τιμή","Sin precio");
      note.title=CT("Charging cost. * = some sessions have no price.","Κόστος φόρτισης. * = λείπουν τιμές.");row.children[2]?.append(note);
    });
    const list=m.chg.slice().reverse();
    [...b.querySelectorAll(".en-li")].forEach((row,i)=>{
      const g=list[i];if(!g)return;const r=this.record(g),result=this.result(g),n=document.createElement("button");
      n.className="cc-added cc-session";n.dataset.cc="session";n.dataset.start=String(g.s);
      n.dataset.costState=result.cost===null?'unpriced':result.cost===0?'free':'paid';
      n.innerHTML='<span><span class="cc-location-name">'+esc(r?profileName(r.profile):CT("Choose location","Διάλεξε τοποθεσία","Elige ubicación"))+'</span><small>'+esc(this.label(result))+(result.energy!==null?" · "+esc(this.number(result.energy))+" kWh":"")+'</small></span><span class="cc-price-badge"><span><small>'+esc(result.cost===0?CT('Free charging','Δωρεάν φόρτιση'):result.cost!==null?CT('Cost','Κόστος'):CT('Not priced','Χωρίς τιμή'))+'</small><b>'+(result.cost!==null?(result.estimated&&cn(r?.total)===null&&!r?.profile.free?"≈ ":"")+esc(this.money(result.cost)):esc(CT("Set price","Όρισε τιμή","Añadir precio")))+'</b></span><i aria-hidden="true">›</i></span>';const group=document.createElement('div');group.className='cc-added cc-session-row';n.classList.remove('cc-added');group.append(n);
      const curve=document.createElement('button');curve.className='cc-button cc-curve';curve.dataset.cc='curve';curve.dataset.start=String(g.s);curve.innerHTML=ico('pulse')+'<span>Curve</span>';curve.setAttribute('aria-label','View charging curve');group.append(curve);row.after(group);
    });
    const editor=document.createElement("div");editor.className="cc-added cc-editor";const anchor=this.editor&&this.editor!=="profiles"?[...b.querySelectorAll(".cc-session")].find(n=>n.dataset.start===String(this.editor)):null;(anchor?.closest('.cc-session-row')||anchor||top).after(editor);this.editorNode=editor;this.renderEditor();EN.bindChargingChart?.(b);
  }
  field(label,name,value,type="text",extra=""){return '<label class="cc-field">'+esc(label)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(name==="efficiency"&&Number(value)===90?"":value??"")+'"'+(name==="efficiency"?' placeholder="90"':"")+' '+(type==="number"?'min="0" step="any" ':"")+extra+"></label>";}
  bindEntityPicker(group){
    const holder=group.querySelector('.cc-entity-picker');if(!holder)return;
    const hidden=group.querySelector('[name=entity]'),source=group.querySelector('[name=source]').value,units=source==='power'?['W','kW']:['Wh','kWh'];
    const hass=this.card._hass,ids=Object.keys(hass.states||{}).filter(id=>id.startsWith('sensor.')&&units.includes(hass.states[id].attributes?.unit_of_measurement));
    const friendly=id=>hass.states?.[id]?.attributes?.friendly_name||hass.entities?.[id]?.name||id;
    ids.sort((a,b)=>friendly(a).localeCompare(friendly(b)));
    holder.replaceChildren();const note=group.querySelector('.cc-entity-name');
    const update=value=>{hidden.value=value;note.textContent=value?(friendly(value)+' · '+value):'';this.updateDirty();};
    note.textContent=hidden.value?(friendly(hidden.value)+' · '+hidden.value):'';
    if(customElements.get('ha-selector')){
      const picker=document.createElement('ha-selector');picker.dataset.chargerEntity='';picker.hass=hass;picker.label=CT('Charger sensor','Αισθητήρας φορτιστή');picker.required=false;
      picker.selector={entity:{domain:'sensor',include_entities:ids}};picker.value=hidden.value||undefined;
      picker.addEventListener('value-changed',event=>{event.stopPropagation();update(typeof event.detail?.value==='string'?event.detail.value:'');});holder.append(picker);
    }else{
      const picker=document.createElement('select');picker.setAttribute('aria-label','Charger sensor');
      picker.innerHTML='<option value="">'+esc(CT('Choose a sensor','Επίλεξε αισθητήρα'))+'</option>'+ids.map(id=>'<option value="'+esc(id)+'">'+esc(friendly(id)+' · '+id)+'</option>').join('');
      if(hidden.value&&!ids.includes(hidden.value))picker.add(new Option(friendly(hidden.value)+' · '+hidden.value,hidden.value));
      picker.value=hidden.value;picker.addEventListener('change',()=>update(picker.value));holder.append(picker);
    }
  }
  cancelChanges(){
    if(this.saving)return;
    if(this.savedData){this.data=JSON.parse(this.savedData);try{localStorage.setItem(this.cacheKey,this.savedData);}catch(_){}}
    this.message='';this.dirty=false;
    if(this.editor==='profiles')this.renderEditor();else{this.editor=null;this.editorNode.replaceChildren();}
    this.onDirtyChange?.(false);this.onCanceled?.();
  }
  options(value){return [["battery",CT("Battery estimate","Εκτίμηση μπαταρίας")],["total",CT("Total energy meter","Συνολικός μετρητής ενέργειας")],["session",CT("Session energy meter","Μετρητής ενέργειας συνεδρίας")],["power",CT("Charger power","Ισχύς φορτιστή")]].map(([v,l])=>'<option value="'+v+'"'+(v===value?" selected":"")+">"+esc(l)+"</option>").join("");}
  renderEditor() {
    if(!this.editorNode)return;if(!this.editor){this.editorNode.innerHTML="";return;}
    const close='<button class="cc-button" data-cc="close">'+esc(CT("Close","Κλείσιμο","Cerrar"))+' ×</button>',message=this.message?'<p class="cc-info" role="status">ⓘ '+esc(this.message)+"</p>":'<p class="cc-info" role="status" hidden></p>';
    if(this.editor==="profiles"){
      const sensorOptions=Object.entries(this.card._hass.states||{}).filter(([id,s])=>id.startsWith("sensor.")&&["Wh","kWh","W","kW"].includes(s.attributes?.unit_of_measurement)).map(([id,s])=>'<option value="'+esc(id)+'">'+esc(s.attributes?.friendly_name||id)+"</option>").join("");
      const profiles=this.data.profiles.map((p,i)=>'<details class="cc-location-details'+(p.free?' is-free':'')+'"><summary><span>'+esc(profileName(p))+'</span><small>'+esc(p.free?CT("Free charging","Δωρεάν φόρτιση"):p.price!=null?p.price+' €/kWh':CT("Set price","Ορισμός τιμής"))+'</small><span aria-hidden="true">›</span></summary><fieldset class="cc-profile" data-index="'+i+'"><legend>'+esc(profileName(p))+'</legend><div class="cc-profile-head">'+this.field(CT("Name","Όνομα"),"name",p.name||profileName(p))+'<label class="cc-check"><input name="free" type="checkbox"'+(p.free?' checked':'')+'>'+esc(CT("Free charging","Δωρεάν φόρτιση","Carga gratuita"))+'</label></div><div class="cc-paid"'+(p.free?' hidden':'')+'><div class="cc-grid">'+this.field("€/kWh","price",p.price,"number")+'<label class="cc-field">'+esc(CT("Energy source","Πηγή ενέργειας"))+'<select name="source" data-cc-source>'+this.options(p.source)+'</select></label><div data-cc-entity-field'+(p.source==="battery"?' hidden':'')+'>'+'<input type="hidden" name="entity" value="'+esc(p.entity||'')+'"><div class="cc-entity-picker"></div><small class="cc-entity-name"></small>'+'</div>'+this.field(CT("Charging efficiency (%)","Απόδοση φόρτισης (%)"),"efficiency",p.efficiency,"number",'min="1" max="100"')+'</div></div><button type="button" class="cc-button danger" data-cc="remove-profile">'+esc(CT('Delete profile','Διαγραφή προφίλ','Eliminar perfil'))+'</button></fieldset></details>').join("");
      this.editorNode.innerHTML='<form data-cc-form="profiles"><div class="cc-editor-head"><b>'+esc(CT("Charging profiles","Προφίλ φόρτισης"))+'</b>'+close+'</div><p class="cc-hint">'+esc(CT("Each location keeps its tariff and optional charger sensor. Saved sessions keep their price.","Κάθε τοποθεσία κρατά την τιμή και τον προαιρετικό αισθητήρα της. Οι φορτίσεις κρατούν την αποθηκευμένη τιμή τους."))+'</p><datalist id="cc-sensors">'+sensorOptions+'</datalist><div class="cc-profiles">'+profiles+'</div><div class="cc-actions"><button class="cc-button" data-cc="add">'+esc(CT("Add location","Προσθήκη τοποθεσίας"))+'</button><button class="cc-button" data-cc="cancel">'+esc(CT("Cancel changes","Ακύρωση αλλαγών","Cancelar cambios"))+'</button><button class="cc-button primary" data-cc="save-profiles">'+esc(CT("Save profiles","Αποθήκευση προφίλ"))+'</button></div>'+message+'</form>';
    } else {
      const g=this.model.chg.find(g=>String(g.s)===String(this.editor));if(!g){this.editor=null;return;}const r=this.record(g),p=r?.profile,result=this.result(g);
      const locations=this.data.profiles.map(x=>{
        const rate=x.free?CT("Free","Δωρεάν","Gratis"):cn(x.price)!==null?this.number(x.price)+" €/kWh":CT("Price not set","Χωρίς τιμή","Sin precio");
        return '<option value="'+esc(x.id)+'"'+(x.id===p?.id?" selected":"")+">"+esc(profileName(x)+" · "+rate)+"</option>";
      }).join("")+'<option value="__manual__"'+(p?.id==="manual"?" selected":"")+'>'+esc(CT("Manual charge (no profile)","Χειροκίνητη χρέωση (χωρίς προφίλ)","Cargo manual (sin perfil)"))+"</option>";
      const advanced=this.field("€/kWh","price",p?.price,"number")+'<label class="cc-check"><input name="free" type="checkbox"'+(p?.free?" checked":"")+">"+esc(CT("Free charging","Δωρεάν φόρτιση"))+"</label>"+this.field(CT("Receipt energy (kWh), optional","kWh από απόδειξη, προαιρετικά"),"energy",r?.energy,"number")+this.field(CT("Total paid (€), optional","Συνολικό ποσό (€), προαιρετικά"),"total",r?.total,"number");
      this.editorNode.innerHTML='<form data-cc-form="session"><div class="cc-editor-head"><b>'+esc(CT("Charging location","Τοποθεσία φόρτισης","Lugar de carga"))+" · "+esc(this.ctx.fmt.hm(g.s))+"</b>"+close+'</div><label class="cc-field cc-location">'+esc(CT("Location","Τοποθεσία","Ubicación"))+'<select name="profile"><option value="">'+esc(CT("Choose location","Διάλεξε τοποθεσία"))+"</option>"+locations+'</select></label><p class="cc-hint">'+esc(CT("The saved location profile supplies the price or free charging.","Η τοποθεσία συμπληρώνει αυτόματα την τιμή ή τη δωρεάν φόρτιση.","La ubicación aporta su tarifa o carga gratuita."))+'</p><details class="cc-advanced"'+(p?.id==="manual"?" open":"")+'><summary>'+esc(CT("Receipt or manual correction","Απόδειξη ή χειροκίνητη διόρθωση","Recibo o corrección manual"))+'</summary><div class="cc-grid">'+advanced+'</div><p class="cc-hint">'+esc(CT("Enter €/kWh and charged kWh, or just the total paid. An entered total takes precedence.","Βάλε €/kWh και τις kWh που φορτίστηκαν ή μόνο το συνολικό ποσό. Το συνολικό ποσό υπερισχύει."))+'</p></details><div class="cc-actions"><button class="cc-button" data-cc="cancel">'+esc(CT("Cancel changes","Ακύρωση αλλαγών","Cancelar cambios"))+'</button><button class="cc-button primary" data-cc="save-session">'+esc(CT("Save location","Αποθήκευση τοποθεσίας","Guardar ubicación"))+"</button></div>"+message+"</form>";
    }
    this.editorNode.querySelectorAll('.cc-location-details').forEach(details=>details.addEventListener('toggle',()=>{
      if(details.open)this.editorNode.querySelectorAll('.cc-location-details').forEach(other=>{if(other!==details)other.open=false;});
    }));
    this.editorNode.querySelector("form")?.addEventListener("submit",e=>e.preventDefault());
    this.editorNode.querySelectorAll(".cc-profile").forEach(group=>this.bindEntityPicker(group));
    window.__DEEPAL_COMPANION_UI?.enhanceChoices(this.editorNode,this.card._hass);
    this.bindProfileNames();
    this.formBaseline=this.formState();this.updateDirty();
  }
  manualTotal(form){
    if(!form?.elements.total||cn(form.elements.total.value)===null)return;
    const profile=form.elements.profile;if(profile.value!=='__manual__')form.elements.price.value='';
    profile.value='__manual__';if(profile._compPicker)profile._compPicker.value='__manual__';form.elements.free.checked=false;
    form.querySelector('.cc-advanced').open=true;
  }
  bindProfileNames(){
    const names=[['IONITY','Europe'],['Tesla Supercharger','Europe'],['Atlante','Spain · Italy'],['Zunder','Spain'],['Iberdrola | bp pulse','Spain'],['Repsol','Spain'],['Wenea','Spain'],['Plenitude On the Road','Italy','Be Charge'],['Ewiva','Italy'],['Free To X','Italy'],['A2A E-moving','Italy'],['PPC blue','Greece','DEI blue ΔΕΗ'],['incharge','Greece','nrg'],['EKO Charge & Go','Greece','ElpeFuture'],['Blink Charging','Greece'],['EV Loader','Greece'],['Electrip','Greece']];
    for(const input of this.editorNode.querySelectorAll('.cc-profile input[name=name]')){
      const field=input.closest('label');field.classList.add('cc-name-field');input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
      const list=document.createElement('div');list.className='cc-name-options';list.hidden=true;list.setAttribute('role','listbox');list.id='cc-network-'+input.closest('.cc-profile').dataset.index;input.setAttribute('aria-controls',list.id);field.append(list);let active=-1;
      const close=()=>{list.hidden=true;active=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
      const choose=name=>{input.value=name;close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();};
      const show=()=>{const q=input.value.trim().toLocaleLowerCase();const matches=names.filter(n=>n.join(' ').toLocaleLowerCase().includes(q)).slice(0,6);list.replaceChildren();active=-1;for(const [i,item]of matches.entries()){const option=document.createElement('button');option.type='button';option.id=list.id+'-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=item[0]+' · '+item[1];option.addEventListener('pointerdown',e=>e.preventDefault());option.addEventListener('click',()=>choose(item[0]));list.append(option);}list.hidden=!matches.length;input.setAttribute('aria-expanded',String(!!matches.length));input.removeAttribute('aria-activedescendant');};
      input.addEventListener('focus',show);input.addEventListener('input',show);input.addEventListener('blur',close);
      input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();return;}if(e.key==='Enter'&&!list.hidden&&active>=0){e.preventDefault();choose(list.children[active].textContent.split(' · ')[0]);return;}if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();if(list.hidden)show();const count=list.children.length;if(!count)return;active=(active+(e.key==='ArrowDown'?1:-1)+count)%count;[...list.children].forEach((n,i)=>n.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});});
    }
  }
  selectLocation(form) {
    const id=form.elements.profile.value,old=this.record(this.model.chg.find(g=>String(g.s)===String(this.editor)));
    if(id==="__manual__"){
      form.elements.price.value=old?.profile?.id==="manual"?old.profile.price??"":"";
      form.elements.free.checked=old?.profile?.id==="manual"?!!old.profile.free:false;
      form.querySelector(".cc-advanced").open=true;return;
    }
    const p=this.data.profiles.find(p=>p.id===id);if(!p)return;
    form.elements.price.value=p.price??"";form.elements.free.checked=!!p.free;
    if(form.elements.total&&p.id!==old?.profile?.id)form.elements.total.value="";
  }
  collectProfiles(validate=true) {
    return [...this.editorNode.querySelectorAll(".cc-profile")].map(group=>{
      const old=this.data.profiles[Number(group.dataset.index)],get=n=>group.querySelector('[name="'+n+'"]'),source=get("source").value,entity=get("entity").value.trim(),efficiency=cn(get("efficiency").value)??90;
      if(validate&&!(efficiency>=1&&efficiency<=100))throw Error(CT("Efficiency must be between 1 and 100%.","Η απόδοση πρέπει να είναι 1–100%."));
      if(validate&&!get("free").checked&&source!=="battery"){const unit=this.card._hass.states?.[entity]?.attributes?.unit_of_measurement;if(!(source==="power"?["W","kW"]:["Wh","kWh"]).includes(unit))throw Error(CT("Select W/kW for power or Wh/kWh for energy.","Διάλεξε W/kW για ισχύ ή Wh/kWh για ενέργεια."));}
      return {...old,name:get("name").value.trim().slice(0,60),price:cn(get("price").value),free:get("free").checked,source,entity,efficiency};
    });
  }
  async click(e) {
    const button=e.target.closest("[data-cc]");if(!button)return;e.preventDefault();e.stopPropagation();const action=button.dataset.cc;
    if(this.saving)return;
    if(action==='remove-profile'){
      const group=button.closest('.cc-profile');if(group.querySelector('.cc-delete-confirm'))return;
      const notice=document.createElement('div');notice.className='cc-delete-confirm';notice.setAttribute('role','group');notice.setAttribute('aria-label','Confirm profile deletion');
      notice.innerHTML='<p>'+esc(CT('Delete this profile? Existing charging sessions and saved costs will be kept.','Διαγραφή προφίλ; Οι υπάρχουσες φορτίσεις και τα αποθηκευμένα κόστη διατηρούνται.','¿Eliminar este perfil? Se conservarán las cargas y sus costes guardados.'))+'</p><button type="button" class="cc-button" data-cc="remove-cancel">'+esc(CT('Cancel','Ακύρωση','Cancelar'))+'</button> <button type="button" class="cc-button danger" data-cc="remove-confirm">'+esc(CT('Delete profile','Διαγραφή προφίλ','Eliminar perfil'))+'</button>';group.append(notice);notice.querySelector('button').focus();return;
    }
    if(action==='remove-cancel'){button.closest('.cc-delete-confirm').remove();return;}
    if(action==='remove-confirm'){
      const index=Number(button.closest('.cc-profile').dataset.index);this.data.profiles=this.collectProfiles(false);this.data.profiles.splice(index,1);
      this.message=CT('Profile removed. Existing charges and saved costs are kept. Save profiles to apply.','Το προφίλ αφαιρέθηκε. Οι φορτίσεις και τα κόστη διατηρούνται. Αποθήκευσε τα προφίλ για εφαρμογή.','Perfil eliminado. Se conservan las cargas y sus costes. Guarda los perfiles para aplicar.');this.renderEditor();return;
    }
    if(action==='curve'){

      if(this.dirty){this.message='Save or cancel your changes first.';this.renderEditor();return;}
      const g=this.model?.chg.find(row=>String(row.s)===button.dataset.start);if(!g)return;
      button.disabled=true;
      try{
        const module=await import('/deepal_companion/frontend/charging-curve.js?v=0.1.0');if(!this.host.isConnected)return;
        this.curveDialog?.remove();
        this.curveDialog=module.openCurveDialog(this.host.getRootNode(),this.card._hass,async()=>{
          if(g.id&&!String(g.id).startsWith('recorder_')){const data=await this.card._hass.companionRequest('session_curve',{session_id:g.id});return {...data,mode:data.mode||(typeof g.dc==='boolean'?(g.dc?'DC':'AC'):null)};}
          const series=EN.captureChargingCurve(this.model.curveRaw||{},g);
          return {start:g.s,end:g.e,mode:typeof g.dc==='boolean'?(g.dc?'DC':'AC'):null,series:Object.fromEntries(Object.entries(series).map(([key,rows])=>[key,rows.map(([t,value])=>({lu:t/1000,s:value}))]))};
        },this.card._c);
      }catch(error){this.message=error.message;this.renderEditor();}finally{button.disabled=false;}return;
    }
    if(action==="profiles"||action==="session"){this.editor=action==="profiles"?"profiles":button.dataset.start;this.message="";this.dirty=false;const anchor=action==="session"?(button.closest('.cc-session-row')||button):this.host.querySelector(".cc-summary");if(anchor)anchor.after(this.editorNode);this.renderEditor();return;}
    if(action==="cancel"){this.cancelChanges();return;}
    if(action==="close"){const profiles=this.editor==='profiles';this.cancelChanges();if(profiles){this.editor=null;this.renderEditor();}return;}
    if(this.saving)return;
    button.disabled=true;
    try {
      if((action==="save-profiles"||action==="save-session")&&!this.editorNode.querySelector("form").reportValidity())return;
      if(action==="add"){this.data.profiles=this.collectProfiles();if(this.data.profiles.length>=12)throw Error("Maximum 12 locations.");this.data.profiles.push({id:"place_"+Date.now(),name:CT("New location","Νέα τοποθεσία"),price:null,free:false,source:"battery",entity:"",efficiency:90});this.dirty=true;this.renderEditor();return;}
      if(action==="save-profiles")this.data.profiles=this.collectProfiles();
      if(action==="save-session"){
        this.manualTotal(this.editorNode.querySelector("form"));
        const form=this.editorNode.querySelector("form"),g=this.model.chg.find(g=>String(g.s)===String(this.editor)),id=form.elements.profile.value,p=id==="__manual__"?{id:"manual",name:"",price:null,free:false,source:"battery",entity:"",efficiency:90}:this.data.profiles.find(p=>p.id===id);
        if(!p||!g)throw Error(CT("Choose a location first.","Διάλεξε πρώτα τοποθεσία."));
        if(id==="__manual__"&&!form.elements.free.checked&&cn(form.elements.price.value)===null&&cn(form.elements.total.value)===null)throw Error(CT("Enter a price per kWh or a total paid.","Συμπλήρωσε τιμή ανά kWh ή συνολικό ποσό."));
        const previous=this.record(g),snapshot=previous?.profile?.id===id?previous.profile:p;
        if(form.elements.free.checked&&cn(form.elements.total.value)>0)throw Error(CT("Clear Total paid for a free session.","Άδειασε το Συνολικό ποσό για δωρεάν φόρτιση."));
        this.data.sessions[String(Math.round(g.s/1000))]={start:g.s,capacity:previous?.capacity||this.ctx.cap,profile:{...snapshot,price:cn(form.elements.price.value),free:form.elements.free.checked},energy:cn(form.elements.energy.value),total:cn(form.elements.total.value)};
      }
      this.saving=true;this.editorNode.querySelectorAll("[data-cc]").forEach(node=>node.disabled=true);
      await this.save();this.dirty=false;await this.history(this.model);this.decorate(this.model,this.ctx);
    } catch(error){this.message=error.message;const status=this.editorNode.querySelector('[role="status"]');if(status){status.hidden=false;status.textContent=this.message;}}
    finally{this.saving=false;button.disabled=false;this.editorNode.querySelectorAll("[data-cc]").forEach(node=>node.disabled=false);}
  }
}

const LOAD = () => K.loaderHtml("bolt");
function renderEnergyGraph(m,ctx){
  const f=(n)=>new Intl.NumberFormat(ctx.lang,{maximumFractionDigits:1}).format(n),fu=m.fuelUsed&&ctx.hasFuel,dateFormat=new Intl.DateTimeFormat(ctx.lang,{weekday:'short',day:'numeric'});
  const W=Math.max(300,Math.min(1440,Number(ctx.chartWidth)||340)),H=W>700?300:W>420?245:215,L=36,R=12,top=26,ph=H-82,bottom=top+ph,track=bottom+17,pw=W-L-R;
  const t0=m.t0,span=m.nDays*86400000,tEnd=m.now,X=t=>L+(Math.min(Math.max(t,t0),t0+span)-t0)/span*pw;
  const values=m.batt.map(p=>p[1]).concat(fu?m.fuel.map(p=>p[1]):[]),lo=values.length?Math.min(...values):50,ymin=Math.max(0,Math.min(60,Math.floor((lo-5)/10)*10)),Y=v=>top+(100-Math.min(100,Math.max(ymin,v)))/(100-ymin)*ph;
  const ticks=Math.max(3,Math.min(10,Math.floor(pw/85))),every=Math.max(1,Math.ceil(m.nDays/ticks));
  let svg=`<svg class="en-ch" tabindex="0" data-t0="${t0}" data-span="${span}" data-ymin="${ymin}" data-width="${W}" data-left="${L}" data-right="${R}" data-top="${top}" data-height="${ph}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(T('Battery and petrol history'))}">`;
  for(const level of [100,Math.round((100+ymin)/2),ymin])svg+=`<line x1="${L}" x2="${W-R}" y1="${Y(level)}" y2="${Y(level)}" stroke="currentColor" stroke-opacity=".13" stroke-dasharray="3 5"/><text x="${L-8}" y="${Y(level)+4}" text-anchor="end" style="font-size:10px">${level}%</text>`;
  m.days.forEach((day,index)=>{if(index%every===0){const x=X(day.t);svg+=`<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="currentColor" stroke-opacity=".045"/><text x="${Math.min(W-R-20,Math.max(L+18,x))}" y="${H-3}" text-anchor="middle" style="font-size:10px">${esc(ctx.fmt.dm(day.t))}</text>`;}});
  if(tEnd<t0+span-60000)svg+=`<rect x="${X(tEnd)}" y="${top}" width="${Math.max(0,W-R-X(tEnd))}" height="${ph}" fill="currentColor" opacity=".025"/>`;
  const labels=[];
  m.chg.forEach(g=>{const x=X(g.s),width=Math.max(2,X(g.e)-x);svg+=`<rect x="${x}" y="${top}" width="${width}" height="${ph}" rx="2" fill="${CL_OK}" opacity=".065"/>`;if(g.kwh>0){const text=f(g.kwh),half=text.length*3+4;labels.push({x:Math.min(W-R-half,Math.max(L+half,(X(g.s)+X(g.e))/2)),text,half,value:g.kwh});}});
  const kept=[];for(const label of labels.sort((a,b)=>b.value-a.value)){if(!kept.some(other=>Math.abs(other.x-label.x)<other.half+label.half+8))kept.push(label);}
  for(const label of kept)svg+=`<text x="${label.x}" y="15" text-anchor="middle" style="fill:${CL_OK};font-size:10px;font-weight:600">${esc(label.text)}</text>`;
  const curve=series=>{const points=[];for(const [t,value]of ramped(series,t0,tEnd)){const x=X(t);if(!points.length||x>points[points.length-1][0]+.01)points.push([x,Y(value)]);}return points;};
  const battery=curve(m.batt);
  if(battery.length>1){const path=mono(battery),last=battery[battery.length-1];svg+=`<path d="${path} L${last[0]} ${bottom} L${battery[0][0]} ${bottom} Z" fill="${CL_OK}" opacity=".035"/><path d="${path}" fill="none" stroke="${CL_OK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${CL_OK}" stroke="var(--ds-card,#1b1f27)" stroke-width="2"/>`;}
  if(fu){const petrol=curve(m.fuel);if(petrol.length>1)svg+=`<path d="${mono(petrol)}" fill="none" stroke="${CL_FUEL}" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round" stroke-linecap="round"/>`;}
  svg+=`<rect x="${L}" y="${track}" width="${pw}" height="6" rx="3" fill="currentColor" opacity=".07"/>`;
  for(const [list,color]of [[m.drv,null],[m.chg,CL_OK]])for(const g of list)svg+=`<rect x="${X(g.s)}" y="${track}" width="${Math.max(2,X(g.e)-X(g.s))}" height="6" rx="3" fill="${color||(fu&&g.fuel>0?CL_FUEL:CL_DRV)}"/>`;
  svg+=`<g class="en-cur" visibility="hidden"><line y1="${top}" y2="${track+6}" stroke="var(--ds-fg)" stroke-opacity=".5" stroke-dasharray="3 4"/><circle r="4" cy="0" fill="${CL_OK}" stroke="var(--ds-card,#1b1f27)" stroke-width="2"/></g></svg>`;
  return `<div class="energy-chart-block"><h4>${esc(T('Battery'))}</h4><div class="en-leg"><span><i style="background:${CL_OK}"></i>${esc(T('Charging'))} (kWh)</span><span><i style="background:${CL_DRV}"></i>${esc(T('Driving'))}</span>${fu?`<span><i style="background:${CL_FUEL}"></i>${esc(T('Petrol driving'))}</span>`:''}<span><i style="background:var(--ds-line)"></i>${esc(T('Parked'))}</span></div><div class="en-cw">${svg}<div class="en-tip" hidden></div></div><p class="hint" style="margin-top:8px">${esc(T('Tap the chart to see the values at that moment.'))}</p></div>`;
}

function view(m, ctx) {
  const { lang, cap, st, hasFuel, now } = ctx, f = (n, d) => new Intl.NumberFormat(lang, { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  const hm = (t) => ctx.fmt.hm(t);
  const wd = (t) => ctx.fmt.dm(t);
  const lbl = (t) => { const k = dayKey(t); return k === dayKey(now) ? T("Today") : k === dayKey(now - 86400000) ? T("Yesterday") : wd(t); };
  const v = (id) => { const s = st[id]; return s ? s.state : undefined; };
  const tank = ctx.tankCapacity, bat = (() => { const x = num(v("batt")), g = m.batt.length ? m.batt[m.batt.length - 1][1] : NaN; return (!Number.isFinite(x) || (x === 0 && g > 5)) && Number.isFinite(g) ? g : x; })(), range = num(v("range")), liveSeg = m.chg.find((g) => g.live);
  const acN = num(v("ac")), dcN = num(v("dc")), curA = Math.max(Number.isFinite(acN) ? acN : 0, Number.isFinite(dcN) ? dcN : 0);
  const chgNow = !!liveSeg || curA > CHG_A, on = v("pow") === "on";
  /* 1. current state */
  let h = "";
  const eta = (() => { const mm = /^(\d+):(\d{2})/.exec(String(v("left") || "")); return mm && Number.isFinite(bat) && bat < 100 ? now + (Number(mm[1]) * 60 + Number(mm[2])) * 60e3 : null; })();
  if (!ctx.cur) { /* another week: only the totals and the chart */ } else if (chgNow) {
    h += `<div class="en-now chg"><div class="en-st"><span class="s">${ico("bolt")}${esc(T("Charging"))}</span><small>${esc(liveSeg && liveSeg.dc ? "DC" : "AC")}${curA > 0 ? ` · ${esc(f(curA, 0))} A` : ""}</small></div>
      <div class="en-big"><b>${Number.isFinite(bat) ? esc(f(bat, 0)) + "%" : "–"}</b>${eta ? `<span>${esc(T("Full at {0}", hm(eta)))}</span>` : ""}</div>
      <div class="en-sub">${liveSeg && Number.isFinite(liveSeg.from) ? esc(T("From {0}% at {1}", f(liveSeg.from, 0), hm(liveSeg.s))) : ""}${liveSeg && liveSeg.kwh ? ` · +${esc(f(liveSeg.kwh, 1))} kWh` : ""}</div></div>`;
  } else {
    const last = m.chg.filter((g) => !g.live).slice(-1)[0];
    h += `<div class="en-now"><div class="en-st"><span class="s">${ico(on ? "engine" : "info")}${esc(on ? T("Vehicle on") : T("Parked"))}</span><small>${Number.isFinite(range) ? esc(f(range, 0)) + " km" : ""}</small></div>
      <div class="en-big"><b>${Number.isFinite(bat) ? esc(f(bat, 0)) + "%" : "–"}</b>${hasFuel && Number.isFinite(num(v("fuel"))) ? `<span>${esc(T("Fuel {0}%", f(num(v("fuel")), 0)))}</span>` : ""}</div>
      <div class="en-sub">${last ? esc(T("Last charge: {0} {1} – {2}, {3}% → {4}%", lbl(last.s), hm(last.s), hm(last.e), f(last.from, 0), f(last.to, 0))) + (last.kwh ? ` · <span class="ok-t" style="color:rgb(var(--ds-ok))">${esc(f(last.kwh, 1))} kWh</span>` : "") : esc(T("No charge in the period shown."))}</div></div>`;
  }
  { /* totals of the period */
    const km = m.days.reduce((a, d) => a + (d.km > 0 ? d.km : 0), 0), kwh = m.chg.reduce((a, g) => a + (g.kwh > 0 ? g.kwh : 0), 0);
    h += `<div class="en-tot"><div>${esc(T("Driving"))}<b>${esc(f(km, 0))} km</b></div><div>${esc(T("Charged"))}<b class="ok">${kwh > 0 ? esc(f(kwh, 1)) + " kWh" : "–"}</b></div><div>${esc(T("Charges"))}<b>${m.chg.length}</b></div></div>`;
  }
  /* 2. curve */
  h += `<div class="en-nav"></div>`;
  const fu = m.fuelUsed && hasFuel, tEnd=m.now;
  h += renderEnergyGraph(m,ctx);
  /* 3. per day: days/values without data show "–", not 0 */
  h += `<div><h4>${esc(T("Per day"))}</h4><div class="en-tb h${fu ? " f4" : ""}"><span>${esc(T("Day"))}</span><span>${esc(T("Km"))}</span><span>${esc(T("Charging"))}</span><span>${esc(T("Battery"))} ↓</span>${fu ? `<span>${esc(T("Petrol"))}</span>` : ""}</div>`;
  m.days.filter((d) => d.t <= tEnd).reverse().forEach((d) => { h += `<div class="en-tb${fu ? " f4" : ""}"><span>${esc(lbl(d.t))}</span><span class="${d.km > 0 ? "" : "z"}">${d.km > 0 ? esc(f(d.km, d.km < 10 ? 1 : 0)) : "–"}</span><span class="${d.n ? "ok" : "z"}">${d.n ? (d.kwh > 0 ? esc(f(d.kwh, 1)) + " kWh" : "✓") : "–"}</span><span class="${d.batteryUsed > 0 ? "bu" : "z"}">${d.batteryUsed > 0 ? "−" + esc(f(d.batteryUsed, 1)) + " kWh" : "–"}</span>${fu ? `<span class="${d.fuel > 0 ? "fu" : "z"}">${d.fuel > 0 ? "−" + esc(f(d.fuel * tank / 100, 1)) + " L" : "–"}</span>` : ""}</div>`; });
  h += "</div>";
  /* 4. charges */
  h += `<div><h4>${esc(T("Charges"))}</h4>`;
  if (!m.chg.length) h += `<p class="hint">${esc(T("No charges in the period shown."))}</p>`;
  m.chg.slice().reverse().forEach((g) => {
    const dur = Math.round((g.e - g.s) / 60e3), dh = dur >= 60 ? `${Math.floor(dur / 60)}${T("h")} ${dur % 60}′` : `${dur}′`;
    const ok = Number.isFinite(g.from) && Number.isFinite(g.to), lo = ok ? Math.min(100, Math.max(0, Math.min(g.from, g.to))) : 0, wd2 = ok ? Math.min(100, Math.max(1, Math.abs(g.to - g.from))) : 0;
    h += `<div class="en-li"><span class="a"><span class="ic">${ico("plug")}</span><span class="mid">${esc(lbl(g.s))} · ${esc(hm(g.s))} – ${esc(g.live ? T("now") : hm(g.e))}<span class="bd">${esc(g.dc ? "DC" : "AC")}</span>${ok ? `<span class="bar"><i style="left:${lo}%;width:${wd2}%"></i></span>` : ""}<small>${ok ? esc(f(g.from, 0)) + " → " + esc(f(g.to, 0)) + "% · " : ""}${esc(dh)}</small></span></span><span class="b">${g.kwh ? esc(f(g.kwh, 1)) + " kWh" : ""}</span></div>`;
  });
  h += `<aside class="en-info"><span class="en-info-icon" aria-hidden="true">ⓘ</span><div><p>${esc(T("Battery use: net level drop during drives × {0} kWh capacity.", f(cap, 1)))}</p>${fu ? `<p>${esc(T("Petrol use: filtered level drop × {0} L tank.", f(tank, Number.isInteger(tank) ? 0 : 1)))}</p>` : ""}<p>${esc(T("Charging: battery level increase × capacity. All figures are estimates; delayed readings and small refills may be missed."))}</p><p>${esc(T("History follows HA Recorder retention. For 30 days, set purge_keep_days: 30 or higher."))}</p></div></aside></div>`;

  return h;
}

EN.panel = (d, card, options = {}) => {
  let stop = false, timer = 0, busy = false, chartObserver=null, lastChart=null;
  if(card._companion)card._compEnergyHost?.energyCleanup?.();
  let costs;
  d.energyCleanup=()=>{stop=true;clearInterval(timer);chartObserver?.disconnect();costs?.curveDialog?.remove();};
  if(card._companion)card._compEnergyHost=d;
  costs = options.chartOnly ? {ready:Promise.resolve(),dirty:false,history:async()=>{},decorate:()=>{}} : new ChargingCosts(card, d);
  const get = () => card._hass, S = () => (get() && get().states) || {};
  const ids = () => { const o = {}; for (const [k, key] of Object.entries(ENT)) o[k] = K.resolveId(get(), card._c, key); return o; };
  const body = () => d.querySelector(".en-body");
  const empty = (icon, txt, retry) => { const b = body(); if (!b) return; b.innerHTML = `${options.chartOnly?'<div class="en-nav"></div>':''}<div class="en-empty">${ico(icon)}<span>${esc(txt)}</span>${retry ? `<button class="btn sm" data-retry>${esc(T("Retry"))}</button>` : ""}</div>`;if(options.chartOnly)paintNav(get().locale?.language||"en"); };
  let selT = null;
  /* tap/drag on the chart: vertical line and the values at that moment */
  const bind = (m, ctx) => {
    const b = body(), svg = b && b.querySelector("svg.en-ch"), tip = b && b.querySelector(".en-tip"), cur = svg && svg.querySelector(".en-cur"); if (!svg || !tip || !cur) return;
    const t0 = Number(svg.dataset.t0), span = Number(svg.dataset.span), ymin = Number(svg.dataset.ymin), VW = Number(svg.dataset.width)||340, left=Number(svg.dataset.left)||10, right=Number(svg.dataset.right)||10, top=Number(svg.dataset.top)||12, ph=Number(svg.dataset.height)||96, plotWidth=VW-left-right, f0 = (n) => new Intl.NumberFormat(ctx.lang, { maximumFractionDigits: 0 }).format(n);
    const fmt = { format: (t) => K.haFmt(get()).wdh(t) };
    const show = (t) => {
      t = Math.min(m.now, Math.max(t0, t)); selT = t;
      const bv = at(m.batt, t), fv = m.fuel.length ? at(m.fuel, t) : NaN, vx = left + (t - t0) / span * plotWidth;
      const chg = m.chg.find((g) => t >= g.s && t <= (g.live ? ctx.now : g.e)), drv = !chg && m.drv.find((g) => t >= g.s && t <= g.e);
      const stx = chg ? [CL_OK, T("Charging") + " " + (chg.dc ? "DC" : "AC")] : drv ? (drv.fuel > 0 ? [CL_FUEL, T("Petrol driving")] : [CL_DRV, T("Driving")]) : ["var(--ds-fg2)", T("Parked")];
      cur.setAttribute("visibility", "visible"); const ln = cur.querySelector("line"), dt = cur.querySelector("circle");
      ln.setAttribute("x1", vx.toFixed(1)); ln.setAttribute("x2", vx.toFixed(1)); dt.setAttribute("cx", vx.toFixed(1));
      dt.setAttribute("cy", (top + (100 - Math.min(100, Math.max(ymin, bv))) / (100 - ymin) * ph).toFixed(1));
      tip.hidden = false;
      tip.innerHTML = `<b>${esc(fmt.format(t))}</b><i style="background:${stx[0]}"></i>${esc(stx[1])}<br>${esc(T("Battery"))} ${Number.isFinite(bv) ? esc(f0(bv)) + "%" : "–"}${ctx.hasFuel && Number.isFinite(fv) ? `<br>${esc(T("Petrol"))} ${esc(f0(fv))}%` : ""}`;
      const w = svg.getBoundingClientRect().width || 1, px = vx / VW * w; tip.style.left = px < w / 2 ? "auto" : "6px"; tip.style.right = px < w / 2 ? "6px" : "auto";
    };
    const at_ = (e) => { const r = svg.getBoundingClientRect(); return t0 + ((e.clientX - r.left) / r.width * VW - left) / plotWidth * span; };
    let down = false;
    svg.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();show((selT??m.now)+(e.key==="ArrowRight"?1:-1)*span/100);}});
    svg.addEventListener("pointerdown", (e) => { down = true; show(at_(e)); });
    svg.addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") show(at_(e)); });
    const up = () => { down = false; }; svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !down) { cur.setAttribute("visibility", "hidden"); tip.hidden = true; selT = null; } });
    if (selT !== null) show(selT);
  };
  let off = 0, period = 7, reqId = 0, limitT = null;
  if(options.chartOnly)period=30;
  /* 7-day windows ending today (not Monday–Sunday): always full days; offset -1 = the 7 days before */
  const wkStart = (o) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (period - 1) + o * period); return x.getTime(); };
  const paintNav = (lang) => {
    const n = d.querySelector(".en-nav"); if (!n) return;
    const t0 = wkStart(off), t1 = new Date(t0), fm = { format: (t) => K.haFmt(get()).dm(t) };
    t1.setDate(t1.getDate() + period - 1);
    const noPrev = !options.chartOnly && limitT !== null && limitT > t0, days = limitT !== null ? Math.max(1, Math.round((Date.now() - limitT) / 86400000)) : 0;
    n.innerHTML = `<div class="en-period" role="group" aria-label="${esc(T("Period"))}"><button data-period="7" aria-pressed="${period === 7}">${esc(T("Weekly"))}</button><button data-period="30" aria-pressed="${period === 30}">${esc(T("Monthly"))}</button></div><div class="en-dates"><button class="btn" data-wk="-1" aria-label="${esc(T("Previous period"))}"${noPrev ? " disabled" : ""}>${ico("chevl")}</button><div class="en-wk"><b>${esc(fm.format(t0))} – ${esc(fm.format(t1))}</b><small>${esc(T(off === 0 ? "Last {0} days" : "{0}-day period", period))}</small></div><button class="btn" data-wk="1" aria-label="${esc(T("Next period"))}"${off >= 0 ? " disabled" : ""}>${ico("chevr")}</button></div>${noPrev ? `<p class="hint en-lim">${esc(T("Recorder limit: history goes back about {0} days.", days))}</p>` : ""}`;

  };
  const startPeriodLoading = () => {
    const b=body();if(!b)return;b.style.minHeight=b.getBoundingClientRect().height+'px';b.classList.add('is-period-loading');b.setAttribute('aria-busy','true');
    b.querySelectorAll('.en-period-loader,.en-load-error').forEach(node=>node.remove());
    const target=b.querySelector('.en-cw')||b,loader=document.createElement('div');loader.className='en-period-loader';loader.setAttribute('role','status');loader.setAttribute('aria-label',T('Loading history'));loader.innerHTML=LOAD();target.append(loader);
  };
  const run = async (first, force) => {
    if (stop || !get() || costs.dirty || (busy && !force)) return; busy = true; const my = ++reqId;
    try {
      await costs.ready;
      const hass = get(), st = S(), id = ids(), real = Date.now(), cfg = card._c || {}, cap = card._battKwh ? card._battKwh() : (Number(cfg.battery_kwh) > 0 ? Number(cfg.battery_kwh) : DEF_KWH);
      const t0 = wkStart(off), tEnd = Math.min(real, (() => { const end = new Date(t0); end.setDate(end.getDate() + period); return end.getTime(); })()), cur = off === 0, lang = (hass.locale && hass.locale.language) || hass.language || "en";
      paintNav(lang);
      if(options.chartOnly)d.dispatchEvent(new CustomEvent('energy-period',{detail:{start:t0,end:tEnd,period},bubbles:true}));
      if (!st[id.batt]) { empty("info", T("Battery sensor not found. Check the prefix in Settings → Vehicle.")); return; }
      const want = ["batt", "ac", "dc", "odo", "pow", "fuel"].filter((k) => st[id[k]]);
      let res;
      try {
        res = await hass.callWS({ type: "history/history_during_period", start_time: new Date(t0).toISOString(), end_time: new Date(tEnd).toISOString(), entity_ids: want.map((k) => id[k]), include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true });
      } catch (_) { if (my === reqId){if(!body().querySelector('.en-now'))empty("alert", T("Couldn't load history from Home Assistant."), true);else{const note=document.createElement('p');note.className='en-load-error';note.textContent=T("Couldn't load history from Home Assistant.");body().querySelector('.en-nav')?.after(note);}}return; }
      if (my !== reqId) return;
      const raw = {}; for (const k of ["batt", "ac", "dc", "odo", "pow", "fuel"]) raw[k] = rowsOf(res && res[id[k]]);
      /* recorder limit: if the data starts inside the week (or is missing) there is no older history */
      const fr = raw.batt.length ? raw.batt[0][0] : null;
      if (fr === null) { if (limitT === null) limitT = tEnd; } else if (fr > t0 + 5 * 60e3) limitT = limitT === null ? fr : Math.min(limitT, fr);
      paintNav(lang);
      const m = model(raw, tEnd, cap, t0, period, cur);m.curveRaw=raw;
      if (!m.hasData) { empty("info", T("No battery history yet. The Home Assistant recorder must record it.")); return; }
      const tankCapacity = Number(cfg.fuel_tank_liters) > 0 ? Number(cfg.fuel_tank_liters) : num(st[id.tank]?.state) > 0 ? num(st[id.tank].state) : DEF_TANK;
      const ctx = { chartWidth: Math.round(body()?.clientWidth||340), fmt: K.haFmt(hass), lang, cap, tankCapacity, cur, st: Object.fromEntries(Object.keys(ENT).map((k) => [k, st[id[k]]])), hasFuel: !!st[id.fuel] && cfg.powertrain !== "ev", now: real };
      await costs.history(m);
      if (my !== reqId || costs.dirty || stop) return;
      ctx.chartWidth=Math.round(body()?.clientWidth||340);
      lastChart={m,ctx};
      if(options.chartOnly){
        const template=document.createElement("template");template.innerHTML=view(m,ctx);
        const chart=template.content.querySelector(".en-cw")?.parentElement;
        if(chart){body().replaceChildren(chart);body().insertAdjacentHTML("afterbegin",'<div class="en-nav"></div>');paintNav(lang);bind(m,ctx);}else empty("info",T("No battery history yet. The Home Assistant recorder must record it."));
        return;
      }
      body().innerHTML = view(m, ctx); paintNav(lang); bind(m, ctx); costs.decorate(m, ctx);
    } finally { if (my === reqId){busy = false;const b=body();if(b){b.querySelectorAll('.en-period-loader').forEach(node=>node.remove());b.classList.remove('is-period-loading');b.removeAttribute('aria-busy');b.style.minHeight='';}resizeChart();} }
  };
  d.classList.add("enpanel");
  d.innerHTML = `<style>${PCSS}</style><div class="en-body"><div class="en-nav"></div>${LOAD()}</div>`;
  d.addEventListener("click", (e) => {
    if (e.target.closest("[data-cc]")) return;
    const p = e.target.closest("[data-period]");
    if (costs.dirty && e.target.closest("[data-period],[data-wk]")) { const status = d.querySelector(".cc-editor [role=status]"); if (status) status.textContent = CT("Save or close the editor before changing dates.", "Αποθήκευσε ή κλείσε τον επεξεργαστή πριν αλλάξεις ημερομηνία."); return; }
    if (p && Number(p.dataset.period) !== period) { period = Number(p.dataset.period); off = 0; selT = null; startPeriodLoading();run(true, true); return; }
    const w = e.target.closest("[data-wk]");
    if (w && !w.disabled) { off = Math.min(0, off + Number(w.dataset.wk)); selT = null; startPeriodLoading();run(true, true); return; }
    if (e.target.closest("[data-retry]")) { body().innerHTML = '<div class="en-nav"></div>' + LOAD(); run(true, true); }
  });
  run(true);
  const resizeChart=()=>{
    if(stop||busy||!d.isConnected||!lastChart||costs.dirty||!body()?.querySelector('svg.en-ch'))return;
    const width=Math.round(body().clientWidth||340);if(Math.abs(width-lastChart.ctx.chartWidth)<8)return;
    const {m,ctx}=lastChart;ctx.chartWidth=width;
    if(options.chartOnly){const template=document.createElement('template');template.innerHTML=view(m,ctx);const chart=template.content.querySelector('.energy-chart-block');if(chart){body().replaceChildren(chart);body().insertAdjacentHTML("afterbegin",'<div class="en-nav"></div>');paintNav(ctx.lang);}}
    else{body().innerHTML=view(m,ctx);paintNav(ctx.lang);costs.decorate(m,ctx);}
    bind(m,ctx);
  };chartObserver=new ResizeObserver(resizeChart);chartObserver.observe(d);
  timer = setInterval(() => { if (!d.isConnected) { stop = true; clearInterval(timer); return; } if (off === 0) run(false); }, 120000);
};
/* Optional module translations (English source keys) — taken by the card's I18N through addExtra */
EN.lang = {};
EN.ready = false;
EN.init = (ctx) => { K = ctx; EN.ready = true; };
EN.model = model; EN.chargeSegments = chargeSegments; EN.driveSegments = driveSegments; EN.rowsOf = rowsOf;
})();

