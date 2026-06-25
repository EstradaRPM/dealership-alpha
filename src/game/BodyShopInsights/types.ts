/**
 * BodyShopInsights types (#315, parent #297).
 *
 * BodyShopInsights is the trailing-window read-model that backs the Body Shop
 * page readouts — the Tier-3 mirror of `ServiceInsights`, but with a
 * fundamentally different second readout. Where Service is an installed-base
 * annuity (loyalty / CSI / returns / defections), the Body Shop is
 * **conquest-dominant with no installed base**: every collision job is won
 * fresh, split across an `insurance` (DRP, steady, rate-capped) and a `retail`
 * (customer-pay, lumpy, fatter-margin) channel. So it exposes:
 *  - per-collision-category **demand heat** (share + band + trend), identical in
 *    shape to ServiceInsights (it reuses the same `classifyServiceHeat` /
 *    `trendForSeries` helpers), and
 *  - **conquest health** — the collision-flow volume + its trend, and the
 *    retail/insurance channel mix + the retail-conquest momentum trend. No
 *    base-size / loyalty / churn assumptions.
 *
 * It owns no domain logic — every signal is a read off `bodyshop:intake_ready`
 * already on the bus (the Tier-3-gated stream, so the read-model is naturally
 * dark below Tier 3). Holds a capped intake window + one per-day count map.
 */

import type { BodyShopJobCategory, CollisionChannel } from '../CollisionStream';

export type { BodyShopJobCategory, CollisionChannel } from '../CollisionStream';

/** Direction of a trailing-window signal: newer half vs older half. */
export type BodyShopTrend = 'rising' | 'steady' | 'falling';

/**
 * Coarse demand level for a collision category — `share × categoryCount` banded
 * against the configured thresholds (1.0 = an even split across the four
 * categories). Mirrors `ServiceHeatBand`; surfaced with a plain-language DEMAND
 * label (never a bare temperature word).
 */
export type BodyShopHeatBand = 'hot' | 'warm' | 'cold';

/**
 * One collision category's demand heat over the trailing intake window. `share`
 * is the category's slice of the window (sums to ~1 across the four categories);
 * `band` is `share × 4` banded; `trend` compares the newer vs older half.
 */
export interface BodyShopDemandHeatEntry {
  readonly category: BodyShopJobCategory;
  /** Raw ticket count for this category inside the window. */
  readonly count: number;
  /** Fraction of the window's tickets (0–1). */
  readonly share: number;
  readonly band: BodyShopHeatBand;
  readonly trend: BodyShopTrend;
}

/**
 * Conquest health of the Body Shop — the conquest-dominant analog of Service's
 * base health. There is no installed-base annuity here, so health is measured by
 * the **flow** of fresh collision work and its **channel mix**:
 *  - `windowTickets` / `intakePerDay` / `volumeTrend` — how much collision work
 *    is coming in and whether the flow is rising or drying up.
 *  - `retailShare` / `insuranceShare` — the customer-pay (fatter-margin
 *    conquest) vs insurance-DRP (steady, rate-capped) split of recent intake.
 *  - `retailTrend` — the retail-conquest momentum (newer vs older half of the
 *    window): rising = the player is converting more fat-margin retail work.
 */
export interface ConquestHealth {
  /** Total collision tickets in the trailing intake window. */
  readonly windowTickets: number;
  /** Mean collision tickets taken in per day over the trailing day window. */
  readonly intakePerDay: number;
  readonly volumeTrend: BodyShopTrend;
  /** Share of recent intake that is retail / customer-pay [0,1]. */
  readonly retailShare: number;
  /** Share of recent intake that is insurance / DRP claim work [0,1]. */
  readonly insuranceShare: number;
  /** Retail-conquest momentum (rising = the fat-margin channel is growing). */
  readonly retailTrend: BodyShopTrend;
}

/** Persisted trailing state (schemaVersion 1). The intake window stores
 *  `[jobCategory, channel]` pairs so demand heat AND channel mix stay in
 *  lockstep; the day map carries per-day intake counts for the volume readout. */
export interface BodyShopInsightsSnapshot {
  readonly schemaVersion: 1;
  /** Oldest-first trailing intake, capped at `demandWindowSize`. */
  readonly intakeWindow: readonly (readonly [
    BodyShopJobCategory,
    CollisionChannel,
  ])[];
  /** Per-day total intake counts, `[day, count]` pairs. */
  readonly dailyIntake: readonly (readonly [number, number])[];
}

export interface BodyShopInsights {
  /** Per-category demand heat, in fixed `BODY_SHOP_JOB_CATEGORIES` order (all
   *  four categories always present, 0-share when the window holds none). */
  getDemandHeat(): readonly BodyShopDemandHeatEntry[];
  /** Conquest-flow + channel-mix health. */
  getConquestHealth(): ConquestHealth;
  snapshot(): BodyShopInsightsSnapshot;
  restore(snap: BodyShopInsightsSnapshot): void;
}
