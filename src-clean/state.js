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
const DEFAULT_DISPLAY = { showEquipped: true, showVault: true, showInventory: true, showLocked: true, onlyNewItems: false, onlyGroupedItems: false, onlySameNameStatGroups: false };

export const state = {
  rows: [],
  view: 'grid',
  search: '',
  filters: { class: 'all', slot: 'all', rarity: 'all' },
  display: { ...DEFAULT_DISPLAY },
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
  const keys = Object.keys(patch || {});
  Object.assign(state, patch);
  const statusOnly = keys.length === 1 && keys[0] === 'status';
  if (!statusOnly) persistSettings();
  emit({ statusOnly, keys });
}

export function setRows(rows, status = 'Rows loaded.') {
  state.rows = rows.map((row, index) => normalizeStoredRow({ ...row, _index: index, Tag: state.tags[row.Id] || row.Tag || '' }));
  state.status = status;
  saveRows(state.rows);
  emit({ rowsChanged: true, statusChanged: true });
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
  emit({ rowsChanged: true, tagsChanged: true });
}

export function dismissRecent(id) {
  state.dismissedRecent[id] = Date.now();
  state.rows = state.rows.map((row) => row.Id === id ? { ...row, RecentStatus: '', RecentlyFound: false } : row);
  writeJson(STORAGE_KEYS.dismissedRecent, state.dismissedRecent);
  saveRows(state.rows);
  emit({ rowsChanged: true, feedChanged: true });
}

export function getFilteredRows() {
  const q = state.search.trim().toLowerCase();
  const activeClass = normalizeClassFilter(state.filters.class);
  const display = { ...DEFAULT_DISPLAY, ...(state.display || {}) };
  const rows = state.rows.filter((row) => {
    if (activeClass !== 'all' && !rowMatchesClass(row, activeClass)) return false;
    if (state.filters.slot !== 'all' && row.Slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && row.Rarity !== state.filters.rarity) return false;
    if (!display.showEquipped && row.IsEquipped) return false;
    if (!display.showVault && row.IsInVault) return false;
    if (!display.showInventory && !row.IsEquipped && !row.IsInVault) return false;
    if (!display.showLocked && row.IsLocked) return false;
    if (display.onlyNewItems && !row.RecentlyFound && row.RecentStatus !== 'new') return false;
    if (display.onlyGroupedItems && !row.Is_Dupe && !row.Group) return false;
    if (!q) return true;
    return [row.Name, row.Id, row.Slot, row.Type, row.Class, row.Equippable, row.Rarity, row.Archetype, row.Tag, row.Group, row.Dupe_Group, row.SortGroup].some((value) => String(value || '').toLowerCase().includes(q));
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
    if (value > bestValue) { bestValue = value; bestLabel = label; }
  }
  return bestValue > 0 ? bestLabel : '';
}
function archetypeNameFrom(value) { return ARCHETYPE_ALIASES[normalizeKey(value)] || ''; }
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

export function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

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

  slim.ArmorSetBonuses = compactPerks(row.ArmorSetBonuses || row.SetBonuses || []);
  slim.SetBonuses = compactPerks(row.SetBonuses || row.ArmorSetBonuses || []);
  slim.ArmorBonuses = compactPerks(row.ArmorBonuses || row.ArmorPerks || []);
  slim.ArmorPerks = compactPerks(row.ArmorPerks || row.ArmorBonuses || []);
  slim.StatAudit = compactAudit(row.StatAudit || null);

  delete slim.SocketAudit;
  delete slim.DefinitionAudit;
  delete slim.EnhancedDefinitions;
  delete slim.ScreenshotUrl;
  return slim;
}

function compactAudit(audit) {
  if (!audit || typeof audit !== 'object') return audit || null;
  return { activePlugs: compactPlugs(audit.activePlugs), bonusBreakdown: audit.bonusBreakdown || {} };
}
function compactPlugs(plugs) {
  return (Array.isArray(plugs) ? plugs : [])
    .map((plug) => ({ hash: plug?.hash || '', name: plug?.name || plug?.displayProperties?.name || '', description: plug?.description || plug?.displayProperties?.description || '', icon: plug?.icon || '', type: plug?.type || plug?.itemTypeDisplayName || '', category: plug?.category || plug?.plug?.plugCategoryIdentifier || '', stats: compactStats(plug?.stats || plug?.investmentStats || []) }))
    .filter((plug) => plug.stats.length || /set|bonus|mod|masterwork|artifice|piece|wearing|trait|intrinsic|archetype/i.test(`${plug.name} ${plug.description} ${plug.type} ${plug.category}`))
    .slice(0, 24);
}
function compactStats(stats) {
  return (Array.isArray(stats) ? stats : [])
    .map((stat) => ({ statTypeHash: stat?.statTypeHash, value: number(stat?.value ?? stat?.statValue) }))
    .filter((stat) => stat.statTypeHash && stat.value)
    .slice(0, 8);
}
function compactPerks(perks) {
  return (Array.isArray(perks) ? perks : [])
    .map((perk) => ({ name: perk?.name || '', description: perk?.description || '', icon: perk?.icon || '', hash: perk?.hash || '', kind: perk?.kind || '', label: perk?.label || '' }))
    .filter((perk) => perk.name || perk.description || perk.hash)
    .slice(0, 8);
}
function persistSettings() {
  writeJson(STORAGE_KEYS.settings, { view: state.view, theme: state.theme, filters: state.filters, display: state.display, sortBy: state.sortBy, duplicateTolerance: state.duplicateTolerance });
}
export function loadSettings() {
  const settings = readJson(STORAGE_KEYS.settings, {});
  const savedSort = settings.sortBy === 'recent' ? 'default' : settings.sortBy;
  Object.assign(state, {
    view: settings.view || state.view,
    theme: settings.theme || state.theme,
    sortBy: savedSort || state.sortBy,
    duplicateTolerance: Number.isFinite(Number(settings.duplicateTolerance)) ? Number(settings.duplicateTolerance) : state.duplicateTolerance,
    filters: { ...state.filters, ...(settings.filters || {}) },
    display: { ...DEFAULT_DISPLAY, ...(settings.display || {}) }
  });
  state.filters.class = normalizeClassFilter(state.filters.class);
}
function emit(detail = {}) { listeners.forEach((fn) => fn(state, detail)); }