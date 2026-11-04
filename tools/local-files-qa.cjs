/* Filesystem behavior against in-memory directory handles: permissions, copies,
   project identity, bounded cache and untrusted sibling files. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{webcrypto}=require('crypto'),{File}=require('buffer');
let clock=1000;
const error=n=>Object.assign(Error(n),{name:n});
class Directory{
 constructor(name){this.name=name;this.kind='directory';this.children=new Map();this.permission='granted';this.requested=0;}
 async queryPermission(){return this.permission;}
 async requestPermission(){this.requested++;this.permission='granted';return this.permission;}
 async getDirectoryHandle(n,o={}){if(this.children.has(n)){const v=this.children.get(n);if(v.kind!=='directory')throw error('TypeMismatchError');return v;}if(!o.create)throw error('NotFoundError');const d=new Directory(n);this.children.set(n,d);return d;}
 async getFileHandle(n,o={}){if(this.children.has(n)){const v=this.children.get(n);if(v.kind!=='file')throw error('TypeMismatchError');return v;}if(!o.create)throw error('NotFoundError');const h=new FileHandle(n);this.children.set(n,h);return h;}
 async *entries(){yield* this.children.entries();}
 async removeEntry(n){const h=this.children.get(n);if(!h)throw error('NotFoundError');if(h.kind==='directory')throw error('InvalidModificationError');this.children.delete(n);}
}
class FileHandle{
 constructor(name,content='',size=null){this.name=name;this.kind='file';this.content=new Blob([content]);this.modified=++clock;this.size=size;}
 async getFile(){const f=new File([this.content],this.name,{lastModified:this.modified,type:this.content.type});if(this.size!==null)Object.defineProperty(f,'size',{value:this.size});return f;}
 async createWritable(){const h=this;let staged;return {async write(v){if(h.failWrite)throw error('QuotaExceededError');staged=v;},async close(){h.content=staged instanceof Blob?staged:new Blob([typeof staged==='string'?staged:'virtual']);h.size=staged?.virtualSize??null;h.modified=++clock;if(h.onClose)h.onClose();},async abort(){}};}
}
function fakeIDB(){
 const data=new Map();let upgraded=false;
 const db={createObjectStore(){},close(){},transaction(){
  const tx={objectStore(){return {get:k=>({result:data.get(k)}),put:(v,k)=>{data.set(k,v);return {result:k};},delete:k=>{data.delete(k);return {};}};}};
  setTimeout(()=>tx.oncomplete?.(),0);return tx;
 }};
 return {data,open(){const r={};setTimeout(()=>{r.result=db;if(!upgraded){upgraded=true;r.onupgradeneeded?.();}r.onsuccess?.();},0);return r;}};
}
const source=fs.readFileSync(path.join(__dirname,'../local-files.js'),'utf8');
function create(rootDir,idb=fakeIDB()){
 const events=[],ctx={console,Blob,File,TextEncoder,setTimeout,clearTimeout,crypto:webcrypto,indexedDB:idb,navigator:{},document:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,v){this.type=type;this.detail=v?.detail;}},showDirectoryPicker:async()=>rootDir};ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return {api:ctx.PortalLocalFiles,events,ctx,idb};
}
const checks=[],ok=(v,m)=>{assert(v,m);checks.push(m);console.log('PASS',m);},id='3be56fc8-056d-47e5-b8e9-a4d4126f91d1';
const json=rev=>JSON.stringify({format:'USBF map',version:1,name:'My project',projectInfo:{id,revision:rev},layers:[]});
(async()=>{
 const dir=new Directory('USBF'),unrelated=await dir.getFileHandle('private.txt',{create:true});await(await unrelated.createWritable()).write('untouched');const c=create(dir),A=c.api;await A.ready();ok(!A.status().connected&&dir.requested===0,'Loading local storage never prompts for filesystem permission');
 await A.chooseRoot();ok(A.status().connected&&JSON.stringify(Object.keys(A.status().folders))===JSON.stringify(['Projects','Results','Cache','Files','Engine']),'An explicitly selected parent contains all five sibling workspace folders');
 ok((await A.list()).entries.length===5&&dir.children.has('private.txt'),'The root browser exposes workspace folders while preserving unrelated parent files');
 const first=await A.importFile(new File(['original'],'houses.geojson')),second=await A.importFile(new File(['second'],'houses.geojson'));ok(first.name==='houses.geojson'&&second.name==='houses (2).geojson'&&await(await A.getFile(first.path)).text()==='original','Import collisions create a distinct file without overwriting the original');
 const multi=await Promise.all([A.importFile(new File(['a'],'simultaneous.json')),A.importFile(new File(['b'],'simultaneous.json'))]);ok(multi[0].name!==multi[1].name,'Concurrent writes inside the app remain collision-safe');
 await A.mkdir(['Files','Region']);const nested=await A.importFile(new File(['x'],'part.geojson'),['Files','Region']);ok(JSON.stringify(nested.path)==='["Files","Region","part.geojson"]','File imports support user-created subdirectories inside Files');
 for(const p of [['Files','..','outside.json'],['Projects','__proto__'],['Results','a/b'],['Outside','a'],['Files','CON']])await assert.rejects(A.getFile(p));ok(true,'Traversal, unsupported roots and reserved path names are rejected');
 await assert.rejects(A.mkdir(['Engine','packages']));await assert.rejects(A.deleteFile(['Engine','runtime.dll']));await assert.rejects(A.rename(['Engine','runtime.dll'],'other.dll'));ok(true,'The browser cannot modify native-engine directories');
 await assert.rejects(A.mkdir(['Cache','native-jobs','checkpoint']));await assert.rejects(A.deleteFile(['Cache','native-jobs','part.parquet']));await assert.rejects(A.rename(['Cache','native-jobs','part.parquet'],'changed.parquet'));ok(true,'Native checkpoints stay protected at the filesystem API boundary');
 const projects=await dir.getDirectoryHandle('Projects'),foreign=await projects.getFileHandle(id+'.usbf.json',{create:true});await(await foreign.createWritable()).write('foreign'); // deliberately not closed: no simulated bytes were committed
 foreign.content=new Blob(['foreign']);foreign.modified=++clock;
 const project=await A.saveProject({id,name:'My project',json:json(1)});ok(project.name===id+'-2.usbf.json'&&await foreign.getFile().then(f=>f.text())==='foreign','Stable project saving validates identity before replacing existing filenames');
 const updated=await A.saveProject({id,name:'My project',json:json(2)});ok(updated.name===project.name&&(await(await A.getFile(updated.path)).text())===json(2),'Saving a newer revision updates the same owned project file');
 await assert.rejects(A.saveProject({id,name:'My project',json:json(1)}),e=>e.code==='LOCAL_PROJECT_CONFLICT');ok(true,'An older tab cannot replace a newer local project revision');
 const snapshot=await A.saveProject({id,name:'My project',json:json(2)+' ',snapshot:true});ok(snapshot.name.includes('-snapshot-')&&snapshot.name!==updated.name,'Explicit project snapshots create separate files without overwriting stable saved revisions');
 const renamed=await A.rename(first.path,'renamed.geojson');ok(await(await A.getFile(renamed.path)).text()==='original','File rename preserves original bytes through copy-before-delete');await assert.rejects(A.getFile(first.path));
 await assert.rejects(A.rename(renamed.path,second.name));ok(await(await A.getFile(second.path)).text()==='second','Rename collisions preserve the destination and source');
 const renamedHandle=await(await dir.getDirectoryHandle('Files')).getFileHandle('renamed.geojson'),files=await dir.getDirectoryHandle('Files');const destination=await files.getFileHandle('failed.geojson',{create:true});destination.failWrite=true;await assert.rejects(A.rename(renamed.path,'failed.geojson'));ok(await(await A.getFile(renamed.path)).text()==='original','An unsuccessful rename never removes its original file');
 const result=await A.writeResult('map.geojson',new Blob(['result']));const cache=await A.writeCache('USBF-release|boundary-a',new Blob(['cache'],{type:'application/geo+json'}),{name:'Area A',format:'geojson'});const inv=await A.cacheInventory();ok(inv.files===1&&inv.bytes===5&&inv.entries[0].metadata.name==='Area A'&&Array.isArray(cache.path),'Owned cache inventory includes byte totals, safe relative paths and original metadata');
 const listing=await A.list(['Cache','browser-v1']);ok(listing.entries.some(e=>e.name===cache.name&&e.managedCache&&e.mime==='application/geo+json'),'File browsing identifies cache entries only after ownership validation');
 const cacheDir=await(await dir.getDirectoryHandle('Cache')).getDirectoryHandle('browser-v1'),foreignCache=await cacheDir.getFileHandle('user-notes.usbf-cache',{create:true});foreignCache.content=new Blob(['my data']);foreignCache.modified=++clock;
 const indexHandle=await cacheDir.getFileHandle('usbf-cache-index.json'),validIndex=await(await indexHandle.getFile()).text(),tampered=JSON.parse(validIndex);tampered.entries[Object.keys(tampered.entries)[0]].file='user-notes.usbf-cache';indexHandle.content=new Blob([JSON.stringify(tampered)]);indexHandle.modified=++clock;await assert.rejects(A.clearCache(),/index changed/);ok(cacheDir.children.has('user-notes.usbf-cache'),'A tampered cache ownership index cannot erase user files');indexHandle.content=new Blob([validIndex]);indexHandle.modified=++clock;
 const cacheHandle=await cacheDir.getFileHandle(cache.name);cacheHandle.content=new Blob(['user replacement']);cacheHandle.modified=++clock;const preserved=await A.clearCache();ok(preserved.skipped===1&&cacheDir.children.has(cache.name),'Cache cleanup preserves files changed outside USBF');
 const other=await A.writeCache('USBF-release|boundary-b',new Blob(['cleanable']));const clear=await A.clearCache();ok(clear.deleted===1&&!cacheDir.children.has(other.name)&&cacheDir.children.has('user-notes.usbf-cache')&&await(await A.getFile(result.path)).text()==='result'&&await(await A.getFile(updated.path)).text()===json(2),'Clear cache deletes owned entries while keeping user cache files, projects and results');
 await assert.rejects(A.writeCache('too-large',{size:257*1024*1024}),/256 MiB/);ok(true,'An oversized cache entry fails before creating files');
 const virtual={size:200*1024*1024,virtualSize:200*1024*1024,type:'application/octet-stream'};await A.writeCache('large-virtual',virtual);await assert.rejects(A.writeCache('over-total',{size:100*1024*1024,virtualSize:100*1024*1024}),/budget/);ok(true,'Aggregate owned cache writes cannot exceed the disk-cache budget');
 dir.permission='prompt';await assert.rejects(A.list(),e=>e.code==='LOCAL_PERMISSION');ok(dir.requested===0,'Expired access causes a clear error without an implicit permission prompt');await A.reconnect();ok(dir.requested===1&&A.status().connected,'Only explicit reconnect requests renewed access');
 const restored=create(dir,c.idb);dir.permission='prompt';await restored.api.ready();ok(!restored.api.status().connected&&restored.api.status().rootName==='USBF'&&dir.requested===1,'Restored directory handles query access without prompting on page load');
 dir.permission='granted';await A.disconnect();ok(!A.status().connected&&files.children.has('renamed.geojson')&&projects.children.has(updated.name),'Disconnect forgets the active handle and never deletes disk contents');
 ok(c.events.some(e=>e.type==='portal-local-files-changed'),'Successful local changes publish an update event for settings and Project UI');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
