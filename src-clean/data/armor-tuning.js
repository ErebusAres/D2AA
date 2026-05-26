export const TUNING_STAT_LABELS = {
  Health: 'Health',
  Melee: 'Melee',
  Grenade: 'Grenade',
  Super: 'Super',
  ClassAbility: 'Class Ability',
  Weapon: 'Weapon'
};

export const TUNING_STAT_HASH_TO_KEY = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'ClassAbility',
  1943323491: 'Weapon'
};

export function detectArmorTuning(row) {
  if (!row) return null;
  if (row.__d2aaTuning !== undefined) return row.__d2aaTuning;

  const explicit = tuningFromExplicitFields(row);
  if (explicit) {
    row.__d2aaTuning = explicit;
    return explicit;
  }

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
    best = normalizeTuning({
      name,
      icon: normalizeIcon(plug.icon || plug.displayProperties?.icon || ''),
      stats,
      mode: balanced ? 'balanced' : 'focused',
      source: 'Active tuning socket'
    });
    if (mentionsTuning) break;
  }

  row.__d2aaTuning = best || null;
  return row.__d2aaTuning;
}

export function tuningBadgeHtml(row, statKey, className = 'tuning-stat-icon') {
  const tuning = detectArmorTuning(row);
  const value = Number(tuning?.stats?.[statKey] || 0);
  if (!tuning?.icon || !value) return '';
  const variant = value < 0 ? 'tune-negative' : tuning.mode === 'balanced' ? 'tune-balanced' : 'tune-positive';
  return `<img class="${escapeHtml(className)} ${variant}" src="${escapeHtml(tuning.icon)}" alt="" title="${escapeHtml(tuningTitle(tuning, statKey))}" loading="lazy">`;
}

export function tuningTitle(tuning, statKey = '') {
  if (!tuning) return '';
  const value = statKey ? Number(tuning.stats?.[statKey] || 0) : 0;
  const statText = statKey && value ? `${value > 0 ? '+' : ''}${value} ${TUNING_STAT_LABELS[statKey] || statKey}` : tuning.summary;
  return `${tuning.name || 'Armor Tuning'}${statText ? `: ${statText}` : ''}${tuning.summary && statText !== tuning.summary ? ` (${tuning.summary})` : ''}`;
}

export function tuningSummary(row) {
  const tuning = detectArmorTuning(row);
  if (!tuning) return '';
  return tuning.summary ? `${tuning.name}: ${tuning.summary}` : tuning.name;
}

export function tuningIcon(row) {
  return detectArmorTuning(row)?.icon || '';
}

export function parseCsvTuning(raw, row = {}) {
  const tunedStat = pick(raw, ['Tuning Stat', 'Tuned Stat', 'Armor Tuning', 'Tuning', 'TunedStat']);
  const icon = normalizeIcon(pick(raw, ['Tuning Icon', 'Tuning Icon Url', 'TuningIcon', 'TuningIconUrl']));
  if (!tunedStat && !icon) return {};
  const statKey = statKeyFromName(tunedStat);
  const stats = {};
  if (statKey) stats[statKey] = 5;
  const tuning = normalizeTuning({
    name: tunedStat ? `${TUNING_STAT_LABELS[statKey] || tunedStat} Tuning` : 'Armor Tuning',
    icon,
    stats,
    mode: 'focused',
    source: 'DIM CSV'
  });
  return {
    TuningStat: statKey || tunedStat || '',
    TuningIcon: tuning.icon || '',
    TuningMode: tuning.mode,
    TuningSummary: tuning.summary,
    TuningSource: tuning.source,
    ArmorTuning: tuning
  };
}

function tuningFromExplicitFields(row) {
  const source = row.ArmorTuning || row.Tuning || null;
  if (source && typeof source === 'object') return normalizeTuning(source);
  const statKey = statKeyFromName(row.TuningStat || row.TunedStat || row['Tuning Stat']);
  const icon = normalizeIcon(row.TuningIcon || row.TuningIconUrl || '');
  if (!statKey && !icon) return null;
  const stats = {};
  if (statKey) stats[statKey] = Number(row.TuningValue || row.TuningAmount || 5) || 5;
  return normalizeTuning({ name: row.TuningName || `${TUNING_STAT_LABELS[statKey] || 'Armor'} Tuning`, icon, stats, mode: row.TuningMode || 'focused', source: row.TuningSource || 'Row data' });
}

function normalizeTuning(input) {
  const stats = Object.fromEntries(Object.entries(input.stats || {}).filter(([, value]) => Number(value || 0)).map(([key, value]) => [key, Number(value)]));
  const summary = Object.entries(stats).map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${TUNING_STAT_LABELS[key] || key}`).join(' / ');
  return { name: input.name || 'Armor Tuning', icon: normalizeIcon(input.icon || ''), stats, summary, mode: input.mode || 'focused', source: input.source || '' };
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
function statKeyFromHash(hash) { return TUNING_STAT_HASH_TO_KEY[Number(hash) >>> 0] || ''; }
function statKeyFromName(value) {
  const text = normalize(value);
  if (!text) return '';
  if (text.includes('health') || text.includes('resilience')) return 'Health';
  if (text.includes('melee') || text.includes('strength')) return 'Melee';
  if (text.includes('grenade') || text.includes('discipline')) return 'Grenade';
  if (text.includes('super') || text.includes('intellect')) return 'Super';
  if (text.includes('class') || text.includes('mobility')) return 'ClassAbility';
  if (text.includes('weapon') || text.includes('recovery')) return 'Weapon';
  return '';
}
function pick(raw, keys) { for (const key of keys) if (raw?.[key] !== undefined && raw[key] !== '') return raw[key]; return ''; }
function normalizeIcon(value) { const text = String(value || ''); if (!text) return ''; if (text.startsWith('http')) return text; if (text.startsWith('/')) return `https://www.bungie.net${text}`; return text; }
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
