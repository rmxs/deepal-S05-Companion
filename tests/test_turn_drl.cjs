const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
/* Run a test module and name it in the failure, so a red run points at the module that broke. */
function runStandalone(name){require('child_process').execFileSync(process.execPath,[require('path').join(__dirname,name)],{stdio:'inherit'});}
async function runModule(page,name){try{await require("./"+name)(page);}catch(error){error.message="["+name+"] "+error.message;throw error;}}
const base=path.resolve(__dirname,"../custom_components/deepal_companion/frontend");
const original=fs.readFileSync(path.resolve(__dirname,"../source/card.js"),"utf8"),built=fs.readFileSync(base+"/companion-card.js","utf8");
// The retained rendering/settings code must be byte-identical after namespace substitution.
function normalize(s){return s.replaceAll("deepal-s05-card","deepal-companion-card").replaceAll("deepal-s05-settings","deepal-companion-settings").replaceAll("__DEEPAL_S05_","__DEEPAL_COMPANION_");}
for(const [a,b]of [["const SKY_PH","class DeepalS05Card"],["class DeepalS05Settings","/* ───────────────────────── HA editor"],["  _applyTop()","  disconnectedCallback()"],["  _build()","const normPath"]]){
 const i=original.indexOf(a),j=original.indexOf(b,i+1);if(i>=0&&j>i)assert(built.includes(normalize(original.slice(i,j))),"Retained UI changed: "+a);
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,"http://localhost"),relative=u.pathname.startsWith("/deepal_companion/frontend/")?u.pathname.slice("/deepal_companion/frontend/".length):null;
 if(relative!==null){const file=path.resolve(base,relative);if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}if(fs.existsSync(file)){res.setHeader("Content-Type",file.endsWith(".js")?"text/javascript; charset=utf-8":file.endsWith(".css")?"text/css; charset=utf-8":file.endsWith(".svg")?"image/svg+xml":file.endsWith(".woff2")?"font/woff2":"image/webp");res.end(fs.readFileSync(file));return;}res.writeHead(404);res.end();return;}
 res.setHeader("Content-Type","text/html; charset=utf-8");res.end('<html><head><style>body{margin:0;background:#17191c;color:#eee;font:14px Arial;--card-background-color:#232528;--primary-background-color:#17191c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#42464a;--primary-color:#29c99a}#cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px}ha-card{display:block}button{font:inherit}</style></head><body><div id="cards"></div><div id="editor"></div><div id="panel"></div></body></html>');
});
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||undefined,...(fs.existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")?{executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1050},...(process.env.ENERGY_COST_ONLY?{timezoneId:"Pacific/Honolulu"}:{})}),errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error("BROWSER:",e.stack);});
  await page.goto("http://127.0.0.1:"+server.address().port);
  await page.evaluate(()=>{
    window.activeIntervals=new Set();const original=setInterval,clear=clearInterval;
    window.setInterval=(...args)=>{const id=original(...args);activeIntervals.add(id);return id;};
    window.clearInterval=id=>{activeIntervals.delete(id);clear(id);};
  });
  await page.addScriptTag({path:path.resolve(__dirname,"ha_selector_double.js")});
  await page.addScriptTag({url:"/deepal_companion/frontend/companion-card.js"});
  await page.evaluate(()=>{
   const now=new Date().toISOString(),state=(value,attributes={})=>({state:String(value),attributes,last_changed:now,last_updated:now});
   const states={};
   for(const [key,val]of Object.entries({battery_level:79,remaining_range:95,fuel_range:498,fuel_level:53,total_odometer:2811,inside_temperature:26,outside_temperature:22,cabin_humidity:9,ac_charge_current:0,dc_charge_current:0,power_status:"off",license_plate:"TEST",last_updated:now,remaining_charge_time_h_mm:"00:00"}))states["sensor.s05_"+key]=state(val,{unit_of_measurement:key==="battery_level"||key==="fuel_level"?"%":key.includes("range")?"km":key.includes("current")?"A":""});
   states["lock.s05_doors"]=state("locked");states["cover.s05_windows"]=state("closed");states["cover.s05_trunk"]=state("closed");states["climate.s05_cabin_climate"]=state("off",{temperature:22,current_temperature:26,min_temp:16,max_temp:30,hvac_modes:["off","auto","cool","heat"],supported_features:385});
   for(const k of ["front_left_door","front_right_door","rear_left_door","rear_right_door","hood","trunk","charger_plugged","charging","cloud_connection","climate_on","position_lamp","low_beam","high_beam","front_left_window_open","front_right_window_open","rear_left_window_open","rear_right_window_open"])states["binary_sensor.s05_"+k]=state(k==="cloud_connection"?"on":"off");
   for(const wheel of ["front_left","front_right","rear_left","rear_right"]){states["sensor.s05_"+wheel+"_tire_pressure"]=state(2.95,{unit_of_measurement:"bar"});states["binary_sensor.s05_"+wheel+"_tire_alarm"]=state("off");}
   for(const side of ["front_left","front_right"])for(const fn of ["seat_heating_level","seat_ventilation_level"])states["number.s05_"+side+"_"+fn]=state(0,{min:0,max:3,step:1});
   states["switch.s05_steering_wheel_heating"]=state("off");
   states["sensor.s05_battery_level"].attributes.friendly_name="S05 Battery level";states["binary_sensor.s05_charger_plugged"].attributes.friendly_name="S05 Charger plugged in";for(const[id,obj]of Object.entries(states))obj.entity_id=id;window.calls=[];window.apiCalls=[];window.serviceCalls=[];window.subscribers=[];
   window.dashboardConfigs={lovelace:{views:[{title:'Home',cards:[{type:'markdown',content:'Keep this card'}]}]},phone:{views:[{title:'Car',type:'sections',sections:[{type:'grid',cards:[{type:'markdown',content:'Keep section'}]}]}]},auto:{strategy:{type:'original-states'}}};
   window.viewNames={};window.views={mobile:{car_color:"black",hero_style:"carview"},tablet:{car_color:"white",hero_style:"carview"},energy:{car_color:"silver",hero_style:"carview"}};
   window.common={prefix:"s05",entities:{"sensor.battery_level":"sensor.s05_battery_level"}};
   window.costs={profiles:[{id:"home",name:"Home",price:.22,free:false,source:"battery",efficiency:90},{id:"work",name:"Work",price:null,free:true,source:"battery",efficiency:90},{id:"free",name:"Free",price:null,free:true,source:"battery",efficiency:90},{id:"ionity",name:"Ionity",price:null,free:false,source:"battery",efficiency:90},{id:"public",name:"Public",price:null,free:false,source:"battery",efficiency:90}],sessions:{}};
   let revision=0;const shared=new Set(["battery_kwh","prefix","entities","powertrain","fuel_max"]);
   const publish=()=>queueMicrotask(()=>window.subscribers.forEach(fn=>fn({vehicle_id:'car'})));
   const reminder=()=>{const p=window.promptFixture;if(!p||(window.dismissedPrompts||[]).includes(p.id)||window.costs.sessions[String(Math.round(p.s/1000))]?.profile)return null;return {...p,profiles:window.costs.profiles};};
   const config=m=>({vehicle_id:"car",view_id:m.view_id||"mobile",view_name:window.viewNames[m.view_id]||m.view_id||"mobile",revision:[revision,revision],config:{...window.views[m.view_id||"mobile"],...window.common},charge_prompt:reminder()});
   const hass=window.testHass={locale:{language:"en"},language:"en",user:{id:"admin",is_admin:true},states,entities:{},devices:{},services:{notify:{mobile_app_phone:{}},lock:{lock:{},unlock:{}},cover:{open_cover:{},close_cover:{}},climate:{set_temperature:{},turn_on:{},turn_off:{}}},config:{time_zone:"UTC",unit_system:{temperature:"°C"}},
    connection:{subscribeMessage:async(fn,m)=>{window.subscribers.push(fn);return ()=>{window.subscribers=window.subscribers.filter(f=>f!==fn);};}},
    callService:async(...args)=>{window.serviceCalls.push(args);},callApi:async(...args)=>{window.apiCalls.push(args);return {};},
    callWS:async m=>{
     window.calls.push(m);
     if(m.type==="config/entity_registry/list")return [];if(m.type==="config/device_registry/list")return [];
     if(m.type==="history/history_during_period"){
      if(window.recorderFails)throw Error("Recorder unavailable");
      if(window.recorderOnly){const t=(window.sessionStart??=Date.now()-4*36e5)-2*864e5;return {"sensor.s05_battery_level":[{lu:t/1000,s:"20"},{lu:(t+36e5)/1000,s:"60"}],"sensor.s05_ac_charge_current":[{lu:t/1000,s:"8"},{lu:(t+36e5)/1000,s:"0"}],"sensor.s05_dc_charge_current":[{lu:t/1000,s:"0"}]};}
      return {};
     }
     if(m.type==='lovelace/dashboards/list')return [{url_path:'phone',title:'Phone dashboard',mode:'storage'},{url_path:'auto',title:'Automatic',mode:'storage'},{url_path:'yaml',title:'YAML dashboard',mode:'yaml'}];
     if(m.type==='lovelace/config')return structuredClone(window.dashboardConfigs[m.url_path||'lovelace']);
     if(m.type==='lovelace/config/save'){window.dashboardConfigs[m.url_path||'lovelace']=structuredClone(m.config);return {};}
     if(m.type!=="deepal_companion/request")return {};
     if(window.pageMocks?.[m.op])return window.pageMocks[m.op](m.data||{});if(m.op==="notifications_get"&&window.notificationUnavailable)throw Error("Unknown Companion operation");
     if(!window.activityRows)window.activityRows=Array.from({length:12},(_,i)=>({id:i.toString(16).padStart(32,'0'),time:Date.now()/1000-i*3600,rule_id:'charge_done',name:'Charging complete',title:'Deepal S05 · Charging complete',message:'Battery 67%, range 81 km.',icon:'mdi:battery-check-outline',status:'test',deliveries:[{device:'notify.replacement_phone',status:'accepted'}]}));
     const activityPage=(limit=5,before=null)=>{const start=before?window.activityRows.findIndex(row=>row.id===before)+1:0,rows=structuredClone(window.activityRows.slice(start,start+limit)),has_more=start+rows.length<window.activityRows.length;return {rows,total:window.activityRows.length,has_more,next_before:has_more?rows.at(-1)?.id:null};};
     if(m.op==='notifications_unread'){(window.unreadCalls??=[]).push(m.data||{});if(m.data?.mark)window.unread=0;return {unread:window.unread??2};}
     if(m.op==='notifications_explain'){(window.explainCalls??=[]).push(m.data);return {rule_id:m.data.rule_id,name:'Unlocked vehicle',verdict:'waiting',summary:'Not sent yet: a condition is not true.',retry_in:null,checked:1,steps:[{id:'check0',status:'pass',title:'Doors are unlocked',detail:'Now: unlocked (changed 3 min ago)',help:'Help for the doors line.'},{id:'check1',status:'block',title:'Power status is off',detail:'Now: on (changed 12 min ago)',help:'Help for the power line.'},{id:'delay',status:'wait',title:'Delay',detail:'2 min left'}]};}
     if(m.op==="update_rate_get")return {seconds:window.updateRate||0};
     if(m.op==="update_rate_set"){if(!window.testHass.user.is_admin)throw Error("Administrator access is required to change the data update rate");if(![0,300,600].includes(m.data?.seconds))throw Error("Unknown update rate");window.updateRate=m.data.seconds;return {seconds:window.updateRate};}
     if(m.op==="notification_language_get")return {language:window.notificationLanguage||"auto"};
     if(m.op==="notification_language_set"){if(!window.testHass.user.is_admin)throw Error("Administrator access is required to change the notification language");const allowed=["auto","en","el","de","es","it"];if(!allowed.includes(m.data?.language))throw Error("Unknown language");window.notificationLanguage=m.data.language;return {language:window.notificationLanguage};}
     if(m.op==="notifications_get"){const activity=activityPage();return {live_supported:true,value:structuredClone(window.localNotifications||{enabled:false,rules:[]}),history:activity.rows,activity,recipients:[{svc:'notify.replacement_phone',name:'Current iPhone',tracker:'device_tracker.current_phone',legacy_service:'mobile_app_phone'},{svc:'notify.another_users_android',name:'Another user’s Android',tracker:'',legacy_service:'mobile_app_android'}]};}
     if(m.op==='notifications_history'){window.activityRequests=(window.activityRequests||0)+1;return activityPage(m.data.limit,m.data.before);}
     if(m.op==='notifications_history_delete'){window.activityRows=m.data.all?[]:window.activityRows.filter(row=>row.id!==m.data.id);return activityPage();}
     if(m.op==='notifications_live_test'||m.op==='notifications_live_stop_test'){window.liveRequests=(window.liveRequests||[]).concat(structuredClone(m));return {ended:m.op==='notifications_live_stop_test',deliveries:m.data.value.devices.map(device=>({device,status:'accepted'}))};}
     if(m.op==="notifications_set"){window.localNotifications=structuredClone(m.data.value);return {value:structuredClone(window.localNotifications)};}
     if(m.op==="notifications_preview"||m.op==="notifications_test"){if(m.op==="notifications_test")window.localTestSends=(window.localTestSends||0)+1;return {active:false,title:m.data.rule.title,message:m.data.rule.message,deliveries:m.data.rule.devices.map(device=>({device,status:'accepted'}))};}
     if(m.op==='sessions_import'){if(m.data.sync_complete)window.forceRecorderSync=false;window.importedRows=window.importedRows||[];for(const row of m.data.rows)if(!window.importedRows.some(r=>r.s===row.s))window.importedRows.push({...row,live:false});return {imported:m.data.rows.length};}
     if(m.op==='sessions_page'){
       const sort=m.data.sort||'newest',compare=(a,b)=>{if(sort==='oldest')return a.s-b.s;if(sort==='newest')return b.s-a.s;const ac=a.pricing?.cost,bc=b.pricing?.cost;if(ac==null||bc==null)return (ac==null)-(bc==null)||b.s-a.s;return (sort==='highest'?bc-ac:ac-bc)||b.s-a.s;};
       const rows=(window.pageRows||await hass.callWS({...m,op:'sessions',data:{}})).map(r=>{const assignment=window.costs.sessions[String(Math.round(r.s/1000))]||r.assignment,id=assignment?.profile?.id;const liveCost=(row,a)=>{if(!a?.profile)return {energy:null,cost:null,source:'battery',estimated:true,cost_estimated:false};const eff=(a.profile.efficiency||100)/100,energy=a.energy??(Math.max(0,row.to-row.from)*(a.capacity||row.capacity||18.4)/100/eff),cost=a.total!=null?a.total:a.profile.free?0:a.profile.price!=null?a.profile.price*energy:null;return {energy,cost,source:'battery',estimated:a.energy==null,cost_estimated:a.total==null&&!a.profile.free&&cost!==null};};return {...r,assignment,...(r.live?{pricing:liveCost(r,assignment)}:{}),profile_removed:!!id&&id!=='manual'&&!window.costs.profiles.some(p=>p.id===id)};}).filter(r=>!m.data.location||(m.data.location==='__unset__'?!r.assignment?.profile?.id:r.assignment?.profile?.id===m.data.location)).sort(compare);
       const cursor=m.data.before==null?null:typeof m.data.before==='object'?{s:m.data.before.start,pricing:{cost:m.data.before.cost}}:{s:m.data.before};
       const filtered=cursor?rows.filter(row=>compare(row,cursor)>0):rows,items=filtered.slice(0,m.data.limit),hasMore=filtered.length>items.length,last=items.at(-1);
       return {sort,curves_synced:1,recorder_synced:window.forceRecorderSync?0:Date.now()/1000,rows:structuredClone(items),total:rows.length,locations:window.costs.profiles.map(p=>({id:p.id,name:p.name})),has_more:hasMore,next_before:hasMore?(['highest','lowest'].includes(sort)?{start:last.s,cost:last.pricing?.cost??null}:last.s):null};
     }
     if(m.op==='session_curve')return {start:Date.now()-3600000,end:Date.now(),session_id:m.data.session_id,series:{ac:[{lu:(Date.now()-3600000)/1000,s:'8'},{lu:(Date.now()-1800000)/1000,s:'16'}],dc:[],battery:[]}};
     if(m.op==='charging_dashboard'){const rows=(window.pageRows||await hass.callWS({...m,op:'sessions',data:{}})).filter(r=>!r.live).map(r=>{const receipt=window.costs.sessions[String(Math.round(r.s/1000))];if(!receipt)return r;const energy=receipt.energy??receipt.kwh??r.kwh,profile=receipt.profile,cost=receipt.total??(profile.free?0:profile.price==null?null:profile.price*energy);return {...r,pricing:{energy,cost,estimated:receipt.energy==null,source:profile.source||'battery'}};}),priced=rows.filter(r=>r.pricing?.cost!=null);return {total:rows.length,priced:priced.length,unpriced:rows.length-priced.length,cost:priced.reduce((sum,r)=>sum+r.pricing.cost,0),energy:rows.reduce((sum,r)=>sum+(r.pricing?.energy??r.kwh??0),0),battery_estimated:rows.filter(r=>r.pricing?.estimated&&r.pricing?.source==='battery').length,chart_rows:(()=>{const days=new Map();for(const r of rows){const d=new Date(r.s);d.setUTCHours(0,0,0,0);const b=days.get(d.getTime())||{s:d.getTime(),split:{paid:0,free:0,unpriced:0}},cost=r.pricing?.cost;b.split[cost==null?'unpriced':cost===0?'free':'paid']+=r.pricing?.energy??r.kwh??0;days.set(b.s,b);}return [...days.values()];})()};}
     if(m.op==="list")return [{id:"car",name:"Deepal S05",config:window.common,views:Object.keys(window.views).map(id=>({id,name:window.viewNames[id]||id,revision}))}];
     if(m.op==="config_get"){const value=structuredClone(config(m));if(window.delayGet?.[m.view_id])await new Promise(r=>setTimeout(r,window.delayGet[m.view_id]));return value;}
     if(m.op==="config_patch"){if(window.delayPatchMS)await new Promise(r=>setTimeout(r,window.delayPatchMS));if(m.data.reset)window.views[m.view_id]={};for(const[k,v]of Object.entries(m.data.patch||{}))(shared.has(k)?window.common:window.views[m.view_id])[k]=v;revision++;queueMicrotask(()=>window.subscribers.forEach(fn=>fn({vehicle_id:"car"})));return config(m);}
     if(m.op==="costs_get")return {value:structuredClone(window.costs)};
     if(m.op==="costs_set"){if(window.failCostSave)throw Error("Simulated storage failure");if(window.costsConflict)throw Error("This charging receipt changed elsewhere. Reload before saving.");if(m.data.changes){if(m.data.changes.profiles)window.costs.profiles=structuredClone(m.data.changes.profiles);Object.assign(window.costs.sessions,structuredClone(m.data.changes.sessions||{}));}else window.costs=structuredClone(m.data.value);publish();return {};}
     if(m.op==='charge_prompt_dismiss'){window.dismissedPrompts=[...(window.dismissedPrompts||[]),m.data.session_id];publish();return {};}
     if(m.op==='charge_profile_assign'){const p=window.promptFixture?.id===m.data.session_id?window.promptFixture:(window.pageRows||[]).find(r=>r.id===m.data.session_id),profile=window.costs.profiles.find(p=>p.id===m.data.profile_id);if(!p||!profile)throw Error('Unknown charge/profile');window.costs.sessions[String(Math.round(p.s/1000))]={start:p.s,capacity:18.4,profile:structuredClone(profile)};publish();return {};}
     if(m.op==="history"){if(window.historyDelayMS)await new Promise(r=>setTimeout(r,window.historyDelayMS));const t=window.sessionStart??=Date.now()-4*36e5,out={};for(const id of m.data.entity_ids||[]){if(id==="sensor.s05_battery_level")out[id]=[{lu:t/1000,s:"20"},{lu:(t+18e5)/1000,s:"50"},{lu:(t+36e5)/1000,s:"79"}];else if(id==="sensor.s05_ac_charge_current")out[id]=[{lu:t/1000,s:"8"},{lu:(t+36e5)/1000,s:"0"}];else out[id]=[];}return out;}
     if(m.op==="sessions"){if(window.archiveEmpty)return window.importedRows||[];let t=window.sessionStart??=Date.now()-4*36e5;if(window.archiveUsesNative)t-=2*864e5;return [{id:"session",s:t,e:t+36e5,live:false,from:20,to:79,kwh:10.856,dc:false,capacity:18.4,pricing:window.__DEEPAL_COMPANION_ENERGY?.costMath.chargingCost?.({s:t,e:t+36e5,kwh:10.856},window.costs.sessions[String(Math.round(t/1000))],[],"")||{energy:null,cost:null,estimated:true},assignment:window.costs.sessions[String(Math.round(t/1000))]||null}];}
     if(m.op==="view"){const action=m.data.action;if(action==="create"){const id="new"+Date.now();window.views[id]={...(window.views[m.data.source]||{})};return {view_id:id};}if(action==="rename")window.viewNames[m.view_id]=m.data.name;if(action==="delete")delete window.views[m.view_id];return {};}
     if(m.op==="backup")return {file:".storage/deepal_companion.backup.sqlite"};if(m.op==="export")return {format:"deepal_companion",sessions:[]};
     throw Error("Unknown mocked operation "+m.op);
    }
   };
   for(const view_id of ["mobile","tablet","energy"]){const c=document.createElement("deepal-companion-card");c.id=view_id;c.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id});document.querySelector("#cards").append(c);c.hass=hass;}
  });
  await page.waitForFunction(()=>["mobile","tablet","energy"].every(id=>document.getElementById(id)._built));
  /* Targeted check: turn signals, position lamp (DRL), high beam and the far-side mirror in the 3/4 Car View (white car, mocked sensors only) */
  const set=(pairs)=>page.evaluate((p)=>{const card=document.getElementById("tablet");for(const [k,v] of Object.entries(p)){const id=k;window.testHass.states[id]={entity_id:id,state:String(v),attributes:{},last_changed:new Date().toISOString(),last_updated:new Date().toISOString()};}card.hass={...window.testHass};},pairs);
  const snap=()=>page.evaluate(()=>{const card=document.getElementById("tablet"),cva=card._el.cva;const on=(n,cls)=>[...cva.querySelectorAll(`img[data-n="${n}"]${cls?"."+cls:":not([class*=drlg]):not(.hb)"}`)].some(i=>i.classList.contains("on"));
    return {amb:cva.querySelector(".amb").classList.contains("on"),tnt:cva.querySelector(".tnt").classList.contains("lit"),drlLine:on("drl_on_l"),drlTri:on("drl_on_t"),low:on("low_beam_on"),hb:on("low_beam_on","hb"),
      trn:[...cva.querySelectorAll(".trn g[data-t]")].map(g=>g.dataset.t+(g.classList.contains("on")?"+":"-")+(g.style.display==="none"?"h":"")),drlc:cva.querySelector(".drlc").getAttribute("class"),mask:cva.querySelector(".tnt")._m||""};});
  await page.evaluate(()=>{const card=document.getElementById("tablet");card._c.hero_style="carview";card._c.car_side="driver";});
  const base=["binary_sensor.s05_position_lamp","binary_sensor.s05_low_beam","binary_sensor.s05_high_beam","binary_sensor.s05_left_turn_signal","binary_sensor.s05_right_turn_signal","binary_sensor.s05_front_right_door","binary_sensor.s05_front_left_door"];
  await set(Object.fromEntries(base.map(k=>[k,"off"]))); await page.waitForTimeout(600);
  let s=await snap(); assert.equal(s.amb||s.tnt||s.drlLine||s.drlTri||s.low||s.hb,false,"Everything off: no lamp effects "+JSON.stringify(s));
  await set({"binary_sensor.s05_position_lamp":"on"}); await page.waitForTimeout(600); s=await snap();
  assert.ok(s.tnt&&s.drlLine&&s.drlTri&&!s.amb,"Position lamp on: line + triangle + tint "+JSON.stringify(s));
  await set({"binary_sensor.s05_left_turn_signal":"on"}); await page.waitForTimeout(600); s=await snap();
  assert.ok(s.amb&&!s.drlLine&&s.drlTri&&s.tnt&&/drl_mask_tri/.test(s.mask),"Left signal: the white line is off (only amber flashes on it), the triangle and its tint stay on "+JSON.stringify(s));
  assert.ok(s.trn.includes("left+"),"Left signal flashes the left strips/glow "+JSON.stringify(s));
  await set({"binary_sensor.s05_left_turn_signal":"off","binary_sensor.s05_right_turn_signal":"on","binary_sensor.s05_front_right_door":"on"}); await page.waitForTimeout(600); s=await snap();
  assert.ok(!s.amb&&s.trn.filter(x=>x.startsWith("right+")).length===2&&s.trn.every(x=>!x.startsWith("right")||!x.endsWith("h")),"Right signal: corner + far mirror (door open) flash "+JSON.stringify(s));
  assert.ok(/lit/.test(s.drlc)&&!/sg/.test(s.drlc),"White far corner line stays on while the right signal flashes "+s.drlc);
  await set({"binary_sensor.s05_front_right_door":"off"}); await page.waitForTimeout(500); s=await snap();
  assert.ok(s.trn.some(x=>x==="right+h"),"Far mirror strip is hidden when the front right door is closed "+JSON.stringify(s));
  /* Car side (3/4 view): auto / driver / passenger mirror the car and draw the passenger doors, windows and signals on the near side */
  const side=(v)=>page.evaluate((v)=>{const card=document.getElementById("tablet");card._c.car_side=v;card.hass={...window.testHass};},v);
  const mir=()=>page.evaluate(()=>{const card=document.getElementById("tablet"),cva=card._el.cva,on=n=>[...cva.querySelectorAll(`img[data-n="${n}"]`)].some(i=>i.classList.contains("on"));return {flip:cva.classList.contains("flip"),flo:on("door_front_left_open"),fro:on("door_front_right_open"),plate:!!cva.querySelector(".pl"),trn:[...cva.querySelectorAll(".trn g[data-t]")].map(g=>g.dataset.t+(g.classList.contains("on")?"+":"-"))};});
  await set({"binary_sensor.s05_right_turn_signal":"off","binary_sensor.s05_front_right_door":"on"}); await side("auto"); await page.waitForTimeout(500); let m=await mir();
  assert.ok(m.flip&&m.flo&&!m.fro&&m.plate,"Auto: only the passenger door open → mirrored, drawn as the near-side door "+JSON.stringify(m));
  await set({"binary_sensor.s05_front_left_door":"on"}); await page.waitForTimeout(500); m=await mir();
  assert.ok(!m.flip&&m.flo&&m.fro,"Auto: both sides open → normal view "+JSON.stringify(m));
  await set({"binary_sensor.s05_front_left_door":"off","binary_sensor.s05_front_right_door":"off"}); await page.waitForTimeout(500); m=await mir();
  assert.ok(!m.flip&&!m.flo&&!m.fro,"Auto: nothing open → normal view "+JSON.stringify(m));
  await side("driver"); await set({"binary_sensor.s05_front_right_door":"on"}); await page.waitForTimeout(500); m=await mir();
  assert.ok(!m.flip&&m.fro&&!m.flo,"Driver: never mirrored "+JSON.stringify(m));
  await side("passenger"); await set({"binary_sensor.s05_front_right_door":"off"}); await page.waitForTimeout(500); m=await mir();
  assert.ok(m.flip,"Passenger: always mirrored "+JSON.stringify(m));
  await set({"binary_sensor.s05_front_right_door":"on","binary_sensor.s05_right_turn_signal":"on"}); await page.waitForTimeout(500); m=await mir();
  assert.ok(m.flip&&m.flo&&!m.fro&&m.trn.includes("left+")&&m.trn.includes("right-"),"Passenger: the passenger door and signal are drawn on the near side "+JSON.stringify(m));
  await side("auto"); await set({"binary_sensor.s05_front_right_door":"off","binary_sensor.s05_right_turn_signal":"off"}); await page.waitForTimeout(400);
  await set({"binary_sensor.s05_right_turn_signal":"off","binary_sensor.s05_position_lamp":"off","binary_sensor.s05_high_beam":"on"}); await page.waitForTimeout(600); s=await snap();
  assert.ok(s.low&&s.hb&&!s.tnt,"High beam: low beam layer + the stronger copy "+JSON.stringify(s));
  /* Preview demos (simulated sensors only): the steps advance on their own and stop when another preview state is chosen */
  const demo=await page.evaluate(async()=>{const ui=window.__DEEPAL_COMPANION_UI,card=document.getElementById("mobile"),seen=[],read=()=>["position_lamp","low_beam","high_beam","left_turn_signal","right_turn_signal"].map(k=>card._is("binary_sensor."+k,"on")?1:0).join("");
    ui.applyPreview(card,window.testHass,"lights");seen.push(read());
    const steps=[];const win=()=>["front_left","front_right","rear_left","rear_right"].map(k=>card._winPct(k.split("_")[0],k.split("_")[1]));const wins=[],doors=[];for(let i=0;i<ui.LAMP_DEMOS.lights.length;i++){card._demoT=ui.DEMO_OPEN_MS+i*ui.DEMO_STEP_MS+10;card.hass=ui.previewHass(card._previewSourceHass,card._c,"lights",false,card);steps.push(read());wins.push(win()[3]);doors.push(["left","right"].map(sd=>card._is("binary_sensor.front_"+sd+"_door","on")?1:0).join(""));}
    const total=ui.DEMO_OPEN_MS+ui.LAMP_DEMOS.lights.length*ui.DEMO_STEP_MS+ui.DEMO_CLOSE_MS,ph={};for(const [k,t] of [["start",0],["mid-open",ui.DEMO_OPEN_MS/2],["mid-close",total-ui.DEMO_CLOSE_MS/2],["loop",total+5]]){card._demoT=t;card.hass=ui.previewHass(card._previewSourceHass,card._c,"lights",false,card);ph[k]={w:win()[3],lamps:read()};}
    const timer=!!card._demoTimer;ui.applyPreview(card,window.testHass,"parked");const after={timer:!!card._demoTimer,lamps:read()};
    ui.applyPreview(card,window.testHass,"signals");const sig=[];for(let i=0;i<ui.LAMP_DEMOS.signals.length;i++){card._demoT=i*ui.DEMO_STEP_MS+10;card.hass=ui.previewHass(card._previewSourceHass,card._c,"signals",false,card);sig.push(read());}
    ui.applyPreview(card,window.testHass,"live");return {first:seen[0],steps,wins,doors,ph,timer,after,sig,live:!!card._demoTimer};});
  assert.ok(demo.wins.every(w=>w===100)&&demo.ph.start.w===0&&demo.ph["mid-open"].w>0&&demo.ph["mid-open"].w<100&&demo.ph["mid-close"].w>0&&demo.ph["mid-close"].w<100&&demo.ph.loop.w===0&&demo.ph.start.lamps==="00000","Light show: windows open before, stay open during, close slowly after and loop "+JSON.stringify([demo.wins,demo.ph]));
  assert.deepStrictEqual(demo.doors,demo.steps.map(l=>l[3]==="1"||l[4]==="1"?"11":"00"),"Light show: front doors open only while a signal flashes "+JSON.stringify([demo.steps,demo.doors]));
  assert.ok(demo.timer&&!demo.after.timer&&!demo.live&&demo.after.lamps==="00000","Demo timers start and stop with the preview state "+JSON.stringify(demo));
  assert.deepEqual(demo.steps,["10000","11000","11100","11010","11001","11111","11010".replace("11010","11011"),"00000"],"Light show steps "+JSON.stringify(demo.steps));
  assert.deepEqual(demo.sig,["00010","00000","00001","00000","00011","00000"],"Turn signal demo steps "+JSON.stringify(demo.sig));
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("PASS: turn signals, position lamp, high beam and far-side mirror (mocked sensors)");
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
