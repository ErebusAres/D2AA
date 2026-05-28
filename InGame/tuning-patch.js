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
    if (!capability.hasActiveBoost) return;
    decorateBoostedStatRow(card, capability);
  });
}

function tuningCapability(activeTuning) {
  const stats = activeTuning?.stats || {};
  const boostedStat = STAT_KEYS.find((statKey) => Number(stats?.[statKey] || 0) > 0);
  if (!boostedStat) return { hasActiveBoost: false };
  return {
    hasActiveBoost: true,
    boostedStat,
    mode: activeTuning?.mode || 'active',
    name: activeTuning?.name || 'Armor Tuning',
    icon: activeTuning?.icon || '',
    stats
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

function decorateBoostedStatRow(card, capability) {
  const statRows = Array.from(card.querySelectorAll(':scope .stat-row'));
  const index = STAT_KEYS.indexOf(capability.boostedStat);
  const statRow = statRows[index];
  if (!statRow) return;
  const slot = statRow.querySelector(':scope > .stat-tuning-slot');
  if (!slot) return;
  const title = tuningTitle(capability, capability.boostedStat);
  slot.classList.add('is-tuned-stat');
  slot.removeAttribute('aria-hidden');
  slot.setAttribute('role', 'img');
  slot.setAttribute('aria-label', title || 'Tuned stat');
  slot.title = title;
  slot.innerHTML = capability.icon ? tuningIconImg(capability.icon, title) : '';
  statRow.classList.add('has-tuning-stat');
  statRow.title = title;
}

function normalizeOldTuningMarkup(card) {
  card.querySelectorAll('.tuning-title-chip').forEach((chip) => chip.remove());
  card.querySelectorAll('.stat-tuning-marker').forEach((marker) => marker.remove());
  card.querySelectorAll('.stat-row.has-tuning-stat, .stat-row.has-positive-tuning').forEach((statRow) => {
    statRow.classList.remove('has-tuning-stat', 'has-positive-tuning');
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

function tuningIconImg(src, title) {
  return `<img class="real-tuning-stat-icon" src="${escapeAttr(src)}" alt="" title="${escapeAttr(title || 'Armor Tuning')}" loading="lazy">`;
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