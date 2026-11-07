/* Add the selected profile through HA's stored Lovelace configuration API. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function showDashboardAdd(panel){
  if(!panel._hass.user?.is_admin)throw Error('Administrator access is required to add dashboard cards.');
  if(panel.pending||panel.costs?.dirty)throw Error('Save or cancel your changes first.');
  panel._dashboardDialog?.remove();
  const owner={...panel.selected},hass=panel._hass,profile=panel.vehicles.find(v=>v.id===owner.vehicle_id)?.views.find(v=>v.id===owner.view_id);
  if(!owner.vehicle_id||!owner.view_id)throw Error('Choose a vehicle and card profile first.');
  const native=!!customElements.get('ha-dialog'),dialog=document.createElement(native?'ha-dialog':'dialog');
  dialog.className='dashboard-add-dialog';dialog.setAttribute('aria-label','Add card to dashboard');
  if(native){dialog.heading='Add to dashboard';dialog.hass=hass;}
  dialog.innerHTML=(native?'':'<h2>Add to dashboard</h2>')+'<div class="dashboard-add-body"><p class="note">'+escape(profile?.name||'Selected card profile')+'</p><label>Dashboard<select name="dashboard"><option value="">Loading dashboards…</option></select></label><label>View<select name="dashboard_view" disabled></select></label><p class="note dashboard-placement"></p><p class="dashboard-add-status" role="status"></p></div><div class="dashboard-add-actions"><button type="button" data-dashboard-cancel>Cancel</button><button type="button" data-dashboard-save disabled>Add card</button></div>';
  panel.shadowRoot.append(dialog);panel._dashboardDialog=dialog;
  if(native)dialog.open=true;else dialog.showModal();
  const close=()=>{if(!native&&dialog.open)dialog.close();if(native)dialog.open=false;dialog.remove();if(panel._dashboardDialog===dialog)panel._dashboardDialog=null;};
  dialog.addEventListener('closed',close);dialog.addEventListener('close',()=>{dialog.remove();if(panel._dashboardDialog===dialog)panel._dashboardDialog=null;});
  dialog.querySelector('[data-dashboard-cancel]').addEventListener('click',close);
  const dashboard=dialog.querySelector('[name=dashboard]'),view=dialog.querySelector('[name=dashboard_view]'),save=dialog.querySelector('[data-dashboard-save]'),status=dialog.querySelector('[role=status]'),placement=dialog.querySelector('.dashboard-placement');
  let request=0,current=null,signature='',busy=false;
  const path=()=>dashboard.value==='lovelace'?null:dashboard.value;
  const selected=()=>current?.views?.[Number(view.value)];
  const check=()=>{
    const item=selected();let error='';
    if(!current||current.strategy||!Array.isArray(current.views))error='This dashboard is generated automatically. Take control in Home Assistant or choose another dashboard.';
    else if(!item||item.strategy)error='Choose an editable view.';
    else if((item.type==='panel'||item.panel)&&item.cards?.length)error='This panel view already has a card. Choose another view.';
    save.disabled=busy||!!error;status.textContent=error;
    placement.textContent=!error?(item.type==='sections'||Array.isArray(item.sections)?'The card will be added in a new section.':'The card will be added at the end of this view.'):'';
  };
  const load=async()=>{
    const version=++request;busy=true;save.disabled=true;view.disabled=true;status.textContent='Loading views…';
    try{
      const config=await hass.callWS({type:'lovelace/config',url_path:path(),force:true});
      if(version!==request||!dialog.isConnected)return;
      current=config;signature=JSON.stringify(config);view.innerHTML=(config.views||[]).map((item,index)=>'<option value="'+index+'">'+escape(item.title||item.path||'View '+(index+1))+'</option>').join('');
      view.disabled=false;view.value='0';busy=false;check();window.__DEEPAL_COMPANION_UI.enhanceChoices(dialog,hass);
    }catch(error){if(version!==request||!dialog.isConnected)return;busy=false;current=null;save.disabled=true;status.textContent=error.message||String(error);}
  };
  dashboard.addEventListener('change',load);view.addEventListener('change',check);
  save.addEventListener('click',async()=>{
    if(busy||save.disabled)return;
    const url=path(),index=Number(view.value),expected=signature;busy=true;save.disabled=true;dashboard.disabled=true;view.disabled=true;dialog.querySelector('[data-dashboard-cancel]').disabled=true;window.__DEEPAL_COMPANION_UI.enhanceChoices(dialog,hass);status.textContent='Adding card…';
    try{
      await panel.request('config_get',{},owner);
      const fresh=await hass.callWS({type:'lovelace/config',url_path:url,force:true});
      if(!dialog.isConnected)return;
      if(JSON.stringify(fresh)!==expected){await load();throw Error('The dashboard changed while this dialog was open. Check the view and try again.');}
      const config=structuredClone(fresh),target=config.views?.[index];
      if(!target||target.strategy||config.strategy)throw Error('Choose an editable view.');
      if((target.type==='panel'||target.panel)&&target.cards?.length)throw Error('This panel view already has a card.');
      const card={type:'custom:deepal-companion-card',vehicle_id:owner.vehicle_id,view_id:owner.view_id};
      if(target.type==='sections'||Array.isArray(target.sections)){target.sections=[...(target.sections||[]),{type:'grid',cards:[card]}];}
      else target.cards=[...(target.cards||[]),card];
      await hass.callWS({type:'lovelace/config/save',url_path:url,config});
      close();panel.status('Card added to dashboard','success');
    }catch(error){if(dialog.isConnected){busy=false;dashboard.disabled=false;view.disabled=false;dialog.querySelector('[data-dashboard-cancel]').disabled=false;check();status.textContent=error.message||String(error);window.__DEEPAL_COMPANION_UI.enhanceChoices(dialog,hass);}}
  });
  try{
    const rows=await hass.callWS({type:'lovelace/dashboards/list'});if(!dialog.isConnected)return;
    const dashboards=[{url_path:'lovelace',title:hass.panels?.lovelace?.title||'Overview',mode:'storage'},...rows.filter(row=>row.url_path!=='lovelace'&&row.mode==='storage')];
    dashboard.innerHTML=dashboards.map(row=>'<option value="'+escape(row.url_path)+'">'+escape(row.title||row.url_path)+'</option>').join('');
    dashboard.value=dashboards[0].url_path;window.__DEEPAL_COMPANION_UI.enhanceChoices(dialog,hass);await load();
  }catch(error){if(dialog.isConnected)status.textContent=error.message||String(error);}
}
