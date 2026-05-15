# Beta Docs Modules

This directory houses the modular rewrite for the beta Destiny 2 Armor Analyzer proof of concept. The modules separate responsibilities around configuration, state management, Bungie OAuth/profile loading, DIM synchronization, stat math, CSV ingestion, and UI rendering.

## Files

| File | Purpose |
| --- | --- |
| `config.js` | Declares configurable constants (API keys, OAuth scopes, storage keys) and helpers for building Bungie/DIM request headers. |
| `state.js` | Provides a lightweight state container plus helpers for persisting rows and OAuth tokens. |
| `utils.js` | Generic helpers used across modules (numeric coercion, JSON safety, clipboard, token expiry math). |
| `auth-bungie.js` | Implements the Bungie OAuth PKCE-lite flow for the front-end, persisting tokens in `sessionStorage` and handling refresh. |
| `bungie-client.js` | Fetches Bungie profile/character/inventory data for the signed in player. |
| `manifest.js` | Loads and caches the Destiny manifest components required for armor identification/stat math. |
| `armor-stats.js` | Normalizes stat math for both CSV rows and live profile items. |
| `items-adapter.js` | Converts CSV rows or Bungie API items into a unified row shape used by the renderer. |
| `csv-adapter.js` | Wraps PapaParse for CSV ingestion and data cleaning. |
| `dim-sync.js` | Handles DIM API token lifecycle and tag/notes synchronization (best-effort). |
| `ui-render.js` | Builds and updates the DOM, including filters, theme toggle, stat view toggle, and table rendering. |

## Usage

Before loading `beta.html`, set `window.D2AA_CONFIG` with the Bungie API key and client id:

```html
<script>
  window.D2AA_CONFIG = {
    bungieApiKey: 'your-api-key',
    bungieClientId: '12345',
    bungieRedirectUri: 'https://your.domain/beta.html',
    dimBaseUrl: 'https://app.destinyitemmanager.com',
    dimApiEnv: 'prod',
    dimProdApiUrl: 'https://api.destinyitemmanager.com',
    dimDevApiUrl: 'https://dev-api.destinyitemmanager.com',
    dimClientIdProd: 'your-prod-dim-key',
    dimClientIdDev: 'your-dev-dim-key',
  };
</script>
```

The entry module in `beta.html` reads these values, performs the OAuth hand-off when the "Sign in with Bungie" button is pressed, and hydrates the table with either live profile armor or a fallback CSV upload.
