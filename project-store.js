/* Project documents are durable user work, separate from temporary map caches. */
(function (root) {
  'use strict';
  const databaseName = 'usbf-project-library-v1';
  let opening;
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(databaseName) : null;
  function changed(detail, broadcast = true) {
    root.document?.dispatchEvent(new CustomEvent('portal-project-library-changed', { detail }));
    if (broadcast) channel?.postMessage(detail);
  }
  if (channel) channel.onmessage = event => changed(event.data, false);
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(Error('Project storage is unavailable. Export a project file to keep your work.')); return; }
      const request = root.indexedDB.open(databaseName, 1);
      let settled = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('documents', { keyPath: 'id' });
      };
      request.onblocked = () => { settled = true; reject(Error('Close other USBF tabs and try opening the project library again.')); };
      request.onerror = () => { settled = true; reject(Error('Project storage is unavailable. Export a project file to keep your work.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    }).catch(error => { opening = null; throw error; });
    return opening;
  }
  async function list() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly'), request = tx.objectStore('projects').getAll();
      tx.oncomplete = () => resolve(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      tx.onabort = tx.onerror = () => reject(tx.error || Error('The project library could not be read.'));
    });
  }
  async function get(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'documents'], 'readonly');
      const metadata = tx.objectStore('projects').get(id), document = tx.objectStore('documents').get(id);
      tx.oncomplete = () => {
        if (!metadata.result || !document.result) reject(Error('This saved project no longer exists.'));
        else resolve({ ...metadata.result, json: document.result.json });
      };
      tx.onabort = tx.onerror = () => reject(tx.error || Error('The saved project could not be read.'));
    });
  }
  function conflict() { const error = Error('This project changed in another tab. Reopen it or save a copy.'); error.code = 'PROJECT_CONFLICT'; return error; }
  async function put(metadata, json, expectedRevision = 0) {
    if (typeof json !== 'string') throw Error('This project is invalid or too large to save.');
    const bytes = new Blob([json]).size;
    if (!metadata || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(metadata.id) || typeof metadata.name !== 'string' || !metadata.name.trim() || metadata.name.length > 120 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || bytes > root.PortalProjectCore.limits.file) throw Error('This project is invalid or too large to save.');
    const document = JSON.parse(json);
    if (document.projectInfo?.id !== metadata.id || document.projectInfo.revision !== expectedRevision + 1 || document.name !== metadata.name) throw Error('This project is invalid or too large to save.');
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'documents'], 'readwrite'), projects = tx.objectStore('projects');
      let error, result;
      const request = projects.get(metadata.id);
      request.onsuccess = () => {
        const previous = request.result;
        if ((previous?.revision || 0) !== expectedRevision) { error = conflict(); tx.abort(); return; }
        result = { id: metadata.id, name: metadata.name, createdAt: previous?.createdAt || metadata.createdAt, updatedAt: metadata.updatedAt, revision: expectedRevision + 1, bytes, layers: metadata.layers, models: metadata.models };
        projects.put(result);
        tx.objectStore('documents').put({ id: metadata.id, json });
      };
      tx.oncomplete = () => { changed({ action: 'save', id: result.id, revision: result.revision }); resolve(result); };
      tx.onabort = () => reject(error || (tx.error?.name === 'QuotaExceededError' ? Error('Browser storage is full. Export a project file or delete an older saved project.') : tx.error || Error('The project could not be saved.')));
    });
  }
  async function remove(id, expectedRevision) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'documents'], 'readwrite'), projects = tx.objectStore('projects');
      let error;
      const request = projects.get(id);
      request.onsuccess = () => {
        if (!request.result || request.result.revision !== expectedRevision) { error = conflict(); tx.abort(); return; }
        projects.delete(id); tx.objectStore('documents').delete(id);
      };
      tx.oncomplete = () => { changed({ action: 'delete', id }); resolve(true); };
      tx.onabort = () => reject(error || tx.error || Error('The saved project could not be deleted.'));
    });
  }
  root.PortalProjectStore = { list, get, put, remove };
})(globalThis);
