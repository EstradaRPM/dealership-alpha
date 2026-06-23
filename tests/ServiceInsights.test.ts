import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createServiceInsights,
  classifyServiceHeat,
  trendForSeries,
  type ServiceInsights,
  type ServiceInsightsConfig,
  type InstalledBaseRead,
} from '../src/game/ServiceInsights';

const CONFIG: ServiceInsightsConfig = {
  demandWindowSize: 40,
  heatThresholds: { hot: 1.15, cold: 0.85 },
  demandTrendEpsilon: 0.05,
  baseHealthWindowDays: 14,
  baseTrendEpsilon: 0.15,
};

type Owner = ReturnType<InstalledBaseRead['getOwners']>[number];

function owner(partial: Partial<Owner>): Owner {
  return {
    loyalty: 0.8,
    csi: 0.7,
    consecutiveBadVisits: 0,
    consecutiveNoReturns: 0,
    ...partial,
  };
}

function stubBase(owners: Owner[]): InstalledBaseRead {
  return { getOwners: () => owners, get size() { return owners.length; } };
}

function intakeTicket(jobCategory: string, i: number) {
  return {
    ticketId: `t${i}`,
    source: 'return' as const,
    customerId: `c${i}`,
    vehicleId: `v${i}`,
    category: 'sedan',
    powertrain: 'ice' as const,
    jobCategory: jobCategory as
      | 'oil_filters'
      | 'tires_brakes'
      | 'drivetrain'
      | 'electronics',
    baseRevenue: 100,
  };
}

function emitIntake(bus: EventBus, day: number, categories: string[]) {
  bus.publish('serviceDemand:intake_ready', {
    day,
    intake: categories.map((c, i) => intakeTicket(c, day * 100 + i)),
  });
}

describe('ServiceInsights pure classifiers', () => {
  it('bands a category share against an even four-way split', () => {
    // Even share across 4 categories is 0.25 ⇒ heat 1.0 (warm).
    expect(classifyServiceHeat(0.25, 4, CONFIG.heatThresholds)).toBe('warm');
    expect(classifyServiceHeat(0.4, 4, CONFIG.heatThresholds)).toBe('hot'); // 1.6×
    expect(classifyServiceHeat(0.1, 4, CONFIG.heatThresholds)).toBe('cold'); // 0.4×
  });

  it('reads a numeric series trend by newer-vs-older half', () => {
    expect(trendForSeries([1, 1, 5, 5], 0.15)).toBe('rising');
    expect(trendForSeries([5, 5, 1, 1], 0.15)).toBe('falling');
    expect(trendForSeries([2, 2, 2, 2], 0.15)).toBe('steady');
    expect(trendForSeries([3], 0.15)).toBe('steady');
  });
});

describe('ServiceInsights demand heat', () => {
  let bus: EventBus;
  let insights: ServiceInsights;

  beforeEach(() => {
    bus = createEventBus();
    insights = createServiceInsights({
      bus,
      installedBase: stubBase([]),
      config: CONFIG,
    });
  });

  it('returns all four categories in fixed order, 0-share before any intake', () => {
    const heat = insights.getDemandHeat();
    expect(heat.map((h) => h.category)).toEqual([
      'oil_filters',
      'tires_brakes',
      'drivetrain',
      'electronics',
    ]);
    expect(heat.every((h) => h.count === 0 && h.share === 0)).toBe(true);
  });

  it('accumulates the intake stream into per-category shares + bands', () => {
    // 6 oil, 2 tires across an 8-ticket window: oil dominates (0.75× → hot),
    // tires sit at an even share (0.25 → 1.0× → warm), the two empty categories
    // read cold.
    emitIntake(bus, 1, ['oil_filters', 'oil_filters', 'oil_filters', 'tires_brakes']);
    emitIntake(bus, 2, ['oil_filters', 'oil_filters', 'oil_filters', 'tires_brakes']);
    const heat = insights.getDemandHeat();
    const oil = heat.find((h) => h.category === 'oil_filters')!;
    const tires = heat.find((h) => h.category === 'tires_brakes')!;
    const drivetrain = heat.find((h) => h.category === 'drivetrain')!;
    expect(oil.count).toBe(6);
    expect(oil.share).toBeCloseTo(0.75);
    expect(oil.band).toBe('hot');
    expect(tires.band).toBe('warm');
    expect(drivetrain.count).toBe(0);
    expect(drivetrain.band).toBe('cold');
  });

  it('caps the trailing window at demandWindowSize (oldest evicted)', () => {
    const small = createServiceInsights({
      bus,
      installedBase: stubBase([]),
      config: { ...CONFIG, demandWindowSize: 4 },
    });
    emitIntake(bus, 1, ['oil_filters', 'oil_filters']); // evicted
    emitIntake(bus, 2, ['tires_brakes', 'drivetrain', 'electronics', 'electronics']);
    const heat = small.getDemandHeat();
    expect(heat.find((h) => h.category === 'oil_filters')!.count).toBe(0);
    expect(heat.find((h) => h.category === 'electronics')!.count).toBe(2);
  });
});

