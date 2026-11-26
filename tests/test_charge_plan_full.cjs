const fs=require("fs"),path=require("path"),http=require("http");
const repo=path.resolve(__dirname,".."),outDir=process.argv[2]||null;
const {chromium}=require(path.join(repo,"node_modules/playwright-core"));
const base=path.join(repo,"custom_components/deepal_companion/frontend");
const mime={".js":"text/javascript; charset=utf-8",".css":"text/css",".svg":"image/svg+xml",".webp":"image/webp",".jpg":"image/jpeg",".png":"image/png"};
const server=http.createServer((q,r)=>{const u=new URL(q.url,"http://x");const rel=u.pathname.startsWith("/deepal_companion/frontend/")?u.pathname.slice(27):null;
 if(rel!==null){const f=path.resolve(base,rel);if(f.startsWith(base)&&fs.existsSync(f)){r.setHeader("Content-Type",mime[path.extname(f)]||"application/octet-stream");r.end(fs.readFileSync(f));return}r.writeHead(404);r.end();return}
 r.setHeader("Content-Type","text/html");r.end('<html><body style="margin:0;background:#17191c;color:#eee;font:14px Arial;--card-background-color:#232528;--primary-background-color:#17191c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#42464a;--primary-color:#29c99a"><div id="w" style="padding:16px;box-sizing:border-box"></div></body></html>')});

