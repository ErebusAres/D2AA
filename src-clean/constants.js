export const STORAGE_KEYS = {
  rows: 'd2aa_clean_rows_v1',
  tags: 'd2aa_clean_tags_v1',
  settings: 'd2aa_clean_settings_v1',
  bungieRows: 'd2aa_clean_bungie_rows_v1',
  bungieMeta: 'd2aa_clean_bungie_meta_v1'
};

export const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapon'];
export const STAT_LABELS = {
  Health: 'HLT',
  Melee: 'MEL',
  Grenade: 'GRN',
  Super: 'SUP',
  Class: 'CLS',
  Weapon: 'WPN'
};

export const SLOT_ORDER = ['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'];
export const CLASS_ORDER = ['Warlock', 'Hunter', 'Titan'];

export const TAGS = [
  { value: '', label: 'None', emoji: '×' },
  { value: 'keep', label: 'Keep', emoji: '⭐' },
  { value: 'build', label: 'Build', emoji: '🔧' },
  { value: 'pvp', label: 'PvP', emoji: '⚔️' },
  { value: 'junk', label: 'Junk', emoji: '🗑️' }
];

export const THEME_NAMES = ['calus', 'void', 'arc', 'solar'];
