# Agent-workflow notes — field research vs. this repo

Written 2026-07-29. A survey of what the AI-agent game-dev tooling world actually offers a
solo developer/director, measured against what this repo already does, plus the gap list that
became issues #334–#339.

This is a **reference doc**, not a plan. The build order lives in
`docs/planning/path-to-finished-product.md` §12; the pointer lives in
`docs/planning/build-state.md`.

---

## 1. The field, as of mid-2026

### Multi-agent "studio" frameworks
[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) is the
flagship: 49 agents in a studio hierarchy (3 Opus directors → 8 Sonnet department leads → 38
specialists), 73 slash commands, 12 validation hooks, 11 path-scoped coding rules. Delegation
is vertical; same-tier agents consult but cannot make binding cross-domain calls.

**Verdict for us: skip the org chart, steal the enforcement layer.** The hierarchy solves
consistency across many parallel work streams. We have one product, one director, a locked
spec, and a deliberate one-unit-per-session discipline. Adding 49 cold-start agents multiplies
exactly the re-derivation cost the root `CLAUDE.md` context-discipline rules exist to fight.
The parts worth taking are the **12 hooks** and the **11 path-scoped rules** — see §3a/§3b.

### Spec-driven development (SDD)
Now a named methodology: Specify → Plan → Tasks → Implement, with a human checkpoint per
phase. Tooling: GitHub Spec Kit, OpenSpec, AWS Kiro, BMAD-METHOD, Tessl. The failure it names
is **drift** — plausible code that quietly solves the wrong problem because nothing grounded
it in a real spec.

**Verdict: we already do this, adapted better.** Issue #1 + `docs/spec-condensed.md` +
per-phase planning docs + the issue queue *is* a spec-first pipeline, and it is already
wired to the tool we use to grab work. Migrating to Spec Kit is a lateral move with real
cost. The one portable artifact is **EARS notation** for acceptance criteria (§3f).

### Automated balancing and playtesting
The genuinely useful research frontier.

