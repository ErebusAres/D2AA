import { state, subscribe, setState } from '../src-clean/state.js';

const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
let normalizing = false;
let lastSignature = '';

function normalizeRowsIfNeeded(){
  if (normalizing || !state.rows?.length) return;
  let changed = false;
  const rows = state.rows.map((row) => {
    const next = { ...row };
    if (repairBaseCountedAsOther(next)) changed = true;
    const strictMw = strictMasterworked(next);
    if (next.IsMasterworked !== strictMw) { next.IsMasterworked = strictMw; changed = true; }
    return next;
  });
  if (!changed) return;
  const sig = rows.map((r) => `${r.Id}:${r.BaseTotal}:${r.CurrentTotal}:${r.OtherBonusTotal}:${r.IsMasterworked}`).join('|');
  if (sig === lastSignature) return;
  lastSignature = sig;
  normalizing = true;
  setState({ rows, status: state.status });
  normalizing = false;
}

function repairBaseCountedAsOther(row){
  const baseTotal = number(row.BaseTotal ?? row.Total);
  const otherTotal = number(row.OtherBonusTotal);
  const currentTotal = number(row.CurrentTotal);
  const nonOtherBonusTotal = number(row.MasterworkBonusTotal) + number(row.ModBonusTotal) + number(row.ArtificeBonusTotal);
  const looksLikeBaseWasClassifiedAsBonus = baseTotal === 0 && otherTotal > 0 && currentTotal >= otherTotal;
  if (!looksLikeBaseWasClassifiedAsBonus) return false;

  let repairedBaseTotal = 0;
  for (const key of STAT_KEYS) {
    const other = number(row[`OtherBonus${key}`]);
    const current = number(row[`Current${key}`]);
    const base = other || Math.max(0, current - number(row[`MasterworkBonus${key}`]) - number(row[`ModBonus${key}`]) - number(row[`ArtificeBonus${key}`]));
    row[`Base${key}`] = base;
    row[key] = base;
    row[`OtherBonus${key}`] = 0;
    row[`StatBonus${key}`] = number(row[`MasterworkBonus${key}`]) + number(row[`ModBonus${key}`]) + number(row[`ArtificeBonus${key}`]);
    repairedBaseTotal += base;
  }
  row.BaseTotal = repairedBaseTotal || otherTotal;
  row.Total = row.BaseTotal;
  row.OtherBonusTotal = 0;
  row.StatBonusTotal = nonOtherBonusTotal;
  row.CurrentTotal = row.BaseTotal + row.StatBonusTotal;
  row.StatSource = 'D2AARepair_BaseWasMisclassifiedAsOtherBonus';
  return true;
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
    const rail = node.querySelector('.tier-rail');
    if (rail) rail.innerHTML = tierMarks(row).join('');
  });
}

function strictMasterworked(row){
  const mwTotal = number(row.MasterworkBonusTotal) || STAT_KEYS.reduce((sum, key) => sum + number(row[`MasterworkBonus${key}`]), 0);
  if (mwTotal >= 10) return true;
  const audit = JSON.stringify(row.StatAudit || '').toLowerCase();
  return mwTotal > 0 && audit.includes('masterwork');
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
  if (rarity === 'exotic') return clamp(explicit || 2, 1, 2);
  return clamp(explicit || fallbackTier(row), 1, 5);
}

function fallbackTier(row){
  const total = number(row.BaseTotal || row.Total || 0);
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function clamp(value, min, max){ return Math.max(min, Math.min(max, Number(value) || min)); }
function number(value){ const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }

subscribe(() => requestAnimationFrame(applyInGameFixes));
new MutationObserver(() => requestAnimationFrame(applyInGameFixes)).observe(document.body, { childList: true, subtree: true });
requestAnimationFrame(applyInGameFixes);
