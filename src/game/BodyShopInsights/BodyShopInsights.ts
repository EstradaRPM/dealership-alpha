/**
 * BodyShopInsights (#315, parent #297) — the trailing-window read-model that
 * backs the Body Shop page's demand-heat + conquest-health readouts.
 *
 * Event-driven, holds only derived trailing state (a capped intake window of
 * `[jobCategory, channel]` pairs + a per-day intake-count map). It is the Tier-3
 * mirror of `ServiceInsights`, reusing that module's pure `classifyServiceHeat`
 * / `trendForSeries` helpers; the demand-heat half is identical in shape, while
 * the second readout swaps Service's installed-base annuity for the Body Shop's
 * conquest model (collision-flow volume + insurance/retail channel mix).
 *
 * It subscribes to `bodyshop:intake_ready` (the Tier-3-GATED stream published by
 * BodyShopQueue), NOT the raw `bodyshop:demand_ready`. Below Tier 3 that event
 * never fires, so the read-model stays empty and the page renders its dark/empty
 * states — the same "content gated by a dark read-model" pattern Service uses.
 */

import type { EventBus } from '../EventBus';
import { classifyServiceHeat, trendForSeries } from '../ServiceInsights';
import { BODY_SHOP_JOB_CATEGORIES } from '../CollisionStream';
import {
  loadBodyShopInsightsConfig,
  type BodyShopInsightsConfig,
} from './bodyShopInsightsConfig';
import type {
  BodyShopInsights,
  BodyShopInsightsSnapshot,
  BodyShopDemandHeatEntry,
  ConquestHealth,
  BodyShopHeatBand,
  BodyShopTrend,
  BodyShopJobCategory,
  CollisionChannel,
} from './types';

export interface BodyShopInsightsDeps {
  readonly bus: EventBus;
  readonly config?: BodyShopInsightsConfig;
}

type IntakePair = readonly [BodyShopJobCategory, CollisionChannel];

export function createBodyShopInsights(
  deps: BodyShopInsightsDeps,
): BodyShopInsights {
  const { bus } = deps;
  const config = deps.config ?? loadBodyShopInsightsConfig();
  const { demandWindowSize, heatThresholds, demandTrendEpsilon } = config;
  const { conquestWindowDays, volumeTrendEpsilon, channelTrendEpsilon } = config;

  // Trailing intake (oldest first), capped at demandWindowSize. Each entry keeps
  // the job category AND the channel so demand heat + channel mix derive from one
  // lockstep window.
  let intakeWindow: IntakePair[] = [];
  // Per-day total intake counts, keyed by day. bodyshop:intake_ready fires once
  // per day (possibly empty) once at Tier 3, so a map keyed by day is exact and
  // order-independent.
  const dailyIntake = new Map<number, number>();

  // Keep the day map from growing unbounded — retain a generous buffer past the
  // conquest window so the volume trend always has the full window available.
  const prune = (map: Map<number, number>) => {
    const keep = conquestWindowDays * 2;
    if (map.size <= keep) return;
    const days = [...map.keys()].sort((a, b) => a - b);
    for (const day of days.slice(0, map.size - keep)) map.delete(day);
  };

  bus.subscribe('bodyshop:intake_ready', ({ day, items }) => {
    for (const item of items) intakeWindow.push([item.jobCategory, item.source]);
    if (intakeWindow.length > demandWindowSize) {
      intakeWindow = intakeWindow.slice(intakeWindow.length - demandWindowSize);
    }
    dailyIntake.set(day, (dailyIntake.get(day) ?? 0) + items.length);
    prune(dailyIntake);
  });

  const countCat = (cat: BodyShopJobCategory, w: readonly IntakePair[]) =>
    w.reduce((n, [c]) => (c === cat ? n + 1 : n), 0);

  const getDemandHeat = (): readonly BodyShopDemandHeatEntry[] => {
    const total = intakeWindow.length;
    const mid = Math.floor(intakeWindow.length / 2);
    const older = intakeWindow.slice(0, mid);
    const newer = intakeWindow.slice(mid);
    const shareCat = (cat: BodyShopJobCategory, w: readonly IntakePair[]) =>
      w.length === 0 ? 0 : countCat(cat, w) / w.length;
    return BODY_SHOP_JOB_CATEGORIES.map((category): BodyShopDemandHeatEntry => {
      const count = countCat(category, intakeWindow);
      const share = total === 0 ? 0 : count / total;
      // Trend on the category's share (not raw count) so it is invariant to
      // window fill — same idiom as ServiceInsights.
      const trend: BodyShopTrend =
        intakeWindow.length < 2
          ? 'steady'
          : trendForSeries(
              [shareCat(category, older), shareCat(category, newer)],
              demandTrendEpsilon,
            );
      return {
        category,
        count,
        share,
        band: classifyServiceHeat(
          share,
          BODY_SHOP_JOB_CATEGORIES.length,
          heatThresholds,
        ) as BodyShopHeatBand,
        trend,
      };
    });
  };

  const getConquestHealth = (): ConquestHealth => {
    // Channel mix over the trailing intake window.
    const windowTickets = intakeWindow.length;
    const retailIn = (w: readonly IntakePair[]) =>
      w.reduce((n, [, ch]) => (ch === 'retail' ? n + 1 : n), 0);
    const retailShare =
      windowTickets === 0 ? 0 : retailIn(intakeWindow) / windowTickets;
    const insuranceShare = windowTickets === 0 ? 0 : 1 - retailShare;
    const mid = Math.floor(intakeWindow.length / 2);
    const older = intakeWindow.slice(0, mid);
    const newer = intakeWindow.slice(mid);
    const retailShareOf = (w: readonly IntakePair[]) =>
      w.length === 0 ? 0 : retailIn(w) / w.length;
    const retailTrend: BodyShopTrend =
      intakeWindow.length < 2
        ? 'steady'
        : trendForSeries(
            [retailShareOf(older), retailShareOf(newer)],
            channelTrendEpsilon,
          );

    // Volume over the trailing day window (the reliable per-day calendar).
    const days = [...dailyIntake.keys()].sort((a, b) => a - b);
    const windowDays = days.slice(Math.max(0, days.length - conquestWindowDays));
    const series = windowDays.map((d) => dailyIntake.get(d) ?? 0);
    const avg = (xs: readonly number[]) =>
      xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

    return {
      windowTickets,
      intakePerDay: avg(series),
      volumeTrend: trendForSeries(series, volumeTrendEpsilon),
      retailShare,
      insuranceShare,
      retailTrend,
    };
  };

  return {
    getDemandHeat,
    getConquestHealth,
    snapshot: (): BodyShopInsightsSnapshot => ({
      schemaVersion: 1,
      intakeWindow: intakeWindow.map(([j, c]) => [j, c] as const),
      dailyIntake: [...dailyIntake.entries()],
    }),
    restore: (snap: BodyShopInsightsSnapshot) => {
      const validCat = new Set<string>(BODY_SHOP_JOB_CATEGORIES);
      const validChannel = new Set<string>(['insurance', 'retail']);
      intakeWindow = snap.intakeWindow
        .filter(([cat, ch]) => validCat.has(cat) && validChannel.has(ch))
        .map(([cat, ch]) => [cat, ch] as IntakePair)
        .slice(-demandWindowSize);
      dailyIntake.clear();
      for (const [day, count] of snap.dailyIntake) dailyIntake.set(day, count);
      prune(dailyIntake);
    },
  };
}
