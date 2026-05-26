import { STAT_KEYS, TAGS } from '../constants.js';
import { detectArmorTuning, tuningBadgeHtml, tuningSummary } from '../data/armor-tuning.js';

let modal;
let currentRows = [];
let onTagChange = null;
let onPullGroup = null;
let onPullItem = null;
let renderers = {};
let keydownBound = false;

export function openCompareModal(rows, options = {}) {
  currentRows = Array.isArray(rows) ? rows.slice().sort(compareBaseFirst) : [];
  currentRows.forEach((row) => detectArmorTuning(row));
  onTagChange = options.onTag || null;
  onPullGroup = options.onPullGroup || null;
  onPullItem = options.onPullItem || null;
  renderers = options.renderers || {};
  ensureModal();
  modal.innerHTML = renderModal(currentRows);
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'grid';
  document.body.classList.add('compare-open');
  bindModal();
  window.dispatchEvent(new CustomEvent('d2aa:compare-rendered'));
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
      window.dispatchEvent(new CustomEvent('d2aa:compare-rendered'));
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
  const tierHtml = renderer('tierMarks', fallbackTierMarks)(row).join('');
  const archetypeHtml = renderer('archetypeIcon', fallbackArchetypeIcon)(row);
  const armorBonusHtml = renderer('renderArmorBonuses', fallbackArmorBonuses)(row);
  const statHtml = STAT_KEYS.map((key) => renderer('renderStat', fallbackStat)(row, key)).join('');
  const totalHtml = renderer('renderTotal', fallbackTotal)(row);
  const tuning = tuningSummary(row);
  return `<article class="compare-card ${String(row.Id) === String(bestId) ? 'is-best' : ''}" data-id="${html(row.Id)}">
    <div class="compare-item-head">
      <div class="compare-icon">${iconUrl(row) ? `<img src="${html(iconUrl(row))}" alt="" loading="lazy">` : '◇'}<div class="tier-rail compare-tier-rail">${tierHtml}</div>${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div>
      <div><h3 title="${html(name)}">${html(name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)} • ${html(location)}${row.IsLocked ? ' • Locked' : ''}</p>${tuning ? `<p class="compare-tuning-summary">${html(tuning)}</p>` : ''}</div>
      <strong class="compare-score" title="Base total used for comparison"><span>BASE</span>${baseTotal(row)}</strong>
    </div>
    <div class="card-body compare-card-body">
      <aside class="card-side compare-card-side"><div class="archetype compare-archetype">${archetypeHtml}<b>${html(row.Archetype || '—')}</b></div>${armorBonusHtml}</aside>
      <div class="stat-bars">${statHtml}${totalHtml}</div>
    </div>
    <div class="compare-tags" aria-label="Assign item tag"><div class="compare-tag-set">${TAGS.filter((tag) => tag.picker !== false).map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-compare-tag="${html(tag.value)}" title="${html(tag.label)}">${tag.emoji}</button>`).join('')}</div>${onPullItem ? `<button type="button" class="compare-pull-button" data-pull-item="${html(row.Id)}">${row.IsInVault ? 'Pull' : 'Push'}</button>` : ''}</div>
  </article>`;
}

function renderer(name, fallback) {
  return typeof renderers[name] === 'function' ? renderers[name] : fallback;
}

function bestRow(rows) {
  return rows.slice().sort(compareBaseFirst)[0];
}

function compareBaseFirst(a, b) {
  return baseTotal(b) - baseTotal(a)
    || topThreeBase(b) - topThreeBase(a)
    || num(b.Tier || b.GearTier || 0) - num(a.Tier || a.GearTier || 0)
    || num(b.Power || b.Light) - num(a.Power || a.Light)
    || String(a.Name || '').localeCompare(String(b.Name || ''));
}

function topThreeBase(row) {
  return STAT_KEYS.map((key) => num(row[`Base${key}`] ?? row[key])).sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
}

function baseTotal(row) {
  return num(row.BaseTotal ?? row.Total);
}

function currentTotal(row) {
  return num(row.CurrentTotal ?? row.Total ?? row.BaseTotal);
}

function fallbackTierMarks(row) {
  const max = 5;
  const tier = Math.max(0, Math.min(max, num(row.Tier || row.GearTier || 0)));
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  return Array.from({ length: max }, (_, i) => {
    const level = max - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  });
}

function fallbackArchetypeIcon(row) {
  return row.ArchetypeIcon ? `<span class="archetype-icon-wrap"><img class="archetype-img" src="${html(row.ArchetypeIcon)}" alt="" loading="lazy"></span>` : '<span>◇</span>';
}

function fallbackArmorBonuses() {
  return '<div class="bonus-icons is-empty"><span></span><span></span><span></span></div>';
}

function fallbackStat(row, key) {
  const base = num(row[`Base${key}`] ?? row[key]);
  const current = num(row[`Current${key}`] ?? row[key]);
  return `<div class="stat-row"><span class="compare-stat-label stat-icon-stack">${tuningBadgeHtml(row, key)}${html(key)}</span><div class="bar"><span class="bar-base" style="width:${Math.min(100, base)}%"></span></div><b>${String(current).padStart(2, ' ')}</b></div>`;
}

function fallbackTotal(row) {
  const base = baseTotal(row);
  const current = currentTotal(row);
  return `<div class="stat-total"><span class="total-label">Total</span><div class="total-value"><span class="base-total">${base}</span></div><b class="absolute-total">${current}</b></div>`;
}

function displayName(row) {
  const name = String(row.Name || '').trim();
  return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor');
}

function iconUrl(row) {
  return row.IconUrl || row.Icon || '';
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
