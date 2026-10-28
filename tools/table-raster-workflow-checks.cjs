/* Bounded table and raster selection acceptance in the supervisor's existing Chrome. */
const fs=require('fs'),path=require('path'),assert=require('assert');
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length,created=[];let originalBytes;
 const readCSV=line=>Array.from(line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g),m=>m[1].replace(/""/g,'"'));
 try{
  await qa.open();
  const id=await p.evaluate(async()=>{const data={type:'FeatureCollection',provenance:{featureCount:20001,licenses:['Synthetic validation fixture']},features:Array.from({length:20001},(_,i)=>({type:'Feature',properties:{name:'QA-table-row-'+String(i).padStart(5,'0'),zero:0,flag:false},geometry:{type:'Point',coordinates:[-77.072+(i%201)*.000001,38.912+Math.floor(i/201)*.000001]}}))};return (await PortalLayers.addGeoJSON('QA table capacity',data)).id;});created.push(id);
  await p.evaluate(()=>PortalInventory.toggleTable());
  await p.waitForFunction(id=>PortalInventory.rows.length===20000&&PortalInventory.tableData.metadata(PortalLayers.layers.get(id)).tableLimited,id,{timeout:90000});
  qa.ok((await p.locator('#table-scope-note').textContent()).includes('first 20,000')&&(await p.locator('#table-count').textContent()).includes('first 20,000'),'A real rendered 20,001-record layer clearly labels the table, search and sort subset');
  const chosen=await p.evaluate(()=>PortalInventory.rows[0].properties.name);await p.locator('#table-search').fill(chosen);
  qa.ok(await p.locator('[data-table-record]').count()===1,'Filtering the capped table keeps its declared subset and exact source row');
  const csvPath=await qa.download(()=>p.locator('#attribute-table [data-export-table="csv"]').click(),'table-cap-subset.csv'),lines=fs.readFileSync(csvPath,'utf8').split('\r\n'),header=readCSV(lines[0]),row=readCSV(lines[1]);
  qa.ok(row[header.indexOf('__map_partial')]==='true'&&row[header.indexOf('__map_table_partial')]==='true'&&row[header.indexOf('__map_table_record_limit')]==='20000'&&row[header.indexOf('name')]===chosen,'The downloaded table CSV explicitly retains the cap after filtering to one original record');
  const geoPath=await qa.download(()=>p.evaluate(()=>PortalInventory.exportTable('geojson')),'table-cap-subset.geojson'),data=JSON.parse(fs.readFileSync(geoPath,'utf8'));
  qa.ok(data.features.length===1&&data.provenance.featureCount===1&&data.provenance.limited&&data.provenance.tableView.tableLimited,'Table GeoJSON records its actual exported count and remains partial instead of inheriting the full source count');
  await p.locator('#table-search').fill('');
  const raster=await p.evaluate(async()=>{const bytes=GeoTIFF.writeArrayBuffer([0,1,2,3],{width:2,height:2,ModelPixelScale:[.0001,.0001,0],ModelTiepoint:[0,0,0,-77.072,38.912,0],GeographicTypeGeoKey:4326}),file=new File([bytes],'qa-selected-raster.tif',{type:'image/tiff'}),layer=await PortalImport.importData({type:'geotiff',name:'QA selected raster',file,crs:'auto',bands:'1',palette:'gray'});return {id:layer.id,bytes:Array.from(new Uint8Array(bytes))};});created.push(raster.id);originalBytes=Buffer.from(raster.bytes);
  await p.waitForFunction(id=>PortalLayers.active?.id===id&&document.querySelector('#attribute-table [data-export-table="csv"]').disabled,raster.id);
  qa.ok(await p.evaluate(id=>PortalLayers.active.id===id,raster.id)&&await p.locator('#attribute-table [data-export-table="csv"]').isDisabled(),'Adding a raster selects it and disables empty vector-table downloads');
  await p.evaluate(id=>PortalLayers.selectLayer(id),id);await p.locator('[data-layer-activate="'+raster.id+'"]').click();
  await p.locator('[data-workspace-tool="download"]').first().click();
  qa.ok(await p.locator('#composer-data-layer').inputValue()===raster.id&&await p.locator('#composer-download-data').isDisabled()&&await p.locator('#composer-original-file').isVisible(),'Clicking an imagery layer makes Download offer that original raster instead of the previous vector');
  const rasterPath=await qa.download(()=>p.locator('#composer-original-file').click(),'selected-raster-original.tif');
  qa.ok(fs.readFileSync(rasterPath).equals(originalBytes),'The raster Download action returns the exact original TIFF bytes');
  await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
  const project=await p.evaluate(async()=>{const project=(await PortalProject.collect('Raster selected')).project;project.layers=project.layers.filter(l=>l.key===project.active);project.order=project.order.filter(entry=>entry[0]===project.active);return project;});
  await p.evaluate(async project=>PortalProject.restore(await PortalProject.prepare(project)),project);created.length=0;
  qa.ok(await p.evaluate(()=>PortalLayers.isRaster(PortalLayers.active)&&PortalLayers.layers.size===1),'Saving and opening an imagery-only map preserves its active raster dataset');
  qa.ok(qa.errors.length===0,'The large table and raster selection flows complete without application errors');
  const report={passed:true,checks:qa.checks.slice(start)};fs.writeFileSync(path.join(qa.out,'table-raster-workflow.json'),JSON.stringify(report,null,2));return report;
 }catch(error){await qa.screenshot('table-raster-failure.png').catch(()=>{});throw error;}
 finally{await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();PortalLayers.clear();if(!document.querySelector('#attribute-table').hidden)PortalInventory.toggleTable();}).catch(()=>{});}
};
