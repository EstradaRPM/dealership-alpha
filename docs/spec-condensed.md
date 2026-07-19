# Spec — Condensed (load-bearing facts only)

> **This doc is for fast lookup. GitHub issue #1 is still the source of truth.** When #1 changes, update this doc in the same commit. If you're answering a "why was this designed this way" question, go to #1 — the rationale is there. This doc captures *what is true*, not *why*.

## What this is

Premium, one-time-purchase, single-player mobile dealership-business simulation for iOS + Android. Day-cycle, decision-driven, sim-medium realism (real F&I products, real loan mechanics, real industry KPIs, A/B/C/D credit tiers, fictional OEM analogues). DMS-realism work UI + noir-illustrated narrative beats. Solo dev, niche audience.

## Tier ladder & build frontier

The game spans the full tier ladder: **gravel yard → paved lot → small showroom → franchise → multi-store group**. Implementation builds tier by tier; the current frontier is **Tiers 1–3**. Higher tiers are **not-yet-built, not cut**. **Multiple independent career saves** (2–3 slots) reached through a New/Continue/Load/Delete start menu, plus a legacy wall of completed careers.

## Tier-aware failure paths

- **Tier 1:** bankruptcy / AG complaint / indictment are **terminal** game-over.
- **Tier 2:** bankruptcy **contracts** the business back to one yard with debt overhang (not game-over).
- **Tier 3+:** most regulatory hits become **recoverable consent-decrees / compliance investments**.

Surviving lower-tier failure modes is itself the progression reward. Failure outcomes produce noir-styled end-cards (name, backstory, year, tier, reason).

## Stack

- React Native + Expo, TypeScript (strict).
- Local SQLite via `expo-sqlite` (only `SaveStore` touches it).
- No backend currently; save layer designed for future cloud-sync bolt-on.
- GitHub Actions CI: typecheck + tests on every push.
- EAS Build for iOS/Android binaries. TestFlight + Google Internal Testing for dev distribution.

## Module map (game-logic, communicate via EventBus)

Original 12 from issue #1:

| Module | One-line responsibility |
|---|---|
| `GameClock` | Day/week/season/year + overnight resolution sequence |
| `CustomerPool` | Generate customers, advance state machine, manage follow-up heat |
| `DepartmentQueue` | Per-department queue, routine-vs-workspace classification |
| `StaffOrg` | Org hierarchy, exception-filtering threshold, hire/fire, morale |
| `Inventory` | Vehicles, days-in-inventory, recon, auction buying |
| `DealEngine` | Sales workspace logic: pricing, F&I, loan structuring, gross |
| `Economy` | Money flows, payroll, rent, marketing, capex, P&L |
| `Reputation` | Satisfaction, reviews, regulatory pressure → demand |
| `CompetitorMarket` | 4-6 named competitors per metro, static-with-drift; ambient market force (price drift + demand heat), not a per-customer snatch (poaching cut — see docs/planning/poaching-cut.md) |
| `CareerProgression` | Tier tracking, failure detection, end-cards, backstory Day-1 mods |
| `SaveStore` | SQLite persistence, weekly rolling snapshots |
| `EventBus` | Typed pub/sub (the only cross-module channel) |

