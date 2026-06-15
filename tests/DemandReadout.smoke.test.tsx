import React from 'react';
import { render } from '@testing-library/react-native';
import { DemandReadout, type DemandReadoutModel } from '../src/ui/DemandReadout';

const MODEL: DemandReadoutModel = {
  totalObserved: 10,
  entries: [
    { segment: 'suv', label: 'SUVs', share: 0.5, count: 5, trend: 'rising' },
    { segment: 'sedan', label: 'Sedans', share: 0.3, count: 3, trend: 'falling' },
    { segment: 'truck', label: 'Trucks', share: 0.2, count: 2, trend: 'steady' },
  ],
  targetingLevers: [
    {
      id: 'inventory-composition',
      label: 'Inventory composition',
      lean: [{ segment: 'suv', label: 'SUVs', weight: 0.42 }],
    },
  ],
  coverageGap: { category: 'truck', label: 'Trucks', wantedCount: 2, stockCount: 0 },
};

describe('DemandReadout smoke', () => {
  it('renders segment labels, shares, and trend indicators (no internal card title — the Market region header owns it, #257)', () => {
    const { getByText, getByLabelText, queryByText } = render(<DemandReadout model={MODEL} />);
    expect(queryByText("Who's Been Walking In")).toBeNull();
    expect(getByText('SUVs')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
    expect(getByLabelText('SUVs trend rising')).toBeTruthy();
    expect(getByLabelText('Sedans trend falling')).toBeTruthy();
    expect(getByLabelText('Trucks trend steady')).toBeTruthy();
    expect(getByText("What You're Promoting")).toBeTruthy();
    expect(getByText('Inventory composition')).toBeTruthy();
    expect(getByText('SUVs +42')).toBeTruthy();
    expect(getByText(/recent buyers wanted trucks; you\s*stock 0/i)).toBeTruthy();
  });

  it('shows an empty hint before any traffic is observed', () => {
    const { getByText } = render(
      <DemandReadout model={{ totalObserved: 0, entries: MODEL.entries }} />,
    );
    expect(getByText("No traffic yet — open the lot to see what's hot.")).toBeTruthy();
  });
});
