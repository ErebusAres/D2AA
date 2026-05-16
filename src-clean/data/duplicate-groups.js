import { STAT_KEYS } from '../constants.js';

export function applyDuplicateGroups(rows, tolerance = 5) {
  const grouped = rows.map((row) => ({ ...row, Group: '', GroupColor: '' }));
  const candidates = grouped.map((row, index) => ({ row, index, key: baseKey(row), top: topStats(row) }));
  const used = new Set();
  let groupNumber = 1;

  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      if (isDuplicateCandidate(candidates[i], candidates[j], tolerance)) group.push(j);
    }
    if (group.length < 2) continue;
    const groupId = String(groupNumber++);
    group.forEach((candidateIndex, letterIndex) => {
      used.add(candidateIndex);
      const target = grouped[candidates[candidateIndex].index];
      target.Group = `${groupId}${String.fromCharCode(65 + letterIndex)}`;
      target.GroupColor = `group-${((groupNumber - 2) % 6) + 1}`;
    });
  }
  return grouped;
}

function isDuplicateCandidate(a, b, tolerance) {
  if (a.key !== b.key) return false;
  if (a.top.names.join('/') !== b.top.names.join('/')) return false;
  return a.top.values.every((value, index) => Math.abs(value - b.top.values[index]) <= tolerance);
}

function baseKey(row) {
  const exoticName = row.Rarity === 'Exotic' ? row.Name : 'legendary';
  return [row.Class, row.Slot, row.Rarity, exoticName].join('|');
}

function topStats(row) {
  const entries = STAT_KEYS.map((key) => [key, Number(row[key] || 0)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return { names: entries.map(([key]) => key), values: entries.map(([, value]) => value) };
}
