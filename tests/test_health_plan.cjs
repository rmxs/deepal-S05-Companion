/* Health page: the charge plan row opens a box with the plans, the active plan and the plan log. Everything is mocked. */
const fs=require("fs"),path=require("path"),http=require("http");
const repo=path.resolve(__dirname,".."),outDir=process.argv[2]||null;
const {chromium}=require(path.join(repo,"node_modules/playwright-core"));
const base=path.join(repo,"custom_components/deepal_companion/frontend");
const mime={".js":"text/javascript; charset=utf-8",".css":"text/css",".svg":"image/svg+xml",".webp":"image/webp",".jpg":"image/jpeg",".png":"image/png"};
const server=http.createServer((q,r)=>{const u=new URL(q.url,"http://x");const rel=u.pathname.startsWith("/deepal_companion/frontend/")?u.pathname.slice(27):null;
 if(rel!==null){const f=path.resolve(base,rel);if(f.startsWith(base)&&fs.existsSync(f)){r.setHeader("Content-Type",mime[path.extname(f)]||"application/octet-stream");r.end(fs.readFileSync(f));return}r.writeHead(404);r.end();return}
 r.setHeader("Content-Type","text/html; charset=utf-8");r.end('<html><body style="margin:0;background:#17191c;color:#eee;font:14px Arial;--card-background-color:#232528;--primary-background-color:#17191c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#444;--secondary-background-color:#2c2e32"><div id="stage"></div></body></html>')});

