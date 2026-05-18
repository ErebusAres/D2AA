import { getMembership } from './bungie-api.js';
import { ensureValidToken, getBungieConfig } from './bungie-auth.js';

const DIM_API_HOST = 'https://api.destinyitemmanager.com';
const DIM_TAG_STORAGE = {
  apiKey: 'd2aa_dim_api_key_v1',
  token: 'd2aa_dim_api_token_v1',
  lastSync: 'd2aa_dim_tags_last_sync_v1'
};
const DIM_VERSION = 'D2AA-clean';

export async function syncDimTags({ setStatus } = {}) {
  setStatus?.('Connecting to DIM Sync...');
  const apiKey = await ensureDimApiKey();
  const membership = await getMembership();
  const token = await getDimAuthToken(apiKey, membership.membershipId);
  setStatus?.('Pulling DIM tags...');
  const profile = await dimApi('/profile', {
    method: 'GET',
    apiKey,
    token,
    params: {
      platformMembershipId: membership.membershipId,
      destinyVersion: '2',
      components: 'tags'
    }
  });
  const tags = extractTags(profile, membership.membershipId);
  localStorage.setItem(DIM_TAG_STORAGE.lastSync, JSON.stringify({ at: Date.now(), count: Object.keys(tags).length }));
  return { tags, count: Object.keys(tags).length, membershipId: membership.membershipId };
}

export async function ensureDimApiKey() {
  const existing = getDimApiKey();
  if (existing) return existing;
  const cfg = getBungieConfig();
  const configured = cfg.dimApiKey || window.D2AA_DIM_API_KEY || '';
  if (configured) {
    localStorage.setItem(DIM_TAG_STORAGE.apiKey, configured);
    return configured;
  }
  if (!canAutoRegisterDimApp()) {
    throw new Error('DIM blocks automatic app registration from public hosts like GitHub Pages. D2AA needs a pre-approved DIM API key before live DIM tag sync can work here. CSV tag import still works.');
  }
  if (!cfg.apiKey) throw new Error('Missing Bungie API key; cannot register DIM API app.');
  const response = await dimUnauthenticated('/new_app', {
    method: 'POST',
    body: {
      id: window.location.hostname || 'localhost',
      bungieApiKey: cfg.apiKey,
      origin: window.location.origin
    }
  });
  const dimKey = response?.app?.dimApiKey;
  if (!dimKey) throw new Error('DIM API registration did not return a DIM API key.');
  localStorage.setItem(DIM_TAG_STORAGE.apiKey, dimKey);
  return dimKey;
}

export function clearDimApiKey() {
  localStorage.removeItem(DIM_TAG_STORAGE.apiKey);
  localStorage.removeItem(DIM_TAG_STORAGE.token);
}

function getDimApiKey() {
  return localStorage.getItem(DIM_TAG_STORAGE.apiKey) || localStorage.getItem('dimApiKey') || '';
}

function canAutoRegisterDimApp() {
  const host = window.location.hostname || 'localhost';
  return host === 'localhost' || host === '127.0.0.1' || host === 'xd' || host.endsWith('.lan') || host.endsWith('.internal') || host.startsWith('10.') || host.startsWith('100.') || host.startsWith('192.168.') || host.startsWith('172.16.') || host.startsWith('172.17.') || host.startsWith('172.18.') || host.startsWith('172.19.') || host.startsWith('172.20.') || host.startsWith('172.21.') || host.startsWith('172.22.') || host.startsWith('172.23.') || host.startsWith('172.24.') || host.startsWith('172.25.') || host.startsWith('172.26.') || host.startsWith('172.27.') || host.startsWith('172.28.') || host.startsWith('172.29.') || host.startsWith('172.30.') || host.startsWith('172.31.');
}

async function getDimAuthToken(apiKey, membershipId) {
  const cached = readJson(DIM_TAG_STORAGE.token, null);
  if (cached?.accessToken && cached?.inception && cached?.expiresInSeconds && Date.now() < cached.inception + (cached.expiresInSeconds * 1000) - 60000) {
    return cached.accessToken;
  }
  const bungieToken = await ensureValidToken();
  const authToken = await dimApi('/auth/token', {
    method: 'POST',
    apiKey,
    body: {
      bungieAccessToken: bungieToken.access_token,
      membershipId
    }
  });
  const normalized = {
    ...authToken,
    inception: authToken.inception || Date.now()
  };
  localStorage.setItem(DIM_TAG_STORAGE.token, JSON.stringify(normalized));
  return normalized.accessToken;
}

async function dimUnauthenticated(path, { method = 'GET', body = null } = {}) {
  const response = await fetch(`${DIM_API_HOST}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) {
    const message = json?.message || json?.error || `DIM API request failed (${response.status}).`;
    throw new Error(message);
  }
  return json;
}

async function dimApi(path, { method = 'GET', apiKey, token = '', params = null, body = null } = {}) {
  let url = `${DIM_API_HOST}${path}`;
  if (params) url += `?${new URLSearchParams(params).toString()}`;
  const headers = {
    'X-API-Key': apiKey,
    'X-DIM-Version': DIM_VERSION
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(DIM_TAG_STORAGE.token);
    const message = json?.message || json?.error || `DIM API request failed (${response.status}).`;
    throw new Error(message);
  }
  return json;
}

function extractTags(profile, membershipId) {
  const out = {};
  const candidates = [];
  const profileKey = `${membershipId}-d2`;
  candidates.push(profile?.profiles?.[profileKey]?.tags);
  candidates.push(profile?.tags);
  candidates.push(profile?.profile?.tags);
  candidates.push(profile?.itemInfos);
  candidates.push(profile?.itemInfo);
  for (const bag of candidates) collectTags(bag, out);
  return out;
}

function collectTags(bag, out) {
  if (!bag || typeof bag !== 'object') return;
  for (const [itemId, annotation] of Object.entries(bag)) {
    const tag = normalizeDimTag(annotation?.tag || annotation?.Tag || annotation);
    if (tag) out[itemId] = tag;
  }
}

function normalizeDimTag(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!key || key === 'none' || key === 'untagged') return '';
  if (['favorite', 'favourite', 'fav'].includes(key)) return 'favorite';
  if (['keep', 'keeper'].includes(key)) return 'keep';
  if (['junk', 'trash', 'delete', 'dismantle', 'shard'].includes(key)) return 'junk';
  if (['infuse', 'infusion', 'upgrade'].includes(key)) return 'infuse';
  if (['archive', 'archived', 'store'].includes(key)) return 'archive';
  return '';
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_) { return fallback; }
}