# React Parity TODO

These are remaining user-facing parity items from `D2AA-Archived` that should be ported into React components, hooks, and typed utilities. Do not import the archived DOM patch scripts directly.

## DIM CSV Import

- Old reference: `D2AA-Archived/InGame/InGame.html` (`#csvFile`, `#uploadCsvBtn`)
- Old data references: `D2AA-Archived/archive/legacy-2026-05-15/beta-docs/csv-adapter.js`, `D2AA-Archived/archive/old-clean-iterations/src/data/dim-csv.js`
- React target: typed CSV parser utility plus an options-panel upload control wired to `useArmorInventory`.

## Active Filter Chips

- Old reference: `D2AA-Archived/InGame/InGame.html` (`#activeChips`)
- Old style reference: `D2AA-Archived/src/styles/ingame.css` (`.active-chips`)
- React target: `ActiveFilterChips` component derived from `FilterState`, with chip clear actions that update React state.

## Set Bonus Rows

- Old reference: `D2AA-Archived/InGame/set-bonus-patch.js`
- Old style reference: `D2AA-Archived/src/styles/set-bonus-rows.css`
- React target: typed `SetBonusRows` section rendered from normalized armor set bonus data inside `ArmorCard`.

## Item ID Copy / Debug Control

- Old reference: `D2AA-Archived/InGame/id-copy-patch.js`
- React target: small `CopyItemIdButton` inside `ArmorCard`, hidden or subdued unless debugging controls are enabled.
