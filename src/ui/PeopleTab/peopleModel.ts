import type { PeopleDepartmentId } from './departments';

/** One skill axis as a staff card shows it (#347). */
export interface PeopleSkillRead {
  readonly id: string;
  /** Plain-language axis name, from `data/staff-skills.json`. */
  readonly label: string;
  /** Current value on the 0…`cap` scale. */
  readonly value: number;
  readonly cap: number;
}

/** A legal promotion target, already labelled for display (#324). */
export interface PeoplePromotionOption {
  readonly toRoleId: string;
  readonly label: string;
}

/**
 * A raise this person is waiting on an answer to (#356). Both wages are carried
 * because the prompt states both: what they are on, and what they are asking
 * for. The player is choosing between two numbers, so both have to be on screen.
 */
export interface PeopleRaiseAsk {
  /** What they are paid today. */
  readonly currentWage: number;
  /** What they are asking to be paid — or what a rival has offered them. */
  readonly askedWage: number;
  /**
   * The rival who made the offer (#357), or `null` when this is the person
   * asking for themselves. One prompt covers both: with a name on it the two
   * buttons become **Match** / **Let them go**, and a deadline line appears.
   */
  readonly rivalName?: string | null;
  /** The day they leave unless the offer is matched. Set with `rivalName`. */
  readonly deadlineDay?: number | null;
}

/** One person on payroll. */
export interface PeopleRosterMember {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  /** Which department's panel they sit in — their role's department. */
  readonly department: PeopleDepartmentId;
  /** 0–1. How well they do the work (the `effectiveness` composite). */
  readonly workQuality: number;
  /** 0–1. How straight they play it (the `trustworthiness` composite). */
  readonly honesty: number;
  /** 0–1, or `null` when morale isn't being tracked for this staffer. */
  readonly morale: number | null;
  /** What they are worth right now, 1–5 — climbs as their skills grow (#353). */
  readonly grade: number;
  /**
   * The grade their wage is set at (#353). Equal to `grade` for a fresh hire;
   * once they outgrow it the card states BOTH, because the gap is the thing
   * the player is about to be asked to close.
   */
  readonly paidGrade: number;
  /** What this person costs per day — `wage(role, paidGrade)`, the sum the ledger charges. */
  readonly dailyWage: number;
  readonly skills: readonly PeopleSkillRead[];
  readonly promotions: readonly PeoplePromotionOption[];
  /** Their outstanding raise demand, or `null` when they are not asking (#356). */
  readonly raise: PeopleRaiseAsk | null;
}

/** One person you could hire today. */
export interface PeopleCandidate {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  /** Which department's hiring panel they appear under. */
  readonly department: PeopleDepartmentId;
  readonly traits: readonly string[];
  readonly workQuality: number;
  readonly honesty: number;
  /** The grade they'd sign at, 1–5 — what their wage is priced off (#353). */
  readonly grade: number;
  /** What they'd cost per day once hired. */
  readonly dailyWage: number;
  readonly skills: readonly PeopleSkillRead[];
  /** One-time sign-on fee — distinct from the wage, so the card labels both. */
  readonly hiringCost: number;
}

/** One job you can shop for, and the department whose panel it belongs to. */
export interface PeopleRoleOption {
  readonly id: string;
  readonly label: string;
  readonly department: PeopleDepartmentId;
}

export interface PeopleHiringModel {
  readonly roleOptions: readonly PeopleRoleOption[];
  readonly selectedRoleId: string;
  readonly candidates: readonly PeopleCandidate[];
  /** Cash on hand — a candidate you can't afford can't be hired. */
  readonly cash: number;
}

/**
 * One job's desks at the current tier (#352). This replaced the single
 * "N of cap" line: scarcity is per role, so "3 of 4 people" told the player
 * nothing about the job they were actually shopping for.
 */
export interface PeopleSlotRow {
  readonly roleId: string;
  readonly label: string;
  /** Which department's panel this job's desks are counted in. */
  readonly department: PeopleDepartmentId;
  readonly filled: number;
  readonly total: number;
  /**
   * Whether an open desk here can be filled by hiring. False for the
   * promotion-only jobs, whose desks are reached from a roster card instead.
   */
  readonly hireable: boolean;
}

/** `$340/day` — the wage grammar shared by every card on this surface. */
export function wageText(dailyWage: number): string {
  return `$${dailyWage.toLocaleString()}/day`;
}
