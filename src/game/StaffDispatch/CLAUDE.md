# StaffDispatch

Auto-resolves Sales queue items using on-duty salespeople. Reads the queue,
picks a staff member, runs the resolution end-to-end through SalesProcess +
DealEngine, posts the outcome.

## Real-close path (#147 tracer)
The dispatch resolver no longer synthesizes a gross — it delegates the close
to the real machinery. Per customer (after exception roll + hold-floor):

1. `pickVehicleForMatch(customer, inventory.getLotVehicles(), { tier })` — pure
   match against the live lot, returning the matched id + want-axis match
   quality (#199). No fit ⇒ `no_sale`/`no_fit`. **The lot is first filtered by
   the #295 frontline-hold (`v.frontlineDay <= day`)**: a unit acquired during
   play (auction buy or customer trade) is held off this walk-in pool until its
   `frontlineDay` so the player gets an interaction window — this is the sole
   enforcement point for the hold (Inventory still lists + carries held units).
2. `resolveSalesProcess(...)` against the matched vehicle, using the
   salesperson's effectiveness/trustworthiness composite via
   `makeSalespersonProfile`. Walk ⇒ `no_sale`/`<WalkCause>`.
3. `closeAndPrice(...)` with the resolved meters + skill + priceSensitivity.
   `outcome !== 'buy'` with a normal closeable price ⇒ `no_sale`/`no_close`.
   If the customer would buy only below the salesperson margin floor
   (`closeable=false`), this becomes the discount-escalation branch (#222,
   reframed to the list-price axis by #281): the `used-car-manager` (the
   used-desk owner, #288) auto-resolves the exception through the same close
   path **only once its `t_o_closing` desking skill clears the gate** (channel-
   desk M3, #290 — the composition root distills the top UCM `t_o_closing` and
   passes the result through `getDiscountDeskingUnlocked`; reframes #288's
   presence gate onto the skill threshold, *acting is earned*). Below the gate
   (or no UCM) a tunable, **rare** fraction of below-floor ups
   (`staffDispatch.discountEscalationRate`, seeded on `(customerId, day)`)
   surface as the interactive event — StaffDispatch emits `discount:escalated`,
   holds the deal, and waits for the composition root's player decision closure.
   The rest simply walk (`no_sale`/`no_close`). The review carries three numbers
   on the list-price axis — our ask (`priceFormation.askingPrice`), the
   customer's target (`reservationPrice`), and the salesperson's **failed
   counter** (`lerp(target, ask, NEGOTIATE-skill)`, clamped `[cost, ask]`,
   tighter to the ask the higher the salesperson's skill). The held-review
   `decide`: `accept_ask` meets the customer at their target (guaranteed close);
   `accept_counter` re-pitches the failed counter and `propose_counter` offers a
   custom price — both roll on gap × price-sensitivity (auto-yes at/below the
   target). Each customer tolerates a bounded number of counter-offers before
   walking — `counterAttempts` scales by agreeableness across
   `[minCounterAttempts, maxCounterAttempts]` with seeded jitter — and every
   rejected counter ("swing and a miss") burns one attempt *and* cools the next
   roll by `missPenalty`. The accept roll is `createRng(seed)() <
   discountAcceptProbability(...)` — an exported **pure** helper (#287) the modal
   reuses to read the customer's price-rigidity off a reactive acceptance-%
   instead of a raw "N offers left" countdown. The held review surfaces
   `counterAttempts` (pip denominator), `priorMisses`, `priceSensitivity`,
   `missPenalty`, and the opening acceptProb of the salesperson's failed counter
   (`salespersonCounterAcceptProb`) so the modal needs no further lookups. A
   rejected counter with attempts left returns `counter_rejected` (`amount`,
   `attemptsRemaining`, and the just-rejected offer's `acceptProb`) and keeps the
   review open;
   exhausting them walks the customer (`no_sale`/`discount_haggle_exhausted`).
   `decline` walks immediately. A `closed` result returns
   `{ soldPrice, frontGross }` for the modal's buy/walk recap.
4. **Trade resolution (#169) + escalation (#170).** If the visit `hasTrade`
   (and the book seam is wired), `resolveTradeIn(...)` runs after the buy
   decision but before structuring, fed the escalation approver
   (`getTradeApprover`, GM > UCM > player) and the per-slot override
   (`getTradeEscalationOverride`). Outcomes:
   - `resolved` (routine *or* manager-approved) → emit `trade:resolved` and net
     `tradeEquity` into the structure (cash: less cash down; finance: smaller
     note); continue to close.
   - `abandoned` → `no_sale`/`trade_negative_equity` (underwater) or
     `no_sale`/`trade_manager_declined` (manager refused at the extended range).
   - `player_review` → emit `trade:escalated` (full overlay payload) and return
     **`escalated`** from the resolver: the deal is HELD for the player (the
     composition root opens the overlay + pauses the floor via the render-loop
     `hold`). No `deal:closed` / `trade:resolved` fires for this customer this
     pass.
     With `onTradeReviewHeld` wired (#201), StaffDispatch also hands the
     composition root a closure that resolves the held close after the player's
     modal decision; accepted asks/counters emit `trade:resolved` and continue
     through the same `deal:closed` / `staff:auto_resolved` path, declined trades
     emit `staff:auto_resolved` with `trade_player_declined`, and rejected player
     counters leave the review open. A `closed` decision returns the settled
     `{ agreedAllowance }` for the modal's honest buy/walk recap (#283).
   No trade / no book seam → closes without a trade.
5. `dealEngine.computeAutoFni(effectiveness×100, unlockedRoles, fniRng)` →
   `dealEngine.closeDeal(...)` with the realized price, F&I attaches, and the
   five deal-structuring fields (paymentMethod / downPayment / loanAmount /
   term / apr) derived from the customer's Visit + classified credit tier, with
   net trade equity subtracted from the financed amount (or cash down).
6. Emit `staff:auto_resolved` with `outcome='closed'`,
   `grossImpact = frontGross + backGross` from the DealEngine result, and
   `matchQuality` from step 1 (#199).

`trade:resolved` (#169) precedes the matching `deal:closed` for that customer.
It carries `staffConfidence` (the UCM condition-read confidence behind the
appraisal) so the downstream acquisition reads the same figure. Inventory
consumes it (#171) to materialize the acquired trade onto the lot
(`acquireFromTrade`) as a non-cash unit — the allowance is offset against deal
cash here, never posted as a separate expense; #169 nets the equity into the
deal structure.

`staff:auto_resolved` now carries an optional `reason` field on `no_sale`
outcomes (`no_session | not_sales | no_fit | no_close | trade_negative_equity |
trade_manager_declined | trade_player_declined | discount_player_declined |
discount_below_cost | <WalkCause>`). A pending `player_review` trade or discount
emits no `staff:auto_resolved` until the player declines or accepts a decision
through the held-review closure. The sole `declined` path is an unstaffed floor.

### Required deps for the close
`inventory` (lot snapshot), `dealEngine` (closeDeal + classifyCredit +
computeAutoFni), `creditTiers` (tier policy lookup), `getCustomerSession`
(adapter to CustomerPool — returns `{ bundle, visitArchetypeId }`). Optional:
`fniRng` (defaults Math.random), `unlockedRolesFn` (defaults to deriving
unique role_ids from staffOrg roster), `salesProcessDeps` (configs +
market/cost/book seam overrides), `tradeBookValueFn` (#169 — honest trade book;
omit to disable trade resolution), `getTradeConditionRead` (#169 — UCM
condition read, defaults `null` ⇒ defensive), `getTradeApprover` (#170 —
escalation approver resolved GM > UCM > player; `null`/omitted ⇒ player
overlay), `getTradeEscalationOverride` (#170 — per-slot "always escalate above
$X"; defaults to the trade-evaluation config default), `getTradePolicyMultiplier`
(#172 — per-slot trade-acquisition policy multiplier passed to `resolveTradeIn`'s
`policyMultiplier`; live getter so a Settings change applies on the next trade;
omitted ⇒ `1.0` market), `onTradeReviewHeld` (#201 — composition-root handoff
for the player decision closure), `onDiscountReviewHeld` (#222 —
composition-root handoff for held discount decisions),
`getDiscountDeskingUnlocked` (#290 — channel-desk M3 discount-desking gate; the
composition root distills the top UCM `t_o_closing` skill vs
`tunables.managerGates.actThresholds.t_o_closing` via `isDiscountDeskingUnlocked`
and returns the boolean live off the roster; omitted ⇒ locked ⇒ the understaffed
path), `getDeskingDrift` (#292 — channel-desk M5; once the desk acts, the top UCM
`t_o_closing` skill + `managerGates.executionDrift.t_o_closing` config drive a
seeded weakening of the desked counter off the salesperson's hold toward the
customer's target — thinner gross, toward worse; omitted/`null` ⇒ no drift, the
desk holds at the salesperson's counter), `getTradeAllowanceDrift` (#292 —
channel-desk M5; the top UCM `condition_reading` skill +
`managerGates.executionDrift.condition_reading` config loosen the appraisal target
off the M4 monotonic-margin baseline via `resolveTradeIn`'s `allowanceDrift`;
omitted/`null` ⇒ no drift). Both drift getters return the skill+config off the
live roster; StaffDispatch derives the per-(customer, day) seed so they're
replay-safe (#122).

### Known gaps
Cash buyers don't carry a stamped behavioral `cashSpendFraction` on the
SalesVisit yet — the matcher defaults to a full-wealth headroom (1.0) so cash
eligibility tracks "can the buyer cover list price" without a behavioral
haircut. Stamping the rolled value on `SalesVisit` is an NPC follow-on.

## Hold-floor model (#134)
Any salesperson on the roster **always works (holds) the up** — there is no
skill-gated decline, so a staffed floor never produces staff-side walks.
Effectiveness × morale governs only whether the held up *closes* now via the
SalesProcess close curve (not a config dial). The dead config
(`baseAutoGross`, `minGrossModifier`, `minCloseRate`, `maxCloseRate`) is gone
with #147.

## Public API (`index.ts`)
- `createStaffDispatch()` → `StaffDispatch`. Legacy once-per-admit path:
  subscribes to `capacity:customer_admitted` and resolves immediately.
- `createStaffFloorDrain()` → `DeptDrain` (the locked #99 per-tick `drain`
  seam FloorSim drives, #101). Per-day instance; each tick pulls up to a
  skill-scaled number of unattempted sales workspace items off the routine
  queue and resolves them via the **same resolver** as the legacy path, so
  the queue drains across ticks with identical outcomes — only the cadence
  differs. Composition wires one path or the other per FloorSim day, never
  both. `escalated` counts dramatic cases the resolver held for the player (a
  trade/discount review); FloorSim only tallies the count (the #103
  forced-exception channel was removed in #275).
- `loadStaffDispatchConfig` — reads dispatch tunables.
- `discountAcceptProbability(customerTargetPrice, counterPrice, priceSensitivity,
  priorMisses, missPenalty)` — pure/deterministic acceptance-prob helper (#287)
  the discount roll delegates to and the modal reuses for its live, number-free
  price-input color. No replay impact.
- `isDiscountDeskingUnlocked(ucmClosingSkill, threshold)` → boolean (#290,
  channel-desk M3). Whether the UCM can *act* on below-floor discounts:
  `ucmClosingSkill != null && ucmClosingSkill >= threshold`. Reframes #288's
  UCM-*presence* gate onto the UCM's `t_o_closing` skill — sibling to
  MarketEconomy's `isAutoPricingUnlocked` (M2). Pure; the composition root
  supplies the top UCM `t_o_closing` skill (roster) + threshold
  (`tunables.managerGates.actThresholds.t_o_closing`).
- Types: `StaffDispatch`, `StaffDispatchDeps`, `StaffDispatchConfig`,
  `StaffDispatchCustomerSession`.

## Events
- **Emits:** `staff:auto_resolved` (outcome `closed` or `no_sale`, with
  `grossImpact`, on `closed` an optional `matchQuality` — the want-axis fit of
  the `pickVehicleForMatch`-selected unit ∈ [0,1], the #199 match-payoff signal
  the floor toast + DayRecap tally threshold — and on `no_sale` an optional
  `reason`). On a successful close
  the resolver delegates to `DealEngine.closeDeal`, so the canonical
  `deal:closed` (with the five deal-structuring fields) and
  `inventory:vehicle_sold` fire too. On a routine/manager-approved trade (#169)
  it emits `trade:resolved` just before `deal:closed`. On a trade escalated to
  the player (#170) it emits `trade:escalated` (full overlay payload) and holds
  the deal (resolver returns `escalated`). On an unstaffed discount exception
  (#222) it emits `discount:escalated` (full overlay payload) and holds the
  deal until the player accepts, counters, or declines.
- **Consumes:** Sales queue items via `DepartmentQueue` (legacy path on
  `capacity:customer_admitted`; floor-drain path per FloorSim tick).

## Data
- `data/tunables.json` — staff-dispatch section (`minDrainPerTick` /
  `maxDrainPerTick` per-tick floor-drain throughput; `discountEvent` (#281) —
  `escalationRate` (rare default fraction of below-floor, unstaffed discounts
  that surface as the interactive buy/walk event), `minCounterAttempts` /
  `maxCounterAttempts` (haggle tolerance range, scaled by agreeableness), and
  `missPenalty` (per-miss acceptance cool-off)).

## Escalation (held reviews only)
The resolver returns `'escalated'` solely for the trade (#170) and discount
(#222) player-review holds — the deal is HELD and surfaced via its own
`trade:escalated` / `discount:escalated` event. The legacy dramatic-case
flag roll (`EXCEPTION_FLAGS` / `exceptionFlagRates` / `gmExceptionFlagRates`
/ `exceptionSkillExp*`) that fed the dead HandPlay event was **removed in
#275**, so those ups now flow through the normal close path instead of being
refused.
