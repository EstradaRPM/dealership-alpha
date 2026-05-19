import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import { generateAuctionListings } from './auctionGenerator';
import { loadVehicleData } from './vehicleData';
import type { VehicleData } from './vehicleData';
import type { AuctionListing, LotVehicle } from './types';

export interface Inventory {
  getAuctionListings(): readonly AuctionListing[];
  getLotVehicles(): readonly LotVehicle[];
  getLotVehicle(vehicleId: string): LotVehicle | undefined;
  buyFromAuction(listingId: string): void;
  sellVehicle(vehicleId: string): LotVehicle;
  /**
   * Player-set asking price for a lot vehicle (MANAGERIAL Pricing lever,
   * #120). Negative inputs are clamped to 0; an unknown vehicleId is a no-op
   * (the lever only ever passes ids it just read from `getLotVehicles`).
   */
  setAskingPrice(vehicleId: string, askingPrice: number): void;
}

export interface InventoryDeps {
  bus: EventBus;
  masterSeed: number;
  economy: Pick<Economy, 'cash' | 'postExpense'>;
  vehicleData?: VehicleData;
}

export function createInventory(deps: InventoryDeps): Inventory {
  const { bus, masterSeed, economy } = deps;
  const vehicleData = deps.vehicleData ?? loadVehicleData();

  let currentDay = 1;
  let auctionListings: AuctionListing[] = [];
  const lotVehicles = new Map<string, LotVehicle & { daysInInventory: number }>();
  // #136: track which day has already been prepared so the same day prepared
  // by both the night-before prep signal and the morning-of day_started
  // doesn't get its listings regenerated (and any bought-during-MANAGERIAL
  // listings re-introduced). A `day=0` sentinel means no day prepared yet.
  let lastPreparedDay = 0;

  function prepareDay(day: number): void {
    if (day === lastPreparedDay) return;
    lastPreparedDay = day;
    currentDay = day;
    auctionListings = generateAuctionListings(day, masterSeed, vehicleData);
    for (const [id, v] of lotVehicles) {
      lotVehicles.set(id, { ...v, daysInInventory: day - v.arrivalDay });
    }
  }

  // #136: night-before MANAGERIAL prep — generate the auction board for the
  // upcoming day so the player browses *the day they're about to play*, not
  // a stale or empty board. Cars bought during this prep window land on the
  // lot tagged with the upcoming day's arrivalDay (currentDay is shifted to
  // upcomingDay here).
  bus.subscribe('clock:managerial_prep', ({ upcomingDay }) => {
    prepareDay(upcomingDay);
  });

  // Morning-of safety net: if for any reason the upcoming day wasn't prepped
  // during MANAGERIAL, fall back to generating on day_started (this preserves
  // every pre-#136 caller — bare GameClock harnesses, etc.). Idempotent vs.
  // the prep-side generation via lastPreparedDay.
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

      // v1 has no market engine: suggested retail is a flat cost-basis
      // placeholder. The future retail-value engine replaces this expression
      // only — askingPrice still defaults to the suggestion.
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
        reconCost: listing.reconCost,
        category: listing.category,
        arrivalDay: currentDay,
        daysInInventory: 0,
        suggestedRetail,
        askingPrice: suggestedRetail,
      };
      lotVehicles.set(lotVehicle.id, { ...lotVehicle, daysInInventory: 0 });
      auctionListings = auctionListings.filter((l) => l.id !== listingId);

      bus.publish('inventory:vehicle_purchased', {
        day: currentDay,
        vehicleId: lotVehicle.id,
        cost: listing.askingPrice,
      });
    },

    sellVehicle(vehicleId) {
      const vehicle = lotVehicles.get(vehicleId);
      if (!vehicle) throw new Error(`No lot vehicle "${vehicleId}"`);
      lotVehicles.delete(vehicleId);
      bus.publish('inventory:vehicle_sold', { day: currentDay, vehicleId });
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
  };
}
