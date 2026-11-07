const assert=require('assert');
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel');
  await panel.locator('[data-mode=history]').click();await panel.locator('.charge-session-list').waitFor();
  const track=await panel.locator('.charge-battery [role=progressbar]').first().evaluate(bar=>({track:getComputedStyle(bar).backgroundColor,fill:getComputedStyle(bar.firstElementChild).backgroundImage,surface:getComputedStyle(bar.closest('.charge-session')).backgroundColor}));
  assert.notEqual(track.track,'rgb(0, 0, 0)');assert.notEqual(track.track,track.surface,'Empty battery capacity has a visible contrasting track');assert(track.fill.includes('gradient'));
  assert.equal(await panel.locator('.archive table,.archive .table-scroll').count(),0,'Charging history must not use a scrolling table');
  const fixture=await panel.evaluate(root=>{
    const list=root.shadowRoot.querySelector('.charge-session-list');window.savedSessionList=list.innerHTML;
    const s=Date.now()-86400000,base={s,e:s+3600000,from:30,to:80,kwh:9.2,dc:false,live:false};
    const rows=[{...base,pricing:{energy:10,cost:0,estimated:true},assignment:{profile:{id:'work',name:'Work',free:true}}},{...base,s:s+2000,pricing:{energy:10,cost:3.25,estimated:false},assignment:{profile:{id:'public',name:'Public charger'}}},{...base,s:s+4000,pricing:{energy:null,cost:null,estimated:true}},{...base,s:s+6000,live:true,pricing:{energy:10,cost:999999.99,estimated:true},assignment:{profile:{id:'long',name:'Long charging location name to check responsive wrapping and readability'}}}];
    list.innerHTML=rows.map(row=>root.sessionCard(row)).join('');return rows.length;
  });
  assert.equal(fixture,4);assert.equal(await panel.locator('.charge-session[data-cost-state=free]').count(),1);assert.equal(await panel.locator('.charge-session[data-cost-state=unpriced]').count(),1);
  assert((await panel.locator('.charge-session[data-cost-state=unpriced] .charge-price').textContent()).includes('Not priced'));
  assert((await panel.locator('.charge-session[data-cost-state=free] .charge-price').textContent()).includes('Free charging'));
  assert.equal(await panel.locator('.charge-session[data-cost-state=free] [data-energy-value]').textContent(),'≈ 10','Energy replaces the sample amount, not the field label');assert.equal(await panel.locator('.charge-session[data-cost-state=free] .charge-energy>span:first-child').textContent(),'Charged energy');
  assert.equal(await panel.locator('.charge-session-icon h3').count(),0,'The icon sizing applies only to its badge, never to the date block');
  assert.equal(await panel.locator('.supplied-costs .cost-design-heading').count(),1,'The Costs page uses the supplied header');assert.equal(await panel.locator('.cost-design-filters [name=session_location]').count(),1);assert((await panel.locator('[data-energy-total]').textContent()).includes('kWh'),'Header totals come from the full archive aggregate');
  const line=panel.locator('.history-line-chart svg.en-ch');await line.waitFor();
  const arrow=await panel.locator('.history-line-chart [data-wk="-1"] svg path').evaluate(path=>({fill:getComputedStyle(path).fill,stroke:getComputedStyle(path).stroke}));assert.equal(arrow.fill,'none');assert.notEqual(arrow.stroke,'rgb(0, 0, 0)');assert.notEqual(arrow.stroke,'none');
  await page.setViewportSize({width:1440,height:1050});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector('.history-line-chart svg.en-ch')?.viewBox.baseVal.width>700,{},{timeout:3000});
  assert((await line.evaluate(svg=>svg.viewBox.baseVal.width))>700,'History chart must use the dashboard width: '+JSON.stringify(await line.evaluate(svg=>({view:svg.viewBox.baseVal.width,svg:svg.clientWidth,body:svg.closest('.en-body')?.clientWidth,host:svg.closest('.enpanel')?.clientWidth,viewport:innerWidth,loading:svg.closest('.stage')?.className}))));
  await line.focus();await page.keyboard.press('ArrowLeft');assert.equal(await panel.locator('.history-line-chart .en-tip').isVisible(),true);
  for(const width of [1440,768,430,390,360]){
    await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
    const fits=await panel.evaluate(root=>{const list=root.shadowRoot.querySelector('.charge-session-list');return list.scrollWidth<=list.clientWidth+1&&[...list.querySelectorAll('.charge-session,.charge-session-metrics,.charge-session-footer')].every(n=>n.scrollWidth<=n.clientWidth+1);});
    assert(fits,'Charging cards overflow at '+width);
    await panel.locator('[data-action=session-view-table]').click();assert(await panel.locator('.charge-session-list').evaluate(node=>node.classList.contains('is-table')));assert(await panel.locator('.charge-session-list').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Table layout must fit without horizontal scrolling');await panel.locator('[data-action=session-view-grid]').click();
  }
  await panel.evaluate(root=>{const list=root.shadowRoot.querySelector('.charge-session-list');list.innerHTML='<p class="charge-empty">No charging sessions available yet.</p>';});assert.equal(await panel.locator('.charge-empty').count(),1);
  await panel.evaluate(root=>{root.shadowRoot.querySelector('.charge-session-list').innerHTML=window.savedSessionList;});
  await page.setViewportSize({width:1440,height:1050});
  if(process.env.COST_CAPTURE){await panel.locator('.charge-session-list').screenshot({path:process.env.COST_CAPTURE+'-grid.png'});await panel.locator('[data-action=session-view-table]').click();await panel.locator('.charge-session-list').screenshot({path:process.env.COST_CAPTURE+'-table.png'});await panel.locator('[data-action=session-view-grid]').click();}
  await panel.evaluate(async root=>{const base=root.archiveRows[0];window.pageRows=Array.from({length:12},(_,i)=>({...base,id:'page'+i,s:base.s-i*86400000,e:base.e-i*86400000}));await root.showHistory(root.shadowRoot.querySelector('.stage'),root.mountRevision);});
  const pageRequestsBefore=await page.evaluate(()=>window.calls.filter(m=>m.op==='sessions_page').length);
  assert.equal(await panel.locator('.charge-session').count(),6);
  await panel.locator('[data-action=load-sessions]').click();assert.equal(await panel.locator('.charge-session').count(),12);
  assert.equal(await panel.locator('[data-action=load-sessions]').count(),0);
  assert.equal(await page.evaluate(()=>window.calls.filter(m=>m.op==='sessions_page').length),pageRequestsBefore+1,'Each Load more must request another database page');
  await page.evaluate(()=>delete window.pageRows);
  await panel.locator('[data-mode=settings]').click();await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  console.log('PASS: free/paid/unpriced/active charging cards, empty state, large amounts, narrow screens and responsive keyboard-accessible history chart.');
};
