/* Toolbar entry points and browser-local drawing. */
(function(){
 'use strict';
 const $=s=>document.querySelector(s),empty=()=>({type:'FeatureCollection',features:[]});
 const labelLimit=64;
 let map,active=false,kind='Polygon',points=[],settings={},annotations=new Map(),lastBuildingLayer=null,studyAreaId=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function buildingLayers(){return Array.from(window.PortalLayers?.layers.values()||[]).filter(l=>window.PortalAnalysisData?.isBuildingLayer(l));}
 function fillBuildings(select,preferred){
  if(!select)return;const choices=buildingLayers(),value=preferred||select.value||lastBuildingLayer||PortalLayers.active?.id;
  select.innerHTML=choices.length?choices.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.cfg.name)+'</option>').join(''):'<option value="">Add building footprints first</option>';
  select.value=choices.some(l=>l.id===value)?value:choices[0]?.id||'';
 }
 function studyStatus(){
  if(!$('#study-area-dialog'))return;
  const l=PortalLayers.layers.get($('#study-buildings').value),area=PortalLayers.layers.get(studyAreaId),live=l?.cfg.type==='viewport',unavailable=live&&(l.viewLoading||!l.loaded||l.error),b=l?.viewBounds,a=area?.bounds,outside=live&&b&&a&&(a[0][0]<b[0]||a[0][1]<b[1]||a[1][0]>b[2]||a[1][1]>b[3]);
  $('#study-summarize').disabled=!l||!area||unavailable;$('#study-download').disabled=!l||!area||unavailable;
  $('#study-area-name').textContent=area?.cfg.name||'Study area';
  $('#study-message').textContent=!area?'This study area was removed. Draw another area to continue.':!l?'Add USBF or another original building footprint layer, then choose your study area in Statistics.':live&&!l.visible?'Show this dataset and area on the map to load buildings.':l.error?'Buildings could not be loaded here. Show the area on the map to retry.':live&&l.viewLoading?'Loading buildings around this area…':live&&!l.loaded?'Show your study area on the map to load its buildings.':outside?'Part of your area is outside the loaded neighborhood. Show the area on the map to load it.':live?'Results use the buildings loaded around this area.':'Results use the complete building layer you selected.';
  $('#study-view-area').hidden=!area||!live||l.visible&&!outside&&(l.viewLoading||l.loaded)&&!l.error;
 }
 function openStudyArea(id,options={}){
  const area=PortalLayers.layers.get(id);if(!area)return;studyAreaId=id;
  if(!$('#study-area-dialog')){
   const d=document.createElement('dialog');d.id='study-area-dialog';d.className='workspace-dialog analysis-study-dialog';d.setAttribute('aria-labelledby','study-area-title');
   d.innerHTML='<div class="workspace-dialog-heading"><h2 id="study-area-title">Use your study area</h2><button data-close-study aria-label="Close">×</button></div><div class="workspace-dialog-body"><p id="study-area-name" class="analysis-study-name"></p><p>Include each building that touches or overlaps this area. Its full outline and height are kept.</p><label>Building dataset<select id="study-buildings"></select></label><p id="study-message" class="workspace-message" role="status"></p><div class="workspace-actions"><button type="button" class="primary" id="study-summarize">Summarize buildings</button><button type="button" id="study-download">Download buildings</button><button type="button" id="study-view-area" hidden>Show area on map</button></div><button type="button" id="study-add-data" class="analysis-text-button">Add building data</button></div>';
   document.body.append(d);d.querySelector('[data-close-study]').onclick=()=>d.close();$('#study-buildings').onchange=()=>{lastBuildingLayer=$('#study-buildings').value;studyStatus();};
   for(const [button,action] of [['study-summarize','stats'],['study-download','download']])$('#'+button).onclick=()=>{const buildingId=$('#study-buildings').value;lastBuildingLayer=buildingId;d.close();PortalAnalysis.openStudyArea(buildingId,studyAreaId,{action}).catch(e=>notify(e.message));};
   $('#study-add-data').onclick=()=>{d.close();PortalLayers.open('catalog');};
   $('#study-view-area').onclick=()=>{const area=PortalLayers.layers.get(studyAreaId),l=PortalLayers.layers.get($('#study-buildings').value);if(!area?.bounds||!l)return;PortalLayers.setStyle(l.id,{visible:true});map.fitBounds(area.bounds,{padding:55,maxZoom:17,duration:0});l.reload?.();PortalLayers.refresh();};
  }
  fillBuildings($('#study-buildings'),options.buildingLayerId||lastBuildingLayer);studyStatus();if(!$('#study-area-dialog').open)$('#study-area-dialog').showModal();
 }
 function notify(text){if(window.portal?.toast)portal.toast(text);else $('#status-message').textContent=text;}
 function closeMenus(){document.querySelectorAll('.tools-menu[open]').forEach(d=>d.open=false);}
 function createDialog(){
  if($('#drawing-dialog'))return;
  const d=document.createElement('dialog');d.id='drawing-dialog';d.className='workspace-dialog';d.innerHTML='<div class="workspace-dialog-heading"><h2>Draw on the map</h2><button data-close-drawing aria-label="Close">×</button></div><div class="workspace-dialog-body"><p>Draw a study area, a line or a point. Finished drawings become map layers you can keep and download.</p><form id="drawing-form" class="workspace-form"><label>Geometry<select id="draw-kind"><option value="Polygon">Polygon / study area</option><option value="LineString">Line</option><option value="Point">Point / annotation</option></select></label><label id="draw-buildings-wrap">Building dataset<select id="draw-buildings"></select></label><label>Layer name<input id="draw-name" value="Area of interest" maxlength="80" required></label><div class="form-row"><label>Label (optional)<input id="draw-label" maxlength="64" placeholder="Study area"></label><label>Color<input id="draw-color" type="color" value="#377c64"></label></div><div class="workspace-actions"><button class="primary" type="submit">Start drawing</button></div><p class="workspace-message" id="draw-message" role="status"></p></form></div>';document.body.append(d);
  d.querySelector('[data-close-drawing]').onclick=()=>d.close();$('#draw-kind').onchange=()=>$('#draw-buildings-wrap').hidden=$('#draw-kind').value!=='Polygon';$('#drawing-form').onsubmit=e=>{e.preventDefault();settings={name:$('#draw-name').value.trim()||'Drawing',label:$('#draw-label').value.trim(),color:$('#draw-color').value,buildingLayerId:$('#draw-buildings').value};kind=$('#draw-kind').value;lastBuildingLayer=settings.buildingLayerId||lastBuildingLayer;d.close();start();};
 }
 function open(){if(!map){notify('The map is still loading.');return;}createDialog();fillBuildings($('#draw-buildings'),PortalAnalysisData.isBuildingLayer(PortalLayers.active)?PortalLayers.active.id:lastBuildingLayer);$('#draw-kind').onchange();$('#draw-message').textContent='';$('#drawing-dialog').showModal();}
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
  const config={...settings},geometryKind=kind,d={type:'FeatureCollection',name:config.name,features:[f],provenance:{role:'user-drawing',crs:'EPSG:4326',createdAt:f.properties.created_at,geometryQuality:'full-source',scope:'complete-drawing'}};
  try{cancel();const layer=await PortalLayers.addGeoJSON(config.name,d,{color:config.color,sourceKind:'drawing',analysisQuality:'full-source',originalCrs:'EPSG:4326',provenance:d.provenance,attribution:'User drawing'});if(layer){restoreLayerLabels(layer);if(geometryKind==='Polygon')openStudyArea(layer.id,{buildingLayerId:config.buildingLayerId});}notify('Drawing added as a vector layer.');return layer;}
  catch(e){notify('Drawing could not be added: '+e.message);}
 }
 function addLabel(l,f,index=0){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='13px sans-serif';canvas.width=Math.ceil(Math.min(470,ctx.measureText(f.properties.label).width+18));canvas.height=30;ctx.font='13px sans-serif';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#d1ded5';ctx.strokeRect(.5,.5,canvas.width-1,canvas.height-1);ctx.fillStyle='#294a35';ctx.textBaseline='middle';ctx.fillText(f.properties.label,9,15,450);
  const id=l.id+'-annotation'+(index?'-'+index:'');map.addImage(id,ctx.getImageData(0,0,canvas.width,canvas.height));map.addSource(id,{type:'geojson',data:{type:'FeatureCollection',features:[f]}});map.addLayer({id,type:'symbol',source:id,layout:{'icon-image':id,'icon-anchor':'left','icon-offset':[9,0],'icon-allow-overlap':true,visibility:l.visible?'visible':'none'},paint:{'icon-opacity':l.opacity}});return id;
 }
 function removeLabels(id){for(const label of annotations.get(id)||[]){if(map.getLayer(label))map.removeLayer(label);if(map.getSource(label))map.removeSource(label);if(map.hasImage(label))map.removeImage(label);}annotations.delete(id);}
 function restoreLayerLabels(l){
  if(!map||!l||!PortalLayers.layers.has(l.id))return [];
  const p=l.data?.provenance||l.cfg.provenance;if(p?.role!=='user-drawing')return [];
  const features=(l.data?.features||[]).filter(f=>f.geometry?.type==='Point'&&typeof f.properties?.label==='string'&&f.properties.label.trim());
  if(features.length>labelLimit)throw Error('This drawing has too many labels. Keep up to '+labelLimit+' labels in a layer, or split the drawing into smaller layers.');
  if(annotations.has(l.id)&&(annotations.get(l.id)||[]).every(id=>map.getLayer(id)&&map.getSource(id)&&map.hasImage(id))){syncLabels();return annotations.get(l.id).slice();}
  removeLabels(l.id);
  const ids=features.map((f,index)=>addLabel(l,f,index));if(ids.length)annotations.set(l.id,ids);return ids;
 }
 function syncLabels(){if(!map)return;for(const [id,labels] of annotations){const l=PortalLayers.layers.get(id);if(!l)removeLabels(id);else for(const label of labels)if(map.getLayer(label)){map.setLayoutProperty(label,'visibility',l.visible?'visible':'none');map.setPaintProperty(label,'icon-opacity',l.opacity);}}}
 function init(){if(map||!window.portal?.ready)return;map=portal.map;map.addSource('workspace-drawing',{type:'geojson',data:empty()});map.addLayer({id:'workspace-drawing-line',type:'line',source:'workspace-drawing',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#236a58','line-width':2,'line-dasharray':[3,2]}});map.addLayer({id:'workspace-drawing-vertices',type:'circle',source:'workspace-drawing',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#ffffff','circle-stroke-color':'#236a58','circle-stroke-width':2}});
  const strip=document.createElement('div');strip.id='drawing-strip';strip.className='draw-strip';strip.hidden=true;strip.innerHTML='<span id="draw-progress"></span><button id="draw-undo">Undo</button><button class="draw-finish" id="draw-finish">Finish</button><button id="draw-cancel">Cancel</button>';$('.map-surface').append(strip);$('#draw-undo').onclick=()=>{points.pop();preview();};$('#draw-finish').onclick=finish;$('#draw-cancel').onclick=cancel;
  ['portal-layers-changed','portal-style-changed'].forEach(e=>document.addEventListener(e,()=>{syncLabels();if($('#drawing-dialog')?.open)fillBuildings($('#draw-buildings'));if($('#study-area-dialog')?.open){fillBuildings($('#study-buildings'));studyStatus();}}));
 }
 document.addEventListener('input',e=>{if(e.target.matches('[data-added-opacity]'))syncLabels();});
 document.addEventListener('portal-ready',init);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-workspace-tool]');if(b){closeMenus();const t=b.dataset.workspaceTool;if(['statistics','analysis','chart'].includes(t)){cancel();window.PortalAnalysis?.open(t==='statistics'?'stats':t);}else if(t==='draw')open();else if(t==='model-import')window.PortalLocalModels?.open();else if(t==='settings')window.PortalSettings?.open();else if(['map','download'].includes(t))window.PortalComposer?.open(t);}
  if(!e.target.closest('.tools-menu'))closeMenus();else if(e.target.closest('.tools-popover button'))closeMenus();if(e.target.closest('[data-tool],[data-open-models]'))cancel();
 });
 document.addEventListener('keydown',e=>{if(!active||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();finish();}if(e.key==='Backspace'){e.preventDefault();points.pop();preview();}});
 window.PortalDraw={open,start,cancel,finish,click,openStudyArea,restoreLayerLabels,labelLimit,labelLayerIds:l=>(annotations.get(typeof l==='string'?l:l?.id)||[]).slice(),get active(){return active;},get points(){return points.map(p=>p.slice());}};init();
})();
