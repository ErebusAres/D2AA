(() => {
  let queued = false;

  function clampTier(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(5, n));
  }

  function normalizeTierValue(cell) {
    const text = String(cell && cell.textContent ? cell.textContent : '').trim();
    const diamondCount = text.split('').filter((char) => char === '♦').length;
    if (diamondCount) return clampTier(diamondCount);

    if (cell && cell.dataset && cell.dataset.visualTier) return clampTier(cell.dataset.visualTier);

    const textNumber = parseInt(text.replaceAll('T', '').replaceAll('t', '').trim(), 10);
    if (Number.isFinite(textNumber)) return clampTier(textNumber);

    return 1;
  }

  function patchTierDisplay(root = document) {
    const cells = root.querySelectorAll ? root.querySelectorAll('.armor-row .tier') : [];
    cells.forEach((cell) => {
      const tier = normalizeTierValue(cell);
      const visual = '♦'.repeat(tier);
      if (cell.textContent !== visual) cell.textContent = visual;
      if (!cell.title) cell.title = `Tier ${tier}`;
      if (cell.dataset.visualTier !== String(tier)) cell.dataset.visualTier = String(tier);
    });
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patchTierDisplay(document);
    });
  }

  function watchRows() {
    const rows = document.getElementById('rows');
    if (!rows) return;
    patchTierDisplay(document);
    const observer = new MutationObserver(schedulePatch);
    observer.observe(rows, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRows);
  else watchRows();
})();
