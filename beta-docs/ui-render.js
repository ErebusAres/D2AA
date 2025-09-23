import {
  appState,
  subscribe,
  setRows,
  patchState,
  setDimTags,
  updateDimAuth,
  saveRowsToStorage,
  loadRowsFromStorage
} from './state.js';
import {
  STAT_COLS,
  STAT_ICONS,
  CLASS_OPTIONS,
  SLOT_OPTIONS,
  RARITY_OPTIONS,
  DUPES_OPTIONS,
  CLASS_ICONS,
  SLOT_ICONS,
  RARITY_ICONS,
  TAG_EMOJIS,
  TAG_LABELS,
  classItemByClass,
  statColorCls,
  normId,
  copyTextSafe,
  STORAGE_KEY
} from './utils.js';
import { clusterRows } from './grouping.js';
import { applyDimUpdates } from './dim-sync.js';

const STAT_TO_CORE = {
  'Health (Base)': 'resilience',
  'Melee (Base)': 'strength',
  'Grenade (Base)': 'discipline',
  'Super (Base)': 'intellect',
  'Class (Base)': 'mobility',
  'Weapons (Base)': 'recovery'
};

let initialized = false;
let unsubscribe = null;
let rootEl = null;
let uploadHintDefault = 'Choose DIM Armor.csv';
let uploadHintEl = null;
let rowsHost = null;
let emptyHost = null;
let dimStatusEl = null;
let statTitleEl = null;
let viewToggleEl = null;

export function renderApp(root, opts = {}) {
  if (!root) return;
  rootEl = root;
  if (!initialized) {
    root.innerHTML = layoutHtml();
    cacheRefs();
    wireStaticEvents();
    const cached = loadRowsFromStorage();
    if (cached) {
      setRows(cached, { source: 'csv' });
    }
    unsubscribe = subscribe(updateUI);
    initialized = true;
  }

  if (opts.rows) {
    setRows(opts.rows, { source: opts.source || appState.source });
    if ((opts.source || appState.source) === 'csv') {
      saveRowsToStorage();
    }
  }
  if (opts.dimTags) {
    setDimTags(opts.dimTags);
  }
  if (opts.dimAuth) {
    updateDimAuth(opts.dimAuth);
  }
  if (opts.uploadHint && uploadHintEl) {
    uploadHintEl.textContent = opts.uploadHint;
  }

  updateUI(appState);
}

function layoutHtml() {
  return `
  <div class="wrap">
    <header class="panel panel-header">
      <div class="panel-header__layout">
        <div class="panel-header__content">
          <h1>D2 Armor Analyzer — Beta</h1>
          <div class="muted">Upload a DIM CSV or sign in with Bungie to analyze armor with duplicate detection.</div>
          <div class="muted">BASE vs CURRENT stats toggle available. DIM tags can be edited inline.</div>
        </div>
        <div class="toolbar">
          <input id="csv-input" type="file" accept=".csv" class="toolbar__input" />
          <label id="uploadTrigger" class="tool-card tool-card--upload" for="csv-input" role="button" tabindex="0">
            <span class="tool-icon" aria-hidden="true"></span>
            <span class="tool-copy">
              <span class="tool-title">Upload CSV</span>
              <span class="tool-sub" id="uploadHint" data-default="Choose DIM Armor.csv">Choose DIM Armor.csv</span>
            </span>
          </label>
          <button class="tool-card tool-card--restore" id="restoreBtn" type="button">Restore last</button>
          <button class="tool-card tool-card--clear" id="clearBtn" type="button">Clear</button>
        </div>
      </div>
      <div class="panel-header__beta">
        <button id="btn-bungie-login" type="button" class="tool-card tool-card--auth">Sign in with Bungie</button>
        <span id="dim-status" class="badge status">DIM: Not Connected</span>
        <label class="muted" style="margin-left:1rem;">
          <input type="checkbox" id="toggle-view" /> Show CURRENT stats
        </label>
      </div>
    </header>

    <section class="panel filters-panel">
      <div class="filters">
        <div class="line"><span class="label">Class</span><div id="classSeg" class="seg"></div></div>
        <div class="line"><span class="label">Rarity</span><div id="raritySeg" class="seg"></div></div>
        <div class="line"><span class="label">Slot</span><div id="slotSeg" class="seg"></div></div>
        <div class="line"><span class="label">Dupes</span><div id="dupesSeg" class="seg"></div></div>
        <div class="line"><span class="label">Tolerance</span><input id="tol" type="number" min="0" max="20" value="5" style="width:80px"/> <span class="muted">± top‑3 stat</span></div>
      </div>
    </section>

    <section class="list">
      <div class="row header">
        <div class="center">Tag</div>
        <div>Item</div>
        <div class="center">Tier</div>
        <div id="stat-title">Base Stats <div class="center-info">(Health, Melee, Grenade, Super, Class, Weapons)</div></div>
        <div class="center">Total</div>
        <div class="center">Group</div>
        <div class="center">Rank</div>
        <div class="right">Copy</div>
      </div>
      <div id="rows"></div>
      <div id="empty" class="empty" style="display:none">
        <p>
          No items yet — upload a DIM CSV or click Restore last.<br/><br/>
          Sign in with Bungie to pull your profile directly, then sync DIM tags inline.
        </p>
      </div>
    </section>
  </div>
  `;
}

