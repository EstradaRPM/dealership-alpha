import { createEventBus, type EventBus, type EventMap } from '../src/game/EventBus';
import {
  createRecords,
  createDefaultRecordsSnapshot,
  type Records,
  type RecordsConfig,
} from '../src/game/Records';

const CONFIG: RecordsConfig = { pvrMinUnits: 3 };

function setup(config: RecordsConfig = CONFIG): {
  bus: EventBus;
  records: Records;
  broken: EventMap['records:broken'][];
} {
  const bus = createEventBus();
  const records = createRecords({ bus, config });
  const broken: EventMap['records:broken'][] = [];
  bus.subscribe('records:broken', (p) => broken.push(p));
  return { bus, records, broken };
}

function closeDeal(
  bus: EventBus,
  frontGross: number,
  backGross = 0,
  overrides: Partial<EventMap['deal:closed']> = {},
): void {
  bus.publish('deal:closed', {
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 20_000,
    frontGross,
    backGross,
    daysInInventory: 10,
    paymentMethod: 'cash',
    downPayment: 20_000,
    loanAmount: 0,
    term: 0,
    apr: 0,
    ...overrides,
  });
}

/** Play one day: open it, close `grosses` worth of deals, then settle it. */
function playDay(bus: EventBus, day: number, grosses: number[]): void {
  bus.publish('clock:day_started', { day });
  for (const g of grosses) closeDeal(bus, g);
  bus.publish('floor:day_complete', { day, ticks: 10, totalArrivals: 5 });
}

