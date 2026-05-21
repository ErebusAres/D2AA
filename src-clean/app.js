import { state, subscribe, setState, setRows, updateTag, dismissRecent, getFilteredRows, loadCachedRows, clearCache, loadSettings, normalizeClassFilter, rowMatchesClass, readJson, writeJson } from './state.js';
import { CLASS_ORDER, SLOT_ORDER, STORAGE_KEYS, THEME_NAMES, THEME_LABELS } from './constants.js';
import { parseDimCsv } from './data/dim-csv.js';
import { applyDuplicateGroups } from './data/duplicate-groups.js?v=1.64';
import { runItemAction, runGroupPull } from './data/actions.js';
import { renderGrid } from './render/grid-v169.js';
import { renderTable } from './render/table.js';
import { renderItemFeed } from './render/item-feed.js';
import { attachTagPicker } from './render/tag-picker.js';
import { openCompareModal } from './render/compare-modal.js';

const els = {};
let lastGroupedRows = [];

function boot() {
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
    setState({ status: `Parsing ${file.name}...` });
    try {
      const rows = await parseDimCsv(file);
      setRows(rows, { source: 'csv', persist: true });
      setState({ status: `Loaded ${rows.length} armor rows from DIM CSV.` });
    } catch (error) {
      console.error(error);
      setState({ status: error.message || 'Failed to parse DIM CSV.' });
    } finally {
      els.csvFile.value = '';
    }
  });
}
