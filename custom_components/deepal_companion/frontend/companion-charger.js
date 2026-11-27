/* Charger limit block (shown under the profiles on Charging Profiles): stop charging at the charging target by switching the owner's own charger.
   A dark panel in two columns on a wide screen: a tile on the left (title, status chip, the target ring, the slider and presets) and the
   charger settings on the right (a 2 x 2 grid of selects, the stop direction, Charge anyway, then Mode). Under 720 px the block is one column.
   Everything saves as soon as it changes (the app's settings contract). The status chip says what the limit is doing now. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REFRESH_MS=15000;
const styles=`
.cl{container-type:inline-size;--cl-gap:14px;--cl-ring:200px;display:grid;gap:var(--cl-gap);min-width:0;color:var(--ds-fg,var(--primary-text-color));font-size:13px}
.cl .cl-box{display:grid;grid-template-columns:minmax(0,35fr) minmax(0,65fr);gap:var(--cl-gap);align-items:stretch;box-sizing:border-box;border:1px solid var(--cp-off-line);border-radius:var(--cp-block-r);padding:var(--cp-block-p);background:var(--cp-block-bg);min-width:0}
.cl .cl-tile{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;box-sizing:border-box;min-width:0;border:1px solid var(--cp-off-line);border-radius:var(--cp-block-r);padding:10px;background:var(--cp-off-bg,transparent)}
.cl .cl-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between;min-width:0}
.cl .cl-title{margin:0;font-size:15px;font-weight:600;flex:1;min-width:120px}
.cl .cl-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600;color:rgb(var(--c,var(--ds-info,121,173,255)));background:rgba(var(--c,var(--ds-info,121,173,255)),.14);width:max-content;max-width:100%}
.cl .cl-chip[data-tone=ok]{--c:var(--ds-ok,52,211,153)}.cl .cl-chip[data-tone=warn]{--c:var(--ds-warn,250,204,21)}.cl .cl-chip[data-tone=bad]{--c:var(--ds-bad,248,113,113)}.cl .cl-chip[data-tone=off]{--c:127,127,127;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-ring-wrap{display:grid;place-items:center;min-width:0}
.cl .cl-ring-box{position:relative;width:min(var(--cl-ring),100%);aspect-ratio:1;margin:0 auto}
.cl .cl-ring{display:block;width:100%;height:100%;overflow:visible}
.cl .cl-track{fill:none;stroke:var(--cp-track,rgba(127,127,127,.22));stroke-width:7}
.cl .cl-arc{fill:none;stroke:var(--cp-accent);stroke-width:7;stroke-linecap:round;transition:stroke-dasharray .45s cubic-bezier(.2,.8,.2,1)}
.cl .cl-centre{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:4px;text-align:center;pointer-events:none}
.cl .cl-ring-label{font-size:12px;color:var(--ds-fg2,var(--secondary-text-color));white-space:nowrap}
.cl .cl-tv{font-size:clamp(28px,calc(var(--cl-ring) * .15),44px);line-height:1;font-weight:700;color:var(--ds-fg,var(--primary-text-color));font-variant-numeric:tabular-nums}
.cl .cl-row{display:grid;gap:6px;min-width:0}
.cl .cl-row>span.cl-label{display:block;margin:0;padding:0;height:16px;line-height:16px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ds-fg2,var(--secondary-text-color))}
/* the label row: the label on the left, the live value of the chosen entity on the right, on one baseline */
.cl .cl-lh{display:flex;align-items:baseline;justify-content:space-between;gap:8px;height:16px;min-width:0}
.cl .cl-lh>label{display:block;flex:0 1 auto;min-width:0;margin:0;padding:0;line-height:16px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-val{flex:0 0 auto;margin:0;padding:0;line-height:16px;font-size:12px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--cp-accent)}
.cl .cl-val[data-muted=true]{font-weight:400;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-tile[data-over=true] .cl-arc{opacity:.4}.cl .cl-tile[data-over=true] .cl-tv{opacity:.5}
.cl .cl-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--cl-gap);min-width:0;align-items:start}
.cl .cl-right{display:flex;flex-direction:column;gap:var(--cl-gap);min-width:0}.cl .cl-right>*{flex:none}
.cl .cl-mode{display:grid;gap:var(--cl-gap);border-top:1px solid var(--cp-off-line);padding-top:var(--cl-gap);min-width:0}
.cl select{height:44px;min-height:44px;box-sizing:border-box;width:100%;margin:0;padding:0 10px;border-radius:10px;border:1px solid var(--ds-line,var(--divider-color));background:var(--ds-card,var(--card-background-color));color:inherit;font:inherit}
.cl select:focus-visible,.cl button:focus-visible,.cl input:focus-visible{outline:2px solid var(--cp-accent);outline-offset:2px}
.cl select:disabled{opacity:.55}
.cl .seg button:disabled{opacity:.55;cursor:default}
.cl .cl-hint{margin:0;font-size:12px;line-height:1.5;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-polhint{margin:2px 0 0;min-width:0;font-size:11px;line-height:1.3;overflow-wrap:anywhere;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-pick{display:grid;gap:var(--cl-gap);min-width:0;margin-top:6px}
.cl .cl-act,.cl .cl-tbtn{justify-self:stretch;min-height:44px;border-radius:14px;border:1px solid var(--cp-off-line);background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;padding:0 14px}
/* Test stop: the button and one short line beside it (why it is off, running, or the last result); wraps under the button on a narrow screen */
.cl .cl-test{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;min-width:0;margin-top:6px}
.cl .cl-tbtn{flex:none}.cl .cl-tbtn:disabled{opacity:.55;cursor:default}
.cl .cl-testmsg{flex:1 1 140px;min-width:0;margin:0;font-size:11px;line-height:1.3;overflow-wrap:anywhere;color:var(--ds-fg2,var(--secondary-text-color))}
.cl .cl-testmsg[data-tone=ok]{color:rgb(var(--ds-ok,52,211,153))}.cl .cl-testmsg[data-tone=warn]{color:rgb(var(--ds-warn,250,204,21))}.cl .cl-testmsg[data-tone=bad]{color:rgb(var(--ds-bad,248,113,113))}
.cl .cl-slide{display:grid;gap:2px;min-width:0}
.cl .cl-slide input[type=range]{height:36px}
.cl input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:44px;margin:0;padding:0;background:transparent;--p:0%}
.cl input[type=range]:disabled{opacity:.55}
.cl input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(to right,var(--cp-accent) var(--p),var(--cp-track,rgba(127,127,127,.22)) var(--p))}
.cl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;margin-top:-8px;border:0;border-radius:50%;background:var(--cp-accent);cursor:pointer;box-shadow:0 0 0 5px color-mix(in srgb,var(--cp-accent) 22%,transparent),0 0 14px color-mix(in srgb,var(--cp-accent) 70%,transparent)}
.cl input[type=range]::-moz-range-track{height:6px;border-radius:6px;background:var(--cp-track,rgba(127,127,127,.22))}
.cl input[type=range]::-moz-range-progress{height:6px;border-radius:6px;background:var(--cp-accent)}
.cl input[type=range]::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:var(--cp-accent);cursor:pointer;box-shadow:0 0 0 5px color-mix(in srgb,var(--cp-accent) 22%,transparent),0 0 14px color-mix(in srgb,var(--cp-accent) 70%,transparent)}
.cl .cl-pre button{font-variant-numeric:tabular-nums}
.cl [hidden]{display:none!important}
@container (max-width:720px){
  .cl .cl-box{grid-template-columns:minmax(0,1fr)}
  .cl .cl-ring-box{--cl-ring:176px}
  .cl .cl-grid{grid-template-columns:minmax(0,1fr)}
}
@media (prefers-reduced-motion:reduce){.cl .cl-arc{transition:none}}
`;
const PHASES={
  off:['Off','ok'],waiting:['Waiting for {0}%','info'],stopped:['Stopped at {0}%','ok'],paused:['Paused until you plug in again','warn'],
  would_stop:['Dry run: would have stopped at {0}%','info'],failed:['Could not stop the charger','bad'],unavailable:['Charger not available','warn'],no_target:['No charging target set','warn'],target_full:['Target is 100%, nothing to stop','warn']
};
const RING_R=44,RING_LEN=100;
export async function mountCharger(panel,stage,options={}){
  const T=(text,...args)=>{let out=panel.t(text);args.forEach((a,i)=>{out=String(out).replace('{'+i+'}',a);});return out;};
  const admin=!!panel._hass?.user?.is_admin;
  const host=document.createElement('div');host.className='cl';
  host.innerHTML='<style>'+styles+'</style><section class="cl-box">'
    +'<div class="cl-tile"><div class="cl-top"><h4 class="cl-title"></h4><span class="cl-chip" role="status"></span></div>'
    +'<div class="cl-ring-wrap"><div class="cl-ring-box"><svg class="cl-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle class="cl-track" cx="50" cy="50" r="'+RING_R+'"/><circle class="cl-arc" cx="50" cy="50" r="'+RING_R+'" pathLength="'+RING_LEN+'" transform="rotate(-90 50 50)" stroke-dasharray="0 '+RING_LEN+'"/></svg>'
    +'<div class="cl-centre"><span class="cl-ring-label"></span><b class="cl-tv"></b></div></div></div>'
    +'<div class="cl-slide" data-r="target"><input type="range" id="cl-target" min="50" max="95" step="5" data-f="target"><div class="seg cl-pre" role="group" data-f="target"></div></div></div>'
    +'<div class="cl-right"><div class="cl-grid">'
    +'<div class="cl-row" data-r="device"><div class="cl-lh"><label for="cl-device"></label><span class="cl-val" data-val="device"></span></div><select id="cl-device" data-f="device_id"></select></div>'
    +'<div class="cl-row" data-r="profile"><div class="cl-lh"><label for="cl-profile"></label></div><select id="cl-profile" data-f="profile"></select></div>'
    +'<div class="cl-row" data-r="control"><div class="cl-lh"><label for="cl-control"></label><span class="cl-val" data-val="control"></span></div><select id="cl-control" data-f="control"></select></div>'
    +'<div class="cl-row" data-r="power"><div class="cl-lh"><label for="cl-power"></label><span class="cl-val" data-val="power"></span></div><select id="cl-power" data-f="power"></select></div>'
    +'<div class="cl-row" data-r="energy"><div class="cl-lh"><label for="cl-energy"></label><span class="cl-val" data-val="energy"></span></div><select id="cl-energy" data-f="energy"></select></div>'
    +'</div>'
    +'<div class="cl-row" data-r="polarity"><span class="cl-label"></span><div class="seg" role="group" data-f="on_stops"></div><p class="cl-polhint"></p>'
    +'<div class="cl-pick" hidden><div class="cl-row"><div class="cl-lh"><label for="cl-stopopt"></label></div><select id="cl-stopopt" data-f="stop_option"></select></div><div class="cl-row"><div class="cl-lh"><label for="cl-startopt"></label></div><select id="cl-startopt" data-f="start_option"></select></div></div>'
    +'<div class="cl-test" hidden><button type="button" class="cl-tbtn"></button><p class="cl-testmsg" role="status"></p></div></div>'
    +'<button type="button" class="cl-act" hidden></button>'
    +'<div class="cl-mode"><div class="cl-row" data-r="mode"><span class="cl-label"></span><div class="seg" role="group" data-f="mode"></div></div><p class="cl-hint"></p></div>'
    +'</div></section>';
  stage.append(host);
  const q=s=>host.querySelector(s);
  let dead=false,busy=false,again=false,timer=null,liveTimer=null,testTimer=null,data=null,saving=false,pickAll=false;const owner={...panel.selected};
  const uiNoun=e=>String(e||'').startsWith('lock.');
  const ctlLabel=e=>e.name&&e.name!==e.entity?e.name+' ('+e.entity+')':e.entity;
  /* the pickers list what looks like the charger's (the backend's fit flag; a list without it shows everything); the chosen
     entity always stays, and a last 'Show all…' option lists everything for that picker until another charger is chosen */
  const showAll=new Set(),ALL='__all__';
  function fitting(list,key,...keep){
    const all=list||[];if(showAll.has(key))return {list:all,more:false};
    const out=all.filter(e=>e.fit!==false||keep.includes(e.entity));return {list:out,more:out.length<all.length};
  }
  const more=r=>r.more?[[ALL,T('Show all…')]]:[];
  /* the Test stop line: running, the last result (for an hour), or why the button is off */
  const TEST_FRESH_S=3600;
  function paintTest(cfg,locked){
    const box=q('.cl-test'),btn=q('.cl-tbtn'),msg=q('.cl-testmsg'),test=data.test||null;
    box.hidden=!admin||!cfg.control||!test;if(box.hidden)return;
    const last=test.last,running=last?.result==='running',fresh=last&&last.finished&&(Number(data.now)||0)-last.finished<TEST_FRESH_S;
    btn.textContent=T('Test stop');btn.disabled=locked||running||!!test.block;
    let text='',tone='';
    if(running)text=T('Testing the stop…');
    else if(fresh&&last.result==='ok'){text='✓ '+T('Stopped in {0} s.',last.took)+' '+T(last.restarted?'Charging restarted.':'Charging could not be restarted. Companion will keep trying.');tone=last.restarted?'ok':'warn';}
    else if(fresh&&last.result==='failed'){const r=last.reason||{};text=T(r.key||'The charger did not stop',...(r.args||[]))+(last.restarted===false?' · '+T('Charging could not be restarted. Companion will keep trying.'):'');tone='bad';}
    else if(test.block_text)text=T(test.block_text);
    msg.textContent=text;msg.dataset.tone=tone;msg.hidden=!text;
  }
  /* the Settings .seg markup: the first button's data-k keys the group's sliding pill (draw() snapshots and applies it) */
  function seg(el,options,value,disabled){
    el.querySelectorAll(':scope > button').forEach(b=>b.remove());
    el.append(...options.map(([v,label])=>{const b=document.createElement('button');b.type='button';b.dataset.v=String(v);b.dataset.k=el.dataset.f||'';b.textContent=label;const on=String(v)===String(value);b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));b.disabled=disabled;return b;}));
  }
  function fill(select,options,value,empty){
    const list=empty==null?[...options]:[['',empty],...options];if(value&&!options.some(([v])=>v===value))list.push([value,value]);
    select.replaceChildren(...list.map(([v,label])=>{const o=document.createElement('option');o.value=v;o.textContent=label;return o;}));select.value=value||'';
  }
  /* the ring and the slider track both follow one number: the target in percent (0 = Off, no arc) */
  function paintRing(value){
    const goal=Math.max(0,Math.min(100,Number(value)||0)),arc=q('.cl-arc'),rng=q('#cl-target');
    arc.hidden=goal<=0;arc.setAttribute('stroke-dasharray',goal+' '+RING_LEN);
    const pos=Math.max(50,Math.min(95,Number(rng.value)||50));rng.style.setProperty('--p',((pos-50)/45*100)+'%');
  }
  /* the live value beside a label: the chosen entity's state from the panel's Home Assistant object (the device row has none) */
  const LIVE_SELECT={control:'#cl-control',power:'#cl-power',energy:'#cl-energy'};
  function liveText(entity){
    const states=panel._hass?.states;if(!states||!entity||entity==='__other__')return null;
    const st=states[entity];if(!st)return {text:T('Unavailable'),muted:true};
    const s=String(st.state??'');
    if(s===''||s==='unavailable'||s==='unknown')return {text:T('Unavailable'),muted:true};
    const dom=entity.split('.')[0];
    if(dom==='button')return null;
    if(dom==='lock')return {text:s==='locked'?T('Locked'):s==='unlocked'?T('Unlocked'):s};
    if(dom==='switch'||dom==='input_boolean')return {text:s==='on'?T('On'):s==='off'?T('Off'):s};
    const unit=st.attributes?.unit_of_measurement;
    return {text:unit?s+' '+unit:s};
  }
  /* only the value spans change here; the selects are never rebuilt by this timer */
  function paintValues(){
    if(dead)return;
    for(const key of Object.keys(LIVE_SELECT)){
      const span=q('[data-val='+key+']');if(!span)continue;
      const row=span.closest('.cl-row'),v=q(LIVE_SELECT[key])?.value||'';
      const live=(row?.hidden||!v)?null:liveText(v);
      span.hidden=!live;span.textContent=live?live.text:'';span.dataset.muted=String(!!live?.muted);
    }
  }
  function draw(){
    if(dead||!data)return;
    const snap=window.__DEEPAL_COMPANION_UI?.pillSnap?.(host);
    /* one goal for the whole block (chip, ring, value, slider, presets, hint): the panel's charge_target once it is set, else the backend's target */
    const cfg=data.config,goal=Math.max(0,Math.min(100,Number(panel.config?.charge_target??data.target)||0)),phase=PHASES[data.phase==='no_target'&&goal>=100?'target_full':data.phase]||PHASES.off,chip=q('.cl-chip');q('.cl-title').textContent=T('Charger limit');
    chip.textContent=T(phase[0],goal);chip.dataset.tone=phase[1];
    q('.cl-tile').dataset.over=String(goal>=100);
    q('label[for=cl-device]').textContent=T('Charger');q('label[for=cl-control]').textContent=T('Stop control');
    q('label[for=cl-power]').textContent=T('Power sensor (optional)');q('label[for=cl-energy]').textContent=T('Energy sensor (optional)');
    const locked=!admin||saving;
    q('.cl-ring-label').textContent=T('Stop charging at');q('.cl-tv').textContent=goal>0?goal+'%':T('Off');
    const rng=q('#cl-target');rng.value=goal>0?goal:50;rng.disabled=locked;rng.setAttribute('aria-label',T('Stop charging at'));
    paintRing(goal);
    seg(q('.cl-pre'),[[0,T('Off')],[70,'70%'],[80,'80%'],[90,'90%']],goal,locked);
    const devSel=q('#cl-device');fill(devSel,(data.devices||[]).map(d=>[d.id,d.name]),cfg.device_id,T('Choose your charger'));devSel.disabled=locked;
    const profRow=q('[data-r=profile]'),profSel=q('#cl-profile');
    q('label[for=cl-profile]').textContent=T('Charger type');
    fill(profSel,[['auto',T('Auto (switch or lock)')],['feyree',T('Feyree (Tuya Local)')]],cfg.profile||'auto',null);profSel.disabled=locked;profRow.hidden=!cfg.device_id;
    const ctlRow=q('[data-r=control]'),polRow=q('[data-r=polarity]'),powRow=q('[data-r=power]'),enRow=q('[data-r=energy]');
    ctlRow.hidden=!cfg.device_id;powRow.hidden=!cfg.device_id;enRow.hidden=!cfg.device_id;polRow.hidden=!cfg.control;
    /* the device's own controls, or every lock, switch and input_boolean once 'Choose another...' is picked or the control is not on this device */
    const deviceCtls=data.entities||[],wide=pickAll||(!!cfg.control&&!deviceCtls.some(e=>e.entity===cfg.control));
    const ctlSel=q('#cl-control');
    const wideCtls=fitting(data.all_controls,'control',cfg.control),ownCtls=deviceCtls.filter(e=>e.fit!==false||e.entity===cfg.control);
    fill(ctlSel,wide?[...wideCtls.list.map(e=>[e.entity,ctlLabel(e)]),...more(wideCtls)]:[...ownCtls.map(e=>[e.entity,e.name]),['__other__',T('Choose another…')]],cfg.control,T('Choose the control'));ctlSel.disabled=locked;
    const powSel=q('#cl-power'),enSel=q('#cl-energy'),pows=fitting(data.power_sensors,'power',cfg.power);
    fill(powSel,[...pows.list.map(e=>[e.entity,e.name]),...more(pows)],cfg.power,T('None / not used'));powSel.disabled=locked;
    fill(enSel,(data.energy_sensors||[]).map(e=>[e.entity,e.name]),cfg.energy,T('None / not used'));enSel.disabled=locked;
    const lock=uiNoun(cfg.control);
    polRow.querySelector('.cl-label').textContent=T('Stops charging when it is');q('.cl-polhint').textContent=T(data.control_guess?'Companion guessed this from the names. Check that this position stops charging.':'Choose the position that stops charging.');
    seg(q('[data-f=on_stops]'),[[true,T(lock?'Locked':'On')],[false,T(lock?'Unlocked':'Off')]],String(!!cfg.on_stops),locked);
    /* a select or button control: the polarity row becomes one read-only line (or, only when the commands were not identified, two pickers) */
    const cmd=cfg.control?data.command:null,pick=q('.cl-pick');
    polRow.querySelector('.cl-label').hidden=!!cmd;q('[data-f=on_stops]').hidden=!!cmd;pick.hidden=!cmd||cmd.identified;
    if(cmd){
      q('.cl-polhint').hidden=!cmd.identified;
      if(cmd.identified)q('.cl-polhint').textContent=T('Stops with “{0}” · restarts with “{1}”',cmd.stop,cmd.start);
      else{
        const btn=cmd.kind==='button',btns=fitting(cmd.buttons,'cmd',cfg.control,cfg.start_button),list=btn?[...btns.list.map(e=>[e.entity,e.name]),...more(btns)]:(cmd.options||[]).map(o=>[o,o]);
        q('label[for=cl-stopopt]').textContent=T('Stop command');q('label[for=cl-startopt]').textContent=T('Start command');
        const a=q('#cl-stopopt'),b=q('#cl-startopt');
        fill(a,list,btn?cfg.control:cfg.stop_option,T('Choose the command'));fill(b,list,btn?cfg.start_button:cfg.start_option,T('Choose the command'));a.disabled=b.disabled=locked;
      }
    }else q('.cl-polhint').hidden=false;
    seg(q('[data-f=mode]'),[['off',T('Off')],['dry',T('Dry run')],['live',T('Live')]],cfg.mode,locked||!cfg.control);
    q('[data-r=mode] .cl-label').textContent=T('Mode');
    q('.cl-hint').textContent=goal>=100?T('A limit at 100% does nothing. Choose a lower target.'):goal>0?T('Dry run only tells you what it would do. The card shows the same target.'):T('Choose where charging should stop.');
    paintValues();
    paintTest(cfg,locked);
    const act=q('.cl-act');act.hidden=!(admin&&data.phase==='stopped');act.textContent=T('Charge anyway');act.disabled=saving;
    window.__DEEPAL_COMPANION_UI?.pillApply?.(host,snap);
  }
  async function load(){
    if(dead)return;if(busy){again=true;return;}busy=true;
    try{data=await panel.request('charger_limit_get',{},owner);if(!dead&&!saving){if(q('select:focus')){paintValues();paintTest(data.config,!admin||saving);}else draw();}}
    catch(error){if(!dead)q('.cl-chip').textContent=/Unknown Companion operation/i.test(error.message||'')?T('Restart Home Assistant to load the updated Companion backend.'):(window.__DEEPAL_COMPANION_UI.tError(error.message)||String(error));}
    finally{busy=false;if(!dead&&again){again=false;load();}follow();}
  }
  /* while a stop test runs, ask every 2 s so its result shows as soon as it is known */
  const TEST_POLL_MS=2000;
  function follow(){
    if(dead||testTimer||data?.test?.last?.result!=='running')return;
    testTimer=setTimeout(()=>{testTimer=null;load();},TEST_POLL_MS);
  }
  async function runTest(){
    const ask=window.__DEEPAL_COMPANION_UI?.confirm,title=T('Test stop'),text=T('This stops charging now to test the settings, then starts it again.');
    const ok=ask?await ask(title,text,title):window.confirm(text);
    if(!ok||dead)return;
    saving=true;draw();
    try{const result=await panel.request('charger_limit_test',{},owner);data={...data,...result};}
    catch(error){panel.status?.(window.__DEEPAL_COMPANION_UI?.tError?.(error.message)||error.message||String(error),'error');}
    finally{saving=false;if(!dead){draw();follow();}}
  }
  async function save(value){
    if(!admin||dead)return;saving=true;draw();
    try{const result=await panel.request('charger_limit_set',{value},owner);data={...data,...result};panel.status?.(T('Saved'),'success');}
    catch(error){panel.status?.(error.message||String(error),'error');}
    finally{saving=false;if(!dead){draw();load();}}
  }
  async function setTarget(value){
    if(!admin||dead)return;saving=true;draw();
    try{panel.patch({charge_target:value});await panel.queue;}
    catch(error){panel.status?.(error.message||String(error),'error');}
    finally{saving=false;if(!dead){draw();load();}}
  }
  host.addEventListener('input',event=>{if(event.target.id==='cl-target'){const v=event.target.value;q('.cl-tv').textContent=v+'%';paintRing(v);}});
  host.addEventListener('change',event=>{
    if(event.target.id==='cl-target'){setTarget(Number(event.target.value));return;}
    const f=event.target.dataset?.f,v=event.target.value||null;
    if(v===ALL){showAll.add(f==='stop_option'||f==='start_option'?'cmd':f);draw();return;}
    if(f==='device_id'){pickAll=false;showAll.clear();save({device_id:v});}
    else if(f==='control'){if(v==='__other__'){pickAll=true;draw();return;}save({control:v});}
    else if(f==='profile')save({profile:v});
    else if(f==='stop_option'||f==='start_option'){const k=data?.command?.kind==='button'?(f==='stop_option'?'control':'start_button'):f;save({[k]:v});}
    else if(f==='power')save({power:v});
    else if(f==='energy')save({energy:v});
  });
  host.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.classList.contains('cl-tbtn')){runTest();return;}
    if(b.classList.contains('cl-act')){saving=true;draw();try{const result=await panel.request('charger_limit_resume',{},owner);data={...data,...result};panel.status?.(T('Saved'),'success');}catch(error){panel.status?.(error.message||String(error),'error');}finally{saving=false;draw();load();}return;}
    const f=b.parentElement?.dataset?.f;if(!f)return;
    if(f==='target'){setTarget(Number(b.dataset.v));return;}
    if(f==='on_stops')save({on_stops:b.dataset.v==='true'});else if(f==='mode')save({mode:b.dataset.v});
  });
  await load();
  if(!dead)timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);
  if(!dead)liveTimer=setInterval(()=>{if(!document.hidden)paintValues();},5000);
  return {busy:false,dirty:false,flush:async()=>{},refresh:load,destroy(){dead=true;clearInterval(timer);clearInterval(liveTimer);clearTimeout(testTimer);host.remove();}};
}
