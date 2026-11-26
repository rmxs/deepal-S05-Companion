const assert=require('assert');
/* Regression: the Tyres page shows the top-view car with one value box beside each wheel. Checks: the top-view images
   are used (not the 3/4 view), the four boxes sit left and right of the car and never overlap it or each other,
   each box has a line to its wheel, a low tyre is flagged, and nothing overflows at 320 px.
   Run: TYRE_TOP_ONLY=1 node tests/test_browser.cjs   (TYRE_SHOT=<file.png> also saves a screenshot) */
module.exports=async page=>{
  const get=()=>page.evaluate(()=>{const c=document.getElementById('mobile'),r=c.shadowRoot,box=r.querySelector('#viso .isoi');if(!box)return null;const b=box.getBoundingClientRect(),car=r.querySelector('#viso img[data-n=base]');
    return {w:b.width,h:b.height,top:/\/images\/top\//.test((car?.getAttribute('src')||car?.dataset.src)||''),pills:[...r.querySelectorAll('#viso .tp[data-t]')].map(p=>{const q=p.getBoundingClientRect();return {id:p.dataset.t,l:q.left-b.left,r:q.right-b.left,t:q.top-b.top,b:q.bottom-b.top,cls:p.className,txt:p.textContent};}),lines:r.querySelectorAll('#viso svg.tl line').length,dots:r.querySelectorAll('#viso svg.tl circle').length};});
  await page.setViewportSize({width:390,height:900});
  await page.evaluate(()=>{document.querySelector('#cards').style.display='';});
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._closeSheet();c._view='iso';c._force();});
  try{await page.waitForFunction(()=>document.getElementById("mobile").shadowRoot.querySelectorAll(".tp[data-t]").length===4,null,{timeout:8000});}catch(e){console.log("STATE",await page.evaluate(()=>{const c=document.getElementById("mobile");return {view:c._view,viso:c._el.viso.innerHTML.slice(0,200),key:c._isoKey};}));throw e;}
  let g=await get();
  assert.equal(g.top,true,'the Tyres page uses the top-view car images');
  assert.equal(g.lines,4,'one line per wheel');assert.equal(g.dots,8,'a dot and a halo per wheel');
  const carL=g.w*.345,carR=g.w*.655;
  for(const p of g.pills){const left=p.id.endsWith('left');assert(left?p.r<=carL+1:p.l>=carR-1,p.id+' stays beside the car, not over it: '+JSON.stringify(p));assert(p.l>=-1&&p.r<=g.w+1,p.id+' stays inside the picture');}
  const rows=g.pills.map(p=>p.t);assert(Math.abs(rows[0]-rows[1])<2&&Math.abs(rows[2]-rows[3])<2,'front pair and rear pair share a row');assert(g.pills[2].t>g.pills[0].b,'front and rear boxes do not overlap: '+JSON.stringify(g));
  assert(g.pills.every(p=>/ok/.test(p.cls)),'readings inside the limits are OK: '+g.pills.map(p=>p.cls));
  /* a low tyre is flagged */
  await page.evaluate(()=>{const h=window.testHass,s={...h.states},k='binary_sensor.s05_front_left_tire_alarm';s[k]={...(s[k]||{attributes:{}}),state:'on'};h.states=s;document.getElementById('mobile').hass={...h,states:s};document.getElementById('mobile')._force();});
  await page.waitForFunction(()=>/bad/.test(document.getElementById('mobile').shadowRoot.querySelector('.tp[data-t=front_left]').className));
  if(process.env.TYRE_SHOT){await page.locator('#mobile .isop').first().screenshot({path:process.env.TYRE_SHOT});};
  await page.setViewportSize({width:320,height:800});
  assert.equal(await page.evaluate(()=>{const r=document.getElementById('mobile').shadowRoot.querySelector('#viso .isop');return r.scrollWidth<=r.clientWidth+1;}),true,'no horizontal overflow at 320 px: '+JSON.stringify(await get()));
  await page.setViewportSize({width:1440,height:1050});
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._closeSheet();c._view=null;c._force();document.querySelector('#cards').style.display='none';});
  console.log('PASS: the Tyres page shows the top-view car with a value box beside each wheel, lines to the wheels, a low tyre flagged, no overflow at 320 px.');
};
