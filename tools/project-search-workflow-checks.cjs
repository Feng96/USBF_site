/* A held Census response must never navigate a newly opened map. Shared browser only. */
const fs=require('fs'),path=require('path');
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length,pattern='https://geocoding.geo.census.gov/geocoder/locations/onelineaddress**';let release,arrived,deadline;
 const held=new Promise(resolve=>release=resolve),started=new Promise(resolve=>arrived=resolve);
 const handler=async route=>{arrived();await held;const callback=new URL(route.request().url()).searchParams.get('callback');const result={result:{addressMatches:[{matchedAddress:'100 VALIDATION WAY, WASHINGTON, DC',coordinates:{x:-77.0365,y:38.8987}}]}};await route.fulfill({status:200,contentType:'text/javascript',body:callback+'('+JSON.stringify(result)+');'}).catch(()=>{});};
 try{
  await qa.open();await p.route(pattern,handler);
  await p.locator('#place-search').fill('100 Validation Way, Washington DC');await p.locator('#explorer-search-button').click();
  await Promise.race([started,new Promise((_,reject)=>deadline=setTimeout(()=>reject(Error('The address request did not start.')),10000))]);clearTimeout(deadline);
  await p.evaluate(async()=>{const project=(await PortalProject.collect('Saved Seattle view')).project;project.layers=[];project.order=[];project.active=null;project.models=[];project.assets=[];project.research=null;project.place='Seattle';project.view.center=[-122.335,47.608];project.view.zoom=16;project.view.pitch=0;project.view.bearing=0;await PortalProject.restore(await PortalProject.prepare(project));});
  qa.ok(await p.locator('#place-search').inputValue()===''&&await p.locator('#search-results').isHidden(),'Opening a saved map clears the previous project’s pending place-search interface');
  release();await p.waitForTimeout(400);
  qa.ok(await p.evaluate(()=>{const c=portal.map.getCenter();return Math.abs(c.lng+122.335)<1e-8&&Math.abs(c.lat-47.608)<1e-8&&PortalLayers.layers.size===0&&PortalExplorer.metadata()===null;}),'A late Census result cannot move the new map, add a dataset or create an address marker');
  qa.ok(!qa.errors.length,'Ignoring the previous project’s JSONP reply produces no application error');
  const result={passed:true,checks:qa.checks.slice(start)};fs.writeFileSync(path.join(qa.out,'project-search-workflow.json'),JSON.stringify(result,null,2));return result;
 }finally{clearTimeout(deadline);release?.();await p.unroute(pattern,handler);}
};
