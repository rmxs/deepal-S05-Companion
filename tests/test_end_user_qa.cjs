const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel');
 const baseline=await panel.evaluate(root=>({companion_design:root.config.companion_design||'',companion_width:root.config.companion_width||0}));
 assert.equal(await panel.locator('.profile-editable input').count(),1);assert.equal(await panel.locator('.profile-design').count(),1);
 const profileSpace=await panel.evaluate(root=>{const label=root.shadowRoot.querySelector('.profile-name').getBoundingClientRect(),actions=root.shadowRoot.querySelector('.profile-controls .actions').getBoundingClientRect();return actions.top-label.bottom;});assert(profileSpace<20,'Profile actions must immediately follow the field without legacy flex-basis spacing');
 assert(await panel.evaluate(async root=>{const request=root.request,field=root.shadowRoot.querySelector('[name=profile_name]'),before=field.value;root.request=async(op,...args)=>{if(op==='view')throw Error('QA rename failed');return request.call(root,op,...args);};try{field.value='Rejected rename';await root.renameProfile(field);return field.value===before;}finally{root.request=request;}}),'Rejected profile rename restores the saved name');
 assert(await panel.evaluate(async root=>{const request=root.request;let rejectOld;root.request=function(op,...args){if(op==='config_get'&&!rejectOld)return new Promise((_,reject)=>{rejectOld=reject;});return request.call(this,op,...args);};try{const old=root.mount();await root.mount();rejectOld(Error('Obsolete page failure'));await old;return !!root.settings&&!root.shadowRoot.querySelector('.stage [role=alert]')&&root.shadowRoot.querySelectorAll('.preview-window deepal-companion-card').length===1;}finally{root.request=request;}}),'An obsolete page failure must not replace a newer page or duplicate its preview');
 await panel.locator('[name=companion_design]').evaluate(node=>node._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'tablet'},bubbles:true})));
 await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').pending&&document.querySelector('deepal-companion-panel').config.companion_design==='tablet');
 await panel.locator('[name=companion_width]').fill('840');await panel.locator('h1').click();
 await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').pending&&document.querySelector('deepal-companion-panel').config.companion_width===840);
 assert.equal(await panel.evaluate(root=>root.preview._c.companion_width),840);assert.equal(await panel.evaluate(root=>root.preview.shadowRoot.querySelectorAll('.companion-credit').length),0);
 await panel.evaluate((root,baseline)=>root.patch(baseline),baseline);
 const saves=await panel.evaluate(async root=>{
   const request=root.request,original=structuredClone(root.config);let calls=0;
   root.request=async function(op,data,owner){if(op==='config_patch'&&++calls===2)throw Error('QA rejected save');return request.call(this,op,data,owner);};
   try{
     await Promise.all([root.patch({car_color:'white'}),root.patch({car_color:'blue'})]);
     const queued=root.config.car_color==='white'&&root.preview._c.car_color==='white';
     calls=1;await root.patch({car_color:'silver'});
     return {queued,failed:root.config.car_color==='white'&&root.preview._c.car_color==='white',error:root.message};
   }finally{root.request=request;await root.patch({car_color:original.car_color});}
 });
 assert(saves.queued,'Failed second save must retain the first confirmed change');assert(saves.failed,'Failed save must restore the confirmed preview');assert(saves.error.includes('QA rejected save'));
 await panel.locator('[name=companion_width]').fill('100');await panel.locator('h1').click();
 assert.equal(await panel.locator('[name=companion_width]').evaluate(node=>node.checkValidity()),false,'Reject widths between 1 and 279 before saving');
 await panel.locator('[name=companion_width]').fill(String(baseline.companion_width));await panel.locator('h1').click();
 await panel.locator('[data-mode=notifications]').click();await panel.locator('.local-notifications').waitFor();const board=panel.locator('.local-notifications');
 await panel.evaluate(async root=>{root.qaRequest=root.request;root.request=async function(op,...args){const response=await this.qaRequest(op,...args);if(op==='notifications_get')delete response.activity;return response;};await root.mount();});
 assert.equal(await board.locator('.activity-delete:visible').count(),0,'Old backend must not offer unsupported activity deletion');assert((await board.locator('.activity-footer').textContent()).includes('Restart Home Assistant'));
 await panel.evaluate(async root=>{root.request=root.qaRequest;delete root.qaRequest;await root.mount();});
 for(const width of [1100,900,768,430,360]){
   await page.setViewportSize({width,height:800});const bounds=await board.evaluate(node=>{const root=node.shadowRoot,fields=[...root.querySelectorAll('.design-live-fields input')].filter(el=>el.getClientRects().length),r=fields.map(el=>el.getBoundingClientRect()),row=root.querySelector('.notification-alert-grid').children[2];return {fields:r.map(rect=>({top:rect.top,width:rect.width,height:rect.height})),overflow:node.scrollWidth>node.clientWidth+1,rowHeight:row.getBoundingClientRect().height};});
   assert.equal(bounds.overflow,false,'Notifications fit at '+width);assert(bounds.rowHeight<110,'Alert rows remain compact');
 }
 await page.setViewportSize({width:900,height:700});await panel.evaluate(root=>{root.scrollTop=250;root.scrollIntoView({block:'start'});});const box=await panel.boundingBox();await page.mouse.move(box.x+box.width/2,Math.max(100,box.y+300));const before=await panel.evaluate(root=>root.scrollTop);await page.mouse.wheel(0,250);await page.waitForFunction(before=>document.querySelector('deepal-companion-panel').scrollTop>before,before);const after=await panel.evaluate(root=>root.scrollTop);await page.mouse.wheel(0,-200);await page.waitForFunction(after=>document.querySelector('deepal-companion-panel').scrollTop<after,after);
 await panel.locator('[data-mode=history]').click();await panel.locator('.charge-session-list').waitFor();await panel.locator('[data-action=session-view-table]').click();assert.equal(await panel.locator('table.cost-data-table thead th').count(),6);assert.equal(await panel.locator('table.cost-data-table tbody tr').count(),await panel.evaluate(root=>root.archiveRows.length));assert.equal(await panel.locator('table.cost-data-table .charge-session-metrics').count(),0,'Table rows are actual cells, not boxed cards');
 await panel.locator('table.cost-data-table [data-action=edit-session]').first().click();await panel.locator('.session-price-dialog').waitFor();await page.keyboard.press('Escape');await panel.locator('.session-price-dialog').waitFor({state:'detached'});await panel.locator('[data-action=session-view-grid]').click();
 await panel.locator('[data-mode=settings]').click();await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').preview);await page.setViewportSize({width:1440,height:1050});
 if(process.env.QA_CAPTURE){await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.stage').classList.contains('is-loading'));await page.screenshot({path:process.env.QA_CAPTURE+'-settings.png',fullPage:true});}
 console.log('PASS: one editable profile, moved design controls save to preview, compact mobile live fields, bidirectional native scrolling, real table cells and table editing.');
};
