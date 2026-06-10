import type { ArmorItem } from '../types/armor';
import { STORAGE_KEYS } from '../utils/constants';
import { readJson, removeStorage, writeJson } from '../utils/storage';
import { slimArmorRow } from './armorNormalization';
import { getActiveFeedRows } from './feedState';

const DB_NAME = 'd2aa-clean-cache';
const STORE = 'keyval';
const IDB_ROWS_KEY = 'bungieRows';
const IDB_META_KEY = 'bungieMeta';
const SEEN_LEDGER_KEY = 'd2aa_clean_seen_item_ids_v1';
const CACHE_SCHEMA_VERSION = 22;

export interface InventoryCacheMeta {
  savedAt?: string;
  count?: number;
  reason?: string;
  version?: number;
  added?: number;
  moved?: number;
  changed?: number;
  invalidated?: boolean;
}

export async function saveBungieInventory(rows: ArmorItem[], reason = 'sync'): Promise<{ rows: ArmorItem[]; meta: InventoryCacheMeta }> {
  const previous = (await loadBungieInventoryFromCache())?.rows || [];
  const previousById = new Map(previous.map((row) => [String(row.Id), row]));
  const seenLedger = readJson<Record<string, SeenLedgerEntry>>(SEEN_LEDGER_KEY, {});
  const savedAt = new Date().toISOString();
  const now = Date.now();
  const hasPrevious = previousById.size > 0 || Object.keys(seenLedger).length > 0;
  const activityRows = rows.map((row, index) => markInventoryActivity({ ...row, Source: 'Bungie' }, previousById, seenLedger, savedAt, now - index * 1000, hasPrevious));
  const activeIds = new Set(getActiveFeedRows(activityRows).map((row) => String(row.Id)));
  const cleanRows = activityRows.map((row) => row.RecentlyFound && !activeIds.has(String(row.Id)) ? { ...row, RecentlyFound: false, RecentStatus: '' } : row);
  const slimRows = cleanRows.map(slimArmorRow);
  writeSeenLedger(slimRows, seenLedger, savedAt);
  const meta = { savedAt, count: slimRows.length, reason, version: CACHE_SCHEMA_VERSION, ...summarizeChanges(slimRows, previousById) };
  await idbSet(IDB_ROWS_KEY, slimRows).catch(() => safeWriteJson(STORAGE_KEYS.bungieRows, slimRows));
  await idbSet(IDB_META_KEY, meta).catch(() => safeWriteJson(STORAGE_KEYS.bungieMeta, meta));
  removeStorage(STORAGE_KEYS.rows);
  return { rows: cleanRows, meta };
}

export async function loadBungieInventoryFromCache(): Promise<{ rows: ArmorItem[]; meta: InventoryCacheMeta } | null> {
  const idbRows = await idbGet<ArmorItem[]>(IDB_ROWS_KEY).catch(() => null);
  const idbMeta = await idbGet<InventoryCacheMeta>(IDB_META_KEY).catch(() => null);
  if (Array.isArray(idbRows) && idbRows.length) return { rows: idbRows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })), meta: idbMeta || {} };
  const rows = readJson<ArmorItem[]>(STORAGE_KEYS.bungieRows, []);
  const meta = readJson<InventoryCacheMeta>(STORAGE_KEYS.bungieMeta, {});
  return rows.length ? { rows: rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })), meta } : null;
}

export async function clearBungieInventoryCache(): Promise<void> {
  await idbDelete(IDB_ROWS_KEY).catch(() => undefined);
  await idbDelete(IDB_META_KEY).catch(() => undefined);
  removeStorage(STORAGE_KEYS.bungieRows);
  removeStorage(STORAGE_KEYS.bungieMeta);
}

