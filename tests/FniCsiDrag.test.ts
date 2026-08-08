import {
  createDealEngine,
  loadCreditTiers,
  loadFniCsiDragConfig,
  loadFniDealKillConfig,
  loadFniReserveConfig,
  markupSatisfactionHit,
  resolveFniPostureMarkupPts,
} from '../src/game/DealEngine';
import type { CreditTierCatalog, FniCsiDragConfig, FniReserveConfig } from '../src/game/DealEngine';
import { createEventBus } from '../src/game/EventBus';
import type { EventMap } from '../src/game/EventBus';
import { createReputation } from '../src/game/Reputation';
import { TunablesSchema } from '../src/game/data';

// CSI drag (#368, grill Q3 secondary) — the second, SLOWER tooth on the F&I
// posture. Deal-kill (#367) costs the store the deal it was working; this costs
// it the next customer, because satisfaction already feeds arrival rates. The
// hit is on the rate MARKUP, never on the products.

const DRAG: FniCsiDragConfig = {
  fairMarkupPts: 0.0175,
  fullDragRangePts: 0.0100,
  maxSatisfactionHit: -1.5,
};

const RESERVE: FniReserveConfig = {
  dealerSharePct: 0.75,
  ambientMarkupPts: 0.0075,
};

const BUY_RATE = 0.059;

