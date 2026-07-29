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
  playtest. #338 landed, so the `/verify` BLOCKED ceiling is gone — a UI slice is now driven
  live on the web target (`.claude/skills/verify`). 5a does not substitute for the playtest —
  the felt questions stay a human gate.
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
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338 done; **#339 left**; see `docs/agent-workflow-notes.md`) | — | active |
| 5b | Module-boundary debt clearance (#341 → #342), surfaced by #335's scan | — | pending |
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

- 2026-07-29 — BUILT + closed **#338** (phase 5a S6 — a drivable web target). **Every
  build-state entry since #325 ended with `/verify: BLOCKED for the live-GUI drive`** — a tax
  paid ~30 times, and on every remaining UI slice. Nothing an agent could run proved the screen
  renders, the tap lands, or the number on screen matches the number in the world. The block
  was real and had two halves, and #332's `driverFactory('playtest-log')` had already proved
  the seam that removes the first. **`src/game/SaveStore/webDriver.ts`** is the web
  `StorageDriver`: a `WebKeyValueStore` backend resolved **once per factory** — IndexedDB,
  else localStorage, else memory — with per-key records inside one object store, giving slots
  the same isolation the per-file sqlite factory gives on device. Resolving once per factory
  rather than per call is deliberate: a mid-session downgrade would otherwise split one career
  across two stores. IndexedDB is the default and not localStorage because a single career blob
  is ~41KB and the snapshot ring holds six of them per slot — the ~5MB localStorage cap is a
  ceiling a long career reaches, so it is the fallback, not the choice. **The platform branch
  lives in `src/app/storage.ts`, not in SaveStore** — that is what keeps `react-native` out of
  every module under `src/game/` (still zero imports), and an anti-orphan test asserts the
  composition root defaults through it. `react-native-web` + `react-dom` + `@expo/metro-runtime`
  installed via `npx expo install`; **nothing under `src/ui/` needed a fix** — the kit renders
  on RNW as-is, with only RN's own `shadow*`/`pointerEvents` deprecation warnings.
  **Verified by actually playing it**: start menu → dev T2 fixture → Home at Day 31 /
  $222,734 / Tier 2, all five tabs, People showing the UCM delegation rows, the live floor view
  with the clock running 9:13a → 10:27a, then a **full page reload → Continue → the same
  career**, with the two IndexedDB records (`index`, `slot:slot-1`) read back to prove the
  write landed rather than trusting the screen. Zero console errors throughout.
  `.claude/skills/verify` is rewritten around this: the drive loop, `read_page` as the primary
  instrument (screenshots fail whenever the Browser pane isn't displayed, and coordinate clicks
  are refused without one), the dev-T2 shortcut to a mid-game state, how to read the save out
  of IndexedDB — and **BLOCKED now reserved for what genuinely needs a device, which the
  verdict must name**. The trap that cost the most time in this slice is written down because
  it presents as a broken button with no error: **the ref→screen coordinate mapping goes stale
  after a reload**, so clicks land elsewhere silently — re-`resize_window` after every
  navigation, and confirm with a capture-phase click listener. Typecheck clean; 196 suites /
  2401 tests green (8 new); `npm run hooks:test` green. **What this does not do is replace the
  felt half — phase 5 (#74) stays a human gate.** A driven GUI answers *does the surface exist
  and respond*, never *does it land*.
  Next /next BUILDs **#339** (the balance-harness optimizer — last of phase 5a) — or
  `/decide C1` any time to unblock phase 6.
- 2026-07-29 — BUILT + closed **#337** (phase 5a S5 — EARS acceptance criteria as a filing
  convention). Acceptance criteria on filed slices were prose, and on an AFK slice the issue
  body is the *entire* brief — the implementing session reads the issue, the recipes and the
  touched module's `CLAUDE.md` and nothing else, so an implicit trigger is exactly where a
  slice quietly builds the adjacent thing. `docs/agent-handoff.md` now carries an
  **"Acceptance criteria (EARS)"** section: the five patterns (ubiquitous / event-driven /
  state-driven / unwanted / optional), the rule that **each criterion names a test that fails
  without it**, the rule that the section holds criteria only (context goes in Scope/Notes,
  indented sub-bullets are free), and **two worked examples whose test names were verified
  against the real suites** rather than invented — #329 Records (`tests/Records.test.ts`
  "starts with no marks set", "does not crown an empty day", and the
  `tests/worldSnapshot.test.ts` "migrates pre-#329 snapshots to an empty scoreboard" case) and
  #335's boundary hook (four real `npm run hooks:test` labels). The game-side example is
  chosen to show what the patterns buy: the event name *is* the trigger, the null-vs-zero
  decision is stated instead of left to the implementer, and the zero-unit divide-by-zero case
  is a criterion rather than a bug found later. **The half that makes it stick is a sixth
  hook** — a doc-only convention is skipped by forgetting, not by deciding, which is the same
  failure #335/#336 removed. `.claude/hooks/pre-issue-criteria.mjs` (PreToolUse Bash/PowerShell)
  reads the body out of `--body`, `--body-file` or a heredoc, finds the criteria section, and
  **blocks** a create that has none or whose top-level bullets are prose, answering with the
  five patterns. Two scoping decisions are load-bearing and both are in the selftest:
  **new issues only** (`gh issue edit` is never judged — rewriting an already-filed issue would
  change agreed scope silently, which #337 explicitly forbids), and **only a create the shell
  will actually run** (the match must sit at a command boundary, so a grep, a `node -e` string
  or a doc *about* this hook files nothing and is left alone). That second rule was tightened
  twice **by the hook catching me**: first blocking a probe command, then blocking this slice's
  own commit message, which named the tool in markdown inline code — so a backtick is
  deliberately not a command separator. An inline body's first heading does not sit at
  a line start, so the flag's opening quote is broken onto its own line before parsing; that
  bug was caught by the prose-criteria negative case failing with the *wrong* reason rather than
  passing by luck. `npm run hooks:test` gained 10 cases (both negatives, the heredoc form, the
  body-file form, a chained second create judged on its own body, and the two over-trigger
  guards) and CI already runs it. Typecheck clean; 195 suites / 2393 tests green.
  Next /next BUILDs **#338** (a drivable web target so `/verify` can actually run the GUI —
  it removes the BLOCKED ceiling every later slice pays) — or `/decide C1` any time to unblock
  phase 6.
