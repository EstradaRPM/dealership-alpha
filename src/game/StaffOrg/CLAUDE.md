# StaffOrg

Roster + hiring/firing + candidate listings. Source of truth for "who is on payroll".

## Public API (`index.ts`)
- `createStaffOrg()` → `StaffOrg`. Error type: `StaffOrgError`.
- `currentRoster` entries are `StaffWithComposites` — note the non-enumerable
  `name` getter (#347), derived from `(masterSeed, staff.id)` via
  `NPC.rollPersonName`. It never serializes and re-derives identically on
  `restore`, so a roster is people, not stat lines, with no save migration.
- `loadStaffOrgConfig` — reads `data/tunables.json#staffOrg`.
- `loadStaffPay`, `gradeFor`, `dailyWageFor`, `StaffPayTableSchema`, `MIN_GRADE`/`MAX_GRADE`
  — the salary book (#353), see "Pay" below.
- `computeConditionRead`, `deriveConditionReadSeed` — pure helpers behind
  `assessCondition` (also exported for fixture/test use).
- `getSkillGrowth(staffId)` (#377) — see "Skill growth" below.
- Types: `StaffOrg`, `StaffOrgDeps`, `StaffOrgConfig`, `CandidateListing`,
  `ConditionAssessInput`, `ConditionRead`, `ConditionReadConfig`, `StaffPay`,
  `StaffPayTable`, `RaiseRequest`, `StaffSkillGrowth`.

## Pay — the salary book (#353, C1 R1)
- **One rule: a daily wage set by grade (1–5) and role.** `data/staff-pay.json` is
  `dailyWageByRole` + the four `gradeBands` + `hireFeeMultiple`, loaded by `loadStaffPay`
  (`staffPay.ts`); `deps.pay` injects an alternative in tests. Draw-against-commission was
  considered and **rejected** at the gate (four comp structures to read one line item) —
  `docs/planning/staff-teeth-design.md` §2 R1. Do not re-propose it.
- **The drain is daily**, posted by StaffOrg on `clock:overnight_payroll` via
  `economy.forceDebit(total, 'Payroll')`. `forceDebit`, not `postExpense`: payroll you cannot
  afford pushes cash negative and wakes `BankruptcyMonitor` rather than throwing mid-overnight.
  Nothing is posted when the roster is empty. Reads in Finance as its own "Payroll" bar
  (`groupExpenses` keys on the label) — guarded by `tests/Payroll.reachability.test.ts`.
- **`weeklyPayrollStub` is deleted** from `data/tunables.json` *and* `economyData.ts`. It was a
  flat $800/week, so your fifth hire cost nothing. Economy's `clock:overnight_payroll`
  subscription now posts rent only.
- **Grade is derived, never stored** — `gradeFor(compositeRatio(effectiveSkills, …), bands)`.
  Two calls matter here: it bands the **0–1 ratio**, not the raw composite (whose range is
  role-dependent — 1.5 for a salesperson, 3.7 for a UCM — so absolute edges would make every
  manager a 5), and it reads the **grown** `effectiveSkills`, not the base roll, so grade
  climbs with tenure. The base-skill `effectivenessRatio` getter is untouched because every
  promotion/capability gate is calibrated against the raw base composite.
- **`paidGrade` is the only new field on `Staff`** (optional, serialized). Stamped at `hire()`,
  never by the factories — a candidate on the board is not on anyone's payroll. The wage is
  `wage(role, paidGrade)`, so growth never silently reprices anyone and `grade > paidGrade` is
  the entire raise trigger. A promotion keeps `paidGrade` and moves the wage by role.
  `restore()` materializes a missing `paidGrade` from the member's current grade, so a
  pre-#353 save loads paid what the person is currently worth (behavior-neutral) — inside the
  staffOrg blob, so no envelope bump.
- Reads: `dailyPayroll` (the sum), `getPayBoard()` (per member: `grade`, `paidGrade`,
  `dailyWage`). `CandidateListing` carries `grade` + `dailyWage` beside `hiringCost` — what
  they cost to sign and what they cost to keep are now the two numbers the hire is made on.
- **The hire fee is `hireFeeMultiple × that candidate's daily wage`** (#355), so both numbers
  on the card come from one place and a grade-5 can never sign for what a greenpea signs for.
  `staffOrg.hiringCostByTier` (the flat worker 500 / customer-facing 1000 / manager 2500 /
  gm 5000 table) is **deleted** from `data/tunables.json` *and* `staffOrgData.ts` — a second
  price table is exactly the thing that drifts from the wage book. `CandidateListing.hiringCost`
  keeps its name; it is now per **person**, not per role tier. A role the pay book does not
  name throws rather than falling back to a default fee.
- Magnitudes are **placeholders anchored to `docs/planning/staff-performance-ladder.md`**, not
  balance; calibration is C2 (#286). The salesperson row is the design doc's worked example
  (grade 3 = $340/day, grade 4 = $520/day).

## Raises — they ask, you answer (#356, C1 R2)

- **`currentGrade > paidGrade` is the whole trigger.** No state machine, no new counters.
  Evaluated once per `clock:day_started` (grade only moves overnight, so within an open day
  re-checking would re-ask the same question) and published as `staff:raise_requested`.
  *Wage auto-follows grade* and *fixed at hire forever* were both rejected at the gate
  (`docs/planning/staff-teeth-design.md` §2 R2) — do not re-propose either.
- Reads: `getRaiseRequests()` (roster order), `getRaiseRequest(staffId)`. Answers:
  `acceptRaise` / `refuseRaise`, both throwing on a member with no outstanding demand — the
  surface only offers the buttons when one is live, so a throw is a stale press.
- **Accept moves `paidGrade` to the grade they asked at.** That IS "the wage moves": every
  wage read derives from `paidGrade`, so there is no second number to keep in step.
- **Refuse starts `raiseCooldownDays` (in `data/staff-pay.json`) and nothing else here.**
  Morale is StaffMorale's answer to `staff:raise_answered`; the quit that may follow is the
  **existing** `StaffMorale` → `staff:quit` path. There is deliberately no new quit path.
- **Three things suppress an ask**, all of them the absence of a decision rather than a rule:
  an unanswered demand is already up; the cooldown is running; or the asked wage doesn't
  actually beat the paid one (wages rise *weakly* with grade, so a flat stretch of a row —
  or a test's `flatPay` — would otherwise raise a prompt whose two buttons cost the same).
- A **promotion voids an outstanding demand** (its two numbers were the old role's); the
  cooldown survives, since "they asked recently" is still true. Quitting or being fired
  clears both.
- Persisted inside the staffOrg blob (`raiseRequests`, `raiseCooldowns`), both optional so a
  pre-#356 save restores as "nobody is asking" and re-derives on the next morning. No
  envelope bump — see `docs/save-migration-recipe.md`.
- `RaiseRequest` captures **both wages at ask time**, so the number agreed to is the number
  shown.

## Rival offers — the same moment with a name on it (#357, C1 R2)

- **A poach is a `RaiseRequest` carrying `rivalName` + `deadlineDay`.** No `staff:poached`
  event, no second prompt component, no second list to read: `getRaiseRequests()` returns
  both kinds and the absence of `rivalName` is what makes one a plain raise. Retention and
  poaching are **one moment** (`staff-teeth-design.md` §2 R2, closing paragraph) — do not
  split them.
- The two answers are the same two methods. `acceptRaise` = **Match**; `refuseRaise` =
  **Let them go**, and that is the single behavioral difference: a declined poach publishes
  `staff:raise_answered` and then `staff:quit`, because the rival is hiring them. No cooldown
  is started on someone who has left.
- **`staff:quit` now has two publishers** — StaffMorale's threshold check and StaffOrg's
  deadline/decline. StaffOrg is the subscriber that removes them either way, so there is one
  departure path with three causes. The payload carries `name` (the feed records a person)
  and `toRival`; `morale` is optional, absent on a poach.
- **`Staff.paidWage` is what the drain charges** (new in #357, optional + serialized). A
  matched offer is a *negotiated* number — the rival bids `wagePremium ×` what the grade asks
  for — so the wage stopped being derivable from `paidGrade` alone. `paidGrade` keeps its own
  job: it records the grade the wage was agreed at, and `currentGrade > paidGrade` is still
  the whole raise trigger. `restore` materializes a missing `paidWage` from `paidGrade`, so a
  pre-#357 save loads paying exactly what #353 charged. A promotion reprices by role and
  clears any premium — you took the desk, you get the desk's pay.
- **Who gets courted is one rule: the chance scales with grade** (`dailyChanceAtTopGrade ×
  grade / 5`). No minimum-grade floor — a floor is a second rule the player could only infer
  from an absence.
- Two suppressions, both the absence of a decision: something is already on that person's
  prompt, and an offer that does not beat what they are already paid (which is what stops a
  matched member being "poached" back down to book the next morning). The **refusal cooldown
  deliberately does not suppress an offer** — it exists so the member does not nag you, and a
  rival calling them is not their doing.
- Ordering inside `clock:day_started` is the mechanic: **expire → offer → ask.** Nobody is
  poached or asks for a raise on the morning they leave, and "one open ask per member" falls
  out of the ordering rather than out of a rule.
- Seeded per (member, day) from `staff_org.rival_offer` — whether the call comes and who
  makes it are drawn in that order from one stream, so a replay reproduces the same offer
  from the same rival on the same morning.
- **The rivals are the live competitors**, injected as `deps.rivalNames` (a function, so
  StaffOrg never holds `CompetitorMarket`); `createWorld` wires it to
  `competitorMarket.getCompetitors()`. Omitted or empty ⇒ no offer ever fires, which is what
  every suite that hires people for other reasons runs under.

## UCM condition read (#163)
- `assessCondition(vehicle) → ConditionRead | null`. Returns null when no
  `used-car-manager` is on the roster OR when `realizedReconFor` is omitted
  (test/fixture path). Picks the highest-skilled UCM (`condition_reading`).
- The pure math lives in `conditionRead.ts`. Band half-width shrinks with
  skill via `skill^widthSkillExponent`; the center can be off realized by
  up to `maxBiasFraction × estimate` at zero skill, scaling linearly to 0.
- Determinism: `deriveConditionReadSeed(masterSeed, vehicleId, staffId)` —
  identical seed + UCM + vehicle → identical read. Different UCMs reading
  the same vehicle get different (but skill-bounded) bands.
- Tunables in `data/tunables.json#staffOrg.conditionRead`.

## Skill growth — Model B (#294, channel-desk M7)
- A roster member's **effective** skill is *derived, never mutated*:
  `effective = base (rolled at hire) + growth_rate × counter`, clamped to a
  **per-hire cap** (`min(axis cap, base + headroom)`, headroom rolled
  deterministically from the staff id — see `StaffFactory.computeEffectiveSkills`).
  Exposed as the non-enumerable `staff.effectiveSkills` getter; **this is what
  every capability gate/refinement reads** (M2–M6 + `assessCondition`).
- StaffOrg accrues the dormant `counters` **overnight only** (on `clock:day_ended`):
  `days_employed += 1` and `deals_closed += (the day's `deal:closed` count)` for
  every roster member. Because the counters change only overnight, the derived
  effective skill is **constant within an open day** (replay-safe, #122) and
  steps up between days toward the per-hire cap. The in-day close tally is
  transient (reset each `day_started`, rebuilt deterministically on replay); the
  durable growth lives in the serialized counters → **no save migration**.
- Which counter drives which axis is data (`data/staff-skills.json#<skill>.growth_counter`):
  `pricing`/`t_o_closing` → `deals_closed`; `condition_reading` → `days_employed`.
  Axes without a `growth_counter` stay static. Magnitudes (`growth_rate`,
  `cap_headroom`) are placeholders — calibration deferred to S14 (#286).
- **`getSkillGrowth(staffId)` is how a surface reads the model (#377)** — per axis,
  `{ skillId, hiredAt, current, ceiling, cap, grows }` in sorted-id order, throwing off the
  roster. Two of those cannot be derived by a consumer: `current` comes off counters this
  module accrues, and `ceiling` is `NPC.perHireSkillCap` — rolled from `masterSeed` + the
  staff id, so a surface computing its own would name a limit the engine does not clamp to.
  `cap` for an axis the taxonomy does not name is `hiredAt` (no room above where they are),
  not an invented default. `grows` is `growth_counter != null` and is the whole test for
  "static": the People card draws no start mark and no ceiling on a static axis, because the
  furniture of a journey implies one. Nothing here is stored — a save round trip re-derives
  the same ceiling, which is why there is no migration.

## Events
- **Emits:** `staff:hired` (with `hiringCost`), `staff:fired`, `staff:promoted`,
  `staff:raise_requested` / `staff:raise_answered` (#356/#357), `staff:quit` (#357 — a rival
  offer declined or run out; StaffMorale still publishes the low-morale one).
- **Consumes:** `clock:day_ended` (Model B counter accrual, #294),
  `clock:day_started` (reset candidate pool + day close tally), `deal:closed`
  (day close tally), `staff:quit`, `clock:overnight_payroll` (#353 — post the
  roster's summed daily wages via `Economy.forceDebit`, labelled "Payroll").

## Hiring constraints
- **Role hire-tier gate:** `getCandidates(roleId)` throws if the role's `hireTier` exceeds the current dealership tier (`deps.getTier`).
- **Per-role slots (#352, A2 R1 + C1 R3)** — the ONE ceiling in the game. `data/staff-slots.json`
  is role → count per tier; `hire()` throws `StaffOrgError` when that role's desks are all taken,
  and `promote()` throws the same way for the target role. Tier comes from `deps.getTier`
  (defaults to 1 if unwired); the composition root wires it to `TierManager.currentTier`.
  Scarcity is per **role**, not per body: a full sales floor no longer shuts off the service desk.
  - `getSlots(roleId) → { roleId, filled, total }` and `getSlotBoard()` (all roles) are the reads
    the People surface renders. `getPromotionOptions` already filters out full targets, so no
    surface ever offers a press that throws — the throws are the engine's lock, not player copy.
  - `headcountCap` survives as a **derived** read: the sum of the tier's role slots. The flat
    `staffOrg.headcountCapByTier` ({1:4, 2:8, 3:16}) is **deleted** from the JSON and the schema —
    two ceilings that can disagree is a bug waiting.
  - A role missing from the slot table **throws** rather than reading as 0 slots; a silently
    unhireable role looks like balance instead of a missing data row.
  - The table is **monotonic** (`StaffSlotTableSchema` refuses a file that decreases) and lists all
    seven tiers per role. Worker-tier roles (`lot-porter`, `technician`) are promotion-only, so
    their slots gate promotion; each mirrors the role it promotes into.
  - Slots are derived from tier + roster, so there is **no save migration**.

## Data
- `data/tunables.json#staffOrg` — `candidatesPerRole`, `conditionRead`. (No hiring cost and no
  headcount cap: #355 and #352 moved both to `staff-pay.json` / `staff-slots.json`.)
- `data/staff-slots.json` — the per-role, per-tier slot table (`loadStaffSlots`, `staffSlots.ts`).
  Counts come from the tier CSV's "Staff" row; `deps.slots` injects an alternative in tests.
- `data/staff-pay.json` — the salary book (`loadStaffPay`, `staffPay.ts`): daily wage per
  role × grade, the grade band edges, the hire-fee multiple, and `raiseCooldownDays`.
  `deps.pay` injects an alternative in tests (`tests/helpers/staffPay.ts` → `flatPay` /
  `noPay`; note both are FLAT across grades, so neither ever raises a demand).
- `data/staff-roles.json` — role definitions (no pay data; wages live in `staff-pay.json`).
- `data/staff-archetypes.json`, `data/staff-skills.json` — used via `NPC` for candidate generation.

## Persistence (#190)
- `snapshot()/restore()` (barrel-exported `StaffOrgSnapshot`) capture the hired
  roster + `currentDay` for save/load. The candidate pool is NOT persisted — it
  is cleared every `clock:day_started` and regenerated deterministically from
  `masterSeed` (same pattern as Inventory's auction board, #189).
  - **Rebuild excludes the roster (#347).** A staff id is
    `staff:<archetype>:<hireDay>:<slot>`, so rebuilding a day's pool regenerates
    the ids it produced before — including the one you hired. `buildCandidatesForRole`
    skips any generated staffer already on the roster and walks the slot forward
    to keep the pool at `candidatesPerRole`. Without it, a reloaded save offered
    you the person you already employ, and hiring them pushed a duplicate id.
- Roster entries serialize as plain `Staff`; the `effectiveness` /
  `trustworthiness` composites are non-enumerable derived getters that JSON
  drops, then `restore` re-attaches them via `NPC.rehydrateStaff(staff, taxonomy)`
  — pure re-derivation, identical to what `createStaff` produces.
- Wired into `snapshotWorld`/`restoreWorld` under the `staffOrg` key, restored
  before `staffMorale` so morale rehydrates onto the same staff ids.

## Collaborators
- `NPC.createStaff` / `NPC.promoteStaff` produce the underlying `Staff` records.
- `StaffMorale` tracks state for active roster members.
- `StaffDispatch` reads the roster to auto-resolve queue items.
