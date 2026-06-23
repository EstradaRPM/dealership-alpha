/**
 * ServiceInsights (#308, parent #297) — the trailing-window read-model that
 * backs the Service page's demand-heat + base-health readouts.
 *
 * Event-driven, holds only derived trailing state (a capped intake window + two
 * per-day count maps), and reads the live InstalledBase registry for the
 * size/loyalty/CSI/at-risk aggregates. Mirrors DemandShaper's window + newer-vs-
 * older-half trend idiom, re-keyed to the four Service job/parts categories.
 */

import type { EventBus } from '../EventBus';
import { JOB_CATEGORIES } from '../InstalledBase';
import {
  loadServiceInsightsConfig,
  type ServiceInsightsConfig,
} from './serviceInsightsConfig';
import type {
  ServiceInsights,
  ServiceInsightsSnapshot,
  DemandHeatEntry,
  BaseHealth,
  ServiceHeatBand,
  ServiceTrend,
  JobCategory,
  InstalledBaseRead,
} from './types';

export interface ServiceInsightsDeps {
  readonly bus: EventBus;
  /** Live registry read for the base-health aggregates. */
  readonly installedBase: InstalledBaseRead;
  readonly config?: ServiceInsightsConfig;
}

/** Classify a category's share into a coarse band. `share × categoryCount`
 *  expresses it as a multiple of an even split (1.0 = even, >1 hotter). Pure. */
export function classifyServiceHeat(
  share: number,
  categoryCount: number,
  thresholds: { hot: number; cold: number },
): ServiceHeatBand {
  const heat = share * categoryCount;
  if (heat >= thresholds.hot) return 'hot';
  if (heat <= thresholds.cold) return 'cold';
  return 'warm';
}

/** Newer-half vs older-half mean comparison for a numeric series (oldest first).
 *  `rising`/`falling` when the delta clears `epsilon`, else `steady`. Pure. */
export function trendForSeries(
  series: readonly number[],
  epsilon: number,
): ServiceTrend {
  if (series.length < 2) return 'steady';
  const mid = Math.floor(series.length / 2);
  const older = series.slice(0, mid);
  const newer = series.slice(mid);
  const mean = (xs: readonly number[]) =>
    xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
  const delta = mean(newer) - mean(older);
  if (delta > epsilon) return 'rising';
  if (delta < -epsilon) return 'falling';
  return 'steady';
}

