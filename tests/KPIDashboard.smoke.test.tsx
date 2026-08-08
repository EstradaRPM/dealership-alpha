import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { KPIDashboard } from '../src/ui/KPIDashboard';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import type { KPISnapshot } from '../src/game/KPIDashboard';
import type { MarketStateModel } from '../src/ui/KPIDashboard';

const ZERO_SPLITS = {
  backEndByStructure: ZERO_KPI_SNAPSHOT.backEndByStructure,
  cashUnits: 0,
  cashGross: 0,
  financeUnits: 0,
  financeGross: 0,
  heavyDownUnits: 0,
  avgApr: 0,
  avgTerm: 0,
  avgDownPct: 0,
  dailyCarryingCost: 0,
};

const ZERO_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 0,
  pvr: 0,
  fniPpru: 0,
  avgFrontGross: 0,
  avgBackGross: 0,
  productGross: 0,
  reserveGross: 0,
  avgDii: 0,
  ...ZERO_SPLITS,
};

const LIVE_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 10,
  pvr: 3_200,
  fniPpru: 800,
  avgFrontGross: 2_400,
  avgBackGross: 800,
  productGross: 0,
  reserveGross: 0,
  avgDii: 18,
  ...ZERO_SPLITS,
};

describe('KPIDashboard UI', () => {
  it('renders without crashing with zero data', () => {
    const { getByTestId, getByText } = render(<KPIDashboard snapshot={ZERO_SNAPSHOT} />);
    expect(getByTestId('kpi-dashboard')).toBeTruthy();
    expect(getByText('PVR (Per Vehicle Retailed)')).toBeTruthy();
  });

  it('renders KPI values from snapshot', () => {
    const { getByText } = render(<KPIDashboard snapshot={LIVE_SNAPSHOT} />);
    expect(getByText('10')).toBeTruthy();
    expect(getByText('18 days')).toBeTruthy();
  });

  // #351: no close action, and no chrome of its own. It is an embedded block
  // inside whatever surface hosts it, not a screen you dismiss.

  it('omits the market-state panel when no marketState is supplied', () => {
    const { queryByTestId } = render(<KPIDashboard snapshot={LIVE_SNAPSHOT} />);
    expect(queryByTestId('market-state-panel')).toBeNull();
  });

  it('renders the market-state panel when supplied (#179)', () => {
    const marketState: MarketStateModel = {
      segmentHeat: [
        {
          segment: 'suv',
          label: 'SUVs',
          heat: 0.12,
          personality: 0.05,
          drift: 0.05,
          shock: 0.02,
          band: 'strong-above',
        },
        {
          segment: 'sedan',
          label: 'Sedans',
          heat: -0.06,
          personality: -0.04,
          drift: -0.02,
          shock: 0,
          band: 'below',
        },
      ],
      activeShocks: [
        {
          instanceId: 'fuel-spike@3',
          label: 'Fuel price spike',
          segments: [{ label: 'Trucks', magnitude: -0.08 }],
          daysRemaining: 4,
        },
      ],
      valuation: {
        unitCount: 3,
        totalBook: 60_000,
        totalMarket: 75_000,
        unrealizedGross: 15_000,
        weeklyCarryingBurn: 420,
      },
      stale: { staleCount: 1, staleShare: 1 / 3, staleCost: 18_000, thresholdDays: 45 },
    };
    const { getByTestId, getByText } = render(
      <KPIDashboard snapshot={LIVE_SNAPSHOT} marketState={marketState} />,
    );
    expect(getByTestId('market-state-panel')).toBeTruthy();
    expect(getByText('Used-Value Pressure')).toBeTruthy();
    expect(getByText('Active Market Shocks')).toBeTruthy();
    expect(getByText('Fuel price spike')).toBeTruthy();
    // Valuation figure surfaces (formatted).
    expect(getByText('$75,000')).toBeTruthy();
  });

  it('expands a segment factor breakdown on tap (#179)', () => {
    const marketState: MarketStateModel = {
      segmentHeat: [
        {
          segment: 'suv',
          label: 'SUVs',
          heat: 0.12,
          personality: 0.05,
          drift: 0.05,
          shock: 0.02,
          band: 'strong-above',
        },
      ],
      activeShocks: [],
      valuation: {
        unitCount: 0,
        totalBook: 0,
        totalMarket: 0,
        unrealizedGross: 0,
        weeklyCarryingBurn: 0,
      },
      stale: { staleCount: 0, staleShare: 0, staleCost: 0, thresholdDays: 45 },
    };
    const { getByLabelText, queryByText } = render(
      <KPIDashboard snapshot={LIVE_SNAPSHOT} marketState={marketState} />,
    );
    expect(queryByText(/Personality \+5%/)).toBeNull();
    fireEvent.press(
      getByLabelText(/SUVs used values Well above, \+12%\. Tap for factor breakdown\./),
    );
    expect(queryByText(/Personality \+5%/)).toBeTruthy();
  });
});
