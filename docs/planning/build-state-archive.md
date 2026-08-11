# Build state — log archive

Rolled off the end of `docs/planning/build-state.md`, which keeps only the newest 3 entries.
Newest first, text unchanged from when it was written. `/next` does **not** read this file at
session start — open it on demand when a past slice's rationale needs recovering.

## Log

- 2026-08-09 — **BUILT #375** (gross by department — the tracer for the D1 profit-center axis).
  The store has run four profit centers since #314 and nothing in the game could say which one
  made the money; a repo-wide search for a per-department gross getter returned zero engine
  hits. It is one optional `ProfitCenter` tag on every ledger post — `sales | fni | service |
  bodyshop | store` — plus `getDepartmentPnL(from, to)` and the Finance panel that reads it.
  **Omitted ⇒ `store` overhead is the RULE, not a fallback.** Every untagged post — pre-#375
  saves, every harness, every future call site somebody forgets — lands below the gross line
  rather than being credited to a department it did not come from. That default is why the
  slice moved nothing: an untagged ledger reads exactly as it did before.
  **The reconciliation is the whole product.** `sum(departments.gross) − overhead ===
  netIncome`, for any window, always — and it is only available because #374 made the statement
  accrual. Both reads go through ONE private `pnlEntries` filter (which drops
  `inventoryAcquisition` whole); a department cut with its own filter is how four grosses start
  disagreeing with the Net Income printed beside them. **Verified live** on the Day-39 T2 save:
  Sales $716 + F&I $1,581 − $1,779 overhead = the $518 the Net Income card shows.
  **`overhead` is store expenses NET of store revenue**, so the identity stays one subtraction.
  A store-center receipt (PE sellout, admin injection) is not a department's gross and has
  nowhere else honest to go. Consequence on a **legacy save**: the 30D window read overhead of
  **−$35,479** — a whole month of untagged revenue sitting on the store line. That is correct
  and documented (a pre-tag ledger reads as overhead); it is not a bug, and it does not happen
  to a career started after this commit.
  **Payroll is NOT cost of sale, and that is a design call not an omission.** Techs and advisors
  draw one aggregate daily wage in this sim, not flat rate, and StaffOrg posts it as a single
  line. Splitting it across departments needs a second wage model nobody asked for. The
  statement is the classic one: departmental gross → less store overhead → net income. A future
  session "finishing" the panel by allocating payroll is building a different mechanic.
  **The tag arrives as a NAMED OBJECT (`PostTag` / `ExpenseTag`), not a fourth positional
  argument.** `postExpense(x, 'Recon', undefined, 'sales')` was the alternative. Every existing
  `'inventoryAcquisition'` call site became `{ category: 'inventoryAcquisition' }` — a small,
  once-only churn that buys a surface the next axis can join without touching a call site.
  **Service and Body Shop attribute through `DeptDispatchProfile.profitCenter`**, alongside the
  pricing, RNG namespace and event family a department already owns. The one shared engine
  names neither department; `tests/DeptDispatch.profitCenter.test.ts` runs two profiles that
  differ only in the fields a department owns, so a hard-coded `'service'` inside the engine
  fails the body-shop half while every Service test still passes.
  **PARTS WERE THE HALF #374 LEFT OPEN, and this slice closed it.** Parts orders debit cash
  tagged `inventoryAcquisition`, which the accrual P&L drops whole — and *nothing ever relieved
  them*. So since #374 every part the store ever bought had been silently off the statement:
  Service and Body Shop would have shipped a gross with no parts in it, and Net Income was
  overstated by the lot. `consume` now posts `postCostOfSale(lot.unitCost, 'Parts used: <cat>')`
  at the part's own department, keyed off its category (`PART_PROFIT_CENTER` — no default, so a
  new `PartCategory` without a home there is a compile error rather than a silent charge to
  overhead). A **miss relieves nothing** — no part left the shelf. `PartsInventoryDeps.economy`
  is now `Pick<Economy, 'postExpense' | 'postCostOfSale'>`; both halves are required, because a
  stock room that only ever debits is exactly the cash-basis defect #374 closed for vehicles.
  This was folded in rather than filed as a follow-on (the #379 treatment) because without it
  the panel this slice ships would state a Service gross that is knowably wrong.
  **Nothing calibrated moved and nothing could.** Cash is untouched by every part of this;
  `getPnL`/`getDepartmentPnL` have no consumer outside the Finance UI, and `scripts/` has zero
  hits for either. Full suite green at 242 suites / 3047 tests, `#94` still reads
  85.7 / 10.2 / 4.2.
  **The panel omits, never zeroes.** `active` (a center posted *anything* in the window) is the
  test, not `gross !== 0` — so a Tier-1 store draws no "Body Shop" bar asserting a loss on
  collision work it never did, while a department that burned parts and billed nothing still
  shows its negative bar. Confirmed on the drive: with no service advisor on staff the day's
  tickets went unserved and the Service bar was correctly absent.
  **`EconomySnapshot.schemaVersion` stays 1 and `WORLD_SNAPSHOT_VERSION` stays 21** —
  `profitCenter` is optional inside the module's own blob, and `tagFields` OMITS the key rather
  than writing `undefined`, so an untagged entry snapshots byte-identical. There is no
  migration to look for.
  Bar labels were checked against the ~13-character clip that shortened #365's reserve label:
  "Body Shop" is 9, and a test pins every center's label at ≤13 so a rename cannot ship
  half-read.

- 2026-08-09 — **BUILT #374** (the P&L relieves inventory at the sale). `Economy.getPnL` was
  pure cash-basis, so a month spent stocking reported a loss the store did not make — at Tier 1,
  where a six-space lot is bought out in two or three days, that was most of the number. It is
  accrual now, and the model was already half-built: #255's `inventoryAcquisition` category
  existed precisely to say "cash converted into stock, NOT operating spend" and the P&L had
  never acted on the tag.
  **`inventoryAcquisition` entries drop out of `getPnL` WHOLE — totals and `entries` both.**
  The criterion only named the total; dropping them from `entries` as well is what makes the
  room reconcile, because `financeModel.groupExpenses` builds the "Where the Money Went" chart
  off `pnl.entries`. Leaving them in would have listed an "Auction purchase" the Net Income
  above it does not count — two numbers on one screen that cannot be added up, which is the
  exact defect this read exists to close. `snapshot().ledger` is still the complete record;
  `getPnL` is a **read** of it, and one #255 test was moved onto the ledger to say so.
  **`postCostOfSale(amount, label)` is the new concept and it publishes NOTHING.**
  `economy:expense_posted` means cash moved — Telemetry's `cashCurve` is its only consumer and
  is a cash curve — so a non-cash entry firing it would silently corrupt the one thing that
  event exists for. A P&L reader wants `getPnL`. Posting the relief through `postExpense`
  instead would have debited the store twice for one car.
  **`Inventory` is the only relieving module and it relieves `purchasePrice` ONLY**, from a
  private `relieveCostOfSale` called at the two doors a unit leaves by (`sellVehicle`,
  `wholesaleOut` — so both wholesale reasons are covered by the same line). Recon, inspection
  and carrying are already operating spend on the days they were incurred, so relieving
  `costBasisOf` would bill recon twice. **A trade-in and a #296 seed unit are relieved too**
  even though their `purchasePrice` never cost cash: what a sold car cost the store is what the
  store gave up to have it, bank account or not — the same statement `frontGross` has always
  made.
  **The label is ONE constant** (`Cost of Vehicles Sold`), not per-vehicle: the expense chart
  groups by label and a label per car would shatter the biggest line on a dealership's
  statement into slivers that all fold into "Other".
  **No envelope bump and no migration** — `nonCash` is optional inside the module's own blob, so
  `EconomySnapshot.schemaVersion` stays 1 and `WORLD_SNAPSHOT_VERSION` stays 21. A pre-#374 save
  is read under the new rule and **never back-filled**: its historical months read more
  profitable than they did on the day they closed, because their acquisitions have no matching
  relief. That is the accepted artifact the issue named, not a bug to fix later.
  **Nothing calibrated moved and nothing could** — `getPnL`'s four consumers are all Finance UI,
  `scripts/` has zero hits for it, every monitor and gate face branches on `economy.cash`.
  `#180` still reads 39.3% / 51.7%, closes=290. **239 suites / 3033 tests, typecheck clean.**
  Web-verified end to end on the day-35 `Harness Bot's Lot` slot — a legacy pre-#374 save, which
  also proves the no-migration restore. Wholesaling a unit the confirm sheet said the store had
  **$14,026** in posted a **$12,900** "Cost of Vehicles Sold" line: the acquisition price alone,
  so recon is demonstrably not double-charged. The day's Net Income of **−$1,779** reconciles
  line for line ($11,922 proceeds − 12,900 − 241 − 204 − 155 − 126 − 75). No "Auction purchase"
  row remains anywhere on the breakdown.
  **Two follow-ups were FILED, not folded in.** **#379** — found while tracing the trade path:
  `closeDeal` posts the full `agreedPrice` to cash (`DealEngine.ts:205`) while `StaffDispatch`
  builds the structure net of the trade (`:736`/`:744`) and `acquireFromTrade` posts no expense,
  so the store banks `tradeEquity` it was never paid **and** keeps the trade car free; the lien
  `payoff` never leaves the bank either. `Inventory/CLAUDE.md`'s claim that the allowance "is
  offset against deal cash in the close structure" is what made it invisible — the offset does
  not exist, and `DealEngineDeps.economy` is `Pick<Economy,'postRevenue'>` so the module cannot
  debit even in principle. At a **42.1% trade rate** over 290 closes this is a standing cash
  faucet, so the fix **will** move the #286 balance bands and is filed to say so rather than
  measure it away. Deliberately not folded into #374, which promised to move no cash. The P&L
  is already right on a trade deal and stays right; only the cash balance is wrong.
  **#380** — the director's question this session: automated buying (UCM auto-source #293,
  construction #359, wire billing #178) drops the Home HUD's one headline number without the
  player touching anything, which reads as decay. #374 taught the *engine* that buying a car is
  a conversion; the HUD still doesn't know. Filed as **Cash on Hand + "What the Store Is
  Worth"** (`cash + inventory at book`), cash staying the primary figure because it is what
  bankruptcy and every gate face branch on. Book not market — a worth figure that drifts with
  the used-car market would fall on a day the player did nothing, which is the exact
  disconnection it exists to remove. Facility and floorplan are **not excluded**: whether a
  built bay is a sellable asset has never been asked, so the figure is labeled for exactly what
  it sums until that ruling exists. The one thing for the director to overrule is Home-vs-
  Finance-only.
  Next: **BUILD #375** (the `ProfitCenter` tracer), whose only dep was #374.

- 2026-08-08 — **SLICED phase 10 (D1, the three dashboards) into #374–#378.** The phase row had
  carried *"largely absorbed by 5c (#349/#350/#351); re-scope when reached"* since it was written,
  and the subtraction against the app that actually ships is the unit. It was done by inventorying
  the three rooms as rendered — not by re-reading the 5c slices' source — and the result is
  asymmetric: **Growth survives nothing, People two items, Finance three.**
  **Growth is complete.** All six D1-implied panels are live and its only remaining charter line
  (courtship / brand portfolio) is explicitly T4, i.e. E1. A phase can close a room by finding
  nothing left in it, and this one did.
  **The find that changed the shape of the slice is in Finance, and it is an engine gap, not a UI
  gap.** D1 names "per-department gross"; the game has no such number and no getter that could
  build one — `departmentGross|grossByDepartment|deptGross|serviceGross|bodyShopGross` returns
  **zero engine hits**. The store can run four profit centers (sales, F&I, service, body shop) and
  cannot answer which one made the money. Finance's existing "What the Gross Was Made Of" splits
  by *revenue line*, which is a different axis, and the department pages show demand and health
  and no money at all. So #375 is a real vertical tracer — a `ProfitCenter` tag on the ledger in
  the exact idiom `ExpenseCategory` already established (**omitted ⇒ `store` overhead**, which is
  what keeps every existing harness honest), `getDepartmentPnL`, and the panel that reads it.
  **Writing that tracer surfaced a prerequisite nobody had filed, so it became #374.**
  `Economy.getPnL` is pure cash-basis: an auction purchase is charged as an operating expense on
  the day of the buy, while that unit's revenue arrives weeks later. At Tier 1, where a six-space
  lot is bought out in two or three days, that is not a rounding artifact — it is most of the
  number, and it means **a month spent stocking reports a loss the store did not make.** The model
  is already half-built: #255's `category: 'inventoryAcquisition'` exists to say "cash converted
  into stock, NOT operating spend", and the P&L simply never acts on the tag. #374 makes it
  accrual — inventory relieved at the sale, cash untouched — which needs one new concept, a
  **non-cash ledger entry**, because posting the relief through `postExpense` would debit the store
  twice for one car. It relieves `purchasePrice` **only**: recon and carrying are already expensed
  when incurred, which is what that same category boundary says, so relieving the full cost basis
  would double-charge recon. Filed before #375 because without it gross-by-department and Net
  Income are two numbers that do not add up — the exact defect the #365 reserve-posting note exists
  about.
  **#374's blast radius was checked rather than assumed.** `getPnL` has four consumers, all four
  Finance UI; `scripts/` has zero hits for `getPnL` or `netIncome`; every monitor and gate face
  branches on `economy.cash`. So a change to what Net Income *means* moves no calibration number —
  which is the difference between this being a one-slice fix and a C2-class gate.
  **Payroll stays in overhead, deliberately.** Techs and advisors draw a flat daily wage, not
  flat-rate, and payroll posts as one aggregate (`StaffOrg.ts:621`); splitting it across
  departments would need a second wage model nobody asked for. Gross is revenue less cost of sale,
  and the ladder **departmental gross → less store overhead → net** is #376's statement. That is
  also the classic dealership month-end reading, so it is one rule, not a compromise.
  **People's two survivors are both engine values with no surface.** Skill growth (#294 Model B) is
  invisible — the card renders `effectiveSkills` alone, never against the hire-time base or the
  per-hire cap, so a rookie who is climbing and a veteran who has topped out draw identically, and
  the counters accruing overnight produce no visible event. And `getMoraleMultiplier` scales what a
  person actually produces (`createWorld.ts:977`, `StaffDispatch.ts:508/522`) and **no UI reads
  it**, so the morale bar states a level and never a consequence — the "dead control with no
  explanation" case the plain-language rule exists to prevent. #377 adds no lever: the deliberate
  refusal to ship a training section (`PeopleTab.tsx:288-294`) stands.
  **#378 is the phase's closing act and it is not just a deletion.** `StrategicTab.tsx:40` still
  renders "This surface is coming in a later slice" and `navTabs.ts:9` still calls the three rooms
  placeholders; both are false and the component is **unreachable** (its `GameScreen.tsx:464`
  fallback cannot fire, since all five tab keys exist). The substantive half of the slice is
  replacing that silent render-time fallback with a composition-time failure, so this class of stub
  cannot grow back. A stale "coming soon" is worse than no surface — it is what makes the next
  session re-derive a phase that is already done.
  All five bodies carry EARS acceptance criteria with named tests per the `pre-issue-criteria`
  hook. No code changed this session.
  Next: **BUILD #374**.

- 2026-08-08 — **BUILT #373** (the monthly F&I verdict — phase 9 COMPLETE). The posture (#366)
  is a bet the player places once and leaves standing; every tooth on it bites one deal at a
  time, which is a grain the bet was never placed at. This is the Reveal resolving it at the
  grain it *was* — and it is the plug-in that proves the spine's "self-similar" claim, because
  carrying a month-grain beat needed **one more weight and one more term**, not a month mode.
  **The verdict is a `reactions[]` entry like any other.** `DramaCandidate` gained a fourth kind
  (`fni`), `scoreDrama` a flat `weights.fniVerdict` (2.5, above `recordBroken`), and the verdict
  leads the arrival order so it wins an exact tie with the crown it may arrive beside. There is
  deliberately **no margin half** on its score: it fires on exactly one bite a month, and scaling
  it by how much money it made would let a quiet month's verdict get pushed off the feed by an
  ordinary Tuesday's walk-off. How good the month *was* is what `bestFniPvr` scores.
  **It stars an entity with a fate, never the number** — *"Dana Reyes worked the desk on
  'Balanced' — $8,400 on 12 cars ($4,800 products, $3,600 rate)"*, or *"No finance office —
  'More per deal' had nobody to carry it out"* when nobody was hired, which is a fate and not a
  missing value. The two halves are named separately because #365 split them: one undifferentiated
  "back gross" cannot tell the player which lever moved.
  **The mix read is ONE comparison, and it is what teaches #371 and #372 without a tutorial.**
  Each posture in `data/tunables.json` now carries a `financedShareBand` — the share of a month's
  retail that has to finance for that posture to have been the right standing bet. Reserve is
  earned on financed contracts and nowhere else, so *"Only 2 of 12 financed — a cash-paying crowd,
  and a rate you mark up earns nothing on the ones who pay cash"* and *"12 of 12 financed — that
  crowd was going to borrow anyway, and you held the rate down for them"* are the same rule read
  from opposite ends. **Balanced spans [0,1] on purpose**: it is the posture that makes no bet on
  the mix, so it can be beaten on money and never mismatched. **Tone follows the mix, not the
  money** — a month can earn well and still have been the wrong bet, and which crowd the dial was
  pointed at is the whole lesson.
  **`bestFniPvr` is the seventh mark and a MONTH mark** (`monthBackGross ÷ monthUnits`, settled on
  `clock:month_ended` beside `bestMonthGross`). Not a day mark: a single day's back end is noise
  against which two or three customers happened to walk in. It has **no `pvrMinUnits`-style volume
  floor** — that floor exists on `bestPvr` because a one-unit day duplicates `bestSingleDeal`, and
  nothing else measures the back end at all. An all-cash month leaves the mark standing rather
  than setting it to zero (`tryBreak` refuses a non-positive), and a month with no units crowns
  nothing — which is the same month the verdict refuses to fire on, for the same reason: no crowd,
  no bet to resolve, and "$0 a car" would blame the dial for a floor problem.
  **No envelope bump — this was the module's own `schemaVersion` 1 → 2.** Per
  `docs/save-migration-recipe.md` the `modules` key set did not change, so `WORLD_SNAPSHOT_VERSION`
  stays **21** and there is no migration to look for (the #359 Facility call, same shape).
  `Records.restore` takes an `AnyRecordsSnapshot` union: a v1 blob's missing seventh mark
  materializes as `null` — **not** as a `{}` mark the feed would then try to crown — and the month
  back-end tally restarts from the reload rather than being reconstructed from a figure the save
  never kept. `data/fixtures/tier-2.json` was deliberately **not** re-stamped.
  **The verdict is composed in `createWorld`, not at the surface** (`World.getFniMonthVerdict`),
  because it is three reads that have to agree and each has exactly one right source: the month's
  retail flow off the KPI window (the same log the peak meter reads), the person off the ONE desk
  pick the close runs on (`resolveFniDeskPerson`, lifted out of #369's `resolveFniDesk` so the
  name and the skills come from one pick), and the posture off the slot state that priced the
  deals — reaching it through a new `getFniPostureId` getter beside the existing markup one, two
  getters over one piece of state so the pricing path cannot read a label and the reporting path
  cannot read a rate.
  **It is told the morning after, by construction.** `clock:month_ended` fires during the Next Day
  transition, so — exactly like the `bestMonthGross` crown — the verdict lands in the following
  day's ref and is read on that day's Reveal. Its crown rides the same bite for free.
  **Nothing calibrated moved and nothing could**: the verdict is a pure read, `bestFniPvr` is a
  scoreboard entry nothing branches on, and no harness closes a month with the Reveal assembled.
  `#180` still reads 39.3% / 51.7%, closes=290.
  10 tests in `tests/Reveal.fni.test.ts` (including an anti-orphan case that queries
  `World.getFniMonthVerdict` off real `deal:closed` traffic on a real bus), 4 in
  `tests/Records.test.ts`, the pre-#373 restore in `tests/worldSnapshot.test.ts`, and a #373
  composition guard in `tests/Reveal.reachability.test.tsx` asserting **both** halves of the
  wiring — the capture at month close and the parameter it fills — because either alone is wired
  to nothing. **238 suites / 3027 tests, typecheck clean.**
  Web: the T2 dev fixture and the day-35 `Harness Bot's Lot` slot both carry a **schemaVersion-1
  records blob**, so loading that save through the real load path is the live proof of the union
  restore — it came up clean (cash, tier strip, month bars, recap chip all rendering, no console
  errors). The month beat itself was **not** driven on web: reaching it needs a 30-day window,
  and standing the store on one would have meant editing the user's own save. It is covered by
  the reachability test + the composition guard, which run in CI where a drive does not.

- 2026-08-08 — **BUILT #372** (advertising buys a different crowd). #371 gave the player a read
  on how the coming crowd pays; this is the answer they get to give back. An advertising
  campaign now carries **two orthogonal lanes** — vehicle-type weights (which segment walks in)
  and **person-archetype weights** (who does) — and the second one moves the store's credit and
  payment mix for real. `data/tunables.json` gains **we-finance-anyone** ($110/day: pulls
  young families / commuters / tradespeople, thin front, busy office) and **certified-preowned**
  ($130/day: pulls retirees / enthusiasts, fat front, quiet office).
  **The two lanes ride ONE input on ONE lag/decay clock**, because a campaign's two halves are
  one lever — separate clocks would let a push arrive as one crowd and settle as another.
  `DemandInfluenceInput.personWeights` is optional, so every segment-only producer (inventory,
  reputation, pricing) is byte-identical, and the vector helpers were re-keyed by an explicit
  key list rather than duplicated per lane.
  **The skew is applied in exactly ONE place: `CustomerPool.skewSegmentArchetypes`.** Both the
  spawn draw and the #371 finance-mix projection go through it, so the crowd the wire promises
  is the crowd that walks in — the same rule `resolveSegmentArchetypes` exists for, one level
  down. A skew that would zero every candidate in a segment returns it **unskewed**:
  advertising bends who walks in, it cannot close a segment the heat map still spawns, and an
  empty candidate list would fall through to a persona that does not belong to that segment.
  **The person weights bend the WITHIN-segment roll only, and the cross-segment half is the
  campaign's other lane.** That is not a gap — `tradesperson` is 100% of `truck` and `retiree`
  only lives in `suv`, so a crowd skew that also moved the segment draw would be the vehicle
  lane written twice, on a clock the player cannot see. Both shipped campaigns therefore carry
  both lanes, and the schema **refuses a campaign declaring neither** — a chip the player pays
  $110/day for that moves nothing is a lever with nothing behind it. `weights` is now optional
  and `buildAdvertisingInfluence` reads **either** lane, which matters beyond taste: the daily
  bill is read back off the running input, so a crowd-only campaign that resolved to `null`
  would have run **free**.
  **No snapshot bump.** The two person vectors are optional on the wire, and a pre-#372 schema-3
  blob restores as "this lever skews nobody" — which is exactly what it meant.
  Surfaced on the Growth demand console as its own sentence — *Trucks +40 / Sedans +35* then
  **Brings in: Young Family +50 / Commuter +40 / Tradesperson +30** — because what they want to
  buy and who they are are different kinds of fact, and running them together invites the player
  to read one as the other. Labels come from `SALES_ARCHETYPES`, so a lever can never name a
  buyer the game does not spawn.
  Verified on web at T2: both chips render with their prices, selecting one shows the blurb +
  "Billed $110/day while it runs", cash dropped by the bill on the next day close, and after the
  2-day lag the lever row rendered both sentences above with the observed mix leaning trucks.
  Six tests in `tests/DemandShaper.advertising.test.ts` (one per EARS criterion plus the
  free-campaign guard) — the crowd assertions run **real days** and read
  `capacity:customer_admitted`, so they measure the shipped generation path, not a
  re-derivation — plus a #372 anti-orphan case in `tests/DemandShaper.reachability.test.tsx`
  driving the real `buildTargetingLevers`. Measured: financed share 80.2% → **88.4%** and mean
  credit 676 → **662** under we-finance-anyone; 80.2% → **74.4%** and 676 → **692** under
  certified-preowned.
  237 suites / **3011** tests, typecheck clean, **`#180` live bands byte-identical** (39.3% /
  51.7%, closes=290) — no harness runs a campaign, so nothing calibrated could move. The
  full-suite failures were `LegacyWall.reachability`, `FniPosture.reachability`,
  `App.recapPersistence` and `App.saveFlow` timing out on `waitFor`; all four pass in isolation
  and none touches this slice — the documented RN-Testing-Library CPU-load flake.
  Next: **BUILD #373** — the monthly F&I verdict (Reveal reactions + the PVR record), the last
  slice in phase 9. Its deps (#365/#366/#371) were already met.

- 2026-08-08 — **BUILT #371** (the crowd tells you how it pays before you set the dial).
  #370 gave the posture a meter that reads the store's **own book**; this is what puts the
  *coming crowd* on the wire, so next month's posture is a bet placed on information rather
  than a coin flip. Growth gains a **How the Crowd Pays** panel behind the wire's door model:
  cash-vs-financed over every up, and the credit mix of the ones who would finance.
  **The read is DERIVED, never sampled, and that is the load-bearing decision.**
  `projectCrowdFinanceMix` (NPC, `factories/CrowdMixProjection.ts`) answers in closed form the
  question `createCustomer` answers by rolling. It draws no randomness at all — a test hands it
  a counting `Math.random` and asserts zero calls — because a **gated** read that consumed a
  seeded stream would make a fixed seed replay differently depending on what the player bought
  (#122). The reachability test runs two same-seed worlds 20 floor days apart, one subscribed
  and one cold, and pins the arrival stream identical.
  **The payment traits are integrated by enumerating subsets, not by averaging effects.** They
  are independent Bernoullis, so the exact expectation walks the 2^n subsets and runs each
  through the same `resolveEffects` machinery the roll uses. Averaging would let a partial
  `must-finance` chance *partly* forbid cash (it is categorical) and would smear the [0,1]
  clamp on `payment.cash_probability` (it is additive) — the #153 split has to survive the
  integration, not be flattened by it. Credit falls out as normal-CDF mass between the
  `data/credit-tiers.json` thresholds, so the bands arrive as **data** (`{tier, minScore}`),
  not as a classifier function: a classifier can say which tier one score is in but not how
  much of a distribution lands in each, and the second question is the whole read.
  **`creditMix` describes the FINANCED crowd, weighted by P(finance | archetype).** Credit and
  payment leaning correlate through the archetype — the best-credit retiree is also the
  likeliest cash buyer — so an all-comers credit mix would systematically flatter the book the
  F&I office actually writes. Do not "simplify" it to the whole crowd.
  **`resolveSegmentArchetypes` moved onto the CustomerPool barrel** so the spawn draw and the
  projection read the segment→archetype table exactly once (`createWorld`'s private map
  building is gone). Two copies of that filter + normalization is how a forward read starts
  describing a crowd that never walks in.
  **MarketIntel's door model grew two ways, both forced by there being a SECOND desk.**
  (1) A staff unlock now **names the role** that opens it (`role`, schema-required on a staff
  door and refused on a subscription one), and `NewsAccessRead` carries `staffedDesks` — the
  roster's role ids, read exactly the way `activeSubscriptions` is read — instead of one
  `hasDeskManager` boolean. That boolean opened *every* staff door, so an `fni_desk` unlock
  would have been handed free to any store with a used car manager: a live bug, not a
  refactor. `resolveWireAccess` passes the whole roster's roles rather than an allowlist, so
  which role opens which door stays entirely in data.
  (2) A lane's `requires` may name **several** unlocks and **any** of them opens it, with
  `NewsAccess.locksFor` reporting every shut door. `lockFor` still returns the first — all a
  headline row has space for — so nothing about the existing wire moved. The finance-mix lane
  is bought (`finance_mix_feed`, $25/day, T2) **or** hired into (`fni_desk`, T3, free on hire
  like every other desk read), and a locked row naming only the subscription would have sold a
  store exactly what the hire already gives them.
  **`finance_desk` is a lane with no headlines behind it, deliberately.** What the player is
  allowed to *know* is one door model whether the answer arrives as a story or as a number;
  growing a second gate for the panel would have been the same rule written twice.
  Verified on web at T2: locked panel names both doors in plain language, the wire footer's
  Subscribe opens it in place, and the read comes out **84% financed** with an A/B/C/D book of
  **23/24/36/18**. No console errors. Nothing calibrated moved — the projection is a pure read
  and no harness opens the lane.

- 2026-08-08 — **BUILT #370** (the peak meter — the dial finally shows what it costs).
  The posture had two teeth on it (#367's fall-through, #368's CSI drag) and both were
  invisible until they had already bitten. Prep's Finance Office block now carries twin opposed
  bars — **finance profit per contract** filling as the posture gets aggressive, **contracts the
  bank buys** draining as it does — and a third bar for the resulting total, which **crests**.
  **The correction that made the crest real: a fall-through costs the WHOLE DEAL.** The issue
  asked for expected back gross, and back gross alone does not crest — under the shipped numbers
  the aggressive posture beats Balanced by 3–6% at every credit mix with A/B paper in it, and
  the meter would have shipped teaching the player to gouge. But #367's guard fires before
  `trade:resolved` and the customer **walks**: the front and product gross die with the
  contract, not just the spread. So each book sample carries `dealGross = frontGross +
  productGross` and the curve is `(dealGross + reserve) × stick`. With that, the shipped
  placeholder config reads exactly as grill Q4/Q5 designed — peak at **Balanced** with a green
  or absent desk, sliding to **More per deal** at `finance_structuring` ≈ 70, and back to
  Balanced for a subprime-heavy book whose lender caps clamp the markup away. No tunable was
  touched to get there.
  **The satisfaction cost is stated beside the money and never folded into it.** A satisfaction
  point is not a dollar, and inventing an exchange rate to bend the curve would be a second
  pricing rule the player can neither see nor move. `markupSatisfactionHit` rides the projection
  and the surface says it in its own sentence.
  **The credit mix is the store's OWN BOOK, not a modeled crowd.** #371 is what puts the
  *crowd's* finance mix on the wire; this reads the contracts already written, which is where
  the mix that matters already lives. `deal:closed` gained `creditTier` and `DealRecord` gained
  `creditTier` + `loanAmount` — both optional, both carried by the existing `...d` restore
  spread, inside the module's blob, so `WORLD_SNAPSHOT_VERSION` did not move and there is no
  migration. A record missing either sits outside `getFinancedBook()` rather than being patched
  with a guess. **The tier is carried, never decoded from `apr`**: the shipped bands are
  disjoint so arithmetic would work today, and would break silently on the next edit to
  `data/credit-tiers.json` while the meter went on reporting a peak.
  **One rule, two callers, again.** `resolveDeskSkill` came out of StaffDispatch onto its barrel
  and `World.getFniStructuringSkill()` composes it with the same person-pick `getFniDesk` uses
  (extracted as the named `resolveFniDesk` in `createWorld`) — a meter projecting the raw roster
  composite would drift from the close exactly when the desk's morale was down, which is when
  the player is looking.
  Verified on web against a real Tier-2 store: the empty state on load ("You haven't financed a
  car yet"), then one day skipped to close, then the populated read — *Finance profit per
  contract $186 · Contracts the bank buys 100% · Total gross per financed customer $470 ·
  "Balanced earns the most right now."* Switching the chip with the recap modal up was not
  reachable (the documented hidden-pane modal artifact), and that branch is covered by the
  component test. Nine tests across `tests/FniPeakModel.test.ts` +
  `tests/FniPeakMeter.test.tsx`, plus the #370 anti-orphan assertions folded into
  `tests/FniPosture.reachability.test.tsx`.
  235 suites / **2992** tests, typecheck clean, `#180` live bands byte-identical (39.3% /
  51.7%, closes=290 — the slice is a read plus two recorded fields, and no harness reads the
  book). The two full-suite failures were `App.saveFlow` and `InTabNavigation.reachability`
  timing out on `waitFor`; both pass in isolation — the documented RN-Testing-Library CPU-load
  flake.
  Next: **BUILD #371** — the crowd's finance mix read ahead on the wire (MarketIntel lane, the
  F&I manager as a third opener). #372 stays deps-met independently.

- 2026-08-08 — **BUILT #369** (the F&I manager finally works the deal instead of the salesperson).
  The back end had been rolling off the **selling salesperson's** effectiveness, which is exactly
  what a store with no finance office looks like — and it kept looking like that after the hire.
  Hiring an `f&i-manager` now turns the office on: `product_presentation` works the menu and
  `finance_structuring` decides how much markup the lender will still buy.
  **One closure, one person, two composites.** The desk reaches the flow as
  `StaffDispatchDeps.getFniDesk?: () => FniDeskSkills | null` (`{ staffId, productPresentation,
  financeStructuring }`) — the `getTradeApprover` idiom, so StaffDispatch never learns a role id.
  The composition root picks **the strongest `f&i-manager` by the role's own composite**, exactly
  how the resolver picks which salesperson takes an up; a per-skill maximum across the roster
  would have staffed the desk with a manager nobody hired. **The desk's morale multiplies both
  composites** — the finance manager is not the one employee whose mood doesn't matter.
  **The premium shelf needed no gate of its own.** `unlockedRoles` is already derived from the
  roster, so the four `requiredRole`-gated products come off the shelf with the person who sells
  them. All six unlock together and there is no per-product control anywhere (grill Q10) — the
  test scans every `src/ui/**` file for a product id or a menu call and asserts the engine's only
  product-shaped surface is the read `getFniProducts`.
  **The frontier extension is ONE monotonic relation in `data/`** (`fniDealKill`
  `structuringFrontierMaxPts` 0.0075 / `structuringSkillReference` 100, via the new pure
  `resolveSafeFrontierPts`): linear from the bare `safeFrontierPts` at skill 0 to a full extension
  at the reference, then **flat** — a manager cannot out-structure the lender forever. The max
  extension is deliberately the reach **from Balanced to "More per deal"** (0.0175 → 0.0250), so a
  reference-grade desk can run the aggressive posture with nothing falling through and every desk
  short of it pays a real rate. That is grill Q5's "the peak slides toward aggressive", and it
  slides rather than disappearing.
  **The design call this slice owed (build-state, #368): the CSI drag's `fairMarkupPts` does NOT
  follow the lender's frontier.** A slicker structurer changes what the **bank** will buy, not how
  gouged the **customer** feels. So a sharp desk makes the aggressive posture *survivable*, never
  *free* — it changes which tooth bites, and the two teeth stop being one line the moment the
  store hires someone good. Recorded in the `fniDealKill` `_doc`, both module CLAUDE.mds and the
  blockers below; do not "restore consistency" by coupling them.
  **`null` is "no finance office", not "skill 0", and they are written separately on purpose.**
  They coincide numerically today; keeping them distinct means a future extension that is nonzero
  at skill 0 cannot silently grant itself to a store that never hired anyone.
  Byte-identity holds by construction: nothing in `tests/` or `scripts/` hires an `f&i-manager`,
  and with none on the roster `getFniDesk` returns `null` ⇒ the salesperson presents ⇒ the flat
  #367 frontier. No calibration number was touched and no harness moved.
  No web drive: this slice adds **no** surface. The posture dial (#366) is already on Operations →
  Prep and the effect of the hire is engine-side, so there was nothing new to look at; the
  player-facing read of what a desk buys is #370's peak meter. Five flow/pure tests in
  `tests/FniManagerDesk.test.ts`, one per EARS criterion.
  233 suites / **2982** tests, typecheck clean. The one full-suite failure was `App.saveFlow`
  timing out on a `waitFor`; it passes in isolation — the documented RN-Testing-Library CPU-load
  flake, now seen on a fourth suite.
  Next: **BUILD #370** — the peak meter (twin opposed bars, the crest is not the max), which is
  now deps-met. #371 and #372 stay deps-met independently.

- 2026-08-08 — **BUILT #368** (the second tooth: gouging a customer thins the crowd).
  Deal-kill costs the store the deal it was working; this costs it the **next** customer. A
  financed deal closed past a fairness line publishes `reputation:satisfaction_hit` scaled by the
  excess, and store satisfaction already feeds `CustomerPool` arrival rates — so an aggressive
  posture that survives the lender still shrinks tomorrow's traffic.
  **The producer was added, not a path.** Reputation is already the sole consumer of that event
  and there is exactly one channel into store satisfaction; CapacityManager, InstalledBase and
  the regulatory/bankruptcy monitors all publish onto it. DealEngine's `closeDeal` now joins them
  beside the lemon-law and payment-packing producers, with `reason: 'fni_rate_markup'`. No new
  event name, no new coupling, and nothing branches on `reason` — it is diagnostic.
  **The hit is on the MARKUP, never on the products** (grill Q3). Attaching a menu is the F&I
  desk's job; over-marking the rate is the gouge. A cash deal quotes no rate, so it cannot be
  gouged at any attach — the test hands a cash close a fully-marked spread *and* a GAP policy and
  asserts silence. **Chargebacks are explicitly a later refinement layer on this same variable**
  and are not built here.
  **One frontier, two teeth.** `fniCsiDrag.fairMarkupPts` deliberately equals
  `fniDealKill.safeFrontierPts` (0.0175) and the curve is the same shape — linear ramp, flat past
  the end, exactly zero at or under the line. The player learns ONE line to read the dial rather
  than two. It is a separate key because the two are separately *measured* (a probability against
  a satisfaction delta) and because **#369 moves the lender's frontier with `finance_structuring`
  — moving the customer's fairness line with it is a design decision, not a calibration nudge.**
  A shipped-file test pins them equal so the coupling is visible if either moves.
  **A float subtraction nearly broke the whole calibration corpus, and the guard is the real
  content of this slice.** The markup being judged has to be the one the contract was written at,
  and the only honest source is `customerRate − buyRate` — a subtraction that does **not**
  round-trip in binary floating point. Tier C's buy rate (0.129) plus the Balanced posture's
  0.0175 comes back as **0.017500000000000016**, i.e. 1.6e-17 *over* the line. With a naive
  `over <= 0` test, Balanced would have published a ~1e-15 satisfaction hit on **every** financed
  close: invisible as a number and fatal as a fact, because satisfaction feeds arrival rates and
  every pre-#368 seeded run would have quietly stopped reproducing. `csiDrag.ts` carries a named
  `RATE_EPSILON = 1e-9` — a representation guard, not a balance number, which is why it is in code
  and not in `data/` — and a test walks all four shipped tiers at both the ambient and Balanced
  markups asserting zero. #367's `fallThroughProbability` does **not** have this bug and was left
  alone: it judges `quote.markupPts` directly, which is exact.
  Magnitudes are placeholders owed to C2 (grill I9): `maxSatisfactionHit −1.5` over a 0.0100
  range, so the aggressive posture costs ~1.13 satisfaction per gouged close — on the order of the
  walk drag (−0.12 charged ~2.6×/day) rather than swamping it. The schema **refuses a
  non-negative hit**, the `paidBelowMarketPenalty` lesson: a positive number would mean gouging
  cheers the store up and would read as balance rather than as a dropped minus sign.
  Byte-identity holds by construction — Balanced sits on the line and ambient under it, so no
  existing harness takes this hit and no calibration number was touched.
  No web drive, and nothing new renders: #368 is ambient depth, the same call #151 made. The
  player-facing surface for the posture's cost is #370's peak meter, which reads
  `markupSatisfactionHit` (exported pure for exactly that) without closing a deal to find out.
  232 suites / **2977** tests, typecheck clean. The one full-suite failure was
  `App.recapPersistence` timing out on a `waitFor`; it passes in isolation — the documented
  RN-Testing-Library CPU-load flake, now seen on a third suite.
  Next: **BUILD #369** — the F&I manager works the deal (`finance_structuring` extends the
  frontier, `product_presentation` drives attach). #371 and #372 stay deps-met independently.

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

- 2026-08-08 — **BUILT #365** (the F&I tracer: the store finally earns money on the rate).
  `data/credit-tiers.json`'s `apr` was never the customer's rate — it was the **lender's**, and
  the store was quoting its own cost of money at retail. It is now `buyRate`, with a per-tier
  `markupCapPts` beside it, and the customer pays `buyRate + markup`. Back gross splits: a deal
  earns `productGross` on what attached and `reserveGross` on the spread, `backGross` stays the
  sum, and `deal:closed` carries all three so a Reveal reaction can later name which half moved.
  **The reserve is honest amortization, not a percentage of amount financed.** The payment is
  built at the marked-up rate; the lender advances the present value of that payment stream
  discounted at its buy rate; the dealer keeps `dealerSharePct` of the difference. It falls out
  of the two loan-math primitives already in the module (PMT and its inverse), so it moves
  correctly with term and principal without a second rate model to keep in step. A test pins it
  **below** the flat `markup × balance × years × share` shortcut, which is exactly the assertion
  a fudge would fail: real paper amortizes down.
  **The structural deal-kill (I3) arrived free, and the way it did is the load-bearing call.**
  `computeMonthlyPayment` now takes the **rate** instead of a `TierDef`, so quoting the wrong one
  is a visible choice at every call site rather than an invisible default. StaffDispatch and
  CustomerPool resolve `quoteFinance(tier)` **once** and hand the same
  `{ buyRate, markupPts, customerRate }` to the affordability gate and to `closeDeal` — the rate
  a buyer is qualified at is the rate they sign, by construction. Because PTI already measures
  the payment, an over-marked structure fails the gate that has always been there. **No new
  check was added**, and `tests/SalesProcess.affordability.test.ts` pins the borderline buyer who
  clears at the buy rate and fails at +2.5 points.
  **Reserve posts revenue, and the first cut of this slice wrongly did not.** I recognized it as
  gross without banking it, reasoning that the lender pays at funding. That was wrong twice over:
  the Finance tab would report back gross the books never saw, unable to reconcile with its own
  Net Income — and `npm run balance -- pacing` came back **byte-identical to the #153 baseline**
  (blend 0.4273, bankruptcy 24%, T2 89, T3 16), which is not a "small effect", it is the tell
  that the money went nowhere. With `postRevenue`: bankruptcy **24% → 21%**, blend **0.4273 →
  0.4294**, everything else unmoved (T1 still the standing 1.0mo-vs-2.0 miss, T2 WITHIN, median
  survival 360). The receivable lag is not modeled anywhere in this project; inventing one for
  this line alone would be a second accounting rule.
  **Markup resolution has exactly one home and no player lever yet** (grill Q2). `ambientMarkupPts`
  with no `f&i-manager` on the desk, `balancedMarkupPts` once there is one, both clamped down to
  the tier's `markupCapPts` — so the subprime program allows the least markup and the most
  desperate customer is not the most profitable one. The desk read is a closure
  (`getFniDeskStaffed`), wired in `createWorld` off the roster and read live, so the first F&I
  hire moves the next deal; DealEngine never imports StaffOrg. #366 turns that one target into
  the three-position posture dial.
  `TierDefSchema` is now `.strict()`. That is not tidiness: a stale `apr` key would have been
  silently stripped by zod, leaving a file that looks right while reserve reads zero.
  **The live bands did not move**: #180 reads positive **35.8%**, apathetic **54.3%** — the same
  numbers #153 left — because ambient markup is 0.75 points and the reserve on a $16k/60mo note
  is ~$212. Every magnitude here is a placeholder owed to a #286-class pass (grill I9).
  Surfaced on the Finance tab as "What the Gross Was Made Of" — Vehicle / F&I Products / Rate
  Reserve, summed off the exact day series rather than an average multiplied back out.
  **The web drive earned its keep**: the label read "inance Reserve" on screen, because the kit's
  horizontal `BarChart` clips its name column at ~13 characters. The model test could not see
  that. Shortened to "Rate Reserve"; the caption carries the full sentence.
  The KPI split is inside the module's own blob (`DealRecord`, optional, restored as zeroes), so
  per `docs/save-migration-recipe.md` **no envelope bump and no migration** — a pre-split deal's
  `backGross` stays whole and simply claims no reserve.
  Anti-orphan: `tests/DealEngine.reserve.test.ts` closes a financed deal on a real `createWorld`
  lot and asserts the reserve reaches `ClosedDealResult`, the KPI snapshot **and the cash
  balance** — a module unit test cannot tell "wired" from "wired to nothing" (#363's lesson).
  227 suites / **2937** tests, typecheck clean.
  Next: **BUILD #152** — attach scales with amount financed (I4), now deps-met.

- 2026-08-07 — **BUILT #153** (the two customers who already know how they're paying).
  `cash-buyer` and `must-finance` — the payment axis the visit archetype's single
  `cashProbability` constant could not express. Both resolve through the ordinary
  `resolveEffects` machinery (grill I5), applied after the archetype base roll: no new enum
  branch, no second modifier system.
  **Two effect keys, not one.** `payment.cash_probability` is an additive shift on the base
  leaning; `payment.must_finance` is categorical — someone rebuilding credit wants the
  tradeline whatever the roll said and whatever they could have written a cheque for. Folding
  both into one scalar with a dominating negative was the tempting one-rule version and it is
  wrong: it flattens a leaning and a category into two sizes of the same knob, and it is not
  actually absolute against a customer who drew both traits. `must-finance` wins that
  collision, stated once at the payment roll. Neither needs an exemption from the
  cash-affordability gate, because that gate only ever pushes a customer *toward* finance.
  **The load-bearing call is that they are drawn on their own stream, not out of
  `trait_pool`.** Incidence is a new optional `payment_traits` map on the person archetype
  (id → independent per-customer probability, `seedFor('traits.payment')`). The shared-pool
  version was built first and reverted: at `trait_count 1..2` it makes a cash buyer *less*
  likely to be price-sensitive — the axes are orthogonal — and widening a 3-wide pool diluted
  the personality mix the **#94** sales calibration is measured against, moving its apathetic
  band 10.2% → 9.7% and breaking it. With the separate stream the personality draw is
  byte-identical and #94 reads **85.7 / 10.2 / 4.2** exactly as before;
  `tests/CustomerFactory.payment.test.ts` pins that a payment trait costs no personality slot.
  **The live band did move, and dose-response says it is the mechanic rather than #151-style
  trajectory divergence.** Halving every rate lands halfway: positive 38.7% → 36.1% → 33.3%,
  apathetic 53.0 → 54.1 → 59.3, trade rate 43.3 → 41.3 → 39.3 (trade incidence is keyed by
  `paymentMethod`, and cash buyers trade less). So the incidence was set to leave the
  calibrated bands where they are instead of re-centring them — **C2 owns these magnitudes
  (I9)**, and a trait slice does not get to re-balance the store's close rate by 5pp on its
  way past. Final live read: positive **35.8%**, apathetic **54.3%**, both inside their
  current windows, no band touched.
  `npm run balance -- pacing` against a HEAD baseline on the same 100 seeds: T2 reached
  87 → **89**, T3 reached 9 → **16**, median failure day 117 → **120**, blend 0.4151 →
  **0.4273**, verdict pass 19% → 20%; **worse**: bankruptcy 19% → **24%** and FAILED 88% →
  90%. Every tier status is unchanged (T1 still the standing 1.0mo-vs-2.0 miss, T2 WITHIN),
  and the ladder measurably reaches further.
  **Anti-orphan, because a trait nobody rolls is a mechanic wired to nothing** (the #363
  failure mode): two tests assert both traits actually occur across the shipped archetype
  crowd and that a real `must-finance` walk-in comes out financed. The one existing suite that
  measured the archetype base cash share now excludes customers who drew a payment trait —
  the base is what those traits modify, so counting them would measure the shifted number
  against the unshifted one.
  226 suites / **2917** tests, typecheck clean.
  Next: **BUILD #365** — the F&I tracer. #152 is lower-numbered but blocked on it.

- 2026-08-07 — **BUILT #364** (the car that sold out from under the second customer). Two
  customers can be held on the **same unit** — one on a `trade:escalated` review, one on a
  `discount:escalated` one, or two of either. Whichever the player resolved first drove the
  car off the lot, and the second resolution died on `No lot vehicle` inside
  `DealEngine.closeDeal`, throwing out of `resolvePlayerDiscountDecision` and into the app.
  **The fix is a walk, not a reservation.** Holding a unit for a pending review was the
  tempting shape and it is the wrong one: it would quietly take cars off the floor for
  everyone else, which is a balance change smuggled in as a crash fix. The car being gone is
  a real dealership moment, so the second customer resolves as an ordinary no-sale with its
  own reason (`vehicle_sold_to_other`) carrying the same residual heat, follow-up eligibility
  and reputation hit every other post-process walk carries — asserted end-to-end against the
  assembled world with the payload the resolver actually emits, not a hand-written one.
  **The guard sits at the decision, not at the settle.** With the car gone, `accept`,
  `counter` and `decline` all have the same answer, so every held-review `decide` re-checks
  the lot before it reads the decision. One check, one `no_sale`, four decision kinds.
  **A held review outlives the lot, so it carries its own vehicle.** `trade:escalated` gained
  a `vehicle` field and the discount payload's became the shared `EscalationVehicle` type;
  the prompt names the car off that snapshot, because a lot lookup comes back empty exactly
  when the player most needs telling which car it was. The live prompt now watches
  `inventory:vehicle_sold`, states in plain language that another customer bought it, and
  drops every accept/counter control — pressing its one button resolves the customer as the
  walk it is, rather than leaving a held review to rot in the composition root.
  Both live-engine harnesses dropped the `try/catch` + `escalationsLostToSoldUnit` tally they
  were carrying as a workaround (#181 and, since #286 made closes common, #180). Test
  scaffolding the two StaffDispatch suites share moved to `tests/helpers/staffDispatchHarness.ts`
  rather than being copied.
  225 suites / **2905** tests, typecheck clean.
  Next: **BUILD #152** — the lowest-numbered open, deps-met issue in phase 9.

- 2026-08-07 — **BUILT #363** (the live floor's walks reach the rest of the game). A walk on
  the live sales floor published only `staff:auto_resolved`, so `customer:resolved` never
  fired for one — and four systems were dead in real play while looking healthy in isolation:
  the whole BDC follow-up pool never filled, walks cost no reputation, regulatory walk
  pressure never accrued, and `TierManager.customersServed` counted closes only (~3% of the
  floor). `CustomerPool` now bridges `staff:auto_resolved`/`no_sale` onto `customer:resolved`.
  **The bridge belongs in CustomerPool, not in StaffDispatch, and that is the load-bearing
  call.** `customer:resolved` is the customer *lifecycle* event: the session, the
  `customer:state_changed` transition, and the guard that stops one customer resolving twice
  all live in the pool. So the pool gained a second live-floor subscription beside its
  `deal:closed` one and stayed the sole publisher — three drivers, one owner.
  **A pre-process walk resolves at `heat: 0` rather than not resolving.** `no_fit` is 71% of
  the floor and carries no warmth by design (a customer the lot had nothing for never got far
  enough to leave a temperature). They are still an up who was on the floor and left, so they
  count as served and cost what a walk costs; they simply are not worth a callback, which
  `FollowUpPool`'s existing `heat <= 0` guard already expresses. No new carve-out.
  **The close half was a lie worth fixing in the same slice.** `CustomerPool` re-ran the
  entire sales process against `STUB_VEHICLE_SPACED` to produce the close's satisfaction —
  scoring the visit against a car nobody was shown, and emitting a phantom
  `customer:gate_evaluated` stream for gates that never ran. The live floor already measures
  this honestly, so the trio now travels with the close: `closeDeal` takes an optional
  `salesQuality`, `deal:closed` round-trips it, `CustomerPool` publishes it. **DealEngine never
  reads it** — only the flow that ran the process can know it. Absent (legacy harnesses,
  direct `closeDeal` callers) the local evaluation still speaks, so the no-DealEngine path is
  byte-for-byte unchanged. The formula itself moved to `SalesProcess.resolutionQuality`, the
  sibling of `residualHeat` and for the same reason — the 0.6/0.4 retention blend was two
  hardcoded magic numbers in `CustomerPool` and is now `data/sales-process.json` `retention`,
  schema-refused unless the weights sum to 1.
  **Turning the producer on was a live-balance event, and it revealed three magnitudes that
  had been calibrated against something that never fired.** First measurement: satisfaction
  70 → **12.5**, review → 15.9, arrivals collapsed with it (the #180 harness could only
  collect 457 of its 600 sample in 600 days), and **regulatory pressure pinned at 80.0 — the
  AG-complaint threshold, terminal at Tier 1**. The store was being shut down for walking the
  same share of its ups every real dealership walks. Retuned: `walkSatisfactionPenalty`
  −1 → **−0.12** (against `closedDealSatisfactionBonus` +3), `walkPressure` 0.5 → **0.05**,
  `angerPressure` 2.0 → **0.4**. The small numbers are not timidity — the walk penalty is
  charged ~2.6 times a day, every day.
  **−0.12 was chosen on the pacing targets, not on feel.** −0.08 sends T1→T2 to a median 2.0
  months (status OUT, too fast); −0.12 holds it at 3.0 against the 3.5 target (WITHIN), which
  is the same read the pre-#363 baseline gave. Measured against a stashed baseline on the same
  100 seeds: survival median 360 = 360, bankruptcy 19% vs 18%, T2 reached 87 vs 91, T1 still
  1.0mo vs the 2.0 target (the standing, unrelated miss). **Better** than baseline: FAILED
  92% → 88%, median failure day 98 → 117, insolvency *throws* 3 → 0. **Worse**: seeds reaching
  T3 18 → 9 — reputation now costs arrivals, which slows the ladder, and that is the mechanic
  working rather than a defect. A 12-seed probe isolates the rest: audit failures 1 → 0,
  indictment contractions 11 → 8, so the indictment deaths in the pacing report are
  **pre-existing and slightly improved**, not something this slice introduced.
  Final live-engine read: 600 reached in 555 days, positive 38.7%, apathetic 53.0%, warm-walk
  share 95.9%, satisfaction **48.5**, review 60.0, regulatory pressure **0.3**, 313 follow-ups
  worked through the pool, `customersServed` 2083 against the ~280 closes it used to count.
  **The four consumers are pinned in the ASSEMBLED world** by
  `tests/LiveFloorWalk.reachability.test.ts` — a module unit test cannot tell "wired" from
  "wired to nothing", which is exactly how this went dark for so long. The #180 harness also
  permanently reports all four now (`[#363 walk consumers]`), so the next retune can see what
  the walk volume does to them.
  223 suites / **2896** tests, typecheck clean.
  Next: **#364** (the `No lot vehicle` crash) — or **BUILD #152** if the director places phase
  9's queue first.

- 2026-08-07 — **BUILT #151** (per-brand reputation — the first of phase 9's twelve). The
  `pickVehicleFor` matcher has carried a `reputationBonusFn` stub returning 0 since #145;
  `Reputation.repFor(brand)` is now the real thing, and the store's record selling a make is
  a live term in every walk-in's match.
  **The input is `staff:auto_resolved`, not `deal:closed`, and that was the load-bearing
  call.** Per-brand standing needs two facts about the same event — *which make* and *how the
  delivery went* — and only the live outcome truth (#180) carries both: it gained a `brand`
  field beside the `vehicleCategory` it already published, and it already carried `badReview`
  (the low-trust forced close). `deal:closed` has no satisfaction signal at all, so feeding
  off it would have meant re-deriving one at a second call site — the exact duplication
  `residualHeat` was consolidated to kill. A walk moves no brand: a customer who never owned
  the car says nothing about it.
  **Three rules, and the third one is a trap-remover.** Standing is keyed by the canonical
  brand id (#224, the same join key the match scores by), carried from sold deals only, and
  **mean-reverts overnight on the same night and by the same rule as the store-wide
  scalars**. Without the drift one rough early run would stain a make for the whole career,
  which is a trap rather than depth. An unseen make reads 0 — no record is neutral, not bad.
  **`repFor` stays the honest state and the weight lives at the boundary.** The composition
  root wires `reputationBonusFn: repFor(brand) × brandReputation.matchWeight`; how much a
  shopper *cares* is the matcher's business, so it is applied in `createWorld` rather than
  baked into the module's read. Read live, so a brand's record moves the very next customer.
  **The calibration finding is the part worth keeping.** Adding the term moved the #180 live
  band: same seed, 28.5% → 39.0% positive, 64.5% → 51.7% apathetic, 213 → 290 closes. I
  measured three weights before touching the band, and the shift is **the same direction and
  the same size at 0.05 and at 0.15**, while 0.001 reproduces the pre-#151 run *exactly* —
  the term either flips a near-tie or it does not, and flipping one re-routes the whole
  600-up seeded trajectory. So this is trajectory divergence from a new score term, **not a
  strength effect, and the harness cannot be used to pick the weight** (a C2-class pass owns
  that magnitude). The apathetic band is re-centred on the new measurement at its old width
  (0.58–0.72 → 0.45–0.59); `positiveMin` is deliberately left where #286 put it, because a
  floor that is still cleared is not evidence for a new floor. All of it is written into
  `data/market-calibration.json#live._doc` so the next reader inherits the reasoning.
  **The business-level pacing did NOT move**: `npm run balance -- pacing` reads 91 of 100
  seeds to T2 (was 90), bankruptcy 18% (was 19%), median survival the full 360 days, and T1
  still clearing in a median 1.0 month against the 2.0 target — the same open miss, no worse.
  **Anti-orphan, because this mechanic has no screen by design** (I6 — ambient depth). A
  number that moves in a module nobody reads is indistinguishable from one that never moves,
  so `tests/BrandReputation.reachability.test.ts` pins both ends in the *assembled* world,
  and `tests/Reputation.perBrand.test.ts` asserts no UI file reads the surface at all.
  Snapshot went v1 → v2 (module-owned; the `modules` key set is unchanged, so **no envelope
  bump and no migration** — a v1 blob restores as "no make has a record yet", which is what
  every pre-#151 save actually was).
  221 suites / **2875** tests, typecheck clean.
  Next: **BUILD #152** — unless the director places #363/#364 first (see Blockers).

- 2026-08-07 — **SLICED phase 9 (B2, F&I as plug-in #2) into twelve issues** — #365–#373 filed,
  #151–#153 absorbed in place. The design was closed the same day, so this session did nothing
  but turn the ruling into build order.
  **The tracer is the reserve, and it had to be, because the honest naming and the missing half
  of back gross are the same change.** #365 renames `credit-tiers.json`'s `apr` to `buyRate`
  (the field has always been the customer's rate wearing the lender's name), adds
  `markupCapPts`, computes the reserve off the existing amortization, and splits `backGross`
  into `productGross` + `reserveGross` on both `ClosedDealResult` and `deal:closed`. Everything
  else in the phase reads one of those two halves.
  **The slicing call worth recording: the three teeth are separate issues on purpose.** #367
  (contractual deal-kill — the lender won't buy an over-marked deal), #368 (CSI drag) and #365's
  free structural kill (a marked-up payment breaching `ptiCap`/`maxTerm`/`ltvCeiling` — I3, no
  new machinery) fail in three different ways and are calibrated against three different
  signals. Merging them would have produced one slice where a miscalibrated curve is
  indistinguishable from a mis-wired gate. The director was offered the merge and declined it.
  **#151–#153 were absorbed as filed, not re-filed.** The grill doc says "absorbed as filed",
  and re-filing them would have left three older duplicates that the chronological rule picks
  up first. Their bodies now carry the locked scope (I4/I5/I6), EARS criteria and corrected
  deps — and #151 shrank in the process: the original body floated a per-*segment* reputation
  surface beside the per-brand one, which I6 rules out entirely. Per-brand reputation is ambient
  depth feeding Reveal text; there is no brand-reputation screen, and a criterion now says so.
  **Two things the slice deliberately does not build**, both because a closed grill already said
  no: a per-product on/off control (Q10 — #369 carries a criterion asserting the surface does not
  exist) and a continuous markup slider (Q9 — three named positions, and #370's peak meter is
  what makes them legible). A future session proposing either is re-opening the grill.
  **Q8 lands inside B2 rather than in a later demand slice** (#372), which is the one place the
  phase reaches outside F&I: advertising campaigns gain person-archetype weights beside the
  vehicle-type weights they already carry. Read-without-move is half a mechanic — #371 tells you
  the crowd leans cash, #372 is how you answer.
  **Flagged, not decided: #363 and #364 have no phase.** Both are live defects out of phase 8 —
  walks never publishing `customer:resolved` (starving four systems) and two customers held on
  one unit throwing `No lot vehicle`. Phase 9's queue starts at #151, so the chronological rule
  will never reach them on its own. Recorded in Blockers with the recommendation that they go
  first; placing them is the director's call, not a slice's.
  Next: **BUILD #151** — the lowest-numbered open, deps-met issue in the phase.

- 2026-08-07 — **DECIDED phase 9's gate: the parked F&I grill is CLOSED** (`/decide`). It had sat
  paused since 2026-07-08, and it was paused for a good reason — it had surfaced the game-wide
  engagement problem, which had to be answered first. That answer (`engagement-spine.md`) landed
  and repositioned F&I from the spine's tracer to its **second plug-in**, so the tree could be
  resumed knowing what F&I is *for*: proving the Reveal grammar spans from a daily beat up to a
  monthly strategic verdict.
  **Four rulings, taken in the order the doc's own re-entry note prescribed** (start at the
  demand-mix→F&I-ceiling coupling, since it is both an open mechanic and the emergence hook).
  **Q7 — the finance mix is read AHEAD, on the wire.** It becomes a MarketIntel lane behind the
  same door model every other lane has (`src/game/MarketIntel/types.ts:43-57`), opened by the paid
  data subscription or by the F&I manager on the desk. The reasoning is the spine's: a posture set
  blind is a coin flip, and the whole grammar is "a bet you place, the Reveal resolves." It also
  gives the T3 hire a second reason to exist beyond attach rates. **Q8 — the player can BUY a
  different crowd, credit-wise, and it is built in B2.** Advertising campaigns gain
  person-archetype weights beside the vehicle-type weights they already carry (today only
  `suv 0.85 / sedan 0.55 / truck -0.2`, `data/tunables.json:117-133`) — a "we finance anyone" push
  pulls a lower-credit, must-finance crowd, a certified-preowned push pulls high-credit cash. This
  is the standing demand-influence requirement and the F&I ceiling seen from two ends; a ceiling
  you can read but not move is half a mechanic, so it does not get sorted into a later demand
  slice. **Q9 — the posture dial is three positions**, "More per deal" / "Balanced" / "More
  deals", persisted as a slot id exactly like `tradePolicy` (`data/tunables.json:774` is the shape
  to copy). Q5 had already killed slider-hunting; three stops let the Q4 peak meter read as "the
  peak is at Balanced this month," which is a legible bet, where a 0–100 number would read as
  something to optimize. **Q10 — no product-level control.** All six unlock at T3 and the manager
  owns the menu. A per-product switch is a second control surface with nothing in it: turning off
  `etch` is strictly worse unless CSI drag is priced per product, which is a fourth rule on a
  mechanic whose point is one dial.
  **Nine internal calls were made rather than asked**, and one of them is a correction to the
  grill doc itself: the posture is **slot state, not world state**, so there is no snapshot
  envelope bump and no migration to write — the doc's own parked note was wrong
  (`src/app/useLevers.ts:105`). The others: reserve lives inside `DealEngine` with `backGross`
  splitting into `productGross`/`reserveGross`; `credit-tiers.json`'s `apr` becomes `buyRate` with
  the customer's rate being `buyRate + markup` and **no lender flats**; structural deal-kill falls
  out of the `ptiCap`/`maxTerm`/`ltvCeiling` already in the tier table, so half of Q3's tension
  needs no new machinery; #152 is one per-product `loanSensitivity`; #153 rides the existing
  `resolveEffects` machinery; #151's per-brand reputation is ambient depth feeding Reveal text,
  not a dashboard; one deal-kill curve in `data/`; and every magnitude is owed to a #286-class
  calibration pass, not to this design.
  Recorded in `fni-mechanics-grill-state.md` (rewritten from "PARKED (resumable)" to "COMPLETE"),
  with the ruling summarised into `path-to-finished-product.md` §4 B2 and the gate row moved to
  `.claude/skills/decide/gates.md`'s Settled section.
  Next: **SLICE phase 9** — the design is closed, so the next unit files the issues.

- 2026-08-07 — **BUILT #286** (the C2 retune — **phase 8 COMPLETE**). #180 measured that the
  live engine closes 2.2% of worked ups against #94's 85% and named the price floor as the
  rejecting mechanism. #286 had to find out *why the floor was where it was*, and the answer
  was not the one #180 filed.
  **The diagnosis contradicted the hypothesis, and measuring beat theorising.** #180's write-up
  blamed the reservation model — a best-of-six lot yielding Value ≈ 0.4 against #94's perfect
  0.85, dragging willingness-to-pay under cost. I instrumented `closeAndPrice` on the live floor
  before touching a tunable, and the customers were fine: Value measured **0.599** (not 0.4),
  price sensitivity **0.41** (not the 0.6–0.85 the issue assumed), the reservation price sat
  **6.5% ABOVE our ask**, and the quadrant was accepting **58%** of worked ups. What was broken
  was the store: **`floor/ask` = 1.32**. Our cost basis was a third higher than our own asking
  price, so `closeable` was false 91% of the time and nothing downstream ever got a say.
  **Four terms produced that, and every one was a mis-model rather than a number wanting a
  nudge.** (1) Recon was a **flat dollar figure per condition** ($500/$1,200/$2,800) applied to
  a catalog spanning a $3.5k beater and a $40k luxury car — on the tier-1 lot a rough unit's
  recon ran to *half its value* while the anchor's condition discount takes only 12% off, so
  buying rough was never a decision, it was a trap. It is now
  `conditionTiers[*].reconPct` (0.04/0.09/0.16), one rule in `Inventory.reconEstimateFor`, read
  by all three acquisition lanes. (2) The **auction lane centred at book with a 1.20 ceiling** —
  you could pay 20% *over* book at a wholesale auction, while `inventory.wholesale.haircutPct`
  pays you out at book × 0.85 on the way out. Centring the buy side at 0.85 makes the two sides
  of one market symmetric. (3) The **retail markup (1.20–1.28) was thinner than the basis it
  had to cover**; +0.10. (4) A **modelling bug the retune exposed**: a wholesale comp was
  measured against the bare anchor, so the moment the lane moved below book *every purchase*
  recorded a negative comp and drifted the segment down — buying well would have quietly
  devalued the player's own inventory. Wholesale comps now reference `anchor ×
  motivatedSeller.meanMultiplier`, symmetric with retail's `anchor × markup`.
  **The result: `live` positive 2.2% → 28.5%**, apathetic 97.7% → 64.5%, negative-deal 0.2% →
  7.0%, 213 closes against 88. The early-game floor **held its shape** — a green operator still
  closes at a rate a competent one would recognise while almost none of those customers leave
  happy (0.5% positive against 28.5%) and `trust_collapse` is still its signature walk (106 vs
  11). Skill buys happy customers here, not volume, and that is still true after the retune.
  **The balance harness is the business-level proof:** it went from the standing "bankrupts
  before Tier 2" to **90 of 100 seeds reaching T2**, median survival the full 360 days.
  **Two things I did not tune away.** `no_fit` rose 51% → 71%, and it is real: the lot is
  measurably FULL (6.01 of 6 spaces) and still cannot match 7 of 10 walk-ins, because six cars
  is a thin draw against six SPACED axes plus an affordability gate. It rose because cars now
  *sell*, so composition churns. That is the pressure that makes lot spaces worth building —
  A2 R1's whole point. And the residual gap to `reference` is now the **Value meter, not
  price**: a six-space lot yields best-of-six, Value dominates `objectiveDeal`, and closing
  that is a stocking-capacity question for the tier ladder rather than another pricing knob.
  Both are written into `data/market-calibration.json`'s docs so the next reader inherits the
  reasoning, not just the numbers.
  **Harness correction, both bots: they now run the #362 release valve.** Without it the test
  measured a store that cannot restock — a unit nobody will buy holds one of six spaces
  forever, mean lot age climbed to 123 days and the close rate halved twice over (62% → 22%).
  That is the harness failing to make a decision every operator makes, exactly like the
  standing float top-up. `MAX_DAYS` rose 400 → 600 to keep the 600-worked-up sample, because
  the live floor works ~1.2 customers a day.
  219 suites / **2863** tests, typecheck clean, and driven on web (T2 fixture → Operations →
  Lot): live asks, carrying, aging and wholesale quotes all render, the RAV4's $11,922 quote
  being exactly 0.85 × its $14,026 book.
  Next: **phase 9 — B2 F&I plug-in #2**, which opens with a DECIDE (the parked grill).

- 2026-08-07 — **BUILT #181** (the early-game floor — the progression has a proven bottom).
  #180 proved the #94 calibration does not survive contact with the game for a **competent**
  operator. #181 asks the complementary question: is there anywhere to climb *from*? A career
  whose day-1 state performs like its end state has no progression in it, and every skill
  gate, promotion and hire in `StaffOrg` would be decoration. Now there is a test that says
  otherwise.
  **The instrument is #180's, with one variable changed.** Same `createWorld`, same master
  seed, same stocking bot, same six-space lot, same capital floor — only the operator differs.
  `tests/MarketEconomy.earlyGameFloor.test.ts` runs the green solo operator the career starts
  you as (0.35/0.40 raw composites) instead of 0.75/0.75, hires **no UCM**, never pays for a
  pre-buy inspection, and leaves the trade policy at its `data/` default. Those are the four
  things a green player has not bought yet. 200 worked ups over 110 days, deterministic, ~5s.
  **Pinning an off-diagonal profile needed a real derivation.** #180 could fill every skill to
  the same fraction, which lands on the diagonal (`E === T`). A green operator is deliberately
  *off* it — better at being trusted than at closing — so the fill is parameterized by how
  each skill leans (`fᵢ = α + β·leanᵢ`) and the two composites are solved as a 2×2 against the
  live catalog. Hardcoding the three fractions would have let a retuned
  `data/staff-skills.json` silently move the green profile; instead the realized profile is
  asserted and a catalog change fails loudly.
  **The finding is the SHAPE of the floor, not its height.** A green operator closes about as
  often as a competent one — 3.0% of worked ups against #180's 2.4% — but **every single one
  of those closes is a low-trust forced close**: 0.0% positive against `live`'s 2.2%, and
  `trust_collapse` goes from 17 walks to 115, becoming the dominant non-fit reason. Skill does
  not buy you volume in this economy; it buys you customers who are *happy*. That is a
  cleaner, more interesting floor than "green sells less", and it is what the bands now
  record.
  **Margins are distances, not a second set of bands.** `data/market-calibration.json`
  `earlyGame` states `marginBelowLive` / `marginBelowReference` as gaps from `live` and
  `reference`, and a schema refine enforces that the whole early-game band sits under
  `live.positiveMin − marginBelowLive`. When #286 raises `live`, the floor must move with it
  or the assertion fails. A floor that stops being below the ceiling is not a floor.
  **The recon-tail band is honestly labelled as a ceiling guard.** Acquisitions are gated by
  sales — a six-space lot only reopens when a unit leaves — so a green store turns **9 units
  in 110 days, and only 13 if ground out to 400**. Zero surprises fired against an expectation
  of ~0.45. Banding a rare event over that denominator would be banding luck, so the rate gets
  a documented ceiling and the load-bearing band is the **mean recon overrun** (realized ÷
  estimate, every unit contributes): measured 1.087× against the 1.061 the
  `data/recon-variance.json` bucket mix implies. Its min sits just under 1 on purpose — that
  is the assertion that buying blind is a cost, not a coin flip. Both tighten on their own
  once #286 makes the lot turn. Carrying burn came in at **$18.63/unit/day**.
  **Filed #364 in passing.** Two customers can be held on the *same* unit — a six-space lot
  makes it ordinary — and whoever is resolved first drives it away; resolving the second
  throws `No lot vehicle` straight out of `resolvePlayerDiscountDecision`. Reachable in the
  app, not a harness artifact. The test guards and tallies it rather than asserting around it;
  what the second customer should *see* is a design call about the prompt, not a calibration
  change. 219 suites / **2863** tests, typecheck clean.
  Next: **#286** — the retune that closes the #180 gap. It now has a floor to preserve as well
  as a ceiling to reach.

- 2026-08-06 — **BUILT #180** (live-engine calibration verification — phase 8 opens). The
  #94 test proves the sales-process balance *in a vacuum*: a perfect inventory match every
  time, static price stubs, no market, no trades, no morale. #180 asks the question it
  cannot — does that calibration survive contact with the actual game? It does not, and the
  test now says so precisely.
  **The instrument.** `tests/MarketEconomy.calibration.test.ts` drives the real
  `createWorld`: live MarketEconomy providers, the real lot bought off the real auction
  board, seeded weather, demand shaping, competitor drift, trades with negative equity,
  morale drifting under the salesperson's feet, carrying cost eating the cash that buys the
  next unit. 601 worked ups over 369 days, deterministic across runs, ~12s alone / ~39s under
  full-suite load.
  **Two things had to become observable first, because the live close threw them away.**
  `staff:auto_resolved` now carries `badReview` on a close (the low-trust forced close — the
  negative-but-deal band) and `heat` on a walk. Before this the only satisfaction signal on
  the bus came from `customer:resolved`, which re-derives it by re-running the process
  against a **stub vehicle nobody was shown**. Both new fields are read off the close that
  actually happened.
  **`residualHeat` got one home.** The walk-warmth formula was hand-copied between
  `CustomerPool` and the #94 harness with hardcoded 0.5/0.3/0.2 weights, and the live path
  needed a third copy. It is now `SalesProcess.residualHeat` with the weights in
  `data/sales-process.json` `heat`, schema-refused unless they sum to 1.
  **The finding: the live engine closes 2.2% of worked ups against #94's 85%.** And the
  rejecting mechanism is *not* the quadrant close — 415 of ~486 walks are below-floor
  `no_close`, against 37 patience-drain and 17 trust-collapse. Over that population customers
  land at **0.992 of our ask** while our cost sits at **1.237 of it**. Cause: #94 demos a
  perfect SPACED match (Value ≈ 0.85), a six-space tier-1 lot yields best-of-six (Value ≈
  0.4), and `reservationPrice` scales with Value — so willingness-to-pay falls under
  `vehicleCost + minGross` before the quadrant is consulted. Separately, **51% of all
  arrivals leave on `no_fit`**: half the floor walks because six cars couldn't match their
  want-vector.
  **What I did NOT do, deliberately.** The issue's AC authorizes retuning `data/` until the
  bands pass. I tried the most defensible single lever — centering auction buys below book
  (`meanMultiplier` 1.0 → 0.85, ceiling 1.2 → 1.0, since a dealer buys wholesale) — and it
  moved the close rate ~0.4pp. **Reverted**, because it is not the dominant term and leaving
  an unjustified balance edit in the tree is worse than none. The real retune is a whole-
  economy judgment about gross per deal and how scarce a tier-1 lot should feel, which is
  exactly **#286** (same phase, literally "calibration pass"). Full numbers + the knob list
  are filed as a comment there.
  **So the bands are two sets, not one.** `data/market-calibration.json` carries `reference`
  (the #94 design commitment) and `live` (measured). The test asserts `live` as a regression
  guard *and* asserts the gap to `reference` is still recorded — green and honest, rather
  than green by asserting today's brokenness is correct.
  **Filed #363 in passing:** a live-floor walk never publishes `customer:resolved` at all, so
  `FollowUpPool`, `Reputation`'s walk penalty, `RegulatoryMeter`'s walk pressure and
  `TierManager.customersServed` are starved in real play — ~587 walks a run reaching none of
  them. Not folded in here: publishing walks changes live balance and needs its own
  verification. 218 suites / **2851** tests, typecheck clean.
  Next: **#181** (early-game floor verification), which #180 unblocks — then #286.

- 2026-08-06 — **HANDED OVER: the #74 round-1 playtest script (phase 5, HITL).** The unit
  was preparing the script and giving it to the director. Preparing it turned out to be real
  work: the script was written before the 5c layout rebuild and before phases 6 and 7, and
  **every navigation path in it had gone stale.**
  **What had drifted.** Hiring is on **People → Hiring**, not Operations. The auction is
  entered from **Operations → Lot → Go to the Auction** — the Lot owns sourcing (locked IA
  §4). The demand readout, the weekly market report and the industry wire all moved off Home
  into **Growth**; Home keeps a Market *glance* whose whole job is to route there, so "read
  Home top-to-bottom" would have had the director staring at a two-line card. The wire's paid
  lanes are named "auction data feed" and "competitor price tracking" on screen, not
  `auction_data`/`competitor_tracking`. And the known-dark list still told them Finance and
  Growth were placeholder tabs — 5c built both. A stale script is worse than no script: it
  spends the one resource this gate is short of, which is the director's patience.
  **What it now measures that it couldn't before.** Day 0's hire reads the signing fee and
  the daily wage and then the payroll line (hiring costs money twice now); Day 2's buy happens
  against a six-space lot the seed already fills half of; Day 3's second hire is a capacity
  question *with a price on it*; Day 4 reads the wholesale quote without taking it and sweeps
  the roster for raise asks and rival offers; Day 5 takes the valve if the unit still hasn't
  sold, and reads the Growth console including Build Out and the gate board. Session B gained
  payroll-at-T2, a roster sweep, and "do you know what would get you to Tier 3".
  **Both halves were rewritten together.** `docs/planning/playtest-round-1.md` is the human
  doc; `data/playtest-script.json` is what the phone actually presents (#333) and is the one
  the director will read at 11pm on day 4. Editing only the doc would have shipped the drift.
  **Deliberately NOT fixed, because it is a round-1 question.** A raise ask and a rival's
  offer wait on a person's card and never interrupt — so a player who doesn't open People can
  lose someone to a rival and only learn it from Deal History. Whether that reads as tension
  or as a missed beat is exactly what the round is for; pre-emptively adding an interrupt
  would answer it for them. It is a script step and a probe instead.
  **Two stale claims corrected in passing:** §5 said nothing in the UI showed the finance mix
  — Finance now splits gross into Cash vs Financed and Deal History names the method per
  deal, so the gap narrowed to down payment / credit tier / the credit-blocked walk reason.
  And `data/nav-tabs.json`'s `_doc` still called three tabs placeholders.
  **Verified in the running app**, not just typechecked: reloaded the web target and reopened
  the guide — the Day 0 card renders all seven new steps, both probes and the new known-dark
  list, and the button reads **▤ 1/9 · 0/7**. 217 suites / **2841** tests, typecheck clean.
  Next: **phase 8, C2 calibration (#286 + #180/#181)** unless the director's round-1 notes
  land first, in which case triage those. The gate does not block the queue.

- 2026-08-06 — **BUILT #362** (wholesale this unit — the release valve). **Phases 6 and 7 are
  COMPLETE.** The only path that turned a unit back into cash was abandoning recon after a
  surprise, so with the lot cap live (#361) sitting at 35 of 35 holding three units nobody
  wants was a dead end with no move in it. Now there is one, and it costs you something.
  **One rule for the price: book value with a `data/` haircut.** Off **book**, never off the
  asking price — the ask is what you hope a retail customer pays, and a wholesale buyer is
  buying to resell. That is exactly why the valve realizes a loss rather than being a free
  undo. `getWholesaleQuote()` is the only place the rule lives; the room states it and never
  re-derives a price or subtracts its own cost basis.
  **Any owned unit, no second ceiling.** No gate on recon status and none on the #295
  frontline hold: both describe a car already sitting on your lot burning money, and the
  units you most want to dump are the ones you regret. This is also *not* the rejected
  "forced wholesale on overrun" — the player picks the unit and sees the number.
  **The quote is a pure read, which is what makes the confirmation possible.** This is the
  one action that realizes a loss on purpose, so it never fires off a single tap: the sheet
  says what the buyer pays, what you have in it, and *$2,598 loss* in red. A valve whose
  price you cannot read is not a decision.
  **Both wholesale-outs now leave by the same door, and that fixed a real defect.**
  `inventory:vehicle_wholesaled` is published by this valve *and* by the #162 recon abandon.
  It is deliberately not `inventory:vehicle_sold` — that event means a person bought this
  car, and MarketEconomy was recording the abandon-path dump as a **retail comp**, feeding a
  wholesale price into the segment's price index; InstalledBase was staging the wholesaler as
  a future owner. The abandon path keeps #162's price rule; only which event it is stopped
  being a lie.
  **HistoryLog records it with its own `inventory` kind and a plain badge** — *"Wholesaled the
  2022 Chevrolet Silverado 1500 — $14,724, a $2,598 loss."* Naming the car matters: this is
  what you look back at when the month closes short. It must never wear the reward badge a
  closed retail deal wears.
  **Driven on web at a T3 store, single clicks.** Wholesaled a Silverado for $14,724 against a
  $17,322 basis; cash moved $190,925 → **$205,649** exactly, the lot 8 of 12 → 7 of 12, and
  the entry landed in Deal History under a grey INVENTORY badge between two gold SALEs. Then
  stood the store at its cap (`built.lotSpaces` → 7 in the slot, restored after) and reloaded:
  *7 of 7 spaces taken · no spaces open*, *"No spaces open — sell a unit before you buy
  another"*, auction lane closed. **Keep It** changed nothing. **Wholesale It** took the unit
  and the same card flipped to *"The wholesale auction — where the next unit on this lot comes
  from"*; the lane read *Lot: 6 of 7 spaces* and was buyable again — #359, #361 and #362
  meeting with no extra wiring, because occupancy is read live. 217 suites / **2841** tests,
  typecheck clean.
  Next: **phase 8, C2 calibration** — but #74 (the round-1 playtest, HITL) sits ahead of it in
  the commit sequence and is pending, not blocked.

- 2026-08-06 — **BUILT #361** (the lot cap governs buying — *6 of 6 spaces taken · no spaces
  open*). Lot size has been CSV tier truth since the beginning and nothing enforced it, so
  "match your inventory to demand" had no squeeze in it. Now it does: a full lot at the wrong
  end of the demand mix is a problem you have to sell your way out of.
  **One number, and every owned car is in it — prep included.** `Inventory.getLotOccupancy()`
  is the only place the rule lives; the Lot room and the auction lane both state it and
  neither counts its own list. There is no off-lot state in the model and none was invented:
  recon is a cost, not a place, and the #295 frontline hold only governs whether walk-ins can
  be *shown* the car. A unit in prep is sitting on your lot costing you money either way, and
  prep-as-its-own-capacity is one of A2 R2's five recorded rejections.
  **Checked at the bid, so units already won count.** `buyFromAuction` throws; the UCM's
  auto-source **stops** instead, because a full lot is a normal morning and not a programming
  error. That is what makes "you cannot win six cars into four spaces" true for the desk as
  well as the player. A refusal changes nothing — no cash moves, the listing stays on the
  board — the same shape #359 gave a refused construction buy.
  **A trade always lands, and may put you at 7 of 6.** It is part of a sale already made;
  refusing it would unwind a closed deal. Buying then stays frozen until occupancy is back
  **under** the cap — 6 of 6 is still frozen, "under" not "no longer over". Self-correcting by
  construction: the deal that brings a trade in also takes a car out. No overflow lot, no
  forced dump, no new vehicle state.
  **Built spaces come from Facility and are read live**, through `getBuiltLotSpaces` — the
  same closure idiom as the bay seam, never a module reference. So a construction job that
  landed this morning reopens the lane with no further player action, which is #359 and #361
  meeting: you buy the space, then you buy the car. Omitting the dep leaves the lot uncapped,
  which is what keeps pre-#361 harnesses honest.
  **Four suites bulk-bought the board and now stop at the cap.** A tier-1 lot holds six cars
  and the #296 seed already parks three, so a green world can buy exactly three — the loops
  gained one `atCapacity` break each, not a bigger lot.
  **Driven on web at the T2 fixture, single clicks.** *5 of 12 spaces taken · 7 open* on the
  Lot room and *Lot: 5 of 12 spaces* in the lane; bought a $7,000 Cherokee and watched both
  tick to 6 while cash fell exactly $7,000. Then stood the store at its cap in the saved
  `facility` blob (lotSpaces → 6) and reloaded: **6 of 6 spaces taken · no spaces open**, the
  lane's count in red, the closed banner above the board, and the buy button reading **No
  Spaces Open** with $215,734 in the bank — deliberately not "Insufficient Funds", because it
  is not a money refusal. Closed day 31 with the lot full: the recap read *"Your lot was SUVs;
  the crowd wanted sedans"* with five sedan walk-aways, and the UCM auto-source bought nothing
  and threw nothing on the rollover. 216 suites / **2828** tests, typecheck clean.
  Next: **BUILD #362** (wholesale this unit — the aged-inventory release valve).

- 2026-08-06 — **DIRECTOR-REQUESTED, NOT A `/next` UNIT: People tab rebuilt as collapsible
  department panels.** No issue number and no phase moved — the director asked for it directly
  mid-session, between #360 and #361. **#361 is still the next unit.**
  **The tab is now organised the way the store is**: three regions (who works here, who you
  could hire, what your managers run), and inside the first two, **one collapsible panel per
  department** — Sales, Service, Body Shop, Store-Wide — each with the glyph and accent the
  Operations dock already gives it, its own desk count in the header (*3 of 2 desks filled*),
  an `N open` / `Full` badge, its own slot board and its own people. Before this, a service
  advisor and a salesperson were the same undifferentiated row in one flat column.
  **Department is read off `data/staff-roles.json`, never a second list.** `departmentOfRole()`
  in `src/app/config.ts` resolves it from the same catalog the promotion DAG and the capability
  gates are written against, so a promotion moves someone between panels for free. Roles the
  catalog leaves null (lot porter, GM) land in a named **Store-Wide** group rather than a
  nameless bucket.
  **`Collapsible` is a KIT primitive, not a per-surface `useState`** (`src/ui/kit/`,
  documented in `kit/CLAUDE.md`). Three rules it exists to hold: the header is the whole
  affordance (`title`/`summary`/`accessory`, so a *shut* panel still says what is in it and
  whether it needs attention); a shut body **unmounts**, because a hidden-but-mounted subtree
  keeps doing work nobody asked for; and `pinned` is the one narrow exception — content that
  shows open or shut.
  **People are folded too, and `pinned` is why that is safe.** A roster card shuts to name ·
  job · *Grade 3 · $340/day* and opens onto the composites, every skill axis and Promote /
  Let go. A raise or rival offer opens the card **and pins its prompt**, so folding someone
  away can never fold away a question waiting on an answer. Applicant cards shut to name ·
  wage · signing fee **with the Hire button on the shut card** — hiring is the action the pool
  exists for and must never be a second tap behind a fold.
  **Consequence for tests, stated because it will look like a regression otherwise:** the
  promote/fire buttons and the skill meters are now one tap behind a card header, so
  `PeopleTab.smoke` and `StaffPromotion.reachability` press `<card>-header` first — that IS
  the player's tap path. `people-slot-board` became `people-slot-board-<dept>`. The read
  models grew a required `department` field (`PeopleRosterMember`, `PeopleCandidate`,
  `PeopleRoleOption`, `PeopleSlotRow`), and `PeopleTab.tsx` was split into `peopleModel.ts` /
  `peopleCards.tsx` / `departments.ts` behind the same barrel.
  **Driven on web at the T2 fixture, single clicks.** Folded and unfolded the Sales panel;
  opened a person and got their meters with the pay line still pinned; selected *Service
  Advisor* and watched the applicant pool move into the **Service** hiring panel; hired Tessa
  Nakamura and the Service team panel flipped *1 open · 0 of 1* → **Full · 1 of 1** with her
  under it, in place, no route change. Console clean of anything from this surface. 216 suites
  / **2814** tests, typecheck clean.
  The Tier-2 fixture's *Used Car Manager 1 of 0* row is visible again under the Sales panel —
  that is the stale-fixture state already recorded in Blockers, displayed plainly on purpose.
  Not a defect; do not "fix" it.
  Next: **BUILD #361** (lot cap governs buying — "31 of 35" — trade always lands).

- 2026-08-06 — **BUILT #360** (the facility gate face — the dormant fifth face gets a
  producer). *Facility Build-Out · 23% built vs 50%*. The face has been declared in
  `data/tier-gate.json` since #232 and skipped defensively by the engine ever since,
  because nothing produced a number for it. A2 R1's whole reason for making buildings
  purchasable was to give it one.
  **One rule: built ÷ ceiling, per kind, averaged.** Not a combined total. A combined
  built÷ceiling would let the lot buy the entire score — 35 spaces against 6 service bays at
  T3 — while the store ran a one-bay shop; averaging the per-kind ratios makes every
  department's room count the same. Each ratio caps at 1, so a save standing over a ceiling
  reads as done rather than as extra credit.
  **A kind the tier has no ceiling for is EXCLUDED, not counted as unbuilt.** Body bays are 0
  below T3, and "0 of 0 built" would peg a fully built-out Tier-1 store at 67 for a building
  the tier forbids. The flip side is the teeth: **arriving at T3 drops the score**, because
  the body shop just became something you are allowed — and therefore expected — to build.
  That is the only reason the exclusion is worth a rule at all; under a combined total a
  zero ceiling cancels out of both sides and the choice would be invisible.
  **Stepped means read LIVE, never sampled.** No `levelSamples`, no rolling window, nothing
  in the snapshot: the face stands exactly where it stands until the player builds, then it
  steps. A monthly average would report a bar the store has already cleared as still short,
  and would make the same construction worth more early in the month than late. It is also
  why the strip renders it as the cash gauge **minus the trend arrow** — an arrow here would
  read "flat" every day the player did not build and mean nothing.
  **In-flight construction is worth zero to the score**, which is the same rule the ceiling
  measures the other way (committed = built + in flight). Confirmed on screen: buying a body
  bay left the face at 23% with *Building 1 bay — opens day 38* on the row above it.
  **Both "skip the stepped face" filters are deleted, in the verdict and in
  `getTierRequirements`.** They now filter only on "is a configured face", which is what
  keeps #250's `streak` control tunable out. The requirements filter had to move with the
  verdict: it exists so the Growth climb can never foreshadow a bar the gate does not grade,
  and after this it must equally not hide one it does. `GrowthTab.reachability`'s assertion
  flipped from `not.toContain('facility')` to `toContain`.
  **Renamed the label to "Facility Build-Out".** "Facility / Image" promised an image
  standard that goals-targets decision 4 re-homed onto the T4+ OEM stream; the stale name
  only survived because the face was invisible. Making it visible made it a plain-language
  defect, not a design question.
  **Driven on web at a T3 store holding T2's buildings** — the carry-over state #358 created.
  Lot 12 of 35, service 2 of 6, body 0 of 3 ⇒ **23% built vs 50%** on the Home strip
  (arithmetic: (12/35 + 2/6 + 0)/3), the same figure spelled out on the Growth board directly
  under the build surface that produced it, and "% on track" fell 100% → **41%** as the T3
  bars lit. **The live save is `slot:<id>`, not `snapshot:<id>`** — editing the latter changed
  nothing and cost a reload to find out. 216 suites / **2806** tests, typecheck clean.
  Next: **BUILD #361** (lot cap governs buying — "31 of 35" — trade always lands).

- 2026-08-06 — **BUILT #359** (construction — capacity is bought with cash and days).
  *Lot spaces · 8 of 12 built · $3,000 each · 2 days to build* → **Build 4 spaces —
  $12,000** → *Building 4 spaces — opens day 33*. Physical capacity stopped being a
  number you were handed and became a number you buy, which is what A2 R1 was for.
  **The construction DELAY is the mechanic, not a garnish.** Instant capacity collapses
  the decision to "do I have the cash"; a two-to-three-day build makes you buy capacity
  *ahead* of demand, which is the actual dealership decision. Stored as an absolute
  `completesOnDay` compared against the current day at the morning settle — the #295
  frontline-hold idiom exactly, so nothing decrements a counter that could drift out of
  step with the calendar across a save/load. Also answers the tier CSV's own open row 16
  ("Time to upgrade? construction time?").
  **A block is the size of one job, not a divisor.** `blockSize` is clamped down to the
  room left and priced for what it actually builds — 5 against a gap of 4 builds 4 for
  $12,000 — so the ceiling is always exactly reachable *without a second pricing rule*.
  The alternative (a full-price partial block, or a prorated "last block") is two rules
  where one will do.
  **Committed capacity is built PLUS in flight, and that is what the ceiling measures.**
  It is why the same space can never be paid for twice, and why the lot button flipped to
  "Built out to the tier limit" the instant the job was scheduled rather than three days
  later. In-flight units are worth nothing on the floor until they land — `getBuilt()`
  never counts them.
  **A refusal changes nothing at all.** `at-ceiling` and `cannot-afford` are checked
  before the debit, so no cash moves and no job is scheduled; the container commits and
  re-reads rather than guarding first, because the engine owns every rule the button could
  get wrong. The two refusals get **different sentences**: "Built out to the tier limit"
  is an achievement, "Not available at this tier" is a lock, and a body shop at T2 is the
  second one.
  **Prices are FLAT across the ladder** (`data/facility.json` gained a `construction`
  block; `facilityData.ts` is now the module's catalog, `loadFacilityData`). A service bay
  costs what a service bay costs — a per-tier price table would be a second number beside
  the ceiling and would make the same purchase mean two things depending on where the
  player stood. Numbers are placeholders pending C2 (#286).
  **First `facility:*` publisher, and only one event.** `facility:capacity_built` carries
  the kind's new TOTAL plus the delta, published from `clock:day_started` so finished
  capacity is standing *before* the day's department drain snapshots its bay count. No
  `construction_started` event — it would have had a publisher and no subscriber.
  **No envelope bump.** Jobs live inside the existing `facility` blob, which is the
  module's own `schemaVersion` 1 → 2 (`AnyFacilitySnapshot` is the union `restore` takes).
  A #358 v1 blob restores as "nothing being built" — the state every save already was in —
  so `data/fixtures/tier-2.json` needed no re-stamp and the v1 path stays exercised in
  real play.
  **The surface is in GROWTH, derived from the locked charter, not a new IA fork.** Growth
  is "work ON the business — everything that compounds"; buying buildings compounds and
  spends the same cash inventory wants. It sits directly above the gate board because the
  `facility` gate face (#360) is what will grade it.
  **Driven on web at T2, single clicks, no timeouts.** T2 fixture → a day closed (the
  autosave wrote the v2 blob with `jobs: []` through the real path) → stood the store below
  its ceiling in the saved blob → reloaded: *8 of 12 built* / **Build 4 spaces — $12,000**.
  Pressed it: cash $222,734 → **$210,734** (exactly $12,000, and Home's next-day delta read
  *-$12,000 vs yesterday*), the row held at *8 of 12 built* with *Building 4 spaces — opens
  day 33*, and the button flipped to "Built out to the tier limit". Ran days 31→33; on the
  morning of day 33 it read **12 of 12 built** with the pill gone, service bays untouched at
  *2 of 4*. 216 suites / **2793** tests, typecheck clean.
  Next: **BUILD #360** (facility score lights the dormant tier-gate `facility` face).

- 2026-08-06 — **BUILT #358** (the Facility module — built capacity, tier as the ceiling).
  Physical capacity stopped being a per-tier constant nobody owns: `src/game/Facility/` holds
  built lot spaces, service bays and body bays as persisted state, and the tier's number
  became the **ceiling** over each. That is A2 R1 — *desks come with the tier, buildings are
  bought* — made structural before #359 lets anyone spend money on it.
  **`baysByTier` left in the same commit that replaced it**, out of `data/tunables.json` *and*
  both zod schemas (`serviceDispatchData.ts`, `bodyShopDispatchConfig.ts`). Fifth placeholder
  deleted across 6+7 (`headcountCapByTier` #352, `weeklyPayrollStub` #353, `hiringCostByTier`
  #355, `payVsMarketBonus` #356), and the same bug each time: a number the player could never
  own. The dispatch engines now take `bays` — a count, the narrowest possible dep — replacing
  `facilityTier` + a config lookup. `min(bays, advisors)` is untouched.
  **The ceiling is derived from the live tier and never stored**, so a tier-up cannot leave a
  stale ceiling behind and there is nothing in it to migrate. Only what is BUILT persists.
  **Carry-over is the behavior change, and it is the ruling, not an oversight.** A fresh world
  seeds at its tier's ceilings, so nothing about today's play moves — but a store that
  tier-ups keeps the bays it had. That is exactly what makes the dormant `facility` gate face
  (#360) measurable as built ÷ ceiling; "tier grants everything" would peg it at 100 forever.
  The consequence surfaced immediately in two suites that fake a tier by forcing
  `tierManager` on a fresh T1 world: they now also have to say the store built out, which they
  do through `createDefaultFacilitySnapshot(tier)` — the same shape a tier-N save carries.
  **No `facility:*` event, and the module takes no bus.** Nothing in this slice *changes* a
  built number; construction (#359) is the first publisher. An event with no publisher is dead
  code, and this repo's rule is to delete those, not to pre-add them.
  **`data/facility.json` follows the slot table's precedent exactly** (#352): monotonic by
  schema (a file that decreases is refused — a tier never takes capacity away), all seven
  tiers stated per row so a missing key can never read as "no capacity" and silently shut a
  department, and an out-of-range tier clamped into the ladder. Where the CSV stops (service
  bays at T3, lot/body at T5) the last value repeats, flagged as C2 calibration, not design.
  **Envelope v20 → v21, and the migration reads the save's ACTUAL tier** out of the
  `tierManager` blob rather than defaulting to 1 — the #314 Body-Shop-gate idiom. A migrated
  Tier-3 store keeps running the bays it was already running; defaulting to 1 would have taken
  a franchise store's shop away on load. `data/fixtures/tier-2.json` re-stamped **in place**
  through the real migrate + restoreWorld + snapshotWorld path (not `gen:fixtures` — the
  harness bot never reaches T2), and it now carries `{lotSpaces:12, serviceBays:4, bodyBays:0}`,
  which is precisely what the retired constant gave it.
  **Driven on web at T2, single clicks, no timeouts.** The re-stamped fixture restored through
  the new `facility` key (Day 31, $222,734, Tier 2), Operations → Service rendered, and a full
  day opened, ran and closed on the Reveal recap — so the drain built against the Facility-fed
  bay count end to end. 216 suites / **2776** tests, typecheck clean.
  Next: **BUILD #359** (construction — buy capacity with cash + days, ceiling enforced, Growth
  build surface).

- 2026-08-06 — **BUILT #357** (rival offers — retention and poaching as one moment).
  *Northside Vyndai offered $610/day. On $340/day now. They leave on day 34 unless you match.*
  → **Match** / **Let them go**. That completes phase 6 (C1 staff-teeth).
  **It is the raise object with two more fields, and that was the ruling, not a shortcut.**
  No `staff:poached`, no second prompt component, no second list: `getRaiseRequests()` returns
  both kinds and the absence of `rivalName` is what makes one a plain raise. R2's closing
  paragraph asked for exactly one thing for the player to learn, and a `kind` field that could
  disagree with the fields describing it would have been the way to get two.
  **`Staff.paidWage` is the one new field, and the premium is why it had to exist.** A rival
  bids `wagePremium ×` what the grade asks for, so the agreed number sits *above* the grade's
  book wage and stopped being derivable from `paidGrade`. `paidGrade` keeps its own job — it
  records the grade the wage was agreed at, so `currentGrade > paidGrade` is still the whole
  raise trigger. Restore materializes a missing `paidWage` from `paidGrade`, so a pre-#357 save
  loads paying exactly what #353 charged; a promotion reprices by role and clears the premium.
  **Who gets courted is one rule: the chance scales with grade** (`dailyChanceAtTopGrade ×
  grade/5`). A minimum-grade floor was written and then deleted — it is a second rule the
  player could only ever infer from an absence, and it would make the top of the roster feel
  arbitrary instead of valuable.
  **Two suppressions, both the absence of a decision**: something is already on that person's
  prompt, and an offer that does not beat what they are already paid. The second is what stops
  a member you just matched at a premium being “poached” back down to book the next morning —
  no “recently poached” flag needed. The refusal **cooldown deliberately does not** suppress an
  offer: it exists so the member does not nag you, and a rival calling them is not their doing.
  **Ordering inside `clock:day_started` is the mechanic** — expire → offer → ask. Nobody is
  poached, or asks for a raise, on the morning they leave, and “one open ask per member” falls
  out of the ordering rather than out of a rule.
  **`staff:quit` now has two publishers and still one departure path.** StaffOrg publishes it
  for a declined or expired offer; StaffMorale still publishes the low-morale one; StaffOrg’s
  own subscriber removes them either way. Payload gained `name` (the feed records a person, not
  an id) and `toRival`; `morale` went optional, because a rival hiring someone says nothing
  about how they felt and a 0 there would read as a miserable employee. StaffMorale gained a
  `staff:quit` cleanup subscription — it used to clear its own entry inline, which was only
  correct while it was the sole publisher.
  **The loss is written where it can be read back: HistoryLog** gains a `staff` kind —
  *“Marcus Delgado left for Northside Kaivo.”* / *“Dana Whitfield quit.”* The floor buffer is
  wiped every morning, so without this a person walking out left no record at all.
  **Rivals are the live competitors**, injected as `deps.rivalNames: () => readonly string[]`
  and wired in `createWorld` to `competitorMarket.getCompetitors()`. A function, not a module
  reference — StaffOrg needs one string per rival and must not grow a dependency on whoever
  holds them. Empty list ⇒ no offer ever fires, which is what every suite that hires people
  for other reasons runs under (`flatPay`/`noPay` carry a zero chance; `POACHING` turns it on).
  **The reachability test walks the real calendar rather than crafting an offer**, which is the
  only thing that exercises the `rivalNames` seam end to end: hire, advance days on a real
  `createWorld` world answering any plain raise as it arrives (an unanswered prompt is exactly
  what suppresses the rival), and the offer that lands names a store from that world’s own
  competitor list.
  **Driven on web at T2, through the save.** An offer written into the slot’s staffOrg blob
  restored and rendered on Fatima Fairbanks’ card — *“Northside Vyndai offered $610/day. On
  $340/day now.”* / *“They leave on day 34 unless you match.”* **Match** moved her line to
  *Grade 3 · $610/day* and daily payroll $1,280 → **$1,550**; reloaded and pressed **Let them
  go** instead, and the roster went 3 of 3 → **2 of 3**, Salesperson 2 of 2 → 1 of 2, payroll
  → **$940**. 215 suites / **2762** tests, typecheck clean.
  Next: **BUILD #358** (phase 7 — `src/game/Facility/` owns built spaces + bays, one bay truth).


- 2026-08-06 — **BUILT #356** (raise demands, and `payVsMarketBonus` made real). Growth stops
  being a drift and becomes a moment: *Asking for $340/day. On $150/day now.* → **Pay it** /
  **Refuse**.
  **`payVsMarketBonus` left in the same commit that replaced it** — the fourth placeholder
  deleted in this phase (`headcountCapByTier` #352, `weeklyPayrollStub` #353,
  `hiringCostByTier` #355), and the most dishonest of them: it added a flat bonus to everyone
  every payroll night, so it *compared nothing* while wearing a comparison's name. It is now
  paid wage vs the grade's asking wage, split into `paidAtMarketBonus` /
  `paidBelowMarketPenalty` — and the **signs are schema**, because a positive penalty would
  mean underpaying cheers people up and would read as balance, not as a dropped minus sign.
  **The comparison is read off `getPayBoard()`, not re-derived in StaffMorale.** That is why
  `StaffPay` gained `askingWage`: exactly two mechanics read "what someone this good asks
  for" — the raise trigger and the nightly morale adjustment — and a second derivation of it
  could disagree with the number on the card.
  **The trigger is still `currentGrade > paidGrade` and nothing else**, evaluated once on
  `clock:day_started` because the counters that grow a grade only accrue overnight; checking
  within an open day would re-ask the same question. **Three suppressions**, each the absence
  of a decision rather than a rule to learn: a demand already unanswered, a running cooldown,
  and — the one that matters for tests — an asked wage that does not beat the paid one. Wages
  rise *weakly* with grade by schema, so `flatPay`/`noPay` would otherwise have raised prompts
  whose two buttons cost the same across ~20 suites.
  **Refusal routes into the EXISTING quit machinery, and StaffOrg never touches morale.**
  Both answers publish `staff:raise_answered`; StaffMorale owns the consequence. That keeps
  the module boundary intact and means there is no second quit path to keep calibrated —
  proved by watching the same `staff:quit` the low-morale check has always published.
  **A promotion voids an outstanding demand but keeps the cooldown.** The two numbers on the
  prompt were the old role's; "they asked recently" is still true. They re-ask tomorrow at the
  new desk's numbers.
  **Persisted inside the staffOrg blob, no envelope bump** — both keys optional, so a pre-#356
  save restores as "nobody is asking" and re-derives the next morning. Losing the request
  would answer the player's open decision for them; losing the cooldown would make reloading
  the way to stop someone re-asking. Both directions are pinned.
  **Driven on web at T2, and the two halves showed up in the right order.** Loading a save
  with a grade-3 salesperson put on grade-1 money read *"Grade 3 · Paid at grade 1 ·
  $150/day"* with **no prompt** (correct — the ask is a morning event); overnight her morale
  alone fell 95 → **91** (the −4 underpay penalty, the other two untouched at 95); Day 32
  opened with the prompt on her card only. **Pay it** collapsed the line to *"Grade 3 ·
  $340/day"* and moved daily payroll $1,090 → **$1,280** in the same beat.
  215 suites / **2745** tests, typecheck clean.
  Next: **BUILD #357** (rival offers on the same event family — retention and poaching as one
  moment).
- 2026-08-06 — **BUILT #355** (the talent-scaled hire fee). What you pay to sign someone is now
  `hireFeeMultiple × their own daily wage`, so one number in `data/staff-pay.json` prices both
  signing them and keeping them.
  **`hiringCostByTier` left in the same commit that replaced it** — out of `data/tunables.json`,
  out of `StaffOrgConfigSchema`, out of the one call site. That is the third flat per-tier table
  deleted in this phase (`headcountCapByTier` #352, `weeklyPayrollStub` #353), and the same bug
  each time: a price that ignores the thing it is pricing. Under it a grade-5 closer and a
  greenpea both signed for exactly $1,000.
  **The fee is derived, not a second table, because a second table drifts.** `hireFeeMultiple`
  already lived in the pay book (#353 put it there for this slice); nothing new was added to
  `data/`. `CandidateListing.hiringCost` **keeps its name** — renaming it would have churned
  `staff:hired`'s payload, the balance harness's policy, and the People card for no gain — but it
  now means "what this **person** costs to sign", never "what this role costs".
  **A role the pay book does not name throws instead of falling back.** The old code ended
  `?? 1000`, so an unnamed role silently signed for a default; the fee now inherits the wage
  read's loud failure, which is the same grammar the slot table uses.
  **The compiler drove the test sweep, and it exposed two assertions that the change would have
  quietly hollowed out.** `noPay()` (the helper for suites that hire people to exercise something
  else) makes the fee **$0**, which turned "throws when cash is insufficient" and "deducts hiring
  cost from Economy cash" into tautologies — both now run on a real wage table. Economy's
  "payroll pushes cash negative" test opened the store with one day's float; it now opens with the
  two signing fees plus that float, and states the fee's size as it does so.
  **The grade-5-vs-grade-1 criterion is asserted on a forced grade, not a hoped-for pool.** The
  same seeded person is read through bands that put everyone at the top of the ladder and bands
  that put everyone at the bottom — same `staff.id`, grade 5 vs grade 1, strictly different fee.
  Fishing two grades out of the archetype board would have made the test a fact about one seed.
  **Driven on web at T2/Day 32**: three applicants for the *same* Service Advisor desk quoted
  **$1,300** (Grade 3 · $260/day), **$700** (Grade 1 · $140/day) and $700 — under the retired
  table all three read $1,000. Hiring the $700 candidate moved cash $184,305 → $183,605, exactly
  the number on the card. 215 suites / **2725** tests, typecheck clean.
  Next: **BUILD #356** (raise demands + `payVsMarketBonus` made real).

- 2026-08-05 — **BUILT #353** (the wage book + the nightly payroll drain). Payroll finally
  scales with the roster: every person burns a daily wage set by grade (1–5) × role, and that
  is the entire pay model.
  **`weeklyPayrollStub` left in the same commit that replaced it** — out of `data/tunables.json`,
  out of `EconomyConfigSchema`, out of the call site — so the old flat $800/week cannot be read
  and typecheck. Economy's `clock:overnight_payroll` subscription posts **rent only** now;
  StaffOrg owns the salary book because it owns the roster. ~20 test files carried
  `weeklyPayrollStub: 0` in an `EconomyConfig` literal; excess-property checking made that a
  mechanical, compiler-verified sweep rather than a search.
  **Two calls the design doc left open were resolved in code, and both are load-bearing.**
  Grade bands the **0–1 ratio**, not the raw `effectiveness` composite: that composite is a
  weighted *sum* whose range depends on how many axes a role grants (1.5 for a salesperson, 3.7
  for a UCM), so absolute edges against it would have made every manager a grade 5 and capped
  every salesperson at 3. The shipped edges put the ladder's own anchors where
  `staff-performance-ladder.md:27` says they belong — green 0.35 → grade 2, mature 0.75 → grade 4.
  And it reads the **grown** `effectiveSkills`, not the base roll: the base composite never
  changes, so banding it would have frozen every grade for the whole career and left #356's
  raise trigger with nothing to fire on. One formula serves both readings — `compositeRatio`
  now takes skill *values* and is exported from NPC, so `effectivenessRatio` keeps passing base
  skills and **every promotion/capability gate stays calibrated exactly where it was**.
  **`paidGrade` is the one new field on `Staff`, and it is stamped at `hire()`, never by the
  factories** — a candidate on the board is not on anyone's payroll, so `paidGrade` is what
  "employed here" means. The wage charged is `wage(role, paidGrade)`; growth never silently
  reprices anyone (the rejected "wage auto-follows grade"), which is precisely what leaves
  `grade > paidGrade` as the whole raise trigger with no new counters. A promotion keeps
  `paidGrade` and moves the wage by role — you took the desk, you get the desk's pay.
  **No save-envelope bump.** The field sits inside the staffOrg blob, so per the recipe it is
  that module's problem: `restore` materializes a missing `paidGrade` from the member's current
  grade, which is behavior-neutral — they load paid what they are currently worth, so the
  trigger starts quiet exactly as a fresh hire does. The tier-2 fixture needed no re-stamp.
  **`forceDebit`, not `postExpense`** — payroll you cannot afford is meant to push cash negative
  and wake `BankruptcyMonitor`, not throw and abort the overnight sequence (the same idiom rent
  and the marketing drains use). An empty roster posts **nothing**, not a $0 entry.
  **Two data-shape rules are schema, not convention:** the wage table refuses a file where a
  higher grade costs less (a transposed digit would read as balance instead of a typo), and the
  grade bands must strictly increase or a grade is unreachable. A role the pay book does not
  name throws, the same grammar the slot table uses — a free employee is the bug being deleted.
  **The Browser pane was not compositing frames**, so the click-through drive was impossible
  (no screenshot ⇒ no coordinate clicks, and the T2 dev button carries no a11y ref). The
  evidence is `tests/Payroll.reachability.test.ts` instead: a real `createWorld` charging the
  *shipped* pay book, and the drain landing as its own "Payroll" bar through the real
  `groupExpenses` rather than folding into "Other". That runs in CI; a web drive does not.
  215 suites / **2711** tests, typecheck clean.
  Next: **BUILD #354** (People surface: grade + wage per card, total daily payroll, the skill-bar
  `flexDirection` fix).

- 2026-08-05 — **BUILT #352** (per-role slot table). Scarcity is per **job**, not per body:
  `data/staff-slots.json` is role → count per tier, and it is now the only headcount ceiling
  in the game.
  **`headcountCapByTier` left in the same commit that replaced it** — gone from
  `data/tunables.json`, gone from the zod schema, gone from both call sites — so nothing can
  read the old flat `{1:4, 2:8, 3:16}` and typecheck. `staffOrg.headcountCap` survives as a
  *derived* read (the sum of the tier's slots) because the criterion asked for it, but there is
  no second number that could disagree with the table.
  **Three things the CSV did not say, resolved in data rather than left to the implementer.**
  The table is **monotonic** and `StaffSlotTableSchema` refuses a file that decreases — the CSV's
  dropped `f&i-manager` row at T4/T5 is an omission, and the schema now makes re-reading it as a
  removal impossible. Every role states all seven tiers explicitly; a missing tier key would read
  as "no slots", which locks the player out of a job and looks like balance instead of a broken
  file, so `slotTotalFor` **clamps** an out-of-range tier and `getSlots` **throws** for a role the
  table does not name. The promotion-only worker roles (`lot-porter`, `technician`) each mirror the
  role they promote into — the bench that feeds a desk is as wide as the desk it feeds — which puts
  `technician` at 0 at T1, where no service department exists.
  **Slots gate promotion, not just hiring, and that is where the worker roles are enforced at all.**
  `promote()` throws on a full target and `getPromotionOptions` filters them out, so no surface
  renders a press the engine would refuse. Since `src/app/config.ts` keeps worker roles off the
  hiring surface, their slot counts would otherwise have been inert data.
  **The People tab's "N of cap" line is now the slot board**, and an empty slot IS the hire
  affordance — pressing an open desk selects that job in the hiring pool. A candidate is blocked by
  the **selected job's** desks, not the store total: the regression the flat cap caused was that
  filling the sales floor shut off hiring for the whole store, service desk included.
  **A row earns its place two ways only** — the tier opened a desk you can hire into, or somebody
  is sitting in one. The first web drive showed "Lot Porter 0 of 2" and "Technician 0 of 1" at T2:
  permanently empty rows for jobs nothing can reach, which is exactly the foreshadow tile the locked
  IA bans. Both are gone.
  **Driven on web at T2/Day 31**: the board reads Salesperson 2 of 2 · Service Advisor 0 of 1 ·
  Used Car Manager **1 of 0**, the three salesperson applicants all say "No desk open for this job",
  and pressing the open Service Advisor desk swapped the pool to three service advisors offering
  "Hire — $1,000". The "1 of 0" is the stale T2 fixture (a UCM whose desk opens at T3, hireable back
  when the cap counted bodies) displayed honestly — the same grammar A2 R2 gives the lot cap.
  No save migration: slots are derived from tier + roster. 212 suites / **2671** tests, typecheck clean.
  Next: **BUILD #353** (wage book + daily payroll drain).

- 2026-08-04 — **SLICED phases 6 + 7 as one pass** → **#352–#362**, filed in build order, every
  issue carrying EARS acceptance criteria with named tests.
  **The order puts the slot table first and the wage stack immediately behind it**, because #352 is
  C1's scarcity cap (R3) and is the only hard dependency between the two phases; everything else in
  A2 (facility, lot cap) is orthogonal to wages, so it lands after staff-teeth is fully live rather
  than in front of it. Sequence: **#352** slots → **#353** wage book + daily drain → **#354** People
  surface → **#355** hire fee → **#356** raises → **#357** rival offers → **#358** Facility module →
  **#359** construction → **#360** facility gate face → **#361** lot cap → **#362** wholesale.
  **Two engine slices deliberately ship without UI, and two UI slices deliberately trail their
  engine.** #353 charges the wage before #354 displays it — a wage shown on a card and not charged
  is a lie on screen for a commit; the drain is honest the day it appears, reading in the ledger as
  "Payroll". #358 changes *no* behavior on purpose (built capacity is seeded to today's per-tier
  constants), so the risky part — moving bays from constant to owned state behind one provider — is
  verifiable on its own before #359 lets anyone spend money on it.
  **Three retirements are criteria, not cleanup.** `headcountCapByTier` (#352), `weeklyPayrollStub`
  (#353), `hiringCostByTier` (#355) and `baysByTier` (#358) each leave their JSON *and* their zod
  schema in the same slice that replaces them, so typecheck fails if anything still reads the old
  number. Two truths that can disagree is the bug this build order exists to avoid.
  **One placement call was made rather than escalated:** the facility build surface goes in
  **GROWTH**, derived from the locked charter's filing test — "work ON the business, everything that
  compounds across months" (`second-level-ia.md` §1). Facility expansion compounds and competes with
  inventory cash; it is not a room you walk into. The *occupancy* read ("31 of 35") lives where the
  stock does, on the Lot room and the auction surface. This is a charter application, not a new IA
  fork.
  **Two source gaps were resolved in the issues rather than left for the implementer to trip on:**
  the CSV's staff row stops repeating `f&i-manager` at T4/T5 (an omission — the table is monotonic,
  a tier never removes a desk), and it never names `lot-porter`/`technician` at all (they are
  promotion-only per `src/app/config.ts:249`, so their slots gate promotion, and a role the UI offers
  at a tier may never hold 0 slots — that is the A1 regression class inverted). Roles that do not
  exist yet (NCM, BDC manager) sit in the table unused; the fixed-ops-manager row is still an open
  gate at phase 15, and the slot table is data, so it changes without code.
  Every issue names its rejected alternatives with the director's reasons — draw-against-commission
  (#353), wage-auto-follows-grade and fixed-at-hire (#356), and R2's five (#361, chief among them the
  **overflow lot**, which the director raised and withdrew). No slice may reopen one.
  Next: **BUILD #352**.

- 2026-08-03 — **RULED A2** (phase 7, staff slots + facility scale) via `/decide A2`. Recorded in
  `path-to-finished-product.md` §3 A2, `[NEW]` → `[LOCKED]`. **Both staff gates are now closed;
  the next unit is a single SLICE covering phases 6 and 7.**
  **R1 — desks come with the tier, buildings are bought.** Tier-up hands you the CSV's staff
  desks outright (T3 = 3 sales + UCM + F&I + SA + BSA, empty and waiting); lot spaces and bays
  are purchased with cash + construction days up to the tier's ceiling, and you arrive at a new
  tier holding the previous tier's built capacity. The two ends were both rejected: granting
  everything leaves no money decision anywhere on the ladder *and* leaves the `facility` gate face
  in `data/tier-gate.json` with nothing to measure; buying everything puts a construction gate in
  front of hiring on top of C1's cost + wage and makes tier-up change nothing until you spend
  again. The split is what lights that dormant face — **built capacity ÷ tier ceiling × 100** —
  and what puts facility spend in direct competition with inventory cash.
  **Construction time is real** (~2–3 days, `data/`), reusing #295's frontline-hold idiom. Instant
  capacity collapses the decision to "do I have the cash"; a delay makes you buy *ahead* of demand.
  That also answers the CSV's own open row 16 ("construction time? Idk if necessary").
  **R2 — the lot cap governs buying; a trade always lands.** Every owned unit takes a space,
  **prep included** — there is no off-lot state in the model and none was invented (a `LotVehicle`
  exists and accrues carrying cost from `arrivalDay`; recon is a cost, not a place, and the
  frontline hold only governs whether walk-ins can be *shown* the car). One number, "31 of 35."
  The cap is checked **at the bid**, counting won-and-inbound units, so you cannot win six cars
  into four spaces. A trade always comes in and may put you at 36 of 35; being over freezes buying
  until you're under. Self-correcting by construction — a deal that brings a trade in takes a car
  out — which is exactly why it needs no machinery.
  **An overflow lot was raised by the director and withdrawn by the director**, and the reasoning
  is the durable part: an overflow slot beats a wholesale-at-a-loss in nearly every case, so the
  choice only ever resolves one way, and a dominated option is a confirmation dialog rather than a
  decision — *and* parking the unit keeps inventory the same, so the trade neither helped nor hurt.
  It would have bought a second inventory list, paused recon clocks, FIFO promotion, save fields
  and a UI surface for a moment that isn't a moment. Forced wholesale, refused trades, a soft cap
  with an overflow fee, and prep-as-its-own-capacity are recorded rejected alongside it. **Do not
  re-propose any of them.**
  **One thing fell out of R2 and ships with A2 on its own merits:** there is no voluntary
  wholesale-out today — the only dump path is abandoning recon after a surprise
  (`Inventory.ts:789`, #162). Lot-locked with three aged units and no way to convert them to cash
  is a dead end, so the inventory card gets a "wholesale this unit" action as the aged-inventory
  release valve, **not** as a full-lot penalty.
  Seven internal calls recorded in the section (chief among them: `headcountCapByTier` is deleted
  rather than kept beside the slot table; bays become owned persisted state read through one
  provider so `min(bays, advisors)` keeps a single truth; a new `src/game/Facility/` module owns
  built capacity + the facility score).
  Next: **SLICE phases 6 + 7 together.**

- 2026-08-02 — **BUILT #351** (Finance) — the last placeholder tab, and the books learned what
  day it is. **Phase 5c is complete.**
  **The tab is the locked IA's grammar, top to bottom.** `src/ui/FinanceTab/` +
  `FinanceTabContainer`: time-range chips → four headline stat cards with sparklines and
  vs-prior-period deltas → the hero gross-written trend → how deals were funded (donut) and
  where the money went (bars) → the deal-KPI block. Deal history and month-close results are
  siblings pushed **inside** the tab.
  **The range chips are the whole slice, and nothing in the engine could serve them.**
  `DealRecord` had no day, `deal:closed` carries none, and the Economy ledger was never
  persisted — so "Today" would have been a lifetime total relabelled. Three narrow engine
  surfaces make them honest: `kpiDashboard.getSnapshot(range?)` + `getDailyTotals(range)` over
  day-stamped deals; the Economy ledger persisted **whole and never pruned** (it IS the P&L, and
  a window that loses its early days reports a profit nobody made); and
  `tierGate.getMonthVerdicts()`. The daily series emits a row for **every** day in the window
  including days with no deals — a series that skips the quiet days draws a shape the business
  never had.
  **Only the month's GRADE is stored.** The verdict event fires once and `resetMonth` erases
  what produced it, so nothing else could reconstruct how a past month graded. Each month's
  *financials* are re-derived over its day window from the deal log and the ledger, so the
  results screen can never disagree with the dashboard about the same days.
  **Two live defects fell out, both fixed.** Economy's cursor latched only on `clock:day_ended`,
  which stamped every deal closed on day N with **day N-1** — invisible while the only consumer
  was a lifetime total, exactly one day wrong the moment Finance windows the ledger. And a
  private cursor reads **1 for the rest of any session resumed from a save**, because a restore
  fires no clock event; the web drive caught that one live (a day-31 deal landed on day 1).
  Both modules now take a **`getCurrentDay` provider off the clock** — the shape TierGate
  already used — so there is no cursor left to persist or mis-restore, and the clock's own
  `advanceDay` ordering puts overnight spend on the concluded day for free.
  **`KPIDashboard` stops being a screen.** It was a full route behind the in-game menu, which is
  why nobody read it; it is now an embedded kit-styled block with two consumers passing
  different snapshots (Finance the selected range's, the month-close interstitial the month's) —
  a KPI row reads identically in both because there is only one of it. `HistoryScreen` moved the
  same way, root route → tab route. **Both root routes are deleted and pushing them onto the
  root Navigator no longer typechecks** (`tests/Navigator.test.ts` carries the `@ts-expect-error`
  lock). The market-state panel (#179) rode along and is alive in a tab instead of a dead menu.
  **PVR carries no sparkline on purpose** — it is undefined on a zero-unit day, so a per-day
  series would draw zeroes on quiet days and read as a collapse in per-deal profitability that
  never happened. Deltas are **suppressed, not shown as "+100%"**, when the prior window is empty
  or zero. Every stat card renders an empty state rather than a zero that reads as a result.
  **Driven on web at T2/Day 31**: a closed deal shows under Today as 1 unit / $2,603 / PVR
  $2,603 with the funding donut at Cash 100%, the 30D chip re-reads as "Day 2–31 · 30 days",
  and both siblings push with the tab bar mounted and Back returning.
  **The donut paints a real `react-native-svg` path — #350's open question is answered.** The
  *measuring* charts could not be confirmed on screen: **a hidden Browser pane delivers no
  `ResizeObserver` callbacks**, so `onLayout` never fires and `useChartWidth` stays 0. Proven an
  environment artifact (a bare ResizeObserver probe also never fires) and written into
  `.claude/skills/verify` with the probe, so the next agent does not chase it as a bug.
  211 suites / **2644** tests, typecheck clean.
  Next: **DECIDE A2** (phase 7) — phase 5c is done, and C1's R3 made A2 a prerequisite for
  slicing phase 6.


- 2026-08-02 — **BUILT #350** (chart primitives) — the enabling kit slice #351 Finance
  depends on. `react-native-svg@15.12.1` (via `expo install`, SDK-54 matched) is now a
  dependency; `GaugeArc` predates it and stays a pure-`View` build.
  **The geometry is a separate pure module and that is the point.** `chartScale.ts` holds every
  number the three primitives draw — scales, the nice-tick ladder, bar bands, ring segments, and
  the SVG `d` strings themselves — with no React and no theme. A wrong chart is then an
  assertion on a path string instead of a screenshot: 22 of the 37 new tests never render
  anything. It also means an animated or canvas-backed rewrite reuses the same math behind the
  same props.
  **`theme.series` is a new token family, deliberately not a `colors` role.** The semantic roles
  carry meaning (`reward` is money, `danger` is a loss); a donut slice for "sedans" means
  nothing but "not the one beside me", and a red one would read as a problem. Slots assign in
  fixed order and **never cycle** — a seventh category folds into one muted "Other", it does not
  wrap back to slot 1 and impersonate the first. The six hues are not taste: candidate orderings
  were enumerated and run through a palette validator against the app's own card surface, and
  the shipped order is the best-scoring passing one (worst adjacent colorblind ΔE 22.7, normal
  vision 22.2, all six inside the dark lightness band, all ≥3:1 on both the card and the base).
  `series.ts` records those numbers so the next hue change re-runs the check instead of eyeballing.
  **Bars carry one hue by default.** The category axis already states identity, so coloring by
  category doubles the encoding and burns the palette on nothing; per-datum `tone` is the
  exception that earns its color — the one bar a surface is making a point about. A donut is the
  opposite case (a slice has no axis to name it), so it always ships its legend, with the label
  in ink roles and the swatch carrying the color.
  **`Sparkline` was rebuilt, not wrapped.** It was extracted to the kit as *bars* in #349; it is
  now a real trend line — area fill in the tone's translucent role, 2px stroke, the newest sample
  dotted so "where it ended" reads. Same props, same barrel export, no call-site edits: exactly
  the substitution the kit contract promises. Its two consumers (Home's gate strip, Growth's gate
  board) are untouched.
  **A chart must be told its width or measure it.** `useChartWidth` reads the container via
  `onLayout`; **tests get no layout pass, so a test must pass `width`** — written into the kit's
  `CLAUDE.md` because the failure mode is a chart that silently renders nothing.
  Empty states are per-primitive and mandatory (a blank plot is indistinguishable from a broken
  one), negative values are **dropped** from a composition rather than mirrored (folding one in
  would silently overstate every other slice), and a slice too thin to see still draws a
  minimum-width mark, because an invisible slice reads as a missing category.
  **Web drive is partial, and honestly so.** The bundle rebuilds with the new native dependency
  and the app boots, navigates and renders every tab with zero new console errors — that is the
  dependency-linkage risk retired. **No chart paints on screen yet**: `BarChart`/`DonutChart`
  have no consumer until #351 by the issue's own charter, and `Sparkline`'s live face only
  appears from Tier 3, since `data/tier-gate.json` grades `csi` at tier 3 only (confirmed on the
  T2 dev slot: `document.querySelectorAll('svg').length === 0`, and the gate board's "THIS MONTH"
  correctly lists units/gross/cash with CSI under "NEXT UP: TIER 3"). **#351's first job is to
  confirm react-native-svg actually paints under react-native-web.**
  207 suites / **2599** tests, typecheck clean.
  Next: **BUILD #351** (Finance).

- 2026-08-02 — **BUILT #349** (Growth) — the tab stops being a placeholder card, and two
  homeless surfaces get the room the locked IA assigned them.
  **The demand console is one room now.** `src/ui/GrowthTab/` + `GrowthTabContainer`: the heat
  read, who's been walking in, the targeting levers, the advertising campaign, then the weekly
  market report and the industry wire. Before this the readout lived on **Home** — whose charter
  is glances only — and the campaign lever had been evicted to the console in #346 while the
  console itself still rendered in the wrong tab.
  **The wire and the weekly report MOVED, not copied.** `IndustryWire`, `WeeklyMarketReportCard`
  and both their models are `git mv`'d out of `src/ui/HomeTab/` into `src/ui/GrowthTab/`; the
  HomeTab barrel now carries a pointer comment instead of the exports. Leaving them under
  `HomeTab/` would have been a lie in the tree for the next agent to trip on.
  **Home keeps a glance that routes, and the glance can't disagree with the room.**
  `buildMarketGlance` is a projection of the *console's own model* ("Buyers want SUVs most" /
  "Running Local radio · $75/day"), not a hand-written summary — so drift is impossible by
  construction. Both Home glances now deep-link: the market card and the gate strip each open
  Growth (IA rule 4).
  **The tier-gate board is the detail surface the gate never had.** `GateBoard` + the pure
  `buildGateBoard`: each face opened up with every number the engine already computes (pace
  line, cushion, still-to-go, per-day-needed, projected finish; threshold vs month-average vs
  right-now; rolling average + window), then **the climb** — what the next rung asks for and how
  many banked months stand in the way. Deliberately a **separate model from `gateStripModel`**:
  "compress to one line" and "show all of it" are different jobs. No "% on track" here — that
  compression is the glance's job. No bottleneck callout either (decision 2: facts, no coach).
  **Two engine surfaces grew, both narrow.** `tierGate.getTierRequirements(tier)` returns a
  tier's standing spec with **the same filter the month-end verdict uses**, so the board can
  never foreshadow a bar the gate doesn't grade (facility is data-present/engine-dormant and is
  excluded); `null` past the top of the ladder simply drops the climb section rather than
  rendering a tease. And **the advertising campaign now costs money** — `dailyCost` on the
  tunables schema, `getAdvertisingDailyCost()`, and a `clock:day_ended` `forceDebit`, the same
  standing-spend shape ServiceMarketing's arms and the wire subscription already use. A demand
  lever with no price is a strictly dominant choice; the spend is what makes the campaign
  section a decision at all. The price rides every chip, so campaigns compare without selecting.
  **`Sparkline` moved into the kit** — the CSI trend face renders in two surfaces now, and a
  second hand-rolled copy would let them drift. `GrowthTab` joins `MIGRATED_SURFACES` in the
  kit no-leak scan.
  **The web drive found two defects, both fixed before commit.** (1) The campaign chips showed
  no price at all — `advertisingOptions` carries a `dailyCost` *number* and the view wants a
  formatted `costLabel`; the composition root never bridged them. (2) The climb read **"for 2
  straight months"** directly above **"month 0 of 1"** — `ruleLabel` was quoting the NEXT tier's
  streak when the months-to-climb is how long it takes to leave where you *are*. Both are locked
  by tests.
  **Driven on web at T1** (Continue, the Playtest R1 slot — left exactly as found, campaign
  toggled back off): Home shows the two-line market glance with no readout/wire/report anywhere
  → the glance opens the Demand Console → the gate strip opens the same tab → `Local radio ·
  $75/day` selects in place and adds "Billed $75/day while it runs." → Home's glance updates to
  "Running Local radio · $75/day" → `Next up: Tier 2` lists 15 units / $30,000 gross / $150,000
  cash over "for one month to move up." 206 suites / **2558** tests, typecheck clean.
  Next: **BUILD #350** (chart kit).

- 2026-08-02 — **BUILT #348** (in-tab navigation stacks) — the structural half of phase 5c.
  Walking into a room no longer costs you the console.
  **The route map split in two, and the compiler enforces it.** `RootRouteParamMap` holds the
  whole-app flow states (boot, start menu, character creation, the game, the in-game
  menu/KPI/history overlays, the end card); `TabRouteParamMap` holds the six sub-screens that
  live inside a tab — `lot` · `auction` · `pricing` · `department` · `service` · `bodyShop`.
  **`nav.navigate('auction')` no longer typechecks.** That call is exactly what used to unmount
  the 5-tab shell, so the locked IA §3 rule is now a compile error rather than a convention
  someone has to remember; `tests/Navigator.test.ts` carries a `@ts-expect-error` lock on it.
  **`TabStacks` is the second machine in the Navigator module** — one stack per tab, pure and
  framework-free like the Navigator core, generic over the tab key so nav stays independent of
  the shell's taxonomy. It owns the **active tab as well as** each tab's position, which
  **retired the lifted `shellTab` `useState`** in `useDayLoop` whose own comment described the
  workaround the unmount pattern forced ("without lifting this the tab would reset to Home on
  return"). Pushes land on whichever tab is active, so there is **no route→tab table to drift**.
  Its `useSyncExternalStore` snapshot is a `version` counter, not the top entry — two different
  tabs sitting at their roots both read `current === undefined`.
  **AppShell grew exactly one prop.** With `stackScreen` present it renders that in the body and
  keeps the tab bar mounted and interactive; the tab bar is now one node shared by both body
  modes, so the two can't drift apart. `shellOwnsTopInset` in the composition root now also
  requires no stack screen — the hero bleeds behind the status bar, a pushed room does not.
  **Both IA carve-outs are untouched and now locked by tests:** the live floor is still a
  full-screen MODE with no tab bar, and the day recap / trade / discount spotlights are still
  the overlay channel above the Navigator (asserted rendering with the shell mounted behind).
  **`RouteContent` stays the root switch; `TabStackContent` is its sibling** for the in-tab
  routes — RouteContent lost ~200 lines and each file stays a readable screen switch.
  **The React Navigation trigger count is now 1 of 4** and recorded in the module's `CLAUDE.md`:
  a root stack plus five sibling tab stacks, two levels, deepest observed path 2 (Lot →
  pricing). Re-open the build-vs-adopt call if a third level appears.
  **Driven on web at T1** (the Playtest R1 slot, left untouched at Day 1): Operations → Lot room
  renders with all five tabs still lit and Operations still selected → `Go to the Auction` goes
  a second level deep with the shell intact → People shows its own roster at its own root →
  Operations returns to the **Auction Lane, exactly where it was left** → Back, Back lands on the
  dock. Open Floor still suspends the console entirely. 203 suites / **2527** tests, typecheck
  clean.
  Next: **BUILD #349** (Growth tab).

- 2026-08-02 — **BUILT #347** (People rebuild) — the org tab exists now, and the drive found
  two engine defects on the way that are fixed with it.
  **People is one surface with three sections.** `people-region-roster` · `people-region-hiring`
  · `people-region-managers`, all kit-styled off `useTheme()`. Before this the tab rendered
  *only* the delegation card — three ABSENT rows at Tier 1 — while the roster and the candidate
  pool sat two levels down behind Operations → Prep → Hire Staff, in the wrong tab entirely.
  **`PersonnelScreen` is gone, not restyled — and so is the `personnel` route.** The old flow
  pushed a full-screen route that unmounted the tab bar (IA §3 names that as the pattern to
  replace) and hid every candidate's skills behind a modal. Hiring now resolves **in place**:
  the handlers write through `StaffOrg` and `bump()` re-renders the same tab. Driven live —
  pressing Hire moved "1 of 4" to "2 of 4" and the candidate onto the roster with a morale
  meter, no navigation. Its container, its two test files, and its 600 lines of raw-`colors`
  StyleSheet went with it; `PeopleTabContainer` replaces it and the two reachability tests that
  drove the old container (#323 advisor hiring, #324 promotion) now drive the new one.
  **Candidates are comparable now, which is the point of the section.** All three render inline
  — traits, both composites, every skill — instead of one-at-a-time in a modal, because the
  A-vs-B read is the decision. (The flat $1,000 price against unequal quality is C1's ruling,
  not this slice's.)
  **Staff have names.** `data/person-names.json` + `NPC.rollPersonName`, and `name` is a
  non-enumerable **derived** getter on `StaffWithComposites` — `(masterSeed, staff.id)`
  determines it, exactly like #294's per-hire skill cap. That is why it cost no field on
  `Staff`, no change to the `.strict()` schema, and **no save migration**: `restore` hands
  `rehydrateStaff` the same `masterSeed`, so the people you saved are the people you load
  (locked by a round-trip test).
  **Two defects the web drive surfaced, both fixed at the engine.** (1) The UCM's card read
  **"Work quality 275%"** — `effectiveness` is a weighted *sum* over a role's skills, so its
  range is role-dependent (1.5 for a three-axis salesperson, 3.7 for a six-axis UCM) and two
  roles were never comparable. Added `effectivenessRatio`/`trustworthinessRatio` = composite ÷
  the ceiling that skill set implies. **The raw composites are untouched** — every promotion and
  capability gate reads those, and re-scaling them is a balance change C1/C2 own. (2) The pool
  offered **a person already on the roster**: a staff id is `staff:<archetype>:<day>:<slot>` and
  the pool is rebuilt from the seed on every reload (#190, deliberately not persisted), so it
  regenerated the id you hired — and hiring them again would have pushed a duplicate id,
  breaking every id-keyed binding (StaffMorale, StaffDispatch). `buildCandidatesForRole` now
  skips hired ids and walks the slot forward to keep the pool full.
  **Also landed:** skill *labels* are data — `data/staff-skills.json` carries a required
  `label`, so no surface can render `t_o_closing` as "t o closing" again; `staffOrg.headcountCap`
  is a public read so the tab shows "2 of 4" and stops offering a hire that would throw (A2/C1
  swap the CSV slot table in behind it); and `ProgressBar`/`Meter` gained `fillTestID` so a bar's
  **width** is assertable — the skill-bar defect carried in from C1 was `flex: ratio` inside a
  container that never set `flexDirection: 'row'`, and nothing could have caught it.
  **No Development section, deliberately** — IA rules 1 + 3, with a regression lock asserting its
  absence so no foreshadow tease creeps in before the training mechanic exists.
  **Driven on web at T1** (Continue → People): roster with names + proportional skill bars,
  three distinguishable candidates (32% / 41% / 72% work quality), hire resolving in place, and
  Operations showing Prep's two levers with no hiring entry anywhere. 201 suites / **2512**
  tests, typecheck clean.
  Next: **BUILD #348** (in-tab nav stacks).

- 2026-08-02 — **BUILT #346** (Operations rebuild) — the first and largest phase-5c slice.
  Six of the nine destinations the audit counted from Operations are gone or now open a real
  room; the tab is one visual language top to bottom.
  **The Lot became a room instead of a queue.** `src/ui/LotRoom/` + `LotRoomContainer`, a new
  `lot` Navigator route the dock's Lot tile opens (`handleDeptPress`), holding the whole stock
  pipeline the locked IA §4 gives it: the stock list with days-on-lot and carrying cost, the
  per-unit `Tune ›` entry into the pricing screen, the inline asking-price field, the standing
  pricing strategy, and sourcing. **The auction lives here now** — it was a button in Prep.
  Before this, tapping Lot opened `DepartmentScreen` on `departmentQueue.getQueue('lot')`:
  *"Nothing waiting in Lot"* while three cars sat on the lot one tab away.
  **Prep is now what the IA says it is: two levers, one block, zero navigation.** Hours and
  trade policy. `OwnershipLevers` went from 463 lines with its own `StyleSheet` off the raw
  `colors` map — **the last pre-kit surface anywhere in the app** — to a kit surface reading
  every value through `useTheme()`. Its own `"NEXT-DAY PREP"` heading is gone, which was the
  duplicate that rendered directly under the tab's `SectionHeader "Prep"`.
  **Where the evicted controls went, and why hiring did not wait for #347.** Stock list +
  price rows + pricing strategy + auction → the Lot room. Advertising → the demand console's
  "What You're Promoting" section (the readout of what that lever does), which Growth inherits
  whole in #349. Hiring → **People**, as a roster-count + `Hire Staff` entry. #347 owns the
  People rebuild, but the criterion "Prep contains no navigation links" makes hiring
  unreachable the moment Prep loses it, so the entry landed with the eviction rather than one
  slice later; #347 replaces it with the real roster + hiring pool.
  **Reuse over reinvention.** The three chip selectors (hours, trade policy, pricing strategy,
  advertising) all run on `DeptControls`' existing `ChipRow`, which grew one optional
  `disabled` prop so the floor-open lock survives the migration. No fourth chip implementation.
  **Two guards worth keeping.** The kit no-leak test now scans migrated *surfaces*, not just
  `src/ui/kit/` — hex/rgb literals and a raw `colors` import both fail it, with comments
  stripped first because this repo cites issues as `#346`, which is a valid 3-digit hex to that
  pattern. And `actionFooterClearance(theme)` derives the shell's bottom inset from the CTA it
  has to clear (label line box + padding), so a re-skin can't silently shrink the gap that
  audit P8 was about.
  **Driven on web at T1** (three units on the lot): dock → Lot room renders all three units
  with carry lines and editable prices → `Go to the Auction` opens Auction Lane → back returns
  to the Lot room; People → `Hire Staff` opens Personnel; Operations scrolled to the bottom
  shows Prep's two cards clear of the Open Floor CTA. 201 suites / **2496** tests, typecheck
  clean. One drive note: a click that "opened the floor" from the Lot room was a stale
  ref→coordinate mapping, not a bug — the capture-listener readback in `.claude/skills/verify`
  is what proved it.
  Next: **BUILD #347** (People rebuild).

- 2026-08-02 — **AUDITED the whole UI on the web target; filed phase 5c (#346–#351).**
  Director drove the #74 playtest request into a layout audit. Record:
  **`docs/audits/ui-layout-audit.md`** — every surface driven live at T1, every tappable target
  pressed, each control traced to its wiring.
  **The finding is an absence, not a disagreement.** `second-level-ia.md` locked the second-level
  IA on 2026-06-12 and it was never decomposed into issues past Home. Operations still runs the
  #215 shell tracer composition: five hardcoded department buttons routing to one generic
  empty-queue screen, **Lot among them** — an empty queue while three cars sit on the lot one tab
  away, when the locked IA gives Lot the entire stock pipeline (list + pricing + auction). Prep
  holds three navigation links the IA explicitly bans there, plus the advertising lever the IA
  assigns to Growth. `OwnershipLevers` is the **last pre-kit surface anywhere** — raw `colors`
  import + literal `StyleSheet` values — which is why the tab's top and bottom look like two
  different games. People renders only manager delegation (all three ABSENT at T1) while its
  chartered roster + hiring sit two levels down inside Operations. Finance and Growth are
  placeholder cards carrying *"coming in a later slice"* copy — the foreshadow-tease IA rule 3
  forbids. Pushed screens unmount the tab bar, which IA §3 names as the pattern to replace.
  **Also surfaced, outside the layout:** all three salesperson candidates cost exactly $1,000
  against 48%/70%/62% effectiveness (`tunables.json:252` keys cost to role class), so the first
  decision the game asks for has a strictly dominant answer — inside phase 6's C1 ruling already;
  and roster members have no names.
  **Sequencing:** #74 moved to `blocked on 5c`. The script is fine; the doors it walks the player
  through are not. Build order is #346 → #347 → #348 → #349 → #350 → #351.

- 2026-08-02 — **RULED C1 staff-teeth** (`/decide C1`) — the last designed-but-ungrilled core
  mechanic. Record: **`docs/planning/staff-teeth-design.md`**; §5 C1 flipped to
  `[LOCKED 2026-08-02]`; gate row moved to `gates.md`'s Settled section.
  **The measured "zero teeth" state was worse than the spine claimed, and all five facts are in
  the doc's table.** Payroll is a flat `$800/week` constant (`weeklyPayrollStub`, posted at
  `Economy.ts:67`) — the fifth hire costs **$0/week**. Hire cost is flat per role class
  (`StaffOrg.ts:175`); no salary field exists at all (`staff-roles.json` has none, and
  `StaffOrg/CLAUDE.md:57` claimed otherwise — stale). The candidate board is wiped and rerolled
  **every morning** (`StaffOrg.ts:145`), so disliking today's three costs one free day. And
  `payVsMarketBonus` fires **unconditionally** every payroll night (`StaffMorale.ts:93`) —
  a placeholder wearing a mechanic's name.
  **R1 — one daily wage, grade × role. Commission was rejected, and the standing recommendation
  going in was wrong on its own terms.** The director's objection is recorded because it is the
  reusable lesson: draw-against-commission is **four comp structures**, not one (sales/F&I on
  commission, techs flat-rate hours, advisors salary + service cut, managers salary + dept bonus)
  — four rules to explain one line item, against a hard standing bar of *playable, enjoyable,
  easy to understand*. And the case for it ("a flat drain never teaches you anything") is
  **backwards**: a fixed cost against variable revenue is exactly what makes a slow day hurt;
  commission partly self-insures a bad week. The simpler rule was also the sharper one.
  **R2 — raises are a moment you play.** They ask, you pay or refuse; refusing feeds the existing
  `StaffMorale` → `staff:quit` path. Chosen over auto-repricing and fixed-forever because it is a
  *decision*, which is precisely `poaching-cut.md`'s finding. **Retention and poaching are now one
  mechanic** — a rival offer is the same prompt with a name and a deadline, so spine §5's required
  poaching teeth cost no second thing to learn.
  **R3 — the CSV slot table is the scarcity cap.** No rarity roll, no persistent named labor
  market: you can't field five A-players because you don't have five slots (T1 = 1 salesperson),
  and the wage gates quality on top. **This makes phase 7 (A2) a prerequisite for phase 6's build**
  — `headcountCapByTier` is a flat `{1:4,2:8,3:16}` with no per-role breakdown, so nothing
  enforces the CSV today and the slot half would sit inert. Recorded in the doc §6, in the phase
  table, and as a note on A2's `gates.md` row.
  **Internal calls (8, all in doc §3), two of which do real work:** `grade` is a *derived* band of
  the existing `effectiveness` composite — not a second source of truth; and `paidGrade` (stored
  at hire) vs current grade **is** the whole raise trigger, falling straight out of the Model B
  growth already shipped in #294. No new state machine, no new counters.
  **A director-reported UI defect is folded into C1's scope, with a root cause.** Skill bars look
  identical for every employee: `SkillRow` (`PersonnelScreen.tsx:22`) sizes the fill with
  `flex: ratio` against a `flex: 1 - ratio` spacer, but `skillBarBg` (`:565`) never sets
  `flexDirection: 'row'` — RN defaults to **column**, so fill and spacer stack vertically in a
  6px-tall box and the bar carries zero information. The A-vs-B comparison this entire gate
  depends on is currently impossible to make on screen, so it is not a later polish pass.
  **Not a build — nothing under `src/` changed but one stale `StaffOrg/CLAUDE.md` line** (it
  claimed `staff-roles.json` holds salaries; it holds none). Suite run anyway to prove that:
  199 suites / **2469** tests green, unchanged counts from #342.
  Next /next is **`/decide A2`** (phase 7) per R3's sequencing finding, then SLICE 6+7.
  **Carried into phase 6's slice, unfixed by design:** the `PersonnelScreen` skill-bar defect
  above. It is a ~2-line fix (`flexDirection: 'row'` + `overflow: 'hidden'` on `skillBarBg`),
  independent of everything else, and blocks nothing — a decision unit does not get to start
  building the phase it just unblocked.
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

- 2026-07-29 — **NOT a /next unit.** User-reported defect, found by driving the app on the new
  web target (#338) — the first time the drive has caught something no test would have. The
  Home tab's demand console rendered each vehicle type as `Sedans / 1.00× / WARM`, a bare
  temperature word on a player-facing label, which `.claude/rules/ui.md` and the locked "no
  vague temperature labels" rule forbid outright. **Label copy only** — the internal heat-map
  model is untouched (`HeatBand`, `classifyHeatBand`, `classifyHeatBandFine`, the thresholds,
  the heat index, the `demand-heat-console` testID all unchanged). `HEAT_BANDS`
  (`src/ui/DemandReadout/DemandReadout.tsx`) now reads Very high / High / Steady / Low / Very
  low demand, which is the exact treatment `ServicePage`/`BodyShopPage` already carried since
  #308 — **this surface was simply never given the same pass**, so the rule was being honored
  in two of the three places it applies. Three other strings in the same section carried the
  same defect and went with it: the section header `Demand Heat` → **Demand by Vehicle Type**
  (mirrors Service's "Demand by Job"), the empty state's "see what's hot" → "see what buyers
  want", and the badge's a11y label, which with the new copy would have read "SUVs demand High
  demand" and is now `${label} ${band.label}` like ServicePage's. **The guard moved up a
  level**: the reachability test previously asserted only the testID, so the console could have
  rendered anything; it now builds a real world, bands the live spawn-driving heat vector, and
  asserts one plain-language demand label per segment **and that no temperature word renders at
  all** — the smoke test carries the same negative across all five bands. That negative is the
  part worth keeping: it fails on the next surface that reintroduces the word, which is how this
  one survived. Typecheck clean; 196 suites / 2402 tests green. Driven live to confirm (mobile
  viewport, dev T2 fixture): `DEMAND BY VEHICLE TYPE / SUVs 1.45× VERY HIGH DEMAND / Sedans
  0.89× STEADY DEMAND / Trucks 0.66× LOW DEMAND`, zero console errors.
  **Left open, deliberately:** `FloorDashboard.tsx:321` renders a `PENDING-WARM` stat tile —
  same defect, different surface, but "warm lead" is real auto-retail idiom so whether the rule
  bites is the user's call, not an agent's. Filed as a side task, not silently changed.
  **Also surfaced:** `npm test` matches **zero** files inside a git worktree — jest's
  `<rootDir>` resolves with mixed separators (`…dealership-alpha\.claude/worktrees/…`) and
  micromatch eats the backslash. Pre-existing and unrelated, but it means a worktree session
  gets a green-looking no-op unless it passes an explicit `--config`; worth a real fix before
  more AFK slices run in worktrees.
  Phase 5a is unchanged — next /next still BUILDs **#339** (the balance-harness optimizer, last
  of 5a) — or `/decide C1` any time to unblock phase 6.

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
  **Follow-on, filed same day as phase 5b:** the 81 allow-listed reach-ins are two unrelated
  jobs and were split so neither hides the other. **#341** is clerical — ~35 files import
  `parseData` from `game/data/loadJson` when it is *already on the data barrel*, so it is a
  one-line change per file with no design question. **#342** is not — ~40 files import
  `createRng`/`deriveSeed` from `game/NPC/Rng`, which is **not** on NPC's barrel, and the
  consumers span sixteen modules (Weather, MarketEconomy, Inventory, FloorSim, the whole
  Service/Body stack, the balance harness). Seeded RNG isn't an NPC concept; it lives there
  because NPC was the first module that needed determinism. So #342 has to say where RNG's
  public home is — re-export it from NPC's barrel (smallest diff, but asserts something
  untrue about NPC) or give it its own module beside `data/` (matches what it is, ~40 import
  lines). That fork is **internal** by `/decide`'s own triage — module ownership, not a
  player-facing mechanic — so the implementing agent rules on it rather than the director.
  When both land the allow-list is empty and can be deleted, leaving the hook enforcing the
  bare rule.
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

- 2026-07-28 — BUILT + closed **#333** (guided playtest script in-game) — phase 5 tooling,
  filed and built in-session after the user said the #332 overlay "is not nearly as guided
  as I had hoped": #332 recorded what the player *noticed* but never what the round **asked
  them to do**, which stayed in the doc + a browser companion page. A second screen is a
  handoff you have to remember to consult, and by day 3 nobody does — losing exactly the
  instructions the measurement depends on (*one salesperson, a second on day 3*; *cut one
  ask and raise another*). **DECISION (asked, user chose):** the 12-question observation
  sheet **stays a keyboard exercise** — probes are the in-the-moment half, and typing twelve
  paragraphs on a phone would add activation cost rather than remove it (same split as
  #332). **`data/playtest-script.json`** holds round 1 as data: both sessions flattened into
  ONE linear list of day nodes (brief + step checklist + probes tagged
  `day_open`/`day_close`); the markdown doc stays the human-readable source of truth.
  **The cursor IS the log** — `deriveGuideState` returns the first day node not marked done,
  derived purely from `step` entries, so there is no second cursor to persist and nothing to
  desync; it survives a Reset Save, session B's whole second career, and unscripted extra
  days. Ticking a step is *evidence*; the reserved `DAY_DONE_STEP_ID` marker is what
  advances. Two new **append-only** entry kinds (`step`, `answer`) with last-write-per-id
  winning, so a mis-tap is corrected by tapping again rather than mutating history.
  **`src/ui/PlaytestGuide/`** is the card (brief, tickable steps, one-tap probe chips + free
  text, known-dark list inline, `Day done →`); FAB reads `▤ 3/9 · 2/4`. **Presentation is
  bus-driven** — `clock:managerial_prep` + `floor:day_complete`, because a phase change
  doesn't reliably re-render the overlay channel — and a due boundary **queues behind** the
  recap, month close, chapter card, recovery beat, end card and both escalation modals
  rather than stacking on a beat the player is already reading; a day-close boundary with
  every probe answered is dropped instead of interrupting for an empty card. **Export** gains
  a `## Script trace` section rendering the FULL script with checkboxes — an *unticked* step
  is signal (the instruction couldn't be followed), so it must be visible rather than absent.
  Script §1 rewritten: the browser companion page is retired.
- 2026-07-27 — BUILT + closed **#332** (in-game playtest capture) — phase 5 tooling,
  filed and built in-session after the user asked whether the observation data was worth
  capturing in-app rather than in a separate artifact. **DECISION (asked, user chose
  "build it"):** split the capture by *when the observation happens* — in-the-moment
  reactions go in the game, the 12-question reflection sheet stays in the doc. Typing
  twelve paragraphs on a phone would *add* activation cost; tapping once when something
  annoys you removes it. New **`src/game/PlaytestLog/`** in the Telemetry mold (nothing in
  the sim reads it): a **manual flag** on an always-on-screen ⚑ FAB above the DEV button
  (context stamped at *tap* time, not save time — the useful moment is when the player
  reacted, not when they finished typing; note optional, four canned one-tap notes), plus
  **auto-capture** of `deal:closed` (full finance structure) and `staff:auto_resolved`
  `no_sale` (the *named* walk reason the on-screen line flattens away). Capture stays
  attached all session — the finance mix is a **rate** question, so a partial sample
  answers it wrongly; `deal:closed` carries no day so the day comes from an injected clock
  cursor (the HistoryLog/Records seam). **Export** is one markdown blob with the §5 deal
  table and the cash-vs-finance split + average down **computed**, not left to be
  eyeballed. **Persistence is its own `StorageDriver` cell** (`driverFactory('playtest-log')`
  in `services.ts`), deliberately outside the world save envelope: no version bump, no
  migration for a dev tool, and the log survives `Reset Save` so it spans a whole
  multi-day round rather than one career. Write-behind through one serialized chain; a
  failed write is **swallowed, never retried** (a rejected chain would silently stop all
  later appends — caught by a test, and each append rewrites the whole blob so a dropped
  write self-heals). AdminConsole gains a PLAYTEST LOG section (counts / Export / confirmed
  Clear). **Script §1 + §5 rewritten** — §5 no longer asks for any hand-transcription.
  **The two unobservable #74 criteria are still a real round-1 finding** (finance-mix
  surface + a distinct credit-blocked walk reason); this makes them answerable without
  pretending the gap is closed. Tests: 24 unit + 9 reachability/composition (incl.
  anti-orphan wiring guards on AppOverlays/AppRoot/AdminConsole); typecheck + full suite
  (2345, +33) green. /verify: BLOCKED for the live-GUI drive as usual — reachability +
  wiring guards are the reachable ceiling. **Phase 5 still blocked on the user playing
  it**, but the activation cost is now materially lower.
- 2026-07-22 — **PREPARED the #74 round-1 playtest** (phase 5's HITL unit): wrote and
  handed off `docs/planning/playtest-round-1.md`, and filed the round-1 notes home as a
  comment on #74. **Session A** = fresh T1 career, 5 scripted days — the capacity criterion
  is measured by *contrast* (one salesperson Days 1–2, a second before Day 3) rather than by
  vibe, Day 1 runs at 1× end-to-end to calibrate the felt day length before any skipping,
  Day 2 is the auction, Day 4 moves two prices. **Session B** = the Tier 2 dev fixture, 3
  days, one probe per day (manager delegation card / paid intel lanes / Service as a second
  business). Ends in a 12-question observation sheet and the explicit proceed / adjust /
  rethink call. **FINDING surfaced while writing it — two acceptance criteria are currently
  unobservable in play:** nothing in `src/ui/**` renders a deal's payment method, down
  payment, or credit tier (`deal:closed` carries all of it, `events.ts:411`), and the LTV
  block is a *pick-time filter* (`SalesProcess/affordability.ts:93`) so a credit-blocked
  buyer walks as `no_fit` — "wanted something you didn't have" — indistinguishable from an
  empty-shelf walk. The script routes around it via the DEV Event Log so the criteria can
  still be answered this round, but the gap is a real round-1 finding and likely becomes a
  follow-on issue (finance-mix surface + a distinct credit-blocked walk reason), not a
  calibration nudge. Also flagged in-script: DEV → Time Skip advances `GameClock` directly,
  not the day loop, so it is NOT a fast-forward for playing days; no T3 fixture exists
  (known C2 item); Finance/Growth tabs are known-dark. Triage protocol restated from #105
  (Class A broken → fixed before Class B flat is judged; miscalibrated number = data fix
  inside #74, logic defect = its own issue; all tuned values in ONE calibration commit).
  **Phase 5 now blocked on the user playing it** — see Blockers. Next /next either collects
  the results (Class A → Class B triage, then the calibration commit) or, if the user hasn't
  played yet, moves to phase 6 (C1 staff-teeth — DECIDE/GRILL, the ungrilled core mechanic).
- 2026-07-22 — BUILT + closed **#178** (B3 S3 — news progression gating). The
  wire now has an *access* half. New module **`src/game/MarketIntel/`** — "what
  the player is allowed to KNOW, and what that access costs" — in the
  ServiceMarketing mold (library/factory, no bus, composition root drives
  `advanceDay`). Three lanes, three currencies: **public** (lot talk, the trade
  magazine, factory recall/incentive bulletins — vague, late, or genuinely
  public) is free; **paid** (`auction_data` $45/day, `competitor_tracking`
  $30/day, both T2+) buys the numbers behind stories you already hear; **staffed**
  (a used car manager on the desk) opens the forward calls.
  **DECISION (asked, user chose):** #178's "Market Analyst hire" was adjudicated
  onto the **UCM**, not a net-new role — the channel-desk lock (UCM/NCM/GM, SM
  dropped) came *after* #178 was written and already owns intel, and §3's
  "advise = free on hire" makes the gate the *hire itself*, never a skill
  threshold (a green UCM reads the same wire a seasoned one does; skill buys
  precision elsewhere, #284). So the two axes are money and people, cleanly split.
  **Gating is a READ-SIDE lens:** the engine publishes every headline regardless,
  so the seed stream — and replay (#122) — is byte-identical whether or not
  anything is unlocked (asserted with two same-seed worlds, one fully subscribed).
  `data/news-progression-gating.json` holds unlocks + lanes + gating copy; lane
  matching is by **specificity** (exact source 2 > exact reliability 1, ties by
  declaration order), never array order, and the first lane is a free catch-all
  so a voice added without a lane **fails OPEN** — same philosophy as #177's
  source fallback. A test cross-checks every `(source, reliability)` the catalog
  can publish against its intended lane, so an unintended free lane is caught at
  review. **UI:** a locked headline keeps its place in the chronology — dimmed,
  padlocked, still naming who filed it and when, with the report replaced by
  "{source} filed a report you can't read yet." Seeing *that* somebody reported
  something without the number is the tease. The wire footer ("What you're not
  reading") lists every door with a withheld-count badge, the plain-language
  hint, and — for a subscription the player's tier already sells them — a
  Subscribe/Cancel button right there; a below-tier door shows the tier sentence
  and no button, a staff door shows the hire sentence (hiring stays on People,
  no second hiring surface). **The weekly column's forward calls ride the same
  door** — otherwise the column would be a free back way into the leading tier;
  its recap half was never gated. New `marketIntel` world key, envelope **19→20**
  + migration (behavior-neutral: subscribed to nothing, which is what a loaded
  career was already paying for); tier-2 dev fixture migrated in place (5 lines)
  via the real `migrateWorldSnapshot`. Two kit icons (`lock-closed`,
  `checkmark`); `bump` threaded to GameScreen for the toggle. Tests: 20 in
  `tests/MarketIntel.test.ts` (free lane, tier sweep 1–5, both currencies,
  fail-open, specificity, gateHeadlines, catalog cross-check, billing, snapshot
  round-trip incl. a discontinued product) + 15 in
  `tests/NewsGating.reachability.test.tsx` (live world withholds + leaks nothing,
  seed-identical either way, subscriptions open exactly their lane, daily billing
  measured against a twin unsubscribed world, the UCM hire opening the calls,
  weekly-column calls, save/load, composition guards, panel behavior) + a v19→20
  migration test. **All costs are first-pass → #286.** **Observation for #286:** in
  a bare bus-driven world the paid lanes barely fire — block reports need the
  player's own transactions and competitor tracking needs rivals repricing — so
  the felt value of `auction_data` scales with how much you're actually trading.
  /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only HITL path) — reachability + smoke +
  wiring-guard cited as the reachable ceiling. **PHASE 4 (B3) CLOSED** — #176,
  #177, #178 all landed (#179 closed in A4). Pointer advanced to phase 5 (C3
  playtest gate #74, round 1 — HITL). Next /next runs the **#74 playtest** unit:
  prepare and hand the user the playtest script; the artifact is the filed
  calibration notes/issue.
- 2026-07-21 — BUILT + closed **#177** (B3 S2 — news sources expansion + the
  weekly market report). The wire got three more voices and, next to it, a
  second *shape* of news: a column. **Voices** were mostly data, which was the
  point of #176's catalog design — 36 new templates across `trade_press`
  ("Dealer Trade Weekly", a fictional pub: mostly forward calls + lagging
  texture, plus the two macro shocks it voices), `oem_bulletin` ("Factory
  bulletin", direct only), and `competitor_watch` ("Competitor watch", the
  tracked-with-numbers sibling of vague lot talk). The one structural hook is
  `PublishInput.source`: a shock declares its announcing voice through the
  catalog's new **`shockSources`** map (a recall is the factory's news, a fuel
  story is the trade's), and a filter matching nothing **falls back to the full
  pool** so a copy gap can never swallow a headline about something that really
  happened. **DECISION — the OEM voice needed something real to talk about:**
  recalls existed as shocks but "model-year changes / incentive shifts" did not,
  so rather than narrate events the engine doesn't have, two real shocks were
  added to `data/market-shocks.json` (`oem_incentive_push`,
  `model_year_changeover`) with genuine negative used-value effects. Competitor
  headlines now quote a percentage derived from the **same lean→price mapping
  the pricing screen's comparables use** (`Δlean × 2 × competitorSpread`), and
  name the segment the rival leans hardest into (from `segmentAffinity`) — the
  shelf you actually compete with. **The weekly column** is a new
  `weeklyReport.ts` sub-system: publishes on `publishDayOfWeek` (0 = Monday)
  inside the module's ONE day tick, ordered **last** (`shocks → heat → news →
  weeklyReport`) because it sums up a week of wire. It is a *card, not a
  headline* — never spends the daily budget, never enters the ring buffer,
  stands until replaced. Aggregates three things already true in the engine:
  the week's per-segment heat move against a baseline **the column itself
  captured when the week opened** (so the number is the week, not the career),
  a tally of the week's wire by trust tier + per-segment mention counts
  (accumulated off `news:headline_published`), and up to `maxForwardCalls`
  forward calls. **Calls are deterministic from state and deliberately
  fallible:** a `shock` call reads `shocks.previewArrival` across
  `lookaheadDays` and fires only `callHitProb` of the time; a `drift` call is
  momentum extrapolation off the week's own move, and is **skipped when the
  shock call already named that segment** so the column never says one thing
  twice with two justifications. A career opening off-cadence gets a short
  first column covering the days actually played — never a fabricated seven.
  Copy (summaries keyed by week shape up/down/mixed/quiet, call lines keyed by
  basis × direction, headings, tally sentence) lives in the `weeklyReport` block
  of `data/news-templates.json`. **Persistence split decision:** the article
  (summary + call prose + moves + tally) is frozen into the save, but static
  chrome (title/subtitle/headings/tally sentence) is filled at *render* from the
  live catalog — a copy retune reaches the standing card instead of being frozen
  into old saves. `MarketEconomySnapshot` v2→**3**, world envelope **18→19** +
  migration; tier-2 dev fixture migrated in place via the real
  `migrateWorldSnapshot`. UI: new Home region "Market Report" between Market and
  Industry Wire, rendering `WeeklyMarketReportCard` — two halves with the wire's
  own two badges (recap = **Recap**, calls = **Rumor**), so the column teaches no
  second trust vocabulary and the calls can't be mistaken for the recap; a move
  that rounds to nothing reads "0%", not the wire's floored fake 1%.
  New event `market:weekly_report_published`; `useWorldState` subscribes
  explicitly (the day-tick bump would cover it incidentally — stated beats
  inherited). Tests: 27 in `tests/MarketEconomy.weeklyReport.test.ts` (cadence,
  re-baselining, week shapes, tally + clearing, all four call behaviors incl.
  the no-double-call rule, determinism same-seed/cross-seed, mid-week save/load)
  + 11 in `tests/WeeklyMarketReport.reachability.test.tsx` (live world × 30/60
  real day ticks, read model, save/load through the world seam, anti-orphan
  guards, card behavior) + 9 new `#177` cases in the news suite (voice coverage,
  shock→voice mapping over the WHOLE shock catalog, fallback, rival pct +
  segment). typecheck + full suite (2276) green. **All magnitudes are
  first-pass → #286.** /verify: BLOCKED for the live-GUI drive (native
  expo-sqlite + no react-native-web + on-device-only HITL path) — reachability +
  smoke + wiring-guard cited as the reachable ceiling. Phase 4 open set now
  **#178** only. Next /next BUILDs **#178** (news progression gating —
  CareerProgression hook).
- 2026-07-21 — BUILT + closed **#176** (B3 S1 — news engine + reliability tiers
  + the Home-screen Industry Wire). The market engine now *talks*. New
  `MarketNews` sub-system inside MarketEconomy (`src/game/MarketEconomy/news.ts`)
  publishing `news:headline_published` across the three reliability tiers that
  ARE the mechanic: **direct** (block report on the player's own comps, a shock
  landing/lifting, a rival visibly repricing), **leading** (the analyst desk's
  forward call — see below), **lagging** (confirming a heat move the player's
  own numbers already showed). `data/news-templates.json` ships 40 templates
  across 10 structural triggers + 3 sources (`auction_report` / `analyst_desk` /
  `lot_talk`), and owns ALL player-facing wire copy including the trust badges
  (**Confirmed / Rumor / Recap**) and their plain-language notes — so wording
  retunes in one data file and #177's three new voices are a data addition.
  **The leading tier is real, not decorative:** `shocks.previewArrival(day)` is
  a new PURE lookahead over the arrival/pick/param rolls (they're functions of
  `(masterSeed, day)`), so the desk genuinely reads tomorrow's dice. It is
  deliberately NOT gated on `maxConcurrent`/the dup guard — a previewed shock
  may never land, which is the honest shape for a rumor. `rumorHitProb` (0.5)
  decides whether a real setup gets called at all; `falseAlarmProbPerDay` (0.06)
  fires calls on days when nothing is coming. `step` and `previewArrival` share
  one `rollArrival` helper so they can't drift on the seed stream.
  **Three decisions inside the slice:** (1) **`market:segment_heat_updated` is a
  change event, not a heartbeat** — new `heatMonitor.ts` sub-system reports a
  segment only when it moves ≥ `heatMonitor.deltaThreshold` **since last
  reported** (not since yesterday), so sub-threshold daily wobble stays silent
  but slow persistent drift eventually reports once. Directly applies the #267
  lesson. First tick captures a silent baseline. (2) **Inventory comps reach the
  wire via `news.recordComp`, not a bus subscription** — the facade already
  computes each transaction's delta-vs-anchor for the comp window, and
  re-deriving it in the news engine would duplicate the anchor math and drag the
  anchor config in. The block report aggregates a day's comps and publishes on
  the NEXT day's tick (an auction recap is next-morning news). (3) **ONE
  `clock:day_started` subscription with an explicit internal order** —
  `shocks.step → heatMonitor.step → news.step` — instead of three independent
  subscriptions, so the sequence is a property of the module rather than of bus
  registration order. Also refactored `createSegmentHeatBySegment` out of
  `createSegmentHeat` (every heat term was always per-segment; the monitor now
  asks directly instead of fabricating a placeholder vehicle) and made
  `ShockModFn`'s vehicle arg optional. Volume control: `maxHeadlinesPerDay` (3)
  is a hard gate spent in arrival order, `maxHeadlines` (12) is the ring buffer.
  Persistence: `MarketEconomySnapshot` v1→**2** (adds `heat` + `news`; the news
  blob carries the ring buffer, the day budget, un-reported comps AND live shock
  tags so a shock spanning a save/load still resolves under its own name), world
  envelope **17→18** + migration; tier-2 dev fixture **migrated in place** (14
  lines, via the real `migrateWorldSnapshot`) per the known harness-bankrupts-
  pre-T2 constraint + the #322/#329 precedent. UI: `IndustryWire` panel in a new
  Home "Industry Wire" region below Market (the readout is what you can verify
  about your own lot; the wire is everyone else's word), each line badged with
  its trust tier + source + Today/Yesterday/Day-N stamp, legend tap-to-expand.
  Composition-root `buildIndustryWire(world)` in `src/app/config.ts`;
  `useWorldState` bumps on `news:headline_published` (headlines publish mid-day,
  not only on the day tick). Two new kit icons (`chevron-up`/`chevron-down`).
  Tests: 31 in `tests/MarketEconomy.news.test.ts` (catalog coverage, all three
  tiers, false-alarm rate respected at 0 and 1, lead-window bound, per-day cap +
  lazy day reset, ring buffer, determinism same-seed / divergence cross-seed,
  persistence incl. cross-save shock resolve, heat-monitor thresholds) + 9 in
  `tests/IndustryWire.reachability.test.tsx` (live world × 90 real day ticks
  producing real headlines with no unfilled slots, seed replay + divergence,
  read model through `buildIndustryWire`, save/load through the real world seam,
  anti-orphan guard on GameScreen + useWorldState source, panel behavior +
  empty state). typecheck + full suite green. **All magnitudes are first-pass →
  #286.** /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only HITL path) — reachability + smoke +
  wiring-guard cited as the reachable ceiling. Phase 4 open set now #177, #178.
  Next /next BUILDs **#177** (news sources expansion + weekly market report;
  dep #176 now closed).
- 2026-07-19 — BUILT + closed **#331** (day gross/units read from Records, not
  the unpersisted `useDayLoop` ref) — the #329/#330 trailing hygiene. The app
  layer now keeps **no day tally of its own**: `grossTodayRef` is deleted and
  `grossToday` is *derived at render* — `worldRef.current?.records.getDayTotals()
  .gross ?? 0` — with a `useReducer` tick bumped off `deal:closed` as the render
  trigger (`setGrossToday` dropped from the `DayLoop` interface too). The
  day-close handler reads the same accessor for the recap's `gross` and the
  `buildReveal` argument. **Two decisions inside the slice:**
  (1) **Records now clears its day accumulators on `clock:day_started`, not at
  `floor:day_complete`.** The accumulator belongs to the day the clock sits on,
  and the clock doesn't move at day-complete — it moves on Next Day. Without
  this, the day-close consumers would read 0 (Records subscribes first and used
  to reset immediately). Bonus: a reload in the MANAGERIAL window restores the
  closed day's figure instead of a zero.
  (2) **The HUD value is read at render, not inside the `deal:closed` handler.**
  `useDayLoop` subscribes at mount, *before* a World (and therefore Records)
  exists, and the bus dispatches in subscription order — an in-handler read
  would miss the very deal that triggered it. Reading at render is order-proof,
  and it makes the mid-day-reload criterion free (no re-seeding on the load
  path). **Ordering hazard noted for later:** the same mount-before-world order
  means `useDayLoop`'s `floor:day_complete` handler can run *ahead* of Records'
  in a session where the world is created after mount, which would empty
  `recordsRef` for #330's crowns; the gross read is immune (deals are all in by
  then) but the crown ordering guarantee is currently only proven at the bus
  level, not through the mounted app — worth a guard when B4 touches the day
  loop. Tests: new `tests/dayGross.reachability.test.ts` (live-world day totals
  across close → day-complete → next-day-open + composition guards that no
  `grossTodayRef`/`setGrossToday` survives), a mid-day save/reload world-seam
  test in `worldSnapshot.test.ts`, a Records reset-timing test, and the updated
  `buildReveal` composition regex. typecheck + full suite (2188, +4) green.
  **PHASE 3 (B1) CLOSED** — #328/#329/#330/#331 all landed; pointer advanced to
  phase 4 (B3 news/adverse-events engine, #176–#179). Next /next: phase 4's
  issues are already filed (#176–#178; #179 closed in A4) → BUILDs the lowest
  deps-met open.
- 2026-07-19 — BUILT + closed **#330** (B1 S3 — crowned record reactions on the
  Reveal feed). The B1 loop is closed: a broken high-water mark surfaces as a
  **crowned reaction on the SAME feed** as the day's wins and walk-offs (records
  are never a separate screen), ranked by the extensible axis #328 left open.
  `useDayLoop` accumulates `records:broken` into a per-bite `recordsRef` (reset
  each day alongside `closesRef`/`walkOffsRef`) and passes it to `buildReveal`;
  Records is wired in `createWorld` so it settles the day *inside*
  `floor:day_complete` ahead of the app handler — every crown is in the ref when
  the feed is assembled. `buildReveal` gains a third `DramaCandidate` kind
  (`record`) with per-mark plain-language copy naming the mark, its new value and
  the number it displaced ("Best per-car average yet — $2,100 a car, beating
  $1,850" — never "PVR"; Hermes-safe `$` grouping, no temperature words).
  `scoreDrama` gains the **`recordBroken`** axis: a flat weight (2.0, above the
  win/loss axes, so a crown reliably takes a star slot) + a **`recordMargin`**
  term (0.5 × relative improvement), so smashing a mark outranks squeaking past
  one. New **`reveal.drama.crownBudget`** (=2) caps crowns per bite — a great day
  can beat four marks at once and without the cap the feed goes all-crown and the
  day's actual drama gets pushed off; the highest-margin crowns win the slots.
  **DECIDED in-slice** (the call #329 deliberately handed to the presentation):
  **a first-ever mark does NOT crown** — a crown means you beat yourself, a
  career's first day sets four or five marks at once, and it spares the feed the
  "longest selling streak: 1 day" crown. The mark stands in the scoreboard from
  the moment it's set; only the celebration waits for a beat. `isCrownworthyRecord`
  is the gate, mirroring `isStarworthyWalkOff`. **Ordering note:**
  `bestMonthGross` settles on `clock:month_ended` during the Next Day transition,
  so it lands in the *following* day's ref and crowns on that day's Reveal — the
  month's result is news you get the morning after it closes (documented at the
  ref). Tests: 19 unit + a live-world reachability test (a real broken mark lands
  a `crown-*` reaction; a first-ever mark does not) + composition wiring guards.
  typecheck + full suite (2184, +21) green. **FILED #331** for the #329 loose end
  (day gross still accumulated in the unpersisted `grossTodayRef` instead of read
  from `Records.getDayTotals()` — the two can disagree on screen after a mid-day
  reload). B1's three sliced issues (#328/#329/#330) are all closed; #331 is the
  trailing hygiene, the same shape as A3 trailing A1. Next /next BUILDs **#331**,
  then advances the pointer to phase 4 (B3 news/adverse-events engine).
- 2026-07-19 — BUILT + closed **#329** (B1 S2 — Records store + detection).
  New `src/game/Records/` module: the career's six durable high-water marks +
  the `records:broken` announcement #330 crowns. A **scoreboard, not a rule** —
  nothing in the sim branches on a mark. Marks: `bestDayGross`,
  `mostUnitsInDay`, `bestPvr`, `bestStreak` (settle on `floor:day_complete`),
  `bestSingleDeal` (on `deal:closed`, **front gross only** — the desk's win on
  the car, not the F&I box behind it), `bestMonthGross` (on
  `clock:month_ended`, carries a running 1-based `monthIndex`). **Gross =
  `frontGross + backGross`, units = one per `deal:closed`** — TierGate's exact
  formula, so a crowned "best month" agrees with the number the gate graded.
  `clock:day_started` cursor stamps deals (`deal:closed` carries no day — same
  problem HistoryLog solves the same way). DECISIONS made in-slice: **a selling
  day = ≥1 unit** (streak tracks floor momentum; profitability is the separate
  `bestDayGross` axis, so neither mark shadows the other — selling at a loss
  keeps the run alive); **`pvrMinUnits: 3`** (new `records` tunable block —
  a one-unit day's PVR is just that deal's gross, already `bestSingleDeal`, so
  PVR crowns only at volume held at gross; without it two records fire together
  on every fat single-deal day); **a first-ever mark still fires, with
  `previousValue: null`** (engine reports the truth, #330 decides whether a
  first-ever mark earns a crown — that's the seam rather than pre-deciding the
  presentation); strictly-greater breaks, ties don't, non-positive never crowns.
  **Ordering is load-bearing for #330:** the Reveal feed is assembled inside a
  `floor:day_complete` handler, and Records is wired in `createWorld` so it
  subscribes FIRST — every mark for the just-closed day has fired before the
  feed is built; guarded by a bus-level test, not just a comment. Persisted:
  envelope v16→17 + migration materializing `createDefaultRecordsSnapshot()`;
  the blob carries the in-progress **day AND month** accumulators so a mid-day
  or mid-month reload keeps the haul. tier-2 dev fixture **migrated in place**
  (19 lines, via the real `migrateWorldSnapshot`) — not regenerated, per the
  known harness-bankrupts-pre-T2 constraint + the #322 precedent. Tests: 21 in
  `tests/Records.test.ts` (per-mark beat-not-tie, day/month reset, streak
  break/continue, loss-day keeps streak, PVR volume gate, ordering guard,
  save/load round-trip incl. mid-day + mid-month, migration default) + 2
  world-seam tests. typecheck + full suite (2163, +23) green. **LOOSE END
  (carry into #330):** Records is now the game-side source of truth for day
  gross/units — it exposes `getDayTotals()` — but `useDayLoop` still computes
  the day total in an unpersisted, non-replay-safe React ref (`grossTodayRef`,
  `useDayLoop.ts:283`). This slice was engine-only so the rewire wasn't done;
  it belongs in #330 or its own slice. Next /next BUILDs **#330** (crowned
  record reactions on the Reveal feed + wire `recordBroken` into #328's drama
  axis) — deps #328 + #329 both now closed.
- 2026-07-18 — BUILT + closed **#328** (B1 S1 — unified drama-ranking for the
  Reveal feed). Replaced the two-track `rankTopCloses`/`rankTopWalkOffs`
  selection in `src/ui/Reveal/buildReveal.ts` with ONE drama axis across wins +
  starworthy losses. New `scoreDrama(candidate, ctx)` = weighted sum of per-axis
  terms — **match strength** (`weights.matchStrength × clamp01(matchQuality)`),
  **gross surprise** (`weights.grossSurprise × clamp01((gross − dayMeanGross) /
  grossSurpriseScale)`; only the upside registers, a thin front scores 0), and
  **walk-off pain** (`weights.walkOffPain × painByReason[reason] ?? basePain`).
  `rankDrama(closes, walkOffs, limit)` pools wins + starworthy losses (non-
  starworthy filtered out BEFORE scoring via the preserved `isStarworthyWalkOff`
  gate — now exported + reused by the floor toast in `useDayLoop`, replacing the
  `rankTopWalkOffs([w],1).length` idiom), scores, sorts drama-desc with a stable
  arrival-order tiebreak, slices to the **single unified `drama.starBudget`**
  (=5, replacing #320's `starBudget` 3 + #321's `lossStarBudget` 2). A dramatic
  loss can outrank a mild win and vice-versa. New `DramaCandidate` union
  (`{kind:'win',sale}` | `{kind:'loss',walkOff}`); scorer left **extensible** —
  `recordBroken` (#330) + coupling axes drop in as one more `weights` entry + one
  term, no ranker rewrite. New `tunables.reveal.drama` block (starBudget /
  grossSurpriseScale / basePain / weights{matchStrength,grossSurprise,
  walkOffPain} / painByReason) + Zod schema; old `reveal.starBudget` +
  `reveal.lossStarBudget` removed. All magnitudes first-pass → #286. Pure UI
  change; renderer + event stream + `RevealReaction`/`RevealModel` shapes
  untouched. Tests rewritten in `tests/Reveal.buildReveal.test.ts`: scoreDrama
  axis behavior (strong>weak fit, fat>thin gross, thin front adds nothing,
  painful>milder reason, weights-from-tunables), rankDrama pooling (fat win >
  thin win, wanted-in-stock walk > mild win, strong win > milder loss, non-
  starworthy dropped, budget cap, stable ties, no mutation), isStarworthyWalkOff
  gate, and buildReveal interleave (loss can outrank win on the feed, budget
  cap). typecheck + full suite (2140, +8) green. **Design note surfaced (defer to
  #286):** a lone close has zero gross-surprise (mean==its gross), so a single
  win maxes at `matchStrength·matchQuality` (≤1.0) and a full-pain `no_fit` walk
  (1.2) outranks it — losses currently the harsher beat, consistent with the
  spine; tuned in the calibration pass. Next /next BUILDs the phase's lowest
  deps-met open — **#329** (Records store + detection; independent of #328).
- 2026-07-18 — SLICED phase 3 (B1 Reveal ranking + records) via /to-issues into 3
  AFK tracer slices. **#328** (unified drama-ranking — replace the two-track
  `rankTopCloses`/`rankTopWalkOffs` in `src/ui/Reveal/buildReveal.ts` with ONE drama
  score across wins+losses, top-N per bite; axes today = match strength / gross
  surprise / walk-off pain; scorer left extensible for `recordBroken` + coupling
  axes; new drama-weight tunables; no deps). **#329** (Records store + detection —
  new `src/game/Records/` module tracking 6 high-water marks: best day gross, best
  month gross, PVR record, best streak, **best single deal (front)**, **most units
  in a day**; emits new `records:broken`; rides worldSnapshot w/ version bump +
  migration; engine+persist+tests only, no UI; no deps). **#330** (crowned record
  reactions on the Reveal feed + wire `recordBroken` into #328's drama axis; deps
  #328+#329). DECIDE within the slice — user asked what else/what's overkill:
  ADDED best-single-deal + most-units-in-a-day (distinct felt axes, cheap); SKIPPED
  best-week (redundant between day/month, earns its crown when B4 lands the week
  bite), best-quarter/year (T7 altitude → B5), reputation/CSI marks (ambient, not a
  bet-reveal). #328 and #329 independent (either order); #330 last. Reveal tracer
  (#319–#322) confirmed all closed/shipped; renderer=`src/ui/Reveal/`,
  bet-capture=`src/game/PrepBet/`, no records concept exists yet. Next /next BUILDs
  the lowest deps-met open of the phase (#328 or #329).
- 2026-07-17 — BUILT + closed #327 (IndictmentMonitor producers — the last A4
  issue). Wired the two subscribed-but-never-fired severe-event producers so all
  three indictment pressure inputs now fire in live play. **`deal:fraud_flag`**
  (DealEngine): payment packing — a *financed* deal whose F&I retail burden
  `Σ attached.price` exceeds `packFraction × agreedPrice` (data/deal-fraud.json,
  `packFraction 0.35`, via new `loadDealFraudConfig`) is a structuring/disclosure
  violation; emit sits alongside the lemon-law block in `closeDeal`, gated
  financed-only (a cash sale can't pack a payment). **`regulatory:audit_failure`**
  (RegulatoryMeter): sustained pressure sitting in the audit band
  `[auditThreshold, pressureThreshold)` (`auditThreshold 60` in
  failure-tunables.json `regulatory`) fails a compliance audit at the overnight
  tick — the escalating warning *below* the AG complaint. **Latched** (new
  `auditFailed`, persisted optional in RegulatoryMeterState, defaulted on
  restore — no envelope bump): one crossing = one failure, resets when pressure
  falls below the band; pressure that jumps straight to/over `pressureThreshold`
  skips the audit so the two signals stay distinct. IndictmentMonitor unchanged
  (already consumed both). Tests: DealEngine fraud producer (fires on packed
  finance; not on pricier car / cash / no-F&I) + RegulatoryMeter audit producer
  (fires once entering band; not below threshold; not on straight jump to AG;
  re-fires after dropping out; latch round-trips through save) + a new
  **end-to-end integration test** wiring the real RegulatoryMeter + DealEngine +
  IndictmentMonitor on one bus with real configs: fraud (+25) + audit (+20) +
  lemon (+15) cross the real threshold (50) → Tier-1 terminal indictment fires.
  typecheck + full suite (2132, +10) green. Docs updated (CareerProgression /
  DealEngine / Reputation CLAUDE.md). PHASE 2 (A4) CLOSED — all six items landed
  (#267/#187/#179/#325/#326/#327); pointer advanced to phase 3 (B1 Reveal
  ranking + records). Next /next: phase 3 has no filed issues yet → likely
  SLICEs B1 from path-to-finished-product.md §B1.
- 2026-07-17 — BUILT + closed #326 (recovery-state surfacing — contraction/
  consent-decree read as setback, not game-over). The four survivable recovery
  events (`career:bankruptcy_contraction`, `career:indictment_contraction`,
  `regulatory:ag_complaint_contraction`, `regulatory:ag_complaint_consent_decree`)
  were UI-dark; now each fires a full-bleed `RecoveryBeatCard` (a "Setback" beat
  naming cause/cost/path, reward-amber accent + "Keep going" action — visibly
  distinct from the terminal `EndCard`), drained FIFO from a new `recoveryQueue`
  in `useDayLoop` (non-terminal channel, mirrors `chapterQueue`; cleared on
  `career:game_over` so terminal always preempts). Plus a persistent
  `RecoveryBanner` pinned in the `AppShell` (new optional `banner` prop, above
  the primary-action footer, visible across all tabs) that DERIVES from persisted
  monitor state: `buildRecoveryBanners(world)` reads `bankruptcyMonitor.
  outstandingDebt` (debt overhang, amortizes weekly to 0) + `regulatoryMeter.
  isSuspended/suspensionDaysRemaining` (license-suspension window). Banner
  self-clears when the state resolves and survives save/load (both monitors
  persist through the world seam). DESIGN CALL: indictment-contraction and
  consent-decree are one-shot in the engine (stake/cash penalty, no lingering
  window), so they surface as a beat only — surfacing what the engine persists,
  NOT inventing a decree countdown (would smuggle a game-logic mechanic; the two
  monitors that DO persist a window drive the banner). Pure UI model +
  cause/cost/path copy + banner builder in `src/ui/NarrativeBeat/recoveryBeat.ts`
  (view owns wording, Hermes-safe `$` grouping — no Intl). Reactivity:
  `useWorldState` bumps on `regulatory:suspension_lifted` + `career:
  debt_payment_made` (clear path); onset re-renders via the queue setState.
  Tests: pure-builder unit (all 4 beats + banner active/clear/both-order) +
  live-world reachability (drives a real Tier-2 bankruptcy contraction →
  contraction event fires, tier drops to 1, monitor debt persists, banner raised;
  + save/load round-trip; + composition-source wiring guard for all four events
  + banner={ + RecoveryBeatCard) + component smoke. typecheck + full suite (2122,
  +21) green. /verify: BLOCKED for the live-GUI drive (native expo-sqlite + no
  react-native-web + on-device-only) — reachability+smoke+wiring-guard cited as
  the reachable ceiling. A4 open set now #327 only. Next /next BUILDs #327
  (IndictmentMonitor producers — the last A4 issue).
- 2026-07-17 — BUILT + closed #325 (manager status card — surface delegated
  capabilities). New People tab (was `null`) hosts `ManagerStatusCard`
  (kit-styled, MarketStatePanel mold): three UCM channel-desk gates rendered
  advise-vs-act (Delegated / Advising / Manual badge + plain-language copy that
  NAMES the delegation + a skill-vs-gate Meter), and the two fixed-ops managers
  (Service, Body Shop) present/absent with their automated ladder rungs.
  Composition-root `buildManagerStatus(world)` in `src/app/config.ts` REUSES the
  live act-gate predicates (`isAutoPricingUnlocked` / `isTradeApprovalUnlocked`
  (condition_reading gates trade-approve + sourcing on one threshold) /
  `isDiscountDeskingUnlocked` / `isServiceFunctionAutomated` /
  `isBodyShopFunctionAutomated`) read off each manager's GROWN `effectiveSkills`
  vs `tunables.managerGates`, so the card never disagrees with what the desk
  actually does. Reactive: `useWorldState` now bumps on `staff:hired/fired/
  promoted` + `clock:day_started` (the M7 overnight skill step) — no polling.
  Override invariant (§5) stated in the card footer. Pure UI types in
  `src/ui/PeopleTab/managerStatus.ts`; no new events. Tests: live-world
  reachability (gate-crossing flips `delegated`) + app-composition wiring guard +
  component smoke. typecheck + full suite (2101, +6) green. /verify: BLOCKED for
  the live-GUI drive (native expo-sqlite + no react-native-web + on-device-only
  HITL path) — persisted `.claude/skills/verify/SKILL.md`; reachability+smoke+
  wiring-guard cited as the reachable ceiling. A4 open set now #326/#327. Next
  /next BUILDs the lowest deps-met open (#326 recovery-state surfacing).
- 2026-07-17 — BUILT + closed #267 (surface CompetitorMarket drift as a
  player-facing notification). HistoryLog now subscribes to
  `competitor:price_changed` and appends a discrete `market`-kind entry — "Rival
  <brand> raised/cut prices." — directional on the `pricing` stat semantics
  (up = rival more expensive / pressure eased; down = undercut / pressure rose).
  Deliberately did NOT log the daily `market:competitive_pressure` heartbeat: it
  republishes the full roster every day and would flood the 200-cap log; that
  continuous ambient state is the KPI/market-visibility surface (#179), not a
  discrete retrospective entry — documented in HistoryLog.ts + its CLAUDE.md.
  No new event types (pure surfacing). Reaches the built world via the shared
  bus (createWorld.ts:886); HistoryScreen already renders market-kind entries.
  Tests: directional-entry unit test + heartbeat-not-logged test. typecheck +
  full suite (2095) green. A4 open set now #325/#326/#327. Next /next BUILDs the
  lowest deps-met open (#325 manager status card).
- 2026-07-17 — BUILT + closed #179 (KPI dashboard — market-state visibility). New
  `MarketStatePanel` (kit-styled, DemandReadout mold) renders inside the KPI dashboard
  below the deal KPIs: per-segment **used-value pressure** map (personality+drift+shock
  factors, tap-to-expand breakdown), **active market shocks** (days-remaining derived
  from `expectedEndDay − currentDay + 1`), **inventory valuation** (book/market/unrealized
  gross/weekly carry), **stale inventory** (aged count/share/capital vs the 45-day
  threshold). Pure builders in `src/ui/KPIDashboard/marketState.ts`; composition-root
  `buildMarketState(world)` in `src/app/config.ts` assembles from `marketEconomy`
  (personality/compHistory.segmentDrift/shocks.activeInstances/valuationFor) +
  `inventory.getLotVehicles()`, keyed on `demandShaper.segments`. Display band edges are a
  new `marketEconomy.valueHeatBands` tunable (no magic numbers). Respected the
  no-vague-labels rule: axis named ("used values vs baseline"), plain signed-% labels
  (Above/At baseline/Below), never "hot/cold" as a word. Wired into RouteContent's KPI
  route; kept the prop optional so the month-close recap stays deal-KPI-focused. Tests:
  pure-builder unit test + a **composition-seam reachability test** (buildMarketState
  against a live world: heat cells, valuationFor on a really-bought LotVehicle, a
  scheduler-driven shock folding into the segment cell) + smoke tests (panel renders,
  tap-expand, optional-prop omission). typecheck + full suite (2090) green. A4 open set
  now #267/#325/#326/#327. NOTE for #267: customer-poaching was cut (poaching-cut.md), so
  #267 reduces to surfacing `competitor:price_changed` / `market:competitive_pressure`
  only. Next /next BUILDs the lowest deps-met open (#267).
- 2026-07-16 — DECIDE + BUILT: resolved #187 by **cutting customer-poaching**
  entirely (not deferred — removed). User challenged whether the concept was even
  worth keeping; traced it forward and confirmed it's redundant with walk outcomes +
  reputation→volume + CompetitorMarket's ambient pressure, and subsumed by BDC (T5)
  win-back. Deleted PoachEngine/poachData/poach-config.json/CustomerPool.Poach.test;
  stripped the poach deps + market:competitive_pressure consume + runPoachChecks from
  CustomerPool; removed poach wiring from createWorld; dropped customer:poached from
  events.ts + Telemetry; trimmed the poach test from Composition.competitor.test
  (CompetitorMarket wiring/determinism tests kept). CompetitorMarket stays as the
  ambient market force (market:competitive_pressure = daily rival heartbeat;
  competitor:price_changed still feeds MarketEconomy). Decision recorded in
  docs/planning/poaching-cut.md; #187 closed. typecheck green. A4 open set now
  #179/#267/#325/#326/#327. Next /next BUILDs the lowest deps-met open (#267 or #179;
  #179 blocked-by #157/#159/#173 — verify closed).
- 2026-07-16 — SLICED phase 2 (A4) via /to-issues: filed the three unfiled A4 items
  (the three filed ones #267/#187/#179 already existed). #325 (manager status card —
  surface delegated UCM per-skill gates + two fixed-ops managers; macro-spine §2 "delegation
  = permission"; design locked in manager-roles-channel-desk.md §3), #326 (recovery-state
  surfacing — the four contraction/consent-decree events are UI-dark today; render as
  narrative beat + persistent recovery banner, distinct from terminal end-card), #327
  (IndictmentMonitor producers — wire regulatory:audit_failure from RegulatoryMeter +
  deal:fraud_flag from DealEngine; both subscribed but unfired follow-ons per #271). All
  three AFK, independent (start in any order). A4 now fully issue-covered: open set =
  #179, #187, #267, #325, #326, #327. Next /next BUILDs the lowest deps-met open. #179 is
  blocked-by #157/#159/#173 (verify closed); #187 (poaching scale fix, no deps) is the
  likely lowest deps-met.
- 2026-07-16 — A3 HYGIENE done; PHASE 1 CLOSED, pointer advanced to phase 2 (A4). Closed
  #297 (Service+Body Shop PRD fully delivered incl. A1 residue), #269 (Body Shop v2-anchor
  superseded by the shipped #311–#318 build), #266 (fire is surfaced — PersonnelScreen
  onFire → staffOrg.fire, smoke-tested). Refreshed docs/spec-condensed.md (#209, commit
  ba79cb6): multi-slot save + start menu in scope, Body Shop off the not-yet-built list,
  module map updated. Next /next: phase 2 has open filed issues (#267/#187/#179) but also
  net-new surfacing work (manager status card, recovery states, indictment producers) with
  no issues yet → first phase-2 /next likely SLICEs A4, else BUILDs the lowest open of
  #179/#187/#267.
- 2026-07-16 — BUILT + closed #324 (promotion path). StaffOrg now exposes
  `getPromotionOptions(staffId)` + `promote(staffId, toRoleId)` — the first callers of
  `NPC.promoteStaff`. Gate-aware: legal role edge (`promotes_to`) × target `hireTier`
  unlock × source role's `promotion_gates` (composites or grown `effectiveSkills`).
  In-place roster replace preserves the staff id (morale/dispatch survive); emits new
  `staff:promoted` event. PersonnelScreen roster card shows an "↑ <role>" affordance per
  legal target (only when options non-empty). Engine tests + a container reachability
  test (lot-porter→salesperson through the UI). typecheck + full suite green.
  A1 COMPLETE (#323 + #324). Next /next runs A3 hygiene: close #269/#266/#297, then
  refresh #209 + spec-condensed — bookkeeping trailing A1. After that, advance pointer
  to phase 2 (A4 silent-system surfacing).
- 2026-07-16 — BUILT + closed #323 (21e9743). buildHiringRoleOptions now data-driven:
  excludes only worker-tier roles, so service-advisor (T2) + body-shop-advisor (T3) are
  hireable → Service/Body Shop capacity min(bays,advisors) flips positive. Functional
  reachability test drives the hire through the PersonnelScreen container. typecheck + 2080
  tests green. Next /next BUILDs #324 (promotion path — deps met now #323 is in). A3 hygiene
  (close #269/#266/#297, refresh #209 + spec-condensed) still trails, after #324.
- 2026-07-16 — SLICED phase 1 (A1) via /to-issues into #323 (advisor hiring tracer — the
  unblock; bays defaults confirmed sane so hiring one advisor flips capacity positive) and
  #324 (promotion path, blocked-by #323). Next /next BUILDs #323. A3 hygiene (close #269/#266/
  #297, refresh #209 + spec-condensed) trails A1 landing — bookkeeping, not sliced.
- 2026-07-16 — file created; /next skill installed. Phase 1 active. A1 has no dedicated
  open issue yet (it was residue of #297, which A3 closes) — first /next will SLICE phase 1.
