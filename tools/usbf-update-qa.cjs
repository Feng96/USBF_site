/* Publication/update contract tests; no browser or real five-minute wait. */
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
if(!Object.hasOwn)Object.hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const source=fs.readFileSync(path.join(__dirname,'../usbf-source.js'),'utf8'),checks=[];const ok=(v,s)=>{assert(v,s);checks.push(s);console.log('PASS',s)};
const tile=(path,sha,bbox=[-77.51,38.49,-76.99,39.01])=>({path,sha256:sha.repeat(64),bytes:1024,rows:1,bbox,tile_bbox:[-77.5,38.5,-77,39]});
const publication=()=>({release:'USBF_v1',layout:'flat_half_degree_geographic_tiles',tile_degrees:.5,crs:'EPSG:4326',scope:'CONUS48+DC',updated_utc:'2026-10-27T22:25:21Z',tiles:1,buildings:1,files:[tile('USBF_x-00155_y+00077.parquet','a')]});
let live=publication(),fail=false,requests=[],workers=[],intervals=[],listeners=new Map();
const doc={baseURI:'https://feng96.github.io/USBF_site/',visibilityState:'visible',querySelector:()=>null,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
const context={URL,Object,Map,Set,Date,JSON,Number,Array,Error,String,console,AbortController:class{constructor(){this.signal={}}abort(){}},setTimeout,clearTimeout,setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length},clearInterval:()=>{},document:doc,fetch:async(url,options)=>{requests.push({url:String(url),options});if(fail)throw Error('offline');return {ok:true,text:async()=>JSON.stringify(live)}}};
vm.createContext(context);vm.runInContext(source,context);const api=context.PortalUSBF;
class FakeMap{constructor(){this.sources=new Map([['footprints',{setData:d=>this.data=d}]]);this.layers=new Map();this.events=new Map();this.zoom=16;}
 addSource(id,s){this.sources.set(id,{...s,setData(d){this.data=d}})}getSource(id){return this.sources.get(id)}removeSource(id){this.sources.delete(id)}
 addLayer(l){this.layers.set(l.id,l)}getLayer(id){return this.layers.get(id)}removeLayer(id){this.layers.delete(id)}setLayoutProperty(id,k,v){this.layers.get(id).layout[k]=v}setPaintProperty(id,k,v){this.layers.get(id).paint[k]=v}
 getZoom(){return this.zoom}getBounds(){return {getWest:()=>-77.075,getSouth:()=>38.91,getEast:()=>-77.07,getNorth:()=>38.915}}on(k,v){this.events.set(k,v)}off(k){this.events.delete(k)}}
