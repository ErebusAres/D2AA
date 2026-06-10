import type { ArmorItem, DuplicateGroupOptions, StatKey } from '../types/armor';
import { STAT_KEYS, SLOT_ORDER } from '../utils/constants';
import { defaultArmorSort, slotNumber } from './armorScoring';
import { baseTotal, numberValue } from '../utils/statMath';
import { displayName } from '../utils/formatters';

const GROUP_COLORS = ['group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function applyDuplicateGroups(rows: ArmorItem[], tolerance = 5, options: DuplicateGroupOptions = {}): ArmorItem[] {
  const groupMode = { sameNameExactStats: Boolean(options.sameNameExactStats || options.sameNameStatGroups) };
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
  const byKey = new Map<string, Array<{ row: ArmorItem; index: number; key: string; top: TopStats; baseStats: Record<StatKey, number> }>>();
  grouped.forEach((row, index) => {
    const key = groupKey(row, groupMode);
    const list = byKey.get(key) ?? [];
    list.push({ row, index, key, top: topStats(row), baseStats: baseStats(row) });
    byKey.set(key, list);
  });

  const discovered: Array<{ key: string; candidates: Array<{ row: ArmorItem; index: number; key: string; top: TopStats; baseStats: Record<StatKey, number> }>; group: number[]; first: ArmorItem }> = [];
  for (const [key, candidates] of byKey) {
    const assigned = new Set<number>();
    for (let i = 0; i < candidates.length; i += 1) {
      if (assigned.has(i)) continue;
      const group = [i];
      assigned.add(i);
      for (let j = i + 1; j < candidates.length; j += 1) {
        if (!assigned.has(j) && isDuplicateCandidate(candidates[i], candidates[j], tolerance, groupMode)) {
          group.push(j);
          assigned.add(j);
        }
      }
      if (group.length >= 2) discovered.push({ key, candidates, group, first: candidates[group[0]].row });
    }
  }

  discovered.sort((a, b) => groupSort(a.first, b.first) || maxTotal(b.candidates, b.group) - maxTotal(a.candidates, a.group));
  const slotCounters = new Map<number, number>();
  let colorIndex = 0;
  for (const item of discovered) {
    const slotIndex = slotCategoryNumber(item.first);
    const next = (slotCounters.get(slotIndex) || 0) + 1;
    slotCounters.set(slotIndex, next);
    const groupLabel = `${slotIndex}${letterFor(next)}`;
    const color = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
    colorIndex += 1;
    const actionKey = `${item.key}::${groupLabel}`;
    item.group
      .map((candidateIndex) => item.candidates[candidateIndex])
      .sort((a, b) => defaultArmorSort(a.row, b.row))
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

interface TopStats {
  names: StatKey[];
  values: number[];
}

function isDuplicateCandidate(
  a: { key: string; top: TopStats; baseStats: Record<StatKey, number> },
  b: { key: string; top: TopStats; baseStats: Record<StatKey, number> },
  tolerance: number,
  groupMode: { sameNameExactStats: boolean }
): boolean {
  if (a.key !== b.key) return false;
  if (groupMode.sameNameExactStats) return STAT_KEYS.every((key) => a.baseStats[key] === b.baseStats[key]);
  if (a.top.names.join('/') !== b.top.names.join('/')) return false;
  return a.top.values.every((value, index) => Math.abs(value - b.top.values[index]) <= tolerance);
}

function groupKey(row: ArmorItem, groupMode: { sameNameExactStats: boolean }): string {
  const exoticName = row.Rarity === 'Exotic' ? normalize(displayName(row)) : 'legendary';
  const namePart = groupMode.sameNameExactStats ? normalize(displayName(row)) : exoticName;
  return [row.Equippable || row.Class || '', row.Slot || row.Type || '', row.Rarity || '', namePart].join('|');
}

function baseStats(row: ArmorItem): Record<StatKey, number> {
  const explicitTotal = STAT_KEYS.reduce((sum, key) => sum + numberValue(row[`Base${key}` as keyof ArmorItem]), 0);
  const useExplicit = explicitTotal > 0 && explicitTotal <= 75;
  return Object.fromEntries(STAT_KEYS.map((key) => [key, useExplicit ? numberValue(row[`Base${key}` as keyof ArmorItem]) : numberValue(row[key])])) as Record<StatKey, number>;
}

function topStats(row: ArmorItem): TopStats {
  const stats = baseStats(row);
  const entries = STAT_KEYS.map((key) => [key, stats[key]] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return { names: entries.map(([key]) => key), values: entries.map(([, value]) => value) };
}

function maxTotal(candidates: Array<{ row: ArmorItem }>, group: number[]): number {
  return Math.max(...group.map((index) => baseTotal(candidates[index].row)));
}

function groupSort(a: ArmorItem, b: ArmorItem): number {
  return slotCategoryNumber(a) - slotCategoryNumber(b)
    || String(a.Equippable || a.Class || 'Any').localeCompare(String(b.Equippable || b.Class || 'Any'))
    || String(a.Rarity || '').localeCompare(String(b.Rarity || ''))
    || displayName(a).localeCompare(displayName(b));
}

function slotCategoryNumber(row: ArmorItem): number {
  const index = SLOT_ORDER.findIndex((slot) => normalize(slot) === normalize(row.Slot || row.Type || ''));
  return index >= 0 ? index + 1 : Math.max(1, slotNumber(row));
}

function letterFor(value: number): string {
  let n = Math.max(1, value);
  let output = '';
  while (n > 0) {
    n -= 1;
    output = LETTERS[n % LETTERS.length] + output;
    n = Math.floor(n / LETTERS.length);
  }
  return output || 'A';
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}
