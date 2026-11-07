/* Each setting crosses the actual settings callback, WS save, subscription,
 * preview, card configuration and reload paths, from both editing surfaces. */
const assert=require("assert"),fs=require("fs"),path=require("path");
module.exports=async function settingsRoundtrip(page){
  const defaults=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../custom_components/deepal_companion/defaults.json"),"utf8"));
  const keys=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../custom_components/deepal_companion/setting_keys.json"),"utf8"));
  await page.evaluate(async()=>{
    const panel=document.querySelector("deepal-companion-panel");window.roundtripPrevious={...panel.selected};
    window.views.__settings_validation={car_color:"black",hero_style:"carview"};await panel.refresh();await panel.select("car","__settings_validation");
    const host=document.createElement("div");host.id="settings-validation-host";host.style.width="960px";
    const card=document.createElement("deepal-companion-card");card.id="settings-validation-card";card.setConfig({type:"custom:deepal-companion-card",vehicle_id:"car",view_id:"__settings_validation"});host.append(card);document.body.append(host);card.hass=window.testHass;
  });
  await page.waitForFunction(()=>document.getElementById("settings-validation-card")?._built&&document.querySelector("deepal-companion-panel").settings?._cfg);
  const base=await page.evaluate(()=>JSON.parse(JSON.stringify(document.getElementById("settings-validation-card")._c)));
  const catalog=await page.evaluate(()=>{
    const widget=document.querySelector("deepal-companion-panel").settings,result={};
    for(const tab of ["vehicle","layout","look","controls","charge","colours","sensors","general"]){
      widget._setTab(tab);
      for(const node of widget.shadowRoot.querySelectorAll("[data-set],[data-sset],[data-tgl]")){
        const key=node.dataset.sset?.split("|")[0]||node.dataset.set||node.dataset.tgl;
        if(key.startsWith("_"))continue;
        const item=result[key]||(result[key]={tab,options:[],kind:"event"});
        if(node.dataset.sset){item.kind="segment";item.options.push(node.dataset.sset.slice(key.length+1));}
        else if(node.dataset.tgl)item.kind="toggle";
        else if(node.tagName==="SELECT"){item.kind="select";item.options.push(...[...node.options].map(n=>n.value));}
        else {item.kind="input";item.type=node.type;}
      }
    }
    widget._setTab("vehicle");return result;
  });
  const fixed={
    prefix:"validation",name:"Settings validation vehicle",image_path:"/deepal_companion/frontend/images/car/",layers_path:"/deepal_companion/frontend/images/",image_aspect:"4 / 3",
    fuel_max:940,fuel_tank_liters:51,battery_kwh:24,image_scale:1.1,tire_min:2.2,tire_max:3.4,air_t1:21,air_t2:25,button_primary:4,toast_duration:8,
    bat_t1:25,bat_t2:55,bat_t3:75,fuel_t1:12,fuel_t2:28,fuel_t3:45,
    confirm:["unlock"],order:[...defaults.order].reverse(),hidden:["stats"],buttons:[...defaults.buttons].reverse(),buttons_hidden:["honk"],top_buttons:[...defaults.top_buttons].reverse(),top_buttons_hidden:["diag"],
    info_order:[...defaults.info_order].reverse(),diag:[],diag_mode:"all",diag_custom:[{entity:"binary_sensor.s05_cloud_connection",label:"Validation connection",icon:"info"}],diag_ignore:["binary_sensor.s05_engine_warning"],hero_show:["name","range","cloud","updated"],info:["humidity"],
    info_custom:[{entity:"sensor.s05_inside_temperature",label:"Validation temperature",icon:"thermo"}],
    entities:{...base.entities,"sensor.inside_temperature":"sensor.s05_inside_temperature"},images:{off:"/deepal_companion/frontend/images/car/hero_off.jpg"},
    climate_on_mode:"cool",companion_design:"tablet",companion_width:820
  };
  let cases=keys.map(key=>{
    const control=catalog[key];let value=fixed[key];
    if(value===undefined&&typeof defaults[key]==="boolean")value=!base[key];
    if(value===undefined&&control?.options.length){const found=control.options.find(v=>String(v)!==String(base[key]));if(found!==undefined)value=typeof defaults[key]==="number"?Number(found):found;}
    if(value===undefined&&typeof defaults[key]==="string"&&defaults[key].startsWith("#"))value="#8a6cde";
    if(value===undefined&&typeof defaults[key]==="number")value=Number(base[key])+1;
    assert.notEqual(value,undefined,"Missing explicit test value for "+key);
    assert.notDeepStrictEqual(value,base[key],"Test must change "+key);
    return {key,value,tab:control?.tab||"general",kind:control?.kind||"event",baseline:base[key]};
  });
  if(process.env.SETTING_FILTER)cases=cases.filter(item=>process.env.SETTING_FILTER.split(",").includes(item.key));
  const report={settings:keys.length,flows:["companion settings","frontend card settings"],checks:[],ui_controls:0,structured_setting_events:0};
  const output=process.env.SETTINGS_REPORT_PATH||path.resolve(__dirname,"../SETTINGS_VALIDATION.json");
  try{
    for(const flow of ["backend","frontend"]){
      if(flow==="frontend"){
        await page.evaluate(()=>{const card=document.getElementById("settings-validation-card");card._customize=true;card._force();});
        await page.waitForFunction(()=>!!document.getElementById("settings-validation-card")._setEl);
      }
      for(let i=0;i<cases.length;i++){
        const item=cases[i],start=Date.now();let method;
        try{
          method=await page.evaluate(({item,flow})=>{
            const panel=document.querySelector("deepal-companion-panel"),card=document.getElementById("settings-validation-card");
            const widget=flow==="backend"?panel.settings:card._setEl;
            widget._setTab(item.tab);
            const key=item.key,value=item.value,sr=widget.shadowRoot;
            if(item.kind==="toggle"){
              const button=[...sr.querySelectorAll("[data-tgl]")].find(n=>n.dataset.tgl===key);
              if(button&&typeof value==="boolean"){button.click();return "toggle";}
            }
            if(item.kind==="segment"){
              const button=[...sr.querySelectorAll("[data-sset]")].find(n=>n.dataset.sset===key+"|"+value);
              if(button){button.click();return "segment";}
            }
            if(["input","select"].includes(item.kind)){
              const field=[...sr.querySelectorAll("[data-set]")].find(n=>n.dataset.set===key);
              if(field&&["string","number"].includes(typeof value)){
                if(field._compPicker){field._compPicker.dispatchEvent(new CustomEvent('value-changed',{detail:{value:String(value)},bubbles:true}));return 'ha-selector';}field.value=String(value);field.dispatchEvent(new Event("change",{bubbles:true}));return item.kind;
              }
            }
            widget._emit({[key]:value});return "structured settings event";
          },{item,flow});
          await page.waitForFunction(({key,value})=>{
            const panel=document.querySelector("deepal-companion-panel"),card=document.getElementById("settings-validation-card"),equal=v=>JSON.stringify(v)===JSON.stringify(value);
            return !panel.pending&&!card._compDirty&&!card._compSaving&&equal(card._c?.[key])&&equal(panel.preview?._c?.[key])&&equal(panel.settings?._cfg?.[key]);
          },item,{timeout:12000});
          const stored=await page.evaluate(key=>window.testHass.callWS({type:"deepal_companion/request",op:"config_get",vehicle_id:"car",view_id:"__settings_validation"}).then(r=>r.config[key]),item.key);
          assert.deepStrictEqual(stored,item.value,"Stored value for "+item.key);
          await page.evaluate(async()=>{const card=document.getElementById("settings-validation-card");card._compConfigSignature=null;await card._loadRemote();});
          assert.deepStrictEqual(await page.evaluate(key=>document.getElementById("settings-validation-card")._c[key],item.key),item.value,"Reloaded value for "+item.key);
          if(item.key==="name")assert((await page.evaluate(()=>document.getElementById("settings-validation-card")._el.nm.textContent)).includes(item.value));
          if(item.key==="tile_icons")assert.equal(await page.evaluate(()=>document.getElementById("settings-validation-card")._el.card.dataset.ti),item.value);
          if(item.key==="card_padding")assert.equal(await page.evaluate(()=>document.getElementById("settings-validation-card")._el.card.dataset.pad),item.value);
          if(item.key==="hidden")assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById("settings-validation-card")._el.stats).display),"none");
          report.checks.push({flow,setting:item.key,input:method,passed:true,elapsed_ms:Date.now()-start});
          if(method==="structured settings event")report.structured_setting_events++;else report.ui_controls++;
          await page.evaluate(({key,baseline})=>document.querySelector("deepal-companion-panel").settings._emit({[key]:baseline}),item);
          await page.waitForFunction(({key,baseline})=>{
            const panel=document.querySelector("deepal-companion-panel"),card=document.getElementById("settings-validation-card");return !panel.pending&&JSON.stringify(card._c?.[key])===JSON.stringify(baseline)&&JSON.stringify(panel.preview?._c?.[key])===JSON.stringify(baseline);
          },item,{timeout:12000});
        }catch(error){
          console.log("SETTING_FAILURE",await page.evaluate(key=>{const panel=document.querySelector("deepal-companion-panel"),card=document.getElementById("settings-validation-card");return {key,stored:{...window.views.__settings_validation,...window.common}[key],card:card._c?.[key],preview:panel.preview?._c?.[key],widget:panel.settings?._cfg?.[key],local:card._local,pending:panel.pending,saving:card._compSaving,dirty:card._compDirty,fetching:card._compFetching,remoteError:card._remoteErr,lastCalls:window.calls.filter(m=>m.op==="config_patch").slice(-4)};},item.key));
          throw Error(flow+" setting "+item.key+" ("+method+"): "+error.message,{cause:error});
        }
        if((i+1)%15===0)console.log("Settings "+flow+": "+(i+1)+"/"+cases.length);
      }
    }
    report.passed=true;
  }catch(error){report.passed=false;report.error=error.message;throw error;}
  finally{
    fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    await page.evaluate(async()=>{
      const card=document.getElementById("settings-validation-card");card?._closeSheet();document.getElementById("settings-validation-host")?.remove();
      const panel=document.querySelector("deepal-companion-panel");await panel.select(window.roundtripPrevious.vehicle_id,window.roundtripPrevious.view_id);delete window.views.__settings_validation;await panel.refresh();
    });
  }
  console.log("PASS: "+report.checks.length+" one-by-one setting roundtrips; "+report.ui_controls+" actual UI controls and "+report.structured_setting_events+" structured setting events.");
  return report;
};
