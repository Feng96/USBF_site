/* Local project identity, revisions and workflow. Portable files remain the sharing boundary. */
(function (root) {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const identity = (name = 'Untitled project', origin) => ({ id: crypto.randomUUID(), name, revision: 0, createdAt: new Date().toISOString(), ...(origin ? { origin } : {}) });
  let active = identity(), baseline = '', ready = false, dirty = false, busy = false, switching = false, timer, muted = 0, dialog, library = [], libraryGeneration = 0, confirmation;
  const objects = new WeakMap(); let objectSequence = 0;
  const objectID = value => { if (!objects.has(value)) objects.set(value, ++objectSequence); return objects.get(value); };
  function releaseIdentity(layer) {
    if(layer.cfg.driver!=='usbf'&&layer.cfg.id!=='usbf-live')return null;
    const release=layer.renderTiled?layer.displayRelease:layer.release;
    return release?{name:release.name,updated:release.updated,buildings:release.buildings,tiles:release.tiles,archiveSha256:layer.renderTiled?layer.usbfConnection?.display?.sha256||null:null}:null;
  }
  function signature(name = active.name) {
    if (!root.portal?.ready) return '';
    const map = portal.map, center = map.getCenter(), round = value => Number(value.toFixed(7));
    return JSON.stringify({ name, camera: [center.lng, center.lat, map.getZoom(), map.getPitch(), map.getBearing()].map(round), basemap: portal.getBasemap(), customBasemap: root.PortalBasemaps?.current().config || null, basemapFile: root.PortalBasemaps?.current().file ? objectID(PortalBasemaps.current().file) : null, interface: root.PortalInterface?.getState() || null, view3d: portal.view3d, crs: PortalCRS.get(),
      active: PortalLayers.active?.id || null,
      layers: Array.from(PortalLayers.layers.values(), l => ({ id: l.id, name: l.cfg.name, visible: l.visible, color: l.color, opacity: l.opacity, mode: l.colorMode, filter: l.sourceFilter || '', area: l.minArea || 0, height: l.heightField || null, metric:l.colorField?[l.colorField,l.colorStops,l.colorUnit]:null, releaseRef:l.cfg.releaseRef||null,sourceRelease:releaseIdentity(l),data: l.cfg.type === 'geojson' ? objectID(l.data) : null, dataScope: l.cfg.type === 'geojson' ? [l.data?.provenance?.workspaceArea?.active||false,l.data?.provenance?.workspaceActiveWorkset||false] : null })),
      models: root.PortalLocalModels?.serializeModelEntries() || [],
      research: root.PortalModels?.enabled && PortalModels.current ? { id: PortalModels.current.id, method: PortalModels.method, edges: $('#model-edges').checked, roof: $('#model-roof-only').checked, visible: $('#model-visible').checked } : null,
      legend: document.body.classList.contains('legend-visible'), layout: PortalComposer.projectOptions(), dataPolicy: root.PortalProject?.getDataPolicy?.() || 'latest'
    });
  }
  function update() {
    if (!ready || muted) return;
    dirty = signature() !== baseline;
    const label = $('#workspace-document'); if (label) { label.textContent = active.name; label.title = active.name; }
    for (const el of document.querySelectorAll('[data-project-status]')) el.textContent = busy ? 'Working…' : dirty ? 'Unsaved changes' : active.revision ? 'Saved in this browser' : 'New project';
    $('#project-state-dot')?.classList.toggle('is-dirty', dirty);
    if ($('#project-current-revision')) $('#project-current-revision').textContent = active.revision ? 'Revision ' + active.revision : 'Not saved yet';
    document.dispatchEvent(new CustomEvent('portal-project-state-changed', { detail: { id: active.id, dirty, revision: active.revision } }));
  }
  function schedule() { if (muted) return; clearTimeout(timer); timer = setTimeout(update, 80); }
  function setBusy(value) {
    busy = value;
    dialog?.querySelectorAll('button,input').forEach(el => { el.disabled = value; });
    update();
  }
  function message(text, error = false) {
    const el = $('#project-message');
    if (el) { el.textContent = text; el.classList.toggle('composer-error', error); }
    else if (text) portal.toast(text);
  }
  function saveFile(name, json) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = (name.replace(/[^\p{L}\p{N}_.-]+/gu, '-') || 'building-project') + '.usbf.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function info(project = active, revision = project.revision) {
    return { id: project.id, revision, createdAt: project.createdAt, ...(project.origin ? { origin: copy(project.origin) } : {}) };
  }
  async function capture(project = active, revision = project.revision, draft = false) {
    const result = await PortalProject.collect(project.name);
    result.project.projectInfo = { ...info(project, revision), draft };
    PortalProjectCore.validate(result.project, { validateVector: PortalLayers.validateGeoJSON });
    result.json = JSON.stringify(result.project);
    if (new Blob([result.json]).size > PortalProjectCore.limits.file) throw Error('This map is too large. Save fewer layers or a smaller area.');
    return result;
  }
  async function saveCurrent(asCopy = false) {
    if (root.PortalReadOnlyMode || busy || !ready) return false;
    const next = asCopy ? identity((active.name + ' copy').slice(0, 120), { id: active.id, revision: active.revision }) : { ...active };
    const before = signature(next.name);
    setBusy(true); message('Saving project…');
    try {
      const result = await capture(next, next.revision + 1), p = result.project;
      const metadata = await PortalProjectStore.put({ ...next, updatedAt: p.savedAt, layers: p.layers.length, models: p.models.length }, result.json, next.revision);
      active = { ...next, revision: metadata.revision }; baseline = before;
      if ($('#project-name')) $('#project-name').value = active.name;
      if (root.PortalLocalFiles?.status().connected) {
        try { const saved = await PortalLocalFiles.saveProject({ id: active.id, name: active.name, json: result.json });message('Project saved in this browser and Projects folder.'); }
        catch (error) { message('Browser copy saved. Folder copy failed: ' + error.message, true); }
      } else message('Project saved in this browser. Connect a workspace folder to save project files there too.');
      await renderLibrary(); return metadata;
    } catch (error) { message(error.message, true); return false; }
    finally { setBusy(false); }
  }
  async function saveToFolder() {
    if (root.PortalReadOnlyMode || busy || !ready) return false;
    setBusy(true); message('Saving project file to Projects folder…');
    try { update(); const result = await capture(active, active.revision, dirty || active.revision === 0);
      const saved = await PortalLocalFiles.saveProject({ id: active.id, name: active.name, json: result.json, snapshot: true });
      message('Project file saved to ' + saved.path.join('/') + '. Browser project revision is unchanged.');return saved;
    } catch (error) { message(error.message, true); throw error; } finally { setBusy(false); }
  }
  async function exportCurrent() {
    if (root.PortalReadOnlyMode || busy || !ready) return false;
    setBusy(true); message('Preparing project file…');
    try { update(); const result = await capture(active, active.revision, dirty || active.revision === 0); saveFile(active.name, result.json); message('Project file downloaded. Send it to a teammate to open the same map.');document.dispatchEvent(new CustomEvent('portal-workflow-output',{detail:{kind:'project-file',phase:'downloaded',projectId:result.project.projectInfo?.id||active.id,revision:result.project.projectInfo?.revision||active.revision,name:active.name,project:result.project}})); return result; }
    catch (error) { message(error.message, true); return false; }
    finally { setBusy(false); }
  }
  function ask(title, body, choices) {
    if (confirmation) return Promise.resolve('cancel');
    const d = document.createElement('dialog'); d.id = 'project-confirm-dialog'; d.className = 'workspace-dialog project-confirm-dialog'; d.setAttribute('aria-labelledby', 'project-confirm-title');
    d.innerHTML = '<div class="workspace-dialog-heading"><h2 id="project-confirm-title" data-i18n>' + esc(title) + '</h2></div><div class="workspace-dialog-body"><p data-i18n>' + esc(body) + '</p><div class="project-actions">' + choices.map(([key, label]) => '<button type="button" data-project-answer="' + key + '"' + (key === 'save' ? ' class="primary"' : '') + ' data-i18n>' + esc(label) + '</button>').join('') + '</div></div>';
    document.body.append(d); confirmation = d;
    return new Promise(resolve => {
      const finish = value => { d.close(); d.remove(); confirmation = null; resolve(value); };
      d.onclick = event => { const button = event.target.closest('[data-project-answer]'); if (button) finish(button.dataset.projectAnswer); };
      d.oncancel = event => { event.preventDefault(); finish('cancel'); };
      d.showModal();
    });
  }
  async function guard() {
    update(); if (!dirty) return true;
    const result = await ask('Unsaved project changes', 'Save your current project before replacing this map?', [['save', 'Save and continue'], ['discard', 'Discard changes'], ['cancel', 'Cancel']]);
    if (result === 'save') return !!(await saveCurrent());
    return result === 'discard';
  }
  async function loadPrepared(prepared, next) {
    setBusy(true); muted++;
    try {
      const result = await PortalProject.restore(prepared);
      active = next; baseline = signature();
      if ($('#project-name')) $('#project-name').value = active.name;
      message(result.dependencies?.some(d=>!d.available)?'Project opened. Some native files are unavailable; saved previews remain display-only.':'Project opened. Pinned sources retain their saved release; latest sources reconnect explicitly.');
      return result;
    } finally { muted--; setBusy(false); }
  }
  async function openSaved(id) {
    if (root.PortalReadOnlyMode || busy || switching || !ready) return false;
    switching = true; setBusy(true);
    try {
      // Validate every record and asset before asking to replace current work.
      const record = await PortalProjectStore.get(id), prepared = await PortalProject.prepare(JSON.parse(record.json));
      setBusy(false);
      if (!(await guard())) return false;
      await loadPrepared(prepared, { id: record.id, name: record.name, revision: record.revision, createdAt: record.createdAt, ...(prepared.project.projectInfo?.origin ? { origin: prepared.project.projectInfo.origin } : {}) });
      return true;
    } catch (error) { message(error.message, true); return false; }
    finally { switching = false; if (busy) setBusy(false); }
  }
  async function openFile(file) {
    if (root.PortalReadOnlyMode || busy || switching || !file || !ready) return false;
    switching = true; setBusy(true);
    try {
      if (file.size > PortalProjectCore.limits.file) throw Error('Choose a saved map smaller than 80 MB.');
      const prepared = await PortalProject.prepare(JSON.parse(await file.text()));
      setBusy(false);
      if (!(await guard())) return false;
      const p = prepared.project;
      await loadPrepared(prepared, identity(p.name, p.projectInfo ? { id: p.projectInfo.id, revision: p.projectInfo.revision } : undefined));
      // An imported file is a separate local project until explicitly saved.
      baseline = ''; update();
      message(prepared.dependencies?.some(d=>!d.available)?'Project file opened as a separate copy. Some native files are unavailable; saved previews remain display-only.':'Project file opened as a separate copy. Save it to keep it in this browser.');
      return true;
    } catch (error) { message(error instanceof SyntaxError ? 'This file is not a valid USBF map. Choose a .usbf.json file.' : error.message, true); return false; }
    finally { switching = false; if (busy) setBusy(false); if ($('#project-file')) $('#project-file').value = ''; }
  }
  async function newProject() {
    if (busy || !ready || !(await guard())) return false;
    setBusy(true); muted++;
    try {
      document.querySelectorAll('dialog[open]').forEach(d => { if (d !== dialog) d.close(); });
      portal.cancelPlaceSearch?.(); PortalLayers.invalidatePending();
      root.PortalImport?.cancelPending?.(); root.PortalLocalModels?.cancelPending?.(); root.PortalLoD1?.cancel?.({ clear: true });
      await root.PortalAnalysis?.cancel({ clear: true }); root.PortalDraw?.cancel(); root.PortalExplorer?.clearLocation();
      PortalLayers.clear(); root.PortalLocalModels?.clear(); root.PortalModels?.clearCache({ reset: true });
      PortalProject.forget(); PortalProject.setPresentation(null);
      portal.resetWorkspace(); PortalCRS.set('EPSG:4326'); portal.setBasemap('light'); portal.setViewMode(false, false);
      portal.map.jumpTo({ center: [-98.5, 39.5], zoom: 3.8, pitch: 0, bearing: 0 });
      $('#map-place-name').textContent = 'United States'; active = identity();
      if ($('#project-name')) $('#project-name').value = active.name;
      portal.saveView(); baseline = signature();
      message('New blank project ready. Your saved projects are kept.');
      return true;
    } catch (error) { message(error.message, true); return false; }
    finally { muted--; setBusy(false); }
  }
  function clearCache() {
    if (!ready || busy) return false;
    for (const layer of PortalLayers.layers.values()) layer.clearCache?.();
    root.PortalModels?.clearCache();
    message('Temporary map cache cleared. Current work and saved projects are kept.');
    portal.toast('Temporary map cache cleared. Current work and saved projects are kept.');
    return true;
  }
  async function deleteSaved(id) {
    if (busy) return;
    const record = library.find(row => row.id === id); if (!record) return;
    const answer = await ask('Delete saved project?', 'This removes the saved copy from this browser. The open map and downloaded files are kept.', [['delete', 'Delete saved copy'], ['cancel', 'Cancel']]);
    if (answer !== 'delete') return;
    setBusy(true);
    try {
      await PortalProjectStore.remove(id, record.revision);
      if (active.id === id) { active = identity(active.name, { id, revision: record.revision }); baseline = ''; }
      await renderLibrary(); message('Saved copy deleted.');
    } catch (error) { message(error.message, true); }
    finally { setBusy(false); }
  }
  async function renderLibrary() {
    if (!dialog) return;
    const generation = ++libraryGeneration, list = $('#project-library-list');
    try {
      const rows = await PortalProjectStore.list(); if (generation !== libraryGeneration) return;
      library = rows;
      list.innerHTML = rows.length ? rows.map(row => '<article class="project-card"><div><strong data-i18n-ignore>' + esc(row.name) + '</strong><p><time>' + esc(new Date(row.updatedAt).toLocaleString()) + '</time><span data-i18n-system>Revision ' + row.revision + '</span><span>' + (row.bytes < 1048576 ? (row.bytes / 1024).toFixed(1) + ' KB' : (row.bytes / 1048576).toFixed(2) + ' MB') + '</span></p></div><div class="project-card-actions"><button type="button" data-project-load="' + row.id + '" data-i18n>Open</button><button type="button" data-project-download="' + row.id + '" data-i18n>Export file</button><button type="button" data-project-delete="' + row.id + '" data-i18n>Delete</button></div></article>').join('') : '<p class="project-empty" data-i18n>No saved projects yet. Save your first project above.</p>';
    } catch (error) { list.textContent = error.message; list.setAttribute('data-i18n-system', ''); }
  }
  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog'); dialog.id = 'map-project-dialog'; dialog.className = 'workspace-dialog project-dialog'; dialog.setAttribute('aria-labelledby', 'map-project-title');
    dialog.innerHTML = `<div class="workspace-dialog-heading"><div><h2 id="map-project-title" data-i18n>Projects</h2><p class="project-subheading" data-project-status data-i18n-system></p></div><button type="button" data-close-project aria-label="Close saved maps" data-i18n-aria-label>×</button></div>
      <div class="workspace-dialog-body"><div class="project-current-heading"><h3 data-i18n>Current project</h3><span id="project-current-revision" data-i18n-system></span><button type="button" id="project-new" data-i18n>New project</button></div>
      <form id="project-save-form" class="workspace-form"><label data-i18n>Project name<input id="project-name" maxlength="120" required></label><label><span data-i18n>Online data policy</span><select id="project-data-policy"><option value="pinned" data-i18n>Keep this data version</option><option value="latest" data-i18n>Follow latest sources</option></select></label><div class="project-actions"><button class="primary" id="project-save-button" type="submit" data-i18n>Save project</button><button type="button" id="project-save-copy" data-i18n>Save a copy</button><button type="button" id="project-export-button" data-i18n>Export for sharing</button></div></form>
      <p class="project-note" data-i18n>A saved version verifies its original checksums. Remote source files may become unavailable; package local results to keep a portable copy.</p><p class="project-note" data-i18n>Save keeps a browser backup and also writes to Projects when a workspace folder is connected.</p><p id="project-folder-note" class="project-note" data-i18n-system></p><div class="project-actions"><button type="button" id="project-save-folder" data-i18n>Save project file to folder</button><button type="button" data-device-settings data-device-tab="files" data-i18n>Manage local files</button></div><p class="project-note" data-i18n>Team cloud sync is not connected. Opening a shared file creates a separate project copy.</p>
      <div class="project-actions"><button type="button" data-project-dependencies data-i18n>Project dependencies</button></div><p class="project-note" data-i18n>Package full native results or verify and relink a missing file when moving to another computer.</p>
      <div class="project-open-label"><strong data-i18n>Open project file</strong><input id="project-file" type="file" hidden accept=".usbf.json,.json,application/json"><button type="button" id="project-file-picker" data-i18n>Choose a file</button></div><p class="project-note" data-i18n>Layers, styles, view, drawings, models and map layout are included. Supported sources use the saved pinned or latest policy. Native previews require their original workspace for full analysis.</p>
      <p id="project-message" role="status" aria-live="polite" data-i18n-system></p><hr><div class="project-library-heading"><h3 data-i18n>Saved projects in this browser</h3><button type="button" id="project-library-refresh" data-i18n>Refresh</button></div><div id="project-library-list" class="project-library-list"></div><hr>
      <div class="project-actions"><button type="button" id="project-clear-cache" data-i18n>Clear cache</button></div><p class="project-note" data-i18n>Clear cache keeps your current work and saved projects. New project starts with an empty map.</p></div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close-project]').onclick = () => dialog.close();
    $('#project-data-policy').onchange=event=>PortalProject.setDataPolicy(event.target.value);
    $('#project-name').oninput = event => { active.name = event.target.value.trim().slice(0, 120) || 'Untitled project'; schedule(); };
    $('#project-save-form').onsubmit = event => { event.preventDefault(); saveCurrent(); };
    $('#project-save-copy').onclick = () => saveCurrent(true);
    $('#project-export-button').onclick = exportCurrent;
    $('#project-file-picker').onclick = () => $('#project-file').click();
    $('#project-file').onchange = event => openFile(event.target.files[0]);
    $('#project-save-folder').onclick = () => saveToFolder().catch(() => {});$('#project-new').onclick = newProject; $('#project-clear-cache').onclick = clearCache;
    $('#project-library-refresh').onclick = renderLibrary;
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('click', async event => {
      const button = event.target.closest('[data-project-load],[data-project-download],[data-project-delete]'); if (!button || busy) return;
      if (button.dataset.projectLoad) await openSaved(button.dataset.projectLoad);
      else if (button.dataset.projectDelete) await deleteSaved(button.dataset.projectDelete);
      else { try { const record = await PortalProjectStore.get(button.dataset.projectDownload); saveFile(record.name, record.json); } catch (error) { message(error.message, true); } }
    });
    return dialog;
  }
  function open() { if (!ready) return; ensureDialog();const folder=root.PortalLocalFiles?.status();$('#project-folder-note').textContent=folder?.connected?folder.rootName+'/Projects':'No workspace folder connected. Choose one in Files & device.';$('#project-save-folder').disabled=!folder?.connected; $('#project-name').value = active.name;$('#project-data-policy').value=PortalProject.getDataPolicy(); update(); renderLibrary(); if (!dialog.open) dialog.showModal(); }
  function init() {
    if (root.PortalReadOnlyMode || ready || !root.portal?.ready) return;
    ready = true; baseline = signature(); update();
    portal.map.on('moveend', schedule);
    for (const name of ['portal-layers-changed', 'portal-style-changed', 'portal-models-changed', 'portal-crs-changed', 'portal-presentation-changed','portal-basemap-changed','portal-interface-changed','portal-release-changed']) document.addEventListener(name, schedule);
    document.addEventListener('click', event => { if (event.target.closest('[data-action=legend],.legend-title')) schedule(); if (event.target.closest('[data-clear-cache]')) { document.querySelectorAll('details.tools-menu[open]').forEach(el => { el.open = false; }); clearCache(); } });
    document.addEventListener('portal-project-library-changed', event => { if (dialog?.open) renderLibrary(); if (event.detail?.id === active.id && event.detail.revision > active.revision && !busy) message('This project changed in another tab. Reopen it or save a copy.', true); });
    window.addEventListener('beforeunload', event => { update(); if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || confirmation || document.querySelector('dialog[open]:not(#map-project-dialog)')) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrent(event.shiftKey); }
      else if (event.key.toLowerCase() === 'o') { event.preventDefault(); open(); }
    });
    const serviceBusy = Object.getOwnPropertyDescriptor(PortalProject, 'busy').get;
    Object.defineProperty(PortalProject, 'busy', { get: () => busy || serviceBusy() });
    Object.assign(PortalProject, { save: saveCurrent, openFile, saveLocal: saveCurrent, exportFile: exportCurrent, saveToFolder, newProject, openSaved, importFile: openFile, clearCache });
  }
  root.PortalProjects = { open, save: saveCurrent, exportFile: exportCurrent, saveToFolder, newProject, openSaved, openFile, clearCache, refresh: update, get current() { return { ...active }; }, get dirty() { update(); return dirty; }, get busy() { return busy; } };
  document.addEventListener('portal-ready', init); init();
})(globalThis);
