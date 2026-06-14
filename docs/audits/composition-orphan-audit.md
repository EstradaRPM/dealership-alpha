# Composition Orphan Audit (#184)

One-time, bounded audit of which `src/game/<Module>` units are actually
instantiated in a built `World`. Motivated by #183, where `CompetitorMarket`
was found completely dark — never constructed in `createWorld` — yet produced
no type error and no test failure (EventBus decoupling hides unwired modules).

**Date:** 2026-06-13 · **Method:** classify every module directory against
`src/createWorld.ts` (the seed-dependent composition root) and the App-layer
composition (`src/app/services.ts`), then cross-check `EventBus/events.ts`:
for every event with a subscriber, confirm a publisher is reachable in a built
world, and for every publisher, confirm a wired instance emits it.

## Headline

- **Top-level module orphans: 0.** All 31 directories under `src/game/` are
  either wired, pure libraries, or external-boundary infrastructure.
  `CompetitorMarket` (the #183 orphan) is now wired.
- **Sub-module orphans: 3**, all inside `CareerProgression`. Three finished
  failure/ending engines — `BankruptcyMonitor` (#30), `IndictmentMonitor`
  (#32), `CareerEndingsMonitor` (#35) — are **never instantiated** in
  production. `createWorld` builds only `createTierManager`; the three monitors
  are constructed only in their isolation tests.
- **Consequence:** of `EndCard`'s six game-ending paths, only **one**
  (`regulatory:ag_complaint_terminal`, from the wired `RegulatoryMeter`) can
  fire in a real game. **Bankruptcy game-over does not happen** (running out of
  cash never ends the run), indictment game-over does not happen, and all three
  **success endings** (retire / PE sellout / family handoff) are unreachable.

## Module inventory

| Module | Constructed by | Status |
|---|---|---|
| `GameClock` | `createGameClock` (createWorld) | Wired |
| `Weather` | `createWeather` | Wired |
| `DepartmentQueue` | `createDepartmentQueue` | Wired |
| `CustomerPool` | `createCustomerPool` | Wired |
| `Economy` | `createEconomy` | Wired |
| `Inventory` | `createInventory` | Wired |
| `DealEngine` | `createDealEngine` | Wired |
| `StaffOrg` | `createStaffOrg` | Wired |
| `StaffMorale` | `createStaffMorale` | Wired |
| `CapacityManager` | `createCapacityManager` | Wired |
| `FollowUpPool` | `createFollowUpPool` | Wired |
| `Reputation` | `createReputation` + `createRegulatoryMeter` | Wired |
| `ServiceQueue` | `createServiceQueue` | Wired |
| `CareerProgression` | `createTierManager` only | **Partial** — see F1 |
| `EndCard` | `createEndCardManager` | Wired (but starved — see F1) |
| `Telemetry` | `createTelemetry` | Wired |
| `HistoryLog` | `createHistoryLog` | Wired |
| `KPIDashboard` | `createKPIDashboard` | Wired |
| `TierGate` | `createTierGate` | Wired |
| `MarketEconomy` | `createMarketEconomy` (shock scheduler internal, stepped on `clock:day_started`) | Wired |
| `CompetitorMarket` | `createCompetitorMarket` (#183) | Wired |
| `DemandShaper` | `createDemandShaper` | Wired |
| `StaffDispatch` | `createStaffFloorDrain` (in `floorSeams`) | Wired |
| `ServiceDispatch` | `createServiceFloorDrain` (in `floorSeams`) | Wired |
| `DayLoopController` | `createDayLoopController` | Wired |
| `FloorSim` | `createFloorSim` inside `DayLoopController` | Wired (indirect) |
| `SalesProcess` | pure deal-resolution seams; consumed by `StaffDispatch` | Pure library |
| `NPC` | archetype/taxonomy loaders + `Rng`; injected into `CustomerPool.npcDeps` | Pure library |
| `data` | JSON loader (`loadTunables`, …); explicitly not an EventBus participant | Pure library |
| `EventBus` | `createEventBus()` in `src/app/services.ts`, passed into `createWorld` (must outlive world rebuilds) | Infrastructure |
| `SaveStore` | `createMultiSlotSaveStore` in `src/app/services.ts`; persistence gateway lives outside the `World` by design | External boundary |

## Findings

### F1 — `CareerProgression` failure/ending monitors are orphaned (the CompetitorMarket pattern, ×3)

`createWorld` instantiates `createTierManager` but **not** the three monitors
exported alongside it. Grep for `createBankruptcyMonitor` /
`createIndictmentMonitor` / `createCareerEndingsMonitor` across `src/` finds
**no caller** outside the modules' own files, their barrel, and CLAUDE.md.
`createTierManager` does not construct them internally.

Each monitor is the sole publisher of events `EndCardManager` depends on
(`EndCardManager.ts:42-47`):

| Ending event (→ EndCard) | Publisher | Wired? |
|---|---|---|
| `career:bankruptcy_terminal` | `BankruptcyMonitor` | **No** |
| `regulatory:ag_complaint_terminal` | `RegulatoryMeter` | Yes |
| `career:indictment_terminal` | `IndictmentMonitor` | **No** |
| `career:retired` | `CareerEndingsMonitor` | **No** |
| `career:pe_sellout` | `CareerEndingsMonitor` | **No** |
| `career:family_handoff` | `CareerEndingsMonitor` | **No** |

Also dark for the same reason: `career:bankruptcy_contraction` /
`career:bankruptcy_compliance` / `career:debt_payment_made` (Bankruptcy),
`career:indictment_contraction` / `career:indictment_legal_defense`
(Indictment), `career:pe_offer_made` (Endings). The isolation tests pass
because they construct the monitors by hand — exactly the EventBus blind spot
this audit exists to catch.

**Follow-up wiring issues filed:** one per orphan (see below).

### F2 — Severe-event signal producers are missing (dark inputs to Indictment)

`IndictmentMonitor` subscribes to three "severe regulatory violation" signals
(`IndictmentMonitor.ts:95-103`) that **no production module publishes** — they
appear only in `events.ts`, the monitor, and the monitor's test:

- `regulatory:lemon_law_incident`
- `regulatory:audit_failure`
- `deal:fraud_flag`

So even after `IndictmentMonitor` is wired (F1), its indictment-pressure inputs
stay dark until a gameplay system (a sold lemon, a failed audit, a fraudulent
deal structure) actually emits them. Tracked as part of the IndictmentMonitor
wiring issue.

### F3 — `bus:ready` is declared but never published in production (benign)

The `bus:ready` boot signal is published only in `tests/EventBus.test.ts`; no
production code emits it and nothing subscribes. Harmless — documented here so a
future reader doesn't treat its absence as a regression.

### F4 — `tests/Composition.day.test.ts` hand-mirrors `createWorld` wiring (maintenance hazard)

Of the three `Composition.*` tests, `Composition.competitor.test.ts` and
`Composition.tier.test.ts` drive the **real** `createWorld`.
`Composition.day.test.ts` hand-composes the floor wiring ("Mirrors
createWorld.ts", `:67`) and would silently reproduce any omission in the real
root — it would not have caught F1. Prefer driving `createWorld` directly;
flagged, not changed, by this audit.

## Follow-up issues

- **#270** — `BankruptcyMonitor` wiring (#30 path): instantiate in
  `createWorld`, add to world snapshot (#188 seam).
- **#271** — `IndictmentMonitor` wiring (#32 path): instantiate + persist; plus
  emit the F2 severe-event signals from gameplay so its inputs aren't dark.
- **#272** — `CareerEndingsMonitor` wiring (#35 success endings): instantiate +
  persist.

`CompetitorMarket` already had its wiring issue (#183, landed).
</content>
