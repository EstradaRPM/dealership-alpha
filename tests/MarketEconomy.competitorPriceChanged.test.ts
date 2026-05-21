import { createEventBus, type EventBus } from '../src/game/EventBus';
import {
  createCompetitorMarket,
  loadBrands,
  loadCompetitors,
  loadPersonalityDrift,
} from '../src/game/CompetitorMarket';
import { createMarketEconomy } from '../src/game/MarketEconomy';
import { loadTunables, type Tunables } from '../src/game/data';

/**
 * Slice #158 — `competitor:price_changed` event feeding the comp engine.
 *
 * CompetitorMarket emits on weekly drift when the pricing index moves by
 * ≥ `competitorMarket.pricingChangeThreshold`. MarketEconomy fans the move
 * out as one synthetic comp per segment with non-zero brand affinity, weighted
 * by affinity and scaled by `competitorInfluence`. Below the threshold no
 * event fires; without a brand catalog no event fires either.
 */

const competitors = loadCompetitors();
const personalityDrift = loadPersonalityDrift();
const brands = loadBrands();

function advanceWeeks(n: number, bus: EventBus): void {
  for (let w = 0; w < n; w++) {
    bus.publish('clock:day_ended', { day: (w + 1) * 7 });
  }
}

interface PriceChangedEvent {
  day: number;
  competitorId: string;
  brand: string;
  oldPricing: number;
  newPricing: number;
  segmentAffinity: Readonly<Record<string, number>>;
}

function capturePriceChanged(bus: EventBus): PriceChangedEvent[] {
  const out: PriceChangedEvent[] = [];
  bus.subscribe('competitor:price_changed', (e) => out.push(e));
  return out;
}

describe('CompetitorMarket → competitor:price_changed (#158)', () => {
  it('does not emit when brand catalog is omitted (backward-compat default)', () => {
    const bus = createEventBus();
    const events = capturePriceChanged(bus);
    createCompetitorMarket({ bus, competitors, personalityDrift, seed: 1 });

    advanceWeeks(20, bus);

    expect(events.length).toBe(0);
  });

  it('emits at least once over a multi-week drift when brands provided', () => {
    const bus = createEventBus();
    const events = capturePriceChanged(bus);
    createCompetitorMarket({ bus, competitors, personalityDrift, brands, seed: 1 });

    advanceWeeks(20, bus);

    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(typeof e.competitorId).toBe('string');
      expect(typeof e.brand).toBe('string');
      expect(Math.abs(e.newPricing - e.oldPricing)).toBeGreaterThanOrEqual(
        loadTunables().competitorMarket.pricingChangeThreshold,
      );
      expect(e.segmentAffinity).toEqual(brands[e.brand].segment_affinity);
    }
  });

  it('threshold below the smallest weekly move suppresses all events', () => {
    const bus = createEventBus();
    const events = capturePriceChanged(bus);
    const base = loadTunables();
    const tunables: Tunables = {
      ...base,
      competitorMarket: { pricingChangeThreshold: 1.0 },
    };
    createCompetitorMarket({
      bus,
      competitors,
      personalityDrift,
      brands,
      seed: 1,
      tunables,
    });

    advanceWeeks(50, bus);

    expect(events.length).toBe(0);
  });

  it('determinism: identical seed → identical event sequence', () => {
    const busA = createEventBus();
    const busB = createEventBus();
    const a = capturePriceChanged(busA);
    const b = capturePriceChanged(busB);
    createCompetitorMarket({
      bus: busA,
      competitors,
      personalityDrift,
      brands,
      seed: 4242,
    });
    createCompetitorMarket({
      bus: busB,
      competitors,
      personalityDrift,
      brands,
      seed: 4242,
    });

    advanceWeeks(15, busA);
    advanceWeeks(15, busB);

    expect(a).toEqual(b);
  });
});

