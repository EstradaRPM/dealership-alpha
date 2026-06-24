/**
 * Shared result types for the #247 headless balance harness.
 *
 * The harness drives the REAL game (`createWorld` → `DayLoopController`) with a
 * policy bot for N in-game days and records the pacing-relevant facts. Nothing
 * here is game logic — it is pure measurement of the live sim's emergent output.
 */
import type { GateBand } from '../../src/game/TierGate';

/** One per-day metric sample (mode C calibration time-series). */
export interface RunSample {
  readonly day: number;
  readonly cash: number;
  /** Vehicles on the lot at end of day. */
  readonly lotCount: number;
  /** Σ suggestedRetail over the lot — a coarse inventory-value proxy. */
  readonly lotValue: number;
  /** Cumulative retail units sold (deal:closed count to date). */
  readonly cumUnits: number;
  readonly tier: number;
  /** CSI = reputation review score [0,100]. */
  readonly csi: number;
}

/** One month-end gate verdict, with the binding (worst-ratio) face identified. */
export interface MonthVerdictRec {
  readonly month: number;
  readonly tier: number;
  readonly overall: GateBand;
  /** Face id with the lowest ratio — the binding constraint that graded the month. */
  readonly bindingFaceId: string | null;
  readonly bindingRatio: number | null;
}

export type EndedReason = 'completed' | 'bankrupt' | 'gameover';

/** The full record of a single (policy, seed) run. */
export interface RunResult {
  readonly policyId: string;
  readonly seed: number;
  /** Tier number → first in-game day it was reached (tier 1 = day 0, the boot). */
  readonly tierReachedDay: Readonly<Record<number, number>>;
  readonly verdicts: readonly MonthVerdictRec[];
  readonly samples: readonly RunSample[];
  /** Total customer arrivals across the run (Σ floor.totalArrivals). */
  readonly arrivals: number;
  /** Retail units closed. */
  readonly closes: number;
  /** Closes whose matchQuality ≥ matchPayoff.strongMatchThreshold (#199). */
  readonly strongMatches: number;
  readonly finalTier: number;
  readonly finalCash: number;
  readonly endedReason: EndedReason;
  /** For `gameover` runs, the EndCard terminal reason that settled it
   *  (`bankruptcy` | `indictment` | `ag_complaint` | success endings); null
   *  otherwise. Lets the report separate a MODELED bankruptcy from other
   *  game-overs — `endedReason` alone tags only the hard insolvency throw. */
  readonly gameOverReason: string | null;
  /** In-game day the run stopped (maxDays for `completed`). */
  readonly endedDay: number;
}

/** Aggregate pacing stats for one tier across a policy's seed cohort. */
export interface TierDwellStat {
  readonly tier: number;
  /** Seeds that reached this tier. */
  readonly reachedCount: number;
  /** Of those, seeds that also reached the next tier (dwell is defined). */
  readonly advancedCount: number;
  /** Dwell quantiles in in-game DAYS (only over advancedCount runs). */
  readonly p10Days: number | null;
  readonly medianDays: number | null;
  readonly p90Days: number | null;
  /** medianDays / daysPerMonth. */
  readonly medianMonths: number | null;
  /** Target median months from data/tier-pacing-targets.json (null if absent). */
  readonly targetMonths: number | null;
  /** Whether medianMonths is within ±toleranceBand of targetMonths. */
  readonly withinTolerance: boolean | null;
}

/** How a cohort's runs ended. The two bankruptcy buckets are kept SEPARATE on
 *  purpose: a single combined "bankruptcy rate" previously HID modeled
 *  bankruptcies, because the runner tags only the hard mid-floor insolvency
 *  THROW as `bankrupt` and routes a modeled bankruptcy (cash<0 →
 *  `career:bankruptcy_terminal` → game-over) through the `gameover` bucket. */
export interface EndReasonBreakdown {
  /** Survived to maxDays still solvent. */
  readonly completed: number;
  /** Hard mid-floor insolvency throw (`endedReason === 'bankrupt'`). */
  readonly insolventThrow: number;
  /** Modeled bankruptcy: `career:bankruptcy_terminal` → `career:game_over`. */
  readonly modeledBankruptcy: number;
  /** Any other modeled game-over (indictment, ag_complaint, success endings). */
  readonly otherGameOver: number;
}

/** One policy's full pacing summary over a seed cohort. */
export interface PolicyPacing {
  readonly policyId: string;
  readonly seedCount: number;
  /** Full end-state breakdown. Replaces the old single `bankruptcyRate`, which
   *  read 0% even when most seeds bankrupted (see EndReasonBreakdown). */
  readonly endReasons: EndReasonBreakdown;
  readonly tiers: readonly TierDwellStat[];
  /** Median final tier reached across the cohort. */
  readonly medianFinalTier: number;
}