describe('Records — high-water marks (#329)', () => {
  it('starts with no marks set', () => {
    const { records } = setup();
    expect(records.getMark('bestDayGross')).toBeNull();
    expect(records.getMark('bestSingleDeal')).toBeNull();
    expect(records.currentStreak).toBe(0);
  });

  describe('bestSingleDeal', () => {
    it('marks the fattest FRONT gross, ignoring back gross', () => {
      const { bus, records } = setup();
      bus.publish('clock:day_started', { day: 1 });
      closeDeal(bus, 1_200, 400);
      // Bigger TOTAL gross, thinner front — must not beat the front mark.
      closeDeal(bus, 900, 5_000);

      expect(records.getMark('bestSingleDeal')).toEqual({ value: 1_200, day: 1 });
    });

    it('fires once per beat and carries the deal context', () => {
      const { bus, broken } = setup();
      bus.publish('clock:day_started', { day: 3 });
      closeDeal(bus, 1_000, 0, { vehicleId: 'v-aaa', customerId: 'c-aaa' });
      closeDeal(bus, 2_500, 0, { vehicleId: 'v-bbb', customerId: 'c-bbb' });

      const single = broken.filter((b) => b.kind === 'bestSingleDeal');
      expect(single).toHaveLength(2);
      expect(single[0]).toMatchObject({
        day: 3,
        value: 1_000,
        previousValue: null,
        vehicleId: 'v-aaa',
        customerId: 'c-aaa',
      });
      expect(single[1]).toMatchObject({
        value: 2_500,
        previousValue: 1_000,
        vehicleId: 'v-bbb',
      });
    });

    it('does not fire on a tie', () => {
      const { bus, broken } = setup();
      bus.publish('clock:day_started', { day: 1 });
      closeDeal(bus, 1_500);
      closeDeal(bus, 1_500);

      expect(broken.filter((b) => b.kind === 'bestSingleDeal')).toHaveLength(1);
    });

    it('stamps deals with the day cursor, since deal:closed carries no day', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [500]);
      playDay(bus, 2, [900]);

      expect(records.getMark('bestSingleDeal')).toEqual({ value: 900, day: 2 });
    });
  });

  describe('bestDayGross + mostUnitsInDay', () => {
    it('settles the day total on floor:day_complete using front + back', () => {
      const { bus, records } = setup();
      bus.publish('clock:day_started', { day: 1 });
      closeDeal(bus, 1_000, 500);
      closeDeal(bus, 800, 200);
      // Not settled until the day completes.
      expect(records.getMark('bestDayGross')).toBeNull();
      bus.publish('floor:day_complete', { day: 1, ticks: 10, totalArrivals: 5 });

      expect(records.getMark('bestDayGross')).toEqual({ value: 2_500, day: 1 });
      expect(records.getMark('mostUnitsInDay')).toEqual({ value: 2, day: 1 });
    });

    it('resets the day accumulator so a weaker day does not beat a stronger one', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, [3_000]);
      playDay(bus, 2, [1_000]);

      expect(records.getMark('bestDayGross')).toEqual({ value: 3_000, day: 1 });
      expect(broken.filter((b) => b.kind === 'bestDayGross')).toHaveLength(1);
      expect(records.getDayTotals()).toEqual({ gross: 0, units: 0 });
    });

    it('does not crown an empty day', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, []);

      expect(records.getMark('bestDayGross')).toBeNull();
      expect(records.getMark('mostUnitsInDay')).toBeNull();
      expect(broken).toHaveLength(0);
    });
  });

  describe('bestPvr', () => {
    it('crowns day gross per unit once the day clears pvrMinUnits', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [1_000, 2_000, 3_000]);

      expect(records.getMark('bestPvr')).toEqual({ value: 2_000, day: 1 });
    });

    it('ignores thin-volume days, however fat the single deal', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [50_000, 50_000]); // 2 units < pvrMinUnits 3

      expect(records.getMark('bestPvr')).toBeNull();
      expect(records.getMark('bestSingleDeal')).toEqual({ value: 50_000, day: 1 });
    });

    it('a higher-volume day does not crown PVR unless the average improves', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, [3_000, 3_000, 3_000]); // PVR 3000
      playDay(bus, 2, [1_000, 1_000, 1_000, 1_000]); // PVR 1000, more units

      expect(records.getMark('bestPvr')).toEqual({ value: 3_000, day: 1 });
      expect(records.getMark('mostUnitsInDay')).toEqual({ value: 4, day: 2 });
      expect(broken.filter((b) => b.kind === 'bestPvr')).toHaveLength(1);
    });
  });

  describe('bestStreak', () => {
    it('counts consecutive selling days and crowns each new high', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, [1_000]);
      playDay(bus, 2, [1_000]);
      playDay(bus, 3, [1_000]);

      expect(records.currentStreak).toBe(3);
      expect(records.getMark('bestStreak')).toEqual({ value: 3, day: 3 });
      expect(broken.filter((b) => b.kind === 'bestStreak').map((b) => b.value)).toEqual([
        1, 2, 3,
      ]);
    });

    it('resets the live streak on a day with no units, keeping the mark', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [1_000]);
      playDay(bus, 2, [1_000]);
      playDay(bus, 3, []); // broken run
      playDay(bus, 4, [1_000]);

      expect(records.currentStreak).toBe(1);
      expect(records.getMark('bestStreak')).toEqual({ value: 2, day: 2 });
    });

    it('keeps the streak alive on a selling day that lost money', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [1_000]);
      playDay(bus, 2, [-500]); // sold a unit at a loss — momentum, not profit
      playDay(bus, 3, [1_000]);

      expect(records.currentStreak).toBe(3);
      expect(records.getMark('bestDayGross')).toEqual({ value: 1_000, day: 1 });
    });
  });

  describe('bestMonthGross', () => {
    it('accumulates across days and settles on the month boundary', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, [1_000]);
      playDay(bus, 2, [2_000]);
      bus.publish('clock:month_ended', { day: 2 });

      expect(records.getMark('bestMonthGross')).toEqual({ value: 3_000, day: 2 });
      const month = broken.find((b) => b.kind === 'bestMonthGross');
      expect(month).toMatchObject({ value: 3_000, previousValue: null, month: 1 });
    });

    it('rolls the accumulator + month index at the boundary', () => {
      const { bus, records, broken } = setup();
      playDay(bus, 1, [5_000]);
      bus.publish('clock:month_ended', { day: 1 });
      playDay(bus, 2, [1_000]);
      bus.publish('clock:month_ended', { day: 2 });

      // Month 2 was weaker — mark stands from month 1, only one crown fired.
      expect(records.getMark('bestMonthGross')).toEqual({ value: 5_000, day: 1 });
      expect(broken.filter((b) => b.kind === 'bestMonthGross')).toHaveLength(1);

      playDay(bus, 3, [9_000]);
      bus.publish('clock:month_ended', { day: 3 });
      const latest = broken.filter((b) => b.kind === 'bestMonthGross').at(-1);
      expect(latest).toMatchObject({ value: 9_000, previousValue: 5_000, month: 3 });
    });
  });

  describe('ordering', () => {
    // #330 assembles the Reveal feed inside a floor:day_complete handler; every
    // mark for the just-closed day must already have fired by then. Records is
    // wired in createWorld, so it subscribes first.
    it('fires the day marks before later floor:day_complete subscribers run', () => {
      const { bus, broken } = setup();
      let seenAtFeedTime = 0;
      bus.subscribe('floor:day_complete', () => {
        seenAtFeedTime = broken.length;
      });

      playDay(bus, 1, [1_000, 2_000, 3_000]);

      expect(seenAtFeedTime).toBeGreaterThan(0);
      // day gross, units, pvr, streak — all in before the feed is built.
      const kinds = broken.slice(0, seenAtFeedTime).map((b) => b.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          'bestDayGross',
          'mostUnitsInDay',
          'bestPvr',
          'bestStreak',
        ]),
      );
    });
  });

  describe('persistence', () => {
    it('round-trips marks, accumulators and the live streak', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [1_000, 2_000, 3_000]);
      // Mid-day of day 2: partial haul not yet settled.
      bus.publish('clock:day_started', { day: 2 });
      closeDeal(bus, 700, 300);

      const snap = JSON.parse(JSON.stringify(records.snapshot())) as ReturnType<
        Records['snapshot']
      >;

      const restoredBus = createEventBus();
      const restored = createRecords({ bus: restoredBus, config: CONFIG });
      restored.restore(snap);

      expect(restored.getMarks()).toEqual(records.getMarks());
      expect(restored.currentStreak).toBe(1);
      expect(restored.getDayTotals()).toEqual({ gross: 1_000, units: 1 });

      // The restored module keeps accumulating onto the restored day.
      restoredBus.publish('floor:day_complete', { day: 2, ticks: 10, totalArrivals: 3 });
      expect(restored.getMark('bestDayGross')).toEqual({ value: 6_000, day: 1 });
      expect(restored.currentStreak).toBe(2);
    });

    it('restores the month accumulator so a mid-month reload keeps the month', () => {
      const { bus, records } = setup();
      playDay(bus, 1, [4_000]);
      const snap = records.snapshot();

      const restoredBus = createEventBus();
      const restored = createRecords({ bus: restoredBus, config: CONFIG });
      restored.restore(snap);
      restoredBus.publish('clock:month_ended', { day: 2 });

      expect(restored.getMark('bestMonthGross')).toEqual({ value: 4_000, day: 2 });
    });

    it('the migration default is an empty, behavior-neutral scoreboard', () => {
      const bus = createEventBus();
      const records = createRecords({ bus, config: CONFIG });
      records.restore(createDefaultRecordsSnapshot());

      expect(records.getMarks()).toEqual({
        bestDayGross: null,
        bestMonthGross: null,
        bestPvr: null,
        bestStreak: null,
        bestSingleDeal: null,
        mostUnitsInDay: null,
      });
      expect(records.currentStreak).toBe(0);

      // An old save simply crowns its first mark on the next qualifying day.
      playDay(bus, 40, [2_000]);
      expect(records.getMark('bestDayGross')).toEqual({ value: 2_000, day: 40 });
    });
  });

  it('loads pvrMinUnits from tunables when no config is injected', () => {
    const bus = createEventBus();
    expect(() => createRecords({ bus })).not.toThrow();
  });
});
