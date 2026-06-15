import type { EventBus } from '../EventBus';
import { computeAnchor, type AnchorVehicleInput } from './anchor';
import {
  predictDaysToSell,
  type DaysToSellPrediction,
} from './daysToSell';
import { demandMultiplier } from './elasticity';
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
import {
  createShockScheduler,
  type ShockScheduler,
  type ShocksSnapshot,
} from './shocks';
import {
  loadAuctionSourcesConfig,
  loadDaysToSellCurvesConfig,
  loadDemandElasticityConfig,
  loadMarketMarkupConfig,
  type AuctionSourcesConfig,
  type DaysToSellCurvesConfig,
  type DemandElasticityConfig,
  type MarketMarkupConfig,
} from './schemas';
import { loadBrandTiersConfig, type BrandTiersConfig } from '../SalesProcess';
import { loadTunables, type Tunables } from '../data';

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
/**
 * Persisted MarketEconomy state (#191, parent #186). The two emergent, live
 * accumulators — the comp-history rolling window (#157) and the active-shock
 * list (#159). The per-save `personality` vector is seed-derived
 * (`rollPersonalityVector(masterSeed)`), so a same-seed restore reproduces it
 * for free and it is deliberately *not* persisted. Bundles each sub-module's
 * own self-versioned blob so MarketEconomy owns one cohesive snapshot the
 * world seam wires with a single `modules` key.
 */
export interface MarketEconomySnapshot {
  readonly schemaVersion: 1;
  readonly compHistory: CompHistorySnapshot;
  readonly shocks: ShocksSnapshot;
}

export interface MarketEconomy extends LiveProviders {
  readonly personality: MarketPersonalityVector;
  /** Read-only view of the live comp window (snapshot/restore for persistence). */
  readonly compHistory: Pick<
    CompHistory,
    'segmentDrift' | 'liveCount' | 'snapshot' | 'restore'
  >;
  /**
   * Shock scheduler view (slice #159). `activeInstances` is read-only for
   * KPI/news consumers; `snapshot`/`restore` are the SaveStore persistence
   * surface. The scheduler ticks internally on `clock:day_started` when a
   * `bus` + `masterSeed` are wired; the pure-engine path (no bus) leaves the
   * active list empty and `activeShockMod` returns 0.
   */
  readonly shocks: Pick<
    ShockScheduler,
    'activeInstances' | 'snapshot' | 'restore'
  >;
  /**
   * Player-visible valuation for a vehicle described only by its anchor
   * fields (no purchasePrice/reconCost). Used by surfaces that quote a
   * retail range estimate for listings the dealer doesn't own yet — the
   * auction board per #161. Equivalent to running the live providers on a
   * `MarketVehicleInput` with placeholder cost fields, but typed against the
   * narrow anchor input so callers don't fabricate fake cost data.
   */
  valuationFor(vehicle: AnchorVehicleInput): { bookValue: number; marketPrice: number };
  /**
   * Days-to-sell prediction (slice #174). Estimates how long `vehicle` takes to
   * sell at `askingPrice` given its market position + current segment heat +
   * (optional) days already on the lot. Resolves marketPrice + heat + live comp
   * count from current state, then delegates to the pure `predictDaysToSell`
   * engine. Deterministic — no RNG. Used by the real-time pricing screen (#175).
   */
  predictDaysToSell(
    vehicle: AnchorVehicleInput & { daysOnLot?: number },
    askingPrice: number,
  ): DaysToSellPrediction;
  /**
   * Relative demand multiplier for `vehicle` at `askingPrice` (slice #279,
   * Pricing/Demand spine S7). Resolves the competitor benchmark + segment heat
   * from live state and delegates to the ONE shared `demandMultiplier`
   * elasticity model — the *same* read that backs `predictDaysToSell`. Exposed
   * so FloorSim's arrival seam draws traffic from that one model (Pillar 3,
   * "one model, two consumers"): `1` = at-benchmark neutral-heat baseline, `<1`
   * over-priced/cold (slower traffic), `>1` under-priced/hot (faster). Pure,
   * deterministic — no RNG. The composition root injects it as the
   * per-vehicle `vehicleResponse` of `computePricingTrafficMultiplier`.
   */
  demandMultiplierFor(vehicle: AnchorVehicleInput, askingPrice: number): number;
  /**
   * Source catalog label lookup. Returns the human label for a known source
   * id, or the id itself if absent (defensive — a missing source is a data
   * mismatch, not a runtime crash).
   */
  sourceLabelFor(sourceId: string): string;
  /**
   * Persistence surface (#191). Bundles the comp-history + shock snapshots
   * into one self-versioned blob; personality is seed-derived and omitted.
   */
  snapshot(): MarketEconomySnapshot;
  restore(snap: MarketEconomySnapshot): void;
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
  /**
   * Override for the tunables-loaded `marketEconomy.competitorInfluence` and
   * `competitorMarket.pricingChangeThreshold` constants. Tests pass an
   * explicit tunables shape; production code resolves from `loadTunables()`.
   */
  readonly tunables?: Tunables;
}

