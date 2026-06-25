import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createBodyShopInsights,
  type BodyShopInsights,
  type BodyShopInsightsConfig,
} from '../src/game/BodyShopInsights';

const CONFIG: BodyShopInsightsConfig = {
  demandWindowSize: 40,
  heatThresholds: { hot: 1.15, cold: 0.85 },
  demandTrendEpsilon: 0.05,
  conquestWindowDays: 14,
  volumeTrendEpsilon: 0.3,
  channelTrendEpsilon: 0.05,
};

type Channel = 'insurance' | 'retail';
type Job = 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';

function item(jobCategory: Job, source: Channel, i: number) {
  return {
    bodyShopItemId: `b${i}`,
    source,
    customerId: `c${i}`,
    vehicleId: `v${i}`,
    category: 'sedan',
    powertrain: 'ice' as const,
    jobCategory,
    baseRevenue: 1000,
    label: jobCategory,
  };
}

/** Emit one day's intake. `spec` is a list of [jobCategory, channel] pairs. */
function emitIntake(
  bus: EventBus,
  day: number,
  spec: readonly (readonly [Job, Channel])[],
) {
  bus.publish('bodyshop:intake_ready', {
    day,
    items: spec.map(([j, c], i) => item(j, c, day * 100 + i)),
  });
}

describe('BodyShopInsights demand heat', () => {
  let bus: EventBus;
  let insights: BodyShopInsights;

  beforeEach(() => {
    bus = createEventBus();
    insights = createBodyShopInsights({ bus, config: CONFIG });
  });

  it('returns all four collision categories in fixed order, 0-share before intake', () => {
    const heat = insights.getDemandHeat();
    expect(heat.map((h) => h.category)).toEqual([
      'windows_glass',
      'doors_panels',
      'interior_trim',
      'paint',
    ]);
    expect(heat.every((h) => h.count === 0 && h.share === 0)).toBe(true);
  });

  it('accumulates the intake stream into per-category shares + bands', () => {
    // 6 paint, 2 doors across an 8-ticket window: paint dominates (0.75 → hot),
    // doors sit at an even share (0.25 → 1.0× → warm), the empty two read cold.
    emitIntake(bus, 1, [
      ['paint', 'retail'],
      ['paint', 'retail'],
      ['paint', 'insurance'],
      ['doors_panels', 'insurance'],
    ]);
    emitIntake(bus, 2, [
      ['paint', 'retail'],
      ['paint', 'insurance'],
      ['paint', 'insurance'],
      ['doors_panels', 'insurance'],
    ]);
    const heat = insights.getDemandHeat();
    const paint = heat.find((h) => h.category === 'paint')!;
    const doors = heat.find((h) => h.category === 'doors_panels')!;
    const glass = heat.find((h) => h.category === 'windows_glass')!;
    expect(paint.count).toBe(6);
    expect(paint.share).toBeCloseTo(0.75);
    expect(paint.band).toBe('hot');
    expect(doors.band).toBe('warm');
    expect(glass.count).toBe(0);
    expect(glass.band).toBe('cold');
  });

  it('caps the trailing window at demandWindowSize (oldest evicted)', () => {
    const small = createBodyShopInsights({
      bus,
      config: { ...CONFIG, demandWindowSize: 4 },
    });
    emitIntake(bus, 1, [
      ['windows_glass', 'retail'],
      ['windows_glass', 'retail'],
    ]); // evicted
    emitIntake(bus, 2, [
      ['doors_panels', 'retail'],
      ['interior_trim', 'retail'],
      ['paint', 'insurance'],
      ['paint', 'insurance'],
    ]);
    const heat = small.getDemandHeat();
    expect(heat.find((h) => h.category === 'windows_glass')!.count).toBe(0);
    expect(heat.find((h) => h.category === 'paint')!.count).toBe(2);
  });
});

