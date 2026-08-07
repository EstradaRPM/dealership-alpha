import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import { loadFniProducts, getFniProductById, loadFniAutoAttachConfig } from './fniProducts';
import { loadDealFraudConfig, type DealFraudConfig } from './dealFraudConfig';
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
  fraudConfig?: DealFraudConfig;
  bus?: EventBus;
  inventory?: Pick<Inventory, 'getLotVehicle' | 'sellVehicle'>;
  economy?: Pick<Economy, 'postRevenue'>;
  /**
   * Live current-day getter (#271). Only consumed by the lemon-law exposure
   * emit below, which stamps `day` onto `regulatory:lemon_law_incident`.
   * Omitted ⇒ day 0 (isolation tests that don't drive a clock); the composition
   * root passes `() => clock.currentDay`.
   */
  getCurrentDay?: () => number;
}

export function createDealEngine(deps: DealEngineDeps = {}): DealEngine {
  const catalog = deps.catalog ?? loadCreditTiers();
  const fniCatalog = deps.fniCatalog ?? loadFniProducts();
  const autoAttachConfig = deps.fniAutoAttachConfig ?? loadFniAutoAttachConfig();
  const fraudConfig = deps.fraudConfig ?? loadDealFraudConfig();
  const { bus, inventory, economy, getCurrentDay } = deps;

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
      salesQuality,
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

      inventory.sellVehicle(vehicleId, agreedPrice);
      economy.postRevenue(agreedPrice, `Vehicle sale: ${vehicleId}`);

      // Lemon-law exposure (#271, IndictmentMonitor severe-event producer).
      // Retailing a unit whose hidden recon landed in a severe tail bucket
      // (`major`/`catastrophic`) WITHOUT having reconditioned it (recon never
      // reached `complete` — sold mid-recon or sold-as-is past a paused recon
      // surprise) ships a latent defect to the customer. That is the diegetic
      // trigger for lemon-law liability, which accumulates indictment pressure.
      // A completed recon means the defect was found AND fixed, so it is NOT a
      // lemon — hence the `!== 'complete'` gate. This is the tracer producer;
      // the other two severe signals (`regulatory:audit_failure`,
      // `deal:fraud_flag`) remain unwired follow-ons (see issue #271).
      const soldAsLemon =
        vehicle.reconStatus !== 'complete' &&
        (vehicle.reconBucket === 'major' || vehicle.reconBucket === 'catastrophic');
      if (soldAsLemon) {
        bus.publish('regulatory:lemon_law_incident', {
          day: getCurrentDay?.() ?? 0,
          customerId,
        });
      }

      let backGross = 0;
      let fniBurden = 0;
      for (const attached of fniProducts) {
        const product = getFniProductById(fniCatalog, attached.productId);
        if (product) {
          backGross += attached.price - product.cost;
          fniBurden += attached.price;
          economy.postRevenue(attached.price, `F&I: ${attached.productId}`);
        }
      }

      // Payment-packing fraud exposure (#327, IndictmentMonitor severe-event
      // producer). Stuffing a *financed* deal with F&I back-end product beyond a
      // compliance fraction of the vehicle price is payment packing — inflating
      // the monthly payment with undisclosed markup, a real structuring/
      // disclosure violation. The parallel to the lemon-law producer above: an
      // aggressive-F&I choice (heavy attach on cheap metal) is the diegetic
      // trigger that accumulates indictment pressure. Cash deals can't pack a
      // payment, so the gate is financed-only.
      const isPacked =
        paymentMethod === 'finance' &&
        agreedPrice > 0 &&
        fniBurden > agreedPrice * fraudConfig.packFraction;
      if (isPacked) {
        bus.publish('deal:fraud_flag', {
          day: getCurrentDay?.() ?? 0,
          customerId,
          vehicleId,
        });
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
        // Carried, never read here (#363): only the caller that ran the sales
        // process knows how the buyer read it, and `customer:resolved` needs it.
        salesQuality,
      });
      return result;
    },
  };
}
