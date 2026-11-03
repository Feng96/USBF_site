/* UI retry must operate on government viewports as well as USBF. */
module.exports=async qa=>{
 const p=qa.page,{ok}=qa;let fail=true;
 await p.route('https://fixture.test/dc/**',async route=>{
  const q=new URL(route.request().url()).searchParams;
  if(q.get('returnIdsOnly')==='true')return route.fulfill({json:{objectIdFieldName:'OBJECTID',objectIds:[1,2]}});
  if(fail)return route.fulfill({status:503,body:'Unavailable'});
  return route.fulfill({json:{type:'FeatureCollection',features:[1,2].map(id=>({type:'Feature',id,properties:{OBJECTID:id},geometry:{type:'Polygon',coordinates:[[[-77.071+id*.0002,38.912],[-77.0709+id*.0002,38.912],[-77.071+id*.0002,38.9121],[-77.071+id*.0002,38.912]]]}}))}});
 });
 await qa.open('?empty=1');
 await p.evaluate(async()=>{portal.map.jumpTo({center:[-77.071,38.912],zoom:16,pitch:0,bearing:0});await PortalLayers.add({...PortalLayers.catalog.find(c=>c.id==='dc-government'),url:'https://fixture.test/dc'},{restore:true,throwOnError:true});});
 await p.waitForFunction(()=>PortalLayers.active?.error&&!PortalLayers.active.viewLoading);
 await p.waitForFunction(()=>document.querySelector('#explorer-neighborhood summary')?.textContent.includes('incomplete'));
 ok((await p.locator('#explorer-neighborhood summary').innerText()).includes('incomplete'),'A government page failure has a visible coverage warning on the map');
 await p.locator('#explorer-neighborhood summary').click();fail=false;await p.locator('[data-explorer-retry]').click();
 await p.waitForFunction(()=>PortalLayers.active?.loaded&&!PortalLayers.active.viewLoading&&!PortalLayers.active.error);
 ok(await p.evaluate(()=>PortalLayers.active.data.features.length===2&&!PortalLayers.active.viewLimited),'Try again reloads the government source and completes its matching records');
 await p.locator('#interface-language').selectOption('zh-CN');
 await p.waitForFunction(()=>document.querySelector('#explorer-neighborhood summary').textContent.includes('周边已加载'));
 ok(true,'The completed government summary supports the Chinese interface');
 ok(!qa.errors.length,'Government retry has no uncaught browser errors');
 require('fs').writeFileSync(qa.out+'/viewport-retry.json',JSON.stringify({passed:true,checks:qa.checks},null,2));
};
