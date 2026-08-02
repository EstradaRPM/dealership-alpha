import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  PeopleTab,
  type PeopleTabProps,
  type PeopleCandidate,
  type PeopleRosterMember,
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

function baseProps(over: Partial<PeopleTabProps> = {}): PeopleTabProps {
  return {
    managerStatus: { ucmPresent: false, ucm: [], departments: [] },
    roster: [MEMBER],
    hiring: {
      roleOptions: [
        { id: 'salesperson', label: 'Salesperson' },
        { id: 'used-car-manager', label: 'Used-Car Manager' },
      ],
      selectedRoleId: 'salesperson',
      candidates: [CANDIDATE],
      cash: 50_000,
      headcountCap: 4,
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

  it('refuses a hire once the tier has no payroll slot left', () => {
    // `staffOrg.hire` throws at the headcount cap; a surface must not offer a
    // press that throws, so the cap is read off the engine, never re-derived.
    const props = baseProps({
      roster: [MEMBER, { ...MEMBER, id: 'b' }, { ...MEMBER, id: 'c' }, { ...MEMBER, id: 'd' }],
    });
    const { getByTestId, getByText } = render(<PeopleTab {...props} />);

    expect(getByText('No room on payroll')).toBeTruthy();
    fireEvent.press(getByTestId(`people-hire-${CANDIDATE.id}`));
    expect(props.onHire).not.toHaveBeenCalled();
  });

  it('says so plainly when nobody is on payroll', () => {
    const { getByText } = render(<PeopleTab {...baseProps({ roster: [] })} />);
    expect(getByText(/Nobody on payroll/)).toBeTruthy();
  });
});
