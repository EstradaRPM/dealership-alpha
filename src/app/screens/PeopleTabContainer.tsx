import React from 'react';
import type { World } from '../../createWorld';
import {
  PeopleTab,
  type PeopleCandidate,
  type PeopleRosterMember,
  type PeopleSkillRead,
} from '../../ui/PeopleTab';
import type { StaffWithComposites } from '../../game/StaffOrg';
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

  const roster: PeopleRosterMember[] = world.staffOrg.currentRoster.map((staff) => ({
    id: staff.id,
    name: staff.name,
    roleLabel: humanizeRole(staff.role_id),
    workQuality: staff.effectivenessRatio,
    honesty: staff.trustworthinessRatio,
    // StaffMorale tracks 0–100; the meters are fractions.
    morale: world.staffMorale.getMorale(staff.id) / 100,
    skills: skillReads(staff),
    promotions: world.staffOrg.getPromotionOptions(staff.id).map((p) => ({
      toRoleId: p.toRoleId,
      label: humanizeRole(p.toRoleId),
    })),
  }));

  const candidates: PeopleCandidate[] = world.staffOrg
    .getCandidates(selectedRoleId)
    .map((listing) => ({
      id: listing.candidateId,
      name: listing.staff.name,
      roleLabel: humanizeRole(listing.staff.role_id),
      traits: listing.staff.trait_ids.map(humanizeTrait),
      workQuality: listing.staff.effectivenessRatio,
      honesty: listing.staff.trustworthinessRatio,
      skills: skillReads(listing.staff),
      hiringCost: listing.hiringCost,
    }));

  const cap = world.staffOrg.headcountCap;

  return (
    <PeopleTab
      managerStatus={buildManagerStatus(world)}
      roster={roster}
      hiring={{
        roleOptions,
        selectedRoleId,
        candidates,
        cash: world.economy.cash,
        headcountCap: Number.isFinite(cap) ? cap : null,
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
    />
  );
}
