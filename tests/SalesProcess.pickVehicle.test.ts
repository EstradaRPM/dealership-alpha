import { pickVehicleFor } from '../src/game/SalesProcess';
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
  templateId: 'honda_civic',
  make: 'Honda',
  year: 2022,
  purchasePrice: 10_000,
  reconCost: 1_000,
};

const vehicleB: MatchableVehicle = {
  id: 'V-002',
  category: 'sedan',
  templateId: 'toyota_camry',
  make: 'Toyota',
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
