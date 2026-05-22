import { state, setState, subscribe } from '../src-clean/state.js';
import { getDef, bungieIconUrl, mapLimit, toUint32 } from '../src-clean/data/bungie-api.js';

const ARCHETYPE_NAMES = new Set(['paragon', 'grenadier', 'specialist', 'brawler', 'bulwark', 'gunner']);
const enhancedItems = new Set();
let running = false;
let queued = false;

function scheduleEnhance(){
  if (running) { queued = true; return; }
  requestIdleCallbackSafe(enhanceVisibleRows);
}

async function enhanceVisibleRows(){
  if (running || !state.rows?.length) return;
  running = true;
  queued = false;
  try {
    const candidates = state.rows.filter((row) => row.ItemHash && !enhancedItems.has(String(row.ItemHash))).slice(0, 80);
    if (!candidates.length) return;
    const byHash = new Map(candidates.map((row) => [String(toUint32(row.ItemHash)), row]));
    const enhancements = new Map();
    await mapLimit([...byHash.keys()], 4, async (hash) => {
      const def = await getDef('DestinyInventoryItemDefinition', hash).catch(() => null);
      const enhancement = await buildEnhancement(def, byHash.get(String(hash)));
      enhancedItems.add(String(hash));
      if (enhancement) enhancements.set(String(hash), enhancement);
    });
    if (!enhancements.size) return;
    let changed = false;
    const rows = state.rows.map((row) => {
      const info = enhancements.get(String(toUint32(row.ItemHash)));
      if (!info) return row;
      const next = { ...row };
      if (info.archetype?.name && (!next.Archetype || sameKey(next.Archetype) === sameKey('—'))) { next.Archetype = info.archetype.name; changed = true; }
      if (info.archetype?.icon && (!next.ArchetypeIcon || fallbackIcon(next.ArchetypeIcon))) { next.ArchetypeIcon = info.archetype.icon; changed = true; }
      if (info.archetype?.description && !next.ArchetypeDescription) { next.ArchetypeDescription = info.archetype.description; changed = true; }
      if (info.setBonuses?.length && !equivalentList(next.ArmorSetBonuses, info.setBonuses)) { next.ArmorSetBonuses = info.setBonuses; next.SetBonuses = info.setBonuses; changed = true; }
      if (String(next.Rarity || '').toLowerCase() === 'exotic' && info.exotic?.name && !sameKey(info.exotic.name).includes(sameKey(next.Name))) {
        if (sameKey(next.ExoticPerkName) !== sameKey(info.exotic.name)) { next.ExoticPerkName = info.exotic.name; next.ExoticPerkDescription = info.exotic.description || next.ExoticPerkDescription || ''; next.ExoticIcon = info.exotic.icon || next.ExoticIcon || ''; changed = true; }
      }
      return next;
    });
    if (changed) setState({ rows, status: state.status });
  } finally {
    running = false;
    if (queued) scheduleEnhance();
  }
}

async function buildEnhancement(def, row){
  if (!def) return null;
  const plugHashes = [...new Set([...
    directPlugHashes(def),
    ...await plugSetHashes(def)
  ].filter(Boolean).map(toUint32))];
  const plugDefs = (await mapLimit(plugHashes, 6, (hash) => getDef('DestinyInventoryItemDefinition', hash).catch(() => null))).filter(Boolean);
  const archetype = bestArchetype(plugDefs, row);
  const setBonuses = uniquePerks(plugDefs.filter((plug) => isSetBonus(plug, row)).map((plug) => perk(plug, setLabel(plug), 'set'))).slice(0, 4);
  const exotic = String(row?.Rarity || '').toLowerCase() === 'exotic' ? bestExotic(plugDefs, def, row) : null;
  return { archetype, setBonuses, exotic };
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

async function plugSetHashes(def){
  const setHashes = [];
  for (const entry of def?.sockets?.socketEntries || []) {
    if (entry.reusablePlugSetHash) setHashes.push(entry.reusablePlugSetHash);
    if (entry.randomizedPlugSetHash) setHashes.push(entry.randomizedPlugSetHash);
  }
  const plugSets = (await mapLimit([...new Set(setHashes.map(toUint32))], 4, (hash) => getDef('DestinyPlugSetDefinition', hash).catch(() => null))).filter(Boolean);
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
  const text = sameKey(`${plug.displayProperties?.name || ''} ${plug.displayProperties?.description || ''} ${plug.itemTypeDisplayName || ''} ${plug.plug?.plugCategoryIdentifier || ''}`);
  if (!text || text.includes('emptymodsocket') || text.includes('defaultornament')) return false;
  if (sameKey(plug.displayProperties?.name) === sameKey(row?.Name)) return false;
  return text.includes('armorsetbonus') || text.includes('setbonus') || text.includes('armorset') || text.includes('2piece') || text.includes('4piece') || text.includes('twopiece') || text.includes('fourpiece') || text.includes('wearing2') || text.includes('wearing4') || text.includes('smokejumper');
}
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
function setLabel(plug){ const text = sameKey(plug?.displayProperties?.description || plug?.displayProperties?.name || ''); if (text.includes('2piece') || text.includes('twopiece') || text.includes('wearing2')) return '2-Piece Set Bonus'; if (text.includes('4piece') || text.includes('fourpiece') || text.includes('wearing4')) return '4-Piece Set Bonus'; return 'Armor Set Bonus'; }
function uniquePerks(perks){ const seen = new Set(); return perks.filter((perk) => { const key = `${sameKey(perk.name)}|${sameKey(perk.description)}`; if (!perk.name || seen.has(key)) return false; seen.add(key); return true; }); }
function equivalentList(a,b){ return JSON.stringify(a || []) === JSON.stringify(b || []); }
function fallbackIcon(value){ return !value || String(value).includes('undefined') || String(value).trim() === ''; }
function sameKey(value){ return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function requestIdleCallbackSafe(fn){ if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 1200 }); else setTimeout(fn, 50); }

subscribe(scheduleEnhance);
scheduleEnhance();
