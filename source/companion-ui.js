/* Standard choices use the same field surface as text inputs; entity pickers stay native HA. */
class CompanionChoice extends HTMLElement {
  static live=new Set();
  static resizeStyles(){for(const picker of CompanionChoice.live)picker.syncAppearance?.();}
  constructor(){
    super();this.attachShadow({mode:'open'});I18N.watch(this.shadowRoot);this.options=[];this._value='';this._disabled=false;
    this.shadowRoot.innerHTML='<style>:host{display:block;min-width:0;width:100%}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}.field{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;padding:var(--choice-padding,10px 12px);border:var(--choice-border,1px solid #444);border-radius:var(--choice-radius,11px);background:var(--choice-background,#262626);color:var(--choice-color,#eee);font:var(--choice-font,inherit);text-align:start}.field:focus-visible{outline:2px solid var(--primary-color,#63cba3);outline-offset:2px}.field:disabled{opacity:.5;cursor:default}.field span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chevron{flex:none;width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin:0 4px 4px 0;opacity:.65}.menu{position:fixed;inset:auto;margin:0;padding:5px;border:1px solid var(--divider-color,#454545);border-radius:12px;background:var(--card-background-color,#252525);color:var(--primary-text-color,#eee);box-shadow:0 12px 32px #0005;overflow:auto;overscroll-behavior:contain;z-index:10000}.menu:not(:popover-open){display:none}.option{display:block;width:100%;min-height:42px;border:0;border-radius:8px;padding:10px 12px;background:none;color:inherit;font:inherit;text-align:start;white-space:normal;overflow-wrap:anywhere}.option[aria-selected=true]{background:color-mix(in srgb,var(--primary-color,#63cba3) 18%,transparent);color:var(--primary-color,#63cba3)}.option:hover,.option:focus{outline:0;background:color-mix(in srgb,var(--primary-color,#63cba3) 12%,transparent)}</style><button class="field" type="button" aria-haspopup="listbox" aria-expanded="false"><span></span><i class="chevron" aria-hidden="true"></i></button><div class="menu" role="listbox" popover="auto"></div>';
    this.button=this.shadowRoot.querySelector('.field');this.menu=this.shadowRoot.querySelector('.menu');
    this.button.addEventListener('click',()=>this.open());
    this.button.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();this.open(event.key);}});
    this.menu.addEventListener('keydown',event=>{const items=[...this.menu.querySelectorAll('button')],index=items.indexOf(this.shadowRoot.activeElement);let next;
      if(event.key==='ArrowDown')next=(index+1)%items.length;if(event.key==='ArrowUp')next=(index-1+items.length)%items.length;if(event.key==='Home')next=0;if(event.key==='End')next=items.length-1;
      if(next!==undefined){event.preventDefault();items[next]?.focus();}if(event.key==='Escape'){event.preventDefault();this.close(true);}if(event.key==='Tab')this.close(false);
    });
    this.menu.addEventListener('toggle',()=>{const open=this.menu.matches(':popover-open');this.button.setAttribute('aria-expanded',String(open));if(!open)this.close(false);});
    this.reposition=()=>{if(this.menu.matches(':popover-open'))this.position();};
    this.onPageScroll=event=>{if(!(event.composedPath?.()||[]).includes(this.menu))this.close(false);};
  }
  connectedCallback(){if(!CompanionChoice.live.size)window.addEventListener('resize',CompanionChoice.resizeStyles);CompanionChoice.live.add(this);}
  disconnectedCallback(){CompanionChoice.live.delete(this);if(!CompanionChoice.live.size)window.removeEventListener('resize',CompanionChoice.resizeStyles);this.close(false);window.removeEventListener('resize',this.reposition);this.unwatchScroll();}
  set hass(value){} set required(value){}
  set selector(value){this.options=value.select.options;this.draw();}
  set disabled(value){this._disabled=!!value;this.button.disabled=this._disabled;if(value)this.close(false);}get disabled(){return this._disabled;}
  set value(value){this._value=value;this.draw();}get value(){return this._value;}
  draw(){const selected=this.options.find(option=>option.value===this._value);this.button.querySelector('span').textContent=selected?.label||'Choose';}
  position(){const r=this.button.getBoundingClientRect(),v=window.visualViewport,height=v?.height||innerHeight,top=v?.offsetTop||0,space=height-(r.bottom-top)-10,above=r.top-top-10;
    const down=space>=Math.min(260,above),max=Math.max(80,Math.min(320,down?space:above));
    Object.assign(this.menu.style,{left:Math.max(8,Math.min(r.left,innerWidth-Math.min(r.width,innerWidth-16)-8))+'px',width:Math.min(r.width,innerWidth-16)+'px',maxHeight:max+'px',top:(down?r.bottom+5:Math.max(top+8,r.top-Math.min(this.menu.scrollHeight,max)-5))+'px'});
  }
  open(key){if(this.disabled)return;if(this.menu.matches(':popover-open'))return this.close(true);this.menu.replaceChildren();
    this.options.forEach(option=>{const button=document.createElement('button');button.type='button';button.className='option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===this.value));button.textContent=option.label;button.addEventListener('click',()=>{this._value=option.value;this.draw();this.close(true);this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:option.value},bubbles:true,composed:true}));});this.menu.append(button);});
    this.menu.showPopover();window.addEventListener('resize',this.reposition);this.watchScroll();this.position();this.button.setAttribute('aria-expanded','true');const items=[...this.menu.children];(key==='Home'?items[0]:key==='End'?items.at(-1):items.find(item=>item.getAttribute('aria-selected')==='true')||items[0])?.focus();
  }
  watchScroll(){
    this.unwatchScroll();this.scrollRoots=new Set([window]);
    for(let node=this;node;){const root=node.getRootNode();this.scrollRoots.add(root);node=root.host||null;}
    for(const root of this.scrollRoots)root.addEventListener('scroll',this.onPageScroll,true);
  }
  unwatchScroll(){for(const root of this.scrollRoots||[])root.removeEventListener('scroll',this.onPageScroll,true);this.scrollRoots=null;}
  close(focus){if(this.menu.matches(':popover-open'))this.menu.hidePopover();window.removeEventListener('resize',this.reposition);this.unwatchScroll();this.button.setAttribute('aria-expanded','false');if(focus&&this.isConnected)this.button.focus();}
}
if(!customElements.get('deepal-companion-choice'))customElements.define('deepal-companion-choice',CompanionChoice);
/* The application mounts the complete existing settings UI directly, without a card/modal. */
window.__DEEPAL_COMPANION_UI = {
  readableError,
  /* Pages outside the card (dashboard, notifications) use the same translation dictionary as the card. */
  watchLanguage(root) { I18N.watch(root); },
  settingsTag: SETTINGS_TAG,
  version: CARD_VERSION,
  credit: CARD_CREDIT,
  normalize: config => mergeConfig(config, {}),
  resolveId,
  format: hass => haFmt(hass),
  loadEnergy,
  notificationContext: {T, resolveId, TIRES, DIAG, OPEN_ITEMS},
  settingsCss: SETTINGS_CSS,
  settingsAppCss: companionSettingsAppCss,
  loaderCss: LOADER_CSS,
  loaderHtml,
  applyPalette(element,config={}){
    const colors={ok:UI.hex2rgb(config.lvl_green||DEFAULTS.lvl_green,'52,211,153'),warn:UI.hex2rgb(config.lvl_yellow||DEFAULTS.lvl_yellow,'250,204,21'),bad:UI.hex2rgb(config.lvl_red||DEFAULTS.lvl_red,'248,113,113'),info:'121,173,255'};
    for(const [key,value]of Object.entries(colors)){element.style.setProperty('--companion-'+key,value);element.style.setProperty('--ds-'+key,value);}
  },
  design: (config,name) => companionDesign(config,name),
  enhanceChoices(root,hass){
    if(!root)return;
    for(const select of root.querySelectorAll('select')){
      if(!select._compPicker&&!customElements.get('deepal-companion-choice'))continue;/* keep the native select usable until the custom picker exists */
      select.style.colorScheme=hass?.themes?.darkMode===false?'light':'dark';
      let picker=select._compPicker;
      if(!picker){
        picker=document.createElement('deepal-companion-choice');picker.dataset.companionChoice='';select._compPicker=picker;
        picker.style.cssText='display:block;min-width:0;width:100%;';select.after(picker);select.hidden=true;
        picker.syncAppearance=()=>{if(!select.isConnected)return;const appearance=getComputedStyle(select);for(const [key,value]of Object.entries({'padding':appearance.padding,'border':appearance.border,'radius':appearance.borderRadius,'background':appearance.backgroundColor,'color':appearance.color,'font':appearance.font}))picker.style.setProperty('--choice-'+key,value);picker.style.marginTop=appearance.marginTop;};
        requestAnimationFrame(()=>picker.syncAppearance());
        const label=select.closest('label')?.childNodes[0]?.textContent?.trim()||select.getAttribute('aria-label')||select.name||'Choose';picker.button.setAttribute('aria-label',label);
        select.style.setProperty('display','none','important');
        select.addEventListener('change',()=>{picker.value=select.value;});
        picker.addEventListener('value-changed',event=>{event.stopPropagation();const value=event.detail?.value;if(typeof value==='string'&&[...select.options].some(option=>option.value===value)&&value!==select.value){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
      }
      picker.syncAppearance();
      picker.hass=hass;picker.required=true;picker.disabled=select.disabled;
      picker.selector={select:{options:[...select.options].map(option=>({value:option.value,label:T(option.textContent)})),mode:'dropdown'}};
      picker.value=select.value;
      const expected=select.value;
      Promise.resolve(picker.updateComplete).then(()=>{if(select.isConnected&&select.value===expected)picker.value=expected;});
    }
  },
  previewHass(hass,config,mode,interactive=false,card=null){
    const scenario=JSON.stringify([mode,config.prefix,config.entities]);
    if(card&&card._previewScenario!==scenario){card._previewScenario=scenario;card._previewScenarioTime=new Date().toISOString();}
    const states=mode==='live'?hass.states:{...hass.states},now=card?._previewScenarioTime||new Date().toISOString();
    const put=(key,value,attributes={})=>{const id=resolveId(hass,config,key);states[id]={...(states[id]||{}),entity_id:id,state:String(value),attributes:{...(states[id]?.attributes||{}),...attributes},last_changed:now,last_updated:now};};
    if(mode!=='live'){
      OPEN_ITEMS.forEach(([key])=>put(key,'off'));DIAG.forEach(([key])=>put(key,'off'));
      put('lock.doors','locked');put('binary_sensor.cloud_connection','on');
      const charging=mode==='ac'||mode==='dc',plugged=charging||mode==='plugged'||mode==='complete';
      put('binary_sensor.charging',charging?'on':'off');put('binary_sensor.charger_plugged',plugged?'on':'off');
      put('sensor.battery_level',mode==='complete'?100:68,{unit_of_measurement:'%'});
      put('sensor.ac_charge_current',mode==='ac'?16:0,{unit_of_measurement:'A'});put('sensor.dc_charge_current',mode==='dc'?120:0,{unit_of_measurement:'A'});put('sensor.charge_current',mode==='ac'?16:0,{unit_of_measurement:'A'});
      put('sensor.charging_type',mode==='dc'?'DC':plugged?'AC':'');put('sensor.remaining_charge_time_h_mm',charging?(mode==='dc'?'00:25':'01:20'):'00:00');
      put('sensor.last_updated',now);put('binary_sensor.climate_on',mode==='climate'?'on':'off');put('climate.cabin_climate',mode==='climate'?'cool':'off',{temperature:22,current_temperature:28,hvac_action:mode==='climate'?'cooling':'off',hvac_modes:['off','auto','cool','heat'],min_temp:16,max_temp:30});
      if(mode==='alerts'){put('binary_sensor.tire_pressure_warning','on');put('binary_sensor.12_v_battery_warning','on');}
      put('cover.trunk',mode==='doors'?'open':'closed',{current_position:mode==='doors'?100:0});
      if(mode==='doors')OPEN_ITEMS.filter(([key])=>/_door$/.test(key)||/\.(hood|trunk)$/.test(key)).forEach(([key])=>put(key,'on'));
    }
    return new Proxy(hass,{get(target,key){
      if(key==='states')return states;
      if(key==='callService')return async(domain,service,data={},targetData={})=>{
        if(!interactive)throw new Error('Enable preview clicks first.');
        if(mode==='live')return target.callService(domain,service,data,targetData);
        const ids=targetData.entity_id||data.entity_id||[],list=Array.isArray(ids)?ids:[ids];
        for(const id of list){
          const old=states[id]||{entity_id:id,state:'off',attributes:{}};let value=old.state,attributes={...old.attributes};
          if(domain==='lock')value=service==='unlock'?'unlocked':'locked';
          if(domain==='climate'){if(service==='turn_off')value='off';else if(service==='set_hvac_mode')value=data.hvac_mode;else if(service==='turn_on')value='cool';if(data.temperature!==undefined)attributes.temperature=data.temperature;put('binary_sensor.climate_on',value==='off'?'off':'on');}
          if(domain==='cover')value=service.includes('open')?'open':service.includes('close')?'closed':value;
          if(domain==='switch')value=service==='turn_off'?'off':'on';
          states[id]={...old,state:value,attributes,last_changed:new Date().toISOString(),last_updated:new Date().toISOString()};
        }
        card?._force();
      };
      if(key==='callWS')return message=>{
        if(!interactive&&!message.type?.startsWith('history/'))return Promise.reject(new Error('The preview is read-only.')); /* reading the recorded history is allowed: the card uses it for the real lock and engine times */
        if(mode==='live')return target.callWS(message);
        const read=message.type?.startsWith('history/')||message.type?.endsWith('/list')||message.type==='frontend/get_user_data'||(message.type==='deepal_companion/request'&&['list','config_get','costs_get','history','sessions','summary','charge_prompt','session_curve'].includes(message.op));
        return read?target.callWS(message):Promise.reject(new Error('Demo mode does not save vehicle or charging data.'));
      };
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});
  },
  applyPreview(card,hass,mode='live',interactive=card?._previewCanClick||false){
    if(!card||!hass)return;
    if(card._previewMode!==mode)card._previewChargePromptDone=false;
    if(mode==='charge-detected'&&!card._previewChargePromptDone){if(!card._compChargePrompt)card._compChargePrompt={id:'preview-charge',s:Date.now()-3600000,e:Date.now(),from:58,to:68,gain:10,kwh:1.84,live:false,profiles:[{id:'home',name:'Home',price:.25,free:false},{id:'work',name:'Work',price:0,free:true},{id:'ionity',name:'IONITY',price:.5,free:false}]};}
    else card._compChargePrompt=null;
    card._previewSourceHass=hass;card._previewMode=mode;
    card._last={...(mode==='live'?card._previewInitialLast:{})};card._previewCanClick=interactive;card._isCompanionPreview=true;
    card.inert=!interactive;card.toggleAttribute('aria-hidden',!interactive);card.style.pointerEvents=interactive?'auto':'none';
    card.hass=this.previewHass(hass,card._c,mode,interactive,card);
  },
  preview(hass,owner,config) {
    const card=document.createElement(TAG);
    card.setConfig({type:"custom:"+TAG,...owner});
    card._loadRemote=async()=>{};
    card._saveYaml=card._doSaveYaml=card._saveRemote=()=>{};
    card._watchChanges=()=>{};
    card._previewInitialLast={...card._last};
    card._n=function(key){const raw=this._s(key),value=raw===null?null:parseFloat(raw);return Number.isFinite(value)?value:null;};
    card._nl=function(key){return {v:this._n(key),stale:false};};
    card._compConfigSignature="read-only-preview";card._remoteLoaded=true;
    card._compViewName=config.companion_design||"mobile";
    card._yaml={...config,type:"custom:"+TAG,...owner};card._local={};
    card._c=mergeConfig(card._yaml,{});card._built=false;card._sig=null;
    card.inert=true;card.setAttribute("aria-hidden","true");
    card.style.width="960px";card.style.pointerEvents="none";
    this.applyPreview(card,hass,'live');
    return card;
  },
  updatePreview(card,config) {
    if(!card)return;
    if(card._c?.hero_view!==config.hero_view)card._hview=null;
    card._yaml={...config,type:"custom:"+TAG,...card._companion};card._local={};
    card._c=mergeConfig(card._yaml,{});card._built=false;card._sig=null;
    if(card._previewSourceHass)this.applyPreview(card,card._previewSourceHass,card._previewMode);else card._force();
  },
  context(hass, owner, config, existing=null) {
    I18N.request(hass.locale?.language || hass.language || "en");
    const context = existing || {_companion:{...owner},_c:mergeConfig(config,{})};
    context._hass = companionFacade(hass, context);
    context._battKwh = () => Number(context._c.battery_kwh)>0 ? Number(context._c.battery_kwh) : autoKwh(hass,context._c);
    return context;
  }
};
