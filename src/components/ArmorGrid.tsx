import ArmorCard from './ArmorCard';
import type { ArmorItem } from '../types/armor';
import { SLOT_ORDER } from '../utils/constants';

interface ArmorGridProps {
  rows: ArmorItem[];
  onTag: (id: string, tag: string) => void;
  onAction: (row: ArmorItem) => void;
  onCompareGroup: (groupKey: string) => void;
}

export default function ArmorGrid({ rows, onTag, onAction, onCompareGroup }: ArmorGridProps) {
  return (
    <section className="slot-stack">
      {SLOT_ORDER.map((slot) => {
        const items = rows.filter((row) => row.Slot === slot);
        if (!items.length) return null;
        return (
          <section className="slot-section" key={slot}>
            <div className="slot-heading"><span className="slot-caret">⌄</span><strong>{slot}</strong><b>{items.length}</b></div>
            <div className="card-grid">
              {items.map((row) => <ArmorCard key={row.Id} row={row} onTag={onTag} onAction={onAction} onCompareGroup={onCompareGroup} />)}
            </div>
          </section>
        );
      })}
    </section>
  );
}
