# GAME VISION SPEC — Dealership Simulator (adaptation brief for Android: Kotlin + Compose + Firestore)

**Provenance.** Derived from `CLAUDE.md`, `docs/spec-condensed.md`, `docs/planning/*` (macro-loop spine, pricing-demand spine, engagement spine, staff-teeth, second-level IA), every `src/game/*/CLAUDE.md`, and the numeric tables in `data/*.json` (paths cited in brackets). Numbers marked **(placeholder)** are tagged in the repo as awaiting its calibration pass (#286). Anything marked **(inferred)** is my reading, not a repo statement. Tiers 4–7 are designed but **not yet built in the repo**; I say so wherever it matters.

---

## 1. Core Vision, Player Fantasy & Game Loop

**What it is.** A premium, single-player, niche, DMS-realism dealership *management* sim (real F&I products, real loan math, real KPIs: PVR, F&I PPRU, days-in-inventory, CSI). Fictional marques (Corden, Chevreau, Toraya, Vanda, Ravon, Messan, Sabaro…) [`data/brands.json`].

**Versus a buy-fix-sell flipper:**
1. **You manage a store, not a car.** Customers are simulated *for* you. You set bets and policy in a "managerial" phase, press START DAY, and *watch the floor resolve*. You are interrupted only by exceptions (discount stalemate, unusual trade, recon surprise, raise/rival-offer prompts).
2. **Delegation = permission, not amputation.** Each hire absorbs a layer of your job and raises your altitude: price a car → set a pricing *policy* → set a portfolio *posture*. The manual surface (e.g., browsing the auction yourself) is never locked away [`macro-loop-spine.md` §2, §9].
3. **Demand is a heat map, not a queue.** Per-vehicle-type heat × your price posture drives who walks in, so there is no static optimal price [`pricing-demand-spine.md`].
4. **Whole-dealership economics:** used sales + F&I back end + Service annuity + Body Shop shock stream, each its own profit center on an accrual P&L.
5. **Failure is tier-aware** and survivable as progression; endings are noir end-cards.

**Tone.** Noir-illustrated narrative beats over a DMS-style work UI; plain-language copy.

**Loop nesting (self-similar: *configure → release → watch it resolve → reap → reinvest*).**
- **Minute-to-minute (FLOOR_OPEN).** 180 logical ticks/day by default (hours-of-operation lever: 120/180/240) [`tunables.floorSim`, `ownership.hoursOfOp`]. Per tick: spawn arrivals → capacity admit/walk → department drains (salespeople work customers) → `floor:tick`. UI speed controls are render-only.
- **Day (two states).** MANAGERIAL (lot closed: recap, read demand/weather forecast/news, bid at auction, set prices, hire, set levers) ↔ FLOOR_OPEN. Boots in "night before Day 1".
- **Overnight order (fixed):** `day_ended → payroll+rent → inventory arrival → reputation drift → follow-up decay → day_started`, then `week_ended` (every 7th day) and `month_ended` (every 30th) [`GameClock/CLAUDE.md`].
- **"Bite" clock.** Player picks Run Day / Week / Month. Week requires the used desk to cover *both* discount desking and trade approval; Month requires a GM [`ClockBite`, `clock-bites.json`]. Each bite ends in a "Reveal": ≤2 starred reactions plus a scoreline.
- **Monthly.** Tier-gate verdict (Exceed/Meet/Near-miss/Miss).
- **Long-term.** Tier ladder T1→T7, a career of ~8–9 in-game years (~30 real hours to reach T7) [`tier-pacing-targets.json`]. Endings: bankruptcy/indictment (failure); retire, PE sell-out, family handoff (success).

**Calendar.** 7-day week, 91-day season, **364-day year**; "month" = 30 days [`GameClock.ts`, `tunables.clock`].

---

## 2. Core Entities & Data Model

| Entity | Key fields / enums |
|---|---|
| **VehicleTemplate** [`vehicles.json`] | `id, brand, model, trim, yearRange, basePriceRange, mileageRange, category ∈ {sedan, truck, suv}`. Only **10 templates**; ICE only. |
| **LotVehicle** | template refs, `year, mileage, condition ∈ {clean, average, rough}`, `purchasePrice`, `reconEstimate` (visible) vs `reconRealizedCost` (hidden), `reconCost` (running sunk), `reconStatus ∈ {in_progress, paused_for_decision, complete, abandoned}`, `reconBucket ∈ {within, minor, major, catastrophic}` (hidden lemon tail), `suggestedRetail`, `askingPrice`, `arrivalDay`, `frontlineDay`, `daysInInventory`, `carryingCostToDate`, `dailyCarryingCost`, `aged`, `sourceId`. |
| **AuctionListing** | `sourceId`, price, condition report text, `inspectionStatus ∈ {none, pending, completed}`, inspection band. Sources have **hidden per-save reliability** rolled from the seed [`auction-sources.json`]. |
| **Hidden attributes** | Recon variance bucket, source reliability, lemon-law exposure. SPACED vector per vehicle (see Sales). |
| **Customer (Person + Visit)** | Person archetypes: `young_family, enthusiast, commuter, retiree, tradesperson`; wealth, credit score, income, `int`, agreeableness; traits (`price-sensitive, shops-around, skeptical, easy-to-sell, impatient, brand-loyal, luxury-seeker, truck-buyer`); payment traits `cash-buyer / must-finance`. Visit: preferences μ/σ over six **SPACED axes** (safety, performance, appearance, comfort, economy, dependability), trust/patience resources, `paymentMethod`, `hasTrade`, `currentVehicle` (with `loanPayoff`), `allowanceAsk`. 1–2 axes are **nonnegotiable** (60%/40%), others want/pass 50/50. |
| **Customer stages** | `UNGREETED → GREETED → QUALIFIED → DEMOED → NEGOTIATING → F&I → DELIVERY → CLOSED`; walks go to a **follow-up pool** with `heat` (decays 0.20/night). Live resolution runs gates GREET/QUALIFY/DEMO/NEGOTIATE. |
| **Staff** | Roles (tier worker/customer-facing/manager/gm): `lot-porter, salesperson, technician, service-advisor, body-shop-advisor, used-car-manager (UCM), f&i-manager, new-car-manager, service-manager, body-shop-manager, bdc-manager, gm`. Fields: `skills{}` (0–100), traits (charisma, ego, aggressiveness, transparency, closer), `stamina`, `counters{days_employed, deals_closed}`, `paidGrade 1–5`, `paidWage`. Derived: effectiveness/trustworthiness composites, grade, effective skill. |
| **Rival dealer** | `id, brand, personality, price_point, rep, inventory, pricing` with clamp bounds; six archetypes (volume_dealer, boutique_dealer, aggressive_discounter, premium_csi_dealer, volume_leader, marginal_survivor); weekly stat drift [`competitors.json`]. |
| **Facility** | `built{lotSpaces, serviceBays, bodyBays}`, in-flight `ConstructionJob{kind, units, completesOnDay}`, tier ceilings. |
| **Finance** | Ledger entry `{day, label, amount, category?, profitCenter ∈ {sales, fni, service, bodyshop, store}, nonCash?}`; `CreditFacility{limit, drawn, interestPaidToDate}`; credit tiers A–D; Deal `{agreedPrice, frontGross, productGross, reserveGross, apr, buyRate, term, creditTier, tradeAllowance}`. |
| **Market state** | per-segment `segmentHeat = personalityBias + compDrift + shockMod`; comp window; active shocks; news ring buffer; weekly report; DemandShaper heat mix; weather per day. |
| **Installed base** | one `OwnerRecord` per car sold: `loyalty, csi, powertrain, bad-visit and missed-return counters, repeatLeadEmitted`. |
| **Parts** | categories (oil_filters, tires_brakes, drivetrain, electronics; body: windows_glass, doors_panels, interior_trim, paint), stock, reorder point/target, supplier tier. |
| **Career** | tier, `monthStreak`, `dossierReady`, backstory, branding (name, accent, font), records (7), teaching-progress set, slot settings (trade policy, pricing strategy, sourcing lean, F&I posture). |
| **Events** | Typed pub/sub catalog (~1,350 lines, `EventBus/events.ts`): `clock:*, deal:closed, staff:auto_resolved, trade:*, discount:escalated, inventory:*, market:shock_*, news:headline_published, tierGate:month_verdict, career:*, records:broken`, etc. |

---

## 3. Simulation Engines & Exact Mechanics

### 3.1 Sourcing & Acquisition
- **Auction board** is generated the night before (`clock:managerial_prep`). 6–10 listings/day; **days 1–5: 12–18** [`vehicles.json auctionConfig`]. Brand draw weighted by market share.
- **Price:** `listing = anchor × motivatedSeller`. Multiplier mean **0.85**, stdev lerped **0.05 (honest source) → 0.18 (unreliable)**, clipped [0.55, 0.95]. Symmetric with wholesale-out (book × 0.85) so buy-and-dump is ~flat minus recon [`tunables.marketEconomy.motivatedSeller`].
- **Sources (hidden reliability per save):** Keystone Digital 0.75–0.95, Crossroads Regional 0.60–0.85, Estate Close-Outs 0.50–0.80, Independent Consignment 0.45–0.75, Repo Lane 0.25–0.55.
- **Paid inspection:** $250, 1 day; reveals realized recon ±5% [`tunables.inventory.inspection`]. Buying while pending is refused; completed listings expire after one more day.
- **Hidden flaws (recon variance)** [`recon-variance.json`]: realized = estimate × bucket. Base probs: within 85% (×0.9–1.1), minor 10% (×1.1–1.3), major 4% (×1.3–1.75), catastrophic 1% (×2–4). Tail probs scale by condition (clean ×0.5/0.2/0.1; rough ×1.5/2/3), source reliability (≥0.70 ×0.5/0.5/0.3; <0.50 ×2/2/2.5) and mileage >150k (×1.5/1.8/2.0). The deterministic roll is seeded by `(masterSeed, vehicleId)`, so inspection and purchase agree.
- **Trade-ins** arrive through the sales flow (§3.4). Same recon machinery, with staff read-confidence standing in for source reliability.
- **Lot cap:** buying requires `occupancy < builtLotSpaces` (prep cars count). Trades always land, even over the cap. A **wholesale release valve** pays `book × 0.85` for any unit [`tunables.inventory.wholesale`].
- **Frontline hold:** acquired units are hidden from walk-in matching for 2 days.
- **UCM auto-sourcing** (act-gate `condition_reading ≥ 60`): scores each listing on margin / condition / demand-fit by the player's "sourcing lean", buys greedily while score ≥ 0.45 and cash stays ≥ $5,000 above reserve, with skill-scaled mis-perception drift [`sourcing.json`].
- **Opening lot:** three seeded, recon-complete units (SUV ≈$15k, truck ≈$18k, sedan ≈$12k retail ±18%).

### 3.2 Reconditioning, Repairs & Customization
There is **no parts/mod/customization crafting layer for sales inventory**. Recon is a *time-and-money process*, not a minigame:
- Budget = `value × reconPct` (clean 4% / average 9% / rough 16%).
- Daily spend = `realized / reconDays` (clean 3, average 5, rough 7 days). A car can still be retailed mid-recon; that is the lemon-law risk below.
- If sunk > `1.2 × estimate` on a tail-bucket car, recon **pauses** and fires `inventory:recon_surprise` with flavor text. Player chooses **authorize** or **abandon** (wholesale at `book − spentToDate`).
- Selling a major/catastrophic lemon *before* recon completes emits `regulatory:lemon_law_incident` (+15 indictment pressure).
- Founder bonus "Ex-Mechanic" lifts recon source-reliability by +0.15.
- Parts logistics exist only for Service/Body Shop (§3.6).

### 3.3 Valuation, Economy & Market Dynamics
```
anchor     = baseAnchor(template) × yearCurve × mileageCurve × conditionMod
bookValue  = anchor × (1 + segmentHeat)
marketPrice(benchmark) = round(bookValue × markup)
```
- **Curves** [`market-depreciation-curves.json`]: linear with floors. Year rate/yr and floor: sedan 8% / 0.45, truck 6% / 0.55, suv 7% / 0.50. Mileage per 10k miles above 36,000 and floor: 2.2% / 0.55, 1.2% / 0.65, 1.7% / 0.60. Reference year 2024. Condition ×1.05 / 1.00 / 0.88.
- **Anchors** run $11,750–$21,500 across the 10 templates [`market-anchor.json`]. **Markup** by category × brand-tier is 1.30–1.38, with economy highest [`market-markup.json`].
- **segmentHeat** = per-save personality bias (±4–5%) + comp drift + shock modifiers. Drift is the damped (0.5) weighted mean of `(realized/reference − 1)` over a 40-comp, 90-day window per segment (retail weight 1, wholesale 0.5, competitor 0.3).
- **Shocks** [`market-shocks.json`]: 3%/day arrival probability, max 3 concurrent, 14–90 day durations, magnitudes ±1–12%. Examples: OEM truck/SUV recall, fuel spike (trucks/SUVs down, sedans up), auction supply crunch, credit pullback, sedan oversupply, factory incentive push, model-year changeover.
- **News wire** (3 reliability tiers): *direct* (already happened), *leading* (analyst call 4 days ahead of a real shock; 50% hit, 6%/day false alarm), *lagging* (confirms moves). Cap 3 headlines/day; a Monday weekly report adds fallible forward calls (60% hit). Paid feeds cost $25–45/day from T2 [`news-progression-gating.json`].
- **Price→demand (one shared model):**
  `demandMultiplier = exp(−6.93 × (ask/market − 1)) × exp(2.0 × heat)` (symmetric above/below). The ask/market-relative reading is **(inferred)** from the stated calibration: +20% ≈ 4× slower, −10% ≈ 0.5× [`demand-elasticity.json`]. It feeds both predicted days-to-sell (baselines sedan 28 / truck 35 / suv 32 days) and floor arrivals.
- **Arrivals:** `expected = 8 × (1 + 0.8·rep) × (1 + 1.5·marketShare) × season × demandFactor`, per-tick p = expected/ticks. Season ×1.00 / 1.15 / 1.05 / 0.85. `demandFactor` composes inventory depth × quality (half-saturation 12 cars, clamp 0.6–1.3), weather volume (clear 1.12 → storm 0.55), and price posture; max 3.
- **Weather** (5 conditions, seasonal weights) also skews *what* people want (winter → winter-capability).
- **Heat bands:** hot 1.15, cold 0.85. Ads: radio ($75/day, lag 3), "We finance anyone" ($110), CPO push ($130) skew segments *and* buyer archetypes [`tunables.demandShaper`].
- **Pricing strategies:** Aggressive (market ×1.06, min markup 8%), Market (×1.00, 7%), Value (×0.95, 4%). Price-position bands: fire-sale <0.90, below <0.97, at <1.03, above <1.10, else wishful.
- **Intel precision:** no UCM → 3-band heat read, ±12% suggestion band, ±50% days range; a sharp UCM (`pricing` → 70) → 5-band numeric, ±4%, ±15% [`intel-precision.json`].

### 3.4 Sales, Negotiation & Deal Structuring
**Match.** Filter the lot by affordability and nonnegotiables, then argmax of `wantAxisFit·W − pricePenalty·priceSensitivity + brandReputation·0.15 + weatherLean`. No fit → walk (`no_fit`; ~71% of walk-ins at T1 in calibration).

**Gates** (GREET → QUALIFY → DEMO → NEGOTIATE) [`sales-process.json`]:
- Per-gate quality `q = clamp(0.6·skill + 0.2·fit + 0.2·ease + jitter)`, seeded jitter band 0.34.
- **Meters.** Trust weights by gate: GREET 1.0, QUALIFY 0.6, DEMO 0.3, NEGOTIATE 0.5. Value gets the remainder: 0 / 0.4 / 0.7 / 0.5.
- **Patience** drains by `(1 − q) × impatience`.
- **Walk priority:** DEMO nonnegotiable miss (hard) → trust < 0.15 → patience ≤ −0.4. A weak QUALIFY (`q < 0.45`) hides the nonnegotiables (blind demo).

**Price (the ask is the anchor):**
```
reservation = marketPrice × max(0, 1.015 + 0.30·Value − 0.30·priceSensitivity)
requiredDiscount = max(0, ask − reservation)
floor = vehicleCost + $800
realized = clamp(min(ask, reservation), floor, ask + $1,500)
objectiveDeal = clamp((1−s)·Value + s·priceSatisfaction + framing, 0, 1)   (s = price sensitivity)
```
Buy if `objectiveDeal ≥ 0.35`. A low-trust (<0.38) forced buy yields `badReview`. If the customer would only buy below the floor, the **discount escalation** branch fires.

**Discount event.**
- A UCM with `t_o_closing ≥ 60` auto-resolves all of them. Otherwise 20% surface to the player and the rest walk.
- Modal: our ask, customer target, and the salesperson's failed counter `lerp(target, ask, NEGOTIATE skill)`.
- Choices: accept-at-target (guaranteed) / accept counter / propose counter / decline.
- Each customer tolerates 1–3 counters by agreeableness; each rejected counter cools the next roll by 0.15.

**Trades.**
- Customer ask = `book × N(1.0, 0.15 clipped 0.6–1.5) + max(0, payoff − book)`. Loan payoff = `book × clamp(LTV₀ × remainingPrincipal ÷ depreciation)`, so negative equity is mild-majority with a rare steep tail.
- Staff target = `book × policy(0.92/1.0/1.1) × (1 + (1 − readConfidence) × 0.15 + drift)`.
- Decision: accept if ask ≤ target; counter if within 25% (manager window 60%); otherwise decline or counter by skill.
- *Routine* = gap ≤ 25% and overhang ≤ 10%. Otherwise escalate to GM, then a gated UCM (`condition_reading ≥ 60`), then the player (ask ≤ $25,000 default override).
- Customer accepts a player counter with probability `1 − gapFraction × 2.0 × (1 + priceSensitivity)`.
- The **allowance moves cash only** (category `inventoryAcquisition`); revenue stays the full selling price.

**Financing** [`credit-tiers.json`]:

| Tier | Min score | Buy rate | Max markup | Max term | PTI cap | Min down | LTV ceiling |
|---|---|---|---|---|---|---|---|
| A | 720 | 5.9% | 2.5 pts | 84 | 20% | 0% | 1.25 |
| B | 680 | 8.9% | 2.25 | 75 | 17% | 5% | 1.20 |
| C | 620 | 12.9% | 1.75 | 72 | 15% | 10% | 1.10 |
| D | <620 | 18.9% | 1.0 | 66 | 13% | 20% | 1.05 |

- Affordability gate order: down → PTI → LTV. The payment is built at `buyRate + markup`, so over-marking automatically prices buyers out.
- **Reserve** = 75% of the PV difference between customer-rate and buy-rate payment streams (amortization-correct, not a % of principal).
- **F&I posture dial** (one standing choice, needs an F&I manager; otherwise ambient 0.75 pts): More-per-deal 2.5 pts / Balanced 1.75 / More-deals 1.0.
- **Teeth.** *Fall-through* = `0.35 × clamp01((markup − frontier)/1.0 pt)`, where frontier = 1.75 + up to 0.75 × (`finance_structuring`/100). *CSI drag* = `−1.5 × clamp01((markup − 1.75)/1.0)` satisfaction. The monthly **verdict** checks the financed-share band the posture bet on.
- **Products** (attach = `base × skillMult(0.4–1.1) × loanFactor`): VSC $1,495/cost $495 (55%), GAP $695/$195 (45%, financed only), T&W $795/$250 (30%), Etch $299/$50 (25%), Prepaid Maint. $895/$300 (35%), Key $395/$95 (40%). The last four require an F&I manager.
- **Fraud flag:** a financed deal whose F&I products exceed 35% of price is payment-packing (+25 indictment pressure) [`deal-fraud.json`].

### 3.5 Finances, Risk & Operations
- **Start:** $50,000 cash. **Rent** $1,200/week. **Payroll** is a daily wage by role × grade (§3.6).
- **Carrying cost** per car per day = `book × floorplanAPR/365 + $5 insurance + $8 overhead + $3 recon-fade` (after recon). Floorplan APR: T1 9%, T2 7.5%, T3 6%. Flag *aged* after 45 days. Posted via `forceDebit` so cash can go negative.
- **Accrual P&L.** Buying cars/trade allowances/credit draws are balance-sheet moves (no P&L effect). The **cost of sale** is relieved on exit at `purchasePrice` only. Invariant: `Σ dept gross − overhead = net income`. **Store worth** = cash + stock cost basis − credit drawn.
- **Credit line** (Ex-Banker founder: $50,000; others 0): draw/repay in 25/50/75/100% steps. Interest is `drawn × 14%/365` charged each morning on the opening balance. Never forced.
- **Failure ladder** [`failure-tunables.json`]:
  - *Cash* < $0 for 7 consecutive nights. T1 → terminal; T2 → contraction with $50k debt overhang and $2k/week payments; T3+ → $30k compliance cost and −15 reputation. Warning at < $12,500.
  - *Regulatory meter* (0–100): walk 0.05, missed opportunity 1.0, anger 0.4, decay 1.5/day. Audit warning at 60; AG complaint at 80 (T2 14-day suspension; T3+ $75k and −25 rep).
  - *Indictment pressure* (threshold 50): lemon-law +15, audit failure +20, fraud flag +25. T1/T2 → terminal or $100k stake loss; T3+ → $250k defense and −40 rep.
- No explicit bailout beyond the credit line, T2 contraction and T3+ consent-decree costs.

### 3.6 Staff, Facilities & Automation
- **Slots per role per tier** (monotonic) [`staff-slots.json`], T1…T7: salesperson/porter 1,2,3,6,10,10,10; technician 0,1,1,2…; service advisor 0,1,1,2…; body advisor 0,0,1,2…; UCM and F&I manager 0,0,1,1…; NCM 0,0,0,1…; service/body/BDC manager from T5; GM from T6. Hire is gated by `hireTier`.
- **Pay** [`staff-pay.json`]: grade bands on the 0–1 composite ratio at 0.32 / 0.46 / 0.60 / 0.76. Salesperson wage per day by grade: $150 / 230 / 340 / 520 / 780. UCM $280–970. GM $500–1,700. Hire fee = 5 × daily wage.
- **Growth.** `effective = clamp(base + growth_rate × counter, base, perHireCap)`, where cap = `min(100, base + max(0, N(15, 8)))` (hidden ceiling). Counters accrue overnight only (`deals_closed` → pricing/closing; `days_employed` → condition reading).
- **Raises:** `currentGrade > paidGrade` triggers a request each morning. Accept → wage rises (+6 morale); refuse → 7-day cooldown (−12 morale).
- **Rival offers:** daily 4% × grade/5, wage ×1.2, 3-day deadline. "Match" or "Let them go" (they quit).
- **Morale:** start 70, ceiling 95, floor 5; <30 risks 15%/night quit; paid-below-market −4, at-market +2, overload −5.
- **Delegation gates** (UCM skill ≥ **60** each): `pricing` unlocks auto-pricing, `t_o_closing` unlocks auto-desking, `condition_reading` unlocks auto-sourcing and trade approval. Above the gate, drift off the player's setpoint shrinks with skill: max 8% / 25% / 10% at `skillReference` 90. *Advice* (intel, appraisal reads) is free on hire; *acting* is earned.
- **Facilities** [`facility.json`], T1…T5: lot spaces 6/12/35/75/120; service bays 2/4/6/6/6; body bays 0/0/3/5/7. Built capacity is separate from the tier ceiling. Construction: lot $3,000 per 5 spaces (2 days); service bay $40,000 (3 days); body bay $55,000 (3 days). **Facility score** = mean(built/ceiling) over kinds with a nonzero ceiling.
- **Service** (T2+) [`service-demand.json`]:
  - An *installed-base annuity*. Owners return every 120 days (ICE) / 150 (hybrid) / 240 (EV), with job mix oil 50% / tires-brakes 28% / drivetrain 13% / electronics 9% (revenue $80 / $300 / $750 / $350) that drifts with vehicle age.
  - Capacity = `min(bays, advisors)`. Auto-resolve rate 40–92%, max wait 60 ticks.
  - **Price posture** dial: ×0.85 (competitive) to ×1.35 (premium). A posture above 0.66 counts as gouging (loyalty/CSI −0.06; reputation −1).
  - Owners defect after 3 bad visits or 4 missed returns. Loyal owners (≥0.6) age out after 1,460 days as warm repeat-buyer leads.
- **Body Shop** (T3+): a stochastic *collision shock* stream. Weather multipliers: rain 1.8, snow 3.2, storm 4.5; winter 1.4. Channel split: insurance (steady, rate cap 0.82, damped) vs retail (lumpy, ×1.15 margin, player-priced). Jobs: glass $450, panels $1,400, trim $700, paint $2,200.
- **Parts:** supplier tiers economy ×0.85 / 7 days / 80% reliable; standard ×1.0 / 4 days / 92%; OEM ×1.25 / 2 days / 98%; rush ×1.6 / 1 day / 99%. A job waits on a missing part.

### 3.7 Reputation, Reviews & Narrative/Random Events
- Two store scalars: **customerSatisfaction** (start 70; pulled toward 50 at 2%/night) and **reviewScore** (start 60; pulled toward satisfaction at 10%/night).
- Inputs: closed deal +3 sat / +1 review; walk −0.12 (charged ~2.6×/day); capacity-gated customer −5; service miss/unserved −3/−4 CSI; F&I over-markup drag.
- Satisfaction feeds arrivals. Day-of-week multiplier (Fri 1.4, Sat 0.7, Sun 0.9) and season also apply.
- **Per-brand standing** ∈ [−1, 1] (+0.05 closed, −0.2 bad review, 2% drift) is *ambient*: it only tilts the match score (×0.15). There is no screen for it.
- CSI bands: Poor <40, Fair <60, Good <75, Very Good <90, Excellent.
- **Founder backstories** [`backstories.json`]: Ex-Mechanic (+0.15 recon judgment), Ex-Banker ($50k credit line), Inheritor (+$25k cash but −10 opening standing).
- **Narrative beats:** tier-up chapter cards; end-card with backstory-specific copy; Reveal reactions ranked by drama weights (match strength 1, gross surprise 1, walk-off pain 1.2, record broken 2, F&I verdict 2.5; crown budget 2); owner interrupts (raise demand, rival offer); desk-order warnings.
- **PrepBet:** the morning wager is the category the lot leans heaviest into, scored against actual wants.
- **Records** (7): best day gross, best month gross, best PVR, best F&I PVR, best streak, best single deal, most units in a day.

---

## 4. Progression, Unlocks & Endgame

**Monthly gate.** Bands: ratio ≥1.1 Exceed, ≥1.0 Meet, ≥0.85 Near-miss, else Miss. The overall verdict is the **worst active face**. To leave tier N, post **N consecutive** Meet-or-better months (a miss resets the streak; verdicts never demote) [`tier-gate.json`].

| Tier | Style | Active faces / targets | Streak | Unlocks |
|---|---|---|---|---|
| T1 Gravel Yard | micro used lot | units 8, cash $60k | 1 | 1 salesperson, 6 spaces, 2 service bays (recon only) |
| T2 Paved Lot | small independent | units 15, gross $30k, cash $150k | 2 | Service dept + advisor, 2nd salesperson, news subscriptions |
| T3 Small Showroom | large independent / CPO | units 28, gross $70k, cash $420k, CSI 75, facility 50 | 3 | Body Shop, UCM, F&I manager, 35 spaces |
| T4 Franchise *(not built)* | single franchise | all five faces | — | OEM courtship, NCM, new-car channel |
| T5 High-volume *(not built)* | — | all five | — | BDC (appointments = higher-close customers), fixed-ops managers |
| T6 Multi-franchise *(not built)* | — | all five | — | GM; "active store" switching; background stores report digests |
| T7 Group *(not built)* | — | all five | — | Prestige brands, shared BDC/inventory synergy; sandbox summit |

- **Act 1 (T1–T3)** auto-advances on streak completion. **Act 2 (T3→T4+)** is player-initiated: the streak is the *dossier*; you apply to a specific brand (OEM weighs financial strength, sales record, CSI) and pay the franchise fee.
- **Brands as archetypes (design):** independent axes of front gross × volume, service annuity, and cyclicality, plus riders (OEM stair-step pressure, credit profile). No single best brand.
- **Car classes today:** sedan / truck / suv, fictional brand tiers (economy / mainstream / luxury). Win conditions are the three success endings: **retire** ($750k cash and ≥8 years), **PE sell-out** (T3+, offers every 90 days; valuation $1.5M + $5k × customers served), **family handoff** (≥15 years and T2+) [`career-endings.json`].
- **Late-game money sinks:** construction, payroll at grade 4–5, floorplan, franchise fees, compliance/legal events, data subscriptions, ads.
- **Leaderboards:** none. Rivals are ambient; there is a "legacy wall" of finished careers (local).

---

## 5. Signature Differentiators ("Soul of the Game")

1. **Price is a real lever with no memorizable optimum.** Ask anchors the close, and one elasticity curve drives both the "predicted days to sell" and actual arrivals, conditioned on live segment heat.
2. **Hidden-truth recon + source reliability.** Unseen per-save auction-lane reliability, a lemon tail, and paid inspection as an information purchase.
3. **Skill-gated delegation with execution drift.** UCM thresholds (60) and drift (8–25%) make automation earned and imperfect; the manual path is never removed.
4. **F&I as a single standing bet with two teeth.** The posture dial trades reserve against fall-through and CSI drag. The peak meter and monthly verdict teach the frontier.
5. **The Reveal / bite clock.** The player chooses Day/Week/Month. The result is ≤2 starred reactions about *your* morning bet, with entities that have fates, not bare metrics.
6. **Staff with teeth.** Hidden talent ceilings, grade-based wages, raise demands, rival poaching in the same prompt, and morale-driven quits.
7. **Tier-aware failure.** The same crisis is terminal at T1, contraction at T2, and a recoverable consent decree at T3+. Surviving is the progression reward.
8. **Annuity + shock departments.** Service is an installed-base loyalty loop that closes back on sales as repeat buyers. Body Shop is a weather-driven shock stream with an insurance/retail channel split.

---

## 6. Information Architecture & Player UX

**Five fixed tabs** (never gated): **Home** (glances) · **Operations** (departments you walk into) · **People** · **Finance** · **Growth** [`nav-tabs.json`, `second-level-ia.md`].
- **Home:** identity header, cash and reputation glances, calendar and weather/forecast, **gate-progress strip**, stat strip, market glance, recap chip, START DAY. Every glance deep-links to its owning room.
- **Operations:** department dock (Lot is the hero tile; Service/Body appear as stood up). Lot room (stock list, occupancy "31 of 35", wholesale sheet), pricing screen (book↔market slider, predicted days, projected gross, strategy, competitor comps), **Auction menu**, Prep (hours of operation, trade policy).
- **People:** roster cards (skills, growth bars, morale, wage), hiring candidates (3 per role), slot board, promotions, raise/rival prompts.
- **Finance:** KPI dashboard (PVR, F&I PPRU, DII, cash/finance split, APR/term/down) with time-range chips and sparklines; departmental P&L; deal history; month-close results; **credit line panel**; store worth.
- **Growth:** demand console (heat map with trend arrows, ads), tier-gate board (five faces in native idioms: flow, level, trend, stepped), facility build.
- **Modes and modals.** Full-screen **live floor** (speed control, running gross, toast on match ≥0.8). Modals: discount escalation (acceptance-% meter, counter pips), trade escalation, recon surprise, day recap, month-close interstitial, Reveal, chapter card, end card. First-time mechanic hints are tracked per save slot.
- **Feedback loops:** toasts, an industry wire panel with trust badges (Confirmed / Rumor / Recap), records crowns, a plain-language leak callout from the day funnel (drove-by → walked-in → engaged → sold), a warning at $12,500 cash. Audio/haptics: none exist.

---

## 7. Unfinished Features, Known Pain Points & Mobile Adaptation Notes

**Not yet built in the repo (design present):**
- **T4–T7:** OEM courtship, brand archetypes, NCM and new-car channel, BDC and appointments, GM automation, multi-store portfolio, prestige endgame. T4 is the active slicing phase [`build-state.md`].
- The **sourcing-lean dial** is a declared standing order with no rendered control (#396).
- Audio/haptics, accessibility screen (#268), and the felt-loop playtest gate (#74) are open. F&I **chargebacks** are noted as a later layer.
- `FloorSim` still exposes a hand-play `grab()` verb and `handPlay` tunables, but the HandPlay UI/event path was removed (#275). Treat it as dead.
- **Powertrain:** the sales catalog is ICE only; EV/hybrid exist only in service cadence tables.

**Balance and consistency issues to avoid copying:**
- Most magnitudes are first-pass **(placeholder)**. Measured live close quality is 28.5% "positive" vs an 85% reference, and a green operator gets 0.5% positive. The repo attributes the gap to Value/stock capacity, not price.
- `softThreshold == buyThreshold == 0.35`, so the "soft buy" quadrant is effectively collapsed.
- The planning CSV disagrees with the locked gate (CSV monthly units 10/25/50 and capital $75k/150k/300k vs gate 8/15/28 units and cash $60k/150k/420k). The macro-loop spine supersedes the CSV.
- Time units are inconsistent: 364-day year vs 30-day months; `tunables.clock.ticksPerDay=64` vs `floorSim.ticksPerDay=180`.
- Competitors are an *ambient heartbeat* with little direct consequence beyond price comps and staff poaching (customer poaching was cut).
- Open design forks: the combined vs split fixed-ops manager (CSV vs implemented), and the monetization model (parked).

**Adaptation guidance.**
- **Keep:** the day loop plus Reveal; ask-anchored pricing with the single elasticity curve; auction with hidden reliability, recon buckets and inspection; F&I posture dial; gate streak; tier-aware failure; staff grades, raises and rival offers; seeded determinism.
- **Simplify for a phone:**
  - Replace the 180-tick live floor with a ~20–30 s accelerated playback, or a pure Reveal.
  - Reduce SPACED to 3–4 axes.
  - Collapse the news wire's trust tiers plus weekly report into one daily headline with a rumor flag.
  - Show recon as one "in recon: N days" state.
  - Present VSC + GAP only in the menu while keeping the reserve math.
  - Drop per-brand reputation (invisible to players anyway), the multi-supplier parts system (use stock/no-stock), and show 4 profit-center bars instead of the full P&L.
- **Firestore/architecture risks:**
  - The repo persists the **whole ledger and deal log unpruned** and snapshots a 22-version world envelope. Firestore's 1 MiB document cap means shard ledger/deals into subcollections (by month) and keep a small `world` doc plus per-module subdocs.
  - Determinism relies on `deriveSeed(masterSeed, namespace, {entity, day})` streams. Port that exact pattern in Kotlin (stable hash plus a seeded PRNG, never `Random()` default) so replays and mid-day resumes match.
  - Keep rules in a pure-Kotlin module communicating via a typed event bus or flow. Persist locally first (Room) and sync after, mirroring the repo's save/driver separation and 2–3 slots plus rolling weekly snapshots (up to 6).
  - Put every tunable in versioned JSON/Remote Config rather than constants, as the repo requires.
