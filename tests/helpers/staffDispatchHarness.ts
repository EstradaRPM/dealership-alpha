import { createEventBus } from '../../src/game/EventBus';
import type { EventBus } from '../../src/game/EventBus';
import { createGameClock } from '../../src/game/GameClock';
import { createEconomy } from '../../src/game/Economy';
import { createDepartmentQueue } from '../../src/game/DepartmentQueue';
import {
  createStaffDispatch,
  loadStaffDispatchConfig,
  discountAcceptProbability,
  isDiscountDeskingUnlocked,
} from '../../src/game/StaffDispatch';
import type {
  StaffDispatchConfig,
  StaffDispatchCustomerSession,
  HeldTradeReview,
  HeldDiscountReview,
  StaffDispatchDeps,
} from '../../src/game/StaffDispatch';
import type { Inventory, LotVehicle } from '../../src/game/Inventory';
import { createDealEngine, loadCreditTiers } from '../../src/game/DealEngine';
import type { DealEngine } from '../../src/game/DealEngine';
import type { StaffOrg } from '../../src/game/StaffOrg';
import type {
  StaffWithComposites,
  Staff,
  Person,
  SalesVisit,
  CurrentVehicle,
} from '../../src/game/NPC';
import type { TradeConditionRead, TradeApprover } from '../../src/game/DealEngine';
import type { SalesProcessConfig } from '../../src/game/SalesProcess';

export const MASTER_SEED = 42;

// ── Helpers ─────────────────────────────────────────────────────────────────

export function makeStaff(
  effectiveness: number,
  id = `staff:mock:${effectiveness}`,
  roleId = 'salesperson',
  skills: Record<string, number> = {},
): StaffWithComposites {
  const plain: Staff = {
    id,
    role_id: roleId,
    trait_ids: [],
    skills,
    resources: { stamina: 80 },
    counters: { experience: 0, deals_closed: 0, days_employed: 0 },
  };
  Object.defineProperty(plain, 'effectiveness', { get: () => effectiveness, enumerable: false, configurable: true });
  Object.defineProperty(plain, 'trustworthiness', { get: () => 0.5, enumerable: false, configurable: true });
  return plain as StaffWithComposites;
}

export function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() { return roster; },
    headcountCap: Infinity,
    getSlots: (roleId: string) => ({ roleId, filled: 0, total: Infinity }),
    getSlotBoard: () => [],
    dailyPayroll: 0,
    getPayBoard: () => [],
    getSkillGrowth: () => [],
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    getRaiseRequests: () => [],
    getRaiseRequest: () => null,
    acceptRaise: () => {},
    refuseRaise: () => {},
    getPromotionOptions: () => [],
    promote: () => {},
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

export const BASE_CONFIG: StaffDispatchConfig = {
  minDrainPerTick: 0.15,
  maxDrainPerTick: 0.60,
  // Always escalate below-floor discounts in tests so the held-review path is
  // deterministic; the frequency gate gets its own dedicated test.
  discountEvent: {
    escalationRate: 1,
    minCounterAttempts: 1,
    maxCounterAttempts: 3,
    missPenalty: 0.15,
  },
};

export const DISCOUNT_EXCEPTION_CONFIG: SalesProcessConfig = {
  schemaVersion: 1,
  gates: ['GREET', 'QUALIFY', 'DEMO', 'NEGOTIATE'],
  rng: { seedNamespace: 'customer_pool.sales_gate', jitterBand: 0 },
  core: { skillWeight: 1, fitWeight: 0, easeWeight: 0 },
  meters: {
    GREET: { trust: 1, value: 1 },
    QUALIFY: { trust: 1, value: 1 },
    DEMO: { trust: 1, value: 1 },
    NEGOTIATE: { trust: 1, value: 1 },
  },
  walk: { trustCollapseFloor: 0, patienceFloor: -1 },
  nonnegotiables: { qualifyRevealThreshold: 0, tolerance: 1 },
  close: { buyThreshold: 0, softThreshold: 0, trustFloor: 0 },
  // Reservation model (#274): drives the wealth=15k customer (sensitivity 0.875)
  // to reservation = 10625·(1.0 − 0.875·0.2) ≈ 8766 — below the 9300 margin floor
  // (forces the discount-escalation branch) but above the 8500 cost (canAcceptAsk
  // stays true). valueLift 0 keeps the reservation independent of the meter run.
  price: {
    reservationBase: 1.0,
    valueLift: 0,
    sensitivityDrag: 0.2,
    minGross: 800,
    overageAllowed: 1500,
    framingWeight: 0,
  },
  heat: { stageWeight: 0.5, valueWeight: 0.3, trustWeight: 0.2 },
  retention: { trustWeight: 0.6, dealWeight: 0.4 },
  calibration: {
    positiveMin: 0,
    apatheticMin: 0,
    apatheticMax: 1,
    negativeDealMin: 0,
    negativeDealMax: 1,
  },
};

