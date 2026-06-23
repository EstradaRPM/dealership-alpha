/**
 * ServiceInsights types (#308, parent #297).
 *
 * ServiceInsights is the trailing-window read-model that backs the Service page
 * readouts. It listens to the day's service intake + the installed-base return /
 * defection stream and exposes two derived views:
 *  - per-parts-category **demand heat** (share + hot/warm/cold band + trend),
 *  - aggregate **base health** (size, avg loyalty/CSI, return + defection rate,
 *    and the churn-pressure at-risk count).
 *
 * It owns no domain logic — every signal is a read off events already on the
 * bus plus a live read of the InstalledBase registry. Mirrors DemandShaper's
 * trailing-window + newer/older-half trend idiom, re-keyed to job categories.
 */

import type { JobCategory } from '../InstalledBase';

export type { JobCategory } from '../InstalledBase';

/** Direction of a trailing-window signal: newer half vs older half. */
export type ServiceTrend = 'rising' | 'steady' | 'falling';

/**
 * Coarse demand temperature for a parts category — share × categoryCount banded
 * against the configured thresholds (1.0 = an even split across the four
 * categories). No fine 5-band here: the Service read has no UCM-style sharpener.
 */
export type ServiceHeatBand = 'hot' | 'warm' | 'cold';

/**
 * One parts category's demand heat over the trailing intake window. `share` is
 * the category's slice of the window (sums to ~1 across the four categories);
 * `band` is `share × 4` banded; `trend` compares the newer vs older half of the
 * window.
 */
export interface DemandHeatEntry {
  readonly category: JobCategory;
  /** Raw ticket count for this category inside the window. */
  readonly count: number;
  /** Fraction of the window's tickets (0–1). */
  readonly share: number;
  readonly band: ServiceHeatBand;
  readonly trend: ServiceTrend;
}

/**
 * Aggregate health of the installed base — the Service annuity's foundation.
 * Size / loyalty / CSI / at-risk are live reads of the registry; the return +
 * defection rates and their trends are derived from the trailing day window.
 */
export interface BaseHealth {
  /** Owner records currently in the base. */
  readonly size: number;
  /** Mean owner loyalty [0,1] (0 when the base is empty). */
  readonly avgLoyalty: number;
  /** Mean owner CSI [0,1] (0 when the base is empty). */
  readonly avgCsi: number;
  /** Owners carrying any bad-visit or non-return streak — forward churn pressure. */
  readonly atRiskCount: number;
  /** Mean returning owners per day over the trailing window. */
  readonly returnsPerDay: number;
  readonly returnTrend: ServiceTrend;
  /** Mean defections per day over the trailing window. */
  readonly defectionsPerDay: number;
  /** Rising churn (more defections) is the bad direction for this trend. */
  readonly churnTrend: ServiceTrend;
}

/**
 * Live read of the InstalledBase registry the module needs for base health.
 * Narrowed so ServiceInsights depends only on the two registry reads it uses.
 */
export interface InstalledBaseRead {
  getOwners(): readonly {
    readonly loyalty: number;
    readonly csi: number;
    readonly consecutiveBadVisits: number;
    readonly consecutiveNoReturns: number;
  }[];
  readonly size: number;
}

/** Persisted trailing state (schemaVersion 1). The live InstalledBase reads are
 *  not persisted here — they come straight off the registry on each call. */
export interface ServiceInsightsSnapshot {
  readonly schemaVersion: 1;
  /** Oldest-first trailing intake categories, capped at `demandWindowSize`. */
  readonly demandWindow: readonly JobCategory[];
  /** Per-day returning-owner counts, `[day, count]` pairs. */
  readonly dailyReturns: readonly (readonly [number, number])[];
  /** Per-day defection counts, `[day, count]` pairs. */
  readonly dailyDefections: readonly (readonly [number, number])[];
}

export interface ServiceInsights {
  /** Per-category demand heat, in fixed `JOB_CATEGORIES` order (all four
   *  categories always present, 0-share when the window holds none). */
  getDemandHeat(): readonly DemandHeatEntry[];
  /** Aggregate installed-base health. */
  getBaseHealth(): BaseHealth;
  snapshot(): ServiceInsightsSnapshot;
  restore(snap: ServiceInsightsSnapshot): void;
}
