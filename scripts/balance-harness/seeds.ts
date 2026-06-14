/**
 * Deterministic master-seed cohort for the #247 harness.
 *
 * Reuses the game's own `deriveSeed` so the cohort is well-spread and a
 * `(baseSeed, count)` pair always yields the exact same list of per-run
 * masterSeeds — the backbone of the harness's "same seeds ⇒ identical output"
 * determinism guarantee.
 */
import { deriveSeed } from '../../src/game/NPC/Rng';

export function deriveSeeds(baseSeed: number, count: number): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push(deriveSeed(baseSeed, 'balance.harness.seed', { i }));
  }
  return seeds;
}
