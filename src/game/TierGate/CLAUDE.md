# TierGate

The **monthly tier-gate engine** (#232). The headline goal object is the
multi-dimensional monthly tier GATE — units + gross + cash + CSI (+ facility,
dormant) — whose binding constraint shifts as you climb (`macro-loop-spine.md`
§10). Locked design: `docs/planning/goals-targets-design.md`. Surfaced by the
Home gate-progress strip (S3b, #232's downstream presentation slice); this
module is the engine, with a minimal live tracer on the Home dashboard.

Honors the three goals-targets decisions: the day is **counted, not judged**
(daily haul accrues onto the monthly bars — decision 1); the engine computes
honest pace/projection and the **player** reads the bottleneck (decision 2, no
coach); each face renders in its **native idiom** (decision 3).

## Public API (`index.ts`)
- `createTierGate({ bus, getCurrentDay, getCurrentTier, signals, config?, daysPerMonth? })` → `TierGate`.
  - `signals` — provider closures for the non-flow faces, keyed by face id
    (`{ cash: () => economy.cash, csi: () => reputation.reviewScore }`). Sampled
    nightly; the engine never imports Economy/Reputation.
  - `config?` — test seam; defaults to `loadTierGateConfig()`.
  - `daysPerMonth?` — defaults to `tunables.clock.daysPerMonth` (30).
- `TierGate`:
  - `getProgress() → GateProgress` — the live multi-face readout. Per active
    face (selected by `config.tiers[tier]`), in its native idiom:
    - **flow** (`units`, `gross`): `current`/`target`, `projectedLanding`,
      `onPaceRateNeeded` (per remaining day), `toCatchUp`, `expectedByNow`,
      `cushion`, `onPace`. Over pace ⇒ read the cushion + projection, never
      "0 needed".
    - **level** (`cash`): `currentLevel`, `avgLevel` (gauge needle), `threshold`,
      `trend` arrow, `meetsThreshold`. No catch-up — a balance isn't a flow.
    - **trend** (`csi`): `rollingAvg`, `threshold`, `trend`
      (climbing/flat/sliding), `meetsThreshold`.
  - `snapshot()/restore()` — module-owned `schemaVersion`; round-trips the
    in-progress month (#188 world seam).
- `createDefaultTierGateSnapshot()` — behavior-neutral fresh-month default (the
  #196 migration default for pre-gate saves).
- Types: `TierGate`, `GateProgress`, `FaceProgress` (+ `Flow`/`Level`/`Trend`
  variants), `GateMonthVerdict`, `FaceVerdict`, `GateBand`, `GateTrend`,
  `TierGateConfig`, `TierGateSnapshot`, …

## Faces & active set
Five semantic face ids; their kinds/labels/targets/active-per-tier are all data
(`data/tier-gate.json`). The **active faces for a tier** = the keys of
`tiers[tier]` (progressive unlock — fewer lit early, decision 2: T1 units+cash,
T2 adds gross, T3 adds csi). Accumulators run every month regardless; activeness
only selects what `getProgress`/the verdict surface. **Facility** (stepped) is
dormant in v1 — its image-standard teeth re-home onto the T4+ OEM stream
(decision 4); schema present, no v1 tier activates it.

## Events
- **Emits:** `tierGate:month_verdict` — the single 4-band verdict
  (Exceed/Meet/Near-miss/Miss) fired once on `clock:month_ended`. `overall` is
  the **worst active face** (the gate is multi-dimensional; the binding
  constraint grades the month). Carries per-face `{ id, band, ratio }`. This is
  where confetti/bonus/escalation hang — never daily.
- **Consumes:** `deal:closed` (flow accrual — units = count, gross = front+back),
  `clock:day_ended` (nightly level/trend sampling), `clock:month_ended` (verdict
  + month reset).

## Determinism & persistence
State is month-to-date accruals + rolling samples only; targets and every
projection derive live from `(getCurrentDay, getCurrentTier, signals)`. The
verdict is a pure function of the month's accrued `deal:closed` events + nightly
samples, so it is **replay-safe** (#122) and the snapshot round-trips an
in-progress month exactly. Sampling rides `clock:day_ended` (once/day, before
`clock:month_ended` in the same `advanceDay`) so the final day is counted before
the verdict, then the month resets.

## Data
- `data/tier-gate.json` — `trendWindowDays`, `trendEpsilon`, `levelTrendEpsilon`,
  `bands` (exceed/meet/nearMiss ratio thresholds), `faces` (id → kind+label),
  `tiers` (tier → { faceId → target }). All magnitudes are first-pass; **numbers
  tune last**.

## Scope notes
- v1 = T1–T3 (units/gross/cash/csi progressively). OEM stair-step second stream
  (T4) + multi-store digest (T6) are out of scope (decisions 4/5). The 4-band
  visual celebration polish lands with S3b.
