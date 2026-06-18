import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArmorItem } from '../types/armor';
import { normalizeArmorRow } from '../data/armorNormalization';
import { clearBungieInventoryCache, loadBungieInventoryFromCache, formatCacheTime } from '../data/inventoryCache';
import { syncBungieInventory } from '../data/bungieSync';
import { parseDimCsvFile } from '../data/dimCsv';
import { STORAGE_KEYS } from '../utils/constants';
import { readJson, removeStorage, writeJson } from '../utils/storage';

export function useArmorInventory(setStatus: (status: string) => void): {
  rows: ArmorItem[];
  syncing: boolean;
  lastSyncAt: number;
  setRows: (rows: ArmorItem[], status?: string) => void;
  sync: (options?: { reason?: string; background?: boolean }) => Promise<void>;
  importCsv: (file: File) => Promise<void>;
  restoreCache: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateTag: (id: string, tag: string) => void;
  dismissRecent: (id: string) => void;
} {
  const [tags, setTags] = useState<Record<string, string>>(() => readJson(STORAGE_KEYS.tags, {}));
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => readJson(STORAGE_KEYS.dismissedRecent, {}));
  const [rawRows, setRawRows] = useState<ArmorItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const syncInFlight = useRef(false);

  const rows = useMemo(() => rawRows.map((row, index) => {
    const normalized = normalizeArmorRow(row, index, tags[row.Id]);
    if (dismissed[row.Id]) return { ...normalized, RecentStatus: '', RecentlyFound: false };
    return normalized;
  }), [rawRows, tags, dismissed]);

  const setRows = useCallback((nextRows: ArmorItem[], status = 'Rows loaded.') => {
    setRawRows(nextRows);
    setStatus(status);
  }, [setStatus]);

  const restoreCache = useCallback(async () => {
    const cached = await loadBungieInventoryFromCache();
    if (cached?.rows.length) {
      setLastSyncAt(new Date(cached.meta.savedAt || '').getTime() || 0);
      setRows(cached.rows, `Loaded Bungie cache: ${cached.rows.length} armor from ${formatCacheTime(cached.meta)}.`);
      return;
    }
    const csvRows = readJson<ArmorItem[]>(STORAGE_KEYS.rows, []);
    if (csvRows.length) {
      setRows(csvRows, `Loaded DIM CSV cache: ${csvRows.length} armor.`);
      return;
    }
    setStatus('No armor cache found. Sign in with Bungie, sync armor, or upload a DIM CSV to populate the analyzer.');
  }, [setRows, setStatus]);

  useEffect(() => {
    restoreCache().catch((error: unknown) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [restoreCache, setStatus]);

  const sync = useCallback(async (options: { reason?: string; background?: boolean } = {}) => {
    if (syncInFlight.current) {
      if (!options.background) setStatus('A Bungie sync is already running.');
      return;
    }
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const synced = await syncBungieInventory(setStatus, options.reason || 'manual-sync');
      if (synced.length) {
        setRows(synced, `${options.background ? 'Live sync' : 'Loaded'} ${synced.length} Bungie armor items.`);
        setLastSyncAt(Date.now());
      }
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [setRows, setStatus]);

  const importCsv = useCallback(async (file: File) => {
    const parsed = await parseDimCsvFile(file);
    if (!parsed.length) {
      setStatus('No armor rows found in that DIM CSV.');
      return;
    }
    setTags((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of parsed) {
        if (row.Tag) {
          next[row.Id] = String(row.Tag);
          changed = true;
        }
      }
      if (changed) writeJson(STORAGE_KEYS.tags, next);
      return next;
    });
    writeJson(STORAGE_KEYS.rows, parsed);
    setRows(parsed, `Loaded ${parsed.length} armor rows from ${file.name}.`);
  }, [setRows, setStatus]);

  const clearCache = useCallback(async () => {
    await clearBungieInventoryCache();
    removeStorage(STORAGE_KEYS.rows);
    setRawRows([]);
    setStatus('Inventory cache cleared. Tags and dismissed feed items were kept.');
  }, [setStatus]);

  const updateTag = useCallback((id: string, tag: string) => {
    setTags((current) => {
      const next = { ...current };
      if (next[id] === tag || !tag) delete next[id];
      else next[id] = tag;
      writeJson(STORAGE_KEYS.tags, next);
      return next;
    });
  }, []);

  const dismissRecent = useCallback((id: string) => {
    setDismissed((current) => {
      const next = { ...current, [id]: Date.now() };
      writeJson(STORAGE_KEYS.dismissedRecent, next);
      return next;
    });
  }, []);

  return { rows, syncing, lastSyncAt, setRows, sync, importCsv, restoreCache, clearCache, updateTag, dismissRecent };
}
