(() => {
  const $ = (id) => document.getElementById(id);
  const CLASS_ALIASES = { warlock: 'Warlock', lock: 'Warlock', hunter: 'Hunter', titan: 'Titan' };
  const RARITY_ALIASES = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary', leg: 'Legendary', exotic: 'Exotic', exo: 'Exotic' };
  const SLOT_ALIASES = { helmet: 'Helmet', helm: 'Helmet', gauntlets: 'Gauntlets', gloves: 'Gauntlets', arms: 'Gauntlets', chest: 'Chest Armor', legs: 'Leg Armor', boots: 'Leg Armor', class: 'Class Item', bond: 'Class Item', cloak: 'Class Item', mark: 'Class Item' };
  const LOCATION_ALIASES = { vault: 'Vault', inventory: 'Inventory', inv: 'Inventory', equipped: 'Equipped', equip: 'Equipped' };
  const DUPE_ALIASES = { dupes: 'Only Dupes', dupe: 'Only Dupes', duplicates: 'Only Dupes', same: 'Only Same-Name', samename: 'Only Same-Name' };
  const SORT_ALIASES = { total: 'totalDesc', rank: 'rankDesc', name: 'nameAsc', slot: 'slotAsc', default: 'default' };
  let lastPlainSearch = '';
  let lastRawSearch = '';

  function normalizeToken(token) { return String(token || '').trim().toLowerCase().replace(/^[-/#]+/, '').replace(/[:=].*$/, ''); }
  function valueAfter(token) { return String(token || '').includes(':') ? String(token).split(':').slice(1).join(':') : ''; }
  function state() { return window.D2AA?.getState?.(); }

  function parseSmartSearch(raw) {
    const s = state();
    if (!s) return;
    lastRawSearch = String(raw || '');
    const tokens = lastRawSearch.split(/\s+/).filter(Boolean);
    const patch = { search: '', classFilter: s.classFilter, rarityFilter: 'All', slotFilter: 'All', locationFilter: 'All', dupesFilter: 'All', sortBy: s.sortBy };
    const plain = [];

    for (const token of tokens) {
      const key = normalizeToken(token);
      const val = normalizeToken(valueAfter(token));
      const pick = val || key;
      if (CLASS_ALIASES[pick]) { patch.classFilter = CLASS_ALIASES[pick]; continue; }
      if (RARITY_ALIASES[pick]) { patch.rarityFilter = RARITY_ALIASES[pick]; continue; }
      if (SLOT_ALIASES[pick]) { patch.slotFilter = SLOT_ALIASES[pick]; continue; }
      if (LOCATION_ALIASES[pick]) { patch.locationFilter = LOCATION_ALIASES[pick]; continue; }
      if (DUPE_ALIASES[pick]) { patch.dupesFilter = DUPE_ALIASES[pick]; continue; }
      if (SORT_ALIASES[pick] && /^sort[:=]/i.test(token)) { patch.sortBy = SORT_ALIASES[pick]; continue; }
      if (/^tolerance[:=]/i.test(token) || /^tol[:=]/i.test(token)) { const n = Number(valueAfter(token)); if (Number.isFinite(n)) patch.tol = Math.max(0, Math.min(20, n)); continue; }
      plain.push(token);
    }

    patch.search = plain.join(' ');
    lastPlainSearch = patch.search;
    Object.assign(s, patch);
    window.D2AA?.render?.();
    updateShellState(raw);
  }

  function makeChip(label, value) {
    const chip = document.createElement('span');
    chip.className = 'shell-chip';
    chip.innerHTML = `<strong>${label}</strong>${value}`;
    return chip;
  }

  function updateShellState(rawOverride = null) {
    const s = state();
    if (!s) return;
    const smart = $('smartSearch');
    if (smart && rawOverride == null && document.activeElement !== smart) smart.value = lastRawSearch || lastPlainSearch || s.search || '';
    const chips = $('shellActiveFilters');
    if (chips) {
      chips.textContent = '';
      const chipData = [];
      const explicitClass = /\b(warlock|lock|hunter|titan|class[:=])/i.test(lastRawSearch);
      if (explicitClass && s.classFilter && s.classFilter !== 'All') chipData.push(['Class', s.classFilter]);
      if (s.rarityFilter !== 'All') chipData.push(['Rarity', s.rarityFilter]);
      if (s.slotFilter !== 'All') chipData.push(['Slot', s.slotFilter]);
      if (s.locationFilter !== 'All') chipData.push(['Loc', s.locationFilter]);
      if (s.dupesFilter !== 'All') chipData.push(['Dupes', s.dupesFilter.replace('Only ', '')]);
      if (s.search) chipData.push(['Search', s.search]);
      if (s.sortBy !== 'default') chipData.push(['Sort', s.sortBy.replace('Desc', ' ↓').replace('Asc', ' ↑')]);
      for (const [label, value] of chipData.slice(0, 4)) chips.appendChild(makeChip(label, value));
      chips.classList.toggle('is-empty', chipData.length === 0);
    }
    document.querySelectorAll('[data-shell-panel-btn]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.shellPanelBtn === $('shellDrawer')?.dataset.activePanel));
  }

  function openDrawer(panel) {
    const layer = $('shellDrawerLayer');
    const drawer = $('shellDrawer');
    const title = $('shellDrawerTitle');
    if (!layer || !drawer || !title) return;
    drawer.dataset.activePanel = panel;
    title.textContent = ({ data: 'Data Sources', filters: 'Filters & Sort', summary: 'Summary', theme: 'Theme' })[panel] || 'Options';
    document.querySelectorAll('.shell-panel').forEach((el) => el.classList.toggle('is-active', el.dataset.shellPanel === panel));
    layer.classList.add('is-open');
    updateShellState();
  }

  function closeDrawer() { $('shellDrawerLayer')?.classList.remove('is-open'); }

  function panel(panelName) { return document.querySelector(`[data-shell-panel="${panelName}"]`); }
  function moveSectionByHeading(titleId, panelName, where = 'append') {
    const target = panel(panelName);
    const heading = $(titleId);
    const block = heading?.closest('.card-block, .control-block, .summary-grid');
    if (!target || !block) return;
    if (where === 'prepend') target.prepend(block);
    else target.appendChild(block);
  }
  function moveNode(selector, panelName, where = 'append') {
    const target = panel(panelName);
    const node = document.querySelector(selector);
    if (!target || !node) return;
    if (where === 'prepend') target.prepend(node);
    else target.appendChild(node);
  }

  function buildShell() {
    if ($('d2aaTopShell')) return;
    document.body.classList.add('shell-enhanced');
    const top = document.createElement('header');
    top.id = 'd2aaTopShell';
    top.className = 'd2aa-top-shell';
    top.innerHTML = `
      <div class="shell-brand">
        <div class="shell-mark">D2</div>
        <div class="shell-title"><strong>D2 Armor Analyzer</strong><span>DIM CSV + Bungie inventory armor review</span></div>
      </div>
      <div class="shell-search-wrap">
        <div class="shell-search-row">
          <span class="shell-search-icon">⌕</span>
          <input id="smartSearch" type="search" autocomplete="off" placeholder="Search or filter: contraverse exotic warlock vault dupes sort:total tol:5" />
          <div id="shellActiveFilters" class="shell-active-filters is-empty" aria-live="polite"></div>
          <button id="shellSearchHelpBtn" class="shell-search-help" type="button" title="Search syntax">?</button>
        </div>
      </div>
      <nav class="shell-actions" aria-label="D2AA actions">
        <button class="shell-btn shell-btn--primary" data-shell-panel-btn="data" type="button"><span class="shell-btn-icon">⇧</span><span>Data</span></button>
        <button class="shell-btn" id="shellRefreshBtn" type="button" title="Sync Bungie inventory or restore saved rows"><span class="shell-btn-icon">↻</span><span>Sync</span></button>
        <button class="shell-btn" data-shell-panel-btn="filters" type="button"><span class="shell-btn-icon">☰</span><span>Filters</span></button>
        <button class="shell-btn" data-shell-panel-btn="summary" type="button"><span class="shell-btn-icon">◎</span><span>Summary</span></button>
        <button class="shell-btn" data-shell-panel-btn="theme" type="button"><span class="shell-btn-icon">◐</span><span>Theme</span></button>
      </nav>
    `;
    document.body.prepend(top);

    const layer = document.createElement('div');
    layer.id = 'shellDrawerLayer';
    layer.className = 'shell-drawer-layer';
    layer.innerHTML = `
      <div class="shell-scrim" data-close-shell></div>
      <aside id="shellDrawer" class="shell-drawer" aria-labelledby="shellDrawerTitle">
        <div class="shell-drawer-head"><h2 id="shellDrawerTitle">Options</h2><button id="shellDrawerClose" class="shell-drawer-close" type="button">×</button></div>
        <div class="shell-drawer-body">
          <div class="shell-panel" data-shell-panel="data"></div>
          <div class="shell-panel" data-shell-panel="filters"></div>
          <div class="shell-panel" data-shell-panel="summary"></div>
          <div class="shell-panel" data-shell-panel="theme"></div>
        </div>
      </aside>
    `;
    document.body.appendChild(layer);

    const help = document.createElement('div');
    help.id = 'searchHelpPop';
    help.className = 'search-help-pop';
    help.innerHTML = `<h3>Smart search examples</h3><div class="search-help-grid">
      <div><code>contraverse warlock exotic</code> searches name and filters class/rarity.</div>
      <div><code>vault hunter legs</code> filters location, class, and slot.</div>
      <div><code>dupes legendary sort:total</code> shows duplicate legendary armor by total.</div>
      <div><code>tol:3 same chest</code> sets stricter dupe tolerance and same-name groups.</div>
    </div>`;
    document.body.appendChild(help);

    moveSectionByHeading('uploadTitle', 'data', 'append');
    moveSectionByHeading('searchTitle', 'filters', 'append');
    moveSectionByHeading('filterTitle', 'filters', 'append');
    moveSectionByHeading('toleranceTitle', 'filters', 'append');
    moveSectionByHeading('actionsTitle', 'filters', 'append');
    moveNode('.summary-grid', 'summary', 'prepend');
    moveSectionByHeading('quickHelpTitle', 'summary', 'append');
    moveSectionByHeading('themeTitle', 'theme', 'append');

    $('smartSearch')?.addEventListener('input', (event) => parseSmartSearch(event.target.value));
    $('shellRefreshBtn')?.addEventListener('click', () => $('bungieImportV2Btn')?.click() || $('restoreBtn')?.click());
    document.querySelectorAll('[data-shell-panel-btn]').forEach((btn) => btn.addEventListener('click', () => openDrawer(btn.dataset.shellPanelBtn)));
    document.querySelectorAll('[data-close-shell], #shellDrawerClose').forEach((el) => el.addEventListener('click', closeDrawer));
    $('shellSearchHelpBtn')?.addEventListener('click', () => $('searchHelpPop')?.classList.toggle('is-open'));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeDrawer(); $('searchHelpPop')?.classList.remove('is-open'); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('smartSearch')?.focus(); } });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__shellPatched) return;
    const originalRender = window.D2AA.render;
    window.D2AA.render = () => { originalRender(); setTimeout(updateShellState, 0); };
    window.D2AA.__shellPatched = true;
  }

  function run() { buildShell(); patchRender(); updateShellState(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
