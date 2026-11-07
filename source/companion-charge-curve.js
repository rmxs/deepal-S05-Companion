/* Optional, lazy charging-current chart. Never sends vehicle commands. */
const curveRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=curveRender.apply(this,args);
  if(!this._c||!this._el?.card)return result;
  const enabled=this._c.charge_curve===true&&!this._c.hidden.includes('curve');
  const charging=this._n('sensor.ac_charge_current')>.5||this._n('sensor.dc_charge_current')>.5||this._n('sensor.charge_current')>.5;
  if(!enabled||!charging){this._chargingCurve?.destroy();this._chargingCurve=null;this._curveLoad=null;this._el.card.querySelector(':scope > .charging-curve-block')?.remove();return result;}
  if(this._chargingCurve){this._chargingCurve.update();return result;}
  if(!this._curveLoad){
    const token={};this._curveLoad=token;
    import('/deepal_companion/frontend/charging-curve.js?v=0.1.0').then(module=>{
      if(this._curveLoad!==token||!this.isConnected)return;
      this._curveLoad=null;this._chargingCurve=module.mountCurve(this);this._chargingCurve.update();
    }).catch(()=>{if(this._curveLoad===token){this._curveLoad=null;this._toast('Charging curve could not be loaded.','error');}});
  }
  return result;
};
const curveDisconnected=DeepalS05Card.prototype.disconnectedCallback;
DeepalS05Card.prototype.disconnectedCallback=function(){this._curveLoad=null;this._chargingCurve?.destroy();this._chargingCurve=null;curveDisconnected.call(this);};
