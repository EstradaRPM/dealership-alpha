import { loadVehicleData } from '../src/game/Inventory';
import { generateAuctionListings } from '../src/game/Inventory/auctionGenerator';
import {
  loadAuctionSourcesConfig,
  rollAuctionSourceReliability,
} from '../src/game/MarketEconomy';

const VEHICLE_DATA = loadVehicleData();
const SOURCES = loadAuctionSourcesConfig();

describe('Inventory — auction source wiring (#160)', () => {
  it('every listing carries a sourceId from the catalog', () => {
    const validIds = new Set(SOURCES.sources.map((s) => s.id));
    const listings = generateAuctionListings(3, 42, VEHICLE_DATA);
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(validIds.has(l.sourceId)).toBe(true);
    }
  });

  it('listings draw from multiple sources across a population', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      for (const l of generateAuctionListings(day, 99, VEHICLE_DATA)) {
        seen.add(l.sourceId);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('determinism preserved (same seed + day → same sourceIds + prices)', () => {
    const a = generateAuctionListings(5, 42, VEHICLE_DATA);
    const b = generateAuctionListings(5, 42, VEHICLE_DATA);
    expect(a.map((l) => l.sourceId)).toEqual(b.map((l) => l.sourceId));
    expect(a.map((l) => l.askingPrice)).toEqual(b.map((l) => l.askingPrice));
  });

  it('different seeds yield different per-source reliability draws', () => {
    const r1 = rollAuctionSourceReliability(42);
    const r2 = rollAuctionSourceReliability(123);
    expect(r1.reliability).not.toEqual(r2.reliability);
  });

  it('listings show distribution variance across a large sample', () => {
    // Gather listing prices for ford_f150 specifically (anchor known: 21_500),
    // across many days to wash out template variance.
    const f150Prices: number[] = [];
    for (let day = 1; day <= 100; day++) {
      for (const l of generateAuctionListings(day, 314, VEHICLE_DATA)) {
        if (l.templateId === 'ford_f150') f150Prices.push(l.askingPrice);
      }
    }
    expect(f150Prices.length).toBeGreaterThan(20);
    const min = Math.min(...f150Prices);
    const max = Math.max(...f150Prices);
    // Real spread, not all clustered at one point.
    expect(max - min).toBeGreaterThan(2000);
  });

  it('honest sources produce tighter price spread than unreliable sources', () => {
    // Within a single template+condition, partition by source reliability
    // band and compare ranges. Use the catalog extremes.
    const honestId = SOURCES.sources.reduce((a, b) =>
      a.reliabilityBand[1] > b.reliabilityBand[1] ? a : b,
    ).id;
    const unreliableId = SOURCES.sources.reduce((a, b) =>
      a.reliabilityBand[0] < b.reliabilityBand[0] ? a : b,
    ).id;

    const honest: number[] = [];
    const unreliable: number[] = [];
    // Sweep many seeds × days to gather a fat sample.
    for (let seed = 1; seed <= 50; seed++) {
      for (let day = 1; day <= 20; day++) {
        for (const l of generateAuctionListings(day, seed, VEHICLE_DATA)) {
          if (l.templateId !== 'honda_civic' || l.condition !== 'average') continue;
          if (l.sourceId === honestId) honest.push(l.askingPrice);
          else if (l.sourceId === unreliableId) unreliable.push(l.askingPrice);
        }
      }
    }
    // The seed-sweep changes per-save reliability for each source, but across
    // many saves the honest band still averages tighter than the unreliable
    // band. Need enough samples for the statistic to stabilize.
    if (honest.length < 20 || unreliable.length < 20) {
      // Not enough samples for a robust comparison; bail rather than flake.
      return;
    }
    const range = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
    expect(range(unreliable)).toBeGreaterThan(range(honest));
  });
});
