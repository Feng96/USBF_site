/* Exact source-manifest snapshots and explicit latest/pinned connection policy. */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 const SITE='https://feng96.github.io/USBF_site/',PUBLIC='https://data.source.coop/opengeos/us-buildings/',sourceId='usbf-live',catalogURL='data/releases.json';
 const fail=text=>{throw Error(text);},cache=new Map();let catalogPromise;
 function validateRef(value){
  if(!object(value)||Object.keys(value).some(k=>!['version','sourceId','policy','releaseId','manifestSha256','displaySha256','snapshotUrl','displayManifestUrl'].includes(k))||value.version!==1||value.sourceId!==sourceId||!['latest','pinned'].includes(value.policy))fail('The data release reference is invalid.');
  if(value.policy==='pinned'&&(!/^[a-zA-Z0-9._-]{1,150}$/.test(value.releaseId||'')||!hex(value.manifestSha256)||!hex(value.displaySha256)))fail('The pinned data release is missing its identity or checksums.');
  return clone(value);
 }
 function coherent(raw,display,manifestHash){
  const r=display?.source_release;
  if(!raw||!display||display.source_manifest_sha256!==manifestHash||r?.name!==raw.release||r.updated!==raw.updated_utc||r.buildings!==raw.buildings||r.tiles!==raw.tiles||display.input_buildings!==raw.buildings||display.partial_display===true||display.benchmark===true)fail('The display map and original records do not belong to the same data release.');
  return true;
 }
 function bounds(value){if(!Array.isArray(value)||value.length!==4||!value.every(Number.isFinite)||value[0]>=value[2]||value[1]>=value[3]||Math.abs(value[0])>180||Math.abs(value[2])>180||Math.abs(value[1])>90||Math.abs(value[3])>90)fail('Choose a valid data loading boundary.');return value;}
 const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 async function digest(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}
 function publicURL(value){const url=new URL(value,root.document?.baseURI||'https://feng96.github.io/USBF_site/');if(url.protocol!=='https:'&&url.origin!==new URL(root.document?.baseURI||'https://feng96.github.io').origin||url.username||url.password)fail('Release dependencies need public addresses without credentials.');return url.href;}
 async function read(url,{signal,hash,text=false}={}){const timeout=AbortSignal.timeout(30000),response=await root.fetch(publicURL(url),{credentials:'omit',cache:'no-cache',signal:signal?AbortSignal.any([signal,timeout]):timeout});if(!response.ok)fail('A required data release dependency is unavailable (HTTP '+response.status+').');const bytes=await response.arrayBuffer();if(bytes.byteLength>20*1024*1024)fail('The release manifest is too large.');const sha256=await digest(bytes);if(hash&&sha256!==hash)fail('A pinned data release dependency changed. The current map was kept.');const content=new TextDecoder().decode(bytes);return {value:text?content:JSON.parse(content),sha256};}
 async function catalog(){if(!catalogPromise)catalogPromise=read(catalogURL).then(({value})=>{if(value.schema!==1||!Array.isArray(value.releases)||value.releases.length>1000)fail('The data release catalog is invalid.');return value.releases;}).catch(error=>{catalogPromise=null;throw error;});return catalogPromise;}
 function source(entry,manifest,ref){return {kind:'usbf',id:sourceId,manifestUrl:ref.policy==='pinned'?(ref.snapshotUrl||new URL(entry.original.url,SITE).href):entry.original.sourceUrl,baseUrl:entry.original.baseUrl,releaseId:ref.releaseId,manifestSha256:ref.manifestSha256,releaseRef:clone(ref),crs:entry.crs||'EPSG:4326',licenses:clone(entry.rights?.components||[]),rights:clone(entry.rights||{}),files:manifest.tiles.map(tile=>({...clone(tile),url:entry.original.baseUrl+encodeURIComponent(tile.path)+'?v='+tile.sha256}))};}
 async function fromEntry(entry,{signal}={}){
  const key=entry.id+'|'+entry.original.sha256;if(cache.has(key))return clone(await cache.get(key));
  const pending=(async()=>{const [raw,display,schema,rights]=await Promise.all([read(entry.original.url,{signal,hash:entry.original.sha256}),read(entry.display.url,{signal,hash:entry.display.sha256}),entry.schema?read(entry.schema.url,{signal,hash:entry.schema.sha256}):null,entry.rights?.snapshotUrl?read(entry.rights.snapshotUrl,{signal,hash:entry.rights.sha256,text:true}):null]);coherent(raw.value,display.value,raw.sha256);if(schema&&(schema.value.crs!==raw.value.crs||raw.value.files.find(f=>f.path==='schema.json')?.sha256!==schema.sha256)||rights&&raw.value.files.find(f=>f.path==='LICENSES.md')?.sha256!==rights.sha256)fail('Release documentation does not match the original publication.');const manifest=root.PortalUSBF.parseManifest(raw.value),map=root.PortalUSBF.parseDisplay(display.value);const ref={version:1,sourceId,policy:'pinned',releaseId:entry.id,manifestSha256:raw.sha256,displaySha256:display.sha256,snapshotUrl:new URL(entry.original.url,SITE).href,displayManifestUrl:new URL(entry.display.url,SITE).href};return {ref,manifest,display:map,entry:clone(entry),schema:schema?.value||null,rightsText:rights?.value||null,source:source(entry,manifest,ref)};})();cache.set(key,pending);try{return clone(await pending);}catch(error){cache.delete(key);throw error;}
 }
 async function resolve(value,{signal,pin=false}={}){
  const layer=value?.cfg?value:null,requested=layer?.cfg.releaseRef||value?.releaseRef||value;
  if(requested?.sourceId&&requested.sourceId!==sourceId||layer&&layer.cfg.driver!=='usbf'&&layer.cfg.id!==sourceId)fail('This source has no reproducible USBF release reference. Save a fixed workset to preserve its records.');
  const releases=await catalog();
  if(requested?.policy==='pinned'){
   const ref=validateRef(requested),entry=releases.find(r=>r.id===ref.releaseId&&r.sourceId===sourceId);if(!entry)fail('The pinned data release is not available in this site.');if(entry.original.sha256!==ref.manifestSha256||entry.display.sha256!==ref.displaySha256)fail('The pinned data release checksums do not match the catalog.');return fromEntry(entry,{signal});
  }
  const shown=layer?.displayRelease||layer?.analysisRelease||layer?.release,archive=layer?.usbfConnection?.display;
  const matching=shown&&releases.find(r=>r.sourceId===sourceId&&r.release.updated===shown.updated&&r.release.buildings===shown.buildings&&(!archive||r.display.archiveSha256===archive.sha256));
  if(pin&&matching)return fromEntry(matching,{signal});
  const [raw,display]=await Promise.all([read(PUBLIC+'USBF_v1/manifest.json',{signal}),read(PUBLIC+'USBF_display/manifest.json',{signal})]);coherent(raw.value,display.value,raw.sha256);
  const existing=releases.find(r=>r.original.sha256===raw.sha256&&r.display.sha256===display.sha256);
  if(existing){const result=await fromEntry(existing,{signal});if(!pin){result.ref.policy='latest';result.source.releaseRef.policy='latest';result.source.manifestUrl=existing.original.sourceUrl;}return result;}
  // A new upstream release remains usable as latest, but cannot pretend that a
  // mutable URL has become a permanent snapshot merely by recording its hash.
  if(pin)fail('This source release has not been archived by the site yet. Save a fixed workset, or explicitly follow the latest source.');
  const manifest=root.PortalUSBF.parseManifest(raw.value),map=root.PortalUSBF.parseDisplay(display.value),entry={id:'usbf-live-'+raw.sha256.slice(0,12),sourceId,original:{sourceUrl:PUBLIC+'USBF_v1/manifest.json',baseUrl:PUBLIC+'USBF_v1/'},crs:'EPSG:4326',rights:{components:[],statement:'Component terms are not archived for this newer publication. Retain per-record notices and review its current source documentation before redistribution.',licenseUrl:PUBLIC+'USBF_v1/LICENSES.md',persistentIdentifier:null}},ref={version:1,sourceId,policy:'latest',releaseId:entry.id,manifestSha256:raw.sha256,displaySha256:display.sha256};return {ref,manifest,display:map,entry,source:source(entry,manifest,ref)};
 }
 async function pin(layer,options={}){const result=await resolve(layer,{...options,pin:true});if(layer?.cfg){layer.cfg.releaseRef=clone(result.ref);if(layer.clearCache)layer.clearCache();else layer.cancelAnalysis?.();layer.releaseRef=clone(result.ref);root.document?.dispatchEvent(new root.CustomEvent('portal-release-changed',{detail:{layerId:layer.id,ref:clone(result.ref)}}));}return result;}
 async function sourcesForBounds(value,box,options={}){bounds(box);const result=await resolve(value,options),files=result.source.files.filter(file=>intersects(file.bbox,box)),descriptor={...result.source,files};return {ref:result.ref,source:descriptor,estimate:{files:files.length,sourceRows:files.reduce((n,f)=>n+f.rows,0),sourceBytes:files.reduce((n,f)=>n+f.bytes,0),exact:false,meaning:'Source rows and bytes in intersecting shards; exact matching record count is determined by processing.'}};}
 const api={validateRef,coherent,bounds,digest,resolve,pin,sourcesForBounds,verify:resolve,ref:layer=>clone(layer?.cfg?.releaseRef||{version:1,sourceId,policy:'latest'}),catalog,clear(){cache.clear();catalogPromise=null;}};
 root.PortalReleases=api;
})(globalThis);
