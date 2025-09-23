function toSignedHash(hash) {
  if (hash === null || hash === undefined) {
    throw new Error('Missing manifest hash');
  }
  try {
    const asBigInt = BigInt(hash);
    return BigInt.asIntN(32, asBigInt).toString();
  } catch (bigIntError) {
    const n = Number(hash);
    if (Number.isFinite(n)) {
      const truncated = Math.trunc(n);
      return truncated > 0x7fffffff
        ? String(truncated - 0x100000000)
        : String(truncated);
    }
    console.warn('Unable to coerce manifest hash to integer', hash, bigIntError);
    return String(hash);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createManifestClient({ apiKey }) {
  const cache = new Map();
  return {
    async get(table, hash) {
      const key = `${table}:${String(hash)}`;
      if (cache.has(key)) {
        return cache.get(key);
      }
      let signedHash;
      try {
        signedHash = toSignedHash(hash);
      } catch (err) {
        const error = new Error(`Manifest ${table} ${hash} failed to normalize hash: ${err.message}`);
        error.cause = err;
        error.retryable = false;
        throw error;
      }
      const url = `https://www.bungie.net/Platform/Destiny2/Manifest/${table}/${signedHash}/`;
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
            error.detail = message;
            if (
              res.status === 500 &&
              typeof message === 'string' &&
              message.toLowerCase().includes('unable to parse your parameters')
            ) {
              error.retryable = false;
            }
            throw error;
          }
          const val = parsed?.Response ?? null;
          cache.set(key, val);
          return val;
        } catch (err) {
          const status = err?.status;
          const retryable =
            ((err?.retryable !== false && typeof status === 'number' && status >= 500) ||
              err instanceof TypeError ||
              err?.name === 'TypeError');
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
