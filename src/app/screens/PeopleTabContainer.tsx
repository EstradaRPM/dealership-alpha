import React from 'react';
import type { World } from '../../createWorld';
import {
  PeopleTab,
  type PeopleCandidate,
  type PeopleRosterMember,
  type PeopleSkillRead,
  type PeopleSlotRow,
} from '../../ui/PeopleTab';
import {
  MIN_GRADE,
  type StaffSkillGrowth,
  type StaffWithComposites,
} from '../../game/StaffOrg';
import {
  buildHiringRoleOptions,
  buildManagerStatus,
  departmentOfRole,
  humanizeRole,
  staffTaxonomy,
  DEFAULT_HIRING_ROLE_ID,
} from '../config';
import type { Hints } from '../useHints';

export interface PeopleTabContainerProps {
  world: World;
  /** Which job the player is currently shopping for. */
  selectedHiringRoleId: string;
  setSelectedHiringRoleId: (id: string) => void;
  /** The teaching cluster (#386/#388) — resolved here, marked on each write. */
  hints: Hints;
  /** Keep the app-level cash mirror in step with a hire's expense. */
  setCash: (n: number) => void;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
}

/** The plain-language axis name — data (`data/staff-skills.json`), never a
 * de-slugged id: "t_o_closing" rendered as "t o closing" is what the audit
 * found. */
function skillLabel(id: string): string {
  return staffTaxonomy.skills[id]?.label ?? id;
}

/** Plain-language skill reads for one applicant, in a stable order (#347). */
function candidateSkillReads(staff: StaffWithComposites): PeopleSkillRead[] {
  return Object.keys(staff.skills)
    .sort()
    .map((id) => ({
      id,
      label: skillLabel(id),
      // The *grown* value is what every capability gate reads (#294), so it
      // is what the card shows. On a candidate it equals the base roll —
      // nobody accrues counters before they are hired, which is also why an
      // applicant's card carries no growth reading.
      value: staff.effectiveSkills[id] ?? staff.skills[id],
      cap: staffTaxonomy.skills[id]?.cap ?? 100,
    }));
}

/**
 * The same reads for somebody on payroll, carrying the three-number growth
 * reading (#377). Every figure comes off `staffOrg.getSkillGrowth` rather than
 * being re-derived here: the per-hire ceiling is rolled from the master seed
 * and the staff id, so a surface computing its own would name a limit the
 * engine does not clamp to.
 */
function rosterSkillReads(growth: readonly StaffSkillGrowth[]): PeopleSkillRead[] {
  return growth.map((axis) => ({
    id: axis.skillId,
    label: skillLabel(axis.skillId),
    value: axis.current,
    cap: axis.cap,
    growth: {
      hiredAt: axis.hiredAt,
      ceiling: axis.ceiling,
      grows: axis.grows,
    },
  }));
}

