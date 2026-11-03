/* Display-publication contract tests; no browser or real five-minute wait. */
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../usbf-source.js'),'utf8'),checks=[];
const ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
const clone=value=>JSON.parse(JSON.stringify(value));
const tile=(name,sha,bbox=[-77.51,38.49,-76.99,39.01])=>({path:name,sha256:sha.repeat(64),bytes:1024,rows:1,bbox,tile_bbox:[-77.5,38.5,-77,39]});
const publication=()=>({release:'USBF_v1',layout:'flat_half_degree_geographic_tiles',tile_degrees:.5,crs:'EPSG:4326',scope:'CONUS48+DC',updated_utc:'2026-10-27T22:25:21Z',tiles:1,buildings:1,files:[tile('USBF_x-00155_y+00077.parquet','a')]});
const display=(sha='a',updated='2026-10-27T22:25:21Z')=>({schema_version:1,type:'pmtiles',url:'https://data.source.coop/opengeos/us-buildings/USBF_display/releases/synthetic-update-qa.pmtiles',sha256:sha.repeat(64),source_layer:'usbf',source_release:{name:'USBF_v1',updated,buildings:1,tiles:1},input_buildings:1,bounds:[-77.5,38.5,-77,39],minzoom:0,maxzoom:16,fields:['usbf_id','cx','cy','height_m','source']});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({noDisplay=false}={}){
 const h={live:publication(),display:noDisplay?null:display(),failDisplay:false,requests:[],workers:[],messages:[],intervals:new Map(),timers:new Map(),listeners:new Map(),now:Date.UTC(2026,9,28,12),rawWrites:0};let nextTimer=0;
 class ClockDate extends Date{static now(){return h.now;}}
 const doc={baseURI:'https://feng96.github.io/USBF_site/',visibilityState:'visible',querySelector:()=>null,addEventListener:(name,fn)=>h.listeners.set(name,fn),removeEventListener:name=>h.listeners.delete(name)};
 const context={URL,Date:ClockDate,DOMException,AbortController,AbortSignal,console,document:doc,
  setTimeout(fn,ms){const id=++nextTimer;h.timers.set(id,{fn,ms});return id;},clearTimeout:id=>h.timers.delete(id),
  setInterval(fn,ms){const id=++nextTimer;h.intervals.set(id,{fn,ms});return id;},clearInterval:id=>h.intervals.delete(id),
  fetch:async(raw,options)=>{const url=new URL(raw);h.requests.push({url:url.href,options});const isDisplay=url.pathname.endsWith('/USBF_display/manifest.json');if(url.origin!=='https://data.source.coop'||!isDisplay&&!url.pathname.endsWith('/USBF_v1/manifest.json'))throw Error('Unexpected original-data fetch during a metadata test.');if(isDisplay&&h.failDisplay)throw Error('offline');if(isDisplay&&!h.display)return {ok:false,status:404};const body=JSON.stringify(isDisplay?h.display:h.live);return {ok:true,status:200,text:async()=>body};}};
 vm.createContext(context);vm.runInContext(source,context);h.api=context.PortalUSBF;
 context.Worker=class{
  constructor(url){this.url=String(url);h.workers.push(this);}terminate(){this.stopped=true;}
  postMessage(request){h.messages.push(request);if(request.type)return;const feature=h.api.normalize({usbf_id:'synthetic-update-original',cx:-77.071,cy:38.912,source:'osm',height:12,height_missing:true,modified:null,footprint_license:'ODbL-1.0; synthetic QA',height_license:'CC-BY-NC-4.0; synthetic QA'},{type:'Polygon',coordinates:[[[-77.071,38.912],[-77.0709,38.912],[-77.0709,38.9121],[-77.071,38.9121],[-77.071,38.912]]]});queueMicrotask(()=>{if(!this.stopped)this.onmessage({data:{id:request.id,bytes:100,networkBytes:100,limited:false,data:{type:'FeatureCollection',features:[feature]}}});});}
 };
 h.map={sources:new Map(),layers:new Map(),events:new Map(),zoom:16,
  addSource(id,spec){this.sources.set(id,{...spec,urls:[],setUrl(url){this.urls.push(url);},setData(data){this.data=data;h.rawWrites++;}});},getSource(id){return this.sources.get(id);},removeSource(id){this.sources.delete(id);},
  addLayer(layer){this.layers.set(layer.id,layer);},getLayer(id){return this.layers.get(id);},removeLayer(id){this.layers.delete(id);},setLayoutProperty(id,key,value){this.layers.get(id).layout[key]=value;},setPaintProperty(id,key,value){this.layers.get(id).paint[key]=value;},
  getZoom(){return this.zoom;},getBounds(){return {getWest:()=>-77.075,getSouth:()=>38.91,getEast:()=>-77.07,getNorth:()=>38.915};},on(name,fn){this.events.set(name,fn);},off(name){this.events.delete(name);}};
 h.layer={id:'footprints',cfg:clone(h.api.entry),visible:true,opacity:.75,color:'#287f76',fields:h.api.entry.fields.slice(),error:false};
 h.attach=async()=>{await h.api.prepare(h.layer);h.map.addSource(h.layer.id,{type:h.layer.renderTiled?'vector':'geojson'});h.layer.setData=data=>h.map.getSource(h.layer.id).setData(data);h.api.attach(h.layer,h.map,()=>{});return h.layer;};
 h.tick=async()=>{h.now+=300000;for(const timer of h.intervals.values())timer.fn();await flush();};h.foreground=async(ms=31000)=>{h.now+=ms;doc.visibilityState='visible';h.listeners.get('visibilitychange')?.();await flush();};
 h.canonical=()=>h.requests.filter(r=>new URL(r.url).pathname.endsWith('/USBF_v1/manifest.json'));h.displays=()=>h.requests.filter(r=>new URL(r.url).pathname.endsWith('/USBF_display/manifest.json'));h.doc=doc;return h;
}
(async()=>{
 const h=harness(),api=h.api,parsed=api.parseManifest(h.live);
 // Preserve the original eight scientific/source-identity checks.
 ok(parsed.count===1&&parsed.buildings===1,'Published counts are validated from the current manifest');
 ok(api.selectTiles(parsed,[-76.991,38.9,-76.9905,38.901]).length===1,'Tile selection uses actual published footprint bounds at grid edges');
 let bad=publication();bad.files[0].path='../private.parquet';assert.throws(()=>api.parseManifest(bad));ok(true,'Untrusted paths cannot escape the USBF publication');
 bad=publication();bad.buildings=2;assert.throws(()=>api.parseManifest(bad));ok(true,'Inconsistent publication totals are rejected');
 const row=api.normalize({height:12,height_missing:true,modified:null,shape_changed:false,footprint_license:'ODbL-1.0',height_license:'CC-BY-NC-4.0'},{});
 ok(row.properties.height_m===12&&row.properties.height_missing===true,'Inherited height remains available when nDSM input is missing');
 ok(row.properties.modified===null&&row.properties.shape_changed===false,'Unknown edit flags remain distinct from false');
 ok(api.normalize({height:-999},{}).properties.height_m===null,'Source missing-height sentinels are preserved and not extruded');
 ok(row.properties.footprint_license==='ODbL-1.0'&&row.properties.height_license==='CC-BY-NC-4.0','Component licenses are preserved independently');
 await h.attach();const l=h.layer,map=h.map,view=map.getSource(l.id);
 ok(h.requests.length===1&&h.displays().length===1&&h.canonical().length===0&&h.workers.length===0,'Preparing and attaching PMTiles reads only the display manifest and starts no original-data worker');
 ok(h.requests[0].options.cache==='no-store'&&h.requests[0].options.credentials==='omit'&&h.requests[0].url.includes('_check='),'Display checks bypass stale URL variants without sending credentials');
 ok(l.renderTiled&&l.loaded&&l.data.features.length===0&&l.featureById.size===0&&l.cfg.analysisMode==='on-demand','A display map starts ready while original records remain empty until requested');
 ok(Array.from(h.intervals.values())[0].ms===300000,'An open visible map checks display metadata every five minutes');
 const initial=h.requests.length;for(let i=0;i<3;i++)map.events.get('moveend')?.();l.reload();await flush();
 ok(h.requests.length===initial&&h.workers.length===0&&!map.events.has('moveend'),'Map movement and layer reload never trigger canonical metadata or GeoParquet reads');
 await l.checkUpdates();ok(h.displays().length===2&&view.urls.length===0&&h.canonical().length===0&&h.workers.length===0,'A same-checksum manual update reads display metadata without replacing tiles or loading originals');
 h.display=display('b','2026-10-28T12:01:00Z');await l.checkUpdates();
 ok(view.urls.length===1&&view.urls[0]==='pmtiles://'+h.display.url+'?v='+'b'.repeat(64)&&l.displayRelease.updated===h.display.source_release.updated,'A changed display checksum switches to a versioned PMTiles URL and records its displayed release');
 ok(l.data.features.length===0&&h.canonical().length===0&&h.workers.length===0&&h.rawWrites===0,'Manual display replacement never sends original records to the tiled source');
 h.display=display('c','2026-10-28T12:06:00Z');await h.tick();
 ok(view.urls.length===2&&view.urls[1].endsWith('?v='+'c'.repeat(64))&&h.canonical().length===0&&h.workers.length===0,'The timer discovers replacement display bytes without opening canonical data');
 const displayCount=h.displays().length;h.live.files[0].sha256='d'.repeat(64);h.live.updated_utc='2026-10-28T12:07:00Z';
 const original=await l.ensureData({scope:'view',bounds:[-77.075,38.91,-77.07,38.915]});
 ok(h.canonical().length===1&&h.displays().length===displayCount&&h.workers.length===1,'Only an explicit original-data request opens canonical metadata and starts the analytical worker');
 ok(api.tileURL(h.messages.find(message=>!message.type).tiles[0]).endsWith('?v='+'d'.repeat(64)),'Canonical tile checksums version analytical byte-range URLs independently of display checksums');
 ok(original.release.updated===h.live.updated_utc&&l.displayRelease.updated===h.display.source_release.updated&&l.analysisRelease.updated===h.live.updated_utc&&view.urls.length===2,'An original read retains separate canonical and displayed releases without replacing the map');
 const retained=l.data,jobs=h.messages.length,canonicalCount=h.canonical().length;l.visible=false;l.reload();const hidden=h.requests.length;await h.tick();await h.foreground();
 ok(h.requests.length===hidden&&l.data===retained&&h.messages.length===jobs,'Hidden layers pause timer and foreground checks while retaining explicitly captured originals');
 l.visible=true;h.doc.visibilityState='hidden';const background=h.requests.length;await h.tick();
 ok(h.requests.length===background&&h.canonical().length===canonicalCount,'Background tabs poll neither display nor canonical metadata');
 await h.foreground();ok(h.requests.length===background+1&&h.canonical().length===canonicalCount&&h.messages.length===jobs,'Returning to a foreground tab refreshes stale display metadata without an analytical read');
 const fresh=h.requests.length;await h.foreground(1000);ok(h.requests.length===fresh,'A recently checked foreground tab avoids a redundant immediate display check');
 const retainedURL=view.urls.at(-1);h.failDisplay=true;await l.checkUpdates();
 ok(l.data===retained&&view.urls.at(-1)===retainedURL&&l.releaseWarning.includes('offline')&&h.canonical().length===canonicalCount,'A failed update retains displayed tiles and captured originals while reporting its metadata failure');
 h.failDisplay=false;await l.checkUpdates();
 ok(l.releaseWarning===''&&view.urls.at(-1)===retainedURL&&h.messages.length===jobs&&h.canonical().length===canonicalCount,'A successful same-checksum retry clears the earlier failure warning without replacing tiles or reading originals');
 h.display=display('e','2026-10-28T12:08:00Z');await l.checkUpdates();
 ok(l.releaseWarning===''&&view.urls.at(-1).endsWith('?v='+'e'.repeat(64)),'A successful display replacement recovers from a failed metadata check without touching originals');
 l.stop();const stopped=h.requests.length;await l.checkUpdates();
 ok(h.intervals.size===0&&!h.listeners.has('visibilitychange')&&h.workers.every(worker=>worker.stopped)&&h.timers.size===0&&h.requests.length===stopped,'Removing the layer stops its worker, timers and visibility listener and prevents further checks');
 const fallback=harness({noDisplay:true});await fallback.attach();const fl=fallback.layer,grid=fallback.map.getSource(fl.id+'-publication'),gridLayer=fallback.map.getLayer(fl.id+'-publication-grid');
 ok(!fl.renderTiled&&fl.displayMode==='coverage'&&fallback.workers.length===0&&fallback.displays().length===1&&fallback.canonical().length===1,'An absent display reads only a canonical coverage index and starts no original-data worker');
 ok(grid.data.features.length===1&&gridLayer.type==='line'&&fl.data.features.length===0,'Coverage shows publication tile outlines rather than invented building polygons');
 fallback.map.zoom=4;fl.opacity=0;fl.visible=false;fl.reload();const count=fallback.requests.length;fallback.map.events.get('moveend')?.();await flush();
 ok(gridLayer.paint['line-opacity']===0&&gridLayer.layout.visibility==='none'&&fallback.requests.length===count&&fallback.workers.length===0,'Coverage obeys opacity and visibility while zoom changes remain free of original-data reads');
 fl.visible=true;fallback.display=display('f');await fl.checkUpdates();
 ok(fl.releaseWarning.includes('add it again')&&!fl.renderTiled&&fallback.workers.length===0,'A newly published display offers a map reconnect without silently starting analytical work');
 fl.stop();ok(!fallback.map.getSource(fl.id+'-publication')&&!fallback.map.getLayer(fl.id+'-publication-grid')&&fallback.intervals.size===0&&!fallback.listeners.size,'Stopping coverage removes its publication source, grid, timer and listener');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
 if(process.env.PORTAL_QA_OUTPUT){fs.mkdirSync(process.env.PORTAL_QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.PORTAL_QA_OUTPUT,'update-contract.json'),JSON.stringify({passed:true,checks},null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
