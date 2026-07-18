import { createEventBus } from '../src/game/EventBus';
import {
  createRegulatoryMeter,
  type RegulatoryTunables,
} from '../src/game/Reputation';
import type { Economy } from '../src/game/Economy';
import type { TierManager } from '../src/game/CareerProgression';

const TUNABLES: RegulatoryTunables = {
  pressureMax: 100,
  pressureThreshold: 10,
  auditThreshold: 5,
  dailyDecay: 1,
  walkPressure: 1,
  missedOppPressure: 2,
  angerPressure: 5,
  tier2: { suspensionDays: 14 },
  tier3Plus: { complianceCost: 75000, reputationHit: -25 },
};

function makeEconomy(initialCash: number): Economy & { setCash(v: number): void } {
  let cash = initialCash;
  return {
    get cash() { return cash; },
    inventoryAcquisitionSpend: 0,
    setCash(v: number) { cash = v; },
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

function walk(bus: ReturnType<typeof createEventBus>, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('customer:resolved', { customerId: `c${i}`, outcome: 'walk', receptivity: 0, satisfaction: 0, retentionSeed: 0, heat: 0, agreedPrice: 0, frontGross: 0 });
  }
}

function missed(bus: ReturnType<typeof createEventBus>, day: number, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('capacity:missed_opportunity', { day, customerId: `m${i}`, label: 'x' });
  }
}

function anger(bus: ReturnType<typeof createEventBus>, day: number, n = 1) {
  for (let i = 0; i < n; i++) {
    bus.publish('followup:customer_archived', { customerId: `a${i}`, day });
  }
}

function tick(bus: ReturnType<typeof createEventBus>, day: number) {
  bus.publish('clock:overnight_payroll', { day });
}

describe('RegulatoryMeter — pressure accumulation', () => {
  it('accumulates from walks, missed opportunities, and archived follow-ups', () => {
    const bus = createEventBus();
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 2);          // +2
    missed(bus, 1, 1);     // +2
    anger(bus, 1, 1);      // +5

    expect(meter.pressure).toBe(9);
  });

  it('decays each overnight when below threshold', () => {
    const bus = createEventBus();
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 5); // pressure 5, below threshold 10
    tick(bus, 1);
    expect(meter.pressure).toBe(4);
    tick(bus, 2);
    expect(meter.pressure).toBe(3);
  });

  it('clamps at pressureMax', () => {
    const bus = createEventBus();
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    anger(bus, 1, 1000); // would overflow
    expect(meter.pressure).toBe(TUNABLES.pressureMax);
  });
});

describe('RegulatoryMeter — Tier 1 terminal', () => {
  it('publishes ag_complaint_terminal at threshold and marks terminal', () => {
    const bus = createEventBus();
    const terminal = jest.fn();
    bus.subscribe('regulatory:ag_complaint_terminal', terminal);
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });

    anger(bus, 1, 2);  // +10 = threshold
    tick(bus, 1);

    expect(terminal).toHaveBeenCalledWith({ day: 1, tier: 1, pressure: 10 });
    expect(meter.isTerminal).toBe(true);
  });

  it('stops processing once terminal', () => {
    const bus = createEventBus();
    const terminal = jest.fn();
    bus.subscribe('regulatory:ag_complaint_terminal', terminal);
    createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(1),
      config: TUNABLES,
    });

    anger(bus, 1, 5);
    for (let d = 1; d <= 10; d++) tick(bus, d);

    expect(terminal).toHaveBeenCalledTimes(1);
  });
});

describe('RegulatoryMeter — Tier 2 contraction + suspension', () => {
  it('drops to tier 1, opens suspension window, clears pressure', () => {
    const bus = createEventBus();
    const contraction = jest.fn();
    bus.subscribe('regulatory:ag_complaint_contraction', contraction);
    const tm = makeTierManager(2);
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: tm,
      config: TUNABLES,
    });

    anger(bus, 1, 2); // +10
    tick(bus, 1);

    expect(tm.currentTier).toBe(1);
    expect(meter.isSuspended).toBe(true);
    expect(meter.suspensionDaysRemaining).toBe(14);
    expect(meter.pressure).toBe(0);
    expect(contraction).toHaveBeenCalledWith({
      day: 1,
      fromTier: 2,
      suspensionDays: 14,
    });
  });

  it('lifts suspension after configured days', () => {
    const bus = createEventBus();
    const lifted = jest.fn();
    bus.subscribe('regulatory:suspension_lifted', lifted);
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(2),
      config: TUNABLES,
    });

    anger(bus, 1, 2);
    tick(bus, 1); // contraction; suspensionDays=14 set this tick
    for (let d = 2; d <= 15; d++) tick(bus, d);

    expect(meter.isSuspended).toBe(false);
    expect(lifted).toHaveBeenCalledTimes(1);
    expect(lifted).toHaveBeenCalledWith({ day: 15 });
  });
});

