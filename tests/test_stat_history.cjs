const assert=require('assert');
/* Statistics window for a sensor without a state class: when Home Assistant has no long-term statistics, the window falls back
   to the recorder history (at most 30 days) and shows the same rows. Mocked Home Assistant, no real data. */
module.exports=async page=>{
 const r=await page.evaluate(async()=>{
  const card=document.getElementById('mobile'),day=864e5,now=Date.now(),calls=[];
  const t=(d,h)=>{const x=new Date(now-d*day);x.setHours(h,0,0,0);return x.getTime()/1000;};
  const hist=[{s:'200',lu:t(2,6)},{s:'400',lu:t(2,12)},{s:'unavailable',lu:t(2,13)},{s:'x',lu:t(2,14)},{s:'50',lu:t(1,9)}];
  const h={callWS:async m=>{calls.push(m.type);return m.type==='recorder/statistics_during_period'?{}:{'sensor.s05_power':hist};}};
  const rows=await card._statFetch.call(Object.assign(Object.create(card),{_rawHass:h,_hass:h,_stCache:null}),'sensor.s05_power','day',now-60*day);
  const again=await card._statFetch.call(Object.assign(Object.create(card),{_rawHass:h,_hass:h,_stCache:new Map()}),'sensor.s05_power','hour',now-3*day);
  const withStats={callWS:async()=>({'sensor.s05_power':[{start:1,mean:5,min:1,max:9}]})};
  const real=await card._statFetch.call(Object.assign(Object.create(card),{_rawHass:withStats,_hass:withStats,_stCache:null}),'sensor.s05_power','day',now-5*day);
  return {calls,rows,hours:again.length,real,from:rows[0]&&rows[0].start,limit:now-31*day};
 });
 assert.deepEqual(r.calls.slice(0,2),['recorder/statistics_during_period','history/history_during_period'],'Statistics first, history only as the fallback');
 assert(r.rows.every(x=>x.h===1),'Fallback rows are marked');
 assert.equal(r.rows.length,2,'Two days have numeric readings (unavailable and text are skipped)');
 assert.deepEqual([r.rows[0].mean,r.rows[0].min,r.rows[0].max],[300,200,400],'Day bucket: mean, min, max of numeric readings');
 assert.equal(r.rows[1].mean,50);
 assert(r.hours>=2,'Hourly buckets for the 7-day view');
 assert.equal(r.real[0].mean,5,'Real statistics are used unchanged when they exist');
 assert(!r.real[0].h,'Real statistics are not marked as fallback');
 console.log('PASS: statistics window falls back to recorder history for sensors without a state class, and keeps real statistics when present.');
};
