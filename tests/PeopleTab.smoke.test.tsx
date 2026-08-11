import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PeopleTab,
  type PeopleTabProps,
  type PeopleCandidate,
  type PeopleRosterMember,
  type PeopleSlotRow,
} from '../src/ui/PeopleTab';

// #347 — the People tab is the org surface: roster + hiring pool + manager
// delegation as three sections of ONE surface. Before this slice it rendered
// only the delegation card (three ABSENT rows at Tier 1) while the roster and
// the candidate pool sat two levels down inside Operations → Prep.

const MEMBER: PeopleRosterMember = {
  id: 'staff:career_salesperson:1:0',
  name: 'Marcus Delgado',
  roleLabel: 'Salesperson',
  department: 'sales',
  workQuality: 0.72,
  honesty: 0.64,
  morale: 0.8,
  // #377 — what that morale is doing to their output. 1 is no effect.
  moraleMultiplier: 1.08,
  // #353 — a fresh hire is paid at the grade they signed at, so the two agree.
  grade: 3,
  paidGrade: 3,
  dailyWage: 340,
  skills: [
    { id: 'communication', label: 'Talking with customers', value: 70, cap: 100 },
    { id: 'rapport_building', label: 'Building rapport', value: 20, cap: 100 },
  ],
  promotions: [{ toRoleId: 'used-car-manager', label: 'Used-Car Manager' }],
  raise: null,
};

/** A second body on the roster, deliberately weaker on the same skill axis. */
const GREENPEA: PeopleRosterMember = {
  ...MEMBER,
  id: 'staff:career_salesperson:1:1',
  name: 'Dana Whitfield',
  grade: 1,
  paidGrade: 1,
  dailyWage: 160,
  skills: [
    { id: 'communication', label: 'Talking with customers', value: 15, cap: 100 },
    { id: 'rapport_building', label: 'Building rapport', value: 20, cap: 100 },
  ],
  promotions: [],
};

const CANDIDATE: PeopleCandidate = {
  id: 'candidate:salesperson:1:0',
  name: 'Priya Nakamura',
  roleLabel: 'Salesperson',
  department: 'sales',
  traits: ['Charisma', 'Closer'],
  workQuality: 0.55,
  honesty: 0.41,
  grade: 2,
  dailyWage: 220,
  skills: [
    { id: 'communication', label: 'Talking with customers', value: 48, cap: 100 },
  ],
  hiringCost: 1000,
};

// #352 — desks are per JOB. Two salesperson desks (one taken by MEMBER), one
// UCM desk, and a promotion-only technician desk that offers no hire. The
// technician sits in Service, so the fixture also exercises the department
// split: two panels, not one column.
const SLOTS: PeopleSlotRow[] = [
  {
    roleId: 'salesperson',
    label: 'Salesperson',
    department: 'sales',
    filled: 1,
    total: 2,
    hireable: true,
  },
  {
    roleId: 'used-car-manager',
    label: 'Used-Car Manager',
    department: 'sales',
    filled: 0,
    total: 1,
    hireable: true,
  },
  {
    roleId: 'technician',
    label: 'Technician',
    department: 'service',
    filled: 0,
    total: 1,
    hireable: false,
  },
];

