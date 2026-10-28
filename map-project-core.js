/* Portable map files contain original records, source connections and model files. */
(function(root){
  'use strict';
  const limits=Object.freeze({file:80*1024*1024,attachments:48*1024*1024,asset:32*1024*1024,layers:24,models:3});
  const fail=s=>{throw Error(s);},object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const string=(v,max=1000)=>typeof v==='string'&&v.length<=max;
  function https(v){let u;try{u=new URL(v);}catch(e){fail('A saved source has an invalid web address.');}if(u.protocol!=='https:'||u.username||u.password)fail('Saved sources need public HTTPS addresses without credentials.');return u.href;}
  function style(v){
    if(!object(v)||!/^#[a-f0-9]{6}$/i.test(v.color)||!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>1||typeof v.visible!=='boolean'||!['uniform','source','height','change'].includes(v.colorMode)||!string(v.sourceFilter,500)||!Number.isFinite(v.minArea)||v.minArea<0||v.minArea>1e12||!(v.heightField===null||string(v.heightField,200)))fail('A saved layer has invalid display settings.');
  }
  function validate(p,options={}){
    if(!object(p)||p.format!=='USBF map'||p.version!==1)fail('Choose a USBF map file saved by this website.');
    if(!string(p.name,120)||!string(p.place,200)||!object(p.view)||!Array.isArray(p.view.center)||p.view.center.length!==2||!p.view.center.every(Number.isFinite)||Math.abs(p.view.center[0])>180||Math.abs(p.view.center[1])>85.05113||!Number.isFinite(p.view.zoom)||p.view.zoom<2||p.view.zoom>22||!Number.isFinite(p.view.pitch)||p.view.pitch<0||p.view.pitch>60||!Number.isFinite(p.view.bearing)||Math.abs(p.view.bearing)>360||typeof p.view.view3d!=='boolean'||!['light','streets','satellite'].includes(p.view.basemap)||!string(p.view.crs,4000))fail('This map file has an invalid map position or coordinate system.');
    if(!Array.isArray(p.layers)||p.layers.length>limits.layers||!Array.isArray(p.assets)||p.assets.length>60||!Array.isArray(p.models)||p.models.length>limits.models||!Array.isArray(p.order)||p.order.length>200)fail('This map file contains too many layers or files.');
    const assets=new Set(),keys=new Set();let bytes=0;
    for(const a of p.assets){
      if(!object(a)||!/^file-\d+$/.test(a.id)||assets.has(a.id)||!string(a.name,250)||!a.name||/[\0\\/]/.test(a.name)||!string(a.type,150)||!Number.isSafeInteger(a.bytes)||a.bytes<0||a.bytes>limits.asset||!string(a.sha256,64)||!/^[a-f0-9]{64}$/i.test(a.sha256)||typeof a.base64!=='string'||a.base64.length!==4*Math.ceil(a.bytes/3)||/[^A-Za-z0-9+/=]/.test(a.base64)||a.base64.indexOf('=')!==-1&&a.base64.indexOf('=')<a.base64.length-2||/=/.test(a.base64.slice(0,-2))||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64.slice(-2)))fail('A file stored in this map is invalid or too large.');
      bytes+=a.bytes;if(bytes>limits.attachments)fail('The files stored in this map exceed 48 MB.');const padding=a.bytes%3===1?'==':a.bytes%3===2?'=':'';if(padding?a.base64.slice(-padding.length)!==padding||a.base64.slice(0,-padding.length).includes('='):a.base64.includes('='))fail('A stored file has invalid base64 padding.');assets.add(a.id);
    }
    const asset=id=>{if(id!==null&&id!==undefined&&!assets.has(id))fail('A saved layer is missing its original file.');};
    for(const l of p.layers){
      if(!object(l)||!/^layer-\d+$/.test(l.key)||keys.has(l.key)||!string(l.name,120)||!l.name)fail('A saved layer is invalid.');keys.add(l.key);style(l.style);asset(l.asset);if(l.meta!==undefined&&!object(l.meta))fail('A saved layer has invalid source details.');for(const k of ['page','sourceUrl'])if(l.meta?.[k])https(l.meta[k]);
      if(l.kind==='catalog'){if(!string(l.catalogId,120)||!l.catalogId)fail('A saved catalog source is invalid.');}
      else if(l.kind==='vector'){
        if(!object(l.data)||l.data.type!=='FeatureCollection'||!Array.isArray(l.data.features)||!l.data.features.length||l.data.features.length>50000||!object(l.meta))fail('A saved vector layer is invalid.');options.validateVector?.(l.data);
        for(const k of ['page','sourceUrl'])if(l.meta[k])https(l.meta[k]);
      }else if(l.kind==='raster'){
        if(!object(l.import)||!['geotiff','image'].includes(l.import.type)||!l.asset&&!l.import.url)fail('A saved raster is missing its source.');if(l.import.url)https(l.import.url);if(l.import.readExtentWGS84!==undefined){const b=l.import.readExtentWGS84;if(!Array.isArray(b)||b.length!==4||!b.every(Number.isFinite)||b[0]>=b[2]||b[1]>=b[3]||Math.abs(b[0])>180||Math.abs(b[2])>180||Math.abs(b[1])>85.05113||Math.abs(b[3])>85.05113)fail('A saved raster has an invalid read area.');}
      }else if(l.kind==='image-preview'){
        if(!l.asset||!Array.isArray(l.coordinates)||l.coordinates.length!==4||!l.coordinates.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=85.05113))fail('A saved image preview has invalid map corners.');
      }else if(l.kind==='connection'){
        if(!object(l.connection)||!['pmtiles','raster-pmtiles','raster','vector'].includes(l.connection.type)||!l.asset&&!l.connection.url)fail('A saved connection is invalid.');if(l.connection.url)https(l.connection.url);if(l.connection.type==='vector'&&!string(l.connection.sourceLayer,200))fail('A vector tile source needs a layer name.');
      }else fail('This map uses a layer type that cannot be opened here.');
    }
    for(const o of p.order)if(!Array.isArray(o)||o.length!==2||!keys.has(o[0])||!['fill','line','circle','fill-extrusion','raster','publication-grid'].includes(o[1])&&!/^annotation(?:-\d+)?$/.test(o[1]))fail('The saved layer order is invalid.');
    if(p.active!==null&&!keys.has(p.active))fail('The saved active layer is missing.');
    for(const m of p.models){if(!object(m)||!m.asset||!object(m.placement)||m.placement.geometryBaked===true||typeof m.visible!=='boolean')fail('A saved model is missing its original geometry or location.');asset(m.asset);options.validatePlacement?.(m.placement);}
    if(p.research!==null&&(!object(p.research)||!string(p.research.id,150)||!string(p.research.method,150)||typeof p.research.roofOnly!=='boolean'||typeof p.research.edges!=='boolean'||typeof p.research.visible!=='boolean'))fail('The saved research model is invalid.');
    return p;
  }
  async function digest(bytes){return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
  async function encodeAsset(file,id){
    if(file.size>limits.asset)fail(file.name+' is too large to include in a map. Connect it with a web link or save a smaller file.');
    const b=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<b.length;i+=24576)binary+=String.fromCharCode(...b.subarray(i,i+24576));
    return {id,name:file.name||'source-data',type:file.type||'application/octet-stream',bytes:b.length,sha256:await digest(b),base64:root.btoa(binary)};
  }
  async function decodeAssets(p){
    const files=new Map();for(const a of p.assets){const text=root.atob(a.base64),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));if(bytes.length!==a.bytes||await digest(bytes)!==a.sha256)fail(a.name+' does not match its saved contents. Choose an undamaged map file.');files.set(a.id,new root.File([bytes],a.name,{type:a.type}));}return files;
  }
  root.PortalProjectCore={limits,validate,style,https,encodeAsset,decodeAssets,digest};
})(globalThis);
