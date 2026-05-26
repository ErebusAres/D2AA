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
