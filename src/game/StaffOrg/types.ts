import type { StaffWithComposites } from '../NPC/factories/StaffFactory';

export type { StaffWithComposites };

export interface CandidateListing {
  candidateId: string;
  archetypeId: string;
  staff: StaffWithComposites;
  hiringCost: number;
  /**
   * The grade this candidate would be hired at (#353) — stamped onto them as
   * `paidGrade` the moment they are hired.
   */
  grade: number;
  /**
   * What they will cost per day (#353). Listed beside `hiringCost` because
   * those are now the two numbers the hire decision is made on: what they cost
   * to sign, and what they cost to keep.
   */
  dailyWage: number;
}
