import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS } from '../constants.js';
import { ACTIVE_FEED_LIMIT, getActiveFeedRows } from '../data/feed-state.js';

export function renderItemFeed(container, countEl, rows, onTag, onDismissNew, onCompareGroup) {
  const newlyFound = getActiveFeedRows(rows);
  countEl.textContent = String(newlyFound.length);
  ensureFeedRefreshIndicator(countEl);
  container.dataset.feedMode = 'new';
  container.innerHTML = newlyFound.length ? newlyFound.map((row) => renderFeedCard(row)).join('') : renderEmptyFeed(rows.length);
  container.querySelectorAll('[data-feed-tag]').forEach((button) => button.addEventListener('click', () => onTag(button.dataset.id, button.dataset.feedTag)));
  container.querySelectorAll('[data-dismiss-new]').forEach((button) => button.addEventListener('click', () => onDismissNew?.(button.dataset.id)));
  container.querySelectorAll('[data-feed-compare-group]').forEach((button) => button.addEventListener('click', () => onCompareGroup?.(button.dataset.feedCompareGroup)));
}

function ensureFeedRefreshIndicator(countEl) {
  const head = countEl?.closest?.('.feed-head');
  if (!head || head.querySelector('.feed-refresh-indicator')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feed-refresh-indicator';
  button.title = 'Live feed checks every minute while this page is active';
  button.setAttribute('aria-label', 'Item feed live refresh status');
  button.innerHTML = '<span aria-hidden="true">↻</span>';
  countEl.before(button);
}

function renderEmptyFeed(loadedCount = 0) {
  if (loadedCount > 0) return `<div class="feed-empty"><strong>No newly obtained armor.</strong><br><span>New drops stay here until dismissed, tagged, or outside the latest ${ACTIVE_FEED_LIMIT} new items.</span></div>`;
  return `<div class="feed-empty"><strong>No armor loaded yet.</strong><br><span>Sync with Bungie or upload a DIM CSV to populate the item feed.</span></div>`;
}

function renderFeedCard(row) {
  const groupLabel = row.Dupe_Group || row.Group || '';
  const groupKey = row.GroupActionKey || '';
  const loc = locationLabel(row);
  const groupButton = row.Is_Dupe ? `<button type="button" class="feed-group-badge ${row.GroupColor || ''}" title="Compare duplicate group ${html(groupLabel)}" data-feed-compare-group="${html(groupKey)}">${html(groupLabel)}</button>` : '';
  const dismiss = `<button type="button" class="feed-dismiss-new" data-id="${html(row.Id)}" data-dismiss-new title="Dismiss from feed" aria-label="Dismiss ${html(row.Name)} from item feed">×</button>`;
  const identityRail = `<span class="feed-identity-rail" aria-label="${html(`${row.Class} ${row.Slot} ${row.Rarity} ${loc}`)}">${iconImg(CLASS_ICONS[row.Class], row.Class)}${maskIcon(SLOT_ICONS[row.Slot], row.Slot)}${iconImg(RARITY_ICONS[row.Rarity], row.Rarity)}${locationIcon(loc)}</span>`;
  const tierRail = tierIndicator(row);
  const tagButton = `<button class="card-tag-slot feed-card-tag ${row.Tag ? 'has-tag' : 'is-empty'}" type="button" data-tag-trigger data-id="${html(row.Id)}" title="${html(tagTitle(row))}">${tagEmoji(row)}</button>`;
  const age = feedTimeLabel(row);
  const foundText = age ? ` · Found ${age} ago` : '';
  return `<article class="feed-card is-new is-new-found ${row.Is_Dupe ? `is-feed-grouped ${row.GroupColor || ''}` : ''}" data-feed-card-id="${html(row.Id)}" data-card-id="${html(row.Id)}" data-feed-group="${html(groupLabel)}" title="${html(`${row.Name}${foundText}`)}">
    ${dismiss}${groupButton}${tagButton}
    <div class="feed-media"><div class="feed-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}${row.Power || row.Light ? `<b>${row.Power || row.Light}</b>` : ''}</div><div class="feed-rail-pack">${identityRail}${tierRail}</div></div>
    <div class="feed-main"><div class="feed-title-line"><strong title="${html(row.Name)}">${html(row.Name)}</strong></div><div class="feed-stats">${STAT_KEYS.map((key) => statChip(row, key)).join('')}</div></div>
  </article>`;
}

function tierIndicator(row) {
  const tier = Math.max(0, Math.min(5, Number(row.Tier || 0)));
  if (!tier) return '<span class="feed-tier-rail is-empty" title="No tier rating" aria-label="No tier rating"></span>';
  return `<span class="feed-tier-rail" title="Tier ${tier}" aria-label="Tier ${tier}">${Array.from({ length: tier }, () => '<i class="is-filled"></i>').join('')}</span>`;
}

function feedTimeLabel(row) {
  const value = Number(row.ActivityAt || row.FoundAt || Date.parse(row.LastChangedAt || '') || 0);
  if (!value) return '';
  const diffMs = Date.now() - value;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function statChip(row, key) {
  const value = Number(row[key] || 0);
  const quality = statQuality(value);
  return `<em class="stat-quality-${quality}" title="${html(STAT_LABELS[key])}: ${value} · ${qualityLabel(quality)}"><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy">${value}</em>`;
}
function statQuality(value) { if (value >= 25) return 'perfect'; if (value >= 20) return 'great'; if (value >= 15) return 'good'; if (value >= 10) return 'okay'; if (value >= 5) return 'bad'; return 'poor'; }
function qualityLabel(value) { return ({ perfect: 'Perfect', great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', poor: 'Poor' })[value] || value; }
function tagEmoji(row) { const tag = TAGS.find((item) => item.value === row.Tag && item.value); return tag ? tag.emoji : '＋'; }
function tagTitle(row) { const tag = TAGS.find((item) => item.value === row.Tag && item.value); return tag ? `Tag: ${tag.label}` : 'Assign tag'; }
function locationLabel(row) { if (row.Source !== 'Bungie') return 'DIM'; return row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory'; }
function locationIcon(loc) { const emoji = LOCATION_EMOJIS[loc] || ''; return emoji ? `<span class="feed-rail-location" title="${html(loc)}" aria-label="${html(loc)}">${emoji}</span>` : ''; }
function iconImg(src, label) { return src ? `<img class="feed-rail-icon" src="${html(src)}" alt="${html(label || '')}" title="${html(label || '')}" loading="lazy">` : ''; }
function maskIcon(src, label) { return src ? `<span class="feed-rail-mask" style="--icon:url('${html(src)}')" title="${html(label || '')}" aria-label="${html(label || '')}"></span>` : ''; }
function html(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
