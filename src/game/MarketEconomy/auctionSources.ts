import { createRng, deriveSeed } from '../NPC/Rng';
import { loadTunables, type Tunables } from '../data';
import {
  loadAuctionSourcesConfig,
  type AuctionSourcesConfig,
  type AuctionSourceDefinition,
} from './schemas';

/**
 * Per-save auction-source reliability + motivated-seller noise (slice #160 —
 * the "A loud" dopamine layer from #182). Each save rolls one reliability
 * scalar per source from the catalog band; the value never changes for that
 * save. Listings then draw a per-listing motivated-seller multiplier whose
 * spread widens as source reliability drops — honest sources cluster tightly
 * around honest book, fringe lanes throw both bargains and overpriced
 * lemons-in-waiting.
 *
 * Determinism: reliability draws are seeded by `(masterSeed, sourceId)`;
 * the per-listing multiplier draw is seeded by `(masterSeed, day, index)`
 * via the auction generator. No persistence — seed + catalog are the
 * canonical artifact (same precedent as the #156 personality vector).
 */
export interface AuctionSourceReliability {
  readonly reliability: Readonly<Record<string, number>>;
}

export function rollAuctionSourceReliability(
  masterSeed: number,
  catalog: AuctionSourcesConfig = loadAuctionSourcesConfig(),
): AuctionSourceReliability {
  const reliability: Record<string, number> = {};
  for (const src of catalog.sources) {
    const rng = createRng(
      deriveSeed(masterSeed, 'market_economy.auction_source', { sourceId: src.id }),
    );
    const t = rng();
    const [lo, hi] = src.reliabilityBand;
    reliability[src.id] = lo + (hi - lo) * t;
  }
  return { reliability };
}

export function pickAuctionSource(
  catalog: AuctionSourcesConfig,
  rng: () => number,
): AuctionSourceDefinition {
  const idx = Math.floor(rng() * catalog.sources.length);
  return catalog.sources[Math.min(idx, catalog.sources.length - 1)];
}

export interface MotivatedSellerConfig {
  readonly meanMultiplier: number;
  readonly stdevHonest: number;
  readonly stdevUnreliable: number;
  readonly floor: number;
  readonly ceiling: number;
}

/**
 * Sample one motivated-seller multiplier. Reliability ∈ [0,1] lerps the
 * stdev from `stdevHonest` (most-reliable) to `stdevUnreliable` (least), then
 * a Box-Muller normal is centered at `meanMultiplier` and clipped to
 * `[floor, ceiling]`. The clip is the tail-truncation that turns the tails
 * into hard "bargain finds" / "overpriced" caps.
 */
export function sampleMotivatedSellerMultiplier(
  reliability: number,
  seed: number,
  cfg: MotivatedSellerConfig,
): number {
  const rng = createRng(seed);
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const r = Math.min(1, Math.max(0, reliability));
  const stdev = cfg.stdevHonest + (1 - r) * (cfg.stdevUnreliable - cfg.stdevHonest);
  const raw = cfg.meanMultiplier + z * stdev;
  if (raw < cfg.floor) return cfg.floor;
  if (raw > cfg.ceiling) return cfg.ceiling;
  return raw;
}

export function loadMotivatedSellerConfig(
  tunables: Tunables = loadTunables(),
): MotivatedSellerConfig {
  return tunables.marketEconomy.motivatedSeller;
}
