# Balance harness recipe (#247)

A headless, policy-bot simulation harness for stress-testing tier pacing and
calibrating tunables we **cannot reach by playing** — only Tier 1 is
human-playtestable, but the gates for T2+ need to be tuned by feel we don't
have. The harness drives the **real game** (`createWorld` → `DayLoopController`)
with a bot making the managerial decisions, for N in-game days across many
seeds, and reports what the live tunables actually produce.

It measures; it does not judge. The pacing **targets** are the director's to
author (`data/tier-pacing-targets.json`, locked 2026-06-11, design record
`docs/planning/macro-loop-spine.md §12`). The harness only states
observed-vs-target.

## Invocation

```
npm run balance -- <mode> [flags]
```

The harness runs through `tsx` (a dev-only TypeScript runner) — no build step,
no jest. It imports the same game modules the app composes, so it is always
measuring the shipping logic.

### Mode A — pacing (the headline report)

Median / p10 / p90 **days-in-tier** per policy vs the targets.

```
npm run balance -- pacing                       # 100-seed competent run (the acceptance command)
npm run balance -- pacing --policy all --seeds 100 --maxDays 720
```

Flags: `--policy naive|competent|optimal|all` (default `competent`),
`--seeds N` (default 100), `--maxDays N` (default 360), `--baseSeed N`
(default 1), `--out FILE`.

Columns: `reached` (seeds that hit the tier), `advanced` (of those, the ones
that also reached the next tier, so dwell is defined), `p10d/medianMo/p90d`
(dwell quantiles — days, median in game-months, days), `targetMo`, and
`WITHIN/OUT` of the ±`toleranceBand` from the targets file.

### Mode B — sensitivity sweep

Vary one named tunable across a range, hold the seed cohort fixed, report the
pacing delta. The harness mutates the in-memory config object the loaders read
and restores it after — **the data files on disk are never written**.

```
npm run balance -- sweep --tunable tier-gate:tiers.1.units --range 6,12,5 --policy competent --seeds 50
npm run balance -- sweep --tunable tunables:inventory.carrying.insurancePerDay --range 5,25,5
```

`--tunable FILE:dot.path` — `FILE` is `tier-gate` or `tunables`; the path is a
dotted key into that JSON (e.g. `tiers.2.cash`, `floorSim.baseDailyArrivals`).
`--range MIN,MAX,STEPS`. Other flags as mode A (seeds default 30).

### Mode C — calibration time-series (CSV)

Per-day value of a named metric across seeds — for before/after charting of a
tunables change.

```
npm run balance -- calib --metric cash --seeds 10 --maxDays 360 --out cash_before.csv
# (change a tunable, re-run) --out cash_after.csv ; diff/chart the two
```

`--metric cash|lotCount|lotValue|cumUnits|tier|csi`. Wide CSV: one row per day,
one column per seed.

## Determinism

