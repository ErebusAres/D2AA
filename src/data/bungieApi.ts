import { ensureValidToken, getBungieConfig } from './bungieAuth';
import type { BungieMembership } from '../types/bungie';

const API_ROOT = 'https://www.bungie.net/Platform';
const BUNGIE_ORIGIN = 'https://www.bungie.net';
const DEF_MEMORY = new Map<string, unknown>();

export function bungieIconUrl(path: unknown): string {
  const value = String(path || '').trim();
  if (!value) return '';
  return value.startsWith('http') ? value : `${BUNGIE_ORIGIN}${value}`;
}

export async function bungieFetch<T>(path: string, auth = false, options: RequestInit = {}): Promise<T> {
  const cfg = getBungieConfig();
  if (!cfg.apiKey) throw new Error('Missing Bungie API key.');
  const headers = new Headers(options.headers);
  headers.set('X-API-Key', cfg.apiKey);
  if (auth) {
    const token = await ensureValidToken();
    headers.set('Authorization', `Bearer ${token.access_token}`);
  }
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  const json = await response.json().catch(() => ({})) as BungieEnvelope<T>;
  if (!response.ok || (json.ErrorCode && json.ErrorCode !== 1)) throw new Error(json.Message || `Bungie request failed (${response.status}).`);
  return json.Response;
}

export async function bungiePost<T>(path: string, body: unknown): Promise<T> {
  return bungieFetch<T>(path, true, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function getMembership(): Promise<BungieMembership> {
  const data = await bungieFetch<{ destinyMemberships?: BungieMembership[]; primaryMembershipId?: string }>('/User/GetMembershipsForCurrentUser/', true);
  const memberships = data.destinyMemberships || [];
  const primary = memberships.find((item) => item.membershipId === data.primaryMembershipId) || memberships[0];
  if (!primary) throw new Error('No Destiny membership found for this Bungie account.');
  return primary;
}

export async function getDef<T>(type: string, hash: number): Promise<T | null> {
  if (!hash) return null;
  const unsignedHash = toUint32(hash);
  const key = `${type}:${unsignedHash}`;
  if (DEF_MEMORY.has(key)) return DEF_MEMORY.get(key) as T;
  const def = await bungieFetch<T>(`/Destiny2/Manifest/${type}/${unsignedHash}/`, false);
  DEF_MEMORY.set(key, def);
  return def;
}

export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>, progress?: (done: number, total: number) => void): Promise<R[]> {
  const out = new Array<R>(items.length);
  let index = 0;
  let done = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await worker(items[current], current);
      done += 1;
      if (progress && (done % 50 === 0 || done === items.length)) progress(done, items.length);
      if (done % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

export function toUint32(hash: unknown): number {
  return Number(hash) >>> 0;
}

export function toSigned32(hash: unknown): number {
  const n = Number(hash) >>> 0;
  return n > 2147483647 ? n - 4294967296 : n;
}

interface BungieEnvelope<T> {
  Response: T;
  ErrorCode?: number;
  Message?: string;
}
