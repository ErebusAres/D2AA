import { STORAGE_KEYS } from '../constants.js';
import { readJson, writeJson } from '../state.js';

export function getCachedBungieInventory() {
  const rows = readJson(STORAGE_KEYS.bungieRows, []);
  const meta = readJson(STORAGE_KEYS.bungieMeta, null);
  return { rows: Array.isArray(rows) ? rows : [], meta, hasRows: Array.isArray(rows) && rows.length > 0 };
}

export function saveBungieInventory(rows, reason = 'sync') {
  const previous = getCachedBungieInventory().rows;
  const previousById = new Map(previous.map((row) => [String(row.Id), row]));
  const savedAt = new Date().toISOString();
  const cleanRows = rows.map((row) => markRecentChange({ ...row, Source: 'Bungie', FromCache: false }, previousById, savedAt));
  const changes = summarizeChanges(cleanRows);
  const meta = { savedAt, count: cleanRows.length, reason, version: 2, ...changes };
  writeJson(STORAGE_KEYS.bungieRows, cleanRows);
  writeJson(STORAGE_KEYS.bungieMeta, meta);
  writeJson(STORAGE_KEYS.rows, cleanRows);
  return { rows: cleanRows, meta };
}

export function loadBungieInventoryFromCache() {
  const cache = getCachedBungieInventory();
  if (!cache.hasRows) return null;
  return { rows: cache.rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })), meta: cache.meta };
}

export function clearBungieInventoryCache() {
  localStorage.removeItem(STORAGE_KEYS.bungieRows);
  localStorage.removeItem(STORAGE_KEYS.bungieMeta);
}

function markRecentChange(row, previousById, savedAt) {
  const old = previousById.get(String(row.Id));
  if (!old) return { ...row, RecentStatus: 'new', RecentlyFound: true, FoundAt: Date.now(), LastChangedAt: savedAt };
  const oldLoc = locationKey(old);
  const newLoc = locationKey(row);
  const statChanged = Number(old.Total || 0) !== Number(row.Total || 0) || Number(old.Power || 0) !== Number(row.Power || 0) || Number(old.Tier || 0) !== Number(row.Tier || 0);
  const moved = oldLoc !== newLoc;
  const status = moved ? 'moved' : statChanged ? 'changed' : '';
  return {
    ...row,
    RecentStatus: status || old.RecentStatus || '',
    RecentlyFound: Boolean(status),
    FoundAt: status ? Date.now() : Number(old.FoundAt || 0),
    LastChangedAt: status ? savedAt : old.LastChangedAt
  };
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
