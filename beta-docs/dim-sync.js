import { CONFIG } from './config.js';

const CROSS_ORIGIN_DIM_HOSTS = new Set(['api.destinyitemmanager.com']);
const loggedDimNotices = new Set();

export const appDim = { accessToken: null, expires: 0, reason: null };

function resetDim(reason = null) {
  appDim.accessToken = null;
  appDim.expires = 0;
  appDim.reason = reason ?? null;
  return { ...appDim };
}

function detectDimCorsBlock(apiBase) {
  if (!apiBase) return null;
  const loc =
    (typeof window !== 'undefined' && window.location) ||
    (typeof location !== 'undefined' ? location : null);
  if (!loc) return null;

  try {
    const url = new URL(apiBase, loc.href);
    const host = url.hostname.toLowerCase();
    if (CROSS_ORIGIN_DIM_HOSTS.has(host)) {
      const originHost = loc.hostname.toLowerCase();
      if (!originHost.endsWith('destinyitemmanager.com')) {
        const locOrigin = loc.origin || `${loc.protocol}//${loc.host}`;
        return {
          reason: 'cors',
          message: `Cross-origin access to ${url.origin} is blocked from ${locOrigin}`
        };
      }
    }
  } catch (err) {
    return {
      reason: 'config',
      message: `Invalid DIM apiBase '${apiBase}': ${err.message}`
    };
  }

  return null;
}

function logDimNotice(key, level = 'info', ...args) {
  if (loggedDimNotices.has(key)) {
    return;
  }
  loggedDimNotices.add(key);
  if (typeof console === 'undefined') {
    return;
  }
  const fn = console[level] || console.info || console.log;
  if (typeof fn === 'function') {
    fn.apply(console, args);
  }
}

export async function initDimSync({
  apiKey = CONFIG.dim.apiKey,
  apiBase = CONFIG.dim.apiBase,
  accessToken,
  membershipId
}) {
  if (!apiKey) {
    return resetDim();
  }

  if (!accessToken || !membershipId) {
    return resetDim();
  }

  const corsBlock = detectDimCorsBlock(apiBase);
  if (corsBlock?.reason === 'cors') {
    const loc =
      (typeof window !== 'undefined' && window.location) ||
      (typeof location !== 'undefined' ? location : null);
    const originForLog = loc ? loc.origin || `${loc.protocol}//${loc.host}` : undefined;
    logDimNotice(
      'dim-cors',
      'info',
      'Skipping DIM sync: DIM API does not allow cross-origin requests from this origin.',
      {
        apiBase,
        origin: originForLog
      }
    );
    return resetDim('cors');
  }

  if (corsBlock?.reason === 'config') {
    logDimNotice('dim-config', 'warn', corsBlock.message);
    return resetDim('config');
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
    return resetDim();
  }
  if (!res.ok) {
    console.warn(`DIM auth failed ${res.status}`);
    return resetDim();
  }
  try {
    const json = await res.json();
    appDim.accessToken = json?.accessToken || json?.dimAccessToken || json?.token || null;
    appDim.expires = Date.now() + 55 * 60 * 1000;
    appDim.reason = null;
  } catch (err) {
    console.warn('DIM auth response was not valid JSON', err);
    return resetDim();
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
