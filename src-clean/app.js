import { state, subscribe, setState, setRows, updateTag, dismissRecent, getFilteredRows, loadCachedRows, clearCache, loadSettings, normalizeClassFilter, rowMatchesClass, readJson, writeJson } from './state.js';
import { CLASS_ORDER, SLOT_ORDER, STORAGE_KEYS, THEME_NAMES, THEME_LABELS } from './constants.js';
import { parseDimCsv } from './data/dim-csv.js';
import { applyDuplicateGroups } from './data/duplicate-groups.js';
import { runItemAction, runGroupPull } from './data/actions.js';
import { renderGrid } from './render/grid.js';
import { renderTable } from './render/table.js';
import { renderItemFeed } from './render/item-feed.js';
import { attachTagPicker } from './render/tag-picker.js';
import { openCompareModal } from './render/compare-modal.js';

const RUNTIME_VERSION = '1.29';
const els = {};
let lastGroupedRows = [];

function boot() {
  window.D2AA_VERSION = RUNTIME_VERSION;
  const versionBadge = document.querySelector('.d2aa-version-badge');
  if (versionBadge) versionBadge.textContent = `v${RUNTIME_VERSION}`;
  cacheEls();
  renderThemeButtons();
  loadSettings();
  restoreFeedOpenState();
  bindEvents();
  subscribe(render);
  document.body.dataset.theme = normalizeTheme(state.theme);
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
  els.menuBtn?.addEventListener('click', toggleOptionsPanel);
  document.addEventListener('pointerdown', closeOptionsOnOutsideClick);
  document.addEventListener('keydown', closeOptionsOnEscape);
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
  els.themePills?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme]');
    if (!button) return;
    setState({ theme: button.dataset.theme });
  });
}

function renderThemeButtons() {
  if (!els.themePills) return;
  els.themePills.innerHTML = THEME_NAMES.map((theme) => `<button type="button" data-theme="${html(theme)}"><span class="theme-swatch" aria-hidden="true"></span><b>${html(THEME_LABELS[theme] || theme)}</b></button>`).join('');
}

function normalizeTheme(theme) {
  return THEME_NAMES.includes(theme) ? theme : 'calus';
}

function toggleOptionsPanel() {
  setOptionsPanelOpen(!els.commandPanel?.classList.contains('is-open'));
}
function setOptionsPanelOpen(open) {
  els.commandPanel?.classList.toggle('is-open', open);
  document.body.classList.toggle('options-open', open);
  els.menuBtn?.setAttribute('aria-expanded', String(open));
}