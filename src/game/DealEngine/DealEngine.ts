import { loadCreditTiers, classifyCredit } from './creditTier';
import { computeMonthlyPayment } from './loanMath';
import { loadFniProducts, getFniProductById, loadFniAutoAttachConfig } from './fniProducts';
import { loadDealFraudConfig, type DealFraudConfig } from './dealFraudConfig';
import {
  computeReserve,
  loadFniPostureConfig,
  loadFniReserveConfig,
  resolveFinanceQuote,
  resolveFniPostureMarkupPts,
  type FniPostureConfig,
} from './reserve';
import type {
  CreditTier,
  CreditTierCatalog,
  FinanceQuote,
  FniReserveConfig,
  LoanResult,
  ReserveInput,
  StructureParams,
  CloseDealParams,
  ClosedDealResult,
  FniProduct,
  FniProductCatalog,
  FniAutoAttachConfig,
  AttachedFniProduct,
  AutoFniInput,
} from './types';
import type { EventBus } from '../EventBus';
import type { Inventory } from '../Inventory';
import type { Economy } from '../Economy';

export interface DealEngine {
  classifyCredit(score: number): CreditTier;
  structure(params: StructureParams): LoanResult;
  /**
   * The rate this store quotes a customer on that tier's program today (#365),
   * and the buy rate behind it. Callers hand the same quote to the affordability
   * gate and to `closeDeal`, so the payment a customer is measured against and
   * the contract they sign are the same rate by construction.
   */
  quoteFinance(tier: CreditTier): FinanceQuote;
  /** The store's share of the discounted rate spread on a financed structure. */
  computeReserve(input: ReserveInput): number;
  closeDeal(params: CloseDealParams): ClosedDealResult;
  getFniProducts(unlockedRoles?: string[]): FniProduct[];
  /**
   * The menu the F&I desk gets signed on this deal. Attach scales with the
   * presenter's skill AND with how much of the price is financed (#152) — a
   * product that covers a note is a harder sell the less note there is, and
   * GAP cannot attach to a cash deal at all.
   */
  computeAutoFni(input: AutoFniInput): AttachedFniProduct[];
}

export interface DealEngineDeps {
  catalog?: CreditTierCatalog;
  fniCatalog?: FniProductCatalog;
  fniAutoAttachConfig?: FniAutoAttachConfig;
  fraudConfig?: DealFraudConfig;
  reserveConfig?: FniReserveConfig;
  /**
   * Is an `f&i-manager` working the desk right now (#365)? A closure rather
   * than a roster reference so DealEngine never depends on StaffOrg, read live
   * so the first F&I hire changes the next deal. Omitted ⇒ false ⇒ the ambient
   * markup, which is the honest answer for a Tier-1/2 store.
   */
  getFniDeskStaffed?: () => boolean;
  /**
   * The store's standing F&I posture, as its markup target in points of APR
   * (#366). A closure for the same reason as the desk read — the dial is
   * per-slot UI state, so the engine takes the resolved number and never learns
   * about save slots — and read live so a mid-game change applies on the next
   * deal without rebuilding the world. Omitted ⇒ the catalog's default posture,
   * which is what keeps a harness that never sets one at Balanced.
   */
  getFniPostureMarkupPts?: () => number;
  postureConfig?: FniPostureConfig;
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
  const reserveConfig = deps.reserveConfig ?? loadFniReserveConfig();
  const { bus, inventory, economy, getCurrentDay } = deps;
  const deskStaffed = deps.getFniDeskStaffed ?? (() => false);
  // #366: the posture the desk works to. Resolved once as a fallback so an
  // engine built without the dial (every isolation harness) sits at the
  // catalog default rather than at zero markup.
  const defaultPostureMarkupPts = resolveFniPostureMarkupPts(
    undefined,
    deps.postureConfig ?? loadFniPostureConfig(),
  );
  const postureMarkupPts =
    deps.getFniPostureMarkupPts ?? (() => defaultPostureMarkupPts);

