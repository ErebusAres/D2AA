(() => {
  const normId = (v) => String(v || '').trim();
  const tagEmoji = (tag) => ({ feed: '✨', favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' }[String(tag || '').toLowerCase()] || '');
  const tagLabel = (tag) => ({ feed: 'Item Feed', favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive', '': 'No tag' }[String(tag || '').toLowerCase()] || 'No tag');
  const firstNumber = (...values) => {
    for (const value of values) {
      const match = String(value ?? '').match(/\d{1,5}/);
      if (match) return Number(match[0]);
    }
    return 0;
  };
  const lightLevel = (row) => firstNumber(
    row.Light,
    row.Power,
    row.PowerLevel,
    row.Power_Level,
    row['Power Level'],
    row['Light Level'],
    row.PrimaryStat,
    row['Primary Stat'],
    row.Level,
    row['Item Level'],
    row.__raw?.Light,
    row.__raw?.Power,
    row.__raw?.PowerLevel,
    row.__raw?.Power_Level,
    row.__raw?.['Power Level'],
    row.__raw?.['Light Level'],
    row.__raw?.PrimaryStat,
    row.__raw?.['Primary Stat'],
    row.__raw?.Level
  );
  const state = () => window.D2AA?.getState?.() || {};
  const visibleRows = () => state().visible || state().filtered || state().rows || [];
  const allRows = () => {
    const seen = new Set();
    return [...(state().visible || []), ...(state().filtered || []), ...(state().rows || [])].filter((row) => {
      const key = normId(row.Id || row.InstanceId || row.ItemInstanceId) || `${row.Name}|${row.Dupe_Group}|${row.GroupKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  let queued = 0;
  let lastSig = '';

  function rowMaps() {
    const byId = new Map();
    const rows = allRows();
    rows.forEach((row) => {
      [row.Id, row.InstanceId, row.ItemInstanceId, row.ItemHash].map(normId).filter(Boolean).forEach((id) => byId.set(id, row));
    });
    return { byId, rows };
  }

  function rowForCard(card, maps) {
    if (!card) return null;
    const id = normId(card.dataset.gridId || card.getAttribute('data-grid-id') || card.dataset.id || card.getAttribute('data-id'));
    if (id && maps.byId.has(id)) return maps.byId.get(id);

    const group = normId(card.querySelector('.grid-group-badge')?.textContent || card.querySelector('[data-grid-action="group"]')?.textContent);
    const name = card.querySelector('.grid-item-name')?.textContent?.trim();
    if (group && name) {
      const byGroupName = maps.rows.find((row) => row.Is_Dupe && normId(row.Dupe_Group) === group && String(row.Name || '').trim() === name);
      if (byGroupName) return byGroupName;
    }
    if (name) return maps.rows.find((row) => String(row.Name || '').trim() === name) || null;
    if (group) return maps.rows.find((row) => normId(row.Dupe_Group) === group) || null;
    return null;
  }

  function signature() {
    return visibleRows().map((row) => [
      normId(row.Id || row.InstanceId || row.ItemInstanceId),
      row.Tag || '',
      lightLevel(row) || '',
      row.Name || '',
      row.Dupe_Group || '',
      row.GroupKey || ''
    ].join('|')).join('~');
  }

  function lightFromCard(card) {
    return firstNumber(
      card.querySelector('.grid-info-light')?.textContent,
      card.querySelector('.grid-light')?.textContent,
      card.querySelector('.grid-power-pill')?.textContent,
      card.dataset.light,
      card.dataset.power
    );
  }

  function decorateCard(card, maps) {
    const tagBtn = card.querySelector('.grid-tag');
    if (!tagBtn) return;

    const cardLight = lightFromCard(card);
    const existingTag = tagBtn.classList.contains('is-empty') ? '' : tagBtn.textContent.trim();
    const row = rowForCard(card, maps);
    const light = row ? (lightLevel(row) || cardLight) : cardLight;
    const tag = row ? tagEmoji(row.Tag) : existingTag;
    const label = row ? tagLabel(row.Tag) : (existingTag ? 'Tagged' : 'No tag');

    card.querySelectorAll('.grid-light,.grid-power-pill').forEach((el) => el.remove());
    if (!light && !tag) {
      tagBtn.className = 'grid-tag is-empty';
      tagBtn.innerHTML = '';
      tagBtn.title = 'No tag — change tag';
      return;
    }
    tagBtn.className = `grid-tag grid-info-badge${tag ? ' has-tag' : ''}`;
    tagBtn.title = `${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${label} tag` : ''} — change tag`;
    tagBtn.innerHTML = `${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}`;
  }

  function decorateAll(force = false) {
    queued = 0;
    const sig = signature();
    const host = document.getElementById('rows');
    if (!force && sig === lastSig && host?.dataset.badgesDecorated === '1') return;
    lastSig = sig;
    if (host) host.dataset.badgesDecorated = '1';
    const maps = rowMaps();
    document.querySelectorAll('.grid-card').forEach((card) => decorateCard(card, maps));
  }

  function schedule(force = false) {
    if (queued) return;
    queued = requestAnimationFrame(() => decorateAll(force));
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__cardBadgesPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => {
      original();
      schedule(true);
    };
    window.D2AA.__cardBadgesPatched = true;
  }

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    schedule(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