function cacheRefs() {
  uploadHintEl = rootEl.querySelector('#uploadHint');
  uploadHintDefault = uploadHintEl?.dataset?.default || uploadHintEl?.textContent || 'Choose DIM Armor.csv';
  rowsHost = rootEl.querySelector('#rows');
  emptyHost = rootEl.querySelector('#empty');
  dimStatusEl = rootEl.querySelector('#dim-status');
  statTitleEl = rootEl.querySelector('#stat-title');
  viewToggleEl = rootEl.querySelector('#toggle-view');
}

function wireStaticEvents() {
  const uploadTrigger = rootEl.querySelector('#uploadTrigger');
  const fileInput = rootEl.querySelector('#csv-input');
  const restoreBtn = rootEl.querySelector('#restoreBtn');
  const clearBtn = rootEl.querySelector('#clearBtn');
  const tolInput = rootEl.querySelector('#tol');

  if (uploadTrigger && fileInput) {
    uploadTrigger.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        fileInput.click();
      }
    });
  }
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      const cached = loadRowsFromStorage();
      if (cached) {
        setRows(cached, { source: 'csv' });
        if (uploadHintEl) uploadHintEl.textContent = uploadHintDefault;
        saveRowsToStorage();
      } else {
        alert('No saved CSV found in this browser. Upload a DIM CSV first.');
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      setRows([], { source: appState.source });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn('Failed to clear cache', err);
      }
      if (fileInput) fileInput.value = '';
      if (uploadHintEl) uploadHintEl.textContent = uploadHintDefault;
    });
  }
  if (tolInput) {
    tolInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      patchState({ tol: value });
    });
  }
  if (viewToggleEl) {
    viewToggleEl.addEventListener('change', (event) => {
      patchState({ view: event.target.checked ? 'current' : 'base' });
    });
  }
}

function updateUI(state) {
  if (!rowsHost) return;
  const tolInput = rootEl.querySelector('#tol');
  if (tolInput) {
    tolInput.value = state.tol;
  }
  renderSegment('classSeg', CLASS_OPTIONS, 'classFilter');
  renderSegment('raritySeg', RARITY_OPTIONS, 'rarityFilter');
  renderSegment('slotSeg', SLOT_OPTIONS, 'slotFilter');
  renderSegment('dupesSeg', DUPES_OPTIONS, 'dupesFilter');
  updateShadowColor(state);
  updateDimStatus(state);
  updateStatTitle(state);
  renderTable(state);
}

