import React from 'react';
import { render } from '@testing-library/react-native';
import { DemandReadout, type DemandReadoutModel } from '../src/ui/DemandReadout';

const MODEL: DemandReadoutModel = {
  totalObserved: 10,
  entries: [
    { persona: 'young_family', label: 'Young Family', share: 0.5, count: 5, trend: 'rising' },
    { persona: 'enthusiast', label: 'Enthusiast', share: 0.3, count: 3, trend: 'falling' },
    { persona: 'commuter', label: 'Commuter', share: 0.2, count: 2, trend: 'steady' },
  ],
  targetingLevers: [
    {
      id: 'inventory-composition',
      label: 'Inventory composition',
      lean: [{ persona: 'young_family', label: 'Young Family', weight: 0.42 }],
    },
  ],
  coverageGap: { category: 'truck', label: 'trucks', wantedCount: 2, stockCount: 0 },
};

describe('DemandReadout smoke', () => {
  it('renders persona labels, shares, and trend indicators (no internal card title — the Market region header owns it, #257)', () => {
    const { getByText, getByLabelText, queryByText } = render(<DemandReadout model={MODEL} />);
    expect(queryByText("Who's Been Walking In")).toBeNull();
    expect(getByText('Young Family')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
    expect(getByLabelText('Young Family trend rising')).toBeTruthy();
    expect(getByLabelText('Enthusiast trend falling')).toBeTruthy();
    expect(getByLabelText('Commuter trend steady')).toBeTruthy();
    expect(getByText("Who You're Targeting")).toBeTruthy();
    expect(getByText('Inventory composition')).toBeTruthy();
    expect(getByText('Young Family +42')).toBeTruthy();
    expect(getByText(/recent buyers wanted trucks; you\s*stock 0/i)).toBeTruthy();
  });

  it('shows an empty hint before any traffic is observed', () => {
    const { getByText } = render(
      <DemandReadout model={{ totalObserved: 0, entries: MODEL.entries }} />,
    );
    expect(getByText('No traffic yet — open the lot to see the mix.')).toBeTruthy();
  });
});
