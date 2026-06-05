import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { Season } from '../GameClock';
import { DAYS_PER_WEEK } from '../GameClock';
import { loadReputationConfig, type ReputationConfig } from './reputationData';

/**
 * Persistence surface for Reputation (#192, parent #186). Module-owned
 * `schemaVersion`, same convention as Economy/Inventory. Captures the three
 * live scalars; the demand curve + config are seed/data-derived, not persisted.
 */
export interface ReputationSnapshot {
  readonly schemaVersion: 1;
  readonly customerSatisfaction: number;
  readonly reviewScore: number;
  readonly marketingBudget: number;
}

export interface Reputation {
  readonly customerSatisfaction: number;
  readonly reviewScore: number;
  readonly marketingBudget: number;
  setMarketingBudget(weeklyAmount: number): void;
  getDailyDemand(season: Season, dayOfWeek: number): number;
  /** #192 SaveStore seam: capture/rehydrate the reputation scalars. */
  snapshot(): ReputationSnapshot;
  restore(snap: ReputationSnapshot): void;
}

export interface ReputationDeps {
  bus: EventBus;
  economy?: Economy;
  config?: ReputationConfig;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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

    snapshot() {
      return {
        schemaVersion: 1,
        customerSatisfaction: satisfaction,
        reviewScore: review,
        marketingBudget,
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
    },
  };
}
