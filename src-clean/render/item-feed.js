import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS } from '../constants.js';

export function renderItemFeed(container, countEl, rows, onTag, onDismissNew) {
  const recent = rows.slice().sort(compareRecent).slice(0, 30);
  countEl.textContent = String(recent.length);
  container.innerHTML = recent.map(renderFeedCard).join('');
  container.querySelectorAll('[data-feed-tag]').forEach((button) => {
    button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag));
  });
  container.querySelectorAll('[data-dismiss-new]').forEach((button) => {
    button.addEventListener('click', () => onDismissNew?.(button.dataset.id));
  });
}

function compareRecent(a, b) {
  const aTime = Number(a.FoundAt || Date.parse(a.LastChangedAt || '') || 0);
  const bTime = Number(b.FoundAt || Date.parse(b.LastChangedAt || '') || 0);
  const statusWeight = (row) => row.RecentStatus === 'new' || row.Tag === 'feed' ? 3 : row.RecentStatus === 'moved' ? 2 : row.RecentStatus === 'changed' ? 1 : 0;
  return statusWeight(b) - statusWeight(a) || bTime - aTime || String(a.Name).localeCompare(String(b.Name));
}

function renderFeedCard(row) {
  const feedNew = row.RecentStatus === 'new' || row.Tag === 'feed';
  const statusText = feedNew ? 'new' : row.RecentStatus || '';
  const status = statusText ? `<small class="feed-status ${html(statusText)}">${feedNew ? '✨ ' : ''}${html(statusText)}</small>` : '';
  const dismiss = feedNew ? `<button type="button" class="feed-dismiss-new" data-id="${html(row.Id)}" data-dismiss-new title="Dismiss new marker" aria-label="Dismiss new marker for ${html(row.Name)}">×</button>` : '';
  const loc = locationLabel(row);
  const tagButtons = TAGS.filter((tag) => tag.picker && tag.value).map((tag) => `<button type="button" class="feed-tag-btn ${row.Tag === tag.value ? 'is-active' : ''}" title="${html(row.Tag === tag.value ? `Remove ${tag.label}` : tag.label)}" aria-label="${html(row.Tag === tag.value ? `Remove ${tag.label}` : `Tag ${row.Name} as ${tag.label}`)}" data-id="${html(row.Id)}" data-feed-tag="${html(tag.value)}"><span>${tag.emoji}</span></button>`).join('');
  return `<article class="feed-card ${statusText ? 'is-' + html(statusText) : ''} ${feedNew ? 'is-new-found' : ''}">
    ${dismiss}
    <div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}${feedNew ? '<i class="feed-new-spark">✨</i>' : ''}</div>
    <div class="feed-main"><div class="feed-title-line"><strong title="${html(row.Name)}">${html(row.Name)}</strong>${status}</div><span class="feed-meta-icons">${iconImg(CLASS_ICONS[row.Class], row.Class)}${maskIcon(SLOT_ICONS[row.Slot], row.Slot)}${iconImg(RARITY_ICONS[row.Rarity], row.Rarity)}${LOCATION_EMOJIS[loc] || ''} ${html(row.Class)} • ${html(row.Slot)} • ${html(row.Rarity)}</span><div class="feed-stats">${STAT_KEYS.map((key) => `<em><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy">${row[key] || 0}</em>`).join('')}</div><div class="feed-tags">${tagButtons}</div></div>
  </article>`;
}
function locationLabel(row) {
  if (row.Source !== 'Bungie') return 'DIM';
  return row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
}
function iconImg(src, label) {
  return src ? `<img class="meta-icon" src="${html(src)}" alt="${html(label || '')}" title="${html(label || '')}" loading="lazy">` : '';
}
function maskIcon(src, label) {
  return src ? `<span class="meta-mask" style="--icon:url('${html(src)}')" title="${html(label || '')}" aria-label="${html(label || '')}"></span>` : '';
}
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
