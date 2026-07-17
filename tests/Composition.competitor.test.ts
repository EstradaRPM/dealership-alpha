import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #183: CompetitorMarket was a finished module that `createWorld` never
// instantiated, leaving the ambient rival-roster heartbeat and the #158
// competitor demand-fuel inert in a running game. These tests drive the REAL
// createWorld (not a hand-composed harness) to prove the wiring is live and
// deterministic.

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

function build(masterSeed: number) {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  return { bus, world };
}

/** Stats fingerprint for a competitor roster — for deep equality / determinism. */
function fingerprint(world: ReturnType<typeof build>['world']): string {
  return world.competitorMarket
    .getCompetitors()
    .map((c) => `${c.id}:${c.rep.toFixed(8)}:${c.inventory.toFixed(8)}:${c.pricing.toFixed(8)}`)
    .join('|');
}

describe('#183 — CompetitorMarket wired into createWorld', () => {
  it('exposes a built CompetitorMarket on the World', () => {
    const { world } = build(42);
    expect(world.competitorMarket).toBeDefined();
    expect(world.competitorMarket.getCompetitors().length).toBeGreaterThan(0);
  });

  it('publishes market:competitive_pressure on day start in a built World', () => {
    const { bus, world } = build(42);
    let pressure: { day: number; competitors: ReadonlyArray<{ id: string }> } | null = null;
    bus.subscribe('market:competitive_pressure', (p) => {
      pressure = p;
    });

    bus.publish('clock:day_started', { day: 1 });

    expect(pressure).not.toBeNull();
    expect(pressure!.competitors.length).toBe(
      world.competitorMarket.getCompetitors().length,
    );
  });

  it('fires competitor:price_changed on weekly drift and MarketEconomy records the synthetic comp', () => {
    const { bus, world } = build(42);

    const priceChanges: Array<{
      day: number;
      segmentAffinity: Record<string, number>;
    }> = [];
    bus.subscribe('competitor:price_changed', (p) => {
      priceChanges.push({ day: p.day, segmentAffinity: p.segmentAffinity });
    });

    // Drive weekly drift ticks until a meaningful pricing move publishes (a
    // single week may not clear the pricingChangeThreshold for any competitor).
    for (let week = 1; week <= 40 && priceChanges.length === 0; week++) {
      bus.publish('clock:day_ended', { day: week * 7 });
    }

    expect(priceChanges.length).toBeGreaterThan(0);

    // MarketEconomy fans the move out as a synthetic comp per affected segment.
    // Cold start had zero comps, so any affected segment now reads liveCount>0.
    const first = priceChanges[0];
    const affectedSegment = Object.entries(first.segmentAffinity).find(
      ([, affinity]) => affinity > 0,
    );
    expect(affectedSegment).toBeDefined();
    const [segment] = affectedSegment!;
    expect(
      world.marketEconomy.compHistory.liveCount(segment, first.day),
    ).toBeGreaterThan(0);
  });

  it('is deterministic: same masterSeed reproduces the identical drift trajectory', () => {
    const a = build(12345);
    const b = build(12345);

    for (let week = 1; week <= 20; week++) {
      a.bus.publish('clock:day_ended', { day: week * 7 });
      b.bus.publish('clock:day_ended', { day: week * 7 });
    }

    expect(fingerprint(a.world)).toBe(fingerprint(b.world));
  });

  it('different masterSeeds diverge (drift seed is namespaced off the root)', () => {
    const a = build(1);
    const b = build(2);

    for (let week = 1; week <= 20; week++) {
      a.bus.publish('clock:day_ended', { day: week * 7 });
      b.bus.publish('clock:day_ended', { day: week * 7 });
    }

    expect(fingerprint(a.world)).not.toBe(fingerprint(b.world));
  });
});
