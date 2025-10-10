import {
  BUNGIE_CLIENT_ID,
  BUNGIE_REDIRECT_URI,
  BUNGIE_SCOPES,
  BUNGIE_PLATFORM_URL,
  STORAGE_KEYS,
} from './config.js';
import {
  buildExpiresAt,
  clearSearchParam,
  invariant,
  isTokenExpired,
  readSearchParam,
  safeJsonStringify,
} from './utils.js';
import {
  persistBungieTokens,
  restoreBungieTokens,
  clearBungieTokens,
  updateBungieState,
} from './state.js';

function randomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  randomValues.forEach((value) => {
    result += chars[value % chars.length];
  });
  return result;
}

export class BungieAuth {
  constructor(store) {
    invariant(store, 'BungieAuth requires a StateStore instance');
    this.store = store;
    this.tokens = restoreBungieTokens();
    if (this.tokens) {
      updateBungieState(store, {
        tokens: this.tokens,
        status: 'ready',
        membershipId: this.tokens.membership_id ?? this.tokens.membershipId ?? null,
      });
    }
  }

  buildAuthorizeUrl() {
    const state = randomString(24);
    try {
      sessionStorage.setItem(STORAGE_KEYS.bungieOAuthState, state);
    } catch (error) {
      console.warn('Unable to store oauth state', error);
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: BUNGIE_CLIENT_ID,
      state,
      redirect_uri: BUNGIE_REDIRECT_URI,
    });
    if (Array.isArray(BUNGIE_SCOPES) && BUNGIE_SCOPES.length) {
      params.set('scope', BUNGIE_SCOPES.join(' '));
    }
    return `https://www.bungie.net/en/OAuth/Authorize?${params.toString()}`;
  }

  startLogin() {
    const url = this.buildAuthorizeUrl();
    window.location.assign(url);
  }

  async handleRedirect() {
    const code = readSearchParam('code');
    const state = readSearchParam('state');
    if (!code) return null;
    const storedState = sessionStorage.getItem(STORAGE_KEYS.bungieOAuthState);
    if (storedState && state !== storedState) {
      throw new Error('OAuth state mismatch');
    }
    try {
      sessionStorage.removeItem(STORAGE_KEYS.bungieOAuthState);
    } catch (_) {}
    clearSearchParam('code');
    clearSearchParam('state');
    const token = await this.exchangeCode(code);
    this.setTokens(token);
    return token;
  }

  async exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: BUNGIE_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
    });
    const res = await fetch(`${BUNGIE_PLATFORM_URL}/App/OAuth/Token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bungie token exchange failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    const normalized = this.normalizeTokenResponse(json);
    persistBungieTokens(normalized);
    return normalized;
  }

  async refreshToken() {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refresh_token,
      client_id: BUNGIE_CLIENT_ID,
    });
    const res = await fetch(`${BUNGIE_PLATFORM_URL}/App/OAuth/Token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bungie token refresh failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    const normalized = this.normalizeTokenResponse(json);
    this.setTokens(normalized);
    return normalized;
  }

  normalizeTokenResponse(response) {
    const token = {
      ...response,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: buildExpiresAt(response.expires_in ?? 0),
      refreshExpiresAt: buildExpiresAt(response.refresh_expires_in ?? 0),
      membership_id: response.membership_id ?? response.membershipId ?? null,
    };
    return token;
  }

  setTokens(tokens) {
    this.tokens = tokens;
    persistBungieTokens(tokens);
    updateBungieState(this.store, {
      tokens,
      status: 'ready',
      membershipId: tokens?.membership_id ?? tokens?.membershipId ?? null,
    });
  }

  async getAccessToken() {
    if (!this.tokens) return null;
    if (isTokenExpired(this.tokens)) {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Refresh failed', error);
        this.signOut();
        throw error;
      }
    }
    return this.tokens.access_token ?? this.tokens.accessToken ?? null;
  }

  getMembershipId() {
    return this.tokens?.membership_id ?? this.tokens?.membershipId ?? null;
  }

  getMembershipType() {
    return this.tokens?.membership_type ?? this.tokens?.membershipType ?? null;
  }

  signOut() {
    this.tokens = null;
    clearBungieTokens();
    updateBungieState(this.store, {
      tokens: null,
      status: 'idle',
      membershipId: null,
      membershipType: null,
    });
  }
}
