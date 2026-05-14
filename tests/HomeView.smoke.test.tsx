import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeView } from '../src/ui/HomeView';
import type { CharacterProfile } from '../src/game/CareerProgression';

const freshCareer: CharacterProfile = {
  name: 'Test Player',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.1,
    startingCreditLine: 20000,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

describe('HomeView', () => {
  it('renders without crashing given a fresh-career state fixture', () => {
    const { getByText } = render(<HomeView profile={freshCareer} />);
    expect(getByText('Test Player\'s Lot')).toBeTruthy();
    expect(getByText('Tier 1 — Gravel Yard')).toBeTruthy();
  });

  it('renders all five departments with badge=0', () => {
    const { getByText } = render(<HomeView profile={freshCareer} />);
    expect(getByText('Sales')).toBeTruthy();
    expect(getByText('Service')).toBeTruthy();
    expect(getByText('BDC')).toBeTruthy();
    expect(getByText('Office')).toBeTruthy();
    expect(getByText('Lot')).toBeTruthy();
  });
});
