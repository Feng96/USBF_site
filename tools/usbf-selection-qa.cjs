/* Exercise the real layer manager and raw publisher; only browser/worker I/O is mocked. */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),checks=[],tick=()=>new Promise(resolve=>setImmediate(resolve));
const ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
const feature=(id,size=.0001)=>({type:'Feature',properties:{usbf_id:id,cx:-77.072,cy:38.9122,height_m:18},geometry:{type:'Polygon',coordinates:[[[-77.072,38.9122],[-77.072+size,38.9122],[-77.072+size,38.9122+size],[-77.072,38.9122+size],[-77.072,38.9122]]]}});
const publication={release:'USBF_v1',updated_utc:'2026-10-28T12:00:00Z',layout:'flat_half_degree_geographic_tiles',crs:'EPSG:4326',tile_degrees:.5,scope:'CONUS48+DC',tiles:1,buildings:1,files:[{path:'USBF_x-155_y+77.parquet',bytes:1000,rows:1,sha256:'a'.repeat(64),bbox:[-77.075,38.91,-77.069,38.914],tile_bbox:[-77.5,38.5,-77,39]}]};
const display={schema_version:1,type:'pmtiles',url:'https://data.source.coop/opengeos/us-buildings/USBF_display/releases/selection-test-only.pmtiles',sha256:'b'.repeat(64),source_layer:'usbf',source_release:{name:'USBF_v1',updated:publication.updated_utc,buildings:1,tiles:1},input_buildings:1,bounds:publication.files[0].bbox,minzoom:16,maxzoom:16,fields:['usbf_id','cx','cy','height_m']};
const nodes=new Map(),sources=new Map(),mapLayers=new Map(),jobs=[],timers=new Map();let timerID=0,showDisplay=true,clears=0;
const node=()=>({value:'',textContent:'',innerHTML:'',checked:false,hidden:false,classList:{toggle(){}},setAttribute(){},addEventListener(){},dispatchEvent(){},click(){}});
const document={baseURI:'http://localhost/',visibilityState:'visible',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll:()=>[],createElement:node,addEventListener(){},removeEventListener(){},dispatchEvent(){}};
const map={addSource(id,spec){sources.set(id,{...spec,setData(data){this.data=data;}});},getSource:id=>sources.get(id),removeSource:id=>sources.delete(id),addLayer(spec){mapLayers.set(spec.id,spec);},getLayer:id=>mapLayers.get(id),removeLayer:id=>mapLayers.delete(id),getStyle:()=>({layers:Array.from(mapLayers.values())}),setLayoutProperty(){},setPaintProperty(){},setFilter(){},resize(){},on(){},getBounds:()=>({getWest:()=>-77.074,getSouth:()=>38.91,getEast:()=>-77.069,getNorth:()=>38.915})};
class Archive{constructor(url){this.source={getKey:()=>url};}async getHeader(){return {tileType:1};}async getMetadata(){return {vector_layers:[{id:'usbf'}]};}}
class Worker{postMessage(job){if(!job.type)jobs.push({worker:this,...job});}terminate(){}}
const context={console,document,URL,URLSearchParams,DOMException,AbortController,AbortSignal,Map,Set,Date,Event:class{},CustomEvent:class{},Worker,
 setTimeout(fn,ms){timers.set(++timerID,{fn,ms});return timerID;},clearTimeout:id=>timers.delete(id),setInterval(){return 1;},clearInterval(){},
 fetch:async raw=>({ok:true,status:200,text:async()=>JSON.stringify(String(raw).includes('/USBF_display/')?showDisplay?display:null:publication)}),
 PortalLegend:{render(){},colorExpression:l=>l.color},PortalPublicSources:{catalog:[],resources:[],empty:()=>({type:'FeatureCollection',features:[]}),attach(...args){context.PortalUSBF.attach(...args);}},
 pmtiles:{PMTiles:Archive,Protocol:class{add(){}}},maplibregl:{addProtocol(){}}};
context.window=context;context.globalThis=context;vm.createContext(context);
for(const file of ['source-features.js','usbf-source.js','data-manager.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const layers=context.PortalLayers,outline=()=>map.getSource('inventory-selection').data.features;
async function request(layer,bounds,records,beforeComplete=()=>{}){
 const pending=layer.ensureData({scope:'view',bounds});await tick();const job=jobs.at(-1);assert(job,'The real loader must create a worker request.');beforeComplete();job.worker.onmessage({data:{id:job.id,data:{type:'FeatureCollection',features:records},bytes:10,networkBytes:10,limited:false}});return pending;
}
(async()=>{
 await layers.init({map,clearSelection(){clears++;document.querySelector('#properties').hidden=true;},saveView(){},view3d:false},'');
 const tiled=await layers.add(context.PortalUSBF.entry,{restore:true,throwOnError:true}),preview=feature('selected-courtyard'),original=feature('selected-courtyard',.001),elsewhere=[-77.069,38.912,-77.0689,38.9123],near=[-77.074,38.91,-77.069,38.915];
 let beforeClear;
 await request(tiled,elsewhere,[],()=>{layers.inspect(tiled,preview);beforeClear=clears;});
 ok(tiled.renderTiled&&tiled.data.features.length===0&&layers.selection?.feature===preview&&clears===beforeClear&&outline()[0].geometry===preview.geometry&&!document.querySelector('#properties').hidden,'A pending raw batch that omits a newly selected tiled building preserves its selection, inspector and outline');
 await request(tiled,near,[original]);
 ok(layers.selection.feature===original&&outline()[0].geometry===original.geometry&&!document.querySelector('#properties').hidden,'A matching original in a completed batch still refreshes the selected building and complete outline');
 await tiled.ensureData({scope:'view',bounds:near}); // Real cache-hit publisher path.
 ok(layers.selection.feature===original&&tiled.featureById.get('selected-courtyard')===original,'Reusing a matching analytical cache retains the original selection');
 showDisplay=false;
 const fallback=await layers.add({...context.PortalUSBF.entry,id:'usbf-fallback-test'},{restore:true,throwOnError:true});
 await request(fallback,near,[original]);layers.inspect(fallback,original);
 ok(!fallback.renderTiled&&fallback.displayMode==='original'&&layers.selection.feature===original,'The ordinary GeoJSON viewport fallback starts with a selectable complete original');
 await request(fallback,elsewhere,[]);
 ok(layers.selection===null&&outline().length===0&&document.querySelector('#properties').hidden,'A real GeoJSON viewport still clears a selection removed from its displayed records');
 layers.inspect(tiled,preview);await fallback.ensureData({scope:'view',bounds:[-76,38,-75.999,38.001]});
 ok(layers.selection?.layer===tiled.id&&layers.selection.feature===preview,'A raw update in another layer leaves the current selection alone');
 for(const id of Array.from(layers.layers.keys()))layers.remove(id);
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
