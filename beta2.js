const STAT_COLS = [
  'Health (Base)',
  'Melee (Base)',
  'Grenade (Base)',
  'Super (Base)',
  'Class (Base)',
  'Weapons (Base)'
];

const STAT_ICONS = {
  'Health (Base)': 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
  'Melee (Base)': 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
  'Grenade (Base)': 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
  'Super (Base)': 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
  'Class (Base)': 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
  'Weapons (Base)': 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
};

const RARITY_ICONS = {
  Basic: '',
  Common: '',
  Uncommon: '',
  Rare: '',
  Legendary: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png',
  Exotic: 'https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png'
};

const CLASS_ICONS = {
  Warlock: 'https://www.bungie.net/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png',
  Hunter: 'https://www.bungie.net/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png',
  Titan: 'https://www.bungie.net/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png'
};

const SLOT_ICONS = {
  Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg',
  Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg',
  'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg',
  'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg',
  'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg'
};

const TAG_EMOJIS = { favorite: '❤️', keep: '🏷️', junk: '🚫', infuse: '⚡', archive: '📦' };
const TAG_LABELS = { favorite: 'Favorite', keep: 'Keep', junk: 'Junk', infuse: 'Infuse', archive: 'Archive' };
const CLASS_OPTIONS = ['Warlock', 'Hunter', 'Titan'];
const RARITY_OPTIONS = ['All', 'Common', 'Uncommon', 'Rare', 'Legendary', 'Exotic'];
const SLOT_OPTIONS = ['All', 'Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'];
const DUPE_OPTIONS = ['All', 'Only Dupes', 'Only Same-Name'];
const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
const THEME_OPTIONS = [
  { id: 'calus', label: 'Calus Royal', hint: 'Purple / Ivory / Gold' },
  { id: 'taken', label: 'Taken', hint: 'Black / White / Cyan' },
  { id: 'trials', label: 'Trials Gold', hint: 'Black / White / Gold' },
  { id: 'void', label: 'Void Neon', hint: 'Violet / Magenta / Blue' },
  { id: 'iron', label: 'Iron Banner', hint: 'Charcoal / Brass / Red' },
  { id: 'vanguard', label: 'Vanguard', hint: 'Navy / Orange / White' }
];

const LS_ROWS = 'd2aa_beta2_rows_v1';
const LS_THEME = 'd2aa_beta2_theme_v1';
let STATE = {
  rows: [],
  classFilter: 'Warlock',
  rarityFilter: 'All',
  slotFilter: 'All',
  dupesFilter: 'All',
  search: '',
  sortBy: 'default',
  tol: 5,
  visible: []
};

