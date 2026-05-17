import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS } from '../constants.js';
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
  const groupLabel = row.Dupe_Group || row.Group || '';
  const groupActionKey = row.GroupActionKey || `${row.GroupKey || ''}::${groupLabel}`;
  const group = row.Is_Dupe ? `<div class="group-badge ${row.GroupColor || ''}" title="Duplicate group ${html(groupLabel)}"><span>⚠️</span>${row.Is_Dupe_Exotic ? iconImg(RARITY_ICONS.Exotic, 'Exotic duplicate group', 'badge-icon') : ''}${html(groupLabel)}</div>` : '';
  const action = actionLabel(row);
  return `<article class="armor-card ${safeClass(row.Rarity)} ${row.Is_Dupe ? 'is-grouped is-dupe ' + row.GroupColor : ''}" data-card-id="${html(row.Id)}" data-group="${html(groupLabel)}">
    ${badge ? `<button class="light-tag-badge" type="button" data-tag-trigger data-id="${html(row.Id)}">${badge}</button>` : ''}
    ${group}
    <div class="card-top">
      <div class="item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}</div>
      <div class="item-title"><h3 title="${html(row.Name)}">${html(row.Name)}</h3><p class="identifier-icons">${identifierLine(row)}</p></div>
    </div>
    <div class="card-grid-3x3">
      <div><span>Total</span><strong>${row.Total || 0}</strong></div>
      <div><span>Tier</span><strong class="diamonds">${diamonds(row.Tier, row.TierMax)}</strong></div>
      <div><span>Arch</span><strong title="${html(row.Archetype || '—')}">${html(row.Archetype || '—')}</strong></div>
      ${STAT_KEYS.map((key) => `<div class="stat-cell stat-${key.toLowerCase()}" title="${html(STAT_LABELS[key])}: ${row[key] || 0}"><span class="stat-icon-only"><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"></span><strong>${row[key] || 0}</strong></div>`).join('')}
    </div>
    <div class="card-actions">
      <button type="button" data-action-id="${html(row.Id)}" ${canRunAction(row) ? '' : 'disabled'}>${html(action)}</button>
      ${row.Is_Dupe ? `<button type="button" data-action-id="group:${html(groupActionKey)}">Copy group</button>` : ''}
    </div>
    <div class="tag-strip" aria-label="Tag ${html(row.Name)}">${TAGS.filter((tag) => tag.value !== 'feed').map((tag) => `<button type="button" class="tag-dot ${row.Tag === tag.value ? 'is-active' : ''}" title="${html(tag.label)}" data-id="${html(row.Id)}" data-tag-choice="${html(tag.value)}">${tag.emoji}</button>`).join('')}</div>
  </article>`;
}

function identifierLine(row) {
  const loc = locationLabel(row);
  return [
    iconImg(CLASS_ICONS[row.Class], row.Class),
    maskIcon(SLOT_ICONS[row.Slot], row.Slot),
    iconImg(RARITY_ICONS[row.Rarity], row.Rarity),
    `<span class="location-pill" title="${html(loc)}">${LOCATION_EMOJIS[loc] || LOCATION_EMOJIS.Character || '🎒'} ${html(loc)}</span>`,
    row.RecentStatus ? `<span class="status-pill">${html(row.RecentStatus)}</span>` : ''
  ].filter(Boolean).join('');
}
function badgeText(row) {
  const parts = [];
  if (row.Power || row.Light) parts.push(row.Power || row.Light);
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  if (tag) parts.push(tag.emoji);
  return parts.join(' • ');
}
function locationLabel(row) {
  if (row.Source !== 'Bungie') return 'DIM';
  return row.IsInVault ? 'Vault' : row.IsEquipped ? 'Equipped' : 'Inventory';
}
function iconImg(src, label, className = 'meta-icon') {
  return src ? `<img class="${html(className)}" src="${html(src)}" alt="${html(label || '')}" title="${html(label || '')}" loading="lazy">` : '';
}
function maskIcon(src, label) {
  return src ? `<span class="meta-mask" style="--icon:url('${html(src)}')" title="${html(label || '')}" aria-label="${html(label || '')}"></span>` : '';
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
