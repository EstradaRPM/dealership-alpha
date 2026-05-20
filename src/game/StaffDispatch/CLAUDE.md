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
4. `dealEngine.computeAutoFni(effectiveness×100, unlockedRoles, fniRng)` →
   `dealEngine.closeDeal(...)` with the realized price, F&I attaches, and the
   five deal-structuring fields (paymentMethod / downPayment / loanAmount /
   term / apr) derived from the customer's Visit + classified credit tier.
5. Emit `staff:auto_resolved` with `outcome='closed'` and
   `grossImpact = frontGross + backGross` from the DealEngine result.

`staff:auto_resolved` now carries an optional `reason` field on `no_sale`
outcomes (`no_session | not_sales | no_fit | no_close | <WalkCause>`). The
sole `declined` path is an unstaffed floor.

### Required deps for the close
`inventory` (lot snapshot), `dealEngine` (closeDeal + classifyCredit +
computeAutoFni), `creditTiers` (tier policy lookup), `getCustomerSession`
(adapter to CustomerPool — returns `{ bundle, visitArchetypeId }`). Optional:
`fniRng` (defaults Math.random), `unlockedRolesFn` (defaults to deriving
unique role_ids from staffOrg roster), `salesProcessDeps` (configs +
market/cost/book seam overrides).

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
  `inventory:vehicle_sold` fire too.
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
