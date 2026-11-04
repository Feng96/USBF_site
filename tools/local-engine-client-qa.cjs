/* Client lifecycle and credential isolation; the native API is tested separately. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const checks=[],ok=(value,label)=>{assert(value,label);checks.push(label);console.log('PASS',label);};
const source=fs.readFileSync(path.join(__dirname,'../local-engine-client.js'),'utf8');
function client(saved=null,userAgent='Desktop'){
 const memory=new Map(saved?[['usbf-native-session-v1',JSON.stringify(saved)]]:[]),requests=[],events=[];let respond=null;
 const status={workspace:{id:'workspace-one',path:'/chosen/USBF'},runtime:{duckdb:'1.4'},hardware:{cpuThreads:2},capabilities:{}};
 const json=(value,http=200)=>({ok:http<400,status:http,json:async()=>value});
 const context={URL,console,DOMException,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},navigator:{userAgent},sessionStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},document:{hidden:false,addEventListener(){},dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},fetch:async(url,options)=>{requests.push({url,options});if(respond){const result=respond(url,options);if(result)return await result;}if(url.endsWith('/v1/health'))return json({service:'USBF Local Engine',apiVersion:1,version:'0.1.0'});if(url.endsWith('/v1/pair'))return json({token:'secret-tab-token',workspaceId:'workspace-one'});if(url.endsWith('/v1/status'))return json(status);if(url.endsWith('/v1/jobs'))return json({jobs:[]});if(url.endsWith('/v1/unpair'))return json({unpaired:true,jobsKept:true});throw Error('Unexpected request '+url);}};
 vm.createContext(context);vm.runInContext(source,context);return {api:context.PortalNativeEngine,memory,requests,events,context,json,setRespond:value=>respond=value};
}
(async()=>{
 const c=client(),N=c.api;
 ok(c.requests.length===0&&!N.status().paired,'An unpaired page makes no native request');
 await assert.rejects(()=>N.health('https://remote.example'),/127.0.0.1/);ok(c.requests.length===0,'Invalid engine addresses are rejected before a network request');
 await N.pair('123456');
 ok(N.status().connected&&N.status().information.workspace.id==='workspace-one','Pairing reports the real protected status only after a valid public health response');
 const pairing=c.requests.find(r=>r.url.endsWith('/v1/pair'));
 ok(!pairing.options.headers.Authorization&&JSON.parse(pairing.options.body).code==='123456','The public pairing request carries a code without an unrelated bearer token');
 ok(c.memory.get('usbf-native-session-v1').includes('secret-tab-token')&&!JSON.stringify(N.status()).includes('secret-tab-token'),'Only tab session storage receives the pairing token; public status and UI events exclude it');
 await N.jobs();const jobs=c.requests.at(-1);
 ok(jobs.options.headers.Authorization==='Bearer secret-tab-token'&&jobs.options.credentials==='omit'&&jobs.options.redirect==='error','Protected requests use the paired bearer and cannot forward it through redirects or cookies');
 const tileBytes=new Uint8Array([26,0]).buffer;c.setRespond(url=>url.includes('/tiles/')?{ok:true,status:200,arrayBuffer:async()=>tileBytes}:url.endsWith('/query')?c.json({rows:[],total:0}):url.endsWith('/selection')?c.json({selectionId:'snapshot',count:0}):null);
 const tile=await N.resultTile('job-one',17,37486,49729,{selectionId:'snapshot-one'}),tileRequest=c.requests.at(-1);
 ok(tile===tileBytes&&tileRequest.options.headers.Authorization==='Bearer secret-tab-token'&&!tileRequest.url.includes('secret-tab-token')&&tileRequest.url.endsWith('.pbf?selectionId=snapshot-one'),'Binary native tiles use bearer headers while map URLs contain only opaque selection identities');
 await N.queryResult('job-one',{filters:[{field:'original_id',op:'eq',value:'9007199254740993123'}],highlightSelectionId:'snapshot-one'});const query=JSON.parse(c.requests.at(-1).options.body);
 ok(query.filters[0].value==='9007199254740993123'&&query.highlightSelectionId==='snapshot-one','Complete-result queries preserve exact long identifiers and selection membership independently of the page');
 await N.selectResult('job-one',{mode:'replace',scope:{geometry:{type:'Polygon',coordinates:[]},crs:'EPSG:4326'}});
 ok(c.requests.at(-1).options.method==='POST'&&JSON.parse(c.requests.at(-1).options.body).scope.crs==='EPSG:4326','Native selection sends the explicit original-geometry scope to the protected service');
 let cancelledBody=false;c.setRespond(url=>url.includes('/download?')?{ok:true,status:200,headers:{get:key=>key==='content-length'?String(1024**3):'application/octet-stream'},body:{async cancel(){cancelledBody=true;}}}:null);await assert.rejects(()=>N.download('large-job','parquet'),/too large/);ok(cancelledBody,'A result beyond the browser fallback budget cancels its response stream instead of holding a native download open');
 let resolveOld;c.setRespond(url=>url.endsWith('/v1/status')?new Promise(resolve=>{resolveOld=resolve;}):null);const old=N.refresh();await Promise.resolve();const disconnect=N.unpair();
 ok(!N.status().paired&&!c.memory.has('usbf-native-session-v1'),'Disconnect forgets credentials immediately while token revocation is in flight');
 resolveOld(c.json({workspace:{id:'stale-workspace'}}));await old;await disconnect;
 ok(!N.status().connected&&N.status().information===null,'A stale status response cannot reconnect an unpaired tab');
 ok(c.requests.some(r=>r.url.endsWith('/v1/unpair')&&r.options.headers.Authorization==='Bearer secret-tab-token'),'Disconnect revokes the current engine token while keeping native jobs independent');
 c.setRespond(null);await N.pair('123456');c.setRespond(url=>url.endsWith('/v1/jobs')?c.json({error:'Expired token'},401):null);await assert.rejects(()=>N.jobs(),/Expired token/);
 ok(!N.status().paired&&!c.memory.has('usbf-native-session-v1'),'An unauthorized protected response clears the matching tab credential');
 const m=client({endpoint:'http://127.0.0.1:52763',token:'old-token'},'iPhone');await assert.rejects(()=>m.api.pair('123456'),/desktop computer/);
 ok(m.api.status().supported===false&&m.requests.length===0,'Mobile devices get an explicit browser fallback and do not auto-connect a saved desktop engine');
 const translations={window:{}};vm.createContext(translations);for(const file of ['i18n-zh.js','i18n-tasks-zh.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),translations);
 const zh=translations.window.PortalTranslations['zh-CN'];ok(zh['Task center']==='任务中心'&&zh['Resume failed parts']==='继续失败分块'&&!zh.GeoParquet&&!zh.height_m,'Task interface Chinese is supplied without translating source fields or formats');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
