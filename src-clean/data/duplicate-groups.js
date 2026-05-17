import { STAT_KEYS } from '../constants.js';
import { defaultAnalyzerSort, slotNumber } from './sort.js';

export function applyDuplicateGroups(rows, tolerance = 5) {
  const grouped = rows.map((row) => ({ ...row, Group: '', SortGroup: 'ZZ', GroupKey: baseKey(row), GroupColor: '' }));
  const byKey = new Map();
  grouped.forEach((row, index) => {
    const key = baseKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ row, index, key, top: topStats(row) });
  });

  for (const candidates of byKey.values()) {
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
      const groupLabel = `${slotNumber(first)}${String.fromCharCode(65 + dupeGroupIndex++)}`;
      const color = `group-${(dupeGroupIndex % 6) || 6}`;
      group
        .map((candidateIndex) => candidates[candidateIndex])
        .sort((a, b) => defaultAnalyzerSort(a.row, b.row))
        .forEach((candidate, letterIndex) => {
          const target = grouped[candidate.index];
          target.Group = `${groupLabel}${String.fromCharCode(65 + letterIndex)}`;
          target.SortGroup = groupLabel;
          target.GroupColor = color;
          target.Is_Dupe = true;
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
  return [row.Class, row.Slot, row.Rarity, exoticName].join('|');
}

function topStats(row) {
  const entries = STAT_KEYS.map((key) => [key, Number(row[key] || 0)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return { names: entries.map(([key]) => key), values: entries.map(([, value]) => value) };
}
function normalize(value) { return String(value || '').trim().toLowerCase(); }
