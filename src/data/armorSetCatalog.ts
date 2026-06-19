import type { ArmorPerk } from '../types/armor';
import type { DestinyInventoryItemDefinition } from '../types/bungie';

interface ArmorSetBonusCatalogEntry {
  key: string;
  name: string;
  source: string;
  aliases: string[];
  bonuses: Array<{ pieces: 2 | 4; name: string; description: string }>;
}

export interface SelectedArmorSet {
  entry: ArmorSetBonusCatalogEntry;
  icon: string;
}

const ARMOR_SET_SELECTOR_HASHES = new Set([
  139044974, 139044987, 721111598, 721111611, 1012508294, 1012508307, 1220635053,
  1220635064, 1404854454, 1530138662, 1841728090, 2824493179, 2872740129,
  3573256294, 3573256307, 3782433407, 3834187337, 3874641219, 4119627352
]);

const SETS: ArmorSetBonusCatalogEntry[] = [
  {
    key: 'aion-adapter',
    name: 'Aion Adapter',
    source: 'Kepler activities',
    aliases: ['aion adapter'],
    bonuses: [
      { pieces: 2, name: 'Force Absorption', description: 'Rocket and grenade launcher final blows briefly reduce incoming area-of-effect damage.' },
      { pieces: 4, name: 'Reactive Shock', description: 'While Force Absorption is active, taking melee damage emits a one-time disorienting burst.' }
    ]
  },
  {
    key: 'aion-renewal',
    name: 'Aion Renewal',
    source: 'Kepler activities',
    aliases: ['aion renewal'],
    bonuses: [
      { pieces: 2, name: 'Force Converter', description: 'After a rocket or grenade launcher final blow, sprinting briefly grants Speed Booster.' },
      { pieces: 4, name: 'Reactive Booster', description: 'Once per Force Converter activation, sprinting while critical, suspended, or slowed by Stasis immediately grants brief Speed Booster.' }
    ]
  },
  {
    key: 'bushido',
    name: 'Bushido',
    source: 'Pinnacle Ops',
    aliases: ['bushido'],
    bonuses: [
      { pieces: 2, name: 'Iaido', description: 'Final blows with freshly drawn or reloaded weapons heal you.' },
      { pieces: 4, name: 'Unfaltering Focus', description: 'Bow, shotgun, or sword final blows reduce incoming damage for a short time; damaging targets with those weapons extends the effect.' }
    ]
  },
  {
    key: 'techsec',
    name: 'Techsec',
    source: 'Fireteam Ops',
    aliases: ['techsec', 'tech sec'],
    bonuses: [
      { pieces: 2, name: 'Wrecker', description: 'Kinetic damage is greatly increased against combatant shields, overshields, vehicles, and battlefield constructs.' },
      { pieces: 4, name: 'Concussive Rounds', description: 'Defeating powerful combatants or breaking a combatant shield with kinetic damage releases a disorienting kinetic shockwave.' }
    ]
  },
  {
    key: 'twofold-crown',
    name: 'Twofold Crown',
    source: 'Trials of Osiris',
    aliases: ['twofold crown'],
    bonuses: [
      { pieces: 2, name: 'Crook and Flail', description: 'Picking up an ammo brick heals you.' },
      { pieces: 4, name: 'Gift of Sight', description: 'Primary ammo final blows briefly increase radar resolution.' }
    ]
  },
  {
    key: 'last-discipline',
    name: 'Last Discipline',
    source: 'Crucible',
    aliases: ['last discipline', 'last disciple'],
    bonuses: [
      { pieces: 2, name: 'Terminal Velocity', description: 'Primary ammo final blows grant increased reload speed to primary weapons for a short time.' },
      { pieces: 4, name: 'Power Loader', description: 'Picking up an Orb of Power grants special ammo meter progress.' }
    ]
  },
  {
    key: 'collective-psyche',
    name: 'Collective Psyche',
    source: 'The Desert Perpetual raid',
    aliases: ['collective psyche'],
    bonuses: [
      { pieces: 2, name: 'Accretion', description: 'Picking up ammo grants a stacking bonus to weapon swap and stow speed until death.' },
      { pieces: 4, name: 'Doppler Effect', description: 'Suspend, unravel, sever, radiant, and restoration effects last longer.' }
    ]
  },
  {
    key: 'lustrous',
    name: 'Lustrous',
    source: 'Solstice',
    aliases: ['lustrous'],
    bonuses: [
      { pieces: 2, name: 'Photogalvanic', description: 'Receiving healing briefly improves solar weapon flinch resistance, handling, and reload speed.' },
      { pieces: 4, name: 'Cauterize', description: 'Rapid solar final blows heal you.' }
    ]
  }
];

export function resolveCatalogSetBonuses(args: {
  selectedSet: SelectedArmorSet;
}): ArmorPerk[] {
  return args.selectedSet.entry.bonuses.map((bonus) => ({
    kind: 'set',
    label: `${bonus.pieces}-Piece Set Bonus`,
    name: bonus.name,
    description: `${args.selectedSet.entry.name}: ${bonus.description}`,
    icon: args.selectedSet.icon,
    hash: `catalog:${args.selectedSet.entry.key}:${bonus.pieces}`,
    source: args.selectedSet.entry.source,
    setName: args.selectedSet.entry.name,
    pieces: bonus.pieces
  }));
}

export function resolveSelectedArmorSet(args: {
  activePlugDefs: DestinyInventoryItemDefinition[];
  iconUrl: (value: unknown) => string;
}): SelectedArmorSet | null {
  // Set selectors expose the selected Armor 3.0 set and icon. Do not infer from armor item names here:
  // weak name matches caused unrelated sets to render the same local catalog bonus rows.
  for (const plug of args.activePlugDefs) {
    const plugText = normalize([
      plug.displayProperties?.name,
      plug.displayProperties?.description,
      plug.itemTypeDisplayName,
      plug.plug?.plugCategoryIdentifier
    ].join(' '));
    if (!isActiveSetSelector(plug, plugText)) continue;
    const entry = SETS.find((candidate) => candidate.aliases.some((alias) => plugText.includes(normalize(alias))));
    if (entry) return { entry, icon: args.iconUrl(displayIconPath(plug)) };
  }
  return null;
}

function isActiveSetSelector(plug: DestinyInventoryItemDefinition, text: string): boolean {
  const hash = Number(plug.hash || 0);
  const category = normalize(plug.plug?.plugCategoryIdentifier);
  const name = normalize(plug.displayProperties?.name);
  return Boolean(
    ARMOR_SET_SELECTOR_HASHES.has(hash) ||
    category.includes('item sets selectors') ||
    (name.includes('set bonus') && text.includes('converts this armor'))
  );
}

function displayIconPath(plug: DestinyInventoryItemDefinition): string {
  return plug.displayProperties?.icon || plug.displayProperties?.iconSequences?.[0]?.frames?.[0] || '';
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
