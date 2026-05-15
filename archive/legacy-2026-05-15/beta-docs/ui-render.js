import { CSV_FILE_HINT, FILTERS, STAT_MAP, UI_IDS } from './config.js';
import {
  buildDisplayStatList,
  formatStatTooltip,
} from './armor-stats.js';
import {
  cleanElement,
  copyTextSafe,
  statTotals,
} from './utils.js';
import { setTolerance, setView, updateFilter } from './state.js';
import { pullItemToCharacter } from './bungie-client.js';

const THEME_OPTIONS = [
  { id: 'eclipse', label: 'Eclipse', hint: 'Default' },
  { id: 'solstice', label: 'Solstice', hint: 'High contrast' },
  { id: 'dawning', label: 'Dawning', hint: 'Cool blue' },
];
const THEME_STORAGE_KEY = 'd2aa-theme';

let storeRef = null;
let handlersRef = {};

let rowsHost;
let emptyState;
let uploadHint;
let fileInput;
let signInBtn;
let tolInput;
let statToggle;
let themeContainer;
let actionHeader;
let toastContainer;
const filterElements = {};

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

function setStoredTheme(value) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (_) {}
}

function updateShadowColor(state) {
  const rarity = state.filters.rarity;
  const root = document.documentElement;
  if (rarity === 'Legendary') {
    root.style.setProperty('--shadow', 'var(--shadow-purple)');
  } else if (rarity === 'Exotic') {
    root.style.setProperty('--shadow', 'var(--shadow-gold)');
  } else {
    root.style.setProperty('--shadow', 'var(--shadow-base)');
  }
}

function applyTheme(themeId, skipStore = false) {
  const valid = THEME_OPTIONS.some((opt) => opt.id === themeId) ? themeId : THEME_OPTIONS[0].id;
  document.body.dataset.theme = valid;
  if (!skipStore) {
    setStoredTheme(valid);
  }
  if (themeContainer) {
    const buttons = themeContainer.querySelectorAll('[data-theme-option]');
    buttons.forEach((btn) => {
      const isActive = btn.dataset.themeOption === valid;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
}

function initThemeToggle(state) {
  const stored = getStoredTheme();
  const initial = THEME_OPTIONS.some((opt) => opt.id === stored) ? stored : THEME_OPTIONS[0].id;
  if (themeContainer) {
    themeContainer.innerHTML = '';
    THEME_OPTIONS.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-toggle__btn';
      btn.dataset.themeOption = opt.id;
      btn.setAttribute('aria-pressed', opt.id === initial ? 'true' : 'false');
      btn.innerHTML = `<span class="theme-toggle__title">${opt.label}</span>` +
        (opt.hint ? `<span class="theme-toggle__hint">${opt.hint}</span>` : '');
      btn.addEventListener('click', () => {
        if (document.body.dataset.theme === opt.id) return;
        applyTheme(opt.id);
        updateShadowColor(state);
      });
      themeContainer.appendChild(btn);
    });
  }
  applyTheme(initial, true);
}

function buildSegmentControl(key, values) {
  const container = filterElements[key];
  if (!container) return;
  cleanElement(container);
  values.forEach((value) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg__btn';
    btn.dataset.value = value;
    btn.textContent = value;
    btn.addEventListener('click', () => {
      updateFilter(storeRef, key, value);
    });
    container.appendChild(btn);
  });
}

function highlightSegments(state) {
  Object.entries(filterElements).forEach(([key, container]) => {
    if (!container) return;
    const active = state.filters[key];
    container.querySelectorAll('.seg__btn').forEach((btn) => {
      const isActive = btn.dataset.value === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  });
}

function buildStatCells(row, view) {
  const values = buildDisplayStatList(row.stats, view);
  const frag = document.createDocumentFragment();
  values.forEach((value) => {
    const div = document.createElement('div');
    div.className = 'center';
    div.textContent = value;
    frag.appendChild(div);
  });
  return frag;
}

function formatGroupLabel(group) {
  if (!group?.top3?.length) return '—';
  return group.top3.map((entry) => entry.name.slice(0, 3).toUpperCase()).join('/');
}

function rankFromTotals(row) {
  const total = row.totalBase ?? statTotals(row.stats?.base);
  if (row.rarity === 'Exotic') {
    if (total >= 63) return '★★★★★';
    if (total === 62) return '★★★★☆';
    if (total === 61) return '★★★☆☆';
    if (total === 60) return '★★☆☆☆';
    if (total === 59) return '★☆☆☆☆';
    return '💩';
  }
  if (total >= 75) return '★★★★★';
  if (total === 74) return '★★★★☆';
  if (total === 73) return '★★★☆☆';
  if (total === 72) return '★★☆☆☆';
  if (total === 71) return '★☆☆☆☆';
  return '💩';
}

function computeTop3(stats, view) {
  const values = buildDisplayStatList(stats, view).map((value, index) => ({
    id: STAT_MAP[index].id,
    name: STAT_MAP[index].label,
    value,
  }));
  values.sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name));
  return values.slice(0, 3);
}

