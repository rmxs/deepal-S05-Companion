const assert=require('assert');
/* Regression: on the Charging page the Charger limit block (.cl) keeps at least 16 px clear of the charging profiles above it
   and of anything below it, at desktop width and at 320 px; the "Charging profiles" section heading sits above the profiles;
   nothing overflows sideways at 320 px. Measured with getBoundingClientRect. The page talks to a mocked backend, so no charger
   is ever touched. Run: CHARGING_LAYOUT_ONLY=1 node tests/test_browser.cjs */
const GAP=16;
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel');
  await page.setViewportSize({width:1440,height:1050});
  if(!(await page.evaluate(()=>!!document.querySelector('deepal-companion-panel').settings)))await panel.locator('[data-mode=settings]').click();
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  await page.evaluate(()=>{
    const h=window.testHass;
    window.__cl={config:{mode:'off',device_id:null,control:null,on_stops:true,power:null},phase:'off',target:80,soc:62,plugged:true,charging:true,control:{entity:null,state:null,name:null},device:null,failed:null,last:null,engaged:false,now:Date.now()/1000,
      devices:[{id:'d1',name:'V2C Trydan'}],entities:[],sets:[],resumes:0};
    const snap=()=>JSON.parse(JSON.stringify(window.__cl));
    const orig=h.callWS;
    h.callWS=async m=>{
      if(m.op==='charger_limit_get'||m.op==='charger_limit_set'||m.op==='charger_limit_resume')return snap();
      return orig(m);};
  });
  await panel.locator('[data-mode=chargers]').click();
  await page.waitForFunction(()=>{const r=document.querySelector('deepal-companion-panel').shadowRoot;const t=r.querySelector('.stage .cl .cl-title');return !!t&&t.textContent.trim()==='Charger limit'&&!r.querySelector('.stage').classList.contains('is-loading');});
  await page.waitForTimeout(200);
  const measure=()=>page.evaluate(()=>{
    const host=document.querySelector('deepal-companion-panel'),r=host.shadowRoot,stage=r.querySelector('.stage');
    const cl=stage.querySelector(':scope>.cl'),profiles=stage.querySelector(':scope>.charging-settings');
    const title=profiles.querySelector('.charging-section-title'),editor=profiles.querySelector('.cc-editor');
    const box=e=>e.getBoundingClientRect();
    /* anything after the block in the page (not the block's own children): nearest visible box that starts below it */
    const below=[...r.querySelector('main').children].filter(n=>n!==stage&&getComputedStyle(n).display!=='none'&&box(n).height>0&&box(n).top>=box(cl).bottom-1).map(n=>box(n).top);
    return {
      titleText:title?.textContent.trim()||'',titleBottom:box(title).bottom,editorTop:box(editor).top,
      profileBottom:Math.max(box(profiles).bottom,box(editor).bottom),
      clTop:box(cl).top,clBottom:box(cl).bottom,clLeft:box(cl).left,clRight:box(cl).right,
      belowTop:below.length?Math.min(...below):null,
      viewport:window.innerWidth,docOverflow:document.documentElement.scrollWidth-window.innerWidth,
      hostOverflow:host.scrollWidth-host.clientWidth,stageOverflow:stage.scrollWidth-stage.clientWidth,clOverflow:cl.scrollWidth-cl.clientWidth
    };
  });
  const check=async(width,label)=>{
    await page.setViewportSize({width,height:1050});
    await page.waitForTimeout(350);
    const m=await measure();
    assert.equal(m.titleText,'Charging profiles',label+': the profiles have a visible section heading');
    assert(m.titleBottom<=m.editorTop,label+': the heading sits above the profiles '+JSON.stringify(m));
    const gap=m.clTop-m.profileBottom;
    assert(gap>=GAP,label+': the Charger limit is at least '+GAP+' px below the profiles, gap '+gap.toFixed(1)+' px '+JSON.stringify(m));
    if(m.belowTop!==null)assert(m.belowTop-m.clBottom>=GAP,label+': anything below the Charger limit is at least '+GAP+' px away '+JSON.stringify(m));
    assert(m.clLeft>=0&&m.clRight<=m.viewport,label+': the Charger limit fits the width '+JSON.stringify(m));
    assert(m.docOverflow<=0&&m.hostOverflow<=1&&m.stageOverflow<=1&&m.clOverflow<=1,label+': no horizontal overflow '+JSON.stringify(m));
    return gap;
  };
  const desktopGap=await check(1440,'desktop 1440');
  const phoneGap=await check(320,'phone 320');
  await page.setViewportSize({width:1440,height:1050});
  console.log('PASS: Charging page: the Charger limit is '+desktopGap.toFixed(1)+' px below the profiles on desktop and '+phoneGap.toFixed(1)+' px at 320 px (min '+GAP+'), the profiles have a heading, no horizontal overflow at 320 px.');
};