describe('MarketEconomy ← competitor:price_changed (#158)', () => {
  it('feeds synthetic comps to segments with non-zero affinity', () => {
    const bus = createEventBus();
    let currentDay = 1;
    const me = createMarketEconomy({
      bus,
      getCurrentDay: () => currentDay,
    });

    // corden has truck=0.90, midline=0.50, economy=0.30, luxury=0.10
    bus.publish('competitor:price_changed', {
      day: 1,
      competitorId: 'valley-corden',
      brand: 'corden',
      oldPricing: 0.5,
      newPricing: 0.6,
      segmentAffinity: brands.corden.segment_affinity,
    });

    expect(me.compHistory.liveCount('truck', 1)).toBe(1);
    expect(me.compHistory.liveCount('midline', 1)).toBe(1);
    expect(me.compHistory.liveCount('economy', 1)).toBe(1);
    expect(me.compHistory.liveCount('luxury', 1)).toBe(1);

    // Positive pricing move → positive drift; high-affinity segment > low.
    const truckDrift = me.compHistory.segmentDrift('truck', 1);
    const luxuryDrift = me.compHistory.segmentDrift('luxury', 1);
    expect(truckDrift).toBeGreaterThan(0);
    expect(luxuryDrift).toBeGreaterThan(0);
    // Weight scales by affinity, delta is constant — single-entry drift is
    // delta * damping (weight cancels in a one-entry mean) → equal segments.
    // The real differentiation shows up when mixing with retail comps; here
    // we just confirm both segments got entries with appropriate weights.
    expect(truckDrift).toBeCloseTo(luxuryDrift, 8);

    me.dispose();
  });

  it('skips segments with zero affinity', () => {
    const bus = createEventBus();
    const me = createMarketEconomy({ bus, getCurrentDay: () => 1 });

    bus.publish('competitor:price_changed', {
      day: 1,
      competitorId: 'x',
      brand: 'x',
      oldPricing: 0.4,
      newPricing: 0.6,
      segmentAffinity: { truck: 0.8, economy: 0 },
    });

    expect(me.compHistory.liveCount('truck', 1)).toBe(1);
    expect(me.compHistory.liveCount('economy', 1)).toBe(0);

    me.dispose();
  });

  it('two saves with different competitor draws produce different segment drift', () => {
    function runSave(seed: number): number {
      const bus = createEventBus();
      let currentDay = 1;
      const me = createMarketEconomy({
        bus,
        getCurrentDay: () => currentDay,
        masterSeed: seed,
      });
      createCompetitorMarket({
        bus,
        competitors,
        personalityDrift,
        brands,
        seed,
      });

      // Run 12 weeks of drift, then read truck segment drift on day 90.
      for (let w = 0; w < 12; w++) {
        currentDay = (w + 1) * 7;
        bus.publish('clock:day_ended', { day: currentDay });
      }

      // Subtract the personality bias to isolate the comp-drift contribution.
      const drift = me.compHistory.segmentDrift('truck', 90);
      me.dispose();
      return drift;
    }

    const a = runSave(11);
    const b = runSave(9999);
    expect(a).not.toBe(b);
  });

  it('end-to-end: CompetitorMarket emission lands in MarketEconomy compHistory', () => {
    const bus = createEventBus();
    let currentDay = 1;
    const me = createMarketEconomy({
      bus,
      getCurrentDay: () => currentDay,
    });
    createCompetitorMarket({
      bus,
      competitors,
      personalityDrift,
      brands,
      seed: 1,
    });

    for (let w = 0; w < 20; w++) {
      currentDay = (w + 1) * 7;
      bus.publish('clock:day_ended', { day: currentDay });
    }

    // At least one segment should have accumulated comp entries.
    const totalEntries =
      me.compHistory.liveCount('truck', currentDay) +
      me.compHistory.liveCount('midline', currentDay) +
      me.compHistory.liveCount('economy', currentDay) +
      me.compHistory.liveCount('luxury', currentDay);
    expect(totalEntries).toBeGreaterThan(0);

    me.dispose();
  });
});
