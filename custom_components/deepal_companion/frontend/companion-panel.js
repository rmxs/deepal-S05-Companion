import {bindProfileField,syncProfileDesign} from './profile-field.js?v=0.1.0';
import {costFrame,costCardContent,applyCostDesign,updateCostHeader,renderSessionList} from './companion-cost-design.js?v=0.1.0';
import "/deepal_companion/frontend/companion-card.js?v=0.1.0";

const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SESSION_PAGE_SIZE = 6;
const tabFragments={card:'settings',charging:'chargers',costs:'history',notifications:'notifications'};
const modeFromHash=()=>tabFragments[location.hash.slice(1)]||null;
class DeepalCompanionPanel extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:"open"});this.vehicles=[];this.selected={};this.mode=modeFromHash()||"settings";this.tab="layout";this.message="";this.queue=Promise.resolve();
    const UI=window.__DEEPAL_COMPANION_UI,style=document.createElement('style'),boot=document.createElement('div');this.stylesReady=false;
    style.textContent=':host{display:block;background:var(--primary-background-color);color:var(--primary-text-color)}.companion-surface[hidden],.companion-boot[hidden]{display:none!important}.companion-boot{display:grid;place-items:center;min-height:220px;font-family:var(--paper-font-body1_-_font-family,Arial)}'+UI.loaderCss;
    boot.className='companion-boot';boot.setAttribute('aria-label','Loading Deepal Companion');boot.innerHTML=UI.loaderHtml('sliders');this.shadowRoot.append(style,boot);
    this.shadowRoot.addEventListener("click",e=>this.click(e));
    this.shadowRoot.addEventListener("keydown",e=>{if(e.target.name==="profile_name"&&e.key==="Enter"){e.preventDefault();e.target.blur();}});
    this.shadowRoot.addEventListener("change",e=>{
      if(e.target.name==="vehicle"){const car=this.vehicles.find(v=>v.id===e.target.value);if(car)this.select(car.id,car.views[0]?.id);}
      if(e.target.name==="view")this.select(this.selected.vehicle_id,e.target.value);
      if(e.target.name==="profile_name"&&!e.target.parentElement.dataset.picking)this.renameProfile(e.target);
      if(e.target.name==="session_location")this.filterSessions(e.target.value);
      if(e.target.name==="session_sort")this.filterSessions(this.sessionLocation||"",e.target.value);
      if(e.target.name==="preview_clicks"){this.previewClicks=e.target.checked;window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode||"live",this.previewClicks);this.updatePreviewNote();}
      if(e.target.name==="preview_mode"){this.previewMode=e.target.value;window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode);const note=this.shadowRoot.querySelector(".preview-mode-note");if(note)note.textContent=this.previewMode==="live"?this.t("Showing live vehicle data.","Ζωντανά δεδομένα οχήματος."):this.t("Simulated preview · the real vehicle is unchanged.","Προσομοίωση · το πραγματικό όχημα δεν αλλάζει.");}
      if(e.target.name==="simple_action"){const hidden=new Set(this.config.buttons_hidden||[]);e.target.checked?hidden.delete(e.target.value):hidden.add(e.target.value);this.patch({buttons_hidden:[...hidden]});}
      if(e.target.name==="simple_confirm"){if(!e.target.checked&&this.config.confirm?.length)this.lastConfirm=[...this.config.confirm];this.patch({confirm:e.target.checked?(this.lastConfirm||["unlock","trunk","windows","lock","climate"]):[]});}
      if(e.target.name==="simple_hero_style")this.patch({hero_style:e.target.value});
      if(e.target.name==="simple_car_color")this.patch({car_color:e.target.value});
      if(e.target.name==="simple_hero_sky")this.patch({hero_sky:e.target.value});
      if(e.target.name==="companion_design")this.patch({companion_design:e.target.value,companion_width:0});
      if(e.target.name==="companion_width"){
        const width=Number(e.target.value);
        e.target.setCustomValidity(Number.isFinite(width)&&(width===0||width>=280&&width<=1600)?'':'Use 0 for automatic, or 280–1600 pixels.');
        if(e.target.reportValidity())this.patch({companion_width:width});
      }
      if(e.target.name==="preview_mode")this.updatePreviewNote();
    });
  }
  syncModeHash(replace=false){const hash='#'+Object.keys(tabFragments).find(key=>tabFragments[key]===this.mode);if(location.hash!==hash)history[replace?'replaceState':'pushState'](history.state,'',location.pathname+location.search+hash);}
  async navigateMode(mode,fromHistory=false){
    if(mode===this.mode)return;
    if(!Object.values(tabFragments).includes(mode))return;
    if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status('Save or cancel your changes first.','warning');if(fromHistory)this.syncModeHash(true);return;}
    if(!fromHistory){const previous=this.mode;this.mode=mode;this.syncModeHash();this.mode=previous;}
    const request=this.navigationVersion=(this.navigationVersion||0)+1;this.mode=mode;this.render();this.scrollTop=0;
    const stage=this.shadowRoot.querySelector('.stage');stage.classList.add('is-loading');stage.setAttribute('aria-busy','true');
    try{await Promise.all([this.mount(),new Promise(resolve=>setTimeout(resolve,1000))]);}
    finally{if(request===this.navigationVersion){const active=this.shadowRoot.querySelector('.stage');active?.classList.remove('is-loading');active?.removeAttribute('aria-busy');}}
  }
  async renameProfile(field){
    const name=field.value.trim(),owner={...this.selected},current=this.vehicles.find(v=>v.id===owner.vehicle_id)?.views.find(v=>v.id===owner.view_id);
    if(!name){field.value=current?.name||"";this.status(this.t("Enter a profile name.","Συμπλήρωσε όνομα προφίλ."));return;}
    if(name===current?.name)return;this.pending=(this.pending||0)+1;this.status(this.t("Saving…","Αποθήκευση…"),"saving");
    this.queue=this.queue.catch(()=>{}).then(()=>this.request("view",{action:"rename",name},owner)).then(async()=>{this.listSignature=null;await this.refresh();this.status(this.t("Saved","Αποθηκεύτηκε","Guardado"),"success");}).catch(error=>{if(field.isConnected)field.value=current?.name||'';this.status(error.message||String(error));}).finally(()=>this.pending--);return this.queue;
  }
  t(en,el=en,es=en){const lang=this._hass?.locale?.language||"en";return lang.startsWith("el")?el:lang.startsWith("es")?es:en;}
  set hass(hass){
    this._hass=hass;
    if(this.settings)this.settings.hass=hass;
    if(this.preview)window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,hass,this.previewMode||"live");
    if(this.context)window.__DEEPAL_COMPANION_UI.context(hass,this.selected,this.config||{},this.context);
    if(!this.loaded){this.loaded=true;this.refresh();}
  }
  connectedCallback(){window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config||{});this.hashListener=()=>{const mode=modeFromHash()||'settings';if(mode!==this.mode){if(this.selected.vehicle_id)this.navigateMode(mode,true);else this.mode=mode;}};window.addEventListener('hashchange',this.hashListener);this.syncModeHash(true);if(this._hass)this.refresh();}
  disconnectedCallback(){window.removeEventListener('hashchange',this.hashListener);this.sessionDialog?.remove();this.localBoard?.destroy();this._dashboardDialog?.remove();this._dashboardDialog=null;clearTimeout(this.statusTimer);this.context?._compEnergyHost?.energyCleanup?.();this.mountRevision=(this.mountRevision||0)+1;this.unsubscribe?.();this.unsubscribe=null;this.previewObserver?.disconnect();window.removeEventListener("resize",this.previewWindowResize);this.previewWindowResize=null;}
  request(op,data={},owner=this.selected){
    return this._hass.callWS({type:"deepal_companion/request",op,vehicle_id:owner.vehicle_id,view_id:owner.view_id,data});
  }
  async refresh(){
    if(!this._hass||this.fetching){this.refreshAgain=true;return;}
    this.fetching=true;
    try{
      const rows=await this._hass.callWS({type:"deepal_companion/request",op:"list"});
      if(!this.isConnected)return;
      const changed=JSON.stringify(rows.map(v=>({id:v.id,name:v.name,views:v.views.map(p=>({id:p.id,name:p.name}))})))!==this.listSignature;
      this.listSignature=JSON.stringify(rows.map(v=>({id:v.id,name:v.name,views:v.views.map(p=>({id:p.id,name:p.name}))})));
      this.vehicles=rows;
      const car=rows.find(v=>v.id===this.selected.vehicle_id)||rows[0],view=car?.views.find(v=>v.id===this.selected.view_id)||car?.views[0];
      if(car&&view)this.selected={vehicle_id:car.id,view_id:view.id};
      if(changed||!this.shadowRoot.querySelector("main")){this.render();await this.mount();}
      else if(this.mode==="settings"&&!this.pending)await this.loadConfig();
      else if(this.mode==="chargers"&&this.costs&&!this.costs.dirty){
        const previous=JSON.stringify(this.costs.data);await this.costs.load();
        if(JSON.stringify(this.costs.data)!==previous)this.costs.renderEditor();
      }
      if(!this.unsubscribe&&this.isConnected){const unsubscribe=await this._hass.connection.subscribeMessage(message=>{
        if(!this.selected.vehicle_id||message.vehicle_id===this.selected.vehicle_id)this.refresh();
      },{type:"deepal_companion/subscribe"});if(this.isConnected)this.unsubscribe=unsubscribe;else unsubscribe();}
    }catch(error){this.status(error.message||String(error));}
    finally{this.fetching=false;if(this.refreshAgain){this.refreshAgain=false;queueMicrotask(()=>this.refresh());}}
  }
  async select(vehicle,view){
    if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){
      this.status(this.t("Save your changes before switching profiles.","Αποθήκευσε τις αλλαγές πριν αλλάξεις προφίλ."));
      const vehicle=this.shadowRoot.querySelector('[name=vehicle]'),profile=this.shadowRoot.querySelector('[name=view]');
      if(vehicle)vehicle.value=this.selected.vehicle_id;if(profile)profile.value=this.selected.view_id;
      return;
    }
    if(this.selected.vehicle_id!==vehicle)this.sessionLocation="";
    this.selected={vehicle_id:vehicle,view_id:view};this.config=null;this.render();await this.mount();
  }
  render(){
    const car=this.vehicles.find(v=>v.id===this.selected.vehicle_id),view=car?.views.find(v=>v.id===this.selected.view_id),admin=!!this._hass?.user?.is_admin,isSettings=this.mode==="settings";
    this.sessionDialog?.remove();this.sessionDialog=null;this.previewObserver?.disconnect();window.removeEventListener("resize",this.previewWindowResize);this.previewWindowResize=null;this.preview=null;
    this.context?._compEnergyHost?.energyCleanup?.();this.localBoard?.destroy();this.localBoard=null;this.settings=null;this.costs=null;this.context=null;this.mountRevision=(this.mountRevision||0)+1;
    const nav=[
      ["settings",this.t("Card Settings","Ρυθμίσεις κάρτας","Ajustes de tarjeta"),"mdi:card-account-details-outline"],
      ["notifications",this.t("Notifications","Ειδοποιήσεις","Notificaciones"),"mdi:bell-outline"],
      ["history",this.t("Sessions","Συνεδρίες","Sesiones"),"mdi:history"],
      ["chargers",this.t("Charging Profiles","Προφίλ φόρτισης","Perfiles de carga"),"mdi:ev-station"]
    ];
    const vehicleField=this.vehicles.length===1?'<p class="vehicle-name">'+escape(car?.name)+'</p>':'<label>'+escape(this.t("Vehicle","Αυτοκίνητο","Vehículo"))+'<select name="vehicle">'+this.vehicles.map(v=>'<option value="'+escape(v.id)+'"'+(v.id===car?.id?" selected":"")+'>'+escape(v.name)+'</option>').join("")+'</select></label>';
    const selector='<label class="profile-selector">'+escape(this.t("Card profile","Προφίλ κάρτας","Perfil de tarjeta"))+'<select name="view">'+(car?.views||[]).map(v=>'<option value="'+escape(v.id)+'"'+(v.id===view?.id?' selected':'')+'>'+escape(v.name)+'</option>').join("")+'</select></label>';
    const actions=[["duplicate","mdi:content-copy",this.t("Duplicate","Αντιγραφή")],["create","mdi:plus",this.t("New profile","Νέο προφίλ")],["delete","mdi:trash-can-outline",this.t("Delete","Διαγραφή")]];
    const management=admin&&view?'<div class="profile-controls">'+selector+'<label class="profile-name">'+escape(this.t("Card profile","Προφίλ κάρτας"))+'<div class="profile-editable"><input name="profile_name" aria-label="Card profile" value="'+escape(view.name)+'" maxlength="100" autocomplete="off"><button type="button" data-profile-choose aria-label="Choose profile" aria-haspopup="listbox"><ha-icon icon="mdi:chevron-down"></ha-icon></button></div></label><div class="actions">'+actions.map(([action,icon,label])=>'<button data-action="'+action+'"><ha-icon icon="'+icon+'"></ha-icon>'+escape(label)+'</button>').join("")+'</div></div>':selector;
    const profileDesign='<section class="profile-design"><h3><ha-icon icon="mdi:tune-variant"></ha-icon>Card design</h3><label><span>Design</span><select name="companion_design">'+[['','Profile default'],['mobile','Mobile'],['tablet','Tablet'],['energy','Energy']].map(([value,label])=>'<option value="'+value+'"'+((this.config?.companion_design||'')===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label><span>Maximum width (px)</span><input name="companion_width" type="number" min="0" max="1600" step="1" placeholder="0" value="'+(this.config?.companion_width||'')+'"><small>0 = automatic · 280–1600 px</small></label></section>';
    const profileField=isSettings?management+profileDesign:"";
    let setup;
    if(isSettings){setup='<section class="box profile-setup"><h2><ha-icon icon="mdi:card-account-details-outline" aria-hidden="true"></ha-icon>'+escape(this.t("Profile","Προφίλ κάρτας"))+'</h2>'+(this.vehicles.length>1?vehicleField:"")+profileField+'</section>';}else setup=this.vehicles.length>1?'<section class="box profile-setup">'+vehicleField+'</section>':"";
    const preview=isSettings&&car?'<section class="box live-preview"><div class="preview-heading"><h2><ha-icon icon="mdi:eye-outline" aria-hidden="true"></ha-icon>'+escape(this.t("Live preview","Ζωντανή προεπισκόπηση"))+'</h2><label class="preview-click-toggle"><ha-icon icon="mdi:cursor-default-click-outline"></ha-icon><span>'+escape(this.t('Allow clicks','Να επιτρέπονται κλικ'))+'</span><input type="checkbox" name="preview_clicks"'+(this.previewClicks?' checked':'')+'></label></div><label class="preview-scenario">'+escape(this.t('Preview state','Κατάσταση προεπισκόπησης'))+'<select name="preview_mode">'+[['live','Live'],['parked','Parked'],['plugged','Plugged in'],['ac','AC charging'],['dc','DC charging'],['complete','Charge complete'],['alerts','Alerts'],['doors','Doors & boots open'],['climate','Climate on']].map(([value,label])=>'<option value="'+value+'"'+(value===(this.previewMode||'live')?' selected':'')+'>'+escape(label)+'</option>').join('')+'</select></label><p class="preview-mode-note note">'+escape(this.previewMode&&this.previewMode!=='live'?this.t('Simulated preview · the real vehicle is unchanged.','Προσομοίωση · το πραγματικό όχημα δεν αλλάζει.'):this.t('Showing live vehicle data.','Ζωντανά δεδομένα οχήματος.'))+'</p><div class="preview-window" role="img" aria-label="Card appearance preview"></div><p class="note preview-support-note">'+escape(this.t("Colours and buttons update immediately.","Τα χρώματα και τα κουμπιά ενημερώνονται αμέσως."))+'</p><div class="companion-support"><a href="https://buymeacoffee.com/leftk" target="_blank" rel="noopener noreferrer" aria-label="Support Lefteris on Buy Me a Coffee (opens in a new tab)"><img src="/deepal_companion/frontend/support/buy-me-a-coffee.png" alt="Buy me a coffee" width="157" height="44" loading="lazy" decoding="async"></a></div></section>':"";
    if(!this.shadowRoot.querySelector('link[rel=stylesheet]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/deepal_companion/frontend/companion-panel.css?v=0.1.0&rev=support-2';link.addEventListener('load',()=>{this.stylesReady=true;window.__DEEPAL_COMPANION_UI.enhanceChoices(this.shadowRoot,this._hass);this.shadowRoot.querySelector('.companion-surface')?.removeAttribute('hidden');this.shadowRoot.querySelector('.companion-boot').hidden=true;this.previewWindowResize?.();});link.addEventListener('error',()=>{const boot=this.shadowRoot.querySelector('.companion-boot');boot.replaceChildren();const message=document.createElement('p'),retry=document.createElement('button');message.textContent='Dashboard styles could not be loaded.';retry.textContent='Try again';retry.onclick=()=>{link.remove();boot.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('sliders');this.render();this.mount();};boot.append(message,retry);});this.shadowRoot.append(link);}
    let surface=this.shadowRoot.querySelector('.companion-surface');if(!surface){surface=document.createElement('div');surface.className='companion-surface';this.shadowRoot.append(surface);}
    surface.hidden=!this.stylesReady;
    surface.innerHTML='<header><button class="menu" data-action="menu" aria-label="Menu">☰</button><h1><span class="app-title">Deepal Companion</span><span class="vehicle-title">'+escape(car?.name||"")+'</span></h1><ha-icon icon="mdi:car-electric"></ha-icon></header><nav>'+nav.map(([mode,label,icon])=>'<button data-mode="'+mode+'" aria-pressed="'+String(this.mode===mode)+'"><ha-icon icon="'+icon+'" aria-hidden="true"></ha-icon><span>'+escape(label)+'</span></button>').join("")+'</nav><p class="status" role="status">'+escape(this.message)+'</p><main class="'+(isSettings?"settings-layout":"single-layout")+'">'+setup+preview+'<section class="stage"><p class="note">'+escape(car?this.t("Loading…","Φόρτωση…"):this.t("Add a Deepal vehicle to begin.","Πρόσθεσε ένα αυτοκίνητο Deepal για να ξεκινήσεις."))+'</p></section>'+'</main>';
    const credit=document.createElement('div');credit.className='app-credit';credit.textContent='v'+window.__DEEPAL_COMPANION_UI.version+' · '+window.__DEEPAL_COMPANION_UI.credit;surface.querySelector('header').insertBefore(credit,surface.querySelector('header>ha-icon'));
    if(isSettings&&admin&&view){const add=document.createElement('button');add.className='header-add-dashboard';add.dataset.action='add-dashboard';add.title='Add to dashboard';add.innerHTML='<ha-icon icon="mdi:plus"></ha-icon><span>Add to dashboard</span>';surface.querySelector('header>ha-icon').replaceWith(add);}
    window.__DEEPAL_COMPANION_UI.enhanceChoices(this.shadowRoot,this._hass);bindProfileField(this);
  }
  status(message,kind="info"){
    if(kind==='info'&&/save.*changes|save or cancel/i.test(message||''))kind='warning';
    clearTimeout(this.statusTimer);this.message=message;this.unsavedWarning=/Save .*changes|Αποθήκευσε/.test(message);
    const node=this.shadowRoot.querySelector(".status");if(node){node.textContent=message;node.hidden=!message;node.dataset.kind=kind;}
    if(message&&kind==="success")this.statusTimer=setTimeout(()=>this.status(""),2000);
  }
  async mount(){
    if(!this.selected.vehicle_id)return;
    const revision=this.mountRevision=(this.mountRevision||0)+1;
    this.localBoard?.destroy();this.localBoard=null;
    this.context?._compEnergyHost?.energyCleanup?.();
    this.previewObserver?.disconnect();window.removeEventListener('resize',this.previewWindowResize);this.previewWindowResize=null;
    this.preview?.remove();this.preview=null;this.settings=null;this.costs=null;this.context=null;
    try{
      const response=await this.request("config_get");
      if(revision!==this.mountRevision)return;
      this.config=response.config;
      window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
      this.context=window.__DEEPAL_COMPANION_UI.context(this._hass,this.selected,this.config);
      const stage=this.shadowRoot.querySelector(".stage");stage.innerHTML="";
      if(this.mode==="settings"){
        const widget=document.createElement(window.__DEEPAL_COMPANION_UI.settingsTag);
        widget.mode="card";widget.tab=this.tab;widget.hass=this._hass;
        widget.yamlBase={...this.config,type:"custom:deepal-companion-card",...this.selected};
        widget.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);
        widget.onTab=tab=>{this.tab=tab;};
        const widgetOwner={...this.selected};
        widget.onPatch=patch=>this.patch(patch,false,widgetOwner);
        widget.onReset=()=>this.patch({},true,widgetOwner);
        this.settings=widget;window.__DEEPAL_COMPANION_UI.mountAppSettings(this,stage,widget,response.view_name);this.setupPreview();syncProfileDesign(this);window.__DEEPAL_COMPANION_UI.updateAppSettings(this);
      }else if(this.mode==="notifications"){
        const module=await import("./companion-notifications.js?v=0.1.0");if(revision!==this.mountRevision)return;const board=await module.mountNotifications(this,stage);if(revision!==this.mountRevision){board?.destroy();return;}this.localBoard=board;
      }else if(this.mode==="chargers"){
        await window.__DEEPAL_COMPANION_UI.loadEnergy();
        if(revision!==this.mountRevision)return;
        const energy=window.__DEEPAL_COMPANION_ENERGY;
        if(!energy?.ChargingCosts)throw Error(this.t("Charging settings could not be loaded.","Δεν φορτώθηκαν οι ρυθμίσεις φόρτισης."));
        const host=document.createElement("div");host.className="enpanel charging-settings";
        host.innerHTML="<style>"+energy.styles+'</style><div class="cc-editor"></div>';
        stage.append(host);
        const manager=new energy.ChargingCosts(this.context,host);this.costs=manager;manager.onSaved=()=>this.status(this.t("Saved","Αποθηκεύτηκε","Guardado"),"success");manager.onCanceled=()=>this.status(this.t("Changes canceled","Οι αλλαγές ακυρώθηκαν","Cambios cancelados"),"success");manager.onDirtyChange=dirty=>{if(!dirty&&this.unsavedWarning)this.status("");};await manager.ready;
        if(revision!==this.mountRevision)return;
        manager.editor="profiles";manager.editorNode=host.querySelector(".cc-editor");
        manager.model={chg:[],days:[],t0:Date.now(),now:Date.now()};
        manager.ctx={cap:this.context._battKwh(),fmt:{hm:()=>""}};
        manager.history=async()=>{};manager.decorate=()=>manager.renderEditor();
        manager.renderEditor();
      }else {await window.__DEEPAL_COMPANION_UI.loadEnergy();if(revision!==this.mountRevision)return;await this.showHistory(stage,revision);if(revision===this.mountRevision)this.attachHistoryEditor(stage);}
    }catch(error){if(revision!==this.mountRevision)return;this.status(error.message||String(error));const stage=this.shadowRoot.querySelector('.stage');if(stage){stage.innerHTML='<section class="box"><p role="alert">'+escape(/Unknown Companion operation/i.test(error.message||String(error))?'Restart Home Assistant to load the updated Companion backend, then try again.':error.message||String(error))+'</p><button data-action="retry-page">Try again</button></section>';}}
  }
  async loadConfig(){
    const owner={...this.selected},response=await this.request("config_get");
    if(owner.vehicle_id!==this.selected.vehicle_id||owner.view_id!==this.selected.view_id||this.pending)return;
    if(JSON.stringify(this.config)===JSON.stringify(response.config))return;
    this.config=response.config;syncProfileDesign(this);
    window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
    if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
    window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
  }
  updatePreviewNote(){
    const note=this.shadowRoot.querySelector('.preview-mode-note'),frame=this.shadowRoot.querySelector('.preview-window');
    if(note)note.textContent=this.previewMode&&this.previewMode!=='live'?this.t('Demo preview · no vehicle commands.','Δοκιμαστική προεπισκόπηση · χωρίς εντολές στο όχημα.'):this.previewClicks?this.t('Live controls enabled · actions affect your vehicle.','Ζωντανά χειριστήρια · οι εντολές επηρεάζουν το όχημα.'):this.t('Showing live vehicle data.','Ζωντανά δεδομένα οχήματος.');
    if(frame)frame.setAttribute('role',this.previewClicks?'group':'img');
  }
  setupPreview(){
    const frame=this.shadowRoot.querySelector(".preview-window");if(!frame)return;
    this.preview=window.__DEEPAL_COMPANION_UI.preview(this._hass,this.selected,{...this.config,companion_design:window.__DEEPAL_COMPANION_UI.design(this.config,this.vehicles.find(v=>v.id===this.selected.vehicle_id)?.views.find(v=>v.id===this.selected.view_id)?.name).kind});frame.append(this.preview);
    window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode||"live",!!this.previewClicks);
    const previewOwner={...this.selected};this.preview._patch=patch=>this.patch(patch,false,previewOwner);this.preview._resetLocal=()=>this.patch({},true,previewOwner);this.updatePreviewNote();
    const preview=this.preview;
    const resize=()=>{
      if(this.preview!==preview||!frame.isConnected)return;
      const width=frame.clientWidth||400,height=preview.offsetHeight||560,cardWidth=preview.offsetWidth||560;
      const mobile=window.matchMedia("(max-width:760px)").matches,section=frame.closest('.live-preview');
      const scale=Math.min(1,width/cardWidth);
      preview.style.transform="scale("+scale+")";
      preview.style.left=String(Math.max(0,(width-cardWidth*scale)/2))+"px";
      frame.style.height=String(Math.ceil(height*scale))+"px";
      // A taller card scrolls naturally, then stays reachable at the viewport's bottom.
      if(section)section.style.top=mobile?'auto':Math.min(76,Math.min(innerHeight,this.clientHeight||innerHeight)-section.offsetHeight-16)+'px';
    };
    resize();this.previewObserver=new ResizeObserver(resize);this.previewObserver.observe(frame);this.previewObserver.observe(preview);if(frame.closest(".live-preview"))this.previewObserver.observe(frame.closest(".live-preview"));this.previewWindowResize=resize;window.addEventListener("resize",resize);
  }
  patch(patch,reset=false,target=this.selected){
    const owner={...target},key=JSON.stringify(owner);
    this.saveBatches??=new Map();
    let batch=this.saveBatches.get(key);
    if(!batch){batch={pending:0,confirmed:structuredClone(this.config||{})};this.saveBatches.set(key,batch);}
    batch.pending++;this.pending=(this.pending||0)+1;
    const selected=owner.vehicle_id===this.selected.vehicle_id&&owner.view_id===this.selected.view_id;
    if(!reset&&selected){this.config={...this.config,...patch};syncProfileDesign(this);window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);if(this.settings)this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);}
    this.status(this.t("Saving…","Αποθήκευση…"),"saving");
    this.queue=this.queue.catch(()=>{}).then(async()=>{
      const response=await this.request("config_patch",{patch,reset},owner);
      batch.confirmed=response.config;
      if(owner.vehicle_id===this.selected.vehicle_id&&owner.view_id===this.selected.view_id&&this.pending===1){
        this.config=response.config;
        if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
        window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
      }
      this.status(this.t("Saved","Αποθηκεύτηκε","Guardado"),"success");
    }).catch(error=>this.status(error.message||String(error))).finally(()=>{
      this.pending--;batch.pending--;
      if(!batch.pending){
        this.saveBatches.delete(key);
        if(owner.vehicle_id===this.selected.vehicle_id&&owner.view_id===this.selected.view_id){
          this.config=batch.confirmed;syncProfileDesign(this);window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
          if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
          window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
        }
      }
    });
    return this.queue;
  }
  async showHistory(stage,revision){
    const [page,summary]=await Promise.all([this.request('sessions_page',{limit:SESSION_PAGE_SIZE,location:this.sessionLocation||'',sort:this.sessionSort||'newest'}),this.request('charging_dashboard')]);if(revision!==this.mountRevision)return;
    this.archiveRows=page.rows;this.sessionCursor=page.next_before;this.dashboardSummary=summary;this.sessionListGeneration=(this.sessionListGeneration||0)+1;this.sessionFiltering=false;
    const actions='<div class="actions"><button data-action="export">Export JSON</button>'+(this._hass.user?.is_admin?'<button data-action="backup">Database backup</button><button data-action="sync-recorder">Import older Recorder charges</button>':'')+'</div>';
    stage.innerHTML=costFrame(this,page,actions);applyCostDesign(this);renderSessionList(this);
    window.__DEEPAL_COMPANION_UI.enhanceChoices(stage,this._hass);
    if(this._hass.user?.is_admin&&(!page.curves_synced||!page.recorder_synced||Date.now()/1000-page.recorder_synced>86400))this.recoverRecorderSessions(stage,revision);
  }
  async recoverRecorderSessions(stage,revision){
    if(this.recorderRecovery)return;this.recorderRecovery=true;const context=this.context,owner={...this.selected};
    const note=document.createElement('p');note.className='cc-info recorder-recovery';note.setAttribute('role','status');note.textContent='Recovering available charging history…';stage.querySelector('.cost-design-filters')?.before(note);
    try{await window.__DEEPAL_COMPANION_UI.loadEnergy();await window.__DEEPAL_COMPANION_ENERGY.syncRecorderCharges(context);
      if(revision!==this.mountRevision||this.selected.vehicle_id!==owner.vehicle_id)return;
      const summary=await this.request('charging_dashboard',{},owner);if(revision!==this.mountRevision)return;this.dashboardSummary=summary;this.updateCostSummary();
      if(this.costGraph)this.paintCostCharts(summary);
      await this.filterSessions(this.sessionLocation||'');note.remove();
    }catch(error){if(note.isConnected){note.setAttribute('role','alert');note.textContent='Charging history recovery failed. Use Data options → Import older Recorder charges to retry. '+(error.message||String(error));}}
    finally{this.recorderRecovery=false;}
  }
  sessionFilterMarkup(locations){
    return '<div class="session-filters"><label>Location<select name="session_location"><option value="">All locations</option><option value="__unset__"'+(this.sessionLocation==='__unset__'?' selected':'')+'>Not set</option>'+locations.map(location=>'<option value="'+escape(location.id)+'"'+(this.sessionLocation===location.id?' selected':'')+'>'+escape(location.name)+'</option>').join('')+'</select></label><label>Sort by<select name="session_sort">'+[['newest','Newest first'],['oldest','Oldest first'],['highest','Highest cost'],['lowest','Lowest cost']].map(([value,label])=>'<option value="'+value+'"'+((this.sessionSort||'newest')===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label></div>';
  }
  async filterSessions(location,sort=this.sessionSort||"newest"){
    const previous=this.sessionLocation||'',previousSort=this.sessionSort||'newest',revision=this.mountRevision,generation=this.sessionListGeneration=(this.sessionListGeneration||0)+1;this.sessionLocation=location;this.sessionSort=sort;this.sessionFiltering=true;
    const list=this.shadowRoot.querySelector('.charge-session-list');list?.setAttribute('aria-busy','true');
    const more=this.shadowRoot.querySelector('[data-action=load-sessions]');if(more)more.disabled=true;
    try{const page=await this.request('sessions_page',{limit:SESSION_PAGE_SIZE,location,sort});if(revision!==this.mountRevision||generation!==this.sessionListGeneration)return;
      if(sort!=='newest'&&page.sort!==sort)throw Error('Restart Home Assistant to load database sorting, then try again.');
      this.archiveRows=page.rows;this.sessionCursor=page.next_before;renderSessionList(this);
      this.shadowRoot.querySelector('.charge-list-heading>span').textContent=page.total+' sessions';this.shadowRoot.querySelector('[data-session-count]').textContent=page.total+' sessions';more?.remove();if(page.has_more)list.insertAdjacentHTML('afterend','<button data-action="load-sessions">Load more</button>');
    }catch(error){if(generation===this.sessionListGeneration&&revision===this.mountRevision){this.sessionLocation=previous;this.sessionSort=previousSort;const order=this.shadowRoot.querySelector('[name=session_sort]');if(order){order.value=previousSort;order._compPicker.value=previousSort;}const select=this.shadowRoot.querySelector('[name=session_location]');if(select){select.value=previous;select._compPicker.value=previous;}this.status(error.message||String(error));}}finally{if(generation===this.sessionListGeneration){this.sessionFiltering=false;list?.removeAttribute('aria-busy');if(more?.isConnected)more.disabled=false;}}
  }
  async loadMoreSessions(button){
    if(this.sessionLoading||this.sessionFiltering||this.sessionCursor==null)return;
    this.sessionLoading=true;button.disabled=true;button.textContent='Loading…';const revision=this.mountRevision,generation=this.sessionListGeneration;
    try{const page=await this.request('sessions_page',{limit:SESSION_PAGE_SIZE,before:this.sessionCursor,location:this.sessionLocation||'',sort:this.sessionSort||'newest'});if(revision!==this.mountRevision||generation!==this.sessionListGeneration)return;
      const known=new Set(this.archiveRows.map(row=>row.id)),rows=page.rows.filter(row=>!known.has(row.id));this.archiveRows.push(...rows);this.sessionCursor=page.next_before;
      renderSessionList(this);if(!page.has_more)button.remove();
    }catch(error){this.status(error.message||String(error));}finally{this.sessionLoading=false;button.disabled=false;button.textContent='Load more';}
  }
  sessionFormat(){
    const lang=this._hass.locale?.language||'en',key=JSON.stringify([this._hass.locale,this._hass.config?.time_zone]),ha=window.__DEEPAL_COMPANION_UI.format(this._hass);
    if(this._sessionFormat?.key!==key)this._sessionFormat={key,lang,number:new Intl.NumberFormat(lang,{maximumFractionDigits:2}),money:new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}),date:{format:ha.date},time:{format:ha.hm}};
    return this._sessionFormat;
  }
  sessionState(row){return !Number.isFinite(row.pricing?.cost)?'unpriced':row.pricing.cost===0?'free':'paid';}
  sessionCard(row){return '<article class="charge-session" data-session-start="'+escape(row.s)+'" data-cost-state="'+this.sessionState(row)+'"><div class="charge-session-body">'+this.sessionCardContent(row)+'</div></article>';}
  sessionCardContent(row){return costCardContent(this,row);}

  attachHistoryEditor(stage){
    const graph=document.createElement("div");graph.className="charging-settings";graph.innerHTML="<style>"+window.__DEEPAL_COMPANION_ENERGY.styles+"</style>"+window.__DEEPAL_COMPANION_ENERGY.renderChargingChart(this.dashboardSummary?.chart_rows||[],this._hass.locale?.language||"en");stage.querySelector(".cost-design-filters")?.before(graph);this.costGraph=graph;
    this.updateCostSummary();
    window.__DEEPAL_COMPANION_ENERGY.bindChargingChart?.(graph,window.__DEEPAL_COMPANION_UI.format(this._hass));
    const actions=stage.querySelector(".archive .actions");
    if(actions){
      const footer=document.createElement("footer");footer.className="archive-tools";
      footer.innerHTML='<button data-action="data-menu" aria-expanded="false"><ha-icon icon="mdi:dots-horizontal"></ha-icon>'+escape(this.t("Data options","Επιλογές δεδομένων"))+'</button><div class="archive-data-menu" hidden></div>';
      stage.querySelector(".archive").append(footer);footer.querySelector(".archive-data-menu").append(actions);
    }
    const line=document.createElement("section");line.className="history-line-card";
    line.innerHTML='<h2>'+escape(this.t("Battery & petrol history","Ιστορικό μπαταρίας και καυσίμου"))+'</h2>';
    const lineHost=document.createElement("div");lineHost.className="enpanel charging-settings history-line-chart";
    line.append(lineHost);graph.before(line);lineHost.addEventListener('energy-period',event=>this.loadCostChartPeriod(event.detail));window.__DEEPAL_COMPANION_ENERGY.panel(lineHost,this.context,{chartOnly:true});
  }
  paintCostCharts(summary=this.dashboardSummary){
    if(!this.costGraph)return;const energy=window.__DEEPAL_COMPANION_ENERGY,period=this.costChartPeriod,fmt=window.__DEEPAL_COMPANION_UI.format(this._hass);
    this.costGraph.innerHTML='<style>'+energy.styles+'</style>'+energy.renderChargingChart(summary?.chart_rows||[],this._hass.locale?.language||'en',period?period.end-1:Date.now(),{period:period?.period||30,fmt});energy.bindChargingChart(this.costGraph,fmt);
  }
  async loadCostChartPeriod(period){
    this.costChartPeriod=period;const revision=this.mountRevision,generation=this.costChartGeneration=(this.costChartGeneration||0)+1,graph=this.costGraph,owner={...this.selected};if(!graph)return;
    graph.style.minHeight=graph.getBoundingClientRect().height+'px';graph.setAttribute('aria-busy','true');const loader=document.createElement('div');loader.className='cost-chart-loader';loader.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');graph.append(loader);
    try{const summary=await this.request('charging_dashboard',{start_time:new Date(period.start).toISOString(),end_time:new Date(period.end).toISOString()},owner);if(revision!==this.mountRevision||generation!==this.costChartGeneration)return;this.dashboardSummary=summary;this.paintCostCharts(summary);this.updateCostSummary();}
    catch(error){if(revision===this.mountRevision&&generation===this.costChartGeneration)this.status(error.message||'Charging charts could not be loaded.');}
    finally{loader.remove();if(revision===this.mountRevision&&generation===this.costChartGeneration){graph.style.minHeight='';graph.removeAttribute('aria-busy');}}
  }

  locationLabel(assignment){
    if(assignment?.profile?.id==="manual")return this.t("Manual charge","Χειροκίνητη χρέωση","Cargo manual");
    return assignment?.profile?.name||assignment?.profile?.id||this.t("Unassigned","Χωρίς τοποθεσία");
  }
  updateCostSummary(){updateCostHeader(this);}

  async showSessionCurve(ident){
    if(this.costs?.dirty){this.status('Save or cancel your changes first.','warning');return;}
    const revision=this.mountRevision,owner=this.selected.vehicle_id;
    const module=await import('./charging-curve.js?v=0.1.0');
    if(revision!==this.mountRevision||owner!==this.selected.vehicle_id||!this.isConnected)return;
    this.sessionDialog?.remove();this.sessionDialog=module.openCurveDialog(this.shadowRoot,this._hass,async()=>{const data=await this.request('session_curve',{session_id:ident}),record=this.archiveRows?.find(row=>row.id===ident);return {...data,mode:data.mode||(typeof record?.dc==='boolean'?(record.dc?'DC':'AC'):null)};},this.config);
  }

  async editSession(start){
    if(this.costs?.dirty){this.status(this.t("Save your changes first.","Αποθήκευσε πρώτα τις αλλαγές σου."));return;}
    const record=(this.archiveRows||[]).find(row=>String(row.s)===String(start));if(!record)return;
    const revision=this.mountRevision;
    await window.__DEEPAL_COMPANION_UI.loadEnergy();if(revision!==this.mountRevision)return;
    const energy=window.__DEEPAL_COMPANION_ENERGY;
    this.sessionDialog?.remove();
    const session=[...this.shadowRoot.querySelectorAll(".charge-session")].find(row=>row.dataset.sessionStart===String(record.s));
    if(!session)return;
    const inline=document.createElement("dialog"),area=document.createElement("div");this.sessionDialog=inline;
    inline.className="session-price-dialog";inline.setAttribute("aria-label","Edit charge price and location");area.className="history-editor";
    inline.append(area);this.shadowRoot.append(inline);inline.showModal();
    const host=document.createElement("div");host.className="enpanel charging-settings history-session";
    host.innerHTML="<style>"+energy.styles+'</style><div class="cc-editor"></div>';area.append(host);
    const manager=new energy.ChargingCosts(this.context,host);this.costs=manager;manager.onSaved=()=>this.status(this.t("Saved","Αποθηκεύτηκε","Guardado"),"success");manager.onCanceled=()=>this.status(this.t("Changes canceled","Οι αλλαγές ακυρώθηκαν","Cambios cancelados"),"success");manager.onDirtyChange=dirty=>{if(!dirty&&this.unsavedWarning)this.status("");};await manager.ready;
    if(revision!==this.mountRevision)return;
    const close=()=>{if(inline.open)inline.close();inline.remove();if(this.sessionDialog===inline)this.sessionDialog=null;if(this.costs===manager)this.costs=null;};
    inline.addEventListener('cancel',event=>{event.preventDefault();if(!manager.saving)manager.cancelChanges();});
    manager.onSaved=()=>{this.status('Saved','success');queueMicrotask(close);};
    manager.onCanceled=()=>{close();this.status(this.t("Changes canceled","Οι αλλαγές ακυρώθηκαν","Cambios cancelados"),"success");};
    manager.editor=String(record.s);manager.editorNode=host.querySelector(".cc-editor");
    manager.model={chg:[record],days:[],t0:record.s,now:record.e};
    manager.ctx={cap:this.context._battKwh(),fmt:window.__DEEPAL_COMPANION_UI.format(this._hass)};
    manager.decorate=()=>{
      manager.renderEditor();const result=manager.result(record),assignment=manager.record(record);
      record.pricing=result;record.assignment=assignment;
      if(this.sessionLocation&&revision===this.mountRevision)this.filterSessions(this.sessionLocation);
      const row=[...this.shadowRoot.querySelectorAll(".charge-session")].find(n=>n.dataset.sessionStart===String(record.s));
      if(row)renderSessionList(this);
      this.loadCostChartPeriod(this.costChartPeriod||{start:Date.now()-30*86400000,end:Date.now(),period:30});
    };
    manager.renderEditor();
  }
  async click(event){
    const button=event.target.closest("[data-action],[data-mode]");if(!button)return;
    try{
      if(button.dataset.mode){
        if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t("Save or cancel your changes first.","Αποθήκευσε ή ακύρωσε πρώτα τις αλλαγές σου."));return;}
        await this.navigateMode(button.dataset.mode);return;
      }
      const action=button.dataset.action;
      if(action==="retry-page"){await this.mount();return;}
      if(action==='session-view-grid'||action==='session-view-table'){this.sessionView=action==='session-view-table'?'table':'grid';renderSessionList(this);for(const button of this.shadowRoot.querySelectorAll('[data-action^="session-view-"]'))button.setAttribute('aria-pressed',String(button.dataset.action==='session-view-'+this.sessionView));return;}
      if(action==='load-sessions'){await this.loadMoreSessions(button);return;}
      if(action==='sync-recorder'){button.disabled=true;try{await window.__DEEPAL_COMPANION_ENERGY.syncRecorderCharges(this.context);await this.mount();}finally{button.disabled=false;}return;}
      if(action==="vehicle-settings"){this.settings?._setTab("vehicle");this.settings?.scrollIntoView({block:"start",behavior:"smooth"});return;}
      if(action==="dashboard-guide"){const guide=this.shadowRoot.querySelector(".dashboard-guide");if(guide){guide.open=true;guide.scrollIntoView({block:"nearest",behavior:"smooth"});}return;}
      if(action==="add-dashboard"){const module=await import("./companion-dashboard.js?v=0.1.0");await module.showDashboardAdd(this);return;}
      if(action==="edit-session"){await this.editSession(button.dataset.start);return;}
      if(action==='view-curve'){await this.showSessionCurve(button.dataset.sessionId);return;}
      if(action==="menu"){this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:true,composed:true}));return;}
      if(["rename","duplicate","create","delete"].includes(action)){
        if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t("Save or cancel your changes first.","Αποθήκευσε ή ακύρωσε πρώτα τις αλλαγές σου."));return;}
        if(action==="delete"&&!window.confirm(this.t("Delete this display profile? Vehicle history is kept.","Διαγραφή προφίλ εμφάνισης; Το ιστορικό διατηρείται.")))return;
        const name=this.shadowRoot.querySelector('[name=profile_name]').value.trim()||"New profile";
        const result=await this.request("view",{action:action==="duplicate"?"create":action,name:action==="duplicate"?name+" (copy)":name,source:action==="duplicate"?this.selected.view_id:null});
        if(action==="create"||action==="duplicate")this.selected.view_id=result.view_id;
        this.listSignature=null;await this.refresh();return;
      }
      if(action==="data-menu"){const menu=this.shadowRoot.querySelector(".archive-data-menu");if(menu){menu.hidden=!menu.hidden;button.setAttribute("aria-expanded",String(!menu.hidden));}return;}
      if(action==="export"){
        const data=await this.request("export"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=document.createElement("a");
        link.href=url;link.download="deepal-companion-"+new Date().toISOString().slice(0,10)+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
      }
      if(action==="backup"){const result=await this.request("backup");this.status(this.t("Backup saved: ","Αποθηκεύτηκε αντίγραφο: ")+result.file);}
    }catch(error){this.status(error.message||String(error));}
  }
}
if(!customElements.get("deepal-companion-panel"))customElements.define("deepal-companion-panel",DeepalCompanionPanel);
