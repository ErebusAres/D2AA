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
    catch (error) { console.warn('D2AA cache write failed', error); return false; }
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

  function isCacheLabel(label) {
    return String(label || '').includes(CACHE_SOURCE);
  }

  function isBungieRows(rows, label) {
    if (!Array.isArray(rows) || !rows.length) return false;
    if (/bungie/i.test(String(label || '')) && !isCacheLabel(label)) return true;
    return rows.some((row) => String(row?.Source || '').toLowerCase() === 'bungie' && !row?.FromCache);
  }

  function cleanRowsForCache(rows) {
    return rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', RecentlyFound: Boolean(row.RecentlyFound), FromCache: false, CachedAt: undefined }));
  }

  function saveRowsToCache(rows, label = '') {
    if (!isBungieRows(rows, label)) return false;
    const cleaned = cleanRowsForCache(rows);
    const meta = { savedAt: new Date().toISOString(), count: cleaned.length, version: 4, mode: 'post-bundle-cache-guard', label: String(label || '') };
    const okRows = writeJson(LS_ROWS, cleaned);
    const okMeta = writeJson(LS_META, meta);
    writeJson(LS_LIVE, { ...readJson(LS_LIVE, {}), running: false, lastSuccessAt: meta.savedAt, lastReason: 'saved-cache-guard', lastError: '', errorCount: 0 });
    if (okRows && okMeta) setStatus(`Saved Bungie inventory cache: ${cleaned.length} armor from ${formatWhen(meta.savedAt)}.`);
    return okRows && okMeta;
  }

  function normalizedCacheRows(rows) {
    return rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true, RecentlyFound: Boolean(row.RecentlyFound) }));
  }

  function markNotRunning() {
    const live = readJson(LS_LIVE, {});
    if (live && live.running) writeJson(LS_LIVE, { ...live, running: false, lastReason: 'startup-cache-first-skipped' });
  }

  function loadCache(reason = 'startup-cache-first') {
    const info = cacheInfo();
    if (!info.hasRows || !window.D2AA?.loadRows) return false;
    const rows = normalizedCacheRows(info.rows);
    window.D2AA.loadRows(rows, `${CACHE_SOURCE} • ${rows.length} armor • saved ${formatWhen(info.meta?.savedAt)} • ${reason}`);
    markNotRunning();
    setStatus(`Loaded cached inventory: ${rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Use Sync from Bungie to refresh now.`);
    return true;
  }

  function ensureCacheLoaded() {
    const currentRows = window.D2AA?.getState?.()?.allRows?.length || 0;
    if (currentRows) return true;
    return loadCache('startup-cache-first');
  }

  function patchLoadRows() {
    if (!window.D2AA?.loadRows || window.D2AA.__cacheGuardSavePatched) return false;
    const originalLoadRows = window.D2AA.loadRows.bind(window.D2AA);
    window.D2AA.loadRows = (rows, label) => {
      const result = originalLoadRows(rows, label);
      saveRowsToCache(rows, label);
      return result;
    };
    window.D2AA.__cacheGuardSavePatched = true;
    return true;
  }

  function blockStartupAutoSync(event) {
    const info = cacheInfo();
    const isProgrammaticAutoClick = event?.isTrusted === false;
    const withinStartupWindow = Date.now() - startedAt <= STARTUP_GUARD_MS;
    const target = event?.target?.closest?.('#bungieImportV2Btn');
    if (!info.hasRows || !isProgrammaticAutoClick || !withinStartupWindow || !target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureCacheLoaded();
    markNotRunning();
    setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}. Startup Bungie sync skipped; click Sync from Bungie to refresh manually.`);
  }

  function installStartupSyncGuard() {
    document.removeEventListener('click', blockStartupAutoSync, true);
    document.addEventListener('click', blockStartupAutoSync, true);
    const button = document.getElementById('bungieImportV2Btn');
    if (button && button.dataset.cacheStartupGuard !== '4') {
      button.dataset.cacheStartupGuard = '4';
      button.addEventListener('click', blockStartupAutoSync, true);
    }
  }

  function exposeApi() {
    window.D2AACacheGuard = { saveRowsToCache, loadCache, getRows: () => cacheInfo().rows, getMeta: () => cacheInfo().meta, patchLoadRows };
  }

  function runPass() {
    installStartupSyncGuard();
    patchLoadRows();
    ensureCacheLoaded();
    exposeApi();
  }

  function run() {
    runPass();
    document.addEventListener('d2aa:bundle-loaded', runPass);
    window.addEventListener('load', runPass);
    [25, 75, 150, 300, 600, 1000, 1600, 2500, 4000].forEach((ms) => setTimeout(runPass, ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();