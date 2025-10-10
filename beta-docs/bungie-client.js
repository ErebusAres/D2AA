import { BUNGIE_PLATFORM_URL, getBungieHeaders } from './config.js';
import { guardArray, guardObject, invariant, toMap } from './utils.js';
import { updateBungieState } from './state.js';

async function bungieFetch(path, accessToken, options = {}) {
  const url = path.startsWith('http') ? path : `${BUNGIE_PLATFORM_URL}${path}`;
  const headers = getBungieHeaders(accessToken);
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bungie request failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (data?.ErrorStatus !== 'Success') {
    throw new Error(`Bungie request error: ${data?.ErrorStatus ?? 'Unknown'}`);
  }
  return data.Response;
}

function pickDestinyMembership(memberships) {
  const destinyMemberships = guardArray(memberships?.destinyMemberships);
  if (!destinyMemberships.length) return null;
  const active = destinyMemberships.find((m) => m.membershipId === memberships?.primaryMembershipId);
  return active ?? destinyMemberships[0];
}

export async function loadCurrentProfile(auth, store) {
  invariant(auth, 'Bungie auth is required');
  const accessToken = await auth.getAccessToken();
  if (!accessToken) throw new Error('Bungie access token unavailable');

  updateBungieState(store, { status: 'loading' });
  const membershipResponse = await bungieFetch('/User/GetMembershipsForCurrentUser/', accessToken);
  const membership = pickDestinyMembership(membershipResponse);
  if (!membership) {
    throw new Error('No Destiny memberships found for this account');
  }

  updateBungieState(store, {
    membershipId: membership.membershipId,
    membershipType: membership.membershipType,
  });

  const componentParams = new URLSearchParams({
    components: [
      'Profiles',
      'Characters',
      'CharacterEquipment',
      'CharacterInventories',
      'ProfileInventories',
      'ItemComponents',
      'ItemInstances',
      'ItemStats',
      'ItemObjectives',
      'ItemSockets',
      'ItemPlugStates',
      'CharacterLoadouts',
    ].join(','),
  });
  const profilePath = `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?${componentParams.toString()}`;
  const profileResponse = await bungieFetch(profilePath, accessToken);

  const profileInventory = guardObject(profileResponse?.profileInventory?.data);
  const characterInventories = guardObject(profileResponse?.characterInventories?.data);
  const characterEquipment = guardObject(profileResponse?.characterEquipment?.data);
  const characters = guardObject(profileResponse?.characters?.data);
  const itemInstances = guardObject(profileResponse?.itemComponents?.instances?.data);
  const itemStats = guardObject(profileResponse?.itemComponents?.stats?.data);
  const itemSockets = guardObject(profileResponse?.itemComponents?.sockets?.data);
  const itemPlugStates = guardObject(profileResponse?.itemComponents?.plugStates?.data);

  const inventoryItems = [];
  const pushItems = (bucket) => {
    for (const item of guardArray(bucket)) {
      inventoryItems.push(item);
    }
  };

  for (const item of guardArray(profileInventory?.items)) pushItems([item]);
  for (const [characterId, inv] of Object.entries(characterInventories)) {
    pushItems(inv?.items);
  }
  for (const [characterId, equip] of Object.entries(characterEquipment)) {
    pushItems(equip?.items);
  }

  const itemsByInstanceId = toMap(inventoryItems, 'itemInstanceId');
  for (const [instanceId, instance] of Object.entries(itemInstances)) {
    const existing = itemsByInstanceId.get(instanceId);
    if (existing) {
      existing.instance = instance;
    }
  }
  for (const [instanceId, stats] of Object.entries(itemStats)) {
    const existing = itemsByInstanceId.get(instanceId);
    if (existing) {
      existing.stats = stats.stats ?? stats;
    }
  }
  for (const [instanceId, sockets] of Object.entries(itemSockets)) {
    const existing = itemsByInstanceId.get(instanceId);
    if (existing) {
      existing.sockets = sockets;
    }
  }
  for (const [instanceId, plugState] of Object.entries(itemPlugStates)) {
    const existing = itemsByInstanceId.get(instanceId);
    if (existing) {
      existing.plugStates = plugState;
    }
  }

  const rows = Array.from(itemsByInstanceId.values());
  updateBungieState(store, {
    status: 'ready',
    profile: profileResponse,
    rawItems: rows,
    characters,
  });
  return {
    membership,
    profile: profileResponse,
    items: rows,
    characters,
  };
}

const ITEM_LOCATION_POSTMASTER = 4;
const POSTMASTER_BUCKET_HASHES = new Set([
  215593132, // Lost Items
  375726501, // Engrams
  4292445962, // Messages
]);

function resolveState(store) {
  if (!store) return null;
  if (typeof store.getState === 'function') {
    return store.getState();
  }
  return store;
}

