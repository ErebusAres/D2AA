const TOKEN_URL = 'https://www.bungie.net/Platform/App/OAuth/Token/';

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
  const accessExpiresAt = now + Math.max(0, accessExpiresIn - 30);
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
      const refreshExpiresAt = now + Math.max(0, refreshExpiresIn - 30);
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

async function exchangeTokens(clientId, params) {
  const body = new URLSearchParams({ client_id: clientId, ...params });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  return res.json();
}

export async function ensureBungieLogin({ clientId, redirectUri, authorizeUrl }) {
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
      });
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
    const tokens = await exchangeTokens(clientId, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    });
    const accessToken = persistTokens(tokens);
    clearAuthParams();
    return accessToken;
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
