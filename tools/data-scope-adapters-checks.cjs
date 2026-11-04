/* Identical saved area and record rules for distinct real provider adapters. */
const fs=require('fs'),{createFixtures,installRoutes}=require('./usbf-display-fixtures.cjs');
module.exports=async qa=>{
 const p=qa.page,{ok}=qa,f=createFixtures(),route=await installRoutes(p,f);
 await p.route('https://tigerweb.geo.census.gov/**',r=>r.continue());await p.route('https://maps2.dcgis.dc.gov/**',r=>r.continue());await qa.open('?empty=1');
 const admin=await p.evaluate(async()=>{const states=await PortalGISRange.list('state'),counties=await PortalGISRange.list('county','11'),county=await PortalGISRange.administrative('county','11001');await PortalDataWorkspace.saveArea(county,'Official DC county');return {states:states.length,county:counties.find(c=>c.GEOID==='11001').NAME,geoid:PortalDataWorkspace.range().meta.geoid};});
 ok(admin.states>50&&admin.county==='District of Columbia'&&admin.geoid==='11001','State/county choice resolves and saves the official Census geometry and identifiers');
 const sources=await p.evaluate(async bounds=>{const raw=await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='usbf-live'),{restore:true,throwOnError:true}),dc=await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='dc-government'),{restore:true,throwOnError:true});const range=PortalGISRange.value(turf.bboxPolygon(bounds),'Shared adapter area',{kind:'box',crs:'EPSG:4326'});await PortalDataWorkspace.saveArea(range,'Shared adapter area');portal.map.jumpTo({center:[-73.985,40.748],zoom:16,pitch:0});return {raw:raw.id,dc:dc.id};},f.bounds);
 for(const key of ['raw','dc']){await p.evaluate(id=>PortalDataWorkspace.open({layer:PortalLayers.layers.get(id)}),sources[key]);await p.locator('[data-dw-load]').click();await p.waitForFunction(()=>!PortalDataWorkspace.loading,null,{timeout:120000});}
 const loaded=await p.evaluate(()=>PortalDataWorkspace.worksets().filter(l=>l.data.provenance?.workspaceWorkset?.area?.label==='Shared adapter area').map(l=>({id:l.id,n:l.data.features.length,metadata:l.data.provenance.workspaceWorkset,ids:l.data.features.map(f=>f.properties.OBJECTID)})));
 ok(loaded.length===2&&loaded.some(l=>l.metadata.sourceFormat==='GeoParquet')&&loaded.some(l=>l.metadata.sourceFormat.includes('API')),'USBF GeoParquet and government GeoJSON API both create fixed worksets through one preparation flow');
 ok(JSON.stringify(loaded[0].metadata.area.geometry)===JSON.stringify(loaded[1].metadata.area.geometry)&&loaded.every(l=>l.metadata.recordRule==='Full original geometries intersecting the saved request boundary'),'Both adapters retain exactly the same saved boundary and full-record intersection rule');
 const gov=loaded.find(l=>l.metadata.sourceFormat.includes('API'));ok(gov.n>1&&new Set(gov.ids).size===gov.n,'Government workset retains distinct original IDs and complete matching records');
 ok(await p.evaluate(()=>portal.map.getCenter().lng< -73&&portal.map.getCenter().lng> -78),'Workset creation may frame the saved request independently of its previous map view');
 // Abort the shared loading flow after a real original-data request is pending.
 await p.evaluate(id=>{const l=PortalLayers.layers.get(id);l.clearCache();PortalDataWorkspace.open({layer:l});},sources.raw);route.holdRaw=true;const before=await p.evaluate(()=>PortalDataWorkspace.worksets().length);await p.locator('[data-dw-load]').click();
 for(let i=0;i<400&&!route.held.length;i++)await p.waitForTimeout(25);ok(route.held.length>0,'Explicit workset loading exposes a cancellable original-data request');await p.locator('[data-dw-cancel]').click();await p.waitForFunction(()=>!PortalDataWorkspace.loading);route.releaseHeld();await p.waitForTimeout(200);
 ok(await p.evaluate(before=>PortalDataWorkspace.worksets().length===before,before),'Cancellation cannot create a late fixed workset or claim complete data');
 ok(!qa.errors.length,'Shared range adapters and cancellation have no uncaught errors');
 fs.writeFileSync(qa.out+'/data-scope-adapters.json',JSON.stringify({passed:true,checks:qa.checks,admin,loaded},null,2));await route.dispose();
};
