import { STORAGE_KEYS } from './constants.js';
import { sortRows } from './data/sort.js';

const listeners = new Set();

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
  state.rows = state.rows.map((row) => row.Id === id ? { ...row, Tag: nextTag } : row);
  writeJson(STORAGE_KEYS.tags, state.tags);
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
  const dismissed = Boolean(state.dismissedRecent[row.Id]);
  return {
    ...row,
    Class: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    Equippable: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    ClassAbility: classAbility,
    RecentStatus: dismissed && row.RecentStatus === 'new' ? '' : row.RecentStatus,
    RecentlyFound: dismissed ? false : row.RecentlyFound,
    Archetype: normalizeArchetype(row.Archetype, row.Slot)
  };
}

function isClassName(value) { return normalizeClassFilter(value) !== 'all'; }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function normalizeArchetype(value, slot) {
  const text = String(value || '').trim();
  if (!text) return '—';
  const a = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const s = String(slot || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return a && a !== s ? text : '—';
}

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
  localStorage.removeItem(STORAGE_KEYS.dismissedRecent);
  try { indexedDB.deleteDatabase('d2aa-clean-cache'); } catch (_) {}
  setRows([], 'Clean cache cleared.');
}

export function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function slimRowForStorage(row) {
  return {
    Name: row.Name,
    Id: row.Id,
    Type: row.Type,
    Slot: row.Slot,
    Rarity: row.Rarity,
    Class: row.Class,
    Equippable: row.Equippable,
    Tier: row.Tier,
    GearTier: row.GearTier,
    TierSource: row.TierSource,
    TierMax: row.TierMax,
    Power: row.Power,
    Light: row.Light,
    Archetype: row.Archetype,
    Icon: row.Icon,
    IconUrl: row.IconUrl,
    Health: row.Health,
    Melee: row.Melee,
    Grenade: row.Grenade,
    Super: row.Super,
    ClassAbility: row.ClassAbility,
    Weapon: row.Weapon,
    Total: row.Total,
    Source: row.Source,
    FoundAt: row.FoundAt,
    RecentStatus: row.RecentStatus,
    RecentlyFound: row.RecentlyFound,
    LastChangedAt: row.LastChangedAt,
    Tag: row.Tag,
    ItemHash: row.ItemHash,
    BucketHash: row.BucketHash,
    MembershipType: row.MembershipType,
    OwnerCharacterId: row.OwnerCharacterId,
    TargetCharacterId: row.TargetCharacterId,
    IsInVault: row.IsInVault,
    IsEquipped: row.IsEquipped
  };
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