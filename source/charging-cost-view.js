function renderChargingCosts(m,ctx){
  const rows=m.chg.slice().reverse();
  let html='<div class="en-cost-heading"><h3>'+esc(CT("Charging costs","Κόστος φορτίσεων","Costes de carga"))+'</h3><small>'+rows.length+" "+esc(CT("charging sessions","φορτίσεις","cargas"))+'</small></div>';
  html+=renderChargingChart(rows,ctx.lang,ctx.now);
  if(!rows.length)return html+'<p class="hint">'+esc(CT("No charging sessions have been recorded yet.","Δεν έχουν καταγραφεί ακόμη φορτίσεις.","Todavía no hay cargas registradas."))+'</p>';
  html+='<div class="en-cost-list">';
  for(const g of rows){
    const date=ctx.fmt.dm(g.s)+" · "+ctx.fmt.hm(g.s)+" – "+ctx.fmt.hm(g.e);
    html+='<div class="en-li"><span class="a"><span class="ic">'+ico("plug")+'</span><span class="mid">'+esc(date)+(g.live?' <span class="bd">'+esc(CT("Charging","Φορτίζει"))+'</span>':"")+'<small>'+esc(Number.isFinite(g.from)?g.from+"% → "+g.to+"%":"")+'</small></span></span><span class="b">'+(g.kwh>0?esc(new Intl.NumberFormat(ctx.lang,{maximumFractionDigits:1}).format(g.kwh))+" kWh":"—")+'</span></div>';
  }
  return html+"</div>";
}
