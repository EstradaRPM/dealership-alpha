import { aggregateShare, scoreCompetitor } from '../src/game/CompetitorMarket';
import type {
  BrandCatalog,
  Competitor,
  CompetitorCatalog,
} from '../src/game/CompetitorMarket';
import type { SalesVisit } from '../src/game/NPC';

const LUXURY_LEAN = {
  safety: 0.6, performance: 0.9, appearance: 0.95,
  comfort: 0.85, economy: 0.1, dependability: 0.55,
};
const TRUCK_LEAN = {
  safety: 0.75, performance: 0.55, appearance: 0.4,
  comfort: 0.55, economy: 0.35, dependability: 0.8,
};
const ECONOMY_LEAN = {
  safety: 0.5, performance: 0.35, appearance: 0.4,
  comfort: 0.5, economy: 0.9, dependability: 0.6,
};

const brands: BrandCatalog = {
  castillac: { segment_affinity: { luxury: 0.95 }, market_draw: 0.04, spaced_lean: LUXURY_LEAN },
  corden: { segment_affinity: { truck: 0.9 }, market_draw: 0.18, spaced_lean: TRUCK_LEAN },
  kaivo: { segment_affinity: { economy: 0.85 }, market_draw: 0.08, spaced_lean: ECONOMY_LEAN },
};

function visit(tag: string, prefs: SalesVisit['preferences']): SalesVisit {
  return {
    kind: 'sales',
    person_id: tag,
    preferences: prefs,
    resources: { trust: 0.5, patience: 0.5 },
  };
}

const luxurySeeker = visit('lux', {
  safety: 0.4, performance: 0.9, appearance: 0.95,
  comfort: 0.8, economy: 0.1, dependability: 0.3,
});
const truckBuyer = visit('truck', {
  safety: 0.8, performance: 0.4, appearance: 0.2,
  comfort: 0.4, economy: 0.3, dependability: 0.9,
});
const economyShopper = visit('econ', {
  safety: 0.5, performance: 0.2, appearance: 0.3,
  comfort: 0.4, economy: 0.95, dependability: 0.6,
});

const baseClamp = {
  rep:       { lo: 0.4, hi: 0.9 },
  inventory: { lo: 0.3, hi: 0.9 },
  pricing:   { lo: 0.2, hi: 0.9 },
};

const competitors: CompetitorCatalog = [
  { id: 'lux1',   name: 'Lux1',   brand: 'castillac', personality: 'premium_csi',       price_point: 'premium', rep: 0.7, inventory: 0.6, pricing: 0.6, clamp: baseClamp },
  { id: 'truck1', name: 'Truck1', brand: 'corden',    personality: 'volume_dealer',      price_point: 'value',   rep: 0.7, inventory: 0.6, pricing: 0.6, clamp: baseClamp },
  { id: 'econ1',  name: 'Econ1',  brand: 'kaivo',     personality: 'budget_discounter',  price_point: 'budget',  rep: 0.6, inventory: 0.5, pricing: 0.4, clamp: baseClamp },
];

describe('aggregateShare', () => {
  it('returns an entry for every competitor, even with zero visits', () => {
    const shares = aggregateShare(competitors, [], brands);
    expect(shares.size).toBe(3);
    for (const c of competitors) expect(shares.get(c.id)).toBe(0);
  });

  it('shares sum to ~1 over a population with at least one positive scorer', () => {
    const shares = aggregateShare(competitors, [luxurySeeker, truckBuyer, economyShopper], brands);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('luxury seekers concentrate share on the castillac dealer', () => {
    const shares = aggregateShare(competitors, [luxurySeeker], brands);
    const lux = shares.get('lux1')!;
    expect(lux).toBeGreaterThan(shares.get('truck1')!);
    expect(lux).toBeGreaterThan(shares.get('econ1')!);
  });

  it('filter to a subset reproduces that subset\'s aggregate share', () => {
    const all = [luxurySeeker, truckBuyer, economyShopper];
    const filtered = aggregateShare(competitors, all, brands, (v) => v.person_id === 'truck');
    const reference = aggregateShare(competitors, [truckBuyer], brands);
    for (const c of competitors) {
      expect(filtered.get(c.id)).toBeCloseTo(reference.get(c.id)!, 9);
    }
  });

  it('full aggregate is the mean of per-visit normalized shares', () => {
    // Hand-roll the share-of-preference average and compare to aggregateShare.
    const visits = [luxurySeeker, truckBuyer, economyShopper];
    const expected = new Map<string, number>();
    for (const c of competitors) expected.set(c.id, 0);
    for (const v of visits) {
      const scores = competitors.map((c) => Math.max(0, scoreCompetitor(c, v, brands)));
      const total = scores.reduce((a, b) => a + b, 0);
      if (total === 0) continue;
      competitors.forEach((c, i) => {
        expected.set(c.id, expected.get(c.id)! + scores[i] / total);
      });
    }
    for (const k of expected.keys()) expected.set(k, expected.get(k)! / visits.length);

    const actual = aggregateShare(competitors, visits, brands);
    for (const c of competitors) {
      expect(actual.get(c.id)).toBeCloseTo(expected.get(c.id)!, 9);
    }
  });

  it('is deterministic across repeated calls', () => {
    const a = aggregateShare(competitors, [luxurySeeker, truckBuyer], brands);
    const b = aggregateShare(competitors, [luxurySeeker, truckBuyer], brands);
    for (const c of competitors) {
      expect(a.get(c.id)).toBe(b.get(c.id));
    }
  });

  it('competitor with unknown brand gets zero share', () => {
    const ghost: Competitor = {
      id: 'ghost', name: 'Ghost', brand: 'no_such_brand',
      personality: 'volume_dealer', price_point: 'value',
      rep: 0.9, inventory: 0.9, pricing: 0.5, clamp: baseClamp,
    };
    const shares = aggregateShare([...competitors, ghost], [luxurySeeker, truckBuyer], brands);
    expect(shares.get('ghost')).toBe(0);
  });
});
