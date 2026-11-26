const assert=require("assert");
/* A parked car sends no data for hours while its cloud connection stays on: the "Last update" line must not turn warning-coloured then.
   With the cloud connection off, missing or unavailable, old data is still flagged. Restores the states it changes. */
module.exports=async page=>{
  const cases=[
    {name:"5 h old, cloud on",minutes:300,cloud:"on",stale:false},
    {name:"5 h old, cloud off",minutes:300,cloud:"off",stale:true},
    {name:"5 h old, cloud entity missing",minutes:300,cloud:null,stale:true},
    {name:"10 min old, cloud on",minutes:10,cloud:"on",stale:false},
  ];
  const results=await page.evaluate(async cases=>{
    const h=window.testHass,c=document.getElementById("mobile"),lu="sensor.s05_last_updated",cc="binary_sensor.s05_cloud_connection";
    const savedLu=h.states[lu],savedCc=h.states[cc],savedDesign=c._pageDesign,out=[];
    try{
      c._pageDesign="minimal";
      for(const k of cases){
        const when=new Date(Date.now()-k.minutes*60000).toISOString();
        h.states[lu]={...savedLu,state:when,last_updated:when,last_changed:when};
        if(k.cloud===null)delete h.states[cc];else h.states[cc]={...savedCc,state:k.cloud,last_updated:when,last_changed:when};
        c.hass={...h};c._force();
        const age=c.shadowRoot.querySelector(".dz-age");
        out.push({found:!!age,stale:!!age&&age.classList.contains("stale"),text:age?age.textContent.trim():""});
      }
    }finally{
      h.states[lu]=savedLu;
      if(savedCc===undefined)delete h.states[cc];else h.states[cc]=savedCc;
      c._pageDesign=savedDesign;c.hass={...h};c._force();
    }
    return out;
  },cases);
  for(let i=0;i<cases.length;i++){
    const r=results[i];
    assert(r.found,cases[i].name+": .dz-age is not rendered");
    assert.equal(/^Last update /.test(r.text),true,cases[i].name+": text changed to '"+r.text+"'");
    assert.equal(r.stale,cases[i].stale,cases[i].name+": stale class should be "+cases[i].stale+" (text: '"+r.text+"')");
  }
};
