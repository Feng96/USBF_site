/* Actual small-browser loading, cancellation, processing and IndexedDB history. */
const fs=require('fs');
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;await qa.open('?empty=1&browser-task-test='+Date.now());await p.locator('#interface-language').selectOption('en');
 const loaded=await p.evaluate(async()=>{
  const features=[0,.0003,.0006].map((x,i)=>turf.bboxPolygon([-77.071+x,38.912,-77.0709+x,38.9121],{properties:{height_m:10+i,flag:false,long_id:'9007199254740993123'}}));
  const ref={version:1,sourceId:'usbf-live',policy:'pinned',releaseId:'qa-pinned-release',manifestSha256:'a'.repeat(64),displaySha256:'b'.repeat(64)},release={name:'Original fixture',updated:'2026-11-04T00:00:00Z',releaseRef:ref,files:[{path:'qa.parquet',sha256:'c'.repeat(64)}]};
  const source=await PortalLayers.addGeoJSON('Browser source',{type:'FeatureCollection',features,provenance:{spatialEligible:true,limited:true,geometryQuality:'full-source',release}},{dataRole:'buildings',allowHeight:true,heightField:'height_m'},{restore:true});
  const mask=turf.bboxPolygon([-77.072,38.911,-77.069,38.914]),range=PortalGISRange.value(mask,'Frozen test area',{kind:'box',crs:'EPSG:4326'});await PortalDataWorkspace.saveArea(range,'Frozen test area');
  const output=await PortalAnalysisLayers.load(source,{range});return {source:source.id,output:output.id,range,task:PortalTasks.list().find(t=>t.result?.layerId===output.id)};
 });
 ok(loaded.task.execution==='browser'&&loaded.task.status==='partial'&&loaded.task.progress.actualRows===3,'Real browser loading records its execution location, exact output count and inherited partial coverage');
 ok(loaded.task.scope.label==='Frozen test area'&&loaded.task.release.releaseRef.releaseId==='qa-pinned-release','Browser task history retains the frozen loading boundary and exact source release');
 ok(await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return l.cfg.releaseRef.releaseId==='qa-pinned-release'&&l.data.features[0].properties.flag===false&&l.data.features[0].properties.long_id==='9007199254740993123';},loaded.output),'The fixed output retains release identity and unmodified source flags and long identifiers');
 const cancelled=await p.evaluate(async({source,range})=>{const abort=new AbortController();abort.abort();const before=PortalTasks.list().map(t=>t.id);await PortalAnalysisLayers.load(PortalLayers.layers.get(source),{range,signal:abort.signal});return PortalTasks.list().find(t=>!before.includes(t.id));},loaded);
 ok(cancelled.status==='cancelled'&&!cancelled.result&&!cancelled.capabilities.cancel,'An aborted browser read leaves a cancelled task and cannot publish an output layer');
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalGIS.open('measure');},loaded.output);ok(await p.locator('[data-gis-execution]').inputValue()==='browser','A normal fixed workset explicitly defaults to browser processing');
 await p.locator('[data-gis-output-name]').fill('Browser measurement task');await p.locator('[data-gis-run]').click();await p.waitForFunction(()=>PortalTasks.list().some(t=>t.name==='Browser measurement task'&&['partial','completed','failed'].includes(t.status)));
 const processed=await p.evaluate(()=>PortalTasks.list().find(t=>t.name==='Browser measurement task'));ok(processed.operation==='measure'&&processed.status==='partial'&&processed.result.rows===3&&!processed.capabilities.retry,'Browser processing appears in history and does not offer an incorrect load-only retry or erase partial coverage');
 const interrupted=await p.evaluate(async({source,range})=>PortalTasks.startBrowser({name:'Browser closure checkpoint',source:PortalLayers.layers.get(source),range,cancel(){}}),loaded);
 await qa.open('?empty=1&browser-task-reload='+Date.now());await p.waitForFunction(()=>!!window.PortalTasks);await p.evaluate(()=>PortalTasks.ready());const restored=await p.evaluate(id=>PortalTasks.get(id),interrupted);
 ok(restored.status==='interrupted'&&!restored.capabilities.cancel&&restored.error.includes('new browser read'),'Reloaded browser work is marked interrupted rather than resumable or still cancellable');
 ok(await p.evaluate(id=>PortalTasks.get(id)?.result?.rows===3,loaded.task.id),'Completed browser task metadata survives a real page reload through IndexedDB');
 ok(!qa.errors.length,'Browser task loading, cancellation, processing and history have no uncaught errors');
 fs.writeFileSync(qa.out+'/task-browser-workflow.json',JSON.stringify({passed:true,checks:qa.checks,loaded,cancelled,processed,restored},null,2));
};
