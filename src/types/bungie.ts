export interface BungieMembership {
  membershipId: string;
  membershipType: number;
  displayName?: string;
}

export interface BungieInventoryItem {
  itemHash: number;
  itemInstanceId?: string;
  bucketHash?: number;
  location?: number;
  state?: number;
  d2aaOwner?: string;
  d2aaEquipped?: boolean;
  power?: number;
  light?: number;
  primaryStat?: { value?: number };
}

export interface BungieProfileResponse {
  profileInventory?: { data?: { items?: BungieInventoryItem[] } };
  characterInventories?: { data?: Record<string, { items?: BungieInventoryItem[] }> };
  characterEquipment?: { data?: Record<string, { items?: BungieInventoryItem[] }> };
  characters?: { data?: Record<string, { classType?: number }> };
  itemComponents?: {
    stats?: { data?: Record<string, { stats?: Record<string, { value?: number } | number> }> };
    instances?: { data?: Record<string, BungieItemInstance> };
    sockets?: { data?: Record<string, BungieSocketComponent> };
    state?: { data?: Record<string, { state?: number }> };
  };
}

export interface BungieItemInstance {
  primaryStat?: { value?: number };
  quality?: number;
  gearTier?: number;
  energy?: { energyCapacity?: number };
}

export interface BungieSocketComponent {
  sockets?: Array<{
    plugHash?: number;
    plugItemHash?: number;
    reusablePlugHashes?: number[];
    reusablePlugItems?: Array<{ plugItemHash?: number }>;
    reusablePlugSetHash?: number;
    randomizedPlugSetHash?: number;
  }>;
}

export interface DestinyDisplayProperties {
  name?: string;
  description?: string;
  icon?: string;
  iconSequences?: Array<{ frames?: string[] }>;
}

export interface DestinyInventoryItemDefinition {
  hash?: number;
  displayProperties?: DestinyDisplayProperties;
  screenshot?: string;
  itemType?: number;
  itemTypeDisplayName?: string;
  classType?: number;
  inventory?: {
    bucketTypeHash?: number;
    tierType?: number;
    tierTypeName?: string;
  };
  stats?: { stats?: Record<string, { value?: number } | number> };
  sockets?: {
    socketEntries?: Array<{
      singleInitialItemHash?: number;
      reusablePlugItems?: Array<{ plugItemHash?: number }>;
      reusablePlugSetHash?: number;
      randomizedPlugSetHash?: number;
      randomizedPlugSet?: {
        hash?: number;
        reusablePlugItems?: Array<{ plugItemHash?: number }>;
      };
    }>;
  };
  investmentStats?: Array<{ statTypeHash?: number; value?: number; statValue?: number }>;
  plug?: { plugCategoryIdentifier?: string };
}

export interface DestinyPlugSetDefinition {
  reusablePlugItems?: Array<{ plugItemHash?: number }>;
  randomizedPlugItems?: Array<{ plugItemHash?: number }>;
}
