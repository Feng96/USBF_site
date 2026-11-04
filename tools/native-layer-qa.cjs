/* Native previews remain bounded displays across the actual browser analysis APIs. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ctx={console,URL,URLSearchParams,DOMException,AbortController,setTimeout,clearTimeout,document:{addEventListener(){},dispatchEvent(){},querySelector(){return null;}},CustomEvent:class{},localStorage:{getItem(){return null;},setItem(){}}};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['vendor/turf-7.2.0.min.js','vendor/proj4-2.12.1.js','workspace-crs.js','analysis-data.js','inventory.js','gis-core.js','data-workspace.js','layer-purpose.js','gis-range.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const checks=[],ok=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS',label);};
const native={id:'native-preview',cfg:{name:'Native result',type:'geojson',nativeSource:{version:1,workspaceId:'workspace-one',path:'Results/job-one.parquet',jobId:'job-one',format:'GeoParquet',recordCount:25005}},bounds:[[-77,39],[-76.9,39.1]],fields:['height_m'],data:{type:'FeatureCollection',features:[ctx.turf.point([-77,39],{height_m:10})],provenance:{geometryQuality:'bounded-native-preview',spatialEligible:false,limited:true,nativeJobStatus:'partial'}}};
ctx.PortalLayers={layers:new Map([[native.id,native]]),active:native,catalog:[]};ctx.PortalI18n={t:value=>value};ctx.PortalGISSelection={features:()=>native.data.features,count:()=>1};
(async()=>{
 const A=ctx.PortalAnalysisData,D=ctx.PortalDataWorkspace,P=ctx.PortalLayerPurpose;
 const capability=A.capabilities(native);ok(capability.kind==='native-result'&&capability.nativeAnalysis&&!capability.geometryAnalysis&&!capability.wholeLayer&&!capability.attributePreview,'A native layer explicitly exposes full native processing without declaring its preview browser-ready or PMTiles fragments');
 await assert.rejects(()=>A.capture(native,{scope:'tile-preview',allowTilePreview:true}),/bounded native preview/);ok(true,'The generic capture API rejects a bounded native preview even when tile preview is explicitly allowed');
 await assert.rejects(()=>ctx.PortalGISCore.capture(native,{selected:native.data.features}),/original vector/);ok(true,'Explicit selected rows cannot bypass the native preview guard in the GIS capture path');
 await assert.rejects(()=>D.capture(native,{mode:'all'}),/bounded native preview/);ok(!D.ready(native),'The workset API cannot process the preview as a fixed original workset');
 ok(D.current()===native&&D.describe(native).count===25005&&D.describe(native).previewCount===1,'Current input resolves the full native record count separately from its bounded display count');
 ok(D.coverage(native).includes('Partial native result'),'An incomplete native request remains explicitly partial in the data context');
 ok(P.describe(native).kind==='native'&&P.format(native)==='GeoParquet · native'&&P.markup(native).includes('View full result table'),'Layer contents label the native format and expose the full result table');
 const shared={...native,cfg:{name:'Shared display',type:'geojson'}};ok(A.capabilities(shared).kind==='native-preview'&&!A.capabilities(shared).nativeAnalysis&&P.describe(shared).label==='Bounded native preview','A shared display without its local dependency cannot claim that a full native result is available');
 ok(!ctx.PortalInventory.tableData.metadata(shared).spatialEligible,'Export metadata cannot erase the bounded preview analysis restriction');
 const elements=new Map(),element=()=>({value:'',dataset:{},hidden:false,innerHTML:'',textContent:''}),container={set innerHTML(value){this.markup=value;},querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};
 const widget=ctx.PortalGISRange.mount(container,{initial:'extent'});elements.get('[data-range-layer]').value=native.id;
 await assert.rejects(()=>widget.resolve(),/bounded native preview/);ok(true,'The canonical range resolver rejects preview extent as the full result extent');
 widget.setKind('selected-extent');await assert.rejects(()=>widget.resolve(),/bounded native preview/);ok(true,'Selection extent cannot repackage native preview rows into an analytical loading boundary');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
