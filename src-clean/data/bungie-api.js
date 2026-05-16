import { getBungieConfig, getToken, tokenIsValid, refreshToken } from './bungie-auth.js';

const API_ROOT = 'https://www.bungie.net/Platform';
const BUNGIE_ORIGIN = 'https://www.bungie.net';
const DEF_MEMORY = new Map();

export function bungieIconUrl(path) {
  const value = String(path || '').trim();
  if (!value) return '';
  return value.startsWith('http') ? value : `${BUNGIE_ORIGIN}${value}`;
}

export async function bungieFetch(path, auth = false, options = {}) {
  const cfg = getBungieConfig();
  if (!cfg.apiKey) throw new Error('Missing Bungie API key.');
  const headers = { 'X-API-Key': cfg.apiKey, ...(options.headers || {}) };
  if (auth) {
    let token = getToken();
    if (!tokenIsValid(token)) token = await refreshToken();
    headers.Authorization = `Bearer ${token.access_token}`;
  }
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || (json.ErrorCode && json.ErrorCode !== 1)) throw new Error(json.Message || `Bungie request failed (${response.status}).`);
  return json.Response;
}

export async function bungiePost(path, body) {
  return bungieFetch(path, true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function getMembership() {
  const data = await bungieFetch('/User/GetMembershipsForCurrentUser/', true);
  const memberships = data.destinyMemberships || [];
  const primary = memberships.find((item) => item.membershipId === data.primaryMembershipId) || memberships[0];
  if (!primary) throw new Error('No Destiny membership found for this Bungie account.');
  return primary;
}

export async function getDef(type, hash) {
  if (!hash) return null;
  const unsignedHash = toUint32(hash);
  const key = `${type}:${unsignedHash}`;
  if (DEF_MEMORY.has(key)) return DEF_MEMORY.get(key);
  const def = await bungieFetch(`/Destiny2/Manifest/${type}/${unsignedHash}/`, false);
  DEF_MEMORY.set(key, def);
  return def;
}

export async function mapLimit(items, limit, worker, progress) {
  const out = new Array(items.length);
  let index = 0;
  let done = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      try { out[current] = await worker(items[current], current); }
      catch (error) { console.warn('D2AA Bungie lookup failed', items[current], error); out[current] = null; }
      done++;
      if (progress && (done % 10 === 0 || done === items.length)) progress(done, items.length);
      if (done % 25 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export function toUint32(hash) { return Number(hash) >>> 0; }
export function toSigned32(hash) { const n = Number(hash) >>> 0; return n > 2147483647 ? n - 4294967296 : n; }
