(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const ARCHETYPES = {
    bulwark: { icon: '🛡️', label: 'Bulwark', desc: 'Health-focused armor roll' },
    brawler: { icon: '✊', label: 'Brawler', desc: 'Melee-focused armor roll' },
    grenadier: { icon: '💣', label: 'Grenadier', desc: 'Grenade-focused armor roll' },
    specialist: { icon: '✨', label: 'Specialist', desc: 'Super-focused armor roll' },
    paragon: { icon: '◇', label: 'Paragon', desc: 'Class ability-focused armor roll' },
    gunner: { icon: '🎯', label: 'Gunner', desc: 'Weapons-focused armor roll' },
    balanced: { icon: '⚖️', label: 'Balanced', desc: 'Evenly distributed armor roll' }
  };
  const STAT_TO_ARCHETYPE = {
    'Health (Base)': 'bulwark',
    'Melee (Base)': 'brawler',
    'Grenade (Base)': 'grenadier',
    'Super (Base)': 'specialist',
    'Class (Base)': 'paragon',
    'Weapons (Base)': 'gunner'
  };
  const normId = (v) => String(v || '').trim();
  const num = (v) => Number(v || 0);
  const getState = () => window.D2AA?.getState?.();
  const normalize = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  function explicitArchetype(row) {
    const raw = [
      row.Archetype,
      row.AAG,
      row.AAGTag,
      row['AAG Tag'],
      row.Role,
      row.Build,
      row.Focus,
      row['Armor Focus'],
      row.__raw?.Archetype,
      row.__raw?.AAG,
      row.__raw?.['AAG Tag'],
      row.__raw?.Role,
      row.__raw?.Focus
    ].filter(Boolean).join(' ');
    const value = normalize(raw);
    if (!value) return '';
    for (const key of Object.keys(ARCHETYPES)) if (value.includes(key)) return key;
    if (value.includes('weapon')) return 'gunner';
    if (value.includes('grenade') || value.includes('discipline')) return 'grenadier';
    if (value.includes('melee') || value.includes('strength')) return 'brawler';
    if (value.includes('health') || value.includes('resilience')) return 'bulwark';
    if (value.includes('super') || value.includes('intellect')) return 'specialist';
    if (value.includes('class') || value.includes('ability')) return 'paragon';
    return '';
  }

  function inferredArchetype(row) {
    const entries = STAT_COLS.map((stat) => ({ stat, value: num(row[stat]) })).sort((a, b) => b.value - a.value);
    const top = entries[0];
    const second = entries[1];
    if (!top || top.value <= 0) return 'balanced';
    if (second && Math.abs(top.value - second.value) <= 2) return 'balanced';
    return STAT_TO_ARCHETYPE[top.stat] || 'balanced';
  }

  function rowForCard(card) {
    return (getState()?.visible || []).find((row) => normId(row.Id) === card?.dataset?.gridId);
  }

  function renderBadges() {
    document.querySelectorAll('body.grid-view .grid-card').forEach((card) => {
      const row = rowForCard(card);
      if (!row) return;
      let badge = card.querySelector('.grid-aag-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'grid-aag-badge';
        badge.setAttribute('aria-hidden', 'false');
        const top = card.querySelector('.grid-card-top') || card;
        top.appendChild(badge);
      }
      const key = explicitArchetype(row) || inferredArchetype(row);
      const data = ARCHETYPES[key] || ARCHETYPES.balanced;
      const topStats = STAT_COLS.map((stat) => `${stat.replace(' (Base)', '')}: ${num(row[stat])}`).join('\n');
      badge.dataset.aag = key;
      badge.textContent = data.icon;
      badge.title = `${data.label}\n${data.desc}\n\n${topStats}`;
      badge.setAttribute('aria-label', `${data.label} archetype`);
    });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__archetypeBadgesPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => {
      original();
      setTimeout(renderBadges, 0);
    };
    window.D2AA.__archetypeBadgesPatched = true;
  }

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    renderBadges();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.archetypeObserver !== '1') {
      rows.dataset.archetypeObserver = '1';
      new MutationObserver(() => setTimeout(renderBadges, 0)).observe(rows, { childList: true, subtree: false });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
