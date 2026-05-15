(() => {
  const LS_ROWS = 'd2aa_bungie_cached_rows_v1';
  const LS_META = 'd2aa_bungie_cached_meta_v1';
  const LS_LIVE = 'd2aa_bungie_live_state_v1';
  const CACHE_SOURCE = 'Bungie Cache';
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.warn('D2AA cache write failed', error); return false; } };
  const isCacheLabel = (label) => String(label || '').includes(CACHE_SOURCE);
  const isBungieRows = (rows, label) => /bungie/i.test(String(label || '')) || (rows || []).some((row) => row?.Source === 'Bungie');

  function emitCacheState() {
    window.dispatchEvent(new CustomEvent('d2aa:cache-state', {
      detail: {
        meta: readJson(LS_META, null),
        live: readJson(LS_LIVE, {})
      }
    }));
  }

  function saveRowsAsFresh(rows, reason = 'sync') {
    if (!Array.isArray(rows) || !rows.length) return false;
    const cleaned = rows.map((row) => ({ ...row, RecentlyFound: Boolean(row.RecentlyFound), FromCache: false, CachedAt: undefined }));
    const prev = readJson(LS_META, null);
    const now = new Date().toISOString();
    const meta = {
      savedAt: now,
      previousSavedAt: prev?.savedAt || '',
      count: cleaned.length,
      version: 4,
      mode: 'automatic-semi-live',
      reason,
      refreshPolicy: 'startup/focus/visibility/timer/manual with cooldown and backoff'
    };
    writeJson(LS_ROWS, cleaned);
    writeJson(LS_META, meta);
    writeJson(LS_LIVE, {
      ...readJson(LS_LIVE, {}),
      running: false,
      lastSuccessAt: now,
      lastError: '',
      lastErrorAt: '',
      errorCount: 0
    });
    emitCacheState();
    return true;
  }

  function currentBungieRows() {
    const state = window.D2AA?.getState?.();
    const rows = state?.allRows || [];
    return rows.filter((row) => row?.Source === 'Bungie' || row?.MembershipType || row?.ItemHash);
  }

  function patchLoadRows() {
    if (!window.D2AA || window.D2AA.__cacheTimestampFixPatched) return false;
    const original = window.D2AA.loadRows;
    window.D2AA.loadRows = (rows, label) => {
      const result = original(rows, label);
      if (isBungieRows(rows, label) && !isCacheLabel(label)) {
        saveRowsAsFresh(rows, 'loadRows');
      }
      return result;
    };
    window.D2AA.__cacheTimestampFixPatched = true;
    return true;
  }

  function watchStatus() {
    const status = document.getElementById('bungieStatus');
    if (!status || status.dataset.cacheTimestampFix === '1') return;
    status.dataset.cacheTimestampFix = '1';
    const maybeTouch = () => {
      const text = status.textContent || '';
      if (!/bungie sync complete|rendering \d+ armor items|armor items in/i.test(text)) return;
      const rows = currentBungieRows();
      if (rows.length) saveRowsAsFresh(rows, 'status-complete');
      else {
        const live = readJson(LS_LIVE, {});
        writeJson(LS_LIVE, { ...live, running: false });
        emitCacheState();
      }
    };
    new MutationObserver(maybeTouch).observe(status, { childList: true, characterData: true, subtree: true });
    maybeTouch();
  }

  function wait() {
    patchLoadRows();
    watchStatus();
    if (!window.D2AA || !document.getElementById('bungieStatus')) setTimeout(wait, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait);
  else wait();
})();
