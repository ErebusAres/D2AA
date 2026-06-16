import type { ArmorItem } from '../types/armor';
import { getActiveFeedRows } from '../data/feedState';
import { displayName, rarityClass } from '../utils/formatters';
import { gradeFor } from '../utils/statMath';
import CopyItemIdButton from './CopyItemIdButton';

interface ItemFeedProps {
  rows: ArmorItem[];
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  onTag: (id: string, tag: string) => void;
}

export default function ItemFeed({ rows, onDismiss, onRefresh, onTag }: ItemFeedProps) {
  const active = getActiveFeedRows(rows);
  return (
    <aside className="item-feed is-open">
      <div className="feed-shell">
        <div className="feed-head">
          <strong>Latest Items</strong>
          <span>{active.length}</span>
          <button type="button" className="feed-refresh-button" title="Check latest drops now" aria-label="Check latest drops now" onClick={onRefresh}>{'\u21bb'}</button>
        </div>
        <div className="feed-list">
          {active.map((row) => (
            <article className={`feed-card rarity-${rarityClass(row.Rarity)} ${row.GroupColor || ''}`} key={row.Id}>
              {row.IconUrl || row.Icon ? <img src={row.IconUrl || row.Icon} alt="" /> : null}
              <div>
                <strong>{displayName(row)}</strong>
                <span className="feed-meta">
                  <button type="button" className="tag-chip" onClick={() => onTag(row.Id, 'keep')}>{row.Tag || '+'}</button>
                  <CopyItemIdButton id={row.Id} />
                  <b className={`grade-chip grade-${gradeFor(row).letter}`} title={`Rank ${gradeFor(row).letter}`}>{gradeFor(row).letter}</b>
                </span>
                <small>{row.Slot} · {row.Archetype || '—'} · {row.Power || row.Light || ''}</small>
              </div>
              <button type="button" className="dismiss" onClick={() => onDismiss(row.Id)}>×</button>
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}
