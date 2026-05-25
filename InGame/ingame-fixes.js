import { state, subscribe, setState, clearCache } from '../src-clean/state.js';
import { saveBungieInventory } from '../src-clean/data/inventory-cache.js';

const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BONUS_TYPES = ['Masterwork', 'Mod', 'Artifice', 'Other'];
const CURRENT_EXOTIC_TIER_MAX = 2;
const FUTURE_EXOTIC_TIER_MAX = 5;
const STAT_HASH_TO_KEY = {
  392767087: 'Health', '-390219801': 'Health',
  4244567218: 'Melee', '-503001078': 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'ClassAbility', '-1298820321': 'ClassAbility',
  1943323491: 'Weapon'
};
let normalizing = false;
let lastSignature = '';
let fixQueued = false;
let observerStarted = false;
let searchDebounceTimer = 0;
let lastSearchValue = '';
let compacting = false;
let compactCacheTimer = 0;

function normalizeRowsIfNeeded(){
  if (normalizing || !state.rows?.length) return;

  if (state.rows.some((row) => row.StatSource === 'D2AARepair_BaseWasMisclassifiedAsOtherBonus')) {
    normalizing = true;
    clearCache();
    setState({ status: 'Cleared corrupted stat cache from the bad repair pass. Click Sync to rebuild from Bungie.' });
    normalizing = false;
    return;
  }

  let changed = false;
  const rows = state.rows.map((row) => {
    const next = { ...row };
    if (compactBulkyRowData(next)) changed = true;
    const strictMw = strictMasterworked(next);
    if (next.IsMasterworked !== strictMw) { next.IsMasterworked = strictMw; changed = true; }
    if (normalizeStatsForDisplay(next)) changed = true;
    if (normalizeTierForDisplay(next)) changed = true;
    return next;
  });
  if (!changed) return;
  const sig = rows.map((r) => `${r.Id}:${r.BaseTotal}:${r.CurrentTotal}:${r.MasterworkBonusTotal}:${r.ModBonusTotal}:${r.ArtificeBonusTotal}:${r.OtherBonusTotal}:${r.StatBonusTotal}:${r.IsMasterworked}:${r.Tier}:${r.GearTier}:${r.DisplayTier}:${r.DisplayTierMax}:${auditSignature(r)}`).join('|');
  if (sig === lastSignature) return;
  lastSignature = sig;
  normalizing = true;
  setState({ rows, status: state.status });
  scheduleCompactCacheSave(rows);
  normalizing = false;
}

function normalizeStatsForDisplay(row){
  let changed = false;
  const models = STAT_KEYS.map((key) => buildDisplayStatModel(row, key));
  const explicitBonus = number(row.StatBonusTotal);
  const knownBonus = sumModelsBonus(models);
  let desiredBonus = explicitBonus || knownBonus;
  if (knownBonus !== desiredBonus) allocateRemainder(models, desiredBonus - knownBonus, 'Other');
  let baseTotal = sumModelsBase(models);
  if (baseTotal > 75) allocateRemainder(models, baseTotal - 75, 'Other');

  const nextBaseTotal = sumModelsBase(models);
  const nextCurrentTotal = sumModelsCurrent(models);
  const nextBonusTotal = nextCurrentTotal - nextBaseTotal;

  for (const model of models) {
    const key = model.key;
    for (const type of BONUS_TYPES) {
      const field = `${type}Bonus${key}`;
      const old = number(row[field]);
      const next = model.bonuses[type] || 0;
      if (old !== next) { row[field] = next; changed = true; }
    }
    if (number(row[`Base${key}`]) !== model.base) { row[`Base${key}`] = model.base; changed = true; }
    if (number(row[`Current${key}`]) !== model.current) { row[`Current${key}`] = model.current; changed = true; }
    if (number(row[`StatBonus${key}`]) !== model.current - model.base) { row[`StatBonus${key}`] = model.current - model.base; changed = true; }
  }

  for (const type of BONUS_TYPES) {
    const field = `${type}BonusTotal`;
    const total = models.reduce((sum, model) => sum + (model.bonuses[type] || 0), 0);
    if (number(row[field]) !== total) { row[field] = total; changed = true; }
  }
  if (number(row.BaseTotal) !== nextBaseTotal) { row.BaseTotal = nextBaseTotal; changed = true; }
  if (number(row.CurrentTotal) !== nextCurrentTotal) { row.CurrentTotal = nextCurrentTotal; changed = true; }
  if (number(row.StatBonusTotal) !== nextBonusTotal) { row.StatBonusTotal = nextBonusTotal; changed = true; }
  if (nextBaseTotal > 75) console.warn('D2AA stat normalization still over 75', row.Name, nextBaseTotal, row);
  return changed;
}

