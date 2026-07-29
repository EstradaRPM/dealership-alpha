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
- **While it waits, `/next` works phase 5a** (#334–#340). Real filed work, independent of the
  playtest; #338 removes the `/verify` BLOCKED ceiling every later slice pays. 5a does not
  substitute for the playtest — the felt questions stay a human gate.
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed.

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
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338→#339; see `docs/agent-workflow-notes.md`) | — | active |
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

- 2026-07-29 — BUILT + closed **#340** (phase 5a S2 — the `/decide` skill). Six of the
  seventeen remaining phases can't start until the director rules on something, and opening
  one of those gates has been costing a session of excavation *before* any thinking starts —
  the same activation-cost pathology #332/#333 fixed for the playtest. `.claude/skills/decide/`
  now holds two files. **`SKILL.md`** is the procedure: select one gate (lowest pending
  GRILL/ADJUDICATE row, or the one the user names), load rather than re-derive, then **triage
  every open question into two piles** — internal forks (module ownership, data shape, event
  naming, test seams) the agent decides and reports as one-line calls, and player-facing forks
  the user rules on, presented **one at a time** with plain-language options, `file:line`
  evidence, and a recommendation (`feedback-hitl-single-decision`). Options the agent
  introduced are labelled `[agent-proposed]` in both the presentation and the record so
  nothing gets smuggled into a doc as already-agreed
  (`feedback-no-smuggled-mechanics`); every option must be a complete mechanic, never a
  "simple version" (`feedback-no-half-assed-solutions`). It terminates like `/next` — one gate,
  recorded in the owning doc, phase table flipped, committed — and a deferred fork is recorded
  *as an open fork with what would unblock it*, never left in chat. **The load-bearing half is
  `gates.md`**: a per-gate index of all eight pending gates (C1 staff-teeth, A2 slots, B2 F&I
  resume, B4 bite-unlock, F2/F3/D3, E2 fixed-ops fork, G1/G2, G4) giving each one's scope §,
  the docs to load in order, the LOCKED inputs that must be read but never reopened, and where
  the ruling gets written. Without it the skill would just re-derive the map each time, which
  is the cost being removed. **Only C1 is marked grill-worthy** — the rest are short fork sets
  and the skill explicitly forbids running a grill on one, which is what would otherwise turn a
  three-question adjudication into an hour. `/next`'s DECIDE branch now delegates here instead
  of carrying its own gate logic (selection stays in `/next`, depth lives in `/decide`); phase
  6's table cell and the table preamble point at `gates.md`. Typecheck clean; no source
  touched, so the suite was not re-run. Next /next BUILDs **#335** (hooks for the
  module-boundary convention + the save-envelope re-stamp ritual) — but `/decide` is now live,
  so a `/decide C1` any time unblocks phase 6 ahead of it.
- 2026-07-29 — BUILT + closed **#334** (phase 5a S1 — trim build-state to live state +
  archive the log). This file was **708 lines** and `/next` step 1 read all of it every
  session to recover four live facts; it is now **144** — the issue's "under 120 lines"
  criterion is missed by 24 and deliberately not chased: live state alone (header + phase +
  blockers + the 22-row phase table) is ~65 lines and this repo's log entries run 16–34 lines
  each, so 3 retained entries cannot fit. The alternatives were retaining 2 entries or
  trimming retained text, and trimming is wrong — a retained entry is the exact text that
  later rolls off into the archive. 708 → 144 is the delivered cut. Everything older than the newest 3 log
  entries moved **verbatim** to `docs/planning/build-state-archive.md` (newest first; verified
  as a byte-identical line multiset against the pre-trim file, 581/581, zero diffs) — nothing
  summarized, because the rationale in those entries *is* the record of why decisions were
  made. `/next` step 1 now reads only this file and is told NOT to read the archive; step 5
  gains the **roll rule** (append, then move anything past the newest 3 into the archive with
  its text unchanged). Memory `session-resume.md` held a second copy of the same closeout
  history — free to drift from the repo's — so it is stripped to the hard rules + pointers.
  **Found while starting the unit: #334 was already CLOSED on GitHub ("completed") with no
  work landed** — no archive file, no roll rule, file still at full length. Reopened, done,
  re-closed with a comment recording the false close; the same mismatch may affect
  #335–#339, so each gets checked against the repo (now a standing blocker note above).
  Next /next BUILDs **#340** (`/decide`, second in 5a build order).
- 2026-07-29 — SLICED **phase 5a (agent-harness hardening)** out of a field survey of
  AI-agent game-dev tooling, run at the user's request and written up as
  `docs/agent-workflow-notes.md`. The survey's verdict on the field: the 49-agent "studio"
  frameworks solve a consistency-across-many-streams problem this project does not have
  (one product, one director, locked spec, one-unit-per-session discipline) — take their
  **hooks and path-scoped rules**, skip the org chart; spec-driven tooling (Spec Kit, Kiro,
  OpenSpec) is a lateral move because issue #1 + `spec-condensed.md` + the issue queue
  already *is* a spec-first pipeline, with **EARS notation** the one portable piece; the
  live frontier worth taking is automated balancing ([RuleSmith](https://arxiv.org/abs/2602.06232)
  = engine + agents + Bayesian optimization over a rule space) and vision-driven GUI QA.
  Things this repo already does that the field does not: the `/next` never-end-in-analysis
  contract, reachability/anti-orphan tests, `docs/*-recipe.md`, and `build-state.md` itself.
  Six gaps filed, ordered cheap-first because the cheap ones compound: **#334** trim
  build-state to live state + archive the log (this file is 669 lines and `/next` reads all
  of it every session), **#335** hooks for the module-boundary convention (today enforced by
  the root CLAUDE.md admitting "no lint rule enforces this") + the save-envelope re-stamp
  ritual, **#336** `paths:`-scoped rules so per-module CLAUDE.md loads without being
  remembered, **#337** EARS acceptance criteria on filed slices, **#338** a drivable web
  target (web `StorageDriver` + `react-native-web`) so `/verify` stops returning BLOCKED on
  every surface slice — **this supersedes the verify skill's "do not install
  react-native-web" line**, which was correct only while the `expo-sqlite` block stood —
  and **#339** fix the harness's dishonest bankruptcy metric (a run dying ~day 125 currently
  scores clean) then add a Bayesian search over a declared tunable manifest, feeding #286 a
  ranked diff instead of a from-scratch hand-tune. Phase 5a is workable **while phase 5
  waits on the user**; it does not substitute for the playtest — the felt questions stay a
  human gate. **#340** was filed after the other six, by asking what they still don't cover:
  they close the *tooling* gap, but the rate limiter on the remaining phases is director
  decision bandwidth — six of seventeen are blocked on a GRILL or ADJUDICATE. `/decide` is
  the prep unit for one gate (context loaded, internal forks decided by the agent and never
  asked, player-facing forks presented with evidence + a recommendation, ruling recorded so
  it never reopens) — the same activation-cost fix #332/#333 were for the playtest. It sits
  **second** in build order despite being newest: one skill file, and the only item that
  unblocks anything on the product side. Next /next BUILDs **#334**.
