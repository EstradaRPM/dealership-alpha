import { createEventBus } from '../src/game/EventBus';
import {
  createCareerEndingsMonitor,
  type EndingsTunables,
  type TierManager,
} from '../src/game/CareerProgression';
import type { Economy } from '../src/game/Economy';
import { DAYS_PER_YEAR } from '../src/game/GameClock';

const TUNABLES: EndingsTunables = {
  retire: {
    minCashOnHand: 750_000,
    minCareerYears: 8,
  },
  sellout: {
    minTier: 3,
    offerIntervalDays: 90,
    baseValuation: 1_500_000,
    valuationPerCustomer: 5_000,
  },
  familyHandoff: {
    minCareerYears: 15,
    minTier: 2,
  },
};

function makeEconomy(initialCash: number): Economy {
  let cash = initialCash;
  return {
    get cash() { return cash; },
    inventoryAcquisitionSpend: 0,
    postRevenue: jest.fn((amount: number) => { cash += amount; }),
    postExpense: jest.fn((amount: number) => { cash -= amount; }),
    forceDebit: jest.fn((amount: number) => { cash -= amount; }),
    getPnL: jest.fn().mockReturnValue({
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      entries: [],
    }),
    snapshot: jest.fn().mockReturnValue({ schemaVersion: 1, cash }),
    restore: jest.fn(),
  };
}

function makeTierManager(tier: number, customersServed = 100): TierManager & {
  setTier(t: number): void;
} {
  let current = tier;
  return {
    get currentTier() { return current; },
    get businessName() { return ''; },
    get accentColor() { return ''; },
    get fontId() { return ''; },
    get customersServed() { return customersServed; },
    applyTierUp: jest.fn(),
    applyContraction: jest.fn((to: number) => { current = to; }),
    getSerializableState: jest.fn(),
    restoreState: jest.fn(),
    snapshot: jest.fn(),
    restore: jest.fn(),
    setTier(t: number) { current = t; },
  };
}

const Y = DAYS_PER_YEAR;

describe('CareerEndingsMonitor — retire', () => {
  it('is not eligible when cash is below threshold', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(500_000),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });
    // Year 10 (above tenure threshold), but cash short.
    expect(monitor.canRetire(10 * Y)).toBe(false);
  });

  it('is not eligible when career year is below threshold', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(2_000_000),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });
    // Year 3.
    expect(monitor.canRetire(3 * Y)).toBe(false);
  });

  it('is eligible when both thresholds met and publishes career:retired', () => {
    const bus = createEventBus();
    const retired = jest.fn();
    bus.subscribe('career:retired', retired);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(1_000_000),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });

    const day = 9 * Y;
    expect(monitor.canRetire(day)).toBe(true);
    expect(monitor.retire(day)).toBe(true);
    expect(retired).toHaveBeenCalledWith(
      expect.objectContaining({
        day,
        tier: 2,
        cashOnHand: 1_000_000,
      }),
    );
    expect(monitor.isEnded).toBe(true);
  });

  it('refuses retire when ineligible', () => {
    const bus = createEventBus();
    const retired = jest.fn();
    bus.subscribe('career:retired', retired);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });
    expect(monitor.retire(100)).toBe(false);
    expect(retired).not.toHaveBeenCalled();
    expect(monitor.isEnded).toBe(false);
  });
});