const CATALOG: CreditTierCatalog = {
  schemaVersion: 1,
  tiers: {
    A: { minScore: 720, buyRate: BUY_RATE, markupCapPts: 0.0250, maxTerm: 84, ptiCap: 0.20, minDownPct: 0.00, ltvCeiling: 1.25 },
    B: { minScore: 680, buyRate: 0.089, markupCapPts: 0.0225, maxTerm: 75, ptiCap: 0.17, minDownPct: 0.05, ltvCeiling: 1.20 },
    C: { minScore: 620, buyRate: 0.129, markupCapPts: 0.0175, maxTerm: 72, ptiCap: 0.15, minDownPct: 0.10, ltvCeiling: 1.10 },
    D: { minScore:   0, buyRate: 0.189, markupCapPts: 0.0100, maxTerm: 66, ptiCap: 0.13, minDownPct: 0.20, ltvCeiling: 1.05 },
  },
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
 * The lot and the ledger are stand-ins: the drag is a question about the rate a
 * contract was written at, so a failure here should point at the markup and not
 * at inventory bookkeeping.
 */
function harness() {
  const bus = createEventBus();
  const hits: EventMap['reputation:satisfaction_hit'][] = [];
  bus.subscribe('reputation:satisfaction_hit', (p) => hits.push(p));
  const engine = createDealEngine({
    bus,
    catalog: CATALOG,
    reserveConfig: RESERVE,
    csiDragConfig: DRAG,
    getCurrentDay: () => 7,
    inventory: {
      getLotVehicle: () => ({ ...VEHICLE }) as never,
      sellVehicle: () => undefined as never,
    } as never,
    economy: { postRevenue: () => undefined } as never,
  });
  return { bus, engine, hits };
}

/** Closes a financed deal quoted at `buyRate + markupPts`. */
function closeAtMarkup(
  markupPts: number,
  buyRate = BUY_RATE,
): EventMap['reputation:satisfaction_hit'][] {
  const { engine, hits } = harness();
  engine.closeDeal({
    customerId: 'c1',
    vehicleId: 'v1',
    agreedPrice: 24_000,
    paymentMethod: 'finance',
    downPayment: 4_000,
    loanAmount: 20_000,
    term: 60,
    apr: buyRate + markupPts,
    buyRate,
  });
  return hits;
}

describe('the markup drag curve (#368)', () => {
  it('is zero at and under the fair line, and never positive', () => {
    expect(markupSatisfactionHit(0, DRAG)).toBe(0);
    expect(markupSatisfactionHit(RESERVE.ambientMarkupPts, DRAG)).toBe(0);
    expect(markupSatisfactionHit(DRAG.fairMarkupPts, DRAG)).toBe(0);
  });

  it('ramps linearly past the fair line and then goes flat', () => {
    const half = markupSatisfactionHit(DRAG.fairMarkupPts + DRAG.fullDragRangePts / 2, DRAG);
    expect(half).toBeCloseTo(DRAG.maxSatisfactionHit / 2, 10);

    const full = markupSatisfactionHit(DRAG.fairMarkupPts + DRAG.fullDragRangePts, DRAG);
    expect(full).toBeCloseTo(DRAG.maxSatisfactionHit, 10);

    // Flat past the end of the ramp for the same reason the kill curve is: a
    // delta that kept growing would be a wall, not a trade-off.
    const way = markupSatisfactionHit(DRAG.fairMarkupPts + DRAG.fullDragRangePts * 10, DRAG);
    expect(way).toBeCloseTo(DRAG.maxSatisfactionHit, 10);
  });

  it('the shipped file draws its fair line on the same frontier the lender does', () => {
    // Both teeth measure how far past a fair markup the contract was written, so
    // the player learns ONE frontier to read the dial rather than two. They are
    // separate keys because they are separately measured, and because #369 moves
    // the lender's frontier with staff skill.
    expect(loadFniCsiDragConfig().fairMarkupPts).toBe(loadFniDealKillConfig().safeFrontierPts);
    expect(loadFniCsiDragConfig().maxSatisfactionHit).toBeLessThan(0);
  });

  it('the shipped Balanced posture takes no hit on any credit tier', () => {
    // The byte-identity lock. The markup being judged is the one the contract
    // was written at, and the only honest source for it is
    // `customerRate − buyRate` — a subtraction that does NOT round-trip in
    // binary floating point (Tier C's buy rate plus 1.75 points comes back
    // 1.6e-17 over the line). Without the representation guard in `csiDrag`,
    // Balanced would publish a ~1e-15 hit on every financed close: invisible as
    // a number, and fatal as a fact, because satisfaction feeds arrival rates
    // and every pre-#368 calibration run would stop reproducing.
    const drag = loadFniCsiDragConfig();
    const tiers = loadCreditTiers();
    const balanced = resolveFniPostureMarkupPts('balanced');
    const ambient = loadFniReserveConfig().ambientMarkupPts;

    for (const tier of ['A', 'B', 'C', 'D'] as const) {
      const buy = tiers.tiers[tier].buyRate;
      for (const target of [ambient, balanced]) {
        const markup = Math.min(target, tiers.tiers[tier].markupCapPts);
        expect(markupSatisfactionHit(buy + markup - buy, drag)).toBe(0);
      }
    }
  });

  it('refuses a drag config whose hit is positive', () => {
    // A positive number would mean gouging a customer cheers the store up, and
    // would read as balance rather than as a dropped minus sign.
    const raw = JSON.parse(JSON.stringify(require('../data/tunables.json')));
    raw.fniCsiDrag.maxSatisfactionHit = 1.5;
    expect(TunablesSchema.safeParse(raw).success).toBe(false);
  });
});

describe('a closed deal publishes the drag (#368)', () => {
  it('an over-marked deal takes a satisfaction hit proportional to the excess', () => {
    const halfway = closeAtMarkup(DRAG.fairMarkupPts + DRAG.fullDragRangePts / 2);
    expect(halfway).toHaveLength(1);
    expect(halfway[0].amount).toBeCloseTo(DRAG.maxSatisfactionHit / 2, 10);
    expect(halfway[0].day).toBe(7);

    // Proportional, not a flat penalty for crossing the line: reaching further
    // past it costs more.
    const further = closeAtMarkup(DRAG.fairMarkupPts + DRAG.fullDragRangePts);
    expect(further[0].amount).toBeLessThan(halfway[0].amount);
  });

  it('a fairly-marked deal takes no hit', () => {
    expect(closeAtMarkup(DRAG.fairMarkupPts)).toHaveLength(0);
    // The unstaffed ambient markup sits under the line, which is what keeps the
    // whole pre-#368 calibration corpus measuring a store that never takes this.
    expect(closeAtMarkup(RESERVE.ambientMarkupPts)).toHaveLength(0);
    // Through the whole close on the buy rate whose `+ markup − buyRate` round
    // trip lands 1.6e-17 OVER the line. Nothing may fire here.
    expect(closeAtMarkup(DRAG.fairMarkupPts, CATALOG.tiers.C.buyRate)).toHaveLength(0);
    expect(closeAtMarkup(DRAG.fairMarkupPts, CATALOG.tiers.D.buyRate)).toHaveLength(0);
  });

  it('a cash deal cannot be gouged on rate', () => {
    const { engine, hits } = harness();
    engine.closeDeal({
      customerId: 'c1',
      vehicleId: 'v1',
      agreedPrice: 24_000,
      paymentMethod: 'cash',
      // A cash buyer quotes no rate at all, but even handed a nonsense spread
      // there is no note to mark up — attaching a menu is the job, over-marking
      // the rate is the gouge.
      apr: BUY_RATE + DRAG.fairMarkupPts + DRAG.fullDragRangePts,
      buyRate: BUY_RATE,
      fniProducts: [{ productId: 'gap', price: 900 }],
    });
    expect(hits).toHaveLength(0);
  });

  it('the drag lands on customerSatisfaction through the existing subscriber', () => {
    // No new coupling and no new event name: Reputation already consumes
    // `reputation:satisfaction_hit`, and its satisfaction already feeds arrival
    // rates — so gouging thins the crowd with nothing added between them.
    //
    // Measured against a FAIR close rather than against nothing, because a
    // closed deal also carries its own satisfaction bonus. The difference
    // between the two stores is the drag and only the drag.
    function satisfactionAfterCloseAt(markupPts: number): number {
      const { bus, engine } = harness();
      const reputation = createReputation({ bus });
      engine.closeDeal({
        customerId: 'c1',
        vehicleId: 'v1',
        agreedPrice: 24_000,
        paymentMethod: 'finance',
        downPayment: 4_000,
        loanAmount: 20_000,
        term: 60,
        apr: BUY_RATE + markupPts,
        buyRate: BUY_RATE,
      });
      return reputation.customerSatisfaction;
    }

    const fair = satisfactionAfterCloseAt(DRAG.fairMarkupPts);
    const gouged = satisfactionAfterCloseAt(DRAG.fairMarkupPts + DRAG.fullDragRangePts);

    expect(gouged).toBeCloseTo(fair + DRAG.maxSatisfactionHit, 10);
  });
});
