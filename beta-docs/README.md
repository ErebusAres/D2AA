# D2 Armor Analyzer — Beta Modules

This folder hosts the ES module implementation that powers `beta.html`. The beta
experience keeps the CSV workflow from the classic D2 Armor Analyzer while adding
Bungie OAuth login, on-demand inventory pulls, and DIM Sync for tags.

## Module Overview

- **config.js** – Central location for Bungie and DIM API configuration. Update
  the DIM `apiKey` once a DIM app token is provisioned for the production host.
- **auth-bungie.js** – Implements the implicit OAuth flow required for static
  sites and exposes helpers to resolve the user membership.
- **bungie-client.js** – Thin wrapper around the Bungie Profile endpoint.
- **manifest.js** – Cached helper for Manifest lookups (item definitions,
  sockets, plugs).
- **armor-stats.js** – Calculates BASE vs CURRENT armor stats. BASE removes mods,
  artifice plugs, and masterwork bonuses exactly once and applies the fallback
  –2 per stat when a masterworked item is missing a masterwork stat plug.
- **items-adapter.js** – Converts Bungie profile payloads into table rows that
  match the CSV schema while attaching computed stat blocks and metadata.
- **csv-adapter.js** – Parses the DIM `Armor.csv` export, coerces numeric columns
  to numbers, and normalizes the data into the same shape used by the Bungie
  adapter.
- **ranking.js** – Mirrors the original D2AA star-ranking thresholds (Legendary
  totals < 70 are `💩`, 75 → `5★`, etc.).
- **grouping.js** – Ports duplicate grouping logic from the legacy app so base
  totals and top-three stat tolerances match previous behaviour.
- **ui-render.js** – Renders the filters, toolbar, toggle between BASE/CURRENT,
  DIM sync indicators, and the results table with inline tag editing.
- **state.js** – Lightweight global store with subscription support. Maintains
  filters, rows, DIM auth state, and cached CSV data in `localStorage`.
- **utils.js** – Shared constants (icons, filter labels) and helpers
  (normalisation, clipboard, stat colour).
- **dim-sync.js** – Handles exchanging the Bungie token for DIM credentials,
  fetching existing tags, and posting tag updates.

## OAuth & DIM Sync

> **Production DIM API Registration:** The public deployment at
> `https://erebusares.github.io/D2AA/beta.html` is registered with the DIM API
> using the key `0787f112-823b-4864-95bd-8c4caab2a55b`. If the origin or
> hostname changes, provision a new key for the updated origin and replace the
> value in `config.js`.

1. **Bungie Login** – `ensureBungieLogin` stores the access token in
   `sessionStorage` and refreshes when required. `getMembership` resolves the
   primary Destiny membership used for all subsequent calls.
2. **DIM Auth** – After Bungie login, `initDimSync` swaps the Bungie access token
   for a DIM token. When authenticated the DIM status chip in the UI switches to
   `Connected ✓`.
3. **Tag Merge & Save** – `fetchDimProfile` retrieves existing annotations and
   merges them into `appState.dimTagsByInstanceId`. Selecting a new tag per row
   and pressing **Save** posts an `itemAnnotation` update through `applyDimUpdates`.

> **Note:** The provided DIM API bootstrap endpoint currently rejects non-local
> origins. Deployers must register the production origin manually and place the
> resulting `dimApiKey` inside `config.js`.

## BASE vs CURRENT Stats

- BASE stats are computed from Bungie item components by removing enabled socket
  bonuses (mods, artifice) and masterwork bonuses exactly once. Items missing a
  masterwork plug still subtract the fallback +2 per stat if `isMasterwork` is
  true.
- CURRENT stats represent the in-game values (including mods/masterwork) and are
  surfaced through the “Show CURRENT stats” toggle. CSV uploads without explicit
  current values fall back to BASE numbers for the CURRENT view.

## Duplicate Detection & Ranking

Grouping, ranking, and the copy-to-clipboard affordances are identical to the
legacy `D2AA.html` implementation:

- Duplicates are clustered per slot (exotics by name) using the same top-three
  stat comparison with configurable tolerance.
- Rank badges mirror the original thresholds: Legendary totals ≥75 produce `5★`
  while totals <70 show `💩`.
- Clicking a group badge copies all DIM IDs within that duplicate group.

## Extending the Beta UI

`ui-render.js` keeps presentation code isolated from the data adapters. New
columns or filters should patch `ui-render.js` and, if required, augment the row
shape produced by `items-adapter.js` / `csv-adapter.js`. All business logic stays
within this folder while `beta.html` simply boots the app via ES module imports.
