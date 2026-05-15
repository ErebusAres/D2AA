(() => {
  const STAT_COLS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const STAT_ICONS = {
    'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
    'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
    'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
    'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
    'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
    'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
  };
  const ARCHETYPES = {
    bulwark: { stat: 'Health (Base)', fallback: '🛡️', label: 'Bulwark', desc: 'Health-focused armor roll' },
    brawler: { stat: 'Melee (Base)', fallback: '✊', label: 'Brawler', desc: 'Melee-focused armor roll' },
    grenadier: { stat: 'Grenade (Base)', fallback: '💣', label: 'Grenadier', desc: 'Grenade-focused armor roll' },
    specialist: { stat: 'Super (Base)', fallback: '✨', label: 'Specialist', desc: 'Super-focused armor roll' },
    paragon: { stat: 'Class (Base)', fallback: '◇', label: 'Paragon', desc: 'Class ability-focused armor roll' },
    gunner: { stat: 'Weapons (Base)', fallback: '🎯', label: 'Gunner', desc: 'Weapons-focused armor roll' },
    balanced: { stat: '', fallback: '⚖️', label: 'Balanced', desc: 'Evenly distributed armor roll' }
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

  function iconMarkup(key, data) {
    const icon = STAT_ICONS[data.stat];
    if (icon) return `<img class="grid-aag-icon" src="${icon}" alt="" loading="lazy">`;
    return `<span class="grid-aag-emoji">${data.fallback}</span>`;
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
      badge.innerHTML = iconMarkup(key, data);
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
