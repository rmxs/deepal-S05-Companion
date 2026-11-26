/* Page headers: every panel page with a heading shows the one shared page head (icon, title, subtitle) at the top of the page.
   Car logs and Health sit on the page with no outer box; routine car-log events sit in a closed dropdown and warnings stay visible.
   Everything is mocked. Run through the browser harness: PAGE_HEAD_ONLY=1 node tests/test_browser.cjs */
const assert=require('assert');
module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  const panel=page.locator('deepal-companion-panel');
  const now=Math.floor(Date.now()/1000);
  await page.evaluate(({now})=>{
    const rows=[
      {id:'r1',time:now-60,cat:'security',kind:'locked',title:'Doors locked',sev:'info',icon:'mdi:lock-outline',origin:'direct'},
      {id:'r2',time:now-120,cat:'others',kind:'problem',title:'Tyre pressure warning',sev:'important',icon:'mdi:alert-outline',origin:'direct'},
      {id:'r3',time:now-300,cat:'charging',kind:'charging_end',title:'Charging ended',sev:'info',session:'c1',icon:'mdi:ev-station',origin:'direct',detail:{start_level:40,level:82,minutes:105,kwh:18.4}},
      {id:'r4',time:now-6300,cat:'charging',kind:'charging_start',title:'Charging started',sev:'info',session:'c1',origin:'direct',detail:{level:40}}
    ];
    window.pageMocks={...(window.pageMocks||{}),
      car_log_get:()=>({ready:true,retention_days:30,now,since:now-86400*5,active:[],rows,counts:{security:1,charging:1,others:1},status:{locked:true,doors_total:4,doors_open:0,windows_total:4,windows_open:0,battery:82,range:340,range_unit:'km',charging:false},summary:{},more:false}),
      health_get:()=>({status:'warning',version:'2.0.1',checked:now,counts:{ok:1,warning:1,error:0},checks:[{id:'sensor_batt',title:'Battery level',status:'ok',detail:'Reading 82%'},{id:'plan',title:'Charge plan',status:'warning',detail:'No plan',fix:'Set a plan'}]}),
      plan_debug_get:()=>({available:false})};
  },{now});
  const pages=['notifications','chargers','preconditioning','logs','health'];
  const seen={};
  for(const mode of pages){
    await panel.locator('[data-mode="'+mode+'"]').click();
    await page.waitForFunction(m=>{const root=document.querySelector('deepal-companion-panel');return root.mode===m&&!root.shadowRoot.querySelector('.stage').classList.contains('is-loading');},mode);
    await page.waitForTimeout(300);
    seen[mode]=await panel.evaluate(root=>{
      const stage=root.shadowRoot.querySelector('.stage'),head=stage.querySelector(':scope>.page-head');
      const norm=t=>(t||'').replace(/\s+/g,' ').trim().toLowerCase(),ht=norm(head?.querySelector('.ph-title')?.textContent),deep=(n,out)=>{for(const c of n.querySelectorAll('*')){if(c.shadowRoot)deep(c.shadowRoot,out);}for(const h of n.querySelectorAll('h1,h2,h3,h4,h5,[role=heading]'))if(!h.closest('.page-head'))out.push(norm(h.textContent));return out;};const heads=deep(stage,[]);return {dupes:heads.filter(t=>t===ht),heads,count:stage.querySelectorAll('.page-head').length,editorHead:[...stage.querySelectorAll('.cc-editor-head')].filter(e=>getComputedStyle(e).display!=='none').length,first:!!head&&stage.firstElementChild===head,page:head?.dataset.page||'',icon:head?.querySelector('.ph-icon ha-icon')?.getAttribute('icon')||'',title:head?.querySelector('.ph-title')?.textContent.trim()||'',sub:head?.querySelector('.ph-sub')?.textContent.trim()||'',h2:stage.querySelectorAll('h2').length};
    });
  }
  for(const mode of pages){
    const r=seen[mode];
    assert.equal(r.count,1,mode+': exactly one shared page head');
    assert.equal(r.editorHead||0,0,mode+': no second "Charging profiles" title inside the page');
    assert.deepEqual(r.dupes,[],mode+': no second title repeats the page head ('+r.heads.join(' | ')+')');
    assert(r.first,mode+': the page head is the first thing on the page');
    assert.equal(r.page,mode,mode+': head is tagged with its page');
    assert(/^mdi:/.test(r.icon),mode+': head has an mdi icon');
    assert(r.title.length>0&&r.sub.length>0,mode+': head has a title and a subtitle');
  }
  assert.equal(new Set(pages.map(m=>seen[m].icon)).size,pages.length,'every page has its own icon');
  /* Car logs and Health: the page root is a plain container, not a box with a border, background and padding. */
  for(const [mode,selector] of [['logs','.carlog'],['health','.health']]){
    await panel.locator('[data-mode="'+mode+'"]').click();
    await page.waitForFunction(m=>{const root=document.querySelector('deepal-companion-panel');return root.mode===m&&!root.shadowRoot.querySelector('.stage').classList.contains('is-loading');},mode);
    await page.waitForTimeout(300);
    const root=await panel.evaluate((node,sel)=>{const el=node.shadowRoot.querySelector('.stage '+sel);if(!el)return null;const cs=getComputedStyle(el);return {inBox:!!el.closest('.box'),border:cs.borderTopWidth,background:cs.backgroundColor,padding:cs.paddingTop,h2:node.shadowRoot.querySelectorAll('.stage h2').length};},selector);
    assert(root,mode+': page root '+selector+' is rendered');
    assert.equal(root.inBox,false,mode+': no .box ancestor around the page');
    assert.equal(root.border,'0px',mode+': no border around the page');
    assert.equal(root.background,'rgba(0, 0, 0, 0)',mode+': no background around the page');
    assert.equal(root.padding,'0px',mode+': no padding around the page');
    assert.equal(root.h2,1,mode+': the shared head is the only heading');
  }
  /* Car logs: every event is listed in its day (no dropdown); warnings and routine events are all visible. */
  await panel.locator('[data-mode="logs"]').click();
  await page.waitForFunction(()=>{const r=document.querySelector('deepal-companion-panel');return r.mode==='logs'&&!!r.shadowRoot.querySelector('.tl-item')&&!r.shadowRoot.querySelector('.stage').classList.contains('is-loading');});
  const logs=await panel.evaluate(root=>{
    const stage=root.shadowRoot.querySelector('.stage'),items=[...stage.querySelectorAll('.tl-item')];
    return {dropdown:stage.querySelectorAll('.carlog-normal').length,items:items.length,visible:items.filter(n=>n.checkVisibility({checkVisibilityCSS:true,contentVisibilityAuto:true})).length,warn:stage.querySelectorAll('.tl-item.important,.tl-item.critical').length};
  });
  assert.equal(logs.dropdown,0,'car log: no normal-events dropdown');
  assert(logs.items>=3&&logs.visible===logs.items,'car log: every event is visible');
  assert(logs.warn>=1,'car log: warnings are listed');
  /* Charging sessions: the title uses the shared page head above the card, not inside it. */
  await panel.locator('[data-mode="history"]').click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').mode==='history'&&!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.stage .cost-design-heading'),null,{timeout:15000});
  const hist=await panel.evaluate(root=>{const st=root.shadowRoot.querySelector('.stage');return {heads:st.querySelectorAll('.page-head').length,inCard:st.querySelectorAll('.cost-overview .page-head,.cost-overview h1,.cost-overview h2').length,title:st.querySelector('.page-head .ph-title')?.textContent,count:!!st.querySelector('.page-head [data-session-count]')};});
  assert.deepEqual({heads:hist.heads,inCard:hist.inCard,count:hist.count},{heads:1,inCard:0,count:true},'history: one shared page head outside the card, with the session count');
  assert(/Charging sessions/.test(hist.title||''),'history title: '+hist.title);
  console.log('PASS: shared page head on 5 pages with distinct icons, Car logs and Health without an outer box, all car-log events listed, no repeated page titles.');
};
