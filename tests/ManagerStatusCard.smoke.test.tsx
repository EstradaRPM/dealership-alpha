import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PeopleTab, ManagerStatusCard } from '../src/ui/PeopleTab';
import type { ManagerStatusModel } from '../src/ui/PeopleTab';

const NO_MANAGERS: ManagerStatusModel = {
  ucmPresent: false,
  ucm: [
    { axis: 'pricing', delegated: false, skill: null, threshold: 60 },
    { axis: 'condition_reading', delegated: false, skill: null, threshold: 60 },
    { axis: 't_o_closing', delegated: false, skill: null, threshold: 60 },
  ],
  departments: [
    { dept: 'service', present: false, functions: [] },
    { dept: 'body', present: false, functions: [] },
  ],
};

const MIXED: ManagerStatusModel = {
  ucmPresent: true,
  ucm: [
    // Above the gate — delegated.
    { axis: 'pricing', delegated: true, skill: 72, threshold: 60 },
    // Present but below the gate — advising only.
    { axis: 'condition_reading', delegated: false, skill: 48, threshold: 60 },
    { axis: 't_o_closing', delegated: false, skill: 48, threshold: 60 },
  ],
  departments: [
    {
      dept: 'service',
      present: true,
      functions: [
        { fn: 'par', automated: true },
        { fn: 'pricing', automated: true },
        { fn: 'marketing', automated: false },
        { fn: 'rush', automated: false },
        { fn: 'capacity', automated: false },
      ],
    },
    { dept: 'body', present: false, functions: [] },
  ],
};

describe('ManagerStatusCard (#325)', () => {
  it('renders without crashing when no managers are on staff', () => {
    const { getByTestId, getByText } = render(<ManagerStatusCard model={NO_MANAGERS} />);
    expect(getByTestId('manager-status-card')).toBeTruthy();
    expect(getByText('Used-Car Manager')).toBeTruthy();
    // No-UCM prompt + all-manual copy surfaces.
    expect(getByText(/Hire a used-car manager/)).toBeTruthy();
    expect(getByText('You price every unit by hand.')).toBeTruthy();
    // The override invariant always shows (delegation = permission).
    expect(getByText(/Delegation is permission, not amputation\./)).toBeTruthy();
  });

  it('names the delegation for a crossed gate and advising for a below-gate axis', () => {
    const { getByText, queryByText } = render(<ManagerStatusCard model={MIXED} />);
    // Delegated pricing names the hand-off explicitly.
    expect(getByText('Your UCM auto-prices new inventory to your posture.')).toBeTruthy();
    // Below-gate axis reads as advising, not delegated.
    expect(getByText(/Your UCM advises on appraisals/)).toBeTruthy();
    // A present service manager surfaces its automated rungs.
    expect(getByText('Service Manager')).toBeTruthy();
    expect(getByText('Parts par')).toBeTruthy();
    // Body shop manager absent → its rung pills are not rendered.
    expect(queryByText('Insurance / retail channel')).toBeNull();
  });

  it('renders inside the People tab surface', () => {
    const { getByTestId } = render(
      <PeopleTab
        managerStatus={NO_MANAGERS}
        roster={[]}
        dailyPayroll={0}
        slots={[
          {
            roleId: 'salesperson',
            label: 'Salesperson',
            department: 'sales',
            filled: 0,
            total: 1,
            hireable: true,
          },
        ]}
        hiring={{
          roleOptions: [{ id: 'salesperson', label: 'Salesperson', department: 'sales' }],
          selectedRoleId: 'salesperson',
          candidates: [],
          cash: 50_000,
        }}
        onSelectHiringRole={() => {}}
        onHire={() => {}}
        onPromote={() => {}}
        onFire={() => {}}
        onAcceptRaise={() => {}}
        onRefuseRaise={() => {}}
      />,
    );
    expect(getByTestId('people-tab')).toBeTruthy();
    // Delegation is its own panel and starts shut — it is a reference read, not
    // a decision. Opening it is the tap a player makes to check what their
    // managers are allowed to do.
    fireEvent.press(getByTestId('people-delegation-header'));
    expect(getByTestId('manager-status-card')).toBeTruthy();
  });
});
