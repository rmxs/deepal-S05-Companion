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
 const q=(f,a)=>page.evaluate(f,a);let fails=0;const ok=(n,c)=>{console.log(c?"ok  ":"FAIL",n);if(!c)fails++};
 /* a button that waits for the car: the effect needs room above the buttons and the waiting text must stay readable */
 for(const [lay,fx] of [["swipe","arc"],["swipe","pulse"],["swipe","neon"],["split","neon"],["grid","neon"]]){
  await q(([f,l])=>{card._c.button_layout=l;card._c.pending_fx=f;card._pending={lock:{before:"locked",t:Date.now()-12000,sent:false,timer:setTimeout(()=>{},1e6)}};card._force()},[fx,lay]);await page.waitForTimeout(400);
  const r=await q(()=>{const s=card.shadowRoot,a=s.querySelector(".act.pending"),cap=s.querySelector(".cap.s.wait");if(!a||!cap)return null;const box=a.closest(".actions.scroll,.actions.swipe .pages,.actions"),ab=a.getBoundingClientRect(),bb=box.getBoundingClientRect(),cs=getComputedStyle(box);return{text:cap.textContent,top:ab.top-bb.top,clips:/(auto|hidden|scroll)/.test(cs.overflowY),cut:cap.scrollWidth>cap.clientWidth+1||getComputedStyle(cap).textOverflow==="ellipsis"&&cap.scrollWidth>cap.clientWidth};});
  ok(lay+"/"+fx+": waiting button and its text are shown",!!r&&/Car waking up/.test(r.text));
  ok(lay+"/"+fx+": the text wraps instead of ending in …",!!r&&!r.cut);
  ok(lay+"/"+fx+": a clipping row leaves at least 12 px above the button for the effect",!!r&&(!r.clips||r.top>=12));
 }
 await q(()=>{for(const p of Object.values(card._pending))clearTimeout(p.timer);card._pending={}});
 console.log(errs.length?"page errors: "+errs.join(" | "):"no page errors");await b.close();server.close();process.exit(fails||errs.length?1:0);
})();
