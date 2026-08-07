import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { Season } from '../GameClock';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadReputationConfig, type ReputationConfig } from './reputationData';

/** Pre-per-brand persisted shape (#192): the three store-wide scalars. */
export interface ReputationSnapshotV1 {
  readonly schemaVersion: 1;
  readonly customerSatisfaction: number;
  readonly reviewScore: number;
  readonly marketingBudget: number;
}

/**
 * Persistence surface for Reputation (#192, parent #186). Module-owned
 * `schemaVersion`, same convention as Economy/Inventory/Facility. Captures the
 * three live scalars plus the per-brand standings (#151); the demand curve +
 * config are seed/data-derived, not persisted.
 *
 * Per-brand standings joining the blob is the module's own `schemaVersion`
 * **1 → 2** and needs **no envelope bump** — a v1 blob restores as "no make has
 * a record yet", which is the state every pre-#151 save was actually in.
 */
export interface ReputationSnapshot {
  readonly schemaVersion: 2;
  readonly customerSatisfaction: number;
  readonly reviewScore: number;
  readonly marketingBudget: number;
  /** Canonical brand id → standing ∈ [-1, 1]. Unlisted makes are neutral. */
  readonly brandReputation: Readonly<Record<string, number>>;
}

/** Either persisted shape `restore` accepts — the live v2 or a #192 v1. */
export type AnyReputationSnapshot = ReputationSnapshot | ReputationSnapshotV1;

export interface Reputation {
  readonly customerSatisfaction: number;
  readonly reviewScore: number;
  readonly marketingBudget: number;
  setMarketingBudget(weeklyAmount: number): void;
  getDailyDemand(season: Season, dayOfWeek: number): number;
  /**
   * The store's standing selling one make (#151, B2 I6) ∈ [-1, 1]. Keyed by the
   * **canonical brand id** (#224 — never a display string), which is the same
   * join key `pickVehicleFor` scores a lot vehicle by. A make the store has
   * never delivered reads 0: no record is neutral, not bad.
   *
   * Ambient depth, not a dashboard — the player never reads this number. It
   * reaches them through the match (a distrusted make loses ground to its twin)
   * and, later, as Reveal reaction text.
   */
  repFor(brand: string): number;
  /** #192 SaveStore seam: capture/rehydrate the reputation scalars. */
  snapshot(): ReputationSnapshot;
  restore(snap: AnyReputationSnapshot): void;
}

