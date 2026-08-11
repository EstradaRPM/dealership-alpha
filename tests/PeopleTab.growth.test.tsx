import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PeopleTab,
  type PeopleTabProps,
  type PeopleRosterMember,
} from '../src/ui/PeopleTab';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { PeopleTabContainer } from '../src/app/screens/PeopleTabContainer';
import type { CharacterProfile } from '../src/game/CareerProgression';

// #377 — Model B (#294) holds THREE numbers per axis: where a person started,
// where they are, and how far they can ever get. The card drew the middle one
// alone, so a rookie climbing and a veteran who has topped out rendered
// identically — which is the entire decision the growth model exists to create.

const MEMBER: PeopleRosterMember = {
  id: 'staff:veteran_used_car_manager:1:0',
  name: 'Marcus Delgado',
  roleLabel: 'Used-Car Manager',
  department: 'sales',
  workQuality: 0.72,
  honesty: 0.64,
  morale: 0.8,
  moraleMultiplier: 1,
  grade: 3,
  paidGrade: 3,
  dailyWage: 340,
  skills: [
    // Climbing: past where they were hired, short of their own ceiling.
    {
      id: 'condition_reading',
      label: "Reading a car's condition",
      value: 57,
      cap: 100,
      growth: { hiredAt: 50, ceiling: 68, grows: true },
    },
    // Finished: at their ceiling, well under the axis cap.
    {
      id: 'pricing',
      label: 'Pricing cars',
      value: 72,
      cap: 100,
      growth: { hiredAt: 60, ceiling: 72, grows: true },
    },
    // Static: no `growth_counter` in `data/staff-skills.json`, so experience
    // never moves it.
    {
      id: 'communication',
      label: 'Talking with customers',
      value: 44,
      cap: 100,
      growth: { hiredAt: 44, ceiling: 44, grows: false },
    },
  ],
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
        roleId: 'used-car-manager',
        label: 'Used-Car Manager',
        department: 'sales',
        filled: 1,
        total: 1,
        hireable: true,
      },
    ],
    hiring: {
      roleOptions: [
        { id: 'used-car-manager', label: 'Used-Car Manager', department: 'sales' },
      ],
      selectedRoleId: 'used-car-manager',
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

/**
 * The bar's own arithmetic, reproduced rather than rounded: a track position is
 * a raw percentage string, so `57 / 100` legitimately renders as
 * `56.99999999999999%`. Asserting a tidied literal would be asserting a
 * rounding the component does not do.
 */
function trackPct(value: number, cap = 100): string {
  return `${Math.max(0, Math.min(1, value / cap)) * 100}%`;
}

/** The evidence sits one tap behind the fold, same as a player reaches it. */
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
      selectedHiringRoleId="used-car-manager"
      setSelectedHiringRoleId={() => {}}
      setCash={() => {}}
      bump={() => {}}
    />,
  );
}

