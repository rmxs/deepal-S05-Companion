const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),snapshot=await page.evaluate(()=>({views:structuredClone(window.views),selection:localStorage.getItem('deepal-companion-selection:admin')}));
 try{
  await panel.evaluate(async p=>{await p.select('car','mobile');p.settings.tab='layout';p.settings._render();});
  const settings=panel.locator('deepal-companion-settings'),preview=panel.locator('.live-preview deepal-companion-card');
  await panel.locator('[name=preview_mode]').evaluate(s=>s._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'charge-detected'},bubbles:true})));
  await panel.evaluate(p=>p.patch({hidden:['costs'],charging_reminder:true}));
  await preview.locator('.charge-assignment-prompt').waitFor();assert.equal(await preview.locator('.companion-cost-launch').isVisible(),false);
  assert.equal(await panel.locator('.preview-mode-note.preview-info[role=note]').count(),1);
  const note=await panel.locator('.preview-mode-note').evaluate(n=>{const s=getComputedStyle(n);return {border:s.borderLeftWidth,bg:s.backgroundColor};});assert.equal(note.border,'3px');assert.notEqual(note.bg,'rgba(0, 0, 0, 0)');
  await settings.locator('[data-vis="sec|reminder"]').click();await panel.evaluate(p=>p.queue);
  assert.equal(await page.evaluate(()=>window.views.mobile.charging_reminder),false);assert.equal(await preview.locator('.charge-assignment-prompt').count(),0);
  await settings.locator('[data-vis="sec|costs"]').click();await panel.evaluate(p=>p.queue);
  assert.equal(await preview.locator('.companion-cost-launch').isVisible(),true);assert.equal(await preview.locator('.charge-assignment-prompt').count(),0);
  await settings.locator('[data-vis="sec|reminder"]').click();await panel.evaluate(p=>p.queue);await preview.locator('.charge-assignment-prompt').waitFor();assert.equal(await preview.locator('.companion-cost-launch').isVisible(),true);
  await settings.locator('[data-vis="sec|costs"]').click();await panel.evaluate(p=>p.queue);await preview.locator('.charge-assignment-prompt').waitFor();assert.equal(await preview.locator('.companion-cost-launch').isVisible(),false);
  await panel.evaluate(async p=>{await p.select('car','tablet');await p.patch({car_color:'blue',charging_reminder:false,hidden:[]});});
  const before=await page.evaluate(()=>({views:structuredClone(window.views),costs:structuredClone(window.costs),notifications:structuredClone(window.localNotifications||null),writes:window.calls.filter(c=>c.op==='config_patch').length}));
  await panel.evaluate(p=>{p.remove();const fresh=document.createElement('deepal-companion-panel');document.querySelector('#panel').append(fresh);fresh.hass=window.testHass;});
  await page.waitForFunction(()=>{const p=document.querySelector('deepal-companion-panel');return p.selected.view_id==='tablet'&&p.settings&&p.config?.car_color==='blue';});
  assert.deepEqual(await page.evaluate(()=>({views:window.views,costs:window.costs,notifications:window.localNotifications||null,writes:window.calls.filter(c=>c.op==='config_patch').length})),before,'Refresh/update must restore the selected profile without writing defaults');
  assert.equal(await panel.evaluate(p=>p.config.charging_reminder),false);
 }finally{
  await page.evaluate(value=>{window.views=value.views;if(value.selection===null)localStorage.removeItem('deepal-companion-selection:admin');else localStorage.setItem('deepal-companion-selection:admin',value.selection);},snapshot);
  await panel.evaluate(async p=>{await p.select('car','mobile');p.previewMode='live';p.previewClicks=false;await p.mount();});
 }
 console.log('PASS: independent cost/reminder switches in all four states, coloured preview note, profile selection after reload and no default writes.');
};
