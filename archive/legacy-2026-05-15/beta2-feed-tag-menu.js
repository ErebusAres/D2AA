(() => {
  const TAGS = [
    ['', '×', 'No tag'],
    ['favorite', '❤️', 'Favorite'],
    ['keep', '🏷️', 'Keep'],
    ['junk', '🚫', 'Junk'],
    ['infuse', '⚡', 'Infuse'],
    ['archive', '📦', 'Archive']
  ];
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const tagInfo = (value) => TAGS.find(([id]) => id === normalize(value)) || TAGS[0];

  function enhanceRow(row) {
    if (!row || row.dataset.tagMenuEnhanced === '1') return;
    const buttons = [...row.querySelectorAll('.feed-tag-btn')];
    if (!buttons.length) return;
    row.dataset.tagMenuEnhanced = '1';

    const active = buttons.find((btn) => btn.classList.contains('is-active')) || buttons[0];
    const [id, icon, label] = tagInfo(active?.dataset?.tag || '');
    const current = document.createElement('button');
    current.type = 'button';
    current.className = 'feed-tag-current';
    current.title = 'Change tag';
    current.innerHTML = `<span class="feed-tag-current-icon">${id ? icon : ''}</span><span class="feed-tag-current-label">${label}</span><span class="feed-tag-current-caret">▴</span>`;

    const panel = document.createElement('div');
    panel.className = 'feed-tag-menu-panel';
    buttons.forEach((btn) => panel.appendChild(btn));
    row.prepend(current, panel);

    current.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.feed-tag-row.is-menu-open').forEach((openRow) => {
        if (openRow !== row) openRow.classList.remove('is-menu-open');
      });
      row.classList.toggle('is-menu-open');
    });
    panel.addEventListener('click', (event) => {
      if (event.target.closest('.feed-tag-btn')) setTimeout(() => row.classList.remove('is-menu-open'), 80);
    });
  }

  function runEnhance() {
    document.querySelectorAll('.feed-tag-row').forEach(enhanceRow);
  }

  function init() {
    runEnhance();
    const list = document.getElementById('itemFeedList');
    if (list && list.dataset.feedTagMenuObserver !== '1') {
      list.dataset.feedTagMenuObserver = '1';
      new MutationObserver(() => setTimeout(runEnhance, 0)).observe(list, { childList: true, subtree: true });
    }
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.feed-tag-row')) {
        document.querySelectorAll('.feed-tag-row.is-menu-open').forEach((row) => row.classList.remove('is-menu-open'));
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') document.querySelectorAll('.feed-tag-row.is-menu-open').forEach((row) => row.classList.remove('is-menu-open'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
