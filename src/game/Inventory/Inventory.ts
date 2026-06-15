import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import {
  rollRecon,
  pickSurpriseTemplate,
  deriveReconSeed,
  deriveReconSurpriseSeed,
  loadReconVarianceConfig,
  loadReconSurpriseEventsConfig,
  rollAuctionSourceReliability,
  loadAuctionSourcesConfig,
  type ReconVarianceConfig,
  type ReconSurpriseEventsConfig,
  type AuctionSourceReliability,
} from '../MarketEconomy';
import { generateAuctionListings } from './auctionGenerator';
import { loadVehicleData } from './vehicleData';
import { loadInventoryConfig, type InventoryConfig } from './inventoryConfig';
import { computeDailyCarryingCost, floorplanAprForTier } from './carryingCost';
import type { VehicleData } from './vehicleData';
import type { AuctionListing, LotVehicle, TradeAcquisitionInput } from './types';

/**
 * Persistence surface for Inventory (#189, parent #186). Module-owned
 * `schemaVersion`, same convention as GameClock/Economy. Captures the full
 * mutable lot state so a load restores the exact lot the player left — lot
 * vehicles (with their aging clocks + accrued carrying cost), the live auction
 * board, and any held inspection listings — rather than recomputing from
 * scratch. The hidden per-save auction-source reliability is NOT persisted: it
 * is rolled deterministically from `masterSeed`, so the seed + catalog stay the
 * canonical artifact (same pattern as the #156 personality vector). Maps are
 * flattened to arrays for JSON; `LotVehicle`/`AuctionListing` are plain data.
 */
export interface InventorySnapshot {
  readonly schemaVersion: 1;
  readonly currentDay: number;
  readonly lastPreparedDay: number;
  readonly auctionListings: readonly AuctionListing[];
  readonly pendingInspections: readonly AuctionListing[];
  readonly lotVehicles: readonly LotVehicle[];
}

export interface Inventory {
  getAuctionListings(): readonly AuctionListing[];
  getLotVehicles(): readonly LotVehicle[];
  getLotVehicle(vehicleId: string): LotVehicle | undefined;
  buyFromAuction(listingId: string): void;
  /**
   * Materialize a customer's accepted trade-in as a new lot vehicle (#171).
   * Driven by `trade:resolved` (subscribed internally); exposed for direct /
   * test use. The `agreedAllowance` is the cost basis — a *non-cash*
   * acquisition (offset against deal cash in the close structure, NOT posted as
   * an Economy expense). Recon-variance machinery applies exactly as for an
   * auction buy, with the staff condition-read confidence standing in for
   * source reliability, so a trade can hide a lemon. Emits
   * `inventory:vehicle_acquired_via_trade`; the unit is on the lot immediately.
   */
  acquireFromTrade(acquisition: TradeAcquisitionInput): LotVehicle;
  /**
   * Remove a lot vehicle and publish `inventory:vehicle_sold`. `salePrice` is
   * the realized retail price (DealEngine passes `agreedPrice`). Tests calling
   * `sellVehicle` without DealEngine in the loop can omit it — it defaults to
   * the vehicle's `askingPrice` so the comp record stays meaningful.
   */
  sellVehicle(vehicleId: string, salePrice?: number): LotVehicle;
  /**
   * Player-set asking price for a lot vehicle (MANAGERIAL Pricing lever,
   * #120). Negative inputs are clamped to 0; an unknown vehicleId is a no-op
   * (the lever only ever passes ids it just read from `getLotVehicles`).
   */
  setAskingPrice(vehicleId: string, askingPrice: number): void;
  /**
   * Player authorizes continued recon spend after a mid-recon surprise
   * (#162). Resumes the daily spend cadence; remaining shortfall amortizes
   * across `reconDaysRemaining`. No-op if vehicle isn't paused for a decision.
   */
  authorizeReconSpend(vehicleId: string): void;
  /**
   * Player abandons recon after a surprise (#162). Wholesales the unit at
   * `bookValue − reconSpentToDate` (per #162 AC); the spread vs. cost basis
   * posts as a loss via Economy. No-op if vehicle isn't paused for a decision.
   */
  abandonRecon(vehicleId: string): void;
  /**
   * Player pays for a pre-purchase inspection on an auction listing (#164).
   * Posts the inspection cost via Economy and blocks purchase of the listing
   * until `inspectionAvailableDay` (currentDay + daysToComplete). The listing
   * is held across the day rollover (pulled out of the daily regenerated board)
   * so the result can be presented and the unit can be bought on the next
   * morning. Idempotent for status !== 'none'; throws if the listing id is
   * unknown.
   */
  requestInspection(listingId: string): void;
  /** #189 SaveStore seam: capture/rehydrate the full lot + auction-board state. */
  snapshot(): InventorySnapshot;
  restore(snap: InventorySnapshot): void;
}

