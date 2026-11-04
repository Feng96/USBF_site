/* Full native dependency transport is streamed by the paired desktop service. */
(function(root){
 'use strict';
 if(root.PortalReadOnlyMode)return;
 const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ui=s=>root.PortalI18n?.t(s)||s;
 let dialog,busy=false,controller,statusState={text:'',error:false,detail:''};
 function supported(){return root.PortalNativeEngine?.status().information?.capabilities?.projectPackages===true;}
 function message(text,error=false,detail=''){statusState={text,error,detail};const el=$('[data-package-status]');if(el){el.textContent=ui(text)+detail;el.classList.toggle('composer-error',error);}}
 function controls(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);$('[data-package-cancel]').hidden=!value;$('[data-package-cancel]').disabled=false;}
 async function run(fn){if(busy)return;controls(true);controller=new AbortController();try{return await fn(controller.signal);}catch(e){message(e.message,true);return false;}finally{controller=null;controls(false);}}
 async function waitJobs(jobs,signal){
  const results=new Map();
  while(results.size<new Set(jobs.map(j=>j.jobId)).size){
   if(signal.aborted)throw new DOMException('Cancelled. Imported files and task history are kept.','AbortError');
   for(const {jobId} of jobs){if(results.has(jobId))continue;const job=await root.PortalNativeEngine.job(jobId,{signal});if(['failed','partial','cancelled','interrupted'].includes(job.status))throw Error(job.error||'Dependency restoration did not complete. Review it in Task center.');if(job.status==='completed')results.set(jobId,job);}
   message('Restoring full dependencies…',false,' '+results.size+' / '+new Set(jobs.map(j=>j.jobId)).size);
   if(results.size<new Set(jobs.map(j=>j.jobId)).size)await new Promise(resolve=>setTimeout(resolve,500));
  }
  return results;
 }
 function ref(job){const s=root.PortalNativeEngine.status().information;return {version:1,workspaceId:s.workspace?.id||s.workspaceId,path:job.result.path,jobId:job.id,format:'GeoParquet',recordCount:job.result.rows,sha256:job.result.sha256,release:job.release||null};}
 async function exportFull(){return run(async()=>{
  if(!supported())throw Error('Update and pair the local engine to use Project packages.');
  message('Packaging complete native results…');
  const snapshot=await root.PortalProject.collect(root.PortalProjects.current.name),value=await root.PortalNativeEngine.projectExport(snapshot.project);
  message('Project package saved in Results/Packages.',false,' '+value.path);
  $('[data-package-download]').hidden=false;$('[data-package-download]').dataset.path=value.path;await renderDependencies();return value;
 });}
 async function importFull(){return run(async signal=>{
  if(!supported())throw Error('Update and pair the local engine to use Project packages.');
  const path=$('[data-package-path]').value.trim();if(!path.startsWith('Files/'))throw Error('Copy the package into Files, then choose its relative path.');
  message('Verifying package checksums…');const result=await root.PortalNativeEngine.projectImport(path);
  const jobs=await waitJobs(result.jobs,signal);
  for(const item of result.jobs){const layer=result.project.layers.find(l=>l.key===item.layerKey),job=jobs.get(item.jobId);if(item.recordCount!==undefined&&item.recordCount!==job.result.rows)throw Error('Restored dependency record count does not match the package.');layer.meta.nativeSource=ref(job);const preview=await root.PortalNativeEngine.preview(job.id);layer.data=preview;}
  // Existing Project validation and unsaved-change guard still apply.
  controls(false);dialog.close();const opened=await root.PortalProjects.openFile(new File([JSON.stringify(result.project)],'restored.usbf.json',{type:'application/json'}));
  if(!opened){open();message('Verified dependencies remain in Files and Results. Your current map was kept.');}return opened;
 });}
 async function relink(layer,path){return run(async signal=>{
  const old=layer.cfg.nativeSource;if(!old.sha256)throw Error('This older dependency has no saved SHA256. Reopen its original workspace and save the Project again.');
  const task=await root.PortalNativeEngine.projectRelink({path,sha256:old.sha256,release:old.release});const jobs=await waitJobs([{jobId:task.jobId}],signal),job=jobs.get(task.jobId);
  if(root.PortalLayers.layers.get(layer.id)!==layer)throw Error('The layer changed while relinking. The restored file remains in Results.');
  if(job.result.rows!==old.recordCount)throw Error('The relinked record count does not match this Project.');
  layer.cfg.nativeSource=ref(job);layer.data=await root.PortalNativeEngine.preview(job.id);layer.cfg.data=layer.data;root.PortalNativeResults?.detach?.(layer);layer.setData?.(layer.data);
  root.PortalLayers.refresh();document.dispatchEvent(new CustomEvent('portal-layers-changed'));document.dispatchEvent(new CustomEvent('portal-presentation-changed'));await renderDependencies();message('Dependency verified and relinked. Save the Project to keep this location.');return true;
 });}
 async function renderDependencies(){
  const rows=Array.from(root.PortalLayers?.layers.values()||[]).filter(l=>l.cfg.nativeSource),el=$('[data-package-dependencies]');
  el.replaceChildren();
  if(!rows.length){el.textContent=ui('No native dependencies in this map.');return;}
  for(const layer of rows){const row=document.createElement('article');row.className='project-dependency';const source=layer.cfg.nativeSource;row.innerHTML='<strong data-i18n-ignore>'+esc(layer.cfg.name)+'</strong><p data-i18n-ignore>'+esc(source.path)+'</p><p data-dependency-state></p><label><span data-i18n>Matching file in this workspace</span><input placeholder="Files/result.parquet" value="'+esc(source.path)+'" aria-label="Matching file in this workspace" data-i18n-aria-label></label><button data-i18n>Verify and relink</button>';row.querySelector('button').onclick=()=>relink(layer,row.querySelector('input').value.trim());el.append(row);const info=await root.PortalNativeEngine.fileInfo(source);row.querySelector('[data-dependency-state]').textContent=ui(info.available?'Dependency available and verified':info.reason||'Dependency unavailable');}
 }
 async function browse(){try{const path=$('[data-package-folder]').value.trim()||'Files',value=await root.PortalNativeEngine.files(path),el=$('[data-package-files]');el.replaceChildren();for(const entry of value.entries){if(entry.kind!=='directory'&&!entry.name.endsWith('.usbf.zip'))continue;const button=document.createElement('button');button.type='button';button.textContent=(entry.kind==='directory'?'▸ ':'')+entry.name;button.setAttribute('data-i18n-ignore','');button.onclick=()=>{if(entry.kind==='directory'){$('[data-package-folder]').value=entry.path;browse();}else $('[data-package-path]').value=entry.path;};el.append(button);}if(value.limited)message('Folder listing is limited to 500 entries. Open a subfolder.');}catch(e){message(e.message,true);}}
 function ensure(){if(dialog)return;dialog=document.createElement('dialog');dialog.id='project-packages-dialog';dialog.className='workspace-dialog project-dialog';dialog.innerHTML='<header class="workspace-dialog-heading"><h2 data-i18n>Project dependencies</h2><button data-package-close aria-label="Close" data-i18n-aria-label>×</button></header><div class="workspace-dialog-body"><p data-i18n>Project packages include complete local results, original attributes and embedded map assets. Public datasets, basemaps and the online renderer remain separate internet dependencies.</p><p data-i18n>Files stay on your computer. Nothing is uploaded.</p><button class="primary" data-package-export data-i18n>Package Project with full results</button><button data-package-download hidden data-i18n>Download package</button><hr><h3 data-i18n>Restore on this computer</h3><p data-i18n>Copy a .usbf.zip package into the local Files folder. Its SHA256 values are verified before any dependency is restored.</p><label><span data-i18n>Package folder</span><input data-package-folder value="Files"></label><button data-package-browse data-i18n>Browse packages</button><div data-package-files class="project-package-files"></div><label><span data-i18n>Package path</span><input data-package-path placeholder="Files/project.usbf.zip"></label><button data-package-import data-i18n>Verify and restore package</button><hr><h3 data-i18n>Current map dependencies</h3><div data-package-dependencies></div><p data-package-status role="status"></p><button data-package-cancel hidden data-i18n>Stop waiting</button></div>';document.body.append(dialog);$('[data-package-close]').onclick=()=>dialog.close();$('[data-package-export]').onclick=exportFull;$('[data-package-import]').onclick=importFull;$('[data-package-browse]').onclick=browse;$('[data-package-download]').onclick=()=>root.PortalNativeEngine.projectPackageDownload($('[data-package-download]').dataset.path).catch(e=>message(e.message,true));$('[data-package-cancel]').onclick=()=>controller?.abort();dialog.oncancel=e=>{if(busy)e.preventDefault();};}
 function open(){ensure();document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==dialog)d.close();});if(!dialog.open)dialog.showModal();message(supported()?'':'Update and pair the local engine to use Project packages.',!supported());renderDependencies().catch(e=>message(e.message,true));}
 document.addEventListener('click',e=>{if(e.target.closest('[data-project-dependencies]'))open();});
 document.addEventListener('portal-language-changed',()=>{if(dialog?.open){message(statusState.text,statusState.error,statusState.detail);renderDependencies().catch(()=>{});}});
 root.PortalProjectPackages={open,exportFull,importFull,relink,supported};
})(globalThis);
