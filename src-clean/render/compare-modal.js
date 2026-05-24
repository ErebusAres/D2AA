import { STAT_KEYS, STAT_LABELS, STAT_ICONS, TAGS } from '../constants.js';

let modal;
let currentRows = [];
let onTagChange = null;
let onPullGroup = null;
let onPullItem = null;
let keydownBound = false;

const BONUS_ORDER = ['masterwork', 'mod', 'artifice', 'other'];
const ARCHETYPE_NAMES = new Set(['paragon','grenadier','specialist','brawler','bulwark','gunner']);

export function openCompareModal(rows, options = {}) {
  currentRows = Array.isArray(rows) ? rows.slice().sort(compareBaseFirst) : [];
  onTagChange = options.onTag || null;
  onPullGroup = options.onPullGroup || null;
  onPullItem = options.onPullItem || null;
  ensureModal();
  modal.innerHTML = renderModal(currentRows);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'grid';
  document.body.classList.add('compare-open');
  bindModal();
}

export function closeCompareModal() {
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
  modal.innerHTML = '';
  document.body.classList.remove('compare-open');
  document.removeEventListener('keydown', escClose);
  keydownBound = false;
}

function ensureModal() {
  modal = document.getElementById('compareOverlay');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'compareOverlay';
    modal.className = 'compare-overlay';
    document.body.appendChild(modal);
  }
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}

function bindModal() {
  modal.querySelector('[data-close-compare]')?.addEventListener('click', closeCompareModal);
  modal.querySelector('[data-compare-backdrop]')?.addEventListener('click', closeCompareModal);
  modal.querySelector('[data-pull-group]')?.addEventListener('click', () => onPullGroup?.(currentRows, modal.querySelector('[data-pull-group]')));
  modal.querySelectorAll('[data-pull-item]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = currentRows.find((item) => String(item.Id) === String(button.dataset.pullItem));
      if (row) onPullItem?.(row, button);
    });
  });
  modal.querySelectorAll('[data-compare-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      onTagChange?.(button.dataset.id, button.dataset.compareTag);
      const row = currentRows.find((item) => String(item.Id) === String(button.dataset.id));
      if (row) row.Tag = button.dataset.compareTag;
      modal.innerHTML = renderModal(currentRows);
      bindModal();
    });
  });
  if (!keydownBound) {
    document.addEventListener('keydown', escClose);
    keydownBound = true;
  }
}
function escClose(event) { if (event.key === 'Escape') closeCompareModal(); }

function renderModal(rows) {
  const label = rows[0]?.Dupe_Group || rows[0]?.Group || 'Group';
  const bestId = bestRow(rows)?.Id;
  return `<div class="compare-backdrop" data-compare-backdrop></div>
  <section class="compare-panel" role="dialog" aria-modal="true" aria-label="Compare duplicate group ${html(label)}">
    <header class="compare-head"><div><p>Duplicate Comparison</p><h2>${html(label)}</h2><span>${rows.length} items · base-stat order · ${html(rows[0]?.Slot || 'Armor')}</span></div><div class="compare-head-actions"><button type="button" data-pull-group>Pull Group</button><button type="button" class="compare-close" data-close-compare>×</button></div></header>
    <div class="compare-summary">${renderSummary(rows, bestId)}</div>
    <div class="compare-grid" style="--compare-count:${Math.max(1, rows.length)}">${rows.map((row) => renderCompareCard(row, bestId)).join('')}</div>
  </section>`;
}

function renderSummary(rows, bestId) {
  const best = rows.find((row) => String(row.Id) === String(bestId));
  if (!best) return '';
  return `<strong>Best base total:</strong> <span>${html(displayName(best))}</span> <em>${baseTotal(best)} base · ${currentTotal(best)} current</em>`;
}

