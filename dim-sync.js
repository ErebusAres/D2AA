const BUNGIE_TOKEN_KEY = 'd2aa:bungieAccessToken';
const BUNGIE_TOKEN_EXPIRES_KEY = 'd2aa:bungieAccessTokenExpires';
const BUNGIE_TOKEN_TYPE_KEY = 'd2aa:bungieTokenType';
const BUNGIE_STATE_KEY = 'd2aa:bungieOAuthState';
const BUNGIE_MEMBERSHIP_KEY = 'd2aa:bungieMembership';
const DIM_TOKEN_KEY = 'd2aa:dimAccessToken';
const DIM_TOKEN_EXPIRES_KEY = 'd2aa:dimAccessTokenExpires';
const DIM_MEMBERSHIP_KEY = 'd2aa:dimMembershipId';
const PROFILE_CACHE_KEY = 'd2aa:dimProfile';
const STATUS_ELEMENT_ID = 'dim-status';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

class RedirectingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RedirectingError';
    this.isRedirect = true;
  }
}

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

function writeSession(key, value) {
  try {
    if (value === null || value === undefined) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch (_err) {
    // ignore storage errors (private browsing, etc.)
  }
}

function readJsonSession(key) {
  const raw = readSession(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function writeJsonSession(key, value) {
  writeSession(key, value == null ? null : JSON.stringify(value));
}

function getStatusElement() {
  if (typeof document === 'undefined') return null;
  return document.getElementById(STATUS_ELEMENT_ID);
}

function setStatus(text, options = {}) {
  const el = getStatusElement();
  if (!el) return;

  el.textContent = text;
  if (options.clickHandler) {
    el.style.cursor = 'pointer';
    el.onclick = options.clickHandler;
  } else {
    el.style.cursor = '';
    el.onclick = null;
  }
}

function parseHashTokens() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;

  const params = new URLSearchParams(hash.slice(1));
  if (!params.has('access_token')) return null;

  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in') || params.get('expiresIn') || 0);
  const tokenType = params.get('token_type') || 'Bearer';
  const state = params.get('state') || null;

  if (!accessToken || !Number.isFinite(expiresIn)) {
    return null;
  }

  const redirectState = readSession(BUNGIE_STATE_KEY);
  if (redirectState && state && redirectState !== state) {
    // state mismatch -> ignore tokens and force a clean auth
    clearBungieSession();
    return null;
  }

  const expiresAt = Date.now() + Math.max(expiresIn * 1000, 0);
  writeSession(BUNGIE_TOKEN_KEY, accessToken);
  writeSession(BUNGIE_TOKEN_EXPIRES_KEY, String(expiresAt));
  writeSession(BUNGIE_TOKEN_TYPE_KEY, tokenType);
  writeSession(BUNGIE_STATE_KEY, '');

  // Clean the URL hash without reloading the page
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState({}, document.title, url.toString());
  } catch (_err) {
    // ignore if URL parsing fails
  }

  return {
    accessToken,
    expiresAt,
    tokenType,
  };
}

function clearBungieSession() {
  writeSession(BUNGIE_TOKEN_KEY, null);
  writeSession(BUNGIE_TOKEN_EXPIRES_KEY, null);
  writeSession(BUNGIE_TOKEN_TYPE_KEY, null);
  writeSession(BUNGIE_MEMBERSHIP_KEY, null);
}

function getStoredBungieToken() {
  const token = readSession(BUNGIE_TOKEN_KEY);
  if (!token) return null;
  const expiresRaw = readSession(BUNGIE_TOKEN_EXPIRES_KEY);
  const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  if (!expiresAt || Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt) {
    clearBungieSession();
    return null;
  }
  const tokenType = readSession(BUNGIE_TOKEN_TYPE_KEY) || 'Bearer';
  return { accessToken: token, expiresAt, tokenType };
}

function redirectToBungieAuth({ clientId, redirectUri }) {
  if (typeof window === 'undefined') {
    throw new Error('Bungie OAuth requires a browser environment.');
  }

  const state = Math.random().toString(36).slice(2);
  writeSession(BUNGIE_STATE_KEY, state);

  const authUrl = new URL('https://www.bungie.net/en/OAuth/Authorize');
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  setStatus('DIM: Redirecting to Bungie…');
  window.location.assign(authUrl.toString());
  throw new RedirectingError('Redirecting to Bungie OAuth');
}

function getStoredDimToken() {
  const token = readSession(DIM_TOKEN_KEY);
  if (!token) return null;
  const expiresRaw = readSession(DIM_TOKEN_EXPIRES_KEY);
  const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  if (!expiresAt || Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt) {
    clearDimSession();
    return null;
  }
  return { accessToken: token, expiresAt };
}

function clearDimSession() {
  writeSession(DIM_TOKEN_KEY, null);
  writeSession(DIM_TOKEN_EXPIRES_KEY, null);
  writeSession(DIM_MEMBERSHIP_KEY, null);
  writeSession(PROFILE_CACHE_KEY, null);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Request failed (${response.status}): ${body}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function fetchMembershipId({ bungieApiKey }) {
  const cached = readJsonSession(BUNGIE_MEMBERSHIP_KEY);
  if (cached?.membershipId && cached?.expiresAt && cached.expiresAt > Date.now()) {
    return cached;
  }

  const accessToken = readSession(BUNGIE_TOKEN_KEY);
  const tokenType = readSession(BUNGIE_TOKEN_TYPE_KEY) || 'Bearer';
  if (!accessToken) {
    throw new Error('Missing Bungie access token');
  }

  const url = 'https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/';
  const data = await fetchJson(url, {
    headers: {
      'X-API-Key': bungieApiKey,
      Authorization: `${tokenType} ${accessToken}`,
    },
  });

  const memberships = data?.Response?.destinyMemberships || [];
  const primaryId = data?.Response?.primaryMembershipId;
  let membershipId = null;
  let membershipType = null;
  if (primaryId) {
    const found = memberships.find((entry) => String(entry.membershipId) === String(primaryId));
    if (found) {
      membershipId = String(found.membershipId);
      membershipType = found.membershipType;
    }
  }
  if (!membershipId && memberships.length) {
    membershipId = String(memberships[0].membershipId);
    membershipType = memberships[0].membershipType;
  }
  if (!membershipId) {
    throw new Error('No Bungie memberships available for this account');
  }

  const payload = {
    membershipId,
    membershipType: membershipType ?? null,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  writeJsonSession(BUNGIE_MEMBERSHIP_KEY, payload);
  return payload;
}

async function exchangeDimToken({ dimApiKey, membershipId }) {
  const cachedToken = getStoredDimToken();
  if (cachedToken) {
    return cachedToken;
  }

  const bungieAccessToken = readSession(BUNGIE_TOKEN_KEY);
  if (!bungieAccessToken) {
    throw new Error('Missing Bungie access token for DIM exchange');
  }

  const body = {
    bungieAccessToken,
    membershipId,
  };

  const data = await fetchJson('https://api.destinyitemmanager.com/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': dimApiKey,
    },
    body: JSON.stringify(body),
  });

  const accessToken = data?.accessToken;
  const expiresInSeconds = Number(data?.expiresInSeconds ?? data?.expiresIn ?? data?.expires_in ?? 0);
  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('DIM token exchange returned an invalid response');
  }

  const expiresAt = Date.now() + expiresInSeconds * 1000;
  writeSession(DIM_TOKEN_KEY, accessToken);
  writeSession(DIM_TOKEN_EXPIRES_KEY, String(expiresAt));
  writeJsonSession(DIM_MEMBERSHIP_KEY, { membershipId, expiresAt });
  return { accessToken, expiresAt };
}

