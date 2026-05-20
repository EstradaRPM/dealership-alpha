import { scoreCompetitor } from '../src/game/CompetitorMarket';
import type { Competitor } from '../src/game/CompetitorMarket';
import type { BrandCatalog } from '../src/game/CompetitorMarket';
import type { SalesVisit } from '../src/game/NPC';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LUXURY_LEAN = {
  safety: 0.60, performance: 0.90, appearance: 0.95,
  comfort: 0.85, economy: 0.10, dependability: 0.55,
};
const TRUCK_LEAN = {
  safety: 0.75, performance: 0.55, appearance: 0.40,
  comfort: 0.55, economy: 0.35, dependability: 0.80,
};

const brands: BrandCatalog = {
  castillac: { segment_affinity: { luxury: 0.95 }, market_draw: 0.04, spaced_lean: LUXURY_LEAN },
  corden:    { segment_affinity: { truck: 0.90 },  market_draw: 0.18, spaced_lean: TRUCK_LEAN },
};

function makeVisit(prefs: SalesVisit['preferences']): SalesVisit {
  return {
    kind: 'sales',
    person_id: 'test',
    preferences: prefs,
    resources: { trust: 0.5, patience: 0.5 },
    paymentMethod: 'finance',
  };
}

const luxurySeeker = makeVisit({
  safety: 0.4, performance: 0.9, appearance: 0.95,
  comfort: 0.8, economy: 0.1, dependability: 0.3,
});

const truckBuyer = makeVisit({
  safety: 0.8, performance: 0.4, appearance: 0.2,
  comfort: 0.4, economy: 0.3, dependability: 0.9,
});

const repFocused = makeVisit({
  safety: 0.8, performance: 0.2, appearance: 0.2,
  comfort: 0.4, economy: 0.1, dependability: 0.9,
});

const priceFocused = makeVisit({
  safety: 0.2, performance: 0.3, appearance: 0.3,
  comfort: 0.4, economy: 0.9, dependability: 0.2,
});

const baseClamp = {
  rep:       { lo: 0.1, hi: 1.0 },
  inventory: { lo: 0.1, hi: 1.0 },
  pricing:   { lo: 0.1, hi: 1.0 },
};

const dealerA: Competitor = { id: 'a', name: 'A Motors', brand: 'corden',    personality: 'volume_dealer', price_point: 'value',   rep: 0.9, inventory: 0.5, pricing: 0.8, clamp: baseClamp };
const dealerB: Competitor = { id: 'b', name: 'B Motors', brand: 'corden',    personality: 'volume_dealer', price_point: 'budget',  rep: 0.2, inventory: 0.5, pricing: 0.2, clamp: baseClamp };

const castillacDealer: Competitor = { id: 'c', name: 'C Luxury', brand: 'castillac', personality: 'premium_csi',  price_point: 'premium', rep: 0.7, inventory: 0.6, pricing: 0.6, clamp: baseClamp };
const cordenDealer:    Competitor = { id: 'd', name: 'D Truck',  brand: 'corden',    personality: 'volume_dealer', price_point: 'value',   rep: 0.7, inventory: 0.6, pricing: 0.6, clamp: baseClamp };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreCompetitor', () => {
  it('returns 0 when brand not found in catalog', () => {
    const unknown: Competitor = { id: 'x', name: 'X', brand: 'ghost', personality: 'value_dealer', price_point: 'value', rep: 0.5, inventory: 0.5, pricing: 0.5, clamp: baseClamp };
    expect(scoreCompetitor(unknown, luxurySeeker, brands)).toBe(0);
  });

  it('returns a finite number for any valid input', () => {
    for (const visit of [luxurySeeker, truckBuyer, repFocused, priceFocused]) {
      for (const dealer of [castillacDealer, cordenDealer, dealerA, dealerB]) {
        const s = scoreCompetitor(dealer, visit, brands);
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });

  it('is deterministic: same inputs produce same output', () => {
    const s1 = scoreCompetitor(castillacDealer, luxurySeeker, brands);
    const s2 = scoreCompetitor(castillacDealer, luxurySeeker, brands);
    expect(s1).toBe(s2);
  });

  it('brand mismatch: luxury-seeker scores castillac dealer higher than equivalent corden dealer', () => {
    const castillacScore = scoreCompetitor(castillacDealer, luxurySeeker, brands);
    const cordenScore    = scoreCompetitor(cordenDealer,    luxurySeeker, brands);
    expect(castillacScore).toBeGreaterThan(cordenScore);
  });

  it('brand match: truck buyer scores corden dealer higher than castillac dealer', () => {
    // Same stats, different brands
    const castillacScore = scoreCompetitor(castillacDealer, truckBuyer, brands);
    const cordenScore    = scoreCompetitor(cordenDealer,    truckBuyer, brands);
    expect(cordenScore).toBeGreaterThan(castillacScore);
  });

  it('triangle substitutability: high-rep expensive dealer wins for trust-oriented customer', () => {
    // dealerA: rep=0.9, pricing=0.8 (expensive but reputable)
    // dealerB: rep=0.2, pricing=0.2 (cheap but unknown)
    const aScore = scoreCompetitor(dealerA, repFocused, brands);
    const bScore = scoreCompetitor(dealerB, repFocused, brands);
    expect(aScore).toBeGreaterThan(bScore);
  });

  it('triangle substitutability: cheap low-rep dealer wins for price-sensitive customer', () => {
    // dealerB (cheap) should beat dealerA (expensive) for economy-focused customer
    const aScore = scoreCompetitor(dealerA, priceFocused, brands);
    const bScore = scoreCompetitor(dealerB, priceFocused, brands);
    expect(bScore).toBeGreaterThan(aScore);
  });
});
