# BodyShopInsights

The trailing-window **read-model** that backs the Body Shop page readouts (#315,
parent PRD #297). The Tier-3 mirror of `ServiceInsights`: it derives two views
off `bodyshop:intake_ready` already on the bus, owning no domain logic.

- **Demand heat** — per collision category, the share of recent Body-Shop
  intake, a coarse `hot`/`warm`/`cold` band, and a rising/steady/falling trend.
  Identical in shape to ServiceInsights — it **reuses** that module's pure
  `classifyServiceHeat` / `trendForSeries` helpers.
- **Conquest health** — the conquest-dominant analog of Service's base health.
  The Body Shop has **no installed-base annuity**, so health is the *flow* of
  fresh collision work (`intakePerDay` + `volumeTrend`) and the *channel mix*
  (`retailShare` / `insuranceShare` + the retail-conquest `retailTrend`). No
  loyalty / CSI / churn assumptions.

## Public API (`index.ts`)
- `createBodyShopInsights({ bus, config? })` → `BodyShopInsights`.
  `config` defaults to `loadBodyShopInsightsConfig()`.
- `getDemandHeat()` → `readonly BodyShopDemandHeatEntry[]` — all four collision
  categories in fixed `BODY_SHOP_JOB_CATEGORIES` order (0-share when the window
  holds none). Each entry: `{ category, count, share, band, trend }`.
- `getConquestHealth()` → `ConquestHealth` — `{ windowTickets, intakePerDay,
  volumeTrend, retailShare, insuranceShare, retailTrend }`.
- `snapshot()` / `restore()` — `BodyShopInsightsSnapshot` (schemaVersion 1): the
  trailing intake window of `[jobCategory, channel]` pairs + the per-day
  intake-count map.
- Types: `BodyShopInsights`, `BodyShopInsightsDeps`, `BodyShopInsightsConfig`,
  `BodyShopInsightsSnapshot`, `BodyShopDemandHeatEntry`, `ConquestHealth`,
  `BodyShopHeatBand`, `BodyShopTrend`, `BodyShopJobCategory`, `CollisionChannel`.

## Model
- **Intake window** — each `bodyshop:intake_ready` item pushes a
  `[jobCategory, channel]` pair onto a trailing array capped at `demandWindowSize`.
  Demand heat counts by category (`share × 4` banded); conquest channel mix
  counts by channel — one lockstep window feeds both, and both trends compare the
  newer vs older half.
- **Day window** — each `bodyshop:intake_ready` (fires once per day, possibly
  empty, once at Tier 3) sets `dailyIntake[day]`. `intakePerDay` + `volumeTrend`
  average over the last `conquestWindowDays` days. The map is pruned to a 2×
  buffer.

## Why the Tier-3-gated stream
Subscribes `bodyshop:intake_ready` (the BodyShopQueue re-publish, gated by Tier 3)
— **not** the raw `bodyshop:demand_ready`. Below Tier 3 that event never fires, so
the read-model stays empty and the Body Shop page renders its dark/empty states.
This is the "content gated by a dark read-model" pattern Service uses; navigation
itself is never tier-gated.

## Events
- **Consumes:** `bodyshop:intake_ready` (#312/#314).
- **Emits:** none — a pure read-model.

## Data
- `data/tunables.json#bodyShopInsights` — `demandWindowSize`, `heatThresholds`
  (`hot`/`cold`), `demandTrendEpsilon`, `conquestWindowDays`, `volumeTrendEpsilon`,
  `channelTrendEpsilon`. All S14 (#286) calibration placeholders.

## Persistence & determinism
- Persisted under the `bodyShopInsights` world-snapshot key (envelope v15). The
  window + day map round-trip so trends stay continuous across a reload; a
  pre-#315 save materializes an empty read-model via the v14→v15 migration.
- Adds no RNG and emits nothing — purely derived from the persisted trailing
  state + the deterministic upstream stream, so it replays identically (#122,
  #317).
