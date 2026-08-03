import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createKPIDashboard, type KPIDashboard } from '../src/game/KPIDashboard';

function closeDeal(
  bus: EventBus,
  over: Partial<{ frontGross: number; backGross: number; paymentMethod: 'cash' | 'finance' }> = {},
) {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 20_000,
    frontGross: over.frontGross ?? 1_000,
    backGross: over.backGross ?? 500,
    daysInInventory: 10,
    paymentMethod: over.paymentMethod ?? 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
  });
}

/**
 * The module reads the day off an injected clock provider, exactly as
 * `createWorld` wires it — there is no private cursor to nudge with an event.
 */
function setup(): { bus: EventBus; kpi: KPIDashboard; setDay: (d: number) => void } {
  const bus = createEventBus();
  const state = { day: 1 };
  return {
    bus,
    kpi: createKPIDashboard({ bus, getCurrentDay: () => state.day }),
    setDay: (d) => {
      state.day = d;
    },
  };
}

describe('KPIDashboard day-stamped range reads (#351)', () => {
  it('stamps a deal with the day it closed on, without the event carrying one', () => {
    const { bus, kpi, setDay } = setup();
    closeDeal(bus); // day 1
    setDay(2);
    closeDeal(bus);
    closeDeal(bus);

    expect(kpi.snapshot().deals.map((d) => d.day)).toEqual([1, 2, 2]);
  });

  it('windows the KPI snapshot to the requested days', () => {
    const { bus, kpi, setDay } = setup();
    closeDeal(bus, { frontGross: 1_000 });
    setDay(2);
    closeDeal(bus, { frontGross: 2_000 });
    setDay(3);
    closeDeal(bus, { frontGross: 4_000 });

    expect(kpi.getSnapshot().unitsRetailed).toBe(3);
    expect(kpi.getSnapshot({ fromDay: 2, toDay: 2 }).unitsRetailed).toBe(1);
    expect(kpi.getSnapshot({ fromDay: 2, toDay: 2 }).avgFrontGross).toBe(2_000);
    expect(kpi.getSnapshot({ fromDay: 1, toDay: 2 }).avgFrontGross).toBe(1_500);
  });

  it('reports a row for every day in the window, including days with no deals', () => {
    const { bus, kpi, setDay } = setup();
    closeDeal(bus, { frontGross: 1_000, backGross: 0 });
    setDay(3);
    closeDeal(bus, { frontGross: 3_000, backGross: 0 });

    const totals = kpi.getDailyTotals({ fromDay: 1, toDay: 4 });
    expect(totals.map((t) => t.day)).toEqual([1, 2, 3, 4]);
    expect(totals.map((t) => t.units)).toEqual([1, 0, 1, 0]);
    expect(totals.map((t) => t.gross)).toEqual([1_000, 0, 3_000, 0]);
  });

  it('sums a day with several deals into one row', () => {
    const { bus, kpi } = setup();
    closeDeal(bus, { frontGross: 1_000, backGross: 200 });
    closeDeal(bus, { frontGross: 2_000, backGross: 300 });

    const [today] = kpi.getDailyTotals({ fromDay: 1, toDay: 1 });
    expect(today).toEqual({
      day: 1,
      units: 2,
      frontGross: 3_000,
      backGross: 500,
      gross: 3_500,
    });
  });

  it('round-trips the day stamps through save/load', () => {
    const { bus, kpi, setDay } = setup();
    closeDeal(bus);
    setDay(5);
    closeDeal(bus);

    const restoredBus = createEventBus();
    // A restore fires no clock event — the provider is why the resumed session
    // still stamps day 5 instead of silently restarting at day 1.
    const fresh = createKPIDashboard({ bus: restoredBus, getCurrentDay: () => 5 });
    fresh.restore(kpi.snapshot());
    expect(fresh.getSnapshot({ fromDay: 5, toDay: 5 }).unitsRetailed).toBe(1);
    closeDeal(restoredBus);
    expect(fresh.getSnapshot({ fromDay: 5, toDay: 5 }).unitsRetailed).toBe(2);
  });

  it('keeps pre-#351 deals in the lifetime read and out of every real window', () => {
    const fresh = createKPIDashboard({ bus: createEventBus() });
    fresh.restore({
      schemaVersion: 1,
      dailyCarryingCost: 0,
      // A snapshot written before day stamping existed.
      deals: [
        {
          frontGross: 1_000,
          backGross: 0,
          daysInInventory: 5,
          agreedPrice: 10_000,
          paymentMethod: 'cash',
          downPayment: 10_000,
          term: 0,
          apr: 0,
        } as never,
      ],
    });

    expect(fresh.getSnapshot().unitsRetailed).toBe(1);
    expect(fresh.getSnapshot({ fromDay: 1, toDay: 999 }).unitsRetailed).toBe(0);
  });
});
