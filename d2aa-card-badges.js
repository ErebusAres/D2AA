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
    row['Power Level'],
    row['Light Level'],
    row.PrimaryStat,
    row['Primary Stat'],
    row.Level,
    row['Item Level'],
    row.__raw?.Power,
    row.__raw?.['Power Level'],
    row.__raw?.['Light Level'],
    row.__raw?.Level
  );
  const state = () => window.D2AA?.getState?.() || {};
  let queued = 0;
  let lastSig = '';

  function rowMap() {
    return new Map((state().visible || []).map((row) => [normId(row.Id), row]));
  }

  function signature() {
    return (state().visible || []).map((row) => [normId(row.Id), row.Tag || '', row.Light || row.Power || row.PowerLevel || row['Power Level'] || row['Light Level'] || '', row.PrimaryStat || row['Primary Stat'] || ''].join('|')).join('~');
  }

  function decorateCard(card, rowsById) {
    const row = rowsById.get(normId(card?.dataset?.gridId));
    if (!row) return;
    const light = lightLevel(row);
    const tag = tagEmoji(row.Tag);
    const tagBtn = card.querySelector('.grid-tag');
    card.querySelectorAll('.grid-light,.grid-power-pill').forEach((el) => el.remove());
    if (!tagBtn) return;
    if (!light && !tag) {
      tagBtn.className = 'grid-tag is-empty';
      tagBtn.innerHTML = '';
      tagBtn.title = 'No tag — change tag';
      return;
    }
    tagBtn.className = `grid-tag grid-info-badge${tag ? ' has-tag' : ''}`;
    tagBtn.title = `${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${tagLabel(row.Tag)} tag` : ''} — change tag`;
    tagBtn.innerHTML = `${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}`;
  }

  function decorateAll(force = false) {
    queued = 0;
    const sig = signature();
    const host = document.getElementById('rows');
    if (!force && sig === lastSig && host?.dataset.badgesDecorated === '1') return;
    lastSig = sig;
    if (host) host.dataset.badgesDecorated = '1';
    const rowsById = rowMap();
    document.querySelectorAll('.grid-card').forEach((card) => decorateCard(card, rowsById));
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
