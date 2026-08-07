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
import { createSegmentHeat, createSegmentHeatBySegment } from './segmentHeat';
import {
  createShockScheduler,
  type ShockScheduler,
  type ShocksSnapshot,
} from './shocks';
import {
  createDefaultHeatMonitorSnapshot,
  createSegmentHeatMonitor,
  type HeatMonitorSnapshot,
  type SegmentHeatMonitor,
} from './heatMonitor';
import {
  createDefaultNewsSnapshot,
  createMarketNews,
  type Headline,
  type MarketNews,
  type NewsSnapshot,
} from './news';
import {
  createDefaultWeeklyReportSnapshot,
  createWeeklyReport,
  type WeeklyMarketReport,
  type WeeklyReport,
  type WeeklyReportSnapshot,
} from './weeklyReport';
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
  readonly schemaVersion: 3;
  readonly compHistory: CompHistorySnapshot;
  readonly shocks: ShocksSnapshot;
  /** Per-segment last-reported heat, so a reload doesn't re-announce old moves (#176). */
  readonly heat: HeatMonitorSnapshot;
  /** The industry wire's ring buffer + un-reported comps + live shock tags (#176). */
  readonly news: NewsSnapshot;
  /** The standing weekly column + the in-progress week's accumulators (#177). */
  readonly weekly: WeeklyReportSnapshot;
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
    'activeInstances' | 'previewArrival' | 'snapshot' | 'restore'
  >;
  /**
   * Industry wire (slice #176). `getHeadlines()` is newest-first and is what
   * the Home-screen panel renders; `snapshot`/`restore` are the persistence
   * surface. Empty on the pure-engine path (no bus ⇒ no wire).
   */
  readonly news: Pick<MarketNews, 'getHeadlines' | 'snapshot' | 'restore'>;
  /**
   * Weekly market report (slice #177). `getActive()` is the standing column the
   * Home-screen card renders — null until the first one publishes. Null-active
   * on the pure-engine path (no bus ⇒ no column).
   */
  readonly weeklyReport: Pick<WeeklyReport, 'getActive' | 'snapshot' | 'restore'>;
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

  const heatDeps = {
    personality,
    compHistory,
    getCurrentDay,
    activeShockMod: shockScheduler?.activeShockMod,
  };
  const segmentHeatFn = createSegmentHeat(heatDeps);
  const segmentHeatBySegment = createSegmentHeatBySegment(heatDeps);

  // The canonical vehicle-type axis (#278) — the same keys DemandShaper and the
  // heat composer read, so the wire never talks about a segment the rest of the
  // game doesn't have.
  const newsSegments = (deps.tunables ?? loadTunables()).demandShaper.segments;

  // Heat monitor + news wire ride the same bus-and-seed precondition as the
  // shock scheduler: the pure-engine path (calibration test, fixtures) has no
  // day cadence to hang them off and no seed to make them deterministic.
  const heatMonitor: SegmentHeatMonitor | null = deps.bus
    ? createSegmentHeatMonitor({
        bus: deps.bus,
        segments: newsSegments,
        heatFor: segmentHeatBySegment,
        tunables: deps.tunables,
      })
    : null;

  const news: MarketNews | null =
    deps.bus && deps.masterSeed !== undefined
      ? createMarketNews({
          masterSeed: deps.masterSeed,
          bus: deps.bus,
          segments: newsSegments,
          previewShock: shockScheduler
            ? (day) => shockScheduler.previewArrival(day)
            : undefined,
          tunables: deps.tunables,
        })
      : null;

  // The column rides the same bus-and-seed precondition as the wire it sums up.
  const weeklyReport: WeeklyReport | null =
    deps.bus && deps.masterSeed !== undefined
      ? createWeeklyReport({
          masterSeed: deps.masterSeed,
          bus: deps.bus,
          segments: newsSegments,
          heatFor: segmentHeatBySegment,
          previewShock: shockScheduler
            ? (day) => shockScheduler.previewArrival(day)
            : undefined,
          tunables: deps.tunables,
        })
      : null;

  const providers = createProviders({
    ...deps,
    personality,
    markupConfig: markup,
    brandTiers,
    segmentHeatFn,
  });

  // Wholesale/retail comps both reduce to `(price / reference) - 1`. The
  // reference is the level that lane is EXPECTED to transact at — `anchor ×
  // wholesaleBaseline` for wholesale and `anchor × markup` for retail — so a
  // comp only moves the window when the lane prints away from its own norm,
  // and the two sources stay commensurable in the same window.
  const wholesaleBaseline = (deps.tunables ?? loadTunables()).marketEconomy
    .motivatedSeller.meanMultiplier;

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
      // A wholesale comp is measured against the WHOLESALE baseline, exactly as
      // the retail comp below is measured against anchor × markup (#286). The
      // auction lane transacts around `motivatedSeller.meanMultiplier` of the
      // anchor by construction, so comparing a buy to the bare anchor reports
      // "the wholesale market is below retail book" — a tautology, not news,
      // and one that drifts the whole segment down a little on every purchase.
      // It was invisible while the lane centered at 1.0 and would have made
      // every unit the player bought well quietly devalue their own inventory.
      const reference = anchor * wholesaleBaseline;
      if (reference <= 0) return;
      const delta = e.cost / reference - 1;
      compHistory.recordWholesale({ segment: e.category, delta, day: e.day });
      // The wire's block report reuses the delta computed here rather than
      // subscribing to inventory itself — re-deriving it would duplicate the
      // anchor math and drag the anchor config into the news engine (#176).
      news?.recordComp({ segment: e.category, delta });
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
      const delta = e.salePrice / reference - 1;
      compHistory.recordRetail({ segment: e.category, delta, day: e.day });
      news?.recordComp({ segment: e.category, delta });
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

    if (shockScheduler || heatMonitor || news || weeklyReport) {
      // ONE day tick with an explicit internal order, rather than three
      // independent subscriptions: shocks must land (and emit) before the heat
      // monitor reads the composite they modulate, and both must have spoken
      // before the wire's day step spends the remaining headline budget on the
      // block report + the analyst desk's forward call. Ordering this here
      // makes the sequence a property of the module, not of bus registration
      // order.
      const onDayStarted = (e: { day: number }): void => {
        shockScheduler?.step(e.day);
        heatMonitor?.step(e.day);
        news?.step(e.day);
        // Last: the column sums up a week of wire, so the wire speaks first.
        weeklyReport?.step(e.day);
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
      schemaVersion: 3,
      compHistory: compHistory.snapshot(),
      shocks: shockScheduler?.snapshot() ?? { schemaVersion: 1, active: [] },
      heat: heatMonitor?.snapshot() ?? createDefaultHeatMonitorSnapshot(),
      news: news?.snapshot() ?? createDefaultNewsSnapshot(),
      weekly: weeklyReport?.snapshot() ?? createDefaultWeeklyReportSnapshot(),
    }),
    restore: (snap: MarketEconomySnapshot) => {
      compHistory.restore(snap.compHistory);
      shockScheduler?.restore(snap.shocks);
      heatMonitor?.restore(snap.heat);
      news?.restore(snap.news);
      weeklyReport?.restore(snap.weekly);
    },
    compHistory: {
      segmentDrift: (segment, day) => compHistory.segmentDrift(segment, day),
      liveCount: (segment, day) => compHistory.liveCount(segment, day),
      snapshot: (): CompHistorySnapshot => compHistory.snapshot(),
      restore: (snap: CompHistorySnapshot) => compHistory.restore(snap),
    },
    shocks: {
      activeInstances: () => shockScheduler?.activeInstances() ?? [],
      previewArrival: (day: number) => shockScheduler?.previewArrival(day) ?? null,
      snapshot: (): ShocksSnapshot =>
        shockScheduler?.snapshot() ?? { schemaVersion: 1, active: [] },
      restore: (snap: ShocksSnapshot) => shockScheduler?.restore(snap),
    },
    news: {
      getHeadlines: (): readonly Headline[] => news?.getHeadlines() ?? [],
      snapshot: (): NewsSnapshot => news?.snapshot() ?? createDefaultNewsSnapshot(),
      restore: (snap: NewsSnapshot) => news?.restore(snap),
    },
    weeklyReport: {
      getActive: (): WeeklyMarketReport | null => weeklyReport?.getActive() ?? null,
      snapshot: (): WeeklyReportSnapshot =>
        weeklyReport?.snapshot() ?? createDefaultWeeklyReportSnapshot(),
      restore: (snap: WeeklyReportSnapshot) => weeklyReport?.restore(snap),
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      news?.dispose();
      weeklyReport?.dispose();
      for (const u of unsubscribers) u();
      unsubscribers.length = 0;
    },
  };
}
