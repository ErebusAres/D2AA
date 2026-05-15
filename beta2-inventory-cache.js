(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const AUTO_LOAD_ON_START = true;

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
    return {
      savedAt: new Date().toISOString(),
      count: Array.isArray(rows) ? rows.length : 0,
      version: 1
    };
  }

  function formatWhen(iso) {
    if (!iso) return 'never';
    try {
      return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return 'unknown';
    }
  }

  function getCachedRows() { return readJson(LS_ROWS, []); }
  function getCachedMeta() { return readJson(LS_META, null); }

  function saveCache(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    const cleaned = rows.map((row) => ({ ...row, RecentlyFound: Boolean(row.RecentlyFound), CachedAt: undefined }));
    const okRows = writeJson(LS_ROWS, cleaned);
    const meta = nowMeta(cleaned);
    const okMeta = writeJson(LS_META, meta);
    updateCacheUi();
    if (!okRows || !okMeta) setStatus('Inventory cache could not be saved. Browser storage may be full.', false);
  }

  function clearCache() {
    remove(LS_ROWS);
    remove(LS_META);
    updateCacheUi();
    setStatus('Cached Bungie inventory cleared. Use Sync from Bungie to rebuild it.', false);
  }

  function loadCache(reason = 'manual') {
    const rows = getCachedRows();
    const meta = getCachedMeta();
    if (!rows.length) {
      setStatus('No cached Bungie inventory found. Run Sync from Bungie once first.', false);
      return false;
    }
    const cacheRows = rows.map((row) => ({ ...row, Source: row.Source || 'Bungie', FromCache: true }));
    window.D2AA?.loadRows?.(cacheRows, `${CACHE_SOURCE} • ${cacheRows.length} armor • saved ${formatWhen(meta?.savedAt)}`);
    setStatus(`Loaded cached inventory: ${cacheRows.length} armor from ${formatWhen(meta?.savedAt)}. Refresh Bungie when you want a live update.`, true);
    updateCacheUi();
    return true;
  }

  function updateCacheUi() {
    const meta = getCachedMeta();
    const sub = $('cacheInventorySub');
    if (sub) sub.textContent = meta?.count ? `${meta.count} armor • ${formatWhen(meta.savedAt)}` : 'No cached inventory yet';
    const clear = $('clearInventoryCacheBtn');
    if (clear) clear.disabled = !meta?.count;
  }

  function ensureCacheButtons() {
    if ($('loadInventoryCacheBtn')) return;
    const actions = $('actionsTitle')?.closest('.control-block');
    if (!actions) return;

    const load = document.createElement('button');
    load.id = 'loadInventoryCacheBtn';
    load.className = 'action-card action-card--bungie';
    load.type = 'button';
    load.innerHTML = `<span class="action-icon" aria-hidden="true">◷</span><span><span class="action-title">Load Cached Inventory</span><span class="action-sub" id="cacheInventorySub">No cached inventory yet</span></span>`;
    load.addEventListener('click', () => loadCache('button'));

    const clear = document.createElement('button');
    clear.id = 'clearInventoryCacheBtn';
    clear.className = 'action-card action-card--danger';
    clear.type = 'button';
    clear.innerHTML = `<span class="action-icon" aria-hidden="true">⌫</span><span><span class="action-title">Clear Inventory Cache</span><span class="action-sub">Does not disconnect Bungie</span></span>`;
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
      if (Array.isArray(rows) && rows.length && isBungieRows(rows, label) && !isCacheLabel(label)) {
        saveCache(rows);
      }
      return result;
    };

    window.D2AA.__inventoryCachePatched = true;
  }

  function init() {
    ensureCacheButtons();
    patchD2AA();
    updateCacheUi();

    if (AUTO_LOAD_ON_START) {
      const hasCurrentRows = window.D2AA?.getState?.()?.allRows?.length;
      if (!hasCurrentRows && getCachedRows().length) {
        setTimeout(() => loadCache('startup'), 75);
      }
    }
  }

  window.D2AAInventoryCache = { load: loadCache, clear: clearCache, getRows: getCachedRows, getMeta: getCachedMeta };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
