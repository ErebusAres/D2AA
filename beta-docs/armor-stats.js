import { STAT_MAP } from './config.js';
import { guardArray, guardObject, num, statTotals } from './utils.js';

export function computeArmorStatsFromItem(item, manifest) {
  const statsComponent = guardObject(item?.stats ?? item?.statsComponent);
  const dataStats = statsComponent?.data?.stats ?? statsComponent?.stats ?? statsComponent;
  const base = {};
  const current = {};

  for (const stat of Object.values(dataStats ?? {})) {
    const statHash = Number(stat.statHash ?? stat.stat_id ?? stat.statId);
    const configEntry = STAT_MAP.find((entry) => entry.id === statHash);
    if (!configEntry) continue;
    const baseValue = num(stat?.investmentValue ?? stat?.base ?? stat?.baseValue ?? stat?.value ?? 0);
    const totalValue = num(stat?.value ?? stat?.actual ?? baseValue);
    base[statHash] = baseValue;
    current[statHash] = totalValue;
  }

  return {
    base,
    current,
    totalBase: statTotals(base),
    totalCurrent: statTotals(current),
  };
}

export function computeArmorStatsFromCsv(row) {
  const base = {};
  const current = {};
  for (const stat of STAT_MAP) {
    const baseKey = `${stat.label} (Base)`;
    const totalKey = `${stat.label} (Total)`;
    base[stat.id] = num(row[`${stat.label} (Base)`] ?? row[stat.label] ?? row[stat.short] ?? 0);
    const total = row[totalKey] ?? row[`${stat.label} (Current)`];
    current[stat.id] = num(total, base[stat.id]);
  }
  return {
    base,
    current,
    totalBase: statTotals(base),
    totalCurrent: statTotals(current),
  };
}

export function buildDisplayStatList(stats, view = 'BASE') {
  const source = view === 'CURRENT' ? stats.current : stats.base;
  return STAT_MAP.map((entry) => source?.[entry.id] ?? 0);
}

export function formatStatTooltip(stats) {
  return STAT_MAP.map((entry) => {
    const baseValue = stats.base?.[entry.id] ?? 0;
    const currentValue = stats.current?.[entry.id] ?? baseValue;
    const delta = currentValue - baseValue;
    const deltaText = delta ? ` (${delta >= 0 ? '+' : ''}${delta})` : '';
    return `${entry.label}: ${currentValue}${deltaText}`;
  }).join('\n');
}

export function isArmorItem(definition) {
  if (!definition) return false;
  return definition.itemType === 2 || definition.itemCategoryHashes?.includes(20);
}
