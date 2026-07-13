# Game Gap Summary — Design vs. Repository

> **Scope:** Gap identification only. No fixes proposed, no new mechanics introduced.
> Derived from `docs/audits/game-coverage-matrix.md` (accepted as ground truth),
> anchored to `CLAUDE.md`, `docs/spec-condensed.md`, ADR-0001/0002, the locked tier CSV
> + channel-desk manager model, the **locked engagement spine**
> (`docs/planning/engagement-spine.md`, 2026-07-12), and the open issue queue.
> Generated 2026-07-13 against `main` @ `a711a7a` (working tree dirty — settings +
> one untracked planning doc; no code drift).

> **What moved since 2026-06-17:** the two headline profit-center gaps (Service synthetic
> stub, Body Shop absent) were **closed at the engine level** by #298–#318, and the
> engagement-spine Reveal tracer (#319–#322) shipped live. **A new headline replaced them:**
> both centers are unstaffable in live play because the hiring UI never offers the advisor
> roles — a one-seam `[UI]` gap gating two profit centers.

Focus is **player-complete coverage**, not backend existence. A system "exists" here
only if the player can reach, see, understand, and get feedback from it.

---

## Design intent this audit is measured against

The felt loop is **Dope Wars × Lemonade Stand** mapped onto a car dealership:

- **Dope Wars side:** buy low / sell high, plus *random adverse events* the player rides out.
- **Lemonade Stand side:** set the **recipe** (inventory mix + recon/staffing) and the **price**,
  then watch customers stop or walk.
- **The core skill is the match** — stock to the incoming demand "weather."
- **F&I is a staffing-gated, auto-resolved lever**, not a workflow.
- **Progression = the tier ladder T1→T7** (CSV + macro-loop spine): each tier a hire absorbs
  your old job and a new profit center / altitude opens. **Each unlocked profit center must
  actually *run* for the player.**
- **The engagement spine (locked 2026-07-12):** every bite of time ends in ONE Reveal —
  starred reactions (entities with fates) + a plain-language scoreline that resolves the
  morning's bet. The grain and clock zoom with the business. Depth gets *surfaced*, not
  multiplied.

---

## Prioritized Gap List (highest leverage first)

1. **Advisor hiring unsurfaced → Service AND Body Shop have zero capacity in live play** `[UI]` —
   **partially filed** (it is #297 user-story 38's residue; no dedicated issue). `buildHiringRoleOptions`
   (`src/app/config.ts:147-158`) offers only salesperson + manager/gm roles; `service-advisor` (hireTier 2)
   and `body-shop-advisor` (hireTier 3) are engine-hireable, archetyped, tested — and unreachable.
   Throughput is `min(bays, advisors)`, so both rebuilt profit centers idle at zero. **One seam, two
   profit centers.** (Companion facts: promotion path never fires in play; `technician`/`lot-porter`
   feeders decorative; CSV per-tier staff *counts* unmodeled.)
2. **Random adverse events / news engine missing** `[ENGINE]` — **filed #176–#179.** The Dope-Wars
   "bust" pillar. Now the largest unbuilt loop pillar, and the engagement spine names it the Reveal's
   loudest reaction source.
3. **Staff-teeth unbuilt** `[ENGINE]` — **#249 calibration data landed; design session + build pending.**
   Hiring has no salary drain, talent-scaled cost, scarcity, or retention risk — "insta-hire the best" is
   free. Blocks honest calibration (#286) and the People dashboard's reason to exist.
4. **Engagement spine continuation** `[ENGINE+UI]` — **tracer shipped (#319–#322); next steps unfiled.**
   Reveal ranking tuning, records catalog, bet-capture shape, **drive-the-clock** (run-a-week/month bites),
   F&I plug-in #2 (resume the parked grill), higher-tier grains (dept/store/group reactions).
5. **Everything is uncalibrated** `[ENGINE]` — **filed #286.** Every manager-gate threshold, drift,
   elasticity, demand config, and skill-growth rate is a placeholder; the harness's competent bot
   bankrupts pre-T2 (expected pre-staff-teeth, but it means the shipped balance is unplayed).
6. **Three of five tabs are placeholder rooms** `[UI]` — **UNFILED.** People, Finance (needs a
   chart-primitives kit slice), Growth.
7. **No tutorial/onboarding anywhere** `[ENGINE+UI]` — **filed #213.** The match skill is subtle and
   taught nowhere; a casual player gets a cold menu → character creation → dashboard.
8. **T4 OEM/NCM engine** `[ENGINE]` — **design record #223.** Allocation/floorplan/incentives + the
   courtship/brand-application mechanic the T3 `dossierReady` hook already arms. The next
   profit-center engine in the build order.
9. **T5 BDC + T6 GM/multi-store + T7 endgame** `[ENGINE]` — **#124 (batch-sim) filed; rest unfiled.**
   Appointments/campaigns + `bdc-manager`; GM automation + franchise acquisition + store switching;
   prestige/synergy summit.
10. **Manager channel-desk status surface** `[UI]` — **UNFILED.** UCM/SM/BSM automations act invisibly.
11. **Poaching dormant at starting reputation** `[ENGINE]` — **filed #187.**
12. **Market-state KPI visibility** `[UI]` — **filed #179.**
13. **T2/T3 recovery under-surfaced** `[UI]` — **UNFILED.** Contraction/consent-decree not distinguished
    from game-over.
14. **CompetitorMarket drift/poach silent** `[UI]` — **filed #267.**
15. **No audio/haptic/game-feel layer** `[UI]` — **UNFILED** (noted as a coverage fact for a premium
    mobile title; whether/how is the user's call — see path-to-finished doc).
16. **F&I follow-ons** `[ENGINE]` — **filed #151–#153.**
17. **A11y options screen** `[UI]` — **filed #268**; hero-art header `[UI]` — **filed #252.**
18. **Ship-blocker: real vehicle brands in `data/`** `[data]` — **filed #246.** Hard release gate.
19. **Doc drift** `[doc]` — **filed #209**; plus new drift: spec-condensed's "Bodyshop unlocks at T3"
    is now built — refresh alongside.
20. **Stale issues to close** `[hygiene]` — #269 (superseded by shipped Body Shop), #266 (fire is
    surfaced), #297 (once gap #1 lands).

---

## Profit-Center Reality Check (carried from the matrix)

| Profit center | Tier | Real loop? | Why |
|---|---|---|---|
| Sales (used) | T1 | ✅ **Yes** | The live game |
| **Service** | T2 | 🔴 **Stub — one seam from real** | Engine/demand/UI/persistence real; advisor unhireable → zero throughput |
| **Body Shop** | T3 | 🔴 **Stub — same seam** | Full collision mirror built; advisor unhireable |
| F&I | T3 | ✅ **Yes** | Auto-resolved by design; f&i-manager hireable |
| New-car / OEM | T4 | 🔴 **Absent** | Engine not yet built `[#223]` |
| BDC / marketing | T5 | 🔴 **Absent** | Callback only; appointments center not yet built |

---

## Loop-critical Gaps

**Advisor hiring seam — `[UI]`, top severity.** The T2 and T3 profit centers' entire player loop
(read demand → stock parts → set posture → watch advisors clear tickets → grow the base) exists and
cannot start: capacity is `min(bays, advisors)` and advisors cannot be hired. Feedback face: the player
sees demand heat and a filling queue and has no lever to serve it.

**News engine (#176–#179) — `[ENGINE]`, high.** The world never throws weather *changes* to ride out;
the Reveal has no loudest-reaction source.

**Staff-teeth — `[ENGINE]`, high.** No risk/reward on hiring; trivializes the People axis and blocks
believable balance.

**Reveal spine continuation — `[ENGINE+UI]`, high.** The tracer proves the grammar at T1/daily; the
locked design requires the clock ladder (week/month), records, and F&I's monthly-verdict plug-in to
carry the fun up the tiers.

**Resolved since last run (no longer gaps):** Service synthetic intake (now InstalledBase-bound);
Body Shop absence (built #311–#318); "no discrete felt beat" (Reveal live).

---

## Dark Systems

- **Service + Body Shop engines are player-inert** — not orphaned (wired, rendered, persisted) but
  inoperable at the staffing step. The load-bearing dark state this run.
- **Promotion machinery** (`NPC.promoteStaff`, promotion gates in data) — built, tested, never invoked
  by any gameplay path. `[ENGINE][UNFILED]`
- **IndictmentMonitor extra producers** (`audit_failure`, `deal:fraud_flag`) — unwired. `[ENGINE][UNFILED]`
- **Dark surfaces:** People/Finance/Growth placeholder tabs. `CustomerCard`/`AdminConsole` dev-only by intent.

## Missing Systems (agreed in design, absent from code)

- **News engine / ticker / weekly report** — #176–#179. `[ENGINE]`
- **Staff-teeth** (salary drain, scaled hire cost, scarcity, poaching/retention) — design session pending. `[ENGINE]`
- **OEM Relationship engine + NCM + courtship/brand application** — #223. `[ENGINE]`
- **T5 BDC appointments/campaigns + `bdc-manager`** — unfiled. `[ENGINE]`
- **T6 GM automation + multi-store acquisition + batch-sim (#124)** — mostly unfiled. `[ENGINE]`
- **T7 prestige/synergy endgame** — unfiled. `[ENGINE]`
- **First-run onboarding** — #213. `[ENGINE+UI]`
- **Audio/haptics** — unfiled, user call. `[UI]`

## Partial Systems

- **StaffOrg hiring surface** — hire/fire live, role list incomplete (the headline). `[UI]`
- **Tier progression** — T1→T3 modeled + gate-streak promotion ✓; T2/T3 unstaffable; T4–T7 engines absent;
  CSV staff counts unmodeled; fixed-ops manager split divergence. `[ENGINE/design]`
- **Channel-desk + dept managers** — built, thresholds placeholder, no status surface. `[ENGINE/UI]`
- **CompetitorMarket** — wired; poaching dormant (#187); silent (#267). `[ENGINE/UI]`
- **KPIDashboard** — market-state slice open (#179). `[UI]`
- **Failure/recovery** — recovery states under-surfaced. `[UI]`

## UI Surfacing Gaps

- Advisor roles in the hiring surface (the headline).
- People / Finance / Growth dashboards (placeholders).
- Manager status surface (what your managers now handle).
- Market-state KPIs (#179); competitor notifications (#267).
- Recovery-state distinction; a11y screen (#268); hero-art header (#252).

## Persistence Gaps

- **None found.** Envelope v16 covers all stateful modules incl. both departments and the prep bet;
  regenerating streams (Weather/ServiceDemand/CollisionStream) are stateless by design; mid-day
  checkpoint path intact; migrations v1→v16 registered. Cross-department persistence has a dedicated
  capstone test (#317).

## Onboarding Gaps

- **Everything (#213).** No tutorial, coachmarks, first-run flow, or help. The game now has MORE
  subtle systems to teach than when #213 was filed (service annuity, parts pars, channel posture,
  the bet/Reveal loop).

## Feedback Gaps

- Service/Body-Shop demand arrives with no way to act on it (staffing seam) — top.
- Managers act invisibly; competitor moves silent (#267); recovery states read as death.
- The Reveal closes the day loop's feedback hole — the month/quarter altitudes still lack their
  Reveal grains (spine continuation).

---

## Most Damaging Omissions

1. **Two profit centers idle behind one hiring seam** `[UI]`.
2. **No adverse events** (#176–#179) `[ENGINE]` — the world never surprises the player.
3. **No staff risk/reward** `[ENGINE]` — the People axis is a shopping list.
4. **Placeholder balance everywhere** (#286) `[ENGINE]` — the shipped numbers have never been played.
5. **Three empty dashboards + no onboarding** `[UI]` — the shell promises rooms it doesn't have and
   teaches none of what it does have.
6. **The ladder above T3 is engine-less** (#223 + unfiled T5–T7) `[ENGINE]` — the product IS the full
   ladder; today's ceiling is T3's dossier hook.

> **Retired from prior run:** "Service is customer-blind synthetic" (now InstalledBase-bound);
> "Body Shop zero code" (built); "no felt beat / verdict moment" (Reveal live); "worldSnapshot v8"
> (v16). The June audit files this doc replaces graded those correctly for their date.

---

## Unfiled Gaps (roll-up — so nothing load-bearing is invisible)

1. **Advisor hiring surface** (+ bays default verification + CSV staff-count modeling) `[UI+ENGINE]` — top.
2. **Engagement-spine continuation slices** (ranking, records, drive-the-clock, F&I plug-in, tier grains) `[ENGINE+UI]`.
3. **Staff-teeth build** (post-grill) `[ENGINE]`.
4. **T5 BDC / T6 GM+multi-store / T7 endgame engines** `[ENGINE]` (only #124 exists).
5. **Promotion path wiring** (feeder roles → advisors) `[ENGINE]`.
6. **Manager status surface** `[UI]`.
7. **People / Finance / Growth dashboards** `[UI]`.
8. **Recovery-state surfacing** `[UI]`.
9. **IndictmentMonitor producers** `[ENGINE]`.
10. **Audio/haptics layer** `[UI, user call]`.
11. **Fixed-ops manager split adjudication** (CSV vs implemented two-role) `[design]`.
12. **Issue hygiene:** close #269/#266; close #297 after gap #1; refresh #209 + spec-condensed Bodyshop line.

*Gap identification only — the build plan lives in `docs/planning/path-to-finished-product.md`.*
