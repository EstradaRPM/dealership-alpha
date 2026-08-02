/**
 * Deterministic master-seed cohort for the #247 harness.
 *
 * Reuses the game's own `deriveSeed` so the cohort is well-spread and a
 * `(baseSeed, count)` pair always yields the exact same list of per-run
 * masterSeeds — the backbone of the harness's "same seeds ⇒ identical output"
 * determinism guarantee.
 */
import { createRng, deriveSeed } from '../../src/game/Rng';

export function deriveSeeds(baseSeed: number, count: number): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push(deriveSeed(baseSeed, 'balance.harness.seed', { i }));
  }
  return seeds;
}

/**
 * A seeded uniform stream for the harness's own decisions — the #345 search's
 * initial design and acquisition sampling. Re-exported through this module so
 * the harness keeps exactly one reach into the game's RNG, and so a study's
 * trial sequence is a pure function of its base seed.
 */
export function createHarnessRng(seed: number): () => number {
  return createRng(deriveSeed(seed, 'balance.harness.search', {}));
}
