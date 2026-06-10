import type { ArmorItem } from '../types/armor';
import type { FilterState, SortOption } from '../types/filters';
import { CLASS_ORDER, SLOT_ORDER } from '../utils/constants';

interface FiltersPanelProps {
  rows: ArmorItem[];
  value: FilterState;
  onChange: (value: FilterState | ((current: FilterState) => FilterState)) => void;
}

const SORTS: Array<{ value: SortOption; label: string }> = [
  { value: 'default', label: 'Default analyzer order' },
  { value: 'totalDesc', label: 'Best Base Total' },
  { value: 'currentTotalDesc', label: 'Best Current Total' },
  { value: 'powerDesc', label: 'Highest Power' },
  { value: 'tierDesc', label: 'Highest Tier' },
  { value: 'newestDesc', label: 'Newest' },
  { value: 'groupedFirst', label: 'Grouped First' },
  { value: 'untaggedFirst', label: 'Untagged First' },
  { value: 'nameAsc', label: 'Name A to Z' },
  { value: 'slotAsc', label: 'Slot order' }
];

export default function FiltersPanel({ rows, value, onChange }: FiltersPanelProps) {
  const rarities = Array.from(new Set(rows.map((row) => row.Rarity).filter(Boolean))).sort();
  return (
    <section className="panel-card">
      <h2>Filters</h2>
      <label className="control-field"><span>Class</span>
        <select value={value.filters.class} onChange={(event) => onChange((current) => ({ ...current, filters: { ...current.filters, class: event.target.value as FilterState['filters']['class'] } }))}>
          {CLASS_ORDER.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
      </label>
      <label className="control-field"><span>Slot</span>
        <select value={value.filters.slot} onChange={(event) => onChange((current) => ({ ...current, filters: { ...current.filters, slot: event.target.value } }))}>
          <option value="all">All slots</option>
          {SLOT_ORDER.filter((slot) => rows.some((row) => row.Slot === slot)).map((slot) => <option key={slot} value={slot}>{slot}</option>)}
        </select>
      </label>
      <label className="control-field"><span>Rarity</span>
        <select value={value.filters.rarity} onChange={(event) => onChange((current) => ({ ...current, filters: { ...current.filters, rarity: event.target.value } }))}>
          <option value="all">All rarity</option>
          {rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
        </select>
      </label>
      <label className="control-field"><span>Sort</span>
        <select value={value.sortBy} onChange={(event) => onChange((current) => ({ ...current, sortBy: event.target.value as SortOption }))}>
          {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
        </select>
      </label>
      <div className="control-field">
        <span>Duplicate tolerance</span>
        <div className="range-line">
          <input type="range" min="0" max="20" value={value.duplicateTolerance} onChange={(event) => onChange((current) => ({ ...current, duplicateTolerance: Number(event.target.value) }))} />
          <strong>±{value.duplicateTolerance}</strong>
        </div>
      </div>
    </section>
  );
}
