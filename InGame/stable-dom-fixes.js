import { state, subscribe } from '../src-clean/state.js';
import { TAGS, STAT_KEYS, STAT_LABELS, STAT_ICONS } from '../src-clean/constants.js';

const TAG_BY_LABEL = new Map(TAGS.map((tag) => [String(tag.label || '').trim(), tag]));
const TAG_BY_VALUE = new Map(TAGS.map((tag) => [String(tag.value || '').trim(), tag]));
const ARCHETYPE_ICON_CACHE = new Map();
const BONUS_ORDER = ['masterwork', 'mod', 'artifice', 'other'];
let queued = false;
let feedPopoutPortal = null;
let activeFeedWrap = null;
let hideFeedPopoutTimer = null;

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    rebuildArchetypeIconCache();
    fixTagChips();
    fixFeedTiers();
    fixFeedStatPopouts();
    fixArchetypeIcons();
    fixSetBonuses();
    cleanTooltipTitles();
  });
}

function rowById(id) {
  return state.rows.find((item) => String(item.Id) === String(id));
}

function rebuildArchetypeIconCache() {
  ARCHETYPE_ICON_CACHE.clear();
  for (const row of state.rows || []) {
    const key = normalize(row.Archetype);
    if (!key || !row.ArchetypeIcon) continue;
    ARCHETYPE_ICON_CACHE.set(key, row.ArchetypeIcon);
  }
}

function fixTagChips() {
  document.querySelectorAll('.tag-chip').forEach((chip) => {
    const id = chip.dataset.id;
    const row = id ? rowById(id) : null;
    const tagValue = row?.Tag || state.tags?.[id] || '';
    const found = TAG_BY_VALUE.get(String(tagValue)) || TAG_BY_LABEL.get(String(chip.textContent || '').trim());
    if (!found || !found.emoji) return;
    chip.textContent = found.emoji;
    chip.title = found.label || found.value || 'Tag';
    chip.setAttribute('aria-label', found.label || found.value || 'Tag');
  });
}

function fixFeedTiers() {
  document.querySelectorAll('.feed-card[data-id]').forEach((card) => {
    if (card.querySelector('.feed-tier-rail')) return;
    const row = rowById(card.dataset.id);
    const img = card.querySelector(':scope > img');
    if (!row || !img) return;
    const wrap = document.createElement('span');
    wrap.className = 'feed-icon-wrap';
    wrap.tabIndex = 0;
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    const rail = document.createElement('span');
    rail.className = 'tier-rail feed-tier-rail';
    rail.innerHTML = tierMarks(row);
    wrap.appendChild(rail);
  });
}

function fixFeedStatPopouts() {
  ensureFeedPopoutPortal();
  document.querySelectorAll('.feed-card[data-id]').forEach((card) => {
    const row = rowById(card.dataset.id);
    const wrap = card.querySelector('.feed-icon-wrap');
    if (!row || !wrap) return;
    wrap.tabIndex = 0;
    wrap.dataset.feedPopoutId = String(row.Id);
    wrap.dataset.tooltipKey = feedTooltipKey(row);
    wrap.setAttribute('aria-label', `${displayName(row)} details`);
    wrap.querySelector(':scope > .feed-stat-popout')?.remove();
    if (wrap.dataset.popoutBound === '1') return;
    wrap.dataset.popoutBound = '1';
    wrap.addEventListener('pointerenter', () => showFeedPopout(wrap));
    wrap.addEventListener('pointerleave', queueHideFeedPopout);
    wrap.addEventListener('focus', () => showFeedPopout(wrap));
    wrap.addEventListener('blur', queueHideFeedPopout);
  });
}

function ensureFeedPopoutPortal() {
  if (feedPopoutPortal && document.body.contains(feedPopoutPortal)) return feedPopoutPortal;
  feedPopoutPortal = document.createElement('div');
  feedPopoutPortal.className = 'feed-stat-popout feed-stat-popout-portal';
  feedPopoutPortal.hidden = true;
  feedPopoutPortal.addEventListener('pointerenter', () => clearTimeout(hideFeedPopoutTimer));
  feedPopoutPortal.addEventListener('pointerleave', queueHideFeedPopout);
  document.body.appendChild(feedPopoutPortal);
  window.addEventListener('scroll', () => activeFeedWrap && positionFeedPopout(activeFeedWrap), true);
  window.addEventListener('resize', () => activeFeedWrap && positionFeedPopout(activeFeedWrap));
  return feedPopoutPortal;
}

