(() => {
  const SLOT_LABELS = new Set(['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item']);

  function extractSlotLabel(row) {
    const meta = row.querySelector('.item-meta')?.textContent || '';
    const clean = meta.replace(/\s+/g, ' ').trim();
    for (const label of SLOT_LABELS) {
      if (clean.startsWith(label)) return label;
    }
    return clean.split('•')[0]?.trim() || 'Armor';
  }

  function extractGroupLabel(row) {
    const groupText = row.querySelector('.group-badge, .ok-badge')?.textContent || '';
    const normalized = groupText.replace(/Copied|Failed|⚠️|✅/g, '').replace(/\s+/g, '').trim();
    return normalized || 'X';
  }

  function bandKey(row) {
    const slot = extractSlotLabel(row);
    const group = extractGroupLabel(row);
    const isDupe = group !== 'X';
    return isDupe ? `${slot} • Group ${group}` : `${slot} • Ungrouped`;
  }

  function bandMode(row) {
    return extractGroupLabel(row) === 'X' ? 'solo' : 'dupe';
  }

  function applyBanding() {
    const rows = [...document.querySelectorAll('#rows .armor-row')];
    const seen = new Map();
    let lastKey = null;
    let dupeBandIndex = -1;
    let soloBandIndex = -1;

    for (const row of rows) {
      const key = bandKey(row);
      const mode = bandMode(row);
      const isStart = key !== lastKey;

      if (!seen.has(key)) {
        if (mode === 'dupe') {
          dupeBandIndex += 1;
          seen.set(key, { index: dupeBandIndex, mode });
        } else {
          soloBandIndex += 1;
          seen.set(key, { index: soloBandIndex, mode });
        }
      }

      const band = seen.get(key);
      row.classList.remove('band-a', 'band-b', 'band-c', 'band-d', 'band-solo', 'band-start');

      if (band.mode === 'solo') {
        row.classList.add('band-solo', band.index % 2 === 0 ? 'band-a' : 'band-b');
      } else {
        row.classList.add(['band-a', 'band-b', 'band-c', 'band-d'][band.index % 4]);
      }

      row.dataset.bandLabel = key;
      if (isStart) row.classList.add('band-start');
      lastKey = key;
    }
  }

  const rowsHost = document.getElementById('rows');
  if (!rowsHost) return;

  const observer = new MutationObserver(() => requestAnimationFrame(applyBanding));
  observer.observe(rowsHost, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', applyBanding);
  requestAnimationFrame(applyBanding);
})();
