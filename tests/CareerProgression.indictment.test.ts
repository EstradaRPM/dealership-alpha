import { createEventBus } from '../src/game/EventBus';
import {
  createIndictmentMonitor,
  type IndictmentTunables,
} from '../src/game/CareerProgression';
import type { Economy } from '../src/game/Economy';
import type { TierManager } from '../src/game/CareerProgression';

const TUNABLES: IndictmentTunables = {
  pressureMax: 100,
  pressureThreshold: 50,
  lemonLawPressure: 15,
  auditFailurePressure: 20,
  fraudFlagPressure: 25,
  tier2: { stakePenalty: 100000 },
  tier3Plus: { legalDefenseCost: 250000, reputationHit: -40 },
};

function makeEconomy(initialCash: number): Economy {
  let cash = initialCash;
  return {
    get cash() { return cash; },
    inventoryAcquisitionSpend: 0,
    postRevenue: jest.fn(),
    postExpense: jest.fn(),
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

function lemon(bus: ReturnType<typeof createEventBus>, day: number, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('regulatory:lemon_law_incident', { day, customerId: `c${i}` });
  }
}

function audit(bus: ReturnType<typeof createEventBus>, day: number, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('regulatory:audit_failure', { day });
  }
}

function fraud(bus: ReturnType<typeof createEventBus>, day: number, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('deal:fraud_flag', { day, customerId: `c${i}`, vehicleId: `v${i}` });
  }
}

describe('IndictmentMonitor — signal accumulation', () => {
  it('accumulates pressure from lemon-law, audit failure, and fraud flag signals', () => {
    const bus = createEventBus();
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(1_000_000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    lemon(bus, 1, 1); // +15 → 15
    audit(bus, 1, 1); // +20 → 35

    expect(monitor.pressure).toBe(35);
  });

  it('clamps pressure at pressureMax', () => {
    const bus = createEventBus();
    // Threshold above pressureMax so signals accumulate without firing.
    const highThresholdConfig: IndictmentTunables = {
      ...TUNABLES,
      pressureThreshold: 9999,
    };
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(10_000_000),
      tierManager: makeTierManager(3),
      config: highThresholdConfig,
    });

    fraud(bus, 1, 100); // would overflow without clamping
    expect(monitor.pressure).toBe(TUNABLES.pressureMax);
  });

  it('triggers immediately on the signal that crosses the threshold', () => {
    const bus = createEventBus();
    const defense = jest.fn();
    bus.subscribe('career:indictment_legal_defense', defense);
    createIndictmentMonitor({
      bus,
      economy: makeEconomy(1_000_000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    lemon(bus, 1, 1); // 15
    audit(bus, 1, 1); // 35
    // one more fraud flag: 35 + 25 = 60, crosses threshold 50
    fraud(bus, 1, 1);

    expect(defense).toHaveBeenCalledTimes(1);
  });
});

describe('IndictmentMonitor — Tier 1 terminal', () => {
  it('publishes indictment_terminal and marks isTerminal', () => {
    const bus = createEventBus();
    const terminal = jest.fn();
    bus.subscribe('career:indictment_terminal', terminal);
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(50000),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });

    fraud(bus, 1, 2); // 25+25=50, hits threshold
    expect(terminal).toHaveBeenCalledWith({ day: 1, tier: 1, pressure: 50 });
    expect(monitor.isTerminal).toBe(true);
  });

  it('stops accumulating once terminal', () => {
    const bus = createEventBus();
    const terminal = jest.fn();
    bus.subscribe('career:indictment_terminal', terminal);
    createIndictmentMonitor({
      bus,
      economy: makeEconomy(50000),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });

    fraud(bus, 1, 2); // triggers terminal
    fraud(bus, 2, 10); // subsequent signals must be ignored
    expect(terminal).toHaveBeenCalledTimes(1);
  });
});

describe('IndictmentMonitor — Tier 2 personal liability contraction', () => {
  it('debits stake penalty, contracts tier, clears pressure, publishes event', () => {
    const bus = createEventBus();
    const contraction = jest.fn();
    bus.subscribe('career:indictment_contraction', contraction);
    const economy = makeEconomy(500000);
    const tm = makeTierManager(2);
    const monitor = createIndictmentMonitor({
      bus, economy, tierManager: tm, config: TUNABLES,
    });

    fraud(bus, 5, 2); // 50, hits threshold

    expect(economy.forceDebit).toHaveBeenCalledWith(100000, 'Personal Liability Settlement');
    expect(tm.currentTier).toBe(1);
    expect(monitor.pressure).toBe(0);
    expect(contraction).toHaveBeenCalledWith({
      day: 5,
      fromTier: 2,
      stakePenalty: 100000,
    });
    expect(monitor.isTerminal).toBe(false);
  });

  it('business survives the contraction — isTerminal remains false', () => {
    const bus = createEventBus();
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(500000),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });

    fraud(bus, 1, 2);
    expect(monitor.isTerminal).toBe(false);
  });
});

describe('IndictmentMonitor — Tier 3+ legal defense', () => {
  it('debits legal-defense cost, publishes reputation hit, preserves tier', () => {
    const bus = createEventBus();
    const defense = jest.fn();
    const repHit = jest.fn();
    bus.subscribe('career:indictment_legal_defense', defense);
    bus.subscribe('reputation:satisfaction_hit', repHit);
    const economy = makeEconomy(1_000_000);
    const tm = makeTierManager(3);
    const monitor = createIndictmentMonitor({
      bus, economy, tierManager: tm, config: TUNABLES,
    });

    fraud(bus, 10, 2); // hits threshold

    expect(economy.forceDebit).toHaveBeenCalledWith(250000, 'Legal Defense');
    expect(tm.currentTier).toBe(3);
    expect(defense).toHaveBeenCalledWith({
      day: 10,
      tier: 3,
      cashCost: 250000,
      reputationHit: -40,
    });
    expect(repHit).toHaveBeenCalledWith({
      day: 10,
      amount: -40,
      reason: 'Indictment legal proceedings',
    });
    expect(monitor.pressure).toBe(0);
    expect(monitor.isTerminal).toBe(false);
  });

  it('can fire again after pressure resets if new signals accumulate', () => {
    const bus = createEventBus();
    const defense = jest.fn();
    bus.subscribe('career:indictment_legal_defense', defense);
    createIndictmentMonitor({
      bus,
      economy: makeEconomy(10_000_000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    fraud(bus, 1, 2); // triggers; pressure reset to 0
    fraud(bus, 2, 2); // triggers again
    expect(defense).toHaveBeenCalledTimes(2);
  });
});

describe('IndictmentMonitor — state serialization', () => {
  it('round-trips pressure and isTerminal', () => {
    const bus = createEventBus();
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(1_000_000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    lemon(bus, 1, 2); // 30
    const snapshot = monitor.getSerializableState();

    const bus2 = createEventBus();
    const monitor2 = createIndictmentMonitor({
      bus: bus2,
      economy: makeEconomy(1_000_000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    monitor2.restoreState(snapshot);

    expect(monitor2.pressure).toBe(30);
    expect(monitor2.isTerminal).toBe(false);
  });

  it('restores terminal flag and stops processing', () => {
    const bus = createEventBus();
    const terminal = jest.fn();
    bus.subscribe('career:indictment_terminal', terminal);
    const monitor = createIndictmentMonitor({
      bus,
      economy: makeEconomy(0),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });

    monitor.restoreState({ pressure: 75, isTerminal: true });
    fraud(bus, 99, 5); // must be swallowed

    expect(terminal).not.toHaveBeenCalled();
    expect(monitor.isTerminal).toBe(true);
  });
});
