import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS, STAT_LABELS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningTitle } from '../src-clean/data/armor-tuning.js';

const STAT_ROW_SELECTOR = '.armor-card[data-id] .stat-row, .compare-card[data-id] .stat-row';
let queued = false;
let observer = null;

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
    if (!tuning?.icon) return;
    const statRows = Array.from(card.querySelectorAll(':scope .stat-row'));
    statRows.forEach((statRow, index) => {
      const statKey = STAT_KEYS[index];
      if (!statKey) return;
      const value = Number(tuning.stats?.[statKey] || 0);
      if (!value || statRow.querySelector('.tuning-stat-icon')) return;
      const statIcon = statRow.querySelector('img:not(.tuning-stat-icon)');
      if (!statIcon) return;
      const host = document.createElement('span');
      host.className = 'stat-icon-stack ingame-tuning-stack';
      const tuningIcon = document.createElement('img');
      tuningIcon.className = `tuning-stat-icon ${value < 0 ? 'tune-negative' : tuning.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
      tuningIcon.src = tuning.icon;
      tuningIcon.alt = '';
      tuningIcon.loading = 'lazy';
      tuningIcon.title = tuningTitle(tuning, statKey);
      statIcon.replaceWith(host);
      host.append(tuningIcon, statIcon);
      statRow.classList.add('has-tuning-stat');
      statRow.title = `${STAT_LABELS[statKey] || statKey}: ${tuningTitle(tuning, statKey)}`;
    });
  });
}

function boot() {
  subscribe(scheduleDecorate);
  scheduleDecorate();
  observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes?.length)) scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('d2aa:compare-rendered', scheduleDecorate);
}

boot();
