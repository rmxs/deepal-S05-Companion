const assert=require('assert');
module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  const panel=page.locator('deepal-companion-panel');
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  assert.equal(new URL(page.url()).hash,'#card');
  assert.deepEqual(await panel.locator('nav [data-mode]>span').allTextContents(),['Card Settings','Notifications','Sessions','Charging Profiles','Health']);
  assert.deepEqual(await panel.locator('nav [data-mode]').evaluateAll(buttons=>buttons.map(button=>button.dataset.mode)),['settings','notifications','history','chargers','health']);
  assert.equal(await panel.locator('nav [data-mode]>ha-icon[aria-hidden=true]').count(),5);
  for(const width of [320,360,390,768,1440]){await page.setViewportSize({width,height:1050});assert(await panel.locator('nav').evaluate(nav=>nav.scrollWidth<=nav.clientWidth+1&&[...nav.children].every(button=>button.scrollWidth<=button.clientWidth+1)),'Navigation labels fit at '+width);}
  await page.setViewportSize({width:1440,height:1050});
  const version=require('../custom_components/deepal_companion/manifest.json').version;
  assert.equal(await panel.locator('header .app-credit').textContent(),`v${version} · Made with ♥ in Greece · L.K.`);
  const layout=await panel.evaluate(root=>{const r=selector=>root.shadowRoot.querySelector(selector).getBoundingClientRect();return {profile:{x:r('.profile-setup').x,bottom:r('.profile-setup').bottom},preview:{x:r('.live-preview').x,top:r('.live-preview').top},settings:{x:r('.stage').x}};});
  assert(layout.profile.x>layout.settings.x&&Math.abs(layout.profile.x-layout.preview.x)<1&&layout.profile.bottom<=layout.preview.top,'Profile belongs above the right preview');
  assert.equal(await panel.locator('.profile-setup h2 ha-icon,.preview-heading h2 ha-icon').count(),2);
  const palette=await page.evaluate(()=>{const node=document.createElement('div');window.__DEEPAL_COMPANION_UI.applyPalette(node,{lvl_green:'#11aa22',lvl_yellow:'#ddcc33',lvl_red:'#bb4422'});return ['ok','warn','bad'].map(key=>node.style.getPropertyValue('--companion-'+key));});assert.deepEqual(palette,['17,170,34','221,204,51','187,68,34']);
  await panel.locator('[data-mode=notifications]').click();await panel.locator('.local-notifications').waitFor();assert.equal(new URL(page.url()).hash,'#notifications');
  assert.equal(await panel.locator('header .app-credit').textContent(),`v${version} · Made with ♥ in Greece · L.K.`);
  await page.evaluate(()=>history.back());await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').mode==='settings'&&!!document.querySelector('deepal-companion-panel').settings);assert.equal(new URL(page.url()).hash,'#card');
  await page.evaluate(()=>history.forward());try{await panel.locator('.local-notifications').waitFor();}catch(error){console.log('HASH_FORWARD',await panel.evaluate(root=>({mode:root.mode,hash:location.hash,pending:root.pending,version:root.navigationVersion,stage:root.shadowRoot.querySelector('.stage')?.className,board:root.localBoard&&{dirty:root.localBoard.dirty,busy:root.localBoard.busy},html:root.shadowRoot.querySelector('.local-notifications')?.shadowRoot.innerHTML.slice(-400)})));throw error;}
  await panel.locator('.device-pill[data-recipient]').first().click();await page.evaluate(()=>location.hash='#costs');await page.waitForFunction(()=>location.hash==='#notifications');assert.equal(await panel.evaluate(root=>root.mode),'notifications','Unsaved changes block URL navigation');
  await panel.locator('#view-overview [data-command=cancel]').dispatchEvent('click');
  await page.evaluate(()=>location.hash='#charging');await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').mode==='chargers'&&!!document.querySelector('deepal-companion-panel').costs);
  // Recreate the panel at the saved URL to exercise the same constructor path as refresh.
  await page.evaluate(()=>{document.querySelector('deepal-companion-panel').remove();const next=document.createElement('deepal-companion-panel');document.querySelector('#panel').append(next);next.hass=window.testHass;});await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').costs);assert.equal(await panel.evaluate(root=>root.mode),'chargers');
  await panel.locator('[data-mode=settings]').click();await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  console.log('PASS: URL tab restoration, Back/Forward, unsaved-change guards, right-column profile and configured palette.');
};
