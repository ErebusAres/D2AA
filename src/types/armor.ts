export type GuardianClass = 'Warlock' | 'Hunter' | 'Titan' | 'Any';
export type ArmorSlot = 'Helmet' | 'Gauntlets' | 'Chest Armor' | 'Leg Armor' | 'Class Item';
export type ArmorRarity = 'Exotic' | 'Legendary' | 'Rare' | 'Common' | 'Uncommon' | 'Basic' | string;
export type StatKey = 'Health' | 'Melee' | 'Grenade' | 'Super' | 'Weapon' | 'ClassAbility';
export type BonusType = 'masterwork' | 'mod' | 'artifice' | 'other';
export type InventoryLocation = 'Equipped' | 'Vault' | 'Inventory';

export interface ArmorPerk {
  name: string;
  description?: string;
  icon?: string;
  hash?: number | string;
  kind?: 'armor' | 'set' | 'exotic' | string;
  label?: string;
}

export type ArmorStats = Record<StatKey, number>;
export type ArmorBonusBreakdown = Record<BonusType, ArmorStats>;

export interface ArmorStatAudit {
  current?: ArmorStats;
  base?: ArmorStats;
  totals?: { base: number; current: number; bonus: number };
  bonusBreakdown?: Partial<ArmorBonusBreakdown>;
  activePlugs?: ArmorPerk[];
  warnings?: Array<Record<string, unknown>>;
  baseSource?: string;
}

export interface ArmorItem extends Partial<Record<StatKey, number>> {
  [key: string]: unknown;
  Id: string;
  Name: string;
  Type: string;
  Slot: ArmorSlot | string;
  Rarity: ArmorRarity;
  Class: GuardianClass | string;
  Equippable: GuardianClass | string;
  Tier?: number;
  GearTier?: number;
  TierMax?: number;
  Power?: number;
  Light?: number;
  Icon?: string;
  IconUrl?: string;
  BaseIconUrl?: string;
  OrnamentName?: string;
  Archetype?: string;
  ArchetypeIcon?: string;
  ArchetypeDescription?: string;
  ArchetypeHash?: number | string;
  ArmorSetBonuses?: ArmorPerk[];
  SetBonuses?: ArmorPerk[];
  ArmorBonuses?: ArmorPerk[];
  ArmorPerks?: ArmorPerk[];
  ExoticPerks?: ArmorPerk[];
  ExoticArmorPerks?: ArmorPerk[];
  ExoticPerkName?: string;
  ExoticPerkDescription?: string;
  ExoticIcon?: string;
  IsMasterworked?: boolean;
  IsLocked?: boolean;
  IsInVault?: boolean;
  IsEquipped?: boolean;
  RecentlyFound?: boolean;
  RecentStatus?: '' | 'new' | string;
  FoundAt?: number;
  ActivityAt?: number;
  LastChangedAt?: string;
  ItemSignature?: string;
  LocationSignature?: string;
  Source?: 'Mock' | 'Bungie' | string;
  FromCache?: boolean;
  Tag?: string;
  Group?: string;
  Dupe_Group?: string;
  SortGroup?: string;
  GroupKey?: string;
  GroupActionKey?: string;
  GroupColor?: string;
  Is_Dupe?: boolean;
  Is_Dupe_Exotic?: boolean;
  Grade?: string;
  GradeScore?: number;
  Total?: number;
  BaseTotal?: number;
  CurrentTotal?: number;
  StatBonusTotal?: number;
  MasterworkBonusTotal?: number;
  ModBonusTotal?: number;
  ArtificeBonusTotal?: number;
  OtherBonusTotal?: number;
  StatAudit?: ArmorStatAudit;
  ItemHash?: number;
  BucketHash?: number;
  MembershipType?: number;
  OwnerCharacterId?: string;
  TargetCharacterId?: string;
  _index?: number;
}

export interface DuplicateGroupOptions {
  sameNameExactStats?: boolean;
  sameNameStatGroups?: boolean;
}
