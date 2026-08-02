# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 5 — C3 playtest gate (#74), round 1 — HITL**

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **Phase 5 (#74) is waiting on the user.** Script written
  (`docs/planning/playtest-round-1.md`) and now presented in-game day by day (#332/#333), so
  playing costs one tap per reaction and the export carries the script trace, probe answers,
  flags and deal/walk tables. **Unblocked by:** the user playing Session A (5 days, fresh T1)
  + Session B (3 days, T2 fixture) on device, exporting DEV → PLAYTEST LOG → Export, and
  answering the 12-question sheet at a keyboard. Nothing agent-side can advance it — no
  autonomous runtime surface for the GUI (see `.claude/skills/verify`).
- **While it waits, `/next` works phase 5b** (#341 → #342) — phase 5a closed 2026-08-01. Real
  filed work, independent of the playtest. #338 landed, so the `/verify` BLOCKED ceiling is
  gone — a UI slice is now driven live on the web target (`.claude/skills/verify`). 5b does not
  substitute for the playtest — the felt questions stay a human gate.
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work was #343/#344/#345, all three now built.)
- **After 5b there is no agent-side work left before the playtest.** Phases 6 and 7 both open
  with a gate (`/decide C1`, then A2), so the next `/next` after #342 is a DECIDE, not a BUILD.

## Phase table

Status: `pending` → `active` → `done`. "Decision first" = a DECIDE unit must run before
slicing/building that phase (the doc's `[NEW]` items, ungrilled designs, and forks —
resolved just-in-time at the phase boundary, never earlier). **Every gate below has a
prepared context row in `.claude/skills/decide/gates.md`** — run `/decide` (or `/decide <gate>`
to jump one early); it loads the gate rather than re-deriving it.

| # | Work (doc section) | Decision first? | Status |
|---|---|---|---|
| 1 | A1 advisor hiring + promotion wiring (#323, #324), + A3 hygiene (close #269, #266, #297) | — | done |
| 2 | A4 silent-system surfacing: #267, #187, #179, manager status card, recovery states, indictment producers | — | done |
| 3 | B1 Reveal ranking + records | — | done |
| 4 | B3 news/adverse-events engine (#176–#179) | — | done |
| 5 | C3 playtest gate (#74), round 1 — HITL | — | active |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341 done → **#342**), surfaced by #335's scan | — | active |
| 6 | C1 staff-teeth | **GRILL (ungrilled core mechanic)** — prep index: `.claude/skills/decide/gates.md` | pending |
| 7 | A2 staff slots / facility scale | **ADJUDICATE [NEW]** | pending |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | pending |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **RESUME parked grill** (fni-mechanics-grill-state.md) | pending |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | pending |
| 11 | B4 drive-the-clock (absorbs #124) | decide bite-unlock schedule while building (spine STILL-OPEN) | pending |
| 12 | F1 onboarding (#213) + F2 + F3 + D3 plain-language pass | **ADJUDICATE [NEW]: F2, F3, D3** | pending |
| 13 | H1 fictional brands (#246) | — | pending |
| 14 | E1 Tier 4 — OEM engine, courtship, NCM, brand archetypes | — | pending |
| 15 | E2 Tier 5 — BDC | **ADJUDICATE fixed-ops-manager fork** | pending |
| 16 | E3 Tier 6 — GM automation + multi-store | — | pending |
| 17 | E4 Tier 7 — prestige + synergy endgame | — | pending |
| 18 | E5 ladder-wide gate/pacing verification | — | pending |
| 19 | G1 audio/haptics + G2 motion pass | **DECIDE G1 direction; ADJUDICATE [NEW]: G1, G2** | pending |
| 20 | G3 visual completion (#252, icon/splash/store) + D4 a11y (#268) | — | pending |
| 21 | G4 performance/device pass | **ADJUDICATE [NEW]** | pending |
| 22 | H2–H5 ship gates: docs, QA capstones, store readiness, final calibration + playtest | — | pending |

## Log

Newest 3 only. Older entries: `docs/planning/build-state-archive.md`.

- 2026-08-01 — **BUILT #341** (route the `data/loadJson` reach-ins through the data barrel),
  first of phase 5b. 25 files, one import line each: `../data/loadJson` → `../data`,
  `./game/data/loadJson` → `./game/data`. Allow-list regenerated. 199 suites / 2467 tests green,
  typecheck clean — **the same counts as before the change**, which is the whole proof: this was
  an import-path change and nothing else, so a moved number would have been the finding.
  **The clerical half of the boundary debt is gone.** The allow-list went **81 reach-ins / 71
  files → 56 / 47**, and `parseData` no longer appears in it at all. `parseData` was already on
  `src/game/data/index.ts`, so there was no public-surface question to answer — the only real
  check was that importing the barrel doesn't drag in work these config modules didn't ask for.
  It doesn't: `data/index.ts` re-exports `loadJson` plus `tunables`, and `tunables.ts` is schema
  declarations and a loader *function* — no import-time file read, and it imports nothing but
  `zod` and its sibling, so no cycle back through a game module.
  **#342's fourth acceptance criterion is now known to be wrong, and that is recorded on the
  issue itself** (comment, not just here). It expects an *empty* allow-list once the Rng class
  is also cleared. Of the 56 that remain, **34 are `NPC/Rng`** — #342's real scope — and **22 are
  a third class nobody had enumerated**: `EventBus/events.ts` → `CompetitorMarket/Competitor`,
  `EndCard/types`, `MarketEconomy/schemas`; `StaffOrg` → `NPC/StaffTaxonomy`, `NPC/factories/*`,
  `NPC/schemas/*`; and test-side reach-ins into `NPC/schemas/*`, `Inventory/auctionGenerator`,
  `CompetitorMarket/schemas/brand`, `StaffOrg/types`. Each is its own public-surface question, so
  the allow-list file survives #342 rather than being deleted by it. Read #342's criterion as
  "zero `NPC/Rng` entries remain."
  `.claude/hooks/README.md` was the one doc carrying a stale count and a now-dead class; it now
  states 56/47 and names the residual third class, so the next reader of the hook docs isn't
  told to go fix 35 imports that no longer exist.
  Next /next BUILDs **#342** — which opens with an internal fork (re-export `Rng` from NPC's
  barrel vs. give it its own `src/game/Rng/` module). That fork is the implementing agent's call,
  not a director gate, per the issue. **#342 is the last agent-side work before the #74 playtest.**
- 2026-08-01 — **BUILT #345** (Bayesian search loop), slice C of #339 — **phase 5a is done.**
  New `gp.ts` / `search.ts` / `study.ts` / `evaluator.ts` / `applyTuning.ts` + CLI modes
  `search` (E) and `apply` (F) + `tests/balanceHarness.search.test.ts` (26 tests); 199 suites /
  2467 tests green, typecheck clean, no module-boundary violations, `data/**` byte-unchanged.
  **"Never compare a cheap score to a full one" is enforced inside the optimizer, not only in
  the report.** The GP takes **per-observation noise** scaled by `fullSeeds / seedCount`, so a
  subset score is modelled as a noisier estimate of the same quantity rather than trusted as an
  equal. Two more guards ride on top: every row states its seed count, and if a screened
  candidate is still top-ranked when the budget ends it is **promoted to the full spread before
  the study names a best** — a recommendation is never a cheap score. Asserted both ways.
  **`apply` edits the character span of the target value, not the file.** `JSON.stringify` on
  `data/sourcing.json` does not round-trip — the repo's JSON keeps hand-authored one-line objects
  and `1.0` comes back as `1` — so reserializing would bury a two-number tuning in a
  thousand-line diff and silently reformat everything else. The test asserts the file has the
  same line count afterwards and that exactly the tuned lines differ. Two more refusals: no
  `--confirm` → prints the plan, writes nothing, **exits 1** (asserted through a real CLI
  process, the one thing here that can't be proven in-process); and disk drifted from the
  study's recorded baseline → refuse, because the reviewed diff is then not the diff that lands.
  **Trial 0 is the incumbent** — today's `data/**` on the full seed spread. Every proposal is
  ranked against a measured score for the current game, which is also what gives the report's
  diff a baseline that was actually run rather than assumed.
  The synthetic evaluator in the test **goes through `applyCandidate` and reads back through the
  live registry** before restoring. A stub scoring the candidate object directly would have
  passed every assertion while proving nothing about whether the search moves the values it
  claims to, or puts them back.
  Also: `overrides.ts`'s registry now carries each file's disk path explicitly (a naming
  convention is a poor thing to stand between a proposal and the file it edits); `seeds.ts`
  gained `createHarnessRng` so the harness keeps exactly **one** reach into the game's RNG
  (the allow-listed deep import); `studies/` is gitignored — `git add -f` a study when it is
  the evidence behind a calibration commit. Recipe doc gained modes E and F.
  Real-run smoke: a 3-dim × 5-trial × 3-seed × 60-day study runs end to end, screens at 1 seed,
  and correctly leaves the baseline on top (no cheap score outranked it).
  Next /next BUILDs **#341** — phase 5b (module-boundary debt), the last agent-side work before
  the #74 playtest gate.
- 2026-08-01 — **BUILT #344** (tunable manifest + multi-file overrides + the frozen-key
  guard), slice B of #339. New `scripts/balance-harness/searchSpace.ts` + `space` CLI mode +
  `tests/balanceHarness.searchSpace.test.ts` (20 tests); 198 suites / 2441 tests green,
  typecheck clean, `data/**` byte-unchanged.
  **The override registry went from 2 files to 9** — `sourcing`, `intel-precision`,
  `bodyshop-demand`, `news-progression-gating`, `service-manager`, `body-shop-manager`,
  `starting-inventory` joined `tier-gate`/`tunables`. `body-shop-manager` was **not** in
  #344's list; leaving it out would have frozen the Tier-3 mirror of numbers whose Service
  twin is searchable, which is an accidental freeze rather than a decision, so it went in.
  The load-bearing property (loaders read the same Node-cached JSON object and none of them
  memoize their parse, so an in-place mutation is live with no disk write) is **asserted per
  file, not assumed**: the test applies a 9-file candidate and reads every value back through
  the real loader. A registry entry that mutates an object nothing reads would pass every
  other test in the file while making the search a silent no-op.
  **Array paths are addressed by identity, not position** — `unlocks[id=auction_data].dailyCost`,
  `slots[category=suv].targetRetail`. A numeric index still resolves, but it would silently
  repoint at a different unlock if the array were reordered, and the manifest is exactly the
  place that must not drift. `positionalPath()` converts a selector back to indices so a
  manifest path can be compared against a structural diff.
  **55 dimensions, and the freeze list is the more interesting half.** Each entry carries a
  one-line why-this-is-a-magnitude-not-a-choice note, and the module header names what is
  deliberately unreachable with reasons: `data/tier-pacing-targets.json` is not even
  registered (the director authors the targets, #343), `tier-gate` `streak` is the campaign
  rule, `inventory.frontlineHoldDays` is locked by #295, `minTier`/copy/`heatGranularity` are
  progression and presentation, `candidateTrials` is generation quality.
  Guard mechanics: a candidate is validated **whole before any of it is applied** (asserted —
  one illegal value in a 2-key candidate leaves both keys untouched), out-of-range is
  **rejected, not clamped**, and the freeze is a byte comparison of all nine files taken
  before/during/after, with the during-diff required to equal exactly the varied manifest
  paths. The `space` report flags a shipped value sitting outside its own declared bound and
  a test asserts there are none today — that state means either the range or the number is
  wrong, and a search would be starting from a point it would itself refuse to propose.
  Recipe doc gained mode D and the "registering a file makes it reachable, not searchable"
  distinction.
  Next /next BUILDs **#345** (GP/EI search loop over this surface) — the last of phase 5a.
