const assert=require('assert'),path=require('path');
module.exports=async function imageLoading(page){
 const attempts=new Map();
 const match='**/deepal_companion/frontend/images/iso/**/*.webp*';
 const intercept=async route=>{const key=new URL(route.request().url()).pathname;const count=(attempts.get(key)||0)+1;attempts.set(key,count);if(count<=2)await route.fulfill({status:503,body:'Temporary loading failure'});else await route.continue();};
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await page.route(match,intercept);
 try{
   await page.evaluate(()=>{
     const root=document.createElement('div');root.id='cold-image-test';root.style.width='480px';document.body.append(root);
     const card=window.__DEEPAL_COMPANION_UI.preview(window.testHass,{vehicle_id:'car',view_id:'mobile'},{...window.common,hero_style:'carview',car_color:'blue',hero_view:'iso',image_scale:1.2});
     root.append(card);card.style.width='480px';
   });
   await page.waitForFunction(()=>{const card=document.querySelector('#cold-image-test deepal-companion-card');const imgs=[...card.shadowRoot.querySelectorAll('#cva img.on')];return imgs.length>0&&imgs.every(img=>img.complete&&img.naturalWidth>0);},{},{timeout:15000});
   assert([...attempts.values()].some(count=>count>=3),'Cold-cache test must exercise repeated image failures');
   assert.equal(await page.evaluate(()=>!!document.querySelector('#cold-image-test deepal-companion-card')._cvFail),false);
   await page.locator('#cold-image-test').screenshot({path:path.resolve(__dirname,'../../cold-image-recovery.png')});
   console.log('PASS: cold-cache Car View recovers base and overlays after two temporary failures without refreshing.');
 }finally{
   await page.evaluate(()=>document.querySelector('#cold-image-test')?.remove());
   await page.unroute(match,intercept);await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});await cdp.detach();
 }
};
