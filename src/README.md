# D2AA live assets

`D2AA.html` is now the canonical app entrypoint. The previous rebuild entrypoint and rebuild-only modules were removed so cleanup work starts from the original working D2AA layout and behavior.

## Runtime files

- `styles/d2aa-live.css` — bundled CSS for the original D2AA UI.
- `live/d2aa-live.js` — bundled JavaScript for the original D2AA app behavior.
- `live/manifest.json` — ordered source-file list used to generate the bundles.
- `live-sources/` — source CSS and JavaScript files used by the bundle script.

The `src/live-sources/` `beta2-*` and `d2aa-*` files are still kept as source-of-truth legacy modules while the app is being consolidated. Edit those source files first, then rebuild the runtime bundles with:

```sh
node scripts/build-live-bundles.mjs
```

This keeps the user-facing page fast and simple without deleting legacy logic that still needs to be preserved or ported.

## Archive

Unused beta pages, older experimental modules, and the previous docs prototype were moved to `archive/legacy-2026-05-15/`. `beta2.html` remains at the repo root as a redirect shim for existing OAuth callbacks and bookmarks.
