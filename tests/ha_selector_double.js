/* Contract double for HA selectors; the real HA component needs Core contexts. */
customElements.define('ha-picker-field',class extends HTMLElement{
  constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.innerHTML='<style>.field{height:56px;background:#333;display:flex;align-items:center}button{font:inherit;min-width:0;border:0;background:none;color:inherit}</style><div class="field"><button class="trigger" type="button">mdi:bell-outline</button></div>';}
});
customElements.define('ha-selector',class extends HTMLElement{
  constructor(){super();this.attachShadow({mode:'open'});}
  set hass(value){this._hass=value;this.draw();}get hass(){return this._hass;}
  set selector(value){this._selector=value;this.draw();}get selector(){return this._selector;}
  set value(value){this._value=value;this.draw();}get value(){return this._value;}
  draw(){
    if(!this._selector)return;
    if(this._selector.icon){this.shadowRoot.innerHTML='<ha-picker-field></ha-picker-field>';this.shadowRoot.querySelector('ha-picker-field').shadowRoot.querySelector('button').textContent=this._value||'Choose icon';return;}
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const choices=this._selector.select?.options?.map(option=>typeof option==='string'?{value:option,label:option}:option)||[
      {value:'',label:'Choose an entity'},...Object.keys(this._hass?.states||{}).filter(id=>this._selector.entity?.include_entities?this._selector.entity.include_entities.includes(id):!this._selector.entity?.domain||id.startsWith(this._selector.entity.domain+'.')).map(id=>({value:id,label:(this._hass.states[id].attributes?.friendly_name||id)+' · '+id}))
    ];
    this.shadowRoot.innerHTML='<style>:host{display:block;min-width:0}select{box-sizing:border-box;width:100%;min-width:0;min-height:44px;padding:10px;border-radius:10px;border:1px solid var(--divider-color,#444);background:var(--card-background-color,#25272b);color:var(--primary-text-color,#eee);font:inherit;font-size:14px;color-scheme:dark}</style><select>'+choices.map(option=>'<option value="'+esc(option.value)+'">'+esc(option.label)+'</option>').join('')+'</select>';
    const select=this.shadowRoot.querySelector('select');select.value=this._value??'';select.disabled=!!this.disabled;
    select.addEventListener('change',()=>{this._value=select.value;this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:this._value},bubbles:true,composed:true}));});
  }
});
