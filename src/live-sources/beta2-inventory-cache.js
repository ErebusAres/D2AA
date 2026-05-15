(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const LS_LIVE = 'd2aa_bungie_live_state_v1';
  const AUTH_KEY = 'd2aa_bungie_token_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const AUTO_LOAD_ON_START = true;
  const AUTO_REFRESH_ON_START = true;
  const AUTO_REFRESH_ON_FOCUS = true;
  const AUTO_REFRESH_ON_TIMER = true;
  const FRESH_AFTER_MS = 90 * 1000;
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const BACKGROUND_STALE_AFTER_MS = 12 * 60 * 1000;
  const FOCUS_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
  const TIMER_REFRESH_MS = 6 * 60 * 1000;
  const TIMER_JITTER_MS = 45 * 1000;
  const ERROR_BACKOFF_BASE_MS = 90 * 1000;
  const ERROR_BACKOFF_MAX_MS = 15 * 60 * 1000;
  const RUN_TIMEOUT_MS = 120 * 1000;
  let liveRefreshRunning = false;
  let liveTimer = null;
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

  function ageMs(iso) {
    const time = Date.parse(iso || '');
    return Number.isFinite(time) ? Date.now() - time : Infinity;
  }

  function getCachedRows() { return readJson(LS_ROWS, []); }
  function getCachedMeta() { return readJson(LS_META, null); }
  function getLiveState() { return readJson(LS_LIVE, { lastAttemptAt: '', lastSuccessAt: '', lastErrorAt: '', lastError: '', errorCount: 0, running: false }); }
  function saveLiveState(patch) { const next = { ...getLiveState(), ...patch }; writeJson(LS_LIVE, next); window.dispatchEvent(new CustomEvent('d2aa:cache-state', { detail: next })); return next; }
  function hasBungieAuth() { return Object.keys(readJson(AUTH_KEY, {})).length > 0; }
  function cacheIsFresh(meta = getCachedMeta()) { return Boolean(meta?.savedAt) && ageMs(meta.savedAt) <= FRESH_AFTER_MS; }
  function cacheIsStale(meta = getCachedMeta()) { return !meta?.savedAt || ageMs(meta.savedAt) > STALE_AFTER_MS; }
  function cacheIsBackgroundStale(meta = getCachedMeta()) { return !meta?.savedAt || ageMs(meta.savedAt) > BACKGROUND_STALE_AFTER_MS; }

  function nowMeta(rows, previousMeta = getCachedMeta()) {
    return {
      savedAt: new Date().toISOString(),
      previousSavedAt: previousMeta?.savedAt || '',
      count: Array.isArray(rows) ? rows.length : 0,
      version: 3,
      mode: 'automatic-semi-live',
      refreshPolicy: 'startup/focus/visibility/timer with cooldown and backoff'
    };
  }

  function formatWhen(iso) {
    if (!iso) return 'never';
    try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (_) { return 'unknown'; }
  }

  function relativeWhen(iso) {
    const ms = ageMs(iso);
    if (!Number.isFinite(ms)) return 'never';
    if (ms < 15000) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'less than 1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function backoffMs(state = getLiveState()) {
    const count = Math.max(0, Number(state.errorCount || 0));
    if (!count) return 0;
    return Math.min(ERROR_BACKOFF_MAX_MS, ERROR_BACKOFF_BASE_MS * Math.pow(2, count - 1));
  }

  function canRetryAfterError(state = getLiveState()) {
    if (!state.lastErrorAt || !state.errorCount) return true;
    return ageMs(state.lastErrorAt) >= backoffMs(state);
  }

  function saveCache(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    const cleaned = rows.map((row) => ({ ...row, RecentlyFound: Boolean(row.RecentlyFound), FromCache: false, CachedAt: undefined }));
    const okRows = writeJson(LS_ROWS, cleaned);
    const meta = nowMeta(cleaned);
    const okMeta = writeJson(LS_META, meta);
    liveRefreshRunning = false;
    saveLiveState({ lastSuccessAt: meta.savedAt, running: false, lastError: '', errorCount: 0 });
    updateCacheUi();
    scheduleLiveTimer();
    if (!okRows || !okMeta) setStatus('Inventory cache could not be saved. Browser storage may be full.', false);
  }

  function clearCache() {
    remove(LS_ROWS);
    remove(LS_META);
    remove(LS_LIVE);
    updateCacheUi();
    setStatus('Cached Bungie inventory cleared. The next Bungie refresh will rebuild it automatically.', false);
    scheduleLiveTimer();
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
    setStatus(`Loaded cached inventory: ${cacheRows.length} armor from ${formatWhen(meta?.savedAt)}. ${hasBungieAuth() ? 'Auto-refresh keeps it semi-live.' : 'Connect Bungie to refresh it.'}`, true);
    updateCacheUi();
    scheduleLiveTimer();
    return true;
  }

  function updateCacheUi() {
    const meta = getCachedMeta();
    const live = getLiveState();
    const sub = $('cacheInventorySub');
    if (sub) {
      if (meta?.count) {
        let stateText = 'fresh';
        if (live.running || liveRefreshRunning) stateText = 'refreshing';
        else if (cacheIsStale(meta)) stateText = 'refresh ready';
        sub.textContent = `${meta.count} armor • ${relativeWhen(meta.savedAt)} • ${stateText}`;
      } else {
        sub.textContent = 'Auto-loads after first Bungie sync';
      }
    }
    const clear = $('clearInventoryCacheBtn');
    if (clear) clear.disabled = !meta?.count;
    window.dispatchEvent(new CustomEvent('d2aa:cache-state', { detail: { meta, live } }));
  }

  function markRefreshFailed(reason, message) {
    liveRefreshRunning = false;
    const live = getLiveState();
    saveLiveState({ running: false, lastErrorAt: new Date().toISOString(), lastError: message || reason || 'Refresh failed', errorCount: Number(live.errorCount || 0) + 1 });
    updateCacheUi();
    scheduleLiveTimer();
  }

  function requestLiveRefresh(reason = 'auto', force = false) {
    const live = getLiveState();
    if (liveRefreshRunning || live.running) return false;
    if (!hasBungieAuth()) return false;
    if (!navigator.onLine) return false;
    if (!force && !canRetryAfterError(live)) return false;

    const meta = getCachedMeta();
    const hasCache = Boolean(meta?.count);
    const stale = cacheIsStale(meta);
    const bgStale = cacheIsBackgroundStale(meta);
    const cooldownActive = Date.now() - lastAutoRefreshAt < FOCUS_REFRESH_COOLDOWN_MS;

    if (!force && hasCache && cacheIsFresh(meta)) return false;
    if (!force && reason === 'timer' && hasCache && !bgStale) return false;
    if (!force && reason !== 'startup' && reason !== 'timer' && cooldownActive) return false;
    if (!force && hasCache && !stale && reason !== 'timer') return false;

    const button = $('bungieImportV2Btn');
    if (!button) return false;
    liveRefreshRunning = true;
    lastAutoRefreshAt = Date.now();
    saveLiveState({ running: true, lastAttemptAt: new Date().toISOString(), lastReason: reason });
    updateCacheUi();
    setStatus(hasCache ? `Using cached inventory while refreshing Bungie in the background (${reason})...` : 'No cache found. Syncing Bungie inventory...', false);
    setTimeout(() => button.click(), 250);
    setTimeout(() => {
      if (liveRefreshRunning) markRefreshFailed(reason, 'Refresh timed out');
    }, RUN_TIMEOUT_MS);
    return true;
  }

  function scheduleLiveTimer() {
    if (liveTimer) clearTimeout(liveTimer);
    if (!AUTO_REFRESH_ON_TIMER || !hasBungieAuth()) return;
    const meta = getCachedMeta();
    const live = getLiveState();
    const retryDelay = canRetryAfterError(live) ? 0 : Math.max(15000, backoffMs(live) - ageMs(live.lastErrorAt));
    const staleDelay = meta?.savedAt ? Math.max(30000, BACKGROUND_STALE_AFTER_MS - ageMs(meta.savedAt)) : 30000;
    const jitter = Math.floor(Math.random() * TIMER_JITTER_MS);
    const delay = Math.max(30000, Math.min(TIMER_REFRESH_MS + jitter, Math.max(retryDelay, staleDelay)));
    liveTimer = setTimeout(() => {
      if (!document.hidden) requestLiveRefresh('timer');
      scheduleLiveTimer();
    }, delay);
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
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && AUTO_REFRESH_ON_FOCUS) {
        requestLiveRefresh('visible');
        scheduleLiveTimer();
      }
    });
    window.addEventListener('storage', (event) => {
      if ([LS_ROWS, LS_META, LS_LIVE, AUTH_KEY].includes(event.key)) {
        updateCacheUi();
        scheduleLiveTimer();
      }
    });
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
    const live = getLiveState();
    if (live.running && ageMs(live.lastAttemptAt) > RUN_TIMEOUT_MS) saveLiveState({ running: false });
    if (AUTO_LOAD_ON_START && !hasCurrentRows && hasCache) {
      setTimeout(() => {
        const loaded = loadCache('startup');
        if (loaded && AUTO_REFRESH_ON_START) requestLiveRefresh('startup');
      }, 75);
    } else if (AUTO_REFRESH_ON_START && !hasCurrentRows && !hasCache && hasBungieAuth()) {
      setTimeout(() => requestLiveRefresh('startup', true), 250);
    }
    scheduleLiveTimer();
    setInterval(updateCacheUi, 30000);
  }

  window.D2AAInventoryCache = {
    ...(window.D2AAInventoryCache || {}),
    load: loadCache,
    clear: clearCache,
    refresh: () => requestLiveRefresh('manual', true),
    requestLiveRefresh,
    getRows: getCachedRows,
    getMeta: getCachedMeta,
    getLiveState,
    isFresh: cacheIsFresh,
    isStale: cacheIsStale,
    isBackgroundStale: cacheIsBackgroundStale
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();