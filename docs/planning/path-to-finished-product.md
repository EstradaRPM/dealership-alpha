# Path to the Finished Product — Full Design Document

**Generated 2026-07-13 against `main` @ `a711a7a`.**
**Companion state docs:** `docs/audits/game-coverage-matrix.md` + `game-gap-summary.md` (same date —
read those for *what is*, this doc for *what's next*).

**POV of this document:** a regular person who bought a fun casual business sim — not a car-industry
expert, not a hardcore sim player. Every item below is judged by one question: *does this make the
game they open more fun, more legible, or more finished?*

**How to read it:** there is ONE finished product — the full T1→T7 tier ladder with every agreed
mechanic built as the real thing. Nothing here is a "later version." The phases at the end are a
**commit sequence** (what to build first so each landing is verifiable and playable), nothing more.

**Provenance tags** — so nothing gets smuggled:
- `[FILED #N]` — an open issue already covers it.
- `[LOCKED]` — design locked in a repo doc/memory; slices not yet filed.
- `[STALE]` — an issue whose premise the current build has overtaken.
- `[NEW]` — proposed by this audit from the end-user lens. **Not agreed design until you say so.**

---

## 1. The player today — an honest first session

What a casual player actually experiences right now, in order:

1. **Main menu** — clean: New Game / Continue / Load, 3 slots, Legacy Wall. Good.
2. **Character creation** — name + backstory. Fine, but nothing explains what backstory *does*.
3. **Dashboard, day 1** — a Home tab with cash, a demand heat console, a gate strip, a weather
   card… and no explanation of any of it. Three of the five tabs (People, Finance, Growth) open
   onto "coming in a later slice" placeholders — the shell promises rooms the house doesn't have.
4. **START DAY** — the floor sim runs in real time. Customers arrive, staff auto-resolve, exceptions
   escalate. This part works and is the proven-fun core.
5. **Day close — the Reveal** — starred wins/losses + a plain scoreline that resolves the morning's
   bet. **This is the game's one genuinely finished felt beat** (#319–#322). It's good.
6. **They hit Tier 2** — Service unlocks. A whole department page appears: demand heat, parts
   coverage, pricing posture, marketing arms. They see service demand arriving… and there is **no
   way to hire the service advisor that gives the department any capacity.** The queue fills; nothing
   resolves. The same will happen with the Body Shop at Tier 3.
7. **Nothing ever surprises them.** No news, no market shocks, no competitor moves they can see.
   The demand weather drifts, but the world never *does* anything to them.
8. **Silence.** No sound, no music, no haptics, anywhere.
9. **If they lose**, they get a noir end-card (great). If they *partially* fail at T2/T3
   (contraction, consent decree), the game doesn't visually distinguish it from death.
10. **If they keep winning**, the ladder currently tops out at T3 arming a "dossier" that leads
    nowhere yet — T4 (franchise), T5 (BDC), T6 (multi-store), T7 (group) are unbuilt engines.

**Verdict from the casual-player seat:** the core day loop and the Reveal are real fun. Everything
around them is either invisible (no teaching, no sound, silent systems), inoperable (advisors), or
absent (shocks, upper tiers, dashboards). The good news: the sim depth underneath is already built
and honest — most of what follows is *surfacing and finishing*, not modeling from scratch.

---

## 2. Definition of "finished"

A premium, single-player mobile business sim where:

- The player climbs **all seven tiers** — gravel lot to dealer group — with each tier delivering its
  CSV-canon profit center, staff, and "your new job" (macro-loop spine §4).
- Every bite of time ends in **the Reveal**, and its grain/clock zooms with the business
  (customer/day → dept/month → store/quarter) so the same dopamine grammar carries T1→T7.
- The world **pushes back**: news shocks, competitor moves, regulatory pressure — adverse events the
  player reads and rides out (the Dope-Wars pillar).
- Staff are **decisions, not purchases**: salary drain, talent-scaled cost, scarcity, poaching.
- A new player is **taught the loop in their first session** and never sees an empty room, a dead
  control, or an unexplained number.
- It looks, sounds, and feels like a finished premium mobile game, and it can legally ship
  (fictional brands, store assets, accessibility).

---

## 3. Workstream A — Make what's built actually playable (the unblockers)

### A1. Advisor hiring + staffing completeness — **the single highest-leverage fix in the repo** `[FILED — residue of #297 story 38]`
`buildHiringRoleOptions` (`src/app/config.ts:147-158`) offers only salesperson + manager/GM roles.
`service-advisor` and `body-shop-advisor` are fully engine-supported (tier-gated candidates,
archetypes, tests) and unreachable. Since department throughput is `min(bays, advisors)`, **Service
(T2) and Body Shop (T3) run at zero capacity in live play.** Scope:
- Offer `service-advisor` (T2+) and `body-shop-advisor` (T3+) in PersonnelScreen, tier-gated like managers.
- Verify the **bays** side of `min(bays, advisors)` has a sane per-tier default and decide its player
  surface (facility investment is the natural home — see A2).
- Wire the **promotion path** (`NPC.promoteStaff` has zero callers): technician→advisor,
  lot-porter→salesperson/technician, salesperson→managers. Promotion is a cheaper, loyalty-flavored
  alternative to hiring — the mechanic already exists in data and engine; give it a button on the
  roster card when gates are met.
- Add a **reachability test that hires an advisor through the UI layer** so this class of hole
  (engine-hireable, UI-invisible) can't recur.

### A2. Per-tier staff slots + facility scale `[NEW — CSV-derived, needs your sign-off on shape]`
The CSV staffs each tier with specific counts (T3: 3 sales, 1 UCM, 1 F&I, 1 SA, 1 BSA; T4: 6 sales,
2 SA, 2 BSA…) and lot sizes (6/12/35/75/120). Nothing models slot counts or lot-size caps. Casual-player
value: slots make hiring legible ("2 of 3 sales desks filled") and make tier-ups *feel* bigger. Proposal:
per-tier slot/lot caps in `data/` + a roster surface that shows filled/empty slots. This is also the
natural place bays live (service bays as facility slots).

### A3. Issue hygiene `[STALE]`
Close #269 (Body Shop "anchor" — superseded by the shipped build), #266 (fire is surfaced), and #297
(once A1 lands). Refresh #209 + spec-condensed (multi-slot save; "Bodyshop unlocks at T3" is built;
module list missing the new department modules).

