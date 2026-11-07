const assert=require('assert');
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel'),widget=panel.locator('deepal-companion-settings');
  assert.equal(await panel.locator('.app-advanced').count(),0,'User settings must not be hidden inside Advanced');
  const menus=await widget.locator('[data-tab]').allTextContents();
  assert.deepEqual(menus.map(n=>n.trim()),['Layout','Appearance','Controls','Charging','Colours','Diagnostics & tyres','Advanced']);
  const fields={layout:[],look:['hero_style','hero_sky'],controls:['climate_ui','target_style'],charge:['charge_style','charge_fx'],colours:['air_c1','air_t1','lvl_red','bat_t1','fuel_t1'],sensors:['tire_unit'],vehicle:['name','prefix','powertrain','car_color','iso_wheels','battery_kwh','fuel_max','image_path']};
  assert.equal(await panel.locator('.profile-setup [name=companion_design],.profile-setup [name=companion_width]').count(),2,'Card design belongs directly under Profile');
  for(const [tab,keys]of Object.entries(fields)){
    await widget.locator('[data-tab="'+tab+'"]').click();await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
    for(const key of keys)assert(await widget.locator('[data-set="'+key+'"],[data-sset^="'+key+'|"]').count(),'Missing '+key+' in '+tab);
    if(tab!=='vehicle')assert.equal(await widget.locator('[data-set="prefix"],ha-selector[data-entity-mapping],[data-set="image_path"],[data-discover],[data-add="diag_custom"]').count(),0,'Technical fields outside Advanced');
    if(tab==='vehicle')assert.equal(await widget.locator('[data-discover],[data-add="diag_custom"]').count(),2,'Sensor setup belongs in Advanced');
    if(tab==='colours'){
      const labels=await widget.locator('.sw-c span').allTextContents();assert.deepEqual(labels,['Cool','Mild','Warm','Red','Orange','Yellow','Green']);
      assert.equal(labels.some(n=>/[\u0370-\u03ff]/.test(n)),false,'English UI colour labels');
    }
  }
  await widget.locator('[data-tab="layout"]').click();await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
  console.log('PASS: direct user settings menus; technical fields only in Advanced; English colour labels.');
};
