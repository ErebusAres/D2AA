function computeHashVariants(hash) {
  if (hash === null || hash === undefined) {
    throw new Error('Missing manifest hash');
  }

  const original = String(hash);
  let signed = original;
  let unsigned = original;

  try {
    const asBigInt = BigInt(hash);
    signed = BigInt.asIntN(32, asBigInt).toString();
    unsigned = BigInt.asUintN(32, asBigInt).toString();
  } catch (bigIntError) {
    const n = Number(hash);
    if (Number.isFinite(n)) {
      const truncated = Math.trunc(n);
      signed =
        truncated > 0x7fffffff
          ? String(truncated - 0x100000000)
          : String(truncated);
      const modulo = ((truncated % 0x100000000) + 0x100000000) % 0x100000000;
      unsigned = String(modulo);
    } else {
      console.warn('Unable to coerce manifest hash to integer', hash, bigIntError);
    }
  }

  const variants = [];
  if (signed !== undefined && signed !== null) {
    variants.push(String(signed));
  }
  if (unsigned !== undefined && unsigned !== null) {
    const unsignedStr = String(unsigned);
    if (!variants.includes(unsignedStr)) {
      variants.push(unsignedStr);
    }
  }
  if (!variants.includes(original)) {
    variants.push(original);
  }

  return variants;
}

function backoffDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isParameterParseError(err) {
  const detail = (err?.detail || err?.message || '').toLowerCase();
  return err?.status === 500 && detail.includes('unable to parse your parameters');
}

const loggedParseFallbacks = new Set();

export function createManifestClient({ apiKey }) {
  const cache = new Map();
  return {
    async get(table, hash) {
      const key = `${table}:${String(hash)}`;
      if (cache.has(key)) {
        return cache.get(key);
      }
      let hashVariants;
      try {
        hashVariants = computeHashVariants(hash);
      } catch (err) {
        const error = new Error(`Manifest ${table} ${hash} failed to normalize hash: ${err.message}`);
        error.cause = err;
        error.retryable = false;
        throw error;
      }

      const maxAttempts = 3;

      const fetchVariant = async (hashVariant) => {
        const url = `https://www.bungie.net/Platform/Destiny2/Manifest/${table}/${hashVariant}/`;
        let attempt = 0;
        let lastError = null;

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
                const error = new Error(`Manifest ${table} ${hashVariant} returned invalid JSON`);
                error.cause = err;
                error.manifestHashVariant = hashVariant;
                error.manifestTable = table;
                throw error;
              }
            }
            if (!res.ok) {
              const message =
                (parsed && (parsed.Message || parsed.message || parsed.error || parsed.error_description)) ||
                text ||
                res.statusText;
              const error = new Error(`Manifest ${table} ${hashVariant} failed (${res.status}): ${message}`);
              error.status = res.status;
              error.detail = message;
              error.manifestHashVariant = hashVariant;
              error.manifestTable = table;
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
            return val;
          } catch (err) {
            if (err && typeof err === 'object') {
              err.manifestHashVariant = err.manifestHashVariant || hashVariant;
              err.manifestTable = err.manifestTable || table;
              err.originalManifestHash = err.originalManifestHash || String(hash);
            }
            lastError = err;
            const status = err?.status;
            const retryable =
              ((err?.retryable !== false && typeof status === 'number' && status >= 500) ||
                err instanceof TypeError ||
                err?.name === 'TypeError');
            attempt += 1;
            if (retryable && attempt < maxAttempts) {
              await backoffDelay(250 * attempt);
              continue;
            }
            throw err;
          }
        }

        const error = new Error(`Manifest ${table} ${hashVariant} failed after ${maxAttempts} attempts`);
        if (lastError) {
          error.cause = lastError;
          error.retryable = lastError.retryable;
          error.status = lastError.status;
          error.detail = lastError.detail;
        }
        error.manifestHashVariant = hashVariant;
        error.manifestTable = table;
        error.originalManifestHash = String(hash);
        throw error;
      };

      for (let idx = 0; idx < hashVariants.length; idx++) {
        const variant = hashVariants[idx];
        try {
          const val = await fetchVariant(variant);
          cache.set(key, val);
          return val;
        } catch (err) {
          if (isParameterParseError(err) && idx < hashVariants.length - 1) {
            const fallbackKey = `${table}:${String(hash)}`;
            if (!loggedParseFallbacks.has(fallbackKey)) {
              loggedParseFallbacks.add(fallbackKey);
              console.warn(
                'Manifest lookup failed with hash form, retrying alternate',
                table,
                hash,
                err
              );
            }
            continue;
          }
          throw err;
        }
      }
      const error = new Error(`Manifest ${table} ${hash} failed for all hash variants`);
      error.retryable = false;
      throw error;
    }
  };
}
