import { createEventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createReputation, type ReputationConfig } from '../src/game/Reputation';
import { createEconomy } from '../src/game/Economy';

const CONFIG: ReputationConfig = {
  startingSatisfaction: 70,
  startingReviewScore: 60,
  satisfactionMin: 0,
  satisfactionMax: 100,
  closedDealSatisfactionBonus: 3,
  closedDealReviewBonus: 1,
  walkSatisfactionPenalty: -1,
  reviewDriftRate: 0.1,
  satisfactionEquilibrium: 50,
  satisfactionDriftRate: 0.02,
  baseDailyDemand: 2,
  demandReviewSlope: 0.015,
  marketingSaturation: 1000,
  marketingMaxBoost: 0.6,
  seasonDemandMultiplier: { spring: 1, summer: 1.15, fall: 1.05, winter: 0.85 },
  dayOfWeekDemandMultiplier: {
    '0': 0.9, '1': 1.0, '2': 1.0, '3': 1.05, '4': 1.15, '5': 1.4, '6': 0.7,
  },
};

function makeSetup(overrides: Partial<ReputationConfig> = {}) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({
    bus,
    startingCash: 100_000,
    config: { weeklyRent: 0, weeklyPayrollStub: 0 },
  });
  const reputation = createReputation({
    bus,
    economy,
    config: { ...CONFIG, ...overrides },
  });
  return { bus, clock, economy, reputation };
}

