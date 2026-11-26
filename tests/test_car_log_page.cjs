/* Car logs page: tiles filter, grouped sessions, warnings box, push reload and cleanup. Everything is mocked. */
const fs=require("fs"),path=require("path"),http=require("http");
const repo=path.resolve(__dirname,".."),outDir=process.argv[2]||null;
const {chromium}=require(path.join(repo,"node_modules/playwright-core"));
const base=path.join(repo,"custom_components/deepal_companion/frontend");
const mime={".js":"text/javascript; charset=utf-8",".css":"text/css",".svg":"image/svg+xml",".webp":"image/webp",".jpg":"image/jpeg",".png":"image/png"};
const server=http.createServer((q,r)=>{const u=new URL(q.url,"http://x");const rel=u.pathname.startsWith("/deepal_companion/frontend/")?u.pathname.slice(27):null;
 if(rel!==null){const f=path.resolve(base,rel);if(f.startsWith(base)&&fs.existsSync(f)){r.setHeader("Content-Type",mime[path.extname(f)]||"application/octet-stream");r.end(fs.readFileSync(f));return}r.writeHead(404);r.end();return}
 r.setHeader("Content-Type","text/html; charset=utf-8");r.end('<html><body style="margin:0;background:#17191c;color:#eee;font:14px Arial;--card-background-color:#232528;--primary-background-color:#17191c;--primary-text-color:#eee;--secondary-text-color:#aaa;--divider-color:#444;--secondary-background-color:#2c2e32"><div id="stage"></div></body></html>')});

