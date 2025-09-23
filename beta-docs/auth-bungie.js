const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';
const TOKEN_FUZZ_SECONDS = 30;

function clearStoredTokens() {
  sessionStorage.removeItem('bungie_access_token');
  sessionStorage.removeItem('bungie_access_expires');
  sessionStorage.removeItem('bungie_refresh_token');
  sessionStorage.removeItem('bungie_refresh_expires');
}

function persistTokens(tokens, fallbackRefreshToken, fallbackRefreshExpires) {
  if (!tokens?.access_token) {
    throw new Error('Missing access token from Bungie token response');
  }

  const now = Math.floor(Date.now() / 1000);
  const accessExpiresIn = Number(tokens.expires_in) || 3600;
  const accessExpiresAt = now + Math.max(0, accessExpiresIn - TOKEN_FUZZ_SECONDS);
  sessionStorage.setItem('bungie_access_token', tokens.access_token);
  sessionStorage.setItem('bungie_access_expires', String(accessExpiresAt));

  const refreshToken = tokens.refresh_token ?? fallbackRefreshToken;
  if (refreshToken) {
    sessionStorage.setItem('bungie_refresh_token', refreshToken);
    const refreshExpiresIn =
      tokens.refresh_expires_in !== undefined && tokens.refresh_expires_in !== null
        ? Number(tokens.refresh_expires_in)
        : undefined;
    if (refreshExpiresIn !== undefined && !Number.isNaN(refreshExpiresIn)) {
      const refreshExpiresAt = now + Math.max(0, refreshExpiresIn - TOKEN_FUZZ_SECONDS);
      sessionStorage.setItem('bungie_refresh_expires', String(refreshExpiresAt));
    } else if (fallbackRefreshExpires) {
      sessionStorage.setItem('bungie_refresh_expires', fallbackRefreshExpires);
    }
  } else {
    sessionStorage.removeItem('bungie_refresh_token');
    sessionStorage.removeItem('bungie_refresh_expires');
  }

  return tokens.access_token;
}

function clearAuthParams() {
  const url = new URL(location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('error');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function toErrorMessage(payload, fallback, status) {
  if (payload && typeof payload === 'object') {
    return (
      payload.error_description ||
      payload.error ||
      payload.Message ||
      payload.message ||
      fallback ||
      String(status || '')
    );
  }
  return fallback || String(status || '');
}

async function exchangeTokens(clientId, params, { clientSecret } = {}) {
  const body = new URLSearchParams({ client_id: clientId, ...params });
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      credentials: 'include'
    });
  } catch (err) {
    throw new Error(`Token exchange request failed: ${err?.message || err}`);
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (err) {
      if (!res.ok) {
        const error = new Error(
          `Token exchange failed (${res.status}): ${text.slice(0, 200)}`
        );
        error.status = res.status;
        throw error;
      }
      throw new Error('Token exchange response was not valid JSON');
    }
  }

  if (!res.ok) {
    const message = toErrorMessage(payload, text, res.status);
    const error = new Error(`Token exchange failed (${res.status}): ${message}`);
    error.status = res.status;
    throw error;
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Token exchange returned an empty response');
  }

  return payload;
}

export async function ensureBungieLogin({
  clientId,
  clientSecret,
  redirectUri,
  authorizeUrl
}) {
  const now = Math.floor(Date.now() / 1000);
  const storedAccess = sessionStorage.getItem('bungie_access_token');
  const storedAccessExp = Number(sessionStorage.getItem('bungie_access_expires'));
  if (storedAccess && Number.isFinite(storedAccessExp) && now < storedAccessExp) {
    return storedAccess;
  }

  const storedRefresh = sessionStorage.getItem('bungie_refresh_token');
  const storedRefreshExp = sessionStorage.getItem('bungie_refresh_expires');
  const refreshExp = Number(storedRefreshExp);
  if (storedRefresh && Number.isFinite(refreshExp) && now < refreshExp) {
    try {
      const tokens = await exchangeTokens(clientId, {
        grant_type: 'refresh_token',
        refresh_token: storedRefresh
      }, { clientSecret });
      return persistTokens(tokens, storedRefresh, storedRefreshExp);
    } catch (err) {
      clearStoredTokens();
    }
  }

  const params = new URLSearchParams(location.search);
  const error = params.get('error');
  if (error) {
    clearAuthParams();
    throw new Error(`Bungie login failed: ${error}`);
  }

  const code = params.get('code');
  if (code) {
    try {
      const tokens = await exchangeTokens(
        clientId,
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        },
        { clientSecret }
      );
      const accessToken = persistTokens(tokens);
      clearAuthParams();
      return accessToken;
    } catch (err) {
      clearStoredTokens();
      clearAuthParams();
      throw err;
    }
  }

  clearStoredTokens();
  const auth = new URL(authorizeUrl);
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('redirect_uri', redirectUri);
  location.assign(auth.toString());
  return new Promise(() => {});
}

export async function getMembership(apiKey, accessToken) {
  const res = await fetch('https://www.bungie.net/Platform/User/GetMembershipsForCurrentUser/', {
    headers: {
      'X-API-Key': apiKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    throw new Error(`Membership lookup failed: ${res.status}`);
  }
  const json = await res.json();
  const dm = json?.Response?.destinyMemberships?.[0];
  if (!dm) {
    throw new Error('No Destiny memberships');
  }
  return { membershipId: dm.membershipId, membershipType: dm.membershipType };
}
