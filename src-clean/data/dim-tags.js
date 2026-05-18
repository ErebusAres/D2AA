import { getMembership } from './bungie-api.js';
import { ensureValidToken } from './bungie-auth.js';

const DIM_API_HOST = 'https://api.destinyitemmanager.com';
const DIM_TAG_STORAGE = {
  apiKey: 'd2aa_dim_api_key_v1',
  token: 'd2aa_dim_api_token_v1',
  lastSync: 'd2aa_dim_tags_last_sync_v1'
};
const DIM_VERSION = 'D2AA-clean';

export async function syncDimTags({ setStatus } = {}) {
  const apiKey = ensureDimApiKey();
  if (!apiKey) throw new Error('DIM tag sync canceled. No DIM API key was saved.');
  setStatus?.('Connecting to DIM Sync...');
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

export function ensureDimApiKey() {
  const existing = getDimApiKey();
  if (existing) return existing;
  const value = window.prompt('Paste DIM API key for read-only DIM tag sync. This is stored locally in this browser only.');
  if (!value?.trim()) return '';
  localStorage.setItem(DIM_TAG_STORAGE.apiKey, value.trim());
  return value.trim();
}

export function clearDimApiKey() {
  localStorage.removeItem(DIM_TAG_STORAGE.apiKey);
  localStorage.removeItem(DIM_TAG_STORAGE.token);
}

function getDimApiKey() {
  return localStorage.getItem(DIM_TAG_STORAGE.apiKey) || localStorage.getItem('dimApiKey') || '';
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
