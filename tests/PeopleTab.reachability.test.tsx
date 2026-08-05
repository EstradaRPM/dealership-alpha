import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { PeopleTabContainer } from '../src/app/screens/PeopleTabContainer';
import type { CharacterProfile } from '../src/game/CareerProgression';
import { readAppCompositionSource } from './helpers/appComposition';

// #347 — anti-orphan proof for the People rebuild. The roster and the hiring
// pool are only worth building if the live app mounts them ON the People tab:
// the drive-through audit found them stranded two levels down inside
// Operations → Prep → Hire Staff, in the wrong tab entirely.

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

function freshWorld(masterSeed = 347): World {
  const bus = createEventBus();
  return createWorld({ bus, masterSeed, characterProfile: PROFILE });
}

function renderPeople(world: World) {
  return render(
    <PeopleTabContainer
      world={world}
      selectedHiringRoleId="salesperson"
      setSelectedHiringRoleId={() => {}}
      setCash={() => {}}
      bump={() => {}}
    />,
  );
}

describe('#347 the People tab is mounted on the live world', () => {
  it('hires from the tab and the roster section updates in place', () => {
    const world = freshWorld();
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    expect(candidate).toBeDefined();
    expect(world.staffOrg.currentRoster).toHaveLength(0);

    const { getByTestId, queryByTestId, rerender } = renderPeople(world);

    // No route change: the same mounted surface both offers the hire and, once
    // the world has the new staffer, shows them on the roster.
    expect(queryByTestId(`people-roster-card-${candidate.staff.id}`)).toBeNull();
    fireEvent.press(getByTestId(`people-hire-${candidate.candidateId}`));

    expect(world.staffOrg.currentRoster).toHaveLength(1);

    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );
    expect(getByTestId(`people-roster-card-${candidate.staff.id}`)).toBeTruthy();
  });

  it('gives every hired roster member a name', () => {
    const world = freshWorld(3471);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);

    const hired = world.staffOrg.currentRoster[0];
    expect(hired.name).toEqual(expect.any(String));
    expect(hired.name.length).toBeGreaterThan(0);

    const { getByText } = renderPeople(world);
    expect(getByText(hired.name)).toBeTruthy();
  });

  it('re-derives the same name after a save/reload round trip', () => {
    // The name is derived from (masterSeed, staff id), never stored — so it
    // costs no field on `Staff` and no save migration, and the people you
    // saved are the people you load.
    const world = freshWorld(3472);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);
    const before = world.staffOrg.currentRoster[0].name;

    const snap = JSON.parse(JSON.stringify(world.staffOrg.snapshot()));
    world.staffOrg.restore(snap);

    expect(world.staffOrg.currentRoster[0].name).toBe(before);
  });

  it('shows the live tier\'s slot board, and hiring fills a desk on it', () => {
    // #352 anti-orphan proof: the slot table is only scarcity if the surface
    // reads the LIVE engine's desks. A Tier-1 lot has exactly one sales desk.
    const world = freshWorld(3520);
    const { getByTestId, getAllByText, rerender } = renderPeople(world);

    expect(getByTestId('people-slot-board')).toBeTruthy();
    expect(
      getByTestId('people-slot-count-salesperson').props.children.join(''),
    ).toBe('0 of 1');

    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    fireEvent.press(getByTestId(`people-hire-${candidate.candidateId}`));
    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );

    expect(
      getByTestId('people-slot-count-salesperson').props.children.join(''),
    ).toBe('1 of 1');
    // ...and every remaining applicant for that job stops being offered, because
    // pressing Hire would now throw in the engine.
    expect(getAllByText('No desk open for this job').length).toBeGreaterThan(0);
  });

  it('renders no slot row for a job this tier has not opened', () => {
    // Locked IA rule 3 — a mechanic that does not exist yet renders nothing,
    // not a "0 of 0" foreshadow. The GM desk arrives at Tier 6.
    const { queryByTestId } = renderPeople(freshWorld(3521));
    expect(queryByTestId('people-slot-gm')).toBeNull();
  });

  it('renders no slot row for an empty promotion-only job', () => {
    // `lot-porter` has desks at Tier 1 but is never hired cold and nothing
    // promotes into it — a permanently empty row is one the player can do
    // nothing about.
    const { queryByTestId } = renderPeople(freshWorld(3522));
    expect(queryByTestId('people-slot-lot-porter')).toBeNull();
    expect(queryByTestId('people-slot-technician')).toBeNull();
  });

  it('states the live wage on a candidate card, and the same wage once hired', () => {
    // #354 anti-orphan proof: the grade + wage on screen have to be the
    // engine's own numbers. A candidate is priced off the grade they'd sign at,
    // and hiring stamps that as `paidGrade` — so the card says the same thing
    // on both sides of the hire.
    const world = freshWorld(3540);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    const expected = `Grade ${candidate.grade} · $${candidate.dailyWage.toLocaleString()}/day`;

    const { getByTestId, rerender } = renderPeople(world);
    expect(getByTestId(`people-candidate-pay-${candidate.candidateId}`).props.children).toBe(
      expected,
    );

    fireEvent.press(getByTestId(`people-hire-${candidate.candidateId}`));
    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );

    expect(getByTestId(`people-roster-pay-${candidate.staff.id}`).props.children).toBe(
      expected,
    );
  });

  it('shows the payroll the engine will actually charge overnight', () => {
    const world = freshWorld(3541);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);

    const { getByTestId } = renderPeople(world);
    expect(world.staffOrg.dailyPayroll).toBeGreaterThan(0);
    expect(getByTestId('people-payroll-total').props.children).toBe(
      `$${world.staffOrg.dailyPayroll.toLocaleString()}/day`,
    );
  });

  it('is composed into the People tab of the live shell', () => {
    const src = readAppCompositionSource();
    expect(src).toContain('<PeopleTabContainer');
    expect(src).toMatch(/people: \(\s*<PeopleTabContainer/);
  });

  it('leaves no hiring entry point in Operations', () => {
    // The whole point of the move: Operations → Prep is pre-open policy levers
    // only (locked IA §4 — "No navigation links parked here").
    const src = readAppCompositionSource();
    expect(src).not.toContain("nav.navigate('personnel')");
    expect(src).not.toContain('onOpenHiring');
  });
});
