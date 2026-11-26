const assert=require('assert');
/* Regression: the panel recovers from a lost connection by itself. A refresh that fails is retried on its own, and a
   request that never answers is given up after 12 s so the lock is released and the retry can run.
   Run: PANEL_RECOVERY_ONLY=1 node tests/test_browser.cjs */
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel');
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').vehicles?.length>0);
  await page.evaluate(()=>{
    const p=document.querySelector('deepal-companion-panel'),h=window.testHass,orig=h.callWS.bind(h);
    window.__rec={mode:'ok',lists:0};
    h.callWS=m=>{
      if(m.type==='deepal_companion/request'&&m.op==='list'){window.__rec.lists++;
        if(window.__rec.mode==='fail')return Promise.reject({code:'connection_lost'});
        if(window.__rec.mode==='hang')return new Promise(()=>{});}
      return orig(m);};
  });
  /* 1. a failed refresh is retried without any user action */
  await page.evaluate(()=>{window.__rec.mode='fail';window.__rec.lists=0;document.querySelector('deepal-companion-panel').refresh();});
  await page.waitForFunction(()=>window.__rec.lists>=1);
  await page.evaluate(()=>{window.__rec.mode='ok';});
  await page.waitForFunction(()=>window.__rec.lists>=2,null,{timeout:8000});
  assert.equal(await panel.evaluate(p=>!!p.fetching),false,'the refresh lock is released after a recovered failure');
  /* 2. a request that never answers is abandoned after 12 s and retried */
  await page.evaluate(()=>{window.__rec.mode='hang';window.__rec.lists=0;document.querySelector('deepal-companion-panel').refresh();});
  await page.waitForFunction(()=>window.__rec.lists>=1);
  await page.evaluate(()=>{window.__rec.mode='ok';});
  await page.waitForFunction(()=>window.__rec.lists>=2,null,{timeout:22000});
  await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').fetching,null,{timeout:5000});
  console.log('PASS: a failed refresh is retried by itself and a request that never answers is abandoned and retried.');
};
