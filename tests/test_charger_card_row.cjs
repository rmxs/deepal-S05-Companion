const assert=require('assert');
/* Regression: the charging block on the main card shows one row for the Charger limit while it is on: what it is doing,
   the time the target is reached while it waits, and a "Charge anyway" button only while the charger is held stopped.
   Nothing is drawn when the limit is off. Run: CHARGER_CARD_ONLY=1 node tests/test_browser.cjs */
module.exports=async page=>{
  await page.evaluate(()=>{document.querySelector('#cards').style.display='';['tablet','energy'].forEach(i=>document.getElementById(i).style.display='none');const c=document.getElementById('mobile');c._closeSheet();c._view=null;c.style.cssText='display:block;width:390px;min-width:390px;max-width:390px;margin:0';
    const h=window.testHass,now=new Date().toISOString();for(const [k,v] of [['binary_sensor.s05_charging','on'],['binary_sensor.s05_charger_plugged','on'],['sensor.s05_charge_current',16],['sensor.s05_ac_charge_current',16]])h.states[k]={...h.states[k],state:String(v),last_changed:now,last_updated:now};
    window.__calls=[];if(!h.limMock){h.limMock=true;const orig=h.callWS;h.callWS=async m=>{if(m.op&&m.op.startsWith('charger_limit_')){window.__calls.push(m.op);if(m.op==='charger_limit_resume')window.__lim.phase='paused';return JSON.parse(JSON.stringify(window.__lim));}return orig(m);};}
    window.__lim={phase:'off',target:80,config:{mode:'off'}};window.__saved=c._c;c._c={...c._c,hidden:[],charge_target:80};c._clAt=0;c._clInfo=null;c.hass=h;c._force();});
  const row=()=>page.evaluate(()=>{const c=document.getElementById('mobile');const r=c.shadowRoot.querySelector('.charge .cg-lim');return r?{text:r.innerText.replace(/\s+/g,' ').trim(),btn:!!r.querySelector('[data-cl-resume]'),cls:r.className}:null;});
  const setPhase=(phase,mode)=>page.evaluate(([p,m])=>{const c=document.getElementById('mobile');window.__lim={phase:p,target:80,config:{mode:m}};c._clAt=0;c._clFetch(true);},[phase,mode]);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>!!document.getElementById('mobile').shadowRoot.querySelector('.charge:not([hidden])')),true,'the charging block is showing');
  await page.waitForTimeout(300);assert.equal(await row(),null,'nothing is drawn while the limit is off');
  await setPhase('waiting','live');await page.waitForFunction(()=>document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim'));
  let r=await row();assert.match(r.text,/Limit 80%/,'waiting shows the limit');assert.equal(r.btn,false,'no button while charging is allowed');
  await setPhase('would_stop','dry');await page.waitForFunction(()=>/Dry run/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  assert.equal((await row()).btn,false);
  await setPhase('stopped','live');await page.waitForFunction(()=>document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim [data-cl-resume]'));
  r=await row();assert.match(r.text,/Stopped at 80%/);
  await page.evaluate(()=>document.getElementById('mobile').shadowRoot.querySelector('[data-cl-resume]').click());
  await page.waitForFunction(()=>window.__calls.includes('charger_limit_resume'));
  await page.waitForFunction(()=>/paused/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  assert.equal((await row()).btn,false,'paused: nothing more to press');
  await setPhase('failed','live');await page.waitForFunction(()=>/Could not stop/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  assert(/bad/.test((await row()).cls),'a failure is red');
  /* the settings demo shows the limit without a charger */
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=true;c._previewMode='limit-wait';c._clInfo=null;c._force();});
  await page.waitForFunction(()=>/Limit 80%/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._previewMode='limit-stop';c._force();});
  await page.waitForFunction(()=>/Stopped at 80%/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=false;c._previewMode=null;c._clAt=0;c._force();});
  for(const w of [390,320]){await page.evaluate(w=>{const c=document.getElementById('mobile');c.style.width=c.style.minWidth=c.style.maxWidth=w+'px';},w);await setPhase('stopped','live');await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>{const c=document.getElementById('mobile').shadowRoot.querySelector('.charge');return c.scrollWidth<=c.clientWidth+1;}),true,'no overflow at '+w+' px');}
  /* the same state as an info tile in the info row (Odometer, Humidity, ...): hidden while off or not in the list, one tile per phase, a tap asks before Charge anyway, the settings demo, 320 px */
  const tile=()=>page.evaluate(()=>{const t=document.getElementById('mobile').shadowRoot.querySelector('#info [data-cl-tile]');if(!t)return null;const q=t.getBoundingClientRect();return {phase:t.dataset.clTile,text:t.innerText.replace(/\s+/g,' ').trim(),w:q.width,cursor:getComputedStyle(t).cursor,sw:t.scrollWidth,cw:t.clientWidth};});
  const waitTile=(phase)=>page.waitForFunction(p=>{const t=document.getElementById('mobile').shadowRoot.querySelector('#info [data-cl-tile]');return p===null?!t:!!t&&t.dataset.clTile===p;},phase);
  const tapTile=()=>page.evaluate(()=>document.getElementById('mobile').shadowRoot.querySelector('#info [data-cl-tile]').click());
  const asked=()=>page.evaluate(()=>{const c=document.getElementById('mobile');return c._confirm?c._confirm.key:null;});
  const resumes=()=>page.evaluate(()=>window.__calls.filter(x=>x==='charger_limit_resume').length);
  await page.evaluate(()=>{const c=document.getElementById('mobile'),h=window.testHass;h.states['sensor.s05_remaining_charge_time_h_mm']={...h.states['sensor.s05_remaining_charge_time_h_mm'],state:'01:20',last_changed:new Date().toISOString(),last_updated:new Date().toISOString()};c._c={...c._c,info:['odometer','humidity','charger_limit']};window.__calls=[];c._force();});
  await setPhase('off','off');await waitTile(null);
  assert.equal(await tile(),null,'no info tile while the limit is off');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._c={...c._c,info:['odometer','humidity']};window.__lim={phase:'waiting',target:80,config:{mode:'live'}};c._clAt=0;c._clFetch(true);c._force();});
  await page.waitForTimeout(300);assert.equal(await tile(),null,'no info tile when the owner has not picked it in Card Settings');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._c={...c._c,info:['odometer','humidity','charger_limit']};c._force();});
  await setPhase('waiting','live');await waitTile('waiting');
  let t=await tile();assert.match(t.text,/Charger limit/,'the tile is labelled');assert.match(t.text,/80% · ≈\d\d:\d\d/,'waiting shows the target and the time it is reached');
  await tapTile();assert.equal(await asked(),null,'a tap while waiting asks nothing');
  await setPhase('stopped','live');await waitTile('stopped');
  t=await tile();assert.match(t.text,/Stopped Charger limit|Charger limit Stopped/,'stopped shows Stopped');assert.equal(t.cursor,'pointer','a stopped tile can be tapped');
  await tapTile();assert.equal(await asked(),'limit_resume','a tap on a stopped tile asks first');
  assert.equal(await resumes(),0,'nothing is sent before the answer');
  assert.match(await page.evaluate(()=>document.getElementById('mobile')._el.box.innerText),/Charge anyway\?/,'the question is shown');
  await page.evaluate(()=>document.getElementById('mobile')._el.box.querySelector('[data-sheet="yes"]').click());
  await page.waitForFunction(()=>window.__calls.includes('charger_limit_resume'));await waitTile('paused');
  t=await tile();assert.match(t.text,/Paused/,'after Charge anyway the tile shows paused');
  await tapTile();assert.equal(await asked(),null,'paused: a tap asks nothing');
  await setPhase('failed','live');await waitTile('failed');t=await tile();assert.match(t.text,/Failed/,'failed shows Failed');
  await tapTile();assert.equal(await asked(),null,'failed: a tap asks nothing');
  /* a limit that is off is not asked for every 15 s: only a forced read (or a reopened card) goes to the backend */
  await setPhase('off','off');await page.waitForTimeout(300);
  const polled=force=>page.evaluate(async force=>{const c=document.getElementById('mobile');window.__calls=[];c._clAt=Date.now()-20000;c._clFetch(force);await new Promise(r=>setTimeout(r,150));return window.__calls.length;},force);
  assert.equal(await polled(false),0,'no 15 s poll while the limit is off');
  assert.equal(await polled(true),1,'a forced read still asks');
  await page.evaluate(()=>{const c=document.getElementById('mobile');window.__lim={phase:'waiting',target:80,config:{mode:'live'}};c._clAt=0;c._clFetch(true);});
  await page.waitForTimeout(300);
  assert.equal(await polled(false),1,'a live limit is polled every 15 s again');
  /* a 100 % target is worded as such, not as "no target" (the backend sends target_full) */
  await page.evaluate(()=>{const c=document.getElementById('mobile');window.__lim={phase:'no_target',target:100,target_full:true,config:{mode:'live'}};c._clAt=0;c._clFetch(true);});
  await waitTile('no_target');
  assert.match((await tile()).text,/Target 100%/,'the 100 % tile is not "No target"');
  await page.waitForFunction(()=>/Target is 100%, nothing to stop/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  await page.evaluate(()=>{const c=document.getElementById('mobile');window.__lim={phase:'no_target',target:0,config:{mode:'live'}};c._clAt=0;c._clFetch(true);});
  await page.waitForFunction(()=>/No charging target set/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''));
  assert.match((await tile()).text,/No target/,'no target keeps its own wording');
  /* keyboard: Enter on the stopped Charger limit tile asks before Charge anyway, Enter on the big range opens the range window */
  await setPhase('stopped','live');await waitTile('stopped');
  await page.evaluate(()=>document.getElementById('mobile').shadowRoot.querySelector('#info [data-cl-tile]').focus());
  await page.keyboard.press('Enter');await page.waitForTimeout(200);
  assert.equal(await asked(),'limit_resume','Enter on the stopped tile asks first');
  await page.evaluate(()=>document.getElementById('mobile')._closeSheet());
  const rangeFocus=await page.evaluate(()=>{const t=document.getElementById('mobile').shadowRoot.querySelector('#total');t.focus();return {role:t.getAttribute('role'),tab:t.tabIndex,focused:document.getElementById('mobile').shadowRoot.activeElement===t};});
  assert.deepEqual(rangeFocus,{role:'button',tab:0,focused:true},'the big range can be reached with the keyboard');
  await page.keyboard.press('Enter');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.getElementById('mobile')._stSheet),'__range','Enter on the range opens the range window');
  await page.evaluate(()=>document.getElementById('mobile')._closeSheet());
  await page.waitForTimeout(600); /* taps are ignored for a moment after a window opens */
  /* the settings demo: limit-wait and limit-stop, no backend call, the confirm sheet appears but sends nothing */
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=true;c._previewMode='limit-wait';c._clInfo=null;window.__calls=[];c._force();});
  await waitTile('waiting');assert.match((await tile()).text,/80%/,'the demo shows the waiting limit with no charger');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._previewMode='limit-stop';c._force();});
  await waitTile('stopped');await tapTile();assert.equal(await asked(),'limit_resume','the demo asks as well');
  await page.evaluate(()=>document.getElementById('mobile')._el.box.querySelector('[data-sheet="yes"]').click());
  await page.waitForTimeout(200);assert.equal(await resumes(),0,'the settings demo sends nothing');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=false;c._previewMode=null;c._clInfo=null;c._clAt=0;c._force();});
  /* 320 px: the stopped tile (the widest text) is laid out inside itself and leaves room for its neighbours */
  await page.evaluate(()=>{const c=document.getElementById('mobile');c.style.width=c.style.minWidth=c.style.maxWidth='320px';window.__lim={phase:'stopped',target:80,config:{mode:'live'},energy_kwh:12.4};c._clAt=0;c._clFetch(true);});
  await waitTile('stopped');t=await tile();
  assert.match(t.text,/Stopped 12\.4 kWh Charger limit/,'the stopped tile shows the energy of the charge under the state');
  assert.equal(t.sw<=t.cw+1,true,'the tile text does not overflow at 320 px');
  assert(t.w<=320*0.6,'the tile leaves room for the other tiles at 320 px ('+t.w+' px)');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c.style.width=c.style.minWidth=c.style.maxWidth='390px';c._c={...c._c,info:window.__saved.info};c._force();});
  console.log('PASS: the Charger limit info tile hides while off or not picked, shows waiting (with the time), stopped (tap asks, then Charge anyway), paused and failed, and works in the settings demo without sending anything.');
  /* the numbers: the power while it waits (kW from 1 kW up, W below), the energy of the charge once it has stopped; the settings demo shows 7.2 kW and 12.4 kWh */
  const rowText=()=>page.evaluate(()=>(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||'').replace(/\s+/g,' ').trim());
  const setLim=lim=>page.evaluate(l=>{const c=document.getElementById('mobile');window.__lim=l;c._clAt=0;c._clFetch(true);},lim);
  const rowHas=re=>page.waitForFunction(src=>new RegExp(src).test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||''),re.source);
  await setLim({phase:'waiting',target:80,config:{mode:'live'},power_w:3200,energy_kwh:9.6});
  await rowHas(/3\.2 kW/);
  assert.match(await rowText(),/^Limit 80%.* · 3\.2 kW$/,'waiting shows the power, not the energy');
  await setLim({phase:'waiting',target:80,config:{mode:'live'},power_w:850,energy_kwh:null});
  await rowHas(/850 W$/);
  await setLim({phase:'stopped',target:80,config:{mode:'live'},power_w:0,energy_kwh:12.4});
  await rowHas(/12\.4 kWh/);
  assert.match(await rowText(),/^Stopped at 80% · 12\.4 kWh/,'stopped shows the energy of the charge');
  await setLim({phase:'stopped',target:80,config:{mode:'live'},power_w:0,energy_kwh:null});
  await page.waitForFunction(()=>!/kWh/.test(document.getElementById('mobile').shadowRoot.querySelector('.charge .cg-lim')?.innerText||'x'));
  assert.equal(/kWh/.test(await rowText()),false,'no energy reading, no number');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=true;c._previewMode='limit-wait';c._clInfo=null;c._force();});
  await rowHas(/7\.2 kW/);
  assert.match(await rowText(),/^Limit 80%.* · 7\.2 kW$/,'the settings demo waits with 7.2 kW');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._previewMode='limit-stop';c._force();});
  await rowHas(/12\.4 kWh/);
  assert.match(await rowText(),/^Stopped at 80% · 12\.4 kWh/,'the settings demo is stopped with 12.4 kWh');
  console.log('PASS: the limit row and tile show the power while it waits (kW or W) and the energy once stopped, and the settings demo shows 7.2 kW and 12.4 kWh.');
  await page.evaluate(()=>{const c=document.getElementById('mobile');c._isCompanionPreview=false;c._previewMode=null;c._clInfo=null;c._clAt=0;c._force();});
  await page.evaluate(()=>{const c=document.getElementById('mobile');c.style.cssText='';c._c=window.__saved;});
  console.log('PASS: the charging block shows the Charger limit row (waiting, dry run, stopped with Charge anyway, paused, failed) and nothing when off.');
};
