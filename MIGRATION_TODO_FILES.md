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
- `src/styles/layout.css` - command bar, summary strip, feed, global shell.
- `src/styles/panels.css` - side options panel, filter controls, display toggles.
- `src/styles/armor-card.css` - armor card, title blocks, stat bars, tooltips, set bonus rows.
- `src/components/ArmorCard.tsx` - archetype, perk rows, card composition.
- `src/components/ArmorStats.tsx` - stat/tuning visual display.
- `src/components/ArmorBadges.tsx` - tags, location/action chip, grade chip.
- `src/components/ArmorGrid.tsx` - slot stack grouping.
- `src/components/Header.tsx` - old command bar parity.
- `src/components/ItemFeed.tsx` - right rail latest items.
- `src/components/ActiveFilterChips.tsx` - React replacement for old `#activeChips` rendering.
- `src/components/CopyItemIdButton.tsx` - React replacement for old `id-copy-patch.js` copy control.
- `src/components/DuplicateCompareModal.tsx` - React replacement for old duplicate compare overlay.

## In-Progress Data/API Files

- `src/data/bungieSync.ts` - real Bungie armor row normalization and manifest plug collection.
- `src/data/armorArchetype.ts` - resolves canonical archetype names/icons/descriptions from Bungie plug definitions.
- `src/data/armorBonuses.ts` - resolves set bonus, armor bonus, exotic perk, and catalyst display rows.
- `src/data/armorTuning.ts` - isolates tuning icon/stat presentation.
- `src/data/actions.ts` - Bungie item transfer actions and fallback copy behavior.
- `src/data/bungieApi.ts` - shared Bungie GET/POST helpers.

## Next Todo

- Continue visual parity against archived InGame after a browser screenshot pass:
  - compare command bar spacing, card proportions, right feed, and side panel controls at desktop width.
  - compare mobile wrapping for command bar, cards, feed, and tooltips.
- Verify real synced Bungie rows show:
  - archetype API icon and tooltip.
  - set bonus rows with Bungie API icons.
  - exotic intrinsic/catalyst rows.
  - tuning markers in stat rows.
- Preserve card icon-only controls where practical:
  - tag chips should show compact symbols, not words like `Favorite` or `Keep`.
  - lock/location/copy controls should stay compact icon chips.
- Preserve tier rail color bands:
  - tier 1-2 active diamonds are all white.
  - tier 3-4 active diamonds are all purple.
  - tier 5 active diamonds are all gold.
- Revisit `src/data/armorBonuses.ts` set selector matching with real inventories if any rows miss expected set bonuses.
- Decide whether compare modal should add the archived bulk "Pull Group" action or stay per-item only.
- Consider whether item ID copy should be hidden behind a debug/display option or remain visible like the archived patch.
- Consider DIM CSV import only as an explicit later feature, not default runtime.
- Run `npm run build` before every push.