describe('#377 skill growth is visible on a roster card', () => {
  it('a card states hired-at, now, and ceiling per axis', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    openMemberCard(getByTestId);
    const prefix = `roster-${MEMBER.id}`;

    // Now: the fill, read against the axis's own 0–100 scale so two people's
    // bars stay comparable down the panel.
    expect(
      getByTestId(`${prefix}-skill-fill-condition_reading`).props.style.width,
    ).toBe(trackPct(57));
    // Hired at: a hairline on the same track, so the fill beyond it is the
    // distance this person has actually travelled.
    expect(
      getByTestId(`${prefix}-skill-hired-condition_reading`).props.style.left,
    ).toBe(trackPct(50));
    // Ceiling: the point past which the track cannot be filled.
    expect(
      getByTestId(`${prefix}-skill-ceiling-condition_reading`).props.style.left,
    ).toBe(trackPct(68));
    // ...and all three said in words, since a bar with three marks on it is
    // not self-explaining.
    expect(
      getByTestId(`${prefix}-skill-growth-condition_reading`).props.children,
    ).toBe('From 50 at hire · can reach 68.');
  });

  it('a topped-out veteran reads as topped out', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    openMemberCard(getByTestId);

    // Not a full bar with no explanation: `pricing` sits at 72 of an axis cap
    // of 100, so nothing about the fill says "this is as good as they get".
    expect(
      getByTestId(`roster-${MEMBER.id}-skill-fill-pricing`).props.style.width,
    ).toBe(trackPct(72));
    expect(
      getByTestId(`roster-${MEMBER.id}-skill-growth-pricing`).props.children,
    ).toBe('From 60 at hire · as far as they can go.');
  });

  it('a static axis makes no growth claim', () => {
    const { getByTestId, queryByTestId } = render(<PeopleTab {...baseProps()} />);
    openMemberCard(getByTestId);
    const prefix = `roster-${MEMBER.id}`;

    expect(getByTestId(`${prefix}-skill-growth-communication`).props.children).toBe(
      "Fixed at hire — experience doesn't move this one.",
    );
    // No start mark and no ceiling: there is no journey, and drawing the
    // furniture of one would imply a bar that will fill.
    expect(queryByTestId(`${prefix}-skill-hired-communication`)).toBeNull();
    expect(queryByTestId(`${prefix}-skill-ceiling-communication`)).toBeNull();
  });

  it('a climbing axis and a topped-out one do not render the same card', () => {
    // The defect in one assertion: before this slice both axes drew a plain
    // fill and the only difference between them was a number.
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    openMemberCard(getByTestId);
    const prefix = `roster-${MEMBER.id}`;

    expect(getByTestId(`${prefix}-skill-growth-condition_reading`).props.children).not.toBe(
      getByTestId(`${prefix}-skill-growth-pricing`).props.children,
    );
  });

  it('a candidate card carries no growth reading', () => {
    // Nobody has started yet, so there is no distance to draw — an applicant's
    // bar is a level, and saying "from 44 at hire" about someone who has not
    // been hired would be a claim about a career that has not happened.
    const props = baseProps({
      hiring: {
        ...baseProps().hiring,
        candidates: [
          {
            id: 'candidate:used-car-manager:1:0',
            name: 'Priya Nakamura',
            roleLabel: 'Used-Car Manager',
            department: 'sales',
            traits: [],
            workQuality: 0.55,
            honesty: 0.41,
            grade: 2,
            dailyWage: 220,
            skills: [
              { id: 'pricing', label: 'Pricing cars', value: 48, cap: 100 },
            ],
            hiringCost: 1000,
          },
        ],
      },
    });
    const { getByTestId, queryByTestId } = render(<PeopleTab {...props} />);
    fireEvent.press(
      getByTestId('people-candidate-card-candidate:used-car-manager:1:0-header'),
    );

    const prefix = 'candidate-candidate:used-car-manager:1:0';
    expect(getByTestId(`${prefix}-skill-fill-pricing`).props.style.width).toBe(trackPct(48));
    expect(queryByTestId(`${prefix}-skill-growth-pricing`)).toBeNull();
    expect(queryByTestId(`${prefix}-skill-hired-pricing`)).toBeNull();
  });

  // ── Anti-orphan: the numbers on screen are the LIVE engine's ───────────────

  it('a day of employment moves the card', () => {
    // The counters accrue overnight and nothing surfaced them, so the whole
    // growth model read as static. `condition_reading` grows on `days_employed`
    // (`data/staff-skills.json`), and the UCM desk opens at Tier 3.
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 377, characterProfile: PROFILE });
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 3 });

    const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const axis = (rows: readonly { skillId: string; current: number }[]) =>
      rows.find((r) => r.skillId === 'condition_reading')!;
    const before = axis(world.staffOrg.getSkillGrowth(staffId));

    const { getByTestId, rerender } = renderPeople(world);
    openMemberCard(getByTestId, staffId);
    const prefix = `roster-${staffId}`;
    // At hire the grown value IS the base roll, so the mark sits under the
    // fill's own edge.
    expect(getByTestId(`${prefix}-skill-fill-condition_reading`).props.style.width).toBe(
      getByTestId(`${prefix}-skill-hired-condition_reading`).props.style.left,
    );

    for (let i = 0; i < 10; i++) {
      world.clock.advanceDay();
      // A morning can bring a raise demand or a rival's offer, and an unanswered
      // prompt is what expires into a departure (#357). Answering each one keeps
      // the person on the roster — this test is about the counters, not about
      // who leaves.
      if (world.staffOrg.getRaiseRequest(staffId)) world.staffOrg.acceptRaise(staffId);
    }
    expect(world.staffOrg.currentRoster.map((s) => s.id)).toContain(staffId);

    const after = axis(world.staffOrg.getSkillGrowth(staffId));
    expect(after.current).toBeGreaterThan(before.current);

    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="used-car-manager"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );
    // The card stays open across the re-render, so it is not re-opened here —
    // pressing the header again would fold it shut.

    // The card states the engine's own grown value...
    expect(
      getByTestId(`${prefix}-skill-fill-condition_reading`).props.style.width,
    ).toBe(trackPct(after.current));
    // ...and it has moved off where they were hired, which is the reading the
    // whole slice exists to make visible.
    expect(
      getByTestId(`${prefix}-skill-fill-condition_reading`).props.style.width,
    ).not.toBe(getByTestId(`${prefix}-skill-hired-condition_reading`).props.style.left);
  });

  it('the ceiling on the card is the one the engine clamps to', () => {
    // The per-hire cap is rolled from `masterSeed` + the staff id, so a surface
    // that re-derived it would name a limit the engine does not enforce. It
    // comes off `staffOrg.getSkillGrowth`, and it survives a save round trip
    // because it is derived, never stored (#294).
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 3771, characterProfile: PROFILE });
    const tierState = world.tierManager.getSerializableState();
    world.tierManager.restoreState({ ...tierState, currentTier: 3 });

    const candidate = world.staffOrg.getCandidates('used-car-manager')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const reading = world.staffOrg
      .getSkillGrowth(staffId)
      .find((r) => r.skillId === 'condition_reading')!;
    expect(reading.ceiling).toBeGreaterThanOrEqual(reading.hiredAt);
    expect(reading.grows).toBe(true);

    const { getByTestId } = renderPeople(world);
    openMemberCard(getByTestId, staffId);
    expect(
      getByTestId(`roster-${staffId}-skill-ceiling-condition_reading`).props.style.left,
    ).toBe(trackPct(reading.ceiling));

    const snap = JSON.parse(JSON.stringify(world.staffOrg.snapshot()));
    world.staffOrg.restore(snap);
    expect(
      world.staffOrg
        .getSkillGrowth(staffId)
        .find((r) => r.skillId === 'condition_reading')!.ceiling,
    ).toBe(reading.ceiling);
  });
});
