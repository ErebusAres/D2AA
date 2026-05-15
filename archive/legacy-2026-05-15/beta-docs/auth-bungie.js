import {
  BUNGIE_CLIENT_ID,
  BUNGIE_REDIRECT_URI,
  BUNGIE_SCOPES,
  STORAGE_KEYS,
} from './config.js';
import { buildExpiresAt, invariant, isTokenExpired } from './utils.js';
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

function parseAuthFragment() {
  const { hash } = window.location;
  if (!hash || hash.length <= 1) return null;
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);
  if (!params.has('access_token')) return null;
  const fragment = {};
  params.forEach((value, key) => {
    fragment[key] = value;
  });
  return fragment;
}

function clearAuthFragment() {
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  try {
    window.history.replaceState({}, document.title, url);
  } catch (error) {
    console.warn('Unable to clear auth fragment', error);
    window.location.hash = '';
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class BungieAuth {
  constructor(store) {
    invariant(store, 'BungieAuth requires a StateStore instance');
    this.store = store;
    this.tokens = null;
    this.expiryTimeoutId = null;

    const restored = restoreBungieTokens();
    if (restored) {
      this.setTokens(restored);
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
      response_type: 'token',
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
    const fragment = parseAuthFragment();
    if (!fragment) return null;

    let storedState = null;
    try {
      storedState = sessionStorage.getItem(STORAGE_KEYS.bungieOAuthState);
    } catch (error) {
      console.warn('Unable to read oauth state', error);
    }
    const fragmentState = fragment.state ?? null;
    if (storedState && fragmentState !== storedState) {
      try {
        sessionStorage.removeItem(STORAGE_KEYS.bungieOAuthState);
      } catch (error) {
        console.warn('Unable to clear oauth state', error);
      }
      clearAuthFragment();
      throw new Error('OAuth state mismatch');
    }
    try {
      sessionStorage.removeItem(STORAGE_KEYS.bungieOAuthState);
    } catch (error) {
      console.warn('Unable to clear oauth state', error);
    }

    const token = this.normalizeTokenResponse(fragment);
    this.setTokens(token);
    clearAuthFragment();
    return token;
  }

  normalizeTokenResponse(payload) {
    if (!payload) return null;

    const accessToken = payload.access_token ?? payload.accessToken ?? null;
    const refreshToken = payload.refresh_token ?? payload.refreshToken ?? null;
    const expiresIn = payload.expires_in ?? payload.expiresIn;
    const refreshExpiresIn = payload.refresh_expires_in ?? payload.refreshExpiresIn;
    const membershipId = payload.membership_id ?? payload.membershipId ?? null;
    const membershipType = payload.membership_type ?? payload.membershipType ?? null;

    const normalized = {
      ...payload,
      access_token: accessToken,
      accessToken,
      refresh_token: refreshToken,
      refreshToken,
      membership_id: membershipId,
      membershipId,
      membership_type: membershipType,
      membershipType,
    };

    if (!normalized.expiresAt) {
      const seconds = toNumber(expiresIn);
      normalized.expires_in = seconds;
      normalized.expiresIn = seconds;
      normalized.expiresAt = seconds ? buildExpiresAt(seconds) : null;
    } else {
      normalized.expiresAt = Number(normalized.expiresAt);
      if (!normalized.expires_in) {
        normalized.expires_in = Math.max(0, Math.round((normalized.expiresAt - Date.now()) / 1000));
      }
    }

    if (!normalized.refreshExpiresAt && refreshExpiresIn !== undefined) {
      const seconds = toNumber(refreshExpiresIn);
      normalized.refresh_expires_in = seconds;
      normalized.refreshExpiresIn = seconds;
      normalized.refreshExpiresAt = seconds ? buildExpiresAt(seconds) : null;
    } else if (normalized.refreshExpiresAt) {
      normalized.refreshExpiresAt = Number(normalized.refreshExpiresAt);
    }

    return normalized;
  }

  scheduleTokenExpiry(tokens) {
    if (!tokens?.expiresAt) return;
    const delay = tokens.expiresAt - Date.now();
    if (delay <= 0) {
      this.signOut();
      return;
    }
    this.expiryTimeoutId = window.setTimeout(() => {
      this.signOut();
    }, delay);
  }

  clearExpiryTimer() {
    if (this.expiryTimeoutId) {
      window.clearTimeout(this.expiryTimeoutId);
      this.expiryTimeoutId = null;
    }
  }

  setTokens(tokens) {
    this.clearExpiryTimer();
    if (!tokens) {
      this.tokens = null;
      return;
    }

    const normalized = this.normalizeTokenResponse(tokens);
    if (!normalized || isTokenExpired(normalized)) {
      this.signOut();
      return;
    }

    this.tokens = normalized;
    persistBungieTokens(normalized);
    this.scheduleTokenExpiry(normalized);
    updateBungieState(this.store, {
      tokens: normalized,
      status: 'ready',
      membershipId: normalized.membership_id ?? normalized.membershipId ?? null,
      membershipType: normalized.membership_type ?? normalized.membershipType ?? null,
    });
  }

  async getAccessToken() {
    if (!this.tokens) return null;
    if (isTokenExpired(this.tokens)) {
      this.signOut();
      return null;
    }
    return this.tokens.accessToken ?? this.tokens.access_token ?? null;
  }

  getMembershipId() {
    return this.tokens?.membership_id ?? this.tokens?.membershipId ?? null;
  }

  getMembershipType() {
    return this.tokens?.membership_type ?? this.tokens?.membershipType ?? null;
  }

  signOut() {
    this.clearExpiryTimer();
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
