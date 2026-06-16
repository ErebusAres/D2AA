import type { ArmorItem, ArmorStats, StatKey } from '../types/armor';
import { STAT_KEYS, STAT_LABELS } from '../utils/constants';

export interface ArmorTuning {
  name: string;
  icon: string;
  stats: Partial<ArmorStats>;
  summary: string;
  mode: string;
  source: string;
}

export function detectArmorTuning(row: ArmorItem): ArmorTuning | null {
  const explicit = tuningFromObject(row.ArmorTuning || row.Tuning);
  if (explicit) return explicit;
  const auditStats = tuningStatsFromAudit(row);
  if (auditStats && isSafeSmallShift(auditStats)) {
    const plug = (row.StatAudit?.activePlugs || []).find((entry) => {
      const text = normalize(`${entry?.name || ''} ${entry?.category || ''}`);
      return text.includes('tuning') || text.includes('tuned') || text.includes('attunement');
    });
    return normalizeTuning({ name: plug?.name || 'Armor Tuning', icon: plug?.icon || '', stats: auditStats, mode: 'focused', source: 'Stat audit' });
  }
  return null;
}

export function tuningTitle(tuning: ArmorTuning | null, statKey = ''): string {
  if (!tuning) return '';
  const value = statKey ? Number(tuning.stats?.[statKey as StatKey] || 0) : 0;
  const statText = statKey && value ? `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[statKey as StatKey] || statKey}` : tuning.summary;
  return `${tuning.name || 'Armor Tuning'}${statText ? `: ${statText}` : ''}${tuning.summary && statText !== tuning.summary ? ` (${tuning.summary})` : ''}`;
}

function tuningStatsFromAudit(row: ArmorItem): Partial<ArmorStats> | null {
  const audit = row.StatAudit as { tuning?: Partial<ArmorStats>; bonusBreakdown?: unknown } | undefined;
  if (!audit?.tuning) return null;
  return audit.tuning;
}

function tuningFromObject(value: unknown): ArmorTuning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as { name?: string; icon?: string; stats?: Partial<ArmorStats>; mode?: string; source?: string };
  const tuning = normalizeTuning(input);
  return isSafeSmallShift(tuning.stats) ? tuning : null;
}

function normalizeTuning(input: { name?: string; icon?: string; stats?: Partial<ArmorStats>; mode?: string; source?: string }): ArmorTuning {
  const stats = Object.fromEntries(Object.entries(input.stats || {}).filter(([, value]) => Number(value || 0)).map(([key, value]) => [key, Number(value)])) as Partial<ArmorStats>;
  const summary = Object.entries(stats).map(([key, value]) => `${Number(value) > 0 ? '+' : ''}${value} ${STAT_LABELS[key as StatKey] || key}`).join(' / ');
  return { name: input.name || 'Armor Tuning', icon: normalizeIcon(input.icon || ''), stats, summary, mode: input.mode || 'focused', source: input.source || '' };
}

function isSafeSmallShift(stats: Partial<ArmorStats>): boolean {
  const values = STAT_KEYS.map((key) => Number(stats[key] || 0)).filter(Boolean);
  if (!values.length) return false;
  return Math.max(...values.map((value) => Math.abs(value))) <= 5;
}

function normalizeIcon(value: unknown): string {
  const text = String(value || '');
  if (!text) return '';
  if (text.startsWith('http')) return text;
  if (text.startsWith('/')) return `https://www.bungie.net${text}`;
  return text;
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