function renderCompareCard(row, bestId) {
  const location = row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
  const name = displayName(row);
  return `<article class="compare-card ${String(row.Id) === String(bestId) ? 'is-best' : ''}">
    <div class="compare-item-head">
      <div class="compare-icon">${iconUrl(row) ? `<img src="${html(iconUrl(row))}" alt="" loading="lazy">` : '◇'}<div class="tier-rail compare-tier-rail">${tierMarks(row).join('')}</div>${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div>
      <div><h3 title="${html(name)}">${html(name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} • ${html(location)}${row.IsLocked ? ' • Locked' : ''}</p></div>
      <strong class="compare-score" title="Base total used for comparison"><span>BASE</span>${baseTotal(row)}</strong>
    </div>
    <div class="card-body compare-card-body">
      <aside class="card-side compare-card-side"><div class="archetype compare-archetype">${archetypeIcon(row)}<b>${html(row.Archetype || '—')}</b></div>${renderArmorBonuses(row)}</aside>
      <div class="stat-bars">${STAT_KEYS.map((key) => renderCardStyleStat(row, key)).join('')}${renderCardStyleTotal(row)}</div>
    </div>
    <div class="compare-tags" aria-label="Assign item tag"><div class="compare-tag-set">${TAGS.filter((tag) => tag.picker !== false).map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-compare-tag="${html(tag.value)}" title="${html(tag.label)}">${tag.emoji}</button>`).join('')}</div>${onPullItem ? `<button type="button" class="compare-pull-button" data-pull-item="${html(row.Id)}">${row.IsInVault ? 'Pull' : 'Push'}</button>` : ''}</div>
  </article>`;
}

function renderCardStyleStat(row, key) {
  const base = num(row[`Base${key}`] ?? row[key]);
  const current = num(row[`Current${key}`] ?? row[key]);
  const parts = bonusParts(row, key);
  return `<div class="stat-row" title="${html(STAT_LABELS[key])}: base ${base}${parts.length ? `, ${parts.map((p) => `+${p.value} ${p.type}`).join(', ')}` : ''}"><img src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"><div class="bar"><span class="bar-base" style="width:${Math.min(100, base)}%"></span>${renderBonusSegments(base, parts)}</div><b>${pad(current)}</b></div>`;
}
function renderBonusSegments(base, parts) {
  let left = Math.min(100, base);
  return parts.map((part) => {
    const width = Math.max(0, Math.min(100 - left, part.value));
    const out = `<span class="bar-bonus bonus-${part.type}" title="+${part.value} ${html(part.type)}" style="left:${left}%;width:${width}%"></span>`;
    left += width;
    return out;
  }).join('');
}
function renderCardStyleTotal(row) {
  const base = num(row.BaseTotal ?? row.Total);
  const parts = totalBonusParts(row);
  const bonusTotal = parts.reduce((sum, p) => sum + num(p.value), 0);
  const absolute = num(row.CurrentTotal ?? (base + bonusTotal));
  const calc = `<span class="base-total">${base}</span>${parts.map((p) => `<span class="bonus-total bonus-${p.type}" title="${html(p.type)} bonus">+${p.value}</span>`).join('')}`;
  return `<div class="stat-total" title="Total calculation: base ${base}${parts.length ? `, ${parts.map((p) => `+${p.value} ${p.type}`).join(', ')}` : ''}. Absolute total: ${absolute}." style="grid-template-columns:1fr auto;gap:8px;align-items:end;"><div class="total-left" style="grid-column:1/2;display:grid;gap:3px;min-width:0;"><span class="total-label" style="grid-column:auto;">Total</span><div class="total-value" style="grid-column:auto;justify-self:start;font-size:14px;line-height:1;">${calc}</div></div><b class="absolute-total" style="grid-column:2/3;font-variant-numeric:tabular-nums;text-align:right;font-size:19px;line-height:1;color:#fff;min-width:34px;">${absolute}</b></div>`;
}

