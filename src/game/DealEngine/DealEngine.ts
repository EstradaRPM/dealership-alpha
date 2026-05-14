import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import { loadFniProducts, getFniProductById } from './fniProducts';
import type {
  CreditTier,
  CreditTierCatalog,
  LoanParams,
  LoanResult,
  CloseDealParams,
  ClosedDealResult,
  FniProduct,
  FniProductCatalog,
} from './types';
import type { EventBus } from '../EventBus';
import type { Inventory } from '../Inventory';
import type { Economy } from '../Economy';

export interface DealEngine {
  classifyCredit(score: number): CreditTier;
  structure(params: LoanParams): LoanResult;
  closeDeal(params: CloseDealParams): ClosedDealResult;
  getFniProducts(): FniProduct[];
}

export interface DealEngineDeps {
  catalog?: CreditTierCatalog;
  fniCatalog?: FniProductCatalog;
  bus?: EventBus;
  inventory?: Pick<Inventory, 'getLotVehicle' | 'sellVehicle'>;
  economy?: Pick<Economy, 'postRevenue'>;
}

export function createDealEngine(deps: DealEngineDeps = {}): DealEngine {
  const catalog = deps.catalog ?? loadCreditTiers();
  const fniCatalog = deps.fniCatalog ?? loadFniProducts();
  const { bus, inventory, economy } = deps;

  return {
    classifyCredit(score) {
      return classifyCredit(score, catalog);
    },

    structure(params) {
      const tierDef = catalog.tiers[params.tier];
      return computeMonthlyPayment(params, tierDef);
    },

    getFniProducts() {
      return fniCatalog.products;
    },

    closeDeal({ customerId, vehicleId, agreedPrice, fniProducts = [] }) {
      if (!bus || !inventory || !economy) {
        throw new Error('closeDeal requires bus, inventory, and economy deps');
      }
      const vehicle = inventory.getLotVehicle(vehicleId);
      if (!vehicle) throw new Error(`No lot vehicle "${vehicleId}"`);

      inventory.sellVehicle(vehicleId);
      economy.postRevenue(agreedPrice, `Vehicle sale: ${vehicleId}`);

      let backGross = 0;
      for (const attached of fniProducts) {
        const product = getFniProductById(fniCatalog, attached.productId);
        if (product) {
          backGross += attached.price - product.cost;
          economy.postRevenue(attached.price, `F&I: ${attached.productId}`);
        }
      }

      const frontGross = agreedPrice - vehicle.purchasePrice - vehicle.reconCost;
      const result: ClosedDealResult = {
        customerId,
        vehicleId,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        agreedPrice,
        purchasePrice: vehicle.purchasePrice,
        reconCost: vehicle.reconCost,
        frontGross,
        backGross,
        fniProducts,
      };

      bus.publish('deal:closed', { customerId, vehicleId, agreedPrice, frontGross, backGross });
      return result;
    },
  };
}
