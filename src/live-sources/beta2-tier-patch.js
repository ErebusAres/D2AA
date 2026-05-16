(() => {
  let queued = false;

  function rowMaxTier(row) {
    return String(row?.Rarity || row?.rarity || '').trim().toLowerCase() === 'exotic' ? 2 : 5;
  }

  function clampTier(value, max = 5) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(max, n));
  }

  function visibleRows() {
    return window.D2AA?.getState?.()?.visible || [];
  }

  function rowForCell(cell) {
    const rowEl = cell?.closest?.('.armor-row');
    if (!rowEl) return null;
    const index = [...document.querySelectorAll('.armor-row')].indexOf(rowEl);
    return index >= 0 ? visibleRows()[index] : null;
  }

  function normalizeTierValue(cell, row = null) {
    const max = rowMaxTier(row);
    const source = row?.GearTier || row?.Tier;
    if (source) return clampTier(source, max);

    const text = String(cell && cell.textContent ? cell.textContent : '').trim();
    const diamondCount = text.split('').filter((char) => char === '♦').length;
    if (diamondCount) return clampTier(diamondCount, max);

    if (cell && cell.dataset && cell.dataset.visualTier) return clampTier(cell.dataset.visualTier, max);

    const textNumber = parseInt(text.replaceAll('T', '').replaceAll('t', '').trim(), 10);
    if (Number.isFinite(textNumber)) return clampTier(textNumber, max);

    return 1;
  }

  function patchTierDisplay(root = document) {
    const cells = root.querySelectorAll ? root.querySelectorAll('.armor-row .tier') : [];
    cells.forEach((cell) => {
      const row = rowForCell(cell);
      const max = rowMaxTier(row);
      const tier = normalizeTierValue(cell, row);
      const visual = '♦'.repeat(tier);
      if (cell.textContent !== visual) cell.textContent = visual;
      cell.title = `Tier ${tier}/${max}${max === 2 ? ' • Exotic armor cap' : ''}`;
      if (cell.dataset.visualTier !== String(tier)) cell.dataset.visualTier = String(tier);
      if (cell.dataset.tierMax !== String(max)) cell.dataset.tierMax = String(max);
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

  function patchRender() {
    if (!window.D2AA || window.D2AA.__tierDisplayCapPatched) return false;
    const originalRender = window.D2AA.render;
    window.D2AA.render = (...args) => {
      const result = originalRender.apply(window.D2AA, args);
      schedulePatch();
      return result;
    };
    window.D2AA.__tierDisplayCapPatched = true;
    return true;
  }

  function watchRows() {
    const rows = document.getElementById('rows');
    if (!rows) return;
    patchRender();
    patchTierDisplay(document);
    const observer = new MutationObserver(schedulePatch);
    observer.observe(rows, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRows);
  else watchRows();
})();