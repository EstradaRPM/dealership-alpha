import { createRng } from '../Rng';

/**
 * Execution-fidelity drift (channel-desk M5, #292).
 *
 * The refinement above every channel-desk *act* gate (manager-roles-channel-desk
 * .md §4): **skill = fidelity to the player's setpoint + success.** Above a gate
 * a manager always *aims* at the player's intent (pricing posture, escalation
 * policy, sourcing lean); skill governs the gap between aim and result. A worse
 * manager **drifts toward worse outcomes** (mis-priced units, weaker counters,
 * looser allowances); a better one holds tight. The deficit is *always* drift
 * toward worse, never ignoring the player.
 *
 * This is the one shared, pure primitive the three unlocked UCM acting
 * capabilities scale their drift through (pricing target adherence, desking
 * counter quality, trade allowance tightness), so "higher skill ⇒ tighter
 * adherence" is expressed once. Deterministic in `(skill, seed)`: skill is
 * constant within an open day (the overnight derived-skill recompute, M7) and
 * the seed is derived per (entity, day) at the call site, so a #122 mid-day
 * replay reproduces the same drift — no desync.
 */

/** Per-capability drift tuning (`data/tunables.json` → `managerGates.executionDrift`). */
export interface SkillDriftConfig {
  /**
   * The drift fraction reached as skill → 0 (a manager that just cleared the
   * act gate). Scales linearly down to ~0 as skill rises to `skillReference`.
   */
  readonly maxDriftFraction: number;
  /**
   * The skill (0–100) at which a manager holds the player's setpoint tight
   * (drift floors out). A green-but-gated manager sits well below it; a
   * seasoned pro at/above it.
   */
  readonly skillReference: number;
}

/**
 * The drift *span* for a skill — the deficit-scaled ceiling a realized draw
 * fills. `deficit = clamp01(1 − skill/skillReference)`, so a manager at the
 * reference (or above) has zero span (perfect adherence) and a just-gated one
 * has the full `maxDriftFraction`. Monotonic in skill. Pure, no RNG.
 */
function driftSpan(skill: number, config: SkillDriftConfig): number {
  const ref = config.skillReference <= 0 ? 1 : config.skillReference;
  const deficitRaw = 1 - skill / ref;
  const deficit = deficitRaw < 0 ? 0 : deficitRaw > 1 ? 1 : deficitRaw;
  return deficit * config.maxDriftFraction;
}

/**
 * A non-negative, deterministic drift fraction in `[0, deficit×maxDriftFraction)`.
 * The caller applies it toward the single *worse* direction for that capability
 * (a weaker desking counter, a looser trade allowance). Higher skill ⇒ smaller
 * span ⇒ tighter adherence. Deterministic in `(skill, seed)`.
 */
export function skillDriftFraction(
  skill: number,
  seed: number,
  config: SkillDriftConfig,
): number {
  return driftSpan(skill, config) * createRng(seed)();
}

/**
 * A *signed* deterministic drift fraction in `(−span, +span)` for capabilities
 * whose worse outcome is a two-sided **mis-target** (a mis-priced unit: too high
 * sits on the lot, too low leaves money — both worse than the aimed setpoint).
 * Magnitude and sign are drawn from one seeded stream, so it stays deterministic
 * in `(skill, seed)`. Higher skill ⇒ tighter scatter around the setpoint.
 */
export function signedSkillDrift(
  skill: number,
  seed: number,
  config: SkillDriftConfig,
): number {
  const span = driftSpan(skill, config);
  const rng = createRng(seed);
  const magnitude = span * rng();
  return rng() < 0.5 ? -magnitude : magnitude;
}
