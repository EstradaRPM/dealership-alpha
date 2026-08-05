import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffTaxonomy } from '../NPC/StaffTaxonomy';
import type { StaffArchetypeCatalog } from '../NPC/schemas/staff-archetype';
import {
  createStaff,
  rehydrateStaff,
  promoteStaff,
  compositeRatio,
  type StaffWithComposites,
} from '../NPC/factories/StaffFactory';
import type { Staff } from '../NPC/schemas/staff';
import { loadStaffOrgConfig, type StaffOrgConfig } from './staffOrgData';
import { loadStaffSlots, slotTotalFor, type StaffSlotTable } from './staffSlots';
import { loadStaffPay, gradeFor, dailyWageFor, type StaffPayTable } from './staffPay';
import type { CandidateListing } from './types';
import {
  computeConditionRead,
  deriveConditionReadSeed,
  CONDITION_READING_SKILL_ID,
  type ConditionRead,
} from './conditionRead';

/**
 * Narrow vehicle shape the UCM reads. Decoupled from `AuctionListing` so
 * StaffOrg stays independent of Inventory's surface — callers project the
 * minimum needed fields (#163). The realized-recon seam reads `mileage`,
 * `condition`, `sourceId`, `reconEstimate` to produce the hidden truth the
 * read is anchored on.
 */
export interface ConditionAssessInput {
  readonly id: string;
  readonly reconEstimate: number;
  readonly condition: 'clean' | 'average' | 'rough';
  readonly mileage: number;
  readonly sourceId: string;
}

export interface StaffOrgDeps {
  bus: EventBus;
  economy: Economy;
  masterSeed: number;
  taxonomy: StaffTaxonomy;
  archetypes: StaffArchetypeCatalog;
  config?: StaffOrgConfig;
  /**
   * The per-role, per-tier desk table (#352). Defaults to
   * `data/staff-slots.json`; injectable so a test can state the scarcity it is
   * exercising instead of depending on shipped balance numbers.
   */
  slots?: StaffSlotTable;
  /**
   * The salary book (#353) — daily wage per role × grade, plus the grade bands.
   * Defaults to `data/staff-pay.json`; injectable so a test can state the wages
   * it is exercising (or opt out of the drain entirely) instead of depending on
   * shipped balance numbers.
   */
  pay?: StaffPayTable;
  getTier?: () => number;
  /**
   * Hidden-truth provider for the UCM condition read (#163). Receives the
   * narrow vehicle shape and returns the realized recon cost the engine
   * already rolled (or will roll) for that vehicle. Omit to disable
   * `assessCondition` entirely — without a truth seam, `assessCondition`
   * always returns null even when a UCM is on staff (the test/fixture path).
   */
  realizedReconFor?: (vehicle: ConditionAssessInput) => number;
}

/**
 * Persistence surface for StaffOrg (#190, parent #186). Captures the hired
 * roster (source of truth for "who is on payroll") plus `currentDay` so the
 * candidate-id namespace stays stable across a reload. The candidate pool is
 * intentionally NOT persisted — it is cleared every `clock:day_started` and
 * regenerated deterministically from `masterSeed`, so the seed + catalog stay
 * the canonical artifact (same pattern as Inventory's auction board, #189).
 * Roster entries are stored as plain `Staff`: the `effectiveness` /
 * `trustworthiness` composites are non-enumerable derived getters that JSON
 * drops, then `restore` re-attaches via `rehydrateStaff`.
 */
export interface StaffOrgSnapshot {
  readonly schemaVersion: 1;
  readonly currentDay: number;
  readonly roster: readonly Staff[];
}

/**
 * A legal, currently-available promotion target for a roster member (#324).
 * `getPromotionOptions` returns one per outgoing role edge that (a) is a legal
 * edge in the data, (b) is unlocked at the current dealership tier, and (c) the
 * staffer's own `promotion_gates` are satisfied for. UI renders an affordance
 * per option; an empty list means "no promote button".
 */
export interface PromotionOption {
  readonly toRoleId: string;
}

