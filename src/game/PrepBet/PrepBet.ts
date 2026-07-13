/**
 * PrepBet — the captured morning wager (engagement spine tracer S4, #322,
 * design record `docs/planning/engagement-spine.md` §5).
 *
 * For the day-close Reveal to score "your bet," the bet has to be captured. At
 * T1 the bet is the morning prep posture: **the category the lot leans heaviest
 * into (your stocking bet), read against the demand-heat read** the player saw
 * at prep (DemandShaper segment heat + the Weather attribute lean folded down to
 * the same sedan/truck/suv categories). This module is the pure capture: it
 * turns the morning lot + the two demand signals into a small, persisted
 * `PrepBet` snapshot that `buildReveal` resolves at day close.
 *
 * No new mechanics — framing + one expectation-capture (design record §5). The
 * verdict copy (who won the bet, in plain language) lives with the Reveal
 * renderer; this module only decides *what the bet was*.
 */

/** The vehicle-type universe the bet is stated in — the DemandShaper segment
 *  ids and `LotVehicle.category` share this exact union. */
export type PrepCategory = 'sedan' | 'truck' | 'suv';

const PREP_CATEGORIES: readonly PrepCategory[] = ['sedan', 'truck', 'suv'];

/** The captured morning posture for one day — persisted (#122-safe) so the
 *  day-close Reveal resolves the bet even across a mid-day reload. */
export interface PrepBet {
  /** The day this posture was captured for. */
  readonly day: number;
  /** The category the morning lot leaned heaviest into — the stocking bet.
   *  `null` for an empty lot or a dead tie (no clear lean). */
  readonly stockedCategory: PrepCategory | null;
  /** `stockedCategory`'s share of the morning lot (0–1); 0 when null. */
  readonly stockedShare: number;
  /** The morning demand-heat read's top category — DemandShaper heat + the
   *  Weather attribute lean. `null` when the read is flat (no clear favorite).
   *  Stands in for "the crowd" at day close when the day itself was too quiet
   *  to speak. */
  readonly readCategory: PrepCategory | null;
}

/** Tunable fold of the Weather attribute lean into the sedan/truck/suv demand
 *  read (`data/tunables.json` → `reveal.prepBet`). */
export interface PrepBetConfig {
  /** How strongly the Weather attribute lean can move the read vs. the
   *  DemandShaper baseline heat. */
  readonly weatherWeight: number;
  /** Per-category representative attribute vector over the Weather axes
   *  (`winterCapability` / `openAir` / `fuelEfficiency`), each in [0,1]. The
   *  weather bonus for a category mirrors the matcher's own
   *  `Σ lean·(attr − 0.5)` so the read agrees with how weather actually biases
   *  the floor. */
  readonly categoryAttributeProfiles: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

function isPrepCategory(c: string): c is PrepCategory {
  return c === 'sedan' || c === 'truck' || c === 'suv';
}

/**
 * Stable-order argmax over the three categories. Returns the strict unique
 * winner, or `null` when the top is a tie or non-positive (no clear signal) —
 * an honest "no lean / no read" instead of an arbitrary pick.
 */
function argmaxCategory(scoreOf: (c: PrepCategory) => number): PrepCategory | null {
  let best: PrepCategory | null = null;
  let bestScore = -Infinity;
  let tied = false;
  for (const c of PREP_CATEGORIES) {
    const score = scoreOf(c);
    if (score > bestScore) {
      best = c;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }
  return best !== null && bestScore > 0 && !tied ? best : null;
}

/** The Weather attribute lean projected onto one category: `Σ lean·(attr − 0.5)`
 *  over the shared axes — the same shape `pickVehicleForMatch` scores per unit. */
function weatherCategoryBonus(
  category: PrepCategory,
  attributeLean: Readonly<Record<string, number>>,
  config: PrepBetConfig,
): number {
  const profile = config.categoryAttributeProfiles[category];
  if (!profile) return 0;
  let bonus = 0;
  for (const [axis, delta] of Object.entries(attributeLean)) {
    const attr = profile[axis];
    if (attr === undefined) continue;
    bonus += delta * (attr - 0.5);
  }
  return bonus;
}

/**
 * Capture the morning prep bet. Pure + deterministic: the lot mix decides the
 * stocking bet; the DemandShaper heat plus the Weather attribute lean decide the
 * demand read. Both sides are stated in the same category vocabulary the Reveal
 * scores against.
 */
export function computePrepBet(input: {
  day: number;
  /** The morning lot — `Inventory.getLotVehicles()`. */
  lot: readonly { category: string }[];
  /** DemandShaper forward heat map, `getMix()` (normalized per category). */
  demandMix: Readonly<Record<string, number>>;
  /** Weather's per-axis attribute lean for the day, `attributeLeanForDay(day)`. */
  weatherAttrLean: Readonly<Record<string, number>>;
  config: PrepBetConfig;
}): PrepBet {
  const { day, lot, demandMix, weatherAttrLean, config } = input;

  // Stocking bet: the category the lot leans heaviest into.
  const counts: Record<PrepCategory, number> = { sedan: 0, truck: 0, suv: 0 };
  for (const vehicle of lot) {
    if (isPrepCategory(vehicle.category)) counts[vehicle.category] += 1;
  }
  const stockedCategory =
    lot.length > 0 ? argmaxCategory((c) => counts[c]) : null;
  const stockedShare = stockedCategory ? counts[stockedCategory] / lot.length : 0;

  // Demand-heat read: DemandShaper baseline heat + the Weather attribute lean.
  const readCategory = argmaxCategory(
    (c) =>
      (demandMix[c] ?? 0) +
      config.weatherWeight * weatherCategoryBonus(c, weatherAttrLean, config),
  );

  return { day, stockedCategory, stockedShare, readCategory };
}

/** A tiny mutable holder for the current day's prep bet — a World-level scalar
 *  (mirrors the service/body-shop posture holders), persisted via
 *  `worldSnapshot` so the frozen morning bet survives a mid-day reload (#122). */
export interface PrepBetHolder {
  get(): PrepBet | null;
  set(bet: PrepBet | null): void;
}

export function createPrepBetHolder(initial: PrepBet | null = null): PrepBetHolder {
  let current = initial;
  return {
    get: () => current,
    set: (bet) => {
      current = bet;
    },
  };
}
