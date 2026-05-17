import { STAT_KEYS, STAT_LABELS, STAT_ICONS, TAGS } from '../constants.js';

let modal;
let currentRows = [];
let onTagChange = null;
let onPullGroup = null;

export function openCompareModal(rows, options = {}) {
  currentRows = Array.isArray(rows) ? rows.slice() : [];
  onTagChange = options.onTag || null;
  onPullGroup = options.onPullGroup || null;
  ensureModal();
  modal.innerHTML = renderModal(currentRows);
  document.body.classList.add('compare-open');
  modal.hidden = false;
  bindModal();
}

export function closeCompareModal() {
  if (!modal) return;
  modal.hidden = true;
  modal.innerHTML = '';
  document.body.classList.remove('compare-open');
}

function ensureModal() {
  modal = document.getElementById('compareOverlay');
  if (modal) return;
  modal = document.createElement('div');
  modal.id = 'compareOverlay';
  modal.className = 'compare-overlay';
  modal.hidden = true;
  document.body.appendChild(modal);
}

function bindModal() {
  modal.querySelector('[data-close-compare]')?.addEventListener('click', closeCompareModal);
  modal.querySelector('[data-compare-backdrop]')?.addEventListener('click', closeCompareModal);
  modal.querySelector('[data-pull-group]')?.addEventListener('click', () => onPullGroup?.(currentRows, modal.querySelector('[data-pull-group]')));
  modal.querySelectorAll('[data-compare-tag]').forEach((button) => {
    button.addEventListener('click', () => {
      onTagChange?.(button.dataset.id, button.dataset.compareTag);
      const row = currentRows.find((item) => String(item.Id) === String(button.dataset.id));
      if (row) row.Tag = button.dataset.compareTag;
      modal.innerHTML = renderModal(currentRows);
      bindModal();
    });
  });
  document.addEventListener('keydown', escClose, { once: true });
}
function escClose(event) {
  if (event.key === 'Escape') closeCompareModal();
  else if (!modal?.hidden) document.addEventListener('keydown', escClose, { once: true });
}

function renderModal(rows) {
  const label = rows[0]?.Dupe_Group || rows[0]?.Group || 'Group';
  const bestId = bestRow(rows)?.Id;
  return `<div class="compare-backdrop" data-compare-backdrop></div>
  <section class="compare-panel" role="dialog" aria-modal="true" aria-label="Compare duplicate group ${html(label)}">
    <header class="compare-head"><div><p>Duplicate Comparison</p><h2>${html(label)}</h2><span>${rows.length} items · ${html(rows[0]?.Slot || 'Armor')}</span></div><div class="compare-head-actions"><button type="button" data-pull-group>Pull Group</button><button type="button" class="compare-close" data-close-compare>×</button></div></header>
    <div class="compare-summary">${renderSummary(rows, bestId)}</div>
    <div class="compare-grid">${rows.map((row) => renderCompareCard(row, bestId)).join('')}</div>
  </section>`;
}

function renderSummary(rows, bestId) {
  const best = rows.find((row) => String(row.Id) === String(bestId));
  if (!best) return '';
  return `<strong>Best current roll:</strong> <span>${html(best.Name)}</span> <em>${Number(best.Total || 0)} total · ${scoreRow(best)} score</em>`;
}

function renderCompareCard(row, bestId) {
  const score = scoreRow(row);
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  return `<article class="compare-card ${String(row.Id) === String(bestId) ? 'is-best' : ''}">
    <div class="compare-item-head"><div class="compare-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '◇'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div><div><h3>${html(row.Name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} ${row.IsInVault ? '• Vault' : row.IsEquipped ? '• Equipped' : '• Inventory'}</p></div><strong class="compare-score">${score}</strong></div>
    <div class="compare-tag-line"><span>Tag</span><strong>${tag ? tag.emoji + ' ' + html(tag.label) : 'None'}</strong></div>
    <div class="compare-stat-grid">${STAT_KEYS.map((key) => renderStat(row, key)).join('')}<div class="compare-total"><span>Total</span><strong>${row.Total || 0}</strong></div><div class="compare-total"><span>Tier</span><strong>${diamonds(row.Tier, row.TierMax)}</strong></div></div>
    <div class="compare-tags">${TAGS.filter((tag) => tag.picker !== false).map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-compare-tag="${html(tag.value)}" title="${html(tag.label)}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}

function renderStat(row, key) {
  const value = Number(row[key] || 0);
  return `<div class="compare-stat ${quality(value)}"><img src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"><strong>${value}</strong><span>${html(STAT_LABELS[key])}</span></div>`;
}

function bestRow(rows) {
  return rows.slice().sort((a, b) => scoreRow(b) - scoreRow(a) || Number(b.Total || 0) - Number(a.Total || 0) || Number(b.Power || b.Light || 0) - Number(a.Power || a.Light || 0))[0];
}
function scoreRow(row) {
  const topThree = STAT_KEYS.map((key) => Number(row[key] || 0)).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
  return topThree + Number(row.Total || 0) / 10 + Number(row.Tier || 0) * 1.5;
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
  return '◆'.repeat(n) + '◇'.repeat(Math.max(0, m - n));
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
