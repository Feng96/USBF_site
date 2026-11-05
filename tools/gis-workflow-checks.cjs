/* Shared browser GIS acceptance; real vector geometry and working CRS conversion. */
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;
 await qa.open('?empty=1');
 const dataset=await p.evaluate(async()=>{
  const f=(id,x,h)=>({type:'Feature',id:'duplicate',properties:{usbf_id:id,height_m:h,flag:false,missing:null,long_id:'900719925474099312'+id},geometry:{type:'Polygon',coordinates:[[[x,38.912],[x+.00018,38.912],[x+.00018,38.91218],[x,38.91218],[x,38.912]]]}});
  const features=[f('a',-77.072,10),f('b',-77.0716,20),f('c',-77.0712,30)];const l=await PortalLayers.addGeoJSON('GIS source buildings',{type:'FeatureCollection',features},{dataRole:'buildings',heightField:'height_m'});portal.map.jumpTo({center:[-77.0716,38.9121],zoom:18,pitch:0,bearing:0});return l.id;
 });
 await p.waitForFunction(id=>portal.map.isSourceLoaded(id),dataset);
 ok(await p.locator('.gis-group-caption').evaluateAll(elements=>['DATA','MAP','INTERFACE','SELECTION','PROCESSING','LAYERS','PROJECT & OUTPUT'].every(name=>elements.some(el=>el.textContent.trim()===name))),'The toolbar separates data, map, interface, selection, processing, layers and output');
 await p.evaluate(id=>{const l=PortalLayers.layers.get(id);PortalGISSelection.set(l,[l.data.features[0],l.data.features[1]],'replace');},dataset);
 ok(await p.evaluate(()=>PortalGISSelection.count()===2),'Bulk selection keeps two distinct source records with duplicate feature IDs');
 await p.evaluate(()=>PortalGIS.action('selection-table'));
 await p.waitForFunction(()=>PortalInventory.filtered.length===2);
 ok(await p.locator('[data-table-record]').count()===2&&await p.locator('#selected-only').isChecked(),'The selected-record attribute table follows the bulk selection');
 await p.locator('#selected-only').uncheck();
 await p.locator('[data-table-record="0"]').click();await p.locator('[data-table-record="2"]').click({modifiers:['Control']});
 ok(await p.evaluate(()=>PortalGISSelection.count()===2&&PortalGISSelection.features().some(f=>f.properties.usbf_id==='c')),'Ctrl-click in the attribute table toggles original records without collapsing the batch');
 const selected=await p.evaluate(async()=>{const l=await PortalGIS.selectedLayer();return {id:l.id,count:l.data.features.length};});
 ok(selected.count===2&&await p.evaluate(()=>PortalAnalysisData.isBuildingLayer(PortalLayers.active)),'Add selected to new layer keeps full original building records and analysis eligibility');
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalGISSelection.clear();},dataset);
 // Use the actual map mouse handlers to select the first two buildings.
 const points=await p.evaluate(()=>{const a=portal.map.project([-77.0721,38.91225]),b=portal.map.project([-77.0713,38.91195]);return {a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},rect:portal.map.getCanvas().getBoundingClientRect().toJSON()};});
 await p.evaluate(()=>PortalGISSelection.start('box'));await p.mouse.move(points.rect.left+points.a.x,points.rect.top+points.a.y);await p.mouse.down();await p.mouse.move(points.rect.left+points.b.x,points.rect.top+points.b.y,{steps:5});await p.mouse.up();
 await p.waitForFunction(()=>!PortalGISSelection.busy&&PortalGISSelection.count()===2);
 ok(await p.evaluate(()=>PortalGISSelection.features().every(f=>f.properties.usbf_id!=='c')),'Dragging a map box selects complete intersecting buildings');
 await p.evaluate(()=>PortalGISSelection.cancel());
 await p.evaluate(()=>PortalGIS.open('extract-box'));
 await p.locator('[data-gis-range] [data-range-coordinates]').fill('-77.0721,38.9119,-77.0717,38.9123');
 await p.locator('[data-gis-output-name]').fill('Extracted by box');await p.locator('[data-gis-run]').click();
 await p.waitForFunction(()=>!PortalGIS.busy&&PortalLayers.active.cfg.name==='Extracted by box');
 ok(await p.evaluate(()=>PortalLayers.active.data.features.length===1&&PortalLayers.active.data.features[0].properties.height_m===10),'Extract by box creates an independent full-outline layer with original height values');
 await p.locator('[data-gis-close]').click();
 // Projected input boundary must be interpreted in the active working CRS.
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalCRS.set('EPSG:3857');PortalGIS.open('extract-box');},dataset);
 const projected=await p.evaluate(()=>{const a=PortalCRS.fromWGS84([-77.0717,38.9119]),b=PortalCRS.fromWGS84([-77.0713,38.9123]);return [...a,...b].join(',');});
 await p.locator('[data-gis-range] [data-range-coordinates]').fill(projected);await p.locator('[data-gis-output-name]').fill('Projected extract');await p.locator('[data-gis-run]').click();
 await p.waitForFunction(()=>!PortalGIS.busy&&PortalLayers.active.cfg.name==='Projected extract');
 ok(await p.evaluate(()=>PortalLayers.active.data.features.length===1&&PortalLayers.active.data.features[0].properties.usbf_id==='b'&&PortalLayers.active.data.provenance.range.crs==='EPSG:3857'),'Projected bbox extraction uses the working CRS and retains its boundary provenance');
 await p.locator('[data-gis-close]').click();
 await p.evaluate(()=>{PortalCRS.set('EPSG:4326');PortalGIS.open('merge');});
 await p.locator('[data-gis-inputs]').selectOption([dataset,selected.id]);await p.locator('[data-gis-output-name]').fill('Merged original records');await p.locator('[data-gis-run]').click();
 await p.waitForFunction(()=>!PortalGIS.busy&&PortalLayers.active.cfg.name==='Merged original records');
 ok(await p.evaluate(()=>PortalLayers.active.data.features.length===5&&PortalLayers.active.data.features.every(f=>f.properties.gis_source_layer)),'Merge appends both source layers, keeps duplicates and records their source names');
 await p.locator('[data-gis-close]').click();
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalGIS.action('attribute-select');},dataset);
 await p.locator('[data-query-field]').selectOption('height_m');await p.locator('[data-query-op]').selectOption('ge');await p.locator('[data-query-value]').fill('20');await p.locator('#gis-attribute-selection button[type=submit]').click();
 ok(await p.evaluate(()=>PortalGISSelection.count()===2&&PortalGISSelection.features().every(f=>f.properties.height_m>=20)),'Attribute selection operates on original values and updates the batch');
 await p.locator('[data-query-close]').click();
 const exported=await qa.download(()=>p.evaluate(()=>PortalGIS.action('export-selected-geojson')),'gis-selected.geojson'),exportedData=JSON.parse(require('fs').readFileSync(exported,'utf8'));
 ok(exportedData.features.length===2&&exportedData.provenance.tableView.tableFilters.selectedOnly,'Selected GeoJSON export records its actual bulk-selection scope');
 await p.evaluate(()=>PortalGIS.open('select-location'));
 await p.locator('[data-gis-range] [data-range-kind]').selectOption('box');await p.locator('[data-gis-range] [data-range-coordinates]').fill('-77.0713,38.9119,-77.0709,38.9123');await p.locator('[data-gis-run]').click();
 await p.waitForFunction(()=>!PortalGIS.busy&&PortalGISSelection.count()===1);
 ok(await p.evaluate(()=>PortalGISSelection.features()[0].properties.usbf_id==='c'),'Select by location updates original feature references without copying or conflating IDs');
 await p.locator('[data-gis-close]').click();

 const duplicated=await p.evaluate(async()=>{const l=await PortalLayers.addGeoJSON('Explicit reference geometry',{type:'FeatureCollection',features:[{type:'Feature',properties:{height_m:88},geometry:{type:'Point',coordinates:[-77,39]}}]},{allowHeight:false,dataRole:'features',color:'#a12b68'});await PortalGIS.action('duplicate-layer');const copy=PortalLayers.active;return copy.id!==l.id&&copy.data!==l.data&&copy.data.features[0]!==l.data.features[0]&&copy.heightField===null&&copy.cfg.allowHeight===false&&copy.color===l.color;});
 ok(duplicated,'Layer duplication keeps independent records, styling and explicit height restrictions');
 const saved=await p.evaluate(async()=>{await PortalAnalysis.cancel({clear:true});return(await PortalProject.collect('GIS work')).project;});
 await p.evaluate(async saved=>PortalProject.restore(await PortalProject.prepare(saved)),saved);
 ok(await p.evaluate(()=>Array.from(PortalLayers.layers.values()).some(l=>l.cfg.name==='Projected extract'&&l.data.provenance.range.crs==='EPSG:3857')),'Project restoration retains GIS outputs and the exact range CRS');
 await p.locator('#interface-language').selectOption('zh-CN');
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('.gis-group-caption')).some(el=>el.textContent==='选择'));
 await qa.screenshot('gis-workspace-desktop.png');await p.setViewportSize({width:390,height:844});
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Grouped GIS tools fit the phone viewport');
 await qa.screenshot('gis-workspace-phone.png');ok(!qa.errors.length,'GIS range, selection and processing workflows have no uncaught errors');
 require('fs').writeFileSync(qa.out+'/gis-workflow.json',JSON.stringify({passed:true,checks:qa.checks},null,2));
};
