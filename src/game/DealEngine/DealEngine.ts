import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import type { CreditTier, CreditTierCatalog, LoanParams, LoanResult, CloseDealParams, ClosedDealResult } from './types';
import type { EventBus } from '../EventBus';
import type { Inventory } from '../Inventory';
import type { Economy } from '../Economy';

export interface DealEngine {
  classifyCredit(score: number): CreditTier;
  structure(params: LoanParams): LoanResult;
  closeDeal(params: CloseDealParams): ClosedDealResult;
}

export interface DealEngineDeps {
  catalog?: CreditTierCatalog;
  bus?: EventBus;
  inventory?: Pick<Inventory, 'getLotVehicle' | 'sellVehicle'>;
  economy?: Pick<Economy, 'postRevenue'>;
}

export function createDealEngine(deps: DealEngineDeps = {}): DealEngine {
  const catalog = deps.catalog ?? loadCreditTiers();
  const { bus, inventory, economy } = deps;

  return {
    classifyCredit(score) {
      return classifyCredit(score, catalog);
    },

    structure(params) {
      const tierDef = catalog.tiers[params.tier];
      return computeMonthlyPayment(params, tierDef);
    },

    closeDeal({ customerId, vehicleId, agreedPrice }) {
      if (!bus || !inventory || !economy) {
        throw new Error('closeDeal requires bus, inventory, and economy deps');
      }
      const vehicle = inventory.getLotVehicle(vehicleId);
      if (!vehicle) throw new Error(`No lot vehicle "${vehicleId}"`);

      inventory.sellVehicle(vehicleId);
      economy.postRevenue(agreedPrice, `Vehicle sale: ${vehicleId}`);

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
        backGross: 0,
      };

      bus.publish('deal:closed', { customerId, vehicleId, agreedPrice, frontGross, backGross: 0 });
      return result;
    },
  };
}
