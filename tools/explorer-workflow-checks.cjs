/* Shared-browser checks only. This module never creates a browser or page. */
const assert=require('assert'),fs=require('fs'),path=require('path');

async function runExplorerWorkflowChecks(page,out){
  const checks=[],created=[],requests=[];
  let slowGate=null,slowPattern=null,slowHandler=null;
  const ok=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS',label);};
  const watch=request=>requests.push(request.url());
  const censusRequests=()=>requests.filter(url=>url.startsWith('https://geocoding.geo.census.gov/'));
  const stateFiles=()=>requests.filter(url=>/\/data\/places\/census-2026\/[a-z]{2}\.json(?:\?|$)/.test(url));
  const searchRequests=()=>requests.filter(url=>/\/data\/places\/|geocoding\.geo\.census\.gov|nominatim/i.test(url));
  const before=await page.evaluate(()=>{const c=portal.map.getCenter(),research=PortalModels.enabled&&PortalModels.current?{id:PortalModels.current.id,method:PortalModels.method,roofOnly:document.querySelector('#model-roof-only').checked,edges:document.querySelector('#model-edges').checked,visible:document.querySelector('#model-visible').checked}:null;return {camera:{center:[c.lng,c.lat],zoom:portal.map.getZoom(),bearing:portal.map.getBearing(),pitch:portal.map.getPitch()},view3d:portal.view3d,place:document.querySelector('#map-place-name').textContent,active:PortalLayers.active?.id||null,locator:PortalExplorer.metadata(),research,layers:Array.from(PortalLayers.layers.values()).map(l=>({id:l.id,visible:l.visible}))};});
  const viewport=page.viewportSize();
  const open=async()=>{await page.evaluate(()=>PortalExplorer.openPlacePicker());await page.locator('#explorer-place-dialog').waitFor({state:'visible'});};
  const chooseState=async code=>{await page.locator('#explorer-place-state').selectOption(code);await page.waitForFunction(code=>PortalExplorer.searchState(code,'').length>0,code);};
  page.on('request',watch);
  try{
    await page.evaluate(async()=>{await PortalAnalysis.cancel({clear:true});for(const d of document.querySelectorAll('dialog[open]'))d.close();await PortalExplorer.loadPlaces();});
    const added=await page.evaluate(async()=>{
      if(Array.from(PortalLayers.layers.values()).some(l=>l.cfg.id==='usbf-live'))return null;
      const f={type:'Feature',id:'explorer-workflow-1',properties:{usbf_id:'explorer-workflow-1',height_m:12,source:'Synthetic acceptance fixture'},geometry:{type:'Polygon',coordinates:[[[-77.072,38.912],[-77.0718,38.912],[-77.0718,38.9122],[-77.072,38.9122],[-77.072,38.912]]]}};
      const l=await PortalLayers.addGeoJSON('Explorer acceptance buildings',{type:'FeatureCollection',features:[f]},{id:'usbf-live',driver:'usbf',dataRole:'buildings',license:'Synthetic QA fixture'});return l.id;
    });
    if(added)created.push(added);
    await open();await page.locator('#explorer-place-state').selectOption('');
    await page.waitForFunction(()=>document.querySelector('#explorer-place-state').options.length===53);
    ok(await page.locator('#explorer-place-dialog').getAttribute('aria-labelledby')==='explorer-place-title'&&await page.locator('#explorer-place-query').isVisible(),'The place chooser opens with a labelled search and all states, DC and Puerto Rico');
    ok(censusRequests().length===0&&stateFiles().length<=1,'Opening the chooser does not query a geocoder or download all state lists');
    await chooseState('TN');
    const beforeTyping=searchRequests().length;await page.locator('#explorer-place-query').fill('Signal Mountain');
    await page.locator('#explorer-place-list [data-explorer-place]').first().waitFor({state:'visible'});await page.waitForTimeout(350);
    const townButtons=page.locator('#explorer-place-list [data-explorer-place]');
    ok(await townButtons.count()===1&&(await townButtons.innerText()).includes('Signal Mountain, TN')&&await townButtons.getAttribute('title')==='Signal Mountain town','A small Tennessee town resolves with its state and original Census name');
    ok(searchRequests().length===beforeTyping&&censusRequests().length===0,'Typing a town name filters downloaded local records without sending a query');
    const target=await page.evaluate(async()=>{const rows=await PortalExplorer.loadStatePlaces('TN');return {coords:rows.find(p=>p.name==='Signal Mountain town').coords,count:PortalLayers.layers.size};});
    await townButtons.click();await page.waitForFunction(coords=>{const c=portal.map.getCenter();return Math.abs(c.lng-coords[0])<1e-7&&Math.abs(c.lat-coords[1])<1e-7;},target.coords);
    ok(await page.evaluate(count=>PortalLayers.layers.size===count&&PortalExplorer.metadata()===null&&PortalComposer.sources().locator===null,target.count),'A Census place navigates to its reference point without creating an address marker or analytical layer');
    await open();await chooseState('PA');await page.locator('#explorer-place-query').fill('Aaronsburg');
    await page.waitForFunction(()=>document.querySelectorAll('#explorer-place-list [data-explorer-place]').length===2);
    const duplicateRows=await page.locator('#explorer-place-list [data-explorer-place]').evaluateAll(rows=>rows.map(r=>({action:r.dataset.explorerPlace,label:r.querySelector('strong').textContent,note:r.querySelector('span').textContent})));
    ok(duplicateRows.every(r=>r.label==='Aaronsburg, PA'&&r.note.includes('Census-designated place'))&&duplicateRows[0].action!==duplicateRows[1].action&&duplicateRows[0].note!==duplicateRows[1].note,'Same-name places in one state remain separate choices with different reference locations');
    await page.locator('#explorer-place-query').fill('');const firstPage=await page.locator('#explorer-place-list [data-explorer-place]').count(),beforeMore=stateFiles().length;
    await page.locator('[data-explorer-place-more]').click();
    ok(firstPage===40&&await page.locator('#explorer-place-list [data-explorer-place]').count()===80&&stateFiles().length===beforeMore,'Show more reveals another page of places without requesting more source files');
    await chooseState('PR');await page.locator('#explorer-place-query').fill('penuelas');await page.locator('#explorer-place-list [data-explorer-place]').first().waitFor({state:'visible'});
    ok(await page.locator('#explorer-place-coverage').isVisible()&&(await page.locator('#explorer-place-coverage').innerText()).includes('Puerto Rico')&&(await page.locator('#explorer-place-list').innerText()).includes('Peñuelas, PR'),'Puerto Rico supports unaccented name search and clearly states the USBF coverage limit');
    const beforePR=await page.evaluate(()=>PortalLayers.layers.size);await page.locator('#explorer-place-list [data-explorer-place]').first().click();
    ok(await page.evaluate(count=>portal.map.getCenter().lat<20&&PortalLayers.layers.size===count&&PortalExplorer.metadata()===null,beforePR),'A Puerto Rico reference point does not invent USBF coverage or a building identity');
    await open();for(const code of ['AK','HI']){await chooseState(code);await page.locator('#explorer-place-query').fill('');ok(await page.locator('#explorer-place-coverage').isVisible()&&(await page.locator('#explorer-place-list [data-explorer-place]').first().innerText()).includes('outside current'),'The '+code+' list retains an explicit coverage notice');}
    const fresh=await page.evaluate(async()=>{const m=await PortalExplorer.loadPlaceManifest();return m.states.filter(s=>!PortalExplorer.searchState(s.code,'').length).map(s=>s.code);});
    if(fresh.length>=2){
      const slow=fresh[0],fast=fresh[1];let release,seen;const held=new Promise(resolve=>release=resolve),started=new Promise(resolve=>seen=resolve);slowGate=release;slowPattern='**/data/places/census-2026/'+slow.toLowerCase()+'.json';
      slowHandler=async route=>{seen();await held;await route.continue();};await page.route(slowPattern,slowHandler);
      await page.locator('#explorer-place-query').fill('');await page.locator('#explorer-place-state').selectOption(slow);let deadline;try{await Promise.race([started,new Promise((_,reject)=>deadline=setTimeout(()=>reject(Error('The delayed state request did not start.')),10000))]);}finally{clearTimeout(deadline);}
      await chooseState(fast);const name=await page.evaluate(code=>PortalExplorer.searchState(code,'')[0].officialName,fast);await page.locator('#explorer-place-query').fill(name);
      release();await page.waitForFunction(code=>PortalExplorer.searchState(code,'').length>0,slow);
      ok(await page.locator('#explorer-place-state').inputValue()===fast&&(await page.locator('#explorer-place-list [data-explorer-place]').evaluateAll(rows=>rows.map(r=>r.querySelector('strong').textContent))).every(label=>label.endsWith(', '+fast)),'A slow earlier state request cannot overwrite a newer state choice or its typed query');
      await page.unroute(slowPattern,slowHandler);slowPattern=null;slowHandler=null;slowGate=null;
    }
    await page.setViewportSize({width:375,height:812});
    ok(await page.locator('#explorer-place-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth;}),'The state and place controls fit a phone viewport without horizontal scrolling');
    ok((await page.locator('#explorer-place-help').innerText()).includes('reference point')&&(await page.locator('#explorer-place-help').innerText()).includes('not an individual building'),'The chooser explains the difference between a place reference point and a building');
    if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'census-place-picker-mobile.png'),timeout:20000});fs.writeFileSync(path.join(out,'explorer-workflow.json'),JSON.stringify({passed:true,checks,localPlaceRequests:stateFiles().length,geocoderRequests:censusRequests().length},null,2));}
    return {passed:true,checks,localPlaceRequests:stateFiles().length,geocoderRequests:censusRequests().length};
  }finally{
    slowGate?.();if(slowPattern&&slowHandler)await page.unroute(slowPattern,slowHandler).catch(()=>{});page.removeListener('request',watch);
    if(viewport)await page.setViewportSize(viewport);
    await page.evaluate(async({before,created})=>{
      document.querySelector('#explorer-place-dialog')?.close();for(const id of created)if(PortalLayers.layers.has(id))PortalLayers.remove(id);
      for(const l of before.layers)if(PortalLayers.layers.has(l.id))PortalLayers.setStyle(l.id,{visible:l.visible});
      if(before.locator){const r=PortalExplorer.parseAddress({result:{addressMatches:[{matchedAddress:before.locator.label,coordinates:{x:before.locator.coordinates[0],y:before.locator.coordinates[1]}}]}},before.locator.label);if(r.length)PortalExplorer.navigate(r[0].action);}else PortalExplorer.clearLocation();
      if(before.research){await PortalModels.select(before.research.id,before.research.method,false);document.querySelector('#model-roof-only').checked=before.research.roofOnly;document.querySelector('#model-edges').checked=before.research.edges;document.querySelector('#model-visible').checked=before.research.visible;document.querySelector('#model-roof-only').dispatchEvent(new Event('change'));}else PortalModels.hide();
      if(before.active&&PortalLayers.layers.has(before.active))PortalLayers.selectLayer(before.active);portal.setViewMode(before.view3d,false);portal.map.jumpTo(before.camera);document.querySelector('#map-place-name').textContent=before.place;
    },{before,created});
  }
}

module.exports=async qa=>{const result=await runExplorerWorkflowChecks(qa.page,qa.out);for(const label of result.checks)qa.ok(true,label);return result;};
module.exports.runExplorerWorkflowChecks=runExplorerWorkflowChecks;
