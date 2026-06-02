# DealEngine

The "close the deal" core: loan math, credit-tier classification, F&I product attach, front/back gross calculation.

## Public API (`index.ts`)
- `createDealEngine()` → `DealEngine`.
- `classifyCredit`, `loadCreditTiers` — credit-score → tier mapping.
- `computeMonthlyPayment` — pure loan-math helper (PMT-style).
- `loadFniProducts` — reads `data/fni-products.json`.
- `generateTradeAsk(currentVehicle, loanPayoff, bookValueFn, seed, config?)` — pure, deterministic (#167). The customer's trade allowance ask: `book × motivatedSellerMultiplier(seed) + max(0, payoff − book)`. The noise multiplier mirrors the auction-side motivated-seller draw (a clipped Box-Muller normal); the negative-equity term floors an underwater owner's ask toward their payoff. `bookValueFn: TradeBookValueFn` reads honest wholesale book from the trade's `CurrentVehicle` — the live MarketEconomy provider satisfies it (CurrentVehicle carries the anchor fields it reads; the composition root adapts the seam). `loadTradeAllowanceNoiseConfig` reads `data/trade-allowance-noise.json`. Trade machinery accrues here (#168–#172).
- `evaluateTrade(input, deps) → TradeEvaluation { action: 'accept'|'counter'|'decline', counterAmount?, rationale }` — pure, deterministic staff decision engine (#168). Reads `bookValueFn`, the salesperson's resolved NEGOTIATE composite (`NegotiationSkill`, mirrors SalesProcess `GateSkill` — defined locally to avoid a SalesProcess→DealEngine cycle), and a UCM `TradeConditionRead | null` (mirrors StaffOrg `ConditionRead`; only `confidence` is read, `null` = no UCM = maximally defensive). `target = book × policyMultiplier × (1 − (1−confidence)·confidencePenaltyFraction)`. ask ≤ target → accept; within `counterWindowFraction` above → counter; far above → counter only if NEGOTIATE effectiveness ≥ `skillCounterThreshold`, else decline. `counterAmount = target + (ask−target)·(1−effectiveness)·counterGiveWeight` — low read-confidence under-pays (defensive), low NEGOTIATE skill over-pays (drifts toward the ask). `policyMultiplier` is the slice-#18 trade-policy seam (default `1.0` = market). `loadTradeEvalConfig` reads `data/trade-evaluation.json`. No flow integration this slice.
- Types: `DealEngine`, `DealEngineDeps`, `CreditTier`, `CreditTierCatalog`, `TierDef`, `LoanParams`, `LoanResult`, `CloseDealParams`, `ClosedDealResult`, `FniProduct`, `FniProductCatalog`, `AttachedFniProduct`, `TradeAllowanceNoiseConfig`, `TradeBookValueFn`, `TradeEvalConfig`, `TradeEvaluation`, `TradeEvalInput`, `TradeEvalDeps`, `TradeAction`, `NegotiationSkill`, `TradeConditionRead`.

## Events
- **Emits:** `deal:closed` (with `agreedPrice`, `frontGross`, `backGross`).
- **Triggers downstream:** `Inventory` removes the vehicle, `Economy` posts revenue, `Reputation` may adjust based on terms.

## Data
- `data/credit-tiers.json` — tier breakpoints + rate adders.
- `data/fni-products.json` — product catalog, costs, presentation flow.

## Realism note
This module follows real F&I conventions (front gross, back gross, reserve, etc.). Don't shortcut the math — the user has deep domain expertise and will catch fudges.
