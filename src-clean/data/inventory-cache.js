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
  const cleanRows = rows.map((row) => ({ ...row, Source: 'Bungie', FromCache: false }));
  const changes = summarizeChanges(cleanRows, previousById);
  const meta = {
    savedAt: new Date().toISOString(),
    count: cleanRows.length,
    reason,
    version: 1,
    ...changes
  };
  writeJson(STORAGE_KEYS.bungieRows, cleanRows);
  writeJson(STORAGE_KEYS.bungieMeta, meta);
  writeJson(STORAGE_KEYS.rows, cleanRows);
  return { rows: cleanRows, meta };
}

export function loadBungieInventoryFromCache() {
  const cache = getCachedBungieInventory();
  if (!cache.hasRows) return null;
  return {
    rows: cache.rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })),
    meta: cache.meta
  };
}

export function clearBungieInventoryCache() {
  localStorage.removeItem(STORAGE_KEYS.bungieRows);
  localStorage.removeItem(STORAGE_KEYS.bungieMeta);
}

function summarizeChanges(rows, previousById) {
  let added = 0;
  let moved = 0;
  let changed = 0;
  for (const row of rows) {
    const old = previousById.get(String(row.Id));
    if (!old) { added++; continue; }
    const oldLoc = [old.OwnerCharacterId || '', old.IsInVault ? 'vault' : 'char', old.IsEquipped ? 'equipped' : 'stored'].join('|');
    const newLoc = [row.OwnerCharacterId || '', row.IsInVault ? 'vault' : 'char', row.IsEquipped ? 'equipped' : 'stored'].join('|');
    if (oldLoc !== newLoc) moved++;
    if (Number(old.Total || 0) !== Number(row.Total || 0) || Number(old.Power || 0) !== Number(row.Power || 0) || Number(old.Tier || 0) !== Number(row.Tier || 0)) changed++;
  }
  return { added, moved, changed };
}

export function formatCacheTime(meta) {
  if (!meta?.savedAt) return 'unknown time';
  try { return new Date(meta.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch (_) { return 'unknown time'; }
}
