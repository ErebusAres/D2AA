import { DIM_API_URL, buildDimHeaders } from './config.js';
import { buildExpiresAt, isTokenExpired, toMap } from './utils.js';
import {
  persistDimTokens,
  restoreDimTokens,
  updateDimState,
} from './state.js';

async function dimFetch(path, token, options = {}) {
  const url = path.startsWith('http') ? path : `${DIM_API_URL}${path}`;
  const headers = buildDimHeaders(token?.accessToken ?? token?.access_token);
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DIM request failed: ${res.status} ${text}`);
  }
  return res.json();
}

export class DimSync {
  constructor(store) {
    this.store = store;
    this.tokens = restoreDimTokens();
    if (this.tokens) {
      updateDimState(store, { status: 'ready', token: this.tokens });
    }
  }

  async init(bungieAuth) {
    if (this.tokens && !isTokenExpired(this.tokens)) {
      await this.loadAnnotations();
      return;
    }

    if (this.tokens && this.tokens.refreshToken) {
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
    updateDimState(this.store, { status: 'authorizing' });
    const res = await dimFetch('/auth/bungie', null, {
      method: 'POST',
      headers: buildDimHeaders(),
      body: JSON.stringify({ accessToken }),
    });
    this.setTokens(this.normalizeTokens(res));
  }

  async refresh() {
    if (!this.tokens?.refreshToken && !this.tokens?.refresh_token) {
      throw new Error('DIM refresh token unavailable');
    }
    updateDimState(this.store, { status: 'refreshing' });
    const res = await dimFetch('/auth/refresh', null, {
      method: 'POST',
      headers: buildDimHeaders(),
      body: JSON.stringify({ refreshToken: this.tokens.refreshToken ?? this.tokens.refresh_token }),
    });
    this.setTokens(this.normalizeTokens(res));
  }

  normalizeTokens(response) {
    return {
      ...response,
      accessToken: response.accessToken ?? response.access_token,
      refreshToken: response.refreshToken ?? response.refresh_token,
      expiresAt: buildExpiresAt(response.expiresIn ?? response.expires_in ?? 0),
    };
  }

  setTokens(tokens) {
    this.tokens = tokens;
    persistDimTokens(tokens);
    updateDimState(this.store, { status: 'ready', token: tokens });
  }

  async loadAnnotations() {
    if (!this.tokens) return null;
    updateDimState(this.store, { status: 'loading' });
    const res = await dimFetch('/profile/items', this.tokens, {
      method: 'GET',
    });
    const items = Array.isArray(res?.items) ? res.items : [];
    const map = toMap(items, (item) => item.id ?? item.itemInstanceId ?? item.item_id);
    updateDimState(this.store, {
      status: 'ready',
      tagsByInstance: map,
    });
    return map;
  }
}
