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
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work is #343/#344/#345.)
- **Phase 5a's remaining issues (#343–#345) outnumber phase 5b's (#341, #342).** The phase
  table is the order, not the issue numbers; the chronological rule is a tiebreaker *within* a
  phase. 5a finishes first.

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
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338 done; #339 sliced into #343 done → **#344 → #345**; see `docs/agent-workflow-notes.md`) | — | active |
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

- 2026-08-01 — **BUILT #343** (balance-harness honest objective), slice A of #339. Landed
  `scripts/balance-harness/scoring.ts` + `tests/balanceHarness.scoring.test.ts` (19 tests);
  197 suites / 2421 tests green, typecheck clean.
  **The headline is what the live harness now says.** On a 5-seed × 200-day competent cohort
  the old view prints `bankrupt: 60% … completed=2` — readable as "two seeds were fine." The
  honest verdict on the same cohort is **`FAILED: 100% of 5 seeds, median failure day 120,
  [verdictMissStreak=5]`**. The two "completed" runs survived to `maxDays` while missing the
  tier gate **every graded month**. That is precisely the lie #339 leads with, and it was not
  a bankruptcy-accounting bug — `endedReason` cannot express it at all.
  **Five ruin conditions, earliest one dates the run.** Two were previously unseeable.
  *Cash-negative* is read off the per-day `RunSample` series, not the terminal event — the
  test asserts a run that dips negative on day 40 **and recovers** still fails, on day 40.
  *Forced contraction* needed wiring, not just scoring: `runner.ts` subscribed to **none** of
  the three contraction events, and a contraction doesn't touch `endedReason` (it knocks the
  run back a tier and continues), so a contracted run read as healthy. Proven with a
  runner-level test against a **live** short run — `runOne` gained an optional injected bus,
  because the defect was a *missing subscription* and no synthetic `RunResult` can catch one.
  `SUSTAINED_MISS_MONTHS = 3` is derived in a comment from the campaign streak rule in
  `tier-pacing-targets.json` (advancement is an unbroken run of good months, so ruin is its
  mirror; three of them exceeds the entire T1 dwell target of 2). `nearMiss` is honest
  progress and **resets** the streak — asserted both ways.
  **Two constraints from #339's filing carried through intact.** (1) `tierFit` is smooth —
  1.0 on target, exactly 0.5 at the `toleranceBand` edge, strictly monotone forever after —
  because a WITHIN/OUT flag ties every out-of-band config and hands #345's optimizer zero
  gradient over exactly the region the un-tuned tunables sit in *today* (T1 median dwell is
  1.0mo vs a 2.0mo target, i.e. deep out of band). Tested for monotonicity across three dwells
  all outside the band. (2) `searchScore` is labelled `(BLEND — search signal only)` and the
  report test asserts **every one of the four term labels appears before it**, so the blend
  can never be printed alone.
  Also: `MonthVerdictRec` gained the verdict `day` (the event already carried it) so a streak
  is dated off the clock rather than a month index; `summarizePacing` now takes `{maxDays}`;
  the sweep table gained a `failed%` column but deliberately **not** the blend. The
  targets-file read-only criterion is a byte comparison, not a promise.
  Recipe doc updated — the "bankruptcy rate is misleading" trap block now points readers at
  the `FAILED:` line, and mode A documents the verdict block.
  Next /next BUILDs **#344** (tunable manifest + multi-file overrides + frozen-key guard).
