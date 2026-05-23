import { STORAGE_KEYS } from '../constants.js';
import { readJson, writeJson, slimRowForStorage } from '../state.js';
import { ACTIVE_FEED_LIMIT, getActiveFeedRows } from './feed-state.js';

const DB_NAME = 'd2aa-clean-cache';
const DB_VERSION = 1;
const STORE = 'keyval';
const IDB_ROWS_KEY = 'bungieRows';
const IDB_META_KEY = 'bungieMeta';
const SEEN_LEDGER_KEY = 'd2aa_clean_seen_item_ids_v1';
const SEEN_LEDGER_LIMIT = 2500;
const CACHE_SCHEMA_VERSION = 15;
const BAD_STAT_SOURCE = 'D2AARepair_BaseWasMisclassifiedAsOtherBonus';
const OLD_OVERSIZED_KEYS = ['d2aa_clean_rows_v1', 'd2aa_clean_bungie_rows_v1'];

export async function getCachedBungieInventory() {
  const idbRows = await idbGet(IDB_ROWS_KEY).catch(() => null);
  const idbMeta = await idbGet(IDB_META_KEY).catch(() => null);
  if (Array.isArray(idbRows) && idbRows.length) {
    if (isInvalidCache(idbRows, idbMeta)) {
      await clearBungieInventoryCache();
      return { rows: [], meta: { invalidated: true, reason: 'bad-stat-cache', previous: idbMeta || null }, hasRows: false };
    }
    return { rows: idbRows, meta: idbMeta, hasRows: true };
  }

  const rows = readJson(STORAGE_KEYS.bungieRows, []);
  const meta = readJson(STORAGE_KEYS.bungieMeta, null);
  if (Array.isArray(rows) && rows.length) {
    if (isInvalidCache(rows, meta)) {
      await clearBungieInventoryCache();
      return { rows: [], meta: { invalidated: true, reason: 'bad-stat-cache', previous: meta || null }, hasRows: false };
    }
    await idbSet(IDB_ROWS_KEY, rows).catch(() => {});
    await idbSet(IDB_META_KEY, meta).catch(() => {});
    try { localStorage.removeItem(STORAGE_KEYS.bungieRows); } catch (_) {}
  }
  return { rows: Array.isArray(rows) ? rows : [], meta, hasRows: Array.isArray(rows) && rows.length > 0 };
}

export async function saveBungieInventory(rows, reason = 'sync') {
  const previous = (await getCachedBungieInventory()).rows || [];
  const previousById = new Map(previous.map((row) => [String(row.Id), row]));
  const seenLedger = readSeenLedger();
  const handled = readHandledState();
  const hasPrevious = previousById.size > 0 || Object.keys(seenLedger).length > 0;
  const savedAt = new Date().toISOString();
  const now = Date.now();
  const sortedRows = sortRowsForFirstSeen(rows);
  const orderById = new Map(sortedRows.map((row, index) => [String(row.Id), index]));
  const activityRows = rows.map((row) => markInventoryActivity({ ...row, Source: 'Bungie', FromCache: false }, previousById, seenLedger, handled, savedAt, now, hasPrevious, orderById));
  const cleanRows = enforceActiveFeedLimit(activityRows);
  const slimRows = cleanRows.map(slimRowForStorage);
  writeSeenLedger(slimRows, seenLedger, handled, savedAt);
  const changes = summarizeChanges(slimRows, previousById);
  const meta = { savedAt, count: slimRows.length, reason, version: CACHE_SCHEMA_VERSION, store: 'indexeddb', activeFeedLimit: ACTIVE_FEED_LIMIT, ...changes };
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
}

export function resetNewItemBaseline() {
  localStorage.removeItem(SEEN_LEDGER_KEY);
}

