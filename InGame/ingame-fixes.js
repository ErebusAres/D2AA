import { state, subscribe } from '../src-clean/state.js';

function applyInGameFixes(){
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
  if (row.IsMasterworked === true) return true;
  if (String(row.IsMasterworked).toLowerCase() === 'true' && Number(row.MasterworkBonusTotal || 0) > 0) return true;
  if (Number(row.MasterworkBonusTotal || 0) >= 10) return true;
  if (Number(row.MasterworkBonusHealth || 0) + Number(row.MasterworkBonusMelee || 0) + Number(row.MasterworkBonusGrenade || 0) + Number(row.MasterworkBonusSuper || 0) + Number(row.MasterworkBonusClassAbility || 0) + Number(row.MasterworkBonusWeapon || 0) >= 10) return true;
  return false;
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
  const explicit = Number(row.GearTier || row.Tier || 0);
  if (source === 'bungie' && explicit > 0) return clamp(explicit, 1, 5);
  if (rarity === 'exotic') return clamp(explicit || 2, 1, 2);
  return clamp(explicit || fallbackTier(row), 1, 5);
}

function fallbackTier(row){
  const total = Number(row.BaseTotal || row.Total || 0);
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function clamp(value, min, max){ return Math.max(min, Math.min(max, Number(value) || min)); }

subscribe(() => requestAnimationFrame(applyInGameFixes));
new MutationObserver(() => requestAnimationFrame(applyInGameFixes)).observe(document.body, { childList: true, subtree: true });
requestAnimationFrame(applyInGameFixes);
