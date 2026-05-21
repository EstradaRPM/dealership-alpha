import { createEventBus } from '../src/game/EventBus';
import {
  createMarketEconomy,
  createShockScheduler,
  loadMarketShocksConfig,
  type ActiveShockInstance,
} from '../src/game/MarketEconomy';
import { loadTunables, type Tunables } from '../src/game/data';

/**
 * Slice #159 — Stochastic shock scheduler.
 *
 * Schedule is fully deterministic from `masterSeed + day`. Each
 * `clock:day_started` is one scheduler step: resolve expired shocks, then
 * with probability `arrivalProbPerDay` activate a new one (catalog-weighted).
 * Active shocks modulate segment heat via the composer's `activeShockMod`
 * term and persist via the MarketEconomy `shocks` snapshot/restore surface.
 */

interface ShockStartedEvent {
  day: number;
  shockId: string;
  instanceId: string;
  label: string;
  segmentMagnitudes: Readonly<Record<string, number>>;
  expectedEndDay: number;
}

interface ShockResolvedEvent {
  day: number;
  shockId: string;
  instanceId: string;
}

function runDays(
  days: number,
  seed: number,
  tunables?: Tunables,
): {
  started: ShockStartedEvent[];
  resolved: ShockResolvedEvent[];
  active: readonly ActiveShockInstance[];
} {
  const bus = createEventBus();
  const started: ShockStartedEvent[] = [];
  const resolved: ShockResolvedEvent[] = [];
  bus.subscribe('market:shock_started', (e) => started.push(e));
  bus.subscribe('market:shock_resolved', (e) => resolved.push(e));
  const me = createMarketEconomy({
    bus,
    masterSeed: seed,
    getCurrentDay: () => 1,
    tunables,
  });
  for (let d = 1; d <= days; d++) {
    bus.publish('clock:day_started', { day: d });
  }
  const active = me.shocks.activeInstances();
  me.dispose();
  return { started, resolved, active };
}

describe('shock catalog (#159)', () => {
  it('has ≥6 shocks covering sedan/truck/suv segments', () => {
    const catalog = loadMarketShocksConfig();
    expect(catalog.shocks.length).toBeGreaterThanOrEqual(6);

    const segmentsCovered = new Set<string>();
    for (const s of catalog.shocks) {
      for (const eff of s.segmentEffects) segmentsCovered.add(eff.segment);
    }
    expect(segmentsCovered.has('sedan')).toBe(true);
    expect(segmentsCovered.has('truck')).toBe(true);
    expect(segmentsCovered.has('suv')).toBe(true);
  });
});

describe('shock scheduler determinism (#159)', () => {
  it('same seed → identical started+resolved sequence across 180 days', () => {
    const a = runDays(180, 4242);
    const b = runDays(180, 4242);
    expect(a.started).toEqual(b.started);
    expect(a.resolved).toEqual(b.resolved);
  });

  it('different seeds → different shock sequences', () => {
    const a = runDays(180, 11);
    const b = runDays(180, 9999);
    // With arrivalProbPerDay=0.03 across 180 days, at least one of the two
    // saves should have started a shock and the two should differ somewhere.
    const aFingerprint = a.started.map((e) => `${e.shockId}@${e.day}`).join('|');
    const bFingerprint = b.started.map((e) => `${e.shockId}@${e.day}`).join('|');
    expect(aFingerprint).not.toBe(bFingerprint);
  });

  it('at least one shock activates within a long enough window', () => {
    const { started } = runDays(365, 7);
    expect(started.length).toBeGreaterThan(0);
  });
});

describe('shock activation/resolution timing (#159)', () => {
  it('every started shock resolves on day expectedEndDay+1 when the window is long enough', () => {
    const { started, resolved } = runDays(720, 1234);
    expect(started.length).toBeGreaterThan(0);
    for (const s of started) {
      // Only assert resolution for instances whose end day fits inside the run.
      if (s.expectedEndDay + 1 > 720) continue;
      const r = resolved.find((x) => x.instanceId === s.instanceId);
      expect(r).toBeDefined();
      expect(r!.day).toBe(s.expectedEndDay + 1);
    }
  });

  it('respects maxConcurrent — never more than the cap active simultaneously', () => {
    const base = loadTunables();
    const tunables: Tunables = {
      ...base,
      marketEconomy: {
        ...base.marketEconomy,
        shocks: { arrivalProbPerDay: 1.0, maxConcurrent: 2 },
      },
    };
    const bus = createEventBus();
    const me = createMarketEconomy({
      bus,
      masterSeed: 5,
      getCurrentDay: () => 1,
      tunables,
    });
    for (let d = 1; d <= 30; d++) {
      bus.publish('clock:day_started', { day: d });
      expect(me.shocks.activeInstances().length).toBeLessThanOrEqual(2);
    }
    me.dispose();
  });
});

describe('shock composer integration (#159)', () => {
  it('activeShockMod feeds the segmentHeat composer used by providers', () => {
    const scheduler = createShockScheduler({ masterSeed: 1 });
    scheduler.restore({
      schemaVersion: 1,
      active: [
        {
          instanceId: 'truck_oem_recall@10',
          shockId: 'truck_oem_recall',
          label: 'OEM truck recall',
          startDay: 10,
          expectedEndDay: 30,
          segmentMagnitudes: { truck: -0.08 },
        },
      ],
    });
    expect(scheduler.activeShockMod('truck', { category: 'truck' } as never)).toBeCloseTo(
      -0.08,
      8,
    );
    expect(scheduler.activeShockMod('sedan', { category: 'sedan' } as never)).toBe(0);
  });

  it('multiple active shocks on the same segment sum additively', () => {
    const scheduler = createShockScheduler({ masterSeed: 1 });
    scheduler.restore({
      schemaVersion: 1,
      active: [
        {
          instanceId: 'a@1',
          shockId: 'a',
          label: 'A',
          startDay: 1,
          expectedEndDay: 10,
          segmentMagnitudes: { truck: -0.05 },
        },
        {
          instanceId: 'b@2',
          shockId: 'b',
          label: 'B',
          startDay: 2,
          expectedEndDay: 12,
          segmentMagnitudes: { truck: 0.02 },
        },
      ],
    });
    expect(
      scheduler.activeShockMod('truck', { category: 'truck' } as never),
    ).toBeCloseTo(-0.03, 8);
  });
});

describe('shock persistence (#159)', () => {
  it('snapshot/restore round-trips active state', () => {
    const bus = createEventBus();
    const me = createMarketEconomy({
      bus,
      masterSeed: 42,
      getCurrentDay: () => 1,
    });
    // Run far enough that at least one shock activates.
    for (let d = 1; d <= 365; d++) bus.publish('clock:day_started', { day: d });
    const snap = me.shocks.snapshot();
    me.dispose();

    const bus2 = createEventBus();
    const me2 = createMarketEconomy({
      bus: bus2,
      masterSeed: 42,
      getCurrentDay: () => 1,
    });
    me2.shocks.restore(snap);
    expect(me2.shocks.snapshot()).toEqual(snap);
    me2.dispose();
  });
});

describe('pure-engine path (no bus) (#159)', () => {
  it('omits shock scheduler entirely — active list empty, no events', () => {
    const me = createMarketEconomy({ masterSeed: 7 });
    expect(me.shocks.activeInstances()).toEqual([]);
    expect(me.shocks.snapshot()).toEqual({ schemaVersion: 1, active: [] });
  });
});
