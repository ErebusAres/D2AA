import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS, STAT_LABELS } from '../src-clean/constants.js';

const CURRENT_EXOTIC_TIER_MAX = 2;
const MAX_TIER = 5;
const STAT_HASH_TO_KEY = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  1943323491: 'Weapon',
  2996146975: 'ClassAbility'
};
const BONUS_TYPES = ['Masterwork', 'Mod', 'Artifice', 'Other'];
let queued = false;
let searchDebounceTimer = 0;
let lastSearchValue = '';

function scheduleFixes() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    applyLightweightFixes();
  });
}

function rowsById() {
  return new Map((state.rows || []).map((row) => [String(row.Id), row]));
}

function applyLightweightFixes() {
  const rows = rowsById();
  document.querySelectorAll('.armor-card[data-id], .feed-card[data-id], .compare-card[data-id]').forEach((node) => {
    const row = rows.get(String(node.dataset.id));
    if (!row) return;
    applyStrictMasterwork(node, row);
    applyTierRail(node, row);
    applyPositiveStatMarkers(node, row);
  });
}

function applyStrictMasterwork(node, row) {
  const on = strictMasterworked(row);
  node.classList.toggle('is-masterworked', on);
  if (on) node.dataset.masterworked = 'true';
  else delete node.dataset.masterworked;
}

function strictMasterworked(row) {
  const mwTotal = number(row.MasterworkBonusTotal) || STAT_KEYS.reduce((sum, key) => sum + number(row[`MasterworkBonus${key}`]), 0);
  if (mwTotal >= 10) return true;
  const activeText = activeAuditPlugs(row).map((plug) => `${plug.name || ''} ${plug.category || ''} ${plug.type || ''}`).join(' ').toLowerCase();
  return mwTotal > 0 && activeText.includes('masterwork');
}

function applyTierRail(node, row) {
  const tier = resolvedTier(row);
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  const html = Array.from({ length: MAX_TIER }, (_, i) => {
    const level = MAX_TIER - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  }).join('');
  node.dataset.tier = String(tier);
  node.dataset.tierMax = String(isExoticRow(row) ? CURRENT_EXOTIC_TIER_MAX : MAX_TIER);
  const rails = [...node.querySelectorAll('.tier-rail')];
  rails.slice(1).forEach((rail) => rail.remove());
  if (rails[0] && rails[0].innerHTML !== html) rails[0].innerHTML = html;
}

function resolvedTier(row) {
  const raw = number(row.DisplayTier || row.RawGearTier || row.GearTier || row.Tier || 0);
  if (isExoticRow(row)) return clamp(raw || fallbackExoticTier(row), 1, CURRENT_EXOTIC_TIER_MAX);
  return clamp(raw || fallbackLegendaryTier(row), 1, MAX_TIER);
}

function fallbackExoticTier(row) {
  const total = baseTotal(row);
  return total >= 70 ? 2 : 1;
}

function fallbackLegendaryTier(row) {
  const total = baseTotal(row);
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}

function applyPositiveStatMarkers(node, row) {
  const statRows = [...node.querySelectorAll('.stat-bars > .stat-row, .feed-popout-stats > .feed-popout-stat')];
  if (!statRows.length) return;
  const tuning = positiveTuningByKey(row);
  statRows.forEach((statRow, index) => {
    const key = STAT_KEYS[index];
    if (!key) return;
    const detail = tuning[key];
    const existing = statRow.querySelector('.stat-tuning-marker');
    if (!detail) {
      existing?.remove();
      statRow.classList.remove('has-positive-tuning');
      return;
    }
    const html = tuningMarkerHtml(key, detail);
    statRow.classList.add('has-positive-tuning');
    if (existing) {
      if (existing.outerHTML !== html) existing.outerHTML = html;
      return;
    }
    const icon = statRow.querySelector('img, span');
    if (icon) icon.insertAdjacentHTML('afterend', html);
  });
}

function positiveTuningByKey(row) {
  const out = {};
  for (const plug of activeAuditPlugs(row)) {
    const signed = signedStatsForAuditPlug(plug);
    const positives = Object.entries(signed).filter(([, value]) => value > 0);
    const negatives = Object.entries(signed).filter(([, value]) => value < 0);
    if (!positives.length || !negatives.length) continue;
    const source = plug.name || 'Stat tuning plug';
    const penalty = negatives.map(([key, value]) => `${formatSigned(value)} ${labelForKey(key)}`).join(', ');
    for (const [key, value] of positives) {
      addTuning(out, key, value, source, penalty);
    }
  }

  const derived = derivedPositiveTuning(row);
  for (const [key, detail] of Object.entries(derived)) {
    if (!out[key]) out[key] = detail;
  }
  return out;
}

