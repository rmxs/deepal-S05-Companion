const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert"),{performance}=require("perf_hooks");
function load(file){const box={window:{},Intl,Date};vm.runInNewContext(fs.readFileSync(file,"utf8"),box);return box.window.__DEEPAL_S05_ENERGY;}
const current=load(path.resolve(__dirname,"../source/energy.js"));
const baseline=process.env.BASELINE_ENERGY?load(process.env.BASELINE_ENERGY):null;
const t0=1700000000000;
const normalize=value=>JSON.parse(JSON.stringify(value));
if(baseline){
  let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
  for(let scenario=0;scenario<100;scenario++){
    const a=[],d=[];let t=t0;
    for(let i=0;i<150;i++){t+=Math.ceil(random()*1200000);a.push([t,[0,8,"unavailable",18][Math.floor(random()*4)]]);if(random()>.2)d.push([t,[0,0,30,"unknown"][Math.floor(random()*4)]]);}
    assert.deepStrictEqual(normalize(current.chargeSegments(a,d,t+600000)),normalize(baseline.chargeSegments(a,d,t+600000)),"Historical charge segmentation changed");
    const raw={batt:a.map(([t],i)=>[t,Math.min(100,20+i/3)]),ac:a,dc:d,odo:[],pow:[],fuel:[]};
    assert.deepStrictEqual(normalize(current.model(raw,t+600000,18.4,t0,0)),normalize(baseline.model(raw,t+600000,18.4,t0,0)),"Historical energy estimates changed");
  }
}
const result={equivalence_scenarios:baseline?100:0,benchmarks:[]};
for(const count of [10000,20000]){
  const ac=Array.from({length:count},(_,i)=>[t0+i*60000,(i%40)<20?8:0]),dc=ac.map(([t])=>[t,0]),now=t0+count*60000;
  const run=engine=>{const start=performance.now();const value=engine.chargeSegments(ac,dc,now);return {ms:Number((performance.now()-start).toFixed(2)),sessions:value.length};};
  const before=baseline?run(baseline):null,after=run(current);
  if(before)assert.equal(before.sessions,after.sessions);
  result.benchmarks.push({rows_per_sensor:count,before,after,speedup:before?Number((before.ms/after.ms).toFixed(1)):null});
}
console.log(JSON.stringify(result,null,2));
if(process.env.PERFORMANCE_OUTPUT)fs.writeFileSync(process.env.PERFORMANCE_OUTPUT,JSON.stringify(result,null,2)+"\n");
