import type { ArmorItem } from '../types/armor';
import { TAGS } from '../utils/constants';
import { actionLabel, canRunAction } from '../data/actions';
import CopyItemIdButton from './CopyItemIdButton';

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
      {row.IsLocked ? <span className="lock-chip" title="Locked in game" aria-label="Locked in game"><LockIcon /></span> : null}
      <button
        type="button"
        className={`location-chip location-${location.toLowerCase()} ${canRunAction(row) ? 'is-action' : ''}`}
        title={`${location} - ${canRunAction(row) ? `${label} ${row.Name}` : location}`}
        aria-label={`${location} - ${canRunAction(row) ? `${label} ${row.Name}` : location}`}
        disabled={!canRunAction(row)}
        onClick={() => onAction(row)}
      >
        <LocationIcon location={location} />
      </button>
      <CopyItemIdButton id={row.Id} />
      <span className={`grade-chip grade-${grade.letter}`} title={`Rank ${grade.letter} · ${grade.score}`}>{grade.letter}</span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="1.5" />
      <path d="M8.5 10V7a3.5 3.5 0 017 0v3" />
    </svg>
  );
}

function LocationIcon({ location }: { location: string }) {
  if (location === 'Equipped') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 4v5c0 4.5-2.8 7.8-7 9-4.2-1.2-7-4.5-7-9V7l7-4z" />
        <path d="M8.5 12.2l2.2 2.2 4.9-5" />
      </svg>
    );
  }
  if (location === 'Vault') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="1.5" />
        <path d="M8 6V4h8v2M9 13h6M12 10v6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7l7-4 7 4v10l-7 4-7-4V7z" />
      <path d="M5 7l7 4 7-4M12 11v10" />
    </svg>
  );
}
