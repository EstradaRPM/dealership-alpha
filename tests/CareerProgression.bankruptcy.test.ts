import { createEventBus } from '../src/game/EventBus';
import {
  createBankruptcyMonitor,
  type FailureTunables,
} from '../src/game/CareerProgression';
import type { Economy } from '../src/game/Economy';
import type { TierManager } from '../src/game/CareerProgression';

const TUNABLES: FailureTunables = {
  cashFloor: 0,
  consecutiveDaysToTrigger: 3,
  tier2: { debtPrincipal: 50000, weeklyDebtPayment: 2000 },
  tier3Plus: { complianceCost: 30000, reputationHit: -15 },
};

interface MutableEconomy extends Economy {
  setCash(value: number): void;
  debits: Array<{ amount: number; label: string }>;
}

function makeEconomy(initialCash: number): MutableEconomy {
  let cash = initialCash;
  const debits: Array<{ amount: number; label: string }> = [];
  return {
    get cash() { return cash; },
    inventoryAcquisitionSpend: 0,
    setCash(value: number) { cash = value; },
    postRevenue: jest.fn(),
    postExpense: jest.fn(),
    forceDebit: jest.fn((amount: number, label: string) => {
      cash -= amount;
      debits.push({ amount, label });
    }),
    postCostOfSale: jest.fn(),
    getPnL: jest.fn().mockReturnValue({
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      entries: [],
    }),
    getDepartmentPnL: jest.fn().mockReturnValue({
      departments: [],
      overhead: 0,
      netIncome: 0,
    }),
    snapshot: jest.fn().mockReturnValue({ schemaVersion: 1, cash }),
    restore: jest.fn(),
    debits,
  };
}

function makeTierManager(tier: number): TierManager & { setTier(t: number): void } {
  let current = tier;
  return {
    get currentTier() { return current; },
    get businessName() { return ''; },
    get accentColor() { return ''; },
    get fontId() { return ''; },
    get customersServed() { return 0; },
    get monthStreak() { return 0; },
    get requiredStreak() { return current; },
    get dossierReady() { return false; },
    applyTierUp: jest.fn(),
    applyContraction: jest.fn((to: number) => { current = to; }),
    getSerializableState: jest.fn(),
    restoreState: jest.fn(),
    snapshot: jest.fn(),
    restore: jest.fn(),
    setTier(t: number) { current = t; },
  };
}

function tick(bus: ReturnType<typeof createEventBus>, day: number) {
  bus.publish('clock:overnight_payroll', { day });
}

describe('BankruptcyMonitor — insolvency detection', () => {
  it('does not trigger when cash stays at or above cashFloor', () => {
    const bus = createEventBus();
    const economy = makeEconomy(100);
    const tm = makeTierManager(1);
    const terminal = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    for (let d = 1; d <= 10; d++) tick(bus, d);

    expect(monitor.insolventDayCount).toBe(0);
    expect(terminal).not.toHaveBeenCalled();
  });

  it('counts consecutive insolvent overnights but resets on recovery', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-50);
    const tm = makeTierManager(1);
    const terminal = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    tick(bus, 1);
    tick(bus, 2);
    expect(monitor.insolventDayCount).toBe(2);
    economy.setCash(100); // recovery
    tick(bus, 3);
    expect(monitor.insolventDayCount).toBe(0);
    expect(terminal).not.toHaveBeenCalled();
  });
});

describe('BankruptcyMonitor — Tier 1 terminal', () => {
  it('publishes career:bankruptcy_terminal after N consecutive insolvent overnights', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-10);
    const tm = makeTierManager(1);
    const terminal = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    tick(bus, 1);
    tick(bus, 2);
    expect(terminal).not.toHaveBeenCalled();
    tick(bus, 3);

    expect(terminal).toHaveBeenCalledWith({ day: 3, tier: 1 });
    expect(monitor.isTerminal).toBe(true);
  });

  it('stops processing once terminal', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-10);
    const tm = makeTierManager(1);
    const terminal = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    for (let d = 1; d <= 10; d++) tick(bus, d);

    expect(terminal).toHaveBeenCalledTimes(1);
  });
});

