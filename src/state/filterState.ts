import type { FilterState } from '../types/filters';
import type { GuardianClass } from '../types/armor';
import { DEFAULT_DISPLAY } from '../utils/constants';

export const defaultFilterState: FilterState = {
  search: '',
  filters: { class: 'Warlock', slot: 'all', rarity: 'all' },
  display: { ...DEFAULT_DISPLAY },
  sortBy: 'default',
  duplicateTolerance: 5
};

export function normalizeFilterState(value: unknown): FilterState {
  const source = isRecord(value) ? value : {};
  const filters = isRecord(source.filters) ? source.filters : {};
  const display = isRecord(source.display) ? source.display : {};
  return {
    search: typeof source.search === 'string' ? source.search : '',
    filters: {
      class: normalizeClass(filters.class),
      slot: typeof filters.slot === 'string' ? filters.slot : 'all',
      rarity: typeof filters.rarity === 'string' ? filters.rarity : 'all'
    },
    display: {
      ...DEFAULT_DISPLAY,
      showEquipped: bool(display.showEquipped, DEFAULT_DISPLAY.showEquipped),
      showVault: bool(display.showVault, DEFAULT_DISPLAY.showVault),
      showInventory: bool(display.showInventory, DEFAULT_DISPLAY.showInventory),
      showLocked: bool(display.showLocked, DEFAULT_DISPLAY.showLocked),
      onlyNewItems: bool(display.onlyNewItems, DEFAULT_DISPLAY.onlyNewItems),
      onlyGroupedItems: bool(display.onlyGroupedItems, DEFAULT_DISPLAY.onlyGroupedItems),
      onlySameNameStatGroups: bool(display.onlySameNameStatGroups ?? display.sameNameExactStats, DEFAULT_DISPLAY.onlySameNameStatGroups)
    },
    sortBy: isSortOption(source.sortBy) ? source.sortBy : defaultFilterState.sortBy,
    duplicateTolerance: Number.isFinite(Number(source.duplicateTolerance)) ? Number(source.duplicateTolerance) : defaultFilterState.duplicateTolerance
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeClass(value: unknown): GuardianClass | 'all' {
  const text = String(value || '').toLowerCase();
  if (text.includes('warlock')) return 'Warlock';
  if (text.includes('hunter')) return 'Hunter';
  if (text.includes('titan')) return 'Titan';
  return defaultFilterState.filters.class;
}

function isSortOption(value: unknown): value is FilterState['sortBy'] {
  return ['default', 'totalDesc', 'currentTotalDesc', 'powerDesc', 'tierDesc', 'newestDesc', 'groupedFirst', 'untaggedFirst', 'nameAsc', 'slotAsc'].includes(String(value));
}
