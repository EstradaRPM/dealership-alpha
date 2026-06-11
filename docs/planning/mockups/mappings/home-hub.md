# Home hub — mechanic-to-surface mapping

**Surface:** `docs/planning/mockups/home-hub.png` — Home / day-cycle hub (managerial-phase launch point).
**Stamp:** 2026-06-10 · `main` @ `1f5d3fc`
**Pipeline:** image → this table → adjudicate residue → file slices. Backs the rebrand's Home presentation slice(s).
**Locked forks honored:** nav = 5 tabs, Floor=mode (`macro-loop-spine.md`); goals = monthly gate, day counted-not-judged (`goals-targets-design.md`).
**Chain status:** #225 kit, #215 shell, #226 tabs all CLOSED — buildable dependents allowed.

## Ignored AI-generation artifacts
- Bottom nav in render (Home/Dealership/Goals/Finance/More) → canonical five: Home·Operations·People·Finance·Growth.
- "Summit Motors / TIER 2 / Regional Dealer / May 16 2024" name+date strings → cosmetic render variance.

## Mapping table

| UI element | What it shows | Backing mechanic (`module.method` / event / `data`, `file:line`) | State | Slice note |
|---|---|---|---|---|
| Dealership name | "Summit Motors" | `TierManager.businessName` `CareerProgression/TierManager.ts:35,87`; rendered `App.tsx:1579` | ✓ Backed | Route. |
| Tier badge | "TIER 2 · Regional Dealer" | `TierManager.currentTier` `TierManager.ts:34`; label `tierData.ts`/`data/tier-progression.json`; `App.tsx:159,1581` | ✓ Backed | Route tier + label. |
| Cash card | "$1,247,503" | `Economy.cash` `Economy/Economy.ts:20,66`; `App.tsx:1523` | ✓ Backed | Route. |
| Cash delta | "+$32,490 vs Yesterday" | — no prior-day snapshot/delta computed | **Net-new** | Tiny: snapshot prior-day cash at day-close, diff. |
| Reputation card | "87 / 100" | `Reputation.reviewScore` `Reputation/Reputation.ts:21,110`; `App.tsx` header | ✓ Backed | Route. |
| CSI label band | "Very Good" | — no 0-100 → label bucketing | **Net-new** | Tiny: band table in `data/` (Poor/Fair/Good/Very Good/Excellent). |
| Calendar — day | "Day 42" | `GameClock.currentDay` `GameClock/GameClock.ts:18,62`; `App.tsx:1396` | ✓ Backed | Route. |
| Calendar — week/month/qtr/season | "Week 7 · Month 2 · Q2 Spring" | `GameClock`: `DAYS_PER_WEEK=7` `:37`, `daysPerMonth` `:59`+`data/tunables.json`, `currentSeason` `:20,64` | Partial | Derive labels from clock; no Q-of-year today (derive from month). |
| Calendar — in-game date | "May 16, 2024" | — no day→calendar-date map | **Net-new** | Flavor only; recommend CUT. |
| Calendar — weather | "72° · Clear" | — no weather mechanic anywhere | **Net-new** | Weather is a deferred/locked fork; recommend CUT this slice. |
| Calendar — sold this month | "16 / 10" | — no monthly units counter or monthly target | **Net-new (gate)** | Part of the monthly tier-gate engine (see TARGETS). |
| START DAY button | enters floor mode | `handleNextDay()` `App.tsx:1021` → `world.dayLoop.nextDay()` `DayLoopController.ts`; label swaps Open Floor/Next Day `App.tsx:1588` | ✓ Backed | Route existing pinned action. |
| Quick-stat — pending leads | "18" | `DepartmentQueue.getQueue('sales').length` `DepartmentQueue.ts:5`; badges `App.tsx:1542` | ✓ Backed | Route badge count to Home strip. |
| Quick-stat — appointments | "7" | `DepartmentQueue.getQueue('bdc').length` `DepartmentQueue.ts:5` | ✓ Backed | Route. |
| Quick-stat — inventory count | "128 · 12 new" | `Inventory.getLotVehicles().length` `Inventory/Inventory.ts:45,468`; `App.tsx:1419` | ✓ Backed | Route count; "new arrivals" sub-count is Partial (not separately tracked) — show count only or derive. |
| Quick-stat — in service | "16 · 3 waiting" | `DepartmentQueue.getQueue('service').length` `DepartmentQueue.ts:5` | ✓ Backed | Route count; "waiting" sub is Partial. |
| Quick-stat — % on track | "91%" | — depends on gate pace projection | **Net-new (gate)** | Drop until gate engine exists. |
| Dept tile grid | Sales·Inventory·Finance·Service·Marketing·Staff·Reports (2-col) | parallel nav layer; each maps onto a locked tab (Sales/Service→Operations, Staff→People, Finance/Reports→Finance, Marketing→Growth) | **Mismatch** | Duplicates the locked 5-tab nav. Collapse — Home is a dashboard, not a 2nd nav. Inventory placement = adjudicated below. |
| TODAY'S TARGETS bar | Retail Units 3/5, Gross $12k/$18k, CSI 87/95, $ 4.2k/5k + bars | KPI daily aggregates exist (`KPIDashboard.getSnapshot()` `KPIDashboard.ts:119`, `grossToday` `App.tsx:405`) but **no daily target object** | **Mismatch + Net-new** | Daily-judged targets contradict locked goals (day *counted*, not judged). Reframe → monthly-gate progress (decision 1+3). Gate engine is upstream net-new. |
| TARGETS countdown | "Results in 16:18:32" | `FloorSim.currentTick`/`ticksPerDay` → close-hour `App.tsx:1397` | ✓ Backed | Day-close countdown is real; re-label (it's time-to-close, not "results"). |

## Residue — ADJUDICATED 2026-06-10

1. **Inventory placement** (user's explicit ask) → **Operations sub-surface**, NOT a Home tile and NOT a 6th tab. Reasoning from long-term scope:
   - Inventory/pricing is a **per-store operational** surface whose altitude **rises in place**: per-car pricing (T1) → pricing *policy/dial* once the SM absorbs it (T4) → delegated-with-override + background-store in the multi-store endgame. Operations is the stable nav home for "running *this* store"; the surface's *contents* change altitude, its *location* doesn't.
   - **Multi-store (one active):** Home becomes active-store / empire-level; inventory is per-store, so it must live in per-store Operations.
   - **Home-base (spine §9) preserved correctly:** "never locks away" = the Operations→Inventory surface stays reachable for manual override, NOT that pricing is pinned to Home.
   - **T1 micro-loop pull preserved without hard-wiring:** Home carries a *contextual pre-open inventory nudge* (the 128-units quick-stat + e.g. "12 unpriced" / "lot thin on SUVs") that deep-links into Operations→Inventory. Prominent early, fades as it delegates; Home never structurally depends on a verb that goes away.
   - **Dept-tile grid → collapsed** (mismatch with locked nav). Home is a dashboard, not a 2nd nav.
   - The full Inventory/pricing **surface** = the separate `inventory.png` `/map-mockup` slice; this decision is its locked input.

2. **TODAY'S TARGETS → monthly-gate progress** (mismatch resolved per goals-targets-design.md). The daily-judged bar is reframed to the **monthly gate**, daily contribution *ticking it up* (decision 1). Each face in its **native idiom** (decision 3): units & gross = **pace** (`X / target`, on-pace `N/day`, projected month-end landing, units-to-catch-up — *over pace shows the cushion/projection, never "sell 0"*); CSI = trend sparkline; cash = gauge vs threshold. The user's "suggest sell Z today" = the **units-to-stay-on-pace** readout, framed as an honest pace *fact the player reads* (decision 2 — no coach, no imperative). Requires the **monthly tier-gate engine** as an upstream mechanic slice (locked design → ready, no grill).

3. **Weather — NOT cut. Locked mechanic (fork 3, grill 2026-06-09):** real demand input — season→mix, daily-weather→volume, seeded/replay-safe, with a forecast. It is a **non-player baseline producer on #197's influence-input seam** (sibling to the reserved advertising producer), so it depends on #197. Upstream mechanic slice; Home calendar card surfaces today's weather + forecast once it lands.

4. **In-game date — BUILD it.** User wants a real calendar date + **mini-calendar / date view** (running "Day N" total kept too). Trivial derivation: GameClock already has `currentSeason` + `DAYS_PER_YEAR=364` (4×91). Day→(season/month/date) map + mini-cal visual folds into the status-dashboard slice.

Everything else is ✓ Backed or a tiny derived addition (cash delta, CSI band, week/month/qtr labels) → routed in the status-dashboard slice. **Appointments** quick-stat depends on the unbuilt appointments mechanic (fork 4, `bdc-rep` role) → deferred; **% on track** depends on the gate engine → lands with the gate-progress strip.

## Filed slices (build order)
- **P1 `UI rebrand S3a` — Home status dashboard + calendar + START DAY** (buildable now; deps #225/#215/#226 closed).
- **M1 — Weather demand mechanic + Home calendar weather readout** (dep #197).
- **M2 — Monthly tier-gate engine** (locked goals design; pace/projection/4-band).
- **P2 `UI rebrand S3b` — Home monthly gate-progress strip** (dep M2; reframes TODAY'S TARGETS, adds %-on-track + sold-this-month).
