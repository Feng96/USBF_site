/* Multi-record selection is keyed by original object identity, not source IDs.
   Duplicate IDs stay distinct; changed viewport data invalidates stale sets. */
(function(root){
 'use strict';
 const states=new WeakMap();let map,mode='',operation='replace',busy=false,origin=null,lastBox=null,vertices=[],overlay,strip,anchor=new WeakMap();
 const empty=()=>({type:'FeatureCollection',features:[]}),active=()=>root.PortalLayers?.active;
 function state(l){let s=states.get(l);if(!s||s.data!==l.data){s={data:l.data,set:new Set(),engaged:false};states.set(l,s);}return s;}
 function features(l=active()){return l?Array.from(state(l).set):[];}
 function engaged(l=active()){return !!l&&state(l).engaged;}
 function count(l=active()){return l?state(l).set.size:0;}
 function has(l,f){return !!l&&state(l).set.has(f);}
 function update(){
  if(!map)return;const l=active(),items=l?features(l):[];map.getSource('gis-bulk-selection')?.setData({type:'FeatureCollection',features:items});
  const label=document.querySelector('[data-gis-selection-count]');if(label)label.textContent=items.length.toLocaleString('en-US');
  root.PortalInventory?.refresh();document.dispatchEvent(new CustomEvent('portal-bulk-selection-changed'));
 }
 function set(l,items,op=operation){
  if(!l||root.PortalLayers.layers.get(l.id)!==l)return;
  if(!root.PortalInventory.tableData.supportsLoaded(l))throw Error('Load an original analysis layer before selecting records.');
  const pool=new Set(l.data.features);if(items.some(f=>!pool.has(f)))throw Error('The layer changed. Select the records again.');
  const s=state(l),incoming=new Set(items);let next=op==='replace'?incoming:new Set(s.set);
  if(op==='add')for(const f of incoming)next.add(f);if(op==='subtract')for(const f of incoming)next.delete(f);if(op==='intersect')next=new Set([...next].filter(f=>incoming.has(f)));
  if(next.size>20000)throw Error('Select up to 20,000 original records at a time.');s.set=next;s.engaged=true;update();return next.size;
 }
 function clear(l=active()){if(l){state(l).set.clear();state(l).engaged=true;anchor.delete(l);if(root.PortalLayers.selection?.layer===l.id)root.PortalLayers.clearExternalSelection();}update();}
 function row(l,f,event,rows){
  if(!root.PortalInventory.tableData.supportsLoaded(l))return;
  const prior=anchor.get(l),i=rows.indexOf(f);
  if(event?.shiftKey&&prior&&rows.includes(prior)){const a=rows.indexOf(prior);set(l,rows.slice(Math.min(a,i),Math.max(a,i)+1),event.ctrlKey||event.metaKey?'add':'replace');}
  else if(event?.ctrlKey||event?.metaKey)set(l,[f],has(l,f)?'subtract':'add');else set(l,[f],'replace');anchor.set(l,f);
 }
 async function original(l,range){
  const cap=root.PortalAnalysisData.capabilities(l);if(cap.kind==='on-demand'||l.cfg.type==='viewport'){if(root.PortalDataWorkspace){root.PortalDataWorkspace.open({layer:l,range:range||undefined,intent:'selection'});throw Error('Save the study area and load an analysis workset before selecting original buildings.');}
   const snapshot=await root.PortalGISCore.capture(l,{range});if(!snapshot.features.length)throw Error('No original buildings were found in this area.');
   const d=root.PortalGISCore.result(snapshot.features,[snapshot],'selection-area',{range});return root.PortalGIS.add(d,l.cfg.name+' · selection area');
  }
  if(!root.PortalInventory.tableData.supportsLoaded(l))throw Error('Load original data before selecting buildings.');return l;
 }
 async function selectMask(mask,op=operation){
  if(busy)return;const source=active();if(!source)throw Error('Choose a layer first.');busy=true;
  try{const range=root.PortalGISRange.value(root.PortalGISCore.validateMask(mask),'Map selection',{kind:'map-selection',crs:'EPSG:4326'}),l=await original(source,range);set(l,await root.PortalGISCore.filterAsync(l.data.features,range.mask),op);}
  finally{busy=false;}
 }
 function notify(error){root.portal?.toast(error.message||String(error));}
 function start(next){
  cancel();if(!map)return;root.PortalDraw?.cancel();root.portal.setTool('explore');mode=next;
  map.getCanvas().style.cursor='crosshair';map.doubleClickZoom.disable();if(next==='box'||next==='area-box') {map.dragPan.disable();map.boxZoom.disable();}
  strip.hidden=false;strip.querySelector('[data-gis-finish]').hidden=!next.includes('polygon');strip.querySelector('[data-gis-selection-help]').textContent=next.includes('box')?'Drag a box to define the boundary':next.includes('polygon')?'Click polygon corners, then Finish':'Click a building; Ctrl/Cmd toggles selection';
  document.querySelectorAll('[data-gis-select]').forEach(b=>b.classList.toggle('active',b.dataset.gisSelect===mode));
 }
 function cancel(){mode='';origin=null;vertices=[];sketch();if(map){map.dragPan.enable();map.boxZoom.enable();map.doubleClickZoom.enable();map.getCanvas().style.cursor='';}if(overlay)overlay.hidden=true;if(strip)strip.hidden=true;document.querySelectorAll('[data-gis-select]').forEach(b=>b.classList.remove('active'));}
 function sketch(){const fs=vertices.map(p=>root.turf.point(p));if(vertices.length>1)fs.push(root.turf.lineString(vertices));map?.getSource('gis-selection-sketch')?.setData({type:'FeatureCollection',features:fs});}
 function finish(){if(vertices.length<3){notify('Add at least three polygon corners.');return;}const mask={type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...vertices,vertices[0]]]}};lastBox=mask;vertices=[];sketch();if(mode==='area-polygon'){cancel();root.PortalDataWorkspace.setDraft(root.PortalGISRange.value(mask,'Drawn polygon',{kind:'drawn-polygon',crs:'EPSG:4326'}));return;}selectMask(mask).catch(notify);}
 function click(e){
  if(!mode)return false;if(mode==='box'||mode==='area-box')return true;
  if(mode==='polygon'||mode==='area-polygon'){if(vertices.length>=500){notify('Use up to 500 selection vertices.');return true;}vertices.push([e.lngLat.lng,e.lngLat.lat]);sketch();strip.querySelector('[data-gis-selection-help]').textContent=vertices.length+' polygon corners';return true;}
  if(busy)return true;busy=true;const l=active(),point=[e.lngLat.lng,e.lngLat.lat],event=e.originalEvent||{};
  (async()=>{if(!l)throw Error('Choose a layer first.');const local=await original(l,null),hits=root.PortalGISCore.filter(local.data.features,root.turf.bboxPolygon([point[0]-.000001,point[1]-.000001,point[0]+.000001,point[1]+.000001]));if(hits.length){const f=hits[0],op=event.ctrlKey||event.metaKey?(has(local,f)?'subtract':'add'):event.shiftKey?'add':operation;set(local,[f],op);if(has(local,f))root.PortalLayers.inspect(local,f);else root.PortalLayers.clearExternalSelection();}})().catch(notify).finally(()=>busy=false);return true;
 }
 function init(){if(map||!root.portal?.ready)return;map=root.portal.map;const s='gis-bulk-selection';map.addSource(s,{type:'geojson',data:empty()});map.addLayer({id:s+'-fill',type:'fill',source:s,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#8952b3','fill-opacity':.2}});map.addLayer({id:s+'-line',type:'line',source:s,paint:{'line-color':'#8b3db8','line-width':2.5}});map.addLayer({id:s+'-point',type:'circle',source:s,filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'#8b3db8','circle-radius':7,'circle-opacity':.6}});
  map.addSource('gis-selection-sketch',{type:'geojson',data:empty()});map.addLayer({id:'gis-selection-sketch-line',type:'line',source:'gis-selection-sketch',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#8b3db8','line-width':2,'line-dasharray':[2,2]}});map.addLayer({id:'gis-selection-sketch-points',type:'circle',source:'gis-selection-sketch',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':4,'circle-color':'#8b3db8'}});
  overlay=document.createElement('div');overlay.className='gis-selection-rectangle';overlay.hidden=true;map.getCanvasContainer().append(overlay);
  strip=document.createElement('div');strip.className='gis-selection-strip';strip.hidden=true;strip.innerHTML='<span data-gis-selection-help data-i18n-system></span><select data-gis-selection-mode><option value="replace" data-i18n>Replace selection</option><option value="add" data-i18n>Add to selection</option><option value="subtract" data-i18n>Remove from selection</option><option value="intersect" data-i18n>Keep common selection</option></select><button data-gis-finish data-i18n>Finish</button><button data-gis-stop data-i18n>Done selecting</button>';document.querySelector('.map-surface').append(strip);strip.querySelector('[data-gis-selection-mode]').onchange=e=>operation=e.target.value;strip.querySelector('[data-gis-stop]').onclick=cancel;strip.querySelector('[data-gis-finish]').onclick=finish;
  map.on('mousedown',e=>{if(!['box','area-box'].includes(mode)||busy||e.originalEvent.button!==0)return;e.preventDefault();origin={x:e.point.x,y:e.point.y};overlay.hidden=false;Object.assign(overlay.style,{left:origin.x+'px',top:origin.y+'px',width:'0px',height:'0px'});});
  map.on('mousemove',e=>{if(!origin)return;Object.assign(overlay.style,{left:Math.min(origin.x,e.point.x)+'px',top:Math.min(origin.y,e.point.y)+'px',width:Math.abs(origin.x-e.point.x)+'px',height:Math.abs(origin.y-e.point.y)+'px'});});
  map.on('mouseup',e=>{if(!origin)return;const a=origin;origin=null;overlay.hidden=true;if(Math.abs(a.x-e.point.x)<3||Math.abs(a.y-e.point.y)<3)return;const w=Math.min(a.x,e.point.x),s=Math.max(a.y,e.point.y),east=Math.max(a.x,e.point.x),n=Math.min(a.y,e.point.y),ring=[[w,s],[east,s],[east,n],[w,n],[w,s]].map(p=>{const ll=map.unproject(p);return [ll.lng,ll.lat];});lastBox=root.turf.polygon([ring]);if(mode==='area-box'){cancel();root.PortalDataWorkspace.setDraft(root.PortalGISRange.value(lastBox,'Drawn box',{kind:'drawn-box',crs:'EPSG:4326'}));return;}const op=e.originalEvent?.ctrlKey?'subtract':e.originalEvent?.shiftKey?'add':operation;selectMask(lastBox,op).catch(notify);});
  document.addEventListener('portal-layers-changed',update);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))cancel();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-tool],[data-workspace-tool=draw],[data-open-models]'))cancel();if(e.target.closest('[data-action=clear-selection]'))clear();});
 }
 root.PortalGISSelection={init,set,clear,features,count,engaged,has,row,start,cancel,click,selectMask,finish,get lastBox(){return lastBox;},get active(){return mode;},get busy(){return busy;}};document.addEventListener('portal-ready',init);if(root.portal?.ready)init();
})(globalThis);