export function formatCacheTime(meta?: InventoryCacheMeta): string {
  const date = new Date(meta?.savedAt || '');
  if (!Number.isFinite(date.getTime())) return 'unknown time';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface SeenLedgerEntry {
  foundAt?: number;
  activityAt?: number;
  lastChangedAt?: string;
  recent?: boolean;
  location?: string;
  signature?: string;
}

function markInventoryActivity(row: ArmorItem, previousById: Map<string, ArmorItem>, seenLedger: Record<string, SeenLedgerEntry>, savedAt: string, estimatedFirstSeen: number, hasPrevious: boolean): ArmorItem {
  const id = String(row.Id);
  const old = previousById.get(id);
  const seen = seenLedger[id];
  if (!old && !seen) {
    return hasPrevious
      ? { ...row, RecentStatus: 'new', RecentlyFound: true, FoundAt: Date.now(), ActivityAt: Date.now(), LastChangedAt: savedAt, ItemSignature: itemSignature(row), LocationSignature: locationSignature(row) }
      : { ...row, RecentStatus: '', RecentlyFound: false, FoundAt: estimatedFirstSeen, ActivityAt: estimatedFirstSeen, LastChangedAt: savedAt, ItemSignature: itemSignature(row), LocationSignature: locationSignature(row) };
  }
  const previousSignature = old?.ItemSignature || seen?.signature || itemSignature(old || {});
  const nextSignature = itemSignature(row);
  const previousLocation = old?.LocationSignature || seen?.location || locationSignature(old || {});
  const nextLocation = locationSignature(row);
  const changed = Boolean(old) && previousSignature !== nextSignature;
  const moved = Boolean(old) && previousLocation !== nextLocation;
  const keepNew = old?.RecentStatus === 'new' || old?.RecentlyFound === true || seen?.recent === true;
  return {
    ...row,
    RecentStatus: keepNew ? 'new' : '',
    RecentlyFound: keepNew,
    FoundAt: Number(old?.FoundAt || seen?.foundAt || estimatedFirstSeen),
    ActivityAt: keepNew || moved || changed ? Date.now() : Number(old?.ActivityAt || seen?.activityAt || estimatedFirstSeen),
    LastChangedAt: moved || changed || keepNew ? savedAt : old?.LastChangedAt || seen?.lastChangedAt || savedAt,
    ItemSignature: nextSignature,
    LocationSignature: nextLocation
  };
}

function writeSeenLedger(rows: ArmorItem[], previous: Record<string, SeenLedgerEntry>, savedAt: string): void {
  const next: Record<string, SeenLedgerEntry> = {};
  for (const row of rows) {
    next[String(row.Id)] = {
      foundAt: Number(row.FoundAt || previous[row.Id]?.foundAt || 0),
      activityAt: Number(row.ActivityAt || previous[row.Id]?.activityAt || 0),
      lastChangedAt: row.LastChangedAt || previous[row.Id]?.lastChangedAt || savedAt,
      recent: row.RecentStatus === 'new' || row.RecentlyFound === true,
      location: row.LocationSignature || locationSignature(row),
      signature: row.ItemSignature || itemSignature(row)
    };
  }
  writeJson(SEEN_LEDGER_KEY, next);
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    writeJson(key, value);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Browser storage is full. Clear old site data, then sync armor again.');
    }
    throw error;
  }
}

function summarizeChanges(rows: ArmorItem[], previousById: Map<string, ArmorItem>): { added: number; moved: number; changed: number } {
  let moved = 0;
  let changed = 0;
  for (const row of rows) {
    const old = previousById.get(String(row.Id));
    if (!old) continue;
    if ((old.LocationSignature || locationSignature(old)) !== (row.LocationSignature || locationSignature(row))) moved += 1;
    if ((old.ItemSignature || itemSignature(old)) !== (row.ItemSignature || itemSignature(row))) changed += 1;
  }
  return { added: rows.filter((row) => row.RecentStatus === 'new' || row.RecentlyFound === true).length, moved, changed };
}

function itemSignature(row: Partial<ArmorItem>): string {
  return [row.Name, row.BaseTotal, row.CurrentTotal, row.StatBonusTotal, row.Power, row.Tier, row.GearTier, row.IsMasterworked, row.IsLocked].join('|');
}

function locationSignature(row: Partial<ArmorItem>): string {
  return [row.IsEquipped ? 'equipped' : row.IsInVault ? 'vault' : 'inventory', row.OwnerCharacterId || '', row.BucketHash || ''].join('|');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
