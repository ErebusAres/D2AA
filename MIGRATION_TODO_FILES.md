# D2AA Migration Todo And File Map

Use this as the live scratchpad for what changed, what still needs parity work, and which files are involved.

## Active Repos

- New React app: `C:\Users\corey.brownlee\OneDrive - Cardinal Health\Documents\GitHub\D2AA`
- Archived reference: `C:\Users\corey.brownlee\OneDrive - Cardinal Health\Documents\GitHub\D2AA-archived`
- Do not edit for active work: `C:\Users\corey.brownlee\OneDrive - Cardinal Health\Documents\GitHub\D2AA-2\D2AA`

## Current Visual Reference

- `D2AA-archived\D2AA.html`
- `D2AA-archived\src\styles\ingame.css`
- `D2AA-archived\src\styles\set-bonus-rows.css`
- `D2AA-archived\src\styles\tuning-icons.css`
- `D2AA-archived\src\styles\tier-colors.css`

## In-Progress React Files

- `src/styles/global.css` - page background and main workspace spacing.
- `src/styles/layout.css` - command bar, feed, active filter chip spacing, global shell.
- `src/styles/panels.css` - side options panel, filter controls, display toggles.
- `src/styles/armor-card.css` - armor card, title blocks, stat bars, tooltips, set bonus rows.
- `src/components/ArmorCard.tsx` - archetype, perk rows, card composition.
- `src/components/ArmorStats.tsx` - stat/tuning visual display.
- `src/components/ArmorBadges.tsx` - tags, location/action chip, grade chip.
- `src/components/TagPicker.tsx` - floating React emoji tag picker used by cards and feed rows.
- `src/components/ArmorGrid.tsx` - slot stack grouping.
- `src/components/Header.tsx` - old command bar parity.
  - includes live/manual/syncing status indicator.
- `src/components/ItemFeed.tsx` - right rail latest items, empty states, and icon stat popouts.
- `src/components/ActiveFilterChips.tsx` - React replacement for old `#activeChips` rendering.
- `src/components/CopyItemIdButton.tsx` - React replacement for old `id-copy-patch.js` copy control.
- `src/components/DuplicateCompareModal.tsx` - React replacement for old duplicate compare overlay.
  - includes group-level pull/copy action parity.

## In-Progress Data/API Files

- `src/data/bungieSync.ts` - real Bungie armor row normalization and manifest plug collection.
- `src/data/armorArchetype.ts` - resolves canonical archetype names/icons/descriptions from Bungie plug definitions.
- `src/data/armorBonuses.ts` - resolves set bonus, armor bonus, exotic perk, and catalyst display rows.
- `src/data/armorSetCatalog.ts` - local Armor 3.0 set bonus catalog used when Bungie plugs only provide weak selector/name data.
  - matches only item names and active selector plugs; do not include all reusable selector options or every set resolves to the first catalog entry.
  - prefers Bungie selector icons when active plug metadata exposes them.
- `src/data/armorTuning.ts` - isolates tuning icon/stat presentation.
- `src/data/actions.ts` - Bungie item transfer actions and fallback copy behavior.
  - includes typed duplicate group pull/copy behavior.
- `src/data/bungieApi.ts` - shared Bungie GET/POST helpers.
- `src/data/dimCsv.ts` - dependency-free DIM CSV parser and mapper for local import fallback.
- `src/hooks/useLiveSync.ts` - DIM-inspired background refresh loop for signed-in, visible, online sessions.
- `src/utils/scheduler.ts` - browser-yield helper for long client-side inventory work.
- `vite.config.ts` - Vite production build config; uses relative `base: './'` and stable `assets/app.js` / `assets/app.css` output so branch-root Pages hosting can load the built app.
- `index.html` - Vite dev entry plus a GitHub Pages static fallback loader for committed root `assets/app.js` and `assets/app.css`.

## Next Todo

- Continue visual parity against archived InGame after a browser screenshot pass:
  - compare command bar spacing, card proportions, right feed, and side panel controls at desktop width after the angular/accent-rail and basic-control polish passes.
  - compare mobile wrapping for command bar, cards, feed, and tooltips.
- Verify real synced Bungie rows show:
  - archetype API icon and tooltip.
  - set bonus rows with Bungie API icons.
  - exotic intrinsic/catalyst rows.
  - tuning markers in stat rows.
  - stat calculation titles/tooltip text explaining base source, visible bonus parts, and absolute totals.
  - item feed popouts show the same stat breakdowns and do not clip at desktop/mobile widths.
  - masterwork styling only appears on genuinely masterworked armor after a fresh Bungie sync or cache refresh.
- Verify live sync behavior with a real account:
  - cache should render first.
  - background sync should not overlap manual sync.
  - tab-hidden/offline states should not keep polling.
  - large inventories should not visibly lock the browser while rows normalize.
- Preserve card icon-only controls where practical:
  - tag chips should show compact archived emoji symbols, not words like `Favorite` or `Keep`.
  - tag chips should open the floating React picker, not a native select/dropdown arrow.
  - lock/location/copy controls should stay compact icon chips.
- Preserve tier rail color bands:
  - tier 1-2 active diamonds are all white.
  - tier 3-4 active diamonds are all purple.
  - tier 5 active diamonds are all gold.
- Revisit `src/data/armorSetCatalog.ts` with real inventories if new set names appear or Bungie exposes better official icons/details.
- Revisit masterwork visuals against a real in-game screenshot if provided; current pass uses gold edge/glow treatment instead of the old diagonal stripe overlay.
- Consider whether item ID copy should be hidden behind a debug/display option or remain visible like the archived patch.
- DIM CSV import is implemented as an explicit side-panel fallback; keep Bungie sync as the default live path.
- Run `npm run build` before every push.
- Until GitHub Pages is confirmed to serve the Actions artifact, keep root `assets/app.css` and `assets/app.js` updated after build so branch-root hosting is not blank.
- After Pages deploys, hard-refresh `https://erebusares.github.io/D2AA/` and verify the app renders even if live HTML still contains `/src/main.tsx`.
