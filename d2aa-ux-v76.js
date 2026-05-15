(() => {
  const ARMOR_STAT_KEYS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const num = (v) => Number(v || 0);
  const id = (v) => String(v || '').trim();
  const totalOf = (row) => ARMOR_STAT_KEYS.reduce((sum, key) => sum + num(row?.[key]), 0);
  const maxTierFor = (row) => String(row?.Rarity || '').trim().toLowerCase() === 'exotic' ? 2 : 5;
  const tierFor = (row) => {
    const total = num(row?.['Total (Base)']) || totalOf(row);
    if (String(row?.Rarity || '').trim().toLowerCase() === 'exotic') return total >= 63 ? 2 : 1;
    return total >= 75 ? 5 : total >= 74 ? 4 : total >= 73 ? 3 : total >= 72 ? 2 : 1;
  };
  const tierHtml = (tier, max) => `<span class="tier-filled">${'◆'.repeat(Math.max(0, Math.min(max, tier)))}</span><span class="tier-empty">${'◇'.repeat(Math.max(0, max - tier))}</span>`;
  const state = () => window.D2AA?.getState?.();
  const rowForCard = (card) => (state()?.visible || []).find(row => id(row.Id) === card.dataset.gridId);

  function patchGridCard(card) {
    const row = rowForCard(card);
    const cell = card.querySelector('.grid-slot-tier');
    if (!row || !cell) return;
    const tier = tierFor(row);
    const max = maxTierFor(row);
    cell.dataset.visualTier = String(tier);
    cell.dataset.tierMax = String(max);
    cell.title = `${row.Rarity || 'Armor'} tier ${tier}/${max} from base total ${num(row['Total (Base)']) || totalOf(row)}`;
    cell.innerHTML = tierHtml(tier, max);
  }

  function patchTableRow(rowEl) {
    const idx = Array.from(rowEl.parentElement?.children || []).indexOf(rowEl);
    const row = state()?.visible?.[idx];
    const cell = rowEl.querySelector('.tier');
    if (!row || !cell) return;
    const tier = tierFor(row);
    const max = maxTierFor(row);
    cell.dataset.visualTier = String(tier);
    cell.dataset.tierMax = String(max);
    cell.title = `${row.Rarity || 'Armor'} tier ${tier}/${max} from base total ${num(row['Total (Base)']) || totalOf(row)}`;
    cell.innerHTML = tierHtml(tier, max);
  }

  function patchRows() {
    document.querySelectorAll('body.grid-view .grid-card').forEach(patchGridCard);
    document.querySelectorAll('.armor-row:not(.grid-card)').forEach(patchTableRow);
  }

  function patchDataRows() {
    const s = state();
    if (!s?.rows) return;
    let changed = false;
    s.rows.forEach((row) => {
      const tier = tierFor(row);
      if (num(row.Tier) !== tier) { row.Tier = tier; changed = true; }
      row.TierMax = maxTierFor(row);
    });
    if (changed) {
      try { localStorage.setItem('d2aa_beta2_rows_v1', JSON.stringify(s.rows)); } catch (_) {}
    }
  }

  function run() {
    patchDataRows();
    patchRows();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.tierRarityObserver !== '1') {
      rows.dataset.tierRarityObserver = '1';
      new MutationObserver(() => requestAnimationFrame(() => { patchDataRows(); patchRows(); })).observe(rows, { childList: true, subtree: true });
    }
    const original = window.D2AA?.render;
    if (original && !window.D2AA.__tierRarityPatch) {
      window.D2AA.render = () => { patchDataRows(); original(); requestAnimationFrame(patchRows); };
      window.D2AA.__tierRarityPatch = true;
    }
    setTimeout(() => { patchDataRows(); patchRows(); }, 150);
    setTimeout(() => { patchDataRows(); patchRows(); }, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