Same flags ⇒ byte-identical output. The seed cohort is derived from `--baseSeed`
via the game's own `deriveSeed`, and the sim is fully seeded — including the
F&I auto-attach RNG, which the composition root (`src/createWorld.ts`) now seeds
per-day off `masterSeed` (previously it fell through to `Math.random`, a
replay-determinism bug; see the #247 note there). Runs are sequential, so
ordering is stable.

## The three reference policies

A `Policy` (`scripts/balance-harness/policies.ts`) makes the four managerial
decisions the issue names — **stocking, hiring, pricing, trade/discount
defaults** — once per MANAGERIAL phase, off the public `World` surface only.

- **naive** — ignores the demand readout. One salesperson, a thin fixed lot
  bought cheapest-first, a slim cash cushion. The floor / worst case.
- **competent** — the reference "good player": tier-scaled lot **matched to the
  observed-demand readout**, a couple salespeople + a UCM (to absorb
  discount escalations), a healthy cushion.
- **optimal** — exploits everything: tier-scaled lot (capped so carrying cost
  doesn't drown it), the full manager bench (GM/UCM/NCM), an
  advertising push, margin pricing, an acquisitive trade policy.

The per-policy **numbers** (lot targets, headcounts, cash buffers) are the bot's
*strategy* and live in `policies.ts` on purpose — a policy *is* its parameters.
Game-balance numbers stay in `data/`.

## Adding a policy

1. In `scripts/balance-harness/policies.ts`, define a `Policy`:
   ```ts
   const myPolicy: Policy = {
     id: 'aggressive',
     tradePolicyMultiplier: 1.2,        // optional createWorld-time defaults
     manage({ world }) {
       // read world.demandShaper.getObservedMix(), world.economy.cash, …
       // act via world.inventory.buyFromAuction / setAskingPrice,
       //          world.staffOrg.hire, world.demandControls.setAdvertisingCampaign
     },
   };
   ```
   Reuse the shared `hireUpTo` / `stockLot` / `demandCategoryPriority` helpers.
2. Append it to the `POLICIES` array. It is now selectable via `--policy
   aggressive` and included in `--policy all`.
3. If it carries one-shot run state (like optimal's ad latch), reset it in
   `resetPolicies()` so each run starts identically.

## What a run records (per seed)

`scripts/balance-harness/runner.ts` → `RunResult`: first day each tier was
reached (off `career:tier_up`), every month-end `tierGate:month_verdict` with
its **binding** (worst-ratio) face, per-day samples (cash / lot / units / tier /
CSI), arrivals, closes, strong-match count, and the end state — `completed`,
`bankrupt` (a hard insolvency throw on the floor the game can't cover), or
`gameover` (a modeled `career:game_over` ending).

## Tier-N dev fixtures (#248)

Human feel-testing of T2+ otherwise means playing up through every tier below
it. The competent policy generates representative mid-game worlds for free:
`gen-fixtures` drives it through the **real** game and, at the first clean
day-boundary it enters each target tier, captures the live `worldSnapshot` into
a committed `SaveState` (`data/fixtures/tier-N.json`).

```
npm run gen:fixtures                 # competent policy → data/fixtures/tier-{2,3}.json
npm run gen:fixtures -- --policy optimal   # capture from a stronger policy (see caveat)
```

- The capture is taken **after** `runDay()` (floor closed, no visit mid-flight)
  — the same boundary the live autosave uses, so a fixture restores exactly like
  any save.
- The fixture is a plain `SaveState` (`{ world, character, masterSeed }`). The
  dev MainMenu (`__DEV__` only, `src/app/devFixtures.ts` → `TIER_FIXTURES`)
  creates a fresh slot, `save()`s the fixture into it, and routes in through the
  **normal** `loadActiveSlotIntoGame` path (migrate + `restoreWorld`). There is
  **no parallel loader**; autosave/slots then work from there.
- **Regenerate when the `worldSnapshot` envelope version bumps** — a stale
  fixture restores an outdated module shape. `tests/tierFixtures.test.ts`
  asserts `tier-2.json` is at `WORLD_SNAPSHOT_VERSION`, so a forgotten
  regeneration fails CI. Regeneration is the one command above.
- **Only reachable tiers are committed.** Under the current *un-tuned* tier-gate
  thresholds the climb to **T3 game-overs before it gets there** — true for both
  competent *and* optimal — so there is no `tier-3.json` yet. Once the #249
  staff-teeth + threshold-tuning pass makes T3 reachable, `npm run gen:fixtures`
  writes it and you add one line to `TIER_FIXTURES`; no other change.
- **Determinism:** a fixed seed (`deriveSeeds(1,1)[0]`) + the policy ⇒
  byte-stable fixtures. The generator never mutates `data/` except the fixture
  files it writes.

## Notes & caveats

- **Pacing targets aren't tuned yet.** Threshold tuning runs *after* the
  staff-teeth pass (#249), since salary drain moves the cash/gross faces. Until
  then expect plenty of `OUT` rows against the current first-pass tunables —
  that gap is exactly the signal the harness exists to surface.
- **`askingPrice` is currently inert** in the deal path (DealEngine doesn't yet
  consume it — see Inventory/CLAUDE.md), so optimal's margin pricing exercises
  the lever but won't move gross until that downstream slice lands.
- **No changes to `src/game`.** The harness consumes existing public seams. The
  only source change #247 made was wiring a seeded `fniRng` in the composition
  root (`src/createWorld.ts`) — a determinism fix, not a new mechanic.
- **Runtime** is ~7 ms / in-game day. A 100-seed × 360-day pacing run is a few
  minutes; reaching the upper tiers (≈9 game-years) needs a much larger
  `--maxDays` and is only meaningful once thresholds are tuned.
- This harness is **multi-day pacing**; the single-day distribution tests
  (#180/#181) ask a different question — keep them separate.
```
