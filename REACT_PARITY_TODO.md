# React Parity TODO

These are remaining user-facing parity items from `D2AA-Archived` that should be ported into React components, hooks, and typed utilities. Do not import the archived DOM patch scripts directly.

## Completed In React

- DIM CSV Import
  - Old reference: `D2AA-Archived/InGame/InGame.html` (`#csvFile`, `#uploadCsvBtn`)
  - React implementation: `src/data/dimCsv.ts`, `src/components/Toolbar.tsx`, `src/hooks/useArmorInventory.ts`
  - Notes: dependency-free local parser, cache restore support, and DIM tag sync into existing tag storage.
- Active Filter Chips
  - Old reference: `D2AA-Archived/InGame/InGame.html` (`#activeChips`)
  - React implementation: `src/components/ActiveFilterChips.tsx`
- Set Bonus Rows
  - Old reference: `D2AA-Archived/InGame/set-bonus-patch.js`
  - React implementation: `src/data/armorBonuses.ts`, `src/data/armorSetCatalog.ts`, `src/components/ArmorCard.tsx`
  - Notes: known Armor 3.0 set bonuses now use a local catalog for correct 2-piece/4-piece names, descriptions, and stable icons when Bungie set plugs are incomplete.
- Item ID Copy / Debug Control
  - Old reference: `D2AA-Archived/InGame/id-copy-patch.js`
  - React implementation: `src/components/CopyItemIdButton.tsx`
- Stat Calculation Display
  - Old reference: `D2AA-Archived/src/app/main.js` (`statModel`, `bonusParts`, `renderTotal`)
  - React implementation: `src/utils/statMath.ts`, `src/components/ArmorStats.tsx`
  - Notes: card stats now show base/current derivation, typed bonus parts, base source, audit warnings, and absolute total text.
- Item Feed Popouts
  - Old reference: `D2AA-Archived/InGame/stable-dom-fixes.js` (`fixFeedStatPopouts`, `renderFeedPopout`)
  - React implementation: `src/components/ItemFeed.tsx`, `src/styles/panels.css`
  - Notes: feed rows now have empty states, tier rails, and hover/focus stat popouts without DOM patching.

## Remaining Parity Checks

- Browser screenshot pass against archived `D2AA.html`.
- Real Bungie account verification for archetype icons, set bonus rows, exotic rows, tuning markers, and transfer actions.
- Decide whether the compare modal should add archived-style bulk "Pull Group".
- Decide whether item ID copy should remain always visible or move behind a debug/display option.