Added during implementation (see each module's `CLAUDE.md`): `CapacityManager`, `FollowUpPool`, `NPC`, `StaffDispatch`, `StaffMorale`, plus `data/` loader. The **shared department backbone** `DepartmentLine` (#311) and its two plugged-in profit centers: **Service** (`ServiceQueue`, `ServiceDispatch`, `ServiceDemand`, `ServiceInsights`, `ServiceMarketing`, `InstalledBase`, `PartsInventory`; composed in `src/serviceDepartment.ts`) and **Body Shop** — the Tier-3 mirror — (`BodyShopQueue` #312, `CollisionStream`, `BodyShopInsights`; composed in `src/bodyShopDepartment.ts`, sharing the dispatch engine + `PartsInventory`). Demand/economy layer: `DemandShaper`, `Weather`, `MarketEconomy`, `TierGate`. Engagement layer: `PrepBet` (the morning wager) and `Records` (#329 — career high-water marks; the game-side source of truth for day gross/units). Save-slot layer: `SaveStore` exposes `createMultiSlotSaveStore` (2–3 slots) alongside the single-slot store + rolling snapshots.

Read the per-module `src/game/<Name>/CLAUDE.md` for public API, events, and data files. The canonical event catalog is `src/game/EventBus/events.ts`.

## UI layer (planned, separate from game logic)

`HomeView`, `DepartmentScreens` (Sales/Service/BDC/Office/Lot), `SalesWorkspace`, `FollowupView`, `KPIDashboard`, `NarrativeBeat` (chapter cards), `CharacterCreation`, `EndCard`. UI **renders state and dispatches actions** — it never reaches into game-logic internals.

## Customer state machine

`UNGREETED → GREETED → QUALIFIED → DEMOED → NEGOTIATING → F&I → DELIVERY → CLOSED`. Walks at any state move the customer to the follow-up pool with a `heat` value. Heat decays nightly; archived when zero. Morning BDC task surfaces hottest. Some archetypes ("I know what I want") skip earlier states.

## Day-cycle anatomy

Queue volume **emerges** from sim state (marketing, reputation, season, day-of-week). Player can "close early" — unresolved customers walk (reputation hit). Overnight resolves:

1. `clock:day_ended`
2. `clock:overnight_payroll`
3. `clock:overnight_inventory_arrival`
4. `clock:overnight_reputation_drift`
5. `clock:overnight_followup_decay`
6. `clock:day_started`

Order matters. New overnight steps slot deliberately.

## Staff & exception filtering

Solo at start (player + default receptionist NPC). Hired staff **auto-resolve routine queue items in their domain** and only escalate **exceptions** to the player. Exception threshold = function of staff skill + role tier. Exception types: VIP, high-dollar, irate, lemon-law threat, audit trigger.

Roles use real industry titles (Salesperson, Service Advisor, F&I Manager, Sales Manager, GSM, Fixed Ops Director, GM, etc.) with role-specific skill stats. Morale responds to workload, pay, recognition, competitor pressure.

## F&I & financing

F&I starts trimmed: **VSC + GAP** only. More products (T&W, ETCH, prepaid maintenance, key replacement) unlock with the F&I Manager hire. Loans model APR, term, monthly payment. Credit tiers simplified to **A / B / C / D**. PVR, F&I PPRU and similar advanced KPIs surface in UI only after GM hire.

## Department unlocks

- Sales — from start.
- BDC follow-up — from start (morning callback task).
- Service — unlocks at Tier 2.
- Full F&I — unlocks with F&I Manager hire.
- Bodyshop — unlocks at **Tier 3** (collision-repair mirror of Service).

## Capacity vs demand

Capacity ceiling = function of facility tier + staff count. Demand emergent. When demand > capacity, missed opportunities flag in queue (greyed/red), reduce satisfaction, hit reputation, reduce future demand. Self-correcting (painfully) if player doesn't hire.

## Competitors

4-6 named competitors per metro, each with personality + price-point identity. Stats drift week-to-week (cheap RNG, no agent simulation). Customer `shop-around propensity` may route them to a hotter competitor pre-purchase. ADR-0001 §10 documents the `market:competitive_pressure` publish contract.

## Persistence & rollback

- **Multiple career saves** — 2–3 independent slots via `createMultiSlotSaveStore`, addressed through a New/Continue/Load/Delete start menu (#186/#194/#195). Each slot carries its own blob, metadata (day/tier), and mid-day checkpoint cell.
- Weekly rolling snapshots **4-6 weeks deep**, managed by `SaveStore` (per-slot).
- Save layer is the **only** module that touches `expo-sqlite`. No game-logic module reads/writes storage directly.
- Bump `CURRENT_SAVE_VERSION` and append a `Migration` whenever `SaveState` shape changes.

## Engineering rules (non-negotiable)

- **Deep modules, narrow interfaces.** One public surface per module via `index.ts` barrel. Consumers import from `'@/game/<Module>'`, never from a file inside.
- **All cross-module communication goes through `EventBus`.** No module imports another's internals.
- **All tunables in `data/*.json`.** No magic numbers in code. Loaded via `parseData` (typed schema).
- **Static-now subsystems exposed via interfaces** (`OEMSource`, `CompetitorSource`, etc.) so richer procedural replacements drop in later without changing consumers.
- **Small commits, each verifiable.** No multi-day branches without intermediate landings.
- **UI is fully separable from game logic.** Logic never imports UI; UI never reaches into logic internals.

## Testing rules

- Every game-logic module has isolation tests on its **public interface**. Test external behavior, never implementation details. Refactor-safe.
- UI gets **smoke tests only** (renders without crashing on a representative fixture). **No snapshot tests.**

## Not part of this product (do NOT add without checking issue #1)

Genuinely outside the design — not build-order deferrals: player-character RPG skill layer · cloud save · Lottie/sprite animation pipeline · multiplayer / social · period-piece content.

Everything that is part of the design but not yet built — higher-tier (T4+) gameplay, richer competitor/OEM simulation, service-to-sales conversion, equity mining — is **not-yet-built, not out of scope**. It gets built when its tier comes up. (Body Shop is now **built** — the Tier-3 collision profit center shipped via #311–#318.)

## When to re-read issue #1

- A design question isn't answered by this doc or the per-module `CLAUDE.md`.
- Issue #1 has just been edited (check `gh issue view 1 --json updatedAt`).
- You're proposing a change to the engineering rules, tier system, or module map.
- The user explicitly says "check #1".

Otherwise — work from this doc + per-module docs + `events.ts`.
