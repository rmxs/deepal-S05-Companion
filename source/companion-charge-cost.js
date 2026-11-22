/* Live cost of the running charge. Frontend only: reads sessions_page and costs_get, and the only write is the Companion charging settings.
   The block appears with the charging curve (or in the charge area) while charging, and never together with the end-of-charge prompt. */
const CC_CURRENT_SENSORS=['sensor.ac_charge_current','sensor.dc_charge_current','sensor.charge_current'];
const CC_DEMO_PROFILES=[{id:'home',name:'Home',price:.25,free:false,efficiency:90},{id:'free',name:'Free',price:null,free:true,efficiency:90}];
const ccRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=ccRender.apply(this,args);
  try{this._renderChargeCost();}catch(error){console.error('Deepal Companion charge cost',error);}
  return result;
};
const ccDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.disconnectedCallback=function(){this._ccDestroy();ccDisconnected.call(this);};
DeepalS05Card.prototype._ccDestroy=function(){
  const state=this._cc;if(state){state.dead=true;clearTimeout(state.timer);clearTimeout(state.leaveTimer);}
  const chip=this._el?.charge?.querySelector('[data-cg-cost]');if(chip)chip.innerHTML='';
  this._cc=null;this._ccSeen=0;
  this._el?.card?.querySelector('.charge-cost-live')?.remove();
};
/* The preview simulates a charge and a pair of locations; it never calls the backend. */
function ccDemoRow(profile){
  const energy=(68-52)*18.4/100/.9,price=profile?.price,cost=profile?profile.free?0:price!=null?price*energy:null:null;
  return {id:'demo',s:Date.now()-36e5,e:Date.now(),from:52,to:68,kwh:2.94,capacity:18.4,live:true,dc:false,
    assignment:profile?{profile,energy:null,total:null}:null,pricing:{energy:profile?energy:null,cost,source:'battery',estimated:true,cost_estimated:!!(profile&&!profile.free&&cost!==null)}};
}
DeepalS05Card.prototype._renderChargeCost=function(){
  const card=this._el?.card;if(!this._c||!card)return;
  const demo=!!this._isCompanionPreview;
  let state=this._cc;
  if(state&&state.generation!==this._compGeneration){this._ccDestroy();state=null;}
  const flowing=CC_CURRENT_SENSORS.some(id=>this._n(id)>.5);
  if(flowing)this._ccSeen=Date.now();
  const charging=flowing||(!!this._ccSeen&&(!this._previewSourceHass||this._previewMode==='live')&&(this._s('binary_sensor.charging')==='on'||Date.now()-this._ccSeen<60000));
  /* the end-of-charge prompt and this block are never visible together */
  if(!charging||card.querySelector(':scope > .charge-assignment-prompt')){if(state&&!charging)this._ccDestroy();else card.querySelector('.charge-cost-live')?.remove();return;}
  if(!state){state=this._cc={generation:this._compGeneration,row:null,profiles:null,locations:[],fetching:false,fetched:0,pct:null,editing:false,busy:false,choice:'',timer:0,dead:false,demoProfile:null};}
  if(demo)state.row=ccDemoRow(state.demoProfile);
  else this._ccSchedule(state);
  this._ccPaint(state,demo);
};
DeepalS05Card.prototype._ccSchedule=function(state){
  if(state.fetching||state.dead)return;
  const pct=Math.round(this._n('sensor.battery_level'));
  const due=!state.fetched||Date.now()-state.fetched>=60000||(Number.isFinite(pct)&&pct!==state.pct);
  if(due)this._ccFetch(state,pct);
};
DeepalS05Card.prototype._ccFetch=async function(state,pct=Math.round(this._n('sensor.battery_level'))){
  if(state.fetching||state.dead||!this._rawHass||!this._companion)return;
  state.fetching=true;state.pct=Number.isFinite(pct)?pct:null;
  const generation=this._compGeneration,admin=!!this._rawHass.user?.is_admin;
  try{
    const page=await companionRequest(this._rawHass,this._companion,'sessions_page',{sort:'newest',limit:1});
    if(state.dead||generation!==this._compGeneration)return;
    const row=page?.rows?.[0];state.row=row&&row.live?row:null;state.locations=page?.locations||[];
    if(admin&&(!state.profiles||state.reloadProfiles)){
      const costs=await companionRequest(this._rawHass,this._companion,'costs_get');
      if(state.dead||generation!==this._compGeneration)return;
      state.profiles=costs?.value?.profiles||[];state.reloadProfiles=false;
    }
  }catch(error){/* keep the last values; the next attempt is a minute away or follows a battery change */}
  finally{
    state.fetching=false;state.fetched=Date.now();clearTimeout(state.timer);
    if(!state.dead)state.timer=setTimeout(()=>{if(!state.dead&&this._cc===state)this._renderChargeCost();},60000);
  }
  if(!state.dead&&generation===this._compGeneration)this._ccPaint(state,false);
};
/* The cost chip in the charging block: the amount at a glance; for an admin it opens the location selector. */
DeepalS05Card.prototype._ccChip=function(info){
  const charge=this._el?.charge,slot=charge?.querySelector('[data-cg-cost]');if(!slot)return;
  if(!charge._ccBound){
    charge._ccBound=true;
    charge.addEventListener('click',event=>{
      const chip=event.target.closest('[data-cc-chip]'),state=this._cc;if(!chip||!state?.row||state.busy)return;
      state.editing=!state.editing;state.choice='';this._ccPaint(state,!!this._isCompanionPreview);
    });
  }
  if(!info){slot.innerHTML='';return;}
  const tag=info.admin?'button':'span',attrs=info.admin?' type="button" data-cc-chip aria-label="'+esc(T('Change'))+'" title="'+esc(T('Change'))+'"':'';
  slot.setAttribute('aria-live','polite');
  slot.innerHTML='<'+tag+' class="cg-chip"'+attrs+'>'+ico('plug')+'<b data-cc-chip-amount>'+esc(info.amount)+'</b>'+(info.name?'<small>'+esc(info.name)+'</small>':'')+(info.admin?ico('mdi:pencil-outline'):'')+'</'+tag+'>';
};
DeepalS05Card.prototype._ccPaint=function(state,demo){
  const card=this._el?.card;if(!card||state.dead)return;
  let node=card.querySelector('.charge-cost-live');
  const row=state.row;
  if(!row){node?.remove();this._ccChip(null);return;}
  const admin=!!this._rawHass?.user?.is_admin;
  const lang=this._hass?.locale?.language||'en',currency=this._hass?.config?.currency||'EUR';
  const money=value=>{try{return new Intl.NumberFormat(lang,{style:'currency',currency}).format(value);}catch(error){return new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(value);}};
  const number=new Intl.NumberFormat(lang,{maximumFractionDigits:1});
  const record=row.assignment,profile=record?.profile,pricing=row.pricing||{},assigned=!!profile?.id;
  const estimated=typeof pricing.cost_estimated==='boolean'?pricing.cost_estimated:pricing.estimated===true;
  let amount;
  if(pricing.cost==null)amount=T('Not priced');
  else if(pricing.cost===0&&profile?.free)amount=T('Free');
  else amount=(estimated?'≈ ':'')+money(pricing.cost);
  const parts=[];
  if(assigned){
    parts.push(profile.name||state.locations.find(item=>item.id===profile.id)?.name||profile.id);
    if(!profile.free&&profile.price!=null)parts.push(String(profile.price)+' €/kWh');
    if(pricing.energy!=null)parts.push((pricing.estimated===true?'≈ ':'')+number.format(pricing.energy)+' kWh');
  }
  const sub=assigned?parts.join(' · '):'';
  this._ccChip({amount,name:assigned?parts[0]:'',admin});
  const slot=card.querySelector(':scope > .charging-curve-block [data-curve-cost]');
  /* with the curve: always a slim bar at its foot. Without it: a selector strip that shows while a location is being chosen and fades away once it is saved */
  const showStrip=!!slot||(admin&&(state.editing||(!assigned&&this._c.charge_cost_selector!==false)));
  const showPicker=admin&&(!slot||!assigned||state.editing);
  if(!showStrip){
    if(node&&!node.classList.contains('leaving')){
      node.classList.add('leaving');clearTimeout(state.leaveTimer);
      state.leaveTimer=setTimeout(()=>{if(node.classList.contains('leaving'))node.remove();},320);
    }
    return;
  }
  if(node?.classList.contains('leaving')){node.classList.remove('leaving');clearTimeout(state.leaveTimer);}
  const profiles=demo?CC_DEMO_PROFILES:(state.profiles||state.locations);
  const options=profiles.map(item=>({id:item.id,label:(item.name||item.id)+(item.free?' · '+T('Free'):item.price!=null?' · '+String(item.price)+' €/kWh':'')}));
  const currentId=assigned&&profile.id!=='manual'?profile.id:'';
  const structure=JSON.stringify([admin,assigned,showPicker,state.busy,options,currentId]);
  if(!node){
    node=document.createElement('section');node.className='charge-cost-live';node.setAttribute('aria-label',T('This charge'));
    node.addEventListener('change',event=>{if(event.target.matches('select')){state.choice=event.target.value;this._ccSyncSave(node);}});
    node.addEventListener('click',event=>{
      const button=event.target.closest('[data-cc]');if(!button||button.disabled)return;
      const action=button.dataset.cc;
      if(action==='change'){state.editing=true;state.choice='';this._ccPaint(state,!!this._isCompanionPreview);}
      else if(action==='cancel'){state.editing=false;state.choice='';this._ccPaint(state,!!this._isCompanionPreview);}
      else if(action==='save')this._ccSave(state,node);
    });
  }
  if(slot){if(node.parentNode!==slot)slot.append(node);node.style.order='';}
  else{
    let anchor=this._el.charge;while(anchor&&anchor.parentNode!==card)anchor=anchor.parentNode;
    if(anchor){if(node.parentNode!==card||node.previousElementSibling!==anchor)anchor.after(node);}
    else if(node.parentNode!==card)(card.querySelector(':scope > .foot'))?card.querySelector(':scope > .foot').before(node):card.append(node);
    node.style.order=String(Math.max(0,this._c.order.indexOf('charge')));
  }
  if(node.dataset.structure!==structure){
    node.dataset.structure=structure;
    const keep=state.choice||'';
    node.classList.toggle('pick',showPicker);
    node.innerHTML=ico('plug')+'<div class="cc-main"><b class="cc-amount" data-cc-amount aria-live="polite" aria-atomic="true"></b><span class="cc-sub" data-cc-sub></span></div>'
      +(showPicker?'<select aria-label="'+esc(T('Charging location'))+'"'+(state.busy?' disabled':'')+'><option value="">'+esc(T('Choose a location'))+'</option>'+options.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.label)+'</option>').join('')+'</select><button type="button" class="cc-icon" data-cc="save" aria-label="'+esc(T('Save'))+'" title="'+esc(T('Save'))+'" disabled>'+ico('check')+'</button>'+((assigned||state.editing)?'<button type="button" class="cc-icon" data-cc="cancel" aria-label="'+esc(T('Cancel'))+'" title="'+esc(T('Cancel'))+'">'+ico('close')+'</button>':'')
        :(admin&&assigned?'<button type="button" class="cc-icon" data-cc="change" aria-label="'+esc(T('Change'))+'" title="'+esc(T('Change'))+'">'+ico('mdi:pencil-outline')+'</button>':''));
    if(showPicker){
      const select=node.querySelector('select');select.value=keep&&[...select.options].some(item=>item.value===keep)?keep:currentId;state.choice=select.value;
      this._ccSyncSave(node);window.__DEEPAL_COMPANION_UI?.enhanceChoices(node,this._hass);
    }
  }
  /* text-only updates keep focus and avoid redrawing the block */
  const amountNode=node.querySelector('[data-cc-amount]'),subNode=node.querySelector('[data-cc-sub]');
  if(amountNode.textContent!==amount)amountNode.textContent=amount;
  if(subNode.textContent!==sub)subNode.textContent=sub;
};
DeepalS05Card.prototype._ccSyncSave=function(node){
  const select=node.querySelector('select'),save=node.querySelector('[data-cc=save]');if(!select||!save)return;
  const current=node.dataset.structure?JSON.parse(node.dataset.structure)[5]:'';
  save.disabled=!select.value||select.value===current||select.disabled;
};
DeepalS05Card.prototype._ccSave=async function(state,node){
  const select=node.querySelector('select'),profileId=select?.value;
  if(!profileId||state.busy)return;
  if(this._isCompanionPreview){
    state.demoProfile=CC_DEMO_PROFILES.find(item=>item.id===profileId)||null;state.editing=false;state.choice='';
    this._renderChargeCost();this._toast(T('Demo: location chosen. No costs were saved.'),'ok');return;
  }
  const row=state.row,generation=this._compGeneration;if(!row)return;
  state.busy=true;this._ccPaint(state,false);
  try{
    const record=row.assignment;
    if(!record){
      await companionRequest(this._rawHass,this._companion,'charge_profile_assign',{session_id:row.id,profile_id:profileId});
    }else{
      /* a location correction replaces only the profile: a typed receipt (energy, total) is kept exactly as it is */
      const source=(state.profiles||[]).find(item=>item.id===profileId);
      if(!source)throw Error(T('Choose a charging profile.'));
      const key=String(Math.round(row.s/1000));
      await companionRequest(this._rawHass,this._companion,'costs_set',{changes:{sessions:{[key]:{...record,profile:structuredClone(source)}}},expected_changes:{sessions:{[key]:record}}});
    }
    if(state.dead||generation!==this._compGeneration)return;
    state.editing=false;state.choice='';
  }catch(error){
    if(state.dead||generation!==this._compGeneration)return;
    state.busy=false;
    if(/changed elsewhere/i.test(error.message||''))this._toast(T('Settings changed elsewhere and were reloaded. Please repeat your change.'),'error');
    else this._toast(error.message||String(error),'error');
    state.reloadProfiles=true;state.editing=false;state.choice='';
  }
  if(state.dead||generation!==this._compGeneration)return;
  state.busy=false;state.fetched=0;state.fetching=false;
  await this._ccFetch(state);
};
