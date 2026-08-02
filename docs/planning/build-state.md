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
- **Phase 5b is done** (#341, #342) — as is 5a. **There is no agent-side work left before the
  playtest.** Phases 6 and 7 both open with a gate, so the next `/next` is a DECIDE (`/decide C1`,
  the staff-teeth grill), not a BUILD.
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work was #343/#344/#345, all three now built.)
- **The seeded-RNG separator is a NUL byte, and it is invisible.** `deriveSeed` joins namespace
  and ctx with U+0000. #342 nearly shipped a whole-game determinism break by retyping that line
  with a space. `tests/Rng.test.ts` carries the regression lock that caught it — never weaken it.

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
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
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

- 2026-08-01 — **BUILT #342** (seeded RNG gets its own module) — **phase 5b is done, and with
  it every agent-side item before the #74 playtest.**
  **The fork went to a new module, not a re-export.** `src/game/NPC/Rng.ts` → `src/game/Rng/`
  (`Rng.ts` + a two-line barrel + `CLAUDE.md`), 34 import lines rewritten. Re-exporting from
  NPC's barrel was the one-line option and it is the wrong one: it would make determinism part
  of NPC's *public promise*, a claim about NPC that isn't true, and it would leave `Inventory →
  NPC`, `Weather → NPC`, `PartsInventory → NPC` as dependencies that exist for no domain reason.
  Sixteen modules plus `createWorld` plus the harness draw from it — that is infrastructure, in
  the same class as `data/`. `tests/Rng.test.ts` now asserts **both** directions: the two
  functions are on the Rng barrel, and they are still *absent* from NPC's.
  **The move nearly broke every stream in the game, and the catch is the story.** `deriveSeed`
  joins namespace and ctx with a **literal NUL (U+0000)** — invisible in an editor, rendered as
  a space by the file-read path, and therefore silently retyped as a space when the file was
  copied to its new home. Ten suites went red: `deriveSeed(12345, 'customer', {day:1,slot:0})`
  came back `2170378250` instead of `3789376038`. Every seed in the game had moved. **The only
  thing standing between that and a commit was the regression lock** — a single hard-coded
  expected seed, exactly the kind of assertion that looks redundant next to the
  same-input-same-output tests around it. It is now commented at the call site with why the
  byte is load-bearing (collision-proofing *and* fixture compatibility) and how to re-verify.
  Two-sided proof that determinism survived: the code in `Rng.ts` is **byte-identical to the
  pre-move original** apart from that comment, and a 5-seed × 150-day competent pacing run
  captured **before** the move is `cmp`-identical to the same run after. `data/**` untouched,
  so the committed tier fixtures are the same bytes and `tests/tierFixtures.test.ts` is green.
  199 suites / **2469** tests (2467 + the two new barrel assertions), typecheck clean.
  **The allow-list is 81/71 → 22 reach-ins / 13 files**, and both bulk classes are gone (#341
  cleared `parseData`, this cleared `NPC/Rng`). It does **not** become empty, as #342's fourth
  criterion assumed — the residue is 22 individually-argued one-offs, mostly tests asserting
  against a module's internal Zod schemas. So the file survives as a short list of decisions
  rather than a backlog; `.claude/hooks/README.md` now says that.
  One trap found while cleaning up: `hooks:test`'s "grandfathered reach-in is not blocked" case
  named `createWorld → NPC/Rng`, which this change turned from grandfathered into blocked — the
  selftest would have gone red on a correct repo. It now names a pair that is genuinely in the
  allow-list, with a comment saying the case must be re-pointed whenever a class is cleared.
  `.claude/hooks/selftest.mjs`'s other Rng probes pointed at a path that no longer exists;
  repointed at `NPC/schemas/staff`. ADR-0001 carries an amendment note rather than a rewrite.
  Next /next is **`/decide C1`** (staff-teeth grill) — phase 6. Not a BUILD.
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
