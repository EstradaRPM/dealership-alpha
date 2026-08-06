import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { PeopleTabContainer } from '../src/app/screens/PeopleTabContainer';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #324 — promotion path reachability. `NPC.promoteStaff` was engine-only with
// zero callers; the player had no way to promote from within. This drives the
// promote affordance through the real People tab container (getPromotionOptions
// → the roster card's promote button → staffOrg.promote), guarding the
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

  const { getByTestId } = render(
    <PeopleTabContainer
      world={world}
      selectedHiringRoleId="salesperson"
      setSelectedHiringRoleId={() => {}}
      setCash={() => {}}
      bump={() => {}}
    />,
  );

  // Pre-promotion: the roster member is a lot-porter.
  expect(world.staffOrg.currentRoster[0].role_id).toBe('lot-porter');

  // The promote affordance the container surfaced from getPromotionOptions.
  // A person's card is folded to what they cost; the actions on them are one
  // tap behind that header, which is the tap a player makes.
  fireEvent.press(getByTestId('people-roster-card-porter-1-header'));
  fireEvent.press(getByTestId('people-promote-porter-1-salesperson'));

  expect(world.staffOrg.currentRoster[0].role_id).toBe('salesperson');
  expect(world.staffOrg.currentRoster[0].id).toBe('porter-1'); // id preserved
});
