/* Tiny original-data workflow fixtures; no browser, network or large files. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const project=path.resolve(__dirname,'..'),turf=require(path.join(project,'vendor/turf-7.2.0.min.js'));
const read=name=>fs.readFileSync(path.join(project,name),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const box=(w,s,e,n,properties={})=>turf.polygon([[[w,s],[e,s],[e,n],[w,n],[w,s]]],properties);
const checks=[],ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
const same=(actual,expected,message)=>{assert.deepStrictEqual(plain(actual),plain(expected),message);checks.push(message);console.log('PASS',message);};
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
function fixture(){
  let bounds=[0,0,.01,.01],calls=[];const handlers={};
  const map={getBounds:()=>({getWest:()=>bounds[0],getSouth:()=>bounds[1],getEast:()=>bounds[2],getNorth:()=>bounds[3]}),on:(event,fn)=>{(handlers[event]||=[]).push(fn);},queryRenderedFeatures:()=>{throw Error('Rendered fragments were read as analysis input.');}};
  const context=vm.createContext({console,setTimeout,clearTimeout,Date,AbortController,turf,portal:{map,ready:false},PortalLayers:{layers:new Map(),selection:null}});
  vm.runInContext(read('analysis-data.js'),context);
  const layer={id:'usbf-fixture',cfg:{type:'viewport',driver:'usbf',name:'Original USBF buildings',analysisMode:'on-demand',heightField:'height_m',fields:['usbf_id','height_m'],license:'Dataset terms'},fields:['usbf_id','height_m'],heightField:'height_m',data:turf.featureCollection([]),viewBounds:[10,10,11,11],loaded:false,error:true,viewLoading:true,ensureData(options){const work=deferred();calls.push({options,...work});return work.promise;}};
  context.PortalLayers.layers.set(layer.id,layer);
  return {context,A:context.PortalAnalysisData,layer,map,calls,handlers,pan(next){bounds=next;for(const fn of handlers.moveend||[])fn();}};
}
const response=(features,bounds=[0,0,.01,.01],extra={})=>({data:turf.featureCollection(features),fields:['usbf_id','height_m'],viewBounds:bounds,viewLimited:false,viewLoadedAt:'2026-10-28T12:00:00Z',viewSelection:'Complete published polygons selected by cx/cy in the requested bounds plus the published ownership buffer.',release:{name:'USBF_v1',updated:'2026-10-28T10:00:00Z',buildings:150261726},loaded:true,error:false,viewLoading:false,...extra});
async function rejected(task,message){await assert.rejects(task,error=>error.name==='AbortError');ok(true,message);}

(async()=>{
  const f=fixture(),{A,layer}=f;
  ok(A.capabilities(layer).geometryAnalysis&&!A.capabilities(layer).wholeLayer&&A.isBuildingLayer(layer),'An empty declared building layer offers bounded original-data analysis before raw records are loaded');
  f.pan([.001,.001,.009,.009]);A.capabilities(layer);A.isBuildingLayer(layer);
  ok(f.calls.length===0,'Availability checks and ordinary map movement never request original building data');
  f.pan([0,0,.01,.01]);
  const original=box(-.002,.002,.002,.004,{usbf_id:'crossing',height_m:18,height_missing:true,modified:null,footprint_license:'ODbL',height_license:'CC BY-NC 4.0'});original.original_record={untouched:true};
  const pending=A.capture(layer,{scope:'view',map:f.map});
  same(f.calls[0].options.bounds,[0,0,.01,.01],'An explicit analysis action requests the map bounds present at the time of the action');
  f.pan([40,40,41,41]);layer.cfg.name='Changed while loading';layer.sourceFilter='changed';layer.data=turf.featureCollection([box(40,40,41,41,{usbf_id:'wrong-cache'})]);
  const loaded=response([original],undefined,{viewLimited:true});f.calls[0].resolve(loaded);const snapshot=await pending;
  same(snapshot.features,[original],'The result uses only the loader response and preserves full crossing geometry, foreign members, nulls and original flags');
  same(snapshot.provenance.requestedView,[0,0,.01,.01],'Panning during the raw-data request cannot change the captured analysis area');
  ok(snapshot.provenance.name==='Original USBF buildings'&&snapshot.provenance.filters.source===''&&snapshot.provenance.featureCount===1&&snapshot.provenance.release.buildings===150261726,'Request-time source settings and local record counts remain separate from national publication totals');
  ok(snapshot.provenance.limited&&snapshot.provenance.selectionRule===loaded.viewSelection&&snapshot.provenance.licenses.includes('ODbL')&&snapshot.provenance.licenses.includes('CC BY-NC 4.0'),'Source truncation, the actual ownership rule and component licenses survive analytical capture');
  original.properties.height_m=99;loaded.release.name='later';
  ok(snapshot.features[0].properties.height_m===18&&snapshot.provenance.release.name==='USBF_v1'&&Object.isFrozen(snapshot.features[0].geometry.coordinates[0]),'A completed snapshot is independent of mutable loader data and publication metadata');
  f.pan([-100,30,-99,31]);ok(f.calls.length===1&&snapshot.features[0].properties.usbf_id==='crossing','Later map movement neither reloads raw data nor changes a completed result');

  const selectedFixture=fixture(),tile=box(.001,.002,.002,.004,{usbf_id:'selected-original',cx:.0015,cy:.003}),selection={layer:selectedFixture.layer.id,feature:tile};selectedFixture.context.PortalLayers.selection=selection;
  const selectedWork=selectedFixture.A.capture(selectedFixture.layer,{scope:'selection',map:selectedFixture.map});
  selection.feature.properties.usbf_id='different-selection';selectedFixture.context.PortalLayers.selection={layer:'other',feature:box(50,50,51,51)};
  const selectedOriginal=box(-.002,.002,.003,.004,{usbf_id:'selected-original',height_m:15,missing:null});selectedFixture.calls[0].resolve(response([selectedOriginal,box(.004,.004,.005,.005,{usbf_id:'other'})]));
  const selected=await selectedWork;
  ok(selectedFixture.calls[0].options.selection.feature.properties.usbf_id==='selected-original'&&Object.isFrozen(selectedFixture.calls[0].options.selection.feature.properties),'The selected rendered ID is independently frozen before awaiting original data');
  same(selected.features,[selectedOriginal],'Selected-building analysis resolves the complete original by USBF ID instead of using its rendered fragment');

  const study=fixture(),boundary={id:'boundary',cfg:{type:'geojson',name:'Requested study area',license:'Boundary terms'},data:turf.featureCollection([box(0,0,.01,.01)])};study.pan([60,60,61,61]);
  const studyWork=study.A.captureStudyArea(study.layer,boundary,{map:study.map});
  same(study.calls[0].options.bounds,[0,0,.01,.01],'Study-area raw loading uses the complete captured boundary extent instead of map bounds');
  boundary.data.features[0].geometry.coordinates[0][0][0]=-10;boundary.cfg.name='Changed boundary';study.calls[0].resolve(response([box(.001,.001,.002,.002,{usbf_id:'inside'}),box(.02,.02,.03,.03,{usbf_id:'outside'})]));
  const area=await studyWork;
  ok(area.features.length===1&&area.provenance.studyArea.name==='Requested study area'&&area.provenance.studyArea.features[0].geometry.coordinates[0][0][0]===0&&area.provenance.licenses.includes('Boundary terms'),'A changed study-area layer cannot retarget an in-flight count or remove its original boundary and license');

  const all=fixture();all.pan([-.02,-.02,.02,.02]);const allWork=all.A.capture(all.layer,{scope:'layer',map:all.map});
  same(all.calls[0].options.bounds,[-.02,-.02,.02,.02],'Layer scope requests the current bounded map area instead of a previous cache elsewhere');
  all.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'bounded'}),box(.03,.03,.04,.04,{usbf_id:'outside-current-map'})],[-.05,-.05,.05,.05]));const bounded=await allWork;
  ok(bounded.provenance.requestedScope==='layer'&&bounded.provenance.scope==='loaded-view'&&!bounded.capabilities.wholeLayer&&bounded.provenance.scopeLabel.includes('captured map area'),'A live layer scope cannot advertise a national or complete-layer inventory');
  ok(bounded.features.length===1&&bounded.features[0].properties.usbf_id==='bounded'&&bounded.provenance.loadedView[2]===.05,'A larger reusable raw cache is filtered to the requested current area while its actual loaded coverage stays explicit');

  const backed=fixture();backed.layer.cfg.type='pmtiles';const backedWork=backed.A.capture(backed.layer,{scope:'view',map:backed.map});backed.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'backed-original'})]));
  ok((await backedWork).features[0].properties.usbf_id==='backed-original','PMTiles with analytical backing await original data without querying rendered tile geometry');

  const overridden=fixture(),explicit=[-.03,-.03,.03,.03],overrideWork=overridden.A.capture(overridden.layer,{scope:'view',bounds:explicit,map:overridden.map});explicit[0]=-100;
  same(overridden.calls[0].options.bounds,[-.03,-.03,.03,.03],'An explicit bounds override is copied before an asynchronous request');overridden.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'override'})],[-.03,-.03,.03,.03]));await overrideWork;

  const pre=fixture(),stopped=new AbortController();stopped.abort();await rejected(()=>pre.A.capture(pre.layer,{scope:'view',map:pre.map,signal:stopped.signal}),'A cancelled action is rejected before any original-data read');ok(pre.calls.length===0,'Pre-cancellation creates no raw-data job');
  const cancelled=fixture(),controller=new AbortController(),cancelWork=cancelled.A.capture(cancelled.layer,{scope:'view',map:cancelled.map,signal:controller.signal});controller.abort();cancelled.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'late'})]));await rejected(()=>cancelWork,'A late loader response cannot publish a cancelled analytical snapshot');
  const batched=fixture(),batchController=new AbortController(),batchWork=batched.A.capture(batched.layer,{scope:'layer',map:batched.map,signal:batchController.signal,onProgress:()=>batchController.abort()});batched.calls[0].resolve(response(Array.from({length:260},(_,i)=>box(0,0,.001,.001,{usbf_id:'batch-'+i}))));await rejected(()=>batchWork,'Cancellation during raw-record processing stops a batched analytical job');
  const removed=fixture(),removedWork=removed.A.capture(removed.layer,{scope:'view',map:removed.map});removed.context.PortalLayers.layers.delete(removed.layer.id);removed.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'removed'})]));await rejected(()=>removedWork,'Removing the source layer prevents a late raw response from becoming a result');
  const replaced=fixture(),replacedWork=replaced.A.capture(replaced.layer,{scope:'view',map:replaced.map});replaced.context.PortalLayers.layers.set(replaced.layer.id,{...replaced.layer});replaced.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'old-project'})]));await rejected(()=>replacedWork,'Replacing a project layer with the same ID still rejects the old pending snapshot');
  const bad=fixture(),badWork=bad.A.capture(bad.layer,{scope:'view',map:bad.map});bad.calls[0].resolve(response([box(0,0,.001,.001,{usbf_id:'fragment'})],undefined,{data:{type:'FeatureCollection',features:[box(0,0,.001,.001)],provenance:{spatialEligible:false,geometryQuality:'clipped-or-simplified-tile-fragments'}}}));await assert.rejects(()=>badWork,/Original vector geometry/);ok(true,'An analytical backing response cannot relabel declared tile fragments as original geometry');

  // Exercise the actual UI eligibility and model binding functions without a browser.
  const ui=fixture(),elements={'analysis-layer':{value:ui.layer.id},'analysis-scope':{value:'view'},'analysis-tile-optin':{checked:false}};
  ui.context.document={addEventListener(){},getElementById:id=>elements[id]||null};ui.context.localStorage={getItem:()=>null};
  vm.runInContext(read('analysis-ui.js').replace('root.PortalAnalysis={','root.__analysisChecks={available,inputBinding,sourceNote};root.PortalAnalysis={'),ui.context);
  ok(ui.context.__analysisChecks.available()&&ui.context.__analysisChecks.sourceNote(ui.layer,ui.A.capabilities(ui.layer)).includes('Original buildings'),'Statistics remain actionable on an empty logical layer even while display tiles report loading or failure');
  const before=ui.context.__analysisChecks.inputBinding();ui.layer.data=turf.featureCollection([box(0,0,.001,.001)]);ui.layer.viewLoadedAt='new-cache';ui.layer.release={name:'new-release'};
  ok(ui.context.__analysisChecks.inputBinding()===before,'Raw cache population cannot make the newly captured on-demand result immediately stale');
  elements['analysis-scope'].value='selection';ui.context.PortalLayers.selection={layer:ui.layer.id,feature:box(0,0,.001,.001,{usbf_id:'same-building'})};const selectedBinding=ui.context.__analysisChecks.inputBinding();ui.context.PortalLayers.selection={layer:ui.layer.id,feature:box(-.001,-.001,.002,.002,{usbf_id:'same-building'})};
  ok(ui.context.__analysisChecks.inputBinding()===selectedBinding,'Resolving the selected display fragment to the same original USBF ID does not falsely mark its result stale');elements['analysis-scope'].value='view';
  const lodContext=vm.createContext({console,setTimeout,clearTimeout,Date,AbortController,PortalAnalysisData:ui.A,PortalLayers:ui.context.PortalLayers,portal:{map:ui.map,ready:false}});
  const guard=read('lod1-export.js').split('export function sourceGuard')[1].split('const coordinateEpsilon')[0];
  const lodSource=read('lod1-ui.js').replace(/^import .*;\n/m,'').replace(/\bexport /g,'');
  vm.runInContext('function sourceGuard'+guard+'\nconst build=()=>{},makeOBJ=()=>{},makeGLB=()=>{},exportPackage=()=>{},limits={};\n'+lodSource+'\nglobalThis.__lodChecks={usable,numericFields,captureBinding,bindingCurrent};',lodContext);
  ui.layer.data=turf.featureCollection([]);ok(lodContext.__lodChecks.usable(ui.layer)&&lodContext.__lodChecks.numericFields(ui.layer).includes('height_m'),'LoD1 accepts declared buildings with metadata height fields before their first original-data load');
  const modelBinding=lodContext.__lodChecks.captureBinding(ui.layer,{scope:'view',field:'height_m',units:'metres',confirmed:true});ui.pan([70,30,71,31]);ui.layer.data=turf.featureCollection([box(70,30,71,31)]);ui.layer.release={name:'cache-update'};
  ok(lodContext.__lodChecks.bindingCurrent(modelBinding),'A completed on-demand model remains bound to its captured originals when map bounds or the cache change');
  ui.context.PortalLayers.layers.delete(ui.layer.id);ok(!lodContext.__lodChecks.bindingCurrent(modelBinding),'A model still invalidates when its source layer is removed');
  const imported={id:'imported-buildings',cfg:{type:'geojson',name:'Imported buildings',dataRole:'buildings'},data:turf.featureCollection([box(0,0,.001,.001,{height_m:10})]),fields:['height_m'],heightField:'height_m'};ui.context.PortalLayers.layers.set(imported.id,imported);
  const importedBinding=lodContext.__lodChecks.captureBinding(imported,{scope:'view'});ui.pan([0,0,.01,.01]);
  ok(!lodContext.__lodChecks.bindingCurrent(importedBinding),'Imported-layer model bindings retain their existing view-change invalidation behavior');
  ok(ui.calls.length===0,'Statistics eligibility and LoD1 preparation do not implicitly load GeoParquet');

  const metadata=fixture(),displayRelease={name:'USBF_v1',updated:'2026-10-27T10:00:00Z'},analysisRelease={name:'USBF_v1',updated:'2026-10-28T10:00:00Z'};metadata.layer.visible=true;metadata.layer.renderTiled=true;metadata.layer.displayRelease=displayRelease;metadata.layer.release=analysisRelease;metadata.layer.analysisRelease=analysisRelease;metadata.layer.bounds=[[-125,24],[-66,50]];metadata.layer.viewLimited=true;metadata.layer.analysisState={bounds:[0,0,.01,.01]};
  metadata.context.document={querySelector:()=>null,createElement:()=>({set innerHTML(value){this.content={textContent:value};}})};metadata.map.getStyle=()=>({layers:[],sources:{}});
  vm.runInContext(read('map-composer.js'),metadata.context);const mapSources=metadata.context.PortalComposer.sources().layers[0];
  ok(mapSources.release.updated===displayRelease.updated&&mapSources.analysisRelease.updated===analysisRelease.updated,'Map export distinguishes the displayed tile release from a newer analytical data release');
  same(mapSources.extent,[[-125,24],[-66,50]],'Map metadata describes the display extent rather than an unrelated cached analysis area');
  ok(!mapSources.limited&&mapSources.analysisExtent[2]===.01&&metadata.calls.length===0,'Reading map export metadata never loads GeoParquet or presents analytical truncation as a missing display');
  metadata.layer.usbfConnection={display:{url:'https://data.source.coop/opengeos/us-buildings/USBF_display/releases/example/buildings.pmtiles?v=abc',sha256:'a'.repeat(64),source_layer:'usbf',minzoom:10,maxzoom:15}};
  const archive=metadata.context.PortalComposer.sources().layers[0].displayArchive;
  ok(archive.sha256==='a'.repeat(64)&&archive.sourceLayer==='usbf'&&archive.url.includes('/releases/example/'),'Exported map metadata records the exact immutable display archive independently of analytical source files');
  metadata.layer.analysisRelease=null;ok(metadata.context.PortalComposer.sources().layers[0].analysisRelease===null,'A map with no prepared original data never claims a completed analytical release');
  console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
