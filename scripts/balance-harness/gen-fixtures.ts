/**
 * #248 — generate Tier-N dev fixtures.
 *
 * Human feel-testing of T2+ otherwise requires playing up through every tier
 * below it. This script drives the #247 **competent** policy through the REAL
 * game (`createWorld` → `DayLoopController`) and, at the first clean
 * day-boundary the world enters each target tier, captures the live
 * `worldSnapshot` into a committed `SaveState` fixture
 * (`data/fixtures/tier-N.json`). The dev MainMenu loads these through the
 * normal slot/restore path (no parallel loader), so a human can start a
 * representative mid-game world at any tier.
 *
 * Determinism: a fixed seed + the competent policy ⇒ byte-stable fixtures.
 * Fixtures go stale when the worldSnapshot envelope version bumps — regenerate
 * with one command:  npm run gen:fixtures  (see docs/balance-harness-recipe.md).
 *
 * The snapshot is taken AFTER `runDay()` completes (floor closed, no visit
 * mid-flight) — the same clean day boundary the live autosave uses, so the
 * fixture restores exactly like a normal save.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEventBus } from '../../src/game/EventBus';
import { createWorld } from '../../src/createWorld';
import { snapshotWorld } from '../../src/worldSnapshot';
import { POLICIES, policyById } from './policies';
import { PROFILE } from './runner';
import { deriveSeeds } from './seeds';

/** Current tier frontier is Tiers 1–3; Tier 1 is the normal start, so we capture 2 + 3. */
const TARGET_TIERS = [2, 3] as const;
/** Upper bound on in-game days to reach the top target tier before giving up.
 *  Untuned thresholds (see recipe) can make the climb long; this caps runtime
 *  (~7 ms/day) while leaving ample room for the competent policy to advance. */
const MAX_DAYS = 5000;
const FIXTURE_DIR = join(__dirname, '../../data/fixtures');
const SEED = deriveSeeds(1, 1)[0];

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

/** Read a `--flag value` token from argv (no value ⇒ undefined). */
function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  // Default to the recipe's reference "good player". Overridable (--policy) so
  // a tier the competent climb can't yet reach under untuned thresholds can be
  // captured from a stronger policy until #249 tuning lands.
  const policyId = argValue('--policy') ?? 'competent';
  const policy = policyById(policyId);
  if (!policy) {
    throw new Error(
      `Unknown policy '${policyId}'. Known: ${POLICIES.map((p) => p.id).join(', ')}.`,
    );
  }
  log(`[gen-fixtures] policy=${policy.id}`);

  const bus = createEventBus();
  const world = createWorld({
    bus,
    masterSeed: SEED,
    characterProfile: PROFILE,
    tradeEscalationOverride: policy.tradeEscalationOverride,
    getTradePolicyMultiplier:
      policy.tradePolicyMultiplier != null
        ? () => policy.tradePolicyMultiplier as number
        : undefined,
  });

  let gameOver = false;
  bus.subscribe('career:game_over', () => {
    gameOver = true;
  });

  const captured = new Map<number, unknown>();
  const remaining = new Set<number>(TARGET_TIERS);

  log(`[gen-fixtures] seed ${SEED}, up to ${MAX_DAYS} days …`);
  for (let i = 0; i < MAX_DAYS && remaining.size > 0; i++) {
    policy.manage({ world });
    try {
      world.dayLoop.nextDay().runDay();
    } catch {
      log(`Insolvency on day ${world.clock.currentDay}; stopping early.`);
      break;
    }

    const tier = world.tierManager.currentTier;
    if (remaining.has(tier)) {
      // First clean day-boundary in this tier — capture the live world as a
      // loadable SaveState (world snapshot + the harness founder + its seed).
      captured.set(tier, {
        world: snapshotWorld(world),
        character: PROFILE,
        masterSeed: SEED,
      });
      remaining.delete(tier);
      log(`Captured Tier ${tier} at day ${world.clock.currentDay}.`);
    }

    if (gameOver) {
      log(`career:game_over on day ${world.clock.currentDay}; stopping early.`);
      break;
    }
  }

  mkdirSync(FIXTURE_DIR, { recursive: true });
  let wrote = 0;
  for (const tier of TARGET_TIERS) {
    const state = captured.get(tier);
    if (!state) {
      log(
        `WARNING: never reached Tier ${tier} within ${MAX_DAYS} days — ` +
          `fixture NOT written (the existing tier-${tier}.json, if any, is unchanged).`,
      );
      continue;
    }
    const file = join(FIXTURE_DIR, `tier-${tier}.json`);
    writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
    log(`Wrote ${file}`);
    wrote += 1;
  }
  log(`[gen-fixtures] done — ${wrote}/${TARGET_TIERS.length} fixtures written.`);
  if (wrote < TARGET_TIERS.length) process.exitCode = 1;
}

main();
