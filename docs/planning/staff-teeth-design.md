# Staff-teeth — design record (C1)

> **Status: RULED 2026-08-02.** Gate: `path-to-finished-product.md` §5 C1, the last
> designed-but-ungrilled core mechanic. Locked inputs this sits on and does **not** reopen:
> `macro-loop-spine.md` §5 (staff = the engine of the whole arc), `staff-performance-ladder.md`
> (the real-industry 5-grade ladder, #249), the CSV tier table (tier + profit-center truth),
> `poaching-cut.md` (customer-poaching is cut; **staff** poaching is a live, separate concept).
>
> This doc is the design. The build is the next `/next` (SLICE phase 6).

---

## 1. Why the gate existed — the measured "zero teeth" state

Every claim below was verified against the repo on 2026-08-02, not inherited from the spine.

| Claim | Reality |
|---|---|
| Payroll scales with headcount | **No.** `data/tunables.json#economy.tier1.weeklyPayrollStub` = **$800/week flat**, posted by `Economy.ts:67`. Your fifth hire costs **$0/week**. |
| Hire cost scales with talent | **No.** `StaffOrg.ts:175` returns `hiringCostByTier[role.tier]` — every candidate for a role has an identical price (worker 500 / customer-facing 1,000 / manager 2,500 / gm 5,000). |
| Staff carry a salary | **No such field exists.** `data/staff-roles.json` has no pay data at all. (`StaffOrg/CLAUDE.md:57` claimed it did — stale, corrected by this build.) |
| The hiring board is scarce | **No.** The pool is wiped every `clock:day_started` (`StaffOrg.ts:145`) and rebuilt from a fresh day-seeded roll. Don't like today's three? Wait one day, free. |
| Pay-vs-market affects morale | **No.** `StaffMorale.ts:93` applies `payVsMarketBonus` **unconditionally** every payroll night. It compares nothing. |

So "insta-hire the best" was not merely cheap — it was free, repeatable, and unpunished.

## 2. The rulings

### R1 — Pay model: **a daily wage, set by grade and role. One rule.**

Every person on the roster burns a daily wage. The number is a function of two things the
player can already see: their **grade** (1–5) and their **role**. That is the entire pay model.

**Draw-against-commission was considered and rejected.** It is the real auto-retail structure
and it was the standing recommendation going into this gate, but it fails on two counts the
director named:

1. **It is four comp structures, not one.** Commission covers salespeople and F&I only.
   Techs are flat-rate book hours, advisors are salary plus a service-gross cut, porters are
   hourly, managers are salary plus department bonus. The player would have to learn four
   rules to understand one line item.
2. **The argument for it was backwards.** The case made was "a flat drain never teaches you
   anything, because a bad month costs what a good month costs." That is the opposite of
   true: a **fixed** cost against **variable** revenue is exactly what makes a slow day hurt.
   Commission partially self-insures a bad week — you pay less when you sell less. A wage
   doesn't. The flat drain is both the simpler rule *and* the sharper one.

The standing requirement from spine §5 — *"a star is an ongoing liability you must keep fed
with volume, not a one-time upgrade"* — is satisfied directly: the star's wage is charged
every day whether the floor produced or not.

**Cadence is daily, not weekly.** The player sees the drain in the same beat they see the
day's gross, so the pressure is legible in the Reveal rather than arriving as a weekly
surprise.

### R2 — Raises: **they ask, you answer.**

Growth never silently reprices anyone. Skill growth is already live (StaffOrg Model B, #294:
a rookie's effective skill climbs with tenure and closed deals toward a per-hire cap). When
someone has outgrown what they're paid by enough, **they come to you**:

> *Marcus wants $520/day. He's on $340.*  →  **Pay it** / **Refuse**

- **Pay it** — the wage moves to the new number, morale bumps.
- **Refuse** — morale drops and the existing quit machinery (`StaffMorale` → `staff:quit`)
  takes it from there. They ask again after a cooldown.

Chosen over the two alternatives because it is a **moment you play** rather than a number
that drifts. That is the direct lesson of `poaching-cut.md`: a surfaced mechanic with no
decision inside it is the least-fun kind. This is the same pressure *with* the decision.

The rejected alternatives, recorded so they are not re-proposed:
- *Wage auto-follows grade* — predictable and cheapest, but the cost rises on its own with
  nothing for the player to do about it. A drift, not a decision.
- *Fixed at hire forever* — simplest, but once the player notices it, "hire the cheapest
  greenpea and wait" is strictly dominant. Buying finished talent stops being a real option,
  which kills the hire decision this gate exists to create.

**Retention and poaching collapse into this one moment.** Spine §5's required
"poaching/retention risk" is *not* a second mechanic: a rival's offer is the same popup with
a name and a deadline on it — *"Northside offered Marcus $610/day. He'll take it Friday."*
Same event family, same two buttons, extra fields. One thing for the player to learn, both
teeth delivered.

### R3 — Talent supply: **the tier slot table is the cap. No separate rarity system.**

What stops you buying five A-players is that **you do not have five slots**. The counts come
from the CSV (`Gameplay Loops and Dealership progression tiers.csv`, row 4, tier + profit-center
truth) — T1 = 1 salesperson, T2 = 2 sales + 1 service advisor, T3 = 3 sales + 1 UCM + 1 F&I +
1 SA + 1 BSA, and so on. You cannot field five salespeople at all until T5.

Talent is then gated a second, honest way by R1: an elite roster you cannot feed goes broke.
Two real gates, both already in the design — **no rarity roll, no persistent named labor
market.** A "persistent cast of people with a fate" was considered and rejected on build cost
against the director's standing bar: playable, enjoyable, easy to understand.

**Consequence — this ruling makes A2 (phase 7) load-bearing for C1.** Today's cap is
`staffOrg.headcountCapByTier` = a flat `{1:4, 2:8, 3:16}` with **no per-role slots**, so the
CSV's counts are not enforced anywhere. The scarcity half of staff-teeth does not bite until
the per-role slot table exists. See §6.

## 3. Internal calls (made by the implementing agent, not director gates)

Recorded so they aren't re-litigated. Any may be vetoed in passing.

1. **Grade is derived, never stored as a second source of truth.** `grade` is a banded read of
   the existing `effectiveness` composite, per `staff-performance-ladder.md:26` (green
   0.35/0.4 ≈ grade 1–2; mature 0.75/0.75 ≈ grade 3–4). Bands live in `data/`.
2. **Paid grade vs current grade is the entire raise trigger — no new state machine.** Store
   the grade the person was hired at (`paidGrade`); derive current grade from grown
   `effectiveSkills`. `currentGrade > paidGrade` **is** the raise demand. Accepting sets
   `paidGrade = currentGrade`. This falls straight out of Model B and needs no new counters.
3. **The salary book lives in `StaffOrg`** (already the source of truth for who is on payroll).
   `Economy` posts what it is handed; `weeklyPayrollStub` is deleted, not left alongside.
4. **Pay data is a new `data/staff-pay.json`** through the standard loader — per role, a daily
   wage per grade 1–5. Magnitudes are placeholders anchored to the ladder's units/PVR bands;
   real calibration is C2 (#286).
5. **The one-time hire fee stays but loses its own table** — it becomes a multiple of the
   person's daily wage, so a grade-5 costs more to sign *and* more to keep from one number.
   `hiringCostByTier` is retired.
6. **The ladder ships under the word "grade", never "tier"** — dealership tiers own that word
   (locked, `staff-performance-ladder.md:24`).
7. **`payVsMarketBonus` becomes real or dies.** It currently fires unconditionally
   (`StaffMorale.ts:93`), which is a placeholder wearing a mechanic's name. It becomes an
   actual comparison of paid wage against the grade's asking wage — which is also what feeds
   the R2 raise trigger — or it is removed. It does not survive as-is.
8. **Candidate-board refresh cadence is a `data/` value, not a design fork.** It is `1 day`
   today (`StaffOrg.ts:145`). With slots tight and wages real, waiting a day for a better
   candidate already costs a day of an empty desk — at T1 that is the entire sales floor.
   Whether the number should be 1 or 7 is a calibration knob for C2, not a mechanic.

## 4. Player-facing surface required by this design

The People surface is where all three rulings are read, so it is part of C1's build, not a
later polish pass.

- **Every candidate and every roster member shows their grade (1–5) and their daily wage.**
  Those are now the two numbers the hire decision is made on.
- **The roster shows total daily payroll** against the day's gross — the drain has to be
  visible in the same glance as what pays for it.
- **The raise/rival-offer moment is a two-button prompt** with both numbers stated in plain
  language. No temperature words (`feedback-no-vague-temperature-labels`).

### Known defect this build must fix

**Skill bars render identically for every employee.** `SkillRow`
(`src/ui/PersonnelScreen/PersonnelScreen.tsx:22`) sizes the fill with `flex: ratio` against a
`flex: 1 - ratio` spacer, but `skillBarBg` (`:565`) never sets `flexDirection: 'row'`. React
Native defaults to **column**, so fill and spacer stack vertically inside a 6px-tall box and
the bar carries no information at all — a grade-1 greenpea and a grade-5 closer look the
same. Reported by the director 2026-08-02. The comparison this gate depends on is currently
impossible to make on screen, so the fix is in scope here.

## 5. What gets built (feeds the phase 6 SLICE)

1. `data/staff-pay.json` + loader — daily wage by role × grade; grade bands; hire-fee multiple.
2. Grade derivation on `Staff` (banded `effectiveness`), exposed on the `NPC`/`StaffOrg` surface.
3. `paidGrade` on `Staff` (serialized) — save migration required.
4. Daily payroll: `StaffOrg` sums the roster and posts through `Economy`; `weeklyPayrollStub`
   deleted from `data/tunables.json` and `economyData.ts`.
5. Talent-scaled hire fee; `hiringCostByTier` retired.
6. Raise demand: new event(s) in `EventBus/events.ts`, the accept/refuse actions on `StaffOrg`,
   morale consequences wired to the existing quit path, cooldown after a refusal.
7. Rival offer: the same event family with `rivalName` + a deadline — the poaching half of
   spine §5's required teeth.
8. `payVsMarketBonus` made real (paid wage vs grade asking wage) or removed.
9. People surface: grade + daily wage on candidates and roster, total daily payroll, the
   two-button prompt — **and the `flexDirection` bar fix.**

## 6. Sequencing finding

**A2 (phase 7, per-tier staff slots) should be adjudicated and sliced before or alongside
phase 6's build.** R3 makes the CSV slot table the scarcity gate, and nothing enforces it
today — `headcountCapByTier` is a flat 4/8/16 with no per-role breakdown. Build staff-teeth
against a flat cap and the wage does all the work alone while the slot half sits inert. This
is a build-order observation for `/next`, not a change to either phase's scope.

## 7. Open

Nothing. All three forks ruled. Magnitudes (wage tables, grade band edges, raise threshold,
refusal morale penalty, refresh cadence) are placeholders by design and belong to the C2
calibration campaign (#286) — tuning them before the drain is real would be tuning a
different game.
