const BUNGIE_TOKEN_KEY = 'd2aa:bungieAccessToken';
const BUNGIE_TOKEN_EXPIRES_KEY = 'd2aa:bungieAccessTokenExpires';
const BUNGIE_TOKEN_TYPE_KEY = 'd2aa:bungieAccessTokenType';
const BUNGIE_MEMBERSHIP_KEY = 'd2aa:bungieMembership';
const DIM_TOKEN_KEY = 'd2aa:dimAccessToken';
const DIM_TOKEN_EXPIRES_KEY = 'd2aa:dimAccessTokenExpires';
const DIM_TOKEN_MEMBERSHIP_KEY = 'd2aa:dimMembershipId';
const STATUS_ELEMENT_ID = 'dim-status';
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

class RedirectingError extends Error {
  constructor() {
    super('Redirecting to Bungie OAuth');
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
    // Ignore storage errors (e.g. private browsing restrictions).
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
  if (value === null || value === undefined) {
    writeSession(key, null);
  } else {
    writeSession(key, JSON.stringify(value));
  }
}

function getStatusElement() {
  if (typeof document === 'undefined') return null;
  return document.getElementById(STATUS_ELEMENT_ID);
}

function setStatus(text, { clickHandler } = {}) {
  const el = getStatusElement();
  if (!el) return;

  el.textContent = text;
  if (clickHandler) {
    el.style.cursor = 'pointer';
    el.onclick = clickHandler;
  } else {
    el.style.cursor = '';
    el.onclick = null;
  }
}

function cleanOAuthHash() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState({}, document.title, url.toString());
  } catch (_err) {
    // ignore URL manipulation failures
  }
}

function clearBungieSession() {
  writeSession(BUNGIE_TOKEN_KEY, null);
  writeSession(BUNGIE_TOKEN_EXPIRES_KEY, null);
  writeSession(BUNGIE_TOKEN_TYPE_KEY, null);
  writeJsonSession(BUNGIE_MEMBERSHIP_KEY, null);
}

function clearDimSession() {
  writeSession(DIM_TOKEN_KEY, null);
  writeSession(DIM_TOKEN_EXPIRES_KEY, null);
  writeSession(DIM_TOKEN_MEMBERSHIP_KEY, null);
}

function clearAllSessions() {
  clearBungieSession();
  clearDimSession();
}

function captureBungieTokenFromHash() {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return null;

  const params = new URLSearchParams(hash.slice(1));

  if (params.has('error')) {
    const error = params.get('error');
    const description = params.get('error_description') || params.get('errorDescription');
    cleanOAuthHash();
    throw new Error(`Bungie OAuth error: ${error}${description ? ` - ${description}` : ''}`);
  }

  const token = params.get('access_token');
  if (!token) {
    return null;
  }

  const tokenType = params.get('token_type') || params.get('tokenType') || 'Bearer';
  const expiresRaw = params.get('expires_in') || params.get('expiresIn');
  const expiresInSeconds = Number(expiresRaw);
  const lifetime = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600;
  const expiresAt = Date.now() + lifetime * 1000;

  writeSession(BUNGIE_TOKEN_KEY, token);
  writeSession(BUNGIE_TOKEN_EXPIRES_KEY, String(expiresAt));
  writeSession(BUNGIE_TOKEN_TYPE_KEY, tokenType);
  writeJsonSession(BUNGIE_MEMBERSHIP_KEY, null);
  clearDimSession();
  cleanOAuthHash();

  return { accessToken: token, tokenType, expiresAt };
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
  return { accessToken: token, tokenType, expiresAt };
}

function redirectToBungieAuth({ clientId, redirectUri }) {
  if (typeof window === 'undefined') {
    throw new Error('Bungie OAuth requires a browser environment.');
  }

  const authUrl = new URL('https://www.bungie.net/en/OAuth/Authorize');
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);

  setStatus('DIM: Redirecting to Bungie…');
  window.location.assign(authUrl.toString());
  throw new RedirectingError();
}

function ensureBungieToken({ clientId, redirectUri }) {
  const captured = captureBungieTokenFromHash();
  if (captured) {
    return captured;
  }

  const stored = getStoredBungieToken();
  if (stored) {
    return stored;
  }

  redirectToBungieAuth({ clientId, redirectUri });
  return null;
}

function getStoredDimToken({ membershipId }) {
  const token = readSession(DIM_TOKEN_KEY);
  if (!token) return null;

  const storedMembership = readSession(DIM_TOKEN_MEMBERSHIP_KEY);
  if (!storedMembership || String(storedMembership) !== String(membershipId)) {
    clearDimSession();
    return null;
  }

  const expiresRaw = readSession(DIM_TOKEN_EXPIRES_KEY);
  const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  if (!expiresAt || Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiresAt) {
    clearDimSession();
    return null;
  }

  return { accessToken: token, expiresAt };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return response.json();
}

