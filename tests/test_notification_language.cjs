const assert=require('assert');
/* Notification language box at the top of the Notifications page: same width, corners and colours as the Notifications card at phone and desktop widths,
   a saved choice that survives leaving and reopening the page, and refused for non-administrators. */
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel');
 const rootOf=()=>panel.evaluate(p=>p.shadowRoot.querySelector('.local-notifications')?.shadowRoot);
 const box=(sel)=>panel.evaluate((p,sel)=>{const r=p.shadowRoot.querySelector('.local-notifications').shadowRoot;const e=r.querySelector(sel);if(!e)return null;const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {left:b.left,width:b.width,pad:s.padding,radius:s.borderTopLeftRadius,border:s.borderTopColor,bg:s.backgroundColor,select:!!e.querySelector('select')};},sel);
 const openNotifications=async()=>{await panel.evaluate(p=>p.navigateMode('notifications'));await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.local-notifications')?.shadowRoot?.querySelector('.deepal-language-box'),null,{timeout:8000});};
 const setLanguage=async value=>{await panel.evaluate((p,v)=>{const s=p.shadowRoot.querySelector('.local-notifications').shadowRoot.querySelector('.deepal-language-box select');s.value=v;s.dispatchEvent(new Event('change'));},value);};
 const setAdmin=(admin,language)=>page.evaluate(([a,l])=>{window.testHass.user.is_admin=a;window.notificationLanguage=l;},[admin,language]);
 const selected=()=>panel.evaluate(p=>p.shadowRoot.querySelector('.local-notifications').shadowRoot.querySelector('.deepal-language-box select').value);
 try{
  await setAdmin(true,'auto');
  /* Phone width: the Notifications page uses the same side margins as the Settings page */
  await page.setViewportSize({width:390,height:800});
  await panel.evaluate(p=>p.navigateMode('settings'));await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.profile-setup'),null,{timeout:8000});
  const settingsBox=await panel.evaluate(p=>{const b=p.shadowRoot.querySelector('.profile-setup').getBoundingClientRect();return {left:b.left,width:b.width};});
  await openNotifications();
  const notifyBox=await panel.evaluate(p=>{const b=p.shadowRoot.querySelector('.local-notifications').shadowRoot.querySelector('.deepal-language-box').getBoundingClientRect();return {left:b.left,width:b.width};});
  assert(Math.abs(notifyBox.left-settingsBox.left)<0.5&&Math.abs(notifyBox.width-settingsBox.width)<0.5,'Notifications side margins must match the Settings page at 390px: '+JSON.stringify({notifyBox,settingsBox}));
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:800});
   await openNotifications();
   const language=await box('.deepal-language-box');
   assert(language&&language.select,'The Notification language box must sit at the top of the page');
   const reference=await panel.evaluate(p=>{const r=p.shadowRoot.querySelector('.local-notifications').shadowRoot;const c=[...r.querySelectorAll('.ha-card')].find(e=>(e.textContent||'').trim().startsWith('Master switch'));const b=c.getBoundingClientRect(),s=getComputedStyle(c);return {left:b.left,width:b.width,pad:s.padding,radius:s.borderTopLeftRadius,border:s.borderTopColor,bg:s.backgroundColor};});
   assert(Math.abs(language.left-reference.left)<0.5&&Math.abs(language.width-reference.width)<0.5,'Language box must span the same width and left edge as the Notifications card at '+width+'px '+JSON.stringify({language,reference}));
   assert.equal(language.pad,'16px','Language box padding must be the standard 16px at '+width+'px');
   assert.equal(language.radius,reference.radius,'Language box corners must match at '+width+'px');
   assert.equal(language.border,reference.border,'Language box border must match at '+width+'px');
   assert.equal(language.bg,reference.bg,'Language box background must match at '+width+'px');
   assert.equal(await panel.evaluate(p=>p.shadowRoot.querySelector('.local-notifications').shadowRoot.querySelector('.deepal-language-box select').options.length),6,'Six choices: Automatic, English, Ελληνικά, Deutsch, Español, Italiano');
  }
  /* A saved choice is sent once, stored, and shown again after leaving the page */
  await setLanguage('de');
  await page.waitForFunction(()=>window.notificationLanguage==='de');
  assert(await page.evaluate(()=>window.calls.some(m=>m.op==='notification_language_set'&&m.data?.language==='de')),'The change must send notification_language_set');
  await panel.evaluate(p=>p.navigateMode('settings'));await openNotifications();
  assert.equal(await selected(),'de','The saved language must be shown again after reopening the page');
  /* Unknown languages are refused by the integration and the box goes back to the saved value */
  const refused=await page.evaluate(()=>window.testHass.callWS({type:'deepal_companion/request',op:'notification_language_set',vehicle_id:'',view_id:'',data:{language:'fr'}}).then(()=>false,()=>true));
  assert.equal(refused,true,'An unknown language must be rejected');
  assert.equal(await page.evaluate(()=>window.notificationLanguage),'de','A rejected language must not change the saved choice');
  /* Only an administrator may change the language: the integration refuses the change and the saved value stays */
  await setAdmin(false,'de');
  const adminOnly=await page.evaluate(()=>window.testHass.callWS({type:'deepal_companion/request',op:'notification_language_set',vehicle_id:'',view_id:'',data:{language:'it'}}).then(()=>false,()=>true));
  assert.equal(adminOnly,true,'A non-administrator must not change the language');
  assert.equal(await page.evaluate(()=>window.notificationLanguage),'de','A refused change must not alter the saved language');
 }finally{
  await setAdmin(true,'auto');
  await page.setViewportSize({width:1440,height:1050});
 }
 console.log('PASS: notification language box matches the Notifications card at 390 and 1440 px, saves the choice, rejects unknown languages and refuses non-administrators.');
};
