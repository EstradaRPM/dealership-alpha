# StaffDispatch

Auto-resolves Sales queue items using on-duty salespeople. Reads the queue,
picks a staff member, runs the resolution end-to-end through SalesProcess +
DealEngine, posts the outcome.

## Real-close path (#147 tracer)
The dispatch resolver no longer synthesizes a gross — it delegates the close
to the real machinery. Per customer (after exception roll + hold-floor):

1. `pickVehicleFor(customer, inventory.getLotVehicles(), { tier })` — pure
   match against the live lot. No fit ⇒ `no_sale`/`no_fit`.
2. `resolveSalesProcess(...)` against the matched vehicle, using the
   salesperson's effectiveness/trustworthiness composite via
   `makeSalespersonProfile`. Walk ⇒ `no_sale`/`<WalkCause>`.
3. `closeAndPrice(...)` with the resolved meters + skill + priceSensitivity.
   `outcome !== 'buy'` ⇒ `no_sale`/`no_close`.
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
     **`escalated`** from the resolver: the deal is HELD for the player and
     FloorSim raises a grabbable exception. No `deal:closed` / `trade:resolved`
     fires for this customer this pass.
   No trade / no book seam → closes without a trade.
5. `dealEngine.computeAutoFni(effectiveness×100, unlockedRoles, fniRng)` →
   `dealEngine.closeDeal(...)` with the realized price, F&I attaches, and the
   five deal-structuring fields (paymentMethod / downPayment / loanAmount /
   term / apr) derived from the customer's Visit + classified credit tier, with
   net trade equity subtracted from the financed amount (or cash down).
6. Emit `staff:auto_resolved` with `outcome='closed'` and
   `grossImpact = frontGross + backGross` from the DealEngine result.

`trade:resolved` (#169) precedes the matching `deal:closed` for that customer.
The trade-acquisition/economy reconciliation (the dealer paying the allowance,
adding the trade to inventory) is a downstream consumer of `trade:resolved`, a
later slice; #169 only nets the equity into the deal structure.

`staff:auto_resolved` now carries an optional `reason` field on `no_sale`
outcomes (`no_session | not_sales | no_fit | no_close | trade_negative_equity |
trade_manager_declined | <WalkCause>`). A `player_review` trade emits no
`staff:auto_resolved` — it surfaces via `trade:escalated` + an `escalated`
resolver result. The sole `declined` path is an unstaffed floor.

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
$X"; defaults to the trade-evaluation config default).

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
  both. `escalated` counts dramatic cases the resolver refused; FloorSim
  turns each into a grabbable exception ref + `floor:exception_raised` (#103).
- `loadStaffDispatchConfig` — reads dispatch tunables.
- Types: `StaffDispatch`, `StaffDispatchDeps`, `StaffDispatchConfig`,
  `StaffDispatchCustomerSession`, `ExceptionFlag`.

## Events
- **Emits:** `staff:auto_resolved` (outcome `closed` or `no_sale`, with
  `grossImpact` and on `no_sale` an optional `reason`). On a successful close
  the resolver delegates to `DealEngine.closeDeal`, so the canonical
  `deal:closed` (with the five deal-structuring fields) and
  `inventory:vehicle_sold` fire too. On a routine/manager-approved trade (#169)
  it emits `trade:resolved` just before `deal:closed`. On a trade escalated to
  the player (#170) it emits `trade:escalated` (full overlay payload) and holds
  the deal (resolver returns `escalated`).
- **Consumes:** Sales queue items via `DepartmentQueue` (legacy path on
  `capacity:customer_admitted`; floor-drain path per FloorSim tick).

## Data
- `data/tunables.json` — staff-dispatch section (exception thresholds,
  per-tick drain throughput).

## ExceptionFlag
Used to flag deals that auto-resolution refused to handle (e.g. high-value,
low-trust scenarios). Those bubble to the player UI.

## Exception threshold = f(skill × role tier) (#103)
The dramatic-case escalation threshold is the master scaling dial. Each
`exceptionFlagRates` entry is raised to an exponent lerped between
`exceptionSkillExpMin` (at effectiveness 0) and `exceptionSkillExpMax` (at
effectiveness 1) by the best on-roster salesperson's effectiveness. Exponent
≥ 1 ⇒ `rate^exp ≤ rate`, so a more skilled floor escalates fewer/rarer
cases while a guaranteed `1.0` rate stays guaranteed. Selection draws no RNG
and is hoisted above the roll, so the RNG stream is identical to the legacy
order — only the skill-scaled threshold changes outcomes.
