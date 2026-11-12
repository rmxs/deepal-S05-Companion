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
.companion-cost-launch .cost-icon{display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:11px;background:rgba(var(--ds-ok),.12);color:rgb(var(--ds-ok));font-size:23px;font-weight:600}.companion-cost-launch .cost-label{min-width:0;flex:1}.companion-cost-launch b{display:block;font-size:14px;font-weight:600}.companion-cost-launch small{display:block;margin-top:3px;color:var(--ds-fg2);font-size:11px}.companion-cost-launch>.i{--is:18px;color:var(--ds-fg2)}
.charge-assignment-prompt{padding:14px;border:1px solid rgba(var(--ds-ok),.3);border-radius:var(--ds-tr,22px);background:rgba(var(--ds-ok),.06)}.charge-prompt-title{display:flex;align-items:center;gap:8px;font-size:13px}.charge-prompt-title .i{--is:20px;color:rgb(var(--ds-ok))}.charge-prompt-title>span{margin-left:auto;color:rgb(var(--ds-ok));font-weight:600}.charge-assignment-prompt p{font-size:12px;color:var(--ds-fg2);margin:8px 0 12px;line-height:1.5}.charge-prompt-profile{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}.charge-prompt-profile select{min-width:0;width:100%;padding:10px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg)}.charge-assignment-prompt button{min-height:38px;padding:8px 10px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;font-size:12px;cursor:pointer}.charge-assignment-prompt button:disabled{opacity:.4}.charge-prompt-actions{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.charge-prompt-actions button{background:transparent;color:var(--ds-fg2)}.charge-prompt-profile>button{color:rgb(var(--ds-ok));border-color:rgba(var(--ds-ok),.3)}
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
.dz-rings:focus-visible,.dz-gw:focus-visible{outline:2px solid rgb(var(--ds-ok))}
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
.dz-lock{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:99px;font-size:13px;font-weight:500;color:rgb(var(--st-c,var(--ds-ok)));background:rgba(var(--st-c,var(--ds-ok)),.14);flex:none;white-space:nowrap}
.dz-chip[data-ent],[data-dz-lock]{cursor:pointer}.dz-chip[data-ent]:hover{background:var(--ds-line)}.dz-chip:focus-visible,[data-dz-lock]:focus-visible{outline:2px solid rgb(var(--ds-ok));outline-offset:2px}
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
.dz-cp .gs{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.dz-cp .gs .dz-chip:last-child:nth-child(odd){grid-column:1/-1}
.dz-chip.chg{grid-column:1/-1;background:rgba(var(--ds-ok),.14);border-color:rgba(var(--ds-ok),.4);color:rgb(var(--ds-ok))}
.dz-chip.chg .i,.dz-chip.chg .k{color:inherit}
.dz-ul{display:flex;align-items:center;gap:12px;padding:0 18px;min-height:60px;overflow:hidden}
.dz-ul .u-dot{width:8px;height:8px;border-radius:50%;background:rgb(var(--st-c,var(--ds-ok)));flex:none}
.dz-ul .n{font-size:16px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dz-ul .u-lock{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;color:rgb(var(--st-c,var(--ds-ok)));background:rgba(var(--st-c,var(--ds-ok)),.14);flex:none}
.dz-ul .u-lock .i{--is:17px}
.dz-ul .sep{width:1px;height:24px;background:var(--ds-line);flex:none}
.dz-ul .big{font-size:24px;white-space:nowrap}.dz-ul .big small{font-size:13px;margin-left:3px;color:rgb(var(--ds-ok))}
.dz-ul .u-m{display:inline-flex;align-items:center;gap:4px;font-size:15px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
.dz-ul .u-m .i{--is:17px;color:rgb(var(--rg))}
.dz-ul .u-m.chg .i{animation:dzpulse 2.4s ease-in-out infinite}
.dz-ul .u-i{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--ds-fg2);white-space:nowrap;cursor:pointer}
.dz-ul .u-i .i{--is:14px}
.dz-ul .u-i:focus-visible,.dz-ul .u-lock:focus-visible{outline:2px solid rgb(var(--ds-ok));outline-offset:2px}
.dz-ul .u-x{margin-left:auto;display:flex;align-items:center;gap:12px;min-width:0}
.dz-ul .u-chg{color:rgb(var(--ds-ok));font-weight:600;font-size:13px;display:inline-flex;gap:4px;align-items:center;white-space:nowrap}
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
  for(const id of (c.info_order||[]).filter(id=>(c.info||[]).includes(id))){const it=INFO_ITEMS[id];if(!it)continue;if(id==="fuel_level"&&!hasFuel(card._hass,c))continue;
    const n=it[3]===null?null:card._nl(it[0]).v,raw=card._s(it[0]);if(raw===null&&n===null)continue;
    out.push({ent:card._id(it[0]),icon:it[2],label:T(it[1]),val:it[3]===null?(raw===null?"--":stateText(raw)):n===null?"--":(card._fmtNum(n,it[3])+" "+card._unit(it[0])).trim()});}
  for(const x of c.info_custom||[]){const o=card._eobj(x.entity),n=o?parseFloat(o.state):NaN;
    out.push({ent:x.entity,icon:x.icon||"info",label:x.label||o?.attributes?.friendly_name||x.entity,tap:x.tap_action,hold:x.hold_action,val:!o||BAD.includes(o.state)?"--":Number.isFinite(n)?(card._fmtNum(n,1)+" "+(o.attributes?.unit_of_measurement||x.unit||"")).trim():stateText(o.state)});}
  return out;};
const dzClock='<svg class="i" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const dzMarkup=(card,kind,d)=>{
  const c=card._c,num=n=>n===null||n===undefined?"--":String(Math.round(n)),st=d.st,stale=d.off||(d.ageMin!==null&&d.ageMin>180);
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
    const chips=dzInfo(card).slice(0,4).map(x=>'<div class="dz-chip" data-ent="'+esc(x.ent)+'"'+(x.tap?' data-tap="'+esc(JSON.stringify(x.tap))+'"':"")+(x.hold?' data-hold="'+esc(JSON.stringify(x.hold))+'"':"")+' role="button" tabindex="0" title="'+esc(x.label)+'" aria-label="'+esc(x.label+": "+x.val)+'">'+ico(x.icon)+'<span class="k">'+esc(x.label)+'</span><b>'+esc(x.val)+'</b></div>').join("");
    const gear=c.show_customize===false||card._hass?.user?.is_admin===false?"":'<button class="dz-gear" data-dz-gear aria-label="'+esc(T("Open Companion settings"))+'">'+ico("sliders")+'</button>';
    const right=d.charging&&d.left?'<span class="sp" style="color:rgb(var(--ds-ok))">'+ico("bolt")+esc(T("{0} left",d.left))+'</span>':'<span class="sp"></span>';
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
  const chgChip=d.charging?'<div class="dz-chip chg">'+ico("bolt")+'<span class="k">'+esc(T("Charging now"))+'</span>'+(d.left?'<b>'+esc(T("{0} left",d.left))+'</b>':"")+'</div>':"";
  const out=tempOf("sensor.outside_temperature");
  return '<div class="dz-gw"'+tap+'>'+gauge+'<div class="dz-gc"><div class="big">'+num(d.total)+'<small>km</small></div><div class="cap">'+esc(T(d.fu?"total range":"range"))+'</div></div></div>'
    +'<div class="dz-leg">'+leg(d.evRgb,d.bat,T("Battery"),d.range)+(d.fu?leg(d.fuRgb,d.fuelPct,T("Fuel"),d.fuel):"")+'</div>'
    +'<div class="gs">'+chgChip+(inside!==null?dzChip("thermo",T("Inside"),inside):"")+climChip+(out!==null?dzChip("thermo",T("Outside"),out):"")+'</div>';
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
  costs.style.order=String(this._c.order.indexOf('costs'));costs.toggleAttribute('data-off',this._c.hidden.includes('costs')||this._c.charging_cost===false);
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
