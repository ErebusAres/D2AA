function toSignedHash(hash) {
  const n = Number(hash);
  return n > 0x7fffffff ? n - 0x100000000 : n;
}

export function createManifestClient({ apiKey }) {
  const cache = new Map();
  return {
    async get(table, hash) {
      const key = `${table}:${hash}`;
      if (cache.has(key)) {
        return cache.get(key);
      }
      const url = `https://www.bungie.net/Platform/Destiny2/Manifest/${table}/${toSignedHash(hash)}/`;
      const res = await fetch(url, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      if (!res.ok) {
        throw new Error(`Manifest ${table} ${hash} failed: ${res.status}`);
      }
      const json = await res.json();
      const val = json?.Response;
      cache.set(key, val);
      return val;
    }
  };
}
