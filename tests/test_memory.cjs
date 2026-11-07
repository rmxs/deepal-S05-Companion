/* Actual Chromium collection and resource counts; simulated HA data only. */
const assert=require('assert'),fs=require('fs'),path=require('path');
module.exports=async function memoryAudit(page){
  const cdp=await page.context().newCDPSession(page);
  await page.evaluate(()=>{
    document.getElementById('panel').replaceChildren();document.getElementById('cards').replaceChildren();document.getElementById('editor').replaceChildren();
    window.memoryProbes=[];window.memoryChoices=customElements.get('deepal-companion-choice');
  });
  async function cycle(){
    await page.evaluate(async()=>{
      const root=document.getElementById('panel'),panel=document.createElement('deepal-companion-panel');root.append(panel);panel.hass=window.testHass;
      for(let i=0;i<100&&!panel.preview;i++)await new Promise(r=>setTimeout(r,10));
      if(!panel.preview)throw Error('Memory audit panel did not load');
      for(const mode of ['notifications','history','chargers','settings']){panel.mode=mode;await panel.mount();}
      const widget=panel.settings;widget._setTab('colours');widget._setTab('layout');
      const card=panel.preview;card._enSheet=true;card._force();await new Promise(r=>setTimeout(r,20));card._closeSheet();
      const curve=await import('/deepal_companion/frontend/charging-curve.js?v=0.1.0');
      const dialog=curve.openCurveDialog(document,window.testHass,()=>Promise.resolve({start:1000,end:2000,mode:'AC',series:{ac:[{lu:1,s:'8'},{lu:2,s:'16'}]}}));
      await new Promise(r=>setTimeout(r,10));dialog.remove();
      const picker=panel.shadowRoot.querySelector('deepal-companion-choice');picker?.open();
      memoryProbes.push(new WeakRef(panel));panel.remove();
      for(const dialog of document.querySelectorAll('dialog'))dialog.remove();
      document.body.focus();await new Promise(r=>requestAnimationFrame(r));
    });
  }
  async function sample(label){
    await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');await cdp.send('HeapProfiler.collectGarbage');
    const dom=await cdp.send('Memory.getDOMCounters'),heap=await cdp.send('Runtime.getHeapUsage');
    const globals=await cdp.send('Runtime.evaluate',{expression:'Object.fromEntries([...["window","document"].map(name=>[name,Object.fromEntries(Object.entries(getEventListeners(globalThis[name])).map(([type,rows])=>[type,rows.length]))])])',includeCommandLineAPI:true,returnByValue:true});
    const resources=await page.evaluate(()=>({subscriptions:subscribers.length,intervals:activeIntervals.size,choices:memoryChoices.live.size,retainedPanels:memoryProbes.filter(ref=>ref.deref()).length}));
    return {label,...dom,usedHeapBytes:heap.usedSize,globals:globals.result.value,...resources};
  }
  for(let i=0;i<3;i++)await cycle();
  const baseline=await sample('warmed baseline');
  for(let i=0;i<20;i++)await cycle();
  const after=await sample('after 20 more full page cycles');
  for(const key of ['subscriptions','intervals','choices'])assert.equal(after[key],baseline[key],'Leaked '+key);
  assert.deepEqual(after.globals,baseline.globals,'Global listeners grow after panel removal');
  assert(after.retainedPanels<=1,'Detached panel instances survive garbage collection');
  assert(after.nodes<=baseline.nodes+300,'DOM nodes accumulate after garbage collection');
  assert(after.jsEventListeners<=baseline.jsEventListeners+50,'DOM listeners accumulate');
  assert(after.usedHeapBytes<=baseline.usedHeapBytes+2*1024*1024,'Collected heap grows by more than 2 MiB');
  fs.writeFileSync(path.resolve(__dirname,'../../QA-memory-report.json'),JSON.stringify({baseline,after,scope:'Chromium with simulated HA; not a production HA soak test'},null,2));
  console.log('PASS: 23 dashboard/page/energy-popup/curve-popup cycles; GC, heap, DOM, listeners, choices, timers and subscriptions bounded.');
  await cdp.detach();
};
