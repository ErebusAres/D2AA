import { state, subscribe } from '../src-clean/state.js';

let queued = false;

function scheduleRender() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    renderArmorBonusRows();
  });
}

function renderArmorBonusRows() {
  const rowsById = new Map((state.rows || []).map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id], .compare-card[data-id]').forEach((card) => {
    const row = rowsById.get(String(card.dataset.id));
    if (!row) return;
    const side = card.querySelector('.card-side, .compare-card-side');
    if (!side) return;
    const bonuses = strictBonuses(row);
    side.querySelector(':scope > .set-bonus-list')?.remove();
    side.querySelector(':scope > .bonus-icons')?.classList.remove('is-replaced-by-set-rows');
    if (!bonuses.length) return;
    const oldIconArea = side.querySelector(':scope > .bonus-icons');
    oldIconArea?.classList.add('is-replaced-by-set-rows');
    side.insertAdjacentHTML('beforeend', `<div class="set-bonus-list" aria-label="Armor set bonuses">${bonuses.slice(0, 4).map(renderBonusRow).join('')}</div>`);
  });
}

function strictBonuses(row) {
  const source = isExotic(row) ? strictExoticBonuses(row) : strictSetBonuses(row);
  const seen = new Set();
  return source.filter((perk) => {
    const key = normal(`${perk.kind || ''}|${perk.hash || ''}|${perk.name || ''}|${perk.description || ''}|${perk.icon || ''}`);
    if (!perk?.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function strictSetBonuses(row) {
  const candidates = [
    ...parsePerks(row.ArmorSetBonuses),
    ...parsePerks(row.SetBonuses),
    ...parsePerks(row.SetBonusPerks),
    ...parsePerks(row.ArmorSetPerks)
  ];
  return candidates.map((perk) => normalizeSetBonus(perk, row)).filter(Boolean);
}

function strictExoticBonuses(row) {
  const candidates = [
    ...parsePerks(row.ExoticPerks),
    ...parsePerks(row.ExoticArmorPerks)
  ];
  const explicit = candidates.map((perk) => normalizeExoticBonus(perk, row)).filter(Boolean);
  const fallbackName = String(row.ExoticPerkName || '').trim();
  const fallbackDescription = String(row.ExoticPerkDescription || row.ExoticDescription || '').trim();
  const fallbackIcon = normalizeIcon(row.ExoticIcon || '');
  if (fallbackName && fallbackDescription && fallbackIcon && !sameIcon(fallbackIcon, row.IconUrl || row.Icon) && !looksLikeArchetype(`${fallbackName} ${fallbackDescription}`)) {
    explicit.push({ kind: 'exotic', label: 'Exotic Armor Perk', name: fallbackName, description: fallbackDescription, icon: fallbackIcon });
  }
  return explicit;
}

function normalizeSetBonus(perk, row) {
  const common = normalizeCommon(perk, row);
  if (!common) return null;
  if (!looksLikeSetBonus(`${common.name} ${common.description} ${common.label}`)) return null;
  return { ...common, kind: 'set', label: setBonusLabel(`${common.name} ${common.description} ${common.label}`) };
}

function normalizeExoticBonus(perk, row) {
  const common = normalizeCommon(perk, row);
  if (!common) return null;
  if (looksLikeArchetype(`${common.name} ${common.description} ${common.label}`)) return null;
  return { ...common, kind: 'exotic', label: 'Exotic Armor Perk' };
}

function normalizeCommon(perk, row) {
  if (!perk || typeof perk !== 'object') return null;
  const name = String(perk.name || perk.displayName || perk.plugName || perk.perkName || '').trim();
  const description = String(perk.description || perk.displayDescription || perk.tooltip || perk.perkDescription || '').trim();
  const icon = normalizeIcon(perk.icon || perk.displayIcon || perk.iconPath || perk.perkIcon || '');
  const label = String(perk.label || perk.type || perk.category || '').trim();
  const text = `${name} ${description} ${label}`;
  if (!name || !description) return null;
  if (isGenericArmorCandidate(text, row)) return null;
  if (icon && sameIcon(icon, row.IconUrl || row.Icon)) return null;
  return { name, description, icon, label, hash: perk.hash || perk.plugHash || '' };
}

function renderBonusRow(perk) {
  const kind = String(perk.kind || 'set').toLowerCase();
  const label = perk.label || (kind === 'exotic' ? 'Exotic Armor Perk' : 'Armor Set Bonus');
  const icon = perk.icon ? `<img loading="lazy" src="${h(perk.icon)}" alt="" onerror="this.closest('.set-bonus-row')?.remove()">` : `<span class="set-bonus-fallback">${kind === 'exotic' ? '✦' : '◆'}</span>`;
  return `<div class="set-bonus-row is-${h(kind)}" tabindex="0">${icon}<span class="set-bonus-copy"><b>${h(perk.name)}</b><em>${h(label)}</em></span><span class="d2-tooltip set-bonus-tooltip"><b>${h(perk.name)}</b><em>${h(label)}</em><p>${h(perk.description)}</p></span></div>`;
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

function looksLikeSetBonus(text) {
  const value = normal(text);
  return value.includes('set bonus') || value.includes('armor set') || value.includes('2 piece') || value.includes('4 piece') || value.includes('two piece') || value.includes('four piece') || value.includes('wearing 2') || value.includes('wearing 4') || value.includes('while wearing') || value.includes('ride together die together');
}

function looksLikeArchetype(text) {
  const value = normal(text);
  return value.includes('archetype') || value.includes('paragon') || value.includes('grenadier') || value.includes('specialist') || value.includes('brawler') || value.includes('bulwark') || value.includes('gunner');
}

function isGenericArmorCandidate(text, row) {
  const value = normal(text);
  const rowName = normal(row?.Name);
  const archetype = normal(row?.Archetype);
  if (!value) return true;
  if (rowName && value.includes(rowName)) return true;
  if (archetype && value.includes(archetype)) return true;
  if (looksLikeArchetype(value)) return true;
  if (value.includes('intrinsic') || value.includes('empty mod socket') || value.includes('default ornament')) return true;
  if (value.includes('helmet') || value.includes('gauntlet') || value.includes('chest armor') || value.includes('leg armor') || value.includes('class item')) return true;
  return false;
}

function setBonusLabel(text) {
  const value = normal(text);
  if (value.includes('2 piece') || value.includes('two piece') || value.includes('wearing 2')) return '2-Piece Set Bonus';
  if (value.includes('4 piece') || value.includes('four piece') || value.includes('wearing 4')) return '4-Piece Set Bonus';
  return 'Armor Set Bonus';
}

function ensureStylesheet() {
  if (document.querySelector('link[data-d2aa-set-bonus-rows]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `./set-bonus-rows.css?t=${window.D2AA_ASSET_STAMP || Date.now().toString(36)}`;
  link.dataset.d2aaSetBonusRows = 'true';
  document.head.appendChild(link);
}

function isExotic(row) { return normal(row?.Rarity) === 'exotic'; }
function normalizeIcon(value) { const text = String(value || ''); if (!text) return ''; if (text.startsWith('http')) return text; if (text.startsWith('/')) return `https://www.bungie.net${text}`; return text; }
function sameIcon(a, b) { return normalizeIcon(a) && normalizeIcon(a) === normalizeIcon(b); }
function normal(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function h(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }

function boot() {
  ensureStylesheet();
  subscribe(scheduleRender);
  scheduleRender();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes?.length)) scheduleRender();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('d2aa:compare-rendered', scheduleRender);
}

boot();
