import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { DayLoopShell } from '../src/ui/DayLoopShell';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { DayLoopState } from '../src/game/DayLoopController';
import type { DayRecapModel } from '../src/ui/DayRecap';

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const MANAGERIAL_AFTER_CLOSE: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 1,
  ownershipUnlocked: true,
  hasRecap: true,
};

const RECAP: DayRecapModel = {
  day: 1,
  potentialTraffic: 18,
  walkedIn: 12,
  staffEngaged: 8,
  sold: 3,
  gross: 7_650,
  leakCause: 'closing',
  strongMatches: 2,
  matchedSales: 3,
};

describe('DayLoopShell Manager Desk smoke', () => {
  it('renders recap content in Today and keeps the primary day action reachable', () => {
    const onNextDay = jest.fn();
    const { getByTestId, getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={MANAGERIAL_AFTER_CLOSE}
        onNextDay={onNextDay}
        recap={RECAP}
      />,
    );

    expect(getByText('Manager Desk')).toBeTruthy();
    expect(
      within(getByTestId('manager-desk-region-today')).getByText('Day 1 Recap'),
    ).toBeTruthy();
    expect(getByTestId('manager-desk-region-market')).toBeTruthy();
    expect(getByTestId('manager-desk-region-prep')).toBeTruthy();
    expect(getByTestId('manager-desk-region-alerts')).toBeTruthy();

    fireEvent.press(getByText('Next Day →'));
    expect(onNextDay).toHaveBeenCalledTimes(1);
  });

  it('uses Open Floor for the cold-start managerial action', () => {
    const { getByText } = render(
      <DayLoopShell
        profile={PROFILE}
        state={{ ...MANAGERIAL_AFTER_CLOSE, hasRecap: false }}
        onNextDay={() => {}}
      />,
    );

    expect(getByText('Open Floor →')).toBeTruthy();
  });
});