/**
 * One role's desks at the current tier (#352). `total` is the tier's slot count
 * from `data/staff-slots.json`; `filled` is how many of them the live roster
 * sits in. An open slot is the whole hire affordance — the People surface reads
 * this rather than re-deriving a ceiling, so it never offers a press that
 * `hire()` would throw on.
 */
export interface RoleSlots {
  readonly roleId: string;
  readonly filled: number;
  readonly total: number;
}

/**
 * What one roster member costs (#353, C1 R1). The People surface reads this
 * rather than re-deriving a wage from the pay book, so the number on the card
 * is the number the ledger charges.
 *
 * `grade` and `paidGrade` are deliberately two fields. Growth never silently
 * reprices anyone (R2): the wage tracks the grade the person was **hired at**,
 * and when their ability outgrows it they come and ask. `grade > paidGrade` is
 * the whole raise trigger.
 */
export interface StaffPay {
  readonly staffId: string;
  readonly roleId: string;
  /** Current, derived from grown skills — climbs with tenure and closed deals. */
  readonly grade: number;
  /** The grade the wage is set at; moves only when a raise is accepted. */
  readonly paidGrade: number;
  /** `wage(role, paidGrade)` — exactly what the daily drain charges. */
  readonly dailyWage: number;
}

export interface StaffOrg {
  readonly currentRoster: readonly StaffWithComposites[];
  /**
   * How many bodies the current tier allows on payroll (#347) — now **derived**
   * as the sum of the tier's role slots (#352), not a separate number. There is
   * exactly one ceiling in the game and it is the slot table; a second one that
   * could disagree with it is a bug waiting.
   */
  readonly headcountCap: number;
  /**
   * The desks for one role at the current tier (#352). `total` 0 means the tier
   * has not opened that desk yet; an unknown role throws, same as `hire()`.
   */
  getSlots(roleId: string): RoleSlots;
  /**
   * Every role's desks at the current tier, in the slot table's order (#352).
   * The People surface renders this as the slot board — the all-roles read that
   * keeps the screen from re-deriving the ceiling role by role.
   */
  getSlotBoard(): readonly RoleSlots[];
  /**
   * What the store burns in wages every day (#353) — the sum of every rostered
   * member's daily wage, charged overnight whether the floor produced or not.
   * 0 with nobody on the roster, and nothing is posted in that case.
   */
  readonly dailyPayroll: number;
  /**
   * Grade + wage for every rostered member, in roster order (#353). The
   * all-roster read the People surface renders, parallel to `getSlotBoard`.
   */
  getPayBoard(): readonly StaffPay[];
  /** #190 SaveStore seam: capture/rehydrate the hired roster. */
  snapshot(): StaffOrgSnapshot;
  restore(snap: StaffOrgSnapshot): void;
  getCandidates(roleId: string): readonly CandidateListing[];
  hire(candidateId: string): void;
  fire(staffId: string): void;
  /**
   * The legal, tier-unlocked, gate-satisfied promotion targets for a roster
   * member (#324). Empty when the staffer meets no gate, has no outgoing edge,
   * or every target is tier-locked. Throws `StaffOrgError` if `staffId` isn't
   * on the roster.
   */
  getPromotionOptions(staffId: string): readonly PromotionOption[];
  /**
   * Promote a roster member up a legal role edge (#324). Moves the *existing*
   * staffer (id preserved, so morale/dispatch bindings survive) to `toRoleId`
   * via `NPC.promoteStaff`. Throws `StaffOrgError` if the staffer isn't on the
   * roster, the edge is illegal, the target is tier-locked, or the staffer's
   * promotion gates aren't met — the same predicate `getPromotionOptions` uses.
   */
  promote(staffId: string, toRoleId: string): void;
  /**
   * Pre-purchase condition read for an auction listing (#163). Returns the
   * UCM's skill-gated `[estimatedReconLow, estimatedReconHigh] + confidence`
   * band, or `null` when (a) no `used-car-manager` is on the roster, or
   * (b) the `realizedReconFor` truth seam wasn't wired. Same vehicle + same
   * UCM + same masterSeed → same read.
   */
  assessCondition(vehicle: ConditionAssessInput): ConditionRead | null;
}

export class StaffOrgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffOrgError';
  }
}

