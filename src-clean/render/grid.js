import { STAT_KEYS, STAT_LABELS, TAGS } from '../constants.js';
import { actionLabel, canRunAction } from '../data/actions.js';

export function renderGrid(container, rows, onTag, onAction) {
  container.innerHTML = rows.map(renderCard).join('');
  container.querySelectorAll('[data-tag-choice]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onTag(button.dataset.id, button.dataset.tagChoice);
    });
  });
  container.querySelectorAll('[data-action-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction?.(button.dataset.actionId, button);
    });
  });
}

function renderCard(row) {
  const badge = badgeText(row);
  const groupId = row.Group ? row.Group.replace(/[A-Z]$/, '') : '';
  const group = row.Group ? `<div class="group-badge ${row.GroupColor || ''}">${row.Group}</div>` : '';
  const action = actionLabel(row);
  return `<article class="armor-card ${safeClass(row.Rarity)} ${row.Group ? 'is-grouped ' + row.GroupColor : ''}" data-card-id="${html(row.Id)}">
    ${badge ? `<button class="light-tag-badge" type="button" data-tag-trigger data-id="${html(row.Id)}">${badge}</button>` : ''}
    ${group}
    <div class="card-top">
      <div class="item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}</div>
      <div class="item-title"><h3 title="${html(row.Name)}">${html(row.Name)}</h3><p>${identifierLine(row)}</p></div>
    </div>
    <div class="card-grid-3x3">
      <div><span>Total</span><strong>${row.Total || 0}</strong></div>
      <div><span>Tier</span><strong class="diamonds">${diamonds(row.Tier, row.TierMax)}</strong></div>
      <div><span>Arch</span><strong title="${html(row.Archetype || '—')}">${html(row.Archetype || '—')}</strong></div>
      ${STAT_KEYS.map((key) => `<div class="stat-cell stat-${key.toLowerCase()}"><span>${STAT_LABELS[key]}</span><strong>${row[key] || 0}</strong></div>`).join('')}
    </div>
    <div class="card-actions">
      <button type="button" data-action-id="${html(row.Id)}" ${canRunAction(row) ? '' : 'disabled'}>${html(action)}</button>
      ${row.Group ? `<button type="button" data-action-id="group:${html(groupId)}">Copy group</button>` : ''}
    </div>
    <div class="tag-strip" aria-label="Tag ${html(row.Name)}">${TAGS.map((tag) => `<button type="button" class="tag-dot ${row.Tag === tag.value ? 'is-active' : ''}" title="${html(tag.label)}" data-id="${html(row.Id)}" data-tag-choice="${html(tag.value)}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}

function identifierLine(row) {
  const pieces = [row.Class, row.Slot, row.Rarity].filter(Boolean).map(html);
  if (row.Source === 'Bungie') pieces.push(row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Character');
  if (row.RecentStatus) pieces.push(`<span class="status-pill">${html(row.RecentStatus)}</span>`);
  return pieces.join(' • ');
}
function badgeText(row) {
  const parts = [];
  if (row.Power || row.Light) parts.push(row.Power || row.Light);
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  if (tag) parts.push(tag.emoji);
  return parts.join(' • ');
}
function diamonds(tier, max = 5) {
  const m = Number(max || 5);
  const n = Math.max(0, Math.min(m, Number(tier || 0)));
  return '◆'.repeat(n) + '◇'.repeat(Math.max(0, m - n));
}
function safeClass(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'); }
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
