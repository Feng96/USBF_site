/* Real HTTP/auth and public original providers; fixtures are display resources only. */
const fs=require('fs'),assert=require('assert');
const {buildPMTiles}=require('./pmtiles-fixtures.cjs');
module.exports=async qa=>{
 const p=qa.page,{ok}=qa,native=JSON.parse(fs.readFileSync(process.env.PORTAL_UNIFIED_NATIVE,'utf8'));
 const display=buildPMTiles({sourceLayer:'building',properties:{render_height:999},z:16});
 const http=[],jobs=[],requests=[];p.on('request',r=>{if(r.url().startsWith(native.endpoint)){const h=r.headers();requests.push({method:r.method(),path:new URL(r.url()).pathname,authorized:!!h.authorization,origin:h.origin||null,body:r.postDataJSON()});}});
 p.on('response',r=>{if(r.url().startsWith(native.endpoint))http.push({method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
 await p.route(native.endpoint+'/**',r=>r.continue());
 await p.route('https://tiles.openfreemap.org/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({tilejson:'3.0.0',tiles:['https://display-fixture.test/{z}/{x}/{y}.pbf'],vector_layers:[{id:'building',fields:{render_height:'Number'}}],minzoom:0,maxzoom:16})}));
 await p.route('https://display-fixture.test/**',r=>r.fulfill({status:200,contentType:'application/x-protobuf',headers:{'access-control-allow-origin':'*'},body:display.tile}));
 await p.route('https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/**',r=>{const range=/bytes=(\d+)-(\d+)/.exec(r.request().headers().range||''),start=range?Number(range[1]):0,end=range?Math.min(Number(range[2]),display.archive.length-1):display.archive.length-1;return r.fulfill({status:range?206:200,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range,ETag','content-range':`bytes ${start}-${end}/${display.archive.length}`,etag:'"qa-display-only"'},body:display.archive.subarray(start,end+1)});});
 await qa.open('?empty=1&unified-source='+Date.now()+'#base=blank');await p.locator('#interface-language').selectOption('en');
 await p.evaluate(async n=>{await PortalNativeEngine.pair(n.code,n.endpoint);window.__savedQA=await PortalDataWorkspace.saveArea({mask:turf.bboxPolygon([-77.0713,38.9117,-77.0707,38.9123]),label:'Frozen tiny DC AOI',meta:{label:'Frozen tiny DC AOI',kind:'rectangle',crs:'EPSG:4326'}},'Frozen tiny DC AOI');window.__savedGeometry=PortalDataWorkspace.range().mask.geometry;},native);
 ok(await p.evaluate(()=>PortalNativeEngine.status().connected),'Browser pairs with the fresh native Engine over real loopback HTTP');
 await p.locator('#data-scope-bar [data-data-workspace]').click();
 const choices=await p.locator('[data-dw-source]').locator('option').evaluateAll(es=>es.map(e=>({id:e.value,name:e.textContent})));
 ok(choices.some(x=>x.id==='catalog:osm-buildings')&&choices.some(x=>x.id==='catalog:overture-buildings'),'Data & scope offers new OSM and Overture original connections before their display layers exist');
 // An old engine is simulated only by removing its advertised new-provider capability.
 const oldStatus=async route=>{const response=await route.fetch(),value=await response.json();delete value.capabilities.originalDataProviders;await route.fulfill({response,json:value});};
 await p.route(native.endpoint+'/v1/status',oldStatus);await p.evaluate(()=>PortalNativeEngine.refresh());
 await p.locator('[data-dw-source]').selectOption('catalog:osm-buildings');
 ok(await p.locator('[data-dw-execution]').inputValue()==='native'&&await p.locator('[data-dw-execution] option[value=browser]').evaluate(e=>e.disabled),'Selecting OSM forces native loading and disables browser execution');
 ok((await p.locator('[data-dw-engine-state]').textContent()).includes('Update the local engine'),'Older Engine capabilities produce visible update guidance');
 const plansBefore=requests.filter(r=>r.path==='/v1/plan').length;await p.locator('[data-dw-load]').click();await p.waitForFunction(()=>!PortalDataWorkspace.loading);
 ok((await p.locator('[data-dw-status]').textContent()).includes('Update the local engine')&&requests.filter(r=>r.path==='/v1/plan').length===plansBefore,'Old Engine loading fails before any provider plan or job request');
 await p.unroute(native.endpoint+'/v1/status',oldStatus);await p.evaluate(()=>PortalNativeEngine.refresh());
 for(const provider of ['osm-buildings','overture-buildings']){
  await p.evaluate(()=>document.querySelector('#task-center-dialog')?.close());await p.locator('#data-scope-bar [data-data-workspace]').click();
  const choice=await p.evaluate(id=>[...PortalLayers.layers.values()].find(l=>l.cfg.id===id)?.id||'catalog:'+id,provider);
  await p.locator('[data-dw-source]').selectOption(choice);
  ok(await p.locator('[data-dw-execution]').inputValue()==='native'&&await p.locator('[data-dw-execution] option[value=browser]').evaluate(e=>e.disabled),provider+' routes through the shared native execution choice');
  await p.evaluate(()=>portal.map.jumpTo({center:[-118.24,34.05],zoom:10}));
  const start=Date.now();await p.locator('[data-dw-load]').click();await p.waitForFunction(()=>!PortalDataWorkspace.loading&&document.querySelector('#task-center-dialog')?.open&&document.querySelector('[data-task-action=start-native]')&&!document.querySelector('[data-task-action=start-native]').disabled,null,{timeout:180000});
  const plan=requests.filter(r=>r.path==='/v1/plan').at(-1);
  ok(plan.authorized&&plan.body.inputs[0].kind==='provider'&&plan.body.inputs[0].providerId===provider&&!plan.body.inputs[0].url,'Planning sends an authenticated declarative '+provider+' request without a source URL');
  ok(await p.evaluate(s=>JSON.stringify(s)===JSON.stringify(window.__savedGeometry),plan.body.scope.geometry),provider+' task plan retains the exact saved AOI after the camera moves');
  if(provider==='overture-buildings')ok(plan.body.inputs[0].releaseId==='2026-10-21.0'&&await p.evaluate(()=>PortalLayers.catalog.find(c=>c.id==='overture-buildings').url.includes('/2026-10-21.0/')),'Overture original task pins the same release as its display');
  ok((await p.locator('.task-plan').textContent()).includes('Frozen tiny DC AOI')&&(await p.locator('.task-plan').textContent()).includes('No task starts until'),'Task center shows the saved boundary and requires explicit Start native task');
  const reused=process.env.PORTAL_UNIFIED_REUSE==='1'?await p.evaluate(provider=>PortalTasks.list().find(t=>t.status==='completed'&&t.name.startsWith(provider==='osm-buildings'?'OpenStreetMap buildings':'Overture Maps')),provider):null;
  let job=reused;
  if(!job){const before=new Set(await p.evaluate(()=>PortalTasks.list().map(t=>t.nativeId)));await p.locator('[data-task-action=start-native]').click();job=await(await p.waitForFunction(ids=>PortalTasks.list().find(t=>t.execution==='native'&&!ids.includes(t.nativeId)&&['completed','failed','partial'].includes(t.status)),Array.from(before),{timeout:240000})).jsonValue();}
  else await p.locator('[data-task-action=back-history]').last().click();
  const detail=await p.evaluate(id=>PortalNativeEngine.job(id),job.nativeId);jobs.push({provider,elapsedSeconds:(Date.now()-start)/1000,reusedCompletedJob:!!reused,detail});
  fs.writeFileSync(qa.out+'/'+provider+'-http-job.json',JSON.stringify(jobs.at(-1),null,2));
  ok(detail.status==='completed'&&detail.result.rows>0,provider+' original loading completes with actual public provider data');
  const create=requests.filter(r=>r.path==='/v1/jobs'&&r.method==='POST'&&r.body?.inputs?.[0]?.providerId===provider).at(-1);
  ok((reused||create.authorized)&&JSON.stringify((reused?detail.scope:create.body.scope).geometry)===JSON.stringify(plan.body.scope.geometry),provider+' execution uses the exact AOI reviewed in its task plan');
  const transport=detail.parts.map(part=>part.transport).filter(Boolean);ok(transport.length&&transport.every(t=>t.method==='checked-http-range'&&!t.wholeFileDownloaded&&t.networkBytes<t.sourceBytes),provider+' receipt records bounded checked HTTP ranges rather than whole-source downloads');
  await p.locator('[data-task-select="'+job.id+'"]').click();await p.waitForFunction(()=>document.querySelector('[data-task-action=add-result]'));
  await p.locator('[data-task-action=add-result]').click();await p.waitForFunction(id=>PortalLayers.active?.cfg.nativeSource?.jobId===id,job.nativeId);
  const layerId=await p.evaluate(()=>PortalLayers.active.id);ok(await p.evaluate(id=>PortalLayers.layers.get(id).cfg.nativeSource.recordCount===PortalLayers.layers.get(id).data.features.length,layerId),'Tiny '+provider+' result enters the common native layer route with its full result count');
  const identity=await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return {license:l.cfg.license,provider:l.cfg.provider,release:l.cfg.nativeSource.release,coverage:l.data.provenance.coverage};},layerId);
  ok(/ODbL/.test(identity.license)&&!!identity.provider&&identity.release.providerId===provider&&identity.release.releaseId===(provider==='overture-buildings'?'2026-10-21.0':'latest'),provider+' managed result preserves original provider, ODbL attribution and release identity');
  ok(identity.coverage.sourceReleases?.[0]?.providerId===provider&&!!(identity.coverage.sourceReleases[0].catalogIdentity||identity.coverage.sourceReleases[0].identity),provider+' result provenance keeps real source coverage and HTTP validator metadata');
  await p.locator('#data-scope-bar [data-data-workspace]').click();await p.locator('[data-dw-workset]').selectOption(layerId);await p.locator('[data-dw-mode]').selectOption('all');await p.locator('[data-dw-go=table]').click();
  await p.waitForFunction(id=>{const panel=document.querySelector('#native-result-table');return panel?.open&&panel.nativeRow?.nativeId===id&&panel.querySelector('[data-native-table-body] tbody tr');},job.nativeId);
  const table=await p.evaluate(()=>({summary:document.querySelector('[data-native-table-summary]').textContent,columns:[...document.querySelectorAll('[data-native-sort]')].map(e=>e.dataset.nativeSort),body:document.querySelector('[data-native-table-body]').textContent}));
  fs.writeFileSync(qa.out+'/'+provider+'-table-ui.json',JSON.stringify(table,null,2));
  ok(table.summary.includes(detail.result.rows+' matching result records')&&(provider==='osm-buildings'?table.columns.includes('building:levels')&&table.columns.includes('roof:shape')&&table.columns.includes('timestamp'):table.columns.includes('sources')&&table.columns.includes('names')&&table.columns.includes('roof_shape')),provider+' opens the full native attribute table with original published fields');
  const raw=await p.evaluate(id=>PortalNativeEngine.table(id,0,1),job.nativeId);fs.writeFileSync(qa.out+'/'+provider+'-original-table.json',JSON.stringify(raw,null,2));
  ok(provider==='osm-buildings'?raw.rows[0].properties.bbox&&Object.hasOwn(raw.rows[0].properties,'building:levels'):Array.isArray(raw.rows[0].properties.sources),provider+' original properties remain structured in the real result table response');
  await p.locator('[data-native-table-close]').click();await p.evaluate(async id=>{const layer=PortalLayers.layers.get(id);await PortalTasks.openProcessing(layer,'measure',{mode:'area'});},layerId);
  const areaPlan=requests.filter(r=>r.path==='/v1/plan').at(-1);ok(areaPlan.body.operation==='measure'&&JSON.stringify(areaPlan.body.scope.geometry)===JSON.stringify(plan.body.scope.geometry),'Area-scoped '+provider+' processing reuses the exact saved loading AOI');
  await p.evaluate(()=>document.querySelector('#task-center-dialog').close());
  await qa.screenshot(provider+'-native-result.png');
 }
 const shared=await qa.context.newPage();let privateRequests=0;shared.on('request',r=>{if(r.url().startsWith(native.endpoint))privateRequests++;});
 try{await shared.goto(qa.base+'?empty=1&readonly=1#base=blank');await shared.waitForFunction(()=>window.PortalTasks&&window.PortalNativeEngine);const blocked=await shared.evaluate(()=>{const value={};for(const [name,fn] of Object.entries({plan:()=>PortalNativeEngine.plan({}),create:()=>PortalNativeEngine.create({}),task:()=>PortalTasks.planNativeLoad({},{}),processing:()=>PortalTasks.openProcessing('measure',{})})){try{fn();value[name]=false;}catch(e){value[name]=/read-only/.test(e.message);}}return value;});ok(Object.values(blocked).every(Boolean)&&privateRequests===0,'Readonly shared maps block native plans, execution and processing without private Engine requests');}finally{await shared.close();}
 ok(!qa.errors.length,'Unified original-data source workflow has no uncaught browser errors');
 const report={passed:true,displayFixturesOnly:true,oldCapabilitySimulation:'Real /v1/status response with originalDataProviders removed; provider outputs never mocked',checks:qa.checks,http,requests,jobs:jobs.map(({provider,elapsedSeconds,reusedCompletedJob,detail:d})=>({provider,pageTestElapsedSeconds:elapsedSeconds,reusedCompletedJob,nativeTaskSeconds:(Date.parse(d.updatedAt)-Date.parse(d.createdAt))/1000,id:d.id,status:d.status,result:d.result,coverage:d.coverage,transport:d.parts.map(p=>p.transport)})),errors:qa.errors};fs.writeFileSync(qa.out+'/unified-source-browser-report.json',JSON.stringify(report,null,2));
};
