import { createDealEngine, loadFniProducts, loadFniAutoAttachConfig } from '../src/game/DealEngine';
import type {
  AutoFniDeal,
  DealEngine,
  FniAutoAttachConfig,
  FniProductCatalog,
} from '../src/game/DealEngine';
import {
  setup,
  admit,
  makeSession,
  makeStaff,
  makeCashVisit,
  makeFinanceVisit,
} from './helpers/staffDispatchHarness';

/**
 * #152 — attach scales with the amount financed.
 *
 * Two rules, deliberately not one (the #153 call again): `requiresFinancing` is
 * categorical — GAP covers the gap between a loan balance and the car's value,
 * so a cash deal has nothing for it to cover — and `loanSensitivity` is the
 * scalar that says how much a product's appeal falls as the note shrinks.
 */

const PRICE = 20_000;

const cash: AutoFniDeal = { paymentMethod: 'cash', loanAmount: 0, agreedPrice: PRICE };
const financed = (loanAmount: number): AutoFniDeal => ({
  paymentMethod: 'finance',
  loanAmount,
  agreedPrice: PRICE,
});
/** Nothing down: the biggest note the price allows. */
const STANDARD = financed(PRICE);
/** Half down: same car, same price, half the note. */
const HEAVY_DOWN = financed(PRICE * 0.3);

// ── The multiplier itself ────────────────────────────────────────────────────

// Two products alike in every way except sensitivity, and a skill range pinned
// at 1 so the only term left moving is the one under test.
const PROBE_CATALOG: FniProductCatalog = {
  schemaVersion: 1,
  products: [
    { id: 'flat', label: 'Flat', shortLabel: 'FLT', defaultPrice: 500, cost: 100 },
    {
      id: 'sensitive',
      label: 'Sensitive',
      shortLabel: 'SEN',
      defaultPrice: 500,
      cost: 100,
      loanSensitivity: 0.4,
    },
  ],
};

const PROBE_CONFIG: FniAutoAttachConfig = {
  baseAttachRates: { flat: 0.5, sensitive: 0.5 },
  skillMultiplierRange: [1, 1],
};

describe('computeAutoFni — loan sensitivity (#152)', () => {
  const engine = createDealEngine({
    fniCatalog: PROBE_CATALOG,
    fniAutoAttachConfig: PROBE_CONFIG,
  });
  const ids = (deal: AutoFniDeal, roll: number): string[] =>
    engine.computeAutoFni({ skill: 100, deal, rng: () => roll }).map((p) => p.productId);

  it('loan sensitivity is a per-product multiplier on the base attach rate', () => {
    // Half the price financed ⇒ the sensitive product's rate is
    // 0.5 × (1 − 0.4 × 0.5) = 0.40, and the flat product's is still 0.50. A roll
    // of 0.45 lands between them, which is only possible if the multiplier is
    // applied per product rather than to the deal.
    const halfFinanced = financed(PRICE * 0.5);
    expect(ids(halfFinanced, 0.45)).toEqual(['flat']);
    // Below both rates: the sensitive product is discounted, not disabled.
    expect(ids(halfFinanced, 0.35).sort()).toEqual(['flat', 'sensitive']);
    // Fully financed ⇒ the factor is 1 and the two are indistinguishable again.
    expect(ids(STANDARD, 0.45).sort()).toEqual(['flat', 'sensitive']);
  });

  it('a fully-cash deal drops a loan-sensitive rate by its whole sensitivity', () => {
    // 0.5 × (1 − 0.4) = 0.30 on cash against 0.50 financed.
    expect(ids(cash, 0.35)).toEqual(['flat']);
    expect(ids(cash, 0.25).sort()).toEqual(['flat', 'sensitive']);
  });
});

// ── The shipped catalog ─────────────────────────────────────────────────────

/**
 * A fixed-sequence generator, so two runs that draw the same number of times in
 * the same order see the same rolls. `computeAutoFni` draws once per available
 * product whether or not it can attach, which is what makes the flat-product
 * counts below comparable across structures at all.
 */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const ALL_ROLES = ['f&i-manager'];

/** How often each product attached over `n` presentations of the same deal. */
function attachCounts(
  engine: DealEngine,
  deal: AutoFniDeal,
  n = 4_000,
): Record<string, number> {
  const rng = lcg(20_152);
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    for (const p of engine.computeAutoFni({ skill: 70, unlockedRoles: ALL_ROLES, deal, rng })) {
      counts[p.productId] = (counts[p.productId] ?? 0) + 1;
    }
  }
  return counts;
}

