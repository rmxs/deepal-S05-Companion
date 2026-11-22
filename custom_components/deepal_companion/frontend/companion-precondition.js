/* Remote climate preconditioning UI. One implementation, three places:
 *   mode "card"          → vehicle card → Climate → Preconditioning (status, controls, schedules, notifications)
 *   mode "settings"      → Companion dashboard → Preconditioning (configuration, schedules, battery, diagnostics)
 *   mode "notifications" → Companion dashboard → Notifications → Preconditioning
 * Every place reads and writes the same backend settings (precondition_get / precondition_set), so a toggle changed
 * in one place is what the others show. Commands go only to the backend controller: no retries or timers here
 * decide anything about the vehicle. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const STATUS={IDLE:['Idle','muted'],START_REQUESTED:['Starting','info'],STARTING:['Starting','info'],VERIFYING_START:['Verifying','info'],RETRYING_START:['Retrying','warn'],ACTIVE:['Active','ok'],STOP_REQUESTED:['Stopping','info'],STOPPING:['Stopping','info'],VERIFYING_STOP:['Verifying','info'],RETRYING_STOP:['Retrying','warn'],INACTIVE:['Stopped','muted'],FAILED:['Failed','bad'],UNKNOWN:['Unknown','warn'],SUPERSEDED:['Replaced','muted']};
const BUSY=new Set(['START_REQUESTED','STARTING','VERIFYING_START','RETRYING_START','STOP_REQUESTED','STOPPING','VERIFYING_STOP','RETRYING_STOP']);
const EVENT_LABELS=[['start_confirmed','Climate on confirmed','The car reported that the climate is on.'],['stop_confirmed','Climate off confirmed','The car reported that the climate is off.'],['session_ended','Session ended by the vehicle','The car switched the climate off by itself (15-minute limit or earlier).'],['failure','Command failed','A start or stop could not be completed after the allowed attempts.'],['unknown','State could not be confirmed','The car did not report back, so the real state is unknown.'],['schedule_result','Scheduled run result','A schedule started, failed or was missed.'],['battery','Battery protection','Low battery blocks, skipped schedules and battery stops.'],['retry','Retry warning','A command is being tried again.'],['start_requested','Start requested','Sent as soon as you or a schedule asks to start.'],['stop_requested','Stop requested','Sent as soon as a stop is asked for.']];
const REASONS={battery_low:'Battery is at or below the protection level.',battery_stale:'Battery level is not current.',battery_unavailable:'Battery level is unavailable.',start_in_progress:'A start is already in progress.',already_on:'Climate is already on, so nothing was changed.',already_active:'A preconditioning session is already running.',stop_in_progress:'A stop is in progress.',busy:'Another session was running.',duration:'Planned duration reached.',battery:'Stopped by battery protection.',manual:'Stopped by you.',schedule:'Stopped by the schedule.',recovery:'Recovered after a Home Assistant restart.'};
const STYLE=`
.pc{display:grid;gap:12px;color:var(--ds-fg,var(--primary-text-color));font-size:13px;min-width:0}
.pc section{display:grid;gap:10px;box-sizing:border-box;border:1px solid var(--cp-off-line);border-radius:var(--cp-block-r);padding:var(--cp-block-p);background:var(--cp-block-bg);min-width:0}
.pc h4{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}.pc h4 ha-icon{--mdc-icon-size:18px;color:var(--ds-fg2,var(--secondary-text-color))}
.pc .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.pc .kv{display:grid;gap:2px;padding:9px 10px;border-radius:12px;background:var(--ds-card,rgba(127,127,127,.06));min-width:0}.pc .kv small{font-size:11px;color:var(--ds-fg2,var(--secondary-text-color))}.pc .kv b{font-size:14px;font-weight:600;overflow-wrap:anywhere}
.pc .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;color:rgb(var(--c));background:rgba(var(--c),.14);width:max-content}
.pc .ok{--c:var(--ds-ok,52,211,153)}.pc .warn{--c:var(--ds-warn,250,204,21)}.pc .bad{--c:var(--ds-bad,248,113,113)}.pc .info{--c:var(--ds-info,121,173,255)}.pc .muted{--c:150,150,150}
.pc .note{margin:0;font-size:12px;line-height:1.5;color:var(--ds-fg2,var(--secondary-text-color))}
.pc .info-box{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:12px;background:rgba(var(--c),.08);border:1px solid rgba(var(--c),.25);font-size:12px;line-height:1.5}.pc .info-box ha-icon{--mdc-icon-size:18px;color:rgb(var(--c));flex:none}
.pc .row{display:flex;align-items:center;gap:10px;justify-content:space-between;min-height:40px;flex-wrap:wrap}.pc .row>span{flex:1;min-width:140px}.pc .row>span.chip{flex:none;min-width:0}
.pc label.f{display:grid;gap:4px;font-size:12px;color:var(--ds-fg2,var(--secondary-text-color));min-width:0}
.pc input:not([type=checkbox]):not([type=range]):not([type=hidden]),.pc select{min-height:40px;box-sizing:border-box;width:100%;padding:0 10px;border-radius:10px;border:1px solid var(--ds-line,var(--divider-color));background:var(--ds-card,var(--card-background-color));color:inherit;font:inherit}
.pc button{min-height:40px;padding:0 14px;border-radius:var(--ctl-r,12px);border:1px solid var(--ds-line,var(--divider-color));background:var(--ds-card,transparent);color:inherit;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.pc button:disabled{opacity:.5;cursor:default}.pc button ha-icon{--mdc-icon-size:18px}
.pc button.go{background:var(--cp-accent);border-color:transparent;color:var(--pc-on-accent,rgb(var(--ds-ac-ink,16,21,18)))}.pc button.stop{background:rgba(var(--ds-bad,248,113,113),.14);color:rgb(var(--ds-bad,248,113,113));border-color:rgba(var(--ds-bad,248,113,113),.35)}
.pc .actions{display:flex;gap:8px;flex-wrap:wrap}.pc .actions>button{flex:1;min-width:130px}
.pc .subgrp{display:grid;gap:12px;min-width:0}.pc .f:has(>.pills){gap:8px}
.pc .subgrp.off{opacity:.4;filter:grayscale(1);pointer-events:none;transition:opacity .2s}/* switch, press feedback and pills: source/companion-shared.css */
.pc .sched{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:10px;border-radius:12px;background:var(--ds-card,rgba(127,127,127,.06))}.pc .sched b{display:block;font-size:13px}.pc .sched small{color:var(--ds-fg2,var(--secondary-text-color));font-size:11.5px;overflow-wrap:anywhere}
.pc .days{display:flex;gap:4px;flex-wrap:wrap}.pc .days label{position:relative}.pc .days input{position:absolute;opacity:0;inset:0}.pc .days span{display:grid;place-items:center;min-width:40px;height:36px;border-radius:10px;border:1px solid var(--ds-line,var(--divider-color));font-size:12px;font-weight:600}.pc .days input:checked+span{background:var(--cp-accent);color:var(--pc-on-accent,rgb(var(--ds-ac-ink,16,21,18)));border-color:transparent}.pc .days input:focus-visible+span{outline:2px solid rgb(var(--ds-info,121,173,255))}
.pc .editor{display:grid;gap:10px;padding:12px;border-radius:12px;border:1px dashed var(--ds-line,var(--divider-color))}
.pc .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
.pc details summary{cursor:pointer;min-height:36px;line-height:36px;font-weight:600}
.pc .hist{display:grid;gap:4px;max-height:260px;overflow-y:auto;overscroll-behavior:contain}.pc .hist div{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--ds-line,var(--divider-color))}.pc .hist>div>span:last-child{color:var(--ds-fg2,var(--secondary-text-color));white-space:nowrap}
.pc button.more{width:100%}
.pc details{min-width:0;max-width:100%}.pc .grid{grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr))!important}.pc .grid>*{min-width:0}.pc .kv b{overflow-wrap:anywhere;word-break:break-word}
.pc .hist div{min-width:0}.pc .hist>div>span:first-child{min-width:0;overflow-wrap:anywhere;word-break:break-word}
.pc .pcsw input{-webkit-appearance:none!important;appearance:none!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;opacity:0!important}.pc .pcsw input::before,.pc .pcsw input::after{content:none!important;display:none!important}
.pc .err{color:rgb(var(--ds-bad,248,113,113))}
.pc .pills{display:flex;flex-wrap:wrap;gap:8px}.pc .pill{min-height:40px;padding:0 14px;border-radius:999px;font-size:12.5px;font-weight:600;gap:6px}.pc .pill ha-icon{--mdc-icon-size:17px}
.pc .f .note{font-size:11.5px}
.pc .two{align-items:start;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))!important}
.pc details.adv{border:1px solid var(--ds-line,rgba(127,127,127,.3));border-radius:14px;background:var(--ds-card,rgba(127,127,127,.06));padding:0 12px}
.pc details.adv>summary{display:flex;align-items:center;gap:8px;min-height:48px;line-height:1.3;list-style:none;font-size:13px}.pc details.adv>summary::-webkit-details-marker{display:none}
.pc details.adv>summary::after{content:'';margin-left:auto;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s;opacity:.6}.pc details.adv[open]>summary::after{transform:rotate(-135deg)}
.pc details.adv>summary ha-icon{--mdc-icon-size:18px;color:var(--ds-fg2,var(--secondary-text-color))}.pc details.adv>.two{padding:4px 0 14px}
.pc input[type=time],.pc input[type=date]{-webkit-appearance:none;appearance:none;display:flex;align-items:center;line-height:44px;padding:0 12px!important;text-align:left;font-size:15px;font-variant-numeric:tabular-nums}
.pc input[type=time]::-webkit-date-and-time-value,.pc input[type=date]::-webkit-date-and-time-value{text-align:left;margin:0;line-height:44px}
.pc input[type=time]::-webkit-datetime-edit,.pc input[type=date]::-webkit-datetime-edit{padding:0;line-height:44px}
.pc .seg{display:flex;gap:4px;padding:4px;height:44px;box-sizing:border-box;border-radius:12px;background:var(--ds-card,rgba(127,127,127,.08));border:1px solid var(--ds-line,rgba(127,127,127,.3))}
.pc .seg button{flex:1;min-width:0;height:34px;min-height:34px;padding:0 6px;border:0;border-radius:9px;background:transparent;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ds-fg2,var(--secondary-text-color))}
.pc .seg button[aria-pressed=true]{background:var(--cp-accent);color:var(--pc-on-accent,rgb(var(--ds-ac-ink,16,21,18)))}
.pc .stp{border:1px solid var(--ds-line,rgba(127,127,127,.3))!important;box-sizing:border-box}
.pc .f{align-content:start}.pc .f>.lab{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px;font-size:12.5px;color:var(--ds-fg2,var(--secondary-text-color))}.pc .f>.lab b{font-size:14px;color:var(--ds-fg,var(--primary-text-color));font-weight:600}
.pc input:not([type=checkbox]):not([type=range]),.pc select{height:44px;min-height:44px}
.pc .sl{position:relative;display:flex;align-items:center;height:44px;padding:0}
.pc .sl input[type=range]{-webkit-appearance:none!important;appearance:none!important;position:absolute;inset:0;display:block;width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;outline:none;cursor:pointer;touch-action:pan-y;--thumb:24px;--fill:calc(var(--thumb) / 2 + (100% - var(--thumb)) * var(--f,0))}
.pc .sl input[type=range]::-webkit-slider-runnable-track{height:44px;border:0;background:linear-gradient(90deg,var(--cp-accent) 0 var(--fill),var(--ds-line,rgba(127,127,127,.35)) var(--fill) 100%) center/100% 8px no-repeat;border-radius:99px}
.pc .sl input[type=range]::-moz-range-track{height:44px;border:0;background:transparent}
.pc .sl input[type=range]::-moz-range-progress{height:8px;border-radius:99px;background:var(--cp-accent)}
.pc .sl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:var(--thumb);height:var(--thumb);margin-top:10px;border-radius:50%;background:#fff;border:3px solid var(--cp-accent);box-shadow:0 1px 4px #0006;box-sizing:border-box}
.pc .sl input[type=range]::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid var(--cp-accent);box-sizing:border-box}
.pc .sl input[type=range]:disabled{opacity:.5;cursor:default}
.pc .sl input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(var(--ds-info,121,173,255),.5)}
.pc .kv{align-content:start}
.pc .days{display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px!important;grid-column:1/-1;margin:0}
.pc .days label{display:block!important;position:relative;margin:0!important;padding:0!important;min-width:0}
.pc .days span{min-width:0!important;width:100%;height:40px!important;box-sizing:border-box}
.pc .editor .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pc .editor .actions .stop{grid-column:1/-1}
.pc .summary .v,.pc .pg-sum .v{color:var(--cp-accent);font-weight:700}.pc .summary .off,.pc .pg-sum .off{color:rgb(var(--ds-warn,250,204,21));font-weight:700}
.pc .stp{display:grid;border-color:var(--ds-line,var(--divider-color,#444))!important;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;height:44px;border-radius:12px;border:1px solid var(--ds-line,var(--divider-color));background:var(--ds-card,var(--card-background-color));overflow:hidden;max-width:220px}
.pc .stp button{height:44px;min-height:44px;border:0;border-radius:0;padding:0;font-size:20px;background:transparent}.pc .stp output{text-align:center;font-weight:600;font-size:14px}
.pc .summary{display:grid;gap:8px;padding:14px 16px;border-radius:16px;background:rgba(var(--ds-info,121,173,255),.08);border:1px solid rgba(var(--ds-info,121,173,255),.25)}
.pc .summary h4 ha-icon{color:rgb(var(--ds-info,121,173,255))}.pc .summary ul{margin:0;padding-left:18px;display:grid;gap:6px;line-height:1.5}.pc .summary li{font-size:13px}
.pc.q{gap:10px}
.pc.q section{gap:12px}
.pc.q .q-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--ds-line,var(--divider-color))}
.pc.q .q-rep{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ds-fg2,var(--secondary-text-color));position:relative}
.pc.q .q-icon{min-height:28px;width:28px;padding:0;border-radius:50%;border:0;background:transparent;color:var(--ds-fg2,var(--secondary-text-color))}.pc.q .q-icon ha-icon{--mdc-icon-size:16px}
.pc.q .q-icon.spin ha-icon{animation:pcspin .8s linear infinite}@keyframes pcspin{to{transform:rotate(360deg)}}
.pc.q .q-tip{position:absolute;right:0;top:32px;z-index:3;width:min(250px,70vw);padding:10px 12px;border-radius:14px;background:var(--ds-card,var(--card-background-color));border:1px solid var(--ds-line,var(--divider-color));box-shadow:0 10px 30px #0006;font-size:12px;line-height:1.5;color:var(--ds-fg,var(--primary-text-color))}
.pc.q .q-tele{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.pc.q .q-tele>div{min-width:0;padding:0 10px;border-left:1px solid var(--ds-line,var(--divider-color))}.pc.q .q-tele>div:first-child{padding-left:0;border:0}.pc.q .q-tele>div:last-child{padding-right:0}
.pc.q .q-tele small{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--ds-fg2,var(--secondary-text-color));min-height:22px}.pc.q .q-tele b{display:block;margin-top:2px;font-size:16px;font-weight:600;overflow-wrap:anywhere}.pc.q .q-tele em{display:block;margin-top:2px;font-style:normal;font-size:10.5px;color:var(--ds-fg2,var(--secondary-text-color))}
.pc.q .q-tele .q-icon{min-height:22px;width:22px}
/* the temperature tone colours only the readout; --ds-ok keeps meaning success */.pc.q [data-tone=cool]{--pc-tone:rgb(var(--ds-info,121,173,255))}.pc.q [data-tone=warm]{--pc-tone:rgb(var(--ds-warn,250,204,21))}
.pc.q .q-trow{display:flex;align-items:center;justify-content:space-between;gap:10px}.pc.q .q-trow small{display:block;font-size:12px;font-weight:500;color:var(--ds-fg2,var(--secondary-text-color))}
.pc.q .q-big{display:block;margin-top:2px;font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--pc-tone,var(--cp-accent))}
.pc.q .q-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pc.q .q-chips button{min-height:38px;padding:0 6px;border-radius:12px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ds-fg2,var(--secondary-text-color))}
.pc.q .q-chips button[aria-pressed=true]{border-color:var(--cp-accent);color:var(--cp-accent);background:color-mix(in srgb,var(--cp-accent) 8%,transparent)}
.pc.q hr{border:0;border-top:1px solid var(--ds-line,var(--divider-color));margin:0;width:100%}
.pc.q .q-dur{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.pc.q .q-dur>div{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ds-fg2,var(--secondary-text-color))}.pc.q .q-tag{padding:2px 8px;border-radius:8px;background:var(--ds-card,rgba(127,127,127,.1));font-size:10.5px}.pc.q .q-dur b{font-size:14px;color:var(--ds-fg,var(--primary-text-color))}
.pc.q .q-segd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:4px;border-radius:14px;background:var(--ds-card,rgba(127,127,127,.08));border:1px solid var(--ds-line,rgba(127,127,127,.3))}
.pc.q .q-segd button{min-height:36px;border:0;border-radius:10px;background:transparent;font-size:12.5px;color:var(--ds-fg2,var(--secondary-text-color))}.pc.q .q-segd button[aria-pressed=true]{background:var(--cp-accent);color:var(--pc-on-accent,rgb(var(--ds-ac-ink,16,21,18)))}
.pc.q .q-go{width:100%;min-height:48px;border-radius:var(--ctl-cta,16px);font-size:14px}
.pc.q .q-wait,.pc.q .q-live{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:0 12px;border-radius:16px;overflow:hidden;border:1px solid var(--ds-line,var(--divider-color));background:var(--ds-card,rgba(127,127,127,.06))}
.pc.q .q-wait{justify-content:center;font-weight:600}.pc.q .q-live{border-color:color-mix(in srgb,var(--cp-accent) 35%,transparent)}.pc.q .q-fill{position:absolute;inset:0 auto 0 0;background:color-mix(in srgb,var(--cp-accent) 16%,transparent);transition:width 1s linear;pointer-events:none}
.pc.q .q-live>.q-now{position:relative;display:flex;align-items:center;gap:8px}.pc.q .q-live>button{position:relative}.pc.q .q-live b{font-size:14px}.pc.q .q-live small{font-size:12px;color:var(--ds-fg2,var(--secondary-text-color))}.pc.q .q-live .stop{min-height:36px;padding:0 12px;border-radius:12px;font-size:12px}
.pc.q .q-dot{width:8px;height:8px;border-radius:50%;background:var(--cp-accent);animation:pcpulse 1.8s ease-in-out infinite}@keyframes pcpulse{50%{opacity:.45;transform:scale(.85)}}
.pc.q .q-spin{width:16px;height:16px;border-radius:50%;border:2px solid color-mix(in srgb,var(--cp-accent) 30%,transparent);border-top-color:var(--cp-accent);animation:pcspin .8s linear infinite}
.pc.q section.q-flush{padding:0;gap:0;overflow:hidden}.pc.q .q-rowbtn{width:100%;min-height:56px;padding:10px 14px;border:0;border-radius:0;background:transparent;justify-content:space-between;text-align:left}
.pc.q .q-rowl{display:flex;align-items:center;gap:12px;min-width:0}.pc.q .q-rowl>span:last-child{display:grid;min-width:0}.pc.q .q-rowl b{font-size:13px;font-weight:600}.pc.q .q-rowl small{font-size:11.5px;color:var(--ds-fg2,var(--secondary-text-color));font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc.q .q-ico{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:10px;background:var(--ds-card,rgba(127,127,127,.1));color:var(--ds-fg2,var(--secondary-text-color))}.pc.q .q-ico ha-icon{--mdc-icon-size:17px}
.pc.q .q-badge2{padding:3px 10px;border-radius:9px;background:var(--ds-card,rgba(127,127,127,.1));font-size:12px;font-weight:600}.pc.q .q-badge2.on{background:color-mix(in srgb,var(--cp-accent) 15%,transparent);color:var(--cp-accent)}
.pc.q .q-rowr{display:flex;align-items:center;gap:8px;flex:none}.pc.q .q-chev{transition:transform .2s;opacity:.6}.pc.q .q-chev[data-open=true]{transform:rotate(90deg)}
.pc.q .q-drawer{display:grid;gap:8px;padding:10px 14px 14px;border-top:1px solid var(--ds-line,var(--divider-color));background:rgba(0,0,0,.08)}
.pc.q .q-row2{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px}.pc.q .q-row2 .q-rowl{flex:1}.pc.q .q-linkrow{min-height:0;padding:0;border:0;background:transparent;justify-content:flex-start;text-align:left;border-radius:var(--ctl-r,12px);cursor:pointer}
.pc.q .q-rowl>span:last-child,.pc.q .q-rowl b,.pc.q .q-rowl small{min-width:0;overflow-wrap:anywhere}
@media (max-width:430px){
.pc.q section{gap:10px}
.pc.q .q-tele>div{padding:0 6px}.pc.q .q-tele b{font-size:14px}.pc.q .q-tele small{font-size:10.5px}
.pc.q .q-big{font-size:24px}
.pc.q .q-chips,.pc.q .q-segd{gap:4px}.pc.q .q-chips button,.pc.q .q-segd button{padding:0 2px;font-size:12px}
.pc.q .q-dur{flex-direction:column;align-items:stretch}
.pc.q .q-live{flex-wrap:wrap;padding:8px 12px;row-gap:6px}
.pc.q .q-tip{right:-8px;width:min(250px,calc(100vw - 56px))}
.pc.q .q-rowbtn{padding:10px 12px}.pc.q .q-row2{padding:12px}.pc.q .q-drawer{padding:10px 12px 12px}
.pc .days{gap:4px!important}.pc .days span{height:36px!important;font-size:12px}
.pc .editor .actions{grid-template-columns:1fr}
}
/* page layout (not the quick sheet): modern app look, consistent with Card Settings */
.pc:not(.q){gap:14px}
@media(min-width:900px){.pc:not(.q):has(>section+section){display:block;columns:2;column-gap:14px}.pc:not(.q):has(>section+section)>*{break-inside:avoid;margin:0 0 14px}.pc:not(.q)>.summary,.pc:not(.q)>section[aria-live]{column-span:all}} /* two balanced columns on wide screens, no empty gaps */
.pc:not(.q) section{gap:12px}
.pc:not(.q) section>h4,.pc:not(.q) section>.row>h4{font-size:14.5px;font-weight:700;gap:10px}
.pc:not(.q) section>h4 ha-icon,.pc:not(.q) section>.row>h4 ha-icon,.pc:not(.q) section>.row>h4 svg{display:grid;place-items:center;width:32px;height:32px;padding:6px;box-sizing:border-box;border-radius:10px;background:var(--cp-on-bg);color:var(--cp-accent);--mdc-icon-size:18px;flex:none}
.pc:not(.q) .kv{padding:12px;border-radius:14px;gap:4px;border:1px solid var(--ds-line,rgba(127,127,127,.2))}.pc:not(.q) .kv b{font-size:17px;font-weight:700}
.pc:not(.q) .row:has(>.pcsw){padding:10px 12px;border-radius:14px;border:1px solid var(--ds-line,rgba(127,127,127,.25));background:rgba(127,127,127,.05);min-height:52px;box-sizing:border-box;transition:background .2s,border-color .2s}
.pc:not(.q) .row:has(>.pcsw input:checked){background:color-mix(in srgb,var(--cp-accent) 10%,transparent);border-color:color-mix(in srgb,var(--cp-accent) 40%,transparent)}
.pc:not(.q) .row:has(>.pcsw)>span{font-weight:600}.pc:not(.q) .row:has(>.pcsw) .note{font-weight:400;font-size:11.5px}
.pc:not(.q) .info-box{border-radius:14px;padding:10px 12px}
.pc:not(.q) details.adv{border-radius:14px}
@media(max-width:480px){.pc:not(.q) .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.pc:not(.q) .actions>button{flex:1 1 100%}}
.pc .ptgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.pc .ptgrid.ev{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.pc .ptsub{font-size:12px;font-weight:600;color:var(--ds-fg2,var(--secondary-text-color));margin:4px 0 -2px}
.pc .ptile{margin:0!important;position:relative;display:flex;align-items:center;gap:10px;min-height:52px;padding:10px 12px;box-sizing:border-box;border-radius:14px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg);cursor:pointer;min-width:0}
.pc .ptile input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.pc .ptile:has(input:focus-visible){outline:2px solid rgb(var(--ds-info,121,173,255));outline-offset:2px}
.pc .ptx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.pc .ptx b{font-size:13px;font-weight:600;line-height:1.25}.pc .ptx small{font-size:11.5px;line-height:1.35;color:var(--ds-fg2,var(--secondary-text-color))}
.pc .ptile.cp{min-height:48px;padding:8px 10px}.pc .ptile.cp .ptx b{font-size:12.5px}.pc .ptile.cp .ptx small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:11px}

