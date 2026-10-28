/* Shared-Chrome acceptance for ordinary imported attributes; never launches a browser. */
const fs=require('fs'),path=require('path'),assert=require('assert');
async function runInventoryTableWorkflowChecks(page,out){
 const checks=[],created=[],ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);},viewport=page.viewportSize();
 const before=await page.evaluate(()=>{const c=portal.map.getCenter();return {layer:PortalLayers.active?.id,tableHidden:document.querySelector('#attribute-table').hidden,camera:{center:[c.lng,c.lat],zoom:portal.map.getZoom(),bearing:portal.map.getBearing(),pitch:portal.map.getPitch()}};});
 const features=Array.from({length:65},(_,i)=>({type:'Feature',id:'duplicate-original-id',properties:{station_code:'S-'+String(i).padStart(2,'0'),station_name:i===0?'Station <img src=x onerror="window.__inventoryUnsafe=true">':'Station '+i,reading:i===0?0:i===1?-3:i===64?null:i,active:i===64?null:i%2!==0,empty_text:'',missing_value:null,long_identifier:i===0?'9007199254740993123':i===1?'9007199254740993122':'9007199254740994'+String(i).padStart(3,'0'),notes:'hidden-note-'+i,details:{observed:false}},geometry:{type:'Point',coordinates:i<2?[-77.072,38.912]:[-77.072+(i%8)*.000025,38.912+Math.floor(i/8)*.000025]}}));
 try{
  await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
  const ordinary=await page.evaluate(async data=>(await PortalLayers.addGeoJSON('Inventory workflow observations',data)).id,{type:'FeatureCollection',features});created.push(ordinary);
  await page.evaluate(()=>{if(document.querySelector('#attribute-table').hidden)PortalInventory.toggleTable();else PortalInventory.refresh();});
  await page.waitForFunction(()=>PortalInventory.rows.length===65&&document.querySelectorAll('[data-table-record]').length===50);
  const labels=await page.locator('#attribute-head th').allTextContents();
  ok(labels.some(s=>s.includes('station_code'))&&labels.some(s=>s.includes('reading'))&&!labels.some(s=>s.includes('Footprint source')),'An ordinary imported layer opens with its actual fields instead of building summary columns');
  ok(await page.locator('#attribute-head th').count()===7&&!await page.locator('[data-column-id="field:long_identifier"]').count(),'The initial table stays compact while additional attributes remain selectable');
  ok(await page.locator('#attribute-rows img').count()===0&&!await page.evaluate(()=>!!window.__inventoryUnsafe),'HTML-looking attribute values render as text without executing markup');
  ok(await page.locator('[data-source-row="1"] [data-column-id="field:reading"]').textContent()==='0'&&await page.locator('[data-source-row="1"] [data-column-id="field:active"]').textContent()==='false'&&await page.locator('[data-source-row="1"] [data-column-id="field:empty_text"]').textContent()==='""','Actual zero, false and empty text stay visible and distinct');
  await page.locator('#table-columns summary').click();await page.locator('#table-column-search').fill('long_identifier');await page.locator('[data-table-column="field:long_identifier"]').check();
  ok(await page.locator('[data-source-row="1"] [data-column-id="field:long_identifier"]').textContent()==='9007199254740993123','Choosing a hidden field displays the original long identifier without rounding');
  await page.locator('#table-columns summary').click();await page.locator('[data-table-sort-field="field:reading"]').click();
  ok(await page.evaluate(()=>PortalInventory.filtered[0].properties.reading===-3&&PortalInventory.filtered.at(-1).properties.reading===null),'Header sorting orders negative and zero readings numerically and puts missing values last');
  await page.locator('[data-table-sort-field="field:reading"]').click();
  ok(await page.evaluate(()=>PortalInventory.filtered[0].properties.reading===63&&PortalInventory.filtered.at(-1).properties.reading===null)&&await page.locator('[data-table-sort-field="field:reading"]').evaluate(e=>e.parentElement.getAttribute('aria-sort')==='descending'),'A second header click reverses the order with an accessible sort indicator');
  await page.locator('#table-sort').selectOption('field:long_identifier');
  ok(await page.evaluate(()=>PortalInventory.filtered[0].properties.station_code==='S-01'&&PortalInventory.filtered[1].properties.station_code==='S-00'),'The field sort handles long identifiers that differ below floating-point precision');
  await page.locator('[data-table-record="0"]').click();
  ok(await page.evaluate(id=>PortalLayers.selection.feature===PortalLayers.layers.get(id).data.features[1],ordinary),'A row with duplicate original IDs and identical map geometry selects its exact original source object');
  await page.locator('#selected-only').check();await page.waitForFunction(()=>PortalInventory.filtered.length===1);
  ok(await page.locator('[data-table-record]').count()===1&&await page.locator('[data-table-record]').getAttribute('aria-selected')==='true','Selected only shows precisely that one source record and marks its selected row');
  await page.locator('#selected-only').uncheck();await page.locator('#table-search').fill('hidden-note-52');
  ok(await page.locator('[data-table-record]').count()===1&&await page.evaluate(()=>PortalInventory.filtered[0].properties.station_code==='S-52'),'Table search includes fields that are not currently displayed');
  fs.mkdirSync(out,{recursive:true});const pending=page.waitForEvent('download');await page.locator('#attribute-table [data-export-table="csv"]').click();const download=await pending,target=path.join(out,'inventory-observations.csv');await download.saveAs(target);const csv=fs.readFileSync(target,'utf8');
  ok(csv.includes('"notes"')&&csv.includes('hidden-note-52')&&csv.includes('"__map_scope"')&&csv.includes('Original records visible in the current map view')&&csv.includes('Inventory workflow observations'),'The visible-table CSV exports original hidden attributes plus its actual source and map-view scope');
  await page.locator('#table-search').fill('');await page.locator('#table-sort').selectOption('@row');await page.locator('#table-next').click();
  ok(await page.locator('[data-table-record]').count()===15&&(await page.locator('#table-page').textContent()).startsWith('51–65'),'Pagination continues to cover every visible record after field and search changes');
  await page.locator('[data-table-record="50"]').press('Enter');
  ok(await page.evaluate(id=>PortalLayers.selection.feature===PortalLayers.layers.get(id).data.features[50],ordinary),'Keyboard selection on a later page still resolves the correct original record');
  const building=await page.evaluate(async()=>{const feature={type:'Feature',properties:{usbf_id:'inventory-building',height_m:12,source:'USBF',country_iso:'USA'},geometry:{type:'Polygon',coordinates:[[[-77.072,38.912],[-77.0719,38.912],[-77.0719,38.9121],[-77.072,38.9121],[-77.072,38.912]]]}};return (await PortalLayers.addGeoJSON('Inventory workflow buildings',{type:'FeatureCollection',features:[feature]},{dataRole:'buildings'})).id;});created.push(building);
  await page.waitForFunction(()=>document.querySelector('#table-layer-name').textContent==='Inventory workflow buildings');
  ok((await page.locator('#attribute-head th').allTextContents()).some(s=>s.includes('Footprint source'))&&await page.locator('#attribute-head th').count()===5,'Known buildings retain their concise building-specific summary');
  await page.evaluate(id=>PortalLayers.selectLayer(id),ordinary);await page.waitForFunction(()=>document.querySelector('#table-layer-name').textContent==='Inventory workflow observations');
  ok(await page.locator('[data-column-id="field:long_identifier"]').count()>0&&!await page.locator('#selected-only').isChecked(),'Returning to an ordinary layer remembers chosen columns while clearing the previous layer’s selected-only filter');
  await page.setViewportSize({width:390,height:844});await page.evaluate(id=>{portal.map.fitBounds(PortalLayers.layers.get(id).bounds,{padding:55,maxZoom:17,duration:0});},ordinary);await page.locator('#table-columns summary').click();
  ok(await page.evaluate(()=>{const panel=document.querySelector('.inventory-column-panel').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&panel.left>=0&&panel.right<=innerWidth;}),'The mobile table and field chooser stay within the viewport while table cells scroll horizontally');
  await page.locator('#table-columns summary').click();return {passed:true,checks};
 }finally{
  if(viewport)await page.setViewportSize(viewport);
  await page.evaluate(({ids,before})=>{for(const id of ids)if(PortalLayers.layers.has(id))PortalLayers.remove(id);if(before.layer&&PortalLayers.layers.has(before.layer))PortalLayers.selectLayer(before.layer);if(document.querySelector('#attribute-table').hidden!==before.tableHidden)PortalInventory.toggleTable();PortalInventory.refresh();portal.map.jumpTo(before.camera);delete window.__inventoryUnsafe;},{ids:created,before});
 }
}
module.exports={runInventoryTableWorkflowChecks};
