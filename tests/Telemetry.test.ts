import { createEventBus } from '../src/game/EventBus';
import { createTelemetry } from '../src/game/Telemetry';
import type { SessionLog } from '../src/game/Telemetry';

function makeSetup() {
  const bus = createEventBus();
  const telemetry = createTelemetry({ bus });
  return { bus, telemetry };
}

describe('Telemetry — enable/disable', () => {
  it('is disabled by default', () => {
    const { telemetry } = makeSetup();
    expect(telemetry.isEnabled()).toBe(false);
    expect(telemetry.getEventCount()).toBe(0);
  });

  it('records nothing when disabled (zero subscription overhead)', () => {
    const { bus, telemetry } = makeSetup();
    bus.publish('deal:closed', {
      customerId: 'c1', vehicleId: 'v1', agreedPrice: 25000,
      frontGross: 2000, backGross: 500, productGross: 500, reserveGross: 0, daysInInventory: 10,
      paymentMethod: 'cash', downPayment: 25000, loanAmount: 0, term: 0, apr: 0,
    });
    expect(telemetry.getEventCount()).toBe(0);
  });

  it('records events after setEnabled(true)', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('customer:arrived', { day: 1, customerId: 'c1', label: 'Tire-kicker' });
    expect(telemetry.getEventCount()).toBe(2);
  });

  it('stops recording after setEnabled(false)', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 1 });
    telemetry.setEnabled(false);
    bus.publish('customer:arrived', { day: 1, customerId: 'c1', label: 'X' });
    expect(telemetry.getEventCount()).toBe(1);
  });

  it('toggling on twice is idempotent', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 1 });
    expect(telemetry.getEventCount()).toBe(1); // not 2
  });
});

describe('Telemetry — clear', () => {
  it('empties the buffer', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('clock:day_started', { day: 2 });
    telemetry.clear();
    expect(telemetry.getEventCount()).toBe(0);
  });
});

