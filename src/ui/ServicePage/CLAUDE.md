# ServicePage

The dedicated **Service page** (#308 readouts + #309 controls, parent #297)
inside the fixed Operations tab. It presents the Service department's three
read-models — per-parts-category **demand heat**, parts **stock coverage**, and
installed-base **health** — plus the player's **policy controls** (#309). Still a
pure view (the DepartmentScreen idiom): it renders a `ServicePageModel` (+ an
optional `ServiceControls`) assembled by the composition root and dispatches only
`onClose` and the control setters. It reads no game logic.

## Public API (`index.ts`)
- `ServicePage` — the component. Props `{ model: ServicePageModel, controls?:
  ServiceControls, onClose }`. `controls` absent ⇒ the page is read-only.
- `ServicePageModel` — `{ demandHeat, coverage, baseHealth }`:
  - `demandHeat: ServiceDemandHeatRow[]` — `{ category, label, band, trend }`.
  - `coverage: ServiceCoverageRow[]` — `{ category, label, demand, onHand,
    onOrder, gap }`.
  - `baseHealth: ServiceBaseHealthModel` — size, avg loyalty/CSI, at-risk count,
    returns/day + trend, defections/day + churn trend.
- `ServiceControls` (#309) — `{ model: ServiceControlsModel, onSetReorderPoint,
  onSetTarget, onSetSupplierTier, onSetPricingPosture, onSetRetention,
  onSetConquest }`. The model carries the live values + option lists:
  - `par: ServiceParControl[]` — per parts category `{ category, label,
    reorderPoint, target, tier, onHand }` (PartsInventory procurement policy).
  - `tierOptions: ServiceTierOption[]` — the supplier tiers.
  - `pricingPosture` — the competitive↔premium dial in `[0,1]`.
  - `retentionOptions` / `retentionId`, `conquestOptions` / `conquestCategory` —
    the two ServiceMarketing arms (`'none'` leads each list since it clears).
- Types: `ServicePageProps`, `ServicePageModel`, `ServiceDemandHeatRow`,
  `ServiceCoverageRow`, `ServiceBaseHealthModel`, `ServiceHeatBand`,
  `ServiceTrend`, `ServiceControls`, `ServiceControlsModel`, `ServiceParControl`,
  `ServiceTierOption`, `ServiceMarketingOption`, `ServiceSupplierTierId`.

## Controls (#309)
- **Policy-style, not morning clicks.** Each control dispatches straight into the
  already-built game logic (PartsInventory `setPolicy`, the World-seam
  `setServicePricingPosture`, ServiceMarketing `setRetentionCampaign` /
  `setConquestSpecial`); the composition root (`RouteContent` service branch)
  then re-snapshots (`persistCurrentSave`) and re-renders (`bump`), so the page
  reflects the new policy and it round-trips through the save.
- **Posture** is a continuous `[0,1]` dial stepped ±0.1 here, surfaced with a
  plain-language word (Competitive / Balanced / Premium) — names the axis, never
  a temperature.
- Par levels use `−`/`+` steppers (floored at 0 by PartsInventory). Supplier tier
  + the two marketing arms are chip rows.
- The controls model is assembled by `buildServiceControlsModel` (`src/app/config.ts`);
  posture persistence rides the world snapshot (`servicePricingPosture` key,
  envelope v12→v13).
- **Visual treatment is deliberately plain** — the neo-skeuomorphic rebrand
  (a real posture slider etc.) is the later `/map-mockup` pass.

## Notes
- **Labels name the axis, never the temperature.** A category's internal band is
  `hot`/`warm`/`cold`, but the visible Badge reads `High demand` / `Steady
  demand` / `Low demand` — the locked "no vague temperature labels" rule.
- Coverage shows `need N · stock M (· K inbound)` and a `Short N` / `Covered`
  badge driven by `gap`.
- Reachable via the `service` Navigator route, pushed from the Operations tab's
  Departments region (navigation is never tier-gated).
- Backed by the `ServiceInsights` read-model (demand heat + base health) and
  `PartsInventory.getCoverageGap` (coverage), assembled in `buildServicePageModel`
  (`src/app/config.ts`).

## Tests
Smoke test only (renders without crashing; asserts the three readouts +,
when bound, the three control surfaces are present, and that the control chips/
steppers dispatch) — no snapshot tests.
