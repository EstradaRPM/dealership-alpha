import { wantedVehicleCategory } from '../src/game/SalesProcess';
import type { VehicleSpacedConfig, SpacedVector } from '../src/game/SalesProcess';

const config: VehicleSpacedConfig = {
  schemaVersion: 1,
  categoryBase: {
    sedan: {
      safety: 0.55,
      performance: 0.35,
      appearance: 0.4,
      comfort: 0.45,
      economy: 0.8,
      dependability: 0.7,
    },
    suv: {
      safety: 0.7,
      performance: 0.45,
      appearance: 0.55,
      comfort: 0.65,
      economy: 0.5,
      dependability: 0.65,
    },
    truck: {
      safety: 0.55,
      performance: 0.6,
      appearance: 0.45,
      comfort: 0.45,
      economy: 0.35,
      dependability: 0.75,
    },
  },
  templateOverrides: {},
  yearModifier: { referenceYear: 2020, perYearDelta: {}, maxAbs: 0.1 },
  attributeBase: {
    sedan: { winterCapability: 0.3, openAir: 0.05, fuelEfficiency: 0.8 },
    suv: { winterCapability: 0.6, openAir: 0.05, fuelEfficiency: 0.5 },
    truck: { winterCapability: 0.5, openAir: 0.05, fuelEfficiency: 0.35 },
  },
  attributeOverrides: {},
};

describe('#321 wantedVehicleCategory — nearest-category classification off the want-vector', () => {
  it('picks the category whose reference vector the customer sits closest to', () => {
    expect(wantedVehicleCategory(config.categoryBase.sedan as SpacedVector, { vehicleSpacedConfig: config })).toBe(
      'sedan',
    );
    expect(wantedVehicleCategory(config.categoryBase.suv as SpacedVector, { vehicleSpacedConfig: config })).toBe(
      'suv',
    );
    expect(wantedVehicleCategory(config.categoryBase.truck as SpacedVector, { vehicleSpacedConfig: config })).toBe(
      'truck',
    );
  });

  it('classifies a want-vector nudged off a base toward the nearest neighbor', () => {
    const nearlyTruck: SpacedVector = {
      ...config.categoryBase.truck,
      performance: config.categoryBase.truck.performance + 0.02,
    };
    expect(wantedVehicleCategory(nearlyTruck, { vehicleSpacedConfig: config })).toBe('truck');
  });

  it('is pure and deterministic — same input, same output', () => {
    const vector = config.categoryBase.suv as SpacedVector;
    const first = wantedVehicleCategory(vector, { vehicleSpacedConfig: config });
    const second = wantedVehicleCategory(vector, { vehicleSpacedConfig: config });
    expect(first).toBe(second);
  });

  it('defaults to the bundled data/vehicle-spaced.json when no config is injected', () => {
    // Sedan's own base vector must classify as sedan under the real data.
    const realSedanBase: SpacedVector = {
      safety: 0.55,
      performance: 0.35,
      appearance: 0.4,
      comfort: 0.45,
      economy: 0.8,
      dependability: 0.7,
    };
    expect(wantedVehicleCategory(realSedanBase)).toBe('sedan');
  });
});