async function fetchDimProfile({ dimApiKey, dimToken, membershipId }) {
  const url = new URL('https://api.destinyitemmanager.com/profile');
  url.searchParams.set('platformMembershipId', membershipId);
  url.searchParams.set('components', 'tags,loadouts,settings');

  const profile = await fetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${dimToken}`,
      'X-API-Key': dimApiKey,
    },
  });

  writeJsonSession(PROFILE_CACHE_KEY, {
    profile,
    fetchedAt: Date.now(),
  });

  return profile;
}

function dispatchProfileEvent(detail) {
  if (typeof window === 'undefined') return;
  try {
    const event = new CustomEvent('d2aa:dim-profile', { detail });
    window.dispatchEvent(event);
  } catch (_err) {
    // ignore if CustomEvent is not supported
  }
}

function handleError(err) {
  if (err instanceof RedirectingError && err.isRedirect) {
    return;
  }
  console.error('[D2AA][dim-sync] Failed to connect to DIM', err);
  const el = getStatusElement();
  if (!el) return;

  setStatus('DIM: Error (click to retry)', {
    clickHandler: () => {
      clearBungieSession();
      clearDimSession();
      setStatus('DIM: Connecting…');
      window.location.reload();
    },
  });
}

async function runSync({ bungieApiKey, clientId, redirectUri, dimApiKey }, options = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!bungieApiKey || !clientId || !redirectUri || !dimApiKey) {
    throw new Error('initAutoDimSync requires Bungie and DIM credentials');
  }

  parseHashTokens();

  let bungieToken = getStoredBungieToken();
  if (!bungieToken || options.forceBungieAuth) {
    redirectToBungieAuth({ clientId, redirectUri });
    return null; // redirect will pause execution
  }

  let membership;
  try {
    membership = await fetchMembershipId({ bungieApiKey });
  } catch (err) {
    if (err?.status === 401) {
      clearBungieSession();
      redirectToBungieAuth({ clientId, redirectUri });
      return null;
    }
    throw err;
  }

  let dimToken;
  try {
    dimToken = await exchangeDimToken({ dimApiKey, membershipId: membership.membershipId });
  } catch (err) {
    if (err?.status === 401) {
      clearDimSession();
      clearBungieSession();
      redirectToBungieAuth({ clientId, redirectUri });
      return null;
    }
    throw err;
  }

  const profile = await fetchDimProfile({
    dimApiKey,
    dimToken: dimToken.accessToken,
    membershipId: membership.membershipId,
  });

  const tags = Array.isArray(profile?.tags) ? profile.tags : [];
  const itemHashTags = Array.isArray(profile?.itemHashTags) ? profile.itemHashTags : [];
  const loadouts = Array.isArray(profile?.loadouts) ? profile.loadouts : [];
  const taggedCount = tags.length + itemHashTags.length;
  const loadoutCount = loadouts.length;

  setStatus(`DIM: Connected ✓  Loadouts: ${loadoutCount} | Tagged: ${taggedCount}`);

  dispatchProfileEvent({
    profile,
    membershipId: membership.membershipId,
    membershipType: membership.membershipType ?? null,
    bungieAccessToken: bungieToken.accessToken,
    bungieAccessTokenExpiresAt: bungieToken.expiresAt,
    dimAccessToken: dimToken.accessToken,
    dimAccessTokenExpiresAt: dimToken.expiresAt,
  });

  return profile;
}

export function initAutoDimSync({ bungieApiKey, clientId, redirectUri, dimApiKey }) {
  if (typeof window === 'undefined') {
    return {
      refresh: async () => null,
    };
  }

  setStatus('DIM: Connecting…');

  const config = { bungieApiKey, clientId, redirectUri, dimApiKey };

  const controller = {
    refresh: async (options = {}) => {
      try {
        clearDimSession();
        if (options.forceAuth) {
          clearBungieSession();
        }
        await runSync(config, { forceBungieAuth: Boolean(options.forceAuth) });
      } catch (err) {
        handleError(err);
      }
    },
  };

  runSync(config).catch(handleError);

  return controller;
}

