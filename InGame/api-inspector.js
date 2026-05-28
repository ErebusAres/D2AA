import { getMembership, bungieFetch, getDef, bungieIconUrl, toUint32, toSigned32 } from '../src-clean/data/bungie-api.js';
import { isSignedIn, handleOAuthRedirect, startLogin } from '../src-clean/data/bungie-auth.js';

const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305, 307].join(',');
const VAULT_BUCKET_HASH = 138197802;
const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock', 3: 'Any' };
const STAT_KEYS = ['Health', 'Melee', 'Grenade', 'Super', 'ClassAbility', 'Weapon'];
const BASE_HASH_TO_COLUMN = { 392767087: 'Health', 4244567218: 'Melee', 1735777505: 'Grenade', 144602215: 'Super', 2996146975: 'ClassAbility', 1943323491: 'Weapon' };
const HASH_TO_COLUMN = { ...BASE_HASH_TO_COLUMN };
for (const [hash, key] of Object.entries(BASE_HASH_TO_COLUMN)) HASH_TO_COLUMN[toSigned32(hash)] = key;
const STAT_LABELS = { Health: 'Health / Resilience', Melee: 'Melee / Strength', Grenade: 'Grenade / Discipline', Super: 'Super / Intellect', ClassAbility: 'Class Ability', Weapon: 'Weapon' };
const els = {};
let inspected = [];
let selectedId = '';

boot();

async function boot() {
  cacheEls();
  bind();
  try { await handleOAuthRedirect(); } catch (error) { status(error.message || String(error)); }
  status(isSignedIn() ? 'Signed in. Click Fetch Armor Data.' : 'Not signed in. Connect Bungie first.');
}

function cacheEls() { ['loginBtn', 'fetchBtn', 'filterBox', 'status', 'list', 'detail'].forEach((id) => els[id] = document.getElementById(id)); }
function bind() { els.loginBtn.addEventListener('click', startLogin); els.fetchBtn.addEventListener('click', fetchAndInspect); els.filterBox.addEventListener('input', renderList); }
function status(text) { els.status.textContent = text; }

