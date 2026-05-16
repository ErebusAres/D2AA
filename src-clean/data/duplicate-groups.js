import { STAT_KEYS } from '../constants.js';

export function applyDuplicateGroups(rows, tolerance = 5) {
  const buckets = new Map();
  rows.forEach((row) => {
    const top = STAT_KEYS.map((key) => [key, Number(row[key] || 0)]).sort((a,b) => b[1] - a[1]).slice(0,3).map(([key]) => key).join('/');
    const exoticName = row.Rarity === 'Exotic' ? row.Name : 'legendary';
    const key = [row.Class, row.Slot, row.Rarity, exoticName, top].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  });
  let groupNumber = 1;
  const grouped = rows.map((row) => ({ ...row, Group: '', GroupColor: '' }));
  buckets.forEach((items) => {
    if (items.length < 2) return;
    const groupId = String(groupNumber++);
    items.forEach((item, index) => {
      const target = grouped.find((row) => row.Id === item.Id);
      if (target) {
        target.Group = `${groupId}${String.fromCharCode(65 + index)}`;
        target.GroupColor = `group-${((groupNumber - 2) % 6) + 1}`;
      }
    });
  });
  return grouped;
}
