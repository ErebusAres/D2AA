(() => {
  const $ = (id) => document.getElementById(id);
  const C = window.D2AA_CONSTANTS;
  const S = window.D2AA_STATE;
  let renderLocked = false;
  let pendingState = null;
  const overviewTotals = new Map();

  function setStatus(message) {
    const el = $('statusText');
    if (el && el.textContent !== message) el.textContent = message;
  }

  function updateOverview(state) {
    if (!overviewTotals.size || overviewTotals.get('__rows') !== state.rows) {
      overviewTotals.clear();
      overviewTotals.set('__rows', state.rows);
      for (const cls of C.CLASSES) overviewTotals.set(cls, 0);
      for (const row of state.rows) {
        if (overviewTotals.has(row.Equippable)) overviewTotals.set(row.Equippable, overviewTotals.get(row.Equippable) + 1);
      }
    }

    for (const cls of C.CLASSES) {
      const el = $(`${cls.toLowerCase()}Count`);
      const count = String(overviewTotals.get(cls) || 0);
      if (el && el.textContent !== count) el.textContent = count;
      document.querySelector(`[data-class="${cls}"]`)?.classList.toggle('is-active', state.classFilter === cls);
    }

    document.querySelectorAll('[data-class]').forEach((btn) => {
      if (btn.dataset.class === 'All') btn.classList.toggle('is-active', state.classFilter === 'All');
    });
  }

  function renderAll(state) {
    pendingState = state;
    if (renderLocked) return;
    renderLocked = true;
    requestAnimationFrame(() => {
      const nextState = pendingState;
      pendingState = null;
      renderLocked = false;

      document.body.dataset.view = nextState.view;
      $('gridHost')?.classList.toggle('is-hidden', nextState.view !== 'grid');
      $('tableHost')?.classList.toggle('is-hidden', nextState.view !== 'table');
      $('gridViewBtn')?.classList.toggle('is-active', nextState.view === 'grid');
      $('tableViewBtn')?.classList.toggle('is-active', nextState.view === 'table');
      updateOverview(nextState);

      if (nextState.view === 'table') window.D2AA_TABLE?.renderTable(nextState);
      else window.D2AA_GRID?.renderGrid(nextState);
      window.D2AA_FEED?.renderFeed();
    });
  }
  window.D2AA_RENDER = { renderAll, setStatus };
  function importCsv(file) { if (!file) return; setStatus(`Parsing ${file.name}...`); Papa.parse(file, { header:true, skipEmptyLines:true, complete: (results) => { const normalized = window.D2AA_NORMALIZE.normalizeRows(results.data); const grouped = window.D2AA_GROUPS.groupRows(normalized); S.setRows(grouped, `Imported ${grouped.length} armor rows from ${file.name}`); window.D2AA_FEED?.seed(grouped); setStatus(`Imported ${grouped.length} armor rows from ${file.name}`); }, error: (error) => setStatus(error.message || 'CSV import failed') }); }
  function openTagPicker(id, anchor) { const state = S.getState(); const row = state.rows.find((item) => String(item.Id) === String(id)); if (!row) return; const existing = document.getElementById('tagPicker'); existing?.remove(); const pop = document.createElement('div'); pop.id = 'tagPicker'; pop.style.cssText = 'position:fixed;z-index:1000;display:flex;gap:6px;padding:8px;border:1px solid var(--border);border-radius:14px;background:rgba(10,8,14,.96);box-shadow:0 18px 44px rgba(0,0,0,.45)'; pop.innerHTML = C.TAGS.map((tag) => `<button type="button" data-tag="${tag.id}" title="${tag.label}" style="display:grid;place-items:center;width:34px;height:34px;padding:0">${tag.emoji || '×'}</button>`).join(''); const rect = anchor.getBoundingClientRect(); pop.style.left = `${Math.min(window.innerWidth - 250, Math.max(10, rect.left))}px`; pop.style.top = `${Math.max(10, rect.bottom + 6)}px`; pop.addEventListener('click', (event) => { const btn = event.target.closest('[data-tag]'); if (!btn) return; S.setTag(id, btn.dataset.tag); pop.remove(); }); document.body.appendChild(pop); setTimeout(() => document.addEventListener('click', function close(event) { if (!event.target.closest('#tagPicker') && !event.target.closest('[data-action="tag"]')) { pop.remove(); document.removeEventListener('click', close); } }), 0); }
  function copyText(text) { return navigator.clipboard?.writeText(text).catch(() => false); }
  function bind() { $('fileInput')?.addEventListener('change', (event) => importCsv(event.target.files?.[0])); $('gridViewBtn')?.addEventListener('click', () => S.setView('grid')); $('tableViewBtn')?.addEventListener('click', () => S.setView('table')); $('restoreBtn')?.addEventListener('click', () => setStatus(S.loadSavedRows() ? 'Restored cached rebuild rows.' : 'No rebuild cache found.')); $('clearBtn')?.addEventListener('click', () => { S.clearRows(); setStatus('Cleared rebuild rows.'); }); $('searchBox')?.addEventListener('input', (event) => { S.state.search = event.target.value; S.applyFilters(); }); $('slotFilter')?.addEventListener('change', (event) => { S.state.slotFilter = event.target.value; S.applyFilters(); }); $('rarityFilter')?.addEventListener('change', (event) => { S.state.rarityFilter = event.target.value; S.applyFilters(); }); $('dupeFilter')?.addEventListener('change', (event) => { S.state.dupeFilter = event.target.value; S.applyFilters(); }); document.querySelectorAll('[data-class]').forEach((btn) => btn.addEventListener('click', () => { S.state.classFilter = S.state.classFilter === btn.dataset.class ? 'All' : btn.dataset.class; S.applyFilters(); })); document.body.addEventListener('click', async (event) => { const action = event.target.closest('[data-action]'); if (!action) return; const type = action.dataset.action; if (type === 'tag') return openTagPicker(action.dataset.id, action); if (type === 'copy') { await copyText(`id:${action.dataset.id}`); action.textContent = 'Copied'; setTimeout(() => { action.textContent = 'Copy ID'; }, 900); } if (type === 'copy-group') { const rows = S.getState().rows.filter((row) => row.GroupKey === action.dataset.group); await copyText(rows.map((row) => `id:${row.Id}`).join(' or ')); action.textContent = 'Copied'; setTimeout(() => { action.textContent = 'Copy group'; }, 900); } }); $('itemFeedTab')?.addEventListener('click', () => $('itemFeedDrawer')?.classList.toggle('is-open')); $('closeFeedBtn')?.addEventListener('click', () => $('itemFeedDrawer')?.classList.remove('is-open')); }
  bind(); S.loadSavedRows(); renderAll(S.getState());
})();
