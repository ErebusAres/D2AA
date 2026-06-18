import ArmorStats from './ArmorStats';
import ArmorBadges from './ArmorBadges';
import type { ArmorItem, ArmorPerk } from '../types/armor';
import { displayName, locationText, rarityClass } from '../utils/formatters';
import { gradeFor } from '../utils/statMath';

interface ArmorCardProps {
  row: ArmorItem;
  onTag: (id: string, tag: string) => void;
  onAction: (row: ArmorItem) => void;
  onLock: (row: ArmorItem) => void;
  onCompareGroup: (groupKey: string) => void;
}

export default function ArmorCard({ row, onTag, onAction, onLock, onCompareGroup }: ArmorCardProps) {
  const grade = gradeFor(row);
  const perks = displayPerks(row);
  const tier = Number(row.Tier || row.GearTier || 0);
  return (
    <article className={`armor-card rarity-${rarityClass(row.Rarity)} ${row.GroupColor || ''} ${row.IsMasterworked ? 'is-masterworked' : ''}`}>
      <div className="card-title">
        {row.IconUrl || row.Icon ? <img className="item-icon" src={row.IconUrl || row.Icon} alt="" /> : <div className="item-icon item-icon--empty" />}
        <div className={`tier-rail ${tierColorClass(tier)}`}>{Array.from({ length: 5 }, (_, index) => {
          const level = 5 - index;
          return <span key={level} className={`tier-mark ${level <= tier ? 'is-on' : ''}`}>◆</span>;
        })}</div>
        <div className="title-copy">
          <strong title={displayName(row)}>{displayName(row)}</strong>
          <ArmorBadges row={row} grade={grade} location={locationText(row)} onTag={onTag} onAction={onAction} onLock={onLock} />
        </div>
        {row.Is_Dupe ? (
          <button type="button" className={`group-badge ${row.GroupColor || ''}`} title={`Compare group ${row.Group || ''}`} onClick={() => onCompareGroup(String(row.GroupActionKey || ''))}>
            {row.Group}
          </button>
        ) : null}
        <div className="power-badge">{row.Power || row.Light || ''}</div>
      </div>
      <div className="card-body">
        <aside className="card-side">
          <div className="archetype has-tooltip" tabIndex={0}>
            <span className="archetype-icon">{row.ArchetypeIcon ? <img className="archetype-img" src={row.ArchetypeIcon} alt="" /> : '◇'}</span>
            <b>{row.Archetype || '—'}</b>
            <Tooltip title={String(row.Archetype || 'Armor Archetype')} label="Archetype" description={String(row.ArchetypeDescription || row.ArchetypeTrait || 'Bungie armor archetype.')} />
          </div>
          <div className="set-bonus-list">
            {perks.slice(0, 4).map((perk, index) => <SetBonusRow key={`${perk.hash || perk.name}-${index}`} perk={perk} />)}
          </div>
        </aside>
        <ArmorStats row={row} />
      </div>
    </article>
  );
}

function tierColorClass(tier: number): string {
  if (tier >= 5) return 'tier-color-gold';
  if (tier >= 3) return 'tier-color-purple';
  if (tier >= 1) return 'tier-color-white';
  return 'tier-color-empty';
}

function SetBonusRow({ perk }: { perk: ArmorPerk }) {
  const kind = String(perk.kind || 'armor').toLowerCase();
  const label = perk.label || labelForKind(kind);
  const setContext = perk.setName && perk.source ? `${perk.setName} - ${perk.source}` : String(perk.setName || perk.source || label);
  return (
    <div className={`set-bonus-row is-${kind}`} tabIndex={0}>
      {perk.icon ? <img src={perk.icon} alt="" /> : <span className="set-bonus-fallback">✦</span>}
      <span className="set-bonus-copy">
        <b>{perk.name || 'Armor Bonus'}</b>
        <em>{kind === 'set' ? setContext : label}</em>
      </span>
      <Tooltip title={perk.name || 'Armor Bonus'} label={kind === 'set' ? `${label}${perk.setName ? ` - ${perk.setName}` : ''}` : label} description={perk.description || ''} />
    </div>
  );
}

function Tooltip({ title, label, description }: { title: string; label: string; description: string }) {
  return (
    <span className="d2-tooltip">
      <b>{title}</b>
      <em>{label}</em>
      {description ? <p>{description}</p> : null}
    </span>
  );
}

function displayPerks(row: ArmorItem): ArmorPerk[] {
  return uniquePerks([
    ...arrayValue(row.ExoticPerks),
    ...arrayValue(row.ExoticArmorPerks),
    ...arrayValue(row.ArmorSetBonuses),
    ...arrayValue(row.SetBonuses),
    ...arrayValue(row.ArmorBonuses),
    ...arrayValue(row.ArmorPerks)
  ]);
}

function arrayValue(value: unknown): ArmorPerk[] {
  if (Array.isArray(value)) return value as ArmorPerk[];
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed as ArmorPerk[];
    } catch {
      return [];
    }
  }
  return [];
}

function uniquePerks(perks: ArmorPerk[]): ArmorPerk[] {
  const seen = new Set<string>();
  return perks.filter((perk) => {
    const key = `${perk.hash || ''}:${perk.name || ''}:${perk.description || ''}`;
    if (!perk.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function labelForKind(kind: string): string {
  if (kind === 'exotic') return 'Exotic Intrinsic';
  if (kind === 'catalyst') return 'Exotic Catalyst';
  if (kind === 'set') return 'Armor Set Bonus';
  return 'Armor Bonus';
}
