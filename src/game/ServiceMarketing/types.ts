/**
 * ServiceMarketing types (#307, parent #297).
 *
 * ServiceMarketing owns the two service-marketing arms — distinct from sales
 * advertising — that feed the Service profit center's demand/return math:
 *  - RETENTION: a chosen campaign whose `returnLift` is added to InstalledBase's
 *    return roll (raises return rate, slows defection).
 *  - CONQUEST: a single category-targeted special whose `volumeBoost` scales
 *    ServiceDemand's conquest volume and whose `categoryBias` skews the incoming
 *    mix toward the promoted job category.
 * Each active arm debits its daily cost from Economy.
 */

import type { JobCategory } from '../InstalledBase';

export type { JobCategory } from '../InstalledBase';

/** The conquest special's promoted job category, or `'none'` for no special. */
export type ConquestSelection = JobCategory | 'none';

/** The category-skew the conquest arm injects into the ServiceDemand mix: the
 *  promoted category multiplied by `1 + strength`. */
export interface ConquestBias {
  readonly category: JobCategory;
  readonly strength: number;
}

/** A retention campaign's player-facing descriptor (no tunable magnitudes). */
export interface RetentionCampaignOption {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

/** Persisted lever state — just the two selections; magnitudes live in data. */
export interface ServiceMarketingSnapshot {
  readonly schemaVersion: 1;
  /** Active retention campaign id, or `'none'`. */
  readonly retentionCampaignId: string;
  /** Active conquest special's promoted category, or `'none'`. */
  readonly conquestCategory: ConquestSelection;
}

/**
 * The ServiceMarketing module surface. A library/factory module (no EventBus
 * participation): the composition root drives `advanceDay` on
 * `clock:day_started` and wires the influence reads into InstalledBase
 * (retention) and ServiceDemand (conquest). Lever state persists via the world
 * snapshot.
 */
export interface ServiceMarketing {
  /** The retention campaigns the player can choose between (data-driven). */
  readonly retentionCampaigns: readonly RetentionCampaignOption[];
  /** The active retention campaign id, or `'none'`. */
  getRetentionCampaign(): string;
  /** Select a retention campaign (`'none'` clears). Throws on an unknown id. */
  setRetentionCampaign(id: string): void;
  /** The active campaign's return-rate lift in [0,1], or 0 when none active.
   *  Added to InstalledBase's return-roll `convenience` term. */
  retentionLift(): number;

  /** The active conquest special's promoted category, or `'none'`. */
  getConquestSpecial(): ConquestSelection;
  /** Aim the conquest special at a job category (`'none'` clears). Throws on an
   *  unknown category. */
  setConquestSpecial(category: ConquestSelection): void;
  /** The conquest-volume influence in [0,1] (the `volumeBoost`), or 0 when no
   *  special is active. Feeds ServiceDemand's `serviceMarketing` input. */
  conquestVolumeInfluence(): number;
  /** The mix-skew toward the promoted category, or null when none active. */
  conquestBias(): ConquestBias | null;

  /** Debit each active arm's daily cost from Economy. Called once per day. */
  advanceDay(day: number): void;

  snapshot(): ServiceMarketingSnapshot;
  restore(snap: ServiceMarketingSnapshot): void;
}
