import { getMembership, bungieFetch, getDef, mapLimit, bungieIconUrl, toUint32, toSigned32 } from './bungie-api.js';
import { isSignedIn, handleOAuthRedirect, startLogin } from './bungie-auth.js';
import { saveBungieInventory, loadBungieInventoryFromCache, formatCacheTime } from './inventory-cache.js';

const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305, 307].join(',');
const VAULT_BUCKET_HASH = 138197802;
const ITEM_STATE_LOCKED = 1;
const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Any' };
const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BONUS_TYPES = ['masterwork', 'mod', 'artifice', 'other'];
const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
const BASE_HASH_TO_COLUMN = { 392767087: 'Health', 4244567218: 'Melee', 1735777505: 'Grenade', 144602215: 'Super', 2996146975: 'ClassAbility', 1943323491: 'Weapon' };
const HASH_TO_COLUMN = { ...BASE_HASH_TO_COLUMN };
for (const [hash, col] of Object.entries(BASE_HASH_TO_COLUMN)) HASH_TO_COLUMN[toSigned32(hash)] = col;
const STAT_CACHE = new Map();
let semiLiveTimer = null;
let syncRunning = false;
let lastSyncStartedAt = 0;

export async function initializeBungieSync({ setStatus, setRows, hasRows }) {
  await handleOAuthRedirect();
  const cached = await loadBungieInventoryFromCache();
  if (cached?.rows?.length && !hasRows()) {
    setRows(cached.rows, `Loaded Bungie cache: ${cached.rows.length} armor from ${formatCacheTime(cached.meta)}.`);
    if (isSignedIn()) scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay: 2500 });
    return;
  }
  if (!cached?.rows?.length && !hasRows() && isSignedIn()) {
    setStatus('No Bungie cache found. Starting initial sync...');
    await syncBungieInventory({ setStatus, setRows, reason: 'startup-no-cache' });
    scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
    return;
  }
  if (isSignedIn()) scheduleSemiLiveRefresh({ setStatus, setRows, hasRows });
}

export function scheduleSemiLiveRefresh({ setStatus, setRows, hasRows, delay = 90000 }) {
  clearTimeout(semiLiveTimer);
  if (!isSignedIn()) return;
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
  if (!isSignedIn()) {
    setStatus('Connect your Destiny account before syncing armor.');
    return { error: true, skipped: true, message: 'Connect your Destiny account before syncing armor.' };
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
    const added = Number(saved.meta?.added || 0);
    setRows(saved.rows, added ? `Bungie sync complete: ${rows.length} armor in ${seconds}s. New armor: ${added}.` : `Bungie sync complete: ${rows.length} armor in ${seconds}s. No new armor found.`);
    return saved;
  } catch (error) {
    console.error('D2AA Bungie sync failed', error);
    const message = error?.message || String(error);
    setStatus(message);
    return { error: true, message, reason, background };
  } finally {
    syncRunning = false;
  }
}

export function connectBungie() { startLogin(); }
export function shouldRefreshOnFocus() { return isSignedIn() && Date.now() - lastSyncStartedAt > 45000; }

