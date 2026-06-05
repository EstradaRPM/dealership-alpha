import type { CustomerBundle } from '../NPC';

export type CallbackOutcome = 'success' | 'failure';

export interface FollowUpEntry {
  readonly customerId: string;
  readonly walkedDay: number;
  readonly bundle: CustomerBundle;
  readonly initialHeat: number;
  readonly archetypeLabel: string;
  heat: number;
}

export interface ArchivedEntry {
  readonly customerId: string;
  readonly walkedDay: number;
  readonly bundle: CustomerBundle;
  readonly initialHeat: number;
  readonly archivedDay: number;
}

/**
 * Save/load blob (#193). Self-versioned per the #188 contract. Captures the
 * active follow-ups, the archived (dead-heat) history, and the last-seen day
 * so a restore reproduces both the actionable BDC pool and the historical
 * record exactly.
 */
export interface FollowUpPoolSnapshot {
  readonly schemaVersion: 1;
  readonly active: readonly FollowUpEntry[];
  readonly archived: readonly ArchivedEntry[];
  readonly currentDay: number;
}

export interface FollowUpPool {
  getFollowUps(): readonly Readonly<FollowUpEntry>[];
  getFollowUp(customerId: string): Readonly<FollowUpEntry> | undefined;
  getArchived(): readonly ArchivedEntry[];
  /** roll: 0–1 uniform random. Success when roll < heat/initialHeat. */
  attemptCallback(customerId: string, roll: number): CallbackOutcome;
  snapshot(): FollowUpPoolSnapshot;
  restore(snap: FollowUpPoolSnapshot): void;
}
