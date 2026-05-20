import React from 'react';
import { render } from '@testing-library/react-native';
import { KPIDashboard } from '../src/ui/KPIDashboard';
import type { KPISnapshot } from '../src/game/KPIDashboard';

const ZERO_SPLITS = {
  cashUnits: 0,
  cashGross: 0,
  financeUnits: 0,
  financeGross: 0,
  heavyDownUnits: 0,
  avgApr: 0,
  avgTerm: 0,
  avgDownPct: 0,
};

const ZERO_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 0,
  pvr: 0,
  fniPpru: 0,
  avgFrontGross: 0,
  avgBackGross: 0,
  avgDii: 0,
  ...ZERO_SPLITS,
};

const LIVE_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 10,
  pvr: 3_200,
  fniPpru: 800,
  avgFrontGross: 2_400,
  avgBackGross: 800,
  avgDii: 18,
  ...ZERO_SPLITS,
};

describe('KPIDashboard UI — locked state', () => {
  it('renders without crashing when locked', () => {
    const { getByText } = render(
      <KPIDashboard isUnlocked={false} snapshot={ZERO_SNAPSHOT} />,
    );
    expect(getByText('KPI Dashboard Locked')).toBeTruthy();
    expect(getByText(/Hire a General Manager/i)).toBeTruthy();
  });
});

describe('KPIDashboard UI — unlocked state', () => {
  it('renders without crashing when unlocked with zero data', () => {
    const { getByText } = render(
      <KPIDashboard isUnlocked={true} snapshot={ZERO_SNAPSHOT} />,
    );
    expect(getByText('KPI Dashboard')).toBeTruthy();
    expect(getByText('PVR (Per Vehicle Retailed)')).toBeTruthy();
  });

  it('renders KPI values from snapshot', () => {
    const { getByText } = render(
      <KPIDashboard isUnlocked={true} snapshot={LIVE_SNAPSHOT} />,
    );
    expect(getByText('10')).toBeTruthy();
    expect(getByText('18 days')).toBeTruthy();
  });
});