export function createServiceInsights(
  deps: ServiceInsightsDeps,
): ServiceInsights {
  const { bus, installedBase } = deps;
  const config = deps.config ?? loadServiceInsightsConfig();
  const { demandWindowSize, heatThresholds, demandTrendEpsilon } = config;
  const { baseHealthWindowDays, baseTrendEpsilon } = config;

  // Trailing intake categories (oldest first), capped at demandWindowSize.
  let demandWindow: JobCategory[] = [];
  // Per-day counts, keyed by day so accumulation is order-independent of when
  // returns_ready / owner_defected fire relative to each other.
  const dailyReturns = new Map<number, number>();
  const dailyDefections = new Map<number, number>();

  // Keep the day maps from growing unbounded — retain a generous buffer past
  // the health window so trend math always has the full window available.
  const prune = (map: Map<number, number>) => {
    const keep = baseHealthWindowDays * 2;
    if (map.size <= keep) return;
    const days = [...map.keys()].sort((a, b) => a - b);
    for (const day of days.slice(0, map.size - keep)) map.delete(day);
  };

  bus.subscribe('serviceDemand:intake_ready', ({ intake }) => {
    for (const ticket of intake) demandWindow.push(ticket.jobCategory);
    if (demandWindow.length > demandWindowSize) {
      demandWindow = demandWindow.slice(demandWindow.length - demandWindowSize);
    }
  });

  bus.subscribe('installedBase:returns_ready', ({ day, returns }) => {
    // Fires once per day (possibly empty), so a set keyed by day is exact.
    dailyReturns.set(day, (dailyReturns.get(day) ?? 0) + returns.length);
    prune(dailyReturns);
  });

  bus.subscribe('installedBase:owner_defected', ({ day }) => {
    dailyDefections.set(day, (dailyDefections.get(day) ?? 0) + 1);
    prune(dailyDefections);
  });

  const countIn = (cat: JobCategory, window: readonly JobCategory[]) =>
    window.reduce((n, c) => (c === cat ? n + 1 : n), 0);

  const getDemandHeat = (): readonly DemandHeatEntry[] => {
    const total = demandWindow.length;
    const mid = Math.floor(demandWindow.length / 2);
    const older = demandWindow.slice(0, mid);
    const newer = demandWindow.slice(mid);
    const shareIn = (cat: JobCategory, w: readonly JobCategory[]) =>
      w.length === 0 ? 0 : countIn(cat, w) / w.length;
    return JOB_CATEGORIES.map((category): DemandHeatEntry => {
      const count = countIn(category, demandWindow);
      const share = total === 0 ? 0 : count / total;
      // Trend on the category's share (not raw count) so it is invariant to
      // window fill — same idiom as DemandShaper's per-segment trend.
      const trend =
        demandWindow.length < 2
          ? ('steady' as ServiceTrend)
          : trendForSeries(
              [shareIn(category, older), shareIn(category, newer)],
              demandTrendEpsilon,
            );
      return {
        category,
        count,
        share,
        band: classifyServiceHeat(share, JOB_CATEGORIES.length, heatThresholds),
        trend,
      };
    });
  };

  const getBaseHealth = (): BaseHealth => {
    const owners = installedBase.getOwners();
    const size = installedBase.size;
    const sum = owners.reduce(
      (acc, o) => {
        acc.loyalty += o.loyalty;
        acc.csi += o.csi;
        if (o.consecutiveBadVisits > 0 || o.consecutiveNoReturns > 0)
          acc.atRisk += 1;
        return acc;
      },
      { loyalty: 0, csi: 0, atRisk: 0 },
    );
    const n = owners.length;

    // Day window: the last baseHealthWindowDays days for which a daily signal
    // exists (returns_ready fires every day, so its keys are the reliable
    // calendar). Both series read across the same day set, 0 for a silent day.
    const days = [...dailyReturns.keys()].sort((a, b) => a - b);
    const windowDays = days.slice(Math.max(0, days.length - baseHealthWindowDays));
    const returnsSeries = windowDays.map((d) => dailyReturns.get(d) ?? 0);
    const defectionsSeries = windowDays.map((d) => dailyDefections.get(d) ?? 0);
    const avg = (xs: readonly number[]) =>
      xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

    return {
      size,
      avgLoyalty: n === 0 ? 0 : sum.loyalty / n,
      avgCsi: n === 0 ? 0 : sum.csi / n,
      atRiskCount: sum.atRisk,
      returnsPerDay: avg(returnsSeries),
      returnTrend: trendForSeries(returnsSeries, baseTrendEpsilon),
      defectionsPerDay: avg(defectionsSeries),
      churnTrend: trendForSeries(defectionsSeries, baseTrendEpsilon),
    };
  };

  return {
    getDemandHeat,
    getBaseHealth,
    snapshot: (): ServiceInsightsSnapshot => ({
      schemaVersion: 1,
      demandWindow: [...demandWindow],
      dailyReturns: [...dailyReturns.entries()],
      dailyDefections: [...dailyDefections.entries()],
    }),
    restore: (snap: ServiceInsightsSnapshot) => {
      const valid = new Set<string>(JOB_CATEGORIES);
      demandWindow = snap.demandWindow
        .filter((c): c is JobCategory => valid.has(c))
        .slice(-demandWindowSize);
      dailyReturns.clear();
      for (const [day, count] of snap.dailyReturns) dailyReturns.set(day, count);
      dailyDefections.clear();
      for (const [day, count] of snap.dailyDefections)
        dailyDefections.set(day, count);
      prune(dailyReturns);
      prune(dailyDefections);
    },
  };
}
