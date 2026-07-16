import type { EventBus } from '../EventBus';
import type { Economy } from '../Economy';
import type { StaffTaxonomy } from '../NPC/StaffTaxonomy';
import type { StaffArchetypeCatalog } from '../NPC/schemas/staff-archetype';
import {
  createStaff,
  rehydrateStaff,
  promoteStaff,
  type StaffWithComposites,
} from '../NPC/factories/StaffFactory';
import type { Staff } from '../NPC/schemas/staff';
import { loadStaffOrgConfig, type StaffOrgConfig } from './staffOrgData';
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

export interface StaffOrg {
  readonly currentRoster: readonly StaffWithComposites[];
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

    for (let slot = 0; slot < config.candidatesPerRole; slot++) {
      const archetypeId =
        matchingArchetypeIds[slot % matchingArchetypeIds.length];
      const candidateId = `candidate:${roleId}:${currentDay}:${slot}`;

      const staff = createStaff(
        { archetypeId, hireDay: currentDay, slot },
        { masterSeed, taxonomy, archetypes },
      );

      const listing: CandidateListing = { candidateId, archetypeId, staff, hiringCost: cost };
      candidatePool.set(candidateId, listing);
      ids.push(candidateId);
    }

    rolePool.set(roleId, ids);
  }

  return {
    get currentRoster(): readonly StaffWithComposites[] {
      return roster;
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
        roster.push(rehydrateStaff(s, taxonomy, masterSeed));
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

      const tier = getTier ? getTier() : 1;
      const cap = config.headcountCapByTier[String(tier)] ?? Infinity;
      if (roster.length >= cap) {
        throw new StaffOrgError(
          `Headcount cap reached: tier ${tier} allows at most ${cap} staff (current: ${roster.length})`,
        );
      }

      economy.postExpense(listing.hiringCost, `Hiring — ${listing.staff.role_id}`);

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
