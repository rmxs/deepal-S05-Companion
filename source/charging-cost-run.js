      if(costView&&hass.companionRequest){
        await costs.load();
        const available=await EN.loadChargingSessions(card),archived=available.rows;
        if(my!==reqId||stop)return;
        const charges=archived;
        const m={chg:charges,days:[],t0:charges.length?charges[0].s:real,now:real};
        const ctx={cap,lang:hass.locale?.language||hass.language||"en",fmt:K.haFmt(hass),now:real};
        costs.archiveOnly=true;
        body().innerHTML=renderChargingCosts(m,ctx);costs.decorate(m,ctx);
        if(available.warning){const note=document.createElement("p");note.className="cc-info";note.textContent=available.warning;body().prepend(note);}
        return;
      }
      costs.archiveOnly=false;
