import { STAT_KEYS, STAT_LABELS, TAGS } from '../constants.js';

export function renderItemFeed(container, countEl, rows, onTag) {
  const recent = rows.slice().sort((a,b) => (b.FoundAt || 0) - (a.FoundAt || 0)).slice(0, 30);
  countEl.textContent = String(recent.length);
  container.innerHTML = recent.map(renderFeedCard).join('');
  container.querySelectorAll('[data-feed-tag]').forEach((button) => {
    button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag));
  });
}

function renderFeedCard(row) {
  return `<article class="feed-card">
    <div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power ? `<b>${row.Power}</b>` : ''}</div>
    <div class="feed-main"><strong>${html(row.Name)}</strong><span>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)}</span><div class="feed-stats">${STAT_KEYS.map((key) => `<em>${STAT_LABELS[key]} ${row[key] || 0}</em>`).join('')}</div></div>
    <div class="feed-tags">${TAGS.map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" data-id="${html(row.Id)}" data-feed-tag="${tag.value}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
