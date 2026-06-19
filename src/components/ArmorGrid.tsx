import ArmorCard from './ArmorCard';
import type { ArmorItem } from '../types/armor';
import { SLOT_ORDER, STORAGE_KEYS } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface ArmorGridProps {
  rows: ArmorItem[];
  onTag: (id: string, tag: string) => void;
  onAction: (row: ArmorItem) => void;
  onLock: (row: ArmorItem) => void;
  onCompareGroup: (groupKey: string) => void;
}

export default function ArmorGrid({ rows, onTag, onAction, onLock, onCompareGroup }: ArmorGridProps) {
  const [collapsedSlots, setCollapsedSlots] = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.collapsedSlots, {}, normalizeCollapsedSlots);
  const toggleSlot = (slot: string) => {
    setCollapsedSlots((current) => ({ ...current, [slot]: !current[slot] }));
  };

  return (
    <section className="slot-stack">
      {SLOT_ORDER.map((slot) => {
        const items = rows.filter((row) => row.Slot === slot);
        if (!items.length) return null;
        const collapsed = Boolean(collapsedSlots[slot]);
        return (
          <section className={`slot-section ${collapsed ? 'is-collapsed' : ''}`} key={slot}>
            <button type="button" className="slot-heading" aria-expanded={!collapsed} onClick={() => toggleSlot(slot)} title={`${collapsed ? 'Expand' : 'Collapse'} ${slot}`}>
              <span className="slot-caret" aria-hidden="true">◆</span>
              <strong>{slot}</strong>
              <span>{collapsed ? 'Collapsed' : `${items.length} items`}</span>
              <b>{items.length}</b>
            </button>
            {!collapsed ? (
              <div className="card-grid">
                {items.map((row) => <ArmorCard key={row.Id} row={row} onTag={onTag} onAction={onAction} onLock={onLock} onCompareGroup={onCompareGroup} />)}
              </div>
            ) : null}
          </section>
        );
      })}
    </section>
  );
}

function normalizeCollapsedSlots(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([slot, collapsed]) => SLOT_ORDER.includes(slot) && Boolean(collapsed)).map(([slot]) => [slot, true]));
}
