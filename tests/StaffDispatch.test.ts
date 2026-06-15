import { createEventBus } from '../src/game/EventBus';
import type { EventBus } from '../src/game/EventBus';
import { createGameClock } from '../src/game/GameClock';
import { createEconomy } from '../src/game/Economy';
import { createDepartmentQueue } from '../src/game/DepartmentQueue';
import {
  createStaffDispatch,
  loadStaffDispatchConfig,
  discountAcceptProbability,
  isDiscountDeskingUnlocked,
} from '../src/game/StaffDispatch';
import type {
  StaffDispatchConfig,
  StaffDispatchCustomerSession,
  HeldTradeReview,
  HeldDiscountReview,
  StaffDispatchDeps,
} from '../src/game/StaffDispatch';
import type { Inventory, LotVehicle } from '../src/game/Inventory';
import { createDealEngine, loadCreditTiers } from '../src/game/DealEngine';
import type { DealEngine } from '../src/game/DealEngine';
import type { StaffOrg } from '../src/game/StaffOrg';
import type {
  StaffWithComposites,
  Staff,
  Person,
  SalesVisit,
  CurrentVehicle,
} from '../src/game/NPC';
import type { TradeConditionRead, TradeApprover } from '../src/game/DealEngine';
import type { SalesProcessConfig } from '../src/game/SalesProcess';

