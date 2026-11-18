const assert=require('assert');
/* Live charging cost on the card: the cost chip in the charging block, the selector strip that fades away once a location is saved,
   the slim bar inside the curve, receipts that survive a location change, read-only for non-admins, demo-only preview, removal when the charge stops. */
module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  await page.evaluate(()=>document.querySelector('#cards').style.display='grid');
  const card=page.locator('#mobile'),block=card.locator('.charge-cost-live'),chip=card.locator('.charge [data-cc-chip-amount]');
  const writes=()=>page.evaluate(()=>window.calls.filter(m=>['costs_set','charge_profile_assign'].includes(m.op)).length);
  const push=()=>page.evaluate(()=>{document.getElementById('mobile').hass=window.testHass;});
  const setCharging=(on,pct)=>page.evaluate(([on,pct])=>{
    const now=new Date().toISOString(),states=window.testHass.states,put=(id,value)=>{states[id]={...states[id],state:String(value),last_changed:now,last_updated:now};};
    put('sensor.s05_ac_charge_current',on?16:0);put('sensor.s05_charge_current',on?16:0);put('binary_sensor.s05_charging',on?'on':'off');put('binary_sensor.s05_charger_plugged',on?'on':'off');
    if(pct!=null)put('sensor.s05_battery_level',pct);
    if(!on)document.getElementById('mobile')._ccSeen=0;
    document.getElementById('mobile').hass=window.testHass;
  },[on,pct]);
  const choose=async value=>{await block.locator('select').evaluate((select,v)=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:v},bubbles:true})),value);};
  const chipText=async()=>(await chip.textContent()).trim();
  const key=()=>page.evaluate(()=>String(Math.round(window.pageRows[0].s/1000)));
  const original=await page.evaluate(()=>({hidden:window.views.mobile.hidden,curve:window.views.mobile.charge_curve,selector:window.views.mobile.charge_cost_selector,battery:window.testHass.states['sensor.s05_battery_level'].state}));
  try{
    await page.evaluate(()=>{
      window.views.mobile.hidden=[];window.views.mobile.charge_curve=false;delete window.views.mobile.charge_cost_selector;window.costs.sessions={};
      const s=Date.now()-36e5;window.pageRows=[{id:'live-1',s,e:Date.now(),live:true,from:50,to:70,kwh:3.7,capacity:18.4,dc:false,pricing:{energy:null,cost:null,estimated:true},assignment:null}];
      window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));
    });
    /* 1. charging with an unassigned live session: Not priced in the chip, selector strip for an admin, 44 px controls */
    await setCharging(true,70);
    await block.waitFor();
    assert.equal(await chip.count(),1,'The charging block carries the cost chip');
    assert.equal(await chipText(),'Not priced');
    assert.equal(await block.locator('[data-cc-amount]').getAttribute('aria-live'),'polite');
    assert.equal(await block.locator('select').count(),1,'An admin sees the selector');
    assert.equal(await block.locator('[data-cc=save]').isDisabled(),true,'Save waits for a choice');
    assert.equal(await block.locator('[data-cc=save]').textContent().then(t=>t.trim()),'','Icon-only button');
    assert.equal(await card.locator('.charge-assignment-prompt').count(),0,'Never next to the end-of-charge prompt');
    assert((await block.locator('[data-cc=save]').evaluate(b=>Math.round(b.getBoundingClientRect().height)))>=44,'Buttons are at least 44 px high');
    assert((await block.locator('deepal-companion-choice').evaluate(p=>Math.round(p.getBoundingClientRect().height)))>=44,'The picker is at least 44 px high');
    assert((await card.locator('.charge .cg-stat').count())>=2,'The charging block shows its figures');

    /* 2. assign: the fast path writes a session record, the strip fades away and the chip shows the estimate */
    const before=await writes();
    await choose('home');await block.locator('[data-cc=save]').click();
    await block.waitFor({state:'detached'});
    assert.equal(await writes(),before+1);
    assert.equal(await page.evaluate(()=>window.calls.filter(m=>m.op==='charge_profile_assign').at(-1).data.profile_id),'home');
    assert.equal(await page.evaluate(k=>window.costs.sessions[k].profile.id,await key()),'home');
    await page.waitForFunction(()=>document.querySelector('#mobile').shadowRoot.querySelector('.charge [data-cc-chip-amount]')?.textContent.includes('≈'));
    /* energy × tariff: (70-50)% of 18.4 kWh ÷ 0.9 = 4.09 kWh at the Home price (earlier tests may have changed it, so it is read from the fixture) */
    const homePrice=await page.evaluate(()=>window.costs.profiles.find(p=>p.id==='home').price);
    assert.equal(await chipText(),'≈ €'+(20*18.4/100/.9*homePrice).toFixed(2));
    assert((await card.locator('.charge .cg-chip small').textContent()).includes('Home'));
    assert.equal(await card.locator('.charge-assignment-prompt').count(),0);

    /* 3. a typed receipt survives a location change made from the chip */
    await page.evaluate(async k=>{const profile=structuredClone(window.costs.profiles.find(p=>p.id==='home'));window.costs.sessions[k]={start:window.pageRows[0].s,capacity:18.4,profile,energy:5,total:3.2};},await key());
    await setCharging(true,71);
    await page.waitForFunction(()=>document.querySelector('#mobile').shadowRoot.querySelector('.charge [data-cc-chip-amount]')?.textContent.trim()==='€3.20');
    await card.locator('.charge [data-cc-chip]').click();
    await block.waitFor();
    assert.equal(await block.locator('select').evaluate(s=>s.value),'home','The selector starts on the current location');
    await choose('ionity');await block.locator('[data-cc=save]').click();
    await block.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.querySelector('#mobile').shadowRoot.querySelector('.charge .cg-chip small')?.textContent.startsWith('Ionity'));
    const k=await key();
    const receipt=await page.evaluate(k=>structuredClone(window.costs.sessions[k]),k);
    assert.equal(receipt.profile.id,'ionity');assert.equal(receipt.energy,5);assert.equal(receipt.total,3.2);
    const call=await page.evaluate(()=>window.calls.filter(m=>m.op==='costs_set').at(-1).data);
    assert.equal(call.expected_changes.sessions[k].profile.id,'home','The record that was read is sent as the expected value');
    assert.equal(await chipText(),'€3.20');

    /* 4. a receipt changed elsewhere: the usual wording, nothing is retried */
    await page.evaluate(()=>{window.costsConflict=true;});
    const conflictWrites=await writes();
    await card.locator('.charge [data-cc-chip]').click();await block.waitFor();await choose('work');await block.locator('[data-cc=save]').click();
    await card.locator('text=changed elsewhere').first().waitFor();
    assert.equal(await writes(),conflictWrites+1,'No blind retry');
    assert.equal(await page.evaluate(k=>window.costs.sessions[k].profile.id,k),'ionity');
    await page.evaluate(()=>{window.costsConflict=false;});
    await block.waitFor({state:'detached'});

    /* 5. a non-admin only reads */
    await page.evaluate(()=>{window.testHass.user={...window.testHass.user,is_admin:false};});
    await push();
    await page.waitForFunction(()=>!document.querySelector('#mobile').shadowRoot.querySelector('.charge [data-cc-chip]'));
    const readOnly=await writes();
    assert.equal(await block.count(),0,'No selector for a non-admin');
    assert.equal(await card.locator('.charge button[data-cc-chip]').count(),0,'The chip is read-only');
    assert.equal(await chipText(),'€3.20');
    assert.equal(await writes(),readOnly);
    await page.evaluate(()=>{window.testHass.user={...window.testHass.user,is_admin:true};});
    await push();

    /* 6. the selector switch: off keeps the strip away until the chip is tapped */
    await page.evaluate(k=>{window.costs.sessions={};window.views.mobile.charge_cost_selector=false;window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));},k);
    await setCharging(true,72);
    await page.waitForFunction(()=>document.querySelector('#mobile').shadowRoot.querySelector('.charge [data-cc-chip-amount]')?.textContent.trim()==='Not priced');
    assert.equal(await block.count(),0,'With the switch off the selector stays hidden');
    await card.locator('.charge [data-cc-chip]').click();await block.waitFor();
    assert.equal(await block.locator('select').count(),1,'Tapping the chip opens the selector');
    await card.locator('.charge [data-cc-chip]').click();await block.waitFor({state:'detached'});
    await page.evaluate(()=>{delete window.views.mobile.charge_cost_selector;window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));});

    /* 7. with the curve on, the cost is one slim bar at the foot of the curve, with icon-only buttons */
    await page.evaluate(()=>{window.costs.sessions[String(Math.round(window.pageRows[0].s/1000))]={start:window.pageRows[0].s,capacity:18.4,profile:structuredClone(window.costs.profiles[0]),energy:null,total:null};window.views.mobile.charge_curve=true;window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));});
    await setCharging(true,73);
    const inCurve=card.locator('.charging-curve-block [data-curve-cost] .charge-cost-live');await inCurve.waitFor();
    assert.equal(await card.locator('.charge-cost-live').count(),1,'One cost bar');
    const sub=(await inCurve.locator('[data-cc-sub]').textContent()).trim();
    assert(sub.startsWith('Home')&&sub.includes(homePrice+' €/kWh')&&sub.includes('kWh'),'Location, tariff and energy, got '+sub);
    assert.equal((await inCurve.locator('[data-cc=change]').textContent()).trim(),'','Buttons are icons only');
    assert.equal(await card.locator('.charging-curve-block .curve-note').count(),0,'The live curve carries no long note');
    const curveHeight=await card.locator('.charging-curve-block .curve-chart').evaluate(n=>Math.round(n.getBoundingClientRect().height/n.getBoundingClientRect().width*560));
    assert(curveHeight<=230,'The live curve is short, got '+curveHeight);
    await page.evaluate(()=>{window.views.mobile.charge_curve=false;window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));});
    await card.locator('.charging-curve-block').waitFor({state:'detached'});

    /* 8. the charge stops: the strip and the chip go away; no vehicle command is ever sent */
    await page.evaluate(()=>{window.costs.sessions={};});
    await setCharging(false,70);
    await block.waitFor({state:'detached'});
    assert.equal(await card.locator('[data-cc-chip-amount]').count(),0);
    assert.equal(await page.evaluate(()=>window.serviceCalls.length),0,'No vehicle command is ever sent');

    /* 9. the preview shows demo values and never writes */
    const panel=page.locator('deepal-companion-panel'),preview=panel.locator('.live-preview deepal-companion-card');
    await panel.evaluate(async p=>{await p.select('car','mobile');});
    await panel.locator('[name=preview_mode]').evaluate(s=>s._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'ac'},bubbles:true})));
    const demo=preview.locator('.charge-cost-live');await demo.waitFor();
    assert.equal((await demo.locator('[data-cc-amount]').textContent()).trim(),'Not priced');
    await panel.evaluate(p=>{p.previewClicks=true;window.__DEEPAL_COMPANION_UI.applyPreview(p.preview,p._hass,p.previewMode||'ac',true);});
    const previewWrites=await writes(),previewFetches=await page.evaluate(()=>window.calls.filter(m=>m.op==='sessions_page').length);
    await demo.locator('select').evaluate(select=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'home'},bubbles:true})));
    await demo.locator('[data-cc=save]').click();
    await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.live-preview deepal-companion-card')?.shadowRoot.querySelector('.charge [data-cc-chip-amount]')?.textContent.includes('≈'));
    assert.equal(await writes(),previewWrites,'The preview never saves');
    assert.equal(await page.evaluate(()=>window.calls.filter(m=>m.op==='sessions_page').length),previewFetches,'The preview never asks the backend for a session');
    await preview.locator('text=No costs were saved').first().waitFor();

    /* 10. Status is drawn on the image: it is a line of the Vehicle image row, without its own row, arrows or handle */
    await panel.evaluate(async p=>{await p.select('car','mobile');p.settings.tab='layout';p.settings._render();});
    const settings=panel.locator('deepal-companion-settings'),status=settings.locator('.row[data-id=hero] .pin-sub');
    await status.waitFor();
    assert.equal(await settings.locator('.row[data-id=status]').count(),0,'Status has no row of its own');
    assert.equal(await status.locator('[data-mv],.grip').count(),0,'Status has no arrows or handle');
    const order=()=>panel.evaluate(p=>p.settings._cfg.order.slice());
    const saved=await order();assert.equal(saved.filter(x=>x==='status').length,1);
    await settings.locator('[data-mv="sec|hero|1"]').click();await panel.evaluate(p=>p.queue);
    let list=await order();assert.equal(list.indexOf('hero'),1,'The Vehicle image moved down');assert.equal(list.filter(x=>x==='status').length,1,'Status is kept once');
    await settings.locator('[data-mv="sec|hero|-1"]').click();await panel.evaluate(p=>p.queue);
    list=await order();assert.deepEqual(list,saved,'Moving back restores the saved order');
  }finally{
    await page.evaluate(o=>{delete window.views.mobile.order;
      delete window.pageRows;window.costs.sessions={};window.costsConflict=false;window.testHass.user={...window.testHass.user,is_admin:true};
      for(const [key,value] of [['hidden',o.hidden],['charge_curve',o.curve],['charge_cost_selector',o.selector]]){if(value===undefined)delete window.views.mobile[key];else window.views.mobile[key]=value;}
      const states=window.testHass.states,now=new Date().toISOString();
      for(const [id,value] of [['sensor.s05_ac_charge_current',0],['sensor.s05_charge_current',0],['binary_sensor.s05_charging','off'],['binary_sensor.s05_charger_plugged','off'],['sensor.s05_battery_level',o.battery]])if(states[id])states[id]={...states[id],state:String(value),last_changed:now,last_updated:now};
      const mobile=document.getElementById('mobile');if(mobile){mobile._ccSeen=0;mobile.hass=window.testHass;}
      document.querySelector('#cards').style.display='none';scrollTo(0,0);
      window.subscribers.forEach(fn=>fn({vehicle_id:'car'}));
    },original);
    await page.locator('deepal-companion-panel').evaluate(async p=>{p.previewMode='live';p.previewClicks=false;await p.mount();}).catch(()=>{});
  }
  console.log('PASS: live charging cost chip and selector strip (fades after saving), selector switch, slim bar in the curve, receipt-safe location change, conflict handling, read-only for non-admins, demo-only preview, removal when the charge stops and Status pinned to the vehicle image.');
};