function buildGroups(rows, tol, view) {
  const groups = new Map();
  for (const row of rows) {
    const top3 = computeTop3(row.stats, view);
    const key = [row.classType, row.slot, ...top3.map((entry) => entry.name)].join('|');
    if (!groups.has(key)) {
      groups.set(key, { key, items: [], top3 });
    }
    const group = groups.get(key);
    group.items.push({ row, top3, isDupe: false });
  }

  for (const group of groups.values()) {
    group.items.forEach((entry) => {
      const baseTop3 = entry.top3;
      entry.isDupe = group.items.some((other) => {
        if (other === entry) return false;
        return baseTop3.every((stat, index) => {
          const otherStat = other.top3[index];
          if (!otherStat) return false;
          if (otherStat.name !== stat.name) return false;
          return Math.abs(otherStat.value - stat.value) <= tol;
        });
      });
    });
  }

  return groups;
}

function rowMatchesFilters(row, filters) {
  if (!row) return false;
  if (filters.classType !== 'Any' && row.classType !== filters.classType) return false;
  if (filters.rarity !== 'Any' && row.rarity !== filters.rarity) return false;
  if (filters.slot !== 'Any' && row.slot !== filters.slot) return false;
  return true;
}

function filterRows(state) {
  const { rows, filters } = state;
  return rows.filter((row) => rowMatchesFilters(row, filters));
}

function sortRows(rows, view) {
  const key = view === 'CURRENT' ? 'totalCurrent' : 'totalBase';
  return [...rows].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

function buildTagCell(row) {
  const div = document.createElement('div');
  div.className = 'center';
  if (row.dimTag) {
    div.textContent = row.dimTag;
    div.title = row.dimNotes ?? '';
  } else {
    div.textContent = row.raw?.Tag ?? row.raw?.tag ?? '—';
  }
  return div;
}

function buildItemCell(row) {
  const div = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = row.name;
  const meta = document.createElement('div');
  meta.className = 'muted';
  meta.textContent = `${row.classType} • ${row.slot}`;
  div.append(title, meta);
  return div;
}

function buildTierCell(row) {
  const div = document.createElement('div');
  div.className = 'center';
  div.textContent = row.tier ?? row.rarity ?? '—';
  return div;
}

function buildStatsCell(row, view) {
  const div = document.createElement('div');
  div.className = 'center stats';
  div.title = formatStatTooltip(row.stats);
  buildDisplayStatList(row.stats, view).forEach((value) => {
    const span = document.createElement('span');
    span.className = 'stat';
    span.textContent = value;
    div.appendChild(span);
  });
  return div;
}

function buildTotalCell(row, view) {
  const div = document.createElement('div');
  div.className = 'center';
  const value = view === 'CURRENT' ? row.totalCurrent : row.totalBase;
  div.textContent = value ?? '—';
  return div;
}

function buildGroupCell(group) {
  const div = document.createElement('div');
  div.className = 'center';
  div.textContent = formatGroupLabel(group);
  return div;
}

function buildRankCell(row) {
  const div = document.createElement('div');
  div.className = 'center';
  div.textContent = rankFromTotals(row);
  return div;
}

function isBungiePullEnabled(state) {
  const bungie = state?.bungie ?? {};
  const tokens = bungie.tokens ?? {};
  const hasToken = Boolean(tokens.accessToken ?? tokens.access_token);
  const membershipType =
    bungie.membershipType ?? tokens.membership_type ?? tokens.membershipType;
  const characters = bungie.characters ?? {};
  const hasCharacters = Object.keys(characters).length > 0;
  return Boolean(hasToken && membershipType !== null && membershipType !== undefined && hasCharacters);
}

function updateRowPullState(rowId, updates) {
  if (!storeRef) return;
  storeRef.setState((current) => ({
    rows: current.rows.map((row) =>
      row.id === rowId ? { ...row, ...updates } : row
    ),
  }));
}

function ensureToastHost() {
  if (toastContainer) return toastContainer;
  const container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  toastContainer = container;
  return container;
}

function showToast(message, variant = 'info') {
  const container = ensureToastHost();
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

function extractBungieErrorMessage(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof data !== 'object') return null;

  const message = typeof data.Message === 'string' ? data.Message.trim() : '';
  if (message) return message;

  if (Array.isArray(data.Messages)) {
    const merged = data.Messages.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
      .join(' ');
    if (merged) return merged;
  }

  const messageData = data.MessageData;
  if (messageData && typeof messageData === 'object') {
    const parts = [];
    for (const value of Object.values(messageData)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (typeof entry === 'string' && entry.trim()) {
            parts.push(entry.trim());
          }
        });
      } else if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim());
      }
    }
    if (parts.length) {
      return parts.join(' ');
    }
  }

  const fallback = typeof data.error === 'string' ? data.error.trim() : '';
  return fallback || null;
}

