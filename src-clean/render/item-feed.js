import { STAT_KEYS, STAT_LABELS, TAGS } from '../constants.js';

export function renderItemFeed(container, countEl, rows, onTag) {
  const recent = rows.slice().sort(compareRecent).slice(0, 30);
  countEl.textContent = String(recent.length);
  container.innerHTML = recent.map(renderFeedCard).join('');
  container.querySelectorAll('[data-feed-tag]').forEach((button) => {
    button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag));
  });
}

function compareRecent(a, b) {
  const aTime = Number(a.FoundAt || Date.parse(a.LastChangedAt || '') || 0);
  const bTime = Number(b.FoundAt || Date.parse(b.LastChangedAt || '') || 0);
  const statusWeight = (row) => row.RecentStatus === 'new' ? 3 : row.RecentStatus === 'moved' ? 2 : row.RecentStatus === 'changed' ? 1 : 0;
  return statusWeight(b) - statusWeight(a) || bTime - aTime || String(a.Name).localeCompare(String(b.Name));
}

function renderFeedCard(row) {
  const status = row.RecentStatus ? `<small class="feed-status ${html(row.RecentStatus)}">${html(row.RecentStatus)}</small>` : '';
  return `<article class="feed-card ${row.RecentStatus ? 'is-' + html(row.RecentStatus) : ''}">
    <div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div>
    <div class="feed-main"><div class="feed-title-line"><strong title="${html(row.Name)}">${html(row.Name)}</strong>${status}</div><span>${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)}</span><div class="feed-stats">${STAT_KEYS.map((key) => `<em>${STAT_LABELS[key]} ${row[key] || 0}</em>`).join('')}</div><div class="feed-tags">${TAGS.map((tag) => `<button type="button" class="${row.Tag === tag.value ? 'is-active' : ''}" title="${html(tag.label)}" data-id="${html(row.Id)}" data-feed-tag="${html(tag.value)}">${tag.emoji}</button>`).join('')}</div></div>
  </article>`;
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
