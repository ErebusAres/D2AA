(() => {
  const FAST_SYNC_WARNING_MS = 12000;
  const HANG_WARNING_MS = 30000;

  function status(message, ready = false) {
    const el = document.getElementById('bungieStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-ready', ready);
    el.classList.toggle('is-missing', !ready);
  }

  const btn = document.getElementById('bungieImportBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    window.clearTimeout(window.__d2aaSyncWarnTimer);
    window.clearTimeout(window.__d2aaSyncHangTimer);

    window.__d2aaSyncWarnTimer = window.setTimeout(() => {
      status('Still syncing: downloading/parsing Bungie manifest data. First sync can be slow after cache clears.', false);
    }, FAST_SYNC_WARNING_MS);

    window.__d2aaSyncHangTimer = window.setTimeout(() => {
      status('Sync is taking too long. This is likely the full Destiny item manifest download. Refresh and try again, or use DIM CSV until the slim sync path is added.', false);
    }, HANG_WARNING_MS);
  }, true);

  const originalLoadRows = window.D2AA?.loadRows;
  if (typeof originalLoadRows === 'function') {
    window.D2AA.loadRows = function patchedLoadRows(...args) {
      window.clearTimeout(window.__d2aaSyncWarnTimer);
      window.clearTimeout(window.__d2aaSyncHangTimer);
      return originalLoadRows.apply(this, args);
    };
  }
})();