async function fetchMembershipId({ bungieApiKey }) {
  const cached = readJsonSession(BUNGIE_MEMBERSHIP_KEY);
  if (cached?.membershipId && cached?.expiresAt && cached.expiresAt > Date.now()) {
    return cached;
  }

  const token = getStoredBungieToken();
  if (!token) {
    throw new Error('Missing Bungie access token');
  }

  const url = 'https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/';
  const data = await fetchJson(url, {
    headers: {
      'X-API-Key': bungieApiKey,
      Authorization: `${token.tokenType} ${token.accessToken}`,
    },
  });

  const memberships = data?.Response?.destinyMemberships || [];
  const primary = data?.Response?.primaryMembershipId;
  let membershipId = null;
  let membershipType = null;

  if (primary) {
    const match = memberships.find((entry) => String(entry.membershipId) === String(primary));
    if (match) {
      membershipId = String(match.membershipId);
      membershipType = match.membershipType;
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

async function ensureDimToken({ dimApiKey, membershipId }) {
  const cached = getStoredDimToken({ membershipId });
  if (cached) {
    return cached;
  }

  const bungieToken = getStoredBungieToken();
  if (!bungieToken) {
    throw new Error('Missing Bungie access token for DIM exchange');
  }

  const body = {
    bungieAccessToken: bungieToken.accessToken,
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

  const accessToken = data?.accessToken || data?.access_token;
  const expiresRaw = data?.expiresInSeconds ?? data?.expiresIn ?? data?.expires_in;
  const expiresInSeconds = Number(expiresRaw);
  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('DIM token exchange returned an invalid response');
  }

  const expiresAt = Date.now() + expiresInSeconds * 1000;
  writeSession(DIM_TOKEN_KEY, accessToken);
  writeSession(DIM_TOKEN_EXPIRES_KEY, String(expiresAt));
  writeSession(DIM_TOKEN_MEMBERSHIP_KEY, String(membershipId));
  return { accessToken, expiresAt };
}

async function fetchDimProfile({ dimApiKey, dimToken, membershipId }) {
  const url = new URL('https://api.destinyitemmanager.com/profile');
  url.searchParams.set('platformMembershipId', membershipId);
  url.searchParams.set('components', 'tags,loadouts,settings');

  return fetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${dimToken}`,
      'X-API-Key': dimApiKey,
    },
  });
}

function dispatchProfileEvent(detail) {
  if (typeof window === 'undefined') return;
  try {
    const event = new CustomEvent('d2aa:dim-profile', { detail });
    window.dispatchEvent(event);
  } catch (_err) {
    // ignore environments without CustomEvent support
  }
}

function handleError(err) {
  if (err instanceof RedirectingError && err.isRedirect) {
    return;
  }

  console.error('[D2AA][dim-sync] Failed to connect to DIM', err);
  setStatus('DIM: Error (click to retry)', {
    clickHandler: () => {
      clearAllSessions();
      setStatus('DIM: Connecting…');
      window.location.reload();
    },
  });
}

async function runSync(config) {
  const bungieToken = ensureBungieToken(config);
  if (!bungieToken) {
    return null;
  }

  setStatus('DIM: Fetching Bungie profile…');

  let membership;
  try {
    membership = await fetchMembershipId({ bungieApiKey: config.bungieApiKey });
  } catch (err) {
    if (err?.status === 401) {
      clearBungieSession();
      redirectToBungieAuth(config);
      return null;
    }
    throw err;
  }

  setStatus('DIM: Connecting to DIM…');

  let dimToken;
  try {
    dimToken = await ensureDimToken({
      dimApiKey: config.dimApiKey,
      membershipId: membership.membershipId,
    });
  } catch (err) {
    if (err?.status === 401) {
      clearDimSession();
      clearBungieSession();
      redirectToBungieAuth(config);
      return null;
    }
    throw err;
  }

  setStatus('DIM: Syncing DIM profile…');

  const profile = await fetchDimProfile({
    dimApiKey: config.dimApiKey,
    dimToken: dimToken.accessToken,
    membershipId: membership.membershipId,
  });

  const tags = Array.isArray(profile?.tags) ? profile.tags : [];
  const itemHashTags = Array.isArray(profile?.itemHashTags) ? profile.itemHashTags : [];
  const loadouts = Array.isArray(profile?.loadouts) ? profile.loadouts : [];

  setStatus(`DIM: Connected ✓  Loadouts: ${loadouts.length} | Tagged: ${tags.length + itemHashTags.length}`);

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

  if (!bungieApiKey || !clientId || !redirectUri || !dimApiKey) {
    throw new Error('initAutoDimSync requires Bungie and DIM credentials');
  }

  const config = { bungieApiKey, clientId, redirectUri, dimApiKey };
  setStatus('DIM: Connecting…');

  runSync(config).catch(handleError);

  return {
    refresh: async (options = {}) => {
      try {
        if (options.forceAuth) {
          clearAllSessions();
        } else {
          clearDimSession();
        }
        return await runSync(config);
      } catch (err) {
        if (err instanceof RedirectingError && err.isRedirect) {
          return null;
        }
        handleError(err);
        return null;
      }
    },
  };
}