const MASTER_SEED = 42;

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStaff(
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

function makeStaffOrg(roster: StaffWithComposites[]): StaffOrg {
  return {
    get currentRoster() { return roster; },
    getCandidates: () => [],
    hire: () => {},
    fire: () => {},
    assessCondition: () => null,
    snapshot: () => ({ schemaVersion: 1 as const, currentDay: 1, roster: [] }),
    restore: () => {},
  };
}

const BASE_CONFIG: StaffDispatchConfig = {
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

const DISCOUNT_EXCEPTION_CONFIG: SalesProcessConfig = {
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
  calibration: {
    positiveMin: 0,
    apatheticMin: 0,
    apatheticMax: 1,
    negativeDealMin: 0,
    negativeDealMax: 1,
  },
};

// ── Bundle + lot factories ──────────────────────────────────────────────────

function makePerson(id: string, opts: Partial<Person> = {}): Person {
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

function makeFinanceVisit(personId: string): SalesVisit {
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

function makeCashVisit(personId: string): SalesVisit {
  return { ...makeFinanceVisit(personId), paymentMethod: 'cash', downPaymentBehavior: undefined };
}

// The car the trade customer drove in on. loanPayoff overridable per test.
function makeTradeVehicle(loanPayoff: number | null = null): CurrentVehicle {
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

function withTrade(visit: SalesVisit, allowanceAsk: number): SalesVisit {
  return { ...visit, hasTrade: true, allowanceAsk };
}

function makeSession(personId: string, visit: SalesVisit, opts: Partial<Person> = {}): StaffDispatchCustomerSession {
  return {
    bundle: { person: makePerson(personId, opts), visit },
    visitArchetypeId: 'family_vehicle_search',
  };
}

function makeLotVehicle(id: string, overrides: Partial<LotVehicle> = {}): LotVehicle {
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

interface ClosedDealPayload {
  customerId: string;
  agreedPrice: number;
  downPayment: number;
  loanAmount: number;
  paymentMethod: string;
  frontGross: number;
}

interface TradeResolvedPayload {
  customerId: string;
  agreedAllowance: number;
  action: 'accept' | 'counter';
  hadCounter: boolean;
  currentVehicle: { loanPayoff: number | null };
}

interface TradeEscalatedPayload {
  customerId: string;
  day: number;
  book: number;
  allowanceAsk: number;
  payoff: number;
  target: number;
  recommendedCounter: number;
  staffConfidence: number;
}

interface DiscountEscalatedPayload {
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

interface Wired {
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
const TRADE_BOOK = 6_000;

function setup(
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
  } = {},
): Wired & { economy: ReturnType<typeof createEconomy> } {
  const bus = createEventBus();
  createGameClock({ bus });
  const economy = createEconomy({ bus, startingCash: 50_000, config: { weeklyRent: 0, weeklyPayrollStub: 0 } });
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

  const dealEngine = createDealEngine({ bus, inventory: inventoryStub, economy });
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
    fniRng: () => 1.0,
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

function admit(bus: EventBus, customerId: string, day = 1): void {
  bus.publish('capacity:customer_admitted', { day, customerId, label: 'Test' });
}

// ── No staff ─────────────────────────────────────────────────────────────────

describe('StaffDispatch — no staff', () => {
  it('no staff on roster ⇒ no auto_resolved, item stays in queue', () => {
    const { bus, events } = setup([]);
    admit(bus, 'cust:1');
    expect(events).toHaveLength(0);
  });
});

// ── No customer session ──────────────────────────────────────────────────────

describe('StaffDispatch — graceful no-session', () => {
  it('emits no_sale with reason=no_session when bundle lookup misses', () => {
    const { bus, events } = setup([makeStaff(0.8)]);
    admit(bus, 'cust:ghost');
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_session');
  });
});

// ── Real-close path ─────────────────────────────────────────────────────────

describe('StaffDispatch — real close path (#147)', () => {
  it('finance customer + matching vehicle ⇒ deal:closed fires with non-zero frontGross + lot decrements', () => {
    const { bus, sessions, events, closedDeals, inventorySold, inventory, economy } = setup([
      makeStaff(0.9),
    ]);
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    const cashBefore = economy.cash;

    admit(bus, 'cust:1');

    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('closed');
    expect(events[0].grossImpact).toBeGreaterThan(0);
    expect(closedDeals).toHaveLength(1);
    const ev = closedDeals[0] as { frontGross: number; paymentMethod: string };
    expect(ev.frontGross).toBeGreaterThan(0);
    expect(ev.paymentMethod).toBe('finance');
    expect(inventorySold).toEqual(['veh:1']);
    expect(inventory.getLotVehicles()).toHaveLength(0);
    // Cash delta tracks the real DealEngine posting, not a synthetic poke.
    expect(economy.cash - cashBefore).toBeGreaterThan(0);
  });

  it('a closed deal carries the inventory-buyer match quality on staff:auto_resolved (#199)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)]);
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events).toHaveLength(1);
    expect(events[0].outcome).toBe('closed');
    // The want-axis fit of the matched unit rides the close event so the loop's
    // match-payoff beat can threshold it without reaching into SalesProcess.
    expect(typeof events[0].matchQuality).toBe('number');
    expect(events[0].matchQuality).toBeGreaterThanOrEqual(0);
    expect(events[0].matchQuality).toBeLessThanOrEqual(1);
  });

  it('a no_sale carries no match quality (#199)', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      lot: [],
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].matchQuality).toBeUndefined();
  });

  it('season demand lean (#231 S2): wantVectorBias runs on the resolution want-vector', () => {
    const seen: Array<{ spaced: Record<string, number>; day: number }> = [];
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      // Identity bias that records the call: proves the seam is live in the
      // auto-resolve match path (the createWorld test asserts it's wired to
      // Weather.leanWantVector; the Weather test asserts the lean transform).
      wantVectorBias: (spaced, day) => {
        seen.push({ spaced: { ...spaced }, day });
        return spaced;
      },
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1', 1);
    expect(events[0].outcome).toBe('closed');
    expect(seen).toHaveLength(1);
    expect(seen[0].day).toBe(1);
    // The biased vector is the visit's own preference want-vector.
    expect(seen[0].spaced).toEqual({
      safety: 0.2,
      performance: 0.2,
      appearance: 0.2,
      comfort: 0.2,
      economy: 0.2,
      dependability: 0.2,
    });
  });

  it('attribute lean (#231 S4): attributeLeanForDay runs for the resolution day', () => {
    const seenDays: number[] = [];
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, {
      // Records the call: proves the attribute-lean seam is live in the
      // auto-resolve match path (the createWorld test asserts it's wired to
      // Weather.attributeLeanForDay; the match-tilt test asserts the effect).
      attributeLeanForDay: (day) => {
        seenDays.push(day);
        return { winterCapability: 0.3 };
      },
    });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1', 1);
    expect(events[0].outcome).toBe('closed');
    expect(seenDays).toEqual([1]);
  });

  it('per-tick drain: N customers + < N inventory closes exactly inventory.length', () => {
    const lot = [makeLotVehicle('veh:1'), makeLotVehicle('veh:2')];
    const { bus, sessions, events, inventorySold } = setup(
      [makeStaff(0.95)],
      BASE_CONFIG,
      { lot },
    );
    for (let i = 0; i < 5; i++) {
      const id = `cust:${i}`;
      sessions.set(id, makeSession(id, makeFinanceVisit(id)));
      admit(bus, id, 1);
    }
    const closed = events.filter(e => e.outcome === 'closed');
    const noFit = events.filter(e => e.outcome === 'no_sale' && e.reason === 'no_fit');
    expect(closed).toHaveLength(2);
    expect(inventorySold).toHaveLength(2);
    expect(noFit).toHaveLength(3);
  });

  it('empty lot ⇒ no_sale reason=no_fit', () => {
    const { bus, sessions, events } = setup([makeStaff(0.9)], BASE_CONFIG, { lot: [] });
    sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(events[0].reason).toBe('no_fit');
  });

  it('SalesProcess patience-drain walk ⇒ no_sale reason=patience_drain', () => {
    const { bus, sessions, events } = setup([makeStaff(0.05)]); // very weak skill → patience drains fast
    const visit = makeFinanceVisit('cust:1');
    // Bottom out starting patience so the first weak gate trips the floor.
    const lowPatience: SalesVisit = { ...visit, resources: { ...visit.resources, patience: 0.05 } };
    sessions.set('cust:1', makeSession('cust:1', lowPatience));
    admit(bus, 'cust:1');
    expect(events[0].outcome).toBe('no_sale');
    expect(['patience_drain', 'trust_collapse', 'demo_nonnegotiable_miss']).toContain(events[0].reason);
  });
});

describe('StaffDispatch — discount escalation (#222)', () => {
  const discountDeps = {
    config: DISCOUNT_EXCEPTION_CONFIG,
    bookValueFn: () => 20_000,
  };

  it('no sales manager ⇒ discount:escalated fires with payload and held close', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      salesProcessDeps: discountDeps,
    });
    w.sessions.set(
      'cust:discount',
      makeSession('cust:discount', makeFinanceVisit('cust:discount'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );

    admit(w.bus, 'cust:discount');

    expect(w.discountEscalations).toHaveLength(1);
    expect(w.heldDiscountReviews).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(0);
    expect(w.discountEscalations[0]).toMatchObject({
      customerId: 'cust:discount',
      day: 1,
      canAcceptAsk: true,
    });
    // Spine framing (#281): list (ask) ≥ salesperson's failed counter ≥ target,
    // the counter positioned by salesperson skill.
    const review = w.discountEscalations[0];
    expect(review.askingPrice).toBeGreaterThanOrEqual(review.salespersonCounter);
    expect(review.salespersonCounter).toBeGreaterThanOrEqual(
      review.customerTargetPrice,
    );

    const result = w.heldDiscountReviews[0].decide({ kind: 'accept_ask' });

    expect(result.status).toBe('closed');
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:discount',
      outcome: 'closed',
    });
    // accept_ask meets the customer at their target — a guaranteed close.
    expect(w.closedDeals[0].agreedPrice).toBe(review.customerTargetPrice);
  });

  // Channel-desk M3 (#290): the UCM desks below-floor discounts only when its
  // `t_o_closing` skill clears the gate (resolved at the composition root and
  // passed in as `getDiscountDeskingUnlocked`). The cliff: unlocked ⇒ auto-desk;
  // below the gate ⇒ the understaffed path (escalate/walk), even with a UCM on
  // staff. The roster→skill distillation is exercised at the createWorld level;
  // here we drive the gate getter directly to assert both sides of the cliff.
  it('desking unlocked ⇒ UCM auto-resolves the discount exception', () => {
    const w = setup(
      [
        makeStaff(0.9, 'staff:sales'),
        makeStaff(1.0, 'staff:used-car-manager', 'used-car-manager', {
          t_o_closing: 75,
        }),
      ],
      BASE_CONFIG,
      { salesProcessDeps: discountDeps, getDiscountDeskingUnlocked: () => true },
    );
    w.sessions.set(
      'cust:manager-discount',
      makeSession(
        'cust:manager-discount',
        makeFinanceVisit('cust:manager-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );

    admit(w.bus, 'cust:manager-discount');

    expect(w.discountEscalations).toHaveLength(0);
    expect(w.heldDiscountReviews).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:manager-discount',
      outcome: 'closed',
    });
  });

  it('UCM below the desking gate ⇒ understaffed path (escalates, not auto-desked)', () => {
    // A green UCM is on staff but its `t_o_closing` is under the threshold, so
    // the desk can't yet act — the deal falls through to the understaffed
    // escalation (escalationRate is 1 in DISCOUNT_EXCEPTION_CONFIG).
    const w = setup(
      [
        makeStaff(0.9, 'staff:sales'),
        makeStaff(1.0, 'staff:used-car-manager', 'used-car-manager', {
          t_o_closing: 40,
        }),
      ],
      BASE_CONFIG,
      { salesProcessDeps: discountDeps, getDiscountDeskingUnlocked: () => false },
    );
    w.sessions.set(
      'cust:green-ucm-discount',
      makeSession(
        'cust:green-ucm-discount',
        makeFinanceVisit('cust:green-ucm-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );

    admit(w.bus, 'cust:green-ucm-discount');

    // Below the gate the deal is held for the player, not auto-desked.
    expect(w.discountEscalations).toHaveLength(1);
    expect(w.heldDiscountReviews).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(0);
  });

  it('player decline records discount_player_declined, distinct from no_close', () => {
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      salesProcessDeps: discountDeps,
    });
    w.sessions.set(
      'cust:decline-discount',
      makeSession(
        'cust:decline-discount',
        makeFinanceVisit('cust:decline-discount'),
        { wealth: 15_000, agreeableness: 100 },
      ),
    );
    admit(w.bus, 'cust:decline-discount');

    const result = w.heldDiscountReviews[0].decide({ kind: 'decline' });

    expect(result).toEqual({ status: 'abandoned' });
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:decline-discount',
      outcome: 'no_sale',
      reason: 'discount_player_declined',
    });
  });

  it('frequency gate (rate 0) suppresses the event — the up just walks', () => {
    const w = setup(
      [makeStaff(0.9)],
      { ...BASE_CONFIG, discountEvent: { ...BASE_CONFIG.discountEvent, escalationRate: 0 } },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:no-escalate',
      makeSession('cust:no-escalate', makeFinanceVisit('cust:no-escalate'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );

    admit(w.bus, 'cust:no-escalate');

    // No interactive event, no held review — the below-floor up simply no-sales.
    expect(w.discountEscalations).toHaveLength(0);
    expect(w.heldDiscountReviews).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:no-escalate',
      outcome: 'no_sale',
      reason: 'no_close',
    });
  });

  it('a rejected counter burns an attempt; exhausting them walks the customer', () => {
    // One attempt allowed: a single swing-and-a-miss ends it.
    const w = setup(
      [makeStaff(0.9)],
      {
        ...BASE_CONFIG,
        discountEvent: {
          ...BASE_CONFIG.discountEvent,
          minCounterAttempts: 1,
          maxCounterAttempts: 1,
        },
      },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:exhaust',
      makeSession('cust:exhaust', makeFinanceVisit('cust:exhaust'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(w.bus, 'cust:exhaust');

    const review = w.discountEscalations[0];
    // A price far above their target is a sure rejection.
    const result = w.heldDiscountReviews[0].decide({
      kind: 'propose_counter',
      amount: review.askingPrice + 50_000,
    });

    expect(result).toEqual({ status: 'abandoned' });
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:exhaust',
      outcome: 'no_sale',
      reason: 'discount_haggle_exhausted',
    });
  });

  it('with attempts to spare, a rejected counter keeps the review open', () => {
    const w = setup(
      [makeStaff(0.9)],
      {
        ...BASE_CONFIG,
        discountEvent: {
          ...BASE_CONFIG.discountEvent,
          minCounterAttempts: 3,
          maxCounterAttempts: 3,
        },
      },
      { salesProcessDeps: discountDeps },
    );
    w.sessions.set(
      'cust:haggle',
      makeSession('cust:haggle', makeFinanceVisit('cust:haggle'), {
        wealth: 15_000,
        agreeableness: 100,
      }),
    );
    admit(w.bus, 'cust:haggle');

    const review = w.discountEscalations[0];
    const result = w.heldDiscountReviews[0].decide({
      kind: 'propose_counter',
      amount: review.askingPrice + 50_000,
    });

    expect(result.status).toBe('counter_rejected');
    if (result.status === 'counter_rejected') {
      expect(result.attemptsRemaining).toBe(2);
      // The just-rejected wild over-ask reads as a near-zero acceptance prob —
      // the headline number the modal surfaces (#287).
      expect(result.acceptProb).toBeGreaterThanOrEqual(0);
      expect(result.acceptProb).toBeLessThan(0.05);
    }
    // Review stays open — no terminal event yet.
    expect(w.events).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
  });
});

