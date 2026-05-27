const GUARDED_KEYS = new Set([
  'd2aa_clean_bungie_meta_v1',
  'd2aa_clean_rows_v1',
  'd2aa_clean_bungie_rows_v1'
]);

const PRUNE_KEYS = [
  'd2aa_clean_rows_v1',
  'd2aa_clean_bungie_rows_v1',
  'd2aa_clean_manifest_cache_v1',
  'd2aa_manifest_cache_v1',
  'd2aa_clean_last_inventory_v1'
];

if (!window.__D2AA_STORAGE_QUOTA_GUARD__) {
  window.__D2AA_STORAGE_QUOTA_GUARD__ = true;
  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function guardedSetItem(key, value) {
    try {
      return nativeSetItem.call(this, key, value);
    } catch (error) {
      if (this !== window.localStorage || !isQuotaError(error) || !GUARDED_KEYS.has(String(key))) throw error;
      pruneLocalStorage(String(key));
      try {
        return nativeSetItem.call(this, key, value);
      } catch (retryError) {
        if (String(key) === 'd2aa_clean_bungie_meta_v1') {
          try { window.sessionStorage.setItem(key, value); } catch (_) {}
          console.warn('D2AA skipped localStorage Bungie meta write because storage quota is full.', retryError);
          return undefined;
        }
        throw retryError;
      }
    }
  };
}

function isQuotaError(error) {
  return error && (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|exceeded/i.test(error.message || '')
  );
}

function pruneLocalStorage(currentKey) {
  for (const key of PRUNE_KEYS) {
    if (key === currentKey) continue;
    try { window.localStorage.removeItem(key); } catch (_) {}
  }
  pruneLargeKeys(currentKey);
}

function pruneLargeKeys(currentKey) {
  try {
    const entries = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || key === currentKey || !key.startsWith('d2aa_')) continue;
      const value = window.localStorage.getItem(key) || '';
      entries.push([key, value.length]);
    }
    entries
      .filter(([, size]) => size > 120000)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .forEach(([key]) => window.localStorage.removeItem(key));
  } catch (_) {}
}
