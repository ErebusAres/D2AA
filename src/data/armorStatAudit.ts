import { STAT_KEYS } from '../utils/constants';
import type { ArmorStats, BonusType, StatKey } from '../types/armor';
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

const BONUS_TYPES: BonusType[] = ['masterwork', 'mod', 'artifice', 'other'];
const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
const MIN_PLAUSIBLE_ARMOR_BASE_TOTAL = 20;

export interface AuditPlug {
  hash: number | string;
  name: string;
  description: string;
  icon: string;
  type: string;
  category: string;
  stats: Array<{ statTypeHash?: number; value?: number; statValue?: number }>;
  resolvedStats?: ArmorStats;
  reason?: string;
}

export interface ArmorStatAuditResult {
  row: Record<string, number | string>;
  audit: {
    itemStats: Record<string, { value?: number } | number>;
    definitionStats: Record<string, { value?: number } | number>;
    current: ArmorStats;
    base: ArmorStats;
    totals: { base: number; current: number; bonus: number };
    bonusBreakdown: Record<BonusType, ArmorStats>;
    activePlugs: AuditPlug[];
    allPlugs: AuditPlug[];
    classifiedPlugs: Record<string, Array<{ hash: number | string; name: string; category: string; stats: ArmorStats; reason: string }>>;
    ignoredPlugs: Array<{ hash: number | string; name: string; category: string; stats: ArmorStats; reason: string }>;
    warnings: Array<Record<string, unknown>>;
    baseSource: string;
  };
}

export function auditArmorStats(args: {
  itemDefinition: DestinyInventoryItemDefinition;
  statComponent?: { stats?: Record<string, { value?: number } | number> };
  activePlugDefs?: DestinyInventoryItemDefinition[];
  allPlugDefs?: DestinyInventoryItemDefinition[];
  statColumnMap?: Record<number, StatKey>;
  iconUrl?: (value: unknown) => string;
}): ArmorStatAuditResult {
  const statColumnMap = args.statColumnMap || ARMOR_STAT_HASH_TO_KEY;
  const currentSource = Object.keys(args.statComponent?.stats || {}).length ? args.statComponent?.stats || {} : args.itemDefinition.stats?.stats || {};
  const current = statsFromHashMap(currentSource, statColumnMap);
  const activePlugs = serializeAuditPlugs(args.activePlugDefs || [], args.iconUrl || ((value) => String(value || '')));
  const allPlugs = serializeAuditPlugs(args.allPlugDefs || [], args.iconUrl || ((value) => String(value || '')));
  const classified = classifyActivePlugs(activePlugs, statColumnMap);
  const socketBase = sumPlugStats(classified.base);
  const definitionBase = statsFromHashMap(args.itemDefinition.stats?.stats || {}, statColumnMap);
  const warnings: Array<Record<string, unknown>> = [];
  const baseResolution = resolveBase({ current, socketBase, definitionBase, classified, warnings });
  const base = baseResolution.stats;
  const displayBreakdown = displayBreakdownFor({ current, base, classified });
  const row = buildStatRow({ current, base, displayBreakdown, source: baseResolution.source });
  const expectedCurrent = addStats(base, signedBonusStats(classified));

  if (!sameStats(current, expectedCurrent)) {
    warnings.push({ code: 'current-does-not-match-classified-plugs', current, expected: expectedCurrent });
  }

  return {
    row,
    audit: {
      itemStats: args.statComponent?.stats || {},
      definitionStats: args.itemDefinition.stats?.stats || {},
      current,
      base,
      totals: { base: totalStats(base), current: totalStats(current), bonus: totalStats(current) - totalStats(base) },
      bonusBreakdown: displayBreakdown,
      activePlugs,
      allPlugs,
      classifiedPlugs: Object.fromEntries(Object.entries(classified).map(([key, plugs]) => [key, plugs.map(compactPlug)])),
      ignoredPlugs: classified.ignored.map(compactPlug),
      warnings,
      baseSource: baseResolution.source
    }
  };
}

