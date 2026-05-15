(() => {
  const STAT_ORDER = [
    'Health (Base)', 'Melee (Base)', 'Grenade (Base)',
    'Super (Base)', 'Class (Base)', 'Weapons (Base)'
  ];
  const STAT_ICONS = {
    'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
    'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
    'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
    'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
    'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
    'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
  };
  const statClass = (v) => { const n = Number(v || 0); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const num = (v) => Number(v || 0);
  const id = (v) => String(v || '').trim();
  const state = () => window.D2AA?.getState?.();
  const rowFor = (card) => (state()?.visible || []).find(row => id(row.Id) === card.dataset.gridId);
  const tierDiamonds = (row) => { const t = Math.max(0, Math.min(5, num(row.Tier))); return `${'◆'.repeat(t)}${'◇'.repeat(5 - t)}`; };

  function rebuildCard(card) {
    const row = rowFor(card);
    const body = card.querySelector('.grid-body');
    if (!row || !body || body.dataset.slotGrid === '1') return;
    const aag = card.querySelector('.grid-aag-badge');
    const aagHtml = aag ? aag.outerHTML : '<span class="grid-aag-badge" title="No archetype">—</span>';
    const stats = STAT_ORDER.map((stat) => {
      const label = stat.replace(' (Base)', '');
      const val = num(row[stat]);
      return `<div class="grid-slot-stat grid-stat ${statClass(val)}" title="${esc(label)}: ${val}"><img src="${STAT_ICONS[stat]}" alt="${esc(label)}" title="${esc(label)}" loading="lazy"><span>${val}</span></div>`;
    }).join('');
    body.innerHTML = `<div class="grid-slot-total grid-total" title="Base stat total">${num(row['Total (Base)'])}</div><div class="grid-slot-tier grid-tier" title="Tier ${num(row.Tier)}">${tierDiamonds(row)}</div><div class="grid-slot-aag">${aagHtml}</div>${stats}`;
    body.dataset.slotGrid = '1';
  }

  function rebuildAll() {
    document.querySelectorAll('body.grid-view .grid-card').forEach(rebuildCard);
  }

  function run() {
    rebuildAll();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.slotGridObserver !== '1') {
      rows.dataset.slotGridObserver = '1';
      new MutationObserver(() => setTimeout(rebuildAll, 0)).observe(rows, { childList: true, subtree: false });
    }
    const original = window.D2AA?.render;
    if (original && !window.D2AA.__slotGridPatch) {
      window.D2AA.render = () => { original(); setTimeout(rebuildAll, 0); };
      window.D2AA.__slotGridPatch = true;
    }
    setTimeout(rebuildAll, 150);
    setTimeout(rebuildAll, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
