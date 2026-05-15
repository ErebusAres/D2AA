(() => {
  const num = (v) => Number(v || 0);
  const id = (v) => String(v || '').trim();
  const tierFor = (row) => {
    const explicit = num(row?.GearTier || row?.Tier);
    return explicit >= 1 && explicit <= 5 ? explicit : 1;
  };
  const tierHtml = (tier, max = 5) => `<span class="tier-filled">${'◆'.repeat(Math.max(0, Math.min(max, tier)))}</span><span class="tier-empty">${'◇'.repeat(Math.max(0, max - tier))}</span>`;
  const state = () => window.D2AA?.getState?.();
  const rowForCard = (card) => (state()?.visible || []).find(row => id(row.Id) === card.dataset.gridId);

  function patchGridCard(card) {
    const row = rowForCard(card);
    const cell = card.querySelector('.grid-slot-tier');
    if (!row || !cell) return;
    const tier = tierFor(row);
    const max = num(row.TierMax) || 5;
    cell.dataset.visualTier = String(tier);
    cell.dataset.tierMax = String(max);
    cell.title = `${row.Rarity || 'Armor'} gear tier ${tier}/${max}${row.TierSource ? ` • ${row.TierSource}` : ''}`;
    cell.innerHTML = tierHtml(tier, max);
  }

  function patchTableRow(rowEl) {
    const idx = Array.from(rowEl.parentElement?.children || []).indexOf(rowEl);
    const row = state()?.visible?.[idx];
    const cell = rowEl.querySelector('.tier');
    if (!row || !cell) return;
    const tier = tierFor(row);
    const max = num(row.TierMax) || 5;
    cell.dataset.visualTier = String(tier);
    cell.dataset.tierMax = String(max);
    cell.title = `${row.Rarity || 'Armor'} gear tier ${tier}/${max}${row.TierSource ? ` • ${row.TierSource}` : ''}`;
    cell.innerHTML = tierHtml(tier, max);
  }

  function patchRows() {
    document.querySelectorAll('body.grid-view .grid-card').forEach(patchGridCard);
    document.querySelectorAll('.armor-row:not(.grid-card)').forEach(patchTableRow);
  }

  function normalizeCachedRows() {
    const s = state();
    if (!s?.rows) return;
    s.rows.forEach((row) => {
      const tier = tierFor(row);
      row.Tier = tier;
      row.GearTier = tier;
      row.TierMax = 5;
      if (!row.TierSource) row.TierSource = row.Source === 'Bungie' ? 'BungieOrLegacyCache' : 'CSV';
    });
  }

  function run() {
    normalizeCachedRows();
    patchRows();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.tierRarityObserver !== '1') {
      rows.dataset.tierRarityObserver = '1';
      new MutationObserver(() => requestAnimationFrame(() => { normalizeCachedRows(); patchRows(); })).observe(rows, { childList: true, subtree: true });
    }
    const original = window.D2AA?.render;
    if (original && !window.D2AA.__tierRarityPatch) {
      window.D2AA.render = () => { normalizeCachedRows(); original(); requestAnimationFrame(patchRows); };
      window.D2AA.__tierRarityPatch = true;
    }
    setTimeout(() => { normalizeCachedRows(); patchRows(); }, 150);
    setTimeout(() => { normalizeCachedRows(); patchRows(); }, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