function resolveBase(args: {
  current: ArmorStats;
  socketBase: ArmorStats;
  definitionBase: ArmorStats;
  classified: ClassifiedPlugs;
  warnings: Array<Record<string, unknown>>;
}): { stats: ArmorStats; source: string } {
  if (args.classified.base.some((plug) => normalize(plug.category) === 'intrinsics')) {
    return { stats: addStats(args.socketBase, args.definitionBase), source: 'ActiveIntrinsicStatsSocketsPlusDefinitionStats' };
  }
  if (totalStats(args.socketBase)) return { stats: args.socketBase, source: 'ActiveArmorStatsSockets' };
  if (totalStats(args.definitionBase) && !isSuspiciousDefinitionBase(args.current, args.definitionBase)) {
    args.warnings.push({ code: 'missing-active-armor-stats-sockets', fallback: 'definition-stats' });
    return { stats: args.definitionBase, source: 'BungieDefinitionStats' };
  }
  if (totalStats(args.definitionBase)) {
    args.warnings.push({ code: 'suspicious-definition-base', definitionTotal: totalStats(args.definitionBase), currentTotal: totalStats(args.current) });
  }
  const explicitBonuses = explicitBonusStats(args.classified);
  if (absoluteTotalOf(explicitBonuses)) {
    args.warnings.push({ code: 'missing-authoritative-base', fallback: 'instance-minus-explicit-active-plugs' });
    return { stats: nonNegativeStats(subtractStats(args.current, explicitBonuses)), source: 'BungieInstanceStatsMinusExplicitActivePlugs' };
  }
  args.warnings.push({ code: 'missing-authoritative-base', fallback: 'instance-stats' });
  return { stats: { ...args.current }, source: 'BungieInstanceStatsFallback' };
}

interface ClassifiedPlugs {
  base: AuditPlug[];
  masterwork: AuditPlug[];
  mod: AuditPlug[];
  artifice: AuditPlug[];
  tuning: AuditPlug[];
  other: AuditPlug[];
  ignored: AuditPlug[];
}

function classifyActivePlugs(plugs: AuditPlug[], statColumnMap: Record<number, StatKey>): ClassifiedPlugs {
  const classified: ClassifiedPlugs = { base: [], masterwork: [], mod: [], artifice: [], tuning: [], other: [], ignored: [] };
  for (const plug of plugs) {
    const stats = statsFromInvestmentStats(plug.stats, statColumnMap);
    const text = normalize(`${plug.name} ${plug.description} ${plug.type} ${plug.category}`);
    const category = normalize(plug.category);
    const entry = { ...plug, resolvedStats: stats };
    if (!absoluteTotalOf(stats)) classified.ignored.push({ ...entry, reason: 'no-armor-stats' });
    else if (category === 'armor stats' || category === 'intrinsics') classified.base.push(entry);
    else if (isArchetypePlug(plug, text)) classified.ignored.push({ ...entry, reason: 'archetype' });
    else if (isTuningPlug(plug, text, stats)) classified.tuning.push(entry);
    else if (text.includes('masterwork') || text.includes('upgrade armor') || category.includes('armor masterworks')) classified.masterwork.push(entry);
    else if (text.includes('artifice')) classified.artifice.push(entry);
    else if (text.includes('armor mod') || text.includes('armor mods') || text.includes('mod socket') || text.includes('stat mod')) classified.mod.push(entry);
    else if (text.includes('armor bonus') || text.includes('stat bonus')) classified.other.push(entry);
    else classified.ignored.push({ ...entry, reason: 'unclassified-stat-plug' });
  }
  return classified;
}

