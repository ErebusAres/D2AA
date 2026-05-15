(() => {
  const SLOT_ICONS = {
    Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg',
    Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg',
    'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg',
    'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg',
    'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg'
  };
  const normId = (v) => String(v || '').trim();
  const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
  const state = () => window.D2AA?.getState?.();
  const rowForCard = (card) => (state()?.visible || []).find((row) => normId(row.Id) === card?.dataset?.gridId);

  function upsertGroupBadges() {
    document.querySelectorAll('body.grid-view .grid-card').forEach((card) => {
      const row = rowForCard(card);
      if (!row) return;
      let badge = card.querySelector('.grid-group-badge');
      if (!row.Is_Dupe) { badge?.remove(); return; }
      const primary = card.querySelector('.grid-primary-row');
      const tier = card.querySelector('.grid-tier');
      if (!primary || !tier) return;
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'grid-group-badge';
        primary.insertBefore(badge, tier.nextSibling);
      }
      const slot = slotLabel(row.Type);
      const label = String(row.Dupe_Group || '').trim() || 'Group';
      const icon = SLOT_ICONS[slot] || '';
      badge.title = `${slot} duplicate group ${label}`;
      badge.innerHTML = `${icon ? `<span class="grid-group-badge-icon" style="mask-image:url('${icon}');-webkit-mask-image:url('${icon}')"></span>` : ''}<span>${label}</span>`;
    });
  }

  function run() {
    upsertGroupBadges();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.groupBadgeObserver !== '1') {
      rows.dataset.groupBadgeObserver = '1';
      new MutationObserver(() => setTimeout(upsertGroupBadges, 0)).observe(rows, { childList: true, subtree: true });
    }
    const originalRender = window.D2AA?.render;
    if (originalRender && !window.D2AA.__groupBadgePatch) {
      window.D2AA.render = () => { originalRender(); setTimeout(upsertGroupBadges, 0); };
      window.D2AA.__groupBadgePatch = true;
    }
    setTimeout(upsertGroupBadges, 200);
    setTimeout(upsertGroupBadges, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
