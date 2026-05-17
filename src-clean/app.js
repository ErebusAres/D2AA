import { state, subscribe, setState, setRows, updateTag, dismissRecent, getFilteredRows, loadCachedRows, clearCache, loadSettings, normalizeClassFilter, rowMatchesClass, readJson, writeJson } from './state.js';
import { CLASS_ORDER, SLOT_ORDER, STORAGE_KEYS } from './constants.js';
import { parseDimCsv } from './data/dim-csv.js';
import { applyDuplicateGroups } from './data/duplicate-groups.js';
import { runItemAction, runGroupPull } from './data/actions.js';
import { renderGrid } from './render/grid.js';
import { renderTable } from './render/table.js';
import { renderItemFeed } from './render/item-feed.js';
import { attachTagPicker } from './render/tag-picker.js';
import { openCompareModal } from './render/compare-modal.js';

const els = {};
let lastGroupedRows = [];

function boot() {
  cacheEls();
  loadSettings();
  restoreFeedOpenState();
  bindEvents();
  subscribe(render);
  document.body.dataset.theme = state.theme;
  loadCachedRows();
  render();
}

function cacheEls() {
  ['statusText','searchBox','refreshBtn','menuBtn','commandPanel','classToggle','gridView','tableView','tableBody','emptyState','summaryShown','summaryCached','summaryGroups','summaryRecent','summaryClasses','activeChips','csvFile','uploadCsvBtn','restoreCacheBtn','clearCacheBtn','classFilter','slotFilter','rarityFilter','sortBy','duplicateTolerance','duplicateToleranceOut','themePills','feedList','feedCount','feedToggle','itemFeed'].forEach((id) => els[id] = document.getElementById(id));
}

function bindEvents() {
  els.searchBox?.addEventListener('input', () => setState({ search: els.searchBox.value }));
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setState({ view: button.dataset.view })));
  els.classToggle?.querySelectorAll('[data-class-filter]').forEach((button) => button.addEventListener('click', () => setClassFilter(button.dataset.classFilter || 'all')));
  els.menuBtn?.addEventListener('click', () => els.commandPanel.classList.toggle('is-open'));
  els.feedToggle?.addEventListener('click', toggleItemFeed);
  els.uploadCsvBtn?.addEventListener('click', () => els.csvFile.click());
  els.csvFile?.addEventListener('change', async () => {
    const file = els.csvFile.files?.[0];
    if (!file) return;
    setStatus(`Parsing ${file.name}...`);
    try {
      const rows = await parseDimCsv(file);
      setRows(rows, `Loaded ${rows.length} rows from ${file.name}.`);
    } catch (error) {
      console.error('D2AA clean CSV import failed', error);
      setStatus(error.message || String(error));
    }
  });
  els.restoreCacheBtn?.addEventListener('click', () => loadCachedRows() || setStatus('No clean cached CSV rows found. Bungie cache restores automatically at startup.'));
  els.clearCacheBtn?.addEventListener('click', clearCache);
  [els.classFilter, els.slotFilter, els.rarityFilter].filter(Boolean).forEach((select) => select.addEventListener('change', () => setState({ filters: { class: normalizeClassFilter(els.classFilter.value), slot: els.slotFilter.value, rarity: els.rarityFilter.value } })));
  els.sortBy?.addEventListener('change', () => setState({ sortBy: els.sortBy.value }));
  els.duplicateTolerance?.addEventListener('input', () => setState({ duplicateTolerance: Number(els.duplicateTolerance.value || 5) }));
  els.themePills?.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => setState({ theme: button.dataset.theme })));
}

function setClassFilter(className) {
  setState({ filters: { ...state.filters, class: normalizeClassFilter(className) } });
}

function restoreFeedOpenState() {
  const open = readJson(STORAGE_KEYS.feedOpen, false) === true;
  els.itemFeed?.classList.toggle('is-open', open);
  document.body.classList.toggle('feed-open', open);
}

function toggleItemFeed() {
  const open = !els.itemFeed.classList.contains('is-open');
  els.itemFeed.classList.toggle('is-open', open);
  document.body.classList.toggle('feed-open', open);
  writeJson(STORAGE_KEYS.feedOpen, open);
}

function render() {
  document.body.dataset.theme = state.theme;
  els.statusText.textContent = state.status;
  els.searchBox.value = state.search;
  els.sortBy.value = state.sortBy;
  if (els.duplicateTolerance) els.duplicateTolerance.value = state.duplicateTolerance;
  if (els.duplicateToleranceOut) els.duplicateToleranceOut.textContent = `±${state.duplicateTolerance}`;
  syncViewButtons();
  syncThemeButtons();
  syncFilterOptions();
  syncClassToggle();
  const grouped = applyDuplicateGroups(state.rows, state.duplicateTolerance);
  lastGroupedRows = grouped;
  const filtered = getFilteredRowsFrom(grouped);
  els.gridView.hidden = state.view !== 'grid';
  els.tableView.hidden = state.view !== 'table';
  renderGrid(els.gridView, filtered, updateTag, handleCardAction, openGroupCompare);
  attachTagPicker(els.gridView, filtered, updateTag);
  renderTable(els.tableBody, filtered, handleCardAction);
  renderItemFeed(els.feedList, els.feedCount, grouped, updateTag, dismissRecent);
  els.emptyState.hidden = state.rows.length > 0;
  updateSummary(grouped, filtered);
  renderChips();
}

