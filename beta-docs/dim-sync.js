import { DIM_API_URL, buildDimHeaders } from './config.js';
import { buildExpiresAt, isTokenExpired, toMap } from './utils.js';
import {
  persistDimTokens,
  restoreDimTokens,
  updateDimState,
} from './state.js';

function resolveState(store) {
  if (!store) return null;
  if (typeof store.getState === 'function') {
    return store.getState();
  }
  return store;
}

function resolveMembershipId(store, tokens) {
  const state = resolveState(store);
  return (
    state?.bungie?.membershipId ??
    state?.bungie?.tokens?.membership_id ??
    state?.bungie?.tokens?.membershipId ??
    tokens?.membershipId ??
    tokens?.membership_id ??
    null
  );
}

async function dimFetch(path, token, options = {}) {
  const url = path.startsWith('http') ? path : `${DIM_API_URL}${path}`;
  const baseHeaders = buildDimHeaders(token?.accessToken ?? token?.access_token);
  const extraHeaders = options.headers ?? null;
  if (extraHeaders) {
    const entries =
      extraHeaders instanceof Headers
        ? extraHeaders.entries()
        : Object.entries(extraHeaders);
    for (const [key, value] of entries) {
      if (value !== undefined && value !== null) {
        baseHeaders.set(key, value);
      }
    }
  }
  const fetchOptions = { ...options, headers: baseHeaders };
  const res = await fetch(url, fetchOptions);
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`DIM request failed: ${res.status}`);
    error.status = res.status;
    error.body = text;
    throw error;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const parseError = new Error('Failed to parse DIM response');
    parseError.cause = error;
    parseError.body = text;
    throw parseError;
  }
}

export class DimSync {
  constructor(store) {
    this.store = store;
    this.tokens = restoreDimTokens();
    if (this.tokens) {
      this.tokens = this.normalizeTokens(this.tokens);
      updateDimState(store, { status: 'ready', token: this.tokens, error: null });
    }
  }

  async init(bungieAuth) {
    if (this.tokens && !isTokenExpired(this.tokens)) {
      await this.loadAnnotations();
      return;
    }

    if (this.tokens && (this.tokens.refreshToken || this.tokens.refresh_token)) {
      try {
        await this.refresh();
        await this.loadAnnotations();
        return;
      } catch (error) {
        console.warn('DIM token refresh failed', error);
      }
    }

    if (!bungieAuth) return;
    try {
      await this.authorizeWithBungie(bungieAuth);
      await this.loadAnnotations();
    } catch (error) {
      console.warn('DIM authorization failed', error);
      updateDimState(this.store, { status: 'error', error: error.message });
    }
  }

  async authorizeWithBungie(auth) {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) throw new Error('Bungie access token is required for DIM sync');
    const membershipId = resolveMembershipId(this.store, this.tokens);
    if (!membershipId) {
      throw new Error('Bungie membership id is required for DIM sync');
    }
    updateDimState(this.store, { status: 'authorizing', error: null });
    const payload = {
      bungieAccessToken: accessToken,
      membershipId: String(membershipId),
    };
    const res = await dimFetch('/auth/token', null, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setTokens(this.normalizeTokens(res));
  }

  async refresh() {
    const refreshToken = this.tokens?.refreshToken ?? this.tokens?.refresh_token;
    if (!refreshToken) {
      throw new Error('DIM refresh token unavailable');
    }
    const membershipId = resolveMembershipId(this.store, this.tokens);
    updateDimState(this.store, { status: 'refreshing', error: null });
    const payload = {
      refreshToken,
    };
    if (membershipId) {
      payload.membershipId = String(membershipId);
    }
    const res = await dimFetch('/auth/token', null, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setTokens(this.normalizeTokens(res));
  }

  normalizeTokens(response) {
    if (!response) return null;
    const expiresIn = response?.expiresIn ?? response?.expires_in ?? null;
    const expiresAt =
      response?.expiresAt ?? response?.expires_at ?? (expiresIn ? buildExpiresAt(expiresIn) : null);
    return {
      ...response,
      accessToken: response.accessToken ?? response.access_token,
      refreshToken: response.refreshToken ?? response.refresh_token,
      expiresAt: expiresAt ? Number(expiresAt) : null,
      membershipId: response.membershipId ?? response.membership_id ?? null,
    };
  }

  setTokens(tokens) {
    const normalized = this.normalizeTokens(tokens);
    this.tokens = normalized;
    persistDimTokens(normalized);
    updateDimState(this.store, { status: 'ready', token: normalized, error: null });
  }

  async loadAnnotations() {
    if (!this.tokens) return null;
    const membershipId = resolveMembershipId(this.store, this.tokens);
    if (!membershipId) {
      const empty = new Map();
      updateDimState(this.store, { status: 'ready', tagsByInstance: empty, error: null });
      return empty;
    }
    updateDimState(this.store, { status: 'loading', error: null });
    const params = new URLSearchParams({
      platformMembershipId: String(membershipId),
      components: 'tags,loadouts',
    });
    try {
      const res = await dimFetch(`/profile?${params.toString()}`, this.tokens, {
        method: 'GET',
      });
      const annotations = Array.isArray(res?.itemAnnotations)
        ? res.itemAnnotations
        : Array.isArray(res?.profile?.itemAnnotations)
        ? res.profile.itemAnnotations
        : [];
      const map = toMap(annotations, (item) => item.itemInstanceId ?? item.id ?? item.item_id);
      updateDimState(this.store, {
        status: 'ready',
        tagsByInstance: map,
        error: null,
      });
      return map;
    } catch (error) {
      console.warn('DIM annotations load failed', error);
      updateDimState(this.store, {
        status: 'error',
        error: error.message ?? 'Failed to load DIM annotations',
      });
      throw error;
    }
  }

  async saveTag(update) {
    if (!this.tokens) {
      throw new Error('DIM tokens unavailable');
    }
    const updates = Array.isArray(update) ? update : [update];
    if (!updates.length) return;
    updateDimState(this.store, { status: 'saving', error: null });
    try {
      await dimFetch('/profile', this.tokens, {
        method: 'POST',
        body: JSON.stringify({ updates }),
      });
      await this.loadAnnotations();
    } catch (error) {
      console.error('DIM tag save failed', error);
      updateDimState(this.store, {
        status: 'error',
        error: error.message ?? 'Failed to save DIM tag',
      });
      throw error;
    }
  }
}
