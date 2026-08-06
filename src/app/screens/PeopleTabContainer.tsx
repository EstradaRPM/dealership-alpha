import React from 'react';
import type { World } from '../../createWorld';
import {
  PeopleTab,
  type PeopleCandidate,
  type PeopleRosterMember,
  type PeopleSkillRead,
  type PeopleSlotRow,
} from '../../ui/PeopleTab';
import { MIN_GRADE, type StaffWithComposites } from '../../game/StaffOrg';
import {
  buildHiringRoleOptions,
  buildManagerStatus,
  humanizeRole,
  staffTaxonomy,
  DEFAULT_HIRING_ROLE_ID,
} from '../config';

export interface PeopleTabContainerProps {
  world: World;
  /** Which job the player is currently shopping for. */
  selectedHiringRoleId: string;
  setSelectedHiringRoleId: (id: string) => void;
  /** Keep the app-level cash mirror in step with a hire's expense. */
  setCash: (n: number) => void;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
}

/** Plain-language skill reads for one person, in a stable order (#347). */
function skillReads(staff: StaffWithComposites): PeopleSkillRead[] {
  return Object.keys(staff.skills)
    .sort()
    .map((id) => {
      const def = staffTaxonomy.skills[id];
      return {
        id,
        // The label is data (`data/staff-skills.json`), never a de-slugged id —
        // "t_o_closing" rendered as "t o closing" is what the audit found.
        label: def?.label ?? id,
        // The *grown* value is what every capability gate reads (#294), so it
        // is what the card shows.
        value: staff.effectiveSkills[id] ?? staff.skills[id],
        cap: def?.cap ?? 100,
      };
    });
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
      workQuality: staff.effectivenessRatio,
      honesty: staff.trustworthinessRatio,
      // StaffMorale tracks 0–100; the meters are fractions.
      morale: world.staffMorale.getMorale(staff.id) / 100,
      grade: pay?.grade ?? MIN_GRADE,
      paidGrade: pay?.paidGrade ?? MIN_GRADE,
      dailyWage: pay?.dailyWage ?? 0,
      skills: skillReads(staff),
      promotions: world.staffOrg.getPromotionOptions(staff.id).map((p) => ({
        toRoleId: p.toRoleId,
        label: humanizeRole(p.toRoleId),
      })),
      raise: raise
        ? { currentWage: raise.currentWage, askedWage: raise.askedWage }
        : null,
    };
  });

  const candidates: PeopleCandidate[] = world.staffOrg
    .getCandidates(selectedRoleId)
    .map((listing) => ({
      id: listing.candidateId,
      name: listing.staff.name,
      roleLabel: humanizeRole(listing.staff.role_id),
      traits: listing.staff.trait_ids.map(humanizeTrait),
      workQuality: listing.staff.effectivenessRatio,
      honesty: listing.staff.trustworthinessRatio,
      // The grade they'd sign at and the wage that follows from it (#353) —
      // carried by the listing, so the card and `hire()` agree by construction.
      grade: listing.grade,
      dailyWage: listing.dailyWage,
      skills: skillReads(listing.staff),
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
      onSelectHiringRole={setSelectedHiringRoleId}
      onHire={(candidateId) => {
        world.staffOrg.hire(candidateId);
        setCash(world.economy.cash);
        bump();
      }}
      onPromote={(staffId, toRoleId) => {
        world.staffOrg.promote(staffId, toRoleId);
        bump();
      }}
      onFire={(staffId) => {
        world.staffOrg.fire(staffId);
        bump();
      }}
      // A raise costs nothing today — the new wage is charged by the overnight
      // drain — so neither answer touches the cash mirror. Both just re-render
      // in place, like every other write on this tab.
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
