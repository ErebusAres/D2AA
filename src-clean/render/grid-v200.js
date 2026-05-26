import { renderGrid as renderBaseGrid } from './grid-v169.js';

const STAT_CLASS_TO_KEY = {
  health: 'Health',
  melee: 'Melee',
  grenade: 'Grenade',
  super: 'Super',
  classability: 'ClassAbility',
  weapon: 'Weapon'
};
const STAT_HASH_TO_KEY = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'ClassAbility',
  1943323491: 'Weapon'
};
const STAT_LABELS = {
  Health: 'Health',
  Melee: 'Melee',
  Grenade: 'Grenade',
  Super: 'Super',
  ClassAbility: 'Class Ability',
  Weapon: 'Weapon'
};

export function renderGrid(container, rows, onTag, onAction, onCompareGroup) {
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
      const signed = value > 0 ? `+${value}` : String(value);
      img.title = `${tuning.name}: ${signed} ${STAT_LABELS[statKey] || statKey}${tuning.summary ? ` (${tuning.summary})` : ''}`;
      iconHost.insertBefore(img, statIcon);
      const cell = iconHost.closest('.stat-cell');
      if (cell) {
        cell.classList.add('has-tuning', value < 0 ? 'tune-negative' : 'tune-positive');
        cell.title = `${cell.title || STAT_LABELS[statKey] || statKey} · ${img.title}`;
      }
    }
  });
}

function detectArmorTuning(row) {
  if (!row) return null;
  if (row.__d2aaTuning !== undefined) return row.__d2aaTuning;
  const plugs = row.StatAudit?.activePlugs || [];
  let best = null;
  for (const plug of plugs) {
    const name = plug.name || 'Armor Tuning';
    const text = normalize(`${name} ${plug.description || ''} ${plug.type || ''} ${plug.category || ''}`);
    const stats = statsByKey(plug.stats || plug.investmentStats || []);
    const values = Object.values(stats);
    const positives = values.filter((value) => value > 0);
    const negatives = values.filter((value) => value < 0);
    const mentionsTuning = /\b(tuning|tuned|attunement|stat focus|focusing)\b/i.test(text);
    const smallShift = positives.length && negatives.length && Math.max(...positives) <= 5 && Math.max(...negatives.map((value) => Math.abs(value))) <= 5;
    const balanced = positives.length >= 3 && !negatives.length && positives.every((value) => value > 0 && value <= 2) && mentionsTuning;
    if (!mentionsTuning && !smallShift) continue;
    const icon = plug.icon || plug.displayProperties?.icon || '';
    const summary = Object.entries(stats)
      .filter(([, value]) => value)
      .map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${STAT_LABELS[key] || key}`)
      .join(' / ');
    best = { name, icon, stats, summary, mode: balanced ? 'balanced' : 'focused' };
    if (mentionsTuning) break;
  }
  row.__d2aaTuning = best || null;
  return row.__d2aaTuning;
}

function statsByKey(stats) {
  const out = {};
  for (const stat of stats || []) {
    const key = statKeyFromHash(stat.statTypeHash);
    const value = Number(stat.value ?? stat.statValue ?? 0);
    if (key && value) out[key] = (out[key] || 0) + value;
  }
  return out;
}
function statKeyFromHash(hash) { return STAT_HASH_TO_KEY[Number(hash) >>> 0] || ''; }
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }

function ensureTuningStyles() {
  if (document.getElementById('d2aa-tuning-stat-icon-style')) return;
  const style = document.createElement('style');
  style.id = 'd2aa-tuning-stat-icon-style';
  style.textContent = `
    .stat-cell .stat-icon-stack{display:inline-flex!important;align-items:center;justify-content:center;gap:4px;min-width:34px}
    .stat-cell .tuning-stat-icon{width:16px;height:16px;object-fit:contain;border-radius:5px;padding:1px;background:linear-gradient(180deg,rgba(122,92,255,.28),rgba(36,24,72,.46));border:1px solid rgba(185,165,255,.46);box-shadow:0 0 8px rgba(143,111,255,.32),inset 0 1px 0 rgba(255,255,255,.14);filter:drop-shadow(0 1px 1px rgba(0,0,0,.7))}
    .stat-cell .tuning-stat-icon.tune-negative{border-color:rgba(255,136,124,.48);background:linear-gradient(180deg,rgba(255,89,92,.22),rgba(72,24,30,.48));box-shadow:0 0 8px rgba(255,91,106,.22),inset 0 1px 0 rgba(255,255,255,.12)}
    .stat-cell .tuning-stat-icon.tune-balanced{border-color:rgba(120,210,255,.46);background:linear-gradient(180deg,rgba(84,190,255,.22),rgba(20,42,70,.48));box-shadow:0 0 8px rgba(78,190,255,.24),inset 0 1px 0 rgba(255,255,255,.12)}
  `;
  document.head.appendChild(style);
}
