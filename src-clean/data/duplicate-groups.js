import { STAT_KEYS, SLOT_ORDER, STORAGE_KEYS } from '../constants.js';
import { defaultAnalyzerSort, slotNumber } from './sort.js';

const GROUP_COLORS = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function applyDuplicateGroups(rows, tolerance = 5, options = {}) {
  const groupMode = resolveGroupMode(options);
  const grouped = rows.map((row) => ({
    ...row,
    Group: '',
    Dupe_Group: 'X',
    SortGroup: 'ZZ',
    GroupKey: groupKey(row, groupMode),
    GroupActionKey: '',
    GroupColor: '',
    Is_Dupe: false,
    Is_Dupe_Exotic: false
  }));
  const byKey = new Map();
  grouped.forEach((row, index) => {
    const key = groupKey(row, groupMode);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ row, index, key, top: topStats(row), baseStats: baseStats(row) });
  });

  const discoveredGroups = [];
  for (const [key, candidates] of byKey.entries()) {
    const assigned = new Set();
    const groups = [];
    for (let i = 0; i < candidates.length; i++) {
      if (assigned.has(i)) continue;
      const group = [i];
      assigned.add(i);
      for (let j = i + 1; j < candidates.length; j++) {
        if (assigned.has(j)) continue;
        if (isDuplicateCandidate(candidates[i], candidates[j], tolerance, groupMode)) {
          group.push(j);
          assigned.add(j);
        }
      }
      groups.push(group);
    }

    groups
      .filter((group) => group.length >= 2)
      .sort((a, b) => maxTotal(candidates, b) - maxTotal(candidates, a))
      .forEach((group) => discoveredGroups.push({ key, candidates, group, first: candidates[group[0]].row }));
  }

  discoveredGroups.sort((a, b) => groupSort(a.first, b.first) || maxTotal(b.candidates, b.group) - maxTotal(a.candidates, a.group));
  const slotCounters = new Map();
  let globalColorIndex = 0;
  for (const discovered of discoveredGroups) {
    const slotIndex = slotCategoryNumber(discovered.first);
    const next = (slotCounters.get(slotIndex) || 0) + 1;
    slotCounters.set(slotIndex, next);
    const groupLabel = `${slotIndex}${letterFor(next)}`;
    const color = GROUP_COLORS[globalColorIndex % GROUP_COLORS.length];
    globalColorIndex += 1;
    const actionKey = `${discovered.key}::${groupLabel}`;
    discovered.group
      .map((candidateIndex) => discovered.candidates[candidateIndex])
      .sort((a, b) => defaultAnalyzerSort(a.row, b.row))
      .forEach((candidate) => {
        const target = grouped[candidate.index];
        target.Group = groupLabel;
        target.Dupe_Group = groupLabel;
        target.SortGroup = groupLabel;
        target.GroupActionKey = actionKey;
        target.GroupColor = color;
        target.Is_Dupe = true;
        target.Is_Dupe_Exotic = target.Rarity === 'Exotic';
      });
  }
  return grouped;
}

function resolveGroupMode(options = {}) {
  const sameNameExactStats = Boolean(options.sameNameExactStats ?? options.sameNameStatGroups ?? readSameNameExactStatsSetting());
  return { sameNameExactStats };
}
function readSameNameExactStatsSetting() {
  try {
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    return Boolean(settings?.display?.onlySameNameStatGroups || settings?.display?.sameNameExactStats);
  } catch (_) { return false; }
}
function slotCategoryNumber(row) {
  const slot = normalize(row.Slot || row.Type || '');
  const index = SLOT_ORDER.findIndex((name) => normalize(name) === slot);
  return index >= 0 ? index + 1 : Math.max(1, slotNumber(row));
}
function letterFor(number) {
  let n = Math.max(1, Number(number || 1));
  let output = '';
  while (n > 0) { n -= 1; output = LETTERS[n % LETTERS.length] + output; n = Math.floor(n / LETTERS.length); }
  return output || 'A';
}
function groupSort(a, b) {
  const slot = slotCategoryNumber(a) - slotCategoryNumber(b);
  if (slot) return slot;
  const cls = classKey(a).localeCompare(classKey(b));
  if (cls) return cls;
  const rarity = String(a.Rarity || '').localeCompare(String(b.Rarity || ''));
  if (rarity) return rarity;
  return displayName(a).localeCompare(displayName(b));
}
function classKey(row) { return normalize(row.Equippable || row.Class || 'Any'); }
function maxTotal(candidates, group) { return Math.max(...group.map((index) => baseTotal(candidates[index].row))); }
function isDuplicateCandidate(a, b, tolerance, groupMode) {
  if (a.key !== b.key) return false;
  if (groupMode.sameNameExactStats) return sameExactBaseStats(a, b);
  if (a.top.names.join('/') !== b.top.names.join('/')) return false;
  return a.top.values.every((value, index) => Math.abs(value - b.top.values[index]) <= tolerance);
}
function sameExactBaseStats(a, b) { return STAT_KEYS.every((key) => Number(a.baseStats[key] || 0) === Number(b.baseStats[key] || 0)); }
function groupKey(row, groupMode) {
  const exoticName = row.Rarity === 'Exotic' ? normalize(displayName(row)) : 'legendary';
  const namePart = groupMode.sameNameExactStats ? normalize(displayName(row)) : exoticName;
  return [row.Equippable || row.Class || '', row.Slot || row.Type || '', row.Rarity || '', namePart].join('|');
}
function baseStats(row) {
  const explicit = STAT_KEYS.map((key) => [key, number(row[`Base${key}`])]);
  const explicitTotal = explicit.reduce((sum, [, value]) => sum + value, 0);
  const useExplicit = explicitTotal > 0 && explicitTotal <= 75;
  return Object.fromEntries(STAT_KEYS.map((key) => [key, useExplicit ? number(row[`Base${key}`]) : number(row[key]) ]));
}
function baseTotal(row) { return STAT_KEYS.reduce((sum, key) => sum + number(baseStats(row)[key]), 0); }
function topStats(row) {
  const stats = baseStats(row);
  const entries = STAT_KEYS.map((key) => [key, Number(stats[key] || 0)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return { names: entries.map(([key]) => key), values: entries.map(([, value]) => value) };
}
function displayName(row) { const name = String(row.Name || '').trim(); return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor'); }
function normalize(value) { return String(value || '').trim().toLowerCase(); }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
