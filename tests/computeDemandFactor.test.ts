import { computeDemandFactor } from '../src/computeDemandFactor';
import { loadTunables } from '../src/game/data';
import type { LotVehicle, VehicleCondition } from '../src/game/Inventory';

const cfg = loadTunables().demandModel;

function veh(condition: VehicleCondition): LotVehicle {
  return {
    id: `v-${Math.random()}`,
    templateId: 't',
    year: 2020,
    make: 'M',
    model: 'X',
    trim: 'B',
    mileage: 50_000,
    condition,
    conditionReport: '',
    purchasePrice: 10_000,
    reconCost: 500,
    category: 'sedan',
    arrivalDay: 1,
    daysInInventory: 0,
    suggestedRetail: 11_000,
    askingPrice: 11_000,
  } as LotVehicle;
}

function lot(n: number, condition: VehicleCondition = 'average'): LotVehicle[] {
  return Array.from({ length: n }, () => veh(condition));
}

describe('computeDemandFactor (#128a)', () => {
  it('empty lot draws nobody (factor 0)', () => {
    expect(computeDemandFactor([], cfg)).toBe(0);
  });

  it('depth saturates monotonically — more stock, more demand', () => {
    const f2 = computeDemandFactor(lot(2), cfg);
    const f12 = computeDemandFactor(lot(12), cfg);
    const f60 = computeDemandFactor(lot(60), cfg);
    expect(f2).toBeGreaterThan(0);
    expect(f12).toBeGreaterThan(f2);
    expect(f60).toBeGreaterThan(f12);
    // Hill curve is concave: the 12→60 jump (Δstock 48) adds less than the
    // 2→12 jump (Δstock 10) — diminishing returns on inventory depth.
    expect(f60 - f12).toBeLessThan(f12 - f2);
  });

  it('quality lifts demand — a clean lot out-draws a rough lot of equal size', () => {
    const rough = computeDemandFactor(lot(20, 'rough'), cfg);
    const average = computeDemandFactor(lot(20, 'average'), cfg);
    const clean = computeDemandFactor(lot(20, 'clean'), cfg);
    expect(average).toBeGreaterThan(rough);
    expect(clean).toBeGreaterThan(average);
  });

  it('a tiny shady startup lot lands in the low single-digit traffic band', () => {
    // 2 average cars: depthSat≈0.143 · qualityMult — well under 1 so day-1
    // expected arrivals stay in the 0–2 ups band (with Poisson variance).
    const f = computeDemandFactor(lot(2, 'average'), cfg);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.3);
  });

  it('never exceeds the demandFactorMax outlier clamp', () => {
    const huge = computeDemandFactor(lot(100_000, 'clean'), cfg);
    expect(huge).toBeLessThanOrEqual(cfg.demandFactorMax);
  });
});
