/* Production GBA worker lifecycle and range-cache contracts with tiny byte ranges.
   The real parser/provider is exercised separately by the browser acceptance. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const checks=[],messages=[],requests=[],root=path.resolve(__dirname,'..');
const ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);};
const shape={type:'Polygon',coordinates:[[[-77,39],[-76.9999,39],[-77,39.0001],[-77,39]]]};
let tag='release-a',mode='normal',rowsPerGroup=6501,wait;
const ctx={URL,DOMException,AbortController,AbortSignal,Uint8Array,ArrayBuffer,Date,Map,Set,console};ctx.self=ctx;ctx.postMessage=d=>messages.push(d);
ctx.fetch=async(url,options)=>{
 if(String(url).startsWith('./'))return {ok:true,json:async()=>({tiles:[{file:'test.parquet',size:64,bounds:[-80,35,-75,40]}]})};
 const [start,end]=options.headers.Range.slice(6).split('-').map(Number);requests.push({tag,range:options.headers.Range});if(wait)await wait;
 return {status:206,headers:{get:k=>k==='etag'?tag:k==='content-range'?'bytes '+start+'-'+end+'/64':null},arrayBuffer:async()=>new ArrayBuffer(end-start+1)};
};
ctx.parquetMetadataAsync=async file=>{await file.slice(0,4);return {row_groups:[0,1,2].map(i=>({num_rows:rowsPerGroup,columns:[{meta_data:{path_in_schema:['region'],statistics:{min_value:i===2?'CAN':'USA',max_value:i===2?'CAN':'USA',null_count:0}}}]}))};};
ctx.parquetReadObjects=async({file,rowStart,rowEnd})=>{
 const group=rowStart/rowsPerGroup;await file.slice(mode==='fresh-page'?20:4+group*4,mode==='fresh-page'?24:8+group*4);
 return Array.from({length:rowEnd-rowStart},(_,i)=>({source:'osm',id:String(rowStart+i),height:i%2?12:-999,var:0,region:'USA',geometry:shape}));
};
const run=id=>ctx.onmessage({data:{id,bounds:[-77.1,38.9,-76.9,39.1]}}),final=id=>messages.find(d=>d.id===id&&!d.progress);
(async()=>{
 ctx.canSkipRowGroup=(await import(require('url').pathToFileURL(path.join(root,'vendor/hyparquet-1.31.5/filter.js')))).canSkipRowGroup;
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'gba-worker.js'),'utf8').replace(/^import .*;\r?\n/gm,''),ctx);
 await run(1);let r=final(1);
 ok(r.data.features.length===13002&&!r.limited,'GBA completes matching row groups beyond the old 12,000-building cutoff');
 ok(messages.filter(d=>d.id===1&&d.progress).length===2&&messages.find(d=>d.id===1&&d.progress).chunk.length===6501,'GBA streams completed row-group chunks before the final result');
 ok(requests.length===3&&r.bytes===12&&r.data.features.every(f=>f.properties.region==='USA'),'Unrelated-country row groups are pruned with the real statistics filter');
 ok(r.data.features[0].properties.height===-999&&r.data.features[0].properties.height_m===null&&r.data.features[1].properties.height_m===12,'Raw missing-height sentinels remain intact and never become fabricated heights');
 await run(2);r=final(2);ok(r.cacheHits===3&&r.bytes===0&&requests.length===3,'Warm GBA views reuse footer and row-group byte ranges without new network requests');
 tag='release-b';mode='fresh-page';await run(3);ok(final(3).error?.includes('changed')&&!final(3).data,'A changed ETag cannot mix cached metadata with new geometry');
 mode='normal';await run(4);ok(final(4).data.features.length===13002&&final(4).cacheHits===0,'A detected GBA revision invalidates stale ranges before retrying');
 await ctx.onmessage({data:{type:'clear-cache'}});const before=requests.length;await run(5);ok(requests.length===before+3&&final(5).cacheHits===0,'Explicit cache clearing removes retained GBA ranges');
 await ctx.onmessage({data:{type:'clear-cache'}});let release;wait=new Promise(r=>release=r);const stale=run(6);await new Promise(r=>setTimeout(r,10));await ctx.onmessage({data:{type:'cancel',id:6}});release();wait=null;await stale;
 ok(!messages.some(d=>d.id===6),'Cancelled GBA reads cannot post stale progress or a final layer');
 await ctx.onmessage({data:{type:'clear-cache'}});rowsPerGroup=30001;await run(7);r=final(7);ok(r.limited&&r.data.features.length===50000,'The 50,000-record budget remains explicitly partial rather than pretending to cover the view');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
