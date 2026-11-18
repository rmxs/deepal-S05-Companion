let curveSequence=0;
/* Lazy current-versus-time chart. Dots always represent changed sensor readings. */
const numeric=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
export function batteryAt(readings,time){let value=null;for(const row of readings){if(row.t>time)break;if(row.battery!==null&&row.battery>=0&&row.battery<=100)value=row.battery;}return value;}
const batteries=(series,key)=>(series[key]||[]).map(row=>({t:stamp(row),battery:numeric(row.s??row.state)})).filter(row=>Number.isFinite(row.t)&&row.battery!==null&&row.battery<=100).sort((a,b)=>a.t-b.t);
const stamp=row=>typeof(row.lu??row.lc)==='number'?(row.lu??row.lc)*1000:Date.parse(row.last_updated||row.last_changed);
export function smoothPath(points){
  if(!points.length)return '';if(points.length===1)return `M${points[0][0]},${points[0][1]}`;
  const slope=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]||1));
  const tangent=points.map((_,i)=>i===0?slope[0]:i===points.length-1?slope.at(-1):slope[i-1]*slope[i]<=0?0:2/(1/slope[i-1]+1/slope[i]));
  let path=`M${points[0][0]},${points[0][1]}`;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],h=(b[0]-a[0])/3,delta=slope[i];
    let left=delta?tangent[i]/delta:0,right=delta?tangent[i+1]/delta:0;
    const norm=Math.hypot(left,right);if(norm>3){left*=3/norm;right*=3/norm;}
    path+=`C${a[0]+h},${a[1]+h*delta*left} ${b[0]-h},${b[1]-h*delta*right} ${b[0]},${b[1]}`;
  }
  return path;
}
// Step line for change-only readings: each value holds until the next reported change, then steps. Nothing is interpolated between readings.
// Display only: a change smaller than minStep amps (0.2 A) is not drawn. Zero readings, the first and last readings always stay.
export function displayFlags(points,minStep=0.2){
  let kept=null;
  return points.map((p,i)=>{
    const keep=i===0||i===points.length-1||p.a<=.5||kept===null||kept.a<=.5||Math.abs(p.a-kept.a)>=minStep;
    if(keep)kept=p;
    return keep;
  });
}
export function stepPath(points){
  return points.map((p,i)=>i===0?`M${p[0]},${p[1]}`:`H${p[0]}V${p[1]}`).join('');
}
export function changedPoints(series,ac,dc,battery,start,expectedMode=null){
  const events=[];
  for(const [id,role] of [[ac,'ac'],[dc,'dc'],[battery,'battery']])for(const row of series[id]||[]){const t=stamp(row);if(Number.isFinite(t))events.push({t,role,v:numeric(row.s??row.state)});}
  events.sort((a,b)=>a.t-b.t);
  const preferred=['AC','DC'].includes(expectedMode)?expectedMode:null;
  const values={ac:null,dc:null,battery:null},points=[];let previous,segment=0,mode=preferred||'AC';
  // Some cars report a false DC current (400 A) at the moment an AC charge ends. A DC reading that starts
  // within 10 minutes of AC current stopping is ignored unless the battery then rises.
  let acStop=-Infinity,acWas=false,acBattery=null,dcWas=false,dcFalse=false;
  for(let i=0;i<events.length;){const t=events[i].t;let currentChanged=false;
    while(i<events.length&&events[i].t===t){const e=events[i++];if(e.role!=='battery'&&(!preferred||e.role===preferred.toLowerCase()))currentChanged=true;values[e.role]=e.v;}
    const acFlow=(values.ac??0)>.5,dcFlow=(values.dc??0)>.5;
    if(acFlow||acWas)acStop=t;
    if(!dcFlow)dcFalse=false;else if(!dcWas&&!acFlow&&t-acStop<=600000){dcFalse=true;acBattery=values.battery;}
    if(dcFalse&&values.battery!==null&&acBattery!==null&&values.battery>acBattery)dcFalse=false;
    acWas=acFlow;dcWas=dcFlow;
    if(!currentChanged)continue;
    if(preferred?values[preferred.toLowerCase()]===null:values.ac===null&&values.dc===null){segment++;previous=undefined;continue;}
    const dcValue=dcFalse?0:(values.dc??0);
    const current=preferred?values[preferred.toLowerCase()]:Math.max(values.ac??0,dcValue);
    if(current>.5)mode=preferred||(dcValue>.5?'DC':'AC');
    if(t>=start&&current!==previous)points.push({t,a:current,battery:values.battery,segment,mode});
    previous=current;
  }
  return points;
}
export function chargingWindow(readings,start=-Infinity,end=Infinity){
  const bounded=readings.filter(p=>p.t>=start&&p.t<=end),first=bounded.findIndex(p=>p.a>.5);
  if(first<0)return [];
  const last=bounded.findLastIndex(p=>p.a>.5),stop=bounded[last+1];
  return bounded.slice(first,stop&&stop.a<=.5?last+2:last+1);
}
/* The live curve keeps every stop and restart of the charge that is running. A new charge starts only after a stop longer than the
   time set in Settings (15 minutes by default, as the backend uses to close a charge), so the curve never depends on where the backend says the session began. */
