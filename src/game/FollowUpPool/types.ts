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

export interface FollowUpPool {
  getFollowUps(): readonly Readonly<FollowUpEntry>[];
  getFollowUp(customerId: string): Readonly<FollowUpEntry> | undefined;
  getArchived(): readonly ArchivedEntry[];
  /** roll: 0–1 uniform random. Success when roll < heat/initialHeat. */
  attemptCallback(customerId: string, roll: number): CallbackOutcome;
}
