import { SLOT_ORDER } from '../constants.js';

export function sortRows(rows, sortBy = 'default') {
  const out = rows.slice();
  if (sortBy === 'totalDesc') return out.sort((a, b) => baseTotal(b) - baseTotal(a) || defaultAnalyzerSort(a, b));
  if (sortBy === 'currentTotalDesc') return out.sort((a, b) => currentTotal(b) - currentTotal(a) || baseTotal(b) - baseTotal(a) || defaultAnalyzerSort(a, b));
  if (sortBy === 'powerDesc') return out.sort((a, b) => num(b.Power || b.Light) - num(a.Power || a.Light) || defaultAnalyzerSort(a, b));
  if (sortBy === 'tierDesc') return out.sort((a, b) => num(b.Tier || b.GearTier) - num(a.Tier || a.GearTier) || defaultAnalyzerSort(a, b));
  if (sortBy === 'newestDesc') return out.sort((a, b) => num(b.FoundAt || b.AcquiredAt || b._index) - num(a.FoundAt || a.AcquiredAt || a._index) || defaultAnalyzerSort(a, b));
  if (sortBy === 'groupedFirst') return out.sort((a, b) => Number(Boolean(b.Is_Dupe || b.Group)) - Number(Boolean(a.Is_Dupe || a.Group)) || defaultAnalyzerSort(a, b));
  if (sortBy === 'untaggedFirst') return out.sort((a, b) => Number(Boolean(a.Tag)) - Number(Boolean(b.Tag)) || defaultAnalyzerSort(a, b));
  if (sortBy === 'rankDesc') return out.sort((a, b) => rankScore(b) - rankScore(a) || baseTotal(b) - baseTotal(a) || defaultAnalyzerSort(a, b));
  if (sortBy === 'nameAsc') return out.sort((a, b) => String(a.Name).localeCompare(String(b.Name)) || defaultAnalyzerSort(a, b));
  if (sortBy === 'slotAsc') return out.sort((a, b) => slotNumber(a) - slotNumber(b) || defaultAnalyzerSort(a, b));
  return out.sort(defaultAnalyzerSort);
}

export function defaultAnalyzerSort(a, b) {
  const slot = slotNumber(a) - slotNumber(b);
  if (slot) return slot;
  const rarity = rarityOrder(a.Rarity) - rarityOrder(b.Rarity);
  if (rarity) return rarity;
  const dupe = Number(Boolean(b.Is_Dupe || b.Group)) - Number(Boolean(a.Is_Dupe || a.Group));
  if (dupe) return dupe;
  const aKey = String(a.GroupKey || groupingKey(a));
  const bKey = String(b.GroupKey || groupingKey(b));
  if (aKey !== bKey) return aKey.localeCompare(bKey);
  const aGroup = String(a.Dupe_Group || a.SortGroup || a.Group || 'ZZ');
  const bGroup = String(b.Dupe_Group || b.SortGroup || b.Group || 'ZZ');
  if (aGroup !== bGroup) return aGroup.localeCompare(bGroup, undefined, { numeric: true });
  const rank = rankScore(b) - rankScore(a);
  if (rank) return rank;
  const total = baseTotal(b) - baseTotal(a);
  if (total) return total;
  const power = num(b.Power || b.Light) - num(a.Power || a.Light);
  if (power) return power;
  return String(a.Id || a._index || '').localeCompare(String(b.Id || b._index || ''));
}

export function slotNumber(row) {
  const slot = row.Slot || row.Type;
  const index = SLOT_ORDER.indexOf(slot);
  return index >= 0 ? index + 1 : 99;
}

function groupingKey(row) {
  const exoticName = row.Rarity === 'Exotic' ? norm(row.Name) : 'legendary';
  return [row.Class || row.Equippable || '', row.Slot || row.Type || '', row.Rarity || '', exoticName].join('|');
}
function rarityOrder(rarity) {
  if (rarity === 'Legendary') return 0;
  if (rarity === 'Exotic') return 1;
  if (rarity === 'Rare') return 2;
  return 3;
}
function rankScore(row) {
  const total = baseTotal(row);
  if (row.Rarity === 'Exotic') {
    if (total >= 63) return 5;
    if (total >= 62) return 4;
    if (total >= 61) return 3;
    if (total >= 60) return 2;
    if (total >= 59) return 1;
    return 0;
  }
  if (total >= 75) return 5;
  if (total >= 74) return 4;
  if (total >= 73) return 3;
  if (total >= 72) return 2;
  if (total >= 71) return 1;
  return 0;
}
function baseTotal(row) { return num(row.BaseTotal ?? row.Total); }
function currentTotal(row) { return num(row.CurrentTotal ?? row.Total); }
function norm(value) { return String(value || '').trim().toLowerCase(); }
function num(value) { return Number(value || 0) || 0; }