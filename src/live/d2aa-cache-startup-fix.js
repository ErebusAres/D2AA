(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const STARTUP_GUARD_MS = 120000;
  const startedAt = Date.now();

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };

  function cacheInfo() {
    const rows = readJson(LS_ROWS, []);
    const meta = readJson(LS_META, null);
    return { rows, meta, hasRows: Array.isArray(rows) && rows.length > 0 };
  }

  function formatWhen(iso) {
    if (!iso) return 'unknown time';
    try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (_) { return 'unknown time'; }
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
      setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Use Sync from Bungie to refresh now.`);
    }
  }

  function installStartupSyncGuard() {
    const button = document.getElementById('bungieImportV2Btn');
    if (!button || button.dataset.cacheStartupGuard === '2') return;
    button.dataset.cacheStartupGuard = '2';
    button.addEventListener('click', (event) => {
      const info = cacheInfo();
      const withinStartupWindow = Date.now() - startedAt <= STARTUP_GUARD_MS;
      const isProgrammaticAutoClick = event.isTrusted === false;
      if (!isProgrammaticAutoClick || !withinStartupWindow || !info.hasRows) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      ensureCacheLoaded();
      setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Startup Bungie sync skipped; click Sync from Bungie to refresh manually.`);
    }, true);
  }

  function run() {
    installStartupSyncGuard();
    setTimeout(ensureCacheLoaded, 0);
    setTimeout(ensureCacheLoaded, 100);
    setTimeout(installStartupSyncGuard, 250);
    setTimeout(ensureCacheLoaded, 400);
    setTimeout(installStartupSyncGuard, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
