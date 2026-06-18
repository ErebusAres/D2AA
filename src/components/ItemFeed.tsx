import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ArmorItem } from '../types/armor';
import { getActiveFeedRows } from '../data/feedState';
import { displayName, rarityClass } from '../utils/formatters';
import { gradeFor } from '../utils/statMath';
import ArmorStats from './ArmorStats';
import CopyItemIdButton from './CopyItemIdButton';
import TagPicker from './TagPicker';

interface ItemFeedProps {
  rows: ArmorItem[];
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  onTag: (id: string, tag: string) => void;
  isRefreshing: boolean;
}

export default function ItemFeed({ rows, onDismiss, onRefresh, onTag, isRefreshing }: ItemFeedProps) {
  const active = getActiveFeedRows(rows);
  const [popout, setPopout] = useState<{ row: ArmorItem; rect: DOMRect } | null>(null);
  return (
    <aside className="item-feed is-open">
      <div className={`feed-shell ${isRefreshing ? 'is-refreshing' : ''}`}>
        <div className="feed-head">
          <strong>Latest Items</strong>
          <span>{active.length}</span>
          <button type="button" className="feed-refresh-button" title="Check latest drops now" aria-label="Check latest drops now" onClick={onRefresh} disabled={isRefreshing}>{'\u21bb'}</button>
        </div>
        <div className="feed-list">
          {active.length ? active.map((row) => (
            <FeedCard
              key={row.Id}
              row={row}
              onDismiss={onDismiss}
              onTag={onTag}
              onShowPopout={(nextRow, element) => setPopout({ row: nextRow, rect: element.getBoundingClientRect() })}
              onHidePopout={() => setPopout(null)}
            />
          )) : <FeedEmpty loadedCount={rows.length} />}
        </div>
        {popout ? <FeedPopout row={popout.row} anchor={popout.rect} /> : null}
      </div>
    </aside>
  );
}

function FeedCard({
  row,
  onDismiss,
  onTag,
  onShowPopout,
  onHidePopout
}: {
  row: ArmorItem;
  onDismiss: (id: string) => void;
  onTag: (id: string, tag: string) => void;
  onShowPopout: (row: ArmorItem, element: HTMLElement) => void;
  onHidePopout: () => void;
}) {
  const tier = Number(row.Tier || row.GearTier || 0);
  return (
    <article className={`feed-card rarity-${rarityClass(row.Rarity)} ${row.GroupColor || ''} ${row.IsMasterworked ? 'is-masterworked' : ''}`} data-id={row.Id}>
      <span
        className="feed-icon-wrap"
        tabIndex={0}
        aria-label={`${displayName(row)} details`}
        onPointerEnter={(event) => onShowPopout(row, event.currentTarget)}
        onPointerLeave={onHidePopout}
        onFocus={(event) => onShowPopout(row, event.currentTarget)}
        onBlur={onHidePopout}
      >
        {row.IconUrl || row.Icon ? <img src={row.IconUrl || row.Icon} alt="" /> : <span className="feed-icon-empty" />}
        <span className={`tier-rail feed-tier-rail ${tierColorClass(tier)}`}>
          {Array.from({ length: 5 }, (_, index) => {
            const level = 5 - index;
            return <span key={level} className={`tier-mark ${level <= tier ? 'is-on' : ''}`}>◆</span>;
          })}
        </span>
      </span>
      <div>
        <strong>{displayName(row)}</strong>
        <span className="feed-meta">
          <TagPicker id={row.Id} value={row.Tag || ''} onChange={onTag} compact />
          <CopyItemIdButton id={row.Id} />
          <b className={`grade-chip grade-${gradeFor(row).letter}`} title={`Rank ${gradeFor(row).letter}`}>{gradeFor(row).letter}</b>
        </span>
        <small>{row.Slot} · {row.Archetype || '—'} · {row.Power || row.Light || ''}</small>
      </div>
      <button type="button" className="dismiss" onClick={() => onDismiss(row.Id)}>×</button>
    </article>
  );
}

function FeedPopout({ row, anchor }: { row: ArmorItem; anchor: DOMRect }) {
  const width = 330;
  const gap = 12;
  const leftSide = anchor.left >= width + gap + 8;
  const left = leftSide ? anchor.left - width - gap : anchor.right + gap;
  const top = Math.max(8, Math.min(window.innerHeight - 300, anchor.top + anchor.height / 2 - 150));
  const style: CSSProperties = { left, top, width };
  return (
    <span className={`feed-stat-popout is-visible ${leftSide ? 'is-left-of-icon' : 'is-right-of-icon'}`} role="tooltip" style={style}>
      <span className="feed-popout-head">
        <strong>{displayName(row)}</strong>
        <em>{row.Rarity || 'Legendary'} {row.Slot}{row.Power || row.Light ? ` · ${row.Power || row.Light}` : ''}</em>
      </span>
      <span className="feed-popout-body">
        <span className="feed-popout-side">
          <span className="feed-popout-archetype">
            {row.ArchetypeIcon ? <img src={row.ArchetypeIcon} alt="" /> : <b>◇</b>}
            <span>{row.Archetype || '—'}</span>
          </span>
        </span>
        <ArmorStats row={row} />
      </span>
    </span>
  );
}

function FeedEmpty({ loadedCount }: { loadedCount: number }) {
  return (
    <div className="feed-empty">
      <strong>{loadedCount > 0 ? 'No newly obtained armor.' : 'No armor loaded yet.'}</strong>
      <span>{loadedCount > 0 ? 'New drops stay here until dismissed, tagged, or outside the latest item limit.' : 'Sync with Bungie or upload a DIM CSV to populate the item feed.'}</span>
    </div>
  );
}

function tierColorClass(tier: number): string {
  if (tier >= 5) return 'tier-color-gold';
  if (tier >= 3) return 'tier-color-purple';
  if (tier >= 1) return 'tier-color-white';
  return 'tier-color-empty';
}
