/* Production pagination and viewport lifecycle against bounded provider fixtures. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const checks=[],requests=[],progress=[],clone=x=>JSON.parse(JSON.stringify(x)),pause=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);};
const box=[-77.09,38.89,-77.04,38.93],shape={type:'Polygon',coordinates:[[[-77.07,38.91],[-77.0699,38.91],[-77.0699,38.9101],[-77.07,38.91]]]};
let count=1451,mode='normal',active=0,peak=0,wait;
function feature(id,dc){return {type:'Feature',id:dc?id:undefined,geometry:clone(shape),properties:dc?{OBJECTID:id,CAPTUREYEAR:2021}:{objectid:String(id),doitt_id:String(id),height_roof:id%2?'100':null}};}
const ctx={URL,URLSearchParams,AbortController,DOMException,Blob,Response,TextEncoder,TextDecoder,Date,Map,Set,console,setTimeout:(f,t)=>setTimeout(f,t===300?0:t),clearTimeout,document:{baseURI:'https://fixture.test/'}};ctx.window=ctx;
ctx.fetch=async(raw,options)=>{
 const u=new URL(raw),p=u.searchParams,dc=u.hostname==='dc.test';requests.push(u.href);
 assert.equal(options.credentials,'omit');if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
 active++;peak=Math.max(peak,active);
 try{
  await pause(1);
  if(wait)await wait;
  if(options.signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(p.get('returnIdsOnly')==='true')return Response.json({objectIdFieldName:'OBJECTID',objectIds:Array.from({length:count},(_,i)=>i+1)});
  if(p.get('$select'))return Response.json([{count:String(count)}]);
  if(mode==='http-error')return new Response('unavailable',{status:503});
  let ids=dc?p.get('objectIds').split(',').map(Number):Array.from({length:Number(p.get('$limit'))},(_,i)=>Number(p.get('$offset'))+i+1);
  if(mode==='split'&&dc&&ids.length>100)return Response.json({type:'FeatureCollection',features:ids.slice(0,100).map(id=>feature(id,true)),exceededTransferLimit:true});
  if(mode==='missing')ids=ids.slice(0,-1);
  if(mode==='duplicate'&&!dc)ids=ids.map((_,i)=>i+1);
  return Response.json({type:'FeatureCollection',features:ids.map(id=>feature(id,dc))});
 }finally{active--;}
};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public-sources.js'),'utf8'),ctx);
const api=ctx.PortalPublicSources,dc={driver:'arcgis',url:'https://dc.test/MapServer/1'},nyc={driver:'nyc',url:'https://nyc.test/buildings.geojson'};
const run=cfg=>api.query(cfg,box,new AbortController().signal,p=>progress.push({n:p.data.features.length,limited:p.limited,total:p.expected}));
(async()=>{
 let r=await run(dc);
 ok(r.data.features.length===1451&&!r.limited&&r.expected===1451,'DC fetches every matching building beyond the provider’s 1,000-record cap');
 ok(new Set(r.data.features.map(f=>f.properties.OBJECTID)).size===1451&&r.data.features.every(f=>f.properties.CAPTUREYEAR===2021),'DC batch assembly keeps exact unique IDs and original capture attributes');
 ok(progress.some(p=>p.n>0&&p.n<1451&&p.limited)&&progress.at(-1).n===1451,'Completed pages draw progressively without claiming early completeness');
 ok(peak<=3&&requests.filter(u=>u.includes('objectIds=')).length===3,'Provider requests have bounded concurrency and bounded ID batches');
 mode='split';count=701;r=await run(dc);ok(r.data.features.length===701&&!r.limited,'ArcGIS transfer-limit responses are recursively completed rather than accepted as partial pages');
 mode='normal';count=6351;requests.length=0;r=await run(nyc);
 ok(r.data.features.length===6351&&!r.limited,'NYC loads every page beyond the old 5,000-feature cutoff');
 ok(requests.filter(u=>u.includes('%24offset=')).length===7&&requests.filter(u=>u.includes('%24offset=')).every(u=>new URL(u).searchParams.get('$order')===':id'),'NYC pagination uses stable system-row ordering and explicit offsets');
 ok(r.data.features.every(f=>f.properties.height_roof===null?f.properties.height_m===null:Math.abs(f.properties.height_m-30.48)<1e-9),'NYC preserves raw heights and nulls while converting available feet to metres');
 mode='duplicate';await assert.rejects(run(nyc),/duplicate/);ok(true,'Repeated provider pages cannot be marked as a complete view');
 mode='missing';count=25;await assert.rejects(run(dc),/incomplete/);await assert.rejects(run(nyc),/incomplete/);ok(true,'A short DC or NYC page fails visibly rather than silently dropping buildings');
 mode='http-error';await assert.rejects(run(nyc),/503/);ok(true,'A failed provider page rejects completeness');
 mode='normal';const oldLimit=api.limits.features;api.limits.features=12;count=35;r=await run(dc);ok(r.limited&&r.data.features.length===12&&r.expected===35,'The browser feature budget is explicit and never masquerades as all matching buildings');api.limits.features=oldLimit;
 const c=new AbortController();c.abort();await assert.rejects(api.query(nyc,box,c.signal),{name:'AbortError'});ok(true,'An already cancelled view makes no usable data request');
 const oldBytes=api.limits.bytes;api.limits.bytes=10;await assert.rejects(run(dc),/download limit/);api.limits.bytes=oldBytes;ok(true,'Response streaming enforces the byte budget before JSON is accepted');
 // The real attach code manages stale results, cache reuse and analysis state.
 count=2401;requests.length=0;let view=box.slice(),zoom=15;
 const events=new Map(),source={setData(data){this.data=data;}},map={getSource:()=>source,getZoom:()=>zoom,getBounds:()=>({getWest:()=>view[0],getSouth:()=>view[1],getEast:()=>view[2],getNorth:()=>view[3]}),on:(n,f)=>events.set(n,f),off:n=>events.delete(n)};
 const layer={id:'test-layer',cfg:{...dc,bounds:[[-77.2,38.7],[-76.8,39.1]],minViewZoom:14},fields:[],visible:true,setData(data){this.data=data;source.setData(data);}};
 api.attach(layer,map,()=>{});await layer.reload();ok(layer.loaded&&!layer.viewLoading&&!layer.viewLimited&&layer.data.features.length===2401,'A full paged view transitions from loading to complete exactly once all data arrives');
 const initialRequests=requests.length,original=layer.data;view=[box[0]+.005,box[1]+.005,box[2]-.005,box[3]-.005];events.get('moveend')();await pause(30);
 ok(requests.length===initialRequests&&layer.data===original&&!layer.viewLoading,'Zooming inside completed coverage reuses data without new provider requests or blanking the map');
 view=[-77.15,38.85,-77.13,38.87];let release;wait=new Promise(r=>release=r);const pending=layer.reload();await pause(15);
 ok(layer.data===original&&layer.viewLoading,'Pending replacement requests retain rendered geometry while preventing an analytical snapshot');
 view=box.slice();events.get('moveend')();release();wait=null;await pending;await pause(30);
 ok(layer.data===original&&!layer.viewLoading,'An obsolete request cannot replace a newer cached map view');
 view=[-77.15,38.85,-77.13,38.87];wait=new Promise(r=>release=r);const cancelled=layer.reload();await pause(15);layer.clearCache();release();wait=null;await cancelled;ok(layer.data===original&&layer.error&&layer.viewLimited&&!layer.viewLoading,'Clearing cache during replacement cannot expose stale coverage as a complete analytical view');view=box.slice();
 layer.clearCache();const before=requests.length;await layer.reload();ok(requests.length>before&&layer.loaded,'Clear cache drops retained queries while preserving the open layer');
 layer.visible=false;await layer.reload();ok(!layer.loaded&&layer.data.features.length===0&&layer.viewNote.includes('paused'),'Hidden layers stop loading and clear their active view records');
 layer.visible=true;mode='missing';await layer.reload();ok(layer.error&&layer.viewLimited&&!layer.viewLoading,'An incomplete live view remains visibly in error instead of looking complete');
 layer.stop();ok(!events.has('moveend'),'Removing the layer detaches its viewport listener');
 ok(api.catalog.find(c=>c.id==='microsoft-usa').maxzoom===16,'Microsoft overzooms the provider’s actual final level instead of requesting missing zoom-17–19 tiles');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
