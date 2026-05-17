import { STORAGE_KEYS } from '../constants.js';
import { readJson, writeJson, slimRowForStorage } from '../state.js';

const DB_NAME = 'd2aa-clean-cache';
const DB_VERSION = 1;
const STORE = 'keyval';
const IDB_ROWS_KEY = 'bungieRows';
const IDB_META_KEY = 'bungieMeta';
const RECENT_WINDOW_MS = 10 * 60 * 1000;

export async function getCachedBungieInventory() {
  const idbRows = await idbGet(IDB_ROWS_KEY).catch(() => null);
  const idbMeta = await idbGet(IDB_META_KEY).catch(() => null);
  if (Array.isArray(idbRows) && idbRows.length) return { rows: idbRows, meta: idbMeta, hasRows: true };

  const rows = readJson(STORAGE_KEYS.bungieRows, []);
  const meta = readJson(STORAGE_KEYS.bungieMeta, null);
  if (Array.isArray(rows) && rows.length) {
    await idbSet(IDB_ROWS_KEY, rows).catch(() => {});
    await idbSet(IDB_META_KEY, meta).catch(() => {});
    try { localStorage.removeItem(STORAGE_KEYS.bungieRows); } catch (_) {}
  }
  return { rows: Array.isArray(rows) ? rows : [], meta, hasRows: Array.isArray(rows) && rows.length > 0 };
}

export async function saveBungieInventory(rows, reason = 'sync') {
  const previous = (await getCachedBungieInventory()).rows;
  const previousById = new Map(previous.map((row) => [String(row.Id), row]));
  const hasPrevious = previousById.size > 0;
  const savedAt = new Date().toISOString();
  const discoveredBase = Date.now();
  const cleanRows = rows.map((row, index) => markRecentChange({ ...row, Source: 'Bungie', FromCache: false }, previousById, savedAt, hasPrevious, discoveredBase + index));
  const slimRows = cleanRows.map(slimRowForStorage);
  const changes = summarizeChanges(slimRows);
  const meta = { savedAt, count: slimRows.length, reason, version: 6, store: 'indexeddb', ...changes };
  try {
    await idbSet(IDB_ROWS_KEY, slimRows);
    await idbSet(IDB_META_KEY, meta);
    localStorage.removeItem(STORAGE_KEYS.rows);
    localStorage.removeItem(STORAGE_KEYS.bungieRows);
    writeJson(STORAGE_KEYS.bungieMeta, meta);
  } catch (error) {
    console.warn('D2AA clean IndexedDB cache write failed.', error);
    localStorage.removeItem(STORAGE_KEYS.rows);
    localStorage.removeItem(STORAGE_KEYS.bungieRows);
    writeJson(STORAGE_KEYS.bungieMeta, { ...meta, cacheFailed: true, cacheError: error.message || String(error) });
  }
  return { rows: cleanRows, meta };
}

export async function loadBungieInventoryFromCache() {
  const cache = await getCachedBungieInventory();
  if (!cache.hasRows) return null;
  return { rows: cache.rows.map(clearExpiredRecent).map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })), meta: cache.meta };
}

export async function clearBungieInventoryCache() {
  await idbDelete(IDB_ROWS_KEY).catch(() => {});
  await idbDelete(IDB_META_KEY).catch(() => {});
  localStorage.removeItem(STORAGE_KEYS.bungieRows);
  localStorage.removeItem(STORAGE_KEYS.bungieMeta);
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function markRecentChange(row, previousById, savedAt, hasPrevious, discoveredAt) {
  const old = previousById.get(String(row.Id));
  if (!old) {
    return hasPrevious
      ? { ...row, RecentStatus: 'new', RecentlyFound: true, FoundAt: discoveredAt, LastChangedAt: savedAt }
      : { ...row, RecentStatus: '', RecentlyFound: false, FoundAt: 0, LastChangedAt: savedAt };
  }
  const oldLoc = locationKey(old);
  const newLoc = locationKey(row);
  const statChanged = Number(old.Total || 0) !== Number(row.Total || 0) || Number(old.Power || 0) !== Number(row.Power || 0) || Number(old.Tier || 0) !== Number(row.Tier || 0);
  const moved = oldLoc !== newLoc;
  const status = moved ? 'moved' : statChanged ? 'changed' : '';
  if (!status) return clearExpiredRecent({ ...row, FoundAt: Number(old.FoundAt || 0), LastChangedAt: old.LastChangedAt });
  return { ...row, RecentStatus: status, RecentlyFound: true, FoundAt: Number(old.FoundAt || 0), LastChangedAt: savedAt, ActivityAt: discoveredAt };
}

function clearExpiredRecent(row) {
  const time = Number(row.ActivityAt || row.FoundAt || Date.parse(row.LastChangedAt || '') || 0);
  if (!row.RecentStatus || !time) return { ...row, RecentStatus: '', RecentlyFound: false };
  if (Date.now() - time > RECENT_WINDOW_MS) return { ...row, RecentStatus: '', RecentlyFound: false };
  return row;
}

function summarizeChanges(rows) {
  return {
    added: rows.filter((row) => row.RecentStatus === 'new').length,
    moved: rows.filter((row) => row.RecentStatus === 'moved').length,
    changed: rows.filter((row) => row.RecentStatus === 'changed').length
  };
}

function locationKey(row) {
  return [row.OwnerCharacterId || '', row.IsInVault ? 'vault' : 'char', row.IsEquipped ? 'equipped' : 'stored'].join('|');
}

export function formatCacheTime(meta) {
  if (!meta?.savedAt) return 'unknown time';
  try { return new Date(meta.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (_) { return 'unknown time'; }
}