function showFeedPopout(wrap) {
  const row = rowById(wrap.dataset.feedPopoutId);
  if (!row) return;
  const portal = ensureFeedPopoutPortal();
  clearTimeout(hideFeedPopoutTimer);
  activeFeedWrap = wrap;
  portal.dataset.tooltipKey = wrap.dataset.tooltipKey || feedTooltipKey(row);
  portal.innerHTML = renderFeedPopout(row);
  portal.hidden = false;
  portal.classList.add('is-visible');
  positionFeedPopout(wrap);
}

function queueHideFeedPopout() {
  clearTimeout(hideFeedPopoutTimer);
  hideFeedPopoutTimer = setTimeout(() => {
    if (!feedPopoutPortal) return;
    feedPopoutPortal.classList.remove('is-visible');
    feedPopoutPortal.hidden = true;
    activeFeedWrap = null;
  }, 80);
}

function positionFeedPopout(wrap) {
  const portal = ensureFeedPopoutPortal();
  if (portal.hidden) return;
  const rect = wrap.getBoundingClientRect();
  const width = Math.min(330, Math.max(290, window.innerWidth - 24));
  portal.style.setProperty('width', `${width}px`, 'important');
  const height = portal.offsetHeight || 230;
  const gap = 12;
  const leftPreferred = rect.left - width - gap;
  const leftFallback = rect.right + gap;
  const useLeftSide = leftPreferred >= 8;
  const left = useLeftSide ? leftPreferred : Math.min(window.innerWidth - width - 8, leftFallback);
  const top = Math.max(8, Math.min(window.innerHeight - height - 8, rect.top + rect.height / 2 - height / 2));
  portal.classList.toggle('is-left-of-icon', useLeftSide);
  portal.classList.toggle('is-right-of-icon', !useLeftSide);
  portal.style.setProperty('left', `${Math.max(8, left)}px`, 'important');
  portal.style.setProperty('top', `${top}px`, 'important');
  portal.style.setProperty('right', 'auto', 'important');
  portal.style.setProperty('bottom', 'auto', 'important');
  portal.style.setProperty('transform', 'none', 'important');
}

function renderFeedPopout(row) {
  const name = esc(displayName(row));
  const rarity = esc(row.Rarity || 'Legendary');
  const slot = esc(row.Slot || row.Type || 'Armor');
  const power = esc(row.Power || row.Light || '');
  const archetypeIcon = row.ArchetypeIcon || ARCHETYPE_ICON_CACHE.get(normalize(row.Archetype)) || '';
  const archetype = esc(row.Archetype || '—');
  return `<span class="feed-popout-head"><strong>${name}</strong><em>${rarity} ${slot}${power ? ` · ${power}` : ''}</em></span>
    <span class="feed-popout-body">
      <span class="feed-popout-side"><span class="feed-popout-archetype">${archetypeIcon ? `<img src="${esc(archetypeIcon)}" alt="" loading="lazy">` : '<b>◇</b>'}<span>${archetype}</span></span></span>
      <span class="feed-popout-stats">${STAT_KEYS.map((key) => renderTooltipStat(row, key)).join('')}${renderTooltipTotal(row)}</span>
    </span>`;
}

function renderTooltipStat(row, key) {
  const base = num(row[`Base${key}`] ?? row[key]);
  const current = num(row[`Current${key}`] ?? row[key]);
  const parts = bonusParts(row, key);
  const label = esc(STAT_LABELS[key] || key);
  return `<span class="feed-popout-stat" title="${label}: base ${base}${parts.length ? `, ${parts.map((part) => `+${part.value} ${part.type}`).join(', ')}` : ''}"><img src="${esc(STAT_ICONS[key] || '')}" alt="${label}"><span class="bar"><span class="bar-base" style="width:${Math.min(100, base)}%"></span>${renderBonusSegments(base, parts)}</span><b>${pad(current)}</b></span>`;
}

