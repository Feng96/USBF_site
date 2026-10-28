/* Run the production worker range-cache code with a four-byte Parquet reader. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),checks=[];
const ok=(value,message)=>{assert(value,message);checks.push(message);console.log('PASS',message);};
const messages=[],requests=[];let tag='"release-a"',mode='initial';
const tile={path:'USBF_x-154_y+78.parquet',bytes:16,sha256:'a'.repeat(64)},polygon={type:'Polygon',coordinates:[[[-77,39],[-76.99,39],[-77,39.01],[-77,39]]]};
const ctx={URL,DOMException,AbortController,AbortSignal,Uint8Array,ArrayBuffer,DataView,Map,Set,console,PortalUSBF:{validBox:()=>true,buffered:box=>box,tileURL:()=> 'https://example.org/versioned.parquet?v='+tile.sha256,columns:['usbf_id','cx','cy'],normalize:(row,geometry)=>({type:'Feature',properties:{usbf_id:row.usbf_id,cx:row.cx,cy:row.cy},geometry})},parquetMetadataAsync:async file=>{await file.slice(0,4);return {schema:['geometry','usbf_id','cx','cy'].map(name=>({name}))};},parquetReadObjects:async({file})=>{await file.slice(mode==='new-range'?8:4,mode==='new-range'?12:8);return [{usbf_id:'building-1',cx:-77,cy:39,geometry:new Uint8Array(4)}];},wkbToGeojson:()=>polygon,decompress(){throw Error('No compressed pages in the range-cache contract');},fetch:async(url,options)=>{const [start,end]=options.headers.Range.slice(6).split('-').map(Number);requests.push({tag,range:options.headers.Range});return {status:206,headers:{get:key=>key==='etag'?tag:key==='content-range'?'bytes '+start+'-'+end+'/16':null},arrayBuffer:async()=>new ArrayBuffer(end-start+1),body:{cancel:async()=>{}}};}};
ctx.globalThis=ctx;ctx.self={postMessage:message=>messages.push(message)};vm.createContext(ctx);
const worker=fs.readFileSync(path.join(__dirname,'../usbf-analysis-worker.js'),'utf8').replace(/^import .*;\r?\n/gm,'');vm.runInContext(worker,ctx,{filename:'usbf-analysis-worker.js'});
const run=id=>ctx.self.onmessage({data:{id,bounds:[-77.01,38.99,-76.99,39.01],tiles:[tile]}}),result=id=>messages.find(message=>message.id===id&&!message.progress);
(async()=>{
 await run(1);ok(result(1).data.features[0].properties.usbf_id==='building-1'&&requests.length===2,'An explicit worker read normalizes an original record and caches only the requested byte ranges');
 await run(2);ok(result(2).cacheHits===2&&result(2).networkBytes===0&&requests.length===2,'A repeat original read reuses immutable byte ranges without a new network read');
 tag='"release-b"';mode='new-range';await run(3);
 ok(result(3).code==='RELEASE_CHANGED'&&!result(3).data&&requests.length===3,'A cached old footer plus a new ETag page fails closed instead of mixing publication revisions');
 mode='initial';await run(4);
 ok(result(4).data.features.length===1&&requests.length===5&&result(4).cacheHits===0,'A detected revision invalidates that file’s cached ranges so the next read starts consistently');
 await ctx.self.onmessage({data:{type:'clear-cache'}});await run(5);
 ok(result(5).cacheHits===0&&requests.length===7,'Explicit byte-cache clearing removes the retained ranges');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
