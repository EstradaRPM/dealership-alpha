import { computePricingTrafficMultiplier } from '../src/computePricingTrafficMultiplier';
import { loadTunables } from '../src/game/data';
import type { LotVehicle } from '../src/game/Inventory';

function veh(askingPrice: number): LotVehicle {
  return {
    id: `v-${Math.random()}`,
    templateId: 't',
    year: 2020,
    make: 'M',
    model: 'X',
    trim: 'B',
    mileage: 50_000,
    condition: 'average',
    conditionReport: '',
    purchasePrice: 10_000,
    reconCost: 500,
    category: 'sedan',
    arrivalDay: 1,
    daysInInventory: 0,
    suggestedRetail: 11_000,
    askingPrice,
  } as LotVehicle;
}

function lot(n: number): LotVehicle[] {
  return Array.from({ length: n }, () => veh(11_000));
}

describe('computePricingTrafficMultiplier (#277 S5)', () => {
  it('ships at identity: weight 0 ⇒ exactly 1 (no behavior change)', () => {
    expect(computePricingTrafficMultiplier(lot(5), { weight: 0 })).toBe(1);
  });

  it('the data default is weight 0 (the seam ships unarmed)', () => {
    const cfg = loadTunables().demandModel;
    expect(cfg.pricingTrafficWeight).toBe(0);
    expect(
      computePricingTrafficMultiplier(lot(5), {
        weight: cfg.pricingTrafficWeight,
      }),
    ).toBe(1);
  });

  it('identity when no per-vehicle response is injected, even at weight > 0', () => {
    expect(computePricingTrafficMultiplier(lot(5), { weight: 1 })).toBe(1);
  });

  it('empty lot ⇒ 1 (nothing priced, nothing to bend)', () => {
    expect(
      computePricingTrafficMultiplier([], { weight: 1 }, () => 2),
    ).toBe(1);
  });

  it('armed: blends the lot-wide mean response toward identity by weight', () => {
    // Uniform response 2 across the lot. weight 1 ⇒ raw mean (2); weight 0.5 ⇒
    // halfway to identity (1.5).
    expect(
      computePricingTrafficMultiplier(lot(4), { weight: 1 }, () => 2),
    ).toBeCloseTo(2);
    expect(
      computePricingTrafficMultiplier(lot(4), { weight: 0.5 }, () => 2),
    ).toBeCloseTo(1.5);
  });

  it('armed: averages heterogeneous per-vehicle responses', () => {
    const cars = [veh(11_000), veh(11_000)];
    const responses = new Map([
      [cars[0].id, 0.5],
      [cars[1].id, 1.5],
    ]);
    // mean response = 1.0 ⇒ identity even at full weight.
    expect(
      computePricingTrafficMultiplier(cars, { weight: 1 }, (v) =>
        responses.get(v.id)!,
      ),
    ).toBeCloseTo(1);
  });

  it('clamps a deeply-suppressing blend to a non-negative floor', () => {
    // Response 0 at weight 2 ⇒ 1 + 2·(0−1) = −1 ⇒ floored to 0.
    expect(
      computePricingTrafficMultiplier(lot(3), { weight: 2 }, () => 0),
    ).toBe(0);
  });
});
