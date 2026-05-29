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

function scheduleCorrection() {
  if (queued || applying) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    correctRows();
  });
}

function correctRows() {
  if (applying || !Array.isArray(state.rows) || !state.rows.length) return;
  let changed = false;
  const rows = state.rows.map((row) => {
    let corrected = correctTuningNegativeBase(row);
    corrected = correctRowFromDefinitionStats(corrected);
    if (corrected !== row) changed = true;
    return corrected;
  });
  if (!changed) return;
  applying = true;
  setState({ rows, status: state.status });
  applying = false;
}

function correctTuningNegativeBase(row) {
  if (!row || row.__d2aaTuningNegativeBaseCorrected) return row;
  const tuningPlugs = activeTuningPlugs(row);
  if (!tuningPlugs.length) return { ...row, __d2aaTuningNegativeBaseCorrected: true };

  const next = { ...row, __d2aaTuningNegativeBaseCorrected: true };
  let changed = false;

  for (const plug of tuningPlugs) {
    const signed = signedStatsForPlugAudit(plug);
    for (const key of STAT_KEYS) {
      const value = number(signed[key]);
      if (!value) continue;
      if (value < 0) {
        const current = number(next[`Current${key}`] ?? next[key]);
        const base = number(next[`Base${key}`] ?? next[key]);
        const correctedBase = Math.max(0, Math.min(base, current));
        if (correctedBase !== base) {
          next[key] = correctedBase;
          next[`Base${key}`] = correctedBase;
          next[`StatBonus${key}`] = current - correctedBase;
          zeroNegativeDisplayedBonus(next, key);
          changed = true;
        }
      }
      if (value > 0) {
        ensurePositiveDisplayedBonus(next, key, value);
      }
    }
  }

  if (!changed) return next;
  recomputeTotals(next);
  next.StatSource = `${row.StatSource || 'Bungie'}+TuningNegativeBasePatch`;
  return next;
}

function correctRowFromDefinitionStats(row) {
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

function activeTuningPlugs(row) {
  const out = [];
  for (const plug of row.StatAudit?.activePlugs || []) {
    const signed = signedStatsForPlugAudit(plug);
    const positives = STAT_KEYS.filter((key) => number(signed[key]) > 0);
    const negatives = STAT_KEYS.filter((key) => number(signed[key]) < 0);
    if (!positives.length || !negatives.length) continue;
    const maxPositive = Math.max(...positives.map((key) => number(signed[key])));
    const maxNegative = Math.max(...negatives.map((key) => Math.abs(number(signed[key]))));
    if (maxPositive <= 5 && maxNegative <= 5) out.push(plug);
  }
  return out;
}

function zeroNegativeDisplayedBonus(row, key) {
  for (const type of BONUS_TYPES) {
    const field = `${type}Bonus${key}`;
    if (number(row[field]) < 0) row[field] = 0;
  }
}

function ensurePositiveDisplayedBonus(row, key, value) {
  const existingPositive = BONUS_TYPES.reduce((sum, type) => sum + Math.max(0, number(row[`${type}Bonus${key}`])), 0);
  if (existingPositive >= value) return;
  row[`OtherBonus${key}`] = number(row[`OtherBonus${key}`]) + (value - existingPositive);
}

function reconcileDisplayedBonusTotals(next, original, desiredSignedBonusTotal) {
  for (const type of BONUS_TYPES) {
    for (const key of STAT_KEYS) next[`${type}Bonus${key}`] = number(original[`${type}Bonus${key}`]);
  }

  const existingSignedTypeTotal = BONUS_TYPES.reduce((sum, type) => sum + STAT_KEYS.reduce((inner, key) => inner + number(next[`${type}Bonus${key}`]), 0), 0);
  const remainder = desiredSignedBonusTotal - existingSignedTypeTotal;
  if (remainder) {
    const tunedKey = positiveTunedStatKey(original) || largestPositiveBonusKey(next) || largestCurrentGainKey(next);
    const targetType = positiveTunedStatKey(original) ? 'Other' : 'Other';
    next[`${targetType}Bonus${tunedKey}`] = number(next[`${targetType}Bonus${tunedKey}`]) + remainder;
  }

  recomputeTypeTotals(next);
}

function positiveTunedStatKey(row) {
  const plugs = activeTuningPlugs(row);
  for (const plug of plugs) {
    const signed = signedStatsForPlugAudit(plug);
    const key = STAT_KEYS.find((statKey) => number(signed[statKey]) > 0);
    if (key) return key;
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

function recomputeTotals(row) {
  row.Total = STAT_KEYS.reduce((sum, key) => sum + number(row[`Base${key}`] ?? row[key]), 0);
  row.BaseTotal = row.Total;
  row.CurrentTotal = STAT_KEYS.reduce((sum, key) => sum + number(row[`Current${key}`] ?? row[key]), 0);
  row.StatBonusTotal = row.CurrentTotal - row.BaseTotal;
  for (const key of STAT_KEYS) row[`StatBonus${key}`] = number(row[`Current${key}`] ?? row[key]) - number(row[`Base${key}`] ?? row[key]);
  recomputeTypeTotals(row);
}

function recomputeTypeTotals(row) {
  for (const type of BONUS_TYPES) row[`${type}BonusTotal`] = STAT_KEYS.reduce((sum, key) => sum + number(row[`${type}Bonus${key}`]), 0);
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

installFeedLayoutGuard();
subscribe((_, detail = {}) => {
  if (!detail.statusOnly) scheduleCorrection();
});
scheduleCorrection();
