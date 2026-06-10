import { createEventBus } from '../src/game/EventBus';
import {
  computeAnchor,
  createCompHistory,
  createMarketEconomy,
  loadMarketMarkupConfig,
  type MarketVehicleInput,
} from '../src/game/MarketEconomy';
import { loadBrandTiersConfig } from '../src/game/SalesProcess';

/**
 * Slice #157 — comp history rolling window + emergent segment drift.
 *
 * The window stores each transaction's normalized delta `(price/reference) -
 * 1`. The composer turns the weighted mean into segmentDrift, which layers
 * on top of the per-save personality bias. Cold start (empty window) →
 * drift=0, the providers degrade to the slice-#156 personality-only path.
 */

const civic = (): MarketVehicleInput => ({
  purchasePrice: 11_000,
  reconCost: 800,
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: 2024,
  mileage: 36_000,
  category: 'sedan',
  condition: 'average',
});

const f150 = (): MarketVehicleInput => ({
  purchasePrice: 22_000,
  reconCost: 1_200,
  templateId: 'corden_truck',
  brand: 'corden',
  year: 2023,
  mileage: 48_000,
  category: 'truck',
  condition: 'average',
});

const TEST_CONFIG = {
  sizePerSegment: 5,
  ageCutoffDays: 30,
  retailWeight: 1.0,
  wholesaleWeight: 0.5,
  competitorWeight: 0.3,
  driftDamping: 1.0,
};

describe('MarketEconomy — compHistory rolling window (#157)', () => {
  it('cold start returns segmentDrift = 0 (providers fall back to personality-only)', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    expect(ch.segmentDrift('sedan', 1)).toBe(0);
    expect(ch.liveCount('sedan', 1)).toBe(0);
  });

  it('retail comp above reference produces positive drift', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    ch.recordRetail({ segment: 'sedan', delta: 0.1, day: 1 });
    expect(ch.segmentDrift('sedan', 1)).toBeCloseTo(0.1, 5);
  });

  it('weighted mean: retail outweighs wholesale by config', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    ch.recordRetail({ segment: 'sedan', delta: 0.2, day: 1 });
    ch.recordWholesale({ segment: 'sedan', delta: -0.2, day: 1 });
    // weighted mean = (0.2*1.0 + -0.2*0.5) / (1.5) = 0.066...
    expect(ch.segmentDrift('sedan', 1)).toBeCloseTo(0.1 / 1.5, 5);
  });

  it('damping multiplier scales the mean delta', () => {
    const ch = createCompHistory({
      config: { ...TEST_CONFIG, driftDamping: 0.5 },
    });
    ch.recordRetail({ segment: 'sedan', delta: 0.1, day: 1 });
    expect(ch.segmentDrift('sedan', 1)).toBeCloseTo(0.05, 5);
  });

  it('FIFO eviction: window respects sizePerSegment', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    for (let i = 0; i < 10; i++) {
      ch.recordRetail({ segment: 'sedan', delta: 0.01 * i, day: 1 });
    }
    // Window keeps the last 5 entries (deltas 0.05..0.09).
    expect(ch.liveCount('sedan', 1)).toBe(5);
    const mean = (0.05 + 0.06 + 0.07 + 0.08 + 0.09) / 5;
    expect(ch.segmentDrift('sedan', 1)).toBeCloseTo(mean, 5);
  });

  it('age cutoff drops stale entries from the average', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    ch.recordRetail({ segment: 'sedan', delta: 0.5, day: 1 });
    ch.recordRetail({ segment: 'sedan', delta: 0.1, day: 50 });
    // currentDay=60 → day-1 entry is age 59 > 30 (cutoff), excluded.
    expect(ch.segmentDrift('sedan', 60)).toBeCloseTo(0.1, 5);
    expect(ch.liveCount('sedan', 60)).toBe(1);
  });

  it('segments are isolated — sedan comps do not move truck drift', () => {
    const ch = createCompHistory({ config: TEST_CONFIG });
    ch.recordRetail({ segment: 'sedan', delta: 0.3, day: 1 });
    expect(ch.segmentDrift('sedan', 1)).toBeCloseTo(0.3, 5);
    expect(ch.segmentDrift('truck', 1)).toBe(0);
  });

  it('snapshot + restore reproduces identical drift (persistence contract)', () => {
    const a = createCompHistory({ config: TEST_CONFIG });
    a.recordRetail({ segment: 'sedan', delta: 0.1, day: 1 });
    a.recordWholesale({ segment: 'sedan', delta: -0.05, day: 2 });
    a.recordRetail({ segment: 'truck', delta: 0.2, day: 3 });

    const snap = a.snapshot();
    const b = createCompHistory({ config: TEST_CONFIG });
    b.restore(snap);
    expect(b.segmentDrift('sedan', 5)).toBeCloseTo(a.segmentDrift('sedan', 5), 5);
    expect(b.segmentDrift('truck', 5)).toBeCloseTo(a.segmentDrift('truck', 5), 5);
    expect(b.liveCount('sedan', 5)).toBe(a.liveCount('sedan', 5));
  });
});

