(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const LS_LIVE = 'd2aa_bungie_live_state_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const STARTUP_GUARD_MS = 120000;
  const startedAt = Date.now();

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };

  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
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

  function markNotRunning() {
    const live = readJson(LS_LIVE, {});
    if (live && live.running) writeJson(LS_LIVE, { ...live, running: false, lastReason: 'startup-cache-first-skipped' });
  }

  function normalizedCacheRows(rows) {
    return rows.map((row) => ({
      ...row,
      Source: row.Source || 'Bungie',
      FromCache: true,
      RecentlyFound: Boolean(row.RecentlyFound)
    }));
  }

  function ensureCacheLoaded(reason = 'startup-cache-first') {
    const info = cacheInfo();
    if (!info.hasRows) return false;
    const currentRows = window.D2AA?.getState?.()?.allRows?.length || 0;
    if (currentRows) return true;

    if (window.D2AAInventoryCache?.load) {
      const loaded = window.D2AAInventoryCache.load(reason);
      if (loaded) {
        markNotRunning();
        setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Use Sync from Bungie to refresh now.`);
        return true;
      }
    }

    if (window.D2AA?.loadRows) {
      const rows = normalizedCacheRows(info.rows);
      window.D2AA.loadRows(rows, `${CACHE_SOURCE} • ${rows.length} armor • saved ${formatWhen(info.meta?.savedAt)}`);
      markNotRunning();
      setStatus(`Loaded cached inventory: ${rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Use Sync from Bungie to refresh now.`);
      return true;
    }
    return false;
  }

  function shouldBlockStartupAutoSync(event) {
    const info = cacheInfo();
    if (!info.hasRows) return false;
    if (Date.now() - startedAt > STARTUP_GUARD_MS) return false;
    if (event?.isTrusted !== false) return false;
    const target = event.target?.closest?.('#bungieImportV2Btn');
    return Boolean(target);
  }

  function blockStartupAutoSync(event) {
    if (!shouldBlockStartupAutoSync(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const info = cacheInfo();
    ensureCacheLoaded('startup-cache-first-blocked-sync');
    markNotRunning();
    setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Startup Bungie sync skipped; click Sync from Bungie to refresh manually.`);
  }

  function installStartupSyncGuard() {
    document.removeEventListener('click', blockStartupAutoSync, true);
    document.addEventListener('click', blockStartupAutoSync, true);

    const button = document.getElementById('bungieImportV2Btn');
    if (!button || button.dataset.cacheStartupGuard === '3') return;
    button.dataset.cacheStartupGuard = '3';
    button.addEventListener('click', blockStartupAutoSync, true);
  }

  function runPass() {
    installStartupSyncGuard();
    ensureCacheLoaded();
  }

  function run() {
    runPass();
    document.addEventListener('d2aa:bundle-loaded', () => {
      runPass();
      setTimeout(runPass, 25);
      setTimeout(runPass, 100);
      setTimeout(runPass, 350);
    });
    window.addEventListener('load', runPass);
    [50, 150, 300, 600, 1000, 1600, 2500, 4000].forEach((ms) => setTimeout(runPass, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();