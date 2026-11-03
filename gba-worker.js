/* Bounded, cancellable GBA range reader. Warm ranges survive camera changes.
   Matching row groups load progressively; source geometry stays unchanged. */
import {parquetMetadataAsync,parquetReadObjects} from './vendor/hyparquet-1.31.5/index.js';
import {canSkipRowGroup} from './vendor/hyparquet-1.31.5/filter.js';
import {decompress} from './vendor/fzstd-0.1.1.js';
const base='https://data.source.coop/tge-labs/globalbuildingatlas-lod1/';
const budget=64*1024*1024,featureLimit=50000,cacheLimit=64*1024*1024;
const cache=new Map(),jobs=new Map();let cacheBytes=0,indexPromise;
function aborted(signal){if(signal.aborted)throw new DOMException('View changed','AbortError');}
function evict(key){const value=cache.get(key);if(value){cacheBytes-=value.buffer.byteLength;cache.delete(key);}}
function forget(url){for(const key of cache.keys())if(key.startsWith(url+'|'))evict(key);}
function remember(key,buffer,etag){
  if(buffer.byteLength>cacheLimit)return;evict(key);cache.set(key,{buffer,etag,at:Date.now()});cacheBytes+=buffer.byteLength;
  while(cacheBytes>cacheLimit)evict(cache.keys().next().value);
}
self.onmessage=async event=>{
  const request=event.data;
  if(request.type==='cancel'){jobs.get(request.id)?.abort();return;}
  if(request.type==='clear-cache'){cache.clear();cacheBytes=0;return;}
  const id=request.id,controller=new AbortController(),signal=controller.signal;jobs.set(id,controller);
  let bytes=0,networkBytes=0,cacheHits=0;const features=[],seen=new Set();
  try{
    if(!Array.isArray(request.bounds)||request.bounds.length!==4||!request.bounds.every(Number.isFinite))throw Error('Choose a valid GBA map view.');
    const [w,s,east,n]=request.bounds;
    if(w>=east||s>=n||w< -180||east>180||s< -85||n>85)throw Error('Choose a valid GBA map view.');
    if(!indexPromise)indexPromise=fetch('./data/sources/gba-usa-index.json',{credentials:'omit'}).then(async response=>{if(!response.ok)throw Error('GBA file index could not load.');return response.json();}).catch(error=>{indexPromise=null;throw error;});
    const index=await indexPromise;aborted(signal);
    const tiles=index.tiles.filter(t=>t.bounds[0]-.01<=east&&t.bounds[2]+.01>=w&&t.bounds[1]-.01<=n&&t.bounds[3]+.01>=s);
    if(tiles.length>4)throw Error('Zoom in to load a smaller GBA view.');
    const filter={$and:[{region:{$eq:'USA'}},{'bbox.xmin':{$lte:east}},{'bbox.xmax':{$gte:w}},{'bbox.ymin':{$lte:n}},{'bbox.ymax':{$gte:s}}]};
    let limited=false;
    files:for(const tile of tiles){
      aborted(signal);const url=base+tile.file;let etag=null;
      const file={byteLength:tile.size,async slice(start,end=tile.size){
        aborted(signal);
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>tile.size||end<=start)throw Error('Invalid GBA byte range.');
        const length=end-start;bytes+=length;
        if(bytes>budget)throw Error('This GBA view exceeds the download limit. Zoom in and retry.');
        const key=url+'|'+start+'|'+end,hit=cache.get(key);
        if(hit&&Date.now()-hit.at>=5*60*1000)evict(key);
        else if(hit){
          if(etag&&hit.etag&&etag!==hit.etag){forget(url);throw Error('GBA files changed. Retry this view.');}
          if(hit.etag)etag=hit.etag;cache.delete(key);cache.set(key,hit);cacheHits++;return hit.buffer;
        }
        const response=await fetch(url,{headers:{Range:'bytes='+start+'-'+(end-1)},signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),credentials:'omit'});
        const tag=response.headers.get('etag'),range=response.headers.get('content-range');
        if(response.status===416||(tag&&etag&&tag!==etag)||(range&&Number(range.split('/')[1])!==tile.size)){
          await response.body?.cancel();forget(url);throw Error('GBA files changed. Retry this view.');
        }
        if(response.status!==206){await response.body?.cancel();throw Error('The GBA provider did not honor byte-range access.');}
        if(tag)etag=tag;const buffer=await response.arrayBuffer();aborted(signal);
        if(buffer.byteLength!==length)throw Error('Incomplete byte range from GBA provider.');
        networkBytes+=buffer.byteLength;remember(key,buffer,tag);return buffer;
      }};
      const metadata=await parquetMetadataAsync(file);aborted(signal);
      const physicalColumns=metadata.row_groups[0]?.columns.map(c=>c.meta_data.path_in_schema.join('.'))||[];
      let rowStart=0;
      for(const group of metadata.row_groups){
        const rowEnd=rowStart+Number(group.num_rows);
        if(canSkipRowGroup({rowGroup:group,physicalColumns,filter})){rowStart=rowEnd;continue;}
        const rows=await parquetReadObjects({file,metadata,rowStart,rowEnd,compressors:{ZSTD:(input,length)=>decompress(input,new Uint8Array(length))},columns:['source','id','height','var','region','geometry'],filter});
        aborted(signal);const chunk=[];
        for(const row of rows){
          if(row.id===null||row.id===undefined)throw Error('A GBA building has no source identifier.');
          const key=row.source+'|'+row.id;if(seen.has(key))continue;seen.add(key);
          if(features.length===featureLimit){limited=true;break;}
          if(!row.geometry||!['Polygon','MultiPolygon'].includes(row.geometry.type))throw Error('GBA geometry could not be decoded.');
          const {geometry,...properties}=row;properties.height_m=Number.isFinite(row.height)&&row.height>0?row.height:null;properties.country_iso=row.region;
          const feature={type:'Feature',geometry,properties};features.push(feature);chunk.push(feature);
        }
        if(chunk.length)self.postMessage({id,progress:true,chunk,bytes:networkBytes});
        if(limited)break files;
        rowStart=rowEnd;
      }
    }
    aborted(signal);self.postMessage({id,data:{type:'FeatureCollection',features},limited,bytes:networkBytes,readBytes:bytes,cacheHits});
  }catch(error){if(!signal.aborted)self.postMessage({id,error:error.message||'GBA query failed.'});}
  finally{jobs.delete(id);}
};