  return {
    classifyCredit(score) {
      return classifyCredit(score, catalog);
    },

    quoteFinance(tier) {
      return resolveFinanceQuote(
        catalog.tiers[tier],
        { deskStaffed: deskStaffed(), postureMarkupPts: postureMarkupPts() },
        reserveConfig,
      );
    },

    computeReserve(input) {
      return computeReserve(input, reserveConfig.dealerSharePct);
    },

    structure(params) {
      // The payment is quoted at the CUSTOMER's rate, never the buy rate — the
      // markup is what the buyer's payment is actually built from, which is
      // what makes an over-marked structure fail PTI on its own (grill I3).
      return computeMonthlyPayment(params, this.quoteFinance(params.tier).customerRate);
    },

    getFniProducts(unlockedRoles?: string[]) {
      if (!unlockedRoles) return fniCatalog.products;
      return fniCatalog.products.filter(
        (p) => !p.requiredRole || unlockedRoles.includes(p.requiredRole),
      );
    },

    computeAutoFni({ skill, unlockedRoles, deal, rng = Math.random }: AutoFniInput): AttachedFniProduct[] {
      const available = this.getFniProducts(unlockedRoles);
      const [minMult, maxMult] = autoAttachConfig.skillMultiplierRange;
      const skillFactor = skill / 100;
      const multiplier = minMult + (maxMult - minMult) * skillFactor;
      // How much of the price the customer is borrowing (#152). A cash deal
      // finances nothing; a heavy-down deal finances a little. This is the one
      // term the structure enters the attach rate through.
      const financedShare =
        deal.paymentMethod === 'finance' && deal.agreedPrice > 0
          ? Math.min(1, Math.max(0, deal.loanAmount / deal.agreedPrice))
          : 0;
      const attached: AttachedFniProduct[] = [];
      for (const product of available) {
        // The roll is drawn for every available product whether or not it can
        // attach, so gating one does not shift the stream for the rest — the
        // same customer on the same seed sees the same menu decisions.
        const roll = rng();
        // Categorical, and therefore ahead of the roll: GAP covers the gap
        // between a loan balance and the car's value, so there is nothing to
        // cover on a cash deal at any sensitivity or any RNG value.
        if (product.requiresFinancing && deal.paymentMethod !== 'finance') continue;
        const baseRate = autoAttachConfig.baseAttachRates[product.id] ?? 0;
        // A product with no `loanSensitivity` is flat: the factor is 1 whatever
        // the structure. At 1 it tracks the financed share outright.
        const loanFactor = 1 - (product.loanSensitivity ?? 0) * (1 - financedShare);
        const actualRate = Math.min(1, baseRate * multiplier * loanFactor);
        if (roll < actualRate) {
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
      buyRate,
      salesQuality,
    }) {
      // A caller that names no buy rate quoted no spread, so it earns no
      // reserve — the behavior-neutral default for every pre-#365 harness.
      const resolvedBuyRate = buyRate ?? apr;
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

      let productGross = 0;
      let fniBurden = 0;
      for (const attached of fniProducts) {
        const product = getFniProductById(fniCatalog, attached.productId);
        if (product) {
          productGross += attached.price - product.cost;
          fniBurden += attached.price;
          economy.postRevenue(attached.price, `F&I: ${attached.productId}`);
        }
      }

      // Finance reserve (#365) — the second half of the back end, and the one
      // that exists only on a financed deal.
      const reserveGross =
        paymentMethod === 'finance'
          ? computeReserve(
              {
                amountFinanced: loanAmount,
                termMonths: term,
                buyRate: resolvedBuyRate,
                customerRate: apr,
              },
              reserveConfig.dealerSharePct,
            )
          : 0;
      const backGross = productGross + reserveGross;

      // Reserve is money the lender pays the store, so it posts to the books
      // like every other line of income. Reporting it as back gross without
      // banking it would leave the Finance tab's gross breakdown unable to
      // reconcile with its own net income — and reserve is one of the largest
      // income lines a real F&I department has. Recognized at the close rather
      // than at funding: the receivable lag is not modeled anywhere here, and
      // inventing one for this line alone would be a second accounting rule.
      if (reserveGross > 0) {
        economy.postRevenue(reserveGross, 'F&I: finance reserve');
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
        productGross,
        reserveGross,
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
        productGross,
        reserveGross,
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
