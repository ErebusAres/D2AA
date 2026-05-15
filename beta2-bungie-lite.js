(() => {
  const API_ROOT = 'https://www.bungie.net/Platform';
  const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';
  const PUBLIC_CONFIG = {
    apiKey: '96e154014bdd44c0a537e482709b7473',
    clientId: '50794',
    redirectUri: 'https://erebusares.github.io/D2AA/beta2.html'
  };
  const STORAGE = {
    config: 'd2aa_bungie_public_config_v1',
    token: 'd2aa_bungie_token_v1'
  };
  const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304].join(',');
  const VAULT_BUCKET_HASH = 138197802;
  const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
  const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
  const ARMOR_STAT_HASH_TO_COLUMN = {
    392767087: 'Health (Base)',
    4244567218: 'Melee (Base)',
    1735777505: 'Grenade (Base)',
    144602215: 'Super (Base)',
    1943323491: 'Class (Base)',
    2996146975: 'Weapons (Base)'
  };
  const ARMOR_STAT_KEYS = ['Health (Base)', 'Melee (Base)', 'Grenade (Base)', 'Super (Base)', 'Class (Base)', 'Weapons (Base)'];
  const DEF_MEMORY = new Map();

  const $ = (id) => document.getElementById(id);
  const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const readJson = (key, fallback = {}) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const cleanConfig = (config) => Object.fromEntries(Object.entries(config || {}).filter(([, value]) => String(value || '').trim()));
  const getConfig = () => ({ ...PUBLIC_CONFIG, ...cleanConfig(readJson(STORAGE.config)) });
  const getToken = () => readJson(STORAGE.token);
  const tokenIsValid = (token = getToken()) => Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60);
  const localTagFor = (id) => window.D2AA?.getTags?.()?.[String(id || '').trim()] || '';

  function setStatus(message, ready = false) {
    const status = $('bungieStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-ready', ready);
    status.classList.toggle('is-missing', !ready);
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

  async function getItemDef(hash) {
    if (DEF_MEMORY.has(hash)) return DEF_MEMORY.get(hash);
    const def = await bungieFetch(`/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`, false);
    DEF_MEMORY.set(hash, def);
    return def;
  }

  async function mapLimit(items, limit, worker, progress) {
    const output = new Array(items.length);
    let index = 0;
    let done = 0;
    async function run() {
      while (index < items.length) {
        const current = index++;
        try {
          output[current] = await worker(items[current], current);
        } catch (error) {
          console.warn('D2AA definition failed', items[current], error);
          output[current] = null;
        }
        done++;
        if (progress && (done % 10 === 0 || done === items.length)) progress(done, items.length);
        if (done % 25 === 0) await sleep(0);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return output;
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
  function statValue(stat) { return Number(stat?.base ?? stat?.statValue ?? stat?.value ?? stat?.minimum ?? 0); }
  function statsForItem(def, statComponent) {
    const source = Object.keys(statComponent?.stats || {}).length ? statComponent.stats : (def.stats?.stats || {});
    const rowStats = emptyArmorStats();
    for (const [hash, stat] of Object.entries(source)) {
      const column = ARMOR_STAT_HASH_TO_COLUMN[Number(hash)];
      if (column) rowStats[column] = statValue(stat);
    }
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

  function rarityForItem(def) {
    return def.inventory?.tierTypeName || (String(def.itemTypeAndTierDisplayName || '').match(/^(Common|Uncommon|Rare|Legendary|Exotic)/)?.[1]) || 'Unknown';
  }

  function armorTier(total) {
    const n = Number(total || 0);
    if (n >= 75) return 5;
    if (n >= 74) return 4;
    if (n >= 73) return 3;
    if (n >= 72) return 2;
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

  async function importArmorLite() {
    const startedAt = performance.now();
    if (!tokenIsValid()) {
      setStatus('Connect your Destiny account before syncing armor.', false);
      return;
    }

    setStatus('Fetching Bungie profile...', false);
    const membership = await getMembership();
    const profile = await bungieFetch(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
    const allItems = collectItems(profile);
    const statComponents = profile.itemComponents?.stats?.data || {};
    const characterMap = buildCharacterMap(profile);

    const uniqueHashes = [...new Set(allItems.map((item) => item.itemHash).filter(Boolean))];
    setStatus(`Resolving item definitions: 0/${uniqueHashes.length}`, false);
    const defsList = await mapLimit(uniqueHashes, 8, getItemDef, (done, total) => setStatus(`Resolving item definitions: ${done}/${total}`, false));
    const itemDefs = Object.fromEntries(uniqueHashes.map((hash, i) => [hash, defsList[i]]));

    const seen = new Set();
    const rows = [];
    let scanned = 0;
    for (const item of allItems) {
      const instanceId = item.itemInstanceId;
      if (!instanceId || seen.has(instanceId)) continue;
      seen.add(instanceId);
      scanned++;
      const def = itemDefs[item.itemHash];
      if (!isArmorDef(def)) continue;
      const slot = slotForItem(def);
      const equippable = CLASS_TYPE[def.classType];
      const rarity = rarityForItem(def);
      const type = slot === 'Class Item' ? CLASS_ITEM_BY_CLASS[equippable] : slot;
      const statRow = statsForItem(def, statComponents[instanceId]);
      const targetCharacterId = characterMap[equippable]?.characterId || '';
      rows.push({
        Name: def.displayProperties?.name || 'Unknown Armor',
        Id: instanceId,
        Type: type,
        Rarity: rarity,
        Equippable: equippable,
        Tag: localTagFor(instanceId),
        Tier: armorTier(statRow['Total (Base)']),
        ...statRow,
        Source: 'Bungie',
        ItemHash: item.itemHash,
        BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0,
        MembershipType: membership.membershipType,
        OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner,
        TargetCharacterId: targetCharacterId,
        IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault',
        IsEquipped: Boolean(item.d2aaEquipped)
      });
      if (scanned % 100 === 0) {
        setStatus(`Building rows: ${scanned}/${allItems.length} scanned, ${rows.length} armor found`, false);
        await sleep(0);
      }
    }

    setStatus(`Rendering ${rows.length} armor items...`, false);
    await sleep(0);
    window.D2AA?.loadRows?.(rows, `Bungie sync • ${rows.length} armor items`);
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    setStatus(`Bungie sync complete: ${rows.length} armor items in ${seconds}s.`, true);
  }

  const btn = $('bungieImportBtn');
  if (btn) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      importArmorLite().catch((error) => {
        console.error(error);
        setStatus(error.message || String(error), false);
      });
    }, true);
  }
})();
