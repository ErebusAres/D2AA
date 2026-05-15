(() => {
  const SLOT_ICONS = {
    Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg',
    Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg',
    'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg',
    'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg',
    'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg'
  };
  const id = (v) => String(v || '').trim();
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
  const state = () => window.D2AA?.getState?.();
  const rowFor = (card) => (state()?.visible || []).find(row => id(row.Id) === card.dataset.gridId);

  function fixGroupBadges() {
    document.querySelectorAll('body.grid-view .grid-card').forEach((card) => {
      const row = rowFor(card);
      if (!row) return;
      card.querySelectorAll('.grid-body .grid-group-badge, .grid-primary-row .grid-group-badge').forEach(el => el.remove());
      let badge = Array.from(card.children).find(el => el.classList?.contains('grid-group-badge'));
      if (!row.Is_Dupe) { badge?.remove(); return; }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'grid-group-badge';
        card.appendChild(badge);
      }
      const slot = slotLabel(row.Type);
      const label = id(row.Dupe_Group) || 'G';
      badge.title = `${slot} duplicate group ${label}`;
      badge.textContent = label;
      card.classList.add('is-dupe');
    });
  }

  function run() {
    fixGroupBadges();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.groupCornerObserver !== '1') {
      rows.dataset.groupCornerObserver = '1';
      new MutationObserver(() => setTimeout(fixGroupBadges, 0)).observe(rows, { childList: true, subtree: true });
    }
    const original = window.D2AA?.render;
    if (original && !window.D2AA.__groupCornerPatch) {
      window.D2AA.render = () => { original(); setTimeout(fixGroupBadges, 0); };
      window.D2AA.__groupCornerPatch = true;
    }
    setTimeout(fixGroupBadges, 150);
    setTimeout(fixGroupBadges, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
