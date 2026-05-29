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
let queued = false;
let applying = false;

function scheduleCorrection() {
  if (queued || applying) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    correctRowsFromDefinitionStats();
  });
}

function correctRowsFromDefinitionStats() {
  if (applying || !Array.isArray(state.rows) || !state.rows.length) return;
  let changed = false;
  const rows = state.rows.map((row) => {
    const corrected = correctRow(row);
    if (corrected !== row) changed = true;
    return corrected;
  });
  if (!changed) return;
  applying = true;
  setState({ rows, status: state.status });
  applying = false;
}

function correctRow(row) {
  if (!row || row.__d2aaDefinitionBaseCorrected) return row;
  const definitionBase = definitionStats(row);
  const definitionTotal = totalOf(definitionBase);
  if (definitionTotal <= 0 || definitionTotal > 75) return row;

  const current = currentStats(row);
  const currentTotal = totalOf(current);
  if (currentTotal < definitionTotal || currentTotal - definitionTotal > 45) return row;

  const existingBaseTotal = number(row.BaseTotal || row.Total || 0);
  if (existingBaseTotal === definitionTotal) return { ...row, __d2aaDefinitionBaseCorrected: true };

  const next = { ...row, __d2aaDefinitionBaseCorrected: true };
  for (const key of STAT_KEYS) {
    const base = Math.max(0, number(definitionBase[key]));
    const cur = Math.max(0, number(current[key]));
    next[key] = base;
    next[`Base${key}`] = base;
    next[`Current${key}`] = cur;
    next[`StatBonus${key}`] = cur - base;
  }

  next.Total = definitionTotal;
  next.BaseTotal = definitionTotal;
  next.CurrentTotal = currentTotal;
  next.StatBonusTotal = currentTotal - definitionTotal;
  next.StatSource = `${row.StatSource || 'Bungie'}+DefinitionBasePatch`;

  reconcileDisplayedBonusTotals(next, row, currentTotal - definitionTotal);
  return next;
}

function reconcileDisplayedBonusTotals(next, original, desiredSignedBonusTotal) {
  for (const type of BONUS_TYPES) {
    for (const key of STAT_KEYS) next[`${type}Bonus${key}`] = number(original[`${type}Bonus${key}`]);
  }

  const existingSignedTypeTotal = BONUS_TYPES.reduce((sum, type) => sum + STAT_KEYS.reduce((inner, key) => inner + number(next[`${type}Bonus${key}`]), 0), 0);
  const remainder = desiredSignedBonusTotal - existingSignedTypeTotal;
  if (remainder) {
    const tunedKey = positiveTunedStatKey(original) || largestPositiveBonusKey(next) || largestCurrentGainKey(next);
    const targetType = positiveTunedStatKey(original) ? 'Mod' : 'Other';
    next[`${targetType}Bonus${tunedKey}`] = number(next[`${targetType}Bonus${tunedKey}`]) + remainder;
  }

  for (const type of BONUS_TYPES) {
    next[`${type}BonusTotal`] = STAT_KEYS.reduce((sum, key) => sum + number(next[`${type}Bonus${key}`]), 0);
  }
}

function positiveTunedStatKey(row) {
  for (const plug of row.StatAudit?.activePlugs || []) {
    const signed = signedStatsForPlugAudit(plug);
    const positives = STAT_KEYS.filter((key) => number(signed[key]) > 0);
    const negatives = STAT_KEYS.filter((key) => number(signed[key]) < 0);
    if (!positives.length || !negatives.length) continue;
    const maxPositive = Math.max(...positives.map((key) => number(signed[key])));
    const maxNegative = Math.max(...negatives.map((key) => Math.abs(number(signed[key]))));
    if (maxPositive <= 5 && maxNegative <= 5) return positives[0];
  }
  return '';
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

function definitionStats(row) {
  return statsFromHashMap(row.StatAudit?.definitionStats || row.DefinitionAudit?.definitionStats || {});
}

function currentStats(row) {
  const out = emptyStats();
  for (const key of STAT_KEYS) out[key] = number(row[`Current${key}`] ?? row[key]);
  if (!totalOf(out)) return statsFromHashMap(row.StatAudit?.itemStats || {});
  return out;
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

function keyFromHash(hash) {
  const raw = Number(hash);
  if (!Number.isFinite(raw)) return '';
  return STAT_HASH_TO_KEY[raw >>> 0] || STAT_HASH_TO_KEY[raw | 0] || '';
}

function largestPositiveBonusKey(row) {
  return STAT_KEYS.reduce((best, key) => number(row[`StatBonus${key}`]) > number(row[`StatBonus${best}`]) ? key : best, STAT_KEYS[0]);
}

function largestCurrentGainKey(row) {
  return STAT_KEYS.reduce((best, key) => number(row[`Current${key}`]) - number(row[`Base${key}`]) > number(row[`Current${best}`]) - number(row[`Base${best}`]) ? key : best, STAT_KEYS[0]);
}

function emptyStats() { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])); }
function totalOf(stats) { return STAT_KEYS.reduce((sum, key) => sum + number(stats?.[key]), 0); }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

subscribe((_, detail = {}) => {
  if (!detail.statusOnly) scheduleCorrection();
});
scheduleCorrection();
