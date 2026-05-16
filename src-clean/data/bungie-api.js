export function bungieIconUrl(path) { return String(path || ''); }
export async function bungieFetch() { throw new Error('Not ready.'); }
export async function bungiePost() { throw new Error('Not ready.'); }
export async function getMembership() { throw new Error('Not ready.'); }
export async function getDef() { return null; }
export async function mapLimit(items, limit, worker) { return Promise.all(items.map(worker)); }
export function toUint32(hash) { return Number(hash) >>> 0; }
export function toSigned32(hash) { const n = Number(hash) >>> 0; return n > 2147483647 ? n - 4294967296 : n; }
