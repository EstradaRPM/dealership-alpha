import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  resolveSafeFrontierPts,
  fallThroughProbability,
  loadFniDealKillConfig,
  loadFniProducts,
  loadFniPostureConfig,
  resolveFniPostureMarkupPts,
} from '../src/game/DealEngine';
import type { FniDeskSkills } from '../src/game/StaffDispatch';
import {
  setup,
  admit,
  makeStaff,
  makeSession,
  makeFinanceVisit,
  makeLotVehicle,
  BASE_CONFIG,
} from './helpers/staffDispatchHarness';

/**
 * #369 — the F&I manager works the deal (grill Q2, Q5, Q10).
 *
 * Before this, the back end ran on the *salesperson's* effectiveness, which is
 * what a store with no finance office looks like. Hiring an `f&i-manager` turns
 * the office on: their `product_presentation` works the menu, and their
 * `finance_structuring` decides how much markup the lender will still buy.
 *
 * The manager fully resolves every deal inside the player's standing posture.
 * There is no per-deal touch and no per-product switch — the last describe here
 * asserts that scope call rather than trusting it.
 */

const AGGRESSIVE = resolveFniPostureMarkupPts('more-per-deal', loadFniPostureConfig());

/** A desk, as the composition root distills one off the roster. */
const desk = (
  productPresentation: number,
  financeStructuring: number,
): (() => FniDeskSkills) => () => ({
  staffId: 'staff:fni',
  productPresentation,
  financeStructuring,
});

/** Salesperson + (optionally) the finance manager whose desk the tests drive. */
const FLOOR = [
  makeStaff(0.9, 'staff:sales', 'salesperson'),
  makeStaff(0.7, 'staff:fni', 'f&i-manager'),
];
const FLOOR_NO_FNI = [makeStaff(0.9, 'staff:sales', 'salesperson')];

interface BackEnd {
  productGross: number;
  reserveGross: number;
  backGross: number;
}

/**
 * Runs a crowd of financed walk-ins through the floor and returns the store's
 * back end plus what the lender refused. One car per customer so nothing is
 * lost to a sold-out lot.
 */
function runFloor(
  roster: typeof FLOOR,
  opts: {
    getFniDesk?: () => FniDeskSkills | null;
    fniRng?: () => number;
    postureMarkupPts?: number;
    customers?: number;
    salespersonEffectiveness?: number;
  } = {},
): { closes: BackEnd[]; total: BackEnd; fellThrough: number } {
  const customers = opts.customers ?? 1;
  const w = setup(roster, BASE_CONFIG, {
    lot: Array.from({ length: customers }, (_, i) => makeLotVehicle(`veh:${i}`)),
    // The desk is staffed for the rate as well as the menu — in a live world
    // both read the same roster, so a test that split them would be measuring a
    // store that cannot exist.
    getFniDeskStaffed: () => opts.getFniDesk?.() != null,
    getFniPostureMarkupPts: () => opts.postureMarkupPts ?? AGGRESSIVE,
    getFniDesk: opts.getFniDesk,
    fniRng: opts.fniRng,
  });

  const closes: BackEnd[] = [];
  w.bus.subscribe('deal:closed', (e) => {
    const d = e as unknown as BackEnd;
    closes.push({
      productGross: d.productGross,
      reserveGross: d.reserveGross,
      backGross: d.backGross,
    });
  });

  for (let i = 0; i < customers; i += 1) {
    w.sessions.set(`cust:${i}`, makeSession(`p:${i}`, makeFinanceVisit(`p:${i}`)));
    admit(w.bus, `cust:${i}`, 1);
  }

  const total = closes.reduce<BackEnd>(
    (acc, c) => ({
      productGross: acc.productGross + c.productGross,
      reserveGross: acc.reserveGross + c.reserveGross,
      backGross: acc.backGross + c.backGross,
    }),
    { productGross: 0, reserveGross: 0, backGross: 0 },
  );
  return {
    closes,
    total,
    fellThrough: w.events.filter((e) => e.reason === 'finance_fell_through').length,
  };
}

// A roll every product's *base* rate clears at a strong desk and none clears at
// a weak one — so the same seed reads the presenter's skill and nothing else.
const MID_ROLL = () => 0.36;

describe('#369 the menu is the F&I manager\'s', () => {
  it('the finance manager, not the salesperson, works the menu once hired', () => {
    // Same floor, same crowd, same rolls — only who sits at the finance desk
    // differs. If attach still ran on the salesperson these would be equal.
    const sharp = runFloor(FLOOR, { getFniDesk: desk(100, 100), fniRng: MID_ROLL });
    const green = runFloor(FLOOR, { getFniDesk: desk(0, 100), fniRng: MID_ROLL });

    expect(sharp.closes).toHaveLength(1);
    expect(green.closes).toHaveLength(1);
    expect(sharp.total.productGross).toBeGreaterThan(green.total.productGross);
    // A desk that presents nothing signs nothing, even behind a 0.9-effectiveness
    // salesperson: the salesperson is out of the back end entirely.
    expect(green.total.productGross).toBe(0);

    // And the converse — moving the *salesperson* leaves the menu untouched.
    const strongFloor = runFloor(FLOOR, { getFniDesk: desk(100, 100), fniRng: MID_ROLL });
    const weakerFloor = runFloor(
      [makeStaff(0.75, 'staff:sales', 'salesperson'), FLOOR[1]],
      { getFniDesk: desk(100, 100), fniRng: MID_ROLL },
    );
    expect(weakerFloor.closes).toHaveLength(1);
    expect(weakerFloor.total.productGross).toBe(strongFloor.total.productGross);
  });

  it('an unstaffed store attaches VSC and GAP off the salesperson', () => {
    // Everything the store is allowed to sell attaches, so the total names the
    // shelf exactly: the two ungated products and nothing else.
    const unstaffed = runFloor(FLOOR_NO_FNI, { fniRng: () => 0 });
    const catalog = loadFniProducts();
    const margin = (id: string) => {
      const p = catalog.products.find((x) => x.id === id)!;
      return p.defaultPrice - p.cost;
    };
    expect(unstaffed.closes).toHaveLength(1);
    expect(unstaffed.total.productGross).toBe(margin('vsc') + margin('gap'));

    // And the rate is still the SALESPERSON's while the desk is empty: a weaker
    // floor signs less of the same two-product shelf.
    const weaker = runFloor([makeStaff(0.7, 'staff:sales', 'salesperson')], {
      fniRng: () => 0.49,
    });
    const stronger = runFloor(FLOOR_NO_FNI, { fniRng: () => 0.49 });
    expect(weaker.closes).toHaveLength(1);
    expect(stronger.total.productGross).toBeGreaterThan(weaker.total.productGross);
  });
});