function baseProps(over: Partial<PeopleTabProps> = {}): PeopleTabProps {
  return {
    managerStatus: { ucmPresent: false, ucm: [], departments: [] },
    roster: [MEMBER],
    dailyPayroll: MEMBER.dailyWage,
    slots: SLOTS,
    hiring: {
      roleOptions: [
        { id: 'salesperson', label: 'Salesperson', department: 'sales' },
        { id: 'used-car-manager', label: 'Used-Car Manager', department: 'sales' },
      ],
      selectedRoleId: 'salesperson',
      candidates: [CANDIDATE],
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
 * Open a folded person / applicant card. A card is shut to the line the player
 * compares people on (name, job, what they cost); the meters, the skill axes
 * and the promote/let-go buttons are one tap behind that. Tests that assert on
 * the evidence tap the same header a player does.
 */
function openCard(
  getByTestId: (id: string) => { props: Record<string, unknown> },
  cardTestId: string,
): void {
  fireEvent.press(getByTestId(`${cardTestId}-header`));
}

describe('PeopleTab', () => {
  it('renders the roster, the hiring pool and manager delegation as one surface', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);

    expect(getByTestId('people-region-roster')).toBeTruthy();
    expect(getByTestId('people-region-hiring')).toBeTruthy();
    expect(getByTestId('people-region-managers')).toBeTruthy();
    // Delegation is a reference read, not a decision, so its panel starts shut.
    fireEvent.press(getByTestId('people-delegation-header'));
    expect(getByTestId('manager-status-card')).toBeTruthy();
  });

  // ── Department panels: the separation the surface is built on ──────────────

  it('groups the team into one collapsible panel per department', () => {
    // A salesperson and a service technician are not the same kind of row, and
    // a flat column said they were. Sales and Service are separate boxes with
    // their own desk counts and their own fold.
    const { getByTestId, getAllByText } = render(<PeopleTab {...baseProps()} />);

    expect(getByTestId('people-dept-sales')).toBeTruthy();
    expect(getByTestId('people-dept-service')).toBeTruthy();
    // The same department names title the hiring panels, so a job you are
    // shopping for is grouped under the box its people end up in.
    expect(getAllByText('Sales').length).toBeGreaterThan(0);
    expect(getByTestId('people-hiring-dept-sales')).toBeTruthy();
  });

  it('renders no panel for a department the store has neither desks nor people in', () => {
    // Locked IA rule 3 — a mechanic that does not exist renders NOTHING. An
    // empty "Body Shop" panel at Tier 1 is a foreshadow tile.
    const { queryByTestId } = render(<PeopleTab {...baseProps()} />);
    expect(queryByTestId('people-dept-body')).toBeNull();
  });

  it('folds a department shut and its people go with it', () => {
    const { getByTestId, queryByTestId } = render(<PeopleTab {...baseProps()} />);

    expect(getByTestId(`people-roster-card-${MEMBER.id}`)).toBeTruthy();
    fireEvent.press(getByTestId('people-dept-sales-header'));
    expect(queryByTestId(`people-roster-card-${MEMBER.id}`)).toBeNull();
  });

  it('states each department’s own desk count, not the store total', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    // Sales owns two of the three jobs (salesperson 1 of 2, UCM 0 of 1).
    expect(getByTestId('people-dept-sales-header').props.accessibilityLabel).toBe(
      'Sales. 1 of 3 desks filled',
    );
    expect(getByTestId('people-dept-service-header').props.accessibilityLabel).toBe(
      'Service. 0 of 1 desks filled',
    );
  });

  it('names each roster member instead of labelling them by role alone', () => {
    const { getByText } = render(<PeopleTab {...baseProps()} />);
    expect(getByText('Marcus Delgado')).toBeTruthy();
    expect(getByText('Priya Nakamura')).toBeTruthy();
  });

  it('renders no Development section while the training mechanic does not exist', () => {
    // Locked IA rules 1 + 3: a section ships only with a decision behind it,
    // and a mechanic that does not exist renders NOTHING — no grayed tile, no
    // "coming soon" tease. This is a regression lock on the foreshadow ban.
    const { queryByTestId } = render(<PeopleTab {...baseProps()} />);
    expect(queryByTestId('people-development')).toBeNull();
  });

  it('sizes each skill bar in proportion to that skill value', () => {
    // The defect this replaces: SkillRow sized its fill with `flex: ratio`
    // inside a container that never set flexDirection: 'row', so RN stacked
    // fill and spacer vertically and EVERY bar rendered identically.
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    openCard(getByTestId, `people-roster-card-${MEMBER.id}`);

    const high = getByTestId(`roster-${MEMBER.id}-skill-fill-communication`);
    const low = getByTestId(`roster-${MEMBER.id}-skill-fill-rapport_building`);

    expect(high.props.style.width).toBe('70%');
    expect(low.props.style.width).toBe('20%');
    expect(high.props.style.width).not.toBe(low.props.style.width);
  });

  // #354 — grade and daily wage are the two numbers the hire decision is made
  // on, and the roster's total drain has to be readable in the same glance.

  it('a roster card states grade and the wage being paid', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);
    expect(getByTestId(`people-roster-pay-${MEMBER.id}`).props.children).toBe(
      'Grade 3 · $340/day',
    );
  });

  it('a candidate card states grade and daily wage', () => {
    const { getByTestId, getByText } = render(<PeopleTab {...baseProps()} />);
    expect(getByTestId(`people-candidate-pay-${CANDIDATE.id}`).props.children).toBe(
      'Grade 2 · $220/day',
    );
    // ...and the one-time fee stays legible as a DIFFERENT number, not a second
    // unlabelled dollar figure sitting beside the wage.
    expect(getByText('to sign')).toBeTruthy();
  });

  it('shows total daily payroll for the roster', () => {
    const props = baseProps({
      roster: [MEMBER, GREENPEA],
      dailyPayroll: MEMBER.dailyWage + GREENPEA.dailyWage,
    });
    const { getByTestId, getByText } = render(<PeopleTab {...props} />);

    expect(getByTestId('people-payroll-total').props.children).toBe('$500/day');
    expect(getByText('daily payroll')).toBeTruthy();
  });

  it('reads the payroll total off the engine rather than re-adding the cards', () => {
    // The number on screen must be the number the overnight drain charges. If
    // the surface summed the cards itself, the two could disagree the moment a
    // wage stops being a plain per-member sum.
    const props = baseProps({ roster: [MEMBER, GREENPEA], dailyPayroll: 1234 });
    const { getByTestId } = render(<PeopleTab {...props} />);
    expect(getByTestId('people-payroll-total').props.children).toBe('$1,234/day');
  });

  it('shows no payroll line when nobody is on payroll', () => {
    const { queryByTestId } = render(
      <PeopleTab {...baseProps({ roster: [], dailyPayroll: 0 })} />,
    );
    expect(queryByTestId('people-payroll-total')).toBeNull();
  });

  it('shows grade and paid grade separately when they diverge', () => {
    // Growth never silently reprices anyone (#353 R2): the wage stays at the
    // grade they were hired at, so an outgrown member states BOTH numbers. A
    // single blended figure would name a wage nobody is paying and hide the
    // gap the raise demand fires on.
    const outgrown: PeopleRosterMember = { ...MEMBER, grade: 4, paidGrade: 3 };
    const props = baseProps({ roster: [outgrown], dailyPayroll: outgrown.dailyWage });
    const { getByTestId } = render(<PeopleTab {...props} />);

    expect(getByTestId(`people-roster-pay-${MEMBER.id}`).props.children).toBe(
      'Grade 4 · Paid at grade 3 · $340/day',
    );
  });

  it('two members differing in a skill do not render the same bar', () => {
    const props = baseProps({
      roster: [MEMBER, GREENPEA],
      dailyPayroll: MEMBER.dailyWage + GREENPEA.dailyWage,
    });
    const { getByTestId } = render(<PeopleTab {...props} />);
    openCard(getByTestId, `people-roster-card-${MEMBER.id}`);
    openCard(getByTestId, `people-roster-card-${GREENPEA.id}`);

    const mature = getByTestId(`roster-${MEMBER.id}-skill-fill-communication`);
    const green = getByTestId(`roster-${GREENPEA.id}-skill-fill-communication`);

    expect(mature.props.style.width).toBe('70%');
    expect(green.props.style.width).toBe('15%');
  });

  it('hires, promotes and fires through the surface handlers', () => {
    const props = baseProps();
    const { getByTestId } = render(<PeopleTab {...props} />);

    // Hiring is the action the pool exists for, so its button sits on the shut
    // card — never a second tap behind a fold.
    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).toHaveBeenCalledWith(CANDIDATE.id);

    openCard(getByTestId, `people-roster-card-${MEMBER.id}`);
    fireEvent.press(getByTestId(`people-promote-${MEMBER.id}-used-car-manager`));
    expect(props.onPromote).toHaveBeenCalledWith(MEMBER.id, 'used-car-manager');

    fireEvent.press(getByTestId(`people-fire-${MEMBER.id}`));
    expect(props.onFire).toHaveBeenCalledWith(MEMBER.id);
  });

  it('refuses a hire the player cannot pay for', () => {
    const props = baseProps({
      hiring: { ...baseProps().hiring, cash: 100 },
    });
    const { getByTestId, getByText } = render(<PeopleTab {...props} />);

    expect(getByText("Can't afford")).toBeTruthy();
    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).not.toHaveBeenCalled();
  });

  it('does not offer a candidate for a full role', () => {
    // `staffOrg.hire` throws once the ROLE's desks are taken; a surface must
    // not offer a press that throws, so the count is read off the engine and
    // never re-derived. Scarcity is per job, not per body (#352).
    const props = baseProps({
      slots: [{ ...SLOTS[0], filled: 2, total: 2 }, ...SLOTS.slice(1)],
    });
    const { getByTestId, getByText } = render(<PeopleTab {...props} />);

    expect(getByText('No desk open for this job')).toBeTruthy();
    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).not.toHaveBeenCalled();
  });

  it('still offers a candidate when a DIFFERENT role is the full one', () => {
    // The regression the flat headcount cap caused: filling the sales floor
    // used to shut hiring off for the whole store, service desk included.
    const props = baseProps({
      slots: [{ ...SLOTS[0], filled: 2, total: 2 }, ...SLOTS.slice(1)],
      hiring: { ...baseProps().hiring, selectedRoleId: 'used-car-manager' },
    });
    const { getByTestId } = render(<PeopleTab {...props} />);

    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).toHaveBeenCalledWith(CANDIDATE.id);
  });

  it('renders a slot row per open role with filled of total', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);

    expect(getByTestId('people-slot-board-sales')).toBeTruthy();
    expect(getByTestId('people-slot-count-salesperson').props.children.join('')).toBe(
      '1 of 2',
    );
    expect(getByTestId('people-slot-count-used-car-manager').props.children.join('')).toBe(
      '0 of 1',
    );
  });

  it('an empty slot opens hiring for that role', () => {
    const props = baseProps();
    const { getByTestId } = render(<PeopleTab {...props} />);

    fireEvent.press(getByTestId('people-slot-used-car-manager'));
    expect(props.onSelectHiringRole).toHaveBeenCalledWith('used-car-manager');
  });

  it('a full slot row is not a hire affordance', () => {
    const props = baseProps({
      slots: [{ ...SLOTS[0], filled: 2, total: 2 }, ...SLOTS.slice(1)],
    });
    const { getByTestId } = render(<PeopleTab {...props} />);

    fireEvent.press(getByTestId('people-slot-salesperson'));
    expect(props.onSelectHiringRole).not.toHaveBeenCalled();
  });

  it('a promotion-only role shows its desks but offers no hire', () => {
    // `technician` is reached by promoting a lot-porter, never hired cold —
    // its slot gates the promotion, so the count is worth showing and the
    // press is not.
    const props = baseProps();
    const { getByTestId } = render(<PeopleTab {...props} />);

    expect(getByTestId('people-slot-count-technician').props.children.join('')).toBe(
      '0 of 1',
    );
    fireEvent.press(getByTestId('people-slot-technician'));
    expect(props.onSelectHiringRole).not.toHaveBeenCalled();
  });

  it('says so plainly when nobody is on payroll', () => {
    const { getByText } = render(<PeopleTab {...baseProps({ roster: [] })} />);
    expect(getByText(/Nobody on payroll/)).toBeTruthy();
  });

  // ── The raise moment (#356) ────────────────────────────────────────────────

  it('renders the raise prompt with both numbers and two buttons', () => {
    const asking: PeopleRosterMember = {
      ...MEMBER,
      grade: 4,
      paidGrade: 3,
      raise: { currentWage: 340, askedWage: 520 },
    };
    const props = baseProps({ roster: [asking] });
    const { getByTestId } = render(<PeopleTab {...props} />);

    // Both wages, in the surface's own `$N/day` grammar, and no temperature word
    // anywhere near them.
    expect(getByTestId(`people-raise-ask-${asking.id}`).props.children).toBe(
      'Asking for $520/day. On $340/day now.',
    );

    fireEvent.press(getByTestId(`people-raise-accept-${asking.id}`));
    expect(props.onAcceptRaise).toHaveBeenCalledWith(asking.id);

    fireEvent.press(getByTestId(`people-raise-refuse-${asking.id}`));
    expect(props.onRefuseRaise).toHaveBeenCalledWith(asking.id);
  });

  it('shows no prompt for someone who is not asking', () => {
    const { queryByTestId } = render(<PeopleTab {...baseProps()} />);
    expect(queryByTestId(`people-raise-${MEMBER.id}`)).toBeNull();
  });

  it('prompts only the person asking, not the whole roster', () => {
    const asking: PeopleRosterMember = {
      ...MEMBER,
      raise: { currentWage: 340, askedWage: 520 },
    };
    const { getByTestId, queryByTestId } = render(
      <PeopleTab {...baseProps({ roster: [asking, GREENPEA] })} />,
    );
    expect(getByTestId(`people-raise-${asking.id}`)).toBeTruthy();
    expect(queryByTestId(`people-raise-${GREENPEA.id}`)).toBeNull();
  });

  // ── The rival's offer: the SAME moment with a name on it (#357) ────────────

  it('renders the rival-offer prompt with name, wage and deadline', () => {
    const courted: PeopleRosterMember = {
      ...MEMBER,
      raise: {
        currentWage: 340,
        askedWage: 610,
        rivalName: 'Northside Kaivo',
        deadlineDay: 13,
      },
    };
    const props = baseProps({ roster: [courted] });
    const { getByTestId } = render(<PeopleTab {...props} />);

    // Who is offering, how much, and against what they are on now — one
    // sentence, same `$N/day` grammar as every other wage on the surface.
    expect(getByTestId(`people-raise-ask-${courted.id}`).props.children).toBe(
      'Northside Kaivo offered $610/day. On $340/day now.',
    );
    // The deadline is an exact day, not "soon" and not a countdown the player
    // has to do arithmetic on.
    expect(getByTestId(`people-raise-deadline-${courted.id}`).props.children).toBe(
      'They leave on day 13 unless you match.',
    );
  });

  it('names the two answers for what they now mean', () => {
    const courted: PeopleRosterMember = {
      ...MEMBER,
      raise: {
        currentWage: 340,
        askedWage: 610,
        rivalName: 'Northside Kaivo',
        deadlineDay: 13,
      },
    };
    const props = baseProps({ roster: [courted] });
    const { getByTestId, getByText } = render(<PeopleTab {...props} />);

    // Not "Pay it" / "Refuse": matching a rival is not a raise, and refusing
    // one is a departure. Same two buttons, same handlers — new words.
    expect(getByText('Match')).toBeTruthy();
    expect(getByText('Let them go')).toBeTruthy();

    fireEvent.press(getByTestId(`people-raise-accept-${courted.id}`));
    expect(props.onAcceptRaise).toHaveBeenCalledWith(courted.id);
    fireEvent.press(getByTestId(`people-raise-refuse-${courted.id}`));
    expect(props.onRefuseRaise).toHaveBeenCalledWith(courted.id);
  });

  it('states no deadline on a plain raise demand', () => {
    const asking: PeopleRosterMember = {
      ...MEMBER,
      raise: { currentWage: 340, askedWage: 520 },
    };
    const { queryByTestId, getByText } = render(
      <PeopleTab {...baseProps({ roster: [asking] })} />,
    );
    expect(queryByTestId(`people-raise-deadline-${asking.id}`)).toBeNull();
    expect(getByText('Pay it')).toBeTruthy();
  });
});
