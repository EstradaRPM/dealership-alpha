/**
 * The #247 run loop: drive one (policy, seed) world through the REAL game and
 * record its pacing facts.
 *
 * Composition is the live `createWorld` — the harness measures the actual game,
 * not a reimplementation. Each MANAGERIAL phase the policy makes its decisions,
 * then `dayLoop.nextDay().runDay()` plays the full day headlessly. A hard
 * insolvency throw on the floor (recon spend the game can't cover) is caught
 * and recorded as a `bankrupt` outcome; a modeled `career:game_over` ends the
 * run as `gameover`.
 */
import { createEventBus } from '../../src/game/EventBus';
import { createWorld } from '../../src/createWorld';
import { loadTunables } from '../../src/game/data';
import type { CharacterProfile } from '../../src/game/CareerProgression';
import { resetPolicies, type Policy } from './policies';
import type {
  EndedReason,
  MonthVerdictRec,
  RunResult,
  RunSample,
} from './types';

/** A fixed, balance-neutral founder so every run starts from the same place —
 *  the only thing that varies across runs is the masterSeed and the policy. */
const PROFILE: CharacterProfile = {
  name: 'Harness Bot',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const STRONG_MATCH = loadTunables().matchPayoff.strongMatchThreshold;

export interface RunOptions {
  readonly maxDays: number;
}

function bindingFace(
  faces: readonly { id: string; ratio: number }[],
): { id: string | null; ratio: number | null } {
  if (faces.length === 0) return { id: null, ratio: null };
  const worst = faces.reduce((m, f) => (f.ratio < m.ratio ? f : m));
  return { id: worst.id, ratio: worst.ratio };
}

export function runOne(policy: Policy, seed: number, opts: RunOptions): RunResult {
  resetPolicies();
  const bus = createEventBus();
  const world = createWorld({
    bus,
    masterSeed: seed,
    characterProfile: PROFILE,
    tradeEscalationOverride: policy.tradeEscalationOverride,
    getTradePolicyMultiplier:
      policy.tradePolicyMultiplier != null
        ? () => policy.tradePolicyMultiplier as number
        : undefined,
  });

  const tierReachedDay: Record<number, number> = { 1: 0 };
  const verdicts: MonthVerdictRec[] = [];
  const samples: RunSample[] = [];
  let arrivals = 0;
  let closes = 0;
  let strongMatches = 0;
  let gameOver = false;

  bus.subscribe('career:tier_up', (p) => {
    if (tierReachedDay[p.toTier] === undefined) tierReachedDay[p.toTier] = p.day;
  });
  bus.subscribe('deal:closed', () => {
    closes += 1;
  });
  bus.subscribe('staff:auto_resolved', (p) => {
    if (p.outcome === 'closed' && p.matchQuality != null && p.matchQuality >= STRONG_MATCH) {
      strongMatches += 1;
    }
  });
  bus.subscribe('tierGate:month_verdict', (p) => {
    const binding = bindingFace(p.faces as readonly { id: string; ratio: number }[]);
    verdicts.push({
      month: p.month,
      tier: p.tier,
      overall: p.overall,
      bindingFaceId: binding.id,
      bindingRatio: binding.ratio,
    });
  });
  bus.subscribe('career:game_over', () => {
    gameOver = true;
  });

  let endedReason: EndedReason = 'completed';
  let endedDay = 0;

  for (let i = 0; i < opts.maxDays; i++) {
    policy.manage({ world });
    try {
      const floor = world.dayLoop.nextDay();
      floor.runDay();
      arrivals += floor.totalArrivals;
    } catch {
      endedReason = 'bankrupt';
      endedDay = world.clock.currentDay;
      break;
    }

    const lot = world.inventory.getLotVehicles();
    samples.push({
      day: world.clock.currentDay,
      cash: Math.round(world.economy.cash),
      lotCount: lot.length,
      lotValue: Math.round(lot.reduce((s, v) => s + v.suggestedRetail, 0)),
      cumUnits: closes,
      tier: world.tierManager.currentTier,
      csi: Math.round(world.reputation.reviewScore * 10) / 10,
    });

    if (gameOver) {
      endedReason = 'gameover';
      endedDay = world.clock.currentDay;
      break;
    }
  }
  if (endedReason === 'completed') endedDay = world.clock.currentDay;

  return {
    policyId: policy.id,
    seed,
    tierReachedDay,
    verdicts,
    samples,
    arrivals,
    closes,
    strongMatches,
    finalTier: world.tierManager.currentTier,
    finalCash: Math.round(world.economy.cash),
    endedReason,
    endedDay,
  };
}

/** Run a policy across a seed cohort (sequential ⇒ deterministic ordering). */
export function runCohort(policy: Policy, seeds: readonly number[], opts: RunOptions): RunResult[] {
  return seeds.map((seed) => runOne(policy, seed, opts));
}
