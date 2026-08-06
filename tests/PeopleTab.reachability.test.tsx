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

  it('states the engine\'s own hire fee on the card, before the hire commits', () => {
    // #355 anti-orphan proof. The fee is now `hireFeeMultiple × this
    // candidate's daily wage`, so the card has to read the engine rather than
    // print a per-tier constant — and it has to say so before the press, since
    // that is the number the decision is made on.
    const world = freshWorld(3550);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    const fee = `$${candidate.hiringCost.toLocaleString()}`;

    const { getByTestId, getByText } = renderPeople(world);
    expect(
      getByTestId(`people-candidate-fee-${candidate.candidateId}`).props.children.join(''),
    ).toBe(fee);
    expect(getByText(`Hire — ${fee}`)).toBeTruthy();

    // Still a candidate, not an employee: the number is quoted up front.
    expect(world.staffOrg.currentRoster).toHaveLength(0);

    const cashBefore = world.economy.cash;
    fireEvent.press(getByTestId(`people-hire-${candidate.candidateId}`));
    expect(cashBefore - world.economy.cash).toBe(candidate.hiringCost);
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

  it('surfaces a live raise demand, and Pay it moves the wage the engine charges', () => {
    // #356 anti-orphan proof. The raise is the one place skill growth turns
    // into a decision, so it only exists if the People tab both SHOWS the
    // engine's demand and can answer it. Seed 3560's third applicant is a
    // grade-3 salesperson; putting them on grade-1 money is the state Model B
    // growth produces after a cheap rookie has been on the floor a while.
    const world = freshWorld(3560);
    const candidate = world.staffOrg.getCandidates('salesperson')[2];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const snap = world.staffOrg.snapshot();
    world.staffOrg.restore({
      ...snap,
      // `paidWage` goes with the grade (#357) — it is the agreed number, and
      // `restore` reprices from `paidGrade` when it is absent. Leaving the
      // hired wage on them would put a grade-1 paid grade beside grade-3 money,
      // which is what a matched rival offer looks like, not an outgrown rookie.
      roster: snap.roster.map((s) =>
        s.id === staffId ? { ...s, paidGrade: 1, paidWage: undefined } : s,
      ),
    });
    world.clock.advanceDay();

    const demand = world.staffOrg.getRaiseRequest(staffId);
    expect(demand).not.toBeNull();
    expect(demand!.askedWage).toBeGreaterThan(demand!.currentWage);

    const { getByTestId, rerender } = renderPeople(world);
    // The two numbers on screen are the engine's, not a re-derivation.
    expect(getByTestId(`people-raise-ask-${staffId}`).props.children).toBe(
      `Asking for $${demand!.askedWage.toLocaleString()}/day. ` +
        `On $${demand!.currentWage.toLocaleString()}/day now.`,
    );

    fireEvent.press(getByTestId(`people-raise-accept-${staffId}`));

    expect(world.staffOrg.getRaiseRequest(staffId)).toBeNull();
    expect(world.staffOrg.dailyPayroll).toBe(demand!.askedWage);
    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );
    // The prompt is gone and the payroll line states the raised number.
    expect(getByTestId('people-payroll-total').props.children).toBe(
      `$${demand!.askedWage.toLocaleString()}/day`,
    );
  });

  it('refusing a live demand holds the wage and costs the member morale', () => {
    const world = freshWorld(3560);
    const candidate = world.staffOrg.getCandidates('salesperson')[2];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    const snap = world.staffOrg.snapshot();
    world.staffOrg.restore({
      ...snap,
      // `paidWage` goes with the grade (#357) — it is the agreed number, and
      // `restore` reprices from `paidGrade` when it is absent. Leaving the
      // hired wage on them would put a grade-1 paid grade beside grade-3 money,
      // which is what a matched rival offer looks like, not an outgrown rookie.
      roster: snap.roster.map((s) =>
        s.id === staffId ? { ...s, paidGrade: 1, paidWage: undefined } : s,
      ),
    });
    world.clock.advanceDay();
    const wageBefore = world.staffOrg.dailyPayroll;
    const moraleBefore = world.staffMorale.getMorale(staffId);

    const { getByTestId } = renderPeople(world);
    fireEvent.press(getByTestId(`people-raise-refuse-${staffId}`));

    expect(world.staffOrg.dailyPayroll).toBe(wageBefore);
    // StaffMorale is wired to the answer through the live bus — no direct call
    // from StaffOrg into it.
    expect(world.staffMorale.getMorale(staffId)).toBeLessThan(moraleBefore);
  });

  it('a rival in the live market comes for a live hire, and Match keeps them', () => {
    // #357 anti-orphan proof, and the one place the `rivalNames` seam in
    // `createWorld` is exercised end to end: nothing is injected here. The
    // world's own competitors are the rivals, the world's own clock brings the
    // offer, and the mounted tab both shows it and answers it.
    const world = freshWorld(3570);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    // Walk the calendar until somebody calls. A plain raise demand is answered
    // as it arrives — an unanswered prompt is exactly what suppresses the
    // rival's approach, so leaving one standing would make this loop wait
    // forever for a call that is correctly not coming.
    let offer = null as ReturnType<typeof world.staffOrg.getRaiseRequest>;
    for (let i = 0; i < 200; i++) {
      world.clock.advanceDay();
      const request = world.staffOrg.getRaiseRequest(staffId);
      if (request?.rivalName !== undefined) {
        offer = request;
        break;
      }
      if (request) world.staffOrg.acceptRaise(staffId);
    }

    expect(offer).not.toBeNull();
    // The rival is a store the player has actually been competing against.
    expect(world.competitorMarket.getCompetitors().map((c) => c.name)).toContain(
      offer!.rivalName,
    );
    expect(offer!.deadlineDay).toBeGreaterThan(offer!.day);

    const { getByTestId, rerender } = renderPeople(world);
    expect(getByTestId(`people-raise-ask-${staffId}`).props.children).toBe(
      `${offer!.rivalName} offered $${offer!.askedWage.toLocaleString()}/day. ` +
        `On $${offer!.currentWage.toLocaleString()}/day now.`,
    );
    expect(getByTestId(`people-raise-deadline-${staffId}`).props.children).toBe(
      `They leave on day ${offer!.deadlineDay} unless you match.`,
    );

    fireEvent.press(getByTestId(`people-raise-accept-${staffId}`));

    // They stayed, and they cost what the prompt said they would.
    expect(world.staffOrg.currentRoster.map((s) => s.id)).toContain(staffId);
    expect(world.staffOrg.dailyPayroll).toBe(offer!.askedWage);
    rerender(
      <PeopleTabContainer
        world={world}
        selectedHiringRoleId="salesperson"
        setSelectedHiringRoleId={() => {}}
        setCash={() => {}}
        bump={() => {}}
      />,
    );
    expect(getByTestId('people-payroll-total').props.children).toBe(
      `$${offer!.askedWage.toLocaleString()}/day`,
    );
  });

  it('letting a rival have them empties the desk on the live roster', () => {
    const world = freshWorld(3571);
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    world.staffOrg.hire(candidate.candidateId);
    const staffId = candidate.staff.id;

    // State the offer through the same public seam a save loads through, rather
    // than walking the calendar a second time — this test is about what "Let
    // them go" does, not about when a rival calls.
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
          grade: board.grade,
          rivalName: 'Northside Kaivo',
          deadlineDay: snap.currentDay + 3,
        },
      ],
    });

    const { getByTestId } = renderPeople(world);
    fireEvent.press(getByTestId(`people-raise-refuse-${staffId}`));

    expect(world.staffOrg.currentRoster).toHaveLength(0);
    expect(world.staffOrg.dailyPayroll).toBe(0);
    // The loss is written where the player can go back and read it, with the
    // rival named on it.
    expect(world.historyLog.getEntries()[0].text).toContain('Northside Kaivo');
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
