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
