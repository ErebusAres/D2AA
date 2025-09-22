/**
 * armor-base-stats.js
 * -------------------------------------------
 * Small helper module that computes BASE armor stats for Destiny 2 items.
 *
 * Usage (ES module):
 *   import {
 *     computeBaseArmorStats,
 *     createManifestClient,
 *     installArmorStatTestHarness
 *   } from './armor-base-stats.js';
 *
 *   const manifest = createManifestClient({ apiKey: BUNGIE_API_KEY });
 *   const stats = await computeBaseArmorStats({
 *     membershipType,
 *     membershipId,
 *     itemInstanceId,
 *     apiKey: BUNGIE_API_KEY,
 *     accessToken: bungieAccessToken,
 *     manifest,
 *   });
 *
 *   console.log(stats.base, stats.current, stats.breakdown);
 *
 * The optional installArmorStatTestHarness helper wires a quick console
 * harness so you can validate results without additional scaffolding.
 */

const BUNGIE_API_ROOT = 'https://www.bungie.net';

/**
 * Canonical armor stat hashes and readable labels.
 */
export const CORE_STATS = {
  mobility: 2996146975,
  resilience: 392767087,
  recovery: 1943323491,
  discipline: 1735777505,
  intellect: 144602215,
  strength: 4244567218,
};

const CORE_HASHES = Object.values(CORE_STATS);
const HASH_TO_NAME = Object.fromEntries(
  Object.entries(CORE_STATS).map(([name, hash]) => [hash, name])
);

/**
 * Convert an unsigned Bungie hash into the signed form expected by the
 * manifest single-entity endpoints.
 */
function toSignedHash(hash) {
  const int = Number(hash);
  return int > 0x7fffffff ? int - 0x100000000 : int;
}

