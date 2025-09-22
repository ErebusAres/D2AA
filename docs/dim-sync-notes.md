# DIM Sync API investigation

## OAuth prerequisites
- A DIM client registers via `POST https://api.destinyitemmanager.com/new_app` with an app id, Bungie API key, and the site's origin to obtain a reusable `dimApiKey`.【F:docs/dim-sync-notes.md†L4-L6】
- Bungie OAuth must be configured with all standard scopes except "Administrate Groups/Clans" before attempting DIM Sync, as shown in DIM's developer tooling.【F:docs/dim-sync-notes.md†L7-L9】
- DIM piggybacks on Bungie authentication: exchange the Bungie access token and membership id for a DIM access token by calling `POST https://api.destinyitemmanager.com/auth/token` with JSON `{ bungieAccessToken, membershipId }`. The server verifies the Bungie token and issues a DIM JWT containing `accessToken` and `expiresInSeconds` (30 days).【F:docs/dim-sync-notes.md†L10-L14】
- Subsequent requests include `Authorization: Bearer <dimAccessToken>` and `X-API-Key: <dimApiKey>`, along with an `X-DIM-Version` identifier mirroring DIM's own implementation.【F:docs/dim-sync-notes.md†L15-L17】

## Profile endpoints and tags
- `GET https://api.destinyitemmanager.com/profile` accepts `platformMembershipId`, `destinyVersion`, and a comma-delimited `components` query (e.g. `tags,hashtags`). It returns `tags` (instanced item annotations), `itemHashTags` (hash-based annotations), optional deletion lists, and a `syncToken` for incremental follow-ups.【F:docs/dim-sync-notes.md†L20-L25】
- `POST https://api.destinyitemmanager.com/profile` accepts batched updates. Actions such as `tag`, `item_hash_tag`, and `tag_cleanup` mutate tags; each payload follows the `ItemAnnotation`/`ItemHashTag` TypeScript shapes that include `id` or `hash`, optional `tag`, `notes`, and `craftedDate` for reshaped items.【F:docs/dim-sync-notes.md†L26-L31】
- DIM Sync exposes additional profile data (loadouts, searches, triumphs, settings) via the same endpoint, but our integration focuses on `tags` and `itemHashTags` for armor annotations.【F:docs/dim-sync-notes.md†L32-L33】

## Token lifecycle
- DIM access tokens do not include a refresh token; clients repeat `POST /auth/token` whenever the cached token expires. DIM stores tokens locally alongside a timestamp (`expiresInSeconds`) to enforce expiry, mirroring the logic in DIM's own helper utilities.【F:docs/dim-sync-notes.md†L36-L39】

## Integration notes for D2 Armor Analyzer (`beta.html`)
- Added a DIM Sync panel that persists the DIM API key, issues DIM tokens via the Bungie session, and disables/enables controls based on token status.【F:beta.html†L72-L108】【F:beta.html†L600-L704】
- Stored DIM config, tokens, and cached profile data in local storage (namespaced with `d2aa_dim_*`) and surfaced their state in the debug snapshot for troubleshooting.【F:beta.html†L302-L467】【F:beta.html†L454-L485】
- Overlayed DIM tags by caching each row's base tag, mapping DIM annotations by instance id/hash, and reapplying them whenever rows load from CSV/Bungie, on membership switches, or after a DIM sync.【F:beta.html†L625-L705】【F:beta.html†L2095-L2175】【F:beta.html†L2510-L2564】
- Auto-syncs DIM tags after successful Bungie loads (when a DIM token exists) and supports manual sync/disconnect flows without disturbing the CSV/Bungie upload workflows.【F:beta.html†L2173-L2235】【F:beta.html†L3090-L3120】
