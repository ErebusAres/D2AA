import { STORAGE_KEYS } from './constants.js';

const listeners = new Set();

export const state = {
  rows: [],
  view: 'grid',
  search: '',
  filters: { class: 'all', slot: 'all', rarity: 'all' },
  sortBy: 'recent',
  duplicateTolerance: 5,
  theme: 'calus',
  tags: readJson(STORAGE_KEYS.tags, {}),
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
  state.rows = rows.map((row, index) => ({ ...row, _index: index, Tag: state.tags[row.Id] || row.Tag || '' }));
  state.status = status;
  saveRows(state.rows);
  emit();
}

export function updateTag(id, tag) {
  state.tags[id] = tag;
  state.rows = state.rows.map((row) => row.Id === id ? { ...row, Tag: tag } : row);
  writeJson(STORAGE_KEYS.tags, state.tags);
  emit();
}

export function getFilteredRows() {
  const q = state.search.trim().toLowerCase();
  let rows = state.rows.filter((row) => {
    if (state.filters.class !== 'all' && row.Class !== state.filters.class) return false;
    if (state.filters.slot !== 'all' && row.Slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && row.Rarity !== state.filters.rarity) return false;
    if (!q) return true;
    return [row.Name, row.Id, row.Slot, row.Class, row.Rarity, row.Archetype].some((value) => String(value || '').toLowerCase().includes(q));
  });
  if (state.sortBy === 'totalDesc') rows = rows.slice().sort((a,b) => b.Total - a.Total);
  else if (state.sortBy === 'nameAsc') rows = rows.slice().sort((a,b) => a.Name.localeCompare(b.Name));
  else if (state.sortBy === 'slotAsc') rows = rows.slice().sort((a,b) => String(a.Slot).localeCompare(String(b.Slot)) || b.Total - a.Total);
  else rows = rows.slice().sort((a,b) => (b.FoundAt || 0) - (a.FoundAt || 0) || a._index - b._index);
  return rows;
}

export function loadCachedRows() {
  const bungieCached = readJson(STORAGE_KEYS.bungieRows, []);
  const cached = Array.isArray(bungieCached) && bungieCached.length ? bungieCached : readJson(STORAGE_KEYS.rows, []);
  if (Array.isArray(cached) && cached.length) {
    setRows(cached, `Loaded ${cached.length} cached clean rows.`);
    return true;
  }
  return false;
}

export function saveRows(rows) {
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
    Class: row.Class,
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
  Object.assign(state, {
    view: settings.view || state.view,
    theme: settings.theme || state.theme,
    sortBy: settings.sortBy || state.sortBy,
    duplicateTolerance: Number.isFinite(Number(settings.duplicateTolerance)) ? Number(settings.duplicateTolerance) : state.duplicateTolerance,
    filters: { ...state.filters, ...(settings.filters || {}) }
  });
}

function emit() {
  listeners.forEach((fn) => fn(state));
}