// ── Bundle + lot factories ──────────────────────────────────────────────────

export function makePerson(id: string, opts: Partial<Person> = {}): Person {
  return {
    id,
    trait_ids: [],
    wealth: 60_000,
    credit: 720,
    annualIncome: 60_000,
    int: 50,
    agreeableness: 60,
    brand_affinity: {},
    counters: { prior_visits: 0, prior_deals: 0, days_since_last_visit: 0 },
    ...opts,
  } as Person;
}

export function makeFinanceVisit(personId: string): SalesVisit {
  return {
    kind: 'sales',
    person_id: personId,
    // Low SPACED requirements ⇒ any sedan on the lot satisfies the seeded
    // nonnegotiable axes within tolerance. Tests focus on the close path,
    // not the nonnegotiable filter (that's SalesProcess's own coverage).
    preferences: {
      safety: 0.2,
      performance: 0.2,
      appearance: 0.2,
      comfort: 0.2,
      economy: 0.2,
      dependability: 0.2,
    },
    resources: { trust: 0.7, patience: 1.0 },
    paymentMethod: 'finance',
    downPaymentBehavior: 0.2,
  };
}

export function makeCashVisit(personId: string): SalesVisit {
  return { ...makeFinanceVisit(personId), paymentMethod: 'cash', downPaymentBehavior: undefined };
}

// The car the trade customer drove in on. loanPayoff overridable per test.
export function makeTradeVehicle(loanPayoff: number | null = null): CurrentVehicle {
  return {
    templateId: 'cv:civic',
    brand: 'vanda',
    make: 'Honda',
    model: 'Civic',
    year: 2016,
    mileage: 80_000,
    condition: 'average',
    category: 'sedan',
    loanPayoff,
  };
}

export function withTrade(visit: SalesVisit, allowanceAsk: number): SalesVisit {
  return { ...visit, hasTrade: true, allowanceAsk };
}

export function makeSession(
  personId: string,
  visit: SalesVisit,
  opts: Partial<Person> = {},
  archetypeLabel = 'Young Family',
): StaffDispatchCustomerSession {
  return {
    bundle: { person: makePerson(personId, opts), visit },
    visitArchetypeId: 'family_vehicle_search',
    archetypeLabel,
  };
}

export function makeLotVehicle(id: string, overrides: Partial<LotVehicle> = {}): LotVehicle {
  return {
    id,
    templateId: 'base_sedan',
    brand: 'generic',
    year: 2020,
    make: 'generic',
    model: 'Sedan',
    trim: 'LX',
    mileage: 30_000,
    condition: 'clean',
    conditionReport: 'clean',
    purchasePrice: 8_000,
    reconCost: 500,
    category: 'sedan',
    arrivalDay: 0,
    frontlineDay: 0,
    daysInInventory: 0,
    carryingCostToDate: 0,
    dailyCarryingCost: 0,
    aged: false,
    suggestedRetail: 10_625,
    askingPrice: 10_625,
    reconStatus: 'complete',
    reconEstimate: 500,
    reconRealizedCost: 500,
    reconDaysRemaining: 0,
    reconDaysTotal: 3,
    reconBucket: 'within',
    ...overrides,
  };
}

export interface ClosedDealPayload {
  customerId: string;
  agreedPrice: number;
  downPayment: number;
  loanAmount: number;
  paymentMethod: string;
  frontGross: number;
}

export interface TradeResolvedPayload {
  customerId: string;
  agreedAllowance: number;
  action: 'accept' | 'counter';
  hadCounter: boolean;
  currentVehicle: { loanPayoff: number | null };
}

