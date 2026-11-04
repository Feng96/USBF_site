/* The wrapper transfers a frozen map into an opaque-origin reader frame. */
(function(root){
 'use strict';
 function shell(base,map){
  const frame=document.querySelector('#shared-frame'),status=document.querySelector('#shared-status'),title=document.querySelector('#shared-title');
  const zh=map?.interfaceLanguage==='zh-CN',t=v=>zh?({'Loading shared map…':'正在加载共享地图…','Read-only · changes here do not edit the publisher’s Project.':'只读查看 · 此处的操作不会修改发布者的 Project。','The online renderer is taking longer than expected. This shared file requires internet access.':'在线地图加载时间较长；此共享文件需要联网。'})[v]||v:v;const random=new Uint8Array(24);crypto.getRandomValues(random);const nonce=Array.from(random,v=>v.toString(16).padStart(2,'0')).join('');
  title.textContent=map?.title||'Shared USBF map';document.title=title.textContent+' · USBF';
  const url=new URL(base);if(!['https:','http:'].includes(url.protocol))throw Error('The map renderer URL is invalid.');url.search='?readonly=1&empty=1';url.searchParams.set('lang',map?.interfaceLanguage||'en');url.hash='reader='+nonce;
  const timer=setTimeout(()=>{status.textContent=t('The online renderer is taking longer than expected. This shared file requires internet access.');},30000);
  window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.nonce!==nonce)return;
   if(event.data.type==='usbf-reader-ready'){status.textContent=t('Loading shared map…');frame.contentWindow.postMessage({type:'usbf-reader-map',version:1,nonce,map},'*');}
   if(event.data.type==='usbf-reader-loaded'){clearTimeout(timer);status.textContent=t('Read-only · changes here do not edit the publisher’s Project.');status.classList.remove('error');}
   if(event.data.type==='usbf-reader-error'){clearTimeout(timer);status.textContent=event.data.message;status.classList.add('error');}
  });
  frame.setAttribute('sandbox','allow-scripts');frame.src=url.href;
 }
 root.PortalSharedShell={start:shell};
 if(root.document?.currentScript?.dataset.autoload!==undefined){
  const base=new URL('./',document.currentScript.src).href;
  (async()=>{try{const encoded=new URLSearchParams(location.hash.slice(1)).get('map');if(!encoded)throw Error('This shared map link contains no map.');const map=await PortalShareCore.decode(encoded);shell(base,map);}catch(error){document.querySelector('#shared-status').textContent=error.message;document.querySelector('#shared-status').classList.add('error');}})();
 }
})(globalThis);
