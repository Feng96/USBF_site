/* Exercise Project metadata with a disconnected native source, without mocking the engine. */
const fs=require('fs');
module.exports=async qa=>{
 const p=qa.page,{ok}=qa,start=qa.checks.length;await qa.open('?empty=1&native-project='+Date.now()+'#base=blank');await p.waitForFunction(()=>window.PortalProject&&window.PortalDataWorkspace&&window.PortalLocalModels?.replaceModels);
 const result=await p.evaluate(async()=>{
  PortalLayers.clear();portal.setBasemap('blank');
  const ref={version:1,workspaceId:'saved-unavailable-workspace',path:'Results/unchanged-output.parquet',format:'GeoParquet',jobId:'saved-unavailable-job',recordCount:20000,sha256:'c'.repeat(64),release:{releaseRef:{version:1,sourceId:'usbf-live',policy:'latest'}}};
  const data={type:'FeatureCollection',provenance:{nativeResult:{path:ref.path,recordCount:ref.recordCount},nativeWorkspaceId:ref.workspaceId,nativeTaskId:ref.jobId,geometryQuality:'bounded-native-preview',spatialEligible:false,limited:true},features:[{type:'Feature',properties:{height_m:null,original_id:'9007199254740993123'},geometry:{type:'Polygon',coordinates:[[[-77.072,38.912],[-77.0716,38.912],[-77.0716,38.9124],[-77.072,38.9124],[-77.072,38.912]]]}}]};
  await PortalLayers.addGeoJSON('Saved native preview',data,{nativeSource:ref,allowHeight:false});const project=(await PortalProject.collect('Saved native dependency')).project,prepared=await PortalProject.prepare(project);await PortalProject.restore(prepared);const restored=PortalLayers.active;
  const failures=[];for(const fn of [()=>PortalDataWorkspace.capture(restored),()=>PortalGISCore.capture(restored)])try{await fn();failures.push(false);}catch(_){failures.push(true);}
  const before=Array.from(PortalLayers.layers.keys()),bad=JSON.parse(JSON.stringify(project));bad.layers[0].meta.nativeSource.sha256='changed';let badRejected=false;try{await PortalProject.prepare(bad);}catch(_){badRejected=JSON.stringify(before)===JSON.stringify(Array.from(PortalLayers.layers.keys()));}
  const shared=await PortalShareCore.envelope(project),reopenedShare=await PortalShareCore.validate(shared);return {ref,saved:project.layers[0].meta.nativeSource,restored:restored.cfg.nativeSource,preview:restored.data.features.length,eligible:PortalDataWorkspace.ready(restored),dependencies:prepared.dependencies,failures,badRejected,shared:reopenedShare};
 });
 ok(JSON.stringify(result.ref)===JSON.stringify(result.saved)&&JSON.stringify(result.ref)===JSON.stringify(result.restored),'Project capture and real restoration preserve the native workspace, relative path, full record count, release and SHA256 exactly');
 ok(result.preview===1&&!result.eligible&&result.dependencies.some(d=>!d.available&&d.previewOnly)&&result.failures.every(Boolean),'A disconnected native dependency reopens its bounded map preview while browser workset and GIS analysis remain blocked');
 ok(result.badRejected,'A malformed native checksum fails before Project restoration can replace a layer');
 const content=JSON.stringify(result.shared);ok(!content.includes('saved-unavailable-workspace')&&!content.includes('saved-unavailable-job')&&!content.includes('Results/unchanged-output.parquet')&&result.shared.dependencies.some(d=>d.previewOnly),'Sharing removes real native provenance pointers while preserving an explicit bounded-preview dependency');
 fs.writeFileSync(qa.out+'/native-project-workflow.json',JSON.stringify({passed:true,checks:qa.checks.slice(start),dependencies:result.dependencies},null,2));
};
