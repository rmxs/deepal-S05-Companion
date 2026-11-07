const assert=require('assert'),fs=require('fs'),path=require('path');
(async()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../custom_components/deepal_companion/frontend/charging-curve.js'),'utf8'),{smoothPath,changedPoints,chargingWindow,curveRange,batteryAt,filterTransientZeros}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const points=[[0,100],[10,10],[20,12],[30,30],[40,100]],d=smoothPath(points);
 assert(!/NaN|Infinity/.test(d));assert(d.includes('C'));
 const curves=[...d.matchAll(/C([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+) ([\d.e+-]+),([\d.e+-]+)/g)];
 for(let i=0;i<curves.length;i++){const a=points[i],b=points[i+1],c=curves[i].slice(1).map(Number);for(let j=0;j<=100;j++){const t=j/100,y=(1-t)**3*a[1]+3*(1-t)**2*t*c[1]+3*(1-t)*t*t*c[3]+t**3*b[1];assert(y>=Math.min(a[1],b[1])-1e-8&&y<=Math.max(a[1],b[1])+1e-8,'Smooth line must not invent peaks');}}
 const rows=changedPoints({ac:[{lu:1,s:'8'},{lu:2,s:'8'},{lu:3,s:'16'},{lu:4,s:'unavailable'},{lu:5,s:'12'}],battery:[{lu:1,s:'40'}]},'ac','dc','battery',0);
 assert.deepEqual(rows.map(p=>p.a),[8,16,12]);assert.equal(rows[0].battery,40);assert.notEqual(rows[1].segment,rows[2].segment);
 const session=[{t:0,a:0},{t:3600000,a:8},{t:3620000,a:16},{t:3640000,a:0},{t:7200000,a:0}];
 assert.deepEqual(chargingWindow(session),session.slice(1,4),'Trim idle time and preserve the immediate stop');
 assert.deepEqual(curveRange(chargingWindow(session)),{low:8,high:16},'Stop readings do not lower the charging range');
 assert.deepEqual(chargingWindow([{t:0,a:0}]),[]);
 assert.equal(batteryAt([{t:10,battery:40},{t:20,battery:45}],5),null,'Missing percentages stay missing');assert.equal(batteryAt([{t:10,battery:40},{t:20,battery:45}],15),40,'Use the last reported percentage without interpolation');
 const spike=[{t:0,a:45,segment:0,mode:'AC'},{t:1000,a:0,segment:0,mode:'AC'},{t:2000,a:45,segment:0,mode:'AC'},{t:120000,a:0,segment:0,mode:'AC'}];
 assert.deepEqual(filterTransientZeros(spike),[spike[0],spike[2],spike[3]],'Hide a brief zero but retain the real final stop');
 assert.deepEqual(filterTransientZeros([spike[0],spike[1],{...spike[2],t:32000}]),[spike[0],spike[1],{...spike[2],t:32000}],'Keep pauses longer than 30 seconds');
 assert.equal(filterTransientZeros([spike[0],spike[1],{...spike[2],segment:1}]).length,3,'Do not bridge unknown-data segments');assert.equal(filterTransientZeros(spike).length,3);assert.equal(spike.length,4,'Original readings remain untouched');
 const dc=changedPoints({dc:[{lu:1,s:'120'},{lu:2,s:'0'}]},'ac','dc','battery',0);assert.equal(dc.at(-1).mode,'DC','Stop retains the charging mode');
 const mixed={ac:[{lu:1,s:'6'},{lu:3,s:'5.9'},{lu:5,s:'0'}],dc:[{lu:1,s:'0'},{lu:2,s:'400'},{lu:5,s:'0'}]};
 assert.deepEqual(changedPoints(mixed,'ac','dc','battery',0,'AC').map(point=>point.a),[6,5.9,0],'An AC curve must ignore readings from the DC sensor');
 assert.deepEqual(changedPoints(mixed,'ac','dc','battery',0,'DC').map(point=>point.a),[0,400,0],'A genuine DC curve must retain its own readings');
 console.log('PASS: changed readings, gap separation, no interpolation overshoot, trimmed charge time, active low/high and DC stop mode.');
})().catch(error=>{console.error(error);process.exitCode=1;});