context.Worker=class{constructor(url){this.url=String(url)}terminate(){this.stopped=true}postMessage(request){workers.push(request);setTimeout(()=>{if(!this.stopped)this.onmessage({data:{bytes:100,limited:false,data:{type:'FeatureCollection',features:[api.normalize({usbf_id:request.tiles[0].sha256,source:'ms',height:12,height_missing:true,modified:null,footprint_license:'ODbL-1.0',height_license:'CC-BY-NC-4.0'},{type:'Polygon',coordinates:[[[-77.071,38.912],[-77.0709,38.912],[-77.0709,38.9121],[-77.071,38.912]]]})]}}})},0)}};
const flush=()=>new Promise(r=>setTimeout(r,30));
(async()=>{
 const parsed=api.parseManifest(live);ok(parsed.count===1&&parsed.buildings===1,'Published counts are validated from the current manifest');
 ok(api.selectTiles(parsed,[-76.991,38.9,-76.9905,38.901]).length===1,'Tile selection uses actual published footprint bounds at grid edges');
 let bad=publication();bad.files[0].path='../private.parquet';assert.throws(()=>api.parseManifest(bad));ok(true,'Untrusted paths cannot escape the USBF publication');
 bad=publication();bad.buildings=2;assert.throws(()=>api.parseManifest(bad));ok(true,'Inconsistent publication totals are rejected');
 const row=api.normalize({height:12,height_missing:true,modified:null,shape_changed:false,footprint_license:'ODbL-1.0',height_license:'CC-BY-NC-4.0'},{});
 ok(row.properties.height_m===12&&row.properties.height_missing===true,'Inherited height remains available when nDSM input is missing');
 ok(row.properties.modified===null&&row.properties.shape_changed===false,'Unknown edit flags remain distinct from false');
 ok(api.normalize({height:-999},{}).properties.height_m===null,'Source missing-height sentinels are preserved and not extruded');
 ok(row.properties.footprint_license==='ODbL-1.0'&&row.properties.height_license==='CC-BY-NC-4.0','Component licenses are preserved independently');
 const map=new FakeMap(),l={id:'footprints',cfg:api.entry,visible:true,opacity:.75,fields:api.entry.fields,error:false};api.attach(l,map,()=>{});await flush();
 ok(requests.length===1&&requests[0].options.cache==='no-store','Adding USBF fetches a fresh public manifest');
 ok(requests[0].url.startsWith(api.manifestURL)&&requests[0].url.includes('_check='),'Manifest checks bypass stale browser/CDN URL variants');
 ok(l.loaded&&l.data.features[0].properties.usbf_id==='a'.repeat(64),'Current published records reach the map');
 ok(l.featureById.get('a'.repeat(64))===l.data.features[0],'Inspection/export can recover full source geometry and original nulls');
 ok(intervals[0].ms===300000,'An open visible map checks automatically every five minutes');
 const initial=workers.length;await l.checkUpdates();await flush();ok(workers.length===initial+1,'The manual update button refreshes the current view');
 live=publication();live.files[0].sha256='b'.repeat(64);await intervals[0].fn();await flush();
 ok(l.data.features[0].properties.usbf_id==='b'.repeat(64),'A timer discovers replacement bytes at the same published filename');
 ok(api.tileURL(workers[workers.length-1].tiles[0]).endsWith('?v='+'b'.repeat(64)),'Changed tile checksums invalidate data cache URLs without a website push');
 const c=publication();c.files.push(tile('USBF_x-00154_y+00077.parquet','c'));c.tiles=2;c.buildings=2;live=c;await l.checkUpdates();await flush();ok(workers[workers.length-1].tiles.length===2&&l.release.tiles===2,'New tiles are discovered dynamically instead of from a bundled inventory');
 const old=l.data.features[0];fail=true;await l.checkUpdates();await flush();ok(l.data.features[0]===old&&l.releaseWarning.includes('offline'),'An update-check failure retains the last loaded publication and reports the failure');fail=false;
 l.visible=false;l.reload();const before=requests.length;await intervals[0].fn();await flush();ok(requests.length===before&&l.data.features.length===0,'Hidden USBF layers pause checks and remove visible-view records');
 l.visible=true;map.zoom=4;l.reload();await flush();ok(l.data.features.length===0&&map.getSource(l.id+'-publication').data.features.length===2,'National view shows a publication grid, never building-shaped tile boxes');
 l.opacity=0;l.syncCoverageStyle();ok(map.getLayer(l.id+'-publication-grid').paint['line-opacity']===0,'Coverage grid obeys layer opacity');
 doc.visibilityState='hidden';const n=requests.length;await intervals[0].fn();await flush();ok(requests.length===n,'Background browser tabs do not keep polling');
 const RealDate=Date;context.Date=class extends RealDate{static now(){return RealDate.now()+60000}};doc.visibilityState='visible';listeners.get('visibilitychange')();await flush();ok(requests.length>n,'Returning to a foreground tab checks a publication that may have changed');
 l.stop();ok(!map.getSource(l.id+'-publication')&&!listeners.has('visibilitychange')&&!map.events.has('moveend'),'Removing USBF cleans up coverage, workers and update listeners');
 console.log(JSON.stringify({passed:true,checks:checks.length}));if(process.env.PORTAL_QA_OUTPUT){fs.mkdirSync(process.env.PORTAL_QA_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.PORTAL_QA_OUTPUT,'update-contract.json'),JSON.stringify({passed:true,checks},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
