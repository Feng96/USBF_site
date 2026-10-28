/* Map layouts and exports use real source features, never pretend MVT fragments are originals. */
(function () {
  'use strict';
  const $=s=>document.querySelector(s),WGS84='EPSG:4326';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lastExport=null,lastMap=null,previewURL=null,busy=false;
  const slug=name=>String(name||'map').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,90)||'map';
  function save(name,content,type){const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function cell(value){let s=value===null||value===undefined?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function wkt(geometry){
    if(!geometry)return '';
    const coord=c=>c.map(x=>String(x)).join(' '),ring=c=>'('+c.map(coord).join(', ')+')';
    const dimensions=c=>{if(!Array.isArray(c)||!c.length)return 2;return typeof c[0]==='number'?c.length:dimensions(c[0]);},d=dimensions(geometry.coordinates),z=d===3?' Z':d===4?' ZM':'';if(d>4)throw Error('WKT exports support x, y and optional Z / M coordinates.');
    switch(geometry.type){
      case 'Point':return 'POINT'+z+' ('+coord(geometry.coordinates)+')';
      case 'MultiPoint':return 'MULTIPOINT'+z+' ('+geometry.coordinates.map(c=>'('+coord(c)+')').join(', ')+')';
      case 'LineString':return 'LINESTRING'+z+' '+ring(geometry.coordinates);
      case 'MultiLineString':return 'MULTILINESTRING'+z+' ('+geometry.coordinates.map(ring).join(', ')+')';
      case 'Polygon':return 'POLYGON'+z+' ('+geometry.coordinates.map(ring).join(', ')+')';
      case 'MultiPolygon':return 'MULTIPOLYGON'+z+' ('+geometry.coordinates.map(p=>'('+p.map(ring).join(', ')+')').join(', ')+')';
      case 'GeometryCollection':return 'GEOMETRYCOLLECTION ('+geometry.geometries.map(wkt).join(', ')+')';
      default:throw Error('Unsupported export geometry: '+geometry.type);
    }
  }
  function prepareExport(snapshot,options={}){
    if(!snapshot||!Array.isArray(snapshot.features)||!snapshot.provenance)throw Error('Capture an analytical source dataset before downloading.');
    if(/tile|fragment/.test(snapshot.provenance.geometryQuality||'')||/tile/.test(snapshot.provenance.scope||'')||snapshot.capabilities?.geometryAnalysis===false&&snapshot.provenance.fragmentCount!==undefined)throw Error('Tile fragments are display data. Connect a full analytical source to download original geometry.');
    const crs=PortalCRS.definition(options.crs||WGS84),format=options.format||'geojson',name=slug(options.name||snapshot.provenance.name||snapshot.provenance.layerName||'buildings');
    const metadata={...snapshot.provenance,exportedAt:new Date().toISOString(),coordinateReferenceSystem:crs,coordinateOrder:crs===WGS84?'longitude, latitude':'x, y',heightReference:'Source values are preserved. Horizontal CRS conversion does not transform vertical datums.',featureCount:snapshot.features.length};
    const fc={type:'FeatureCollection',name,provenance:metadata,features:snapshot.features};
    if(format==='geojson'&&crs!==WGS84)throw Error('RFC 7946 GeoJSON uses longitude / latitude. Choose projected JSON for another CRS.');
    const data=crs===WGS84?JSON.parse(JSON.stringify(fc)):PortalCRS.transformGeoJSON(fc,WGS84,crs);data.provenance=metadata;
    if(format==='csv'){
    const keys=Array.from(new Set(data.features.flatMap(f=>Object.keys(f.properties||{}))));
      const reserved=['_export_crs','_export_scope','_geometry_wkt'];
      if(keys.some(k=>reserved.includes(k)))throw Error('A source field collides with CSV export metadata. Use GeoJSON / projected JSON to retain every field.');
      metadata.format='CSV with WKT geometry';metadata.csvNullRepresentation='Empty cell. Use JSON for lossless distinction between null, missing and empty string.';
      const header=[...keys,...reserved],rows=data.features.map(f=>[...keys.map(k=>f.properties?.[k]),crs,metadata.scopeLabel||metadata.scope,wkt(f.geometry)]);
      return {name:name+'.csv',mime:'text/csv;charset=utf-8',body:[header,...rows].map(r=>r.map(cell).join(',')).join('\r\n'),metadata};
    }
    if(format==='projected'){
      data.crs={type:'name',properties:{name:crs}};data.format='Projected JSON; not RFC 7946 GeoJSON';metadata.format=data.format;
      return {name:name+'.projected.json',mime:'application/json',body:JSON.stringify(data),metadata};
    }
    if(format!=='geojson')throw Error('Choose GeoJSON, projected JSON or CSV.');
    metadata.format='RFC 7946 GeoJSON';return {name:name+'.geojson',mime:'application/geo+json',body:JSON.stringify(data),metadata};
  }
  function sourceText(value){if(!value)return '';const template=document.createElement('template');template.innerHTML=String(value);return template.content.textContent.replace(/\s+/g,' ').trim();}
  const raster=l=>globalThis.PortalLayers?.isRaster?PortalLayers.isRaster(l):['raster','image','raster-pmtiles'].includes(l?.cfg?.type)||l?.cfg?.sourceKind==='raster';
  function sources(){
    const layers=globalThis.PortalLayers?Array.from(PortalLayers.layers.values()).filter(l=>l.visible):[];
    const entries=layers.map(l=>{const licenses=new Set([l.cfg.license,...(Array.isArray(l.cfg.provenance?.licenses)?l.cfg.provenance.licenses:[]),...(Array.isArray(l.data?.provenance?.licenses)?l.data.provenance.licenses:[])]);for(const f of l.data?.features||[])for(const key of ['footprint_license','height_license','license'])if(f.properties?.[key])licenses.add(String(f.properties[key]));return {licenses:Array.from(licenses).filter(Boolean),name:l.cfg.name,type:l.cfg.type,source:l.cfg.sourceUrl||l.cfg.page||l.cfg.url||l.cfg.sourceName||'Browser-local data',attribution:sourceText(l.cfg.attribution||l.cfg.license||'Source attribution not supplied'),release:l.release||null,extent:l.viewBounds||l.bounds||null,limited:Boolean(l.viewLimited),style:{color:l.color,opacity:l.opacity,colorMode:l.colorMode,sourceFilter:l.sourceFilter,minArea:l.minArea,heightField:l.heightField},analysis:l.cfg.analysis||l.data?.analysis||null,provenance:l.cfg.provenance||l.data?.provenance||null};});
    const map=portal.map,style=map.getStyle();const base=style.layers.filter(l=>l.id.startsWith('base-')&&l.layout?.visibility!=='none').map(l=>({name:l.id.replace('base-',''),attribution:sourceText(style.sources[l.source]?.attribution||'')}));
    const model=globalThis.PortalModels?.enabled?PortalModels.current:null,collection=model?PortalModels.manifest?.collections?.find(c=>c.id===model.collection):null;
    const localModels=portal.view3d?Array.from(globalThis.PortalLocalModels?.models?.values()||[]).filter(m=>m.visible).map(m=>({id:m.id,name:m.name,format:String(m.name||'').split('.').pop()?.toUpperCase(),source:m.sourceURL||m.name,sourceStorage:m.sourceURL?'Public model URL':'Local model file; the map includes its rendered view',anchorWGS84:m.anchor?.slice(),baseElevationMetres:m.altitude,sourceUnits:m.units,sourceUpAxis:m.up,sourceSha256:m.sourceSha256||null,scaleMultiplier:m.scale,headingDegrees:m.heading,alignment:'Horizontal bounding-box center and minimum z placed at anchor; elevation relative to the map sea-level plane',triangles:m.triangles,addedAt:m.addedAt,attribution:sourceText(m.attribution||'User-supplied 3D model: '+m.name),license:m.license||'Retain the original model source terms'})):[];
    const locator=globalThis.PortalExplorer?.metadata?.();return {layers:entries,basemaps:base,localModels,locator:locator?.visible?locator:null,model:model?{id:model.id,kind:model.kind,collection:model.collection,method:PortalModels.method,source:collection?.url||model.provenance?.source_url||null,attribution:sourceText(collection?.attribution||model.attribution||'Experimental / reference roof model; see model source metadata')}:null};
  }
  function camera(){const map=portal.map,b=map.getBounds(),c=map.getCenter();return {center:[c.lng,c.lat],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch(),bounds:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()],displayCRS:'EPSG:3857'};}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  async function settledMap(allowPartial){
    const map=portal.map,start=Date.now();let settled=false;
    while(Date.now()-start<18000){const views=globalThis.PortalLayers?Array.from(PortalLayers.layers.values()).filter(l=>l.visible):[];if(map.areTilesLoaded()&&!views.some(l=>l.viewLoading)){settled=true;break;}await sleep(150);}
    const failed=Array.from(globalThis.PortalLayers?.layers?.values()||[]).filter(l=>l.visible&&l.error).map(l=>l.cfg.name),warning=$('#tile-warning');
    const pending=!settled,basemapFailed=Boolean(warning&&!warning.hidden);
    if((pending||failed.length||basemapFailed)&&!allowPartial)throw Error('Some map sources are still loading or failed. Wait and retry, hide unavailable layers, or explicitly allow a partial map.');
    return {partial:pending||failed.length>0||basemapFailed,pending,failed,basemapFailed};
  }
  function wrappedLines(ctx,text,maxWidth){
    const words=String(text||'').split(/\s+/),lines=[];let line='';
    for(const word of words){if(line&&ctx.measureText(line+' '+word).width>maxWidth){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
    return lines;
  }
  function drawText(ctx,text,x,y,maxWidth,lineHeight,maxLines=Infinity){
    const lines=wrappedLines(ctx,text,maxWidth);for(let i=0;i<Math.min(lines.length,maxLines);i++)ctx.fillText(lines[i],x,y+i*lineHeight,maxWidth);return Math.min(lines.length,maxLines)*lineHeight;
  }
  function distance(a,b){const rad=Math.PI/180,p1=a.lat*rad,p2=b.lat*rad,d=(b.lng-a.lng)*rad,dp=(b.lat-a.lat)*rad;return 6371008.8*2*Math.atan2(Math.sqrt(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d/2)**2),Math.sqrt(Math.max(0,1-(Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(d/2)**2))));}
  function scaleBar(ctx,map,x,y,displayWidth,displayHeight,factor){
    const a=map.unproject([40,displayHeight-45]),b=map.unproject([200,displayHeight-45]),m=distance(a,b),nice=Math.pow(10,Math.floor(Math.log10(m))),metres=[1,2,5,10].map(v=>v*nice).filter(v=>v<=m).pop()||nice,pixels=metres/m*160*factor;
    if(!Number.isFinite(pixels)||pixels<1)return;
    ctx.fillStyle='#fff';ctx.fillRect(x-10,y-30,pixels+25,44);ctx.strokeStyle='#243d35';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y);ctx.lineTo(x+pixels,y);ctx.lineTo(x+pixels,y-8);ctx.stroke();ctx.font='12px system-ui, sans-serif';ctx.fillStyle='#243d35';ctx.fillText((metres>=1000?(metres/1000)+' km':metres+' m')+(map.getPitch()>1?' · approximate':''),x,y-12);
  }
  const papers={letter:{label:'US Letter',width:215.9,height:279.4},a4:{label:'A4',width:210,height:297},a3:{label:'A3',width:297,height:420}};
  function pageLayout(options={},imageWidth,imageHeight){
    const paper=papers[options.paper||'letter'];if(!paper)throw Error('Choose US Letter, A4 or A3 paper.');
    const orientation=options.orientation||'landscape';if(!['portrait','landscape'].includes(orientation))throw Error('Choose portrait or landscape.');
    const width=orientation==='landscape'?paper.height:paper.width,height=orientation==='landscape'?paper.width:paper.height,margin=options.margin===undefined?12:Number(options.margin);
    if(!Number.isFinite(margin)||margin<0||margin>40||width<=margin*2||height<=margin*2)throw Error('Choose a margin from 0 to 40 mm.');
    if(!Number.isSafeInteger(imageWidth)||!Number.isSafeInteger(imageHeight)||imageWidth<1||imageHeight<1||imageWidth*imageHeight>16000000)throw Error('Choose a valid generated map image.');
    const fit=Math.min((width-2*margin)/imageWidth,(height-2*margin)/imageHeight),drawWidth=imageWidth*fit,drawHeight=imageHeight*fit,points=72/25.4;
    return {paper:options.paper||'letter',label:paper.label,orientation,widthMm:width,heightMm:height,marginMm:margin,widthPt:width*points,heightPt:height*points,image:{xMm:(width-drawWidth)/2,yMm:(height-drawHeight)/2,widthMm:drawWidth,heightMm:drawHeight,widthPixels:imageWidth,heightPixels:imageHeight,dpi:25.4/fit}};
  }
  function pdfText(value){const text=String(value??''),bytes=[0xfe,0xff];for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);bytes.push(c>>>8,c&255);}return '<'+bytes.map(b=>b.toString(16).padStart(2,'0')).join('')+'>';}
  function makePDFBytes(jpeg,imageWidth,imageHeight,metadata={},options={}){
    const data=jpeg instanceof Uint8Array?jpeg:new Uint8Array(jpeg);if(data.length<4||data.length>32*1024*1024||data[0]!==255||data[1]!==216||data[data.length-2]!==255||data[data.length-1]!==217)throw Error('The PDF needs a complete JPEG map image.');
    const page=pageLayout(options,imageWidth,imageHeight),encoder=new TextEncoder(),encode=s=>encoder.encode(s),chunks=[],offsets=[0];let length=0;
    const push=value=>{const b=typeof value==='string'?encode(value):value;chunks.push(b);length+=b.byteLength;},decimal=n=>Number(n.toFixed(5)).toString();
    function object(number,body,stream){offsets[number]=length;push(number+' 0 obj\n');push(body);if(stream){push('\nstream\n');push(stream);push('\nendstream');}push('\nendobj\n');}
    push(new Uint8Array([37,80,68,70,45,49,46,55,10,37,226,227,207,211,10]));
    object(1,'<< /Type /Catalog /Pages 2 0 R /Names << /EmbeddedFiles << /Names [(map-details.json) 7 0 R] >> >> /AF [7 0 R] >>');
    object(2,'<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
    object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+decimal(page.widthPt)+' '+decimal(page.heightPt)+'] /Resources << /XObject << /MapImage 4 0 R >> >> /Contents 5 0 R >>');
    object(4,'<< /Type /XObject /Subtype /Image /Width '+imageWidth+' /Height '+imageHeight+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+data.length+' >>',data);
    const k=72/25.4,i=page.image,content=encode('q\n'+decimal(i.widthMm*k)+' 0 0 '+decimal(i.heightMm*k)+' '+decimal(i.xMm*k)+' '+decimal((page.heightMm-i.yMm-i.heightMm)*k)+' cm\n/MapImage Do\nQ\n');
    object(5,'<< /Length '+content.length+' >>',content);
    const created=new Date(metadata.createdAt||Date.now());if(!Number.isFinite(created.getTime()))throw Error('The map date is invalid.');const date=created.toISOString().replace(/[-:]/g,'').replace('T','').slice(0,14)+'Z';
    object(6,'<< /Title '+pdfText(metadata.title||'US Buildings')+' /Author '+pdfText('US Buildings')+' /Subject '+pdfText('Map, sources and view details')+' /Creator '+pdfText('US Buildings')+' /CreationDate (D:'+date+') >>');
    object(7,'<< /Type /Filespec /F (map-details.json) /UF '+pdfText('map-details.json')+' /Desc '+pdfText('Map sources, view, data dates and paper settings')+' /AFRelationship /Data /EF << /F 8 0 R >> >>');
    const details=encode(JSON.stringify({...metadata,pdf:{...page,content:'Rendered map image; original data and 3D models are not embedded as editable layers'}},null,2));
    object(8,'<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length '+details.length+' >>',details);
    const xref=length;push('xref\n0 9\n0000000000 65535 f \n');for(let n=1;n<=8;n++)push(String(offsets[n]).padStart(10,'0')+' 00000 n \n');push('trailer\n<< /Size 9 /Root 1 0 R /Info 6 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
    const bytes=new Uint8Array(length);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}return {bytes,page};
  }
  async function createPDF(mapResult,options={}){
    if(!mapResult?.blob||!mapResult.metadata)throw Error('Generate a map first.');
    if(mapResult.rawMapBlob){await import('./map-paper.js?v=1.2');return globalThis.PortalMapPaper.create(mapResult,options);}
    const bitmap=await createImageBitmap(mapResult.blob);try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('The PDF image could not be prepared.')),'image/jpeg',.95));const result=makePDFBytes(new Uint8Array(await jpeg.arrayBuffer()),canvas.width,canvas.height,mapResult.metadata,options);return {blob:new Blob([result.bytes],{type:'application/pdf'}),metadata:{...mapResult.metadata,pdf:result.page},page:result.page};}finally{bitmap.close();}
  }
  async function createMap(options={}){
    if(!globalThis.portal?.ready)throw Error('The map is still loading.');
    const map=portal.map,oldRatio=map.getPixelRatio(),ratio=Number(options.ratio||1);if(![1,2].includes(ratio))throw Error('Choose standard or 2× resolution.');
    const size=map.getContainer().getBoundingClientRect(),width=Math.round(size.width*ratio),mapHeight=Math.round(size.height*ratio),header=Math.round((options.subtitle?100:78)*ratio);
    const capturedCamera=camera(),metadata={createdAt:new Date().toISOString(),title:options.title||'US Buildings',subtitle:options.subtitle||'',camera:capturedCamera,sources:sources(),coordinateReadoutCRS:PortalCRS.get(),imageResolution:ratio+'× map CSS size',placeName:$('#map-place-name')?.textContent||'',decorations:{legend:options.legend!==false,scale:options.scale!==false,north:options.north!==false}};
    if(options.scale!==false){const a=map.unproject([size.width*.05,size.height*.94]),b=map.unproject([size.width*.25,size.height*.94]);metadata.decorations.scaleSample={groundMetres:distance(a,b),widthFraction:.2,approximate:map.getPitch()>1};}
    const measure=document.createElement('canvas').getContext('2d');if(!measure)throw Error('Canvas rendering is unavailable.');const credits='Sources: '+Array.from(new Set([...metadata.sources.basemaps.map(x=>x.attribution),...metadata.sources.layers.map(x=>x.attribution),...metadata.sources.localModels.map(x=>x.attribution),metadata.sources.locator?.source,metadata.sources.model?.attribution].filter(Boolean))).join(' · ');measure.font='10px system-ui, sans-serif';const creditLines=wrappedLines(measure,credits,size.width-64).length;
    const legend=[];let lx=32,ly=0;measure.font='12px system-ui, sans-serif';if(options.legend!==false)for(const l of metadata.sources.layers){const w=Math.min(size.width-64,measure.measureText(l.name).width+32);if(lx>32&&lx+w>size.width-32){lx=32;ly+=21;}legend.push({x:lx,y:ly,label:l.name,color:l.style.color||'#287f76',width:w-22});lx+=w;}
    const legendHeight=legend.length?ly+21:0,footer=Math.round((legendHeight+creditLines*13+80)*ratio);
    if(width<200||mapHeight<150)throw Error('Make the map larger before exporting.');if(width*(mapHeight+header+footer)>16000000)throw Error('This layout exceeds 16 million pixels. Use standard resolution or a smaller window.');let flags;
    try{
      map.setPixelRatio(ratio);map.triggerRepaint();await sleep(650);flags=await settledMap(Boolean(options.allowPartial));
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{map.off('render',onRender);reject(Error('The map did not finish drawing.'));},5000);function onRender(){clearTimeout(timer);map.off('render',onRender);requestAnimationFrame(resolve);}map.on('render',onRender);map.triggerRepaint();});
      const current=camera();if(JSON.stringify(current)!==JSON.stringify(capturedCamera))throw Error('The map moved during capture. Keep the view still and try again.');
      metadata.sources=sources();metadata.createdAt=new Date().toISOString();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=mapHeight+header+footer;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas rendering is unavailable.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(ratio,ratio);
      const logicalWidth=width/ratio,logicalHeight=mapHeight/ratio;ctx.fillStyle='#203d32';ctx.font='600 25px system-ui, sans-serif';ctx.fillText(metadata.title,32,39,logicalWidth-64);if(metadata.subtitle){ctx.font='13px system-ui, sans-serif';ctx.fillStyle='#63736a';ctx.fillText(metadata.subtitle,32,65,logicalWidth-64);}ctx.restore();
      const probe=document.createElement('canvas');probe.width=4;probe.height=4;const pc=probe.getContext('2d');try{pc.drawImage(map.getCanvas(),0,0,4,4);const pixels=pc.getImageData(0,0,4,4).data;if(!pixels.some((v,i)=>i%4===3&&v>0))throw Error('The map canvas is empty. Wait for it to render and retry.');}catch(e){if(e.name==='SecurityError')throw Error('A source blocked image export. Use CORS-enabled sources or hide that layer.');throw e;}
      ctx.drawImage(map.getCanvas(),0,header,width,mapHeight);
      const rawCanvas=document.createElement('canvas');rawCanvas.width=width;rawCanvas.height=mapHeight;rawCanvas.getContext('2d').drawImage(map.getCanvas(),0,0,width,mapHeight);
      ctx.save();ctx.scale(ratio,ratio);const mapY=header/ratio;
      if(options.north!==false){const x=logicalWidth-43,y=mapY+46;ctx.fillStyle='#fffffff2';ctx.fillRect(x-20,y-28,40,65);ctx.save();ctx.translate(x,y);ctx.rotate(-map.getBearing()*Math.PI/180);ctx.fillStyle='#244b3a';ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(-7,7);ctx.lineTo(0,3);ctx.lineTo(7,7);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#244b3a';ctx.font='600 12px system-ui, sans-serif';ctx.fillText('N',x-4,y+25);}
      if(options.scale!==false)scaleBar(ctx,map,34,mapY+logicalHeight-28,size.width,size.height,1);
      const footerY=mapY+logicalHeight;ctx.fillStyle='#fff';ctx.fillRect(0,footerY,logicalWidth,footer/ratio);ctx.strokeStyle='#dce3dd';ctx.beginPath();ctx.moveTo(0,footerY);ctx.lineTo(logicalWidth,footerY);ctx.stroke();let y=footerY+24;
      ctx.font='12px system-ui, sans-serif';for(const item of legend){ctx.fillStyle=item.color;ctx.fillRect(item.x,y+item.y-10,10,10);ctx.fillStyle='#304e3d';ctx.fillText(item.label,item.x+16,y+item.y,item.width);}
      y+=legendHeight+4;ctx.fillStyle='#617568';ctx.font='10px system-ui, sans-serif';y+=drawText(ctx,credits,32,y,logicalWidth-64,13);y+=9;ctx.fillText(new Date(metadata.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})+($('#map-place-name')?.textContent?' · '+$('#map-place-name').textContent:''),32,y,logicalWidth-64);y+=18;if(flags.partial)ctx.fillText('Some layers were unavailable when this map was saved.',32,y,logicalWidth-64);ctx.restore();
      metadata.capture=flags;metadata.legend='Layer-level swatches. Field palettes and exact source/style details remain in map metadata.';
      let blob;try{blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed.')),'image/png'));}catch(e){throw Error('A source blocked image export. Use CORS-enabled sources, hide the blocked layer, and retry.');}
      if(!blob?.size)throw Error('The image is empty.');const rawMapBlob=await new Promise((resolve,reject)=>rawCanvas.toBlob(b=>b?resolve(b):reject(Error('The map image could not be prepared.')),'image/png'));return {blob,rawMapBlob,metadata,width:canvas.width,height:canvas.height};
    }finally{map.setPixelRatio(oldRatio);map.triggerRepaint();}
  }
  function mapOptions(){return {title:$('#composer-title').value.trim()||'US Buildings',subtitle:$('#composer-subtitle').value.trim(),ratio:Number($('#composer-resolution').value),legend:$('#composer-legend').checked,scale:$('#composer-scale').checked,north:$('#composer-north').checked,allowPartial:$('#composer-partial').checked};}
  function paperOptions(){return {paper:$('#composer-paper').value,orientation:$('#composer-orientation').value,margin:Number($('#composer-margin').value)};}
  function pageSummary(){const p=papers[$('#composer-paper').value],o=$('#composer-orientation').value;$('#composer-page-summary').textContent=p.label+' · '+o+' · '+$('#composer-margin').value+' mm margins';}
  function outputBusy(value){busy=value;for(const id of ['composer-preview-button','composer-download-png','composer-download-pdf','composer-print'])$('#'+id).disabled=value;}
  async function refreshMap(){
    lastMap=await createMap(mapOptions());if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(lastMap.blob);$('#composer-preview-image').src=previewURL;$('#composer-preview').hidden=false;$('#composer-preview-caption').textContent=lastMap.width+' × '+lastMap.height+' pixels'+(lastMap.metadata.capture.partial?' · some data unavailable':'');$('#composer-map-metadata').disabled=false;return lastMap;
  }
  async function mapAction(kind){
    if(busy)return;outputBusy(true);const message=$('#composer-map-message');message.className='composer-message';message.textContent=kind==='pdf'?'Preparing PDF…':'Preparing your map…';
    try{const result=await refreshMap();if(kind==='png')save(slug(result.metadata.title)+'.png',result.blob);else if(kind==='pdf'){const pdf=await createPDF(result,paperOptions());lastMap.metadata.pdf=pdf.page;save(slug(result.metadata.title)+'.pdf',pdf.blob);}message.textContent=kind==='preview'?'Preview ready.':kind==='pdf'?'PDF downloaded.':'PNG downloaded.';}catch(err){message.textContent=err.message;message.classList.add('composer-error');}finally{outputBusy(false);}
  }
  function ensureDialog(){
    let dialog=$('#map-composer-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='map-composer-dialog';dialog.className='workspace-dialog composer-dialog';dialog.setAttribute('aria-labelledby','map-composer-title');
    dialog.innerHTML=`<header class="composer-heading"><h2 id="map-composer-title">Save a map</h2><button type="button" data-close-composer aria-label="Close">×</button></header>
    <nav class="composer-tabs" aria-label="Export"><button data-composer-tab="map" aria-pressed="true">Map</button><button data-composer-tab="download" aria-pressed="false">Data</button></nav>
    <section data-composer-panel="map" class="composer-content"><form id="composer-map-form" class="composer-form"><label>Title<input id="composer-title" maxlength="120" value="US Buildings"></label><label>Subtitle <span class="composer-optional">optional</span><input id="composer-subtitle" maxlength="200" placeholder="Place, date or subject"></label>
    <div class="composer-row"><label>Paper<select id="composer-paper"><option value="letter">US Letter · 8.5 × 11 in</option><option value="a4">A4</option><option value="a3">A3</option></select></label><label>Orientation<select id="composer-orientation"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label></div>
    <details class="composer-options"><summary>Appearance</summary><div class="composer-row"><label>Image quality<select id="composer-resolution"><option value="1">Standard</option><option value="2">High · 2×</option></select></label><label>Paper margins<select id="composer-margin"><option value="6">Narrow · 6 mm</option><option value="12" selected>Standard · 12 mm</option><option value="20">Wide · 20 mm</option></select></label></div><div class="composer-checks"><label><input type="checkbox" id="composer-legend" checked> Layer names</label><label><input type="checkbox" id="composer-scale" checked> Scale bar</label><label><input type="checkbox" id="composer-north" checked> North arrow</label></div></details>
    <p class="composer-note" id="composer-page-summary"></p><p class="composer-note">PNG keeps the current view. PDF uses readable paper text and includes complete source credits.</p>
    <div class="composer-actions"><button class="composer-primary" type="button" id="composer-download-pdf">Download PDF</button><button type="button" id="composer-download-png">Download PNG</button><button type="submit" id="composer-preview-button">Preview</button></div>
    <details class="composer-options"><summary>More options</summary><label class="composer-checkbox"><input type="checkbox" id="composer-partial"> Save even if some layers are unavailable</label><div class="composer-actions"><button type="button" id="composer-print">Print</button><button type="button" id="composer-map-metadata" disabled>Data details</button></div></details></form><p id="composer-map-message" class="composer-message" role="status" aria-live="polite"></p><figure id="composer-preview" hidden><img alt="Your map" id="composer-preview-image"><figcaption id="composer-preview-caption"></figcaption></figure></section>
    <section data-composer-panel="download" class="composer-content" hidden><form id="composer-data-form" class="composer-form"><label>Dataset<select id="composer-data-layer"></select></label><div id="composer-source-description" class="composer-scope"></div><label>Area to download<select id="composer-data-scope"><option value="layer">Available data in this layer</option><option value="view">Current map view</option><option value="selection">Selected feature</option></select></label><label>File type<select id="composer-data-format"><option value="geojson">GeoJSON</option><option value="csv">CSV table with geometry</option><option value="projected">JSON in another coordinate system</option></select></label><label id="composer-data-crs-field">Coordinates<select id="composer-data-crs"><option value="EPSG:4326">Longitude / latitude</option><option value="workspace">Use map settings</option><option value="EPSG:3857">Web Mercator · metres</option></select></label><p class="composer-note">Downloads include the available data for this area. Original raster files are available below.</p><div class="composer-actions"><button class="composer-primary" type="submit" id="composer-download-data">Download data</button><button type="button" id="composer-data-metadata" disabled>Data details</button><button type="button" id="composer-original-file" hidden>Original file</button><a id="composer-original-link" target="_blank" rel="noopener" hidden>Original source ↗</a></div></form><p id="composer-data-message" class="composer-message" role="status" aria-live="polite"></p></section>`;
    document.body.append(dialog);dialog.querySelector('[data-close-composer]').onclick=()=>dialog.close();dialog.querySelectorAll('[data-composer-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.composerTab));
    $('#composer-map-form').onsubmit=e=>{e.preventDefault();mapAction('preview');};$('#composer-download-png').onclick=()=>mapAction('png');$('#composer-download-pdf').onclick=()=>mapAction('pdf');
    for(const id of ['composer-paper','composer-orientation','composer-margin'])$('#'+id).onchange=pageSummary;pageSummary();
    $('#composer-map-metadata').onclick=()=>{if(lastMap)save(slug(lastMap.metadata.title)+'.map.json',JSON.stringify(lastMap.metadata,null,2),'application/json');};
    $('#composer-print').onclick=async()=>{if(busy)return;const win=window.open('','_blank');if(!win){$('#composer-map-message').textContent='Allow a print window for this site, then try again.';return;}win.document.write('<p style="font:14px system-ui;padding:30px">Preparing your map…</p>');outputBusy(true);try{const result=await refreshMap(),pdf=await createPDF(result,paperOptions()),url=URL.createObjectURL(pdf.blob);lastMap.metadata.pdf=pdf.page;win.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),120000);}catch(err){win.close();$('#composer-map-message').textContent=err.message;}finally{outputBusy(false);}};
    $('#composer-original-file').onclick=()=>{const l=PortalLayers.layers.get($('#composer-data-layer').value),file=l?.cfg.originalFile;if(file)save(file.name||'source-data',file,file.type);};
    $('#composer-data-layer').onchange=updateData;$('#composer-data-format').onchange=()=>{const geo=$('#composer-data-format').value==='geojson';$('#composer-data-crs-field').hidden=geo;$('#composer-data-crs').value=geo?WGS84:'workspace';};
    $('#composer-data-form').onsubmit=async e=>{e.preventDefault();const l=PortalLayers.layers.get($('#composer-data-layer').value);if(!l)return;$('#composer-download-data').disabled=true;$('#composer-data-message').className='composer-message';try{if(raster(l))throw Error('Choose Original file below, or open the original source to download raster data.');if(!globalThis.PortalAnalysisData)throw Error('The data tools are still loading.');const snapshot=await PortalAnalysisData.capture(l,{scope:$('#composer-data-scope').value,map:portal.map,selection:PortalLayers.selection,respectFilters:true,allowTilePreview:false});const format=$('#composer-data-format').value,crs=format==='geojson'?WGS84:$('#composer-data-crs').value==='workspace'?PortalCRS.get():$('#composer-data-crs').value;lastExport=prepareExport(snapshot,{name:l.cfg.name,format,crs});save(lastExport.name,lastExport.body,lastExport.mime);$('#composer-data-metadata').disabled=false;$('#composer-data-message').textContent='Downloaded '+snapshot.features.length.toLocaleString()+' records. Data details include the area, date and source.';}catch(err){$('#composer-data-message').textContent=err.message;$('#composer-data-message').classList.add('composer-error');}finally{$('#composer-download-data').disabled=false;}};
    $('#composer-data-metadata').onclick=()=>{if(lastExport)save(lastExport.name+'.metadata.json',JSON.stringify(lastExport.metadata,null,2),'application/json');};return dialog;
  }
  function updateData(){
    const l=globalThis.PortalLayers?.layers.get($('#composer-data-layer').value),note=$('#composer-source-description'),a=$('#composer-original-link'),original=$('#composer-original-file');original.hidden=!l?.cfg.originalFile;
    if(!l){note.textContent='Add a layer to download its data.';a.hidden=true;$('#composer-download-data').disabled=true;return;}
    const type=l.cfg.type,displayOnly=['pmtiles','vector'].includes(type)||raster(l);
    note.textContent=l.cfg.name+' · '+(['pmtiles','vector'].includes(type)?'Use the original file or source below for this viewing layer.':raster(l)?'Download the original raster file below.':type==='viewport'?'Includes the buildings currently loaded in this area.':'Includes the available features in this file.')+(l.viewLimited?' Zoom in for a more complete area.':'');
    $('#composer-download-data').disabled=displayOnly;for(const id of ['composer-data-scope','composer-data-format','composer-data-crs'])$('#'+id).disabled=displayOnly;
    const href=l.cfg.downloadUrl||l.cfg.sourceUrl||l.cfg.page||l.cfg.url;a.hidden=!href||!/^https:\/\//i.test(href)||/[{}]/.test(href);if(!a.hidden)a.href=href;
  }
  function tab(name){const dialog=ensureDialog();dialog.querySelectorAll('[data-composer-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.composerTab===name)));dialog.querySelectorAll('[data-composer-panel]').forEach(p=>p.hidden=p.dataset.composerPanel!==name);$('#map-composer-title').textContent=name==='download'?'Download data':'Save a map';if(name==='download'){const active=globalThis.PortalLayers?.active?.id,old=$('#composer-data-layer').value;$('#composer-data-layer').innerHTML=Array.from(globalThis.PortalLayers?.layers?.values()||[]).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.cfg.name)+'</option>').join('');$('#composer-data-layer').value=PortalLayers.layers.has(active)?active:old;updateData();$('#composer-data-format').onchange();}}
  function open(name='map'){if(name==='settings'){PortalSettings.open();return;}const dialog=ensureDialog();tab(name==='download'?'download':'map');if(!dialog.open)dialog.showModal();}
  globalThis.PortalComposer={open,createMap,createPDF,makePDFBytes,pageLayout,prepareExport,wkt,csvCell:cell,sources,camera};
})();
