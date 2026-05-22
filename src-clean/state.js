import { STORAGE_KEYS, ARCHETYPE_ALIASES } from './constants.js';
import { sortRows } from './data/sort.js';

const listeners = new Set();
const ARCHETYPE_STATS = [
  ['Health', 'Health'],
  ['Melee', 'Melee'],
  ['Grenade', 'Grenade'],
  ['Super', 'Super'],
  ['ClassAbility', 'Class'],
  ['Weapon', 'Weapon']
];
const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BONUS_TYPES = ['Masterwork', 'Mod', 'Artifice', 'Other'];

export const state = {
  rows: [],
  view: 'grid',
  search: '',
  filters: { class: 'all', slot: 'all', rarity: 'all' },
  sortBy: 'default',
  duplicateTolerance: 5,
  theme: 'calus',
  tags: readJson(STORAGE_KEYS.tags, {}),
  dismissedRecent: readJson(STORAGE_KEYS.dismissedRecent, {}),
  status: 'Ready.'
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  persistSettings();
  emit();
}

export function setRows(rows, status = 'Rows loaded.') {
  state.rows = rows.map((row, index) => normalizeStoredRow({ ...row, _index: index, Tag: state.tags[row.Id] || row.Tag || '' }));
  state.status = status;
  saveRows(state.rows);
  emit();
}

export function updateTag(id, tag) {
  const nextTag = state.tags[id] === tag ? '' : tag;
  if (nextTag) state.tags[id] = nextTag;
  else delete state.tags[id];
  if (nextTag) state.dismissedRecent[id] = Date.now();
  state.rows = state.rows.map((row) => row.Id === id ? { ...row, Tag: nextTag, ...(nextTag ? { RecentStatus: '', RecentlyFound: false } : {}) } : row);
  writeJson(STORAGE_KEYS.tags, state.tags);
  writeJson(STORAGE_KEYS.dismissedRecent, state.dismissedRecent);
  saveRows(state.rows);
  emit();
}

export function dismissRecent(id) {
  state.dismissedRecent[id] = Date.now();
  state.rows = state.rows.map((row) => row.Id === id ? { ...row, RecentStatus: '', RecentlyFound: false } : row);
  writeJson(STORAGE_KEYS.dismissedRecent, state.dismissedRecent);
  saveRows(state.rows);
  emit();
}

export function getFilteredRows() {
  const q = state.search.trim().toLowerCase();
  const activeClass = normalizeClassFilter(state.filters.class);
  const rows = state.rows.filter((row) => {
    if (activeClass !== 'all' && !rowMatchesClass(row, activeClass)) return false;
    if (state.filters.slot !== 'all' && row.Slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && row.Rarity !== state.filters.rarity) return false;
    if (!q) return true;
    return [row.Name, row.Id, row.Slot, row.Type, row.Class, row.Equippable, row.Rarity, row.Archetype].some((value) => String(value || '').toLowerCase().includes(q));
  });
  return sortRows(rows, state.sortBy);
}

export function normalizeClassFilter(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('warlock') || text === 'w') return 'Warlock';
  if (text.includes('hunter') || text === 'h') return 'Hunter';
  if (text.includes('titan') || text === 't') return 'Titan';
  return 'all';
}

export function rowMatchesClass(row, className) {
  const target = normalizeClassFilter(className);
  if (target === 'all') return true;
  return [row.Equippable, row.Class, row.Type, row.BucketClass, row.ItemType]
    .some((value) => normalizeClassFilter(value) === target);
}

export function normalizeStoredRow(row) {
  const characterClass = normalizeClassFilter(row.Equippable || row.Class || row.CharacterClass);
  const classAbility = number(row.ClassAbility || (isClassName(row.Class) ? 0 : row.Class));
  const normalized = { ...row, ClassAbility: classAbility };
  const dismissed = Boolean(state.dismissedRecent[row.Id]);
  return {
    ...normalized,
    Class: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    Equippable: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    RecentStatus: dismissed && row.RecentStatus === 'new' ? '' : row.RecentStatus,
    RecentlyFound: dismissed ? false : row.RecentlyFound,
    Archetype: normalizeArchetype(row.Archetype, row.Slot, normalized)
  };
}