export function formatCacheTime(meta) {
  const savedAt = meta?.savedAt || meta?.updatedAt || meta?.time || '';
  if (!savedAt) return 'unknown time';
  const date = new Date(savedAt);
  if (!Number.isFinite(date.getTime())) return 'unknown time';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isInvalidCache(rows, meta) {
  if (Number(meta?.version || 0) < CACHE_SCHEMA_VERSION) return true;
  return rows.some((row) => row?.StatSource === BAD_STAT_SOURCE || looksLikeCorruptedStats(row));
}

function looksLikeCorruptedStats(row) {
  const baseTotal = number(row?.BaseTotal ?? row?.Total);
  const currentTotal = number(row?.CurrentTotal);
  const bonusTotal = number(row?.StatBonusTotal);
  const statBase = ['Health','Melee','Grenade','Super','ClassAbility','Weapon'].reduce((sum, key) => sum + number(row?.[`Base${key}`] ?? row?.[key]), 0);
  const statCurrent = ['Health','Melee','Grenade','Super','ClassAbility','Weapon'].reduce((sum, key) => sum + number(row?.[`Current${key}`]), 0);
  if (baseTotal === 0 && bonusTotal >= 45) return true;
  if (baseTotal && statBase && Math.abs(baseTotal - statBase) > 2) return true;
  if (currentTotal && statCurrent && Math.abs(currentTotal - statCurrent) > 2) return true;
  if (baseTotal && currentTotal && bonusTotal && Math.abs((currentTotal - baseTotal) - bonusTotal) > 2) return true;
  return false;
}

function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

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

function markInventoryActivity(row, previousById, seenLedger, handled, savedAt, now, hasPrevious, orderById) {
  const id = String(row.Id);
  const old = previousById.get(id);
  const seen = seenLedger[id];
  const isHandled = Boolean(handled.dismissed[id] || handled.tags[id]);
  const order = Number(orderById.get(id) || 0);
  const estimatedFirstSeen = now - order * 1000;

  if (!old && !seen) {
    return hasPrevious && !isHandled
      ? { ...row, RecentStatus: 'new', RecentlyFound: true, FoundAt: now, ActivityAt: now, LastChangedAt: savedAt, ItemSignature: itemSignature(row), LocationSignature: locationSignature(row) }
      : { ...row, RecentStatus: '', RecentlyFound: false, FoundAt: estimatedFirstSeen, ActivityAt: estimatedFirstSeen, LastChangedAt: savedAt, ItemSignature: itemSignature(row), LocationSignature: locationSignature(row) };
  }

  const previousSignature = old?.ItemSignature || old?.signature || seen?.signature || itemSignature(old || {});
  const nextSignature = itemSignature(row);
  const previousLocation = old?.LocationSignature || seen?.location || locationSignature(old || {});
  const nextLocation = locationSignature(row);
  const moved = Boolean(old) && previousLocation !== nextLocation;
  const changed = Boolean(old) && previousSignature && previousSignature !== nextSignature;
  const oldWasNew = old?.RecentStatus === 'new' || old?.RecentlyFound === true || seen?.recent === true;
  const keepNew = !isHandled && oldWasNew;
  const foundAt = Number(old?.FoundAt || seen?.foundAt || estimatedFirstSeen || 0);
  const activityAt = keepNew ? Math.max(Number(old?.ActivityAt || 0), foundAt) : moved || changed ? now : Number(old?.ActivityAt || seen?.activityAt || foundAt || 0);

  return {
    ...row,
    RecentStatus: keepNew ? 'new' : '',
    RecentlyFound: Boolean(keepNew),
    FoundAt: foundAt,
    ActivityAt: activityAt,
    LastChangedAt: moved || changed || keepNew ? savedAt : old?.LastChangedAt || seen?.lastChangedAt || savedAt,
    ItemSignature: nextSignature,
    LocationSignature: nextLocation
  };
}

function enforceActiveFeedLimit(rows) {
  const activeIds = new Set(getActiveFeedRows(rows).map((row) => String(row.Id)));
  return rows.map((row) => {
    if (!(row.RecentStatus === 'new' || row.RecentlyFound === true)) return row;
    if (activeIds.has(String(row.Id))) return row;
    return { ...row, RecentStatus: '', RecentlyFound: false };
  });
}

function readSeenLedger() {
  const value = readJson(SEEN_LEDGER_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readHandledState() {
  const dismissed = readJson(STORAGE_KEYS.dismissedRecent, {});
  const tags = readJson(STORAGE_KEYS.tags, {});
  return {
    dismissed: dismissed && typeof dismissed === 'object' && !Array.isArray(dismissed) ? dismissed : {},
    tags: tags && typeof tags === 'object' && !Array.isArray(tags) ? tags : {}
  };
}

function writeSeenLedger(rows, previousLedger = {}, handled = readHandledState(), savedAt = new Date().toISOString()) {
  const next = {};
  const candidates = rows
    .filter((row) => row?.Id)
    .map((row) => {
      const id = String(row.Id || '');
      const prev = previousLedger[id] || {};
      const foundAt = Number(row.FoundAt || prev.foundAt || 0);
      const activityAt = Number(row.ActivityAt || prev.activityAt || row.FoundAt || 0);
      const isHandled = Boolean(handled.dismissed[id] || handled.tags[id]);
      const recent = !isHandled && (row.RecentStatus === 'new' || row.RecentlyFound === true);
      return {
        id,
        foundAt,
        activityAt,
        lastChangedAt: row.LastChangedAt || prev.lastChangedAt || savedAt,
        recent,
        handled: isHandled,
        location: row.LocationSignature || prev.location || locationSignature(row),
        signature: row.ItemSignature || prev.signature || itemSignature(row)
      };
    })
    .sort((a, b) => Number(b.recent) - Number(a.recent) || b.activityAt - a.activityAt || b.foundAt - a.foundAt)
    .slice(0, SEEN_LEDGER_LIMIT);

  for (const item of candidates) {
    next[item.id] = {
      foundAt: item.foundAt,
      activityAt: item.activityAt,
      lastChangedAt: item.lastChangedAt,
      recent: item.recent,
      handled: item.handled,
      location: item.location,
      signature: item.signature
    };
  }

  try {
    writeJson(SEEN_LEDGER_KEY, next);
  } catch (error) {
    console.warn('D2AA seen-item ledger write skipped because localStorage is full.', error);
    clearOversizedLocalStorage();
    try { writeJson(SEEN_LEDGER_KEY, Object.fromEntries(Object.entries(next).slice(0, 800))); }
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

function summarizeChanges(rows, previousById) {
  let moved = 0;
  let changed = 0;
  for (const row of rows) {
    const old = previousById.get(String(row.Id));
    if (!old) continue;
    if ((old.LocationSignature || locationSignature(old)) !== (row.LocationSignature || locationSignature(row))) moved++;
    if ((old.ItemSignature || itemSignature(old)) !== (row.ItemSignature || itemSignature(row))) changed++;
  }
  return {
    added: rows.filter((row) => row.RecentStatus === 'new' || row.RecentlyFound === true).length,
    moved,
    changed
  };
}

function sortRowsForFirstSeen(rows) {
  return rows.slice().sort((a, b) => compareInstanceIdsDesc(a.Id, b.Id) || String(a.Name || '').localeCompare(String(b.Name || '')));
}

function compareInstanceIdsDesc(a, b) {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  if (left.length !== right.length) return right.length - left.length;
  return right.localeCompare(left);
}
function digitsOnly(value) { return String(value || '').replace(/\D+/g, '').replace(/^0+/, ''); }

function itemSignature(row) {
  return [row.Name, row.BaseTotal, row.CurrentTotal, row.StatBonusTotal, row.Power, row.Tier, row.GearTier, row.IsMasterworked, row.IsLocked].join('|');
}
function locationSignature(row) { return [row.IsEquipped ? 'equipped' : row.IsInVault ? 'vault' : 'inventory', row.CharacterId || '', row.BucketHash || ''].join('|'); }