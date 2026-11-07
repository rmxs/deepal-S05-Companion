const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),added=[];
 try{
  await page.setViewportSize({width:390,height:800});
  added.push(...await panel.evaluate(p=>{const K=window.__DEEPAL_COMPANION_UI.notificationContext,added=[];for(const [key,,,severity]of K.DIAG){if(severity!=='r')continue;const id=K.resolveId(window.testHass,p.config,key);if(!window.testHass.states[id]){window.testHass.states[id]={state:'off',attributes:{},last_changed:new Date().toISOString()};added.push(id);}}return added;}));
  await panel.evaluate(p=>p.navigateMode('notifications'));const board=panel.locator('.supplied-notification-design');await board.waitFor();
  for(const width of [390,1440]){await page.setViewportSize({width,height:800});const before=await board.locator('#view-overview').boundingBox();await board.locator('#master-panel-toggle').locator('..').click();const after=await board.locator('#view-overview').boundingBox();assert(Math.abs(after.y-before.y)<1,'Unsaved changes must not move the block at '+width+'px');await board.locator('#view-overview [data-command=cancel]').click();const canceled=await board.locator('#view-overview').boundingBox();assert(Math.abs(canceled.y-before.y)<1,'Clearing Unsaved changes must not move the block');}
  await page.setViewportSize({width:390,height:800});
  const alert=board.locator('[data-alert-id=warn_crit] [data-alert-open]').first();await alert.scrollIntoViewIfNeeded();await panel.evaluate(p=>{p.scrollTop=Math.max(p.scrollTop,200);});
  await alert.click();await board.locator('#view-detail').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').scrollTop===0);
  const pills=board.locator('button[data-indicator].active');assert((await pills.count())>=3);
  const colors=await board.evaluate(n=>{const r=n.shadowRoot,primary=getComputedStyle(r.querySelector('#view-detail [data-command=save]')).color;return [...r.querySelectorAll('button[data-indicator].active')].map(b=>({primary,text:getComputedStyle(b).color,label:getComputedStyle(b.querySelector('span')).color}));});
  assert(colors.every(c=>c.text===c.primary&&c.label===c.primary),'Selected diagnostic buttons and labels must match the primary button foreground');
  assert((await board.locator('#main-card').boundingBox()).y<240,'Mobile alert configuration opens at its header');
  await panel.evaluate(async p=>{if(p.localBoard)p.localBoard.dirty=false;await p.navigateMode('settings');});
 }finally{await page.evaluate(ids=>{for(const id of ids)delete window.testHass.states[id];},added);await page.setViewportSize({width:1440,height:1050});}
 console.log('PASS: selected notification buttons share readable foreground colours and mobile alert settings open at the top.');
};
