import React from 'react';
import { StatusBar } from 'expo-status-bar';
import type { World } from '../../createWorld';
import type { Navigator } from '../../ui/Navigator';
import { PersonnelScreen } from '../../ui/PersonnelScreen';
import type { PromotionOption } from '../../game/StaffOrg';
import {
  buildHiringRoleOptions,
  SKILL_CAPS,
  DEFAULT_HIRING_ROLE_ID,
} from '../config';

export interface PersonnelScreenContainerProps {
  world: World;
  nav: Navigator;
  cash: number;
  selectedHiringRoleId: string;
  setSelectedHiringRoleId: (id: string) => void;
  setCash: (n: number) => void;
  bump: () => void;
}

// Hiring/roster container (#242 extraction). Verbatim from App.tsx.
export function PersonnelScreenContainer({
  world,
  nav,
  cash,
  selectedHiringRoleId,
  setSelectedHiringRoleId,
  setCash,
  bump,
}: PersonnelScreenContainerProps) {
  const roleOptions = buildHiringRoleOptions(world.tierManager.currentTier);
  const selectedRoleId = roleOptions.some(
    (role) => role.id === selectedHiringRoleId,
  )
    ? selectedHiringRoleId
    : roleOptions[0]?.id ?? DEFAULT_HIRING_ROLE_ID;
  const promotionsByStaffId: Record<string, readonly PromotionOption[]> = {};
  for (const staff of world.staffOrg.currentRoster) {
    promotionsByStaffId[staff.id] = world.staffOrg.getPromotionOptions(staff.id);
  }
  return (
    <>
      <StatusBar style="light" />
      <PersonnelScreen
        roleOptions={roleOptions}
        selectedRoleId={selectedRoleId}
        candidates={world.staffOrg.getCandidates(selectedRoleId)}
        roster={world.staffOrg.currentRoster}
        promotionsByStaffId={promotionsByStaffId}
        skillCaps={SKILL_CAPS}
        cash={cash}
        onSelectRole={setSelectedHiringRoleId}
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
        onClose={() => nav.back()}
      />
    </>
  );
}
