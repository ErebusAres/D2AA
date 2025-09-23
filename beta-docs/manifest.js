function toSignedHash(hash) {
  const n = Number(hash);
  return n > 0x7fffffff ? n - 0x100000000 : n;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      let attempt = 0;
      const maxAttempts = 3;
      while (attempt < maxAttempts) {
        try {
          const res = await fetch(url, {
            headers: {
              'X-API-Key': apiKey
            }
          });
          const text = await res.text();
          let parsed = null;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch (err) {
              const error = new Error(`Manifest ${table} ${hash} returned invalid JSON`);
              error.cause = err;
              throw error;
            }
          }
          if (!res.ok) {
            const message =
              (parsed && (parsed.Message || parsed.message || parsed.error || parsed.error_description)) ||
              text ||
              res.statusText;
            const error = new Error(`Manifest ${table} ${hash} failed (${res.status}): ${message}`);
            error.status = res.status;
            throw error;
          }
          const val = parsed?.Response ?? null;
          cache.set(key, val);
          return val;
        } catch (err) {
          const status = err?.status;
          const retryable =
            (typeof status === 'number' && status >= 500) ||
            err instanceof TypeError ||
            err?.name === 'TypeError';
          attempt += 1;
          if (retryable && attempt < maxAttempts) {
            await delay(250 * attempt);
            continue;
          }
          throw err;
        }
      }
      throw new Error(`Manifest ${table} ${hash} failed after ${maxAttempts} attempts`);
    }
  };
}
