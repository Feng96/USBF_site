/* Shared action guards and dispatch; visible menus follow the input's role.
   Rendering a dataset with tiles never grants or removes original-data access. */
(function(root){
 'use strict';
 const labels={quality:'Data quality report',zones:'Summarize by area',table:'Attribute table',processing:'Geoprocessing',statistics:'Statistics',chart:'Charts',export:'Download data','load-data':'Load analyzable data',compare:'Compare sources',style:'Layer style',rename:'Rename layer',zoom:'Zoom to layer',up:'Move up',down:'Move down',duplicate:'Duplicate layer',extent:'Create layer extent',remove:'Remove layer',details:'Details',retry:'Retry',refresh:'Refresh data','find-original':'Find original data','display-filter':'Display filters','use-area':'Use as study area','edit-area':'Edit study area','connect-engine':'Connect local engine',dependencies:'Verify local dependencies'};
 const aliases={'zoom-layer':'zoom','rename-layer':'rename','duplicate-layer':'duplicate','extent-layer':'extent','layer-up':'up','layer-down':'down','remove-layer':'remove','native-table':'table','native-process':'processing',stats:'statistics',data:'load-data',load:'load-data',original:'find-original','load-range':'load-data'};
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
  const role=area?'boundary':native?'native':ready?'analysis':'display';
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
    else scope=area?'boundary-records':ready?'loaded-records':'display-preview';
   }
   if(id==='export'){
    if(area)scope='boundary-records';
    require(ready||native||area||!!cfg.originalFile,'Download original data from the provider. Display previews are not full-data exports.');
    if(native){require(nativeReady,nativeConnection);scope='native-result';}
   }
   if(id==='display-filter'){require(!raster&&!area,'This layer has no map display filters.');require(!!root.PortalInventory?.openFilters,'The display controls are still loading.');}
   if(id==='find-original')require(role==='display','Original records are already available in this layer.');
   if(id==='use-area')require(!!root.PortalDataWorkspace?.canUseAsArea?.(layer)||area,'Choose a complete original polygon layer for a study area.');
   if(id==='edit-area'){require(area,'Choose a saved study area to edit.');require(!!root.PortalDataWorkspace?.editArea,'The study area editor is still loading.');}
   if(id==='connect-engine'){require(native,'This layer does not depend on a local result file.');require(!!root.PortalDeviceSettings?.open,'Device settings are still loading.');}
   if(id==='dependencies'){require(native,'This layer does not depend on a local result file.');require(!!root.PortalProjectPackages?.open,'Project dependency tools are still loading.');}
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
   let label=labels[id];
   if(id==='table')label=native||ready?'Attribute table':area?'Boundary attribute table':['pmtiles','vector'].includes(cfg.type)||layer?.renderTiled?'Tile attribute preview':'Preview attributes';
   if(id==='load-data'&&role==='display')label='Prepare analysis data';
   if(id==='export'&&area)label='Download boundary';else if(id==='export')label='Download records';
   if(id==='duplicate')label=native?'Copy result reference':area?'Copy boundary':ready?'Copy records to new layer':cfg.type==='geojson'?'Copy preview layer':'Copy display connection';
   if(id==='extent')label=native?'Create full-result extent':ready?'Create data extent':area?'Create boundary extent':'Create display extent';
   const action={id,label,enabled,reason,scope};byId[id]=action;return action;
  });
  return {layerId:layer?.id||null,kind:native?'native-result':cap.kind||'display-only',role,nativeReady:!!nativeReady,area,ready,raster,loadable,actions,byId};
 }
 function profile(value){
  const layer=resolve(value),state=describe(layer),cfg=layer?.cfg||{},role=state.role;
  const available=id=>state.byId[id]?.enabled;
  let label,note,primary,data;
  if(!state.layerId){label='Layer tools';note='Choose a layer to see its available operations.';primary=[];data=[];}
  else if(role==='display'){
   label='Visualization tools';note='These tools change the display. Analysis needs a fixed set of original records.';
   const prepare=state.loadable?'load-data':'find-original';
   primary=state.raster?['style',prepare]:[prepare,'table'];data=state.raster?[prepare]:['table',prepare];
  }else if(role==='boundary'){
   label='Study area tools';note='This boundary defines where data is loaded or processed; it is not a building workset.';
   primary=['use-area','edit-area'];data=['use-area','edit-area','table','export'];
  }else if(role==='native'&&!state.nativeReady){
   label='Analysis tools · local file';note='Connect the workspace containing the full result. Display previews are not analytical inputs.';
   primary=['connect-engine','dependencies'];data=['connect-engine','dependencies'];
  }else{
   label=role==='native'?'Analysis tools · local file':'Analysis tools';note='Operations use original records and the explicit all, selection or study-area scope.';
   primary=['table','processing'];data=['table','statistics','chart','processing','quality','zones','compare','export'];
  }
  const map=state.layerId?['style',...(!state.raster&&role!=='boundary'?['display-filter']:[]),'zoom']:[];
  const shared=state.layerId?['rename','duplicate','extent',...(available('use-area')&&role!=='boundary'?['use-area']:[]),'up','down','details',...(typeof layer.checkUpdates==='function'?['refresh']:[]),...(layer.error?['retry']:[]),...(role==='native'?['dependencies']:[]),'remove']:[];
  if(root.PortalReadOnlyMode){primary=primary.filter(id=>available(id));data=data.filter(id=>available(id));return {...state,label,note,primary,data,map:map.filter(id=>available(id)),management:shared.filter(id=>available(id))};}
  return {...state,label,note,primary,data,map,management:shared.filter(id=>!data.includes(id))};
 }
 function markupProfile(value,options={}){
  const state=profile(value),sidebar=options.surface==='sidebar',groups=[['data',state.label,state.data],['map','Map display',state.map],['management','Layer management',state.management.filter(id=>!sidebar||!['up','down','remove'].includes(id))]];
  return '<div class="layer-action-profile" data-layer-action-profile="'+esc(state.role)+'"><p class="layer-action-profile-note" data-i18n>'+esc(state.note)+'</p>'+groups.filter(g=>g[2].length).map(([id,title,chosen])=>'<section class="layer-action-group" data-layer-action-group="'+id+'"><strong data-i18n>'+esc(title)+'</strong><div>'+markup(value,{ids:chosen,legacyAdded:sidebar,explainDisabled:false})+'</div></section>').join('')+'</div>';
 }
 function get(value,id){return describe(value).byId[canonical(id)];}
 function markup(value,options={}){
  const state=describe(value),chosen=options.ids||ids;
  return chosen.map(name=>{const a=state.byId[canonical(name)];if(!a)return '';const legacy=options.legacyPurpose?.[a.id],hint=a.reason||options.hints?.[a.id]||'',added={zoom:'data-added-zoom',details:'data-added-info',retry:'data-added-retry',refresh:'data-added-update',up:'data-layer-up',down:'data-layer-down',remove:'data-added-remove'},attribute=options.legacyAdded&&added[a.id];
   return '<button type="button" class="'+esc(options.className||'layer-purpose-action')+'" data-layer-action="'+a.id+'" data-layer-action-label="'+esc(a.label)+'" data-layer-id="'+esc(state.layerId)+'"'+(attribute?' '+attribute+'="'+esc(state.layerId)+'"':'')+(legacy?' data-purpose-action="'+esc(legacy)+'" data-purpose-layer="'+esc(state.layerId)+'"':'')+(a.enabled?'':' disabled aria-disabled="true"')+(hint?' title="'+esc(t(hint))+'"':'')+' data-i18n>'+esc(a.label)+'</button>'+(options.explainDisabled&&!a.enabled?'<small class="layer-action-reason" data-i18n>'+esc(a.reason)+'</small>':'');
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
  const L=root.PortalLayers,mode=id==='table'&&action.scope==='display-preview'&&options.mode===undefined&&options.scope==='view'?null:recordMode(options);
  if(id==='table'&&action.scope==='display-preview'&&mode)throw Error('Preview attributes are display records. Prepare original analysis data before choosing an analytical scope.');
  if(action.scope==='boundary-records'&&mode&&mode!=='all')throw Error(id==='export'?'A study boundary is not an analysis workset. Download its original boundary records.':'A study boundary is not an analysis workset. Open its original boundary records.');
  if(mode&&action.scope!=='boundary-records'&&['table','processing','statistics','chart','export','compare','quality','zones'].includes(id))root.PortalOperationContext?.setOperation({layerId:layer.id,mode,action:action.label,projectId:root.PortalProjects?.current?.id}); // Recheck membership before every operation, including legacy aliases.
  if(id==='zoom')return L.zoom(layer);
  if(id==='up'||id==='down')return L.reorder(layer.id,id);
  if(id==='remove')return L.remove(layer.id);
  if(id==='details')return L.details(layer);
  if(id==='rename')return settings(layer,'[data-added-name]');
  if(id==='style')return layer.rasterResource?root.PortalImport.styleRaster(layer):settings(layer,root.PortalLayers.isRaster(layer)?'[data-added-opacity]':'[data-added-color]');
  if(id==='refresh')return layer.checkUpdates();
  if(id==='display-filter')return root.PortalInventory.openFilters(layer.id);
  if(id==='find-original')return root.PortalImport?.details?root.PortalImport.details(layer):L.open('catalog');
  if(id==='use-area')return root.PortalDataWorkspace.useAsArea(layer);
  if(id==='edit-area')return root.PortalDataWorkspace.editArea(layer);
  if(id==='connect-engine')return root.PortalDeviceSettings.open('engine');
  if(id==='dependencies')return root.PortalProjectPackages.open();
  if(id==='load-data')return root.PortalDataWorkspace.open({layer,intent:options.intent});
  if(id==='compare')return root.PortalSourceComparison.open({layer,...(mode?{mode}:{}),...(options.resume?{resume:true}:{})});
  if(id==='quality'||id==='zones')return root.PortalStudyReports.open(id,{layerId:layer.id,mode:mode||root.PortalDataWorkspace.defaultMode(layer),resume:!!options.resume});
  if(id==='table'){
   if(action.scope==='boundary-records'){return root.PortalInventory.openTable(layer.id,{scope:'loaded'});}
   if(action.scope==='display-preview'){return root.PortalInventory.openTable(layer.id,{scope:'view'});}
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
   if(root.PortalDataWorkspace?.isArea?.(layer)){if(mode&&mode!=='all')throw Error('A study boundary is not an analysis workset. Download its original boundary records.');return L.exportLayer(layer);}
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
 const profileStates=new WeakMap();
 function refresh(){
  if(!root.document?.querySelectorAll)return;
  for(const row of root.document.querySelectorAll('[data-added-row]')){
   const layer=resolve(row.dataset.addedRow),state=profile(layer),key=JSON.stringify([state.role,state.primary,state.data,state.map,state.management,state.actions.map(a=>[a.id,a.label,a.enabled,a.reason])]);
   if(profileStates.get(row)!==key){const menu=row.querySelector('.added-actions'),primary=row.querySelector('.layer-purpose-actions');if(menu)menu.innerHTML=markupProfile(layer,{surface:'sidebar'});if(primary&&root.PortalLayerPurpose?.primaryMarkup)primary.innerHTML=root.PortalLayerPurpose.primaryMarkup(layer);profileStates.set(row,key);}
  }
  for(const menu of root.document.querySelectorAll('[data-layer-actions-menu]'))menu.innerHTML=markupProfile(root.PortalLayers?.active,{surface:'ribbon'});
  for(const button of root.document.querySelectorAll('[data-layer-action]')){
   // Scoped workspaces and guides own their additional scope checks and wording.
   if(button.dataset.layerActionOwned)continue;
   const value=button.dataset.layerId||button.dataset.purposeLayer||root.PortalLayers?.active?.id,action=get(value,button.dataset.layerAction);if(!action)continue;
   button.disabled=!action.enabled;button.setAttribute('aria-disabled',String(!action.enabled));button.title=t(action.reason||'');if(button.hasAttribute('data-layer-action-label')&&button.dataset.layerActionLabel!==action.label){button.dataset.layerActionLabel=action.label;button.textContent=action.label;root.PortalI18n?.refresh?.(button);}
   const reason=button.nextElementSibling;if(reason?.classList.contains('layer-action-reason'))reason.textContent=action.enabled?'':action.reason;
  }
 }
 root.PortalLayerActions={ids,management,canonical,describe,get,profile,markup,markupProfile,run,refresh};
 if(root.document){
  // A capture listener prevents legacy delegated handlers from running a second
  // operation. Scoped workspace buttons retain their explicit input contract.
  root.document.addEventListener('click',event=>{const button=event.target.closest('[data-layer-action]');if(!button||button.dataset.layerActionOwned)return;event.preventDefault();event.stopImmediatePropagation();if(button.disabled)return;for(const d of root.document.querySelectorAll('.ribbon details[open]'))d.open=false;run(button.dataset.layerAction,button.dataset.layerId||button.dataset.purposeLayer||root.PortalLayers?.active?.id).catch(e=>root.portal?.toast(t(e.message||String(e))));},true);
  for(const event of ['portal-ready','portal-layers-changed','portal-style-changed','portal-native-engine-changed','portal-language-changed','portal-data-context-changed'])root.document.addEventListener(event,refresh);
 }
})(globalThis);
