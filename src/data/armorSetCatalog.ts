import type { ArmorPerk } from '../types/armor';
import type { DestinyInventoryItemDefinition } from '../types/bungie';

interface ArmorSetBonusCatalogEntry {
  key: string;
  name: string;
  source: string;
  aliases: string[];
  bonuses: Array<{ pieces: 2 | 4; name: string; description: string }>;
  icon: string;
}

const SETS: ArmorSetBonusCatalogEntry[] = [
  {
    key: 'aion-adapter',
    name: 'Aion Adapter',
    source: 'Kepler activities',
    aliases: ['aion adapter'],
    icon: catalogIcon('#7cb7ff', 'AA'),
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
    icon: catalogIcon('#7ee8e1', 'AR'),
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
    icon: catalogIcon('#ffcf66', 'BU'),
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
    icon: catalogIcon('#66c7ff', 'TS'),
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
    icon: catalogIcon('#d8b45b', 'TC'),
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
    icon: catalogIcon('#d58bff', 'LD'),
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
    icon: catalogIcon('#a97cff', 'CP'),
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
    icon: catalogIcon('#ff8f66', 'LU'),
    bonuses: [
      { pieces: 2, name: 'Photogalvanic', description: 'Receiving healing briefly improves solar weapon flinch resistance, handling, and reload speed.' },
      { pieces: 4, name: 'Cauterize', description: 'Rapid solar final blows heal you.' }
    ]
  }
];

export function resolveCatalogSetBonuses(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  plugDefs: DestinyInventoryItemDefinition[];
}): ArmorPerk[] {
  const entry = findCatalogEntry(args.itemDefinition, args.plugDefs);
  if (!entry) return [];
  return entry.bonuses.map((bonus) => ({
    kind: 'set',
    label: `${bonus.pieces}-Piece Set Bonus`,
    name: bonus.name,
    description: `${entry.name}: ${bonus.description}`,
    icon: entry.icon,
    hash: `catalog:${entry.key}:${bonus.pieces}`,
    source: entry.source,
    setName: entry.name,
    pieces: bonus.pieces
  }));
}

function findCatalogEntry(itemDefinition: DestinyInventoryItemDefinition, plugDefs: DestinyInventoryItemDefinition[]): ArmorSetBonusCatalogEntry | null {
  const text = normalize([
    itemDefinition.displayProperties?.name,
    itemDefinition.itemTypeDisplayName,
    ...plugDefs.flatMap((plug) => [
      plug.displayProperties?.name,
      plug.displayProperties?.description,
      plug.itemTypeDisplayName,
      plug.plug?.plugCategoryIdentifier
    ])
  ].join(' '));
  return SETS.find((entry) => entry.aliases.some((alias) => text.includes(normalize(alias)))) || null;
}

function catalogIcon(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#080a0d" d="M32 4l24 14v28L32 60 8 46V18z"/><path fill="${color}" d="M32 9l19 11v24L32 55 13 44V20z"/><path fill="#11151c" d="M32 15l14 8v18l-14 8-14-8V23z"/><text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="${color}">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
