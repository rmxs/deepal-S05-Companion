const assert=require('assert');
module.exports=async page=>{
  let held=false,release;const wait=new Promise(resolve=>release=resolve),pattern='**/companion-panel.css*';
  const handler=async route=>{held=true;await wait;await route.continue();};await page.route(pattern,handler);
  try{
    await page.evaluate(()=>{document.querySelector('deepal-companion-panel').remove();const panel=document.createElement('deepal-companion-panel');document.querySelector('#panel').append(panel);panel.hass=window.testHass;});
    for(let i=0;i<100&&!held;i++)await page.waitForTimeout(20);assert(held,'The cold stylesheet request must be held for this check');
    const panel=page.locator('deepal-companion-panel');await panel.locator('.companion-boot').waitFor();
    assert.equal(await panel.locator('.companion-surface').isVisible(),false,'Unstyled dashboard content must stay hidden');
    assert.equal(await panel.locator('.companion-boot .arc').evaluate(node=>getComputedStyle(node).animationName),'ds-spin','Cold loading reuses the same spinner');
    assert.equal(await panel.locator('.companion-boot .dc-loader-initials').count(),0,'Initials are reserved for tab changes');
    release();await panel.locator('.companion-surface').waitFor();assert.equal(await panel.locator('.companion-boot').isVisible(),false);
    await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
    const profileHeader=panel.locator('.profile-setup>.profile-toggle-row');await profileHeader.locator('.ps-title').click();assert.equal(await profileHeader.getAttribute('aria-expanded'),'true','Clicking the Profile title expands the whole section');await profileHeader.focus();await page.keyboard.press('Enter');assert.equal(await profileHeader.getAttribute('aria-expanded'),'false');
    const columns=await panel.evaluate(root=>{const widget=root.settings,old=widget.style.width,result=[];for(const width of [720,560,400]){widget.style.width=width+'px';result.push(getComputedStyle(widget.shadowRoot.querySelector('.tabs')).gridTemplateColumns.split(' ').length);}widget.style.width=old;return result;});assert.deepEqual(columns,[4,3,2],'Settings menu responds to available container width');
    await panel.evaluate(root=>{void root.navigateMode('chargers');});await panel.locator('.stage>.stage-loader').waitFor();
    assert.equal(await panel.locator('.stage>.stage-loader .arc').count(),1,'Page transitions use one shared spinner');
    assert.equal(await panel.locator('.stage-loader .dc-loader-initials').textContent(),'LK','Tab-change spinner shows handwritten initials');
    assert.equal(await panel.locator('.stage').evaluate(node=>getComputedStyle(node,'::after').content),'none','Legacy pseudo-element spinner is removed');
    await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.stage').classList.contains('is-loading'));
    assert.equal(await panel.locator('.stage-loader').count(),0,'Page loader is removed after navigation');
    console.log('PASS: delayed CSS shows the shared loader and reveals the styled dashboard only after stylesheet readiness.');
  }finally{release();await page.unroute(pattern,handler);}
};
