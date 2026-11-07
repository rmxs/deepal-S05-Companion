const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),saved=await page.evaluate(()=>structuredClone(window.localNotifications||null)),sends=await page.evaluate(()=>window.localTestSends||0);
 try{
  await page.evaluate(()=>{window.localNotifications=null;});
  await panel.evaluate(p=>p.navigateMode('notifications'));const board=panel.locator('.supplied-notification-design');await board.waitFor();
  await board.locator('.device-pill[data-recipient="notify.replacement_phone"]').click();
  await board.locator('#master-panel-toggle').locator('..').click();
  await board.locator('#live-enabled').locator('..').click();
  await board.locator('[data-alert-id=charge_done] [data-alert-open]').first().click();
  await board.locator('#input-title').fill('My saved charging alert');await board.locator('#input-msg').fill('Battery {battery}% — my custom message');
  await board.locator('#view-detail [data-command=save]').click();await page.waitForFunction(()=>{const b=document.querySelector('deepal-companion-panel').localBoard;return b&&!b.busy&&!b.dirty;});
  const stored=await page.evaluate(()=>structuredClone(window.localNotifications));assert.equal(stored.enabled,true);assert(stored.rules.some(r=>r.title==='My saved charging alert'));
  assert.equal(stored.live_charging.enabled,true);
  assert.equal(typeof stored.ui.events.charge_done.on,'boolean');assert.equal(typeof stored.ui.events.charge_done.delay,'number');assert.equal(typeof stored.ui.quiet.on,'boolean','Default-valued preferences must be stored explicitly');
  const writes=await page.evaluate(()=>window.calls.filter(c=>c.op==='notifications_set').length);
  await panel.evaluate(async p=>{await p.navigateMode('settings');await p.navigateMode('notifications');});await board.waitFor();
  assert.equal(await board.locator('#master-panel-toggle').isChecked(),true);
  assert.equal(await board.locator('#live-enabled').isChecked(),true,'Live charging ON survives reopening Notifications');
  await board.locator('[data-alert-id=charge_done] [data-alert-open]').first().click();assert.equal(await board.locator('#input-title').inputValue(),'My saved charging alert');assert.equal(await board.locator('#input-msg').inputValue(),'Battery {battery}% — my custom message');
  assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.op==='notifications_set').length),writes,'Loading Notifications must never save defaults');
  assert.deepEqual(await page.evaluate(()=>window.localNotifications),stored);assert.equal(await page.evaluate(()=>window.localTestSends||0),sends,'Persistence checks do not send notifications');
  await page.evaluate(()=>{const value=window.localNotifications;delete value.ui.events.charge_done.delay;const rule=value.rules.find(r=>r.preset==='charge_done');rule.preset_options.delay=13;rule.delay=780;});
  await panel.evaluate(async p=>{await p.navigateMode('settings');await p.navigateMode('notifications');});await board.waitFor();await board.locator('[data-alert-id=charge_done] [data-alert-open]').first().click();assert.equal(await board.locator('#input-delay').inputValue(),'13','Older compact preferences recover omitted values from saved rules');
  await panel.evaluate(async p=>{await p.navigateMode('settings');await p.navigateMode('notifications');});await board.waitFor();await board.locator('#live-enabled').locator('..').click();await board.locator('#view-overview [data-command=save]').click();await page.waitForFunction(()=>{const b=document.querySelector('deepal-companion-panel').localBoard;return b&&!b.busy&&!b.dirty;});assert.equal(await page.evaluate(()=>window.localNotifications.live_charging.enabled),false);
  await panel.evaluate(async p=>{await p.navigateMode('settings');await p.navigateMode('notifications');});await board.waitFor();assert.equal(await board.locator('#live-enabled').isChecked(),false,'Live charging OFF must also survive reopening');
 }finally{await page.evaluate(value=>{window.localNotifications=value;},saved);await panel.evaluate(async p=>{if(p.localBoard)p.localBoard.dirty=false;await p.navigateMode('settings');});}
 console.log('PASS: Live charging ON/OFF, notification master, recipients and custom message persist after reload; older compact saves recover their values.');
};
