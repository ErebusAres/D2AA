import { state, setState, subscribe } from '../src-clean/state.js';
import { getDef, bungieIconUrl, mapLimit, toUint32 } from '../src-clean/data/bungie-api.js';
import { saveBungieInventory } from '../src-clean/data/inventory-cache.js';

const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
const ENHANCEMENT_CACHE_KEY = 'd2aa_ingame_item_definition_enhancements_v3';
const enhancedItems = new Set();
const enhancementCache = readEnhancementCache();
let running = false;
let queued = false;
let persistTimer = null;
let lastRunAt = 0;

function scheduleEnhance(){
  if (running) { queued = true; return; }
  const gap = Date.now() - lastRunAt;
  setTimeout(() => requestIdleCallbackSafe(enhanceRows), Math.max(0, 500 - gap));
}

async function enhanceRows(){
  if (running || !state.rows?.length) return;
  running = true;
  queued = false;
  lastRunAt = Date.now();
  try {
    let rows = applyCachedEnhancements(state.rows);
    const candidates = rows
      .filter((row) => row.ItemHash && !enhancementCache[String(toUint32(row.ItemHash))] && !enhancedItems.has(String(toUint32(row.ItemHash))))
      .slice(0, 25);

    if (candidates.length) {
      const byHash = new Map(candidates.map((row) => [String(toUint32(row.ItemHash)), row]));
      await mapLimit([...byHash.keys()], 2, async (hash) => {
        const def = await getDef('DestinyInventoryItemDefinition', hash).catch(() => null);
        const enhancement = await buildEnhancement(def, byHash.get(String(hash)));
        enhancedItems.add(String(hash));
        enhancementCache[String(hash)] = enhancement || { archetype: null, setBonuses: [], exotic: null, audit: { itemHash: hash, failed: true } };
      });
      writeEnhancementCache();
      rows = applyCachedEnhancements(rows);
    }

    if (rows !== state.rows) {
      setState({ rows, status: state.status });
      persistEnhancedRows(rows);
    }
  } finally {
    running = false;
    if (queued) scheduleEnhance();
  }
}

function applyCachedEnhancements(rows){
  let changed = false;
  const archetypeIconByName = buildArchetypeIconMap(rows);
  const nextRows = rows.map((row) => {
    const info = enhancementCache[String(toUint32(row.ItemHash))];
    const next = info?.audit ? { ...row, EnhancedDefinitions: info.audit } : { ...row };
    if (info?.archetype?.name && (!next.Archetype || sameKey(next.Archetype) === sameKey('—'))) { next.Archetype = info.archetype.name; changed = true; }
    if (info?.archetype?.icon && (!next.ArchetypeIcon || fallbackIcon(next.ArchetypeIcon))) { next.ArchetypeIcon = info.archetype.icon; changed = true; }
    if (info?.archetype?.description && !next.ArchetypeDescription) { next.ArchetypeDescription = info.archetype.description; changed = true; }

    const sharedIcon = archetypeIconByName.get(sameKey(next.Archetype));
    if (sharedIcon && (!next.ArchetypeIcon || fallbackIcon(next.ArchetypeIcon))) { next.ArchetypeIcon = sharedIcon; changed = true; }

    const cleanSetBonuses = cleanSetBonusList(info?.setBonuses || [], next);
    if (cleanSetBonuses.length && !equivalentList(next.ArmorSetBonuses, cleanSetBonuses)) {
      next.ArmorSetBonuses = cleanSetBonuses;
      next.SetBonuses = cleanSetBonuses;
      changed = true;
    }

    if (String(next.Rarity || '').toLowerCase() === 'exotic' && info?.exotic?.name && !sameKey(info.exotic.name).includes(sameKey(next.Name))) {
      if (sameKey(next.ExoticPerkName) !== sameKey(info.exotic.name)) {
        next.ExoticPerkName = info.exotic.name;
        next.ExoticPerkDescription = info.exotic.description || next.ExoticPerkDescription || '';
        next.ExoticIcon = info.exotic.icon || next.ExoticIcon || '';
        changed = true;
      }
    }
    return changed ? next : row;
  });
  return changed ? nextRows : rows;
}

async function buildEnhancement(def, row){
  if (!def) return null;
  const plugHashes = [...new Set([...directPlugHashes(def), ...await plugSetHashes(def)].filter(Boolean).map(toUint32))];
  const plugDefs = (await mapLimit(plugHashes, 4, (hash) => getDef('DestinyInventoryItemDefinition', hash).catch(() => null))).filter(Boolean);
  const itemSet = await itemSetInfo(def, row);
  const archetype = bestArchetype(plugDefs, row);
  const setFromPlugs = uniquePerks(plugDefs.filter((plug) => isSetBonus(plug, row)).map((plug) => perk(plug, setLabel(plug), 'set')));
  const setBonuses = cleanSetBonusList(uniquePerks([...itemSet.bonuses, ...setFromPlugs]).slice(0, 6), row);
  const exotic = String(row?.Rarity || '').toLowerCase() === 'exotic' ? bestExotic(plugDefs, def, row) : null;
  const audit = {
    itemHash: def.hash || row?.ItemHash || '',
    itemSetHash: def.itemSetData?.itemSetHash || '',
    itemSetName: itemSet.name || '',
    setBonusCount: setBonuses.length,
    plugCount: plugDefs.length,
    plugSetHashes: socketPlugSetHashes(def),
    candidateSetBonuses: setBonuses.map((bonus) => ({ name: bonus.name, label: bonus.label, hash: bonus.hash || '' }))
  };
  return { archetype, setBonuses, exotic, audit };
}

