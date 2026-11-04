/* Optional disk snapshots. Renderer/worker memory caches remain separate. */
(function(root){
'use strict';const pref='usbf-cache-analysis-snapshots-v1';let enabled=false,lastError='',lastSaved=null;
try{enabled=localStorage.getItem(pref)==='true';}catch(_){}
function emit(){document.dispatchEvent(new CustomEvent('portal-local-cache-changed'));}
function setEnabled(value){enabled=!!value;try{localStorage.setItem(pref,String(enabled));}catch(_){}emit();}
async function store(layer){
 if(!enabled)return null;await root.PortalLocalFiles.ready();if(!root.PortalLocalFiles.status().connected)return null;
 try{
  if(!root.PortalDataWorkspace.ready(layer))throw Error('Only fixed analysis snapshots can be cached on disk.');
  const data=layer.data,json=JSON.stringify(data),blob=new Blob([json],{type:'application/geo+json'});if(blob.size>64*1024*1024)throw Error('This analysis snapshot exceeds the 64 MiB disk-cache file budget.');
  const p=data.provenance||{},context=JSON.stringify([p.workspaceWorkset?.sourceId||layer.cfg.name,p.release?.updated||null,p.range?.geometry||p.workspaceWorkset?.area?.geometry||null]);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(context)),key=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  lastSaved=await root.PortalLocalFiles.writeCache(key,blob,{kind:'analysis-snapshot',format:'GeoJSON',name:layer.cfg.name,records:data.features.length,createdAt:new Date().toISOString()});lastError='';emit();return lastSaved;
 }catch(e){lastError=e.message;emit();throw e;}
}
async function open(path){
 if(!Array.isArray(path)||path[0]!=='Cache'||path[1]!=='browser-v1'||!path.at(-1).endsWith('.usbf-cache'))throw Error('Choose a managed analysis snapshot.');
 const file=await root.PortalLocalFiles.getFile(path);if(file.size>64*1024*1024)throw Error('This cache snapshot is too large.');
 const text=await file.text(),data=JSON.parse(text);if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('This is not an analysis snapshot.');
 return root.PortalImport.importData({file:new File([text],path.at(-1)+'.geojson',{type:'application/geo+json'}),name:'Cached analysis snapshot',type:'geojson',crs:'EPSG:4326'});
}
root.PortalLocalCache={setEnabled,store,open,get enabled(){return enabled;},get lastError(){return lastError;},get lastSaved(){return lastSaved;}};
})(globalThis);
