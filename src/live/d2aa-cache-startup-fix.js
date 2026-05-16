(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const STARTUP_GUARD_MS = 90000;
  const FRESH_CACHE_MS = 15 * 60 * 1000;
  const startedAt = Date.now();

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };

  function cacheInfo() {
    const rows = readJson(LS_ROWS, []);
    const meta = readJson(LS_META, null);
    const savedAt = Date.parse(meta?.savedAt || '');
    const age = Number.isFinite(savedAt) ? Date.now() - savedAt : Infinity;
    return { rows, meta, age, hasRows: Array.isArray(rows) && rows.length > 0, fresh: Array.isArray(rows) && rows.length > 0 && age <= FRESH_CACHE_MS };
  }

  function setStatus(message) {
    const status = document.getElementById('bungieStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.add('is-ready');
    status.classList.remove('is-missing');
  }

  function ensureCacheLoaded() {
    const info = cacheInfo();
    if (!info.hasRows) return;
    const currentRows = window.D2AA?.getState?.()?.allRows?.length || 0;
    if (!currentRows && window.D2AAInventoryCache?.load) {
      window.D2AAInventoryCache.load('startup-cache-first');
    }
  }

  function installStartupSyncGuard() {
    const button = document.getElementById('bungieImportV2Btn');
    if (!button || button.dataset.cacheStartupGuard === '1') return;
    button.dataset.cacheStartupGuard = '1';
    button.addEventListener('click', (event) => {
      const info = cacheInfo();
      const withinStartupWindow = Date.now() - startedAt <= STARTUP_GUARD_MS;
      const isProgrammaticAutoClick = event.isTrusted === false;
      if (!isProgrammaticAutoClick || !withinStartupWindow || !info.fresh) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setStatus(`Loaded cached inventory: ${info.rows.length} armor. Startup sync skipped because the cache is fresh; use Sync from Bungie to refresh now.`);
    }, true);
  }

  function run() {
    installStartupSyncGuard();
    setTimeout(ensureCacheLoaded, 0);
    setTimeout(ensureCacheLoaded, 150);
    setTimeout(installStartupSyncGuard, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
