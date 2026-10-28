/* Read current public USBF tiles, never a bundled national snapshot. */
import './usbf-source.js?v=0.6';
import {parquetMetadataAsync,parquetReadObjects} from './vendor/hyparquet-1.31.5/index.js';
import {wkbToGeojson} from './vendor/hyparquet-1.31.5/wkb.js';
import {decompress} from './vendor/fzstd-0.1.1.js';
const api=globalThis.PortalUSBF,budget=32*1024*1024,limit=12000;
self.onmessage=async e=>{
  let bytes=0;
  try{
    const [w,s,east,n]=api.buffered(e.data.bounds),features=[],seen=new Set();let limited=false;
    for(const tile of e.data.tiles){
      const url=api.tileURL(tile);let etag=null;
      const file={byteLength:tile.bytes,async slice(start,end=tile.bytes){
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>tile.bytes||end<=start)throw Error('Invalid USBF byte range.');
        bytes+=end-start;if(bytes>budget)throw Error('This USBF view needs more than 32 MB. Zoom in and retry.');
        const r=await fetch(url,{headers:{Range:'bytes='+start+'-'+(end-1)},cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(45000)});
        const tag=r.headers.get('etag'),contentRange=r.headers.get('content-range');
        if(r.status===416||(tag&&etag&&tag!==etag)||(contentRange&&Number(contentRange.split('/')[1])!==tile.bytes)){const error=Error('USBF files are being updated. Check for the latest publication and retry.');error.code='RELEASE_CHANGED';throw error;}
        if(r.status!==206){await r.body?.cancel();throw Error('USBF source did not honor byte-range access (HTTP '+r.status+').');}
        if(tag)etag=tag;const b=await r.arrayBuffer();if(b.byteLength!==end-start)throw Error('Incomplete USBF byte range.');return b;
      }};
      const metadata=await parquetMetadataAsync(file,{geoparquet:false});const names=new Set(metadata.schema.map(f=>f.name));
      if(!['geometry','usbf_id','cx','cy'].every(c=>names.has(c)))throw Error('This USBF tile has an unsupported schema.');
      const columns=['geometry',...api.columns.filter(c=>names.has(c))];
      const rows=await parquetReadObjects({file,metadata,geoparquet:false,utf8:false,columns,compressors:{ZSTD:(input,length)=>decompress(input,new Uint8Array(length))},filter:{$and:[{cx:{$gte:w,$lte:east}},{cy:{$gte:s,$lte:n}}]}});
      for(const row of rows){
        if(row.usbf_id===null||row.usbf_id===undefined)throw Error('A published USBF record has no identifier.');const id=String(row.usbf_id);if(seen.has(id))continue;seen.add(id);
        if(features.length===limit){limited=true;break;}
        const b=row.geometry;if(!(b instanceof Uint8Array))throw Error('USBF geometry is not WKB.');
        const geometry=wkbToGeojson({view:new DataView(b.buffer,b.byteOffset,b.byteLength),offset:0});if(!['Polygon','MultiPolygon'].includes(geometry.type))throw Error('USBF contains a non-polygon footprint.');
        features.push(api.normalize(row,geometry));
      }
      if(limited)break;
    }
    self.postMessage({data:{type:'FeatureCollection',features},bytes,limited});
  }catch(error){self.postMessage({error:error.message||'USBF read failed.',code:error.code});}
};
