import { STAT_KEYS } from '../utils/constants';
import type { ArmorStats, StatKey } from '../types/armor';
import type { DestinyInventoryItemDefinition } from '../types/bungie';
import { emptyStats, totalStats } from '../utils/statMath';

export const ARMOR_STAT_HASH_TO_KEY: Record<number, StatKey> = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'Weapon',
  1943323491: 'ClassAbility'
};

export function auditArmorStats(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  statComponent?: { stats?: Record<string, { value?: number } | number> };
  statColumnMap?: Record<number, StatKey>;
}): { row: Record<string, number | string>; audit: { current: ArmorStats; base: ArmorStats; totals: { base: number; current: number; bonus: number }; baseSource: string } } {
  const currentSource = Object.keys(args.statComponent?.stats || {}).length ? args.statComponent?.stats : args.itemDefinition.stats?.stats || {};
  const current = statsFromHashMap(currentSource || {}, args.statColumnMap || ARMOR_STAT_HASH_TO_KEY);
  const base = totalStats(current) ? current : emptyStats();
  const row: Record<string, number | string> = {};
  for (const key of STAT_KEYS) {
    row[key] = base[key];
    row[`Base${key}`] = base[key];
    row[`Current${key}`] = current[key];
    row[`StatBonus${key}`] = current[key] - base[key];
  }
  row.Total = totalStats(base);
  row.BaseTotal = row.Total;
  row.CurrentTotal = totalStats(current);
  row.StatBonusTotal = Number(row.CurrentTotal) - Number(row.BaseTotal);
  row.StatSource = 'BungieInstanceStats';
  return { row, audit: { current, base, totals: { base: totalStats(base), current: totalStats(current), bonus: totalStats(current) - totalStats(base) }, baseSource: 'BungieInstanceStats' } };
}

function statsFromHashMap(source: Record<string, { value?: number } | number>, statColumnMap: Record<number, StatKey>): ArmorStats {
  const out = emptyStats();
  for (const [hash, value] of Object.entries(source)) {
    const key = statColumnMap[Number(hash) >>> 0] || ARMOR_STAT_HASH_TO_KEY[Number(hash) >>> 0];
    if (key) out[key] += typeof value === 'number' ? value : Number(value.value || 0);
  }
  return out;
}
