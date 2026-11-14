/* Recover Recorder sessions without fetching the entire Companion session list. */
EN.captureChargingCurve=(raw,session)=>Object.fromEntries([['ac','ac'],['dc','dc'],['battery','batt']].map(([role,key])=>{
  const rows=raw[key]||[],anchor=rows.filter(([t])=>t<=session.s&&t>=session.s-86400000).at(-1),inside=rows.filter(([t])=>t>session.s&&t<=session.e),points=[];
  for(const [t,state]of [...(anchor?[anchor]:[]),...inside]){const n=num(state),value=Number.isFinite(n)&&n>=0?n:null;if(!points.length||points.at(-1)[1]!==value)points.push([t,value]);}
  return [role,points];
}));
EN.importChargeRows=async(hass,rows,checkpoint=false)=>{
  let offset=0,total=0;
  do{let batch=rows.slice(offset,offset+20);while(batch.length>1&&JSON.stringify(batch).length>900000)batch=batch.slice(0,Math.ceil(batch.length/2));
    const end=offset+batch.length,result=await hass.companionRequest('sessions_import',{rows:batch,...(checkpoint?{curve_version:1,sync_complete:end>=rows.length}:{})});total+=result.imported||0;offset=end;
  }while(offset<rows.length);
  return total;
};
EN.syncRecorderCharges=async(card)=>{
  const hass=card._hass,now=Date.now(),cap=card._battKwh?card._battKwh():Number(card._c.battery_kwh)||DEF_KWH;
  const saved=await hass.companionRequest('costs_get',{}),assignments=saved?.value?.sessions||{};
  const ids={batt:K.resolveId(hass,card._c,ENT.batt),ac:K.resolveId(hass,card._c,ENT.ac),dc:K.resolveId(hass,card._c,ENT.dc)};
  const meters=Object.values(assignments).map(r=>r.profile).filter(p=>p?.source!=='battery'&&p?.entity).map(p=>p.entity);
  const entities=[...new Set([...Object.values(ids),...meters])];
  const history=await hass.companionRecorderHistory({type:'history/history_during_period',start_time:new Date(0).toISOString(),end_time:new Date(now).toISOString(),entity_ids:entities,include_start_time_state:false,significant_changes_only:false,minimal_response:true,no_attributes:true});
  const raw={batt:rowsOf(history?.[ids.batt]),ac:rowsOf(history?.[ids.ac]),dc:rowsOf(history?.[ids.dc]),odo:[],pow:[],fuel:[]};
  const rows=model(raw,now,cap,now,0,true).chg.filter(g=>!g.live&&!g.gap&&g.to>g.from).map(g=>{
    const assignment=assignments[String(Math.round(g.s/1000))]||null,entity=assignment?.profile?.entity;
    const pricing=chargingCost(g,assignment,numSeries(rowsOf(history?.[entity])),hass.states?.[entity]?.attributes?.unit_of_measurement||'');
    if(!assignment)pricing.energy=g.kwh;
    return {...g,capacity:cap,origin:'recorder',assignment,pricing,curve:EN.captureChargingCurve(raw,g)};
  });
  const imported=await EN.importChargeRows(hass,rows,true);
  return {imported};
};
/* Preserve recovered completed charges in the independent Companion archive. */
EN.loadChargingSessions=async(card)=>{
  const hass=card._hass,now=Date.now(),cap=card._battKwh?card._battKwh():Number(card._c.battery_kwh)||DEF_KWH;
  const archived=await hass.companionRequest("sessions",{});
  const saved=await hass.companionRequest("costs_get",{}),settings=saved?.value||{},assignments=settings.sessions||{};
  const ids={batt:K.resolveId(hass,card._c,ENT.batt),ac:K.resolveId(hass,card._c,ENT.ac),dc:K.resolveId(hass,card._c,ENT.dc)};
  const meters=Object.values(assignments).map(r=>r.profile).filter(p=>p?.source!=="battery"&&p?.entity).map(p=>p.entity);
  const entities=[...new Set([...Object.values(ids),...meters].filter(Boolean))];
  const key=JSON.stringify([card._companion?.vehicle_id,entities,cap]);
  let history,warning="";
  try{
    if(card._recorderCharges?.key===key&&now-card._recorderCharges.at<300000)history=card._recorderCharges.value;
    else{
      history=await hass.companionRecorderHistory({type:"history/history_during_period",start_time:new Date(0).toISOString(),end_time:new Date(now).toISOString(),entity_ids:entities,include_start_time_state:false,significant_changes_only:false,minimal_response:true,no_attributes:true});
      card._recorderCharges={key,at:now,value:history};
    }
  }catch(_){history={};warning=T("HA Recorder history could not be loaded. Only the Companion archive is shown.");}
  const raw={batt:rowsOf(history?.[ids.batt]),ac:rowsOf(history?.[ids.ac]),dc:rowsOf(history?.[ids.dc]),odo:[],pow:[],fuel:[]};
  const recovered=model(raw,now,cap,now,0,true).chg.filter(g=>!archived.some(a=>a.s<=g.e&&a.e>=g.s)).map(g=>{
    const assignment=assignments[String(Math.round(g.s/1000))]||null,entity=assignment?.profile?.entity;
    const pricing=chargingCost(g,assignment,numSeries(rowsOf(history?.[entity])),hass.states?.[entity]?.attributes?.unit_of_measurement||"");
    if(!assignment)pricing.energy=g.kwh;
    return {...g,id:"recorder_"+Math.round(g.s/1000),capacity:cap,origin:"recorder",assignment,pricing,curve:EN.captureChargingCurve(raw,g)};
  });
  const completed=recovered.filter(row=>!row.live&&!row.gap&&row.to>row.from);
  if(completed.length&&hass.user?.is_admin){
    try{
      await EN.importChargeRows(hass,completed);
      const persisted=await hass.companionRequest('sessions',{});
      return {rows:[...recovered.filter(row=>!persisted.some(a=>a.s<=row.e&&a.e>=row.s)),...persisted].sort((a,b)=>a.s-b.s),warning};
    }catch(error){warning='Recovered charging sessions could not be archived. They still depend on Recorder history: '+(error.message||String(error));}
  }
  return {rows:[...recovered,...archived].sort((a,b)=>a.s-b.s),warning};
};