### A4. Silent-system surfacing (small, high-legibility) `[FILED]`
- **Competitor moves as notifications** — drift/poach events exist, render nothing `[#267]`.
- **Poaching scale fix** so competitors actually poach at starting rep `[#187]`.
- **Market-state KPI slice** on the dashboard `[#179]`.
- **Manager status card** — "Your UCM now auto-prices inventory" — the four desk gates and two
  department managers act invisibly today `[LOCKED design, unfiled]`. The player should always know
  what they've delegated (macro-spine §2 requires delegation to feel like *permission*).
- **Recovery-state surfacing** — T2 contraction and T3 consent-decree must look like setbacks, not
  game-over `[unfiled, spec-canon]`.
- **IndictmentMonitor producers** — wire `audit_failure`/`deal:fraud_flag` so the indictment path
  has more than one trigger `[unfiled]`.

---

## 4. Workstream B — The engagement spine, completed `[LOCKED — docs/planning/engagement-spine.md]`

The Reveal tracer is live. The locked design's remaining steps, in its own build order:

### B1. Reveal tuning + records
- **Ranking function** — score "drama" (match strength, gross surprise, walk-off pain, record broken,
  coupling fired) to pick the top 3–5 reactions per bite.
- **Records catalog** — best day, best month, PVR record, streaks — records are crowned reactions on
  the same feed, not a separate system.

