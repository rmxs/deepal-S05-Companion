/* Companion-only layouts; the retained card controls and settings remain intact. */
const companionBellBuild=DeepalS05Card.prototype._build;
DeepalS05Card.prototype._build=function(...args){this._dgDrawn=null;return companionBellBuild.apply(this,args);};
const companionDesign = (config={},name="") => {
  const kind=["mobile","tablet","energy"].includes(config.companion_design)?config.companion_design:/tablet/i.test(name)?"tablet":/energy/i.test(name)?"energy":"mobile";
  return {kind,width:Number(config.companion_width)>0?Math.min(1600,Math.max(280,Number(config.companion_width))):{mobile:480,tablet:960,energy:720}[kind]};
};
const companionDesignCss = `
:host{width:100%;margin-inline:auto;container-type:inline-size}
ha-card[data-companion-design]{position:relative}
.sheet{pointer-events:none;background:transparent;overscroll-behavior:auto}
.sheet>.box{pointer-events:none;box-shadow:0 14px 60px #0009}.sheet.show>.box{pointer-events:auto}
ha-card[data-companion-design=energy]{display:flex;flex-direction:column}
ha-card[data-companion-design=energy]>.hero{order:1!important;max-height:240px}
ha-card[data-companion-design=energy]>.stats{order:0!important}
ha-card[data-companion-design=energy]>.actions{order:2!important}
ha-card[data-companion-design=energy]>.info{order:3!important}
ha-card[data-companion-design=energy]>.diag{order:4!important}
ha-card[data-companion-design=energy]>.charge{order:5!important}
ha-card[data-companion-design=energy]>.foot{order:7!important}
.companion-cost-launch{display:flex;align-items:center;gap:12px;align-self:stretch;min-width:0;margin:0;padding:14px;border:1px solid var(--ds-line);border-radius:18px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;text-align:left;cursor:pointer}
.companion-cost-launch .cost-icon{display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:11px;background:rgba(var(--ds-ok),.12);color:rgb(var(--ds-ok));font-size:23px;font-weight:600}.companion-cost-launch .cost-label{min-width:0;flex:1}.companion-cost-launch b{display:block;font-size:14px;font-weight:600}.companion-cost-launch small{display:block;margin-top:3px;color:var(--ds-fg2);font-size:11px}.companion-cost-launch>.i{--is:18px;color:var(--ds-fg2)}
.charge-assignment-prompt{padding:14px;border:1px solid rgba(var(--ds-ok),.3);border-radius:18px;background:rgba(var(--ds-ok),.06)}.charge-prompt-title{display:flex;align-items:center;gap:8px;font-size:13px}.charge-prompt-title .i{--is:20px;color:rgb(var(--ds-ok))}.charge-prompt-title>span{margin-left:auto;color:rgb(var(--ds-ok));font-weight:600}.charge-assignment-prompt p{font-size:11px;color:var(--ds-fg2);margin:8px 0 12px;line-height:1.5}.charge-prompt-profile{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.charge-prompt-profile select{min-width:0;width:100%;padding:10px;border:1px solid var(--ds-line);border-radius:10px;background:var(--ds-soft);color:var(--ds-fg)}.charge-assignment-prompt button{min-height:38px;padding:8px 10px;border:1px solid var(--ds-line);border-radius:9px;background:var(--ds-soft);color:var(--ds-fg);font:inherit;font-size:11px;cursor:pointer}.charge-assignment-prompt button:disabled{opacity:.4}.charge-prompt-actions{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}.charge-prompt-actions button{background:transparent;color:var(--ds-fg2)}.charge-prompt-profile>button{color:rgb(var(--ds-ok));border-color:rgba(var(--ds-ok),.3)}
@container(min-width:620px){
ha-card[data-companion-design=tablet]{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,1fr);gap:10px;align-items:start}
ha-card[data-companion-design=tablet]>.hero{grid-column:1;grid-row:1/4;align-self:stretch;min-height:320px}
ha-card[data-companion-design=tablet]>.stats{grid-column:2;grid-row:1}
ha-card[data-companion-design=tablet]>.actions{grid-column:2;grid-row:2}
ha-card[data-companion-design=tablet]>.info{grid-column:2;grid-row:3}
ha-card[data-companion-design=tablet]>.diag,ha-card[data-companion-design=tablet]>.foot,ha-card[data-companion-design=tablet]>.charge,ha-card[data-companion-design=tablet]>.companion-cost-launch{grid-column:1/-1}
}
`;
const designRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=designRender.apply(this,args);if(!this._c||!this._el?.card)return result;
  const design=companionDesign(this._c,this._compViewName);
  this.style.maxWidth=design.width+"px";this._el.card.dataset.companionDesign=design.kind;
  if(!this.shadowRoot.querySelector("style[data-companion-design]")){
    const style=document.createElement("style");style.dataset.companionDesign="";style.textContent=companionDesignCss;this.shadowRoot.append(style);
  }
  this.shadowRoot.querySelectorAll('[role=dialog]').forEach(node=>node.setAttribute("aria-modal","false"));
  if(!this._el.card.querySelector(".companion-cost-launch")){
    const button=document.createElement("button");button.className="companion-cost-launch";
    const lang=this._hass?.locale?.language||"en";
    button.innerHTML='<span class="cost-icon" aria-hidden="true">€</span><span class="cost-label"><b>'+esc(T("Charging costs"))+'</b><small>'+esc(T("Sessions & prices"))+'</small></span>'+ico("chevr");
    button.addEventListener("click",()=>{const tab=this._enEl?.querySelector('[data-en-mode="costs"]');if(tab){tab.click();return;}this._compOpenCosts=true;this._enSheet=true;this._force();});
    this._el.card.querySelector(".foot").before(button);
  }
  const costs=this._el.card.querySelector('.companion-cost-launch');this._el.costs=costs;
  costs.style.order=String(this._c.order.indexOf('costs'));costs.toggleAttribute('data-off',this._c.hidden.includes('costs'));
  return result;
};
const designConnected=DeepalS05Card.prototype.connectedCallback,designDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.connectedCallback=function(){
  designConnected.call(this);
  if(this._c&&this._el)this._paintNotificationLink();
  this._compOutside=event=>{if(this._popupBox()&&!event.composedPath().includes(this))this._closeTop();};
  document.addEventListener("pointerdown",this._compOutside,true);
};
DeepalS05Card.prototype.disconnectedCallback=function(){
  document.removeEventListener("pointerdown",this._compOutside,true);this._compOutside=null;
  designDisconnected.call(this);
};
const designKey=DeepalS05Card.prototype._key;
DeepalS05Card.prototype._key=function(event){if(event.key!=="Tab")return designKey.call(this,event);};
