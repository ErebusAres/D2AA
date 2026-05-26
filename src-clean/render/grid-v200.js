import { renderGrid as renderBaseGrid } from './grid-v169.js';
import { TUNING_STAT_LABELS, detectArmorTuning, tuningTitle } from '../data/armor-tuning.js';

const STAT_CLASS_TO_KEY = {
  health: 'Health',
  melee: 'Melee',
  grenade: 'Grenade',
  super: 'Super',
  classability: 'ClassAbility',
  weapon: 'Weapon'
};

export function renderGrid(container, rows, onTag, onAction, onCompareGroup) {
  rows.forEach((row) => detectArmorTuning(row));
  renderBaseGrid(container, rows, onTag, onAction, onCompareGroup);
  ensureTuningStyles();
  decorateTuningIcons(container, rows);
}

function decorateTuningIcons(container, rows) {
  const byId = new Map(rows.map((row) => [String(row.Id), row]));
  container.querySelectorAll('.armor-card[data-card-id]').forEach((card) => {
    const row = byId.get(String(card.dataset.cardId));
    const tuning = detectArmorTuning(row);
    if (!tuning?.icon) return;
    for (const [classKey, statKey] of Object.entries(STAT_CLASS_TO_KEY)) {
      const value = Number(tuning.stats?.[statKey] || 0);
      if (!value) continue;
      const iconHost = card.querySelector(`.stat-${classKey} .stat-icon-only`);
      const statIcon = iconHost?.querySelector('.stat-icon');
      if (!iconHost || !statIcon || iconHost.querySelector('.tuning-stat-icon')) continue;
      iconHost.classList.add('stat-icon-stack');
      const img = document.createElement('img');
      img.className = `tuning-stat-icon ${value < 0 ? 'tune-negative' : tuning.mode === 'balanced' ? 'tune-balanced' : 'tune-positive'}`;
      img.src = tuning.icon;
      img.alt = '';
      img.loading = 'lazy';
      img.title = tuningTitle(tuning, statKey);
      iconHost.insertBefore(img, statIcon);
      const cell = iconHost.closest('.stat-cell');
      if (cell) {
        cell.classList.add('has-tuning', value < 0 ? 'tune-negative' : 'tune-positive');
        cell.title = `${cell.title || TUNING_STAT_LABELS[statKey] || statKey} · ${img.title}`;
      }
    }
  });
}

export function ensureTuningStyles() {
  if (document.getElementById('d2aa-tuning-stat-icon-style')) return;
  const style = document.createElement('style');
  style.id = 'd2aa-tuning-stat-icon-style';
  style.textContent = `
    .stat-cell .stat-icon-stack,.table-stats .stat-icon-stack,.compare-stat-label.stat-icon-stack{display:inline-flex!important;align-items:center;justify-content:center;gap:4px;min-width:34px}
    .tuning-stat-icon{width:16px;height:16px;object-fit:contain;border-radius:5px;padding:1px;background:linear-gradient(180deg,rgba(122,92,255,.28),rgba(36,24,72,.46));border:1px solid rgba(185,165,255,.46);box-shadow:0 0 8px rgba(143,111,255,.32),inset 0 1px 0 rgba(255,255,255,.14);filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
    .tuning-stat-icon.tune-negative{border-color:rgba(255,136,124,.48);background:linear-gradient(180deg,rgba(255,89,92,.22),rgba(72,24,30,.48));box-shadow:0 0 8px rgba(255,91,106,.22),inset 0 1px 0 rgba(255,255,255,.12)}
    .tuning-stat-icon.tune-balanced{border-color:rgba(120,210,255,.46);background:linear-gradient(180deg,rgba(84,190,255,.22),rgba(20,42,70,.48));box-shadow:0 0 8px rgba(78,190,255,.24),inset 0 1px 0 rgba(255,255,255,.12)}
  `;
  document.head.appendChild(style);
}
