import { STORAGE_KEYS } from '../constants.js';
import { readJson, writeJson, slimRowForStorage } from '../state.js';

const DB_NAME = 'd2aa-clean-cache';
const DB_VERSION = 1;
const STORE = 'keyval';
const IDB_ROWS_KEY = 'bungieRows';
const IDB_META_KEY = 'bungieMeta';
const SEEN_LEDGER_KEY = 'd2aa_clean_seen_item_ids_v1';
const SEEN_LEDGER_LIMIT = 260;
const OLD_OVERSIZED_KEYS = ['d2aa_clean_rows_v1', 'd2aa_clean_bungie_rows_v1'];

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
  const seenLedger = readSeenLedger();
  const hasPrevious = previousById.size > 0 || Object.keys(seenLedger).length > 0;
  const savedAt = new Date().toISOString();
  const discoveredBase = Date.now();
  const cleanRows = rows.map((row, index) => markNewlyObtained({ ...row, Source: 'Bungie', FromCache: false }, previousById, seenLedger, savedAt, hasPrevious, discoveredBase + index));
  const slimRows = cleanRows.map(slimRowForStorage);
  writeSeenLedger(slimRows, seenLedger);
  const changes = summarizeChanges(slimRows);
  const meta = { savedAt, count: slimRows.length, reason, version: 9, store: 'indexeddb', ...changes };
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
  return { rows: cache.rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })), meta: cache.meta };
}

export async function clearBungieInventoryCache() {
  await idbDelete(IDB_ROWS_KEY).catch(() => {});
  await idbDelete(IDB_META_KEY).catch(() => {});
  localStorage.removeItem(STORAGE_KEYS.bungieRows);
  localStorage.removeItem(STORAGE_KEYS.bungieMeta);
  localStorage.removeItem(SEEN_LEDGER_KEY);
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

function markNewlyObtained(row, previousById, seenLedger, savedAt, hasPrevious, discoveredAt) {
  const id = String(row.Id);
  const old = previousById.get(id);
  const seen = seenLedger[id];
  if (!old && !seen) {
    return hasPrevious
      ? { ...row, RecentStatus: 'new', RecentlyFound: true, FoundAt: discoveredAt, ActivityAt: discoveredAt, LastChangedAt: savedAt }
      : { ...row, RecentStatus: '', RecentlyFound: false, FoundAt: 0, ActivityAt: 0, LastChangedAt: savedAt };
  }

  const keepNew = old?.RecentStatus === 'new' || old?.RecentlyFound || seen?.recent === true;
  const foundAt = Number(old?.FoundAt || seen?.foundAt || 0);
  return {
    ...row,
    RecentStatus: keepNew ? 'new' : '',
    RecentlyFound: Boolean(keepNew),
    FoundAt: foundAt,
    ActivityAt: Number(old?.ActivityAt || old?.FoundAt || seen?.activityAt || foundAt || 0),
    LastChangedAt: old?.LastChangedAt || seen?.lastChangedAt || savedAt
  };
}

function readSeenLedger() {
  const value = readJson(SEEN_LEDGER_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function writeSeenLedger(rows, previousLedger = {}) {
  const next = {};
  const candidates = rows
    .filter((row) => row?.Id)
    .map((row) => {
      const id = String(row.Id || '');
      const prev = previousLedger[id] || {};
      const foundAt = Number(row.FoundAt || prev.foundAt || 0);
      const activityAt = Number(row.ActivityAt || prev.activityAt || row.FoundAt || 0);
      const recent = row.RecentStatus === 'new' || row.RecentlyFound === true;
      return { id, foundAt, activityAt, lastChangedAt: row.LastChangedAt || prev.lastChangedAt || '', recent };
    })
    .sort((a, b) => Number(b.recent) - Number(a.recent) || b.activityAt - a.activityAt || b.foundAt - a.foundAt)
    .slice(0, SEEN_LEDGER_LIMIT);

  for (const item of candidates) {
    next[item.id] = {
      foundAt: item.foundAt,
      activityAt: item.activityAt,
      lastChangedAt: item.lastChangedAt,
      recent: item.recent
    };
  }

  try {
    writeJson(SEEN_LEDGER_KEY, next);
  } catch (error) {
    console.warn('D2AA seen-item ledger write skipped because localStorage is full.', error);
    clearOversizedLocalStorage();
    try { writeJson(SEEN_LEDGER_KEY, Object.fromEntries(Object.entries(next).slice(0, 80))); }
    catch (_) { try { localStorage.removeItem(SEEN_LEDGER_KEY); } catch (__) {} }
  }
}

function clearOversizedLocalStorage() {
  for (const key of OLD_OVERSIZED_KEYS) {
    try {
      const value = localStorage.getItem(key) || '';
      if (value.length > 500000) localStorage.removeItem(key);
    } catch (_) {}
  }
}

function summarizeChanges(rows) {
  return {
    added: rows.filter((row) => row.RecentStatus === 'new').length,
    moved: 0,
    changed: 0
  };
}

export function formatCacheTime(meta) {
  if (!meta?.savedAt) return 'unknown time';
  try { return new Date(meta.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (_) { return 'unknown time'; }
}