/* Neon city: the car is grounded and lit by the scene in the 3/4, charging and top views, and only while the background is a Neon city. Everything is mocked. */
const fs=require("fs"),path=require("path"),http=require("http");
const repo=path.resolve(__dirname,"..");
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
    s["sun.sun"]=st("above_horizon",{elevation:-10});s["switch.s05_charge_schedule"]=st("on");s["time.s05_charge_schedule_start"]=st("23:00:00",{time_zone:"GMT+02:00"});s["time.s05_charge_schedule_end"]=st("07:00:00");window.calls=[];for(const [id,o] of Object.entries(s))o.entity_id=id;
    const hass={locale:{language:"en"},language:"en",user:{id:"a",is_admin:true},states:s,entities:{},devices:{},services:{},config:{time_zone:"UTC",unit_system:{temperature:"°C"}},connection:{subscribeMessage:async()=>()=>{}},callService:async(d,sv,x)=>{window.calls.push([d,sv,x])},callApi:async()=>({}),callWS:async m=>{if(m.type==="deepal_companion/request"&&m.op==="sessions")return [];if(m.type!=="deepal_companion/request")return {};if(m.op==="list")return [{id:"car",name:"Deepal S05"}];if(m.op==="config_get")return {vehicle_id:"car",view_id:"shot",hero_sky:"neon-night",hero_style:"carview",view_name:"shot",revision:[1,1],config:{prefix:"s05",hero_style:"carview",hero_sky:"neon",car_color:"silver"},charge_prompt:null};return {};},themes:{darkMode:true}};
    const c=document.createElement("deepal-companion-card");c.style.display="block";c.style.width=vw+"px";document.getElementById("w").append(c);
    c.setConfig({type:"custom:deepal-companion-card",view_id:"shot",hero_sky:"neon-night",hero_style:"carview",info:["odometer","charge_plan"]});c.hass=hass;window.card=c;
   },{vw:390});
 await page.waitForTimeout(2500);
 const q=f=>page.evaluate(f);let fails=0;const ok=(n,c)=>{console.log(c?"ok  ":"FAIL",n);if(!c)fails++};
 const shown=sel=>page.evaluate(s=>{const e=card.shadowRoot.querySelector(s);return !!e&&getComputedStyle(e).display!=="none"},sel);
 ok("3/4 view: ground layer first, nothing drawn over the car", await q(()=>{const a=card.shadowRoot.querySelector(".cva"),k=[...a.children];return k[0].classList.contains("nfx-g")&&!a.querySelector(".nfx-o,.nf-grade,.nf-rim,.nf-bn")}));
 ok("3/4 view: cast shadow, contact shadows, and reflection exist", await q(()=>{const a=card.shadowRoot.querySelector(".cva");return !!a.querySelector(".nf-sh")&&!!a.querySelector(".nf-ao ellipse")&&!!a.querySelector(".nf-rf")}));
 ok("effects follow the car's own base image", await q(()=>[...card.shadowRoot.querySelectorAll(".cva image")].every(i=>/iso\/[a-z]+\/base\.webp/.test(i.getAttribute("href")))));
 ok("shown on a Neon city background", await shown(".cva .nfx-g"));
 ok("the real car images and handles are untouched", await q(()=>card.shadowRoot.querySelectorAll(".cva img").length>=5&&!!card.shadowRoot.querySelector(".cva .hdl")));
 ok("night shadow is softer-edged than afternoon", await q(()=>{const h=card.shadowRoot.querySelector(".hero"),g=()=>Number(getComputedStyle(h).getPropertyValue("--nf-sx"));h.dataset.sky="neon-night";const n=g();h.dataset.sky="neon-day";const d=g();h.dataset.sky="neon-night";return n<0&&d<0}));
 await q(()=>{card._c.hero_sky="off";card._force()});await page.waitForTimeout(600);
 ok("hidden on every other background", !(await shown(".cva .nfx-g")));
 await q(()=>{card._c.hero_sky="neon-night";card._force()});await page.waitForTimeout(600);
 await q(()=>{const h=card._hass;h.states={...h.states,"binary_sensor.s05_charger_plugged":{...h.states["binary_sensor.s05_charger_plugged"],state:"on"}};card.hass={...h}});await page.waitForTimeout(1500);
 ok("charging view: shadow and reflection under the base image", await q(()=>{const b=card.shadowRoot.querySelector(".cvb");return !!b&&b.firstElementChild.classList.contains("nfx-g")&&!!b.querySelector(".nf-rf")&&b.querySelector("img[data-n=base]")!==null&&b.querySelector("svg path.cb")!==null}));
 await q(()=>{const h=card._hass;h.states={...h.states,"binary_sensor.s05_charger_plugged":{...h.states["binary_sensor.s05_charger_plugged"],state:"off"}};card.hass={...h};card.shadowRoot.querySelector(".vtg")?.click()});await page.waitForTimeout(1500);
 ok("top view: silhouette shadow", await q(()=>{const t=card.shadowRoot.querySelector(".cvt");return !!t&&t.firstElementChild.classList.contains("nfx-g")&&t.querySelectorAll(".nf-sh,.nf-sh2").length===2&&/top\/[a-z]+\/base\.webp/.test(t.querySelector("image").getAttribute("href"))}));
 ok("no page errors", errs.length===0);if(errs.length)console.log(errs);
 await b.close();server.close();process.exit(fails?1:0)})();
