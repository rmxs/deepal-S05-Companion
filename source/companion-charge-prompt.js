/* The archive, rather than a raw battery jump, owns charging assignment prompts. */
const chargePromptRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){const result=chargePromptRender.apply(this,args);this._renderChargePrompt();return result;};
DeepalS05Card.prototype._renderChargePrompt=function(){
  if(!this._el?.card)return;
  let node=this._el.card.querySelector('.charge-assignment-prompt');
  const prompt=this._compChargePrompt;
  const demo=this._isCompanionPreview&&this._previewMode==='charge-detected';
  if((this._isCompanionPreview&&!demo)||!prompt||this._c.charging_reminder===false||this._c.hidden.includes('reminder')){node?.remove();return;}
  if(!node){
    node=document.createElement('section');node.className='charge-assignment-prompt';
    node.addEventListener('change',()=>{const button=node.querySelector('[data-charge-prompt=assign]');if(button)button.disabled=!node.querySelector('select').value;});
    node.addEventListener('click',async event=>{
      const button=event.target.closest('[data-charge-prompt]');if(!button)return;
      const action=button.dataset.chargePrompt,record=this._compChargePrompt,generation=this._compGeneration;if(!record)return;
      if(this._isCompanionPreview){
        if(this._previewMode!=='charge-detected')return;
        if(action==='costs'){this._toast('Demo: open Sessions to enter a charging cost. No data was changed.','ok');return;}
        if(action==='assign'&&!node.querySelector('select').value)return;
        this._previewChargePromptDone=true;this._compChargePrompt=null;this._renderChargePrompt();
        this._toast(action==='assign'?'Demo: profile assigned. No costs were saved.':'Demo: reminder dismissed. Change the preview state to test again.','ok');return;
      }
      if(action==='costs'){this._compOpenCosts=true;this._enSheet=true;this._force();return;}
      node.querySelectorAll('button').forEach(item=>item.disabled=true);
      try{
        if(action==='assign'){
          const profile=node.querySelector('select').value;if(!profile)throw Error(T('Choose a charging profile.'));
          await companionRequest(this._rawHass,this._companion,'charge_profile_assign',{session_id:record.id,profile_id:profile});
        }else if(action==='dismiss')await companionRequest(this._rawHass,this._companion,'charge_prompt_dismiss',{session_id:record.id});
        if(generation!==this._compGeneration)return;this._compChargePrompt=null;this._renderChargePrompt();await this._loadRemote();
      }catch(error){if(generation!==this._compGeneration)return;node.querySelectorAll('button').forEach(item=>item.disabled=false);this._toast(error.message||String(error),'error');await this._loadRemote();}
    });
    if(this._el.costs)this._el.costs.before(node);else this._el.hero.parentNode.append(node); /* the Settings gear lives inside the image, so it is no longer a place to insert next to */
  }
  node.style.order=String(this._c.order.indexOf('reminder'));
  const signature=JSON.stringify(prompt);if(node.dataset.signature===signature)return;node.dataset.signature=signature;
  const selected=node.querySelector('select')?.value||'',admin=this._rawHass?.user?.is_admin;
  node.innerHTML='<div class="charge-prompt-title">'+ico('plug')+'<b>'+esc(T('Charging detected'))+'</b><span>+'+esc(new Intl.NumberFormat(this._hass?.locale?.language||'en',{maximumFractionDigits:0}).format(prompt.gain))+'%</span></div><p>'+esc(T('Assign a charging profile or enter the cost.'))+'</p>'+(admin?'<div class="charge-prompt-profile"><select aria-label="'+esc(T('Charging profile'))+'"><option value="">'+esc(T('Choose a charging profile'))+'</option>'+prompt.profiles.map(profile=>'<option value="'+esc(profile.id)+'">'+esc(profile.name||profile.id)+(profile.free?' · '+esc(T('Free')):profile.price!=null?' · '+esc(String(profile.price))+' €/kWh':'')+'</option>').join('')+'</select><button data-charge-prompt="assign" disabled>'+esc(T('Assign'))+'</button></div>':'')+'<div class="charge-prompt-actions"><button data-charge-prompt="costs">'+esc(T('Charging costs'))+' ›</button><button data-charge-prompt="dismiss">'+esc(T('Dismiss until next charge'))+'</button></div>';
  if(admin){const select=node.querySelector('select');select.value=selected;node.querySelector('[data-charge-prompt=assign]').disabled=!select.value;window.__DEEPAL_COMPANION_UI.enhanceChoices(node,this._hass);}
};