function updateStatTitle(state) {
  if (!statTitleEl) return;
  const view = state.view === 'current' ? 'Current Stats' : 'Base Stats';
  statTitleEl.innerHTML = `${view} <div class="center-info">(Health, Melee, Grenade, Super, Class, Weapons)</div>`;
  if (viewToggleEl) {
    viewToggleEl.checked = state.view === 'current';
  }
}

function updateDimStatus(state) {
  if (!dimStatusEl) return;
  const connected = !!state.dim?.accessToken;
  dimStatusEl.textContent = connected ? 'DIM: Connected ✓' : 'DIM: Not Connected';
}

function renderSegment(containerId, options, key) {
  const el = rootEl.querySelector(`#${containerId}`);
  if (!el) return;
  el.innerHTML = '';
  options.forEach((option) => {
    const button = document.createElement('button');
    button.className = 'chip' + (appState[key] === option ? ' active' : '');
    let label = option;
    if (containerId === 'classSeg' && CLASS_ICONS[option]) {
      label = `<span class="chip-icon-mask" style="mask-image:url('${CLASS_ICONS[option]}');-webkit-mask-image:url('${CLASS_ICONS[option]}');"></span>${option}`;
    }
    if (containerId === 'raritySeg' && RARITY_ICONS[option]) {
      label = `<img src="${RARITY_ICONS[option]}" alt="${option}" title="${option}" class="chip-icon rarity" style="height:1em;vertical-align:middle;margin-right:4px;">${option}`;
    }
    if (containerId === 'slotSeg' && SLOT_ICONS[option]) {
      label = `<span class="chip-icon-mask" style="mask-image:url('${SLOT_ICONS[option]}');-webkit-mask-image:url('${SLOT_ICONS[option]}');"></span>${option}`;
    }
    button.innerHTML = (appState[key] === option ? '● ' : '○ ') + label;
    button.addEventListener('click', () => {
      const patch = {};
      patch[key] = option;
      patchState(patch);
    });
    el.appendChild(button);
  });
}

function updateShadowColor(state) {
  const root = document.documentElement;
  if (state.rarityFilter === 'Legendary') {
    root.style.setProperty('--shadow', 'var(--shadow-purple)');
  } else if (state.rarityFilter === 'Exotic') {
    root.style.setProperty('--shadow', 'var(--shadow-gold)');
  } else {
    root.style.setProperty('--shadow', 'var(--shadow-base)');
  }
}