const $ = (id) => document.getElementById(id);
const normId = (s) => (s ? String(s).trim().replace(/^"|"$/g, '') : '');
const normName = (s) => String(s || '').trim().toLowerCase();
const num = (v) => (v == null || v === '' ? 0 : Number(v));
const slotLabel = (type) => ['Warlock Bond', 'Hunter Cloak', 'Titan Mark'].includes(type) ? 'Class Item' : type;
const slotNumber = (type) => ({ Helmet: 1, Gauntlets: 2, 'Chest Armor': 3, 'Leg Armor': 4, 'Warlock Bond': 5, 'Hunter Cloak': 5, 'Titan Mark': 5, 'Class Item': 5 }[type] || 9);
const rarityClass = (rarity) => `rarity-${String(rarity || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
const rarityLabel = (rarity) => String(rarity || 'Unknown').trim() || 'Unknown';
const rankScore = (rank) => (rank.match(/★/g) || []).length;
const legendaryRank = (t) => { const n = num(t); if (n >= 75) return '★★★★★'; if (n === 74) return '★★★★☆'; if (n === 73) return '★★★☆☆'; if (n === 72) return '★★☆☆☆'; if (n === 71) return '★☆☆☆☆'; return '💩'; };
const exoticRank = (t) => { const n = num(t); if (n >= 63) return '★★★★★'; if (n === 62) return '★★★★☆'; if (n === 61) return '★★★☆☆'; if (n === 60) return '★★☆☆☆'; if (n === 59) return '★☆☆☆☆'; return '💩'; };
const statClass = (v) => { const n = num(v); if (n >= 30) return 'stat-cyan'; if (n >= 24) return 'stat-green'; if (n >= 15) return 'stat-yellow'; return 'stat-red'; };

function top3Entries(item) {
  return STAT_COLS.map((name) => ({ name, value: num(item[name]) }))
    .sort((a, b) => (b.value - a.value) || a.name.localeCompare(b.name))
    .slice(0, 3);
}

function similarTop3(a, b, tol) {
  const ta = top3Entries(a);
  const tb = top3Entries(b);
  return ta.every((entry, i) => entry.name === tb[i].name && Math.abs(entry.value - tb[i].value) <= tol);
}

function saveRows() {
  try { localStorage.setItem(LS_ROWS, JSON.stringify(STATE.rows)); } catch (_) {}
}

function loadRows() {
  try {
    const raw = localStorage.getItem(LS_ROWS);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'sr-only';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function iconImg(src, alt, className = '') {
  const img = document.createElement('img');
  img.src = src || '';
  img.alt = alt;
  img.title = alt;
  if (className) img.className = className;
  return img;
}

function maskedIcon(src, label) {
  const span = document.createElement('span');
  span.className = 'seg-mask';
  span.title = label;
  span.setAttribute('aria-hidden', 'true');
  span.style.maskImage = `url('${src}')`;
  span.style.webkitMaskImage = `url('${src}')`;
  return span;
}

function clusterRows(filtered) {
  const byKey = new Map();
  for (const row of filtered) {
    const key = row.Rarity === 'Exotic' ? `${row.Type}|${normName(row.Name)}` : row.Type;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ ...row });
  }

  const out = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (const [key, items] of byKey) {
    const assigned = Array(items.length).fill(false);
    const groups = [];

    for (let i = 0; i < items.length; i++) {
      if (assigned[i]) continue;
      const group = [i];
      assigned[i] = true;
      for (let j = i + 1; j < items.length; j++) {
        if (assigned[j]) continue;
        if (similarTop3(items[i], items[j], STATE.tol)) {
          group.push(j);
          assigned[j] = true;
        }
      }
      groups.push(group);
    }

    groups.sort((a, b) => Math.max(...b.map((i) => num(items[i]['Total (Base)']))) - Math.max(...a.map((i) => num(items[i]['Total (Base)']))));

    let letterIdx = 0;
    const isExoticGroupKey = key.includes('|');
    for (const group of groups) {
      const first = items[group[0]];
      const label = group.length > 1 ? `${slotNumber(first.Type)}${letters[Math.min(letterIdx++, letters.length - 1)]}` : 'X';
      for (const idx of group) {
        const item = items[idx];
        const rank = item.Rarity === 'Exotic' ? exoticRank(item['Total (Base)']) : legendaryRank(item['Total (Base)']);
        out.push({
          ...item,
          GroupKey: key,
          Dupe_Group: label,
          Rank: rank,
          RankScore: rankScore(rank),
          Is_Dupe: label !== 'X',
          Is_Dupe_Exotic: isExoticGroupKey && label !== 'X'
        });
      }
    }
  }

  out.sort(defaultSort);
  return out;
}

function defaultSort(a, b) {
  const slot = slotNumber(a.Type) - slotNumber(b.Type);
  if (slot) return slot;
  const rarity = (a.Rarity === 'Legendary' ? 0 : 1) - (b.Rarity === 'Legendary' ? 0 : 1);
  if (rarity) return rarity;
  const dupe = Number(b.Is_Dupe) - Number(a.Is_Dupe);
  if (dupe) return dupe;
  if (a.GroupKey !== b.GroupKey) return String(a.GroupKey).localeCompare(String(b.GroupKey));
  if (a.Dupe_Group !== b.Dupe_Group) return String(a.Dupe_Group).localeCompare(String(b.Dupe_Group));
  if (b.RankScore !== a.RankScore) return b.RankScore - a.RankScore;
  const total = num(b['Total (Base)']) - num(a['Total (Base)']);
  if (total) return total;
  return String(a.Id).localeCompare(String(b.Id));
}

function getFiltered() {
  const expectedClassItem = CLASS_ITEM_BY_CLASS[STATE.classFilter];
  let filtered = STATE.rows.filter((row) => {
    const slot = slotLabel(row.Type);
    const q = STATE.search.trim().toLowerCase();
    const matchesSearch = !q || String(row.Name || '').toLowerCase().includes(q) || String(row.Id || '').toLowerCase().includes(q) || String(row.Type || '').toLowerCase().includes(q);
    return row.Equippable === STATE.classFilter &&
      (STATE.rarityFilter === 'All' || row.Rarity === STATE.rarityFilter) &&
      (STATE.slotFilter === 'All' || (STATE.slotFilter === 'Class Item' ? row.Type === expectedClassItem : row.Type === STATE.slotFilter)) &&
      matchesSearch;
  });

  filtered = clusterRows(filtered);

  if (STATE.dupesFilter === 'Only Dupes') filtered = filtered.filter((row) => row.Is_Dupe);
  if (STATE.dupesFilter === 'Only Same-Name') {
    const grouped = new Map();
    for (const row of filtered.filter((r) => r.Is_Dupe)) {
      const key = `${row.GroupKey}::${row.Dupe_Group}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    const keepIds = new Set();
    for (const rows of grouped.values()) {
      if (new Set(rows.map((r) => normName(r.Name))).size === 1) rows.forEach((r) => keepIds.add(r.Id));
    }
    filtered = filtered.filter((row) => keepIds.has(row.Id));
  }

  if (STATE.sortBy === 'totalDesc') filtered.sort((a, b) => num(b['Total (Base)']) - num(a['Total (Base)']));
  if (STATE.sortBy === 'rankDesc') filtered.sort((a, b) => b.RankScore - a.RankScore || num(b['Total (Base)']) - num(a['Total (Base)']));
  if (STATE.sortBy === 'nameAsc') filtered.sort((a, b) => String(a.Name).localeCompare(String(b.Name)) || defaultSort(a, b));
  if (STATE.sortBy === 'slotAsc') filtered.sort(defaultSort);

  return filtered;
}

