/* Independent observable navigation contract. Scientific values are fixtures. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const checks=[],ok=(v,s)=>{assert(v,s);checks.push(s);console.log('PASS',s)};
const script=fs.readFileSync(path.join(__dirname,'../usbf-source.js'),'utf8');
const box=[-77.075,38.910,-77.070,38.915];
const small=(b,f=.7)=>{const x=(b[0]+b[2])/2,y=(b[1]+b[3])/2,w=(b[2]-b[0])*f/2,h=(b[3]-b[1])*f/2;return [x-w,y-h,x+w,y+h];};
const shifted=(b,dx)=>b.map((v,i)=>i%2===0?v+dx:v);
const publication=()=>({release:'USBF_v1',layout:'flat_half_degree_geographic_tiles',tile_degrees:.5,crs:'EPSG:4326',scope:'CONUS48+DC',updated_utc:'2026-10-27T22:25:21Z',tiles:1,buildings:1,files:[{path:'USBF_x-00155_y+00077.parquet',sha256:'a'.repeat(64),bytes:1024,rows:1,bbox:[-78,38,-76,40],tile_bbox:[-77.5,38.5,-77,39]}]});
async function harness(){
 const h={live:publication(),requests:0,workers:[],writes:0,timers:new Map(),events:new Map()};let timerId=0;
 const context={URL,Object,Map,Set,Date,JSON,Number,Array,Error,String,console,AbortController,
  setTimeout:(fn,ms)=>{const id=++timerId;h.timers.set(id,{fn,ms});return id},clearTimeout:id=>h.timers.delete(id),setInterval:()=>1,clearInterval(){},
  document:{baseURI:'https://example.test/',visibilityState:'visible',querySelector:()=>null,addEventListener(){},removeEventListener(){}},
  fetch:async()=>{h.requests++;return {ok:true,text:async()=>JSON.stringify(h.live)}}};
 vm.createContext(context);vm.runInContext(script,context);h.api=context.PortalUSBF;
 context.Worker=class{constructor(){h.workers.push(this)}postMessage(message){this.request=message}terminate(){this.terminated=true}};
 const sources=new Map([['buildings',{setData(data){h.writes++;this.data=data}}]]),layers=new Map();
 h.map={box:box.slice(),zoom:17,getZoom(){return this.zoom},getBounds(){const b=this.box;return {getWest:()=>b[0],getSouth:()=>b[1],getEast:()=>b[2],getNorth:()=>b[3]}},addSource:(id,s)=>sources.set(id,{...s,setData(d){this.data=d}}),getSource:id=>sources.get(id),removeSource:id=>sources.delete(id),addLayer:l=>layers.set(l.id,l),getLayer:id=>layers.get(id),removeLayer:id=>layers.delete(id),setLayoutProperty:(id,k,v)=>layers.get(id).layout[k]=v,setPaintProperty:(id,k,v)=>layers.get(id).paint[k]=v,on:(k,fn)=>h.events.set(k,fn),off:k=>h.events.delete(k)};
 h.layer={id:'buildings',cfg:h.api.entry,visible:true,color:'#287f76',opacity:.75,data:{type:'FeatureCollection',features:[]},fields:[]};
 h.layer.setData=data=>sources.get('buildings').setData(data);
 h.runTimers=()=>{for(const [id,t] of Array.from(h.timers))if(t.ms<=1000){h.timers.delete(id);t.fn()}};
 h.move=(b,z=17)=>{h.map.box=b.slice();h.map.zoom=z;h.events.get('moveend')?.();h.runTimers()};
 h.finish=(worker=h.workers.at(-1),options={})=>{
  if(options.error){worker.onmessage({data:{error:options.error}});return;}
  const x=(worker.request.bounds[0]+worker.request.bounds[2])/2,y=(worker.request.bounds[1]+worker.request.bounds[3])/2;
  const geometry={type:'Polygon',coordinates:[[[x,y],[x+.0003,y],[x+.0003,y+.0003],[x,y+.0003],[x,y]],[[x+.0001,y+.0001],[x+.0002,y+.0001],[x+.0002,y+.0002],[x+.0001,y+.0001]]]};
  const feature=h.api.normalize({usbf_id:options.id||'fixture-'+h.workers.indexOf(worker),cx:x,cy:y,source:'osm',height:12,height_missing:true,modified:null,shape_changed:false,footprint_license:'ODbL-1.0',height_license:'CC-BY-NC-4.0'},geometry);
  worker.onmessage({data:{bytes:100,limited:!!options.limited,data:{type:'FeatureCollection',features:[feature]}}});
 };
 h.api.attach(h.layer,h.map,()=>{});await new Promise(r=>setImmediate(r));return h;
}
(async()=>{
 const h=await harness();ok(h.workers.length===1,'Cold view starts one bounded source read');h.finish();
 const first=h.layer.data,writes=h.writes,loadedAt=h.layer.viewLoadedAt;
 for(const b of [box,small(box),shifted(box,.0002),small(box,1.1),box])h.move(b);
 ok(h.workers.length===1,'Same view, zoom in, nearby pan and covered zoom out start no additional read');
 ok(h.writes===writes&&h.layer.data===first,'Warm camera changes neither clear nor rewrite the rendered GeoJSON source');
 ok(h.layer.viewLoadedAt===loadedAt&&h.layer.loaded&&!h.layer.viewLoading,'Cache reuse retains original data time and ready status');
 const p=first.features[0].properties;ok(p.modified===null&&p.shape_changed===false&&p.height_missing===true&&p.height_m===12&&first.features[0].geometry.coordinates.length===2,'Original flags, inherited height and courtyard geometry survive cache reuse');
 h.move([-125,24,-66,50],4);ok(!h.layer.loaded&&h.writes===writes,'National overview does not clear the prepared neighborhood source');
 h.move(box);ok(h.layer.loaded&&h.workers.length===1&&h.writes===writes,'Returning from national zoom restores the prepared source without reads or retessellation');
 await h.layer.checkUpdates();ok(h.workers.length===1&&h.requests===2,'Same-release manual update checks publication without duplicate source work');
 h.layer.visible=false;h.layer.reload();h.layer.visible=true;h.layer.reload();ok(h.layer.loaded&&h.workers.length===1&&h.writes===writes,'Hide/show reuses original records and the prepared source');
 const next=shifted(box,.02);h.move(next);ok(h.workers.length===2&&h.layer.data===first&&h.writes===writes&&h.layer.viewLoading,'An uncached area loads in the background without blanking existing buildings');
 h.move(small(next));ok(h.workers.length===2&&!h.workers[1].terminated,'A covered in-flight request survives a zoom-in');h.finish();
 ok(h.layer.loaded&&h.layer.data!==first&&h.writes===writes+1,'A completed new neighborhood replaces the map exactly once');
 h.move(box);ok(h.workers.length===2&&h.layer.data===first&&h.writes===writes+2,'Returning to a previous neighborhood uses its decoded cache');
 h.move(shifted(box,.04));h.finish(undefined,{error:'Offline fixture'});ok(h.layer.error&&h.layer.data===first,'A failed new request preserves the last displayed records');
 const reads=h.workers.length;h.move(box);ok(!h.layer.error&&h.layer.loaded&&h.workers.length===reads,'A cached neighborhood recovers without repeating the failed read');
 h.live.files[0].sha256='b'.repeat(64);await h.layer.checkUpdates();ok(h.workers.length===reads+1&&!h.layer.loaded,'Changed published bytes invalidate old cached records');h.finish(undefined,{id:'new-release'});
 ok(h.layer.data.features[0].properties.usbf_id==='new-release'&&h.layer.featureById.size===1,'Only current-publication identities remain after release replacement');
 h.layer.stop();const after=h.workers.length;h.move(next);ok(h.workers.length===after&&!h.events.has('moveend')&&h.timers.size===0,'Layer removal releases navigation timers, listeners, worker and cache');
 const late=await harness(),oldWorker=late.workers[0];late.move(next);const newWorker=late.workers[1];late.finish(oldWorker,{id:'stale'});ok(late.writes===0&&!late.layer.loaded,'A cancelled old worker cannot publish into a newer requested area');late.finish(newWorker,{id:'current'});ok(late.layer.data.features[0].properties.usbf_id==='current','The latest requested neighborhood wins');late.layer.stop();
 const partial=await harness();partial.finish(undefined,{limited:true});ok(partial.workers.length===2&&JSON.stringify(partial.workers[1].request.bounds)===JSON.stringify(box),'A capped prefetch retries the exact requested view once');partial.finish(undefined,{limited:true});partial.move(box);ok(partial.workers.length===2&&partial.layer.viewLimited,'The exact limited view reuses its explicitly partial result');partial.move(small(box));ok(partial.workers.length===3,'A limited result is never treated as full coverage of a smaller view');partial.finish();ok(partial.layer.loaded&&!partial.layer.viewLimited,'A subsequent complete query clears the partial flag');partial.layer.stop();
 const budget=await harness();budget.finish(undefined,{error:'This view needs more than 32 MB'});ok(budget.workers.length===2&&JSON.stringify(budget.workers[1].request.bounds)===JSON.stringify(box),'Prefetch byte overflow falls back to the exact view');budget.finish(undefined,{error:'This view needs more than 32 MB'});ok(budget.workers.length===2&&budget.layer.error,'Exact-view byte overflow stops instead of retrying indefinitely');budget.layer.stop();
 const bounded=await harness();bounded.finish();for(let i=1;i<7;i++){bounded.move(shifted(box,.02*i));bounded.finish();}ok(bounded.layer.navigationMetrics.cacheEntries<=4&&bounded.layer.navigationMetrics.cacheBytes<=24*1024*1024,'Decoded navigation cache is bounded by entries and bytes');const before=bounded.workers.length;bounded.move(box);ok(bounded.workers.length===before+1,'Evicted neighborhoods perform a real read rather than using incomplete records');bounded.layer.stop();
 const cleared=await harness();cleared.finish();const kept=cleared.layer.data,keptWrites=cleared.writes;cleared.layer.clearCache();ok(cleared.layer.data===kept&&cleared.layer.loaded&&cleared.writes===keptWrites,'Explicit cache cleanup preserves displayed original records without source writes');ok(cleared.layer.navigationMetrics.cacheBytes===0&&cleared.layer.navigationMetrics.cacheEntries===0,'Explicit cleanup releases every decoded neighborhood cache entry');cleared.move(box);ok(cleared.workers.length===2,'Navigation after explicit cleanup starts a new source read');cleared.finish();cleared.layer.stop();
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
