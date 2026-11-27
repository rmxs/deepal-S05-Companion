const assert=require('assert');
/* Regression: the Temperature tile shows one small chip for every seat or steering wheel comfort that is working, and
   nothing at all when everything is off. Checks: no chip (and no extra node) when all is off; wheel, driver seat and
   passenger seat chips in that order, heat orange and ventilation blue, the passenger icon mirrored; one chip per seat
   even if heat and ventilation are both set; a tap opens the Seats popup and not the Climate popup; the chips never
   overlap the power knob, the title or the Energy tile at 390 px and 320 px; the pulse stops with reduced motion.
   Run: SEATS_ONLY=1 node tests/test_browser.cjs */
module.exports=async page=>{
  const set=(vals)=>page.evaluate(v=>{const c=document.getElementById('mobile'),h=window.testHass,s={...h.states};for(const [k,val] of Object.entries(v)){const key=(k.startsWith('switch.')?'switch.s05_':'number.s05_')+k.replace(/^(switch|number)\./,'');s[key]={...(s[key]||{attributes:{}}),state:String(val)};}h.states=s;c.hass={...h,states:s};c._force();},vals);
  const read=()=>page.evaluate(()=>{const r=document.getElementById('mobile').shadowRoot,t=r.querySelector('.t2.tempc'),chips=[...t.querySelectorAll('.cmf .it')];return {n:chips.length,cls:chips.map(x=>x.className),cmf:!!t.querySelector('.cmf'),html:t.innerHTML};});
  const rects=()=>page.evaluate(()=>{const r=document.getElementById('mobile').shadowRoot,t=r.querySelector('.t2.tempc'),b=x=>{const q=x.getBoundingClientRect();return [q.left,q.top,q.right,q.bottom];};return {tile:b(t),cmf:b(t.querySelector('.cmf')),knob:b(t.querySelector('.knob')),tt:b(t.querySelector('.tt')),ts:b(t.querySelector('.ts'))};});
  const hit=(a,b)=>a[0]<b[2]-1&&a[2]>b[0]+1&&a[1]<b[3]-1&&a[3]>b[1]+1;
  await page.evaluate(()=>{document.querySelector('#cards').style.display='';['tablet','energy'].forEach(i=>document.getElementById(i).style.display='none');const c=document.getElementById('mobile');c._closeSheet();c._view=null;c.style.cssText='display:block;width:390px;min-width:390px;max-width:390px;margin:0';});
  const all=['number.front_left_seat_heating_level','number.front_right_seat_heating_level','number.front_left_seat_ventilation_level','number.front_right_seat_ventilation_level','switch.steering_wheel_heating'];
  await set(Object.fromEntries(all.map(k=>[k,k.startsWith('switch')?'off':0])));
  let r=await read();assert.equal(r.cmf,false,'nothing is drawn when everything is off');const off=r.html;
  await set({'number.front_left_seat_heating_level':2,'number.front_right_seat_ventilation_level':1,'switch.steering_wheel_heating':'on'});
  r=await read();assert.equal(r.n,3,'three functions give three chips');
  assert(/\bh\b/.test(r.cls[0])&&r.cls[0].includes('it'),'wheel first, heat colour');assert(/\bh\b/.test(r.cls[1]),'driver seat heat');assert(/\bv\b/.test(r.cls[2])&&/\bm\b/.test(r.cls[2]),'passenger seat ventilation, mirrored');
  const colours=await page.evaluate(()=>[...document.getElementById('mobile').shadowRoot.querySelectorAll('.t2.tempc .cmf .it')].map(x=>getComputedStyle(x).color));
  assert.notEqual(colours[0],colours[2],'heat and ventilation use different colours');assert.equal(colours[0],colours[1],'wheel and seat heat share the heat colour');
  /* heat and ventilation set on the same seat: one chip, heat wins */
  await set({'number.front_left_seat_heating_level':1,'number.front_left_seat_ventilation_level':1,'number.front_right_seat_ventilation_level':0,'switch.steering_wheel_heating':'off'});
  r=await read();assert.equal(r.n,1,'one chip per seat');assert(/\bh\b/.test(r.cls[0]),'heat wins on the same seat');
  /* layout: all on, climate on (the target line is visible), at 390 and 320 px */
  await set({'number.front_left_seat_heating_level':2,'number.front_left_seat_ventilation_level':0,'number.front_right_seat_ventilation_level':1,'switch.steering_wheel_heating':'on'});
  for(const w of [390,320]){
    await page.evaluate(w=>{const c=document.getElementById('mobile');c.style.width=c.style.minWidth=c.style.maxWidth=w+'px';},w);
    await page.waitForTimeout(150);
    const q=await rects();
    const cx=(q.knob[0]+q.knob[2])/2,cy=(q.knob[1]+q.knob[3])/2,rad=(q.knob[2]-q.knob[0])/2,nx=Math.max(q.cmf[0],Math.min(cx,q.cmf[2])),ny=Math.max(q.cmf[1],Math.min(cy,q.cmf[3]));
    assert(Math.hypot(nx-cx,ny-cy)>=rad-1,'chips stay clear of the round power knob at '+w+' px: '+JSON.stringify(q));
    assert(!hit(q.cmf,q.tt)&&!hit(q.cmf,q.ts),'chips stay clear of the title and the temperature at '+w+' px');
    assert(q.cmf[0]>=q.tile[0]&&q.cmf[2]<=q.tile[2]&&q.cmf[3]<=q.tile[3]+1,'chips stay inside the tile at '+w+' px');
    if(w===390)assert(q.tile[3]-q.cmf[3]<=16,'chips sit at the bottom of the tile at '+w+' px: '+JSON.stringify(q));
  }
  /* a tap opens the Seats popup, not Climate */
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._view=null;c.shadowRoot.querySelector('.t2.tempc .cmf').click();});
  assert.equal(await page.evaluate(()=>document.getElementById('mobile')._view),'seats','a tap on the chips opens Seats');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._view=null;c._force();});
  /* off again: the tile is exactly as it was */
  await set(Object.fromEntries(all.map(k=>[k,k.startsWith('switch')?'off':0])));
  r=await read();assert.equal(r.cmf,false);assert.equal(r.html,off,'with everything off the tile is unchanged');
  /* the pulse stops with reduced motion */
  const css=await page.evaluate(()=>document.getElementById('mobile').shadowRoot.querySelector('style').textContent);
  assert(/prefers-reduced-motion[^{]*\{[^}]*\.cmf \.dt::after \{ animation:none;/.test(css),'reduced motion stops the pulse');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c.style.cssText='';['tablet','energy'].forEach(i=>document.getElementById(i).style.display='');document.querySelector('#cards').style.display='none';});
  console.log('PASS: seat and wheel comfort chips show only while something is on, with the right colours and order, one per seat, clear of the knob at 390 and 320 px, a tap opens Seats, and the tile is unchanged when all is off.');
};