// ── Acceptance-heat pure helper (#287) ───────────────────────────────────────

describe('discountAcceptProbability — pure acceptance-heat read', () => {
  it('is a certainty at or below the customer target', () => {
    expect(discountAcceptProbability(20_000, 20_000, 0.5, 0, 0.15)).toBe(1);
    expect(discountAcceptProbability(20_000, 18_000, 0.5, 0, 0.15)).toBe(1);
  });

  it('falls off as the counter climbs above the target', () => {
    const near = discountAcceptProbability(20_000, 20_500, 0.5, 0, 0.15);
    const far = discountAcceptProbability(20_000, 23_000, 0.5, 0, 0.15);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(1);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  it('steepens with price-sensitivity and cools with prior misses', () => {
    const base = discountAcceptProbability(20_000, 21_000, 0.2, 0, 0.15);
    const sensitive = discountAcceptProbability(20_000, 21_000, 0.9, 0, 0.15);
    const cooled = discountAcceptProbability(20_000, 21_000, 0.2, 2, 0.15);
    expect(sensitive).toBeLessThan(base);
    expect(cooled).toBeLessThan(base);
  });

  it('clamps to the unit interval', () => {
    const p = discountAcceptProbability(20_000, 60_000, 0.9, 5, 0.15);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

// ── Hold-floor: staffed up always worked ────────────────────────────────────

describe('StaffDispatch — hold-floor (#134) preserved', () => {
  it('a staffed, non-exception up is always worked (queue drained), regardless of skill', () => {
    const { bus, events } = setup([makeStaff(0.01)]);
    admit(bus, 'cust:1');
    // No session ⇒ no_sale w/ no_session, but the up was *worked* (resolver fired).
    expect(events).toHaveLength(1);
  });
});

// ── Config ──────────────────────────────────────────────────────────────────

describe('StaffDispatch — config', () => {
  it('loadStaffDispatchConfig returns valid tunables (no dead fields)', () => {
    const config = loadStaffDispatchConfig();
    expect(config.minDrainPerTick).toBeGreaterThanOrEqual(0);
    expect(config.maxDrainPerTick).toBeGreaterThan(0);
    // Dead fields are gone.
    expect('baseAutoGross' in config).toBe(false);
    expect('minCloseRate' in config).toBe(false);
    expect('maxCloseRate' in config).toBe(false);
    expect('minGrossModifier' in config).toBe(false);
    // Dramatic-case exception flags removed with the dead HandPlay path (#275).
    expect('exceptionFlagRates' in config).toBe(false);
    expect('gmExceptionFlagRates' in config).toBe(false);
  });
});

// ── Trade resolution (#169) ──────────────────────────────────────────────────

// With the default null condition read: confidence 0 ⇒ defensiveFactor
// 1 − 0.15 = 0.85 ⇒ target = TRADE_BOOK × 0.85 = 5_100.
const TRADE_TARGET = 5_100;

describe('StaffDispatch — routine trade resolution (#169)', () => {
  it('routine accept: trade:resolved fires before deal:closed; allowance nets into the note', () => {
    // Baseline: same customer/seed, no trade.
    const base = setup([makeStaff(0.9)]);
    base.sessions.set('cust:1', makeSession('cust:1', makeFinanceVisit('cust:1')));
    admit(base.bus, 'cust:1');
    expect(base.closedDeals).toHaveLength(1);
    const baseDeal = base.closedDeals[0];

    // Same customer/seed, now with an in-band trade (ask ≤ target ⇒ accept).
    const w = setup([makeStaff(0.9)]);
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');

    // Deal still closes.
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(1);

    // trade:resolved fired with the accepted ask, no counter.
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('accept');
    expect(w.trades[0].hadCounter).toBe(false);
    expect(w.trades[0].agreedAllowance).toBe(5_000);

    // Price/down are unchanged by the trade (resolution runs after close); the
    // net equity (5_000, no payoff) comes straight off the financed amount.
    const deal = w.closedDeals[0];
    expect(deal.agreedPrice).toBe(baseDeal.agreedPrice);
    expect(deal.downPayment).toBeCloseTo(baseDeal.downPayment, 5);
    expect(deal.loanAmount).toBeCloseTo(baseDeal.loanAmount - 5_000, 5);
  });

  it('routine counter: customer takes a held counter below their ask', () => {
    const w = setup([makeStaff(0.9)]);
    // ask 6_000: above target (5_100) but inside the routine gap (≤ 25%).
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 6_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');

    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('counter');
    expect(w.trades[0].hadCounter).toBe(true);
    expect(w.trades[0].agreedAllowance).toBeLessThan(6_000);
    expect(w.trades[0].agreedAllowance).toBeGreaterThanOrEqual(TRADE_TARGET);
    expect(w.events.filter(e => e.outcome === 'closed')).toHaveLength(1);
  });

  it('cash deal: net equity reduces the cash brought to close', () => {
    const base = setup([makeStaff(0.9)]);
    base.sessions.set('cust:1', makeSession('cust:1', makeCashVisit('cust:1')));
    admit(base.bus, 'cust:1');
    const baseDeal = base.closedDeals[0];
    expect(baseDeal.paymentMethod).toBe('cash');

    const w = setup([makeStaff(0.9)]);
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeCashVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    const deal = w.closedDeals[0];
    expect(deal.loanAmount).toBe(0);
    expect(deal.downPayment).toBeCloseTo(baseDeal.downPayment - 5_000, 5);
  });

  it('negative equity (allowance < payoff, small overhang) ⇒ no_sale reason=trade_negative_equity, no deal', () => {
    const w = setup([makeStaff(0.9)]);
    // ask 5_000 ≤ target ⇒ routine accept; payoff 5_500 is within the escalation
    // margin (target×1.1 = 5_610) so it stays routine, but the buyer is underwater.
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 5_000), {
        currentVehicle: makeTradeVehicle(5_500),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.trades).toHaveLength(0);
    expect(w.escalations).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events[0].outcome).toBe('no_sale');
    expect(w.events[0].reason).toBe('trade_negative_equity');
  });

  it('a UCM condition read lifts the target (higher confidence ⇒ less defensive)', () => {
    // High-confidence read ⇒ defensiveFactor 1 ⇒ target = TRADE_BOOK (6_000).
    // An ask of 6_000 now accepts rather than drawing a counter.
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradeConditionRead: () => ({ confidence: 1.0 }),
    });
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 6_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('accept');
    expect(w.trades[0].agreedAllowance).toBe(6_000);
  });
});

// ── Manager-attention escalation (#170) ──────────────────────────────────────

describe('StaffDispatch — trade escalation (#170)', () => {
  // ask 9_000: above target 5_100 and beyond the routine gap ⇒ unusual.
  const unusualAsk = (w: Wired) =>
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 9_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );

  it('no manager on staff ⇒ trade:escalated fires with the overlay payload, deal held', () => {
    const w = setup([makeStaff(0.9)]);
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    // Deal is held for the player — no close, no trade:resolved, no no_sale.
    expect(w.closedDeals).toHaveLength(0);
    expect(w.trades).toHaveLength(0);
    expect(w.events).toHaveLength(0);
    // The overlay gets everything it needs.
    expect(w.escalations).toHaveLength(1);
    const e = w.escalations[0];
    expect(e.customerId).toBe('cust:1');
    expect(e.allowanceAsk).toBe(9_000);
    expect(e.book).toBe(TRADE_BOOK);
    expect(e.target).toBe(TRADE_TARGET);
    expect(e.recommendedCounter).toBeGreaterThanOrEqual(TRADE_TARGET);
    expect(e.recommendedCounter).toBeLessThanOrEqual(9_000);
  });

  it('player accepting the staff counter completes the held close through the trade path', () => {
    const w = setup([makeStaff(0.9)]);
    unusualAsk(w);
    admit(w.bus, 'cust:1');

    expect(w.heldTradeReviews).toHaveLength(1);
    const result = w.heldTradeReviews[0].decide({ kind: 'accept_counter' });

    expect(result).toEqual({
      status: 'closed',
      agreedAllowance: w.trades[0].agreedAllowance,
    });
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0]).toMatchObject({
      customerId: 'cust:1',
      action: 'counter',
      hadCounter: true,
    });
    expect(w.closedDeals).toHaveLength(1);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]).toMatchObject({
      customerId: 'cust:1',
      outcome: 'closed',
    });
  });

  it('a GM resolves the escalated trade silently ⇒ deal closes, trade:resolved, no escalation', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: gm });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(1);
    expect(w.trades[0].action).toBe('counter');
    expect(w.closedDeals).toHaveLength(1);
  });

  it('a UCM approver also resolves silently when no GM is present', () => {
    const ucm: () => TradeApprover = () => ({ role: 'ucm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: ucm });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(1);
    expect(w.closedDeals).toHaveLength(1);
  });

  it('per-slot override forces player review even with a GM on staff', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.6, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradeApprover: gm,
      tradeEscalationOverride: () => 8_000, // ask 9_000 > 8_000 ⇒ escalate to player
    });
    unusualAsk(w);
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(1);
    expect(w.trades).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
  });

  it('a manager who declines beyond the extended window ⇒ no_sale reason=trade_manager_declined', () => {
    const gm: () => TradeApprover = () => ({ role: 'gm', skill: { effectiveness: 0.1, trustworthiness: 0.5 } });
    const w = setup([makeStaff(0.9)], BASE_CONFIG, { tradeApprover: gm });
    // ask 9_000 = target 5_100 × 1.76 — beyond the manager window (×1.6) + weak closer.
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), 9_000), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );
    admit(w.bus, 'cust:1');
    expect(w.escalations).toHaveLength(0);
    expect(w.trades).toHaveLength(0);
    expect(w.closedDeals).toHaveLength(0);
    expect(w.events[0].outcome).toBe('no_sale');
    expect(w.events[0].reason).toBe('trade_manager_declined');
  });
});

