/* Explain capabilities before formats. Never infer complete geometry from a
   GeoJSON extension or turn a display tile into an analytical source. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function format(layer){
  const c=layer?.cfg||{};
  if(c.nativeSource)return (c.nativeSource.format||'GeoParquet')+' · native';
  if(layer?.renderTiled)return 'PMTiles';
  if(c.raster?.format)return c.raster.format;
  if(c.type==='raster'&&c.service==='wms')return 'WMS';
  if(c.type==='viewport')return ['gba','usbf'].includes(c.driver)?'GeoParquet':'GeoJSON · API';
  const names={pmtiles:'PMTiles',vector:'MVT',geojson:'GeoJSON',csv:'CSV',shapefile:'Shapefile',kml:'KML',geoparquet:'GeoParquet',geotiff:'GeoTIFF',image:'Image',raster:'Raster tiles','raster-pmtiles':'PMTiles'};
  return names[c.sourceFormat]||names[c.type]||'Data';
 }
 function describe(layer,{catalog=false}={}){
  const c=layer?.cfg||{},cap=root.PortalAnalysisData?.capabilities(layer)||{},fileFormat=format(layer);
  const demand=cap.kind==='on-demand'||catalog&&c.driver==='usbf';
  if(c.nativeSource&&root.PortalNativeResults?.live(layer))return {kind:'native',label:'Complete local result · view tiles',format:fileFormat,note:'Map tiles browse the complete local file. Attributes, selection and processing use original records through the local engine.'};
  if(c.nativeSource)return {kind:'native',label:'Native result · bounded map preview',format:fileFormat,note:'Complete records stay in the local Results file. The map shows a bounded preview; tables and processing use the full native result.'};
  if(cap.kind==='native-preview')return {kind:'preview',label:'Bounded native preview',format:fileFormat,note:'This shared preview contains display records only. The full native result is a separate local dependency.'};
  if(root.PortalDataWorkspace?.isArea(layer))return {kind:'original',label:'Saved study area',format:fileFormat,note:'Saved boundary · not building records'};
  const source=root.PortalDataSources?.describe?.(layer);
  if(source?.kind==='provider'&&source.nativeLoad&&!source.browserLoad)return {kind:'preview',label:'Map preview',format:fileFormat,note:'Load original building records for a saved area with the local engine on a desktop computer.',action:'load',actionLabel:'Load analyzable data'};
  if(c.type==='viewport'&&!demand)return {kind:!catalog&&(layer.viewLoading||layer.error||layer.loaded===false)?'pending':layer.viewLimited?'partial':'preview',label:!catalog&&(layer.viewLoading||layer.error||layer.loaded===false)?'Live cache loading or unavailable':layer.viewLimited?'Partial live cache':'Live source cache',format:fileFormat,note:'Display scope follows the map; create a fixed analysis workset before analysis.',action:'load',actionLabel:'Create analysis workset'};
  if(demand)return {kind:'preview',label:'Map preview',format:layer?.renderTiled||catalog?'PMTiles':fileFormat,note:'For building counts, areas and spatial tools, load original records for an area.',action:'load',actionLabel:'Load area & analyze'};
  if(cap.attributePreview||['pmtiles','vector'].includes(c.type)&&!['raster'].includes(c.sourceKind))return {kind:'preview',label:'Map preview',format:fileFormat,note:'Display outlines may be cut or simplified. Add original data before counting buildings or measuring areas.',action:'original',actionLabel:'Find original data'};
  if(catalog&&['viewport','geojson'].includes(c.type))return {kind:'ready',label:'Analysis data',format:fileFormat,note:c.type==='viewport'?'Original records load for the area you view.':'Tools use the records in the loaded file.'};
  if(cap.geometryAnalysis){
   if(c.type==='viewport'&&(layer.viewLoading||!layer.loaded||layer.error))return {kind:'pending',label:layer.error?'Coverage incomplete':'Loading analysis data',format:fileFormat,note:'Wait for this area to finish loading before analysis.'};
   const p=layer.data?.provenance||c.provenance;
   if(layer.viewLimited||p?.limited)return {kind:'partial',label:'Partial analysis data',format:fileFormat,note:'Only loaded records are included. Results do not describe the whole area.'};
   return {kind:'ready',label:'Analysis data',format:fileFormat,note:c.type==='viewport'?'Analysis uses only the loaded neighborhood.':p?.requestedView||p?.loadedView?'Analysis uses only the saved area.':'Analysis uses the records in this layer.'};
  }
  return {kind:'image',label:'Image preview',format:fileFormat,note:'This image supplies a visual reference, not building records for these tools.'};
 }
 function badges(state){return '<div class="layer-purpose-badges"><span class="layer-purpose-badge purpose-'+state.kind+'" data-i18n>'+esc(state.label)+'</span><span class="layer-format">'+esc(state.format)+'</span></div>';}
 /* Group by access to fixed original records, independently of visibility,
    connection health and the file used to draw their map preview. */
 function section(layer){
  if(layer?.cfg?.nativeSource)return 'analysis';
  return layer?.cfg?.type==='geojson'&&root.PortalAnalysisData?.capabilities(layer).geometryAnalysis?'analysis':'display';
 }
 function markup(layer,options={}){
  const state=describe(layer,options),id=layer?.id,cap=root.PortalAnalysisData?.capabilities(layer)||{},loading=root.PortalAnalysisLayers?.isLoading(layer),message=root.PortalAnalysisLayers?.message(layer);
  const button=(action,label,disabled=false)=>'<button type="button" class="layer-purpose-action" data-purpose-action="'+action+'" data-purpose-layer="'+esc(id)+'" '+(disabled?'disabled':'')+' data-i18n>'+esc(label)+'</button>';
  let actions='';
  if(id&&options.actions!==false){
   if(root.PortalLayerActions){
    const primary=state.action?['load-data']:['table'];
    actions=root.PortalLayerActions.markup(layer,{ids:primary,legacyPurpose:{'load-data':'data',table:'table'}});
    // Keep legacy selectors callable without presenting duplicate operations.
    if(state.action)actions+=root.PortalLayerActions.markup(layer,{ids:['load-data'],legacyPurpose:{'load-data':state.action}}).replace('<button ','<button hidden ');
   }else{
   if(layer.cfg.nativeSource)actions=button('native-table','View full result table')+button('native-process','Process full native result');
   if(state.action)actions=button('data','Load analyzable data',loading)+button(state.action,state.actionLabel,loading);
   if(cap.geometryAnalysis&&cap.kind!=='on-demand'&&layer.cfg.type==='viewport')actions+=button('data','Load another range',loading);
   if(cap.geometryAnalysis&&cap.kind!=='on-demand'&&['geojson','viewport'].includes(layer.cfg.type))actions+=button('table','View attribute table',layer.cfg.type==='viewport'&&(layer.viewLoading||!layer.loaded||layer.error));
   }
   if(loading)actions+=button('cancel-data','Cancel loading');
  }
  return '<div class="layer-purpose" data-purpose-kind="'+state.kind+'">'+badges(state)+(root.PortalDataWorkspace?.layerFacts(layer)||'')+'<p data-i18n>'+esc(state.note)+'</p>'+(actions?'<div class="layer-purpose-actions">'+actions+'</div>':'')+(message?'<p class="layer-analysis-message '+(message.error?'error':'')+'" role="status" data-i18n-system>'+esc(message.text)+'</p>':'')+'</div>';
 }
 function analysisMarkup(layer){
  if(!layer)return '';
  if(root.PortalAnalysisData?.capabilities(layer).kind==='on-demand')return '<div class="analysis-purpose-box">'+badges({kind:'original',label:'Analysis uses original records',format:'GeoParquet'})+'<p data-i18n>The map stays a preview. These tools load original records for the chosen area and record any coverage limits.</p></div>';
  return '<div class="analysis-purpose-box">'+markup(layer,{actions:false})+'</div>';
 }
 function original(layer){
  if(root.PortalImport?.details)root.PortalImport.details(layer);
  else root.PortalLayers?.open('catalog');
 }
 function act(layer,action){
  if(!layer||root.PortalLayers?.layers.get(layer.id)!==layer)return;
  if(root.PortalLayerActions&&action!=='cancel-data')return root.PortalLayerActions.run(action,layer).catch(e=>root.portal?.toast(e.message));
  if(['data','load','original'].includes(action)&&root.PortalDataWorkspace){root.PortalDataWorkspace.open({layer});return;}
  if(action==='native-table'){root.PortalTasks.openNativeTable(layer).catch(e=>root.portal?.toast(e.message));return;}
  if(action==='native-process'){root.PortalLayers.selectLayer(layer.id);root.PortalGIS.open('extract-mask');return;}
  if(action==='data'){root.PortalAnalysisLayers?.open(layer);return;}
  if(action==='cancel-data'){root.PortalAnalysisLayers?.cancel(layer);return;}
  if(action==='table'){root.PortalInventory?.openTable(layer.id,{scope:'loaded'});return;}
  if(action==='load'&&root.PortalAnalysisData?.capabilities(layer).kind==='on-demand'){
   root.PortalLayers.selectLayer(layer.id);root.PortalAnalysis.open('stats',{layerId:layer.id,scope:'view'});
  }else if(action==='original')original(layer);
 }
 if(root.document)document.addEventListener('click',event=>{const b=event.target.closest('[data-purpose-action]');if(b)act(root.PortalLayers?.layers.get(b.dataset.purposeLayer),b.dataset.purposeAction);});
 root.PortalLayerPurpose={section,describe,format,markup,analysisMarkup,act,original};
})(globalThis);
