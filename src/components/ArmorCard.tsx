import ArmorStats from './ArmorStats';
import ArmorBadges from './ArmorBadges';
import type { ArmorItem } from '../types/armor';
import { displayName, locationText, rarityClass } from '../utils/formatters';
import { gradeFor } from '../utils/statMath';

interface ArmorCardProps {
  row: ArmorItem;
  onTag: (id: string, tag: string) => void;
}

export default function ArmorCard({ row, onTag }: ArmorCardProps) {
  const grade = gradeFor(row);
  const perks = firstArray(row.ArmorSetBonuses, row.SetBonuses, row.ExoticPerks, row.ExoticArmorPerks, row.ArmorBonuses, row.ArmorPerks);
  return (
    <article className={`armor-card rarity-${rarityClass(row.Rarity)} ${row.GroupColor || ''} ${row.IsMasterworked ? 'is-masterworked' : ''}`}>
      <div className="card-title">
        {row.IconUrl || row.Icon ? <img className="item-icon" src={row.IconUrl || row.Icon} alt="" /> : <div className="item-icon item-icon--empty" />}
        <div className="tier-rail">{Array.from({ length: 5 }, (_, index) => <span key={index} className={5 - index <= Number(row.Tier || row.GearTier || 0) ? 'is-on' : ''}>◆</span>)}</div>
        <div className="title-copy">
          <strong title={displayName(row)}>{displayName(row)}</strong>
          <ArmorBadges row={row} grade={grade} location={locationText(row)} onTag={onTag} />
        </div>
        {row.Is_Dupe ? <span className={`group-badge ${row.GroupColor || ''}`}>{row.Group}</span> : null}
        <div className="power-badge">{row.Power || row.Light || ''}</div>
      </div>
      <div className="card-body">
        <aside className="card-side">
          <div className="archetype"><span>◇</span><b>{row.Archetype || '—'}</b></div>
          <div className={`bonus-icons ${row.Rarity === 'Exotic' ? 'is-exotic' : ''}`}>
            {perks.slice(0, 4).map((perk, index) => <span key={`${perk.name}-${index}`} title={perk.description}>{perk.icon ? <img src={perk.icon} alt="" /> : '✦'}</span>)}
          </div>
        </aside>
        <ArmorStats row={row} />
      </div>
    </article>
  );
}

function firstArray(...values: unknown[]): Array<{ name?: string; description?: string; icon?: string }> {
  for (const value of values) {
    if (Array.isArray(value)) return value as Array<{ name?: string; description?: string; icon?: string }>;
    if (typeof value === 'string' && value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed as Array<{ name?: string; description?: string; icon?: string }>;
      } catch {
        return [];
      }
    }
  }
  return [];
}
