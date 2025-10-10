import { STAT_MAP } from './config.js';
import { guardArray, guardObject, num, statTotals } from './utils.js';

const DEBUG_OPTIONS = typeof window !== 'undefined' ? window.D2AA_DEBUG ?? {} : {};
const DEBUG_ARMOR_STATS = Boolean(DEBUG_OPTIONS.armorStats);

function debugLog(...args) {
  if (!DEBUG_ARMOR_STATS) return;
  console.debug('[armor-stats]', ...args);
}

function accumulateSocketAdjustments(item, manifest) {
  const socketsComponent = guardObject(item?.sockets ?? item?.socketsComponent);
  const sockets = guardArray(socketsComponent?.sockets);
  const inventoryDefs = guardObject(manifest?.inventoryItem);
  const statDefs = guardObject(manifest?.statDefs);

  const adjustments = {};
  const debugSockets = [];
  let masterworkSocketSeen = false;
  let masterworkStatsApplied = false;

  for (const socket of sockets) {
    if (socket?.isEnabled === false) continue;
    const plugHash = socket?.plugHash ?? socket?.plugged?.plugHash;
    if (!plugHash) continue;
    const plugDef = inventoryDefs?.[plugHash];
    if (!plugDef) continue;

    const plugCategory = plugDef?.plug?.plugCategoryIdentifier ?? '';
    const isArtifice = plugCategory.startsWith('enhancements.artifice');
    const isMasterwork = plugCategory.includes('masterwork');
    if (!isArtifice && !isMasterwork) continue;

    if (isMasterwork) {
      masterworkSocketSeen = true;
    }

    const investmentStats = guardArray(plugDef?.investmentStats);
    if (!investmentStats.length) {
      debugSockets.push({ plugHash, plugCategory, stats: [] });
      continue;
    }

    const plugStats = [];

    for (const stat of investmentStats) {
      const statHash = Number(stat?.statTypeHash);
      const value = num(stat?.value);
      if (!Number.isFinite(statHash) || !value) continue;
      adjustments[statHash] = (adjustments[statHash] ?? 0) + value;
      plugStats.push({
        statHash,
        statName: statDefs?.[statHash]?.displayProperties?.name ?? null,
        value,
      });
      if (isMasterwork) {
        masterworkStatsApplied = true;
      }
    }

    debugSockets.push({ plugHash, plugCategory, stats: plugStats });
  }

  if (masterworkSocketSeen && !masterworkStatsApplied) {
    const fallbackStats = [];
    for (const entry of STAT_MAP) {
      adjustments[entry.id] = (adjustments[entry.id] ?? 0) + 2;
      fallbackStats.push({
        statHash: entry.id,
        statName: statDefs?.[entry.id]?.displayProperties?.name ?? null,
        value: 2,
      });
    }
    debugSockets.push({ plugHash: null, plugCategory: 'masterwork-fallback', stats: fallbackStats });
  }

  return { adjustments, debugSockets };
}

function buildStatLists(base, current) {
  return {
    baseList: STAT_MAP.map((entry) => base?.[entry.id] ?? 0),
    currentList: STAT_MAP.map((entry) => current?.[entry.id] ?? 0),
  };
}

export function computeArmorStatsFromItem(item, manifest) {
  const statsComponent = guardObject(item?.stats ?? item?.statsComponent);
  const dataStats = statsComponent?.data?.stats ?? statsComponent?.stats ?? statsComponent;
  const { adjustments, debugSockets } = accumulateSocketAdjustments(item, manifest);

  const base = {};
  const current = {};

  for (const stat of Object.values(dataStats ?? {})) {
    const statHash = Number(stat.statHash ?? stat.stat_id ?? stat.statId);
    const configEntry = STAT_MAP.find((entry) => entry.id === statHash);
    if (!configEntry) continue;
    const totalValue = num(stat?.value ?? stat?.actual ?? stat?.investmentValue ?? stat?.base ?? stat?.baseValue ?? 0);
    const adjustment = adjustments[statHash] ?? 0;
    const baseValue = Math.max(0, totalValue - adjustment);
    base[statHash] = baseValue;
    current[statHash] = totalValue;
  }

  const { baseList, currentList } = buildStatLists(base, current);
  const totalBase = statTotals(base);
  const totalCurrent = statTotals(current);

  debugLog('computeArmorStatsFromItem', {
    itemInstanceId: item?.itemInstanceId ?? item?.instanceId ?? item?.id ?? null,
    adjustments,
    base,
    current,
    sockets: debugSockets,
  });

  return {
    base,
    current,
    baseList,
    currentList,
    totalBase,
    totalCurrent,
  };
}

export function computeArmorStatsFromCsv(row) {
  const base = {};
  const current = {};
  for (const stat of STAT_MAP) {
    const baseKey = `${stat.label} (Base)`;
    const totalKey = `${stat.label} (Total)`;
    const baseValue = Math.max(
      0,
      num(row[baseKey] ?? row[stat.label] ?? row[stat.short] ?? 0)
    );
    const total = row[totalKey] ?? row[`${stat.label} (Current)`];
    base[stat.id] = baseValue;
    current[stat.id] = num(total, baseValue);
  }

  const { baseList, currentList } = buildStatLists(base, current);
  const totalBase = statTotals(base);
  const totalCurrent = statTotals(current);

  return {
    base,
    current,
    baseList,
    currentList,
    totalBase,
    totalCurrent,
  };
}

export function buildDisplayStatList(stats, view = 'BASE') {
  if (view === 'CURRENT') {
    if (Array.isArray(stats?.currentList)) return stats.currentList;
    return STAT_MAP.map((entry) => stats?.current?.[entry.id] ?? 0);
  }
  if (Array.isArray(stats?.baseList)) return stats.baseList;
  return STAT_MAP.map((entry) => stats?.base?.[entry.id] ?? 0);
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
