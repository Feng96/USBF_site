/* Goal-based teaching reuses the existing tools and their explicit input contracts. */
(function(root){
 'use strict';
 if(root.PortalReadOnlyMode)return;
 const $=s=>document.querySelector(s),ui=s=>root.PortalI18n?.t(s)||s;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tasks=[['count','Count building records','Count whole records in a fixed workset or selection.'],['height','Summarize building heights','Report valid heights and missing values without filling gaps.'],['buffer','Find an area around buildings','Create a measured buffer around full selected geometries.'],['map','Create a shareable map','Style your layers and review coverage before sharing.']];
 const sessions=new Map(),objects=new WeakMap();let sequence=0,dialog,resume,task='count',session=null,busy=false,revision=0,projectId=null,projectState={};
 const oid=o=>{if(!o||typeof o!=='object')return null;if(!objects.has(o))objects.set(o,++sequence);return objects.get(o);};
 const allLayers=()=>Array.from(root.PortalLayers?.layers.values()||[]);
 const eligible=l=>!!l&&(!!l.cfg.nativeSource||root.PortalDataWorkspace.ready(l));
 const number=n=>Number(n||0).toLocaleString('en-US');
 function coverage(layer){const p=layer?.data?.provenance||{},c=p.coverageContract||p.coverage||{},partial=layer?.cfg.nativeSource?p.nativeJobStatus==='partial':p.limited||layer?.viewLimited;return {request:!layer?'No analysis workset':partial?'Partial request':c.requestComplete===true||p.workspaceWorkset?.coverage==='request-complete'||layer.cfg.nativeSource?'Request complete':'Request completion unknown',index:c.geometryBoundsGuaranteed===true?(c.candidateIndex==='full-input'?'All input records scanned':'Geometry index verified'):'Geometry index completeness unknown',provider:c.providerCompleteness===true?'Provider completeness verified':'Real-world completeness unknown'};}
 function renderCoverage(layer,element){if(!element)return;const c=coverage(layer);element.innerHTML='<dl class="workflow-coverage"><div><dt data-i18n>Loading request</dt><dd>'+esc(ui(c.request))+'</dd></div><div><dt data-i18n>Candidate index</dt><dd>'+esc(ui(c.index))+'</dd></div><div><dt data-i18n>Provider coverage</dt><dd>'+esc(ui(c.provider))+'</dd></div></dl>';}
 async function summarize(layer,scope,field,positiveOnly=false){
  if(layer.cfg.nativeSource){if(!root.PortalNativeEngine.status().information?.capabilities?.resultSummary)throw Error('Update and pair the local engine to summarize full results.');const selected=await root.PortalDataWorkspace.nativeScope(layer,scope);if(scope==='selection'&&!selected?.count)throw Error('Select records in the complete native result first.');return root.PortalNativeEngine.summary(layer.cfg.nativeSource.jobId,{...(positiveOnly?{positiveOnly:true}:{}),...(selected?.selectionId?{selectionId:selected.selectionId}:{}),...(field?{field}:{})});}
  const records=await root.PortalDataWorkspace.records(layer,scope),name=field||['height_m','height','render_height'].find(k=>records.some(f=>Object.hasOwn(f.properties||{},k))),values=name?records.map(f=>f.properties?.[name]):[],summary=root.PortalAnalysisData.summarize(positiveOnly?values.map(v=>root.PortalAnalysisData.number(v)>0?v:null):values);return {records:records.length,field:name||null,...(name?summary:{})};
 }

 function syncProject(){const id=root.PortalProjects?.current?.id||null;if(projectId!==id){projectId=id;sessions.clear();session=null;revision++;}}
 function state(id=task){if(!sessions.has(id))sessions.set(id,{step:0,layerId:null,mode:'all',field:'',areaChoice:false,displayReviewed:false,reviewed:false,finished:false,output:null,result:null,notice:'',message:'',handoff:null,saved:null,bufferStart:null,baseRevision:root.PortalProjects?.current?.revision||0});return sessions.get(id);}
 function current(){if(session?.layerId)return root.PortalLayers.layers.get(session.layerId)||null;return root.PortalDataWorkspace.current();}
 function bind(layer){if(!eligible(layer))return;session.layerId=layer.id;root.PortalDataWorkspace.chooseWorkset(layer.id);}
 function activate(){const l=current();if(l){root.PortalDataWorkspace.chooseWorkset(l.id);root.PortalLayers.selectLayer(l.id);}return l;}
 function selectionKey(l){return l?.cfg.nativeSource?root.PortalNativeResults?.selection(l)?.selectionId||null:l?root.PortalGISSelection.features(l).map(oid):null;}
 function mapKey(){const m=root.portal?.map,c=m?.getCenter();return JSON.stringify([allLayers().map(l=>[l.id,oid(l.data),l.visible,l.color,l.opacity,l.colorMode,l.heightField,l.sourceFilter,l.minArea]),c&&[c.lng,c.lat,m.getZoom(),m.getPitch(),m.getBearing()],root.portal?.getBasemap?.(),root.PortalComposer?.projectOptions?.()]);}
 function inputKey(){const l=current(),a=root.PortalDataWorkspace.area();return JSON.stringify([l?.id,oid(l?.data),l?.cfg.nativeSource,l?.cfg.nativeSource?root.PortalNativeResults?.connectionVersion:null,session.mode,session.mode==='selection'?selectionKey(l):null,session.mode==='area'?[a?.id,oid(a?.data)]:null,task==='height'?session.field:null]);}
 function invalidate(){if(!session)return;const key=task==='map'?mapKey():inputKey();if(session.result&&session.result.key!==key||session.output&&session.output.key!==key){session.result=null;session.output=null;session.message='';session.reviewed=false;session.finished=false;session.saved=null;session.notice='The input changed. Repeat the result step before finishing.';revision++;}}
 function readyInput(){const l=current();return eligible(l)&&!(session.mode==='selection'&&!root.PortalGISSelection.count(l))&&!(session.mode==='area'&&!root.PortalDataWorkspace.area());}
 function areaReady(){return task==='map'?session.areaChoice:!!root.PortalDataWorkspace.area()||eligible(current());}
 function resultReady(){return task==='map'?!!session.output:task==='buffer'?!!session.output:!!session.result&&(task!=='height'||!!session.result.value.field);}
 function checks(){return [areaReady(),task==='map'?session.displayReviewed:eligible(current()),resultReady(),resultReady()&&session.reviewed,session.finished];}
 function labels(){return task==='map'?['Choose your map area','Choose map layers','Design and export','Review your map','Save and finish']:['Choose your study area','Prepare building data','Choose records and run','Review your result','Save and finish'];}
 function instruction(){const map=task==='map';return [
  [map?'Move the map to the place you want to show, then use the current view. You can also save a boundary in Data & scope.':'Save a boundary when loading original data from an online source. If you already imported a fixed dataset, you can use that dataset directly.',map?'A map frame describes what your audience sees. It does not select buildings for analysis.':'A saved boundary stays fixed when you pan or zoom the map.'],
  [map?'Add the layers you want to show. PMTiles, raster basemaps and original vector layers can all appear on a map.':'Load original records for your saved area, import a vector file, or choose an existing analysis workset below.',map?'Fast display data is enough for map design. Loading analytical records is optional.':'PMTiles provides fast display. Analysis needs original records such as GeoJSON or a complete local GeoParquet result.'],
  [map?'Open the map designer, set a title and legend, preview your layout, then export PNG or PDF. Return here after exporting.':task==='buffer'?'Choose exactly which records to use. Open Buffer, set a distance and units, then run the operation. Return after the result is created.':task==='height'?'Choose the input records and a height field, then calculate. Read the valid and missing value counts together.':'Choose the input records, then calculate their count. All records means this fixed dataset, not every building in the country.',map?'An exported map is an image or document. A Project keeps an editable map.':'Moving the map never changes this analytical input. Selected records refers to the batch selection, not the single highlighted building.'],
  [map?'Check the exported map title, legend, visible layers, source attribution and coverage. Confirm after reviewing the output.':task==='buffer'?'Choose the completed Buffer task you just ran. Inspect its output and distance settings in Task center, then confirm your review.':'Read the result and coverage notes. Open the attribute table to inspect the original records if needed, then confirm your review.',map?'A clear legend and source notes help readers understand what the map represents.':'Request completion does not establish complete coverage of real-world buildings. Partial results must be described as partial.'],
  ['Save your editable map as a Project. You can also finish without saving, or download a Project file to move it to another computer.','A Project saves map settings and input layers. Summary values in this guide stay in this session; download the summary separately.']
 ][session.step];}
 function buttons(items){return items.map(([action,label,disabled=false])=>'<button type="button" data-guide-action="'+action+'"'+(disabled?' disabled':'')+'>'+esc(ui(label))+'</button>').join('');}
 function updateResume(){if(!resume)return;resume.hidden=!session||session.finished||!!dialog?.open;resume.textContent=ui('Continue task')+' · '+ui(tasks.find(t=>t[0]===task)[1])+' · '+(session?.step+1)+'/5';}
 function render(){
  if(!dialog)return;syncProject();if(session){if(session.handoff==='data'){const l=root.PortalDataWorkspace.current();if(eligible(l))bind(l);}if(!session.layerId&&task!=='map'&&eligible(root.PortalDataWorkspace.current()))bind(root.PortalDataWorkspace.current());invalidate();}
  $('[data-workflow-intro]').hidden=!!session;$('[data-workflow-guide]').hidden=!session;
  $('[data-workflow-cards]').innerHTML=tasks.map(([id,title,note])=>'<button type="button" data-workflow="'+id+'"><b>'+esc(ui(title))+'</b><small>'+esc(ui(note))+'</small></button>').join('');
  if(!session){updateResume();return;}
  const l=current(),a=root.PortalDataWorkspace.area(),done=checks(),step=session.step,title=tasks.find(t=>t[0]===task)[1];
  $('[data-workflow-title]').textContent=ui(title);$('[data-workflow-progress]').value=done.filter(Boolean).length;$('[data-workflow-progress-label]').textContent=ui('Step')+' '+(step+1)+' / 5';
  $('[data-workflow-stepper]').innerHTML=labels().map((label,i)=>'<li class="'+(done[i]?'is-complete':'')+'"><button type="button" data-workflow-step="'+i+'"'+(step===i?' aria-current="step"':'')+'><span class="workflow-step-number" aria-hidden="true">'+(done[i]?'✓':i+1)+'</span><span>'+esc(ui(label))+'</span></button></li>').join('');
  $('[data-workflow-step-title]').textContent=ui(labels()[step]);const [what,why]=instruction();$('[data-workflow-instruction]').textContent=ui(what);$('[data-workflow-why]').textContent=ui(why);
  $('[data-workflow-area]').textContent=a?.cfg.name||ui(task==='map'&&session.areaChoice?'Current map view':'No saved study area');
  $('[data-workflow-workset]').textContent=task==='map'?allLayers().filter(l=>l.visible&&!root.PortalDataWorkspace.isArea(l)).map(l=>l.cfg.name).join(' · ')||ui('Basemap only'):l?l.cfg.name+' · '+number(l.cfg.nativeSource?.recordCount??l.data.features.length)+' '+ui('records'):ui('No analysis workset');
  $('[data-workflow-execution]').textContent=ui(task==='map'?'Browser · this computer':l?.cfg.nativeSource?'Local engine · this computer':'Browser · this computer');
  $('[data-workflow-notice]').textContent=ui(session.notice);$('[data-workflow-message]').textContent=ui(session.message);$('[data-workflow-status]').textContent=ui(done[step]?'Step complete':'Not complete yet');$('[data-workflow-status]').classList.toggle('is-complete',done[step]);
  for(const node of dialog.querySelectorAll('[data-guide-panel]'))node.hidden=Number(node.dataset.guidePanel)!==step;
  const options=allLayers().filter(eligible);$('[data-workflow-layer]').innerHTML='<option value="">'+esc(ui('Choose an analysis workset'))+'</option>'+options.map(o=>'<option value="'+esc(o.id)+'"'+(l===o?' selected':'')+'>'+esc(o.cfg.name)+'</option>').join('');
  $('[data-workflow-layer-wrap]').hidden=task==='map';$('[data-workflow-use-map]').hidden=task!=='map';
  $('[data-workflow-area-actions]').innerHTML=buttons([['area','Open area settings'],...(task==='map'?[['use-view','Use current map view']]:eligible(l)?[['use-file','Use existing dataset']]:[])]);
  $('[data-workflow-data-actions]').innerHTML=buttons([['data',task==='map'?'Add map layers':'Load or choose workset'],['import','Import a local file']]);
  const scope=$('[data-workflow-scope]');scope.disabled=busy;scope.value=session.mode;scope.querySelector('[value=area]').disabled=!a;scope.querySelector('[value=selection]').disabled=!l||!root.PortalGISSelection.count(l);
  $('[data-workflow-record-controls]').hidden=task==='map';$('[data-workflow-field-wrap]').hidden=task!=='height';
  const field=$('[data-workflow-field]');field.innerHTML='<option value="">'+esc(ui('Use available height field'))+'</option>'+(l?.fields||[]).map(k=>'<option data-i18n-ignore value="'+esc(k)+'">'+esc(k)+'</option>').join('');field.value=session.field;field.disabled=busy;$('[data-workflow-layer]').disabled=busy;$('[data-workflow-change]').disabled=busy;
  $('[data-workflow-selected-count]').textContent=number(l?root.PortalGISSelection.count(l):0)+' '+ui('selected records');
  $('[data-workflow-run]').textContent=ui(task==='buffer'?'Review buffer parameters':task==='map'?'Open map designer':'Calculate summary');$('[data-workflow-run]').disabled=busy||task!=='map'&&!readyInput();
  $('[data-workflow-height-note]').hidden=task!=='height';renderCoverage(task==='map'?null:l,$('[data-workflow-coverage]'));$('[data-workflow-coverage]').hidden=task==='map';
  $('[data-workflow-result]').innerHTML=session.result?renderResult(session.result.value):session.output?'<p data-i18n-ignore>'+esc(outputLabel(session.output))+'</p>':'';
  $('[data-workflow-result-empty]').hidden=resultReady();$('[data-workflow-result-empty]').textContent=ui(task==='map'?'Export a map from the designer before continuing.':task==='buffer'?'Opening Buffer or creating a plan does not create a result. Run the task, then choose its completed result.':'Calculate the result before continuing.');
  $('[data-workflow-result]').hidden=![2,3].includes(step);
  $('[data-workflow-review-actions]').innerHTML=buttons(task==='map'?[['designer','Open map designer']]:task==='buffer'?[['tasks','Open Task center']]:[['table','Inspect input records'],['summary-download','Download summary',!session.result]]);
  $('[data-workflow-buffer-output]').hidden=task!=='buffer';renderBufferChoices();
  const review=$('[data-workflow-reviewed]');review.checked=session.reviewed;review.disabled=!resultReady();
  $('[data-workflow-save-actions]').innerHTML=buttons([['save','Save Project',busy||!done[3]],['projects','Open Projects'],['project-download','Download Project file',busy],...(session.result?[['summary-download','Download summary']]:[])]);
  $('[data-workflow-finish]').disabled=!done[3]||busy;$('[data-workflow-finish]').textContent=ui(session.saved?'Finish task':'Finish without saving');
  $('[data-workflow-saved]').textContent=ui(session.saved?'Project saved in this browser.':'This workflow has not saved a Project yet.');
  $('[data-workflow-finished]').hidden=!session.finished;$('[data-workflow-back]').disabled=busy||step===0;$('[data-workflow-next]').hidden=step===4;$('[data-workflow-next]').disabled=busy||!done[step];
  updateResume();
 }
 function outputLabel(out){return task==='map'?ui('Map exported')+' · '+out.action:out.name+' · '+number(out.rows)+' · '+ui(out.partial?'Partial request':'Request complete');}
 function renderResult(value){const facts=[['Input records',value.records]];if(task==='height'&&value.field)facts.push(['Field',value.field],['Valid values',value.valid],['Missing values',value.missing],['Minimum',value.min],['Maximum',value.max],['Mean',value.mean]);else if(task==='height')facts.push(['Height field','No height field available']);return '<dl>'+facts.map(([k,v])=>'<div><dt>'+esc(ui(k))+'</dt><dd data-i18n-ignore>'+esc(v===null||v===undefined?'—':typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:3}):k==='Height field'?ui(v):v)+'</dd></div>').join('')+'</dl><p>'+esc(ui('Counts describe input records, not certified coverage of every real-world building.'))+'</p>';}
 function bufferChoices(){if(!session?.bufferStart||session.bufferStart.key!==inputKey())return [];return (root.PortalTasks?.list()||[]).filter(row=>!session.bufferStart.ids.includes(row.id)&&row.operation==='buffer'&&['completed','partial'].includes(row.status)&&row.result&&(row.execution==='native'||row.source?.layerId===session.layerId));}
 function renderBufferChoices(){const el=$('[data-workflow-output]');if(!el)return;el.innerHTML='<option value="">'+esc(ui('Choose the completed Buffer result'))+'</option>'+bufferChoices().map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+' · '+number(r.result.rows)+' · '+esc(ui(r.status==='partial'?'Partial request':'Request complete'))+'</option>').join('');el.value=session?.output?.taskId||'';}
 async function chooseBuffer(id){
  const s=session,row=bufferChoices().find(r=>r.id===id),l=current(),key=inputKey();s.output=null;s.reviewed=false;if(!row){render();return;}
  busy=true;render();try{if(row.execution==='native'){
    const job=await root.PortalNativeEngine.job(row.nativeId),c=job.inputContract,ref=l.cfg.nativeSource;
    const matches=ref?c?.nativeSource?.workspaceId===ref.workspaceId&&c.nativeSource.jobId===ref.jobId:c?.worksetId===l.id;
    if(!matches||c.recordMode!==s.mode)throw Error('This Buffer task used a different input. Choose the task for this workset and record scope.');
   }
   if(s!==session||key!==inputKey()||s.bufferStart?.key!==key)throw Error('The input changed. Repeat the result step before finishing.');
   s.baseRevision=root.PortalProjects?.current?.revision||0;s.saved=null;s.output={key,taskId:row.id,name:row.name,rows:row.result.rows,partial:row.status==='partial'};s.notice='';
  }catch(e){s.notice=e.message;}finally{busy=false;render();}
 }
 function handoff(action,fn){const owner=session;session.handoff=action;dialog.close();updateResume();try{const result=fn();if(result?.catch)result.catch(e=>{owner.notice=e.message;root.portal.toast(ui(e.message));});}catch(e){owner.notice=e.message;root.portal.toast(ui(e.message));}}
 async function run(){if(busy||!session)return;const l=current();if(task!=='map'&&!readyInput())return;session.notice='';
  if(task==='map')return handoff('map',()=>root.PortalComposer.open('map'));
  activate();if(task==='buffer'){session.bufferStart={ids:(root.PortalTasks?.list()||[]).map(r=>r.id),key:inputKey()};return handoff('buffer',()=>l.cfg.nativeSource?root.PortalTasks.openProcessing(l,'buffer',{mode:session.mode}):(root.PortalGIS.open('buffer'),root.PortalGIS.setInputMode?.(session.mode)));}
  busy=true;const own=++revision,s=session,key=inputKey(),kind=task;s.message='Calculating full input summary…';render();
  try{const value=await summarize(l,s.mode,kind==='height'?s.field:null,kind==='height');if(own!==revision||s!==session||key!==inputKey())throw Error('The input changed. Calculate the summary again.');s.result={key,value,layerName:l.cfg.name,mode:s.mode};s.reviewed=false;s.saved=null;s.baseRevision=root.PortalProjects?.current?.revision||0;s.finished=false;s.message=kind==='height'&&!value.field?'No height field available':'Summary complete. Missing values remain missing.';return value;}
  catch(e){if(s===session)s.message=e.message;}finally{busy=false;render();}
 }
 function start(id,options={}){task=id;session=state(id);if(options.layerId){const l=root.PortalLayers.layers.get(options.layerId);if(eligible(l)){bind(l);root.PortalLayers.selectLayer(l.id);}}if(['all','selection','area'].includes(options.mode))session.mode=options.mode;if(!session.layerId&&eligible(root.PortalDataWorkspace.current()))bind(root.PortalDataWorkspace.current());if(options.direct)session.step=2;render();}
 async function action(id){
  if(busy||!session)return;session.notice='';
  if(id==='area')return handoff('area',()=>root.PortalDataWorkspace.open());
  if(id==='use-view'){session.areaChoice=true;return render();}
  if(id==='use-file'){if(eligible(current()))session.step=1;return render();}
  if(id==='data')return handoff('data',()=>task==='map'?root.PortalLayers.open():root.PortalDataWorkspace.open());
  if(id==='import')return handoff('data',()=>root.PortalLayers.open('file'));
  if(id==='designer')return handoff('map',()=>root.PortalComposer.open('map'));
  if(id==='tasks')return handoff('buffer-review',()=>root.PortalTasks.open());
  if(id==='table')return handoff('table',async()=>{activate();const l=current();if(l.cfg.nativeSource){const s=await root.PortalDataWorkspace.nativeScope(l,session.mode);return root.PortalTasks.openNativeTable(l,{fixedSelectionId:s.selectionId,fixedScopeLabel:s.label});}const records=await root.PortalDataWorkspace.records(l,session.mode);root.PortalInventory.openTable(l.id,{scope:'loaded',records});});
  if(id==='projects')return handoff('project',()=>root.PortalProjects.open());
  if(id==='project-download'){const s=session;try{const value=await root.PortalProjects.exportFile();if(value&&s===session){s.notice='Project file downloaded. Summary values are a separate download.';render();}}catch(e){s.notice=e.message;render();}return;}
  if(id==='save'){busy=true;const s=session;render();try{const value=await root.PortalProjects.save();if(value&&s===session){s.saved={id:value.id,revision:value.revision};s.notice='Project saved in this browser.';}}catch(e){s.notice=e.message;}finally{busy=false;render();}return;}
  if(id==='summary-download'&&session.result){const r=session.result,data={goal:task,layer:r.layerName,recordScope:r.mode,summary:r.value,coverage:coverage(current()),createdAt:new Date().toISOString()},url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='USBF-'+task+'-summary.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);session.notice='Summary downloaded. Keep it with your Project.';return render();}
 }
 function ensure(){if(dialog)return;dialog=document.createElement('dialog');dialog.id='task-guides-dialog';dialog.className='workspace-dialog workflow-dialog';dialog.setAttribute('aria-labelledby','workflow-heading');dialog.innerHTML=`
 <header class="workspace-dialog-heading"><h2 id="workflow-heading" data-i18n>Start a task</h2><button type="button" data-workflow-close aria-label="Close" data-i18n-aria-label>×</button></header>
 <div class="workspace-dialog-body">
  <section data-workflow-intro><p data-i18n>What would you like to achieve? Choose a goal and follow the steps. You can pause the guide while using any tool.</p><div data-workflow-cards class="workflow-cards"></div></section>
  <section data-workflow-guide hidden>
   <div class="workflow-goal-heading"><h3 data-workflow-title></h3><button type="button" data-workflow-change data-i18n>Change goal</button></div>
   <div class="workflow-progress"><progress data-workflow-progress max="5" value="0" aria-label="Completed steps" data-i18n-aria-label></progress><span data-workflow-progress-label></span></div>
   <ol class="workflow-stepper" data-workflow-stepper aria-label="Workflow steps" data-i18n-aria-label></ol>
   <div class="workflow-context"><p><span data-i18n>Study area</span>: <b data-workflow-area data-i18n-ignore></b></p><p><span data-i18n>Input data</span>: <b data-workflow-workset data-i18n-ignore></b></p><p><span data-i18n>Execution</span>: <b data-workflow-execution></b></p></div>
   <article class="workflow-step-panel"><header><h3 data-workflow-step-title tabindex="-1"></h3><span class="workflow-step-status" data-workflow-status role="status"></span></header><p class="workflow-step-description" data-workflow-instruction></p><p class="workflow-step-why" data-workflow-why></p>
    <div data-guide-panel="0"><div class="workflow-actions" data-workflow-area-actions></div></div>
    <div data-guide-panel="1"><div class="workflow-actions" data-workflow-data-actions></div><label data-workflow-layer-wrap><span data-i18n>Analysis workset</span><select data-workflow-layer data-i18n-ignore></select></label><button type="button" data-workflow-use-map data-i18n>Use current map layers</button></div>
    <div data-guide-panel="2"><div data-workflow-record-controls><label><span data-i18n>Records to use</span><select data-workflow-scope><option value="all" data-i18n>All workset records</option><option value="selection" data-i18n>Selected workset records</option><option value="area" data-i18n>Workset records in saved study area</option></select></label><p data-workflow-selected-count></p><label data-workflow-field-wrap><span data-i18n>Height field</span><select data-workflow-field></select></label></div><button type="button" class="primary" data-workflow-run>Calculate summary</button><p data-workflow-height-note data-i18n>Height summaries use positive finite values only; zero, negative sentinels and missing values are counted as unavailable. Original attributes remain unchanged.</p></div>
    <div data-guide-panel="3"><div class="workflow-actions" data-workflow-review-actions></div><label data-workflow-buffer-output><span data-i18n>Buffer result</span><select data-workflow-output data-i18n-ignore></select></label><label class="workflow-review-check"><input type="checkbox" data-workflow-reviewed><span data-i18n>I have reviewed the result and coverage notes</span></label></div>
    <p data-workflow-result-empty></p><div class="workflow-result" data-workflow-result></div><div data-workflow-coverage></div>
    <div data-guide-panel="4"><div class="workflow-actions" data-workflow-save-actions></div><p data-workflow-saved></p><button type="button" data-workflow-finish data-i18n>Finish without saving</button><div class="workflow-finished" data-workflow-finished hidden><strong data-i18n>Workflow complete</strong><p data-i18n>You can return to your tools or choose another goal. Your map and data remain available.</p></div></div>
    <p data-workflow-message role="status"></p><p data-workflow-notice role="status"></p>
   </article><nav class="workflow-navigation" aria-label="Guide navigation" data-i18n-aria-label><button type="button" data-workflow-back data-i18n>Back</button><button type="button" class="primary" data-workflow-next data-i18n>Continue</button></nav>
   <p class="workflow-session-note" data-i18n>Guide progress stays in this tab until you switch Projects or reload. Closing this guide keeps your current step.</p>
  </section>
 </div>`;document.body.append(dialog);
  resume=document.createElement('button');resume.type='button';resume.className='workflow-resume';resume.dataset.workflowResume='';resume.hidden=true;resume.onclick=()=>open();document.body.append(resume);
  $('[data-workflow-close]').onclick=()=>dialog.close();dialog.addEventListener('close',updateResume);
  $('[data-workflow-change]').onclick=()=>{if(busy)return;revision++;session=null;render();};
  $('[data-workflow-run]').onclick=run;
  $('[data-workflow-next]').onclick=()=>{if(!busy&&checks()[session.step]){session.step=Math.min(4,session.step+1);render();$('[data-workflow-step-title]').focus();}};
  $('[data-workflow-back]').onclick=()=>{if(!busy){session.step=Math.max(0,session.step-1);render();$('[data-workflow-step-title]').focus();}};
  $('[data-workflow-layer]').onchange=e=>{const l=root.PortalLayers.layers.get(e.target.value);if(eligible(l))bind(l);else session.layerId=null;render();};
  $('[data-workflow-scope]').onchange=e=>{session.mode=e.target.value;render();};$('[data-workflow-field]').onchange=e=>{session.field=e.target.value;render();};
  $('[data-workflow-use-map]').onclick=()=>{session.displayReviewed=true;render();};$('[data-workflow-reviewed]').onchange=e=>{session.reviewed=e.target.checked;session.finished=false;render();};
  $('[data-workflow-output]').onchange=e=>void chooseBuffer(e.target.value);
  $('[data-workflow-finish]').onclick=()=>{if(checks()[3]){session.finished=true;render();}};
  dialog.addEventListener('click',e=>{const goal=e.target.closest('[data-workflow]'),step=e.target.closest('[data-workflow-step]'),button=e.target.closest('[data-guide-action]');if(goal&&!busy)start(goal.dataset.workflow);if(step&&!busy){session.step=Number(step.dataset.workflowStep);render();$('[data-workflow-step-title]').focus();}if(button)void action(button.dataset.guideAction);});
 }
 function open(intent,options={}){ensure();if(busy)return;syncProject();if(intent&&tasks.some(t=>t[0]===intent))start(intent,{...options,direct:true});else if(!session&&sessions.has(task))session=state();if(session?.handoff==='data'){const l=root.PortalDataWorkspace.current();if(eligible(l))bind(l);}if(session)session.handoff=null;document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==dialog)d.close();});root.PortalDataWorkspace.hide();render();if(!dialog.open)dialog.showModal();updateResume();}
 document.addEventListener('click',e=>{if(e.target.closest('[data-task-guides]'))open();});
 for(const name of ['portal-language-changed','portal-layers-changed','portal-bulk-selection-changed','portal-data-context-changed','portal-tasks-changed','portal-presentation-changed','portal-style-changed','portal-basemap-changed'])document.addEventListener(name,()=>{if(dialog)render();});
 document.addEventListener('portal-project-state-changed',e=>{const changed=projectState.id&&projectState.id!==e.detail.id;projectState=e.detail;if(changed){syncProject();render();}else if(session){if(session.saved&&(e.detail.dirty||e.detail.revision!==session.saved.revision)){session.saved=null;session.finished=false;if(dialog)render();}else if(!e.detail.dirty&&e.detail.revision>session.baseRevision&&checks()[3]&&!session.saved){session.saved={id:e.detail.id,revision:e.detail.revision};if(dialog)render();}}});
 document.addEventListener('portal-map-output-created',e=>{if(task!=='map'||!session||e.detail.action==='preview')return;session.areaChoice=true;session.displayReviewed=true;session.output={key:mapKey(),action:e.detail.action};session.reviewed=false;session.finished=false;session.saved=null;session.baseRevision=root.PortalProjects?.current?.revision||0;session.notice='Map exported. Return to the guide to review it.';render();});
 document.addEventListener('portal-ready',()=>root.portal.map.on('moveend',()=>{if(session&&task==='map')render();}));
 root.PortalTaskGuides={open,coverage,renderCoverage,summarize};
})(globalThis);