function getAccessTokenFromState(state) {
  const tokens = state?.bungie?.tokens;
  if (!tokens) return null;
  return tokens.accessToken ?? tokens.access_token ?? null;
}

function getMembershipTypeFromState(state) {
  return (
    state?.bungie?.membershipType ??
    state?.bungie?.tokens?.membership_type ??
    state?.bungie?.tokens?.membershipType ??
    null
  );
}

function getMembershipIdFromState(state) {
  return (
    state?.bungie?.membershipId ??
    state?.bungie?.tokens?.membership_id ??
    state?.bungie?.tokens?.membershipId ??
    null
  );
}

function getPreferredCharacterId(state) {
  const characters = state?.bungie?.characters;
  if (!characters || typeof characters !== 'object') return null;
  const entries = Object.entries(characters);
  if (!entries.length) return null;
  entries.sort((a, b) => {
    const aDate = Date.parse(a[1]?.dateLastPlayed ?? '') || 0;
    const bDate = Date.parse(b[1]?.dateLastPlayed ?? '') || 0;
    return bDate - aDate;
  });
  return entries[0]?.[0] ?? null;
}

async function postItemAction(path, accessToken, payload) {
  const url = `${BUNGIE_PLATFORM_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getBungieHeaders(accessToken),
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    console.warn('Failed to parse Bungie action response', error);
  }

  if (!res.ok) {
    const error = new Error(`Bungie request failed: ${res.status}`);
    error.status = res.status;
    error.data = data ?? text;
    throw error;
  }

  const errorCode = data?.ErrorCode;
  if (errorCode !== 1) {
    const error = new Error(data?.Message ?? data?.ErrorStatus ?? 'Bungie action failed');
    error.code = errorCode;
    error.status = data?.ErrorStatus;
    error.data = data;
    throw error;
  }

  return data?.Response ?? null;
}

function buildTransferPayload(item, membershipType, characterId) {
  const instanceId = item?.itemInstanceId ?? item?.rawItem?.itemInstanceId ?? item?.id;
  const itemHash = item?.itemHash ?? item?.rawItem?.itemHash;
  const quantity = item?.rawItem?.quantity ?? 1;
  const membership = Number(membershipType);
  if (!instanceId) {
    throw new Error('Item instance id unavailable for transfer');
  }
  if (!itemHash) {
    throw new Error('Item reference hash unavailable for transfer');
  }
  if (!Number.isFinite(membership)) {
    throw new Error('Invalid membership type for transfer');
  }
  return {
    characterId: String(characterId),
    membershipType: membership,
    itemId: String(instanceId),
    itemReferenceHash: Number(itemHash),
    stackSize: Number(quantity) || 1,
    transferToVault: false,
  };
}

function isPostmasterItem(item) {
  const location = item?.rawItem?.location ?? item?.location;
  if (location === ITEM_LOCATION_POSTMASTER) return true;
  const bucket = item?.rawItem?.bucketHash ?? item?.bucketHash;
  if (!bucket) return false;
  return POSTMASTER_BUCKET_HASHES.has(Number(bucket));
}

export async function pullItemToCharacter(store, item, options = {}) {
  invariant(store, 'State store is required for pulling items');
  invariant(item, 'Item is required for pulling');

  const state = resolveState(store);
  const accessToken = getAccessTokenFromState(state);
  if (!accessToken) {
    throw new Error('Bungie access token unavailable');
  }
  const membershipType = options.membershipType ?? getMembershipTypeFromState(state);
  if (membershipType === null || membershipType === undefined) {
    throw new Error('Bungie membership type unavailable');
  }
  const characterId = options.characterId ?? options.targetCharacterId ?? getPreferredCharacterId(state);
  if (!characterId) {
    throw new Error('No character available for transfer');
  }

  const payload = buildTransferPayload(item, membershipType, characterId);

  if (isPostmasterItem(item)) {
    const membershipId = options.membershipId ?? getMembershipIdFromState(state);
    if (!membershipId) {
      throw new Error('Bungie membership id unavailable for postmaster pull');
    }
    const postmasterPayload = {
      ...payload,
      ownerId: String(membershipId),
    };
    await postItemAction('/Destiny2/Actions/Items/PullFromPostmaster/', accessToken, postmasterPayload);
    return { type: 'postmaster', characterId: String(characterId) };
  }

  const currentOwner = item?.rawItem?.characterId ?? item?.characterId ?? null;
  if (currentOwner && String(currentOwner) === String(characterId)) {
    return { type: 'noop', reason: 'already_on_character', characterId: String(characterId) };
  }

  await postItemAction('/Destiny2/Actions/Items/TransferItem/', accessToken, payload);
  return { type: 'transfer', characterId: String(characterId) };
}
