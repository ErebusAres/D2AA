(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const LS_LIVE = 'd2aa_bungie_live_state_v1';
  const LS_TOKEN = 'd2aa_bungie_token_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const BACKGROUND_REFRESH_MS = 90 * 1000;
  const INITIAL_REFRESH_DELAY_MS = 2500;
  let patched = false;
  let refreshTimer = null;
  let refreshRunning = false;
  let lastAutoRefreshAt = 0;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn('D2AA cache write failed', error); return false; }
  };
  const tokenIsValid = (token = readJson(LS_TOKEN, {})) => Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60);

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
  function setStatus(message, ready = true) {
    const status = document.getElementById('bungieStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-ready', ready);
    status.classList.toggle('is-missing', !ready);
  }
  function isCacheLabel(label) { return String(label || '').includes(CACHE_SOURCE); }
  function isBungieRows(rows, label) {
    if (!Array.isArray(rows) || !rows.length) return false;
    if (/bungie/i.test(String(label || '')) && !isCacheLabel(label)) return true;
    return rows.some((row) => String(row?.Source || '').toLowerCase() === 'bungie' && !row?.FromCache);
  }
  function cleanRowsForCache(rows) {
    return rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: false, CachedAt: undefined }));
  }
  function saveRowsToCache(rows, label = '') {
    if (!isBungieRows(rows, label)) return false;
    const cleaned = cleanRowsForCache(rows);
    const previousRows = cacheInfo().rows;
    const previousIds = new Set(previousRows.map((row) => String(row.Id || '')));
    const moved = cleaned.filter((row) => {
      const old = previousRows.find((cached) => String(cached.Id || '') === String(row.Id || ''));
      return old && (String(old.OwnerCharacterId || '') !== String(row.OwnerCharacterId || '') || Boolean(old.IsInVault) !== Boolean(row.IsInVault) || Boolean(old.IsEquipped) !== Boolean(row.IsEquipped));
    }).length;
    const newCount = cleaned.filter((row) => !previousIds.has(String(row.Id || ''))).length;
    const meta = { savedAt: new Date().toISOString(), count: cleaned.length, version: 5, mode: 'semi-live-cache-controller', label: String(label || ''), newCount, moved };
    const okRows = writeJson(LS_ROWS, cleaned);
    const okMeta = writeJson(LS_META, meta);
    writeJson(LS_LIVE, { running: false, lastSuccessAt: meta.savedAt, lastReason: 'saved-cache-controller', lastError: '', errorCount: 0 });
    if (okRows && okMeta) setStatus(`Saved Bungie cache: ${cleaned.length} armor. New: ${newCount}. Moved/changed: ${moved}.`, true);
    return okRows && okMeta;
  }
  function normalizeCacheRows(rows) { return rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true })); }
  function loadCache(reason = 'startup') {
    const info = cacheInfo();
    if (!info.hasRows || !window.D2AA?.loadRows) return false;
    window.D2AA.loadRows(normalizeCacheRows(info.rows), `${CACHE_SOURCE} • ${info.rows.length} armor • saved ${formatWhen(info.meta?.savedAt)} • ${reason}`);
    setStatus(`Loaded cached inventory: ${info.rows.length} armor from ${formatWhen(info.meta?.savedAt)}.`, true);
    return true;
  }
  function patchLoadRows() {
    if (patched || !window.D2AA?.loadRows) return false;
    const original = window.D2AA.loadRows.bind(window.D2AA);
    window.D2AA.loadRows = (rows, label) => {
      const result = original(rows, label);
      saveRowsToCache(rows, label);
      return result;
    };
    patched = true;
    window.D2AA.__cacheControllerPatched = true;
    return true;
  }
  function rowsLoaded() { return Number(window.D2AA?.getState?.()?.allRows?.length || 0) > 0; }
  function importArmorFn() { return window.D2AA_BUNGIE_V2?.importArmorV2 || window.D2AA_BUNGIE?.importArmor; }
  function clickSyncButton(reason) {
    const btn = document.getElementById('bungieImportV2Btn');
    if (!btn) return false;
    btn.dataset.d2aaAutoSyncReason = reason;
    btn.click();
    setTimeout(() => { delete btn.dataset.d2aaAutoSyncReason; }, 1000);
    return true;
  }
  async function runSync(reason = 'auto') {
    if (refreshRunning || !tokenIsValid()) return false;
    refreshRunning = true;
    lastAutoRefreshAt = Date.now();
    writeJson(LS_LIVE, { running: true, startedAt: new Date().toISOString(), lastReason: reason });
    try {
      const fn = importArmorFn();
      if (typeof fn === 'function') await fn();
      else if (!clickSyncButton(reason)) return false;
      return true;
    } catch (error) {
      console.error('D2AA semi-live sync failed', error);
      const previous = readJson(LS_LIVE, {});
      writeJson(LS_LIVE, { ...previous, running: false, lastError: error.message || String(error), errorCount: Number(previous.errorCount || 0) + 1 });
      setStatus(error.message || String(error), false);
      return false;
    } finally {
      refreshRunning = false;
    }
  }
  function scheduleBackgroundRefresh(delay = BACKGROUND_REFRESH_MS) {
    clearTimeout(refreshTimer);
    if (!tokenIsValid()) return;
    refreshTimer = setTimeout(async () => {
      if (document.hidden) { scheduleBackgroundRefresh(30000); return; }
      await runSync('semi-live-refresh');
      scheduleBackgroundRefresh(BACKGROUND_REFRESH_MS);
    }, delay);
  }
  function startController() {
    patchLoadRows();
    const hasRows = rowsLoaded();
    const cached = cacheInfo();
    if (cached.hasRows && !hasRows) {
      loadCache('startup');
      if (tokenIsValid()) scheduleBackgroundRefresh(INITIAL_REFRESH_DELAY_MS);
      return;
    }
    if (!cached.hasRows && !hasRows && tokenIsValid()) {
      setStatus('No cached inventory found. Starting Bungie sync...', false);
      runSync('startup-no-cache').then(() => scheduleBackgroundRefresh(BACKGROUND_REFRESH_MS));
      return;
    }
    if (tokenIsValid()) scheduleBackgroundRefresh(BACKGROUND_REFRESH_MS);
  }
  function manualClickGuard(event) {
    const target = event.target?.closest?.('#bungieImportV2Btn');
    if (!target) return;
    if (target.dataset.d2aaAutoSyncReason) return;
    // A trusted/manual click should always sync now; this just makes the status explicit.
    setStatus('Manual Bungie sync started...', false);
  }
  function runPass() {
    document.removeEventListener('click', manualClickGuard, true);
    document.addEventListener('click', manualClickGuard, true);
    startController();
    window.D2AACacheGuard = { loadCache, saveRowsToCache, getRows: () => cacheInfo().rows, getMeta: () => cacheInfo().meta, runSync, scheduleBackgroundRefresh };
  }
  function boot() {
    runPass();
    document.addEventListener('d2aa:bundle-loaded', () => setTimeout(runPass, 0));
    window.addEventListener('load', () => setTimeout(runPass, 0));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && tokenIsValid() && Date.now() - lastAutoRefreshAt > 45000) runSync('focus-refresh').then(() => scheduleBackgroundRefresh(BACKGROUND_REFRESH_MS));
    });
    [100, 300, 800, 1600, 3000].forEach((ms) => setTimeout(runPass, ms));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
