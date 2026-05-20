import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import { loadFniProducts, getFniProductById, loadFniAutoAttachConfig } from './fniProducts';
import type {
  CreditTier,
  CreditTierCatalog,
  LoanParams,
  LoanResult,
  CloseDealParams,
  ClosedDealResult,
  FniProduct,
  FniProductCatalog,
  FniAutoAttachConfig,
  AttachedFniProduct,
} from './types';
import type { EventBus } from '../EventBus';
import type { Inventory } from '../Inventory';
import type { Economy } from '../Economy';

export interface DealEngine {
  classifyCredit(score: number): CreditTier;
  structure(params: LoanParams): LoanResult;
  closeDeal(params: CloseDealParams): ClosedDealResult;
  getFniProducts(unlockedRoles?: string[]): FniProduct[];
  computeAutoFni(skill: number, unlockedRoles?: string[], rng?: () => number): AttachedFniProduct[];
}

export interface DealEngineDeps {
  catalog?: CreditTierCatalog;
  fniCatalog?: FniProductCatalog;
  fniAutoAttachConfig?: FniAutoAttachConfig;
  bus?: EventBus;
  inventory?: Pick<Inventory, 'getLotVehicle' | 'sellVehicle'>;
  economy?: Pick<Economy, 'postRevenue'>;
}

export function createDealEngine(deps: DealEngineDeps = {}): DealEngine {
  const catalog = deps.catalog ?? loadCreditTiers();
  const fniCatalog = deps.fniCatalog ?? loadFniProducts();
  const autoAttachConfig = deps.fniAutoAttachConfig ?? loadFniAutoAttachConfig();
  const { bus, inventory, economy } = deps;

  return {
    classifyCredit(score) {
      return classifyCredit(score, catalog);
    },

    structure(params) {
      const tierDef = catalog.tiers[params.tier];
      return computeMonthlyPayment(params, tierDef);
    },

    getFniProducts(unlockedRoles?: string[]) {
      if (!unlockedRoles) return fniCatalog.products;
      return fniCatalog.products.filter(
        (p) => !p.requiredRole || unlockedRoles.includes(p.requiredRole),
      );
    },

    computeAutoFni(skill: number, unlockedRoles?: string[], rng: () => number = Math.random): AttachedFniProduct[] {
      const available = this.getFniProducts(unlockedRoles);
      const [minMult, maxMult] = autoAttachConfig.skillMultiplierRange;
      const skillFactor = skill / 100;
      const multiplier = minMult + (maxMult - minMult) * skillFactor;
      const attached: AttachedFniProduct[] = [];
      for (const product of available) {
        const baseRate = autoAttachConfig.baseAttachRates[product.id] ?? 0;
        const actualRate = Math.min(1, baseRate * multiplier);
        if (rng() < actualRate) {
          attached.push({ productId: product.id, price: product.defaultPrice });
        }
      }
      return attached;
    },

    closeDeal({
      customerId,
      vehicleId,
      agreedPrice,
      fniProducts = [],
      paymentMethod = 'cash',
      downPayment,
      loanAmount = 0,
      term = 0,
      apr = 0,
    }) {
      // Default to a full-down cash structure when the caller omits the deal-
      // structuring fields. downPayment defaults to agreedPrice for cash so the
      // sum (downPayment + loanAmount) equals what was actually paid.
      const resolvedDownPayment = downPayment ?? (paymentMethod === 'cash' ? agreedPrice : 0);
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
      const daysInInventory = vehicle.daysInInventory;
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
        daysInInventory,
        fniProducts,
        paymentMethod,
        downPayment: resolvedDownPayment,
        loanAmount,
        term,
        apr,
      };

      bus.publish('deal:closed', {
        customerId,
        vehicleId,
        agreedPrice,
        frontGross,
        backGross,
        daysInInventory,
        paymentMethod,
        downPayment: resolvedDownPayment,
        loanAmount,
        term,
        apr,
      });
      return result;
    },
  };
}
