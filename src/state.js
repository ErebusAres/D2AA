(() => {
  const { STORAGE } = window.D2AA_CONSTANTS;
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('D2AA storage write failed', error); } };
  const state = {
    rows: [],
    visible: [],
    view: localStorage.getItem(STORAGE.view) || 'grid',
    classFilter: 'All',
    slotFilter: 'All',
    rarityFilter: 'All',
    dupeFilter: 'All',
    search: '',
    tags: readJson(STORAGE.tags, {})
  };
  const norm = (value) => String(value || '').trim();
  const tagFor = (id) => state.tags[norm(id)] || '';
  function indexRow(row) {
    const searchText = [row.Name,row.Type,row.Slot,row.Rarity,row.Equippable,row.Dupe_Group,row.Tag,row.Light,row.Power].join(' ').toLowerCase();
    const renderKey = [
      row.Id,row.Name,row.IconUrl,row.Slot,row.Type,row.Rarity,row.Equippable,row.Light,row.Power,row.Tag,
      row.Is_Dupe,row.Same_Name_Dupe,row.Dupe_Group,row.GroupKey,row.GroupColor,row.GearTier,row.Tier,row.TierSource,
      row['Total (Base)'],...window.D2AA_CONSTANTS.STAT_COLS.map((stat) => row[stat])
    ].join(':');
    return { ...row, SearchText: searchText, RenderKey: renderKey };
  }
  function persistedRows() { return state.rows.map(({ SearchText, RenderKey, ...row }) => row); }
  function saveRows() { writeJson(STORAGE.rows, persistedRows()); }
  function loadSavedRows() { const rows = readJson(STORAGE.rows, []); setRows(rows, 'Restored cached rebuild rows'); return rows.length; }
  function clearRows() { state.rows = []; applyFilters(); saveRows(); }
  function setRows(rows, label = '') { state.rows = Array.isArray(rows) ? rows.map((row) => indexRow({ ...row, Tag: tagFor(row.Id) || row.Tag || '' })) : []; applyFilters(); saveRows(); if (label) window.D2AA_RENDER?.setStatus?.(label); }
  function setView(view) { state.view = view === 'table' ? 'table' : 'grid'; localStorage.setItem(STORAGE.view, state.view); render(); }
  function setTag(rowOrId, tag) { const id = norm(typeof rowOrId === 'object' ? rowOrId.Id : rowOrId); if (!id) return; const clean = norm(tag).toLowerCase(); if (clean) state.tags[id] = clean; else delete state.tags[id]; writeJson(STORAGE.tags, state.tags); state.rows = state.rows.map((row) => norm(row.Id) === id ? indexRow({ ...row, Tag: clean }) : row); applyFilters(); }
  function rowText(row) { return row.SearchText || [row.Name,row.Type,row.Slot,row.Rarity,row.Equippable,row.Dupe_Group,row.Tag,row.Light,row.Power].join(' ').toLowerCase(); }
  function applyFilters() { const q = state.search.toLowerCase().trim(); state.visible = state.rows.filter((row) => {
    if (state.classFilter !== 'All' && row.Equippable !== state.classFilter) return false;
    if (state.slotFilter !== 'All' && row.Slot !== state.slotFilter) return false;
    if (state.rarityFilter !== 'All' && row.Rarity !== state.rarityFilter) return false;
    if (state.dupeFilter === 'Only Dupes' && !row.Is_Dupe) return false;
    if (state.dupeFilter === 'Only Same-Name' && !row.Same_Name_Dupe) return false;
    if (q && !rowText(row).includes(q)) return false;
    return true;
  }); render(); }
  function render() { window.D2AA_RENDER?.renderAll?.(state); }
  window.D2AA_STATE = { state, setRows, loadSavedRows, clearRows, setView, setTag, applyFilters, saveRows, getState: () => state };
})();
