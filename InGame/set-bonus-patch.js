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
    const bonuses = armorBonuses(row);
    const oldList = side.querySelector(':scope > .set-bonus-list');
    if (!bonuses.length) {
      oldList?.remove();
      return;
    }
    const html = `<div class="set-bonus-list" aria-label="Armor set bonuses">${bonuses.slice(0, 4).map(renderBonusRow).join('')}</div>`;
    if (oldList) oldList.outerHTML = html;
    else {
      const oldIconArea = side.querySelector(':scope > .bonus-icons');
      if (oldIconArea) oldIconArea.outerHTML = html;
      else side.insertAdjacentHTML('beforeend', html);
    }
  });
}

function armorBonuses(row) {
  const explicit = [
    ...parsePerks(row.ArmorSetBonuses || row.SetBonuses).map((perk) => ({ ...perk, kind: 'set' })),
    ...parsePerks(row.ArmorBonuses || row.ArmorPerks || row.Perks).filter(isSetLike).map((perk) => ({ ...perk, kind: 'set' }))
  ];
  const audit = auditSetBonuses(row);
  const exotic = isExotic(row) && (row.ExoticPerkName || row.ExoticPerkDescription)
    ? [{ name: row.ExoticPerkName || row.Name || 'Exotic Armor Perk', description: row.ExoticPerkDescription || 'Exotic armor perk.', icon: row.ExoticIcon || '', kind: 'exotic', label: 'Exotic Armor Perk' }]
    : [];
  const list = isExotic(row) ? exotic : [...explicit, ...audit];
  const seen = new Set();
  return list.filter((perk) => {
    const key = normal(`${perk.kind || ''}|${perk.hash || ''}|${perk.name || ''}|${perk.description || ''}`);
    if (!perk?.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function auditSetBonuses(row) {
  const plugs = [
    ...(row.StatAudit?.activePlugs || []),
    ...(row.StatAudit?.allPlugs || []),
    ...(row.SocketAudit?.activePlugs || []),
    ...(row.SocketAudit?.allPlugs || [])
  ];
  return plugs.filter(isSetLike).map((plug) => ({
    kind: 'set',
    label: setBonusLabel(`${plug.name || ''} ${plug.description || ''} ${plug.type || ''} ${plug.category || ''}`),
    name: plug.name || 'Armor Set Bonus',
    description: plug.description || plug.type || plug.category || 'Armor set bonus.',
    icon: plug.icon || '',
    hash: plug.hash || ''
  }));
}

function renderBonusRow(perk) {
  const kind = String(perk.kind || 'set').toLowerCase();
  const label = perk.label || (kind === 'exotic' ? 'Exotic Armor Perk' : setBonusLabel(`${perk.name || ''} ${perk.description || ''}`));
  const icon = perk.icon ? `<img loading="lazy" src="${h(normalizeIcon(perk.icon))}" alt="" onerror="this.remove()">` : `<span class="set-bonus-fallback">${kind === 'exotic' ? '✦' : '◆'}</span>`;
  return `<div class="set-bonus-row is-${h(kind)}" tabindex="0">${icon}<span>${h(perk.name || label)}</span><span class="d2-tooltip"><b>${h(perk.name || label)}</b><em>${h(label)}</em><p>${h(perk.description || 'No description available yet.')}</p></span></div>`;
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

function isSetLike(perk) {
  const text = normal(`${perk?.name || ''} ${perk?.description || ''} ${perk?.label || ''} ${perk?.type || ''} ${perk?.category || ''} ${perk?.kind || ''}`);
  if (!text || text.includes('archetype') || text.includes('empty mod socket') || text.includes('default ornament')) return false;
  return text.includes('set bonus') || text.includes('armor set') || text.includes('setbonus') || text.includes('2 piece') || text.includes('4 piece') || text.includes('two piece') || text.includes('four piece') || text.includes('wearing 2') || text.includes('wearing 4') || text.includes('while wearing');
}

function setBonusLabel(text) {
  const value = normal(text);
  if (value.includes('2 piece') || value.includes('two piece') || value.includes('wearing 2')) return '2-Piece Set Bonus';
  if (value.includes('4 piece') || value.includes('four piece') || value.includes('wearing 4')) return '4-Piece Set Bonus';
  return 'Armor Set Bonus';
}

function isExotic(row) { return normal(row?.Rarity) === 'exotic'; }
function normalizeIcon(value) { const text = String(value || ''); if (!text) return ''; if (text.startsWith('http')) return text; if (text.startsWith('/')) return `https://www.bungie.net${text}`; return text; }
function normal(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function h(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }

function boot() {
  subscribe(scheduleRender);
  scheduleRender();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes?.length)) scheduleRender();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('d2aa:compare-rendered', scheduleRender);
}

boot();
