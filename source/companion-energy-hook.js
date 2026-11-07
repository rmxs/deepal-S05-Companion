      if (hass.companionRequest) {
        const archiveRows = await hass.companionRequest("sessions", {
          start_time: new Date(t0).toISOString(), end_time: new Date(tEnd).toISOString()
        });
        const archived = archiveRows.filter(g => g.e - g.s >= MIN_CHG);
        // Preserve older Recorder sessions and prefer canonical backend records on overlap.
        m.chg = [
          ...m.chg.filter(g => !archived.some(a => a.s <= g.e && a.e >= g.s)),
          ...archived
        ].sort((a,b)=>a.s-b.s);
        for (const day of m.days) { day.n=0; day.kwh=0; }
        for (const charge of m.chg) {
          const day=m.days.find(d=>d.key===dayKey(charge.s));
          if(day){day.n++;if(charge.kwh>0)day.kwh+=charge.kwh;}
        }
      }
