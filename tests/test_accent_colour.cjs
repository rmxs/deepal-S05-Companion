const assert=require('assert');
/* Theme colour: six colour blocks in Appearance (no dropdown), green by default, saved per profile, theme-aware,
   and never touching status colours or battery levels (the info tile icons do follow the theme colour). */
module.exports=async page=>{
  const panel=()=>document.querySelector('deepal-companion-panel');
  const first=await page.evaluate(()=>{const p=document.querySelector('deepal-companion-panel'),w=p.settings;w._setTab('look');
    const r=w.shadowRoot,blocks=[...r.querySelectorAll('[data-sset^="accent_color|"]')],id=b=>b.dataset.sset.split('|')[1];
    return {ids:blocks.map(id),on:blocks.filter(b=>b.classList.contains('on')).map(id),checked:blocks.filter(b=>b.getAttribute('aria-checked')==='true').length,
      select:!!r.querySelector('select[data-set="accent_color"]'),ac:p.preview._el.card.style.getPropertyValue('--ds-ac')};});
  assert.deepEqual(first.ids,['green','blue','violet','amber','rose','cyan','lime','coral','orange']);
  assert.deepEqual(first.on,['green']);assert.equal(first.checked,1);assert.equal(first.select,false);assert.equal(first.ac,'52,211,153');
  if(process.env.ACCENT_CAPTURE){ // optional screenshots for design review: ACCENT_CAPTURE=<path prefix>
    for(const [id,dark] of [['violet',true],['amber',false]]){
      await page.evaluate(([id,dark])=>{document.body.style.cssText+=dark?';background:#17191c;--card-background-color:#232528;--primary-text-color:#eee;--rgb-primary-text-color:238,238,238;--secondary-text-color:#aaa;--divider-color:#42464a':';background:#eef0f3;--card-background-color:#fff;--primary-text-color:#1c1c1c;--rgb-primary-text-color:28,28,28;--secondary-text-color:#5f6670;--divider-color:#d7dbe0';
        window.testHass.themes={darkMode:dark};const p=document.querySelector('deepal-companion-panel');p.preview.hass={...window.testHass};p.settings.hass={...window.testHass};p.settings.shadowRoot.querySelector('[data-sset="accent_color|'+id+'"]').click();},[id,dark]);
      await page.waitForTimeout(700);await page.screenshot({path:process.env.ACCENT_CAPTURE+'-'+id+'-'+(dark?'dark':'light')+'.png'});
    }
    await page.evaluate(()=>{window.testHass.themes={darkMode:true};});
  }
  await page.evaluate(()=>{window.calls.length=0;document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-sset="accent_color|blue"]').click();});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').preview._el.card.style.getPropertyValue('--ds-ac')==='0,145,255');
  const blue=await page.evaluate(()=>{const p=document.querySelector('deepal-companion-panel'),card=p.preview._el.card,css=getComputedStyle(card),tile=p.preview.shadowRoot.querySelector('.tile .i');
    return {saved:window.calls.some(m=>JSON.stringify(m).includes('"accent_color":"blue"')),ok:css.getPropertyValue('--ds-ok').trim(),ink:card.style.getPropertyValue('--ds-ac-ink'),rot:card.style.getPropertyValue('--ds-ac-rot'),
      tile:tile?getComputedStyle(tile).color:null,cfg:p.settings._cfg.accent_color,on:[...p.settings.shadowRoot.querySelectorAll('[data-sset^="accent_color|"].on')].map(b=>b.dataset.sset)};});
  assert.equal(blue.saved,true,'the choice is sent to the backend');assert.equal(blue.cfg,'blue');assert.deepEqual(blue.on,['accent_color|blue']);
  assert.equal(blue.ok,'52,211,153','status green is not the accent');assert.equal(blue.rot,JSON.parse(require('fs').readFileSync('source/colour-tokens.json','utf8')).accents.find(a=>a.id==='blue').hue+'deg');
  if(blue.tile)assert.equal(blue.tile,'rgb(0, 145, 255)','info tile icons follow the theme colour');
  // light Home Assistant theme uses the deeper shade; switching back restores the bright one
  await page.evaluate(()=>{window.testHass.themes={darkMode:false};document.querySelector('deepal-companion-panel').preview.hass={...window.testHass};});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').preview._el.card.style.getPropertyValue('--ds-ac')==='0,92,190');
  await page.evaluate(()=>{window.testHass.themes={darkMode:true};document.querySelector('deepal-companion-panel').preview.hass={...window.testHass};});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').preview._el.card.style.getPropertyValue('--ds-ac')==='0,145,255');
  // an unknown saved value falls back to green instead of breaking the card
  await page.evaluate(()=>document.querySelector('deepal-companion-panel').preview._patch({accent_color:'bogus'}));
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').preview._el.card.style.getPropertyValue('--ds-ac')==='52,211,153');
  await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings.shadowRoot.querySelector('[data-sset="accent_color|green"]').click());
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').settings._cfg.accent_color==='green');
  await page.evaluate(()=>document.querySelector('deepal-companion-panel').settings._setTab('layout')); /* leave the settings where the next test expects them */
  console.log('PASS: theme colour blocks, default green, save, light/dark shades, status and tile colours unchanged.');
};
