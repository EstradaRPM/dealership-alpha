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
import type { VehicleData } from './vehicleData';
import type { AuctionListing, LotVehicle } from './types';

export interface Inventory {
  getAuctionListings(): readonly AuctionListing[];
  getLotVehicles(): readonly LotVehicle[];
  getLotVehicle(vehicleId: string): LotVehicle | undefined;
  buyFromAuction(listingId: string): void;
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
}

export interface InventoryDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Pick<Economy, 'cash' | 'postExpense' | 'postRevenue'>;
  vehicleData?: VehicleData;
  /**
   * Live book-value provider used by the recon-abandon path (#162). Receives
   * the in-progress lot vehicle and returns its current honest book. Omit
   * to fall back to `purchasePrice + reconSpentToDate` (the static stub
   * mirror — same shape as the SalesProcess seam default).
   */
  bookValueFn?: (v: LotVehicle) => number;
  reconVariance?: ReconVarianceConfig;
  reconSurprises?: ReconSurpriseEventsConfig;
  auctionSourceReliability?: AuctionSourceReliability;
}

export function createInventory(deps: InventoryDeps): Inventory {
  const { bus, masterSeed, economy } = deps;
  const vehicleData = deps.vehicleData ?? loadVehicleData();
  const reconVariance = deps.reconVariance ?? loadReconVarianceConfig();
  const reconSurprises = deps.reconSurprises ?? loadReconSurpriseEventsConfig();
  const sourceReliability =
    deps.auctionSourceReliability ??
    rollAuctionSourceReliability(masterSeed, loadAuctionSourcesConfig());
  const bookValueFn =
    deps.bookValueFn ?? ((v: LotVehicle) => v.purchasePrice + v.reconCost);

  let currentDay = 1;
  let auctionListings: AuctionListing[] = [];
  const lotVehicles = new Map<string, LotVehicle>();
  let lastPreparedDay = 0;

  function prepareDay(day: number): void {
    if (day === lastPreparedDay) return;
    lastPreparedDay = day;
    currentDay = day;
    auctionListings = generateAuctionListings(day, masterSeed, vehicleData);
    for (const [id, v] of lotVehicles) {
      const aged = { ...v, daysInInventory: day - v.arrivalDay };
      lotVehicles.set(id, advanceRecon(aged, day));
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
      return { ...v, reconStatus: 'complete', reconDaysRemaining: 0 };
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

  return {
    getAuctionListings() {
      return auctionListings;
    },

    getLotVehicles() {
      return [...lotVehicles.values()];
    },

    getLotVehicle(vehicleId) {
      return lotVehicles.get(vehicleId);
    },

    buyFromAuction(listingId) {
      const listing = auctionListings.find((l) => l.id === listingId);
      if (!listing) throw new Error(`No auction listing "${listingId}"`);

      economy.postExpense(listing.askingPrice, `Auction purchase: ${listing.id}`);

      const reliability = sourceReliability.reliability[listing.sourceId] ?? 0.5;
      const reconRoll = rollRecon(
        {
          estimate: listing.reconCost,
          condition: listing.condition,
          mileage: listing.mileage,
          sourceReliability: reliability,
        },
        deriveReconSeed(masterSeed, listing.id),
        reconVariance,
      );
      const reconDaysTotal =
        reconVariance.reconDaysByCondition[listing.condition] ?? 5;

      const suggestedRetail = listing.askingPrice + listing.reconCost;
      const lotVehicle: LotVehicle = {
        id: listing.id,
        templateId: listing.templateId,
        year: listing.year,
        make: listing.make,
        model: listing.model,
        trim: listing.trim,
        mileage: listing.mileage,
        condition: listing.condition,
        conditionReport: listing.conditionReport,
        purchasePrice: listing.askingPrice,
        reconCost: 0,
        category: listing.category,
        arrivalDay: currentDay,
        daysInInventory: 0,
        suggestedRetail,
        askingPrice: suggestedRetail,
        reconStatus: 'in_progress',
        reconEstimate: listing.reconCost,
        reconRealizedCost: reconRoll.realizedCost,
        reconDaysRemaining: reconDaysTotal,
        reconDaysTotal,
        reconBucket: reconRoll.bucket,
      };
      lotVehicles.set(lotVehicle.id, lotVehicle);
      auctionListings = auctionListings.filter((l) => l.id !== listingId);

      bus.publish('inventory:vehicle_purchased', {
        day: currentDay,
        vehicleId: lotVehicle.id,
        cost: listing.askingPrice,
        templateId: lotVehicle.templateId,
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