.pc .ptile:has(input:checked){background:var(--cp-on-bg);border-color:var(--cp-on-line)}.pc .ptile:has(input:checked) .ptx b{color:var(--cp-accent)}
/* picked-tile tick: source/companion-shared.css */
.pc .ptile:has(input:disabled){opacity:.45;cursor:default}
@media(max-width:480px){.pc .ptgrid{grid-template-columns:minmax(0,1fr)}.pc .ptgrid.ev{grid-template-columns:repeat(2,minmax(0,1fr))}.pc .ptile.cp .ptx small{display:none}.pc .ptile.cp{min-height:56px}}

/* Dashboard page: header with the live values, then two columns (settings | notifications). Phones: one column, one button per row. */
.pc.pg{container-type:inline-size;gap:14px}
.pc.pg .pg-hero{gap:12px}
.pc.pg .pg-head{justify-content:flex-start;gap:10px 12px}.pc.pg .pg-head>h4{flex:none}
.pc.pg .pg-act{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
.pc.pg .pg-sum{padding:12px 14px;border-radius:14px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg)}
.pc.pg .pg-sum ul{margin:0;padding:0;list-style:none;display:grid;gap:8px 28px;grid-template-columns:minmax(0,1fr)}
.pc.pg .pg-sum li{position:relative;padding-left:16px;font-size:12.5px;line-height:1.5;color:var(--ds-fg2,var(--secondary-text-color))}
.pc.pg .pg-sum li::before{content:"";position:absolute;left:2px;top:.6em;width:6px;height:6px;border-radius:50%;background:var(--cp-accent)}
.pc.pg .pg-strip .kv em{font-style:normal;font-size:11px;color:var(--ds-fg2,var(--secondary-text-color))}
.pc.pg .kv.warn b{color:rgb(var(--c))}
.pc.pg .pg-cols{display:grid;gap:14px;grid-template-columns:minmax(0,1fr);align-items:start}
.pc.pg .pg-col{display:grid;gap:14px;align-content:start;min-width:0}
@container (min-width:560px){.pc.pg .ptgrid.ev{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}}
@container (min-width:760px){.pc.pg .pg-cols{grid-template-columns:minmax(0,5fr) minmax(0,7fr)}.pc.pg .pg-sum ul{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:560px){.pc.pg .pg-act{width:100%;margin-left:0}.pc.pg .pg-act>button{flex:1 1 100%}.pc.pg .pg-hero>.pg-head .chip{margin-left:auto}}
`;

export function mountPrecondition(host,{onMore=null,request,t=s=>s,loaderHtml=()=>'',loaderCss='',notify=()=>{},getHass=()=>null,mode='card',admin=true,scrollTo=null}){
  const T=(s,...a)=>{let r=t(s);a.forEach((v,i)=>{r=String(r).replace('{'+i+'}',v);});return r;};
  let testResult='',data=null,dead=false,timer=null,busy=false,edit=null,error='';
  const ui={temperature:null,duration:null};
  host.innerHTML='<style>'+loaderCss+STYLE+'</style><div class="pc">'+loaderHtml('snow')+'</div>';
  const root=host.querySelector('.pc');if(mode==='quick')root.classList.add('q');
  const PAGE=!['quick','card','notifications'].includes(mode);if(PAGE)root.classList.add('pg');  /* the Companion dashboard page has its own layout */
  let scrolled=false,infoOpen=false,schedOpen=false,summaryOpen=false,reloading=false,pending=null,clock=null,saveTimer=null,queued={};
  /* Times follow the Home Assistant profile (12/24 h, language, time zone), not the browser language. */
  const fmt=()=>{const h=getHass(),l=h?.locale||{},tf=l.time_format||'language',tz=h?.config?.time_zone,loc=tf==='system'?undefined:(l.language||h?.language||undefined);const o={hour:tf==='12'?'numeric':'2-digit',minute:'2-digit'};if(tf==='12')o.hour12=true;else if(tf==='24')o.hourCycle='h23';if(tz)o.timeZone=tz;const show=(ts,opts)=>{try{return new Date(ts*1000).toLocaleString(loc,opts);}catch(_){return '—';}};return{hm:ts=>ts?show(ts,o):'—',dt:ts=>ts?show(ts,{weekday:'short',day:'numeric',month:'short',...o}):'—'};};
  const ago=ts=>{if(!ts)return '—';const s=Math.max(0,Date.now()/1000-ts);return s<60?T('now'):s<3600?T('{0} min ago',Math.floor(s/60)):fmt().dt(ts);};
  const sw=(name,on,dis,label)=>'<label class="pcsw"><input type="checkbox" role="switch" data-k="'+name+'"'+(on?' checked':'')+(dis?' disabled':'')+' aria-label="'+esc(label||name)+'"><i></i></label>';
  /* a switch is a whole tappable tile (like Card Settings): the hidden checkbox keeps the same data-k and change handling */
  const row=(label,name,on,note,dis,compact)=>'<label class="ptile'+(compact?' cp':'')+(on?' on':'')+(dis?' dis':'')+'"'+(compact&&note?' title="'+esc(T(note))+'"':'')+'><input type="checkbox" role="switch" data-k="'+name+'"'+(on?' checked':'')+(dis?' disabled':'')+' aria-label="'+esc(T(label))+'"><span class="ptx"><b>'+esc(T(label))+'</b>'+(note?'<small>'+esc(T(note))+'</small>':'')+'</span><i class="ptk" aria-hidden="true"></i></label>';
  const field=(label,control,note,value)=>'<label class="f"><span class="lab">'+esc(T(label))+(value!=null?'<b data-out>'+esc(value)+'</b>':'')+'</span>'+control+(note?'<span class="note">'+esc(T(note))+'</span>':'')+'</label>';
  const frac=(v,min,max)=>Math.min(1,Math.max(0,(v-min)/(max-min))).toFixed(4);
  const slider=(attr,min,max,step,val,unit,dis)=>'<div class="sl"><input type="range" '+attr+' min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'" data-unit="'+esc(T(unit))+'" style="--f:'+frac(val,min,max)+'"'+(dis?' disabled':'')+' aria-valuetext="'+esc(val+' '+T(unit))+'"></div>';
  const tempBar=(attr,val,dis)=>slider(attr,18,32,.5,val,'°C',dis),durBar=(attr,val,dis)=>slider(attr,1,15,1,val,'min',dis);
  const stepper=(attr,min,max,step,val,unit,dis)=>'<div class="stp"><button type="button" data-stp="-1" aria-label="'+esc(T('Less'))+'"'+(dis?' disabled':'')+'>−</button><output>'+val+' '+esc(T(unit))+'</output><button type="button" data-stp="1" aria-label="'+esc(T('More'))+'"'+(dis?' disabled':'')+'>+</button><input type="hidden" '+attr+' value="'+val+'" min="'+min+'" max="'+max+'" step="'+step+'" data-unit="'+esc(T(unit))+'"></div>';
  const box=(cls,icon,text)=>'<div class="info-box '+cls+'"><ha-icon icon="'+icon+'"></ha-icon><span>'+esc(T(text))+'</span></div>';
  const tempOpts=sel=>{let o='';for(let v=18;v<=32;v+=.5)o+='<option value="'+v+'"'+(Math.abs(v-sel)<.01?' selected':'')+'>'+v.toFixed(1)+' °C</option>';return o;};
  const durOpts=sel=>Array.from({length:15},(_,i)=>i+1).map(v=>'<option value="'+v+'"'+(v===sel?' selected':'')+'>'+v+' '+T('min')+'</option>').join('');
  const describe=s=>{const when=s.repeat==='once'?s.date:s.repeat==='daily'?T('Every day'):s.repeat==='weekdays'?T('Mon–Fri'):s.days.map(d=>T(DAYS[d])).join(' ');return when+' · '+(s.mode==='ready_by'?T('Ready by')+' ':T('Start')+' ')+s.time+' · '+s.duration+' '+T('min')+' · '+s.temperature+' °C';};

  async function load(){
    try{data=await request('precondition_get');error='';}
    catch(e){error=/Unknown.*operation/i.test(e?.message||'')?T('Restart Home Assistant to load preconditioning, then try again.'):(e?.message||T('Could not load preconditioning.'));}
    if(!dead)draw();schedule();
  }
  function schedule(){clearTimeout(timer);if(dead)return;const fast=data&&(BUSY.has(data.state.status)||data.state.status==='ACTIVE');timer=setTimeout(()=>{if(!document.hidden&&!busy&&!edit)load();else schedule();},fast?5000:30000);}
  async function save(patch,msg){
    if(busy)return;busy=true;draw();
    try{const keep=data?.recipients;data=await request('precondition_set',{value:patch});if(!data.recipients&&keep)data.recipients=keep;if(msg)notify(T(msg));return true;}
    catch(e){notify(e?.message||T('Could not save.'),true);return false;}
    finally{busy=false;if(!dead)draw();}
  }
  /* Remembering the last temperature and duration never blocks the screen: it is written quietly a moment after the last change, without redrawing anything. */
  async function flushDefaults(){
    const patch=queued;queued={};if(!Object.keys(patch).length||dead)return;
    try{const keep=data?.recipients;const r=await request('precondition_set',{value:patch});if(r&&r.config){data=r;if(!data.recipients&&keep)data.recipients=keep;}}
    catch(e){notify(e?.message||T('Could not save.'),true);}
  }
  async function command(op){
    if(busy)return;pending=op==='precondition_start'?'start':'stop';busy=true;draw();
    try{
      const r=await request(op,op==='precondition_start'?{temperature:ui.temperature??data.config.default_temperature,duration:ui.duration??data.config.default_duration}:{});
      if(r.accepted===false)notify(T(REASONS[r.reason]||r.reason),true);
      data={...data,...r,recipients:r.recipients||data.recipients};
    }catch(e){notify(e?.message||T('Command could not be sent.'),true);}
    finally{pending=null;busy=false;if(!dead){draw();schedule();}}
  }

  function summarySection(asItems){
    const c=data.config,n=c.notify,b=c.battery,names=(data.recipients||[]).filter(r=>n.devices.includes(r.svc)).map(r=>r.name);
    const H=(tpl,...vals)=>{let out=esc(T(tpl));vals.forEach((v,i)=>{out=out.split('{'+i+'}').join('<b class="v">'+esc(v)+'</b>');});return out.charAt(0).toUpperCase()+out.slice(1);};
    const mins=m=>m+' '+T(Number(m)===1?'minute':'minutes');
    const when=s=>s.repeat==='once'?T('on')+' '+new Date(s.date+'T12:00').toLocaleDateString(getHass()?.locale?.language||undefined,{weekday:'long',day:'numeric',month:'long'}):s.repeat==='daily'?T('every day'):s.repeat==='weekdays'?T('every weekday (Mon–Fri)'):T('every')+' '+s.days.map(d=>T(DAYS[d])).join(', ');
    const items=[],active=c.schedules.filter(s=>s.enabled);
    if(!c.scheduling_enabled||!active.length)items.push(esc(T('No automatic starts: the climate turns on only when you press Start.')));
    else for(const s of active){const [h,m]=s.time.split(':').map(Number),st=new Date(2000,0,1,h,m-(s.mode==='ready_by'?s.duration:0)),hm=st.toTimeString().slice(0,5);
      items.push(s.mode==='ready_by'?H('{0} the car will be ready at {1}: the climate turns on at {2}, set to {3} for {4}.',when(s),s.time,hm,s.temperature+' °C',mins(s.duration)):H('{0} at {1} the climate turns on, set to {2} for {3}.',when(s),s.time,s.temperature+' °C',mins(s.duration)));}
    items.push(H('Start uses {0} for {1}. The car turns remote climate off by itself within {2}.',c.default_temperature+' °C',mins(c.default_duration),mins(15)));
    items.push(esc(T('Car data is refreshed before and after every start and stop. If the climate is already on, nothing changes.')));
    items.push(esc(T('If someone drives during a session, Companion hands the climate to the driver and stops sending commands.')));
    items.push(H('If the car doesn’t confirm, Companion tries up to {0}, {1} apart, waiting {2} each time.',c.max_attempts+' '+T(c.max_attempts===1?'time':'times'),c.retry_delay+' '+T('s'),c.verify_timeout+' '+T('s')));
    items.push(b.enabled?H(b.auto_stop?'It won’t start at or below {0} (or if unknown) and turns the climate off at {0}.':'It will not start if the battery is {0} or lower or unknown.',b.min_soc+' %'):'<span class="off">'+esc(T('Battery protection is off'))+'</span>: '+esc(T('the climate can start at any battery level.')));
    items.push(n.enabled&&names.length?H('Notifications go to {0}.',names.join(', ')):'<span class="off">'+esc(T('No preconditioning notifications are sent.'))+'</span>');
    items.push(esc(T('Every action is logged in Notifications → Recent activity and the Home Assistant log.')));
    if(asItems)return '<ul>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul>';
    return '<section class="summary"><h4><ha-icon icon="mdi:text-box-check-outline"></ha-icon>'+esc(T('Your setup in short'))+'</h4><ul>'+items.map(i=>'<li>'+i+'</li>').join('')+'</ul></section>';
  }
  function statusSection(){
    const s=data.state,c=data.climate,[label,tone]=STATUS[s.status]||[s.status,'muted'],f=fmt(),on=c.on===true,owned=s.owner==='companion'&&s.session_start;
    const remaining=data.estimated_remaining;
    return '<section aria-live="polite"><div class="row"><h4><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path style="fill:currentColor;stroke:none" transform="translate(1 3.273) scale(0.03051)" fill-rule="evenodd" d="M46 548 L46 557 L48 562 L51 566 L61 571 L618 571 L627 567 L631 562 L633 557 L633 548 L630 542 L625 537 L617 534 L292 534 L291 535 L280 535 L279 534 L62 534 L54 537 L48 543 Z M506 0 L498 4 L492 12 L491 17 L491 65 L490 66 L470 55 L453 43 L442 39 L430 42 L425 47 L422 54 L423 65 L429 73 L478 104 L483 106 L491 112 L491 140 L492 141 L492 151 L491 152 L491 214 L489 215 L479 210 L474 206 L457 197 L389 156 L380 155 L371 159 L365 167 L364 177 L366 183 L372 190 L402 207 L410 213 L419 217 L447 235 L469 247 L470 249 L373 303 L367 309 L365 313 L364 323 L366 329 L373 336 L377 338 L388 338 L413 325 L452 302 L478 289 L489 282 L491 283 L491 366 L485 371 L470 379 L428 405 L424 410 L422 416 L422 424 L425 431 L429 435 L435 438 L446 438 L457 432 L465 426 L489 413 L490 414 L490 469 L491 473 L497 481 L503 484 L511 485 L520 481 L524 477 L527 471 L527 457 L528 456 L527 453 L527 434 L528 433 L528 415 L529 414 L544 422 L567 438 L574 441 L583 441 L589 438 L594 433 L597 423 L596 416 L594 412 L589 407 L540 376 L528 367 L528 283 L529 282 L538 286 L548 293 L559 298 L612 329 L616 383 L620 392 L623 395 L632 399 L641 398 L646 395 L652 387 L653 384 L652 362 L651 361 L651 351 L652 350 L697 375 L709 374 L713 372 L718 366 L720 362 L720 351 L718 347 L709 339 L686 327 L670 317 L672 315 L706 299 L711 294 L714 287 L714 280 L712 274 L708 269 L700 265 L691 265 L656 282 L654 282 L632 294 L628 294 L612 284 L601 279 L594 274 L566 259 L559 254 L552 251 L550 248 L629 205 L688 237 L699 238 L705 236 L709 233 L714 224 L714 216 L712 210 L705 203 L672 186 L670 183 L711 161 L716 156 L718 152 L719 142 L717 137 L712 131 L704 128 L698 128 L680 136 L655 150 L654 149 L654 143 L655 142 L658 117 L659 116 L658 105 L656 101 L649 95 L641 93 L635 94 L627 99 L622 109 L622 115 L620 122 L620 128 L619 129 L619 135 L618 136 L618 142 L617 143 L613 171 L610 174 L529 217 L528 216 L528 113 L538 105 L543 103 L592 72 L597 64 L598 55 L595 47 L590 42 L586 40 L578 39 L567 43 L529 67 L528 66 L528 14 L527 11 L520 3 L513 0 Z M243 0 L236 2 L228 10 L208 47 L199 61 L194 72 L181 93 L177 101 L176 111 L179 118 L183 122 L189 125 L222 125 L224 127 L225 146 L230 168 L236 183 L258 224 L264 241 L266 251 L266 265 L262 284 L254 301 L230 337 L218 359 L213 371 L208 394 L208 421 L212 440 L218 456 L229 476 L238 487 L247 491 L256 491 L265 487 L271 480 L273 475 L273 463 L271 458 L262 445 L254 426 L252 417 L253 395 L256 384 L263 368 L289 327 L299 307 L306 287 L307 277 L308 276 L308 268 L309 267 L308 242 L303 220 L297 205 L288 187 L283 180 L273 159 L268 144 L267 127 L269 125 L302 125 L305 124 L313 117 L315 111 L315 104 L310 93 L294 67 L290 58 L285 51 L262 9 L256 3 L252 1 Z M67 0 L56 5 L51 12 L46 23 L42 28 L20 69 L7 90 L1 102 L1 107 L0 108 L2 116 L10 124 L13 125 L46 125 L49 127 L50 144 L55 165 L64 186 L84 221 L90 237 L92 247 L92 266 L87 285 L74 309 L57 332 L47 348 L39 364 L32 391 L32 417 L33 418 L34 428 L37 439 L47 461 L56 475 L65 486 L75 491 L85 491 L93 487 L98 482 L101 475 L101 462 L98 456 L84 437 L78 423 L76 415 L76 393 L80 381 L88 365 L113 329 L126 305 L134 280 L135 264 L136 263 L135 241 L130 219 L114 185 L99 159 L93 141 L92 127 L96 125 L127 125 L131 123 L138 115 L139 103 L86 8 L81 3 L77 1 Z"/></svg>'+esc(T('Preconditioning'))+'</h4><span class="chip '+tone+'">'+esc(T(label))+'</span></div>'+
      '<div class="grid">'+
      '<div class="kv"><small>'+esc(T('Climate'))+'</small><b>'+esc(c.on===null?T('Unknown'):on?T('On'):T('Off'))+'</b></div>'+
      '<div class="kv"><small>'+esc(T('Cabin'))+'</small><b>'+(c.current==null?'—':esc(Number(c.current).toFixed(1))+' °C')+'</b></div>'+
      '<div class="kv"><small>'+esc(T('Target'))+'</small><b>'+(c.target==null?'—':esc(c.target)+' °C')+'</b></div>'+
      '<div class="kv"><small>'+esc(T('Last vehicle report'))+'</small><b>'+esc(ago(c.report))+'</b></div>'+
      (owned?'<div class="kv"><small>'+esc(T('Session start (estimated)'))+'</small><b>'+esc(f.hm(s.session_start))+'</b></div>'+
      '<div class="kv"><small>'+esc(T('Remaining (estimated)'))+'</small><b>'+(remaining==null?'—':Math.ceil(remaining/60)+' '+T('min'))+'</b></div>'+
      '<div class="kv"><small>'+esc(T('Automatic shutdown by (estimated)'))+'</small><b>'+esc(f.hm(s.deadline))+'</b></div>'+
      (s.stop_at?'<div class="kv"><small>'+esc(T('Requested stop'))+'</small><b>'+esc(f.hm(s.stop_at))+'</b></div>':''):'')+
      '</div>'+(s.status==='FAILED'||s.status==='UNKNOWN'?box(s.status==='FAILED'?'bad':'warn','mdi:alert-outline',s.last_error||''):'')+
      (on&&!owned?box('info','mdi:information-outline','Climate was started outside Companion (Deepal app or in the car), so Companion won’t stop it.'):'')+
      box('info','mdi:timer-outline','The car turns remote A/C off by itself within 15 minutes. Times shown are estimates.')+'</section>';
  }
  function batteryIndicator(compact){
    const b=data.battery,o=data.config.battery;if(!o.enabled)return compact?'':box('muted','mdi:battery-outline','Battery protection is off.');
    const low=b.blocked==='battery_low'&&b.fresh,age=b.report?Math.round((Date.now()/1000-b.report)/60):null;
    const tone=low?'bad':b.fresh?'ok':'warn',text=low?T('START blocked')+': '+T(REASONS.battery_low):b.fresh?T('Battery protection on')+' · '+T('minimum')+' '+o.min_soc+' %':T('Last battery reading is {0} min old. It is refreshed and checked before every start.',age==null?'?':age);
    return '<div class="row"><span class="chip '+tone+'"><ha-icon icon="mdi:battery-heart-variant"></ha-icon>'+(b.soc==null?'—':b.soc+' %')+'</span><span class="note">'+esc(text)+'</span></div>';
  }
  function controlSection(){
    const s=data.state,cfg=data.config,running=BUSY.has(s.status),active=s.status==='ACTIVE'||data.climate.on===true;
    const tval=ui.temperature??cfg.default_temperature,dval=ui.duration??cfg.default_duration,blocked=data.battery.blocked==='battery_low'&&data.battery.fresh;
    return '<section><h4><ha-icon icon="mdi:gesture-tap"></ha-icon>'+esc(T('Manual control'))+'</h4><div class="two">'+
      field('Temperature',tempBar('data-ui="temperature"',tval),'Cabin temperature sent with Start. Remembered for next time and new schedules.',tval.toFixed(1)+' °C')+
      field('Duration',durBar('data-ui="duration"',dval),'Companion stops it after this time; the car stops by itself within 15 minutes. Remembered for next time.',dval+' '+T('min'))+'</div>'+batteryIndicator(true)+
      '<div class="actions"><button class="go" data-cmd="precondition_start"'+(busy||running||blocked||!admin?' disabled':'')+'><ha-icon icon="mdi:play"></ha-icon>'+esc(T('Start preconditioning'))+'</button>'+
      '<button class="stop" data-cmd="precondition_stop"'+(busy||(!active&&!running)||s.status.startsWith('STOP')||!admin?' disabled':'')+'><ha-icon icon="mdi:stop"></ha-icon>'+esc(T('Stop preconditioning'))+'</button></div></section>';
  }

  /* Compact popup (the vehicle card sheet): header, live strip, manual control, one action, schedules and notifications rows. */
  const toneOf=v=>v<=19?'cool':v<=22.5?'comfort':'warm';
  function quickView(){
    const s=data.state,cfg=data.config,c=data.climate,b=data.battery,n=cfg.notify,f=fmt();
    const starting=['START_REQUESTED','STARTING','VERIFYING_START','RETRYING_START'].includes(s.status)||pending==='start';
    const stopping=(BUSY.has(s.status)&&!starting)||pending==='stop';
    const active=s.status==='ACTIVE'||c.on===true,owned=s.owner==='companion'&&s.session_start,blocked=b.blocked==='battery_low'&&b.fresh;
    const tval=ui.temperature??cfg.default_temperature,dval=ui.duration??cfg.default_duration;
    const [label,tone]=STATUS[s.status]||[s.status,'muted'];
    const chip=s.status==='IDLE'&&!active?['Stopped','muted']:s.status==='IDLE'?['Active','ok']:[label,tone];
    const est=data.estimated_remaining,ends=owned?[s.deadline,s.stop_at].filter(Boolean):[];
    clock=owned&&est!=null?{rem:est,at:Date.now(),total:Math.max(1,ends.length?Math.min(...ends)-s.session_start:est)}:null;
    const ico=(name,cls='')=>'<ha-icon icon="mdi:'+name+'"></ha-icon>';
    const hero='<section class="q-hero"><div class="q-top"><span class="chip '+chip[1]+'">'+esc(T(chip[0]))+'</span><span class="q-rep">'+esc(T('Report'))+': '+esc(f.hm(c.report))+
      '<button type="button" class="q-icon" data-act="info" aria-label="'+esc(T('Auto shutoff information'))+'" aria-expanded="'+infoOpen+'">'+ico('information-outline')+'</button>'+
      (infoOpen?'<span class="q-tip" role="note">'+esc(T('The car turns remote A/C off by itself within 15 minutes. Times shown are estimates.'))+'</span>':'')+'</span></div>'+
      '<div class="q-tele"><div><small>'+esc(T('Cabin'))+'</small><b>'+(c.current==null?'—':esc(Number(c.current).toFixed(1))+' °C')+'</b><em>'+esc(T('Interior'))+'</em></div>'+
      '<div><small>'+esc(T('Target'))+'</small><b>'+(c.target==null?'—':esc(c.target)+' °C')+'</b><em>'+esc(T(active?'Active target':'Last sent'))+'</em></div>'+
      '<div><small>'+esc(T('Battery'))+'<button type="button" class="q-icon'+(reloading?' spin':'')+'" data-act="reload" aria-label="'+esc(T('Refresh vehicle data'))+'" title="'+esc(T('Refresh vehicle data'))+'"'+(reloading?' aria-busy="true"':'')+'>'+ico('refresh')+'</button></small><b>'+(b.soc==null?'—':esc(b.soc)+'%')+'</b><em>'+esc(ago(b.report))+'</em></div></div></section>';
    const preset=(k,v,text)=>'<button type="button" data-qset="'+k+':'+v+'" aria-pressed="'+(Math.abs((k==='temperature'?tval:dval)-v)<.05)+'">'+esc(text)+'</button>';
    const manual='<section>'+
      '<div class="f q-temp" data-tone="'+toneOf(tval)+'"><div class="q-trow"><div><small>'+esc(T('Target temperature'))+'</small><b class="q-big" data-out>'+tval.toFixed(1)+' °C</b></div>'+
      '</div>'+
      tempBar('data-ui="temperature"',tval)+
      '<div class="q-chips">'+preset('temperature',18,T('Cool')+' 18°')+preset('temperature',21,T('Comfort')+' 21°')+preset('temperature',24,T('Warm')+' 24°')+'</div></div><hr>'+
      '<div class="f"><div class="q-dur"><div><span>'+esc(T('Duration'))+'</span><span class="q-tag">'+esc(T('Car turns it off after 15 min'))+'</span></div><b data-out>'+dval+' '+esc(T('min'))+'</b></div>'+
      '<div class="q-segd" role="group" aria-label="'+esc(T('Duration'))+'">'+[5,10,15].map(v=>preset('duration',v,v+' '+T('min'))).join('')+'</div>'+durBar('data-ui="duration"',dval)+'</div>'+
      (starting||stopping?'<div class="q-wait" role="status"><span class="q-spin"></span>'+esc(T(starting?'Starting':'Stopping'))+'…</div>'
        :active?'<div class="q-live"><span class="q-fill" data-fill style="width:100%"></span><span class="q-now"><span class="q-dot"></span><b data-clock>'+(clock?'--:--':esc(T('On')))+'</b>'+(clock?'<small>'+esc(T('remaining'))+'</small>':'')+'</span>'+
          '<button class="stop" type="button" data-cmd="precondition_stop"'+(busy||!admin?' disabled':'')+'>'+ico('stop')+esc(T('Stop'))+'</button></div>'
        :'<button class="go q-go" type="button" data-cmd="precondition_start"'+(busy||blocked||!admin?' disabled':'')+'>'+ico('play')+esc(T('Start preconditioning'))+'</button>')+
      (blocked||(cfg.battery.enabled&&!b.fresh)?batteryIndicator(true):'')+'</section>';
    const up=data.upcoming.filter(u=>u.next_start).sort((a,b2)=>a.next_start-b2.next_start)[0],onScheds=cfg.schedules.filter(x=>x.enabled);
    const sub=!cfg.scheduling_enabled?T('Scheduled preconditioning is off.'):up?T('Next start')+': '+f.dt(up.next_start):T('No upcoming run.');
    const badge=cfg.scheduling_enabled&&onScheds.length?['Active schedules',true]:cfg.schedules.length?['Off',false]:['+ Add',false];
    const sched='<section class="q-flush"><button type="button" class="q-rowbtn" data-act="sched-toggle" aria-expanded="'+schedOpen+'"><span class="q-rowl"><span class="q-ico">'+ico('calendar-clock')+'</span><span><b>'+esc(T('Schedules'))+'</b><small>'+esc(sub)+'</small></span></span>'+
      '<span class="q-rowr"><span class="q-badge2'+(badge[1]?' on':'')+'">'+esc(badge[0]==='+ Add'?'+ '+T('Add'):badge[0]==='Active schedules'?(T(badge[0])===badge[0]?'Active':T(badge[0])):T(badge[0]))+'</span><span class="q-chev" data-open="'+schedOpen+'">'+ico('chevron-right')+'</span></span></button>'+
      (schedOpen?'<div class="q-drawer">'+(!cfg.scheduling_enabled?'<p class="note">'+esc(T('Scheduled preconditioning is turned off.'))+'</p>':'')+
        (cfg.schedules.length?cfg.schedules.map(x=>'<div class="row"><span><b>'+esc(x.name||T('Schedule'))+'</b><br><small class="note">'+esc(describe(x))+'</small></span>'+(admin?sw('sched:'+x.id,x.enabled,busy,T('Enabled')+' · '+(x.name||describe(x))):'')+'</div>').join(''):'<p class="note">'+esc(T('No schedules yet.'))+'</p>')+
        (onMore&&admin?'<button type="button" data-act="more">'+ico('plus')+esc(T('Create schedule'))+'</button>':'')+'</div>':'')+'</section>';
    const notif='<section class="q-row2">'+(onMore&&admin?'<button type="button" class="q-rowl q-linkrow" data-act="more" data-to="notifications" aria-label="'+esc(T('Open notification settings'))+'">':'<span class="q-rowl">')+'<span class="q-ico">'+ico('bell-outline')+'</span><span><b>'+esc(T('Preconditioning notifications'))+'</b><small>'+esc(T('Alerts when preconditioning starts or stops'))+'</small></span>'+(onMore&&admin?'</button>':'</span>')+sw('notify.enabled',n.enabled,busy||!admin,T('Preconditioning notifications'))+'</section>';
    return hero+manual+sched+notif;
  }
  function syncQuick(kind,v){
    root.querySelectorAll('[data-qset^="'+kind+':"]').forEach(b=>{const on=String(Math.abs(Number(b.dataset.qset.split(':')[1])-v)<.05);if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on);});
    const box=kind==='temperature'?root.querySelector('.q-temp'):null,tone=toneOf(v);
    if(box&&box.getAttribute('data-tone')!==tone)box.setAttribute('data-tone',tone);
  }
  function setQuick(kind,v){
    const sl=root.querySelector('[data-ui="'+kind+'"]');if(!sl)return;
    v=Math.min(Number(sl.max),Math.max(Number(sl.min),Math.round(v*2)/2));if(kind==='duration')v=Math.round(v);
    sl.value=v;sl.dispatchEvent(new Event('input'));sl.dispatchEvent(new Event('change'));
  }
  function tickClock(){
    if(dead||!clock)return;
    const el=root.querySelector('[data-clock]');if(!el)return;
    const left=Math.max(0,clock.rem-(Date.now()-clock.at)/1000),m=Math.floor(left/60),sec=Math.floor(left%60);
    el.textContent=String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
    const fill=root.querySelector('[data-fill]');if(fill)fill.style.width=Math.min(100,left/clock.total*100)+'%';
  }
  const clockTimer=setInterval(tickClock,1000);
  const seg=(k,opts,val)=>'<div class="seg" role="group">'+opts.map(([v,l])=>'<button type="button" data-seg="'+k+'" data-v="'+v+'" aria-pressed="'+(v===val)+'">'+esc(T(l))+'</button>').join('')+'</div><input type="hidden" data-e="'+k+'" value="'+esc(val)+'">';
  function editorHtml(){
    const e=edit;return '<div class="editor" data-editor><div class="two">'+
      field('Name','<input data-e="name" maxlength="60" value="'+esc(e.name)+'">','Optional label shown in the list.')+
      field('Repeat',seg('repeat',[['once','Once'],['daily','Daily'],['weekdays','Mon–Fri'],['custom','Custom']],e.repeat),'Once: runs one time, then turns itself off.')+
      (e.repeat==='custom'?'<div class="days" role="group" aria-label="'+esc(T('Days'))+'">'+DAYS.map((d,i)=>'<label><input type="checkbox" data-day="'+i+'"'+(e.days.includes(i)?' checked':'')+'><span>'+esc(T(d))+'</span></label>').join('')+'</div>':'')+
      field('Mode',seg('mode',[['start','Start at'],['ready_by','Ready by']],e.mode),e.mode==='ready_by'?'The climate starts earlier by the preparation time, so the cabin is ready on time.':'The climate starts exactly at the time you choose.')+
      (e.repeat==='once'?field('Date','<input type="date" data-e="date" value="'+esc(e.date)+'">','The day of the one-time run.'):'')+
      field(e.mode==='ready_by'?'Ready time':'Start time','<input type="time" data-e="time" value="'+esc(e.time)+'">',e.mode==='ready_by'?'When you want to leave.':'When the climate starts. Home Assistant time zone.')+
      field(e.mode==='ready_by'?'Preparation time':'Duration',durBar('data-e="duration"',e.duration),'The car limits remote climate to 15 minutes.',e.duration+' '+T('min'))+
      field('Temperature',tempBar('data-e="temperature"',e.temperature),'Cabin temperature for this schedule.',Number(e.temperature).toFixed(1)+' °C')+'</div>'+
      (e.mode==='ready_by'?'<p class="note">'+esc(T('Starts the preparation time before the ready time. The cabin may not reach the target by then.'))+'</p>':'')+
      '<div class="actions"><button data-act="cancel">'+esc(T('Cancel'))+'</button><button class="go" data-act="save-sched"'+(busy?' disabled':'')+'>'+esc(T('Save schedule'))+'</button>'+(e.id&&admin?'<button class="stop" data-act="del" data-id="'+esc(e.id)+'">'+esc(T('Delete schedule'))+'</button>':'')+'</div></div>';
  }
  function schedulesSection(full,parts){
    const cfg=data.config,f=fmt(),up=Object.fromEntries(data.upcoming.map(u=>[u.id,u]));
    const next=data.upcoming.filter(u=>u.next_start).sort((a,b)=>a.next_start-b.next_start)[0];
    const list=cfg.schedules.map(s=>{const u=up[s.id]||{},last=u.last;return '<div class="sched"><div><b>'+esc(s.name||T('Schedule'))+'</b><small>'+esc(describe(s))+'</small><br><small>'+
      (u.next_start?esc(T('Next'))+' '+esc(f.dt(u.next_start))+' → '+esc(f.hm(u.next_stop)):esc(T('No upcoming run')))+(last?' · '+esc(T('Last'))+': '+esc(T(last.kind.replace(/_/g,' ')))+(last.reason?' ('+esc(T(REASONS[last.reason]||last.reason))+')':''):'')+'</small></div>'+
      (admin?sw('sched:'+s.id,s.enabled,busy,T('Enabled')+' · '+(s.name||describe(s)))+'<button data-edit="'+esc(s.id)+'" aria-label="'+esc(T('Edit'))+'"><ha-icon icon="mdi:pencil"></ha-icon></button>':'')+'</div>'+
      '';}).join('');
    const btn=admin&&!edit?'<button data-act="new"><ha-icon icon="mdi:plus"></ha-icon>'+esc(T('Create schedule'))+'</button>':'';
    const body=(!cfg.scheduling_enabled?box('warn','mdi:pause-circle-outline','Scheduled preconditioning is turned off.'):next?'<p class="note">'+esc(T('Next start'))+': <b>'+esc(f.dt(next.next_start))+'</b> · '+esc(T('requested stop'))+' '+esc(f.hm(next.next_stop))+'</p>':'')+
      (edit?editorHtml():'')+
      (list||'<p class="note">'+esc(T('No schedules yet.'))+'</p>');
    if(parts)return {btn,body};
    return '<section><div class="row"><h4><ha-icon icon="mdi:calendar-clock"></ha-icon>'+esc(T('Schedules'))+'</h4>'+btn+'</div>'+body+'</section>';
  }
  function quickSchedule(){
    const f=fmt(),next=data.upcoming.filter(u=>u.next_start).sort((a,b)=>a.next_start-b.next_start)[0];
    return '<section><h4><ha-icon icon="mdi:calendar-clock"></ha-icon>'+esc(T('Schedules'))+'</h4>'+(!data.config.scheduling_enabled?'<p class="note">'+esc(T('Scheduled preconditioning is off.'))+'</p>':next?'<p class="note">'+esc(T('Next start'))+': <b>'+esc(f.dt(next.next_start))+'</b></p>':'<p class="note">'+esc(T('No upcoming run.'))+'</p>')+'</section>';
  }
  function notifySection(full){
    const n=data.config.notify,recips=data.recipients||[],dis=busy||!admin;
    const pills=recips.length?'<div class="pills" role="group" aria-label="'+esc(T('Phones'))+'">'+recips.map(r=>{const on=n.devices.includes(r.svc);return '<button type="button" class="pill" data-dev="'+esc(r.svc)+'" aria-pressed="'+on+'"'+(dis?' disabled':'')+'><ha-icon icon="mdi:'+(on?'cellphone-check':'cellphone')+'"></ha-icon>'+esc(r.name)+'</button>';}).join('')+'</div>':'<p class="note">'+esc(T('No Mobile App phones found.'))+'</p>';
    const gOff=mode==='notifications'&&masterOn!==null?masterOn===false:data.global_notifications===false;
    const testBtn='<button data-act="test-notify"'+(dis||!n.enabled||!n.devices.length?' disabled':'')+'><ha-icon icon="mdi:send-outline"></ha-icon>'+esc(T('Send test notification'))+'</button>';
    return '<section data-pc="notifications">'+(full?'<div class="row"><h4><ha-icon icon="mdi:bell-outline"></ha-icon>'+esc(T('Preconditioning notifications'))+'</h4>'+testBtn+'</div>'+(testResult?'<p class="note">'+esc(testResult)+'</p>':''):'<h4><ha-icon icon="mdi:bell-outline"></ha-icon>'+esc(T('Preconditioning notifications'))+'</h4>')+(gOff?box('warn','mdi:bell-off-outline','Notifications are off. Turn them on in Notifications to get preconditioning messages.'):'')+(gOff?'<div class="subgrp off" inert>':'')+
      row('Preconditioning notifications','notify.enabled',n.enabled,'Phone messages about preconditioning. Same switch as on the card and in Notifications.',dis)+
      (full?'<div class="subgrp'+(n.enabled||gOff?'':' off')+'"'+(n.enabled||gOff?'':' inert')+'><div class="f">'+esc(T('Phones'))+pills+'<span class="note">'+esc(T('Shared with Live climate: changing phones here also changes them there.'))+'</span></div>'+
        (n.enabled&&!n.devices.length?box('warn','mdi:cellphone-off','Choose at least one phone.'):'')+
        '<div class="ptsub">'+esc(T('Send a message when'))+'</div><div class="ptgrid ev">'+EVENT_LABELS.map(([k,l,note])=>row(l,'event:'+k,n.events[k],note,dis||!n.enabled,true)).join('')+'</div>'+
        box('info','mdi:fan','The lock-screen status comes from Live climate (Notifications → Live climate). Preconditioning only adds these result messages.')+
        '<p class="note">'+esc(T('Verification, battery protection and the log keep running when these are off. The main Notifications switch and phone permissions still apply.'))+'</p></div>':'')+(gOff?'</div>':'')+'</section>';
  }
  function pageGeneral(){
    const c=data.config,dis=busy||!admin,sc=schedulesSection(true,true);
    return '<section data-pc="schedules"><div class="row"><h4><ha-icon icon="mdi:tune-variant"></ha-icon>'+esc(T('General'))+' & '+esc(T('Schedules'))+'</h4>'+sc.btn+'</div>'+
      row('Scheduled preconditioning','scheduling_enabled',c.scheduling_enabled,'Main switch for all schedules. Off by default; manual Start still works.',dis)+sc.body+
      '<details class="adv"><summary><ha-icon icon="mdi:cog-outline"></ha-icon>'+esc(T('Advanced: retries and checks'))+'</summary><div class="two">'+
      field('Attempts',stepper('data-cfg="max_attempts"',1,3,1,c.max_attempts,'×',dis),'How many times a start or stop is sent in total. The car is checked before each retry.')+
      field('Wait between attempts',stepper('data-cfg="retry_delay"',10,120,10,c.retry_delay,'s',dis),'Pause before trying again, to respect the Deepal limit.')+
      field('Wait for the car to answer',stepper('data-cfg="verify_timeout"',30,180,15,c.verify_timeout,'s',dis),'If the car doesn’t report the change in this time, the attempt is not confirmed.')+'</div></details></section>';
  }
  /* Dashboard page header: title, state, the setup summary and one Start/Stop button, then the live values in one strip. */
  function pageHero(){
    const s=data.state,cfg=data.config,c=data.climate,b=data.battery,f=fmt(),dis=busy||!admin;
    const starting=['START_REQUESTED','STARTING','VERIFYING_START','RETRYING_START'].includes(s.status)||pending==='start',stopping=(BUSY.has(s.status)&&!starting)||pending==='stop';
    const on=c.on===true,active=s.status==='ACTIVE'||on,owned=s.owner==='companion'&&s.session_start,blocked=b.blocked==='battery_low'&&b.fresh;
    const [label,tone]=STATUS[s.status]||[s.status,'muted'],chip=s.status==='IDLE'&&!active?['Stopped','muted']:s.status==='IDLE'?['Active','ok']:[label,tone];
    const act=active||stopping?'<button class="stop" type="button" data-cmd="precondition_stop"'+(dis||stopping||!active&&!BUSY.has(s.status)?' disabled':'')+'><ha-icon icon="mdi:stop"></ha-icon>'+esc(T('Stop preconditioning'))+'</button>'
      :'<button class="go" type="button" data-cmd="precondition_start"'+(dis||starting||blocked?' disabled':'')+'><ha-icon icon="mdi:play"></ha-icon>'+esc(T('Start'))+' ('+esc(cfg.default_temperature)+' °C / '+esc(cfg.default_duration)+' '+esc(T('min'))+')</button>';
    const kv=(l,v,cls,sub)=>'<div class="kv'+(cls?' '+cls:'')+'"><small>'+esc(T(l))+'</small><b>'+v+'</b>'+(sub?'<em>'+esc(sub)+'</em>':'')+'</div>',remaining=data.estimated_remaining;
    const strip=kv('Climate',esc(c.on===null?T('Unknown'):on?T('On'):T('Off')))+kv('Cabin',c.current==null?'—':esc(Number(c.current).toFixed(1))+' °C')+kv('Target',c.target==null?'—':esc(c.target)+' °C')+
      kv('Battery',b.soc==null?'—':esc(b.soc)+' %','',T('Charging')+': '+(b.charging?T('Yes'):T('No')))+kv('Status',esc(blocked?T('START blocked'):T('Ready')),blocked?'warn':'')+kv('Last vehicle report',esc(ago(c.report)))+
      (owned?kv('Session start (estimated)',esc(f.hm(s.session_start)))+kv('Remaining (estimated)',remaining==null?'—':Math.ceil(remaining/60)+' '+esc(T('min')))+kv('Automatic shutdown by (estimated)',esc(f.hm(s.deadline)))+(s.stop_at?kv('Requested stop',esc(f.hm(s.stop_at))):''):'');
    return '<section class="pg-hero" aria-live="polite"><div class="row pg-head"><h4><ha-icon icon="mdi:air-conditioner"></ha-icon>'+esc(T('Preconditioning'))+'</h4><span class="chip '+chip[1]+'">'+esc(T(chip[0]))+'</span>'+
      '<div class="pg-act"><button type="button" data-act="summary-toggle" aria-expanded="'+summaryOpen+'"><ha-icon icon="mdi:text-box-check-outline"></ha-icon>'+esc(T('Your setup in short'))+'<ha-icon icon="mdi:chevron-'+(summaryOpen?'up':'down')+'"></ha-icon></button>'+act+'</div></div>'+
      '<p class="note">'+esc(T('The car turns remote A/C off by itself within 15 minutes. Times shown are estimates.'))+'</p>'+
      (summaryOpen?'<div class="pg-sum">'+summarySection(true)+'</div>':'')+'<div class="grid pg-strip">'+strip+'</div>'+
      (s.status==='FAILED'||s.status==='UNKNOWN'?box(s.status==='FAILED'?'bad':'warn','mdi:alert-outline',s.last_error||''):'')+
      (on&&!owned?box('info','mdi:information-outline','Climate was started outside Companion (Deepal app or in the car), so Companion won’t stop it.'):'')+'</section>';
  }
  const pageView=()=>pageHero()+'<div class="pg-cols"><div class="pg-col">'+pageGeneral()+batterySection()+'</div><div class="pg-col">'+notifySection(true)+diagnosticsSection()+'</div></div>';
  function batterySection(){
    const o=data.config.battery,b=data.battery,dis=busy||!admin,levels=[10,15,20,25,30,35,40,45,50];
    return '<section><h4><ha-icon icon="mdi:battery-heart-variant"></ha-icon>'+esc(T('Battery protection'))+'</h4>'+
      row('Battery protection','bat.enabled',o.enabled,'Uses the traction battery level, not fuel or the 12 V battery.',dis)+
      field('Minimum battery',slider('data-bat="min_soc"',10,50,5,o.min_soc,'%',dis),'Your own limit, not a manufacturer value. At or below it, the rules below apply.',o.min_soc+' %')+
      '<div class="ptgrid">'+row('Block START at or below the minimum','bat.block_start',o.block_start,'Also blocks START when the battery level is unavailable or not current.',dis||!o.enabled)+
      row('Request STOP at the minimum','bat.auto_stop',o.auto_stop,'Uses the same verified STOP. It may act a little late if reports are delayed.',dis||!o.enabled)+
      row('Apply while charging','bat.while_charging',o.while_charging,'Recommended on. Off lets a plugged-in, charging car run below the minimum.',dis||!o.enabled)+
      row('Battery protection notifications','event:battery',data.config.notify.events.battery,'Same switch as Notifications → Preconditioning.',dis)+'</div>'+
      (o.enabled&&!b.fresh?box('info','mdi:clock-outline','The car is probably asleep, so this reading is old. Companion asks for fresh data before every start and blocks it only if the car does not answer.'):'')+'</section>';
  }
  function diagnosticsSection(){
    const s=data.state,f=fmt(),c=data.climate;
    const item=(l,v)=>'<div class="kv"><small>'+esc(T(l))+'</small><b>'+esc(v)+'</b></div>';
    return '<section><details data-diag'+(diagOpen?' open':'')+'><summary>'+esc(T('Diagnostics'))+'</summary><div class="grid">'+
      item('Current operation',(s.op_kind||'—')+' · '+(STATUS[s.status]?.[0]||s.status))+item('Operation ID',s.op_id||'—')+item('Session ID',s.session_id||'—')+
      item('Last successful START',f.dt(s.last_start_ok))+item('Last successful STOP',f.dt(s.last_stop_ok))+
      item('Last failure',s.last_failure?f.dt(s.last_failure.time)+' · '+s.last_failure.error:'—')+
      item('Last confirmed state',s.confirmed||'—')+item('Last vehicle report',f.dt(c.report))+item('Tries last time',String(s.last_retries??0))+
      '</div><div class="row" style="margin-top:10px"><h4>'+esc(T('Session history'))+'</h4>'+(admin&&data.history.length?'<button data-act="clear-hist"'+(busy?' disabled':'')+'><ha-icon icon="mdi:delete-sweep-outline"></ha-icon>'+esc(T('Clear history'))+'</button>':'')+'</div>'+'<p class="note">'+esc(T('Entries older than 30 days are removed automatically.'))+'</p><div class="hist">'+
      (data.history.map(h=>'<div><span>'+esc(T(h.kind.replace(/_/g,' ')))+(h.reason?' · '+esc(T(REASONS[h.reason]||h.reason)):'')+(h.error?' · <span class="err">'+esc(h.error)+'</span>':'')+'</span><span>'+esc(f.dt(h.time))+'</span></div>').join('')||'<p class="note">'+esc(T('No activity yet.'))+'</p>')+
      '</div></details></section>';
  }
  function askConfirm(title,text,label){
    return new Promise(resolve=>{
      const d=document.createElement('dialog');d.className='pc-confirm';
      d.innerHTML='<style>.pc-confirm{box-sizing:border-box;width:min(420px,calc(100vw - 24px));margin:auto;padding:18px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:20px;color:var(--ds-fg,var(--primary-text-color,#eee));background:var(--ds-card,var(--card-background-color,#222));font-family:inherit}.pc-confirm::backdrop{background:rgba(0,0,0,.55)}.pc-confirm h2{margin:0 0 8px;font-size:16px;font-weight:600}.pc-confirm p{margin:0 0 16px;font-size:13px;line-height:1.5;color:var(--ds-muted,var(--secondary-text-color,#aaa))}.pc-confirm .acts{display:flex;gap:10px;justify-content:flex-end}.pc-confirm button{min-height:44px;padding:0 18px;border-radius:12px;border:1px solid var(--ds-line,var(--divider-color,#444));background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}.pc-confirm [data-yes]{background:rgba(var(--ds-danger,239,83,80),.18);border-color:rgba(var(--ds-danger,239,83,80),.55)}</style><h2></h2><p></p><div class="acts"><button type="button" data-no></button><button type="button" data-yes></button></div>';
      d.querySelector('h2').textContent=title;d.querySelector('p').textContent=text;
      d.querySelector('[data-no]').textContent=T('Cancel');d.querySelector('[data-yes]').textContent=label;
      const done=v=>{d.remove();resolve(v);};
      d.querySelector('[data-no]').onclick=()=>done(false);d.querySelector('[data-yes]').onclick=()=>done(true);
      d.addEventListener('cancel',e=>{e.preventDefault();done(false);});
      host.append(d);d.showModal();d.querySelector('[data-no]').focus();
    });
  }
  let diagOpen=false;
  let masterOn=mode==='notifications'&&typeof window.__DEEPAL_MASTER_ON==='boolean'?window.__DEEPAL_MASTER_ON:null;const onMaster=e=>{masterOn=!!e.detail.on;if(!dead)draw();};if(mode==='notifications')window.addEventListener('deepal-companion-master',onMaster);
  let lastHtml='',touching=false;
  host.addEventListener('pointerdown',e=>{touching=!!e.target.closest?.('input[type=range]');},true);host.addEventListener('pointerup',()=>{setTimeout(()=>{touching=false;},400);},true);host.addEventListener('pointercancel',()=>{setTimeout(()=>{touching=false;},400);},true);
  function scrollParent(){
    let el=host;
    while(el){
      const cs=el instanceof Element?getComputedStyle(el):null;
      if(cs&&/(auto|scroll)/.test(cs.overflowY)&&el.scrollHeight>el.clientHeight+1)return el;
      el=el.parentElement||(el.getRootNode&&el.getRootNode().host)||null;
    }
    return document.scrollingElement;
  }
  let settleUntil=0,settleTimer=0;
  function draw(){
    if(dead)return;
    if(error&&!data){root.innerHTML='<p class="note err" role="alert">'+esc(error)+'</p><button data-act="retry">'+esc(T('Try again'))+'</button>';bind();return;}
    if(!data)return;
    const focused=(root.getRootNode().activeElement)||null,keepFocus=focused&&root.contains(focused)?focused.dataset:null;
    const html=mode==='quick'?quickView()
      :mode==='card'?summarySection()+statusSection()+controlSection()+schedulesSection(false)+notifySection(false)
      :mode==='notifications'?notifySection(true)
      :pageView();
    if(html===lastHtml)return;  // nothing changed: keep the page exactly as it is
    if(touching&&!busy&&lastHtml){setTimeout(draw,500);return;}
    if(settleUntil>Date.now()&&lastHtml){setTimeout(draw,settleUntil-Date.now()+30);return;}  // let a toggled tile finish its animation on the same element
    lastHtml=html;
    const keepHeight=root.offsetHeight;root.style.minHeight=keepHeight+'px';  // no collapse, so the page cannot jump
    const sp=scrollParent(),top=sp?sp.scrollTop:0;
    root.innerHTML=html;
    if(sp)sp.scrollTop=top;  // iPhone Safari may scroll when the focused control is replaced: put it back
    requestAnimationFrame(()=>{root.style.minHeight='';if(sp&&Math.abs(sp.scrollTop-top)>1)sp.scrollTop=top;});
    bind();tickClock();
    if(scrollTo&&!scrolled){const t=root.querySelector('[data-pc="'+scrollTo+'"]');if(t){scrolled=true;setTimeout(()=>{if(!dead)t.scrollIntoView({block:'start',behavior:'smooth'});},150);}}
    if(keepFocus){const k=Object.entries(keepFocus)[0];if(k)[...root.querySelectorAll('*')].find(n=>n.dataset&&n.dataset[k[0]]===k[1])?.focus?.({preventScroll:true});}
  }
  function readEditor(){
    const q=k=>root.querySelector('[data-e="'+k+'"]');
    for(const k of ['name','repeat','mode','date','time'])if(q(k))edit[k]=q(k).value;
    if(q('duration'))edit.duration=Number(q('duration').value);if(q('temperature'))edit.temperature=Number(q('temperature').value);
    if(root.querySelector('[data-day]'))edit.days=[...root.querySelectorAll('[data-day]:checked')].map(i=>Number(i.dataset.day));
  }
  function bind(){
    root.querySelectorAll('input[type=range]').forEach(r=>r.addEventListener('input',()=>{const v=Number(r.value),u=r.dataset.unit;r.style.setProperty('--f',frac(v,Number(r.min),Number(r.max)));const out=r.closest('.f')?.querySelector('[data-out]');if(out)out.textContent=(u==='°C'?v.toFixed(1):v)+' '+u;r.setAttribute('aria-valuetext',v+' '+u);}));
    root.querySelectorAll('.stp').forEach(w=>{const h=w.querySelector('input[type=hidden]'),o=w.querySelector('output');let t;w.querySelectorAll('[data-stp]').forEach(b=>b.onclick=()=>{const v=Math.min(Number(h.max),Math.max(Number(h.min),Number(h.value)+Number(b.dataset.stp)*Number(h.step)));h.value=v;o.textContent=v+' '+h.dataset.unit;clearTimeout(t);t=setTimeout(()=>h.dispatchEvent(new Event('change')),700);});});
    root.querySelectorAll('[data-qset]').forEach(b=>b.onclick=()=>{const [k,v]=b.dataset.qset.split(':');setQuick(k,Number(v));});
    root.querySelectorAll('[data-ui]').forEach(r=>r.addEventListener('input',()=>syncQuick(r.dataset.ui,Number(r.value))));
    root.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{if(admin)command(b.dataset.cmd);});
    root.querySelectorAll('[data-ui]').forEach(s=>s.onchange=()=>{const v=Number(s.value),key=s.dataset.ui==='temperature'?'default_temperature':'default_duration';ui[s.dataset.ui]=v;if(!admin)return;queued[key]=v;clearTimeout(saveTimer);saveTimer=setTimeout(flushDefaults,700);});
    root.querySelectorAll('[data-cfg]').forEach(s=>s.onchange=()=>{const v=Number(s.value);if(Number.isFinite(v))save({[s.dataset.cfg]:v},'Saved.');});
    root.querySelectorAll('[data-bat]').forEach(s=>s.onchange=()=>save({battery:{...data.config.battery,[s.dataset.bat]:Number(s.value)}},'Saved.'));
    root.querySelectorAll('input[data-k]').forEach(i=>i.onchange=()=>{settleUntil=Date.now()+450;clearTimeout(settleTimer);settleTimer=setTimeout(()=>{if(!dead){lastHtml='';draw();}},470);  // after the animation, rebuild from data so the page matches the saved state

      const k=i.dataset.k,v=i.checked,n=data.config.notify;
      if(k==='scheduling_enabled')return save({scheduling_enabled:v},'Saved.');
      const {devices:_d,...nn}=n;
      if(k.startsWith('notify.'))return save({notify:{...nn,[k.slice(7)]:v}},'Saved.');
      if(k.startsWith('event:'))return save({notify:{...nn,events:{...nn.events,[k.slice(6)]:v}}},'Saved.');
      if(k.startsWith('bat.'))return save({battery:{...data.config.battery,[k.slice(4)]:v}},'Saved.');
      if(k.startsWith('sched:'))return save({schedules:data.config.schedules.map(s=>s.id===k.slice(6)?{...s,enabled:v}:s)},v?'Schedule enabled.':'Schedule disabled.');
    });
    root.querySelectorAll('[data-dev]').forEach(b=>b.onclick=()=>{b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));settleUntil=Date.now()+450;clearTimeout(settleTimer);settleTimer=setTimeout(()=>{if(!dead){lastHtml='';draw();}},470);const d=b.dataset.dev,cur=data.config.notify.devices,devices=cur.includes(d)?cur.filter(x=>x!==d):[...cur,d];save({notify_devices:devices},'Phones saved.');});
    root.querySelectorAll('[data-diag]').forEach(d=>{d.ontoggle=()=>{diagOpen=d.open;};});
    root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{edit=structuredClone(data.config.schedules.find(s=>s.id===b.dataset.edit));draw();});
    root.querySelectorAll('[data-seg]').forEach(b=>b.onclick=()=>{readEditor();edit[b.dataset.seg]=b.dataset.v;draw();});
    root.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
      const a=b.dataset.act;
      if(a==='retry')return load();
      if(a==='clear-hist'){return askConfirm(T('Clear the whole session history?'),T('Removes the history of past preconditioning sessions. Recent activity in Notifications is kept.'),T('Delete')).then(ok=>{if(!ok)return;busy=true;draw();return request('precondition_clear_history').then(r=>{data=r;notify(T('Session history cleared.'));}).catch(e=>notify(e?.message||T('Could not clear the history.'),true)).finally(()=>{busy=false;draw();});});}
      if(a==='test-notify'){busy=true;draw();request('precondition_test').then(r=>{const ok=(r.deliveries||[]).filter(d=>d.status==='accepted').length;testResult=T('Sent to {0} of {1} phones. Home Assistant accepted it; delivery is not confirmed.',ok,(r.deliveries||[]).length);}).catch(e=>{testResult=e?.message||T('Test failed.');}).finally(()=>{busy=false;draw();});return;}
      if(a==='more'){onMore&&onMore(b.dataset.to||null);return;}
      if(a==='info'){infoOpen=!infoOpen;return draw();}
      if(a==='sched-toggle'){schedOpen=!schedOpen;return draw();}
      if(a==='summary-toggle'){summaryOpen=!summaryOpen;return draw();}
      if(a==='reload'){
        if(reloading)return;reloading=true;draw();
        return request('precondition_refresh').then(r=>{
          if(r&&r.config)data={...data,...r,recipients:r.recipients||data.recipients};
          if(r&&r.throttled)notify(T('Please wait a moment before refreshing again.'));
          else if(r&&r.fresh===false)notify(T('The car did not send a new report yet.'));
        }).catch(e=>notify(e?.message||T('Could not refresh.'),true)).finally(()=>{reloading=false;if(!dead)draw();});
      }
      if(a==='new'){const d=new Date();d.setDate(d.getDate()+1);edit={name:'',repeat:'weekdays',mode:'ready_by',date:d.toISOString().slice(0,10),time:'07:30',duration:data.config.default_duration,temperature:data.config.default_temperature,days:[0,1,2,3,4],enabled:true};return draw();}
      if(a==='cancel'){edit=null;return draw();}
      if(a==='save-sched'){readEditor();const item={...edit};const list=item.id?data.config.schedules.map(s=>s.id===item.id?item:s):[...data.config.schedules,item];return save({schedules:list},'Schedule saved.').then(ok=>{if(ok){edit=null;draw();}});}
      if(a==='del'){const id=b.dataset.id;return askConfirm(T('Delete this schedule?'),T('The schedule is removed. Sessions that already ran stay in the history.'),T('Delete')).then(ok=>{if(!ok)return;edit=null;return save({schedules:data.config.schedules.filter(s=>s.id!==id)},'Schedule deleted.');});}
    });
  }
  load();
  return {refresh:load,destroy(){dead=true;clearTimeout(settleTimer);window.removeEventListener('deepal-companion-master',onMaster);clearTimeout(timer);clearTimeout(saveTimer);clearInterval(clockTimer);}};
}

/* the same stylesheet is reused by the charge plan window on the card */
export const PC_STYLE=STYLE;
