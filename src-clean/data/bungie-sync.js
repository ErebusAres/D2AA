import { getMembership, bungieFetch, getDef, mapLimit, bungieIconUrl, toUint32, toSigned32 } from './bungie-api.js';
import { tokenIsValid, handleOAuthRedirect, startLogin } from './bungie-auth.js';
import { saveBungieInventory, loadBungieInventoryFromCache, formatCacheTime } from './inventory-cache.js';

const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305].join(',');
const VAULT_BUCKET_HASH = 138197802;
const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BASE_HASH_TO_COLUMN = {
  392767087: 'Health',
  4244567218: 'Melee',
  1735777505: 'Grenade',
  144602215: 'Super',
  2996146975: 'ClassAbility',
  1943323491: 'Weapon'
};
const HASH_TO_COLUMN = { ...BASE_HASH_TO_COLUMN };
for (const [hash, col] of Object.entries(BASE_HASH_TO_COLUMN)) HASH_TO_COLUMN[toSigned32(hash)] = col;
const STAT_CACHE = new Map();

export async function initializeBungieSync({ setStatus, setRows, hasRows }) {
  await handleOAuthRedirect();
  const cached = await loadBungieInventoryFromCache();
  if (cached?.rows?.length && !hasRows()) {
    setRows(cached.rows, `Loaded Bungie cache: ${cached.rows.length} armor from ${formatCacheTime(cached.meta)}.`);
    if (tokenIsValid()) scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay: 2500 });
    return;
  }
  if (!cached?.rows?.length && !hasRows() && tokenIsValid()) {
    setStatus('No Bungie cache found. Starting initial sync...');
    await syncBungieInventory({ setStatus, setRows, reason: 'startup-no-cache' });
    scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
    return;
  }
  if (tokenIsValid()) scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
}

let semiLiveTimer = null;
let syncRunning = false;
let lastSyncStartedAt = 0;

export function scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay = 90000 }) {
  clearTimeout(semiLiveTimer);
  if (!tokenIsValid()) return;
  semiLiveTimer = setTimeout(async () => {
    if (document.hidden) {
      scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay: 30000 });
      return;
    }
    await syncBungieInventory({ setStatus, setRows, reason: 'semi-live-refresh', background: true });
    scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
  }, delay);
}

