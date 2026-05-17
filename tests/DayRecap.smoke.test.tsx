import React from 'react';
import { render } from '@testing-library/react-native';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';

const MODEL: DayRecapModel = {
  day: 4,
  potentialTraffic: 18,
  walkedIn: 12,
  staffEngaged: 8,
  sold: 3,
  gross: 7_650,
  leakCause: 'closing',
};

describe('DayRecap smoke tests', () => {
  it('renders the funnel + units/gross + leak callout without crashing', () => {
    expect(() => render(<DayRecap model={MODEL} />)).not.toThrow();
  });

  it.each(['capacity', 'engagement', 'closing', 'none'] as const)(
    'renders with leakCause=%s',
    (leakCause) => {
      expect(() =>
        render(<DayRecap model={{ ...MODEL, leakCause }} />),
      ).not.toThrow();
    },
  );

  it('renders a zero-traffic / negative-gross day', () => {
    expect(() =>
      render(
        <DayRecap
          model={{
            day: 1,
            potentialTraffic: 0,
            walkedIn: 0,
            staffEngaged: 0,
            sold: 0,
            gross: -1_200,
            leakCause: 'none',
          }}
        />,
      ),
    ).not.toThrow();
  });
});
