# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 5 — #74 round-1 playtest (HITL). The script is prepared, verified and HANDED OVER
as of 2026-08-06.** It now sits with the director; nothing in the repo blocks it.

**Phases 6 and 7 are COMPLETE as of 2026-08-06** — the whole #352–#362 slice landed. Both
gates were closed before a line was written (C1 2026-08-02 `staff-teeth-design.md`, A2
2026-08-03 `path-to-finished-product.md` §3 A2) and nothing in the slice reopened them.

**The next `/next` does NOT wait on the playtest.** If the director's round-1 notes have
landed (as a comment on #74 or a pasted export), the unit is triaging them per §7's Class
A/B protocol. If they have not, the unit continues the phase pointer below. A human gate is
never a reason for a session to end with nothing built.

**Phase 8 is COMPLETE as of 2026-08-07** — #180, #181 and **#286** have all landed. The live
engine now closes **28.5%** of worked ups against the 2.2% #180 measured, the early-game floor
held its shape (0.5% positive for a green operator, so the progression still has a bottom), and
the balance harness went from "bankrupts before Tier 2" to **90 of 100 seeds reaching T2** with
a median survival of the full 360 days.

**Phase 9's gate is CLOSED as of 2026-08-07** and the phase is **SLICED as of 2026-08-07** —
`docs/planning/fni-mechanics-grill-state.md` is a locked design, and B2 is now twelve filed
issues. The next `/next` on phase 9 is a **BUILD**. **#151, #153, #365, #152, #366 and #367
have all landed** — six left. **#368** (CSI drag) is now the lowest-numbered open, deps-met
slice; #369 is deps-met too (#367 landed), and #370 sits behind #369. #371 and #372 are
deps-met independently.

### Phase 9 — B2 F&I plug-in #2 (filed 2026-08-07)

| # | Slice | Deps |
|---|---|---|
| ~~#151~~ | ~~per-brand `Reputation.repFor(make)` replaces the `pickVehicle` stub — ambient, no screen (I6)~~ **BUILT 2026-08-07** | — |
| ~~#152~~ | ~~attach scales with amount financed — one per-product `loanSensitivity` (I4)~~ **BUILT 2026-08-08** | — |
| ~~#153~~ | ~~cash-buyer / must-finance traits through `resolveEffects` (I5)~~ **BUILT 2026-08-07** | — |
| ~~#365~~ | ~~**tracer** — `apr`→`buyRate` + `markupCapPts`, `computeReserve`, back gross splits into `productGross`/`reserveGross` (Q1/Q2, I1–I3)~~ **BUILT 2026-08-08** | — |
| ~~#366~~ | ~~the posture dial — three positions, slot-persisted like `tradePolicy`, **no snapshot bump** (Q5/Q6/Q9, I7)~~ **BUILT 2026-08-08** | #365 |
| ~~#367~~ | ~~deal-kill — one curve in `data/`, an over-marked deal falls through (Q3 primary, I8)~~ **BUILT 2026-08-08** | #366 |
| #368 | CSI drag — an over-marked customer publishes `reputation:satisfaction_hit` (Q3 secondary) | #365 |
| #369 | the F&I manager works the deal — `finance_structuring` frontier, `product_presentation` attach (Q2/Q5/Q10) | #367 |
| #370 | the peak meter — twin opposed bars, the crest is not the max (Q4) | #366, #367, #369 |
| #371 | the crowd's finance mix read ahead on the wire — MarketIntel lane, F&I manager is a third opener (Q7) | — |
| #372 | advertising buys a different crowd — person-archetype weights on campaigns (Q8) | — |
| #373 | the monthly F&I verdict — Reveal reactions + the PVR record (engagement spine plug-in #2) | #365, #366, #371 |

(#151–#153 were **absorbed as filed** rather than re-filed — their bodies now carry the locked
B2 scope, EARS criteria and corrected deps. Do not file duplicates of them.)

| # | Slice | Phase |
|---|---|---|
| ~~#352~~ | ~~per-role slot table = the hiring cap; `headcountCapByTier` deleted~~ **BUILT 2026-08-05** | 7 → unblocks 6 |
| ~~#353~~ | ~~`data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted~~ **BUILT 2026-08-05** | 6 |
| ~~#354~~ | ~~People surface: grade + wage per card, total daily payroll~~ **BUILT 2026-08-05** (the skill-bar `flexDirection` defect was already dead — #347 deleted `PersonnelScreen`) | 6 |
| ~~#355~~ | ~~hire fee = multiple × daily wage; `hiringCostByTier` retired~~ **BUILT 2026-08-06** | 6 |
| ~~#356~~ | ~~raise demands (ask/answer) + `payVsMarketBonus` made real~~ **BUILT 2026-08-06** | 6 |
| ~~#357~~ | ~~rival offers on the same event family (retention + poaching, one moment)~~ **BUILT 2026-08-06 — phase 6 COMPLETE** | 6 |
| ~~#358~~ | ~~`src/game/Facility/` owns built spaces + bays, one bay truth; `baysByTier` retired~~ **BUILT 2026-08-06** | 7 |
| ~~#359~~ | ~~construction: buy capacity with cash + days, ceiling enforced, Growth build surface~~ **BUILT 2026-08-06** | 7 |
| ~~#360~~ | ~~facility score lights the dormant tier-gate `facility` face~~ **BUILT 2026-08-06** | 7 |
| ~~#361~~ | ~~lot cap governs buying ("31 of 35"), trade always lands~~ **BUILT 2026-08-06** | 7 |
| ~~#362~~ | ~~wholesale this unit — the aged-inventory release valve~~ **BUILT 2026-08-06 — phases 6 + 7 COMPLETE** | 7 |

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **#363 and #364 are both BUILT (2026-08-07).** The two out-of-phase live defects are closed.
- **Phase 9's queue now runs through #368.** #365, #152, #366 and #367 all landed 2026-08-08.
  #369 is deps-met (it extends #367's frontier) and #370 sits behind it; #373's deps
  (#365/#366/#371) are all but #371. #368, #371 and #372 are deps-met independently. Keep
  reading the deps column, not just the number.
- **The deal-kill frontier is a flat `data/` constant and #369 is the slice that moves it**
  (#367). `fallThroughProbability(markupPts, config)` reads `fniDealKill.safeFrontierPts`
  directly; extending it with the F&I manager's `finance_structuring` is grill Q5's "the peak
  slides toward aggressive" and belongs to #369, not to a helpful second parameter added early.
- **Nothing falls through at or under the frontier, and that is why no calibration moved**
  (#367). Balanced sits ON `safeFrontierPts` (0.0175) and the unstaffed `ambientMarkupPts`
  (0.0075) under it, so the whole pre-#367 harness corpus is byte-identical. A future session
  that raises `fniPosture.balanced.markupPts` past the frontier — or lowers the frontier — is
  charging every existing calibration run a fall-through rate it was never measured with. Move
  them together or not at all.
- **A subprime buyer cannot be over-marked at all, and it is emergent** (#367). Tier D's
  `markupCapPts` is 0.0100, below the frontier, so the aggressive posture clamps down to a safe
  markup on exactly the customers who have no alternative. That falls out of the existing cap
  table; do not "fix" it as an oversight.
- **The fall-through is read BEFORE `trade:resolved`, not at `closeDeal`** (#367). The guard sits
  at the head of `resolveTradeThenClose` because a trade resolving in between would materialize a
  trade unit onto the lot for a sale that never happened. There is deliberately **no unwind
  path** — nothing settles off a contract nobody bought. Consequence: a doomed deal never
  escalates a trade review, which is why `PlayerTradeDecisionResult` has no fall-through case
  while `PlayerDiscountDecisionResult` does (`{ status: 'finance_fell_through' }`, its own modal
  recap — the player closed that customer, so "customer walked" would point them at the wrong
  lever).
- **`walkOffContext`/`processContext` carry the fall-through like any late walk** (#367). It is
  a post-process walk: residual heat, follow-up eligibility, reputation hit. Do not special-case
  it out of the walk bookkeeping because the customer "agreed to buy" — they left without a car.
- **`fniReserve.balancedMarkupPts` is GONE and the desked markup lives in the `fniPosture`
  catalog** (#366). `resolveFinanceQuote` takes a named `{ deskStaffed, postureMarkupPts }`,
  and the posture reaches DealEngine as `getFniPostureMarkupPts?: () => number` — a closure
  wired in `createWorld` off `useLevers`, read live. Omitted ⇒ the catalog default ⇒ the old
  `balancedMarkupPts` number exactly, which is what keeps every pre-#366 harness byte-identical
  (#180 still reads 39.3% / 51.7%). Do not re-introduce a second desked-markup number beside
  the catalog, and do not read `ambientMarkupPts` as a posture — it is the no-desk answer and
  the dial cannot move it (grill Q2).
- **The posture is SLOT state and there is NO migration to write** (#366, grill I7 —
  contradicting the parked grill doc's own earlier note). It persists as one id via
  `persistCurrentSave`, restores in `loadActiveSlotIntoGame`, resets on New Game.
  `tests/worldSnapshot.test.ts` asserts two same-seed worlds at opposite postures snapshot
  identically, so a future session cannot add the bump "for consistency".
- **"More deals" works through the EXISTING PTI gate, not a new check** (#366, grill I3 paying
  off twice). The payment is built at the marked-up rate, so a thinner markup lowers the
  payment and more buyers qualify. Do not add a separate "posture affects close rate" term.
- **The #346 Prep test now asserts THREE levers.** That assertion exists to keep *navigation*
  out of Prep, and the locked IA calls Prep "pure pre-open policy" — a third policy lever
  (#366's Finance Office block) is what that admits. The button count moves with the levers;
  do not read a fourth policy lever as an IA violation, and do not park a nav link there.
- **The posture dial stays SELECTABLE with no F&I manager on staff** (#366). It renders the
  plain-language reason it does nothing yet instead of greying out: a store can set its
  standing posture before it has anyone to carry it out, and a dead control with no explanation
  is what the copy rule exists to prevent.
- **A queued `deleteDatabase` was left pending on the web dev-save IndexedDB (2026-08-08).**
  The `dealership` DB hit the documented "max of 3 slots reached" state; the delete was issued,
  returned `blocked`, and never completed because the app holds a connection — after which
  `indexedDB.open` hangs in that tab. The next reload will likely clear the three dev slots.
  They are regenerable from DEV · START AT TIER. Cleaner next time: delete a slot through the
  Load screen rather than dropping the database.
- **`data/credit-tiers.json`'s `apr` is GONE and `TierDefSchema` is `.strict()`** (#365). The
  key is `buyRate` — the lender's cost of money — plus `markupCapPts` per tier; the customer's
  rate is `buyRate + markup`. `.strict()` is load-bearing: a stale `apr` would otherwise be
  silently stripped and the file would look fine while reserve read zero. Do not relax it, and
  do not add lender flats (grill I2 — a flat is a second pricing rule the player can neither
  see nor move).
- **`computeMonthlyPayment(params, apr)` takes the RATE, not a `TierDef`** (#365), and
  `LoanParams` no longer carries `tier` (`StructureParams` does, for `structure()` only). The
  point is that quoting the wrong rate has to be a visible choice at the call site. Every
  payment a customer sees is built from the marked-up rate — `structure()` resolves it through
  `quoteFinance` — which is what makes the structural deal-kill free: PTI already measures the
  payment, so an over-marked deal fails the existing affordability gate with **no new check**
  (grill I3). `SalesProcess.CreditTierPolicy.apr` is the CUSTOMER's rate; feeding it `buyRate`
  is the regression `tests/SalesProcess.affordability.test.ts` now guards.
- **One quote serves both the gate and the close.** StaffDispatch and CustomerPool call
  `dealEngine.quoteFinance(tier)` once and hand the same `{ buyRate, markupPts, customerRate }`
  to affordability and to `closeDeal` — so the rate a buyer is qualified at is the rate they
  sign, by construction rather than by two call sites agreeing. `CloseDealParams.buyRate`
  omitted ⇒ equals `apr` ⇒ zero spread ⇒ no reserve, which is what leaves every pre-#365
  harness byte-identical.
- **Reserve POSTS REVENUE, and the first cut of #365 wrongly did not.** `economy.postRevenue(
  reserveGross, 'F&I: finance reserve')` fires at the close. Without it the Finance tab reported
  back gross the books never saw and the breakdown could not reconcile with its own Net Income —
  and the pacing harness measured *zero* change from the whole slice, which is the tell. Do not
  "fix" a future accounting question by removing it; the receivable lag from lender funding is
  not modeled anywhere here and inventing one for this line alone would be a second rule.
- **The desk read is a closure, not a roster reference.** `DealEngineDeps.getFniDeskStaffed?:
  () => boolean`, wired in `createWorld` off `staffOrg.currentRoster`; omitted ⇒ false ⇒
  `ambientMarkupPts`, the honest T1–T2 answer (grill Q2 — no player lever until #366). DealEngine
  must never import StaffOrg.
- **The KPI split is inside the module's blob, so there is no envelope bump** (#365, same call
  as #359/#151). `DealRecord.productGross`/`reserveGross` are optional and `restore` materializes
  them as zeroes: a pre-split deal's `backGross` stays whole and simply claims no reserve.
  `WORLD_SNAPSHOT_VERSION` did not move and there is no migration to look for.
- **The reserve bar is labelled "Rate Reserve", not "Finance Reserve".** The kit's horizontal
  `BarChart` clips its name column at ~13 characters — caught on the web drive, where the label
  rendered as "inance Reserve". The caption carries the full sentence. Check a long bar label
  against the rendered chart, not just the model test.
- **A customer's payment leaning is drawn on its OWN seeded stream, not out of `trait_pool`**
  (#153). Incidence is an optional `payment_traits` map on the person archetype
  (`seedFor('traits.payment')`). The shared-pool version was implemented first and reverted:
  at `trait_count 1..2` it makes a cash buyer *less* likely to be price-sensitive (the axes
  are orthogonal), and widening a 3-wide pool diluted the personality mix the **#94** sales
  calibration measures — its apathetic band went 10.2% → 9.7% and failed. **Do not "simplify"
  this back into `trait_pool`**, and do not add a future orthogonal axis there either; the
  separate stream is what keeps the personality draw byte-identical (#94 still reads
  85.7 / 10.2 / 4.2).
- **The #153 payment traits use TWO effect keys and that is deliberate.**
  `payment.cash_probability` is an additive shift on the visit archetype's base;
  `payment.must_finance` is categorical, and **wins when a customer carries both**. Collapsing
  them into one scalar with a dominating negative was considered and rejected — it flattens a
  leaning and a category into two sizes of one knob, and is not absolute against a customer
  who drew both. Neither trait needs an exemption from the cash-affordability gate: **that gate
  only ever pushes a customer toward finance, never away from it.**
- **#153's live-band movement is dose-dependent, so it is NOT the #151 trajectory-divergence
  signature.** Halving every incidence rate lands halfway (positive 38.7% → 36.1% → 33.3%,
  trade rate 43.3 → 41.3 → 39.3 — cash buyers trade less, and trade-incidence is keyed by
  `paymentMethod`). Rates were therefore chosen to leave the calibrated bands where they are
  rather than re-centring them: **C2 owns these magnitudes (grill I9)**, and a trait slice does
  not get to move the store's close rate 5pp on its way past. Final read: positive 35.8%,
  apathetic 54.3%, both inside their current windows, nothing re-centred.
- **Three walk-driven magnitudes were retuned by #363 and the small numbers are deliberate.**
  `walkSatisfactionPenalty` −1 → **−0.12**, `walkPressure` 0.5 → **0.05**, `angerPressure`
  2.0 → **0.4**. All three had been set against a producer that never fired; the live floor
  walks ~88% of its ups, so at the old values one career drove a competently-run store's
  satisfaction 70 → 12.5 and **pinned regulatory pressure at 80 — the AG threshold, terminal
  at Tier 1**. Do not read the magnitudes as timidity: `walkSatisfactionPenalty` is charged
  ~2.6 times a day, every day. Full reasoning + measurements in the log entry below and in
  `src/game/Reputation/CLAUDE.md`.
- **Phase 5c is DONE — the whole UI-layout rebuild landed 2026-08-02** (#346 Operations, #347
  People, #348 nav stacks, #349 Growth, #350 chart kit, #351 Finance). Every defect in
  `docs/audits/ui-layout-audit.md` is closed out: no placeholder tabs, no dead Operations
  destinations, and walking into a room no longer unmounts the console. **Do not re-grill the
  IA** — `docs/planning/second-level-ia.md` (locked 2026-06-12) stays authoritative; where
  shipped and locked disagree, locked wins.
- **The round-1 script was REFRESHED against the shipped app on 2026-08-06 and is now
  accurate — do not re-walk it from the pre-5c version.** Every navigation path in the old
  script had drifted: hiring moved to **People → Hiring**, the auction is entered from
  **Operations → Lot → Go to the Auction**, and the demand readout / market report / wire all
  moved off Home into **Growth** (Home keeps a Market *glance* that routes there). The known-
  dark list still claimed Finance and Growth were placeholder tabs. Both halves were rewritten
  together — `docs/planning/playtest-round-1.md` and `data/playtest-script.json`, which is what
  the phone actually renders — and the card was re-read in the running app.
- **The script now also measures phases 6 + 7, which did not exist when it was written**:
  wages and the signing fee on the Day 0 hire, payroll on the Day 3 second hire, the six-space
  lot cap on the Day 2 buy, the wholesale quote on Day 4 and the valve on Day 5, and a roster
  sweep for raise asks / rival offers (which sit on a person's card and never interrupt — that
  is deliberate, and whether the player *finds* them is a round-1 question, not a defect to
  pre-emptively fix). The observation sheet is 14 questions, not 12.
- **Both staff gates are ruled — no decision stands in front of the next build.** `/decide C1`
  2026-08-02, `/decide A2` 2026-08-03. A2's rejected alternatives (overflow lot, forced
  wholesale, refused trades, soft cap, prep-as-its-own-capacity) are recorded **with reasons**
  in §3 A2 — do not reopen them, and in particular do not re-propose an overflow lot, which the
  director raised and then withdrew on inspection.
- **#353 and #354 ARE verified on web (2026-08-06) — their log entries' "web drive was
  impossible" lines are superseded.** The blocker was never the app: `left_click` delivers
  `pointerdown` and then hangs, flushing `pointerup` only on the *next* `computer` call, so a
  single click leaves the press half-finished. **Issue every click twice**; both report a
  30s timeout, and the UI responds. The full path drives fine — start menu → T2 fixture →
  tabs → floor sim → day close → recap modal → Finance. Written up in `.claude/skills/verify`;
  do not file another BLOCKED verdict against the pane without trying the double-click.
  **Update, later the same day (#356): single clicks worked, returning immediately with no
  timeout.** So the double-click is a *fallback*, not a standing rule — click once, read the
  page, and only re-issue if nothing moved. And when a press seems dead, check the console
  before the app: three "dead" T2 presses were really `Cannot create slot: max of 3 slots
  reached` from earlier sessions. Clear it by deleting the `dealership` IndexedDB — which
  needs a page reload first, since an open connection blocks the delete.
- **A hidden Browser pane makes measuring charts unverifiable, and it looks exactly like a bug.**
  No `ResizeObserver` and no `requestAnimationFrame` fire, so react-native-web's `onLayout` never
  runs, `useChartWidth` stays 0, and `BarChart`/`Sparkline` collapse to an empty 0-height div.
  `DonutChart` still paints (explicit `size`, never measures) — that contrast is the fastest
  tell. Probe + guidance are in `.claude/skills/verify`; do not report a measured chart broken
  without running it.
- **#352 is built — `data/staff-slots.json` is now the ONE ceiling in the game.** `headcountCapByTier`
  is gone from the JSON and the schema; `staffOrg.headcountCap` survives only as the *derived* sum of
  the tier's role slots. Every wage slice from here sits on `getSlots`/`getSlotBoard`. The table is
  monotonic and the schema **refuses a file that decreases**, so the CSV's T4/T5 `f&i-manager` omission
  cannot be re-introduced as a removal. Do not add a second cap beside it.
- **The Tier-2 dev fixture holds a UCM, whose desk does not open until T3** — the slot board reads it
  honestly as "1 of 0". That state predates #352 (the flat cap allowed 8 bodies at T2 regardless of
  role) and is unreachable in real play, since `hireTier` gates the UCM at T3 and no tier takes a desk
  away. It is a stale fixture, not a live bug; over-capacity displays plainly and blocks further
  hiring, which is the same grammar A2 R2 gives the lot cap ("36 of 35").
- **5a issue states on GitHub are not trustworthy.** #334 was CLOSED-but-undone. Check each
  of #335–#339 against the repo before assuming it landed. (#339 is closed as **sliced**, not
  built — its work was #343/#344/#345, all three now built.)
- **The seeded-RNG separator is a NUL byte, and it is invisible.** `deriveSeed` joins namespace
  and ctx with U+0000. #342 nearly shipped a whole-game determinism break by retyping that line
  with a space. `tests/Rng.test.ts` carries the regression lock that caught it — never weaken it.
- **Staff have TWO grades and they are not interchangeable** (#353). `grade` is derived live
  from the **grown** `effectiveSkills` and climbs; `paidGrade` is stored on `Staff`, stamped at
  hire, and is what the wage is computed from. Every wage number the player sees or the ledger
  charges comes from `paidGrade`. Reading the current grade to price someone is the rejected
  "wage auto-follows grade" and silently kills #356's raise trigger.
- **Both staff prices now come out of `data/staff-pay.json` and nowhere else** (#355). The hire
  fee is `hireFeeMultiple × that candidate's daily wage`; `staffOrg.hiringCostByTier` is gone from
  the JSON and the zod schema. `CandidateListing.hiringCost` keeps its name but is per **person**,
  not per role tier — do not re-introduce a second price table beside the wage book, and do not
  read the name as "the role's price". Consequence for tests: the `noPay()` helper now makes hires
  **free**, so any suite asserting that a hire costs something must pass a real wage table
  (`wageSetup` in `tests/StaffOrg.test.ts`).
- **The wage a member is paid is now STORED, not derived** (#357). `Staff.paidWage` is what the
  drain charges; `paidGrade` records the grade it was agreed at and still drives the raise
  trigger. They can legitimately disagree — a matched rival offer pays *above* the grade's book
  wage — so never "fix" a card by re-deriving the wage from `paidGrade`. Consequence for tests:
  a helper that drops someone's `paidGrade` to fake an outgrown rookie **must clear `paidWage`
  too** (`payAtGrade` in `tests/StaffOrg.test.ts` does), or restore keeps the old money and the
  ask is correctly suppressed.
- **`staff:quit` has TWO publishers since #357** — StaffMorale's threshold check and StaffOrg's
  declined/expired rival offer. StaffOrg's own subscriber removes them from the roster either
  way; that is the single departure path and there must not be a second. The payload's `morale`
  is optional (absent on a poach) and `name` is required, because HistoryLog records a person.
- **Do not add a "poachable" floor or a "recently poached" flag.** Target selection is one rule
  — the daily chance scales with grade — and the two suppressions are the absence of a decision
  (an open prompt, or an offer that does not beat current pay). Both were considered and are
  deliberately not there.
- **`flatPay`/`noPay` are FLAT across grades, so no test built on them ever raises a demand**
  (#356). The ask is suppressed when the asked wage does not actually beat the paid one — a
  prompt whose two buttons cost the same is a decision with nothing in it. A suite that wants
  to exercise a raise must pass a table with a real wage curve (`WAGE_TABLE` /
  `TOP_GRADE_TABLE` in `tests/StaffOrg.test.ts`).
- **`payVsMarketBonus` is GONE and the two replacements are sign-checked by schema** (#356):
  `paidAtMarketBonus` must be positive, `paidBelowMarketPenalty` negative (same for
  `raiseAcceptedBonus`/`raiseRefusedPenalty`). A positive penalty would mean underpaying
  cheers people up and would read as balance rather than a dropped minus sign. StaffMorale
  reads the comparison off `StaffOrg.getPayBoard().askingWage` — never re-derive it there.
- **A refusal has no quit path of its own.** It lowers morale and the standing overnight
  risk check takes it from there. Do not add a "quits because refused" branch — the one the
  design ruled on is the existing `StaffMorale` → `staff:quit`.
- **The #352–#362 issues can name files 5c deleted.** #354 was filed against
  `src/ui/PersonnelScreen/PersonnelScreen.tsx:22` and a `flexDirection` defect in it; #347 had
  already deleted that whole screen and the kit `ProgressBar` that replaced it sizes fills by
  **percentage width**, so the defect was gone. The slice was written off
  `docs/audits/ui-layout-audit.md`, which predates the rebuild. **Check a named `file:line`
  against the repo before treating it as live** — and never re-create a deleted defect to
  satisfy the letter of a criterion. Assert the criterion against the surface that actually
  ships.
- **The RN-Testing-Library suites (`App.saveFlow`, `InTabNavigation.reachability`) flake under
  full-suite CPU load.** Two `waitFor` assertions failed on one `npm test` run and a *different*
  one failed on the next; all pass in isolation three times over and the full suite is green on
  a re-run. Timing, not a regression — re-run before investigating, and do not "fix" them by
  loosening what they assert.

- **Construction jobs live INSIDE the `facility` blob, and that was not an envelope bump**
  (#359). `FacilitySnapshot` went `schemaVersion` 1 → 2 (`built` + `jobs` + `jobSeq`);
  `restore` takes the `AnyFacilitySnapshot` union and a #358 v1 blob restores as "nothing
  being built". `WORLD_SNAPSHOT_VERSION` stays **21**, `data/fixtures/tier-2.json` was
  deliberately **not** re-stamped, and there is no v21→v22 migration to look for. Do not add
  one.
- **`FacilityCeilingSchema`/`loadFacilityCeilings`/`FacilityCeilingTable` are RENAMED** to
  `FacilityDataSchema`/`loadFacilityData`/`FacilityDataTable` (#359), and `FacilityDeps.ceilings`
  is now `FacilityDeps.data` — the file holds construction prices as well as ceilings, so the
  old name was a lie. `createFacility` now requires `bus`, `economy` and `getCurrentDay`; suites
  that only READ capacity take `readOnlyFacility(() => tier)` from `tests/helpers/facility.ts`.
- **A block is the size of one job, not a divisor** (#359). `blockSize` is clamped down to the
  room left under the ceiling and priced for what it actually builds (5 against a gap of 4
  builds 4 for 4× the unit cost). That is what makes the ceiling exactly reachable with ONE
  pricing rule; do not add a prorated or full-price "last block" special case. The ceiling is
  measured against built **plus in flight**, so the same space cannot be bought twice.
- **A fresh world at any tier is already AT its ceilings, so every Build button is disabled**
  (#358 seeds built = ceiling). Room to build only exists after a tier-up, which is the whole
  point of A2 R1. To exercise construction on web you must stand the store below its ceiling —
  edit `built` in the saved `facility` blob and reload, the way the #359 drive did. This is not
  a bug, and "the build surface does nothing" on a fresh save is the expected reading.

- **Built capacity CARRIES OVER on tier-up, and that is a real behavior change** (#358). A
  fresh world seeds at its tier's ceilings, so nothing about a new game moved; but a store
  that tier-ups keeps the bays it had, and the ceiling is all that rises. That is A2 R1
  ("buildings are bought") and it is what makes #360's `facility` gate face measurable at all
  — do not "fix" a Tier-3 world showing 0 body bays by granting capacity at tier-up. **A test
  that fakes a tier by forcing `tierManager` must also call
  `world.facility.restore(createDefaultFacilitySnapshot(tier))`** — the same shape a tier-N
  save carries. Two suites already do (`AdvisorHiring.reachability`, `CrossDepartmentPersistence`).
- **`baysByTier` is GONE from both dispatch configs and from `data/tunables.json`** (#358). The
  engines take a `bays` **count** (`DeptDispatchDeps`), fed per-day by each department package
  from `facility.getBuilt()`. Omitted ⇒ 1 bay. Do not re-introduce a per-tier bay table beside
  the Facility module, and do not read the tier for a bay count anywhere.
- **`facility:capacity_built` is the module's ONE event** (#359, superseding #358's "no bus"
  note). It fires from `clock:day_started` when a job lands, carrying the kind's new TOTAL in
  `built` and the delta in `units`. There is deliberately no `construction_started` event —
  it would have a publisher and no subscriber, which is the dead code this repo deletes.

- **The `facility` gate face is NO LONGER DORMANT, and every "skip stepped" filter is gone**
  (#360). `TierGate`'s `computeVerdict` and `getTierRequirements` used to filter
  `kind !== 'stepped'`; both now filter only on "is a configured face" (which is what keeps
  the `streak` control tunable out). A stepped face is read **live** off `signals[id]`, never
  sampled — there is no `levelSamples.facility`/`trendSamples.facility` and nothing about it
  in the snapshot. Do not add nightly sampling to make it "consistent" with cash/CSI: a
  monthly average would report a bar the store has already cleared as still short, and would
  make the same construction worth more early in the month than late.
- **The facility score is a MEAN OF PER-KIND RATIOS, not a combined total** (#360,
  `Facility.getFacilityScore`). Built ÷ ceiling per kind, averaged over the kinds the tier has
  a ceiling for, each capped at 1. A combined built÷ceiling would let the lot (35 spaces at T3
  against 6 service bays) buy the whole score while the shop ran on one bay. A kind with a 0
  ceiling is **excluded**, not scored 0 — that is why a fully built-out T1/T2 store reads 100
  despite having no body bays, and why arriving at T3 *drops* the score.
- **The face label is "Facility Build-Out", not the old "Facility / Image"** (#360,
  `data/tier-gate.json`). The image half was re-homed onto the T4+ OEM stream by
  goals-targets decision 4 and is not what this face measures; the old label only survived
  because the face was invisible. Renaming it is the plain-language rule, not a design change.
- **A T3 world is where this face exists at all** — `data/tier-gate.json` lights `facility`
  only at tier 3. To see it on web, edit `slot:<id>` (NOT `snapshot:<id>` — the live save the
  app loads is the slot record) and set `modules.tierManager.currentTier` to 3.

- **Buying cars is capped now, and any test that bulk-buys the board will fail** (#361). Four
  suites did — `Composition.completeness`, `DemandShaper.reachability`, `Reveal.reachability`,
  `MatchPayoff.reachability` — all with "buy every affordable listing" loops written when the
  lot was unlimited. The fix is one line, `if (world.inventory.getLotOccupancy().atCapacity)
  break;`, not a bigger lot: a **tier-1 lot holds six cars and the #296 seed already parks
  three of them**, so a green world can buy exactly three. Do not "fix" a new failure of this
  shape by raising a ceiling.
- **`Inventory` gained ONE new read and ONE new dep, and neither has a second copy** (#361).
  `getLotOccupancy()` → `{ occupied, built, spacesOpen, atCapacity }` is the only place the
  rule lives; both surfaces state it and neither counts its own list. Built spaces arrive
  through `getBuiltLotSpaces?: () => number`, wired to `facility.getBuilt().lotSpaces` — the
  same closure idiom as the bay seam, read live so finished construction reopens the lane by
  itself. **Omitted ⇒ uncapped**, which is what keeps the pre-#361 harnesses honest; a
  0-default would have silently frozen every test world.
- **`occupied >= built` is the freeze, so "back at the cap" is still frozen.** A trade always
  lands and can put the lot at 7 of 6; selling one leaves 6 of 6, which still refuses a buy.
  The rule is "back **under**", not "no longer over" — a test asserting the lane reopens after
  one sale is asserting the wrong rule.
- **A car in prep occupies a space.** Recon is a cost, not a place, and the #295 frontline hold
  only governs whether walk-ins can be *shown* the car. No off-lot state was invented and none
  should be — prep-as-its-own-capacity is one of A2 R2's five recorded rejections, along with
  forced wholesale, the overflow lot, refusing the trade, and a soft cap with a fee.

- **`inventory:vehicle_sold` now means A PERSON BOUGHT THIS CAR, and only that** (#362). A
  wholesale-out publishes `inventory:vehicle_wholesaled` instead — **including the #162
  recon-abandon path**, which used to publish `vehicle_sold` and was therefore feeding
  MarketEconomy a wholesale dump as a *retail comp* (dragging the segment's price index down)
  and staging the wholesaler in InstalledBase as a future owner. The abandon path keeps its
  own price rule (`book − reconSpentToDate`); only which event it is changed. A suite
  asserting `vehicle_sold` on an abandon is asserting the old lie —
  `tests/Inventory.recon.test.ts` was updated and now asserts **zero** `vehicle_sold` there.
- **Wholesale proceeds come off BOOK, never off `askingPrice`** (#362), and there is exactly
  one place the rule lives: `Inventory.getWholesaleQuote()`. The Lot room states that quote
  and never re-derives a price or subtracts its own cost basis. The quote is a **pure read** —
  nothing leaves the lot and no money moves until `wholesaleVehicle()` — which is what lets
  the confirmation sheet show proceeds and the realized loss *before* it commits.
- **There is deliberately no gate on recon status or the frontline hold for wholesaling**
  (#362). Both describe a car already sitting on the lot burning money, and the units the
  player most wants to dump are exactly the ones they regret. Do not add "you can't dump a
  car mid-recon" — that is a second ceiling for a mechanic whose whole point is one rule.
  This is also **not** the rejected "forced wholesale on overrun" (A2 R2): the player picks
  the unit and sees the number.

- **#286 closed the #180 gap: `live` positive is now 28.5%, not 2.2%** — and the cause was
  NOT what #180 suspected. Willingness-to-pay already sat ~6% *above* the ask and the quadrant
  was accepting 58% of worked ups. The store's **cost basis sat above its own asking price**
  (`floor/ask` = 1.32), so the deal was dead on price before the customer formed an opinion.
  Four terms, each a mis-model rather than a number needing a nudge: recon was a flat dollar
  figure per condition (half the value of a cheap rough unit) → now `conditionTiers[*].reconPct`;
  the auction lane centred at book with a 1.20 ceiling (you could pay 20% OVER book at a
  wholesale auction) → now 0.85, matching the wholesale haircut the same module already pays
  out; the retail markup was thinner than the basis → +0.10; and a wholesale comp was measured
  against the bare anchor, so once the lane moved below book every purchase drifted the segment
  down. Full write-up: `docs/planning/pricing-demand-spine.md` §6.
- **The residual gap to `reference` (85%) is the Value meter, not price.** A six-space lot
  yields a best-of-six match (Value ≈ 0.60) against #94's perfect one (≈ 0.85), and Value
  dominates `objectiveDeal`. Closing it is a stocking-capacity question — the tier ladder —
  **not another pricing knob**. Do not re-open the price model chasing the last 55 points.
- **Centering the auction below book alone was tried and reverted in #180 and that finding
  still stands** — `meanMultiplier` 0.85 on its own moved the close rate ~0.4pp, because recon
  was eating the spread. It is one of three terms, never the fix by itself.
- **Both calibration bots now run the #362 release valve, and that is load-bearing** (#286).
  Without it the harness measures a store that *cannot restock*: a unit nobody will buy holds
  one of six spaces forever, mean lot age climbed to 123 days and the close rate halved twice
  over (62% → 22%). Same class of correction as the standing float top-up — the bot has to make
  the standing decisions an operator makes. Do not read a future age-driven collapse as an
  economy regression before checking the bot still disposes.
- **`no_fit` is 71% and that is recorded as real tier-1 scarcity, not a stocking bug** (#286).
  The lot is measurably FULL (6.01 of 6 spaces, 5.0 past the frontline hold) and still cannot
  match 7 of 10 walk-ins — six cars is a thin draw against six SPACED axes plus an affordability
  gate. It rose from 51% because cars now actually sell (composition churns instead of
  presenting the same frozen six) and the ask is 10 points higher. **`pickVehicleForMatch`
  filters on affordability BEFORE fit, so a customer priced out reads as `no_fit` rather than
  as a price walk** — worth surfacing separately one day, and the reason markup was not raised
  further (+0.10 is the measured peak of total cars sold; past it the close band keeps improving
  while the store sells fewer cars).
- **The balance harness no longer bankrupts before Tier 2** (#286, supersedes the standing
  "expected, don't investigate" note). `npm run balance -- pacing`: 90 of 100 seeds advance to
  T2, median survival 360 days, bankruptcy 19%. The new pacing miss is the opposite one — **T1
  now clears in a median 1.0 month against a 2.0-month target** (status OUT). That is a
  tier-gate calibration question, not a pricing one.
- **`customer:resolved` now covers walks too, and CustomerPool is still its only publisher**
  (#363, superseding #180's "subscribe `staff:auto_resolved` when reading outcomes" note for
  the *resolution* question). Three drivers reach it — `deal:closed`, `staff:auto_resolved`
  with `outcome: 'no_sale'`, and `dispatch`. Do not add a fourth publisher in another module:
  the session lifecycle and the terminal-stage guard that stops one customer resolving twice
  both live in `CustomerPool`. `staff:auto_resolved` remains the right subscription for the
  *close-quality* fields it uniquely carries (`brand`, `badReview`, `matchQuality`).
- **`SalesProcess.residualHeat` is the ONE definition of walk warmth** (#180). It was
  hand-copied between `CustomerPool` and the #94 harness; the weights now live in
  `data/sales-process.json` `heat` and must sum to 1 (schema-refused otherwise). Do not
  re-derive the formula at a call site — that duplication is what let the two drift.
- **A green operator's floor is a QUALITY floor, not a volume floor** (#181). The green solo
  profile (0.35/0.40) closes 3.0% of worked ups against the competent 0.75/0.75 operator's
  2.4% — but **every one of those closes is a low-trust forced close** (0.0% positive against
  `live`'s 2.2%), and `trust_collapse` walks go 17 → 115. Do not "fix" a future #181 failure
  by expecting green to sell *less*; the axis skill moves here is whether the customer leaves
  happy. `data/market-calibration.json#earlyGame` states its two margins as **distances** from
  `live`/`reference`, and a schema refine enforces the whole band sits under
  `live.positiveMin − marginBelowLive` — so #286 cannot raise `live` without moving the floor.
- **#286 gave the recon bands a real denominator** (superseding #181's "acquisitions are
  starved" note). A green six-space lot turned 9 units in the window before and turns **43**
  now, with 29 completed recons and the tail actually firing (1 hit, 2.3%). The tail *rate*
  stays a documented ceiling guard; `reconOverrunMin/Max` (mean realized ÷ estimated recon) is
  still the band with power — 1.072× measured against the ~1.061 `data/recon-variance.json`
  implies. Do not tighten the tail rate to look precise.
- **Two customers can be held on the SAME unit** (#181 → **#364**, FIXED 2026-08-07). Nothing
  reserves a vehicle while a `trade:escalated` / `discount:escalated` review is pending, and
  nothing should — the first resolution drives the car off the lot and the second customer now
  **walks** (`vehicle_sold_to_other`) instead of dying on `No lot vehicle` inside
  `DealEngine.closeDeal`. Both harnesses have dropped the `try/catch` +
  `escalationsLostToSoldUnit` tally they carried as the workaround.
- **The #180 harness deliberately capitalizes its bot** (`BOT.floatFloor`/`floatTopUp`). At a
  2% close rate the store goes insolvent long before 600 worked ups, which would silently
  shrink N and make the bands move whenever calibration changed. Solvency + pacing are the
  balance harness's job (`scripts/balance-harness/`), not this test's. It also pins the
  salesperson's **base** skills to 0.75/0.75 (derived from the catalog's caps, not hardcoded)
  while leaving morale free to drift — the drift is the emergent variance under test.

- **ANY new term in the `pickVehicleFor` argmax re-routes the whole #180 seeded run, and its
  size is not what does it** (#151). Adding per-brand reputation moved the live band 28.5% →
  39.0% positive / 64.5% → 51.7% apathetic / 213 → 290 closes — and `matchWeight` **0.05 and
  0.15 shift it by the same amount in the same direction** while **0.001 reproduces the
  pre-#151 run exactly**, because at that size the term never flips a near-tie. So a moved
  band here is evidence of trajectory divergence, not of a strength or balance regression, and
  **this harness cannot be used to choose a match weight** — a C2-class pass owns those
  magnitudes. The apathetic band was re-centred on the new measurement at its old width
  (0.58–0.72 → 0.45–0.59); `positiveMin` was left at #286's 0.24 because a floor that is still
  cleared is not evidence for a new floor. Business-level pacing did **not** move (91/100 to
  T2, 18% bankrupt, median survival 360, T1 still 1.0mo vs the 2.0 target). Full reasoning:
  `data/market-calibration.json#live._doc`.
- **Per-brand reputation feeds off `staff:auto_resolved`, never `deal:closed`** (#151), and it
  is the only consumer of that event's new `brand` field. The pairing it needs — which make,
  and how the delivery went (`badReview`) — exists on exactly one event; `deal:closed` carries
  no satisfaction signal, so sourcing it there would mean re-deriving one at a second call
  site. **A walk moves no brand.** `ReputationSnapshot` went v1 → v2 (module-owned; the
  `modules` key set is unchanged, so there is **no envelope bump and no migration to look
  for** — a v1 blob restores as "no make has a record yet"). And there is deliberately **no
  brand-reputation screen**: `tests/Reputation.perBrand.test.ts` fails if any UI file reads
  `repFor`/`brandReputation`.
- **#152 uses TWO product keys and that is the same call #153 made.** `loanSensitivity` is the
  scalar — attach is multiplied by `1 − loanSensitivity × (1 − financedShare)`, so 0/absent is
  flat across every structure. `requiresFinancing` is **categorical and checked ahead of the
  roll**: GAP covers the gap between a loan balance and the car's value, so it cannot attach to
  a cash deal at any sensitivity or any RNG value. Collapsing the gate into "sensitivity 1.0"
  reproduces today's behavior and is wrong for tomorrow's — **C2 owns these magnitudes (I9)**,
  and a calibration pass must not be able to tune loan-gap coverage onto a cash sale.
- **The attach roll is drawn for EVERY available product, including a gated one** (#152). The
  `continue` sits after `rng()`, so gating GAP does not shift the stream for the products after
  it and the same customer on the same seed sees the same menu decisions. That is what makes
  `tests/DealEngine.attach.test.ts` able to assert the flat products' attach counts are
  **exactly** equal across cash / standard / heavy-down rather than merely close. Do not move
  the gate above the draw to "save" a call.
- **`computeAutoFni` takes ONE named input, not four positional args** (#152, the #365 pattern):
  a menu presented against no structure was the silent default, so `deal` is required and every
  call site states it. **StaffDispatch resolves down payment / loan amount BEFORE presenting** —
  it used to attach first — which also means trade equity correctly shrinks the note and thins
  the menu with it.
- **The live #180 bands moved and the pacing blend rose, and neither is a calibration change**
  (#152). Nothing in `data/market-calibration.json` was touched. Fewer products attach on cash
  and heavy-down deals ⇒ less back gross ⇒ a different cash trajectory, which is the documented
  #151 sensitivity of that seeded run. Both bands still hold.
- **`KPISnapshot.backEndByStructure`'s three buckets are DISJOINT** (#152) — `heavyDown` is
  carved out of `standardFinance`, so the three `backGross` figures sum to total back gross.
  That is deliberately unlike the older `financeUnits`, which counts heavy-down deals too. Each
  bucket carries `perUnit` because a total only reports which structure was commonest. All of it
  is derived from `DealRecord` fields already persisted: **no envelope bump, no migration.**
- **`ZERO_KPI_SNAPSHOT` is now exported from the KPIDashboard barrel** (#152). Four test
  fixtures were each hand-writing the full snapshot shape, so every new KPI field broke all four
  the same way; they spread the constant now. A fixture that needs "empty" must not re-copy the
  shape.
- **A long bar `valueLabel` is clipped by the chart, not just a long label** (#152, extending
  #365's lesson). The horizontal `BarChart` reserves `VALUE_COLUMN = 56px` and draws the value as
  SVG text past the plot edge, so `"$2,100 · 3 cars"` is cut off. The unit counts therefore live
  in the caption — which also suppresses them entirely on an empty window, because "averaged
  over 0 cash" reads as a broken sentence rather than a fact.
- **The F&I posture is SLOT state, not world state** (phase 9 gate, I7). The parked grill's own
  note said the standing volume↔gross posture needed a `WORLD_SNAPSHOT_VERSION` bump and a
  migration. It does not — every sibling lever (`tradePolicy`, `pricingStrategy`, `sourcingLean`)
  persists as an id on the save slot via `persistCurrentSave` (`src/app/useLevers.ts:105`), and
  the posture joins them. Do not go looking for a migration to write.
- **`data/credit-tiers.json`'s `apr` is the CUSTOMER's rate today, and that is the lie phase 9
  fixes** (I2). It becomes `buyRate` — the lender's cost of money — with the customer's rate being
  `buyRate + markup`. Same numbers, honest name. Deliberately **no lender flats**: a flat is a
  second pricing rule the player can neither see nor move.
- **F&I gets ONE player input and it is not per-deal** (phase 9, Q5 + Q9). A three-position store
  posture — "More per deal" / "Balanced" / "More deals" — that the F&I manager executes optimally
  within. There is no manual deal screen, no per-product switch (Q10), and no slider. A future
  session proposing any of those is re-opening a closed grill.

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
| 5 | C3 playtest gate (#74), round 1 — HITL | — | **handed over 2026-08-06** — script refreshed + verified in-app; with the director. Closes on their verdict |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance (all built 2026-08-02) | — (locked IA already ruled it) | done |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | done — #352–#357 all built |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | done — #352 + #358–#362 all built |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | done — all three built |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **LOCKED 2026-08-07 — `fni-mechanics-grill-state.md`** (grill CLOSED, Q1–Q10 + 9 internal calls) | active — sliced into #151–#153 + #365–#373; **#151 + #153 BUILT 2026-08-07, #365 + #152 + #366 + #367 BUILT 2026-08-08**, six left, next is **#368** |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | largely absorbed by 5c (#349/#350/#351); re-scope when reached |
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

- 2026-08-08 — **BUILT #367** (the teeth: an over-marked deal falls through instead of closing).
  Without them "More per deal" was strictly better than the other two positions and #366's dial
  was not a decision. A financed contract written past a safe markup frontier now doesn't get
  bought — the lender passes on the paper, or the customer rate-shops it and leaves — so
  aggressive markup means fewer financed deals actually stick.
  **One curve, three numbers, all in the same unit** (`data/tunables.json` `fniDealKill`, grill
  I8): `maxFallThroughRate × clamp01((markupPts − safeFrontierPts) / fullKillRangePts)`, **flat**
  past the end of the ramp. A curve that kept climbing would eventually refuse every deal, which
  is a wall rather than a trade-off. No per-lender branching, and no second knob.
  **At or under the frontier the answer is exactly ZERO, and that is load-bearing rather than
  incidental.** Balanced (0.0175) sits ON the frontier and the unstaffed `ambientMarkupPts`
  (0.0075) sits under it, so **every pre-#367 harness is byte-identical** — the whole calibration
  corpus measures a store that never loses a deal to this. It is the reach past Balanced that
  costs something. It also falls out that a **subprime buyer cannot be over-marked at all**: tier
  D's lender caps markup at 0.0100, below the frontier, so the most desperate customer is not the
  one you can gouge. That emerged from the existing `markupCapPts` table; it was not designed in.
  Measured on the shipped curve, 40 financed ups per posture: **more-per-deal 12 fell through /
  28 closed** (modeled rate 0.2625), **balanced 0 / 40**, **more-deals 0 / 40**.
  **The lender is asked BEFORE anything settles, and the placement is the whole correctness
  argument.** The roll happens once, beside the quote that sets the markup (`rollFinanceFallThrough`,
  seeded `deriveSeed(masterSeed, 'fni.deal_fallthrough', { customerId, day })` ⇒ replay-safe): it
  turns on the rate and nothing else, so price, trade and player deliberation cannot move it. The
  answer is then read at the head of `resolveTradeThenClose` — **not** at `closeDealAtPrice`,
  because `trade:resolved` fires in between and would materialize a trade unit onto the lot for a
  sale that never happened. There is deliberately **no unwind path**: nothing settles off a
  contract nobody bought, so the check sits ahead of the settle rather than reversing it after.
  **A doomed deal therefore never escalates a trade review** — there is no decision left to make
  on it — which is why `PlayerTradeDecisionResult` has no fall-through case by construction.
  **The held discount review is the one place the player is present for it**, and it needed its
  own terminal status. `settleDiscount` used to return `{ status: 'closed', soldPrice, frontGross }`
  unconditionally; on a fallen-through deal that would have been a recap reporting a sale the
  ledger never saw. It returns `{ status: 'finance_fell_through' }`, and the modal says so in its
  own words — the player DID close this customer, and pointing them at "customer walked" would
  point them at the wrong lever. Same shape as #364's `vehicle_sold`.
  Walk reason **`finance_fell_through`**, carrying `processContext` — an ordinary post-process
  walk with residual heat, follow-up eligibility and a reputation hit like any other — plus a
  starred Reveal walk-off line naming the rate. A cash buyer has no lender to refuse them.
  This is the **contractual** kill only. The structural one — a marked-up payment breaching
  `ptiCap`/`maxTerm`/`ltvCeiling` — is not re-implemented here because it never needed
  implementing: the payment is built at the marked-up rate, so it falls out of the affordability
  gate that has always existed (grill I3, paying off a third time).
  No web drive. Nothing new renders unconditionally — the two new surfaces (the Reveal line and
  the modal recap) need a T3 store with an F&I manager at "More per deal" *and* a below-floor
  discount escalation *and* a losing roll to appear at once. They are covered by the flow tests,
  the copy anti-orphan assertion and a modal smoke case instead, and that is stated rather than
  reported as verified.
  231 suites / **2971** tests, typecheck clean. The one full-suite failure was
  `App.recapPersistence` timing out on a `waitFor`; it passes in isolation and the re-run was
  green — the documented RN-Testing-Library CPU-load flake.
  Next: **BUILD #368** — CSI drag, the over-marked customer who publishes
  `reputation:satisfaction_hit` (Q3 secondary). #369 is now deps-met too.

- 2026-08-08 — **BUILT #366** (the player finally gets to tell the finance office what to do).
  A three-position standing posture — **"More per deal" / "Balanced" / "More deals"** — in the
  `fniPosture` catalog in `data/tunables.json`, the exact shape of `tradePolicy`. It is the
  store's ONE F&I input and it is standing, not per-deal (grill Q5/Q9/Q10): no slider, no
  per-product switch, no manual deal screen. A session proposing any of those is re-opening a
  closed grill.
  **`fniReserve.balancedMarkupPts` is GONE, and deleting it is the load-bearing call.** The
  desked target now lives in the posture catalog and nowhere else — keeping both would have
  left the same number in two files, free to drift, which is precisely the duplication #180
  found in `residualHeat`. `ambientMarkupPts` stays where it is because it is not a posture:
  it is what the store earns with nobody on the desk (grill Q2), and the dial cannot move it.
  **The dial persists as one id on the save slot and there is NO envelope bump** (grill I7 —
  an explicit correction to the parked grill doc's own note, which claimed a
  `WORLD_SNAPSHOT_VERSION` bump and a migration were needed). It joins `tradePolicy` /
  `pricingStrategy` / `sourcingLean` through `persistCurrentSave`, restores in
  `loadActiveSlotIntoGame`, resets on New Game. `tests/worldSnapshot.test.ts` now asserts two
  same-seed worlds at opposite postures snapshot identically, so a future session cannot
  "helpfully" add the migration. **Do not go looking for one to write.**
  **"More deals" is a real trade rather than a smaller number, and it cost nothing to make
  one.** The payment is already built at the marked-up rate (#365), so PTI — the affordability
  gate that has always been there — prices more buyers out at the aggressive posture and fewer
  at the thin one. That is grill I3 paying off a second time: **no new check was added**, and
  `tests/FniPosture.test.ts` pins the payment difference on identical structures.
  `resolveFinanceQuote` now takes a named `{ deskStaffed, postureMarkupPts }` (the #365/#152
  pattern — a quote resolved against no posture is a silent default), and the posture arrives
  as `DealEngineDeps.getFniPostureMarkupPts?: () => number`, a closure wired in `createWorld`
  and read live so a change on the lever moves the very next deal. Omitted ⇒ the catalog
  default ⇒ **the old `balancedMarkupPts` number exactly**, which is why every pre-#366 harness
  is byte-identical: the #180 live bands read **39.3% / 51.7%**, the same figures #152 left.
  `resolveFniPostureMarkupPts` mirrors `resolveTradePolicyMultiplier` — unknown id ⇒
  `defaultId`, retired default ⇒ first posture, so it always returns a real markup and the
  composition root never null-checks it.
  Surfaced in **Operations → Prep as "Finance Office"**, the third block under Trade Policy
  (grill Q6 — parallel to the desk levers, not a store-wide screen). With no `f&i-manager` on
  staff it renders the plain-language reason it does nothing yet and **stays selectable**: a
  store can set its standing posture before it has anyone to carry it out, and greying a
  control without saying why is the thing the copy rule exists to prevent.
  **The #346 "Prep holds exactly two levers" test now asserts three.** That assertion was
  written to keep *navigation* out of Prep, and the locked IA says Prep is "pure pre-open
  policy" — a third policy lever is what that admits. The button-count check moves with the
  levers rather than being deleted.
  Web drive (T2 dev slot, Operations → Prep): the block renders under Trade Policy, defaults
  to **Balanced** off a slot carrying no posture id (the fallback path), pressing "More per
  deal" reselects the chip and swaps the blurb, and the unstaffed sentence shows — a T2 store
  cannot hire an F&I manager until T3, so that is the honest live state. What the drive did
  **not** prove is the markup moving on a real quote (no desk to work it at T2); that is
  `tests/FniPosture.test.ts`, which hires an `f&i-manager` on a real `createWorld` at T3 and
  asserts `quoteFinance` moves with the dial. **Note for the next web session: the dev-save
  IndexedDB has a queued `deleteDatabase` left pending from this one** (the "max of 3 slots
  reached" workaround) — the next reload of that tab will likely clear the three dev slots.
  They are regenerable from DEV · START AT TIER.
  230 suites / **2960** tests, typecheck clean, full suite green on the first run.
  Next: **BUILD #367** — deal-kill, the curve where an over-marked deal falls through.

- 2026-08-08 — **BUILT #152** (the menu is presented against the deal, not just the customer).
  Attach scaled with the salesperson's skill and nothing else, so a cash buyer was being sold
  **GAP** — coverage for the gap between a loan balance and the car's value, on a deal with no
  loan. Attach is now `baseRate × skillMultiplier × loanFactor`, where
  `loanFactor = 1 − loanSensitivity × (1 − financedShare)` and
  `financedShare = loanAmount / agreedPrice`.
  **Two product keys, and it is the same call #153 made.** `loanSensitivity` is the scalar (VSC
  0.35, GAP 0.8, prepaid maintenance 0.25; etch / key / tire & wheel declare none and are flat,
  because they protect the car and not the note). `requiresFinancing` is **categorical**, checked
  ahead of the roll. Collapsing the gate into "sensitivity 1.0" reproduces today's numbers
  exactly and is wrong for tomorrow's: **C2 owns these magnitudes (I9)**, and a calibration pass
  must not be able to tune loan-gap coverage back onto a cash sale. Same shape as #153's
  leaning-vs-category split, for the same reason.
  **The roll is drawn for every available product, including a gated one.** The `continue` sits
  *after* `rng()`, so gating GAP does not shift the stream for the products behind it. That is
  what lets `tests/DealEngine.attach.test.ts` assert the flat products' attach counts are
  **exactly** equal across cash / standard / heavy-down over 4,000 presentations rather than
  merely close — the same measurement is also the proof that the flat products are untouched.
  **`computeAutoFni` now takes one named input, and StaffDispatch resolves the structure first.**
  It used to attach *before* computing the down payment, which is the #365 lesson again: a menu
  presented against no structure is a silent default, so `deal` is required and every call site
  states it. Consequence beyond the letter of the issue — **trade equity now thins the menu**,
  because it shrinks the note the products are protecting.
  Surfaced on Finance as **"Back End per Deal"**: F&I gross **per car** for cash / little down /
  large down. Per unit, not window totals — a total only reports which structure was commonest,
  while the actionable fact is that the same store earns a different back end on a big note. The
  three `KPISnapshot.backEndByStructure` buckets are **disjoint** (heavy-down carved out of
  standard finance, unlike the older `financeUnits` which counts both), so they sum to total back
  gross; all of it derives from `DealRecord` fields already persisted, so **no envelope bump**.
  **The web drive earned its keep again, and on the same class of defect as #365.** The unit
  counts started life in the bar's `valueLabel` — `"$2,100 · 3 cars"` — and the horizontal
  `BarChart` reserves 56px for its value column and draws it as SVG text past the plot edge, so
  it clips. The counts moved into the caption, which also let them disappear on an empty window
  ("averaged over 0 cash" reads as a broken sentence). Confirmed in the running app: the region
  mounts on the live Finance tab with the right copy. The chart *body* was not visually
  verifiable — the Browser pane was hidden, so `ResizeObserver` never fired and every measuring
  chart collapses to an empty div (the documented probe returned `false`). Not reported as
  working or broken.
  **`ZERO_KPI_SNAPSHOT` is now on the KPIDashboard barrel.** Four test fixtures were each
  hand-writing the full snapshot shape, so this one new field broke all four the same way. They
  spread the constant now.
  **The store measurably earns less, and that is the point rather than a regression to tune
  away.** `npm run balance -- pacing`, 100 seeds against #365's baseline: bankruptcy **21% →
  28%** (modeled 27, throw 1), blend 0.4294 → **0.4320**, T2 reached 89 → **91**, T3 **16**
  unchanged, verdict pass 21%, median survival 360, T1 still the standing 1.0mo-vs-2.0 miss.
  The ladder reaches marginally further while the floor gets harder — the income the store loses
  is the income it was booking on a product that cannot exist on a cash deal. **The answer to a
  28% bankruptcy rate is not re-attaching GAP to cash**; it is C2's, alongside the markup
  magnitudes #365 left it (I9). #180's live bands moved (positive 35.8% → 39.3%, apathetic 54.3%
  → 51.7%) and **no calibration number was touched** — less back gross is a different cash
  trajectory, which is the documented #151 sensitivity of that seeded run. Both bands still hold.
  228 suites / **2948** tests, typecheck clean. Two RN-Testing-Library suites
  (`InTabNavigation.reachability`, `App.recapPersistence`) failed on later full-suite runs and
  pass in isolation; the first full run of the session, with every change in place, was green —
  the documented CPU-load flake, not a regression.
  Next: **BUILD #366** — the three-position F&I posture dial, the phase's one live path.
