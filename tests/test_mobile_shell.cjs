const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel'),cdp=await page.context().newCDPSession(page);
 const initial=await page.evaluate(()=>({name:document.querySelector('deepal-companion-panel').vehicles[0].name,cards:document.querySelector('#cards').style.display,editor:document.querySelector('#editor').style.display}));
 try{
   await page.evaluate(()=>{document.querySelector('#cards').style.display='none';document.querySelector('#editor').style.display='none';const root=document.querySelector('deepal-companion-panel');root.vehicles[0].name='S05';root.render();return root.mount();});
   await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
   for(const width of [320,360,390,430,640,760]){
     await page.setViewportSize({width,height:844});await panel.evaluate(root=>root.scrollTop=0);
     const layout=await panel.evaluate(root=>{const header=root.shadowRoot.querySelector('.companion-surface>header'),brand=header.querySelector('.app-title').getBoundingClientRect(),name=header.querySelector('.vehicle-title').getBoundingClientRect();return {height:header.getBoundingClientRect().height,brandTop:brand.top,nameTop:name.top,overflow:header.scrollWidth>header.clientWidth+1,overscroll:getComputedStyle(root).overscrollBehaviorY};});
     assert(layout.height<=72,'Mobile header remains compact at '+width+': '+JSON.stringify(layout));assert(Math.abs(layout.brandTop-layout.nameTop)<8,'Vehicle stays on the title line');assert.equal(layout.overflow,false);assert.equal(layout.overscroll,'auto','The page must allow native refresh/scroll chaining');
     await panel.locator('[data-profile-choose]').click();
     const text=await panel.locator('deepal-companion-choice .menu:visible .option').first().evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);return {font:parseFloat(getComputedStyle(node).fontSize),textWidth:range.getBoundingClientRect().width,text:node.textContent};});assert(text.font>=14&&text.textWidth>10&&text.text.trim(),'Profile names must be painted visibly at '+width);
     await page.keyboard.press('Escape');
   }
   await page.setViewportSize({width:390,height:844});await panel.evaluate(root=>{root.scrollTop=0;root.scrollIntoView({block:'start'});});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
   const box=await panel.boundingBox(),x=Math.round(box.x+box.width/2),start=Math.round(Math.max(450,box.y+650));
   const swipe=async(from,to)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(from+(to-from)*i/8)}]});await page.waitForTimeout(25);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
   await swipe(start,start-300);await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').scrollTop>50);
   await panel.evaluate(root=>root.scrollTop=250);await swipe(start-300,start);await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').scrollTop<200);
   if(process.env.MOBILE_SHELL_CAPTURE){await panel.evaluate(root=>root.scrollTop=0);await panel.locator('.companion-surface>header').screenshot({path:process.env.MOBILE_SHELL_CAPTURE+'-header.png'});await panel.locator('[data-profile-choose]').click();await page.screenshot({path:process.env.MOBILE_SHELL_CAPTURE+'-profiles.png'});await page.keyboard.press('Escape');}
   console.log('PASS: compact single-line vehicle header at 320–760px, visible profile menu text, native touch scrolling in both directions, refresh-compatible overscroll.');
 }finally{
   await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();await page.setViewportSize({width:1440,height:1050});
   await page.evaluate(initial=>{document.querySelector('#cards').style.display=initial.cards;document.querySelector('#editor').style.display=initial.editor;const root=document.querySelector('deepal-companion-panel');root.vehicles[0].name=initial.name;root.render();return root.mount();},initial);
 }
};
