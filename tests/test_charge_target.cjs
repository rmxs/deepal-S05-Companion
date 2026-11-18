const assert=require('assert');
/* Charging target (advisory): the chip in the charge block, the tick on the battery ring, the reached state,
   out-of-range values, the saved setting and the one-time notice. Uses the preview's simulated charge (68 %, 01:20 left). */
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),preview=panel.locator('.live-preview deepal-companion-card');
 const snapshot=await page.evaluate(()=>({views:structuredClone(window.views),selection:localStorage.getItem('deepal-companion-selection:admin')}));
 const setMode=mode=>panel.locator('[name=preview_mode]').evaluate((s,m)=>s._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:m},bubbles:true})),mode);
 const setTarget=value=>panel.evaluate((p,v)=>p.patch({charge_target:v}),value);
 const chargeText=async()=>{await preview.locator('.charge').waitFor({state:'attached'});return preview.locator('.charge').innerText();};
 const ringTicks=()=>preview.locator('.gauge line.tg').count();
 const hm=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 try{
  await panel.evaluate(async p=>{await p.select('car','mobile');});
  /* charging at 68 %, 01:20 left: 80 min for 32 points, so 80 % is 80 × 12 / 32 = 30 min away */
  await setMode('ac');await setTarget(80);
  let text=await chargeText();
  assert.match(text,/Target/,'The charge block shows a Target item');
  const expected=[Date.now()+30*60000,Date.now()+31*60000,Date.now()+29*60000].map(t=>hm(new Date(t)));
  assert(expected.some(t=>text.includes('80%') && text.includes('≈'+t)),'The estimate for 80 % should be about 30 minutes away, got: '+text.replace(/\s+/g,' '));
  assert.equal(await ringTicks(),1,'The battery ring shows one target tick');
  assert.equal(await page.evaluate(()=>window.views.mobile.charge_target),80,'The target is saved with the display profile');

  /* the Energy tile rolls through Charging now, time left and the target */
  const rolls=await preview.locator('.rl3 b').allTextContents();
  assert.equal(rolls.length,4,'Three lines plus a repeat of the first for a seamless loop, got '+JSON.stringify(rolls));
  assert.equal(rolls[0],'Charging now');assert.match(rolls[1],/left/);assert.match(rolls[2],/^80% at ~\d{2}:\d{2}$/);assert.equal(rolls[3],rolls[0]);
  assert.equal(await preview.locator('.rl3').evaluate(e=>getComputedStyle(e).animationName),'ds-roll4');

  /* not charging: the goal stays, without an estimate */
  await setMode('plugged');text=await chargeText();
  assert.match(text,/80%/);assert.doesNotMatch(text,/≈/,'No estimate while the car is not charging');
  assert.equal(await ringTicks(),1);

  /* already at or above the goal */
  await setMode('complete');text=await chargeText();
  assert.match(text,/Reached/,'A battery at 100 % shows the goal as reached');

  /* off, and values outside 50–100 are not shown */
  await setMode('ac');
  for(const off of [0,45]){
   await setTarget(off);text=await chargeText();
   assert.doesNotMatch(text,/Target/,'Target '+off+' must not show a chip');
   assert.equal(await ringTicks(),0,'Target '+off+' must not show a ring tick');
  }

  /* reaching the goal while charging shows no toast: the Energy tile text and the charging notification carry it */
  await setMode('plugged');await setTarget(80);
  await setTarget(60);
  await setMode('ac');
  await new Promise(r=>setTimeout(r,400));
  assert.equal(await preview.locator('text=/Battery reached your/').count(),0,'No toast on reaching the goal');
 }finally{
  await page.evaluate(value=>{window.views=value.views;if(value.selection===null)localStorage.removeItem('deepal-companion-selection:admin');else localStorage.setItem('deepal-companion-selection:admin',value.selection);},snapshot);
  await setMode('live').catch(()=>{});
 }
 console.log('PASS: charging target shows a chip with an estimate while charging, a ring tick, a reached state, ignores values outside 50–100, saves with the profile and shows no toast when reached.');
};
