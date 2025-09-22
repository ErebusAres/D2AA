const TOKEN_STORAGE_KEY = 'bungie_access_token';
const TOKEN_EXPIRY_KEY = 'bungie_access_token_expires_at';
const AUTH_BASE = 'https://www.bungie.net/en/OAuth/Authorize';

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch (_err) {
    return null;
  }
}

function parseTokenFromHash(hash) {
  if (!hash) return null;
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  const expiresIn = Number(params.get('expires_in')) || null;
  const now = Date.now();
  const expiry = expiresIn ? now + expiresIn * 1000 : null;
  return { accessToken, expiry };
}

function storeToken({ accessToken, expiry }) {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(TOKEN_STORAGE_KEY, accessToken);
  if (expiry) {
    storage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
  } else {
    storage.removeItem(TOKEN_EXPIRY_KEY);
  }
}

function cleanupRedirectFragment() {
  try {
    const { origin, pathname, search } = window.location;
    const cleanUrl = `${origin}${pathname}${search}`;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (_err) {
    // Non-fatal — continue with the existing URL.
  }
}

function readStoredToken() {
  const storage = getSessionStorage();
  if (!storage) return null;
  const token = storage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return null;
  const expiryRaw = storage.getItem(TOKEN_EXPIRY_KEY);
  if (expiryRaw) {
    const expiry = Number(expiryRaw);
    if (!Number.isNaN(expiry) && Date.now() >= expiry) {
      storage.removeItem(TOKEN_STORAGE_KEY);
      storage.removeItem(TOKEN_EXPIRY_KEY);
      return null;
    }
  }
  return token;
}

function ensureTokenFromRedirect() {
  if (typeof window === 'undefined') return null;
  const parsed = parseTokenFromHash(window.location.hash);
  if (!parsed) return null;
  storeToken(parsed);
  cleanupRedirectFragment();
  return parsed.accessToken;
}

function redirectToOAuth({ clientId, redirectUri }) {
  if (!clientId || !redirectUri) {
    throw new Error('clientId and redirectUri are required for Bungie OAuth');
  }
  const url = new URL(AUTH_BASE);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri);
  window.location.assign(url.toString());
}

export function getStoredBungieAccessToken() {
  return ensureTokenFromRedirect() || readStoredToken();
}

export function clearStoredBungieAccessToken() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(TOKEN_STORAGE_KEY);
  storage.removeItem(TOKEN_EXPIRY_KEY);
}

export function beginBungieOAuth({ clientId, redirectUri }) {
  redirectToOAuth({ clientId, redirectUri });
}

async function fetchJson(url, { headers }) {
  const response = await fetch(url, { headers });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = json?.Message || response.statusText;
    throw new Error(`Bungie request failed (${response.status}): ${detail}`);
  }
  if (!json || json.ErrorCode !== 1) {
    const detail = json?.Message || 'Unknown Bungie error';
    throw new Error(`Bungie request failed: ${detail}`);
  }
  return json.Response;
}

export async function getMembershipId(apiKey, accessToken) {
  if (!apiKey) throw new Error('Bungie API key is required');
  if (!accessToken) throw new Error('Bungie OAuth token is required');
  const url = 'https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/';
  const headers = {
    'X-API-Key': apiKey,
    Authorization: `Bearer ${accessToken}`,
  };
  const response = await fetchJson(url, { headers });
  const membership = response?.destinyMemberships?.[0];
  if (!membership) {
    throw new Error('No Destiny memberships found for this account');
  }
  return {
    membershipId: membership.membershipId,
    membershipType: membership.membershipType,
  };
}
