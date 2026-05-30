import { state, setState, subscribe } from '../src-clean/state.js';
import { STAT_KEYS } from '../src-clean/constants.js';

const STAT_HASH_TO_KEY = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'ClassAbility',
  1943323491: 'Weapon'
};
const BONUS_TYPES = ['Masterwork', 'Mod', 'Artifice', 'Other'];
const BONUS_TYPE_KEYS = ['masterwork', 'mod', 'artifice', 'other'];
const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
let queued = false;
let applying = false;

function installFeedLayoutGuard() {
  if (document.getElementById('d2aa-feed-layout-guard')) return;
  const style = document.createElement('style');
  style.id = 'd2aa-feed-layout-guard';
  style.textContent = `
    @media (min-width: 1100px) {
      body:has(.item-feed.is-open) main,
      body.feed-open main { padding-right: 364px !important; }
      body:has(.item-feed.is-open) .slot-heading,
      body.feed-open .slot-heading,
      body:has(.item-feed.is-open) .active-chips,
      body.feed-open .active-chips { margin-right: 364px !important; }
    }
    @media (max-width: 1099px) {
      main { padding-right: 12px !important; }
      .slot-heading, .active-chips { margin-right: 0 !important; }
      .item-feed.is-open { max-width: min(340px, 86vw) !important; }
    }
  `;
  document.head.appendChild(style);
}

function scheduleAuditCorrection() {
  if (queued || applying) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    correctRowsFromApiAudit();
  });
}

function correctRowsFromApiAudit() {
  if (applying || !Array.isArray(state.rows) || !state.rows.length) return;
  let changed = false;
  const rows = state.rows.map((row) => {
    const next = buildApiAuditedRow(row);
    if (next !== row) changed = true;
    return next;
  });
  if (!changed) return;
  applying = true;
  setState({ rows, status: state.status });
  applying = false;
}

function buildApiAuditedRow(row) {
  if (!row || row.__d2aaApiAuditBreakdown === 'v1') return row;
  const current = currentStats(row);
  const currentTotal = totalOf(current);
  if (!currentTotal) return { ...row, __d2aaApiAuditBreakdown: 'v1' };

  const audit = auditActivePlugBonuses(row);
  const positiveTotals = sumPositiveTotals(audit.breakdown);
  let base = subtractStats(current, positiveTotals);
  let baseSource = 'BungieInstanceStatsMinusPositiveActivePlugStats';

  const definitionBase = definitionStats(row);
  const definitionTotal = totalOf(definitionBase);
  if (definitionTotal > 0 && definitionTotal <= 75) {
    const derivedTotal = totalOf(base);
    const definitionBonusTotal = currentTotal - definitionTotal;
    const positiveBonusTotal = totalOf(positiveTotals);
    if (derivedTotal > 75 || Math.abs(definitionBonusTotal - positiveBonusTotal) <= 5) {
      base = definitionBase;
      baseSource = 'BungieDefinitionStats';
    }
  }

  const next = { ...row, __d2aaApiAuditBreakdown: 'v1' };
  for (const key of STAT_KEYS) {
    const baseValue = Math.max(0, number(base[key]));
    const currentValue = Math.max(0, number(current[key]));
    next[key] = baseValue;
    next[`Base${key}`] = baseValue;
    next[`Current${key}`] = currentValue;
    next[`StatBonus${key}`] = currentValue - baseValue;
  }

  for (const type of BONUS_TYPES) {
    const lower = type.toLowerCase();
    for (const key of STAT_KEYS) next[`${type}Bonus${key}`] = number(audit.breakdown[lower]?.[key]);
    next[`${type}BonusTotal`] = STAT_KEYS.reduce((sum, key) => sum + number(next[`${type}Bonus${key}`]), 0);
  }

  next.Total = totalOf(base);
  next.BaseTotal = next.Total;
  next.CurrentTotal = currentTotal;
  next.StatBonusTotal = next.CurrentTotal - next.BaseTotal;
  next.StatSource = baseSource;
  next.StatAudit = {
    ...(row.StatAudit || {}),
    apiAuditBreakdown: audit.breakdown,
    apiAuditIgnoredPlugs: audit.ignoredPlugs,
    apiAuditBaseSource: baseSource
  };
  return next;
}

function auditActivePlugBonuses(row) {
  const breakdown = emptyBreakdown();
  const ignoredPlugs = [];
  for (const plug of row.StatAudit?.activePlugs || []) {
    const signed = signedStatsForPlugAudit(plug);
    if (!absoluteTotalOf(signed)) continue;
    const text = normalizedPlugText(plug);
    if (isArchetypePlug(plug, text)) {
      ignoredPlugs.push(ignoredPlug(plug, 'archetype'));
      continue;
    }
    const type = bonusTypeForAuditPlug(plug, text, signed);
    if (!type) {
      ignoredPlugs.push(ignoredPlug(plug, 'not-stat-bonus-socket'));
      continue;
    }
    const positive = positiveStatsOnly(type === 'masterwork' ? masterworkStatsForAuditPlug(plug, signed) : signed);
    for (const key of STAT_KEYS) breakdown[type][key] += number(positive[key]);
  }
  if (totalOf(breakdown.masterwork) > 10) capMasterworkBreakdown(breakdown.masterwork);
  return { breakdown, ignoredPlugs };
}