describe('CareerEndingsMonitor — PE sellout', () => {
  it('does not surface offers below Tier 3', () => {
    const bus = createEventBus();
    const offer = jest.fn();
    bus.subscribe('career:pe_offer_made', offer);
    createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });
    for (let day = 1; day <= 365; day++) {
      bus.publish('clock:overnight_payroll', { day });
    }
    expect(offer).not.toHaveBeenCalled();
  });

  it('surfaces an offer at Tier 3 on the first overnight tick', () => {
    const bus = createEventBus();
    const offer = jest.fn();
    bus.subscribe('career:pe_offer_made', offer);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3, 200),
      config: TUNABLES,
    });
    bus.publish('clock:overnight_payroll', { day: 100 });
    expect(offer).toHaveBeenCalledTimes(1);
    expect(monitor.currentOffer).toEqual({
      day: 100,
      tier: 3,
      // baseValuation 1.5M + 200 * 5000 = 2.5M
      amount: 2_500_000,
    });
  });

  it('throttles offers by offerIntervalDays', () => {
    const bus = createEventBus();
    const offer = jest.fn();
    bus.subscribe('career:pe_offer_made', offer);
    createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    for (let day = 100; day < 200; day++) {
      bus.publish('clock:overnight_payroll', { day });
    }
    // Day 100 fires once. Next offer not until day 100 + 90 = 190 (offer at day 190).
    expect(offer).toHaveBeenCalledTimes(2);
  });

  it('acceptSellout banks the cash, publishes career:pe_sellout, ends career', () => {
    const bus = createEventBus();
    const sellout = jest.fn();
    bus.subscribe('career:pe_sellout', sellout);
    const economy = makeEconomy(50_000);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy,
      tierManager: makeTierManager(3, 100),
      config: TUNABLES,
    });

    bus.publish('clock:overnight_payroll', { day: 100 });
    expect(monitor.currentOffer).not.toBeNull();
    const offerAmount = monitor.currentOffer!.amount;

    expect(monitor.acceptSellout(101)).toBe(true);
    expect(economy.postRevenue).toHaveBeenCalledWith(offerAmount, 'PE Sellout');
    expect(sellout).toHaveBeenCalledWith({
      day: 101,
      tier: 3,
      offerAmount,
    });
    expect(monitor.isEnded).toBe(true);
    expect(monitor.currentOffer).toBeNull();
  });

  it('declineSellout clears the current offer without ending the career', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    bus.publish('clock:overnight_payroll', { day: 100 });
    expect(monitor.currentOffer).not.toBeNull();
    expect(monitor.declineSellout(100)).toBe(true);
    expect(monitor.currentOffer).toBeNull();
    expect(monitor.isEnded).toBe(false);
  });

  it('acceptSellout is a no-op when no offer is outstanding', () => {
    const bus = createEventBus();
    const sellout = jest.fn();
    bus.subscribe('career:pe_sellout', sellout);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    expect(monitor.acceptSellout(1)).toBe(false);
    expect(sellout).not.toHaveBeenCalled();
    expect(monitor.isEnded).toBe(false);
  });
});

describe('CareerEndingsMonitor — family handoff', () => {
  it('is not eligible below tenure threshold', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });
    expect(monitor.canFamilyHandoff(10 * Y)).toBe(false);
  });

  it('is not eligible at Tier 1', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });
    expect(monitor.canFamilyHandoff(20 * Y)).toBe(false);
  });

  it('publishes career:family_handoff when triggered', () => {
    const bus = createEventBus();
    const handoff = jest.fn();
    bus.subscribe('career:family_handoff', handoff);
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });
    const day = 16 * Y;
    expect(monitor.familyHandoff(day)).toBe(true);
    expect(handoff).toHaveBeenCalledWith({
      day,
      tier: 2,
      careerYear: 16,
    });
    expect(monitor.isEnded).toBe(true);
  });
});

describe('CareerEndingsMonitor — once-ended is sticky', () => {
  it('rejects further endings after one fires', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(2_000_000),
      tierManager: makeTierManager(3, 500),
      config: TUNABLES,
    });
    expect(monitor.retire(20 * Y)).toBe(true);
    expect(monitor.familyHandoff(20 * Y)).toBe(false);
    bus.publish('clock:overnight_payroll', { day: 20 * Y });
    expect(monitor.currentOffer).toBeNull();
  });
});

describe('CareerEndingsMonitor — state serialization', () => {
  it('round-trips currentOffer and isEnded', () => {
    const bus = createEventBus();
    const monitor = createCareerEndingsMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3, 100),
      config: TUNABLES,
    });
    bus.publish('clock:overnight_payroll', { day: 100 });
    const snapshot = monitor.getSerializableState();

    const bus2 = createEventBus();
    const monitor2 = createCareerEndingsMonitor({
      bus: bus2,
      economy: makeEconomy(0),
      tierManager: makeTierManager(3, 100),
      config: TUNABLES,
    });
    monitor2.restoreState(snapshot);

    expect(monitor2.currentOffer).toEqual(snapshot.currentOffer);
    expect(monitor2.isEnded).toBe(snapshot.isEnded);
  });
});
