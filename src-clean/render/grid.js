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
  container.querySelectorAll('[data-card-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction(button.dataset.cardAction, button);
    });
  });
}

function renderCard(row) {
  const badge = badgeText(row);
  const group = row.Group ? `<div class="group-badge ${row.GroupColor || ''}">${row.Group}</div>` : '';
  const actionDisabled = canRunAction(row) ? '' : ' disabled';
  return `<article class="armor-card ${row.Rarity.toLowerCase()} ${row.Group ? 'is-grouped ' + row.GroupColor : ''}">
    ${badge ? `<button class="light-tag-badge" type="button">${badge}</button>` : ''}
    ${group}
    <div class="card-top">
      <div class="item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}</div>
      <div class="item-title"><h3>${html(row.Name)}</h3><p>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)}</p></div>
    </div>
    <div class="card-grid-3x3">
      <div><span>Total</span><strong>${row.Total || 0}</strong></div>
      <div><span>Tier</span><strong class="diamonds">${diamonds(row.Tier, row.TierMax)}</strong></div>
      <div><span>Arch</span><strong>${html(row.Archetype || '—')}</strong></div>
      ${STAT_KEYS.map((key) => `<div class="stat-cell stat-${key.toLowerCase()}"><span>${STAT_LABELS[key]}</span><strong>${row[key] || 0}</strong></div>`).join('')}
    </div>
    <div class="card-actions">
      <button type="button" class="mini-action" data-card-action="${html(row.Id)}"${actionDisabled}>${html(actionLabel(row))}</button>
      ${row.Group ? `<button type="button" class="mini-action mini-action--group" data-card-action="group:${html(row.Group.replace(/[A-Z]$/, ''))}">Group IDs</button>` : ''}
    </div>
    <div class="tag-strip">${TAGS.map((tag) => `<button type="button" class="tag-dot ${row.Tag === tag.value ? 'is-active' : ''}" title="${tag.label}" data-id="${html(row.Id)}" data-tag-choice="${tag.value}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}

function badgeText(row) {
  const parts = [];
  if (row.Power) parts.push(row.Power);
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  if (tag) parts.push(tag.emoji);
  return parts.join(' • ');
}
function diamonds(tier, max = 5) {
  const n = Math.max(0, Math.min(Number(max || 5), Number(tier || 0)));
  return '◆'.repeat(n) + '◇'.repeat(Math.max(0, Number(max || 5) - n));
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
