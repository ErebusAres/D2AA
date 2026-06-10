import type { FilterState } from '../types/filters';
import { DEFAULT_DISPLAY } from '../utils/constants';

export const defaultFilterState: FilterState = {
  search: '',
  filters: { class: 'Warlock', slot: 'all', rarity: 'all' },
  display: { ...DEFAULT_DISPLAY },
  sortBy: 'default',
  duplicateTolerance: 5
};
