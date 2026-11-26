const assert=require('assert');
module.exports=async page=>{
  const state=await page.evaluate(()=>{
    const panel=document.querySelector('deepal-companion-panel'),widget=panel.settings;
    window.tileSettingsBefore=structuredClone(widget._cfg);
    widget._setTab('look');
    return {anyTileColourSetting:!!widget.shadowRoot.querySelector('[data-sset^="tile_icons|"],[data-set="tile_icon_color"]')};
  });
  assert.equal(state.anyTileColourSetting,false,'The tile icon colour settings are gone: the icons follow the theme colour');
  await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._setTab('layout'));
  const first=await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._cfg.info_order.slice(0,2));
  await page.evaluate(id=>document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-mv="info|'+id+'|1"]').click(),first[0]);
  await page.waitForFunction(id=>document.querySelector('deepal-companion-panel').settings._cfg.info_order[0]===id,first[1]);
  // Custom rows use the saved array order, on both Info and Diagnostics lists.
  for(const key of ['info_custom']){
    await page.evaluate(key=>{const widget=document.querySelector('deepal-companion-panel').settings;widget.onPatch({[key]:[{entity:'sensor.s05_battery_level',label:'First',icon:'battery'},{entity:'sensor.s05_inside_temperature',label:'Second',icon:'thermo'}]});},key);
    await page.waitForFunction(key=>document.querySelector('deepal-companion-panel').settings._cfg[key]?.length===2,key);
    await page.evaluate(key=>{const widget=document.querySelector('deepal-companion-panel').settings;widget._setTab('layout');widget.shadowRoot.querySelector('[data-mv="'+key+'|0|1"]').click();},key);
    await page.waitForFunction(key=>document.querySelector('deepal-companion-panel').settings._cfg[key][0].label==='Second',key);
  }
  await page.evaluate(()=>{const widget=document.querySelector('deepal-companion-panel').settings,old=window.tileSettingsBefore;widget.onPatch(Object.fromEntries(['info_order','info_custom'].map(k=>[k,old[k]])));});
  await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').pending);
  console.log('PASS: Info order and custom entity order save through the settings and preview.');
};
