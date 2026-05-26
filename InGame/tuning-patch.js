import { state, subscribe } from '../src-clean/state.js';
import { STAT_KEYS, STAT_LABELS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningTitle, tuningSummary } from '../src-clean/data/armor-tuning.js';

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
  document.querySelectorAll('.armor-card[data-id], .compare-card[data-id], .feed-card[data-id]').forEach((card) => {
    const row = rowsById.get(String(card.dataset.id));
    const tuning = detectArmorTuning(row);
    if (!tuning?.icon) return;
    decorateHeaderChip(card, row, tuning);
    decorateStatRows(card, tuning);
  });
}

function decorateHeaderChip(card, row, tuning) {
  if (card.querySelector('.tuning-title-chip')) return;
  const meta = card.querySelector('.meta-line, .feed-meta');
  if (!meta) return;
  const chip = document.createElement('span');
  chip.className = `tuning-title-chip ${tuning.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
  chip.title = tuningSummary(row) || tuning.name || 'Armor Tuning';
  chip.innerHTML = `<img src="${escapeAttr(tuning.icon)}" alt="" loading="lazy"><b>${escapeHtml(primaryTunedStat(tuning))}</b>`;
  const grade = meta.querySelector('.grade-chip');
  if (grade) meta.insertBefore(chip, grade);
  else meta.appendChild(chip);
}

function decorateStatRows(card, tuning) {
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
}

function primaryTunedStat(tuning) {
  const positive = Object.entries(tuning.stats || {}).filter(([, value]) => Number(value) > 0).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return positive ? shortStatLabel(positive[0]) : 'Tune';
}
function shortStatLabel(statKey) {
  return ({ ClassAbility: 'Class', Health: 'HP' }[statKey]) || STAT_LABELS[statKey] || 'Tune';
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

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#39;'); }

boot();
