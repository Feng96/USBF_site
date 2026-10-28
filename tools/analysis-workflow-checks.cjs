/* Called by the shared browser acceptance run; this module never launches a browser. */
const assert=require('assert'),fs=require('fs'),path=require('path');
async function runAnalysisWorkflowChecks(page,out){
 const checks=[],created=[];let waiting=false;
 const ok=(v,text)=>{assert(v,text);checks.push(text);console.log('PASS',text);};
 const before=await page.evaluate(()=>{const c=portal.map.getCenter();return {layer:PortalLayers.active?.id,camera:{center:[c.lng,c.lat],zoom:portal.map.getZoom(),bearing:portal.map.getBearing(),pitch:portal.map.getPitch()}};});
 const feature=(i,height)=>({type:'Feature',id:'analysis-workflow-'+i,properties:{usbf_id:'analysis-workflow-'+i,height_m:height,source:i<2?'A':'B'},geometry:{type:'Polygon',coordinates:[[[-77.072+i*.0003,38.912],[-77.0718+i*.0003,38.912],[-77.0718+i*.0003,38.9122],[-77.072+i*.0003,38.9122],[-77.072+i*.0003,38.912]]]}});
 try{
  await page.evaluate(async()=>{await PortalAnalysis.cancel({clear:true});document.querySelector('#analysis-workspace')?.close();});
  const original=await page.evaluate(async data=>{const l=await PortalLayers.addGeoJSON('Analysis workflow buildings',data,{dataRole:'buildings'});return l.id;},{type:'FeatureCollection',features:[feature(0,12),feature(1,0),feature(2,-999),feature(3,null)]});created.push(original);
  await page.evaluate(id=>PortalAnalysis.open('stats',{layerId:id,scope:'layer'}),original);
  await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.overview?.records===4);
  ok(await page.evaluate(()=>PortalAnalysis.overview.height.valid===1&&PortalAnalysis.overview.height.mean===12&&PortalAnalysis.statistics.summary.valid===1),'Statistics open without a snapshot step and use only available building heights');
  ok(await page.locator('.analysis-more-statistics').evaluate(e=>!e.open),'Detailed field controls stay collapsed until requested');
  await page.locator('#analysis-tab-chart').click();await page.locator('#analysis-chart-kind').selectOption('scatter');
  ok(await page.locator('#analysis-chart-field').inputValue()!==await page.locator('#analysis-chart-y').inputValue(),'The comparison chart starts with different, useful axes');
  await page.locator('#analysis-chart-field').selectOption('$area_m2');await page.locator('#analysis-chart-y').selectOption('height_m');await page.locator('#analysis-run-chart').click();
  await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.chart?.kind==='scatter');
  ok(await page.evaluate(()=>PortalAnalysis.chart.valid===1&&PortalAnalysis.chart.pairs[0].y===12),'Height scatter plots do not turn zero or missing-height codes into measurements');
  fs.mkdirSync(out,{recursive:true});const pending=page.waitForEvent('download');await page.locator('#analysis-chart-png').click();const download=await pending,target=path.join(out,'building-scatter.png');await download.saveAs(target);
  const png=fs.readFileSync(target),names=[];let source=null;
  for(let p=8;p<png.length;){const n=png.readUInt32BE(p),name=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);names.push(name);if(name==='iTXt'){const end=data.indexOf(0);if(data.subarray(0,end).toString()==='US Buildings source')source=JSON.parse(new TextDecoder().decode(data.subarray(end+5)));}p+=n+12;}
  ok(png.readUInt32BE(16)===1800&&png.readUInt32BE(20)===1120&&names.includes('IDAT')&&source?.provenance.name==='Analysis workflow buildings'&&source.provenance.featureCount===4,'A genuine high-resolution chart PNG retains the exact source range in embedded metadata');
  await page.locator('#analysis-chart-kind').selectOption('grouped');await page.locator('#analysis-chart-field').selectOption('height_m');await page.locator('#analysis-chart-group').selectOption('source');await page.locator('#analysis-run-chart').click();
  await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.chart?.kind==='grouped');
  ok(await page.evaluate(()=>PortalAnalysis.chart.rows.find(r=>r.label==='A').mean===12&&PortalAnalysis.chart.rows.find(r=>r.label==='B').mean===null),'Grouped charts leave unavailable groups explicitly missing');
  await page.locator('#analysis-tab-stats').click();await page.locator('.analysis-more-statistics').evaluate(e=>e.open=true);await page.locator('#analysis-numeric-field').selectOption('height_m');
  await page.evaluate(()=>{window.__analysisQAOriginal=PortalAnalysisData.valuesAsync;window.__analysisQAIntercepted=false;PortalAnalysisData.valuesAsync=async function(data,field,options){if(!window.__analysisQAIntercepted){window.__analysisQAIntercepted=true;await new Promise(resolve=>window.__analysisQARelease=resolve);return window.__analysisQAOriginal(data,field,{...options,signal:undefined});}return window.__analysisQAOriginal(data,field,options);};});
  waiting=true;await page.locator('#analysis-run-stats').click();await page.waitForFunction(()=>typeof window.__analysisQARelease==='function');
  await page.evaluate(id=>{document.querySelector('#analysis-workspace').close();document.querySelector('[data-added-remove="'+id+'"]').click();},original);
  const replacement=await page.evaluate(async data=>{const l=await PortalLayers.addGeoJSON('Replacement analysis buildings',data,{dataRole:'buildings'});PortalAnalysis.open('stats',{layerId:l.id,scope:'layer'});return l.id;},{type:'FeatureCollection',features:[feature(5,42),feature(6,42)]});created.push(replacement);
  await page.evaluate(()=>{PortalAnalysisData.valuesAsync=window.__analysisQAOriginal;window.__analysisQARelease();});
  await page.waitForFunction(()=>!PortalAnalysis.busy&&PortalAnalysis.snapshot?.provenance.name==='Replacement analysis buildings'&&PortalAnalysis.statistics?.summary.mean===42);waiting=false;
  ok(await page.evaluate(()=>PortalAnalysis.overview.records===2&&PortalAnalysis.statistics.provenance.name==='Replacement analysis buildings'&&!PortalAnalysis.error),'Removing a dataset during an uncooperative calculation cannot overwrite the replacement project with old statistics');
  return {passed:true,checks};
 }finally{
  await page.evaluate(async({ids,before})=>{if(window.__analysisQAOriginal)PortalAnalysisData.valuesAsync=window.__analysisQAOriginal;window.__analysisQARelease?.();await PortalAnalysis.cancel({clear:true});document.querySelector('#analysis-workspace')?.close();for(const id of ids)document.querySelector('[data-added-remove="'+id+'"]')?.click();if(before.layer&&PortalLayers.layers.has(before.layer))PortalLayers.selectLayer(before.layer);portal.map.jumpTo(before.camera);delete window.__analysisQAOriginal;delete window.__analysisQARelease;delete window.__analysisQAIntercepted;},{ids:created,before}).catch(e=>{if(!waiting)throw e;});
 }
}
module.exports={runAnalysisWorkflowChecks};
