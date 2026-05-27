import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS, STAT_LABELS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningTitle, tuningSummary } from '../src-clean/data/armor-tuning.js';

let queued = false;
let lastKnownTuningIcon = '';

function scheduleDecorate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    decorateTuningIcons();
  });
}

function decorateTuningIcons() {
  const rowsById = new Map((state.rows || []).map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id], .compare-card[data-id], .feed-card[data-id]').forEach((card) => {
    const row = rowsById.get(String(card.dataset.id));
    const tuning = detectArmorTuning(row);
    const capability = tuningCapability(row, tuning);
    card.querySelector('.tuning-title-chip')?.remove();
    normalizeExistingStatIcons(card);
    if (!capability.hasTuning || !capability.icon) return;
    decorateStatRows(card, capability);
  });
}

function tuningCapability(row, activeTuning) {
  if (!row) return { hasTuning: false };
  const activeIcon = activeTuning?.icon || row.TuningIcon || row.TuningIconUrl || row.ArmorTuning?.icon || '';
  if (activeIcon) lastKnownTuningIcon = normalizeIcon(activeIcon);
  const tier = Number(row.Tier || row.GearTier || 0);
  const rarity = String(row.Rarity || '').toLowerCase();
  const hasActive = Boolean(activeTuning?.icon || Object.keys(activeTuning?.stats || {}).length);
  const hasExplicit = Boolean(row.TuningStat || row.TunedStat || row.TuningIcon || row.TuningIconUrl || row.ArmorTuning);
  const hasTierCapability = rarity !== 'exotic' && tier >= 5;
  const hasTuning = hasActive || hasExplicit || hasTierCapability;
  if (!hasTuning) return { hasTuning: false };
  return {
    hasTuning: true,
    active: hasActive,
    mode: activeTuning?.mode || 'available',
    name: activeTuning?.name || 'Armor Tuning Available',
    summary: activeTuning ? tuningSummary(row) : 'Armor Tuning Available',
    stats: activeTuning?.stats || {},
    icon: normalizeIcon(activeIcon || lastKnownTuningIcon || '')
  };
}

function decorateStatRows(card, capability) {
  const statRows = Array.from(card.querySelectorAll(':scope .stat-row'));
  statRows.forEach((statRow, index) => {
    const statKey = STAT_KEYS[index];
    if (!statKey) return;
    const statIcon = findBaseStatIcon(statRow);
    if (!statIcon) return;
    const host = statIcon.closest('.ingame-tuning-stack') || document.createElement('span');
    if (!host.classList.contains('ingame-tuning-stack')) {
      host.className = 'stat-icon-stack ingame-tuning-stack';
      statIcon.replaceWith(host);
      host.appendChild(statIcon);
    }
    let tuningIcon = host.querySelector(':scope > .tuning-stat-icon');
    if (!tuningIcon) {
      tuningIcon = document.createElement('img');
      host.insertBefore(tuningIcon, statIcon);
    }
    const activeValue = Number(capability.stats?.[statKey] || 0);
    tuningIcon.className = `tuning-stat-icon ${activeValue < 0 ? 'tune-negative' : capability.mode === 'balanced' ? 'tune-balanced' : activeValue > 0 ? 'tune-positive' : 'tune-available'}`;
    tuningIcon.src = capability.icon;
    tuningIcon.alt = '';
    tuningIcon.loading = 'lazy';
    tuningIcon.title = activeValue ? tuningTitle(capability, statKey) : `Armor Tuning available for ${STAT_LABELS[statKey] || statKey}`;
    statRow.classList.add('has-tuning-stat');
    statRow.title = tuningIcon.title;
  });
}

function normalizeExistingStatIcons(card) {
  card.querySelectorAll('.tuning-title-chip').forEach((chip) => chip.remove());
  card.querySelectorAll('.ingame-tuning-stack').forEach((stack) => {
    const tuningIcons = stack.querySelectorAll(':scope > .tuning-stat-icon');
    tuningIcons.forEach((icon, index) => { if (index > 0) icon.remove(); });
    const baseIcons = stack.querySelectorAll(':scope > img:not(.tuning-stat-icon)');
    baseIcons.forEach((icon, index) => { if (index > 0) icon.remove(); });
    if (!stack.querySelector(':scope > .tuning-stat-icon') && baseIcons[0]) stack.replaceWith(baseIcons[0]);
  });
}

function findBaseStatIcon(statRow) {
  const stacked = statRow.querySelector('.ingame-tuning-stack > img:not(.tuning-stat-icon)');
  if (stacked) return stacked;
  return statRow.querySelector('img:not(.tuning-stat-icon):not(.tuning-title-chip img)');
}

function normalizeIcon(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.startsWith('http')) return text;
  if (text.startsWith('/')) return `https://www.bungie.net${text}`;
  return text;
}

function boot() {
  subscribe(scheduleDecorate);
  scheduleDecorate();
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes?.length)) scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('d2aa:compare-rendered', scheduleDecorate);
}

boot();