- 2026-07-29 — BUILT + closed **#336** (phase 5a S4 — path-scoped area rules). The repo's
  per-area conventions were prose in the **always-loaded** root `CLAUDE.md`, which paid the
  context cost on every session and then only worked if the agent remembered — including the
  root doc asking, in a sentence, that the per-module `CLAUDE.md` be read before the module's
  code. **The mechanism was verified against the installed CLI (2.1.219) rather than assumed**:
  `.claude/rules/` is loaded natively per project, the frontmatter key is `paths:`, values are
  gitignore-style globs matched on repo-relative paths (a trailing `/**` is optional, and the
  parser accepts an array, a comma string, or `{a,b}` groups), and the load is reported as
  `load_reason: path_glob_match`. The load-bearing trap found in the same pass: **a rule file
  with no `paths:` loads unconditionally in every session** — so a `README.md` in that
  directory would be the exact cost being removed, and there deliberately isn't one.
  Six rules now exist: `src/game/**` + `src/*.ts` (barrel convention + the write-time hook,
  EventBus-only, deep modules, no magic numbers, and "read `src/game/<Module>/CLAUDE.md` —
  the path is mechanical"), `src/ui/**` + `App.tsx` (never reach into game logic, theme roles
  with `kit.noleak` as the enforcement, plain-language labels that **name the axis** and never
  a temperature word, fixed 5 tabs never tier-gated), `data/**` (every loader through
  `parseData`, a new block needs a schema entry, fixtures are save state and route through the
  envelope hook), `tests/**` + co-located `src/**/*.test.ts(x)` (public-interface isolation
  tests, UI smoke only, no snapshots, **reachability/anti-orphan test for any player-facing
  surface**, seeded-stream scoping for determinism), `scripts/**` (points at
  `docs/balance-harness-recipe.md`, whose opening block is what stops a wasted session on the
  expected pre-T2 bankruptcy), and `.claude/rules/**` documenting the directory itself so its
  conventions cost nothing unless you edit it. **Rules point at the existing doc; they do not
  restate it** — that is the anti-drift rule, since a copy inside a rule wins by accident.
  Root `CLAUDE.md` lost its per-path detail and its whole Testing section; the principle
  headline stays, because it binds design discussions that touch no file at all and a rule
  would never fire for those. `tests/claude-rules.test.ts` guards all three rot modes — an
  unscoped rule, a scope whose path no longer exists, a body pointing at a moved doc — and
  **both negative cases were run and fired** before the guard was trusted. `.gitignore` now
  shares `.claude/rules/` the way it already shares hooks and skills. Typecheck clean; 195
  suites / 2393 tests green. Next /next BUILDs **#337** (EARS acceptance criteria as a filing
  convention) — or `/decide C1` any time to unblock phase 6.
