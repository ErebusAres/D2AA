(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const AUTH_KEY = 'd2aa_bungie_token_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const AUTO_LOAD_ON_START = true;
  const AUTO_REFRESH_ON_START = true;
  const AUTO_REFRESH_ON_FOCUS = true;
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const FOCUS_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
  let liveRefreshRunning = false;
  let lastAutoRefreshAt = 0;

  const $ = (id) => document.getElementById(id);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.warn('D2AA cache write failed', error); return false; } };
  const remove = (key) => { try { localStorage.removeItem(key); } catch (_) {} };
  const isBungieRows = (rows, label) => /bungie/i.test(String(label || '')) || (rows || []).some((row) => row?.Source === 'Bungie');
  const isCacheLabel = (label) => String(label || '').includes(CACHE_SOURCE);

  function setStatus(message, ready = false) {
    const status = $('bungieStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-ready', ready);
    status.classList.toggle('is-missing', !ready);
  }

  function nowMeta(rows) {
    return { savedAt: new Date().toISOString(), count: Array.isArray(rows) ? rows.length : 0, version: 2, mode: 'automatic-semi-live' };
  }

  function formatWhen(iso) {
    if (!iso) return 'never';
    try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (_) { return 'unknown'; }
  }

  function ageMs(iso) {
    const time = Date.parse(iso || '');
    return Number.isFinite(time) ? Date.now() - time : Infinity;
  }

  function getCachedRows() { return readJson(LS_ROWS, []); }
  function getCachedMeta() { return readJson(LS_META, null); }
  function hasBungieAuth() { return Object.keys(readJson(AUTH_KEY, {})).length > 0; }
  function cacheIsStale(meta = getCachedMeta()) { return !meta?.savedAt || ageMs(meta.savedAt) > STALE_AFTER_MS; }

  function saveCache(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    const cleaned = rows.map((row) => ({ ...row, RecentlyFound: Boolean(row.RecentlyFound), FromCache: false, CachedAt: undefined }));
    const okRows = writeJson(LS_ROWS, cleaned);
    const meta = nowMeta(cleaned);
    const okMeta = writeJson(LS_META, meta);
    liveRefreshRunning = false;
    updateCacheUi();
    if (!okRows || !okMeta) setStatus('Inventory cache could not be saved. Browser storage may be full.', false);
  }

  function clearCache() {
    remove(LS_ROWS);
    remove(LS_META);
    updateCacheUi();
    setStatus('Cached Bungie inventory cleared. The next Bungie refresh will rebuild it automatically.', false);
  }

  function loadCache(reason = 'auto') {
    const rows = getCachedRows();
    const meta = getCachedMeta();
    if (!rows.length) {
      setStatus('No cached Bungie inventory found. Sync from Bungie once to create the automatic cache.', false);
      return false;
    }
    const cacheRows = rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true }));
    window.D2AA?.loadRows?.(cacheRows, `${CACHE_SOURCE} • ${cacheRows.length} armor • saved ${formatWhen(meta?.savedAt)}`);
    setStatus(`Loaded cached inventory: ${cacheRows.length} armor from ${formatWhen(meta?.savedAt)}. ${hasBungieAuth() ? 'Checking Bungie when needed for fresh data.' : 'Connect Bungie to refresh it.'}`, true);
    updateCacheUi();
    return true;
  }

  function updateCacheUi() {
    const meta = getCachedMeta();
    const sub = $('cacheInventorySub');
    if (sub) {
      if (meta?.count) {
        const staleText = cacheIsStale(meta) ? ' • refresh ready' : ' • fresh';
        sub.textContent = `${meta.count} armor • ${formatWhen(meta.savedAt)}${staleText}`;
      } else {
        sub.textContent = 'Auto-loads after first Bungie sync';
      }
    }
    const clear = $('clearInventoryCacheBtn');
    if (clear) clear.disabled = !meta?.count;
  }

  function requestLiveRefresh(reason = 'auto', force = false) {
    if (liveRefreshRunning) return false;
    if (!hasBungieAuth()) return false;
    const meta = getCachedMeta();
    const hasCache = Boolean(meta?.count);
    const stale = cacheIsStale(meta);
    const cooldownActive = Date.now() - lastAutoRefreshAt < FOCUS_REFRESH_COOLDOWN_MS;
    if (!force && hasCache && !stale) return false;
    if (!force && reason !== 'startup' && cooldownActive) return false;
    const button = $('bungieImportV2Btn');
    if (!button) return false;
    liveRefreshRunning = true;
    lastAutoRefreshAt = Date.now();
    setStatus(hasCache ? 'Using cached inventory while refreshing Bungie in the background...' : 'No cache found. Syncing Bungie inventory...', false);
    setTimeout(() => button.click(), 250);
    setTimeout(() => { liveRefreshRunning = false; }, 120000);
    return true;
  }

  function ensureCacheButtons() {
    if ($('loadInventoryCacheBtn')) return;
    const actions = $('actionsTitle')?.closest('.control-block');
    if (!actions) return;
    const load = document.createElement('button');
    load.id = 'loadInventoryCacheBtn';
    load.className = 'action-card action-card--bungie';
    load.type = 'button';
    load.innerHTML = `<span class="action-icon" aria-hidden="true">◷</span><span><span class="action-title">Cached Inventory</span><span class="action-sub" id="cacheInventorySub">Auto-loads after first Bungie sync</span></span>`;
    load.title = 'Loads the cached inventory immediately. The site also does this automatically on startup.';
    load.addEventListener('click', () => loadCache('button'));
    const clear = document.createElement('button');
    clear.id = 'clearInventoryCacheBtn';
    clear.className = 'action-card action-card--danger';
    clear.type = 'button';
    clear.innerHTML = `<span class="action-icon" aria-hidden="true">⌫</span><span><span class="action-title">Clear Inventory Cache</span><span class="action-sub">Next refresh rebuilds automatically</span></span>`;
    clear.addEventListener('click', clearCache);
    actions.appendChild(load);
    actions.appendChild(clear);
    updateCacheUi();
  }

  function patchD2AA() {
    if (!window.D2AA || window.D2AA.__inventoryCachePatched) return;
    const originalLoadRows = window.D2AA.loadRows;
    window.D2AA.loadRows = (rows, label) => {
      const result = originalLoadRows(rows, label);
      if (Array.isArray(rows) && rows.length && isBungieRows(rows, label) && !isCacheLabel(label)) saveCache(rows);
      return result;
    };
    window.D2AA.__inventoryCachePatched = true;
  }

  function setupSemiLiveHooks() {
    if (window.D2AAInventoryCache?.__hooksReady) return;
    window.addEventListener('online', () => requestLiveRefresh('online'));
    window.addEventListener('focus', () => { if (AUTO_REFRESH_ON_FOCUS) requestLiveRefresh('focus'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && AUTO_REFRESH_ON_FOCUS) requestLiveRefresh('visible'); });
    window.D2AAInventoryCache = window.D2AAInventoryCache || {};
    window.D2AAInventoryCache.__hooksReady = true;
  }

  function init() {
    ensureCacheButtons();
    patchD2AA();
    setupSemiLiveHooks();
    updateCacheUi();
    const hasCurrentRows = window.D2AA?.getState?.()?.allRows?.length;
    const hasCache = getCachedRows().length;
    if (AUTO_LOAD_ON_START && !hasCurrentRows && hasCache) {
      setTimeout(() => {
        const loaded = loadCache('startup');
        if (loaded && AUTO_REFRESH_ON_START) requestLiveRefresh('startup');
      }, 75);
    } else if (AUTO_REFRESH_ON_START && !hasCurrentRows && !hasCache && hasBungieAuth()) {
      setTimeout(() => requestLiveRefresh('startup', true), 250);
    }
  }

  window.D2AAInventoryCache = {
    ...(window.D2AAInventoryCache || {}),
    load: loadCache,
    clear: clearCache,
    refresh: () => requestLiveRefresh('manual', true),
    getRows: getCachedRows,
    getMeta: getCachedMeta,
    isStale: cacheIsStale
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();