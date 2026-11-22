const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),saved=await page.evaluate(()=>structuredClone(window.costs));
 const nav=async mode=>{await panel.locator('[data-mode='+mode+']').click();await page.waitForFunction(mode=>{const p=document.querySelector('deepal-companion-panel');return p.mode===mode&&!p.shadowRoot.querySelector('.stage').classList.contains('is-loading');},mode);};
 try{
   await nav('chargers');
   /* profile tile icons are outlines in the theme colour, not the browser's default black fill */
   {const ic=await panel.locator('.cc-loc-ic svg').first().evaluate(el=>({fill:getComputedStyle(el).fill,stroke:getComputedStyle(el).stroke,color:getComputedStyle(el.parentElement).color}));assert.equal(ic.fill,'none','Profile icon must not be filled black');assert.equal(ic.stroke,ic.color,'Profile icon follows the theme colour');}
   const grips=panel.locator('.cc-grip');await grips.first().scrollIntoViewIfNeeded();const fromBox=await grips.first().boundingBox(),toBox=await grips.nth(1).boundingBox();await page.mouse.move(fromBox.x+fromBox.width/2,fromBox.y+fromBox.height/2);await page.mouse.down();await page.mouse.move(fromBox.x+fromBox.width/2,toBox.y+toBox.height/2,{steps:8});assert(await panel.locator('.cc-location-details').nth(1).evaluate(row=>row.style.transform.includes('translateY')),'Neighbouring profile moves during the drag');await page.mouse.up();await page.waitForFunction(id=>window.costs.profiles[1].id===id,saved.profiles[0].id);await grips.nth(1).press('ArrowUp');await page.waitForFunction(id=>window.costs.profiles[0].id===id,saved.profiles[0].id);assert.deepEqual(await page.evaluate(()=>window.costs.sessions),saved.sessions,'Reordering preserves session receipts');
   const validation=await page.evaluate(()=>{const root=document.querySelector('deepal-companion-panel'),manager=root.costs,group=root.shadowRoot.querySelector('.cc-profile'),source=group.querySelector('[name=source]'),entity=group.querySelector('[name=entity]'),hass=manager.card._hass;hass.states['sensor.test_kw']={attributes:{unit_of_measurement:'kW'}};hass.states['sensor.test_wh']={attributes:{unit_of_measurement:'Wh'}};source.value='power';entity.value='sensor.s05_ac_charge_current';let powerRejectsAmp=false;try{manager.collectProfiles(true);}catch(_){powerRejectsAmp=true;}entity.value='sensor.test_kw';manager.collectProfiles(true);source.value='total';entity.value='sensor.test_wh';manager.collectProfiles(true);source.value='power';entity.value='sensor.test_wh';let powerRejectsEnergy=true;try{manager.collectProfiles(true);powerRejectsEnergy=false;}catch(_){}source.value='battery';entity.value='';return {powerRejectsAmp,powerRejectsEnergy};});assert.deepEqual(validation,{powerRejectsAmp:true,powerRejectsEnergy:true},'Profile unit validation must match the selected source');const first=panel.locator('.cc-location-details').first();await first.locator('summary').click();
   await first.locator('input[name=name]').fill('Zun');await first.getByRole('option',{name:'Zunder · Spain',exact:true}).click();assert.equal(await first.locator('input[name=name]').inputValue(),'Zunder');
   await first.locator('input[name=name]').fill('My own garage');assert.equal(await first.locator('input[name=name]').inputValue(),'My own garage');
   await page.waitForFunction(()=>window.costs.profiles[0].name==='My own garage');
   await first.locator('[data-cc=remove-profile]').click();assert((await first.locator('.cc-delete-confirm').textContent()).includes('saved costs will be kept'));
   await first.locator('[data-cc=remove-cancel]').click();assert.equal(await panel.locator('.cc-profile').count(),saved.profiles.length);
   await first.locator('[data-cc=remove-profile]').click();await first.locator('[data-cc=remove-confirm]').click();assert.equal(await panel.locator('.cc-profile').count(),saved.profiles.length-1);
   await page.waitForFunction(n=>window.costs.profiles.length===n,saved.profiles.length-1);
   while(await panel.locator('.cc-profile').count()){
     const item=panel.locator('.cc-location-details').first();await item.locator('summary').click();await item.locator('[data-cc=remove-profile]').click();await item.locator('[data-cc=remove-confirm]').click();
   }
   await page.waitForFunction(()=>window.costs.profiles.length===0);
   await panel.evaluate(async root=>{await root.costs.load();root.costs.renderEditor();});assert.equal(await panel.locator('.cc-profile').count(),0,'Deleted presets must not return on reload');
   assert.deepEqual(await page.evaluate(()=>window.costs.sessions),saved.sessions,'Deleting profiles leaves saved receipts unchanged');
   await panel.locator('[data-cc=add]').click();assert.equal(await panel.locator('.cc-profile').count(),1);await page.waitForFunction(()=>window.costs.profiles.length===1);
   {const added=panel.locator('.cc-location-details').first();await added.locator('summary').click();await added.locator('[data-cc=remove-profile]').click();await added.locator('[data-cc=remove-confirm]').click();await page.waitForFunction(()=>window.costs.profiles.length===0);}
   await page.evaluate(async()=>{const rows=await window.testHass.callWS({type:'deepal_companion/request',op:'sessions',data:{}}),key=String(Math.round(rows[0].s/1000));window.costs.sessions[key]={profile:{id:'home',name:'Old Home',source:'battery',price:.22,free:false,efficiency:90},capacity:18.4};});
   await nav('history');const removed=panel.locator('.removed-profile-action').first();await removed.waitFor();const retained=await page.evaluate(()=>JSON.stringify(window.costs.sessions));
   await removed.click();assert((await panel.locator('.session-price-dialog .cc-removed-profile').textContent()).includes('cost are kept'));await panel.locator('.session-price-dialog [data-cc=cancel]').click();assert.equal(await page.evaluate(()=>JSON.stringify(window.costs.sessions)),retained);
   await panel.locator('[data-action=session-view-table]').click();await panel.locator('td[data-label=Location] .removed-profile-action').waitFor();await panel.locator('[data-action=session-view-grid]').click();
   await page.evaluate(value=>{window.costs.profiles=[structuredClone(value.profiles.find(p=>p.id==='work'))];},saved);
   await panel.locator('.removed-profile-action').first().click();await panel.locator('.session-price-dialog [name=profile]').evaluate(select=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'work'},bubbles:true})));await panel.locator('.session-price-dialog [data-cc=save-session]').click();await panel.locator('.session-price-dialog').waitFor({state:'detached'});assert.equal(await panel.locator('.removed-profile-action').count(),0);
   await page.evaluate(value=>{window.costs=structuredClone(value);},saved);
   await nav('chargers');await nav('history');await panel.locator('[data-action=edit-session]').first().click();const dialog=panel.locator('.session-price-dialog');
   await dialog.locator('[name=profile]').evaluate(select=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'work'},bubbles:true})));
   if(await dialog.locator('.cc-advanced').getAttribute('open')===null)await dialog.locator('.cc-advanced summary').click();await dialog.locator('[name=total]').fill('12.34');
   assert.equal(await dialog.locator('[name=profile]').inputValue(),'__manual__');assert.equal(await dialog.locator('[name=free]').isChecked(),false);
   await dialog.locator('[data-cc=save-session]').click();await dialog.waitFor({state:'detached'});
   const receipt=await page.evaluate(()=>Object.values(window.costs.sessions).find(r=>r.total===12.34));assert.equal(receipt.profile.id,'manual');
   await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').dashboardSummary.cost===12.34,'Manual total must refresh aggregate costs');
   await panel.locator('[data-action=edit-session]').first().click();assert.equal(await dialog.locator('[name=profile]').inputValue(),'__manual__');assert.equal(await dialog.locator('[name=total]').inputValue(),'12.34','Saved total must reload when reopening the session');
   await dialog.locator('[name=total]').fill('');await dialog.locator('[name=price]').fill('0.5');await dialog.locator('[data-cc=save-session]').click();await dialog.waitFor({state:'detached'});
   const priceReceipt=await page.evaluate(()=>Object.values(window.costs.sessions).find(r=>r.profile.id==='manual'));assert.equal(priceReceipt.profile.price,.5);assert.equal(priceReceipt.total,null);
   await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').dashboardSummary.cost>0&&document.querySelector('deepal-companion-panel').dashboardSummary.cost!==12.34,'Manual tariff must refresh aggregate costs');
   await panel.locator('[data-action=edit-session]').first().click();await dialog.locator('[name=total]').fill('0');assert.equal(await dialog.locator('[name=profile]').inputValue(),'__manual__');await dialog.locator('[data-cc=save-session]').click();await dialog.waitFor({state:'detached'});
   assert(await page.evaluate(()=>Object.values(window.costs.sessions).some(r=>r.total===0&&r.profile.id==='manual')));
   await nav('settings');const preview=panel.locator('.live-preview deepal-companion-card');
   await panel.evaluate(root=>{root.preview._c.hidden=root.preview._c.hidden.filter(id=>id!=='costs');});
   const mode=async value=>panel.locator('[name=preview_mode]').evaluate((select,value)=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true})),value);
   await panel.locator('[name=preview_clicks]').check();await mode('charge-detected');await preview.locator('.charge-assignment-prompt').waitFor();
   const before=await page.evaluate(()=>JSON.stringify(window.costs));const writes=await page.evaluate(()=>window.calls.filter(c=>['charge_profile_assign','charge_prompt_dismiss','costs_set'].includes(c.op)).length);
   await preview.locator('.charge-prompt-profile select').evaluate(select=>select._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'work'},bubbles:true})));
   await preview.locator('[data-charge-prompt=assign]').click();await preview.locator('.charge-assignment-prompt').waitFor({state:'detached'});
   await mode('parked');await mode('charge-detected');await preview.locator('[data-charge-prompt=costs]').click();await preview.locator('[data-charge-prompt=dismiss]').click();await preview.locator('.charge-assignment-prompt').waitFor({state:'detached'});
   assert.equal(await page.evaluate(()=>JSON.stringify(window.costs)),before);assert.equal(await page.evaluate(()=>window.calls.filter(c=>['charge_profile_assign','charge_prompt_dismiss','costs_set'].includes(c.op)).length),writes,'Demo reminder must never write to HA');
   await mode('live');await panel.locator('[name=preview_clicks]').uncheck();
 }finally{
   await page.evaluate(value=>{window.costs=structuredClone(value);},saved);
   await panel.evaluate(async root=>{root.sessionDialog?.remove();if(root.costs)root.costs.dirty=false;root.mode='settings';root.render();await root.mount();});
 }
 console.log('PASS: name suggestions, profile deletion, preserved receipts, removed-profile icons in grid/table, cancellation/reassignment, manual totals and safe reminder demo.');
};