export interface TradeEscalatedPayload {
  customerId: string;
  day: number;
  book: number;
  allowanceAsk: number;
  payoff: number;
  target: number;
  recommendedCounter: number;
  staffConfidence: number;
}

export interface DiscountEscalatedPayload {
  customerId: string;
  day: number;
  marketPrice: number;
  askingPrice: number;
  customerTargetPrice: number;
  salespersonCounter: number;
  minimumAcceptablePrice: number;
  frontGrossAtAsk: number;
  canAcceptAsk: boolean;
}

export interface Wired {
  bus: EventBus;
  inventory: Pick<Inventory, 'getLotVehicles' | 'getLotVehicle' | 'sellVehicle'>;
  dealEngine: DealEngine;
  sessions: Map<string, StaffDispatchCustomerSession>;
  events: Array<{
    outcome: string;
    reason?: string;
    grossImpact: number;
    customerId: string;
    matchQuality?: number;
    vehicleCategory?: 'sedan' | 'truck' | 'suv';
    archetypeLabel?: string;
    wantedCategory?: 'sedan' | 'truck' | 'suv';
    /** Residual warmth on a walk that got through the process (#180). */
    heat?: number;
  }>;
  closedDeals: ClosedDealPayload[];
  trades: TradeResolvedPayload[];
  escalations: TradeEscalatedPayload[];
  heldTradeReviews: HeldTradeReview[];
  discountEscalations: DiscountEscalatedPayload[];
  heldDiscountReviews: HeldDiscountReview[];
  inventorySold: string[];
}

// Fixed book seam so trade decisions are isolated from the live anchor engine.
export const TRADE_BOOK = 6_000;

