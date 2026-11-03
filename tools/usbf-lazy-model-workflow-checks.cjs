/* The original worker must also serve an explicitly requested LoD1 model. */
const fs=require('fs'),path=require('path'),{createFixtures,installRoutes}=require('./usbf-display-fixtures.cjs');
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length,fixture=createFixtures(),route=await installRoutes(p,fixture);
 try{
  await qa.open();const id=await p.evaluate(async center=>{const layer=await PortalLayers.add(PortalLayers.catalog[0],{restore:true,throwOnError:true});portal.map.jumpTo({center,zoom:17,pitch:0,bearing:0});return layer.id;},fixture.center);
  await p.waitForFunction(()=>PortalLayers.active?.renderTiled&&portal.map.isSourceLoaded(PortalLayers.active.id));
  await p.evaluate(()=>PortalLoD1.open());
  qa.ok(await p.locator('#lod1-form').isVisible()&&route.geoRequests.length===0,'Create from buildings offers the displayed dataset before loading original records');
  await p.locator('#lod1-create').click();await p.waitForFunction(()=>!PortalLoD1.busy&&PortalLoD1.model,null,{timeout:90000});
  const result=await p.evaluate(()=>({counts:PortalLoD1.model.metadata.counts,geometry:PortalLoD1.model.preview.features[0].geometry,source:PortalLoD1.model.metadata.source.provenance}));
  qa.ok(route.geoRequests.length>0&&result.counts.modeledRecords===1&&JSON.stringify(result.geometry)===JSON.stringify(fixture.feature.geometry),'Explicit LoD1 creation reads the original courtyard and retains its complete outline and interior ring');
  qa.ok(result.source.geometryQuality==='full-loaded-source-geometry'&&result.source.release.buildings===1,'Generated models retain the original-data release and analytical geometry provenance');
  const zip=await qa.download(()=>p.locator('#lod1-download').click(),'usbf-lazy-model.zip');qa.ok(fs.readFileSync(zip).readUInt32LE(0)===0x04034b50,'The lazy source produces a genuine downloadable model package');
  const reads=route.geoRequests.length;await p.locator('#lod1-close').click();await p.evaluate(center=>portal.map.jumpTo({center:[center[0]+.002,center[1]],zoom:17}),fixture.center);await p.evaluate(()=>PortalLoD1.open());
  qa.ok(await p.locator('#lod1-result').isVisible()&&(await p.locator('#lod1-message').textContent()).includes('captured earlier')&&route.geoRequests.length===reads,'A pan keeps the frozen model and explicitly identifies its earlier area without fetching new original data');
  const project=await p.evaluate(async()=> (await PortalProject.collect('Frozen model check')).project);await p.evaluate(async project=>PortalProject.restore(await PortalProject.prepare(project)),project);
  qa.ok(await p.evaluate(()=>!PortalLoD1.model)&&route.geoRequests.length===reads,'Opening a map clears the old generated-model cache without reading original GeoParquet');
  qa.ok(qa.errors.length===0,'The complete lazy LoD1 workflow has no uncaught application errors');
  const report={passed:true,checks:qa.checks.slice(start),syntheticFixture:true};fs.writeFileSync(path.join(qa.out,'usbf-lazy-model-workflow.json'),JSON.stringify(report,null,2));return report;
 }finally{await route.dispose();await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();}).catch(()=>{});}
};
