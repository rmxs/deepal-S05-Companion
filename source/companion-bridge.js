/* New persistence boundary: profiles live in Companion SQLite; dashboard YAML is identifiers only. */
/* Home Assistant can reject a request with a plain object or a code instead of an Error, for example when the
   connection drops while the app is in the background. Callers always get an Error with readable text. */
const readableError = error => {
  if (error instanceof Error && typeof error.message === "string" && error.message) return error;
  const source = error && typeof error === "object" ? error : {};
  const inner = [source.error, source.body].find(value => value && typeof value === "object") || {};
  const code = typeof error === "number" ? error : source.code ?? inner.code;
  const text = [source.message, inner.message, source.error, error].find(value => typeof value === "string" && value.trim());
  const lost = code === 3 || /connection.?lost/i.test(String(code));
  const result = new Error(text || (lost ? "Connection to Home Assistant was lost. Try again." : "Home Assistant did not answer. Try again."));
  if (code !== undefined) result.code = code;
  return result;
};
const companionRequest = (hass, owner, op, data = {}) => hass.callWS({
  type: "deepal_companion/request", op,
  vehicle_id: owner.vehicle_id, view_id: owner.view_id, data
}).catch(error => { throw readableError(error); });
function companionFacade(hass, card) {
  return new Proxy(hass, {
    get(target, key) {
      if (key === "companionRequest") return (op, data) => companionRequest(target, card._companion, op, data);
      if (key === "companionRecorderHistory") return message => target.callWS(message);
      if (key === "callWS") return async (message) => {
        const owner = card._companion;
        if (message.key?.startsWith("deepal_charge_costs_")) {
          const key=JSON.stringify(owner),bases=card._compCostsBases??=new Map();
          const remember=value=>{bases.delete(key);bases.set(key,structuredClone(value));while(bases.size>4)bases.delete(bases.keys().next().value);};
          if(message.type === "frontend/get_user_data"){
            const response=await companionRequest(target, owner, "costs_get");
            remember(response.value);return response;
          }
          if(message.type === "frontend/set_user_data"){
            const previous=bases.get(key);
            if(!previous)throw Error('Reload charging settings before saving.');
            const changes={},expected={};
            if(JSON.stringify(previous.profiles)!==JSON.stringify(message.value.profiles)){
              changes.profiles=message.value.profiles;expected.profiles=previous.profiles;
            }
            const receipts=Object.entries(message.value.sessions||{}).filter(([id,value])=>JSON.stringify(value)!==JSON.stringify(previous.sessions?.[id]));
            if(receipts.length){changes.sessions=Object.fromEntries(receipts);expected.sessions=Object.fromEntries(receipts.map(([id])=>[id,previous.sessions?.[id]??null]));}
            if(!Object.keys(changes).length)return {};
            const response=await companionRequest(target,owner,"costs_set",{changes,expected_changes:expected});
            remember(message.value);return response;
          }
        }
        if (message.type === "history/history_during_period") {
          const [native, archive] = await Promise.allSettled([
            target.callWS(message),
            companionRequest(target, owner, "history", { entity_ids: message.entity_ids, start_time: message.start_time, end_time: message.end_time })
          ]);
          if (native.status === "rejected" && archive.status === "rejected") throw archive.reason;
          const combined = {};
          const stamp = r => typeof (r.lu ?? r.lc) === "number" ? (r.lu ?? r.lc) : Date.parse(r.last_updated || r.last_changed) / 1000;
          for (const id of message.entity_ids || []) {
            const rows = [
              ...(native.status === "fulfilled" ? native.value?.[id] || [] : []),
              ...(archive.status === "fulfilled" ? archive.value?.[id] || [] : [])
            ];
            const unique = new Map(rows.map(r => [stamp(r), r]));
            combined[id] = [...unique.values()].filter(r => Number.isFinite(stamp(r))).sort((a,b)=>stamp(a)-stamp(b));
          }
          return combined;
        }
        return target.callWS(message);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
const companionOriginalHass = Object.getOwnPropertyDescriptor(DeepalS05Card.prototype, "hass").set;
const companionOriginalConnected = DeepalS05Card.prototype.connectedCallback;
const companionOriginalDisconnected = DeepalS05Card.prototype.disconnectedCallback;
function companionQueueWrite(card,hass,owner,data){
  const queues=card._compWriteQueues||(card._compWriteQueues=new Map()),key=JSON.stringify(owner);
  const revisions=card._compRevisions||(card._compRevisions=new Map());
  // The revision is read when the write runs, so queued saves chain on the previous save's result.
  const request=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
    const response=await companionRequest(hass,owner,"config_patch",{...data,expected_revision:revisions.get(key)});
    revisions.set(key,response.revision);return response;
  });
  queues.set(key,request);
  const clear=()=>{if(queues.get(key)===request)queues.delete(key);};request.then(clear,clear);
  return request;
}
DeepalS05Card.getStubConfig = () => ({ type: "custom:deepal-companion-card" });
DeepalS05Card.prototype.setConfig = function(config) {
  const previous=this._companion;
  if(previous&&previous.vehicle_id===config.vehicle_id&&previous.view_id===config.view_id){this._compInput=config;return;}
  if(previous?.vehicle_id&&this._compDirty&&this._rawHass){
    companionQueueWrite(this,this._rawHass,{...previous},{patch:{...this._local},reset:!!this._compReset})
      .catch(error=>{this._compPreviousSaveError=error.message||String(error);if(this._c)this._toast(this._compPreviousSaveError,"error");});
  }
  clearTimeout(this._compTimer);
  this._compUnsubscribe?.();this._compUnsubscribe=null;
  this._compGeneration=(this._compGeneration||0)+1;
  this._compChargePrompt=null;this.shadowRoot.querySelector('.charge-assignment-prompt')?.remove();
  this._compFetching=false;this._compAgain=false;this._compSaving=false;this._compDirty=false;this._compReset=false;
  this._local={};this._remoteErr=false;this._compLastLoaded=false;this._hview=null;
  this._companion = { vehicle_id: config.vehicle_id, view_id: config.view_id };
  this._compInput = config;
  this._compConfigSignature = null;
  this._remoteLoaded = false;
  this._c = null;
  if (this._rawHass) this._loadRemote();
};
Object.defineProperty(DeepalS05Card.prototype, "hass", {
  set(hass) {
    this._rawHass = hass;
    companionOriginalHass.call(this, companionFacade(hass, this));
    if (this._companion && !this._compConfigSignature) this._loadRemote();
  }
});
DeepalS05Card.prototype._loadRemote = async function() {
  if (!this._rawHass || this._compFetching) { this._compAgain = true; return; }
  this._compFetching = true;
  const generation=this._compGeneration,owner={...this._companion};
  try {
    if (!owner.vehicle_id) {
      const list = await this._rawHass.callWS({type:"deepal_companion/request",op:"list"});
      if (!list.length) throw new Error(T("Add a vehicle in Deepal Companion first."));
      if(generation!==this._compGeneration)return;
      owner.vehicle_id = list[0].id;
    }
    const response = await companionRequest(this._rawHass, owner, "config_get");
    if(generation!==this._compGeneration)return;
    this._companion={vehicle_id:owner.vehicle_id,view_id:response.view_id};
    this._compViewName=response.view_name;
    this._compChargePrompt=response.charge_prompt||null;this._renderChargePrompt?.();
    const signature = JSON.stringify({...response,charge_prompt:undefined});
    // Local unsaved edits are never replaced by a subscription response.
    if (!this._compSaving && !this._compDirty && signature !== this._compConfigSignature) {
      this._compConfigSignature = signature;
      (this._compRevisions||(this._compRevisions=new Map())).set(JSON.stringify(this._companion),response.revision);
      this._yaml = { ...response.config, type:"custom:deepal-companion-card", ...this._companion };
      this._local = {};
      this._c = mergeConfig(this._yaml, {});
      if(!this._compLastLoaded){this._compLastLoaded=true;this._last=lsRead("deepal-s05-last:"+this._c.prefix)||this._last||{};}
      this._built = false; this._sig = null; this._remoteLoaded = true;
      this._cvReset(); this._force();
      if(this._compPreviousSaveError){this._toast(this._compPreviousSaveError,"error");this._compPreviousSaveError=null;}
    }
    if (!this._compUnsubscribe && this.isConnected) {
      const unsubscribe = await this._rawHass.connection.subscribeMessage(
        message => { if (message.vehicle_id === this._companion.vehicle_id) this._loadRemote(); },
        {type:"deepal_companion/subscribe"}
      );
      if(this.isConnected&&generation===this._compGeneration)this._compUnsubscribe=unsubscribe;else unsubscribe();
    }
  } catch (error) {
    if(generation!==this._compGeneration)return;
    if (!this._c) {
      console.error("Deepal Companion could not load", error);
      this.shadowRoot.innerHTML = '<ha-card style="padding:18px"><p style="margin:0 0 12px">Deepal Companion could not load. Check that Home Assistant is reachable, then try again.</p><button class="companion-retry" style="padding:8px 14px;cursor:pointer">Try again</button></ha-card>';
      this.shadowRoot.querySelector(".companion-retry")?.addEventListener("click", () => this._loadRemote());
    }
    else this._toast(readableError(error).message, "error");
  } finally {
    if(generation===this._compGeneration){this._compFetching = false;
    if (this._compAgain) { this._compAgain = false; queueMicrotask(()=>this._loadRemote()); }}
  }
};
DeepalS05Card.prototype._lsKey = function() { return "deepal-companion-view:" + this._companion?.view_id; };
DeepalS05Card.prototype._saveYaml = function(reset) {
  this._compDirty = true;
  if (reset) this._compReset = true;
  clearTimeout(this._compTimer);
  this._compTimer = setTimeout(()=>this._doSaveYaml(), 300);
};
DeepalS05Card.prototype._doSaveYaml = async function() {
  if (this._compSaving || !this._rawHass || !this._compDirty) return;
  const patch = { ...this._local }, reset = !!this._compReset;
  const generation=this._compGeneration,owner={...this._companion};
  this._compReset = false; this._compSaving = true;
  try {
    const response = await companionQueueWrite(this,this._rawHass,owner,{patch,reset});
    if(generation!==this._compGeneration)return;
    // Remove only settings that still equal the saved snapshot.
    for (const key of Object.keys(patch)) if (JSON.stringify(this._local[key]) === JSON.stringify(patch[key])) delete this._local[key];
    this._compDirty = Object.keys(this._local).length > 0 || this._compReset;
    this._yaml = {...response.config,type:"custom:deepal-companion-card",...this._companion};
    this._c = mergeConfig(this._yaml, this._local);
    this._compConfigSignature = JSON.stringify({...response,charge_prompt:undefined});
    this._remoteErr = false;
    if(reset){this._built=false;this._force();}
  } catch (error) {
    if(generation!==this._compGeneration)return;
    if(/changed elsewhere/i.test(error.message||"")){
      // Another editor saved first: drop this stale copy and show what is stored now.
      this._local={};this._compDirty=false;this._compReset=false;this._remoteErr=false;this._compConfigSignature=null;
      this._toast(T("Settings were changed elsewhere. The latest settings were loaded; repeat your change."), "error");
      queueMicrotask(()=>this._loadRemote());
    } else {
    this._remoteErr = true; this._compDirty = true;
    this._toast(T("Settings could not be saved") + ": " + (error.message || String(error)), "error");
    }
  } finally {
    if(generation===this._compGeneration){this._compSaving = false;
    if (this._compDirty && !this._remoteErr) this._saveYaml();}
  }
};
DeepalS05Card.prototype._saveRemote = function() { this._saveYaml(); };
DeepalS05Card.prototype.connectedCallback = function() {
  companionOriginalConnected.call(this);
  if (this._rawHass) this._loadRemote();
};
DeepalS05Card.prototype.disconnectedCallback = function() {
  this._compEnergyHost?.energyCleanup?.();this._compEnergyHost=null;
  clearTimeout(this._compTimer);
  if (this._compUnsubscribe) { this._compUnsubscribe(); this._compUnsubscribe = null; }
  if (this._compDirty) this._doSaveYaml();
  companionOriginalDisconnected.call(this);
  I18N.prune();
};
const companionOriginalForce = DeepalS05Card.prototype._force;
DeepalS05Card.prototype._force = function(...args) {
  const result=companionOriginalForce.apply(this,args);
  if(this._compEnergyHost&&!this._compEnergyHost.isConnected){this._compEnergyHost.energyCleanup?.();this._compEnergyHost=null;}
  return result;
};

