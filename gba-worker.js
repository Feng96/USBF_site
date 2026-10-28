/* Read the verified 2025 GeoParquet mirror using bbox statistics and HTTP ranges.
   No full-file download, WFS calls, proxy service, or nationwide browser scan. */
import {parquetMetadataAsync,parquetReadObjects} from './vendor/hyparquet-1.31.5/index.js';
import {decompress} from './vendor/fzstd-0.1.1.js';
const base='https://data.source.coop/tge-labs/globalbuildingatlas-lod1/';
const budget=32*1024*1024,featureLimit=12000;
let bytes=0;
async function range(url,start,end){
  if(bytes+end-start>budget)throw Error('This view needs more than 32 MB. Zoom in and retry.');
  bytes+=end-start;
  const r=await fetch(url,{headers:{Range:'bytes='+start+'-'+(end-1)},signal:AbortSignal.timeout(45000),credentials:'omit'});
  if(r.status!==206){await r.body?.cancel();throw Error('The source did not honor byte-range access.');}
  const buffer=await r.arrayBuffer();if(buffer.byteLength!==end-start)throw Error('Incomplete byte range from GBA provider.');return buffer;
}
self.onmessage=async e=>{
  try{
    bytes=0;const [w,s,east,n]=e.data.bounds;
    const response=await fetch('./data/sources/gba-usa-index.json');if(!response.ok)throw Error('GBA file index could not load.');
    const index=await response.json(),tiles=index.tiles.filter(t=>t.bounds[0]-.01<=east&&t.bounds[2]+.01>=w&&t.bounds[1]-.01<=n&&t.bounds[3]+.01>=s);
    if(tiles.length>4)throw Error('Zoom in to load a smaller GBA view.');
    const features=[],seen=new Set();let limited=false;
    for(const tile of tiles){
      const url=base+tile.file,file={byteLength:tile.size,slice:(a,b=tile.size)=>range(url,a,b)};
      const metadata=await parquetMetadataAsync(file);
      const rows=await parquetReadObjects({file,metadata,compressors:{ZSTD:(input,length)=>decompress(input,new Uint8Array(length))},columns:['source','id','height','var','region','geometry'],filter:{$and:[{region:'USA'},{'bbox.xmin':{$lte:east}},{'bbox.xmax':{$gte:w}},{'bbox.ymin':{$lte:n}},{'bbox.ymax':{$gte:s}}]}});
      for(const row of rows){
        const k=row.source+'|'+row.id;if(seen.has(k))continue;seen.add(k);
        if(features.length===featureLimit){limited=true;break;}
        if(!row.geometry||!['Polygon','MultiPolygon'].includes(row.geometry.type))throw Error('GBA geometry could not be decoded.');
        const {geometry,...properties}=row;properties.height_m=Number.isFinite(row.height)&&row.height>0?row.height:null;properties.country_iso=row.region;
        features.push({type:'Feature',geometry,properties});
      }
      if(limited)break;
    }
    self.postMessage({data:{type:'FeatureCollection',features},limited,bytes});
  }catch(e){self.postMessage({error:e.message||'GBA query failed.'});}
};