function derivedPositiveTuning(row) {
  const out = {};
  const all = STAT_KEYS.map((key) => [key, signedBonusParts(row, key)]);
  const hasNegativeShift = all.some(([, parts]) => parts.some((part) => part.value < 0 && ['Other', 'Artifice'].includes(part.type)));
  if (!hasNegativeShift) return out;
  for (const [key, parts] of all) {
    const positiveShift = parts.filter((part) => part.value > 0 && ['Other', 'Artifice'].includes(part.type));
    for (const part of positiveShift) addTuning(out, key, part.value, `${part.type} stat tuning`, 'another stat is reduced');
  }
  return out;
}

function signedBonusParts(row, key) {
  return BONUS_TYPES.map((type) => ({ type, value: number(row[`${type}Bonus${key}`]) })).filter((part) => part.value !== 0);
}

function addTuning(out, key, value, source, penalty) {
  if (!out[key]) out[key] = { value: 0, sources: [], penalties: [] };
  out[key].value += value;
  if (source) out[key].sources.push(source);
  if (penalty) out[key].penalties.push(penalty);
}

function activeAuditPlugs(row) {
  const plugs = [...(row.StatAudit?.activePlugs || []), ...(row.SocketAudit?.activePlugs || [])];
  const seen = new Set();
  return plugs.filter((plug) => {
    const key = `${plug.hash || ''}|${plug.name || ''}|${JSON.stringify(plug.stats || [])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Array.isArray(plug.stats) && plug.stats.length;
  });
}

function signedStatsForAuditPlug(plug) {
  const out = {};
  for (const stat of plug.stats || []) {
    const key = keyFromStatHash(stat.statTypeHash);
    const value = number(stat.value ?? stat.statValue);
    if (!key || !value) continue;
    out[key] = (out[key] || 0) + value;
  }
  return out;
}

function keyFromStatHash(hash) {
  const raw = Number(hash);
  if (!Number.isFinite(raw)) return null;
  return STAT_HASH_TO_KEY[raw >>> 0] || STAT_HASH_TO_KEY[raw | 0] || null;
}

function tuningMarkerHtml(key, detail) {
  const sources = unique(detail.sources).join(', ');
  const penalties = unique(detail.penalties).filter(Boolean).join('; ');
  const title = `${labelForKey(key)} tuned ${formatSigned(detail.value)}`;
  return `<span class="stat-tuning-marker" tabindex="0" aria-label="${escapeAttr(title)}" title="${escapeAttr(title)}">${tuningIconSvg()}<span class="d2-tooltip"><b>${escapeHtml(title)}</b><em>Stat Tuning</em><p>This marks the positive side of an active armor stat adjustment.${sources ? ` Source: ${escapeHtml(sources)}.` : ''}${penalties ? ` Penalty: ${escapeHtml(penalties)}.` : ''}</p></span></span>`;
}

function tuningIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h8"/><path d="M8 7l-5 5 5 5"/><path d="M21 12h-8"/><path d="M16 7l5 5-5 5"/><path d="M12 4v4"/><path d="M12 16v4"/></svg>';
}

function bindSearchDebounce() {
  const input = document.getElementById('searchBox');
  if (!input || input.dataset.d2aaDebounced === '1') return;
  const clone = input.cloneNode(true);
  clone.value = state.search || input.value || '';
  clone.dataset.d2aaDebounced = '1';
  input.replaceWith(clone);
  clone.addEventListener('input', () => {
    lastSearchValue = clone.value;
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      if (state.search !== lastSearchValue) import('../src-clean/state.js').then(({ setState }) => setState({ search: lastSearchValue }));
    }, 180);
  }, { passive: true });
  clone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.clearTimeout(searchDebounceTimer);
    if (state.search !== clone.value) import('../src-clean/state.js').then(({ setState }) => setState({ search: clone.value }));
  });
}

function baseTotal(row) {
  const explicit = STAT_KEYS.reduce((sum, key) => sum + number(row[`Base${key}`]), 0);
  if (explicit > 0 && explicit <= 75) return explicit;
  return Math.min(75, explicit || number(row.BaseTotal || row.Total || 0));
}
function isExoticRow(row) { return String(row.Rarity || '').toLowerCase() === 'exotic'; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)); }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function labelForKey(key) { return STAT_LABELS[key] || key; }
function formatSigned(value) { const v = number(value); return v > 0 ? `+${v}` : String(v); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function escapeAttr(value) { return escapeHtml(value); }

bindSearchDebounce();
subscribe((_, detail = {}) => { if (!detail.statusOnly) scheduleFixes(); });
window.addEventListener('d2aa:compare-rendered', scheduleFixes);
window.addEventListener('d2aa:feed-popout-rendered', scheduleFixes);
scheduleFixes();