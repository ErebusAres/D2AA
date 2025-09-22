import { computeBaseArmorStats, CORE_STAT_KEYS } from './armor-stats.js';

const BUCKET_TO_SLOT = {
  3448274439: 'Helmet',
  3551918588: 'Gauntlets',
  14239492: 'Chest Armor',
  20886954: 'Leg Armor',
  1585787867: 'Class Item',
};

const SLOT_ORDER = {
  Helmet: 0,
  Gauntlets: 1,
  'Chest Armor': 2,
  'Leg Armor': 3,
  'Class Item': 4,
};

const CLASS_LABELS = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
  3: 'Unknown',
};

const BUNGIE_CONTENT_BASE = 'https://www.bungie.net';

export function selectDefaultCharacterId(profile) {
  const characterEntries = Object.entries(profile?.characters?.data ?? {});
  if (!characterEntries.length) return null;
  characterEntries.sort(([, a], [, b]) => {
    const aDate = new Date(a?.dateLastPlayed ?? 0).getTime();
    const bDate = new Date(b?.dateLastPlayed ?? 0).getTime();
    return bDate - aDate;
  });
  return characterEntries[0][0];
}

export function summarizeCharacters(profile) {
  const characters = profile?.characters?.data ?? {};
  return Object.entries(characters).map(([characterId, data]) => ({
    characterId,
    classType: data?.classType ?? 3,
    className: CLASS_LABELS[data?.classType ?? 3] ?? 'Guardian',
    light: data?.light ?? null,
    emblemPath: data?.emblemPath ? `${BUNGIE_CONTENT_BASE}${data.emblemPath}` : null,
    dateLastPlayed: data?.dateLastPlayed ?? null,
  }));
}

function collectCharacterItems(profile, characterId) {
  const equipment = profile?.characterEquipment?.data?.[characterId]?.items ?? [];
  const inventory = profile?.characterInventories?.data?.[characterId]?.items ?? [];
  const itemsByInstance = new Map();

  for (const item of equipment) {
    const key = item.itemInstanceId || `${item.itemHash}:equipped`;
    itemsByInstance.set(key, { ...item, isEquipped: true });
  }

  for (const item of inventory) {
    const key = item.itemInstanceId || `${item.itemHash}:${item.bucketHash}`;
    if (itemsByInstance.has(key)) continue;
    itemsByInstance.set(key, { ...item, isEquipped: false });
  }

  return Array.from(itemsByInstance.values());
}

function buildDefinitionLookup(items, manifest) {
  const uniqueHashes = Array.from(new Set(items.map((item) => item.itemHash)));
  const promises = uniqueHashes.map((hash) => manifest.getInventoryItem(hash));
  return Promise.all(promises).then((defs) => {
    const map = new Map();
    uniqueHashes.forEach((hash, index) => {
      map.set(hash, defs[index]);
    });
    return map;
  });
}

function resolveBucket(definition, fallbackBucket) {
  return definition?.inventory?.bucketTypeHash ?? fallbackBucket ?? null;
}

function buildRow({
  item,
  definition,
  instance,
  itemStats,
  itemSockets,
  itemPlugStates,
  manifest,
}) {
  const bucketHash = resolveBucket(definition, item.bucketHash);
  const slot = BUCKET_TO_SLOT[bucketHash];
  if (!slot) return null;
  if (!definition?.itemCategoryHashes?.includes(20)) return null; // ensure armor

  const statsPromise = computeBaseArmorStats({
    itemStats,
    itemSockets,
    itemPlugStates,
    itemInstance: instance,
    manifest,
  }).catch((error) => {
    console.error('[D2AA][items-adapter] Failed to compute stats', error, item);
    return null;
  });

  return statsPromise.then((statBlocks) => {
    if (!statBlocks) return null;
    const iconPath = definition?.displayProperties?.icon;
    const icon = iconPath ? `${BUNGIE_CONTENT_BASE}${iconPath}` : null;
    const tier = definition?.inventory?.tierTypeName ?? 'Unknown';
    const primaryStat = instance?.primaryStat?.value ?? instance?.powerLevel ?? null;
    const energyCapacity = instance?.energy?.energyCapacity ?? null;
    const energyTypeHash = instance?.energy?.energyTypeHash ?? null;

    const typeName = definition?.itemTypeDisplayName || slot;
    const classType = definition?.classType ?? 3;

    return {
      id: item.itemInstanceId || `${item.itemHash}:${slot}`,
      itemHash: item.itemHash,
      icon,
      name: definition?.displayProperties?.name || 'Unknown Armor',
      typeName,
      slot,
      tier,
      rarityClass: tier.toLowerCase().replace(/\s+/g, '-'),
      power: primaryStat,
      isEquipped: Boolean(item.isEquipped || item.state === 1),
      energyCapacity,
      energyTypeHash,
      classType,
      className: CLASS_LABELS[classType] ?? 'Guardian',
      baseStats: statBlocks.base,
      currentStats: statBlocks.current,
      breakdown: statBlocks.breakdown,
      statOrder: [...CORE_STAT_KEYS],
    };
  });
}

export async function adaptItems({
  profile,
  membershipId,
  membershipType,
  manifest,
  selectedCharacterId,
}) {
  if (!profile) return [];
  if (!manifest) {
    throw new Error('adaptItems requires a manifest client');
  }

  const characterId =
    selectedCharacterId || selectDefaultCharacterId(profile) || null;
  if (!characterId) return [];

  const items = collectCharacterItems(profile, characterId);
  if (!items.length) return [];

  const definitionLookup = await buildDefinitionLookup(items, manifest);

  const instances = profile?.itemComponents?.instances?.data ?? {};
  const stats = profile?.itemComponents?.stats?.data ?? {};
  const sockets = profile?.itemComponents?.sockets?.data ?? {};
  const plugStates = profile?.itemComponents?.plugStates?.data ?? {};

  const rowPromises = items.map((item) => {
    const definition = definitionLookup.get(item.itemHash);
    if (!definition) return Promise.resolve(null);
    const instance = item.itemInstanceId ? instances[item.itemInstanceId] : null;
    const itemStats = item.itemInstanceId ? stats[item.itemInstanceId] : null;
    const itemSockets = item.itemInstanceId ? sockets[item.itemInstanceId] : null;
    const itemPlugStates = item.itemInstanceId ? plugStates[item.itemInstanceId] : null;

    return buildRow({
      item,
      definition,
      instance,
      itemStats,
      itemSockets,
      itemPlugStates,
      manifest,
    });
  });

  const rows = (await Promise.all(rowPromises)).filter(Boolean);

  rows.sort((a, b) => {
    const slotDiff = (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99);
    if (slotDiff !== 0) return slotDiff;
    const totalDiff = (b.baseStats?.total ?? 0) - (a.baseStats?.total ?? 0);
    if (totalDiff !== 0) return totalDiff;
    return a.name.localeCompare(b.name);
  });

  return rows;
}