function renderTable(state) {
  const filtered = getFiltered(state);
  state.groupedRows = filtered;
  if (!filtered.length) {
    rowsHost.innerHTML = '';
    if (emptyHost) emptyHost.style.display = 'block';
    return;
  }
  if (emptyHost) emptyHost.style.display = 'none';

  const groupToIds = new Map();
  filtered.forEach((item) => {
    if (item.Dupe_Group && item.Dupe_Group !== 'X') {
      const key = `${item.GroupKey || ''}::${item.Dupe_Group}`;
      if (!groupToIds.has(key)) groupToIds.set(key, []);
      groupToIds.get(key).push(normId(item.Id));
    }
  });

  rowsHost.innerHTML = '';
  let lastGroup = null;
  let altToggle = false;
  filtered.forEach((item) => {
    if (item.Dupe_Group !== lastGroup) {
      altToggle = !altToggle;
      lastGroup = item.Dupe_Group;
    }
    const row = document.createElement('div');
    row.className = 'row item ' + (altToggle ? 'altA' : 'altB');

    const currentTag = appState.dimTagsByInstanceId[item.dimId]?.tag || item.Tag || '';

    const tagCol = document.createElement('div');
    tagCol.className = 'center tag-col';
    const emojiSpan = document.createElement('div');
    emojiSpan.textContent = TAG_EMOJIS[currentTag] || '';
    emojiSpan.title = TAG_LABELS[currentTag] || '';
    const select = document.createElement('select');
    select.className = 'tag-select';
    ['','favorite','keep','infuse','archive','junk'].forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      if (tag === currentTag) option.selected = true;
      select.appendChild(option);
    });
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-save-tag';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      await handleTagSave(item, select.value, row, emojiSpan);
    });
    tagCol.append(emojiSpan, select, saveBtn);

    const itemCol = document.createElement('div');
    itemCol.innerHTML = `
      <div style="font-weight:700">${item.Name}</div>
      <div class="itemmeta">
        ${( ['Warlock Bond','Hunter Cloak','Titan Mark'].includes(item.Type) ? 'Class Item' : item.Type )}
        • ${item.Equippable}
        • ${RARITY_ICONS[item.Rarity] ? `<img src="${RARITY_ICONS[item.Rarity]}" alt="${item.Rarity}" title="${item.Rarity}" style="height:1em;vertical-align:middle;">` : ''}
      </div>
      <div class="tiny mono">${normId(item.Id)}</div>
    `;

    const tierCol = document.createElement('div');
    tierCol.className = 'tier';
    const tierValue = Number.isFinite(item.Tier) ? Number(item.Tier) : 0;
    tierCol.textContent = '♦'.repeat(Math.max(1, Math.min(5, tierValue)));

    const statsCol = document.createElement('div');
    statsCol.className = 'chips';
    STAT_COLS.forEach((key) => {
      const pill = document.createElement('span');
      const coreKey = STAT_TO_CORE[key];
      const view = state.view === 'current' ? 'current' : 'base';
      const statValue = view === 'current'
        ? (item._betaStats?.current?.[coreKey] ?? item[key.replace(' (Base)', '')] ?? item[key] ?? 0)
        : (item._betaStats?.base?.[coreKey] ?? item[key] ?? 0);
      pill.className = `chipStat ${statColorCls(statValue)}`;
      pill.title = key.replace(' (Base)', '');
      const icon = STAT_ICONS[key];
      if (icon) {
        const img = document.createElement('img');
        img.className = 'stat-ico';
        img.alt = key;
        img.src = icon;
        pill.appendChild(img);
      }
      const strong = document.createElement('strong');
      strong.className = 'mono';
      strong.textContent = String(statValue || 0);
      pill.appendChild(strong);
      statsCol.appendChild(pill);
    });

    const totalCol = document.createElement('div');
    totalCol.className = 'center';
    totalCol.style.fontWeight = '700';
    const totalValue = state.view === 'current'
      ? (item._betaStats?.current?.total ?? item['Total (Base)'])
      : item['Total (Base)'];
    totalCol.textContent = String(totalValue || 0);

    const groupCol = document.createElement('div');
    groupCol.className = 'center';
    if (item.Dupe_Group && item.Dupe_Group !== 'X') {
      const label = item.Dupe_Group;
      const key = `${item.GroupKey || ''}::${item.Dupe_Group}`;
      const ids = (groupToIds.get(key) || []).map((id) => `id:${id}`).join(' or ');
      const span = document.createElement('span');
      span.className = 'badge-warn';
      span.title = 'Click to copy all IDs in this dupe group';
      if (/🟡/.test(label) && RARITY_ICONS[item.Rarity]) {
        const textNoYellow = label.replace('🟡', '');
        const prefixMatch = textNoYellow.match(/^(⚠️)?(.*)$/);
        const prefix = prefixMatch && prefixMatch[1] ? '⚠️' : '';
        const rest = prefixMatch && prefixMatch[2] ? prefixMatch[2] : textNoYellow;
        if (prefix) span.append(prefix);
        const img = new Image();
        img.src = RARITY_ICONS[item.Rarity];
        img.alt = item.Rarity;
        img.title = item.Rarity;
        img.style.height = '1em';
        img.style.verticalAlign = 'middle';
        img.style.marginRight = '4px';
        span.appendChild(img);
        span.append(rest);
      } else {
        span.append(label);
      }
      span.addEventListener('click', async () => {
        const ok = await copyTextSafe(ids);
        if (!ok) alert('Copy failed');
      });
      groupCol.appendChild(span);
    } else {
      groupCol.innerHTML = `<span class='badge-ok'>✅</span>`;
    }

    const rankCol = document.createElement('div');
    rankCol.className = 'center';
    rankCol.textContent = item.Rank || '';

    const copyCol = document.createElement('div');
    copyCol.className = 'center';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = 'Copy id';
    copyBtn.addEventListener('click', async () => {
      const ok = await copyTextSafe(`id:${normId(item.Id)}`);
      copyBtn.textContent = ok ? 'Copied!' : 'Copy id';
      setTimeout(() => {
        copyBtn.textContent = 'Copy id';
      }, 1200);
    });
    copyCol.appendChild(copyBtn);

    row.append(tagCol, itemCol, tierCol, statsCol, totalCol, groupCol, rankCol, copyCol);
    rowsHost.appendChild(row);
  });
}

