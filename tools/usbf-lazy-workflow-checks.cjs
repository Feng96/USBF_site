/* Shared-browser acceptance only. Real PMTiles, GeoParquet worker, geometry and downloads.
 * Run through the existing overnight-browser qa.run; this file never starts Chrome.
 * Input data is synthetic and must never be published as actual building records. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {createFixtures,installRoutes}=require('./usbf-display-fixtures.cjs');
module.exports=async qa=>{
 const page=qa.page,start=qa.checks.length,fixtures=qa.usbfDisplayFixture||createFixtures(),route=await installRoutes(page,fixtures),artifacts=[];
 const rawCount=()=>route.geoRequests.length;
 const close=async selector=>{const item=page.locator(selector);if(await item.count()&&await item.isVisible())await item.click();};
 const waitMap=()=>page.waitForFunction(()=>{const l=PortalLayers.active;return l?.renderTiled&&portal.map.isSourceLoaded(l.id)&&portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).some(f=>f.properties.usbf_id);},null,{timeout:60000});
 const ready=async()=>{await page.evaluate(()=>PortalAnalysis.whenReady());await page.waitForFunction(()=>!PortalAnalysis.busy);const error=await page.evaluate(()=>PortalAnalysis.error);if(error)throw Error(error);};
 const heldRead=async()=>{for(let i=0;i<600;i++){if(route.held.length)return;await page.waitForTimeout(50);}throw Error('The genuine original-data worker did not reach a held Range request.');};
 const layerID=()=>page.evaluate(()=>PortalLayers.active.id);
 const freshLayer=async()=>{const id=await page.evaluate(async center=>{await PortalAnalysis.cancel({clear:true});for(const l of Array.from(PortalLayers.layers.values()))PortalLayers.remove(l.id);const l=await PortalLayers.add({...PortalLayers.catalog.find(c=>c.id==='usbf-live')},{restore:true,throwOnError:true});portal.setViewMode(false,false);portal.map.jumpTo({center,zoom:17,pitch:0,bearing:0});return l.id;},fixtures.center);await waitMap();return id;};
 const download=async(action,name)=>{const file=await qa.download(action,name);artifacts.push(file);return file;};
 try{
  await qa.open('?empty=1');let id=await freshLayer();
  qa.ok(rawCount()===0&&route.tileRequests.length>0,'Opening a real synthetic PMTiles building map makes zero GeoParquet requests');
  qa.ok(await page.evaluate(()=>{const l=PortalLayers.active;return l.cfg.type==='viewport'&&l.cfg.analysisMode==='on-demand'&&l.data.features.length===0&&l.displayRelease.buildings===1;}),'The displayed tile keeps its logical USBF connection and starts without raw records');
  for(const [dx,dy,zoom] of [[.00005,0,17.6],[-.00005,.00005,16.5],[0,0,18],[0,0,17]]){await page.evaluate(({center,dx,dy,zoom})=>portal.map.jumpTo({center:[center[0]+dx,center[1]+dy],zoom,pitch:0}),{center:fixtures.center,dx,dy,zoom});await waitMap();}
  qa.ok(rawCount()===0,'Repeated zooming and panning keep the tile map visible without fetching original data');
  const preview=await page.evaluate(()=>{const l=PortalLayers.active,f=portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).find(f=>f.properties.usbf_id);PortalLayers.inspect(l,f);return {geometry:f.geometry,properties:f.properties};});
  qa.ok((await page.locator('#properties-content').innerText()).includes('tile preview')&&await page.locator('[data-explorer-load-building]').isVisible(),'Selecting a displayed building presents tile attributes and an explicit original-building action');
  qa.ok(await page.evaluate(()=>PortalExplorer.footprintArea(PortalLayers.active,PortalLayers.selection.feature)===null),'The tile card cannot calculate full footprint area from display geometry');
  await page.evaluate(()=>PortalComposer.open('map'));
  const png=await download(()=>page.locator('#composer-download-png').click(),'usbf-lazy-map-before-raw.png');
  const pdf=await download(()=>page.locator('#composer-download-pdf').click(),'usbf-lazy-map-before-raw.pdf');
  qa.ok(fs.readFileSync(png).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&fs.readFileSync(pdf).subarray(0,5).toString()==='%PDF-','Ordinary map output produces genuine PNG and PDF files');
  qa.ok(rawCount()===0,'Saving ordinary PNG and PDF maps does not read GeoParquet');await close('[data-close-composer]');
  await page.evaluate(id=>PortalAnalysis.open('stats',{layerId:id,scope:'view'}),id);await ready();
  qa.ok(rawCount()>0&&route.geoRequests.every(request=>/^bytes=\d+-\d+$/.test(request.range||'')),'Explicit Statistics reads the genuine Parquet file through byte ranges');
  const stats=await page.evaluate(()=>({overview:PortalAnalysis.overview,snapshot:PortalAnalysis.snapshot}));
  qa.ok(stats.overview.records===1&&stats.snapshot.features.length===1&&JSON.stringify(stats.snapshot.features[0].geometry)===JSON.stringify(fixtures.feature.geometry),'Statistics use one complete original courtyard polygon with its interior ring preserved');
  const expected=fixtures.feature.properties,actual=stats.snapshot.features[0].properties,nullFields=Object.keys(expected).filter(key=>expected[key]===null),falseFields=Object.keys(expected).filter(key=>expected[key]===false);
  qa.ok(nullFields.length>0&&falseFields.length>0&&nullFields.every(key=>actual[key]===null)&&falseFields.every(key=>actual[key]===false)&&actual.source===expected.source&&actual.height_m===expected.height_m,'The actual worker preserves original nulls, false flags, height and source');
  const afterStats=rawCount();await page.evaluate(id=>PortalAnalysis.open('stats',{layerId:id,scope:'view'}),id);await ready();
  qa.ok(rawCount()===afterStats,'A repeated explicit request for the same view reuses cached originals');await close('[data-analysis-close]');
  await page.evaluate(center=>portal.map.jumpTo({center:[center[0]+.0002,center[1]],zoom:17.3}),fixtures.center);await waitMap();
  qa.ok(rawCount()===afterStats,'Panning after analysis still performs no automatic original-data request');
  await page.evaluate(center=>portal.map.jumpTo({center,zoom:17}),fixtures.center);await waitMap();
  await page.evaluate(()=>{const l=PortalLayers.active,f=portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).find(f=>f.properties.usbf_id);PortalLayers.inspect(l,f);});
  const selectedFile=await download(()=>page.locator('[data-explorer-download-building]').click(),'usbf-lazy-selected-original.geojson'),selected=JSON.parse(fs.readFileSync(selectedFile,'utf8'));
  qa.ok(selected.features.length===1&&selected.features[0].properties.usbf_id===expected.usbf_id&&JSON.stringify(selected.features[0].geometry)===JSON.stringify(fixtures.feature.geometry),'Download building resolves the displayed stable ID to the complete original polygon');
  qa.ok(JSON.stringify(selected.features[0].geometry)!==JSON.stringify(preview.geometry)&&selected.features[0].geometry.coordinates.length>preview.geometry.coordinates.length,'The downloaded courtyard contains original geometry that the simplified MVT preview does not contain');
  await page.evaluate(()=>PortalComposer.open('download'));await page.locator('#composer-data-scope').selectOption('view');
  const areaFile=await download(()=>page.locator('#composer-download-data').click(),'usbf-lazy-area-originals.geojson'),area=JSON.parse(fs.readFileSync(areaFile,'utf8'));
  qa.ok(area.features.length===1&&area.features[0].properties.usbf_id===expected.usbf_id&&area.provenance.geometryQuality!=='clipped-or-simplified-tile-fragments','The ordinary Download data button exports original records after an explicit request');await close('[data-close-composer]');
  const beforeFailure=rawCount(),beforeLayers=await page.evaluate(()=>PortalLayers.layers.size),badImport=await page.evaluate(async()=>{try{await PortalImport.importData({type:'geojson',file:new File(['{ broken json'],'synthetic-invalid.geojson',{type:'application/geo+json'}),name:'Synthetic failed import'});return false;}catch(error){return !!error.message;}});
  qa.ok(badImport&&await page.evaluate(()=>PortalLayers.layers.size)===beforeLayers&&rawCount()===beforeFailure,'A failed import adds no layer and cannot trigger or append old original-data reads');
  // Fresh layer means no analytical cache can conceal the pending-read cancellation.
  id=await freshLayer();const saved=await page.evaluate(async()=> (await PortalProject.collect('Synthetic cancellation check')).project);
  route.holdRaw=true;await page.evaluate(id=>{PortalAnalysis.open('stats',{layerId:id,scope:'view'});},id);
  await page.waitForFunction(()=>PortalLayers.active.analysisState.loading);await heldRead();
  qa.ok(route.held.length>0,'The cancellation scenario holds an actual worker network byte read');
  route.failManifest=true;
  const failedRestore=await page.evaluate(async saved=>{try{await PortalProject.restore({project:saved,files:new Map()});return false;}catch(error){return !!error.message;}},saved);route.failManifest=false;route.releaseHeld();
  await page.waitForFunction(()=>!PortalAnalysis.busy);await waitMap();
  qa.ok(failedRestore&&await page.evaluate(id=>PortalLayers.layers.has(id)&&PortalLayers.layers.get(id).data.features.length===0&&!PortalLayers.layers.get(id).analysisState.loading,id),'Failed restore cancels the old original read, preserves the tile layer and receives no late stale records');
  route.holdRaw=true;await page.evaluate(id=>{PortalAnalysis.open('stats',{layerId:id,scope:'view'});},id);await page.waitForFunction(()=>PortalLayers.active.analysisState.loading);await heldRead();
  const opened=await page.evaluate(async saved=>PortalProject.restore({project:saved,files:new Map()}),saved);route.releaseHeld();await waitMap();
  qa.ok(opened.layers===1&&await page.evaluate(()=>PortalLayers.active.data.features.length===0&&!PortalLayers.active.analysisState.loading),'Successful restore reconnects only the logical catalog source and rejects the cancelled old worker result');
  id=await layerID();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>PortalModels.hide());await waitMap();
  qa.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The phone map fits the viewport without horizontal scrolling');await qa.screenshot('usbf-lazy-map-phone.png');
  await page.evaluate(id=>PortalAnalysis.open('stats',{layerId:id,scope:'view'}),id);await ready();
  qa.ok(await page.locator('#analysis-workspace').evaluate(el=>el.scrollWidth<=el.clientWidth)&&!/Capture snapshot|decode memory|feature pairs|worker pipeline/i.test(await page.locator('#analysis-workspace').innerText()),'Phone Statistics fits the screen and keeps technical loading details out of the normal flow');await qa.screenshot('usbf-lazy-statistics-phone.png');
  qa.ok(qa.errors.length===0,'The genuine lazy tile/worker workflow has no uncaught application errors');
  const report={passed:true,testOnlySyntheticData:true,checks:qa.checks.slice(start),geoRequests:route.geoRequests,tileRequests:route.tileRequests,manifestRequests:route.manifestRequests,artifacts,errors:qa.errors,consoleErrors:qa.consoleErrors};fs.writeFileSync(path.join(qa.out,'usbf-lazy-workflow.json'),JSON.stringify(report,null,2));return report;
 }catch(error){await qa.screenshot('usbf-lazy-workflow-failure.png').catch(()=>{});fs.writeFileSync(path.join(qa.out,'usbf-lazy-workflow-failure.json'),JSON.stringify({error:error.stack,checks:qa.checks.slice(start),state:await qa.state().catch(()=>({})),geoRequests:route.geoRequests,tileRequests:route.tileRequests,errors:qa.errors},null,2));throw error;}
 finally{await route.dispose();await page.setViewportSize({width:1440,height:960});}
};