export function liveCurveStart(points,now=Date.now(),gapMs=15*60000){
  for(let i=points.length-1;i>=0;i--){if(points[i].a>.5)continue;const next=points[i+1];if((next?next.t:now)-points[i].t>gapMs)return points.slice(i+1);}
  return points;
}
// Presentation only: preserve the archive and meaningful charging stops/pauses.
export function filterTransientZeros(readings){
  const result=[];
  for(let i=0;i<readings.length;){
    if(readings[i].a>.5){result.push(readings[i++]);continue;}
    const first=i;while(i<readings.length&&readings[i].a<=.5)i++;
    const before=result.at(-1),after=readings[i],zero=readings[first];
    if(before?.a>.5&&after?.a>.5&&after.t-zero.t<=30000&&before.segment===after.segment&&zero.segment===after.segment&&before.mode===after.mode)continue;
    result.push(...readings.slice(first,i));
  }
  return result;
}
export function curveRange(points){const active=points.filter(point=>point.a>.5);return active.length?{low:Math.min(...active.map(point=>point.a)),high:Math.max(...active.map(point=>point.a))}:null;}
// Missing data: a silent interval longer than the Settings time (or a segment change) with no battery increase inside it.
// The car reports current only when it changes, so an interval where the battery still rises is not missing. Returns the real readings at its ends.
export function missingIntervals(points,thresholdMs,batteryReadings=[]){
  const gaps=[];
  for(let i=0;i<points.length-1;i++){
    const from=points[i],to=points[i+1],duration=to.t-from.t;
    if(duration<=thresholdMs&&from.segment===to.segment)continue;
    const inside=batteryReadings.filter(r=>r.t>from.t&&r.t<=to.t&&r.battery!=null).map(r=>r.battery);
    if(to.battery!=null)inside.push(to.battery);
    const base=from.battery??inside[0]??null;
    if(base!==null&&inside.some(v=>v>base))continue;
    gaps.push({index:i,from,to,start:from.t,end:to.t,duration});
  }
  return gaps;
}
const css=`.charging-curve-block{box-sizing:border-box;min-width:0;padding:14px;border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-soft);color:var(--ds-fg);grid-column:1/-1}.charging-curve-block[hidden]{display:none!important}.curve-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.curve-heading h3{font-family:inherit;font-size:14px;font-weight:600;margin:0}.curve-heading strong{color:rgb(var(--ds-ok,52,211,153));font-size:16px;font-variant-numeric:tabular-nums}.curve-note{font-size:11px;color:var(--ds-fg2);line-height:1.5;margin:6px 0 0}.curve-chart{width:100%;display:block;overflow:visible;margin-top:12px}.curve-chart text{fill:var(--ds-fg2);font-family:inherit;font-size:12px}.curve-chart .curve-line{fill:none;stroke:light-dark(#087f5b,#34e5a4);stroke-width:3.25;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.curve-dot{fill:light-dark(#087f5b,#34e5a4);stroke:var(--ds-card);stroke-width:1.5;outline:none}.curve-dot:focus{stroke:var(--ds-fg);stroke-width:3}.curve-message{font-size:12px;color:var(--ds-fg2);padding:18px 0}.curve-retry{font:inherit;font-size:12px;color:rgb(var(--ds-ok,52,211,153));border:1px solid var(--ds-line);border-radius:9px;padding:8px;background:transparent}.curve-chart .curve-grid{stroke:var(--ds-line);stroke-dasharray:3 5;stroke-width:1}.curve-chart .curve-area{fill:rgba(var(--ds-ok,52,211,153),.07)}
ha-card[data-companion-design=energy]>.charging-curve-block{order:6!important}`;

