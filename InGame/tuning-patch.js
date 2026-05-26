import { state, subscribe } from '../src-clean/state.js';
import { STAT_LABELS } from '../src-clean/constants.js';
import { detectArmorTuning, tuningSummary } from '../src-clean/data/armor-tuning.js';

let queued = false;
let lastKnownTuningIcon = '';

function scheduleDecorate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    decorateTuningChips();
  });
}

function decorateTuningChips() {
  const rowsById = new Map((state.rows || []).map((row) => [String(row.Id), row]));
  document.querySelectorAll('.armor-card[data-id], .compare-card[data-id], .feed-card[data-id]').forEach((card) => {
    const row = rowsById.get(String(card.dataset.id));
    const tuning = detectArmorTuning(row);
    const capability = tuningCapability(row, tuning);
    removeOldStatRowDecorations(card);
    if (!capability.hasTuning) {
      card.querySelector('.tuning-title-chip')?.remove();
      return;
    }
    decorateHeaderChip(card, row, capability);
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
    icon: normalizeIcon(activeIcon || lastKnownTuningIcon || defaultTuningIcon()),
    label: activeTuning ? primaryTunedStat(activeTuning) : 'Tune'
  };
}

function decorateHeaderChip(card, row, capability) {
  const meta = card.querySelector('.meta-line, .feed-meta');
  if (!meta) return;
  const existing = card.querySelector('.tuning-title-chip');
  const chip = existing || document.createElement('span');
  chip.className = `tuning-title-chip ${capability.active ? 'is-active-tuning' : 'is-available-tuning'} ${capability.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
  chip.title = capability.summary || capability.name || 'Armor Tuning Available';
  chip.innerHTML = `${capability.icon ? `<img src="${escapeAttr(capability.icon)}" alt="" loading="lazy">` : ''}<b>${escapeHtml(capability.label)}</b>`;
  if (!existing) {
    const grade = meta.querySelector('.grade-chip');
    if (grade) meta.insertBefore(chip, grade);
    else meta.appendChild(chip);
  }
}

function removeOldStatRowDecorations(card) {
  card.querySelectorAll('.stat-row.has-tuning-stat').forEach((statRow) => {
    statRow.classList.remove('has-tuning-stat');
    const stack = statRow.querySelector('.ingame-tuning-stack');
    if (!stack) return;
    const statIcon = stack.querySelector('img:not(.tuning-stat-icon)');
    if (statIcon) stack.replaceWith(statIcon);
    else stack.remove();
  });
}

function primaryTunedStat(tuning) {
  const positive = Object.entries(tuning.stats || {}).filter(([, value]) => Number(value) > 0).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return positive ? shortStatLabel(positive[0]) : 'Tune';
}
function shortStatLabel(statKey) {
  return ({ ClassAbility: 'Class', Health: 'HP' }[statKey]) || STAT_LABELS[statKey] || 'Tune';
}
function normalizeIcon(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.startsWith('http')) return text;
  if (text.startsWith('/')) return `https://www.bungie.net${text}`;
  return text;
}
function defaultTuningIcon() {
  return '';
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
