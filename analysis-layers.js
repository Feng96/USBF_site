/* Explicit original-data loading creates a separate, portable analysis layer. */
(function(root){
 'use strict';
 const jobs=new WeakMap(),messages=new WeakMap();let dialog,source=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const linked=l=>!!(l&&root.PortalLayers?.layers.get(l.id)===l);
 const direct=l=>root.PortalAnalysisData?.capabilities(l).kind==='on-demand';
 function note(l,text,error=false){messages.set(l,{text,error});root.PortalLayers?.refresh();}
 async function load(l){
  if(!linked(l)||!direct(l)||jobs.has(l))return;
  const controller=new AbortController();jobs.set(l,controller);note(l,'Loading original records for this area…');
  try{
   const snapshot=await root.PortalAnalysisData.capture(l,{scope:'view',map:root.portal.map,signal:controller.signal});
   if(!linked(l)||controller.signal.aborted)throw new DOMException('Loading cancelled.','AbortError');
   const data=root.PortalAnalysisData.sourceGeoJSON(snapshot),p=snapshot.provenance;
   const loaded=await root.PortalLayers.addGeoJSON(l.cfg.name+' · analysis area',data,{sourceFormat:'geojson',dataRole:p.featureRole,heightField:p.heightField||undefined,allowHeight:p.autoHeight,license:l.cfg.license,attribution:l.cfg.attribution,page:l.cfg.page,sourceUrl:l.cfg.page,provider:l.cfg.provider,provenance:p,sourceNote:'Original records for the captured area. This layer stays fixed when the map moves.'},{restore:true});
   note(l,'Analysis layer added for the captured area.');root.PortalInventory?.openTable(loaded.id,{scope:'loaded'});return loaded;
  }catch(error){note(l,error.name==='AbortError'?'Loading cancelled.':error.message||'Original data could not load. Try again.',error.name!=='AbortError');}
  finally{jobs.delete(l);root.PortalLayers?.refresh();}
 }
 function cancel(l){jobs.get(l)?.abort();}
 function safeLinks(l){return (l?.cfg?.links||[]).filter(link=>{try{const u=new URL(link[1]);return u.protocol==='https:'&&!u.username&&!u.password;}catch(_){return false;}});}
 function open(l){
  if(!linked(l))return;source=l;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='analysis-data-options';dialog.className='analysis-data-options';document.body.append(dialog);dialog.addEventListener('click',event=>{
   const b=event.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-close-analysis-options')){dialog.close();return;}
   const active=source;if(!linked(active)){dialog.close();return;}
   if(b.hasAttribute('data-load-source-area')){dialog.close();load(active);return;}
   if(b.dataset.analysisImport){dialog.close();root.PortalImport.open(b.dataset.analysisImport);return;}
   if(b.hasAttribute('data-analysis-provider')){dialog.close();root.PortalLayerPurpose.original(active);return;}
   if(b.dataset.analysisCatalog){const cfg=root.PortalLayers.catalog.find(c=>c.id===b.dataset.analysisCatalog);if(!cfg)return;dialog.close();addCatalog(cfg).catch(error=>root.portal?.toast(error.message||'The data source could not load.'));}
  });}
  const choices=root.PortalLayers.catalog.filter(c=>c.type==='viewport'&&c.driver!=='usbf');
  dialog.innerHTML='<header><div><h2 data-i18n>Load analyzable building data</h2><p>'+esc(l.cfg.name)+'</p></div><button type="button" data-close-analysis-options aria-label="Close" data-i18n-aria-label>×</button></header><div class="analysis-data-options-body">'+
   (direct(l)?'<section><h3 data-i18n>Original records from this dataset</h3><p data-i18n>Load the current area as a separate GeoJSON layer. Source geometry, attributes, licenses and coverage limits are retained.</p><button type="button" class="analysis-data-choice" data-load-source-area><strong data-i18n>Load original data for this area</strong><small>GeoParquet → GeoJSON</small></button></section>':'<section><h3 data-i18n>Original records from this dataset</h3><p data-i18n>This preview has no automatic original-data connection. Use the provider’s original records or import a regional extract.</p><button type="button" data-analysis-provider class="text-button" data-i18n>Find original data</button>'+safeLinks(l).map(([label,url])=>'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+' ↗</a>').join('')+'</section>')+
   '<section><h3 data-i18n>Open your own data</h3><p>GeoJSON · GeoParquet · Shapefile · KML · CSV</p><p data-i18n>Use a regional extract or a small file. Large national files need a bounded data service.</p><div class="analysis-data-imports"><button type="button" data-analysis-import="file" data-i18n>Choose a file</button><button type="button" data-analysis-import="url" data-i18n>Connect a data URL</button></div></section><section><h3 data-i18n>Other building datasets</h3><p data-i18n>These are separate datasets, not the original records behind the selected preview. Check their coverage and licenses.</p>'+choices.map(c=>'<button type="button" class="analysis-data-choice" data-analysis-catalog="'+esc(c.id)+'"><strong>'+esc(c.name)+'</strong><small>'+esc(root.PortalLayerPurpose.format({cfg:c}))+' · '+esc(c.scope)+'</small></button>').join('')+'</section></div>';
  if(!dialog.open)dialog.showModal();
 }
 async function addCatalog(cfg){
  let l=Array.from(root.PortalLayers.layers.values()).find(l=>l.cfg.id===cfg.id);
  if(!l)l=await root.PortalLayers.add(cfg,{throwOnError:true});
  if(l){root.PortalLayers.selectLayer(l.id);root.PortalInventory.openTable(l.id,{scope:'loaded'});}
 }
 root.PortalAnalysisLayers={open,load,cancel,isLoading:l=>jobs.has(l),message:l=>messages.get(l)||null};
})(globalThis);