async function handleTagSave(item, newTag, row, emojiSpan) {
  if (!appState.dim?.accessToken) {
    alert('Connect to DIM first by signing in and authorizing.');
    return;
  }
  const existing = appState.dimTagsByInstanceId[item.dimId] || {
    itemInstanceId: item.dimId,
    tag: null,
    notes: null
  };
  const updated = { ...existing, tag: newTag || null };
  const updates = [{ action: 'tag', payload: { ...updated } }];
  try {
    await applyDimUpdates({ membershipId: appState.membershipId, updates });
    const next = { ...appState.dimTagsByInstanceId, [item.dimId]: updated };
    setDimTags(next);
    if (emojiSpan) {
      emojiSpan.textContent = TAG_EMOJIS[newTag] || '';
      emojiSpan.title = TAG_LABELS[newTag] || '';
    }
    row.style.outline = '2px solid #4caf50';
    setTimeout(() => {
      row.style.outline = '';
    }, 800);
  } catch (err) {
    console.error('DIM update failed', err);
    row.style.outline = '2px solid #f44336';
    setTimeout(() => {
      row.style.outline = '';
    }, 1200);
    alert('Failed to update DIM tag. Check console for details.');
  }
}

function getFiltered(state) {
  const expectedClassItem = classItemByClass[state.classFilter];
  const baseFiltered = (state.rows || []).filter((row) => {
    const matchesClass = state.classFilter ? row.Equippable === state.classFilter : true;
    const matchesSlot = state.slotFilter === 'All'
      ? true
      : state.slotFilter === 'Class Item'
      ? row.Type === expectedClassItem
      : row.Type === state.slotFilter;
    const matchesRarity = state.rarityFilter === 'All' ? true : row.Rarity === state.rarityFilter;
    return matchesClass && matchesSlot && matchesRarity;
  });

  const grouped = clusterRows(baseFiltered, { tol: state.tol });

  if (state.dupesFilter === 'Only Dupes') {
    return grouped.filter((row) => row.Dupe_Group && row.Dupe_Group !== 'X');
  }
  if (state.dupesFilter === 'Only Same-Name') {
    const dupeGroups = {};
    grouped.forEach((row) => {
      if (row.Dupe_Group && row.Dupe_Group !== 'X') {
        const key = `${row.GroupKey}::${row.Dupe_Group}`;
        if (!dupeGroups[key]) dupeGroups[key] = [];
        dupeGroups[key].push(row);
      }
    });
    const validIds = new Set();
    Object.values(dupeGroups).forEach((rows) => {
      const names = new Set(rows.map((row) => row.Name.toLowerCase()));
      if (names.size === 1) {
        rows.forEach((row) => validIds.add(row.Id));
      }
    });
    return grouped.filter((row) => validIds.has(row.Id));
  }
  return grouped;
}
