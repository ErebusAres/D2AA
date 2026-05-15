import { STAT_MAP } from './config.js';
import { computeArmorStatsFromCsv, computeArmorStatsFromItem, isArmorItem } from './armor-stats.js';
import { guardObject, mergeDimTag, normId } from './utils.js';

const CLASS_NAMES = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
};

function resolveClass(definition, manifest) {
  const classType = definition?.classType;
  if (classType in CLASS_NAMES) return CLASS_NAMES[classType];
  const classHash = definition?.classTypeHash;
  const classDef = manifest?.classDefs?.[classHash];
  if (classDef?.displayProperties?.name) {
    return classDef.displayProperties.name;
  }
  return 'Unknown';
}

function resolveSlot(definition) {
  return definition?.itemTypeDisplayName ?? definition?.inventory?.bucketTypeHash ?? 'Armor';
}

function resolveTier(definition) {
  return definition?.inventory?.tierTypeName ?? definition?.inventory?.tierType ?? 'Unknown';
}

export function adaptBungieItems(items, manifest, dimTags = new Map()) {
  const defs = manifest?.inventoryItem ?? {};
  const adapted = [];

  for (const item of items ?? []) {
    const definition = defs[item.itemHash];
    if (!isArmorItem(definition)) continue;
    const stats = computeArmorStatsFromItem(item, manifest);
    const name = definition?.displayProperties?.name ?? 'Unknown Item';
    const icon = definition?.displayProperties?.icon;
    const rarity = resolveTier(definition);
    const classType = resolveClass(definition, manifest);
    const slot = resolveSlot(definition);

    const row = {
      id: normId(item.itemInstanceId ?? `${item.itemHash}`),
      itemHash: item.itemHash,
      itemInstanceId: item.itemInstanceId ?? null,
      name,
      icon,
      rarity,
      classType,
      slot,
      tier: rarity,
      stats,
      totalBase: stats.totalBase,
      totalCurrent: stats.totalCurrent,
      source: 'bungie',
      rawItem: item,
      definition,
    };

    adapted.push(mergeDimTag(row, dimTags));
  }

  return adapted;
}

export function adaptCsvRows(rows, dimTags = new Map()) {
  return (rows ?? []).map((row) => {
    const stats = computeArmorStatsFromCsv(row);
    const itemInstanceId = row.Id ? normId(row.Id) : null;
    const adapted = {
      id: itemInstanceId ?? row.Id ?? row.Name,
      itemInstanceId,
      name: row.Name ?? row.Item ?? 'Unknown Item',
      icon: row.Icon ?? null,
      rarity: row.Tier ?? row.Rarity ?? 'Unknown',
      classType: row.Class ?? row.ClassType ?? 'Unknown',
      slot: row.Slot ?? row.Bucket ?? row.EquipSlot ?? 'Armor',
      tier: row.Tier ?? row.Rarity ?? 'Unknown',
      stats,
      totalBase: stats.totalBase,
      totalCurrent: stats.totalCurrent,
      raw: row,
      source: 'csv',
    };
    return mergeDimTag(adapted, dimTags);
  });
}
