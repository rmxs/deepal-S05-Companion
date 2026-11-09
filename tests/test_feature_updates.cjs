const assert=require('assert');
module.exports=async page=>{
 const panel=page.locator('deepal-companion-panel');
 const sectionDefaults=await page.evaluate(()=>window.__DEEPAL_COMPANION_UI.normalize({prefix:'s05'}));
 assert.deepEqual(sectionDefaults.order,['hero','actions','status','charge','curve','stats','info','costs','reminder']);assert.deepEqual(sectionDefaults.hidden,['charge','costs']);assert.equal(sectionDefaults.charge_curve,true);
 assert.equal(await panel.locator('header [data-action=add-dashboard]').count(),1);assert.equal(await panel.locator('.dashboard-guide,.legacy-card-note').count(),0);
 const defaults=await page.evaluate(()=>{const widget=document.createElement(window.__DEEPAL_COMPANION_UI.settingsTag);widget.mode='app';widget.hass=window.testHass;widget.yamlBase={prefix:'s05'};widget.cfg=window.__DEEPAL_COMPANION_UI.normalize({prefix:'s05'});widget.tab='colours';let last;widget.onPatch=patch=>{last=patch;};document.body.append(widget);widget._setTab('colours');const input=widget.shadowRoot.querySelector('[data-set=air_t1]'),hint=input.placeholder,empty=input.value==='';input.value='23';input.dispatchEvent(new Event('change',{bubbles:true}));const changed=last.air_t1;input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));const reset=last.air_t1;widget.remove();return {hint,empty,changed,reset};});assert.deepEqual(defaults,{hint:'22',empty:true,changed:23,reset:22},'Numeric hints allow overrides and clearing restores the actual default');
 await page.evaluate(()=>{
   const now=Date.now(),base=window.testHass,states=structuredClone(base.states);window.curveHistoryCalls=0;
   for(const [key,value]of [['ac_charge_current',12],['dc_charge_current',0]])states['sensor.s05_'+key]={...states['sensor.s05_'+key],state:String(value),last_changed:new Date(now).toISOString()};
   window.curveHass={...base,states,callWS:async message=>{
     if(message.op==='summary')return {active:{s:now-3600000}};
     if(message.type==='history/history_during_period'){window.curveHistoryCalls++;return {'sensor.s05_ac_charge_current':[{lu:(now-3600000)/1000,s:'8'},{lu:(now-1800000)/1000,s:'16'},{lu:(now-600000)/1000,s:'12'}],'sensor.s05_dc_charge_current':[{lu:(now-3600000)/1000,s:'0'}],'sensor.s05_battery_level':[{lu:(now-3600000)/1000,s:'40'}]};}
     return base.callWS(message);
   }};
   const card=window.__DEEPAL_COMPANION_UI.preview(window.curveHass,{vehicle_id:'car',view_id:'mobile'},{prefix:'s05',charge_curve:true});card.id='curve-qa-card';card.inert=false;card.style.width='430px';document.body.append(card);card._force();
 });
 const card=page.locator('#curve-qa-card');try{await card.locator('.curve-chart').waitFor();}catch(error){console.error('Curve state:',await card.evaluate(card=>({current:card._n('sensor.ac_charge_current'),enabled:card._c?.charge_curve,hidden:card._c?.hidden,loading:!!card._curveLoad,controller:!!card._chargingCurve,text:card.shadowRoot.querySelector('.charging-curve-block')?.textContent,requests:window.curveHistoryCalls})));throw error;}
 assert.equal(await card.locator('.curve-dot').count(),3);assert((await card.locator('.curve-line').getAttribute('d')).includes('C'));
 const requests=await page.evaluate(()=>window.curveHistoryCalls);
 await page.evaluate(()=>{const card=document.getElementById('curve-qa-card');card.hass={...window.curveHass};card._force();});
 assert.equal(await page.evaluate(()=>window.curveHistoryCalls),requests,'Unchanged HA updates must not refetch history');
 await page.evaluate(()=>{window.curveHass.states['sensor.s05_ac_charge_current'].state='18';window.curveHass.states['sensor.s05_ac_charge_current'].last_changed=new Date().toISOString();const card=document.getElementById('curve-qa-card');card.hass={...window.curveHass};card._force();});
 await page.waitForFunction(()=>document.getElementById('curve-qa-card').shadowRoot.querySelectorAll('.curve-dot').length===4);
 if(process.env.FEATURE_CAPTURE)await card.locator('.charging-curve-block').screenshot({path:process.env.FEATURE_CAPTURE+'-live-curve.png'});
 await page.evaluate(()=>{const card=document.getElementById('curve-qa-card');window.__DEEPAL_COMPANION_UI.updatePreview(card,{prefix:'s05',charge_curve:false});});assert.equal(await card.locator('.charging-curve-block').count(),0);
 const chargingControls=await page.evaluate(()=>{
   const card=document.getElementById('curve-qa-card'),ui=window.__DEEPAL_COMPANION_UI;
   ui.updatePreview(card,{prefix:'s05',hero_style:'carview',charge_curve:false,hidden:['charge','costs']});card._hview='iso';ui.applyPreview(card,window.testHass,'ac',true);card._force();
   const styles={};for(const style of ['line','text','big','beside']){card._c.charge_style=style;card._force();styles[style]={shown:!card._el.chgbox.hidden,text:card._el.chgbox.textContent};}
   const rowHidden=card._el.charge.hidden,buttonVisible=!card._el.vtg.hidden;card._el.vtg.click();const topVisible=!card._el.cvt.hidden;card._el.vtg.click();const chargingVisible=!card._el.cvi.hidden&&card._el.cv.classList.contains('chg');
   const widget=document.createElement(ui.settingsTag);widget.hass=window.testHass;widget.cfg=ui.normalize({prefix:'s05'});widget.tab='charging';document.body.append(widget);const html=widget._tabCharge(widget.cfg||widget._cfg);widget.remove();
   return {styles,rowHidden,buttonVisible,topVisible,chargingVisible,duplicate:html.includes('data-tgl="charge_curve"')};
 });
 assert.equal(chargingControls.rowHidden,true);assert.equal(chargingControls.buttonVisible,true);assert.equal(chargingControls.topVisible,true);assert.equal(chargingControls.chargingVisible,true);assert.equal(chargingControls.duplicate,false);
 for(const style of Object.values(chargingControls.styles)){assert.equal(style.shown,true);assert(style.text.includes('16')&&style.text.includes('AC'),'On-image current and type stay visible with the charging row disabled');}
 await page.evaluate(async()=>{const card=document.getElementById('curve-qa-card'),module=await import('/deepal_companion/frontend/charging-curve.js?v=0.1.0'),end=Date.now(),start=end-3600000;
   window.archivedCurveDialog=module.openCurveDialog(card.shadowRoot,card._hass,()=>({start,end,series:{ac:[{lu:start/1000,s:'8'},{lu:(start+900000)/1000,s:'0'},{lu:(start+901000)/1000,s:'8'},{lu:(start+1800000)/1000,s:'16'},{lu:end/1000,s:'0'}],dc:[],battery:[{lu:start/1000,s:'40'},{lu:(start+1800000)/1000,s:'60'},{lu:end/1000,s:'80'}]}}),{lvl_green:'#42b883'});
 });
 await card.locator('.archived-curve-dialog .curve-chart').waitFor();
 const palette=await card.locator('.archived-curve-dialog .curve-line').evaluate(path=>getComputedStyle(path).stroke);assert.equal(palette,'rgb(66, 184, 131)','Archived curve inherits the selected card palette outside ha-card');
 assert.deepEqual(await card.locator('.archived-curve-dialog .curve-battery').allTextContents(),['40%','60%','80%']);
 assert.equal(await card.locator('.archived-curve-dialog .curve-dot').count(),4,'A momentary zero is hidden while the resumed reading and final stop are kept');
 await page.evaluate(()=>{const card=document.getElementById('curve-qa-card');window.savedArchivedCurve=card.shadowRoot.querySelector('.archived-curve-dialog .charging-curve-block');for(let i=0;i<6;i++)card._force();card._c.charge_curve=true;card._force();});
 await page.waitForFunction(()=>!!document.getElementById('curve-qa-card')._chargingCurve);
 await page.evaluate(()=>{const card=document.getElementById('curve-qa-card');card._c.charge_curve=false;card._force();});
 assert(await page.evaluate(()=>document.getElementById('curve-qa-card').shadowRoot.querySelector('.archived-curve-dialog .charging-curve-block')===window.savedArchivedCurve),'Live-curve cleanup must preserve the archived graph across card updates');
 await page.waitForTimeout(1200);assert.equal(await card.locator('.archived-curve-dialog .curve-chart').count(),1);
 await page.keyboard.press('Escape');await page.evaluate(()=>document.getElementById('curve-qa-card').remove());
 await panel.locator('[data-mode=notifications]').click();await panel.locator('.local-notifications').waitFor();const board=panel.locator('.local-notifications');
 /* Live charging has its own page; its update interval is shown in minutes and saved as you type. */
 const savedInterval=await page.evaluate(()=>window.localNotifications?.live_charging?.min_interval??300);
 await board.locator('[data-live-open=charging]').locator('visible=true').first().click();const liveInterval=board.locator('[data-live-page=charging] [data-live-number=min_interval]');
 assert.equal(await liveInterval.inputValue(),String(Math.round(savedInterval/60)),'Saved interval stays visible');
 await liveInterval.fill('7');await page.waitForFunction(()=>window.localNotifications.live_charging.min_interval===420);
 await liveInterval.fill(String(Math.round(savedInterval/60)));await page.waitForFunction(v=>window.localNotifications.live_charging.min_interval===v,Math.round(savedInterval/60)*60);
 await board.locator('[data-live-back]').locator('visible=true').first().click();
 await panel.locator('[data-mode=history]').click();await panel.locator('.charge-session-list').waitFor();await panel.locator('.history-line-chart [data-period="7"]').click();
 await page.waitForFunction(()=>window.calls.some(call=>call.op==='charging_dashboard'&&call.data.start_time&&new Date(call.data.end_time)-new Date(call.data.start_time)<8*864e5));
 await panel.locator('.history-line-chart [data-wk="-1"]').click();await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').costChartPeriod?.period===7);
 await panel.locator('[data-action=session-view-table]').click();await page.setViewportSize({width:390,height:900});
 const alignment=await panel.evaluate(root=>{const cells=root.shadowRoot.querySelector('tbody tr').cells;return {date:cells[0].getBoundingClientRect().top,edit:cells[5].getBoundingClientRect().top,overflow:root.shadowRoot.querySelector('.charge-session-list').scrollWidth>root.shadowRoot.querySelector('.charge-session-list').clientWidth+1};});assert(Math.abs(alignment.date-alignment.edit)<2);assert.equal(alignment.overflow,false);
 await panel.locator('[data-action=view-curve]').first().click();await panel.locator('.archived-curve-dialog .curve-chart').waitFor();
 const chart=panel.locator('.archived-curve-dialog .curve-chart');await chart.focus();await page.keyboard.press('Home');await page.keyboard.press('End');assert.notEqual(await panel.locator('.archived-curve-dialog .curve-reading').getAttribute('data-amps'),null);
 const curveDesign=await chart.evaluate(svg=>({fill:getComputedStyle(svg.querySelector('text')).fill,touch:getComputedStyle(svg).touchAction}));assert.notEqual(curveDesign.fill,'rgb(0, 0, 0)');assert(curveDesign.touch.includes('pan-y'));
 const closeOffset=await panel.locator('.archived-curve-dialog [aria-label="Close charging curve"]').evaluate(button=>{const a=button.getBoundingClientRect(),b=button.querySelector('svg').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)+Math.abs(a.y+a.height/2-b.y-b.height/2);});assert(closeOffset<1);
 await page.keyboard.press('Escape');await panel.locator('.archived-curve-dialog').waitFor({state:'detached'});
 await panel.evaluate(async root=>{const module=await import('/deepal_companion/frontend/charging-curve.js?v=0.1.0'),start=Date.now()-3600000;root.sessionDialog=module.openCurveDialog(root.shadowRoot,root._hass,()=>({start,end:start+3600000,series:{ac:[{lu:start/1000,s:'0'},{lu:(start+1800000)/1000,s:'8'},{lu:(start+1820000)/1000,s:'16'},{lu:(start+1840000)/1000,s:'0'},{lu:(start+3600000)/1000,s:'0'}],dc:[],battery:[]}}));});
 await panel.locator('.archived-curve-dialog .curve-dot').first().waitFor();
 assert.equal(await panel.locator('.archived-curve-dialog .curve-dot').count(),3);assert.equal(await panel.locator('[data-curve-low]').textContent(),'8');assert.equal(await panel.locator('[data-curve-high]').textContent(),'16');
 const trimmed=await panel.locator('.archived-curve-dialog .curve-chart').evaluate(svg=>Number(svg.dataset.end)-Number(svg.dataset.start));assert.equal(trimmed,40000);
 const touch=await page.context().newCDPSession(page),bounds=await panel.locator('.archived-curve-dialog .curve-chart').boundingBox();
 for(const [fraction,amps]of [[.065,'8'],[.98,'0']]){const point={x:bounds.x+bounds.width*fraction,y:bounds.y+bounds.height*.5};await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await panel.locator('.archived-curve-dialog .curve-reading').getAttribute('data-amps'),amps);}
 assert((await panel.locator('.archived-curve-dialog .curve-reading').textContent()).includes('Charging stopped'));await touch.detach();await page.keyboard.press('Escape');
 assert(!(await panel.locator('.status').textContent()).includes('not valid JSON'),'Empty historical periods must not raise JSON errors');
 assert.notEqual(await panel.locator('tbody [data-action=edit-session]').first().evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','Edit has a visible palette accent background');
 const format=await panel.evaluate(root=>{const saved=root._hass;root._hass={...saved,locale:{...saved.locale,date_format:'YMD',time_format:'24',time_zone:'server'},config:{...saved.config,time_zone:'Europe/Athens'}};const f=root.sessionFormat(),result={date:f.date.format(new Date('2026-11-04T08:09:00Z')),time:f.time.format(new Date('2026-11-04T08:09:00Z'))};root._hass=saved;return result;});assert.equal(format.date,'2026/11/04');assert.equal(format.time,'10:09');
 assert.equal(await page.evaluate(()=>window.__DEEPAL_COMPANION_UI.format({locale:{language:'en',time_format:'24',time_zone:'server'},config:{time_zone:'Europe/Athens'}}).hm(new Date('2026-11-04T22:00:00Z'))),'00:00','HA 24-hour time uses 00:00 at midnight');
 if(process.env.FEATURE_CAPTURE)await page.screenshot({path:process.env.FEATURE_CAPTURE+'-mobile-costs.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1050});await panel.locator('[data-mode=settings]').click();await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
 console.log('PASS: lazy charging curve, changed-reading dots, no redundant history requests, archived curve popup, compact mobile table, default placeholders, date navigation and HA date/time preferences.');
};
