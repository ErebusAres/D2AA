(() => {
  const TAGS = [
    { id: '', icon: '', label: 'No tag' },
    { id: 'favorite', icon: '❤️', label: 'Favorite' },
    { id: 'keep', icon: '🏷️', label: 'Keep' },
    { id: 'junk', icon: '🚫', label: 'Junk' },
    { id: 'infuse', icon: '⚡', label: 'Infuse' },
    { id: 'archive', icon: '📦', label: 'Archive' }
  ];
  const DISPLAY_TAGS = [{ id: 'feed', icon: '✨', label: 'Item Feed' }, ...TAGS];
  const LS_VIEW = 'd2aa_beta2_view_mode_v1';
  const normId = (v) => String(v || '').trim();
  const normTag = (v) => DISPLAY_TAGS.some((t) => t.id === String(v || '').trim().toLowerCase()) ? String(v || '').trim().toLowerCase() : '';
  const assignTag = (v) => TAGS.some((t) => t.id === String(v || '').trim().toLowerCase()) ? String(v || '').trim().toLowerCase() : '';
  const tagData = (tag) => DISPLAY_TAGS.find((t) => t.id === normTag(tag)) || DISPLAY_TAGS[1];
  const state = () => window.D2AA?.getState?.();
  let selectedId = '';

  function viewMode() { return localStorage.getItem(LS_VIEW) || 'grid'; }
  function rowForCard(card) { return (state()?.visible || []).find((row) => normId(row.Id) === card?.dataset?.gridId); }
  function cardForId(id) { return [...document.querySelectorAll('.grid-card')].find((card) => card.dataset.gridId === id); }

  function ensurePopover() {
    let pop = document.getElementById('d2aaTagPopover');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'd2aaTagPopover';
    pop.className = 'd2aa-tag-popover';
    pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', 'Assign item tag');
    pop.innerHTML = TAGS.map((tag) => `<button type="button" class="d2aa-tag-option" data-tag="${tag.id}" title="${tag.label}" aria-label="${tag.label}">${tag.icon}</button>`).join('');
    pop.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tag]');
      if (!btn || !selectedId) return;
      const row = (state()?.visible || []).find((item) => normId(item.Id) === selectedId);
      if (!row) return closePopover();
      window.D2AA?.setTag?.(row, assignTag(btn.dataset.tag));
      closePopover();
      window.D2AA?.render?.();
    });
    document.body.appendChild(pop);
    return pop;
  }

  function markSelected(card) {
    document.querySelectorAll('.grid-card.is-tag-selected').forEach((el) => el.classList.remove('is-tag-selected'));
    if (card) card.classList.add('is-tag-selected');
  }

  function positionPopover(card) {
    const pop = ensurePopover();
    const rect = card.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 128, Math.max(128, rect.left + rect.width / 2));
    const y = Math.max(58, rect.top - 8);
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
  }

  function openPopover(card) {
    const row = rowForCard(card);
    if (!row) return;
    selectedId = normId(row.Id);
    markSelected(card);
    const pop = ensurePopover();
    pop.querySelectorAll('[data-tag]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tag === assignTag(row.Tag)));
    positionPopover(card);
    pop.classList.add('is-open');
  }

  function closePopover() {
    selectedId = '';
    ensurePopover().classList.remove('is-open');
    markSelected(null);
  }

  function togglePopover(card) {
    const row = rowForCard(card);
    if (!row) return;
    const id = normId(row.Id);
    const pop = ensurePopover();
    if (selectedId === id && pop.classList.contains('is-open')) closePopover();
    else openPopover(card);
  }

  function refreshTagBadges() {
    document.querySelectorAll('.grid-card').forEach((card) => {
      const row = rowForCard(card);
      const tagBtn = card.querySelector('.grid-tag');
      if (!row || !tagBtn) return;
      const tag = tagData(row.Tag);
      tagBtn.textContent = tag.icon;
      tagBtn.title = `${tag.label} — click card to change tag`;
      tagBtn.setAttribute('aria-label', `${tag.label} tag for ${row.Name || 'item'}`);
      tagBtn.classList.toggle('has-tag', Boolean(tag.id));
      tagBtn.classList.toggle('is-empty', !tag.id);
    });
  }

  function bindCards() {
    if (viewMode() !== 'grid') return;
    refreshTagBadges();
    document.querySelectorAll('.grid-card').forEach((card) => {
      if (card.dataset.tagPopoverBound === '1') return;
      card.dataset.tagPopoverBound = '1';
      card.addEventListener('click', (event) => {
        if (event.target.closest('.grid-action, .grid-tag, .grid-class-card, button[data-grid-action="primary"], button[data-grid-action="group"], button[data-grid-action="compare"]')) return;
        togglePopover(card);
      });
      card.querySelector('.grid-tag')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePopover(card);
      });
    });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__tagPopoverPatched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => {
      original();
      setTimeout(bindCards, 0);
    };
    window.D2AA.__tagPopoverPatched = true;
  }

  function run() {
    if (!window.D2AA) { setTimeout(run, 50); return; }
    patchRender();
    ensurePopover();
    bindCards();
    const rows = document.getElementById('rows');
    if (rows && rows.dataset.tagPopoverObserver !== '1') {
      rows.dataset.tagPopoverObserver = '1';
      new MutationObserver(() => setTimeout(bindCards, 0)).observe(rows, { childList: true, subtree: false });
    }
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.grid-card') && !event.target.closest('#d2aaTagPopover')) closePopover();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePopover();
    });
    window.addEventListener('resize', () => {
      if (!selectedId) return;
      const card = cardForId(selectedId);
      if (card) positionPopover(card);
    });
    document.querySelector('.table-wrap')?.addEventListener('scroll', () => {
      if (!selectedId) return;
      const card = cardForId(selectedId);
      if (card) positionPopover(card);
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();