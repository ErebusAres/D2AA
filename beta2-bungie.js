(() => {
  const API_ROOT = 'https://www.bungie.net/Platform';
  const AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
  const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';
  const PUBLIC_CONFIG = {
    apiKey: '96e154014bdd44c0a537e482709b7473',
    clientId: '50794',
    redirectUri: 'https://erebusares.github.io/D2AA/beta2.html'
  };
  const STORAGE = {
    config: 'd2aa_bungie_public_config_v1',
    token: 'd2aa_bungie_token_v1',
    state: 'd2aa_bungie_oauth_state_v1',
    manifest: 'd2aa_bungie_manifest_v1',
    defs: 'd2aa_bungie_defs_v1'
  };

  localStorage.removeItem(STORAGE.defs);
  const DEF_MEMORY = {};
  let LAST_CONTEXT = null;

  const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 304, 305].join(',');
  const VAULT_BUCKET_HASH = 138197802;
  const CLASS_TYPE = { 0: 'Titan', 1: 'Hunter', 2: 'Warlock' };
  const CLASS_ITEM_BY_CLASS = { Warlock: 'Warlock Bond', Hunter: 'Hunter Cloak', Titan: 'Titan Mark' };
  const SLOT_BY_BUCKET_NAME = { Helmet: 'Helmet', Gauntlets: 'Gauntlets', 'Chest Armor': 'Chest Armor', 'Leg Armor': 'Leg Armor', 'Class Armor': 'Class Item', 'Class Item': 'Class Item' };
  const STAT_NAME_MAP = { health: 'Health (Base)', melee: 'Melee (Base)', grenade: 'Grenade (Base)', super: 'Super (Base)', class: 'Class (Base)', weapons: 'Weapons (Base)' };

  const $ = (id) => document.getElementById(id);

  function readJson(key, fallback = {}) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function cleanConfig(config) { return Object.fromEntries(Object.entries(config || {}).filter(([, value]) => String(value || '').trim())); }
  function getConfig() { return { ...PUBLIC_CONFIG, ...cleanConfig(readJson(STORAGE.config)) }; }
  function getToken() { return readJson(STORAGE.token); }

  function saveToken(token) {
    const now = Math.floor(Date.now() / 1000);
    const saved = { ...token, saved_at: now, expires_at: token.expires_in ? now + Number(token.expires_in) : token.expires_at, refresh_expires_at: token.refresh_expires_in ? now + Number(token.refresh_expires_in) : token.refresh_expires_at };
    writeJson(STORAGE.token, saved);
    return saved;
  }

  function tokenIsValid(token = getToken()) { return Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60); }
  function setStatus(message, ready = false) { const status = $('bungieStatus'); if (!status) return; status.textContent = message; status.classList.toggle('is-ready', ready); status.classList.toggle('is-missing', !ready); }

  function refreshStatus() {
    const cfg = getConfig();
    const token = getToken();
    if (!cfg.apiKey || !cfg.clientId || !cfg.redirectUri) setStatus('Bungie API setup needed: API key, OAuth Client ID, and Redirect URL.', false);
    else if (!tokenIsValid(token)) setStatus('Ready to connect your Destiny account through Bungie / Steam.', false);
    else setStatus('Destiny account connected. Sync armor when ready.', true);
  }

  function setupConfig() {
    const current = getConfig();
    const apiKey = prompt('Optional dev override: Bungie API Key. Leave as-is to use the embedded public app key.', current.apiKey || ''); if (apiKey === null) return;
    const clientId = prompt('Optional dev override: Bungie OAuth Client ID. Leave as-is to use the embedded public Client ID.', current.clientId || ''); if (clientId === null) return;
    const redirectUri = prompt('Optional dev override: Redirect URL registered in Bungie.net application settings.', current.redirectUri || `${location.origin}${location.pathname}`); if (redirectUri === null) return;
    writeJson(STORAGE.config, { apiKey: apiKey.trim(), clientId: clientId.trim(), redirectUri: redirectUri.trim() });
    refreshStatus();
  }

  function randomState() { const values = new Uint32Array(4); crypto.getRandomValues(values); return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join(''); }

  function login() {
    const cfg = getConfig();
    if (!cfg.apiKey || !cfg.clientId || !cfg.redirectUri) { setupConfig(); return; }
    const state = randomState();
    localStorage.setItem(STORAGE.state, state);
    const url = new URL(AUTH_URL);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  async function exchangeCode(code) {
    const cfg = getConfig();
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('client_id', cfg.clientId);
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error_description || json.Message || `OAuth token exchange failed (${res.status}).`);
    saveToken(json);
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

  async function handleOAuthRedirect() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) return;
    const returnedState = url.searchParams.get('state');
    const expectedState = localStorage.getItem(STORAGE.state);
    if (expectedState && returnedState !== expectedState) { setStatus('Bungie sign-in failed: OAuth state mismatch.', false); return; }
    try {
      setStatus('Completing Bungie sign-in...', false);
      await exchangeCode(code);
      localStorage.removeItem(STORAGE.state);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      history.replaceState({}, document.title, url.toString());
      refreshStatus();
    } catch (error) { console.error(error); setStatus(error.message, false); }
  }

  async function bungieFetch(path, auth = false, options = {}) {
    const cfg = getConfig();
    if (!cfg.apiKey) throw new Error('Missing Bungie API key.');
    const headers = { 'X-API-Key': cfg.apiKey, ...(options.headers || {}) };
    if (auth) { let token = getToken(); if (!tokenIsValid(token)) token = await refreshToken(); headers.Authorization = `Bearer ${token.access_token}`; }
    const res = await fetch(`${API_ROOT}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json.ErrorCode && json.ErrorCode !== 1)) throw new Error(json.Message || `Bungie request failed (${res.status}).`);
    return json.Response;
  }

  async function bungiePost(path, body) {
    return bungieFetch(path, true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async function getMembership() {
    const data = await bungieFetch('/User/GetMembershipsForCurrentUser/', true);
    const memberships = data.destinyMemberships || [];
    const primary = memberships.find((m) => m.membershipId === data.primaryMembershipId) || memberships[0];
    if (!primary) throw new Error('No Destiny membership found for this Bungie account.');
    return primary;
  }

  async function getManifest() { const cached = readJson(STORAGE.manifest, null); if (cached?.jsonWorldComponentContentPaths?.en) return cached; const manifest = await bungieFetch('/Destiny2/Manifest/'); writeJson(STORAGE.manifest, manifest); return manifest; }

  async function getDefinitionTable(tableName) {
    if (DEF_MEMORY[tableName]) return DEF_MEMORY[tableName];
    const manifest = await getManifest();
    const path = manifest.jsonWorldComponentContentPaths?.en?.[tableName];
    if (!path) throw new Error(`Manifest table missing: ${tableName}.`);
    const res = await fetch(`https://www.bungie.net${path}`, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Manifest download failed: ${tableName} (${res.status}).`);
    const table = await res.json();
    DEF_MEMORY[tableName] = table;
    return table;
  }

  async function getDefinitions() {
    const [items, buckets, tiers, stats] = await Promise.all([
      getDefinitionTable('DestinyInventoryItemDefinition'),
      getDefinitionTable('DestinyInventoryBucketDefinition'),
      getDefinitionTable('DestinyItemTierTypeDefinition'),
      getDefinitionTable('DestinyStatDefinition')
    ]);
    return { items, buckets, tiers, stats };
  }

  function collectItems(profile) {
    const out = [];
    if (profile.profileInventory?.data?.items) out.push(...profile.profileInventory.data.items.map((item) => ({ ...item, d2aaOwner: 'vault' })));
    for (const [characterId, container] of Object.entries(profile.characterInventories?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId })));
    for (const [characterId, container] of Object.entries(profile.characterEquipment?.data || {})) if (container.items) out.push(...container.items.map((item) => ({ ...item, d2aaOwner: characterId, d2aaEquipped: true })));
    return out;
  }

  function statColumnForHash(hash, statDefs) { const name = statDefs?.[hash]?.displayProperties?.name || ''; return STAT_NAME_MAP[name.trim().toLowerCase()] || null; }
  function slotForItem(def, bucketDefs) { const bucketName = bucketDefs?.[def.inventory?.bucketTypeHash]?.displayProperties?.name || ''; return SLOT_BY_BUCKET_NAME[bucketName] || SLOT_BY_BUCKET_NAME[def.itemTypeDisplayName] || null; }
  function rarityForItem(def, tierDefs) { return tierDefs?.[def.inventory?.tierTypeHash]?.displayProperties?.name || def.inventory?.tierTypeName || 'Unknown'; }

  function statsForItem(item, def, statComponent, statDefs) {
    const source = statComponent?.stats || def.stats?.stats || {};
    const rowStats = { 'Health (Base)': 0, 'Melee (Base)': 0, 'Grenade (Base)': 0, 'Super (Base)': 0, 'Class (Base)': 0, 'Weapons (Base)': 0 };
    for (const [hash, stat] of Object.entries(source)) {
      const column = statColumnForHash(hash, statDefs);
      if (!column) continue;
      rowStats[column] = Number(stat.base ?? stat.statValue ?? stat.value ?? 0);
    }
    rowStats['Total (Base)'] = Object.values(rowStats).reduce((sum, value) => sum + Number(value || 0), 0);
    return rowStats;
  }

  function armorTier(total) {
    const n = Number(total || 0);
    return Math.max(0, Math.floor(n / 10));
  }

  function buildCharacterMap(profile) {
    const map = {};
    for (const [characterId, character] of Object.entries(profile.characters?.data || {})) {
      const className = CLASS_TYPE[character.classType] || 'Unknown';
      map[className] = { characterId, className };
    }
    return map;
  }

  function normalizeArmor(profile, defs, membership) {
    const statComponents = profile.itemComponents?.stats?.data || {};
    const characterMap = buildCharacterMap(profile);
    const seen = new Set();
    const rows = [];
    for (const item of collectItems(profile)) {
      const instanceId = item.itemInstanceId;
      if (!instanceId || seen.has(instanceId)) continue;
      seen.add(instanceId);
      const def = defs.items[item.itemHash];
      if (!def || def.itemType !== 2) continue;
      const slot = slotForItem(def, defs.buckets);
      if (!slot) continue;
      const equippable = CLASS_TYPE[def.classType];
      if (!equippable) continue;
      const rarity = rarityForItem(def, defs.tiers);
      if (!['Common', 'Uncommon', 'Rare', 'Legendary', 'Exotic'].includes(rarity)) continue;
      const type = slot === 'Class Item' ? CLASS_ITEM_BY_CLASS[equippable] : slot;
      const statRow = statsForItem(item, def, statComponents[instanceId], defs.stats);
      const targetCharacterId = characterMap[equippable]?.characterId || '';
      rows.push({
        Name: def.displayProperties?.name || 'Unknown Armor', Id: instanceId, Type: type, Rarity: rarity, Equippable: equippable, Tag: '', Tier: armorTier(statRow['Total (Base)']), ...statRow,
        Source: 'Bungie', ItemHash: item.itemHash, BucketHash: def.inventory?.bucketTypeHash || item.bucketHash || 0, MembershipType: membership.membershipType, OwnerCharacterId: item.d2aaOwner === 'vault' ? '' : item.d2aaOwner, TargetCharacterId: targetCharacterId, IsInVault: item.location === 2 || item.bucketHash === VAULT_BUCKET_HASH || item.d2aaOwner === 'vault', IsEquipped: Boolean(item.d2aaEquipped)
      });
    }
    return rows;
  }

  async function importArmor() {
    try {
      if (!tokenIsValid()) { setStatus('Connect your Destiny account before syncing armor.', false); return; }
      setStatus('Fetching Bungie profile and manifest definitions...', false);
      const membership = await getMembership();
      const profilePromise = bungieFetch(`/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=${PROFILE_COMPONENTS}`, true);
      const defsPromise = getDefinitions();
      const [profile, defs] = await Promise.all([profilePromise, defsPromise]);
      const rows = normalizeArmor(profile, defs, membership);
      if (!rows.length) throw new Error('Bungie sync completed, but no armor items were found.');
      LAST_CONTEXT = { membership, profile, defs };
      window.D2AA?.loadRows?.(rows, `Bungie sync • ${rows.length} armor items`);
      setStatus(`Bungie sync complete: ${rows.length} armor items.`, true);
    } catch (error) { console.error(error); setStatus(error.message, false); }
  }

  async function pullItem(row) {
    if (!row || row.Source !== 'Bungie') throw new Error('This action requires a Bungie-synced item.');
    if (!row.TargetCharacterId) throw new Error(`No ${row.Equippable} character found to pull this item to.`);
    if (row.OwnerCharacterId === row.TargetCharacterId && !row.IsInVault) return 'Already on target character';
    if (!row.IsInVault && row.OwnerCharacterId && row.OwnerCharacterId !== row.TargetCharacterId) {
      await bungiePost('/Destiny2/Actions/Items/TransferItem/', { itemReferenceHash: Number(row.ItemHash), stackSize: 1, transferToVault: true, itemId: row.Id, characterId: row.OwnerCharacterId, membershipType: Number(row.MembershipType) });
    }
    await bungiePost('/Destiny2/Actions/Items/TransferItem/', { itemReferenceHash: Number(row.ItemHash), stackSize: 1, transferToVault: false, itemId: row.Id, characterId: row.TargetCharacterId, membershipType: Number(row.MembershipType) });
    return 'Pulled';
  }

  async function pullItems(rows) {
    const bungieRows = (rows || []).filter((row) => row?.Source === 'Bungie');
    if (!bungieRows.length) throw new Error('No Bungie-synced items selected.');
    let done = 0;
    for (const row of bungieRows) {
      setStatus(`Pulling ${++done}/${bungieRows.length}: ${row.Name}`, false);
      await pullItem(row);
    }
    setStatus(`Pulled ${bungieRows.length} item${bungieRows.length === 1 ? '' : 's'} to matching character inventory.`, true);
  }

  window.D2AA_BUNGIE = { pullItem, pullItems, importArmor, isConnected: () => tokenIsValid(), getLastContext: () => LAST_CONTEXT };

  $('bungieSetupBtn')?.addEventListener('click', setupConfig);
  $('bungieLoginBtn')?.addEventListener('click', login);
  $('bungieImportBtn')?.addEventListener('click', importArmor);
  refreshStatus();
  handleOAuthRedirect();
})();
