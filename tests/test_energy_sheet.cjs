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
  await page.setViewportSize({width:420,height:900});
  await page.evaluate(()=>{const c=document.getElementById("tablet");c._enSheet=true;c._force();});
  await page.waitForFunction(()=>!!document.getElementById("tablet")._el.box.querySelector(".en-infotog"),null,{timeout:15000});
  const st=()=>page.evaluate(()=>{const b=document.getElementById("tablet")._el.box;const a=b.querySelector(".en-info"),t=b.querySelector(".en-infotog");return {hidden:a.hidden,expanded:t.getAttribute("aria-expanded"),visible:a.getBoundingClientRect().height>0,now:!!b.querySelector(".en-now"),charges:!!b.textContent.includes("Charges")};});
  let s=await st();assert.ok(s.hidden&&s.expanded==="false"&&!s.visible&&s.now,"notes are folded at first "+JSON.stringify(s));
  await page.evaluate(()=>document.getElementById("tablet")._el.box.querySelector("[data-eninfo]").click());
  s=await st();assert.ok(!s.hidden&&s.expanded==="true"&&s.visible,"notes open on request "+JSON.stringify(s));
  await page.evaluate(()=>document.getElementById("tablet")._el.box.querySelector("[data-eninfo]").click());
  s=await st();assert.ok(s.hidden&&s.expanded==="false","notes fold again "+JSON.stringify(s));
  // The charging-costs editor: the opener toggles it, and Close is an icon button.
  await page.waitForFunction(()=>!!document.getElementById("tablet")._el.box.querySelector('[data-cc="profiles"]'),null,{timeout:15000});
  const ed=()=>page.evaluate(()=>{const b=document.getElementById("tablet")._el.box,e=b.querySelector(".cc-editor"),x=b.querySelector('[data-cc="close"]');return {open:!!e&&e.getBoundingClientRect().height>0,closeText:x?x.textContent.trim():null,label:x?x.getAttribute("aria-label"):null};});
  await page.evaluate(()=>document.getElementById("tablet")._el.box.querySelector('[data-cc="profiles"]').click());
  await page.waitForFunction(()=>!!document.getElementById("tablet")._el.box.querySelector('[data-cc="close"]'),null,{timeout:5000});
  let e=await ed();assert.ok(e.open,"the editor opens "+JSON.stringify(e));assert.equal(e.closeText,"","Close has no text, only an icon");assert.equal(e.label,"Close");
  const marks=await page.evaluate(()=>{const b=document.getElementById("tablet")._el.box,boxes=[...b.querySelectorAll('.cc-profile [name=default]')];boxes[0].click();boxes[1].click();return {n:boxes.length,flags:boxes.map(x=>x.checked)};});
  assert.ok(marks.n>=2&&marks.flags.filter(Boolean).length===1&&marks.flags[1]===true,"only one profile can be suggested "+JSON.stringify(marks));
  await page.evaluate(()=>document.getElementById("tablet")._el.box.querySelector('[data-cc="profiles"]').click());
  await page.waitForFunction(()=>!document.getElementById("tablet")._el.box.querySelector('[data-cc="close"]'),null,{timeout:5000});
  e=await ed();assert.ok(!e.open,"the same opener closes it again "+JSON.stringify(e));
  // The refresh button's ring keeps flowing when the card renders again while it waits.
  const start=await page.evaluate(()=>{document.querySelector("#cards").style.display="grid";const c=document.getElementById("mobile"),now=new Date().toISOString();window.testHass.states["button.s05_refresh_vehicle_data"]={state:"unknown",attributes:{},last_changed:now,last_updated:now};c.hass={...window.testHass};c._enSheet=false;c._pending.refresh=true;c._force();window.__ring=c._el.rfs.querySelector(".ring");const rect=window.__ring?.querySelector("rect"),a=rect?.getAnimations()[0];window.__t0=a?.currentTime;return {ring:!!window.__ring,anim:!!a,hidden:c._el.rfs.hidden,w:c._el.rfs.getBoundingClientRect().width,name:rect&&getComputedStyle(rect).animationName};});
  assert.ok(start.ring&&start.anim,"the refresh ring runs while waiting "+JSON.stringify(start));
  await page.waitForTimeout(400);
  const ring=await page.evaluate(()=>{const c=document.getElementById("mobile");c._force();const r=c._el.rfs.querySelector(".ring"),a=r.querySelector("rect").getAnimations()[0];const out={same:r===window.__ring,advanced:a.currentTime>window.__t0};c._pending.refresh=false;c._force();out.gone=!c._el.rfs.querySelector(".ring");return out;});
  assert.ok(ring.same&&ring.advanced&&ring.gone,"the refresh ring is kept between renders "+JSON.stringify(ring));
  // Windows glide: a new opening value is approached at a steady speed; a value the other way waits for the move in progress.
  const win=await page.evaluate(async()=>{const c=document.getElementById("mobile"),h=window.testHass,id="sensor.s05_front_left_window_opening",set=v=>{const now=new Date().toISOString();h.states[id]={state:String(v),attributes:{},last_changed:now,last_updated:now};c.hass={...h};},wait=ms=>new Promise(r=>setTimeout(r,ms)),out={};
   set(0);c._winPct("front","left");set(0);out.start=c._winPct("front","left");
   set(100);out.jump=c._winPct("front","left");await wait(500);out.mid=c._winPct("front","left");
   set(20);out.reversal=c._winPct("front","left");await wait(300);out.stillGoingUp=c._winPct("front","left")>out.mid;
   await wait(3600);out.end=c._winPct("front","left");out.raw=c._winRaw("front","left");
   set(60);await wait(300);set(100);out.queue=c._winS.front_left.q.slice();await wait(100);
   return out;});
  const flicker=await page.evaluate(async()=>{const c=document.getElementById("mobile"),h=window.testHass,id="sensor.s05_front_right_window_opening",bin="binary_sensor.s05_front_right_window_open",put=(i,v)=>{const now=new Date().toISOString();h.states[i]={state:String(v),attributes:{},last_changed:now,last_updated:now};};
   put(id,55);put(bin,"on");c.hass={...h};const before=c._winRaw("front","right");put(id,"unknown");c.hass={...h};const during=c._winRaw("front","right");put(id,0);put(bin,"off");c.hass={...h};return {before,during,after:c._winRaw("front","right")};});
  assert.deepEqual(flicker,{before:55,during:55,after:0},"an unknown reading between two readings does not jump the window");
  assert.equal(win.start,0);assert.equal(win.jump,0,"the glass does not jump "+JSON.stringify(win));assert.ok(win.mid>10&&win.mid<60,"after half a second it is part way "+JSON.stringify(win));
  assert.ok(win.stillGoingUp,"a reversal waits for the first move");assert.equal(win.end,20,"then it goes to the new value "+JSON.stringify(win));assert.deepEqual(win.queue,[100],"values in the same direction are merged "+JSON.stringify(win));
  // A clipped layer (the red open-window band) keeps its last clip while it fades out, so the whole red window never shows.
  const fade=await page.evaluate(()=>{const c=document.getElementById("mobile"),im=document.createElement("img");let on=true;const lay=["window_front_left_alert","common",()=>on,null,()=>on?"polygon(0% 0%,10% 0%,10% 5%,0% 5%)":"polygon(0% 0%,100% 0%,100% 100%,0% 100%)"];
   c._layerOn(im,lay);const shown=im.style.clipPath;on=false;c._layerOn(im,lay);const fading=im.style.clipPath;on=true;c._layerOn(im,lay);return {shown,fading,back:im.style.clipPath};});
  assert.ok(fade.shown&&fade.fading===fade.shown&&fade.back===fade.shown,"a layer that switches off keeps its clip "+JSON.stringify(fade));
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("PASS: Energy sheet calculation notes fold and open (mocked history)");
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
