const assert=require('assert');
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel');
  await panel.evaluate(root=>{if(root.mode!=='settings')root.shadowRoot.querySelector('[data-mode=settings]').click();});
  await page.waitForFunction(()=>{const p=document.querySelector('deepal-companion-panel');return p.mode==='settings'&&!!p.settings;});
  const q=(width,height)=>page.setViewportSize({width,height}).then(()=>page.waitForTimeout(450));
  // Phones: the settings come first, the live preview is a folded section and the support link sits below the settings.
  await q(390,844);
  await panel.evaluate(root=>{if(root.profileOpen)root.shadowRoot.querySelector('.profile-toggle-row').click();});await page.waitForTimeout(400); // earlier tests leave the Profile box open; real users start with it folded
  const m=()=>panel.evaluate(root=>{const r=root.shadowRoot,box=s=>{const e=r.querySelector(s),b=e?.getBoundingClientRect();return e?{top:Math.round(b.top+scrollY),h:Math.round(b.height),shown:getComputedStyle(e).display!=='none'&&b.height>0}:null;};return {closed:r.querySelector('.live-preview').classList.contains('pv-closed'),open:root.previewOpen,stage:box('.stage'),inner:box('.pv-inner'),preview:box('.live-preview'),toggle:box('.pv-toggle'),inPreview:box('.preview-support'),below:box('.mobile-support'),clicks:getComputedStyle(r.querySelector('.preview-click-toggle')).display,expanded:r.querySelector('.pv-toggle').getAttribute('aria-expanded')};});
  let v=await m();
  assert.ok(v.closed&&v.expanded==='false'&&v.inner.h===0,'the preview starts folded on a phone '+JSON.stringify(v));
  assert.ok(v.stage.top<420,'the settings start within the first screen '+JSON.stringify(v));
  assert.ok(v.toggle.shown&&v.below.shown&&!v.inPreview.shown&&v.clicks==='none','toggle and bottom support link show on phones '+JSON.stringify(v));
  assert.ok(v.below.top>v.stage.top,'the support link comes after the settings');
  await panel.locator('.pv-toggle').click();await page.waitForTimeout(500);
  v=await m();assert.ok(!v.closed&&v.expanded==='true'&&v.inner.h>200&&v.clicks!=='none','the toggle opens the preview '+JSON.stringify(v));
  await panel.locator('.preview-heading h2').click();await page.waitForTimeout(500);
  v=await m();assert.ok(v.closed&&v.inner.h===0,'tapping the heading folds it again '+JSON.stringify(v));
  // A mode change keeps the choice made in this session.
  await panel.locator('.pv-toggle').click();await panel.evaluate(root=>root.shadowRoot.querySelector('[data-mode=notifications]').click());await panel.locator('.local-notifications').waitFor();
  await panel.evaluate(root=>root.shadowRoot.querySelector('[data-mode=settings]').click());await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  assert.equal(await panel.evaluate(root=>root.previewOpen),true,'the preview stays open for the session');
  // Desktop: nothing is folded and the support link stays in the preview.
  await q(1440,1050);
  v=await m();assert.ok(!v.toggle.shown&&v.inner.h>200&&v.inPreview.shown&&!v.below.shown,'desktop keeps the full preview '+JSON.stringify(v));
  // The icon-only tabs get bigger touch targets where the width allows it, and every label still fits.
  /* 320 px holds all seven tabs with their labels (the active one wide, the others icon-only at 32 px); wider phones keep 40 px or more */
  for(const [w,min] of [[320,32],[375,40],[390,40],[400,44],[430,44]]){
    await q(w,844);
    const tabs=await panel.evaluate(root=>[...root.shadowRoot.querySelectorAll('nav>button')].map(b=>({on:b.getAttribute('aria-pressed')==='true',w:Math.round(b.getBoundingClientRect().width),fit:b.scrollWidth<=b.clientWidth+1&&(b.getAttribute('aria-pressed')!=='true'||b.querySelector('span').scrollWidth<=b.querySelector('span').clientWidth+1)})));
    assert.ok(tabs.every(t=>t.fit),'labels fit at '+w+' '+JSON.stringify(tabs));
    assert.ok(tabs.filter(t=>!t.on).every(t=>t.w>=min),'tabs are at least '+min+'px wide at '+w+' '+JSON.stringify(tabs));
  }
  // Start hint: shown until the user dismisses it, and the dismissal is sent to the server.
  await q(390,844);
  await page.evaluate(()=>{window.hintDismissed=false;window.hintCalls=[];});
  await panel.evaluate(async root=>{root.startHint=undefined;await root.loadStartHint();});
  assert.equal(await panel.locator('.start-hint li').count(),3,'an administrator sees three steps');
  assert.equal(await panel.evaluate(root=>(root.startHintHtml(false).match(/<li>/g)||[]).length),2,'others do not see the dashboard step');
  const box=await panel.evaluate(root=>{const b=root.shadowRoot.querySelector('.start-hint').getBoundingClientRect();return {w:Math.round(b.width),right:Math.round(b.right)};});
  assert.ok(box.right<=390,'the hint does not overflow '+JSON.stringify(box));
  await panel.locator('[data-start-hint-dismiss]').click();
  assert.equal(await panel.locator('.start-hint').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.hintCalls),[{hint:'start'}],'the dismissal is saved on the server');
  await panel.evaluate(async root=>{root.startHint=undefined;await root.loadStartHint();});
  assert.equal(await panel.locator('.start-hint').count(),0,'a dismissed hint stays away');
  // One empty state and one status pill with an error kind, whatever page they appear on.
  const look=await panel.evaluate(root=>{const r=root.shadowRoot,box=document.createElement('p');box.className='cp-empty';box.textContent='Nothing here';r.querySelector('main').append(box);const e=getComputedStyle(box);const out={style:e.borderTopStyle,radius:e.borderTopLeftRadius,align:e.textAlign};box.remove();
    root.status('Could not save','error');const s=getComputedStyle(r.querySelector('.status'));out.error=s.color;out.kind=r.querySelector('.status').dataset.kind;root.status('');return out;});
  assert.deepEqual([look.style,look.radius,look.align],['dashed','14px','center'],'the shared empty state looks the same everywhere '+JSON.stringify(look));
  assert.ok(look.kind==='error'&&look.error==='rgb(248, 113, 113)','an error has its own colour '+JSON.stringify(look));
  // The note under the preview state is plain for live data and boxed only for a demo, however often it is refreshed.
  const note=await panel.evaluate(root=>{const el=root.shadowRoot.querySelector('.preview-mode-note'),out=[];root.previewMode=undefined;for(let i=0;i<3;i++){root.updatePreviewNote();out.push(el.classList.contains('preview-info'));}root.previewMode='parked';root.updatePreviewNote();out.push(el.classList.contains('preview-info'));root.previewMode='live';root.updatePreviewNote();out.push(el.classList.contains('preview-info'));return out;});
  assert.deepEqual(note,[false,false,false,true,false],'the preview note does not flip between plain and boxed '+JSON.stringify(note));
  console.log('PASS: phone settings order, folded preview, support link, tab sizes and start hint.');
};
