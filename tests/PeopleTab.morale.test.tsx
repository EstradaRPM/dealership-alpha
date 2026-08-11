import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PeopleTab,
  type PeopleTabProps,
  type PeopleRosterMember,
} from '../src/ui/PeopleTab';
import { moraleEffectText } from '../src/ui/PeopleTab/peopleModel';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { PeopleTabContainer } from '../src/app/screens/PeopleTabContainer';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #377 — `staffMorale.getMoraleMultiplier` scales what a person actually
// produces (`createWorld`, `StaffDispatch`), and no UI read it. The card drew a
// morale bar and never said what a low bar was costing: exactly the "dead
// control with no explanation" the plain-language rule exists to prevent.

const MEMBER: PeopleRosterMember = {
  id: 'staff:career_salesperson:1:0',
  name: 'Marcus Delgado',
  roleLabel: 'Salesperson',
  department: 'sales',
  workQuality: 0.72,
  honesty: 0.64,
  morale: 0.3,
  moraleMultiplier: 0.78,
  grade: 3,
  paidGrade: 3,
  dailyWage: 340,
  skills: [],
  promotions: [],
  raise: null,
};

function baseProps(over: Partial<PeopleTabProps> = {}): PeopleTabProps {
  return {
    managerStatus: { ucmPresent: false, ucm: [], departments: [] },
    roster: [MEMBER],
    dailyPayroll: MEMBER.dailyWage,
    slots: [
      {
        roleId: 'salesperson',
        label: 'Salesperson',
        department: 'sales',
        filled: 1,
        total: 1,
        hireable: true,
      },
    ],
    hiring: {
      roleOptions: [{ id: 'salesperson', label: 'Salesperson', department: 'sales' }],
      selectedRoleId: 'salesperson',
      candidates: [],
      cash: 50_000,
    },
    onSelectHiringRole: jest.fn(),
    onHire: jest.fn(),
    onPromote: jest.fn(),
    onFire: jest.fn(),
    onAcceptRaise: jest.fn(),
    onRefuseRaise: jest.fn(),
    ...over,
  };
}

function openMemberCard(
  getByTestId: (id: string) => { props: Record<string, unknown> },
  id = MEMBER.id,
): void {
  fireEvent.press(getByTestId(`people-roster-card-${id}-header`));
}

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

describe('#377 the morale meter states its consequence', () => {
  it('names the consequence, not just the level', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    openMemberCard(getByTestId);

    expect(
      getByTestId(`people-roster-${MEMBER.id}-morale-effect`).props.children,
    ).toBe('Morale is costing 22% of their work.');
  });

  it('states a lift as a lift, in the same grammar', () => {
    const lifted: PeopleRosterMember = { ...MEMBER, morale: 0.9, moraleMultiplier: 1.14 };
    const { getByTestId } = render(<PeopleTab {...baseProps({ roster: [lifted] })} />);
    openMemberCard(getByTestId);

    expect(
      getByTestId(`people-roster-${MEMBER.id}-morale-effect`).props.children,
    ).toBe('Morale is getting 14% more work out of them.');
  });

  it('a content employee still gets a sentence', () => {
    // An omitted line reads as a surface that forgot, not as "no effect" — and
    // the player cannot tell the difference between the two by looking.
    const neutral: PeopleRosterMember = { ...MEMBER, morale: 0.67, moraleMultiplier: 1 };
    const { getByTestId } = render(<PeopleTab {...baseProps({ roster: [neutral] })} />);
    openMemberCard(getByTestId);

    expect(
      getByTestId(`people-roster-${MEMBER.id}-morale-effect`).props.children,
    ).toBe('Morale is neither helping nor holding them back.');
  });

  it('no warm/hot/cool/cold in the copy', () => {
    // The standing plain-language rule: name the axis and state the
    // consequence. A temperature word is a label a layperson has to be taught.
    const BANNED = /\b(warm|warmer|hot|hotter|cool|cooler|cold|colder|lukewarm|tepid|chilly|frosty)\b/i;
    for (let mult = 0.5; mult <= 1.5; mult += 0.01) {
      expect(moraleEffectText(mult)).not.toMatch(BANNED);
    }
  });

  // ── Anti-orphan: the multiplier on screen is the LIVE engine's ─────────────

  it('reads the multiplier the engine actually scales output by', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 3772, characterProfile: PROFILE });
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const multiplier = world.staffMorale.getMoraleMultiplier(staffId);
    const { getByTestId } = renderPeople(world);
    openMemberCard(getByTestId, staffId);

    expect(
      getByTestId(`people-roster-${staffId}-morale-effect`).props.children,
    ).toBe(moraleEffectText(multiplier));
  });

  it('a fall in live morale changes what the card says it is costing', () => {
    // The consequence has to track the meter. Refusing a raise is the cheapest
    // live path to a morale drop that the engine itself publishes.
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 3773, characterProfile: PROFILE });
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const snap = world.staffOrg.snapshot();
    const board = world.staffOrg.getPayBoard()[0];
    world.staffOrg.restore({
      ...snap,
      raiseRequests: [
        {
          staffId,
          roleId: 'salesperson',
          day: snap.currentDay,
          currentWage: board.dailyWage,
          askedWage: board.dailyWage + 200,
          paidGrade: board.paidGrade,
          grade: board.grade + 1,
        },
      ],
    });

    const before = world.staffMorale.getMoraleMultiplier(staffId);
    const { getByTestId, rerender } = renderPeople(world);
    fireEvent.press(getByTestId(`people-raise-refuse-${staffId}`));

    const after = world.staffMorale.getMoraleMultiplier(staffId);
    expect(after).toBeLessThan(before);

    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );
    // The card opened itself for the demand and stays open across the
    // re-render; pressing the header again would fold it shut.
    expect(
      getByTestId(`people-roster-${staffId}-morale-effect`).props.children,
    ).toBe(moraleEffectText(after));
  });
});