describe('BankruptcyMonitor — Tier 2 contraction', () => {
  it('drops tier to 1, loads debt principal, publishes contraction event', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-100);
    const tm = makeTierManager(2);
    const contraction = jest.fn();
    bus.subscribe('career:bankruptcy_contraction', contraction);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    tick(bus, 1);
    tick(bus, 2);
    tick(bus, 3);

    expect(tm.currentTier).toBe(1);
    expect(monitor.outstandingDebt).toBe(50000);
    expect(contraction).toHaveBeenCalledWith({
      day: 3,
      fromTier: 2,
      debtPrincipal: 50000,
    });
  });

  it('services weekly debt payments via forceDebit until paid off', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-100);
    const tm = makeTierManager(2);
    const paymentEvents = jest.fn();
    bus.subscribe('career:debt_payment_made', paymentEvents);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    // Trigger contraction on day 3 (not a week boundary, so no payment yet).
    tick(bus, 1);
    tick(bus, 2);
    tick(bus, 3);
    expect(monitor.outstandingDebt).toBe(50000);

    economy.setCash(100000); // raise cash so we don't keep re-triggering after contraction
    // Day 7 = first weekly tick after contraction.
    tick(bus, 7);
    expect(monitor.outstandingDebt).toBe(48000);
    expect(economy.forceDebit).toHaveBeenCalledWith(2000, 'Bankruptcy Debt Service');
    expect(paymentEvents).toHaveBeenCalledWith({
      day: 7,
      amount: 2000,
      remainingBalance: 48000,
    });

    // Skip ahead, simulating many weekly ticks until payoff.
    for (let week = 2; week <= 30; week++) tick(bus, week * 7);
    expect(monitor.outstandingDebt).toBe(0);
  });

  it('post-contraction insolvency at Tier 1 escalates to terminal', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-100);
    const tm = makeTierManager(2);
    const terminal = jest.fn();
    bus.subscribe('career:bankruptcy_terminal', terminal);
    createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    // First bankruptcy → contraction on day 3.
    tick(bus, 1); tick(bus, 2); tick(bus, 3);
    expect(tm.currentTier).toBe(1);

    // Stay insolvent — terminal fires after another 3 consecutive overnights.
    tick(bus, 4); tick(bus, 5); tick(bus, 6);
    expect(terminal).toHaveBeenCalledWith({ day: 6, tier: 1 });
  });
});

describe('BankruptcyMonitor — Tier 3+ compliance', () => {
  it('auto-applies compliance cost and reputation hit; tier preserved', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-100);
    const tm = makeTierManager(3);
    const compliance = jest.fn();
    const repHit = jest.fn();
    bus.subscribe('career:bankruptcy_compliance', compliance);
    bus.subscribe('reputation:satisfaction_hit', repHit);
    createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    tick(bus, 1); tick(bus, 2); tick(bus, 3);

    expect(tm.currentTier).toBe(3);
    expect(economy.forceDebit).toHaveBeenCalledWith(30000, 'Compliance Investment');
    expect(compliance).toHaveBeenCalledWith({
      day: 3,
      tier: 3,
      cashCost: 30000,
      reputationHit: -15,
    });
    expect(repHit).toHaveBeenCalledWith({
      day: 3,
      amount: -15,
      reason: 'Bankruptcy compliance investment',
    });
  });
});

describe('BankruptcyMonitor — state serialization', () => {
  it('round-trips insolventDayCount, outstandingDebt, isTerminal', () => {
    const bus = createEventBus();
    const economy = makeEconomy(-100);
    const tm = makeTierManager(2);
    const monitor = createBankruptcyMonitor({ bus, economy, tierManager: tm, config: TUNABLES });

    tick(bus, 1); tick(bus, 2); tick(bus, 3);
    const snapshot = monitor.getSerializableState();

    const bus2 = createEventBus();
    const monitor2 = createBankruptcyMonitor({
      bus: bus2,
      economy: makeEconomy(0),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });
    monitor2.restoreState(snapshot);

    expect(monitor2.outstandingDebt).toBe(50000);
    expect(monitor2.isTerminal).toBe(false);
  });
});
