/* Public Pages, real USBF originals and Census boundaries; no provider fixtures. */
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;qa.fixtures=false;qa.base=process.env.PORTAL_PUBLIC_URL||'https://feng96.github.io/USBF_site/';
 const goto=p.goto.bind(p);p.goto=(url,options={})=>goto(url,{...options,timeout:180000});
 await qa.open('?empty=1&gis=1.7');
 ok(await p.locator('.gis-tool-group').count()===6,'Published Pages serves the six GIS tool groups');
 const admin=await p.evaluate(async()=>{const state=await PortalGISRange.administrative('state','11'),county=await PortalGISRange.administrative('county','11001');return {state:state.meta.geoid,county:county.meta.geoid,kind:county.mask.geometry.type};});
 ok(admin.state==='11'&&admin.county==='11001'&&['Polygon','MultiPolygon'].includes(admin.kind),'Public browser reads real Census state and county boundaries');
 const loaded=await p.evaluate(async()=>{
  portal.map.jumpTo({center:[-77.0716,38.9121],zoom:18,pitch:0,bearing:0});
  const l=await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='usbf-live'),{restore:true,throwOnError:true});
  PortalCRS.set('EPSG:3857');const a=PortalCRS.fromWGS84([-77.0721,38.9119]),b=PortalCRS.fromWGS84([-77.0709,38.9124]);
  const mask=PortalGISCore.box([...a,...b]),range=PortalGISRange.value(mask,'Public projected box',{kind:'box',crs:PortalCRS.get(),coordinates:[...a,...b]});
  const raw=await PortalAnalysisLayers.load(l,{range});if(!raw)throw Error(document.querySelector('[data-added-row="'+l.id+'"]')?.innerText||'Original area load failed');
  return {id:raw.id,count:raw.data.features.length,preview:l.renderTiled,crs:raw.data.provenance.range.crs,limited:raw.data.provenance.limited,files:raw.data.provenance.release.files.length};
 });
 ok(loaded.count>0&&loaded.preview&&loaded.crs==='EPSG:3857'&&loaded.files>0,'Published USBF loads real GeoParquet originals by a projected box and preserves file provenance');
 await p.waitForFunction(id=>PortalInventory.rows.length===PortalLayers.layers.get(id).data.features.length,loaded.id);
 ok(await p.locator('#table-scope').inputValue()==='loaded','Real original area opens its all-loaded attribute table');
 const selected=await p.evaluate(async()=>{const l=PortalLayers.active,items=l.data.features.slice(0,Math.min(3,l.data.features.length));PortalGISSelection.set(l,items,'replace');await PortalGIS.action('selection-table');const output=await PortalGIS.selectedLayer();return {id:output.id,count:output.data.features.length,expected:items.length};});
 ok(selected.count===selected.expected&&selected.count>0,'Real building batch selection creates an independent original-geometry layer');
 const operation=await p.evaluate(async({a,b})=>{const layers=[PortalLayers.layers.get(a),PortalLayers.layers.get(b)],inputs=await Promise.all(layers.map(l=>PortalGISCore.capture(l))),merged=await PortalGISCore.process(inputs,'merge');const out=await PortalGIS.add(merged,'Public GIS merge');const p=await PortalProject.collect('Public GIS acceptance');return {count:out.data.features.length,expected:inputs.reduce((n,s)=>n+s.features.length,0),saved:p.project.layers.length};},{a:loaded.id,b:selected.id});
 ok(operation.count===operation.expected&&operation.saved>=3,'Real original layers merge without losing records and can be saved in a Project');
 await p.locator('#interface-language').selectOption('zh-CN');await qa.screenshot('gis-public-desktop.png');
 await p.setViewportSize({width:390,height:844});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Published grouped GIS toolbar fits a phone');await qa.screenshot('gis-public-phone.png');
 ok(!qa.errors.length,'Public original-data GIS workflow has no uncaught errors');
 require('fs').writeFileSync(qa.out+'/gis-public.json',JSON.stringify({passed:true,checks:qa.checks,loaded,admin,selected,operation,consoleErrors:qa.consoleErrors},null,2));
};
