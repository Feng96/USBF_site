/* Use the supervisor's existing Chrome: qa.run('tools/raster-window-workflow-checks.cjs'). */
const fs=require('fs'),path=require('path'),assert=require('assert');
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length,name='QA fixed GeoTIFF window';let initial;
 const ok=(value,label)=>{assert(value,label);qa.ok(true,label);},same=(a,b)=>['geographicExtent','sourcePixelWindow','overviewDimensions'].every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
 try{
  await qa.open();await p.waitForFunction(()=>window.PortalImport&&window.PortalProject&&window.GeoTIFF);
  initial=await p.evaluate(()=>({center:portal.map.getCenter().toArray(),zoom:portal.map.getZoom(),bearing:portal.map.getBearing(),pitch:portal.map.getPitch()}));
  const first=await p.evaluate(async name=>{
   portal.setViewMode(false,false);portal.map.jumpTo({center:[-77.072,38.912],zoom:18,pitch:0,bearing:0});
   const data=Array.from({length:64*64},(_,i)=>i%251),buffer=GeoTIFF.writeArrayBuffer(data,{width:64,height:64,BitsPerSample:[8],SamplesPerPixel:1,ModelPixelScale:[.0003125,.0003125,0],ModelTiepoint:[0,0,0,-77.08,38.92,0],GeographicTypeGeoKey:4326,GTRasterTypeGeoKey:1,GDAL_NODATA:'255'}),file=new File([buffer],'fixed-window.tif',{type:'image/tiff'}),layer=await PortalImport.importData({type:'geotiff',file,name,bands:'1',crs:'auto',palette:'viridis',viewOnly:true});
   return {id:layer.id,metadata:layer.cfg.raster,fixed:layer.rasterResource.options.readExtentWGS84,bounds:layer.rasterResource.options.bounds};
  },name);
  ok(JSON.stringify(first.fixed)===JSON.stringify(first.metadata.geographicExtent)&&!first.bounds&&first.metadata.sourcePixelWindow[2]-first.metadata.sourcePixelWindow[0]<64,'Current-view GeoTIFF imports pin the actual source window without rewriting whole-image affine bounds');
  const reread=await p.evaluate(async id=>{
   portal.map.jumpTo({center:[-100,40],zoom:6,pitch:0,bearing:0});const l=PortalLayers.layers.get(id),result=await PortalImport.readGeoTIFF({...l.rasterResource.options});URL.revokeObjectURL(result.url);return result.metadata;
  },first.id);
  ok(same(first.metadata,reread),'A real GeoTIFF fixed-window read retains its extent, source pixels and overview after panning outside the image');
  const saved=await p.evaluate(async()=>{const saved=(await PortalProject.collect('Fixed raster window map')).project;return saved;});
  const entry=saved.layers.find(l=>l.name===name);ok(entry.kind==='raster'&&entry.import.viewOnly&&JSON.stringify(entry.import.readExtentWGS84)===JSON.stringify(first.metadata.geographicExtent)&&!entry.import.bounds,'Save map records the read window independently of image georeferencing and the later saved camera');
  fs.writeFileSync(path.join(qa.out,'fixed-raster-window.usbf.json'),JSON.stringify(saved));
  const restored=await p.evaluate(async ({saved,name})=>{
   await PortalProject.restore(await PortalProject.prepare(saved));const layer=Array.from(PortalLayers.layers.values()).find(l=>l.cfg.name===name);return {id:layer.id,metadata:layer.cfg.raster,fixed:layer.rasterResource.options.readExtentWGS84,center:portal.map.getCenter().toArray(),sourceType:portal.map.getStyle().sources[layer.id].type};
  },{saved,name});
  ok(same(first.metadata,restored.metadata)&&JSON.stringify(restored.fixed)===JSON.stringify(first.metadata.geographicExtent)&&Math.abs(restored.center[0]+100)<1e-8&&restored.sourceType==='image','Open map restores the original raster window while retaining a saved camera outside the image');
  await p.evaluate(id=>PortalImport.styleRaster(PortalLayers.layers.get(id)),restored.id);
  for(const palette of ['gray','terrain']){
   const previous=await p.evaluate(id=>PortalLayers.layers.get(id).cfg.imageURL,restored.id);await p.locator('#raster-style-palette').selectOption(palette);await p.locator('#raster-style-form [type=submit]').click();
   await p.waitForFunction(({id,previous})=>PortalLayers.layers.get(id).cfg.imageURL!==previous,{id:restored.id,previous});
   ok(same(first.metadata,await p.evaluate(id=>PortalLayers.layers.get(id).cfg.raster,restored.id)),'Changing the '+palette+' display palette keeps the original read window despite an unrelated current camera');
  }
  await p.evaluate(()=>portal.map.jumpTo({center:[-77.065,38.915],zoom:19,pitch:0,bearing:0}));await p.locator('#raster-style-view-only').uncheck();await p.locator('#raster-style-view-only').check();
  const previous=await p.evaluate(id=>PortalLayers.layers.get(id).cfg.imageURL,restored.id);await p.locator('#raster-style-form [type=submit]').click();await p.waitForFunction(({id,previous})=>PortalLayers.layers.get(id).cfg.imageURL!==previous,{id:restored.id,previous});
  const selected=await p.evaluate(id=>{const l=PortalLayers.layers.get(id);return {metadata:l.cfg.raster,fixed:l.rasterResource.options.readExtentWGS84};},restored.id);
  ok(!same(first.metadata,selected.metadata)&&JSON.stringify(selected.fixed)===JSON.stringify(selected.metadata.geographicExtent),'Explicitly changing Current view selects and pins a new raster window');
  await p.locator('#raster-style-dialog [data-import-close]').click();await qa.screenshot('fixed-raster-window.png');
  const report={passed:true,checks:qa.checks.slice(start),original:first.metadata,reread,restored:restored.metadata,reselected:selected.metadata};fs.writeFileSync(path.join(qa.out,'raster-window-workflow.json'),JSON.stringify(report,null,2));return report;
 }catch(error){await qa.screenshot('raster-window-failure.png').catch(()=>{});fs.writeFileSync(path.join(qa.out,'raster-window-failure.json'),JSON.stringify({error:error.stack,checks:qa.checks.slice(start),state:await qa.state().catch(()=>({}))},null,2));throw error;}
 finally{await p.evaluate(({name,initial})=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();for(const l of Array.from(PortalLayers.layers.values()))if(l.cfg.name===name)PortalLayers.remove(l.id);if(initial)portal.map.jumpTo(initial);},{name,initial}).catch(()=>{});}
};
