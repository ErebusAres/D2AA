import { objectFromKeys, sum } from './utils.js';

export const CORE_STAT_HASHES = {
  mobility: 2996146975,
  resilience: 392767087,
  recovery: 1943323491,
  discipline: 1735777505,
  intellect: 144602215,
  strength: 4244567218,
};

export const CORE_STAT_KEYS = Object.keys(CORE_STAT_HASHES);
const CORE_HASHES = Object.values(CORE_STAT_HASHES);
const HASH_TO_NAME = Object.fromEntries(
  CORE_STAT_KEYS.map((key) => [CORE_STAT_HASHES[key], key])
);

function createEmptyHashMap() {
  return Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
}

function finalizeStatBlock(hashMap) {
  const block = CORE_STAT_KEYS.reduce((acc, key) => {
    const hash = CORE_STAT_HASHES[key];
    acc[key] = Number(hashMap?.[hash]) || 0;
    return acc;
  }, {});
  block.total = sum(Object.values(block));
  return block;
}

function extractCurrentStats(statsComponent) {
  const stats = statsComponent?.stats ?? {};
  const byHash = createEmptyHashMap();
  for (const hash of CORE_HASHES) {
    const entry = stats[hash] ?? stats[String(hash)];
    byHash[hash] = entry?.value ?? 0;
  }
  return finalizeStatBlock(byHash);
}

function buildPlugStateLookup(plugStates) {
  const lookup = new Map();
  const plugs = plugStates?.plugs ?? {};
  for (const [socketIndex, states] of Object.entries(plugs)) {
    lookup.set(Number(socketIndex), Array.isArray(states) ? states : []);
  }
  return lookup;
}

function getEquippedPlugHash(socket, index, plugStateLookup) {
  if (!socket) return null;
  const plugHash =
    socket.plugHash ??
    socket.plug?.plugHash ??
    socket.plugged?.plugHash ??
    null;
  if (!plugHash) return null;

  if (socket.isEnabled === false) return null;

  const states = plugStateLookup.get(index);
  if (!states || states.length === 0) {
    return plugHash;
  }
  const matching = states.find((state) => state.plugHash === plugHash);
  if (!matching) return plugHash;
  return matching.isEnabled === false ? null : plugHash;
}

function classifyPlug(definition) {
  const identifier = definition?.plug?.plugCategoryIdentifier;
  if (!identifier) return 'mod';
  if (
    identifier === 'enhancements.artifice' ||
    identifier === 'enhancements.artifice.stat'
  ) {
    return 'artifice';
  }
  if (identifier.toLowerCase().includes('masterwork')) {
    return 'masterwork';
  }
  return 'mod';
}

async function aggregateSocketAdjustments({ itemSockets, itemPlugStates, manifest }) {
  const modsByHash = createEmptyHashMap();
  const artificeByHash = createEmptyHashMap();
  const masterworkByHash = createEmptyHashMap();
  const plugDetails = [];

  const sockets = itemSockets?.sockets ?? [];
  if (!sockets.length) {
    return { modsByHash, artificeByHash, masterworkByHash, plugDetails };
  }
  if (!manifest || typeof manifest.getDefinition !== 'function') {
    throw new Error('A manifest client with getDefinition(table, hash) is required');
  }

  const plugStateLookup = buildPlugStateLookup(itemPlugStates);
  const seen = new Set();
  const definitions = [];
  const socketMetadata = [];

  sockets.forEach((socket, index) => {
    const plugHash = getEquippedPlugHash(socket, index, plugStateLookup);
    if (!plugHash) return;
    const key = `${index}:${plugHash}`;
    if (seen.has(key)) return;
    seen.add(key);
    socketMetadata.push({ plugHash, index });
    definitions.push(manifest.getDefinition('DestinyInventoryItemDefinition', plugHash));
  });

  const resolvedDefinitions = await Promise.all(definitions);

  socketMetadata.forEach(({ plugHash, index }, idx) => {
    const definition = resolvedDefinitions[idx];
    if (!definition?.investmentStats?.length) return;
    const classification = classifyPlug(definition);
    const targetMap =
      classification === 'masterwork'
        ? masterworkByHash
        : classification === 'artifice'
        ? artificeByHash
        : modsByHash;
    const statBreakdown = objectFromKeys(CORE_STAT_KEYS, () => 0);
    let applied = false;

    for (const stat of definition.investmentStats) {
      if (!CORE_HASHES.includes(stat.statTypeHash)) continue;
      const value = stat.value ?? 0;
      if (!value) continue;
      targetMap[stat.statTypeHash] += value;
      statBreakdown[HASH_TO_NAME[stat.statTypeHash]] += value;
      applied = true;
    }

    if (applied) {
      plugDetails.push({
        plugHash,
        plugName: definition.displayProperties?.name ?? 'Unknown Plug',
        socketIndex: index,
        classification,
        byStat: statBreakdown,
        plugCategoryIdentifier: definition?.plug?.plugCategoryIdentifier ?? null,
      });
    }
  });

  return { modsByHash, artificeByHash, masterworkByHash, plugDetails };
}

function isMasterworked(instance) {
  if (!instance) return false;
  if (instance.isMasterwork) return true;
  const energy = instance.energy;
  return energy?.energyCapacity === 10;
}

export async function computeBaseArmorStats({
  itemStats,
  itemSockets,
  itemPlugStates,
  itemInstance,
  manifest,
}) {
  const current = extractCurrentStats(itemStats);
  const { modsByHash, artificeByHash, masterworkByHash, plugDetails } =
    await aggregateSocketAdjustments({
      itemSockets,
      itemPlugStates,
      manifest,
    });

  const hasMasterworkPlug = Object.values(masterworkByHash).some((value) => value !== 0);
  const fallback = isMasterworked(itemInstance) && !hasMasterworkPlug ? 2 : 0;

  const baseByHash = createEmptyHashMap();
  for (const hash of CORE_HASHES) {
    const statName = HASH_TO_NAME[hash];
    const currentValue = current[statName] ?? 0;
    const modValue = modsByHash[hash] ?? 0;
    const artificeValue = artificeByHash[hash] ?? 0;
    const masterworkValue = masterworkByHash[hash] ?? 0;
    const fallbackValue = masterworkValue === 0 ? fallback : 0;
    const baseValue = Math.max(0, currentValue - modValue - artificeValue - masterworkValue - fallbackValue);
    baseByHash[hash] = baseValue;
  }

  return {
    base: finalizeStatBlock(baseByHash),
    current,
    breakdown: {
      modsByStat: finalizeStatBlock(modsByHash),
      artificeByStat: finalizeStatBlock(artificeByHash),
      masterworkByStat: finalizeStatBlock(masterworkByHash),
      masterworkFallback: fallback,
      subtractedPlugs: plugDetails,
    },
  };
}
