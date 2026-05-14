(() => {
  const SLOT_LABELS = new Set(['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item']);

  function extractBandLabel(row) {
    const meta = row.querySelector('.item-meta')?.textContent || '';
    const clean = meta.replace(/\s+/g, ' ').trim();
    for (const label of SLOT_LABELS) {
      if (clean.startsWith(label)) return label;
    }
    return clean.split('•')[0]?.trim() || 'Armor';
  }

  function applyBanding() {
    const rows = [...document.querySelectorAll('#rows .armor-row')];
    let lastLabel = null;
    let band = -1;

    for (const row of rows) {
      const label = extractBandLabel(row);
      const isStart = label !== lastLabel;

      if (isStart) band += 1;

      row.classList.remove('band-a', 'band-b', 'band-start');
      row.classList.add(band % 2 === 0 ? 'band-a' : 'band-b');
      row.dataset.bandLabel = label;

      if (isStart) row.classList.add('band-start');
      lastLabel = label;
    }
  }

  const rowsHost = document.getElementById('rows');
  if (!rowsHost) return;

  const observer = new MutationObserver(() => requestAnimationFrame(applyBanding));
  observer.observe(rowsHost, { childList: true });

  document.addEventListener('DOMContentLoaded', applyBanding);
  requestAnimationFrame(applyBanding);
})();
