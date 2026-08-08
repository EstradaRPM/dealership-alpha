import {
  createDealEngine,
  computeMonthlyPayment,
  CreditTierCatalogSchema,
  loadCreditTiers,
  loadFniReserveConfig,
} from '../src/game/DealEngine';
import type {
  ClosedDealResult,
  CreditTierCatalog,
  FniReserveConfig,
} from '../src/game/DealEngine';
import { createEventBus } from '../src/game/EventBus';
import type { EventMap } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import type { CharacterProfile } from '../src/game/CareerProgression';

// Finance reserve (#365). The tier table holds the LENDER's buy rate; the
// customer is quoted `buyRate + markup`, and the store keeps a share of the
// discounted spread. These tests drive the whole thing through the barrel.

const CATALOG: CreditTierCatalog = {
  schemaVersion: 1,
  tiers: {
    A: { minScore: 720, buyRate: 0.059, markupCapPts: 0.0250, maxTerm: 84, ptiCap: 0.20, minDownPct: 0.00, ltvCeiling: 1.25 },
    B: { minScore: 680, buyRate: 0.089, markupCapPts: 0.0225, maxTerm: 75, ptiCap: 0.17, minDownPct: 0.05, ltvCeiling: 1.20 },
    C: { minScore: 620, buyRate: 0.129, markupCapPts: 0.0175, maxTerm: 72, ptiCap: 0.15, minDownPct: 0.10, ltvCeiling: 1.10 },
    // The subprime lender caps at half a point — below both markup targets, so
    // it is the tier that proves the clamp actually binds.
    D: { minScore:   0, buyRate: 0.189, markupCapPts: 0.0050, maxTerm: 66, ptiCap: 0.13, minDownPct: 0.20, ltvCeiling: 1.05 },
  },
};

const RESERVE: FniReserveConfig = {
  dealerSharePct: 0.75,
  ambientMarkupPts: 0.0075,
  balancedMarkupPts: 0.0175,
};

const VEHICLE = {
  id: 'v1',
  year: 2019,
  make: 'Generic',
  model: 'Sedan',
  purchasePrice: 12_000,
  reconCost: 500,
  daysInInventory: 20,
  reconStatus: 'complete',
  reconBucket: 'minor',
};

/**
 * Narrow stand-ins for the two collaborators `closeDeal` needs. The reserve
 * question is about money math, not about the lot, so the harness stays small
 * enough that a failure points at the calculation.
 */
function harness(opts: { deskStaffed?: boolean } = {}) {
  const bus = createEventBus();
  const closed: EventMap['deal:closed'][] = [];
  bus.subscribe('deal:closed', (p) => closed.push(p));
  const engine = createDealEngine({
    bus,
    catalog: CATALOG,
    reserveConfig: RESERVE,
    getFniDeskStaffed: () => opts.deskStaffed ?? false,
    inventory: {
      getLotVehicle: () => ({ ...VEHICLE }) as never,
      sellVehicle: () => undefined as never,
    } as never,
    economy: { postRevenue: () => undefined } as never,
  });
  return { engine, closed };
}

function closeFinanced(
  opts: {
    deskStaffed?: boolean;
    tier?: 'A' | 'B' | 'C' | 'D';
    loanAmount?: number;
    term?: number;
  } = {},
): { result: ClosedDealResult; payload: EventMap['deal:closed'] } {
  const { engine, closed } = harness({ deskStaffed: opts.deskStaffed });
  const tier = opts.tier ?? 'A';
  const quote = engine.quoteFinance(tier);
  const loanAmount = opts.loanAmount ?? 20_000;
  const result = engine.closeDeal({
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 24_000,
    paymentMethod: 'finance',
    downPayment: 4_000,
    loanAmount,
    term: opts.term ?? 60,
    apr: quote.customerRate,
    buyRate: quote.buyRate,
  });
  return { result, payload: closed[0] };
}

describe('credit-tier loader (#365)', () => {
  it('rejects a credit-tier file carrying the legacy apr key', () => {
    const stale = {
      schemaVersion: 1,
      tiers: {
        ...CATALOG.tiers,
        A: { ...CATALOG.tiers.A, apr: 0.059 },
      },
    };
    const parsed = CreditTierCatalogSchema.safeParse(stale);
    expect(parsed.success).toBe(false);
  });

  it('the shipped file states a buy rate and a markup cap for every tier', () => {
    const live = loadCreditTiers();
    for (const tier of ['A', 'B', 'C', 'D'] as const) {
      expect(live.tiers[tier].buyRate).toBeGreaterThan(0);
      expect(live.tiers[tier].markupCapPts).toBeGreaterThan(0);
    }
    // Subprime money is capped tightest — the most desperate customer is not
    // the most profitable one.
    expect(live.tiers.D.markupCapPts).toBeLessThan(live.tiers.A.markupCapPts);
  });
});