const detailCss=`.curve-missing{fill:none;stroke:light-dark(#8b949e,#7d8590);stroke-width:3.25;stroke-linecap:round;opacity:.5;vector-effect:non-scaling-stroke}.curve-missing-area{fill:rgba(139,148,158,.07)}.curve-missing-hit{fill:transparent;pointer-events:all;cursor:help}.charging-curve-block,.charging-curve-block *{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.curve-plot{position:relative}.curve-plot .curve-reading{position:absolute;z-index:3;display:grid;gap:3px;min-height:0;max-width:calc(100% - 16px);box-sizing:border-box;margin:0;padding:10px 12px;border-radius:12px;background:var(--curve-card);box-shadow:0 5px 20px #0003;pointer-events:none}.curve-plot .curve-reading[hidden]{display:none}.curve-plot .curve-reading small{white-space:normal;line-height:1.5}.charging-curve-block{--curve-fg:var(--ds-fg,var(--primary-text-color,#eee));--curve-muted:var(--ds-fg2,var(--secondary-text-color,#aaa));--curve-card:var(--ds-card,var(--card-background-color,#202020));--curve-border:var(--ds-line,var(--divider-color,#444));color:var(--curve-fg);border-color:var(--curve-border);background:var(--ds-soft,var(--card-background-color,#202020))}.curve-heading{flex-wrap:wrap}.curve-range{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--curve-muted)}.curve-range>span{border-radius:8px;padding:5px 8px;background:rgba(var(--ds-ok,52,211,153),.07);border:1px solid rgba(var(--ds-ok,52,211,153),.16)}.curve-range b{font-weight:600;font-size:13px;color:rgb(var(--ds-ok,52,211,153));font-variant-numeric:tabular-nums}.curve-chart{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.curve-chart text{fill:var(--curve-muted)}.curve-chart .curve-grid{stroke:var(--curve-border)}.curve-note,.curve-message{color:var(--curve-muted)}.curve-dot{stroke:var(--curve-card)}.curve-dot.is-selected{stroke:var(--curve-fg);stroke-width:2}.curve-cursor{stroke:rgb(var(--ds-ok,52,211,153));stroke-width:1;stroke-dasharray:3 4;pointer-events:none}.curve-reading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px 10px;min-height:44px;padding:8px 10px;margin-top:4px;border:1px solid var(--curve-border);border-radius:10px;background:var(--curve-card);font-size:11px;color:var(--curve-muted)}.curve-reading b{color:var(--curve-fg);font-weight:600;font-size:13px}.curve-reading small{font-size:11px;font-variant-numeric:tabular-nums}.curve-chart:focus-visible{outline:2px solid rgb(var(--ds-ok,52,211,153));outline-offset:3px;border-radius:8px}@media(max-width:420px){.charging-curve-block{padding:12px}.curve-reading{align-items:flex-start;flex-direction:column;justify-content:center}.curve-range{gap:6px}}`;
export function mountCurve(card,history=null,container=null){
  let dead=false,busy=false,again=false,signature='',points=[],owner='',lastMarkup='',selectedTime=null,batteryReadings=[],tail=null,liveKey='',fullDomain=null,zoomRange=null,zoomControls=null;const clipId='dc-curve-'+(++curveSequence);
  // While charging, the line runs on from the last current change to now and the current battery level. Dots stay at current changes only.
  const setTail=()=>{tail={t:Date.now(),battery:card._n('sensor.battery_level')};};
  const refreshMinutes=()=>{const value=Number(card._c.charge_curve_refresh);return value>=1&&value<=60?value:5;};
  // Fallback when the car reports nothing new: move the end of the line every few minutes (Settings: Refresh the charging curve every).
  const timer=history?null:setInterval(()=>{if(dead||busy||!points.length||!tail||Date.now()-tail.t<refreshMinutes()*60000)return;setTail();draw();},30000);
  const gapMinutes=()=>{const value=Number(card._c.charge_curve_gap);return value>=1&&value<=120?value:15;}; /* Settings: A stop longer than this starts a new charge */
  const compact=!history&&!container; /* the card's live curve is a short strip with the cost bar at its foot; the archive keeps the tall chart */
  const host=document.createElement('section');host.className='charging-curve-block';host.setAttribute('aria-label','Charging current curve');
  host.innerHTML='<style>'+css+detailCss+'</style><div class="curve-heading"><h3>Charging curve</h3><div class="curve-range" aria-label="Current range while charging"><span>Low <b data-curve-low>—</b> A</span><span>High <b data-curve-high>—</b> A</span></div></div><div class="curve-plot"><div class="curve-reading" role="status" aria-live="polite" hidden></div></div>'+(compact?'<div data-curve-cost></div>':'<p class="curve-note">Low / High exclude the stop reading.</p>');
  const attach=()=>{if(!host.isConnected){if(container)container.append(host);else{const foot=card._el.card.querySelector(':scope>.foot');if(foot)foot.before(host);else card._el.card.append(host);}}host.style.order=String(card._c.order.indexOf('curve'));};attach();
  const plot=host.querySelector('.curve-plot'),readout=host.querySelector('.curve-reading');
  host.addEventListener('selectstart',event=>event.preventDefault());host.addEventListener('contextmenu',event=>event.preventDefault());
  function draw(){
    if(dead)return;attach();
    const lang=card._hass.locale?.language||'en',number=new Intl.NumberFormat(lang,{maximumFractionDigits:2}),range=curveRange(points);
    host.querySelector('[data-curve-low]').textContent=range?number.format(range.low):'—';host.querySelector('[data-curve-high]').textContent=range?number.format(range.high):'—';
    if(!points.length){plot.innerHTML='<p class="curve-message">'+(history?'No archived charging readings are available for this charge.':'Waiting for a charging reading…')+'</p>';readout.hidden=true;return;}
    readout.hidden=selectedTime===null;
    const live=!history&&tail&&points.at(-1).a>.5&&tail.t>points.at(-1).t?tail:null,liveBattery=live&&live.battery!==null&&live.battery>=0&&live.battery<=100;
    const axisBattery=[...(batteryReadings.length?batteryReadings:points),...(liveBattery?[{t:live.t,battery:live.battery}]:[])],hasBattery=axisBattery.some(row=>row.battery!==null&&row.battery>=0&&row.battery<=100);
    const W=560,H=compact?(hasBattery?200:176):(hasBattery?320:298),L=36,R=12,T=12,B=hasBattery?54:32,max=Math.max(1,...points.map(p=>p.a))*1.15;
    fullDomain={start:points[0].t,end:Math.max(points[0].t+1000,points.at(-1).t,live?live.t:0)};
    if(!zoomControls)zoomControls=window.__DEEPAL_COMPANION_UI.mountChartZoom(plot,()=>fullDomain,range=>{zoomRange=range;lastMarkup='';draw();});
    const first=zoomRange?.start??fullDomain.start,end=zoomRange?.end??fullDomain.end,short=end-first<120000,x=t=>L+(t-first)/(end-first)*(W-L-R),y=a=>T+(1-a/max)*(H-T-B),format=window.__DEEPAL_COMPANION_UI.format(card._hass);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.classList.add('curve-chart');svg.setAttribute('role','img');svg.setAttribute('tabindex','0');svg.setAttribute('data-start',String(first));svg.setAttribute('data-end',String(end));if(live)svg.setAttribute('data-live-end',String(live.t));svg.setAttribute('aria-label',`Recorded charging current in amps, ${points.length} readings. Tap, drag or use arrow keys to inspect.`);
    const defs=document.createElementNS(ns,'defs');defs.innerHTML='<clipPath id="'+clipId+'"><rect x="'+L+'" y="'+T+'" width="'+(W-L-R)+'" height="'+(H-T-B)+'"/></clipPath>';svg.append(defs);
    const element=(name,attrs)=>{const n=document.createElementNS(ns,name);if(/curve-(line|area|dot|cursor|missing)/.test(attrs.class||''))n.setAttribute('clip-path','url(#'+clipId+')');for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
    for(let i=0;i<3;i++){const a=max*i/2;element('line',{x1:L,x2:W-R,y1:y(a),y2:y(a),class:'curve-grid'});element('text',{x:L-6,y:y(a)+4,'text-anchor':'end'}).textContent=number.format(a);}
    for(const [t,anchor]of [[first,'start'],[(first+end)/2,'middle'],[end,'end']]){element('text',{x:x(t),y:hasBattery?H-25:H-6,'text-anchor':anchor,class:'curve-time'}).textContent=format.hm(t,short);const battery=batteryAt(axisBattery,t);if(hasBattery&&battery!==null)element('text',{x:x(t),y:H-7,'text-anchor':anchor,class:'curve-battery','data-battery':battery}).textContent=number.format(battery)+'%';}
    const shownFlag=displayFlags(points);
    const highlight=card._c.charge_curve_missing!==false,drawn=points.filter((_,i)=>shownFlag[i]),gaps=highlight?missingIntervals(drawn,gapMinutes()*60000,batteryReadings):[];
    let group=[];const paint=()=>{if(!group.length)return;const path=stepPath(group.map(p=>[x(p.t),y(p.a)]));if(group.length>1)element('path',{d:path+`L${x(group.at(-1).t)},${H-B}L${x(group[0].t)},${H-B}Z`,class:'curve-area'});element('path',{d:path,class:'curve-line'});group=[];};
    // A missing interval is bridged by a lighter line between the two real readings at its ends; no point is invented inside it.
    // A genuine 0 A reading stays in the line as a drop to zero. With Highlight Missing Data off, the line is one continuous path.
    const gapAt=new Map(gaps.map(g=>[g.index,g]));
    drawn.forEach((p,i)=>{
      group.push(p);
      const gap=gapAt.get(i);if(!gap)return;
      paint();
      const x1=x(gap.from.t),y1=y(gap.from.a),x2=x(gap.to.t),y2=y(gap.to.a),base=H-B,shape=`M${x1},${y1}L${x2},${y2}L${x2},${base}L${x1},${base}Z`;
      element('path',{d:shape,class:'curve-missing-area'});
      element('line',{x1,y1,x2,y2,class:'curve-missing'});
      element('path',{d:shape,class:'curve-missing-hit','data-gap':String(gap.index)});
    });
    if(live&&group.length)group.push({t:live.t,a:group.at(-1).a});paint();
    const dots=[];
    points.forEach((p,i)=>{if(!shownFlag[i]){dots.push(null);return;}const label=`${format.date(p.t)} ${format.hm(p.t,true)} · ${p.mode} ${number.format(p.a)} A${p.battery!==null?' · Battery '+number.format(p.battery)+'%':''}`,dot=element('circle',{cx:x(p.t),cy:y(p.a),r:3,class:'curve-dot','aria-label':label});const title=document.createElementNS(ns,'title');title.textContent=label;dot.append(title);dots.push(dot);});
    const cursor=element('line',{x1:L,x2:L,y1:T,y2:H-B,class:'curve-cursor',visibility:'hidden'});let index=-1,dragging=false;
    function nearest(time){let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].t<time)lo=mid+1;else hi=mid;}return !lo?0:lo===points.length?points.length-1:time-points[lo-1].t<=points[lo].t-time?lo-1:lo;}
    function show(next){if(index>=0){dots[index]?.classList.remove('is-selected');dots[index]?.setAttribute('r','3');}index=next;const point=points[index];selectedTime=point.t;dots[index]?.classList.add('is-selected');dots[index]?.setAttribute('r','5');cursor.setAttribute('x1',String(x(point.t)));cursor.setAttribute('x2',String(x(point.t)));cursor.setAttribute('visibility','visible');const value=document.createElement('b'),details=document.createElement('small');value.textContent=(point.a<=.5?'Charging stopped':point.mode)+' · '+number.format(point.a)+' A';details.textContent=format.date(point.t)+' · '+format.hm(point.t,true)+(point.battery!==null?' · Battery '+number.format(point.battery)+'%':'');readout.replaceChildren(value,details);readout.dataset.time=String(point.t);readout.dataset.amps=String(point.a);readout.hidden=false;const rect=svg.getBoundingClientRect(),width=Math.min(260,rect.width-16);readout.style.width=width+"px";readout.style.left=Math.max(8,Math.min(rect.width-width-8,x(point.t)/W*rect.width-width/2))+"px";readout.style.maxHeight=Math.max(40,rect.height-16)+"px";readout.style.overflowY="hidden";readout.style.top=Math.max(8,Math.min(y(point.a)/H*rect.height-readout.offsetHeight-14,rect.height-readout.offsetHeight-8))+"px";}
    // Tooltip for a missing interval: its explanation, start, end and duration. No measurement values are shown for it.
    function showGap(gap,rect){
      if(index>=0){dots[index]?.classList.remove('is-selected');dots[index]?.setAttribute('r','3');}index=-1;selectedTime=null;cursor.setAttribute('visibility','hidden');
      const minutes=Math.max(1,Math.round(gap.duration/60000)),span=minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`;
      const line=(text,tag)=>{const node=document.createElement(tag||'small');node.textContent=text;return node;};
      const row=(label,value)=>{const node=document.createElement('small'),name=document.createElement('span'),amount=document.createElement('span');name.textContent=label;amount.textContent=value;node.append(name,' ',amount);return node;};
      const causes=['Temporary connectivity interruption','Vehicle entering sleep mode','Delayed telemetry synchronization','Temporary API or integration unavailability'].map(text=>line(text));
      readout.replaceChildren(line('Missing telemetry data','b'),line('No updates were received during this interval.'),line('Possible causes:'),...causes,line('These are possibilities, not confirmed diagnoses.'),row('Start',format.date(gap.start)+' '+format.hm(gap.start,true)),row('End',format.date(gap.end)+' '+format.hm(gap.end,true)),row('Duration',span));
      readout.dataset.gap=String(gap.index);readout.hidden=false;
      const width=Math.min(260,rect.width-16);readout.style.width=width+"px";
      readout.style.left=Math.max(8,Math.min(rect.width-width-8,(x(gap.from.t)+x(gap.to.t))/2/W*rect.width-width/2))+"px";
      readout.style.maxHeight=Math.max(40,rect.height-16)+"px";readout.style.overflowY="hidden";readout.style.top=Math.max(8,Math.min(Math.min(y(gap.from.a),y(gap.to.a))/H*rect.height-readout.offsetHeight-14,rect.height-readout.offsetHeight-8))+"px";
    }
    const inspect=event=>{const rect=svg.getBoundingClientRect(),px=(event.clientX-rect.left)/Math.max(1,rect.width)*W,time=first+Math.max(0,Math.min(1,(px-L)/(W-L-R)))*(end-first);const gap=gaps.find(g=>time>=g.start&&time<=g.end);if(gap){showGap(gap,rect);return;}show(nearest(time));};
    svg.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;dragging=true;inspect(event);try{svg.setPointerCapture(event.pointerId);}catch(_){};});
    svg.addEventListener('pointermove',event=>{if(dragging||event.pointerType==='mouse')inspect(event);});svg.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!dragging){readout.hidden=true;cursor.setAttribute('visibility','hidden');}});
    const release=event=>{dragging=false;try{svg.releasePointerCapture(event.pointerId);}catch(_){};};svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);
    svg.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();show(event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,(index<0?0:index)+(event.key==='ArrowLeft'?-1:1))));});
    const markup=svg.outerHTML;if(markup!==lastMarkup){const focused=plot.contains(plot.getRootNode().activeElement);plot.replaceChildren(svg,readout);lastMarkup=markup;if(selectedTime!==null)show(nearest(selectedTime));if(focused)svg.focus({preventScroll:true});}
  }
  async function update(){
    if(dead)return;attach();
    if(history){batteryReadings=batteries(history.series,'battery');points=chargingWindow(filterTransientZeros(changedPoints(history.series,'ac','dc','battery',history.start-86400000,history.mode)),history.start,history.end);draw();return;}
    const ac=card._id(card._n('sensor.ac_charge_current')!==null?'sensor.ac_charge_current':'sensor.charge_current'),dc=card._id('sensor.dc_charge_current'),battery=card._id('sensor.battery_level');
    const reportedMode=String(card._s?.('sensor.charging_type')||'').toUpperCase().match(/\b(AC|DC)\b/)?.[1]||null;
    const key=JSON.stringify([card._companion,ac,dc,reportedMode]),states=card._hass.states,change=JSON.stringify([key,states[ac]?.state,states[dc]?.state,card._previewMode]);
    if(owner!==key){owner=key;points=[];batteryReadings=[];signature='';lastMarkup='';}
    const liveNow=JSON.stringify([states[battery]?.state,states[card._id('sensor.last_updated')]?.state]);
    if(signature===change){if(liveNow!==liveKey&&!busy&&points.length&&tail){liveKey=liveNow;setTail();draw();}return;}
    if(busy){again=true;return;}signature=change;busy=true;
    try{
      if(card._previewSourceHass&&card._previewMode!=='live'){
        points=[{t:Date.now(),a:Math.max(card._n('sensor.ac_charge_current')||0,card._n('sensor.dc_charge_current')||0),battery:card._n('sensor.battery_level'),segment:0,mode:card._n('sensor.dc_charge_current')>.5?'DC':'AC'}];batteryReadings=points;tail=null;draw();return;
      }
      if(!points.length)plot.innerHTML='<p class="curve-message">Loading charging readings…</p>';
      const readHass=card._previewSourceHass?window.__DEEPAL_COMPANION_UI.context(card._previewSourceHass,card._companion,card._c)._hass:card._hass;
      let start=Date.now()-24*3600000,activeMode=reportedMode,activeStart=null;
      try{const summary=await readHass.companionRequest('summary');if(summary.active?.s){activeStart=summary.active.s;if(!activeMode&&typeof summary.active.dc==='boolean')activeMode=summary.active.dc?'DC':'AC';}}catch(_){}
      if(dead)return;
      const rows=await readHass.callWS({type:'history/history_during_period',start_time:new Date(start).toISOString(),end_time:new Date().toISOString(),entity_ids:[ac,dc,battery],include_start_time_state:true,significant_changes_only:false,minimal_response:true,no_attributes:true});
      if(dead||owner!==key)return;
      batteryReadings=batteries(rows,battery);let loaded=filterTransientZeros(changedPoints(rows,ac,dc,battery,start,activeMode));
      // Without an archived active session, use the current uninterrupted charge.
      // The live curve shows the whole active session, including every stop and restart; the stop-gap setting applies only when no session is known.
      loaded=activeStart?loaded.filter(p=>p.t>=activeStart):liveCurveStart(loaded,Date.now(),gapMinutes()*60000);
      // changedPoints rejected the DC reading (false 400 A after an AC charge): do not add it back as the latest point.
      const falseDC=!activeMode&&card._n('sensor.dc_charge_current')>.5&&!(card._n('sensor.ac_charge_current')>.5)&&loaded.length>0&&loaded.at(-1).a<=.5;
      const useDC=activeMode?activeMode==='DC':!falseDC&&card._n('sensor.dc_charge_current')>.5;
      const latest=useDC?states[dc]:states[ac],reported=Date.parse(latest?.last_changed||latest?.last_updated),t=Number.isFinite(reported)?reported:Date.now(),a=activeMode?(card._n(useDC?'sensor.dc_charge_current':'sensor.ac_charge_current')??(useDC?0:card._n('sensor.charge_current'))??0):Math.max(card._n('sensor.ac_charge_current')||0,falseDC?0:card._n('sensor.dc_charge_current')||0);
      if(!loaded.length||loaded.at(-1).a!==a){if(loaded.at(-1)?.t===t)loaded.pop();loaded.push({t,a,battery:card._n('sensor.battery_level'),segment:loaded.at(-1)?.segment||0,mode:useDC?'DC':'AC'});}
      points=chargingWindow(loaded);liveKey=liveNow;setTail();draw();
    }catch(_){if(!dead){signature='';if(!points.length){plot.innerHTML='<p class="curve-message">Charging readings could not be loaded.</p><button class="curve-retry">Try again</button>';plot.querySelector('button').onclick=()=>update();}}}
    finally{busy=false;if(again&&!dead){again=false;update();}}
  }
  return {update,destroy(){dead=true;clearInterval(timer);zoomControls?.destroy();host.remove();}};
}
export function mountArchivedCurve(container,hass,data,config){const chart=mountCurve({_hass:hass,_c:{order:['curve'],...(config||{})},_el:{card:container}},data,container);chart.update();return chart;}

// Shared by the dashboard and the card's charge list. Removing the dialog also
// releases its chart, including when its owning page or card is disconnected.
// tools (optional, administrators): {sessionId, mode:'AC'|'DC'|null, request(op,data), onChanged(kind)} adds
// the charge type switch, reading removal by dragging on the chart, and deleting the charge.
export function openCurveDialog(root,hass,load,config={},tools=null){
  const dialog=document.createElement('dialog');let chart,dead=false,selecting=false,range=null;
  window.__DEEPAL_COMPANION_UI.applyPalette(dialog,config);
  dialog.style.colorScheme=hass?.themes?.darkMode===false?'light':'dark';dialog.className='session-price-dialog archived-curve-dialog';dialog.setAttribute('aria-label','Archived charging curve');
  dialog.innerHTML=`<style>
    .archived-curve-dialog{box-sizing:border-box;width:min(640px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:85dvh;margin:auto;padding:16px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:20px;color:var(--ds-fg,var(--primary-text-color,#eee));background:var(--ds-card,var(--card-background-color,#222));overflow:auto;font-family:inherit}
    .archived-curve-dialog::backdrop{background:rgba(0,0,0,.55)}
    .archived-curve-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0;margin:0 0 12px;position:static;min-height:44px}
    .archived-curve-dialog>header h2{margin:0;font-family:inherit;font-size:16px;font-weight:600;line-height:1.4}
    .archived-curve-dialog>header button{display:grid;place-items:center;flex:none;width:44px;height:44px;min-height:44px;padding:0;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:12px;background:transparent;color:inherit;cursor:pointer}
    .archived-curve-dialog>header button svg{display:block;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
    .archived-curve-dialog>.note{font:inherit;font-size:11px;color:var(--ds-fg2,var(--secondary-text-color,#aaa));line-height:1.5;margin:12px 0 0}
    .curve-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
    .curve-tools .seg{display:inline-flex;padding:3px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:999px}
    .curve-tools .seg button{min-width:44px;min-height:32px;padding:4px 12px;border:0;border-radius:999px;background:transparent;color:var(--ds-fg2,var(--secondary-text-color,#aaa));font:inherit;font-size:12px;cursor:pointer}
    .curve-tools .seg button[aria-pressed=true]{background:rgb(var(--ds-ok,52,211,153));color:#0b1511;font-weight:600}
    .curve-tools>button{min-height:38px;padding:6px 12px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:10px;background:transparent;color:var(--ds-fg,var(--primary-text-color,#eee));font:inherit;font-size:12px;cursor:pointer}
    .curve-tools>button[aria-pressed=true]{border-color:rgb(var(--ds-ok,52,211,153));color:rgb(var(--ds-ok,52,211,153))}
    .curve-tools>button.danger{color:rgb(var(--ds-bad,248,113,113));margin-left:auto}
    .curve-tools button:disabled{opacity:.4;cursor:default}
    .curve-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;padding:10px 12px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:12px;font-size:12px;line-height:1.5}
    .curve-confirm[hidden]{display:none}
    .curve-confirm span{flex:1 1 200px}
    .curve-confirm button{min-height:36px;padding:6px 12px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
    .curve-confirm button.primary{background:rgb(var(--ds-bad,248,113,113));border-color:transparent;color:#fff;font-weight:600}
    .archived-curve-content.is-selecting .curve-chart{cursor:col-resize}
    .curve-select-rect{fill:rgba(var(--ds-bad,248,113,113),.18);stroke:rgb(var(--ds-bad,248,113,113));stroke-width:1;pointer-events:none}
  </style><header><h2>Charging curve</h2><button type="button" aria-label="Close charging curve"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><div class="archived-curve-content"></div><p class="note">Saved charging readings · independent of Recorder retention.</p>`;
  const content=dialog.querySelector('.archived-curve-content');content.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');
  const format=window.__DEEPAL_COMPANION_UI.format(hass);
  if(tools){
    const bar=document.createElement('div');bar.className='curve-tools';
    bar.innerHTML='<div class="seg" role="group" aria-label="Charge type"><button type="button" data-mode="AC">AC</button><button type="button" data-mode="DC">DC</button></div><button type="button" data-tool="select" aria-pressed="false">Remove readings</button><button type="button" class="danger" data-tool="delete">Delete charge</button>';
    const confirm=document.createElement('div');confirm.className='curve-confirm';confirm.hidden=true;confirm.setAttribute('role','status');
    dialog.querySelector('.note').before(bar,confirm);
    const paintMode=()=>{for(const b of bar.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===tools.mode));};paintMode();
    const tr=(key,...args)=>window.__DEEPAL_COMPANION_UI?.t?.(key,...args)??key;
    const ask=(text,label,run)=>{confirm.hidden=false;confirm.innerHTML='<span></span><button type="button" data-no></button><button type="button" class="primary" data-yes></button>';confirm.firstElementChild.textContent=text;confirm.querySelector('[data-no]').textContent=tr('Cancel');confirm.querySelector('[data-yes]').textContent=label;
      confirm.querySelector('[data-no]').onclick=()=>{confirm.hidden=true;clearRange();};
      confirm.querySelector('[data-yes]').onclick=async()=>{for(const b of confirm.querySelectorAll('button'))b.disabled=true;try{await run();}catch(error){confirm.hidden=false;confirm.innerHTML='<span></span>';confirm.firstElementChild.textContent=error.message||tr('The change could not be saved.');}};};
    const reload=async()=>{content.replaceChildren();content.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');chart?.destroy();chart=null;const data=await load();if(dead)return;content.replaceChildren();chart=mountArchivedCurve(content,hass,data,config);};
    const clearRange=()=>{range=null;content.querySelector('.curve-select-rect')?.remove();};
    bar.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;
      if(b.dataset.mode&&b.dataset.mode!==tools.mode){const dc=b.dataset.mode==='DC';ask(tr('Record this charge as {0}?',b.dataset.mode),tr('Change type'),async()=>{await tools.request('session_mode',{session_id:tools.sessionId,dc});tools.mode=b.dataset.mode;paintMode();confirm.hidden=true;tools.onChanged?.('mode');await reload();});}
      else if(b.dataset.tool==='select'){selecting=!selecting;b.setAttribute('aria-pressed',String(selecting));content.classList.toggle('is-selecting',selecting);confirm.hidden=!selecting;clearRange();if(selecting){confirm.innerHTML='<span></span>';confirm.firstElementChild.textContent=tr('Drag across the chart to choose the readings to remove.');}}
      else if(b.dataset.tool==='delete'){ask(tr('Delete this charge?')+' '+tr('It leaves the lists and totals now and can be restored from "Deleted charges" for 30 days.'),tr('Delete'),async()=>{await tools.request('session_delete',{session_id:tools.sessionId});tools.onChanged?.('deleted');dialog.remove();});}
    });
    // Range selection: pointer drag on the chart while "Remove readings" is on. Times come from the chart's data-start/data-end.
    let drag=null;const chartAt=event=>event.target.closest('.curve-chart');
    const timeAt=(svg,clientX)=>{const box=svg.getBoundingClientRect(),W=560,L=36,R=12,start=Number(svg.dataset.start),end=Number(svg.dataset.liveEnd||svg.dataset.end),f=Math.min(1,Math.max(0,((clientX-box.left)/box.width*W-L)/(W-L-R)));return start+f*(end-start);};
    content.addEventListener('pointerdown',event=>{const svg=chartAt(event);if(!selecting||!svg)return;event.preventDefault();event.stopPropagation();drag={svg,x0:event.clientX};svg.setPointerCapture?.(event.pointerId);clearRange();},true);
    content.addEventListener('pointermove',event=>{if(!drag)return;event.stopPropagation();const {svg}=drag,t0=timeAt(svg,drag.x0),t1=timeAt(svg,event.clientX);range={start:Math.min(t0,t1),end:Math.max(t0,t1)};
      const W=560,L=36,R=12,s=Number(svg.dataset.start),e=Number(svg.dataset.liveEnd||svg.dataset.end),x=t=>L+(t-s)/(e-s)*(W-L-R);let rect=svg.querySelector('.curve-select-rect');if(!rect){rect=document.createElementNS('http://www.w3.org/2000/svg','rect');rect.setAttribute('class','curve-select-rect');rect.setAttribute('y','0');rect.setAttribute('height','100%');svg.append(rect);}rect.setAttribute('x',String(x(range.start)));rect.setAttribute('width',String(Math.max(1,x(range.end)-x(range.start))));},true);
    const finish=event=>{if(!drag)return;event.stopPropagation();drag=null;if(!range||range.end-range.start<1000){clearRange();return;}
      ask(`Remove the charging current readings between ${format.hm(range.start,true)} and ${format.hm(range.end,true)}? Battery readings are kept. This cannot be undone.`,'Remove readings',async()=>{const chosen=range;await tools.request('curve_exclude',{start:Math.floor(chosen.start),end:Math.ceil(chosen.end)});confirm.hidden=true;clearRange();tools.onChanged?.('readings');await reload();});};
    content.addEventListener('pointerup',finish,true);content.addEventListener('pointercancel',finish,true);
  }
  const remove=dialog.remove.bind(dialog);dialog.remove=()=>{if(dead)return;dead=true;chart?.destroy();remove();};
  dialog.querySelector('button').onclick=event=>{event.stopPropagation();dialog.remove();};
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});dialog.addEventListener('close',()=>dialog.remove());
  (root.nodeType===9?root.body:root).append(dialog);dialog.showModal();
  Promise.resolve().then(load).then(data=>{if(dead)return;content.replaceChildren();chart=mountArchivedCurve(content,hass,data,config);}).catch(error=>{if(!dead)content.textContent=/Unknown.*operation/i.test(error.message||'')?'Restart Home Assistant to load archived charging curves, then refresh.':error.message||'Charging curve could not be loaded.';});
  return dialog;
}
