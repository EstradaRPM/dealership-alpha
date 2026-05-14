import { createEventBus } from '../src/game/EventBus';
import {
  createCompetitorMarket,
  loadCompetitors,
  loadPersonalityDrift,
} from '../src/game/CompetitorMarket';

const competitors = loadCompetitors();
const personalityDrift = loadPersonalityDrift();

function advanceWeeks(n: number, market: ReturnType<typeof createCompetitorMarket>, bus: ReturnType<typeof createEventBus>): void {
  for (let week = 0; week < n; week++) {
    for (let d = 0; d < 7; d++) {
      const day = week * 7 + d + 1;
      bus.publish('clock:day_ended', { day });
      bus.publish('clock:day_started', { day });
    }
  }
}

describe('CompetitorMarket weekly drift', () => {
  it('stats stay within clamp bounds after 500 weeks', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 42 });

    advanceWeeks(500, market, bus);

    for (const c of market.getCompetitors()) {
      expect(c.rep).toBeGreaterThanOrEqual(c.clamp.rep.lo);
      expect(c.rep).toBeLessThanOrEqual(c.clamp.rep.hi);
      expect(c.inventory).toBeGreaterThanOrEqual(c.clamp.inventory.lo);
      expect(c.inventory).toBeLessThanOrEqual(c.clamp.inventory.hi);
      expect(c.pricing).toBeGreaterThanOrEqual(c.clamp.pricing.lo);
      expect(c.pricing).toBeLessThanOrEqual(c.clamp.pricing.hi);
    }
  });

  it('drift only fires on multiples of 7 (non-week days leave stats unchanged)', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 7 });

    const before = market.getCompetitors().map((c) => ({ id: c.id, rep: c.rep, inventory: c.inventory, pricing: c.pricing }));

    // Days 1-6 should not drift
    for (let d = 1; d <= 6; d++) {
      bus.publish('clock:day_ended', { day: d });
    }

    const after = market.getCompetitors().map((c) => ({ id: c.id, rep: c.rep, inventory: c.inventory, pricing: c.pricing }));
    expect(after).toEqual(before);
  });

  it('drift fires on day 7 and changes at least one stat', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 99 });

    const snap = (c: ReturnType<typeof market.getCompetitors>[number]) =>
      `${c.rep.toFixed(6)}:${c.inventory.toFixed(6)}:${c.pricing.toFixed(6)}`;
    const before = market.getCompetitors().map(snap).join('|');

    bus.publish('clock:day_ended', { day: 7 });

    const after = market.getCompetitors().map(snap).join('|');
    expect(after).not.toBe(before);
  });

  it('getCompetitor returns the same live object updated by drift', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 13 });
    const first = competitors[0];

    const before = market.getCompetitor(first.id)!.rep;
    // Advance many weeks until rep drifts at least once
    let changed = false;
    for (let w = 0; w < 200 && !changed; w++) {
      bus.publish('clock:day_ended', { day: (w + 1) * 7 });
      if (market.getCompetitor(first.id)!.rep !== before) changed = true;
    }

    expect(changed).toBe(true);
  });

  it('getCompetitor returns undefined for unknown id', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 1 });
    expect(market.getCompetitor('does-not-exist')).toBeUndefined();
  });

  it('market:competitive_pressure payload reflects post-drift values', () => {
    const bus = createEventBus();
    const market = createCompetitorMarket({ bus, competitors, personalityDrift, seed: 55 });

    // Drift on day 7
    bus.publish('clock:day_ended', { day: 7 });

    const live = market.getCompetitors().map((c) => ({ id: c.id, rep: c.rep }));

    let pressureReps: { id: string; rep: number }[] = [];
    bus.subscribe('market:competitive_pressure', (p) => {
      pressureReps = p.competitors.map((c) => ({ id: c.id, rep: c.rep }));
    });
    bus.publish('clock:day_started', { day: 8 });

    expect(pressureReps).toEqual(live);
  });
});

describe('PersonalityDrift data', () => {
  it('loads without error', () => {
    expect(() => loadPersonalityDrift()).not.toThrow();
  });

  it('every competitor personality has a drift entry', () => {
    const drift = loadPersonalityDrift();
    for (const c of competitors) {
      expect(drift[c.personality]).toBeDefined();
    }
  });

  it('all sigma values are non-negative', () => {
    const drift = loadPersonalityDrift();
    for (const [, sigma] of Object.entries(drift)) {
      expect(sigma.rep).toBeGreaterThanOrEqual(0);
      expect(sigma.inventory).toBeGreaterThanOrEqual(0);
      expect(sigma.pricing).toBeGreaterThanOrEqual(0);
    }
  });
});
