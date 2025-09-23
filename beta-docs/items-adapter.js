import { CORE, computeBaseArmorStats } from './armor-stats.js';
import { rateTotal } from './ranking.js';
import { buildGroupKey } from './grouping.js';

const CLASS_NAMES = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
  3: 'Unknown'
};

const CORE_NAMES = Object.keys(CORE);
const CORE_HASH_TO_NAME = new Map(Object.entries(CORE).map(([name, hash]) => [Number(hash), name]));

const CORE_TO_DIM = {
  mobility: 'Class (Base)',
  resilience: 'Health (Base)',
  recovery: 'Weapons (Base)',
  discipline: 'Grenade (Base)',
  intellect: 'Super (Base)',
  strength: 'Melee (Base)'
};

const loggedDefinitionFailures = new Set();

function createEmptyStatBlock() {
  const block = { total: 0 };
  for (const name of CORE_NAMES) {
    block[name] = 0;
  }
  return block;
}

function finalizeTotals(block) {
  let total = 0;
  for (const name of CORE_NAMES) {
    const value = Number(block[name]) || 0;
    block[name] = value;
    total += value;
  }
  block.total = total;
  return block;
}

function buildFallbackStatBlocks(statsPayload) {
  const base = createEmptyStatBlock();
  const current = createEmptyStatBlock();
  const stats = statsPayload?.stats || {};
  for (const [hashKey, entry] of Object.entries(stats)) {
    const statName = CORE_HASH_TO_NAME.get(Number(hashKey));
    if (!statName) {
      continue;
    }
    const baseValue =
      Number(entry?.base) || Number(entry?.baseStatValue) || Number(entry?.value) || 0;
    const currentValue = Number(entry?.value) || baseValue;
    base[statName] = baseValue;
    current[statName] = currentValue;
  }
  return { base: finalizeTotals(base), current: finalizeTotals(current) };
}

export async function buildRowsFromBungie({ profile, manifest }) {
  if (!profile) return [];
  const inst = profile?.itemComponents?.instances?.data || {};
  const stats = profile?.itemComponents?.stats?.data || {};
  const sockets = profile?.itemComponents?.sockets?.data || {};
  const plugStates = profile?.itemComponents?.plugStates?.data || {};
  const charEq = profile?.characterEquipment?.data || {};
  const charInv = profile?.characterInventories?.data || {};
  const profileInv = profile?.profileInventory?.data?.items || [];

  const index = new Map();

  Object.values(charEq).forEach((payload) => {
    (payload?.items || []).forEach((item) => {
      if (item?.itemInstanceId) {
        index.set(item.itemInstanceId, item);
      }
    });
  });
  Object.values(charInv).forEach((payload) => {
    (payload?.items || []).forEach((item) => {
      if (item?.itemInstanceId) {
        index.set(item.itemInstanceId, item);
      }
    });
  });
  profileInv.forEach((item) => {
    if (item?.itemInstanceId) {
      index.set(item.itemInstanceId, item);
    }
  });

  const rows = [];
  for (const [instanceId, info] of index.entries()) {
    if (!instanceId) continue;
    const instance = inst[instanceId];
    if (!instance) continue;
    const itemHash = info?.itemHash;
    if (!itemHash) continue;

    let definition;
    try {
      definition = await manifest.get('DestinyInventoryItemDefinition', itemHash);
    } catch (err) {
      const key = String(itemHash);
      if (!loggedDefinitionFailures.has(key)) {
        loggedDefinitionFailures.add(key);
        console.warn('Skipping item due to missing manifest definition', itemHash, err);
      }
      continue;
    }
    if (!definition) continue;
    const itemType = (definition.itemTypeDisplayName || definition.itemTypeAndTierDisplayName || '').toLowerCase();
    if (itemType.includes('weapon')) continue;
    if (!definition?.inventory?.bucketTypeHash) continue;

    const rarity = definition.inventory?.tierTypeName || '';
    const equippable = CLASS_NAMES[definition.classType] || 'Any';
    const slot = definition.itemTypeDisplayName || definition.itemTypeAndTierDisplayName || '';

    let statBlocks;
    try {
      statBlocks = await computeBaseArmorStats({
        itemStats: stats[instanceId],
        itemSockets: sockets[instanceId],
        itemPlugStates: plugStates[instanceId],
        itemInstance: instance,
        manifest
      });
    } catch (err) {
      console.warn(
        'Falling back to raw instance stats after compute failure',
        instanceId,
        err
      );
      statBlocks = buildFallbackStatBlocks(stats[instanceId]);
    }

    const row = {
      Id: String(instanceId),
      dimId: String(instanceId),
      Name: definition.displayProperties?.name || 'Unknown Item',
      Type: slot,
      Equippable: equippable,
      Rarity: rarity,
      Tier: Math.max(0, Math.floor((statBlocks.base?.total ?? 0) / 10)),
      'Total (Base)': statBlocks.base?.total ?? 0,
      _betaStats: {
        base: statBlocks.base,
        current: statBlocks.current
      }
    };

    for (const [coreKey, dimKey] of Object.entries(CORE_TO_DIM)) {
      const value = statBlocks.base?.[coreKey] ?? 0;
      row[dimKey] = value;
      const currentKey = dimKey.replace(' (Base)', '');
      row[currentKey] = statBlocks.current?.[coreKey] ?? value;
    }

    row.GroupKey = buildGroupKey(row);
    row.Rank = rateTotal({ rarity, total: row['Total (Base)'] });
    rows.push(row);
  }

  return rows;
}