// ── Trade-acquisition policy multiplier (#172) ────────────────────────────────

describe('StaffDispatch — trade-policy multiplier wiring (#172)', () => {
  // Default null read ⇒ defensiveFactor 0.85, so target = TRADE_BOOK × policy ×
  // 0.85. Market (1.0) ⇒ 5_100; aggressive (1.1) ⇒ 5_610; conservative (0.92)
  // ⇒ 4_692. The getter must reach resolveTradeIn, shifting the accept/counter/
  // escalation boundary.
  const tradeAsk = (w: Wired, ask: number) =>
    w.sessions.set(
      'cust:1',
      makeSession('cust:1', withTrade(makeFinanceVisit('cust:1'), ask), {
        currentVehicle: makeTradeVehicle(null),
      }),
    );

  it('aggressive policy lifts the target so a market-counter ask is accepted at the ask', () => {
    // ask 5_600: above market target (5_100 → counter) but below the aggressive
    // target (5_610 → accept).
    const market = setup([makeStaff(0.9)]);
    tradeAsk(market, 5_600);
    admit(market.bus, 'cust:1');
    expect(market.trades[0].action).toBe('counter');
    expect(market.trades[0].hadCounter).toBe(true);
    expect(market.trades[0].agreedAllowance).toBeLessThan(5_600);

    const aggressive = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradePolicyMultiplier: () => 1.1,
    });
    tradeAsk(aggressive, 5_600);
    admit(aggressive.bus, 'cust:1');
    expect(aggressive.trades[0].action).toBe('accept');
    expect(aggressive.trades[0].hadCounter).toBe(false);
    expect(aggressive.trades[0].agreedAllowance).toBe(5_600);
  });

  it('conservative policy lowers the target so a market-routine ask escalates instead', () => {
    // ask 6_300: inside the market routine band (≤ 5_100 × 1.25 = 6_375) but
    // beyond the conservative band (≤ 4_692 × 1.25 = 5_865). No approver ⇒ the
    // conservative trade routes to the player overlay.
    const market = setup([makeStaff(0.9)]);
    tradeAsk(market, 6_300);
    admit(market.bus, 'cust:1');
    expect(market.trades).toHaveLength(1);
    expect(market.escalations).toHaveLength(0);

    const conservative = setup([makeStaff(0.9)], BASE_CONFIG, {
      tradePolicyMultiplier: () => 0.92,
    });
    tradeAsk(conservative, 6_300);
    admit(conservative.bus, 'cust:1');
    expect(conservative.trades).toHaveLength(0);
    expect(conservative.escalations).toHaveLength(1);
  });
});

describe('isDiscountDeskingUnlocked (#290 channel-desk M3)', () => {
  it('is locked with no UCM (null skill), regardless of threshold', () => {
    expect(isDiscountDeskingUnlocked(null, 60)).toBe(false);
    expect(isDiscountDeskingUnlocked(null, 0)).toBe(false);
  });

  it('gates hard at the threshold — the earned-stripes cliff', () => {
    expect(isDiscountDeskingUnlocked(59, 60)).toBe(false);
    expect(isDiscountDeskingUnlocked(60, 60)).toBe(true);
    expect(isDiscountDeskingUnlocked(75, 60)).toBe(true);
  });
});
