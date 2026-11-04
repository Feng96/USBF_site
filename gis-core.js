/* Original-vector GIS primitives. Data values and full outlines remain unchanged
   for selection/extraction; geometry-changing outputs carry derived provenance. */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),limits={records:20000,vertices:500000,maskVertices:150000,cells:64,bytes:96*1024*1024};
 const T=()=>root.turf,abort=s=>{if(s?.aborted)throw new DOMException('Cancelled.','AbortError');};
 const extent=features=>T().bbox({type:'FeatureCollection',features});
 function validateMask(feature){
  const f=feature?.type==='Feature'?clone(feature):{type:'Feature',properties:{},geometry:clone(feature)};
  if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))throw Error('Choose a polygon boundary.');
  let n=root.PortalAnalysisData.vertices(f.geometry);if(n>limits.maskVertices)throw Error('This boundary has too many vertices. Use a smaller boundary.');
  if(!T().booleanValid(f)||(n<=3000&&T().kinks(f).features.length)||!(T().area(f)>0))throw Error('The boundary is invalid or crosses itself.');
  return f;
 }
 function box(values,crs=root.PortalCRS.get()){
  if(!Array.isArray(values)||values.length!==4||!values.every(Number.isFinite)||values[0]>=values[2]||values[1]>=values[3])throw Error('Enter xmin, ymin, xmax, ymax in increasing order.');
  const [w,s,e,n]=values,ring=[];
  // Densify projected rectangle edges before reprojection; two diagonal corners
  // alone do not describe a rectangle in another coordinate system.
  for(const [a,b] of [[[w,s],[e,s]],[[e,s],[e,n]],[[e,n],[w,n]],[[w,n],[w,s]]])for(let i=0;i<16;i++)ring.push(root.PortalCRS.toWGS84([a[0]+(b[0]-a[0])*i/16,a[1]+(b[1]-a[1])*i/16],crs));
  ring.push(ring[0]);return validateMask({type:'Polygon',coordinates:[ring]});
 }
 function boundary(text,crs=root.PortalCRS.get()){
  let input;try{input=JSON.parse(text);}catch(_){const rows=String(text).trim().split(/\n|;/).map(row=>row.trim().split(/[\s,]+/).filter(Boolean).map(Number));if(rows.length<3||rows.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Paste polygon GeoJSON or one x,y coordinate pair per line.');if(rows[0][0]!==rows.at(-1)[0]||rows[0][1]!==rows.at(-1)[1])rows.push(rows[0]);input={type:'Polygon',coordinates:[rows]};}
  if(input.type==='FeatureCollection'){if(input.features.length!==1)throw Error('Paste one polygon feature, or use a polygon layer.');input=input.features[0];}
  const transformed=root.PortalCRS.transformGeoJSON(input,crs,'EPSG:4326');return validateMask(transformed);
 }
 function filter(features,mask,predicate='intersects'){
  const b=T().bbox(mask),out=[];
  for(const f of features){if(!f.geometry)continue;const a=T().bbox(f);if(a[0]>b[2]||a[2]<b[0]||a[1]>b[3]||a[3]<b[1])continue;
   if(predicate==='within'?T().booleanWithin(f,mask):predicate==='representative-point'?T().booleanPointInPolygon(T().pointOnFeature(f),mask):T().booleanIntersects(f,mask))out.push(f);
  }return out;
 }
 async function filterAsync(features,mask,predicate='intersects',signal){
  const out=[];for(let i=0;i<features.length;i++){abort(signal);out.push(...filter([features[i]],mask,predicate));if(i%32===31)await new Promise(r=>setTimeout(r,0));}return out;
 }
 function result(features,inputs,operation,{changed=false,range=null,extra={}}={}){
  if(features.length>limits.records)throw Error('This operation exceeds 20,000 records. Choose a smaller input.');
  const n=features.reduce((sum,f)=>sum+root.PortalAnalysisData.vertices(f.geometry),0);if(n>limits.vertices)throw Error('This operation exceeds the geometry budget. Choose a smaller input.');
  const lineage=inputs.map(x=>clone(x.provenance)),building=!changed&&inputs.every(x=>x.provenance.featureRole==='buildings');
  const p={version:1,capturedAt:new Date().toISOString(),gisOperation:operation,scope:'explicit-gis-inputs',scopeLabel:operation+(range?' · '+range.label:''),spatialEligible:true,geometryQuality:changed?'derived-source-geometry':'full-loaded-source-geometry',featureRole:building?'buildings':'features',autoHeight:!changed&&inputs.length===1&&inputs[0].provenance.autoHeight!==false,heightField:!changed&&inputs.length===1?inputs[0].provenance.heightField:null,heightBasis:!changed&&inputs.length===1?inputs[0].provenance.heightBasis:null,limited:inputs.some(x=>x.provenance.limited)||!!range?.meta?.limited,licenses:Array.from(new Set([...inputs.flatMap(x=>x.provenance.licenses||[]),...(range?.meta?.licenses||[])])),lineage,featureCount:features.length,vertexCount:n,extent:features.length?extent(features):null,...(changed?{operation}:{}),...(range?{range:clone(range.meta),requestedView:range.bounds}:{}),...extra};
  return {type:'FeatureCollection',features:clone(features),provenance:p};
 }
 function rangeReader(layer){
  let worker=null,id=0,current=null;
  function close(){if(current){current.reject(new DOMException('Cancelled.','AbortError'));current=null;}worker?.terminate();worker=null;}
  async function read(bounds,signal){
   if(layer.cfg.driver!=='gba'){const r=await root.PortalPublicSources.query(layer.cfg,bounds,signal);return {data:r.data,fields:Array.from(new Set(r.data.features.flatMap(f=>Object.keys(f.properties||{})))),loaded:true,viewLimited:r.limited,viewBounds:bounds,viewBytes:r.bytes,viewLoadedAt:new Date().toISOString(),release:null};}
   if(!worker){worker=new Worker(new URL('./gba-worker.js?v=1.6.2-coverage',document.baseURI),{type:'module'});worker.onmessage=e=>{if(!current||e.data.id!==current.id||e.data.progress)return;const own=current;current=null;own.cleanup();e.data.error?own.reject(Error(e.data.error)):own.resolve(e.data);};worker.onerror=e=>{current?.cleanup();current?.reject(Error(e.message));current=null;};}
   const result=await new Promise((resolve,reject)=>{const request=++id,cancel=()=>{if(current?.id===request){current=null;worker.postMessage({type:'cancel',id:request});cleanup();reject(new DOMException('Cancelled.','AbortError'));}},timer=setTimeout(()=>{if(current?.id===request){current=null;worker.postMessage({type:'cancel',id:request});cleanup();reject(Error('The original data reader timed out.'));}},90000),cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};current={id:request,resolve,reject,cleanup};signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}worker.postMessage({id:request,bounds});});
   return {data:result.data,fields:Array.from(new Set(result.data.features.flatMap(f=>Object.keys(f.properties||{})))),loaded:true,viewLimited:result.limited,viewBounds:bounds,viewBytes:result.bytes,viewLoadedAt:new Date().toISOString(),release:null};
  }return {read,close};
 }
 async function capture(layer,{range=null,selected=null,signal,onProgress}={}){
  const A=root.PortalAnalysisData,c=A.capabilities(layer);if(!c.geometryAnalysis)throw Error('Load original vector data before GIS operations.');
  if(selected){if(c.kind==='on-demand')throw Error('Load a separate analysis layer before selecting records.');const current=new Set(layer.data?.features||[]);if(!selected.every(f=>current.has(f)))throw Error('The selected records changed. Select them again.');return {features:clone(selected),fields:layer.fields.slice(),provenance:{...(clone(layer.data?.provenance||layer.cfg.provenance||{})),name:layer.cfg.name,layerId:layer.id,autoHeight:layer.cfg.allowHeight!==false&&layer.data?.provenance?.autoHeight!==false,heightField:layer.heightField||null,featureRole:A.isBuildingLayer(layer)?'buildings':'features',geometryQuality:'full-loaded-source-geometry',spatialEligible:true,scope:'selected-original-records',scopeLabel:'Selected original records',limited:!!layer.viewLimited||!!layer.data?.provenance?.limited,licenses:[...(layer.data?.provenance?.licenses||[]),layer.cfg.license].filter(Boolean)},capabilities:{supported:true,geometryAnalysis:true,wholeLayer:true}};}
  if(c.kind==='on-demand'&&!range)throw Error('Save and choose a study area before loading original records.');
  const remote=c.kind==='on-demand'||!!range&&layer.cfg.type==='viewport'&&['gba','arcgis','nyc'].includes(layer.cfg.driver);
  if(!remote){
   const snapshot=await A.capture(layer,{scope:range?'view':'layer',...(range?{bounds:range.bounds}:{}),signal,respectFilters:false});
   if(range){const features=await filterAsync(snapshot.features,range.mask,'intersects',signal);return {...snapshot,features,provenance:{...clone(snapshot.provenance),range:clone(range.meta),requestedView:range.bounds,featureCount:features.length,limited:snapshot.provenance.limited||layer.cfg.type==='viewport'&&!(layer.viewBounds&&root.PortalUSBF.contains(layer.viewBounds,range.bounds))}};}return snapshot;
  }
  const b=range?.bounds||(()=>{const v=root.portal.map.getBounds();return[v.getWest(),v.getSouth(),v.getEast(),v.getNorth()];})();
  const dx=.08,dy=.08,nx=Math.max(1,Math.ceil((b[2]-b[0])/dx)),ny=Math.max(1,Math.ceil((b[3]-b[1])/dy)),total=nx*ny;
  if(!Number.isSafeInteger(total)||nx>10000||ny>10000)throw Error('Choose a smaller original-data loading area.');
  const cells=[],centre=range?T().pointOnFeature(range.mask).geometry.coordinates:[(b[0]+b[2])/2,(b[1]+b[3])/2],ix=Math.max(0,Math.min(nx-1,Math.floor((centre[0]-b[0])/(b[2]-b[0])*nx))),iy=Math.max(0,Math.min(ny-1,Math.floor((centre[1]-b[1])/(b[3]-b[1])*ny)));
  const candidate=(x,y)=>{if(x<0||y<0||x>=nx||y>=ny)return;const cell=[b[0]+x*(b[2]-b[0])/nx,b[1]+y*(b[3]-b[1])/ny,b[0]+(x+1)*(b[2]-b[0])/nx,b[1]+(y+1)*(b[3]-b[1])/ny];if(!range||T().booleanIntersects(T().bboxPolygon(cell),range.mask))cells.push(cell);};
  if(total<=limits.cells){for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)candidate(x,y);}
  else{let attempts=0;for(let radius=0;cells.length<limits.cells&&attempts<512;radius++)for(let y=iy-radius;y<=iy+radius&&cells.length<limits.cells;y++)for(let x=ix-radius;x<=ix+radius&&cells.length<limits.cells;x++){if(radius&&Math.abs(x-ix)!==radius&&Math.abs(y-iy)!==radius)continue;attempts++;if(attempts>512)break;candidate(x,y);}}
  const partialPlan=total>limits.cells;
  const features=[],seen=new Set(),parts=[];let bytes=0,done=0,limited=false;
  const reader=c.kind==='on-demand'?null:rangeReader(layer);
  try{for(const cell of cells){
   abort(signal);if(done>=limits.cells||bytes>=limits.bytes||features.length>=limits.records){limited=true;break;}
   const loaded=reader?await reader.read(cell,signal):await layer.ensureData({scope:'view',bounds:cell,signal});abort(signal);bytes+=loaded.viewBytes||0;
   if(!loaded.data.features.length){done++;onProgress?.(done,cells.length);continue;}
   if(loaded.data.features.length>limits.records-features.length){loaded.data={...loaded.data,features:loaded.data.features.slice(0,limits.records-features.length)};loaded.viewLimited=true;}
   const proxy={...layer,sourceFilter:'',minArea:0,cfg:{...layer.cfg,analysisMode:undefined},renderTiled:false,data:loaded.data,loaded:true,error:false,viewLoading:false,viewLimited:loaded.viewLimited,viewBounds:loaded.viewBounds,viewSelection:loaded.viewSelection,viewLoadedAt:loaded.viewLoadedAt,release:loaded.release,fields:loaded.fields};
   const snap=await A.capture(proxy,{scope:'view',bounds:cell,signal,respectFilters:true});if(parts.length&&parts[0].provenance.release?.updated!==snap.provenance.release?.updated)throw Error('The source publication changed during loading. Retry the range.');parts.push(snap);limited=limited||!!snap.provenance.limited;
   for(const f of range?await filterAsync(snap.features,range.mask,'intersects',signal):snap.features){const p=f.properties||{},key=p.usbf_id!==undefined?'usbf:'+p.usbf_id:p.OBJECTID!==undefined?'arcgis:'+p.OBJECTID:p.objectid!==undefined?'nyc:'+p.objectid:p.id!==undefined?'source:'+p.source+'|'+p.id:f.id!==undefined?'feature:'+f.id:JSON.stringify([f.properties,f.geometry]);if(seen.has(key))continue;seen.add(key);if(features.length===limits.records){limited=true;break;}features.push(f);}
   done++;onProgress?.(done,cells.length);
  }}finally{reader?.close();}
  if(!parts.length)throw Error('No original data could be loaded for this range.');
  const data=result(features,parts,'load-area',{range,extra:{limited:limited||partialPlan||done<cells.length,loadingCoverage:{completedCells:done,plannedCells:cells.length,totalGridCells:total,completePlan:!partialPlan,readBytes:bytes}}});
  return {features:data.features,fields:Array.from(new Set(data.features.flatMap(f=>Object.keys(f.properties||{})))),provenance:{...data.provenance,name:layer.cfg.name,heightField:layer.heightField,heightBasis:parts[0].provenance.heightBasis,autoHeight:layer.cfg.allowHeight!==false,featureRole:'buildings',sourceDriver:layer.cfg.driver,release:parts[0].provenance.release?{...parts[0].provenance.release,files:Array.from(new Map(parts.flatMap(p=>p.provenance.release?.files||[]).map(f=>[f.path,f])).values())}:null},capabilities:{supported:true,geometryAnalysis:true,wholeLayer:true}};
 }
 function compare(value,op,wanted){
  if(op==='is-null')return value===null;if(op==='missing')return value===undefined;if(op==='empty')return value==='';
  if(value===null||value===undefined)return false;if(typeof value==='boolean'&&!['true','false'].includes(wanted))return false;
  const v=typeof value==='number'?Number(wanted):typeof value==='boolean'?wanted==='true':wanted;if(typeof value==='number'&&!Number.isFinite(v))return false;
  if(op==='eq')return value===v;if(op==='ne')return value!==v;
  if(op==='contains')return value!==null&&value!==undefined&&String(value).includes(wanted);
  const order=root.PortalInventory?.tableData.compare(value,v);return op==='gt'?order>0:op==='ge'?order>=0:op==='lt'?order<0:op==='le'?order<=0:false;
 }
 async function process(inputs,operation,{range=null,field='',distance=25,signal}={}){
  abort(signal);if(!inputs.length)throw Error('Choose an original input layer.');const first=inputs[0];let features=[];
  if(operation==='extract-box'||operation==='extract-mask'){if(!range)throw Error('Choose a loading or extraction range.');return result(await filterAsync(first.features,range.mask,'intersects',signal),inputs,operation,{range});}
  if(operation==='merge'){
   for(const input of inputs)for(const f of input.features){const copy=clone(f),p=copy.properties||(copy.properties={});let name='gis_source_layer';while(Object.hasOwn(p,name))name+='_';p[name]=input.provenance.name;features.push(copy);}return result(features,inputs,operation);
  }
  if(operation==='deduplicate'){const seen=new Set();for(const f of first.features){if(!f.geometry){features.push(f);continue;}const key=JSON.stringify(f.geometry);if(!seen.has(key)){seen.add(key);features.push(f);}}return result(features,inputs,'remove-exact-geometry-duplicates');}
  if(operation==='singlepart'){
   for(const f of first.features){const g=f.geometry;if(g?.type?.startsWith('Multi'))for(const coordinates of g.coordinates)features.push({...clone(f),geometry:{type:g.type.slice(5),coordinates:clone(coordinates)}});else features.push(clone(f));}return result(features,inputs,operation,{changed:true});
  }
  if(operation==='dissolve'){
   if(first.features.length>1500)throw Error('Dissolve supports up to 1,500 polygons. Choose a smaller input.');const groups=new Map();
   for(const f of first.features){if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))throw Error('Dissolve needs polygon input.');const value=field?f.properties?.[field]:null,key=JSON.stringify(value)??'missing';if(!groups.has(key))groups.set(key,{value,items:[]});groups.get(key).items.push(f);}
   for(const group of groups.values()){abort(signal);const union=group.items.length===1?clone(group.items[0]):T().union(T().featureCollection(group.items));if(union){union.properties=field?{[field]:group.value}:{};let countField='gis_record_count';while(Object.hasOwn(union.properties,countField))countField+='_';union.properties[countField]=group.items.length;features.push(union);}await new Promise(r=>setTimeout(r,0));}return result(features,inputs,operation,{changed:true});
  }
  let reference;if(range){reference={features:[range.mask],fields:[],provenance:{name:range.label,limited:!!range.meta.limited,licenses:range.meta.licenses||[],vertexCount:root.PortalAnalysisData.vertices(range.mask.geometry)},capabilities:{geometryAnalysis:true,wholeLayer:true}};}
  if(operation==='erase'){
   if(!range)throw Error('Choose an erase boundary.');if(first.features.length>1500)throw Error('Erase supports up to 1,500 records.');
   for(const f of first.features){abort(signal);if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))throw Error('Erase requires polygon records.');const d=T().difference(T().featureCollection([f,range.mask]));if(d)features.push({...clone(f),geometry:d.geometry});await new Promise(r=>setTimeout(r,0));}return result(features,inputs,operation,{changed:true,range});
  }
  const op=operation==='clip'?'clip':operation;return root.PortalAnalysisData.run({...first,provenance:{...first.provenance,vertexCount:first.features.reduce((n,f)=>n+root.PortalAnalysisData.vertices(f.geometry),0)},capabilities:{...first.capabilities,geometryAnalysis:true,wholeLayer:true}},op,{reference,distance,signal});
 }
 root.PortalGISCore={box,boundary,validateMask,filter,filterAsync,result,capture,compare,process,extent,limits,clone};
})(globalThis);
