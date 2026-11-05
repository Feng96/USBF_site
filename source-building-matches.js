/* One native correspondence algorithm, full immutable original input records. */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),t=s=>root.PortalI18n?.t(s)||s;
 const labels={'one-to-one':'One to one','one-to-many':'One to many / possible split','many-to-one':'Many to one / possible merge',ambiguous:'Ambiguous correspondence','unmatched-left':'First source only','unmatched-right':'Second source only','invalid-left':'Invalid first-source outline','invalid-right':'Invalid second-source outline'};
 const engine=()=>root.PortalNativeEngine,workspace=()=>engine().status().information?.workspace?.id||engine().status().information?.workspaceId;
 let host=null,reportId=null,report=null,offset=0,category='',chosen=new Set(),generation=0,loading=false,messageSource='',messageError=false;
 function message(value,error=false){messageSource=value;messageError=error;const e=host?.querySelector('[data-match-status]');if(e){e.textContent=t(value);e.classList.toggle('comparison-error',error);}}
 function requireEngine(){const s=engine()?.status();if(s?.readonly)throw Error('Local engine access is disabled in a read-only shared map.');if(!s?.connected)throw Error('Connect and pair the local engine to match complete original buildings.');if(!s.information?.capabilities?.resultMatching||!engine().createMatching)throw Error('Update and pair the local engine to match complete original buildings.');}
 function abort(signal){if(signal?.aborted)throw new DOMException('Comparison cancelled.','AbortError');}
 function pause(signal){return new Promise((resolve,reject)=>{abort(signal);const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);resolve();},stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new DOMException('Comparison cancelled.','AbortError'));},timer=setTimeout(done,250);signal?.addEventListener('abort',stop,{once:true});});}
 async function wait(job,{signal,assertCurrent=()=>{}}={}){
  const stop=()=>engine().cancel(job.id).catch(()=>{});signal?.addEventListener('abort',stop,{once:true});
  try{for(;;){abort(signal);assertCurrent();if(job.status==='completed')return job;if(['failed','cancelled','interrupted','partial'].includes(job.status))throw Error(job.error||'Building correspondence did not complete.');await pause(signal);job=await engine().job(job.id,{signal});}}
  catch(e){await engine().cancel(job.id).catch(()=>{});throw e;}finally{signal?.removeEventListener('abort',stop);}
 }
 async function nativeInput(layer,{mode,saved,signal,assertCurrent,summary}){
  assertCurrent();abort(signal);
  if(layer.cfg.nativeSource){const scope=await root.PortalDataWorkspace.nativeScope(layer,mode);assertCurrent();return {jobId:layer.cfg.nativeSource.jobId,selectionId:scope.selectionId||null,name:layer.cfg.name};}
  const items=await root.PortalDataWorkspace.records(layer,mode,{signal,areaRange:saved});assertCurrent();abort(signal);
  if(items.length>20000)throw Error('This comparison input exceeds 20,000 records. Use a smaller saved area or the local engine.');
  const data={type:'FeatureCollection',features:clone(items)},bytes=new TextEncoder().encode(JSON.stringify(data)).length;
  if(bytes>15*1024*1024)throw Error('This browser workset exceeds the 15 MiB staging budget. Import its original file in the local engine.');
  message('Saving complete original records in the local engine…');
  const imported=await engine().importGeoJSON('building-match-'+crypto.randomUUID()+'.geojson',data);assertCurrent();abort(signal);
  const contract=clone(summary.provenance.inputContract),job=await engine().create({schema:1,operation:'load',name:layer.cfg.name,inputs:[{kind:'file',path:imported.path}],inputContract:contract,release:clone(summary.provenance.release||null)});
  const staged=await wait(job,{signal,assertCurrent});assertCurrent();
  // Staged selected records retain their raw Feature.id and attributes. Their
  // immutable all-row selection binds exactly the selected original workset.
  const selection=mode==='selection'?await engine().selectResult(staged.id,{mode:'replace',query:{}},{signal}):null;
  return {jobId:staged.id,selectionId:selection?.selectionId||null,name:layer.cfg.name};
 }
 async function run(left,right,{mode,saved,summary,signal,assertCurrent,thresholds}={}){
  requireEngine();const own=++generation;report=null;reportId=null;chosen.clear();offset=0;category='';render();
  const a=await nativeInput(left,{mode,saved,signal,assertCurrent,summary:summary.sources[0]}),b=await nativeInput(right,{mode,saved,signal,assertCurrent,summary:summary.sources[1]});
  assertCurrent();abort(signal);message('Matching complete original buildings…');
  const job=await engine().createMatching({left:a,right:b,recordMode:mode,studyArea:{geometry:clone(saved.mask.geometry),label:saved.meta.label,crs:'EPSG:4326'},thresholds,inputContract:{version:1,recordMode:mode,studyArea:clone(saved.meta),sources:summary.sources.map(s=>clone(s.provenance.inputContract))}});
  await wait(job,{signal,assertCurrent});assertCurrent();abort(signal);
  if(own!==generation)throw new DOMException('Comparison cancelled.','AbortError');reportId=job.id;report=await engine().matchingPage(reportId,{limit:50},{signal});assertCurrent();abort(signal);render();
  await root.PortalTasks?.refreshNative?.();return {performed:true,jobId:reportId,summary:clone(report.summary),thresholds:clone(report.thresholds),interpretation:report.interpretation};
 }
 function reset(){generation++;reportId=null;report=null;chosen.clear();offset=0;category='';loading=false;message('');render();}
 function format(v){return v===null||v===undefined?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:3});}
 function ids(value,native){return value&&Object.keys(value).length?JSON.stringify(value):native||'—';}
 function render(){
  if(!host)return;message(messageSource,messageError);const body=host.querySelector('[data-match-report]');if(!report){body.innerHTML='<p>'+esc(t('Enable building correspondence and compare sources to create a full native pair report.'))+'</p>';return;}
  const selected=chosen.size,counts=Object.entries(report.summary.categories),start=report.total?report.offset+1:0,end=report.offset+report.rows.length;
  body.innerHTML='<p>'+esc(t('Study area'))+': <strong data-i18n-ignore>'+esc(report.studyArea.label||'')+'</strong> · '+esc(t(root.PortalDataWorkspace.recordLabel(report.recordMode||report.inputContract?.recordMode||'area')))+'</p><p class="comparison-warning">'+esc(t(report.interpretation))+'</p><p>'+esc(t('IoU threshold'))+': <b data-i18n-ignore>'+format(report.thresholds.iou)+'</b> · '+esc(t('Either-side coverage threshold'))+': <b data-i18n-ignore>'+format(report.thresholds.coverage)+'</b></p><p>'+esc(t('Compatible source IDs take priority. Other candidates require positive exact overlap and either threshold. Splits, merges and ambiguities stay visible.'))+'</p><p>'+esc(t('Matched original records'))+': <b data-i18n-ignore>'+format(report.summary.matchedLeft)+' / '+format(report.summary.leftRecords)+'</b> · <b data-i18n-ignore>'+format(report.summary.matchedRight)+' / '+format(report.summary.rightRecords)+'</b></p><div class="match-categories">'+counts.map(([key,count])=>'<button type="button" data-match-category="'+esc(key)+'" aria-pressed="'+(category===key)+'">'+esc(t(labels[key]))+' <b data-i18n-ignore>'+format(count)+'</b></button>').join('')+'</div><div class="comparison-actions"><button type="button" data-match-category="" aria-pressed="'+(!category)+'">'+esc(t('All report rows'))+'</button><button type="button" data-match-download>'+esc(t('Download full pair report (CSV)'))+'</button><button type="button" data-match-download-json>'+esc(t('Download full pair report (JSON)'))+'</button></div><p><span data-i18n-ignore>'+format(start)+'–'+format(end)+' / '+format(report.total)+'</span> · '+esc(t('report rows'))+' · <span data-match-selected-count>'+format(selected)+'</span> '+esc(t('selected pairs'))+'</p><div class="comparison-table-scroll match-pair-scroll"><table class="match-pair-table"><thead><tr><th>'+esc(t('Select'))+'</th><th>'+esc(t('First source ID'))+'</th><th>'+esc(t('Second source ID'))+'</th><th>'+esc(t('Correspondence'))+'</th><th>IoU</th><th>'+esc(t('Coverage first / second'))+'</th></tr></thead><tbody>'+report.rows.map(row=>'<tr><td><input type="checkbox" data-match-pair="'+row.pair_id+'" aria-label="'+esc(t('Select pair'))+' '+row.pair_id+'" '+(chosen.has(row.pair_id)?'checked':'')+'></td><td data-i18n-ignore>'+esc(ids(row.left_source_ids,row.leftId))+'</td><td data-i18n-ignore>'+esc(ids(row.right_source_ids,row.rightId))+'</td><td>'+esc(t(labels[row.category]))+'<small>'+esc(t(row.basis==='compatible-provenance'?'Compatible source provenance':row.basis==='spatial-overlap'?'Exact spatial overlap':'No accepted correspondence'))+'</small></td><td data-i18n-ignore>'+format(row.iou)+'</td><td data-i18n-ignore>'+format(row.left_coverage)+' / '+format(row.right_coverage)+'</td></tr>').join('')+'</tbody></table></div><div class="comparison-actions"><button data-match-previous '+(report.offset===0?'disabled':'')+'>'+esc(t('Previous page'))+'</button><button data-match-next '+(end>=report.total?'disabled':'')+'>'+esc(t('Next page'))+'</button><button data-match-clear-selected '+(!selected?'disabled':'')+'>'+esc(t('Clear selected pairs'))+'</button></div><p>'+esc(t('Record actions use selected pairs, or every row in the current category when no pairs are selected. Original attributes are preserved.'))+'</p><div class="match-source-actions">'+['left','right'].map((side,i)=>'<fieldset><legend data-i18n-ignore>'+esc(report.sources[i].name)+'</legend><button data-match-record-action="table" data-match-side="'+side+'">'+esc(t('Open original records table'))+'</button><button data-match-record-action="export" data-match-side="'+side+'">'+esc(t('Export original records (GeoJSON)'))+'</button><button data-match-record-action="map" data-match-side="'+side+'">'+esc(t('Add discrepancy records to map'))+'</button></fieldset>').join('')+'</div><p><span>'+esc(t('Report task'))+': </span><code data-i18n-ignore>'+esc(reportId)+'</code></p><p>'+esc(t(report.measurement))+'</p>';
  for(const button of body.querySelectorAll('[data-match-category]'))button.onclick=()=>page(0,button.dataset.matchCategory);
  body.querySelector('[data-match-previous]').onclick=()=>page(Math.max(0,report.offset-report.limit));body.querySelector('[data-match-next]').onclick=()=>page(report.offset+report.limit);body.querySelector('[data-match-clear-selected]').onclick=()=>{chosen.clear();render();};
  for(const input of body.querySelectorAll('[data-match-pair]'))input.onchange=()=>{const key=Number(input.dataset.matchPair);if(input.checked)chosen.add(key);else chosen.delete(key);body.querySelector('[data-match-selected-count]').textContent=format(chosen.size);body.querySelector('[data-match-clear-selected]').disabled=!chosen.size;};
  body.querySelector('[data-match-download]').onclick=()=>action(()=>engine().downloadMatches(reportId,'csv'));body.querySelector('[data-match-download-json]').onclick=()=>action(()=>engine().downloadMatches(reportId,'json'));
  for(const button of body.querySelectorAll('[data-match-record-action]'))button.onclick=()=>action(()=>recordsAction(button.dataset.matchSide,button.dataset.matchRecordAction));
  if(loading)for(const button of body.querySelectorAll('button,input'))button.disabled=true;
 }
 async function action(fn){if(loading)return;loading=true;render();message('Reading complete original records…');try{requireEngine();await fn();message('Complete original record action finished.');}catch(e){message(e.message,true);}finally{loading=false;render();}}
 async function page(next,nextCategory=category){const own=generation;await action(async()=>{category=nextCategory;offset=next;chosen.clear();const value=await engine().matchingPage(reportId,{offset,limit:50,...(category?{category}:{})});if(own===generation)report=value;});}
 function sourceRef(source){return {version:1,workspaceId:workspace(),jobId:source.jobId,path:source.result.path,sha256:source.sha256,format:'GeoParquet',recordCount:source.sourceTotal,release:clone(source.release||null)};}
 async function recordsAction(side,actionName){
  const own=generation,id=reportId,snapshot=report,source=snapshot.sources[side==='left'?0:1],selection=await engine().matchingSelection(id,{side,...(chosen.size?{pairIds:Array.from(chosen)}:category?{category}:{})});
  if(own!==generation)return;if(!selection.count)throw Error('This report category has no original records on this source side.');
  if(actionName==='table'){document.querySelector('#source-comparison-dialog')?.close();return root.PortalTasks.openNativeTable({cfg:{name:source.name,nativeSource:sourceRef(source)}},{fixedSelectionId:selection.selectionId,fixedScopeLabel:t('Building correspondence report'),selectedOnly:false});}
  if(actionName==='export')return engine().download(source.jobId,'geojson',{selectionId:selection.selectionId});
  if(actionName==='map'){
   message('Creating a complete discrepancy layer…');
   const job=await engine().create({schema:1,operation:'load',name:source.name+' · '+t(category?labels[category]:'Building correspondence records'),inputs:[{kind:'native-selection',jobId:source.jobId,selectionId:selection.selectionId}],inputContract:{version:1,recordMode:'selection',recordCount:selection.count,sourceRecordCount:source.sourceTotal,matchingReportId:id,category:category||null,selectedPairs:Array.from(chosen)},release:clone(source.release||null)});
   const complete=await wait(job);if(own!==generation)return;
   await root.PortalTasks.refreshNative();const task=root.PortalTasks.list().find(row=>row.nativeId===complete.id);if(!task)throw Error('The native discrepancy task is available in Task center.');
   const layer=await root.PortalTasks.preview(task.id);root.PortalLayers.setStyle(layer.id,{color:side==='left'?'#d07939':'#397db1'});root.PortalLayers.selectLayer(layer.id);return layer;
  }
 }
 async function openReport(id){requireEngine();const own=++generation,value=await engine().matchingPage(id,{limit:50});if(own!==generation)return;reportId=id;report=value;offset=0;category='';chosen.clear();render();message('Building correspondence report loaded.');return value;}
 function bind(element){host=element;render();}
 root.PortalBuildingMatches={bind,run,reset,render,openReport,get report(){return report;},get reportId(){return reportId;},get loading(){return loading;}};
})(globalThis);
