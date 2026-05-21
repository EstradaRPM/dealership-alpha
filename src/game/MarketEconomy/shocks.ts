import type { EventBus } from '../EventBus';
import { createRng, deriveSeed } from '../NPC/Rng';
import {
  loadMarketShocksConfig,
  type MarketShocksConfig,
  type ShockDefinition,
} from './schemas';
import type { ShockModFn } from './segmentHeat';
import { loadTunables, type Tunables } from '../data';

/**
 * Stochastic shock scheduler (slice #159) — the third additive term of the
 * segment-heat composer locked in #182.
 *
 * Cadence: a single deterministic roll per `clock:day_started`. RNG seeds are
 * derived from `masterSeed` + the day so replaying the same seed produces the
 * same activation sequence, and two saves with different seeds diverge.
 *
 * Active shocks are kept in a Map keyed by `instanceId = ${shockId}@${startDay}`.
 * Each instance carries per-segment magnitudes (uniformly drawn from the
 * catalog band) and an `expectedEndDay` (uniform from the duration band). On
 * the day past `expectedEndDay` the shock auto-resolves and emits
 * `market:shock_resolved`. State is exposed via `snapshot/restore` so SaveStore
 * can persist the active list with the rest of the MarketEconomy snapshot.
 */
export interface ActiveShockInstance {
  readonly instanceId: string;
  readonly shockId: string;
  readonly label: string;
  readonly startDay: number;
  readonly expectedEndDay: number;
  readonly segmentMagnitudes: Readonly<Record<string, number>>;
}

export interface ShocksSnapshot {
  readonly schemaVersion: 1;
  readonly active: readonly ActiveShockInstance[];
}

export interface ShockScheduler {
  /** Run one day of scheduling: resolve expired shocks, then maybe activate one. */
  step(day: number): void;
  activeShockMod: ShockModFn;
  activeInstances(): readonly ActiveShockInstance[];
  snapshot(): ShocksSnapshot;
  restore(snap: ShocksSnapshot): void;
}

export interface ShockSchedulerDeps {
  readonly masterSeed: number;
  readonly bus?: EventBus;
  readonly catalog?: MarketShocksConfig;
  readonly tunables?: Tunables;
}

function rollOnce(seed: number): number {
  return createRng(seed)();
}

function weightedPick<T extends { rarityWeight: number }>(
  items: readonly T[],
  rng: () => number,
): T {
  let total = 0;
  for (const it of items) total += it.rarityWeight;
  let r = rng() * total;
  for (const it of items) {
    r -= it.rarityWeight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function rollMagnitudes(
  def: ShockDefinition,
  rng: () => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const eff of def.segmentEffects) {
    out[eff.segment] =
      eff.magnitudeMin + (eff.magnitudeMax - eff.magnitudeMin) * rng();
  }
  return out;
}

export function createShockScheduler(deps: ShockSchedulerDeps): ShockScheduler {
  const catalog = deps.catalog ?? loadMarketShocksConfig();
  const tunables = deps.tunables ?? loadTunables();
  const { arrivalProbPerDay, maxConcurrent } = tunables.marketEconomy.shocks;
  const active = new Map<string, ActiveShockInstance>();

  function emitStarted(inst: ActiveShockInstance, day: number): void {
    deps.bus?.publish('market:shock_started', {
      day,
      shockId: inst.shockId,
      instanceId: inst.instanceId,
      label: inst.label,
      segmentMagnitudes: inst.segmentMagnitudes,
      expectedEndDay: inst.expectedEndDay,
    });
  }

  function emitResolved(inst: ActiveShockInstance, day: number): void {
    deps.bus?.publish('market:shock_resolved', {
      day,
      shockId: inst.shockId,
      instanceId: inst.instanceId,
    });
  }

  function step(day: number): void {
    // Resolve expired first so the day's available slot count is current.
    for (const inst of [...active.values()]) {
      if (day > inst.expectedEndDay) {
        active.delete(inst.instanceId);
        emitResolved(inst, day);
      }
    }

    if (active.size >= maxConcurrent) return;

    const arrivalRoll = rollOnce(
      deriveSeed(deps.masterSeed, 'market_economy.shock.arrival', { day }),
    );
    if (arrivalRoll >= arrivalProbPerDay) return;

    const pickRng = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.shock.pick', { day }),
    );
    const def = weightedPick(catalog.shocks, pickRng);

    const paramRng = createRng(
      deriveSeed(deps.masterSeed, 'market_economy.shock.params', {
        day,
        shockId: def.id,
      }),
    );
    const durationDays =
      def.durationMinDays +
      Math.floor(
        paramRng() * (def.durationMaxDays - def.durationMinDays + 1),
      );
    const segmentMagnitudes = rollMagnitudes(def, paramRng);
    const instanceId = `${def.id}@${day}`;
    // Already running? Skip to avoid duplicate-key collisions (same shock id
    // re-rolled before its prior instance expired).
    if (active.has(instanceId)) return;

    const inst: ActiveShockInstance = {
      instanceId,
      shockId: def.id,
      label: def.label,
      startDay: day,
      expectedEndDay: day + durationDays - 1,
      segmentMagnitudes,
    };
    active.set(instanceId, inst);
    emitStarted(inst, day);
  }

  const activeShockMod: ShockModFn = (segment) => {
    let sum = 0;
    for (const inst of active.values()) {
      const m = inst.segmentMagnitudes[segment];
      if (m !== undefined) sum += m;
    }
    return sum;
  };

  return {
    step,
    activeShockMod,
    activeInstances: () => [...active.values()],
    snapshot: () => ({
      schemaVersion: 1,
      active: [...active.values()].map((i) => ({
        ...i,
        segmentMagnitudes: { ...i.segmentMagnitudes },
      })),
    }),
    restore: (snap) => {
      active.clear();
      for (const i of snap.active) {
        active.set(i.instanceId, {
          ...i,
          segmentMagnitudes: { ...i.segmentMagnitudes },
        });
      }
    },
  };
}