function isClassName(value) { return normalizeClassFilter(value) !== 'all'; }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function normalizeArchetype(value, slot, row = {}) {
  const text = String(value || '').trim();
  const a = normalizeKey(text);
  const s = normalizeKey(slot);
  if (text && a !== s && text !== '—' && text !== '-') return archetypeNameFrom(text) || text;
  return archetypeNameFrom(deriveArchetype(row)) || '—';
}
function deriveArchetype(row = {}) {
  let bestLabel = '';
  let bestValue = -1;
  for (const [key, label] of ARCHETYPE_STATS) {
    const value = number(row[key]);
    if (value > bestValue) {
      bestValue = value;
      bestLabel = label;
    }
  }
  return bestValue > 0 ? bestLabel : '';
}
function archetypeNameFrom(value) {
  return ARCHETYPE_ALIASES[normalizeKey(value)] || '';
}
function normalizeKey(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

export function loadCachedRows() {
  const cached = readJson(STORAGE_KEYS.rows, []);
  if (Array.isArray(cached) && cached.length) {
    setRows(cached, `Loaded ${cached.length} cached clean rows.`);
    return true;
  }
  return false;
}

export function saveRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    try { writeJson(STORAGE_KEYS.rows, []); } catch (_) {}
    return;
  }
  if (rows.every((row) => row.Source === 'Bungie')) {
    try { localStorage.removeItem(STORAGE_KEYS.rows); } catch (_) {}
    return;
  }
  const slim = rows.map(slimRowForStorage);
  try {
    writeJson(STORAGE_KEYS.rows, slim);
  } catch (error) {
    console.warn('D2AA clean cache write skipped because browser storage is full.', error);
    try { localStorage.removeItem(STORAGE_KEYS.rows); } catch (_) {}
    state.status = 'Loaded rows, but browser storage is full. Clear old D2AA cache if reload cache is needed.';
  }
}

export function clearCache() {
  localStorage.removeItem(STORAGE_KEYS.rows);
  localStorage.removeItem(STORAGE_KEYS.bungieRows);
  localStorage.removeItem(STORAGE_KEYS.bungieMeta);
  try { indexedDB.deleteDatabase('d2aa-clean-cache'); } catch (_) {}
  setRows([], 'Inventory cache cleared. New-item baseline, dismissed feed items, and tags were kept.');
}

export function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function slimRowForStorage(row) {
  const slim = { ...row };
  delete slim._index;
  delete slim.Group;
  delete slim.GroupActionKey;
  delete slim.GroupColor;
  delete slim.Is_Dupe;
  delete slim.Dupe_Group;
  delete slim.SortGroup;

  for (const key of STAT_KEYS) {
    slim[key] = row[key];
    slim[`Base${key}`] = row[`Base${key}`];
    slim[`Current${key}`] = row[`Current${key}`];
    slim[`StatBonus${key}`] = row[`StatBonus${key}`];
    for (const type of BONUS_TYPES) slim[`${type}Bonus${key}`] = row[`${type}Bonus${key}`];
  }
  for (const type of BONUS_TYPES) slim[`${type}BonusTotal`] = row[`${type}BonusTotal`];

  slim.ArmorSetBonuses = cloneJsonSafe(row.ArmorSetBonuses || row.SetBonuses || []);
  slim.SetBonuses = cloneJsonSafe(row.SetBonuses || row.ArmorSetBonuses || []);
  slim.ArmorBonuses = cloneJsonSafe(row.ArmorBonuses || row.ArmorPerks || []);
  slim.ArmorPerks = cloneJsonSafe(row.ArmorPerks || row.ArmorBonuses || []);
  slim.StatAudit = cloneJsonSafe(row.StatAudit || null);
  slim.SocketAudit = cloneJsonSafe(row.SocketAudit || null);
  slim.DefinitionAudit = cloneJsonSafe(row.DefinitionAudit || null);
  slim.EnhancedDefinitions = cloneJsonSafe(row.EnhancedDefinitions || null);
  return slim;
}

function cloneJsonSafe(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

function persistSettings() {
  writeJson(STORAGE_KEYS.settings, { view: state.view, theme: state.theme, filters: state.filters, sortBy: state.sortBy, duplicateTolerance: state.duplicateTolerance });
}

export function loadSettings() {
  const settings = readJson(STORAGE_KEYS.settings, {});
  const savedSort = settings.sortBy === 'recent' ? 'default' : settings.sortBy;
  Object.assign(state, {
    view: settings.view || state.view,
    theme: settings.theme || state.theme,
    sortBy: savedSort || state.sortBy,
    duplicateTolerance: Number.isFinite(Number(settings.duplicateTolerance)) ? Number(settings.duplicateTolerance) : state.duplicateTolerance,
    filters: { ...state.filters, ...(settings.filters || {}) }
  });
  state.filters.class = normalizeClassFilter(state.filters.class);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}