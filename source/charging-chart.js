function renderChargingChart(sessions,lang="en",now=Date.now(),options={}){
  const count=options.period===7?7:30,dateLabel=t=>options.fmt?.date?options.fmt.date(t):new Date(t).toLocaleDateString(lang),shortDate=t=>options.fmt?.dm?options.fmt.dm(t):new Date(t).toLocaleDateString(lang,{month:"short",day:"numeric"}),heading="Charging · "+count+" days";
  const tr=(en,el,es=en)=>lang.startsWith("el")?el:lang.startsWith("es")?es:en;
  if(!sessions.some(row=>!row.live&&row.s<=now))return '<section class="cc-charts cc-chart-empty"><div class="cc-chart-heading">'+esc(heading)+'</div><p class="cc-hint">'+esc(tr('No completed charging sessions available for this chart yet.','Δεν υπάρχουν ακόμη ολοκληρωμένες φορτίσεις για αυτό το γράφημα.'))+'</p></section>';
  const days=[],end=new Date(now);end.setHours(0,0,0,0);
  for(let i=count-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);days.push({t:d.getTime(),energy:0,cost:0,missing:0});}
  for(const row of sessions){
    if(row.live||row.s>now)continue;
    const d=new Date(row.s);d.setHours(0,0,0,0);const day=days.find(x=>x.t===d.getTime());if(!day)continue;
    const energy=Number.isFinite(row.pricing?.energy)?row.pricing.energy:row.kwh;
    if(Number.isFinite(energy)&&energy>0)day.energy+=energy;
    if(Number.isFinite(row.pricing?.cost))day.cost+=row.pricing.cost;else day.missing++;
    if(Number.isFinite(row.unpriced_count))day.missing+=row.unpriced_count;
  }
  const fmt=new Intl.NumberFormat(lang,{maximumFractionDigits:2});
  const chart=(key,label,unit,color)=>{
    const max=Math.max(1,...days.map(d=>d[key])),bars=days.map((d,i)=>{
      const height=d[key]/max*80,x=30+i*300/count,y=100-height;
      return '<rect x="'+x+'" y="'+y+'" width="'+Math.max(3,300/count-3)+'" height="'+height+'" rx="2" fill="'+color+'"><title>'+esc(dateLabel(d.t)+': '+fmt.format(d[key])+' '+unit)+'</title></rect>'+(key==="cost"&&d.missing?'<circle cx="'+(x+3.5)+'" cy="108" r="2" fill="#f4b95f"><title>'+esc(tr("Unpriced sessions","Φορτίσεις χωρίς τιμή"))+'</title></circle>':"");
    }).join("");
    return '<div class="cc-chart"><b>'+esc(label)+'</b><svg viewBox="0 0 340 133" role="img" tabindex="0" aria-label="'+esc(label)+'"><title>'+esc(label+' · '+count+" days")+'</title><line x1="27" y1="100" x2="331" y2="100" stroke="currentColor" opacity=".2"/><text x="27" y="14" fill="currentColor" font-size="9">'+esc(fmt.format(max)+' '+unit)+'</text>'+bars+'<text x="30" y="128" fill="currentColor" font-size="9">'+esc(shortDate(days[0].t))+'</text><text x="327" y="128" text-anchor="end" fill="currentColor" font-size="9">'+esc(shortDate(end))+'</text></svg></div>';
  };
  return '<section class="cc-charts" data-cc-series="'+esc(JSON.stringify(days))+'" data-cc-lang="'+esc(lang)+'"><div class="cc-chart-heading">'+esc(heading)+'</div><div class="cc-chart-grid">'+chart("energy",tr("Charged energy","Ενέργεια φόρτισης","Energía cargada"),"kWh","#61cda3")+chart("cost",tr("Charging cost","Κόστος φόρτισης","Coste de carga"),"€","#79adff")+'</div><div class="cc-chart-tip" role="tooltip" hidden></div><small>'+esc(tr("Energy may be estimated. Amber dots indicate sessions without a price; these are excluded from cost bars.","Η ενέργεια μπορεί να είναι εκτίμηση. Οι πορτοκαλί τελείες δείχνουν φορτίσεις χωρίς τιμή, που δεν περιλαμβάνονται στις μπάρες κόστους."))+'</small></section>';
}
EN.renderChargingChart=renderChargingChart;
EN.bindChargingChart=(host,haFormat=null)=>{
  for(const root of host.querySelectorAll(".cc-charts")){
    if(!root.dataset.ccSeries)continue;
    if(root._ccBound)continue;root._ccBound=true;
    const days=JSON.parse(root.dataset.ccSeries),lang=root.dataset.ccLang||"en",format=new Intl.NumberFormat(lang,{maximumFractionDigits:2}),tip=root.querySelector(".cc-chart-tip");let index=days.length-1;
    const show=(svg,i)=>{index=Math.max(0,Math.min(days.length-1,i));const day=days[index];if(!day)return;
      tip.textContent=(haFormat?.date?haFormat.date(day.t):new Date(day.t).toLocaleDateString(lang))+" · "+format.format(day.energy)+" kWh · "+format.format(day.cost)+" €"+(day.missing?" · "+day.missing+" "+T("unpriced"):"");tip.hidden=false;
    };
    const point=event=>{const svg=event.target.closest(".cc-chart svg");if(!svg)return;const box=svg.getBoundingClientRect();show(svg,Math.floor(((event.clientX-box.left)/box.width*340-30)/(300/days.length)));};
    root.addEventListener("pointermove",point);root.addEventListener("pointerdown",point);
    root.addEventListener("pointerleave",()=>{tip.hidden=true;});
    root.addEventListener("focusin",event=>{if(event.target.matches("svg"))show(event.target,index);});
    root.addEventListener("focusout",()=>{tip.hidden=true;});
    root.addEventListener("keydown",event=>{if(event.target.matches("svg")&&["ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();show(event.target,index+(event.key==="ArrowRight"?1:-1));}});
  }
};