async function buildArmorRows(profile, membership, setStatus, background) {
  const allItems = collectItems(profile);
  const statComponents = profile.itemComponents?.stats?.data || {};
  const instanceComponents = profile.itemComponents?.instances?.data || {};
  const socketComponents = profile.itemComponents?.sockets?.data || {};
  const stateComponents = profile.itemComponents?.state?.data || {};
  const characterMap = buildCharacterMap(profile);
  const uniqueItemHashes = unique(allItems.map((item) => toUint32(item.itemHash)).filter(Boolean));
  if (!background) setStatus(`Resolving item definitions: 0/${uniqueItemHashes.length}`);
  const itemDefsList = await mapLimit(uniqueItemHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => { if (!background) setStatus(`Resolving item definitions: ${done}/${total}`); });
  const itemDefs = Object.fromEntries(uniqueItemHashes.map((hash, i) => [hash, itemDefsList[i]]));
  const armorItems = allItems.filter((item) => item.itemInstanceId && isArmorDef(itemDefs[toUint32(item.itemHash)]));

  const uniquePlugSetHashes = unique(armorItems.flatMap((item) => plugSetHashesForItem(itemDefs[toUint32(item.itemHash)], socketComponents[item.itemInstanceId])).filter(Boolean));
  if (!background && uniquePlugSetHashes.length) setStatus(`Resolving armor plug sets: 0/${uniquePlugSetHashes.length}`);
  const plugSetDefsList = await mapLimit(uniquePlugSetHashes, 8, (hash) => getDef('DestinyPlugSetDefinition', hash), (done, total) => { if (!background) setStatus(`Resolving armor plug sets: ${done}/${total}`); });
  const plugSetDefs = Object.fromEntries(uniquePlugSetHashes.map((hash, i) => [hash, plugSetDefsList[i]]));

  const uniquePlugHashes = unique(armorItems.flatMap((item) => allPlugHashes(itemDefs[toUint32(item.itemHash)], socketComponents[item.itemInstanceId], plugSetDefs)).filter(Boolean));
  if (!background) setStatus(`Resolving armor plugs: 0/${uniquePlugHashes.length}`);
  const plugDefsList = await mapLimit(uniquePlugHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => { if (!background) setStatus(`Resolving armor plugs: ${done}/${total}`); });
  const plugDefs = Object.fromEntries(uniquePlugHashes.map((hash, i) => [hash, plugDefsList[i]]));

  const statHashes = [];
  for (const item of armorItems) {
    const def = itemDefs[toUint32(item.itemHash)];
    const source = Object.keys(statComponents[item.itemInstanceId]?.stats || {}).length ? statComponents[item.itemInstanceId].stats : (def.stats?.stats || {});
    statHashes.push(...Object.keys(source));
    for (const plugHash of activePlugHashesForInstance(socketComponents[item.itemInstanceId])) {
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

    const socketComponent = socketComponents[instanceId];
    const activePlugDefs = activePlugHashesForInstance(socketComponent).map((hash) => plugDefs[hash]).filter(Boolean);
    const allDefs = allPlugHashes(def, socketComponent, plugSetDefs).map((hash) => plugDefs[hash]).filter(Boolean);
    const slot = slotForItem(def);
    const equippable = CLASS_TYPE[def.classType] || 'Any';
    const rarity = rarityForItem(def);
    const type = slot === 'Class Item' ? CLASS_ITEM_BY_CLASS[equippable] || 'Class Item' : slot;
    const archetype = armorArchetype(def, allDefs);
    const setBonuses = rarity === 'Exotic' ? [] : armorSetBonuses(def, activePlugDefs, allDefs, archetype.hash);
    const armorBonuses = rarity === 'Exotic' ? [] : armorBonusPerks(def, activePlugDefs, archetype.hash, setBonuses);
    const exoticPerk = rarity === 'Exotic' ? exoticArmorPerk(def, activePlugDefs, archetype.hash) : null;
    const ornament = activeOrnament(activePlugDefs);
    const bonusBreakdown = socketBonusBreakdown(activePlugDefs, statColumnMap);
    const statRow = statsForItem(def, statComponents[instanceId], bonusBreakdown, statColumnMap);
    const targetCharacterId = characterMap[equippable]?.characterId || '';
    const instanceComponent = instanceComponents[instanceId];
    const power = getLightLevel(instanceComponent, item);
    const gearTier = gearTierForItem(instanceComponent, rarity, statRow.BaseTotal);
    const stateValue = Number(stateComponents[instanceId]?.state ?? item.state ?? 0);
    const icon = ornament?.icon || bungieIconUrl(def.displayProperties?.icon);

    rows.push({
      Name: def.displayProperties?.name || 'Unknown Armor', Id: instanceId, Type: type, Slot: slot, Rarity: rarity, Class: equippable, Equippable: equippable, Tier: gearTier, GearTier: gearTier, TierSource: instanceComponent?.gearTier ? 'Bungie' : 'Fallback', TierMax: 5,
      Power: power, Light: power, Archetype: archetype.name, ArchetypeIcon: archetype.icon, ArchetypeDescription: archetype.description, ArchetypeHash: archetype.hash, ArchetypeTrait: archetype.trait,
      ArmorSetBonuses: setBonuses, SetBonuses: setBonuses, ArmorBonuses: armorBonuses, ArmorPerks: armorBonuses, ExoticPerkName: exoticPerk?.name || '', ExoticPerkDescription: exoticPerk?.description || '', ExoticIcon: exoticPerk?.icon || '',
      Icon: icon, IconUrl: icon, BaseIconUrl: bungieIconUrl(def.displayProperties?.icon), OrnamentName: ornament?.name || '', OrnamentIcon: ornament?.icon || '', OrnamentHash: ornament?.hash || '', ScreenshotUrl: bungieIconUrl(def.screenshot),
      IsMasterworked: isMasterworked(instanceComponent, activePlugDefs, statRow), IsLocked: Boolean(stateValue & ITEM_STATE_LOCKED), StatAudit: statAudit(def, statComponents[instanceId], activePlugDefs, allDefs, bonusBreakdown),
      ...statRow, Source: 'Bungie', FoundAt: Date.now(), ItemHash: item.itemHash, BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0, MembershipType: membership.membershipType, OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner, TargetCharacterId: targetCharacterId, IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault', IsEquipped: Boolean(item.d2aaEquipped)
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
function emptyBreakdown() { return Object.fromEntries(BONUS_TYPES.map((type) => [type, emptyArmorStats()])); }
function totalOf(row) { return STAT_KEYS.reduce((sum, key) => sum + Number(row[key] || 0), 0); }
function getStatNumericValue(stat) { return Number(stat?.value ?? stat?.statValue ?? stat?.base ?? stat?.minimum ?? 0); }
function getLightLevel(instanceComponent, item) { return Number(instanceComponent?.primaryStat?.value ?? instanceComponent?.quality ?? item?.primaryStat?.value ?? item?.power ?? item?.light ?? 0) || 0; }
function normalizeName(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function title(value) { return String(value || '').replace(/^./, (c) => c.toUpperCase()); }
function unique(values) { return [...new Set(values)]; }

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
  const hashes = unique(allHashes.map(toUint32).filter(Boolean));
  const map = { ...HASH_TO_COLUMN };
  const unknown = hashes.filter((h) => !map[h] && !map[toSigned32(h)]);
  if (unknown.length) await mapLimit(unknown, 8, async (hash) => {
    const col = await resolveStatColumn(hash);
    if (col) { map[hash] = col; map[toSigned32(hash)] = col; }
    return col;
  }, (done, total) => { if (!background) setStatus(`Resolving stat definitions: ${done}/${total}`); });
  return map;
}

function activePlugHashesForInstance(socketComponent) {
  const hashes = [];
  for (const socket of socketComponent?.sockets || []) {
    const plugHash = socket.plugHash || socket.plugItemHash;
    if (plugHash) hashes.push(toUint32(plugHash));
  }
  return unique(hashes);
}
function reusablePlugHashesForInstance(socketComponent) {
  const hashes = [];
  for (const socket of socketComponent?.sockets || []) {
    for (const hash of socket.reusablePlugHashes || []) if (hash) hashes.push(toUint32(hash));
    for (const item of socket.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
  }
  return hashes;
}
function plugSetHashesForItem(def, socketComponent) {
  const hashes = [];
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
function plugHashesForPlugSet(plugSetDef) {
  const hashes = [];
  for (const item of plugSetDef?.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
  for (const item of plugSetDef?.randomizedPlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
  return hashes;
}
function plugHashesForDefinition(def, plugSetDefs = {}) {
  const hashes = [];
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.singleInitialItemHash) hashes.push(toUint32(entry.singleInitialItemHash));
    for (const item of entry.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
    for (const item of entry.randomizedPlugSet?.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash));
    for (const hash of [entry.reusablePlugSetHash, entry.randomizedPlugSetHash, entry.randomizedPlugSet?.hash].filter(Boolean)) hashes.push(...plugHashesForPlugSet(plugSetDefs[toUint32(hash)]));
  }
  return hashes;
}
function allPlugHashes(def, socketComponent, plugSetDefs = {}) {
  return unique([...activePlugHashesForInstance(socketComponent), ...reusablePlugHashesForInstance(socketComponent), ...plugHashesForDefinition(def, plugSetDefs)].filter(Boolean));
}

function bonusTypeForPlug(plugDef) {
  const name = normalizeName(plugDef?.displayProperties?.name);
  const desc = normalizeName(plugDef?.displayProperties?.description);
  const type = normalizeName(plugDef?.itemTypeDisplayName);
  const category = normalizeName(plugDef?.plug?.plugCategoryIdentifier);
  if (category.includes('masterwork') || name.includes('masterwork') || desc.includes('masterwork')) return 'masterwork';
  if (name.includes('artifice') || desc.includes('artifice') || category.includes('artifice')) return 'artifice';
  if (type.includes('armor mod') || category.includes('armor mods') || name.includes('mod')) return 'mod';
  return 'other';
}
function isSubtractableArmorBonusPlug(plugDef) {
  const name = normalizeName(plugDef?.displayProperties?.name);
  const desc = normalizeName(plugDef?.displayProperties?.description);
  const type = normalizeName(plugDef?.itemTypeDisplayName);
  const category = normalizeName(plugDef?.plug?.plugCategoryIdentifier);
  const hasStats = Array.isArray(plugDef?.investmentStats) && plugDef.investmentStats.some((s) => Number(s.value || 0) > 0);
  if (!hasStats) return false;
  const isKnownStatBonus = type.includes('armor mod') || category.includes('armor mods') || category.includes('masterwork') || name.includes('masterwork') || desc.includes('masterwork') || name.includes('artifice') || desc.includes('artifice') || category.includes('artifice');
  const isGenericStatMod = name.includes('mod') && (desc.includes('stat') || desc.includes('bonus') || desc.includes('increase'));
  return isKnownStatBonus || isGenericStatMod;
}
function socketBonusBreakdown(activePlugDefs, statColumnMap) {
  const breakdown = emptyBreakdown();
  for (const plugDef of activePlugDefs || []) {
    if (!isSubtractableArmorBonusPlug(plugDef)) continue;
    const type = bonusTypeForPlug(plugDef);
    for (const stat of plugDef?.investmentStats || []) {
      const column = statColumnMap[toUint32(stat.statTypeHash)] || statColumnMap[toSigned32(stat.statTypeHash)];
      const value = Number(stat.value || 0);
      if (column && value > 0) breakdown[type][column] += value;
    }
  }
  return breakdown;
}
function statsForItem(def, statComponent, bonusBreakdown, statColumnMap) {
  const current = emptyArmorStats();
  const source = Object.keys(statComponent?.stats || {}).length ? statComponent.stats : (def.stats?.stats || {});
  for (const [hash, stat] of Object.entries(source || {})) {
    const column = statColumnMap[toUint32(hash)] || statColumnMap[toSigned32(hash)] || HASH_TO_COLUMN[toUint32(hash)] || HASH_TO_COLUMN[toSigned32(hash)];
    if (column) current[column] = getStatNumericValue(stat);
  }
  const socketTotals = emptyArmorStats();
  for (const type of BONUS_TYPES) for (const key of STAT_KEYS) socketTotals[key] += Number(bonusBreakdown?.[type]?.[key] || 0);
  const suspicious = totalOf(socketTotals) > 30 || STAT_KEYS.some((key) => socketTotals[key] > current[key]);
  const safeBreakdown = suspicious ? emptyBreakdown() : bonusBreakdown;
  if (suspicious) for (const key of STAT_KEYS) socketTotals[key] = 0;
  const base = emptyArmorStats();
  for (const key of STAT_KEYS) base[key] = Math.max(0, current[key] - Number(socketTotals[key] || 0));
  const row = { ...base };
  row.Total = totalOf(base);
  row.BaseTotal = row.Total;
  row.CurrentTotal = totalOf(current);
  row.StatBonusTotal = Math.max(0, row.CurrentTotal - row.BaseTotal);
  row.StatSource = suspicious ? 'BungieInstanceBonusGuarded' : Object.keys(statComponent?.stats || {}).length ? 'BungieInstanceMinusActiveSocketBonuses' : 'DefinitionFallbackMinusActiveSocketBonuses';
  for (const key of STAT_KEYS) {
    row[`Base${key}`] = base[key];
    row[`Current${key}`] = current[key];
    row[`StatBonus${key}`] = Number(socketTotals[key] || 0);
    for (const type of BONUS_TYPES) row[`${title(type)}Bonus${key}`] = Number(safeBreakdown?.[type]?.[key] || 0);
  }
  for (const type of BONUS_TYPES) row[`${title(type)}BonusTotal`] = STAT_KEYS.reduce((sum, key) => sum + Number(row[`${title(type)}Bonus${key}`] || 0), 0);
  return row;
}
function statAudit(def, statComponent, activePlugDefs, allPlugDefs, bonusBreakdown) {
  return { itemStats: statComponent?.stats || {}, definitionStats: def?.stats?.stats || {}, activePlugs: serializeAuditPlugs(activePlugDefs), allPlugs: serializeAuditPlugs(allPlugDefs), bonusBreakdown };
}
function serializeAuditPlugs(plugDefs) {
  return (plugDefs || []).map((plug) => ({ hash: plug.hash, name: plug.displayProperties?.name, description: plug.displayProperties?.description, icon: bungieIconUrl(plug.displayProperties?.icon), type: plug.itemTypeDisplayName, category: plug.plug?.plugCategoryIdentifier, stats: plug.investmentStats || [] })).filter((plug) => plug.stats.length || /set|bonus|mod|masterwork|artifice|piece|wearing|trait|intrinsic/i.test(`${plug.name} ${plug.description} ${plug.type} ${plug.category}`));
}

function isArmorDef(def) { if (!def) return false; const type = normalizeName(def.itemTypeDisplayName); const name = normalizeName(def.displayProperties?.name); return def.itemType === 2 || type.includes('armor') || ['helmet', 'gauntlets', 'chest armor', 'leg armor', 'class item'].some((part) => type.includes(part) || name.includes(part)); }
function slotForItem(def) { const bucket = Number(def.inventory?.bucketTypeHash || 0); const type = normalizeName(def.itemTypeDisplayName || def.displayProperties?.name); if (bucket === 3448274439 || type.includes('helmet')) return 'Helmet'; if (bucket === 3551918588 || type.includes('gauntlet') || type.includes('glove')) return 'Gauntlets'; if (bucket === 14239492 || type.includes('chest')) return 'Chest Armor'; if (bucket === 20886954 || type.includes('leg')) return 'Leg Armor'; if (bucket === 1585787867 || type.includes('class item') || type.includes('bond') || type.includes('cloak') || type.includes('mark')) return 'Class Item'; return def.itemTypeDisplayName || 'Armor'; }
function rarityForItem(def) { const tier = Number(def.inventory?.tierType || 0); if (tier === 6) return 'Exotic'; if (tier === 5) return 'Legendary'; if (tier === 4) return 'Rare'; return def.inventory?.tierTypeName || 'Legendary'; }
function gearTierForItem(instanceComponent, rarity, total) { const actual = Number(instanceComponent?.gearTier || 0); if (actual) return Math.min(actual, 5); if (rarity === 'Exotic') return Math.max(1, Math.min(5, Math.ceil((Number(total || 0) - 55) / 4))); if (total >= 73) return 5; if (total >= 65) return 4; if (total >= 59) return 3; if (total >= 54) return 2; return 1; }
function buildCharacterMap(profile) { const map = {}; for (const [characterId, data] of Object.entries(profile.characters?.data || {})) { const className = CLASS_TYPE[data.classType] || 'Any'; map[className] = { characterId, ...data }; } return map; }
function highestInvestmentStatName(def) { const totals = emptyArmorStats(); for (const stat of def?.investmentStats || []) { const col = HASH_TO_COLUMN[toUint32(stat.statTypeHash)] || HASH_TO_COLUMN[toSigned32(stat.statTypeHash)]; if (col) totals[col] += Number(stat.value || 0); } let best = ''; let value = 0; for (const key of STAT_KEYS) if (totals[key] > value) { best = key; value = totals[key]; } return best === 'ClassAbility' ? 'Class' : best; }
function armorArchetype(def, plugDefs) { const found = (plugDefs || []).find((plug) => { const name = normalizeName(plug?.displayProperties?.name); const type = normalizeName(plug?.itemTypeDisplayName); const category = normalizeName(plug?.plug?.plugCategoryIdentifier); return ARCHETYPE_NAMES.has(name) || type.includes('archetype') || category.includes('archetype'); }); const fallbackName = highestInvestmentStatName(def) || '—'; if (!found) return { name: fallbackName, icon: '', description: '', hash: '', trait: '' }; return { name: found.displayProperties?.name || fallbackName, icon: bungieIconUrl(found.displayProperties?.icon), description: found.displayProperties?.description || '', hash: found.hash || '', trait: found.plug?.plugCategoryIdentifier || '' }; }
function armorSetBonuses(def, activePlugDefs, allDefs, archetypeHash) { const candidates = [...(activePlugDefs || []), ...(allDefs || [])]; return uniquePerks(candidates.filter((plug) => isDisplayableSetBonus(plug, archetypeHash)).map((plug) => ({ ...perkInfo(plug, 'set'), label: setBonusLabel(plug) }))).slice(0, 4); }
function isDisplayableSetBonus(plugDef, archetypeHash) { const name = normalizeName(plugDef?.displayProperties?.name); const desc = normalizeName(plugDef?.displayProperties?.description); const category = normalizeName(plugDef?.plug?.plugCategoryIdentifier); const type = normalizeName(plugDef?.itemTypeDisplayName); const text = normalizeName(`${name} ${desc} ${category} ${type}`); if (!name || name === 'empty mod socket' || name === 'default ornament' || name.includes('deprecated')) return false; if (String(plugDef?.hash || '') === String(archetypeHash || '') || ARCHETYPE_NAMES.has(name)) return false; const hasSet = text.includes(' set ') || text.startsWith('set ') || text.includes('armor set') || text.includes('setbonus'); const hasBonus = text.includes('bonus') || text.includes('perk') || text.includes('trait') || text.includes('piece') || text.includes('pieces'); return category.includes('set bonus') || category.includes('armor set') || category.includes('setbonus') || type.includes('set bonus') || type.includes('armor set') || (hasSet && hasBonus) || /\b[24]\s*piece\b/.test(desc) || /\b[24]\s*pieces\b/.test(desc) || desc.includes('armor set bonus') || desc.includes('wearing 2') || desc.includes('wearing 4') || desc.includes('while wearing'); }
function setBonusLabel(plugDef) { const text = normalizeName(`${plugDef?.displayProperties?.name || ''} ${plugDef?.displayProperties?.description || ''}`); if (/\b2\s*piece\b/.test(text) || text.includes('wearing 2') || text.includes('two piece')) return '2-Piece Set Bonus'; if (/\b4\s*piece\b/.test(text) || text.includes('wearing 4') || text.includes('four piece')) return '4-Piece Set Bonus'; return 'Armor Set Bonus'; }
function armorBonusPerks(def, activePlugDefs, archetypeHash, setBonuses = []) { const setHashes = new Set(setBonuses.map((p) => String(p.hash || ''))); return uniquePerks((activePlugDefs || []).filter((plug) => !setHashes.has(String(plug.hash || '')) && isDisplayableArmorBonus(plug, archetypeHash)).map((plug) => perkInfo(plug, 'armor'))).slice(0, 5); }
function isDisplayableArmorBonus(plugDef, archetypeHash) { const name = normalizeName(plugDef?.displayProperties?.name); const desc = normalizeName(plugDef?.displayProperties?.description); const category = normalizeName(plugDef?.plug?.plugCategoryIdentifier); if (!name || name === 'empty mod socket' || name === 'default ornament' || name.includes('deprecated')) return false; if (String(plugDef?.hash || '') === String(archetypeHash || '') || ARCHETYPE_NAMES.has(name) || isDisplayableSetBonus(plugDef, archetypeHash)) return false; return category.includes('armor bonus') || category.includes('origin trait') || category.includes('intrinsic') || desc.includes('armor bonus') || desc.includes('wearing'); }
function exoticArmorPerk(def, activePlugDefs, archetypeHash) { const candidates = [def, ...(activePlugDefs || [])].filter((entry) => isDisplayableExoticPerk(entry, archetypeHash)); const best = candidates.find((entry) => normalizeName(entry.displayProperties?.name) !== normalizeName(def.displayProperties?.name)) || candidates[0]; return perkInfo(best || def, 'exotic'); }
function isDisplayableExoticPerk(entry, archetypeHash) { if (!entry) return false; const rarity = normalizeName(entry.inventory?.tierTypeName); const name = normalizeName(entry.displayProperties?.name); const desc = normalizeName(entry.displayProperties?.description); const category = normalizeName(entry.plug?.plugCategoryIdentifier); if (!name || name === 'empty mod socket' || String(entry.hash || '') === String(archetypeHash || '')) return false; return rarity.includes('exotic') || category.includes('exotic') || category.includes('intrinsic') || desc.includes('exotic') || (entry.itemType === 2 && desc.length > 30); }
function activeOrnament(activePlugDefs) { return (activePlugDefs || []).map((plug) => { const name = normalizeName(plug?.displayProperties?.name); const category = normalizeName(plug?.plug?.plugCategoryIdentifier); const type = normalizeName(plug?.itemTypeDisplayName); if (!plug?.displayProperties?.icon || name === 'default ornament') return null; if (category.includes('skin') || category.includes('ornament') || type.includes('ornament') || name.includes('ornament')) return { name: plug.displayProperties.name, icon: bungieIconUrl(plug.displayProperties.icon), hash: plug.hash || '' }; return null; }).find(Boolean) || null; }
function isMasterworked(instanceComponent, activePlugDefs, statRow) { if (Number(instanceComponent?.energy?.energyCapacity || 0) >= 10) return true; if (Number(statRow.MasterworkBonusTotal || 0) >= 10) return true; return (activePlugDefs || []).some((plug) => bonusTypeForPlug(plug) === 'masterwork' && (normalizeName(plug?.displayProperties?.name).includes('masterwork') || normalizeName(plug?.plug?.plugCategoryIdentifier).includes('masterwork'))); }
function perkInfo(def, kind) { return { name: def?.displayProperties?.name || 'Armor Bonus', description: def?.displayProperties?.description || '', icon: bungieIconUrl(def?.displayProperties?.icon), hash: def?.hash || '', kind }; }
function uniquePerks(perks) { const seen = new Set(); return perks.filter((perk) => { const key = normalizeName(`${perk.hash || ''} ${perk.name} ${perk.description}`); if (!key || seen.has(key)) return false; seen.add(key); return true; }); }
