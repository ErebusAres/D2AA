import type { ArmorItem } from '../types/armor';
import { ARCHETYPE_ALIASES, STAT_KEYS } from '../utils/constants';
import { numberValue } from '../utils/statMath';

export function normalizeArmorRow(row: ArmorItem, index = 0, tag = ''): ArmorItem {
  const characterClass = normalizeClassFilter(row.Equippable || row.Class);
  const normalized: ArmorItem = {
    ...row,
    _index: index,
    Id: String(row.Id),
    Class: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    Equippable: characterClass === 'all' ? row.Equippable || row.Class || 'Any' : characterClass,
    Tag: tag || row.Tag || '',
    Archetype: normalizeArchetype(row.Archetype, row.Slot, row)
  };
  return normalized;
}

export function normalizeClassFilter(value: unknown): 'Warlock' | 'Hunter' | 'Titan' | 'all' {
  const text = String(value || '').toLowerCase();
  if (text.includes('warlock') || text === 'w') return 'Warlock';
  if (text.includes('hunter') || text === 'h') return 'Hunter';
  if (text.includes('titan') || text === 't') return 'Titan';
  return 'all';
}

export function rowMatchesClass(row: ArmorItem, className: string): boolean {
  const target = normalizeClassFilter(className);
  if (target === 'all') return true;
  return [row.Equippable, row.Class, row.Type].some((value) => normalizeClassFilter(value) === target);
}

function normalizeArchetype(value: unknown, slot: unknown, row: ArmorItem): string {
  const text = String(value || '').trim();
  const archetype = normalizeKey(text);
  const slotKey = normalizeKey(slot);
  if (text && archetype !== slotKey && text !== '-' && text !== '—') return archetypeNameFrom(text) || text;
  return archetypeNameFrom(deriveArchetype(row)) || '—';
}

function deriveArchetype(row: ArmorItem): string {
  let bestLabel = '';
  let bestValue = -1;
  const map: Array<[string, string]> = [['Health', 'Health'], ['Melee', 'Melee'], ['Grenade', 'Grenade'], ['Super', 'Super'], ['ClassAbility', 'Class'], ['Weapon', 'Weapon']];
  for (const [key, label] of map) {
    const value = numberValue(row[key as keyof ArmorItem]);
    if (value > bestValue) {
      bestValue = value;
      bestLabel = label;
    }
  }
  return bestValue > 0 ? bestLabel : '';
}

function archetypeNameFrom(value: unknown): string {
  return ARCHETYPE_ALIASES[normalizeKey(value)] || '';
}

function normalizeKey(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function slimArmorRow(row: ArmorItem): ArmorItem {
  const slim: ArmorItem = { ...row };
  delete slim._index;
  delete slim.Group;
  delete slim.GroupActionKey;
  delete slim.GroupColor;
  delete slim.Is_Dupe;
  delete slim.Dupe_Group;
  delete slim.SortGroup;
  for (const key of STAT_KEYS) {
    slim[key] = row[key];
    slim[`Base${key}` as keyof ArmorItem] = row[`Base${key}` as keyof ArmorItem] as never;
    slim[`Current${key}` as keyof ArmorItem] = row[`Current${key}` as keyof ArmorItem] as never;
    slim[`StatBonus${key}` as keyof ArmorItem] = row[`StatBonus${key}` as keyof ArmorItem] as never;
  }
  return slim;
}
