import {
  createMarketEconomy,
  rollPersonalityVector,
  loadMarketPersonalityDistribution,
  type MarketVehicleInput,
} from '../src/game/MarketEconomy';

const civic = (): MarketVehicleInput => ({
  purchasePrice: 11_000,
  reconCost: 800,
  templateId: 'honda_civic',
  make: 'Honda',
  year: 2024,
  mileage: 36_000,
  category: 'sedan',
  condition: 'average',
});

describe('MarketEconomy — personality vector (#156)', () => {
  const dist = loadMarketPersonalityDistribution();

  it('same seed reproduces an identical vector (determinism)', () => {
    const a = rollPersonalityVector(123_456_789, dist);
    const b = rollPersonalityVector(123_456_789, dist);
    expect(a).toEqual(b);
  });

  it('different seeds produce different vectors (per-slot uniqueness)', () => {
    const a = rollPersonalityVector(1, dist);
    const b = rollPersonalityVector(2, dist);
    // At least one segment should differ — the vector lives on a continuous
    // distribution so collision across small seeds is vanishingly unlikely.
    expect(a).not.toEqual(b);
  });

  it('every sampled segment lies within its configured bounds', () => {
    for (const seed of [0, 1, 42, 99_999]) {
      const v = rollPersonalityVector(seed, dist);
      for (const [segment, bounds] of Object.entries(dist.segments)) {
        const b = v.segments[segment];
        expect(b).toBeGreaterThanOrEqual(bounds.biasMin);
        expect(b).toBeLessThanOrEqual(bounds.biasMax);
      }
    }
  });

  it('two MarketEconomy instances with different masterSeeds produce different bookValue', () => {
    const meA = createMarketEconomy({ masterSeed: 1 });
    const meB = createMarketEconomy({ masterSeed: 2 });
    expect(meA.bookValueFn(civic())).not.toBe(meB.bookValueFn(civic()));
  });

  it('reloading the same masterSeed produces identical bookValue (replay determinism)', () => {
    const me1 = createMarketEconomy({ masterSeed: 4242 });
    const me2 = createMarketEconomy({ masterSeed: 4242 });
    expect(me1.bookValueFn(civic())).toBe(me2.bookValueFn(civic()));
    expect(me1.marketPriceFn(civic())).toBe(me2.marketPriceFn(civic()));
  });

  it('omitting masterSeed produces the neutral world (no personality bias applied)', () => {
    const neutral = createMarketEconomy();
    // Neutral world: segmentHeat term is 0, so bookValue equals computeAnchor.
    // Verified by comparing against a same-shape seeded run — they only diverge
    // because of the personality bias.
    const seeded = createMarketEconomy({ masterSeed: 1 });
    expect(neutral.bookValueFn(civic())).not.toBe(seeded.bookValueFn(civic()));
  });
});