export function setup(
  roster: StaffWithComposites[],
  config: StaffDispatchConfig = BASE_CONFIG,
  opts: {
    lot?: LotVehicle[];
    tradeConditionRead?: () => TradeConditionRead | null;
    tradeApprover?: () => TradeApprover | null;
    tradeEscalationOverride?: () => number;
    tradePolicyMultiplier?: () => number;
    salesProcessDeps?: StaffDispatchDeps['salesProcessDeps'];
    wantVectorBias?: StaffDispatchDeps['wantVectorBias'];
    attributeLeanForDay?: StaffDispatchDeps['attributeLeanForDay'];
    getDiscountDeskingUnlocked?: StaffDispatchDeps['getDiscountDeskingUnlocked'];
    getDeskingDrift?: StaffDispatchDeps['getDeskingDrift'];
    getTradeAllowanceDrift?: StaffDispatchDeps['getTradeAllowanceDrift'];
    /**
     * Defaults to never-attach so per-test gross math stays exact. Pass
     * `() => 0` to attach everything the structure allows (#152).
     */
    fniRng?: () => number;
    /**
     * F&I desk state (#365/#366). Omitted ⇒ no desk ⇒ the ambient markup, which
     * sits under the #367 deal-kill frontier — so the default harness never
     * loses a deal to the lender and every pre-#367 suite is unaffected. Pass
     * both to write contracts at a posture's markup.
     */
    getFniDeskStaffed?: () => boolean;
    getFniPostureMarkupPts?: () => number;
    /** The #367 deal-kill curve. Omitted ⇒ the shipped `fniDealKill` tunables. */
    fniDealKillConfig?: StaffDispatchDeps['fniDealKillConfig'];
    /**
     * The F&I desk (#369). Omitted ⇒ no finance office ⇒ the salesperson works
     * the menu on the two ungated products and the lender's frontier stays flat.
     */
    getFniDesk?: StaffDispatchDeps['getFniDesk'];
  } = {},
): Wired & { economy: ReturnType<typeof createEconomy> } {
  const bus = createEventBus();
  createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0 } });
  const queue = createDepartmentQueue({ bus });
  const lot = opts.lot ?? [makeLotVehicle('veh:1')];
  const lotMap = new Map(lot.map(v => [v.id, v]));
  const sold: string[] = [];
  // Stub Inventory: bypass the auction-generator wiring so the lot is exactly
  // what the test seeded. Satisfies the `Pick<Inventory, …>` deps StaffDispatch
  // + DealEngine need without dragging in the full module's clock subscribers.
  const inventoryStub = {
    getLotVehicles: () => [...lotMap.values()],
    getLotVehicle: (id: string) => lotMap.get(id),
    sellVehicle: (id: string) => {
      const v = lotMap.get(id);
      if (!v) throw new Error(`no veh ${id}`);
      lotMap.delete(id);
      sold.push(id);
      return v;
    },
  } satisfies Pick<Inventory, 'getLotVehicles' | 'getLotVehicle' | 'sellVehicle'>;

  const dealEngine = createDealEngine({
    bus,
    inventory: inventoryStub,
    economy,
    getFniDeskStaffed: opts.getFniDeskStaffed,
    getFniPostureMarkupPts: opts.getFniPostureMarkupPts,
  });
  const sessions = new Map<string, StaffDispatchCustomerSession>();
  const staffOrg = makeStaffOrg(roster);

  const events: Wired['events'] = [];
  bus.subscribe('staff:auto_resolved', (e) => events.push(e));
  const closedDeals: ClosedDealPayload[] = [];
  bus.subscribe('deal:closed', (e) => closedDeals.push(e as ClosedDealPayload));
  const trades: TradeResolvedPayload[] = [];
  bus.subscribe('trade:resolved', (e) => trades.push(e as TradeResolvedPayload));
  const escalations: TradeEscalatedPayload[] = [];
  bus.subscribe('trade:escalated', (e) => escalations.push(e as TradeEscalatedPayload));
  const heldTradeReviews: HeldTradeReview[] = [];
  const discountEscalations: DiscountEscalatedPayload[] = [];
  bus.subscribe('discount:escalated', (e) =>
    discountEscalations.push(e as DiscountEscalatedPayload),
  );
  const heldDiscountReviews: HeldDiscountReview[] = [];

  createStaffDispatch({
    bus,
    staffOrg,
    queue,
    masterSeed: MASTER_SEED,
    config,
    inventory: inventoryStub,
    dealEngine,
    creditTiers: loadCreditTiers(),
    getCustomerSession: (id) => sessions.get(id),
    salesProcessDeps: opts.salesProcessDeps,
    wantVectorBias: opts.wantVectorBias,
    attributeLeanForDay: opts.attributeLeanForDay,
    // Deterministic FNI: never attach (keeps backGross = 0 so per-test math is exact).
    fniRng: opts.fniRng ?? (() => 1.0),
    // #367: the contractual deal-kill curve.
    fniDealKillConfig: opts.fniDealKillConfig,
    // #369: the F&I desk that works the menu + the lender's frontier.
    getFniDesk: opts.getFniDesk,
    // #169: constant book seam + optional UCM condition read.
    tradeBookValueFn: () => TRADE_BOOK,
    getTradeConditionRead: opts.tradeConditionRead,
    // #170: escalation approver + per-slot override.
    getTradeApprover: opts.tradeApprover,
    getTradeEscalationOverride: opts.tradeEscalationOverride,
    // #172: per-slot trade-acquisition policy multiplier.
    getTradePolicyMultiplier: opts.tradePolicyMultiplier,
    onTradeReviewHeld: (held) => heldTradeReviews.push(held),
    onDiscountReviewHeld: (held) => heldDiscountReviews.push(held),
    // #290 (channel-desk M3): discount-desking gate. Omitted ⇒ locked (the
    // understaffed path); the cliff tests pass a getter to exercise both sides.
    getDiscountDeskingUnlocked: opts.getDiscountDeskingUnlocked,
    // #292 (channel-desk M5): execution-fidelity drift getters.
    getDeskingDrift: opts.getDeskingDrift,
    getTradeAllowanceDrift: opts.getTradeAllowanceDrift,
  });

  return {
    bus,
    inventory: inventoryStub,
    dealEngine,
    sessions,
    events,
    closedDeals,
    trades,
    escalations,
    heldTradeReviews,
    discountEscalations,
    heldDiscountReviews,
    inventorySold: sold,
    economy,
  };
}

export function admit(bus: EventBus, customerId: string, day = 1): void {
  bus.publish('capacity:customer_admitted', { day, customerId, label: 'Test' });
}
