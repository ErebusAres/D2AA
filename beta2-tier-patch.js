(() => {
  function normalizeTierValue(raw) {
    const parsed = Number(String(raw || '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(5, parsed));
  }

  function patchTierDisplay(root = document) {
    const cells = root.querySelectorAll?.('.armor-row .tier') || [];
    cells.forEach((cell) => {
      const tier = normalizeTierValue(cell.textContent);
      cell.textContent = '♦'.repeat(tier);
      cell.title = cell.title || `Tier ${tier}`;
      cell.dataset.visualTier = String(tier);
    });
  }

  function watchRows() {
    const rows = document.getElementById('rows');
    if (!rows) return;
    patchTierDisplay(document);
    const observer = new MutationObserver(() => patchTierDisplay(document));
    observer.observe(rows, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRows);
  else watchRows();
})();
