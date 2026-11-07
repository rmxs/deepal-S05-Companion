/* One profile field: type to rename, or open its existing accessible choice menu. */
export function bindProfileField(panel){
  const root=panel.shadowRoot,input=root.querySelector('[name=profile_name]'),select=root.querySelector('[name=view]'),arrow=root.querySelector('[data-profile-choose]');
  if(!input||!select?._compPicker||!arrow)return;
  const picker=select._compPicker,field=input.parentElement;
  const style=document.createElement('style');style.textContent=':host{font-size:16px;line-height:22px}.field{display:none!important}.menu,.option{font-size:16px;line-height:22px}';picker.shadowRoot.append(style);
  const oldRect=picker.button.getBoundingClientRect.bind(picker.button);picker.button.getBoundingClientRect=()=>field.isConnected?field.getBoundingClientRect():oldRect();
  const close=picker.close.bind(picker);picker.close=focus=>{close(false);if(focus&&input.isConnected)input.focus();};
  input.setAttribute('role','combobox');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded','false');
  const open=key=>{field.dataset.picking='true';picker.open(key);};
  arrow.addEventListener('pointerdown',event=>event.preventDefault());arrow.onclick=()=>open();
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open('ArrowDown');}if(event.key==='Escape'){picker.close(false);input.value=picker.options.find(option=>option.value===picker.value)?.label||input.value;input.blur();}});
  picker.menu.addEventListener('toggle',()=>{const expanded=picker.menu.matches(':popover-open');input.setAttribute('aria-expanded',String(expanded));arrow.setAttribute('aria-expanded',String(expanded));if(!expanded){delete field.dataset.picking;input.value=picker.options.find(option=>option.value===picker.value)?.label||input.value;}});
  picker.addEventListener('value-changed',event=>{input.value=picker.options.find(option=>option.value===event.detail.value)?.label||input.value;});
}

export function syncProfileDesign(panel){
  const design=panel.shadowRoot.querySelector('[name=companion_design]'),width=panel.shadowRoot.querySelector('[name=companion_width]');if(design){design.value=panel.config?.companion_design||'';if(design._compPicker)design._compPicker.value=design.value;}if(width&&width!==panel.shadowRoot.activeElement)width.value=panel.config?.companion_width||'';
}
