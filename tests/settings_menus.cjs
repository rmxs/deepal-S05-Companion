const assert=require('assert');
module.exports=async page=>{
  const panel=page.locator('deepal-companion-panel'),widget=panel.locator('deepal-companion-settings');
  assert.equal(await panel.locator('.app-advanced').count(),0,'User settings must not be hidden inside Advanced');
  const menus=await widget.locator('[data-tab]').allTextContents();
  assert.deepEqual(menus.map(n=>n.trim()),['Layout','Appearance','Controls','Charging','Vehicle','Advanced']);
  /* Technical controls (mapping, photos folder, sensor search, card page, update rate) live only in Advanced. */
  const technical='[data-set="image_path"],[data-set="_mkey"],[data-addent],[data-delent],[data-discover],[data-update-rate],[data-card-page-view],[data-card-page-design],[data-card-page-sidebar]';
  const technicalTitles=['App settings','Card','Card page','Sidebar','Data update rate','Vehicle data','Tank','Photos (hero & dashboard)','Climate on-mode','Sensors','New sensors','Entity mapping','Size and margins','Image size and space','Margins','Airflow colours','Level colours','Notification colours','Charging records','Charging reminder','Charge detection','Charging curve'];
  const fields={layout:[],look:['hero_style','hero_sky','status_sub'],controls:['climate_ui','target_style'],charge:['charge_style','charge_fx','energy_ui','plan_button','energy_sheet','chg_roll','charge_cost_selector'],vehicle:['prefix','powertrain','battery_kwh','tire_unit','car_color','iso_wheels'],advanced:['name','fuel_max','image_path','climate_on_mode','image_scale','image_aspect','hero_space','card_padding','popup_padding','air_c1','air_t1','lvl_red','bat_t1','fuel_t1','notify_alert_level','charge_prompt_min_gain','charge_spike_jump','charge_curve_gap']};
  assert.equal(await panel.locator('.profile-setup [name=companion_design],.profile-setup [name=companion_width]').count(),2,'Card design belongs directly under Profile');
  for(const [tab,keys]of Object.entries(fields)){
    await widget.locator('[data-tab="'+tab+'"]').click();await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
    for(const key of keys)assert(await widget.locator('[data-set="'+key+'"],[data-sset^="'+key+'|"],[data-tgl="'+key+'"]').count(),'Missing '+key+' in '+tab);
    /* Car colour and wheels are vehicle settings: in Vehicle, and nowhere else in Card Settings. */
    const carControls=await widget.locator('[data-sset^="car_color|"],[data-set="iso_wheels"]').count();
    if(tab==='vehicle')assert(carControls>=2,'Car colour and wheels belong in Vehicle');
    else assert.equal(carControls,0,'Car colour and wheels must not be in '+tab);
    const headers=(await widget.locator('.grp > .gh h4').allTextContents()).map(n=>n.trim());
    if(tab!=='advanced'){
      assert.equal(await widget.locator(technical).count(),0,'Technical fields outside Advanced: '+tab);
      assert.deepEqual(headers.filter(h=>technicalTitles.includes(h)),[],'Technical sections outside Advanced: '+tab);
    }else{
      assert.equal(await widget.locator('[data-discover]').count(),1,'Sensor search belongs in Advanced');
      assert.equal(await widget.locator('select[data-set="_mkey"]').count(),1,'Entity mapping belongs in Advanced');
      assert.equal(await widget.locator('[data-update-rate]').count(),3,'Data update rate belongs in Advanced');
      assert.equal(await widget.locator('[data-card-page-view]').count(),1,'Card page belongs in Advanced');
      for(const title of ['App settings','Vehicle data','Sensors','Size and margins','Airflow colours','Level colours','Notification colours','Charging records'])assert(headers.includes(title),'Advanced section missing: '+title);
      const colourLabels=await widget.locator('.sw-c span').allTextContents();assert.deepEqual(colourLabels,['Cool','Mild','Warm','Red','Orange','Yellow','Green']);
      assert.equal(colourLabels.some(n=>/[\u0370-\u03ff]/.test(n)),false,'English UI colour labels');
    }
  }
  await widget.locator('[data-tab="layout"]').click();await page.waitForFunction(()=>!document.querySelector('deepal-companion-panel').settings._tabLoading);
  console.log('PASS: direct user settings menus; technical fields only in Advanced; English colour labels.');
};
