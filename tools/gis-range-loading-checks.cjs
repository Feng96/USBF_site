/* Genuine PMTiles/Parquet worker loading plus official Census boundaries. */
const {createFixtures,installRoutes}=require('./usbf-display-fixtures.cjs');
module.exports=async qa=>{
 const p=qa.page,{ok}=qa,f=createFixtures(),route=await installRoutes(p,f);
 await p.route('https://maps2.dcgis.dc.gov/**',r=>r.continue());await p.route('https://tigerweb.geo.census.gov/**',r=>r.continue());await qa.open('?empty=1');
 const source=await p.evaluate(async center=>{portal.map.jumpTo({center,zoom:17,pitch:0,bearing:0});return(await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='usbf-live'),{restore:true,throwOnError:true})).id;},f.center);
 const row=id=>p.locator('[data-added-row="'+id+'"]');await row(source).locator('[data-purpose-action=data]').click();
 const widget=p.locator('#analysis-data-options');await widget.locator('[data-range-kind]').selectOption('county');
 await p.waitForFunction(()=>document.querySelector('#analysis-data-options [data-range-state] option[value="11"]'),null,{timeout:60000});await widget.locator('[data-range-state]').selectOption('11');
 await p.waitForFunction(()=>document.querySelector('#analysis-data-options [data-range-county] option[value="11001"]'),null,{timeout:60000});
 ok((await widget.locator('[data-range-county]').innerText()).includes('District of Columbia'),'County choices use actual Census state/county identifiers');
 await widget.locator('[data-load-source-area]').click();
 await p.waitForFunction(()=>Array.from(PortalLayers.layers.values()).some(l=>l.cfg.type==='geojson'&&l.data?.provenance?.range?.geoid==='11001'),null,{timeout:120000});
 const loaded=await p.evaluate(()=>Array.from(PortalLayers.layers.values()).find(l=>l.cfg.type==='geojson').id);
 const data=await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return {count:l.data.features.length,mask:l.data.provenance.range,coverage:l.data.provenance.loadingCoverage,release:!!l.data.provenance.release?.files?.length,geometry:l.data.features[0].geometry};},loaded);
 ok(data.count===1&&data.mask.kind==='county'&&data.mask.geoid==='11001'&&data.release,'County loading preserves original records, administrative boundary and exact file provenance');
 ok(JSON.stringify(data.geometry)===JSON.stringify(f.feature.geometry),'Administrative extraction never substitutes clipped tile geometry for the original courtyard');
 ok(data.coverage.completedCells>1&&data.coverage.completePlan,'Original-data loading covers all planned county cells, including empty cells');
 // Typed boundary coordinates use the working CRS, and source-layer extent is a separate option.
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalCRS.set('EPSG:3857');PortalAnalysisLayers.open(PortalLayers.active);},source);
 await widget.locator('[data-range-kind]').selectOption('boundary');const text=await p.evaluate(bounds=>{const [w,s,e,n]=bounds;return [[w,s],[e,s],[e,n],[w,n]].map(x=>PortalCRS.fromWGS84(x).join(',')).join('\n');},f.bounds);
 await widget.locator('[data-range-text]').fill(text);await widget.locator('[data-load-source-area]').click();
 await p.waitForFunction(()=>Array.from(PortalLayers.layers.values()).some(l=>l.cfg.type==='geojson'&&l.data?.provenance?.range?.kind==='boundary'),null,{timeout:90000});
 ok(await p.evaluate(()=>Array.from(PortalLayers.layers.values()).some(l=>l.data?.provenance?.range?.crs==='EPSG:3857'&&l.data.features.length===1)),'Boundary coordinate input is transformed from the active projected working CRS');
 const before=await p.evaluate(()=>PortalLayers.layers.size);
 await p.evaluate(id=>{PortalLayers.selectLayer(id);PortalCRS.set('EPSG:4326');PortalAnalysisLayers.open(PortalLayers.active);},source);
 await widget.locator('[data-range-kind]').selectOption('extent');await widget.locator('[data-range-layer]').selectOption(loaded);await widget.locator('[data-load-source-area]').click();
 await p.waitForFunction(n=>PortalLayers.layers.size===n+1&&!PortalAnalysisLayers.isLoading(Array.from(PortalLayers.layers.values()).find(l=>l.cfg.id==='usbf-live')),before,{timeout:90000});
 ok(await p.evaluate(()=>PortalLayers.active.data.provenance.range.kind==='extent'&&PortalLayers.active.data.features.length===1),'A loaded layer extent can drive an independent original-data load');
 // Clear new bulk selection down to zero: last inspected feature must not reappear.
 await p.evaluate(()=>PortalGISSelection.set(PortalLayers.active,PortalLayers.active.data.features,'replace'));await row(await p.evaluate(()=>PortalLayers.active.id)).locator('[data-purpose-action=table]').click();await p.locator('#selected-only').check();
 await p.locator('[data-table-record="0"]').click({modifiers:['Control']});await p.waitForFunction(()=>PortalGISSelection.count()===0&&PortalInventory.filtered.length===0);
 ok(true,'Deselecting the last bulk record leaves an empty selected-only table');
 const dc=await p.evaluate(async()=>{portal.map.jumpTo({center:[-77.071,38.912],zoom:17,pitch:0,bearing:0});return(await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='dc-government'),{restore:true,throwOnError:true})).id;});
 await p.waitForFunction(id=>{const l=PortalLayers.layers.get(id);return l.loaded&&!l.viewLoading&&!l.error;},dc,{timeout:120000});
 await row(dc).locator('[data-purpose-action=data]').click();await widget.locator('[data-load-source-area]').click();
 await p.waitForFunction(()=>PortalLayers.active.cfg.type==='geojson'&&PortalLayers.active.data.provenance.sourceDriver==='arcgis',null,{timeout:120000});
 ok(await p.evaluate(()=>{const f=PortalLayers.active.data.features;return f.length>1&&new Set(f.map(f=>f.properties.OBJECTID)).size===f.length;}),'A non-PMTiles government range load keeps every distinct original ID');
 ok(!qa.errors.length,'Official administrative and projected range loading has no uncaught errors');
 require('fs').writeFileSync(qa.out+'/gis-range-loading.json',JSON.stringify({passed:true,checks:qa.checks,county:data.mask.geoid,cells:data.coverage,rawRanges:route.geoRequests.length},null,2));await route.dispose();
};
