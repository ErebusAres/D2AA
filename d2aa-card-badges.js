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
  function state() { return window.D2AA?.getState?.(); }
  function rowForCard(card) {
    const id = card?.dataset?.gridId;
    return (state()?.visible || []).find((row) => normId(row.Id) === id);
  }
  function decorateCard(card) {
    const row = rowForCard(card);
    if (!row) return;
    const light = lightLevel(row);
    const tag = tagEmoji(row.Tag);
    const tagBtn = card.querySelector('.grid-tag');
    card.querySelectorAll('.grid-light,.grid-power-pill').forEach((el) => el.remove());
    if (!tagBtn) return;
    if (!light && !tag) {
      tagBtn.classList.add('is-empty');
      tagBtn.innerHTML = '';
      tagBtn.title = 'No tag — change tag';
      return;
    }
    tagBtn.classList.remove('is-empty');
    tagBtn.classList.add('grid-info-badge');
    tagBtn.title = `${light ? `Light / Power ${light}` : ''}${light && tag ? ' • ' : ''}${tag ? `${tagLabel(row.Tag)} tag` : ''} — change tag`;
    tagBtn.innerHTML = `${light ? `<span class="grid-info-light">${light}</span>` : ''}${light && tag ? '<span class="grid-info-dot">•</span>' : ''}${tag ? `<span class="grid-info-tag">${tag}</span>` : ''}`;
  }
  function decorateAll() {
    document.querySelectorAll('.grid-card').forEach(decorateCard);
  }
  function patchRender() {
    if (!window.D2AA || window.D2AA.__cardBadgesPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => {
      original();
      requestAnimationFrame(decorateAll);
    };
    window.D2AA.__cardBadgesPatched = true;
  }
  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    decorateAll();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.cardBadgesObserved !== '1') {
      rows.dataset.cardBadgesObserved = '1';
      new MutationObserver(() => requestAnimationFrame(decorateAll)).observe(rows, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