function displayBreakdownFor(args: { current: ArmorStats; base: ArmorStats; classified: ClassifiedPlugs }): Record<BonusType, ArmorStats> {
  const out = Object.fromEntries(BONUS_TYPES.map((type) => [type, emptyStats()])) as Record<BonusType, ArmorStats>;
  const remaining = positiveStats(subtractStats(args.current, args.base));
  const budget = { value: Math.max(0, totalStats(args.current) - totalStats(args.base)) };
  allocateVisibleStats(out.mod, sumPlugStats(args.classified.mod), remaining, budget);
  allocateVisibleStats(out.artifice, sumPlugStats(args.classified.artifice), remaining, budget);
  allocateVisibleStats(out.mod, effectivePositiveTuning(args.base, args.classified), remaining, budget);
  allocateVisibleStats(out.masterwork, sumPlugStats(args.classified.masterwork), remaining, budget);
  allocateVisibleStats(out.other, sumPlugStats(args.classified.other), remaining, budget);
  allocateVisibleStats(out.other, remaining, remaining, budget);
  return out;
}

function buildStatRow(args: { current: ArmorStats; base: ArmorStats; displayBreakdown: Record<BonusType, ArmorStats>; source: string }): Record<string, number | string> {
  const row: Record<string, number | string> = {};
  for (const key of STAT_KEYS) {
    row[key] = number(args.base[key]);
    row[`Base${key}`] = number(args.base[key]);
    row[`Current${key}`] = number(args.current[key]);
    row[`StatBonus${key}`] = number(args.current[key]) - number(args.base[key]);
    for (const type of BONUS_TYPES) row[`${title(type)}Bonus${key}`] = number(args.displayBreakdown[type][key]);
  }
  for (const type of BONUS_TYPES) row[`${title(type)}BonusTotal`] = totalStats(args.displayBreakdown[type]);
  row.Total = totalStats(args.base);
  row.BaseTotal = row.Total;
  row.CurrentTotal = totalStats(args.current);
  row.StatBonusTotal = Number(row.CurrentTotal) - Number(row.BaseTotal);
  row.StatSource = args.source;
  return row;
}

function serializeAuditPlugs(plugDefs: DestinyInventoryItemDefinition[], iconUrl: (value: unknown) => string): AuditPlug[] {
  return plugDefs
    .map((plug) => ({
      hash: plug.hash || '',
      name: plug.displayProperties?.name || '',
      description: plug.displayProperties?.description || '',
      icon: iconUrl(displayIconPath(plug)),
      type: plug.itemTypeDisplayName || '',
      category: plug.plug?.plugCategoryIdentifier || '',
      stats: plug.investmentStats || []
    }))
    .filter((plug) => plug.stats.length || /set|bonus|mod|masterwork|artifice|piece|wearing|trait|intrinsic/i.test(`${plug.name} ${plug.description} ${plug.type} ${plug.category}`));
}

function compactPlug(plug: AuditPlug): { hash: number | string; name: string; category: string; stats: ArmorStats; reason: string } {
  return { hash: plug.hash, name: plug.name, category: plug.category, stats: plug.resolvedStats || emptyStats(), reason: plug.reason || '' };
}

function displayIconPath(plug: DestinyInventoryItemDefinition): string {
  const category = normalize(plug.plug?.plugCategoryIdentifier);
  const tuningOverlay = category.includes('tuning') ? plug.displayProperties?.iconSequences?.[1]?.frames?.[0] : '';
  return tuningOverlay || plug.displayProperties?.icon || plug.displayProperties?.iconSequences?.[0]?.frames?.[0] || '';
}

function statsFromHashMap(source: Record<string, { value?: number } | number>, statColumnMap: Record<number, StatKey>): ArmorStats {
  const out = emptyStats();
  for (const [hash, value] of Object.entries(source)) {
    const key = keyFromHash(hash, statColumnMap);
    if (key) out[key] += typeof value === 'number' ? number(value) : number(value.value);
  }
  return out;
}

function statsFromInvestmentStats(stats: Array<{ statTypeHash?: number; value?: number; statValue?: number }>, statColumnMap: Record<number, StatKey>): ArmorStats {
  const out = emptyStats();
  for (const stat of stats) {
    const key = keyFromHash(stat.statTypeHash, statColumnMap);
    if (key) out[key] += number(stat.value ?? stat.statValue);
  }
  return out;
}

