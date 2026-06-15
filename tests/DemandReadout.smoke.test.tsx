import React from 'react';
import { render } from '@testing-library/react-native';
import {
  DemandReadout,
  classifyHeatBand,
  classifyHeatBandFine,
  type DemandReadoutModel,
  type HeatBandThresholds,
} from '../src/ui/DemandReadout';

const THRESHOLDS: HeatBandThresholds = {
  hot: 1.15,
  cold: 0.85,
  veryHot: 1.35,
  veryCold: 0.65,
};

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

  it('renders the heat console (#280): a HOT/WARM/COLD band per segment, with its own header above the trailing window', () => {
    const { getByText, getByTestId, getByLabelText } = render(
      <DemandReadout
        model={{
          ...MODEL,
          heatBands: [
            { segment: 'suv', label: 'SUVs', band: 'hot' },
            { segment: 'truck', label: 'Trucks', band: 'warm' },
            { segment: 'sedan', label: 'Sedans', band: 'cold' },
          ],
        }}
      />,
    );
    expect(getByTestId('demand-heat-console')).toBeTruthy();
    expect(getByText('Demand Heat')).toBeTruthy();
    // The console reads as its own region; the trailing window gets its header.
    expect(getByText("Who's Been Walking In")).toBeTruthy();
    expect(getByLabelText('SUVs demand Hot')).toBeTruthy();
    expect(getByLabelText('Trucks demand Warm')).toBeTruthy();
    expect(getByLabelText('Sedans demand Cold')).toBeTruthy();
  });

  it('classifies heat bands off share × segment count (#280): even = warm, over = hot, under = cold', () => {
    // Three segments: even share is 1/3 ⇒ heat 1.0 (warm).
    expect(classifyHeatBand(1 / 3, 3, THRESHOLDS)).toBe('warm');
    expect(classifyHeatBand(0.5, 3, THRESHOLDS)).toBe('hot'); // 1.5×
    expect(classifyHeatBand(0.2, 3, THRESHOLDS)).toBe('cold'); // 0.6×
  });

  it('classifies fine 5-band heat for the sharp UCM read (#284): resolves the two extremes the coarse read flattens', () => {
    // 1.5× reads merely "hot" coarse, but "very hot" once a UCM sharpens it.
    expect(classifyHeatBand(0.5, 3, THRESHOLDS)).toBe('hot');
    expect(classifyHeatBandFine(0.5, 3, THRESHOLDS)).toBe('very-hot'); // ≥1.35
    expect(classifyHeatBandFine(0.42, 3, THRESHOLDS)).toBe('hot'); // 1.26×, <1.35
    expect(classifyHeatBandFine(1 / 3, 3, THRESHOLDS)).toBe('warm'); // 1.0×
    expect(classifyHeatBandFine(0.25, 3, THRESHOLDS)).toBe('cold'); // 0.75×
    expect(classifyHeatBandFine(0.2, 3, THRESHOLDS)).toBe('very-cold'); // 0.6×, ≤0.65
  });

  it('renders the fine readout heat index when present (#284)', () => {
    const { getByText, getByLabelText } = render(
      <DemandReadout
        model={{
          ...MODEL,
          heatBands: [
            { segment: 'suv', label: 'SUVs', band: 'very-hot', heatIndex: 1.5 },
          ],
        }}
      />,
    );
    expect(getByText('1.50×')).toBeTruthy();
    expect(getByLabelText('SUVs demand Very Hot')).toBeTruthy();
  });

  it('shows an empty hint before any traffic is observed', () => {
    const { getByText } = render(
      <DemandReadout model={{ totalObserved: 0, entries: MODEL.entries }} />,
    );
    expect(getByText("No traffic yet — open the lot to see what's hot.")).toBeTruthy();
  });
});