(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:800}});const errs=[];page.on("pageerror",e=>errs.push(e.message));
 await page.goto("http://127.0.0.1:"+server.address().port);await page.addScriptTag({url:"/deepal_companion/frontend/companion-card.js"});
 await page.evaluate(async()=>{
  const now=Math.floor(Date.now()/1000);window.calls=[];window.requests=[];
  const r=(id,ago,cat,kind,title,extra={})=>({id,time:now-ago,cat,kind,title,sev:"info",icon:"mdi:information-outline",origin:"direct",...extra});
  window.baseRows=[
   r("1",60,"security","locked","Doors locked",{session:"sg-1",icon:"mdi:lock-outline",poll:300}),
   r("2",70,"security","window_closed","Front left window closed",{session:"sg-1"}),
   r("3",80,"security","door_closed","Front left door closed",{session:"sg-1"}),
   r("4",90,"security","door_closed","Front right door closed",{session:"sg-1"}),
   r("5",300,"charging","charging_end","Charging ended",{session:"c1",icon:"mdi:ev-station",detail:{start_level:40,level:82,minutes:105,kwh:18.4}}),
   r("6",6300,"charging","charging_start","Charging started",{session:"c1",detail:{level:40}}),
   r("7",400,"security","left_unlocked","Left unlocked",{sev:"important",origin:"derived",detail:{since:now-2200}}),
   r("8",500,"others","problem","Tyre pressure warning",{sev:"important",late:true})];
  window.view={ready:true,retention_days:30,now,since:now-86400*5,active:[{key:"w_tpms",title:"Tyre pressure warning",sev:"important",since:now-600,origin:"direct"}],rows:window.baseRows};
  window.carStatus={locked:true,doors_total:4,doors_open:0,windows_total:4,windows_open:0,trunk_open:false,hood_open:false,battery:82,range:340,range_unit:"km",charging:false};
  const panel={selected:{vehicle_id:"v1"},_hass:{locale:{language:"en"},config:{time_zone:"UTC"},connection:{async subscribeMessage(cb,msg){window.push=cb;window.subMsg=msg;return()=>{window.unsubbed=true}}}},
   t:(key,...args)=>String(key).replace(/\{(\d+)\}/g,(_,i)=>args[i]),
   async request(op,params){window.calls.push(op);window.params=params;if(op!=="car_log_get")throw Error("Unexpected "+op);window.requests.push(structuredClone(params));
    const v=structuredClone(window.view);let rows=v.rows.filter(x=>!params.cat||x.cat===params.cat);if(params.before)rows=rows.filter(x=>x.time<params.before);
    const limit=params.limit||30;v.rows=rows.slice(0,limit);v.more=rows.length>limit;v.next_before=v.more?v.rows[v.rows.length-1].time:null;v.counts={security:3,charging:2,others:1};v.status=structuredClone(window.carStatus);v.summary={security:{locked:true,since:v.now-60},charging:{count:4,kwh:31.5}};return v}};
  const {mountCarLog}=await import("/deepal_companion/frontend/companion-car-log.js");
  window.panel=panel;window.handle=await mountCarLog(panel,document.getElementById("stage"));
 });
 await page.waitForTimeout(300);
 const q=f=>page.evaluate(f);let fails=0;const ok=(n,c)=>{console.log(c?"ok  ":"FAIL",n);if(!c)fails++};
 ok("subscribes to the car log push",await q(()=>window.subMsg&&window.subMsg.type==="deepal_companion/subscribe_car_log"));
 ok("status card: secured, locked, windows, battery with range",await q(()=>{const s=document.querySelector(".carlog-status").textContent;return s.includes("Current status")&&s.includes("Secured")&&s.includes("Locked")&&s.includes("All doors closed")&&s.includes("4/4 windows closed")&&s.includes("82%")&&s.includes("~340 km")}));
 ok("four tiles: All pressed, counts from the server",await q(()=>[...document.querySelectorAll(".carlog-tile")].map(b=>b.querySelector("span").textContent+b.querySelector("small").textContent+b.getAttribute("aria-pressed")).join()==="All6true,Security3false,Charging2false,Others1false"));
 ok("three range chips, 30 days pressed",await q(()=>[...document.querySelectorAll(".carlog-range .seg button")].map(b=>b.textContent+":"+b.getAttribute("aria-pressed")).join()==="Today:false,7 days:false,30 days:true"));
 ok("tile tooltip says the count is for the selected range",await q(()=>document.querySelector(".carlog-tile:nth-child(2)").title==="3 events in this range"));
 ok("range row: grouped and retention labels sit together inside the range row, no overflow",await q(()=>{const m=document.querySelector(".carlog-meta-row");if(!m)return false;const r=m.getBoundingClientRect(),c=document.querySelector(".carlog-range").getBoundingClientRect();return m.querySelectorAll(".carlog-meta").length===2&&m.textContent.includes("Grouped events")&&m.textContent.includes("Kept for 30 days")&&r.right<=c.right+1&&r.right<=window.innerWidth}));
 ok("active warning box is shown",await q(()=>document.querySelector(".carlog-alert strong")?.textContent==="Tyre pressure warning"));
 ok("the parking burst is one summary card",await q(()=>{const c=[...document.querySelectorAll("button.tl-card")].find(b=>b.textContent.includes("Parked & secured"));return !!c&&c.textContent.includes("4 changes")&&c.textContent.includes("Doors closed: 2")&&c.textContent.includes("Windows closed: 1")&&c.textContent.includes("Doors locked")}));
 ok("charge is one summary card with energy and duration",await q(()=>{const c=[...document.querySelectorAll("button.tl-card")].find(b=>b.textContent.includes("Charging ended at 82%"));return !!c&&c.textContent.includes("+18.4 kWh")&&c.textContent.includes("40% → 82%")&&c.textContent.includes("1 h 45 min")}));
 ok("derived and late notes, polled marker",await q(()=>document.body.textContent.includes("Worked out by Companion")&&document.body.textContent.includes("Noticed after the connection returned")&&document.body.textContent.includes("≈ ")));
 ok("timeline nodes are tinted by group",await q(()=>{const n=[...document.querySelectorAll(".tl-node")].map(x=>x.style.getPropertyValue("--tone"));return n.includes("var(--ds-info)")&&n.includes("var(--ds-ok)")&&n.includes("var(--ds-warn)")}));
 ok("steps are hidden while closed",await q(()=>[...document.querySelectorAll(".tl-steps")].every(u=>getComputedStyle(u).display==="none")));
 ok("a tap hint is shown once",await q(()=>document.querySelectorAll(".carlog-day em").length===1));
 ok("routine events are listed in their day, with no dropdown",await q(()=>!document.querySelector(".carlog-normal-btn")&&!document.querySelector(".carlog-normal-list")&&document.querySelectorAll(".carlog-body>.tl-list>.tl-item.info").length>0));
 await page.click("button.tl-card");
 ok("opening shows the steps with seconds",await q(()=>{const c=document.querySelector("button.tl-card");const u=c.querySelector(".tl-steps");return c.getAttribute("aria-expanded")==="true"&&getComputedStyle(u).display!=="none"&&u.querySelectorAll("li").length>=2&&/\d\d:\d\d:\d\d/.test(u.textContent)}));
 ok("no horizontal overflow on mobile",await q(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.click(".carlog-tile:nth-child(3)");await page.waitForTimeout(400);
 ok("charging filter asks the server and shows a note with the summary",await q(()=>window.params.cat==="charging"&&document.querySelector(".carlog-note").textContent.includes("4 charges · 31.5 kWh")&&document.querySelector(".carlog-tile[aria-pressed=true] span").textContent==="Charging"));
 await page.click(".carlog-tile:nth-child(2)");await page.waitForTimeout(400);
 ok("security note shows the lock state",await q(()=>document.querySelector(".carlog-note").textContent.includes("Doors locked now")));
 await page.click(".carlog-tile:nth-child(1)");await page.waitForTimeout(400);
 ok("All clears the filter",await q(()=>!window.params.cat&&document.querySelector(".carlog-tile[aria-pressed=true] span").textContent==="All"));
 await page.click(".carlog-range .seg button:nth-child(2)");await page.waitForTimeout(400);
 ok("range chip asks the server",await q(()=>window.params.range==="7"&&document.querySelector(".carlog-range .seg button[aria-pressed=true]").textContent==="7 days"));
 await q(()=>{window.view.rows=Array.from({length:130},(_,i)=>({id:"p"+i,time:window.view.now-1000-i*10,cat:"others",kind:"x",title:"Row "+i,sev:"info",icon:"mdi:information-outline",origin:"direct"}));});
 await page.click(".carlog-tile:nth-child(1)");await page.waitForTimeout(600);
 await q(()=>{window.titles=()=>[...document.querySelectorAll("article.tl-card strong")].map(x=>x.textContent);});
 ok("first load asks for one page of 30 and shows only that page",await q(()=>window.requests.length>0&&window.requests.at(-1).limit===30&&window.requests.at(-1).before===undefined&&window.titles().length===30&&!!document.querySelector(".carlog-more")));
 await q(()=>{window.rb=window.requests.length;});
 await page.click(".carlog-more");await page.waitForTimeout(500);
 ok("Show older sends one new car_log_get with the cursor and appends the next 30",await q(()=>window.requests.length===window.rb+1&&window.requests.at(-1).before>0&&window.requests.at(-1).limit===30&&window.titles().length===60&&window.titles()[59]==="Row 59"));
 for(let i=0;i<3;i++){await page.click(".carlog-more");await page.waitForTimeout(350);}
 ok("the last page has no Show older button and every row is shown once",await q(()=>window.titles().length===130&&new Set(window.titles()).size===130&&!document.querySelector(".carlog-more")));
 await q(()=>window.push({}));await page.waitForTimeout(500);
 ok("a refresh asks only for the newest page and keeps the older rows already shown",await q(()=>window.requests.at(-1).before===undefined&&window.requests.at(-1).limit===30&&window.titles().length===130));
 await q(()=>{window.view.rows=window.baseRows;window.push({});});await page.waitForTimeout(600);
 const n0=await q(()=>window.calls.length);
 await q(()=>window.push({vehicle_id:"other"}));await page.waitForTimeout(500);
 ok("a push for another vehicle is ignored",await q(()=>window.calls.length)===n0);
 await q(()=>{window.carStatus.locked=false;window.carStatus.windows_open=1;for(let i=0;i<5;i++)window.push({vehicle_id:"v1"})});await page.waitForTimeout(800);
 ok("a burst of pushes is merged into one reload",(await q(()=>window.calls.length))-n0===1);
 ok("status card follows the live state",await q(()=>{const s=document.querySelector(".carlog-status").textContent;return s.includes("Not secured")&&s.includes("Unlocked")&&s.includes("3/4 windows closed")}));
 ok("the open card stays open after a reload",await q(()=>document.querySelector("button.tl-card").getAttribute("aria-expanded")==="true"));
 await q(()=>{window.view.rows=[];window.view.active=[];window.push({});});await page.waitForTimeout(600);
 ok("empty state and no warning box",await q(()=>!!document.querySelector(".cp-empty")&&!document.querySelector(".carlog-alert")));
 await q(()=>window.handle.destroy());
 ok("destroy stops listening and removes the page",await q(()=>window.unsubbed===true&&!document.querySelector(".carlog")));
 ok("no page errors",errs.length===0);if(errs.length)console.log(errs);
 await browser.close();server.close();process.exit(fails?1:0)})();