function keyFromHash(hash: unknown, statColumnMap: Record<number, StatKey>): StatKey | '' {
  const unsigned = Number(hash) >>> 0;
  const signed = Number(hash) | 0;
  return statColumnMap[unsigned] || statColumnMap[signed] || ARMOR_STAT_HASH_TO_KEY[unsigned] || '';
}

function signedBonusStats(classified: ClassifiedPlugs): ArmorStats {
  return ['masterwork', 'mod', 'artifice', 'tuning', 'other'].reduce((out, type) => addStats(out, sumPlugStats(classified[type as keyof ClassifiedPlugs] as AuditPlug[])), emptyStats());
}

function explicitBonusStats(classified: ClassifiedPlugs): ArmorStats {
  return ['mod', 'artifice', 'tuning', 'other'].reduce((out, type) => addStats(out, sumPlugStats(classified[type as keyof ClassifiedPlugs] as AuditPlug[])), emptyStats());
}

function effectivePositiveTuning(base: ArmorStats, classified: ClassifiedPlugs): ArmorStats {
  const tuning = sumPlugStats(classified.tuning);
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, number(base[key]) + number(tuning[key])) - number(base[key])])) as ArmorStats;
}

function allocateVisibleStats(target: ArmorStats, offered: ArmorStats, remaining: ArmorStats, budget: { value: number }): void {
  for (const key of STAT_KEYS) {
    if (budget.value <= 0) break;
    const value = Math.min(Math.max(0, number(offered[key])), Math.max(0, number(remaining[key])), budget.value);
    target[key] += value;
    remaining[key] -= value;
    budget.value -= value;
  }
}

function sumPlugStats(plugs: AuditPlug[]): ArmorStats {
  return plugs.reduce((out, plug) => addStats(out, plug.resolvedStats || emptyStats()), emptyStats());
}

function addStats(left: ArmorStats, right: ArmorStats): ArmorStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, number(left[key]) + number(right[key])])) as ArmorStats;
}

function subtractStats(left: ArmorStats, right: ArmorStats): ArmorStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, number(left[key]) - number(right[key])])) as ArmorStats;
}

function positiveStats(stats: ArmorStats): ArmorStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, number(stats[key]))])) as ArmorStats;
}

function nonNegativeStats(stats: ArmorStats): ArmorStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, number(stats[key]))])) as ArmorStats;
}

function sameStats(left: ArmorStats, right: ArmorStats): boolean {
  return STAT_KEYS.every((key) => number(left[key]) === number(right[key]));
}

function isSuspiciousDefinitionBase(current: ArmorStats, definitionBase: ArmorStats): boolean {
  return totalStats(definitionBase) < MIN_PLAUSIBLE_ARMOR_BASE_TOTAL && totalStats(current) >= MIN_PLAUSIBLE_ARMOR_BASE_TOTAL;
}

function absoluteTotalOf(stats: ArmorStats): number {
  return STAT_KEYS.reduce((sum, key) => sum + Math.abs(number(stats[key])), 0);
}

function isArchetypePlug(plug: AuditPlug, text: string): boolean {
  return ARCHETYPE_NAMES.has(normalize(plug.name)) || text.includes('archetype');
}

function isTuningPlug(plug: AuditPlug, text: string, stats: ArmorStats): boolean {
  const values = STAT_KEYS.map((key) => number(stats[key])).filter(Boolean);
  const positives = values.filter((value) => value > 0);
  const negatives = values.filter((value) => value < 0);
  const maxAbs = Math.max(0, ...values.map((value) => Math.abs(value)));
  if (!positives.length || !negatives.length || maxAbs > 5) return false;
  return /\b(tuning|tuned|attunement|stat focus|focusing)\b/i.test(text) || Boolean(plug.icon);
}

function title(value: string): string {
  return value.replace(/^./, (char) => char.toUpperCase());
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function number(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
