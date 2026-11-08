/* Preserve the original complete HA editor; change only its persistence boundary. */
DeepalS05Settings.prototype.disconnectedCallback = function() { I18N.prune(); };
DeepalS05CardEditor.prototype.disconnectedCallback = function() {
  this._editorGeneration=(this._editorGeneration||0)+1;
  I18N.prune();
};
const originalSettingsExport = DeepalS05Settings.prototype._exportObj;
DeepalS05Settings.prototype._exportObj = function() {
  const config=originalSettingsExport.call(this);
  if(this.yamlBase?.vehicle_id)config.vehicle_id=this.yamlBase.vehicle_id;
  if(this.yamlBase?.view_id)config.view_id=this.yamlBase.view_id;
  return config;
};
const originalEditorDraw = DeepalS05CardEditor.prototype._draw;
DeepalS05CardEditor.prototype.setConfig = function(config) {
  if(this._editorLoaded&&config.vehicle_id===this._editorOwner?.vehicle_id&&config.view_id===this._editorOwner?.view_id){this._draw();return;}
  this._editorOwner = {vehicle_id:config.vehicle_id,view_id:config.view_id};
  this._editorGeneration=(this._editorGeneration||0)+1;
  this._config = {...config};
  this._editorLoaded = false;
  this._draw();
  if(this._hass)this._editorLoad();
};
Object.defineProperty(DeepalS05CardEditor.prototype,"hass",{
  set(hass){this._hass=hass;if(this._s)this._s.hass=hass;if(!this._editorLoaded)this._editorLoad();}
});
DeepalS05CardEditor.prototype._editorLoad = async function() {
  if(!this._hass||!this._editorOwner)return;
  if(this._editorLoading){this._editorReload=true;return;}
  this._editorLoading=true;
  const generation=this._editorGeneration;
  try{
    const list=await this._hass.callWS({type:"deepal_companion/request",op:"list"});
    if(generation!==this._editorGeneration)return;
    this._editorVehicles=list;
    if(!this._editorOwner.vehicle_id){
      if(!list.length){this._editorError="Add your vehicle in Deepal Companion first.";this._draw();return;}
      this._editorOwner.vehicle_id=list[0].id;
    }
    const owner={...this._editorOwner};
    const response=await companionRequest(this._hass,owner,"config_get");
    if(generation!==this._editorGeneration)return;
    this._editorOwner.view_id=response.view_id;this._editorViewName=response.view_name;this._editorRevision=response.revision;
    this._config={...response.config,type:"custom:deepal-companion-card",...this._editorOwner};
    this._editorLoaded=true;this._editorError="";this._draw();
    this._editorEmit();
  }catch(error){this._editorError=error.message||String(error);this._draw();console.error("Deepal Companion editor",error);}
  finally{this._editorLoading=false;if(this._editorReload){this._editorReload=false;queueMicrotask(()=>this._editorLoad());}}
};
DeepalS05CardEditor.prototype._editorEmit = function() {
  this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:{type:"custom:deepal-companion-card",...this._editorOwner}},bubbles:true,composed:true}));
};
DeepalS05CardEditor.prototype._editorSelect = function(vehicle,view) {
  this._editorOwner={vehicle_id:vehicle,view_id:view};
  this._editorGeneration=(this._editorGeneration||0)+1;
  this._editorLoaded=false;
  this._editorEmit();this._draw();this._editorLoad();
};
DeepalS05CardEditor.prototype._commit = function() {
  const snapshot=onlySettings(this._config);
  const owner={...this._editorOwner};
  this._editorSave=(this._editorSave||Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!owner.vehicle_id)throw Error("Choose a vehicle in Deepal Companion first.");
    const response=await companionRequest(this._hass,owner,"config_patch",{patch:snapshot,expected_revision:this._editorRevision});
    this._editorRevision=response.revision;
    if(this._editorOwner.vehicle_id===owner.vehicle_id&&this._editorOwner.view_id===owner.view_id){
      this._editorOwner.view_id=response.view_id;this._editorEmit();
    }
  }).catch(error=>{console.error("Deepal Companion editor save",error);if(/changed elsewhere/i.test(error.message||""))this._editorLoad();if(this._s){this._s._note=error.message||String(error);this._s._render();}});
  this._draw();
};
DeepalS05CardEditor.prototype._draw = function() {
  originalEditorDraw.call(this);
  if(!this._editorPicker){
    this._editorPicker=document.createElement("div");
    this._editorPicker.className="companion-card-picker";
    this.shadowRoot.prepend(this._editorPicker);
    this._editorPicker.addEventListener("change",event=>{
      if(event.target.name==="companion_design"){this._config={...this._config,companion_design:event.target.value,companion_width:0};this._commit();return;}
      if(event.target.name==="companion_width"){if(event.target.checkValidity()){this._config={...this._config,companion_width:Number(event.target.value)||0};this._commit();}return;}
      if(event.target.name==="companion_vehicle"){
        const car=(this._editorVehicles||[]).find(v=>v.id===event.target.value);
        if(car)this._editorSelect(car.id,car.views[0]?.id);
      }
    });
    this._editorPicker.addEventListener("click",event=>{
      const button=event.target.closest("[data-companion-view]");
      if(button)this._editorSelect(this._editorOwner.vehicle_id,button.dataset.companionView);
    });
  }
  const lang=this._hass?.locale?.language||this._hass?.language||"en";
  const text=(en,el,es=en)=>lang.startsWith("el")?el:lang.startsWith("es")?es:en;
  const cars=this._editorVehicles||[],car=cars.find(v=>v.id===this._editorOwner?.vehicle_id)||cars[0];
  this._editorPicker.innerHTML='<style>.companion-card-picker{margin-bottom:18px;padding:14px;border:1px solid var(--divider-color);border-radius:14px}.companion-card-picker label{display:block;font-size:12px;color:var(--secondary-text-color)}.companion-card-picker select{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:10px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}.companion-card-picker .profiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px}.companion-card-picker button{cursor:pointer;padding:12px 8px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:11px;font:inherit;font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px}.companion-card-picker button[aria-pressed=true]{border-color:var(--primary-color);background:rgba(45,205,157,.10)}.companion-card-picker p{font-size:12px;line-height:1.5;color:var(--secondary-text-color);margin:10px 0 0}.companion-card-picker .error{color:var(--error-color)}.companion-design-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.companion-design-fields input{width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--divider-color);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}.companion-card-picker button small{font-size:10px;color:var(--secondary-text-color)}</style><label>'+esc(text("Vehicle","Αυτοκίνητο","Vehículo"))+'<select name="companion_vehicle" aria-label="'+esc(text("Vehicle","Αυτοκίνητο","Vehículo"))+'">'+cars.map(v=>'<option value="'+esc(v.id)+'"'+(v.id===car?.id?' selected':'')+'>'+esc(v.name)+'</option>').join("")+'</select></label><label>'+esc(text("Choose a card profile","Επίλεξε προφίλ κάρτας","Elige un perfil de tarjeta"))+'</label><div class="profiles">'+(car?.views||[]).map((v,i)=>'<button type="button" data-companion-view="'+esc(v.id)+'" aria-pressed="'+String(v.id===this._editorOwner?.view_id)+'"><ha-icon icon="'+(["mdi:cellphone","mdi:tablet-dashboard","mdi:chart-line"][i]||"mdi:card-outline")+'"></ha-icon><span>'+esc(v.name)+'</span><small>'+esc(/tablet/i.test(v.name)?'Wide · 960 px':/energy/i.test(v.name)?'Energy first · 720 px':'Compact · 480 px')+'</small></button>').join("")+'</div><p>'+esc(text("The Home Assistant preview updates as you select a profile. All settings remain available below.","Η προεπισκόπηση του Home Assistant ενημερώνεται με την επιλογή προφίλ. Όλες οι ρυθμίσεις παραμένουν διαθέσιμες παρακάτω.","La vista previa de Home Assistant se actualiza al elegir un perfil. Todos los ajustes siguen disponibles debajo."))+'</p>'+(this._editorError?'<p class="error">'+esc(this._editorError)+'</p>':'');
  if(this._editorLoaded){const design=companionDesign(this._config,this._editorViewName);this._editorPicker.insertAdjacentHTML("beforeend",'<div class="companion-design-fields"><label>'+esc(text("Design","Σχεδίαση"))+'<select name="companion_design">'+["mobile","tablet","energy"].map(kind=>'<option value="'+kind+'"'+(design.kind===kind?' selected':'')+'>'+({mobile:"Mobile · compact · 480 px",tablet:"Tablet · landscape · 960 px",energy:"Energy · energy first · 720 px"}[kind])+'</option>').join("")+'</select></label><label>'+esc(text("Maximum width (px)","Μέγιστο πλάτος (px)"))+'<input name="companion_width" type="number" min="280" max="1600" placeholder="'+design.width+'" value="'+(this._config.companion_width||"")+'"></label></div>');}
  if(this._s)this._s.style.pointerEvents=this._editorLoaded?"":"none";
};