function renderBonusSegments(base, parts) {
  let left = Math.min(100, base);
  return parts.map((part) => {
    const width = Math.max(0, Math.min(100 - left, part.value));
    const html = `<span class="bar-bonus bonus-${esc(part.type)}" title="+${part.value} ${esc(part.type)}" style="left:${left}%;width:${width}%"></span>`;
    left += width;
    return html;
  }).join('');
}

function renderTooltipTotal(row) {
  const base = num(row.BaseTotal ?? row.Total);
  const parts = totalBonusParts(row);
  return `<span class="feed-popout-total"><span>Total</span><b><span class="base-total">${base}</span>${parts.map((part) => `<span class="bonus-total bonus-${esc(part.type)}">+${part.value}</span>`).join('')}</b></span>`;
}

function bonusParts(row, key) {
  const fallback = num(row[`StatBonus${key}`]);
  const parts = BONUS_ORDER.map((type) => ({ type, value: num(row[`${cap(type)}Bonus${key}`]) })).filter((part) => part.value > 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}

function totalBonusParts(row) {
  const fallback = num(row.StatBonusTotal ?? Math.max(0, num(row.CurrentTotal) - num(row.BaseTotal)));
  const parts = BONUS_ORDER.map((type) => ({
    type,
    value: num(row[`${cap(type)}BonusTotal`]) || STAT_KEYS.reduce((sum, key) => sum + num(row[`${cap(type)}Bonus${key}`]), 0)
  })).filter((part) => part.value > 0);
  const known = parts.reduce((sum, part) => sum + part.value, 0);
  if (fallback > known) parts.push({ type: 'other', value: fallback - known });
  if (!parts.length && fallback > 0) parts.push({ type: 'other', value: fallback });
  return parts;
}

function feedTooltipKey(row) {
  return [row.Id, row.BaseTotal, row.CurrentTotal, row.StatBonusTotal, row.Archetype, row.ArchetypeIcon, STAT_KEYS.map((key) => `${row[`Base${key}`] ?? row[key]}:${row[`Current${key}`] ?? row[key]}:${row[`StatBonus${key}`] ?? ''}`).join(',')].join('|');
}

function fixArchetypeIcons() {
  document.querySelectorAll('.armor-card[data-id]').forEach((card) => {
    const row = rowById(card.dataset.id);
    if (!row) return;
    const iconUrl = row.ArchetypeIcon || ARCHETYPE_ICON_CACHE.get(normalize(row.Archetype));
    if (!iconUrl) return;
    const wrap = card.querySelector('.archetype-icon-wrap');
    if (!wrap || wrap.querySelector('img')) return;
    const oldFallback = Array.from(wrap.childNodes).find((node) => node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('d2-tooltip'));
    if (oldFallback) oldFallback.remove();
    wrap.insertAdjacentHTML('afterbegin', `<img class="archetype-img" src="${esc(iconUrl)}" alt="" loading="lazy">`);
  });
}

function fixSetBonuses() {
  document.querySelectorAll('.armor-card[data-id]').forEach((card) => {
    const row = rowById(card.dataset.id);
    if (!row) return;
    const container = card.querySelector('.bonus-icons');
    if (!container) return;
    const bonuses = extractSetBonuses(row);
    const currentKey = bonuses.map((perk) => perk.hash || perk.name || perk.description || '').join('|') || 'none';
    if (container.dataset.setFixedKey === currentKey) return;
    container.querySelectorAll('.is-set-bonus[data-set-hash]').forEach((node) => node.remove());
    container.dataset.setFixedKey = currentKey;
    if (!bonuses.length) return;
    container.classList.remove('is-empty');
    container.insertAdjacentHTML('afterbegin', bonuses.slice(0, 4).map((perk) => bonusIcon(perk)).join(''));
  });
}

function extractSetBonuses(row) {
  if (normalize(row.Rarity) === 'exotic') return [];
  const out = [];
  for (const value of [row.ArmorSetBonuses, row.SetBonuses]) {
    for (const perk of parsePerks(value)) {
      if (isExoticOrArchetypePerk(perk, row)) continue;
      if (looksLikeSetBonus([perk.name, perk.description, perk.label, perk.type, perk.category].filter(Boolean).join(' '))) out.push({ ...perk, kind: 'set', label: perk.label || setBonusLabel(`${perk.name || ''} ${perk.description || ''}`) });
    }
  }
  const plugs = [
    ...(Array.isArray(row.StatAudit?.activePlugs) ? row.StatAudit.activePlugs : []),
    ...(Array.isArray(row.SocketAudit?.activePlugs) ? row.SocketAudit.activePlugs : [])
  ];
  for (const plug of plugs) {
    if (isExoticOrArchetypePerk(plug, row)) continue;
    const text = [plug.name, plug.description, plug.type, plug.category, plug.label, JSON.stringify(plug.stats || [])].filter(Boolean).join(' ');
    if (!looksLikeSetBonus(text)) continue;
    out.push({ kind: 'set', label: setBonusLabel(text), name: plug.name || setBonusLabel(text), description: plug.description || plug.type || plug.category || 'Armor set bonus socket detected.', icon: plug.icon || '', hash: plug.hash || plug.name || text });
  }
  return uniquePerks(out.filter((perk) => perk && (perk.name || perk.description)));
}

function isExoticOrArchetypePerk(perk, row) {
  const text = normalize([perk?.name, perk?.description, perk?.label, perk?.type, perk?.category, perk?.kind].filter(Boolean).join(' '));
  const name = normalize(perk?.name);
  return normalize(row.Rarity) === 'exotic' || text.includes('exotic') || text.includes('intrinsic') || text.includes('archetype') || name === normalize(row.Name) || name === normalize(row.Archetype);
}

function looksLikeSetBonus(text) {
  const value = normalize(text);
  const hasSet = value.includes(' set ') || value.startsWith('set ') || value.includes('armor set') || value.includes('setbonus');
  const hasBonus = value.includes('bonus') || value.includes('perk') || value.includes('trait') || value.includes('pieces') || value.includes('piece');
  return (hasSet && hasBonus) || value.includes('set bonus') || value.includes('armor set bonus') || value.includes('2 piece') || value.includes('4 piece') || value.includes('two piece') || value.includes('four piece') || value.includes('wearing 2') || value.includes('wearing 4') || value.includes('while wearing') || value.includes('smokejumper');
}

function setBonusLabel(text) {
  const value = normalize(text);
  if (/\b2\b/.test(value) || value.includes('two')) return '2-Piece Set Bonus';
  if (/\b4\b/.test(value) || value.includes('four')) return '4-Piece Set Bonus';
  return 'Armor Set Bonus';
}

function uniquePerks(perks) {
  const seen = new Set();
  return perks.filter((perk) => {
    const key = `${perk.hash || ''}|${perk.name || ''}|${perk.description || ''}`.toLowerCase();
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanTooltipTitles() {
  document.querySelectorAll('.archetype-icon-wrap[title], .bonus-icon[title]').forEach((node) => node.removeAttribute('title'));
}

function tierMarks(row) {
  const max = 5;
  const tier = Math.max(0, Math.min(max, num(row.Tier || row.GearTier || 0)));
  const color = tier >= 5 ? 'gold' : tier >= 3 ? 'purple' : 'white';
  return Array.from({ length: max }, (_, i) => {
    const level = max - i;
    return `<span class="tier-mark tier-color-${color} ${level <= tier ? 'is-on' : ''}">◆</span>`;
  }).join('');
}

function bonusIcon(perk) {
  const name = esc(perk.name || perk.label || 'Armor Set Bonus');
  const label = esc(perk.label || 'Armor Set Bonus');
  const desc = esc(perk.description || 'Armor set bonus.');
  const hash = esc(perk.hash || perk.name || 'set');
  const icon = perk.icon ? `<img src="${esc(perk.icon)}" alt="" loading="lazy">` : '<span class="set-fallback-mark">◆</span>';
  return `<span class="bonus-icon is-set-bonus" data-set-hash="${hash}" tabindex="0" aria-label="${name}">${icon}<span class="d2-tooltip"><b>${name}</b><em>${label}</em><p>${desc}</p></span></span>`;
}

function parsePerks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function displayName(row) {
  const name = String(row.Name || '').trim();
  return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor');
}

function cap(value) {
  return String(value || '').replace(/^./, (char) => char.toUpperCase());
}

function pad(value) {
  return String(num(value)).padStart(2, ' ');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function num(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

subscribe(schedule);
schedule();
