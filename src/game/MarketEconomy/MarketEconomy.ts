import type { EventBus } from '../EventBus';
import { computeAnchor, type AnchorVehicleInput } from './anchor';
import {
  createCompHistory,
  type CompHistory,
  type CompHistoryDeps,
  type CompHistorySnapshot,
} from './compHistory';
import {
  createProviders,
  type LiveProviders,
  type ProvidersDeps,
} from './providers';
import {
  NEUTRAL_PERSONALITY,
  rollPersonalityVector,
  type MarketPersonalityVector,
} from './personality';
import { createSegmentHeat } from './segmentHeat';
import { loadMarketMarkupConfig, type MarketMarkupConfig } from './schemas';
import { loadBrandTiersConfig, type BrandTiersConfig } from '../SalesProcess';

/**
 * MarketEconomy — slice #155/#156/#157 surface. Owns the per-save personality
 * vector, the comp-history rolling window, and the three live providers wired
 * against the segmentHeat composer (`personality + drift + shock-placeholder`).
 *
 * The composition root injects the event bus + a `getCurrentDay` callback;
 * MarketEconomy subscribes to `inventory:vehicle_purchased` (wholesale comps)
 * and `inventory:vehicle_sold` (retail comps), recording each transaction's
 * delta vs. the engine's anchor. With no bus, the engine is a pure
 * personality-only world (the path used by the #94 calibration test and by
 * tests that don't care about emergent drift).
 */
export interface MarketEconomy extends LiveProviders {
  readonly personality: MarketPersonalityVector;
  /** Read-only view of the live comp window (snapshot/restore for persistence). */
  readonly compHistory: Pick<
    CompHistory,
    'segmentDrift' | 'liveCount' | 'snapshot' | 'restore'
  >;
  /** Tear down event subscriptions. Idempotent. */
  dispose(): void;
}

export interface MarketEconomyDeps extends ProvidersDeps, CompHistoryDeps {
  readonly masterSeed?: number;
  /**
   * Event bus to subscribe to inventory transactions. Omit for pure-engine
   * usage (calibration tests, fixtures); the providers still work, the
   * compHistory just never receives comps.
   */
  readonly bus?: EventBus;
  /**
   * Reads the live day for the comp age-cutoff math + the segmentHeat
   * composer. Required when `bus` is provided. Implementations typically
   * delegate to `GameClock.currentDay`.
   */
  readonly getCurrentDay?: () => number;
}

export function createMarketEconomy(deps: MarketEconomyDeps = {}): MarketEconomy {
  const personality =
    deps.personality ??
    (deps.masterSeed !== undefined
      ? rollPersonalityVector(deps.masterSeed)
      : NEUTRAL_PERSONALITY);

  const markup: MarketMarkupConfig = deps.markupConfig ?? loadMarketMarkupConfig();
  const brandTiers: BrandTiersConfig = deps.brandTiers ?? loadBrandTiersConfig();
  const anchorDeps = { ...deps, brandTiers };

  const compHistory = createCompHistory(deps);
  const getCurrentDay = deps.getCurrentDay ?? (() => 1);
  const segmentHeatFn = createSegmentHeat({
    personality,
    compHistory,
    getCurrentDay,
  });

  const providers = createProviders({
    ...deps,
    personality,
    markupConfig: markup,
    brandTiers,
    segmentHeatFn,
  });

  // Wholesale/retail comps both reduce to `(price / reference) - 1`. The
  // reference is the engine's own anchor for wholesale and `anchor × markup`
  // for retail — keeping the two sources commensurable in the same window.
  function markupFor(v: AnchorVehicleInput): number {
    const tier = brandTiers.makes[v.make] ?? 'mainstream';
    const segmentTable = markup.markups[v.category];
    const m = segmentTable
      ? (segmentTable as Record<string, number | undefined>)[tier]
      : undefined;
    // If markup is missing the comp simply doesn't record — defensive: a
    // missing markup is a data-config bug, not a runtime crash here.
    return m ?? 1;
  }

  const unsubscribers: Array<() => void> = [];
  if (deps.bus) {
    const bus = deps.bus;

    const onPurchased = (e: {
      day: number;
      cost: number;
      templateId: string;
      make: string;
      year: number;
      mileage: number;
      condition: 'clean' | 'average' | 'rough';
      category: string;
    }): void => {
      const anchor = computeAnchor(e, anchorDeps);
      if (anchor <= 0) return;
      compHistory.recordWholesale({
        segment: e.category,
        delta: e.cost / anchor - 1,
        day: e.day,
      });
    };

    const onSold = (e: {
      day: number;
      salePrice: number;
      templateId: string;
      make: string;
      year: number;
      mileage: number;
      condition: 'clean' | 'average' | 'rough';
      category: string;
    }): void => {
      const anchor = computeAnchor(e, anchorDeps);
      const reference = anchor * markupFor(e);
      if (reference <= 0) return;
      compHistory.recordRetail({
        segment: e.category,
        delta: e.salePrice / reference - 1,
        day: e.day,
      });
    };

    bus.subscribe('inventory:vehicle_purchased', onPurchased);
    bus.subscribe('inventory:vehicle_sold', onSold);
    unsubscribers.push(() => bus.unsubscribe('inventory:vehicle_purchased', onPurchased));
    unsubscribers.push(() => bus.unsubscribe('inventory:vehicle_sold', onSold));
  }

  let disposed = false;
  return {
    ...providers,
    personality,
    compHistory: {
      segmentDrift: (segment, day) => compHistory.segmentDrift(segment, day),
      liveCount: (segment, day) => compHistory.liveCount(segment, day),
      snapshot: (): CompHistorySnapshot => compHistory.snapshot(),
      restore: (snap: CompHistorySnapshot) => compHistory.restore(snap),
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const u of unsubscribers) u();
      unsubscribers.length = 0;
    },
  };
}
