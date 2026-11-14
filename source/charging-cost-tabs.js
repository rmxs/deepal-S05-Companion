  if(get()?.companionRequest&&!options.chartOnly){
    const tabs=document.createElement("div");tabs.className="en-cost-tabs";
    tabs.innerHTML='<button data-en-mode="energy" aria-pressed="true">'+esc(T("Energy"))+'</button><button data-en-mode="costs" aria-pressed="false">'+esc(T("Charging costs"))+'</button>';
    d.insertBefore(tabs,body());
    if(card._compOpenCosts){card._compOpenCosts=false;costView=true;tabs.querySelectorAll("button").forEach(n=>n.setAttribute("aria-pressed",String(n.dataset.enMode==="costs")));}
    tabs.addEventListener("click",event=>{
      const button=event.target.closest("[data-en-mode]");if(!button)return;
      if(costs.dirty){costs.message=T("Save or close the location editor first.");const status=costs.editorNode?.querySelector("[role=status]");if(status){status.hidden=false;status.textContent=costs.message;}return;}
      costView=button.dataset.enMode==="costs";
      tabs.querySelectorAll("button").forEach(n=>n.setAttribute("aria-pressed",String(n===button)));
      body().innerHTML=LOAD();run(true,true);
    });
  }
