const assert=require('assert');
/* Regression: the Preconditioning page header is information only. It holds the status pill and the Summary toggle
   (with the last report time); there is no Start or Stop button, no temperature, no chips and no live-value row.
   Start, Stop and temperatures stay on the card. Checks: pill and Summary are shown, no action or live value is
   rendered, the Summary opens and closes, nothing overflows at 320 px, and a state change shows after a refresh.
   Run: PRECOND_HERO_ONLY=1 node tests/test_browser.cjs */
const snapshot=()=>{const now=Date.now()/1000;return {global_notifications:true,config:{scheduling_enabled:true,default_temperature:22,default_duration:15,max_attempts:3,retry_delay:30,verify_timeout:90,battery:{enabled:false,min_soc:20,block_start:true,auto_stop:true,while_charging:true,max_age:1800},notify:{enabled:false,devices:[],live:true,events:{start_requested:false,start_confirmed:true,stop_requested:false,stop_confirmed:true,retry:false,failure:true,unknown:true,schedule_result:true,session_ended:true,battery:true}},schedules:[]},state:{status:'IDLE',owner:null},climate:{on:false,report:now-30,current:19.5,target:18,available:true},battery:{soc:84,report:now-30,fresh:true,charging:false,threshold:20,blocked:null},upcoming:[],history:[],estimated_remaining:null,max_minutes:15,now,recipients:[{svc:'notify.mobile_app_phone',name:'Phone'}]};};
const SNAP_SRC=snapshot.toString();
const BOX='.precondition-box[data-preconditioning="settings"]';

module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  const panel=page.locator('deepal-companion-panel');
  if(!(await page.evaluate(()=>!!document.querySelector('deepal-companion-panel').settings)))await panel.locator('[data-mode=settings]').click();
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  /* the harness has no preconditioning backend: answer the read operation from a mutable fixture (no save, no commands) */
  await page.evaluate(src=>{const h=window.testHass;if(h.heroMock)return;h.heroMock=true;const orig=h.callWS;window.__pcSnap=new Function('return ('+src+')()')();
    h.callWS=async m=>{if(m.op==='precondition_get')return structuredClone(window.__pcSnap);return orig(m);};},SNAP_SRC);
  await panel.locator('[data-mode=preconditioning]').click();
  await page.waitForFunction(box=>{const x=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box);return !!x&&!!x.querySelector('[data-pc=schedules]')&&!!x.querySelector('.pg-hero');},BOX);

  /* status pill and Summary toggle are the whole header */
  assert.equal(await panel.locator(BOX+' .pg-head > .chip').first().textContent(),'Stopped · Ready','Ready sits in the top status pill');
  const sum=await panel.locator(BOX+' [data-act=summary-toggle]').evaluate(b=>({text:b.textContent.trim(),title:b.getAttribute('title')||''}));
  assert.match(sum.text,/^Summary · report .*\d{1,2}[:.]\d{2}/,'Summary label shows the report time: '+sum.text);
  assert(sum.title.length>5,'the full report date and time is in the title');

  /* no actions and no live values on the page header */
  const gone=await panel.locator(BOX).evaluate(b=>({cmd:b.querySelectorAll('[data-cmd]').length,hero:b.querySelectorAll('.pg-hero button:not([data-act=summary-toggle])').length,info:b.querySelectorAll('.pg-info,.pg-temps,.pg-chips,.pg-chip,.pg-x').length,note:/Cabin now|Start \(/.test(b.querySelector('.pg-hero').textContent)}));
  assert.deepEqual(gone,{cmd:0,hero:0,info:0,note:false},'the page header has no Start/Stop, temperatures or chips: '+JSON.stringify(gone));

  /* the Summary opens and closes */
  await panel.locator(BOX+' [data-act=summary-toggle]').click();
  await page.waitForFunction(box=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .pg-sum li'),BOX);
  await panel.locator(BOX+' [data-act=summary-toggle]').click();
  await page.waitForFunction(box=>!document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .pg-sum'),BOX);

  /* 320 px: no horizontal overflow */
  await page.setViewportSize({width:320,height:800});
  const fit=await panel.locator(BOX).evaluate(b=>b.scrollWidth<=b.clientWidth+1);
  assert.equal(fit,true,'no horizontal overflow at 320 px');
  await page.setViewportSize({width:1440,height:1050});

  /* a state change shows after a refresh: the climate is on and was not started by Companion */
  await page.evaluate(()=>{const s=window.__pcSnap;s.climate={...s.climate,on:true};s.state={status:'IDLE',owner:null};});
  await panel.evaluate(root=>root.localBoard.refresh());
  await page.waitForFunction(box=>{const x=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box);return /Active · Ready/.test(x?.querySelector('.pg-head > .chip')?.textContent||'');},BOX);
  console.log('PASS: the Preconditioning page header shows only the status pill and the Summary; no Start/Stop, temperatures or chips; the Summary opens and closes; no overflow at 320 px; the pill follows a refresh.');
};
