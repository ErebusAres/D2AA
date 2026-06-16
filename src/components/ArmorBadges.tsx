import type { ArmorItem } from '../types/armor';
import { TAGS } from '../utils/constants';
import { actionLabel, canRunAction } from '../data/actions';

interface ArmorBadgesProps {
  row: ArmorItem;
  grade: { letter: string; score: number };
  location: string;
  onTag: (id: string, tag: string) => void;
  onAction: (row: ArmorItem) => void;
}

export default function ArmorBadges({ row, grade, location, onTag, onAction }: ArmorBadgesProps) {
  const label = actionLabel(row);
  return (
    <div className="meta-line">
      <select className="tag-chip" value={row.Tag || ''} onChange={(event) => onTag(row.Id, event.target.value)} aria-label="Tag item">
        {TAGS.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
      </select>
      {row.IsLocked ? <span className="lock-chip">Locked</span> : null}
      <button
        type="button"
        className={`location-chip location-${location.toLowerCase()} ${canRunAction(row) ? 'is-action' : ''}`}
        title={canRunAction(row) ? `${label} ${row.Name}` : location}
        disabled={!canRunAction(row)}
        onClick={() => onAction(row)}
      >
        {label}
      </button>
      <span className={`grade-chip grade-${grade.letter}`} title={`Rank ${grade.letter} · ${grade.score}`}>{grade.letter}</span>
    </div>
  );
}