export function createStaffOrg(deps: StaffOrgDeps): StaffOrg {
  const { bus, economy, masterSeed, taxonomy, archetypes } = deps;
  const config = deps.config ?? loadStaffOrgConfig();
  const slots = deps.slots ?? loadStaffSlots();
  const pay = deps.pay ?? loadStaffPay();
  const getTier = deps.getTier;
  const realizedReconFor = deps.realizedReconFor;

  const roster: StaffWithComposites[] = [];
  // candidateId → CandidateListing; cleared on day advance
  const candidatePool = new Map<string, CandidateListing>();
  // roleId → candidateId[] for that role's current pool
  const rolePool = new Map<string, string[]>();

  let currentDay = 1;
  // Channel-desk M7 (#294): the day's closed-deal tally, accrued onto each
  // roster member's `deals_closed` counter overnight (NOT live), so effective
  // skill stays constant within an open day. Transient — reset every
  // `day_started`, deterministically rebuilt from `deal:closed` on a #122
  // replay; the durable growth lives in the (serialized) counters.
  let dayDealsClosed = 0;

  bus.subscribe('clock:day_started', ({ day }) => {
    currentDay = day;
    dayDealsClosed = 0;
    candidatePool.clear();
    rolePool.clear();
  });

  bus.subscribe('deal:closed', () => {
    dayDealsClosed += 1;
  });

  // Model B skill growth (#294): accrue the dormant experience counters once
  // per day, at the front of the overnight sequence. Effective skill is *derived*
  // from these counters (StaffFactory.computeEffectiveSkills), so recomputing
  // them here — and only here — means the derived skill is constant within each
  // open day and steps up overnight toward the per-hire cap. Counters serialize
  // on `Staff`, so the growth persists with no migration.
  bus.subscribe('clock:day_ended', () => {
    for (const s of roster) {
      s.counters.days_employed += 1;
      s.counters.deals_closed += dayDealsClosed;
      s.counters.experience += dayDealsClosed;
    }
  });

  bus.subscribe('staff:quit', ({ staffId }) => {
    const idx = roster.findIndex((s) => s.id === staffId);
    if (idx !== -1) roster.splice(idx, 1);
  });

  /**
   * The tier's desk count for a role (#352). Throws on a role the slot table
   * does not name, rather than reading as 0 — a silently unhireable role is the
   * A1 regression class (a job the engine allows and the surface never offers)
   * inverted, and it looks like balance instead of a missing data row.
   */
  function slotTotal(roleId: string): number {
    const total = slotTotalFor(slots, roleId, getTier ? getTier() : 1);
    if (total === undefined) {
      throw new StaffOrgError(`No slot row for role "${roleId}" in data/staff-slots.json`);
    }
    return total;
  }

  function slotsFilled(roleId: string): number {
    return roster.reduce((n, s) => (s.role_id === roleId ? n + 1 : n), 0);
  }

  /**
   * The person's grade **right now** (#353) — a banded read of their ability as
   * a fraction of their own ceiling, taken over the *grown* `effectiveSkills`
   * (Model B, #294) rather than the base roll. That is what makes the grade
   * climb with tenure and closed deals, which is the entire raise trigger; the
   * base-skill `effectivenessRatio` getter is left alone because every
   * promotion/capability gate is calibrated against it.
   *
   * Constant within an open day: the counters `effectiveSkills` derives from
   * only move overnight, so a #122 mid-day replay reproduces the same grade.
   */
  function currentGrade(staff: StaffWithComposites): number {
    return gradeFor(compositeRatio(staff.effectiveSkills, taxonomy.skills, 'effectiveness'), pay.gradeBands);
  }

  /**
   * What `roleId` costs per day at `grade`. Throws on a role the pay book does
   * not name, rather than silently charging nothing — a free employee is the
   * flat-stub bug this slice exists to delete, and it would read as balance
   * instead of a missing data row.
   */
  function wageFor(roleId: string, grade: number): number {
    const wage = dailyWageFor(pay, roleId, grade);
    if (wage === undefined) {
      throw new StaffOrgError(`No wage row for role "${roleId}" in data/staff-pay.json`);
    }
    return wage;
  }

  /** The wage a roster member is actually on — their `paidGrade`, not their current one. */
  function paidWageFor(staff: StaffWithComposites): number {
    return wageFor(staff.role_id, staff.paidGrade ?? currentGrade(staff));
  }

  function totalDailyPayroll(): number {
    return roster.reduce((sum, s) => sum + paidWageFor(s), 0);
  }

  // The daily wage drain (#353, C1 R1). Fires every night — `clock:overnight_payroll`
  // is a per-day phase; only Economy's rent gates itself to the week. A fixed
  // cost against variable revenue is what makes a slow day hurt, and the player
  // reads it in the same beat as the day's gross.
  //
  // `forceDebit`, not `postExpense`: this is a recurring obligation, same as
  // rent and the marketing/subscription drains. Payroll you cannot afford is
  // supposed to push cash negative and wake `BankruptcyMonitor`, not throw and
  // abort the overnight sequence.
  bus.subscribe('clock:overnight_payroll', () => {
    const total = totalDailyPayroll();
    if (total <= 0) return;
    economy.forceDebit(total, 'Payroll');
  });

  function hiringCostFor(roleId: string): number {
    const role = taxonomy.roles[roleId];
    if (!role) throw new StaffOrgError(`Unknown role "${roleId}"`);
    return config.hiringCostByTier[role.tier] ?? 1000;
  }

  /**
   * True when `staff` clears every threshold in its *current* role's
   * `promotion_gates` (#324). Gate keys are either the two composites
   * (`effectiveness`/`trustworthiness`, 0–1) or a raw skill axis read from the
   * grown `effectiveSkills` (0–100) — the same value every capability gate reads.
   */
  function meetsPromotionGates(staff: StaffWithComposites): boolean {
    const role = taxonomy.roles[staff.role_id];
    if (!role) return false;
    for (const [key, threshold] of Object.entries(role.promotion_gates)) {
      const value =
        key === 'effectiveness'
          ? staff.effectiveness
          : key === 'trustworthiness'
            ? staff.trustworthiness
            : (staff.effectiveSkills[key] ?? 0);
      if (value < threshold) return false;
    }
    return true;
  }

  /** True when `toRoleId`'s `hireTier` (if any) is met by the current tier. */
  function isTargetTierUnlocked(toRoleId: string): boolean {
    const target = taxonomy.roles[toRoleId];
    if (!target) return false;
    if (target.hireTier === undefined) return true;
    const tier = getTier ? getTier() : 1;
    return tier >= target.hireTier;
  }

  function buildCandidatesForRole(roleId: string): void {
    const matchingArchetypeIds = Object.entries(archetypes)
      .filter(([, a]) => a.role_id === roleId)
      .map(([id]) => id);

    if (matchingArchetypeIds.length === 0) {
      throw new StaffOrgError(`No archetypes defined for role "${roleId}"`);
    }

    const cost = hiringCostFor(roleId);
    const ids: string[] = [];

    // Slot walks past collisions rather than stopping at `candidatesPerRole`.
    // A staff id is `staff:<archetype>:<hireDay>:<slot>`, so the pool for a day
    // regenerates the SAME ids it generated before — and the pool is rebuilt
    // from the seed on every reload (it is deliberately not persisted, #190).
    // Without this guard a reloaded save offered you the person already on your
    // roster, and hiring them pushed a second entry under a duplicate id, which
    // would break every id-keyed binding (StaffMorale, StaffDispatch). Bounded
    // so an exhausted archetype set can't spin.
    const hiredIds = new Set(roster.map((s) => s.id));
    const maxAttempts = config.candidatesPerRole * 4;

    for (
      let slot = 0;
      slot < maxAttempts && ids.length < config.candidatesPerRole;
      slot++
    ) {
      const archetypeId =
        matchingArchetypeIds[slot % matchingArchetypeIds.length];

      const staff = createStaff(
        { archetypeId, hireDay: currentDay, slot },
        { masterSeed, taxonomy, archetypes },
      );
      if (hiredIds.has(staff.id)) continue;

      const candidateId = `candidate:${roleId}:${currentDay}:${slot}`;
      const grade = currentGrade(staff);
      const listing: CandidateListing = {
        candidateId,
        archetypeId,
        staff,
        hiringCost: cost,
        grade,
        dailyWage: wageFor(roleId, grade),
      };
      candidatePool.set(candidateId, listing);
      ids.push(candidateId);
    }

    rolePool.set(roleId, ids);
  }

  return {
    get currentRoster(): readonly StaffWithComposites[] {
      return roster;
    },

    get headcountCap(): number {
      let sum = 0;
      for (const roleId of Object.keys(slots)) sum += slotTotal(roleId);
      return sum;
    },

    getSlots(roleId: string): RoleSlots {
      return { roleId, filled: slotsFilled(roleId), total: slotTotal(roleId) };
    },

    getSlotBoard(): readonly RoleSlots[] {
      return Object.keys(slots).map((roleId) => ({
        roleId,
        filled: slotsFilled(roleId),
        total: slotTotal(roleId),
      }));
    },

    get dailyPayroll(): number {
      return totalDailyPayroll();
    },

    getPayBoard(): readonly StaffPay[] {
      return roster.map((s) => ({
        staffId: s.id,
        roleId: s.role_id,
        grade: currentGrade(s),
        paidGrade: s.paidGrade ?? currentGrade(s),
        dailyWage: paidWageFor(s),
      }));
    },

    snapshot(): StaffOrgSnapshot {
      return {
        schemaVersion: 1,
        currentDay,
        roster: [...roster],
      };
    },

    restore(snap: StaffOrgSnapshot): void {
      currentDay = snap.currentDay;
      roster.length = 0;
      for (const s of snap.roster) {
        const member = rehydrateStaff(s, taxonomy, masterSeed);
        // Saves predating the wage book (#353) carry no `paidGrade`. Materialize
        // it from what the person is worth *now*, which is the behavior-neutral
        // default: they arrive paid what they're currently worth, so the raise
        // trigger (`grade > paidGrade`) starts quiet and fires the first time
        // they actually outgrow it, exactly as a fresh hire does.
        if (member.paidGrade === undefined) member.paidGrade = currentGrade(member);
        roster.push(member);
      }
    },

    getCandidates(roleId: string): readonly CandidateListing[] {
      const role = taxonomy.roles[roleId];
      if (!role) throw new StaffOrgError(`Unknown role "${roleId}"`);
      if (role.hireTier !== undefined && getTier !== undefined) {
        const current = getTier();
        if (current < role.hireTier) {
          throw new StaffOrgError(
            `Role "${roleId}" requires dealership tier ${role.hireTier} (current: ${current})`,
          );
        }
      }
      if (!rolePool.has(roleId)) {
        buildCandidatesForRole(roleId);
      }
      return (rolePool.get(roleId) ?? []).map((id) => candidatePool.get(id)!);
    },

    hire(candidateId: string): void {
      const listing = candidatePool.get(candidateId);
      if (!listing) {
        throw new StaffOrgError(`Unknown candidate "${candidateId}"`);
      }

      // Scarcity is per ROLE, not per body (#352, C1 R3): what stops the player
      // buying five A-players is that the store has one desk for them. The UI
      // never offers a candidate for a full role, so this throw is the engine's
      // lock, not a message the player is meant to read.
      const roleId = listing.staff.role_id;
      const total = slotTotal(roleId);
      const filled = slotsFilled(roleId);
      if (filled >= total) {
        const tier = getTier ? getTier() : 1;
        throw new StaffOrgError(
          `No open slot for "${roleId}": tier ${tier} has ${total} (filled: ${filled})`,
        );
      }

      economy.postExpense(listing.hiringCost, `Hiring — ${listing.staff.role_id}`);

      // The grade they signed at is the grade they're paid at (#353). Set here
      // rather than in the factory because a candidate on the board is not on
      // anyone's payroll — `paidGrade` is what "employed here" means.
      listing.staff.paidGrade = listing.grade;
      roster.push(listing.staff);
      candidatePool.delete(candidateId);

      const roleIds = rolePool.get(listing.staff.role_id);
      if (roleIds) {
        const idx = roleIds.indexOf(candidateId);
        if (idx !== -1) roleIds.splice(idx, 1);
      }

      bus.publish('staff:hired', {
        staffId: listing.staff.id,
        roleId: listing.staff.role_id,
        day: currentDay,
        hiringCost: listing.hiringCost,
      });
    },

    assessCondition(vehicle: ConditionAssessInput): ConditionRead | null {
      if (!realizedReconFor) return null;
      // Pick the UCM with the highest condition_reading skill. Ties broken by
      // id (stable) so two equally-skilled UCMs don't flicker between reads.
      let best: StaffWithComposites | null = null;
      let bestSkill = -Infinity;
      for (const s of roster) {
        if (s.role_id !== 'used-car-manager') continue;
        // Effective (grown) skill, M7 (#294) — appraisal advice sharpens as the
        // UCM's `condition_reading` grows with tenure, same as the gates.
        const skill = s.effectiveSkills[CONDITION_READING_SKILL_ID] ?? 0;
        if (skill > bestSkill || (skill === bestSkill && best !== null && s.id < best.id)) {
          best = s;
          bestSkill = skill;
        }
      }
      if (!best) return null;

      const realized = realizedReconFor(vehicle);
      const seed = deriveConditionReadSeed(masterSeed, vehicle.id, best.id);
      return computeConditionRead(
        { realizedRecon: realized, estimate: vehicle.reconEstimate, skill: bestSkill, seed },
        config.conditionRead,
      );
    },

    fire(staffId: string): void {
      const idx = roster.findIndex((s) => s.id === staffId);
      if (idx === -1) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const [fired] = roster.splice(idx, 1);
      bus.publish('staff:fired', {
        staffId: fired.id,
        roleId: fired.role_id,
        day: currentDay,
      });
    },

    getPromotionOptions(staffId: string): readonly PromotionOption[] {
      const staff = roster.find((s) => s.id === staffId);
      if (!staff) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const role = taxonomy.roles[staff.role_id];
      if (!role || !meetsPromotionGates(staff)) return [];
      return role.promotes_to
        .filter((toRoleId) => isTargetTierUnlocked(toRoleId))
        // A desk you cannot sit at is not an option (#352). Slots gate promotion
        // exactly as they gate hiring, and worker-tier roles — which are ONLY
        // reached this way — are gated here alone.
        .filter((toRoleId) => slotsFilled(toRoleId) < slotTotal(toRoleId))
        .map((toRoleId) => ({ toRoleId }));
    },

    promote(staffId: string, toRoleId: string): void {
      const idx = roster.findIndex((s) => s.id === staffId);
      if (idx === -1) {
        throw new StaffOrgError(`Staff member "${staffId}" not on roster`);
      }
      const staff = roster[idx];
      const role = taxonomy.roles[staff.role_id];
      if (!role) {
        throw new StaffOrgError(`Staff has unknown role "${staff.role_id}"`);
      }
      if (!role.promotes_to.includes(toRoleId)) {
        throw new StaffOrgError(
          `Role "${staff.role_id}" cannot promote to "${toRoleId}" (illegal edge)`,
        );
      }
      if (!isTargetTierUnlocked(toRoleId)) {
        const target = taxonomy.roles[toRoleId];
        throw new StaffOrgError(
          `Promotion to "${toRoleId}" requires dealership tier ${target?.hireTier} (current: ${getTier ? getTier() : 1})`,
        );
      }
      if (!meetsPromotionGates(staff)) {
        throw new StaffOrgError(
          `Staff "${staffId}" does not meet the promotion gates for "${staff.role_id}"`,
        );
      }
      const targetTotal = slotTotal(toRoleId);
      const targetFilled = slotsFilled(toRoleId);
      if (targetFilled >= targetTotal) {
        throw new StaffOrgError(
          `No open slot for "${toRoleId}": tier ${getTier ? getTier() : 1} has ${targetTotal} (filled: ${targetFilled})`,
        );
      }

      const fromRoleId = staff.role_id;
      // In-place replacement keeps the staff id, so StaffMorale / StaffDispatch
      // bindings (keyed by id) survive the promotion.
      roster[idx] = promoteStaff(staff, toRoleId, taxonomy, masterSeed);

      bus.publish('staff:promoted', {
        staffId,
        fromRoleId,
        toRoleId,
        day: currentDay,
      });
    },
  };
}
