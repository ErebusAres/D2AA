import { CONFIG } from './config.js';

export const appDim = { accessToken: null, expires: 0 };

export async function initDimSync({
  apiKey = CONFIG.dim.apiKey,
  apiBase = CONFIG.dim.apiBase,
  accessToken,
  membershipId
}) {
  if (!apiKey) {
    return { ...appDim };
  }
  let res;
  try {
    res = await fetch(`${apiBase}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ bungieAccessToken: accessToken, membershipId })
    });
  } catch (err) {
    console.warn('Failed to reach DIM auth endpoint', err);
    appDim.accessToken = null;
    appDim.expires = 0;
    return { ...appDim };
  }
  if (!res.ok) {
    console.warn(`DIM auth failed ${res.status}`);
    appDim.accessToken = null;
    appDim.expires = 0;
    return { ...appDim };
  }
  try {
    const json = await res.json();
    appDim.accessToken = json?.accessToken || json?.dimAccessToken || json?.token || null;
    appDim.expires = Date.now() + 55 * 60 * 1000;
  } catch (err) {
    console.warn('DIM auth response was not valid JSON', err);
    appDim.accessToken = null;
    appDim.expires = 0;
  }
  return { ...appDim };
}

export async function fetchDimProfile({ apiKey = CONFIG.dim.apiKey, apiBase = CONFIG.dim.apiBase, membershipId }) {
  if (!appDim.accessToken) {
    return { tags: {}, loadouts: [] };
  }
  const url = `${apiBase}/profile?platformMembershipId=${membershipId}&components=tags,loadouts`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${appDim.accessToken}`,
      'X-API-Key': apiKey
    }
  });
  if (!res.ok) {
    throw new Error(`DIM profile failed ${res.status}`);
  }
  const json = await res.json();
  const tagsArr = json?.tags || [];
  const tags = {};
  for (const entry of tagsArr) {
    if (entry?.itemInstanceId) {
      tags[entry.itemInstanceId] = entry;
    }
  }
  return { tags, raw: json };
}

export async function applyDimUpdates({ apiKey = CONFIG.dim.apiKey, apiBase = CONFIG.dim.apiBase, membershipId, updates }) {
  if (!appDim.accessToken) {
    throw new Error('DIM not authenticated');
  }
  const body = {
    destinyVersion: 2,
    platformMembershipId: String(membershipId),
    updates: updates || []
  };
  const res = await fetch(`${apiBase}/profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appDim.accessToken}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`DIM update failed ${res.status}`);
  }
  return res.json();
}
