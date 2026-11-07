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
    release();await panel.locator('.companion-surface').waitFor();assert.equal(await panel.locator('.companion-boot').isVisible(),false);
    await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
    console.log('PASS: delayed CSS shows the shared loader and reveals the styled dashboard only after stylesheet readiness.');
  }finally{release();await page.unroute(pattern,handler);}
};