describe('ServiceInsights base health', () => {
  it('reads size + avg loyalty/CSI + at-risk count off the live registry', () => {
    const base = stubBase([
      owner({ loyalty: 1.0, csi: 0.8 }),
      owner({ loyalty: 0.6, csi: 0.6, consecutiveBadVisits: 2 }),
      owner({ loyalty: 0.8, csi: 0.7, consecutiveNoReturns: 1 }),
    ]);
    const insights = createServiceInsights({ bus: createEventBus(), installedBase: base, config: CONFIG });
    const bh = insights.getBaseHealth();
    expect(bh.size).toBe(3);
    expect(bh.avgLoyalty).toBeCloseTo((1.0 + 0.6 + 0.8) / 3);
    expect(bh.avgCsi).toBeCloseTo((0.8 + 0.6 + 0.7) / 3);
    expect(bh.atRiskCount).toBe(2);
  });

  it('reports zeros for an empty base without dividing by zero', () => {
    const insights = createServiceInsights({ bus: createEventBus(), installedBase: stubBase([]), config: CONFIG });
    const bh = insights.getBaseHealth();
    expect(bh).toMatchObject({ size: 0, avgLoyalty: 0, avgCsi: 0, atRiskCount: 0 });
  });

  it('derives return + defection rates and trends over the day window', () => {
    const bus = createEventBus();
    const insights = createServiceInsights({ bus, installedBase: stubBase([]), config: CONFIG });
    // Returns climbing across four days; defections only late.
    for (const [day, count] of [[1, 0], [2, 1], [3, 4], [4, 5]] as const) {
      bus.publish('installedBase:returns_ready', {
        day,
        returns: Array.from({ length: count }, (_, i) => ({
          ownerId: `o${day}-${i}`,
          customerId: `c${i}`,
          vehicleId: `v${i}`,
          category: 'sedan',
          powertrain: 'ice' as const,
          jobCategory: 'oil_filters' as const,
          ageDays: 120,
        })),
      });
    }
    bus.publish('installedBase:owner_defected', { day: 4, ownerId: 'x', customerId: 'c', reason: 'sustained_non_return' });
    const bh = insights.getBaseHealth();
    expect(bh.returnsPerDay).toBeCloseTo((0 + 1 + 4 + 5) / 4);
    expect(bh.returnTrend).toBe('rising');
    expect(bh.defectionsPerDay).toBeCloseTo(0.25);
    expect(bh.churnTrend).toBe('rising');
  });
});

describe('ServiceInsights persistence', () => {
  it('round-trips the trailing window + day maps through snapshot/restore', () => {
    const bus = createEventBus();
    const a = createServiceInsights({ bus, installedBase: stubBase([]), config: CONFIG });
    emitIntake(bus, 1, ['oil_filters', 'tires_brakes', 'tires_brakes']);
    bus.publish('installedBase:returns_ready', { day: 1, returns: [] });
    bus.publish('installedBase:owner_defected', { day: 1, ownerId: 'o', customerId: 'c', reason: 'x' });

    const snap = a.snapshot();
    // A fresh instance on its own bus restores to the same derived views.
    const b = createServiceInsights({ bus: createEventBus(), installedBase: stubBase([]), config: CONFIG });
    b.restore(snap);
    expect(b.getDemandHeat()).toEqual(a.getDemandHeat());
    expect(b.getBaseHealth().defectionsPerDay).toBeCloseTo(a.getBaseHealth().defectionsPerDay);
  });

  it('drops unknown categories from a restored window', () => {
    const insights = createServiceInsights({ bus: createEventBus(), installedBase: stubBase([]), config: CONFIG });
    insights.restore({
      schemaVersion: 1,
      demandWindow: ['oil_filters', 'bogus' as 'oil_filters', 'electronics'],
      dailyReturns: [],
      dailyDefections: [],
    });
    const heat = insights.getDemandHeat();
    expect(heat.find((h) => h.category === 'oil_filters')!.count).toBe(1);
    expect(heat.find((h) => h.category === 'electronics')!.count).toBe(1);
    // Total window is 2 (the bogus entry was dropped), not 3.
    expect(heat.reduce((s, h) => s + h.count, 0)).toBe(2);
  });
});