describe('MarketEconomy — segmentHeat composer wired through providers (#157)', () => {
  it('providers respond to recorded retail comps (bookValue shifts)', () => {
    const bus = createEventBus();
    let day = 1;
    const me = createMarketEconomy({
      masterSeed: 0, // any seed; we compare deltas, not absolutes
      bus,
      getCurrentDay: () => day,
    });
    const baseline = me.bookValueFn(civic());

    const v = civic();
    bus.publish('inventory:vehicle_sold', {
      day,
      vehicleId: 'v1',
      // Sale price 30% above the engine's anchor*markup → strong positive
      // retail comp on the sedan segment.
      salePrice: Math.round(
        computeAnchor(v) *
          loadMarketMarkupConfig().markups.sedan[
            (loadBrandTiersConfig().brands[v.brand] ?? 'mainstream') as
              | 'economy'
              | 'luxury'
              | 'mainstream'
          ] *
          1.3,
      ),
      templateId: v.templateId,
      brand: v.brand,
      make: 'Honda',
      year: v.year,
      mileage: v.mileage,
      condition: v.condition,
      category: v.category,
      purchasePrice: v.purchasePrice,
      reconCost: v.reconCost,
    });

    const heated = me.bookValueFn(civic());
    expect(heated).toBeGreaterThan(baseline);
    me.dispose();
  });

  it('wholesale comps below anchor produce negative drift', () => {
    const bus = createEventBus();
    let day = 1;
    const me = createMarketEconomy({
      bus,
      getCurrentDay: () => day,
    });
    const v = civic();
    const anchor = computeAnchor(v);
    bus.publish('inventory:vehicle_purchased', {
      day,
      vehicleId: 'v1',
      cost: Math.round(anchor * 0.7), // 30% below anchor — cool segment
      templateId: v.templateId,
      brand: v.brand,
      make: 'Honda',
      year: v.year,
      mileage: v.mileage,
      condition: v.condition,
      category: v.category,
      reconCost: v.reconCost,
    });
    expect(me.compHistory.segmentDrift('sedan', day)).toBeLessThan(0);
    me.dispose();
  });

  it('determinism: identical event sequences produce identical drift', () => {
    function run(): number {
      const bus = createEventBus();
      let day = 1;
      const me = createMarketEconomy({
        masterSeed: 42,
        bus,
        getCurrentDay: () => day,
      });
      const v = civic();
      for (let i = 0; i < 3; i++) {
        bus.publish('inventory:vehicle_purchased', {
          day,
          vehicleId: `v${i}`,
          cost: 10_000 + i * 100,
          templateId: v.templateId,
          brand: v.brand,
          make: 'Honda',
          year: v.year,
          mileage: v.mileage,
          condition: v.condition,
          category: v.category,
          reconCost: v.reconCost,
        });
      }
      return me.compHistory.segmentDrift('sedan', day);
    }
    expect(run()).toBe(run());
  });

  it('cold start: providers without bus equal personality-only output', () => {
    const me = createMarketEconomy({ masterSeed: 7 });
    // No comps recorded — drift contribution is zero, so the engine matches
    // the slice-#156 behavior verified by the personality tests. We assert
    // the output is stable across repeated calls (no hidden state).
    const v = civic();
    const a = me.bookValueFn(v);
    const b = me.bookValueFn(v);
    expect(a).toBe(b);
  });

  it('dispose() unsubscribes — later events do not move drift', () => {
    const bus = createEventBus();
    let day = 1;
    const me = createMarketEconomy({ bus, getCurrentDay: () => day });
    me.dispose();
    const v = f150();
    bus.publish('inventory:vehicle_sold', {
      day,
      vehicleId: 'v1',
      salePrice: 999_999,
      templateId: v.templateId,
      brand: v.brand,
      make: 'Ford',
      year: v.year,
      mileage: v.mileage,
      condition: v.condition,
      category: v.category,
      purchasePrice: v.purchasePrice,
      reconCost: v.reconCost,
    });
    expect(me.compHistory.segmentDrift('truck', day)).toBe(0);
  });
});
