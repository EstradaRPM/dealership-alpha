# BodyShopPage

The dedicated **Body Shop page** (#315, parent #297) inside the fixed Operations
tab — the Tier-3 mirror of the **read-only half** of `ServicePage`. It presents
the Body Shop's three read-models: per-collision-category **demand heat**,
collision-parts **stock coverage**, and **conquest health**. Pure view (the
DepartmentScreen idiom): it renders a `BodyShopPageModel` assembled by the
composition root and dispatches only `onClose`. It reads no game logic.

The insurance/retail **channel control** (the Body Shop's single policy lever)
is the sibling slice **#318** — this page is deliberately read-only.

## Conquest health, not base health
Where the Service page's third readout is installed-base health (loyalty / CSI /
returns / defections), the Body Shop is **conquest-dominant with no installed
base** — every collision job is won fresh. So the third readout is conquest
health: collision-flow **volume** (`intakePerDay` + trend) and the
**channel mix** (`retailShare` customer-pay / fat-margin vs `insuranceShare`
DRP / rate-capped, plus the retail-conquest momentum trend). No annuity
assumptions.

## Public API (`index.ts`)
- `BodyShopPage` — props `{ model: BodyShopPageModel, onClose }`.
- `BodyShopPageModel` — `{ demandHeat, coverage, conquest }`:
  - `demandHeat: BodyShopDemandHeatRow[]` — `{ category, label, band, trend }`.
  - `coverage: BodyShopCoverageRow[]` — `{ category, label, demand, onHand,
    onOrder, gap }`.
  - `conquest: BodyShopConquestHealthModel` — `{ windowTickets, intakePerDay,
    intakeTrend, retailShare, insuranceShare, retailTrend }`.
- Types: `BodyShopPageProps`, `BodyShopPageModel`, `BodyShopDemandHeatRow`,
  `BodyShopCoverageRow`, `BodyShopConquestHealthModel`, `BodyShopHeatBand`,
  `BodyShopTrend`.

## Notes
- **Labels name the axis, never the temperature.** A category's internal band is
  `hot`/`warm`/`cold`, but the visible Badge reads `High demand` / `Steady
  demand` / `Low demand` — the locked "no vague temperature labels" rule (reuses
  the Service page's mapping verbatim).
- Coverage shows `need N · stock M (· K inbound)` and a `Short N` / `Covered`
  badge driven by `gap`.
- Reachable via the `bodyShop` Navigator route, pushed from the Operations tab's
  Departments region. The entry appears only at/after Tier 3 (the Body Shop is
  dark before the showroom tier), but **navigation itself is never tier-gated**.
- Backed by the `BodyShopInsights` read-model (demand heat + conquest health) and
  `PartsInventory.getCoverageGap` (coverage, over the four collision categories),
  assembled in `buildBodyShopPageModel` (`src/app/config.ts`).

## Tests
Smoke test only (renders without crashing; asserts the three readouts + the
plain-language demand labels, never a temperature word) — no snapshot tests.