export function createMarketEconomy(deps: MarketEconomyDeps = {}): MarketEconomy {
  const personality =
    deps.personality ??
    (deps.masterSeed !== undefined
      ? rollPersonalityVector(deps.masterSeed)
      : NEUTRAL_PERSONALITY);

  const markup: MarketMarkupConfig = deps.markupConfig ?? loadMarketMarkupConfig();
  const brandTiers: BrandTiersConfig = deps.brandTiers ?? loadBrandTiersConfig();
  const auctionSources: AuctionSourcesConfig = loadAuctionSourcesConfig();
  const daysToSellConfig: DaysToSellCurvesConfig = loadDaysToSellCurvesConfig();
  const elasticityConfig: DemandElasticityConfig = loadDemandElasticityConfig();
  const sourceLabels: Readonly<Record<string, string>> = (() => {
    const m: Record<string, string> = {};
    for (const s of auctionSources.sources) m[s.id] = s.label;
    return m;
  })();
  const anchorDeps = { ...deps, brandTiers };

  const compHistory = createCompHistory(deps);
  const getCurrentDay = deps.getCurrentDay ?? (() => 1);

  // Shock scheduler is wired only when masterSeed + bus are present — the
  // pure-engine path used by the #94 calibration test stays at neutral
  // (activeShockMod always 0). Even with masterSeed alone, no scheduler is
  // built: the activation cadence is event-driven (clock:day_started).
  const shockScheduler: ShockScheduler | null =
    deps.bus && deps.masterSeed !== undefined
      ? createShockScheduler({
          masterSeed: deps.masterSeed,
          bus: deps.bus,
          tunables: deps.tunables,
        })
      : null;

  const segmentHeatFn = createSegmentHeat({
    personality,
    compHistory,
    getCurrentDay,
    activeShockMod: shockScheduler?.activeShockMod,
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
    const tier = brandTiers.brands[v.brand] ?? 'mainstream';
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
      brand: string;
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
      brand: string;
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

    // Synthetic competitor comps (slice #158). Each `competitor:price_changed`
    // event fans out as one comp entry per segment with non-zero brand
    // affinity. Delta scales by `competitorInfluence` (so realized retail
    // remains the dominant signal); weight scales by affinity (so a luxury
    // brand's price move barely moves the truck segment).
    const tunables = deps.tunables ?? loadTunables();
    const competitorInfluence = tunables.marketEconomy.competitorInfluence;

    const onCompetitorPriceChanged = (e: {
      day: number;
      oldPricing: number;
      newPricing: number;
      segmentAffinity: Readonly<Record<string, number>>;
    }): void => {
      const delta = (e.newPricing - e.oldPricing) * competitorInfluence;
      for (const [segment, affinity] of Object.entries(e.segmentAffinity)) {
        if (affinity <= 0) continue;
        compHistory.recordCompetitor({
          segment,
          delta,
          day: e.day,
          weightScale: affinity,
        });
      }
    };

    bus.subscribe('competitor:price_changed', onCompetitorPriceChanged);
    unsubscribers.push(() =>
      bus.unsubscribe('competitor:price_changed', onCompetitorPriceChanged),
    );

    if (shockScheduler) {
      const onDayStarted = (e: { day: number }): void => {
        shockScheduler.step(e.day);
      };
      bus.subscribe('clock:day_started', onDayStarted);
      unsubscribers.push(() => bus.unsubscribe('clock:day_started', onDayStarted));
    }
  }

  let disposed = false;
  return {
    ...providers,
    personality,
    valuationFor(vehicle: AnchorVehicleInput) {
      const anchor = computeAnchor(vehicle, anchorDeps);
      const book = anchor * (1 + segmentHeatFn(vehicle));
      const market = Math.round(book * markupFor(vehicle));
      return { bookValue: book, marketPrice: market };
    },
    predictDaysToSell(vehicle, askingPrice) {
      const anchor = computeAnchor(vehicle, anchorDeps);
      const heat = segmentHeatFn(vehicle);
      const marketPrice = Math.round(anchor * (1 + heat) * markupFor(vehicle));
      return predictDaysToSell(
        {
          marketPrice,
          askingPrice,
          segment: vehicle.category,
          segmentHeat: heat,
          daysOnLot: vehicle.daysOnLot,
          compObservations: compHistory.liveCount(vehicle.category, getCurrentDay()),
        },
        { config: daysToSellConfig, elasticity: elasticityConfig },
      );
    },
    demandMultiplierFor(vehicle, askingPrice) {
      const anchor = computeAnchor(vehicle, anchorDeps);
      const heat = segmentHeatFn(vehicle);
      // Same heat-inclusive competitor benchmark predictDaysToSell resolves —
      // so the screen's days-to-sell and the floor's arrivals read one curve.
      const marketPrice = Math.round(anchor * (1 + heat) * markupFor(vehicle));
      return demandMultiplier(
        { benchmarkPrice: marketPrice, askingPrice, segmentHeat: heat },
        { config: elasticityConfig },
      ).demandMultiplier;
    },
    sourceLabelFor(sourceId: string) {
      return sourceLabels[sourceId] ?? sourceId;
    },
    snapshot: (): MarketEconomySnapshot => ({
      schemaVersion: 1,
      compHistory: compHistory.snapshot(),
      shocks: shockScheduler?.snapshot() ?? { schemaVersion: 1, active: [] },
    }),
    restore: (snap: MarketEconomySnapshot) => {
      compHistory.restore(snap.compHistory);
      shockScheduler?.restore(snap.shocks);
    },
    compHistory: {
      segmentDrift: (segment, day) => compHistory.segmentDrift(segment, day),
      liveCount: (segment, day) => compHistory.liveCount(segment, day),
      snapshot: (): CompHistorySnapshot => compHistory.snapshot(),
      restore: (snap: CompHistorySnapshot) => compHistory.restore(snap),
    },
    shocks: {
      activeInstances: () => shockScheduler?.activeInstances() ?? [],
      snapshot: (): ShocksSnapshot =>
        shockScheduler?.snapshot() ?? { schemaVersion: 1, active: [] },
      restore: (snap: ShocksSnapshot) => shockScheduler?.restore(snap),
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const u of unsubscribers) u();
      unsubscribers.length = 0;
    },
  };
}
