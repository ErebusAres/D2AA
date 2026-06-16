import type { ArmorItem } from '../types/armor';
import type { BungieInventoryItem, BungieItemInstance, BungieProfileResponse, BungieSocketComponent, DestinyInventoryItemDefinition } from '../types/bungie';
import { CLASS_ITEM_BY_CLASS, ITEM_STATE_LOCKED, VAULT_BUCKET_HASH } from '../utils/itemIds';
import { bungieFetch, bungieIconUrl, getMembership, mapLimit, toUint32 } from './bungieApi';
import { isSignedIn, startLogin } from './bungieAuth';
import { getInventoryItemDefinition, getPlugSetDefinition } from './bungieManifest';
import { ARMOR_STAT_HASH_TO_KEY, auditArmorStats } from './armorStatAudit';
import { resolveArmorArchetype } from './armorArchetype';
import { ARMOR_SET_SELECTOR_HASHES, resolveArmorBonusPerks, resolveExoticArmorPerks, resolvePotentialSetBonuses } from './armorBonuses';
import { saveBungieInventory } from './inventoryCache';

const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305, 307].join(',');
const CLASS_TYPE: Record<number, string> = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Any' };

export async function syncBungieInventory(setStatus: (status: string) => void, reason = 'manual-sync'): Promise<ArmorItem[]> {
  if (!isSignedIn()) {
    setStatus('Connect your Destiny account before syncing armor.');
    return [];
  }
  setStatus('Fetching Bungie profile...');
  const membership = await getMembership();
  const profile = await bungieFetch<BungieProfileResponse>(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
  const rows = await buildArmorRows(profile, membership.membershipType, setStatus);
  const saved = await saveBungieInventory(rows, reason);
  setStatus(`Bungie sync complete: ${saved.rows.length} armor. New armor: ${saved.meta.added || 0}.`);
  return saved.rows;
}

export function connectBungie(): void {
  startLogin();
}

async function buildArmorRows(profile: BungieProfileResponse, membershipType: number, setStatus: (status: string) => void): Promise<ArmorItem[]> {
  const allItems = collectItems(profile);
  const statComponents = profile.itemComponents?.stats?.data || {};
  const instanceComponents = profile.itemComponents?.instances?.data || {};
  const socketComponents = profile.itemComponents?.sockets?.data || {};
  const stateComponents = profile.itemComponents?.state?.data || {};
  const characterMap = buildCharacterMap(profile);
  const uniqueItemHashes = unique(allItems.map((item) => toUint32(item.itemHash)).filter(Boolean));
  setStatus(`Resolving item definitions: 0/${uniqueItemHashes.length}`);
  const defs = await mapLimit(uniqueItemHashes, 8, (hash) => getInventoryItemDefinition(hash), (done, total) => setStatus(`Resolving item definitions: ${done}/${total}`));
  const itemDefs = new Map(uniqueItemHashes.map((hash, index) => [hash, defs[index]]));
  const armorItems = allItems.filter((item) => item.itemInstanceId && isArmorDef(itemDefs.get(toUint32(item.itemHash))));

  const plugSetHashes = unique(armorItems.flatMap((item) => plugSetHashesForItem(itemDefs.get(toUint32(item.itemHash)), socketComponents[item.itemInstanceId || ''])).filter(Boolean));
  const plugSetDefs = new Map((await mapLimit(plugSetHashes, 8, (hash) => getPlugSetDefinition(hash))).map((def, index) => [plugSetHashes[index], def]));
  const plugHashes = unique([...armorItems.flatMap((item) => allPlugHashes(itemDefs.get(toUint32(item.itemHash)), socketComponents[item.itemInstanceId || ''], plugSetDefs)), ...ARMOR_SET_SELECTOR_HASHES].filter(Boolean));
  const plugDefs = new Map((await mapLimit(plugHashes, 8, (hash) => getInventoryItemDefinition(hash), (done, total) => setStatus(`Resolving armor plugs: ${done}/${total}`))).map((def, index) => [plugHashes[index], def]));
  const selectorPlugDefs = ARMOR_SET_SELECTOR_HASHES.map((hash) => plugDefs.get(toUint32(hash))).filter(isDefinition);

  const rows: ArmorItem[] = [];
  const seen = new Set<string>();
  for (const item of allItems) {
    const instanceId = item.itemInstanceId;
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    const def = itemDefs.get(toUint32(item.itemHash));
    if (!isArmorDef(def)) continue;
    const socketComponent = socketComponents[instanceId];
    const activePlugDefs = activePlugHashes(socketComponent).map((hash) => plugDefs.get(hash)).filter(isDefinition);
    const allPlugDefs = allPlugHashes(def, socketComponent, plugSetDefs).map((hash) => plugDefs.get(hash)).filter(isDefinition);
    const slot = slotForItem(def);
    const equippable = CLASS_TYPE[Number(def.classType)] || 'Any';
    const rarity = rarityForItem(def);
    const audit = auditArmorStats({ itemDefinition: def, statComponent: statComponents[instanceId], activePlugDefs, allPlugDefs, iconUrl: bungieIconUrl });
    const instance = instanceComponents[instanceId];
    const stateValue = Number(stateComponents[instanceId]?.state ?? item.state ?? 0);
    const ornament = activeOrnament(activePlugDefs);
    const archetype = resolveArmorArchetype({ itemDefinition: def, plugDefs: allPlugDefs, hashToColumn: ARMOR_STAT_HASH_TO_KEY, iconUrl: bungieIconUrl });
    const setBonuses = rarity === 'Exotic' ? [] : resolvePotentialSetBonuses({ itemDefinition: def, activePlugDefs, allPlugDefs, selectorPlugDefs, archetypeHash: archetype.hash, iconUrl: bungieIconUrl });
    const armorBonuses = rarity === 'Exotic' ? [] : resolveArmorBonusPerks({ activePlugDefs, archetypeHash: archetype.hash, iconUrl: bungieIconUrl, setBonuses });
    const exoticPerks = rarity === 'Exotic' ? resolveExoticArmorPerks({ itemDefinition: def, activePlugDefs, allPlugDefs, archetypeHash: archetype.hash, iconUrl: bungieIconUrl }) : [];
    const exoticPerk = exoticPerks[0] || null;
    rows.push({
      Id: instanceId,
      Name: def.displayProperties?.name || 'Unknown Armor',
      Type: slot === 'Class Item' ? CLASS_ITEM_BY_CLASS[equippable] || 'Class Item' : slot,
      Slot: slot,
      Rarity: rarity,
      Class: equippable,
      Equippable: equippable,
      Tier: gearTierForItem(instance, rarity, Number(audit.row.BaseTotal || 0)),
      GearTier: gearTierForItem(instance, rarity, Number(audit.row.BaseTotal || 0)),
      TierMax: 5,
      Power: getLightLevel(instance, item),
      Light: getLightLevel(instance, item),
      Archetype: archetype.name,
      ArchetypeIcon: archetype.icon,
      ArchetypeDescription: archetype.description,
      ArchetypeHash: archetype.hash,
      ArchetypeTrait: archetype.trait,
      ArmorSetBonuses: setBonuses,
      SetBonuses: setBonuses,
      ArmorBonuses: armorBonuses,
      ArmorPerks: armorBonuses,
      ExoticPerks: exoticPerks,
      ExoticArmorPerks: exoticPerks,
      ExoticPerkName: exoticPerk?.name || '',
      ExoticPerkDescription: exoticPerk?.description || '',
      ExoticIcon: exoticPerk?.icon || '',
      Icon: ornament?.icon || bungieIconUrl(def.displayProperties?.icon),
      IconUrl: ornament?.icon || bungieIconUrl(def.displayProperties?.icon),
      BaseIconUrl: bungieIconUrl(def.displayProperties?.icon),
      OrnamentName: ornament?.name || '',
      IsMasterworked: Number(instance?.energy?.energyCapacity || 0) >= 10,
      IsLocked: Boolean(stateValue & ITEM_STATE_LOCKED),
      StatAudit: audit.audit,
      ...audit.row,
      Source: 'Bungie',
      FoundAt: Date.now(),
      ItemHash: item.itemHash,
      BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0,
      MembershipType: membershipType,
      OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner,
      TargetCharacterId: characterMap[equippable] || '',
      IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault',
      IsEquipped: Boolean(item.d2aaEquipped)
    });
  }
  return rows.sort((a, b) => Number(b.FoundAt || 0) - Number(a.FoundAt || 0) || a.Name.localeCompare(b.Name));
}

function collectItems(profile: BungieProfileResponse): BungieInventoryItem[] {
  const out: BungieInventoryItem[] = [];
  if (profile.profileInventory?.data?.items) out.push(...profile.profileInventory.data.items.map((item) => ({ ...item, d2aaOwner: 'vault' })));
  for (const [characterId, container] of Object.entries(profile.characterInventories?.data || {})) {
    if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId })));
  }
  for (const [characterId, container] of Object.entries(profile.characterEquipment?.data || {})) {
    if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId, d2aaEquipped: true })));
  }
  return out;
}