- **[RuleSmith](https://arxiv.org/abs/2602.06232)** — game engine + multi-agent LLM self-play
  + **Bayesian optimization over a multi-dimensional rule space**, with acquisition-based
  adaptive sampling (more runs to promising configs, fewer to exploratory ones). Converges to
  balanced configurations and emits *interpretable* rule adjustments.
- **[Curiosity-driven RL playtest agents](https://arxiv.org/pdf/2103.13798)** — coverage
  rather than balance: agents that explore states a scripted bot never reaches.
- **Vision-driven QA** — nunu.ai's multimodal agents and Razer's zero-integration vision
  testing drive real GUIs with no engine hooks.

**Verdict: this is where our leverage is.** Our `scripts/balance-harness` is RuleSmith's
evaluation half already built. What's missing is the search loop (§3d). The vision-QA line
is only reachable once the app has a surface an agent can drive (§3c).

### Harness mechanics (the highest-value guide found)
[Steering Claude Code](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
names our exact anti-patterns:

| Anti-pattern | Fix |
|---|---|
| "Every time X, do Y" written in CLAUDE.md | A hook |
| "Never do this" written in CLAUDE.md | `PreToolUse` hook |
| A 30-line procedure in CLAUDE.md | A skill |
| A rule that only applies to `src/api/**`, left unscoped | `paths:` frontmatter |

[Mise en Place for Agentic Coding](https://arxiv.org/pdf/2605.05400) formalizes deliberate
preparation as context engineering: specification documents, context packages, knowledge
artifacts, constraint definitions. Our `docs/*-recipe.md` files are exactly its "knowledge
artifacts" (tacit-knowledge externalization), authored per-seam before the field named it.

---

## 2. Where this repo is already ahead

These have no equivalent in the frameworks above:

- **`/next`'s one-unit contract.** Every invocation must terminate in a commit, a filed
  slice, or a recorded decision — *never* in analysis or an open question. Spec Kit has the
  four phases; nothing in the field has the "never end in a plan" clause.
- **Reachability / anti-orphan tests.** A slice fails if the mechanic isn't actually mounted
  in the live app. This is the fix for "mechanics built but never surfaced," and it is our
  best original invention. Nothing surveyed does it.
- **`docs/*-recipe.md`** per repeated seam (generation-seam, save-migration, balance-harness,
  demand-shaping) — read one doc instead of re-deriving from source.
- **`build-state.md` as durable cross-session state** plus a rationale log. The studio
  frameworks have no persistence between sessions at all.
- **GitHub issues as the spec store**, queried with `gh`. Spec Kit re-implements this as
  files in the repo.

---

## 3. The gaps, and what each became

### a) Hooks are effectively unused → #335
`.claude/settings.json` holds a single `UserPromptSubmit` hook that re-states the scope rule
as text. Meanwhile the repo's #1 architectural non-negotiable — the module-boundary
convention — is documented as *"No lint rule enforces this — it is a review-time
convention."* That is precisely what a `PreToolUse` hook is for: deterministic, zero context
cost, fires every time.

### b) No path-scoped rules → #336
Per-module `CLAUDE.md` files only load if the agent *remembers* to read them (the root
`CLAUDE.md` has to ask, in prose, every session). `paths:`-scoped rules load automatically
when matching files are touched. No content rewrite needed — a rule file can point at the
module doc.

### c) `/verify` is BLOCKED on every slice → #338
Every build-state entry since #325 ends the same way: *live-GUI drive BLOCKED (native
`expo-sqlite` + no `react-native-web`) — reachability + smoke is the reachable ceiling.* That
is a tax charged on every slice, ~30 times so far and on every one remaining. The
`StorageDriver` abstraction already proved the seam (`driverFactory('playtest-log')`, #332).
A web target plus a web storage driver gives a browser agent something to actually drive —
the same thing the vision-QA vendors sell, without the vendor.

It does **not** replace the felt half of playtesting (see §4).

**Built 2026-07-29.** `src/game/SaveStore/webDriver.ts` is the web `StorageDriver`
(IndexedDB → localStorage → memory, resolved once per factory); `src/app/storage.ts` picks it
by `Platform.OS`, which is why the platform branch lives in the composition root and no module
under `src/game/` imports `react-native`. `npm run web` boots the real app —
verified live: start menu → dev T2 fixture → Home showing Day 31 / $222,734, all five tabs,
the live floor with a running clock, and a full page reload resuming the same career out of
IndexedDB. `.claude/skills/verify` now documents the drive loop and **reserves BLOCKED for
what genuinely needs a device**, which it must name. The trap worth knowing before you spend
an hour on it: the ref→screen coordinate mapping goes stale after a reload and clicks land
elsewhere with no error — re-`resize_window` after every navigation.

### d) The balance harness has no optimizer → #339
Every slice log ends *"all magnitudes are first-pass → #286."* That debt is now dozens of
placeholder constants spread across `data/*.json`, all converging on one HITL campaign. We
have RuleSmith's engine and bots and authored targets (`data/tier-pacing-targets.json`); we
lack the search. Prerequisite, and the reason this is one issue and not two: **the objective
function is currently wrong** — the pacing report's "bankruptcy rate: 0%" counts only the
hard floor-throw and files modeled bankruptcy as "gameover," so a run that dies on day 125
scores clean.

### e) `build-state.md` is 669 lines and `/next` reads all of it → #334
Every session pays for the entire history to recover four live facts (phase, blockers, phase
table, last outcome). The same closeout logs are duplicated in agent memory
(`session-resume.md`), so there are two copies free to drift apart.

### f) Acceptance criteria are prose → #337

EARS ("When \<trigger\>, the system shall \<response\>") turns fuzzy criteria into testable,
parseable statements. Cheap to adopt, and it directly raises fidelity on AFK slices, where
the issue body is the entire brief.

**Built 2026-07-29.** The convention plus two worked examples is a section of
`docs/agent-handoff.md`, and `/next`'s SLICE branch points at it. The half that makes it
stick is `.claude/hooks/pre-issue-criteria.mjs`: a `gh issue create` whose body has no
acceptance-criteria section — or whose criteria are prose — is blocked with the five patterns
in the message. A convention that only lives in a doc is skipped by forgetting, not by
deciding, which is the same failure #335 and #336 were built to remove. New issues only;
`gh issue edit` is untouched, so nothing already filed gets silently rescoped.

### g) Nothing lowers the cost of a *decision* → #340

Named after #334–#339 were filed, by asking what those six still don't cover. They close the
tooling gap; they do nothing about the actual rate limiter. Six of the seventeen remaining
phases are blocked on a GRILL or ADJUDICATE that only the director can rule on.

Same pathology as the playtest before #332/#333: the work wasn't hard, *starting* it was
expensive, and it sat blocked until tooling made starting cheap. A pending grill means
reloading design context and re-deriving what the forks even are before any thinking begins.
The thinking is the user's. The reloading and deriving are not.

`/decide` prepares one gate — forks triaged (internal ones decided by the agent, never
asked), evidence pulled with `file:line`, a recommendation per player-facing fork — and
records the ruling so the gate never reopens.

**Built 2026-07-29** as `.claude/skills/decide/`. The load-bearing half is
`gates.md` beside the skill: a per-gate index (scope §, docs to load, locked inputs that
must not be reopened, where the ruling gets recorded) for all eight pending gates, so
opening one is a read, not an excavation. Only C1 staff-teeth is marked grill-worthy;
the rest are short fork sets and the skill forbids running a grill on them.

---

### Build order

Leverage and order are not the same thing. The cheap harness items compound — every session
after them costs less — so they go first even though the last two carry more leverage:

**#334** (trim build-state) → **#340** (`/decide`) → **#335** (hooks) → **#336** (scoped
rules) → **#337** (EARS) → **#338** (web verify target) → **#339** (harness objective +
search loop).

#340 sits second despite being the newest: it is one skill file, and it is the only item that
unblocks anything on the *product* side — six phases are waiting behind a ruling.

Filed as phase 5a in `docs/planning/build-state.md`, which `/next` can work while phase 5
(the #74 playtest gate) waits on the user.

## 4. What #334–#340 do not cover

Honest residue, so nobody mistakes the list for a complete answer. All three are the same
thing wearing different clothes: **judgment doesn't delegate.**

- **The felt half of playtesting.** #74's questions — is the day the right length, is the
  capacity squeeze legible, is any of this fun — are judgment, not measurement. A driven GUI
  (#338) can answer *does the surface exist and respond*; it cannot answer *does it land*.
  Phase 5 stays a human gate by design.
- **The rulings themselves.** #340 makes a gate cheap to *open* — context loaded, forks
  triaged, evidence pulled, a recommendation on the table. It does not make the call. Six
  phases wait on the director having an opinion, and that stays true after #340 lands.
- **Taste on generated numbers.** #339 proposes tunable diffs against authored targets. The
  targets themselves are the user's to author, and a config that satisfies every one of them
  can still feel wrong — the optimizer narrows the search, it doesn't close it.

None of the seven changes the *rate* at which slices get built either. They change what it
costs to start one, whether it can be verified, and whether its numbers are honest.
