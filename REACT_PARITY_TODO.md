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
  - React implementation: `src/data/armorBonuses.ts`, `src/components/ArmorCard.tsx`
- Item ID Copy / Debug Control
  - Old reference: `D2AA-Archived/InGame/id-copy-patch.js`
  - React implementation: `src/components/CopyItemIdButton.tsx`

## Remaining Parity Checks

- Browser screenshot pass against archived `D2AA.html`.
- Real Bungie account verification for archetype icons, set bonus rows, exotic rows, tuning markers, and transfer actions.
- Decide whether the compare modal should add archived-style bulk "Pull Group".
- Decide whether item ID copy should remain always visible or move behind a debug/display option.