- 2026-07-29 — **SLICED** phase 5a's last issue. #339 (balance-harness honest objective +
  tunable search loop) was five scope items, three of which are each a normal slice, so it was
  filed as an ordered chain and closed as superseded — **nothing dropped, the scope is carried
  verbatim**. The trigger was the user asking outright whether it needed slicing; the answer was
  yes, and the seams fell out of a short orientation rather than a design argument.
  **#343 — A: honest objective.** Per-run failure scoring + the four terms reported separately.
  Half the fix turned out to be already in: `EndReasonBreakdown` (`types.ts:87`) had already
  split `modeledBankruptcy` from the hard `insolventThrow`, so the "bankruptcy rate: 0%" lie the
  parent issue leads with is **already dead** in the breakdown — what's missing is the per-run
  verdict and the term split. Two things the orientation added that the parent didn't spell out:
  **cash-negative should be read off the per-day `RunSample` series**, which dates the failure
  earlier and more honestly than the terminal event (~day 125 on the instrumented fixture seed);
  and **`runner.ts` subscribes to none of the three `*_contraction` events**, so "forced
  contraction" — named in the parent's scope — is currently *invisible* to the harness and has to
  be wired, not just scored. Also specified: the time-to-tier fit must stay **differentiable past
  the tolerance band**, because a binary WITHIN/OUT flag gives the slice-C optimizer zero
  gradient over exactly the region the un-tuned tunables sit in.
  **#344 — B: manifest + multi-file overrides + frozen-key guard.** `overrides.ts:18` knows only
  `tier-gate` and `tunables`, but the parent's debt list spans six more data files
  (`sourcing`, `intel-precision`, `bodyshop-demand`, `news-progression-gating`, `service-manager`,
  `starting-inventory`) — so the plumbing is real work, not a config line. The manifest lives in
  the harness next to `policies.ts`, **not under `data/`**: `data/**` is schema-validated game
  content read by loaders, and this is tooling config no game module reads (same reasoning that
  keeps the policy bots' strategy numbers out of `data/`). "Keys not listed are frozen" is filed
  as an asserted byte-comparison across every registered file, which is the criterion that makes
  the freeze checkable instead of trusted.
  **#345 — C: the search loop.** GP + RBF + Expected Improvement over B's surface, adaptive
  re-sampling (cheap seed subset first, full spread only for promising candidates, **with the
  seed count recorded so a cheap score is never compared to a full one**), resumable study file
  that refuses to resume against a changed manifest fingerprint, ranked report carrying the four
  terms plus `file:path current → proposed` diffs, and the explicit `apply` step that is the only
  thing that writes `data/**`. Filed with the testability constraint stated up front: a real
  evaluation is ~7 ms × 360 days × N seeds, so **the loop must take its evaluator injected** or it
  is untestable — tests drive a synthetic objective with a known optimum and assert convergence.
  **#339 closed rather than left open** so "lowest-numbered open issue whose deps are met" keeps
  pointing at real work (it is now #343); #339 remains the design record all three cite as parent.
  Recorded in the blockers: 5a's remaining issues now outnumber 5b's (#341/#342), so the phase
  table is the order and the chronological rule is a within-phase tiebreaker.
  No code changed this session — this was a SLICE unit, not a BUILD.
  Next /next BUILDs **#343** (harness honest objective) — or `/decide C1` any time to unblock
  phase 6.
- 2026-07-29 — **NOT a /next unit.** User-requested polish pass: compare the live Home hub
  against `docs/planning/mockups/home-hub.png` and close the gap. Second session in a row where
  driving the app on the web target (#338) found things no test would have — but **screenshots
  were unavailable the whole session** (the Browser pane was not displayed, so the page never
  composited and every `screenshot` timed out), so the entire comparison ran on DOM geometry and
  computed styles read through `javascript_tool`. That turned out to be a *better* instrument
  than an eyeball for this: two of the six findings are numbers you cannot see. Six changes.
  **(1) The shell header was squeezed to a third of its width.** The collapsed single-line
  readout was a flex sibling, so it reserved its full 150px intrinsic width **in the expanded
  state too**, where it is invisible — the identity column measured **123px**, the dealership
  name painted 213px past its own box, and the tier pill was stretched to exactly its clipping
  edge (a Tier-3 label would have wrapped). It is now absolutely positioned inside that column,
  which costs the expanded state nothing: column **123 → 285px**, header 106 → 92.
  **(2) The hero CTA drew its arrow twice** — `icon="arrow-forward"` *plus* a literal `→` glued
  onto the label string, on a button that means "go forward". `Button` gained a `trailingIcon`
  slot so a directional glyph is never smuggled into a label again, and the face is now the
  mockup's: start flag on the left rim (`U+F06E`), verb centered, arrow on the right rim
  (`U+E5C8`) — verified by codepoint and x-position, and each new glyph confirmed to carry real,
  *distinct* ink on canvas rather than trusting that the vendored MaterialIcons ttf has them.
  **(3)** Cash + Reputation merged onto one slab split by a hairline (was two half-width cards
  with a gutter, reading as two unrelated widgets); gauge 92 → 84 so the faces balance.
  **(4) The four empty states were bare grey sentences under tracked-caps eyebrows** — every
  other band on the page is a card, and an un-contained line of muted text in that stack is the
  single biggest reason the lower half read as an unfinished wireframe even though the copy was
  honest. Same words, now in inset wells with a muted glyph (`EmptyNote`). **(5)** The calendar
  card had nothing to *read*; it gained the mockup's month burn-down ("Days this month / Day N
  of 30" + bar), the month being the tier-gate cadence and so the one calendar figure the player
  plans against. **(6)** Tab bar active state: 2px top rule → filled rounded slot.
  Typecheck clean; 196 suites / 2402 tests green. **Known and deliberately unchanged:** in the
  COLLAPSED bar the scaled title (~181px) and the compact readout (150px) still cannot both fit
  in 285px — ~46px overlap on a long name. Geometry there is byte-identical to before this pass
  (it was ~78px), so it is pre-existing and is a **content** question — whether the slim bar
  should spell out "REG PRESSURE 0/100" — not a layout bug, and that is the user's call.
  Also left alone: the hero photo is `lot-tier1.jpg` at Tier 2 (tier 2/3 art is #251, not
  landed), and the quick-stat strip has no colored sub-lines because the honest data for them
  does not exist yet — inventing numbers to fill the mockup's shape was the wrong trade.
  Phase 5a is unchanged — next /next still BUILDs **#339**.
