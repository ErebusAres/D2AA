import type { DisplayOptions } from '../types/filters';
import type { StatKey } from '../types/armor';

export const APP_VERSION = 'v.07';

export const STORAGE_KEYS = {
  rows: 'd2aa_clean_rows_v1',
  tags: 'd2aa_clean_tags_v1',
  dismissedRecent: 'd2aa_clean_dismissed_recent_v1',
  feedOpen: 'd2aa_clean_feed_open_v1',
  settings: 'd2aa_clean_settings_v1',
  bungieRows: 'd2aa_clean_bungie_rows_v1',
  bungieMeta: 'd2aa_clean_bungie_meta_v1'
} as const;

export const STAT_KEYS: StatKey[] = ['Health', 'Melee', 'Grenade', 'Super', 'Weapon', 'ClassAbility'];
export const STAT_LABELS: Record<StatKey, string> = {
  Health: 'Health',
  Melee: 'Melee',
  Grenade: 'Grenade',
  Super: 'Super',
  Weapon: 'Class',
  ClassAbility: 'Weapons'
};
export const STAT_SHORT_LABELS: Record<StatKey, string> = {
  Health: 'HLT',
  Melee: 'MEL',
  Grenade: 'GRN',
  Super: 'SUP',
  Weapon: 'CLS',
  ClassAbility: 'WPN'
};
export const STAT_ICONS: Record<StatKey, string> = {
  Health: 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
  Melee: 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
  Grenade: 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
  Super: 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
  Weapon: 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
  ClassAbility: 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
};

export const SLOT_ORDER = ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'];
export const CLASS_ORDER = ['Warlock', 'Hunter', 'Titan'] as const;
export const DEFAULT_DISPLAY: DisplayOptions = {
  showEquipped: true,
  showVault: true,
  showInventory: true,
  showLocked: true,
  onlyNewItems: false,
  onlyGroupedItems: false,
  onlySameNameStatGroups: false
};

export const TAGS = [
  { value: '', label: 'No tag', emoji: '+', picker: true },
  { value: 'favorite', label: 'Favorite', emoji: '❤️', picker: true },
  { value: 'keep', label: 'Keep', emoji: '🏷️', picker: true },
  { value: 'junk', label: 'Junk', emoji: '🚫', picker: true },
  { value: 'infuse', label: 'Infuse', emoji: '⚡', picker: true },
  { value: 'archive', label: 'Archive', emoji: '📦', picker: true }
] as const;

export const ARCHETYPE_ALIASES: Record<string, string> = {
  super: 'Paragon',
  paragon: 'Paragon',
  grenade: 'Grenadier',
  grenadier: 'Grenadier',
  class: 'Specialist',
  classability: 'Specialist',
  specialist: 'Specialist',
  melee: 'Brawler',
  brawler: 'Brawler',
  health: 'Bulwark',
  bulwark: 'Bulwark',
  weapon: 'Gunner',
  weapons: 'Gunner',
  gunner: 'Gunner'
};
