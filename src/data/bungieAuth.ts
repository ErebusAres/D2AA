import type { BungiePublicConfig, BungieToken } from '../types/auth';
import { readJson, removeStorage, writeJson } from '../utils/storage';

const AUTH_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';

export const BUNGIE_STORAGE = {
  config: 'd2aa_bungie_public_config_v1',
  token: 'd2aa_bungie_token_v1',
  state: 'd2aa_bungie_oauth_state_v1',
  returnUrl: 'd2aa_clean_return_after_oauth'
} as const;

export const PUBLIC_CONFIG: BungiePublicConfig = {
  apiKey: '96e154014bdd44c0a537e482709b7473',
  clientId: '50794',
  redirectUri: 'https://erebusares.github.io/D2AA/D2AA.html'
};

let refreshPromise: Promise<BungieToken> | null = null;

export function getBungieConfig(): BungiePublicConfig {
  const stored = readJson<Partial<BungiePublicConfig>>(BUNGIE_STORAGE.config, {});
  return {
    ...PUBLIC_CONFIG,
    apiKey: stored.apiKey || PUBLIC_CONFIG.apiKey,
    clientId: stored.clientId || PUBLIC_CONFIG.clientId,
    redirectUri: window.D2AA_BUNGIE_REDIRECT_URI || stored.redirectUri || PUBLIC_CONFIG.redirectUri
  };
}

export function getToken(): BungieToken {
  return readJson<BungieToken>(BUNGIE_STORAGE.token, {});
}

export function tokenIsValid(token = getToken()): boolean {
  return Boolean(token.access_token && token.expires_at && token.expires_at > Math.floor(Date.now() / 1000) + 60);
}

export function refreshTokenIsValid(token = getToken()): boolean {
  return Boolean(token.refresh_token && (!token.refresh_expires_at || token.refresh_expires_at > Math.floor(Date.now() / 1000) + 60));
}

export function isSignedIn(): boolean {
  return tokenIsValid() || refreshTokenIsValid();
}

export async function ensureValidToken(): Promise<BungieToken> {
  const token = getToken();
  if (tokenIsValid(token)) return token;
  if (!refreshTokenIsValid(token)) throw new Error('No valid Bungie session found. Connect your Destiny account again.');
  refreshPromise ??= refreshToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function startLogin(): void {
  const cfg = getBungieConfig();
  const state = randomState();
  const returnUrl = cleanReturnUrl(location.href);
  writeJson(BUNGIE_STORAGE.state, state);
  writeJson(BUNGIE_STORAGE.returnUrl, returnUrl);
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', cleanReturnUrl(cfg.redirectUri));
  window.location.assign(url.toString());
}

export async function handleOAuthRedirect(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return false;
  const returnedState = url.searchParams.get('state');
  const expectedState = localStorage.getItem(BUNGIE_STORAGE.state);
  if (expectedState && returnedState !== expectedState) throw new Error('Bungie sign-in failed: OAuth state mismatch.');
  await exchangeCode(code);
  removeStorage(BUNGIE_STORAGE.state);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  history.replaceState({}, document.title, url.toString());
  return true;
}

export function clearToken(): void {
  removeStorage(BUNGIE_STORAGE.token);
}

async function exchangeCode(code: string): Promise<BungieToken> {
  const cfg = getBungieConfig();
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', cfg.clientId);
  body.set('redirect_uri', cleanReturnUrl(cfg.redirectUri));
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
  const json = await readResponseJson(response);
  if (!response.ok) throw new Error(errorMessage(json, `OAuth token exchange failed (${response.status}).`));
  return saveToken(json);
}

async function refreshToken(): Promise<BungieToken> {
  const cfg = getBungieConfig();
  const token = getToken();
  if (!token.refresh_token) throw new Error('No refresh token found. Connect your Destiny account again.');
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', token.refresh_token);
  body.set('client_id', cfg.clientId);
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': cfg.apiKey }, body });
  const json = await readResponseJson(response);
  if (!response.ok) {
    clearToken();
    throw new Error(errorMessage(json, `OAuth refresh failed (${response.status}).`));
  }
  return saveToken(json);
}

function saveToken(token: BungieToken): BungieToken {
  const now = Math.floor(Date.now() / 1000);
  const previous = getToken();
  const saved = {
    ...previous,
    ...token,
    saved_at: now,
    expires_at: token.expires_in ? now + Number(token.expires_in) : token.expires_at || previous.expires_at,
    refresh_expires_at: token.refresh_expires_in ? now + Number(token.refresh_expires_in) : token.refresh_expires_at || previous.refresh_expires_at
  };
  writeJson(BUNGIE_STORAGE.token, saved);
  return saved;
}

async function readResponseJson(response: Response): Promise<BungieToken & { error_description?: string; Message?: string }> {
  return response.json().catch(() => ({}));
}

function errorMessage(json: { error_description?: string; Message?: string }, fallback: string): string {
  return json.error_description || json.Message || fallback;
}

function cleanReturnUrl(value: string): string {
  const url = new URL(value, location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  return url.toString();
}

function randomState(): string {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
}
