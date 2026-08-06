# Build state — read/written by the /next skill

**Source of build order:** `docs/planning/path-to-finished-product.md` §12 (one commit
sequence, nothing optional). This file is only the pointer + bookkeeping; scope always
comes from that doc and the filed issues.

**This file holds live state + the newest 3 log entries only.** Everything older rolls
verbatim into `docs/planning/build-state-archive.md`, which `/next` does NOT read at
session start — open it on demand when a past slice's rationale needs recovering.

## Current phase

**Phases 6 + 7 — staff teeth & staff slots / facility scale — SLICED 2026-08-04, now BUILD.**

Both gates are closed (C1 2026-08-02 `staff-teeth-design.md`, A2 2026-08-03
`path-to-finished-product.md` §3 A2) and the combined slice is filed as **#352–#362, in build
order**. **#352–#357 closed phase 6 (C1 staff-teeth) and #358 has landed — next unit: BUILD
#359**, construction. Work them in number order; the deps are stated in each issue's Notes.

| # | Slice | Phase |
|---|---|---|
| ~~#352~~ | ~~per-role slot table = the hiring cap; `headcountCapByTier` deleted~~ **BUILT 2026-08-05** | 7 → unblocks 6 |
| ~~#353~~ | ~~`data/staff-pay.json`, derived grade, `paidGrade`, daily payroll drain; `weeklyPayrollStub` deleted~~ **BUILT 2026-08-05** | 6 |
| ~~#354~~ | ~~People surface: grade + wage per card, total daily payroll~~ **BUILT 2026-08-05** (the skill-bar `flexDirection` defect was already dead — #347 deleted `PersonnelScreen`) | 6 |
| ~~#355~~ | ~~hire fee = multiple × daily wage; `hiringCostByTier` retired~~ **BUILT 2026-08-06** | 6 |
| ~~#356~~ | ~~raise demands (ask/answer) + `payVsMarketBonus` made real~~ **BUILT 2026-08-06** | 6 |
| ~~#357~~ | ~~rival offers on the same event family (retention + poaching, one moment)~~ **BUILT 2026-08-06 — phase 6 COMPLETE** | 6 |
| ~~#358~~ | ~~`src/game/Facility/` owns built spaces + bays, one bay truth; `baysByTier` retired~~ **BUILT 2026-08-06** | 7 |
| #359 | construction: buy capacity with cash + days, ceiling enforced, Growth build surface | 7 |
| #360 | facility score lights the dormant tier-gate `facility` face | 7 |
| #361 | lot cap governs buying ("31 of 35"), trade always lands | 7 |
| #362 | wholesale this unit — the aged-inventory release valve | 7 |

(Phase 4 B3 closed 2026-07-22 — #176, #177, #178; #179 landed earlier in A4.)

## Blockers

- **Phase 5c is DONE — the whole UI-layout rebuild landed 2026-08-02** (#346 Operations, #347
  People, #348 nav stacks, #349 Growth, #350 chart kit, #351 Finance). Every defect in
  `docs/audits/ui-layout-audit.md` is closed out: no placeholder tabs, no dead Operations
  destinations, and walking into a room no longer unmounts the console. **Do not re-grill the
  IA** — `docs/planning/second-level-ia.md` (locked 2026-06-12) stays authoritative; where
  shipped and locked disagree, locked wins.
- **Phase 5 (#74) is no longer blocked on the doors.** The script is still
  `docs/planning/playtest-round-1.md`, presented in-game (#332/#333); its §1 "no web path" line
  is stale as of #338. It sits behind the 6+7 slice in the commit sequence, not behind any
  defect.
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
- **The Facility module deliberately has no `bus` and emits nothing yet** (#358). Nothing in
  that slice changes a built number, so an event would have no publisher. #359's construction
  is the first `facility:*`.

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
| 5 | C3 playtest gate (#74), round 1 — HITL | — | pending (doors fixed; sequenced after the 6+7 slice) |
| 5c | UI layout rebuild — #346 Operations · #347 People · #348 nav stacks · #349 Growth · #350 chart kit · #351 Finance (all built 2026-08-02) | — (locked IA already ruled it) | done |
| 5a | Agent-harness hardening (#334→#340→#335→#336→#337→#338; #339 sliced into #343→#344→#345, all built; see `docs/agent-workflow-notes.md`) | — | done |
| 5b | Module-boundary debt clearance (#341, #342), surfaced by #335's scan | — | done |
| 6 | C1 staff-teeth | **LOCKED 2026-08-02 — `staff-teeth-design.md`** | done — #352–#357 all built |
| 7 | A2 staff slots / facility scale | **LOCKED 2026-08-03 — `path-to-finished-product.md` §3 A2** | active — #352 + #358 built; #359–#362 open |
| 8 | C2 calibration campaign (#286 + #180/#181) | — | pending |
| 9 | B2 F&I plug-in #2 (+#151–#153) | **RESUME parked grill** (fni-mechanics-grill-state.md) | pending |
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

