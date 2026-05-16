import { STAT_KEYS, STAT_LABELS, TAGS } from '../constants.js';

export function renderItemFeed(container, countEl, rows, onTag) {
  const recent = rows.slice().sort((a,b) => recentSortValue(b) - recentSortValue(a)).slice(0, 30);
  countEl.textContent = String(recent.length);
  container.innerHTML = recent.map(renderFeedCard).join('');
  container.querySelectorAll('[data-feed-tag]').forEach((button) => {
    button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag));
  });
}

function renderFeedCard(row) {
  const status = statusLabel(row);
  return `<article class="feed-card ${row.RecentStatus ? 'is-' + row.RecentStatus : ''}">
    <div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power ? `<b>${row.Power}</b>` : ''}</div>
    <div class="feed-main">
      <div class="feed-title-line"><strong>${html(row.Name)}</strong>${status ? `<small>${status}</small>` : ''}</div>
      <span>${html(row.Class)} • ${html(row.Slot)} • ${html(locationText(row))}</span>
      <div class="feed-stats">${STAT_KEYS.map((key) => `<em>${STAT_LABELS[key]} ${row[key] || 0}</em>`).join('')}</div>
    </div>
    <div class="feed-tags">${TAGS.map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-feed-tag="${tag.value}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}

function recentSortValue(row) {
  if (row.RecentlyFound || row.RecentStatus) return Number(row.FoundAt || Date.now());
  return Number(row.FoundAt || 0);
}
function statusLabel(row) {
  if (row.RecentStatus === 'new') return 'NEW';
  if (row.RecentStatus === 'moved') return 'MOVED';
  if (row.RecentStatus === 'changed') return 'CHANGED';
  return '';
}
function locationText(row) {
  if (row.IsEquipped) return 'Equipped';
  if (row.IsInVault) return 'Vault';
  return row.Rarity || 'Inventory';
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
