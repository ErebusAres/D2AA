import { state, subscribe } from '../src-clean/state.js';

function applyBonusIcons(){
  const rows = new Map((state.rows || []).map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id]').forEach((card) => {
    const row = rows.get(String(card.dataset.id));
    if (!row) return;
    const host = card.querySelector('.bonus-icons');
    if (!host) return;
    const bonuses = buildBonuses(row).slice(0, 6);
    host.classList.toggle('is-empty', bonuses.length === 0);
    host.setAttribute('aria-label', 'Armor set bonuses and exotic perks');
    host.innerHTML = bonuses.length ? bonuses.map(renderBonus).join('') : '<span></span><span></span><span></span>';
  });
}

function buildBonuses(row){
  const bonuses = [];
  const archetypeName = clean(row.Archetype);
  const itemName = clean(row.Name);

  for (const perk of parseMany(row.ArmorSetBonuses, row.SetBonuses, row.SetBonus, row.ArmorSetBonus)) pushCleanBonus(bonuses, normalizePerk(perk, 'set', 'Armor Set Bonus'), row);
  for (const perk of setBonusesFromAudit(row)) pushCleanBonus(bonuses, perk, row);

  for (const perk of parseMany(row.ArmorBonuses, row.ArmorPerks, row.Perks)) {
    const kind = perk.kind || inferKind(perk);
    const normalized = normalizePerk(perk, kind, perk.label || labelForKind(kind));
    if (sameText(normalized.name, archetypeName)) continue;
    if (normalized.kind === 'archetype') continue;
    if (normalized.kind === 'exotic' && sameText(normalized.name, itemName)) continue;
    if (looksLikeArchetype(normalized, row)) continue;
    if (sameText(normalized.name, row.ExoticPerkName) || sameText(normalized.description, row.ExoticPerkDescription)) continue;
    pushCleanBonus(bonuses, normalized, row);
  }

  const exoticName = clean(row.ExoticPerkName || row.ExoticName);
  const exoticDesc = clean(row.ExoticPerkDescription || row.ExoticDescription);
  if (String(row.Rarity || '').toLowerCase() === 'exotic' && exoticName && !sameText(exoticName, itemName)) {
    pushCleanBonus(bonuses, { kind: 'exotic', label: 'Exotic Armor Perk', name: exoticName, description: exoticDesc || 'No description available yet.', icon: row.ExoticIcon || '' }, row);
  }

  const seen = new Set();
  return bonuses.filter((bonus) => {
    const key = dedupeKey(bonus);
    if (!bonus.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => kindOrder(a.kind) - kindOrder(b.kind));
}

function pushCleanBonus(target, bonus, row){
  if (!bonus?.name) return;
  if (looksLikeArchetype(bonus, row)) return;
  if (sameText(bonus.name, row.Name)) return;
  target.push(bonus);
}

function setBonusesFromAudit(row){
  const audit = typeof row.StatAudit === 'string' ? parseJson(row.StatAudit) : row.StatAudit;
  const plugs = audit?.activePlugs || [];
  return plugs.filter((plug) => looksLikeSetBonusPlug(plug, row)).map((plug) => ({ kind: 'set', label: setLabel(plug), name: clean(plug.name || 'Armor Set Bonus'), description: clean(plug.description || plug.desc || plug.subtitle || ''), icon: plug.icon || plug.iconUrl || '' }));
}

function looksLikeSetBonusPlug(plug, row){
  const text = sameKey(`${plug?.name || ''} ${plug?.description || ''} ${plug?.type || ''} ${plug?.category || ''}`);
  if (!text || looksLikeArchetype(plug, row)) return false;
  return text.includes('setbonus') || text.includes('armorset') || text.includes('twopiece') || text.includes('fourpiece') || text.includes('2piece') || text.includes('4piece') || text.includes('wearing2') || text.includes('wearing4') || text.includes('smokejumper');
}

function looksLikeArchetype(perk, row){
  const name = sameKey(perk?.name || perk?.displayName || perk?.title || '');
  const archetype = sameKey(row?.Archetype || '');
  const text = sameKey(`${perk?.name || ''} ${perk?.label || ''} ${perk?.kind || ''}`);
  return Boolean(name && (name === archetype || ['paragon','grenadier','specialist','brawler','bulwark','gunner'].includes(name) || text.includes('archetype')));
}

function normalizePerk(perk, kind = 'armor', fallbackLabel = 'Armor Bonus'){
  if (typeof perk === 'string') return { kind, label: fallbackLabel, name: perk, description: '', icon: '' };
  const normalizedKind = kind || 'armor';
  return { kind: normalizedKind, label: perk.label || labelForKind(normalizedKind) || fallbackLabel, name: clean(perk.name || perk.displayName || perk.title), description: clean(perk.description || perk.desc || perk.subtitle), icon: perk.icon || perk.iconUrl || perk.Icon || '' };
}
function renderBonus(bonus){
  const cls = `bonus-icon is-${safeClass(bonus.kind || 'armor')}`;
  const icon = bonus.icon ? `<img src="${escapeHtml(bonus.icon)}" alt="">` : fallbackIcon(bonus.kind);
  return `<span class="${cls}" tabindex="0">${icon}<span class="d2-tooltip"><b>${escapeHtml(bonus.name)}</b><em>${escapeHtml(bonus.label || labelForKind(bonus.kind))}</em><p>${escapeHtml(bonus.description || 'No description available yet.')}</p></span></span>`;
}
function parseMany(...values){ return values.flatMap(parsePerks).filter(Boolean); }
function parsePerks(value){
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return [value];
  const text = String(value).trim();
  if (!text) return [];
  try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return parsed; if (parsed && typeof parsed === 'object') return [parsed]; } catch {}
  return text.split(/\s*\|\s*|\s*;\s*/).filter(Boolean);
}
function parseJson(value){ try { return JSON.parse(value); } catch { return null; } }
function inferKind(perk){ const text = sameKey(`${perk?.name || perk || ''} ${perk?.description || ''} ${perk?.kind || ''} ${perk?.label || ''}`); if (text.includes('setbonus') || text.includes('piecebonus') || text.includes('armorset')) return 'set'; if (text.includes('exotic')) return 'exotic'; if (text.includes('archetype')) return 'archetype'; return 'armor'; }
function labelForKind(kind){ if (kind === 'archetype') return 'Archetype'; if (kind === 'set') return 'Armor Set Bonus'; if (kind === 'exotic') return 'Exotic Armor Perk'; return 'Armor Bonus'; }
function setLabel(plug){ const text = sameKey(`${plug?.name || ''} ${plug?.description || ''}`); if (text.includes('2piece') || text.includes('twopiece') || text.includes('wearing2')) return '2-Piece Set Bonus'; if (text.includes('4piece') || text.includes('fourpiece') || text.includes('wearing4')) return '4-Piece Set Bonus'; return 'Armor Set Bonus'; }
function fallbackIcon(kind){ if (kind === 'set') return '◆'; if (kind === 'exotic') return '✦'; return '✧'; }
function sameText(a,b){ return sameKey(a) === sameKey(b); }
function sameKey(value){ return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function safeClass(value){ return sameKey(value) || 'armor'; }
function kindOrder(kind){ return kind === 'set' ? 0 : kind === 'exotic' ? 1 : 2; }
function dedupeKey(bonus){ const name = sameKey(bonus.name); const desc = sameKey(bonus.description); return desc ? desc : name; }
function clean(value){ return String(value ?? '').trim(); }
function escapeHtml(value){ return clean(value).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

subscribe(() => requestAnimationFrame(applyBonusIcons));
requestAnimationFrame(applyBonusIcons);
