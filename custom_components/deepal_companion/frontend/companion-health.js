/* Health page: a read-only list of checks. It never changes settings, charging data or notifications. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REFRESH_MS=30000;
const styles=`
.health{display:grid;gap:12px}

.health-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;color:rgb(var(--health-color));background:rgba(var(--health-color),.14)}
.health-chip ha-icon{--mdc-icon-size:18px}
.health-ok{--health-color:52,211,153}.health-warning{--health-color:var(--ds-warn,250,204,21)}.health-error{--health-color:248,113,113}
.health-meta{font-size:12px;color:var(--secondary-text-color)}
.health-verdict{display:flex;align-items:center;gap:14px;padding:14px;border-radius:18px;border:1px solid rgba(var(--health-color),.35);background:rgba(var(--health-color),.09)}
.health-verdict>div{min-width:0}.health-verdict .health-chip{padding:0;background:none;font-size:19px;gap:8px}.health-verdict .health-chip ha-icon{--mdc-icon-size:26px}.health-verdict .health-meta{margin:3px 0 0}
.health-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.health-tile{min-width:0;padding:10px 12px;border-radius:14px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg)}
.health-tile span{display:block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--secondary-text-color)}.health-tile b{display:block;margin-top:2px;font-size:17px;overflow-wrap:anywhere}
.health-sec{grid-column:1/-1;margin:6px 2px 0;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--secondary-text-color)}.health-sec em{font-style:normal;margin-left:6px;color:var(--primary-text-color)}
.health-row.health-compact{grid-template-columns:24px minmax(0,1fr) auto;align-items:center;padding:8px 12px;border-left-width:1px}.health-compact ha-icon{--mdc-icon-size:20px}.health-compact p{display:none}.health-okchip{padding:2px 9px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.04em;color:rgb(var(--health-color));background:rgba(var(--health-color),.14)}
.health-compact.health-click{grid-template-columns:24px minmax(0,1fr) auto 24px}
.health-actions{display:flex;gap:10px}.health-actions button{flex:1;min-height:44px;border-radius:14px;border:1px solid var(--cp-off-line);background:transparent;color:var(--primary-text-color);font:inherit;font-weight:600;cursor:pointer}
.health-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.health-row{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;align-items:start;padding:var(--cp-item-p);border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);background:var(--cp-off-bg);border-left:3px solid rgb(var(--health-color))}
.health-row ha-icon{--mdc-icon-size:22px;color:rgb(var(--health-color))}
.health-row strong{display:block;font-size:13px}.health-row p{margin:3px 0 0;font-size:12px;line-height:1.5;color:var(--secondary-text-color);overflow-wrap:anywhere}
.health-row .health-fix{color:var(--primary-text-color)}
.health-click{cursor:pointer;grid-template-columns:32px minmax(0,1fr) 24px}
.health-click:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.health-click .health-chev{--mdc-icon-size:20px;color:var(--secondary-text-color);transition:transform .15s}
.health-click[aria-expanded=true] .health-chev{transform:rotate(180deg)}
.health-plan{grid-column:1/-1;display:grid;gap:10px;padding:12px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color)}
.health-plan-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.health-plan-head h3{margin:0;font-size:14px;flex:1;min-width:140px}
.health-plan-head button{min-height:36px}
.health-plan-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.health-plan-facts div{padding:8px 10px;border-radius:10px;background:var(--secondary-background-color)}
.health-plan-facts span{display:block;font-size:11px;color:var(--secondary-text-color)}
.health-plan-facts b{display:block;font-size:13px;overflow-wrap:anywhere}
.health-plan h4{margin:2px 0 0;font-size:12px;color:var(--secondary-text-color);font-weight:600}
.health-plan table{width:100%;border-collapse:collapse;font-size:12px}
.health-plan th,.health-plan td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--divider-color);white-space:normal;overflow-wrap:anywhere}
.health-plan,.health-plan>*{min-width:0}
.health-plan th{font-weight:600;color:var(--secondary-text-color)}
.health-log{display:grid;align-content:start;gap:0;font-size:12px;font-family:var(--code-font-family,monospace);max-height:320px;overflow-y:auto;overscroll-behavior:contain;padding:0 8px;border:1px solid var(--divider-color);border-radius:10px}
.health-log:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.health-log div:last-child{border-bottom:0}
.health-plan .health-meta:empty{display:none}
.health-log time{white-space:nowrap}
.health-log div{display:grid;grid-template-columns:auto 34px minmax(0,1fr);gap:8px;padding:4px 0;border-bottom:1px solid var(--divider-color);line-height:1.45}
.health-log time,.health-log em{color:var(--secondary-text-color);font-style:normal}
.health-log span{overflow-wrap:anywhere}.health-log .chip{display:inline-block;font-style:normal;padding:0 6px;margin:1px 2px 1px 0;border:1px solid var(--divider-color);border-radius:999px;color:var(--secondary-text-color)}.health-table-scroll{overflow-x:auto}.health-plan table{min-width:440px}.health-plan th{white-space:nowrap}
.health-log .bad{color:rgb(var(--health-color,248,113,113))}
.health-okcard{grid-column:1/-1;box-sizing:border-box;padding:0 12px;border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);background:var(--cp-off-bg)}
.health-okcard-btn{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 0;border:0;background:none;color:var(--primary-text-color);font:inherit;font-size:13px;font-weight:600;text-align:left;cursor:pointer}
.health-okcard-btn:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.health-okcard-btn>ha-icon:first-child{--mdc-icon-size:22px;color:rgb(var(--ds-ok,52,211,153));flex:none}
.health-okcard-btn>span{flex:1;min-width:0}
.health-okcard-btn .health-chev{display:block;--mdc-icon-size:20px;flex:none;color:var(--secondary-text-color);transition:transform .15s}
.health-okcard-btn[aria-expanded=true] .health-chev{transform:rotate(180deg)}
.health-okcard-list{display:grid;gap:6px;padding:0 0 12px}
.health-okcard-list[hidden]{display:none}
.health-okcard-list .health-row.health-compact{padding:6px 0;border:0;border-radius:0;background:none}
@media(max-width:760px){.health-list{grid-template-columns:minmax(0,1fr)}}
`;
const ICON={ok:'mdi:check-circle-outline',warning:'mdi:alert-outline',error:'mdi:alert-circle-outline'};
const TITLES={
  sensor_batt:'Battery level',sensor_ac:'AC charge current',
  sensor_dc:'DC charge current',sensor_odo:'Odometer',
  sensor_pow:'Power status',sensor_fuel:'Fuel level',
  sensor_charging:'Charging',sensor_plug:'Charger plugged',
  sensor_volume:'Fuel volume',sensor_cloud:'Cloud connection',
  archive:'Charging recorder',schema:'Database',
  wal:'Database journal',notifications:'Notifications',
  recipients:'Notification devices',delivery:'Last notification',
  pricing:'Charging prices',sensors:'Sensors',recorder:'Recorder',storage:'Storage',plan:'Charge plan',preconditioning:'Preconditioning'
};
const short=id=>String(id||'').slice(-6);
const clock=(sec,hass)=>{const f=window.__DEEPAL_COMPANION_UI.format(hass),ms=sec*1000,same=f.date(ms)===f.date(Date.now()),time=f.hm(ms,true);return same?time:f.dm(ms)+' '+time;};
const span=(start,end)=>(start||'?')+'-'+(end||'full');
const planText=p=>short(p.id)+(p.active?' on ':' off ')+span(p.start,p.end);
function describe(row){
  switch(row.event){
    case 'state':return String(row.entity||'?').split('.').pop()+': '+(row.old??'?')+' > '+(row.new??'?');
    case 'service':return row.service+' '+JSON.stringify(row.data||{});
    case 'plan_added':case 'plan_changed':case 'plan_removed':return 'Car plan '+row.event.slice(5)+': '+short(row.plan_id)+' '+span(row.start,row.end)+(row.active?' (on)':' (off)');
    default:return row.event;
  }
}
export async function mountHealth(panel,stage){
  const t=(...args)=>panel.t(...args);
  const host=document.createElement('div');host.className='health';
  host.innerHTML='<style>'+styles+'</style><div class="health-verdict"><div><span class="health-chip"></span><p class="health-meta" role="status"></p></div></div><div class="health-tiles"></div><div class="health-list"></div><div class="health-actions"><button type="button" class="health-copy"></button></div>';
  stage.append(host);
  const q=selector=>host.querySelector(selector);
  let dead=false,busy=false,again=false,timer=null,soon=null,unsub=null,owner={...panel.selected};
  let planOpen=false,passOpen=false,planView=null,planBusy=false,planNote='',copied=false,copyTimer=null;
  let lastResult=null;
  function draw(result){
    lastResult=result;panel.setHealthResult?.(result);
    const focused=host.getRootNode().activeElement,focusClass=['health-click','health-okcard-btn'].find(c=>focused?.classList?.contains(c)&&host.contains(focused));
    const word={ok:t('All good'),warning:t('Needs attention'),error:t('Problem found')};
    const chip=q('.health-chip');chip.className='health-chip health-'+result.status;chip.innerHTML='<ha-icon icon="'+ICON[result.status]+'" aria-hidden="true"></ha-icon>'+escape(word[result.status]);
    const c=result.counts||{};
    q('.health-meta').textContent=(c.error||0)+' '+t('problems')+', '+(c.warning||0)+' '+t('warnings');q('.health-verdict').className='health-verdict health-'+result.status;
    const total=result.checks.length,passing=result.checks.filter(x=>x.status==='ok').length,tiles=q('.health-tiles');tiles.replaceChildren();
    for(const [label,value] of [[t('Integration'),'v'+result.version],[t('Checks'),passing+'/'+total],[t('Last check'),window.__DEEPAL_COMPANION_UI.format(panel._hass).hm(result.checked*1000)]]){const tile=document.createElement('div');tile.className='health-tile';const l=document.createElement('span'),v=document.createElement('b');l.textContent=label;v.textContent=value;tile.append(l,v);tiles.append(tile);}
    q('.health-copy').textContent=copied?t('Copied'):t('Copy diagnostics');
    const list=q('.health-list'),logTop=list.querySelector('.health-log')?.scrollTop||0;list.replaceChildren();
    /* Passing checks fold into one closed card at the bottom; anything not passing, and the charge plan row, stay visible. */
    const rank={error:0,warning:1,ok:2};
    const sorted=[...result.checks].sort((a,b)=>(rank[a.status]??1)-(rank[b.status]??1));
    const passed=sorted.filter(x=>x.status==='ok'&&x.id!=='plan'),rest=sorted.filter(x=>!passed.includes(x));
    const needs=rest.filter(x=>x.status!=='ok').length;
    if(needs){const h=document.createElement('h4');h.className='health-sec';h.textContent=t('Needs attention');const n=document.createElement('em');n.textContent=needs;h.append(n);list.append(h);}
    for(const check of rest){
      const row=checkRow(check);
      if(check.id==='plan'){
        row.classList.add('health-click');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-expanded',planOpen?'true':'false');
        const chev=document.createElement('ha-icon');chev.className='health-chev';chev.setAttribute('icon','mdi:chevron-down');chev.setAttribute('aria-hidden','true');row.append(chev);
        const toggle=()=>{planOpen=!planOpen;draw(result);if(planOpen)loadPlan();};
        row.onclick=toggle;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
        list.append(row);
        if(planOpen)list.append(planBox());
      }else list.append(row);
    }
    if(passed.length)list.append(passedCard(passed));
    if(logTop){const log=list.querySelector('.health-log');if(log)log.scrollTop=logTop;}
    if(focusClass)list.querySelector('.'+focusClass)?.focus({preventScroll:true});
  }
  function checkRow(check){
    const row=document.createElement('article');row.className='health-row health-'+check.status+(check.status==='ok'?' health-compact':'');
    const icon=document.createElement('ha-icon');icon.setAttribute('icon',ICON[check.status]||ICON.warning);icon.setAttribute('aria-hidden','true');
    const body=document.createElement('div'),title=document.createElement('strong');
    const names=TITLES[check.id];title.textContent=names?t(names):check.title;body.append(title);
    if(check.detail){const p=document.createElement('p');p.textContent=check.detail_key?t(check.detail_key,...(check.args||[]).map(a=>a==='unavailable'||a==='unknown'?t(a):a)):t(check.detail);body.append(p);}
    if(check.fix&&check.status!=='ok'){const p=document.createElement('p');p.className='health-fix';p.textContent=t(check.fix);body.append(p);}
    row.append(icon,body);
    if(check.status==='ok'){const okc=document.createElement('span');okc.className='health-okchip';okc.textContent=t('OK');row.append(okc);}
    return row;
  }
  /* One closed dropdown for every passing check: "N checks passed", chevron, compact rows when open. */
  function passedCard(passed){
    const card=document.createElement('section');card.className='health-okcard';
    const btn=document.createElement('button');btn.type='button';btn.className='health-okcard-btn';btn.setAttribute('aria-expanded',passOpen?'true':'false');btn.setAttribute('aria-controls','health-passed-list');
    const okIcon=document.createElement('ha-icon');okIcon.setAttribute('icon',ICON.ok);okIcon.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=passed.length===1?t('1 check passed'):t('{0} checks passed',passed.length);
    const chev=document.createElement('ha-icon');chev.className='health-chev';chev.setAttribute('icon','mdi:chevron-down');chev.setAttribute('aria-hidden','true');
    btn.append(okIcon,label,chev);
    const box=document.createElement('div');box.className='health-okcard-list';box.id='health-passed-list';box.hidden=!passOpen;
    for(const check of passed)box.append(checkRow(check));
    btn.onclick=()=>{passOpen=!passOpen;draw(lastResult);};
    card.append(btn,box);return card;
  }
  function diagnosticsText(){
    const r=lastResult;if(!r)return '';
    return ['Deepal Companion v'+r.version+' - '+r.status+' - '+new Date(r.checked*1000).toISOString(),...r.checks.map(c=>'['+c.status+'] '+(TITLES[c.id]||c.title)+(c.detail?' - '+c.detail:''))].join('\n');
  }
  async function copyDiagnostics(){
    const text=diagnosticsText();if(!text)return;
    try{await navigator.clipboard.writeText(text);}catch(_){
      const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;opacity:0';host.append(area);area.select();try{document.execCommand('copy');}catch(__){}area.remove();
    }
    copied=true;clearTimeout(copyTimer);copyTimer=setTimeout(()=>{copied=false;if(!dead&&lastResult)draw(lastResult);},2000);if(lastResult)draw(lastResult);
  }
  q('.health-copy').onclick=copyDiagnostics;
  function planBox(){
    const box=document.createElement('section');box.className='health-plan';
    const head=document.createElement('div');head.className='health-plan-head';
    const h=document.createElement('h3');h.textContent=t('Charge plan details');
    head.append(h);box.append(head);
    const note=document.createElement('p');note.className='health-meta';note.setAttribute('role','status');note.textContent=planNote;box.append(note);
    if(!planView){const p=document.createElement('p');p.className='health-meta';p.textContent=t('Loading...');box.append(p);return box;}
    if(!planView.available){const p=document.createElement('p');p.className='health-meta';p.textContent=t('This vehicle has no charge plan.');box.append(p);return box;}
    if(planView.pending){const p=document.createElement('p');p.className='health-meta';p.textContent=t("Waiting for the car's plan list. Showing what Home Assistant has.");box.append(p);}
    const facts=document.createElement('div');facts.className='health-plan-facts';
    const shown=planView.pending&&planView.times?.start&&planView.times?.end&&planView.switch?{start:planView.times.start,end:planView.times.end,active:planView.switch==='on'}:(planView.plans||[]).find(p=>p.id===planView.shown);
    for(const [label,value] of [[t('Plan the app shows'),shown?shown.start+' - '+(shown.end||t('until full'))+' ('+(shown.active?t('on'):t('off'))+')':t('None')],[t('Active plans'),String((planView.active||[]).length)],[t('Switch in Home Assistant'),planView.switch==='on'?t('on'):planView.switch==='off'?t('off'):t('unknown')]]){
      const cell=document.createElement('div'),a=document.createElement('span'),b=document.createElement('b');a.textContent=label;b.textContent=value;cell.append(a,b);facts.append(cell);
    }
    box.append(facts);
    const plansTitle=document.createElement('h4');plansTitle.textContent=t('Plans reported by the car');box.append(plansTitle);
    const table=document.createElement('table'),scroll=document.createElement('div');scroll.className='table-scroll health-table-scroll';
    const headRow=table.createTHead().insertRow();for(const label of [t('Plan ID'),t('State'),t('Start'),t('End')]){const th=document.createElement('th');th.textContent=label;headRow.append(th);}
    const body=table.createTBody();
    for(const plan of planView.plans||[]){
      const tr=body.insertRow();
      /* The car and the app follow only the first entry; id 1 is a plan saved in the app or on the car and is not unique. */
      const first=plan.followed??(plan===(planView.plans||[])[0]);
      const who=plan.source==='app_or_car'||plan.id==='1'?t('app or car'):'HA';
      const id=plan.id+' ('+who+', '+(first?t('followed by the car'):t('older record'))+')';
      for(const value of [id,plan.active?t('on'):t('off'),plan.start,plan.end||t('until full')])tr.insertCell().textContent=value;
    }
    if(!(planView.plans||[]).length){const tr=body.insertRow(),td=tr.insertCell();td.colSpan=4;td.textContent=t('None');}
    scroll.append(table);box.append(scroll);
    const logTitle=document.createElement('h4');logTitle.textContent=t('Plan activity, last 7 days');box.append(logTitle);
    const log=document.createElement('div');log.className='health-log';log.tabIndex=0;log.setAttribute('role','log');log.setAttribute('aria-label',t('Plan activity, last 7 days'));
    const rows=planView.log||[];
    for(const row of rows){
      const line=document.createElement('div'),when=document.createElement('time'),from=document.createElement('em'),text=document.createElement('span');
      when.textContent=clock(row.time,panel._hass);from.textContent=row.source==='deepal'?'car':'HA';if(row.event==='service'){const name=document.createElement('b');name.textContent=row.service;text.append(name);for(const [key,value] of Object.entries(row.data||{})){const chip=document.createElement('i');chip.className='chip';chip.textContent=key+': '+(value&&typeof value==='object'?JSON.stringify(value):String(value));text.append(' ',chip);}}else text.textContent=describe(row);
      line.append(when,from,text);log.append(line);
    }
    if(!rows.length){const p=document.createElement('p');p.className='cp-empty';p.textContent=t('No plan activity in the last 7 days.');log.append(p);}
    box.append(log);
    return box;
  }
  async function loadPlan(){
    if(dead||planBusy)return;planBusy=true;
    try{
      planView=await panel.request('plan_debug_get',{},owner);planNote='';
    }catch(error){if(!dead)planNote=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.'):(window.__DEEPAL_COMPANION_UI.tError(error.message)||String(error));}
    finally{planBusy=false;if(!dead&&lastResult)draw(lastResult);}
  }
  async function load(){
    if(dead)return;if(busy){again=true;return;}busy=true;
    try{
      const result=await panel.request('health_get',{},owner);
      if(!dead){draw(result);if(planOpen)loadPlan();}
    }catch(error){if(!dead)q('.health-meta').textContent=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.'):(window.__DEEPAL_COMPANION_UI.tError(error.message)||String(error));}
    finally{busy=false;if(!dead&&again){again=false;schedule();}}
  }
  function schedule(){clearTimeout(soon);soon=setTimeout(load,300);}
  try{
    const stop=await panel._hass.connection.subscribeMessage(message=>{if(!message.vehicle_id||message.vehicle_id===owner.vehicle_id)schedule();},{type:'deepal_companion/subscribe_plan'});
    if(dead)stop();else unsub=stop;
  }catch(_){/* older backend: the 30 second check still keeps the page current */}
  await load();
  if(!dead)timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);
  return {busy:false,dirty:false,flush:async()=>{},destroy(){dead=true;clearInterval(timer);clearTimeout(soon);clearTimeout(copyTimer);try{unsub?.();}catch(_){}unsub=null;host.remove();}};
}
