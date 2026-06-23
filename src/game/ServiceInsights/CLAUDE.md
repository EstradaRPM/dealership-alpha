# ServiceInsights

The trailing-window **read-model** that backs the Service page readouts (#308,
parent PRD #297). Owns no domain logic — it derives two views off signals
already on the bus plus a live read of the InstalledBase registry:

- **Demand heat** — per parts category, the share of recent service intake, a
  coarse `hot`/`warm`/`cold` band, and a rising/steady/falling trend.
- **Base health** — installed-base size, mean loyalty + CSI, a forward
  churn-pressure `atRiskCount`, and the trailing return/defection rates + trends.

It is the Service-side analog of how DemandShaper's trailing window backs the
sales "what's hot on the lot" readout — same window + newer-vs-older-half trend
idiom, re-keyed to the four `JOB_CATEGORIES`.

## Public API (`index.ts`)
- `createServiceInsights({ bus, installedBase, config? })` → `ServiceInsights`.
  `installedBase` is the narrowed `InstalledBaseRead` (`getOwners` + `size`);
  `config` defaults to `loadServiceInsightsConfig()`.
- `getDemandHeat()` → `readonly DemandHeatEntry[]` — all four categories in fixed
  `JOB_CATEGORIES` order (0-share when the window holds none). Each entry:
  `{ category, count, share, band, trend }`.
- `getBaseHealth()` → `BaseHealth` — `{ size, avgLoyalty, avgCsi, atRiskCount,
  returnsPerDay, returnTrend, defectionsPerDay, churnTrend }`.
- `snapshot()` / `restore()` — barrel-exported `ServiceInsightsSnapshot`
  (schemaVersion 1): the trailing intake window + the two per-day count maps.
  The live registry reads are NOT persisted (re-read each call).
- Pure fns (isolation-testable): `classifyServiceHeat(share, categoryCount,
  thresholds)`, `trendForSeries(series, epsilon)`.
- `loadServiceInsightsConfig()`, types `ServiceInsights`, `ServiceInsightsDeps`,
  `ServiceInsightsConfig`, `ServiceInsightsSnapshot`, `DemandHeatEntry`,
  `BaseHealth`, `ServiceHeatBand`, `ServiceTrend`, `InstalledBaseRead`.

## Model
- **Demand window** — each `serviceDemand:intake_ready` ticket's `jobCategory`
  is pushed onto a trailing array capped at `demandWindowSize`. Per-category
  `share = count / window`; `band = classifyServiceHeat(share, 4, thresholds)`
  (`share × 4`: 1.0 = even split, ≥`hot` HOT, ≤`cold` COLD); `trend` compares the
  category's share in the newer vs older half of the window.
- **Day windows** — `installedBase:returns_ready` (fires every day, possibly
  empty) sets `dailyReturns[day]`; `installedBase:owner_defected` increments
  `dailyDefections[day]`. Keyed by the event's own `day` so accumulation is
  independent of subscriber firing order. Base-health rates + trends average over
  the last `baseHealthWindowDays` days of the returns calendar (the reliable
  daily signal), reading 0 for a silent day. Maps are pruned to a 2× buffer.
- **Live aggregates** — `size`, `avgLoyalty`, `avgCsi`, and `atRiskCount`
  (owners with any bad-visit or non-return streak) read straight off
  `installedBase.getOwners()` each call; nothing about them is persisted here.

## Events
- **Consumes:** `serviceDemand:intake_ready` (#302), `installedBase:returns_ready`
  (#300), `installedBase:owner_defected` (#306).
- **Emits:** none — a pure read-model.

## Data
- `data/tunables.json#serviceInsights` — `demandWindowSize`, `heatThresholds`
  (`hot`/`cold`), `demandTrendEpsilon`, `baseHealthWindowDays`, `baseTrendEpsilon`.
  All S14 (#286) calibration placeholders.

## Persistence & determinism
- Persisted under the `serviceInsights` world-snapshot key (envelope v12). The
  window + day maps round-trip so trends stay continuous across a reload; a
  pre-#308 save materializes an empty read-model via the v11→v12 migration.
- Adds no RNG and emits nothing — purely derived from the persisted trailing
  state + the deterministic upstream streams, so it replays identically (#122,
  #317).