async function handleCardAction(actionId, button) {
  if (actionId.startsWith('group:')) return pullGroup(actionId.slice(6), button);
  const row = lastGroupedRows.find((item) => String(item.Id) === String(actionId));
  if (!row) return setStatus('Could not find that item in current state.');
  const original = button?.textContent || '';
  if (button) button.textContent = 'Working...';
  try {
    const result = await runItemAction(row);
    setStatus(result.message || 'Action complete.');
    if (button) button.textContent = 'Done';
    if (result.needsRefresh) requestBungieRefresh('post-action-refresh');
  } catch (error) {
    console.error('D2AA clean item action failed', error);
    setStatus(error.message || String(error));
    if (button) button.textContent = 'Failed';
  } finally {
    if (button) setTimeout(() => { button.textContent = original; }, 1200);
  }
}

function openGroupCompare(groupKey) {
  const rows = lastGroupedRows.filter((row) => row.Is_Dupe && row.GroupActionKey === groupKey);
  if (!rows.length) return setStatus('No duplicate group found to compare.');
  openCompareModal(rows, { onTag: updateTag, onPullGroup: (groupRows, button) => pullGroup(groupRows[0]?.GroupActionKey || groupKey, button) });
}

async function pullGroup(groupKey, button) {
  const rows = lastGroupedRows.filter((row) => row.Is_Dupe && row.GroupActionKey === groupKey);
  if (!rows.length) return setStatus('No group items found.');
  const original = button?.textContent || '';
  if (button) button.textContent = 'Pulling...';
  try {
    const result = await runGroupPull(rows);
    setStatus(result.message || 'Group action complete.');
    if (button) button.textContent = 'Done';
    if (result.needsRefresh) requestBungieRefresh('post-group-pull-refresh');
  } catch (error) {
    console.error('D2AA clean group pull failed', error);
    setStatus(error.message || String(error));
    if (button) button.textContent = 'Failed';
  } finally {
    if (button) setTimeout(() => { button.textContent = original; }, 1400);
  }
}

function requestBungieRefresh(reason) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('d2aa:bungie-sync-request', { detail: { reason, background: true } }));
  }, 1200);
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
  els.summaryGroups.textContent = new Set(allRows.filter((r) => r.Is_Dupe).map((r) => r.GroupActionKey)).size;
  els.summaryRecent.textContent = allRows.filter((row) => row.RecentlyFound || row.RecentStatus).length || Math.min(allRows.length, 30);
  const counts = CLASS_ORDER.map((cls) => `${cls[0]}:${allRows.filter((r) => rowMatchesClass(r, cls)).length}`).join(' ');
  els.summaryClasses.textContent = counts || '—';
}

function syncViewButtons() {
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === state.view));
}
function syncThemeButtons() {
  els.themePills?.querySelectorAll('[data-theme]').forEach((button) => button.classList.toggle('is-active', button.dataset.theme === state.theme));
}
function syncClassToggle() {
  if (!els.classToggle) return;
  const counts = countByClass(state.rows);
  els.classToggle.querySelectorAll('[data-class-filter]').forEach((button) => {
    const cls = normalizeClassFilter(button.dataset.classFilter || 'all');
    button.classList.toggle('is-active', normalizeClassFilter(state.filters.class) === cls);
    const count = cls === 'all' ? state.rows.length : counts[cls] || 0;
    const badge = button.querySelector('b');
    if (badge) badge.textContent = String(count);
  });
}
function syncFilterOptions() {
  fillSelect(els.classFilter, ['all', ...CLASS_ORDER.filter((cls) => state.rows.some((row) => rowMatchesClass(row, cls)))], normalizeClassFilter(state.filters.class));
  fillSelect(els.slotFilter, ['all', ...SLOT_ORDER.filter((slot) => state.rows.some((r) => r.Slot === slot)), ...unique(state.rows.map((r) => r.Slot)).filter((slot) => !SLOT_ORDER.includes(slot))], state.filters.slot);
  fillSelect(els.rarityFilter, ['all', ...unique(state.rows.map((r) => r.Rarity))], state.filters.rarity);
}
function fillSelect(select, values, selected) {
  if (!select) return;
  const current = select.value || selected;
  select.innerHTML = values.map((value) => `<option value="${html(value)}">${value === 'all' ? 'All' : html(value)}</option>`).join('');
  select.value = values.includes(selected) ? selected : values.includes(current) ? current : 'all';
}
function renderChips() {
  const chips = [];
  if (state.search) chips.push(`Search: ${state.search}`);
  Object.entries(state.filters).forEach(([key, value]) => {
    if (key === 'class') {
      const cls = normalizeClassFilter(value);
      if (cls !== 'all') chips.push(`class: ${cls}`);
    } else if (value !== 'all') chips.push(`${key}: ${value}`);
  });
  if (state.duplicateTolerance !== 5) chips.push(`Tolerance: ±${state.duplicateTolerance}`);
  els.activeChips.innerHTML = chips.map((chip) => `<span>${html(chip)}</span>`).join('');
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function countByClass(rows) {
  return CLASS_ORDER.reduce((acc, cls) => {
    acc[cls] = rows.filter((row) => rowMatchesClass(row, cls)).length;
    return acc;
  }, {});
}
function setStatus(status) { setState({ status }); }
function html(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }

boot();