(() => {
  const API_ROOT = 'https://www.bungie.net/Platform';
  const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';
  const PUBLIC_CONFIG = { apiKey: '96e154014bdd44c0a537e482709b7473', clientId: '50794', redirectUri: 'https://erebusares.github.io/D2AA/beta2.html' };
  const STORAGE = { config: 'd2aa_bungie_public_config_v1', token: 'd2aa_bungie_token_v1' };
  const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305].join(',');
  const VAULT_BUCKET_HASH = 138197802;
  const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
  const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
  const ARMOR_STAT_KEYS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const BASE_HASH_TO_COLUMN = {
    392767087: 'Health (Base)',      // Resilience / Health
    4244567218: 'Melee (Base)',     // Strength / Melee
    1735777505: 'Grenade (Base)',   // Discipline / Grenade
    144602215: 'Super (Base)',      // Intellect / Super
    2996146975: 'Class (Base)',     // Mobility / Class
    1943323491: 'Weapons (Base)'    // Recovery / Weapons
  };
  const DEF_CACHE = new Map();
  const STAT_CACHE = new Map();

  const $ = (id) => document.getElementById(id);
  const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const readJson = (key, fallback = {}) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const cleanConfig = (config) => Object.fromEntries(Object.entries(config || {}).filter(([, value]) => String(value || '').trim()));
  const getConfig = () => ({ ...PUBLIC_CONFIG, ...cleanConfig(readJson(STORAGE.config)) });
  const getToken = () => readJson(STORAGE.token);
  const tokenIsValid = (token = getToken()) => Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60);
  const localTagFor = (id) => window.D2AA?.getTags?.()?.[String(id || '').trim()] || '';
  const toUint32 = (hash) => Number(hash) >>> 0;
  const toSigned32 = (hash) => { const n = Number(hash) >>> 0; return n > 2147483647 ? n - 4294967296 : n; };

  const HASH_TO_COLUMN = { ...BASE_HASH_TO_COLUMN };
  for (const [hash, col] of Object.entries(BASE_HASH_TO_COLUMN)) HASH_TO_COLUMN[toSigned32(hash)] = col;

  function setStatus(message, ready = false) {
    const el = $('bungieStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('is-ready', ready);
    el.classList.toggle('is-missing', !ready);
  }

  function saveToken(token) {
    const now = Math.floor(Date.now() / 1000);
    const saved = { ...token, saved_at: now, expires_at: token.expires_in ? now + Number(token.expires_in) : token.expires_at, refresh_expires_at: token.refresh_expires_in ? now + Number(token.refresh_expires_in) : token.refresh_expires_at };
    writeJson(STORAGE.token, saved);
    return saved;
  }

  async function refreshToken() {
    const cfg = getConfig();
    const token = getToken();
    if (!token.refresh_token) throw new Error('No refresh token found. Connect your Destiny account again.');
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', token.refresh_token);
    body.set('client_id', cfg.clientId);
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error_description || json.Message || `OAuth refresh failed (${res.status}).`);
    return saveToken(json);
  }

  async function bungieFetch(path, auth = false, options = {}) {
    const cfg = getConfig();
    const headers = { 'X-API-Key': cfg.apiKey, ...(options.headers || {}) };
    if (auth) {
      let token = getToken();
      if (!tokenIsValid(token)) token = await refreshToken();
      headers.Authorization = `Bearer ${token.access_token}`;
    }
    const res = await fetch(`${API_ROOT}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.ErrorCode && json.ErrorCode !== 1)) throw new Error(json.Message || `Bungie request failed (${res.status}).`);
    return json.Response;
  }

  async function getMembership() {
    const data = await bungieFetch('/User/GetMembershipsForCurrentUser/', true);
    const memberships = data.destinyMemberships || [];
    const primary = memberships.find((m) => m.membershipId === data.primaryMembershipId) || memberships[0];
    if (!primary) throw new Error('No Destiny membership found for this Bungie account.');
    return primary;
  }

  async function getDef(type, hash) {
    if (!hash) return null;
    const unsignedHash = toUint32(hash);
    const key = `${type}:${unsignedHash}`;
    if (DEF_CACHE.has(key)) return DEF_CACHE.get(key);
    const def = await bungieFetch(`/Destiny2/Manifest/${type}/${unsignedHash}/`, false);
    DEF_CACHE.set(key, def);
    return def;
  }

  async function mapLimit(items, limit, worker, progress) {
    const out = new Array(items.length);
    let index = 0;
    let done = 0;
    async function run() {
      while (index < items.length) {
        const current = index++;
        try { out[current] = await worker(items[current], current); }
        catch (error) { console.warn('D2AA Bungie lookup failed', items[current], error); out[current] = null; }
        done++;
        if (progress && (done % 10 === 0 || done === items.length)) progress(done, items.length);
        if (done % 25 === 0) await sleep(0);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return out;
  }

  function collectItems(profile) {
    const out = [];
    if (profile.profileInventory?.data?.items) out.push(...profile.profileInventory.data.items.map((item) => ({ ...item, d2aaOwner: 'vault' })));
    for (const [characterId, container] of Object.entries(profile.characterInventories?.data || {})) {
      if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId })));
    }
    for (const [characterId, container] of Object.entries(profile.characterEquipment?.data || {})) {
      if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId, d2aaEquipped: true })));
    }
    return out;
  }

  function emptyArmorStats() { return Object.fromEntries(ARMOR_STAT_KEYS.map((key) => [key, 0])); }
  function getStatNumericValue(stat) { return Number(stat?.value ?? stat?.statValue ?? stat?.base ?? stat?.minimum ?? 0); }
  function normalizeName(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' '); }

  function columnFromStatName(name) {
    const n = normalizeName(name);
    if (!n) return null;
    if (n.includes('health') || n.includes('resilience')) return 'Health (Base)';
    if (n.includes('melee') || n.includes('strength')) return 'Melee (Base)';
    if (n.includes('grenade') || n.includes('discipline')) return 'Grenade (Base)';
    if (n.includes('super') || n.includes('intellect')) return 'Super (Base)';
    if (n.includes('class') || n.includes('mobility')) return 'Class (Base)';
    if (n.includes('weapon') || n.includes('recovery')) return 'Weapons (Base)';
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

  async function buildStatColumnMap(allHashes) {
    const hashes = [...new Set(allHashes.map(toUint32).filter(Boolean))];
    const map = { ...HASH_TO_COLUMN };
    const unknown = hashes.filter((h) => !map[h] && !map[toSigned32(h)]);
    if (unknown.length) {
      setStatus(`Resolving stat definitions: 0/${unknown.length}`, false);
      await mapLimit(unknown, 8, async (hash) => {
        const col = await resolveStatColumn(hash);
        if (col) { map[hash] = col; map[toSigned32(hash)] = col; }
        return col;
      }, (done, total) => setStatus(`Resolving stat definitions: ${done}/${total}`, false));
    }
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

  function socketBonusTotals(plugDefs, statColumnMap) {
    const bonuses = emptyArmorStats();
    for (const plugDef of plugDefs || []) {
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

    rowStats['Total (Current)'] = ARMOR_STAT_KEYS.reduce((sum, key) => sum + Number(currentStats[key] || 0), 0);
    rowStats['Total (Base)'] = ARMOR_STAT_KEYS.reduce((sum, key) => sum + Number(rowStats[key] || 0), 0);
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
  function armorTier(total) { const n = Number(total || 0); return n >= 75 ? 5 : n >= 74 ? 4 : n >= 73 ? 3 : n >= 72 ? 2 : 1; }

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

  async function importArmorV2() {
    const startedAt = performance.now();
    if (!tokenIsValid()) { setStatus('Connect your Destiny account before syncing armor.', false); return; }

    setStatus('Fetching Bungie profile...', false);
    const membership = await getMembership();
    const profile = await bungieFetch(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
    const allItems = collectItems(profile);
    const statComponents = profile.itemComponents?.stats?.data || {};
    const socketComponents = profile.itemComponents?.sockets?.data || {};
    const characterMap = buildCharacterMap(profile);

    const uniqueItemHashes = [...new Set(allItems.map((item) => toUint32(item.itemHash)).filter(Boolean))];
    setStatus(`Resolving item definitions: 0/${uniqueItemHashes.length}`, false);
    const itemDefsList = await mapLimit(uniqueItemHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => setStatus(`Resolving item definitions: ${done}/${total}`, false));
    const itemDefs = Object.fromEntries(uniqueItemHashes.map((hash, i) => [hash, itemDefsList[i]]));

    const armorItems = allItems.filter((item) => item.itemInstanceId && isArmorDef(itemDefs[toUint32(item.itemHash)]));
    const uniquePlugHashes = [...new Set(armorItems.flatMap((item) => plugHashesForInstance(socketComponents[item.itemInstanceId])).filter(Boolean))];
    setStatus(`Resolving socket bonuses: 0/${uniquePlugHashes.length}`, false);
    const plugDefsList = await mapLimit(uniquePlugHashes, 8, (hash) => getDef('DestinyInventoryItemDefinition', hash), (done, total) => setStatus(`Resolving socket bonuses: ${done}/${total}`, false));
    const plugDefs = Object.fromEntries(uniquePlugHashes.map((hash, i) => [hash, plugDefsList[i]]));

    const statHashes = [];
    for (const item of armorItems) {
      const def = itemDefs[toUint32(item.itemHash)];
      const source = Object.keys(statComponents[item.itemInstanceId]?.stats || {}).length ? statComponents[item.itemInstanceId].stats : (def.stats?.stats || {});
      statHashes.push(...Object.keys(source));
      for (const plugHash of plugHashesForInstance(socketComponents[item.itemInstanceId])) {
        const plugDef = plugDefs[plugHash];
        for (const stat of plugDef?.investmentStats || []) statHashes.push(stat.statTypeHash);
      }
    }
    const statColumnMap = await buildStatColumnMap(statHashes);

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
      rows.push({
        Name: def.displayProperties?.name || 'Unknown Armor', Id: instanceId, Type: type, Rarity: rarity, Equippable: equippable, Tag: localTagFor(instanceId), Tier: armorTier(statRow['Total (Base)']), ...statRow,
        Source: 'Bungie', ItemHash: item.itemHash, BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0, MembershipType: membership.membershipType,
        OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner, TargetCharacterId: targetCharacterId,
        IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault', IsEquipped: Boolean(item.d2aaEquipped)
      });
      if (scanned % 100 === 0) { setStatus(`Building base-stat rows: ${scanned}/${allItems.length} scanned, ${rows.length} armor found`, false); await sleep(0); }
    }

    const zeroRows = rows.filter((row) => Number(row['Total (Base)'] || 0) === 0).length;
    setStatus(`Rendering ${rows.length} armor items...`, false);
    await sleep(0);
    window.D2AA?.loadRows?.(rows, `Bungie sync • ${rows.length} armor items`);
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    setStatus(`Bungie sync complete: ${rows.length} armor items in ${seconds}s. Zero-stat rows: ${zeroRows}.`, zeroRows === 0);
  }

  const btn = $('bungieImportV2Btn');
  if (btn) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      importArmorV2().catch((error) => { console.error(error); setStatus(error.message || String(error), false); });
    }, true);
  }
})();
