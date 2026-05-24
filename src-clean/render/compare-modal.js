import { STAT_KEYS, STAT_LABELS, STAT_ICONS, TAGS } from '../constants.js';

let modal;
let currentRows = [];
let onTagChange = null;
let onPullGroup = null;
let onPullItem = null;
let keydownBound = false;

const BONUS_ORDER = ['masterwork', 'mod', 'artifice', 'other'];

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
  return `<strong>Best base total:</strong> <span>${html(best.Name)}</span> <em>${baseTotal(best)} base · ${currentTotal(best)} current</em>`;
}

function renderCompareCard(row, bestId) {
  const location = row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
  return `<article class="compare-card ${String(row.Id) === String(bestId) ? 'is-best' : ''}">
    <div class="compare-item-head"><div class="compare-icon">${iconUrl(row) ? `<img src="${html(iconUrl(row))}" alt="" loading="lazy">` : '◇'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div><div><h3>${html(row.Name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} • ${html(location)}${row.IsLocked ? ' • Locked' : ''}</p></div><strong class="compare-score" title="Base total used for comparison"><span>BASE</span>${baseTotal(row)}</strong></div>
    <div class="stat-bars compare-stat-bars">${STAT_KEYS.map((key) => renderCardStyleStat(row, key)).join('')}${renderCardStyleTotal(row)}<div class="stat-total compare-tier"><span class="total-label">Tier</span><b>${diamonds(row.Tier, row.TierMax)}</b></div></div>
    <div class="compare-tags" aria-label="Assign item tag"><div class="compare-tag-set">${TAGS.filter((tag) => tag.picker !== false).map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-compare-tag="${html(tag.value)}" title="${html(tag.label)}">${tag.emoji}</button>`).join('')}</div>${onPullItem ? `<button type="button" class="compare-pull-button" data-pull-item="${html(row.Id)}">${row.IsInVault ? 'Pull' : 'Push'}</button>` : ''}</div>
  </article>`;
}

function renderCardStyleStat(row, key) {
  const base = statBase(row, key);
  const current = statCurrent(row, key);
  const parts = bonusParts(row, key);
  return `<div class="stat-row" title="${html(STAT_LABELS[key])}: base ${base}${parts.length ? `, ${parts.map((p) => `+${p.value} ${p.type}`).join(', ')}` : ''}. Current: ${current}."><img src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"><div class="bar"><span class="bar-base" style="width:${Math.min(100, base)}%"></span>${renderBonusSegments(base, parts)}</div><b>${pad(current)}</b></div>`;
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
  const base = baseTotal(row);
  const parts = totalBonusParts(row);
  const bonusTotal = parts.reduce((sum, p) => sum + num(p.value), 0);
  const absolute = currentTotal(row) || base + bonusTotal;
  const calc = `<span class="base-total">${base}</span>${parts.map((p) => `<span class="bonus-total bonus-${p.type}" title="${html(p.type)} bonus">+${p.value}</span>`).join('')}`;
  return `<div class="stat-total compare-total-card" title="Total calculation: base ${base}${parts.length ? `, ${parts.map((p) => `+${p.value} ${p.type}`).join(', ')}` : ''}. Absolute total: ${absolute}."><div class="total-left"><span class="total-label">Total</span><div class="total-value">${calc}</div></div><b class="absolute-total">${absolute}</b></div>`;
}

function bestRow(rows) { return rows.slice().sort(compareBaseFirst)[0]; }
function compareBaseFirst(a, b) {
  return baseTotal(b) - baseTotal(a)
    || topThreeBase(b) - topThreeBase(a)
    || num(b.Tier || 0) - num(a.Tier || 0)
    || num(b.Power || b.Light) - num(a.Power || a.Light)
    || String(a.Name || '').localeCompare(String(b.Name || ''));
}
function topThreeBase(row) { return STAT_KEYS.map((key) => statBase(row, key)).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0); }
function diamonds(tier, max = 5) {
  const m = Number(max || 5);
  const n = Math.max(0, Math.min(m, Number(tier || 0)));
  return Array.from({ length: n }, () => '<span class="compare-tier-diamond">◆</span>').join('');
}
function bonusParts(row, key) {
  const fallback = num(row[`StatBonus${key}`]);
  const parts = BONUS_ORDER.map((type) => ({ type, value: num(row[`${cap(type)}Bonus${key}`]) })).filter((p) => p.value > 0);
  const known = parts.reduce((total, part) => total + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}
function totalBonusParts(row) {
  const fallback = num(row.StatBonusTotal ?? Math.max(0, currentTotal(row) - baseTotal(row)));
  const parts = BONUS_ORDER.map((type) => ({ type, value: num(row[`${cap(type)}BonusTotal`]) || STAT_KEYS.reduce((sum, key) => sum + num(row[`${cap(type)}Bonus${key}`]), 0) })).filter((part) => part.value > 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}
function statBase(row, key) { return num(row[`Base${key}`] ?? row[key]); }
function statCurrent(row, key) { return num(row[`Current${key}`] ?? row[key]); }
function baseTotal(row) { return num(row.BaseTotal ?? row.Total); }
function currentTotal(row) { return num(row.CurrentTotal ?? baseTotal(row) + num(row.StatBonusTotal)); }
function iconUrl(row) { return row.IconUrl || row.Icon || ''; }
function cap(value) { return String(value).replace(/^./, (char) => char.toUpperCase()); }
function pad(value) { return String(num(value)).padStart(2, ' '); }
function num(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}