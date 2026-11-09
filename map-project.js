/* Save and reopen a map on the user's device. No server storage or account. */
(function(root){
  'use strict';
  const $=s=>document.querySelector(s),core=()=>root.PortalProjectCore,clone=v=>JSON.parse(JSON.stringify(v));
  const metadataKeys=['description','license','attribution','page','sourceUrl','sourceNote','sourceFormat','sourceKind','analysisQuality','originalCrs','originalName','provider','driver','heightField','allowHeight','local','provenance','dataRole','releaseRef','nativeSource'];
  const importKeys=['type','url','crs','bounds','worldfile','bands','palette','min','max','nodata','viewOnly','readExtentWGS84'];
  let busy=false,serial=0,lastProject=null,restoredIDs=[],dataPolicy='pinned';
  try{const saved=root.PortalReadOnlyMode?null:localStorage.getItem('usbf-project-data-policy');if(['pinned','latest'].includes(saved))dataPolicy=saved;}catch(_){}
  function setDataPolicy(value){if(!['pinned','latest'].includes(value))throw Error('Choose pinned or latest data.');dataPolicy=value;if(!root.PortalReadOnlyMode)try{localStorage.setItem('usbf-project-data-policy',value);}catch(_){}document.dispatchEvent(new CustomEvent('portal-presentation-changed'));}
  const getDataPolicy=()=>dataPolicy;
  const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o?.[k]!==undefined&&typeof o[k]!=='function').map(k=>[k,clone(o[k])]));
  function state(){const map=portal.map,c=map.getCenter();return {center:[c.lng,c.lat],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing(),view3d:portal.view3d,basemap:portal.getBasemap(),...(root.PortalBasemaps?.current().config?{customBasemap:clone(PortalBasemaps.current().config)}:{}),crs:PortalCRS.get()};}
  function setPresentation(p){const visible=p?.legendVisible||false;document.body.classList.toggle('legend-visible',visible);$('#legend-card').hidden=!visible;$('.legend-body').hidden=false;$('.legend-title').setAttribute('aria-expanded',String(visible));root.PortalComposer?.applyProjectOptions(p?.layout);root.PortalInterface?.applyState(p?.interface);}
  async function setView(v,files,customFile,applyBasemap=true){
    if(applyBasemap){if(v.basemap==='custom'){const config=clone(v.customBasemap),file=customFile||files?.get(config.asset);delete config.asset;if(!root.PortalBasemaps)throw Error('The basemap tools are still loading.');await PortalBasemaps.restore(config,file);}else portal.setBasemap(v.basemap);}
    portal.setViewMode(v.view3d,false);PortalCRS.set(v.crs);portal.map.jumpTo({center:v.center,zoom:v.zoom,pitch:v.pitch,bearing:v.bearing});
  }
  function layerStyle(l){return {color:l.color,opacity:l.opacity,visible:l.visible,colorMode:l.colorMode,sourceFilter:l.sourceFilter||'',minArea:l.minArea||0,heightField:l.heightField||null,...(l.colorField?{colorField:l.colorField,colorStops:clone(l.colorStops),colorUnit:l.colorUnit||''}:{})};}
  function currentResearch(){const m=root.PortalModels;if(!m?.enabled||!m.current)return null;return {id:m.current.id,method:m.method,roofOnly:$('#model-roof-only').checked,edges:$('#model-edges').checked,visible:$('#model-visible').checked};}
  function projectName(){return $('#project-name')?.value.trim()||$('#workspace-document')?.textContent||'My building map';}
  async function collect(name=projectName(),options={}){
    const rows=Array.from(PortalLayers.layers.values()).filter(l=>!options.visibleOnly||l.visible);if(rows.length>core().limits.layers)throw Error('Save up to 24 layers in one map.');
    const policy=options.dataPolicy||dataPolicy;if(!['pinned','latest'].includes(policy))throw Error('Choose pinned or latest data.');
    const p={format:'USBF map',version:2,dataPolicy:policy,name:name.slice(0,120),savedAt:new Date().toISOString(),place:($('#map-place-name')?.textContent||'United States').slice(0,200),view:state(),active:null,layers:[],models:[],assets:[],order:[],research:currentResearch(),notes:[policy==='pinned'?'Supported catalog sources are pinned to exact archived release manifests. Original source keys can become unavailable; processing verifies expected checksums.':'Online sources explicitly follow their latest publication.','Saved imported and derived records retain their original source details.']};
    p.presentation={legendVisible:document.body.classList.contains('legend-visible'),layout:PortalComposer.projectOptions(),...(root.PortalInterface?{interface:PortalInterface.getState()}:{})};
    const files=[],assetIDs=new Map(),layerKeys=new Map();
    const asset=file=>{if(!file)return null;if(assetIDs.has(file))return assetIDs.get(file);const id='file-'+(files.length+1);assetIDs.set(file,id);files.push({id,file});return id;};
    const basemap=root.PortalBasemaps?.current();
    if(basemap?.id==='custom'&&basemap.config?.type==='image'){if(!basemap.file)throw Error('The original basemap image is unavailable.');p.view.customBasemap.asset=asset(basemap.file);}
    const previewJobs=[],releaseJobs=[];
    for(let i=0;i<rows.length;i++){
      const l=rows[i],cfg=l.cfg,key='layer-'+(i+1),entry={key,name:cfg.name.slice(0,120),style:layerStyle(l)};layerKeys.set(l.id,key);if(PortalLayers.active?.id===l.id)p.active=key;
      const c=PortalLayers.catalog.find(c=>c.id===cfg.id&&c.type===cfg.type)||PortalLayers.catalog.find(c=>c.driver==='usbf'&&cfg.driver==='usbf'&&cfg.type==='viewport');
      if(c){Object.assign(entry,{kind:'catalog',catalogId:c.id});const release=l.renderTiled?l.displayRelease:l.release;if(release)entry.sourcePublication=pick(release,['name','updated','buildings','tiles']);if(l.renderTiled&&l.usbfConnection?.display)entry.displayArchive=pick(l.usbfConnection.display,['url','sha256','source_layer','minzoom','maxzoom']);}
      else if(cfg.type==='geojson')Object.assign(entry,{kind:'vector',data:clone(l.data),meta:pick(cfg,metadataKeys),asset:asset(cfg.originalFile)});
      else if(l.rasterResource){const options=pick(l.rasterResource.options,importKeys);if(options.type==='geotiff'&&options.viewOnly&&cfg.raster?.geographicExtent)options.readExtentWGS84=clone(cfg.raster.geographicExtent);Object.assign(entry,{kind:'raster',import:options,meta:pick(cfg,metadataKeys),asset:asset(cfg.originalFile||l.rasterResource.options.file)});}
      else if(cfg.type==='image'){
        Object.assign(entry,{kind:'image-preview',coordinates:clone(cfg.coordinates),meta:pick(cfg,metadataKeys),asset:null});
        const url=cfg.imageURL;previewJobs.push(async()=>{const r=await fetch(url);if(!r.ok)throw Error('The saved image for '+cfg.name+' is unavailable.');const b=await r.blob();entry.asset=asset(new File([b],key+'-preview.png',{type:b.type||'image/png'}));});p.notes.push(cfg.name+': display preview included; original raster pixels are not included.');
      }else if(['pmtiles','raster-pmtiles','vector','raster'].includes(cfg.type))Object.assign(entry,{kind:'connection',connection:pick(cfg,['type','url','sourceLayer','maxzoom','service','sourceKind','analysisQuality','tilejson']),meta:pick(cfg,metadataKeys),asset:asset(cfg.originalFile)});
      else throw Error('Save '+cfg.name+' separately before saving this map. Its source cannot be reopened here.');
      if(c?.driver==='usbf'){
        const frozen={cfg:{id:cfg.id,driver:cfg.driver,releaseRef:cfg.releaseRef?clone(cfg.releaseRef):undefined},displayRelease:l.displayRelease?clone(l.displayRelease):null,analysisRelease:l.analysisRelease?clone(l.analysisRelease):null,release:l.release?clone(l.release):null,usbfConnection:{display:l.usbfConnection?.display?clone(l.usbfConnection.display):null}};
        releaseJobs.push(async()=>{if(policy==='latest'){entry.releaseRef={version:1,sourceId:'usbf-live',policy:'latest'};return;}if(!root.PortalReleases){if(policy==='pinned')throw Error('The release registry is unavailable.');entry.releaseRef={version:1,sourceId:'usbf-live',policy:'latest'};return;}const result=await PortalReleases.resolve(policy==='latest'?{version:1,sourceId:'usbf-live',policy:'latest'}:frozen,{pin:policy==='pinned'});entry.releaseRef=clone(result.ref);});
      }
      p.layers.push(entry);
    }
    if(options.workspaceState!==false&&!root.PortalReadOnlyMode){
      if(root.PortalTaskGuides?.serialize)p.presentation.guideState=root.PortalTaskGuides.serialize({layerKeys});
      if(root.PortalWorkspaceActivity?.serialize)p.presentation.outcomes=root.PortalWorkspaceActivity.serialize({layerKeys});
    }
    // Capture every record, setting and model location before asynchronous file reads.
    for(const m of root.PortalLocalModels?.serializeModelEntries({includeOriginal:true})||[]){if(options.visibleOnly&&(!p.view.view3d||!m.visible))continue;if(!m.originalFile)throw Error('The original file for '+m.name+' is unavailable.');p.models.push({asset:asset(m.originalFile),placement:clone(m.placement),visible:m.visible});}
    if(options.visibleOnly&&p.research&&(!p.view.view3d||!p.research.visible))p.research=null;
    for(const rendered of portal.map.getStyle().layers){for(const l of rows){if(rendered.id.startsWith(l.id+'-')){const part=rendered.id.slice(l.id.length+1);if(['fill','line','circle','fill-extrusion','raster','publication-grid'].includes(part)||/^annotation(?:-\d+)?$/.test(part))p.order.push([layerKeys.get(l.id),part]);break;}}}
    for(const job of releaseJobs)await job();
    for(const job of previewJobs)await job();
    const total=files.reduce((n,f)=>n+f.file.size,0);if(total>core().limits.attachments)throw Error('The original files exceed 48 MB. Save fewer layers in this map.');
    for(const f of files){setMessage('Saving '+f.file.name+'…');p.assets.push(await core().encodeAsset(f.file,f.id));}
    core().validate(p,{validateVector:PortalLayers.validateGeoJSON});const json=JSON.stringify(p);if(new Blob([json]).size>core().limits.file)throw Error('This map is too large. Save fewer layers or a smaller area.');return {project:p,json};
  }
  function placementInput(p){return {lng:p.anchorWGS84?.[0],lat:p.anchorWGS84?.[1],altitude:p.baseElevationMetres,units:p.sourceUnits,up:p.sourceUpAxis,scale:p.scale,heading:p.headingDegrees};}
  async function prepare(value){
    const p=core().validate(value,{validateVector:PortalLayers.validateGeoJSON,validatePlacement:p=>root.PortalLocalModelCore.placement(placementInput(p))});PortalCRS.definition(p.view.crs);
    for(const l of p.layers)if(l.kind==='catalog'&&!PortalLayers.catalog.some(c=>c.id===l.catalogId))throw Error('The catalog source '+l.catalogId+' is no longer available.');
    if(p.research&&!PortalModels.manifest?.models.some(m=>m.id===p.research.id))throw Error('The research model in this map is no longer available.');
    let labels=0;for(const l of p.layers){if(l.kind!=='vector'||l.data.provenance?.role!=='user-drawing'&&l.meta?.provenance?.role!=='user-drawing')continue;const count=l.data.features.filter(f=>f.geometry?.type==='Point'&&typeof f.properties?.label==='string'&&f.properties.label.trim()).length;if(count>(root.PortalDraw?.labelLimit||64))throw Error('This map has too many text labels in one layer. Keep up to 64 labels in each drawing layer.');labels+=count;}if(labels>128)throw Error('This map has too many text labels. Keep up to 128 labels across the saved map.');
    for(const entry of p.layers)if(entry.releaseRef?.policy==='pinned'){if(entry.kind!=='catalog'||entry.catalogId!=='usbf-live')throw Error('The pinned source does not match the saved catalog layer.');if(!root.PortalReleases)throw Error('The release registry is unavailable.');await PortalReleases.resolve(entry.releaseRef);}
    const dependencies=[];for(const entry of p.layers)if(entry.meta?.nativeSource){const ref=entry.meta.nativeSource;let info;try{info=root.PortalNativeEngine?.fileInfo?await PortalNativeEngine.fileInfo(ref):{available:false,reason:'Connect the original native workspace to analyze this saved preview.'};}catch(error){info={available:false,reason:error.message};}dependencies.push({layer:entry.name,kind:'native-source',available:!!info.available,reason:info.reason||'',previewOnly:true});}
    const warnings=p.version===1&&p.layers.some(l=>l.kind==='catalog'&&l.catalogId==='usbf-live'&&!l.releaseRef)?['This older Project follows the latest USBF source. Choose a pinned release and save a new revision for reproducible data.']:[];const files=await core().decodeAssets(p);return {project:p,files,dependencies,warnings};
  }
  async function addEntry(e,files,token){
    let l;const meta=pick(e.meta||{},metadataKeys),options={restore:true,allowDuplicate:true,throwOnError:true,...e.style},id='project-'+token+'-'+e.key;
    if(e.kind==='catalog')l=await PortalLayers.add({...PortalLayers.catalog.find(c=>c.id===e.catalogId),id,color:e.style.color,...(e.releaseRef?{releaseRef:clone(e.releaseRef)}:{})},options);
    else if(e.kind==='vector')l=await PortalLayers.add({...meta,id,name:e.name,type:'geojson',data:e.data,color:e.style.color,originalFile:files.get(e.asset)||null},options);
    else if(e.kind==='raster')l=await PortalImport.importData({...meta,...pick(e.import,importKeys),file:files.get(e.asset),name:e.name,restore:true});
    else if(e.kind==='image-preview'){
      const url=URL.createObjectURL(files.get(e.asset));try{l=await PortalLayers.add({...meta,id,name:e.name,type:'image',imageURL:url,coordinates:e.coordinates,color:e.style.color,sourceKind:'raster',analysisQuality:'display-raster',cleanup:()=>URL.revokeObjectURL(url)},options);}catch(err){URL.revokeObjectURL(url);throw err;}
    }else if(e.kind==='connection'){
      const cfg={...pick(e.connection,['type','url','sourceLayer','maxzoom','service','sourceKind','analysisQuality','tilejson']),...meta,id,name:e.name,color:e.style.color,originalFile:files.get(e.asset)||null};
      if(e.asset){const source=new pmtiles.FileSource(files.get(e.asset));source.getKey=()=>id+'.pmtiles';cfg.localArchive=new pmtiles.PMTiles(source);cfg.type='pmtiles';}
      if(cfg.type==='raster-pmtiles')cfg.type='pmtiles';l=await PortalLayers.add(cfg,options);
    }
    if(!l)throw Error(e.name+' could not be opened.');if(e.kind==='raster')Object.assign(l.cfg,meta);l.cfg.name=e.name;PortalLayers.setStyle(l.id,e.style);return l;
  }
  async function showResearch(r){
    if(!r){root.PortalModels?.hide();return;}
    await PortalModels.select(r.id,r.method,false);if(PortalModels.current?.id!==r.id)throw Error('The saved research model could not load.');
    $('#model-roof-only').checked=r.roofOnly;$('#model-edges').checked=r.edges;$('#model-visible').checked=r.visible;$('#model-roof-only').dispatchEvent(new Event('change'));
  }
  async function restore(prepared,options={}){
    const {project:p,files}=prepared,oldRows=Array.from(PortalLayers.layers.values()),oldIDs=new Set(oldRows.map(l=>l.id)),previous={view:state(),basemap:root.PortalBasemaps?.current(),active:PortalLayers.active?.id,place:$('#map-place-name').textContent,name:$('#workspace-document').textContent,research:currentResearch()},added=new Map(),token=++serial;
    document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='map-project-dialog')d.close();});portal.cancelPlaceSearch?.();root.PortalLoD1?.cancel?.({clear:true});root.PortalLocalModels?.cancelPending?.();root.PortalImport?.cancelPending?.();root.PortalLayers.invalidatePending?.();for(const l of oldRows)l.cancelAnalysis?.();await root.PortalAnalysis?.cancel({clear:true});root.PortalDraw?.cancel();root.PortalExplorer?.clearLocation();portal.clearSelection();PortalLayers.clearExternalSelection();root.PortalModels?.hide();
    try{
      await setView(p.view,files);
      for(const e of p.layers){setMessage('Opening '+e.name+'…');let l;try{l=await addEntry(e,files,token);}catch(error){error.restoreImportType=e.kind==='raster'?e.import.type:null;error.restoreLayer=e.name;throw error;}added.set(e.key,l);root.PortalDraw?.restoreLayerLabels?.(l);}
      await showResearch(p.research);
      for(const [key,part] of p.order){const id=added.get(key).id+'-'+part;if(portal.map.getLayer(id))portal.map.moveLayer(id,'measure-line');}
      // Existing resources stay intact until every replacement has succeeded.
      if(!root.PortalLocalModels?.replaceModels&&p.models.length)throw Error('The model tools are still loading. Try opening the map again.');
      if(root.PortalLocalModels?.replaceModels)await PortalLocalModels.replaceModels(p.models.map(m=>({file:files.get(m.asset),placement:m.placement,visible:m.visible})));
      for(const l of oldRows)PortalLayers.remove(l.id);
      for(const e of p.layers){const l=added.get(e.key);if(e.kind==='catalog')l.cfg.id=e.catalogId;}
      if(p.active)PortalLayers.selectLayer(added.get(p.active).id);
      await setView(p.view,files,undefined,false);setPresentation(p.presentation);$('#map-place-name').textContent=p.place;$('#workspace-document').textContent=p.name;$('#welcome-card').hidden=true;PortalLayers.syncOrder();PortalLayers.refresh();portal.saveView();setDataPolicy(p.dataPolicy||'latest');if(prepared.warnings?.length)portal.toast(prepared.warnings[0]);lastProject=p;restoredIDs=Array.from(added.values(),l=>l.id);
      const workspaceState={presentation:p.presentation,layersByKey:added};const workspaceWarnings=options.deferWorkspaceState?[]:await restoreWorkspaceState(workspaceState,{projectId:root.PortalProjects?.current?.id||null});
      return {layers:added.size,models:p.models.length,notes:p.notes||[],dependencies:prepared.dependencies||[],warnings:[...(prepared.warnings||[]),...workspaceWarnings],workspaceState};
    }catch(err){
      for(const l of Array.from(PortalLayers.layers.values()))if(!oldIDs.has(l.id))PortalLayers.remove(l.id);
      await setView(previous.view,undefined,previous.basemap?.file);if(previous.active&&PortalLayers.layers.has(previous.active))PortalLayers.selectLayer(previous.active);$('#map-place-name').textContent=previous.place;$('#workspace-document').textContent=previous.name;
      await showResearch(previous.research);await setView(previous.view,undefined,undefined,false);throw err;
    }
  }
  async function restoreWorkspaceState(value,options={}){
    const presentation=value?.presentation||{},layersByKey=value?.layersByKey||new Map(),context={layersByKey,projectId:options.projectId||root.PortalProjects?.current?.id||null},warnings=[];
    for(const [module,data,label]of [[root.PortalWorkspaceActivity,presentation.outcomes,'Saved results'],[root.PortalTaskGuides,presentation.guideState,'Guide progress']]){
      if(!module?.restore)continue;try{await module.restore(data,context);}catch(error){warnings.push(label+' could not be restored. Review the input again.');try{await module.restore(undefined,context);}catch(_){}}
    }
    return warnings;
  }
  function setMessage(s,error=false){const el=$('#project-message');if(el){el.textContent=s;el.classList.toggle('composer-error',error);}}
  function setBusy(value){busy=value;$('#map-project-dialog')?.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
  function saveFile(name,body){const u=URL.createObjectURL(new Blob([body],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
  async function save(){if(root.PortalReadOnlyMode)return false;if(busy)return;setBusy(true);try{const result=await collect();const name=result.project.name.replace(/[^\p{L}\p{N}_.-]+/gu,'-')||'building-map';saveFile(name+'.usbf.json',result.json);$('#workspace-document').textContent=result.project.name;lastProject=result.project;setMessage('Map saved. Open this file to continue on another day or device.'+(result.project.notes.some(n=>n.includes('display preview included'))?' Image-only layers keep their displayed image; original raster files are not included for those layers.':''));}catch(err){setMessage(err.message,true);}finally{setBusy(false);}}
  async function openFile(file){if(root.PortalReadOnlyMode)return false;if(busy)return;setBusy(true);try{if(!file)throw Error('Choose a saved USBF map file.');if(file.size>core().limits.file)throw Error('Choose a saved map smaller than 80 MB.');setMessage('Checking saved map…');const prepared=await prepare(JSON.parse(await file.text())),result=await restore(prepared);setMessage('Opened '+result.layers+' layers'+(result.models?' and '+result.models+' models':'')+'. Online sources reconnect for this area.');$('#project-name').value=prepared.project.name;}catch(err){setMessage(err instanceof SyntaxError?'This file is not a valid USBF map. Choose a .usbf.json file.':err.restoreLayer?'Could not open '+err.restoreLayer+': '+(root.PortalImport?.importMessage?PortalImport.importMessage(err,{type:err.restoreImportType}):err.message)+' Your current map was kept.':err.message,true);}finally{setBusy(false);$('#project-file').value='';}}
  function open(){if(root.PortalReadOnlyMode)return false;if(root.PortalProjects)return root.PortalProjects.open();if(!root.portal?.ready)return;let d=$('#map-project-dialog');if(!d){d=document.createElement('dialog');d.id='map-project-dialog';d.className='workspace-dialog project-dialog';d.setAttribute('aria-labelledby','map-project-title');d.innerHTML='<div class="workspace-dialog-heading"><h2 id="map-project-title" data-i18n>Save or open a map</h2><button type="button" data-close-project aria-label="Close saved maps" data-i18n-aria-label>×</button></div><div class="workspace-dialog-body"><form id="project-save-form" class="workspace-form"><label data-i18n>Map name<input id="project-name" maxlength="120" required value="My building map"></label><p data-i18n>Your layers, styles, drawings and imported models are included. Catalog sources reconnect to the latest data.</p><button class="primary" id="project-save-button" type="submit" data-i18n>Save map file</button></form><hr><label class="project-open-label" data-i18n>Open a saved map<input id="project-file" type="file" accept=".usbf.json,.json,application/json"></label><p class="project-note" data-i18n>Opening replaces the current map after the saved files have been checked. Save your current map first if you want to keep it.</p><p id="project-message" role="status" aria-live="polite" data-i18n-system></p></div>';document.body.append(d);d.querySelector('[data-close-project]').onclick=()=>d.close();$('#project-save-form').onsubmit=e=>{e.preventDefault();save();};$('#project-file').onchange=e=>openFile(e.target.files[0]);d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});}if(lastProject)$('#project-name').value=lastProject.name;setMessage('');if(!d.open)d.showModal();}
  document.addEventListener('portal-layers-changed',()=>{if(busy||!$('#map-project-dialog')?.open||!restoredIDs.length)return;const failed=restoredIDs.map(id=>PortalLayers.layers.get(id)).filter(l=>l?.error);if(failed.length)setMessage('Map opened. '+failed.length+' source'+(failed.length===1?' is':'s are')+' temporarily unavailable. Retry from the layer settings.',true);});
  document.addEventListener('click',e=>{if(e.target.closest('[data-project-open]')){document.querySelectorAll('details.tools-menu[open]').forEach(d=>d.open=false);open();}});
  root.PortalProject={getDataPolicy,setDataPolicy,forget(){lastProject=null;restoredIDs=[];},setPresentation,restoreWorkspaceState,open,save,openFile,collect,prepare,restore,get busy(){return busy;},get last(){return lastProject;}};
})(globalThis);