describe('DealEngine.quoteFinance (#365)', () => {
  it('a T1 store with no F&I desk earns the ambient markup only', () => {
    const { engine } = harness({ deskStaffed: false });
    const quote = engine.quoteFinance('A');
    expect(quote.markupPts).toBeCloseTo(RESERVE.ambientMarkupPts, 6);
    expect(quote.buyRate).toBeCloseTo(CATALOG.tiers.A.buyRate, 6);
    expect(quote.customerRate).toBeCloseTo(
      CATALOG.tiers.A.buyRate + RESERVE.ambientMarkupPts,
      6,
    );
  });

  it('an F&I desk works to the balanced target instead', () => {
    const { engine } = harness({ deskStaffed: true });
    expect(engine.quoteFinance('A').markupPts).toBeCloseTo(RESERVE.balancedMarkupPts, 6);
  });

  it('markup is capped per credit tier', () => {
    // D caps at 0.0050 — under both the ambient and the balanced target, so
    // neither posture can reach past the lender's program.
    const ambient = harness({ deskStaffed: false }).engine.quoteFinance('D');
    const desked = harness({ deskStaffed: true }).engine.quoteFinance('D');
    expect(ambient.markupPts).toBeCloseTo(CATALOG.tiers.D.markupCapPts, 6);
    expect(desked.markupPts).toBeCloseTo(CATALOG.tiers.D.markupCapPts, 6);
    expect(desked.customerRate).toBeCloseTo(
      CATALOG.tiers.D.buyRate + CATALOG.tiers.D.markupCapPts,
      6,
    );
  });
});

describe('DealEngine.closeDeal — the back end splits in two (#365)', () => {
  it('a financed close earns reserve on the rate spread', () => {
    const { result, payload } = closeFinanced();
    expect(result.reserveGross).toBeGreaterThan(0);
    expect(payload.reserveGross).toBeCloseTo(result.reserveGross, 6);
    // The quoted rate is the marked-up one, not the lender's cost of money.
    expect(result.apr).toBeGreaterThan(CATALOG.tiers.A.buyRate);
  });

  it('a cash deal earns no reserve', () => {
    const { engine, closed } = harness();
    const result = engine.closeDeal({
      customerId: 'c1',
      vehicleId: 'v1',
      agreedPrice: 24_000,
      paymentMethod: 'cash',
    });
    expect(result.reserveGross).toBe(0);
    expect(result.apr).toBe(0);
    expect(closed[0].reserveGross).toBe(0);
  });

  it('back gross is the sum of its two halves', () => {
    const { result, payload } = closeFinanced();
    expect(result.backGross).toBeCloseTo(result.productGross + result.reserveGross, 6);
    expect(payload.backGross).toBeCloseTo(payload.productGross + payload.reserveGross, 6);
    // Nothing attached on this deal, so the whole back end is reserve — which
    // is the case that would have read as a flat zero before the split.
    expect(result.productGross).toBe(0);
    expect(result.backGross).toBeGreaterThan(0);
  });

  it('a caller that names no buy rate quotes no spread and earns nothing', () => {
    const { engine } = harness();
    const result = engine.closeDeal({
      customerId: 'c1',
      vehicleId: 'v1',
      agreedPrice: 24_000,
      paymentMethod: 'finance',
      downPayment: 4_000,
      loanAmount: 20_000,
      term: 60,
      apr: 0.09,
    });
    expect(result.reserveGross).toBe(0);
  });

  it('a desked store out-earns an ambient one on the same structure', () => {
    const ambient = closeFinanced({ deskStaffed: false });
    const desked = closeFinanced({ deskStaffed: true });
    expect(desked.result.reserveGross).toBeGreaterThan(ambient.result.reserveGross);
  });
});

