# D2AA React Migration Changelog

This file tracks migration decisions and larger changes while porting the archived `D2AA.html` / InGame implementation into the React + Vite + TypeScript app.

## 2026-06-16

- Confirmed active new app repo: `C:\Users\corey.brownlee\OneDrive - Cardinal Health\Documents\GitHub\D2AA`.
- Confirmed archived visual/reference repo: `C:\Users\corey.brownlee\OneDrive - Cardinal Health\Documents\GitHub\D2AA-archived`.
- Confirmed duplicate checkout `D2AA-2\D2AA` should not be used for active edits.
- Started visual parity pass against archived `D2AA.html`, `src/styles/ingame.css`, and `src/styles/set-bonus-rows.css`.
- Added migration tracking files:
  - `MIGRATION_CHANGELOG.md`
  - `MIGRATION_TODO_FILES.md`
- Added typed Bungie item action helper and shared POST helper.
- Added typed armor archetype, armor bonus, set bonus, exotic perk, and tuning display utilities.
- Wired Bungie sync to resolve archetype icons/descriptions and armor bonus rows from manifest plug definitions.
- Added audited tuning output for UI-only tuning markers.
- Updated armor card rendering to show old-style archetype tooltip and set-bonus rows with Bungie API icons.
- Updated location badge into a React-driven item action chip for pull/vault/copy behavior.
- Reworked major visual CSS toward archived InGame styling:
  - 59px command bar and feed offsets.
  - Destiny-style rarity title slabs.
  - old tier diamond rail.
  - old card side rail, stat bars, tooltips, and set-bonus rows.
  - old background, summary strip spacing, panel/feed proportions, and palette tokens.
- Verified `npm run build` passes.
- Added React active filter chips with clear actions for search, slot, rarity, sort, duplicate tolerance, and display-only filters.
- Tightened archetype fallback so missing plug metadata still resolves to the six Destiny armor archetype names.
- Reworked card meta controls toward archived InGame behavior:
  - compact SVG lock chip.
  - compact SVG location/action chip.
  - React item ID copy chip.
- Reworked item feed rows toward archived layout with rarity/group left borders, meta chips, grade, and ID copy.
- Verified `npm run build` passes after the second parity pass.

## Prior Completed Migration Work

- React + Vite + TypeScript shell created for static hosting.
- Bungie OAuth return handling and token exchange were wired client-side.
- Runtime mock armor was removed from normal app startup.
- Bungie inventory cache restore/clear behavior was wired into React state.
- Real Bungie inventory sync pipeline was structurally added.
- GitHub Pages build workflow and app root serving were configured.
