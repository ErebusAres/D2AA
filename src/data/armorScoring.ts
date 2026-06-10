import type { ArmorItem } from '../types/armor';
import { baseTotal, currentTotal, gradeFor } from '../utils/statMath';
import { SLOT_ORDER } from '../utils/constants';

export function sortArmor(items: ArmorItem[], sortBy = 'default'): ArmorItem[] {
  const out = items.slice();
  if (sortBy === 'totalDesc') return out.sort((a, b) => baseTotal(b) - baseTotal(a) || defaultArmorSort(a, b));
  if (sortBy === 'currentTotalDesc') return out.sort((a, b) => currentTotal(b) - currentTotal(a) || baseTotal(b) - baseTotal(a) || defaultArmorSort(a, b));
  if (sortBy === 'powerDesc') return out.sort((a, b) => number(b.Power || b.Light) - number(a.Power || a.Light) || defaultArmorSort(a, b));
  if (sortBy === 'tierDesc') return out.sort((a, b) => number(b.Tier || b.GearTier) - number(a.Tier || a.GearTier) || defaultArmorSort(a, b));
  if (sortBy === 'newestDesc') return out.sort((a, b) => number(b.FoundAt || b.ActivityAt || b._index) - number(a.FoundAt || a.ActivityAt || a._index) || defaultArmorSort(a, b));
  if (sortBy === 'groupedFirst') return out.sort((a, b) => Number(Boolean(b.Is_Dupe || b.Group)) - Number(Boolean(a.Is_Dupe || a.Group)) || defaultArmorSort(a, b));
  if (sortBy === 'untaggedFirst') return out.sort((a, b) => Number(Boolean(a.Tag)) - Number(Boolean(b.Tag)) || defaultArmorSort(a, b));
  if (sortBy === 'nameAsc') return out.sort((a, b) => String(a.Name).localeCompare(String(b.Name)) || defaultArmorSort(a, b));
  if (sortBy === 'slotAsc') return out.sort((a, b) => slotNumber(a) - slotNumber(b) || defaultArmorSort(a, b));
  return out.sort(defaultArmorSort);
}

export function defaultArmorSort(a: ArmorItem, b: ArmorItem): number {
  return slotNumber(a) - slotNumber(b)
    || rarityOrder(a.Rarity) - rarityOrder(b.Rarity)
    || Number(Boolean(b.Is_Dupe || b.Group)) - Number(Boolean(a.Is_Dupe || a.Group))
    || String(a.GroupKey || groupingKey(a)).localeCompare(String(b.GroupKey || groupingKey(b)))
    || String(a.Dupe_Group || a.SortGroup || a.Group || 'ZZ').localeCompare(String(b.Dupe_Group || b.SortGroup || b.Group || 'ZZ'), undefined, { numeric: true })
    || gradeFor(b).score - gradeFor(a).score
    || baseTotal(b) - baseTotal(a)
    || number(b.Power || b.Light) - number(a.Power || a.Light)
    || String(a.Id || a._index || '').localeCompare(String(b.Id || b._index || ''));
}

export function slotNumber(row: ArmorItem): number {
  const index = SLOT_ORDER.indexOf(String(row.Slot || row.Type));
  return index >= 0 ? index + 1 : 99;
}

function groupingKey(row: ArmorItem): string {
  const exoticName = row.Rarity === 'Exotic' ? normalize(row.Name) : 'legendary';
  return [row.Class || row.Equippable || '', row.Slot || row.Type || '', row.Rarity || '', exoticName].join('|');
}

function rarityOrder(rarity: string): number {
  if (rarity === 'Legendary') return 0;
  if (rarity === 'Exotic') return 1;
  if (rarity === 'Rare') return 2;
  return 3;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function number(value: unknown): number {
  return Number(value || 0) || 0;
}
