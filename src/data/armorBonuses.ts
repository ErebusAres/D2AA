import type { ArmorPerk } from '../types/armor';
import type { DestinyInventoryItemDefinition } from '../types/bungie';

const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);

export const ARMOR_SET_SELECTOR_HASHES = [
  139044974, 139044987, 721111598, 721111611, 1012508294, 1012508307, 1220635053,
  1220635064, 1404854454, 1530138662, 1841728090, 2824493179, 2872740129,
  3573256294, 3573256307, 3782433407, 3834187337, 3874641219, 4119627352
];

export function resolvePotentialSetBonuses(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  activePlugDefs: DestinyInventoryItemDefinition[];
  allPlugDefs: DestinyInventoryItemDefinition[];
  selectorPlugDefs: DestinyInventoryItemDefinition[];
  archetypeHash: unknown;
  iconUrl: (value: unknown) => string;
}): ArmorPerk[] {
  const activeHashes = new Set(args.activePlugDefs.map((plug) => String(plug.hash || '')));
  return uniquePerks([...args.activePlugDefs, ...args.allPlugDefs, ...args.selectorPlugDefs]
    .filter((plug) => isSetBonus(plug, args.archetypeHash))
    .filter((plug) => !isSetSelector(plug) || activeHashes.has(String(plug.hash || '')) || matchesArmorSet(plug, args.itemDefinition))
    .map((plug) => ({ ...perkInfo(plug, 'set', args.iconUrl), label: setBonusLabel(plug), potential: true })))
    .slice(0, 4);
}

export function resolveExoticArmorPerks(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  activePlugDefs: DestinyInventoryItemDefinition[];
  allPlugDefs: DestinyInventoryItemDefinition[];
  archetypeHash: unknown;
  iconUrl: (value: unknown) => string;
}): ArmorPerk[] {
  const itemName = normalize(args.itemDefinition.displayProperties?.name);
  const candidates = uniqueDefinitions([...args.activePlugDefs, ...args.allPlugDefs]).filter((plug) => isExoticPerk(plug, itemName, args.archetypeHash));
  const preferred = candidates.filter((plug) => searchableText(plug).includes('catalyst'));
  return uniquePerks((preferred.length ? preferred : candidates)
    .map((plug) => ({ ...perkInfo(plug, searchableText(plug).includes('catalyst') ? 'catalyst' : 'exotic', args.iconUrl), label: searchableText(plug).includes('catalyst') ? 'Exotic Catalyst' : 'Exotic Intrinsic' })))
    .slice(0, 1);
}

export function resolveArmorBonusPerks(args: {
  activePlugDefs: DestinyInventoryItemDefinition[];
  archetypeHash: unknown;
  iconUrl: (value: unknown) => string;
  setBonuses: ArmorPerk[];
}): ArmorPerk[] {
  const setHashes = new Set(args.setBonuses.map((perk) => String(perk.hash || '')));
  return uniquePerks(args.activePlugDefs
    .filter((plug) => !setHashes.has(String(plug.hash || '')) && isArmorBonus(plug, args.archetypeHash))
    .map((plug) => perkInfo(plug, 'armor', args.iconUrl)))
    .slice(0, 5);
}

function matchesArmorSet(plug: DestinyInventoryItemDefinition, itemDefinition: DestinyInventoryItemDefinition): boolean {
  const itemName = normalize(itemDefinition.displayProperties?.name);
  const setName = normalize(String(plug.displayProperties?.name || '').replace(/^set bonus\s*/i, ''));
  return Boolean(itemName && setName && itemName.includes(setName));
}

function isSetSelector(plug: DestinyInventoryItemDefinition): boolean {
  return normalize(plug.plug?.plugCategoryIdentifier).includes('item sets selectors');
}

function isSetBonus(plug: DestinyInventoryItemDefinition, archetypeHash: unknown): boolean {
  const name = normalize(plug.displayProperties?.name);
  const text = searchableText(plug);
  if (!name || isIgnoredPlug(plug) || String(plug.hash || '') === String(archetypeHash || '')) return false;
  const hasSet = text.includes(' set ') || text.startsWith('set ') || text.includes('armor set') || text.includes('setbonus');
  const hasBonus = text.includes('bonus') || text.includes('perk') || text.includes('trait') || text.includes('piece') || text.includes('pieces');
  return (hasSet && hasBonus) || /\b[24]\s*piece\b/.test(text) || text.includes('wearing 2') || text.includes('wearing 4') || text.includes('while wearing');
}

function isArmorBonus(plug: DestinyInventoryItemDefinition, archetypeHash: unknown): boolean {
  const name = normalize(plug.displayProperties?.name);
  const text = searchableText(plug);
  if (!name || isIgnoredPlug(plug) || String(plug.hash || '') === String(archetypeHash || '') || isSetBonus(plug, archetypeHash)) return false;
  return text.includes('armor bonus') || text.includes('origin trait') || text.includes('intrinsic') || text.includes('wearing');
}

function isExoticPerk(plug: DestinyInventoryItemDefinition, itemName: string, archetypeHash: unknown): boolean {
  const name = normalize(plug.displayProperties?.name);
  const description = normalize(plug.displayProperties?.description);
  const text = searchableText(plug);
  if (!name || !description || name === itemName || isIgnoredPlug(plug) || String(plug.hash || '') === String(archetypeHash || '')) return false;
  return text.includes('catalyst') || text.includes('exotic') || text.includes('intrinsic') || text.includes('trait') || text.includes('perk');
}

function isIgnoredPlug(plug: DestinyInventoryItemDefinition): boolean {
  const name = normalize(plug.displayProperties?.name);
  const text = searchableText(plug);
  return !name || name === 'empty mod socket' || name === 'default ornament' || name.includes('deprecated') || ARCHETYPE_NAMES.has(name) || text.includes('archetype');
}

function perkInfo(plug: DestinyInventoryItemDefinition, kind: string, iconUrl: (value: unknown) => string): ArmorPerk {
  return {
    name: plug.displayProperties?.name || '',
    description: plug.displayProperties?.description || '',
    icon: iconUrl(plug.displayProperties?.icon),
    hash: plug.hash || '',
    kind
  };
}

function setBonusLabel(plug: DestinyInventoryItemDefinition): string {
  const text = searchableText(plug);
  if (/\b2\s*piece\b/.test(text) || text.includes('wearing 2') || text.includes('two piece')) return 'Potential 2-Piece Bonus';
  if (/\b4\s*piece\b/.test(text) || text.includes('wearing 4') || text.includes('four piece')) return 'Potential 4-Piece Bonus';
  return 'Potential Armor Set Bonus';
}

function searchableText(plug: DestinyInventoryItemDefinition): string {
  return normalize(`${plug.displayProperties?.name || ''} ${plug.displayProperties?.description || ''} ${plug.itemTypeDisplayName || ''} ${plug.plug?.plugCategoryIdentifier || ''}`);
}

function uniqueDefinitions(definitions: DestinyInventoryItemDefinition[]): DestinyInventoryItemDefinition[] {
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    const key = String(definition.hash || searchableText(definition));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniquePerks<T extends ArmorPerk>(perks: T[]): T[] {
  const seen = new Set<string>();
  return perks.filter((perk) => {
    const key = normalize(`${perk.hash || ''} ${perk.name} ${perk.description}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
