import React from 'react';
import { render } from '@testing-library/react-native';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';
import { buildReveal } from '../src/ui/Reveal';

const FUNNEL = {
  potentialTraffic: 18,
  walkedIn: 12,
  staffEngaged: 8,
  sold: 3,
  gated: 0,
  leakCause: 'closing' as const,
};

const MODEL: DayRecapModel = {
  day: 4,
  potentialTraffic: 18,
  walkedIn: 12,
  staffEngaged: 8,
  sold: 3,
  gross: 7_650,
  leakCause: 'closing',
  strongMatches: 2,
  matchedSales: 3,
  reveal: buildReveal(FUNNEL, 7_650, { strong: 2, matched: 3 }),
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
    const zeroFunnel = { ...FUNNEL, potentialTraffic: 0, walkedIn: 0, staffEngaged: 0, sold: 0 };
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
            strongMatches: 0,
            matchedSales: 0,
            reveal: buildReveal(zeroFunnel, -1_200, { strong: 0, matched: 0 }),
          }}
        />,
      ),
    ).not.toThrow();
  });

  it('renders the Reveal match-summary reaction when deals closed (#199/#319)', () => {
    const { getByText } = render(<DayRecap model={MODEL} />);
    expect(getByText(/2 of 3 stuck — you had what the crowd wanted/)).toBeTruthy();
  });
});
