/* Health page: a read-only list of checks. It never changes settings, charging data or notifications. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REFRESH_MS=30000;
const styles=`
.health,.health.box{display:grid;gap:12px}

.health-summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.health-summary h2{margin:0;font-size:16px;flex:1;min-width:160px}
.health-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;color:rgb(var(--health-color));background:rgba(var(--health-color),.14)}
.health-chip ha-icon{--mdc-icon-size:18px}
.health-ok{--health-color:52,211,153}.health-warning{--health-color:var(--ds-warn,250,204,21)}.health-error{--health-color:248,113,113}
.health-meta{font-size:12px;color:var(--secondary-text-color)}
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
.health-plan th,.health-plan td{text-align:left;padding:5px 6px;border-bottom:1px solid var(--divider-color);overflow-wrap:anywhere}
.health-plan th{font-weight:600;color:var(--secondary-text-color)}
.health-log{display:grid;align-content:start;gap:0;font-size:12px;font-family:var(--code-font-family,monospace);max-height:320px;overflow-y:auto;overscroll-behavior:contain;padding:0 8px;border:1px solid var(--divider-color);border-radius:10px}
.health-log:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.health-log div:last-child{border-bottom:0}
.health-plan .health-meta:empty{display:none}
.health-log time{white-space:nowrap}
.health-log div{display:grid;grid-template-columns:auto 34px minmax(0,1fr);gap:8px;padding:4px 0;border-bottom:1px solid var(--divider-color);line-height:1.45}
.health-log time,.health-log em{color:var(--secondary-text-color);font-style:normal}
.health-log span{overflow-wrap:anywhere}
.health-log .bad{color:rgb(var(--health-color,248,113,113))}
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
  pricing:'Charging prices',sensors:'Sensors',recorder:'Recorder',storage:'Storage',plan:'Charge plan'
};
const short=id=>String(id||'').slice(-6);
const clock=(sec,lang)=>{const d=new Date(sec*1000),time=d.toLocaleTimeString(lang||undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});return d.toDateString()===new Date().toDateString()?time:d.toLocaleDateString(lang||undefined,{day:'numeric',month:'short'})+' '+time;};
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
  const host=document.createElement('section');host.className='box health';
  host.innerHTML='<style>'+styles+'</style><div class="health-summary"><h2></h2><span class="health-chip"></span></div><p class="health-meta" role="status"></p><div class="health-list"></div>';
  stage.append(host);
  const q=selector=>host.querySelector(selector);
  let dead=false,busy=false,again=false,timer=null,soon=null,unsub=null,owner={...panel.selected};
  let planOpen=false,planView=null,planBusy=false,planNote='';
  q('h2').textContent=t('Health & Diagnostics');
  let lastResult=null;
  function draw(result){
    lastResult=result;panel.setHealthResult?.(result);
    const focused=host.getRootNode().activeElement,hadFocus=!!focused&&focused.classList?.contains('health-click')&&host.contains(focused);
    const word={ok:t('All good'),warning:t('Needs attention'),error:t('Problem found')};
    const chip=q('.health-chip');chip.className='health-chip health-'+result.status;chip.innerHTML='<ha-icon icon="'+ICON[result.status]+'" aria-hidden="true"></ha-icon>'+escape(word[result.status]);
    const c=result.counts||{};
    q('.health-meta').textContent=t('Checked ')+window.__DEEPAL_COMPANION_UI.format(panel._hass).hm(result.checked*1000)+' · '+(c.error||0)+' '+t('problems')+', '+(c.warning||0)+' '+t('warnings')+' · v'+escape(result.version);
    const list=q('.health-list'),logTop=list.querySelector('.health-log')?.scrollTop||0;list.replaceChildren();
    for(const check of [...result.checks].sort((a,b)=>({error:0,warning:1,ok:2}[a.status]-{error:0,warning:1,ok:2}[b.status]))){
      const row=document.createElement('article');row.className='health-row health-'+check.status;
      const icon=document.createElement('ha-icon');icon.setAttribute('icon',ICON[check.status]||ICON.warning);icon.setAttribute('aria-hidden','true');
      const body=document.createElement('div'),title=document.createElement('strong');
      const names=TITLES[check.id];title.textContent=names?t(names):check.title;body.append(title);
      if(check.detail){const p=document.createElement('p');p.textContent=check.detail_key?t(check.detail_key,...(check.args||[]).map(a=>a==='unavailable'||a==='unknown'?t(a):a)):t(check.detail);body.append(p);}
      if(check.fix&&check.status!=='ok'){const p=document.createElement('p');p.className='health-fix';p.textContent=t(check.fix);body.append(p);}
      row.append(icon,body);
      if(check.id==='plan'){
        row.classList.add('health-click');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-expanded',planOpen?'true':'false');
        const chev=document.createElement('ha-icon');chev.className='health-chev';chev.setAttribute('icon','mdi:chevron-down');chev.setAttribute('aria-hidden','true');row.append(chev);
        const toggle=()=>{planOpen=!planOpen;draw(result);if(planOpen)loadPlan();};
        row.onclick=toggle;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
        list.append(row);
        if(planOpen)list.append(planBox());
      }else list.append(row);
    }
    if(logTop){const log=list.querySelector('.health-log');if(log)log.scrollTop=logTop;}
    if(hadFocus)list.querySelector('.health-click')?.focus({preventScroll:true});
  }
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
    const table=document.createElement('table');
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
    box.append(table);
    const logTitle=document.createElement('h4');logTitle.textContent=t('Plan activity, last 7 days');box.append(logTitle);
    const log=document.createElement('div');log.className='health-log';log.tabIndex=0;log.setAttribute('role','log');log.setAttribute('aria-label',t('Plan activity, last 7 days'));
    const lang=panel._hass?.locale?.language;
    const rows=planView.log||[];
    for(const row of rows){
      const line=document.createElement('div'),when=document.createElement('time'),from=document.createElement('em'),text=document.createElement('span');
      when.textContent=clock(row.time,lang);from.textContent=row.source==='deepal'?'car':'HA';text.textContent=describe(row);
      line.append(when,from,text);log.append(line);
    }
    if(!rows.length){const p=document.createElement('p');p.className='health-meta';p.textContent=t('No plan activity in the last 7 days.');log.append(p);}
    box.append(log);
    return box;
  }
  async function loadPlan(){
    if(dead||planBusy)return;planBusy=true;
    try{
      planView=await panel.request('plan_debug_get',{},owner);planNote='';
    }catch(error){if(!dead)planNote=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.'):(error.message||String(error));}
    finally{planBusy=false;if(!dead&&lastResult)draw(lastResult);}
  }
  async function load(){
    if(dead)return;if(busy){again=true;return;}busy=true;
    try{
      const result=await panel.request('health_get',{},owner);
      if(!dead){draw(result);if(planOpen)loadPlan();}
    }catch(error){if(!dead)q('.health-meta').textContent=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.'):(error.message||String(error));}
    finally{busy=false;if(!dead&&again){again=false;schedule();}}
  }
  function schedule(){clearTimeout(soon);soon=setTimeout(load,300);}
  try{
    const stop=await panel._hass.connection.subscribeMessage(message=>{if(!message.vehicle_id||message.vehicle_id===owner.vehicle_id)schedule();},{type:'deepal_companion/subscribe_plan'});
    if(dead)stop();else unsub=stop;
  }catch(_){/* older backend: the 30 second check still keeps the page current */}
  await load();
  if(!dead)timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);
  return {busy:false,dirty:false,flush:async()=>{},destroy(){dead=true;clearInterval(timer);clearTimeout(soon);try{unsub?.();}catch(_){}unsub=null;host.remove();}};
}
