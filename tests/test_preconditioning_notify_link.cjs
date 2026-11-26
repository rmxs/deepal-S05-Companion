const assert=require('assert');
/* Regression: notification settings live only on the Notifications page. The Preconditioning page has no notification switch,
   phone, test button or language choice; one row there opens Notifications (#notifications), and Back returns to the page.
   Run: PRECOND_NOTIFY_LINK_ONLY=1 node tests/test_browser.cjs */
module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  const panel=page.locator('deepal-companion-panel');
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  /* the harness has no preconditioning backend: answer the two read operations the page makes (no save, no commands) */
  await page.evaluate(()=>{const h=window.testHass;if(h.preconditionMock)return;h.preconditionMock=true;const orig=h.callWS;const now=()=>Date.now()/1000;
    const config={scheduling_enabled:true,default_temperature:22,default_duration:15,max_attempts:3,retry_delay:30,verify_timeout:90,battery:{enabled:false,min_soc:20,block_start:true,auto_stop:true,while_charging:true,max_age:1800},notify:{enabled:false,devices:[],live:true,events:{start_requested:false,start_confirmed:true,stop_requested:false,stop_confirmed:true,retry:false,failure:true,unknown:true,schedule_result:true,session_ended:true,battery:true}},schedules:[]};
    const snap=()=>({global_notifications:true,config,state:{status:'IDLE',owner:null},climate:{on:false,report:now()-30,current:12.5,target:22,available:true},battery:{soc:52,report:now()-30,fresh:true,charging:false,threshold:20,blocked:null},upcoming:[],history:[],estimated_remaining:null,max_minutes:15,now:now(),recipients:[{svc:'notify.mobile_app_phone',name:'Phone'}]});
    h.callWS=async m=>{if(m.op==='precondition_get')return snap();return orig(m);};});
  await panel.locator('[data-mode=preconditioning]').click();
  await page.waitForFunction(()=>{const b=document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.precondition-box[data-preconditioning="settings"]');return !!b&&!!b.querySelector('[data-pc=schedules]');});
  assert.equal(new URL(page.url()).hash,'#preconditioning','the Preconditioning page keeps its own address');
  const box='.precondition-box[data-preconditioning="settings"]';
  const inPage=await panel.evaluate(root=>{const b=root.shadowRoot.querySelector('.precondition-box[data-preconditioning="settings"]');const q=s=>b.querySelectorAll(s).length;return {switches:q('input[data-k^="notify."],input[data-k^="event:"]'),phones:q('[data-dev]'),testButton:q('[data-act=test-notify]'),languageChoice:q('select'),headings:q('[data-pc=notifications] h4')};});
  assert.deepEqual(inPage,{switches:0,phones:0,testButton:0,languageChoice:0,headings:0},'the Preconditioning page has no notification controls: '+JSON.stringify(inPage));
  const link=panel.locator(box+' [data-pc=notifications]');
  assert.equal(await link.count(),1,'exactly one notification row on the Preconditioning page');
  assert.match(await link.textContent(),/Preconditioning notifications and the notification language are set in Notifications\./);
  const button=link.locator('button',{hasText:'Open Notifications'});
  assert.equal(await button.count(),1,'the row has one Open Notifications button');
  // phone width: the row stays inside the screen
  await page.setViewportSize({width:390,height:900});
  await button.waitFor({state:'visible',timeout:10000}).catch(()=>{});
  assert.equal(await button.isVisible(),true,'the button is visible on a phone');
  assert.equal(await panel.locator(box).evaluate(b=>b.scrollWidth<=b.clientWidth+1),true,'no horizontal overflow on a phone');
  await page.setViewportSize({width:1440,height:1050});
  await button.click();
  await page.waitForFunction(()=>location.hash==='#notifications');
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').mode==='notifications');
  await page.waitForFunction(()=>{const deepFind=(sel,root=document)=>{const hit=root.querySelector(sel);if(hit)return hit;for(const el of root.querySelectorAll('*')){if(el.shadowRoot){const f=deepFind(sel,el.shadowRoot);if(f)return f;}}return null;};return !!deepFind('.precondition-box[data-preconditioning="notifications"] input[data-k="notify.enabled"]');},null,{timeout:10000}).catch(async()=>{const d=await page.evaluate(()=>{const all=[];const walk=(root)=>{root.querySelectorAll('.precondition-box').forEach(b=>all.push((b.dataset.preconditioning||'?')+': '+[...b.querySelectorAll('input[data-k]')].slice(0,4).map(i=>i.dataset.k).join(',')));for(const el of root.querySelectorAll('*'))if(el.shadowRoot)walk(el.shadowRoot);};walk(document);return all;});throw new Error('notify.enabled not on Notifications page: '+JSON.stringify(d));});
  const before=await page.evaluate(()=>({hash:location.hash,len:history.length}));
  await page.evaluate(()=>history.back());
  await page.waitForFunction(()=>location.hash==='#preconditioning'&&document.querySelector('deepal-companion-panel').mode==='preconditioning',null,{timeout:10000}).catch(async e=>{const after=await page.evaluate(()=>({hash:location.hash,mode:document.querySelector('deepal-companion-panel').mode}));throw new Error('Back did not return: before '+JSON.stringify(before)+' after '+JSON.stringify(after));});
  console.log('PASS: Preconditioning page has no notification controls; its row opens Notifications (#notifications) and Back returns.');
};
