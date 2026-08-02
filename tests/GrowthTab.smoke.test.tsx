import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GrowthTab } from '../src/ui/GrowthTab';
import type { GateBoardModel } from '../src/ui/GrowthTab';
import type { DemandReadoutModel } from '../src/ui/DemandReadout';
import { HomeTab } from '../src/ui/HomeTab';
import { OperationsTab } from '../src/ui/OperationsTab';

// #349 — Growth stops being a placeholder card. Two things get a home: the
// demand console (with the advertising lever evicted from Operations → Prep in
// #346 and the market stack lifted off Home) and the tier-gate detail board.

const DEMAND: DemandReadoutModel = {
  heatBands: [
    { segment: 'suv', label: 'SUVs', band: 'hot' },
    { segment: 'sedan', label: 'Sedans', band: 'cold' },
  ],
  entries: [
    { segment: 'suv', label: 'SUVs', share: 0.6, count: 6, trend: 'rising' },
    { segment: 'sedan', label: 'Sedans', share: 0.4, count: 4, trend: 'steady' },
  ],
  totalObserved: 10,
  advertising: {
    options: [
      { id: 'none', label: 'No campaign', blurb: 'No paid advertising push.' },
      {
        id: 'local-radio',
        label: 'Local radio',
        blurb: 'Run a modest radio push.',
        costLabel: '$75/day',
      },
    ],
    selectedId: 'none',
    onSelect: () => {},
  },
};

const BOARD: GateBoardModel = {
  periodLabel: 'Tier 1 · Day 12 of 30',
  remainingLabel: '18 days left',
  faces: [
    {
      id: 'units',
      kind: 'flow',
      label: 'Retail Units',
      valueLabel: '5 / 8',
      statusLabel: 'Behind pace',
      tone: 'primary',
      fill: 0.625,
      details: [{ label: 'Still to go', value: '3' }],
    },
    {
      id: 'csi',
      kind: 'trend',
      label: 'CSI',
      valueLabel: '72',
      statusLabel: 'Under the bar',
      tone: 'danger',
      sparkline: [0.1, 0.5, 0.9],
      trend: 'up' as const,
      details: [{ label: 'Bar to clear', value: '75' }],
    },
  ],
  climb: {
    title: 'Next up: Tier 2',
    requirements: [{ label: 'Retail Units', value: '15 a month' }],
    ruleLabel: 'Clear every bar below for 2 straight months to move up.',
    streakLabel: 'Track record: month 1 of 2',
  },
};

describe('#349 the Growth tab renders the demand console and the gate board', () => {
  it('mounts both regions', () => {
    const { getByTestId } = render(
      <GrowthTab demandReadout={DEMAND} gateBoard={BOARD} />,
    );
    expect(getByTestId('growth-region-demand')).toBeTruthy();
    expect(getByTestId('growth-region-gate')).toBeTruthy();
    expect(getByTestId('growth-gate-board')).toBeTruthy();
  });

  it('carries no placeholder or coming-later copy', () => {
    const { queryByText, queryByTestId } = render(
      <GrowthTab demandReadout={DEMAND} gateBoard={BOARD} />,
    );
    expect(queryByText(/coming in a later slice/i)).toBeNull();
    expect(queryByText(/later slice|coming soon|not yet available/i)).toBeNull();
    expect(queryByTestId('strategic-tab-growth')).toBeNull();
  });

  it('holds the advertising campaign lever, priced on every chip', () => {
    const picked: string[] = [];
    const { getByTestId, getByText } = render(
      <GrowthTab
        demandReadout={{
          ...DEMAND,
          advertising: { ...DEMAND.advertising!, onSelect: (id) => picked.push(id) },
        }}
      />,
    );
    expect(getByTestId('demand-advertising')).toBeTruthy();
    // The price rides the chip so campaigns compare without selecting one.
    fireEvent.press(getByText('Local radio · $75/day'));
    expect(picked).toEqual(['local-radio']);
  });

  it('states the running campaign‘s daily bill once one is selected', () => {
    const { getByTestId, queryByTestId } = render(
      <GrowthTab
        demandReadout={{
          ...DEMAND,
          advertising: { ...DEMAND.advertising!, selectedId: 'local-radio' },
        }}
      />,
    );
    expect(getByTestId('demand-advertising-cost')).toBeTruthy();
    // …and not while nothing is running (no campaign, no bill).
    const idle = render(<GrowthTab demandReadout={DEMAND} />);
    expect(idle.queryByTestId('demand-advertising-cost')).toBeNull();
    expect(queryByTestId('growth-gate-board')).toBeNull();
  });

  it('spells the gate faces out and foreshadows the next rung', () => {
    const { getByTestId, getByText } = render(<GrowthTab gateBoard={BOARD} />);
    expect(getByTestId('gate-board-face-units')).toBeTruthy();
    expect(getByTestId('gate-board-face-csi')).toBeTruthy();
    expect(getByTestId('gate-board-fill-units')).toBeTruthy();
    expect(getByTestId('gate-board-spark-csi')).toBeTruthy();
    expect(getByTestId('growth-gate-climb')).toBeTruthy();
    expect(getByText('Next up: Tier 2')).toBeTruthy();
    expect(getByText('Track record: month 1 of 2')).toBeTruthy();
  });

  it('drops the climb section entirely at the top of the built ladder', () => {
    // Rule 3: no grayed foreshadow tile for a rung that does not exist.
    const { queryByTestId } = render(
      <GrowthTab gateBoard={{ ...BOARD, climb: null }} />,
    );
    expect(queryByTestId('growth-gate-climb')).toBeNull();
  });
});

describe('#349 the stack that moved is gone from where it used to be', () => {
  it('Home renders a routing glance, not the console', () => {
    const opened: number[] = [];
    const { getByTestId, queryByTestId } = render(
      <HomeTab
        state={{ day: 3, phase: 'MANAGERIAL', hasRecap: false } as never}
        marketGlance={{
          headline: 'Buyers want SUVs most',
          campaignLabel: 'No campaign running',
        }}
        onOpenGrowth={() => opened.push(1)}
      />,
    );
    expect(getByTestId('home-market-glance')).toBeTruthy();
    // The detail is NOT on Home any more — glances only.
    expect(queryByTestId('demand-readout')).toBeNull();
    expect(queryByTestId('industry-wire')).toBeNull();
    expect(queryByTestId('weekly-market-report')).toBeNull();
    fireEvent.press(getByTestId('home-market-glance'));
    expect(opened).toEqual([1]);
  });

  it('Operations renders no advertising control', () => {
    const { queryByTestId } = render(
      <OperationsTab
        dock={[]}
        onDeptPress={() => {}}
        leverProps={{
          enabled: true,
          hoursOptions: [{ id: 'standard', label: 'Standard', ticksPerDay: 40 }],
          hoursOfOpId: 'standard',
          onSelectHours: () => {},
          tradePolicyOptions: [{ id: 'fair', label: 'Fair', blurb: 'Book value.' }],
          tradePolicyId: 'fair',
          onSelectTradePolicy: () => {},
        }}
      />,
    );
    expect(queryByTestId('demand-advertising')).toBeNull();
  });
});
