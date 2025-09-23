export async function ensureBungieLogin({ clientId, redirectUri, authorizeUrl }) {
  const now = Math.floor(Date.now() / 1000);
  const token = sessionStorage.getItem('bungie_access_token');
  const exp = Number(sessionStorage.getItem('bungie_access_expires'));
  if (token && exp && now < exp) {
    return token;
  }

  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in'));
  if (accessToken) {
    sessionStorage.setItem('bungie_access_token', accessToken);
    sessionStorage.setItem('bungie_access_expires', String(now + (expiresIn || 3600) - 30));
    history.replaceState(null, '', location.pathname + location.search);
    return accessToken;
  }

  const auth = new URL(authorizeUrl);
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('response_type', 'token');
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
