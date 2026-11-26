import {bindProfileField,syncProfileDesign} from './profile-field.js?v=2.0.1-b1&rev=20261126-01';
import {costFrame,costCardContent,applyCostDesign,updateCostHeader,renderSessionList,energyChartMarkup,bindEnergyChartZoom} from './companion-cost-design.js?v=2.0.1-b1&rev=20261126-01';
import "/deepal_companion/frontend/companion-card.js?v=2.0.1-b1&rev=20261126-01";

const PRECOND_SVG='<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path style="fill:currentColor;stroke:none" transform="translate(1 3.273) scale(0.03051)" fill-rule="evenodd" d="M46 548 L46 557 L48 562 L51 566 L61 571 L618 571 L627 567 L631 562 L633 557 L633 548 L630 542 L625 537 L617 534 L292 534 L291 535 L280 535 L279 534 L62 534 L54 537 L48 543 Z M506 0 L498 4 L492 12 L491 17 L491 65 L490 66 L470 55 L453 43 L442 39 L430 42 L425 47 L422 54 L423 65 L429 73 L478 104 L483 106 L491 112 L491 140 L492 141 L492 151 L491 152 L491 214 L489 215 L479 210 L474 206 L457 197 L389 156 L380 155 L371 159 L365 167 L364 177 L366 183 L372 190 L402 207 L410 213 L419 217 L447 235 L469 247 L470 249 L373 303 L367 309 L365 313 L364 323 L366 329 L373 336 L377 338 L388 338 L413 325 L452 302 L478 289 L489 282 L491 283 L491 366 L485 371 L470 379 L428 405 L424 410 L422 416 L422 424 L425 431 L429 435 L435 438 L446 438 L457 432 L465 426 L489 413 L490 414 L490 469 L491 473 L497 481 L503 484 L511 485 L520 481 L524 477 L527 471 L527 457 L528 456 L527 453 L527 434 L528 433 L528 415 L529 414 L544 422 L567 438 L574 441 L583 441 L589 438 L594 433 L597 423 L596 416 L594 412 L589 407 L540 376 L528 367 L528 283 L529 282 L538 286 L548 293 L559 298 L612 329 L616 383 L620 392 L623 395 L632 399 L641 398 L646 395 L652 387 L653 384 L652 362 L651 361 L651 351 L652 350 L697 375 L709 374 L713 372 L718 366 L720 362 L720 351 L718 347 L709 339 L686 327 L670 317 L672 315 L706 299 L711 294 L714 287 L714 280 L712 274 L708 269 L700 265 L691 265 L656 282 L654 282 L632 294 L628 294 L612 284 L601 279 L594 274 L566 259 L559 254 L552 251 L550 248 L629 205 L688 237 L699 238 L705 236 L709 233 L714 224 L714 216 L712 210 L705 203 L672 186 L670 183 L711 161 L716 156 L718 152 L719 142 L717 137 L712 131 L704 128 L698 128 L680 136 L655 150 L654 149 L654 143 L655 142 L658 117 L659 116 L658 105 L656 101 L649 95 L641 93 L635 94 L627 99 L622 109 L622 115 L620 122 L620 128 L619 129 L619 135 L618 136 L618 142 L617 143 L613 171 L610 174 L529 217 L528 216 L528 113 L538 105 L543 103 L592 72 L597 64 L598 55 L595 47 L590 42 L586 40 L578 39 L567 43 L529 67 L528 66 L528 14 L527 11 L520 3 L513 0 Z M243 0 L236 2 L228 10 L208 47 L199 61 L194 72 L181 93 L177 101 L176 111 L179 118 L183 122 L189 125 L222 125 L224 127 L225 146 L230 168 L236 183 L258 224 L264 241 L266 251 L266 265 L262 284 L254 301 L230 337 L218 359 L213 371 L208 394 L208 421 L212 440 L218 456 L229 476 L238 487 L247 491 L256 491 L265 487 L271 480 L273 475 L273 463 L271 458 L262 445 L254 426 L252 417 L253 395 L256 384 L263 368 L289 327 L299 307 L306 287 L307 277 L308 276 L308 268 L309 267 L308 242 L303 220 L297 205 L288 187 L283 180 L273 159 L268 144 L267 127 L269 125 L302 125 L305 124 L313 117 L315 111 L315 104 L310 93 L294 67 L290 58 L285 51 L262 9 L256 3 L252 1 Z M67 0 L56 5 L51 12 L46 23 L42 28 L20 69 L7 90 L1 102 L1 107 L0 108 L2 116 L10 124 L13 125 L46 125 L49 127 L50 144 L55 165 L64 186 L84 221 L90 237 L92 247 L92 266 L87 285 L74 309 L57 332 L47 348 L39 364 L32 391 L32 417 L33 418 L34 428 L37 439 L47 461 L56 475 L65 486 L75 491 L85 491 L93 487 L98 482 L101 475 L101 462 L98 456 L84 437 L78 423 L76 415 L76 393 L80 381 L88 365 L113 329 L126 305 L134 280 L135 264 L136 263 L135 241 L130 219 L114 185 L99 159 L93 141 L92 127 L96 125 L127 125 L131 123 L138 115 L139 103 L86 8 L81 3 L77 1 Z"/></svg>';
const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SESSION_PAGE_SIZE = 6;
const tabFragments={card:'settings',charging:'chargers',costs:'history',notifications:'notifications',preconditioning:'preconditioning',logs:'logs',health:'health',/* aliases: the page names also work as links; the first key of a mode stays the one written to the address */settings:'settings',sessions:'history',history:'history','charging-profiles':'chargers',chargers:'chargers',charger:'chargers','charger-limit':'chargers'};
const modeFromHash=()=>tabFragments[location.hash.slice(1).split('/')[0]]||null;
const sectionFromHash=()=>location.hash.slice(1).split('/')[1]||null;
/* The one page head for each panel page: [icon, title, subtitle]. Sessions keeps its own heading (it is the look the others match). */
const PAGE_HEADS={notifications:['mdi:bell-outline','Notifications','Alerts for charging, security and the car'],chargers:['mdi:ev-station','Charging','Tariffs and charger sensors for each location'],preconditioning:['mdi:fan','Preconditioning','Warm or cool the car before you drive'],logs:['mdi:timeline-text-outline','Car logs','Locks, charging and warnings, in order'],health:['mdi:heart-pulse','Health & Diagnostics','Checks on the integration, sensors and charge plan']};
class DeepalCompanionPanel extends HTMLElement {
  constructor(){
    super();this.attachShadow({mode:"open"});this.vehicles=[];this.selected={};this.mode=modeFromHash()||"settings";this.focusSection=sectionFromHash();this.tab="layout";this.message="";this.queue=Promise.resolve();
    const UI=window.__DEEPAL_COMPANION_UI,style=document.createElement('style'),boot=document.createElement('div');this.stylesReady=false;
    style.textContent=':host{display:block;background:var(--primary-background-color);color:var(--primary-text-color)}.companion-surface[hidden],.companion-boot[hidden]{display:none!important}.companion-boot{display:flex;justify-content:center;align-items:flex-start;padding-top:40px;min-height:220px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif}'+UI.loaderCss;
    boot.className='companion-boot';boot.setAttribute('aria-label',window.__DEEPAL_COMPANION_UI.t('Loading Deepal Companion'));boot.innerHTML=UI.loaderHtml('trunk');this.shadowRoot.append(style,boot);
    this.shadowRoot.addEventListener("click",e=>this.click(e));
    this.shadowRoot.addEventListener("keydown",e=>{if(e.target.name==="profile_name"&&e.key==="Enter"){e.preventDefault();e.target.blur();}});
    this.shadowRoot.addEventListener("change",e=>{
      if(e.target.name==="vehicle"){const car=this.vehicles.find(v=>v.id===e.target.value);if(car)this.select(car.id,car.views[0]?.id);}
      if(e.target.name==="view")this.select(this.selected.vehicle_id,e.target.value);
      if(e.target.name==="profile_name"&&!e.target.parentElement.dataset.picking)this.renameProfile(e.target);
      if(e.target.name==="session_location")this.filterSessions(e.target.value);
      if(e.target.name==="session_sort")this.filterSessions(this.sessionLocation||"",e.target.value);
      if(e.target.name==="preview_clicks"){this.previewClicks=e.target.checked;window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode||"live",this.previewClicks);this.updatePreviewNote();}
      if(e.target.name==="preview_mode"){this.previewMode=e.target.value;window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode);this.updatePreviewNote();}
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
  syncModeHash(replace=false){const hash='#'+Object.keys(tabFragments).find(key=>tabFragments[key]===this.mode);if(location.hash.split('/')[0]!==hash)history[replace?'replaceState':'pushState'](history.state,'',location.pathname+location.search+hash);}
  async flushAutosave(){try{await this.localBoard?.flush?.();await this.costs?.flush?.();}catch(_){}}
  async navigateMode(mode,fromHistory=false){
    if(!this.selected.vehicle_id||mode===this.mode)return;
    if(!Object.values(tabFragments).includes(mode))return;
    await this.flushAutosave();
    if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t('Save or cancel your changes first.'),'warning');if(fromHistory)this.syncModeHash(true);return;}
    if(!fromHistory){const previous=this.mode;this.mode=mode;this.syncModeHash();this.mode=previous;}
    const request=this.navigationVersion=(this.navigationVersion||0)+1;this.mode=mode;this.render();this.scrollTop=0;
    const stage=this.shadowRoot.querySelector('.stage');stage.classList.add('is-loading');stage.setAttribute('aria-busy','true');
    const ensureLoader=()=>{if(!stage.querySelector(':scope>.stage-loader')){const loader=document.createElement('div');loader.className='stage-loader';loader.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('trunk');stage.append(loader);}};
    const observer=new MutationObserver(ensureLoader);observer.observe(stage,{childList:true});ensureLoader();
    try{await Promise.all([this.mount(),new Promise(resolve=>setTimeout(resolve,1000))]);}
    finally{observer.disconnect();stage.querySelectorAll(':scope>.stage-loader').forEach(loader=>loader.remove());if(request===this.navigationVersion){const active=this.shadowRoot.querySelector('.stage');active?.classList.remove('is-loading');active?.removeAttribute('aria-busy');}}
  }
  async renameProfile(field){
    const name=field.value.trim(),owner={...this.selected},current=this.vehicles.find(v=>v.id===owner.vehicle_id)?.views.find(v=>v.id===owner.view_id);
    if(!name){field.value=current?.name||"";this.status(this.t("Enter a card profile name."));return;}
    if(name===current?.name)return;this.pending=(this.pending||0)+1;this.status(this.t("Saving…"),"saving");
    this.queue=this.queue.catch(()=>{}).then(()=>this.request("view",{action:"rename",name},owner)).then(async()=>{this.listSignature=null;await this.refresh();this.status(this.t("Saved"),"success");}).catch(error=>{if(field.isConnected)field.value=current?.name||'';this.status(error.message||String(error),'error');}).finally(()=>this.pending--);return this.queue;
  }
  t(en,...a){return window.__DEEPAL_COMPANION_UI.t(en,...a);}
  set hass(hass){
    this._hass=hass;
    const scheme=hass?.themes?.darkMode===false?'light':'dark';
    if(this._scheme!==scheme){this._scheme=scheme;this.style.setProperty('--deepal-scheme',scheme);this.style.colorScheme=scheme;}
    this.paintApiBadge();
    if(this.settings)this.settings.hass=hass;
    if(this.preview)window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,hass,this.previewMode||"live");
    if(this.context)window.__DEEPAL_COMPANION_UI.context(hass,this.selected,this.config||{},this.context);
    if(!this.loaded){this.loaded=true;this.refresh();}
  }
  connectedCallback(){window.__DEEPAL_COMPANION_UI.confirm=this._sharedConfirm=(title,text,label)=>this.confirmDialog(title,text,label);this.healthBadgeTimer=setInterval(()=>{if(!document.hidden)this.refreshHealthBadge();},60000);window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config||{});window.__DEEPAL_COMPANION_UI.watchLanguage(this.shadowRoot);this.hashListener=()=>{const mode=modeFromHash()||'settings',section=sectionFromHash();if(section&&mode===this.mode){this.shadowRoot.querySelector('[data-pc="'+section+'"]')?.scrollIntoView({block:'start',behavior:'smooth'});}else this.focusSection=section;if(mode!==this.mode){if(this.selected.vehicle_id)this.navigateMode(mode,true);else this.mode=mode;}};window.addEventListener('hashchange',this.hashListener);this.syncModeHash(true);if(this._hass)this.refresh();this._unwatchConnection?.();this._unwatchConnection=window.__DEEPAL_COMPANION_UI.watchConnection(()=>this._hass,()=>{this.fetching=false;this.refreshFailures=0;if(!this.pending&&!this.localBoard?.busy)this.refresh();},()=>{/* The socket never came back (phone slept): reload the page like a manual refresh, unless there are unsaved changes. */if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t('Connection lost. Save or cancel your changes, then reload the page.'),'warning');return;}location.reload();});}
  disconnectedCallback(){if(window.__DEEPAL_COMPANION_UI.confirm===this._sharedConfirm)window.__DEEPAL_COMPANION_UI.confirm=null;clearInterval(this.healthBadgeTimer);clearTimeout(this.retryTimer);window.removeEventListener('hashchange',this.hashListener);this._unwatchConnection?.();this._unwatchConnection=null;this.sessionDialog?.remove();this.localBoard?.destroy();this._dashboardDialog?.remove();this._dashboardDialog=null;clearTimeout(this.statusTimer);this.context?._compEnergyHost?.energyCleanup?.();this.mountRevision=(this.mountRevision||0)+1;this.unsubscribe?.();this.unsubscribe=null;this.previewObserver?.disconnect();window.removeEventListener("resize",this.previewWindowResize);this.previewWindowResize=null;}
  takeFocusSection(){const s=this.focusSection;this.focusSection=null;return s;}
  async mountPreconditionSection(stage,mode,revision){
    const module=await import("./companion-precondition.js?v=2.0.1-b1&rev=20261126-01");if(revision!==this.mountRevision)return null;
    const UI=window.__DEEPAL_COMPANION_UI,owner={...this.selected},box=document.createElement("section");box.className="box precondition-box";box.dataset.preconditioning=mode;if(!this.placePreconditionBox(stage,box,mode))stage.append(box);
    /* the Preconditioning page links to Notifications: same steps as a tab click (save check, then the tab's navigation, so Back and Forward work) */
    const openTab=async to=>{await this.flushAutosave();if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t("Save or cancel your changes first."));return;}await this.navigateMode(to);};
    return module.mountPrecondition(box,{request:(op,data)=>this.request(op,data,owner),t:UI.t,loaderHtml:UI.loaderHtml,loaderCss:UI.loaderCss,mode,onMore:mode==='settings'?openTab:null,scrollTo:mode==='settings'?this.takeFocusSection():null,admin:!!this._hass?.user?.is_admin,notify:(m,err)=>this.status(m,err?"error":"success"),getHass:()=>this._hass});
  }
  /* Notifications page: one language for every notification Companion writes, at the top of the board. Saved once for the whole integration; Automatic follows the Home Assistant language. */
  async mountLanguageBox(stage,revision){
    const root=stage.querySelector(".local-notifications")?.shadowRoot,first=root?.querySelector(".ha-card");if(!first)return;
    const UI=window.__DEEPAL_COMPANION_UI,T=UI.t,look=getComputedStyle(first),admin=!!this._hass?.user?.is_admin;
    let current="auto";try{current=(await this.request("notification_language_get",{},{vehicle_id:"",view_id:""})).language||"auto";}catch(_){return;}
    if(revision!==this.mountRevision||!root.contains(first))return;
    const box=document.createElement("div");box.className="ha-card deepal-language-box";
    box.style.cssText="box-sizing:border-box;padding:16px;margin:0 0 "+look.marginTop+";border-radius:"+look.borderTopLeftRadius+";background:"+look.backgroundColor+";border:"+look.borderTopWidth+" "+look.borderTopStyle+" "+look.borderTopColor+";color:inherit";
    const options=[["auto",T("Automatic (Home Assistant language)")],["en","English"],["el","Ελληνικά"],["de","Deutsch"],["es","Español"],["it","Italiano"]];
    const esc=value=>String(value).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    box.innerHTML='<label style="display:grid;gap:6px;font-size:13px"><b>'+esc(T("Notification language"))+'</b><select'+(admin?"":" disabled")+' style="font:inherit;padding:9px 10px;border-radius:10px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;min-width:0;width:100%">'+options.map(([v,l])=>'<option value="'+v+'"'+(v===current?" selected":"")+' style="color:#000">'+esc(l)+'</option>').join("")+'</select><small style="opacity:.7">'+esc(T("Language of the notifications Companion writes. Alert texts you wrote stay as written."))+'</small></label>';
    const select=box.querySelector("select");select.onchange=async()=>{const before=current;select.disabled=true;try{current=(await this.request("notification_language_set",{language:select.value},{vehicle_id:"",view_id:""})).language;this.status(T("Saved."));}catch(error){select.value=before;current=before;this.status(error.message||String(error),"error");}finally{select.disabled=!admin;}};
    first.before(box);
  }
  /* Notifications page: the preconditioning box sits inside the board, after the alert boxes and before "Old data protection", with the same width, padding, spacing and colours as its neighbours. */
  placePreconditionBox(stage,box,mode){
    if(mode!=="notifications")return false;
    const root=stage.querySelector(".local-notifications")?.shadowRoot;if(!root)return false;
    const cards=[...root.querySelectorAll(".ha-card")],UI=window.__DEEPAL_COMPANION_UI;
    const titles=["Old data protection",UI.t("Old data protection")];
    const guard=cards.find(card=>titles.some(title=>(card.textContent||"").trim().startsWith(title)));
    const ref=guard||cards[cards.length-1];if(!ref)return false;
    const look=getComputedStyle(ref);
    box.style.cssText="margin:"+look.marginTop+" 0 0;padding:0;background:none;border:0;box-shadow:none";
    box.style.setProperty("--ds-soft",look.backgroundColor);box.style.setProperty("--pc-radius",look.borderTopLeftRadius);
    if(guard)guard.before(box);else{const history=root.querySelector("#design-history");if(history)history.before(box);else ref.after(box);}
    return true;
  }
  request(op,data={},owner=this.selected){
    // A dropped connection (app back from the background) rejects with a plain object: turn it into readable text.
    return this._hass.callWS({type:"deepal_companion/request",op,vehicle_id:owner.vehicle_id,view_id:owner.view_id,data}).catch(error=>{throw (window.__DEEPAL_COMPANION_UI?.readableError||(value=>value))(error);});
  }
  setHealthResult(result){
    this.healthStatus={vehicle:this.selected.vehicle_id,problem:result.status==='error'||result.status==='warning'};this.healthStatus.warnOnly=result.status==='warning';
    const button=this.shadowRoot.querySelector('[data-mode=health]');if(button){button.classList.toggle('health-attention',this.healthStatus.problem);button.classList.toggle('health-warn',!!this.healthStatus.warnOnly);button.setAttribute('aria-label',this.t('Health')+(this.healthStatus.problem?' · '+this.t('Needs attention'):''));}
  }
  async refreshHealthBadge(){
    if(this.healthBadgeBusy||!this.selected.vehicle_id)return;this.healthBadgeBusy=true;const owner={...this.selected};
    try{const result=await this.request('health_get',{},owner);if(this.isConnected&&owner.vehicle_id===this.selected.vehicle_id)this.setHealthResult(result);}catch(_){}finally{this.healthBadgeBusy=false;}
  }
  async refresh(){
    if(!this._hass||this.fetching){this.refreshAgain=true;return;}
    this.fetching=true;
    try{
      /* A socket that died without closing never answers: give up after 12 s so the refresh lock is released and the retry below can run. */
      /* the 12 s guard is cleared once the answer arrives, so a closed panel is not kept alive by the pending timer */
      let guard;const rows=await Promise.race([this._hass.callWS({type:"deepal_companion/request",op:"list"}),new Promise((_,no)=>{guard=setTimeout(()=>no(new Error("timeout")),12000);})]).finally(()=>clearTimeout(guard)).catch(error=>{throw (window.__DEEPAL_COMPANION_UI?.readableError||(value=>value))(error);});
      if(!this.isConnected)return;
      const signature=JSON.stringify(rows.map(v=>({id:v.id,name:v.name,views:v.views.map(p=>({id:p.id,name:p.name}))})));
      const changed=signature!==this.listSignature;
      /* A rebuild would destroy an editor with unsaved changes: keep the old signature so the next refresh rebuilds once it is saved or cancelled */
      const keep=changed&&!!(this.localBoard?.dirty||this.costs?.dirty);
      if(!keep)this.listSignature=signature;
      this.vehicles=rows;
      const user=String(this._hass.user?.id||'local');
      if(this.selectionUser!==user){const first=this.selectionUser===undefined;this.selectionUser=user;if(!first||!this.selected.vehicle_id){try{this.selected=JSON.parse(localStorage.getItem('deepal-companion-selection:'+user)||'null')||{};}catch(_){this.selected={};}}}
      const car=rows.find(v=>v.id===this.selected.vehicle_id)||rows[0],view=car?.views.find(v=>v.id===this.selected.view_id)||car?.views[0];
      if(car&&view)this.selected={vehicle_id:car.id,view_id:view.id};
      else{this.selected={};this.config=null;this.message="";clearTimeout(this.statusTimer);window.__DEEPAL_COMPANION_UI.applyPalette(this,{});}
      if(keep)this.status(this.t("Save or cancel your changes first."),"warning");
      else if(changed||!this.shadowRoot.querySelector("main")){this.render();await this.mount();}
      else if(car&&view&&this.mode==="settings"&&!this.pending)await this.loadConfig();
      else if(this.mode==="chargers"&&this.costs&&!this.costs.dirty){
        const previous=JSON.stringify(this.costs.data);await this.costs.load();
        if(JSON.stringify(this.costs.data)!==previous)this.costs.renderEditor();
      }
      if(!this.unsubscribe&&this.isConnected){const unsubscribe=await this._hass.connection.subscribeMessage(message=>{
        if(!this.selected.vehicle_id||message.vehicle_id===this.selected.vehicle_id)this.refresh();
      },{type:"deepal_companion/subscribe"});if(this.isConnected)this.unsubscribe=unsubscribe;else unsubscribe();}
      this.refreshFailures=0;clearTimeout(this.retryTimer);
    }catch(error){this.status(error.message||String(error),'error');
      /* No recovery by hand: ask again after 3, 6, 12, 24 then every 30 seconds until Home Assistant answers. */
      if(this.isConnected){const wait=Math.min(30000,3000*2**Math.min(this.refreshFailures||0,4));this.refreshFailures=(this.refreshFailures||0)+1;clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>{if(this.isConnected&&!document.hidden&&!this.pending&&!this.localBoard?.busy)this.refresh();else if(this.isConnected)this.refreshFailures=0;},wait);}
    }
    finally{this.fetching=false;if(this.refreshAgain){this.refreshAgain=false;queueMicrotask(()=>this.refresh());}}
  }
  async select(vehicle,view){
    await this.flushAutosave();
    if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){
      this.status(this.t("Save your changes before switching card profiles."));
      const vehicle=this.shadowRoot.querySelector('[name=vehicle]'),profile=this.shadowRoot.querySelector('[name=view]');
      if(vehicle)vehicle.value=this.selected.vehicle_id;if(profile)profile.value=this.selected.view_id;
      return;
    }
    if(this.selected.vehicle_id!==vehicle)this.sessionLocation="";
    this.selected={vehicle_id:vehicle,view_id:view};try{localStorage.setItem('deepal-companion-selection:'+String(this._hass.user?.id||'local'),JSON.stringify(this.selected));}catch(_){}this.config=null;this.render();await this.mount();
  }
  /* The shared page head: icon, title and a one-line subtitle, styled by .page-head in companion-shared.css. */
  pageHead(mode){
    const spec=PAGE_HEADS[mode];if(!spec)return null;
    const car=this.vehicles.find(v=>v.id===this.selected.vehicle_id),head=document.createElement("div");
    head.className="page-head";head.dataset.page=mode;
    head.innerHTML=this.pageHeadInner(spec[0],this.t(spec[1]),(car?.name||"Deepal S05")+" · "+this.t(spec[2]));
    return head;
  }
  /* The one markup of a page head (icon, title, subtitle). Pages built outside pageHead() (Sessions) call this too, so every head is the same. `after` is trusted markup placed beside the title (a count pill). */
  pageHeadInner(icon,title,subtitle,after=""){
    return '<span class="ph-icon"><ha-icon icon="'+icon+'" aria-hidden="true"></ha-icon></span><div class="ph-text">'+(after?'<div class="ph-row"><h2 class="ph-title">'+escape(title)+'</h2>'+after+'</div>':'<h2 class="ph-title">'+escape(title)+'</h2>')+'<p class="ph-sub">'+escape(subtitle)+'</p></div>';
  }
  render(){
    const car=this.vehicles.find(v=>v.id===this.selected.vehicle_id),view=car?.views.find(v=>v.id===this.selected.view_id),admin=!!this._hass?.user?.is_admin,isSettings=this.mode==="settings";
    this.sessionDialog?.remove();this.sessionDialog=null;this.previewObserver?.disconnect();window.removeEventListener("resize",this.previewWindowResize);this.previewWindowResize=null;this.preview=null;
    this.context?._compEnergyHost?.energyCleanup?.();this.localBoard?.destroy();this.localBoard=null;this.settings=null;this.costs=null;this.context=null;this.mountRevision=(this.mountRevision||0)+1;
    const nav=[
      ["settings",this.t("Card Settings"),"mdi:card-account-details-outline"],
      ["notifications",this.t("Notifications"),"mdi:bell-outline"],
      ["history",this.t("Sessions"),"mdi:history"],
      ["chargers",this.t("Charging"),"mdi:ev-station"],
      ["preconditioning",this.t("Preconditioning"),"custom:preconditioning"],
      ["logs",this.t("Car logs"),"mdi:timeline-text-outline"],["health",this.t("Health"),"mdi:heart-pulse"]
    ];
    const vehicleField=this.vehicles.length===1?'<p class="vehicle-name">'+escape(car?.name)+'</p>':'<label>'+escape(this.t("Vehicle"))+'<select name="vehicle">'+this.vehicles.map(v=>'<option value="'+escape(v.id)+'"'+(v.id===car?.id?" selected":"")+'>'+escape(v.name)+'</option>').join("")+'</select></label>';
    const selector='<label class="profile-selector">'+escape(this.t("Card profile"))+'<select name="view">'+(car?.views||[]).map(v=>'<option value="'+escape(v.id)+'"'+(v.id===view?.id?' selected':'')+'>'+escape(v.name)+'</option>').join("")+'</select></label>';
    const actions=[["duplicate","mdi:content-copy",this.t("Duplicate")],["create","mdi:plus",this.t("New profile")],["delete","mdi:trash-can-outline",this.t("Delete")]];
    const management=admin&&view?'<div class="profile-controls">'+selector+'<label class="profile-name">'+escape(this.t("Card profile"))+'<div class="profile-editable"><input name="profile_name" aria-label="'+escape(this.t("Card profile name"))+'" value="'+escape(view.name)+'" maxlength="100" autocomplete="off"><button type="button" data-profile-choose aria-label="'+escape(this.t("Choose card profile"))+'" aria-haspopup="listbox"><ha-icon icon="mdi:chevron-down"></ha-icon></button></div></label><div class="actions">'+actions.map(([action,icon,label])=>'<button data-action="'+action+'"><ha-icon icon="'+icon+'"></ha-icon>'+escape(label)+'</button>').join("")+'</div></div>':selector;
    const profileDesign='<section class="profile-design"><div class="ps-head ps-sub"><span class="ps-icon"><ha-icon icon="mdi:tune-variant" aria-hidden="true"></ha-icon></span><div class="ps-title"><h3>'+escape(this.t("Card design"))+'</h3><p>'+escape(this.t("Look and colours"))+'</p></div></div><label><span>'+escape(this.t("Design style"))+'</span><select name="companion_design">'+[['','Card profile default'],['mobile','Mobile'],['tablet','Tablet'],['energy','Energy'],['minimal',this.t("Minimal")],['cockpit','Modern Cockpit'],['ultra',this.t("Ultra minimal")]].map(([value,label])=>'<option value="'+value+'"'+((this.config?.companion_design||'')===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label><span>'+escape(this.t("Max width"))+'<small>0 = '+escape(this.t("auto"))+'</small></span><div class="ps-unit"><input name="companion_width" type="number" min="0" max="1600" step="1" placeholder="0" title="0 = automatic, otherwise 280–1600 px" value="'+(this.config?.companion_width||'')+'"><em>px</em></div></label></section>';
    const profileField=isSettings?management+profileDesign:"";
    let setup;
    if(isSettings){setup='<section class="box profile-setup'+(this.profileOpen?'':' ps-closed')+'"><div class="ps-head"><span class="ps-icon"><ha-icon icon="mdi:account-cog-outline" aria-hidden="true"></ha-icon></span><div class="ps-title"><h2>'+escape(this.t("Card profile"))+'</h2><p>'+escape(this.t("Looks for different dashboards"))+'</p></div>'+this.apiBadge()+'<button type="button" class="ps-toggle" data-profile-toggle aria-expanded="'+(this.profileOpen?'true':'false')+'" aria-label="'+escape(this.t("Show or hide card profile settings"))+'"><ha-icon icon="mdi:chevron-up" aria-hidden="true"></ha-icon></button></div><div class="ps-body"><div class="ps-inner">'+(this.vehicles.length>1?vehicleField:"")+profileField+'</div></div></section>';}else setup=this.vehicles.length>1?'<section class="box profile-setup">'+vehicleField+'</section>':"";
    const coffee='<div class="companion-support"><a href="https://buymeacoffee.com/leftk" target="_blank" rel="noopener noreferrer" aria-label="Support Lefteris on Buy Me a Coffee (opens in a new tab)"><img src="/deepal_companion/frontend/support/buy-me-a-coffee.png" alt="Buy me a coffee" width="157" height="44" loading="lazy" decoding="async"></a></div>';
    const previewLabel=this.t(this.previewOpen?"Hide preview":"Show preview");
    const preview=isSettings&&car?'<section class="box live-preview'+(this.previewOpen?'':' pv-closed')+'"><div class="preview-heading"><h2><ha-icon icon="mdi:eye-outline" aria-hidden="true"></ha-icon>'+escape(this.t("Live preview"))+'</h2><label class="preview-click-toggle"><ha-icon icon="mdi:cursor-default-click-outline"></ha-icon><span>'+escape(this.t("Allow clicks"))+'</span><input type="checkbox" name="preview_clicks"'+(this.previewClicks?' checked':'')+'></label><button type="button" class="pv-toggle" data-preview-toggle aria-expanded="'+(this.previewOpen?'true':'false')+'" aria-label="'+escape(previewLabel)+'" title="'+escape(previewLabel)+'"><ha-icon icon="mdi:chevron-up" aria-hidden="true"></ha-icon></button></div><div class="pv-body"><div class="pv-inner"><label class="preview-scenario">'+escape(this.t("Preview state"))+'<select name="preview_mode">'+[['live','Live'],['parked','Parked'],['plugged','Plugged in'],['ac','AC charging'],['dc','DC charging'],['complete','Charge complete'],['limit-wait','Charger limit: waiting'],['limit-stop','Charger limit: stopped'],['charge-detected','Charging detected'],['alerts','Alerts'],['doors','Doors or trunk open'],['climate','Climate on'],['signals','Turn signals demo'],['lights','Light show demo']].map(([value,label])=>'<option value="'+value+'"'+(value===(this.previewMode||'live')?' selected':'')+'>'+escape(this.t(label))+'</option>').join('')+'</select></label><p class="preview-mode-note note">'+escape(this.previewMode&&this.previewMode!=='live'?this.t("Simulated preview · the real vehicle is unchanged."):this.t("Showing live vehicle data."))+'</p><div class="preview-window" role="img" aria-label="'+escape(this.t("Card appearance preview"))+'"></div><p class="note preview-support-note">'+escape(this.t("Colours and buttons update immediately."))+'</p><div class="preview-support">'+coffee+'</div></div></div></section>':"";
    const hintHtml=this.startHint===true&&isSettings&&car&&view?this.startHintHtml(admin):"";
    if(!this.shadowRoot.querySelector('link[rel=stylesheet]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/deepal_companion/frontend/companion-panel.css?v=2.0.1-b1&rev=20261126-01';link.addEventListener('load',()=>{this.stylesReady=true;window.__DEEPAL_COMPANION_UI.enhanceChoices(this.shadowRoot,this._hass);this.shadowRoot.querySelector('.companion-surface')?.removeAttribute('hidden');this.shadowRoot.querySelector('.companion-boot').hidden=true;this.previewWindowResize?.();});link.addEventListener('error',()=>{const boot=this.shadowRoot.querySelector('.companion-boot');boot.replaceChildren();const message=document.createElement('p'),retry=document.createElement('button');message.textContent=this.t('Dashboard styles could not be loaded.');retry.textContent=this.t('Try again');retry.onclick=()=>{link.remove();boot.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('trunk');this.render();this.mount();};boot.append(message,retry);});this.shadowRoot.append(link);}
    let surface=this.shadowRoot.querySelector('.companion-surface');if(!surface){surface=document.createElement('div');surface.className='companion-surface';this.shadowRoot.append(surface);}
    surface.hidden=!this.stylesReady;
    const navScroll=surface.querySelector('nav')?.scrollLeft||0;
    surface.innerHTML='<header><button class="menu" data-action="menu" aria-label="'+escape(window.__DEEPAL_COMPANION_UI.t("Menu"))+'">☰</button><h1><span class="app-title">Deepal Companion</span><span class="vehicle-title">'+escape(car?.name||"")+'</span></h1><ha-icon icon="mdi:car-electric"></ha-icon></header>'+(car&&view?'<nav>'+nav.map(([mode,label,icon])=>'<button data-mode="'+mode+'" title="'+escape(label)+'" aria-pressed="'+String(this.mode===mode)+'">'+(icon==="custom:preconditioning"?PRECOND_SVG:'<ha-icon icon="'+icon+'" aria-hidden="true"></ha-icon>')+'<span>'+escape(label)+'</span></button>').join("")+'</nav>':'')+'<p class="status" role="status">'+escape(this.message)+'</p>'+hintHtml+'<main class="'+(!car||!view?"setup-layout":isSettings?"settings-layout":"single-layout")+'">'+(car&&view?setup+preview+'<section class="stage"><p class="note">'+escape(car?this.t("Loading…"):this.t("Add a Deepal vehicle to begin."))+'</p></section>'+(isSettings?'<div class="mobile-support">'+coffee+'</div>':''):this.setupInstructions(admin))+'</main>';
    const credit=document.createElement('div');credit.className='app-credit';credit.textContent='v'+window.__DEEPAL_COMPANION_UI.version+' · '+window.__DEEPAL_COMPANION_UI.credit;surface.querySelector('header').insertBefore(credit,surface.querySelector('header>ha-icon'));
    if(isSettings&&admin&&view){const add=document.createElement('button');add.className='header-add-dashboard';add.dataset.action='add-dashboard';add.title='Add to dashboard';add.innerHTML='<ha-icon icon="mdi:plus"></ha-icon><span>Add to dashboard</span>';surface.querySelector('header>ha-icon').replaceWith(add);}
    {const navEl=surface.querySelector('nav');if(navEl){navEl.scrollLeft=navScroll;const on=navEl.querySelector('[aria-current="page"],.active,button[data-mode="'+this.mode+'"]');if(on){const a=on.offsetLeft,b=a+on.offsetWidth;if(a<navEl.scrollLeft)navEl.scrollLeft=a-8;else if(b>navEl.scrollLeft+navEl.clientWidth)navEl.scrollLeft=b-navEl.clientWidth+8;}}} /* the menu keeps its scroll position when a page opens; it only scrolls if the chosen page is out of view */
    window.__DEEPAL_COMPANION_UI.enhanceChoices(this.shadowRoot,this._hass);bindProfileField(this);this.bindProfileToggle();this.bindPreviewToggle();this.bindStartHint();this.loadStartHint();
  }
  bindPreviewToggle(){
    const section=this.shadowRoot.querySelector(".live-preview"),button=section?.querySelector("[data-preview-toggle]"),heading=section?.querySelector(".preview-heading");
    if(!button)return;
    const apply=()=>{const label=this.t(this.previewOpen?"Hide preview":"Show preview");section.classList.toggle("pv-closed",!this.previewOpen);button.setAttribute("aria-expanded",String(!!this.previewOpen));button.setAttribute("aria-label",label);button.title=label;};
    const toggle=()=>{this.previewOpen=!this.previewOpen;apply();};
    button.onclick=event=>{event.stopPropagation();toggle();};
    heading.onclick=event=>{if(event.target.closest(".preview-click-toggle,.pv-toggle")||!matchMedia("(max-width:760px)").matches)return;toggle();};
  }
  startHintHtml(admin){
    const t=text=>escape(this.t(text)),steps=["Choose a card profile","Pick a layout and colours",...(admin?["Add the card to your dashboard"]:[])];
    return '<section class="start-hint" role="note" aria-label="'+t("Start here")+'"><strong>'+t("Start here")+'</strong><ol>'+steps.map(step=>'<li>'+t(step)+'</li>').join("")+'</ol><button type="button" class="sh-ok" data-start-hint-dismiss>'+t("Got it")+'</button></section>';
  }
  bindStartHint(){
    const button=this.shadowRoot.querySelector("[data-start-hint-dismiss]");
    if(!button)return;
    button.onclick=()=>{
      this.startHint=false;button.closest(".start-hint")?.remove();
      this._hass?.callWS({type:"deepal_companion/request",op:"user_hint_dismiss",data:{hint:"start"}}).catch(()=>{});
    };
  }
  /* The hint is shown to every user until they dismiss it; the dismissal is saved on the server for that user. */
  async loadStartHint(){
    if(this.startHint!==undefined||!this._hass||this.mode!=="settings")return;
    this.startHint="loading";
    try{
      const result=await this._hass.callWS({type:"deepal_companion/request",op:"user_hint_get",data:{hint:"start"}});
      this.startHint=!result?.dismissed;
    }catch(_){this.startHint=false;}
    if(this.startHint!==true||!this.isConnected||this.mode!=="settings")return;
    const surface=this.shadowRoot.querySelector(".companion-surface"),status=surface?.querySelector("p.status");
    if(!status||surface.querySelector(".start-hint")||!surface.querySelector("main.settings-layout"))return;
    status.insertAdjacentHTML("afterend",this.startHintHtml(!!this._hass?.user?.is_admin));this.bindStartHint();
  }
  bindProfileToggle(){
    const section=this.shadowRoot.querySelector(".profile-setup"),button=section?.querySelector("[data-profile-toggle]");
    if(!button)return;
    let header=section.querySelector(':scope>.ps-head');
    if(header.tagName!=='BUTTON'){
      const arrow=document.createElement('span');arrow.className=button.className;arrow.append(...button.childNodes);button.replaceWith(arrow);
      const full=document.createElement('button');full.type='button';full.className=header.className+' profile-toggle-row';full.dataset.profileToggle='';full.setAttribute('aria-label',button.getAttribute('aria-label'));full.setAttribute('aria-expanded',String(!!this.profileOpen));full.append(...header.childNodes);header.replaceWith(full);header=full;
    }
    header.onclick=()=>{this.profileOpen=!this.profileOpen;section.classList.toggle("ps-closed",!this.profileOpen);header.setAttribute("aria-expanded",String(!!this.profileOpen));};
  }
  apiStatus(){
    const UI=window.__DEEPAL_COMPANION_UI,state=this._hass?.states?.[UI.resolveId(this._hass,this.config||{},"binary_sensor.cloud_connection")]?.state;
    return state==="on"?"ok":state==="off"||state==="unavailable"?"off":"unknown";
  }
  apiBadge(){
    const s=this.apiStatus();
    const text={ok:this.t("Active"),off:this.t("Offline"),unknown:this.t("No data")}[s];
    const title={ok:this.t("Deepal Alternative is connected to the vehicle cloud."),off:this.t("Deepal Alternative has lost the vehicle cloud connection."),unknown:this.t("The Deepal Alternative connection status is not available yet.")}[s];
    return '<span class="api-badge" data-api-badge data-state="'+s+'" title="'+escape(title)+'" role="status"><i aria-hidden="true"></i><span>'+escape(text)+'</span></span>';
  }
  paintApiBadge(){
    const badge=this.shadowRoot.querySelector("[data-api-badge]");
    if(!badge||badge.dataset.state===this.apiStatus())return;
    const holder=document.createElement("template");holder.innerHTML=this.apiBadge();badge.replaceWith(holder.content.firstChild);
  }
  setupInstructions(admin){
    const t=text=>escape(this.t(text));
    if(!admin)return '<section class="box vehicle-setup"><ha-icon icon="mdi:car-info" aria-hidden="true"></ha-icon><h2>'+t('Vehicle setup is needed')+'</h2><p>'+t('Ask an administrator to set up Deepal Companion or give your account access to the vehicle.')+'</p><button data-action="retry-setup">'+t('Check again')+'</button></section>';
    return '<section class="box vehicle-setup"><ha-icon icon="mdi:car-electric" aria-hidden="true"></ha-icon><h2>'+t('Set up your vehicle')+'</h2><p>'+t('No vehicle is ready in Deepal Companion yet.')+'</p><ol><li>'+t('Configure Deepal Alternative and check that your vehicle sensors are available.')+'</li><li>'+t('Open Settings → Devices & services → Add integration → Deepal Companion')+'</li><li>'+t('Confirm your vehicle, then return here.')+'</li></ol><div class="setup-actions"><a href="/config/integrations/dashboard?add=deepal_companion">'+t('Set up Deepal Companion')+'</a><button data-action="retry-setup">'+t('Check again')+'</button></div><p class="note setup-help">'+t('Already set up? Check the integration for an error, reload it, then tap Check again.')+'</p></section>';
  }
  status(message,kind="info"){

    if(kind==='info'&&/save.*changes|save or cancel/i.test(message||''))kind='warning';
    clearTimeout(this.statusTimer);this.message=message;this.unsavedWarning=["Save or cancel your changes first.","Save your changes first.","Save your changes before switching card profiles."].some(k=>message===this.t(k));
    const shown=kind==="error"?window.__DEEPAL_COMPANION_UI.tError(message):message;const node=this.shadowRoot.querySelector(".status");if(node){node.textContent=shown;node.hidden=!message;node.dataset.kind=kind;}
    if(message&&kind==="success")this.statusTimer=setTimeout(()=>this.status(""),2000);
  }
  async mount(){
    this.refreshHealthBadge();
    if(!this.selected.vehicle_id)return;
    const revision=this.mountRevision=(this.mountRevision||0)+1;
    this.localBoard?.destroy();this.localBoard=null;
    this.context?._compEnergyHost?.energyCleanup?.();
    this.previewObserver?.disconnect();window.removeEventListener('resize',this.previewWindowResize);this.previewWindowResize=null;
    this.preview?.remove();this.preview=null;this.settings=null;this.costs=null;this.context=null;
    try{
      const response=await this.request("config_get");
      if(revision!==this.mountRevision)return;
      (this.revisions||(this.revisions=new Map())).set(this.selected.vehicle_id+"|"+this.selected.view_id,response.revision);
      this.config=response.config;
      window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
      this.context=window.__DEEPAL_COMPANION_UI.context(this._hass,this.selected,this.config);
      const stage=this.shadowRoot.querySelector(".stage");stage.innerHTML="";const head=this.pageHead(this.mode);if(head)stage.append(head);
      if(this.mode==="settings"){
        const widget=document.createElement(window.__DEEPAL_COMPANION_UI.settingsTag);
        widget.mode="card";widget.tab=this.tab;widget.hass=this._hass;
        widget.yamlBase={...this.config,type:"custom:deepal-companion-card",...this.selected};
        widget.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);
        widget.onTab=tab=>{this.tab=tab;};
        const widgetOwner={...this.selected};
        widget.onPatch=patch=>this.patch(patch,false,widgetOwner);
        this.settings=widget;window.__DEEPAL_COMPANION_UI.mountAppSettings(this,stage,widget,response.view_name);this.setupPreview();syncProfileDesign(this);window.__DEEPAL_COMPANION_UI.updateAppSettings(this);
      }else if(this.mode==="notifications"){
        const module=await import("./companion-notifications.js?v=2.0.1-b1&rev=20261126-01");if(revision!==this.mountRevision)return;const board=await module.mountNotifications(this,stage);if(revision!==this.mountRevision){board?.destroy();return;}this.localBoard=board;
        if(board){const pre=await this.mountPreconditionSection(stage,"notifications",revision);if(revision===this.mountRevision)await this.mountLanguageBox(stage,revision);if(pre){const destroy=board.destroy.bind(board);board.destroy=()=>{pre.destroy();destroy();};}}
      }else if(this.mode==="preconditioning"){
        const page=await this.mountPreconditionSection(stage,"settings",revision);if(page)this.localBoard=page;
      }else if(this.mode==="logs"){
        const module=await import("./companion-car-log.js?v=2.0.1-b1&rev=20261126-01");if(revision!==this.mountRevision)return;const page=await module.mountCarLog(this,stage);if(revision!==this.mountRevision){page?.destroy();return;}this.localBoard=page;
      } else if(this.mode==="health"){
        const module=await import("./companion-health.js?v=2.0.1-b1&rev=20261126-01");if(revision!==this.mountRevision)return;const page=await module.mountHealth(this,stage);if(revision!==this.mountRevision){page?.destroy();return;}this.localBoard=page;
      }else if(this.mode==="chargers"){
        await window.__DEEPAL_COMPANION_UI.loadEnergy();
        if(revision!==this.mountRevision)return;
        const energy=window.__DEEPAL_COMPANION_ENERGY;
        if(!energy?.ChargingCosts)throw Error(this.t("Charging settings could not be loaded."));
        const host=document.createElement("div");host.className="enpanel charging-settings";
        host.innerHTML="<style>"+energy.styles+'</style><h3 class="charging-section-title">'+escape(this.t("Charging profiles"))+'</h3><div class="cc-editor"></div>';
        stage.append(host);
        const manager=new energy.ChargingCosts(this.context,host);this.costs=manager;manager.onSaved=()=>this.status(this.t("Saved"),"success");manager.onCanceled=()=>this.status(this.t("Changes canceled"),"success");manager.onDirtyChange=dirty=>{if(!dirty&&this.unsavedWarning)this.status("");};await manager.ready;
        if(revision!==this.mountRevision)return;
        manager.editor="profiles";manager.editorNode=host.querySelector(".cc-editor");
        manager.model={chg:[],days:[],t0:Date.now(),now:Date.now()};
        manager.ctx={cap:this.context._battKwh(),fmt:{hm:()=>""}};
        manager.history=async()=>{};manager.decorate=()=>manager.renderEditor();
        manager.renderEditor();
        /* the charger limit sits under the profiles: one small block, no page of its own */
        try{const limit=await import("./companion-charger.js?v=2.0.1-b1&rev=20261126-01").then(m=>m.mountCharger(this,stage,{embedded:true}));if(revision!==this.mountRevision){limit?.destroy();return;}this.localBoard=limit;}catch(error){console.warn("Charger limit could not load",error);}
      }else {await window.__DEEPAL_COMPANION_UI.loadEnergy();if(revision!==this.mountRevision)return;await this.showHistory(stage,revision);if(revision===this.mountRevision)this.attachHistoryEditor(stage);}
    }catch(error){if(revision!==this.mountRevision)return;this.status(error.message||String(error),'error');const stage=this.shadowRoot.querySelector('.stage');if(stage){const head=stage.querySelector(':scope>.page-head');stage.innerHTML='<section class="box"><p role="alert">'+escape(/Unknown Companion operation/i.test(error.message||String(error))?'Restart Home Assistant to load the updated Companion backend, then try again.':window.__DEEPAL_COMPANION_UI.tError(error.message)||String(error))+'</p><button data-action="retry-page">Try again</button></section>';if(head)stage.prepend(head);}}
  }
  async loadConfig(){
    const owner={...this.selected},response=await this.request("config_get");
    if(owner.vehicle_id!==this.selected.vehicle_id||owner.view_id!==this.selected.view_id||this.pending)return;
    (this.revisions||(this.revisions=new Map())).set(owner.vehicle_id+"|"+owner.view_id,response.revision);
    if(JSON.stringify(this.config)===JSON.stringify(response.config))return;
    this.config=response.config;syncProfileDesign(this);
    window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
    if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
    window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
  }
  updatePreviewNote(){
    const note=this.shadowRoot.querySelector('.preview-mode-note'),frame=this.shadowRoot.querySelector('.preview-window');
    if(note)note.textContent=this.previewMode&&this.previewMode!=='live'?(this.previewClicks?this.t("Demo preview: clicks only change the simulation; nothing is sent to your car."):this.t("Demo preview · no vehicle commands.")):this.previewClicks?this.t("Live controls enabled · actions affect your vehicle."):this.t("Showing live vehicle data.");
    if(note){note.classList.toggle('preview-info',!!this.previewMode&&this.previewMode!=='live');note.setAttribute('role','note');}
    if(note&&this.previewMode==='charge-detected')note.textContent=this.config?.hidden?.includes('reminder')?'Turn on Charging reminder in Layout → Sections to preview it.':'Demo charging reminder · enable Allow clicks to test. No real costs are saved.';
    if(frame)frame.setAttribute('role',this.previewClicks?'group':'img');
  }
  setupPreview(){
    const frame=this.shadowRoot.querySelector(".preview-window");if(!frame)return;
    this.preview=window.__DEEPAL_COMPANION_UI.preview(this._hass,this.selected,{...this.config,companion_design:window.__DEEPAL_COMPANION_UI.design(this.config,this.vehicles.find(v=>v.id===this.selected.vehicle_id)?.views.find(v=>v.id===this.selected.view_id)?.name).kind});frame.append(this.preview);
    window.__DEEPAL_COMPANION_UI.applyPreview(this.preview,this._hass,this.previewMode||"live",!!this.previewClicks);
    const previewOwner={...this.selected};this.preview._patch=patch=>this.patch(patch,false,previewOwner);this.updatePreviewNote();
    const preview=this.preview;
    const resize=()=>{
      if(this.preview!==preview||!frame.isConnected)return;
      const width=frame.clientWidth||400,inner=preview.shadowRoot?.querySelector('ha-card');
      /* if the card content is wider than its box (the box was squeezed), give the box the content width so the whole card is scaled instead of cut off */
      if(inner&&inner.scrollWidth>preview.offsetWidth+1)preview.style.minWidth=inner.scrollWidth+'px';
      const height=preview.offsetHeight||560,cardWidth=preview.offsetWidth||560;
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
    this.status(this.t("Saving…"),"saving");
    this.queue=this.queue.catch(()=>{}).then(async()=>{
      const rk=owner.vehicle_id+"|"+owner.view_id,revisions=this.revisions||(this.revisions=new Map());
      const response=await this.request("config_patch",{patch,reset,expected_revision:revisions.get(rk)},owner);
      revisions.set(rk,response.revision);
      batch.confirmed=response.config;
      if(owner.vehicle_id===this.selected.vehicle_id&&owner.view_id===this.selected.view_id&&this.pending===1){
        this.config=response.config;
        if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
        window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
      }
      this.status(this.t("Saved"),"success");
    }).catch(error=>{this.status(error.message||String(error),'error');if(/changed elsewhere/i.test(error.message||""))batch.stale=true;}).finally(()=>{
      this.pending--;batch.pending--;
      if(!batch.pending){
        this.saveBatches.delete(key);
        if(owner.vehicle_id===this.selected.vehicle_id&&owner.view_id===this.selected.view_id){
          this.config=batch.confirmed;syncProfileDesign(this);window.__DEEPAL_COMPANION_UI.applyPalette(this,this.config);
          if(this.settings){this.settings.yamlBase={...this.config,type:"custom:deepal-companion-card",...owner};this.settings.cfg=window.__DEEPAL_COMPANION_UI.normalize(this.config);}
          window.__DEEPAL_COMPANION_UI.updatePreview(this.preview,this.config);window.__DEEPAL_COMPANION_UI.updateAppSettings?.(this);
          if(batch.stale)this.loadConfig().catch(()=>{});
        }
      }
    });
    return this.queue;
  }
  async showHistory(stage,revision){
    const [page,summary]=await Promise.all([this.request('sessions_page',{limit:SESSION_PAGE_SIZE,location:this.sessionLocation||'',sort:this.sessionSort||'newest'}),this.request('charging_dashboard')]);if(revision!==this.mountRevision)return;
    this.archiveRows=page.rows;this.sessionCursor=page.next_before;this.dashboardSummary=summary;this.sessionListGeneration=(this.sessionListGeneration||0)+1;this.sessionFiltering=false;
    const actions='<div class="actions"><button data-action="export">'+this.t('Export JSON')+'</button>'+(this._hass.user?.is_admin?'<button data-action="backup">'+this.t('Database backup')+'</button><button data-action="sync-recorder">'+this.t('Import older Recorder charges')+'</button><button data-action="deleted-charges">Deleted charges</button>':'')+'</div>';
    stage.innerHTML=costFrame(this,page,actions);applyCostDesign(this);renderSessionList(this);
    window.__DEEPAL_COMPANION_UI.enhanceChoices(stage,this._hass);
    if(this._hass.user?.is_admin&&(!page.curves_synced||!page.recorder_synced||Date.now()/1000-page.recorder_synced>86400))this.recoverRecorderSessions(stage,revision);
  }
  async recoverRecorderSessions(stage,revision){
    if(this.recorderRecovery)return;this.recorderRecovery=true;const context=this.context,owner={...this.selected};
    const note=document.createElement('p');note.className='cc-info recorder-recovery';note.setAttribute('role','status');note.textContent=this.t('Recovering available charging history…');stage.querySelector('.cost-design-filters')?.before(note);
    try{await window.__DEEPAL_COMPANION_UI.loadEnergy();await window.__DEEPAL_COMPANION_ENERGY.syncRecorderCharges(context);
      if(revision!==this.mountRevision||this.selected.vehicle_id!==owner.vehicle_id)return;
      const summary=await this.request('charging_dashboard',{},owner);if(revision!==this.mountRevision)return;this.dashboardSummary=summary;this.updateCostSummary();
      if(this.costGraph)this.paintCostCharts(summary);
      await this.filterSessions(this.sessionLocation||'');note.remove();
    }catch(error){if(note.isConnected){note.setAttribute('role','alert');note.textContent=this.t('Couldn’t recover charging history. Retry with Data options → Import older Recorder charges.')+' '+(error.message||String(error));}}
    finally{this.recorderRecovery=false;}
  }
  sessionFilterMarkup(locations){
    return '<div class="session-filters"><label>'+this.t('Location')+'<select name="session_location"><option value="">'+this.t('All locations')+'</option><option value="__unset__"'+(this.sessionLocation==='__unset__'?' selected':'')+'>'+this.t('Not set')+'</option>'+locations.map(location=>'<option value="'+escape(location.id)+'"'+(this.sessionLocation===location.id?' selected':'')+'>'+escape(location.name)+'</option>').join('')+'</select></label><label>'+this.t('Sort by')+'<select name="session_sort">'+[['newest','Newest first'],['oldest','Oldest first'],['highest','Highest cost'],['lowest','Lowest cost']].map(([value,label])=>'<option value="'+value+'"'+((this.sessionSort||'newest')===value?' selected':'')+'>'+this.t(label)+'</option>').join('')+'</select></label></div>';
  }
  async filterSessions(location,sort=this.sessionSort||"newest"){
    const previous=this.sessionLocation||'',previousSort=this.sessionSort||'newest',revision=this.mountRevision,generation=this.sessionListGeneration=(this.sessionListGeneration||0)+1;this.sessionLocation=location;this.sessionSort=sort;this.sessionFiltering=true;
    const list=this.shadowRoot.querySelector('.charge-session-list');list?.setAttribute('aria-busy','true');
    const more=this.shadowRoot.querySelector('[data-action=load-sessions]');if(more)more.disabled=true;
    try{const page=await this.request('sessions_page',{limit:SESSION_PAGE_SIZE,location,sort});if(revision!==this.mountRevision||generation!==this.sessionListGeneration)return;
      if(sort!=='newest'&&page.sort!==sort)throw Error('Restart Home Assistant to load database sorting, then try again.');
      this.archiveRows=page.rows;this.sessionCursor=page.next_before;renderSessionList(this);
      this.shadowRoot.querySelector('.charge-list-heading>span').textContent=this.t(page.total===1?'{0} session':'{0} sessions',page.total);this.shadowRoot.querySelector('[data-session-count]').textContent=this.t(page.total===1?'{0} session':'{0} sessions',page.total);more?.remove();if(page.has_more)list.insertAdjacentHTML('afterend','<button data-action="load-sessions">'+this.t('Load more')+'</button>');
    }catch(error){if(generation===this.sessionListGeneration&&revision===this.mountRevision){this.sessionLocation=previous;this.sessionSort=previousSort;const order=this.shadowRoot.querySelector('[name=session_sort]');if(order){order.value=previousSort;order._compPicker.value=previousSort;}const select=this.shadowRoot.querySelector('[name=session_location]');if(select){select.value=previous;select._compPicker.value=previous;}this.status(error.message||String(error),'error');}}finally{if(generation===this.sessionListGeneration){this.sessionFiltering=false;list?.removeAttribute('aria-busy');if(more?.isConnected)more.disabled=false;}}
  }
  async loadMoreSessions(button){
    if(this.sessionLoading||this.sessionFiltering||this.sessionCursor==null)return;
    this.sessionLoading=true;button.disabled=true;button.hidden=true;const pageLoader=document.createElement('div');pageLoader.className='session-page-loader';pageLoader.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');button.after(pageLoader);const revision=this.mountRevision,generation=this.sessionListGeneration;
    try{const page=await this.request('sessions_page',{limit:SESSION_PAGE_SIZE,before:this.sessionCursor,location:this.sessionLocation||'',sort:this.sessionSort||'newest'});if(revision!==this.mountRevision||generation!==this.sessionListGeneration)return;
      const known=new Set(this.archiveRows.map(row=>row.id)),rows=page.rows.filter(row=>!known.has(row.id));this.archiveRows.push(...rows);this.sessionCursor=page.next_before;
      renderSessionList(this);if(!page.has_more)button.remove();
    }catch(error){this.status(error.message||String(error),'error');}finally{pageLoader.remove();this.sessionLoading=false;button.disabled=false;button.hidden=false;button.textContent=this.t('Load more');}
  }
  sessionFormat(){
    const lang=this._hass.locale?.language||'en',currency=this._hass.config?.currency||'EUR',key=JSON.stringify([this._hass.locale,this._hass.config?.time_zone,currency]),ha=window.__DEEPAL_COMPANION_UI.format(this._hass);
    if(this._sessionFormat?.key!==key)this._sessionFormat={key,lang,number:new Intl.NumberFormat(lang,{maximumFractionDigits:2}),money:new Intl.NumberFormat(lang,{style:'currency',currency}),date:{format:ha.date},time:{format:ha.hm}};
    return this._sessionFormat;
  }
  sessionState(row){return !Number.isFinite(row.pricing?.cost)?'unpriced':row.pricing.cost===0?'free':'paid';}
  sessionCard(row){return '<article class="charge-session" data-session-start="'+escape(row.s)+'" data-cost-state="'+this.sessionState(row)+'"><div class="charge-session-body">'+this.sessionCardContent(row)+'</div></article>';}
  sessionCardContent(row){return costCardContent(this,row);}

  attachHistoryEditor(stage){
    const graph=document.createElement("div");graph.className="charging-settings";graph.innerHTML=energyChartMarkup(this,this.dashboardSummary,this.costChartPeriod||{end:Date.now(),period:7});stage.querySelector(".cost-design-filters")?.before(graph);this.costGraph=graph;bindEnergyChartZoom(this);
    this.updateCostSummary();
    
    const actions=stage.querySelector(".archive .actions");
    if(actions){
      const footer=document.createElement("footer");footer.className="archive-tools";
      footer.innerHTML='<button data-action="data-menu" aria-expanded="false"><ha-icon icon="mdi:dots-horizontal"></ha-icon>'+escape(this.t("Data options"))+'</button><div class="archive-data-menu" hidden></div>';
      stage.querySelector(".archive").append(footer);footer.querySelector(".archive-data-menu").append(actions);
    }
    const line=document.createElement("section");line.className="history-line-card";
    const pt=this.config?.powertrain,fuelCar=pt==="ev"?false:pt==="phev"?true:['fuel_range','fuel_level','fuel_volume'].some(k=>this._hass?.states?.[window.__DEEPAL_COMPANION_UI.resolveId(this._hass,this.config,'sensor.'+k)]);
    line.innerHTML='<h2>'+escape(this.t(fuelCar?"Battery & petrol history":"Battery history"))+'</h2>';
    const lineHost=document.createElement("div");lineHost.className="enpanel charging-settings history-line-chart";
    line.append(lineHost);graph.before(line);lineHost.addEventListener('energy-period',event=>this.loadCostChartPeriod(event.detail));window.__DEEPAL_COMPANION_ENERGY.panel(lineHost,this.context,{chartOnly:true});
  }
  paintCostCharts(summary=this.dashboardSummary){
    if(!this.costGraph)return;const energy=window.__DEEPAL_COMPANION_ENERGY,period=this.costChartPeriod,fmt=window.__DEEPAL_COMPANION_UI.format(this._hass);
    this.costGraph.innerHTML=energyChartMarkup(this,summary,period||{end:Date.now(),period:7});bindEnergyChartZoom(this);
  }
  async loadCostChartPeriod(period){
    this.costChartPeriod=period;const revision=this.mountRevision,generation=this.costChartGeneration=(this.costChartGeneration||0)+1,graph=this.costGraph,owner={...this.selected};if(!graph)return;
    graph.querySelectorAll('.cost-chart-loader').forEach(node=>node.remove());graph.style.minHeight=graph.getBoundingClientRect().height+'px';graph.setAttribute('aria-busy','true');const loader=document.createElement('div');loader.className='cost-chart-loader';loader.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');graph.append(loader);
    try{const summary=await this.request('charging_dashboard',{start_time:new Date(period.start).toISOString(),end_time:new Date(period.end).toISOString()},owner);if(revision!==this.mountRevision||generation!==this.costChartGeneration)return;this.dashboardSummary=summary;this.paintCostCharts(summary);this.updateCostSummary();}
    catch(error){if(revision===this.mountRevision&&generation===this.costChartGeneration)this.status(error.message||this.t('Charging charts could not be loaded.'),'error');}
    finally{loader.remove();if(revision===this.mountRevision&&generation===this.costChartGeneration){graph.style.minHeight='';graph.removeAttribute('aria-busy');}}
  }

  locationLabel(assignment){
    if(assignment?.profile?.id==="manual")return this.t("Manual charge");
    return assignment?.profile?.name||assignment?.profile?.id||this.t("Unassigned");
  }
  updateCostSummary(){updateCostHeader(this);}

  // Deleting a charge keeps it for 30 days under "Deleted charges", where it can be restored.
  async deleteSession(ident,button){
    const row=this.archiveRows?.find(r=>r.id===ident);if(!row||row.live)return;
    const f=this.sessionFormat(),when=f.date.format(new Date(row.s))+' '+f.time.format(new Date(row.s));
    if(!await this.confirmDialog(this.t('Delete this charge?'),`${when} · ${Number.isFinite(row.kwh)?f.number.format(row.kwh)+' kWh':''}${typeof row.dc==='boolean'?' · '+(row.dc?'DC':'AC'):''}. ${this.t('It leaves the lists and totals and can be restored from “Deleted charges” for 30 days.')}`,this.t('Delete')))return;
    button.disabled=true;
    try{await this.request('session_delete',{session_id:ident});this.status(this.t('Charge deleted. Restore it from "Deleted charges" within 30 days.'),'success');await this.mount();}
    catch(error){button.disabled=false;this.status(error.message||this.t('The charge could not be deleted.'),'error');}
  }
  confirmDialog(title,text,label){
    return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.className='session-price-dialog companion-confirm';window.__DEEPAL_COMPANION_UI.applyPalette(dialog,this.config);
      dialog.innerHTML='<style>.companion-confirm{box-sizing:border-box;width:min(420px,calc(100vw - 24px));margin:auto;padding:18px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:20px;color:var(--ds-fg,var(--primary-text-color,#eee));background:var(--ds-card,var(--card-background-color,#222));font-family:inherit}.companion-confirm::backdrop{background:rgba(0,0,0,.55)}.companion-confirm h2{margin:0 0 8px;font-size:16px;font-weight:600;font-family:inherit}.companion-confirm p{margin:0 0 14px;font-size:12px;line-height:1.5;color:var(--ds-fg2,var(--secondary-text-color,#aaa))}.companion-confirm .row{display:flex;justify-content:flex-end;gap:8px}.companion-confirm button{min-height:40px;padding:8px 14px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}.companion-confirm button.primary{background:rgb(var(--ds-bad,248,113,113));border-color:transparent;color:#fff;font-weight:600}</style><h2></h2><p></p><div class="row"><button type="button" data-no></button><button type="button" class="primary" data-yes></button></div>';
      dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=text;dialog.querySelector('[data-yes]').textContent=label;dialog.querySelector('[data-no]').textContent=this.t('Cancel');
      const done=value=>{dialog.remove();resolve(value);};dialog.querySelector('[data-no]').onclick=()=>done(false);dialog.querySelector('[data-yes]').onclick=()=>done(true);
      const oc=(d,f)=>{let down=false;const out=e=>{if(e.target!==d)return false;const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};d.addEventListener('pointerdown',e=>{down=out(e);});d.addEventListener('click',e=>{if(down&&out(e))f();down=false;});};oc(dialog,()=>done(false));dialog.addEventListener('cancel',event=>{event.preventDefault();done(false);});this.shadowRoot.append(dialog);dialog.showModal();});
  }
  async showDeletedCharges(){
    const dialog=document.createElement('dialog');dialog.className='session-price-dialog companion-deleted';window.__DEEPAL_COMPANION_UI.applyPalette(dialog,this.config);
    dialog.innerHTML='<style>.companion-deleted{box-sizing:border-box;width:min(560px,calc(100vw - 24px));max-height:85dvh;margin:auto;padding:16px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:20px;color:var(--ds-fg,var(--primary-text-color,#eee));background:var(--ds-card,var(--card-background-color,#222));overflow:auto;font-family:inherit}.companion-deleted::backdrop{background:rgba(0,0,0,.55)}.companion-deleted header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;min-height:44px}.companion-deleted h2{margin:0;font-size:16px;font-weight:600;font-family:inherit}.companion-deleted header button{display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:12px;background:transparent;color:inherit;cursor:pointer}.companion-deleted header svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.companion-deleted .note{font-size:11px;color:var(--ds-fg2,var(--secondary-text-color,#aaa));line-height:1.5;margin:0 0 12px}.companion-deleted ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}.companion-deleted li{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--ds-line,var(--divider-color,#444));border-radius:12px;font-size:12px}.companion-deleted li>div{flex:1 1 auto;min-width:0}.companion-deleted li strong{display:block;font-size:13px}.companion-deleted li small{color:var(--ds-fg2,var(--secondary-text-color,#aaa))}.companion-deleted li button{min-height:38px;padding:6px 12px;border:1px solid rgb(var(--ds-ok,52,211,153));border-radius:10px;background:transparent;color:rgb(var(--ds-ok,52,211,153));font:inherit;font-size:12px;cursor:pointer}.companion-deleted li button:disabled{opacity:.4}.companion-deleted </style><header><h2>'+escape(this.t("Deleted charges"))+'</h2><button type="button" aria-label="'+escape(this.t("Close"))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header><p class="note">'+escape(this.t("Deleted charges stay here for 30 days and can be restored."))+'</p><div class="body"></div>';
    const body=dialog.querySelector('.body');body.innerHTML=window.__DEEPAL_COMPANION_UI.loaderHtml('bolt');
    dialog.querySelector('header button').onclick=()=>dialog.remove();dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});
    const oc=(d,f)=>{let down=false;const out=e=>{if(e.target!==d)return false;const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};d.addEventListener('pointerdown',e=>{down=out(e);});d.addEventListener('click',e=>{if(down&&out(e))f();down=false;});};oc(dialog,()=>dialog.remove());this.shadowRoot.append(dialog);dialog.showModal();
    const f=this.sessionFormat();let changed=false;
    const paint=async()=>{try{const page=await this.request('sessions_deleted');if(!dialog.isConnected)return;
      if(!page.rows.length){body.innerHTML='<p class="cp-empty">'+escape(this.t("No deleted charges."))+'</p>';return;}
      const list=document.createElement('ul');for(const row of page.rows){const li=document.createElement('li'),left=Math.max(0,Math.ceil((row.deleted+page.undo_days*86400000-Date.now())/86400000));
        li.innerHTML='<div><strong></strong><small></small></div><button type="button">'+escape(this.t("Restore"))+'</button>';
        li.querySelector('strong').textContent=f.date.format(new Date(row.s))+' '+f.time.format(new Date(row.s))+(typeof row.dc==='boolean'?' · '+(row.dc?'DC':'AC'):'');
        li.querySelector('small').textContent=(Number.isFinite(row.kwh)?f.number.format(row.kwh)+' kWh · ':'')+(Number.isFinite(row.from)&&Number.isFinite(row.to)?f.number.format(row.from)+'% → '+f.number.format(row.to)+'% · ':'')+this.t(left===1?'{0} day left':'{0} days left',left);
        li.querySelector('button').onclick=async event=>{event.target.disabled=true;try{await this.request('session_restore',{session_id:row.id});changed=true;await paint();}catch(error){event.target.disabled=false;this.status(error.message||this.t('The charge could not be restored.'),'error');}};
        list.append(li);}
      body.replaceChildren(list);}catch(error){body.innerHTML='<p class="cp-empty"></p>';body.firstElementChild.textContent=window.__DEEPAL_COMPANION_UI.tError(error.message)||this.t('Deleted charges could not be loaded.');}};
    await paint();
    const remove=dialog.remove.bind(dialog);dialog.remove=()=>{remove();if(changed)this.mount();};
  }
  async showSessionCurve(ident){
    await this.flushAutosave();
    if(this.costs?.dirty){this.status(this.t('Save or cancel your changes first.'),'warning');return;}
    const revision=this.mountRevision,owner=this.selected.vehicle_id;
    const module=await import('./charging-curve.js?v=2.0.1-b1&rev=20261126-01');
    if(revision!==this.mountRevision||owner!==this.selected.vehicle_id||!this.isConnected)return;
    const record=this.archiveRows?.find(row=>row.id===ident),tools=this._hass.user?.is_admin&&record&&!record.live?{sessionId:ident,mode:typeof record.dc==='boolean'?(record.dc?'DC':'AC'):null,request:(op,data)=>this.request(op,data),onChanged:kind=>{this.status(kind==='deleted'?this.t('Charge deleted. Restore it from "Deleted charges" within 30 days.'):kind==='mode'?this.t('Charge type changed.'):this.t('Readings removed from the curve.'),'success');this.mount();}}:null;
    this.sessionDialog?.remove();this.sessionDialog=module.openCurveDialog(this.shadowRoot,this._hass,async()=>{const data=await this.request('session_curve',{session_id:ident}),record=this.archiveRows?.find(row=>row.id===ident);return {...data,mode:data.mode||(typeof record?.dc==='boolean'?(record.dc?'DC':'AC'):null)};},this.config,tools);
  }

  async editSession(start){
    await this.flushAutosave();
    if(this.costs?.dirty){this.status(this.t("Save your changes first."));return;}
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
    const manager=new energy.ChargingCosts(this.context,host);this.costs=manager;manager.onSaved=()=>this.status(this.t("Saved"),"success");manager.onCanceled=()=>this.status(this.t("Changes canceled"),"success");manager.onDirtyChange=dirty=>{if(!dirty&&this.unsavedWarning)this.status("");};await manager.ready;
    if(revision!==this.mountRevision)return;
    const close=()=>{if(inline.open)inline.close();inline.remove();if(this.sessionDialog===inline)this.sessionDialog=null;if(this.costs===manager)this.costs=null;};
    inline.addEventListener('cancel',event=>{event.preventDefault();if(!manager.saving)manager.cancelChanges();});const oc=(d,f)=>{let down=false;const out=e=>{if(e.target!==d)return false;const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};d.addEventListener('pointerdown',e=>{down=out(e);});d.addEventListener('click',e=>{if(down&&out(e))f();down=false;});};oc(inline,()=>{if(!manager.saving)manager.cancelChanges();});
    manager.onSaved=()=>{this.status(this.t('Saved'),'success');queueMicrotask(close);};
    manager.onCanceled=()=>{close();this.status(this.t("Changes canceled"),"success");};
    manager.editor=String(record.s);manager.editorNode=host.querySelector(".cc-editor");
    manager.model={chg:[record],days:[],t0:record.s,now:record.e};
    manager.ctx={cap:this.context._battKwh(),fmt:window.__DEEPAL_COMPANION_UI.format(this._hass)};
    manager.decorate=()=>{
      manager.renderEditor();const result=manager.result(record),assignment=manager.record(record);
      record.pricing=result;record.assignment=assignment;
      record.profile_removed=manager.profileRemoved(assignment?.profile);
      if(this.sessionLocation&&revision===this.mountRevision)this.filterSessions(this.sessionLocation);
      const row=[...this.shadowRoot.querySelectorAll(".charge-session")].find(n=>n.dataset.sessionStart===String(record.s));
      if(row)renderSessionList(this);
      this.loadCostChartPeriod(this.costChartPeriod||{start:window.__DEEPAL_COMPANION_UI.format(this._hass).dayStart(Date.now(),-6),end:Date.now(),period:7});
    };
    manager.renderEditor();
  }
  async click(event){
    const button=event.target.closest("[data-action],[data-mode]");if(!button)return;
    try{
      if(button.dataset.mode){
        await this.flushAutosave();
        if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t("Save or cancel your changes first."));return;}
        await this.navigateMode(button.dataset.mode);return;
      }
      const action=button.dataset.action;
      if(action==="retry-setup"){await this.refresh();return;}
      if(action==="retry-page"){await this.mount();return;}
      if(action==='session-view-grid'||action==='session-view-table'){this.sessionView=action==='session-view-table'?'table':'grid';renderSessionList(this);for(const button of this.shadowRoot.querySelectorAll('[data-action^="session-view-"]'))button.setAttribute('aria-pressed',String(button.dataset.action==='session-view-'+this.sessionView));return;}
      if(action==='load-sessions'){await this.loadMoreSessions(button);return;}
      if(action==='sync-recorder'){button.disabled=true;try{await window.__DEEPAL_COMPANION_ENERGY.syncRecorderCharges(this.context);await this.mount();}finally{button.disabled=false;}return;}
      if(action==="vehicle-settings"){this.settings?._setTab("vehicle");this.settings?.scrollIntoView({block:"start",behavior:"smooth"});return;}
      if(action==="dashboard-guide"){const guide=this.shadowRoot.querySelector(".dashboard-guide");if(guide){guide.open=true;guide.scrollIntoView({block:"nearest",behavior:"smooth"});}return;}
      if(action==="add-dashboard"){const module=await import("./companion-dashboard.js?v=2.0.1-b1&rev=20261126-01");await module.showDashboardAdd(this);return;}
      if(action==="edit-session"){await this.editSession(button.dataset.start);return;}
      if(action==='view-curve'){await this.showSessionCurve(button.dataset.sessionId);return;}
      if(action==='delete-session'){await this.deleteSession(button.dataset.sessionId,button);return;}
      if(action==='deleted-charges'){await this.showDeletedCharges();return;}
      if(action==="menu"){this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:true,composed:true}));return;}
      if(["rename","duplicate","create","delete"].includes(action)){
        await this.flushAutosave();
        if(this.pending||this.localBoard?.busy||this.localBoard?.dirty||this.costs?.dirty){this.status(this.t("Save or cancel your changes first."));return;}
        if(action==="delete"&&!await this.confirmDialog(this.t("Delete card profile"),this.t("Delete this card profile? Vehicle history is kept."),this.t("Delete")))return;
        const name=this.shadowRoot.querySelector('[name=profile_name]').value.trim()||"New profile";
        const result=await this.request("view",{action:action==="duplicate"?"create":action,name:action==="duplicate"?name+" (copy)":name,source:action==="duplicate"?this.selected.view_id:null});
        if(action==="create"||action==="duplicate")this.selected.view_id=result.view_id;
        this.listSignature=null;await this.refresh();return;
      }
      if(action==="data-menu"){const menu=this.shadowRoot.querySelector(".archive-data-menu");if(menu){menu.hidden=!menu.hidden;button.setAttribute("aria-expanded",String(!menu.hidden));}return;}
      if(action==="export"){
        const data=await this.request("export"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),link=document.createElement("a");
        link.href=url;link.download="deepal-companion-"+window.__DEEPAL_COMPANION_UI.format(this._hass).date(Date.now()).replaceAll("/","-")+".json";link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
      }
      if(action==="backup"){const result=await this.request("backup");this.status(this.t("Backup saved: ")+result.file);}
    }catch(error){this.status(error.message||String(error),'error');}
  }
}
if(!customElements.get("deepal-companion-panel"))customElements.define("deepal-companion-panel",DeepalCompanionPanel);