export interface InventoryDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Pick<Economy, 'cash' | 'postExpense' | 'postRevenue' | 'forceDebit'>;
  /**
   * Live dealership tier provider (#173). Drives the floorplan APR used in the
   * daily carrying-cost accrual — better tiers borrow more cheaply. Omit to
   * default to tier 1 (the baseline APR).
   */
  getTier?: () => number;
  vehicleData?: VehicleData;
  /**
   * Live book-value provider used by the recon-abandon path (#162). Receives
   * the in-progress lot vehicle and returns its current honest book. Omit
   * to fall back to `purchasePrice + reconSpentToDate` (the static stub
   * mirror — same shape as the SalesProcess seam default).
   */
  bookValueFn?: (v: LotVehicle) => number;
  /**
   * Live market-price provider (#273). Sets a freshly-acquired unit's
   * `suggestedRetail` (and thus its default `askingPrice`) to the market
   * suggestion rather than the cost-basis placeholder. Omit to fall back to
   * `purchasePrice + reconEstimate` (the v1 stub) — test harnesses that don't
   * wire MarketEconomy keep the cost-basis default. Receives the built
   * `LotVehicle`, which carries every anchor field the provider reads.
   */
  marketPriceFn?: (v: LotVehicle) => number;
  /**
   * Standing auto-pricing policy (#285, Pricing/Demand spine S13). Returns the
   * default `askingPrice` a freshly-acquired unit is stamped with — the close's
   * transaction anchor. The composition root encapsulates the strategy posture
   * AND the automation gate (a UCM on staff): unlocked ⇒ the strategy's
   * book↔market target; locked ⇒ the honest market suggestion. Omit (test
   * harnesses) to fall back to `suggestedRetail` — the pre-S13 behavior where
   * the default ask sits at market.
   */
  pricingPolicyFn?: (v: LotVehicle) => number;
  reconVariance?: ReconVarianceConfig;
  reconSurprises?: ReconSurpriseEventsConfig;
  auctionSourceReliability?: AuctionSourceReliability;
  inventoryConfig?: InventoryConfig;
}