function activePlugHashes(socketComponent?: BungieSocketComponent): number[] {
  return unique((socketComponent?.sockets || []).map((socket) => toUint32(socket.plugHash || socket.plugItemHash)).filter(Boolean));
}

function plugSetHashesForItem(def?: DestinyInventoryItemDefinition | null, socketComponent?: BungieSocketComponent): number[] {
  const hashes: number[] = [];
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.reusablePlugSetHash) hashes.push(toUint32(entry.reusablePlugSetHash));
    if (entry.randomizedPlugSetHash) hashes.push(toUint32(entry.randomizedPlugSetHash));
    if (entry.randomizedPlugSet?.hash) hashes.push(toUint32(entry.randomizedPlugSet.hash));
  }
  for (const socket of socketComponent?.sockets || []) {
    if (socket.reusablePlugSetHash) hashes.push(toUint32(socket.reusablePlugSetHash));
    if (socket.randomizedPlugSetHash) hashes.push(toUint32(socket.randomizedPlugSetHash));
  }
  return hashes;
}

function allPlugHashes(def?: DestinyInventoryItemDefinition | null, socketComponent?: BungieSocketComponent, plugSetDefs = new Map<number, { reusablePlugItems?: Array<{ plugItemHash?: number }>; randomizedPlugItems?: Array<{ plugItemHash?: number }> } | null>()): number[] {
  const hashes = activePlugHashes(socketComponent);
  for (const socket of socketComponent?.sockets || []) {
    for (const hash of socket.reusablePlugHashes || []) hashes.push(toUint32(hash));
    for (const item of socket.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
  }
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.singleInitialItemHash) hashes.push(toUint32(entry.singleInitialItemHash));
    for (const item of entry.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
    for (const item of entry.randomizedPlugSet?.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
    for (const setHash of [entry.reusablePlugSetHash, entry.randomizedPlugSetHash, entry.randomizedPlugSet?.hash].filter(Boolean)) {
      const setDef = plugSetDefs.get(toUint32(setHash));
      for (const item of [...(setDef?.reusablePlugItems || []), ...(setDef?.randomizedPlugItems || [])]) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
    }
  }
  return unique(hashes);
}

function isArmorDef(def?: DestinyInventoryItemDefinition | null): def is DestinyInventoryItemDefinition {
  if (!def) return false;
  const type = normalize(def.itemTypeDisplayName);
  const name = normalize(def.displayProperties?.name);
  return def.itemType === 2 || type.includes('armor') || ['helmet', 'gauntlets', 'chest armor', 'leg armor', 'class item'].some((part) => type.includes(part) || name.includes(part));
}

function isDefinition(value: DestinyInventoryItemDefinition | null | undefined): value is DestinyInventoryItemDefinition {
  return Boolean(value);
}

function slotForItem(def: DestinyInventoryItemDefinition): string {
  const bucket = Number(def.inventory?.bucketTypeHash || 0);
  const type = normalize(def.itemTypeDisplayName || def.displayProperties?.name);
  if (bucket === 3448274439 || type.includes('helmet')) return 'Helmet';
  if (bucket === 3551918588 || type.includes('gauntlet') || type.includes('glove')) return 'Gauntlets';
  if (bucket === 14239492 || type.includes('chest')) return 'Chest Armor';
  if (bucket === 20886954 || type.includes('leg')) return 'Leg Armor';
  if (bucket === 1585787867 || type.includes('class item') || type.includes('bond') || type.includes('cloak') || type.includes('mark')) return 'Class Item';
  return def.itemTypeDisplayName || 'Armor';
}

function rarityForItem(def: DestinyInventoryItemDefinition): string {
  const tier = Number(def.inventory?.tierType || 0);
  if (tier === 6) return 'Exotic';
  if (tier === 5) return 'Legendary';
  if (tier === 4) return 'Rare';
  return def.inventory?.tierTypeName || 'Legendary';
}

function gearTierForItem(instance: BungieItemInstance | undefined, rarity: string, total: number): number {
  const actual = Number(instance?.gearTier || 0);
  if (actual) return Math.min(actual, 5);
  if (rarity === 'Exotic') return Math.max(1, Math.min(5, Math.ceil((total - 55) / 4)));
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}

function getLightLevel(instance: BungieItemInstance | undefined, item: BungieInventoryItem): number {
  return Number(instance?.primaryStat?.value ?? instance?.quality ?? item.primaryStat?.value ?? item.power ?? item.light ?? 0) || 0;
}

function activeOrnament(activePlugDefs: DestinyInventoryItemDefinition[]): { name: string; icon: string } | null {
  for (const plug of activePlugDefs) {
    const category = normalize(plug.plug?.plugCategoryIdentifier);
    const type = normalize(plug.itemTypeDisplayName);
    const name = normalize(plug.displayProperties?.name);
    if (plug.displayProperties?.icon && (category.includes('skin') || category.includes('ornament') || type.includes('ornament') || name.includes('ornament')) && name !== 'default ornament') {
      return { name: plug.displayProperties.name || '', icon: bungieIconUrl(plug.displayProperties.icon) };
    }
  }
  return null;
}

function buildCharacterMap(profile: BungieProfileResponse): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [characterId, data] of Object.entries(profile.characters?.data || {})) {
    map[CLASS_TYPE[Number(data.classType)] || 'Any'] = characterId;
  }
  return map;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}
