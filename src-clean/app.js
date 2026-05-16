import { state, subscribe, setState, setRows, updateTag, getFilteredRows, loadCachedRows, clearCache, loadSettings } from './state.js';
import { CLASS_ORDER, SLOT_ORDER } from './constants.js';
import { parseDimCsv } from './data/dim-csv.js';
import { applyDuplicateGroups } from './data/duplicate-groups.js';
import { runItemAction } from './data/actions.js';
import { renderGrid } from './render/grid.js';
import { renderTable } from './render/table.js';
import { renderItemFeed } from './render/item-feed.js';

const els = {};
let lastGroupedRows = [];

function boot() {
  cacheEls();
  loadSettings();
  bindEvents();
  subscribe(render);
  document.body.dataset.theme = state.theme;
  loadCachedRows();
  render();
}

function cacheEls() {
  ['statusText','searchBox','refreshBtn','menuBtn','commandPanel','gridView','tableView','tableBody','emptyState','summaryShown','summaryCached','summaryGroups','summaryRecent','summaryClasses','activeChips','csvFile','uploadCsvBtn','restoreCacheBtn','clearCacheBtn','classFilter','slotFilter','rarityFilter','sortBy','themePills','feedList','feedCount','feedToggle','itemFeed'].forEach((id) => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.searchBox.addEventListener('input', () => setState({ search: els.searchBox.value }));
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setState({ view: button.dataset.view })));
  els.menuBtn.addEventListener('click', () => els.commandPanel.classList.toggle('is-open'));
  els.feedToggle.addEventListener('click', () => els.itemFeed.classList.toggle('is-open'));
  els.uploadCsvBtn.addEventListener('click', () => els.csvFile.click());
  els.csvFile.addEventListener('change', async () => {
    const file = els.csvFile.files?.[0];
    if (!file) return;
    setStatus(`Parsing ${file.name}...`);
    const rows = await parseDimCsv(file);
    setRows(rows, `Loaded ${rows.length} rows from ${file.name}.`);
  });
  els.restoreCacheBtn.addEventListener('click', () => loadCachedRows() || setStatus('No clean cached rows found.'));
  els.clearCacheBtn.addEventListener('click', clearCache);
  [els.classFilter, els.slotFilter, els.rarityFilter].forEach((select) => select.addEventListener('change', () => setState({ filters: { class: els.classFilter.value, slot: els.slotFilter.value, rarity: els.rarityFilter.value } })));
  els.sortBy.addEventListener('change', () => setState({ sortBy: els.sortBy.value }));
  els.themePills.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => setState({ theme: button.dataset.theme })));
  els.refreshBtn.addEventListener('click', () => setStatus('Use Sync from Bungie in the command menu, or connect Bungie first.'));
}

function render() {
  document.body.dataset.theme = state.theme;
  els.statusText.textContent = state.status;
  els.searchBox.value = state.search;
  els.sortBy.value = state.sortBy;
  syncViewButtons();
  syncThemeButtons();
  syncFilterOptions();
  const grouped = applyDuplicateGroups(state.rows);
  lastGroupedRows = grouped;
  const filtered = getFilteredRowsFrom(grouped);
  els.gridView.hidden = state.view !== 'grid';
  els.tableView.hidden = state.view !== 'table';
  renderGrid(els.gridView, filtered, updateTag, handleCardAction);
  renderTable(els.tableBody, filtered);
  renderItemFeed(els.feedList, els.feedCount, grouped, updateTag);
  els.emptyState.hidden = state.rows.length > 0;
  updateSummary(grouped, filtered);
  renderChips();
}

async function handleCardAction(actionId, button) {
  if (actionId.startsWith('group:')) return copyGroupIds(actionId.slice(6), button);
  const row = lastGroupedRows.find((item) => String(item.Id) === String(actionId));
  if (!row) return setStatus('Could not find that item in current state.');
  const original = button?.textContent || '';
  if (button) button.textContent = 'Working...';
  try {
    const result = await runItemAction(row);
    setStatus(result.message || 'Action complete.');
    if (button) button.textContent = 'Done';
  } catch (error) {
    console.error('D2AA clean item action failed', error);
    setStatus(error.message || String(error));
    if (button) button.textContent = 'Failed';
  } finally {
    if (button) setTimeout(() => { button.textContent = original; }, 1200);
  }
}

async function copyGroupIds(groupId, button) {
  const ids = lastGroupedRows.filter((row) => row.Group?.replace(/[A-Z]$/, '') === groupId).map((row) => `id:${row.Id}`);
  if (!ids.length) return setStatus('No group IDs found.');
  await navigator.clipboard?.writeText(ids.join(' or '));
  setStatus(`Copied ${ids.length} group item IDs.`);
  if (button) {
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1200);
  }
}

function getFilteredRowsFrom(rows) {
  const oldRows = state.rows;
  state.rows = rows;
  const result = getFilteredRows();
  state.rows = oldRows;
  return result;
}

function updateSummary(allRows, shownRows) {
  els.summaryShown.textContent = shownRows.length;
  els.summaryCached.textContent = allRows.length;
  els.summaryGroups.textContent = new Set(allRows.filter((r) => r.Group).map((r) => r.Group.replace(/[A-Z]$/, ''))).size;
  els.summaryRecent.textContent = Math.min(allRows.length, 30);
  const counts = CLASS_ORDER.map((cls) => `${cls[0]}:${allRows.filter((r) => r.Class === cls).length}`).join(' ');
  els.summaryClasses.textContent = counts || '—';
}

function syncViewButtons() {
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === state.view));
}
function syncThemeButtons() {
  els.themePills.querySelectorAll('[data-theme]').forEach((button) => button.classList.toggle('is-active', button.dataset.theme === state.theme));
}
function syncFilterOptions() {
  fillSelect(els.classFilter, ['all', ...unique(state.rows.map((r) => r.Class))], state.filters.class);
  fillSelect(els.slotFilter, ['all', ...SLOT_ORDER.filter((slot) => state.rows.some((r) => r.Slot === slot)), ...unique(state.rows.map((r) => r.Slot)).filter((slot) => !SLOT_ORDER.includes(slot))], state.filters.slot);
  fillSelect(els.rarityFilter, ['all', ...unique(state.rows.map((r) => r.Rarity))], state.filters.rarity);
}
function fillSelect(select, values, selected) {
  const current = select.value || selected;
  select.innerHTML = values.map((value) => `<option value="${value}">${value === 'all' ? 'All' : value}</option>`).join('');
  select.value = values.includes(current) ? current : 'all';
}
function renderChips() {
  const chips = [];
  if (state.search) chips.push(`Search: ${state.search}`);
  Object.entries(state.filters).forEach(([key, value]) => { if (value !== 'all') chips.push(`${key}: ${value}`); });
  els.activeChips.innerHTML = chips.map((chip) => `<span>${chip}</span>`).join('');
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function setStatus(status) { setState({ status }); }

boot();