function humanizeTrait(traitId: string): string {
  const words = traitId.replace(/[_-]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * People tab composition (#347). Assembles the roster + hiring read-models off
 * the live world and owns every write (`hire` / `promote` / `fire`). Hiring
 * resolves **in place** — the handlers write through the module and `bump()`
 * re-renders the same tab, so the roster section updates without a route
 * change (the old flow pushed a full-screen `personnel` route from Operations).
 */
export function PeopleTabContainer({
  world,
  selectedHiringRoleId,
  setSelectedHiringRoleId,
  hints,
  setCash,
  bump,
}: PeopleTabContainerProps) {
  const roleOptions = buildHiringRoleOptions(world.tierManager.currentTier);
  const selectedRoleId = roleOptions.some((r) => r.id === selectedHiringRoleId)
    ? selectedHiringRoleId
    : (roleOptions[0]?.id ?? DEFAULT_HIRING_ROLE_ID);

  // Grade + wage per member (#353), read off the engine's own pay board rather
  // than re-derived from the pay book here: the card must state exactly what
  // the overnight drain charges, and a second computation could disagree.
  const payBoard = new Map(world.staffOrg.getPayBoard().map((p) => [p.staffId, p]));

  const roster: PeopleRosterMember[] = world.staffOrg.currentRoster.map((staff) => {
    const pay = payBoard.get(staff.id);
    // The demand, if they are making one (#356). Both numbers come off the
    // request the engine minted when they asked, not off today's pay board —
    // the player answers the figures they were shown.
    const raise = world.staffOrg.getRaiseRequest(staff.id);
    return {
      id: staff.id,
      name: staff.name,
      roleLabel: humanizeRole(staff.role_id),
      // Which panel they sit under — read off the role catalog, so a promotion
      // moves the person between department panels for free.
      department: departmentOfRole(staff.role_id),
      workQuality: staff.effectivenessRatio,
      honesty: staff.trustworthinessRatio,
      // StaffMorale tracks 0–100; the meters are fractions.
      morale: world.staffMorale.getMorale(staff.id) / 100,
      // ...and what that level is actually doing to their output (#377). The
      // engine reads this multiplier on every dispatch; until now no surface
      // did, so the meter stated a level and never a consequence.
      moraleMultiplier: world.staffMorale.getMoraleMultiplier(staff.id),
      grade: pay?.grade ?? MIN_GRADE,
      paidGrade: pay?.paidGrade ?? MIN_GRADE,
      dailyWage: pay?.dailyWage ?? 0,
      skills: rosterSkillReads(world.staffOrg.getSkillGrowth(staff.id)),
      promotions: world.staffOrg.getPromotionOptions(staff.id).map((p) => ({
        toRoleId: p.toRoleId,
        label: humanizeRole(p.toRoleId),
      })),
      raise: raise
        ? {
            currentWage: raise.currentWage,
            askedWage: raise.askedWage,
            // Present only on a poach (#357) — the prompt renders the rival's
            // name and the deadline instead of growing a second component.
            rivalName: raise.rivalName ?? null,
            deadlineDay: raise.deadlineDay ?? null,
          }
        : null,
    };
  });

  const candidates: PeopleCandidate[] = world.staffOrg
    .getCandidates(selectedRoleId)
    .map((listing) => ({
      id: listing.candidateId,
      name: listing.staff.name,
      roleLabel: humanizeRole(listing.staff.role_id),
      department: departmentOfRole(listing.staff.role_id),
      traits: listing.staff.trait_ids.map(humanizeTrait),
      workQuality: listing.staff.effectivenessRatio,
      honesty: listing.staff.trustworthinessRatio,
      // The grade they'd sign at and the wage that follows from it (#353) —
      // carried by the listing, so the card and `hire()` agree by construction.
      grade: listing.grade,
      dailyWage: listing.dailyWage,
      skills: candidateSkillReads(listing.staff),
      hiringCost: listing.hiringCost,
    }));

  // The slot board (#352). A row earns its place two ways: the tier opened a
  // desk you can hire into, or somebody is already sitting in one. A job that
  // is neither renders NOTHING — a permanently empty "Lot Porter 0 of 2" is a
  // row the player can do nothing about, and the locked IA bans foreshadow
  // tiles. `hireable` is the same predicate the role chips use, so the
  // promotion-only jobs show their occupancy without offering a hire the
  // engine would refuse.
  const hireableRoleIds = new Set(roleOptions.map((r) => r.id));
  const slots: PeopleSlotRow[] = world.staffOrg
    .getSlotBoard()
    .filter((row) => row.filled > 0 || (row.total > 0 && hireableRoleIds.has(row.roleId)))
    .map((row) => ({
      roleId: row.roleId,
      label: humanizeRole(row.roleId),
      department: departmentOfRole(row.roleId),
      filled: row.filled,
      total: row.total,
      hireable: hireableRoleIds.has(row.roleId),
    }));

  return (
    <PeopleTab
      managerStatus={buildManagerStatus(world)}
      roster={roster}
      dailyPayroll={world.staffOrg.dailyPayroll}
      slots={slots}
      hiring={{
        roleOptions,
        selectedRoleId,
        candidates,
        cash: world.economy.cash,
      }}
      // Consequence hints (#388). Resolved here, marked on the write path —
      // so anything that calls the same handler teaches exactly what a tap
      // does, and no card decides for itself what it has already said.
      hints={{
        hiring: hints.hintFor('hire_candidate'),
        staffMoves: hints.hintFor('staff_moves'),
        raise: hints.hintFor('raise_answer'),
      }}
      onSelectHiringRole={setSelectedHiringRoleId}
      onHire={(candidateId) => {
        world.staffOrg.hire(candidateId);
        hints.markUsed('hire_candidate');
        setCash(world.economy.cash);
        bump();
      }}
      onPromote={(staffId, toRoleId) => {
        world.staffOrg.promote(staffId, toRoleId);
        hints.markUsed('staff_moves');
        bump();
      }}
      onFire={(staffId) => {
        world.staffOrg.fire(staffId);
        hints.markUsed('staff_moves');
        bump();
      }}
      // A raise costs nothing today — the new wage is charged by the overnight
      // drain — so neither answer touches the cash mirror. Both just re-render
      // in place, like every other write on this tab. The same two handlers
      // answer a rival's offer (#357); "Let them go" removes them from the
      // roster, which `bump()` reflects like any other roster write.
      onAcceptRaise={(staffId) => {
        world.staffOrg.acceptRaise(staffId);
        bump();
      }}
      onRefuseRaise={(staffId) => {
        world.staffOrg.refuseRaise(staffId);
        bump();
      }}
    />
  );
}
