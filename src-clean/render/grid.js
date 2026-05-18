import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS, SLOT_ORDER, ARMOR_ARCHETYPES, ARCHETYPE_ALIASES } from '../constants.js';
import { actionLabel, canRunAction } from '../data/actions.js';

export function renderGrid(container, rows, onTag, onAction, onCompareGroup) {
  container.innerHTML = renderSlotSections(rows);
  container.querySelectorAll('[data-action-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onAction?.(button.dataset.actionId, button);
    });
  });
  container.querySelectorAll('[data-compare-group]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onCompareGroup?.(button.dataset.compareGroup);
    });
  });
}

function renderSlotSections(rows) {
  if (!rows.length) return '';
  const sections = groupBySlot(rows);
  return sections.map(([slot, items]) => `<section class="armor-slot-section" data-slot-section="${html(slot)}">
    <div class="slot-divider"><span class="slot-divider-icon">${maskIcon(SLOT_ICONS[slot], slot)}</span><strong>${html(slot)}</strong><em>${items.length}</em></div>
    <div class="slot-card-grid">${items.map(renderCard).join('')}</div>
  </section>`).join('');
}

function groupBySlot(rows) {
  const buckets = new Map();
  rows.forEach((row) => {
    const slot = row.Slot || row.Type || 'Other';
    if (!buckets.has(slot)) buckets.set(slot, []);
    buckets.get(slot).push(row);
  });
  const ordered = [];
  SLOT_ORDER.forEach((slot) => { if (buckets.has(slot)) ordered.push([slot, buckets.get(slot)]); });
  [...buckets.keys()].filter((slot) => !SLOT_ORDER.includes(slot)).sort().forEach((slot) => ordered.push([slot, buckets.get(slot)]));
  return ordered;
}

function renderCard(row) {
  const badge = lightBadgeText(row);
  const groupLabel = row.Dupe_Group || row.Group || '';
  const groupActionKey = row.GroupActionKey || `${row.GroupKey || ''}::${groupLabel}`;
  const isNew = row.RecentStatus === 'new' || row.Tag === 'feed';
  const group = row.Is_Dupe ? `<button type="button" class="group-badge ${row.GroupColor || ''}" title="Compare duplicate group ${html(groupLabel)}" data-compare-group="${html(groupActionKey)}">${row.Is_Dupe_Exotic ? iconImg(RARITY_ICONS.Exotic, 'Exotic duplicate group', 'badge-icon') : ''}${html(groupLabel)}</button>` : '';
  const newBadge = isNew ? `<div class="new-found-badge" title="Recently found">✨ New</div>` : '';
  const action = actionLabel(row);
  return `<article class="armor-card ${safeClass(row.Rarity)} ${isNew ? 'is-new-found' : ''} ${row.Is_Dupe ? 'is-grouped is-dupe ' + row.GroupColor : ''}" data-card-id="${html(row.Id)}" data-group="${html(groupLabel)}">
    ${badge ? `<button class="light-tag-badge light-only-badge" type="button" data-tag-trigger data-id="${html(row.Id)}">${badge}</button>` : ''}
    ${group}
    ${newBadge}
    <div class="card-top">
      <div class="item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}</div>
      <button class="card-tag-slot ${row.Tag ? 'has-tag' : 'is-empty'}" type="button" data-tag-trigger data-id="${html(row.Id)}" title="${html(tagTitle(row))}">${tagEmoji(row)}</button>
      <div class="item-title"><h3 title="${html(row.Name)}">${html(row.Name)}</h3><p class="identifier-icons">${identifierLine(row)}</p></div>
    </div>
    <div class="card-grid-3x3">
      <div><span>Total</span><strong>${row.Total || 0}</strong></div>
      <div><span>Tier</span><strong class="diamonds">${diamonds(row.Tier, row.TierMax)}</strong></div>
      <div class="arch-cell"><span>Arch</span>${archetypeIcon(row)}</div>
      ${STAT_KEYS.map((key) => statCell(row, key)).join('')}
    </div>
    <div class="card-actions">
      <button type="button" data-action-id="${html(row.Id)}" ${canRunAction(row) ? '' : 'disabled'}>${html(action)}</button>
      ${row.Is_Dupe ? `<button type="button" data-action-id="group:${html(groupActionKey)}">Pull group</button>` : ''}
    </div>
  </article>`;
}

function archetypeIcon(row) {
  const name = normalizeArchetypeName(row.Archetype);
  const meta = ARMOR_ARCHETYPES[name];
  const label = name || row.Archetype || 'Unknown archetype';
  const statLabel = meta?.stat ? STAT_LABELS[meta.stat] : '';
  const description = row.ArchetypeDescription ? ` — ${row.ArchetypeDescription}` : '';
  const title = `${label}${statLabel ? ` · ${statLabel}` : ''}${description}`;
  if (row.ArchetypeIcon) {
    return `<img class="arch-image arch-api arch-${safeClass(label)}" src="${html(row.ArchetypeIcon)}" alt="${html(label)}" title="${html(title)}" aria-label="${html(title)}" loading="lazy">`;
  }
  return `<span class="arch-missing" title="${html(`${label}${statLabel ? ` · ${statLabel}` : ''}. Real Bungie archetype image unavailable until a fresh Bungie sync provides ArchetypeIcon.`)}">—</span>`;
}
function normalizeArchetypeName(value) {
  return ARCHETYPE_ALIASES[String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')] || String(value || '').trim();
}

function statCell(row, key) {
  const value = Number(row[key] || 0);
  const quality = statQuality(value);
  return `<div class="stat-cell stat-${key.toLowerCase()} stat-quality-${quality}" title="${html(STAT_LABELS[key])}: ${value} · ${qualityLabel(quality)}"><span class="stat-icon-only"><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"></span><strong>${value}</strong></div>`;
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
function identifierLine(row) {
  const loc = locationLabel(row);
  return [
    iconImg(CLASS_ICONS[row.Class], row.Class),
    maskIcon(SLOT_ICONS[row.Slot], row.Slot),
    iconImg(RARITY_ICONS[row.Rarity], row.Rarity),
    `<span class="location-pill" title="${html(loc)}">${LOCATION_EMOJIS[loc] || LOCATION_EMOJIS.Character || '🎒'} ${html(loc)}</span>`,
    row.RecentStatus ? `<span class="status-pill ${row.RecentStatus === 'new' ? 'is-new' : ''}">${row.RecentStatus === 'new' ? '✨ ' : ''}${html(row.RecentStatus)}</span>` : ''
  ].filter(Boolean).join('');
}
function lightBadgeText(row) {
  return row.Power || row.Light || '';
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