describe('computeAutoFni — the shipped catalog across deal structures (#152)', () => {
  const engine = createDealEngine({
    fniCatalog: loadFniProducts(),
    fniAutoAttachConfig: loadFniAutoAttachConfig(),
  });

  it('GAP cannot attach to a cash deal', () => {
    // An RNG below every rate: whatever the catalog is tuned to, GAP is not on
    // the menu. `requiresFinancing` is checked ahead of the roll for exactly
    // this reason — a calibration pass can move `loanSensitivity` without ever
    // making it possible to sell loan-gap coverage to someone with no loan.
    const alwaysAttach = () => -1;
    const onCash = engine
      .computeAutoFni({ skill: 100, unlockedRoles: ALL_ROLES, deal: cash, rng: alwaysAttach })
      .map((p) => p.productId);
    expect(onCash).not.toContain('gap');
    expect(onCash).toContain('vsc');

    const onFinance = engine
      .computeAutoFni({ skill: 100, unlockedRoles: ALL_ROLES, deal: STANDARD, rng: alwaysAttach })
      .map((p) => p.productId);
    expect(onFinance).toContain('gap');
  });

  it('a heavy-down deal attaches below a standard-finance deal', () => {
    const standard = attachCounts(engine, STANDARD);
    const heavy = attachCounts(engine, HEAVY_DOWN);

    // Same price, smaller note: every product that covers the note is a harder
    // sell, and the ones that cover the car are not.
    expect(heavy.gap).toBeLessThan(standard.gap);
    expect(heavy.vsc).toBeLessThan(standard.vsc);
    expect(heavy.prepaidMaintenance).toBeLessThan(standard.prepaidMaintenance);
    // Still a real menu — this is a discount on appeal, not a second gate.
    expect(heavy.gap).toBeGreaterThan(0);

    // And the whole back end thins out with it.
    const total = (c: Record<string, number>) => Object.values(c).reduce((s, v) => s + v, 0);
    expect(total(heavy)).toBeLessThan(total(standard));
  });

  it('etch, key and tire-and-wheel are flat across structures', () => {
    // Exactly equal, not merely close: these three declare no `loanSensitivity`,
    // so their rate is untouched, and the roll sequence is identical because a
    // gated product still consumes its draw.
    const onCash = attachCounts(engine, cash);
    const onStandard = attachCounts(engine, STANDARD);
    const onHeavy = attachCounts(engine, HEAVY_DOWN);

    for (const id of ['etch', 'keyReplacement', 'tireWheel'] as const) {
      expect(onCash[id]).toBeGreaterThan(0);
      expect(onStandard[id]).toBe(onCash[id]);
      expect(onHeavy[id]).toBe(onCash[id]);
    }
  });
});

// ── Anti-orphan: the live close flow ────────────────────────────────────────

/**
 * A rule the engine applies to a structure nobody hands it is a rule wired to
 * nothing (#363's lesson). These two closes run through the real StaffDispatch
 * flow, which is the only production caller of `computeAutoFni`, and read the
 * back end off the `deal:closed` the flow actually published.
 *
 * With a lone salesperson on the roster only VSC and GAP are on the menu, so
 * with an always-attach RNG the product gross names exactly which of the two
 * attached: VSC's margin alone on cash, both on the financed deal.
 */
const VSC_MARGIN = 1_495 - 495;
const GAP_MARGIN = 695 - 195;

describe('the live close flow presents against the real structure (#152)', () => {
  const closeWith = (visit: 'cash' | 'finance'): { productGross: number } => {
    const w = setup([makeStaff(0.9)], undefined, { fniRng: () => 0 });
    const make = visit === 'cash' ? makeCashVisit : makeFinanceVisit;
    w.sessions.set('cust:1', makeSession('cust:1', make('cust:1')));
    admit(w.bus, 'cust:1');
    expect(w.closedDeals).toHaveLength(1);
    return w.closedDeals[0] as unknown as { productGross: number };
  };

  it('a cash close earns no GAP margin and a financed close does', () => {
    expect(closeWith('cash').productGross).toBe(VSC_MARGIN);
    expect(closeWith('finance').productGross).toBe(VSC_MARGIN + GAP_MARGIN);
  });
});