function formatPullError(error) {
  if (!error) return 'Pull failed';
  const parts = ['Pull failed'];
  const status = error.status ?? error.ErrorStatus ?? null;
  const code = error.code ?? error.ErrorCode ?? null;
  if (status || code) {
    const details = [status, code ? `Code ${code}` : null]
      .filter(Boolean)
      .join(' • ');
    if (details) parts.push(`(${details})`);
  }
  let message = error.message ?? '';
  const bungieMessage = extractBungieErrorMessage(error.data);
  if (bungieMessage && (!message || !message.includes(bungieMessage))) {
    message = message ? `${message} ${bungieMessage}` : bungieMessage;
  }
  message = message.trim();
  if (message) {
    parts.push(`: ${message}`);
  }
  return parts.join(' ');
}

async function handlePull(row) {
  if (!row || !storeRef) return;
  updateRowPullState(row.id, { pullState: 'pulling', pullError: null });
  try {
    const result = await pullItemToCharacter(storeRef, row);
    const isNoop = result?.type === 'noop';
    updateRowPullState(row.id, {
      pullState: 'pulled',
      pullError: null,
    });
    const toastVariant = isNoop ? 'info' : 'success';
    const toastMessage = isNoop
      ? `${row.name} is already on your character.`
      : `Pulled ${row.name} ✓`;
    showToast(toastMessage, toastVariant);
    if (typeof handlersRef.onPullSuccess === 'function') {
      Promise.resolve()
        .then(() => handlersRef.onPullSuccess(row, result))
        .catch((error) => {
          console.warn('onPullSuccess handler failed', error);
        });
    }
  } catch (error) {
    console.error('Pull item failed', error);
    const message = formatPullError(error);
    updateRowPullState(row.id, {
      pullState: 'error',
      pullError: message,
    });
    showToast(message, 'error');
  }
}

function updateActionHeader(state) {
  if (!actionHeader) return;
  const shouldShowPull = isBungiePullEnabled(state) && state.source === 'bungie';
  actionHeader.textContent = shouldShowPull ? 'Pull Item' : 'Copy ID';
}

function buildActionCell(row) {
  const div = document.createElement('div');
  div.className = 'right';
  const state = storeRef?.getState?.();
  const canPull = state && isBungiePullEnabled(state) && row.source === 'bungie';
  if (!canPull) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = 'Copy ID';
    button.addEventListener('click', async () => {
      const id = row.itemInstanceId ?? row.id;
      const ok = await copyTextSafe(`id:${id}`);
      button.textContent = ok ? 'Copied!' : 'Copy ID';
      window.setTimeout(() => {
        button.textContent = 'Copy ID';
      }, 1200);
    });
    div.appendChild(button);
    return div;
  }

  const button = document.createElement('button');
  button.className = 'btn';
  const stateKey = row.pullState ?? 'idle';
  if (stateKey === 'pulling') {
    button.textContent = 'Pulling…';
    button.disabled = true;
  } else if (stateKey === 'pulled') {
    button.textContent = 'Pulled ✓';
    button.disabled = true;
  } else if (stateKey === 'error') {
    button.textContent = 'Retry Pull';
    if (row.pullError) button.title = row.pullError;
  } else {
    button.textContent = 'Pull Item';
  }
  button.addEventListener('click', () => {
    if (button.disabled) return;
    handlePull(row);
  });
  div.appendChild(button);
  return div;
}

function buildRow(row, group, isDupe) {
  const tr = document.createElement('div');
  tr.className = 'row';
  if (isDupe) {
    tr.classList.add('row--dupe');
  }

  tr.append(
    buildTagCell(row),
    buildItemCell(row),
    buildTierCell(row),
    buildStatsCell(row, storeRef.getState().view),
    buildTotalCell(row, storeRef.getState().view),
    buildGroupCell(group),
    buildRankCell(row),
    buildActionCell(row),
  );

  return tr;
}

