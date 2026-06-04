import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  MonthCloseInterstitial,
  type MonthCloseModel,
} from '../src/ui/MonthCloseInterstitial';

const ZERO_SPLITS = {
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

const SNAPSHOT = {
  unitsRetailed: 14,
  pvr: 2_350,
  fniPpru: 980,
  avgFrontGross: 1_370,
  avgBackGross: 980,
  avgDii: 41,
  ...ZERO_SPLITS,
};

const MODEL: MonthCloseModel = {
  month: 1,
  tier: 1,
  isUnlocked: true,
  snapshot: SNAPSHOT,
};

describe('MonthCloseInterstitial smoke tests', () => {
  it('renders the composed chapter strip + KPI dashboard without crashing', () => {
    expect(() =>
      render(<MonthCloseInterstitial model={MODEL} onDismiss={() => {}} />),
    ).not.toThrow();
  });

  it('renders the KPI-locked (no GM) variant', () => {
    expect(() =>
      render(
        <MonthCloseInterstitial
          model={{ ...MODEL, isUnlocked: false }}
          onDismiss={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it('dismisses via the Continue action', () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <MonthCloseInterstitial model={MODEL} onDismiss={onDismiss} />,
    );
    fireEvent.press(getByLabelText('Continue to next day'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a later month with a zero snapshot', () => {
    expect(() =>
      render(
        <MonthCloseInterstitial
          model={{
            month: 6,
            tier: 1,
            isUnlocked: false,
            snapshot: {
              unitsRetailed: 0,
              pvr: 0,
              fniPpru: 0,
              avgFrontGross: 0,
              avgBackGross: 0,
              avgDii: 0,
              ...ZERO_SPLITS,
            },
          }}
          onDismiss={() => {}}
        />,
      ),
    ).not.toThrow();
  });
});
