/* Direct public deployment / real data acceptance. No response interception. */
const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_PATH);
const out=process.env.PORTAL_QA_OUTPUT,base=process.env.PORTAL_LIVE_URL||'https://feng96.github.io/USBF_site/';
if(!out)throw Error('Set PORTAL_QA_OUTPUT on bulk storage.');fs.mkdirSync(out,{recursive:true});
let browser,page;const checks=[],errors=[],requests=[],responses=[],steps=[];
const ok=(v,message)=>{assert(v,message);checks.push(message);console.log('PASS',message)};
const count=()=>requests.length;
const watchdog=setTimeout(()=>{console.error('Live navigation acceptance exceeded its finite budget.');process.exit(1)},240000);
(async()=>{
 browser=await chromium.launch({executablePath:process.env.PORTAL_CHROMIUM_PATH,headless:true,ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--no-sandbox','--disk-cache-size=1','--media-cache-size=1','--disable-gpu-shader-disk-cache','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(45000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/USBF_v1/')&&r.url().includes('.parquet'))requests.push({url:r.url(),range:r.headers().range});});
 page.on('response',r=>{if(r.url().includes('/USBF_v1/')&&r.url().includes('.parquet'))responses.push({url:r.url(),status:r.status()});});
 await page.goto(base+'#v=38.912%2C-77.071%2C17&data=usbf-live:0.75:1&mode=2d',{waitUntil:'domcontentloaded',timeout:90000});
 const ready=()=>page.waitForFunction(()=>{const l=window.PortalLayers?.active;if(l?.error)throw Error(l.viewNote);return window.portal?.ready&&l?.cfg.id==='usbf-live'&&l.loaded&&!l.viewLoading&&l.data.features.length>0&&portal.map.isSourceLoaded(l.id)&&portal.map.queryRenderedFeatures({layers:l.renderIds}).length>0},null,{timeout:120000});
 await ready();
 ok(count()>0&&requests.every(r=>r.range),'First load reads genuine public GeoParquet byte ranges');
 ok(responses.length>0&&responses.every(r=>r.status===206),'Public data service returns real partial-content responses');
 const original=await page.evaluate(()=>{const l=PortalLayers.active,s=portal.map.getSource(l.id),setData=s.setData;window.__keptOriginals=l.data;window.__sourceWrites=0;s.setData=function(...args){window.__sourceWrites++;return setData.apply(this,args)};return {records:l.data.features.length,release:l.release,metrics:l.navigationMetrics,view:l.viewBounds};});
 ok(original.metrics&&original.records>0,'Public site is running the deployed navigation cache repair');
 const before=count(),center=[-77.071,38.912];
 for(const zoom of [18,17.25,17.75,17]){
  const started=Date.now();await page.evaluate(({center,zoom})=>{portal.map.jumpTo({center,zoom,pitch:0,bearing:0})},{center,zoom});await ready();
  steps.push({zoom,ms:Date.now()-started,newParquetRequests:count()-before});
 }
 ok(count()===before,'Four real public-site zooms cause zero extra GeoParquet requests');
 ok(await page.evaluate(()=>window.__sourceWrites===0),'Four real public-site zooms cause zero source data rewrites');
 ok(await page.evaluate(()=>PortalLayers.active.data===window.__keptOriginals),'The original decoded feature collection remains the same object');
 await page.evaluate(()=>{portal.map.jumpTo({zoom:8,pitch:0,bearing:0})});await page.waitForTimeout(350);
 ok(await page.evaluate(()=>{const l=PortalLayers.active;return !l.loaded&&portal.map.queryRenderedFeatures({layers:l.renderIds}).length===0}),'Overview hides cached building geometry without showing it at national scale');
 await page.evaluate(center=>{portal.map.jumpTo({center,zoom:17,pitch:0,bearing:0})},center);await ready();
 ok(count()===before&&await page.evaluate(()=>window.__sourceWrites===0),'Returning from overview reuses the prepared source without a read or rewrite');
 await page.evaluate(center=>{portal.map.jumpTo({center:[center[0]+.0001,center[1]],zoom:17})},center);await ready();
 ok(count()===before,'A nearby public-site pan uses cached original records');
 const selected=await page.evaluate(()=>{const l=PortalLayers.active,f=portal.map.queryRenderedFeatures({layers:l.renderIds}).find(f=>f.properties.usbf_id);PortalLayers.inspect(l,f);const source=l.featureById.get(String(f.properties.usbf_id));return {id:source.properties.usbf_id,geometry:source.geometry,properties:source.properties}});
 ok((await page.locator('#properties-content').textContent()).includes(selected.id),'Feature details retain the stable original building ID, including collapsed source attributes');
 const exported=await page.evaluate(async()=>{const l=PortalLayers.active,snapshot=await PortalAnalysisData.capture(l,{scope:'selection',selection:PortalLayers.selection,map:portal.map});return snapshot.features[0]});
 ok(JSON.stringify(exported.geometry)===JSON.stringify(selected.geometry)&&JSON.stringify(exported.properties)===JSON.stringify(selected.properties),'Selection capture preserves the full original polygon and all original attributes');
 await page.screenshot({path:path.join(out,'live-navigation-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await ready();
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout fits without horizontal overflow');
 await page.screenshot({path:path.join(out,'live-navigation-phone.png')});
 ok(errors.length===0,'No uncaught application errors during direct live navigation');
 const report={passed:true,site:base,transport:'direct-public-site-and-direct-public-data-no-interception',checks,errors,requests,responses,original,steps,metrics:await page.evaluate(()=>PortalLayers.active.navigationMetrics)};
 fs.writeFileSync(path.join(out,'live-navigation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,steps}));
})().catch(async error=>{if(page)await page.screenshot({path:path.join(out,'live-navigation-failure.png'),timeout:10000}).catch(()=>{});fs.writeFileSync(path.join(out,'live-navigation-failure.json'),JSON.stringify({error:error.stack,checks,errors,requests,responses},null,2));console.error(error);process.exitCode=1;}).finally(async()=>{clearTimeout(watchdog);await browser?.close()});
