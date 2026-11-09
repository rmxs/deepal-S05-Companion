const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
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
 const browser=await chromium.launch({headless:true,...(fs.existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")?{executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error("BROWSER:",e.stack);});
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
   let revision=0;const shared=new Set(["battery_kwh","fuel_tank_liters","prefix","entities","powertrain","fuel_max"]);
   const publish=()=>queueMicrotask(()=>window.subscribers.forEach(fn=>fn({vehicle_id:'car'})));
   const reminder=()=>{const p=window.promptFixture;if(!p||(window.dismissedPrompts||[]).includes(p.id)||window.costs.sessions[String(Math.round(p.s/1000))]?.profile)return null;return {...p,profiles:window.costs.profiles};};
   const config=m=>({vehicle_id:"car",view_id:m.view_id||"mobile",view_name:window.viewNames[m.view_id]||m.view_id||"mobile",revision:[revision,revision],config:{...window.views[m.view_id||"mobile"],...window.common},charge_prompt:reminder()});
   const hass=window.testHass={locale:{language:"en"},language:"en",user:{id:"admin",is_admin:true},states,entities:{},devices:{},services:{notify:{mobile_app_phone:{}},lock:{lock:{},unlock:{}},cover:{open_cover:{},close_cover:{}},climate:{set_temperature:{},turn_on:{},turn_off:{}}},config:{unit_system:{temperature:"°C"}},
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
     if(m.op==="notifications_get"&&window.notificationUnavailable)throw Error("Unknown Companion operation");
     if(!window.activityRows)window.activityRows=Array.from({length:12},(_,i)=>({id:i.toString(16).padStart(32,'0'),time:Date.now()/1000-i*3600,rule_id:'charge_done',name:'Charging complete',title:'Deepal S05 · Charging complete',message:'Battery 67%, range 81 km.',icon:'mdi:battery-check-outline',status:'test',deliveries:[{device:'notify.replacement_phone',status:'accepted'}]}));
     const activityPage=(limit=5,before=null)=>{const start=before?window.activityRows.findIndex(row=>row.id===before)+1:0,rows=structuredClone(window.activityRows.slice(start,start+limit)),has_more=start+rows.length<window.activityRows.length;return {rows,total:window.activityRows.length,has_more,next_before:has_more?rows.at(-1)?.id:null};};
     if(m.op==="notifications_get"){const activity=activityPage();return {live_supported:true,value:structuredClone(window.localNotifications||{enabled:false,rules:[]}),history:activity.rows,activity,recipients:[{svc:'notify.replacement_phone',name:'Current iPhone',tracker:'device_tracker.current_phone',legacy_service:'mobile_app_phone'},{svc:'notify.another_users_android',name:'Another user’s Android',tracker:'',legacy_service:'mobile_app_android'}]};}
     if(m.op==='notifications_history'){window.activityRequests=(window.activityRequests||0)+1;return activityPage(m.data.limit,m.data.before);}
     if(m.op==='notifications_history_delete'){window.activityRows=m.data.all?[]:window.activityRows.filter(row=>row.id!==m.data.id);return activityPage();}
     if(m.op==='notifications_live_test'||m.op==='notifications_live_stop_test'){window.liveRequests=(window.liveRequests||[]).concat(structuredClone(m));return {ended:m.op==='notifications_live_stop_test',deliveries:m.data.value.devices.map(device=>({device,status:'accepted'}))};}
     if(m.op==="notifications_set"){window.localNotifications=structuredClone(m.data.value);return {value:structuredClone(window.localNotifications)};}
     if(m.op==="notifications_preview"||m.op==="notifications_test"){if(m.op==="notifications_test")window.localTestSends=(window.localTestSends||0)+1;return {active:false,title:m.data.rule.title,message:m.data.rule.message,deliveries:m.data.rule.devices.map(device=>({device,status:'accepted'}))};}
     if(m.op==='sessions_import'){if(m.data.sync_complete)window.forceRecorderSync=false;window.importedRows=window.importedRows||[];for(const row of m.data.rows)if(!window.importedRows.some(r=>r.s===row.s))window.importedRows.push({...row,live:false});return {imported:m.data.rows.length};}
     if(m.op==='sessions_page'){
       const sort=m.data.sort||'newest',compare=(a,b)=>{if(sort==='oldest')return a.s-b.s;if(sort==='newest')return b.s-a.s;const ac=a.pricing?.cost,bc=b.pricing?.cost;if(ac==null||bc==null)return (ac==null)-(bc==null)||b.s-a.s;return (sort==='highest'?bc-ac:ac-bc)||b.s-a.s;};
       const rows=(window.pageRows||await hass.callWS({...m,op:'sessions',data:{}})).map(r=>{const assignment=window.costs.sessions[String(Math.round(r.s/1000))]||r.assignment,id=assignment?.profile?.id;return {...r,assignment,profile_removed:!!id&&id!=='manual'&&!window.costs.profiles.some(p=>p.id===id)};}).filter(r=>!m.data.location||(m.data.location==='__unset__'?!r.assignment?.profile?.id:r.assignment?.profile?.id===m.data.location)).sort(compare);
       const cursor=m.data.before==null?null:typeof m.data.before==='object'?{s:m.data.before.start,pricing:{cost:m.data.before.cost}}:{s:m.data.before};
       const filtered=cursor?rows.filter(row=>compare(row,cursor)>0):rows,items=filtered.slice(0,m.data.limit),hasMore=filtered.length>items.length,last=items.at(-1);
       return {sort,curves_synced:1,recorder_synced:window.forceRecorderSync?0:Date.now()/1000,rows:structuredClone(items),total:rows.length,locations:window.costs.profiles.map(p=>({id:p.id,name:p.name})),has_more:hasMore,next_before:hasMore?(['highest','lowest'].includes(sort)?{start:last.s,cost:last.pricing?.cost??null}:last.s):null};
     }
     if(m.op==='session_curve')return {start:Date.now()-3600000,end:Date.now(),session_id:m.data.session_id,series:{ac:[{lu:(Date.now()-3600000)/1000,s:'8'},{lu:(Date.now()-1800000)/1000,s:'16'}],dc:[],battery:[]}};
     if(m.op==='charging_dashboard'){const rows=(window.pageRows||await hass.callWS({...m,op:'sessions',data:{}})).filter(r=>!r.live),priced=rows.filter(r=>r.pricing?.cost!=null);return {total:rows.length,priced:priced.length,unpriced:rows.length-priced.length,cost:priced.reduce((sum,r)=>sum+r.pricing.cost,0),energy:rows.reduce((sum,r)=>sum+(r.pricing?.energy??r.kwh??0),0),chart_rows:rows};}
     if(m.op==="list")return [{id:"car",name:"Deepal S05",config:window.common,views:Object.keys(window.views).map(id=>({id,name:window.viewNames[id]||id,revision}))}];
     if(m.op==="config_get"){const value=structuredClone(config(m));if(window.delayGet?.[m.view_id])await new Promise(r=>setTimeout(r,window.delayGet[m.view_id]));return value;}
     if(m.op==="config_patch"){if(window.delayPatchMS)await new Promise(r=>setTimeout(r,window.delayPatchMS));if(m.data.reset)window.views[m.view_id]={};for(const[k,v]of Object.entries(m.data.patch||{}))(shared.has(k)?window.common:window.views[m.view_id])[k]=v;revision++;queueMicrotask(()=>window.subscribers.forEach(fn=>fn({vehicle_id:"car"})));return config(m);}
     if(m.op==="costs_get")return {value:structuredClone(window.costs)};
     if(m.op==="costs_set"){if(window.failCostSave)throw Error("Simulated storage failure");if(m.data.changes){if(m.data.changes.profiles)window.costs.profiles=structuredClone(m.data.changes.profiles);Object.assign(window.costs.sessions,structuredClone(m.data.changes.sessions||{}));}else window.costs=structuredClone(m.data.value);publish();return {};}
     if(m.op==='charge_prompt_dismiss'){window.dismissedPrompts=[...(window.dismissedPrompts||[]),m.data.session_id];publish();return {};}
     if(m.op==='charge_profile_assign'){const p=window.promptFixture,profile=window.costs.profiles.find(p=>p.id===m.data.profile_id);if(!p||p.id!==m.data.session_id||!profile)throw Error('Unknown charge/profile');window.costs.sessions[String(Math.round(p.s/1000))]={start:p.s,capacity:18.4,profile:structuredClone(profile)};publish();return {};}
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
  assert.equal(await page.evaluate(()=>document.getElementById("mobile")._el.nfbell.hidden),false,"Visible bell must not depend on push delivery being configured");
  await page.evaluate(()=>{const card=document.getElementById("mobile");for(let i=0;i<3;i++){card._built=false;card._force();}});
  assert.equal(await page.evaluate(()=>!!document.getElementById("mobile")._el.nfbell.querySelector("svg")),true,"Bell icon must survive rebuilds");
  await page.evaluate(()=>window.testHass.callWS({type:"deepal_companion/request",op:"config_patch",vehicle_id:"car",view_id:"mobile",data:{patch:{top_buttons_hidden:["bell"]}}}));
  await page.waitForFunction(()=>document.getElementById("mobile")._el.nfbell.hidden);
  assert.equal(await page.evaluate(()=>document.getElementById("tablet")._el.nfbell.hidden),false,"Layout hiding must remain independent per card profile");
  await page.evaluate(()=>window.testHass.callWS({type:"deepal_companion/request",op:"config_patch",vehicle_id:"car",view_id:"mobile",data:{patch:{top_buttons_hidden:[]}}}));
  await page.waitForFunction(()=>!document.getElementById("mobile")._el.nfbell.hidden);
  await page.evaluate(()=>{
    const host=document.createElement("div");host.id="layout-check";host.style.width="1100px";document.body.append(host);
    for(const view_id of ["mobile","tablet","energy"]){const card=document.createElement("deepal-companion-card");card.id="layout-"+view_id;card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id});host.append(card);card.hass=window.testHass;}
  });
  await page.waitForFunction(()=>["mobile","tablet","energy"].every(id=>document.getElementById("layout-"+id)._built));
  const widths=await page.evaluate(()=>["mobile","tablet","energy"].map(id=>Math.round(document.getElementById("layout-"+id).getBoundingClientRect().width)));
  assert.deepEqual(widths,[480,960,720]);
  assert.equal(await page.evaluate(()=>{const root=document.getElementById("layout-tablet").shadowRoot;return root.querySelector(".stats").getBoundingClientRect().left>root.querySelector(".hero").getBoundingClientRect().left+300;}),true);
  assert.equal(await page.evaluate(()=>{const root=document.getElementById("layout-energy").shadowRoot;return root.querySelector(".stats").getBoundingClientRect().top<root.querySelector(".hero").getBoundingClientRect().top;}),true);
  await page.evaluate(()=>document.getElementById("layout-check").remove());
  await page.evaluate(()=>document.getElementById("mobile")._patch({car_color:"blue",hero_space:"airy",charge_fx:"flow",target_style:"bar",lvl_green:"#22cc99"}));
  await page.waitForFunction(()=>window.views.mobile.car_color==="blue"&&!document.getElementById("mobile")._compDirty);
  assert.equal(await page.evaluate(()=>document.getElementById("tablet")._c.car_color),"white");
  assert.equal(await page.evaluate(()=>document.getElementById("energy")._c.car_color),"silver");
  await page.evaluate(()=>document.getElementById("mobile")._patch({battery_kwh:20}));
  await page.waitForFunction(()=>document.getElementById("tablet")._c.battery_kwh===20);
  assert.equal(await page.evaluate(()=>window.calls.filter(m=>m.type==="lovelace/config/save").length),0);
  /* The Settings popup is gone from the card: the round gear opens the Companion dashboard instead. */
  assert.equal(await page.evaluate(()=>document.getElementById("mobile")._el.foot.hidden),false,"Administrators see the Settings gear");
  await page.evaluate(()=>document.getElementById("mobile")._el.foot.click());
  await page.waitForFunction(()=>location.pathname==="/deepal-companion");
  assert.equal(await page.evaluate(()=>!document.getElementById("mobile")._setEl),true,"The card no longer opens a settings popup");
  await page.evaluate(()=>history.replaceState(null,"","/"));
  await page.evaluate(()=>{const c=document.getElementById("mobile");c._closeSheet();c._view="iso";c._force();});
  await page.waitForFunction(()=>document.getElementById("mobile").shadowRoot.querySelectorAll(".tp[data-t]").length===4);
  await page.evaluate(()=>{const c=document.getElementById("mobile");c._view=null;c._enSheet=true;c._force();});
  await page.waitForFunction(()=>!!document.getElementById("mobile").shadowRoot.querySelector(".cc-summary"));
  await page.evaluate(()=>{window.archiveEmpty=true;window.recorderOnly=true;window.importedRows=[];window.forceRecorderSync=true;document.getElementById("mobile").shadowRoot.querySelector('[data-en-mode="costs"]').click();});
  await page.waitForFunction(()=>!!document.getElementById("mobile").shadowRoot.querySelector(".cc-session"));
  await page.evaluate(()=>document.getElementById("mobile").shadowRoot.querySelector(".cc-session").click());
  assert.equal(await page.evaluate(()=>document.getElementById("mobile").shadowRoot.querySelector(".cc-editor").previousElementSibling.matches(".cc-session-row")),true);
  assert.equal(await page.evaluate(()=>document.getElementById("mobile").shadowRoot.querySelectorAll(".cc-chart svg").length),2);
  assert.equal(await page.evaluate(()=>document.getElementById("mobile").shadowRoot.querySelector(".en-cost-list").textContent.includes("60%")),true);
  await page.evaluate(()=>{const form=document.getElementById("mobile").shadowRoot.querySelector('.cc-editor form');const select=form.elements.profile;select.value="work";select.dispatchEvent(new Event("change",{bubbles:true}));form.querySelector('[data-cc="save-session"]').click();});
  try { await page.waitForFunction(()=>document.getElementById("mobile").shadowRoot.querySelector(".cc-session").textContent.includes("€0.00"),null,{timeout:5000}); }
  catch(error){console.log('CARD_COST_FAILURE',await page.evaluate(()=>({text:document.getElementById('mobile').shadowRoot.querySelector('.cc-session')?.textContent,status:document.getElementById('mobile').shadowRoot.querySelector('.cc-editor [role=status]')?.textContent,saved:window.costs,lastCalls:window.calls.slice(-8),form:document.getElementById('mobile').shadowRoot.querySelector('.cc-editor form')?.innerHTML})));throw error;}
  await page.evaluate(()=>{window.costs.sessions={};window.archiveEmpty=false;window.recorderOnly=false;});
  await page.evaluate(()=>{
    const spacer=document.createElement("div");spacer.id="scroll-test";spacer.style.height="1800px";document.body.append(spacer);
    const menu=document.createElement("button");menu.id="outside-menu";menu.textContent="HA menu";menu.style="position:fixed;right:4px;top:4px;z-index:2";menu.onclick=()=>window.menuClicked=true;document.body.append(menu);
  });
  await page.mouse.move(1435,650);await page.mouse.wheel(0,220);
  await page.waitForTimeout(100);
  if(!await page.evaluate(()=>scrollY>0))console.log('SCROLL_BLOCK',await page.evaluate(()=>{let node=document.elementFromPoint(1420,650);const path=[],seen=new Set();while(node&&!seen.has(node)){seen.add(node);path.push({tag:node.tagName,cls:node.className,scroll:node.scrollHeight,client:node.clientHeight,overflow:getComputedStyle(node).overflow,overscroll:getComputedStyle(node).overscrollBehavior});node=node.shadowRoot?.elementFromPoint(1420,650);}return {path,body:document.body.scrollHeight,root:document.documentElement.scrollHeight,client:innerHeight,overflow:getComputedStyle(document.body).overflow};}));
  await page.waitForFunction(()=>scrollY>0);
  await page.locator("#outside-menu").click();
  assert.equal(await page.evaluate(()=>window.menuClicked),true);
  assert.equal(await page.evaluate(()=>document.getElementById("mobile")._popupBox()),null);
  await page.evaluate(()=>{document.querySelector("#scroll-test").remove();document.querySelector("#outside-menu").remove();scrollTo(0,0);});
  const history=await page.evaluate(()=>window.calls.filter(m=>m.op==="sessions").length);assert(history>0);
  /* The bell opens a notifications popup on the card and no longer leaves the dashboard. */
  await page.evaluate(()=>{const card=document.getElementById('mobile');card._closeSheet();card._el.nfbell.click();});
  await page.waitForFunction(()=>{const c=document.getElementById('mobile');return c._nfSheet&&c._el.sheet.classList.contains('show')&&!!c._el.box.querySelector('.nfpanel');});
  assert.equal(await page.evaluate(()=>location.pathname+location.hash),'/');
  await page.evaluate(()=>document.getElementById('mobile')._closeSheet());
  assert.equal(await page.evaluate(()=>document.getElementById('mobile')._nfSheet),false);
  await page.evaluate(()=>{const editor=document.createElement("deepal-companion-card-editor");editor.id="full-editor";editor.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"mobile"});document.querySelector("#editor").append(editor);editor.hass=window.testHass;});
  await page.waitForFunction(()=>document.getElementById("full-editor")._editorLoaded);
  await page.evaluate(()=>document.getElementById('full-editor')._s._setTab('vehicle'));
  for(const language of ['el','es','en']){
    await page.evaluate(language=>{window.testHass.locale.language=language;document.getElementById('full-editor').hass=window.testHass;},language);
    await page.waitForFunction(language=>{
      const label=document.getElementById('full-editor')._s.shadowRoot.querySelector('[data-tab=vehicle]').textContent.trim();
      return language==='en'?label==='Advanced':label!=='Advanced';
    },language);
    await page.waitForTimeout(100);
    const label=await page.evaluate(()=>document.getElementById('full-editor')._s.shadowRoot.querySelector('[data-tab=vehicle]').textContent.trim());
    assert.equal(/[\u0370-\u03ff]/.test(label),language==='el','Language-specific tab labels');
  }
  await page.evaluate(()=>{
    const editor=document.getElementById("full-editor");window.testHass.locale.language="el";editor.hass=window.testHass;window.testHass.locale.language="en";editor.hass=window.testHass;
  });
  await page.waitForFunction(()=>document.getElementById("full-editor")._s.shadowRoot.textContent.includes("If an entity has a different name"));
  assert.equal(await page.evaluate(()=>[...document.getElementById("full-editor")._s.shadowRoot.querySelectorAll('select[data-set="_mkey"] option')].find(n=>n.value==="binary_sensor.charger_plugged").textContent),"S05 Charger plugged in");
  await page.evaluate(()=>{
    if(!customElements.get("ha-selector"))customElements.define("ha-selector",class extends HTMLElement{});
    document.getElementById("full-editor")._s._render();
    const widget=document.getElementById("full-editor")._s,key=widget.shadowRoot.querySelector('[data-set="_mkey"]');key.value="binary_sensor.charger_plugged";key.dispatchEvent(new Event("change"));
    const picker=widget.shadowRoot.querySelector("ha-selector[data-entity-mapping]");
    if(picker.selector.entity.domain!=="binary_sensor")throw Error("Incorrect entity selector domain");
    picker.dispatchEvent(new CustomEvent("value-changed",{detail:{value:"binary_sensor.s05_charger_plugged"},bubbles:true}));widget.shadowRoot.querySelector("[data-addent]").click();
  });
  await page.waitForFunction(()=>window.common.entities["binary_sensor.charger_plugged"]==="binary_sensor.s05_charger_plugged");
  const editorTabs=await page.evaluate(()=>document.getElementById("full-editor")._s.shadowRoot.querySelectorAll("[data-tab]").length);assert.equal(editorTabs,7);
  await page.evaluate(()=>document.getElementById("full-editor")._s.onPatch({car_color:"grey"}));
  await page.waitForFunction(()=>window.views.mobile.car_color==="grey");
  await page.evaluate(()=>{
    const editor=document.getElementById("full-editor"),preview=document.createElement("deepal-companion-card");
    preview.id="editor-preview";preview.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"mobile"});document.querySelector("#editor").append(preview);preview.hass=window.testHass;
    editor.addEventListener("config-changed",event=>{preview.setConfig(event.detail.config);preview.hass=window.testHass;});
  });
  await page.locator("#full-editor [data-companion-view=tablet]").click();
  await page.waitForFunction(()=>document.getElementById("editor-preview")._c?.car_color==="white");
  await page.locator("#full-editor [data-companion-view=energy]").click();
  await page.waitForFunction(()=>document.getElementById("editor-preview")._c?.car_color==="silver");
  assert.equal(await page.evaluate(()=>document.getElementById("full-editor")._s.shadowRoot.querySelectorAll("[data-tab]").length),7);
  await page.evaluate(()=>{
    window.delayPatchMS=120;
    const card=document.createElement("deepal-companion-card");card.id="race-card";card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"mobile"});document.body.append(card);card.hass=window.testHass;
  });
  await page.waitForFunction(()=>!!document.getElementById("race-card")._c);
  await page.evaluate(()=>{const card=document.getElementById("race-card");card._patch({car_color:"blue"});card._doSaveYaml();card._patch({hero_space:"compact"});card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"tablet"});});
  await page.waitForFunction(()=>!document.getElementById("race-card")._compWriteQueues?.size&&window.views.mobile.hero_space==="compact");
  assert.equal(await page.evaluate(()=>document.getElementById("race-card")._c.car_color),"white","Late save must not replace the selected profile");
  assert.equal(await page.evaluate(()=>window.views.tablet.car_color),"white");
  await page.evaluate(async()=>{window.delayPatchMS=0;window.delayGet={mobile:150};const card=document.getElementById("race-card");card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"mobile"});await new Promise(r=>setTimeout(r,5));card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"energy"});await new Promise(r=>setTimeout(r,200));});
  assert.equal(await page.evaluate(()=>document.getElementById("race-card")._c.car_color),"silver","Late read must not replace the selected profile");
  await page.evaluate(()=>{window.delayGet={};document.getElementById("race-card").remove();});
  await page.evaluate(()=>{document.getElementById("mobile")._closeSheet();document.querySelector("#cards").style.display="none";document.querySelector("#editor").style.display="none";});
  await page.addScriptTag({url:"/deepal_companion/frontend/companion-panel.js",type:"module"});
  await page.waitForFunction(()=>!!customElements.get("deepal-companion-panel"));
  await page.evaluate(()=>{const panel=document.createElement("deepal-companion-panel");document.querySelector("#panel").append(panel);panel.hass=window.testHass;});
  try{await page.waitForFunction(()=>!!document.querySelector("deepal-companion-panel").settings?._cfg);}catch(error){console.error('Panel boot:',await page.evaluate(()=>({message:document.querySelector('deepal-companion-panel').message,stage:document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.stage')?.textContent})));throw error;}
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").shadowRoot.querySelectorAll("deepal-companion-card").length),1);
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").settings.shadowRoot.querySelectorAll("[data-tab]").length),7);
  const p=page.locator("deepal-companion-panel");
  if(process.env.NOTIFY_MOBILE_ONLY){await require('./test_notification_mobile.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.NOTIFY_PERSISTENCE_ONLY){await require('./test_notification_persistence.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.CHARGING_BLOCKS_ONLY){await require('./test_charging_blocks.cjs')(page);await require('./test_charge_reminder.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.CHARGING_EDITS_ONLY){await require('./test_charging_edits.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.FIRST_RUN_ONLY){await require('./test_first_run.cjs')(page);await require('./test_image_loading.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.TILE_ONLY){await require('./test_tile_settings.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.MEMORY_ONLY){await require('./test_memory.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.MOBILE_SHELL_ONLY){await require('./test_mobile_shell.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.FEATURE_ONLY){await require('./test_feature_updates.cjs')(page);assert.equal(errors.length,0,errors.join('\n'));return;}
  if(process.env.QA_ONLY){await require("./test_field_choices.cjs")(page);await require("./test_end_user_qa.cjs")(page);return;}
  if(process.env.NAV_ONLY){await require("./test_boot_loading.cjs")(page);await require("./test_preview_controls.cjs")(page);await require("./test_tab_navigation.cjs")(page);await require("./test_local_notifications.cjs")(page);await require("./layout_validation.cjs")(page);return;}
  if(process.env.NOTIFY_ONLY){await require("./test_local_notifications.cjs")(page);return;}
  if(process.env.CHART_ONLY){await require("./test_charging_dashboard.cjs")(page);return;}
  if(process.env.FILTER_ONLY){await require("./test_session_filters.cjs")(page);return;}
  if(process.env.FIELD_ONLY){await require("./test_field_choices.cjs")(page);return;}
  await require("./settings_menus.cjs")(page);
  await require("./test_tile_settings.cjs")(page);
  await require("./test_preview_controls.cjs")(page);
  const controls=await p.locator(".profile-controls").evaluate(row=>({fields:[...row.querySelectorAll('input')].filter(n=>n.getClientRects().length).length,name:row.querySelector('.profile-name').getBoundingClientRect().bottom,actions:row.querySelector('.actions').getBoundingClientRect().top}));
  assert(controls.fields===1&&controls.actions>=controls.name,"One editable profile field sits above its actions");
  assert.equal(await p.locator('.profile-controls [data-action="rename"]').count(),0);
  const split=await p.evaluate(panel=>{const a=panel.shadowRoot.querySelector(".stage").getBoundingClientRect(),b=panel.shadowRoot.querySelector(".live-preview").getBoundingClientRect();return {share:a.width/(a.width+b.width),right:b.left>a.right};});
  assert(Math.abs(split.share-.65)<.01,"Desktop must allocate 65% to settings and 35% to preview");
  assert.equal(split.right,true,"Preview stays on the right");
  await page.evaluate(()=>window.previousWidget=document.querySelector("deepal-companion-panel").settings);
  await p.locator('[name="view"]').evaluate((select,value)=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true})),"tablet");
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").settings?._cfg?.car_color==="white");
  await page.evaluate(()=>window.previousWidget.onPatch({hero_space:"airy"}));
  await page.waitForFunction(()=>window.views.mobile.hero_space==="airy"&&!document.querySelector("deepal-companion-panel").pending);
  assert.notEqual(await page.evaluate(()=>window.views.tablet.hero_space),"airy","Detached settings must save to their original owner");
  await page.evaluate(()=>document.querySelector("deepal-companion-panel").settings.onPatch({hero_space:"compact"}));
  await page.waitForFunction(()=>window.views.tablet.hero_space==="compact");
  await page.waitForFunction(()=>document.getElementById("tablet")._c.hero_space==="compact");
  await page.waitForFunction(()=>{
    const p=document.querySelector("deepal-companion-panel"),f=p.shadowRoot.querySelector(".preview-window"),r=p.preview.getBoundingClientRect(),b=f.getBoundingClientRect();
    return b.height>0&&r.bottom<=b.bottom+1&&r.right<=b.right+1&&r.left>=b.left-1;
  });
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector("deepal-companion-panel").shadowRoot.querySelector(".preview-window")).overflow),"hidden");
  assert.equal(await p.locator("details.profile-management,.vehicle-management").count(),0);
  await p.locator('[data-action="duplicate"]').click();
  await page.waitForFunction(()=>Object.keys(window.views).length===4);
  await p.locator('[data-mode="chargers"]').click();
  await p.locator(".cc-profile").first().waitFor({state:"attached"});
  assert.equal(await p.locator(".cc-profile").count(),5);
  assert.equal(await p.locator(".cc-location-details[open]").count(),0,"Locations initially collapsed");
  await require("./test_charger_cancel.cjs")(page);
  const work=p.locator('.cc-profile[data-index="1"]');
  await work.locator('..').locator('summary').click();
  assert.equal(await work.locator(".cc-paid").isVisible(),false);
  await work.locator('[name="free"]').uncheck();assert.equal(await work.locator(".cc-paid").isVisible(),true);
  await work.locator('[name="free"]').check();assert.equal(await work.locator(".cc-paid").isVisible(),false);
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").costs.dirty),false,"Reverted checkbox must not be dirty");
  await work.locator('[name="free"]').uncheck();
  await p.locator('[data-mode="history"]').click();
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").mode==="history"&&window.costs.profiles[1].free===false);
  assert.equal(await p.locator(".status").evaluate(n=>getComputedStyle(n).borderTopStyle),"solid");
  await p.locator('[data-mode="chargers"]').click();await p.locator('.cc-location-details').first().waitFor();
  await work.locator('..').locator('summary').click();
  await work.locator('[name="free"]').check();
  await page.waitForFunction(()=>window.costs.profiles[1].free===true);
  await page.screenshot({path:path.resolve(__dirname,"../charging-profiles-preview.png"),fullPage:true});
  await p.locator('.cc-location-details').first().locator('summary').click();
  await p.locator(".cc-profile").first().locator('[name="price"]').fill("0.25");
  await p.locator('[data-mode="history"]').click();
  await page.waitForFunction(()=>window.costs.profiles[0].price===.25);
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").message==="Saved");
  assert.equal(await p.locator(".status").isVisible(),true);
  assert.equal(await p.locator(".status").evaluate(n=>getComputedStyle(n).position),"fixed");
  await page.waitForTimeout(1100);assert.equal(await p.locator(".status").isVisible(),true,"Save pill must remain readable");
  await page.waitForFunction(()=>!document.querySelector("deepal-companion-panel").message);
  await page.evaluate(()=>{window.archiveEmpty=true;window.recorderOnly=true;});
  await p.locator('[data-mode="chargers"]').click();
  await p.locator(".cc-profile").first().waitFor({state:"attached"});
  await p.locator('[data-mode="history"]').click();await p.locator(".archive .charge-session-list").waitFor();
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").archiveRows?.length>0&&!document.querySelector("deepal-companion-panel").recorderRecovery);
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").archiveRows[0].origin),"recorder","Existing Recorder charge must show before any Companion charge exists");
  assert.equal(await p.locator(".charge-session").count(),1);
  await p.locator(".history-line-chart svg.en-ch").waitFor();
  await p.locator(".history-line-chart svg.en-ch").hover();
  assert.equal(await p.locator(".history-line-chart .en-tip").isVisible(),true);
  await p.locator(".cc-chart svg").first().hover();
  assert.equal(await p.locator(".cc-chart-tip").isVisible(),true);
  assert((await p.locator(".cc-chart-tip").textContent()).includes("kWh"));
  assert.equal(await p.locator('[data-action="export"]').isVisible(),false);
  await p.locator('[data-action="data-menu"]').click();
  assert.equal(await p.locator('[data-action="export"]').isVisible(),true);
  await p.locator('[data-action="data-menu"]').click();
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);
  await page.screenshot({path:path.resolve(__dirname,"../costs-dashboard-overview.png"),fullPage:true});
  await p.locator('[data-action="data-menu"]').click();await p.locator('[data-action="sync-recorder"]').click();await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").archiveRows.length>0);
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").archiveRows[0].pricing.energy),8);
  const dedup=await page.evaluate(async()=>{window.archiveEmpty=false;window.archiveUsesNative=true;const r=await window.__DEEPAL_COMPANION_ENERGY.loadChargingSessions(document.querySelector("deepal-companion-panel").context);return {count:r.rows.length,origin:r.rows[0].origin};});
  assert.equal(dedup.count,1,"Overlapping Recorder and archive sessions must appear once");assert.equal(dedup.origin,undefined);
  await page.evaluate(()=>{window.recorderOnly=false;window.archiveUsesNative=false;window.recorderFails=true;const context=document.querySelector("deepal-companion-panel").context;context._recorderCharges=null;});
  const failed=await page.evaluate(async()=>window.__DEEPAL_COMPANION_ENERGY.loadChargingSessions(document.querySelector("deepal-companion-panel").context));
  assert.equal(failed.rows.length,1);assert(failed.warning.includes("could not be loaded"));
  await page.evaluate(()=>window.recorderFails=false);
  await p.locator('[data-mode="chargers"]').click();await p.locator(".cc-profile").first().waitFor({state:"attached"});
  await p.locator('[data-mode="history"]').click();await p.locator(".archive .charge-session-list").waitFor();
  assert.equal(await p.locator(".cc-chart svg").count(),2);
  await p.locator('[data-action="edit-session"]').first().click();
  await p.locator('.history-editor [name=profile]').evaluate((select,value)=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true})),"work");
  await page.evaluate(()=>window.failCostSave=true);
  await p.locator('.history-editor [data-cc="save-session"]').click();
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").costs.message.includes("failed"));
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").costs.dirty),true);
  assert.equal(await page.evaluate(()=>Object.keys(window.costs.sessions).length),0);
  await page.evaluate(()=>window.failCostSave=false);
  await p.locator('.history-editor [data-cc="save-session"]').click();
  await page.waitForFunction(()=>Object.values(window.costs.sessions).some(r=>r.profile.id==="work"));
  await p.locator(".session-price-dialog").waitFor({state:"detached"});
  await p.locator('[data-action="edit-session"]').first().click();
  await p.locator('.history-editor [name=profile]').evaluate((select,value)=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true})),"__manual__");
  await p.locator('.history-editor [name=total]').fill("12.50");
  await p.locator('.history-editor [data-cc="save-session"]').click();
  await page.waitForFunction(()=>Object.values(window.costs.sessions).some(r=>r.profile.id==="manual"&&r.total===12.5));
  assert.equal(await page.evaluate(()=>window.costs.profiles.some(p=>p.id==="manual")),false);
  await page.waitForFunction(()=>document.querySelector("deepal-companion-panel").costGraph.textContent.includes("12.5"));
  await page.screenshot({path:path.resolve(__dirname,"../charging-costs-preview.png"),fullPage:true});
  await p.locator(".session-price-dialog").waitFor({state:"detached"});
  await p.locator('[data-mode="settings"]').click();
  await page.waitForFunction(()=>!!document.querySelector("deepal-companion-panel").settings?._cfg);
  await page.waitForTimeout(300);
  assert.notEqual(await p.locator(".profile-controls [data-action=create]").evaluate(n=>getComputedStyle(n).backgroundColor),"rgba(0, 0, 0, 0)");
  await page.screenshot({path:path.resolve(__dirname,"../companion-desktop-preview.png"),fullPage:true});
  await page.setViewportSize({width:430,height:900});
  await page.waitForFunction(()=>{
    const p=document.querySelector("deepal-companion-panel"),f=p.shadowRoot.querySelector(".preview-window"),r=p.preview.getBoundingClientRect(),b=f.getBoundingClientRect();
    return b.height>0&&r.bottom<=b.bottom+1&&r.right<=b.right+1&&r.left>=b.left-1;
  });
  await page.evaluate(()=>{document.querySelector("#cards").style.display="none";document.querySelector("#editor").style.display="none";});
  await page.screenshot({path:path.resolve(__dirname,"../companion-app-preview.png"),fullPage:true});
  assert.equal(await page.evaluate(()=>document.querySelector("deepal-companion-panel").preview.inert),true);
  assert.equal(await page.evaluate(()=>!!document.querySelector("deepal-companion-panel").preview._el.nfbell.querySelector("svg")),true);
  assert.equal(await page.evaluate(()=>!!document.querySelector("deepal-companion-panel").preview._nfT),false,"Preview must not poll or mark notification history");
  assert.equal(await page.evaluate(()=>!!document.querySelector("deepal-companion-panel").preview._nfS),false);
  assert.equal(await p.locator(".workflow li").count(),0);
  assert.equal(await p.locator(".dashboard-guide,.legacy-card-note").count(),0);
  assert.equal(await p.locator("header [data-action=add-dashboard]").count(),1);
  await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.stage').classList.contains('is-loading'));
  assert.deepEqual(await page.evaluate(()=>[...document.querySelector("deepal-companion-panel").shadowRoot.querySelector("main").children].map(n=>n.className)),["box profile-setup","box live-preview","stage"]);
  assert.equal(await page.evaluate(()=>window.serviceCalls.length),0);
  await require("./test_charging_dashboard.cjs")(page);
  await require("./test_charging_edits.cjs")(page);
  await require("./test_charging_blocks.cjs")(page);
  await require("./test_first_run.cjs")(page);
  await require("./test_image_loading.cjs")(page);
  await require("./test_charge_reminder.cjs")(page);
  await require("./test_dashboard_add.cjs")(page);
  await require("./test_local_notifications.cjs")(page);
  await require("./test_notification_persistence.cjs")(page);
  await require("./test_notification_mobile.cjs")(page);
  await require("./test_field_choices.cjs")(page);
  await require("./test_energy_loading.cjs")(page);
  await require("./test_end_user_qa.cjs")(page);
  await require("./test_feature_updates.cjs")(page);
  await require("./test_session_filters.cjs")(page);
  await require("./settings_roundtrip.cjs")(page);
  await require("./layout_validation.cjs")(page);
  await require("./test_mobile_shell.cjs")(page);
  await require("./test_tab_navigation.cjs")(page);
  const before=await page.evaluate(()=>window.subscribers.length);
  await page.evaluate(()=>document.querySelector("deepal-companion-panel").remove());
  await page.waitForTimeout(100);
  assert((await page.evaluate(()=>window.subscribers.length))<before,"Panel must unsubscribe on removal");
  const baseline=await page.evaluate(()=>({subscriptions:subscribers.length,intervals:activeIntervals.size}));
  for(let i=0;i<5;i++){
    await page.evaluate(()=>{const panel=document.createElement("deepal-companion-panel");document.querySelector("#panel").append(panel);panel.hass=window.testHass;});
    await page.waitForFunction(()=>!!document.querySelector("deepal-companion-panel")?.preview);
    await page.evaluate(()=>document.querySelector("deepal-companion-panel").remove());
    await page.waitForTimeout(100);
  }
  assert.deepEqual(await page.evaluate(()=>({subscriptions:subscribers.length,intervals:activeIntervals.size})),baseline,"Repeated panel openings must release timers and subscriptions");
  assert.equal(errors.length,0,errors.join("\n"));
  console.log("PASS: retained card and 7 organized settings menus; 3 independent cards; visual card profile picker and native preview events; application settings without a card/modal; direct charger settings, profile duplication and archive.");
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