describe('RegulatoryMeter — Tier 3+ consent decree', () => {
  it('applies cash penalty and reputation hit; preserves tier', () => {
    const bus = createEventBus();
    const decree = jest.fn();
    const repHit = jest.fn();
    bus.subscribe('regulatory:ag_complaint_consent_decree', decree);
    bus.subscribe('reputation:satisfaction_hit', repHit);
    const economy = makeEconomy(200000);
    const tm = makeTierManager(3);
    const meter = createRegulatoryMeter({
      bus, economy, tierManager: tm, config: TUNABLES,
    });

    anger(bus, 1, 2);
    tick(bus, 1);

    expect(tm.currentTier).toBe(3);
    expect(economy.forceDebit).toHaveBeenCalledWith(75000, 'AG Consent Decree');
    expect(decree).toHaveBeenCalledWith({
      day: 1,
      tier: 3,
      cashCost: 75000,
      reputationHit: -25,
    });
    expect(repHit).toHaveBeenCalledWith({
      day: 1,
      amount: -25,
      reason: 'AG consent decree',
    });
    expect(meter.pressure).toBe(0);
    expect(meter.isTerminal).toBe(false);
  });
});

describe('RegulatoryMeter — audit-failure producer (#327)', () => {
  it('fires audit_failure once when pressure enters the audit band overnight', () => {
    const bus = createEventBus();
    const audits: Array<{ day: number }> = [];
    bus.subscribe('regulatory:audit_failure', (e) => audits.push(e));
    createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 6); // pressure 6, in band [5,10)
    tick(bus, 1);
    expect(audits).toEqual([{ day: 1 }]);

    // Still in band next night (6 → 5 after decay) → latched, no re-fire.
    tick(bus, 2);
    expect(audits).toHaveLength(1);
  });

  it('does NOT fire while pressure stays below the audit threshold', () => {
    const bus = createEventBus();
    const audits: Array<{ day: number }> = [];
    bus.subscribe('regulatory:audit_failure', (e) => audits.push(e));
    createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 4); // pressure 4, below auditThreshold 5
    tick(bus, 1);
    expect(audits).toHaveLength(0);
  });

  it('does NOT fire when pressure jumps straight to the AG-complaint threshold', () => {
    const bus = createEventBus();
    const audits: Array<{ day: number }> = [];
    const complaint = jest.fn();
    bus.subscribe('regulatory:audit_failure', (e) => audits.push(e));
    bus.subscribe('regulatory:ag_complaint_consent_decree', complaint);
    createRegulatoryMeter({
      bus,
      economy: makeEconomy(200000),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 10); // pressure 10 = pressureThreshold, skips the band
    tick(bus, 1);
    expect(audits).toHaveLength(0);
    expect(complaint).toHaveBeenCalledTimes(1);
  });

  it('re-fires after pressure drops below the band and climbs back', () => {
    const bus = createEventBus();
    const audits: Array<{ day: number }> = [];
    bus.subscribe('regulatory:audit_failure', (e) => audits.push(e));
    createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });

    walk(bus, 6); // 6, band
    tick(bus, 1); // fire #1 → decay 5
    tick(bus, 2); // 5 still in band, latched → decay 4
    tick(bus, 3); // 4 below band → reset latch → decay 3
    expect(audits).toHaveLength(1);

    walk(bus, 4); // 3 → 7, band again
    tick(bus, 4); // fire #2
    expect(audits).toHaveLength(2);
  });
});

describe('RegulatoryMeter — state serialization', () => {
  it('round-trips pressure, isTerminal, suspensionDaysRemaining', () => {
    const bus = createEventBus();
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    walk(bus, 3);
    const snapshot = meter.getSerializableState();

    const bus2 = createEventBus();
    const meter2 = createRegulatoryMeter({
      bus: bus2,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    meter2.restoreState(snapshot);

    expect(meter2.pressure).toBe(3);
    expect(meter2.isTerminal).toBe(false);
    expect(meter2.suspensionDaysRemaining).toBe(0);
  });

  it('round-trips the audit-failure latch so a restored run does not re-fire', () => {
    const bus = createEventBus();
    bus.subscribe('regulatory:audit_failure', () => {});
    const meter = createRegulatoryMeter({
      bus,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    walk(bus, 6);
    tick(bus, 1); // latch set (one fire); pressure decays to 5, still in band
    expect(meter.getSerializableState().auditFailed).toBe(true);

    const bus2 = createEventBus();
    const audits2: Array<{ day: number }> = [];
    bus2.subscribe('regulatory:audit_failure', (e) => audits2.push(e));
    const meter2 = createRegulatoryMeter({
      bus: bus2,
      economy: makeEconomy(100),
      tierManager: makeTierManager(3),
      config: TUNABLES,
    });
    meter2.restoreState(meter.getSerializableState());
    tick(bus2, 2); // still-in-band + latched → no re-fire
    expect(audits2).toHaveLength(0);
  });
});
