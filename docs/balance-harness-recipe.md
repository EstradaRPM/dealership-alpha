# Balance harness recipe (#247)

> **DON'T INVESTIGATE THE HARNESS BANKRUPTING BEFORE T2. IT IS EXPECTED PRE-#249
> AND PRE-EXISTING.** Confirmed 2026-06-24 by instrumenting the fixture seed
> (competent): the bot **misses the tier-gate verdict every month (m1–m4)** AND
> cash bleeds **negative by ~day 125** → `career:bankruptcy_terminal` →
> game-over at **tier 1** (`reason=bankruptcy`, `final cash≈-1813`). Two
> compounding failures, both from un-tuned numbers: the gate thresholds are
> un-tuned, and the bot policies carry more overhead (competent = 2 salespeople
> + a UCM; optimal adds a GM) than the un-tuned early-game gross supports — **the
> bots are un-tuned strategies too**. Tuned in the **#249 staff-teeth +
> threshold pass**. Human T1 play being trivially easy is *not* a contradiction:
> a lean human stays cash-positive; the over-hiring bot bankrupts.
>
> **TRAP: the pacing report's "bankruptcy rate" is misleading.** It counts only
> `endedReason==='bankrupt'`, which the runner sets *only* for the hard
> mid-floor insolvency *throw*. A **modeled** bankruptcy
> (`career:bankruptcy_terminal` → `career:game_over`) is filed as **`gameover`**,
> so "bankruptcy rate: 0%" can coexist with most seeds bankrupting. Don't read
> "0%" as "solvent."
>
> **Read the `FAILED:` line instead (#343).** The report now prints an honest
> per-run verdict above the tier table. `bankrupt:`/`completed=` remain as
> end-state bookkeeping and still under-report ruin — a run can survive to
> `maxDays`, be counted `completed`, and have missed the gate every graded month.
> `FAILED:` counts five conditions (hard throw, modeled bankruptcy, **cash below
> zero on any sampled day**, three consecutive `miss` verdicts, and any forced
> contraction), reports the **earliest** day the run went wrong, and splits the
> cohort by cause. On a 5-seed × 200-day competent cohort the old view reads
> "bankrupt 60%, completed=2" while the honest verdict is **100% failed, median
> day 120, all five on the miss streak**.
>
> **"optimal" is anti-optimal** — most overhead, and its one differentiator,
> margin pricing, is a no-op (`askingPrice` inert in the deal path; see caveats).
> Only re-open this if it stops being a clean-tree pre-existing fact (a recent
> change moved the day-125 ending earlier, or sales stop closing —
> `closes`/`deal:closed`).

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

Modes: `pacing` (A) · `sweep` (B) · `calib` (C) · `space` (D — the searchable
tunable manifest) · `search` (E — Bayesian optimization over it) · `apply`
(F — the one command that writes `data/**`).
The harness runs through `tsx` (a dev-only TypeScript runner)
— no build step, no jest. It imports the same game modules the app composes, so it is always
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

#### The honest verdict block (`scoring.ts`, #343)

Above the tier table the report prints a `FAILED:` line and **four terms kept
separate on purpose**. `scripts/balance-harness/scoring.ts` owns all of it.

- **Failure** is any of: hard insolvency throw, modeled bankruptcy, **cash below
  zero on any sampled day** (dates ruin earlier and more honestly than the
  terminal event does), `SUSTAINED_MISS_MONTHS` consecutive `miss` verdicts
  (`nearMiss` is progress and resets the streak), or a forced contraction. The
  reported day is the **earliest** condition that fired; the cohort is split by
  cause.
- **The four terms** — survival day, tier reached, month-verdict pass rate,
  time-to-tier fit — are never pre-blended in a report.
- **`tierFit` is smooth, not a threshold**: 1.0 on target, exactly 0.5 at the
  tolerance-band edge, decaying strictly monotonically forever after. A binary
  WITHIN/OUT flag would hand #345's optimizer zero gradient over exactly the
  region the un-tuned tunables sit in today.
- **`searchScore` is a search signal only.** It exists so #345 has one direction
  to climb; every printer that shows it shows all four terms first. Never accept
  a config on the blend alone.

### Mode B — sensitivity sweep

Vary one named tunable across a range, hold the seed cohort fixed, report the
pacing delta. The harness mutates the in-memory config object the loaders read
and restores it after — **the data files on disk are never written**.

```
npm run balance -- sweep --tunable tier-gate:tiers.1.units --range 6,12,5 --policy competent --seeds 50
npm run balance -- sweep --tunable tunables:inventory.carrying.insurancePerDay --range 5,25,5
```

`--tunable FILE:dot.path` — `FILE` is any file registered in `overrides.ts`
(`knownFiles()`: `tier-gate`, `tunables`, `sourcing`, `intel-precision`,
`bodyshop-demand`, `news-progression-gating`, `service-manager`,
`body-shop-manager`, `starting-inventory`); the path is a dotted key into that
JSON (e.g. `tiers.2.cash`, `floorSim.baseDailyArrivals`). A path segment may
select an array element by field — `unlocks[id=auction_data].dailyCost`,
`slots[category=suv].targetRetail` — which keeps pointing at the right entry if
the array is reordered, as a numeric index silently would not.
`--range MIN,MAX,STEPS`. Other flags as mode A (seeds default 30).

**Registering a file makes it reachable, not searchable.** What a search may vary
is the manifest below; a sweep is a hand-driven tool and can still name any
registered path.

### Mode C — calibration time-series (CSV)

Per-day value of a named metric across seeds — for before/after charting of a
tunables change.

```
npm run balance -- calib --metric cash --seeds 10 --maxDays 360 --out cash_before.csv
# (change a tunable, re-run) --out cash_after.csv ; diff/chart the two
```

`--metric cash|lotCount|lotValue|cumUnits|tier|csi`. Wide CSV: one row per day,
one column per seed.

### Mode D — space (the tunable manifest, #344)

The declared surface a balance search is allowed to touch, and the guard that
keeps it there. `scripts/balance-harness/searchSpace.ts` owns it.

```
npm run balance -- space          # every dimension, its bound, its current value in data/**
```

Each dimension names a registered file, a path, a numeric `range` (min/max/step)
**or** a discrete `values` set, and one line on why that key is a *magnitude
someone guessed* rather than a *choice someone made*. **Every key not listed is
frozen** — `tests/balanceHarness.searchSpace.test.ts` serializes all nine
registered files before, during, and after a candidate and asserts the diff names
exactly the manifest paths the candidate varied, and nothing else.

- **The manifest lives in the harness, not `data/`.** `data/**` is game content
  read by schema-validated loaders; this is tooling config no game module reads
  — same reasoning that keeps the policy bots' strategy numbers out of `data/`.
- **`data/tier-pacing-targets.json` is not even a registered file.** The pacing
  targets are the director's to author (#343), so no search can reach them.
  Other deliberate freezes, with reasons, are listed in the module's header:
  `tier-gate` `streak` (the campaign rule), `inventory.frontlineHoldDays` (locked
  by #295), `news-progression-gating` `minTier` and copy, `intel-precision`
  `heatGranularity`, `starting-inventory` `candidateTrials`.
- **Out-of-range is rejected, never clamped**, and a candidate is validated whole
  before any of it is applied — a half-applied candidate would leave `data/**` in
  a state no one asked for.
- The report **flags a current value sitting outside its own declared bound**;
  the test asserts there are none, because that state means either the range or
  the shipped number is wrong and a search would start from a point it would
  itself refuse to propose.
- Adding a data file: register it in `overrides.ts` (`FILES`), then add its
  dimensions. The in-place-mutation property has to keep holding — the loaders
  must read the same Node-cached JSON object and must not memoize their parse.
  The test proves it per file by applying a candidate and reading the value back
  through each real loader.

### Mode E — search (Bayesian optimization over the manifest, #345)

The loop that closes A + B: propose a configuration, run the cohort, score it
honestly, learn, propose a better one. `scripts/balance-harness/search.ts` owns
the loop, `gp.ts` the surrogate, `study.ts` the durable record, `evaluator.ts`
the adapter onto the real sim. It exists so the #286 calibration campaign is a
review of ranked candidates instead of a hand-tune of dozens of placeholders.

```
npm run balance -- search --study studies/t1-cash.jsonl \
  --dims gate.t1.units,gate.t1.cash,inventory.carrying.insurancePerDay \
  --trials 60 --seeds 20 --cheapSeeds 5 --maxDays 240
npm run balance -- search --study studies/t1-cash.jsonl --trials 120   # resume, deeper
```

Flags: `--study FILE` (required), `--dims a,b,c|all` (default `all`), `--trials N`
(total trial records, default 40), `--initial N` (initial-design size),
`--seeds N` (default 20), `--cheapSeeds N` (screen subset, default ¼ of seeds),
plus `--policy` / `--maxDays` / `--baseSeed` / `--out` as elsewhere.

- **Pick a subset with `--dims`.** All 55 dimensions at a budget of tens of
  evaluations is not a search, it is sampling. A focused study over the handful
  of numbers a pacing report implicates converges; the whole manifest does not.
- **Trial 0 is the incumbent** — whatever `data/**` holds today, on the full seed
  spread. Every proposal is ranked against a measured score for the current game,
  and the report's diff has a baseline that was actually run.
- **Adaptive sampling:** a candidate is first screened on the first
  `--cheapSeeds` seeds; only one within `PROMOTION_MARGIN` of the observed best
  earns the full spread, and the refined score replaces the screen. **Every score
  states the seeds behind it** (`seeds=5 (screened)` vs `seeds=20 (full)`) and the
  surrogate treats a cheap score as noisier rather than as an equal. If the
  top-ranked trial is still a screen when the budget runs out, it is promoted
  before the study names a best — **a recommendation is never a cheap score**.
- **The study file is append-only JSONL** — header, then one line per completed
  evaluation, written *before* the next starts. An interrupted study loses at
  most the run in flight; re-invoking with a bigger `--trials` resumes.
- **Resuming refuses rather than mixes.** The header fingerprints the manifest
  and records the cohort config; a changed bound, a renamed dimension, or a
  different seed cohort throws with the difference named. Trials scored under
  different bounds were never measuring the same thing.
- The report ranks candidates with the four #343 terms **and never the blend
  alone**, plus a `file:path current → proposed` line per varied key.
- Determinism: same manifest + `--baseSeed` + `--trials` ⇒ the same trial
  sequence.

### Mode F — apply (the only writer of `data/**`)

```
npm run balance -- apply --study studies/t1-cash.jsonl --trial 37            # prints the plan, writes nothing, exits 1
npm run balance -- apply --study studies/t1-cash.jsonl --trial 37 --confirm  # writes
```

- **No auto-apply anywhere.** Search writes its study file and its report; this
  is a separate human step, and without `--confirm` it prints the plan, writes
  nothing, and exits non-zero.
- **It refuses a stale write.** The study recorded what `data/**` held when it
  opened; if disk has moved since (a hand-tune, or an earlier trial from the same
  study already applied), the reviewed diff is not the diff that would land, so
  the write is refused and the study should be re-run.
- **Surgical text edit, not a reserialization.** `applyTuning.ts` scans the raw
  JSON to the exact span of the target value and replaces those characters —
  `JSON.stringify` would reformat the hand-authored one-line objects and turn
  `1.0` into `1`, burying a two-number tuning in a thousand-line diff. Asserted:
  the file has the same line count afterwards and exactly the tuned lines differ.
- Accepted tunings land in **ONE calibration commit** (standing #105 protocol).

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
- **Only reachable tiers are committed, and regeneration is currently broken.**
  Under the current *un-tuned* thresholds the fixture seed **bankrupts at
  day ~125, still at tier 1** (modeled `career:bankruptcy_terminal`, verdict
  missed every month) — so `npm run gen:fixtures` reaches **neither T2 nor T3**,
  warns, and writes nothing (committed fixtures left intact). The existing
  `tier-2.json` is a historical artifact kept alive **by migration, not
  regeneration**: when the worldSnapshot envelope bumps and
  `tests/tierFixtures.test.ts` goes red, migrate the committed fixture — do
  **not** expect `gen:fixtures` to reproduce it until the #249 staff-teeth +
  threshold-tuning pass makes the climb survivable. After #249, `gen:fixtures`
  writes T2/T3 and you add a line to `TIER_FIXTURES`.
- **Determinism:** a fixed seed (`deriveSeeds(1,1)[0]`) + the policy ⇒
  byte-stable fixtures. The generator never mutates `data/` except the fixture
  files it writes.

## Notes & caveats

- **Pacing targets aren't tuned yet.** Threshold tuning runs *after* the
  staff-teeth pass (#249), since salary drain moves the cash/gross faces. Until
  then expect plenty of `OUT` rows against the current first-pass tunables —
  that gap is exactly the signal the harness exists to surface.
- **The first real study will be climbing out of a hole, not fine-tuning.** Under
  the current un-tuned numbers the competent bot bankrupts at ~day 125 still at
  Tier 1, so early candidates differ in *how badly* they fail. That is the signal
  the smooth `tierFit` (#343) exists to preserve — do not read a low absolute
  score as a broken search.
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
