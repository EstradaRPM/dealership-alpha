import {
  pickVehicleFor,
  pickVehicleForMatch,
  vehicleSpaced,
} from '../src/game/SalesProcess';
import type {
  MatchableVehicle,
  MatchCustomer,
  SpacedVector,
  CustomerAxisProfile,
} from '../src/game/SalesProcess';

const neutralSpaced: SpacedVector = {
  safety: 0.5,
  performance: 0.5,
  appearance: 0.5,
  comfort: 0.5,
  economy: 0.5,
  dependability: 0.5,
};

const lowDemandSpaced: SpacedVector = {
  safety: 0.1,
  performance: 0.1,
  appearance: 0.1,
  comfort: 0.1,
  economy: 0.1,
  dependability: 0.1,
};

const noWantsProfile: CustomerAxisProfile = {
  classes: {
    safety: 'pass',
    performance: 'pass',
    appearance: 'pass',
    comfort: 'pass',
    economy: 'pass',
    dependability: 'pass',
  },
  nonnegotiables: [],
  wants: [],
};

// Demands maxed dependability — no real lot vehicle hits 1.0 dependability,
// so this profile rejects every vehicle on the SPACED gate.
const impossibleNonnegProfile: CustomerAxisProfile = {
  classes: {
    safety: 'pass',
    performance: 'pass',
    appearance: 'pass',
    comfort: 'pass',
    economy: 'pass',
    dependability: 'nonnegotiable',
  },
  nonnegotiables: ['dependability'],
  wants: [],
};

const baseCustomer: MatchCustomer = {
  masterSeed: 1,
  customerId: 'cust-1',
  wealth: 200_000,
  annualIncome: 120_000,
  paymentMethod: 'cash',
  cashSpendFraction: 1,
  customerSpaced: neutralSpaced,
  priceSensitivity: 0.3,
  axisProfile: noWantsProfile,
};

// staticVehicleCost = purchase + recon; staticMarketPrice = round(cost × 1.25).
const vehicleA: MatchableVehicle = {
  id: 'V-001',
  category: 'sedan',
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: 2022,
  purchasePrice: 10_000,
  reconCost: 1_000,
};

const vehicleB: MatchableVehicle = {
  id: 'V-002',
  category: 'sedan',
  templateId: 'toraya_sedan',
  brand: 'toraya',
  year: 2022,
  purchasePrice: 15_000,
  reconCost: 1_000,
};

describe('SalesProcess pickVehicleFor', () => {
  it('returns null on empty lot', () => {
    expect(pickVehicleFor(baseCustomer, [])).toBeNull();
  });

  it('returns null when no vehicle is affordability-eligible', () => {
    const broke: MatchCustomer = {
      ...baseCustomer,
      wealth: 5_000,
      cashSpendFraction: 0.1, // 500 — nowhere near list price
    };
    expect(pickVehicleFor(broke, [vehicleA, vehicleB])).toBeNull();
  });

  it('returns null when no vehicle satisfies SPACED nonnegotiables', () => {
    const picky: MatchCustomer = {
      ...baseCustomer,
      customerSpaced: { ...neutralSpaced, dependability: 1 },
      axisProfile: impossibleNonnegProfile,
    };
    expect(pickVehicleFor(picky, [vehicleA, vehicleB])).toBeNull();
  });

  it('returns the only matching vehicle when one is eligible', () => {
    // Make A unaffordable by raising its price so only B survives eligibility.
    const expensiveA: MatchableVehicle = { ...vehicleA, purchasePrice: 500_000 };
    const tightBudget: MatchCustomer = {
      ...baseCustomer,
      wealth: 25_000,
      cashSpendFraction: 1, // 25k → covers B (~$20k list), not the inflated A
    };
    expect(pickVehicleFor(tightBudget, [expensiveA, vehicleB])).toBe('V-002');
  });

  it('picks the highest-scored vehicle deterministically (price-sensitive picks cheaper)', () => {
    const sensitive: MatchCustomer = {
      ...baseCustomer,
      priceSensitivity: 1, // max-sensitive — cheaper price dominates
    };
    // Both vehicles satisfy nonneg (no wants/nonneg). Cheaper one wins.
    expect(pickVehicleFor(sensitive, [vehicleA, vehicleB])).toBe('V-001');
  });

  it('is deterministic — same inputs → same vehicleId', () => {
    const a = pickVehicleFor(baseCustomer, [vehicleA, vehicleB]);
    const b = pickVehicleFor(baseCustomer, [vehicleA, vehicleB]);
    expect(a).toEqual(b);
    // Tie-break by ascending vehicleId — with zero priceSensitivity and equal
    // want-fit, both score the same and V-001 wins by stable order.
    const insensitive: MatchCustomer = { ...baseCustomer, priceSensitivity: 0 };
    expect(pickVehicleFor(insensitive, [vehicleB, vehicleA])).toBe('V-001');
  });
});

