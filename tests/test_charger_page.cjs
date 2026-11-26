const assert=require('assert');
const segParity=require('./seg_parity.cjs');
/* Regression: the Charger limit is one small block under the profiles on Charging Profiles (no page of its own, so the menu stays seven tabs). Checks: the block sits on the Charging Profiles page; the status chip; choosing the
   charger fills in the stop control and its direction by itself; the choices save at once (device, control, direction,
   mode); the mode is locked until a control exists; "Charge anyway" only shows while the charger is stopped; nothing
   overflows at 320 px. The page talks to a mocked backend, so no charger is ever touched.
   Run: CHARGER_PAGE_ONLY=1 node tests/test_browser.cjs */
const BOX='.cl';
module.exports=async page=>{
  await page.setViewportSize({width:1440,height:1050});
  const panel=page.locator('deepal-companion-panel');
  if(!(await page.evaluate(()=>!!document.querySelector('deepal-companion-panel').settings)))await panel.locator('[data-mode=settings]').click();
  await page.waitForFunction(()=>!!document.querySelector('deepal-companion-panel').settings);
  await page.evaluate(()=>{
    const h=window.testHass;if(h.chargerMock)return;h.chargerMock=true;const orig=h.callWS;
    /* live values: a lock, a switch, a power sensor (0 W) and an energy sensor (12.4 kWh) */
    h.states['lock.v2c_lock']={state:'locked',attributes:{friendly_name:'V2C lock'}};
    h.states['switch.v2c_charge']={state:'off',attributes:{friendly_name:'V2C charge'}};
    h.states['sensor.power_total']={state:'0',attributes:{friendly_name:'Power Total',unit_of_measurement:'W'}};
    h.states['sensor.charge_energy_once']={state:'12.4',attributes:{friendly_name:'Charge Energy Once',unit_of_measurement:'kWh'}};
    window.__cl={config:{mode:'off',device_id:null,control:null,on_stops:true,power:null,energy:null,profile:'auto',stop_option:null,start_option:null,start_button:null,status:null},command:null,phase:'off',target:80,soc:62,plugged:true,charging:true,control:{entity:null,state:null,name:null},device:null,failed:null,last:null,engaged:false,now:Date.now()/1000,
      devices:[{id:'d1',name:'V2C Trydan'},{id:'d2',name:'Garage wallbox'}],entities:[],sets:[],resumes:0,
      all_controls:[{entity:'lock.door',name:'lock.door'},{entity:'switch.garage_pump',name:'Garage pump'},{entity:'input_boolean.charge_stop',name:'Stop charging'},{entity:'switch.v2c_charge',name:'V2C charge'}],
      power_sensors:[{entity:'sensor.power_total',name:'Power Total'}],energy_sensors:[{entity:'sensor.charge_energy_once',name:'Charge Energy Once'}]};
    const ents={d1:[{entity:'lock.v2c_lock',name:'V2C lock'},{entity:'switch.v2c_charge',name:'V2C charge'}],d2:[{entity:'switch.wb_pause',name:'Pause'}]};
    const snap=()=>JSON.parse(JSON.stringify(window.__cl));
    const FEYREE={entity:'select.wb_toggle',name:'Toggle charging'};
    h.callWS=async m=>{
      if(m.op==='charger_limit_get')return snap();
      if(m.op==='charger_limit_set'){const c=window.__cl,v=m.data.value;c.sets.push(v);
        if('profile' in v){c.config.profile=v.profile;
          if(v.profile==='feyree'){c.config.control=FEYREE.entity;c.config.stop_option='Stop charging';c.config.start_option='Start charging';c.entities=[FEYREE];c.command={kind:'select',stop:'Stop charging',start:'Start charging',identified:true,options:['Start charging','Stop charging','Waiting for command'],buttons:[]};}
          else{c.config.control=ents.d1[0].entity;c.config.stop_option=c.config.start_option=null;c.entities=ents.d1;c.command=null;}
          return snap();}
        if('stop_option' in v||'start_option' in v){Object.assign(c.config,v);c.command.identified=!!(c.config.stop_option&&c.config.start_option);c.command.stop=c.config.stop_option;c.command.start=c.config.start_option;return snap();}
        if('device_id' in v){c.config.device_id=v.device_id;c.entities=ents[v.device_id]||[];if(v.device_id){c.config.control=c.entities[0].entity;c.config.on_stops=c.config.control.startsWith('lock.')||c.config.control.includes('pause');const o=(c.offers||{})[v.device_id]||{};if(o.power)c.config.power=o.power;if(o.energy)c.config.energy=o.energy;}else c.config.control=null;}
        else if('control' in v)c.config.control=v.control;
        if('on_stops' in v)c.config.on_stops=v.on_stops;
        if('power' in v)c.config.power=v.power;if('energy' in v)c.config.energy=v.energy;
        if('mode' in v)c.config.mode=v.mode;
        c.phase=c.config.mode==='off'?'off':'waiting';return snap();}
      if(m.op==='charger_limit_resume'){window.__cl.resumes++;window.__cl.phase='paused';window.__cl.engaged=false;return snap();}
      return orig(m);};
  });
  await panel.locator('[data-mode=chargers]').click();
  await page.waitForFunction(box=>{const x=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box);return !!x&&x.querySelectorAll('#cl-device option').length===3;},BOX);
  const S=sel=>panel.locator(BOX+' '+sel);

  assert.equal(await S('.cl-title').textContent(),'Charger limit','the block has its title');
  assert.equal(await panel.locator('.charging-settings').count(),1,'it sits under the charging profiles, which are still there');
  assert.equal(await panel.locator('nav [data-mode]').count(),7,'no extra menu item');
  assert.equal(await S('.cl-chip').textContent(),'Off','nothing is running yet');
  assert.equal(await S('[data-r=control]').isHidden(),true,'no stop control before a charger is chosen');
  assert.equal(await S('[data-r=polarity]').isHidden(),true);
  assert.equal(await S('[data-r=profile]').isHidden(),true,'no charger type before a charger is chosen');
  const polHintHiddenBefore=await S('.cl-polhint').isHidden();
  assert.equal(await S('[data-r=power]').isHidden(),true,'the power sensor waits for a charger too');
  assert.equal(await S('[data-r=energy]').isHidden(),true,'the energy sensor waits for a charger too');
  assert.equal(await S('[data-f=mode] button').first().isDisabled(),true,'the mode is locked until there is a control');

  /* choosing the charger fills the rest by itself */
  await S('#cl-device').selectOption('d1');
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' #cl-control').value==='lock.v2c_lock',BOX);
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets[0]),{device_id:'d1'},'only the charger is sent, the backend resets the control');
  assert.deepEqual(await S('[data-f=on_stops] button').allTextContents(),['Locked','Unlocked'],'a lock says Locked / Unlocked');
  assert.equal(await S('[data-f=on_stops] button[aria-pressed=true]').textContent(),'Locked','it stops when locked');
  assert.equal(await S('[data-val=control]').textContent(),'Locked','the live value beside Stop control says the lock state');
  assert.equal(await S('[data-val=device]').count(),1);
  assert.equal(await S('[data-val=device]').textContent(),'','the charger row has no live value');
  assert.equal(await S('[data-f=mode] button').first().isDisabled(),false,'the mode is available now');
  assert.equal(await S('[data-r=power]').isVisible(),true,'the power sensor shows once a charger is chosen');
  assert.equal(await S('[data-r=energy]').isVisible(),true,'the energy sensor shows once a charger is chosen');
  const polHint=await S('.cl-polhint').evaluate(p=>({text:p.textContent,visible:p.getClientRects().length>0,size:parseFloat(getComputedStyle(p).fontSize)}));
  assert.deepEqual({text:polHint.text,visible:polHint.visible,sizeOk:polHint.size<=12,hiddenBefore:polHintHiddenBefore},{text:'Choose the position that stops charging.',visible:true,sizeOk:true,hiddenBefore:true},'the caption under Stops charging when it is has its exact text, is hidden until a control is chosen, and is 12 px or less');

  /* the Charger type dropdown sits directly above the Stop control: Auto by default; Feyree swaps the polarity row for one read-only line */
  assert.deepEqual(await S('#cl-profile option').allTextContents(),['Auto (switch or lock)','Feyree (Tuya Local)'],'two charger types');
  assert.equal(await S('#cl-profile').inputValue(),'auto','Auto is the default, so saved setups look the same');
  assert.equal(await S('label[for=cl-profile]').textContent(),'Charger type');
  assert.equal(await S('#cl-profile').evaluate(e=>Math.round(e.getBoundingClientRect().height)),44,'the same 44 px select');
  await S('#cl-profile').selectOption('feyree');
  await page.waitForFunction(()=>window.__cl.config.profile==='feyree');
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{profile:'feyree'},'only the type is sent, the backend picks the command');
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' #cl-control').value==='select.wb_toggle',BOX);
  assert.equal(await S('[data-f=on_stops]').isHidden(),true,'no Locked / On row for a command charger');
  assert.equal(await S('.cl-polhint').textContent(),'Stops with \u201cStop charging\u201d \u00b7 restarts with \u201cStart charging\u201d','one read-only line');
  assert.equal(await S('.cl-pick').isHidden(),true,'no pickers when both commands were identified');
  await page.evaluate(()=>{window.__cl.command.identified=false;window.__cl.command.stop=null;window.__cl.config.stop_option=null;});
  await panel.evaluate(root=>root.localBoard.refresh());
  await page.waitForFunction(box=>!document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-pick').hidden,BOX);
  assert.equal(await S('.cl-polhint').isHidden(),true,'the line gives way to the two pickers');
  assert.deepEqual(await S('#cl-stopopt option').allTextContents(),['Choose the command','Start charging','Stop charging','Waiting for command']);
  await S('#cl-stopopt').selectOption('Stop charging');
  await page.waitForFunction(()=>window.__cl.config.stop_option==='Stop charging');
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{stop_option:'Stop charging'});
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-pick').hidden,BOX);
  await S('#cl-profile').selectOption('auto');
  await page.waitForFunction(()=>window.__cl.config.profile==='auto'&&window.__cl.config.control==='lock.v2c_lock');
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-f=on_stops]').hidden===false,BOX);
  assert.equal(await S('.cl-polhint').textContent(),'Choose the position that stops charging.','Auto looks as before');

  /* a switch says On / Off, and the direction saves at once */
  await S('#cl-control').selectOption('switch.v2c_charge');
  await page.waitForFunction(()=>window.__cl.config.control==='switch.v2c_charge');
  assert.deepEqual(await S('[data-f=on_stops] button').allTextContents(),['On','Off']);
  assert.equal(await S('[data-val=control]').textContent(),'Off','the live value beside Stop control: the switch is off');
  assert.equal(await S('[data-val=control]').getAttribute('data-muted'),'false','a live value is not muted');
  await S('[data-f=on_stops] button').nth(1).click();
  await page.waitForFunction(()=>window.__cl.config.on_stops===false);
  /* the live value follows the entity: the 5 s timer repaints only the value span, never the select */
  await page.evaluate(()=>{window.testHass.states['switch.v2c_charge'].state='on';});
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-val=control]').textContent==='On',BOX,{timeout:8000});
  assert.equal(await S('#cl-control').inputValue(),'switch.v2c_charge','the select keeps its value while the live value repaints');
  await page.evaluate(()=>{window.testHass.states['switch.v2c_charge'].state='off';});

  /* 'Choose another...' is the last option of the device's controls; it lists every lock, switch and input_boolean (name and entity id), and the pick is saved as the stop control */
  assert.deepEqual(await S('#cl-control option').evaluateAll(os=>os.map(o=>o.value)),['','lock.v2c_lock','switch.v2c_charge','__other__'],'the device controls, then Choose another last');
  await S('#cl-control').selectOption('__other__');
  await page.waitForFunction(box=>!!document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' #cl-control option[value="switch.garage_pump"]'),BOX);
  assert.deepEqual(await S('#cl-control option').allTextContents(),['Choose the control','lock.door','Garage pump (switch.garage_pump)','Stop charging (input_boolean.charge_stop)','V2C charge (switch.v2c_charge)'],'every lock, switch and input_boolean, with its name and entity id');
  await S('#cl-control').selectOption('switch.garage_pump');
  await page.waitForFunction(()=>window.__cl.config.control==='switch.garage_pump');
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{control:'switch.garage_pump'},'the pick is saved as the stop control on its own');
  assert.equal(await S('#cl-control').inputValue(),'switch.garage_pump','a control from another device stays selected');

  /* the power and energy sensors: None first, then every sensor of that class; choosing None saves null */
  assert.deepEqual(await S('#cl-power option').allTextContents(),['None / not used','Power Total'],'none first, then every power sensor');
  assert.deepEqual(await S('#cl-energy option').allTextContents(),['None / not used','Charge Energy Once'],'none first, then every energy sensor');
  assert.equal(await S('[data-val=power]').isHidden(),true,'no live value while None / not used is selected');
  await S('#cl-power').selectOption('sensor.power_total');
  await page.waitForFunction(()=>window.__cl.config.power==='sensor.power_total');
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{power:'sensor.power_total'},'the power sensor saves on its own');
  assert.equal(await S('[data-val=power]').textContent(),'0 W','the power value shows its state and unit');
  await S('#cl-power').selectOption('');
  await page.waitForFunction(()=>window.__cl.config.power===null);
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{power:null},'None saves null');
  assert.equal(await S('[data-val=power]').isHidden(),true,'choosing None hides the live value again');
  await S('#cl-energy').selectOption('sensor.charge_energy_once');
  await page.waitForFunction(()=>window.__cl.config.energy==='sensor.charge_energy_once');
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{energy:'sensor.charge_energy_once'},'the energy sensor saves on its own');
  assert.equal(await S('[data-val=energy]').textContent(),'12.4 kWh','the energy value shows its state and unit');
  /* changing the charger keeps the power and energy sensors the owner picked, when the new charger offers none (the mock's offers) */
  await S('#cl-power').selectOption('sensor.power_total');
  await page.waitForFunction(()=>window.__cl.config.power==='sensor.power_total');
  await S('#cl-device').selectOption('d2');
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' #cl-control').value==='switch.wb_pause',BOX);
  assert.deepEqual(await page.evaluate(()=>window.__cl.sets.at(-1)),{device_id:'d2'},'the device change sends only the charger');
  assert.equal(await S('#cl-power').inputValue(),'sensor.power_total','the power sensor keeps its value after a device change');
  assert.equal(await S('#cl-energy').inputValue(),'sensor.charge_energy_once','the energy sensor keeps its value after a device change');
  await S('#cl-power').selectOption('');
  await page.waitForFunction(()=>window.__cl.config.power===null);
  await page.evaluate(()=>{window.__cl.offers={d1:{power:'sensor.power_total'}};});
  await S('#cl-device').selectOption('d1');
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' #cl-control').value==='lock.v2c_lock',BOX);
  assert.equal(await S('#cl-power').inputValue(),'sensor.power_total','a sensor the new charger offers is set');
  assert.equal(await S('#cl-energy').inputValue(),'sensor.charge_energy_once','an energy sensor the charger does not offer is kept');
  await page.evaluate(()=>{window.__cl.offers={};});
  await page.evaluate(()=>{window.testHass.states['sensor.charge_energy_once'].state='unavailable';});
  await page.waitForFunction(box=>{const v=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-val=energy]');return !!v&&v.textContent==='Unavailable'&&v.dataset.muted==='true';},BOX,{timeout:8000});
  await page.evaluate(()=>{window.testHass.states['sensor.charge_energy_once'].state='12.4';});
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-val=energy]').textContent==='12.4 kWh',BOX,{timeout:8000});
  assert.equal(await S('#cl-energy').evaluate(e=>Math.round(e.getBoundingClientRect().height)),44,'the selects are 44 px tall');

  /* the charging target lives here now: presets and the slider save the card's charge_target */
  assert.equal(await S('[data-r=target]').isVisible(),true,'the target is set in this block');
  assert.deepEqual(await S('.cl-pre button').allTextContents(),['Off','70%','80%','90%']);
  assert.equal(await S('#cl-target').getAttribute('max'),'95','the slider stops at 95 %: a limit at 100 % does nothing');
  await S('.cl-pre button').nth(3).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===90);
  assert.equal(await S('.cl-tv').textContent(),'90%','the value shows beside the label');
  await S('#cl-target').evaluate(r=>{r.value=70;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===70);
  await S('.cl-pre button').first().click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===0);
  await S('.cl-pre button').nth(2).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===80);
  /* modes */
  assert.deepEqual(await S('[data-f=mode] button').allTextContents(),['Off','Dry run','Live']);
  await S('[data-f=mode] button').nth(1).click();
  await page.waitForFunction(()=>window.__cl.config.mode==='dry');
  /* the sliding pill is one element that persists across the group rebuilds and sits under the pressed mode button */
  {const read=()=>page.evaluate(box=>{const seg=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-f=mode]');const v=seg.querySelector(':scope > .vpill');const on=seg.querySelector(':scope > button.on');window.__pillRef=window.__pillRef||v;return {hp:seg.classList.contains('hp'),vpill:!!v,same:v===window.__pillRef,tx:v?v.style.transform:'',left:on?on.offsetLeft:-1,pressed:on?on.textContent.trim():''};},BOX);
    const r=await read();assert.equal(r.hp,true);assert.equal(r.vpill,true);assert.equal(r.pressed,'Dry run');assert.ok(r.tx.includes(String(r.left)),'pill at '+r.tx+' vs button '+r.left);
    await page.waitForFunction(box=>{const seg=document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' [data-f=mode]');return !!seg.querySelector(':scope > .vpill');},BOX);
    const r2=await read();assert.equal(r2.same,true,'pill element was rebuilt');
    /* the three choices (presets, stop direction, mode) have the Settings .seg pill: same transition, size, radius, colour, button font and height */
    await segParity(page,'deepal-companion-panel',[BOX+' .cl-pre',BOX+' [data-f=on_stops]',BOX+' [data-f=mode]']);
  }
  /* the chip and the ring use one goal: after the 90 % preset the chip says 90 % even though the backend still answers 80 */
  await S('.cl-pre button').nth(3).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===90);
  await page.waitForFunction(box=>/Waiting for 90%/.test(document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-chip').textContent),BOX);
  assert.equal(await S('.cl-tv').textContent(),'90%','the big value and the chip agree');
  await S('.cl-pre button').nth(2).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===80);
  await page.waitForFunction(box=>/Waiting for 80%/.test(document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-chip').textContent),BOX);
  /* a saved 100 % (set on the card earlier) shows as 100 % with the hint, and the user can pick a lower target */
  await page.evaluate(()=>{document.querySelector('deepal-companion-panel').config.charge_target=100;});
  await panel.evaluate(root=>root.localBoard.refresh());
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-hint').textContent==='A limit at 100% does nothing. Choose a lower target.',BOX);
  assert.equal(await S('.cl-tv').textContent(),'100%','a saved 100 % is shown as 100 %');
  assert.equal(await S('.cl-tile').getAttribute('data-over'),'true','the ring is drawn muted at 100 %');
  await page.evaluate(()=>{window.__clPhase=window.__cl.phase;window.__cl.phase='no_target';});
  await panel.evaluate(root=>root.localBoard.refresh());
  await page.waitForFunction(box=>document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-chip').textContent==='Target is 100%, nothing to stop',BOX);
  await page.evaluate(()=>{window.__cl.phase=window.__clPhase;});
  await S('.cl-pre button').nth(2).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===80);
  assert.equal(await S('.cl-tile').getAttribute('data-over'),'false');
  assert.equal(await S('.cl-act').isHidden(),true,'Charge anyway is hidden while charging is allowed');
  await S('[data-f=mode] button').nth(2).click();
  await page.waitForFunction(()=>window.__cl.config.mode==='live');

  /* stopped: Charge anyway appears and works (the page refreshes by itself every 15 s; ask for it now) */
  await page.evaluate(()=>{window.__cl.phase='stopped';window.__cl.engaged=true;});
  await panel.evaluate(root=>root.localBoard.refresh());
  await page.waitForFunction(box=>/Stopped at 80%/.test(document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-chip').textContent),BOX,{timeout:25000});
  assert.equal(await S('.cl-act').isVisible(),true);
  await S('.cl-act').click();
  await page.waitForFunction(()=>window.__cl.resumes===1);
  await page.waitForFunction(box=>/Paused until you plug in again/.test(document.querySelector('deepal-companion-panel').shadowRoot.querySelector(box+' .cl-chip').textContent),BOX);
  assert.equal(await S('.cl-act').isHidden(),true,'paused: nothing more to press');

  /* layout at 1440 px: a tile on the left (about 40 %) and the settings column on the right (about 60 %), measured with getBoundingClientRect.
     Everything is chosen by now (device, control, power, energy), so all four selects are on screen. */
  await S('#cl-power').selectOption('sensor.power_total');
  await page.waitForFunction(()=>window.__cl.config.power==='sensor.power_total');
  const geo=()=>page.evaluate(()=>{
    const r=document.querySelector('deepal-companion-panel').shadowRoot;
    const q=s=>r.querySelector('.cl '+s);
    const R=e=>{const b=e.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height};};
    const box=q('.cl-box');
    return {
      device:R(q('#cl-device')),profile:R(q('#cl-profile')),control:R(q('#cl-control')),power:R(q('#cl-power')),energy:R(q('#cl-energy')),
      deviceLabel:R(q('label[for=cl-device]')),powerLabel:R(q('label[for=cl-power]')),polLabel:R(q('[data-r=polarity] .cl-label')),
      controlLabel:R(q('label[for=cl-control]')),controlVal:R(q('[data-val=control]')),powerVal:R(q('[data-val=power]')),energyLabel:R(q('label[for=cl-energy]')),energyVal:R(q('[data-val=energy]')),
      polSeg:R(q('[data-f=on_stops]')),polRow:R(q('[data-r=polarity]')),modeSeg:R(q('[data-f=mode]')),modeLabel:R(q('[data-r=mode] .cl-label')),mode:R(q('.cl-mode')),
      tile:R(q('.cl-tile')),right:R(q('.cl-right')),hint:R(q('.cl-hint')),ring:R(q('.cl-ring-box')),
      arc:q('.cl-arc').getAttribute('stroke-dasharray'),arcPath:q('.cl-arc').getAttribute('pathLength'),arcHidden:q('.cl-arc').hidden,
      columns:getComputedStyle(box).gridTemplateColumns.split(' ').length,boxW:R(box).w,boxPad:parseFloat(getComputedStyle(box).paddingLeft)
    };
  });
  await page.setViewportSize({width:1440,height:1050});
  await page.waitForTimeout(300);
  /* the ring follows the slider while dragging, and the presets */
  await S('.cl-pre button').nth(3).click();
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===90);
  assert.equal(await S('.cl-arc').getAttribute('stroke-dasharray'),'90 100','the arc is 90 % of the ring after the 90 % preset');
  await S('#cl-target').evaluate(r=>{r.value=60;r.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await S('.cl-arc').getAttribute('stroke-dasharray'),'60 100','the arc follows the slider while dragging');
  assert.equal(await S('.cl-tv').textContent(),'60%','the centre label follows the slider');
  await S('#cl-target').evaluate(r=>{r.value=80;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('deepal-companion-panel').config.charge_target===80);
  assert.equal(await S('.cl-arc').getAttribute('stroke-dasharray'),'80 100','80 % target: the arc is 80 % of the ring');
  assert.equal(await S('.cl-arc').getAttribute('pathLength'),'100','the arc is measured on a 100 unit path');
  assert.equal(await S('.cl-ring').getAttribute('aria-hidden'),'true','the ring is decorative');
  const g=await geo();
  assert.equal(g.columns,2,'two columns on a wide screen');
  assert(Math.abs(g.tile.w/(g.boxW-2*g.boxPad-14)-0.35)<0.02,'the tile is about 35 % of the block, got '+(g.tile.w/(g.boxW-2*g.boxPad-14)).toFixed(3));
  assert(g.ring.w>=195&&g.ring.w<=205,'the ring is about 200 px at desktop width, got '+g.ring.w);
  assert(Math.abs(g.tile.h-g.right.h)<=24,'the tile and the settings column are about the same height, tile '+g.tile.h.toFixed(1)+' vs '+g.right.h.toFixed(1));
  for(const k of ['control','power','energy']){
    const lab=g[k+'Label'],val=g[k+'Val'];
    assert(Math.abs(lab.t-val.t)<=2,'the '+k+' label and its live value share a top, '+lab.t.toFixed(1)+' vs '+val.t.toFixed(1));
    assert(val.l>=lab.r-1,'the '+k+' live value sits to the right of its label');
    assert(Math.abs(lab.h-16)<=1,'the '+k+' label row stays one line (16 px), got '+lab.h.toFixed(1));
  }
  assert(Math.abs(g.controlVal.r-g.control.r)<=1,'the live value ends at the same right edge as its select');
  assert.equal(g.powerVal.h>0,true,'the power value is shown once a sensor is chosen');
  assert.equal(g.arc,'80 100','the arc length equals the target');
  for(const k of ['device','profile','control','power','energy'])assert(Math.abs(g[k].h-44)<=1,k+' select is 44 px tall, got '+g[k].h);
  assert(Math.abs(g.device.t-g.profile.t)<=1&&Math.abs(g.control.t-g.power.t)<=1,'the two selects of each row share a top');
  assert(Math.abs(g.device.w-g.profile.w)<=1&&Math.abs(g.control.w-g.power.w)<=1&&Math.abs(g.energy.w-g.device.w)<=1,'the selects share a width');
  assert(g.profile.l-g.device.l>100,'the second column starts to the right of the first');
  assert(Math.abs(g.control.l-g.device.l)<=1&&Math.abs(g.energy.l-g.device.l)<=1&&Math.abs(g.power.l-g.profile.l)<=1,'each column shares one left edge');
  assert(g.profile.b<=g.control.t+1&&g.device.b<=g.control.t+1,'the charger type is on the row above the stop control');
  assert(Math.abs(g.deviceLabel.l-g.device.l)<=1&&Math.abs(g.polSeg.l-g.device.l)<=1&&Math.abs(g.modeSeg.l-g.device.l)<=1&&Math.abs(g.modeLabel.l-g.device.l)<=1&&Math.abs(g.polLabel.l-g.device.l)<=1,'the right column labels and segmented controls share the first column edge');
  assert(Math.abs(g.tile.t-g.deviceLabel.t)<=1&&Math.abs(g.right.t-g.deviceLabel.t)<=1,'the tile and the right column share the top');
  assert(Math.abs(g.tile.b-g.hint.b)<=1,'the tile bottom lines up with the Mode hint');
  /* the polarity row ends at its caption now, so the Mode gap is measured from the row's bottom */
  const gap1=g.powerLabel.t-g.device.b,gap2=g.polLabel.t-g.energy.b,gap3=g.mode.t-g.polRow.b;
  assert(Math.abs(gap1-gap2)<=1,'the gap between the two rows of selects equals the gap to the stop direction, '+gap1.toFixed(1)+' vs '+gap2.toFixed(1));
  assert(Math.abs(gap1-gap3)<=1,'the gap above the Mode divider equals the other row gaps, '+gap1.toFixed(1)+' vs '+gap3.toFixed(1));
  assert(gap1>=12&&gap1<=16,'the gap is one of the 12-16 px gaps, got '+gap1.toFixed(1));
  if(process.env.CHARGER_SHOT){await page.evaluate(()=>{window.__cl.phase='stopped';});await panel.evaluate(root=>root.localBoard.refresh());await page.waitForTimeout(300);await panel.locator('.stage').first().screenshot({path:process.env.CHARGER_SHOT});}
  /* 320 px */
  await page.setViewportSize({width:320,height:800});
  await page.waitForTimeout(300);
  assert.equal(await panel.locator(BOX).evaluate(b=>b.scrollWidth<=b.clientWidth+1),true,'no horizontal overflow at 320 px');
  const n=await geo();
  assert.equal(n.columns,1,'one column at 320 px');
  assert(n.ring.w>=170&&n.ring.w<=180.5,'the ring shrinks to about 176 px under 720 px, got '+n.ring.w);
  for(const k of ['control','power','energy']){assert(n[k+'Label'].h<=17,'at 320 px the '+k+' label row does not wrap, got '+n[k+'Label'].h.toFixed(1));assert(n[k+'Val'].r<=n.right.r+1&&n[k+'Val'].l>=n[k+'Label'].r-1,'at 320 px the live value stays inside its row, right of the label');}
  assert(n.tile.b<=n.right.t+1,'at 320 px the tile sits above the settings');
  assert(Math.abs(n.device.l-n.control.l)<=1&&Math.abs(n.device.l-n.power.l)<=1&&Math.abs(n.device.l-n.energy.l)<=1&&Math.abs(n.device.l-n.profile.l)<=1,'at 320 px every select shares one left edge');
  assert(n.device.b<=n.profile.t+1&&n.profile.b<=n.control.t+1&&n.control.b<=n.power.t+1&&n.power.b<=n.energy.t+1,'at 320 px the selects stack, the charger type directly above the stop control');
  for(const k of ['device','profile','control','power','energy'])assert(Math.abs(n[k].w-n.device.w)<=1,'at 320 px each select is full width');
  assert.equal(await panel.locator(BOX).evaluate(b=>b.scrollWidth<=b.clientWidth+1),true,'still no horizontal overflow with the stacked layout');
  await page.setViewportSize({width:1440,height:1050});
  console.log('PASS: the Charger limit block on Charging Profiles: title, chip, the charger fills in the control and direction, the power and energy sensors and the Choose another list (saved at once, None saves null), the three selects hidden until a charger is chosen and 44 px tall, Charge anyway only while stopped; at 1440 px the 2 x 2 selects share edges, widths, heights and row gaps, the tile matches the settings top and Mode hint bottom, the ring arc equals the target and follows the slider; at 320 px one column, the ring about 200 px, no overflow.');
};
