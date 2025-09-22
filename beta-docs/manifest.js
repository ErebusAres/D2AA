const API_ROOT = 'https://www.bungie.net/Platform';

export function toSignedHash(uint32) {
  const value = Number(uint32);
  if (!Number.isFinite(value)) return 0;
  return value > 0x7fffffff ? value - 0x100000000 : value;
}

async function fetchDefinition({ table, hash, apiKey, cache }) {
  if (!table) throw new Error('Manifest requests require a table name');
  if (hash === undefined || hash === null) return null;
  const cacheKey = `${table}:${hash}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const signedHash = toSignedHash(hash);
  const url = `${API_ROOT}/Destiny2/Manifest/${table}/${signedHash}/`;
  const response = await fetch(url, { headers: { 'X-API-Key': apiKey } });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = json?.Message || response.statusText || 'Unknown manifest error';
    throw new Error(`Manifest request failed (${response.status}): ${detail}`);
  }
  if (!json || json.ErrorCode !== 1) {
    const detail = json?.Message || 'Unknown manifest error';
    throw new Error(`Manifest request failed: ${detail}`);
  }
  const definition = json.Response ?? null;
  cache.set(cacheKey, definition);
  return definition;
}

export function createManifestClient({ apiKey }) {
  if (!apiKey) throw new Error('createManifestClient requires a Bungie API key');
  const cache = new Map();

  return {
    async getDefinition(table, hash) {
      return fetchDefinition({ table, hash, apiKey, cache });
    },
    async getInventoryItem(hash) {
      return fetchDefinition({
        table: 'DestinyInventoryItemDefinition',
        hash,
        apiKey,
        cache,
      });
    },
    async getStat(hash) {
      return fetchDefinition({
        table: 'DestinyStatDefinition',
        hash,
        apiKey,
        cache,
      });
    },
  };
}
