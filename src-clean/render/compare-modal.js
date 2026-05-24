import { STAT_KEYS, STAT_LABELS, STAT_ICONS, TAGS } from '../constants.js';

let modal;
let currentRows = [];
let onTagChange = null;
let onPullGroup = null;
let onPullItem = null;
let keydownBound = false;

const BONUS_ORDER = ['masterwork', 'mod', 'artifice', 'other'];

export function openCompareModal(rows, options = {}) {
  currentRows = Array.isArray(rows) ? rows.slice() : [];
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
function escClose(event) {
  if (event.key === 'Escape') closeCompareModal();
}

function renderModal(rows) {
  const label = rows[0]?.Dupe_Group || rows[0]?.Group || 'Group';
  const bestId = bestRow(rows)?.Id;
  return `<div class="compare-backdrop" data-compare-backdrop></div>
  <section class="compare-panel" role="dialog" aria-modal="true" aria-label="Compare duplicate group ${html(label)}">
    <header class="compare-head"><div><p>Duplicate Comparison</p><h2>${html(label)}</h2><span>${rows.length} items · ${html(rows[0]?.Slot || 'Armor')}</span></div><div class="compare-head-actions"><button type="button" data-pull-group>Pull Group</button><button type="button" class="compare-close" data-close-compare>×</button></div></header>
    <div class="compare-summary">${renderSummary(rows, bestId)}</div>
    <div class="compare-grid" style="--compare-count:${Math.max(1, rows.length)}">${rows.map((row) => renderCompareCard(row, bestId)).join('')}</div>
  </section>`;
}

function renderSummary(rows, bestId) {
  const best = rows.find((row) => String(row.Id) === String(bestId));
  if (!best) return '';
  const base = baseTotal(best);
  const current = currentTotal(best);
  return `<strong>Best base roll:</strong> <span>${html(best.Name)}</span> <em>${base} base · ${current} current · ${scoreRow(best).toFixed(1)} score</em>`;
}

function renderCompareCard(row, bestId) {
  const score = scoreRow(row);
  const location = row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
  return `<article class="compare-card ${String(row.Id) === String(bestId) ? 'is-best' : ''}">
    <div class="compare-item-head"><div class="compare-icon">${iconUrl(row) ? `<img src="${html(iconUrl(row))}" alt="" loading="lazy">` : '◇'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div><div><h3>${html(row.Name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} • ${html(location)}${row.IsLocked ? ' • Locked' : ''}</p></div><strong class="compare-score" title="Base-stat comparison score">${score.toFixed(1)}</strong></div>
    <div class="compare-stat-grid">${STAT_KEYS.map((key) => renderStat(row, key)).join('')}${renderTotal(row)}<div class="compare-total compare-tier"><span>Tier</span><strong>${diamonds(row.Tier, row.TierMax)}</strong></div></div>
    <div class="compare-tags" aria-label="Assign item tag"><div class="compare-tag-set">${TAGS.filter((tag) => tag.picker !== false).map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-compare-tag="${html(tag.value)}" title="${html(tag.label)}">${tag.emoji}</button>`).join('')}</div>${onPullItem ? `<button type="button" class="compare-pull-button" data-pull-item="${html(row.Id)}">${row.IsInVault ? 'Pull' : 'Push'}</button>` : ''}</div>
  </article>`;
}

function renderStat(row, key) {
  const base = statBase(row, key);
  const current = statCurrent(row, key);
  const bonus = Math.max(0, current - base);
  return `<div class="compare-stat ${quality(base)}" title="${html(STAT_LABELS[key])}: ${base} base${bonus ? ` +${bonus} bonus` : ''} = ${current}"><img src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"><div><strong>${base}</strong>${bonus ? `<em>+${bonus}</em>` : ''}</div><span>${html(STAT_LABELS[key])}</span><b>${current}</b></div>`;
}

function renderTotal(row) {
  const base = baseTotal(row);
  const parts = totalBonusParts(row);
  const absolute = currentTotal(row);
  const calc = `<span class="base-total">${base}</span>${parts.map((p) => `<span class="bonus-total bonus-${p.type}" title="${html(p.type)} bonus">+${p.value}</span>`).join('')}`;
  return `<div class="compare-total compare-total-split" title="Total calculation: base ${base}${parts.length ? `, ${parts.map((p) => `+${p.value} ${p.type}`).join(', ')}` : ''}. Absolute total: ${absolute}."><span>Total</span><div>${calc}</div><strong>${absolute}</strong></div>`;
}

function bestRow(rows) {
  return rows.slice().sort((a, b) => scoreRow(b) - scoreRow(a) || baseTotal(b) - baseTotal(a) || currentTotal(b) - currentTotal(a) || num(b.Power || b.Light) - num(a.Power || a.Light))[0];
}
function scoreRow(row) {
  const topThree = STAT_KEYS.map((key) => statBase(row, key)).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
  return topThree + baseTotal(row) / 10 + num(row.Tier || 0) * 1.5;
}
function quality(value) {
  if (value >= 25) return 'perfect';
  if (value >= 20) return 'great';
  if (value >= 15) return 'good';
  if (value >= 10) return 'okay';
  if (value >= 5) return 'bad';
  return 'poor';
}
function diamonds(tier, max = 5) {
  const m = Number(max || 5);
  const n = Math.max(0, Math.min(m, Number(tier || 0)));
  return Array.from({ length: n }, () => '<span class="compare-tier-diamond">◆</span>').join('');
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
function num(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}