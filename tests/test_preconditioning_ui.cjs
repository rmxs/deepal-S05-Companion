/* Preconditioning UI: the card sheet, Settings → Preconditioning and Notifications → Preconditioning mount the same
 * module against one mocked backend. Checks shared preferences, commands, schedule editor, battery block and
 * mobile layout. No vehicle or phone is involved. Run: node tests/test_preconditioning_ui.cjs */
const assert=require('assert'),fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const ROOT=path.resolve(__dirname,'..');
/* the shared interface tokens and rules that the panel and the card always provide */
const SHARED=(()=>{const css=fs.readFileSync(path.join(__dirname,'../custom_components/deepal_companion/frontend/companion-panel.css'),'utf8');const cp=(css.match(/\/\*cp:begin\*\/([\s\S]*?)\/\*cp:end\*\//)||[])[1]||'';const ui=(css.match(/\/\*ui:begin\*\/([\s\S]*?)\/\*ui:end\*\//)||[])[1]||'';return ':root{'+cp+'}'+ui;})();
const PAGE=`<!doctype html><meta charset=utf-8><style>${SHARED}</style><body style="background:#121316;color:#eee;font-family:sans-serif;margin:0">
<div id=card></div><div id=settings></div><div id=notifications></div><div id=quick style="width:440px"></div><div id=f24></div><div id=f12></div><div id=fde></div><div id=fen></div>
<script type=module>
import {mountPrecondition} from '/custom_components/deepal_companion/frontend/companion-precondition.js';
const now=()=>Date.now()/1000;
const backend={history:Array.from({length:40},(_,i)=>({id:String(i),time:now()-60-i,kind:'start_confirmed'})),config:{scheduling_enabled:true,default_temperature:22,default_duration:15,max_attempts:3,retry_delay:30,verify_timeout:90,
  battery:{enabled:false,min_soc:20,block_start:true,auto_stop:true,while_charging:true,max_age:1800},
  notify:{enabled:false,devices:[],live:true,events:{start_requested:false,start_confirmed:true,stop_requested:false,stop_confirmed:true,retry:false,failure:true,unknown:true,schedule_result:true,session_ended:true,battery:true}},schedules:[]},
  state:{status:'IDLE',owner:null},soc:52,calls:[]};
window.backend=backend;
function snap(){const blocked=backend.config.battery.enabled&&backend.soc<=backend.config.battery.min_soc?'battery_low':null;
  return structuredClone({global_notifications:!backend.globalOff,config:backend.config,state:backend.state,climate:{on:backend.state.status==='ACTIVE',report:now()-30,current:12.5,target:22,available:true},
  battery:{soc:backend.soc,report:now()-30,fresh:true,charging:false,threshold:backend.config.battery.min_soc,blocked},
  upcoming:backend.config.schedules.map(s=>({id:s.id,next_start:now()+3600,next_stop:now()+3600+s.duration*60,last:null})),
  history:backend.history,estimated_remaining:backend.state.status==='ACTIVE'?600:null,max_minutes:15,now:now(),
  recipients:[{svc:'notify.mobile_app_phone',name:'Phone'}]});}
async function request(op,data={}){backend.calls.push(op);await new Promise(r=>setTimeout(r,20));
  if(op==='precondition_get')return snap();
  if(op==='precondition_set'){const v=structuredClone(data.value);if(v.notify_devices){backend.config.notify.devices=v.notify_devices;delete v.notify_devices;}if(v.notify)v.notify.devices=backend.config.notify.devices;for(const s of v.schedules||[])s.id ||= Math.random().toString(36).slice(2,10);Object.assign(backend.config,v);const r=snap();delete r.recipients;return r;} /* like older backends: the save answer may omit phones */
  if(op==='precondition_start'){if(snap().battery.blocked)return {accepted:false,reason:'battery_low',...snap()};backend.state={status:'ACTIVE',owner:'companion',session_start:now(),deadline:now()+900};return {accepted:true,...snap()};}
  if(op==='precondition_clear_history'){backend.history=[];return snap();}
  if(op==='precondition_stop'){backend.state={status:'INACTIVE',owner:null};return {accepted:true,...snap()};}
  throw Error('Unknown Companion operation');}
/* time format: one fixed report time (15:05 UTC) shown for different Home Assistant profiles */
const FIXED=Date.UTC(2026,10,22,15,5)/1000;
async function fixedRequest(op,data){const r=await request(op,data);if(r&&r.climate)r.climate.report=FIXED;return r;}
for(const [id,locale] of [['f24',{language:'en',time_format:'24'}],['f12',{language:'de',time_format:'12'}],['fde',{language:'de',time_format:'language'}],['fen',{language:'en',time_format:'language'}]])mountPrecondition(document.getElementById(id),{request:fixedRequest,mode:'quick',getHass:()=>({locale,config:{time_zone:'Europe/Athens'}})});
window.toasts=[];
window.views={};
window.moreClicks=0;window.moreArgs=[];
for(const mode of ['card','settings','notifications','quick'])window.views[mode]=mountPrecondition(document.getElementById(mode),{request,mode,onMore:mode==='quick'?section=>{window.moreClicks++;window.moreArgs.push(section||null);}:null,notify:(m,e)=>toasts.push([m,!!e]),getHass:()=>({locale:{language:'en'}})});
window.ready=true;
</script>`;

(async()=>{
  const server=http.createServer((req,res)=>{const url=decodeURIComponent(req.url.split('?')[0]);if(url==='/'){res.setHeader('content-type','text/html');return res.end(PAGE);}
    const file=path.join(ROOT,url);if(!file.startsWith(ROOT)||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(file));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME||undefined,executablePath:process.env.CHROME||undefined,...(fs.existsSync(edge)?{executablePath:edge}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.ready&&document.querySelectorAll('.pc section').length>=6);
    const card=page.locator('#card'),settings=page.locator('#settings'),notes=page.locator('#notifications');
    // times follow the Home Assistant 12/24 h setting and time zone, not the browser language
    const flat=t=>t.replace(/[\s\u202f\u00a0]+/g,' ');
    for(const [id,re] of [['f24',/Report: 17:05(?!\s?[AP]M)/],['f12',/Report: 5:05 PM/],['fde',/Report: 17:05(?!\s?[AP]M)/],['fen',/Report: 05:05 PM/]]){
      await page.waitForFunction(i=>/Report: /.test(document.getElementById(i).textContent),id);
      assert.match(flat(await page.locator('#'+id+' .q-rep').textContent()),re,'time format in '+id);
    }
    // the 15-minute vehicle limit is visible and runtime is labelled as estimated
    assert.match(await card.textContent(),/within 15 minutes/);
    assert.deepEqual(await card.locator('input[type=range][data-ui=duration]').evaluate(r=>[r.min,r.max]),['1','15'],'durations 1–15 only');
    await settings.locator('[data-act=summary-toggle]').click();assert.match(await settings.locator('.pg-sum').textContent(),/No automatic starts/);
    if(process.env.PC_SHOT){const vs=page.viewportSize();for(const w of [390,1100]){await page.setViewportSize({width:w,height:900});await page.waitForTimeout(400);await settings.screenshot({path:process.env.PC_SHOT+'-'+w+'.png'});}await page.setViewportSize(vs);}
    // stepper: + raises attempts? already at max 3; − lowers to 2 and saves
    await settings.locator('details summary').first().click();
    await settings.locator('.stp:has(input[data-cfg=max_attempts]) [data-stp="-1"]').click();
    await page.waitForFunction(()=>backend.config.max_attempts===2);
    // aligned controls: every slider/stepper/select is 44 px high
    const heights=await page.evaluate(()=>[...document.querySelectorAll('#settings .sl,#settings .stp,#settings select,#settings .seg,#settings input[type=time]')].map(n=>Math.round(n.getBoundingClientRect().height)).filter(h=>h));
    assert(heights.every(h=>h===44),'control heights '+heights);
    // start / stop through the backend
    await card.locator('[data-cmd=precondition_start]').click();
    await page.waitForFunction(()=>document.querySelector('#card .chip.ok')?.textContent==='Active');
    assert.match(await card.textContent(),/Remaining \(estimated\)/);
    await card.locator('[data-cmd=precondition_stop]').click();
    await page.waitForFunction(()=>document.querySelector('#card .chip')?.textContent==='Stopped');
    // compact popup: the new layout, same settings and commands as the other places
    {const quick=page.locator('#quick');
      await quick.locator('.q-live,.q-go').first().waitFor();
      assert.equal(await quick.locator('.q-tele > div').count(),3,'Cabin, target and battery strip');
      assert.equal(await quick.locator('[data-qset^="temperature:"]').count(),3,'Cool, comfort and warm presets');
      assert.deepEqual(await quick.locator('[data-qset^="duration:"]').allTextContents(),['5 min','10 min','15 min']);
      await quick.locator('[data-qset="temperature:24"]').click();
      assert.equal(await quick.locator('.q-temp').getAttribute('data-tone'),'warm');
      {const colours=await page.evaluate(()=>{const q=document.querySelector('#quick'),c=n=>getComputedStyle(q.querySelector(n)).color,b=n=>getComputedStyle(q.querySelector(n)).backgroundColor;
        return {big:c('.q-big'),go:q.querySelector('.q-go')?b('.q-go'):''};});
        assert.equal(colours.big,'rgb(250, 204, 21)','the warm preset colours the temperature readout');
        assert.notEqual(colours.go,'rgb(250, 204, 21)','the warm preset must not repaint the Start button');}
      await page.waitForFunction(()=>backend.config.default_temperature===24);
      assert.equal(await quick.locator('[data-qstep]').count(),0,'the temperature has no − and + buttons');
      assert.equal(await quick.locator('.q-head').count(),0,'the popup shows its title only once');
      await quick.locator('[data-qset="temperature:21"]').click();
      await page.waitForFunction(()=>backend.config.default_temperature===21);
      assert.equal((await quick.locator('.q-big').textContent()).trim(),'21.0 °C');
      await quick.locator('[data-qset="duration:10"]').click();
      await page.waitForFunction(()=>backend.config.default_duration===10);
      assert.equal(await quick.locator('[data-qset="duration:10"]').getAttribute('aria-pressed'),'true');
      await quick.locator('[data-cmd=precondition_start]').click();
      await page.waitForFunction(()=>/^\d\d:\d\d$/.test(document.querySelector('#quick .q-live [data-clock]')?.textContent||''));
      assert.equal(await quick.locator('.q-go').count(),0,'The start button is replaced by the countdown');
      await quick.locator('[data-cmd=precondition_stop]').click();
      await quick.locator('.q-go').waitFor();
      await quick.locator('[data-act=sched-toggle]').click();
      assert.equal(await quick.locator('.q-drawer').count(),1,'The schedules drawer opens');
      await quick.locator('.q-drawer [data-act=more]').click();
      assert.equal(await page.evaluate(()=>window.moreClicks),1,'Create schedule opens the Companion dashboard');
      assert.equal(await quick.locator('button.more').count(),0,'the popup has no footer link');
      await quick.locator('[data-to=notifications]').click();
      assert.deepEqual(await page.evaluate(()=>window.moreArgs),[null,'notifications'],'the notifications text opens the notification settings');
      assert.equal(await quick.locator('input[data-k="notify.enabled"]').count(),1,'the switch itself stays a switch');
      assert.equal(await quick.locator('input[data-k="notify.enabled"]').count(),1);
      assert.equal(await page.evaluate(()=>document.getElementById('quick').scrollWidth<=document.getElementById('quick').clientWidth+1),true,'No horizontal overflow');
      await page.evaluate(()=>{backend.config.default_temperature=22;backend.config.default_duration=15;});
      await page.evaluate(()=>Promise.all(Object.values(window.views).map(v=>v.refresh())));
    }
    // one notification preference, three places
    await card.locator('label:has(input[data-k="notify.enabled"])').first().click();
    await page.waitForFunction(()=>backend.config.notify.enabled===true);
    for(const view of ['settings','notifications'])await page.evaluate(v=>views[v].refresh(),view);
    await page.waitForFunction(()=>document.querySelector('#settings input[data-k="notify.enabled"]').checked&&document.querySelector('#notifications input[data-k="notify.enabled"]').checked);
    await notes.locator('label:has(input[data-k="notify.enabled"])').first().click();
    await page.waitForFunction(()=>backend.config.notify.enabled===false);
    await page.evaluate(()=>views.card.refresh());
    await page.waitForFunction(()=>!document.querySelector('#card input[data-k="notify.enabled"]').checked);
    // regression: notifications off then on keeps the phone list
    await page.evaluate(()=>views.settings.refresh());await page.waitForFunction(()=>!document.querySelector("#settings input[data-k=\"notify.enabled\"]").checked);
    await settings.locator('label:has(input[data-k="notify.enabled"])').first().click();await page.waitForFunction(()=>backend.config.notify.enabled===true);
    await settings.locator('label:has(input[data-k="notify.enabled"])').first().click();await page.waitForFunction(()=>backend.config.notify.enabled===false);
    await page.waitForFunction(()=>document.querySelectorAll('#settings button.pill').length===1);
    // phones are pills, shared with Live climate
    assert.equal(await page.evaluate(()=>{const g=document.querySelector('#settings .subgrp');return g.classList.contains('off')&&g.inert;}),true,'everything below the switch is grey and inert while notifications are off');
    await settings.locator('label:has(input[data-k="notify.enabled"])').first().click();await page.waitForFunction(()=>backend.config.notify.enabled===true);
    await page.waitForFunction(()=>{const g=document.querySelector('#settings .subgrp');return g&&!g.classList.contains('off')&&!g.inert;});
    await settings.locator('button.pill[data-dev="notify.mobile_app_phone"]').click();
    await page.waitForFunction(()=>JSON.stringify(backend.config.notify.devices)==='["notify.mobile_app_phone"]');
    await page.waitForFunction(()=>document.querySelector('#settings button.pill').getAttribute('aria-pressed')==='true');
    assert.equal(await settings.locator('.sw input[data-k^="dev:"]').count(),0,'phones are not switches');
    // every switch row has an explanation
    const bare=await page.evaluate(()=>[...document.querySelectorAll('#settings .row')].filter(r=>r.querySelector('.sw')&&!r.querySelector('.note')).map(r=>r.textContent.trim()));
    assert.deepEqual(bare,[],'switches without explanation');
    // battery notification toggle is shared by Settings → Battery protection and Notifications
    await settings.locator('section:has(h4:has-text("Battery protection")) input[data-k="event:battery"]').click({force:true});
    await page.waitForFunction(()=>backend.config.notify.events.battery===false);
    await page.evaluate(()=>views.notifications.refresh());
    await page.waitForFunction(()=>!document.querySelector('#notifications input[data-k="event:battery"]').checked);
    // battery protection blocks START with a visible reason
    await settings.locator('input[data-k="bat.enabled"]').click({force:true});
    await page.waitForFunction(()=>backend.config.battery.enabled===true);
    await page.evaluate(()=>{backend.soc=20;});await page.evaluate(()=>views.card.refresh());
    await page.waitForFunction(()=>/START blocked/.test(document.querySelector('#card').textContent)&&document.querySelector('#card [data-cmd=precondition_start]').disabled);
    // schedule editor: weekdays Ready By, then edit to custom days, disable, delete with confirmation
    await settings.locator('[data-act=new]').click();
    await settings.locator('[data-e=time]').fill('07:45');
    await settings.locator('[data-act=save-sched]').click();
    await page.waitForFunction(()=>backend.config.schedules.length===1&&backend.config.schedules[0].mode==='ready_by'&&backend.config.schedules[0].time==='07:45');
    await settings.locator('[data-edit]').click();
    await settings.locator('[data-seg=repeat][data-v=custom]').click();
    await settings.locator('[data-day="6"]').click({force:true});
    await settings.locator('[data-act=save-sched]').click();
    await page.waitForFunction(()=>JSON.stringify(backend.config.schedules[0].days)==='[0,1,2,3,4,6]');
    await settings.locator('input[data-k^="sched:"]').click({force:true});
    await page.waitForFunction(()=>backend.config.schedules[0].enabled===false);
    await settings.locator('[data-edit]').click();await settings.locator('[data-act=del]').click();
    assert.equal(await page.evaluate(()=>backend.config.schedules.length),1,'delete asks first');
    await page.waitForSelector('#settings dialog.pc-confirm [data-yes]');
    await page.evaluate(()=>document.querySelector('#settings dialog.pc-confirm [data-yes]').click());
    await page.waitForFunction(()=>backend.config.schedules.length===0);
    // using a bar never moves the page
    await page.setViewportSize({width:390,height:700});
    await page.evaluate(()=>{const r=document.querySelector('#settings input[data-bat=min_soc]');r.scrollIntoView({block:'center'});});
    const y0=await page.evaluate(()=>scrollY);
    await page.evaluate(()=>{const r=document.querySelector('#settings input[data-bat=min_soc]');r.value='30';r.dispatchEvent(new Event('input'));r.dispatchEvent(new Event('change'));});
    await page.waitForFunction(()=>backend.config.battery.min_soc===30);await page.waitForTimeout(300);
    assert(Math.abs(await page.evaluate(()=>scrollY)-y0)<2,'page moved after using a bar');
    await page.setViewportSize({width:1280,height:900});
    // diagnostics are tucked away in an advanced section
    assert.equal(await settings.locator('details summary:has-text("Diagnostics")').count(),1);
    // mobile layout: nothing wider than the screen
    for(const width of [320,390,768]){await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{document.querySelector('#quick').style.width='100%';});
      const over=await page.evaluate(()=>[...document.querySelectorAll('.pc *')].filter(n=>n.getBoundingClientRect().right>innerWidth+1).map(n=>{const r=n.getBoundingClientRect();return (n.tagName+'.'+(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)+' in '+(n.parentElement&&n.parentElement.className)+' right='+Math.round(r.right)+' w='+Math.round(r.width));}).slice(0,6));
      assert.deepEqual(over,[],'overflow at '+width+'px: '+JSON.stringify(over));}
    await page.evaluate(()=>{document.querySelector('#quick').style.width='440px';});
    {const sel='#settings .pc .hist';
      const sc=await page.evaluate(q=>{const h=document.querySelector(q);const cs=getComputedStyle(h);return {rows:h.children.length,over:cs.overflowY,max:cs.maxHeight,sh:h.scrollHeight,ch:h.clientHeight};},sel);
      assert.equal(sc.rows,40);assert.equal(sc.over,'auto');assert(sc.sh>sc.ch,'long history scrolls inside its block');
      await page.evaluate(()=>{document.querySelector('#settings [data-diag]').open=true;});
      await page.evaluate(()=>document.querySelector('#settings [data-act=clear-hist]').click());
      await page.waitForSelector('#settings dialog.pc-confirm [data-yes]');
      await page.evaluate(()=>document.querySelector('#settings dialog.pc-confirm [data-no]').click());
      assert.equal(await page.evaluate(()=>document.querySelectorAll('#settings .pc .hist>div').length),40,'cancel keeps the history');
      assert.equal(await page.evaluate(()=>!!document.querySelector('#settings dialog.pc-confirm')),false,'popup closes');
      await page.evaluate(()=>document.querySelector('#settings [data-act=clear-hist]').click());
      await page.waitForSelector('#settings dialog.pc-confirm [data-yes]');
      await page.evaluate(()=>document.querySelector('#settings dialog.pc-confirm [data-yes]').click());
      await page.waitForFunction(()=>!document.querySelector('#settings .pc .hist>div'));
      assert(await page.evaluate(()=>!document.querySelector('#settings [data-act=clear-hist]')),'no button when empty');}
    await page.evaluate(()=>{backend.globalOff=true;return views.settings.refresh();});
    await page.waitForFunction(()=>document.querySelector('#settings [data-pc=notifications] .info-box.warn'));
    assert.equal(await page.evaluate(()=>{const sec=document.querySelector('#settings [data-pc=notifications]');const g=sec.querySelector('.subgrp.off');return !!g&&g.inert&&/Notifications are off/.test(sec.textContent);}),true,'global notifications off: section is grey, inert and explains why');
    await page.evaluate(()=>{backend.globalOff=false;return views.settings.refresh();});
    await page.waitForFunction(()=>!document.querySelector('#settings [data-pc=notifications] .info-box.warn'));
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('deepal-companion-master',{detail:{on:false}})));
    await page.waitForFunction(()=>{const g=document.querySelector('#notifications [data-pc=notifications] .subgrp.off');return g&&g.inert&&document.querySelector('#notifications .info-box.warn');});
    assert.equal(await page.evaluate(()=>!document.querySelector('#settings [data-pc=notifications] .info-box.warn')),true,'only the Notifications page follows its own master switch live');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('deepal-companion-master',{detail:{on:true}})));
    await page.waitForFunction(()=>!document.querySelector('#notifications .info-box.warn')&&!document.querySelector('#notifications .subgrp.off'));
    assert.deepEqual(errors,[]);
    console.log('PASS: preconditioning card/settings/notifications share one backend preference; start/stop, battery block, schedules and mobile layout.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