async function itemSetInfo(def, row){
  const setHash = def?.itemSetData?.itemSetHash || def?.itemSetData?.setHash;
  if (!setHash) return { name: '', bonuses: [] };
  const setDef = await getDef('DestinyItemSetDefinition', setHash).catch(() => null);
  const bonuses = [];
  const entries = [
    ...(setDef?.setPerks || []),
    ...(setDef?.setBonuses || []),
    ...(setDef?.perks || []),
    ...(def?.itemSetData?.setPerks || []),
    ...(def?.itemSetData?.setBonuses || []),
    ...(def?.itemSetData?.perks || [])
  ];

  for (const entry of entries) {
    const plugHash = entry.plugItemHash || entry.perkHash || entry.rewardItemHash;
    const plug = plugHash ? await getDef('DestinyInventoryItemDefinition', plugHash).catch(() => null) : null;
    const rawName = entry.name || entry.displayProperties?.name || plug?.displayProperties?.name || '';
    const rawDesc = entry.description || entry.displayProperties?.description || plug?.displayProperties?.description || '';
    const name = rawName || setDef?.displayProperties?.name || def?.itemSetData?.name || 'Armor Set Bonus';
    if (!name && !rawDesc) continue;
    const candidate = {
      kind: 'set',
      label: setEntryLabel(entry, rawDesc || rawName),
      name,
      description: rawDesc,
      icon: bungieIconUrl(entry.icon || entry.displayProperties?.icon || plug?.displayProperties?.icon),
      hash: plugHash || entry.hash || ''
    };
    if (isRealSetBonus(candidate, row)) bonuses.push(candidate);
  }

  const setName = setDef?.displayProperties?.name || def?.itemSetData?.name || '';
  const setDesc = setDef?.displayProperties?.description || '';
  if (!bonuses.length && setName) {
    bonuses.push({
      kind: 'set',
      label: 'Armor Set Bonus',
      name: setName,
      description: setDesc || 'Armor set bonus metadata found. Detailed 2-piece/4-piece text was not exposed in the cached socket data yet.',
      icon: '',
      hash: setHash
    });
  }
  return { name: setName, bonuses: uniquePerks(bonuses) };
}

function directPlugHashes(def){
  const out = [];
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.singleInitialItemHash) out.push(entry.singleInitialItemHash);
    for (const item of entry.reusablePlugItems || []) if (item.plugItemHash) out.push(item.plugItemHash);
    for (const item of entry.randomizedPlugItems || []) if (item.plugItemHash) out.push(item.plugItemHash);
  }
  return out;
}
function socketPlugSetHashes(def){
  const setHashes = [];
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.reusablePlugSetHash) setHashes.push(toUint32(entry.reusablePlugSetHash));
    if (entry.randomizedPlugSetHash) setHashes.push(toUint32(entry.randomizedPlugSetHash));
  }
  return [...new Set(setHashes)];
}
async function plugSetHashes(def){
  const plugSets = (await mapLimit(socketPlugSetHashes(def), 3, (hash) => getDef('DestinyPlugSetDefinition', hash).catch(() => null))).filter(Boolean);
  const out = [];
  for (const set of plugSets) {
    for (const item of set.reusablePlugItems || []) if (item.plugItemHash) out.push(item.plugItemHash);
    for (const item of set.randomizedPlugItems || []) if (item.plugItemHash) out.push(item.plugItemHash);
    for (const item of set.plugs || []) if (item.plugItemHash || item.itemHash) out.push(item.plugItemHash || item.itemHash);
  }
  return out;
}

