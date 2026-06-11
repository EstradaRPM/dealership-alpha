import {
  vehicleAttributes,
  weatherAttributeBonus,
  pickVehicleForMatch,
} from '../src/game/SalesProcess';
import type {
  VehicleSpacedConfig,
  AttributeVector,
  MatchableVehicle,
  MatchCustomer,
  SpacedVector,
  CustomerAxisProfile,
} from '../src/game/SalesProcess';

// #231 S4. A hermetic config (sedan = poor winter / great fuel; truck = great
// winter / poor fuel) so the accessor + match tilt are assertable without
// coupling to the bundled tunables. The SPACED side is neutral throughout — only
// the attribute axes vary — so the test isolates the new mechanic.
const flatSpaced = {
  safety: 0.5,
  performance: 0.5,
  appearance: 0.5,
  comfort: 0.5,
  economy: 0.5,
  dependability: 0.5,
};

const cfg: VehicleSpacedConfig = {
  schemaVersion: 1,
  categoryBase: { sedan: { ...flatSpaced }, truck: { ...flatSpaced } },
  templateOverrides: {},
  yearModifier: { referenceYear: 2020, perYearDelta: {}, maxAbs: 0.1 },
  attributeBase: {
    sedan: { winterCapability: 0.3, openAir: 0.1, fuelEfficiency: 0.85 },
    truck: { winterCapability: 0.8, openAir: 0.02, fuelEfficiency: 0.3 },
  },
  attributeOverrides: {
    corden_truck: { winterCapability: 0.9 },
  },
};

const deps = { vehicleSpacedConfig: cfg };

describe('#231 S4 vehicleAttributes accessor', () => {
  it('resolves the category base for a template with no override', () => {
    const a = vehicleAttributes(
      { category: 'sedan', templateId: 'generic_sedan', brand: 'vanda', year: 2022 },
      deps,
    );
    expect(a).toEqual<AttributeVector>(cfg.attributeBase.sedan);
  });

  it('a per-template override replaces only the named axes, inheriting the rest', () => {
    const a = vehicleAttributes(
      { category: 'truck', templateId: 'corden_truck', brand: 'corden', year: 2022 },
      deps,
    );
    expect(a.winterCapability).toBeCloseTo(0.9); // overridden
    expect(a.openAir).toBeCloseTo(0.02); // inherited from truck base
    expect(a.fuelEfficiency).toBeCloseTo(0.3); // inherited from truck base
  });

  it('throws on a category with no attribute base', () => {
    expect(() =>
      vehicleAttributes(
        { category: 'spaceship', templateId: 'x', brand: 'vanda', year: 2022 },
        deps,
      ),
    ).toThrow(/no attribute base/);
  });

  it('is pure: same input → same output', () => {
    const v = { category: 'truck', templateId: 'generic_truck', brand: 'corden', year: 2022 };
    expect(vehicleAttributes(v, deps)).toEqual(vehicleAttributes(v, deps));
  });
});

describe('#231 S4 weatherAttributeBonus', () => {
  const truck: AttributeVector = { winterCapability: 0.8, openAir: 0.02, fuelEfficiency: 0.3 };

  it('is exactly 0 for an empty lean (calm-day back-compat)', () => {
    expect(weatherAttributeBonus({}, truck)).toBe(0);
  });

  it('rewards an above-neutral attribute under a positive lean', () => {
    // 0.4 · (0.8 − 0.5) = +0.12
    expect(weatherAttributeBonus({ winterCapability: 0.4 }, truck)).toBeCloseTo(0.12);
  });

  it('penalizes a below-neutral attribute under a positive lean (symmetric)', () => {
    // 0.4 · (0.3 − 0.5) = −0.08
    expect(weatherAttributeBonus({ fuelEfficiency: 0.4 }, truck)).toBeCloseTo(-0.08);
  });

  it('ignores lean axes the attribute vector does not carry', () => {
    expect(weatherAttributeBonus({ notAnAxis: 0.9 }, truck)).toBe(0);
  });
});

describe('#231 S4 match tilt — the lean nudges the argmax', () => {
  const neutralSpaced: SpacedVector = { ...flatSpaced };
  const noWants: CustomerAxisProfile = {
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
  const customer: MatchCustomer = {
    masterSeed: 1,
    customerId: 'c-1',
    wealth: 500_000,
    annualIncome: 200_000,
    paymentMethod: 'cash',
    cashSpendFraction: 1,
    customerSpaced: neutralSpaced,
    priceSensitivity: 0.3,
    axisProfile: noWants,
  };

  // Identical cost ⇒ identical market price ⇒ equal price penalty; SPACED is flat
  // ⇒ equal want-fit (no wants). The sedan sorts first, so absent any lean it
  // wins the deterministic tie-break.
  const sedan: MatchableVehicle = {
    id: 'A-sedan',
    category: 'sedan',
    templateId: 'generic_sedan',
    brand: 'vanda',
    year: 2022,
    purchasePrice: 12_000,
    reconCost: 1_000,
  };
  const truck: MatchableVehicle = {
    id: 'Z-truck',
    category: 'truck',
    templateId: 'generic_truck',
    brand: 'corden',
    year: 2022,
    purchasePrice: 12_000,
    reconCost: 1_000,
  };
  const lot = [sedan, truck];

  it('without a lean, the deterministic tie-break (lowest id) wins', () => {
    const m = pickVehicleForMatch(customer, lot, deps);
    expect(m?.vehicleId).toBe('A-sedan');
  });

  it('a winterCapability lean flips the match to the high-capability truck', () => {
    const m = pickVehicleForMatch(customer, lot, {
      ...deps,
      attributeLean: { winterCapability: 0.5 },
    });
    expect(m?.vehicleId).toBe('Z-truck');
  });

  it('matchQuality stays the want-axis fit (the lean tilts the pick, not the payoff)', () => {
    // No wants ⇒ neutral 0.5 fit; the #199 dopamine signal is unaffected by the
    // weather tilt, which only steers which unit wins the argmax.
    const m = pickVehicleForMatch(customer, lot, {
      ...deps,
      attributeLean: { winterCapability: 0.5 },
    });
    expect(m?.matchQuality).toBeCloseTo(0.5);
  });
});
