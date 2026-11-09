const assert=require('assert');
module.exports=async function firstRun(page){
 const panel=page.locator('deepal-companion-panel');
 await page.evaluate(async()=>{
   const root=document.querySelector('deepal-companion-panel');
   while(root.fetching)await new Promise(r=>setTimeout(r,10));
   window.firstRunHass=root._hass;window.firstRunWS=root._hass.callWS;window.noVehicle=true;window.firstRunCalls=[];
   root._hass.callWS=async function(request){window.firstRunCalls.push(request.op);if(request.op==='list'&&window.noVehicle)return [];return window.firstRunWS.call(this,request);};
   await root.refresh();
 });
 for(const mode of ['settings','notifications','history','chargers']){
   await panel.evaluate(async(root,mode)=>{root.mode=mode;root.render();await root.mount();},mode);
   assert.equal(await panel.locator('nav,.profile-setup,.live-preview,.stage,[data-action=add-dashboard]').count(),0,'No vehicle-dependent controls in '+mode);
   assert.equal(await panel.locator('.vehicle-setup ol li').count(),3);
 }
 for(const width of [360,1440]){
   await page.setViewportSize({width,height:1050});
   assert(await panel.locator('.vehicle-setup').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Setup fits at '+width);
 }
 assert.equal(await panel.locator('.setup-actions a').getAttribute('href'),'/config/integrations/dashboard?add=deepal_companion');
 await panel.locator('[data-action=retry-setup]').click();
 await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').fetching);
 assert(await page.evaluate(()=>window.firstRunCalls.every(op=>op==='list')),'Empty state must not request vehicle configuration or history');
 assert.equal(await panel.evaluate(root=>Object.keys(root.selected).length),0,'Stale vehicle selection cleared');
 await panel.evaluate(root=>{window.firstRunAdmin=root._hass.user.is_admin;root._hass.user.is_admin=false;root.render();});
 assert.equal(await panel.locator('.setup-actions a').count(),0);
 assert((await panel.locator('.vehicle-setup').innerText()).includes('administrator'));
 await panel.evaluate(async root=>{root._hass.user.is_admin=window.firstRunAdmin;window.noVehicle=false;root.mode='settings';await root.refresh();});
 await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
 assert.equal(await panel.locator('nav [data-mode]').count(),5,'Setup success restores the working dashboard');
 await page.evaluate(()=>{window.firstRunHass.callWS=window.firstRunWS;delete window.firstRunWS;delete window.firstRunHass;});
 await page.setViewportSize({width:1440,height:1050});
 console.log('PASS: first-run instructions, hidden controls on all tabs, no invalid vehicle requests, access-aware setup and automatic recovery.');
};
