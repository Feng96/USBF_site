/* Original USBF records are read only for an explicit analytical request. */
import './usbf-source.js?v=1.4';
import {parquetMetadataAsync,parquetReadObjects} from './vendor/hyparquet-1.31.5/index.js';
import {wkbToGeojson} from './vendor/hyparquet-1.31.5/wkb.js';
import {decompress} from './vendor/fzstd-0.1.1.js';

const api=globalThis.PortalUSBF,budget=32*1024*1024,limit=12000;
const cache=new Map(),jobs=new Map();let cacheBytes=0;
const cacheLimit=64*1024*1024;
function remember(key,buffer,etag){
  if(buffer.byteLength>cacheLimit)return;
  if(cache.has(key)){cacheBytes-=cache.get(key).buffer.byteLength;cache.delete(key);}
  cache.set(key,{buffer,etag});cacheBytes+=buffer.byteLength;
  while(cacheBytes>cacheLimit){const key=cache.keys().next().value;cacheBytes-=cache.get(key).buffer.byteLength;cache.delete(key);}
}
function aborted(signal){if(signal.aborted)throw new DOMException('Cancelled.','AbortError');}
self.onmessage=async event=>{
  const request=event.data;
  if(request.type==='cancel'){jobs.get(request.id)?.abort();return;}
  if(request.type==='clear-cache'){cache.clear();cacheBytes=0;return;}
  const id=request.id,controller=new AbortController();jobs.set(id,controller);
  const signal=controller.signal;let bytes=0,networkBytes=0,cacheHits=0;
  try{
    if(!api.validBox(request.bounds)||!Array.isArray(request.tiles)||request.tiles.length>9)throw Error('Choose a smaller area to load original buildings.');
    const [w,s,east,n]=api.buffered(request.bounds),features=[],seen=new Set();let limited=false;
    for(let index=0;index<request.tiles.length;index++){
      aborted(signal);const tile=request.tiles[index],url=api.tileURL(tile);let etag=null;
      const file={byteLength:tile.bytes,async slice(start,end=tile.bytes){
        aborted(signal);
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>tile.bytes||end<=start)throw Error('Invalid USBF byte range.');
        bytes+=end-start;if(bytes>budget)throw Error('This area needs more than 32 MB of original data. Zoom in and retry.');
        const key=url+'|'+start+'|'+end;
        if(cache.has(key)){const result=cache.get(key);if(etag&&result.etag&&etag!==result.etag){const error=Error('Original data changed between cached ranges. Refresh the layer and retry.');error.code='RELEASE_CHANGED';throw error;}if(result.etag)etag=result.etag;cache.delete(key);cache.set(key,result);cacheHits++;return result.buffer;}
        const timeout=AbortSignal.timeout(45000),combined=AbortSignal.any([signal,timeout]);
        const response=await fetch(url,{headers:{Range:'bytes='+start+'-'+(end-1)},credentials:'omit',signal:combined});
        const tag=response.headers.get('etag'),range=response.headers.get('content-range');
        if(response.status===416||(tag&&etag&&tag!==etag)||(range&&Number(range.split('/')[1])!==tile.bytes)){
          await response.body?.cancel();for(const [cachedKey,value] of cache)if(cachedKey.startsWith(url+'|')){cacheBytes-=value.buffer.byteLength;cache.delete(cachedKey);}const error=Error('The source publication changed during this read. Refresh the layer and try again.');error.code='RELEASE_CHANGED';throw error;
        }
        if(response.status!==206){await response.body?.cancel();throw Error('The source could not read this part of the original data (HTTP '+response.status+').');}
        if(tag)etag=tag;const buffer=await response.arrayBuffer();aborted(signal);
        if(buffer.byteLength!==end-start)throw Error('The original building data arrived incomplete. Try again.');
        networkBytes+=buffer.byteLength;remember(key,buffer,tag);return buffer;
      }};
      const metadata=await parquetMetadataAsync(file,{geoparquet:false});aborted(signal);
      const names=new Set(metadata.schema.map(field=>field.name));
      if(!['geometry','usbf_id','cx','cy'].every(name=>names.has(name)))throw Error('This USBF file has an unsupported schema.');
      const columns=['geometry',...api.columns.filter(name=>names.has(name))];
      const rows=await parquetReadObjects({file,metadata,geoparquet:false,utf8:false,columns,compressors:{ZSTD:(input,length)=>decompress(input,new Uint8Array(length))},filter:{$and:[{cx:{$gte:w,$lte:east}},{cy:{$gte:s,$lte:n}}]}});
      aborted(signal);
      for(const row of rows){
        if(row.usbf_id===null||row.usbf_id===undefined)throw Error('An original building record has no identifier.');
        const recordId=String(row.usbf_id);if(request.featureId!==undefined&&recordId!==request.featureId)continue;
        if(seen.has(recordId))continue;seen.add(recordId);
        if(features.length===limit){limited=true;break;}
        const binary=row.geometry;if(!(binary instanceof Uint8Array))throw Error('An original building outline has an unsupported encoding.');
        const geometry=wkbToGeojson({view:new DataView(binary.buffer,binary.byteOffset,binary.byteLength),offset:0});
        if(!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('An original building outline is not a polygon.');
        features.push(api.normalize(row,geometry));
      }
      self.postMessage({id,progress:{done:index+1,total:request.tiles.length}});
      if(limited||request.featureId!==undefined&&features.length)break;
    }
    aborted(signal);self.postMessage({id,data:{type:'FeatureCollection',features},bytes,networkBytes,cacheHits,limited});
  }catch(error){self.postMessage({id,error:error.message||'Original building data could not load.',code:error.code,name:error.name});}
  finally{if(jobs.get(id)===controller)jobs.delete(id);}
};
