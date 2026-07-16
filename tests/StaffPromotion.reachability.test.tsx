import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { PersonnelScreenContainer } from '../src/app/screens/PersonnelScreenContainer';
import type { Navigator } from '../src/ui/Navigator';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #324 — promotion path reachability. `NPC.promoteStaff` was engine-only with
// zero callers; the player had no way to promote from within. This drives the
// promote affordance through the real PersonnelScreen container (getPromotionOptions
// → the roster promote button → staffOrg.promote), guarding the
// engine-supported / UI-invisible class of hole (same shape as #323's hiring gap).

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const NAV = { back: () => {} } as unknown as Navigator;

it('promotes a lot-porter to salesperson through the roster UI', () => {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed: 3241, characterProfile: PROFILE });

  // Seed one gate-clearing lot-porter onto the roster (lot-porter gate is
  // { productivity: 40 }; promotes_to salesperson).
  world.staffOrg.restore({
    schemaVersion: 1,
    currentDay: 1,
    roster: [
      {
        id: 'porter-1',
        role_id: 'lot-porter',
        trait_ids: [],
        skills: { productivity: 55 },
        resources: { stamina: 100 },
        counters: { experience: 0, deals_closed: 0, days_employed: 0 },
      },
    ],
  });

  const { getByText } = render(
    <PersonnelScreenContainer
      world={world}
      nav={NAV}
      cash={100_000}
      selectedHiringRoleId="salesperson"
      setSelectedHiringRoleId={() => {}}
      setCash={() => {}}
      bump={() => {}}
    />,
  );

  // Pre-promotion: the roster member is a lot-porter.
  expect(world.staffOrg.currentRoster[0].role_id).toBe('lot-porter');

  // The promote affordance the container surfaced from getPromotionOptions.
  fireEvent.press(getByText('↑ salesperson'));

  expect(world.staffOrg.currentRoster[0].role_id).toBe('salesperson');
  expect(world.staffOrg.currentRoster[0].id).toBe('porter-1'); // id preserved
});
