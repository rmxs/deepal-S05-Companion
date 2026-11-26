const assert=require('assert');
const segParity=require('./seg_parity.cjs');
/* First-run "Recommended setup" card, automatic phone choice and the saved result. Run with NOTIFY_RECOMMENDED_ONLY=1 through test_browser.cjs. */
const ONE_PHONE=[{svc:'notify.replacement_phone',name:'Current iPhone',tracker:'device_tracker.current_phone',legacy_service:'mobile_app_phone'}];
const TWO_PHONES=[{svc:'notify.replacement_phone',name:'Current iPhone',tracker:'device_tracker.current_phone',legacy_service:'mobile_app_phone'},{svc:'notify.another_users_android',name:'Another user’s Android',tracker:'',legacy_service:'mobile_app_android'}];
const RECOMMENDED=['charge_done','unlocked','warn_crit'];
module.exports=async page=>{
 const pageErrors=[];const onError=error=>pageErrors.push(error.message);page.on('pageerror',onError);
 const panel=page.locator('deepal-companion-panel');
 const busyDone=()=>page.waitForFunction(()=>{const b=document.querySelector('deepal-companion-panel').localBoard;return !!b&&!b.busy&&!b.dirty;});
 const setRecipients=(rows,saved)=>page.evaluate(([rows,saved])=>{window.testRecipients=rows;if(saved===undefined)delete window.localNotifications;else window.localNotifications=saved;window.pageMocks={...(window.pageMocks||{}),notifications_get:()=>({live_supported:true,value:structuredClone(window.localNotifications||{enabled:false,rules:[]}),history:[],activity:{rows:[],total:0,has_more:false,readonly:true},state:{},recipients:structuredClone(window.testRecipients)})};},[rows,saved]);
 const open=async()=>{await panel.evaluate(p=>p.navigateMode('settings'));await panel.evaluate(p=>p.navigateMode('notifications'));const board=panel.locator('.supplied-notification-design');await board.waitFor();await busyDone();return board;};
 try{
  /* 1. One phone, first run: the card shows, the phone is preselected, nothing is saved until the button is pressed. */
  await setRecipients(ONE_PHONE);
  let board=await open();
  /* the quiet-mode and filter-preset choices are the Settings .seg: same sliding pill, size, colour and button look */
  assert.equal(await board.locator('#design-recommend').count(),1,'First run shows the recommended setup card');
  assert.match(await board.locator('#design-recommend h3').textContent(),/Recommended setup/);
  assert.equal(await board.locator('#master-panel-toggle').isChecked(),false,'Master stays off until the user chooses');
  assert.equal(await board.locator('.device-pill[data-recipient="notify.replacement_phone"]').getAttribute('aria-checked'),'true','The only phone is preselected');
  assert.equal(await page.evaluate(()=>window.localNotifications),undefined,'Opening the page saves nothing');
  await board.locator('[data-command=recommended]').click();
  await page.waitForFunction(()=>window.localNotifications?.enabled===true);await busyDone();
  const saved=await page.evaluate(()=>structuredClone(window.localNotifications));
  assert.equal(saved.enabled,true,'Use recommended turns the master switch on');
  const on=saved.rules.filter(rule=>rule.enabled).map(rule=>rule.preset||rule.id).sort();
  assert.deepEqual(on,[...RECOMMENDED].sort(),'Exactly the three recommended alerts are on');
  for(const rule of saved.rules.filter(rule=>rule.enabled))assert.deepEqual(rule.devices,['notify.replacement_phone'],'Enabled alerts go to the preselected phone');
  assert.equal(await board.locator('#design-recommend').count(),0,'The card disappears after the first save');
  assert.equal(await board.locator('#master-panel-toggle').isChecked(),true);
  assert.equal(await board.locator('[data-alert-toggle=plugged_idle]').isChecked(),false,'Other alerts stay off');
  /* the quiet-mode and filter-preset choices are the Settings .seg: same sliding pill, size, colour and button look (checked once the overview is shown) */
  await segParity(page,['deepal-companion-panel','.supplied-notification-design'],['.seg:has(> .quiet-mode-btn)','.seg:has(> .preset-btn)']);

  /* 2. A configured user sees no card and no change; turning the master on with the one phone just works. */
  await setRecipients(ONE_PHONE,{enabled:false,rules:[],ui:{}});
  const configured=await page.evaluate(()=>JSON.stringify(window.localNotifications));
  board=await open();
  assert.equal(await board.locator('#design-recommend').count(),0,'A configured user sees no recommended card');
  assert.equal(await board.locator('#master-panel-toggle').isChecked(),false,'Master stays as saved');
  assert.equal(await board.locator('.device-pill[data-recipient="notify.replacement_phone"]').getAttribute('aria-checked'),'false','No phone is selected on load for a configured user');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.localNotifications)),configured,'Opening the page does not rewrite saved settings');
  await board.locator('#master-panel-toggle').locator('..').click();
  await page.waitForFunction(()=>window.localNotifications?.enabled===true);await busyDone();
  const enabled=await page.evaluate(()=>structuredClone(window.localNotifications));
  assert.equal(enabled.rules.find(rule=>rule.preset==='plugged_idle').enabled,false,'Turning the master on does not switch on the recommended setup');
  assert.deepEqual(enabled.rules.find(rule=>rule.preset==='charge_done')?.devices,['notify.replacement_phone'],'Turning the master on selects the single phone');

  /* 3. Two phones and no match: no error, the hint asks for a phone, the events are on, and nothing is saved before a phone is chosen. */
  await setRecipients(TWO_PHONES);
  board=await open();
  assert.equal(await board.locator('#design-recommend').count(),1);
  assert.equal(await board.locator('.device-pill[data-recipient="notify.replacement_phone"]').getAttribute('aria-checked'),'false','Two phones with no match: nothing is selected');
  await board.locator('[data-command=recommended]').click();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>window.localNotifications),undefined,'Nothing is saved before a phone is chosen');
  assert.equal(await board.locator('.design-recommend-hint').isVisible(),true,'Hint: Choose your phone below');
  assert.equal(await board.locator('#toast[data-kind=error]').count(),0,'No error is shown');
  assert.equal(await board.locator('#master-panel-toggle').isChecked(),true,'Master is on');
  for(const id of RECOMMENDED)assert.equal(await board.locator('[data-alert-toggle='+id+']').isChecked(),true,id+' is on');
  assert.equal(await board.locator('[data-alert-toggle=plugged_idle]').isChecked(),false);
  await board.locator('.device-pill[data-recipient="notify.another_users_android"]').click();
  await page.waitForFunction(()=>window.localNotifications?.enabled===true);await busyDone();
  assert.equal(await board.locator('.design-recommend-hint').isVisible(),false,'The hint goes away once a phone is chosen');
  assert.deepEqual((await page.evaluate(()=>window.localNotifications)).rules.find(rule=>rule.preset==='charge_done').devices,['notify.another_users_android']);
  assert.equal(await board.locator('#design-recommend').count(),0,'The card disappears after the save');

  /* 4. Two phones, one of them is the signed-in user's phone (person entity with the same user id and tracker): it is preselected. */
  await setRecipients(TWO_PHONES,null);
  await page.evaluate(()=>{window.testHass.states['person.tester']={entity_id:'person.tester',state:'home',attributes:{user_id:'admin',device_trackers:['device_tracker.current_phone'],friendly_name:'Tester'}};});
  board=await open();
  assert.equal(await board.locator('.device-pill[data-recipient="notify.replacement_phone"]').getAttribute('aria-checked'),'true','The signed-in user’s phone is preselected');
  assert.equal(await board.locator('.device-pill[data-recipient="notify.another_users_android"]').getAttribute('aria-checked'),'false');
  await board.locator('[data-command=recommended]').click();
  await page.waitForFunction(()=>window.localNotifications?.enabled===true);await busyDone();
  assert.deepEqual((await page.evaluate(()=>window.localNotifications)).rules.find(rule=>rule.preset==='unlocked').devices,['notify.replacement_phone']);
  assert.equal(pageErrors.length,0,pageErrors.join('\n'));
  console.log('PASS: recommended card on first run only, automatic phone (single, signed-in user match, or hint), recommended presets saved, configured users unchanged.');
 } finally {
  page.off('pageerror',onError);
  await page.evaluate(()=>{delete window.localNotifications;delete window.testRecipients;if(window.pageMocks)delete window.pageMocks.notifications_get;if(window.testHass?.states)delete window.testHass.states['person.tester'];}).catch(()=>{});
 }
};
