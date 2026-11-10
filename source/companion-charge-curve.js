/* Optional, lazy charging-current chart. Never sends vehicle commands. */
const curveRender=DeepalS05Card.prototype._render;
DeepalS05Card.prototype._render=function(...args){
  const result=curveRender.apply(this,args);
  if(!this._c||!this._el?.card)return result;
  const enabled=this._c.charge_curve===true&&!this._c.hidden.includes('curve');
  const flowing=this._n('sensor.ac_charge_current')>.5||this._n('sensor.dc_charge_current')>.5||this._n('sensor.charge_current')>.5;
  // One zero reading in the middle of a charge must not remove and reload the curve: keep it for a minute after the last current.
  // The simulated preview follows its switch at once.
  if(flowing)this._curveSeen=Date.now();
  const charging=flowing||(!!this._curveSeen&&(!this._previewSourceHass||this._previewMode==='live')&&(this._s('binary_sensor.charging')==='on'||Date.now()-this._curveSeen<60000));
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