function renderRows(state) {
  const filtered = filterRows(state);
  const sorted = sortRows(filtered, state.view);
  const groups = buildGroups(sorted, state.tol, 'BASE');

  cleanElement(rowsHost);
  if (!sorted.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  const finalRows = sorted.filter((row) => {
    const key = [row.classType, row.slot, ...computeTop3(row.stats, 'BASE').map((stat) => stat.name)].join('|');
    const group = groups.get(key);
    const entry = group?.items?.find((item) => item.row === row);
    const isDupe = entry?.isDupe ?? false;
    if (state.filters.dupes === 'Only Dupes') return isDupe;
    if (state.filters.dupes === 'Hide Dupes') return !isDupe;
    return true;
  });

  if (!finalRows.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  finalRows.forEach((row) => {
    const key = [row.classType, row.slot, ...computeTop3(row.stats, 'BASE').map((stat) => stat.name)].join('|');
    const group = groups.get(key);
    const entry = group?.items?.find((item) => item.row === row);
    const element = buildRow(row, group, entry?.isDupe ?? false);
    rowsHost.appendChild(element);
  });
}

function syncStatToggle(state) {
  if (!statToggle) return;
  statToggle.querySelectorAll('button').forEach((button) => {
    const isActive = button.dataset.view === state.view;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function render(state) {
  highlightSegments(state);
  syncStatToggle(state);
  updateShadowColor(state);
  if (tolInput) tolInput.value = state.tol;
  updateActionHeader(state);
  renderRows(state);
}

function ensureStatToggle() {
  if (!statToggle) return;
  cleanElement(statToggle);
  const baseBtn = document.createElement('button');
  baseBtn.type = 'button';
  baseBtn.dataset.view = 'BASE';
  baseBtn.textContent = 'Base';
  baseBtn.addEventListener('click', () => setView(storeRef, 'BASE'));
  const currentBtn = document.createElement('button');
  currentBtn.type = 'button';
  currentBtn.dataset.view = 'CURRENT';
  currentBtn.textContent = 'Current';
  currentBtn.addEventListener('click', () => setView(storeRef, 'CURRENT'));
  statToggle.append(baseBtn, currentBtn);
}

export function initUI(store, handlers = {}) {
  storeRef = store;
  handlersRef = handlers;

  rowsHost = document.getElementById(UI_IDS.rows);
  emptyState = document.getElementById(UI_IDS.empty);
  uploadHint = document.getElementById(UI_IDS.uploadHint);
  fileInput = document.getElementById(UI_IDS.fileInput);
  signInBtn = document.getElementById(UI_IDS.signInBtn);
  tolInput = document.getElementById(UI_IDS.tolInput);
  statToggle = document.getElementById(UI_IDS.statToggle);
  themeContainer = document.getElementById(UI_IDS.themeToggle);
  actionHeader = document.getElementById(UI_IDS.actionHeader);
  toastContainer = ensureToastHost();

  filterElements.classType = document.getElementById(UI_IDS.classSeg);
  filterElements.rarity = document.getElementById(UI_IDS.raritySeg);
  filterElements.slot = document.getElementById(UI_IDS.slotSeg);
  filterElements.dupes = document.getElementById(UI_IDS.dupesSeg);

  Object.entries(FILTERS).forEach(([key, values]) => buildSegmentControl(key, values));
  ensureStatToggle();
  initThemeToggle(store.getState());

  if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (handlersRef.onCsvSelected) {
        handlersRef.onCsvSelected(file);
      }
    });
  }

  const uploadTrigger = document.getElementById(UI_IDS.uploadTrigger);
  if (uploadTrigger && fileInput) {
    uploadTrigger.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        fileInput.click();
      }
    });
  }

  const restoreBtn = document.getElementById(UI_IDS.restoreBtn);
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => handlersRef.onRestore?.());
  }

  const clearBtn = document.getElementById(UI_IDS.clearBtn);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => handlersRef.onClear?.());
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', () => handlersRef.onSignIn?.());
  }

  if (tolInput) {
    tolInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      setTolerance(store, Math.max(0, value));
    });
  }

  if (statToggle) {
    statToggle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') setView(store, 'BASE');
      if (event.key === 'ArrowRight') setView(store, 'CURRENT');
    });
  }

  const unsubscribe = store.subscribe(render);
  render(store.getState());

  return {
    setUploadHint(text) {
      if (!uploadHint) return;
      uploadHint.textContent = text;
    },
    resetUploadHint() {
      if (!uploadHint) return;
      uploadHint.textContent = uploadHint.dataset.default ?? CSV_FILE_HINT;
    },
    clearFileInput() {
      if (fileInput) fileInput.value = '';
    },
    destroy() {
      unsubscribe();
    },
  };
}
