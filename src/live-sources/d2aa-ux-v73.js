(() => {
  const $ = (id) => document.getElementById(id);

  function openPanel(name) {
    const btn = document.querySelector(`[data-shell-panel-btn="${name}"]`);
    btn?.click();
  }

  function runCommand(action) {
    const wrap = $('d2aaCommandWrap');
    wrap?.classList.remove('is-open');
    switch (action) {
      case 'data': openPanel('data'); break;
      case 'filters': openPanel('filters'); break;
      case 'summary': openPanel('summary'); break;
      case 'theme': openPanel('theme'); break;
      case 'upload': $('file')?.click(); break;
      case 'connect': $('bungieLoginBtn')?.click(); break;
      case 'sync': $('bungieImportV2Btn')?.click(); break;
      case 'restore': $('restoreBtn')?.click(); break;
      case 'copy': $('copyVisibleBtn')?.click(); break;
      case 'focus': $('smartSearch')?.focus(); break;
      case 'grid': document.querySelector('[data-view-mode="grid"]')?.click(); break;
      case 'table': document.querySelector('[data-view-mode="table"]')?.click(); break;
    }
  }

  function buildCommandMenu() {
    const actions = document.querySelector('.shell-actions');
    if (!actions || $('d2aaCommandWrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'd2aaCommandWrap';
    wrap.className = 'd2aa-command-wrap';
    wrap.innerHTML = `
      <button id="d2aaCommandBtn" class="shell-btn" type="button" title="Command menu"><span class="shell-btn-icon">⌘</span><span>Command</span></button>
      <div class="d2aa-command-menu" role="menu" aria-label="Command menu">
        <button class="d2aa-command-item" data-d2aa-command="focus" type="button"><span class="d2aa-command-icon">⌕</span><span><strong>Search</strong><span>Focus smart search</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="filters" type="button"><span class="d2aa-command-icon">☰</span><span><strong>Filters</strong><span>Class, rarity, slot, dupes</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="data" type="button"><span class="d2aa-command-icon">⇧</span><span><strong>Data</strong><span>Upload, connect, sync</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="sync" type="button"><span class="d2aa-command-icon">↻</span><span><strong>Sync</strong><span>Refresh Bungie inventory</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="summary" type="button"><span class="d2aa-command-icon">◎</span><span><strong>Summary</strong><span>Counts and quick help</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="theme" type="button"><span class="d2aa-command-icon">◐</span><span><strong>Theme</strong><span>Switch visual style</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="grid" type="button"><span class="d2aa-command-icon">▦</span><span><strong>Grid View</strong><span>DIM-style card layout</span></span></button>
        <button class="d2aa-command-item" data-d2aa-command="table" type="button"><span class="d2aa-command-icon">☷</span><span><strong>Table View</strong><span>Detailed row layout</span></span></button>
        <button class="d2aa-command-item is-wide" data-d2aa-command="copy" type="button"><span class="d2aa-command-icon">⧉</span><span><strong>Copy Visible IDs</strong><span>Copy current result set for DIM filters</span></span></button>
      </div>`;
    const more = $('shellMoreWrap');
    if (more) actions.insertBefore(wrap, more);
    else actions.appendChild(wrap);
    $('d2aaCommandBtn')?.addEventListener('click', (event) => { event.stopPropagation(); wrap.classList.toggle('is-open'); });
    wrap.querySelectorAll('[data-d2aa-command]').forEach((btn) => btn.addEventListener('click', () => runCommand(btn.dataset.d2aaCommand)));
    document.addEventListener('click', (event) => { if (!wrap.contains(event.target)) wrap.classList.remove('is-open'); });
  }

  function cleanupClassMeta() {
    document.querySelectorAll('.grid-class-meta').forEach((meta) => {
      if (meta.dataset.cleaned === '1') return;
      const text = meta.textContent || '';
      const nums = text.match(/\d+/g) || [];
      const armor = nums[0] || '0';
      const dupes = nums[1] || '0';
      const avg = nums[2] || '0';
      meta.innerHTML = `<span class="class-pill">${armor} armor</span><span class="class-pill">${dupes} dupes</span><span class="class-pill">avg ${avg}</span>`;
      meta.dataset.cleaned = '1';
    });
  }

  function patchRender() {
    if (!window.D2AA || window.D2AA.__ux73Patched) return;
    const original = window.D2AA.render;
    window.D2AA.render = () => { original(); setTimeout(cleanupClassMeta, 0); };
    window.D2AA.__ux73Patched = true;
  }

  function run() {
    buildCommandMenu();
    cleanupClassMeta();
    patchRender();
    const topbar = document.querySelector('.table-topbar');
    if (topbar) topbar.classList.add('is-compact-results');
    const overview = $('gridOverview');
    if (overview && overview.dataset.ux73Observed !== '1') {
      overview.dataset.ux73Observed = '1';
      new MutationObserver(() => setTimeout(cleanupClassMeta, 0)).observe(overview, { childList: true, subtree: true });
    }
    setTimeout(cleanupClassMeta, 200);
    setTimeout(cleanupClassMeta, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
