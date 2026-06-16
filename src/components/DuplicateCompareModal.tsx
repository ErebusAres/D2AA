import ArmorStats from './ArmorStats';
import CopyItemIdButton from './CopyItemIdButton';
import type { CSSProperties } from 'react';
import type { ArmorItem } from '../types/armor';
import { TAGS } from '../utils/constants';
import { actionLabel, canRunAction } from '../data/actions';
import { displayName, rarityClass } from '../utils/formatters';
import { baseTotal, currentTotal, gradeFor } from '../utils/statMath';

interface DuplicateCompareModalProps {
  groupKey: string;
  rows: ArmorItem[];
  onClose: () => void;
  onTag: (id: string, tag: string) => void;
  onAction: (row: ArmorItem) => void;
}

export default function DuplicateCompareModal({ groupKey, rows, onClose, onTag, onAction }: DuplicateCompareModalProps) {
  const sorted = rows.slice().sort((a, b) => baseTotal(b) - baseTotal(a) || currentTotal(b) - currentTotal(a) || displayName(a).localeCompare(displayName(b)));
  const bestId = sorted[0]?.Id || '';
  const groupLabel = sorted[0]?.Group || groupKey;
  if (!sorted.length) return null;

  return (
    <div className="compare-overlay" role="presentation">
      <button type="button" className="compare-backdrop" aria-label="Close comparison" onClick={onClose} />
      <section className="compare-panel" role="dialog" aria-modal="true" aria-label={`Compare duplicate group ${groupLabel}`}>
        <header className="compare-head">
          <div>
            <p>Duplicate Comparison</p>
            <h2>{groupLabel}</h2>
            <span>{sorted.length} items - base-stat order - {sorted[0]?.Slot || 'Armor'}</span>
          </div>
          <div className="compare-head-actions">
            <button type="button" className="compare-close" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="compare-summary">
          <strong>Best base total</strong>
          <span>{displayName(sorted[0])}</span>
          <em>{baseTotal(sorted[0])} base / {currentTotal(sorted[0])} current</em>
        </div>
        <div className="compare-grid" style={{ '--compare-count': String(Math.max(1, sorted.length)) } as CSSProperties}>
          {sorted.map((row) => (
            <CompareCard key={row.Id} row={row} isBest={row.Id === bestId} onTag={onTag} onAction={onAction} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompareCard({ row, isBest, onTag, onAction }: { row: ArmorItem; isBest: boolean; onTag: (id: string, tag: string) => void; onAction: (row: ArmorItem) => void }) {
  const grade = gradeFor(row);
  return (
    <article className={`compare-card ${isBest ? 'is-best' : ''} rarity-${rarityClass(row.Rarity)} ${row.GroupColor || ''}`}>
      <div className="compare-item-head">
        <div className="compare-icon">
          {row.IconUrl || row.Icon ? <img src={row.IconUrl || row.Icon} alt="" /> : null}
          <b>{row.Power || row.Light || ''}</b>
        </div>
        <div>
          <h3 title={displayName(row)}>{displayName(row)}</h3>
          <p>{row.Slot} - {row.Archetype || '—'}</p>
        </div>
        <div className="compare-score"><span>{grade.letter}</span>{grade.score}</div>
      </div>
      <div className="compare-card-body">
        <aside className="compare-card-side">
          <div className="compare-archetype">
            {row.ArchetypeIcon ? <img className="archetype-img" src={row.ArchetypeIcon} alt="" /> : <span>◇</span>}
            <b>{row.Archetype || '—'}</b>
          </div>
          <div className="compare-total-split">
            <span>Totals</span>
            <div><b>{baseTotal(row)}</b><em>base</em></div>
            <strong>{currentTotal(row)}</strong>
          </div>
        </aside>
        <ArmorStats row={row} />
      </div>
      <div className="compare-tags">
        <div className="compare-tag-set">
          {TAGS.filter((tag) => tag.picker).map((tag) => (
            <button type="button" key={tag.value || 'none'} className={row.Tag === tag.value ? 'is-active' : ''} onClick={() => onTag(row.Id, tag.value)}>
              {tag.emoji}
            </button>
          ))}
        </div>
        <CopyItemIdButton id={row.Id} />
        <button type="button" className="compare-pull-button" disabled={!canRunAction(row)} onClick={() => onAction(row)}>
          {actionLabel(row)}
        </button>
      </div>
    </article>
  );
}
