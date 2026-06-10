import type { ArmorItem } from '../types/armor';
import { TAGS } from '../utils/constants';

interface ArmorBadgesProps {
  row: ArmorItem;
  grade: { letter: string; score: number };
  location: string;
  onTag: (id: string, tag: string) => void;
}

export default function ArmorBadges({ row, grade, location, onTag }: ArmorBadgesProps) {
  return (
    <div className="meta-line">
      <select className="tag-chip" value={row.Tag || ''} onChange={(event) => onTag(row.Id, event.target.value)} aria-label="Tag item">
        {TAGS.map((tag) => <option key={tag.value} value={tag.value}>{tag.label}</option>)}
      </select>
      {row.IsLocked ? <span className="lock-chip">Locked</span> : null}
      <span className={`location-chip location-${location.toLowerCase()}`}>{location}</span>
      <span className={`grade-chip grade-${grade.letter}`} title={`Rank ${grade.letter} · ${grade.score}`}>{grade.letter}</span>
    </div>
  );
}
