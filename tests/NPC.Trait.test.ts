import {
  resolveEffects,
  TraitAppliesError,
  loadTraitTaxonomy,
} from '../src/game/NPC';
import type { Trait } from '../src/game/NPC';

describe('resolveEffects', () => {
  const priceSensitive: Trait = {
    applies_to: ['customer'],
    effects: { 'spaced_weight.economy': 0.3, trust_build_rate: -0.1 },
  };
  const luxurySeeker: Trait = {
    applies_to: ['customer'],
    effects: { 'spaced_weight.luxury': 0.4, price_sensitivity: -0.2 },
  };

  it('returns baseline when no traits supplied', () => {
    const out = resolveEffects([], { trust_build_rate: 0.5 }, 'customer');
    expect(out).toEqual({ trust_build_rate: 0.5 });
  });

  it('sums a single trait onto baseline', () => {
    const out = resolveEffects(
      [priceSensitive],
      { 'spaced_weight.economy': 0.1, trust_build_rate: 0.5 },
      'customer',
    );
    expect(out['spaced_weight.economy']).toBeCloseTo(0.4);
    expect(out.trust_build_rate).toBeCloseTo(0.4);
  });

  it('sums multiple traits with overlapping and disjoint keys', () => {
    const out = resolveEffects(
      [priceSensitive, luxurySeeker],
      { 'spaced_weight.economy': 0.1 },
      'customer',
    );
    expect(out['spaced_weight.economy']).toBeCloseTo(0.4);
    expect(out['spaced_weight.luxury']).toBeCloseTo(0.4);
    expect(out.trust_build_rate).toBeCloseTo(-0.1);
    expect(out.price_sensitivity).toBeCloseTo(-0.2);
  });

  it('does not mutate the baseline argument', () => {
    const baseline = { 'spaced_weight.economy': 0.1 };
    resolveEffects([priceSensitive], baseline, 'customer');
    expect(baseline).toEqual({ 'spaced_weight.economy': 0.1 });
  });
});

describe('applies_to enforcement', () => {
  it('throws when trait is applied to an entity type its applies_to excludes', () => {
    const customerOnly: Trait = {
      applies_to: ['customer'],
      effects: { trust_build_rate: 0.1 },
    };
    expect(() => resolveEffects([customerOnly], {}, 'staff')).toThrow(
      TraitAppliesError,
    );
  });

  it('accepts trait when entity type is in applies_to', () => {
    const both: Trait = {
      applies_to: ['customer', 'staff'],
      effects: { trust_build_rate: 0.1 },
    };
    expect(() => resolveEffects([both], {}, 'staff')).not.toThrow();
    expect(() => resolveEffects([both], {}, 'customer')).not.toThrow();
  });
});

describe('loadTraitTaxonomy', () => {
  it('loads and validates the bundled stub file', () => {
    const taxonomy = loadTraitTaxonomy();
    expect(Object.keys(taxonomy).length).toBeGreaterThan(0);
    expect(taxonomy['price-sensitive']).toBeDefined();
    expect(taxonomy['price-sensitive'].applies_to).toContain('customer');
  });
});
