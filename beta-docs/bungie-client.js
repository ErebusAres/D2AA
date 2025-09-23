export async function getProfile(membershipType, membershipId, apiKey, accessToken, componentsCsv) {
  const url = `https://www.bungie.net/Platform/Destiny2/${membershipType}/Profile/${membershipId}/?components=${componentsCsv}`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok) {
    throw new Error(`Bungie Profile failed: ${res.status}`);
  }
  const json = await res.json();
  return json?.Response;
}
