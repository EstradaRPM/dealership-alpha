import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import {
  createReputation,
  type Reputation,
  type ReputationConfig,
  type ReputationSnapshotV1,
} from '../src/game/Reputation';

/**
 * Per-brand reputation (#151, B2 I6) — the store's standing selling one make,
 * carried from sold deals and consumed by the customer→vehicle match.
 *
 * The design call this suite pins: **ambient depth, not a dashboard**. The
 * player never reads the number; they feel it through which car the next
 * customer gravitates to. That is the standing "model honest under the hood,
 * promote only what is a fun decision" rule.
 */

const CONFIG: ReputationConfig = {
  startingSatisfaction: 70,
  startingReviewScore: 60,
  startingStandingPenalty: 10,
  satisfactionMin: 0,
  satisfactionMax: 100,
  closedDealSatisfactionBonus: 3,
  closedDealReviewBonus: 1,
  walkSatisfactionPenalty: -1,
  reviewDriftRate: 0.1,
  satisfactionEquilibrium: 50,
  satisfactionDriftRate: 0.02,
  baseDailyDemand: 2,
  demandReviewSlope: 0.015,
  marketingSaturation: 1000,
  marketingMaxBoost: 0.6,
  brandReputation: {
    closedDealBonus: 0.05,
    badReviewPenalty: -0.2,
    driftRate: 0.02,
    matchWeight: 0.15,
  },
  seasonDemandMultiplier: { spring: 1, summer: 1.15, fall: 1.05, winter: 0.85 },
  dayOfWeekDemandMultiplier: {
    '0': 0.9, '1': 1.0, '2': 1.0, '3': 1.05, '4': 1.15, '5': 1.4, '6': 0.7,
  },
};

function makeSetup(overrides: Partial<ReputationConfig['brandReputation']> = {}) {
  const bus = createEventBus();
  const clock = createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 100_000, config: { weeklyRent: 0 } });
  const reputation = createReputation({
    bus,
    economy,
    config: { ...CONFIG, brandReputation: { ...CONFIG.brandReputation, ...overrides } },
  });
  return { bus, clock, economy, reputation };
}

let customerSeq = 0;

/** One closed sale of `brand` through the live outcome truth (#180). */
function publishClose(bus: EventBus, brand: string, badReview = false): void {
  customerSeq += 1;
  bus.publish('staff:auto_resolved', {
    customerId: `c${customerSeq}`,
    staffId: 's1',
    day: 1,
    outcome: 'closed',
    grossImpact: 2_000,
    matchQuality: 0.8,
    vehicleCategory: 'sedan',
    brand,
    archetypeLabel: 'Young Family',
    badReview,
  });
}

/** A walk-off — carries no brand, because the customer never owned the car. */
function publishWalkOff(bus: EventBus, reason = 'no_close'): void {
  customerSeq += 1;
  bus.publish('staff:auto_resolved', {
    customerId: `c${customerSeq}`,
    staffId: 's1',
    day: 1,
    outcome: 'no_sale',
    grossImpact: 0,
    reason,
    archetypeLabel: 'Young Family',
    wantedCategory: 'sedan',
    heat: 0.4,
  });
}

function driftOneNight(bus: EventBus): void {
  bus.publish('clock:overnight_reputation_drift', { day: 1 });
}

describe('Reputation — per-brand standing (#151)', () => {
  it('repFor is bounded and defaults to neutral for an unseen make', () => {
    const { bus, reputation } = makeSetup();
    // A make the store has never delivered has no record — neutral, not bad.
    expect(reputation.repFor('vanda')).toBe(0);

    // Far more clean deliveries than the ceiling allows, then the same in
    // reverse: the standing saturates instead of running away.
    for (let i = 0; i < 200; i += 1) publishClose(bus, 'vanda');
    expect(reputation.repFor('vanda')).toBe(1);

    for (let i = 0; i < 200; i += 1) publishClose(bus, 'vanda', true);
    expect(reputation.repFor('vanda')).toBe(-1);
  });

  it('a bad run on one brand does not stain the rest of the lot', () => {
    const { bus, reputation } = makeSetup();
    for (let i = 0; i < 3; i += 1) publishClose(bus, 'vanda', true);
    publishClose(bus, 'toraya');

    expect(reputation.repFor('vanda')).toBeLessThan(0);
    expect(reputation.repFor('toraya')).toBeGreaterThan(0);
    expect(reputation.repFor('kestrel')).toBe(0);
  });

  it('carries from SOLD deals only — a walk-off moves no brand', () => {
    const { bus, reputation } = makeSetup();
    publishWalkOff(bus);
    publishWalkOff(bus, 'trust_collapse');
    expect(reputation.repFor('vanda')).toBe(0);
  });

  it('mean-reverts overnight, so one rough run is not a permanent stain', () => {
    const { bus, reputation } = makeSetup();
    publishClose(bus, 'vanda', true);
    const stained = reputation.repFor('vanda');
    expect(stained).toBeLessThan(0);

    for (let i = 0; i < 50; i += 1) driftOneNight(bus);
    const recovered = reputation.repFor('vanda');
    expect(recovered).toBeGreaterThan(stained);
    expect(recovered).toBeLessThan(0); // toward neutral, never past it
  });

  it('survives a save/load and a pre-#151 blob restores as "no record yet"', () => {
    const { bus, reputation } = makeSetup();
    publishClose(bus, 'vanda', true);
    publishClose(bus, 'toraya');
    const snap = reputation.snapshot();
    expect(snap.schemaVersion).toBe(2);

    const loaded = makeSetup().reputation;
    loaded.restore(snap);
    expect(loaded.repFor('vanda')).toBeCloseTo(reputation.repFor('vanda'), 10);
    expect(loaded.repFor('toraya')).toBeCloseTo(reputation.repFor('toraya'), 10);

    // A v1 blob predates the map; every make reads neutral, which is the state
    // that save was actually in.
    const v1: ReputationSnapshotV1 = {
      schemaVersion: 1,
      customerSatisfaction: 80,
      reviewScore: 65,
      marketingBudget: 0,
    };
    loaded.restore(v1);
    expect(loaded.repFor('vanda')).toBe(0);
    expect(loaded.customerSatisfaction).toBe(80);
  });
});

/**
 * The I6 scope call, asserted rather than trusted: per-brand reputation is
 * ambient. It reaches the player through the match (and later as Reveal
 * reaction text), never as a screen — so no UI file reads it.
 */
describe('Reputation — per-brand standing has no player-facing surface', () => {
  it('per-brand reputation reaches the player only as reaction text', () => {
    const uiRoot = join(__dirname, '..', 'src', 'ui');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        const src = readFileSync(full, 'utf8');
        if (/\brepFor\b|\bbrandReputation\b/.test(src)) offenders.push(full);
      }
    };
    walk(uiRoot);

    // A brand-reputation screen would be a dashboard for a number that is not a
    // decision — the surface I6 deliberately did not build.
    expect(offenders).toEqual([]);

    // And the module keeps it to ONE read: no ranked "best brands" list to
    // render off, by construction.
    const surface: Reputation = makeSetup().reputation;
    expect(Object.keys(surface).filter((k) => /brand/i.test(k))).toEqual([]);
  });
});
