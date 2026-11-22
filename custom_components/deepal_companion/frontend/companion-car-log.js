/* Car logs page: the car right now, and a timeline of what happened to it in three groups (security, charging, others).
   Read-only: it never changes settings or sends a command. Updates arrive by push; the 30 second check is only a fallback. */
const REFRESH_MS=30000;
const styles=`
.carlog,.carlog.box{display:grid;gap:14px}

.carlog-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.carlog-head h2{margin:0;font-size:16px;flex:1;min-width:140px}
.carlog-meta{font-size:12px;color:var(--ds-fg2)}
.carlog-status{display:grid;gap:12px;padding:var(--cp-item-p);border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);background:var(--cp-off-bg)}
.carlog-status:empty{display:none}
.cs-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.cs-head h3{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ds-fg2)}
.cs-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:13px;font-weight:600;color:rgb(var(--tone));background:rgba(var(--tone),.12);border:1px solid rgba(var(--tone),.4)}
.cs-badge ha-icon{--mdc-icon-size:18px}
.cs-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cs-tile{display:grid;justify-items:center;gap:3px;padding:12px 6px;border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);background:var(--cp-off-bg);text-align:center;min-width:0}
.cs-tile ha-icon{--mdc-icon-size:26px;color:rgb(var(--tone))}
.cs-tile strong{font-size:14px;overflow-wrap:anywhere}
.cs-tile small{font-size:11px;color:var(--ds-fg2);overflow-wrap:anywhere}
.carlog-now{display:grid;gap:8px}
.carlog-now:empty{display:none}
.carlog-alert{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--ds-line);border-left:3px solid rgb(var(--sev));border-radius:12px;background:var(--ds-card)}
.carlog-alert ha-icon{--mdc-icon-size:22px;color:rgb(var(--sev))}
.carlog-alert strong{font-size:13px}
.carlog-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.carlog-tile{display:grid;justify-items:center;gap:3px;padding:10px 2px;border:1px solid var(--ds-line);border-radius:14px;background:var(--ds-card);color:var(--ds-fg);font:inherit;cursor:pointer;min-height:72px;min-width:0}
.carlog-tile ha-icon{--mdc-icon-size:22px;color:rgb(var(--tone))}
.carlog-tile span{font-size:12px;font-weight:600;overflow-wrap:anywhere;text-align:center}
.carlog-tile small{font-size:12px;color:var(--ds-fg2)}
.carlog-tile[aria-pressed=true]{border-color:rgba(var(--tone),.45);background:rgba(var(--tone),.12)}
.carlog-tile:focus-visible,.tl-card:focus-visible,.carlog-chip:focus-visible,.carlog-more:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
.carlog-range{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.carlog-range .carlog-meta{margin-left:auto}
.carlog-chip{padding:6px 16px;border:1px solid var(--cp-off-line);border-radius:999px;background:var(--cp-off-bg);color:var(--ds-fg);font:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:var(--cp-ctl-h);white-space:nowrap}
/* selected chip: source/companion-shared.css */
.carlog-more{justify-self:center;padding:8px 18px;border:1px solid var(--ds-line);border-radius:999px;background:var(--ds-card);color:var(--ds-fg);font:inherit;cursor:pointer;min-height:36px}
.carlog-day{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:28px 0 12px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ds-fg2)}
.carlog-body>.carlog-day:first-child,.carlog-note+.carlog-day{margin-top:6px}
.carlog-day em{font-style:normal;text-transform:none;letter-spacing:0;font-weight:400;color:var(--primary-color)}
.tl-list{position:relative;display:grid;gap:12px}
.tl-list::before{content:"";position:absolute;left:21px;top:8px;bottom:8px;width:2px;background:var(--ds-line)}
.tl-item{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:start}
.tl-node{position:relative;z-index:1;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:rgb(var(--tone));background:var(--ds-card);border:1px solid rgba(var(--tone),.55);box-shadow:inset 0 0 0 40px rgba(var(--tone),.12)}
.tl-node ha-icon{--mdc-icon-size:22px}
.tl-card{display:grid;gap:4px;padding:var(--cp-item-p) 14px;border:1px solid var(--cp-off-line);border-radius:var(--cp-item-r);background:var(--cp-off-bg);color:var(--ds-fg);font:inherit;text-align:left;width:100%;box-sizing:border-box;min-width:0}
button.tl-card{cursor:pointer}
.tl-top{display:flex;align-items:center;gap:8px}
.tl-top time{font-size:13px;color:var(--ds-fg2);font-variant-numeric:tabular-nums;flex:1}
.tl-badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--ds-line);background:var(--ds-soft);color:var(--ds-fg);white-space:nowrap}
.tl-chev{--mdc-icon-size:20px;color:var(--ds-fg2);transition:transform .15s}
button.tl-card[aria-expanded=true] .tl-chev{transform:rotate(180deg)}
.tl-card strong{font-size:15px;overflow-wrap:anywhere}
.tl-card p{margin:0;font-size:12.5px;line-height:1.45;color:var(--ds-fg2);overflow-wrap:anywhere}
.tl-item.important .tl-card{border-left:3px solid rgb(var(--ds-warn))}
.tl-item.critical .tl-card{border-left:3px solid rgb(var(--ds-bad))}
.tl-steps{list-style:none;margin:12px 0 2px;padding:2px 2px 0;display:grid}
.tl-steps[hidden]{display:none}
.tl-steps li{display:grid;grid-template-columns:62px 16px minmax(0,1fr);column-gap:10px;padding:6px 0;font-size:13px;color:var(--ds-fg)}
.tl-steps time{font-size:12px;color:var(--ds-fg2);font-variant-numeric:tabular-nums;white-space:nowrap;padding-top:2px}
.tl-dot{position:relative;display:block}
.tl-dot::before{content:"";position:absolute;left:3px;top:5px;width:6px;height:6px;border-radius:50%;background:var(--ds-card);border:2px solid rgb(var(--tone,var(--ds-info)))}
.tl-dot::after{content:"";position:absolute;left:50%;top:17px;bottom:-17px;width:2px;margin-left:-1px;border-radius:1px;background:var(--ds-line)}
.tl-steps li:last-child .tl-dot::after{display:none}
.tl-steps li:first-child .tl-dot::before{background:rgb(var(--tone,var(--ds-info)))}
.tl-steps small{display:block;font-size:11.5px;color:var(--ds-fg2);margin-top:1px}
.carlog-note{display:grid;gap:4px;padding:10px 12px;border:1px solid var(--ds-line);border-left:3px solid rgb(var(--ds-info));border-radius:12px;background:var(--ds-soft);font-size:12px;line-height:1.45;color:var(--ds-fg2)}
.carlog-note strong{font-size:13px;color:var(--ds-fg)}
.carlog-empty{padding:24px 12px;text-align:center;border:1px dashed var(--ds-line);border-radius:12px;color:var(--ds-fg2);font-size:13px}
@media(max-width:380px){.cs-tiles{gap:6px}.carlog-tiles{gap:6px}.tl-item{grid-template-columns:36px minmax(0,1fr);gap:8px}.tl-node{width:36px;height:36px}.tl-list::before{left:17px}}
`;
const TONES={security:'var(--ds-info)',charging:'var(--ds-ok)',others:'var(--ds-warn)',all:'var(--ds-ac,var(--ds-ok))'};
const CATS=[['all','mdi:pulse','All'],['security','mdi:shield-lock-outline','Security'],['charging','mdi:ev-station','Charging'],['others','mdi:alert-outline','Others']];
const ABOUT={security:'Locking and unlocking, doors, trunk, hood and windows, and a warning when the car is left unlocked.',charging:'Cable connected or disconnected, and each charge with its start and end level and duration.',others:'Warning lights, key battery, tyre alarms, lost connection or data, and preconditioning.'};
const SEVC={info:'var(--ds-info)',important:'var(--ds-warn)',critical:'var(--ds-bad)'};
const RANK={info:0,important:1,critical:2};
export async function mountCarLog(panel,stage){
  const t=(...args)=>panel.t(...args);
  const host=document.createElement('section');host.className='box carlog';
  host.innerHTML='<style>'+styles+'</style><div class="carlog-head"><h2></h2><span class="carlog-meta"></span></div><div class="carlog-status"></div><div class="carlog-now" role="status"></div><div class="carlog-tiles"></div><div class="carlog-range" role="group"></div><div class="carlog-body"></div>';
  stage.append(host);
  const q=selector=>host.querySelector(selector);
  let dead=false,busy=false,again=false,timer=null,soon=null,unsub=null,data=null,filter=null,failure='',range='30',all=[],fresh=true;
  const owner={...panel.selected},open=new Set();
  const F=()=>window.__DEEPAL_COMPANION_UI.format(panel._hass);
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
  const icon=(name,cls)=>{const i=document.createElement('ha-icon');i.setAttribute('icon',name);i.setAttribute('aria-hidden','true');if(cls)i.className=cls;return i;};
  q('h2').textContent=t('Car logs');
  const title=row=>{const m=/^(.*) (opened|closed|cleared)$/.exec(row.title);return m&&row.kind!=='precondition'?t('{0} '+m[2],t(m[1])):t(row.title);};
  const levelText=(a,b)=>(a!=null&&b!=null?Math.round(a)+'% → '+Math.round(b)+'%':b!=null?Math.round(b)+'%':a!=null?Math.round(a)+'%':'');
  const span=minutes=>minutes>=60?t('{0} h {1} min',Math.floor(minutes/60),minutes%60):t('{0} min',minutes);
  const tone=row=>row.sev==='critical'?'var(--ds-bad)':row.sev==='important'?'var(--ds-warn)':(TONES[row.cat]||TONES.security);
  const worst=rows=>rows.reduce((m,r)=>RANK[r.sev]>RANK[m]?r.sev:m,'info');
  function detail(row){
    const d=row.detail||{},f=F(),parts=[];
    if(row.kind==='charging_start')parts.push(levelText(null,d.level));
    else if(row.kind==='charging_end'){parts.push(levelText(d.start_level,d.level));if(d.minutes!=null)parts.push(span(d.minutes));}
    else if(row.kind==='locked'&&d.minutes!=null)parts.push(t('after {0} min',d.minutes));
    else if(row.kind==='left_unlocked'&&d.since)parts.push(t('Unlocked since {0}',f.hm(d.since*1000)));
    else if(row.kind==='precondition'){
      if(d.minutes!=null)parts.push(span(d.minutes));
      if(d.temperature!=null)parts.push(d.temperature+' °C');
      if(d.error)parts.push(String(d.error));
    }
    if(row.origin==='derived')parts.push(t('Worked out by Companion'));
    if(row.late)parts.push(t('Noticed after the connection returned'));
    return parts.filter(Boolean).join(' · ');
  }
  const stamp=row=>(row.poll?'≈ ':'')+F().hm(row.time*1000);
  const pollHint=row=>row.poll?t('The car reports about every {0} min, so this time can be a little late.',Math.max(1,Math.round(row.poll/60))):'';
  /* --- current status card --- */
  function drawStatus(){
    const box=q('.carlog-status');box.replaceChildren();
    const s=data.status;if(!s||(s.locked==null&&!s.doors_total&&!s.windows_total&&s.battery==null))return;
    const calm=s.locked===true&&!s.doors_open&&!s.windows_open&&!s.trunk_open&&!s.hood_open;
    const head=el('div','cs-head');head.append(el('h3',null,t('Current status')));
    if(s.locked!=null){
      const badge=el('span','cs-badge');badge.style.setProperty('--tone',calm?'var(--ds-ok)':'var(--ds-warn)');
      badge.append(icon(calm?'mdi:shield-check-outline':'mdi:shield-alert-outline'),document.createTextNode(calm?t('Secured'):t('Not secured')));head.append(badge);
    }
    const tiles=el('div','cs-tiles');
    const tile=(ic,tn,main,sub)=>{const d=el('div','cs-tile');d.style.setProperty('--tone',tn);d.append(icon(ic),el('strong',null,main),el('small',null,sub));tiles.append(d);};
    if(s.locked!=null||s.doors_total){
      const open=s.doors_open||0,extra=[s.trunk_open?t('Trunk open'):'',s.hood_open?t('Hood open'):''].filter(Boolean);
      tile(s.locked===false?'mdi:lock-open-variant-outline':'mdi:lock-outline',s.locked===false?'var(--ds-warn)':'var(--ds-info)',s.locked==null?t('Unknown'):s.locked?t('Locked'):t('Unlocked'),
        open?t('{0} doors open',open):extra.length?extra.join(' · '):s.doors_total?t('All doors closed'):'');
    }
    if(s.windows_total){
      const open=s.windows_open||0;
      tile('mdi:window-closed-variant',open?'var(--ds-warn)':'var(--ds-info)',open?t('{0} open',open):t('Closed'),t('{0}/{1} windows closed',s.windows_total-open,s.windows_total));
    }
    if(s.battery!=null)tile(s.charging?'mdi:battery-charging':'mdi:battery-high','var(--ds-ok)',Math.round(s.battery)+'%',s.charging?t('Charging'):(s.range!=null?'~'+Math.round(s.range)+' '+(s.range_unit||'km'):''));
    box.append(head,tiles);
  }
  /* --- timeline rows --- */
  function singleItem(row){
    const item=el('div','tl-item '+(row.sev||'info'));
    const n=el('span','tl-node');n.style.setProperty('--tone',tone(row));n.append(icon(row.icon||'mdi:information-outline'));
    const card=el('article','tl-card'),top=el('div','tl-top'),time=el('time',null,stamp(row)),hint=pollHint(row);
    if(hint)time.title=hint;time.dateTime=new Date(row.time*1000).toISOString();top.append(time);
    card.append(top,el('strong',null,title(row)));
    const sub=detail(row);if(sub)card.append(el('p',null,sub));
    item.append(n,card);return item;
  }
  function stepList(rows,session){
    const list=el('ul','tl-steps');list.hidden=!open.has(session);
    for(const r of [...rows].sort((a,b)=>b.time-a.time)){
      const li=document.createElement('li'),body=el('span',null,title(r)),sub=detail(r),dot=el('span','tl-dot');
      li.style.setProperty('--tone',tone(r));dot.setAttribute('aria-hidden','true');
      if(sub)body.append(el('small',null,sub));
      li.append(el('time',null,(r.poll?'≈ ':'')+F().hm(r.time*1000,true)),dot,body);list.append(li);
    }
    return list;
  }
  function parkSummary(rows){
    const n=kind=>rows.filter(r=>r.kind===kind).length,parts=[];
    const add=(count,key)=>{if(count)parts.push(t(key,count));};
    add(n('door_closed'),'Doors closed: {0}');add(n('door_open'),'Doors opened: {0}');add(n('window_closed'),'Windows closed: {0}');add(n('window_open'),'Windows opened: {0}');
    for(const k of ['trunk_open','trunk_closed','hood_open','hood_closed']){const r=rows.find(x=>x.kind===k);if(r)parts.push(title(r));}
    const last=[...rows].sort((a,b)=>b.time-a.time).find(r=>r.kind==='locked'||r.kind==='unlocked');
    if(last)parts.push(last.kind==='locked'?t('Doors locked'):t('Doors unlocked'));
    return parts.join(' · ');
  }
  function groupItem(session,rows){
    const asc=[...rows].sort((a,b)=>a.time-b.time),first=asc[0],last=asc[asc.length-1],f=F();
    const isCharge=rows.some(r=>r.kind==='charging_start'||r.kind==='charging_end'),isPre=rows.some(r=>r.kind==='precondition');
    const end=isCharge?asc.find(r=>r.kind==='charging_end'):isPre?asc.find(r=>!/ on$/.test(r.title)):null;
    const cat=isCharge?'charging':isPre?'others':'security',sev=worst(rows),d=end?.detail||{};
    let head,sub,badge,when;
    if(isCharge){
      const startLevel=d.start_level??asc.find(r=>r.kind==='charging_start')?.detail?.level;
      head=end?(d.level!=null?t('Charging ended at {0}%',Math.round(d.level)):t('Charging ended')):t('Charging');
      sub=end?[d.kwh?t('+{0} kWh',d.kwh):'',levelText(startLevel,d.level)].filter(Boolean).join(' · '):[levelText(null,first.detail?.level),t('in progress')].filter(Boolean).join(' · ');
      badge=end&&d.minutes!=null?span(d.minutes):'';
      when=end?f.hm(first.time*1000)+'–'+f.hm(last.time*1000):f.hm(first.time*1000);
    }else if(isPre){
      head=t('Preconditioning');
      sub=end?[end.detail?.temperature!=null?end.detail.temperature+' °C':'',title(end)].filter(Boolean).join(' · '):t('in progress');
      badge=end&&d.minutes!=null?span(d.minutes):'';
      when=end?f.hm(first.time*1000)+'–'+f.hm(last.time*1000):f.hm(first.time*1000);
    }else{
      const lockRow=[...rows].sort((a,b)=>b.time-a.time).find(r=>r.kind==='locked'||r.kind==='unlocked');
      head=lockRow?.kind==='locked'?t('Parked & secured'):rows.some(r=>r.kind==='unlocked')?t('Unlocked & opened'):t('Doors and windows');
      sub=parkSummary(rows);badge=t('{0} actions',rows.length);when=f.hm(last.time*1000);
    }
    const item=el('div','tl-item '+sev);
    const n=el('span','tl-node');n.style.setProperty('--tone',tone({sev,cat}));n.append(icon(isCharge?'mdi:ev-station':isPre?'mdi:fan':(lockRow=>lockRow?.kind==='locked'?'mdi:lock-outline':'mdi:car-door')([...rows].sort((a,b)=>b.time-a.time).find(r=>r.kind==='locked'||r.kind==='unlocked'))));
    const card=el('button','tl-card');card.type='button';card.setAttribute('aria-expanded',open.has(session)?'true':'false');
    const top=el('div','tl-top');top.append(el('time',null,when));if(badge)top.append(el('span','tl-badge',badge));top.append(icon('mdi:chevron-down','tl-chev'));
    card.append(top,el('strong',null,head));if(sub)card.append(el('p',null,sub));
    const steps=stepList(rows,session);card.append(steps);
    card.onclick=()=>{const on=!open.has(session);on?open.add(session):open.delete(session);card.setAttribute('aria-expanded',on?'true':'false');steps.hidden=!on;};
    item.append(n,card);return item;
  }
  function draw(){
    const f=F(),now=Date.now(),todayKey=f.date(now),yesterdayKey=f.date(now-86400000),rows=all;
    q('.carlog-meta').textContent=t('Kept for {0} days',data.retention_days);
    drawStatus();
    const alerts=q('.carlog-now');alerts.replaceChildren();
    for(const item of data.active||[]){
      const a=el('article','carlog-alert');a.style.setProperty('--sev',SEVC[item.sev]||SEVC.important);
      const when=el('time','carlog-meta',t('since {0}',f.hm(item.since*1000)));
      a.append(icon('mdi:alert-outline'),el('strong',null,t(item.title)),when);alerts.append(a);
    }
    const tiles=q('.carlog-tiles');tiles.replaceChildren();
    const counts=data.counts||{};
    for(const [cat,ic,label] of CATS){
      const count=cat==='all'?(counts.security||0)+(counts.charging||0)+(counts.others||0):counts[cat]||0;
      const pressed=cat==='all'?filter==null:filter===cat;
      const b=el('button','carlog-tile');b.type='button';b.setAttribute('aria-pressed',pressed?'true':'false');b.style.setProperty('--tone',TONES[cat]);
      b.append(icon(ic),el('span',null,t(label)),el('small',null,String(count)));
      b.title=t('{0} today',count);
      b.onclick=()=>{filter=cat==='all'||filter===cat?null:cat;fresh=true;load();};tiles.append(b);
    }
    const chips=q('.carlog-range');chips.replaceChildren();
    for(const [value,label] of [['today','Today'],['7','7 days'],['30','30 days']]){
      const b=el('button','carlog-chip',t(label));b.type='button';b.setAttribute('aria-pressed',range===value?'true':'false');
      b.onclick=()=>{if(range===value)return;range=value;fresh=true;load();};chips.append(b);
    }
    chips.append(el('span','carlog-meta',t('Grouped events')));
    const body=q('.carlog-body');body.replaceChildren();
    if(!data.ready){body.append(el('p','carlog-empty',t('The car log is not running. Restart Home Assistant to load the update.')));return;}
    if(filter){
      const note=el('div','carlog-note');note.append(el('strong',null,t(CATS.find(c=>c[0]===filter)[2])),el('span',null,t(ABOUT[filter])));
      const sum=data.summary?.[filter];
      if(filter==='security'&&sum&&sum.locked!=null)note.append(el('span',null,(sum.locked?t('Doors locked now'):t('Doors unlocked now'))+(sum.since?' · '+t('last change {0}',f.hm(sum.since*1000)):'')));
      if(filter==='charging'&&sum&&sum.count)note.append(el('span',null,t('{0} charges · {1} kWh in the last 30 days',sum.count,sum.kwh)));
      if(!rows.length&&data.since)note.append(el('span',null,t('Nothing recorded since {0}. Earlier charges come from the charging archive.',f.dm(data.since*1000))));
      body.append(note);
    }
    if(!rows.length){if(!filter||!data.since)body.append(el('p','carlog-empty',t('Nothing in this period. Try a longer one.')));return;}
    const sessions=new Map();
    for(const r of rows)if(r.session){if(!sessions.has(r.session))sessions.set(r.session,[]);sessions.get(r.session).push(r);}
    const done=new Set();let day=null,list=null,hinted=false;
    for(const r of rows){
      if(r.session&&done.has(r.session))continue;
      const key=f.date(r.time*1000);
      if(key!==day){
        day=key;const h=el('h3','carlog-day');h.append(el('span',null,key===todayKey?t('Today'):key===yesterdayKey?t('Yesterday'):f.wdm(r.time*1000)));
        if(!hinted&&sessions.size){hinted=true;h.append(el('em',null,t('Tap a card for details')));}
        body.append(h);list=el('div','tl-list');body.append(list);
      }
      if(r.session){done.add(r.session);list.append(groupItem(r.session,sessions.get(r.session)));}
      else list.append(singleItem(r));
    }
    if(data.more){const b=el('button','carlog-more',t('Show older'));b.type='button';b.onclick=more;body.append(b);}
  }
  const ask=extra=>panel.request('car_log_get',{...(filter?{cat:filter}:{}),range,...extra},owner);
  function fail(error){
    if(dead)return;
    failure=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.'):(error.message||String(error));
    if(!data){const body=q('.carlog-body');body.replaceChildren();body.append(el('p','carlog-empty',failure));}
  }
  async function load(){
    if(dead)return;if(busy){again=true;return;}busy=true;
    try{
      const reset=fresh,res=await ask({limit:reset?100:Math.min(500,Math.max(100,all.length))});
      if(reset&&fresh)fresh=false;
      failure='';all=res.rows||[];data=res;if(!dead)draw();
    }catch(error){fail(error);}
    finally{busy=false;if(!dead&&again){again=false;schedule();}}
  }
  async function more(){
    if(dead||busy||!data?.more||!all.length)return;busy=true;
    try{
      const res=await ask({limit:100,before:Math.min(...all.map(r=>r.time))}),seen=new Set(all.map(r=>r.id));
      all=all.concat((res.rows||[]).filter(r=>!seen.has(r.id)));data={...res,rows:all};if(!dead)draw();
    }catch(error){fail(error);}
    finally{busy=false;if(!dead&&again){again=false;schedule();}}
  }
  function schedule(){clearTimeout(soon);soon=setTimeout(load,300);}
  try{
    const stop=await panel._hass.connection.subscribeMessage(message=>{if(!message.vehicle_id||message.vehicle_id===owner.vehicle_id)schedule();},{type:'deepal_companion/subscribe_car_log'});
    if(dead)stop();else unsub=stop;
  }catch(_){/* older backend: the 30 second check still keeps the page current */}
  await load();
  if(!dead)timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);
  return {busy:false,dirty:false,flush:async()=>{},destroy(){dead=true;clearInterval(timer);clearTimeout(soon);try{unsub?.();}catch(_){}unsub=null;host.remove();}};
}
