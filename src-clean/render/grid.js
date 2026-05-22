import { STAT_KEYS, STAT_LABELS, STAT_ICONS, RARITY_ICONS, CLASS_ICONS, SLOT_ICONS, LOCATION_EMOJIS, TAGS, SLOT_ORDER, ARMOR_ARCHETYPES, ARCHETYPE_ALIASES } from '../constants.js';
import { actionLabel, canRunAction } from '../data/actions.js';

export function renderGrid(container, rows, onTag, onAction, onCompareGroup) {
  container.innerHTML = renderSlotSections(rows);
  container.querySelectorAll('[data-tag-trigger]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      onTag?.(button.dataset.id);
    });
  });
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
  const isNew = row.RecentStatus === 'new' || row.RecentlyFound === true || row.Tag === 'feed';
  const group = row.Is_Dupe ? `<button type="button" class="group-badge ${row.GroupColor || ''}" title="Compare duplicate group ${html(groupLabel)}" data-compare-group="${html(groupActionKey)}">${row.Is_Dupe_Exotic ? iconImg(RARITY_ICONS.Exotic, 'Exotic duplicate group', 'badge-icon') : ''}${html(groupLabel)}</button>` : '';
  const tagControl = `<button class="card-tag-slot card-tag-badge ${row.Tag ? 'has-tag' : 'is-empty'} ${isNew ? 'is-new-context' : ''}" type="button" data-tag-trigger data-id="${html(row.Id)}" title="${html(tagTitle(row, isNew))}">${tagEmoji(row, isNew)}</button>`;
  const action = actionLabel(row);
  const loc = locationLabel(row);
  return `<article class="armor-card ${safeClass(row.Rarity)} ${isNew ? 'is-new-found' : ''} ${row.Is_Dupe ? 'is-grouped is-dupe ' + row.GroupColor : ''}" data-card-id="${html(row.Id)}" data-group="${html(groupLabel)}">
    ${badge ? `<button class="light-tag-badge light-only-badge" type="button" data-tag-trigger data-id="${html(row.Id)}">${badge}</button>` : ''}
    ${tagControl}
    ${group}
    <div class="card-top card-top-v151">
      <div class="item-icon">${row.Icon ? `<img src="${html(row.Icon)}" alt="" loading="lazy">` : '<span>◇</span>'}</div>
      <div class="identity-stack" aria-label="Item identity">
        ${iconImg(CLASS_ICONS[row.Class], row.Class, 'identity-icon')}
        ${maskIcon(SLOT_ICONS[row.Slot], row.Slot)}
        ${iconImg(RARITY_ICONS[row.Rarity], row.Rarity, 'identity-icon')}
      </div>
      <div class="item-title-block">
        <h3 title="${html(row.Name)}">${html(row.Name)}</h3>
        <div class="item-location-row">
          <span class="location-pill" title="${html(loc)}">${LOCATION_EMOJIS[loc] || LOCATION_EMOJIS.Character || '🎒'} ${html(loc)}</span>
        </div>
      </div>
    </div>
    <div class="card-grid-3x3">
      <div><span>Total</span><strong>${row.Total || 0}</strong></div>
      <div class="tier-cell"><span>Tier</span><strong class="diamonds" title="Tier ${html(row.Tier || 0)}">${diamonds(row.Tier, row.TierMax)}</strong></div>
      <div class="arch-cell">${archetypeIcon(row)}</div>
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

const STAT_QUALITY_STYLE = {
  perfect: { text: '#ffe58a', border: 'rgba(255,213,72,.62)', top: 'rgba(255,203,52,.18)', bottom: 'rgba(118,80,0,.12)', wash: 'rgba(255,225,110,.16)', glow: 'rgba(255,196,0,.18)', line: '#ffd84d', weight: 1000 },
  near: { text: '#9ff5ff', border: 'rgba(70,219,245,.54)', top: 'rgba(70,219,245,.13)', bottom: 'rgba(0,83,103,.12)', wash: 'rgba(70,219,245,.12)', glow: 'rgba(70,219,245,.13)', line: '#55e7ff', weight: 955 },
  great: { text: '#72a6ff', border: 'rgba(88,126,255,.58)', top: 'rgba(64,88,210,.135)', bottom: 'rgba(24,34,116,.11)', wash: 'rgba(88,126,255,.10)', glow: 'rgba(88,126,255,.08)', line: '#5f83ff', weight: 930 },
  good: { text: '#8bf0a4', border: 'rgba(78,211,113,.38)', top: 'rgba(78,211,113,.10)', bottom: 'rgba(20,80,42,.12)', wash: 'rgba(78,211,113,.08)', glow: 'rgba(78,211,113,.08)', line: '#54d77b', weight: 880 },
  okay: { text: '#c8beb0', border: 'rgba(190,178,157,.22)', top: 'rgba(190,178,157,.055)', bottom: 'rgba(40,39,45,.10)', wash: 'rgba(190,178,157,.035)', glow: 'transparent', line: 'rgba(190,178,157,.42)', weight: 820 },
  bad: { text: '#ffa269', border: 'rgba(222,111,45,.34)', top: 'rgba(222,111,45,.09)', bottom: 'rgba(91,38,16,.12)', wash: 'rgba(222,111,45,.07)', glow: 'rgba(222,111,45,.08)', line: '#e8793f', weight: 800 },
  poor: { text: '#ff7182', border: 'rgba(213,58,82,.38)', top: 'rgba(213,58,82,.105)', bottom: 'rgba(71,15,27,.16)', wash: 'rgba(213,58,82,.075)', glow: 'rgba(213,58,82,.08)', line: '#e0445b', weight: 790 }
};

function statCell(row, key) {
  const value = Number(row[key] || 0);
  const quality = statQuality(value);
  const style = qualityInlineStyle(quality);
  const numberStyle = `color:${STAT_QUALITY_STYLE[quality]?.text || '#f5f1df'}!important;font-weight:${STAT_QUALITY_STYLE[quality]?.weight || 900}!important;`;
  return `<div class="stat-cell stat-${key.toLowerCase()} stat-quality-${quality}" style="${style}" data-stat-quality="${quality}" title="${html(STAT_LABELS[key])}: ${value} · ${qualityLabel(quality)}"><span class="stat-icon-only"><img class="stat-icon" src="${html(STAT_ICONS[key])}" alt="${html(STAT_LABELS[key])}" loading="lazy"></span><strong style="${numberStyle}">${value}</strong></div>`;
}
function qualityInlineStyle(quality) {
  const item = STAT_QUALITY_STYLE[quality] || STAT_QUALITY_STYLE.okay;
  return [
    `--stat-text:${item.text}`,
    `--stat-border:${item.border}`,
    `--stat-bg-top:${item.top}`,
    `--stat-bg-bottom:${item.bottom}`,
    `--stat-wash:${item.wash}`,
    `--stat-glow:${item.glow}`,
    `--stat-weight:${item.weight}`,
    `--bal-number:${item.text}`,
    `--bal-border:${item.border}`,
    `--bal-top:${item.top}`,
    `--bal-bottom:${item.bottom}`,
    `--bal-pop:${item.wash}`,
    `--bal-line:${item.line}`,
    `color:${item.text}!important`,
    `border-color:${item.border}!important`,
    `background:radial-gradient(circle at 70% 12%,${item.wash},transparent 55%),linear-gradient(180deg,${item.top},${item.bottom}),#171824!important`
  ].join(';');
}
function statQuality(value) {
  if (value >= 30) return 'perfect';
  if (value >= 28) return 'near';
  if (value >= 24) return 'great';
  if (value >= 18) return 'good';
  if (value >= 12) return 'okay';
  if (value >= 6) return 'bad';
  return 'poor';
}
function qualityLabel(value) {
  return ({ perfect: 'Perfect', near: 'Near-perfect', great: 'Great', good: 'Good', okay: 'Okay', bad: 'Bad', poor: 'Poor' })[value] || value;
}
function lightBadgeText(row) {
  return row.Power || row.Light || '';
}
function tagEmoji(row, isNew = false) {
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  if (tag) return tag.emoji;
  return isNew ? '✨' : '＋';
}
function tagTitle(row, isNew = false) {
  const tag = TAGS.find((item) => item.value === row.Tag && item.value);
  if (tag) return `Tag: ${tag.label}`;
  return isNew ? 'New item — assign tag' : 'Assign tag';
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
  return '◆'.repeat(n);
}
function safeClass(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-'); }
function html(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
