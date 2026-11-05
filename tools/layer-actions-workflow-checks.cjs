/* The real sidebar and ribbon consume one action registry without changing scope. */
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;await qa.open('?empty=1');
 const ids=await p.evaluate(async()=>{
  const data={type:'FeatureCollection',features:[{type:'Feature',properties:{original_id:'9007199254740993123',height_m:12},geometry:{type:'Polygon',coordinates:[[[-77.072,38.912],[-77.0718,38.912],[-77.0718,38.9122],[-77.072,38.9122],[-77.072,38.912]]]}}]},add=(name,meta={},provenance)=>PortalLayers.addGeoJSON(name,{...JSON.parse(JSON.stringify(data)),...(provenance?{provenance}: {})},meta,{restore:true});
  const first=await add('Imported Shapefile',{sourceFormat:'shapefile'}),second=await add('Imported GeoParquet',{sourceFormat:'geoparquet'}),preview=await add('Shared native display',{}, {geometryQuality:'bounded-native-preview',spatialEligible:false}),native=await add('Unpaired native result',{nativeSource:{workspaceId:'qa-not-connected',jobId:'qa-native',path:'Results/qa.parquet',recordCount:90000}}),raster=await PortalLayers.add({name:'Reference image',type:'raster',url:'https://basemap.nationalmap.gov/fixture/{z}/{x}/{y}.png',bounds:[[-77.1,38.9],[-77,39]]},{restore:true});
  PortalLayers.selectLayer(second.id);return {first:first.id,second:second.id,preview:preview.id,native:native.id,raster:raster.id};
 });
 const row=id=>p.locator('[data-added-row="'+id+'"]');
 const operations=await p.evaluate(ids=>Object.fromEntries(Object.entries(ids).map(([name,id])=>[name,Array.from(document.querySelectorAll('[data-added-row="'+id+'"] .added-actions [data-layer-action]')).map(b=>b.dataset.layerAction)])),ids);
 ok(Object.values(operations).every(ids=>JSON.stringify(ids)===JSON.stringify(operations.first)),'All layer kinds expose the same settings operations');
 ok(await p.evaluate(id=>{const buttons=Array.from(document.querySelectorAll('[data-layer-actions-menu] [data-layer-action]'));return JSON.stringify(buttons.map(b=>b.dataset.layerAction))===JSON.stringify(PortalLayerActions.ids)&&buttons.every(b=>b.dataset.layerId===id);},ids.second),'The ribbon renders the common registry with explicit active-layer targets');
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.native);
 ok(await p.locator('[data-layer-actions-menu] [data-layer-action=processing]').isDisabled()&&await p.locator('[data-layer-actions-menu] [data-layer-action=processing]').getAttribute('title')===await row(ids.native).locator('.added-actions [data-layer-action=processing]').getAttribute('title'),'Sidebar and ribbon share the same native capability decision and explanation');
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.second);
 await row(ids.first).locator('[data-purpose-action=table]').click();await p.waitForFunction(id=>PortalLayers.active.id===id&&!document.querySelector('#attribute-table').hidden,ids.first);
 ok(await p.locator('#attribute-rows').textContent().then(s=>s.includes('9007199254740993123')),'A table shortcut targets its row and preserves original string IDs');
 await p.evaluate(()=>PortalInventory.toggleTable());
 for(const kind of ['preview','raster','native']){
  await row(ids[kind]).locator('.layer-details').evaluate(d=>d.open=true);
  const button=row(ids[kind]).locator('[data-layer-action=processing]');ok(await button.isDisabled()&&!!await button.getAttribute('title'),kind+' processing is disabled with an explanation');
 }
 ok(await row(ids.native).locator('[data-layer-action=table]').count()===2&&await row(ids.native).locator('[data-purpose-action=native-table],[data-purpose-action=native-process]').count()===0,'Native results use the common table shortcut and menu without native-only commands');
 await p.evaluate(id=>PortalLayerActions.run('processing',id),ids.second);await p.waitForFunction(()=>document.querySelector('#gis-processing-dialog')?.open);
 ok(await p.locator('[data-gis-inputs]').inputValue()===ids.second,'The common processing action uses its explicit layer');await p.locator('[data-gis-close]').click();
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.second);await row(ids.first).locator('.layer-details').evaluate(d=>d.open=true);await row(ids.first).locator('[data-layer-action=rename]').click();
 ok(await row(ids.first).locator('[data-added-name]').evaluate(el=>el===document.activeElement)&&await p.evaluate(id=>PortalLayers.active.id!==id,ids.first),'Rename edits the clicked row without changing another layer');
 await p.evaluate(id=>PortalLayerActions.run('duplicate',id),ids.first);ok(await p.evaluate(()=>PortalLayers.active.cfg.name==='Imported Shapefile · copy'&&PortalLayers.active.data.features[0].properties.original_id==='9007199254740993123'),'Duplication retains independent original records through the shared action');
 await p.locator('#interface-language').selectOption('zh-CN');await row(ids.preview).locator('.layer-details').evaluate(d=>d.open=true);
 ok(!(await row(ids.preview).locator('[data-layer-action=processing]').getAttribute('title')).includes('display records'),'Disabled action explanations translate with the interface');
 await p.evaluate(()=>PortalLayers.refresh());await p.locator('#interface-language').selectOption('en');await row(ids.preview).locator('.layer-details').evaluate(d=>d.open=true);
 ok(await row(ids.preview).locator('[data-layer-action=processing]').innerText()==='Geoprocessing'&&(await row(ids.preview).locator('[data-layer-action=processing]').getAttribute('title')).includes('display records'),'Menus rendered in Chinese return to English with their original labels and explanations');
 await p.setViewportSize({width:390,height:844});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The common menu fits a phone viewport');await qa.screenshot('layer-actions-phone.png');
 ok(!qa.errors.length,'Shared layer actions produce no uncaught browser errors');
 require('fs').writeFileSync(qa.out+'/layer-actions.json',JSON.stringify({passed:true,checks:qa.checks},null,2));
};