(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const b=await chromium.launch({headless:true});const page=await b.newPage({viewport:{width:422,height:1000}});const errs=[];page.on("pageerror",e=>errs.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port);await page.addScriptTag({url:"/deepal_companion/frontend/companion-card.js"});
 await page.evaluate(({vw})=>{
    const now=new Date().toISOString(),st=(v,a={})=>({state:String(v),attributes:a,last_changed:now,last_updated:now});
    const s={};for(const [k,v] of Object.entries({battery_level:79,remaining_range:95,fuel_range:498,fuel_level:53,total_odometer:2811,inside_temperature:26,outside_temperature:22,power_status:"off",license_plate:"TEST"}))s["sensor.s05_"+k]=st(v);
    s["lock.s05_doors"]=st("locked");s["cover.s05_windows"]=st("closed");s["cover.s05_trunk"]=st("closed");
    for(const k of ["front_left_door","front_right_door","rear_left_door","rear_right_door","hood","trunk","charger_plugged","charging","cloud_connection","climate_on","position_lamp","low_beam","high_beam"])s["binary_sensor.s05_"+k]=st(k==="cloud_connection"?"on":"off");
    s["sun.sun"]=st("above_horizon",{elevation:45});s["switch.s05_charge_schedule"]=st("on");s["switch.s05_charge_schedule_to_full"]=st("off");s["time.s05_charge_schedule_start"]=st("23:00:00",{time_zone:"GMT+02:00"});s["time.s05_charge_schedule_end"]=st("07:00:00");window.calls=[];for(const [id,o] of Object.entries(s))o.entity_id=id;
    const hass={locale:{language:"en"},language:"en",user:{id:"a",is_admin:true},states:s,entities:{},devices:{},services:{},config:{time_zone:"UTC",unit_system:{temperature:"°C"}},connection:{subscribeMessage:async()=>()=>{}},callService:async(d,sv,x)=>{window.calls.push([d,sv,x])},callApi:async()=>({}),callWS:async m=>{if(m.type==="deepal_companion/request"&&m.op==="sessions")return [];if(m.type!=="deepal_companion/request")return {};if(m.op==="list")return [{id:"car",name:"Deepal S05"}];if(m.op==="config_get")return {vehicle_id:"car",view_id:"shot",view_name:"shot",revision:[1,1],config:{prefix:"s05",hero_style:"carview",hero_sky:"neon",car_color:"silver"},charge_prompt:null};return {};},themes:{darkMode:true}};
    const c=document.createElement("deepal-companion-card");c.style.display="block";c.style.width=vw+"px";document.getElementById("w").append(c);
    c.setConfig({type:"custom:deepal-companion-card",view_id:"shot",info:["odometer","charge_plan"]});c.hass=hass;window.card=c;
   },{vw:390});
 await page.waitForTimeout(2000);

 const q=(f)=>page.evaluate(f);let fails=0;const ok=(n,c)=>{console.log(c?"ok  ":"FAIL",n);if(!c)fails++};
 await q(()=>{card._c.info=["odometer","charge_plan"];card._planSheet=true;card._planDraft=null;card._force()});await page.waitForTimeout(500);
 ok("pill shown, off, both time fields visible", await q(()=>{const s=card.shadowRoot;const f=s.querySelector("[data-plan-full]");return !!f&&f.getAttribute("aria-pressed")==="false"&&!!s.querySelector("[data-plan-t=start]")&&!!s.querySelector("[data-plan-t=end]")}));
 ok("Save plan is off while nothing differs from the car", await q(()=>card.shadowRoot.querySelector("[data-plan-save]").disabled===true));
 await page.evaluate(()=>card.shadowRoot.querySelector("[data-plan-sw]").click());await page.waitForTimeout(150);
 ok("turning the plan switch makes Save plan available, and turning it back switches it off again", await q(()=>{const b=card.shadowRoot.querySelector("[data-plan-save]"),on=b.disabled===false;card.shadowRoot.querySelector("[data-plan-sw]").click();return on&&b.disabled===true}));
 await q(()=>{const i=card.shadowRoot.querySelector("[data-plan-t=start]");i.value="22:30";i.dispatchEvent(new Event("input",{bubbles:true}))});
 ok("changing the start time enables Save plan", await q(()=>card.shadowRoot.querySelector("[data-plan-save]").disabled===false));
 await q(()=>{const i=card.shadowRoot.querySelector("[data-plan-t=start]");i.value="23:00";i.dispatchEvent(new Event("input",{bubbles:true}))});
 await page.evaluate(()=>card.shadowRoot.querySelector("[data-plan-full]").click());await page.waitForTimeout(300);
if(outDir)await page.screenshot({path:outDir+"/plan_full.png"});
 ok("pressing the pill swaps the end time for Until battery full / No cutoff and keeps Save enabled", await q(()=>{const s=card.shadowRoot;return !s.querySelector("[data-plan-t=end]")&&!!s.querySelector("[data-plan-t=start]")&&!!s.querySelector(".cpfb")&&s.querySelector(".cpfb").textContent.includes("Until full")&&s.querySelector(".cpfb").textContent.includes("No cutoff")&&s.querySelector("[data-plan-full]").getAttribute("aria-pressed")==="true"&&!s.querySelector("[data-plan-save]").disabled&&s.querySelector(".cpr").textContent.includes("Charging from 23:00 until full")}));
 await page.evaluate(()=>card.shadowRoot.querySelector("[data-plan-save]").click());await page.waitForTimeout(300);
 ok("saving calls the schedule, then turns the to-full switch on", await q(()=>JSON.stringify(window.calls)===JSON.stringify([["deepal","set_charge_schedule",{start_time:"23:00",end_time:"07:00",enabled:true}],["switch","turn_on",{entity_id:"switch.s05_charge_schedule_to_full"}]])));
 await q(()=>{window.calls.length=0;card._hass.states["switch.s05_charge_schedule_to_full"]={...card._hass.states["switch.s05_charge_schedule_to_full"],state:"on"};card._hass={...card._hass};card._planSheet=true;card._planDraft=null;card._force()});await page.waitForTimeout(500);
 ok("reopens pressed, no end field; tile reads From 23:00", await q(()=>{const s=card.shadowRoot;return s.querySelector("[data-plan-full]").getAttribute("aria-pressed")==="true"&&!s.querySelector("[data-plan-t=end]")&&card._planVal(true,"23:00","07:00",true)==="From 23:00"}));
 await page.evaluate(()=>card.shadowRoot.querySelector("[data-plan-full]").click());await page.waitForTimeout(300);
 ok("pressing the pill again brings the end time back", await q(()=>!!card.shadowRoot.querySelector("[data-plan-t=end]")));
 await page.evaluate(()=>card.shadowRoot.querySelector("[data-plan-save]").click());await page.waitForTimeout(300);
 ok("saving turns the to-full switch off", await q(()=>JSON.stringify(window.calls)===JSON.stringify([["deepal","set_charge_schedule",{start_time:"23:00",end_time:"07:00",enabled:true}],["switch","turn_off",{entity_id:"switch.s05_charge_schedule_to_full"}]])));
 await q(()=>{delete card._hass.states["switch.s05_charge_schedule_to_full"];card._hass={...card._hass};card._planSheet=true;card._planDraft=null;card._force()});await page.waitForTimeout(500);
 ok("without the switch entity the pill is hidden", await q(()=>!card.shadowRoot.querySelector("[data-plan-full]")&&!!card.shadowRoot.querySelector("[data-plan-t=end]")));
 ok("no page errors", errs.length===0);if(errs.length)console.log(errs);
 await b.close();server.close();process.exit(fails?1:0);})();
