/* Real shared-browser selection regression. Reuse qa.run; never launch Chrome here.
 * Synthetic acceptance data only: genuine PMTiles and unchanged GeoParquet bytes. */
'use strict';
const fs=require('fs'),path=require('path');
const {createFixtures,installRoutes}=require('./usbf-display-fixtures.cjs');
// GeoJSON sources may rewind rings while preserving every coordinate and edge.
function sameGeometry(a,b){
 const ring=coordinates=>{if(!coordinates?.length||JSON.stringify(coordinates[0])!==JSON.stringify(coordinates.at(-1)))throw Error('The outline must retain a closed ring.');const body=coordinates.slice(0,-1),variants=[];for(const order of [body,body.slice().reverse()])for(let i=0;i<order.length;i++)variants.push(JSON.stringify(order.slice(i).concat(order.slice(0,i))));return variants.sort()[0];};
 const polygon=coordinates=>[ring(coordinates[0]),...coordinates.slice(1).map(ring).sort()];
 const key=g=>JSON.stringify([g?.type,g?.type==='Polygon'?polygon(g.coordinates):g?.type==='MultiPolygon'?g.coordinates.map(polygon).map(JSON.stringify).sort():g?.coordinates]);
 return key(a)===key(b);
}
module.exports=async qa=>{
 const page=qa.page,start=qa.checks.length,fixtures=qa.usbfDisplayFixture||createFixtures(),route=await installRoutes(page,fixtures),expected=fixtures.feature.properties;
 const near=[expected.cx-.00001,expected.cy-.00001,expected.cx+.00001,expected.cy+.00001],emptyBounds=[expected.cx+.003,expected.cy-.00001,expected.cx+.0031,expected.cy+.00001],originalDisplay=fixtures.display;
 const selectionState=()=>page.evaluate(()=>{const l=PortalLayers.active,s=PortalLayers.selection,outline=portal.map.getSource('inventory-selection').serialize().data;return {id:s?.feature.properties.usbf_id||null,geometry:s?.feature.geometry||null,outline:outline.features,visible:!document.querySelector('#properties').hidden,rawIDs:l.data.features.map(f=>f.properties.usbf_id),rendered:portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).map(f=>f.properties.usbf_id),card:document.querySelector('#properties-content').innerText};});
 const waitTiles=()=>page.waitForFunction(id=>{const l=PortalLayers.active;return l?.renderTiled&&portal.map.isSourceLoaded(l.id)&&portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).some(f=>f.properties.usbf_id===id);},expected.usbf_id,{timeout:60000});
 const heldRead=async()=>{for(let i=0;i<600;i++){if(route.held.length)return;await page.waitForTimeout(50);}throw Error('The genuine worker did not reach the held original-data request.');};
 try{
  await qa.open('?empty=1');
  await page.evaluate(async center=>{await PortalAnalysis.cancel({clear:true});for(const id of Array.from(PortalLayers.layers.keys()))PortalLayers.remove(id);await PortalLayers.add({...PortalLayers.catalog.find(c=>c.id==='usbf-live')},{restore:true,throwOnError:true});portal.setViewMode(false,false);portal.map.jumpTo({center,zoom:17,pitch:0,bearing:0});},fixtures.center);await waitTiles();
  qa.ok(route.geoRequests.length===0&&route.manifestRequests.every(url=>!url.includes('/USBF_v1/')),'Selection regression starts from real displayed tiles with no original-data reads');
  route.holdRaw=true;
  await page.evaluate(bounds=>{const l=PortalLayers.active;window.__usbfSelectionRead=l.ensureData({scope:'view',bounds}).then(result=>({count:result.data.features.length,bounds:result.viewBounds}),error=>({error:error.message}));},emptyBounds);
  await heldRead();
  const preview=await page.evaluate(id=>{const l=PortalLayers.active,f=portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).find(f=>f.properties.usbf_id===id);if(!f)throw Error('The display building disappeared before selection.');PortalLayers.inspect(l,f);return f.geometry;},expected.usbf_id);
  qa.ok((await selectionState()).visible,'A user can select the visible building while an explicit original-area read is pending');
  route.releaseHeld();const result=await page.evaluate(()=>window.__usbfSelectionRead),after=await selectionState();
  qa.ok(!result.error&&result.count===0&&JSON.stringify(result.bounds)===JSON.stringify(emptyBounds)&&after.rawIDs.length===0&&route.geoRequests.length>0,'The genuine GeoParquet worker completes a different-area batch with no matching original');
  qa.ok(after.id===expected.usbf_id&&after.visible&&after.rendered.includes(expected.usbf_id)&&JSON.stringify(after.geometry)===JSON.stringify(preview)&&after.outline.length===1&&sameGeometry(after.outline[0].geometry,preview)&&after.card.includes('tile preview'),'An omitted raw-cache ID preserves the newer tile selection, card and outline while its building remains displayed');
  await qa.screenshot('usbf-selection-preserved.png');
  const snapshot=await page.evaluate(async()=>PortalAnalysisData.capture(PortalLayers.active,{scope:'selection',map:portal.map})),matched=await selectionState();
  qa.ok(snapshot.features.length===1&&JSON.stringify(snapshot.features[0].geometry)===JSON.stringify(fixtures.feature.geometry)&&JSON.stringify(matched.geometry)===JSON.stringify(fixtures.feature.geometry)&&sameGeometry(matched.outline[0]?.geometry,fixtures.feature.geometry)&&matched.visible&&matched.card.includes('Footprint area'),'A later matching batch upgrades the selected preview to the complete original courtyard and inspector');
  await page.evaluate(bounds=>PortalLayers.active.ensureData({scope:'view',bounds}).then(result=>result.data.features.length),emptyBounds);const cachedEmpty=await selectionState();
  qa.ok(cachedEmpty.id===expected.usbf_id&&cachedEmpty.visible&&JSON.stringify(cachedEmpty.geometry)===JSON.stringify(fixtures.feature.geometry)&&cachedEmpty.rawIDs.length===0,'A later empty raw batch also preserves an already selected complete building in tiled mode');
  // Exercise the unchanged non-tiled viewport path through the real coverage fallback.
  await page.evaluate(()=>{for(const id of Array.from(PortalLayers.layers.keys()))PortalLayers.remove(id);});fixtures.display=null;
  await page.evaluate(async()=>PortalLayers.add({...PortalLayers.catalog.find(c=>c.id==='usbf-live')},{restore:true,throwOnError:true}).then(l=>l.id));
  const fallback=await page.evaluate(async bounds=>{const l=PortalLayers.active,result=await l.ensureData({scope:'view',bounds});PortalLayers.inspect(l,result.data.features[0]);return {tiled:l.renderTiled,mode:l.displayMode,selected:PortalLayers.selection?.feature.properties.usbf_id};},near);
  qa.ok(!fallback.tiled&&fallback.mode==='original'&&fallback.selected===expected.usbf_id,'The genuine GeoJSON fallback displays and selects an explicitly loaded original building');
  await page.evaluate(bounds=>PortalLayers.active.ensureData({scope:'view',bounds}).then(result=>result.data.features.length),emptyBounds);const cleared=await selectionState();
  qa.ok(cleared.id===null&&!cleared.visible&&cleared.outline.length===0&&cleared.rawIDs.length===0,'A non-tiled GeoJSON viewport still clears a building removed from its displayed records');
  qa.ok(qa.errors.length===0,'The focused real tile and worker selection regression has no uncaught application errors');
  const report={passed:true,testOnlySyntheticData:true,checks:qa.checks.slice(start),expectedID:expected.usbf_id,emptyBounds,geoRequests:route.geoRequests,tileRequests:route.tileRequests,manifestRequests:route.manifestRequests};fs.writeFileSync(path.join(qa.out,'usbf-selection-workflow.json'),JSON.stringify(report,null,2));return report;
 }catch(error){await qa.screenshot('usbf-selection-failure.png').catch(()=>{});fs.writeFileSync(path.join(qa.out,'usbf-selection-failure.json'),JSON.stringify({error:error.stack,checks:qa.checks.slice(start),state:await qa.state().catch(()=>({})),selection:await selectionState().catch(()=>null),geoRequests:route.geoRequests},null,2));throw error;}
 finally{fixtures.display=originalDisplay;route.releaseHeld();await page.evaluate(()=>{delete window.__usbfSelectionRead;}).catch(()=>{});await route.dispose();}
};