/**
 * Convenience wrapper for fetch that surfaces helpful errors.
 */
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${url}\n${body}`);
  }
  return response.json();
}

/**
 * Simple manifest client that memoizes lookups against the Bungie manifest
 * single-entity endpoints. Only the requested definitions are downloaded,
 * making it light-weight enough for static pages.
 */
export function createManifestClient({ apiKey } = {}) {
  if (!apiKey) {
    throw new Error('createManifestClient requires a Bungie API key');
  }

  const cache = new Map();
  const headers = { 'X-API-Key': apiKey };

  return {
    /**
     * Fetch a manifest entity and cache the result for the lifetime of the
     * manifest client. Repeated calls with the same table/hash are resolved
     * from memory.
     */
    async getDefinition(table, hash) {
      if (!table) throw new Error('Manifest getDefinition requires a table');
      if (hash === undefined || hash === null) return null;

      const cacheKey = `${table}:${hash}`;
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      const signedHash = toSignedHash(hash);
      const url = `${BUNGIE_API_ROOT}/Platform/Destiny2/Manifest/${table}/${signedHash}/`;
      const json = await fetchJson(url, { headers });
      const definition = json?.Response ?? null;
      cache.set(cacheKey, definition);
      return definition;
    },
  };
}

/**
 * Fetch the live item data required to compute armor stats.
 */
async function fetchInstancedItem({
  membershipType,
  membershipId,
  itemInstanceId,
  apiKey,
  accessToken,
}) {
  if (!membershipType || membershipType === undefined) {
    throw new Error('membershipType is required');
  }
  if (!membershipId) throw new Error('membershipId is required');
  if (!itemInstanceId) throw new Error('itemInstanceId is required');
  if (!apiKey) throw new Error('Bungie API key is required');
  if (!accessToken) throw new Error('Bungie OAuth access token is required');

  const params = new URLSearchParams({
    components: ['ItemInstances', 'ItemStats', 'ItemSockets', 'ItemPlugStates'].join(','),
  });

  const url = `${BUNGIE_API_ROOT}/Platform/Destiny2/${membershipType}/Profile/${membershipId}/Item/${itemInstanceId}/?${params}`;
  const headers = {
    'X-API-Key': apiKey,
    Authorization: `Bearer ${accessToken}`,
  };
  const json = await fetchJson(url, { headers });
  const response = json?.Response ?? {};

  return {
    instance: response?.instance?.data ?? null,
    stats: response?.stats?.data ?? null,
    sockets: response?.sockets?.data ?? null,
    plugStates: response?.plugStates?.data ?? null,
  };
}

/**
 * Create an object keyed by readable stat names with zeroed values.
 */
function createEmptyStatMap() {
  return {
    mobility: 0,
    resilience: 0,
    recovery: 0,
    discipline: 0,
    intellect: 0,
    strength: 0,
  };
}

/**
 * Convert a map keyed by stat hash to a named map using the canonical armor
 * stat names.
 */
function mapHashesToNames(hashMap) {
  const named = createEmptyStatMap();
  for (const [hash, value] of Object.entries(hashMap)) {
    const name = HASH_TO_NAME[hash];
    if (name) named[name] = value;
  }
  return named;
}

/**
 * Extract the current (bonus-applied) stat values from the ItemStats payload.
 */
function extractCurrentStats(statsPayload) {
  const stats = statsPayload?.stats ?? {};
  const result = createEmptyStatMap();
  for (const hash of CORE_HASHES) {
    const name = HASH_TO_NAME[hash];
    result[name] = stats?.[hash]?.value ?? 0;
  }
  return result;
}

/**
 * Detect whether the armor is masterworked (energy 10 or explicit flag).
 */
function isMasterworked(instanceData) {
  if (!instanceData) return false;
  if (instanceData.isMasterwork) return true;
  const energyCap = instanceData.energy?.energyCapacity;
  return energyCap === 10;
}

/**
 * Identify whether a plug represents an artifice +3 armor mod.
 */
function isArtificeStatPlug(plugDef) {
  const id = plugDef?.plug?.plugCategoryIdentifier || '';
  return id === 'enhancements.artifice' || id === 'enhancements.artifice.stat';
}

/**
 * Identify whether a plug represents a masterwork stat bonus.
 */
function isMasterworkStatPlug(plugDef) {
  const id = (plugDef?.plug?.plugCategoryIdentifier || '').toLowerCase();
  return id.includes('masterwork');
}

let MODULE_URL = '';
try {
  MODULE_URL = import.meta.url || '';
} catch (_err) {
  MODULE_URL = '';
}

function isDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.location?.search?.includes('debug=1');
  } catch (_err) {
    return false;
  }
}

/**
 * Convert an ItemPlugStates payload into a quick lookup map so we can verify
 * that the currently socketed plug is enabled.
 */
function buildPlugStateLookup(plugStates) {
  const lookup = new Map();
  if (!plugStates?.plugs) return lookup;
  for (const [socketIndex, states] of Object.entries(plugStates.plugs)) {
    lookup.set(Number(socketIndex), Array.isArray(states) ? states : []);
  }
  return lookup;
}

/**
 * Gather the plug hash that is currently socketed and enabled.
 */
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

  const matchingState = states.find((state) => state.plugHash === plugHash);
  if (!matchingState) return plugHash;
  return matchingState.isEnabled === false ? null : plugHash;
}

/**
 * Compute the stat adjustments contributed by the equipped plugs.
 */
async function aggregateSocketAdjustments({ sockets, plugStates, manifest }) {
  const modsByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  const artificeByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  const masterworkByHash = Object.fromEntries(CORE_HASHES.map((hash) => [hash, 0]));
  const plugDetails = [];
  if (!sockets?.sockets?.length) {
    return { modsByHash, artificeByHash, masterworkByHash, plugDetails };
  }

  if (!manifest?.getDefinition) {
    throw new Error('A manifest client with getDefinition(table, hash) is required');
  }

  const plugStateLookup = buildPlugStateLookup(plugStates);
  const definitionPromises = [];
  const socketInfos = [];
  const seenPlugs = new Set();

  sockets.sockets.forEach((socket, index) => {
    const plugHash = getEquippedPlugHash(socket, index, plugStateLookup);
    if (!plugHash) return;

    const key = `${index}:${plugHash}`;
    if (seenPlugs.has(key)) return;
    seenPlugs.add(key);

    socketInfos.push({ plugHash, index });
    definitionPromises.push(
      manifest.getDefinition('DestinyInventoryItemDefinition', plugHash)
    );
  });

  const definitions = await Promise.all(definitionPromises);

  const debugTelemetry = isDebugEnabled();

  socketInfos.forEach(({ plugHash, index }, idx) => {
    const plugDef = definitions[idx];
    if (!plugDef?.investmentStats?.length) return;

    const isMasterwork = isMasterworkStatPlug(plugDef);
    const isArtifice = !isMasterwork && isArtificeStatPlug(plugDef);
    const targetMap = isMasterwork ? masterworkByHash : isArtifice ? artificeByHash : modsByHash;
    const statBreakdown = {};
    let hasCoreAdjustments = false;

    for (const stat of plugDef.investmentStats) {
      if (!CORE_HASHES.includes(stat.statTypeHash)) continue;
      const value = stat.value ?? 0;
      if (value === 0) continue;
      targetMap[stat.statTypeHash] += value;
      if (debugTelemetry && value === 3) {
        console.log('[D2AA][artifice] +3 stat adjustment', {
          plugName: plugDef.displayProperties?.name ?? 'Unknown Plug',
          plugCategoryIdentifier: plugDef?.plug?.plugCategoryIdentifier ?? null,
          statHash: stat.statTypeHash,
          socketIndex: index,
          source: MODULE_URL,
        });
      }
      statBreakdown[HASH_TO_NAME[stat.statTypeHash]] =
        (statBreakdown[HASH_TO_NAME[stat.statTypeHash]] ?? 0) + value;
      hasCoreAdjustments = true;
    }

    if (hasCoreAdjustments) {
      plugDetails.push({
        plugHash,
        name: plugDef.displayProperties?.name ?? 'Unknown Plug',
        isArtifice,
        isMasterwork,
        socketIndex: index,
        byStat: statBreakdown,
      });
    }
  });

  return { modsByHash, artificeByHash, masterworkByHash, plugDetails };
}

/**
 * Transform a hash keyed map into a readable structure containing stat totals
 * and a convenience `total` sum.
 */
function finalizeStatBlock(hashMap) {
  const named = mapHashesToNames(hashMap);
  named.total = Object.values(named).reduce((acc, value) => acc + value, 0);
  return named;
}

/**
 * Compute current and base armor stats for an instanced item.
 */
export async function computeBaseArmorStats({
  membershipType,
  membershipId,
  itemInstanceId,
  apiKey,
  accessToken,
  manifest,
}) {
  const { instance, stats, sockets, plugStates } = await fetchInstancedItem({
    membershipType,
    membershipId,
    itemInstanceId,
    apiKey,
    accessToken,
  });

  const current = extractCurrentStats(stats);
  const manifestClient = manifest ?? createManifestClient({ apiKey });
  const { modsByHash, artificeByHash, masterworkByHash, plugDetails } = await aggregateSocketAdjustments({
    sockets,
    plugStates,
    manifest: manifestClient,
  });

  const masterworkFallback = isMasterworked(instance) ? 2 : 0;

  const baseByHash = Object.fromEntries(
    CORE_HASHES.map((hash) => {
      const name = HASH_TO_NAME[hash];
      const currentValue = current[name] ?? 0;
      const totalMods = (modsByHash[hash] ?? 0) + (artificeByHash[hash] ?? 0);
      const masterworkAdjustment = masterworkByHash[hash] ?? 0;
      const fallbackMasterwork = masterworkAdjustment === 0 ? masterworkFallback : 0;
      const baseValue = Math.max(
        0,
        currentValue - totalMods - masterworkAdjustment - fallbackMasterwork
      );
      return [hash, baseValue];
    })
  );

  const base = finalizeStatBlock(baseByHash);
  const currentBlock = (() => {
    const map = Object.fromEntries(
      CORE_HASHES.map((hash) => [hash, current[HASH_TO_NAME[hash]] ?? 0])
    );
    return finalizeStatBlock(map);
  })();

  const modsBreakdown = finalizeStatBlock(modsByHash);
  const artificeBreakdown = finalizeStatBlock(artificeByHash);
  const masterworkBreakdown = finalizeStatBlock(masterworkByHash);

  return {
    base,
    current: currentBlock,
    breakdown: {
      modsByStat: modsBreakdown,
      artificeByStat: artificeBreakdown,
      masterworkByStat: masterworkBreakdown,
      masterwork: masterworkFallback,
      subtractedPlugs: plugDetails,
    },
  };
}

/**
 * Optional helper that wires a quick console harness. Calling the returned
 * function (or window.runArmorStatTest) with an item instance id will fetch
 * and log the computed stats for easy verification.
 */
export function installArmorStatTestHarness({
  membershipType,
  membershipId,
  apiKey,
  accessToken,
  manifest,
  exposeToWindow = true,
} = {}) {
  const manifestClient = manifest ?? (apiKey ? createManifestClient({ apiKey }) : null);
  if (!manifestClient) {
    throw new Error('installArmorStatTestHarness requires a manifest client or apiKey');
  }

  const harness = async (itemInstanceId) => {
    if (!itemInstanceId) throw new Error('Pass an itemInstanceId to test');
    const result = await computeBaseArmorStats({
      membershipType,
      membershipId,
      itemInstanceId,
      apiKey,
      accessToken,
      manifest: manifestClient,
    });
    console.group(`Armor stat breakdown for ${itemInstanceId}`);
    console.table(result.current);
    console.log('Base stats:', result.base);
    console.log('Breakdown:', result.breakdown);
    console.groupEnd();
    return result;
  };

  if (exposeToWindow && typeof window !== 'undefined') {
    window.runArmorStatTest = harness;
  }

  return harness;
}

/**
 * Inline test harness snippet (copy/paste ready):
 *
 * import { createManifestClient, computeBaseArmorStats } from './armor-base-stats.js';
 *
 * const manifest = createManifestClient({ apiKey: BUNGIE_API_KEY });
 * const result = await computeBaseArmorStats({
 *   membershipType: 3,               // e.g. Steam
 *   membershipId: '1234567890',      // your membership id
 *   itemInstanceId: '9876543210',    // armor instance id
 *   apiKey: BUNGIE_API_KEY,
 *   accessToken: bungieAccessToken,
 *   manifest,
 * });
 * console.log(result);
 */

