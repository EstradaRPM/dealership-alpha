import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  OwnershipLevers,
  type OwnershipLeversProps,
} from '../src/ui/OwnershipLevers';
import { OperationsTab } from '../src/ui/OperationsTab';

const BASE: OwnershipLeversProps = {
  enabled: true,
  hoursOptions: [
    { id: 'short', label: '8 hrs', ticksPerDay: 120 },
    { id: 'standard', label: '10 hrs', ticksPerDay: 180 },
  ],
  hoursOfOpId: 'standard',
  onSelectHours: jest.fn(),
  tradePolicyOptions: [
    { id: 'aggressive', label: 'Aggressive', blurb: 'Pay over book to win trades.' },
    { id: 'market', label: 'Market', blurb: 'Appraise at honest book.' },
    { id: 'conservative', label: 'Conservative', blurb: 'Target under book to protect gross.' },
  ],
  tradePolicyId: 'market',
  onSelectTradePolicy: jest.fn(),
  fniPostureOptions: [
    { id: 'more-per-deal', label: 'More per deal', blurb: 'Mark the rate up as far as the lender allows.' },
    { id: 'balanced', label: 'Balanced', blurb: 'A normal market markup.' },
    { id: 'more-deals', label: 'More deals', blurb: 'Keep the rate close to the bank’s.' },
  ],
  fniPostureId: 'balanced',
  onSelectFniPosture: jest.fn(),
  fniDeskStaffed: true,
};

describe('OwnershipLevers smoke tests', () => {
  it('renders all levers without crashing', () => {
    expect(() => render(<OwnershipLevers {...BASE} />)).not.toThrow();
  });

  it('shows the selected trade policy blurb and dispatches a policy change', () => {
    const onSelectTradePolicy = jest.fn();
    const { getByText } = render(
      <OwnershipLevers {...BASE} onSelectTradePolicy={onSelectTradePolicy} />,
    );
    expect(getByText('Appraise at honest book.')).toBeTruthy();
    fireEvent.press(getByText('Aggressive'));
    expect(onSelectTradePolicy).toHaveBeenCalledWith('aggressive');
  });

  it('selecting an hours option dispatches its id', () => {
    const onSelectHours = jest.fn();
    const { getByText } = render(
      <OwnershipLevers {...BASE} onSelectHours={onSelectHours} />,
    );
    fireEvent.press(getByText('8 hrs'));
    expect(onSelectHours).toHaveBeenCalledWith('short');
  });

  it('renders greyed and inert while the floor is live', () => {
    const onSelectHours = jest.fn();
    const { getByText } = render(
      <OwnershipLevers {...BASE} enabled={false} onSelectHours={onSelectHours} />,
    );
    expect(getByText('Floor open — levers locked.')).toBeTruthy();
    fireEvent.press(getByText('8 hrs'));
    expect(onSelectHours).not.toHaveBeenCalled();
  });
});

// #366 — the F&I posture dial is the player's ONE finance input, and it sits
// beside the other desk levers rather than on a store-wide screen (grill Q6).
describe('#366 the F&I posture dial', () => {
  it('shows the selected posture blurb and dispatches a posture change', () => {
    const onSelectFniPosture = jest.fn();
    const { getByText } = render(
      <OwnershipLevers {...BASE} onSelectFniPosture={onSelectFniPosture} />,
    );
    expect(getByText('A normal market markup.')).toBeTruthy();
    fireEvent.press(getByText('More per deal'));
    expect(onSelectFniPosture).toHaveBeenCalledWith('more-per-deal');
  });

  it('says why it does nothing without an F&I manager', () => {
    const staffed = render(<OwnershipLevers {...BASE} fniDeskStaffed />);
    expect(staffed.queryByTestId('fni-posture-unstaffed')).toBeNull();

    const green = render(<OwnershipLevers {...BASE} fniDeskStaffed={false} />);
    // Plain language, and it names the actual reason — not a greyed control
    // with no explanation. The dial stays selectable: a store can set its
    // standing posture before it has anyone to carry it out.
    expect(
      green.getByText(/No finance manager on staff/i),
    ).toBeTruthy();
    expect(green.getByText(/does nothing until you hire one/i)).toBeTruthy();
  });
});

// #346 — the locked IA §4 says Prep is "pure pre-open policy levers". These
// assert the reduction itself, so a NAVIGATION LINK creeping back into Prep
// fails the build. #366 added the third policy lever (the F&I posture), which
// is what "pure pre-open policy" admits; the count moves with the levers.
describe('#346 Prep holds only policy levers and no navigation', () => {
  it('renders the hours, trade-policy and F&I-posture levers and nothing else', () => {
    const { queryByTestId } = render(<OwnershipLevers {...BASE} />);

    expect(queryByTestId('prep-hours')).not.toBeNull();
    expect(queryByTestId('prep-trade-policy')).not.toBeNull();
    expect(queryByTestId('prep-fni-posture')).not.toBeNull();
    // The stock list, per-unit price rows, pricing strategy and its auto-pricing
    // status all moved to the Lot room.
    expect(queryByTestId('auto-pricing-status')).toBeNull();
    expect(queryByTestId('lot-stock-list')).toBeNull();
  });

  it('parks no navigation link in Prep — every control is a policy chip', () => {
    const { getAllByRole } = render(<OwnershipLevers {...BASE} />);

    // The auction and hiring buttons were the two nav links here; both are gone,
    // and the only remaining pressables are the policy chips (8 = 2 hours + 3
    // trade policies + 3 F&I postures), each of which dispatches a setter, never
    // a route — a selection chip always reports `accessibilityState.selected`, a
    // nav link never does.
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(
      BASE.hoursOptions.length +
        BASE.tradePolicyOptions.length +
        BASE.fniPostureOptions.length,
    );
    for (const b of buttons) {
      expect(b.props.accessibilityState?.selected).toBeDefined();
    }
  });

  it('renders the "Prep" heading exactly once on the Operations tab', () => {
    // The block used to paint its own "Next-Day Prep" line directly beneath the
    // tab's "Prep" SectionHeader.
    const { queryAllByText } = render(
      <OperationsTab dock={[]} onDeptPress={() => {}} leverProps={BASE} />,
    );

    expect(queryAllByText(/prep/i)).toHaveLength(1);
  });
});
