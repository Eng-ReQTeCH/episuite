const snapshotKey = 'episuite.snapshot';
const legacyQueueKey = 'episuite.captureQueue';
let database;

function openDatabase() {
  database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('episuite-device', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('captures', { keyPath: ['workspace', 'id'] });
      request.result.createObjectStore('experiments', { keyPath: ['workspace', 'id'] });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
    request.onerror = () => { database = undefined; reject(request.error); };
  });
  return database;
}

async function useStore(name, mode, operate) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const result = operate(transaction.objectStore(name));
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function loadSnapshot() {
  try { return JSON.parse(localStorage.getItem(snapshotKey)); }
  catch { return null; }
}

export function saveSnapshot(state) {
  try {
    localStorage.setItem(snapshotKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export async function pendingCaptures(workspace) {
  const legacy = localStorage.getItem(legacyQueueKey);
  if (legacy && (!loadSnapshot() || loadSnapshot()?.workspaceId === workspace)) {
    let notes = [];
    try { notes = JSON.parse(legacy); } catch {}
    if (Array.isArray(notes)) await useStore('captures', 'readwrite', store => {
      for (const note of notes) {
        if (typeof note?.id === 'string' && typeof note.text === 'string') store.put({ ...note, workspace });
      }
    });
    if (localStorage.getItem(legacyQueueKey) === legacy) localStorage.removeItem(legacyQueueKey);
  }
  return useStore('captures', 'readonly', store => store.getAll(workspaceRange(workspace)));
}

export function enqueueCapture(workspace, note) {
  return useStore('captures', 'readwrite', store => store.put({ ...note, workspace }));
}

export function acknowledgeCapture(workspace, id) {
  return useStore('captures', 'readwrite', store => store.delete([workspace, id]));
}

const workspaceRange = workspace => IDBKeyRange.bound([workspace], [workspace, []], false, true);
const retention = 30 * 86400000;

export async function experimentRecords(workspace) {
  const entries = await useStore('experiments', 'readonly', store => store.getAll(workspaceRange(workspace)));
  const cutoff = Date.now() - retention;
  const expired = entries.filter(entry => entry.at < cutoff);
  if (expired.length) await useStore('experiments', 'readwrite', store => {
    for (const entry of expired) store.delete([workspace, entry.id]);
  });
  return entries.filter(entry => entry.at >= cutoff).sort((a, b) => b.at - a.at);
}

export function saveExperiment(workspace, id, { kind, condition, outcome, friction }) {
  return useStore('experiments', 'readwrite', store => store.put({
    workspace, id, at: Date.now(), kind, condition, outcome, friction
  }));
}

export function clearExperiments(workspace) {
  return useStore('experiments', 'readwrite', store => store.delete(workspaceRange(workspace)));
}
