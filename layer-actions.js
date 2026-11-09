/* One operation contract for every layer surface. Storage and display formats
   never grant original-data capabilities. Actions always receive a layer ID. */
(function(root){
 'use strict';
 const labels={quality:'Data quality report',zones:'Summarize by area',table:'Attribute table',processing:'Geoprocessing',statistics:'Statistics',chart:'Charts',export:'Download data','load-data':'Load analyzable data',compare:'Compare sources',style:'Layer style',rename:'Rename layer',zoom:'Zoom to layer',up:'Move up',down:'Move down',duplicate:'Duplicate layer',extent:'Create layer extent',remove:'Remove layer',details:'Details',retry:'Retry',refresh:'Refresh data'};
 const aliases={'zoom-layer':'zoom','rename-layer':'rename','duplicate-layer':'duplicate','extent-layer':'extent','layer-up':'up','layer-down':'down','remove-layer':'remove','native-table':'table','native-process':'processing',stats:'statistics',data:'load-data',load:'load-data',original:'load-data','load-range':'load-data'};
 const ids=Object.freeze(Object.keys(labels)),management=Object.freeze(['zoom','style','rename','duplicate','extent','up','down','details','refresh','retry','remove']);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=s=>root.PortalI18n?.t(s)||s,canonical=id=>aliases[id]||id;
 function resolve(value){return typeof value==='string'?root.PortalLayers?.layers.get(value):value;}
 function nativeExtent(layer){const b=layer?.nativeMap?.bounds;return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3]?b:null;}
 function describe(value){
  const layer=resolve(value),cfg=layer?.cfg||{},cap=root.PortalAnalysisData?.capabilities(layer)||{},native=!!cfg.nativeSource,raster=!!layer&&(root.PortalLayers?.isRaster?.(layer)||cap.kind==='display-only'),preview=cap.kind==='native-preview';
  const attached=!!layer?.id&&root.PortalLayers?.layers.get(layer.id)===layer,source=root.PortalDataSources?.describe?.(layer),area=!!root.PortalDataWorkspace?.isArea?.(layer);
  const ready=root.PortalDataWorkspace?.ready?.(layer)??!!(cap.geometryAnalysis&&cfg.type==='geojson'&&!area),engine=root.PortalNativeEngine?.status?.(),workspace=engine?.information?.workspace?.id||engine?.information?.workspaceId;
  const nativeReady=native&&!!engine?.connected&&workspace===cfg.nativeSource.workspaceId;
  const loadable=!!(source?.browserLoad||source?.nativeLoad||ready||native||cap.kind==='on-demand'||cfg.type==='viewport'&&typeof layer?.reload==='function');
  const order=Array.from(root.PortalLayers?.layers.values()||[]),at=order.indexOf(layer),noLayer='Choose a layer first.',fixed='Load a fixed analysis workset before using this operation.',nativeConnection='Connect the workspace containing the full native result.',display='This layer contains display records only. Load original vector records first.';
  const byId={},actions=ids.map(id=>{
   let enabled=attached,reason=attached?'':noLayer,scope='layer';
   function require(condition,note){if(enabled&&!condition){enabled=false;reason=note;}}
   if(['processing','statistics','chart'].includes(id)){
    require(ready||native,preview||raster||cap.attributePreview?display:fixed);
    if(native){require(nativeReady,nativeConnection);scope='native-result';}
    if(native&&id==='statistics')require(!!engine?.information?.capabilities?.resultSummary,'Update and pair the local engine to summarize full results.');
    if(id==='chart'&&native)require(!!engine?.information?.capabilities?.resultCharts,'Update the local engine to chart complete native results.');
   }
   if(['quality','zones'].includes(id)){
    const capability=root.PortalStudyReports?.capability?.(layer,id);
    require(ready||native,preview||raster||cap.attributePreview?display:fixed);
    require(!!root.PortalStudyReports,'The data report tools are still loading.');
    if(native){require(nativeReady,nativeConnection);scope='native-result';}
    if(capability)require(capability.enabled,capability.reason);
   }
   if(id==='table'){
    require(!raster,'Raster display layers do not supply vector records.');
    if(native){require(nativeReady,nativeConnection);scope='native-result';}
    else scope=ready?'loaded-records':'display-preview';
   }
   if(id==='export'){
    require(ready||native||!!cfg.originalFile,'Download original data from the provider. Display previews are not full-data exports.');
    if(native){require(nativeReady,nativeConnection);scope='native-result';}
   }
   if(id==='load-data')require(loadable,'No original-data adapter is available for this connection. Import an original file or choose another source.');
   if(id==='compare'){const eligible=root.PortalSourceComparison?.eligible?.(layer)??(ready||native);require(!!root.PortalSourceComparison?.open&&!raster&&!area&&!preview&&(eligible||source?.kind==='provider'&&source.originalAvailable),'Load at least two original building worksets for the same study area to compare.');}
   if(id==='zoom')require(!!layer?.bounds,'This layer has no extent.');
   if(id==='up')require(at>=0&&at<order.length-1,'This layer is already at the top.');
   if(id==='down')require(at>0,'This layer is already at the bottom.');
   if(id==='duplicate'){require(cfg.type!=='image','Reopen the original raster to create an independent image copy.');require(!cfg.localArchive,'Reopen the original PMTiles file to create an independent connection.');}
   if(id==='extent'){
    if(native){require(nativeReady&&!!root.PortalNativeResults?.live?.(layer),'A bounded native preview cannot define the extent of the full result. Use a saved study area.');require(!!nativeExtent(layer),'This layer has no known extent.');scope='native-result-extent';}
    else{require(!preview,'A bounded native preview cannot define the extent of the full result. Use a saved study area.');require(!!layer?.bounds||ready&&!!layer?.data?.features?.length,'This layer has no extent.');}
   }
   if(id==='retry')require(!!layer?.error,'This layer has no failed request to retry.');
   if(id==='refresh'){require(typeof layer?.checkUpdates==='function','This source has no automatic release refresh.');require(!layer?.checkingRelease,'Refreshing data…');}
   if(root.PortalReadOnlyMode)require(['zoom','details','table'].includes(id),'This shared map is read-only.');
   const action={id,label:labels[id],enabled,reason,scope};byId[id]=action;return action;
  });
  return {layerId:layer?.id||null,kind:native?'native-result':cap.kind||'display-only',actions,byId};
 }
 function get(value,id){return describe(value).byId[canonical(id)];}
 function markup(value,options={}){
  const state=describe(value),chosen=options.ids||ids;
  return chosen.map(name=>{const a=state.byId[canonical(name)];if(!a)return '';const legacy=options.legacyPurpose?.[a.id],hint=a.reason||options.hints?.[a.id]||'',added={zoom:'data-added-zoom',details:'data-added-info',retry:'data-added-retry',refresh:'data-added-update',up:'data-layer-up',down:'data-layer-down',remove:'data-added-remove'},attribute=options.legacyAdded&&added[a.id];
   return '<button type="button" class="'+esc(options.className||'layer-purpose-action')+'" data-layer-action="'+a.id+'" data-layer-id="'+esc(state.layerId)+'"'+(attribute?' '+attribute+'="'+esc(state.layerId)+'"':'')+(legacy?' data-purpose-action="'+esc(legacy)+'" data-purpose-layer="'+esc(state.layerId)+'"':'')+(a.enabled?'':' disabled aria-disabled="true"')+(hint?' title="'+esc(t(hint))+'"':'')+' data-i18n>'+esc(a.label)+'</button>'+(options.explainDisabled&&!a.enabled?'<small class="layer-action-reason" data-i18n>'+esc(a.reason)+'</small>':'');
  }).join('');
 }
 function settings(layer,field){const row=root.document?.querySelector('[data-added-row="'+layer.id+'"]'),details=row?.querySelector('.layer-details');if(details)details.open=true;const input=row?.querySelector(field);input?.focus();if(field==='[data-added-name]')input?.select();return row;}
 function recordMode(options){
  const value=options.mode??options.scope;if(value===undefined)return null;
  const mode=root.PortalDataWorkspace?.normalize?root.PortalDataWorkspace.normalize(value):value==='layer'?'all':value;
  if(!['all','selection','area'].includes(mode))throw Error('Map view is a display extent. Save it as a study area before analysis.');return mode;
 }
 function output(detail){root.document?.dispatchEvent?.(new CustomEvent('portal-workflow-output',{detail:{projectId:root.PortalProjects?.current?.id||null,...detail}}));}
 function stillCurrent(layer,data,ref){if(root.PortalLayers.layers.get(layer.id)!==layer||layer.data!==data||JSON.stringify(layer.cfg.nativeSource||null)!==ref)throw Error('The input data changed. Choose it again.');}
 async function run(name,value,options={}){
  const id=canonical(name),layer=resolve(value),action=get(layer,id);if(!action)throw Error('Unknown layer operation.');if(!action.enabled)throw Error(action.reason);
  const L=root.PortalLayers,mode=recordMode(options);if(mode&&['table','processing','statistics','chart','export','compare','quality','zones'].includes(id))root.PortalOperationContext?.setOperation({layerId:layer.id,mode,action:action.label,projectId:root.PortalProjects?.current?.id}); // Recheck membership before every operation, including legacy aliases.
  if(id==='zoom')return L.zoom(layer);
  if(id==='up'||id==='down')return L.reorder(layer.id,id);
  if(id==='remove')return L.remove(layer.id);
  if(id==='details')return L.details(layer);
  if(id==='rename')return settings(layer,'[data-added-name]');
  if(id==='style')return layer.rasterResource?root.PortalImport.styleRaster(layer):settings(layer,root.PortalLayers.isRaster(layer)?'[data-added-opacity]':'[data-added-color]');
  if(id==='refresh')return layer.checkUpdates();
  if(id==='load-data')return root.PortalDataWorkspace.open({layer,intent:options.intent});
  if(id==='compare')return root.PortalSourceComparison.open({layer,...(mode?{mode}:{}),...(options.resume?{resume:true}:{})});
  if(id==='quality'||id==='zones')return root.PortalStudyReports.open(id,{layerId:layer.id,mode:mode||root.PortalDataWorkspace.defaultMode(layer),resume:!!options.resume});
  if(id==='table'){
   if(mode){
    const data=layer.data,ref=JSON.stringify(layer.cfg.nativeSource||null);
    if(layer.cfg.nativeSource){const selected=await root.PortalDataWorkspace.nativeScope(layer,mode);stillCurrent(layer,data,ref);return root.PortalTasks.openNativeTable(layer,{...options,selectedOnly:false,fixedSelectionId:selected.selectionId||null,fixedScopeLabel:selected.label});}
    const records=await root.PortalDataWorkspace.records(layer,mode);stillCurrent(layer,data,ref);return root.PortalInventory.openTable(layer.id,{...options,scope:'loaded',records});
   }
   if(layer.cfg.nativeSource)return root.PortalTasks.openNativeTable(layer,options);
   if(root.PortalInventory.openTable(layer.id,{scope:'loaded',...options}))return true;
   L.selectLayer(layer.id);const panel=root.document?.querySelector('#attribute-table');if(panel?.hidden)root.PortalInventory.toggleTable();else root.PortalInventory.refresh();return true;
  }
  if(id==='processing'){L.selectLayer(layer.id);const value=root.PortalGIS.open(options.operation||'extract-mask');if(mode)root.PortalGIS.setInputMode?.(mode);return value;}
  if(id==='statistics'&&layer.cfg.nativeSource){L.selectLayer(layer.id);return root.PortalTaskGuides.open('count',{layerId:layer.id,mode:mode||'all'});}
  if(id==='statistics'||id==='chart')return root.PortalAnalysis.open(id==='statistics'?'stats':'chart',{layerId:layer.id,...options,...(mode?{scope:mode==='all'?'layer':mode}:{})});
  if(id==='export'){
   if(layer.cfg.nativeSource){
    const data=layer.data,ref=JSON.stringify(layer.cfg.nativeSource),areaData=mode==='area'?root.PortalDataWorkspace.area()?.data:null,projectId=root.PortalProjects?.current?.id||null;
    const selected=mode?await root.PortalDataWorkspace.nativeScope(layer,mode):null;stillCurrent(layer,data,ref);
    const format=options.format||'parquet',selectionId=selected?.selectionId||options.selectionId||null;
    const value=await root.PortalNativeEngine.download(layer.cfg.nativeSource.jobId,format,{...options,selectionId});if(value===false)return false;
    output({kind:'data',phase:'downloaded',projectId,layerId:layer.id,mode:mode||(selectionId?'selection':'all'),format,sourceData:data,nativeSource:JSON.parse(ref),selectionId,areaData,records:selected?.count??layer.cfg.nativeSource.recordCount});return value;
   }
   if(layer.cfg.originalFile&&!root.PortalDataWorkspace.ready(layer)){const file=layer.cfg.originalFile,url=root.URL.createObjectURL(file),a=root.document.createElement('a');a.href=url;a.download=file.name||layer.cfg.name;a.click();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);return;}
   L.selectLayer(layer.id);if(options.format==='geojson'&&!mode)return L.exportLayer(layer);return root.PortalComposer.open('download',{layerId:layer.id,...(mode?{scope:mode}:{})});
  }
  if(id==='retry'){const cfg={...layer.cfg},style={restore:true,allowDuplicate:true,visible:layer.visible,opacity:layer.opacity,colorMode:layer.colorMode,sourceFilter:layer.sourceFilter,minArea:layer.minArea,heightField:layer.heightField,...(layer.colorField?{colorField:layer.colorField,colorStops:layer.colorStops,colorUnit:layer.colorUnit}:{} )};L.remove(layer.id);return L.add(cfg,style);}
  if(id==='duplicate'){
   const cfg=layer.cfg,style={restore:true,allowDuplicate:true,visible:layer.visible,opacity:layer.opacity,colorMode:layer.colorMode,sourceFilter:layer.sourceFilter,minArea:layer.minArea,heightField:layer.heightField,...(layer.colorField?{colorField:layer.colorField,colorStops:layer.colorStops,colorUnit:layer.colorUnit}:{} )};
   const copy=cfg.type==='geojson'?await L.addGeoJSON(cfg.name+' · copy',root.PortalGISCore.clone(layer.data),{...cfg,id:undefined,color:layer.color},style):await L.add({...cfg,color:layer.color,type:cfg.type==='raster-pmtiles'?'pmtiles':cfg.type,name:cfg.name+' · copy'},style);
   if(copy){root.PortalDraw?.restoreLayerLabels(copy);if(cfg.nativeSource&&root.PortalNativeResults?.supported(copy))await root.PortalNativeResults.attach(copy);}return copy;
  }
  if(id==='extent'){
   const bounds=action.scope==='native-result-extent'?nativeExtent(layer).slice():!layer.renderTiled&&layer.cfg.analysisMode!=='on-demand'&&layer.data?.features?.length?root.turf.bbox(layer.data):layer.bounds.flat(),mask=root.turf.bboxPolygon(bounds);
   return root.PortalGIS.add({type:'FeatureCollection',features:[mask],provenance:{role:'user-drawing',featureRole:'features',spatialEligible:true,autoHeight:false,geometryQuality:'full-source',scope:'layer-extent',sourceLayer:layer.cfg.name}},layer.cfg.name+' · extent');
  }
 }
 function refresh(){
  if(!root.document?.querySelectorAll)return;
  for(const menu of root.document.querySelectorAll('[data-layer-actions-menu]'))menu.innerHTML=markup(root.PortalLayers?.active,{ids,explainDisabled:true});
  for(const button of root.document.querySelectorAll('[data-layer-action]')){
   const value=button.dataset.layerId||button.dataset.purposeLayer||root.PortalLayers?.active?.id,action=get(value,button.dataset.layerAction);if(!action)continue;
   button.disabled=!action.enabled;button.setAttribute('aria-disabled',String(!action.enabled));button.title=t(action.reason||'');
   const reason=button.nextElementSibling;if(reason?.classList.contains('layer-action-reason'))reason.textContent=action.enabled?'':action.reason;
  }
 }
 root.PortalLayerActions={ids,management,canonical,describe,get,markup,run,refresh};
 if(root.document){
  // A capture listener prevents legacy delegated handlers from running a second
  // operation. Scoped workspace buttons retain their explicit input contract.
  root.document.addEventListener('click',event=>{const button=event.target.closest('[data-layer-action]');if(!button||button.dataset.layerActionOwned)return;event.preventDefault();event.stopImmediatePropagation();if(button.disabled)return;for(const d of root.document.querySelectorAll('.ribbon details[open]'))d.open=false;run(button.dataset.layerAction,button.dataset.layerId||button.dataset.purposeLayer||root.PortalLayers?.active?.id).catch(e=>root.portal?.toast(t(e.message||String(e))));},true);
  for(const event of ['portal-ready','portal-layers-changed','portal-style-changed','portal-native-engine-changed','portal-language-changed','portal-data-context-changed'])root.document.addEventListener(event,refresh);
 }
})(globalThis);
