/* Real six-city acceptance in the supervisor's existing Chrome. Optional local
 * display transport serves the final archive's exact bytes. Canonical metadata
 * and GeoParquet always use real public HTTP. Samples are partial validation only. */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const places=[['Washington DC',[-77.071,38.912]],['New York',[-73.985,40.748]],['Chicago',[-87.6298,41.8781]],['Knoxville',[-83.9207,35.9606]],['Los Angeles',[-118.2437,34.0522]],['Seattle',[-122.335,47.608]]];
const pattern='https://data.source.coop/opengeos/us-buildings/**';
const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'Range, If-Match','access-control-expose-headers':'Content-Range, Accept-Ranges, ETag, Content-Length'};
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function exactRange(file,offset,length){const handle=await fs.promises.open(file,'r');try{const body=Buffer.allocUnsafe(length);let done=0;while(done<length){const read=await handle.read(body,done,length-done,offset+done);if(!read.bytesRead)throw Error('Local final archive ended inside a requested range.');done+=read.bytesRead;}return body;}finally{await handle.close();}}
const kindOf=url=>url.pathname.endsWith('/USBF_v1/manifest.json')?'canonical-manifest':url.pathname.includes('/USBF_v1/')&&url.pathname.endsWith('.parquet')?'parquet':url.pathname.endsWith('/USBF_display/manifest.json')?'display-manifest':url.pathname.includes('/USBF_display/')&&url.pathname.endsWith('.pmtiles')?'display-pmtiles':'other';
module.exports=async qa=>{
 const p=qa.page,start=qa.checks.length,network=[],controllers=new Set(),cities=[],browsing=[],startedAt=new Date().toISOString(),started=Date.now();
 let current='publication',phase='prepare',canonical=null,display=null,local=null;
 const count=kind=>network.filter(r=>r.kind===kind&&r.method!=='OPTIONS').length,rawCounts=()=>({canonicalManifest:count('canonical-manifest'),parquet:count('parquet')});
 if(qa.usbfLocalDisplay){
  const input=qa.usbfLocalDisplay,manifest=JSON.parse(JSON.stringify(input.manifest)),file=fs.realpathSync(input.archivePath),stat=fs.statSync(file),url=new URL(manifest.url);
  if(!stat.isFile()||stat.size<127||manifest.benchmark===true||manifest.input_buildings!==manifest.source_release?.buildings||!/^[a-f0-9]{64}$/.test(manifest.sha256||'')||url.origin!=='https://data.source.coop'||!url.pathname.startsWith('/opengeos/us-buildings/USBF_display/releases/'))throw Error('Use the verified complete national display manifest and archive.');
  const sha256=await hashFile(file);if(sha256!==manifest.sha256)throw Error('The local final PMTiles bytes do not match the public manifest SHA256.');
  local={manifest,file,bytes:stat.size,sha256,url:url.origin+url.pathname,verifiedAt:new Date().toISOString()};
 }
 const route=async route=>{
  const request=route.request(),url=new URL(request.url()),range=request.headers().range,t0=Date.now(),record={city:current,phase,kind:kindOf(url),method:request.method(),url:url.href,range:range||null,startedAt:new Date().toISOString(),transport:'public-http-node-relay'};network.push(record);
  if(request.method()==='OPTIONS'){Object.assign(record,{status:204,bytes:0});return route.fulfill({status:204,headers:cors});}
  if(local&&record.kind==='display-manifest'){
   display=local.manifest;const body=Buffer.from(JSON.stringify(display));Object.assign(record,{transport:'verified-local-final-display-manifest',status:200,bytes:body.length,ms:Date.now()-t0});return route.fulfill({status:200,contentType:'application/json',headers:{...cors,'cache-control':'no-store'},body});
  }
  if(local&&url.origin+url.pathname===local.url){
   record.transport='verified-local-final-pmtiles-exact-range';
   if(request.method()==='HEAD'){Object.assign(record,{status:200,bytes:0,ms:Date.now()-t0});return route.fulfill({status:200,headers:{...cors,'accept-ranges':'bytes',etag:'"'+local.sha256+'"','content-length':String(local.bytes)},body:''});}
   const match=/^bytes=(\d+)-(\d*)$/.exec(range||''),offset=match?Number(match[1]):NaN,last=match?Math.min(match[2]?Number(match[2]):local.bytes-1,local.bytes-1):NaN;
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(last)||offset<0||last<offset||offset>=local.bytes){Object.assign(record,{status:416,bytes:0});return route.fulfill({status:416,headers:{...cors,'content-range':'bytes */'+local.bytes},body:''});}
   try{const body=await exactRange(local.file,offset,last-offset+1);Object.assign(record,{status:206,bytes:body.length,ms:Date.now()-t0});return await route.fulfill({status:206,contentType:'application/vnd.pmtiles',headers:{...cors,'accept-ranges':'bytes',etag:'"'+local.sha256+'"','content-range':'bytes '+offset+'-'+last+'/'+local.bytes,'content-length':String(body.length)},body});}
   catch(error){Object.assign(record,{error:error.message,ms:Date.now()-t0});await route.abort('failed').catch(()=>{});return;}
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);controllers.add(controller);
  try{
   const headers={'User-Agent':'Mozilla/5.0','Accept-Encoding':'identity',...(range?{Range:range}:{}),...(request.headers()['if-match']?{'If-Match':request.headers()['if-match']}:{})};
   const response=await fetch(url,{headers,signal:controller.signal}),forward=Object.fromEntries(response.headers);delete forward['content-encoding'];delete forward['content-length'];delete forward['transfer-encoding'];
   const body=Buffer.from(await response.arrayBuffer());Object.assign(record,{status:response.status,bytes:body.length,ms:Date.now()-t0,responseUrl:response.url,etag:response.headers.get('etag'),contentRange:response.headers.get('content-range')});
   if(response.ok&&record.kind==='canonical-manifest')canonical=JSON.parse(body.toString('utf8'));if(response.ok&&record.kind==='display-manifest')display=JSON.parse(body.toString('utf8'));
   await route.fulfill({status:response.status,headers:{...forward,...cors,'content-length':String(body.length)},body});
  }catch(error){Object.assign(record,{error:error.message,ms:Date.now()-t0});await route.abort('failed').catch(()=>{});}
  finally{clearTimeout(timer);controllers.delete(controller);}
 };
 await p.route(pattern,route);
 const mapReady=()=>p.waitForFunction(()=>{const l=PortalLayers.active;if(l?.error)throw Error(l.viewNote+' '+(l.errorDetail||''));return l?.renderTiled&&portal.map.isSourceLoaded(l.id)&&portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))}).length>0;},null,{timeout:90000});
 const go=async(name,center,zoom=18)=>{await p.evaluate(({center,name,zoom})=>{PortalModels.hide();portal.clearSelection();PortalLayers.clearExternalSelection();portal.setViewMode(false,false);portal.map.jumpTo({center,zoom,pitch:0,bearing:0});document.querySelector('#map-place-name').textContent=name;},{center,name,zoom});await mapReady();};
 try{
  await qa.open('?empty=1');await p.evaluate(async()=>{await PortalLayers.add(PortalLayers.catalog.find(c=>c.id==='usbf-live'),{restore:true,throwOnError:true});});
  const publication=await p.evaluate(()=>{const l=PortalLayers.active;return {type:l.cfg.type,analysisMode:l.cfg.analysisMode,renderTiled:l.renderTiled,displayMode:l.displayMode,displayRelease:l.displayRelease,declaredRelease:l.release,rawRecords:l.data.features.length};});
  qa.ok(publication.type==='viewport'&&publication.analysisMode==='on-demand'&&publication.renderTiled&&publication.rawRecords===0,'The real national PMTiles map retains its logical USBF connection and starts without raw records');
  qa.ok(publication.displayRelease.buildings>1000000&&publication.displayRelease.tiles>1000&&display.input_buildings===publication.displayRelease.buildings&&display.benchmark!==true,'The declared display publication identifies the national input; rendered fragments are separate from its publication total');
  phase='browse-before-first-analysis';
  for(const [name,center] of places){
   current=name;qa.liveProgress={phase,city:name,browsed:browsing.length,completed:0};const t0=Date.now();
   await go(name,center,14);await go(name,center,15);await go(name,center,18);
   const shown=await p.evaluate(()=>{const l=PortalLayers.active,f=portal.map.queryRenderedFeatures({layers:l.renderIds.filter(id=>portal.map.getLayer(id))});return {fragments:f.length,exampleID:f.find(f=>f.properties.usbf_id)?.properties.usbf_id,rawRecords:l.data.features.length};});
   qa.ok(shown.fragments>0&&shown.exampleID&&shown.rawRecords===0,'Real '+name+' browsing and two zooms show building tiles while originals stay unloaded');
   qa.ok(count('canonical-manifest')===0&&count('parquet')===0,'Before analysis, browsing '+name+' makes zero canonical manifest and GeoParquet requests');
   browsing.push({city:name,center,displayedFragments:shown.fragments,fragmentMeaning:'Rendered fragments only, not a unique-building total',rawTraffic:rawCounts(),ms:Date.now()-t0});
  }
  qa.ok(browsing.length===6&&count('canonical-manifest')===0&&count('parquet')===0,'All six cities finish browsing before the first canonical analytical-data request');
  for(const [name,center] of places){
   current=name;phase='before-explicit-capture';qa.liveProgress={phase,city:name,completed:cities.length};await go(name,center,18);const t0=Date.now(),trafficStart=network.length;phase='explicit-capture';
   const result=await p.evaluate(async()=>{
    const l=PortalLayers.active,s=await PortalAnalysisData.capture(l,{scope:'view',map:portal.map}),o=await PortalAnalysisData.overview(s),originals=new Map(l.data.features.map(f=>[f.properties.usbf_id,f])),features=s.features,flags={},sources={};
    for(const key of ['height_missing','height_incomplete','modified','hollow_cut','shape_changed']){const counts={true:0,false:0,null:0,missing:0,other:0};for(const f of features){const v=f.properties[key];counts[v===true?'true':v===false?'false':v===null?'null':v===undefined?'missing':'other']++;}flags[key]=counts;}
    for(const f of features){const source=String(f.properties.source??'Not provided');sources[source]=(sources[source]||0)+1;}
    const geometryValid=g=>{let good=true,vertices=0;function walk(c){if(!Array.isArray(c)){good=false;return;}if(typeof c[0]==='number'){vertices++;if(c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>90)good=false;}else c.forEach(walk);}if(!['Polygon','MultiPolygon'].includes(g?.type))return false;walk(g.coordinates);return good&&vertices>=4;};
    return {count:features.length,rawCacheRecords:l.data.features.length,sourceIds:features.every(f=>typeof f.properties.usbf_id==='string'&&f.properties.usbf_id.trim())&&new Set(features.map(f=>f.properties.usbf_id)).size===features.length,fullSourceGeometry:features.every(f=>geometryValid(f.geometry)&&JSON.stringify(originals.get(f.properties.usbf_id)?.geometry)===JSON.stringify(f.geometry)),heightRule:features.every(f=>f.properties.height_m===(typeof f.properties.height==='number'&&Number.isFinite(f.properties.height)&&f.properties.height>0?f.properties.height:null)),flags,sources,heightWithMissingInput:features.filter(f=>f.properties.height_missing===true&&f.properties.height_m>0).length,missingInputPositiveSourceHeights:features.filter(f=>f.properties.height_missing===true&&typeof f.properties.height==='number'&&f.properties.height>0).length,overview:{kind:o.kind,records:o.records,height:o.height},scope:s.provenance,displayRelease:l.displayRelease,analysisRelease:l.analysisRelease,sample:{type:'FeatureCollection',name:'USBF validation sample — partial',features:features.slice(0,10),provenance:{...s.provenance,scope:'partial-validation-sample-of-captured-map-area',scopeLabel:'Validation only: first up to 10 full original records from this local snapshot; partial and not representative',featureCount:Math.min(10,features.length),limited:true,sampling:{purpose:'Validation only, not a regional inventory',method:'First records in source order; not a representative population sample',inputRecords:features.length,outputRecords:Math.min(10,features.length)},lineage:[s.provenance]}}};
   });
   const files=result.scope.release?.files||[],byPath=new Map((canonical?.files||[]).map(file=>[file.path,file])),traffic=network.slice(trafficStart).filter(r=>r.kind==='parquet'&&r.method!=='OPTIONS'),bytes=traffic.reduce((n,r)=>n+(r.bytes||0),0);
   qa.ok(result.count>0&&result.sourceIds&&result.fullSourceGeometry&&result.heightRule&&Object.values(result.flags).every(c=>c.other===0)&&result.heightWithMissingInput===result.missingInputPositiveSourceHeights,'Real '+name+' analysis preserves original IDs, full geometry, nullable flags and positive heights despite missing elevation input');
   qa.ok(result.overview.kind==='buildings'&&result.overview.records===result.count&&result.scope.scope==='loaded-view'&&result.scope.requestedScope==='view'&&result.scope.geometryQuality==='full-loaded-source-geometry'&&result.scope.spatialEligible===true&&typeof result.scope.limited==='boolean'&&result.count<=12000&&bytes<=32*1024*1024,'Real '+name+' statistics describe an explicitly bounded local snapshot and retain the source-limit flag');
   qa.ok(files.length>0&&files.length<=9&&files.every(file=>{const f=byPath.get(file.path);return f&&f.sha256===file.sha256&&f.bytes===file.bytes&&f.rows===file.rows;})&&traffic.every(r=>{const u=new URL(r.url),f=byPath.get(decodeURIComponent(u.pathname.split('/').pop()));return r.status===206&&r.range&&f&&u.searchParams.get('v')===f.sha256;}),'Real '+name+' originals retain canonical file SHA256 values and arrive as versioned public HTTP ranges');
   const b=result.scope.loadedView;
   qa.ok(b?.length===4&&result.scope.requestedView?.length===4&&b[0]<=center[0]&&b[2]>=center[0]&&b[1]<=center[1]&&b[3]>=center[1]&&result.scope.release.updated===canonical.updated_utc&&result.analysisRelease.updated===result.scope.release.updated&&Number.isFinite(Date.parse(result.scope.loadedAt))&&Number.isFinite(Date.parse(result.scope.capturedAt)),'Real '+name+' provenance separates the requested area and original-data publication/capture dates from its display release');
   const beforePan=rawCounts();phase='pan-after-capture';await go(name,[center[0]+.0001,center[1]],18.4);await go(name,center,18);
   qa.ok(JSON.stringify(rawCounts())===JSON.stringify(beforePan),'After '+name+' analysis, pan and zoom add no canonical or GeoParquet requests');
   const sampleFile=path.join(qa.out,'live-usbf-'+name.toLowerCase().replace(/\s+/g,'-')+'-sample.geojson');fs.writeFileSync(sampleFile,JSON.stringify(result.sample));delete result.sample;
   Object.assign(result,{city:name,center,ms:Date.now()-t0,originalTraffic:{requests:traffic.length,bytes,ranges:traffic.map(r=>({url:r.url,range:r.range,bytes:r.bytes,status:r.status}))},sampleFile,validationMeaning:'Only this explicit local map area; no national building-total inference'});cities.push(result);qa.liveProgress={phase:'city-complete',city:name,completed:cities.length,count:result.count,ms:result.ms};
   if(name==='Washington DC'){await p.evaluate(()=>portal.setViewMode(true,true));await p.waitForFunction(()=>{const l=PortalLayers.active;return portal.map.queryRenderedFeatures({layers:[l.id+'-fill-extrusion']}).length>0;});await qa.screenshot('live-usbf-dc-heights.png');await p.evaluate(()=>portal.setViewMode(false,false));}
  }
  qa.ok(cities.length===6&&cities.every(city=>city.count>0),'All six real city captures and their later no-raw browsing checks complete');
  qa.ok(cities.some(city=>city.heightWithMissingInput>0)&&cities.some(city=>Object.values(city.flags).some(counts=>counts.null>0)),'The six-city originals include observed null flags and buildings that retain positive height despite missing elevation input');
  qa.ok(network.some(r=>r.kind==='parquet'&&r.status===206&&r.range)&&network.filter(r=>r.kind==='parquet').every(r=>r.transport==='public-http-node-relay'),'All canonical GeoParquet bytes come from real public HTTP, with original Range/ETag semantics');
  qa.ok(qa.errors.length===0,'The six-city real-data workflow has no uncaught application errors');
  const report={passed:true,checks:qa.checks.slice(start),startedAt,completedAt:new Date().toISOString(),ms:Date.now()-started,host:os.hostname(),transport:{display:local?'Verified final national PMTiles archive served through exact local filesystem ranges; this is test transport, not an HTTP deployment test.':'Real public PMTiles/display manifest relayed through Node fetch.',canonical:'Actual public Source Cooperative manifest and GeoParquet, Node HTTP relay with User-Agent Mozilla/5.0; response bytes are not modified.',basemap:qa.fixtures?'Synthetic basemap only; all USBF display and original records are real.':'Browser basemap configuration',timing:'This host, cache state and transport only; not a public-network performance guarantee.'},localDisplay:local?{archivePath:local.file,bytes:local.bytes,sha256:local.sha256,verifiedAt:local.verifiedAt,url:local.url}:null,declaredDisplayManifest:display,publication,browsing,cities,trafficTotals:{...rawCounts(),displayManifest:count('display-manifest'),displayPMTiles:count('display-pmtiles'),parquetBytes:network.filter(r=>r.kind==='parquet').reduce((sum,r)=>sum+(r.bytes||0),0)},network,validationScope:'Six explicitly requested local areas only. Each saved source sample has at most 10 records labelled validation-only/partial. Full source files are not downloaded.',errors:qa.errors};
  fs.writeFileSync(path.join(qa.out,'live-usbf-workflow.json'),JSON.stringify(report,null,2));if(canonical)fs.writeFileSync(path.join(qa.out,'live-usbf-manifest.json'),JSON.stringify(canonical));if(display)fs.writeFileSync(path.join(qa.out,'live-usbf-display-manifest.json'),JSON.stringify(display));qa.liveProgress={completed:cities.length,passed:true};return report;
 }catch(error){fs.writeFileSync(path.join(qa.out,'live-usbf-failure.json'),JSON.stringify({error:error.stack,host:os.hostname(),phase,current,browsing,cities,network,state:await qa.state().catch(()=>({}))},null,2));await qa.screenshot('live-usbf-failure.png').catch(()=>{});throw error;}
 finally{for(const controller of controllers)controller.abort();await p.unroute(pattern,route);}
};
