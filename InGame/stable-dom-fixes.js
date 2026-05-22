import { state, subscribe } from '../src-clean/state.js';
import { TAGS } from '../src-clean/constants.js';

const TAG_BY_LABEL = new Map(TAGS.map((tag) => [String(tag.label || '').trim(), tag]));
const TAG_BY_VALUE = new Map(TAGS.map((tag) => [String(tag.value || '').trim(), tag]));
const ARCHETYPE_ICON_CACHE = new Map();
let queued = false;

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    rebuildArchetypeIconCache();
    fixTagChips();
    fixFeedTiers();
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
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    const rail = document.createElement('span');
    rail.className = 'tier-rail feed-tier-rail';
    rail.innerHTML = tierMarks(row);
    wrap.appendChild(rail);
  });
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
    out.push({
      kind: 'set',
      label: setBonusLabel(text),
      name: plug.name || setBonusLabel(text),
      description: plug.description || plug.type || plug.category || 'Armor set bonus socket detected.',
      icon: plug.icon || '',
      hash: plug.hash || plug.name || text
    });
  }
  return uniquePerks(out.filter((perk) => perk && (perk.name || perk.description)));
}

function isExoticOrArchetypePerk(perk, row) {
  const text = normalize([perk?.name, perk?.description, perk?.label, perk?.type, perk?.category, perk?.kind].filter(Boolean).join(' '));
  const name = normalize(perk?.name);
  return normalize(row.Rarity) === 'exotic'
    || text.includes('exotic')
    || text.includes('intrinsic')
    || text.includes('archetype')
    || name === normalize(row.Name)
    || name === normalize(row.Archetype);
}

function looksLikeSetBonus(text) {
  const value = normalize(text);
  const hasSet = value.includes(' set ') || value.startsWith('set ') || value.includes('armor set') || value.includes('setbonus');
  const hasBonus = value.includes('bonus') || value.includes('perk') || value.includes('trait') || value.includes('pieces') || value.includes('piece');
  return (hasSet && hasBonus)
    || value.includes('set bonus')
    || value.includes('armor set bonus')
    || value.includes('2 piece')
    || value.includes('4 piece')
    || value.includes('two piece')
    || value.includes('four piece')
    || value.includes('wearing 2')
    || value.includes('wearing 4')
    || value.includes('while wearing')
    || value.includes('smokejumper');
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
