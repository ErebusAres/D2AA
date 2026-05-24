import { state, subscribe, setState, clearCache } from '../src-clean/state.js';
import { saveBungieInventory } from '../src-clean/data/inventory-cache.js';

const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BONUS_TYPES = ['Masterwork', 'Mod', 'Artifice', 'Other'];
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
    return next;
  });
  if (!changed) return;
  const sig = rows.map((r) => `${r.Id}:${r.BaseTotal}:${r.CurrentTotal}:${r.MasterworkBonusTotal}:${r.ModBonusTotal}:${r.ArtificeBonusTotal}:${r.OtherBonusTotal}:${r.StatBonusTotal}:${r.IsMasterworked}:${auditSignature(r)}`).join('|');
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
  document.querySelectorAll('.armor-card[data-id], .feed-card[data-id]').forEach((node) => {
    const row = rows.get(String(node.dataset.id));
    if (!row) return;
    const isMasterworked = strictMasterworked(row);
    node.classList.toggle('is-masterworked', isMasterworked);
    if (isMasterworked) node.dataset.masterworked = 'true';
    else delete node.dataset.masterworked;
    const rails = [...node.querySelectorAll('.tier-rail')];
    rails.slice(1).forEach((rail) => rail.remove());
    if (rails[0]) rails[0].innerHTML = tierMarks(row).join('');
  });
}

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
}

function strictMasterworked(row){
  const mwTotal = number(row.MasterworkBonusTotal) || STAT_KEYS.reduce((sum, key) => sum + number(row[`MasterworkBonus${key}`]), 0);
  if (mwTotal >= 10) return true;
  const audit = row.StatAudit;
  const activeText = Array.isArray(audit?.activePlugs) ? audit.activePlugs.map((plug) => `${plug.name || ''} ${plug.category || ''}`).join(' ').toLowerCase() : '';
  return mwTotal > 0 && activeText.includes('masterwork');
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
  const rarity = String(row.Rarity || '').toLowerCase();
  const source = String(row.TierSource || '').toLowerCase();
  const explicit = number(row.GearTier || row.Tier || 0);
  if (source === 'bungie' && explicit > 0) return clamp(explicit, 1, 5);
  if (rarity === 'exotic') return clamp(explicit || fallbackTier(row), 1, 5);
  return clamp(explicit || fallbackTier(row), 1, 5);
}

function fallbackTier(row){
  const total = number(row.BaseTotal || row.Total || sumBaseStats(row) || 0);
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function clamp(value, min, max){ return Math.max(min, Math.min(max, Number(value) || min)); }
function number(value){ const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

bindSearchDebounce();
startObserver();
subscribe((_, detail = {}) => { if (!detail.statusOnly) scheduleFixes(); });
scheduleFixes();