function bestRow(rows) { return rows.slice().sort(compareBaseFirst)[0]; }
function compareBaseFirst(a, b) {
  return baseTotal(b) - baseTotal(a)
    || topThreeBase(b) - topThreeBase(a)
    || num(b.Tier || b.GearTier || 0) - num(a.Tier || a.GearTier || 0)
    || num(b.Power || b.Light) - num(a.Power || a.Light)
    || String(a.Name || '').localeCompare(String(b.Name || ''));
}
function topThreeBase(row) { return STAT_KEYS.map((key) => num(row[`Base${key}`] ?? row[key])).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0); }
function bonusParts(row, key) {
  const fallback = num(row[`StatBonus${key}`]);
  const parts = BONUS_ORDER.map((type) => ({ type, value: num(row[`${cap(type)}Bonus${key}`]) })).filter((p) => p.value > 0);
  const known = parts.reduce((total, part) => total + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}
function totalBonusParts(row) {
  const fallback = num(row.StatBonusTotal ?? Math.max(0, num(row.CurrentTotal) - num(row.BaseTotal)));
  const parts = BONUS_ORDER.map((type) => ({ type, value: num(row[`${cap(type)}BonusTotal`]) || STAT_KEYS.reduce((sum, key) => sum + num(row[`${cap(type)}Bonus${key}`]), 0) })).filter((part) => part.value > 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}
function baseTotal(row) { return num(row.BaseTotal ?? row.Total); }
function currentTotal(row) {
  const base = baseTotal(row);
  const parts = totalBonusParts(row);
  const bonusTotal = parts.reduce((sum, p) => sum + num(p.value), 0);
  return num(row.CurrentTotal ?? (base + bonusTotal));
}
function tierMarks(row) {
  const max = 5;
  const tier = Math.max(0, Math.min(max, num(row.Tier || row.GearTier || 0)));
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  return Array.from({ length: max }, (_, i) => {
    const level = max - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  });
}
function archetypeIcon(row) {
  const icon = row.ArchetypeIcon ? `<img class="archetype-img" src="${html(row.ArchetypeIcon)}" alt="" loading="lazy">` : '<span>◇</span>';
  return `<span class="archetype-icon-wrap" tabindex="0">${icon}<span class="d2-tooltip"><b>${html(row.Archetype || 'Armor Archetype')}</b><em>Archetype</em><p>${html(row.ArchetypeDescription || 'Armor archetype bonus.')}</p></span></span>`;
}
function renderArmorBonuses(row) {
  const perks = armorBonuses(row);
  if (!perks.length) return '<div class="bonus-icons is-empty"><span></span><span></span><span></span></div>';
  return `<div class="bonus-icons" aria-label="Armor bonuses and perks">${perks.slice(0, 6).map(renderBonusIcon).join('')}</div>`;
}
function renderBonusIcon(perk) {
  const kind = String(perk.kind || 'armor').toLowerCase();
  const exotic = kind === 'exotic';
  const set = kind === 'set';
  const icon = perk.icon ? `<img src="${html(perk.icon)}" alt="" loading="lazy" onerror="this.remove()">` : set ? '◆' : '✦';
  const label = set ? (perk.label || 'Armor Set Bonus') : exotic ? 'Exotic Perk' : 'Armor Bonus';
  return `<span class="bonus-icon ${exotic ? 'is-exotic' : ''} ${set ? 'is-set-bonus' : ''}" tabindex="0">${icon}<span class="d2-tooltip"><b>${html(perk.name || label)}</b><em>${html(label)}</em><p>${html(perk.description || 'No description available yet.')}</p></span></span>`;
}
function armorBonuses(row) {
  const out = [];
  const exoticItem = isExoticRow(row);
  if (!exoticItem) {
    for (const perk of parsePerks(row.ArmorSetBonuses || row.SetBonuses)) if (isRealSetBonus(perk, row)) out.push({ ...perk, kind: 'set', label: perk.label || setBonusLabelFromText(`${perk.name || ''} ${perk.description || ''}`) });
    for (const perk of parsePerks(row.ArmorBonuses || row.ArmorPerks || row.Perks)) if (!isExoticOrArchetypePerk(perk, row) && !isRealSetBonus(perk, row)) out.push({ ...perk, kind: perk.kind || 'armor' });
    for (const perk of statAuditSetBonuses(row)) out.push(perk);
  }
  if (exoticItem) out.push({ name: row.ExoticPerkName || row.Name || 'Exotic Intrinsic', description: row.ExoticDescription || row.ExoticPerkDescription || 'Exotic armor perk. Full perk details will show here when Bungie socket perk data is cached.', icon: row.ExoticIcon || '', kind: 'exotic' });
  const seen = new Set();
  return out.filter((p) => { const key = normal(`${p.kind || ''}|${p.name || ''}|${p.description || ''}`); if (!p.name || seen.has(key)) return false; seen.add(key); return true; });
}
function statAuditSetBonuses(row) {
  if (isExoticRow(row)) return [];
  const plugs = [...(row.StatAudit?.activePlugs || []), ...(row.SocketAudit?.activePlugs || [])];
  return plugs.filter((plug) => isRealSetBonus(plug, row)).map((plug) => ({ kind: 'set', label: setBonusLabelFromText(`${plug.name || ''} ${plug.description || ''} ${plug.type || ''} ${plug.category || ''}`), name: plug.name || 'Armor Set Bonus', description: plug.description || plug.type || plug.category || 'Armor set bonus socket detected.', icon: plug.icon || '', hash: plug.hash || '' }));
}
function isRealSetBonus(perk, row) { if (!perk || isExoticOrArchetypePerk(perk, row)) return false; const text = `${perk.name || ''} ${perk.description || ''} ${perk.label || ''} ${perk.type || ''} ${perk.category || ''} ${perk.kind || ''}`; return looksLikeSetBonus(text); }
function isExoticOrArchetypePerk(perk, row) { const text = normal(`${perk?.name || ''} ${perk?.description || ''} ${perk?.label || ''} ${perk?.type || ''} ${perk?.category || ''} ${perk?.kind || ''}`); const name = normal(perk?.name); return isExoticRow(row) || text.includes('exotic') || text.includes('intrinsic') || text.includes('archetype') || ARCHETYPE_NAMES.has(name) || name === normal(row.Name) || name === normal(row.Archetype); }
function looksLikeSetBonus(text) { const value = normal(text); const hasSet = value.includes(' set ') || value.startsWith('set ') || value.includes('armor set') || value.includes('setbonus'); const hasBonus = value.includes('bonus') || value.includes('perk') || value.includes('trait') || value.includes('piece') || value.includes('pieces'); return (hasSet && hasBonus) || value.includes('set bonus') || value.includes('armor set bonus') || value.includes('2 piece') || value.includes('4 piece') || value.includes('two piece') || value.includes('four piece') || value.includes('wearing 2') || value.includes('wearing 4') || value.includes('while wearing') || value.includes('smokejumper'); }
function setBonusLabelFromText(text) { const value = normal(text); if (/\b2\b/.test(value) || value.includes('two')) return '2-Piece Set Bonus'; if (/\b4\b/.test(value) || value.includes('four')) return '4-Piece Set Bonus'; return 'Armor Set Bonus'; }
function parsePerks(value) { if (!value) return []; if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function displayName(row) { const name = String(row.Name || '').trim(); return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor'); }
function iconUrl(row) { return row.IconUrl || row.Icon || ''; }
function cap(value) { return String(value).replace(/^./, (char) => char.toUpperCase()); }
function pad(value) { return String(num(value)).padStart(2, ' '); }
function num(value) { const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(parsed) ? parsed : 0; }
function normal(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function isExoticRow(row) { return normal(row.Rarity) === 'exotic'; }
function html(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}