describe('DealEngine.computeReserve — honest amortization (#365)', () => {
  const { engine } = harness();

  it('is the present value of the spread, not a percentage of amount financed', () => {
    const amountFinanced = 20_000;
    const termMonths = 60;
    const buyRate = 0.059;
    const customerRate = buyRate + 0.0075;
    const reserve = engine.computeReserve({
      amountFinanced,
      termMonths,
      buyRate,
      customerRate,
    });

    // A flat "markup × balance × years × share" shortcut charges the full
    // opening balance for the whole term. Real paper amortizes down and the
    // spread is discounted back, so the honest number is materially smaller —
    // this is the assertion a percentage shortcut would fail.
    const flatShortcut =
      amountFinanced * (customerRate - buyRate) * (termMonths / 12) * RESERVE.dealerSharePct;
    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeLessThan(flatShortcut * 0.75);

    // And it never exceeds the extra money the customer actually pays.
    const extraPerMonth =
      computeMonthlyPayment({ price: amountFinanced, down: 0, termMonths }, customerRate)
        .monthlyPayment -
      computeMonthlyPayment({ price: amountFinanced, down: 0, termMonths }, buyRate)
        .monthlyPayment;
    expect(reserve).toBeLessThan(extraPerMonth * termMonths);
  });

  it('grows with the spread, the term and the principal', () => {
    const base = { amountFinanced: 20_000, termMonths: 60, buyRate: 0.059, customerRate: 0.0665 };
    expect(engine.computeReserve({ ...base, customerRate: 0.0765 })).toBeGreaterThan(
      engine.computeReserve(base),
    );
    expect(engine.computeReserve({ ...base, termMonths: 72 })).toBeGreaterThan(
      engine.computeReserve(base),
    );
    expect(engine.computeReserve({ ...base, amountFinanced: 30_000 })).toBeGreaterThan(
      engine.computeReserve(base),
    );
  });

  it('is zero without a spread, a principal or a term', () => {
    const base = { amountFinanced: 20_000, termMonths: 60, buyRate: 0.059, customerRate: 0.059 };
    expect(engine.computeReserve(base)).toBe(0);
    expect(engine.computeReserve({ ...base, customerRate: 0.0665, amountFinanced: 0 })).toBe(0);
    expect(engine.computeReserve({ ...base, customerRate: 0.0665, termMonths: 0 })).toBe(0);
  });

  it('reads its share and markup targets out of data/tunables.json', () => {
    const live = loadFniReserveConfig();
    expect(live.dealerSharePct).toBeGreaterThan(0);
    expect(live.dealerSharePct).toBeLessThanOrEqual(1);
    expect(live.balancedMarkupPts).toBeGreaterThan(live.ambientMarkupPts);
  });
});

// ── anti-orphan: the reserve reaches the assembled world ─────────────────────
//
// A module unit test cannot tell "wired" from "wired to nothing" (#363's
// lesson). These drive the real composition root: the engine has to arrive
// carrying the shipped reserve config and the live roster read, or F&I is a
// mechanic that exists only in this file.

describe('#365 finance reserve is live on the assembled world', () => {
  const PROFILE: CharacterProfile = {
    name: 'Ray Estrada',
    backstoryId: 'ex-mechanic',
    day1Modifier: {
      backstoryId: 'ex-mechanic',
      reconJudgmentBonus: 0.15,
      startingCreditLine: 0,
      startingCapitalBonus: 0,
      grudgesFlag: false,
    },
  };

  function freshWorld() {
    return createWorld({ bus: createEventBus(), masterSeed: 909, characterProfile: PROFILE });
  }

  it('a green store quotes above the lender buy rate on every tier', () => {
    const world = freshWorld();
    const live = loadCreditTiers();
    for (const tier of ['A', 'B', 'C', 'D'] as const) {
      const quote = world.dealEngine.quoteFinance(tier);
      expect(quote.buyRate).toBeCloseTo(live.tiers[tier].buyRate, 6);
      expect(quote.markupPts).toBeGreaterThan(0);
      expect(quote.markupPts).toBeLessThanOrEqual(live.tiers[tier].markupCapPts);
    }
  });

  it('a financed close on the real lot books reserve as part of back gross', () => {
    const world = freshWorld();
    // #296 parks a seed lot, so there is a real unit to sell on day one.
    const [vehicle] = world.inventory.getLotVehicles();
    expect(vehicle).toBeDefined();

    const quote = world.dealEngine.quoteFinance('B');
    const cashBefore = world.economy.cash;
    const result = world.dealEngine.closeDeal({
      customerId: 'live-1',
      vehicleId: vehicle.id,
      agreedPrice: 18_000,
      paymentMethod: 'finance',
      downPayment: 2_000,
      loanAmount: 16_000,
      term: 60,
      apr: quote.customerRate,
      buyRate: quote.buyRate,
    });

    expect(result.reserveGross).toBeGreaterThan(0);
    expect(result.backGross).toBeCloseTo(result.productGross + result.reserveGross, 6);
    // And the dashboard the Finance tab reads carries the split, not a lump.
    const kpi = world.kpiDashboard.getSnapshot();
    expect(kpi.reserveGross).toBeCloseTo(result.reserveGross, 6);
    expect(kpi.productGross).toBeCloseTo(result.productGross, 6);

    // Reserve is banked, not just reported. Gross the books never see would
    // leave the Finance tab's breakdown unable to reconcile with net income.
    expect(world.economy.cash - cashBefore).toBeCloseTo(
      18_000 + result.reserveGross,
      6,
    );
  });
});
