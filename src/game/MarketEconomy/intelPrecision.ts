import {
  loadIntelPrecisionConfig,
  type IntelPrecisionConfig,
} from './schemas';

/**
 * Intel-precision tiering (#284, Pricing/Demand spine S12 — Pillar 5).
 *
 * Pricing intel is coarse when the player prices by gut (no Used-Car Manager on
 * staff) and sharpens once a UCM is hired — the "Hire a UCM for a sharper read"
 * promise made real. The same profile drives three surfaces so they can never
 * disagree about how confident the read is:
 *
 *   - the Demand Heat console's band resolution (coarse hot/warm/cold vs a fine
 *     5-band readout with the numeric heat index),
 *   - the pricing screen's days-to-sell range width + confidence cap,
 *   - the pricing screen's suggested-price band tightness.
 *
 * Pure and deterministic: no RNG, no live state. The composition root reads the
 * roster, distills it to a narrow {@link PricingStaffRead}, and resolves a
 * profile once per render. MarketEconomy stays decoupled from StaffOrg — it only
 * ever sees the UCM's pricing skill, never a staff record.
 */

export type IntelLevel = 'coarse' | 'sharp';

export interface IntelPrecision {
  /** Coarse = price by gut (no UCM); sharp = UCM on staff. */
  readonly level: IntelLevel;
  /** Heat-map band resolution: coarse (3-band) or fine (5-band + index). */
  readonly heatGranularity: 'coarse' | 'fine';
  /** Half-width fraction of the surfaced suggested-price band. */
  readonly suggestionBandPct: number;
  /** Half-width fraction of the surfaced days-to-sell range. */
  readonly daysRangePct: number;
  /** Multiplier on the raw days-to-sell confidence (coarse caps it low). */
  readonly confidenceScale: number;
}

export interface PricingStaffRead {
  /**
   * Highest `pricing` skill (0–100) among Used-Car Managers on the roster, or
   * `null` when no UCM is on staff. Null ⇒ the coarse profile; a present skill ⇒
   * the sharp profile, interpolated toward pinpoint as skill rises.
   */
  readonly ucmPricingSkill: number | null;
}

export interface IntelPrecisionDeps {
  readonly config?: IntelPrecisionConfig;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Resolve the intel-precision profile from the pricing-staff read.
 *
 * No UCM ⇒ the flat `coarse` profile. A UCM on staff ⇒ the `sharp` profile, but
 * its numeric knobs lerp from `coarse` toward `sharp` as the UCM's pricing skill
 * climbs to `skillReference` — a green hire is only a touch sharper than gut, a
 * seasoned one is pinpoint. `heatGranularity` flips to fine on UCM *presence*
 * (the instrument is on the lot regardless of skill); only the numeric tightness
 * scales with skill.
 */
export function resolveIntelPrecision(
  read: PricingStaffRead,
  deps: IntelPrecisionDeps = {},
): IntelPrecision {
  const config = deps.config ?? loadIntelPrecisionConfig();
  const { coarse, sharp } = config;

  if (read.ucmPricingSkill == null) {
    return {
      level: 'coarse',
      heatGranularity: coarse.heatGranularity,
      suggestionBandPct: coarse.suggestionBandPct,
      daysRangePct: coarse.daysRangePct,
      confidenceScale: coarse.confidenceScale,
    };
  }

  const t = clamp(read.ucmPricingSkill / sharp.skillReference, 0, 1);
  return {
    level: 'sharp',
    heatGranularity: sharp.heatGranularity,
    suggestionBandPct: lerp(coarse.suggestionBandPct, sharp.suggestionBandPct, t),
    daysRangePct: lerp(coarse.daysRangePct, sharp.daysRangePct, t),
    confidenceScale: lerp(coarse.confidenceScale, sharp.confidenceScale, t),
  };
}
