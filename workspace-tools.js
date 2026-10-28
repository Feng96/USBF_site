/* Toolbar entry points and browser-local drawing. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s),empty=()=>({type:'FeatureCollection',features:[]});
 let map,active=false,kind='Polygon',points=[],settings={},annotations=new Map();
 function notify(text){if(window.portal?.toast)portal.toast(text);else $('#status-message').textContent=text;}
 function closeMenus(){document.querySelectorAll('.tools-menu[open]').forEach(d=>d.open=false);}
 function createDialog(){
  if($('#drawing-dialog'))return;
  const d=document.createElement('dialog');d.id='drawing-dialog';d.className='workspace-dialog';d.innerHTML='<div class="workspace-dialog-heading"><h2>Draw on the map</h2><button data-close-drawing aria-label="Close">×</button></div><div class="workspace-dialog-body"><p>Create a vector layer for annotations or an analysis boundary. Drawing stays in your browser; download it to keep a copy.</p><form id="drawing-form" class="workspace-form"><label>Geometry<select id="draw-kind"><option value="Polygon">Polygon / area of interest</option><option value="LineString">Line</option><option value="Point">Point / annotation</option></select></label><label>Layer name<input id="draw-name" value="Area of interest" maxlength="80" required></label><div class="form-row"><label>Label (optional)<input id="draw-label" maxlength="64" placeholder="Study area"></label><label>Color<input id="draw-color" type="color" value="#377c64"></label></div><div class="workspace-actions"><button class="primary" type="submit">Start drawing</button></div><p class="workspace-message" id="draw-message" role="status"></p></form></div>';document.body.append(d);
  d.querySelector('[data-close-drawing]').onclick=()=>d.close();$('#drawing-form').onsubmit=e=>{e.preventDefault();settings={name:$('#draw-name').value.trim()||'Drawing',label:$('#draw-label').value.trim(),color:$('#draw-color').value};kind=$('#draw-kind').value;d.close();start();};
 }
 function open(){if(!map){notify('The map is still loading.');return;}createDialog();$('#draw-message').textContent='';$('#drawing-dialog').showModal();}
 function preview(){const fs=points.map(p=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}}));if(points.length>1)fs.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}});map.getSource('workspace-drawing')?.setData({type:'FeatureCollection',features:fs});$('#draw-progress').textContent=kind==='Point'?'Click a location':points.length+' vertices · click to add';}
 function start(){cancel();portal.setTool('explore');active=true;points=[];map.doubleClickZoom.disable();map.getCanvas().style.cursor='crosshair';$('#drawing-strip').hidden=false;$('#draw-finish').hidden=kind==='Point';$('#tool-hint').textContent='Click map vertices. Finish to save; Escape to cancel.';preview();}
 function cancel(){active=false;points=[];map?.getSource('workspace-drawing')?.setData(empty());if(map){map.doubleClickZoom.enable();map.getCanvas().style.cursor='';}const s=$('#drawing-strip');if(s)s.hidden=true;}
 function click(e){if(!active)return;const p=[e.lngLat.lng,e.lngLat.lat];if(!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>85){notify('Draw within the map’s supported geographic extent.');return;}if(points.length>=500){notify('A drawing can contain up to 500 vertices.');return;}if(!points.length||Math.abs(points.at(-1)[0]-p[0])+Math.abs(points.at(-1)[1]-p[1])>1e-10)points.push(p);preview();if(kind==='Point')finish();}
 async function finish(){
  if(!active)return;
  const minimum=kind==='Polygon'?3:kind==='LineString'?2:1;if(points.length<minimum){notify('Add at least '+minimum+' vertices.');return;}
  const geometry={type:kind,coordinates:kind==='Point'?points[0]:kind==='Polygon'?[[...points,points[0]]]:points.slice()};
  const f={type:'Feature',properties:{label:settings.label,source:'User drawing',created_at:new Date().toISOString()},geometry};
  if(kind==='Polygon'&&window.turf){if(turf.kinks(f).features.length||turf.area(f)<.01){notify('The polygon crosses itself or has no area. Undo a vertex and try again.');return;}}
  const config={...settings},d={type:'FeatureCollection',name:config.name,features:[f],provenance:{role:'user-drawing',crs:'EPSG:4326',createdAt:f.properties.created_at,geometryQuality:'full-source',scope:'complete-drawing'}};
  try{cancel();const layer=await PortalLayers.addGeoJSON(config.name,d,{color:config.color,sourceKind:'drawing',analysisQuality:'full-source',originalCrs:'EPSG:4326',provenance:d.provenance,attribution:'User drawing'});if(layer&&kind==='Point'&&config.label)addLabel(layer,f);notify('Drawing added as a vector layer.');}
  catch(e){notify('Drawing could not be added: '+e.message);}
 }
 function addLabel(l,f){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='13px sans-serif';canvas.width=Math.ceil(Math.min(470,ctx.measureText(f.properties.label).width+18));canvas.height=30;ctx.font='13px sans-serif';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#d1ded5';ctx.strokeRect(.5,.5,canvas.width-1,canvas.height-1);ctx.fillStyle='#294a35';ctx.textBaseline='middle';ctx.fillText(f.properties.label,9,15,450);
  const id=l.id+'-annotation';map.addImage(id,ctx.getImageData(0,0,canvas.width,canvas.height));map.addSource(id,{type:'geojson',data:{type:'FeatureCollection',features:[f]}});map.addLayer({id,type:'symbol',source:id,layout:{'icon-image':id,'icon-anchor':'left','icon-offset':[9,0],'icon-allow-overlap':true},paint:{'icon-opacity':l.opacity}});annotations.set(l.id,id);
 }
 function syncLabels(){if(!map)return;for(const [id,label] of annotations){const l=PortalLayers.layers.get(id);if(!l){if(map.getLayer(label))map.removeLayer(label);if(map.getSource(label))map.removeSource(label);if(map.hasImage(label))map.removeImage(label);annotations.delete(id);}else if(map.getLayer(label)){map.setLayoutProperty(label,'visibility',l.visible?'visible':'none');map.setPaintProperty(label,'icon-opacity',l.opacity);}}}
 function init(){if(map||!window.portal?.ready)return;map=portal.map;map.addSource('workspace-drawing',{type:'geojson',data:empty()});map.addLayer({id:'workspace-drawing-line',type:'line',source:'workspace-drawing',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#236a58','line-width':2,'line-dasharray':[3,2]}});map.addLayer({id:'workspace-drawing-vertices',type:'circle',source:'workspace-drawing',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#ffffff','circle-stroke-color':'#236a58','circle-stroke-width':2}});
  const strip=document.createElement('div');strip.id='drawing-strip';strip.className='draw-strip';strip.hidden=true;strip.innerHTML='<span id="draw-progress"></span><button id="draw-undo">Undo</button><button class="draw-finish" id="draw-finish">Finish</button><button id="draw-cancel">Cancel</button>';$('.map-surface').append(strip);$('#draw-undo').onclick=()=>{points.pop();preview();};$('#draw-finish').onclick=finish;$('#draw-cancel').onclick=cancel;
  ['portal-layers-changed','portal-style-changed'].forEach(e=>document.addEventListener(e,syncLabels));
 }
 document.addEventListener('input',e=>{if(e.target.matches('[data-added-opacity]'))syncLabels();});
 document.addEventListener('portal-ready',init);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-workspace-tool]');if(b){closeMenus();const t=b.dataset.workspaceTool;if(['statistics','analysis','chart'].includes(t)){cancel();window.PortalAnalysis?.open(t==='statistics'?'stats':t);}else if(t==='draw')open();else if(t==='model-import')window.PortalLocalModels?.open();else if(t==='settings')window.PortalSettings?.open();else if(['map','download'].includes(t))window.PortalComposer?.open(t);}
  if(!e.target.closest('.tools-menu'))closeMenus();else if(e.target.closest('.tools-popover button'))closeMenus();if(e.target.closest('[data-tool],[data-open-models]'))cancel();
 });
 document.addEventListener('keydown',e=>{if(!active||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();finish();}if(e.key==='Backspace'){e.preventDefault();points.pop();preview();}});
 window.PortalDraw={open,start,cancel,finish,click,get active(){return active;},get points(){return points.map(p=>p.slice());}};init();
})();