export interface ReputationDeps {
  bus: EventBus;
  economy?: Economy;
  config?: ReputationConfig;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The per-brand standing's range (#151). Not a tunable — it is the interface
 * contract `repFor` promises its callers, and the matcher's `matchWeight`
 * (`data/tunables.json#reputation.brandReputation`) is what scales it to the
 * argmax. A configurable range would make that weight mean two things.
 */
const BRAND_REP_MIN = -1;
const BRAND_REP_MAX = 1;

export function createReputation(deps: ReputationDeps): Reputation {
  const { bus, economy } = deps;
  const config = deps.config ?? loadReputationConfig();

  let satisfaction = clamp(
    config.startingSatisfaction,
    config.satisfactionMin,
    config.satisfactionMax,
  );
  let review = clamp(
    config.startingReviewScore,
    config.satisfactionMin,
    config.satisfactionMax,
  );
  let marketingBudget = 0;
  /** Canonical brand id → standing ∈ [BRAND_REP_MIN, BRAND_REP_MAX] (#151). */
  const brandRep = new Map<string, number>();

  function adjustBrand(brand: string, delta: number): void {
    const next = clamp((brandRep.get(brand) ?? 0) + delta, BRAND_REP_MIN, BRAND_REP_MAX);
    brandRep.set(brand, next);
  }

  function adjustSatisfaction(delta: number): void {
    satisfaction = clamp(satisfaction + delta, config.satisfactionMin, config.satisfactionMax);
  }

  function adjustReview(delta: number): void {
    review = clamp(review + delta, config.satisfactionMin, config.satisfactionMax);
  }

  bus.subscribe('deal:closed', () => {
    adjustSatisfaction(config.closedDealSatisfactionBonus);
    adjustReview(config.closedDealReviewBonus);
  });

  bus.subscribe('customer:resolved', ({ outcome }) => {
    if (outcome === 'walk') {
      adjustSatisfaction(config.walkSatisfactionPenalty);
    }
  });

  bus.subscribe('reputation:satisfaction_hit', ({ amount }) => {
    adjustSatisfaction(amount);
  });

  // Per-brand standing (#151, B2 I6) — carried from SOLD deals and nothing else.
  // A walk is a customer who never owned the car, so it says nothing about the
  // make. `staff:auto_resolved` is the live outcome truth (#180): it carries the
  // close that actually happened, including `badReview` (the low-trust forced
  // close), which `deal:closed` does not.
  bus.subscribe('staff:auto_resolved', ({ outcome, brand, badReview }) => {
    if (outcome !== 'closed' || !brand) return;
    adjustBrand(
      brand,
      badReview
        ? config.brandReputation.badReviewPenalty
        : config.brandReputation.closedDealBonus,
    );
  });

  // Overnight: reviewScore drifts toward current satisfaction (lag indicator);
  // satisfaction drifts gently toward equilibrium so a single great/awful day
  // doesn't pin reputation forever.
  bus.subscribe('clock:overnight_reputation_drift', () => {
    review = clamp(
      review + (satisfaction - review) * config.reviewDriftRate,
      config.satisfactionMin,
      config.satisfactionMax,
    );
    satisfaction = clamp(
      satisfaction +
        (config.satisfactionEquilibrium - satisfaction) * config.satisfactionDriftRate,
      config.satisfactionMin,
      config.satisfactionMax,
    );
    // Per-brand standing mean-reverts on the same night and by the same rule as
    // the store-wide scalars (#151): a make the store stopped selling badly
    // recovers. Without it one rough early run would stain a brand for the whole
    // career — a trap, not depth.
    for (const [brand, value] of brandRep) {
      brandRep.set(brand, value * (1 - config.brandReputation.driftRate));
    }
  });

  // Weekly marketing debit on payroll night (same cadence as rent/payroll).
  bus.subscribe('clock:overnight_payroll', ({ day }) => {
    if (!economy || marketingBudget <= 0) return;
    if (day % DAYS_PER_WEEK !== 0) return;
    economy.postExpense(marketingBudget, 'Marketing');
  });

  function marketingFactor(): number {
    const saturated = Math.min(1, marketingBudget / config.marketingSaturation);
    return saturated * config.marketingMaxBoost;
  }

  return {
    get customerSatisfaction() { return satisfaction; },
    get reviewScore() { return review; },
    get marketingBudget() { return marketingBudget; },

    setMarketingBudget(weeklyAmount) {
      if (weeklyAmount < 0) throw new Error('Marketing budget must be non-negative');
      marketingBudget = weeklyAmount;
    },

    getDailyDemand(season, dayOfWeek) {
      const seasonMult = config.seasonDemandMultiplier[season] ?? 1;
      const dowMult = config.dayOfWeekDemandMultiplier[String(dayOfWeek)] ?? 1;
      const repMult = 1 + (review - 50) * config.demandReviewSlope;
      const mktMult = 1 + marketingFactor();
      const raw = config.baseDailyDemand * repMult * mktMult * seasonMult * dowMult;
      return Math.max(0, raw);
    },

    repFor(brand) {
      return brandRep.get(brand) ?? 0;
    },

    snapshot() {
      return {
        schemaVersion: 2,
        customerSatisfaction: satisfaction,
        reviewScore: review,
        marketingBudget,
        brandReputation: Object.fromEntries(brandRep),
      };
    },

    restore(snap) {
      satisfaction = clamp(
        snap.customerSatisfaction,
        config.satisfactionMin,
        config.satisfactionMax,
      );
      review = clamp(snap.reviewScore, config.satisfactionMin, config.satisfactionMax);
      marketingBudget = Math.max(0, snap.marketingBudget);
      brandRep.clear();
      // A v1 blob predates per-brand standing, so it restores as "no make has a
      // record yet" — which is the state that save was actually in.
      if (snap.schemaVersion === 2) {
        for (const [brand, value] of Object.entries(snap.brandReputation)) {
          brandRep.set(brand, clamp(value, BRAND_REP_MIN, BRAND_REP_MAX));
        }
      }
    },
  };
}
