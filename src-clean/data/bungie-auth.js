const AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';

export const BUNGIE_STORAGE = {
  config: 'd2aa_bungie_public_config_v1',
  token: 'd2aa_bungie_token_v1',
  state: 'd2aa_bungie_oauth_state_v1'
};

export const PUBLIC_CONFIG = {
  apiKey: '96e154014bdd44c0a537e482709b7473',
  clientId: '50794',
  redirectUri: 'https://erebusares.github.io/D2AA/beta2.html'
};

export function readJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}
export function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function cleanConfig(config) { return Object.fromEntries(Object.entries(config || {}).filter(([, value]) => String(value || '').trim())); }
export function getBungieConfig() { return { ...PUBLIC_CONFIG, ...cleanConfig(readJson(BUNGIE_STORAGE.config)) }; }
export function getToken() { return readJson(BUNGIE_STORAGE.token, {}); }
export function tokenIsValid(token = getToken()) { return Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60); }
export function isSignedIn() { return tokenIsValid(); }

export function saveToken(token) {
  const now = Math.floor(Date.now() / 1000);
  const saved = {
    ...token,
    saved_at: now,
    expires_at: token.expires_in ? now + Number(token.expires_in) : token.expires_at,
    refresh_expires_at: token.refresh_expires_in ? now + Number(token.refresh_expires_in) : token.refresh_expires_at
  };
  writeJson(BUNGIE_STORAGE.token, saved);
  return saved;
}

export function startLogin() {
  const cfg = getBungieConfig();
  const state = randomState();
  localStorage.setItem(BUNGIE_STORAGE.state, state);
  sessionStorage.setItem('d2aa_clean_return_after_oauth', location.href);
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  window.location.href = url.toString();
}

export async function exchangeCode(code) {
  const cfg = getBungieConfig();
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', cfg.clientId);
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error_description || json.Message || `OAuth token exchange failed (${response.status}).`);
  return saveToken(json);
}

export async function refreshToken() {
  const cfg = getBungieConfig();
  const token = getToken();
  if (!token.refresh_token) throw new Error('No refresh token found. Connect your Destiny account again.');
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', token.refresh_token);
  body.set('client_id', cfg.clientId);
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error_description || json.Message || `OAuth refresh failed (${response.status}).`);
  return saveToken(json);
}

export async function handleOAuthRedirect() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return false;
  const returnedState = url.searchParams.get('state');
  const expectedState = localStorage.getItem(BUNGIE_STORAGE.state);
  if (expectedState && returnedState !== expectedState) throw new Error('Bungie sign-in failed: OAuth state mismatch.');
  await exchangeCode(code);
  localStorage.removeItem(BUNGIE_STORAGE.state);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  history.replaceState({}, document.title, url.toString());
  return true;
}

function randomState() {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
}