### B2. F&I as plug-in #2 `[LOCKED + parked grill state]`
Resume `docs/planning/fni-mechanics-grill-state.md` mid-tree. F&I proves the grammar spans from a
daily beat up to a monthly strategic verdict ("cash-heavy crowd — the finance office sat empty").
Absorbs the filed F&I follow-ons `[#151–#153]` (cash/must-finance traits, attach-rate scaling,
per-segment reputation surface) as reaction sources.

### B3. News / adverse-events engine — the loudest reactions `[FILED #176–#179]`
The last unbuilt loop pillar. MarketNews inside MarketEconomy: three reliability tiers (factual /
leading-rumor with false alarms / lagging texture), daily ticker on Home, weekly market report,
progression-gated depth (#178), shocks that land as player-felt Reveal reactions and demand-heat
moves. This is what makes the world *do things to you* — for a casual player it's the difference
between a dashboard and a game.

### B4. Drive-the-clock — run a day / a week / a month `[LOCKED]`
The bite-size choice is itself a bet. Extends the existing pause/speed control upward; the Reveal
aggregates to the chosen bite. Gate the bigger bites by tier/delegation (a T1 solo operator can't
fast-forward a month; a T6 CEO can) — the unlock schedule is a spine STILL-OPEN item to settle when
building. Absorbs the GM-gated batch-sim `[#124]` as its top rung.

### B5. Higher-tier grains (built alongside T4–T6 in Workstream E)
Dept/month reactions at T4, store reactions at T6, group/quarter at T7 — every starred reaction stars
an entity with a fate, never a bare metric (the spine's load-bearing rule). Staff-teeth (D1) supplies
the protagonists.

---

## 5. Workstream C — Staff-teeth + the numbers (make decisions cost something)

### C1. Staff-teeth design session + build `[LOCKED 2026-08-02 — staff-teeth-design.md]`
Design ruled; build is a SLICE. Three rulings: **one daily wage per person, set by grade × role**
(commission rejected — it is four comp structures, and a fixed cost against variable revenue is the
sharper drain anyway); **raises are a moment you play** — they ask, you pay or refuse, and a rival's
offer is the same prompt with a name on it, so retention + poaching are one mechanic; **the CSV tier
slot table is the scarcity cap** — no rarity roll, no persistent labor market. Talent-scaled hire fee
becomes a multiple of the daily wage. Uses the real-industry 5-grade ladder (#249 doc) as the
calibration anchor. This is what turns the People axis from a shopping list into a game, gives the
People dashboard content, and gives Reveal reactions their staff protagonists.
**Sequencing:** R3 makes A2's per-role slot table load-bearing here — adjudicate/slice A2 before or
with this build, or the wage does all the work alone. See the design doc §6.

### C2. The calibration campaign `[FILED #286]` — after C1
Every number in the game is currently a placeholder: manager-gate thresholds, execution drift,
skill growth/cap headroom, elasticity, demand configs, service/body-shop economics, tier-gate
thresholds vs `data/tier-pacing-targets.json`. One campaign, run with the balance harness
(#247/#248), after the salary drain is real — tuning before it would be tuning a different game.
**Includes fixing the known harness signal:** the competent policy bot currently bankrupts pre-T2;
after staff-teeth + calibration it must hit the pacing targets (T1 ~1h → T6 ~10h dwell curve,
macro-spine §12). Also closes the engineering verifications `[#180, #181]`.

### C3. The felt-loop playtest gate `[FILED #74]`
The standing HITL checkpoint: play several in-game days end-to-end, tune in one calibration commit.
Run it once after A1+B3 land (the loop is finally whole at T1–T3), and again after C2.

---

## 6. Workstream D — The UI, completed

### D1. The three placeholder dashboards `[unfiled, IA locked in second-level-ia.md]`
- **People** — roster with slots (A2), morale/skill growth, salary book (C1), promotion actions (A1),
  scouting/poaching once staff-teeth lands. Build after C1 so it has real content.
- **Finance** — the analytics room (analytics.png): P&L trend, per-department gross, carrying cost,
  F&I per-copy. Needs the **chart-primitives kit slice** first (bars/lines/sparklines in the
  existing kit idiom).
- **Growth** — the strategic home: gate board + demand console (graduating from Home), courtship/
  brand portfolio once T4 lands. Its charter is the tier ladder itself.

### D2. Operations surface completion `[unfiled residue of the mockup pipeline]`
- Inventory dashboard (inventory.png mapping) as the full Operations sub-surface.
- Sourcing-lean dial (the #293 seam persists a lean; no control renders it).
- BDC/follow-up surface — today callbacks resolve inside a generic queue; give follow-ups their
  visible home (grows into the T5 BDC page in E2).
- Hero-art header backdrop `[#252]` and any remaining neo-skeuo paint-pass residue.

### D3. Session ergonomics + plain-language audit `[NEW]`
A casual player pass over every live surface: every number formatted ($12.4k not 12400), every label
plain-language (the no-temperature-words rule enforced everywhere), every empty state written
("No cars on the lot — visit the auction"), every control with a one-line consequence hint. Cheap,
huge legibility payoff, and it's the polish the mockups promise.

### D4. Accessibility screen `[FILED #268]`
Text scale, reduced motion, haptics toggle (G1), colorblind-safe heat palettes. A premium title ships this.

---

## 7. Workstream E — The upper tiers (the product IS the ladder)

Build order follows the tier ladder; each tier lands as: engine → staff role(s) → its page/controls →
its Reveal grain → its gate faces → harness pacing verification.

### E1. Tier 4 — Franchise: the OEM Relationship engine `[LOCKED design record #223 + macro-spine §6–7]`
The biggest remaining engine. Slices:
- **Courtship / brand application** — the T3 `dossierReady` hook already arms it: verdict-streak
  dossier + multi-signal track record (financial strength / sales record / CSI), brand weighting
  tables, player-initiated application, franchise fee. Act-2 advancement is player-initiated by
  locked design (§12.5).
- **Brand archetypes** — economic archetypes on independent axes (front-gross×volume, service
  annuity, cyclicality) with riders (stair-step goal pressure, credit profile). Fold into the #246
  fictional-brand entity work — one Brand entity serves both the legal swap and the archetype system.
- **NCM + the new-car channel** — allocation, floorplan, invoice/MSRP/incentives, monthly OEM
  goals (gross-vs-volume tension), NCM auto-pricing mirroring the UCM desk. New-car department page.
- **Used desk persists as a department** (Act-1 loop must not become wallpaper — spine + macro-spine §3).

### E2. Tier 5 — High-volume: the BDC `[CSV canon; unfiled]`
Marketing campaigns, lead generation, **appointments injected into coming days as
higher-close-probability customers** (the CSV's core BDC mechanic), `bdc-manager` role, BDC page.
Industrializes the demand-influence levers that exist from T1 (macro-spine §11). Resolve the
fixed-ops-manager fork here: CSV's combined "Bodyshop & Service Manager" vs the implemented
service-manager + body-shop-manager split — adjudicate with the user, update CSV or data.

### E3. Tier 6 — Multi-store: the GM + acquisition loop `[macro-spine §8]`
GM hire → full-store automation scaled to GM skill → unlocks purchasing franchise rights → **new
store becomes the active store** (full hands-on loop, fresh brand/market) while the old store sims
in the background under its GM with digest + escalations + drop-in. This multiplies the Reveal to
store grain and turns the save into a portfolio. Includes the owner's oversight surface (mandate,
digest, escalation).

### E4. Tier 7 — The summit `[macro-spine §8]`
Prestige-brand endgame (ultra-lux courtship with brutal CSI/financial weighting) + cross-store
synergy verbs (centralized BDC, shared inventory) + the group/quarter Reveal. T7 must earn its
separateness from T6 via these new verbs, not bigger numbers.

### E5. Ladder-wide gates
Face activation ladder per §12.4 (T4+ runs all five faces), harness pacing per tier
(`tier-pacing-targets.json`), and the naive-player skill wall at T3→T4 (courtship explains it).

---

## 8. Workstream F — First-session experience (the casual player's front door)

### F1. Onboarding `[FILED #213 — scope grown since filing]`
The filed coachmark flow (read demand → stock to match → START DAY → Reveal) is the spine of it, but
the game has grown more to teach: the morning bet, service annuity ("sell well now, service pays you
later"), parts pars, channel posture. Design as **progressive disclosure tied to unlocks** — teach at
the moment a thing first matters (first service advisor hire triggers the service tutorial beat), not
as a front-loaded tour. Include a persistent "What should I do?" hint entry in the InGameMenu.

### F2. Backstory + difficulty legibility `[NEW]`
Character creation's backstory picks have Day-1 mechanical effects that are never explained — say
what each choice does. Consider surfacing the tier-1 failure stakes ("bankruptcy ends your career at
this tier") the first time cash goes low, so the failure model is learned before it's experienced.

### F3. Notifications-permission moment `[NEW, small]`
If any OS-level notification is ever used (e.g., "your month closed"), ask at a moment of value, not
at boot. If none: explicitly decide none, and the item closes.

---

## 9. Workstream G — Production polish (look, sound, feel)

### G1. Audio + haptics `[NEW — nothing exists; needs your direction before build]`
A premium sim with zero sound reads as unfinished on contact. Minimum finished bar:
- **SFX:** deal-close chime (the Reveal's star moment), cash tick, day open/close, tier-up fanfare,
  escalation ping, UI taps. The Reveal is the anchor — score its wins/losses.
- **Ambient:** light lot/showroom bed per tier (grows subtly with facility scale — self-similar like
  everything else).
- **Haptics:** close/record/tier-up (respecting the a11y toggle).
- Music is a taste call: even a single main-menu theme + tier-up sting covers the premium bar.

### G2. Motion / game-feel pass `[NEW]`
The Reveal deserves staging (stars land one by one, scoreline counts up); tier-up ChapterCard,
gate-verdict stamp, and cash deltas deserve micro-animation. Use RN Animated/Reanimated within the
existing kit; no new pipeline (Lottie/sprite is explicitly outside the design).

### G3. Visual completion
Finish the neo-skeuo rebrand residue (#252 hero header; any un-repainted surfaces), app icon +
splash + store screenshots, dark-mode/theme audit through the kit's token system.

### G4. Performance + device pass `[NEW]`
Real-device (Expo Go tunnel) verification of the floor sim at speed on mid-range Android; day-loop
frame budget; SQLite save latency at v16 envelope size; memory over a long session. File and fix
what falls out.

---

## 10. Workstream H — Ship gates (release checklist)

1. **Fictional brands** `[FILED #246]` — the hard legal gate. One canonical Brand entity keyed by
   opaque id, swapped through `data/vehicles.json` + `brand-tiers.json` + everything grown around
   the strings (tests, saves, tunables). Do it before E1 grows the brand system further —
   every week it waits, the swap gets bigger.
2. **Doc truth** `[#209 + drift]` — spec-condensed reconciled (saves, departments, module map).
3. **QA sweep** — full-suite green, the #317-style cross-department persistence capstone extended to
   every new tier's modules, replay-determinism holds (per the FloorSim determinism constraint:
   checkpoint/resume scope, not fresh-world re-run).
4. **Store readiness** — EAS production builds both platforms, TestFlight/Internal-Testing round,
   privacy policy (no data leaves device — say so), store listing copy/assets, age rating.
5. **Final calibration confirmation** — one post-content #286 verification run + the #74-style felt
   playtest on the release candidate.

---

## 11. Tunables ledger (what the calibration campaign owns)

All placeholder today; all resolved by C2 (#286) with the balance harness, in this grouping:

| Group | Files | Placeholder status |
|---|---|---|
| Manager act-gates + drift | `tunables.json#managerGates`, `#executionDrift` | All thresholds placeholder |
| Skill growth | `staff-skills.json` (growth_counter, cap_headroom) | Placeholder |
| Staff economics | (new — from C1) salary/hire-cost/scarcity | To be authored in staff-teeth |
| Pricing/demand | `demand-elasticity.json`, `demandShaper` blocks, `intel-precision.json` | Placeholder |
| Trades | `customer-current-vehicle.json` (financing/deepTailWeight), trade tunables | Shape locked, tails placeholder |
| Service | `service-*.json`, `tunables#serviceInsights`, parts/supplier tables | Placeholder |
| Body Shop | `bodyshop-demand.json`, `tunables#bodyShopInsights`, channel margins | Placeholder |
| Discount/escalation | `staffDispatch.discountEvent` | Placeholder |
| Tier pacing | `tier-gate.json` vs `tier-pacing-targets.json` | Targets authored (user); thresholds unverified |
| News/shocks | (new — from B3) frequency/severity/reliability | To be authored |
| Audio/haptic intensity | (new — from G1) | To be authored |

---

## 12. The build order (one commit sequence — nothing here is optional)

Rationale: unblock what's built → complete the loop's missing pillar → give decisions teeth → tune →
teach → climb the ladder → polish → ship. Fun-critical work front-loaded; each phase ends playable.

| # | Work | Why here |
|---|---|---|
| 1 | **A1 advisor hiring + promotion wiring** (+A3 issue hygiene) | Two profit centers for one seam; everything downstream assumes T2/T3 run |
| 2 | **A4 silent-system surfacing** (#267, #187, #179, manager status, recovery states, indictment producers) | Cheap legibility while the loop is fresh |
| 3 | **B1 Reveal ranking + records** | Finishes the shipped tracer's felt quality |
| 4 | **B3 news/adverse-events engine (#176–#179)** | The last loop pillar; the Reveal is waiting for it |
| 5 | **C3 playtest gate (#74), round 1** | First "is it fun yet" check with the whole T1–T3 loop alive |
| 6 | **C1 staff-teeth grill + build** | The last ungrilled core mechanic; prerequisite for honest numbers |
| 7 | **A2 staff slots / facility scale** | Lands naturally on staff-teeth's roster surface |
| 8 | **C2 calibration campaign (#286 + #180/#181)** | Tune once, after costs are real |
| 9 | **B2 F&I plug-in #2** (+#151–#153) | Proves the Reveal spans to monthly verdicts |
| 10 | **D1 People + Finance + Growth dashboards** (chart kit first) | Content now exists for all three rooms |
| 11 | **B4 drive-the-clock** (absorbs #124) | The zoom verb, ready before the ladder grows |
| 12 | **F1 onboarding (#213) + F2 + D3 plain-language pass** | Teach the now-complete T1–T3 game |
| 13 | **H1 fictional brands (#246)** | Before the brand system grows in E1 |
| 14 | **E1 Tier 4 — OEM engine, courtship, NCM, brand archetypes** (+ its Reveal grain, gate faces, pacing) | The ladder resumes |
| 15 | **E2 Tier 5 — BDC** (+ fixed-ops-manager adjudication) | |
| 16 | **E3 Tier 6 — GM automation + multi-store** (+ store-grain Reveal) | |
| 17 | **E4 Tier 7 — prestige + synergy endgame** (+ group-grain Reveal) | |
| 18 | **E5 ladder-wide gate/pacing verification** | Harness across all seven tiers |
| 19 | **G1 audio/haptics + G2 motion pass** | Feel, once all beats exist to score |
| 20 | **G3 visual completion (#252, icon/splash/store) + D4 a11y (#268)** | |
| 21 | **G4 performance/device pass** | |
| 22 | **H2–H5 ship gates: docs, QA capstones, store readiness, final calibration + playtest** | Release |

Items marked `[NEW]` (A2, D3, F2, F3, G1, G2, G4) are this audit's proposals from the end-user seat —
adopt, reshape, or strike them explicitly; everything else is already agreed design or filed work.