export function createInventory(deps: InventoryDeps): Inventory {
  const { bus, masterSeed, economy } = deps;
  const vehicleData = deps.vehicleData ?? loadVehicleData();
  const reconVariance = deps.reconVariance ?? loadReconVarianceConfig();
  const reconSurprises = deps.reconSurprises ?? loadReconSurpriseEventsConfig();
  const sourceReliability =
    deps.auctionSourceReliability ??
    rollAuctionSourceReliability(masterSeed, loadAuctionSourcesConfig());
  const inventoryConfig = deps.inventoryConfig ?? loadInventoryConfig();
  const getTier = deps.getTier ?? (() => 1);
  const bookValueFn =
    deps.bookValueFn ?? ((v: LotVehicle) => v.purchasePrice + v.reconCost);
  const marketPriceFn = deps.marketPriceFn;
  const pricingPolicyFn = deps.pricingPolicyFn;

  let currentDay = 1;
  let auctionListings: AuctionListing[] = [];
  // Listings the player has paid to inspect (#164). Pulled out of the daily
  // regenerated board on `requestInspection` so they survive the rollover; the
  // pending result resolves the morning of `inspectionAvailableDay`. Re-merged
  // into `getAuctionListings()` so the UI sees one combined board.
  const pendingInspections = new Map<string, AuctionListing>();
  const lotVehicles = new Map<string, LotVehicle>();
  let lastPreparedDay = 0;

  function prepareDay(day: number): void {
    if (day === lastPreparedDay) return;
    lastPreparedDay = day;
    currentDay = day;
    auctionListings = generateAuctionListings(day, masterSeed, vehicleData);
    advanceInspections(day);
    accrueDay(day);
  }

  /**
   * Daily lot pass (#173): age each unit, advance its recon, then accrue one
   * day of floorplan + carrying cost. The per-vehicle burn is summed and posted
   * as a single aggregate Economy expense, and `economy:carrying_cost_posted`
   * fires for KPI/UI consumption. `forceDebit` (not `postExpense`) because
   * carrying cost is a non-discretionary accrual that legitimately pushes cash
   * negative — that descent is exactly what BankruptcyMonitor watches for.
   * Driven through `prepareDay`'s once-per-day guard, so it is idempotent.
   */
  function accrueDay(day: number): void {
    const carrying = inventoryConfig.carrying;
    const apr = floorplanAprForTier(carrying, getTier());
    let totalCarry = 0;
    let unitCount = 0;
    for (const [id, v] of lotVehicles) {
      const daysInInventory = day - v.arrivalDay;
      const advanced = advanceRecon({ ...v, daysInInventory }, day);
      const dailyCarry = computeDailyCarryingCost({
        bookValue: bookValueFn(advanced),
        apr,
        reconComplete: advanced.reconStatus === 'complete',
        config: carrying,
      });
      lotVehicles.set(id, {
        ...advanced,
        carryingCostToDate: advanced.carryingCostToDate + dailyCarry,
        dailyCarryingCost: dailyCarry,
        aged: daysInInventory > carrying.agedThresholdDays,
      });
      totalCarry += dailyCarry;
      unitCount += 1;
    }
    if (totalCarry > 0) {
      economy.forceDebit(
        totalCarry,
        `Floorplan & carrying cost (Day ${day}, ${unitCount} unit${unitCount === 1 ? '' : 's'})`,
      );
    }
    bus.publish('economy:carrying_cost_posted', {
      day,
      totalCost: totalCarry,
      vehicleCount: unitCount,
    });
  }

  function rollListingRealizedRecon(listing: AuctionListing): number {
    const reliability =
      sourceReliability.reliability[listing.sourceId] ?? 0.5;
    return rollRecon(
      {
        estimate: listing.reconCost,
        condition: listing.condition,
        mileage: listing.mileage,
        sourceReliability: reliability,
      },
      deriveReconSeed(masterSeed, listing.id),
      reconVariance,
    ).realizedCost;
  }

  /**
   * Build a freshly-acquired lot vehicle and roll its hidden realized recon
   * (#162). Shared by the auction-buy and trade-acquisition paths (#171): the
   * only axis that differs is `sourceReliability` — the auction source's hidden
   * reliability for a buy, the staff condition-read confidence for a trade — and
   * both feed the same recon-variance gate. `reconEstimate` is the player's
   * budget (auction listing's `reconCost`, or the condition-tier baseline for a
   * trade); `purchasePrice` is the cost basis.
   */
  function buildAcquiredVehicle(args: {
    id: string;
    templateId: string;
    brand: string;
    year: number;
    make: string;
    model: string;
    trim: string;
    mileage: number;
    condition: AuctionListing['condition'];
    conditionReport: string;
    purchasePrice: number;
    category: AuctionListing['category'];
    reconEstimate: number;
    sourceReliability: number;
  }): LotVehicle {
    const reconRoll = rollRecon(
      {
        estimate: args.reconEstimate,
        condition: args.condition,
        mileage: args.mileage,
        sourceReliability: args.sourceReliability,
      },
      deriveReconSeed(masterSeed, args.id),
      reconVariance,
    );
    const reconDaysTotal =
      reconVariance.reconDaysByCondition[args.condition] ?? 5;
    // Cost-basis placeholder (#120). When a live market provider is wired
    // (#273) the suggested retail — and thus the default asking price, now the
    // close's transaction anchor — comes from the market suggestion instead.
    const costBasis = args.purchasePrice + args.reconEstimate;
    const vehicle: LotVehicle = {
      id: args.id,
      templateId: args.templateId,
      brand: args.brand,
      year: args.year,
      make: args.make,
      model: args.model,
      trim: args.trim,
      mileage: args.mileage,
      condition: args.condition,
      conditionReport: args.conditionReport,
      purchasePrice: args.purchasePrice,
      reconCost: 0,
      category: args.category,
      arrivalDay: currentDay,
      daysInInventory: 0,
      carryingCostToDate: 0,
      dailyCarryingCost: 0,
      aged: false,
      suggestedRetail: costBasis,
      askingPrice: costBasis,
      reconStatus: 'in_progress',
      reconEstimate: args.reconEstimate,
      reconRealizedCost: reconRoll.realizedCost,
      reconDaysRemaining: reconDaysTotal,
      reconDaysTotal,
      reconBucket: reconRoll.bucket,
    };
    if (!marketPriceFn) return vehicle;
    const suggestedRetail = Math.max(0, Math.round(marketPriceFn(vehicle)));
    // #285: the standing auto-pricing policy stamps the default ask. When a
    // pricing policy is wired (UCM on staff → strategy auto-prices intake) the
    // default ask follows the policy target; otherwise it sits at the market
    // suggestion (suggestion-only — the toggle just drives the pricing screen).
    const askingPrice = pricingPolicyFn
      ? Math.max(0, Math.round(pricingPolicyFn({ ...vehicle, suggestedRetail })))
      : suggestedRetail;
    return { ...vehicle, suggestedRetail, askingPrice };
  }

  /**
   * Materialize a customer's accepted trade-in onto the lot (#171). Cost basis
   * is the agreed allowance and NO Economy expense is posted — the allowance is
   * already offset against the deal cash in the close structure (#169). The
   * recon estimate is the condition-tier baseline (the same budget an auction
   * unit of that condition shows); the staff condition-read confidence drives
   * the realized-recon spread, so an unread trade hides lemons.
   */
  function acquireFromTrade(acquisition: TradeAcquisitionInput): LotVehicle {
    const { customerId, currentVehicle, agreedAllowance, staffConfidence } =
      acquisition;
    const tier = vehicleData.conditionTiers[currentVehicle.condition];
    const lotVehicle = buildAcquiredVehicle({
      id: `trade-day${currentDay}-${customerId}`,
      templateId: currentVehicle.templateId,
      brand: currentVehicle.brand,
      year: currentVehicle.year,
      make: currentVehicle.make,
      model: currentVehicle.model,
      // CurrentVehicle carries no trim — the dealer reconditions/relists it.
      trim: '',
      mileage: currentVehicle.mileage,
      condition: currentVehicle.condition,
      conditionReport: tier.report,
      purchasePrice: agreedAllowance,
      category: currentVehicle.category,
      reconEstimate: tier.reconCost,
      sourceReliability: staffConfidence,
    });
    lotVehicles.set(lotVehicle.id, lotVehicle);

    bus.publish('inventory:vehicle_acquired_via_trade', {
      day: currentDay,
      vehicleId: lotVehicle.id,
      customerId,
      allowance: agreedAllowance,
      templateId: lotVehicle.templateId,
      brand: lotVehicle.brand,
      make: lotVehicle.make,
      year: lotVehicle.year,
      mileage: lotVehicle.mileage,
      condition: lotVehicle.condition,
      category: lotVehicle.category,
      reconCost: lotVehicle.reconEstimate,
    });
    return lotVehicle;
  }

  function advanceInspections(day: number): void {
    for (const [id, listing] of pendingInspections) {
      if (
        listing.inspectionStatus === 'pending' &&
        listing.inspectionAvailableDay !== undefined &&
        day >= listing.inspectionAvailableDay
      ) {
        const realized = rollListingRealizedRecon(listing);
        const halfWidth = realized * inventoryConfig.inspection.halfWidthFraction;
        const reconLow = Math.max(0, Math.round(realized - halfWidth));
        const reconHigh = Math.max(reconLow, Math.round(realized + halfWidth));
        pendingInspections.set(id, {
          ...listing,
          inspectionStatus: 'completed',
          inspectionResult: { reconLow, reconHigh },
        });
        continue;
      }
      // Completed listings expire one day after they were made available.
      if (
        listing.inspectionStatus === 'completed' &&
        listing.inspectionAvailableDay !== undefined &&
        day > listing.inspectionAvailableDay
      ) {
        pendingInspections.delete(id);
      }
    }
  }

  function advanceRecon(v: LotVehicle, day: number): LotVehicle {
    if (v.reconStatus !== 'in_progress') return v;

    // Daily spend amortizes the realized total over the configured day count.
    const perDaySpend =
      v.reconDaysTotal > 0 ? v.reconRealizedCost / v.reconDaysTotal : v.reconRealizedCost;
    const remainingShortfall = v.reconRealizedCost - v.reconCost;
    const spendThisDay = Math.min(remainingShortfall, perDaySpend);
    if (spendThisDay <= 0) {
      // Already fully amortized — e.g. a surprise pause landed exactly on the
      // realized total and the player then authorized the (now zero) remaining
      // spend. Completion must always notify, so emit recon_completed here too
      // rather than transition to 'complete' silently.
      bus.publish('inventory:recon_completed', {
        day,
        vehicleId: v.id,
        realizedCost: v.reconRealizedCost,
        estimate: v.reconEstimate,
        bucket: v.reconBucket,
      });
      return {
        ...v,
        reconCost: v.reconRealizedCost,
        reconStatus: 'complete',
        reconDaysRemaining: 0,
      };
    }

    const newSpent = v.reconCost + spendThisDay;
    economy.postExpense(
      Math.round(spendThisDay),
      `Recon: ${v.year} ${v.make} ${v.model} (${v.id})`,
    );

    const surpriseTriggerCost = v.reconEstimate * reconVariance.surpriseThreshold;
    const crossedThreshold =
      v.reconBucket !== 'within' &&
      v.reconCost < surpriseTriggerCost &&
      newSpent >= surpriseTriggerCost;

    let updated: LotVehicle = {
      ...v,
      reconCost: Math.round(newSpent),
      reconDaysRemaining: Math.max(0, v.reconDaysRemaining - 1),
    };

    if (crossedThreshold) {
      const tmpl = pickSurpriseTemplate(
        v.reconBucket,
        deriveReconSurpriseSeed(masterSeed, v.id),
        reconSurprises,
      );
      updated = { ...updated, reconStatus: 'paused_for_decision' };
      bus.publish('inventory:recon_surprise', {
        day,
        vehicleId: v.id,
        templateId: tmpl?.id ?? 'unknown',
        reason: tmpl?.reason ?? 'Recon costs exceed estimate.',
        estimate: v.reconEstimate,
        revisedTotal: v.reconRealizedCost,
        spentToDate: updated.reconCost,
        bucket: v.reconBucket,
      });
      return updated;
    }

    if (updated.reconCost >= v.reconRealizedCost) {
      updated = {
        ...updated,
        reconCost: v.reconRealizedCost,
        reconStatus: 'complete',
        reconDaysRemaining: 0,
      };
      bus.publish('inventory:recon_completed', {
        day,
        vehicleId: v.id,
        realizedCost: v.reconRealizedCost,
        estimate: v.reconEstimate,
        bucket: v.reconBucket,
      });
    }
    return updated;
  }

  bus.subscribe('clock:managerial_prep', ({ upcomingDay }) => {
    prepareDay(upcomingDay);
  });
  bus.subscribe('clock:day_started', ({ day }) => {
    prepareDay(day);
  });
  // #171: an accepted/countered trade resolves → the trade vehicle enters the
  // lot. `trade:resolved` only fires for `accept`/`counter` (declines and
  // underwater abandons never emit it), so every event here is an acquisition.
  bus.subscribe('trade:resolved', (e) => {
    acquireFromTrade({
      customerId: e.customerId,
      currentVehicle: e.currentVehicle,
      agreedAllowance: e.agreedAllowance,
      staffConfidence: e.staffConfidence,
    });
  });

  return {
    getAuctionListings() {
      if (pendingInspections.size === 0) return auctionListings;
      return [...auctionListings, ...pendingInspections.values()];
    },

    getLotVehicles() {
      return [...lotVehicles.values()];
    },

    getLotVehicle(vehicleId) {
      return lotVehicles.get(vehicleId);
    },

    buyFromAuction(listingId) {
      const pending = pendingInspections.get(listingId);
      const listing = pending ?? auctionListings.find((l) => l.id === listingId);
      if (!listing) throw new Error(`No auction listing "${listingId}"`);
      if (listing.inspectionStatus === 'pending') {
        throw new Error(
          `Listing "${listingId}" has a pending inspection — purchase blocked until day ${listing.inspectionAvailableDay}`,
        );
      }

      // Categorized as stock acquisition (#255): the Home cash delta breaks
      // this out as "into stock" instead of coloring a deliberate buy as a
      // loss. Inspection/recon/carrying stay uncategorized (operating spend).
      economy.postExpense(
        listing.askingPrice,
        `Auction purchase: ${listing.id}`,
        'inventoryAcquisition',
      );

      const reliability = sourceReliability.reliability[listing.sourceId] ?? 0.5;
      const lotVehicle = buildAcquiredVehicle({
        id: listing.id,
        templateId: listing.templateId,
        brand: listing.brand,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        trim: listing.trim,
        mileage: listing.mileage,
        condition: listing.condition,
        conditionReport: listing.conditionReport,
        purchasePrice: listing.askingPrice,
        category: listing.category,
        reconEstimate: listing.reconCost,
        sourceReliability: reliability,
      });
      lotVehicles.set(lotVehicle.id, lotVehicle);
      auctionListings = auctionListings.filter((l) => l.id !== listingId);
      pendingInspections.delete(listingId);

      bus.publish('inventory:vehicle_purchased', {
        day: currentDay,
        vehicleId: lotVehicle.id,
        cost: listing.askingPrice,
        templateId: lotVehicle.templateId,
        brand: lotVehicle.brand,
        make: lotVehicle.make,
        year: lotVehicle.year,
        mileage: lotVehicle.mileage,
        condition: lotVehicle.condition,
        category: lotVehicle.category,
        reconCost: lotVehicle.reconEstimate,
      });
    },

    sellVehicle(vehicleId, salePrice) {
      const vehicle = lotVehicles.get(vehicleId);
      if (!vehicle) throw new Error(`No lot vehicle "${vehicleId}"`);
      lotVehicles.delete(vehicleId);
      bus.publish('inventory:vehicle_sold', {
        day: currentDay,
        vehicleId,
        salePrice: salePrice ?? vehicle.askingPrice,
        templateId: vehicle.templateId,
        brand: vehicle.brand,
        make: vehicle.make,
        year: vehicle.year,
        mileage: vehicle.mileage,
        condition: vehicle.condition,
        category: vehicle.category,
        purchasePrice: vehicle.purchasePrice,
        reconCost: vehicle.reconCost,
      });
      return vehicle;
    },

    acquireFromTrade,

    setAskingPrice(vehicleId, askingPrice) {
      const vehicle = lotVehicles.get(vehicleId);
      if (!vehicle) return;
      lotVehicles.set(vehicleId, {
        ...vehicle,
        askingPrice: Math.max(0, Math.round(askingPrice)),
      });
    },

    authorizeReconSpend(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      if (!v || v.reconStatus !== 'paused_for_decision') return;
      // Re-amortize the remaining shortfall across the original day count's
      // tail. If reconDaysRemaining hit 0, give it one more day so the spend
      // resolves cleanly.
      const daysRemaining = Math.max(1, v.reconDaysRemaining);
      lotVehicles.set(vehicleId, {
        ...v,
        reconStatus: 'in_progress',
        reconDaysRemaining: daysRemaining,
      });
    },

    requestInspection(listingId) {
      if (pendingInspections.has(listingId)) return;
      const idx = auctionListings.findIndex((l) => l.id === listingId);
      if (idx === -1) throw new Error(`No auction listing "${listingId}"`);
      const listing = auctionListings[idx];

      economy.postExpense(
        inventoryConfig.inspection.cost,
        `Inspection: ${listing.id}`,
      );

      const availableDay =
        currentDay + inventoryConfig.inspection.daysToComplete;
      const updated: AuctionListing = {
        ...listing,
        inspectionStatus: 'pending',
        inspectionAvailableDay: availableDay,
      };
      auctionListings = auctionListings.filter((_, i) => i !== idx);
      pendingInspections.set(listingId, updated);
    },

    snapshot() {
      return {
        schemaVersion: 1,
        currentDay,
        lastPreparedDay,
        auctionListings: [...auctionListings],
        pendingInspections: [...pendingInspections.values()],
        lotVehicles: [...lotVehicles.values()],
      };
    },

    restore(snap) {
      currentDay = snap.currentDay;
      lastPreparedDay = snap.lastPreparedDay;
      auctionListings = [...snap.auctionListings];
      pendingInspections.clear();
      for (const listing of snap.pendingInspections) {
        pendingInspections.set(listing.id, listing);
      }
      lotVehicles.clear();
      for (const vehicle of snap.lotVehicles) {
        lotVehicles.set(vehicle.id, vehicle);
      }
    },

    abandonRecon(vehicleId) {
      const v = lotVehicles.get(vehicleId);
      if (!v || v.reconStatus !== 'paused_for_decision') return;
      // AC: wholesale at current book − reconCostToDate. The loss vs. cost
      // basis lands naturally via revenue post: book−sunk in, purchase+sunk
      // out, net P/L = book − purchase − 2·sunk. The double-count reflects
      // that the abandon path means the unit is unretailable as-is and the
      // wholesale buyer prices in the unfinished recon.
      const book = bookValueFn(v);
      const wholesale = Math.max(0, Math.round(book - v.reconCost));
      economy.postRevenue(
        wholesale,
        `Wholesale dump (recon abandoned): ${v.year} ${v.make} ${v.model}`,
      );
      lotVehicles.delete(vehicleId);
      bus.publish('inventory:vehicle_sold', {
        day: currentDay,
        vehicleId: v.id,
        salePrice: wholesale,
        templateId: v.templateId,
        brand: v.brand,
        make: v.make,
        year: v.year,
        mileage: v.mileage,
        condition: v.condition,
        category: v.category,
        purchasePrice: v.purchasePrice,
        reconCost: v.reconCost,
      });
    },
  };
}