function buildDisplayStatModel(row, key){
  const current = number(row[`Current${key}`] ?? row[key]);
  const bonuses = {};
  for (const type of BONUS_TYPES) bonuses[type] = signedBonus(row, type, key);
  let bonusTotal = Object.values(bonuses).reduce((sum, value) => sum + value, 0);
  const explicitBase = number(row[`Base${key}`]);
  const useExplicitBase = hasValidExplicitBase(row);
  let base = useExplicitBase ? explicitBase : Math.max(0, current - bonusTotal);
  const statBonus = number(row[`StatBonus${key}`]);
  if (statBonus && statBonus !== bonusTotal) {
    bonuses.Other += statBonus - bonusTotal;
    bonusTotal = statBonus;
    base = Math.max(0, current - bonusTotal);
  }
  return { key, current, base, bonuses };
}

function allocateRemainder(models, amount, type){
  let remaining = Math.abs(number(amount));
  const sign = number(amount) < 0 ? -1 : 1;
  if (!remaining) return;
  const ordered = [...models].sort((a, b) => (b.current - b.base) - (a.current - a.base) || b.base - a.base);
  for (const model of ordered) {
    if (remaining <= 0) break;
    const room = sign > 0 ? Math.max(0, model.base) : Math.max(0, model.current);
    if (!room) continue;
    const delta = Math.min(room, remaining);
    model.bonuses[type] += sign * delta;
    if (sign > 0) model.base -= delta;
    else model.base += delta;
    remaining -= delta;
  }
}

function signedBonus(row, type, key){
  const direct = row[`${type}Bonus${key}`];
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return number(direct);
  return number(row.StatAudit?.bonusBreakdown?.[type.toLowerCase()]?.[key] ?? row.SocketAudit?.bonusBreakdown?.[type.toLowerCase()]?.[key]);
}

function sumModelsBase(models){ return models.reduce((sum, model) => sum + model.base, 0); }
function sumModelsCurrent(models){ return models.reduce((sum, model) => sum + model.current, 0); }
function sumModelsBonus(models){ return models.reduce((sum, model) => sum + Object.values(model.bonuses).reduce((s, v) => s + v, 0), 0); }
function hasValidExplicitBase(row){ const total = STAT_KEYS.reduce((sum, key) => sum + number(row[`Base${key}`]), 0); return total > 0 && total <= 75; }
function sumBaseStats(row){ return STAT_KEYS.reduce((sum, key) => sum + number(row[`Base${key}`] ?? row[key]), 0); }

function compactBulkyRowData(row){
  if (compacting) return false;
  let changed = false;

  if (row.StatAudit && typeof row.StatAudit === 'object') {
    const before = roughSize(row.StatAudit);
    const compactAudit = {
      activePlugs: compactAuditPlugs(row.StatAudit.activePlugs),
      bonusBreakdown: row.StatAudit.bonusBreakdown || {}
    };
    const after = roughSize(compactAudit);
    if (before > after + 64 || row.StatAudit.allPlugs || row.StatAudit.itemStats || row.StatAudit.definitionStats) {
      row.StatAudit = compactAudit;
      changed = true;
    }
  }

  for (const key of ['ArmorSetBonuses','SetBonuses','ArmorBonuses','ArmorPerks']) {
    if (!Array.isArray(row[key])) continue;
    const compact = row[key].map(compactPerk).filter(Boolean);
    if (roughSize(row[key]) > roughSize(compact) + 16) {
      row[key] = compact;
      changed = true;
    }
  }

  if (typeof row.ScreenshotUrl === 'string' && row.ScreenshotUrl.length > 180) {
    row.ScreenshotUrl = '';
    changed = true;
  }

  return changed;
}

function compactAuditPlugs(plugs){
  return (plugs || []).map(compactPlug).filter((plug) => {
    const text = `${plug.name || ''} ${plug.description || ''} ${plug.type || ''} ${plug.category || ''}`;
    return plug.stats?.length || /set|bonus|mod|masterwork|artifice|piece|wearing|trait|intrinsic|archetype/i.test(text);
  }).slice(0, 24);
}

function compactPlug(plug){
  if (!plug) return null;
  return {
    hash: plug.hash || '',
    name: plug.name || plug.displayProperties?.name || '',
    description: plug.description || plug.displayProperties?.description || '',
    icon: plug.icon || '',
    type: plug.type || plug.itemTypeDisplayName || '',
    category: plug.category || plug.plug?.plugCategoryIdentifier || '',
    stats: compactStats(plug.stats || plug.investmentStats)
  };
}

function compactPerk(perk){
  if (!perk) return null;
  return {
    name: perk.name || '',
    description: perk.description || '',
    icon: perk.icon || '',
    hash: perk.hash || '',
    kind: perk.kind || '',
    label: perk.label || ''
  };
}

