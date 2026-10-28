/* Attach to the shared browser acceptance page; this helper never launches Chrome. */
const assert=require('assert'),fs=require('fs'),path=require('path');
async function runStudyAreaWorkflowChecks(page,out){
 const checks=[],created=[],ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
 const before=await page.evaluate(()=>{const c=portal.map.getCenter();return {layer:PortalLayers.active?.id,camera:{center:[c.lng,c.lat],zoom:portal.map.getZoom(),bearing:portal.map.getBearing(),pitch:portal.map.getPitch()}};});
 const features=[12,0,-999,null].map((height,i)=>({type:'Feature',id:'study-row-'+i,properties:{usbf_id:'study-row-'+i,height_m:height,height_missing:i===0?true:i===1?false:null,modified:i===0?null:i===1?false:true,source:i<2?'A':'B'},geometry:{type:'Polygon',coordinates:[[[-77.072+i*.0003,38.912],[-77.0718+i*.0003,38.912],[-77.0718+i*.0003,38.9122],[-77.072+i*.0003,38.9122],[-77.072+i*.0003,38.912]]]}}));
 try{
  await page.evaluate(async()=>{for(const id of ['analysis-workspace','drawing-dialog','study-area-dialog'])document.getElementById(id)?.close();PortalDraw.cancel();await PortalAnalysis.cancel({clear:true});});
  const source=await page.evaluate(async data=>(await PortalLayers.addGeoJSON('Study workflow buildings',data,{dataRole:'buildings',license:'Workflow footprint terms'})).id,{type:'FeatureCollection',features});created.push(source);
  const generic=await page.evaluate(async data=>(await PortalLayers.addGeoJSON('Study workflow ordinary polygons',data)).id,{type:'FeatureCollection',features:[{...features[0],id:'ordinary-row',properties:{height_m:25,zone:'not a building declaration'}}]});created.push(generic);
  await page.evaluate(id=>{PortalLayers.selectLayer(id);PortalDraw.open();},source);
  await page.locator('#draw-kind').selectOption('Polygon');await page.locator('#draw-name').fill('Study workflow boundary');
  ok(await page.locator('#draw-buildings').inputValue()===source,'Drawing a study area remembers the active original building dataset');
  ok(!await page.locator('#draw-buildings option').evaluateAll((nodes,id)=>nodes.some(n=>n.value===id),generic),'Ordinary polygons with height fields are excluded from the building dataset chooser');
  await page.locator('#drawing-form [type=submit]').click();
  await page.evaluate(()=>{for(const p of [[-77.0719,38.9119],[-77.07125,38.9119],[-77.07125,38.9123],[-77.0719,38.9123]])PortalDraw.click({lngLat:{lng:p[0],lat:p[1]}});});
  await page.locator('#draw-finish').click();await page.waitForFunction(()=>document.querySelector('#study-area-dialog')?.open);
  const boundary=await page.evaluate(()=>PortalLayers.active.id);created.push(boundary);
  ok(await page.locator('#study-buildings').inputValue()===source&&await page.locator('#study-area-name').textContent()==='Study workflow boundary','The finished area offers statistics and downloads for the original building source');
  await page.locator('#study-summarize').click();await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.snapshot?.provenance.studyArea?.name==='Study workflow boundary');
  ok(await page.evaluate(({source,boundary})=>PortalAnalysis.snapshot.provenance.layerId===source&&PortalAnalysis.snapshot.provenance.studyArea.layerId===boundary&&PortalAnalysis.overview.records===3,{source,boundary}),'Summarize buildings counts the matching original buildings rather than the one drawn boundary');
  ok(await page.evaluate(()=>PortalAnalysis.overview.height.valid===1&&PortalAnalysis.overview.height.mean===12&&PortalAnalysis.overview.lidarInputCoverage.missing===1),'Area summaries preserve positive inherited heights independently of missing elevation input');
  ok(await page.evaluate(()=>PortalAnalysis.snapshot.features[0].geometry.coordinates[0][0][0]===-77.072&&PortalAnalysis.snapshot.features[2].geometry.coordinates[0][1][0]>PortalAnalysis.snapshot.provenance.studyArea.extent[2]),'Buildings crossing either side retain their full outlines in the statistical input');
  ok(await page.locator('#analysis-scope').inputValue()==='study-area'&&await page.locator('#analysis-study-area').inputValue()===boundary&&(await page.locator('#analysis-snapshot-scope').textContent()).includes('Study workflow boundary'),'The selected study-area scope and actual boundary stay visible in the analysis panel');
  await page.locator('#analysis-tab-chart').click();await page.locator('#analysis-chart-kind').selectOption('scatter');await page.locator('#analysis-chart-field').selectOption('$area_m2');await page.locator('#analysis-chart-y').selectOption('height_m');await page.locator('#analysis-run-chart').click();
  await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.chart?.kind==='scatter');
  ok(await page.evaluate(()=>PortalAnalysis.chart.valid===1&&PortalAnalysis.chart.provenance.studyArea.name==='Study workflow boundary'),'Charts use the same study-area snapshot and exclude unavailable heights');
  await page.evaluate(({source,boundary})=>{document.querySelector('#analysis-workspace').close();PortalDraw.openStudyArea(boundary,{buildingLayerId:source});},{source,boundary});
  fs.mkdirSync(out,{recursive:true});const pending=page.waitForEvent('download');await page.locator('#study-download').click();const download=await pending,target=path.join(out,'study-area-buildings.geojson');await download.saveAs(target);await page.waitForFunction(()=>!PortalAnalysis.busy);
  const data=JSON.parse(fs.readFileSync(target,'utf8'));
  ok(data.features.length===3&&JSON.stringify(data.features)===JSON.stringify(features.slice(0,3)),'The direct building download retains all original record fields and whole geometry without sentinel conversion');
  ok(data.provenance.studyArea.features.length===1&&data.provenance.studyArea.selection==='intersects'&&data.provenance.licenses.includes('Workflow footprint terms'),'The downloaded GeoJSON includes the actual boundary, selection rule and original source terms');
  await page.evaluate(id=>{const l=PortalLayers.layers.get(id),data=JSON.parse(JSON.stringify(l.data));data.features[0].geometry.coordinates[0][0][0]-=.00005;l.setData(data);PortalLayers.refresh();},boundary);
  ok(await page.locator('#analysis-changed').isVisible()&&await page.evaluate(()=>PortalAnalysis.snapshot.provenance.studyArea.features[0].geometry.coordinates[0][0][0]===-77.0719),'Changing the drawn boundary marks completed statistics stale while preserving their frozen boundary');
  await page.evaluate(async()=>{document.querySelector('#analysis-workspace').close();await PortalAnalysis.cancel({clear:true});});
  const annotation=await page.evaluate(async()=>{const data={type:'FeatureCollection',features:[0,1].map((i)=>({type:'Feature',properties:{label:'Study label '+i},geometry:{type:'Point',coordinates:[-77.072+i*.0002,38.912]}})),provenance:{role:'user-drawing',crs:'EPSG:4326',scope:'complete-drawing'}};return (await PortalLayers.addGeoJSON('Study workflow saved labels',data,{provenance:data.provenance})).id;});created.push(annotation);
  const ids=await page.evaluate(id=>{const l=PortalLayers.layers.get(id),first=PortalDraw.restoreLayerLabels(l),second=PortalDraw.restoreLayerLabels(l);return {first,second};},annotation);
  ok(ids.first.length===2&&JSON.stringify(ids.first)===JSON.stringify(ids.second),'Project-restored drawing labels are rebuilt once, including multiple labelled points');
  await page.evaluate(id=>PortalLayers.setStyle(id,{visible:false,opacity:.4}),annotation);
  ok(await page.evaluate(ids=>ids.every(id=>portal.map.getLayoutProperty(id,'visibility')==='none'&&portal.map.getPaintProperty(id,'icon-opacity')===.4),ids.first),'Restored drawing labels follow their layer visibility and opacity');
  await page.evaluate(id=>PortalLayers.remove(id),annotation);
  ok(await page.evaluate(ids=>ids.every(id=>!portal.map.getLayer(id)&&!portal.map.getSource(id)&&!portal.map.hasImage(id)),ids.first),'Removing a restored drawing releases its label layers, sources and images');
  return {passed:true,checks};
 }finally{
  await page.evaluate(async({ids,before})=>{for(const id of ['analysis-workspace','drawing-dialog','study-area-dialog'])document.getElementById(id)?.close();PortalDraw.cancel();await PortalAnalysis.cancel({clear:true});for(const id of ids)if(PortalLayers.layers.has(id))PortalLayers.remove(id);if(before.layer&&PortalLayers.layers.has(before.layer))PortalLayers.selectLayer(before.layer);portal.map.jumpTo(before.camera);},{ids:created,before});
 }
}
module.exports={runStudyAreaWorkflowChecks};