describe('BodyShopInsights conquest health', () => {
  it('reports zeros before any intake without dividing by zero', () => {
    const insights = createBodyShopInsights({
      bus: createEventBus(),
      config: CONFIG,
    });
    expect(insights.getConquestHealth()).toMatchObject({
      windowTickets: 0,
      intakePerDay: 0,
      retailShare: 0,
      insuranceShare: 0,
      volumeTrend: 'steady',
      retailTrend: 'steady',
    });
  });

  it('derives the retail / insurance channel mix off the trailing window', () => {
    const bus = createEventBus();
    const insights = createBodyShopInsights({ bus, config: CONFIG });
    // 3 retail, 1 insurance ⇒ 75% retail / 25% insurance.
    emitIntake(bus, 1, [
      ['paint', 'retail'],
      ['paint', 'retail'],
      ['doors_panels', 'retail'],
      ['paint', 'insurance'],
    ]);
    const ch = insights.getConquestHealth();
    expect(ch.windowTickets).toBe(4);
    expect(ch.retailShare).toBeCloseTo(0.75);
    expect(ch.insuranceShare).toBeCloseTo(0.25);
  });

  it('derives intake-per-day volume + a rising trend over the day window', () => {
    const bus = createEventBus();
    const insights = createBodyShopInsights({ bus, config: CONFIG });
    // Collision flow climbing across four days.
    const counts = [0, 1, 3, 4];
    counts.forEach((n, idx) => {
      emitIntake(
        bus,
        idx + 1,
        Array.from({ length: n }, () => ['paint', 'retail'] as const),
      );
    });
    const ch = insights.getConquestHealth();
    expect(ch.intakePerDay).toBeCloseTo((0 + 1 + 3 + 4) / 4);
    expect(ch.volumeTrend).toBe('rising');
  });

  it('reads a rising retail-conquest momentum trend', () => {
    const bus = createEventBus();
    const insights = createBodyShopInsights({ bus, config: CONFIG });
    // Older half mostly insurance, newer half mostly retail ⇒ retail rising.
    emitIntake(bus, 1, [
      ['paint', 'insurance'],
      ['paint', 'insurance'],
      ['paint', 'insurance'],
      ['paint', 'insurance'],
    ]);
    emitIntake(bus, 2, [
      ['paint', 'retail'],
      ['paint', 'retail'],
      ['paint', 'retail'],
      ['paint', 'retail'],
    ]);
    expect(insights.getConquestHealth().retailTrend).toBe('rising');
  });
});

describe('BodyShopInsights persistence', () => {
  it('round-trips the trailing window + day map through snapshot/restore', () => {
    const bus = createEventBus();
    const a = createBodyShopInsights({ bus, config: CONFIG });
    emitIntake(bus, 1, [
      ['paint', 'retail'],
      ['doors_panels', 'insurance'],
      ['doors_panels', 'retail'],
    ]);
    const snap = a.snapshot();
    // A fresh instance on its own bus restores to the same derived views.
    const b = createBodyShopInsights({ bus: createEventBus(), config: CONFIG });
    b.restore(snap);
    expect(b.getDemandHeat()).toEqual(a.getDemandHeat());
    expect(b.getConquestHealth()).toEqual(a.getConquestHealth());
  });

  it('drops malformed entries from a restored window', () => {
    const insights = createBodyShopInsights({
      bus: createEventBus(),
      config: CONFIG,
    });
    insights.restore({
      schemaVersion: 1,
      intakeWindow: [
        ['paint', 'retail'],
        ['bogus' as Job, 'retail'],
        ['doors_panels', 'nope' as Channel],
        ['windows_glass', 'insurance'],
      ],
      dailyIntake: [],
    });
    const heat = insights.getDemandHeat();
    expect(heat.find((h) => h.category === 'paint')!.count).toBe(1);
    expect(heat.find((h) => h.category === 'windows_glass')!.count).toBe(1);
    // Only the two valid entries survive.
    expect(heat.reduce((s, h) => s + h.count, 0)).toBe(2);
  });
});
