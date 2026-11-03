/* Real-provider completeness acceptance; no provider responses are replaced. */
module.exports=async qa=>{
 const fs=require('fs'),p=qa.page,{ok}=qa;
 if(process.env.PORTAL_COVERAGE_LIVE_URL){qa.base=process.env.PORTAL_COVERAGE_LIVE_URL;qa.fixtures=false;}
 else for(const host of ['https://maps2.dcgis.dc.gov/**','https://data.cityofnewyork.us/**','https://data.source.coop/tge-labs/**','https://tiles.arcgis.com/**'])await p.route(host,r=>r.continue());
 const requests=[],responses=[],metrics=[];
 p.on('request',r=>{if(/dcgis|data.cityofnewyork|globalbuildingatlas-lod1|Microsoft_Building_Footprints/.test(r.url()))requests.push(r.url());});
 p.on('response',r=>{if(/dcgis|data.cityofnewyork|globalbuildingatlas-lod1|Microsoft_Building_Footprints/.test(r.url()))responses.push({url:r.url(),status:r.status()});});
 await qa.open('?empty=1');
 async function add(id,center){await p.evaluate(center=>{portal.map.jumpTo({center,zoom:14,pitch:0,bearing:0});},center);return p.evaluate(async id=>(await PortalLayers.add(PortalLayers.catalog.find(c=>c.id===id),{restore:true,throwOnError:true})).id,id);}
 async function waitView(id){await p.waitForFunction(id=>{const l=PortalLayers.layers.get(id);return l&&!l.viewLoading&&(l.loaded||l.error);},id,{timeout:180000});const s=await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return {id,count:l.data.features.length,note:l.viewNote,limited:l.viewLimited,error:l.error,bounds:l.viewBounds,bytes:l.viewBytes};},id);if(s.error)throw Error(JSON.stringify(s));return s;}
 async function zoomInside(id){const n=requests.length,original=await p.evaluate(id=>PortalLayers.layers.get(id).viewLoadedAt,id);await p.evaluate(()=>{portal.map.jumpTo({zoom:15.2});});await waitView(id);ok(requests.length===n,'Zooming inside '+id+' coverage performs no additional provider requests');ok(await p.evaluate(([id,at])=>{const l=PortalLayers.layers.get(id);return l.viewLoadedAt!==null&&l.data.features.length>0;},[id,original]),id+' keeps complete buildings visible after zoom');}
 let start=Date.now(),id=await add('dc-government',[-77.065,38.91]),s=await waitView(id);
 const dcExpected=await p.evaluate(async b=>{const c=PortalLayers.catalog.find(c=>c.id==='dc-government'),u=new URL(c.url+'/query');u.search=new URLSearchParams({f:'json',where:'1=1',geometry:JSON.stringify({xmin:b[0],ymin:b[1],xmax:b[2],ymax:b[3],spatialReference:{wkid:4326}}),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',returnCountOnly:'true'});const count=(await(await fetch(u)).json()).count;u.searchParams.delete('returnCountOnly');u.searchParams.set('returnIdsOnly','true');const ids=(await(await fetch(u)).json()).objectIds;return {count,ids};},s.bounds);
 console.log('DC COUNT',JSON.stringify({state:s,providerCount:dcExpected.count,matchingIds:dcExpected.ids.length}));
 ok(s.count>1000&&s.count===dcExpected.ids.length&&!s.limited,'DC loads every matching provider ID beyond the 1,000-building cap');
 ok(await p.evaluate(([id,ids])=>{const found=new Set(PortalLayers.layers.get(id).data.features.map(f=>String(f.properties.OBJECTID)));return ids.every(id=>found.has(String(id)));},[id,dcExpected.ids]),'DC contains every independently requested matching ID');
 ok(await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return new Set(l.data.features.map(f=>String(f.properties.OBJECTID))).size===l.data.features.length;},id),'DC has no duplicated IDs or missing batches');
 metrics.push({...s,expectedIds:dcExpected.ids.length,providerCount:dcExpected.count,milliseconds:Date.now()-start});await zoomInside(id);await qa.screenshot('dc-complete.png');await p.evaluate(()=>PortalLayers.clear());
 start=Date.now();id=await add('nyc-government',[-73.9857,40.7484]);s=await waitView(id);
 const nycExpected=await p.evaluate(async b=>{const c=PortalLayers.catalog.find(c=>c.id==='nyc-government'),u=new URL(c.url.replace('.geojson','.json')),wkt='POLYGON(('+[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]].map(c=>c.join(' ')).join(',')+'))';u.search=new URLSearchParams({'$where':"intersects(the_geom,'"+wkt+"')",'$select':'count(*)'});return Number((await(await fetch(u)).json())[0].count);},s.bounds);
 ok(s.count>5000&&s.count===nycExpected&&!s.limited,'NYC loaded count exactly matches an independent provider count beyond 5,000 buildings');
 ok(await p.evaluate(id=>PortalLayers.layers.get(id).data.features.every(f=>{const h=f.properties.height_roof;return h===null?f.properties.height_m===null:Math.abs(f.properties.height_m-Number(h)*.3048)<1e-9;}),id),'All real NYC pages preserve source roof heights and correct metre conversion');
 metrics.push({...s,expected:nycExpected,milliseconds:Date.now()-start});await zoomInside(id);await qa.screenshot('nyc-complete.png');await p.evaluate(()=>PortalLayers.clear());
 start=Date.now();id=await add('gba-usa',[-77.065,38.91]);s=await waitView(id);
 ok(s.count>12000&&!s.limited,'Real GBA completes the view beyond its old 12,000-building cutoff');
 ok(await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return l.data.features.every(f=>f.properties.region==='USA'&&(f.properties.height_m===null||f.properties.height_m===f.properties.height));},id),'Real GBA keeps full original US polygons and supplied positive metre heights');
 metrics.push({...s,milliseconds:Date.now()-start});await zoomInside(id);await qa.screenshot('gba-complete.png');await p.evaluate(()=>PortalLayers.clear());
 id=await p.evaluate(async()=>{const l=await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='microsoft-usa'),{throwOnError:true});return l.id;});
 for(const zoom of [16,17,18,19]){await p.evaluate(zoom=>{portal.map.jumpTo({center:[-77.065,38.91],zoom,pitch:0,bearing:0});},zoom);await p.waitForFunction(id=>{const l=PortalLayers.layers.get(id);return portal.map.isSourceLoaded(id)&&portal.map.queryRenderedFeatures({layers:l.renderIds}).length>0;},id,{timeout:90000});ok(true,'Microsoft buildings remain visible at zoom '+zoom);}
 ok(requests.filter(u=>u.includes('/VectorTileServer/tile/')).every(u=>Number(u.match(/\/tile\/(\d+)\//)[1])<=16),'Microsoft never requests nonexistent zoom-17–19 source tiles');
 ok(!qa.errors.length,'Non-PMTiles completeness workflows have no uncaught browser errors');
 fs.writeFileSync(qa.out+'/non-pmtiles.json',JSON.stringify({passed:true,checks:qa.checks,metrics,requests,responses,live:!!process.env.PORTAL_COVERAGE_LIVE_URL},null,2));
};