describe('Telemetry — derived metrics', () => {
  function seedSession(bus: ReturnType<typeof createEventBus>) {
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('customer:arrived', { day: 1, customerId: 'a', label: 'Tire-kicker' });
    bus.publish('customer:arrived', { day: 1, customerId: 'b', label: 'Tire-kicker' });
    bus.publish('customer:arrived', { day: 1, customerId: 'c', label: 'Serious Buyer' });
    bus.publish('customer:resolved', { customerId: 'a', outcome: 'walk', receptivity: 0, satisfaction: 0, retentionSeed: 0, heat: 0.3, agreedPrice: 0, frontGross: 0 });
    bus.publish('customer:resolved', { customerId: 'c', outcome: 'closed', receptivity: 0.6, satisfaction: 1, retentionSeed: 0.6, heat: 0, agreedPrice: 30000, frontGross: 2000 });
    bus.publish('deal:closed', {
      customerId: 'c', vehicleId: 'v1', agreedPrice: 30000,
      frontGross: 2000, backGross: 800, productGross: 800, reserveGross: 0, daysInInventory: 5,
      paymentMethod: 'cash', downPayment: 30000, loanAmount: 0, term: 0, apr: 0,
    });
    bus.publish('economy:revenue_posted', { day: 1, amount: 30000, label: 'sale' });
    bus.publish('economy:expense_posted', { day: 1, amount: 5000, label: 'overhead' });
    bus.publish('capacity:customer_admitted', { day: 1, customerId: 'a', label: 'Tire-kicker' });
    bus.publish('capacity:missed_opportunity', { day: 1, customerId: 'm', label: 'Turned Away' });
    bus.publish('clock:day_started', { day: 2 });
    bus.publish('deal:closed', {
      customerId: 'd', vehicleId: 'v2', agreedPrice: 20000,
      frontGross: 1000, backGross: 0, productGross: 0, reserveGross: 0, daysInInventory: 12,
      paymentMethod: 'cash', downPayment: 20000, loanAmount: 0, term: 0, apr: 0,
    });
    bus.publish('economy:revenue_posted', { day: 2, amount: 20000, label: 'sale' });
    bus.publish('staff:quit', { staffId: 's1', name: 'Sam Reyes', roleId: 'sales', day: 2, morale: 5 });
  }

  it('dealsPerDay aggregates count and avg gross', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    expect(m.dealsPerDay).toHaveLength(2);
    expect(m.dealsPerDay[0]).toEqual({
      day: 1, count: 1, avgGross: 2800, avgFront: 2000, avgBack: 800,
    });
    expect(m.dealsPerDay[1]).toEqual({
      day: 2, count: 1, avgGross: 1000, avgFront: 1000, avgBack: 0,
    });
  });

  it('closeRateByArchetype joins arrived with resolved by customerId', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    const tire = m.closeRateByArchetype.find((r) => r.archetypeLabel === 'Tire-kicker')!;
    const serious = m.closeRateByArchetype.find((r) => r.archetypeLabel === 'Serious Buyer')!;
    expect(tire.arrived).toBe(2);
    expect(tire.closed).toBe(0);
    expect(tire.walked).toBe(1);
    expect(tire.closeRate).toBe(0);
    expect(serious.arrived).toBe(1);
    expect(serious.closed).toBe(1);
    expect(serious.closeRate).toBe(1);
  });

  it('fniAttachRate counts deals with backGross > 0', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    expect(m.fniAttachRate.totalDeals).toBe(2);
    expect(m.fniAttachRate.dealsWithBackGross).toBe(1);
    expect(m.fniAttachRate.attachPct).toBe(0.5);
  });

  it('cashCurve produces per-day revenue/expense/net with cumulative', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    const d1 = m.cashCurve.find((r) => r.day === 1)!;
    const d2 = m.cashCurve.find((r) => r.day === 2)!;
    expect(d1).toEqual({ day: 1, revenue: 30000, expense: 5000, net: 25000, cumulativeNet: 25000 });
    expect(d2).toEqual({ day: 2, revenue: 20000, expense: 0, net: 20000, cumulativeNet: 45000 });
  });

  it('queueProxy tracks per-day inflow and outflow', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    const d1 = m.queueProxy.find((r) => r.day === 1)!;
    expect(d1.admitted).toBe(1);
    expect(d1.missed).toBe(1);
    expect(d1.resolvedClosed).toBe(1);
    expect(d1.resolvedWalk).toBe(1);
  });

  it('moraleTrajectory counts staff quits per day with cumulative', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    seedSession(bus);
    const m = telemetry.getMetrics();
    const d2 = m.moraleTrajectory.find((r) => r.day === 2)!;
    expect(d2.quits).toBe(1);
    expect(d2.cumulativeQuits).toBe(1);
  });
});

describe('Telemetry — exportSessionLog', () => {
  it('returns a JSON string with metrics and events', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 1 });
    bus.publish('customer:arrived', { day: 1, customerId: 'c1', label: 'X' });
    const log: SessionLog = JSON.parse(telemetry.exportSessionLog());
    expect(log.schemaVersion).toBe(1);
    expect(log.events).toHaveLength(2);
    expect(log.metrics.totalEvents).toBe(2);
    expect(typeof log.exportedAt).toBe('number');
  });

  it('exports a valid empty log when no events recorded', () => {
    const { telemetry } = makeSetup();
    const log: SessionLog = JSON.parse(telemetry.exportSessionLog());
    expect(log.events).toHaveLength(0);
    expect(log.metrics.totalEvents).toBe(0);
    expect(log.metrics.dealsPerDay).toHaveLength(0);
  });
});

describe('Telemetry — day attribution', () => {
  it('attributes events to the day from the most recent clock:day_started', () => {
    const { bus, telemetry } = makeSetup();
    telemetry.setEnabled(true);
    bus.publish('clock:day_started', { day: 3 });
    bus.publish('customer:arrived', { day: 3, customerId: 'c1', label: 'X' });
    bus.publish('clock:day_started', { day: 4 });
    bus.publish('customer:arrived', { day: 4, customerId: 'c2', label: 'Y' });
    const events = telemetry.getRawEvents();
    expect(events[1].day).toBe(3);
    expect(events[3].day).toBe(4);
  });
});
