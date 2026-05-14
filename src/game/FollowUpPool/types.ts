import type { CustomerBundle } from '../NPC';

export interface FollowUpEntry {
  readonly customerId: string;
  readonly walkedDay: number;
  readonly bundle: CustomerBundle;
  readonly initialHeat: number;
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
}
