export const CORE = {
  mobility: 2996146975,
  resilience: 392767087,
  recovery: 1943323491,
  discipline: 1735777505,
  intellect: 144602215,
  strength: 4244567218
};

const CORE_HASHES = Object.values(CORE);
const HASH_TO_NAME = Object.fromEntries(
  Object.entries(CORE).map(([key, value]) => [value, key])
);

function emptyBlock() {
  return {
    mobility: 0,
    resilience: 0,
    recovery: 0,
    discipline: 0,
    intellect: 0,
    strength: 0
  };
}

function isMasterworked(instance) {
  return !!(instance?.isMasterwork || (instance?.energy?.energyCapacity === 10));
}

function isArtificePlug(def) {
  const id = def?.plug?.plugCategoryIdentifier || '';
  return id === 'enhancements.artifice' || id === 'enhancements.artifice.stat';
}

function isMasterworkPlug(def) {
  const id = (def?.plug?.plugCategoryIdentifier || '').toLowerCase();
  return id.includes('masterwork');
}

function extractCurrent(statsPayload) {
  const stats = statsPayload?.stats ?? {};
  const mapped = emptyBlock();
  for (const hash of CORE_HASHES) {
    mapped[HASH_TO_NAME[hash]] = stats?.[hash]?.value ?? 0;
  }
  return mapped;
}

export async function computeBaseArmorStats({
  itemStats,
  itemSockets,
  itemPlugStates,
  itemInstance,
  manifest
}) {
  const current = extractCurrent(itemStats);

  const plugStateMap = new Map(
    Object.entries(itemPlugStates?.plugs || {}).map(([socketIndex, entries]) => [Number(socketIndex), entries || []])
  );

  const definitionPromises = [];
  const socketHashes = [];

  (itemSockets?.sockets || []).forEach((socket, idx) => {
    const plugHash = socket?.plugHash ?? socket?.plug?.plugHash ?? socket?.plugged?.plugHash;
    if (!plugHash || socket?.isEnabled === false) {
      return;
    }
    const states = plugStateMap.get(idx);
    if (states && states.length) {
      const match = states.find((s) => s.plugHash === plugHash);
      if (match && match.isEnabled === false) {
        return;
      }
    }
    socketHashes.push(plugHash);
    definitionPromises.push(manifest.get('DestinyInventoryItemDefinition', plugHash));
  });

  const definitionResults = await Promise.allSettled(definitionPromises);
  const definitions = definitionResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.warn(
      'Failed to load socket plug definition',
      socketHashes[index],
      result.reason
    );
    return null;
  });
  const modsByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  const artificeByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  const masterworkByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  let sawMasterworkPlug = false;

  definitions.forEach((def) => {
    if (!def?.investmentStats?.length) {
      return;
    }
    const target = isMasterworkPlug(def)
      ? ((sawMasterworkPlug = true), masterworkByHash)
      : isArtificePlug(def)
      ? artificeByHash
      : modsByHash;
    for (const stat of def.investmentStats) {
      if (!CORE_HASHES.includes(stat.statTypeHash)) {
        continue;
      }
      const value = stat.value ?? 0;
      if (value) {
        target[stat.statTypeHash] += value;
      }
    }
  });

  const mwFallback = isMasterworked(itemInstance) && !sawMasterworkPlug ? 2 : 0;

  const baseByHash = Object.fromEntries(
    CORE_HASHES.map((hash) => {
      const name = HASH_TO_NAME[hash];
      const totalMods = (modsByHash[hash] || 0) + (artificeByHash[hash] || 0);
      const masterwork = masterworkByHash[hash] || 0;
      const value = Math.max(0, (current[name] || 0) - totalMods - masterwork - mwFallback);
      return [hash, value];
    })
  );

  const asNamed = (mapping) => {
    const block = emptyBlock();
    for (const [hash, value] of Object.entries(mapping)) {
      block[HASH_TO_NAME[hash]] = value;
    }
    block.total = Object.values(block).reduce((sum, v) => sum + v, 0);
    return block;
  };

  const base = asNamed(baseByHash);
  const currentBlock = {
    ...current,
    total: Object.values(current).reduce((sum, v) => sum + v, 0)
  };

  return {
    base,
    current: currentBlock,
    breakdown: {
      modsByStat: asNamed(modsByHash),
      artificeByStat: asNamed(artificeByHash),
      masterworkByStat: asNamed(masterworkByHash),
      masterworkFallback: mwFallback
    }
  };
}
