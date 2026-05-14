import type { StaffWithComposites } from '../NPC/factories/StaffFactory';

export type { StaffWithComposites };

export interface CandidateListing {
  candidateId: string;
  archetypeId: string;
  staff: StaffWithComposites;
  hiringCost: number;
}
