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
  workQuality: 0.72,
  honesty: 0.64,
  morale: 0.8,
  skills: [
    { id: 'communication', label: 'Talking with customers', value: 70, cap: 100 },
    { id: 'rapport_building', label: 'Building rapport', value: 20, cap: 100 },
  ],
  promotions: [{ toRoleId: 'used-car-manager', label: 'Used-Car Manager' }],
};

const CANDIDATE: PeopleCandidate = {
  id: 'candidate:salesperson:1:0',
  name: 'Priya Nakamura',
  roleLabel: 'Salesperson',
  traits: ['Charisma', 'Closer'],
  workQuality: 0.55,
  honesty: 0.41,
  skills: [
    { id: 'communication', label: 'Talking with customers', value: 48, cap: 100 },
  ],
  hiringCost: 1000,
};

// #352 — desks are per JOB. Two salesperson desks (one taken by MEMBER), one
// UCM desk, and a promotion-only technician desk that offers no hire.
const SLOTS: PeopleSlotRow[] = [
  { roleId: 'salesperson', label: 'Salesperson', filled: 1, total: 2, hireable: true },
  { roleId: 'used-car-manager', label: 'Used-Car Manager', filled: 0, total: 1, hireable: true },
  { roleId: 'technician', label: 'Technician', filled: 0, total: 1, hireable: false },
];

function baseProps(over: Partial<PeopleTabProps> = {}): PeopleTabProps {
  return {
    managerStatus: { ucmPresent: false, ucm: [], departments: [] },
    roster: [MEMBER],
    slots: SLOTS,
    hiring: {
      roleOptions: [
        { id: 'salesperson', label: 'Salesperson' },
        { id: 'used-car-manager', label: 'Used-Car Manager' },
      ],
      selectedRoleId: 'salesperson',
      candidates: [CANDIDATE],
      cash: 50_000,
    },
    onSelectHiringRole: jest.fn(),
    onHire: jest.fn(),
    onPromote: jest.fn(),
    onFire: jest.fn(),
    ...over,
  };
}

describe('PeopleTab', () => {
  it('renders the roster, the hiring pool and manager delegation as one surface', () => {
    const { getByTestId } = render(<PeopleTab {...baseProps()} />);

    expect(getByTestId('people-region-roster')).toBeTruthy();
    expect(getByTestId('people-region-hiring')).toBeTruthy();
    expect(getByTestId('people-region-managers')).toBeTruthy();
    expect(getByTestId('manager-status-card')).toBeTruthy();
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

    const high = getByTestId(`roster-${MEMBER.id}-skill-fill-communication`);
    const low = getByTestId(`roster-${MEMBER.id}-skill-fill-rapport_building`);

    expect(high.props.style.width).toBe('70%');
    expect(low.props.style.width).toBe('20%');
    expect(high.props.style.width).not.toBe(low.props.style.width);
  });

  it('hires, promotes and fires through the surface handlers', () => {
    const props = baseProps();
    const { getByTestId } = render(<PeopleTab {...props} />);

    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).toHaveBeenCalledWith(CANDIDATE.id);

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

    expect(getByTestId('people-slot-board')).toBeTruthy();
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
});