(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1000,height:900}});const errs=[];page.on("pageerror",e=>errs.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port);await page.addScriptTag({url:"/deepal_companion/frontend/companion-card.js"});
 await page.evaluate(async()=>{
  const now=Math.floor(Date.now()/1000);
  window.calls=[];
  window.planView={available:true,shown:"2123564441486163970",active:["2123564441486163970"],switch:"on",mismatch:false,now,
   plans:[{id:"2123564441486163970",active:true,start:"01:00",end:"08:00",placeholder:false},{id:"1",active:false,start:"01:00",end:"23:00",placeholder:true}],
   log:[{time:now-5,source:"deepal",event:"plan_added",plan_id:"2123564441486163970",start:"01:00",end:"08:00",active:true},
        {time:now-8,source:"deepal",event:"plan_changed",plan_id:"2123564441486163970",start:"01:00",end:"08:00",active:false},
        {time:now-9,source:"ha",event:"state",entity:"switch.s05_charge_schedule",old:"off",new:"on"},
        {time:now-10,source:"ha",event:"service",service:"deepal.set_charge_schedule",entities:[],data:{start_time:"01:00",end_time:"08:00",enabled:true}},
        {time:now-20,source:"ha",event:"state"}]};
  window.health={status:"error",version:"1.0.1",checked:now,counts:{ok:2,warning:1,error:1},checks:[
   {id:"sensor_batt",status:"ok",title:"Battery level",detail:"sensor.s05_battery_level"},
   {id:"sensor_odo",status:"ok",title:"Odometer",detail:"sensor.s05_odometer"},
   {id:"sensor_ac",status:"error",title:"AC charge current",detail:"Sensor unavailable",fix:"Check the sensor in Home Assistant"},
   {id:"plan",status:"warning",title:"Charge plan",detail:"2 plans are active. The app shows only the newest one.",detail_key:"{0} plans are active. The app shows only the newest one.",args:["2"],fix:"Open this row to see the plans the car reports and the recent plan commands."}]};
  const panel={selected:{vehicle_id:"v1"},_hass:{locale:{language:"en",time_format:"24"},config:{time_zone:"Europe/Athens"},connection:{async subscribeMessage(cb,msg){window.push=cb;window.subMsg=msg;return()=>{window.unsubbed=true}}}},
   t:(key,...args)=>String(key).replace(/\{(\d+)\}/g,(_,i)=>args[i]),
   setHealthResult(){},
   async request(op){window.calls.push(op);if(op==="health_get")return structuredClone(window.health);if(op==="plan_debug_get")return structuredClone(window.planView);throw Error("Unexpected "+op);}};
  const {mountHealth}=await import("/deepal_companion/frontend/companion-health.js");
  const stage=document.getElementById("stage");window.stage=stage;window.panel=panel;
  window.handle=await mountHealth(panel,stage);
 });
 await page.waitForTimeout(300);
 const q=f=>page.evaluate(f);let fails=0;const ok=(n,c)=>{console.log(c?"ok  ":"FAIL",n);if(!c)fails++};
 const row=".health-row.health-click";
 ok("only the plan row is clickable",await q(()=>document.querySelectorAll(".health-row.health-click").length===1&&document.querySelector(".health-click strong").textContent==="Charge plan"&&document.querySelectorAll(".health-row[role=button]").length===1));
 ok("verdict card, three tiles and one Needs attention heading",await q(()=>!!document.querySelector(".health-verdict.health-error .health-chip")&&document.querySelectorAll(".health-tile").length===3&&[...document.querySelectorAll(".health-sec")].map(h=>h.firstChild.textContent).join()==="Needs attention"));
 ok("passing checks are one closed summary card, not loose rows",await q(()=>{const b=document.querySelector(".health-okcard-btn"),l=document.querySelector(".health-okcard-list");return !!b&&b.getAttribute("aria-expanded")==="false"&&/^2 checks passed$/.test(b.textContent.trim())&&!!l&&l.hidden&&getComputedStyle(l).display==="none"&&!document.querySelector(".health-list>.health-row.health-ok")}));
 ok("the failing check and the charge plan stay outside the passed card",await q(()=>{const ac=[...document.querySelectorAll(".health-row.health-error")],plan=document.querySelector(".health-click");return ac.length===1&&ac[0].querySelector("strong").textContent==="AC charge current"&&!ac[0].closest(".health-okcard")&&ac[0].getClientRects().length>0&&plan.parentElement.classList.contains("health-list")&&!plan.closest(".health-okcard")&&plan.getClientRects().length>0}));
 await page.click(".health-okcard-btn");await page.waitForTimeout(200);
 ok("opening the card shows the passed checks as compact rows with an OK chip",await q(()=>{const l=document.querySelector(".health-okcard-list"),rs=[...l.querySelectorAll(".health-row.health-compact")];return document.querySelector(".health-okcard-btn").getAttribute("aria-expanded")==="true"&&!l.hidden&&rs.length===2&&rs.every(r=>!!r.querySelector(".health-okchip")&&getComputedStyle(r.querySelector("p")||r).display!=="block")&&rs.map(r=>r.querySelector("strong").textContent).join()==="Battery level,Odometer"&&rs.every(r=>r.getClientRects().length>0)}));
 ok("the failing check and the charge plan are still visible with the card open",await q(()=>document.querySelector(".health-row.health-error").getClientRects().length>0&&document.querySelector(".health-click").getClientRects().length>0));
 await page.click(".health-okcard-btn");await page.waitForTimeout(200);
 ok("clicking the card again folds the passed checks away",await q(()=>document.querySelector(".health-okcard-btn").getAttribute("aria-expanded")==="false"&&document.querySelector(".health-okcard-list").hidden));
 await page.focus(".health-okcard-btn");await page.keyboard.press("Enter");await page.waitForTimeout(200);
 ok("Enter opens the passed card from the keyboard",await q(()=>document.querySelector(".health-okcard-btn").getAttribute("aria-expanded")==="true"&&document.activeElement===document.querySelector(".health-okcard-btn")));
 await page.keyboard.press("Space");await page.waitForTimeout(200);
 ok("Space closes it again",await q(()=>document.querySelector(".health-okcard-btn").getAttribute("aria-expanded")==="false"));
 await q(()=>{window.copied=null;Object.defineProperty(navigator,"clipboard",{value:{writeText:async t=>{window.copied=t}},configurable:true});document.querySelector(".health-copy").click()});await page.waitForTimeout(200);
 ok("Copy diagnostics copies a plain-text summary and shows Copied",await q(()=>/^Deepal Companion v1\.0\.1/.test(window.copied||"")&&window.copied.includes("[warning] Charge plan")&&document.querySelector(".health-copy").textContent==="Copied"));
 ok("closed at first, no plan request yet",await q(()=>!document.querySelector(".health-plan")&&document.querySelector(".health-click").getAttribute("aria-expanded")==="false"&&!window.calls.includes("plan_debug_get")));
 await page.click(row);await page.waitForTimeout(300);
 ok("click opens the box and loads it once",await q(()=>!!document.querySelector(".health-plan")&&window.calls.filter(c=>c==="plan_debug_get").length===1&&document.querySelector(".health-click").getAttribute("aria-expanded")==="true"));
 ok("box sits directly after the plan row",await q(()=>document.querySelector(".health-click").nextElementSibling===document.querySelector(".health-plan")));
 ok("facts show the shown plan, active count and switch",await q(()=>{const f=[...document.querySelectorAll(".health-plan-facts b")].map(b=>b.textContent);return f[0]==="01:00 - 08:00 (on)"&&f[1]==="1"&&f[2]==="on"}));
 ok("plan table lists both plans: the one HA follows first, the older record second",await q(()=>{const r=[...document.querySelectorAll(".health-plan tbody tr")].map(tr=>tr.textContent);return r.length===2&&r[0].includes("2123564441486163970 (HA, followed by the car)")&&r[0].includes("on")&&r[1].startsWith("1 (app or car, older record)")}));
 ok("log lists commands newest first with plain text",await q(()=>{const l=[...document.querySelectorAll(".health-log div")].map(d=>d.textContent);return l.length===5&&l[0].includes("Car plan added: 163970 01:00-08:00 (on)")&&l[1].includes("Car plan changed")&&l[2].includes("s05_charge_schedule: off > on")&&l[3].includes("deepal.set_charge_schedule")&&l[4].includes("?: ? > ?")}));
 ok("sources are labelled car or HA",await q(()=>[...document.querySelectorAll(".health-log em")].map(e=>e.textContent).join()==="car,car,HA,HA,HA"));
 await page.evaluate(()=>{document.querySelector(".health-click").focus()});await page.keyboard.press("Enter");await page.waitForTimeout(150);
 ok("Enter closes it",await q(()=>!document.querySelector(".health-plan")&&document.querySelector(".health-click").getAttribute("aria-expanded")==="false"));
 await page.keyboard.press("Space");await page.waitForTimeout(300);
 ok("Space opens it again",await q(()=>!!document.querySelector(".health-plan")));
 await q(()=>{window.planView.log.unshift({time:Math.floor(Date.now()/1000),source:"deepal",event:"plan_removed",plan_id:"2123564393224699907",start:"00:00",end:"08:00",active:true});});
 const before=await q(()=>window.calls.filter(c=>c==="plan_debug_get").length);
 await q(()=>window.push({vehicle_id:"v1"}));await page.waitForTimeout(700);
 ok("a push from the backend keeps the box open and updates it by itself",await q(()=>!!document.querySelector(".health-plan")&&document.querySelector(".health-log div").textContent.includes("Car plan removed: 699907")));
 ok("reloading asks for the plan once more",await page.evaluate(n=>window.calls.filter(c=>c==="plan_debug_get").length===n,before+1));
 await q(()=>{const now=Math.floor(Date.now()/1000);window.planView.log=Array.from({length:120},(_,i)=>({time:now-i*3600,source:"ha",event:"state",entity:"switch.s05_charge_schedule",old:"off",new:"on"}))});
 await q(()=>window.push({vehicle_id:"v1"}));await page.waitForTimeout(700);
 ok("log is a scrolling block that holds every row",await q(()=>{const l=document.querySelector(".health-log"),c=getComputedStyle(l);return l.children.length===120&&c.overflowY==="auto"&&l.clientHeight<=322&&l.scrollHeight>l.clientHeight&&l.getAttribute("role")==="log"&&l.tabIndex===0&&l.getAttribute("aria-label")==="Plan activity, last 7 days"}));
 ok("older rows show the date, today's only the time",await q(()=>{const t=[...document.querySelectorAll(".health-log time")];return t[0].textContent.length<=9&&t[119].textContent.length>9}));
 ok("the box stays compact however long the log is",await q(()=>document.querySelector(".health-plan").getBoundingClientRect().height<1000));
 await q(()=>{window.planView={available:true,pending:true,switch:"on",times:{start:"01:00",end:"08:00"},plans:[],log:[]}});await q(()=>window.push({vehicle_id:"v1"}));await page.waitForTimeout(700);
 ok("before the first update it says so and shows the Home Assistant plan",await q(()=>{const b=document.querySelector(".health-plan");return b.textContent.includes("Waiting for the car's plan list. Showing what Home Assistant has.")&&b.querySelector(".health-plan-facts b").textContent==="01:00 - 08:00 (on)"}));
 await q(()=>{window.planView={available:false,plans:[],log:[]}});await q(()=>window.push({vehicle_id:"v1"}));await page.waitForTimeout(700);
 ok("vehicle without a plan says so",await q(()=>document.querySelector(".health-plan").textContent.includes("This vehicle has no charge plan.")));
 for(const width of [360,1000]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
  ok("no horizontal overflow at "+width,await q(()=>{const h=document.querySelector(".health");return h.scrollWidth<=h.clientWidth+1&&document.documentElement.scrollWidth<=window.innerWidth}));}
 if(outDir){await q(()=>{window.planView={available:true,shown:"2123564441486163970",active:["2123564441486163970"],switch:"on",mismatch:false,plans:[{id:"2123564441486163970",active:true,start:"01:00",end:"08:00",placeholder:false},{id:"1",active:false,start:"01:00",end:"23:00",placeholder:true}],log:[{time:Math.floor(Date.now()/1000)-5,source:"deepal",event:"result",strategy:"add-plan"},{time:Math.floor(Date.now()/1000)-8,source:"deepal",event:"add_plan",start:"0100",end:"0800"}]}});
  await page.setViewportSize({width:390,height:900});await q(()=>window.push({vehicle_id:"v1"}));await page.waitForTimeout(700);await page.screenshot({path:path.join(outDir,"health_plan.png"),fullPage:true});}
 ok("no Check again buttons on the page",await q(()=>![...document.querySelectorAll("button")].some(b=>/Check again/.test(b.textContent))&&!document.querySelector(".health-refresh")));
 ok("page listens to the plan channel",await q(()=>window.subMsg?.type==="deepal_companion/subscribe_plan"));
 const n0=await q(()=>window.calls.length);await q(()=>{window.push({vehicle_id:"other"})});await page.waitForTimeout(700);
 ok("a push for another vehicle is ignored",await q(()=>window.calls.length)===n0);
 await q(()=>{for(let i=0;i<5;i++)window.push({vehicle_id:"v1"})});await page.waitForTimeout(900);
 ok("a burst of pushes is merged into one reload",await q(()=>window.calls.filter(c=>c==="health_get").length)-(await q(()=>0))>0&&(await q(()=>window.calls.length))-n0<=3);
 await q(()=>window.handle.destroy());
 ok("destroy stops listening",await q(()=>window.unsubbed===true));
 ok("destroy removes the page and does not throw",await q(()=>!document.querySelector(".health")));
 ok("no page errors",errs.length===0);if(errs.length)console.log(errs);
 await browser.close();server.close();process.exit(fails?1:0)})();
