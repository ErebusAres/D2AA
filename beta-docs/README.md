# D2 Armor Analyzer — Beta Architecture

This beta build fetches real-time Destiny 2 armor directly from Bungie.net without relying on CSV exports or a custom backend. The codebase is split into ES modules so the static page (`/beta.html` within the GitHub Pages project) can load only the features it needs.

## OAuth flow

* **Grant type:** [Implicit Grant Flow](https://bungie-net.github.io/#Implicit-Grant-Flow). The page redirects the user to Bungie, and Bungie returns to `https://erebusares.github.io/D2AA/beta.html` with an access token in the URL hash.
* **Storage:** The token is saved in `sessionStorage` under the key `bungie_access_token`. The hash is immediately stripped from the URL via `history.replaceState`.
* **Expiry:** If Bungie provides `expires_in`, an absolute expiry timestamp is stored. When the token is expired the module clears it and triggers a fresh OAuth redirect.
* **Membership lookup:** After OAuth completes we call `/User/GetMembershipsForCurrentUser/` and use the first `destinyMemberships` entry. The membership ID and type are cached in the in-memory app state.

## Bungie components

`getProfile` loads the components required to render armor rows in a single request:

| Component | Reason |
|-----------|-------|
| `100` Profile | Character enumeration and ownership metadata. |
| `200` Characters | Class type and light level per character. |
| `201` CharacterInventories | Unequipped armor on the active character. |
| `205` CharacterEquipment | Equipped armor on the active character. |
| `102` ProfileInventory | (Reserved for future vault support.) |
| `300` ItemInstances | Per-instance attributes such as power level and energy. |
| `304` ItemStats | Current stat values (mods applied). |
| `305` ItemSockets | Equipped socket plugs. |
| `308` ItemPlugStates | Plug enablement and state flags.

`items-adapter.js` merges these payloads with manifest definitions to build UI-ready rows for the chosen character.

## Computing BASE vs CURRENT stats

`armor-stats.js` handles the heavy lifting:

1. Collect the **current** six core armor stats straight from the ItemStats component.
2. Inspect each socket’s equipped plug. Plugs are classified by `plugCategoryIdentifier`:
   * `enhancements.artifice` / `.stat` → artifice (+3) mods.
   * Identifiers containing `masterwork` → masterwork stat plugs.
   * Everything else → regular armor stat mods.
3. Sum the investment stats from every equipped plug, ensuring `{socketIndex, plugHash}` is only counted once.
4. If the item is masterworked (energy capacity 10 or explicit `isMasterwork`) **and** no masterwork plug was detected, apply a fallback of +2 to each stat so the subtraction stays accurate.
5. Compute BASE as `CURRENT − mods − artifice − masterwork − fallback`, clamping at 0. Totals are recalculated for both blocks.

The function returns `{ base, current, breakdown }` so the UI can show Base or Current totals without recomputing manifest data.

## UI rendering

`ui-render.js` renders the armor table inside `<div id="app"></div>`:

* Columns: Item, Slot/Type, Rarity, Power, Total, and the six core stats.
* Stat cells show numeric values plus progress bars (maxed at 42).
* A “Base / Current” toggle switches the displayed stat block; the underlying data remains untouched.

## App state

`state.js` exposes a tiny observable store. We use it to cache:

* OAuth token metadata.
* Selected membership + character.
* Stat display preference (Base vs Current).
* Future filters or sorting preferences.

## Limitations & next steps

* Only a single character (default: most recently played) is displayed. Character and vault selectors are planned for follow-up work.
* Sorting and filtering mirror the legacy CSV layout but are not yet interactive.
* DIM Sync is intentionally omitted in this pass — the beta focuses solely on Bungie OAuth + data endpoints.
* Manifest requests are performed per plug as items load. A batching layer may be added later if this proves too chatty.
* Error handling favors console diagnostics for now; production builds should surface more user-friendly status messages.