function compactStats(stats){
  return (stats || []).filter((stat) => number(stat.value || stat.statValue) !== 0).map((stat) => ({
    statTypeHash: stat.statTypeHash,
    value: number(stat.value || stat.statValue)
  })).slice(0, 8);
}

function scheduleCompactCacheSave(rows){
  window.clearTimeout(compactCacheTimer);
  compactCacheTimer = window.setTimeout(() => {
    saveBungieInventory(rows, 'compact-ingame-cache').catch((error) => console.warn('D2AA compact cache save failed', error));
  }, 900);
}

function auditSignature(row){
  const audit = row.StatAudit;
  if (!audit) return 'none';
  return `${audit.activePlugs?.length || 0}:${audit.allPlugs?.length || 0}:${audit.itemStats ? 1 : 0}:${audit.definitionStats ? 1 : 0}`;
}

function roughSize(value){
  try { return JSON.stringify(value || '').length; } catch { return 0; }
}

function scheduleFixes(){
  if (fixQueued) return;
  fixQueued = true;
  requestAnimationFrame(() => {
    fixQueued = false;
    applyInGameFixes();
  });
}

function applyInGameFixes(){
  normalizeRowsIfNeeded();
  const rows = new Map((state.rows || []).map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id], .feed-card[data-id], .compare-card[data-id]').forEach((node) => {
    const row = rows.get(String(node.dataset.id));
    if (!row) return;
    const isMasterworked = strictMasterworked(row);
    node.classList.toggle('is-masterworked', isMasterworked);
    if (isMasterworked) node.dataset.masterworked = 'true';
    else delete node.dataset.masterworked;
    node.dataset.tier = String(resolvedTier(row));
    node.dataset.tierMax = String(tierMaxForRow(row));
    const rails = [...node.querySelectorAll('.tier-rail')];
    rails.slice(1).forEach((rail) => rail.remove());
    if (rails[0]) rails[0].innerHTML = tierMarks(row).join('');
    applyPositiveStatMarkers(node, row);
  });
}

