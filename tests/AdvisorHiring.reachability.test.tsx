import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { PeopleTabContainer } from '../src/app/screens/PeopleTabContainer';
import { loadServiceDispatchConfig } from '../src/game/ServiceDispatch';
import { loadBodyShopDispatchConfig } from '../src/bodyShopDispatchConfig';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #323 — Service (T2) and Body Shop (T3) throughput is `min(bays, advisors)`. The
// two advisor roles were fully engine-supported but UNHIREABLE in the UI, pinning
// both departments at zero capacity in live play. These tests drive the hire
// through the real People tab container (role chips + candidate cards + the
// card's Hire button — NOT a direct `staffOrg.hire` call) and assert the
// department's capacity flips from 0 to positive, guarding against the
// engine-hireable/UI-invisible class of hole recurring.

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

type World = ReturnType<typeof createWorld>;

function worldAtTier(tier: number, masterSeed: number): World {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed, characterProfile: PROFILE });
  const tierState = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...tierState, currentTier: tier });
  return world;
}

/** Concurrent-capacity slots for a department: `min(bays@tier, advisors on staff)`. */
function slots(
  bays: number,
  world: World,
  advisorRole: string,
): number {
  const advisors = world.staffOrg.currentRoster.filter(
    (s) => s.role_id === advisorRole,
  ).length;
  return Math.min(bays, advisors);
}

/**
 * Render the People tab for `roleId` and press the first candidate's Hire
 * button — the exact affordance a player taps, now inside the tab rather than a
 * pushed personnel route (#347). Fails to hire if the role never surfaces in
 * the hiring chips (the pre-#323 bug).
 */
function hireThroughUi(world: World, roleId: string): void {
  const candidate = world.staffOrg.getCandidates(roleId)[0];
  expect(candidate).toBeDefined();

  const { getByTestId } = render(
    <PeopleTabContainer
      world={world}
      selectedHiringRoleId={roleId}
      setSelectedHiringRoleId={() => {}}
      setCash={() => {}}
      bump={() => {}}
    />,
  );

  fireEvent.press(getByTestId(`people-hire-${candidate.candidateId}`));
}

describe('#323 advisor hiring reachability', () => {
  it('hires a service advisor through the UI at T2, flipping Service capacity positive', () => {
    const world = worldAtTier(2, 3231);
    const bays = loadServiceDispatchConfig().baysByTier['2'];
    expect(bays).toBeGreaterThan(0);

    // Pre-hire: no advisors ⇒ zero throughput, the live-play hole.
    expect(slots(bays, world, 'service-advisor')).toBe(0);

    hireThroughUi(world, 'service-advisor');

    expect(
      world.staffOrg.currentRoster.some((s) => s.role_id === 'service-advisor'),
    ).toBe(true);
    expect(slots(bays, world, 'service-advisor')).toBeGreaterThan(0);
  });

  it('hires a body-shop advisor through the UI at T3, flipping Body Shop capacity positive', () => {
    const world = worldAtTier(3, 3232);
    const bays = loadBodyShopDispatchConfig().baysByTier['3'];
    expect(bays).toBeGreaterThan(0);

    expect(slots(bays, world, 'body-shop-advisor')).toBe(0);

    hireThroughUi(world, 'body-shop-advisor');

    expect(
      world.staffOrg.currentRoster.some(
        (s) => s.role_id === 'body-shop-advisor',
      ),
    ).toBe(true);
    expect(slots(bays, world, 'body-shop-advisor')).toBeGreaterThan(0);
  });
});
