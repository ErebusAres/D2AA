const API_ROOT = 'https://www.bungie.net/Platform';

async function bungieFetch(path, { apiKey, accessToken, method = 'GET', body, params } = {}) {
  if (!apiKey) throw new Error('Bungie API key is required');
  const url = new URL(path, API_ROOT);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers = {
    'X-API-Key': apiKey,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const options = { method, headers };
  if (body !== undefined && body !== null) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url.toString(), options);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = json?.Message || response.statusText || 'Unknown error';
    throw new Error(`Bungie request failed (${response.status}): ${detail}`);
  }
  if (!json || json.ErrorCode !== 1) {
    const detail = json?.Message || 'Unknown Bungie error';
    throw new Error(`Bungie request failed: ${detail}`);
  }
  return json.Response;
}

export async function getProfile(membershipType, membershipId, apiKey, accessToken, componentsCsv) {
  if (!membershipType && membershipType !== 0) {
    throw new Error('membershipType is required');
  }
  if (!membershipId) throw new Error('membershipId is required');
  if (!componentsCsv) throw new Error('componentsCsv is required');
  const params = { components: componentsCsv };
  return bungieFetch(`/Destiny2/${membershipType}/Profile/${membershipId}/`, {
    apiKey,
    accessToken,
    params,
  });
}

export { bungieFetch };
