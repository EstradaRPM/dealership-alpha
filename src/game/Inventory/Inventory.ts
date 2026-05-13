import type { EventBus } from '../EventBus';
import { generateAuctionListings } from './auctionGenerator';
import { loadVehicleData } from './vehicleData';
import type { VehicleData } from './vehicleData';
import type { AuctionListing, LotVehicle } from './types';

export interface Inventory {
  getAuctionListings(): readonly AuctionListing[];
  getLotVehicles(): readonly LotVehicle[];
  getLotVehicle(vehicleId: string): LotVehicle | undefined;
  buyFromAuction(listingId: string): void;
  getCash(): number;
}

export interface InventoryDeps {
  bus: EventBus;
  masterSeed: number;
  startingCash: number;
  vehicleData?: VehicleData;
}

export function createInventory(deps: InventoryDeps): Inventory {
  const { bus, masterSeed, startingCash } = deps;
  const vehicleData = deps.vehicleData ?? loadVehicleData();

  let cash = startingCash;
  let currentDay = 1;
  let auctionListings: AuctionListing[] = [];
  const lotVehicles = new Map<string, LotVehicle & { daysInInventory: number }>();

  // Refresh listings on day start; age DII for all lot vehicles.
  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    auctionListings = generateAuctionListings(day, masterSeed, vehicleData);
    for (const [id, v] of lotVehicles) {
      lotVehicles.set(id, { ...v, daysInInventory: day - v.arrivalDay });
    }
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
      if (cash < listing.askingPrice) {
        throw new Error(`Insufficient cash (have ${cash}, need ${listing.askingPrice})`);
      }

      cash -= listing.askingPrice;
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
      };
      lotVehicles.set(lotVehicle.id, { ...lotVehicle, daysInInventory: 0 });
      auctionListings = auctionListings.filter((l) => l.id !== listingId);

      bus.publish('inventory:vehicle_purchased', {
        day: currentDay,
        vehicleId: lotVehicle.id,
        cost: listing.askingPrice,
      });
    },

    getCash() {
      return cash;
    },
  };
}
