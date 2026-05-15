(() => {
  const READY_CLASS = 'd2aa-ready';
  const BOOT_CLASS = 'd2aa-booting';
  const PREBOOT_CLASS = 'd2aa-preboot';
  const LS_VIEW = 'd2aa_beta2_view_mode_v1';

  try {
    const view = localStorage.getItem(LS_VIEW) || 'grid';
    document.body.classList.toggle('grid-view', view !== 'table');
    document.body.classList.add('shell-enhanced');
  } catch (_) {
    document.body.classList.add('grid-view', 'shell-enhanced');
  }

  function hasStableFirstRender() {
    const rows = document.getElementById('rows');
    const gridMode = document.body.classList.contains('grid-view');
    const hasCards = Boolean(rows?.querySelector('.grid-card'));
    const hasTableRows = Boolean(rows?.querySelector('.armor-row'));
    const hasEmpty = Boolean(document.getElementById('empty'));
    const shellReady = Boolean(document.getElementById('d2aaTopShell'));
    if (!shellReady) return false;
    if (gridMode) return hasCards || hasEmpty || !hasTableRows;
    return true;
  }

  function release() {
    document.documentElement.classList.remove(PREBOOT_CLASS);
    document.body.classList.remove(BOOT_CLASS);
    document.body.classList.add(READY_CLASS);
  }

  function waitForStable(attempt = 0) {
    if (hasStableFirstRender() || attempt > 40) {
      requestAnimationFrame(() => requestAnimationFrame(release));
      return;
    }
    setTimeout(() => waitForStable(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForStable());
  } else {
    waitForStable();
  }

  window.addEventListener('load', () => setTimeout(release, 1800), { once: true });
})();
