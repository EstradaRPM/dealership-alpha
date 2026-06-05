import type { EventBus } from '../EventBus';
import { loadTunables, type Tunables } from '../data';
import type { Competitor, CompetitorCatalog } from './Competitor';
import type { PersonalityDriftCatalog } from './PersonalityDrift';
import type { BrandCatalog } from './schemas/brand';

/**
 * Persisted drift state (#191, parent #186). The live competitor stats *and*
 * the drift RNG cursor — the two things that have moved away from the cold
 * `loadCompetitors()` baseline since Day 1. Personality/clamp bounds are
 * static catalog data, so restoring the drift fields onto a fresh same-seed
 * module reproduces the exact state; persisting `rngState` keeps *future*
 * drift on the same deterministic trajectory the original world was on.
 *
 * NOTE: the earlier #183 claim that drift is reconstructable from seed + day
 * count held only while no save/load existed — the #188 world seam restores
 * onto a fresh World and never replays `clock:day_ended`, so the drift is
 * persisted, not recomputed.
 */
export interface CompetitorMarketSnapshot {
  readonly schemaVersion: 1;
  readonly competitors: readonly Competitor[];
  readonly rngState: number;
}

export interface CompetitorMarket {
  getCompetitors(): ReadonlyArray<Competitor>;
  getCompetitor(id: string): Competitor | undefined;
  snapshot(): CompetitorMarketSnapshot;
  restore(snap: CompetitorMarketSnapshot): void;
  dispose: () => void;
}

interface StatefulRng {
  next(): number;
  getState(): number;
  setState(state: number): void;
}

function makeRng(seed: number): StatefulRng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState: () => a,
    setState: (state) => {
      a = state >>> 0;
    },
  };
}

function cloneCompetitor(c: Competitor): Competitor {
  return {
    ...c,
    clamp: {
      rep: { ...c.clamp.rep },
      inventory: { ...c.clamp.inventory },
      pricing: { ...c.clamp.pricing },
    },
  };
}

function clampStat(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Wires CompetitorMarket into the EventBus.
 *
 * Publishes `market:competitive_pressure` each `clock:day_started` with the
 * current (post-drift) competitor stats.
 *
 * Weekly drift: on `clock:day_ended` when day % 7 === 0, each competitor's
 * rep/inventory/pricing are nudged by uniform noise scaled by their
 * personality's sigma, then clamped to the per-stat lo/hi bounds from the
 * data file.
 */
export function createCompetitorMarket(deps: {
  bus: EventBus;
  competitors: CompetitorCatalog;
  personalityDrift: PersonalityDriftCatalog;
  seed: number;
  /**
   * Optional brand catalog. When provided, the weekly drift emits
   * `competitor:price_changed` (slice #158) on meaningful pricing moves,
   * carrying the brand's segment_affinity so MarketEconomy can fan the move
   * out as synthetic comps without dereferencing brand data. Omit in tests
   * that don't care about the event.
   */
  brands?: BrandCatalog;
  tunables?: Tunables;
}): CompetitorMarket {
  const { bus, personalityDrift, seed, brands } = deps;
  const rng = makeRng(seed >>> 0);
  const tunables = deps.tunables ?? loadTunables();
  const pricingChangeThreshold = tunables.competitorMarket.pricingChangeThreshold;

  // Mutable live state — starts at loaded base values
  const live: Competitor[] = deps.competitors.map((c) => ({ ...c }));
  const byId = new Map<string, Competitor>(live.map((c) => [c.id, c]));

  const onDayEnded = (payload: { day: number }): void => {
    if (payload.day % 7 !== 0) return;
    for (const c of live) {
      const sigma = personalityDrift[c.personality];
      if (!sigma) continue;
      c.rep      = clampStat(c.rep      + (rng.next() * 2 - 1) * sigma.rep,      c.clamp.rep.lo,      c.clamp.rep.hi);
      c.inventory = clampStat(c.inventory + (rng.next() * 2 - 1) * sigma.inventory, c.clamp.inventory.lo, c.clamp.inventory.hi);
      const oldPricing = c.pricing;
      const newPricing = clampStat(
        c.pricing + (rng.next() * 2 - 1) * sigma.pricing,
        c.clamp.pricing.lo,
        c.clamp.pricing.hi,
      );
      c.pricing = newPricing;

      if (brands && Math.abs(newPricing - oldPricing) >= pricingChangeThreshold) {
        const brandEntry = brands[c.brand];
        if (brandEntry) {
          bus.publish('competitor:price_changed', {
            day: payload.day,
            competitorId: c.id,
            brand: c.brand,
            oldPricing,
            newPricing,
            segmentAffinity: brandEntry.segment_affinity,
          });
        }
      }
    }
  };

  const onDayStarted = (payload: { day: number }): void => {
    bus.publish('market:competitive_pressure', { day: payload.day, competitors: live });
  };

  bus.subscribe('clock:day_ended', onDayEnded);
  bus.subscribe('clock:day_started', onDayStarted);

  return {
    getCompetitors: () => live,
    getCompetitor: (id) => byId.get(id),
    snapshot: () => ({
      schemaVersion: 1,
      competitors: live.map(cloneCompetitor),
      rngState: rng.getState(),
    }),
    restore: (snap) => {
      // Overwrite stats in place so the `live` array + `byId` references the
      // pressure publisher and getCompetitors() hand out stay stable.
      for (const saved of snap.competitors) {
        const target = byId.get(saved.id);
        if (target) Object.assign(target, cloneCompetitor(saved));
      }
      rng.setState(snap.rngState);
    },
    dispose: () => {
      bus.unsubscribe('clock:day_ended', onDayEnded);
      bus.unsubscribe('clock:day_started', onDayStarted);
    },
  };
}
