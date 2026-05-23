export const STORAGE_KEYS = {
  rows: 'd2aa_clean_rows_v1',
  tags: 'd2aa_clean_tags_v1',
  dismissedRecent: 'd2aa_clean_dismissed_recent_v1',
  feedOpen: 'd2aa_clean_feed_open_v1',
  settings: 'd2aa_clean_settings_v1',
  bungieRows: 'd2aa_clean_bungie_rows_v1',
  bungieMeta: 'd2aa_clean_bungie_meta_v1'
};

export const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'Weapon', 'ClassAbility'];
export const STAT_LABELS = {
  Health: 'Health',
  Melee: 'Melee',
  Grenade: 'Grenade',
  Super: 'Super',
  Weapon: 'Class',
  ClassAbility: 'Weapons'
};
export const STAT_SHORT_LABELS = {
  Health: 'HLT',
  Melee: 'MEL',
  Grenade: 'GRN',
  Super: 'SUP',
  Weapon: 'CLS',
  ClassAbility: 'WPN'
};
export const STAT_ICONS = {
  Health: 'https://www.bungie.net/common/destiny2_content/icons/717b8b218cc14325a54869bef21d2964.png',
  Melee: 'https://www.bungie.net/common/destiny2_content/icons/fa534aca76d7f2d7e7b4ba4df4271b42.png',
  Grenade: 'https://www.bungie.net/common/destiny2_content/icons/065cdaabef560e5808e821cefaeaa22c.png',
  Super: 'https://www.bungie.net/common/destiny2_content/icons/585ae4ede9c3da96b34086fccccdc8cd.png',
  Weapon: 'https://www.bungie.net/common/destiny2_content/icons/7eb845acb5b3a4a9b7e0b2f05f5c43f1.png',
  ClassAbility: 'https://www.bungie.net/common/destiny2_content/icons/bc69675acdae9e6b9a68a02fb4d62e07.png'
};

export const ARMOR_ARCHETYPES = {
  Paragon: { label: 'Paragon', stat: 'Super', icon: '☉' },
  Grenadier: { label: 'Grenadier', stat: 'Grenade', icon: '✹' },
  Specialist: { label: 'Specialist', stat: 'Weapon', icon: '△' },
  Brawler: { label: 'Brawler', stat: 'Melee', icon: '✊' },
  Bulwark: { label: 'Bulwark', stat: 'Health', icon: '✚' },
  Gunner: { label: 'Gunner', stat: 'ClassAbility', icon: '✥' }
};
export const ARCHETYPE_ALIASES = {
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

export const RARITY_ICONS = {
  Basic: '',
  Common: '',
  Uncommon: '',
  Rare: '',
  Legendary: 'https://www.bungie.net/common/destiny2_content/icons/f846f489c2a97afb289b357e431ecf8d.png',
  Exotic: 'https://www.bungie.net/common/destiny2_content/icons/3e6a698e1a8a5fb446fdcbf1e63c5269.png'
};
export const CLASS_ICONS = {
  Warlock: 'https://www.bungie.net/common/destiny2_content/icons/e4006d9a8fe167bd7e83193d7601c89a.png',
  Hunter: 'https://www.bungie.net/common/destiny2_content/icons/05e32a388d9a65a0ef59b2193eee2db4.png',
  Titan: 'https://www.bungie.net/common/destiny2_content/icons/46a19ddd00d0f6ca822230943103b54a.png'
};
export const SLOT_ICONS = {
  Helmet: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/helmet.svg',
  Gauntlets: 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/gloves.svg',
  'Chest Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/chest.svg',
  'Leg Armor': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/boots.svg',
  'Class Item': 'https://raw.githubusercontent.com/justrealmilk/destiny-icons/master/armor_types/class.svg'
};
export const LOCATION_EMOJIS = { Vault: '🏦', Equipped: '⚔️', Inventory: '🎒', Character: '🎒', DIM: '◇' };

export const SLOT_ORDER = ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'];
export const CLASS_ORDER = ['Warlock', 'Hunter', 'Titan'];

export const TAGS = [
  { value: '', label: 'No tag', emoji: '＋', picker: true },
  { value: 'feed', label: 'Item Feed', emoji: '✨', picker: false },
  { value: 'favorite', label: 'Favorite', emoji: '❤️', picker: true },
  { value: 'keep', label: 'Keep', emoji: '🏷️', picker: true },
  { value: 'junk', label: 'Junk', emoji: '🚫', picker: true },
  { value: 'infuse', label: 'Infuse', emoji: '⚡', picker: true },
  { value: 'archive', label: 'Archive', emoji: '📦', picker: true }
];

export const THEME_NAMES = ['calus', 'taken', 'trials', 'void', 'iron', 'vanguard'];
export const THEME_LABELS = {
  calus: 'Calus',
  taken: 'Taken',
  trials: 'Trials',
  void: 'Void',
  iron: 'Iron',
  vanguard: 'Vanguard'
};