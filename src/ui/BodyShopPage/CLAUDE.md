# BodyShopPage

The dedicated **Body Shop page** (#315 readouts + #318 controls, parent #297)
inside the fixed Operations tab — the Tier-3 mirror of `ServicePage`. It presents
the Body Shop's three read-models — per-collision-category **demand heat**,
collision-parts **stock coverage**, and **conquest health** — plus the player's
**policy controls** (#318). Still a pure view (the DepartmentScreen idiom): it
renders a `BodyShopPageModel` (+ an optional `BodyShopControls`) assembled by the
composition root and dispatches only `onClose` and the control setters. It reads
no game logic.

## Conquest health, not base health
Where the Service page's third readout is installed-base health (loyalty / CSI /
returns / defections), the Body Shop is **conquest-dominant with no installed
base** — every collision job is won fresh. So the third readout is conquest
health: collision-flow **volume** (`intakePerDay` + trend) and the
**channel mix** (`retailShare` customer-pay / fat-margin vs `insuranceShare`
DRP / rate-capped, plus the retail-conquest momentum trend). No annuity
assumptions.

## Public API (`index.ts`)
- `BodyShopPage` — props `{ model: BodyShopPageModel, controls?:
  BodyShopControls, onClose }`. `controls` absent ⇒ the page is read-only.
- `BodyShopPageModel` — `{ demandHeat, coverage, conquest }`:
  - `demandHeat: BodyShopDemandHeatRow[]` — `{ category, label, band, trend }`.
  - `coverage: BodyShopCoverageRow[]` — `{ category, label, demand, onHand,
    onOrder, gap }`.
  - `conquest: BodyShopConquestHealthModel` — `{ windowTickets, intakePerDay,
    intakeTrend, retailShare, insuranceShare, retailTrend }`.
- `BodyShopControls` (#318) — `{ model: BodyShopControlsModel, onSetReorderPoint,
  onSetTarget, onSetSupplierTier, onSetChannelPosture, hints? }`. `hints` (#388)
  is `{ parts, channelPosture }` — one resolved consequence line per control
  block, null once used. `parts` is the **same catalog entry the Service page
  draws** (`parts_policy`): one lesson, two rooms, retired once. The model carries the
  live values + option lists:
  - `par: DeptParControl[]` — per collision category `{ category, label,
    reorderPoint, target, tier, onHand }` (PartsInventory procurement policy).
  - `tierOptions: DeptTierOption[]` — the supplier tiers.
  - `channelPosture` — the insurance↔retail dial in `[0,1]` (0 = full
    insurance-DRP, 1 = full retail).
- Types: `BodyShopPageProps`, `BodyShopPageModel`, `BodyShopDemandHeatRow`,
  `BodyShopCoverageRow`, `BodyShopConquestHealthModel`, `BodyShopHeatBand`,
  `BodyShopTrend`, `BodyShopControls`, `BodyShopControlsModel`,
  `BodyShopSupplierTierId`.

## Controls (#318)
- **Policy-style, not morning clicks.** Each control dispatches straight into the
  already-built game logic — PartsInventory `setPolicy` over the four collision
  categories (`windows_glass`/`doors_panels`/`interior_trim`/`paint`) and the
  World-seam `setBodyShopChannelPosture` (#314); the composition root
  (`RouteContent` bodyShop branch) then re-snapshots (`persistCurrentSave`) and
  re-renders (`bump`), so the page reflects the new policy and it round-trips
  through the save.
- The **channel dial** is the Body Shop's *single* pricing/marketing lever —
  insurance (DRP, rate-capped, steady) ↔ retail (customer-pay, fatter, lumpier).
  It steers both the CollisionStream demand mix and the per-ticket pricing read.
  There is no separate retention/conquest arm (unlike Service): the channel lean
  *is* the marketing posture. Continuous `[0,1]`, stepped ±0.1, surfaced with a
  plain-language word (Insurance-led / Balanced / Retail-led) — names the axis,
  never a temperature.
- **Channel posture persistence already existed** (#314 world-snapshot key
  `bodyShopChannelPosture`); #318 only added the UI that drives the setter.
- Par/supplier reuse the shared `DeptControls` primitives (steppers + tier
  chips); the controls model is assembled by `buildBodyShopControlsModel`
  (`src/app/config.ts`).
- **Visual treatment is deliberately plain** — the rebrand (a real dial etc.) is
  the later `/map-mockup` pass.

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
plain-language demand labels, never a temperature word; and — when bound — the
two control surfaces render, the par steppers + channel dial dispatch, and the
channel axis is named Insurance ↔ Retail, never a temperature word) — no snapshot
tests.
