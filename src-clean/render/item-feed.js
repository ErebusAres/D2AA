import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS } from '../constants.js';

const FEED_LIMIT = 20;

export function renderItemFeed(container, countEl, rows, onTag, onDismissNew, onCompareGroup) {
  const newlyFound = rows.slice().filter(isFeedCandidate).sort(compareRecent).slice(0, FEED_LIMIT);
  const showingFallback = newlyFound.length === 0;
  const feedRows = showingFallback ? latestSyncedRows(rows) : newlyFound;
  countEl.textContent = String(feedRows.length);
  container.innerHTML = feedRows.length ? feedRows.map((row) => renderFeedCard(row, showingFallback)).join('') : renderEmptyFeed();
  container.querySelectorAll('[data-feed-tag]').forEach((button) => {
    button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag));
  });
  container.querySelectorAll('[data-dismiss-new]').forEach((button) => {
    button.addEventListener('click', () => onDismissNew?.(button.dataset.id));
  });
  container.querySelectorAll('[data-feed-compare-group]').forEach((button) => {
    button.addEventListener('click', () => onCompareGroup?.(button.dataset.feedCompareGroup));
  });
}

function isFeedCandidate(row) {
  return row.RecentStatus === 'new' || row.RecentlyFound === true;
}

function latestSyncedRows(rows) {
  return rows.slice()
    .filter((row) => row && row.Id)
    .sort(compareLatestSynced)
    .slice(0, FEED_LIMIT);
}

function compareLatestSynced(a, b) {
  const timeDiff = recentTime(b) - recentTime(a);
  if (timeDiff) return timeDiff;
  const idDiff = compareInstanceIdsDesc(a.Id, b.Id);
  if (idDiff) return idDiff;
  return Number(b._index ?? 0) - Number(a._index ?? 0) || String(a.Name).localeCompare(String(b.Name));
}

function compareInstanceIdsDesc(a, b) {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  if (left.length !== right.length) return right.length - left.length;
  return right.localeCompare(left);
}

function digitsOnly(value) {
  return String(value || '').split('').filter((char) => char >= '0' && char <= '9').join('').replace(/^0+/, '');
}

function compareRecent(a, b) {
  const aTime = recentTime(a);
  const bTime = recentTime(b);
  return bTime - aTime || compareInstanceIdsDesc(a.Id, b.Id) || String(a.Name).localeCompare(String(b.Name));
}

function recentTime(row) {
  return Number(row.FoundAt || row.ActivityAt || Date.parse(row.LastChangedAt || '') || 0);
}

function renderEmptyFeed() {
  return `<div class="feed-empty"><strong>No armor loaded yet.</strong><br><span>Sync with Bungie or upload a DIM CSV to populate the item feed.</span></div>`;
}

function renderFeedCard(row, fallback = false) {
  const feedNew = !fallback;
  const groupLabel = row.Dupe_Group || row.Group || '';
  const groupKey = row.GroupActionKey || '';
  const groupButton = row.Is_Dupe ? `<button type="button" class="feed-group-badge ${row.GroupColor || ''}" title="Compare duplicate group ${html(groupLabel)}" data-feed-compare-group="${html(groupKey)}">${html(groupLabel)}</button>` : '';
  const dismiss = fallback ? '' : `<button type="button" class="feed-dismiss-new" data-id="${html(row.Id)}" data-dismiss-new title="Dismiss new marker" aria-label="Dismiss new marker for ${html(row.Name)}">×</button>`;
  const loc = locationLabel(row);
  const tagButton = `<button class="card-tag-slot feed-card-tag ${row.Tag ? 'has-tag' : 'is-empty'}" type="button" data-tag-trigger data-id="${html(row.Id)}" title="${html(tagTitle(row))}">${tagEmoji(row)}</button>`;
  return `<article class="feed-card ${feedNew ? 'is-new is-new-found' : 'is-latest'} ${row.Is_Dupe ? `is-feed-grouped ${row.GroupColor || ''}` : ''}" data-feed-card-id="${html(row.Id)}" data-card-id="${html(row.Id)}" data-feed-group="${html(groupLabel)}">
    ${dismiss}${groupButton}${tagButton}
    <div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}${feedNew ? '<i class="feed-new-spark">✨</i>' : ''}</div>
    <div class="feed-main"><div class="feed-title-line"><strong title="${html(row.Name)}">${html(row.Name)}</strong></div><span class="feed-meta-icons" aria-label="${html(`${row.Class} ${row.Slot} ${row.Rarity} ${loc}`)}">${iconImg(CLASS_ICONS[row.Class], row.Class)}${maskIcon(SLOT_ICONS[row.Slot], row.Slot)}${iconImg(RARITY_ICONS[row.Rarity], row.Rarity)}${locationIcon(loc)}</span><div class="feed-stats">${STAT_KEYS.map((key) => statChip(row, key)).join('')}</div></div>
  </article>`;
}
function statChip(row, key) {
  const value = Number(row[key] || 0);
  const quality = statQuality(value);
  return `<em class="stat-quality-${quality}" title="${html(STAT_LABELS[key])}: ${value} · ${qualityLabel(quality)}"><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy">${value}</em>`;
}
function statQuality(value) {
  if (value >= 25) return 'perfect';
  if (value >= 20) return 'great';
  if (value >= 15) return 'good';
  if (value >= 10) return 'okay';
  if (value >= 5) return 'bad';
  return 'poor';
}
function qualityLabel(value) {
  return ({ perfect: 'Perfect', great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', poor: 'Poor' })[value] || value;
}
function tagEmoji(row) {
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  return tag ? tag.emoji : '＋';
}
function tagTitle(row) {
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  return tag ? `Tag: ${tag.label}` : 'Assign tag';
}
function locationLabel(row) {
  if (row.Source !== 'Bungie') return 'DIM';
  return row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
}
function locationIcon(loc) {
  const emoji = LOCATION_EMOJIS[loc] || '';
  return emoji ? `<span class="feed-location-icon" title="${html(loc)}" aria-label="${html(loc)}">${emoji}</span>` : '';
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