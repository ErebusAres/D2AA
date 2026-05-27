import './storage-quota-guard.js';
import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningTitle } from '../src-clean/data/armor-tuning.js';

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
    if (!capability.hasActiveBoost || !capability.icon) return;
    decorateBoostedStatRow(card, capability);
  });
}

function tuningCapability(row, activeTuning) {
  if (!row) return { hasActiveBoost: false };
  const activeIcon = activeTuning?.icon || row.TuningIcon || row.TuningIconUrl || row.ArmorTuning?.icon || '';
  if (activeIcon) lastKnownTuningIcon = normalizeIcon(activeIcon);
  const stats = activeTuning?.stats || {};
  const boostedStat = STAT_KEYS.find((statKey) => Number(stats?.[statKey] || 0) > 0);
  if (!boostedStat) return { hasActiveBoost: false };
  return {
    hasActiveBoost: true,
    boostedStat,
    mode: activeTuning?.mode || 'active',
    stats,
    icon: normalizeIcon(activeIcon || lastKnownTuningIcon || '')
  };
}

function decorateBoostedStatRow(card, capability) {
  const statRows = Array.from(card.querySelectorAll(':scope .stat-row'));
  const index = STAT_KEYS.indexOf(capability.boostedStat);
  const statRow = statRows[index];
  if (!statRow) return;
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
  tuningIcon.className = `tuning-stat-icon ${capability.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
  tuningIcon.src = capability.icon;
  tuningIcon.alt = '';
  tuningIcon.loading = 'lazy';
  tuningIcon.title = tuningTitle(capability, capability.boostedStat);
  statRow.classList.add('has-tuning-stat');
  statRow.title = tuningIcon.title;
}

function normalizeExistingStatIcons(card) {
  card.querySelectorAll('.tuning-title-chip').forEach((chip) => chip.remove());
  card.querySelectorAll('.stat-row.has-tuning-stat').forEach((statRow) => statRow.classList.remove('has-tuning-stat'));
  card.querySelectorAll('.ingame-tuning-stack').forEach((stack) => {
    const baseIcon = stack.querySelector(':scope > img:not(.tuning-stat-icon)');
    stack.querySelectorAll(':scope > .tuning-stat-icon').forEach((icon) => icon.remove());
    if (baseIcon) stack.replaceWith(baseIcon);
    else stack.remove();
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
