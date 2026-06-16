import { defaultFilterState } from '../state/filterState';
import type { FilterState } from '../types/filters';

interface ActiveFilterChipsProps {
  value: FilterState;
  onChange: (value: FilterState | ((current: FilterState) => FilterState)) => void;
}

export default function ActiveFilterChips({ value, onChange }: ActiveFilterChipsProps) {
  const chips = buildChips(value, onChange);
  if (!chips.length) return null;
  return (
    <div className="active-chips" aria-label="Active filters">
      {chips.map((chip) => (
        <button type="button" key={chip.key} onClick={chip.clear} title={`Clear ${chip.label}`}>
          <span>{chip.label}</span>
          <b aria-hidden="true">x</b>
        </button>
      ))}
    </div>
  );
}

function buildChips(value: FilterState, onChange: ActiveFilterChipsProps['onChange']): Array<{ key: string; label: string; clear: () => void }> {
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (value.search.trim()) {
    chips.push({ key: 'search', label: `Search: ${value.search.trim()}`, clear: () => onChange((current) => ({ ...current, search: '' })) });
  }
  if (value.filters.slot !== 'all') {
    chips.push({ key: 'slot', label: `Slot: ${value.filters.slot}`, clear: () => onChange((current) => ({ ...current, filters: { ...current.filters, slot: 'all' } })) });
  }
  if (value.filters.rarity !== 'all') {
    chips.push({ key: 'rarity', label: `Rarity: ${value.filters.rarity}`, clear: () => onChange((current) => ({ ...current, filters: { ...current.filters, rarity: 'all' } })) });
  }
  if (value.sortBy !== defaultFilterState.sortBy) {
    chips.push({ key: 'sort', label: `Sort: ${value.sortBy}`, clear: () => onChange((current) => ({ ...current, sortBy: defaultFilterState.sortBy })) });
  }
  if (value.duplicateTolerance !== defaultFilterState.duplicateTolerance) {
    chips.push({ key: 'dupes', label: `Dupes: +/-${value.duplicateTolerance}`, clear: () => onChange((current) => ({ ...current, duplicateTolerance: defaultFilterState.duplicateTolerance })) });
  }
  if (value.display.onlyNewItems) {
    chips.push({ key: 'new', label: 'Only new', clear: () => onChange((current) => ({ ...current, display: { ...current.display, onlyNewItems: false } })) });
  }
  if (value.display.onlyGroupedItems) {
    chips.push({ key: 'grouped', label: 'Only grouped', clear: () => onChange((current) => ({ ...current, display: { ...current.display, onlyGroupedItems: false } })) });
  }
  if (value.display.onlySameNameStatGroups) {
    chips.push({ key: 'exact', label: 'Exact stat groups', clear: () => onChange((current) => ({ ...current, display: { ...current.display, onlySameNameStatGroups: false } })) });
  }
  return chips;
}
