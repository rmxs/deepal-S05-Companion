const assert=require('assert');
/* Data update rate in Card Settings -> Advanced (integration-wide, not a notification setting): Live / 5 min / 10 min,
   Live by default, saved and restored, disabled for non-administrators, and absent from the Notifications page. */
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),widget=panel.locator('deepal-companion-settings');
 const openAdvanced=async()=>{await panel.evaluate(p=>p.navigateMode('settings'));await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.profile-setup'),null,{timeout:8000});
  await widget.locator('[data-tab="vehicle"]').click();await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelectorAll('[data-update-rate]').length===3,null,{timeout:8000});};
 const state=()=>widget.evaluate(w=>[...w.shadowRoot.querySelectorAll('[data-update-rate]')].map(b=>({t:b.textContent,on:b.classList.contains('on'),d:b.disabled,o:b.scrollWidth>b.clientWidth+1})));
 try{
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:800});
   await page.evaluate(()=>{window.testHass.user.is_admin=true;window.updateRate=0;});
   await openAdvanced();
   const rows=await state();
   assert.deepEqual(rows.map(r=>r.t),['Live','5 min','10 min'],'Three choices at '+width+'px');
   assert.deepEqual(rows.map(r=>r.on),[true,false,false],'Live is the default');
   assert(!rows.some(r=>r.o),'Labels must fit at '+width+'px');
  }
  await widget.locator('[data-update-rate="600"]').click();
  await page.waitForFunction(()=>window.updateRate===600,null,{timeout:4000});
  assert(await page.evaluate(()=>window.calls.some(m=>m.op==='update_rate_set'&&m.data?.seconds===600)),'The change must send update_rate_set');
  assert.deepEqual((await state()).map(r=>r.on),[false,false,true],'The chosen rate is highlighted');
  await panel.evaluate(p=>p.navigateMode('notifications'));await openAdvanced();
  assert.deepEqual((await state()).map(r=>r.on),[false,false,true],'The saved rate is shown again after reopening');
  assert.equal(await page.evaluate(()=>window.testHass.callWS({type:'deepal_companion/request',op:'update_rate_set',data:{seconds:123}}).then(()=>false,()=>true)),true,'An unknown rate must be rejected');
  await panel.evaluate(p=>p.navigateMode('notifications'));await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.local-notifications')?.shadowRoot?.querySelector('.deepal-language-box'),null,{timeout:8000});
  assert.equal(await panel.evaluate(p=>!!p.shadowRoot.querySelector('.local-notifications').shadowRoot.querySelector('.deepal-rate-box')),false,'The Notifications page has no update rate box');
  await page.evaluate(()=>{window.testHass.user.is_admin=false;});
  await openAdvanced();
  await widget.locator('[data-tab="layout"]').click();await widget.locator('[data-tab="vehicle"]').click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelectorAll('[data-update-rate]').length===3,null,{timeout:8000});
  assert.deepEqual((await state()).map(r=>r.d),[true,true,true],'Disabled for non-administrators');
  assert.equal(await page.evaluate(()=>window.testHass.callWS({type:'deepal_companion/request',op:'update_rate_set',data:{seconds:0}}).then(()=>false,()=>true)),true,'A non-administrator must not change the rate');
  assert.equal(await page.evaluate(()=>window.updateRate),600,'A refused change keeps the saved rate');
 }finally{
  await page.evaluate(()=>{window.testHass.user.is_admin=true;window.updateRate=0;});
  /* Leave Card Settings so the next test renders it again as an administrator instead of keeping the non-admin view */
  await panel.evaluate(p=>p.navigateMode('notifications'));
  await page.setViewportSize({width:1440,height:1050});
 }
 console.log('PASS: data update rate is in Card Settings > Advanced, offers Live / 5 min / 10 min, saves and restores the choice, and is admin-only.');
};
