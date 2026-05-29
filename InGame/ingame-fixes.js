import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS } from '../src-clean/constants.js';

const CURRENT_EXOTIC_TIER_MAX = 2;
const MAX_TIER = 5;
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
    removeLegacyTuningMarkers(node);
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

function removeLegacyTuningMarkers(node) {
  node.querySelectorAll('.stat-tuning-marker').forEach((marker) => marker.remove());
  node.querySelectorAll('.has-positive-tuning').forEach((row) => row.classList.remove('has-positive-tuning'));
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

bindSearchDebounce();
subscribe((_, detail = {}) => { if (!detail.statusOnly) scheduleFixes(); });
window.addEventListener('d2aa:compare-rendered', scheduleFixes);
window.addEventListener('d2aa:feed-popout-rendered', scheduleFixes);
scheduleFixes();