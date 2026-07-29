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

- 2026-07-29 — BUILT + closed **#335** (phase 5a S3 — hooks for the module-boundary
  convention + the save-envelope ritual). `.claude/settings.json` had exactly one hook, a
  `UserPromptSubmit` echo; everything else this repo calls non-negotiable was prose an agent
  had to remember, including the root CLAUDE.md's own admission that the module-boundary rule
  had **"no lint rule enforcing this"**. Five hooks now live in `.claude/hooks/`, all Node
  `.mjs` (the repo is driven from Git Bash, cmd and PowerShell — one language beats three
  copies), stdin JSON in, exit code out. **`pre-module-boundary.mjs`** (PreToolUse Edit/Write)
  blocks a write whose *new text* imports past another module's `index.ts`; it resolves
  relative and `@/` specifiers, allows the barrel and `.../index`, and allows a module reading
  its own internals. **`pre-save-envelope.mjs`** interrupts **once per session** on a
  `WORLD_SNAPSHOT_VERSION`/migrations/`data/fixtures/` touch with the full ritual — the
  load-bearing line being that tier-2.json is re-stamped by **migrating in place**, never by
  `npm run gen:fixtures` (the harness bot bankrupts ~day 125 at tier 1 and writes nothing).
  It blocks rather than whispers because PreToolUse has no non-blocking channel that reliably
  reaches the agent, and a reminder nobody reads is the failure being fixed; the re-issued
  edit passes. **`post-typecheck.mjs`** typechecks after any `src/**` edit —
  `--incremental` with its buildinfo in the ignored session dir, ~6.5s cold / ~3.4s warm, so
  an edit burst stays tolerable. **`post-record-command.mjs`** + **`stop-session-hygiene.mjs`**
  close the loop: if `src/` or `data/` changed but the suite never ran or build-state.md was
  never updated, the Stop hook says so once (`stop_hook_active` guards the loop).
  **`module-boundary-allow.json` enumerates the 81 pre-existing reach-ins across 71 files** —
  without it the first rewrite of `createWorld.ts` would be blocked by debt it didn't create.
  The scan that generates it (`npm run hooks:scan`) also made the debt countable, and it is
  two classes: ~35 `../data/loadJson` reach-ins that are **one-line fixes** (`parseData` is
  already on the data barrel) and ~40 `../NPC/Rng` ones that are **not** — `Rng` is not
  exported from NPC's barrel, so those need a public-surface call, not a rename. That list is
  meant to shrink. **`npm run hooks:test` drives all five with synthetic payloads and asserts
  the exit codes, negative cases included, and CI now runs it** — which immediately earned its
  keep: the typecheck hook was **silently exiting 0 on every broken file**, because Node 24
  refuses to spawn `npx.cmd` without `shell: true` and the hook read the resulting null status
  as "fine". Now it invokes `node_modules/typescript/bin/tsc` under the current node and
  *blocks* if it can't run at all. Two over-triggers were also caught and scoped away in the
  build (the hooks tree describes the rule, so it isn't judged by it; the envelope reminder
  only fires inside `src|data|tests|scripts`). Typecheck clean; 194 suites / 2374 tests green.
  Next /next BUILDs **#336** (`paths:`-scoped rules so per-module CLAUDE.md loads without
  being remembered) — or `/decide C1` any time to unblock phase 6.
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
