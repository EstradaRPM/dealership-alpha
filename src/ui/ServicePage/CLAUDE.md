# ServicePage

The dedicated **Service page** (#308, parent #297) — a read-only surface inside
the fixed Operations tab that presents the Service department's three
read-models: per-parts-category **demand heat**, parts **stock coverage**, and
installed-base **health**. Pure view (the DepartmentScreen idiom): it renders a
`ServicePageModel` assembled by the composition root and dispatches only
`onClose`. It reads no game logic.

## Public API (`index.ts`)
- `ServicePage` — the component. Props `{ model: ServicePageModel, onClose }`.
- `ServicePageModel` — `{ demandHeat, coverage, baseHealth }`:
  - `demandHeat: ServiceDemandHeatRow[]` — `{ category, label, band, trend }`.
  - `coverage: ServiceCoverageRow[]` — `{ category, label, demand, onHand,
    onOrder, gap }`.
  - `baseHealth: ServiceBaseHealthModel` — size, avg loyalty/CSI, at-risk count,
    returns/day + trend, defections/day + churn trend.
- Types: `ServicePageProps`, `ServicePageModel`, `ServiceDemandHeatRow`,
  `ServiceCoverageRow`, `ServiceBaseHealthModel`, `ServiceHeatBand`,
  `ServiceTrend`.

## Notes
- **Labels name the axis, never the temperature.** A category's internal band is
  `hot`/`warm`/`cold`, but the visible Badge reads `High demand` / `Steady
  demand` / `Low demand` — the locked "no vague temperature labels" rule.
- Coverage shows `need N · stock M (· K inbound)` and a `Short N` / `Covered`
  badge driven by `gap`.
- Reachable via the `service` Navigator route, pushed from the Operations tab's
  Departments region (navigation is never tier-gated).
- **Visual treatment is deliberately plain** — the neo-skeuomorphic rebrand is a
  later `/map-mockup` pass. Controls (par / supplier / pricing / marketing
  levers) are the next slice (#309); this slice is read-only.
- Backed by the `ServiceInsights` read-model (demand heat + base health) and
  `PartsInventory.getCoverageGap` (coverage), assembled in `buildServicePageModel`
  (`src/app/config.ts`).

## Tests
Smoke test only (renders without crashing; asserts the three readouts are
present) — no snapshot tests.
