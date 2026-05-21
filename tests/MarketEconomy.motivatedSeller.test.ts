import {
  rollAuctionSourceReliability,
  sampleMotivatedSellerMultiplier,
  loadMotivatedSellerConfig,
  loadAuctionSourcesConfig,
  type MotivatedSellerConfig,
} from '../src/game/MarketEconomy';
import { deriveSeed } from '../src/game/NPC/Rng';

const CATALOG = loadAuctionSourcesConfig();
const CFG: MotivatedSellerConfig = loadMotivatedSellerConfig();

describe('MarketEconomy — auction source reliability (#160)', () => {
  it('catalog has ≥5 sources covering the reliability spectrum', () => {
    expect(CATALOG.sources.length).toBeGreaterThanOrEqual(5);
    const bands = CATALOG.sources.map((s) => s.reliabilityBand);
    const minLow = Math.min(...bands.map((b) => b[0]));
    const maxHigh = Math.max(...bands.map((b) => b[1]));
    expect(minLow).toBeLessThan(0.4); // at least one fringe lane
    expect(maxHigh).toBeGreaterThan(0.85); // at least one clean national source
  });

  it('roll is deterministic for the same seed', () => {
    const a = rollAuctionSourceReliability(42, CATALOG);
    const b = rollAuctionSourceReliability(42, CATALOG);
    expect(a.reliability).toEqual(b.reliability);
  });

  it('different seeds produce different reliability vectors', () => {
    const a = rollAuctionSourceReliability(42, CATALOG);
    const b = rollAuctionSourceReliability(43, CATALOG);
    expect(a.reliability).not.toEqual(b.reliability);
  });

  it('each reliability falls within its source band', () => {
    const draws = rollAuctionSourceReliability(101, CATALOG);
    for (const src of CATALOG.sources) {
      const r = draws.reliability[src.id];
      expect(r).toBeGreaterThanOrEqual(src.reliabilityBand[0]);
      expect(r).toBeLessThanOrEqual(src.reliabilityBand[1]);
    }
  });
});

describe('MarketEconomy — motivated-seller multiplier (#160)', () => {
  function manyDraws(reliability: number, n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const seed = deriveSeed(7, 'test.motivated_seller', { reliability, i });
      out.push(sampleMotivatedSellerMultiplier(reliability, seed, CFG));
    }
    return out;
  }

  function stdev(xs: readonly number[]): number {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
    return Math.sqrt(v);
  }

  it('honest source clusters near meanMultiplier', () => {
    const draws = manyDraws(1.0, 2000);
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(Math.abs(mean - CFG.meanMultiplier)).toBeLessThan(0.02);
  });

  it('honest source produces tighter distribution than unreliable source', () => {
    const honest = manyDraws(0.95, 2000);
    const unreliable = manyDraws(0.10, 2000);
    expect(stdev(unreliable)).toBeGreaterThan(stdev(honest) * 2);
  });

  it('multiplier respects floor and ceiling clip', () => {
    const draws = manyDraws(0, 3000);
    for (const d of draws) {
      expect(d).toBeGreaterThanOrEqual(CFG.floor);
      expect(d).toBeLessThanOrEqual(CFG.ceiling);
    }
  });

  it('same seed + reliability → same multiplier (deterministic)', () => {
    const seed = deriveSeed(7, 'test.motivated_seller', { reliability: 0.5, i: 0 });
    const a = sampleMotivatedSellerMultiplier(0.5, seed, CFG);
    const b = sampleMotivatedSellerMultiplier(0.5, seed, CFG);
    expect(a).toBe(b);
  });
});