function publishDealClosed(bus: ReturnType<typeof createEventBus>, customerId = 'c1') {
  bus.publish('deal:closed', {
    customerId,
    vehicleId: 'v1',
    agreedPrice: 25_000,
    frontGross: 2000,
    backGross: 800,
    daysInInventory: 0,
    paymentMethod: 'cash',
    downPayment: 25_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

function publishWalk(bus: ReturnType<typeof createEventBus>, customerId = 'c1') {
  bus.publish('customer:resolved', { customerId, outcome: 'walk', receptivity: 0, satisfaction: 0, retentionSeed: 0, heat: 0, agreedPrice: 0, frontGross: 0 });
}

describe('Reputation — initial state', () => {
  it('exposes starting satisfaction and reviewScore', () => {
    const { reputation } = makeSetup();
    expect(reputation.customerSatisfaction).toBe(70);
    expect(reputation.reviewScore).toBe(60);
  });

  it('clamps starting values to [0, 100]', () => {
    const { reputation } = makeSetup({ startingSatisfaction: 150, startingReviewScore: -10 });
    expect(reputation.customerSatisfaction).toBe(100);
    expect(reputation.reviewScore).toBe(0);
  });
});

describe('Reputation — event responses', () => {
  it('closed deals raise both satisfaction and review', () => {
    const { bus, reputation } = makeSetup({ startingSatisfaction: 50, startingReviewScore: 50 });
    publishDealClosed(bus);
    expect(reputation.customerSatisfaction).toBe(53);
    expect(reputation.reviewScore).toBe(51);
  });

  it('walks lower satisfaction', () => {
    const { bus, reputation } = makeSetup({ startingSatisfaction: 50 });
    publishWalk(bus);
    expect(reputation.customerSatisfaction).toBe(49);
  });

  it('reputation:satisfaction_hit applies the given delta', () => {
    const { bus, reputation } = makeSetup({ startingSatisfaction: 50 });
    bus.publish('reputation:satisfaction_hit', { day: 1, amount: -5, reason: 'missed_opportunity' });
    expect(reputation.customerSatisfaction).toBe(45);
  });

  it('clamps satisfaction at the floor', () => {
    const { bus, reputation } = makeSetup({ startingSatisfaction: 2 });
    bus.publish('reputation:satisfaction_hit', { day: 1, amount: -50, reason: 'x' });
    expect(reputation.customerSatisfaction).toBe(0);
  });

  it('clamps satisfaction at the ceiling', () => {
    const { bus, reputation } = makeSetup({ startingSatisfaction: 99 });
    for (let i = 0; i < 5; i++) publishDealClosed(bus, `c${i}`);
    expect(reputation.customerSatisfaction).toBe(100);
  });
});

describe('Reputation — overnight drift', () => {
  it('reviewScore drifts toward satisfaction', () => {
    const { clock, reputation } = makeSetup({ startingSatisfaction: 90, startingReviewScore: 50 });
    const before = reputation.reviewScore;
    clock.advanceDay();
    expect(reputation.reviewScore).toBeGreaterThan(before);
    expect(reputation.reviewScore).toBeLessThan(reputation.customerSatisfaction);
  });

  it('satisfaction drifts toward equilibrium when no events fire', () => {
    const { clock, reputation } = makeSetup({ startingSatisfaction: 90, startingReviewScore: 90 });
    const before = reputation.customerSatisfaction;
    clock.advanceDay();
    expect(reputation.customerSatisfaction).toBeLessThan(before);
    expect(reputation.customerSatisfaction).toBeGreaterThan(CONFIG.satisfactionEquilibrium);
  });

  it('drift is monotonic with no other inputs (recovery from low)', () => {
    const { clock, reputation } = makeSetup({ startingSatisfaction: 10, startingReviewScore: 10 });
    let prevSat = reputation.customerSatisfaction;
    let prevRev = reputation.reviewScore;
    for (let i = 0; i < 20; i++) {
      clock.advanceDay();
      expect(reputation.customerSatisfaction).toBeGreaterThanOrEqual(prevSat);
      expect(reputation.reviewScore).toBeGreaterThanOrEqual(prevRev);
      prevSat = reputation.customerSatisfaction;
      prevRev = reputation.reviewScore;
    }
  });

  it('drift is monotonic with no other inputs (decay from high)', () => {
    const { clock, reputation } = makeSetup({ startingSatisfaction: 95, startingReviewScore: 95 });
    let prevSat = reputation.customerSatisfaction;
    let prevRev = reputation.reviewScore;
    for (let i = 0; i < 20; i++) {
      clock.advanceDay();
      expect(reputation.customerSatisfaction).toBeLessThanOrEqual(prevSat);
      expect(reputation.reviewScore).toBeLessThanOrEqual(prevRev);
      prevSat = reputation.customerSatisfaction;
      prevRev = reputation.reviewScore;
    }
  });
});

describe('Reputation — marketing budget', () => {
  it('setMarketingBudget stores the weekly amount', () => {
    const { reputation } = makeSetup();
    reputation.setMarketingBudget(500);
    expect(reputation.marketingBudget).toBe(500);
  });

  it('rejects negative budgets', () => {
    const { reputation } = makeSetup();
    expect(() => reputation.setMarketingBudget(-1)).toThrow();
  });

  it('Economy debits marketing on weekly payroll night', () => {
    const { clock, economy, reputation } = makeSetup();
    reputation.setMarketingBudget(400);
    const cashBefore = economy.cash;

    // advance 6 days — no debit yet (day 7 is the first multiple of 7)
    for (let i = 0; i < 6; i++) clock.advanceDay();
    expect(economy.cash).toBe(cashBefore);

    // day 7's overnight: debit fires
    clock.advanceDay();
    expect(economy.cash).toBe(cashBefore - 400);
  });

  it('no debit when budget is 0', () => {
    const { clock, economy } = makeSetup();
    const before = economy.cash;
    for (let i = 0; i < 7; i++) clock.advanceDay();
    expect(economy.cash).toBe(before);
  });
});

describe('Reputation — daily demand', () => {
  it('baseDailyDemand at neutral review/no marketing/spring/Wednesday', () => {
    const { reputation } = makeSetup({ startingReviewScore: 50 });
    // spring × dow 2 (=1.0) × repMult(1) × mktMult(1) = base
    expect(reputation.getDailyDemand('spring', 2)).toBeCloseTo(2);
  });

  it('higher reviewScore yields higher demand', () => {
    const a = makeSetup({ startingReviewScore: 30 }).reputation.getDailyDemand('spring', 2);
    const b = makeSetup({ startingReviewScore: 80 }).reputation.getDailyDemand('spring', 2);
    expect(b).toBeGreaterThan(a);
  });

  it('marketing increases demand monotonically with diminishing returns', () => {
    const { reputation } = makeSetup({ startingReviewScore: 50 });
    const d0 = reputation.getDailyDemand('spring', 2);
    reputation.setMarketingBudget(500);
    const d500 = reputation.getDailyDemand('spring', 2);
    reputation.setMarketingBudget(1000);
    const d1000 = reputation.getDailyDemand('spring', 2);
    reputation.setMarketingBudget(2000);
    const d2000 = reputation.getDailyDemand('spring', 2);
    expect(d500).toBeGreaterThan(d0);
    expect(d1000).toBeGreaterThan(d500);
    // saturation: 2000 capped at the same level as 1000
    expect(d2000).toBeCloseTo(d1000);
  });

  it('saturday demand exceeds wednesday demand at same rep', () => {
    const { reputation } = makeSetup();
    const wed = reputation.getDailyDemand('spring', 2);
    const sat = reputation.getDailyDemand('spring', 5);
    expect(sat).toBeGreaterThan(wed);
  });

  it('summer demand exceeds winter demand at same rep', () => {
    const { reputation } = makeSetup();
    const summer = reputation.getDailyDemand('summer', 2);
    const winter = reputation.getDailyDemand('winter', 2);
    expect(summer).toBeGreaterThan(winter);
  });

  it('demand never negative even at zero review', () => {
    const { reputation } = makeSetup({ startingReviewScore: 0 });
    expect(reputation.getDailyDemand('winter', 6)).toBeGreaterThanOrEqual(0);
  });
});

// ── Closed-loop simulation: reputation → demand → reputation ─────────────────

describe('Reputation — closed loop over multiple weeks', () => {
  function simulateWeeks(opts: {
    weeks: number;
    closeRate: number;
    config?: Partial<ReputationConfig>;
    marketing?: number;
  }) {
    const { bus, clock, reputation } = makeSetup(opts.config);
    if (opts.marketing) reputation.setMarketingBudget(opts.marketing);

    const samples: Array<{ day: number; review: number; sat: number; demand: number }> = [];
    let custCounter = 0;

    for (let w = 0; w < opts.weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const demand = reputation.getDailyDemand(clock.currentSeason, clock.dayOfWeek);
        const arrivals = Math.max(1, Math.round(demand));
        for (let i = 0; i < arrivals; i++) {
          const cid = `c${custCounter++}`;
          if (Math.random() < opts.closeRate) {
            publishDealClosed(bus, cid);
          } else {
            publishWalk(bus, cid);
          }
        }
        samples.push({
          day: clock.currentDay,
          review: reputation.reviewScore,
          sat: reputation.customerSatisfaction,
          demand,
        });
        clock.advanceDay();
      }
    }
    return samples;
  }

  it('high close rate trends review upward over 8 weeks', () => {
    const samples = simulateWeeks({ weeks: 8, closeRate: 0.9 });
    const first = samples[0].review;
    const last = samples[samples.length - 1].review;
    expect(last).toBeGreaterThan(first);
  });

  it('all-walks drives review downward over 8 weeks', () => {
    const samples = simulateWeeks({ weeks: 8, closeRate: 0 });
    const first = samples[0].review;
    const last = samples[samples.length - 1].review;
    expect(last).toBeLessThan(first);
  });

  it('marketing-on yields higher cumulative demand than marketing-off', () => {
    const withoutMkt = simulateWeeks({ weeks: 4, closeRate: 0.5 });
    const withMkt = simulateWeeks({ weeks: 4, closeRate: 0.5, marketing: 800 });
    const sumA = withoutMkt.reduce((s, x) => s + x.demand, 0);
    const sumB = withMkt.reduce((s, x) => s + x.demand, 0);
    expect(sumB).toBeGreaterThan(sumA);
  });
});
