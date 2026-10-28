/* ZIP parsing is isolated from map interaction and bounded before transfer. */
self.onmessage=async e=>{try{if(e.data.type!=='shapefile')throw Error('Unsupported import operation.');importScripts('./vendor/shp-6.2.0.js');const result=await self.shp(e.data.buffer);self.postMessage({result});}catch(error){self.postMessage({error:error.message||'Shapefile parsing failed.'});}};
