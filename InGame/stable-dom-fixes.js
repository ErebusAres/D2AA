import { state, subscribe } from '../src-clean/state.js';
import { TAGS } from '../src-clean/constants.js';

const TAG_BY_LABEL = new Map(TAGS.map((tag) => [String(tag.label || '').trim(), tag]));
const TAG_BY_VALUE = new Map(TAGS.map((tag) => [String(tag.value || '').trim(), tag]));
let queued = false;

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    fixTagChips();
    fixStatusText();
    fixFeedTiers();
    fixSetBonuses();
  });
}

function rowById(id) {
  return state.rows.find((item) => String(item.Id) === String(id));
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

function fixStatusText() {
  const el = document.getElementById('statusText');
  if (!el) return;
  const text = String(el.textContent || '');
  if (/^Loaded Bungie cache:/i.test(text) && !text.includes('Click Sync')) {
    const next = `${text} Click Sync for live Bungie refresh.`;
    el.textContent = next;
    el.title = next;
  }
}

function fixFeedTiers() {
  document.querySelectorAll('.feed-card[data-id]').forEach((card) => {
    if (card.querySelector('.feed-tier-rail')) return;
    const row = rowById(card.dataset.id);
    const img = card.querySelector('img');
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

function fixSetBonuses() {
  document.querySelectorAll('.armor-card[data-id]').forEach((card) => {
    const row = rowById(card.dataset.id);
    if (!row) return;
    const bonuses = parsePerks(row.ArmorSetBonuses || row.SetBonuses);
    if (!bonuses.length) return;
    const container = card.querySelector('.bonus-icons');
    if (!container || container.dataset.setFixed === 'true') return;
    container.classList.remove('is-empty');
    const existing = new Set([...container.querySelectorAll('[data-set-hash]')].map((el) => el.dataset.setHash));
    const html = bonuses.slice(0, 4).filter((perk) => !existing.has(String(perk.hash || perk.name || 'set'))).map((perk) => bonusIcon(perk)).join('');
    if (!html) return;
    container.insertAdjacentHTML('afterbegin', html);
    container.dataset.setFixed = 'true';
  });
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
  return `<span class="bonus-icon is-set-bonus" data-set-hash="${hash}" tabindex="0" title="${name}: ${desc}">${icon}<span class="d2-tooltip"><b>${name}</b><em>${label}</em><p>${desc}</p></span></span>`;
}

function parsePerks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