// #151: brand standing is the third term of the argmax, beside want-axis fit
// and the price penalty. Wired at the composition root to `Reputation.repFor`
// scaled by the matcher weight; omitted here ⇒ every make scores alike.
describe('SalesProcess pickVehicleFor — brand reputation', () => {
  // Price-insensitive so the price term cannot explain a flip: with no wants
  // and no reputation, both units tie and V-001 takes it on the stable
  // id tie-break. Reputation is then the only thing that can move the winner.
  const insensitive: MatchCustomer = { ...baseCustomer, priceSensitivity: 0 };

  it('brand reputation moves the match score', () => {
    expect(pickVehicleFor(insensitive, [vehicleA, vehicleB])).toBe('V-001');

    // Standing on B's make (toraya) outweighs the tie-break.
    const trustsToraya = pickVehicleFor(insensitive, [vehicleA, vehicleB], {
      reputationBonusFn: (brand) => (brand === 'toraya' ? 0.15 : 0),
    });
    expect(trustsToraya).toBe('V-002');
  });

  it('a distrusted brand loses the match to its twin', () => {
    // Same car twice, differing only in make — so nothing but standing can
    // decide it. B's id sorts later, so it only wins by being preferred.
    const twinVanda: MatchableVehicle = { ...vehicleA, id: 'V-100', brand: 'vanda' };
    const twinToraya: MatchableVehicle = { ...vehicleA, id: 'V-200', brand: 'toraya' };
    const lot = [twinVanda, twinToraya];

    // Neutral on both: the tie-break picks the lower id.
    expect(pickVehicleFor(insensitive, lot)).toBe('V-100');

    // Below-neutral standing on vanda suppresses engagement with its unit,
    // handing the identical toraya the match.
    const distrustsVanda = pickVehicleFor(insensitive, lot, {
      reputationBonusFn: (brand) => (brand === 'vanda' ? -0.15 : 0),
    });
    expect(distrustsVanda).toBe('V-200');
  });

  it('an unseen make scores exactly as it did before any brand had a record', () => {
    // The neutral default is not a special case: a 0 standing must leave the
    // pre-#151 argmax untouched.
    const withNeutralRep = pickVehicleForMatch(baseCustomer, [vehicleA, vehicleB], {
      reputationBonusFn: () => 0,
    });
    expect(withNeutralRep).toEqual(pickVehicleForMatch(baseCustomer, [vehicleA, vehicleB]));
  });
});

// #199: the match-quality variant carries the want-axis fit of the winner —
// the signal the floor toast + recap "strong match" tally threshold against.
describe('SalesProcess pickVehicleForMatch', () => {
  // Real SPACED of the stocked unit, so the want axis can be aimed dead-on
  // (strong match) or far off (mismatch) deterministically.
  const spacedA = vehicleSpaced(vehicleA);

  const wantEconomyProfile: CustomerAxisProfile = {
    classes: {
      safety: 'pass',
      performance: 'pass',
      appearance: 'pass',
      comfort: 'pass',
      economy: 'want',
      dependability: 'pass',
    },
    nonnegotiables: [],
    wants: ['economy'],
  };

  it('returns null on an empty lot', () => {
    expect(pickVehicleForMatch(baseCustomer, [])).toBeNull();
  });

  it('a buyer whose want is dead-on the stock fires a strong match (quality ≥ 0.8)', () => {
    const matched: MatchCustomer = {
      ...baseCustomer,
      customerSpaced: { ...neutralSpaced, economy: spacedA.economy },
      axisProfile: wantEconomyProfile,
    };
    const result = pickVehicleForMatch(matched, [vehicleA]);
    expect(result?.vehicleId).toBe('V-001');
    expect(result?.matchQuality).toBeGreaterThanOrEqual(0.8);
  });

  it('a buyer whose want is far off the stock does not (quality < 0.8)', () => {
    // Aim the want to the opposite extreme of the unit's actual economy level —
    // a guaranteed gap ≥ 0.5, so fit ≤ 0.5.
    const off = spacedA.economy >= 0.5 ? 0 : 1;
    const mismatched: MatchCustomer = {
      ...baseCustomer,
      customerSpaced: { ...neutralSpaced, economy: off },
      axisProfile: wantEconomyProfile,
    };
    const result = pickVehicleForMatch(mismatched, [vehicleA]);
    expect(result?.vehicleId).toBe('V-001');
    expect(result?.matchQuality).toBeLessThan(0.8);
  });

  it('is deterministic — same inputs → same quality', () => {
    const a = pickVehicleForMatch(baseCustomer, [vehicleA, vehicleB]);
    const b = pickVehicleForMatch(baseCustomer, [vehicleA, vehicleB]);
    expect(a).toEqual(b);
  });
});