function applyPositiveStatMarkers(node, row){
  const rows = [...node.querySelectorAll('.stat-bars > .stat-row')];
  const tuning = positiveTuningByKey(row);
  rows.forEach((statRow, index) => {
    const key = STAT_KEYS[index];
    if (!key) return;
    const existing = statRow.querySelector('.stat-tuning-marker');
    const detail = tuning[key];
    if (!detail) { existing?.remove(); statRow.classList.remove('has-positive-tuning'); return; }
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

function positiveTuningByKey(row){
  const out = {};
  for (const plug of activeAuditPlugs(row)) {
    const signed = signedStatsForAuditPlug(plug);
    const positives = Object.entries(signed).filter(([, value]) => value > 0);
    const negatives = Object.entries(signed).filter(([, value]) => value < 0);
    if (!positives.length || !negatives.length) continue;
    const source = plug.name || 'Stat tuning plug';
    const penalty = negatives.map(([key, value]) => `${formatSigned(value)} ${labelForKey(key)}`).join(', ');
    for (const [key, value] of positives) {
      if (!out[key]) out[key] = { value: 0, sources: [], penalties: [] };
      out[key].value += value;
      out[key].sources.push(source);
      out[key].penalties.push(penalty);
    }
  }
  return out;
}

function activeAuditPlugs(row){
  const plugs = [...(row.StatAudit?.activePlugs || []), ...(row.SocketAudit?.activePlugs || [])];
  const seen = new Set();
  return plugs.filter((plug) => {
    const key = `${plug.hash || ''}|${plug.name || ''}|${roughSize(plug.stats)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Array.isArray(plug.stats) && plug.stats.length;
  });
}

function signedStatsForAuditPlug(plug){
  const out = {};
  for (const stat of plug.stats || []) {
    const key = keyFromStatHash(stat.statTypeHash);
    const value = number(stat.value ?? stat.statValue);
    if (!key || !value) continue;
    out[key] = (out[key] || 0) + value;
  }
  return out;
}

function keyFromStatHash(hash){
  const raw = Number(hash);
  if (!Number.isFinite(raw)) return null;
  const unsigned = raw >>> 0;
  const signed = raw | 0;
  return STAT_HASH_TO_KEY[unsigned] || STAT_HASH_TO_KEY[signed] || null;
}

function tuningMarkerHtml(key, detail){
  const sources = unique(detail.sources).join(', ');
  const penalties = unique(detail.penalties).filter(Boolean).join('; ');
  const title = `${labelForKey(key)} tuned ${formatSigned(detail.value)}`;
  return `<span class="stat-tuning-marker" tabindex="0" aria-label="${escapeAttr(title)}" title="${escapeAttr(title)}">${tuningIconSvg()}<span class="d2-tooltip"><b>${escapeHtml(title)}</b><em>Stat Tuning</em><p>This is the positive side of an active armor stat adjustment.${sources ? ` Source: ${escapeHtml(sources)}.` : ''}${penalties ? ` Penalty: ${escapeHtml(penalties)}.` : ''}</p></span></span>`;
}

function tuningIconSvg(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h8"/><path d="M8 7l-5 5 5 5"/><path d="M21 12h-8"/><path d="M16 7l5 5-5 5"/><path d="M12 4v4"/><path d="M12 16v4"/></svg>';
}

function labelForKey(key){
  return key === 'ClassAbility' ? 'Weapons' : key === 'Weapon' ? 'Class' : key;
}

function unique(values){ return [...new Set(values.filter(Boolean))]; }
function formatSigned(value){ const v = number(value); return v > 0 ? `+${v}` : String(v); }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function escapeAttr(value){ return escapeHtml(value); }

function bindSearchDebounce(){
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
      if (state.search !== lastSearchValue) setState({ search: lastSearchValue });
    }, 180);
  }, { passive: true });

  clone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.clearTimeout(searchDebounceTimer);
    if (state.search !== clone.value) setState({ search: clone.value });
  });
}

function startObserver(){
  if (observerStarted) return;
  observerStarted = true;
  const root = document.getElementById('gridView') || document.body;
  new MutationObserver(scheduleFixes).observe(root, { childList: true, subtree: true });
  window.addEventListener('d2aa:compare-rendered', scheduleFixes);
}

function strictMasterworked(row){
  const mwTotal = number(row.MasterworkBonusTotal) || STAT_KEYS.reduce((sum, key) => sum + number(row[`MasterworkBonus${key}`]), 0);
  if (mwTotal >= 10) return true;
  const audit = row.StatAudit;
  const activeText = Array.isArray(audit?.activePlugs) ? audit.activePlugs.map((plug) => `${plug.name || ''} ${plug.category || ''}`).join(' ').toLowerCase() : '';
  return mwTotal > 0 && activeText.includes('masterwork');
}

function normalizeTierForDisplay(row){
  const rawTier = number(row.RawGearTier || row.GearTier || row.Tier || row.DisplayTier || 0);
  const tier = resolvedTier(row);
  const max = tierMaxForRow(row);
  let changed = false;
  if (number(row.DisplayTier) !== tier) { row.DisplayTier = tier; changed = true; }
  if (number(row.DisplayTierMax) !== max) { row.DisplayTierMax = max; changed = true; }

  if (isExoticRow(row)) {
    if (rawTier && number(row.RawGearTier) !== rawTier) { row.RawGearTier = rawTier; changed = true; }
    if (number(row.Tier) !== tier) { row.Tier = tier; changed = true; }
    if (number(row.GearTier) !== tier) { row.GearTier = tier; changed = true; }
    if (rawTier > CURRENT_EXOTIC_TIER_MAX) {
      const note = `Exotic tier display is capped at ${CURRENT_EXOTIC_TIER_MAX} until the ${FUTURE_EXOTIC_TIER_MAX}-tier exotic update.`;
      if (row.TierNote !== note) { row.TierNote = note; changed = true; }
    }
  }
  return changed;
}

function tierMarks(row){
  const max = 5;
  const tier = resolvedTier(row);
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  return Array.from({ length: max }, (_, i) => {
    const level = max - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  });
}

function resolvedTier(row){
  const display = number(row.DisplayTier || 0);
  const raw = number(row.RawGearTier || row.GearTier || row.Tier || 0);
  if (isExoticRow(row)) return clamp(display || raw || fallbackExoticTier(row), 1, CURRENT_EXOTIC_TIER_MAX);
  const source = String(row.TierSource || '').toLowerCase();
  if (source === 'bungie' && raw > 0) return clamp(raw, 1, 5);
  return clamp(display || raw || fallbackTier(row), 1, 5);
}

function tierMaxForRow(row){
  return isExoticRow(row) ? CURRENT_EXOTIC_TIER_MAX : 5;
}

function fallbackExoticTier(row){
  const explicit = number(row.RawGearTier || row.GearTier || row.Tier || 0);
  if (explicit > 0) return explicit;
  const total = number(row.BaseTotal || row.Total || sumBaseStats(row) || 0);
  return total >= 70 ? 2 : 1;
}

function fallbackTier(row){
  const total = number(row.BaseTotal || row.Total || sumBaseStats(row) || 0);
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function isExoticRow(row){ return String(row.Rarity || '').toLowerCase() === 'exotic'; }
function clamp(value, min, max){ return Math.max(min, Math.min(max, Number(value) || min)); }
function number(value){ const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

bindSearchDebounce();
startObserver();
subscribe((_, detail = {}) => { if (!detail.statusOnly) scheduleFixes(); });
scheduleFixes();