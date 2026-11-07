const fs=require("fs"),vm=require("vm"),cp=require("child_process"),assert=require("assert"),z=require("zlib");
const root="custom_components/deepal_companion",front=root+"/frontend";
const version=JSON.parse(fs.readFileSync(root+"/manifest.json","utf8")).version;
cp.execFileSync(process.execPath,["scripts/build-notification-design.cjs"],{stdio:"inherit"});
cp.execFileSync(process.execPath,["scripts/build-cost-design.cjs"],{stdio:"inherit"});
const original=fs.readFileSync("source/card.js","utf8");
const defaultsStart=original.indexOf("const SECTIONS ="),defaultsEnd=original.indexOf("// Keys changed from the settings UI");
const context={};vm.createContext(context);vm.runInContext(original.slice(defaultsStart,defaultsEnd)+";this.defaults=DEFAULTS",context);
fs.writeFileSync(root+"/setting_keys.json",JSON.stringify([...Object.keys(context.defaults),"companion_design","companion_width"],null,2));
fs.writeFileSync(root+"/defaults.json",JSON.stringify({...context.defaults,companion_design:"",companion_width:0},null,2));
let main=original.replace("const DEFAULTS = {",'const DEFAULTS = { companion_design: "", companion_width: 0,').replaceAll("deepal-s05-card","deepal-companion-card").replaceAll("deepal-s05-settings","deepal-companion-settings").replaceAll("__DEEPAL_S05_","__DEEPAL_COMPANION_");
// Transient display choices stay separate for independent cards, without changing their UI.
main=main.replaceAll("deepal-s05-view:"+"$"+"{this._c.prefix}","deepal-companion-view-choice:"+"$"+"{this._companion.view_id}");
main=main.replaceAll("deepal-s05-more:"+"$"+"{this._c.prefix}","deepal-companion-more:"+"$"+"{this._companion.view_id}");
main=main.replaceAll("deepal-s05-more:"+"$"+"{c.prefix}","deepal-companion-more:"+"$"+"{this._companion.view_id}");
main=main.replace(/const CARD_VERSION = "[^"]+";/,'const CARD_VERSION = '+JSON.stringify(version)+';');
const baseStart=main.indexOf("const SCRIPT_BASE ="),baseEnd=main.indexOf("})();",baseStart)+5;assert(baseStart>=0&&baseEnd>baseStart);
main=main.slice(0,baseStart)+'const SCRIPT_BASE = "/deepal_companion/frontend/";'+main.slice(baseEnd);
const bridge=fs.readFileSync("source/companion-bridge.js","utf8")+"\n"+fs.readFileSync("source/companion-editor-bridge.js","utf8")+"\n"+fs.readFileSync("source/companion-entities.js","utf8")+"\n"+fs.readFileSync("source/companion-ui.js","utf8")+"\n"+fs.readFileSync("source/companion-app-forms.js","utf8")+"\n"+fs.readFileSync("source/companion-design.js","utf8");
const hook="customElements.define(SETTINGS_TAG, DeepalS05Settings);";assert(main.includes(hook));main=main.replace(hook,bridge+"\n"+fs.readFileSync("source/companion-charge-prompt.js","utf8")+"\n"+fs.readFileSync("source/companion-charge-curve.js","utf8")+"\n"+hook);

main=main.replace('name: "Deepal S05 Control Panel"','name: "Deepal Companion"');
fs.writeFileSync(front+"/companion-card.js",main);
let energy=fs.readFileSync("source/energy.js","utf8").replaceAll("__DEEPAL_S05_","__DEEPAL_COMPANION_");
const modelHook="      const m = model(raw, tEnd, cap, t0, period, cur);";assert(energy.includes(modelHook));
energy=energy.replace(modelHook,modelHook+"\n"+fs.readFileSync("source/companion-energy-hook.js","utf8"));
energy=energy.replace('this.cacheKey=this.key+"_"+(card._hass?.user?.id||"local");','this.cacheKey=this.key+"_"+(card._hass?.user?.id||"local")+"_"+(card._companion?.vehicle_id||"");');
energy=energy.replace('  async history(m) {','  async history(m) {\n    if(this.card._hass.companionRequest){const records=this.archiveOnly?(await EN.loadChargingSessions(this.card)).rows:await this.card._hass.companionRequest("sessions",{start_time:new Date(m.t0).toISOString(),end_time:new Date(m.now).toISOString()});for(const g of m.chg){const row=records.find(r=>r.s===g.s);if(row){g.pricing=row.pricing;g.assignment=row.assignment;}}}');
energy=energy.replace('result(g){const r=this.record(g),id=r?.profile?.entity;','result(g){const r=this.record(g);if(g.pricing&&JSON.stringify(g.assignment||null)===JSON.stringify(r||null))return {...g.pricing,costEstimated:g.pricing.cost_estimated};const id=r?.profile?.entity;');
energy=energy.replace('const LOAD = () => K.loaderHtml("bolt");','EN.ChargingCosts = ChargingCosts;\nEN.styles = PCSS;\nconst LOAD = () => K.loaderHtml("bolt");');
energy=energy.replace('  let off = 0, period = 7, reqId = 0, limitT = null;','  let off = 0, period = 7, reqId = 0, limitT = null;\n  let costView=false,lastEnergyModel=null;');
energy=energy.replace('EN.panel = (d, card, options = {}) => {',fs.readFileSync("source/charging-history.js","utf8")+"\n"+fs.readFileSync("source/charging-chart.js","utf8")+"\n"+fs.readFileSync("source/charging-cost-view.js","utf8")+'\nEN.panel = (d, card, options = {}) => {');
energy=energy.replace('      const t0 = wkStart(off), tEnd =',fs.readFileSync("source/charging-cost-run.js","utf8")+'\n      const t0 = wkStart(off), tEnd =');
energy=energy.replace('  d.addEventListener("click", (e) => {',fs.readFileSync("source/charging-cost-tabs.js","utf8")+'\n  d.addEventListener("click", (e) => {');
energy=energy.replace('      body().innerHTML = view(m, ctx);','      lastEnergyModel=m;\n      body().innerHTML = view(m, ctx);');
energy=energy.replace('if (off === 0) run(false);','if (costView || off === 0) run(false);');
energy=energy.replace('if(g.pricing&&JSON.stringify(g.assignment||null)===JSON.stringify(r||null))','if(g.pricing&&JSON.stringify(g.assignment||null)===JSON.stringify(r||null))');
energy=energy.replace('this.sensorHistory={};','if(this.archiveOnly)return;\n    this.sensorHistory={};');
fs.writeFileSync(front+"/energy/energy.js",energy);
for(const file of ["charging-curve.js","companion-card.js","energy/energy.js","notification-rules.js","companion-panel.js","companion-dashboard.js","companion-notifications.js","companion-notifications-design.js","notification-design.js","profile-field.js","notification-layout.js","notification-activity.js","cost-design.js","companion-cost-design.js","loader.js",...fs.readdirSync(front+"/lang").filter(x=>x.endsWith(".js")).map(x=>"lang/"+x)]){
 if(file.startsWith("lang/"))fs.writeFileSync(front+"/"+file,fs.readFileSync(front+"/"+file,"utf8").replaceAll("__DEEPAL_S05_","__DEEPAL_COMPANION_"));
 cp.execFileSync(process.execPath,["--check",front+"/"+file]);
 fs.writeFileSync(front+"/"+file+".gz",z.gzipSync(fs.readFileSync(front+"/"+file)));
}
console.log("Companion bundles built; all JavaScript syntax checks passed.");
