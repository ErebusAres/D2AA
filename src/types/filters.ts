import type { GuardianClass } from './armor';

export type SortOption =
  | 'default'
  | 'totalDesc'
  | 'currentTotalDesc'
  | 'powerDesc'
  | 'tierDesc'
  | 'newestDesc'
  | 'groupedFirst'
  | 'untaggedFirst'
  | 'nameAsc'
  | 'slotAsc';

export interface ArmorFilters {
  class: GuardianClass | 'all';
  slot: string;
  rarity: string;
}

export interface DisplayOptions {
  showEquipped: boolean;
  showVault: boolean;
  showInventory: boolean;
  showLocked: boolean;
  onlyNewItems: boolean;
  onlyGroupedItems: boolean;
  onlySameNameStatGroups: boolean;
}

export interface FilterState {
  search: string;
  filters: ArmorFilters;
  display: DisplayOptions;
  sortBy: SortOption;
  duplicateTolerance: number;
}
