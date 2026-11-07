const assert=require('assert');
module.exports=async page=>{
  const state=await page.evaluate(()=>{
    const panel=document.querySelector('deepal-companion-panel'),widget=panel.settings;
    window.tileSettingsBefore=structuredClone(widget._cfg);
    widget._setTab('look');const appearanceHasTiles=!!widget.shadowRoot.querySelector('[data-sset^="tile_icons|"]');
    widget._setTab('colours');const presets=[...widget.shadowRoot.querySelectorAll('[data-sset^="tile_icons|"]')].map(n=>n.textContent);
    widget.shadowRoot.querySelector('[data-sset="tile_icons|custom"]').click();
    return {appearanceHasTiles,presets};
  });
  assert.equal(state.appearanceHasTiles,false);assert.deepEqual(state.presets,['Green','Grey','Blue','Custom']);
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-set="tile_icon_color"]'));
  await page.evaluate(()=>{const field=document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-set="tile_icon_color"]');field.value='#e27b42';field.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').preview._el.card.style.getPropertyValue('--ds-tile-custom')==='#e27b42');
  await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._setTab('layout'));
  const first=await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._cfg.info_order.slice(0,2));
  await page.evaluate(id=>document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-mv="info|'+id+'|1"]').click(),first[0]);
  await page.waitForFunction(id=>document.querySelector('deepal-companion-panel').settings._cfg.info_order[0]===id,first[1]);
  // Custom rows use the saved array order, on both Info and Diagnostics lists.
  for(const key of ['info_custom','diag_custom']){
    await page.evaluate(key=>{const widget=document.querySelector('deepal-companion-panel').settings;widget.onPatch({[key]:[{entity:'sensor.s05_battery_level',label:'First',icon:'battery'},{entity:'sensor.s05_inside_temperature',label:'Second',icon:'thermo'}]});},key);
    await page.waitForFunction(key=>document.querySelector('deepal-companion-panel').settings._cfg[key]?.length===2,key);
    await page.evaluate(key=>{const widget=document.querySelector('deepal-companion-panel').settings;widget._setTab(key==='info_custom'?'layout':'vehicle');widget.shadowRoot.querySelector('[data-mv="'+key+'|0|1"]').click();},key);
    await page.waitForFunction(key=>document.querySelector('deepal-companion-panel').settings._cfg[key][0].label==='Second',key);
  }
  await page.evaluate(()=>{const widget=document.querySelector('deepal-companion-panel').settings,old=window.tileSettingsBefore;widget.onPatch(Object.fromEntries(['info_order','info_custom','diag_custom','tile_icons','tile_icon_color'].map(k=>[k,old[k]])));});
  await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').pending);
  console.log('PASS: tile presets/custom colour, Info order and custom entity order save through the settings and preview.');
};