function makeThemeButtons() {
  const host = $('themeToggle');
  if (!host) return;
  host.textContent = '';
  const stored = localStorage.getItem(LS_THEME) || 'calus';
  document.body.dataset.theme = THEME_OPTIONS.some((t) => t.id === stored) ? stored : 'calus';
  for (const theme of THEME_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.dataset.themeOption = theme.id;
    btn.innerHTML = `<span class="theme-title">${theme.label}</span><span class="theme-hint">${theme.hint}</span>`;
    btn.addEventListener('click', () => {
      document.body.dataset.theme = theme.id;
      localStorage.setItem(LS_THEME, theme.id);
      makeThemeButtons();
    });
    btn.classList.toggle('is-active', document.body.dataset.theme === theme.id);
    host.appendChild(btn);
  }
}

function makeSegment(hostId, options, stateKey, iconMap = null, useMask = false) {
  const host = $(hostId);
  if (!host) return;
  host.textContent = '';
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.classList.toggle('is-active', STATE[stateKey] === opt);
    btn.title = opt;
    if (iconMap && iconMap[opt]) btn.appendChild(useMask ? maskedIcon(iconMap[opt], opt) : iconImg(iconMap[opt], opt, 'seg-icon'));
    const txt = document.createElement('span');
    txt.textContent = opt;
    btn.appendChild(txt);
    btn.addEventListener('click', () => { STATE[stateKey] = opt; render(); });
    host.appendChild(btn);
  }
}

