import { STAT_KEYS } from './constants';
import type { ArmorItem, ArmorStats, BonusType, StatKey } from '../types/armor';

export function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyStats(): ArmorStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as ArmorStats;
}

export function totalStats(stats: Partial<Record<StatKey, number>>): number {
  return STAT_KEYS.reduce((sum, key) => sum + numberValue(stats[key]), 0);
}

export function statModel(row: ArmorItem, key: StatKey): { base: number; current: number; parts: Array<{ type: BonusType; value: number }>; source: string } {
  const parts = bonusParts(row, key);
  const signedBonus = parts.reduce((sum, part) => sum + part.value, 0);
  const explicitBase = numberValue(row[`Base${key}` as keyof ArmorItem]);
  const rawCurrent = hasValue(row[`Current${key}` as keyof ArmorItem])
    ? numberValue(row[`Current${key}` as keyof ArmorItem])
    : numberValue(row[key]);
  const useBase = STAT_KEYS.some((stat) => numberValue(row[`Base${stat}` as keyof ArmorItem]) !== 0);
  const base = useBase ? explicitBase : Math.max(0, rawCurrent - signedBonus);
  const current = hasValue(row[`Current${key}` as keyof ArmorItem]) ? rawCurrent : Math.max(0, base + signedBonus);
  const source = useBase
    ? String(row.StatAudit?.baseSource || row.StatSource || 'explicit base stat fields')
    : signedBonus
      ? 'current minus visible bonus parts'
      : 'current stat fallback';
  return { base, current, parts, source };
}

export function baseTotal(row: ArmorItem): number {
  return STAT_KEYS.reduce((sum, key) => sum + statModel(row, key).base, 0);
}

export function currentTotal(row: ArmorItem): number {
  return STAT_KEYS.reduce((sum, key) => sum + statModel(row, key).current, 0);
}

export function bonusParts(row: ArmorItem, key: StatKey): Array<{ type: BonusType; value: number }> {
  const types: BonusType[] = ['masterwork', 'mod', 'artifice', 'other'];
  const parts = types
    .map((type) => ({ type, value: pickSigned(row[`${capitalize(type)}Bonus${key}` as keyof ArmorItem], row.StatAudit?.bonusBreakdown?.[type]?.[key]) }))
    .filter((part) => part.value !== 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  const fallback = hasValue(row[`StatBonus${key}` as keyof ArmorItem])
    ? numberValue(row[`StatBonus${key}` as keyof ArmorItem])
    : hasValue(row[`Current${key}` as keyof ArmorItem]) && hasValue(row[`Base${key}` as keyof ArmorItem])
      ? numberValue(row[`Current${key}` as keyof ArmorItem]) - numberValue(row[`Base${key}` as keyof ArmorItem])
      : 0;
  const remainder = fallback - known;
  if (remainder > 0) parts.push({ type: 'other', value: remainder });
  return parts;
}

export function totalBonusParts(row: ArmorItem): Array<{ type: BonusType; value: number }> {
  const types: BonusType[] = ['masterwork', 'mod', 'artifice', 'other'];
  const parts = types
    .map((type) => ({
      type,
      value: STAT_KEYS.reduce((sum, key) => sum + pickSigned(row[`${capitalize(type)}Bonus${key}` as keyof ArmorItem], row.StatAudit?.bonusBreakdown?.[type]?.[key]), 0)
    }))
    .filter((part) => part.value !== 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  const fallback = hasValue(row.StatBonusTotal) ? numberValue(row.StatBonusTotal) : currentTotal(row) - baseTotal(row);
  const remainder = fallback - known;
  if (remainder > 0) parts.push({ type: 'other', value: remainder });
  return parts;
}

export function gradeFor(row: ArmorItem): { letter: string; score: number } {
  const total = baseTotal(row);
  const top = Math.max(...STAT_KEYS.map((key) => statModel(row, key).base));
  const score = Math.round(Math.min(100, total * 1.15 + top * 1.25 + (row.Is_Dupe ? 5 : 0)));
  const letter = total >= 75 ? 'S' : total >= 72 ? 'A' : total >= 68 ? 'B' : total >= 63 ? 'C' : total >= 58 ? 'D' : 'F';
  return { letter, score };
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function pickSigned(rowValue: unknown, auditValue: unknown): number {
  if (hasValue(rowValue)) return numberValue(rowValue);
  return numberValue(auditValue);
}

function capitalize(value: string): string {
  return value.replace(/^./, (char) => char.toUpperCase());
}
