import { useMemo } from 'react';
import type { ArmorItem } from '../types/armor';
import type { FilterState } from '../types/filters';
import { rowMatchesClass } from '../data/armorNormalization';
import { applyDuplicateGroups } from '../data/duplicateGroups';
import { sortArmor } from '../data/armorScoring';

export function useArmorFilters(rows: ArmorItem[], state: FilterState): { groupedRows: ArmorItem[]; filteredRows: ArmorItem[] } {
  return useMemo(() => {
    const groupedRows = applyDuplicateGroups(rows, state.duplicateTolerance, { sameNameExactStats: state.display.onlySameNameStatGroups });
    const q = state.search.trim().toLowerCase();
    const filteredRows = groupedRows.filter((row) => {
      if (state.filters.class !== 'all' && !rowMatchesClass(row, state.filters.class)) return false;
      if (state.filters.slot !== 'all' && row.Slot !== state.filters.slot) return false;
      if (state.filters.rarity !== 'all' && row.Rarity !== state.filters.rarity) return false;
      if (!state.display.showEquipped && row.IsEquipped) return false;
      if (!state.display.showVault && row.IsInVault) return false;
      if (!state.display.showInventory && !row.IsEquipped && !row.IsInVault) return false;
      if (!state.display.showLocked && row.IsLocked) return false;
      if (state.display.onlyNewItems && !row.RecentlyFound && row.RecentStatus !== 'new') return false;
      if (state.display.onlyGroupedItems && !row.Is_Dupe && !row.Group) return false;
      if (!q) return true;
      return [row.Name, row.Id, row.Slot, row.Type, row.Class, row.Equippable, row.Rarity, row.Archetype, row.Tag, row.Group, row.Dupe_Group, row.SortGroup]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
    return { groupedRows, filteredRows: sortArmor(filteredRows, state.sortBy) };
  }, [rows, state]);
}
