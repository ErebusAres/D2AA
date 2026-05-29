import './storage-quota-guard.js';
import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningTitle } from '../src-clean/data/armor-tuning.js';

let queued = false;

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
  document.querySelectorAll('.armor-card[data-id], .compare-card[data-id]').forEach((card) => {
    const row = rowsById.get(String(card.dataset.id));
    const tuning = detectArmorTuning(row);
    const capability = tuningCapability(tuning);
    card.querySelector('.tuning-title-chip')?.remove();
    normalizeOldTuningMarkup(card);
    ensureTuningColumn(card);
    if (!capability.hasTuningStats) return;
    decorateTunedStatRows(card, capability);
  });
}

function tuningCapability(activeTuning) {
  const stats = activeTuning?.stats || {};
  const tunedStats = STAT_KEYS
    .map((statKey) => ({ statKey, value: Number(stats?.[statKey] || 0) }))
    .filter((entry) => entry.value !== 0);
  if (!tunedStats.length || !activeTuning?.icon) return { hasTuningStats: false };
  return {
    hasTuningStats: true,
    mode: activeTuning?.mode || 'active',
    name: activeTuning?.name || 'Armor Tuning',
    icon: activeTuning.icon,
    stats,
    tunedStats
  };
}

function ensureTuningColumn(card) {
  card.querySelectorAll(':scope .stat-row').forEach((statRow) => {
    statRow.classList.add('has-tuning-column');
    if (statRow.querySelector(':scope > .stat-tuning-slot')) return;
    const firstIcon = findBaseStatIcon(statRow);
    const slot = document.createElement('span');
    slot.className = 'stat-tuning-slot';
    slot.setAttribute('aria-hidden', 'true');
    if (firstIcon) statRow.insertBefore(slot, firstIcon);
    else statRow.prepend(slot);
  });
}

function decorateTunedStatRows(card, capability) {
  const statRows = Array.from(card.querySelectorAll(':scope .stat-row'));
  for (const { statKey, value } of capability.tunedStats) {
    const index = STAT_KEYS.indexOf(statKey);
    const statRow = statRows[index];
    if (!statRow) continue;
    const slot = statRow.querySelector(':scope > .stat-tuning-slot');
    if (!slot) continue;
    const title = tuningTitle(capability, statKey);
    slot.classList.add('is-tuned-stat', value > 0 ? 'is-tune-positive' : 'is-tune-negative');
    slot.removeAttribute('aria-hidden');
    slot.setAttribute('role', 'img');
    slot.setAttribute('aria-label', title || 'Tuned stat');
    slot.title = title;
    slot.innerHTML = tuningIconImg(capability.icon, title, value);
    statRow.classList.add('has-tuning-stat', value > 0 ? 'has-positive-tuning-stat' : 'has-negative-tuning-stat');
    statRow.title = title;
  }
}

function normalizeOldTuningMarkup(card) {
  card.querySelectorAll('.tuning-title-chip').forEach((chip) => chip.remove());
  card.querySelectorAll('.stat-tuning-marker').forEach((marker) => marker.remove());
  card.querySelectorAll('.stat-row.has-tuning-stat, .stat-row.has-positive-tuning, .stat-row.has-positive-tuning-stat, .stat-row.has-negative-tuning-stat').forEach((statRow) => {
    statRow.classList.remove('has-tuning-stat', 'has-positive-tuning', 'has-positive-tuning-stat', 'has-negative-tuning-stat');
  });
  card.querySelectorAll('.stat-tuning-slot').forEach((slot) => {
    slot.className = 'stat-tuning-slot';
    slot.setAttribute('aria-hidden', 'true');
    slot.removeAttribute('role');
    slot.removeAttribute('aria-label');
    slot.removeAttribute('title');
    slot.innerHTML = '';
  });
  card.querySelectorAll('.ingame-tuning-stack').forEach((stack) => {
    const baseIcon = stack.querySelector(':scope > img:not(.tuning-stat-icon)');
    stack.querySelectorAll(':scope > .tuning-stat-icon').forEach((icon) => icon.remove());
    if (baseIcon) stack.replaceWith(baseIcon);
    else stack.remove();
  });
}

function findBaseStatIcon(statRow) {
  return statRow.querySelector(':scope > img:not(.tuning-stat-icon), :scope > .ingame-tuning-stack > img:not(.tuning-stat-icon)');
}

function tuningIconImg(src, title, value) {
  const tuneClass = Number(value) > 0 ? 'tune-positive' : 'tune-negative';
  return `<img class="real-tuning-stat-icon ${tuneClass}" src="${escapeAttr(src)}" alt="" title="${escapeAttr(title || 'Armor Tuning')}" loading="lazy">`;
}

function escapeAttr(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
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