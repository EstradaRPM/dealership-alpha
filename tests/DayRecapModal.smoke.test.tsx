import React from 'react';
import { render } from '@testing-library/react-native';
import { DayRecapModal, type DayRecapModel } from '../src/ui/DayRecap';

const MODEL: DayRecapModel = {
  day: 7,
  potentialTraffic: 22,
  walkedIn: 14,
  staffEngaged: 9,
  sold: 4,
  gross: 11_200,
  leakCause: 'engagement',
  strongMatches: 3,
  matchedSales: 4,
};

describe('DayRecapModal smoke tests (#253)', () => {
  it('renders the recap card inside the modal when visible', () => {
    const { getByText } = render(
      <DayRecapModal visible model={MODEL} onDismiss={jest.fn()} />,
    );
    // The wrapped DayRecap card surfaces the day header + funnel.
    expect(getByText('Day 7 Recap')).toBeTruthy();
  });

  it('renders nothing when there is no model (pre-Day-1)', () => {
    const { queryByTestId } = render(
      <DayRecapModal visible model={null} onDismiss={jest.fn()} />,
    );
    expect(queryByTestId('day-recap-modal')).toBeNull();
  });

  it('does not throw when hidden', () => {
    expect(() =>
      render(<DayRecapModal visible={false} model={MODEL} onDismiss={jest.fn()} />),
    ).not.toThrow();
  });
});