describe('#369 the structurer moves the lender\'s frontier', () => {
  it('a stronger structurer can carry more markup before deals fall through', () => {
    const config = loadFniDealKillConfig();

    // The relation itself: monotonic, bounded, and "no desk" is the bare line.
    const noDesk = resolveSafeFrontierPts(null, config);
    expect(noDesk).toBe(config.safeFrontierPts);
    const frontiers = [0, 25, 50, 75, 100].map((s) =>
      resolveSafeFrontierPts(s, config),
    );
    for (let i = 1; i < frontiers.length; i += 1) {
      expect(frontiers[i]).toBeGreaterThan(frontiers[i - 1]);
    }
    // It flattens at the reference — a manager cannot out-structure the lender
    // forever.
    expect(resolveSafeFrontierPts(400, config)).toBe(
      resolveSafeFrontierPts(config.structuringSkillReference, config),
    );
    // And the frontier it buys is exactly the reach from Balanced to aggressive,
    // which is what makes the posture dial's peak slide rather than vanish.
    expect(resolveSafeFrontierPts(config.structuringSkillReference, config)).toBeCloseTo(
      AGGRESSIVE,
      10,
    );

    // Same aggressive markup, falling risk as the structurer improves.
    const risks = [0, 40, 80].map((s) => fallThroughProbability(AGGRESSIVE, config, s));
    expect(risks[0]).toBeGreaterThan(risks[1]);
    expect(risks[1]).toBeGreaterThan(risks[2]);
    expect(fallThroughProbability(AGGRESSIVE, config, null)).toBe(risks[0]);

    // On the floor: the same crowd at the same aggressive posture loses deals
    // to a green structurer and loses none to a reference one.
    const green = runFloor(FLOOR, {
      getFniDesk: desk(60, 0),
      customers: 30,
      fniRng: MID_ROLL,
    });
    const sharp = runFloor(FLOOR, {
      getFniDesk: desk(60, config.structuringSkillReference),
      customers: 30,
      fniRng: MID_ROLL,
    });
    expect(green.fellThrough).toBeGreaterThan(0);
    expect(sharp.fellThrough).toBe(0);
    expect(sharp.closes.length).toBeGreaterThan(green.closes.length);
  });

  it('skill moves the peak, not just the variance', () => {
    // Two stores, one posture, one crowd. The only difference is who is on the
    // desk — and the stronger desk earns more back end on both halves of it:
    // more menu signed AND more of the marked-up paper actually bought.
    const green = runFloor(FLOOR, {
      getFniDesk: desk(20, 20),
      customers: 30,
      fniRng: MID_ROLL,
    });
    const sharp = runFloor(FLOOR, {
      getFniDesk: desk(100, 100),
      customers: 30,
      fniRng: MID_ROLL,
    });

    expect(sharp.total.backGross).toBeGreaterThan(green.total.backGross);
    expect(sharp.total.productGross).toBeGreaterThan(green.total.productGross);
    expect(sharp.total.reserveGross).toBeGreaterThan(green.total.reserveGross);
    // Per surviving deal too, so this isn't only "the sharp desk closed more".
    const per = (t: BackEnd, n: number) => t.backGross / n;
    expect(per(sharp.total, sharp.closes.length)).toBeGreaterThan(
      per(green.total, green.closes.length),
    );
  });
});

/**
 * The Q10 scope call, asserted rather than trusted: all six products unlock
 * together with the hire and the manager owns the menu. The player's ONE F&I
 * input is the standing posture (#366) — a per-product switch would be a second
 * lever over a decision the finance office is hired to make.
 */
describe('#369 the product menu has no player control', () => {
  it('the product menu is the manager\'s, not the player\'s', () => {
    const uiRoot = join(__dirname, '..', 'src', 'ui');
    const gated = loadFniProducts()
      .products.filter((p) => p.requiredRole)
      .map((p) => p.id);
    expect(gated.length).toBeGreaterThan(0);

    const pattern = new RegExp(
      `\\b(computeAutoFni|getFniProducts|${gated.join('|')})\\b`,
    );
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (pattern.test(readFileSync(full, 'utf8'))) offenders.push(full);
      }
    };
    walk(uiRoot);
    expect(offenders).toEqual([]);

    // And the engine offers nothing to switch with: the menu surface is a read
    // of what the store may sell, never a per-product setting.
    const w = setup(FLOOR, BASE_CONFIG, { getFniDesk: desk(80, 80) });
    const surface = Object.keys(w.dealEngine).filter((k) => /product/i.test(k));
    expect(surface).toEqual(['getFniProducts']);
  });
});
