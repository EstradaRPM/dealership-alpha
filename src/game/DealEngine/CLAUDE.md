# DealEngine

The "close the deal" core: loan math, credit-tier classification, F&I product attach, front/back gross calculation.

## Public API (`index.ts`)
- `createDealEngine()` → `DealEngine`.
- `classifyCredit`, `loadCreditTiers` — credit-score → tier mapping.
- `computeMonthlyPayment` — pure loan-math helper (PMT-style).
- `loadFniProducts` — reads `data/fni-products.json`.
- Types: `DealEngine`, `DealEngineDeps`, `CreditTier`, `CreditTierCatalog`, `TierDef`, `LoanParams`, `LoanResult`, `CloseDealParams`, `ClosedDealResult`, `FniProduct`, `FniProductCatalog`, `AttachedFniProduct`.

## Events
- **Emits:** `deal:closed` (with `agreedPrice`, `frontGross`, `backGross`).
- **Triggers downstream:** `Inventory` removes the vehicle, `Economy` posts revenue, `Reputation` may adjust based on terms.

## Data
- `data/credit-tiers.json` — tier breakpoints + rate adders.
- `data/fni-products.json` — product catalog, costs, presentation flow.

## Realism note
This module follows real F&I conventions (front gross, back gross, reserve, etc.). Don't shortcut the math — the user has deep domain expertise and will catch fudges.
