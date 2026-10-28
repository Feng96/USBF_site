/* One serializable description of a layer's paint. It does not inspect or count records. */
(function(root){
 'use strict';
 const fields=['bf_source','source','geom_source','SOURCE'];
 const palettes={
  source:[
   {key:'google',label:'Google',values:['google'],color:'#ca9950'},
   {key:'microsoft',label:'Microsoft',values:['microsoft','ms','msft'],color:'#4e83b5'},
   {key:'osm',label:'OpenStreetMap',values:['osm','openstreetmap'],color:'#448a72'},
   {key:'photogrammetric',label:'Photogrammetric',values:['photogrammetric'],color:'#8175ad'},
   {key:'manual',label:'Manual',values:['other (manual)'],color:'#bb9465'},
   {key:'ours2',label:'ours2',values:['ours2'],color:'#aa7548'},
   {key:'other',label:'Other / not provided',values:null,color:'#929a98'}
  ],
  change:[
   {key:'modified',label:'Modified',values:[true],color:'#c38c42'},
   {key:'unchanged',label:'Unchanged',values:[false],color:'#287f76'},
   {key:'unknown',label:'Unknown / not recorded',values:null,color:'#a9b0aa'}
  ],
  height:{stops:[{value:0,color:'#d5e5ca'},{value:15,color:'#6ba98d'},{value:40,color:'#287c80'},{value:100,color:'#56519b'}],missing:{key:'missing-height',label:'No positive height',color:'#abb2b0'}}
 };
 function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 freeze(palettes);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const raster=l=>['raster','image','raster-pmtiles'].includes(l?.cfg?.type)||l?.cfg?.sourceKind==='raster';
 function sourceField(l){return fields.find(field=>l?.fields?.includes(field))||null;}
 function mode(l){if(raster(l))return 'raster';if(l?.colorMode==='source'&&sourceField(l))return 'source';if(l?.colorMode==='change'&&l.fields?.includes('modified'))return 'change';if(l?.colorMode==='height'&&l.heightField)return 'height';return 'uniform';}
 function colorExpression(l){
  const effective=mode(l);if(effective==='raster')return null;
  if(effective==='source')return ['match',['downcase',['to-string',['get',sourceField(l)]]],...palettes.source.filter(e=>e.values).flatMap(e=>[e.values.slice(),e.color]),palettes.source.at(-1).color];
  if(effective==='change')return ['case',['==',['get','modified'],true],palettes.change[0].color,['==',['get','modified'],false],palettes.change[1].color,palettes.change[2].color];
  if(effective==='height')return ['case',['>',['coalesce',['to-number',['get',l.heightField]],0],0],['interpolate',['linear'],['to-number',['get',l.heightField]],...palettes.height.stops.flatMap(s=>[s.value,s.color])],palettes.height.missing.color];
  return l?.color||'#4b78a1';
 }
 function forLayer(l){
  if(!l)return null;const effective=mode(l),title=String(l.cfg?.name||'Data layer'),field=effective==='source'?sourceField(l):effective==='change'?'modified':effective==='height'?l.heightField:null,opacity=Number.isFinite(l.opacity)?Math.max(0,Math.min(1,l.opacity)):1;
  const descriptor={version:1,layerId:l.id===undefined?null:String(l.id),title,kind:effective==='height'?'continuous':effective==='source'||effective==='change'?'categorical':effective,mode:effective,requestedMode:l.colorMode||'uniform',field,opacity,visible:l.visible!==false,entries:[],stops:[],unit:null,missing:null,caption:'',details:{sourceField:field,source:l.cfg?.provider||l.cfg?.sourceName||null,sourceUrl:l.cfg?.page||l.cfg?.sourceUrl||l.cfg?.url||null,license:l.cfg?.license||null,filters:{source:l.sourceFilter||null,fixedSource:l.cfg?.fixedSource||null,minimumAreaM2:Number.isFinite(l.minArea)&&l.minArea>0?l.minArea:null},geometryRole:raster(l)?'Raster display':l.cfg?.type==='viewport'?'Loaded source area':['pmtiles','vector'].includes(l.cfg?.type)?'Viewing tiles':'Loaded vector data'}};
  if(effective==='source'){descriptor.caption='Footprint source';descriptor.entries=copy(palettes.source);descriptor.normalization='Lowercase the renderer-selected source field. Whitespace is significant.';}
  else if(effective==='change'){descriptor.caption='Recorded changes';descriptor.entries=copy(palettes.change);descriptor.comparison='Strict booleans. Only true and false have recorded-state colors; null, absent fields and other values are unknown.';}
  else if(effective==='height'){
   descriptor.caption='Height · m';descriptor.unit='m';descriptor.stops=copy(palettes.height.stops).map((s,i)=>({...s,label:i===palettes.height.stops.length-1?String(s.value)+'+':String(s.value)}));descriptor.missing=copy(palettes.height.missing);descriptor.interpolation='linear';descriptor.colorSpace='rgb';descriptor.domain=[0,100];descriptor.rule='Positive source heights only. Colors vary continuously between the stops; values at or above 100 m use the final color. Missing and non-positive values use the separate missing-height color.';
  }else if(effective==='raster')descriptor.caption=l.cfg?.type==='image'?'Georeferenced image':l.cfg?.type==='raster-pmtiles'?'Raster tiles':'Raster imagery';
  else descriptor.entries=[{key:'uniform',label:title,values:null,color:l.color||'#4b78a1'}];
  return freeze(descriptor);
 }
 function forLayers(layers,options={}){const values=layers&&Object.prototype.toString.call(layers)==='[object Map]'?layers.values():layers||[];return freeze(Array.from(values).filter(l=>l&&(options.visibleOnly===false||l.visible!==false)).map(forLayer));}
 function stringValue(v){return v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);}
 function mix(a,b,t){const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const x=channels(a),y=channels(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
 function colorAt(legend,value){
  if(!legend||legend.kind==='raster')return null;
  if(legend.mode==='source'){const normalized=stringValue(value).toLowerCase();return legend.entries.find(e=>e.values?.includes(normalized))?.color||legend.entries.at(-1).color;}
  if(legend.mode==='change')return legend.entries.find(e=>e.values?.some(v=>v===value))?.color||legend.entries.at(-1).color;
  if(legend.kind==='continuous'){const number=Number(value===undefined?null:value);if(Number.isNaN(number))throw Error('The renderer cannot convert this height to a number.');if(number<=0)return legend.missing.color;const stops=legend.stops;if(number>=stops.at(-1).value)return stops.at(-1).color;const upper=stops.findIndex(s=>s.value>=number),a=stops[upper-1],b=stops[upper];return mix(a.color,b.color,(number-a.value)/(b.value-a.value));}
  return legend.entries[0]?.color||null;
 }
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function cssColor(value){const s=String(value||'');return /^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?)\([\d\s.,%+\-/]*\))$/i.test(s)?s:'#4b78a1';}
 function gradientCSS(legend,explicitColorSpace=false){if(legend.kind!=='continuous')return null;const [min,max]=legend.domain;return 'linear-gradient(90deg'+(explicitColorSpace?' in srgb':'')+', '+legend.stops.map(s=>cssColor(s.color)+' '+(100*(s.value-min)/(max-min))+'%').join(', ')+')';}
 function detailsHTML(legend){const d=legend.details,items=[];if(d.sourceField)items.push(['Field',d.sourceField]);items.push(['Display',d.geometryRole],['Opacity',Math.round(legend.opacity*100)+'%']);if(d.source)items.push(['Provider',d.source]);if(d.filters.source)items.push(['Source filter',d.filters.source]);if(d.filters.fixedSource)items.push(['Fixed source',d.filters.fixedSource]);if(d.filters.minimumAreaM2!==null)items.push(['Minimum source area',d.filters.minimumAreaM2+' m²']);if(d.license)items.push(['License',d.license]);if(d.sourceUrl)items.push(['Source',d.sourceUrl]);return '<details class="map-layer-legend-details"><summary>Details</summary><dl>'+items.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+(legend.rule?'<p>'+esc(legend.rule)+'</p>':'')+(legend.comparison?'<p>'+esc(legend.comparison)+'</p>':'')+'</details>';}
 function html(legends,options={}){
  if(!Array.isArray(legends))legends=[legends];return legends.filter(Boolean).map(l=>{
   const swatch=(color,extra='')=>'<i class="map-layer-legend-swatch '+extra+'" style="--legend-color:'+esc(cssColor(color))+';--legend-opacity:'+l.opacity+'" aria-hidden="true"></i>';
   let body='';if(l.kind==='uniform')body='<div class="map-layer-legend-title">'+swatch(l.entries[0].color)+'<h3>'+esc(l.title)+'</h3></div>';
   else if(l.kind==='raster')body='<div class="map-layer-legend-title"><i class="map-layer-legend-raster" aria-hidden="true"></i><h3>'+esc(l.title)+'</h3></div><p class="map-layer-legend-caption">'+esc(l.caption)+'</p>';
   else{
    body='<div class="map-layer-legend-title"><h3>'+esc(l.title)+'</h3></div><p class="map-layer-legend-caption">'+esc(l.caption)+'</p>';
    if(l.kind==='continuous'){const [min,max]=l.domain;body+='<div class="map-layer-legend-ramp" role="img" aria-label="Continuous height colors from '+min+' to '+max+' metres, with '+max+' metres and above using the final color" style="--legend-gradient:'+esc(gradientCSS(l))+';--legend-gradient-srgb:'+esc(gradientCSS(l,true))+';--legend-opacity:'+l.opacity+'"></div><div class="map-layer-legend-ticks">'+l.stops.map((s,i)=>'<span class="'+(i===0?'first':i===l.stops.length-1?'last':'')+'" style="left:'+(100*(s.value-min)/(max-min))+'%">'+esc(s.label)+'</span>').join('')+'</div><div class="map-layer-legend-missing">'+swatch(l.missing.color)+'<span>'+esc(l.missing.label)+'</span></div>';}
    else body+='<div class="map-layer-legend-entries">'+l.entries.map(e=>'<div data-legend-entry="'+esc(e.key)+'">'+swatch(e.color)+'<span>'+esc(e.label)+'</span></div>').join('')+'</div>';
   }
   return '<section class="map-layer-legend" data-legend-layer="'+esc(l.layerId)+'" data-legend-kind="'+esc(l.kind)+'" data-legend-mode="'+esc(l.mode)+'">'+body+(options.details===false?'':detailsHTML(l))+'</section>';
  }).join('');
 }
 function render(layers,target,options={}){if(!target)return [];const open=options.preserveDetails===false?[]:Array.from(target.querySelectorAll('.map-layer-legend-details[open]')).map(e=>e.closest('[data-legend-layer]')?.dataset.legendLayer),legends=forLayers(layers,options);target.innerHTML=html(legends,options);for(const d of target.querySelectorAll('.map-layer-legend-details'))if(open.includes(d.closest('[data-legend-layer]')?.dataset.legendLayer))d.open=true;return legends;}
 function bind(options={}){
  const doc=options.document||root.document;if(!doc)throw Error('A document is required to bind the map legend.');const getLayers=options.getLayers||(()=>root.PortalLayers?.layers||[]),getTarget=()=>typeof options.target==='string'?doc.querySelector(options.target):options.target||doc.querySelector('.legend-body');
  function update(){const target=getTarget();if(!target)return;const layers=Array.from(getLayers().values());if(!layers.some(l=>l.visible!==false)&&options.clearEmpty!==true)return;render(layers,target,options);}
  const events=['portal-ready','portal-layers-changed','portal-style-changed'];for(const name of events)doc.addEventListener(name,update);update();return ()=>{for(const name of events)doc.removeEventListener(name,update);};
 }
 function plan(legends,options={}){
  const width=Number(options.width||260),fontSize=Number(options.fontSize||10),lineHeight=Number(options.lineHeight||fontSize*1.4),gap=Number(options.gap===undefined?12:options.gap),minFontSize=Number(options.minFontSize||0),captionSize=Math.max(minFontSize,fontSize*.9),tickSize=Math.max(minFontSize,fontSize*.85),measure=options.measureText||((text,size)=>String(text).length*size*.55),items=[];let y=0;
  if(!Number.isFinite(width)||width<100||!Number.isFinite(fontSize)||fontSize<1||!Number.isFinite(lineHeight)||lineHeight<fontSize||!Number.isFinite(gap)||gap<0)throw Error('Choose a usable legend width, font size and spacing.');
  function label(text,x,lineY,size=fontSize,weight='regular',max=width-x){items.push({type:'text',text:String(text),x,y:lineY,size,weight,maxWidth:max});}
  function lines(text,max,size=fontSize){const words=String(text).split(/\s+/),out=[];let line='';for(const word of words){if(line&&measure(line+' '+word,size)>max){out.push(line);line='';}if(measure(word,size)<=max){line+=(line?' ':'')+word;continue;}for(const char of Array.from(word)){if(line&&measure(line+char,size)>max){out.push(line);line='';}line+=char;}}if(line)out.push(line);return out.length?out:[''];}
  function wrapLabel(text,x,lineY,size=fontSize,weight='regular',max=width-x){const rows=lines(text,max,size);for(let i=0;i<rows.length;i++)label(rows[i],x,lineY+i*lineHeight,size,weight,max);return rows.length*lineHeight;}
  function swatch(color,x,lineY,opacity=1){items.push({type:'swatch',color,x,y:lineY-fontSize+1,width:fontSize,height:fontSize,opacity});}
  for(const l of legends.filter(Boolean)){
   if(l.kind==='uniform'){swatch(l.entries[0].color,0,y+fontSize,l.opacity);y+=wrapLabel(l.title,fontSize+6,y+fontSize,fontSize,'regular')+gap;continue;}
   if(l.kind==='raster'){items.push({type:'raster',x:0,y,width:fontSize,height:fontSize});y+=wrapLabel(l.title,fontSize+6,y+fontSize);y+=wrapLabel(l.caption,fontSize+6,y+fontSize,captionSize)+gap;continue;}
   y+=wrapLabel(l.title,0,y+fontSize,fontSize,'bold');y+=wrapLabel(l.caption,0,y+fontSize,captionSize);
   if(l.kind==='continuous'){
    items.push({type:'ramp',x:0,y,width,height:fontSize,stops:copy(l.stops),domain:l.domain.slice(),interpolation:l.interpolation,colorSpace:l.colorSpace,opacity:l.opacity});y+=fontSize+3;
    for(let i=0;i<l.stops.length;i++){const s=l.stops[i],fraction=(s.value-l.domain[0])/(l.domain[1]-l.domain[0]),tw=measure(s.label,tickSize),x=Math.max(0,Math.min(width-tw,width*fraction-tw/2));label(s.label,x,y+tickSize,tickSize);}
    y+=lineHeight+2;swatch(l.missing.color,0,y+fontSize,l.opacity);label(l.missing.label,fontSize+6,y+fontSize);y+=lineHeight+gap;
   }else{
    const widest=Math.max(...l.entries.map(e=>measure(e.label,fontSize)))+fontSize+12,columns=width>=250&&width/2>=widest?2:1,columnWidth=width/columns;for(let i=0;i<l.entries.length;i+=columns){let rowHeight=lineHeight;for(let col=0;col<columns&&i+col<l.entries.length;col++){const e=l.entries[i+col],x=col*columnWidth;swatch(e.color,x,y+fontSize,l.opacity);rowHeight=Math.max(rowHeight,wrapLabel(e.label,x+fontSize+6,y+fontSize,fontSize,'regular',columnWidth-fontSize-12));}y+=rowHeight;}y+=gap;
   }
  }
  return {version:1,width,height:Math.max(0,y-(y?gap:0)),items};
 }
 function paintCanvas(ctx,layout,x=0,y=0){
  ctx.save();ctx.translate(x,y);for(const item of layout.items){
   if(item.type==='text'){ctx.fillStyle='#304c3d';ctx.font=(item.weight==='bold'?'600 ':'')+item.size+'px system-ui, sans-serif';ctx.fillText(item.text,item.x,item.y,item.maxWidth);}
   else if(item.type==='swatch'){ctx.save();ctx.globalAlpha=item.opacity;ctx.fillStyle=cssColor(item.color);ctx.fillRect(item.x,item.y,item.width,item.height);ctx.restore();}
   else if(item.type==='raster'){ctx.fillStyle='#d3ddd5';ctx.fillRect(item.x,item.y,item.width,item.height);ctx.fillStyle='#80978a';const p=item.width/3;ctx.fillRect(item.x,item.y,p,p);ctx.fillRect(item.x+p,item.y+p,p,p);ctx.fillRect(item.x+2*p,item.y+2*p,p,p);}
   else if(item.type==='ramp'){const ramp=ctx.createLinearGradient(item.x,item.y,item.x+item.width,item.y),[min,max]=item.domain;for(const s of item.stops)ramp.addColorStop((s.value-min)/(max-min),s.color);ctx.save();ctx.globalAlpha=item.opacity;ctx.fillStyle=ramp;ctx.fillRect(item.x,item.y,item.width,item.height);ctx.restore();}
  }ctx.restore();return layout.height;
 }
 root.PortalLegend={forLayer,forLayers,colorExpression,sourceField,colorAt,gradientCSS,html,render,bind,plan,paintCanvas,palettes};
})(globalThis);
