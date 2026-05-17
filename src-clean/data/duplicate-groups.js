import { STAT_KEYS } from '../constants.js';
import { defaultAnalyzerSort, slotNumber } from './sort.js';

const GROUP_COLORS = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function applyDuplicateGroups(rows, tolerance = 5) {
  const grouped = rows.map((row) => ({
    ...row,
    Group: '',
    Dupe_Group: 'X',
    SortGroup: 'ZZ',
    GroupKey: baseKey(row),
    GroupActionKey: '',
    GroupColor: '',
    Is_Dupe: false,
    Is_Dupe_Exotic: false
  }));
  const byKey = new Map();
  grouped.forEach((row, index) => {
    const key = baseKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ row, index, key, top: topStats(row) });
  });

  for (const [key, candidates] of byKey.entries()) {
    const assigned = new Set();
    const groups = [];
    for (let i = 0; i < candidates.length; i++) {
      if (assigned.has(i)) continue;
      const group = [i];
      assigned.add(i);
      for (let j = i + 1; j < candidates.length; j++) {
        if (assigned.has(j)) continue;
        if (isDuplicateCandidate(candidates[i], candidates[j], tolerance)) {
          group.push(j);
          assigned.add(j);
        }
      }
      groups.push(group);
    }

    groups.sort((a, b) => maxTotal(candidates, b) - maxTotal(candidates, a));
    let dupeGroupIndex = 0;
    for (const group of groups) {
      if (group.length < 2) continue;
      const first = candidates[group[0]].row;
      const groupLabel = `${slotNumber(first)}${LETTERS[Math.min(dupeGroupIndex, LETTERS.length - 1)]}`;
      const color = GROUP_COLORS[dupeGroupIndex % GROUP_COLORS.length];
      const actionKey = `${key}::${groupLabel}`;
      dupeGroupIndex++;
      group
        .map((candidateIndex) => candidates[candidateIndex])
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
  }
  return grouped;
}

function maxTotal(candidates, group) {
  return Math.max(...group.map((index) => Number(candidates[index].row.Total || 0)));
}

function isDuplicateCandidate(a, b, tolerance) {
  if (a.key !== b.key) return false;
  if (a.top.names.join('/') !== b.top.names.join('/')) return false;
  return a.top.values.every((value, index) => Math.abs(value - b.top.values[index]) <= tolerance);
}

function baseKey(row) {
  const exoticName = row.Rarity === 'Exotic' ? normalize(row.Name) : 'legendary';
  return [row.Class || row.Equippable || '', row.Slot || row.Type || '', row.Rarity || '', exoticName].join('|');
}

function topStats(row) {
  const entries = STAT_KEYS.map((key) => [key, Number(row[key] || 0)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return { names: entries.map(([key]) => key), values: entries.map(([, value]) => value) };
}
function normalize(value) { return String(value || '').trim().toLowerCase(); }
