/* Must run before application modules. The reader has no local-engine authority. */
(function(){
 'use strict';const query=new URLSearchParams(location.search);window.PortalReadOnlyMode=query.get('readonly')==='1';if(!window.PortalReadOnlyMode)return;
 document.documentElement.dataset.usbfReadonly='true';const hash=new URLSearchParams(location.hash.slice(1));window.__USBF_READONLY_NONCE=hash.get('reader')||'';
 // An opaque frame cannot construct a worker directly from an HTTPS URL.
 // Import only the app's known readers into an opaque Blob worker instead.
 // MapLibre's own Blob workers pass through unchanged. The imported module
 // still needs the public host's CORS headers and gains no storage authority.
 if(window.Worker){const NativeWorker=window.Worker,base=new URL('./',location.href),readers=new Set(['usbf-analysis-worker.js','gba-worker.js','import-worker.js','geoparquet-import-worker.js']);window.Worker=class extends NativeWorker{
  constructor(input,options={}){let url,bootstrap;try{url=new URL(String(input),document.baseURI);}catch(_){}if(url&&url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&readers.has(url.pathname.slice(base.pathname.length))){bootstrap=URL.createObjectURL(new Blob([options.type==='module'?'import '+JSON.stringify(url.href)+';':'importScripts('+JSON.stringify(url.href)+');'],{type:'text/javascript'}));}super(bootstrap||input,options);if(bootstrap){const release=()=>URL.revokeObjectURL(bootstrap);this.addEventListener('message',release,{once:true});this.addEventListener('error',release,{once:true});setTimeout(release,60000);}}
 };}
})();
