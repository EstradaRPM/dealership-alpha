# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phase 11 — B4 drive-the-clock — is SLICED AND FILED as of 2026-08-11: #381–#385 (table
below), and the bite-unlock gate is RULED (see the log entry; recorded in
`engagement-spine.md` + `gates.md` Settled).** Nothing in the phase is un-filed. **#381, the tracer, LANDED
2026-08-11** — the ladder, the runner, the halt, the picker and the bite-grain Reveal are all
standing. **#382 LANDED 2026-08-11** — the star budget rides the bite and what it cuts is stated.
**#383 LANDED 2026-08-11** — the bite is a placed bet: the picker states the stake and the Reveal
settles it. The next `/next` builds **#384**.

### Phase 11 — B4 drive-the-clock (sliced + filed 2026-08-11)

| # | Slice | Deps |
|---|---|---|
| ~~#381~~ | ~~**tracer** — `data/clock-bites.json` + `src/game/ClockBite/` headless multi-day runner + halt + the Home bite picker + the bite-grain Reveal~~ **BUILT 2026-08-11** | — |
| ~~#382~~ | ~~the star budget scales with the bite; what the feed leaves out is stated, not dropped~~ **BUILT 2026-08-11** | #381 |
| ~~#383~~ | ~~the bite is a bet — `PrepBet` captured at the bite's start, scored over the days that ran~~ **BUILT 2026-08-11** | #381 |
| #384 | the overnight interrupt channel — a moment that asks the owner a question stops the run | #381 |
| #385 | the month rung — GM-gated, the desks earn the silence, multi-store safe **[HITL]**, closes #124 | #381, #384 |

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

**#286's bands were re-measured on 2026-08-11 and MOVED, by #379.** The store had been paid
twice for every trade-in, so those bands were partly funded by money it was never handed. The
current reading is **69 of 100 seeds reaching T2, median survival 203 days** — see the #379 log
entry for the full before/after and for why the `FAILED:` percentage *falling* is not an
improvement. **A retune against the honest cash is C2's, and is not yet done.**

