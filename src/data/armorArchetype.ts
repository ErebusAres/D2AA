import type { DestinyInventoryItemDefinition } from '../types/bungie';
import type { StatKey } from '../types/armor';

const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
const STAT_KEYS: StatKey[] = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const STAT_TO_ARCHETYPE: Record<StatKey, string> = {
  Health: 'Bulwark',
  Melee: 'Brawler',
  Grenade: 'Grenadier',
  Super: 'Paragon',
  ClassAbility: 'Specialist',
  Weapon: 'Gunner'
};

export interface ResolvedArmorArchetype {
  name: string;
  icon: string;
  description: string;
  hash: number | string;
  trait: string;
}

export function resolveArmorArchetype(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  plugDefs: DestinyInventoryItemDefinition[];
  hashToColumn: Record<number, StatKey>;
  iconUrl: (value: unknown) => string;
}): ResolvedArmorArchetype {
  const fallbackName = highestInvestmentStatName(args.itemDefinition, args.hashToColumn) || '—';
  const canonical = args.plugDefs.filter((plug) => {
    const name = normalize(plug.displayProperties?.name);
    return ARCHETYPE_NAMES.has(name) && normalize(plug.plug?.plugCategoryIdentifier).includes('armor archetype');
  });
  const found = canonical.find((plug) => displayIconPath(plug.displayProperties)) || canonical[0];
  if (!found) return { name: fallbackName, icon: '', description: '', hash: '', trait: '' };
  return {
    name: found.displayProperties?.name || fallbackName,
    icon: args.iconUrl(displayIconPath(found.displayProperties)),
    description: found.displayProperties?.description || '',
    hash: found.hash || '',
    trait: found.plug?.plugCategoryIdentifier || ''
  };
}

function highestInvestmentStatName(definition: DestinyInventoryItemDefinition, hashToColumn: Record<number, StatKey>): string {
  const totals = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as Record<StatKey, number>;
  for (const stat of definition.investmentStats || []) {
    const hash = Number(stat.statTypeHash);
    const column = hashToColumn[hash >>> 0] || hashToColumn[hash | 0];
    if (column) totals[column] += Number(stat.value || 0);
  }
  let best: StatKey | '' = '';
  let value = 0;
  for (const key of STAT_KEYS) {
    if (totals[key] > value) {
      best = key;
      value = totals[key];
    }
  }
  return best ? STAT_TO_ARCHETYPE[best] : '';
}

function displayIconPath(displayProperties?: { icon?: string; iconSequences?: Array<{ frames?: string[] }> }): string {
  return displayProperties?.icon || displayProperties?.iconSequences?.[0]?.frames?.[0] || '';
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
