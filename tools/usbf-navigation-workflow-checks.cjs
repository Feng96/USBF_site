/* Baseline vs repair, genuine public Parquet and actual browser renderer.
 * Basemaps are test PNGs; all USBF metadata and byte responses are unmodified.
 * This measures client/relay behavior, not a user's network latency. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
module.exports=async qa=>{
 const p=qa.page,repo=path.resolve(__dirname,'..'),baseline=execFileSync('git',['show','4a82800010883d71c8b3a7ff69ec904eb1a21c94:usbf-source.js'],{cwd:repo,encoding:'utf8'}),fixed=fs.readFileSync(path.join(repo,'usbf-source.js'),'utf8');
 let mode='baseline';const network=[],results=[],center=[-77.071,38.912],pattern='https://data.source.coop/opengeos/us-buildings/USBF_v1/**';
 const modes=process.env.PORTAL_NAVIGATION_FIXED_ONLY==='1'?['fixed']:['baseline','fixed'];
 const cors={'access-control-allow-origin':'*','access-control-expose-headers':'Content-Range, Accept-Ranges, ETag, Content-Length'};
 await p.route('**/usbf-source.js*',route=>route.request().url().startsWith(qa.base)?route.fulfill({status:200,contentType:'text/javascript',body:mode==='baseline'?baseline:fixed}):route.continue());
 const relay=async route=>{
  const r=route.request(),url=new URL(r.url()),record={mode,kind:url.pathname.endsWith('.parquet')?'parquet':'manifest',range:r.headers().range||null,start:Date.now()};network.push(record);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0',...(record.range?{Range:record.range}:{})},signal:controller.signal}),body=Buffer.from(await response.arrayBuffer()),headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['transfer-encoding'];delete headers['content-length'];Object.assign(record,{status:response.status,bytes:body.length,ms:Date.now()-record.start});await route.fulfill({status:response.status,headers:{...headers,...cors,'content-length':String(body.length)},body});}
  catch(e){record.error=e.message;await route.abort('failed').catch(()=>{});}finally{clearTimeout(timer);}
 };
 await p.route(pattern,relay);
 const count=()=>network.filter(r=>r.mode===mode&&r.kind==='parquet').length;
 const ready=()=>p.waitForFunction(()=>{const l=PortalLayers.active;if(l?.error)throw Error(l.viewNote);return l?.loaded&&!l.viewLoading&&portal.map.isSourceLoaded(l.id)&&portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).length>0},null,{timeout:120000});
 const state=()=>p.evaluate(()=>{const l=PortalLayers.active;return {writes:window.__sourceWrites||0,records:l.data.features.length,metrics:l.navigationMetrics||null,partial:!!l.viewLimited,loaded:l.loaded,release:l.release,view:l.viewBounds};});
 try{
  for(mode of modes){
   console.log('NAVIGATION_PHASE',mode);await qa.open('?empty=1');
   await p.evaluate(center=>{portal.map.jumpTo({center,zoom:18,pitch:0,bearing:0});},center);
   const start=Date.now();await p.evaluate(async()=>{await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='usbf-live'),{restore:true,throwOnError:true});const s=portal.map.getSource(PortalLayers.active.id),original=s.setData;window.__sourceWrites=0;s.setData=function(...args){window.__sourceWrites++;return original.apply(this,args);};});await ready();
   const cold={ms:Date.now()-start,requests:count(),...await state()};console.log('COLD',mode,JSON.stringify(cold));
   const referenceIds=results[0]?.samples.map(f=>f.properties.usbf_id)||null;
   const samples=await p.evaluate(ids=>ids?PortalLayers.active.data.features.filter(f=>ids.includes(f.properties.usbf_id)):PortalLayers.active.data.features.slice(0,20),referenceIds);
   const steps=[];let profiler;
   if(mode==='fixed'&&process.env.PORTAL_NAVIGATION_PROFILE==='1'){profiler=await p.context().newCDPSession(p);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
   for(const zoom of [19,18.25,18.75,18]){
    const before=Date.now(),requests=count(),writes=(await state()).writes;
    await p.evaluate(({center,zoom})=>{portal.map.jumpTo({center,zoom,pitch:0,bearing:0});},{center,zoom});await ready();
    const after=await state(),step={zoom,ms:Date.now()-before,parquetRequests:count()-requests,sourceWrites:after.writes-writes};steps.push(step);console.log('ZOOM',mode,JSON.stringify(step));
   }
   let cpu=null;
   if(profiler){const {profile}=await profiler.send('Profiler.stop');await profiler.detach();fs.writeFileSync(path.join(qa.out,'navigation-warm.cpuprofile'),JSON.stringify(profile));const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame])),times=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const f=nodes.get(profile.samples[i]),key=JSON.stringify([f.functionName,f.url,f.lineNumber]);times.set(key,(times.get(key)||0)+(profile.timeDeltas?.[i]||0)/1000);}cpu=Array.from(times,([key,selfMs])=>({frame:JSON.parse(key),selfMs})).sort((a,b)=>b.selfMs-a.selfMs).slice(0,20);}
   results.push({mode,cold,steps,samples,cpu,after:await state()});
   qa.ok(cold.records>0&&!cold.partial&&cold.requests>0,mode+': first load uses complete real public source records');
   if(mode==='fixed'){
    qa.ok(steps.every(s=>s.parquetRequests===0),'Real repeated zooms issue zero additional GeoParquet requests');
    qa.ok(steps.every(s=>s.sourceWrites===0),'Real repeated zooms never clear or rewrite the MapLibre source');
    const requests=count(),writes=(await state()).writes;
    await p.evaluate(()=>{portal.map.jumpTo({zoom:8,pitch:0,bearing:0});});await p.waitForTimeout(350);
    qa.ok(await p.evaluate(()=>{const l=PortalLayers.active;return portal.map.queryRenderedFeatures({layers:l.renderIds}).length===0&&!l.loaded}),'At overview zoom cached source is retained but building geometry is hidden');
    await p.evaluate(center=>{portal.map.jumpTo({center,zoom:18,pitch:0,bearing:0});},center);await ready();
    qa.ok(count()===requests&&(await state()).writes===writes,'Returning from overview reuses real prepared geometry without network or setData');
    await p.evaluate(center=>{portal.map.jumpTo({center:[center[0]+.0001,center[1]],zoom:18});},center);await ready();
    qa.ok(count()===requests&&(await state()).writes===writes,'Nearby pan within the preloaded neighborhood uses the same prepared geometry');
    await qa.screenshot('navigation-cache-real-dc.png');
    await p.setViewportSize({width:390,height:844});await p.waitForTimeout(350);await ready();
    qa.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Phone layout remains usable after retained-source navigation');
    await qa.screenshot('navigation-cache-phone.png');
   }
  }
  const original=results.find(r=>r.mode==='baseline'),repaired=results.find(r=>r.mode==='fixed');
  if(original){qa.ok(original.steps.every(s=>s.parquetRequests>0&&s.sourceWrites>0),'Baseline independently reproduces repeated source reads and geometry resets');const before=new Map(original.samples.map(f=>[f.properties.usbf_id,f])),overlap=repaired.samples.filter(f=>before.has(f.properties.usbf_id));qa.ok(overlap.length===before.size&&overlap.every(f=>JSON.stringify(f)===JSON.stringify(before.get(f.properties.usbf_id))),'The same 20 stable source IDs retain identical original polygons and attributes');}
  qa.ok(qa.errors.length===0,'No uncaught errors in the real navigation comparison');
  const summary=results.map(({samples,...r})=>r),report={passed:true,kind:'real-source-http-relay-browser-comparison',directPublicWebsite:false,basemapFixtures:true,sourceScriptSha256:crypto.createHash('sha256').update(fixed).digest('hex'),checks:qa.checks,results:summary,network,errors:qa.errors};
  fs.writeFileSync(path.join(qa.out,'navigation-performance.json'),JSON.stringify(report,null,2));return report;
 }catch(error){fs.writeFileSync(path.join(qa.out,'navigation-performance-failure.json'),JSON.stringify({error:error.stack,results:results.map(({samples,...r})=>r),network,checks:qa.checks},null,2));throw error;}
 finally{await p.unroute(pattern,relay);}
};
