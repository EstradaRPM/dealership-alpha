import { createEventBus } from '../src/game/EventBus';
import { createTierManager } from '../src/game/CareerProgression';
import type { TierConfig } from '../src/game/CareerProgression';
import type { Economy } from '../src/game/Economy';
import type { Reputation } from '../src/game/Reputation';

const STUB_CONFIG: TierConfig = {
  checkIntervalDays: 28,
  tiers: [
    { tier: 1, label: 'Gravel Yard', illustration: '🏚', caption: 'awaits' },
    {
      tier: 2,
      label: 'Paved Lot',
      illustration: '🏗',
      caption: 'taking shape',
      triggerThreshold: { minCashOnHand: 1000, minCustomersServed: 5, minReputationScore: 60 },
    },
    {
      tier: 3,
      label: 'Small Showroom',
      illustration: '🏢',
      caption: 'worth protecting',
      triggerThreshold: { minCashOnHand: 5000, minCustomersServed: 15, minReputationScore: 70 },
    },
  ],
  accentOptions: [
    { id: 'gold', label: 'Gold', color: '#c8a96e' },
    { id: 'cobalt', label: 'Cobalt', color: '#4a9eff' },
  ],
  fontOptions: [
    { id: 'classic', label: 'Classic' },
    { id: 'prestige', label: 'Prestige' },
  ],
};

function makeEconomy(cash: number): Economy {
  return {
    get cash() { return cash; },
    postRevenue: jest.fn(),
    postExpense: jest.fn(),
    forceDebit: jest.fn(),
    getPnL: jest.fn().mockReturnValue({ totalRevenue: 0, totalExpenses: 0, netIncome: 0, entries: [] }),
    snapshot: jest.fn().mockReturnValue({ schemaVersion: 1, cash }),
    restore: jest.fn(),
  };
}

function makeReputation(score: number): Reputation {
  return {
    get customerSatisfaction() { return score; },
    get reviewScore() { return score; },
    get marketingBudget() { return 0; },
    setMarketingBudget: jest.fn(),
    getDailyDemand: jest.fn().mockReturnValue(3),
  };
}

function simulateCustomersServed(bus: ReturnType<typeof createEventBus>, count: number) {
  for (let i = 0; i < count; i++) {
    bus.publish('customer:resolved', { customerId: `c${i}`, outcome: 'closed', receptivity: 0.5, satisfaction: 1, retentionSeed: 0.5, heat: 0, agreedPrice: 0, frontGross: 0 });
  }
}

function simulateMonthEnd(bus: ReturnType<typeof createEventBus>, day: number) {
  bus.publish('clock:overnight_payroll', { day });
}

describe('TierManager — trigger evaluation', () => {
  it('starts at tier 1 with zero customers served', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      economy: makeEconomy(0),
      reputation: makeReputation(50),
      config: STUB_CONFIG,
    });
    expect(tm.currentTier).toBe(1);
    expect(tm.customersServed).toBe(0);
  });

  it('increments customersServed on each customer:resolved event', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      economy: makeEconomy(0),
      reputation: makeReputation(50),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 3);
    expect(tm.customersServed).toBe(3);
  });

  it('does not trigger tier-up when check interval has not been reached', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      economy: makeEconomy(9999),
      reputation: makeReputation(99),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 10);
    simulateMonthEnd(bus, 7); // not divisible by 28
    expect(tm.currentTier).toBe(1);
  });

  it('does not trigger tier-up when thresholds are not met', () => {
    const bus = createEventBus();
    const tierUpHandler = jest.fn();
    bus.subscribe('career:tier_up', tierUpHandler);

    const tm = createTierManager({
      bus,
      economy: makeEconomy(500),        // below minCashOnHand: 1000
      reputation: makeReputation(62),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 10);
    simulateMonthEnd(bus, 28);

    expect(tm.currentTier).toBe(1);
    expect(tierUpHandler).not.toHaveBeenCalled();
  });

  it('triggers tier-up and publishes career:tier_up when all thresholds met', () => {
    const bus = createEventBus();
    const tierUpHandler = jest.fn();
    bus.subscribe('career:tier_up', tierUpHandler);

    const tm = createTierManager({
      bus,
      economy: makeEconomy(1500),
      reputation: makeReputation(65),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 6);
    simulateMonthEnd(bus, 28);

    expect(tm.currentTier).toBe(2);
    expect(tierUpHandler).toHaveBeenCalledWith({ fromTier: 1, toTier: 2, day: 28 });
  });

  it('does not trigger twice on consecutive month-end checks once already tiered up', () => {
    const bus = createEventBus();
    const tierUpHandler = jest.fn();
    bus.subscribe('career:tier_up', tierUpHandler);

    const tm = createTierManager({
      bus,
      economy: makeEconomy(1500),
      reputation: makeReputation(65),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 6);
    simulateMonthEnd(bus, 28);
    simulateMonthEnd(bus, 56); // second month-end; still below tier 3 thresholds

    expect(tm.currentTier).toBe(2);
    expect(tierUpHandler).toHaveBeenCalledTimes(1);
  });

  it('does not advance beyond the final tier', () => {
    const bus = createEventBus();
    const tierUpHandler = jest.fn();
    bus.subscribe('career:tier_up', tierUpHandler);

    const tm = createTierManager({
      bus,
      economy: makeEconomy(999999),
      reputation: makeReputation(99),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 50);
    simulateMonthEnd(bus, 28);  // tier 1 → 2
    simulateMonthEnd(bus, 56);  // tier 2 → 3
    simulateMonthEnd(bus, 84);  // no tier 4 exists

    expect(tm.currentTier).toBe(3);
    expect(tierUpHandler).toHaveBeenCalledTimes(2);
  });
});

describe('TierManager — applyTierUp and state serialization', () => {
  it('applyTierUp persists branding choices', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      economy: makeEconomy(0),
      reputation: makeReputation(50),
      config: STUB_CONFIG,
    });
    tm.applyTierUp({ businessName: 'Estrada Motors', accentColor: '#4a9eff', fontId: 'prestige' });
    expect(tm.businessName).toBe('Estrada Motors');
    expect(tm.accentColor).toBe('#4a9eff');
    expect(tm.fontId).toBe('prestige');
  });

  it('getSerializableState round-trips through restoreState', () => {
    const bus = createEventBus();
    const tm = createTierManager({
      bus,
      economy: makeEconomy(1500),
      reputation: makeReputation(65),
      config: STUB_CONFIG,
    });
    simulateCustomersServed(bus, 6);
    simulateMonthEnd(bus, 28);
    tm.applyTierUp({ businessName: 'Revived Rides', accentColor: '#c0392b', fontId: 'classic' });

    const snapshot = tm.getSerializableState();

    const bus2 = createEventBus();
    const tm2 = createTierManager({
      bus: bus2,
      economy: makeEconomy(0),
      reputation: makeReputation(50),
      config: STUB_CONFIG,
    });
    tm2.restoreState(snapshot);

    expect(tm2.currentTier).toBe(2);
    expect(tm2.businessName).toBe('Revived Rides');
    expect(tm2.accentColor).toBe('#c0392b');
    expect(tm2.customersServed).toBe(6);
  });
});