function bestArchetype(plugs, row){
  const found = plugs.filter((plug) => isArchetype(plug));
  const preferred = found.find((plug) => bungieIconUrl(plug.displayProperties?.icon)) || found[0];
  if (!preferred) return null;
  return { name: preferred.displayProperties?.name || row?.Archetype || '', description: preferred.displayProperties?.description || '', icon: bungieIconUrl(preferred.displayProperties?.icon), hash: preferred.hash || '' };
}
function isArchetype(plug){
  const name = sameKey(plug?.displayProperties?.name);
  const category = sameKey(plug?.plug?.plugCategoryIdentifier);
  const type = sameKey(plug?.itemTypeDisplayName);
  return ARCHETYPE_NAMES.has(name) || category.includes('archetype') || type.includes('archetype');
}
function isSetBonus(plug, row){
  if (!plug?.displayProperties?.name) return false;
  if (isArchetype(plug)) return false;
  const candidate = perk(plug, setLabel(plug), 'set');
  return isRealSetBonus(candidate, row) && looksSetBonusText(`${plug.displayProperties?.name || ''} ${plug.displayProperties?.description || ''} ${plug.itemTypeDisplayName || ''} ${plug.plug?.plugCategoryIdentifier || ''}`);
}
function isRealSetBonus(candidate, row){
  const name = sameKey(candidate?.name);
  const desc = sameKey(candidate?.description);
  const text = `${name}${desc}${sameKey(candidate?.label)}`;
  if (!name) return false;
  if (name === sameKey(row?.Name)) return false;
  if (looksLikeArmorPieceName(candidate.name) && !looksSetBonusText(candidate.description)) return false;
  return looksSetBonusText(text) || desc.length > 0 || name.includes('set');
}
function cleanSetBonusList(list, row){ return uniquePerks((list || []).filter((bonus) => isRealSetBonus(bonus, row))); }
function looksSetBonusText(value){ const text = sameKey(value); return text.includes('armorsetbonus') || text.includes('setbonus') || text.includes('armorset') || text.includes('2piece') || text.includes('4piece') || text.includes('twopiece') || text.includes('fourpiece') || text.includes('wearing2') || text.includes('wearing4') || text.includes('piecesofthisset') || text.includes('smokejumper'); }
function looksLikeArmorPieceName(value){ const text = sameKey(value); return ['helmet','helm','gauntlet','glove','chest','vest','plate','robe','leg','boot','bond','cloak','mark','cover','grips','robes','strides'].some((part) => text.includes(part)); }
function bestExotic(plugs, def, row){
  const itemName = sameKey(row?.Name || def?.displayProperties?.name);
  const candidates = plugs.filter((plug) => {
    if (!plug?.displayProperties?.name || isArchetype(plug) || isSetBonus(plug, row)) return false;
    const name = sameKey(plug.displayProperties.name);
    const text = sameKey(`${plug.displayProperties?.name || ''} ${plug.displayProperties?.description || ''} ${plug.itemTypeDisplayName || ''} ${plug.plug?.plugCategoryIdentifier || ''}`);
    return name !== itemName && (text.includes('exotic') || text.includes('intrinsic') || text.includes('trait') || text.includes('perk'));
  });
  const best = candidates.find((plug) => bungieIconUrl(plug.displayProperties?.icon)) || candidates[0];
  return best ? perk(best, 'Exotic Armor Perk', 'exotic') : null;
}
function perk(plug, label, kind){ return { kind, label, name: plug.displayProperties?.name || label, description: plug.displayProperties?.description || '', icon: bungieIconUrl(plug.displayProperties?.icon), hash: plug.hash || '' }; }
function setLabel(plug){ return setEntryLabel(null, `${plug?.displayProperties?.description || ''} ${plug?.displayProperties?.name || ''}`); }
function setEntryLabel(entry, textValue){ const text = sameKey(`${entry?.displayStyle || ''} ${entry?.requiredSetCount || ''} ${textValue || ''}`); if (text.includes('2piece') || text.includes('twopiece') || text.includes('wearing2') || text.includes('requiredsetcount2')) return '2-Piece Set Bonus'; if (text.includes('4piece') || text.includes('fourpiece') || text.includes('wearing4') || text.includes('requiredsetcount4')) return '4-Piece Set Bonus'; return 'Armor Set Bonus'; }
function buildArchetypeIconMap(rows){ const map = new Map(); for (const row of rows || []) { const key = sameKey(row.Archetype); const icon = row.ArchetypeIcon; if (key && icon && !fallbackIcon(icon)) map.set(key, icon); } for (const info of Object.values(enhancementCache)) { const key = sameKey(info?.archetype?.name); const icon = info?.archetype?.icon; if (key && icon && !fallbackIcon(icon)) map.set(key, icon); } return map; }
function uniquePerks(perks){ const seen = new Set(); return perks.filter((perk) => { const key = `${sameKey(perk.name)}|${sameKey(perk.description)}|${sameKey(perk.label)}`; if (!perk.name || seen.has(key)) return false; seen.add(key); return true; }); }
function equivalentList(a,b){ return JSON.stringify(a || []) === JSON.stringify(b || []); }
function fallbackIcon(value){ return !value || String(value).includes('undefined') || String(value).trim() === ''; }
function sameKey(value){ return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function requestIdleCallbackSafe(fn){ if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1200 }); else setTimeout(fn, 50); }
function persistEnhancedRows(rows){ clearTimeout(persistTimer); persistTimer = setTimeout(() => saveBungieInventory(rows, 'ingame-enhanced-metadata').catch((error) => console.warn('D2AA enhanced metadata cache failed', error)), 1200); }
function readEnhancementCache(){ try { return JSON.parse(localStorage.getItem(ENHANCEMENT_CACHE_KEY) || '{}'); } catch { return {}; } }
function writeEnhancementCache(){ try { localStorage.setItem(ENHANCEMENT_CACHE_KEY, JSON.stringify(enhancementCache)); } catch (error) { console.warn('D2AA enhancement metadata cache skipped', error); } }

subscribe(scheduleEnhance);
scheduleEnhance();