**Phase 9 is COMPLETE as of 2026-08-08** — all twelve B2 slices have landed (#151, #153, #365,
#152, #366, #367, #368, #369, #370, #371, #372, #373). `docs/planning/fni-mechanics-grill-state.md`
stays a locked design; do not re-grill it.

**Phase 10 — D1 — is RE-SCOPED AND FILED as of 2026-08-08.** Its row's *"largely absorbed by 5c;
re-scope when reached"* was mostly right: the subtraction against the shipped app killed Growth's
D1 scope entirely and left People with two items and Finance with three. Five issues filed,
**#374–#378** (table below). **All five have landed as of 2026-08-11** — #378's sweep closed the
phase's own scope. The out-of-phase **#379 landed 2026-08-11** too. **#380 landed 2026-08-11 as
well — phase 10 is COMPLETE.** Nothing under it is outstanding; the pointer advanced to phase 11
on 2026-08-11.

### Phase 10 — D1 the three dashboards (re-scoped + filed 2026-08-08)

| # | Slice | Deps |
|---|---|---|
| ~~#374~~ | ~~the P&L relieves inventory at the sale — Net Income becomes what the store *earned*~~ **BUILT 2026-08-09** | — |
| ~~#375~~ | ~~**tracer** — `ProfitCenter` axis on the ledger + `getDepartmentPnL` + the Finance "Where the Gross Came From" panel~~ **BUILT 2026-08-09** | #374 |
| ~~#376~~ | ~~the P&L proper — revenue/expenses/net over time + the gross→overhead→net ladder~~ **BUILT 2026-08-11** | #375 |
| ~~#377~~ | ~~People — skill growth made visible, and what morale is costing~~ **BUILT 2026-08-11** | — |
| ~~#378~~ | ~~closing sweep — delete the dead placeholder tab surface + the stale comments~~ **BUILT 2026-08-11** | — |
| ~~#380~~ | ~~Cash on Hand + "What the Store Is Worth" — automated spending stops reading as decay~~ **BUILT 2026-08-11 — phase 10 COMPLETE** | #376 for the Finance half only |

**Filed out of phase, from #374's tracing: ~~#379~~ — BUILT 2026-08-11.** A trade-in credited
the store the full selling price in cash *and* landed the trade car free. `closeDeal` now takes
`tradeAllowance` and debits it once, as `inventoryAcquisition` so the accrual P&L does not move.
It **did** move the #286 bands, as filed — the numbers are in the log entry, and re-tuning them
back is C2's call, not this slice's.

**What the subtraction actually found** (do not re-derive it; this is the record):

- **Growth is DONE — nothing survives.** All six D1-implied panels ship (`GrowthTab.tsx:79-157`):
  demand console, market report, industry wire + subscription lanes, the #371 finance-mix panel,
  the #359 build surface, and the gate board with live verdict pills. D1's remaining Growth line
  is *"courtship/brand portfolio once T4 lands"*, which is **E1**, not this phase.
- **People had 6 of 8 shipped.** Roster + slot boards, morale meter, salary book (grade + daily
  wage + total payroll), hiring, promotion, and raise/poach prompts are all live. Missing: skill
  **growth** is invisible (the card draws `effectiveSkills` alone, never against the hire-time base
  or the per-hire cap, so a climbing rookie and a topped-out veteran look identical), and
  `getMoraleMultiplier` — which the engine reads at `createWorld.ts:977` and
  `StaffDispatch.ts:508/522` — is read by **no UI**, so the morale bar states a level and never a
  consequence. → #377.
- **Finance had the charts and the F&I detail, and was missing the statement.** Shipped: the gross
  hero, cash-vs-financed donut, the #365 product/reserve split, back-end-by-structure, expenses by
  label, PVR + PPRU + carrying cost as KPI rows, Deal History and Month-Close sub-screens. Missing:
  **per-department gross does not exist anywhere in the game and no getter can build it** (zero
  engine hits for `departmentGross|grossByDepartment|deptGross`) → #375; and the "P&L trend" is a
  trend of *gross* — Net Income alone among the four headline cards has no series
  (`financeModel.ts:322`), and `PnLSummary.totalRevenue`/`.totalExpenses` are computed on every
  read and rendered nowhere → #376.
- **#374 is the prerequisite nobody had filed.** `getPnL` is pure cash-basis
  (`Economy.ts:124`): an auction purchase is charged as an operating expense on the day of the
  buy while the unit's revenue arrives weeks later, so at T1 — where a six-space lot is bought out
  in three days — a stocking month reports a loss the store did not make. The fix is already
  half-built: `category: 'inventoryAcquisition'` (#255) exists precisely to say "cash converted
  into stock, NOT operating spend" and the P&L never acts on it. Without #374, #375's department
  panel cannot reconcile with its own Net Income — the exact defect the #365 reserve-posting note
  was written about.
- **#374 can move no calibration number, and that was checked, not assumed.** `getPnL` has four
  consumers and all four are Finance UI (`FinanceTabContainer.tsx:47-48`, `TabStackContent.tsx:136`,
  `financeModel.ts:322`, `monthResultsModel.ts:115`). `scripts/` has **zero** hits for `getPnL` or
  `netIncome`; every monitor and gate face branches on `economy.cash`, which #374 does not touch.

### Phase 9 — B2 F&I plug-in #2 (filed 2026-08-07)

| # | Slice | Deps |
|---|---|---|
| ~~#151~~ | ~~per-brand `Reputation.repFor(make)` replaces the `pickVehicle` stub — ambient, no screen (I6)~~ **BUILT 2026-08-07** | — |
| ~~#152~~ | ~~attach scales with amount financed — one per-product `loanSensitivity` (I4)~~ **BUILT 2026-08-08** | — |
| ~~#153~~ | ~~cash-buyer / must-finance traits through `resolveEffects` (I5)~~ **BUILT 2026-08-07** | — |
| ~~#365~~ | ~~**tracer** — `apr`→`buyRate` + `markupCapPts`, `computeReserve`, back gross splits into `productGross`/`reserveGross` (Q1/Q2, I1–I3)~~ **BUILT 2026-08-08** | — |
| ~~#366~~ | ~~the posture dial — three positions, slot-persisted like `tradePolicy`, **no snapshot bump** (Q5/Q6/Q9, I7)~~ **BUILT 2026-08-08** | #365 |
| ~~#367~~ | ~~deal-kill — one curve in `data/`, an over-marked deal falls through (Q3 primary, I8)~~ **BUILT 2026-08-08** | #366 |
| ~~#368~~ | ~~CSI drag — an over-marked customer publishes `reputation:satisfaction_hit` (Q3 secondary)~~ **BUILT 2026-08-08** | #365 |
| ~~#369~~ | ~~the F&I manager works the deal — `finance_structuring` frontier, `product_presentation` attach (Q2/Q5/Q10)~~ **BUILT 2026-08-08** | #367 |
| ~~#370~~ | ~~the peak meter — twin opposed bars, the crest is not the max (Q4)~~ **BUILT 2026-08-08** | #366, #367, #369 |
| ~~#371~~ | ~~the crowd's finance mix read ahead on the wire — MarketIntel lane, F&I manager is a third opener (Q7)~~ **BUILT 2026-08-08** | — |
| ~~#372~~ | ~~advertising buys a different crowd — person-archetype weights on campaigns (Q8)~~ **BUILT 2026-08-08** | — |
| ~~#373~~ | ~~the monthly F&I verdict — Reveal reactions + the PVR record (engagement spine plug-in #2)~~ **BUILT 2026-08-08 — phase 9 COMPLETE** | #365, #366, #371 |

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

- **`Alert.alert` is DEAD on web and must never come back** (delete-a-save session, 2026-08-11).
  react-native-web ships `class Alert { static alert() {} }`. It compiles, type-checks and runs,
  and does nothing — so every confirmation routed through it was inert on the target the game is
  actually played and driven from. `useConfirm()` / `ConfirmDialog` on the kit barrel is the one
  confirmation surface; `tests/ConfirmDialog.test.tsx` scans all of `src/` for the call. A test
  that *mocks* `Alert.alert` and asserts the app called it proves nothing (that is exactly what
  `SettingsScreen.smoke` was doing while the shipped button did nothing) — drive the real dialog.
- **Every per-slot cell key is minted in `SlotStore.ts` and nowhere else** (same session).
  `snapshot:<id>` was built in `src/app/services.ts`, so `deleteSlot` could not see it and a
  deleted career left its whole weekly-snapshot window in storage, unreachable and un-deletable.
  A slot's cells are one key space: `slot:` / `checkpoint:` / `snapshot:` are wiped together, and
  a new per-slot cell goes in that file beside the delete that has to reach it. The pre-fix
  orphans in an existing save are **not** swept — same rule as the pre-#374 ledger.
- **The bite bet is READ off `days[0].prepBet`, never held in a second slot** (#383).
  `biteBetVerdictScoreline` takes the days and reads the first one's captured bet itself rather
  than accepting a bet, so no caller can hand it day four's. The per-day capture deliberately
  keeps running inside a bite — that is what feeds each day's own beat into the pooled feed — and
  a `biteBetRef` beside it would be a second copy of one fact with a way to disagree. A future
  session "finishing" this with a ref in `useDayLoop` is adding the disagreement, not the
  capture. Nothing is persisted: a bite runs synchronously and ends MANAGERIAL, so there is no
  mid-bite save, and `WORLD_SNAPSHOT_VERSION` stays 21.
- **A run whose FIRST day had no lean is not scored, even if a later day has one** (#383). The
  first non-null bet down the run is a later day's posture; adopting it would invent a wager out
  of a mid-week restock the player never placed. `days[0].prepBet?.stockedCategory` is the whole
  test.
- **The bite verdict counts DAYS the category was asked for, not units** (#383). The bet is about
  days — you wagered the lean carries N days — so a count of units would let one busy Saturday
  speak for a week the store was wrong about. The denominator is the days that RAN, which is also
  how a halted bite is scored on the M it got rather than the N it wagered.
- **The bite names the crowd with the SAME `dominantCrowdWant` rule the day uses, and `null`
  falls back** (#383). A run that named no favorite (nothing asked, or a dead tie) states the
  tracer's span scoreline rather than a verdict — a bet nobody can settle is not scored, and the
  bite must not learn a second crowd rule. Note the day grain falls back to `readCategory` on a
  dead day and the bite does **not**: a week is long enough that silence is an answer.
- **The span clause stays IN FRONT of the bite verdict** (#383). "3 of 7 days run" is what states
  that the player did not get the run they wagered on; a verdict that replaced it would report a
  bet nobody placed. The day grain replaces its scoreline with the verdict; the bite prefixes it.
- **`stakes` is DATA, optional-with-a-refine, and the day is the only bite without one** (#383).
  `ClockBitesConfigSchema` refuses a bite with `days > 1` that omits it, so a fourth rung cannot
  ship blind; the day carries none because it is watched as it happens, and a required-but-unread
  string is the dead `tagline` #378 had to delete. The picker states it verbatim and words
  nothing.
- **`matchClause` takes its window now, like `matchReaction`** (#383). It was still printing
  "nothing closed today" on the bite fallback path. Any future scoreline helper that names a
  window must take one rather than inheriting the day's default.
- **`tunables.reveal.drama.starBudget` IS GONE and must not come back** (#382). The budget lives
  on the bite in `data/clock-bites.json`, and `buildReveal` reads the **day bite's** through
  `biteStarBudget('day')` rather than keeping a constant of its own — the day is a bite. Two
  budgets is two places to disagree about the same day, which is the whole reason one was deleted
  rather than left beside the other. `tests/RevealBudget.test.ts` scans both files for the string.
  `drama.crownBudget` stays in tunables: it caps a *ranking*, not a window.
- **The star budget grows SUB-LINEARLY and the schema refuses a shrink** (#382). 5 / 9 / 14
  against 1 / 7 / 30 days. Seven days of reactions at seven times the stars is a scroll, not a
  beat; a longer bite carrying a *smaller* budget is a typo, and `ClockBitesConfigSchema` rejects
  it. **The day's 5 must not move** — it is the pre-#382 shipped number, and moving it changes the
  tracer's live reading for a reason nobody filed.
- **The leftover line is the BITE's, deliberately absent at day grain** (#382). A day's handful of
  beats through a day's budget is the feed doing its job; the statement exists because a bite
  discards multiples more. Adding it to `buildReveal` would change a day's Reveal, which #382 filed
  as identical to before the slice. It is **one line, never an expandable list** — a surface that
  can show everything is a report, not a Reveal — and it carries the bite's own span word, the same
  rule `matchReaction` learned on #381's drive.
- **A crowned record is admitted BEFORE the budget is spent, and the reservation must not
  reorder the feed** (#382). `rankDramaPool` reserves crowns and then fills the remaining budget in
  drama order, emitting the admitted set in the pool's own order. Under the *shipped* weights a
  crown already outranks any win (`recordBroken` 2 vs. a win's clamped ceiling of 2, crowns leading
  the arrival tiebreak), so the reservation cannot be observed in normal play — that is exactly why
  it exists rather than the weighting being trusted, since retuning the drama weights is C2-class
  calibration. `tests/RevealBudget.test.ts` drives it at the one limit where it bites (the #373
  month verdict, weight 2.5, is the only candidate that outscores a crown). **`drama.crownBudget`
  still caps how many crowns take slots** — the reservation guarantees the survivors of that cap,
  it does not repeal it.
- **The remainder counts what the RANKING cut, not every event of the week** (#382). Non-starworthy
  walk-offs are dropped at the eligibility gate and were never candidates; counting them would
  inflate the line into a claim the feed cannot back. The halt and match-summary reactions are not
  drama and are not counted either.
- **The DAY bite is the live floor and must never route through the runner** (#381). `Run the
  Day` is `handleNextDay`; only bites *above* the day call `runBite`. Running the day headless
  would delete the floor view and its intra-day pause/speed control — the opposite of what B4
  extends, which is the existing control *upward*. `runBite('day', …)` still works and is
  unit-tested; the app deliberately does not take that path, and the picker draws only
  `days > 1`.
- **`checkHalt` is asked AFTER the day, and the halting day counts** (#381). A bite stops at the
  first moment the store needs a human and **the bite is over** — no queued remainder, no
  auto-resume, and the module holds no state between calls to make one possible. A run that
  silently continued past the thing that interrupted it would be the bite making the player's
  decision for them. A future session "finishing" this with a resume is reversing the ruling.
- **`tierGate:month_verdict` fires unconditionally every month, so a bite crossing a month
  boundary ALWAYS halts there** (#381, `TierGate.ts:200-211`). That is the design: the month's
  grade is the moment you must look, and it is what syncs the month bite to the calendar after
  its first run. Do not "fix" it by grading only decisive verdicts.
- **The doors are in `data/clock-bites.json` and the predicates in code, joined by
  `resolveBiteCoverage` deriving from `buildManagerStatus`** (#381). It reads no act-gate
  predicate a second time. This is the #371 lesson applied: a `hasDeskManager`-style boolean
  living in code satisfied every staff door at once and had to be deleted. A second read here is
  how the button and the desk start disagreeing about who is covering what.
- **ClockBite takes no EventBus and imports no sibling** (#381). The halt signals are latched by
  the composition root because it is the only layer that knows what "a moment the player is
  needed" looks like in this app. `runBite` also does **not** check the door — `availableBites`
  is the door, the picker obeys it, and that separation is what lets the runner's tests drive a
  week with no roster.
- **A bite skips the per-day recap modal and the per-day autosave, and does ONE closing write**
  (#381). Seven recaps nobody dismissed is noise; seven `void async` writes racing for one slot
  is how the last write ends up stale. `biteCrossedSnapshotDayRef` carries whether the run owes
  the 7-day history snapshot so that cadence is not silently dropped, and the cash delta is
  accumulated across the run — a week's delta is the week's, not its last day's.
- **Per-day Reveal beats are captured AS EACH DAY CLOSES** (#381). The daily refs
  (`matchTallyRef`/`closesRef`/`walkOffsRef`/`recordsRef`/`fniVerdictRef`) are cleared *before*
  each `nextDay()`, so a runner reading only the final day would silently swallow six days of
  wins, walk-offs, crowns and month verdicts. `biteDaysRef.current != null` is the one "a bite is
  running" fact, so the day-close handler cannot disagree with the runner about the mode.
- **A one-day bite delegates straight to `buildReveal`, morning bet included** (#381). The bet at
  BITE grain is **#383's** and is deliberately not resolved by the tracer: pooling a week of
  per-day bets into one verdict is a different bet, and inventing one now would be a rule the
  player was never shown placing. The bite Reveal passes `prepBet: null`.
- **`matchReaction` takes the window it covers, and "today" is only correct at day grain**
  (#381). The pooled feed shipped a week's figure as `$47,366 gross today` on the first drive — a
  number the player can check and find wrong, which is the one thing this feed cannot do. Any
  future grain must pass its own span word rather than inheriting the default.
- **The star budget is UNCHANGED at bite grain, on purpose** (#381). A week's Reveal uses the
  same `tunables.reveal.drama.starBudget` a day does. Scaling it — and stating what the feed
  leaves out rather than dropping it silently — is **#382**, which is the seam this tracer left
  open, not an omission to patch here.
- **Nothing about the bite is persisted and `WORLD_SNAPSHOT_VERSION` stays 21** (#381). The
  picker's default is the day, every time. A remembered bite is a standing instruction to skip,
  which is the opposite of a bet you place each time. `tests/worldSnapshot.test.ts` pins it and
  `tests/BitePicker.reachability.test.tsx` scans the composition layer for a persisted bite id.
- **#381's determinism is asserted at the SEEDED CONTROLLER scope, never as a full
  `snapshotWorld` re-run** (`tests/ClockBite.determinism.test.ts`). Two fresh same-seed *worlds*
  legitimately diverge on the sales floor; two same-seed `DayLoopController`s do not. Seven
  hand-driven days and seven runner-driven days produce identical FloorSim surfaces, and the
  controller lands MANAGERIAL on both a complete and a halted run — which is what makes
  mid-bite checkpointing a thing that cannot exist rather than a thing that was skipped.
- **The store's worth is COST BASIS + cash, and `getStoreWorth()` is the one place it is
  added** (#380). `Inventory.getStockValue()` sums `purchasePrice + reconCost`, never
  `bookValueFn` — a market appraisal would move the total on a day the player did nothing,
  which is the disconnection the figure exists to remove. Swapping in market value silently
  breaks all three checkable rules (a buy leaves the total flat, a close raises it by the front
  gross, a wholesale-out lowers it by the quote's `gain`) and makes the shipped caption false.
  Move the label with the rule or leave both alone. A surface that sums its own is the failure
  the single getter prevents.
- **Facility and floorplan are UNASKED, not omitted** (#380). Facility has no dollar value in
  the engine (#358 counts built spaces) and floorplan is a daily carrying cost, not a debt
  balance. Whether a built bay is a sellable asset is a design question nobody has put; until
  it is ruled on, adding either term would be a rule the player cannot verify. The figure is
  labeled for exactly what it sums, which is what keeps it honest in the meantime.
- **Cash stays the PRIMARY figure on every surface** (#380). Every bankruptcy check, tier gate
  and career-ending face branches on `economy.cash`; a bigger worth figure beside it would be a
  lie of a different kind. The worth line is secondary by design, not by oversight.
- **`HomeDashboardInputs.cash` is GONE and must not come back** (#380). The HUD takes
  `storeWorth` and reads its headline figure *and* its "Cash on Hand" label out of the same
  `buildStoreWorth` model the worth line under it uses. Re-adding a separate `cash` input is
  how a headline starts disagreeing with the line beneath it.
- **Finance takes `storeWorth` as its own PROP, never a field on `FinanceDashboardModel`**
  (#380). Everything in that model is a reading of the selected time *window*; this is a
  reading of this *moment*. Folding it in would make the position appear to move when the range
  chips change.
- **A nav tab with no composed room THROWS, and there is no stub to fall back to** (#378).
  `composeShellTabs` (AppShell barrel) is the one binding of `loadNavTabs()` to `tabContent`.
  Re-introducing a render-time fallback — even "just for a new tab being built" — recreates the
  exact artifact this slice deleted: a dead surface that nothing fails over and that the next
  session reads as unfinished work. A sixth tab is a room wired in the composition root or it is
  a crash.
- **`NavTabDef` is `{ key, label }` — `tagline` is GONE and must not come back as data** (#378).
  It captioned the deleted stub and had no other reader; `tests/NavGating.test.tsx` pins the
  string out of `data/nav-tabs.json`. A future subtitle is a surface decision with a reader, not
  three unread strings parked in the IA file.
- **The #378 source scans match on the literal dead copy, so do not quote it** (#378).
  `tests/Composition.completeness.test.ts` fails any file under `src/` containing `StrategicTab`
  or the old "coming in a later slice" line, and any file claiming People / Finance / Growth are
  placeholders. A comment *describing* the deletion trips it — word it around the copy rather
  than exempting the scan, which is how a scan stops guarding anything.
- **The skill track keeps a SHARED 0…cap axis; the ceiling dims the tail, it does not rescale
  the bar** (#377). Rescaling each person's bar to their own limit — the literal reading of the
  issue's "the per-hire cap as the end of the track" — makes a rookie capped at 30 sitting at 30
  draw the same full bar as a veteran capped at 95 sitting at 95, and the roster panel exists to
  compare people down the page. `ProgressBar.mark` (hairline at the hire value) + `.reach`
  (scrim past the ceiling) put all three numbers on one shared axis. Do not "finish" this by
  rescaling, and do not fold `mark`/`reach` into the existing `tick` (a second *segment*, a
  different reading — they are ignored in `tick` mode).
- **A static axis draws NO growth furniture, and most axes are static** (#377). `grows` is
  `growth_counter != null`; only `pricing`, `t_o_closing` and `condition_reading` carry one in
  `data/staff-skills.json`, and all three are manager axes — so a Tier-1 salesperson's card is
  honestly all "Fixed at hire" and the growth reading first appears on a UCM. That is the data
  as filed (magnitudes are S14/#286), not a narrowed slice, and a card with no marks on it is
  not a bug.
- **The per-hire ceiling is an ENGINE read and must never be re-derived at a call site** (#377).
  The headroom rolls from `masterSeed` + the staff id inside `StaffFactory`; a surface computing
  its own would name a limit the engine does not clamp to. `NPC.perHireSkillCap` →
  `StaffOrg.getSkillGrowth(staffId)` is the one path. Nothing is stored, so a save round trip
  re-derives the same ceiling and **`WORLD_SNAPSHOT_VERSION` stays 21** — no migration.
- **The morale sentence is stated at neutral too, deliberately** (#377). An omitted line reads
  as a surface that forgot, not as "no effect", and the player cannot tell those apart by
  looking. Nothing calibrated moved and nothing could — both halves of #377 are reads of values
  the engine already computes.
- **`BarChart` clamps negatives to zero and `LineChart` does not — pick by the data's sign**
  (#376). `BarChart`'s `Math.max(0, d.value)` is deliberate; a signed series charted on it
  reads as break-even. Anything that can go below zero (a P&L, a delta, an equity position)
  uses `LineChart`, whose `signedDomain` always contains zero so the baseline is a real
  position on the axis. Consequence for #375's department bars: a negative department gross
  draws a zero-length bar with its negative `valueLabel` beside it. That is the existing
  primitive's behavior, not a #376 regression.
- **The Finance hero and the P&L trend share ONE `bucketDaily` call, deliberately** (#376).
  Two computations that agree today is how the two charts stacked on one screen start
  describing the same window on different clocks. Do not give the trend its own bucketing.
- **`dailyPnL` reads `PnLSummary.entries`, and must not become an engine call per bucket**
  (#376). Those entries *are* the set `getPnL`'s totals are computed from — accrual, with
  `inventoryAcquisition` already dropped — and each is day-stamped. A second read path is how
  a chart starts disagreeing with the Net Income printed above it.
- **The statement rounds ONCE and the residue lands on OVERHEAD, never on the total** (#376).
  A live 30-day window printed `$2,713 + $35,479 = $38,191` before this rule; each summed line
  is now the sum of the already-rounded lines above it, and `deduction = netTotal −
  departmentTotal`. Net Income is the figure stated by the headline card and by
  `getDepartmentPnL`, so it is the one that must match everywhere — a balancing line absorbing
  rounding is what a real statement does. Do not "fix" the overhead line back to
  `money(-overhead)`; it can legitimately differ by a dollar from #375's caption above it.
- **Headline sparkline series are NORMALIZED, and raw dollars is the bug that was there**
  (#376). `Sparkline` takes [0,1] samples (`clamp01`), so the pre-#376 raw-dollar series drew
  every figure over 1 at the top of the plot — a $2k day and a $6k day were the same height.
  `normalizeSeries` maps against a zero-inclusive domain, which is also what puts Net Income's
  negative days below where zero sits. A future series added to a `FinanceStat` must go
  through it. PVR still carries **no** series, for its own documented reason (undefined on a
  day with no units).
- **A delta chip requires the prior window to fit ENTIRELY inside the career** (#376).
  `financeHasPriorWindow` replaced `prior.toDay >= 1`, which let day 10's "7D" chip compare
  seven days against the three that happened and report a collapse that was only the clamp.
  A clamped prior window is a *different span*, and two different spans are not a
  period-over-period move.
- **`profitCenter` omitted means `store` OVERHEAD, and that default is load-bearing** (#375).
  It is what keeps every untagged post — pre-#375 saves, every harness, a call site somebody
  forgets — below the gross line instead of flattering a department. A future session that
  "tidies" it to throw on a missing tag, or picks a different default, silently re-attributes
  the whole existing corpus.
- **`sum(departments.gross) − overhead === netIncome` is the product, and both reads share ONE
  filter** (#375, the private `pnlEntries`). A department cut with its own entry filter is how
  four grosses start disagreeing with the Net Income printed beside them. Do not add a second
  filter, and do not add a per-department running accumulator beside the ledger — the ledger
  IS the record (the `weeklyPayrollStub` lesson, #353).
- **`overhead` is store expenses NET of store revenue** (#375), so the reconciliation stays one
  subtraction. On a **pre-#375 save it reads large and NEGATIVE** — a month of untagged revenue
  sitting on the store line (the live drive read −$35,479 over 30 days). That is the documented
  "a pre-tag ledger reads as overhead" behavior, not a bug, and it does not happen to a career
  started after this commit. Do not back-fill an old ledger.
- **Payroll is NOT departmental cost of sale, by design** (#375). Techs and advisors draw one
  aggregate daily wage in this sim, not flat rate, and StaffOrg posts it as a single line;
  splitting it needs a second wage model nobody asked for. The statement is departmental gross
  → less store overhead → net income. Allocating payroll across departments is a different
  mechanic, not "finishing" this one.
- **PARTS NOW RELIEVE ON CONSUMPTION, and before #375 they never did** — the half #374 left
  open. Orders debit cash as `inventoryAcquisition`, which the accrual P&L drops whole, so
  every part the store bought had been off the statement since #374 and Net Income was
  overstated by it. `PartsInventory.consume` posts `postCostOfSale(lot.unitCost, 'Parts used:
  <category>')` at the part's own department. A **miss relieves nothing**. `PART_PROFIT_CENTER`
  has **no default**: a new `PartCategory` without a home there is a compile error rather than a
  silent charge to overhead. `PartsInventoryDeps.economy` now requires `postCostOfSale` as well
  as `postExpense`, so a test spy must supply both.
- **The department attribution rides `DeptDispatchProfile.profitCenter`** (#375), beside the
  pricing, RNG namespace and event family a department already owns. The shared engine names
  neither department. `tests/DeptDispatch.profitCenter.test.ts` runs two profiles differing only
  in department-owned fields, so a hard-coded `'service'` inside the engine fails the body-shop
  half while every Service test still passes.
- **The ledger tag is a NAMED OBJECT (`PostTag`/`ExpenseTag`), not trailing positional args**
  (#375). `postExpense(x, 'Recon', undefined, 'sales')` was the alternative. `tagFields` OMITS
  an absent key rather than writing `undefined`, which is what keeps an untagged entry's
  snapshot byte-identical — `EconomySnapshot.schemaVersion` stays 1, `WORLD_SNAPSHOT_VERSION`
  stays **21**, and there is no migration to look for.
- **The panel OMITS an inactive department, it does not draw a zero** (#375). `active` (the
  center posted *anything* in the window) is the test, **not** `gross !== 0` — so a Tier-1
  store draws no "Body Shop" bar asserting a loss on collision work it never did, while a
  department that burned parts and billed nothing still shows its negative bar. Do not
  "simplify" the filter to a nonzero check.
- **`getPnL` is a READ of the ledger, not the ledger** (#374). It drops
  `inventoryAcquisition` entries from the totals **and** from `entries`; `snapshot().ledger`
  is still the complete record. A future test asserting an acquisition shows up in
  `getPnL().entries` is asserting the pre-#374 rule — assert it against the ledger, which is
  where the #255 category test was moved.
- **`postCostOfSale` publishes NO event, deliberately** (#374). `economy:expense_posted` means
  cash moved and Telemetry's `cashCurve` is its only consumer. Firing it from a non-cash entry
  would corrupt the one thing that event exists for. Do not "fix" the silence for consistency.
- **Only `Inventory` relieves, and only `purchasePrice`** (#374). One private
  `relieveCostOfSale`, called from `sellVehicle` and `wholesaleOut` — the two doors a unit
  leaves by. Relieving `costBasisOf` would bill recon twice (it is already operating spend on
  the day it was incurred). Trade-ins and #296 seed units are relieved too even though their
  `purchasePrice` never cost cash; that is correct, not an oversight.
- **A pre-#374 ledger is NEVER back-filled** and needs no migration (`nonCash` is optional
  inside the module's own blob, `schemaVersion` stays 1, `WORLD_SNAPSHOT_VERSION` stays 21).
  An old save's historical months read more profitable than they were, because their
  acquisitions have no matching relief. The ledger records what was posted; the rule governs
  how it is read. Synthesizing relief entries would be inventing history the store never had.
- **A trade is settled by ONE debit of the whole ALLOWANCE, not two of equity and payoff**
  (#379). The two halves the issue names — the equity the customer never hands over, and the
  lien payoff wired out — come out of the same pocket and sum to the allowance, which is also
  the number `Inventory.acquireFromTrade` books as the unit's `purchasePrice`. One number
  describes both sides, so splitting it into two ledger lines would be one economic event
  written twice, and two numbers that can disagree about what a trade cost.
- **The trade allowance is `inventoryAcquisition`, and that is what keeps net income still**
  (#379). It is cash converted into a car, exactly like an auction buy: the accrual P&L drops
  it whole and the cost returns as the `postCostOfSale` relief when that trade unit resells.
  A plain `postExpense` would have charged the store for the same car twice — once as a deal
  expense now and once as relief later — and would have shown up as a five-figure phantom loss
  on a trade-heavy month. It also lands the allowance in the Home cash-delta's "into stock"
  column, which is where it belongs.
- **It is `forceDebit`, not `postExpense`, on purpose** (#379). By the time it fires, revenue is
  posted and the unit is off the lot; the lienholder is paid whether the store can afford it or
  not. A solvency throw there would abort a deal that had already half-happened. A store that
  takes a trade it cannot cover legitimately goes negative — that is the honest outcome, and
  the bankruptcy machinery already reads `economy.cash`.
- **Revenue stays the full `agreedPrice` and must never be netted** (#379). Front gross, PVR and
  every gross reading in the game are built on the selling price. The correction is on the cash
  side only, which is exactly why it was filed apart from #374.
- **`TradeSettlement { equity, allowance }` travels to the close as one object** (#379). Two
  positional numbers that differ by the payoff is the shape the original defect lived in; the
  equity shrinks what the store *collects*, the allowance is what the store *pays*. Do not
  collapse them at the StaffDispatch seam.
- **A pre-#379 save is NEVER swept for un-offset trades** (#379). `restore` reads cash verbatim.
  Its balance is generous by the allowances it never paid, the same way a pre-#374 ledger's
  months read more profitable than they were: the ledger records what was posted, and the rule
  governs what happens from here. Synthesizing corrective debits would invent payments the store
  never made.
- **The #286 bands MOVED and must not be tuned back inside this slice** (#379). Same command,
  same 100 seeds, before → after: T2 reached **91 → 69**, median survival **360 → 203 days**,
  bankrupt **28% → 60%**, completed **59 → 16**, search score **0.4320 → 0.3218**. **The
  `FAILED:` percentage FELL, 92% → 83%, and that is not an improvement** — the median failure
  day fell with it (118 → 90) because a run that goes broke early stops accruing the miss
  streaks and forced contractions that scored the old cohort as failed. It is the same trap the
  recipe warns about, pointing the other way: read the causes, not the percentage.
- **#180 moved and #181 did not** (#379). Live calibration: positive **39.3% → 35.8%**,
  apathetic **51.7% → 54.3%**, closes **290 → 274**, trades **122 → 113** (trade rate 42.1% →
  41.2%), `costOverAsk` **1.113 → 1.026** — a store with an honest bank stocks cheaper metal.
  The #181 early-game floor is **byte-identical** (1.0% positive, closes=39): the green-operator
  run barely trades at all, so there was nothing there to be paid twice for.
- **#363 and #364 are both BUILT (2026-08-07).** The two out-of-phase live defects are closed.
- **Phase 9 is DONE — all twelve B2 slices landed.** Nothing in it is outstanding.
- **`bestFniPvr` is a MONTH mark with no volume floor, and that is not an oversight** (#373).
  `bestPvr`'s `pvrMinUnits` exists because a one-unit day's PVR is just that deal's gross, which
  `bestSingleDeal` already crowns. Nothing else in the game measures the **back end**, so a thin
  month's F&I average is the only reading of it there is. Do not add a symmetric floor "for
  consistency". An all-cash month sets it to nothing rather than to zero — `tryBreak` refuses a
  non-positive — and a month with no units crowns nothing at all.
- **The month verdict's mix read is ONE comparison and Balanced can never fail it** (#373).
  `fniPosture[].financedShareBand` asks whether the month's financed share was inside the band
  that posture is a bet on; the two failures (`too_few_financed` / `too_many_financed`) are the
  same rule from opposite ends, because reserve is earned on financed contracts and nowhere else.
  Balanced spans [0,1] deliberately — it is the posture that makes no bet on the mix. Do not
  "fix" that by giving it a band, and do not add a second situation table beside the one number.
- **The verdict's tone follows the MIX, not the money** (#373). A month can earn well and still
  have been the wrong standing bet; which crowd the dial was pointed at is the lesson the beat
  exists to teach. A future session reading a fat-but-mismatched month as a bug is reading it
  backwards.
- **#373 did NOT bump the envelope — it was `RecordsSnapshot` schemaVersion 1 → 2** (the seventh
  mark plus `monthBackGross`/`monthUnits`). Per `docs/save-migration-recipe.md` the `modules` key
  set did not change, so `WORLD_SNAPSHOT_VERSION` stays **21**, `data/fixtures/tier-2.json` was
  deliberately not re-stamped, and there is no v21→v22 migration to look for. `restore` takes the
  `AnyRecordsSnapshot` union and a v1 blob's missing mark materializes as `null` — **not** as
  `{...undefined}`, which is what the old unconditional spread would have produced and what the
  feed would then have tried to crown.
- **`resolveFniDeskPerson` is the ONE F&I desk pick and #370's rule now has three readers**
  (#373). The month verdict names the person, `resolveFniDesk` maps them to skills for the close,
  and `getFniStructuringSkill` composes their morale for the peak meter. A verdict that named a
  different manager than the one the deals ran on is exactly the drift the single pick prevents.
- **The posture reaches the composition root through TWO getters over one piece of slot state**
  (#373): `getFniPostureMarkupPts` (prices a deal) and `getFniPostureId` (names the month). Two
  rather than one that returns both, so the pricing path cannot read a label and the reporting
  path cannot read a rate. Both are read off `fniPostureIdRef`, not React state, so a month
  closing in the same tick as a dial change reports what was actually standing.
- **The month verdict is told the MORNING AFTER, by construction** (#373). `clock:month_ended`
  fires during the Next Day transition, so the verdict lands in the following day's ref — the
  same window `bestMonthGross`'s crown has always arrived in, which is why the two ride the same
  bite for free. The refs are cleared **before** `nextDay()` runs; a session that "tidies" that
  ordering silently deletes the beat.
- **Nothing calibrated moved and nothing could** (#373). The verdict is a pure read, `bestFniPvr`
  is a scoreboard entry nothing branches on, and no harness assembles a Reveal at a month close.
  `#180` still reads 39.3% / 51.7%, closes=290.
- **An advertising campaign has TWO lanes and they ride ONE clock** (#372).
  `DemandInfluenceInput.personWeights` (optional ⇒ every segment-only producer byte-identical)
  ramps on the same lag/decay as `weights`, because a campaign's two halves are one lever;
  separate clocks would let a push arrive as one crowd and settle as another. `weights` is now
  **optional too**, and `buildAdvertisingInfluence` returns an input if **either** lane pulls —
  not taste: the daily bill is read back off the *running input*, so a crowd-only campaign that
  resolved to `null` would have run free. The schema **refuses a campaign declaring neither**.
- **`CustomerPool.skewSegmentArchetypes` is the ONE place the crowd skew is applied** (#372),
  the same rule `resolveSegmentArchetypes` exists for one level down: the spawn draw and the
  #371 finance-mix projection both go through it, so the crowd the wire promises is the crowd
  that walks in. A skew that would zero every candidate returns the segment **unskewed** —
  advertising bends who walks in, it cannot close a segment the heat map still spawns, and an
  empty list would fall through to a persona that does not belong to that segment at all.
- **The person weights bend the WITHIN-segment roll only, and that is not a gap** (#372).
  `tradesperson` is 100% of `truck` and `retiree` only lives in `suv`, so a crowd skew that also
  moved the segment draw would be the vehicle lane written twice on a clock the player cannot
  see. The cross-segment half is the campaign's own `weights`; both shipped campaigns carry
  both lanes. Do not "fix" the truck segment's inertness by coupling the two lanes.
- **DemandShaper takes `personArchetypes` the way it takes `segments`** (#372) — passed in by
  `createWorld` off `SALES_ARCHETYPES`, so the module keeps no CustomerPool dep and a campaign
  cannot name a buyer the game does not spawn (unknown key ⇒ throws at campaign start). Omitted
  ⇒ the lane is closed.
- **#372 did NOT bump the snapshot.** The two person vectors are optional on the wire and a
  pre-#372 schema-3 blob restores as "this lever skews nobody", which is what it meant. There is
  no migration to look for.
- **Nothing calibrated moved and nothing could** (#372) — no harness or script runs a campaign,
  so `#180` still reads 39.3% / 51.7%, closes=290. Campaign **costs and magnitudes are
  placeholders owed to a C2-class calibration pass**, as the issue filed them.
- **`NewsAccessRead.hasDeskManager` IS GONE — a staff door names the role that opens it**
  (#371). The read carries `staffedDesks`, the roster's role ids, and
  `data/news-progression-gating.json` says which role each `kind: 'staff'` unlock needs
  (`role`, schema-required there and schema-refused on a subscription unlock). The old boolean
  satisfied *every* staff door, so the moment a second desk existed the finance-mix lane would
  have opened free for any store with a used car manager. `resolveWireAccess` hands over the
  whole roster's roles rather than an allowlist — half the rule in code and half in data is how
  the two drift. Do not re-introduce a per-desk boolean.
- **A lane's `requires` can be a LIST, and ANY one of them opens it** (#371). `lockFor` still
  returns the first shut door (all a headline row has space for); `NewsAccess.locksFor` returns
  every shut door, which is what lets the finance-mix row state both ways in. The lane is bought
  (`finance_mix_feed`) **or** hired into (`fni_desk`) — a locked row naming only the
  subscription sells a store what the hire already gives them free.
- **`finance_desk` is a wire lane with NO headlines behind it, deliberately** (#371). The
  Growth finance-mix panel reads it. What the player is allowed to *know* is one door model
  whether the answer arrives as a story or as a number; a second gate for the panel would be
  the same rule written twice. A future test that asserts every lane maps to a publishable
  `(source, reliability)` pair is asserting the wrong rule.
- **The crowd's finance mix is DERIVED in closed form, never sampled** (#371,
  `NPC/factories/CrowdMixProjection.ts`). It draws no randomness — `tests/FinanceMixRead.test.ts`
  hands it a counting `Math.random` and asserts zero calls — because a *gated* read that
  consumed a seeded stream would make a fixed seed replay differently depending on what the
  player bought (#122). `tests/NewsGating.reachability.test.tsx` runs two same-seed worlds 20
  floor days apart, one subscribed and one cold, and pins the arrival stream identical.
- **The payment traits are integrated by ENUMERATING SUBSETS, not by averaging effects**
  (#371). They are independent Bernoullis, and the two keys are different kinds of fact:
  averaging would let a partial `must-finance` chance *partly* forbid cash (it is categorical)
  and would smear the [0,1] clamp on `payment.cash_probability` (it is additive). The #153
  split has to survive the integration. Each subset goes through the same `resolveEffects`
  machinery the roll uses, so a third payment trait needs no change to the projection.
- **`creditMix` describes the FINANCED crowd, weighted by `P(finance | archetype)`** (#371).
  Credit and payment leaning correlate through the archetype — the best-credit retiree is also
  the likeliest cash buyer — so an all-comers credit mix would systematically flatter the book
  the F&I office actually writes. Do not "simplify" it to the whole crowd. The bands arrive as
  data (`{tier, minScore}` off `data/credit-tiers.json`), **not** as a classifier function: a
  classifier answers "which tier is this score", never "how much of a distribution lands here",
  and the second question is the whole read.
- **`resolveSegmentArchetypes` is on the CustomerPool barrel and is the ONE reading of
  `demandShaper.segmentArchetypes`** (#371). `createWorld`'s private map-building is gone; the
  spawn draw and the finance-mix projection both go through it. Two copies of that filter +
  normalization is how a forward read starts describing a crowd that never walks in.
- **Nothing calibrated moved and nothing could** (#371). The projection is a pure read, no
  harness opens the lane, and the only engine change outside MarketIntel is a `World` getter.
- **The peak meter measures the WHOLE DEAL against the fall-through, not the back end**
  (#370), and that correction is what makes the crest exist. Weighed on reserve alone, the
  aggressive posture is the maximum at every credit mix under the shipped numbers (+3–6% over
  Balanced at A/B, ties at C/D) — the meter would have shipped saying "always gouge". A
  contract the lender passes on costs the store the **sale** (#367 fires before
  `trade:resolved` and the customer walks), so each book sample carries
  `dealGross = frontGross + productGross` and the curve is `(dealGross + reserve) × stick`.
  With that, the shipped config reads exactly as the grill designed: peak at **Balanced** for a
  green or absent desk, sliding to **More per deal** at a `finance_structuring` around 70, and
  Balanced again for a subprime-heavy book. **Do not "simplify" the meter back to back gross.**
- **The CSI cost is reported BESIDE the money, never folded into it** (#370). A satisfaction
  point is not a dollar; inventing an exchange rate to bend the curve would be a second pricing
  rule the player can neither see nor move. `satisfactionCostPerDeal` rides the projection and
  the surface states it as its own sentence ("a cost this total does not count").
- **The meter's credit mix is the store's OWN BOOK, not a modeled crowd** (#370). #371 is what
  puts the *crowd's* finance mix on the wire; this reads the contracts already written.
  `deal:closed` gained `creditTier` and `DealRecord` gained `creditTier` + `loanAmount`, both
  optional, restored by the existing `...d` spread — **inside the module's blob, so
  `WORLD_SNAPSHOT_VERSION` did not move and there is no migration.** A record missing either
  sits outside `getFinancedBook()` rather than being patched with a guess, so a fresh store (and
  the `tier-2` fixture) reads the empty state. `amountFinanced` is the stored `loanAmount`, NOT
  `agreedPrice − downPayment` — trade equity shrinks the note too.
- **The tier is CARRIED, never inferred from `apr`** (#370). The shipped `buyRate` +
  `markupCapPts` bands happen to be disjoint, so a tier could be decoded by arithmetic today —
  and that decode would break silently on the next edit to `data/credit-tiers.json` while the
  meter went on reporting a peak. Do not "save a field" by re-deriving it.
- **`resolveDeskSkill` is now exported from the StaffDispatch barrel** (#370) and
  `World.getFniStructuringSkill()` composes it with the same person-pick `getFniDesk` uses
  (extracted in `createWorld` as the named `resolveFniDesk`). The meter must project against the
  number the next contract is judged at; a surface reading the raw roster composite would drift
  from the close exactly when the desk's morale was down. Do not re-derive either half at a UI
  call site.
- **Nothing about #370 moved a calibration number and the live bands are unchanged**
  (#180 still reads 39.3% / 51.7%, closes=290). The whole slice is a read plus two optional
  recorded fields; no harness hires an `f&i-manager` and none reads the book.
- **The two F&I frontiers have DIVERGED, and that is #369's design ruling** (the decision #368
  left open). `finance_structuring` extends the **lender's** `fniDealKill` frontier
  (`resolveSafeFrontierPts`); it deliberately does **not** move `fniCsiDrag.fairMarkupPts`,
  because a slicker structurer changes what the bank will buy, not how gouged the customer feels.
  Consequence: a sharp desk makes "More per deal" *survivable*, never *free* — the deals stop
  falling through and the satisfaction hit keeps landing. The shipped-file test still pins the two
  base numbers equal (that is the unstaffed store, where the player learns ONE line); do not read
  the divergence at a staffed desk as a drift bug, and do not couple the two "for consistency".
- **The max frontier extension is not a free number** (#369). `structuringFrontierMaxPts` 0.0075
  is exactly the reach from Balanced (0.0175) to "More per deal" (0.0250), so a reference-grade
  structurer clears the aggressive posture with zero fall-through and everything short of it pays
  a real rate. Moving `fniPosture.more-per-deal.markupPts` or `safeFrontierPts` without moving
  this changes what the top of the skill ladder buys — move them together or say which.
- **The back end runs on the F&I MANAGER once one is hired, not on the salesperson** (#369), and
  the desk arrives as ONE closure (`StaffDispatchDeps.getFniDesk`) carrying `staffId` +
  both composites. The composition root picks **one person** — the strongest `f&i-manager` by the
  role's composite, the same rule the resolver uses for salespeople — because a deal is worked by
  somebody; a per-skill maximum across the roster would staff a manager nobody hired. **The desk's
  own morale multiplies both composites.** Omitted ⇒ `null` ⇒ the salesperson presents the two
  ungated products on the flat #367 frontier. **`null` is "no finance office", not "skill 0"** —
  they coincide numerically today and are written separately so a future nonzero-at-zero extension
  cannot grant itself to a store that never hired anyone.
- **No calibration moved and none could** (#369). Nothing in `tests/` or `scripts/` hires an
  `f&i-manager`, so every harness runs with `getFniDesk` ⇒ `null`. A future calibration bot that
  *does* hire one is opting into both effects at once (attach off a different skill, and a moved
  frontier) — expect the bands to move and say so rather than reading it as a regression.
- **The premium shelf needed no gate of its own** (#369). `unlockedRoles` is already derived from
  the roster, so the four `requiredRole` products unlock with the hire that presents them. All six
  unlock together (grill Q10) and `tests/FniManagerDesk.test.ts` scans `src/ui/**` for any product
  id or menu call — a session adding a per-product switch is re-opening a closed grill and will
  fail that test.
- **A markup derived by subtraction needs `RATE_EPSILON`, and the reason is not cosmetic**
  (#368). `customerRate − buyRate` does not round-trip in binary floating point — Tier C's
  0.129 + 0.0175 comes back 1.6e-17 *over* 0.0175 — so a naive `over <= 0` test would have had
  the Balanced posture publish a ~1e-15 satisfaction hit on every financed close, silently ending
  the reproducibility of every seeded calibration run. `csiDrag.ts` guards it at 1e-9 and a test
  walks all four shipped tiers. **#367's `fallThroughProbability` does not have this bug** — it
  judges `quote.markupPts`, which is exact — and was deliberately left alone. Any future code
  that reconstructs a markup by subtraction needs the same guard.
- **`fniCsiDrag.fairMarkupPts` and `fniDealKill.safeFrontierPts` are the SAME LINE on purpose**
  (#368), pinned equal by a shipped-file test: one frontier is what the player learns to read the
  dial. They are separate keys because they are separately measured and because #369 moves the
  lender's frontier with `finance_structuring` — carrying the customer's fairness line along with
  it is a design decision to make there, not a calibration nudge. Do not collapse them into one
  constant, and do not move one alone without saying which.
- **The CSI drag is keyed on the MARKUP, never on the products** (#368, grill Q3). Attaching a
  menu is the F&I desk's job; over-marking the rate is the gouge, so a cash deal takes no drag at
  any attach. **Chargebacks are a later refinement layer on this same variable** and are
  deliberately not built — a session adding them to `fniCsiDrag` is building the next layer, not
  finishing this one.
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
| 9 | B2 F&I plug-in #2 (+#151–#153) | **LOCKED 2026-08-07 — `fni-mechanics-grill-state.md`** (grill CLOSED, Q1–Q10 + 9 internal calls) | **COMPLETE 2026-08-08** — all twelve slices built (#151, #153, #365, #152, #366–#373) |
| 10 | D1 People + Finance + Growth dashboards (chart kit first) | — | **COMPLETE 2026-08-11** — re-scoped by subtraction, filed as #374–#378 + #380 (and #379 out of phase); all built |
| 11 | B4 drive-the-clock (absorbs #124) | **RULED 2026-08-11 — `engagement-spine.md`** (bite unlock = the cover your people give you) | **active** — sliced + filed as #381–#385; next is #381 |
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

- 2026-08-11 — **BUILT (director-directed, out of phase): a save can actually be deleted.** The
  director could not get rid of a save from the built-in browser, was sitting at the 3-slot cap,
  and so could not start a new game either. The Delete button was not missing — it had been there
  since #195 — it was **dead**. `Alert.alert` is a literal no-op on react-native-web
  (`class Alert { static alert() {} }`), so **every destructive confirmation in the app did
  nothing at all on the web target the game is played and driven from**: delete a save, roll a
  save back, clear the playtest log, reset the run, and the dev-fixture failure notice. Five call
  sites, all silently inert. The console errors already sitting in the live tab
  (`Dev tier-fixture launch failed … max of 3 slots reached`, four of them) are that failure
  reporting itself to nobody.
  **The fix is one confirmation surface, `ConfirmDialog` + `useConfirm` on the kit barrel**, and
  all five call sites now go through it. `useConfirm()` holds the "what is being asked" state so a
  surface is two lines (`const { ask, dialog } = useConfirm()`, then `{dialog}`) — one place owns
  the pattern, so nothing can quietly re-invent it as a dead `Alert.alert`.
  **`tests/ConfirmDialog.test.tsx` scans every file under `src/` for the call.** It compiles,
  type-checks and runs everywhere; it just does nothing on web, so nothing but a source scan
  catches its return. `tests/SettingsScreen.smoke.test.tsx`'s rollback case was **rewritten** — it
  had been mocking `Alert.alert` and asserting the app called it, which passed for the whole time
  the shipped button did nothing.
  **The dialog closes BEFORE `onConfirm` runs** (the handlers are async — a question left on
  screen while its answer runs reads as a press that did not land). **`cancelLabel: null` is the
  notice form**, one acknowledging button, which is why the message-only alert needed no second
  component. **`tone` defaults to `primary`**; red is the four destructive sites opting in, and
  `Button` gained the matching `variant="danger"`.
  **Delete now rides the LOAD list, not only the New Game one.** LOAD GAME is where a player looks
  at their saves; a delete reachable only from the screen you go to when you want a *new* game is
  a delete most players never find.
  **Found while verifying, and fixed here: `deleteSlot` was leaking a third of the save.** Reading
  IndexedDB after the two live deletes showed `snapshot:slot-2` and `snapshot:slot-3` still
  sitting there. The weekly-snapshot cell was minted in the composition root
  (`src/app/services.ts`), so the slot store could not see it — a deleted career left its whole
  6-week snapshot window behind, unreachable and un-deletable. **Every per-slot cell key is now
  minted inside `SlotStore.ts` and nowhere else** (`slot:` / `checkpoint:` / `snapshot:`),
  `MultiSlotSaveStore.snapshotStore()` joined the interface, and `services.ts` delegates. A new
  per-slot cell goes in that file, beside the delete that has to wipe it. Nothing is persisted
  differently and no envelope moved: `WORLD_SNAPSHOT_VERSION` stays **21**.
  **The pre-fix orphans are NOT swept.** `snapshot:slot-2` / `snapshot:slot-3` are still in the
  director's browser storage; nothing in the app can address them. Synthesizing a cleanup pass
  over cells whose slots no longer exist would be the same "invent history" move #374/#379 refused
  — the rule governs what happens from here.
  `npm run typecheck` clean, `npm test` **260 suites / 3606 tests** green. Verified on the web
  drive: the DELETE SAVE dialog rendered over LOAD GAME, Cancel left all three slots intact, and
  confirming removed Day 31 and then Day 37 from the list **and from IndexedDB** (`index` down to
  one slot, `slot:slot-2` / `slot:slot-3` gone). The surviving Day 60 career reloaded and Settings
  still listed its four weekly snapshots through the delegated `snapshotStore()`, with ROLLBACK
  SAVE opening and cancelling cleanly.
  Next: **BUILD #384** — phase 11 is untouched by this.

- 2026-08-11 — **BUILT #383** (the bite stops being a bet only in spirit — it is placed, and it
  is settled). After the tracer, picking a week ran seven days and reported what happened; nothing
  ever said what the player was *wagering* by picking it, so nothing resolved. Both halves are now
  real: the picker states the stake **before** the tap, and the Reveal settles it after.
  **The bite bet is the FIRST day's captured `PrepBet`, READ BACK off the run's first
  `BiteDayBeats` — not copied into a second slot.** A bite is the day bet held longer: you wagered
  that the lot you had stocked when you tapped carries the store for N days. The per-day capture
  keeps running inside the run (day 4 recaptures against day 4's lot — that is what feeds each
  day's own beat into the pooled feed), and `biteBetVerdictScoreline` reads `days[0].prepBet`
  itself rather than taking one, so **no caller can hand it day four's**. Two grains, one module,
  one copy of the fact. A run whose first day had no lean states no verdict even if a later day
  does — adopting the first non-null bet down the run would invent a wager out of a mid-week
  restock.
  **The verdict counts DAYS, not units.** The bet being settled is a bet about days, so the
  scoreline reads *"You went in leaning on trucks; the crowd asked for sedans on 3 of 7 days. Poor
  match."* A count of units would let one busy Saturday speak for a week the store was wrong
  about. The crowd is named with the **same `dominantCrowdWant` rule the day grain uses** — the
  bite learns no second rule — and `null` (nothing ever asked, or the run named no favorite) falls
  back to the tracer's span scoreline rather than inventing a verdict. A bet nobody can settle is
  not scored.
  **A halted bite is scored on the days it ran, by construction** — `days` *is* what ran — and the
  span clause stays in front of the verdict, because it is what states that a 3-day run was a
  shorter bet than the seven that were placed. The verdict must not silently absorb that.
  **`matchClause` now takes its window too.** The fallback path this slice routes through was
  still printing *"nothing closed today"* over a week — the same defect #381's drive caught in
  `matchReaction`, one function over.
  **The stakes sentence is DATA, and the schema refuses a bite above the day that omits it.**
  `stakes` rides `data/clock-bites.json` beside `days`, is stated verbatim under the control, and
  the picker words nothing. The day carries none and is the only bite allowed to: it is the live
  floor, watched as it happens, so there is nothing to state in advance — which is also why the
  field is optional-with-a-refine rather than required-and-unread (the dead `tagline` #378 had to
  delete).
  **Nothing calibrated moved and nothing is persisted.** Capture and scoring are reads of values
  the sim already computes; the bite bet lives for one synchronous run that ends MANAGERIAL, so
  `WORLD_SNAPSHOT_VERSION` stays **21** and `prepBet` is still the one persisted wager.
  `npm run typecheck` clean, `npm test` **258 suites / 3165 tests** green. Verified on the web
  drive (T2 dev slot, covered desk): the Home footer states *"Seven days run without you unless
  something needs you. The lot you stocked and the policy you set have to carry them."* under Run
  the Week while the month stays locked stating its door; the second week ran to *"7 days run —
  You went in leaning on trucks; the crowd asked for sedans on 3 of 7 days. Poor match."* over a
  feed of one truck sale and eight sedan walk-offs. The first week drew the fallback, which is the
  no-favorite branch doing its job.
  Next: **BUILD #384**.

- 2026-08-11 — **BUILT #382** (the bigger the bite, the more the Reveal has to leave out).
  A day's Reveal shows a handful of starred reactions out of a day's candidates. The week the
  tracer shipped ran seven days through the **same** budget, so it threw away roughly seven times
  as much — and threw it away **silently**, which is the failure: a player who sold their best
  unit ever on day 4 of a quiet week finishes the week never told, and concludes the feed is
  noise. This closes the engagement spine's last **"star budget per altitude"** STILL-OPEN item,
  at the grain that forced it.
  **The budget rides the BITE, and `tunables.reveal.drama.starBudget` was DELETED rather than
  left beside it.** `starBudget` sits in `data/clock-bites.json` next to `days`, because it is a
  property of the window the feed covers, not of the ranking — and one budget per grain is the
  only shape with no second place to disagree about the same day. `biteStarBudget(biteId)` is the
  one read, and **`buildReveal` takes the DAY bite's budget through it**: the day is a bite, so it
  has no constant of its own. Shipped **5 / 9 / 14** against 1 / 7 / 30 days — **sub-linear on
  purpose**, seven days of reactions at seven times the stars is a scroll, not a beat — and the
  schema refuses a longer bite carrying a smaller budget.
  **The day's 5 is the pre-#382 number, unmoved.** A day's Reveal is identical to before the
  slice, in the test and on the drive, or the tracer's live reading would have changed for a
  reason nobody filed.
  **What the budget cut is STATED, not dropped** — one plain-language line at the foot of a bite's
  feed (*"Plus 38 smaller moments over 7 days, too small to make the cut."*), never an expandable
  list: the feed's job is the top of the pile, and a surface that can show everything is a report,
  not a Reveal. It carries the bite's own span word for the same reason the pooled tally does.
  **A crowned record is admitted BEFORE the budget is spent.** #330 weights crowns above the
  win/loss axes, but weighting is not a guarantee. `rankDramaPool` reserves the crowned marks and
  then fills the rest of the budget in drama order — the admitted set is still emitted in the
  pool's own order, so reserving a slot cannot reorder the feed. `drama.crownBudget` still caps
  how many crowns take slots; the reservation guarantees the ones that survive that cap, it does
  not repeal it.
  **No drama weight moved and nothing calibrated could move** — the whole slice is a read of
  reactions the sim already emitted. `#180` still reads 35.8% positive / 54.3% apathetic,
  closes=274, `costOverAsk` 1.026. `WORLD_SNAPSHOT_VERSION` stays **21**, nothing persisted.
  `npm run typecheck` clean, `npm test` **256 suites / 3151 tests** green. Verified on the web
  drive (T2 dev slot, covered desk): a full week's Reveal drew exactly **9** starred reactions —
  two crowns at the top, then wins and walk-offs from across the days — followed by *"Plus 38
  smaller moments over 7 days, too small to make the cut."*; the very next hand-driven day drew
  exactly **5**, said *"gross today"*, and carried no leftover line.
  Next: **BUILD #383**.