async function fetchAndInspect() {
  if (!isSignedIn()) return startLogin();
  status('Fetching profile from Bungie...');
  const membership = await getMembership();
  const profile = await bungieFetch(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
  inspected = await buildInspection(profile, membership);
  status(`Fetched ${inspected.length} armor items. Select one to inspect exact stats/sockets.`);
  selectedId = inspected[0]?.id || '';
  renderList();
  renderDetail();
  window.d2aaApiInspection = inspected;
}

async function buildInspection(profile, membership) {
  const allItems = collectItems(profile);
  const statComponents = profile.itemComponents?.stats?.data || {};
  const instanceComponents = profile.itemComponents?.instances?.data || {};
  const socketComponents = profile.itemComponents?.sockets?.data || {};
  const stateComponents = profile.itemComponents?.state?.data || {};
  const uniqueItemHashes = unique(allItems.map((item) => toUint32(item.itemHash)).filter(Boolean));
  status(`Resolving item definitions: 0/${uniqueItemHashes.length}`);
  const itemDefs = await lookupDefs(uniqueItemHashes, 'DestinyInventoryItemDefinition', (done, total) => status(`Resolving item definitions: ${done}/${total}`));
  const armorItems = allItems.filter((item) => item.itemInstanceId && isArmorDef(itemDefs[toUint32(item.itemHash)]));
  const plugSetHashes = unique(armorItems.flatMap((item) => plugSetHashesForItem(itemDefs[toUint32(item.itemHash)], socketComponents[item.itemInstanceId])).filter(Boolean));
  const plugSetDefs = await lookupDefs(plugSetHashes, 'DestinyPlugSetDefinition', (done, total) => status(`Resolving plug sets: ${done}/${total}`));
  const plugHashes = unique(armorItems.flatMap((item) => allPlugHashes(itemDefs[toUint32(item.itemHash)], socketComponents[item.itemInstanceId], plugSetDefs)).filter(Boolean));
  const plugDefs = await lookupDefs(plugHashes, 'DestinyInventoryItemDefinition', (done, total) => status(`Resolving plug definitions: ${done}/${total}`));

  return armorItems.map((item) => {
    const id = item.itemInstanceId;
    const def = itemDefs[toUint32(item.itemHash)];
    const statComponent = statComponents[id] || {};
    const instance = instanceComponents[id] || {};
    const sockets = socketComponents[id] || {};
    const activePlugs = activePlugHashesForInstance(sockets).map((hash, socketIndex) => ({ hash, socketIndex, def: plugDefs[hash] })).filter((entry) => entry.def);
    const activePlugSummaries = activePlugs.map((entry) => inspectPlug(entry.def, entry.socketIndex));
    const current = instanceStats(statComponent, def);
    const definition = definitionStats(def);
    const signedBonuses = sumPlugStats(activePlugSummaries.filter((plug) => plug.isArmorStatAffecting && !plug.isArchetype));
    const baseFromCurrentMinusPlugStats = subtractStats(current, signedBonuses);
    const currentTotal = sumStats(current);
    const signedBonusTotal = sumStats(signedBonuses);
    const baseMinusPlugTotal = sumStats(baseFromCurrentMinusPlugStats);
    return {
      id,
      name: def.displayProperties?.name || 'Unknown Armor',
      icon: bungieIconUrl(def.displayProperties?.icon),
      slot: slotForItem(def),
      className: CLASS_TYPE[def.classType] || 'Any',
      rarity: rarityForItem(def),
      owner: item.d2aaOwner === 'vault' ? 'Vault' : item.d2aaEquipped ? 'Equipped' : 'Inventory',
      power: Number(instance.primaryStat?.value ?? instance.quality ?? item.primaryStat?.value ?? item.power ?? item.light ?? 0) || 0,
      state: stateComponents[id]?.state ?? item.state ?? 0,
      itemHash: toUint32(item.itemHash),
      instanceStats: current,
      definitionStats: definition,
      signedActivePlugStats: signedBonuses,
      baseFromCurrentMinusPlugStats,
      totals: { currentTotal, signedBonusTotal, baseMinusPlugTotal, definitionTotal: sumStats(definition) },
      activePlugs: activePlugSummaries,
      raw: { item, instance, statComponent, sockets, definition: def, membershipType: membership.membershipType, membershipId: membership.membershipId }
    };
  }).sort((a, b) => b.power - a.power || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

function inspectPlug(def, socketIndex) {
  const name = def.displayProperties?.name || '';
  const description = def.displayProperties?.description || '';
  const category = def.plug?.plugCategoryIdentifier || '';
  const type = def.itemTypeDisplayName || '';
  const signed = signedStatsForInvestment(def.investmentStats || []);
  const text = normal(`${name} ${description} ${category} ${type}`);
  return {
    socketIndex,
    hash: toUint32(def.hash),
    name,
    description,
    icon: bungieIconUrl(def.displayProperties?.icon),
    category,
    type,
    stats: signed,
    statsTotal: sumStats(signed),
    statsAbsTotal: absSumStats(signed),
    isArchetype: isArchetypePlug(def),
    isMasterwork: text.includes('masterwork') || normal(category).includes('masterwork'),
    isArtifice: text.includes('artifice'),
    isArmorMod: text.includes('armor mod') || text.includes('armor mods') || normal(category).includes('armor mods'),
    isTuningLike: text.includes('tuning') || text.includes('tuned') || text.includes('attunement') || hasPositiveAndNegative(signed),
    isSetLike: looksLikeSetBonus(text),
    isArmorStatAffecting: absSumStats(signed) > 0
  };
}

function renderList() {
  const filter = normal(els.filterBox.value);
  const rows = inspected.filter((row) => !filter || normal(`${row.name} ${row.slot} ${row.className} ${row.id}`).includes(filter));
  els.list.innerHTML = rows.map((row) => `<button class="item ${row.id === selectedId ? 'is-active' : ''}" type="button" data-id="${h(row.id)}"><img src="${h(row.icon)}" alt=""><span><b>${h(row.name)}</b><small>${h(row.className)} · ${h(row.slot)} · ${h(row.owner)} · ${h(row.id)}</small><span class="pill">base? ${row.totals.baseMinusPlugTotal}</span><span class="pill">current ${row.totals.currentTotal}</span><span class="pill">plug ${signed(row.totals.signedBonusTotal)}</span></span><b>${h(row.power)}</b></button>`).join('');
  els.list.querySelectorAll('.item').forEach((button) => button.addEventListener('click', () => { selectedId = button.dataset.id; renderList(); renderDetail(); }));
}

function renderDetail() {
  const row = inspected.find((item) => item.id === selectedId);
  if (!row) { els.detail.innerHTML = '<p>Select an armor item.</p>'; return; }
  const badBase = row.totals.baseMinusPlugTotal > 75;
  els.detail.innerHTML = `
    <h2>${h(row.name)}</h2>
    <p>${h(row.className)} · ${h(row.slot)} · ${h(row.rarity)} · ${h(row.owner)} · ${h(row.id)}</p>
    <div class="summary">
      <div class="box">Instance current total<b>${row.totals.currentTotal}</b></div>
      <div class="box">Active plug signed total<b class="${row.totals.signedBonusTotal < 0 ? 'neg' : 'pos'}">${signed(row.totals.signedBonusTotal)}</b></div>
      <div class="box">Current - plugs base estimate<b class="${badBase ? 'neg' : ''}">${row.totals.baseMinusPlugTotal}</b></div>
      <div class="box">Definition stat total<b>${row.totals.definitionTotal}</b></div>
    </div>
    <h3>Stat table</h3>
    ${statTable(row)}
    <h3>Active sockets/plugs</h3>
    ${row.activePlugs.map(renderPlug).join('') || '<p>No active plugs found.</p>'}
    <h3>Raw compact JSON</h3>
    <pre>${h(JSON.stringify(compactRaw(row), null, 2))}</pre>
  `;
}

function statTable(row) {
  return `<table><thead><tr><th>Stat</th><th>Instance Current</th><th>Definition</th><th>Signed Active Plug Sum</th><th>Current - Plug Sum</th></tr></thead><tbody>${STAT_KEYS.map((key) => `<tr><td>${h(STAT_LABELS[key])}</td><td>${row.instanceStats[key]}</td><td>${row.definitionStats[key]}</td><td class="${row.signedActivePlugStats[key] < 0 ? 'neg' : row.signedActivePlugStats[key] > 0 ? 'pos' : ''}">${signed(row.signedActivePlugStats[key])}</td><td>${row.baseFromCurrentMinusPlugStats[key]}</td></tr>`).join('')}</tbody></table>`;
}

function renderPlug(plug) {
  const flags = [plug.isArchetype && 'archetype', plug.isMasterwork && 'masterwork', plug.isArtifice && 'artifice', plug.isArmorMod && 'mod', plug.isTuningLike && 'tuning-like', plug.isSetLike && 'set-like', plug.isArmorStatAffecting && 'has stats'].filter(Boolean);
  return `<div class="plug"><img src="${h(plug.icon)}" alt=""><div><b>${h(plug.name || '(unnamed plug)')}</b><small>socket ${plug.socketIndex} · hash ${plug.hash}</small><small>${h(plug.type)} · ${h(plug.category)}</small><small>${h(plug.description)}</small><div>${flags.map((flag) => `<span class="pill">${h(flag)}</span>`).join('')}</div></div><b>${signed(plug.statsTotal)}</b></div>${absSumStats(plug.stats) ? statTableForPlug(plug) : ''}`;
}

function statTableForPlug(plug) {
  return `<table><tbody>${STAT_KEYS.filter((key) => plug.stats[key]).map((key) => `<tr><td>${h(STAT_LABELS[key])}</td><td class="${plug.stats[key] < 0 ? 'neg' : 'pos'}">${signed(plug.stats[key])}</td></tr>`).join('')}</tbody></table>`;
}

function compactRaw(row) {
  return { id: row.id, itemHash: row.itemHash, name: row.name, slot: row.slot, power: row.power, instanceStats: row.instanceStats, definitionStats: row.definitionStats, signedActivePlugStats: row.signedActivePlugStats, baseFromCurrentMinusPlugStats: row.baseFromCurrentMinusPlugStats, activePlugs: row.activePlugs.map((p) => ({ socketIndex: p.socketIndex, hash: p.hash, name: p.name, category: p.category, type: p.type, stats: p.stats, flags: { archetype: p.isArchetype, masterwork: p.isMasterwork, artifice: p.isArtifice, mod: p.isArmorMod, tuningLike: p.isTuningLike, setLike: p.isSetLike } })) };
}

async function lookupDefs(hashes, type, progress) {
  const out = {};
  let done = 0;
  for (const hash of hashes) {
    try { out[toUint32(hash)] = await getDef(type, hash); }
    catch (error) { console.warn('definition lookup failed', type, hash, error); }
    done++;
    if (done % 25 === 0 || done === hashes.length) progress?.(done, hashes.length);
    if (done % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
}

function collectItems(profile) { const out = []; if (profile.profileInventory?.data?.items) out.push(...profile.profileInventory.data.items.map((item) => ({ ...item, d2aaOwner: 'vault' }))); for (const [characterId, container] of Object.entries(profile.characterInventories?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId }))); for (const [characterId, container] of Object.entries(profile.characterEquipment?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId, d2aaEquipped: true }))); return out; }
function activePlugHashesForInstance(socketComponent) { const hashes = []; for (const socket of socketComponent?.sockets || []) { const plugHash = socket.plugHash || socket.plugItemHash; if (plugHash) hashes.push(toUint32(plugHash)); } return hashes; }
function reusablePlugHashesForInstance(socketComponent) { const hashes = []; for (const socket of socketComponent?.sockets || []) { for (const hash of socket.reusablePlugHashes || []) if (hash) hashes.push(toUint32(hash)); for (const item of socket.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash)); } return hashes; }
function plugSetHashesForItem(def, socketComponent) { const hashes = []; for (const entry of def?.sockets?.socketEntries || []) { if (entry.reusablePlugSetHash) hashes.push(toUint32(entry.reusablePlugSetHash)); if (entry.randomizedPlugSetHash) hashes.push(toUint32(entry.randomizedPlugSetHash)); if (entry.randomizedPlugSet?.hash) hashes.push(toUint32(entry.randomizedPlugSet.hash)); } for (const socket of socketComponent?.sockets || []) { if (socket.reusablePlugSetHash) hashes.push(toUint32(socket.reusablePlugSetHash)); if (socket.randomizedPlugSetHash) hashes.push(toUint32(socket.randomizedPlugSetHash)); } return unique(hashes); }
function plugHashesForPlugSet(plugSetDef) { const hashes = []; for (const item of plugSetDef?.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash)); for (const item of plugSetDef?.randomizedPlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash)); return hashes; }
function plugHashesForDefinition(def, plugSetDefs = {}) { const hashes = []; for (const entry of def?.sockets?.socketEntries || []) { if (entry.singleInitialItemHash) hashes.push(toUint32(entry.singleInitialItemHash)); for (const item of entry.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash)); for (const item of entry.randomizedPlugSet?.reusablePlugItems || []) if (item.plugItemHash) hashes.push(toUint32(item.plugItemHash)); for (const hash of [entry.reusablePlugSetHash, entry.randomizedPlugSetHash, entry.randomizedPlugSet?.hash].filter(Boolean)) hashes.push(...plugHashesForPlugSet(plugSetDefs[toUint32(hash)])); } return hashes; }
function allPlugHashes(def, socketComponent, plugSetDefs = {}) { return unique([...activePlugHashesForInstance(socketComponent), ...reusablePlugHashesForInstance(socketComponent), ...plugHashesForDefinition(def, plugSetDefs)].filter(Boolean)); }
function isArmorDef(def) { if (!def) return false; const type = normal(def.itemTypeDisplayName); const name = normal(def.displayProperties?.name); return def.itemType === 2 || type.includes('armor') || ['helmet', 'gauntlets', 'chest armor', 'leg armor', 'class item'].some((part) => type.includes(part) || name.includes(part)); }
function slotForItem(def) { const bucket = Number(def.inventory?.bucketTypeHash || 0); const type = normal(def.itemTypeDisplayName || def.displayProperties?.name); if (bucket === 3448274439 || type.includes('helmet')) return 'Helmet'; if (bucket === 3551918588 || type.includes('gauntlet') || type.includes('glove')) return 'Gauntlets'; if (bucket === 14239492 || type.includes('chest')) return 'Chest Armor'; if (bucket === 20886954 || type.includes('leg')) return 'Leg Armor'; if (bucket === 1585787867 || type.includes('class item') || type.includes('bond') || type.includes('cloak') || type.includes('mark')) return 'Class Item'; return def.itemTypeDisplayName || 'Armor'; }
function rarityForItem(def) { const tier = Number(def.inventory?.tierType || 0); if (tier === 6) return 'Exotic'; if (tier === 5) return 'Legendary'; if (tier === 4) return 'Rare'; return def.inventory?.tierTypeName || 'Legendary'; }
function isArchetypePlug(def) { const name = normal(def?.displayProperties?.name); const category = normal(def?.plug?.plugCategoryIdentifier); const type = normal(def?.itemTypeDisplayName); return ['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner'].includes(name) || category.includes('archetype') || type.includes('archetype'); }
function instanceStats(statComponent, def) { const source = Object.keys(statComponent?.stats || {}).length ? statComponent.stats : {}; return statsFromHashMap(source); }
function definitionStats(def) { return statsFromHashMap(def?.stats?.stats || {}); }
function statsFromHashMap(source) { const out = emptyStats(); for (const [hash, stat] of Object.entries(source || {})) { const key = HASH_TO_COLUMN[toUint32(hash)] || HASH_TO_COLUMN[toSigned32(hash)]; if (key) out[key] = number(stat?.value ?? stat?.statValue ?? stat?.base ?? stat?.minimum ?? 0); } return out; }
function signedStatsForInvestment(investmentStats) { const out = emptyStats(); for (const stat of investmentStats || []) { const key = HASH_TO_COLUMN[toUint32(stat.statTypeHash)] || HASH_TO_COLUMN[toSigned32(stat.statTypeHash)]; const value = number(stat.value ?? stat.statValue); if (key && value) out[key] += value; } return out; }
function sumPlugStats(plugs) { const out = emptyStats(); for (const plug of plugs || []) for (const key of STAT_KEYS) out[key] += number(plug.stats?.[key]); return out; }
function subtractStats(a, b) { const out = emptyStats(); for (const key of STAT_KEYS) out[key] = number(a[key]) - number(b[key]); return out; }
function emptyStats() { return Object.fromEntries(STAT_KEYS.map((key) => [key, 0])); }
function sumStats(stats) { return STAT_KEYS.reduce((sum, key) => sum + number(stats?.[key]), 0); }
function absSumStats(stats) { return STAT_KEYS.reduce((sum, key) => sum + Math.abs(number(stats?.[key])), 0); }
function hasPositiveAndNegative(stats) { const values = Object.values(stats).map(number); return values.some((value) => value > 0) && values.some((value) => value < 0); }
function looksLikeSetBonus(text) { return text.includes('set bonus') || text.includes('armor set') || text.includes('2 piece') || text.includes('4 piece') || text.includes('two piece') || text.includes('four piece') || text.includes('while wearing') || text.includes('setbonus'); }
function unique(values) { return [...new Set(values)]; }
function number(value) { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
function signed(value) { const n = number(value); return n > 0 ? `+${n}` : String(n); }
function normal(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }
function h(value) { return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
