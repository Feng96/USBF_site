/* Tiny publication/worker contracts for the real lazy USBF connection. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'usbf-source.js'),'utf8'),checks=[];
const clone=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(resolve=>setImmediate(resolve));
const ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
const oldRelease={name:'USBF_v1',updated:'2026-10-26T00:00:00Z',buildings:2,tiles:1};
const display={schema_version:1,type:'pmtiles',url:'https://data.source.coop/opengeos/us-buildings/USBF_display/releases/test.pmtiles',sha256:'b'.repeat(64),source_layer:'usbf',source_release:oldRelease,input_buildings:2,bounds:[-80,35,-70,45],minzoom:0,maxzoom:16,fields:['usbf_id','cx','cy','height_m']};
const publication={release:'USBF_v1',updated_utc:'2026-10-28T00:00:00Z',layout:'flat_half_degree_geographic_tiles',crs:'EPSG:4326',tile_degrees:.5,scope:'CONUS48+DC',tiles:1,buildings:2,files:[{path:'USBF_x-154_y+78.parquet',bytes:1024,rows:2,sha256:'a'.repeat(64),bbox:[-80,35,-70,45],tile_bbox:[-77,39,-76.5,39.5]}]};
const feature=(id,cx=-77,cy=39)=>({type:'Feature',properties:{usbf_id:id,cx,cy,height_m:12},geometry:{type:'Polygon',coordinates:[[[cx,cy],[cx+.0001,cy],[cx,cy+.0001],[cx,cy]]]}});
function fixture({holdPublication=false,noDisplay=false}={}){
 const requests=[],workers=[],workerMessages=[],events=new Map(),timers=new Map(),intervals=new Map(),maps=[],sources=new Map();let timerID=0,finishPublication=null,rawSetData=0,currentDisplay=clone(display);
 class ObservedMap extends Map{constructor(...args){super(...args);maps.push(this);}}
 class Worker{constructor(){workers.push(this);}postMessage(message){workerMessages.push({worker:this,...message});}terminate(){this.terminated=true;}}
 const response=data=>({ok:true,status:200,text:async()=>JSON.stringify(data)});
 const ctx={URL,Date,DOMException,AbortController,AbortSignal,Map:ObservedMap,Set,console,Worker,document:{baseURI:'http://localhost/',visibilityState:'visible',querySelector:()=>null,addEventListener:(name,handler)=>events.set(name,handler),removeEventListener:name=>events.delete(name)},setTimeout(fn,ms){timers.set(++timerID,{fn,ms});return timerID;},clearTimeout:id=>timers.delete(id),setInterval(fn,ms){intervals.set(++timerID,{fn,ms});return timerID;},clearInterval:id=>intervals.delete(id),fetch:async url=>{const value=String(url);requests.push(value);if(value.includes('/USBF_display/'))return noDisplay?{ok:false,status:404}:response(currentDisplay);if(holdPublication)return new Promise(resolve=>{finishPublication=()=>resolve(response(publication));});return response(publication);}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 const map={getSource:id=>sources.get(id),getLayer:()=>false,addSource(id,s){sources.set(id,{...s,setData(){}});},addLayer(){},getBounds:()=>({getWest:()=>-77.01,getSouth:()=>38.99,getEast:()=>-76.99,getNorth:()=>39.01}),setPaintProperty(){},setLayoutProperty(){},removeLayer(){},removeSource(){},on(name,handler){events.set('map:'+name,handler);}};
 const layer={id:'lazy-contract',cfg:{...ctx.PortalUSBF.entry},fields:[],visible:true,color:'#287f76',opacity:1,data:{type:'FeatureCollection',features:[]},setData(){rawSetData++;}};
 function dataJobs(){return workerMessages.filter(message=>message.type===undefined);}
 function complete(job,features){job.worker.onmessage({data:{id:job.id,data:{type:'FeatureCollection',features},bytes:100,networkBytes:100,limited:false}});}
 async function attach(){await ctx.PortalUSBF.prepare(layer);sources.set(layer.id,{setData(){throw Error('Raw records must never replace a PMTiles display');},setUrl(){}});ctx.PortalUSBF.attach(layer,map,()=>{});return layer;}
 return {ctx,layer,requests,workers,workerMessages,events,maps,attach,dataJobs,complete,get rawSetData(){return rawSetData;},finishPublication(){finishPublication();},setDisplay(value){currentDisplay=clone(value);}};
}
(async()=>{
 const a=fixture();await a.attach();
 for(const patch of [{benchmark:true},{input_buildings:1},{fields:['usbf_id','cx','cy','height_m','bad field']},{fields:['usbf_id','cx','cy','heigt_m']}])assert.throws(()=>a.ctx.PortalUSBF.parseDisplay({...clone(display),...patch}),/not supported/);
 ok(true,'Benchmark subsets, mismatched publication counts and unsupported display fields cannot masquerade as the national map');
 ok(a.layer.renderTiled&&a.layer.cfg.type==='viewport'&&a.layer.cfg.analysisMode==='on-demand','PMTiles display retains the logical USBF viewport and explicit analytical loader');
 ok(a.requests.length===1&&a.requests[0].includes('/USBF_display/')&&a.workers.length===0,'Preparing and attaching a published map fetches only its display manifest');
 a.events.get('map:moveend')?.();a.layer.reload();
 ok(a.requests.length===1&&a.workers.length===0,'Navigation and ordinary layer reload cannot start an original-data worker');
 const selected={layer:a.layer.id,feature:feature('building-1')},selectedRead=a.layer.ensureData({scope:'selection',selection:selected});await tick();const selectedJob=a.dataJobs().at(-1);
 ok(selectedJob.featureId==='building-1'&&selectedJob.bounds[0]===-77-.000001&&selectedJob.bounds[2]===-77+.000001,'A selected display record requests its original ID around the published cx/cy point');
 a.complete(selectedJob,[feature('building-1')]);const selectedResult=await selectedRead;
 ok(selectedResult.release.updated===publication.updated_utc&&a.layer.displayRelease.updated===oldRelease.updated&&a.layer.analysisRelease.updated===publication.updated_utc&&a.layer.displayStale,'Original-read provenance remains distinct from an older displayed PMTiles release');
 ok(selectedResult.release.files.length===1&&selectedResult.release.files[0].sha256===publication.files[0].sha256&&selectedResult.release.files[0].path===publication.files[0].path,'An analytical result records the exact original-file checksums used by the bounded query');
 ok(a.rawSetData===0&&a.layer.data.features.length===1,'An analytical result enters the raw cache without replacing the tiled map source');
 const tiny=[-77-.0000005,39-.0000005,-77+.0000005,39+.0000005],beforeArea=a.dataJobs().length,areaRead=a.layer.ensureData({scope:'view',bounds:tiny});await tick();
 ok(a.dataJobs().length===beforeArea+1,'A cached selection cannot satisfy an area request and silently omit other original buildings');
 a.complete(a.dataJobs().at(-1),[feature('building-1'),feature('building-2')]);await areaRead;
 const broad=[-77.02,38.98,-76.98,39.02],broadRead=a.layer.ensureData({scope:'view',bounds:broad});await tick();a.complete(a.dataJobs().at(-1),[feature('building-1'),feature('building-2')]);await broadRead;
 const beforeSubareas=a.dataJobs().length;
 for(let i=0;i<20;i++)await a.layer.ensureData({scope:'view',bounds:[-77.01+i*.00001,38.99,-76.99,39.01]});
 const cache=a.maps.find(m=>Array.from(m.values()).some(value=>value?.result&&typeof value.size==='number'));
 ok(a.dataJobs().length===beforeSubareas&&cache&&cache.size<=3,'Contained-area cache hits reuse the same bounded entries without adding aliases');
 const cancelRead=a.layer.ensureData({scope:'view',bounds:[-76.95,39,-76.94,39.01]});await tick();const cancelledJob=a.dataJobs().at(-1),previous=a.layer.data;
 const rejected=assert.rejects(cancelRead,error=>error.name==='AbortError');a.layer.cancelAnalysis();await rejected;a.complete(cancelledJob,[feature('cancelled')]);
 ok(a.layer.data===previous&&a.workerMessages.some(m=>m.type==='cancel'&&m.id===cancelledJob.id),'Cancellation rejects the caller and a late worker response cannot publish into the cache');
 const b=fixture({holdPublication:true});await b.attach();let metadataSettled=false;const pending=b.layer.ensureData({scope:'view',bounds:broad}).then(()=>{metadataSettled=true;},error=>{assert.strictEqual(error.name,'AbortError');metadataSettled=true;});await tick();b.layer.cancelAnalysis();await tick();
 ok(metadataSettled&&b.workers.length===0,'Cancelling during a shared publication read settles immediately before any GeoParquet request starts');b.finishPublication();await pending;await tick();
 const c=fixture({holdPublication:true});await c.attach();const controller=new AbortController();let abortedCaller=false;const abortRead=c.layer.ensureData({scope:'view',bounds:broad,signal:controller.signal}).catch(error=>{assert.strictEqual(error.name,'AbortError');abortedCaller=true;});await tick();controller.abort();await tick();
 ok(abortedCaller&&c.workers.length===0,'An individual AbortSignal cancels its metadata waiter without waiting for the shared network read');c.finishPublication();await abortRead;
 const fallback=fixture({noDisplay:true});await fallback.attach();
 ok(!fallback.layer.renderTiled&&fallback.layer.displayMode==='coverage'&&fallback.workers.length===0,'An absent PMTiles publication shows coverage without automatically loading original records');
 const fallbackRead=fallback.layer.ensureData({scope:'view',bounds:broad});await tick();fallback.complete(fallback.dataJobs().at(-1),[feature('building-1')]);await fallbackRead;
 ok(fallback.layer.displayMode==='original'&&fallback.rawSetData===1,'The explicit fallback read displays complete originals and enables the original-record table');
 const changed=fixture();await changed.attach();
 const oldRead=changed.layer.ensureData({scope:'view',bounds:broad});await tick();const oldJob=changed.dataJobs().at(-1),rejectedChanged=assert.rejects(oldRead,error=>error.code==='RELEASE_CHANGED');oldJob.worker.onmessage({data:{id:oldJob.id,error:'Source changed',code:'RELEASE_CHANGED'}});await rejectedChanged;
 const metadataReads=changed.requests.filter(url=>url.includes('/USBF_v1/')).length;
 const retry=changed.layer.ensureData({scope:'view',bounds:broad});await tick();
 ok(changed.requests.filter(url=>url.includes('/USBF_v1/')).length===metadataReads+1,'A source-version error makes the next explicit action fetch fresh publication metadata instead of waiting for the normal cache age');
 ok(changed.workerMessages.some(message=>message.type==='clear-cache'),'A source-version error invalidates both analytical batches and persistent worker ranges');
 changed.complete(changed.dataJobs().at(-1),[feature('current-publication')]);await retry;
 const currentData=a.layer.data,currentJobs=a.dataJobs().length;a.setDisplay({...display,sha256:'c'.repeat(64),source_release:{...oldRelease,updated:publication.updated_utc}});await a.layer.checkUpdates();
 ok(!a.layer.displayStale&&a.layer.displayRelease.updated===a.layer.analysisRelease.updated&&a.layer.data===currentData&&a.dataJobs().length===currentJobs,'A map publication that catches up clears the earlier-version notice without replacing analytical results or reading original data');
 for(const item of [a,b,c,fallback,changed])item.layer.stop();
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
