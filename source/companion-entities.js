const companionSettingsAppCss='.tabbar{position:static}.tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;cursor:default;gap:6px}@media(min-width:1500px){.tabs{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:999px){.tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}.tabs .vpill,.tn{display:none!important}.tabs button{min-width:0;white-space:normal;min-height:46px;justify-content:flex-start;border-radius:10px;padding:9px 10px;text-align:left;font-size:12px}.tabs button .i{flex:none}.tabs.hp>button.on{background:rgba(var(--ds-info),.18);border-color:rgba(var(--ds-info),.45)}input:not([type=checkbox]):not([type=color]),select{height:44px;min-height:44px;max-height:44px;box-sizing:border-box}input:not([type=checkbox]):not([type=color]),select{font-size:14px}.opt{flex-wrap:wrap;gap:10px}.opt .ol{min-width:0}.seg{flex-wrap:wrap}.sw-c{min-height:44px}.sw-c input[type=color]{min-height:30px;max-height:30px;width:40px;height:30px;border-radius:6px}.lvhead,.lvrow{grid-template-columns:minmax(0,1fr) 76px 76px;gap:8px}@media(max-width:420px){.tabs{grid-template-columns:minmax(0,1fr)}.lvhead,.lvrow{grid-template-columns:minmax(0,1fr) 62px 62px}.lvrow input[type=number]{padding:8px 4px}.sw-c{gap:8px;font-size:12px}.sw-c input[type=color]{flex-basis:34px;width:34px}}';
/* Use HA names/selectors while keeping the stable mapping keys in storage. */
const settingsConnected=DeepalS05Settings.prototype.connectedCallback;
const settingsDisconnected=DeepalS05Settings.prototype.disconnectedCallback;
DeepalS05Settings.prototype.connectedCallback=function(){settingsConnected.call(this);I18N.subs.add(this);};
DeepalS05Settings.prototype.disconnectedCallback=function(){I18N.subs.delete(this);settingsDisconnected.call(this);};
DeepalS05Settings.prototype._force=function(){if(this.isConnected&&this._cfg)this._render();};
Object.defineProperty(DeepalS05Settings.prototype,"hass",{set(hass){this._hass=hass;if(!hass)return;I18N.request(hass.locale?.language||hass.language||"en");const picker=this.shadowRoot.querySelector("ha-selector[data-entity-mapping]");if(picker)picker.hass=hass;}});
DeepalS05Settings.prototype._entityRoleName=function(key,config){
  const id=resolveId(this._hass,config,key);
  const name=this._hass?.states?.[id]?.attributes?.friendly_name||this._hass?.entities?.[id]?.name;
  if(name)return name;
  const label=(key.split(".")[1]||key).replaceAll("_"," ");return label.charAt(0).toUpperCase()+label.slice(1);
};
const settingsBind=DeepalS05Settings.prototype._bind;
const settingsLayout=DeepalS05Settings.prototype._tabLayout;
DeepalS05Settings.prototype._tabLayout=function(config){
  if(this.mode==="app")return settingsLayout.call(this,config);
  const lang=this._hass?.locale?.language||"en",tr=(en,el,es=en)=>lang.startsWith("el")?el:lang.startsWith("es")?es:en;
  return '<h4>'+ico('sliders')+esc(tr("Card design","Σχεδίαση κάρτας","Diseño de la tarjeta"))+'</h4>'+this._opt(tr("Design","Σχεδίαση","Diseño"),this._sel("companion_design",config.companion_design||"",[["",tr("Profile default","Προεπιλογή προφίλ","Predeterminado del perfil")],["mobile","Mobile"],["tablet","Tablet"],["energy","Energy"],["minimal",tr("Minimal","Ελάχιστη","Mínima")],["cockpit",tr("Modern Cockpit","Modern Cockpit","Cockpit moderno")],["ultra",tr("Ultra minimal","Εξαιρετικά ελάχιστη","Ultra mínima")]]))+this._opt(tr("Maximum width (px)","Μέγιστο πλάτος (px)","Ancho máximo (px)"),this._num("companion_width",config.companion_width||0,"1"),tr("0 = automatic; otherwise 280–1600 px.","0 = αυτόματα· διαφορετικά 280–1600 px.","0 = automático; si no, 280–1600 px."))+settingsLayout.call(this,config);
};
DeepalS05Settings.prototype._bind=function(){
  settingsBind.call(this);
  window.__DEEPAL_COMPANION_UI?.enhanceChoices(this.shadowRoot,this._hass);
  {
    const style=document.createElement('style');
    style.textContent=companionSettingsAppCss+(this.mode==='app'?':host{overflow:visible;max-height:none}.hd,.tabbar{touch-action:pan-y}.settings{overflow:visible;max-height:none}':'');
    this.shadowRoot.append(style);
  }
  const picker=this.shadowRoot.querySelector("ha-selector[data-entity-mapping]");if(!picker)return;
  const setup=()=>{picker.hass=this._hass;picker.selector={entity:this._form.mkey?{domain:this._form.mkey.split(".")[0]}:{}};picker.value=this._form.ment||undefined;};
  setup();this.shadowRoot.querySelector('[data-set="_mkey"]')?.setAttribute("data-ha-name","");
  picker.addEventListener("value-changed",event=>{event.stopPropagation();this._form.ment=typeof event.detail?.value==="string"?event.detail.value:"";const note=this.shadowRoot.querySelector("[data-mapping-id]");if(note)note.textContent=this._form.ment;});
  this.shadowRoot.querySelector('[data-set="_mkey"]')?.addEventListener("change",setup);
  if(!customElements.get("ha-selector")){
    picker.hidden=true;
    const fallback=document.createElement("input");fallback.type="text";fallback.setAttribute("list","ents");fallback.value=this._form.ment;
    fallback.addEventListener("input",()=>{this._form.ment=fallback.value;});picker.after(fallback);
  }
};
