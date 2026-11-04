/* Input contracts on real Turf geometry; no camera-dependent analytical defaults. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),root=path.resolve(__dirname,'..'),checks=[];
const ctx={console,setTimeout,clearTimeout,URL,DOMException,AbortController,document:{addEventListener(){},dispatchEvent(){}},CustomEvent:class{constructor(type){this.type=type;}},localStorage:{getItem(){return null;},setItem(){}}};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['vendor/turf-7.2.0.min.js','vendor/proj4-2.12.1.js','workspace-crs.js','analysis-data.js','inventory.js','gis-core.js','data-workspace.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const D=ctx.PortalDataWorkspace,T=ctx.turf,selection=new WeakMap(),map=new Map();let seq=0;
ctx.PortalLayerPurpose={format:l=>l.cfg.type==='viewport'?'GeoJSON · API':'GeoJSON'};
ctx.PortalGISSelection={features:l=>selection.get(l)||[],count:l=>(selection.get(l)||[]).length};
ctx.PortalLayers={layers:map,refresh(){},async addGeoJSON(name,data,cfg){const l={id:'area-'+(++seq),cfg:{...cfg,type:'geojson',name},data,fields:[]};map.set(l.id,l);return l;}};
const ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);};
const f=(x,n)=>({type:'Feature',id:'duplicate',properties:{id:n,height_m:10*n,flag:false,missing:null,long_id:'9007199254740993123'},geometry:T.bboxPolygon([x,0,x+1,1]).geometry}),a=f(0,1),b=f(2,2),c=f(4,3),l={id:'file',cfg:{type:'geojson',name:'Original buildings',dataRole:'buildings',heightField:'height_m'},fields:Object.keys(a.properties),heightField:'height_m',data:{type:'FeatureCollection',features:[a,b,c]}};map.set(l.id,l);
(async()=>{
 ok(D.ready(l),'Only fixed original/derived vector records enter analysis');
 const live={...l,cfg:{...l.cfg,type:'viewport',driver:'arcgis'}};ok(!D.ready(live),'A live original-data API cache is not mistaken for a fixed workset');
 const preview={...l,data:{...l.data,provenance:{spatialEligible:false,geometryQuality:'clipped-or-simplified-tile-fragments'}}};ok(!D.ready(preview),'A GeoJSON wrapper cannot turn tile fragments into an analysis workset');
 const all=await D.capture(l,{mode:'all'});ok(all.features.length===3&&all.provenance.inputContract.recordMode==='all','All input means exactly all fixed source records');
 selection.set(l,[a,c]);const selected=await D.capture(l,{mode:'selection'});ok(selected.features.length===2&&JSON.stringify(selected.provenance.inputContract.selectedSourceRows)==='[0,2]','Batch scope distinguishes exact source rows with duplicate IDs');
 ok(selected.features[0].properties.flag===false&&selected.features[0].properties.missing===null&&selected.features[0].properties.long_id==='9007199254740993123','Input snapshots preserve raw flags, nulls and long identifiers');
 selection.set(l,[]);await assert.rejects(D.capture(l,{mode:'selection'}),/No selected/);ok(true,'An empty selection never silently becomes all records');
 await assert.rejects(D.capture(l,{mode:'view'}),/display extent/);ok(true,'A changing map view cannot become an implicit processing area');
 const r={mask:T.bboxPolygon([-.1,-.1,.5,1.1]),bounds:[-.1,-.1,.5,1.1],label:'Explicit study area',meta:{kind:'box',label:'Explicit study area',crs:'EPSG:4326'}};
 await D.saveArea(r,'Boundary A');const small=await D.capture(l,{mode:'area'});ok(small.features.length===1&&JSON.stringify(small.features[0].geometry)===JSON.stringify(a.geometry),'A saved boundary filters complete source geometries instead of clipping them');
 ok(small.provenance.inputContract.processingArea.label==='Boundary A'&&small.provenance.inputContract.recordCount===1,'Area input contracts retain the actual frozen boundary and count');
 const old=JSON.stringify(D.range());r.bounds[0]=-50;r.mask.geometry.coordinates[0][0][0]=-50;ok(JSON.stringify(D.range())===old,'Saving a boundary detaches it from mutable input objects');
 const second=await D.saveArea({...D.range(),label:'Boundary B'},'Boundary B');ok(D.areas().length===2&&D.area()===second,'Multiple saved boundaries retain one explicit active area');
 l.data.provenance={limited:true};const partial=await D.capture(l);ok(partial.provenance.limited&&partial.provenance.inputContract.partial&&partial.provenance.inputContract.coverage==='Partial source coverage','A narrower input never claims completeness for a partial source');
 const tagged=D.tag({type:'FeatureCollection',features:[a],provenance:{loadingCoverage:{completePlan:true,completedCells:3,plannedCells:3}}},{id:'source',cfg:{type:'viewport',driver:'usbf',name:'USBF'}},D.range());ok(tagged.provenance.workspaceWorkset.sourceFormat==='GeoParquet'&&tagged.provenance.workspaceWorkset.storageFormat==='GeoJSON'&&tagged.provenance.workspaceWorkset.coverage==='request-complete','Worksets distinguish original transport format, stored format and request completion');
 const abort=new AbortController();abort.abort();await assert.rejects(D.capture(l,{signal:abort.signal}),{name:'AbortError'});ok(true,'Cancelled input preparation cannot return a snapshot');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