export async function syncBungieInventory({ setStatus, setRows, reason = 'manual-sync', background = false }) {
  if (syncRunning) return null;
  if (!tokenIsValid()) {
    setStatus('Connect your Destiny account before syncing armor.');
    return null;
  }
  syncRunning = true;
  lastSyncStartedAt = Date.now();
  const startedAt = performance.now();
  try {
    if (!background) setStatus('Fetching Bungie profile...');
    const membership = await getMembership();
    const profile = await bungieFetch(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
    const rows = await buildArmorRows(profile, membership, setStatus, background);
    const saved = await saveBungieInventory(rows, reason);
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    const meta = saved.meta;
    setRows(saved.rows, `Bungie sync complete: ${rows.length} armor in ${seconds}s. New: ${meta.added}. Moved: ${meta.moved}. Changed: ${meta.changed}.`);
    return saved;
  } catch (error) {
    console.error('D2AA clean Bungie sync failed', error);
    setStatus(error.message || String(error));
    return null;
  } finally {
    syncRunning = false;
  }
}

export function connectBungie() { startLogin(); }
export function shouldRefreshOnFocus() { return tokenIsValid() && Date.now() - lastSyncStartedAt > 45000; }

async function buildArmorRows(profile, membership, setStatus, background) {
  const allItems = collectItems(profile);
  const statComponents = profile.itemComponents?.stats?.data || {};
  const instanceComponents = profile.itemComponents?.instances?.data || {};
  const socketComponents = profile.itemComponents?.sockets?.data || {};
  const characterMap = buildCharacterMap(profile);
  const uniqueItemHashes = [...new Set(allItems.map((item) => toUint32(item.itemHash)).filter(Boolean))];
  if (!background) setStatus(`Resolving item definitions: 0/${uniqueItemHashes.length}`);
  const itemDefsList = await mapLimit(uniqueItemHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => {
    if (!background) setStatus(`Resolving item definitions: ${done}/${total}`);
  });
  const itemDefs = Object.fromEntries(uniqueItemHashes.map((hash, i) => [hash, itemDefsList[i]]));
  const armorItems = allItems.filter((item) => item.itemInstanceId && isArmorDef(itemDefs[toUint32(item.itemHash)]));
  const uniquePlugHashes = [...new Set(armorItems.flatMap((item) => plugHashesForInstance(socketComponents[item.itemInstanceId])).filter(Boolean))];
  if (!background) setStatus(`Resolving socket bonuses: 0/${uniquePlugHashes.length}`);
  const plugDefsList = await mapLimit(uniquePlugHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => {
    if (!background) setStatus(`Resolving socket bonuses: ${done}/${total}`);
  });
  const plugDefs = Object.fromEntries(uniquePlugHashes.map((hash, i) => [hash, plugDefsList[i]]));
  const statHashes = [];
  for (const item of armorItems) {
    const def = itemDefs[toUint32(item.itemHash)];
    const source = Object.keys(statComponents[item.itemInstanceId]?.stats || {}).length ? statComponents[item.itemInstanceId].stats : (def.stats?.stats || {});
    statHashes.push(...Object.keys(source));
    for (const plugHash of plugHashesForInstance(socketComponents[item.itemInstanceId])) {
      const plugDef = plugDefs[plugHash];
      if (!isSubtractableArmorBonusPlug(plugDef)) continue;
      for (const stat of plugDef?.investmentStats || []) statHashes.push(stat.statTypeHash);
    }
  }
  const statColumnMap = await buildStatColumnMap(statHashes, setStatus, background);
  const rows = [];
  const seen = new Set();
  let scanned = 0;
  for (const item of allItems) {
    const instanceId = item.itemInstanceId;
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    scanned++;
    const def = itemDefs[toUint32(item.itemHash)];
    if (!isArmorDef(def)) continue;
    const slot = slotForItem(def);
    const equippable = CLASS_TYPE[def.classType];
    const rarity = rarityForItem(def);
    const type = slot === 'Class Item' ? CLASS_ITEM_BY_CLASS[equippable] : slot;
    const socketPlugDefs = plugHashesForInstance(socketComponents[instanceId]).map((hash) => plugDefs[hash]).filter(Boolean);
    const statRow = statsForItem(def, statComponents[instanceId], socketBonusTotals(socketPlugDefs, statColumnMap), statColumnMap);
    const targetCharacterId = characterMap[equippable]?.characterId || '';
    const instanceComponent = instanceComponents[instanceId];
    const power = getLightLevel(instanceComponent, item);
    const gearTier = gearTierForItem(instanceComponent, rarity, statRow.Total);
    rows.push({
      Name: def.displayProperties?.name || 'Unknown Armor',
      Id: instanceId,
      Type: type,
      Slot: slot,
      Rarity: rarity,
      Class: equippable,
      Equippable: equippable,
      Tier: gearTier,
      GearTier: gearTier,
      TierSource: instanceComponent?.gearTier ? 'Bungie' : 'Fallback',
      TierMax: rarity === 'Exotic' ? 2 : 5,
      Power: power,
      Light: power,
      Archetype: armorArchetype(def, socketPlugDefs),
      Icon: bungieIconUrl(def.displayProperties?.icon),
      IconUrl: bungieIconUrl(def.displayProperties?.icon),
      ScreenshotUrl: bungieIconUrl(def.screenshot),
      ...statRow,
      Source: 'Bungie',
      FoundAt: Date.now(),
      ItemHash: item.itemHash,
      BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0,
      MembershipType: membership.membershipType,
      OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner,
      TargetCharacterId: targetCharacterId,
      IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault',
      IsEquipped: Boolean(item.d2aaEquipped)
    });
    if (!background && scanned % 100 === 0) {
      setStatus(`Building armor rows: ${scanned}/${allItems.length} scanned, ${rows.length} armor found`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return rows.sort((a, b) => b.FoundAt - a.FoundAt || a.Name.localeCompare(b.Name));
}

function collectItems(profile) {
  const out = [];
  if (profile.profileInventory?.data?.items) out.push(...profile.profileInventory.data.items.map((item) => ({ ...item, d2aaOwner: 'vault' })));
  for (const [characterId, container] of Object.entries(profile.characterInventories?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId })));
  for (const [characterId, container] of Object.entries(profile.characterEquipment?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId, d2aaEquipped: true })));
  return out;
}
function emptyArmorStats() { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])); }
function totalOf(row) { return STAT_KEYS.reduce((sum, key) => sum + Number(row[key] || 0), 0); }
function getStatNumericValue(stat) { return Number(stat?.value ?? stat?.statValue ?? stat?.base ?? stat?.minimum ?? 0); }
function getLightLevel(instanceComponent, item) { return Number(instanceComponent?.primaryStat?.value ?? instanceComponent?.quality ?? item?.primaryStat?.value ?? item?.power ?? item?.light ?? 0) || 0; }
function normalizeName(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function columnFromStatName(name) {
  const n = normalizeName(name);
  if (!n) return null;
  if (n.includes('health') || n.includes('resilience')) return 'Health';
  if (n.includes('melee') || n.includes('strength')) return 'Melee';
  if (n.includes('grenade') || n.includes('discipline')) return 'Grenade';
  if (n.includes('super') || n.includes('intellect')) return 'Super';
  if (n.includes('class') || n.includes('mobility')) return 'ClassAbility';
  if (n.includes('weapon') || n.includes('recovery')) return 'Weapon';
  return null;
}
async function resolveStatColumn(hash) {
  const signed = toSigned32(hash);
  const unsigned = toUint32(hash);
  if (HASH_TO_COLUMN[signed]) return HASH_TO_COLUMN[signed];
  if (HASH_TO_COLUMN[unsigned]) return HASH_TO_COLUMN[unsigned];
  if (STAT_CACHE.has(unsigned)) return STAT_CACHE.get(unsigned);
  const def = await getDef('DestinyStatDefinition', unsigned).catch(() => null);
  const col = columnFromStatName(def?.displayProperties?.name || def?.statName || '');
  STAT_CACHE.set(unsigned, col || null);
  if (col) { HASH_TO_COLUMN[unsigned] = col; HASH_TO_COLUMN[signed] = col; }
  return col;
}
async function buildStatColumnMap(allHashes, setStatus, background) {
  const hashes = [...new Set(allHashes.map(toUint32).filter(Boolean))];
  const map = { ...HASH_TO_COLUMN };
  const unknown = hashes.filter((h) => !map[h] && !map[toSigned32(h)]);
  if (unknown.length) await mapLimit(unknown, 8, async (hash) => {
    const col = await resolveStatColumn(hash);
    if (col) { map[hash] = col; map[toSigned32(hash)] = col; }
    return col;
  }, (done, total) => { if (!background) setStatus(`Resolving stat definitions: ${done}/${total}`); });
  return map;
}
function plugHashesForInstance(socketComponent) {
  const hashes = [];
  for (const socket of socketComponent?.sockets || []) {
    const plugHash = socket.plugHash || socket.plugItemHash;
    if (plugHash) hashes.push(toUint32(plugHash));
  }
  return hashes;
}
function isSubtractableArmorBonusPlug(plugDef) {
  const name = normalizeName(plugDef?.displayProperties?.name);
  const desc = normalizeName(plugDef?.displayProperties?.description);
  const type = normalizeName(plugDef?.itemTypeDisplayName);
  const category = normalizeName(plugDef?.plug?.plugCategoryIdentifier);
  return type.includes('armor mod') || category.includes('armor mods') || category.includes('enhancement') || category.includes('masterwork') || (name.includes('mod') && (desc.includes('stat') || desc.includes('bonus') || desc.includes('increase'))) || name.includes('masterwork') || desc.includes('masterwork') || name.includes('artifice') || desc.includes('artifice');
}
function socketBonusTotals(plugDefs, statColumnMap) {
  const bonuses = emptyArmorStats();
  for (const plugDef of plugDefs || []) {
    if (!isSubtractableArmorBonusPlug(plugDef)) continue;
    for (const stat of plugDef?.investmentStats || []) {
      const col = statColumnMap[Number(stat.statTypeHash)] || statColumnMap[toUint32(stat.statTypeHash)] || statColumnMap[toSigned32(stat.statTypeHash)];
      const value = Number(stat.value || 0);
      if (col && value > 0) bonuses[col] += value;
    }
  }
  return bonuses;
}
function statsForItem(def, statComponent, socketBonusRow, statColumnMap) {
  const liveStats = statComponent?.stats || {};
  const manifestStats = def.stats?.stats || {};
  const source = Object.keys(liveStats).length ? liveStats : manifestStats;
  const rowStats = emptyArmorStats();
  const currentStats = emptyArmorStats();
  for (const [rawHash, stat] of Object.entries(source)) {
    const col = statColumnMap[Number(rawHash)] || statColumnMap[toUint32(rawHash)] || statColumnMap[toSigned32(rawHash)];
    if (!col) continue;
    currentStats[col] = getStatNumericValue(stat);
    rowStats[col] = Math.max(0, currentStats[col] - Number(socketBonusRow?.[col] || 0));
  }
  rowStats.Total = totalOf(rowStats) || totalOf(currentStats);
  return rowStats;
}
function slotForItem(def) {
  const bucket = String(def.inventory?.bucketTypeHash || '');
  const display = `${def.itemTypeDisplayName || ''} ${def.itemTypeAndTierDisplayName || ''}`;
  if (display.includes('Helmet')) return 'Helmet';
  if (display.includes('Gauntlets') || display.includes('Gloves')) return 'Gauntlets';
  if (display.includes('Chest Armor') || display.includes('Chest')) return 'Chest Armor';
  if (display.includes('Leg Armor') || display.includes('Legs') || display.includes('Boots')) return 'Leg Armor';
  if (display.includes('Class Armor') || display.includes('Class Item')) return 'Class Item';
  if (bucket === '3448274439') return 'Helmet';
  if (bucket === '3551918588') return 'Gauntlets';
  if (bucket === '14239492') return 'Chest Armor';
  if (bucket === '20886954') return 'Leg Armor';
  if (bucket === '1585787867') return 'Class Item';
  return null;
}
function rarityForItem(def) { return def.inventory?.tierTypeName || (String(def.itemTypeAndTierDisplayName || '').match(/^(Common|Uncommon|Rare|Legendary|Exotic)/)?.[1]) || 'Unknown'; }
function gearTierForItem(instanceComponent, rarity, total) {
  const max = rarity === 'Exotic' ? 2 : 5;
  const fromBungie = Number(instanceComponent?.gearTier || 0);
  const tier = fromBungie >= 1 ? fromBungie : fallbackTier(total);
  return Math.max(1, Math.min(max, tier));
}
function fallbackTier(total) {
  if (total >= 73) return 5;
  if (total >= 65) return 4;
  if (total >= 59) return 3;
  if (total >= 54) return 2;
  return 1;
}
function buildCharacterMap(profile) {
  const map = {};
  for (const [characterId, character] of Object.entries(profile.characters?.data || {})) {
    const className = CLASS_TYPE[character.classType] || 'Unknown';
    map[className] = { characterId, className };
  }
  return map;
}
function isArmorDef(def) {
  if (!def || def.itemType !== 2) return false;
  if (!CLASS_TYPE[def.classType]) return false;
  if (!slotForItem(def)) return false;
  return ['Common', 'Uncommon', 'Rare', 'Legendary', 'Exotic'].includes(rarityForItem(def));
}
function armorArchetype(def, plugDefs = []) {
  const candidates = plugDefs
    .map((plug) => plug?.displayProperties?.name || '')
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name) => !isNonArchetypeName(name));
  return candidates[0] || def.traitIds?.find((trait) => String(trait).includes('intrinsic')) || '—';
}
function isNonArchetypeName(name) {
  const n = normalizeName(name);
  return !n || n.includes('empty') || n.includes('artifice') || n.includes('mod') || n.includes('shader') || n.includes('ornament') || n.includes('masterwork') || n.includes('kill tracker') || n.includes('helmet') || n.includes('gauntlet') || n.includes('chest') || n.includes('leg armor') || n.includes('class item');
}
