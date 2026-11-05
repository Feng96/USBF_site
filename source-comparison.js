/* Compare explicit original worksets. Native previews are never analysis inputs. */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const t=s=>root.PortalI18n?.t(s)||s,heights=['height_m','height','height_meters','height_metres','height_roof','building:height'];
 const dw=()=>root.PortalDataWorkspace,all=()=>Array.from(root.PortalLayers?.layers.values()||[]),polygon=f=>['Polygon','MultiPolygon'].includes(f?.geometry?.type);
 let dialog,busy=false,revision=0,result=null,leftId=null,rightId=null,mode='area',controller=null;
 function eligible(l){return !!l?.cfg&&!dw()?.isArea(l)&&(!!l.cfg.nativeSource||dw()?.ready(l)&&root.PortalAnalysisData.isBuildingLayer(l)&&l.data.features.every(polygon));}
 const worksets=()=>all().filter(eligible);
 function geometry(value){return value?.geometry||value?.mask?.geometry||null;}
 function loadingArea(l,summary){const p=l.data?.provenance||{};return geometry(summary?.provenance?.scope)||geometry(p.workspaceWorkset?.area)||geometry(p.processingArea)||geometry(p.range);}
 function signature(l){return JSON.stringify([l.id,l.cfg.nativeSource||null,l.data?.provenance?.workspaceWorkset||null,l.data?.features?.length]);}
 function sameGeometry(a,b){return !!a&&!!b&&JSON.stringify(a)===JSON.stringify(b);}
 function areaCopy(){return clone(dw().range());}
 function assertCurrent(l,data,original,signal){if(signal?.aborted)throw new DOMException('Cancelled.','AbortError');if(root.PortalLayers.layers.get(l.id)!==l||l.data!==data||signature(l)!==original)throw Error('A comparison input changed. Run the comparison again.');}
 async function summarizeBrowser(l,kind,saved,{signal}={}){
  if(!eligible(l)||l.cfg.nativeSource)throw Error('Choose original polygon worksets for source comparison.');
  const data=l.data,original=signature(l),items=await dw().records(l,kind,{signal,areaRange:saved}),limits=root.PortalGISCore.limits;
  if(items.length>limits.records)throw Error('This comparison input exceeds 20,000 records. Use a smaller saved area or the local engine.');
  const records=clone(items),vertexCount=records.reduce((n,f)=>n+root.PortalAnalysisData.vertices(f.geometry),0);
  if(vertexCount>limits.vertices)throw Error('This comparison input exceeds the browser vertex budget. Use the local engine.');
  const field=heights.find(k=>(l.fields||[]).includes(k)||data.features.some(f=>Object.hasOwn(f.properties||{},k)))||null;
  let areaM2=0,invalidRecords=0,available=0,areaRecords=0;
  for(let i=0;i<records.length;i++){
   const f=records[i];if(!polygon(f))throw Error('Choose original polygon worksets for source comparison.');
   if(root.PortalAnalysisData.vertices(f.geometry)>15000)throw Error('One polygon exceeds the browser geometry budget. Use the local engine.');
   const valid=(!root.turf.booleanValid||root.turf.booleanValid(f))&&!root.turf.kinks(f).features.length,a=valid?root.turf.area(f):null;
   if(valid&&Number.isFinite(a)&&a>0){areaM2+=a;areaRecords++;}else invalidRecords++;
   const h=field?root.PortalAnalysisData.number(f.properties?.[field]):null;if(h!==null&&h>0)available++;
   if(i%32===31){await new Promise(resolve=>setTimeout(resolve,0));assertCurrent(l,data,original,signal);}
  }
  assertCurrent(l,data,original,signal);if(!Number.isFinite(areaM2))throw Error('The source polygon area exceeds the supported numeric range.');
  const rows=kind==='selection'?new Map(data.features.map((f,i)=>[f,i])):null;
  const contract={version:1,worksetId:l.id,worksetName:l.cfg.name,recordMode:kind,recordCount:records.length,sourceRecordCount:data.features.length,recordRule:kind==='area'?'Whole original records intersecting the saved boundary':'Exact original source records',loadingArea:clone(data.provenance?.workspaceWorkset?.area||data.provenance?.range||null),processingArea:kind==='area'?clone(saved.meta):null,...(rows?{selectedSourceRows:items.map(f=>rows.get(f))}:{})};
  return {records:records.length,sourceTotal:data.features.length,geometry:{polygonRecords:records.length,nonPolygonRecords:0,invalidRecords,areaRecords,areaM2,areaRule:'Sum of valid whole polygon areas; overlapping records count separately.',measurement:'Spherical Earth (Turf), square metres'},height:{field,available:field?available:null,unavailable:records.length-available,rule:'Positive finite original supplied height values only; no rendering defaults or floor-based estimates.'},extent:records.length?root.turf.bbox(root.turf.featureCollection(records)):null,coverage:dw().coverage(l),execution:'browser-fixed-workset',provenance:{release:clone(data.provenance?.release||l.release||null),scope:data.provenance?.workspaceWorkset?.area||null,inputContract:contract}};
 }
 async function summarize(l,kind,saved,options){
  if(!l.cfg.nativeSource)return summarizeBrowser(l,kind,saved,options);
  if(root.PortalNativeEngine?.status().readonly)throw Error('Local engine access is disabled in a read-only shared map.');
  if(!root.PortalNativeEngine?.status().information?.capabilities?.resultComparisonSummary||!root.PortalNativeEngine.comparisonSummary)throw Error('Update and pair the local engine to compare complete result records.');
  const data=l.data,original=signature(l),scope=await dw().nativeScope(l,kind);assertCurrent(l,data,original,options.signal);
  if(kind==='area'&&!sameGeometry(geometry(areaCopy()),geometry(saved)))throw Error('The saved study area changed. Run the comparison again.');
  const value=await root.PortalNativeEngine.comparisonSummary(l.cfg.nativeSource.jobId,scope.selectionId?{selectionId:scope.selectionId}:{},options);assertCurrent(l,data,original,options.signal);
  if(value.execution!=='native-full-result')throw Error('Source comparison requires a complete native result query.');
  if(value.geometry.nonPolygonRecords)throw Error('Choose original polygon worksets for source comparison.');
  value.provenance={...value.provenance,inputContract:{version:1,worksetId:l.id,worksetName:l.cfg.name,recordMode:kind,recordCount:value.records,sourceRecordCount:value.sourceTotal,nativeSource:clone(l.cfg.nativeSource),selectionId:scope.selectionId||null,processingArea:kind==='area'?clone(saved.meta):null,sourceInputContract:value.provenance?.inputContract||null}};return value;
 }
 async function compare(left,right,{mode:chosen='area',signal}={}){
  if(left===right||!eligible(left)||!eligible(right))throw Error('Choose two different original polygon worksets.');
  const kind=dw().normalize(chosen);if(!['all','selection','area'].includes(kind))throw Error('Choose all, selected or saved-area records.');
  const saved=areaCopy(),leftData=left.data,rightData=right.data,leftSignature=signature(left),rightSignature=signature(right);
  const a=await summarize(left,kind,saved,{signal}),b=await summarize(right,kind,saved,{signal});
  assertCurrent(left,leftData,leftSignature,signal);assertCurrent(right,rightData,rightSignature,signal);
  if(!sameGeometry(geometry(areaCopy()),geometry(saved)))throw Error('The saved study area changed. Run the comparison again.');
  if(kind!=='area'&&(!sameGeometry(loadingArea(left,a),geometry(saved))||!sameGeometry(loadingArea(right,b),geometry(saved))))throw Error('All or selected records require worksets loaded for this same saved area. Choose saved-area records to apply one explicit boundary.');
  const describe=(l,value)=>({layerId:l.id,name:l.cfg.name,provider:l.cfg.provider||null,license:l.cfg.license||null,coverage:dw().coverage(l),...value});
  return {version:1,createdAt:new Date().toISOString(),recordMode:kind,studyArea:clone(saved.meta),geometryRule:'Whole original records intersecting the saved boundary; records are never clipped.',sources:[describe(left,a),describe(right,b)],difference:{records:b.records-a.records,areaM2:b.geometry.areaM2-a.geometry.areaM2,areaMethodsDiffer:a.geometry.measurement!==b.geometry.measurement},matching:{performed:false,reason:'Aggregate comparison does not establish one-to-one footprint matches or accuracy.'},provenanceWarning:'Sources may share upstream buildings or heights. Agreement is not independent validation; provider completeness remains unknown.'};
 }
 function status(text,error=false){const e=dialog?.querySelector('[data-comparison-status]');if(e){e.textContent=t(text);e.classList.toggle('comparison-error',error);}}
 function fill(selector,choices,value){const el=dialog.querySelector(selector);el.innerHTML=choices.map(([id,label])=>'<option value="'+esc(id)+'" data-i18n-ignore>'+esc(label)+'</option>').join('');if(choices.some(([id])=>id===value))el.value=value;return el.value;}
 function render(){
  if(!dialog)return;const choices=worksets().map(l=>[l.id,l.cfg.name+(l.cfg.nativeSource?' · '+t('Native result'):'')]);
  if(!choices.some(([id])=>id===leftId))leftId=choices[0]?.[0]||null;if(!choices.some(([id])=>id===rightId)||leftId===rightId)rightId=choices.find(([id])=>id!==leftId)?.[0]||null;
  fill('[data-comparison-left]',[['',t('Choose an original workset')],...choices],leftId);fill('[data-comparison-right]',[['',t('Choose an original workset')],...choices],rightId);
  fill('[data-comparison-area]',[['',t('Choose a saved study area')],...dw().areas().map(l=>[l.id,l.cfg.name])],dw().area()?.id||'');dialog.querySelector('[data-comparison-mode]').value=mode;
  for(const input of dialog.querySelectorAll('select'))input.disabled=busy;dialog.querySelector('[data-comparison-run]').disabled=busy||!leftId||!rightId||leftId===rightId||!dw().area();dialog.querySelector('[data-comparison-cancel]').hidden=!busy;dialog.querySelector('[data-comparison-export]').disabled=!result||busy;
  dialog.querySelector('[data-comparison-empty]').hidden=choices.length>=2;
 }
 const number=v=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
 function coverageLabel(value){if(typeof value==='string')return t(value);return t(value?.requestComplete===true?'Request complete':value?.requestComplete===false?'Partial request':'Request completion unknown')+' · '+t(value?.providerCompleteness===true?'Provider completeness verified':'Real-world completeness unknown');}
 function renderResult(){
  const el=dialog.querySelector('[data-comparison-result]');if(!result){el.replaceChildren();return;}const [a,b]=result.sources;
  const rows=[['Input records',x=>number(x.records)],['Total footprint area (m²)',x=>number(x.geometry.areaM2)],['Polygons included in area',x=>number(x.geometry.areaRecords)],['Invalid or empty geometries',x=>number(x.geometry.invalidRecords)],['Original height field',x=>x.height.field||t('No height field available')],['Records with supplied height',x=>x.height.available===null?'—':number(x.height.available)+' / '+number(x.records)],['Height unavailable',x=>number(x.height.unavailable)],['Area measurement',x=>t(x.geometry.measurement)],['Execution',x=>t(x.execution==='native-full-result'?'Complete native result':'Fixed browser workset')],['Coverage',x=>coverageLabel(x.coverage)]];
  el.innerHTML='<p><span>'+esc(t('Study area'))+': </span><strong data-i18n-ignore>'+esc(result.studyArea.label)+'</strong> · '+esc(t(dw().recordLabel(result.recordMode)))+'</p><div class="comparison-table-scroll"><table><thead><tr><th>'+esc(t('Summary'))+'</th><th data-i18n-ignore>'+esc(a.name)+'</th><th data-i18n-ignore>'+esc(b.name)+'</th></tr></thead><tbody>'+rows.map(([label,value])=>'<tr><th>'+esc(t(label))+'</th><td data-i18n-ignore>'+esc(value(a))+'</td><td data-i18n-ignore>'+esc(value(b))+'</td></tr>').join('')+'</tbody></table></div><p>'+esc(t('Difference (second minus first)'))+': <b data-i18n-ignore>'+number(result.difference.records)+'</b> '+esc(t('records'))+'; <b data-i18n-ignore>'+number(result.difference.areaM2)+'</b> m².'+(result.difference.areaMethodsDiffer?' '+esc(t('Area differences are approximate because measurement methods differ.')):'')+'</p><p>'+esc(t('Sum of valid whole polygon areas; overlapping records count separately.'))+'</p><p>'+esc(t('Heights use positive finite supplied values. Source heights may be estimates; rendering defaults and building levels are excluded.'))+'</p><p>'+esc(t('Aggregate comparison does not establish one-to-one footprint matches or accuracy.'))+'</p><p class="comparison-warning">'+esc(t(result.provenanceWarning))+'</p>';
 }
 function invalidate(){revision++;controller?.abort();result=null;renderResult();render();if(dialog?.open)status('Inputs changed. Run the comparison again.');}
 async function run(){if(busy)return;busy=true;controller=new AbortController();const own=++revision;result=null;renderResult();render();status('Comparing complete input records…');try{const value=await compare(root.PortalLayers.layers.get(leftId),root.PortalLayers.layers.get(rightId),{mode,signal:controller.signal});if(own!==revision)return;result=value;renderResult();status('Comparison complete. Review coverage and provenance.');return value;}catch(e){if(own===revision)status(e.message,true);}finally{busy=false;controller=null;render();}}
 function download(){if(!result)return;const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='building-source-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function ensure(){
  if(dialog)return;dialog=document.createElement('dialog');dialog.id='source-comparison-dialog';dialog.className='workspace-dialog source-comparison-dialog';
  dialog.innerHTML='<header class="workspace-dialog-heading"><h2 data-i18n>Compare building sources</h2><button data-comparison-close aria-label="Close" data-i18n-aria-label>×</button></header><div class="workspace-dialog-body"><p data-i18n>Compare two original polygon worksets with one saved study area and an explicit record scope.</p><p data-comparison-empty data-i18n>Load at least two original building worksets in Data workspace. Display tiles cannot be compared as original data.</p><div class="comparison-inputs"><label><span data-i18n>First workset</span><select data-comparison-left></select></label><label><span data-i18n>Second workset</span><select data-comparison-right></select></label><label><span data-i18n>Saved study area</span><select data-comparison-area></select></label><label><span data-i18n>Records to use</span><select data-comparison-mode><option value="area" data-i18n>Workset records in saved study area</option><option value="all" data-i18n>All workset records</option><option value="selection" data-i18n>Selected workset records</option></select></label></div><p data-i18n>Area scope keeps whole intersecting outlines. All and selected modes require both worksets to have the same saved loading area.</p><div class="comparison-actions"><button class="primary" data-comparison-run data-i18n>Compare sources</button><button data-comparison-cancel hidden data-i18n>Cancel</button><button data-comparison-export disabled data-i18n>Download comparison receipt</button><button data-comparison-workspace data-i18n>Open Data workspace</button></div><p data-comparison-status role="status"></p><div data-comparison-result></div></div>';document.body.append(dialog);
  dialog.querySelector('[data-comparison-close]').onclick=()=>dialog.close();dialog.querySelector('[data-comparison-cancel]').onclick=()=>{revision++;controller?.abort();status('Comparison cancelled.');};dialog.querySelector('[data-comparison-run]').onclick=run;dialog.querySelector('[data-comparison-export]').onclick=download;dialog.querySelector('[data-comparison-workspace]').onclick=()=>{dialog.close();dw().open();};
  for(const side of ['left','right'])dialog.querySelector('[data-comparison-'+side+']').onchange=e=>{if(side==='left')leftId=e.target.value;else rightId=e.target.value;invalidate();};dialog.querySelector('[data-comparison-area]').onchange=e=>{dw().chooseArea(e.target.value);invalidate();};dialog.querySelector('[data-comparison-mode]').onchange=e=>{mode=e.target.value;invalidate();};
  dialog.addEventListener('close',()=>{if(busy){revision++;controller?.abort();}});
 }
 function open(value){ensure();const l=typeof value==='string'?root.PortalLayers.layers.get(value):value?.layer||value||root.PortalLayers.active;if(eligible(l))leftId=l.id;if(value?.mode)mode=dw().normalize(value.mode);revision++;controller?.abort();result=null;renderResult();render();status('');if(!dialog.open)dialog.showModal();}
 root.PortalSourceComparison={eligible,worksets,summarizeBrowser,compare,open,run,render,get result(){return result;},get busy(){return busy;}};
 if(!root.document)return;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-source-comparison]');if(b){e.preventDefault();open(b.dataset.sourceComparison||null);}});
 for(const event of ['portal-layers-changed','portal-data-context-changed','portal-bulk-selection-changed'])document.addEventListener(event,()=>{if(dialog?.open)invalidate();});
 document.addEventListener('portal-native-engine-changed',()=>{if(dialog?.open&&!busy)render();});document.addEventListener('portal-language-changed',()=>{if(dialog){render();renderResult();}});
})(globalThis);