function renderSegments() {
  makeSegment('classSeg', CLASS_OPTIONS, 'classFilter', CLASS_ICONS, true);
  makeSegment('raritySeg', RARITY_OPTIONS, 'rarityFilter', RARITY_ICONS, false);
  makeSegment('slotSeg', SLOT_OPTIONS, 'slotFilter', SLOT_ICONS, true);
  makeSegment('dupesSeg', DUPE_OPTIONS, 'dupesFilter');
}

function renderStats(row) {
  const wrap = document.createElement('div');
  wrap.className = 'stat-chips';
  for (const stat of STAT_COLS) {
    const value = num(row[stat]);
    const chip = document.createElement('span');
    chip.className = `stat-chip ${statClass(value)}`;
    chip.title = `${stat.replace(' (Base)', '')}: ${value}`;
    chip.appendChild(iconImg(STAT_ICONS[stat], stat.replace(' (Base)', '')));
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    chip.appendChild(strong);
    wrap.appendChild(chip);
  }
  return wrap;
}

function renderGroupBadge(row, groupIds) {
  const cell = document.createElement('div');
  cell.className = 'center';
  if (!row.Is_Dupe) {
    const ok = document.createElement('span');
    ok.className = 'ok-badge';
    ok.title = 'No duplicate group';
    ok.textContent = '✅';
    cell.appendChild(ok);
    return cell;
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'group-badge';
  btn.title = 'Copy all DIM IDs in this duplicate group';
  btn.append('⚠️');
  if (row.Is_Dupe_Exotic) btn.appendChild(iconImg(RARITY_ICONS.Exotic, 'Exotic duplicate group', 'badge-icon'));
  btn.append(row.Dupe_Group);
  btn.addEventListener('click', async () => {
    const ok = await copyText(groupIds.map((id) => `id:${id}`).join(' or '));
    const old = btn.textContent;
    btn.textContent = ok ? 'Copied' : 'Failed';
    setTimeout(() => render(), 900);
  });
  cell.appendChild(btn);
  return cell;
}

function renderRow(row, groupMap) {
  const el = document.createElement('div');
  el.className = `armor-grid armor-row ${rarityClass(row.Rarity)}${row.Is_Dupe ? ' is-dupe' : ''}`;
  el.dataset.rarity = rarityLabel(row.Rarity);

  const tagCell = document.createElement('div');
  tagCell.className = 'center tag-cell';
  const tag = String(row.Tag || '').toLowerCase();
  tagCell.textContent = TAG_EMOJIS[tag] || '';
  tagCell.title = TAG_LABELS[tag] || 'No DIM tag';

  const itemCell = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'item-name';
  name.textContent = row.Name || '(Unnamed item)';
  const meta = document.createElement('div');
  meta.className = 'item-meta';
  const rarityIcon = iconImg(RARITY_ICONS[row.Rarity], row.Rarity || 'Rarity', 'rarity-ico-inline');
  meta.append(`${slotLabel(row.Type)} • ${row.Equippable} • `, rarityIcon, ` ${row.Rarity || ''}`);
  const id = document.createElement('div');
  id.className = 'item-id';
  id.textContent = normId(row.Id);
  itemCell.append(name, meta, id);

  const tier = document.createElement('div');
  tier.className = 'center tier';
  tier.title = `Tier ${num(row.Tier)}`;
  tier.textContent = '♦'.repeat(Math.max(1, Math.min(5, num(row.Tier))));

  const total = document.createElement('div');
  total.className = 'center total-value';
  total.textContent = String(num(row['Total (Base)']));

  const groupKey = `${row.GroupKey}::${row.Dupe_Group}`;
  const group = renderGroupBadge(row, groupMap.get(groupKey) || []);

  const rank = document.createElement('div');
  rank.className = 'center';
  rank.title = row.Rarity === 'Exotic' ? 'Exotic rank threshold' : 'Legendary rank threshold';
  rank.textContent = row.Rank;

  const copy = document.createElement('div');
  copy.className = 'right';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-btn';
  btn.textContent = 'Copy ID';
  btn.title = 'Copy DIM item ID filter';
  btn.addEventListener('click', async () => {
    const ok = await copyText(`id:${normId(row.Id)}`);
    btn.textContent = ok ? 'Copied' : 'Failed';
    setTimeout(() => { btn.textContent = 'Copy ID'; }, 1000);
  });
  copy.appendChild(btn);

  el.append(tagCell, itemCell, tier, renderStats(row), total, group, rank, copy);
  return el;
}

function updateSummary(rows) {
  const groups = new Set(rows.filter((r) => r.Is_Dupe).map((r) => `${r.GroupKey}::${r.Dupe_Group}`));
  const avg = rows.length ? Math.round(rows.reduce((sum, r) => sum + num(r['Total (Base)']), 0) / rows.length) : 0;
  $('summaryShown').textContent = rows.length;
  $('summaryDupes').textContent = rows.filter((r) => r.Is_Dupe).length;
  $('summaryGroups').textContent = groups.size;
  $('summaryAvg').textContent = avg;
  $('resultCount').textContent = `${rows.length} shown`;
}

function render() {
  renderSegments();
  const rows = getFiltered();
  STATE.visible = rows;
  updateSummary(rows);
  $('tolOut').textContent = `±${STATE.tol}`;

  const groupMap = new Map();
  for (const row of rows.filter((r) => r.Is_Dupe)) {
    const key = `${row.GroupKey}::${row.Dupe_Group}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(normId(row.Id));
  }

  const host = $('rows');
  host.textContent = '';
  $('empty').classList.toggle('is-hidden', rows.length > 0);
  for (const row of rows) host.appendChild(renderRow(row, groupMap));
}

function parseRows(data) {
  return data.map((row) => {
    const x = { ...row };
    for (const key of [...STAT_COLS, 'Total (Base)', 'Tier']) x[key] = Number.isFinite(num(x[key])) ? num(x[key]) : 0;
    x.Id = normId(x.Id);
    return x;
  }).filter((row) => row.Id && row.Name && row.Type && row.Equippable);
}

function bindEvents() {
  const file = $('file');
  const uploadTrigger = $('uploadTrigger');
  const uploadHint = $('uploadHint');
  const defaultHint = uploadHint?.dataset.default || 'Choose DIM Armor.csv';

  uploadTrigger?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      file.click();
    }
  });

  file.addEventListener('change', (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        STATE.rows = parseRows(res.data || []);
        saveRows();
        uploadHint.textContent = `Loaded • ${selected.name}`;
        file.value = '';
        render();
      }
    });
  });

  $('restoreBtn').addEventListener('click', () => {
    const rows = loadRows();
    if (!Array.isArray(rows)) { alert('No saved CSV found in this browser. Upload a DIM CSV first.'); return; }
    STATE.rows = rows;
    uploadHint.textContent = defaultHint;
    render();
  });

  $('clearBtn').addEventListener('click', () => {
    STATE.rows = [];
    localStorage.removeItem(LS_ROWS);
    uploadHint.textContent = defaultHint;
    render();
  });

  $('searchBox').addEventListener('input', (event) => { STATE.search = event.target.value; render(); });
  $('sortBy').addEventListener('change', (event) => { STATE.sortBy = event.target.value; render(); });
  $('tol').addEventListener('input', (event) => { STATE.tol = Number(event.target.value) || 0; render(); });
  $('copyVisibleBtn').addEventListener('click', async () => {
    const ids = STATE.visible.map((row) => `id:${normId(row.Id)}`).filter(Boolean).join(' or ');
    if (!ids) return;
    const ok = await copyText(ids);
    const btn = $('copyVisibleBtn');
    const old = btn.querySelector('.action-title').textContent;
    btn.querySelector('.action-title').textContent = ok ? 'Copied visible IDs' : 'Copy failed';
    setTimeout(() => { btn.querySelector('.action-title').textContent = old; }, 1200);
  });
}

makeThemeButtons();
bindEvents();
const cached = loadRows();
if (Array.isArray(cached)) STATE.rows = cached;
render();
