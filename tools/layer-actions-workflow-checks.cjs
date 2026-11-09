/* Role-specific sidebar and ribbon menus retain shared guards and explicit scope. */
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;await qa.open('?empty=1');
 const ids=await p.evaluate(async()=>{
  const data={type:'FeatureCollection',features:[{type:'Feature',properties:{original_id:'9007199254740993123',height_m:12},geometry:{type:'Polygon',coordinates:[[[-77.072,38.912],[-77.0718,38.912],[-77.0718,38.9122],[-77.072,38.9122],[-77.072,38.912]]]}}]},add=(name,meta={},provenance)=>PortalLayers.addGeoJSON(name,{...JSON.parse(JSON.stringify(data)),...(provenance?{provenance}: {})},meta,{restore:true});
  const first=await add('Imported Shapefile',{sourceFormat:'shapefile'}),second=await add('Imported GeoParquet',{sourceFormat:'geoparquet'}),preview=await add('Shared native display',{}, {geometryQuality:'bounded-native-preview',spatialEligible:false}),native=await add('Unpaired native result',{nativeSource:{workspaceId:'qa-not-connected',jobId:'qa-native',path:'Results/qa.parquet',recordCount:90000}}),raster=await PortalLayers.add({name:'Reference image',type:'raster',url:'https://basemap.nationalmap.gov/fixture/{z}/{x}/{y}.png',bounds:[[-77.1,38.9],[-77,39]]},{restore:true});
  PortalLayers.selectLayer(second.id);return {first:first.id,second:second.id,preview:preview.id,native:native.id,raster:raster.id};
 });
 const row=id=>p.locator('[data-added-row="'+id+'"]');
 const operations=await p.evaluate(ids=>Object.fromEntries(Object.entries(ids).map(([name,id])=>[name,Array.from(document.querySelectorAll('[data-added-row="'+id+'"] .added-actions [data-layer-action]')).map(b=>b.dataset.layerAction)])),ids);
 ok(JSON.stringify(operations.first)===JSON.stringify(operations.second)&&['table','processing','statistics','export'].every(id=>operations.first.includes(id)),'Imported original formats expose the same analytical operations');
 ok(['preview','raster'].every(kind=>['statistics','chart','processing','quality','zones','export'].every(id=>!operations[kind].includes(id)))&&operations.native.includes('connect-engine')&&operations.native.includes('dependencies'),'Display menus omit analytical commands while offline native results offer repair actions');
 ok(await p.evaluate(id=>{const buttons=Array.from(document.querySelectorAll('[data-layer-actions-menu] [data-layer-action]'));const profile=PortalLayerActions.profile(id),expected=[...profile.data,...profile.map,...profile.management];return JSON.stringify(buttons.map(b=>b.dataset.layerAction))===JSON.stringify(expected)&&buttons.every(b=>b.dataset.layerId===id);},ids.second),'The ribbon renders the active role profile with explicit layer targets');
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.native);
 ok(await p.locator('[data-layer-actions-menu] [data-layer-action=processing]').count()===0&&await row(ids.native).locator('.added-actions [data-layer-action=processing]').count()===0&&await p.locator('[data-layer-actions-menu] [data-layer-action=connect-engine]').count()===1,'Sidebar and ribbon offer connection repair instead of inaccessible native analytical commands');
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.second);
 await row(ids.first).locator('[data-purpose-action=table]').click();await p.waitForFunction(id=>PortalLayers.active.id===id&&!document.querySelector('#attribute-table').hidden,ids.first);
 ok(await p.locator('#attribute-rows').textContent().then(s=>s.includes('9007199254740993123')),'A table shortcut targets its row and preserves original string IDs');
 await p.evaluate(()=>PortalInventory.toggleTable());
 for(const kind of ['preview','raster','native']){
  await row(ids[kind]).locator('.layer-details').evaluate(d=>d.open=true);
  const button=row(ids[kind]).locator('[data-layer-action=processing]');ok(await button.count()===0,kind+' menus omit inapplicable or unavailable processing commands');
 }
 ok(await row(ids.native).locator('[data-layer-action=table]').count()===0&&await row(ids.native).locator('.layer-purpose-actions [data-layer-action=connect-engine]').count()===1&&await row(ids.native).locator('[data-purpose-action=native-table],[data-purpose-action=native-process]').count()===0,'Offline native results preserve their role and guide connection before opening the full table');
 await p.evaluate(id=>PortalLayerActions.run('processing',id),ids.second);await p.waitForFunction(()=>document.querySelector('#gis-processing-dialog')?.open);
 ok(await p.locator('[data-gis-inputs]').inputValue()===ids.second,'The common processing action uses its explicit layer');await p.locator('[data-gis-close]').click();
 await p.evaluate(id=>PortalLayers.selectLayer(id),ids.second);await row(ids.first).locator('.layer-details').evaluate(d=>d.open=true);await row(ids.first).locator('[data-layer-action=rename]').click();
 ok(await row(ids.first).locator('[data-added-name]').evaluate(el=>el===document.activeElement)&&await p.evaluate(id=>PortalLayers.active.id!==id,ids.first),'Rename edits the clicked row without changing another layer');
 await p.evaluate(id=>PortalLayerActions.run('duplicate',id),ids.first);ok(await p.evaluate(()=>PortalLayers.active.cfg.name==='Imported Shapefile · copy'&&PortalLayers.active.data.features[0].properties.original_id==='9007199254740993123'),'Duplication retains independent original records through the shared action');
 await p.locator('#interface-language').selectOption('zh-CN');await row(ids.preview).locator('.layer-details').evaluate(d=>d.open=true);
 ok(await row(ids.preview).locator('.layer-purpose-actions [data-layer-action=table]').innerText()===await p.evaluate(()=>PortalI18n.t('Preview attributes')),'Display table entry translates as a preview rather than a complete attribute table');
 await p.evaluate(()=>PortalLayers.refresh());await p.locator('#interface-language').selectOption('en');await row(ids.preview).locator('.layer-details').evaluate(d=>d.open=true);
 ok(await row(ids.preview).locator('.layer-purpose-actions [data-layer-action=table]').innerText()==='Preview attributes'&&await row(ids.preview).locator('[data-layer-action=processing]').count()===0,'Role-specific menus return to English while preserving the display capability boundary');
 await p.setViewportSize({width:390,height:844});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The common menu fits a phone viewport');await qa.screenshot('layer-actions-phone.png');
 ok(!qa.errors.length,'Shared layer actions produce no uncaught browser errors');
 require('fs').writeFileSync(qa.out+'/layer-actions.json',JSON.stringify({passed:true,checks:qa.checks},null,2));
};