function bonusTypeForAuditPlug(plug, text, signed) {
  const hasPositive = STAT_KEYS.some((key) => number(signed[key]) > 0);
  const hasNegative = STAT_KEYS.some((key) => number(signed[key]) < 0);
  const maxAbs = Math.max(0, ...STAT_KEYS.map((key) => Math.abs(number(signed[key]))));
  if (text.includes('masterwork')) return 'masterwork';
  if (text.includes('artifice')) return 'artifice';
  if (text.includes('armor mod') || text.includes('armor mods') || text.includes('mod socket') || text.includes('stat mod')) return 'mod';
  if ((text.includes('tuning') || text.includes('tuned') || text.includes('attunement')) && hasPositive) return 'other';
  if (hasPositive && hasNegative && maxAbs <= 5) return 'other';
  return '';
}

function masterworkStatsForAuditPlug(plug, signed) {
  const positive = positiveStatsOnly(signed);
  const total = totalOf(positive);
  if (total <= 10) return positive;
  const target = columnFromPlugText(plug) || largestStatKey(positive);
  const out = emptyStats();
  if (target) out[target] = 10;
  return out;
}

function capMasterworkBreakdown(stats) {
  const target = largestStatKey(stats);
  for (const key of STAT_KEYS) stats[key] = 0;
  if (target) stats[target] = 10;
}

function signedStatsForPlugAudit(plug) {
  const out = emptyStats();
  for (const stat of plug?.stats || []) {
    const key = keyFromHash(stat.statTypeHash);
    const value = number(stat.value ?? stat.statValue);
    if (key && value) out[key] += value;
  }
  return out;
}

function currentStats(row) {
  const fromAudit = statsFromHashMap(row.StatAudit?.itemStats || {});
  if (totalOf(fromAudit)) return fromAudit;
  const out = emptyStats();
  for (const key of STAT_KEYS) out[key] = number(row[`Current${key}`] ?? row[key]);
  return out;
}

function definitionStats(row) {
  return statsFromHashMap(row.StatAudit?.definitionStats || row.DefinitionAudit?.definitionStats || {});
}

function statsFromHashMap(source) {
  const out = emptyStats();
  for (const [hash, value] of Object.entries(source || {})) {
    const key = keyFromHash(hash);
    if (!key) continue;
    out[key] = number(value?.value ?? value?.statValue ?? value?.base ?? value);
  }
  return out;
}

function sumPositiveTotals(breakdown) {
  const out = emptyStats();
  for (const type of BONUS_TYPE_KEYS) for (const key of STAT_KEYS) out[key] += Math.max(0, number(breakdown[type]?.[key]));
  return out;
}

function subtractStats(current, bonus) {
  const out = emptyStats();
  for (const key of STAT_KEYS) out[key] = Math.max(0, number(current[key]) - Math.max(0, number(bonus[key])));
  return out;
}

function positiveStatsOnly(stats) {
  const out = emptyStats();
  for (const key of STAT_KEYS) out[key] = Math.max(0, number(stats?.[key]));
  return out;
}

function columnFromPlugText(plug) {
  const text = normalizedPlugText(plug);
  if (text.includes('health') || text.includes('resilience')) return 'Health';
  if (text.includes('melee') || text.includes('strength')) return 'Melee';
  if (text.includes('grenade') || text.includes('discipline')) return 'Grenade';
  if (text.includes('super') || text.includes('intellect')) return 'Super';
  if (text.includes('class') || text.includes('mobility')) return 'ClassAbility';
  if (text.includes('weapon') || text.includes('recovery')) return 'Weapon';
  return '';
}

function normalizedPlugText(plug) {
  return normalize(`${plug?.name || ''} ${plug?.description || ''} ${plug?.type || ''} ${plug?.category || ''}`);
}

function isArchetypePlug(plug, text) {
  const name = normalize(plug?.name || '');
  return ARCHETYPE_NAMES.has(name) || text.includes('archetype');
}

function ignoredPlug(plug, reason) {
  return { hash: plug?.hash || '', name: plug?.name || '', reason };
}

function keyFromHash(hash) {
  const raw = Number(hash);
  if (!Number.isFinite(raw)) return '';
  return STAT_HASH_TO_KEY[raw >>> 0] || STAT_HASH_TO_KEY[raw | 0] || '';
}

function largestStatKey(stats) {
  return STAT_KEYS.reduce((best, key) => number(stats[key]) > number(stats[best]) ? key : best, STAT_KEYS[0]);
}

function emptyStats() { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])); }
function emptyBreakdown() { return Object.fromEntries(BONUS_TYPE_KEYS.map((type) => [type, emptyStats()])); }
function totalOf(stats) { return STAT_KEYS.reduce((sum, key) => sum + number(stats?.[key]), 0); }
function absoluteTotalOf(stats) { return STAT_KEYS.reduce((sum, key) => sum + Math.abs(number(stats?.[key])), 0); }
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

installFeedLayoutGuard();
subscribe((_, detail = {}) => {
  if (!detail.statusOnly) scheduleAuditCorrection();
});
scheduleAuditCorrection();
